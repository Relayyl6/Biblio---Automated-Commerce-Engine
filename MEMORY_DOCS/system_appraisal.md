# System Appraisal: ACE (Autonomous Commerce Engine)

## 1. High-Level Concept
ACE (Autonomous Commerce Engine) is designed as an "invisible operating system" for informal commerce in emerging markets, starting with WhatsApp in Nigeria. Instead of providing a unified inbox for merchants to reply manually, ACE uses AI to autonomously execute business logic (negotiation, inventory, payments, logistics, restocking) in the background. The merchant only intervenes for exceptions. 

## 2. The Three-Layer Architecture
*   **Layer 1: Interface**
    *   **Customer:** WhatsApp chats, transitioning to a Progressive Web App (PWA) "Trojan Horse" embedded in the WhatsApp browser, culminating in a Global Buyer ID network (1-tap cross-merchant checkout).
    *   **Merchant:** A React Native (Expo) mobile app acting as an "Exception Dashboard."
    *   **Vendor CommuniquÃ©:** A robust SMS reply-code system (and WhatsApp/Voice fallbacks) allowing merchants to approve escalations (e.g., price below floor) without opening an app.
*   **Layer 2: Autonomous State Engine (The Core)**
    *   **Agent Layer (TypeScript + Vercel AI SDK):** Parses intents and handles the multi-turn conversational AI Negotiator. It proposes actions using structured outputs (`generateObject`) and tool calls.
    *   **Rules Engine (Rust):** The deterministic heart of ACE. Microservices (State Machine, Payment Verification, Logistics, etc.) validate all AI proposals. The AI *never* writes directly to the database.
    *   **Inference Layer (Python):** Handles dialect-aware voice transcription (Whisper), slang normalization (BERT), and visual embeddings (CLIP).
*   **Layer 3: Enterprise Data Intelligence (Secondary Business)**
    *   ACE captures unstructured informal commerce data and refines it into structured enterprise products:
        *   **AI Labs:** Dialect-rich conversational datasets and RLHF pairs.
        *   **FMCG Brands:** Real-time, street-level demand and price elasticity signals.
        *   **Banks/Fintechs:** TrustScore API for alternative credit scoring of unbanked merchants.

## 3. Infrastructure & Persistence
*   **PostgreSQL:** ACID-compliant primary ledger, multi-tenant isolated via Row-Level Security (RLS) and partitioned by merchant.
*   **Qdrant (Vector DB):** Two collections: `conversations` (long-term memory) and `visual_products` (resolving social media image queries to SKUs).
*   **Redis:** Hot state cache for active conversations, 24-hour service windows, message batching, and distributed locks.
*   **Apache Kafka:** The central event bus. All microservices are decoupled and communicate exclusively through immutable domain events (e.g., `PaymentVerified`, `IntentClassified`).
*   **ClickHouse:** Data warehouse for sub-second aggregations, powering FMCG dashboards and merchant analytics.

## 4. Current Codebase Status
*   **Phase 1 (`ace-whatsapp`):** In active development. The core Rust loop works end-to-end. React Native Merchant App and Vite Admin Portal have foundational scaffolding. Immediate focus is hardening (e.g., wiring the `escalate_to_merchant` tool).
*   **Phase 2 (`ace-platform`):** Placeholder/Design Phase. Will introduce a multi-channel CRM, web widget, supplier portal, and a full web dashboard.
*   **Data Intelligence (`data-intelligence`):** Placeholder/Design Phase. Outlines the Scale-AI-like pivot into data monetization.
*   **Shared (`shared`):** Contains AI SDK middleware (for training data capture), schemas (Kafka/Zod), and proto files.

## 5. Key Defensive Mechanisms & Moats
*   **Prompt Injection / Haggling Defense:** The AI Negotiator is physically prevented from closing below merchant floors by the Rust State Machine. Escalate-to-merchant circuit breakers trigger on rule violations.
*   **Unit Economics:** "Message Consolidation Engine" bundles AI intents into fewer outbound WhatsApp API messages (target <2.3 msgs/order) to maintain profitability.
*   **Lock-in Moats:** Aggregate logistics pricing, supplier volume discounts, and escrow trust mechanisms make the cost of leaving ACE far higher than the subscription cost.
*   **Continuous Learning:** SDK middleware streams every interaction to Kafka. A data refinement pipeline (with PII scrubbing and HITL verification) generates fine-tuning data, constantly improving dialect recognition and negotiation tactics.
