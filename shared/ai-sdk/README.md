# Vercel AI SDK — Shared Configuration

> Shared Vercel AI SDK configuration, tool definitions, model registry, and middleware  
> Used by: `ace-whatsapp/ai/intent-parser/` and `ace-platform/ai/`

---

## What Lives Here

```
shared/ai-sdk/
├── tools/                  # Shared tool definitions (called by AI agent)
│   ├── commerce.tools.ts   # Inventory, pricing, order tools
│   ├── identity.tools.ts   # Customer profile, Global Buyer ID tools
│   ├── logistics.tools.ts  # Dispatch, tracking tools
│   └── training.tools.ts   # Internal data collection / logging tools
│
├── middleware/
│   ├── training.middleware.ts     # Captures every AI interaction for training pipeline
│   ├── cost-monitor.middleware.ts # Tracks token usage and Meta API message costs
│   └── injection-guard.middleware.ts # Prompt injection detection
│
├── models/
│   ├── registry.ts         # Model version registry (maps phase → model)
│   └── prompts/            # System prompt builders per merchant context
│
├── schemas/
│   ├── intent.schema.ts    # Zod schema for generateObject intent extraction
│   ├── order.schema.ts     # Zod schema for order proposals
│   └── correction.schema.ts # Zod schema for merchant correction logging
│
└── config/
    └── providers.ts        # Provider configuration (OpenAI, Anthropic, fallbacks)
```

---

## Provider Configuration

```typescript
// shared/ai-sdk/config/providers.ts
import { openai } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'

export const MODEL_REGISTRY = {
  // Phase 1: hosted models
  intentExtraction: openai('gpt-4o'),
  intentExtractionFast: openai('gpt-4o-mini'),  // for low-stakes interactions
  responseGeneration: openai('gpt-4o'),
  fallback: anthropic('claude-sonnet-4-5'),

  // Phase 2+: ACE fine-tuned models (swap here, nothing else changes)
  // intentExtraction: openai('ft:gpt-4o:ace-technologies:intent-v2:xxxxx'),
  // responseGeneration: openai('ft:gpt-4o:ace-technologies:response-v1:xxxxx'),
}

// Cost-tier routing: use cheaper model for high-volume, low-stakes tasks
export function selectModel(orderValue: number, interactionType: string) {
  if (interactionType === 'cart_reminder' || orderValue < 5000) {
    return MODEL_REGISTRY.intentExtractionFast
  }
  return MODEL_REGISTRY.intentExtraction
}
```

---

## Training Middleware

The central mechanism for capturing every AI interaction into the training pipeline.

```typescript
// shared/ai-sdk/middleware/training.middleware.ts
import { wrapLanguageModel } from 'ai'

export function createTrainingMiddleware(kafkaProducer: KafkaProducer) {
  return wrapLanguageModel({
    model: /* passed in */,
    middleware: {
      wrapGenerate: async ({ doGenerate, params }) => {
        const start = Date.now()
        const result = await doGenerate()

        // Fire-and-forget to Kafka (non-blocking)
        kafkaProducer.send({
          topic: 'training.interactions.raw',
          messages: [{
            key: params.conversationId,
            value: JSON.stringify({
              ...params,
              ...result,
              latencyMs: Date.now() - start,
              capturedAt: new Date().toISOString(),
            })
          }]
        }).catch(console.error)  // never block the response for logging

        return result
      }
    }
  })
}
```

---

## Intent Schema (Zod)

The single source of truth for the structured intent object that `generateObject` returns.

```typescript
// shared/ai-sdk/schemas/intent.schema.ts
import { z } from 'zod'

export const IntentSchema = z.object({
  intent: z.enum([
    'purchase', 'payment_proof', 'delivery_enquiry',
    'stock_enquiry', 'complaint', 'negotiation',
    'reorder', 'greeting', 'unknown'
  ]),
  entities: z.object({
    productReference: z.string().optional(),
    productReferenceType: z.enum(['explicit', 'social_media_post', 'deictic']).optional(),
    quantity: z.number().int().positive().optional(),
    requestedPrice: z.number().positive().optional(),
    deliveryAddress: z.string().optional(),
  }),
  dialect: z.enum(['english', 'pidgin', 'yoruba', 'hausa', 'igbo', 'code_switch']),
  sentiment: z.enum(['positive', 'neutral', 'negative']),
  confidence: z.number().min(0).max(1),
  requiresVisualResolution: z.boolean(),
  escalateToMerchant: z.boolean(),
  injectionAttemptDetected: z.boolean().default(false),
})

export type Intent = z.infer<typeof IntentSchema>
```

---

## Tool Definitions (Commerce)

```typescript
// shared/ai-sdk/tools/commerce.tools.ts
import { tool } from 'ai'
import { z } from 'zod'

export const commerceTools = {
  checkInventory: tool({
    description: 'Check current stock level and price for a product SKU',
    parameters: z.object({
      sku: z.string(),
      merchantId: z.string(),
    }),
    execute: async ({ sku, merchantId }) =>
      inventoryClient.getStock({ sku, merchantId }),
  }),

  getAuthorizedPriceRange: tool({
    description: 'Get merchant-configured price floor and ceiling for negotiation. The AI must stay within these bounds.',
    parameters: z.object({
      sku: z.string(),
      customerTier: z.enum(['new', 'returning', 'vip']),
      merchantId: z.string(),
    }),
    execute: async (params) =>
      pricingClient.getAuthorizedRange(params),
    // Note: this calls the Rust PricingService — merchant sets the bounds, not the AI
  }),

  proposeOrderToStateMachine: tool({
    description: 'Submit a proposed order to the state machine for validation. The state machine may reject it.',
    parameters: z.object({
      customerId: z.string(),
      merchantId: z.string(),
      items: z.array(z.object({ sku: z.string(), quantity: z.number(), agreedPrice: z.number() })),
    }),
    execute: async (order) =>
      stateMachineClient.proposeOrder(order),
  }),
}
```

---

## Status

`[ ] Not started — placeholder`
