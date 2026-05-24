# TicketPilot V2 Motion + Color Playbook

*A no-rewrite plan to make the app feel premium, fast, and cohesive*

---

## 0) TL;DR (what changes, not how your code works)

* **Keep every component as-is.** We only add a **design token layer** (colors/spacing), a **chart palette**, and a **Framer Motion wrapper** using opt-in wrappers (`<m.div>`, `PageShell`, `motionify(Button)`).
* **Unify dark theme** with a tokenized palette (“Midnight Prism”) tailored to support deskside ops UIs: deep neutrals, soft elevation, one vibrant brand accent, desaturated semantic colors (great contrast on dark).
* **Introduce tasteful motion** (200ms default): page fade, card scale-in, list stagger, modal pop, button micro-press—respecting `prefers-reduced-motion`.
* **Data viz palette** matches the UI and keeps focus on the data (not the chrome).

---

## 1) Color: “Midnight Prism” (designed for your screenshots)

Your current screens already lean dark, with plenty of negative space and strong legibility. This palette keeps that feel but **tightens contrast, depth, and consistency**—and gives you a recognizable brand accent (indigo → rose) that looks great on black/blue backgrounds.

### 1.1 Semantic tokens (CSS variables)

> Use these **semantic** tokens everywhere (never raw hex). They’re tuned for dark dashboards, system cards, and modals. Light mode tokens are included to future-proof, but you can ship dark-only first.

```css
:root,
:root[data-theme="v2-dark"] {
  /* Base neutrals (dark mode) */
  --bg:           11 15 23;   /* #0B0F17  | app background (not pure black) */
  --surface:      18 24 38;   /* #121826  | cards/tables */
  --surface-2:    22 29 46;   /* #161D2E  | elevated: modals, popovers */
  --border:       33 42 59;   /* #212A3B  | 1px outlines/dividers */
  --text:        230 237 246; /* #E6EDF6  | high-emphasis */
  --muted:       140 163 192; /* #8CA3C0  | secondary text, meta */

  /* Brand & accents */
  --primary:      91 124 255; /* #5B7CFF  | buttons, key links */
  --primary-2:   255 115 161; /* #FF73A1  | gradient tail / emphasis */
  --primary-fg:  255 255 255; /* #FFFFFF  | text on primary */
  --ring:         91 124 255; /* same as primary for focus ring */

  /* Semantic statuses (slightly desaturated → readable on dark) */
  --success:      34 197 94;  /* #22C55E */
  --warning:     245 158 11;  /* #F59E0B */
  --danger:      239  68  68; /* #EF4444 */
  --info:         56 189 248; /* #38BDF8 */

  /* Overlays */
  --overlay:      0 0 0;      /* rgba(0 0 0 / 0.60) for scrims */
}

/* Optional light mode scaffold (keep tokens consistent) */
:root[data-theme="v2-light"] {
  --bg:          255 255 255; /* #FFFFFF  */
  --surface:     248 250 252; /* #F8FAFC  */
  --surface-2:   241 245 249; /* #F1F5F9  */
  --border:      226 232 240; /* #E2E8F0  */
  --text:         15  23  42; /* #0F172A  */
  --muted:       100 116 139; /* #64748B  */
  --primary:      91 124 255; /* #5B7CFF  */
  --primary-2:   255 115 161; /* #FF73A1  */
  --primary-fg:  255 255 255; /* #FFFFFF  */
  --ring:         91 124 255; /* #5B7CFF  */
  --success:      34 197  94; /* #22C55E  */
  --warning:     245 158  11; /* #F59E0B  */
  --danger:      239  68  68; /* #EF4444  */
  --info:         56 189 248; /* #38BDF8  */
}
```

**Why this works for TicketPilot**

* **Deep greys** (not pure black) avoid “halo” artifacts with white text and reduce eye strain on long sessions (support/ops teams).
* **One strong brand accent** (indigo) + **gradient tail** (rose) gives you modern “AI” energy when needed (hero CTA, highlights) without turning the whole UI neon.
* **Desaturated status colors** remain legible on dark cards and pass typical AA contrast for 14px+ text.
* **Borders on dark** keep structure crisp without heavy shadows.

### 1.2 Tailwind hook-up (one-time)

```ts
// tailwind.config.ts
theme: {
  extend: {
    colors: {
      bg:       'rgb(var(--bg) / <alpha-value>)',
      surface:  'rgb(var(--surface) / <alpha-value>)',
      surface2: 'rgb(var(--surface-2) / <alpha-value>)',
      border:   'rgb(var(--border) / <alpha-value>)',
      text:     'rgb(var(--text) / <alpha-value>)',
      muted:    'rgb(var(--muted) / <alpha-value>)',
      primary:  'rgb(var(--primary) / <alpha-value>)',
      primary2: 'rgb(var(--primary-2) / <alpha-value>)',
      ring:     'rgb(var(--ring) / <alpha-value>)',
      success:  'rgb(var(--success) / <alpha-value>)',
      warning:  'rgb(var(--warning) / <alpha-value>)',
      danger:   'rgb(var(--danger) / <alpha-value>)',
      info:     'rgb(var(--info) / <alpha-value>)',
    },
    borderColor: {
      DEFAULT: 'rgb(var(--border) / 1)',
    }
  }
}
```

### 1.3 Usage rules (short and strict)

* **Primary CTAs** use `bg-primary text-white` and **never** gradients by default.
  Use the `indigo→rose` gradient *sparingly* for **hero-only** (“Start free”) or **special highlights**.
* Cards: `bg-surface border` ; Modals/menus: `bg-surface2 border`.
* Text: use one color (`text-text`) and vary **opacity** for emphasis (`opacity-90 / 70 / 50`) instead of many greys.
* Status: standardize as **lozenges** (e.g., `bg-info/15 text-info`), counts as **badges** (solid).

---

## 2) Motion: tasteful, performant, accessible

### 2.1 Install + provider

```bash
npm i framer-motion
```

```tsx
// src/ui/motion/MotionProvider.tsx
'use client'
import { LazyMotion, domAnimation, MotionConfig } from 'framer-motion'

export default function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user" transition={{ duration: 0.20, ease: [0.2, 0.8, 0.2, 1] }}>
        {children}
      </MotionConfig>
    </LazyMotion>
  )
}
```

```tsx
// app/layout.tsx
import MotionProvider from '@/ui/motion/MotionProvider'
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html className="dark" data-theme="v2-dark">
      <body className="bg-bg text-text">
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  )
}
```

### 2.2 Motion tokens (variants)

```ts
// src/ui/motion/variants.ts
export const durations = { fast: 0.12, base: 0.20, slow: 0.28 }
export const easings   = { standard: [0.2, 0.8, 0.2, 1] as const }

export const v = {
  fade:     { initial: { opacity: 0 },           animate: { opacity: 1 },           exit: { opacity: 0 } },
  fadeUp:   { initial: { opacity: 0, y: 8 },     animate: { opacity: 1, y: 0 },     exit: { opacity: 0, y: 8 } },
  scaleIn:  { initial: { opacity: 0, scale: .98 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: .98 } },
  slideInR: { initial: { x: 24, opacity: 0 },    animate: { x: 0, opacity: 1 },     exit: { x: 24, opacity: 0 } },
  list:     { animate: { transition: { staggerChildren: 0.04 } } },
  item:     { initial: { opacity: 0, y: 6 },     animate: { opacity: 1, y: 0 } },
}
```

### 2.3 Patterns (no component rewrites)

**Page fade**

```tsx
'use client'
import { m } from 'framer-motion'
import { usePathname } from 'next/navigation'
import { v, durations, easings } from '@/ui/motion/variants'

export function PageShell({ children }: { children: React.ReactNode }) {
  const key = usePathname()
  return (
    <m.main key={key} {...v.fade} transition={{ duration: durations.base, ease: easings.standard }}>
      {children}
    </m.main>
  )
}
```

Wrap page content with `<PageShell>`.

**Cards**

```tsx
import { m } from 'framer-motion'
import { v } from '@/ui/motion/variants'

<m.div className="bg-surface border rounded-xl" {...v.scaleIn}>
  {children}
</m.div>
```

**Rep queue (stagger)**

```tsx
<m.div variants={v.list} initial="initial" animate="animate">
  {tickets.map(t => (
    <m.div key={t.id} variants={v.item}>
      <TicketCard ticket={t} />
    </m.div>
  ))}
</m.div>
```

**Buttons (hero only, opt-in)**

```tsx
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
const MButton = motion(Button)

<MButton whileTap={{ scale: .98 }} whileHover={{ y: -1 }} className="bg-primary text-white">
  Start free
</MButton>
```

**Modals (Radix / shadcn)**

```tsx
<DialogContent asChild>
  <m.div {...v.scaleIn} className="bg-surface2 border rounded-xl p-6" />
</DialogContent>
```

**Skeletons**

```tsx
<m.div {...v.fade} className="bg-surface border rounded-xl animate-pulse h-32" />
```

**Rules of motion**

* 150–300ms, default **200ms**.
* Don’t animate color/contrast; keep AA intact.
* Respect `prefers-reduced-motion` (already configured).

---

## 3) Data-viz palette (Recharts/Chart.js/ECharts friendly)

Keep visuals quiet, data loud.

* **Series 1** `rgb(var(--primary))`
* **Series 2** `rgb(var(--primary-2))`
* **Series 3** `rgb(var(--info))`
* **Series 4** `rgb(var(--success))`
* **Series 5** `rgb(var(--warning))`

Use `border` for grid/axes (low alpha), `muted` for labels.
Charts live on `surface`; tooltips use `surface2`.

Suggested mappings:

* **Ticket Volume Trend** → **Line** (S1)
* **Response Time Distribution** → **Donut** (S2/S3/S4)
* **Top Categories** → **Horizontal Bars** (S1)
* **Rep Performance** → **Table + inline bars** (S1)

---

## 4) Typography, spacing, elevation (quick spec)

* **Font:** Inter (variable).
  Headings: 700/600; Body: 400/500; avoid ultra-light weights on dark.
* **Scale:** 48/36/24/20/16/14/12 with generous line-heights (56/44/32/28/24/20/16).
* **Opacity for emphasis:** 90% / 70% / 50% on `text-text`.
* **Grid:** 4-pt spacing only (4,8,12,16,24,...).
* **Elevation:**

  * Level 0: `bg-bg`
  * Level 1: `bg-surface border` (cards)
  * Level 2: `bg-surface2 border` (modals/menus)
    Shadows minimal; depth comes from lighter surfaces + borders.

---

## 5) Status semantics (badge vs lozenge)

* **Badge (numbers):** small, solid (e.g., `bg-danger text-white` → “2 Issues”).
* **Lozenge (states):** `rounded-full px-2 py-0.5 bg-info/15 text-info`

  * Ticket: Open=info, In-Progress=warning, Resolved=success, Escalated=danger
  * Role: admin=primary, rep=muted, customer=muted
  * Priority: Low=muted, Normal=info, High=warning, Urgent=danger

---

## 6) Implementation plan (low-risk, incremental)

**Step 1 — Tokens**

* Add CSS variables (above) to `globals.css`.
* Wire Tailwind color entries.

**Step 2 — Provider**

* Add `MotionProvider` in `app/layout.tsx`.

**Step 3 — PageShell**

* Wrap each page with `<PageShell>`.

**Step 4 — Quick motion wins**

* Wrap dashboard/analytics/rep cards with `<m.div {...v.scaleIn}>`.
* Stagger rep queue.
* Motionify only the **hero CTA**.

**Step 5 — Status cleanup**

* Convert counts → **Badges**, states → **Lozenges** (utility classes only).

**Step 6 — Charts**

* Apply series + axis palette; move charts onto `surface`, tooltips on `surface2`.

**Step 7 — QA passes**

* Color contrast (AA for 14px+, check a few high-traffic screens).
* `prefers-reduced-motion` verified.
* Keyboard focus visible (`:focus-visible`) and trapped in dialogs.
* No layout shift on animations (avoid `height:auto` transitions).

---

## 7) Drop-in snippets you can copy today

**Global surface helpers (optional)**

```css
/* globals.css */
[data-surface="1"] { background: rgb(var(--surface));   border: 1px solid rgb(var(--border)); }
[data-surface="2"] { background: rgb(var(--surface-2)); border: 1px solid rgb(var(--border)); }
```

**Hero gradient utility**

```css
.ticketpilot-gradient {
  background: linear-gradient(90deg, #5B7CFF 0%, #FF73A1 100%);
}
```

**Focus ring (one class to rule them all)**

```css
.focus-ring:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px rgb(var(--ring) / .5);
}
```

---

## 8) Acceptance criteria (what “done” looks like)

* All pages use `bg-bg`, cards use `bg-surface border`, modals use `bg-surface2 border`.
* Primary actions are **indigo** (`bg-primary`), not gradients, except hero CTA.
* Rep queue visually breathes (stagger), page navigation **fades**, modals **scale-in**.
* Charts adopt the series palette; grid/axes are muted.
* Status chips are consistent; “Issues” uses a numeric badge.
* `prefers-reduced-motion` disables nonessential animations.
* Lighthouse a11y score ≥ 95 on the main pages.

---Awesome—here’s the extra **frontend-only info** you should hand to the AI agent builder so it can do the visual revamp **without breaking anything**.

# What the agent must know (fill these in once, don’t make it guess)

* **Repo facts:** package manager (npm/pnpm/yarn), Node version (`.nvmrc`), framework (Next.js App Router), TypeScript on/off, Tailwind on/off, uses **shadcn/ui + Radix + Lucide** (yes).
* **Run commands:** `dev`, `build`, `lint`, `typecheck`, `test` (exact scripts).
* **Where styles live:** paths to `globals.css`, `tailwind.config.ts`, any theme file, any CSS Modules.
* **Pages & entry shells:** where page roots are (`app/**/page.tsx`), the app layout (`app/layout.tsx`) and any per-page shells.
* **Chart lib & wrappers:** (Recharts/Chart.js/ECharts) + where chart theme is set.
* **Critical routes/components to leave untouched:** auth, navbar/sidebar layout, table virtualization, any `position: sticky` headers, any virtualization (react-virtual).
* **Feature flags / env:** add `NEXT_PUBLIC_THEME_V2=1` (optional) and `data-theme="v2-dark"` toggle location (root `<html>`).

# Hard guardrails (agent must follow)

* **Do not** change component logic, props, routes, API calls, or data fetching.
* **No layout shifts**: only animate **opacity/transform**, never height/width or top/left.
* **SSR-safe motion:** motion wrappers live in **Client** components only (`'use client'`), never in server layouts.
* **Keep specificity low:** add tokens via CSS variables and Tailwind theme; no `!important`, no global resets.
* **Accessibility first:** keep `:focus-visible` rings, don’t remove keyboard traps from dialogs, keep aria-labels on icon buttons.
* **Atomic changes only:** tokens → provider → wrappers; one PR per step.
* **Zero visual drift for disabled users:** honor `prefers-reduced-motion`.

# Allowed edits (and only these)

1. Add **CSS variables** (Midnight Prism) to `globals.css`.
2. Extend **Tailwind theme** to map `rgb(var(--token))` colors.
3. Add **Framer Motion** provider + variants files; wrap pages with a `PageShell` and **opt-in** card wrappers.
4. Add small **utility classes** for badges/lozenges (status chips) and a shared **focus ring** class.
5. Set **chart palette** to provided tokens.

> No refactors, no prop/API changes, no markup churn inside complex components.

# Do-not-touch list

* Any files in `/backend`, `/api`, `lib/supabase*`, RAG/FAISS code.
* Routing structure in `app/**` (no renames/moves).
* Any `@/components/ui/*` logic or Radix primitive structure (styling wrappers only).
* Table virtualization or scroll containers (`overflow`/`position` behavior).

# File map (tell the agent exact locations)

* `app/layout.tsx` (root layout to mount Motion provider & theme attribute).
* `src/ui/motion/MotionProvider.tsx`, `src/ui/motion/variants.ts`, `src/ui/motion/PageShell.tsx` (new).
* `styles/globals.css` (or your path) for tokens/ring utilities.
* `tailwind.config.ts` for color mapping.
* Pages you want wrapped:

  * Dashboard `/dashboard/page.tsx`
  * Analytics `/admin/analytics/page.tsx`
  * Admin Panel `/admin/page.tsx`
  * Rep Console `/rep/page.tsx`
  * Knowledge Base `/kb/page.tsx`

# UI conventions the agent must respect

* **Surfaces:** pages `bg-bg`, cards `bg-surface border`, modals/menus `bg-surface2 border`.
* **Text:** `text-text` with opacity for hierarchy (90/70/50)—don’t introduce new greys.
* **Primary CTA:** `bg-primary text-white`; gradient only for hero/marketing accent.
* **Icons:** inherit `currentColor`; sizes 16 (inline) / 20–24 (standalone).
* **Spacing:** 4-pt scale only; no arbitrary px unless multiples of 4.
* **Radii/shadows:** keep current radii; use borders to define elevation on dark (shadows minimal).

# Motion conventions

* Defaults: **200ms**, easing `[0.2, 0.8, 0.2, 1]`, reduced-motion respected.
* Patterns to use only:

  * Page **fade** on route change (`PageShell`).
  * Card **scale-in** on first paint.
  * List **stagger** for ticket/row lists.
  * Modal **fade+scale** via Radix `asChild`.
  * Button **press** (hero CTA only): `whileTap={{ scale:.98 }}`.
* Never animate chart data values or focus styles.

# Rollout + safety checklist (agent must include with PR)

* ✅ Builds clean: `typecheck`, `lint`, `build` pass.
* ✅ Contrast AA for body text on `surface`.
* ✅ `prefers-reduced-motion` tested.
* ✅ Focus ring visible & dialogs trap focus.
* ✅ No CLS (layout shift) in interaction profiles.
* ✅ Snapshot before/after of each edited page.
* ✅ `SUMMARY.md` listing files touched + why.

---

## Paste-this Addendum to your Agent Prompt

```
CONTEXT (Frontend only):
- You will apply a visual layer (colors + motion) without altering app logic, routes, or component APIs.
- Use semantic color tokens and Framer Motion wrappers as described below.
- All changes must be opt-in and safely revertible.

ABSOLUTE RULES:
- No prop/logic changes. No route/file moves. No backend/API edits.
- Only add CSS variables, Tailwind theme entries, motion provider/variants, and wrapper elements.
- Client-only for framer components. Animate opacity/transform only.
- Keep a11y intact: :focus-visible rings, dialog traps, aria-labels.

TASKS:
1) Add “Midnight Prism” tokens to globals.css (as CSS variables).
2) Map tokens in tailwind.config.ts using rgb(var(--token)).
3) Install framer-motion; create MotionProvider + variants with reducedMotion="user".
4) Wrap page content in PageShell (fade). Wrap top-level cards with scaleIn. Add list stagger in Rep queue.
5) Provide utilities for badges (numeric) and lozenges (states) using semantic colors; apply only where trivial.
6) Set chart series/axes/tooltip colors to tokens; do not rework charts.
7) Verify contrast, reduced-motion, focus, no layout shift; add SUMMARY.md with files changed & checklist.

ALLOWED FILES TO EDIT:
- app/layout.tsx
- styles/globals.css (or equivalent)
- tailwind.config.ts
- app/**/page.tsx (wrapping only)
- src/ui/motion/{MotionProvider.tsx, variants.ts, PageShell.tsx} (new)

DO-NOT-TOUCH:
- Component logic/props, API calls, routes, backend, RAG code, virtualization.

OUTPUT:
- A single PR with minimal diffs, passing typecheck/lint/build, plus SUMMARY.md.
```

Give the agent builder this bundle and it’ll have everything needed to apply the new palette + motion **safely** with zero risk to functionality.


## 9) “Agent-ready” prompt (give this to your AI agent)

```
You are working in the TicketPilot repo. Your goal is to apply a no-rewrite visual upgrade (colors + motion) based on the “Midnight Prism” dark design system and Framer Motion. Do not refactor components; only add tokens, wrappers, and utilities.

Scope:
1) Add semantic color tokens and Tailwind bindings
   - Insert the provided CSS variables into globals.css.
   - Update tailwind.config to map rgb(var(--token)) colors (bg, surface, surface2, border, text, muted, primary, primary2, ring, success, warning, danger, info).
   - Do not replace component internals; ensure existing classes still render. New components must use tokens.

2) Add Framer Motion provider and variants
   - `npm i framer-motion`
   - Create `src/ui/motion/MotionProvider.tsx` with LazyMotion + MotionConfig (reducedMotion="user", default duration .20s).
   - Wrap `app/layout.tsx` body with `<MotionProvider>`.

3) Page fade + card scale-in + rep queue stagger
   - Create `src/ui/motion/variants.ts` with {fade, fadeUp, scaleIn, list, item}.
   - Create `PageShell` and wrap each page’s main content.
   - Change only the outermost card wrappers to `<m.div {...v.scaleIn}>`.
   - In the Rep Console ticket list, apply parent `variants={v.list}` and child `variants={v.item}`.

4) Modal entry/exit
   - For Radix Dialog/Sheet, use `<DialogContent asChild>` and wrap with `<m.div {...v.scaleIn}>`.

5) Status standardization
   - Introduce utilities for badges (numeric) and lozenges (states) using semantic tokens (info/success/warning/danger/primary).
   - Replace ad-hoc styles in Admin/User/Tickets/Rep Console to use these utilities (no prop API changes).

6) Chart theming
   - Ensure charts use:
     - Series: primary, primary2, info, success, warning
     - Axes/Grid: border/muted (low alpha)
     - Tooltip container: surface2 + border

7) QA & Accessibility
   - Verify AA contrast for body text (≥4.5:1 on surface).
   - Respect prefers-reduced-motion: animations are disabled or minimized.
   - Focus ring uses ring token on :focus-visible; dialogs trap focus.

Deliverables:
- Modified: globals.css, tailwind.config, app/layout.tsx
- New: src/ui/motion/{MotionProvider.tsx, variants.ts}, optional PageShell
- Minimal diffs to pages to apply wrappers; no component prop changes.
- A short SUMMARY.md listing files touched and a checklist of Acceptance Criteria met.

If any step risks a component rewrite, stop and propose an alternative that achieves the visual goal with wrappers or utility classes only.
```

---

If you want, I can also produce a **one-screen visual reference** (tokens, gradients, example cards/buttons/chips on a single page) so devs and designers can eyeball everything in one place.
