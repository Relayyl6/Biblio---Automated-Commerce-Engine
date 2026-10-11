# 1. `AGENTS.md` — Agent Contract for the ACE Merchant App

## 1.1 Mission

Build and maintain the **ACE Merchant App** — a React Native (Expo) mobile application that serves as the command center for merchants whose businesses are autonomously run by the ACE backend (`merchant-api`, Fastify/REST). The app is an **Inbox of Exceptions**: the merchant opens the app, 1-tap approves or rejects AI-drafted actions (restocks, win-back offers, tone updates, pricing overrides), and the AI executes the rest.

The app is the **primary human interface** to a system whose real work happens server-side. Its job is to surface, in the smallest possible number of taps, the things that need human judgment — and to stay silent about everything else.

## 1.2 Non-Negotiable Product Principles

1. **Exception-based, not operation-based.** The home screen is not a dashboard of things to *do*. It is a queue of things the AI *could not decide alone*. If the merchant has to configure something to make the app useful, the design is wrong.
2. **1-tap approval.** Every approval gate must be resolvable in a single gesture. Swipe, tap, done. No confirmation modals on reversible actions.
3. **Zero-latency feel.** Optimistic updates on every mutation. If the network is slow, the UI must not be. The merchant should never see a spinner for an action they just took.
4. **Offline-first.** The app must remain useful on a flaky Nigerian mobile network. Cached metrics, cached draft queues, queued mutations.
5. **The app is not the only interface.** 100% of approval gates and brain configurations are also executable via WhatsApp through the internal Biblio Agent. The app must never assume it is the sole point of control. It must reconcile state on resume.
6. **Merchant-first, always.** Every decision starts with: *does this make a 34-year-old vendor in Surulere's life radically easier?* Not "is this a nice UI."
7. **Autonomy is the product.** The app's success metric is **Autonomous Order Completion Rate (AOCR)** — the % of orders that required zero merchant intervention. If a feature increases AOCR, it belongs. If it increases time-in-app without increasing AOCR, it does not.

## 1.3 Tech Stack (Locked)

| Concern | Choice |
|---|---|
| Framework | Expo SDK 50+ (React Native) |
| Language | TypeScript (strict mode, `noImplicitAny`, `strictNullChecks`) |
| Routing | Expo Router (file-based, `app/(tabs)/...`) |
| Styling | NativeWind (Tailwind CSS for RN) |
| Global UI State | Zustand (auth, modals, toasts, connectivity) |
| Server State | TanStack React Query v5 (polling, caching, mutation states) |
| Persistence | AsyncStorage + React Query Persist Query Client |
| UI Primitives | Restyle / custom Radix-like accessible primitives |
| Icons | Lucide React Native |
| Gestures | react-native-gesture-handler, react-native-reanimated |
| Forms | react-hook-form + zod |
| Auth | Phone OTP (Firebase) — token stored in SecureStore |

**Do not add new dependencies** without a written justification in the PR description. Every dependency is a maintenance liability in a low-bandwidth market.

## 1.4 Information Architecture

Five bottom tabs, in this order:

1. **Pulse** (`/`) — live telemetry, revenue, active bot conversations.
2. **Action Inbox** (`/inbox`) — pending AI drafts requiring human approval.
3. **Chat** (`/chats`) — live WhatsApp conversations, human takeover.
4. **CRM & Catalog** (`/crm`) — products, suppliers, customer profiles.
5. **Brain Config** (`/settings`) — AI guardrails, tone, autonomy boundaries.

Additional non-tab routes:
- `/auth/*` — phone OTP flow.
- `/chats/[id]` — conversation detail.
- `/inbox/[id]` — draft detail (for drafts that need more than a swipe).
- `/crm/product/[sku]` — product detail.
- `/crm/supplier/[id]` — supplier detail.
- `/crm/customer/[gbi]` — customer profile (Global Buyer ID).
- `/settings/autonomy` — autonomy boundaries (order value caps, discount floors).
- `/settings/persona` — dialect/persona selector.

## 1.5 Data Contracts

All API shapes are defined in `src/types/api.ts`. Do not inline `any`. Do not invent fields; if the backend doesn't expose a field, file a ticket, don't `// @ts-ignore`.

Canonical types (subset):

```ts
export interface PulseMetrics {
  todayRevenue: number;
  weekToDate: number;
  aov: number;
  activeChats: number;
  pendingPayouts: number;
  outForDelivery: number;
}

export type DraftType = 'restock' | 'winback' | 'tone_update' | 'pricing_override';

export interface ApprovalDraft {
  id: string;
  type: DraftType;
  payload: RestockPayload | WinbackPayload | ToneUpdatePayload | PricingOverridePayload;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  createdAt: string;
  expiresAt: string | null;
  source: 'auto' | 'whatsapp_biblio' | 'merchant_manual';
}

export interface RestockPayload {
  sku: string;
  productName: string;
  currentStock: number;
  predictedStockoutHours: number;
  supplierId: string;
  supplierMessageDraft: string;
  estimatedCost: number;
  projectedMargin: number;
  autonomyBand: 'within_rules' | 'requires_approval';
}

export interface WinbackPayload {
  customerGbi: string;
  customerName: string;
  ltv: number;
  daysIdle: number;
  proposedDiscountPct: number;
  messageDraft: string;
  messageImageUrl: string | null;
}

export interface ToneUpdatePayload {
  currentToneProfile: string;
  proposedToneProfile: string;
  derivedFromFeatures: Record<string, unknown>;
  evaluationReport: { styleSimilarity: number; recommendation: 'promote' | 'hold' | 'reject' };
}

export interface PricingOverridePayload {
  customerGbi: string;
  sku: string;
  productName: string;
  requestedPrice: number;
  floorPrice: number;
  discountGapPct: number;
  aiSuggestion: 'approve' | 'counter' | 'decline';
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  direction: 'inbound' | 'outbound';
  author: 'customer' | 'ai' | 'human';
  body: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'audio' | 'video';
  timestamp: string;
  deliveryStatus: 'sent' | 'delivered' | 'read' | 'failed';
  aiConfidence?: number; // 0..1, when author === 'ai'
}

export interface Product {
  sku: string;
  name: string;
  imageUrl: string;
  price: number;
  stock: number;
  reorderThreshold: number;
  reorderBatchSize: number;
  supplierId: string | null;
  metaCatalogSyncedAt: string | null;
}

export interface Supplier {
  id: string;
  name: string;
  whatsappNumber: string;
  linkedSkus: string[];
  lastPurchaseAt: string | null;
  avgLeadTimeHours: number;
}

export interface CustomerProfile {
  gbi: string;                    // Global Buyer ID
  name: string;
  phoneHash: string;
  ltv: number;
  orderCount: number;
  avgDaysBetweenOrders: number;
  lastOrderAt: string | null;
  preferredPaymentMethod: 'bank_transfer' | 'card' | 'pod';
  communicationStyle: 'formal' | 'casual';
  trustScore: number | null;      // 300-850, if scored
}

export interface AutonomyConfig {
  maxAutoOrderValue: number;      // NGN
  maxAutoDiscountPct: number;     // 0..1
  absolutePriceFloorPct: number;  // 0..1, floor vs list price
  autoDispatchLogistics: boolean;
  autoWinbackEnabled: boolean;
  baseDialect: 'english' | 'pidgin' | 'yoruba' | 'igbo' | 'hausa';
  customDos: string;
  customDonts: string;
  toneGuide: string;              // human-readable current tone guide
}
```

## 1.6 State Management Rules

- **Zustand** is for *client-only* UI state: auth token, active modal, toast queue, connectivity flag, "app has unseen inbox items" badge. It must NOT mirror server data.
- **React Query** owns all server data. Every query has a stable `queryKey`, a documented `staleTime`, and a `refetchOnAppFocus` policy.
- **Optimistic updates** are mandatory for: approve draft, reject draft, takeover chat, toggle autonomy settings, update reorder threshold. The pattern is: `onMutate` → snapshot → optimistic patch → `onError` rollback → `onSettled` invalidate.
- **Polling** is allowed only on the Pulse screen (`/api/dashboard/pulse`), the Inbox badge count, and the active chat detail. Nothing else polls. Everything else is on-demand or push.
- **Offline queue**: mutations made offline are queued in AsyncStorage and replayed on reconnect. Each queued mutation carries an idempotency key (`X-Idempotency-Key` header) to prevent duplicate execution server-side.

## 1.7 Offline & Caching Strategy

- **Stale-While-Revalidate**: React Query persists the full cache to AsyncStorage via `PersistQueryClient`. On cold start, the merchant sees their last-known metrics and drafts instantly, then a background refetch corrects.
- **Optimistic rendering on mutation**: approving a draft removes it from the list immediately. The badge count decrements immediately. The success state is a toast, not a modal.
- **Graceful degradation**: if the API is unreachable, the Inbox shows the last cached queue with a subtle "Showing cached data — last synced X ago" pill. The merchant can still swipe; actions are queued.
- **Media**: images are cached via `expo-image` with a memory-disk policy. Voice notes are cached after first play. The app must not blank-screen on cold start with no network.

## 1.8 Approval Gate Rules (Critical)

1. Every approval gate has a **single primary action** (approve) and a **single secondary action** (reject). Detail views may add "edit then approve," but the list view must never require it.
2. Swiping right approves; swiping left rejects. Haptic feedback on threshold cross. Undo toast for 5 seconds after either.
3. Drafts expire. The UI must show a countdown when `expiresAt` is within 4 hours. Expired drafts vanish from the queue with no toast (avoid noise).
4. Drafts generated by the Biblio WhatsApp fallback must show a small `via WhatsApp` badge. The app must not present them as if the merchant created them here.
5. If the same draft is approved elsewhere (WhatsApp) while the app is open, the next poll must remove it silently. Optimistic state must be reconciled, not duplicated.

## 1.9 Chat & Human Takeover Rules

- The chat list shows all active conversations, sorted by most recent activity, with a badge for conversations where the AI's last confidence was below 0.75.
- Message bubbles are color-coded: customer (gray), AI (blue), human override (green). The merchant must be able to see at a glance which messages the AI sent.
- **Take Over** is a single button. Tapping it fires `POST /api/chats/:id/takeover`, which sets a Redis lock `human_override:{customerId}` on the backend. Once taken over, the AI is muted for that conversation until the merchant taps "Return to AI."
- The takeover state must be visible in the UI within 300ms of the tap (optimistic). If the mutation fails, revert and show a blocking error — this is one of the few actions that must be confirmed by the server.
- Voice notes must be playable inline. Transcriptions (when available) render below the player.

## 1.10 Brain Config Rules

- Every control on the Brain Config screen maps to a single field on `AutonomyConfig`. No hidden state. No "apply" button — changes auto-save with a debounced PATCH and a subtle "Saved" indicator.
- Destructive changes (raising `maxAutoOrderValue` above ₦50,000, disabling `autoDispatchLogistics`) require a confirm dialog. Non-destructive changes do not.
- The Tone Update queue (in Inbox) and the Tone Guide field (in Brain Config) are the same underlying data. If a tone update draft is approved, the Brain Config screen must reflect the new tone on next focus.
- Dialect selector changes propagate to the AI immediately and are logged. The merchant must be able to see "AI now speaks: Pidgin" as an active state, not a setting.

## 1.11 Performance Budgets

| Metric | Budget |
|---|---|
| Cold start to interactive | < 2.5s on mid-range Android, < 1.5s on iPhone 12 |
| Tab switch | < 100ms |
| Draft list scroll | 60fps, no jank on 100+ items |
| Approve mutation round-trip (optimistic) | UI updates < 50ms; server confirms < 2s p50 |
| Pulse metrics refresh | < 800ms on 3G |
| App bundle (JS) | < 6MB gzipped initial |

Any PR that regresses a budget must include a written justification and a plan to recover.

## 1.12 Error Handling & Resilience

- **Network errors** are non-blocking. The app shows cached data, queues mutations, and surfaces a passive banner: "You're offline — actions will sync when you reconnect."
- **Auth expiry** is handled centrally: a 401 from any query triggers a silent token refresh; a 401 from refresh logs the user out and routes to `/auth`.
- **Server 5xx** on a mutation: rollback optimistic state, show a toast with a retry action. Do not silently swallow.
- **Unknown draft types**: render a fallback card with "Unsupported action — open in WhatsApp" linking to the Biblio Agent. Never crash the Inbox.
- **Deep links** from WhatsApp to the app (e.g., `/inbox/[id]`) must work even when the app is cold-started. Expo Router handles this; do not break the linking config.

## 1.13 Testing Requirements

- **Unit**: pure functions (formatters, validators, optimistic reducers). Vitest.
- **Component**: each screen renders with mocked React Query state. React Native Testing Library.
- **Integration**: the approval flow (list → swipe → optimistic remove → API mock → toast), the takeover flow, the offline queue replay.
- **E2E (Maestro or Detox)**: cold start → login → approve a draft → verify inbox count decrements → toggle autonomy → verify persisted.
- No PR merges without tests for new behavior. Tests are not "nice to have" in a financial tool.

## 1.14 Accessibility

- Every interactive element has an `accessibilityLabel`. Swipe actions also have a tap fallback (long-press menu) for users who cannot perform gestures.
- Minimum tap target: 44x44pt.
- Color is never the sole signal. Approval = swipe + icon + label. Rejection = same.
- Dynamic Type is respected up to XXL. Layouts must not clip at XXL.
- Screen reader order matches visual order.

## 1.15 Localization

- The merchant-facing UI is English-first, with a planned Pidgin locale. All strings live in `src/i18n/en.json` (and future `pcm.json`). No hardcoded strings in components.
- Currency is ₦ (NGN), formatted with `Intl.NumberFormat`. Never assume USD.
- Dates are relative ("2h ago", "yesterday") for the last 7 days; absolute after. Timezone is Africa/Lagos.
- The AI's dialect (Brain Config) is independent of the merchant UI language. The merchant may read the UI in English while the AI speaks Pidgin to customers.

## 1.16 Definition of Done (per feature)

A feature is done when:

1. It works on iOS and Android, online and offline.
2. It has unit + component tests, and an E2E path if it touches approval, takeover, or autonomy.
3. It respects the performance budget.
4. It has an accessibility pass (labels, tap targets, contrast).
5. It does not add a dependency without justification.
6. It renders correctly at Dynamic Type XXL.
7. It handles the "merchant is offline" case gracefully.
8. It reconciles state when the same action was performed via WhatsApp.
9. It's documented in `CLIENT_SPEC.md` if it changes user-visible behavior.
10. It's instrumented with an analytics event (`feature_name.action`) for AOCR tracking.

## 1.17 Anti-Patterns (Do Not)

- ❌ Adding a "dashboard" that requires the merchant to configure widgets.
- ❌ Requiring a confirmation modal for a reversible action (swipe approve, toggle).
- ❌ Showing spinners for optimistic mutations.
- ❌ Mirroring server state in Zustand.
- ❌ Polling more than three endpoints.
- ❌ Hardcoding a string, a currency, or a phone number.
- ❌ Any feature that increases time-in-app without increasing AOCR.
- ❌ Treating the app as the sole interface — the Biblio WhatsApp fallback must always be able to do the same thing.
- ❌ Shipping a screen that has no empty state, no loading state, no error state, and no offline state.

## 1.18 Escalation Rules (When an Agent Should Stop and Ask)

- The backend API does not return a field the spec requires. Do not invent it. Open a ticket.
- A design decision would violate the "1-tap approval" or "offline-first" principle.
- A new dependency would be required.
- The requested feature conflicts with the Biblio WhatsApp fallback contract.
- The requested feature would increase AOCR tracking ambiguity.
- A change to the data model would break the persisted React Query cache for existing users.
