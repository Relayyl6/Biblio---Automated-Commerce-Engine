# AI Training Strategy

> **ACE — Cross-cutting AI training and model improvement strategy**

---

## The Model Hierarchy

ACE uses a layered model strategy. As the platform matures and training data accumulates, we progressively replace hosted models with our own fine-tuned and eventually self-hosted models.

```
Phase 1                     Phase 2                    Phase 3
(Months 1–12)               (Year 2)                   (Year 3+)
─────────────────────       ─────────────────────      ─────────────────────
GPT-4o (hosted)             ACE Fine-tuned GPT         ACE-Native LLM
  │ intent extraction         on informal commerce       self-hosted, dialect-native
  │                           conversations
Whisper (local)             ACE Fine-tuned Whisper     ACE ASR API
  │ voice → text              on Nigerian dialects        sold externally
  │
Dialect BERT (local)        ACE Dialect Embeddings     ACE Embedding API
  │ slang normalisation        trained on ACE data        sold externally
```

**The transition point**: When ACE has ~500K verified training interactions (projected: Month 12), fine-tuning outperforms the base GPT-4o on informal commerce tasks. That's when we own the model.

---

## What We're Training For

### Intent Classification (highest priority)
- Goal: correctly classify customer message intent into structured types
- Current baseline: GPT-4o with zero-shot prompting
- Target: fine-tuned model that outperforms GPT-4o by 8%+ on Pidgin/dialect inputs
- Training signal: verified intent labels from HITL + merchant corrections

### Dialect & Slang Normalisation
- Goal: translate Pidgin/Yoruba/Hausa/Igbo commerce speech into structured English
- Current baseline: regional BERT + dictionary lookup
- Target: fine-tuned seq2seq model specifically on Nigerian informal commerce vocabulary
- Training signal: raw ↔ normalised transcript pairs from HITL corrections

### Voice Note Transcription (ASR)
- Goal: accurately transcribe Nigerian Pidgin and code-switched speech
- Current baseline: Whisper base model (Western-trained, high WER on Pidgin)
- Target: Whisper fine-tuned on ACE's verified audio + transcript pairs
- Training signal: voice note audio ↔ HITL-corrected transcripts

### Response Generation
- Goal: generate responses that match merchant's tone, language, and relationship style
- Current baseline: GPT-4o with system prompt + few-shot examples
- Target: merchant-personalised fine-tune (per-merchant LoRA adapters)
- Training signal: merchant corrections (original AI response vs merchant's preferred response)

---

## The RLHF Pipeline (Reinforcement Learning from Human Feedback)

Merchant corrections are the highest-quality signal ACE generates. They are **naturally occurring preference pairs** — exactly what RLHF requires.

```
Interaction:
  AI output:         "Please transfer ₦15,000 to account 9876543210"
  Merchant edits to: "Sharp sharp o! ₦15K to 9876543210. Don't forget to snap the receipt!"

This is a preference pair:
  rejected:  AI's formal, generic response
  chosen:    Merchant's culturally-nuanced, relationship-appropriate response

→ These pairs are collected in: training.interactions.corrections (Kafka)
→ Formatted as RLHF preference pairs
→ Used to train a reward model → fine-tune policy model
```

**Why this is valuable beyond ACE's internal use:**
- These pairs are also the exact format OpenAI/Anthropic need for RLHF training on African commerce language
- They are sold (anonymised) to AI labs as part of the AI Training Data Marketplace

---

## Model Registry & Versioning

All models used by ACE are versioned and tracked:

```
model_registry/
├── intent-classifier/
│   ├── v1.0.0  (gpt-4o, zero-shot, baseline)
│   ├── v1.1.0  (gpt-4o, fine-tuned, 50K interactions)
│   └── v2.0.0  (ace-native, 500K interactions)
│
├── asr-whisper/
│   ├── v1.0.0  (whisper-base, unmodified)
│   └── v1.1.0  (whisper-base, fine-tuned on 10K Nigerian audio pairs)
│
└── dialect-normaliser/
    ├── v1.0.0  (regional BERT)
    └── v1.1.0  (fine-tuned on ACE transcripts)
```

**Shadow deployment protocol:**
- New model version gets 5% of live traffic for 72 hours
- Automated rollback if merchant correction rate increases by > 1%
- Full deployment only after passing evaluation thresholds

---

## External Model Partnerships (Phase 3)

When ACE has sufficient data and infrastructure:

| Partner | What We Provide | What We Get |
|---------|----------------|-------------|
| OpenAI | RLHF preference pairs + fine-tuning compute access | Co-developed model weights + revenue share |
| Anthropic | Conversational commerce evaluation sets | Early API access + joint research |
| Google DeepMind | Anonymised dataset access (federated) | Compute credits + research collaboration |
| African AI labs | Full dataset licensing | Cash revenue + regional credibility |

---

## The ASR Product Roadmap (Year 3)

Once ACE has fine-tuned Whisper to outperform commercial ASR on Nigerian speech:

1. **Internal**: ACE's own voice note transcription (cost drops from $0.006/min to $0.001/min)
2. **External API**: sell transcription API to:
   - Nigerian fintechs (voice banking, customer support)
   - Delivery apps (voice order confirmation)
   - Telecos (voice-to-text services)
   - Government (public service voice interfaces)
3. **Revenue model**: $0.004/audio-minute via API (60% margin vs cost of $0.001/min)

**Projected Year 3 ASR API revenue**: $1.8M ARR (based on 75M minutes/month across customers)

---

## Compute Strategy

| Phase | Training Compute | Inference Compute |
|-------|-----------------|------------------|
| Phase 1 | OpenAI fine-tuning API (no owned GPU) | OpenAI API + local Whisper |
| Phase 2 | Rented GPU cluster (Lambda Labs / RunPod) | Hybrid: owned model + OpenAI fallback |
| Phase 3 | Owned GPU infrastructure (A100s) | Primarily self-hosted; OpenAI fallback for edge cases |

**Phase 3 GPU infrastructure** also serves as the **federated learning compute** rented to AI labs — the CapEx pays for itself via enterprise revenue.
