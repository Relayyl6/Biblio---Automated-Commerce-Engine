# UI Rules — ACE / Biblio

> Last updated: 2026-06-23. Interaction & layout principles. The merchant app is the
> primary human surface; design everything around the product thesis: **the merchant
> manages exceptions, not operations.** See `ui-tokens.md` for colors/spacing and
> `ui-registry.md` for the component/screen inventory.

## North-star principle (from BIBLO.docx, Layer 1)

> "The AI handles 94% autonomously — merchants only see the 6% requiring human judgment."

The merchant app should be **mostly empty most of the time.** A busy screen means the
autonomy failed. Design for the exception queue, not a control panel. Every screen answers
one question: *"Does anything need me right now?"* If not, show calm confirmation.

## Merchant app (React Native + Expo) — rules

1. **Exception-first.** The home/Command Center surfaces only: payments needing manual
   verification, negotiations escalated below floor, restock approvals, VIP at-risk alerts.
   Empty state is a feature ("Nothing needs you. ₦X handled today.").
2. **One-tap decisions.** Exceptions resolve with a single tap (Approve / Counter /
   Decline), mirroring the doc's escalation UX and the SMS reply-code system. No deep forms.
3. **Mobile-first, thumb-reachable.** 97% of users are mobile-only. Primary actions at the
   bottom; large tap targets (≥44pt).
4. **Plain language, merchant's dialect where relevant.** No ERP jargon ("SKU" is okay in
   catalog; elsewhere prefer "product"). Money always `₦` + thousands separators.
5. **Optimistic + honest feedback.** Show `ActivityIndicator` while saving; confirm with
   concrete outcome ("Saved — your agent now speaks with these settings."). Surface errors
   inline, never silently swallow.
6. **Settings = the AI's voice.** The Settings screen edits tone/policies/delivery/dialect;
   changing them must visibly change agent behavior on the next message. Make that causality
   clear in copy.

## Admin portal (Vite + React) — rules

- This is the **internal ACE-ops** surface, not merchant-facing. Utilitarian is fine.
- Current scope: look up a merchant, view catalog + seller context, onboard, trigger
  catalog sync. Phase-2 views: AI Performance, System Health, Billing.
- Keep it a thin client over `merchant-api`; no business logic in the UI.

## Customer surface (WhatsApp → PWA) — rules

- Phase 1: customer never leaves WhatsApp; the "UI" is the AI's conversation. Keep replies
  consolidated (≤ ~2.3 messages/order), warm, in-dialect, with one clear CTA (PWA link).
- PWA (not yet built): must load <2s on 3G, pre-fill from Global Buyer ID, offer
  bank-transfer / card / pay-on-delivery. Feels native inside WhatsApp's in-app browser.

## Accessibility & resilience

- Design offline-tolerant: Nigeria has intermittent connectivity (BIBLO Risk 3). Show
  clear retry affordances; never lose unsaved merchant input on a failed request.
- Sufficient contrast: `--green-ink` on `--bg-surface` and `--on-primary` on
  `--green-primary` both pass; don't put `--green-muted` text on green.

## Consistency rules

- Reuse the palette and radii in `ui-tokens.md` exactly. Do not introduce new colors.
- New screens register in `ui-registry.md` in the same change.
- Prefer composing the small existing primitives (Field, Row, chips, cards) over new ones.