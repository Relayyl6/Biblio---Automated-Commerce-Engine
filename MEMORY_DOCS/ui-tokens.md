# UI Tokens — ACE / Biblio

> Last updated: 2026-06-23. **Extracted from the existing UI code** (merchant-app
> `settings.tsx`/`catalog.tsx`/`index.tsx`, admin-portal `App.tsx`). There is currently
> **no shared token file** — colors are inlined per screen. This document is the
> canonical palette; the next refactor should centralize these into a `theme.ts`
> (RN) and CSS variables (web). Until then, use these exact values for consistency.

## Brand palette (green commerce theme)

| Token | Hex | Usage |
|---|---|---|
| `--green-primary` | `#0b6b3a` | Primary buttons, active chips, badges, accents |
| `--green-ink` | `#0b3a22` | Primary text / headings on light bg |
| `--green-muted` | `#5a6b62` | Secondary text, labels, table headers |
| `--bg-app` | `#f4f6f5` | App / screen background |
| `--bg-surface` | `#ffffff` | Cards, inputs, table body |
| `--border-strong` | `#cdd6d1` | Input borders |
| `--border` | `#e3e8e5` | Card borders, table head rule |
| `--border-subtle` | `#eef2f0` | Table row dividers |
| `--on-primary` | `#ffffff` | Text/icon on green primary |

> Note: a couple of disabled/secondary greens appear as `#0b6b3a` at reduced opacity
> (`opacity: 0.5` for inactive products). Keep using opacity rather than new hexes.

## Typography

| Token | Value | Usage |
|---|---|---|
| Font (web) | `system-ui, sans-serif` | Admin portal base |
| Font (RN) | platform default (no custom font loaded yet) | Merchant app |
| Heading | `fontWeight: 700` | Section titles, button labels |
| Label | `fontSize: 12–13, fontWeight: 700, color: --green-muted` | Field labels |
| Body | `fontSize: 14–15, color: --green-ink` | Inputs, table cells |

## Radii & spacing

| Token | Value | Usage |
|---|---|---|
| `radius-pill` | `20px` | Chips, badges |
| `radius-card` | `12–14px` | Cards |
| `radius-control` | `8–12px` | Buttons, inputs |
| `space-screen` | `20–24px` | Screen/page padding |
| `space-card` | `16–18px` | Card padding |
| `space-gap` | `8px` | Inline gaps between controls/chips |
| `space-field` | `14px` | Vertical gap between form fields |

## Currency / number formatting

- Always render money as `₦` + `Number(value).toLocaleString()` (e.g. `₦28,500`).
- Money values are NGN integers in the data layer; format only at display.

## Migration note

When centralizing: RN → a `theme` object imported by screens; web (admin-portal, future
PWA, `ace-platform/web-app`) → CSS custom properties `:root { --green-primary: … }`.
The `ace-platform` design docs reference `var(--font-mono)` and a dark code theme for
developer surfaces — that's a separate (Phase-2) surface, not the merchant palette above.
Keep merchant-facing surfaces on the green palette; keep internal/dev dashboards neutral.