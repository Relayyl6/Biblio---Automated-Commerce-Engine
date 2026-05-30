# AI Training Data Marketplace

> **ACE Enterprise Product 1**  
> Target: OpenAI · Anthropic · Google DeepMind · Meta AI · Cohere · Mistral  
> Year 2 ARR Projection: **$7.2M** (8 customers @ avg $75K/month)

---

## The Problem AI Labs Have

Global AI labs are desperately trying to make models work in non-Western markets. Their training data is:
- **78% English**, 15% European languages, 7% everything else
- Virtually **zero** Nigerian Pidgin, Yoruba-English code-switching, or Swahili slang
- No real-world transaction context (most training data is scraped text, not goal-oriented conversations)

ACE's platform generates this data as a natural by-product of operating at scale. It's the only source that exists.

---

## Product Offerings

### 1. Dialect-Rich Conversational Datasets
- Anonymised, structured conversation transcripts from real informal commerce
- Metadata tags: intent, sentiment, regional dialect, code-switching patterns
- Voice note transcriptions paired with original audio (consent-gated)

### 2. RLHF-Ready Evaluation Sets
- "Golden datasets" for testing model performance on informal commerce tasks
- Human-verified preference pairs for reinforcement learning from human feedback
- Vertical-specific benchmarks (fashion, food distribution, personal care)

### 3. Federated Learning Compute Rental
- AI labs don't receive raw data — they send models to ACE infrastructure
- Models train locally on ring-fenced data; only weight updates extracted
- Full data sovereignty maintained; NDPR-compliant

### 4. Proprietary ASR API (Year 3+)
- Fine-tuned Whisper on ACE's verified dialect data
- Exposed via developer API
- Only voice engine that actually understands Nigerian Pidgin, Yoruba, Hausa, Igbo in commerce context

---

## Pricing Model

| Product | Price |
|---------|-------|
| Base access | $50K/month minimum commitment |
| Conversation transcripts | $0.08 per conversation (cleaned, anonymised) |
| Federated learning compute | $2,500 per GPU-hour on ACE infrastructure |
| Custom evaluation sets | $120K per vertical-specific benchmark |
| ASR API (Year 3+) | $0.004 per audio minute |

---

## Proprietary ASR API Pipeline (Year 3 Preview)

```
[Merchant's WhatsApp voice note]
    → "Abeg I go pay you 2moro"
    → PII Scrubber → [REDACTED_COMMITMENT]
    → Initial Whisper → "I will pay you tomorrow" (WRONG dialect)
    → HITL Human Reviewer corrects:
    → "Please, I will pay you tomorrow" [dialect=pidgin, intent=payment_commitment]
    → Training asset created
    → Fine-tunes ACE ASR model
    → ACE ASR outperforms generic Whisper on Nigerian speech
    → Sold as API to every fintech/delivery app in Nigeria
```

**Moat**: Only voice engine that actually understands local dialects in commerce context.

## Status

`[ ] Not started — placeholder`
