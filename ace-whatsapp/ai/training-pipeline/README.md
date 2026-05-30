# Training Pipeline

> **ACE WhatsApp — AI Training Infrastructure**  
> Stack: **TypeScript (Vercel AI SDK middleware) + Python (Airflow) + HITL tooling**  
> Role: Continuously improve ACE's models using ACE's own interaction data

---

## The Core Loop

ACE's models get better the more merchants use the platform. Every conversation is a training signal. Every merchant correction teaches the AI what it got wrong. This is the flywheel that compounds into a durable moat.

```
[Live Interactions]
      │
      ▼ (Vercel AI SDK middleware captures every step)
[Raw Interaction Log]  →  Kafka: training.interactions
      │
      ▼
[Auto-Quality Filter]  →  removes low-confidence, duplicate, trivial events
      │
      ▼
[PII Scrubber]  →  phone numbers, names, addresses redacted / tokenised
      │
      ├──→ [Auto-Labelled Queue]    confidence > 0.95 → used directly
      │
      └──→ [HITL Queue]             confidence 0.70–0.95 → human review
                  │
                  ▼
         [Verified Dataset Store]   (PostgreSQL + S3 cold storage)
                  │
          ┌───────┴──────────┐
          ▼                  ▼
  [Model Fine-tuning]  [Enterprise Data Products]
  (ACE internal)       (sold to AI labs, FMCGs, banks)
```

---

## Stage 1: Interaction Capture (Vercel AI SDK Middleware)

Every call to the Vercel AI SDK is wrapped with `aceTrainingMiddleware`. This captures the full interaction trace — inputs, tool calls, outputs, and final merchant/customer outcome.

### What Gets Captured Per Interaction

```typescript
interface TrainingInteraction {
  // Identity (anonymised)
  merchantId: string            // hashed merchant ref
  sessionId: string             // conversation session UUID
  globalBuyerIdHash: string     // hashed customer ref

  // Input
  rawMessage: string            // original customer message (pre-PII scrub)
  dialect: Dialect              // detected language/dialect
  hasAudio: boolean             // was this a voice note?
  audioTranscript?: string      // Whisper output (pre-PII scrub)

  // AI reasoning trace
  modelUsed: string             // e.g. 'gpt-4o-2024-...'
  toolCallSequence: ToolCall[]  // ordered list of tools called + responses
  intentClassified: Intent      // structured intent object from generateObject
  responseGenerated: string     // final message sent to customer

  // Outcome signals (filled in asynchronously)
  customerEngaged: boolean      // did customer reply positively?
  orderCompleted: boolean       // did an order result from this?
  merchantCorrected: boolean    // did merchant override the AI's action?
  merchantCorrectionDetails?: string  // what the merchant changed

  // Quality signals
  aiConfidence: number          // 0–1 from generateObject
  latencyMs: number             // time to first token
  tokensUsed: number            // for cost tracking

  // Timestamps
  capturedAt: string            // ISO 8601
}
```

### Middleware Implementation (Vercel AI SDK)

```typescript
// ace-whatsapp/ai/intent-parser/src/middleware/training.ts

import { wrapLanguageModel } from 'ai'
import type { LanguageModelV1Middleware } from 'ai'

export const aceTrainingMiddleware: LanguageModelV1Middleware = {
  wrapGenerate: async ({ doGenerate, params }) => {
    const startTime = Date.now()
    const result = await doGenerate()

    // Publish raw interaction to Kafka
    await kafkaProducer.send({
      topic: 'training.interactions.raw',
      messages: [{
        key: params.sessionId,
        value: JSON.stringify({
          params,
          result,
          latencyMs: Date.now() - startTime,
        })
      }]
    })

    return result
  },

  wrapStream: async ({ doStream, params }) => {
    // Streaming variant — captures after stream completes
    const { stream, ...rest } = await doStream()
    return { stream: captureStreamForTraining(stream, params), ...rest }
  },
}
```

---

## Stage 2: Auto-Quality Filtering (Rust)

Kafka consumer that reads `training.interactions.raw` and routes each event:

| Condition | Route |
|-----------|-------|
| `aiConfidence >= 0.95` AND `orderCompleted = true` | → `training.interactions.verified` (auto-labelled gold) |
| `aiConfidence 0.70–0.95` | → `training.interactions.hitl` (needs human review) |
| `merchantCorrected = true` | → `training.interactions.corrections` (high-value signal) |
| `aiConfidence < 0.70` | → `training.interactions.lowquality` (archived, not trained on) |
| Injection attempt detected | → `training.interactions.adversarial` (separate analysis) |

---

## Stage 3: PII Scrubbing (Python)

Automated pipeline on all queues before any data leaves the raw store.

```python
# Entities detected and replaced by NER model:
PII_ENTITY_TYPES = [
    'PHONE_NUMBER',        # → [PHONE]
    'PERSON_NAME',         # → [NAME]
    'LOCATION_ADDRESS',    # → [ADDRESS]
    'BANK_ACCOUNT',        # → [BANK_ACCOUNT]
    'BANK_TRANSFER_REF',   # → [TRANSFER_REF]
    'EMAIL_ADDRESS',       # → [EMAIL]
]

# After scrubbing, original is deleted. Scrubbed version advances to next stage.
# Audit log: scrub timestamp, entity types found (not values), scrubber model version
```

---

## Stage 4: HITL Verification Queue

Human-in-the-loop review for interactions in the `0.70–0.95` confidence band and all merchant corrections.

### HITL Reviewer Interface (Internal Tool)

**Queue view** — reviewers see:
- Original customer message (PII-scrubbed)
- Dialect tag (to verify)
- AI's classified intent (to verify or correct)
- AI's response (to rate: correct / partially correct / wrong)
- Outcome: did the customer engage / complete purchase?

**Correction interface:**
```
Original: "Abeg I wan buy 2 of the ankara wey dey your page"
AI Intent: { intent: "purchase", product: "ankara fabric", qty: 2, dialect: "pidgin" }

Reviewer options:
  [✓ Correct]
  [Edit intent]  →  opens structured form
  [Wrong dialect]  →  dropdown to correct
  [Ambiguous — skip]
```

### HITL Workforce
- Phase 1: internal team + trusted beta merchants
- Phase 2: university student micro-taskers (Lagos, Ibadan, Abuja)
- Phase 3: dedicated annotation team with dialect specialist leads

### Quality Control for HITL
- Inter-annotator agreement threshold: ≥ 0.85 for dataset inclusion
- Gold standard test set: 500 pre-verified interactions injected into HITL queue to measure annotator accuracy
- Annotators scoring < 80% on gold set are removed from queue

---

## Stage 5: Merchant Correction Signals (Highest Value)

When a merchant overrides the AI (edits a response, rejects an auto-action), this is captured as the highest-quality training signal — **real-world preference data from the person who knows their business best**.

```typescript
interface MerchantCorrection {
  originalAiOutput: string       // what the AI did/said
  merchantOverride: string       // what the merchant replaced it with
  correctionType: 'response_edit' | 'action_rejected' | 'price_override' | 'intent_correction'
  context: ConversationContext   // full conversation history at point of correction
}
```

This data directly powers:
1. **Fine-tuning**: teaches the model merchant-specific preferences
2. **RLHF pairs**: AI output (rejected) vs merchant correction (preferred) = preference pair for RLHF
3. **Enterprise sale**: anonymised correction patterns → AI lab training data

---

## Stage 6: Fine-Tuning Pipeline (Airflow DAGs)

```
DAG: ace_model_finetuning (runs weekly)

Task 1: collect_verified_interactions
  → Query training.interactions.verified (last 7 days)
  → Filter by quality score ≥ 0.90
  → Export to S3 staging bucket

Task 2: format_for_finetuning
  → Convert to OpenAI fine-tuning JSONL format:
    { "messages": [{"role": "system", ...}, {"role": "user", ...}, {"role": "assistant", ...}] }
  → OR: preference pairs for RLHF fine-tuning

Task 3: run_finetuning_job
  → Submit to OpenAI fine-tuning API (Phase 1–2)
  → OR: submit to self-hosted training cluster (Phase 3)
  → Monitor job completion

Task 4: evaluate_new_model
  → Run on held-out evaluation set (1000 gold interactions per dialect)
  → Compare: intent accuracy, dialect accuracy, tool call correctness
  → Must beat baseline by ≥ 2% to proceed

Task 5: shadow_deployment
  → Route 5% of live traffic to new model
  → Monitor: merchant correction rate, order completion rate
  → If correction rate ↑ by > 1% → rollback automatically

Task 6: full_deployment
  → Update model pointer in Vercel AI SDK config
  → Notify engineering Slack channel
```

---

## Stage 7: Model Evaluation Framework

### Evaluation Datasets (held-out, never trained on)

| Dataset | Size | Purpose |
|---------|------|---------|
| `eval-intent-en` | 500 interactions | Intent accuracy (English) |
| `eval-intent-pidgin` | 500 interactions | Intent accuracy (Nigerian Pidgin) |
| `eval-intent-yoruba` | 300 interactions | Intent accuracy (Yoruba-English code-switch) |
| `eval-intent-hausa` | 300 interactions | Intent accuracy (Hausa) |
| `eval-tool-calls` | 500 interactions | Correct tool call sequence |
| `eval-pricing` | 200 interactions | Correct pricing negotiation within bounds |
| `eval-adversarial` | 200 interactions | Resistance to prompt injection |

### Key Metrics

| Metric | Target (Phase 1) | Target (Phase 2) |
|--------|-----------------|-----------------|
| Intent classification accuracy | ≥ 88% | ≥ 94% |
| Dialect detection accuracy | ≥ 92% | ≥ 96% |
| Tool call correctness | ≥ 85% | ≥ 92% |
| Merchant correction rate | < 8% | < 4% |
| Prompt injection detection | ≥ 98% | ≥ 99.5% |

---

## Training Data Volumes (Projected)

| Timeline | Merchants | Monthly Interactions | Verified Training Samples (cumulative) |
|----------|-----------|---------------------|----------------------------------------|
| Month 3 | 50 | 60,000 | 15,000 |
| Month 6 | 200 | 240,000 | 90,000 |
| Month 12 | 800 | 960,000 | 480,000 |
| Year 2 | 3,000 | 3.6M | 2.4M |

At Year 2 scale: a **2.4M sample dialect-rich informal commerce dataset** — the kind of dataset AI labs pay $80K+ per vertical for.

## Status

`[ ] Not started — placeholder`
