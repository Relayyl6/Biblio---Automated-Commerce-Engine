# 3. `CLIENT_SPEC.md` — Client-Facing Specification

## 3.1 What This App Is

The **ACE Merchant App** is the command center for your business. Your business is run by ACE — an autonomous AI operating system that handles customer conversations, order fulfillment, payment verification, supplier restocking, and customer retention on your behalf.

You do not manage orders. You do not type replies. You do not check your bank app. You do not call dispatch riders.

**Your job is exception management.** The app is an inbox of the things your AI could not decide alone. You open it, you approve or reject, and you close it. The AI does the rest.

This app is built for merchants who run their business on WhatsApp — fashion vendors, food sellers, personal care brands, home goods — and who want to scale past the ceiling of personal bandwidth without hiring a team.

## 3.2 What the App Does

### Pulse (Home)
At a glance:
- **Today's Revenue:** Front-and-center at the absolute top of the screen. Proving the AI is making money while you sleep is the most important metric.
- **Active AI Chats:** How many customer conversations the AI is handling right now (sits just beneath revenue).
- A short AI briefing: "3 VIP customers haven't ordered in 2 weeks. Tap to see draft re-engagement messages."
- A live feed of orders currently out for delivery, with rider and ETA.

### Action Inbox
Everything the AI has drafted but not executed, waiting for your decision via a **Tinder-style Swipe Interface**:
- **Restock**: "Your Red Ankara is running out. Negotiated 50 yards for ₦42,000."
- **Win-back**: "Blessing — 27 days idle — 10% discount proposed."
- **Tone update**: A proposed refinement of how your AI speaks.
- **Pricing override**: "Customer wants Blue Dress for ₦12,000 (floor is ₦12,950)."

Swipe right to approve. Swipe left to reject. A highly scannable, dense UI so you can flick to approve without breaking your stride.

### Chat
A live view of every WhatsApp conversation your AI is handling. You can:
- See exactly which messages the AI sent (blue) and which a human sent (green).
- See the AI's confidence score on its last message.
- Tap **Take Over** to pause the AI and speak directly. Tap **Return to AI** to hand it back.
- Play customer voice notes inline, with transcriptions when available.

### CRM & Catalog
- **Products**: your catalog, synced from Meta Commerce, plus your own reorder thresholds and batch sizes.
- **Suppliers**: who supplies what, their WhatsApp number, last purchase, average lead time. The AI uses this to route restock messages automatically.
- **Customers**: profiles keyed by Global Buyer ID. Lifetime value, order count, average days between orders, preferred payment method, communication style, trust score.

### Brain Config
The guardrails of your AI:
- **Autonomy**: max order value the AI can handle without you, max discount it can give, absolute price floor, whether it can auto-dispatch logistics, whether it can run win-back campaigns.
- **Persona**: the dialect your AI speaks (English, Pidgin, Yoruba, Igbo, Hausa).
- **Tone**: your current tone guide, and a link to any pending tone update.
- **Custom instructions**: your Do's and Don'ts, in your own words.

Every change saves automatically. Destructive changes ask for confirmation.

## 3.3 What the App Does NOT Do (On Purpose)

- It does not require you to configure dashboards.
- It does not require you to type customer replies (though you can, if you want to take over).
- It does not require you to check your bank app — payments are verified via direct bank webhooks, not screenshots.
- It does not require you to call dispatch riders — logistics is booked autonomously when an order is verified.
- It does not require you to update inventory — stock levels update from sales velocity.
- It is not the only way to control your business. **Everything you can do in this app, you can also do by texting your Biblio Agent on WhatsApp.** If your data runs out, you can text "Approve all pending restocks" and the same action executes.

## 3.4 Offline Behavior

The app is designed for Nigerian mobile networks.

- **You can open it with no data.** Your last-known metrics, drafts, and chats are cached. You'll see a small "Showing cached data" pill.
- **You can approve and reject offline.** Actions are queued and sync automatically when you reconnect.
- **You will never see a spinning wheel for an action you just took.** The UI updates instantly, and the server catches up in the background.

## 3.5 Security & Trust

- All approvals are cryptographically authenticated. No one can approve a draft on your behalf without your phone.
- Payments are never verified from screenshots. The AI uses direct bank webhooks and virtual account reconciliation. A screenshot is informational only.
- Your AI cannot change prices below your floor, cannot exceed your max order value, and cannot execute a restock above your budget without your approval.
- Every AI action is logged with a timestamp, a confidence score, and a reason. You can audit any of it from the app.

## 3.6 What Success Looks Like

The metric that matters is **Autonomous Order Completion Rate (AOCR)** — the percentage of orders that went from first customer message to delivered product with **zero** input from you.

- Month 6 target: 40%
- Month 12 target: 70%
- Month 24 target: 85%

If AOCR is rising, the AI is doing its job. If it's flat, we're building the wrong things.

## 3.7 Plans & Limits

| Tier | Price | Best for | Includes |
|---|---|---|---|
| Starter | ₦5,000/mo | Solo vendors, <50 orders/mo | Basic AI automation, 1 connected platform, manual payment verification |
| Growth | ₦12,000/mo | Growing vendors, 50–200 orders/mo | Full autonomy, 3 platforms, automatic payment via virtual accounts, basic analytics |
| Pro | ₦25,000/mo | Established vendors, 200+ orders/mo | Advanced predictive analytics, supplier integration, priority support, API access |
| Enterprise | Custom | Multi-location, teams | Custom integrations, dedicated success manager, white-label options |

Annual prepay: 20% off.

## 3.8 What We Need From You

1. **Connect your WhatsApp Business account.** We handle the Meta approval process.
2. **Set your autonomy boundaries.** Max order value, max discount, price floor. Defaults are conservative; you can loosen them as you trust the AI.
3. **Set your tone.** Either pick a dialect and write a few Do's and Don'ts, or let the AI learn from your past conversations (Tone Learning, rolling out).
4. **Add your suppliers.** Link SKUs to supplier WhatsApp numbers so the AI can route restock messages.
5. **Approve things in the Inbox.** For the first two weeks, expect to approve 5–15 drafts per day. After that, the AI learns your preferences and the queue shrinks.

## 3.9 Roadmap (What's Coming)

- **Tone Learning from Transcripts**: the AI will read your past manual chats and refine its tone automatically. Today you write the tone guide; soon the AI will propose updates based on how you actually speak to customers.
- **Deterministic Receipt OCR**: today the AI "sees" receipt screenshots with a Vision model. We are building a deterministic OCR pipeline that verifies receipts against your bank ledger — not just describes them.
- **PWA for customers**: a checkout experience that opens inside WhatsApp, so your customers never leave the chat.
- **Global Buyer ID**: a one-tap checkout for customers who have bought from any ACE merchant before.
- **Multi-location support**: manage multiple shops from one app.
- **Team access**: give your staff scoped access to specific tabs.

## 3.10 Support

- **In-app**: Brain Config → "Talk to Biblio on WhatsApp."
- **WhatsApp**: text your Biblio Agent directly. It can answer questions, execute approvals, and change settings.
- **Human support**: for Growth tier and above, priority support within 4 hours.
