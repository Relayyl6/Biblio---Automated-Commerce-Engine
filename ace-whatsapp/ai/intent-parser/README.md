# Intent Parser Service

> **ACE WhatsApp — AI Microservice #3**  
> Stack: **TypeScript + Vercel AI SDK + FastAPI (Python) for heavy models**  
> Role: Multi-model NLP pipeline — the agent layer of ACE

---

## Architecture Overview

The intent parser is split into two layers:

```
┌─────────────────────────────────────────────────────────────────┐
│  AGENT LAYER — TypeScript + Vercel AI SDK                       │
│                                                                 │
│  - Orchestrates the full conversation flow                      │
│  - Tool calling → Rust backend services (via gRPC/REST)         │
│  - Structured output (generateObject) for typed intent          │
│  - Streaming responses to WhatsApp Gateway                      │
│  - Interaction logging middleware → training pipeline           │
└────────────────────────────┬────────────────────────────────────┘
                             │ (delegates to for heavy inference)
┌────────────────────────────▼────────────────────────────────────┐
│  INFERENCE LAYER — Python FastAPI                               │
│                                                                 │
│  - Local Whisper (voice → text, dialect-aware)                  │
│  - Regional dialect BERT (slang normalisation)                  │
│  - Custom fine-tuned models (trained on ACE data)               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Vercel AI SDK Integration

### Why Vercel AI SDK

- **Provider-agnostic**: swap between OpenAI, Anthropic, Google, Mistral without rewriting agent logic
- **`generateObject`**: returns *typed, validated* structured output — critical for reliable intent extraction
- **Tool calling / multi-step**: the agent can call Rust backend services as tools within a single reasoning step
- **Streaming**: real-time response streaming back to WhatsApp Gateway
- **Middleware hooks**: every interaction is interceptable for training data collection
- **Edge-compatible**: can run on Vercel Edge or standard Node.js

---

## The Agent's Tool Set

The AI agent **never writes directly to any database**. It calls Rust services as tools. The Rust State Machine validates before any state change occurs.

```typescript
// Tool definitions — what the AI can "do"
const aceTools = {

  checkInventory: tool({
    description: 'Check current stock for a product SKU',
    parameters: z.object({ sku: z.string(), merchantId: z.string() }),
    execute: async ({ sku, merchantId }) => {
      // → calls Rust inventory service via REST/gRPC
    }
  }),

  getCustomerProfile: tool({
    description: 'Get customer history, LTV, and tier for personalisation',
    parameters: z.object({ globalBuyerId: z.string() }),
    execute: async ({ globalBuyerId }) => {
      // → calls Identity Resolution service
    }
  }),

  getAuthorizedPriceRange: tool({
    description: 'Get the merchant-configured price floor and ceiling for a SKU and customer tier',
    parameters: z.object({ sku: z.string(), customerTier: z.enum(['new','returning','vip']), merchantId: z.string() }),
    execute: async (params) => {
      // → calls Rust Pricing service (hardened — floor/ceiling set by merchant, not AI)
    }
  }),

  proposeOrderToStateMachine: tool({
    description: 'Submit a proposed order for validation and execution',
    parameters: z.object({ /* order shape */ }),
    execute: async (order) => {
      // → calls Rust State Machine — it validates, AI cannot force execution
    }
  }),

  resolveVisualProductReference: tool({
    description: 'Resolve a social media product reference to a SKU',
    parameters: z.object({ reference: z.string(), merchantId: z.string() }),
    execute: async (params) => {
      // → calls Visual Context Resolution service
    }
  }),

  logInteractionForTraining: tool({
    description: 'Internal — logs this interaction to the training pipeline',
    parameters: z.object({ /* interaction schema */ }),
    execute: async (interaction) => {
      // → writes to Kafka training.interactions topic
    }
  }),
}
```

---

## Structured Intent Extraction

`generateObject` ensures the AI always returns a typed, validated intent — never freeform text that downstream Rust services have to parse.

```typescript
const { object: intent } = await generateObject({
  model: openai('gpt-4o'),
  schema: z.object({
    intent: z.enum([
      'purchase', 'payment_proof', 'delivery_enquiry',
      'stock_enquiry', 'complaint', 'negotiation', 'reorder', 'unknown'
    ]),
    entities: z.object({
      productReference: z.string().optional(),
      productReferenceType: z.enum(['explicit', 'social_media_post', 'deictic']).optional(),
      quantity: z.number().optional(),
      requestedPrice: z.number().optional(),
    }),
    dialect: z.enum(['english', 'pidgin', 'yoruba', 'hausa', 'igbo', 'code_switch']),
    sentiment: z.enum(['positive', 'neutral', 'negative']),
    confidence: z.number().min(0).max(1),
    requiresVisualResolution: z.boolean(),
    escalateToMerchant: z.boolean(),
  }),
  prompt: buildIntentPrompt(normalisedMessage, merchantContext, customerHistory),
})
```

---

## Conversation Flow (Multi-Step Tool Use)

```typescript
const result = await generateText({
  model: openai('gpt-4o'),
  tools: aceTools,
  maxSteps: 5,  // max tool calls before forcing a response
  system: buildMerchantSystemPrompt(merchant),
  messages: conversationHistory,
})
// Each step is logged via middleware → training pipeline
```

**Typical steps for a purchase flow:**
1. `getCustomerProfile(globalBuyerId)` — personalise response
2. `resolveVisualProductReference(ref)` — if deictic reference detected
3. `checkInventory(sku)` — confirm stock before committing
4. `getAuthorizedPriceRange(sku, tier)` — get negotiation bounds
5. `proposeOrderToStateMachine(order)` — submit for Rust validation

---

## Middleware: Training Data Collection

Every interaction is captured via SDK middleware before it reaches the agent and after it completes.

```typescript
import { wrapLanguageModel, extractReasoningMiddleware } from 'ai'

const trackedModel = wrapLanguageModel({
  model: openai('gpt-4o'),
  middleware: aceTrainingMiddleware,  // see /ai/training-pipeline/
})
```

See [training-pipeline/README.md](../training-pipeline/README.md) for the full data collection architecture.

---

## Model Provider Strategy

ACE uses the Vercel AI SDK's provider abstraction to stay flexible:

| Provider | Use Case | When |
|----------|---------|------|
| `openai('gpt-4o')` | Primary intent extraction and response generation | Phase 1 |
| `anthropic('claude-sonnet-*')` | Fallback / A/B testing | Phase 1 |
| `openai('gpt-4o-mini')` | Low-stakes, high-volume interactions (cart reminders) | Phase 1 (cost) |
| ACE fine-tuned model | Intent extraction on Nigerian dialects | Phase 2+ (post training) |
| Self-hosted (Ollama/vLLM) | Data-sovereign inference (training data never leaves ACE infra) | Phase 3 |

---

## Prompt Injection Hardening

- System prompt is built from **merchant-controlled structured config** — not user input
- Customer messages are injected as `user` role only — never `system` or `assistant`
- All tool executions pass through Rust validation — AI cannot override hard rules
- Injection attempt detection: patterns like "ignore all previous instructions" → intent classified as `unknown`, logged as `injection_attempt`, escalated

## Status

`[ ] Not started — placeholder`
