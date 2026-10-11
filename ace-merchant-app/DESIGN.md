# 2. `DESIGN.md` — Design System & Interaction Spec

## 2.1 Design Philosophy

**Exception-Based Management** is the design thesis. The merchant's attention is the scarcest resource in the system. Every pixel must either (a) surface an exception, (b) resolve an exception, or (c) stay out of the way.

The app is not a dashboard. It is an **inbox with a pulse**. It should feel like a well-trained chief of staff: it tells you what it handled, it asks you only about what it couldn't decide, and it never wastes your time.

Three design values, in priority order:

1. **Clarity over completeness.** Show the three things that matter, not the thirty that exist. Progressive disclosure via detail screens.
2. **Speed over richness.** A 200ms interaction beats a beautiful 900ms one. Animations are functional, not decorative.
3. **Trust through transparency.** The merchant must always be able to see *what the AI did and why*. Confidence scores, source badges, and audit trails are first-class UI elements, not buried settings.

## 2.2 Visual Language (Dual-Theme Aesthetic)

To maximize user retention across different environments (bright outdoor markets vs. low-light evening reviews), the app employs two distinct but equally premium themes. The user can toggle between these instantly in the Settings.

1. **Clean Matte Light Mode (Professional CRM):** Takes direct inspiration from top-tier enterprise tools. It uses stark white cards on soft gray canvases, crisp Slate typography, and subtle drop shadows. It looks grounded, highly trustworthy, and data-dense.
2. **Premium Dark Mode (AI Command Center):** Uses deep jet-black canvas backgrounds to reduce eye strain, contrasted with elevated dark-gray cards. To signify "AI Intelligence," it uses vibrant, glowing accent colors (Neon Lime and Electric Violet) with subtle colored auras instead of harsh shadows.

### Color Tokens

| Token | Light Mode Value | Dark Mode Value | Usage |
|---|---|---|---|
| `bg.canvas` | `#F7F8FA` | `#090A0C` | App background |
| `bg.surface` | `#FFFFFF` | `#15171A` | Standard cards |
| `text.primary` | `#0F172A` | `#FFFFFF` | Headings, primary metrics |
| `text.secondary` | `#64748B` | `#A1A1AA` | Body, subtitles |
| `accent.primary` | `#000000` (Jet Black) | `#E2FF6E` (Neon Lime) | Primary actions, revenue highlights |
| `accent.insight` | `#F59E0B` (Solid Amber) | `#8B5CF6` (Electric Violet) | AI Insights, Action needed |
| `accent.success` | `#10B981` | `#E2FF6E` | Approvals, positive trends |
| `accent.danger` | `#EF4444` | `#EF4444` | Rejections, destructive actions |

**Contrast Strategy:** 
- *Light Mode* relies on the stark contrast of pure white cards against the off-white canvas, with deep black text for ultimate readability outdoors or in brightly lit market environments.
- *Dark Mode* uses high-contrast Neon Lime against Jet Black to create a striking, hyper-modern look that emphasizes speed and clarity.

### Typography & Spacing

| Role | Size / Weight / Tracking | Light Mode Color | Dark Mode Color |
|---|---|---|---|
| Display | 36 / 700 / -1px | Slate 900 (`#0F172A`) | Pure White (`#FFFFFF`) |
| Title | 20 / 600 / -0.5px | Slate 900 | Pure White |
| Body | 15 / 500 / 0 | Slate 500 (`#64748B`) | Zinc 400 (`#A1A1AA`) |
| Meta | 12 / 600 / 0.5px | Uppercase tracking | Uppercase tracking |

Font: **Inter** or system sans-serif. Use tight tracking (`letter-spacing`) on large headers for a premium, bold look. Highly legible, professional, and dense.

- **Radius:** Cards use smooth, modern rounding `24px` (`rounded-3xl` / `rounded-[24px]`). Buttons and pills use fully rounded corners (`rounded-full`).
- **Elevation (Light):** Cards use a very soft, diffused shadow (`shadow-[0_8px_30px_rgb(0,0,0,0.04)]`) to lift them off the canvas without looking harsh. No glowing effects.
- **Elevation (Dark):** Elevated AI cards emit a very faint, soft colored glow (e.g., a faint `#8B5CF6` shadow/aura) to indicate intelligence instead of traditional hard drop-shadows.

### Motion
- **Fluid Physics:** Swiping and scrolling must feel liquid. Use `react-native-reanimated` with clean, predictable spring configurations (`mass: 1, damping: 20, stiffness: 200`) for swipe actions to give them physical weight. No decorative transitions.

## 2.3 Component Inventory

Every component lives in `src/components/` and has a `.stories.tsx` (or equivalent) and a `.test.tsx`.

### Primitives
- `<Text variant="..." />`
- `<Button variant="primary|secondary|ghost|danger" size="sm|md|lg" />`
- `<Card />`
- `<Badge tone="info|warn|danger|success" />`
- `<Sheet />` (bottom sheet)
- `<Toast />`
- `<EmptyState />`
- `<Skeleton />`
- `<Avatar />`
- `<IconButton />`

### Domain Components
- `<MetricCard label value delta />` — Pulse.
- `<ActiveNegotiationsBadge count />` — Pulse.
- `<LogisticsFeed />` — Pulse, vertical FlatList of `out_for_delivery`.
- `<SwipeableDraftCard draft onApprove onReject />` — Inbox, gesture-driven.
- `<DraftTypeIcon type />` — restock/winback/tone_update/pricing_override.
- `<CountdownPill expiresAt />` — Inbox, only when < 4h.
- `<SourceBadge source />` — "via WhatsApp" badge for Biblio-created drafts.
- `<ChatListRow conversation />`
- `<MessageBubble message />` — color-coded by author.
- `<TakeoverButton chatId />` — large CTA, optimistic.
- `<AIConfidencePill value />` — 0..1, color-graded.
- `<MarginSlider />` — Brain Config.
- `<PersonaSelector />` — Brain Config.
- `<PromptTextInput />` — multiline, autosaving.
- `<ToggleSwitch />` — Brain Config.
- `<SupplierForm />` — CRM.
- `<ProductRow />` — CRM, read-only Meta catalog + local fields.
- `<CustomerRow />` — CRM.

### Layout
- `<Screen />` — safe area, background, optional header.
- `<ScreenHeader title subtitle actions />`
- `<TabBar />` — custom, with badge support on Inbox.
- `<KeyboardAvoidingScreen />`

## 2.4 Screen Specs

### Pulse (`/`)
- **Hero**: `<MetricCard>` for today's revenue (display type), with a small sparkline. **Revenue is the absolute priority and must be front-and-center at the top of the screen.** Proving the SaaS is making money while they sleep is the core value proposition.
- **Row of three compact metrics**: week-to-date, AOV, pending payouts.
- **Active negotiations badge**: "12 chats active right now" — sits just beneath the revenue as a secondary supporting metric. Tappable, routes to `/chats?filter=active`.
- **AI daily briefing card**: 2–4 sentences generated by the backend, e.g. "3 VIP customers haven't ordered in 2 weeks. Tap to see draft re-engagement messages." Tapping routes to the relevant Inbox filter.
- **Logistics feed**: vertical list of orders `out_for_delivery`, each row showing customer name, ETA, rider, tracking link.
- **Empty state**: "No orders yet today. Your AI is handling N conversations." — calm, not alarming.

### Action Inbox (`/inbox`)
- Segmented control at top: **All / Restock / Win-back / Tone / Pricing**.
- `<SwipeableDraftCard>` list. **This must be a Tinder-style swipe interface (Left/Right to Reject/Approve).** A busy merchant doesn't have time to tap into every draft to read 3 paragraphs. The card must be highly scannable and dense (e.g., "Blessing — 27 days idle — 10% discount") so they can flick right to approve without breaking their stride.
- Card content varies by type:
  - **Restock**: product name, current stock, predicted stockout ("~16 hours"), supplier name, drafted message preview, estimated cost, projected margin %.
  - **Win-back**: customer name, LTV, days idle, proposed discount %, message preview, optional image thumbnail.
  - **Tone Update**: "Old tone → New tone" with a diff-style preview. Tap opens a detail screen with the full evaluation report.
  - **Pricing Override**: customer, product, requested price, floor, gap %, AI's suggestion. Approve / Counter / Decline buttons in detail.
- **Countdown pill** appears when `expiresAt < 4h`.
- **Source badge** "via WhatsApp" if `source === 'whatsapp_biblio'`.
- **Empty state**: "Inbox zero. Your AI is running the business." with a small illustration.

### Chat (`/chats`)
- List sorted by recency. Each row: customer avatar, name, last message preview, AI confidence pill if last AI message was < 0.75, unread indicator.
- Filter chips: **All / Active / Needs attention / Human-taken-over**.
- Detail (`/chats/[id]`):
  - Message list with `<MessageBubble>` color-coded.
  - Sticky header with customer name, LTV, order count, GBI.
  - **Take Over** button (primary, large) → optimistic state change, AI muted badge appears.
  - **Return to AI** button when taken over.
  - Inline voice note player with optional transcription.
  - Composer for human messages. Sends via `POST /api/chats/:id/messages`.

### CRM & Catalog (`/crm`)
- Segmented: **Products / Suppliers / Customers**.
- **Products**: read-only Meta catalog, augmented with local `reorderThreshold` and `reorderBatchSize`. Inline edit for the local fields only.
- **Suppliers**: list with linked SKU count, last purchase, avg lead time. Tap → detail with `<SupplierForm>` (name, WhatsApp number, linked SKUs).
- **Customers**: searchable list keyed by GBI. Tap → profile with LTV, order count, avg days between orders, last order, preferred payment method, communication style, trust score. Read-only except for notes.

### Brain Config (`/settings`)
- **Autonomy** section: `maxAutoOrderValue` (number input with ₦), `maxAutoDiscountPct` (slider), `absolutePriceFloorPct` (slider), `autoDispatchLogistics` (toggle), `autoWinbackEnabled` (toggle).
- **Persona** section: `<PersonaSelector>` for base dialect (English, Pidgin, Yoruba, Igbo, Hausa).
- **Tone** section: read-only display of current `toneGuide` with a "View pending update" link if a Tone Update draft is in the Inbox.
- **Custom instructions**: two multiline `<PromptTextInput>` for Do's and Don'ts.
- **Account**: phone number, logout, app version, "Talk to Biblio on WhatsApp" deep link.

All changes auto-save with a 600ms debounce. A small "Saved" pill appears and fades. Destructive changes (raising `maxAutoOrderValue` above ₦50,000, disabling `autoDispatchLogistics`) show a confirm dialog.

## 2.5 Interaction Patterns

### Swipe to approve/reject
- Gesture: horizontal pan. Threshold: 40% width or velocity > 800px/s.
- Background: green (approve) / red (reject) with a large icon.
- On release past threshold: card animates off-screen, list collapses, toast "Approved" with **Undo** for 5 seconds.
- On release below threshold: spring back.
- Haptics on threshold cross.

### Optimistic mutation
- UI updates immediately.
- If mutation succeeds: silent.
- If mutation fails: rollback with a subtle shake, toast with retry.
- Never show a blocking spinner for approve/reject/toggle.

### Pull to refresh
- Pulse, Inbox, Chat list, CRM lists.
- Custom refresh indicator (ACE green).
- Does not block interaction.

### Empty states
- Every list has one. Copy is calm and confident, never alarming. "Inbox zero. Your AI is running the business."

### Error states
- Inline error banner above the affected list, with a retry.
- Never a full-screen error for a single failed item.

### Loading states
- Skeletons, not spinners, for list and card content.
- Spinners only for full-screen blocking operations (auth, first launch).

## 2.6 Accessibility

- All gestures have tap fallbacks (long-press → context menu).
- All interactive elements have `accessibilityLabel` and `accessibilityRole`.
- Dynamic Type up to XXL. No clipped text.
- Reduce Motion respected.
- Screen reader: order matches visual order, badges announce their meaning ("3 pending approvals").

## 2.7 Design Tokens (excerpt)

```ts
export const tokens = {
  color: {
    bg: { canvas: '#0B0D10', surface: '#14171C', elevated: '#1B1F26' },
    text: { primary: '#F5F5F0', secondary: '#9AA0A6', tertiary: '#6B7075' },
    accent: {
      primary: '#0F6E3F',
      warn: '#B45309',
      danger: '#B91C1C',
      info: '#1D4ED8',
    },
  },
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, '2xl': 32, '3xl': 48 },
  radius: { sm: 8, md: 12, lg: 16, pill: 999 },
  duration: { micro: 120, standard: 200, screen: 320 },
};
```

## 2.8 Anti-Patterns (Design)

- ❌ A "dashboard" with configurable widgets.
- ❌ Confirmation modals for reversible actions.
- ❌ Spinners on optimistic mutations.
- ❌ Color as the only signal.
- ❌ Decorative animation.
- ❌ A screen without an empty state, loading state, error state, and offline state.
- ❌ Any copy that sounds like a chatbot ("Oops! Something went wrong 😅").
- ❌ Any feature that adds time-in-app without adding AOCR.
