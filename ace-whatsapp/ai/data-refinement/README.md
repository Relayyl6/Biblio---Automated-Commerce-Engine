# Data Refinement Pipeline

> **ACE WhatsApp — AI Microservice #10**  
> Stack: **Python + Apache Airflow**  
> Role: Transforms raw transactional data into the enterprise intelligence product

## Responsibility

The bridge between ACE's primary product (merchant automation) and the secondary business (enterprise data sales). Cleans, anonymises, verifies, and packages conversational commerce data into structured assets for AI labs, FMCGs, and banks.

## The Pipeline

```
[Raw conversational data]
          │
          ▼
┌─────────────────────────────────┐
│  Stage 1: PII Scrubber          │
│  NER model for redaction:       │
│  - Phone numbers → [PHONE]      │
│  - Names → [NAME]               │
│  - Addresses → [ADDRESS]        │
│  - Bank details → [BANK_REF]    │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│  Stage 2: Initial Transcription │
│  Whisper transcription          │
│  Dialect tag assignment         │
│  Intent tag from parser         │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│  Stage 3: HITL Verification     │
│  Human reviewer queue           │
│  (university students /         │
│   remote micro-taskers)         │
│  Corrects transcription errors  │
│  Validates dialect tags         │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│  Stage 4: Enterprise Packaging  │
│  - Dataset compilation          │
│  - Quality scoring              │
│  - Synthetic data generation    │
│  - Federated learning prep      │
└────────────────┬────────────────┘
                 │
                 ▼
[Enterprise Data Assets]
  ├── AI Lab datasets (transcripts + audio + metadata)
  ├── FMCG demand signal feeds
  └── Credit scoring behavioral signals
```

## Enterprise Data Products Generated

| Output | Buyer | Format |
|--------|-------|--------|
| Dialect-rich conversational transcripts | AI labs | Annotated JSON + audio pairs |
| RLHF evaluation sets | AI labs | Preference pairs, golden datasets |
| Demand velocity signals | FMCGs | Aggregated, real-time API feed |
| Credit behavioral signals | Banks/fintechs | Score-ready behavioral features |

## Federated Learning Coordination
- AI labs don't receive raw data — they rent compute on ACE infrastructure
- Their models are sent to ACE servers, trained locally on ring-fenced data
- Only model weights are extracted and returned
- Full data sovereignty maintained; NDPR-compliant

## Quality Standards
- Transcript confidence ≥ 0.92 before entering enterprise pipeline
- HITL verification required for all voice note transcriptions
- PII scrub audit log retained (compliance)
- Synthetic data generation to augment sparse categories

## Status

`[ ] Not started — placeholder`
