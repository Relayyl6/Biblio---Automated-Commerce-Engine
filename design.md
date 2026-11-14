# DESIGN.md: biblio

Design system, visual language, motion, 3D, and glassmorphism guidelines for biblio (Autonomous Commerce Engine, "ACE" in the product brief).

Version: 1.0
Owner: Product Design
Status: Proposed. Revise as user testing comes in.

---

## 0. How to use this document

This is the single source of truth for how biblio looks, moves, and feels. It covers:

- The merchant mobile app (React Native / Expo), which is the primary surface.
- The customer PWA (Next.js), which opens inside WhatsApp's in-app browser.
- Marketing and landing pages, which use the editorial hero style.
- The enterprise data dashboards (later, Year 2+).

Where this document and a Figma component disagree, this document wins until a design review changes it. Where a rule is marked **MUST**, it is non-negotiable. **SHOULD** rules can be broken with a written reason in the PR.

---

## 1. Product context that shapes design

These facts come from the product brief and override any generic design instinct.

**Who uses it.** Lagos-based informal merchants who run businesses through WhatsApp, Instagram DM, and Messenger. They manage 30 to 150 conversations a day. 97% of target users never touch a laptop. Many are non-technical, and some are more comfortable in voice notes and Pidgin than in forms.

**What the product does.** ACE acts autonomously. It replies to customers, reconciles payments, books riders, and pings suppliers without asking permission. The merchant's job shifts from doing the work to managing exceptions. This is the central design problem: **the product works in the background, so the design has to make invisible work visible, trustworthy, and reversible.**

**Device and network reality.** Design for the worst case first:

- Mid-range and low-end Android devices with limited RAM and older GPUs.
- 3G-class connections, prepaid data that runs out mid-session (73% of mobile users are on prepaid plans, and average bundle depletion is 18 times a month).
- Battery anxiety. Customers turn off mobile data to save battery.
- Intermittent connectivity during the 6 to 9 PM congestion window.
- Strong sunlight and outdoor use, such as at markets and on motorbike dispatch.

**Language.** English, Nigerian Pidgin, and code-switching between English and Yoruba, Igbo, or Hausa. Microcopy must be short, plain, and readable in one glance.

**Money.** Naira (₦) is the primary currency. Amounts are large and frequent, so figures must be scannable.

**Consequences for design:**

1. Works offline first. Every screen has a meaningful state without a network.
2. Small payloads. System fonts and vector icons beat downloaded assets. Images are compressed hard.
3. Dark mode is a battery feature, not just a style choice.
4. Glass and 3D effects are progressive enhancements, never requirements. Every visual effect has a flat fallback.
5. Money and status are the most important information on screen, so they get the strongest hierarchy.

---

## 2. Design principles

biblio draws on two reference philosophies and adapts both for this context.

### 2.1 What we take from Airbnb

- **Warmth over sterility.** Business software often feels like a bank form. biblio should feel like it was made by people who understand hospitality and community. Rounded corners, human photography, and friendly microcopy all serve this.
- **Photography and people carry the emotion.** Product photos of real goods from real merchants (fabric, food, skincare) do more than abstract illustrations. Ankara fabric, a stall, a merchant's hands. Avoid stock photography.
- **Clear, confident primary action.** One dominant call to action per screen. Everything else recedes.
- **Trust through transparency.** Airbnb's reviews, verified badges, and clear fee breakdowns make strangers feel safe transacting. biblio needs the same: verified payments, visible escrow state, and clear reasons for every autonomous decision.
- **Flexible, modular components.** Cards and sheets that adapt to content length, rather than rigid fixed-height tiles.

### 2.2 What we take from Apple (Human Interface Guidelines)

- **Clarity.** Text is legible at every size. Icons are unambiguous. Hierarchy is obvious. Every element earns its place.
- **Deference.** The interface steps back so the content (the conversation, the order, the money) is the hero. Chrome is minimal. Blur and translucency are used to frame content, not compete with it.
- **Depth.** Layers communicate hierarchy. Sheets float above content, modals sit above sheets, and motion explains where things came from and where they are going.
- **Direct manipulation.** Swipe to act, drag to reorder, pull to refresh. Gestures feel physical and reversible.
- **Consistency.** Standard navigation patterns, standard gestures, and familiar controls, so merchants never have to relearn the app.

### 2.3 biblio's synthesis: the Five Rules

1. **Show the invisible work.** Every autonomous action leaves a legible trace: what happened, why, and how to undo it.
2. **Exceptions are the screen.** The default view surfaces only what needs a human. Routine success is summarized, not listed.
3. **Money is always readable.** Figures use tabular numerals, the ₦ sign, and clear sign and colour for direction.
4. **Warmth in the edges, precision in the core.** Playful, warm shapes and photography on the outside. Exact, calm, financial clarity in the data.
5. **Degrade gracefully.** The app is beautiful at full power and fully usable on a budget phone with no connection.

---

## 3. Brand and visual identity

### 3.1 Personality

| Trait | Expressed as | Avoid |
|---|---|---|
| Capable | Calm density, confident numbers | Cluttered dashboards, jargon |
| Warm | Rounded shapes, human photos, friendly copy | Cold corporate blue-grey |
| Quietly intelligent | Subtle motion, precise hierarchy | Flashy sci-fi effects, neon AI cliches |
| Trustworthy | Clear status, visible audit trails | Hidden decisions, vague "AI magic" |
| Local | Ankara-inspired accent details, Pidgin microcopy | Generic Western-only aesthetic |

Ankara inspiration is a supporting accent only. Use it in illustrations, empty states, and onboarding. Never use wax-print patterns as full backgrounds, because they hurt legibility and read as decoration.

### 3.2 Colour

Colour is semantic first, decorative second. Every colour has a job.

**Core palette (light)**

| Token | Hex | Role |
|---|---|---|
| `ink-950` | `#0F1115` | Primary text, high-contrast UI |
| `ink-700` | `#3B404A` | Secondary text |
| `ink-400` | `#8A909C` | Tertiary text, placeholders, dividers on paper |
| `paper-0` | `#FFFFFF` | Card surface |
| `paper-50` | `#FAF8F4` | App background (warm off-white, Airbnb-inspired warmth) |
| `paper-100` | `#F2EEE7` | Grouped sections, wells |
| `ember-500` | `#E8552D` | Primary action, brand accent |
| `ember-600` | `#C94420` | Pressed primary |
| `ember-50` | `#FDEEE9` | Primary tint backgrounds |

**Semantic colour (never used decoratively)**

| Token | Hex | Meaning |
|---|---|---|
| `settled-600` | `#14865B` | Payment verified, order complete, healthy |
| `settled-50` | `#E7F5EE` | Success background |
| `review-600` | `#B7791F` | Needs a human decision (amber) |
| `review-50` | `#FBF3E4` | Review background |
| `alert-600` | `#C8322B` | Failed, rejected, overdue, danger |
| `alert-50` | `#FBE9E8` | Alert background |
| `signal-600` | `#2F6FDB` | Information, AI-generated suggestion, link |
| `signal-50` | `#E9F0FD` | AI suggestion background |

**Rules**

- **MUST** pair every semantic colour with an icon and a text label. Colour alone never carries meaning. This covers colour-blind users and sunlight glare.
- **MUST** meet WCAG AA contrast: 4.5:1 for body text, 3:1 for large text and UI components.
- **SHOULD** keep `ember-500` to one primary action per screen. Overusing the accent is the fastest way to make a screen feel like an ad.
- Amounts in the red or green spectrum are signed (+₦12,500 / −₦4,000) so direction is clear without colour.

**Dark mode palette** is defined in section 14.

### 3.3 Typography

**Type families**

- **App UI (React Native):** The system font. SF Pro on iOS, Roboto on Android. This is a deliberate choice: fonts ship with the device, so there is no download, no flash of unstyled text on 3G, and the app feels native to each platform, as Apple's guidelines recommend.
- **Marketing and PWA headlines:** A wide, confident grotesk such as Geist or Hanken Grotesk, loaded as a subset and cached aggressively. Use it only for display and hero moments.
- **Numerals for money:** Tabular figures (`font-variant-numeric: tabular-nums` on web, `fontVariant: ['tabular-nums']` in RN) so columns of ₦ amounts align.

**Type scale (app)**

| Token | Size / line height | Weight | Use |
|---|---|---|---|
| `display` | 34 / 41 | Bold | Screen hero number (today's revenue) |
| `title-1` | 28 / 34 | Bold | Screen titles |
| `title-2` | 22 / 28 | Semibold | Section titles |
| `title-3` | 18 / 24 | Semibold | Card titles |
| `body` | 16 / 24 | Regular | Default reading text |
| `body-strong` | 16 / 24 | Semibold | Emphasis, names |
| `callout` | 15 / 22 | Regular | Secondary descriptions |
| `caption` | 13 / 18 | Medium | Timestamps, meta |
| `micro` | 11 / 14 | Medium | Badges, tab labels (minimum size) |

**Rules**

- **MUST** never go below 13px for readable text. `micro` is for badges and tab labels only.
- **MUST** support the OS text-size setting up to 200% without breaking layouts.
- **SHOULD** limit line length to about 60 characters on web and 35 to 45 characters inside chat bubbles for readability.

**Marketing type scale (editorial hero and landing pages)**

| Token | Desktop | Mobile | Line height |
|---|---|---|---|
| `hero-xl` | 160px | at least 10% of screen width, clamped to 56px to 120px | 0.9 |
| `hero-body` | 15px to 16px, max 320px wide | 14px to 16px | 1.5 |

### 3.4 Shape, radius, and elevation

**Radius scale**

| Token | Value | Use |
|---|---|---|
| `radius-xs` | 6 | Tags, small badges |
| `radius-sm` | 10 | Inputs, small buttons |
| `radius-md` | 16 | Cards, list groups |
| `radius-lg` | 24 | Sheets, large cards, hero photos (with 12px on web hero) |
| `radius-pill` | 999 | Pills, nav search, chips, primary buttons |

Airbnb's rounded language is the default. Sharp corners are reserved for data tables and financial statements, where alignment matters more than warmth.

**Elevation (Apple-style depth)**

biblio uses soft, layered shadows and translucency rather than hard drop shadows. Shadows are tinted toward the ink colour, not pure black.

| Token | Shadow | Use |
|---|---|---|
| `elev-0` | none | Flat content |
| `elev-1` | `0 1 2 rgba(15,17,21,0.06)` | Cards on paper |
| `elev-2` | `0 8 24 rgba(15,17,21,0.10)` | Floating buttons, popovers |
| `elev-3` | `0 16 48 rgba(15,17,21,0.16)` | Sheets, modals |
| `elev-glass` | See section 5 | Glass surfaces |

### 3.5 Iconography

- Single style: 1.75px stroke, rounded caps and joins, 24px grid, 2px padding.
- Use SF Symbols on iOS and a matching Material Symbols set on Android, or one custom set exported as vector.
- Icons are never the only label on a primary action or a status.
- Stickers and cut-out brand objects (see sections 6 and 10) are the only illustrative exceptions, and they live on marketing surfaces, not in the app's functional UI.

### 3.6 Photography and illustration

- **Photography is real and warm.** Shot in natural light, slightly imperfect, showing actual merchants, products, and hands at work. Never glossy stock.
- **Photos are compressed for the network.** Target under 80KB for in-app images and under 150KB for hero images. Serve WebP or AVIF with JPEG fallback. Use blurhash or a low-quality placeholder while loading.
- **Illustration** is flat, with one or two accent colours and Ankara-inspired geometric details. Keep it sparse.
- **Product screenshots** on marketing pages use the real UI, not mockups with fake data.

---

## 4. Design tokens (implementation reference)

These tokens feed both the React Native theme and the Next.js CSS variables.

```ts
// tokens.ts
export const color = {
  light: {
    bg: '#FAF8F4',          // paper-50
    surface: '#FFFFFF',     // paper-0
    wellBg: '#F2EEE7',      // paper-100
    text: '#0F1115',        // ink-950
    textSecondary: '#3B404A',
    textTertiary: '#8A909C',
    border: 'rgba(15,17,21,0.08)',
    accent: '#E8552D',      // ember-500
    accentPressed: '#C94420',
    accentTint: '#FDEEE9',
    settled: '#14865B',
    settledTint: '#E7F5EE',
    review: '#B7791F',
    reviewTint: '#FBF3E4',
    alert: '#C8322B',
    alertTint: '#FBE9E8',
    signal: '#2F6FDB',
    signalTint: '#E9F0FD',
  },
  dark: {
    bg: '#0B0C0F',
    surface: '#15171C',
    wellBg: '#1C1F26',
    text: '#F4F5F7',
    textSecondary: '#B5BAC4',
    textTertiary: '#7C828E',
    border: 'rgba(255,255,255,0.08)',
    accent: '#F26A45',      // lifted for dark-background contrast
    accentPressed: '#E8552D',
    accentTint: 'rgba(242,106,69,0.16)',
    settled: '#3DC58A',
    settledTint: 'rgba(61,197,138,0.14)',
    review: '#F0B45A',
    reviewTint: 'rgba(240,180,90,0.14)',
    alert: '#F0746C',
    alertTint: 'rgba(240,116,108,0.14)',
    signal: '#6A9DFF',
    signalTint: 'rgba(106,157,255,0.14)',
  },
} as const;

export const space = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64 };

export const radius = { xs: 6, sm: 10, md: 16, lg: 24, pill: 999 };

export const motion = {
  duration: { instant: 90, fast: 160, base: 240, slow: 400, hero: 700 },
  spring: {
    snappy: { damping: 22, stiffness: 320, mass: 0.9 },   // taps, toggles
    smooth: { damping: 26, stiffness: 180, mass: 1 },     // sheets, cards
    bouncy: { damping: 14, stiffness: 220, mass: 0.8 },   // celebratory: payment confirmed
  },
  easing: {
    standard: [0.2, 0.0, 0.0, 1.0],
    entrance: [0.0, 0.0, 0.2, 1.0],
    exit: [0.4, 0.0, 1.0, 1.0],
  },
  stagger: 60, // ms between list items, capped at 8 items
} as const;

export const glass = {
  blur: 24,                       // full power
  blurLite: 0,                    // fallback: solid surface
  tintLight: 'rgba(255,255,255,0.62)',
  tintDark: 'rgba(28,31,38,0.56)',
  borderLight: 'rgba(255,255,255,0.55)',
  borderDark: 'rgba(255,255,255,0.10)',
  saturate: 1.6,
} as const;
```

---

## 5. Glassmorphism system

Glass in biblio is a way to show layering and depth. It is not decoration. Apple uses translucency to show that a sheet floats above content, and that is the model. Glass is also expensive on low-end Android, so it is strictly tiered.

### 5.1 Where glass is used

| Surface | Glass? | Why |
|---|---|---|
| Floating tab bar | Yes | Sits above scrolling content; blur shows conversation beneath |
| Bottom sheets and action sheets | Yes | Layering and depth |
| Navigation bar on scroll | Yes (after scroll starts) | Keeps context while scrolling |
| Floating action button (Quick Reply) | Yes | Lightweight, clearly above content |
| AI suggestion card | Yes, with signal tint | Marks AI-generated content as distinct |
| Hero card on Command Center | Yes, over a gradient mesh | The one place glass is showcased |
| Cards in the main list | No | Plain surfaces read faster; glass everywhere is noise |
| Body text blocks | Never | Legibility |
| Money figures on glass | Only over solid backing | Contrast |

**Rule:** no more than two glass layers stacked. Three layers become mud on low-end GPUs and in sunlight.

### 5.2 Glass recipe

Light mode:
- Background: `tintLight` (white at 62%), with `backdrop-filter: blur(24px) saturate(160%)`.
- Border: 1px `borderLight`, plus an inner highlight (top edge, 1px, white at 80%).
- Shadow: `elev-2`.
- Corner radius: `radius-lg` for sheets, `radius-pill` for the tab bar.

Dark mode:
- Background: `tintDark` (near-black at 56%).
- Border: 1px `borderDark` (white at 10%).
- Shadow: deeper, `0 16 48 rgba(0,0,0,0.5)`.

**Contrast rule:** text on glass must pass WCAG AA against the blurred result, not against the tint alone. Test over the busiest background content (for example, a chat thread with photos). If it fails, raise the tint opacity by 8% steps until it passes. Never reduce text contrast to make glass look more transparent.

### 5.3 Noise and gradient backing

Glass looks flat over a plain background. Give it something to refract:

- A soft gradient mesh behind the Command Center hero, built from the palette: ember at low opacity, a touch of signal blue, and paper.
- Two to three large, blurred colour blobs (static images, not animated, to save GPU).
- A subtle grain texture at 3% opacity, pre-rendered as a PNG under 20KB to avoid runtime noise generation.

### 5.4 Progressive enhancement tiers

Detect the device tier at launch and store it. Users can override in Settings.

| Tier | Criteria (approximate) | Glass behaviour |
|---|---|---|
| **Full** | Recent flagship, 6GB+ RAM, no low-power mode | Real blur, saturation, inner highlights, animated mesh |
| **Balanced** | Mid-range, 4GB RAM | Real blur on tab bar and sheets only; static mesh |
| **Lite** | Low-end, under 3GB RAM, or low-power mode on, or 2G/3G-only sessions | No blur. Solid `surface` at 96% opacity with the same border and shadow, so structure remains |

**MUST:** Lite mode looks intentional, not broken. The solid surface keeps the border and shadow so layering still reads.

**MUST:** Glass is disabled automatically when the OS "Reduce Transparency" setting is on, and in the web PWA when `prefers-reduced-transparency` matches.

### 5.5 Web implementation reference

```css
.glass {
  background: rgba(255, 255, 255, 0.62);
  -webkit-backdrop-filter: blur(24px) saturate(160%);
  backdrop-filter: blur(24px) saturate(160%);
  border: 1px solid rgba(255, 255, 255, 0.55);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.8),
    0 8px 24px rgba(15, 17, 21, 0.10);
  border-radius: 24px;
}

@media (prefers-reduced-transparency: reduce) {
  .glass {
    background: #FFFFFF;
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }
}

/* Lite tier, set by JS on <html data-perf="lite"> */
[data-perf="lite"] .glass {
  background: rgba(255, 255, 255, 0.96);
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
}

@media (prefers-color-scheme: dark) {
  .glass {
    background: rgba(28, 31, 38, 0.56);
    border-color: rgba(255, 255, 255, 0.10);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.06), 0 16px 48px rgba(0,0,0,0.5);
  }
}
```

### 5.6 React Native implementation reference

- Use `expo-blur` (`BlurView`) with `intensity` 40 to 60 on iOS, and fall back to a solid view on Android below the Balanced tier, since Android blur support varies by device.
- Never nest two `BlurView` components.
- Wrap glass in a component that reads the perf tier and renders either `BlurView` or a solid `View`, so screens never handle this themselves.

---

## 6. 3D elements

3D in biblio is sparing and purposeful. It adds physical presence to the things that matter (a payment, a product, a cut-out brand object) and never fights for the merchant's attention. Heavy 3D scenes (WebGL, Three.js) are **out of scope for the merchant app**. They drain battery and fail on low-end devices. 3D is achieved through transforms, layering, parallax, and a small set of pre-rendered assets.

### 6.1 The three permitted 3D techniques

**A. Layered depth (CSS / RN transforms).** Cards and sheets sit at different z-depths. Scrolling creates parallax between the background mesh, the content, and floating elements. This is the primary 3D technique and costs almost nothing.

**B. Tilt and perspective (pointer and gyroscope).** Key surfaces tilt subtly toward the touch point or device orientation. Maximum tilt is 6 degrees. Applies to:
- The payment-confirmed card (celebratory moment).
- The hero card on Command Center.
- Cut-out objects on marketing pages.

**C. Pre-rendered 3D objects (sticker and product renders).** Brand objects and product hero images are rendered once as PNG or WebP with transparency (or as a short looped video under 500KB for marketing only). They are never real-time 3D in the app. The brief's "camera for their story" example is the model: a sticker-style object that bridges two layers.

### 6.2 Where 3D is allowed

| Surface | Technique | Max cost |
|---|---|---|
| Command Center hero card | Tilt (B), layered depth (A) | Low |
| Payment confirmed moment | Bouncy spring + tilt, 700ms | Low |
| Product cards in catalog | Subtle layered shadow on press | Negligible |
| Marketing hero (editorial style) | Cut-out object (C), layered overlap | Low |
| Onboarding illustration | Pre-rendered sticker (C) | Low |
| Empty states | Pre-rendered object with gentle float | Low |
| Enterprise dashboards (later) | Depth via layering only | Low |

### 6.3 Where 3D is forbidden

- Real-time 3D scenes or WebGL in the merchant app.
- 3D charts. Flat, precise data visualisation is non-negotiable for financial figures, because 3D bar charts distort values.
- Parallax on the conversation list. It causes motion sickness and hurts scroll performance.
- Anything that rotates continuously in the background.

### 6.4 3D asset rules

- Pre-render at 2x of the largest display size, then compress. Target under 60KB per static object.
- Lighting is soft and top-left, matching the glass highlight direction, so all depth cues agree.
- Shadows under cut-out objects are soft and offset, never hard.
- Every 3D asset has a flat 2D fallback that is used in Lite tier and reduced-motion mode.

---

## 7. Motion and animation

Motion in biblio explains what happened and where things went. It never decorates. Apple's principle applies: motion should feel physical and continuous, and it should make the interface more understandable.

### 7.1 Motion principles

1. **Purposeful.** Every animation answers a question: where did this come from, what changed, what do I do next.
2. **Physical.** Use springs, not linear tweens, for anything the user touches. Things have mass.
3. **Interruptible.** Any animation can be interrupted by a new touch, and the interface responds immediately.
4. **Brief.** Most transitions are under 300ms. Only celebratory moments exceed 500ms.
5. **Respectful.** Motion never blocks the user from acting. Reduced-motion mode removes movement but keeps state changes.

### 7.2 Motion tokens

| Category | Duration | Spring / easing | Example |
|---|---|---|---|
| Micro (tap feedback) | 90 to 160ms | `snappy` | Button press scale to 0.97 |
| Standard (state change) | 240ms | `standard` easing | Toggle, tab switch |
| Sheet and modal | 300 to 400ms | `smooth` spring | Bottom sheet rise |
| Entrance (list items) | 240ms per item, 60ms stagger, max 8 | `entrance` easing | Conversation list loads |
| Celebratory | 700ms | `bouncy` spring | Payment verified |
| Hero (marketing) | 700ms sequence | `entrance` | Editorial hero load |

### 7.3 Core interaction animations

**Tap feedback.** Scale to 0.97 on press-in, spring back on release. Haptic light impact on iOS, and a short vibration on Android where supported.

**Sheet presentation.** Rises from bottom with `smooth` spring. The content behind scales to 0.96 and dims to 40% black. Dismisses on drag with velocity threshold.

**Shared element transition.** A customer's conversation card morphs into the full conversation thread. The avatar and name travel with the motion, so the merchant knows which conversation they opened.

**Pull to refresh.** Custom indicator uses the ember accent. On release, the mark rotates once and settles. Never a generic spinner.

**Skeleton loading.** Shimmer is a single slow pass (1.2s), not a loop, to save battery. Shapes match the final layout, so content appears without jumping.

### 7.4 The autonomous action animations (signature moments)

These are biblio's most important motions because they make the invisible visible.

**Action recorded.** When ACE does something autonomously, a small entry slides into the Activity feed from the top with `entrance` easing. The icon pulses once in signal blue. The entry settles into a calm state.

**Payment verified.** The ₦ amount counts up to the final value over 500ms. The card tilts 4 degrees toward the touch and settles back with a `bouncy` spring. A settled-green check draws itself in 300ms. Total under 700ms.

**Exception raised.** The exception card enters with a single gentle horizontal nudge (4px) and the amber state fades in. It does not flash, shake, or demand attention aggressively. Calm urgency.

**Autonomy boundary changed.** The slider thumb moves with `snappy`. The confirmation text fades in beneath it.

**Undo.** Undoing an autonomous action reverses its motion path rather than simply fading out, so the user sees exactly what is being reversed.

### 7.5 Hero motion sequence (marketing / editorial)

Based on the editorial hero pattern from the reference brief, with the cut-out object added:

1. Headline line 1 rises in (translateY 40px to 0, opacity 0 to 1), 700ms, `entrance`.
2. Description fades in, 400ms, starting at 150ms.
3. Headline line 2 rises in, staggered 150ms after line 1.
4. The photo slides up 40px, 600ms, starting when line 2 is 60% complete.
5. The cut-out object drops in from 24px above with a slight rotation (from -20 degrees to -15 degrees), settles with a `bouncy` spring. Total sequence under 1.6s.

**Reduced motion:** All elements appear at once with a 200ms opacity fade. No movement.

### 7.6 Motion in the conversation

- Incoming messages slide up 8px and fade in over 160ms. They do not bounce.
- Typing indicator is three dots with a staggered 120ms opacity pulse, not a bouncing animation.
- Voice notes show a live waveform at 30fps, reduced to 15fps on Lite tier.
- The composer grows with a 160ms height transition, never jumping.

### 7.7 Performance rules for motion

- **MUST** animate only `transform` and `opacity`. Animating layout properties (width, height, top, left) is banned for runtime motion.
- **MUST** run animations on the native thread in React Native (Reanimated worklets), never on the JS thread.
- **MUST** cap concurrent animations at 4 per screen. Stagger the rest.
- **SHOULD** drop from 60fps to 30fps for non-essential ambient motion on Lite tier. Never drop frame rate on touch-driven motion.
- **MUST** pause all ambient motion when the app is backgrounded.

---

## 8. Layout, grid, and responsiveness

### 8.1 Mobile grid (primary)

- 4-column grid with 16px margins on phones under 400px wide. 6 columns on larger phones and tablets.
- Gutter: 12px.
- Safe-area insets respected on all edges. The tab bar sits above the home indicator.
- Content width max 560px on tablets, centred.

### 8.2 Touch targets

- **MUST** be at least 44 × 44pt (iOS) and 48 × 48dp (Android).
- **SHOULD** keep 8px minimum between adjacent targets.
- Primary actions sit in the thumb zone (bottom third of screen). Destructive actions sit higher and require confirmation.

### 8.3 Web and marketing grid

- 12-column grid, 1440px max content width, 24px margins on desktop, 16px on mobile.
- Editorial hero uses a 2-column split: type spans full width, photo spans full width, description sits in columns 1 to 4.

### 8.4 Breakpoints

| Name | Min width | Behaviour |
|---|---|---|
| `xs` | 0 | Single column, bottom tab bar |
| `sm` | 400 | Larger type scale applies |
| `md` | 768 | Two-pane where useful (list + detail) |
| `lg` | 1024 | Full sidebar navigation on web |
| `xl` | 1280 | Marketing max width |

---

## 9. Components

Each component lists its states and accessibility notes. Build components in Storybook (web) and a shared RN component library so every state is visible before it ships.

### 9.1 Buttons

| Variant | Use | Style |
|---|---|---|
| Primary | One per screen | `ember-500` fill, white text, `radius-pill`, 52px height |
| Secondary | Supporting action | `paper-100` fill, `ink-950` text |
| Tertiary | Low-emphasis | Text only, `ember-600` |
| Destructive | Reject, delete | `alert-600` fill, used only with confirmation |
| Glass | Floating actions | Glass recipe, `ink-950` text |

States: default, pressed (scale 0.97), focused (2px ring, `signal-600`), disabled (40% opacity, still readable), loading (label replaced by a 16px spinner, width locked).

### 9.2 Status badges

Always icon + label + tint.

| Status | Icon | Label | Tint |
|---|---|---|---|
| Verified | Check circle | Verified | settled |
| Pending | Clock | Pending | ink-400 tint |
| Needs review | Eye | Needs review | review |
| AI handled | Sparkle | Handled by ACE | signal |
| Failed | X circle | Failed | alert |

"Handled by ACE" is the brand's signature badge. Use it consistently so merchants learn to recognise autonomous work at a glance.

### 9.3 Cards

- Default card: `paper-0` surface, `radius-md`, `elev-1`, 16px padding.
- Exception card: left 4px accent bar in review amber, and a clear one-sentence reason in `body-strong`.
- Money card: figure in `display`, delta beneath in `caption` with signed colour and arrow.

### 9.4 Conversation bubbles

- Customer messages: `paper-0` on paper background, aligned left.
- Merchant messages: `ink-950` background with white text, aligned right. Dark outgoing bubbles keep a strong, calm contrast in sunlight.
- ACE messages: `signal-50` tint with a small sparkle mark and "ACE" label above. This tells the merchant at a glance who sent it.
- Voice notes: pill shape with play control, waveform, and duration. Show the auto-transcription below in `caption`, with a "Pidgin" or dialect tag when detected.
- Max bubble width: 78% of screen width.
- Timestamps appear on the first message of a group and on tap. Not on every bubble.

### 9.5 Inputs

- Height 52px, `radius-sm`, `paper-0` fill, 1px border `ink-400` at 30%.
- Focus: border becomes `signal-600` at 2px. No glow.
- Numeric keyboard for all money inputs, with ₦ prefix that stays visible while typing.
- Error text appears below in `alert-600` with an icon, never only colour.

### 9.6 Bottom tab bar (glass)

Five tabs maximum: Home (Command Center), Chats (Conversation Hub), Stock (Inventory Oracle), Money (Financial Dashboard), Settings (Autonomous Settings).

- Floating glass pill, 16px from bottom edge, inset 16px from sides.
- Active tab shows a filled icon and label in `ember-600`. Inactive uses `ink-400`.
- Tab badges show counts of exceptions only, not total unread. Badges are amber when they represent exceptions needing a decision.

### 9.7 Sheets

- Rise from bottom, top corners `radius-lg`, grabber at top (36 × 5px, `ink-400` at 40%).
- Maximum height 90% of screen. Content scrolls inside.
- Dismiss by drag, by tapping the scrim, or by the explicit close button.

### 9.8 Charts (flat and precise)

- Line and bar charts only. No 3D.
- Axes labelled with ₦ values in `caption`. Gridlines at 6% opacity.
- Current value is the largest label. Historical comparison in `ink-400`.
- Every chart has a text summary beneath it ("Revenue up ₦120,000 vs last week") for screen readers and quick scanning.
- Colour is never the only encoding; use line style or shape for series.

### 9.9 Empty, loading, and error states

- **Empty:** Pre-rendered sticker object, one headline, one sentence, one primary action. Warm copy: "No orders yet today. Share your shop link and ACE will handle the rest."
- **Loading:** Skeleton matching final layout. Never a blank screen on cold start.
- **Offline:** Persistent but quiet banner at top: "You're offline. Changes will sync when you're back." with the offline icon. Never a modal. Content remains usable from local cache.
- **Error:** Plain language, what happened, what to do next, and a retry. Never a stack trace or error code as the headline.

---

## 10. Screen specifications

### 10.1 Command Center (Home)

**Purpose:** Answer "is my business okay right now?" in under five seconds.

**Layout, top to bottom:**
1. Greeting line in `body`, with the merchant's first name and time-aware copy ("Good evening, Ada").
2. Hero glass card on gradient mesh. Contains:
   - Today's revenue in `display`, with ₦ and tabular numerals.
   - Order velocity meter: a flat, horizontal progress arc showing orders per hour versus the merchant's average. Animated on load, one time only.
   - Tilt on touch (max 6 degrees).
3. Cash flow river: a flat, smooth line chart of money in and money out. Inflows in `settled`, outflows in `ink-700`. Tap to expand.
4. Exception queue (highest priority, always first in the list after the hero):
   - Each exception is a card with the amber accent bar, a one-sentence reason, and one primary action. Example: "2 payments need checking. Tap to review."
5. AI daily briefing: a single signal-tinted card with a sparkle mark. Example: "3 VIP customers haven't ordered in two weeks. Draft check-ins?" Dismissible.
6. Activity feed: the most recent autonomous actions, each with the "Handled by ACE" badge and time.

**Rules:**
- Exceptions are always above activity. Routine success is summarised ("18 orders handled today") rather than listed one by one.
- If there are zero exceptions, show a calm success state: settled-green check and "Nothing needs you right now." This is a moment of relief and should feel like one.

### 10.2 Conversation Hub

**Purpose:** Let the merchant see everything customers are saying, with ACE's work visible, and step in only when needed.

**List view:**
- Each row: avatar (initials on colour if no photo), name, last message preview (one line), timestamp, and the platform icon (WhatsApp, Instagram, Messenger) as a small badge.
- Right side: a status badge ("Handled by ACE" in signal, or "Needs you" in review amber).
- Swipe right to mark as handled. Swipe left for quick actions (call, pause ACE on this chat). Haptic at threshold.
- Filter chips at top: All, Needs you, Handled by ACE, VIP.

**Conversation detail:**
- Header shows customer name, Global Buyer ID as a small caption, LTV in `caption`, and an AI confidence indicator (three-bar meter with label "ACE is confident" / "Check this one").
- A collapsible "What ACE did" strip sits above the thread, listing autonomous actions taken in this conversation. Tap to expand. This is the core transparency feature.
- Composer shows a "Let ACE reply" toggle. When on, the merchant's manual composer is secondary. When off, the composer is primary and ACE is paused for this chat with a clear banner.

### 10.3 Inventory Oracle

**Purpose:** Prevent stock-outs and make restock decisions effortless.

- Top: a single headline for the most urgent item in plain language ("Blue Ankara fabric runs out in 4 days").
- A pre-negotiated restock card for that item, with supplier, quantity, and price, and two actions: "Approve" (primary) and "Adjust" (secondary).
- Below: a list of products with a stock bar. The bar is coloured by days-of-stock remaining (settled above 14 days, amber 4 to 14, alert under 4), always with the number beside it.
- Predictive restock suggestions use the signal tint, because they are AI-generated.
- Low-stock alerts appear as exception cards, never as push-style urgency.

### 10.4 Financial Dashboard

**Purpose:** Make every naira accountable and reconciled.

- Top: net position for the selected period in `display`, with signed delta.
- Period selector as a segmented control: Today, 7 days, 30 days.
- Reconciliation list: each payment channel (bank virtual account, transfer screenshot, card) with a status badge: Verified, Pending, Needs review.
- Receivables section: outstanding amounts with AI-drafted follow-up messages behind a single "Review message" action.
- Margin by product: a flat horizontal bar per product, with margin percentage in tabular numerals.
- Every figure tappable to show its source transaction. Trust depends on being able to trace any number.

### 10.5 Autonomous Settings

**Purpose:** Let merchants define the boundaries of ACE's freedom in plain language.

- Each autonomy rule is a card with a plain-English sentence and a control.
  - Example: "Auto-approve purchases under ₦50,000" with a slider. The current value updates the sentence live.
  - Example: "Auto-apply loyalty discounts up to 8%" with a slider and the same live sentence.
  - Example: "Auto-book riders for verified orders" with a toggle.
- A "What ACE can do without asking" summary at the top, written in full sentences, not toggles. This is the single most important trust surface in the product.
- A "Pause ACE" control is always reachable in one tap from any screen. Pausing shows a persistent banner until resumed.
- Connected accounts (bank, payment, logistics) show status with verified badges and a clear disconnect option.
- Dialect calibration: a simple selector with sample phrases the merchant can listen to.

### 10.6 Customer PWA (inside WhatsApp in-app browser)

**Purpose:** Get a customer from link to paid order in under 60 seconds, on a slow connection, with no app install.

- Designed first for 3G and the WhatsApp in-app browser. The first screen must render in under 2 seconds on a mid-range device.
- Single-column layout. Product images are the hero, compressed hard, with blurhash placeholders.
- Cart and checkout use the same primary button pattern. One primary action at a time.
- Payment screen shows the merchant name, the exact ₦ amount, and the virtual account details in large, copyable type. Copy button is the primary action.
- After payment, the "Payment verified" celebratory moment plays (section 7.4). Keep it under 700ms.
- Works if the data connection drops mid-checkout. Save the cart locally and show a clear "Your cart is saved" state.
- No modals. Use full-screen steps or bottom sheets.
- Glass is used only on the sticky bottom bar (cart total and action), in Balanced or Full tiers.
- Language: short sentences, plain English, and Pidgin where the merchant has enabled it.

### 10.7 Marketing landing page: editorial hero

Reference: the "5 Hero Styles: The Workflow" pattern from the uploaded brief, style 2 (Full-Bleed). This is the default hero for biblio's landing and product pages.

**Structure, desktop 1440px:**
- Nav: small logo top left. A dark pill in the centre with "Join the early access" and a round arrow button. Two or three links on the right.
- Headline line 1, `hero-xl` (160px), line height 0.9, aligned left.
- Short description, 15px to 16px, max 320px wide, tucked under line 1 on the left. Three lines maximum.
- Headline line 2, same size, pushed right so the two lines step down like stairs. The stagger is the design.
- A cut-out object (sticker-style, 3D-rendered, for example a stylised phone with the ACE mark, or a merchant's product) overlapping the gap between headline and photo, rotated -15 degrees.
- Full-width photo filling the bottom half, with 12px rounded corners and 24px side margins, running past the bottom of the viewport. One real photo of a merchant's stall or workspace. Warm, natural light.
- Animation follows section 7.5.
- **No buttons in the hero.** The type and the photo do the work. The call to action lives in the nav pill.

**Style:** Near-black text (`ink-950`) on `paper-50`. No gradients in the hero. Wide grotesk typeface.

**Mobile:** Both lines left-aligned, description under them, photo full width, cut-out object at about 40% width over the photo edge.

**Content for biblio's hero** (draft):
- Line 1: "Your business"
- Line 2: "runs itself."
- Description: "biblio handles your WhatsApp orders, payments, and restocking while you focus on what you make."
- Photo: a real Lagos merchant at work, phone in one hand, fabric or produce on the counter.

### 10.8 Onboarding (merchant)

- Three to four steps maximum, one question per screen.
- Opening screen is the editorial hero style, adapted to the app: large type, warm photo, one primary button.
- Connect WhatsApp, then connect a bank account, then set the first autonomy rule with a friendly default.
- Founder-led onboarding (per the brief) is supported by a "Talk to a person" option on every onboarding step.
- Progress shown as a simple pill indicator, not a percentage bar.

---

## 11. Designing for autonomous AI (trust patterns)

This section matters more than any other, because biblio's core promise is that the AI acts without asking. If merchants do not trust it, they will bypass it.

**Trust principles**

1. **Every autonomous action has a receipt.** Who did it (ACE), what it did, why (one sentence), when, and how to undo. Stored in the conversation and the Activity feed.
2. **Confidence is visible but not anxious.** Show a simple three-bar confidence meter in conversation detail. Never show percentages to merchants, because they invite false precision.
3. **Reasons are plain language.** "Held this order because the payment amount didn't match the price." Not "Validation rule 14 failed."
4. **Undo is always available within a defined window.** Show the window clearly ("Undo available for 10 minutes").
5. **The merchant can always say no.** Every suggestion has a dismiss or decline action. Declining trains the system and the interface says so ("Got it. ACE will check with you next time.").
6. **Failure is honest.** When ACE gets it wrong, the interface says so directly, shows what was affected, and offers the fix. No hedging language, no blame on the customer.
7. **Autonomy is the merchant's decision.** Boundaries are set in Autonomous Settings and visible at all times. Expansion of autonomy requires an explicit merchant action, never a silent default.

**Copy patterns**

- Good: "ACE replied to 14 customers and booked 3 riders. Nothing needs you."
- Good: "ACE held one payment. The amount was ₦2,000 less than the order. Review?"
- Avoid: "AI-powered insights," "Smart," "Magic," or anything that describes the technology instead of the outcome.

---

## 12. Accessibility

- **Contrast:** WCAG AA minimum everywhere. AAA for body text on paper where feasible.
- **Dynamic type:** Support up to 200%. Layouts reflow; nothing is truncated without a way to read the full text.
- **Screen readers:** Every interactive element has a label. Status badges read as "Verified payment" or "Needs review," not just an icon name. Charts have text summaries (section 9.8).
- **Colour:** Never the sole carrier of meaning. Icons, labels, and signed numbers carry it too.
- **Motion:** Reduced motion setting removes movement and keeps state changes. Parallax, tilt, and 3D are disabled. Replaced with opacity fades under 200ms.
- **Transparency:** Reduce transparency setting replaces all glass with solid surfaces.
- **Touch:** Targets as in section 8.2. Swipe actions always have a visible button alternative.
- **Voice input:** The voice note composer is a first-class input, not a fallback. Merchants who cannot type comfortably use it fully.
- **Sunlight legibility:** Test key screens at 50,000 lux equivalent contrast. Dark bubbles and high-contrast text are chosen for this.
- **Language:** Support English and Pidgin UI strings. Do not auto-translate money or legal copy without review.

---

## 13. Performance budgets

These budgets are targets for a mid-range Android device on a 3G-class connection. They are not aspirations.

| Metric | Budget |
|---|---|
| Cold start to interactive (merchant app) | Under 3 seconds |
| Customer PWA first render (3G) | Under 2 seconds |
| Customer PWA total JS on first load | Under 180KB gzipped |
| Single in-app image | Under 80KB |
| Hero image (marketing) | Under 150KB |
| Static 3D or sticker asset | Under 60KB |
| Frame rate, touch-driven motion | 60fps, no drops |
| Frame rate, ambient motion (Lite tier) | 30fps acceptable |
| Animation count per screen | 4 concurrent maximum |
| Offline cache for core screens | Usable for 7 days without sync |

**Rules:**
- Measure on a real low-end Android device in the test lab, not only on the flagship in the office.
- Blur, shadows, and mesh gradients are counted in the frame budget. Profile them.
- Any new visual effect requires a Lite-tier fallback before it merges.

---

## 14. Dark mode

Dark mode is the default for the Autonomous Settings and Financial Dashboard in low-light evening use, and is available everywhere. On OLED screens it saves real battery, which matters to merchants who worry about battery.

- Use the dark palette in section 4. Never pure black (`#000`) for surfaces, because it causes smearing and harsh contrast. Use `#0B0C0F` as the base.
- Elevation in dark mode is shown by lighter surfaces, not by shadows. Surface lightens from `#0B0C0F` to `#15171C` to `#1C1F26`.
- Ember accent is lifted (`#F26A45`) to maintain contrast on dark backgrounds.
- Glass in dark uses the dark tint and deeper shadows (section 5.2).
- Images are slightly dimmed (8%) in dark mode to avoid glare.
- Follow the system setting by default, with a manual override.

---

## 15. Voice and microcopy

**Tone:** Calm, capable, warm, brief. Like a trusted business partner who is good at their job and does not waste your time.

**Rules:**
- Lead with the outcome, not the mechanism. "3 payments verified" not "Payment reconciliation module completed."
- Use "ACE" for the system's actions and "you" for the merchant. Avoid "we" for the system.
- Keep sentences under 15 words where possible.
- Use numerals for money and counts. Words for explanations.
- Pidgin copy is written by native speakers and tested with merchants. Never machine-translated.
- Never use exclamation marks in system messages. Use them sparingly in celebratory moments only.
- Never blame the customer in any message, including exception reasons.

**Word list**

| Use | Avoid |
|---|---|
| Handled, done, settled | Processed, executed, completed successfully |
| Needs you, review | Action required, critical alert |
| Verified | Validated, authenticated |
| Your shop, your customers | Our platform, end users |
| Undo | Revert, rollback |

---

## 16. Platform implementation notes

**React Native (Expo) merchant app**
- Reanimated 3 for all runtime motion, running on the UI thread.
- `expo-blur` for glass, behind the tier wrapper (section 5.6).
- Gesture Handler for swipe and sheet dismissal.
- Expo Image with blurhash placeholders and disk caching.
- Theme provider reads `tokens.ts` and the device perf tier.
- Storybook for React Native (or a component preview screen in dev builds) to review every state.

**Next.js PWA (customer and marketing)**
- CSS variables for tokens, `prefers-color-scheme` and `data-perf` attributes for tiers.
- Framer Motion or CSS transitions for hero and sheet motion. Respect `prefers-reduced-motion`.
- Service worker caches the shell and recent product images. Offline checkout saves cart state locally.
- Subset and preload the display grotesk. Use `font-display: swap` with a metric-matched system fallback to avoid layout shift.
- Pre-rendered 3D objects served as AVIF or WebP with transparency.

**Shared**
- Design tokens are the single source. Changing a token changes both platforms.
- Icons exported from one vector set to both platforms.

---

## 17. Quality checklist (before any screen ships)

- [ ] One primary action, clearly dominant.
- [ ] Money formatted with ₦, tabular numerals, and signed direction where relevant.
- [ ] Every status has icon, label, and tint. Colour is not the only signal.
- [ ] Works offline, with a clear state and no blank screens.
- [ ] Tested on a low-end Android device at 3G-class speed.
- [ ] Lite-tier fallback exists for every glass or 3D element.
- [ ] Reduced-motion and reduced-transparency settings honoured.
- [ ] Text readable at 200% system text size.
- [ ] Touch targets meet minimum size.
- [ ] Contrast passes WCAG AA on light and dark, including over glass.
- [ ] Autonomous actions show a receipt and an undo path where applicable.
- [ ] Copy follows section 15. No jargon, no blame.
- [ ] Animations use only transform and opacity, run on the UI thread, and stay within budget.
- [ ] Images compressed to budget, with placeholders.

---

## 18. Open questions

1. Final brand colour. The ember accent is a proposal. Validate against brand research with Lagos merchants before locking.
2. Display typeface licensing for the marketing site. Confirm the chosen grotesk allows web embedding at expected traffic.
3. Ankara-inspired illustration: commission from a Lagos illustrator, and confirm usage rights.
4. Glass tier thresholds. Calibrate RAM and GPU cut-offs on the actual device mix from pilot merchants.
5. Pidgin UI: confirm scope for launch versus later, and who reviews copy.
6. Founder-led onboarding screens: decide whether they need a video or a voice-note option for merchants who prefer audio.
7. Enterprise dashboards (Year 2): separate design language or extension of this one? Recommend extension, with the same tokens and flat charts.

---

## Appendix A: Reference principles

- **Airbnb:** warmth, photography-led emotion, one clear primary action, trust through verified transparency, modular cards.
- **Apple (HIG):** clarity, deference, depth, direct manipulation, consistency, and physical motion.
- **Glassmorphism:** used for layered depth, tiered for performance, and never used for body text.
- **3D:** transforms, pre-rendered objects, and tilt. No real-time 3D in the merchant app.
- **Editorial hero:** giant stepped type, one real photo, one cut-out object, no buttons in the hero.