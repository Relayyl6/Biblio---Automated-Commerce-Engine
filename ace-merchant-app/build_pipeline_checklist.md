# BIBLIO Merchant App — Master Build Specification
## The Autonomous Commerce Operating System (Phase 1: Vendor Core)

---

### 0. FOUNDATIONAL ARCHITECTURE & DESIGN PHILOSOPHY

Before we dive into tabs, we must define the **OS Layer** that makes Biblio a *platform*, not just an app. This ensures that when you plug in Instagram, TikTok, or any future channel, the core doesn't break.

#### 0.1 The "Channel-Agnostic" Core (The Biblio Engine)
*   **Unified Identity Graph:** Every customer is a `Global_Buyer_ID`. Whether they message via WhatsApp, comment on TikTok, or DM on Instagram, Biblio merges them into one profile. This is the #1 moat.
*   **Event Bus Architecture:** The app doesn't care *where* a message comes from. It listens to a normalized `MessageReceived` event. A WhatsApp webhook, a TikTok comment scraper, and an Instagram DM all emit the same event shape. This is how you add new apps without rewriting the core.
*   **State Machine per Order:** Every order is a deterministic state machine (Inquiry → Cart → Awaiting Payment → Paid → Packed → Dispatched → Delivered → Settled). The UI simply visualizes this state. The AI only *proposes* state transitions; the Biblio Engine *validates* and *executes* them.
*   **The "Biblio Brain" (Config Layer):** All AI behavior is driven by a single, versioned configuration object per merchant. This config defines autonomy boundaries, tone, pricing rules, and escalation triggers. The Settings tab is simply a UI for this config.

#### 0.2 UI/UX North Star
*   **Zero-Latency Feel:** Every tap, swipe, or toggle must feel instant. Use Optimistic UI updates for everything. Network requests happen in the background with silent retries and rollbacks.
*   **Progressive Disclosure:** The app is simple enough for a vendor who has never used a CRM, but deep enough for a power user. Advanced features are hidden behind "Pro" toggles or contextual menus.
*   **Context is King:** Never show a number without its story. "Revenue: ₦50k" is useless. "Revenue: ₦50k (↑ 12% vs. last Tuesday, driven by 3 repeat VIPs)" is actionable.
*   **Nigerian Market First:** Designed for 3G networks, low-end Android devices, and intermittent power. Heavy use of local caching, offline-first data, and SMS/USSD fallbacks for critical flows.

---

### 1. TAB 1: ANALYTICS (PULSE) — "The Proof of Autonomy"

**Goal:** To be the single source of truth for the merchant's business health. It must answer: *Is Biblio making me money? Where am I losing money? What should I do next?*

#### 1.1 The Hero Section: The "Vital Signs" Bar
*   **Live Revenue Ticker:** A large, animated number showing *Today's Revenue*.
    *   **Comparison Logic:** Shows a percentage delta vs. the same day last week (not just yesterday). E.g., "₦142,500 ↑ 18% vs. last Tuesday".
    *   **Micro-Interaction:** Tapping the ticker expands a mini-breakdown: Revenue from AI-handled orders vs. Human-handled orders.
*   **Autonomous Order Completion Rate (AOCR) Gauge:** A circular gauge showing the % of orders completed with *zero* human intervention.
    *   **Drill-Down:** Tapping the gauge shows a list of orders that required intervention. Each entry has a "Why?" tag (e.g., "Price override requested", "AI confidence < 70%", "Customer requested human").
    *   **Target Setting:** Merchant can set a goal AOCR (e.g., 80%) and the app will suggest specific autonomy settings to reach it.
*   **Cash Flow River:** A live, horizontal scrolling chart showing money *in* (payments received) vs. money *out* (supplier payments, logistics fees) in real-time. This is critical for vendors who struggle with cash flow visibility.
*   **Active System Ticker:** A live counter of:
    *   Active AI Conversations (chats currently being handled by the bot).
    *   Pending Human Actions (items in the Exception Queue).
    *   Orders in Transit (with a live map view of riders).

#### 1.2 The "Money Map" (Interactive Pipeline Chart)
*   **Visualization:** A stacked bar chart showing order volume over time (Day/Week/Month toggles).
*   **Segmentation:** Each bar is segmented by order status (Inquiry, Paid, Dispatched, Delivered) and by channel (WhatsApp, Instagram, etc.).
*   **Interactive Filtering:** Tap a segment to filter the entire dashboard. E.g., tap "Instagram" to see only revenue and AOCR for Instagram orders.
*   **Predictive Overlay:** A dashed line projecting the next 7 days of revenue based on historical velocity and current pipeline. This is powered by a simple time-series forecast.

#### 1.3 The "Oracle" Widget (Predictive AI Insights)
*   **Goal:** Move from *reporting* to *prescribing*. This widget is a rotating carousel of action-oriented cards.
*   **Card Types:**
    *   **VIP Win-Back:** "3 VIPs (LTV > ₦100k) haven't ordered in 14 days. Biblio has drafted personalized win-back messages with a 10% loyalty discount. [Review Drafts]"
    *   **Inventory Alert:** "Blue Ankara (SKU: BLK-001) will run out in 36 hours based on current sales velocity. Biblio has pre-negotiated a restock with Alhaji Ibrahim for ₦800/yard. [Approve Restock]"
    *   **Pricing Opportunity:** "Demand for 'Gold Embroidered Lace' is up 40% this week. Competitors are selling at ₦18,500. Your current price is ₦16,000. Biblio recommends a 10% price increase. [Apply Flash Sale]"
    *   **Logistics Optimization:** "You have 5 orders in Surulere waiting for dispatch. Biblio can consolidate them into a single rider trip to save ₦1,200. [Consolidate & Dispatch]"
    *   **Fraud Alert:** "Unusual payment pattern detected for a new customer. Order value is ₦150k. Biblio recommends manual verification. [Review Order]"
*   **Interaction:** Each card has a primary action button (e.g., "Approve", "Review") and a secondary "Snooze" or "Dismiss" option.

#### 1.4 Deep-Dive Analytics Modules (Accessible via "View More")
*   **Product Performance Matrix:** A sortable table showing every SKU with: Revenue, Margin, Sales Velocity, Return Rate, and AOCR for that product. This tells the merchant exactly what to stock more of and what to drop.
*   **Customer Cohort Analysis:** A heatmap showing retention rates over time. E.g., "Of customers who bought in January, 40% bought again in February, 25% in March." This helps identify if the AI's retention campaigns are working.
*   **Conversation Analytics:** Metrics on the AI's performance: Average response time, Intent recognition accuracy, Escalation rate, and Top 5 reasons for escalation.
*   **Logistics Scorecard:** A breakdown of delivery performance by rider/partner: Average delivery time, Cost per delivery, Rejection rate, and Customer rating. This helps the merchant choose the best logistics partner.

---

### 2. TAB 2: ACTION INBOX (THE EXCEPTION QUEUE) — "The Merchant's Tinder"

**Goal:** To be the *only* place a merchant needs to go to run their business. It's a prioritized, actionable feed of everything that needs human judgment.

#### 2.1 The Intelligent Triage Engine
*   **Prioritization Algorithm:** Cards are sorted by a "Urgency Score" calculated from: Order Value, Customer LTV, Time Sensitivity, and AI Confidence.
*   **Categorization Tags:** Each card is auto-tagged with a category: `Restock`, `Win-back`, `Price Override`, `VIP Handling`, `Payment Verification`, `Logistics Issue`, `Dispute`.
*   **Filtering:** A segmented control at the top allows filtering by category or by "All", "High Priority", "Snoozed".

#### 2.2 The Swipe-to-Execute Architecture
*   **Card Design:** A card is a self-contained unit of work. It must contain:
    *   **Header:** Customer name, LTV, and a one-line AI summary of the situation.
    *   **Context Body:** The *why*. E.g., "Blessing's LTV is ₦150k. She usually orders every 14 days. It's been 21 days. Biblio drafted a win-back with a 10% discount."
    *   **The Draft:** A preview of the AI-generated message, order, or action.
    *   **Action Buttons:** Large, thumb-friendly buttons for primary actions (e.g., "Approve & Send", "Approve & Dispatch").
*   **Gestures:**
    *   **Swipe Right:** Approve. The card flies off-screen with a satisfying animation. The action is executed (Optimistic UI).
    *   **Swipe Left:** Reject. The card flies off. The AI is notified to not repeat this suggestion for this customer for X days.
    *   **Long Press:** Opens a detailed view of the card, allowing the merchant to edit the draft, view the full chat history, or change the action.
*   **Optimistic Mutation & Offline Queue:** When a merchant swipes, the UI updates instantly. The action is added to a persistent offline queue (React Query Persist). When the network is available, the queue is processed. If a request fails, the card is restored with an error toast.

#### 2.3 The "Queue Zero" State
*   **The Reward:** When the inbox is empty, the app shows a full-screen animation: a calming, premium visual (e.g., a sunset over Lagos) with the text: "You're all caught up. Biblio is handling the rest. Go live your life."
*   **The Nudge:** A button: "Want to see what Biblio is doing right now?" which takes them to the Live Chats tab.

#### 2.4 Advanced Inbox Features
*   **Bulk Actions:** A "Select" mode allows the merchant to select multiple cards (e.g., all "Restock" cards) and approve/reject them in one tap.
*   **Snooze:** Each card can be snoozed for 1 hour, 4 hours, or until tomorrow.
*   **Custom Actions:** For power users, the AI can be trained to suggest custom actions. E.g., "Send a thank-you note with a 5% off coupon for next purchase." The merchant can define these templates in Settings.

---

### 3. TAB 3: LIVE CHATS (UNIFIED AI INBOX) — "Radical Transparency"

**Goal:** To give the merchant total visibility and control over every conversation, without forcing them to read every message. It's a "glass box" into the AI's brain.

#### 3.1 The Unified Inbox
*   **Channel Agnostic:** All conversations from WhatsApp, Instagram, TikTok, etc., appear in one list. Each chat is tagged with the channel icon.
*   **Smart Sorting:** Chats are sorted by "Last Activity" by default, but can be sorted by "AI Confidence" (lowest first) or "Customer LTV" (highest first).
*   **Filter Chips:** A segmented control to filter by: `Active AI`, `Needs Attention` (AI confidence < 70%), `Human Takeover`, `Unread`.

#### 3.2 The Chat View
*   **Header:** Customer name, LTV, sentiment indicator (😊 😐 😠), and AI confidence score (e.g., "AI: 92%").
*   **Message Bubbles:** Standard chat bubbles, but with a twist:
    *   **AI Messages:** Have a subtle "Biblio" watermark. If the AI confidence is low, the bubble has an amber border.
    *   **Human Messages:** Standard bubbles.
    *   **System Messages:** Grey, italicized messages for state changes (e.g., "Order #2847 marked as Paid", "Rider dispatched").
*   **The "Why?" Button:** Next to every AI message, a small "i" icon. Tapping it shows the AI's reasoning: "I recommended the Blue Satin Dress because the customer said 'the blue one from your last post' and the CLIP model matched it to this SKU with 94% confidence."
*   **Smart Summarization:** At the top of the chat, a 1-sentence summary: "Blessing is asking about the blue dress from yesterday's Instagram reel. She's a repeat customer, LTV ₦87k. AI has offered a 5% loyalty discount."
*   **One-Tap Human Takeover:** A prominent "Pause AI" button in the header. When tapped, the AI stops responding. The merchant can now type manually. A "Resume AI" button appears to hand control back.
*   **Quick Replies:** A row of AI-suggested quick replies above the keyboard (e.g., "Yes, it's available", "I'll check and get back to you", "Here's the payment link").

#### 3.3 Sentiment & Emotion Analysis
*   **Visual Cues:** Each chat in the list has a colored dot indicating sentiment: Green (Positive), Grey (Neutral), Red (Negative/Frustrated).
*   **Trend View:** Tapping the sentiment indicator shows a mini-graph of the customer's sentiment over the last 5 interactions. This helps the merchant see if a customer is becoming increasingly frustrated.
*   **Alerting:** If sentiment drops below a threshold (e.g., very negative), the chat is automatically escalated to the "Needs Attention" filter and the AI suggests a human takeover.

#### 3.4 Advanced Chat Features
*   **Search:** Full-text search across all messages, with filters for date, customer, and channel.
*   **Media Gallery:** A tab within the chat view showing all images, videos, and voice notes shared in that conversation.
*   **Order Timeline:** A vertical timeline showing the history of orders with this customer. Tapping an order opens its details.
*   **Internal Notes:** The merchant can add private notes to a customer profile (e.g., "Prefers Saturday deliveries"). These notes are visible to the AI and used to personalize responses.

---

### 4. TAB 4: CRM & CATALOG (INVENTORY & IDENTITY) — "The Source of Truth"

**Goal:** To be the single, authoritative database of everything the merchant sells and everyone they sell to. It must be effortless to update and incredibly powerful to query.

#### 4.1 Product Catalog (The Inventory Oracle)
*   **List View:** A searchable, filterable list of all SKUs.
    *   **Status Pills:** Each item has a status pill: `In Stock` (Green), `Low Stock` (Amber), `Out of Stock` (Red).
    *   **Key Metrics:** Each row shows: Price, Stock Level, Sales Velocity (units/week), and Margin %.
*   **Voice-to-CRM Dictation:** A floating mic button. Tap it and say: "Add 50 yards of red ankara for 12k". The AI parses this and creates a new product with the name "Red Ankara", stock "50 yards", and price "₦12,000". It then asks for confirmation.
*   **Auto-Depletion Alerts:** Products with stock below a dynamic threshold (based on sales velocity) are highlighted in red. A "Restock" button appears next to them.
*   **One-Click Restock Pipeline:** Tapping "Restock" on a low-stock item opens a pre-filled WhatsApp message to the supplier (e.g., "Hello Alhaji, Biblio here for [Merchant Name]. Need to restock Red Ankara. Do you still have 50 yards at ₦800/yard available?"). The merchant just hits send.
*   **Smart Pricing Overrides:** A "Flash Sale" toggle. The merchant can set a temporary price (e.g., 10% off) for a specific SKU or category. The AI will automatically honor this price in negotiations. A countdown timer shows when the sale ends.
*   **Bulk Import:** A CSV upload feature to bulk-add products. The AI can also scrape a merchant's Instagram feed to auto-populate the catalog.

#### 4.2 Customer CRM (Identity & Relationships)
*   **List View:** A list of all customers, sorted by LTV (highest first) by default.
    *   **Key Metrics:** Each row shows: Name, LTV, Last Order Date, Total Orders, and AOCR for that customer.
*   **Customer Profile:** Tapping a customer opens a detailed profile:
    *   **Header:** Name, phone number, Global Buyer ID, and a sentiment trend graph.
    *   **Stats:** LTV, Average Order Value, Order Frequency, Return Rate, and Payment Reliability Score.
    *   **Purchase History:** A timeline of all orders.
    *   **Conversation History:** A link to the full chat history.
    *   **AI-Generated Insights:** "Blessing prefers Ankara fabrics. She is price-sensitive and responds well to bundle offers. Her preferred payment method is bank transfer."
    *   **Manual Tags:** The merchant can add custom tags (e.g., "VIP", "Wholesale", "Difficult").
*   **Segmentation:** The merchant can create custom segments (e.g., "VIPs who haven't ordered in 30 days") and trigger bulk actions (e.g., "Send win-back campaign").
*   **LTV Ranking & Leaderboard:** A gamified view showing the top 10 customers by LTV. This encourages the merchant to focus on retention.

#### 4.3 Advanced CRM & Catalog Features
*   **Supplier Management:** A separate tab for suppliers. Each supplier has a profile with contact info, product categories, and payment terms. The AI can auto-generate purchase orders.
*   **Inventory Forecasting:** A chart showing predicted stock levels for the next 30 days based on historical sales velocity and seasonality. This is the "Oracle" for restocking.
*   **Barcode Scanning:** Use the phone's camera to scan barcodes and instantly pull up or create a product.
*   **Multi-Location Support:** For merchants with multiple stalls, inventory can be tracked per location.

---

### 5. TAB 5: SETTINGS (BRAIN CONFIG) — "The Control Room"

**Goal:** To give the merchant deep, granular control over the AI's autonomy, financial boundaries, and communication style. It's the "constitution" for the Biblio Brain.

#### 5.1 Autonomy Boundaries (The "Guardrails")
*   **Max Discount Slider:** A hard limit on how much the AI can negotiate down (e.g., 0% to 30%). This is the single most important setting for protecting margins.
*   **Auto-Dispatch Toggle:** Allow the AI to autonomously ping logistics riders (Kwik/Gokada) the moment payment is verified.
*   **Auto-Restock Toggle:** Allow the AI to autonomously generate and send purchase orders to suppliers when stock is low.
*   **Auto-Payment Verification Toggle:** Allow the AI to automatically verify payments via bank webhooks without human review.
*   **Order Value Ceiling:** A maximum order value (e.g., ₦50,000) above which the AI must escalate to the merchant for approval, regardless of other settings.
*   **New Customer Cooling Period:** For first-time customers, a mandatory 24-hour verification window before the order is processed. This prevents fraud.

#### 5.2 Communication Style (The "Personality")
*   **Dialect / Tone Selector:** A dropdown to choose the AI's tone: `Formal English`, `Nigerian Pidgin`, `Friendly & Casual`, `Professional`.
*   **Emoji Usage:** A slider from "None" to "Frequent".
*   **Response Length:** A slider from "Concise" to "Detailed".
*   **Custom Greetings:** The merchant can define a custom greeting and sign-off for the AI to use.
*   **Language Support:** A multi-select for languages the AI should support (English, Pidgin, Yoruba, Igbo, Hausa).

#### 5.3 Financial & Payment Settings
*   **Bank Account Connection:** A secure flow to connect the merchant's bank account for payment verification via APIs (e.g., Providus, Wema).
*   **Virtual Account Settings:** Configure the prefix for virtual accounts (e.g., "ACE-MERCHANTNAME").
*   **Payment Methods:** Toggle which payment methods are accepted: Bank Transfer, Card (Paystack/Flutterwave), Pay-on-Delivery.
*   **Escrow Settings:** Configure the escrow period (e.g., 24 hours post-delivery) before funds are released to the merchant.

#### 5.4 Logistics & Supplier Settings
*   **Preferred Logistics Partners:** A ranked list of logistics partners (Kwik, Gokada, MAX). The AI will try the first one, then fall back.
*   **Supplier Directory:** A list of suppliers with their contact info and product categories.
*   **Logistics Cost Rules:** Set rules for who pays for delivery (Merchant, Customer, Split).

#### 5.5 App & System Settings
*   **Dual-Theme Toggle:** Persisted Zustand/AsyncStorage toggle between "Clean Light CRM" and "Premium Dark AI" aesthetics.
*   **Offline Sync Engine:** A toggle to enable/disable background sync. Shows the last sync time and the number of pending mutations.
*   **Notification Preferences:** Granular control over which events trigger a push notification (e.g., "New Order", "Payment Received", "AI Escalation").
*   **Data & Privacy:** A clear explanation of how Biblio uses data, with options to export or delete data.
*   **Team Management:** For merchants with staff, a way to invite team members and assign roles (e.g., "Sales Rep", "Logistics Manager").

#### 5.6 Advanced Settings (For Power Users)
*   **AI Training:** A "Teach Biblio" section where the merchant can correct AI mistakes. Each correction is fed back into the fine-tuning pipeline.
*   **Webhooks & API Access:** For Pro tier merchants, a way to connect Biblio to other tools (e.g., Google Sheets, Zapier).
*   **Audit Log:** A complete, immutable log of every action taken by the AI and the merchant. This is critical for debugging and compliance.

---

### 6. THE "FUTURE APP" EXTENSIBILITY LAYER

This is how you make Biblio a platform, not just an app.

*   **The App Store Concept:** A section in Settings called "Connected Apps". Here, the merchant can browse and install integrations.
*   **Instagram Integration:** Install the "Instagram" app. Biblio will then scrape the merchant's Instagram feed for product images, auto-populate the catalog, and handle Instagram DMs and comments as a new channel in the Unified Inbox.
*   **TikTok Integration:** Install the "TikTok" app. Biblio will scrape TikTok videos for product references and handle TikTok DMs.
*   **Payment Gateway Integrations:** Install "Paystack" or "Flutterwave" to enable card payments.
*   **Logistics Integrations:** Install "Kwik" or "Gokada" to enable auto-dispatch.
*   **Accounting Integrations:** Install "QuickBooks" or "Zoho Books" to sync financial data.
*   **The API Marketplace:** For developers, a public API to build custom integrations. This turns Biblio into a true operating system.

---

### 7. IMPLEMENTATION ROADMAP (PHASED APPROACH)

*   **Phase 1 (Months 1-3): The Core Engine & WhatsApp.**
    *   Build the Channel-Agnostic Core (Event Bus, State Machine, Identity Graph).
    *   Integrate WhatsApp Business API.
    *   Build the basic UI for all 5 tabs (Analytics, Inbox, Chats, CRM, Settings).
    *   Implement the AI pipeline: Voice-to-Text → Intent Parsing → Response Generation.
    *   Implement payment verification via virtual accounts.
*   **Phase 2 (Months 4-6): Autonomy & Logistics.**
    *   Build the Swipe-to-Execute Inbox.
    *   Implement the Intelligent Triage Engine.
    *   Integrate with logistics partners (Kwik, Gokada) for auto-dispatch.
    *   Build the Supplier Integration Service for auto-restocking.
    *   Implement the Out-of-Band Escalation (SMS/Voice Call) for offline customers.
*   **Phase 3 (Months 7-9): Intelligence & Scale.**
    *   Build the Predictive AI Insight Widget ("The Oracle").
    *   Implement the Multimodal RAG pipeline for deictic reference resolution ("that post").
    *   Build the Customer Cohort Analysis and Product Performance Matrix.
    *   Launch the "Connected Apps" store with Instagram integration.
*   **Phase 4 (Months 10-12): Enterprise & Platform.**
    *   Build the Alternative Credit Scoring API.
    *   Build the FMCG Market Pulse Dashboard.
    *   Launch the public API for third-party developers.
    *   Scale to 2,000+ merchants.

---

This specification is designed to be your single source of truth. It is exhaustive, actionable, and built on the foundational principle that Biblio is not an "AI app"—it is the **autonomous operating system for informal commerce**. Every feature, every tab, and every interaction is designed to reduce the merchant's cognitive load while maximizing their revenue and autonomy.
