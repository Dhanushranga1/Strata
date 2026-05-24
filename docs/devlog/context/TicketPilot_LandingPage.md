awesome — let’s lock in a gorgeous, conversion-focused landing page for TicketPilot using **HeroUI** (formerly NextUI), plus Tailwind v4 and Framer Motion. Below is:

1. a **super-detailed build spec (Markdown)** your agent can follow exactly, and
2. a **ready-to-paste agent prompt** that tells it what to do, in what order.

---

# TicketPilot – Marketing Landing Page (HeroUI) Build Spec

## Purpose & scope

* **Page:** `/` (public, marketing only; no main app nav)
* **Single goal (MWA):** Start free trial → `/signup` (secondary: Request a demo → `/demo`)
* **Stack:** Next.js 15 (App Router) + Tailwind **v4** + **HeroUI** + Framer Motion
* **Constraint:** Marketing UI must not break authenticated app UI. Isolate styles & components to a “marketing” segment.
* **Brand tokens:** Reuse the product identity from design system (Geist + Inter, blue/pink palette), but implement with HeroUI primitives.

---

## 0) Dependencies & integration

### Install

```bash
# from /frontend
npm i @heroui/react framer-motion @studio-freight/lenis
# (you already have lucide-react)
```

> HeroUI is the new identity of NextUI; it’s a Tailwind-based, React Aria–powered component library. Install from `@heroui/react` and use with Tailwind v4 or v3. ([HeroUI (Previously NextUI)][1])

### Tailwind v4 + HeroUI setup

Tailwind v4 prefers CSS-first. You can use **either** approach:

**A) Tailwind v4 “no config file” (recommended):**

1. Create `hero.ts` in your project root:

```ts
// hero.ts
export { heroui } from "@heroui/react";
```

2. In `src/app/globals.css` (or your main CSS), add Tailwind v4 directives and the HeroUI plugin:

```css
@import "tailwindcss";
@plugin "@heroui/react";
/* Your tokens (colors, radii, shadows) via :root CSS vars here */
```

> HeroUI’s Tailwind v4 guide: v4 de-emphasizes `tailwind.config.js`; you can register the heroui plugin via CSS or a `hero.ts` helper. ([HeroUI (Previously NextUI)][2])

**B) Using `tailwind.config.js` (if your repo still uses v3 or you prefer config):**

```js
// tailwind.config.js
import { heroui } from "@heroui/react";
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [heroui()],
};
```

> HeroUI theming/setup via plugin in Tailwind config is still supported. ([HeroUI (Previously NextUI)][3])

### Fonts

Use Next.js fonts:

```ts
// src/app/(marketing)/layout.tsx
import { Geist, Inter } from "next/font/google";
const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
```

In `<html>` or `<body>` add: `className={`\${geist.variable} \${inter.variable} font-inter`}`.

### Framer Motion

Install is above; Motion components must be **Client**. Keep animations light to avoid hydration mismatch. (React 19/Next 15 + Motion is fine; just isolate to client components.) ([GitHub][4])

---

## 1) Marketing segment & file layout

Create a **marketing slot** to isolate from the app:

```
src/
  app/
    (marketing)/
      layout.tsx      // marketing-only <html><body> wrapper
      page.tsx        // the landing page
      components/
        Hero.tsx
        ValueProps.tsx
        SocialProof.tsx
        HowItWorks.tsx
        CTA.tsx
        Footer.tsx
    (public)/
      login/...
      signup/...
    (protected)/
      ... (existing app)
```

* The **marketing layout must not include** app navigations/guards.
* Keep **no main nav** on the landing page (singularity of purpose). If needed, a tiny top-right “Log in” text link is allowed.

---

## 2) Brand tokens (CSS variables)

Add to `globals.css` (works with Tailwind v4):

```css
:root {
  /* Light */
  --bg: 248 249 250;        /* #F8F9FA */
  --surface: 255 255 255;   /* #FFFFFF */
  --text: 17 24 39;         /* slate-900 */
  --muted: 100 116 139;     /* slate-500 */
  --brand: 59 130 246;      /* #3B82F6 */
  --accent: 236 72 153;     /* #EC4899 */
  --success: 34 197 94;     /* #22C55E */
  --warning: 249 115 22;    /* #F97316 */
  --danger: 239 68 68;      /* #EF4444 */

  --radius: 16px;
  --shadow-md: 0 8px 30px rgba(2,12,27,0.06);
}

:root.dark {
  --bg: 17 18 20;           /* #111214 */
  --surface: 26 27 30;      /* #1A1B1E */
  --text: 226 232 240;      /* slate-200 */
  --muted: 148 163 184;
}
```

Use Tailwind arbitrary RGB: `text-[rgb(var(--text))] bg-[rgb(var(--surface))]`.

---

## 3) Content blueprint (TicketPilot-specific)

**Hero (above the fold)**

* **H1:** “Resolve customer tickets 2× faster with AI that cites your docs.”
* **Sub:** “TicketPilot pairs a battle-tested ticketing core with Gemini-powered answers that include sources from your knowledge base. Escalate with one click when confidence is low.”
* **Primary CTA:** “Start Free” → `/signup`
* **Secondary CTA (ghost):** “Watch 90-sec demo” → opens modal video
* **Hero visual:** looped UI reel (screen recording: Create ticket → Ask AI → citations → escalate); use MP4/WebM, no audio.

**Value props (3–4 cards)**

* **AI that shows its work:** RAG over your docs with citations.
* **Rep Console that scales:** Lanes, assignment, priorities, escalation.
* **Zero-friction knowledge ingest:** PDF, DOCX, MD, TXT → chunk → embed.
* **Enterprise-grade controls:** Roles (customer/rep/admin), audit trail.

**How it works (3 steps)**

1. Ingest docs → vectors
2. Ask AI inside a ticket → cited answer + confidence
3. Click “Escalate” when needed → rep lane picks it up

**Social proof**

* Logos row (placeholders)
* 2 short testimonials with metrics (“40% faster resolution”, etc.)

**Final CTA**

* Repeat primary CTA; reassure “No credit card required.”

**Footer**

* Tiny links: Privacy • Terms • Status • Contact

---

## 4) HeroUI component mapping

* **Buttons:** `import { Button } from "@heroui/react"`

  * Primary: `color="primary"` (override to brand blue)
  * Ghost/secondary: `variant="ghost"`
* **Cards:** `Card`, `CardHeader`, `CardBody`, `CardFooter`
* **Chip/Badge:** `Chip` for “New”, “AI-Powered”
* **Modal (for demo video):** `Modal`, `ModalContent`, `ModalBody`
* **Accordion (FAQs, optional):** `Accordion`, `AccordionItem`
* **Input (demo form, optional):** `Input`
* **Grid:** Use responsive flex/grid from Tailwind; wrap content in `<section>` with max-width container.

> HeroUI exports Button, Card, Modal, etc., as Tailwind-styled, accessible components built on React Aria. Style via props or `classNames` slots. ([HeroUI (Previously NextUI)][5])

---

## 5) Section scaffolds (TSX snippets)

> Keep Motion code in **Client** components (`"use client"`). Keep the page itself a Server Component and import client sections.

### 5.1 Hero.tsx

```tsx
"use client";

import { Button, Chip } from "@heroui/react";
import { motion } from "framer-motion";

export default function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      <div className="mx-auto max-w-6xl px-6 py-20 text-center">
        <div className="mb-6 flex justify-center">
          <Chip color="success" variant="flat">AI with citations</Chip>
        </div>

        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-5xl md:text-6xl font-bold tracking-tight text-[rgb(var(--text))]"
        >
          Resolve customer tickets 2× faster with AI that cites your docs.
        </motion.h1>

        <p className="mx-auto mt-4 max-w-3xl text-lg text-[rgb(var(--muted))]">
          TicketPilot pairs a battle-tested ticketing core with Gemini-powered answers that include sources from your knowledge base. Escalate with one click when confidence is low.
        </p>

        <div className="mt-8 flex items-center justify-center gap-3">
          <Button color="primary" size="lg" className="px-7" as="a" href="/signup">
            Start Free
          </Button>
          <Button variant="ghost" size="lg" className="px-7" as="a" href="#demo">
            Watch 90-sec demo
          </Button>
        </div>

        {/* Hero video */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mx-auto mt-12 max-w-5xl rounded-[var(--radius)] shadow-[var(--shadow-md)] overflow-hidden"
        >
          <video
            className="w-full h-auto"
            src="/videos/hero-reel.mp4"
            autoPlay
            loop
            muted
            playsInline
            aria-label="TicketPilot overview demo"
          />
        </motion.div>
      </div>
    </section>
  );
}
```

### 5.2 ValueProps.tsx

```tsx
"use client";

import { Card, CardBody, CardHeader } from "@heroui/react";
import { motion } from "framer-motion";
import { Book, CircuitBoard, Inbox, Shield } from "lucide-react";

const items = [
  { icon: Book, title: "AI that shows its work", desc: "Gemini answers with citations from your docs via RAG." },
  { icon: Inbox, title: "Rep console that scales", desc: "Queues, assignment, priorities, escalation tracking." },
  { icon: CircuitBoard, title: "Zero-friction ingest", desc: "PDF/DOCX/MD/TXT → chunk → embed. Done." },
  { icon: Shield, title: "Enterprise controls", desc: "Role-based access, audit, secure by default." },
];

export default function ValueProps() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {items.map(({ icon: Icon, title, desc }) => (
          <motion.div key={title} initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <Card className="h-full bg-[rgb(var(--surface))]">
              <CardHeader className="flex items-center gap-3">
                <Icon className="h-5 w-5 text-[rgb(var(--brand))]" />
                <h3 className="font-semibold">{title}</h3>
              </CardHeader>
              <CardBody className="text-[rgb(var(--muted))]">{desc}</CardBody>
            </Card>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
```

*(Similar small components for SocialProof, HowItWorks, CTA, Footer—follow the spec above.)*

---

## 6) Styling & theming with HeroUI

* Prefer component props (e.g., `color`, `variant`) first.
* For deeper control, use `className` or `classNames={{ slot: "…" }}` to target slots. ([HeroUI (Previously NextUI)][6])
* Create a tiny theme shim so `color="primary"` maps to brand blue. If using Tailwind v4 CSS-first, define:

```css
/* heroui theme tokens */
:root {
  --heroui-primary: 59 130 246; /* maps to your brand */
}
```

(You can also theme via plugin config if using `tailwind.config.js`.) ([HeroUI (Previously NextUI)][3])

---

## 7) Accessibility & performance

* **No main nav**; include only a “Log in” link if required (top-right).
* **Heading order** is linear (`h1` → `h2` etc.).
* **Buttons** not links for CTAs unless navigation only (we use `<a>` inside Button for correct semantics).
* **Video**: `muted`, `playsInline`, `aria-label`, and ensure a poster image for LCP.
* **Motion**: Respect reduced motion; gate animations:

```ts
const prefersReduced = useReducedMotion();
<motion.div animate={prefersReduced ? {} : { opacity: 1, y: 0 }} />
```

* **Hydration safety:** Do not call `Date.now()` or read `window` in Server Components. Keep all animated sections as `"use client"` components.
* **Images:** Use `next/image` with `priority` for hero poster; lazy-load below-the-fold assets.

---

## 8) Analytics & events

* Add click tracking for:

  * `CTA:StartFree` (hero & footer)
  * `CTA:WatchDemo`
* Capture simple UTM passthrough and store in query/session for attribution.

---

## 9) SEO & metadata

In `src/app/(marketing)/layout.tsx`:

```ts
export const metadata = {
  title: "TicketPilot — AI Customer Support that Cites Your Docs",
  description: "Resolve tickets 2× faster with Gemini-powered answers, RAG citations, and a rep console built for scale.",
  openGraph: { title: "...", description: "...", url: "https://ticketpilot.app", type: "website" }
};
```

---

## 10) QA checklist

* [ ] Page loads < 2.5s on 4G (Lighthouse)
* [ ] CLS < 0.1; no layout jumps
* [ ] Motion disabled under “Reduce motion”
* [ ] Hero CTA navigates to `/signup`
* [ ] Demo modal opens/closes with focus-trap
* [ ] Mobile: 360px width tested; buttons are thumb-friendly
* [ ] No hydration mismatch warnings in console
* [ ] Dark mode legible (if your global theme toggler is present)

---

## 11) A/B toggles (simple)

Support a query param to switch hero copy:

```ts
// in page.tsx (Server)
const copyVariant = searchParams?.ab === "b" ? "b" : "a";
```

* **A:** “Resolve customer tickets 2× faster …”
* **B:** “Ship accurate replies in seconds — with sources.”

---

## 12) Install & run (summary)

```bash
# 1) add deps
npm i @heroui/react framer-motion @studio-freight/lenis

# 2) Tailwind v4 CSS-first plugin
#   add @plugin "@heroui/react" to globals.css (or use tailwind.config.js)

# 3) add marketing files (layout/page/components)

# 4) dev
npm run dev
```

> HeroUI install & Next.js usage references. ([HeroUI (Previously NextUI)][7])

---

# Agent Prompt — “Build the TicketPilot Landing Page (HeroUI)”

**You are a senior Next.js engineer.** Using the spec above and the existing TicketPilot repo:

**Goals**

1. Create a public, conversion-focused landing page at `/` using **HeroUI** + Tailwind v4 + Framer Motion.
2. Keep it **isolated** from the authenticated app UI (no main nav; only an optional “Log in” text link).
3. Implement sections, copy, tokens, and behaviors exactly as specified.

**Do:**

* Install deps: `@heroui/react framer-motion @studio-freight/lenis`.
* Wire **HeroUI** for Tailwind v4 using CSS-first plugin (`@plugin "@heroui/react"`) OR fall back to `tailwind.config.js` plugin if the project still uses v3.
* Add a marketing segment at `src/app/(marketing)/…`:

  * `layout.tsx`: fonts, body classes, `<ThemeProvider>` only if already present globally.
  * `page.tsx`: server file that composes client sections.
  * Components: `Hero.tsx`, `ValueProps.tsx`, `HowItWorks.tsx`, `SocialProof.tsx`, `CTA.tsx`, `Footer.tsx`.
* Implement **Hero**, **Value Props**, **How It Works**, **Social Proof**, **Final CTA**, **Footer** exactly as described (copy, CTAs, semantics).
* Use **HeroUI** components for Button, Card, Chip, Modal, Accordion; customize via props or `classNames` slots to match brand tokens.
* Ensure **no hydration mismatches** (keep animation code in client components; no `window` access server-side).
* Add analytics events for `CTA:StartFree` and `CTA:WatchDemo`.
* Add simple **A/B** toggle via `?ab=b` for hero copy.
* Optimize: `next/image` for images; hero video is muted, inline, with poster.

**Deliverables**

* New files under `src/app/(marketing)/…` with clean, documented code.
* Updated `globals.css` with tokens and `@plugin "@heroui/react"`.
* If using config route: updated `tailwind.config.js` with `heroui()` plugin.
* A short README snippet in `/frontend/README.md` explaining how to edit content and run A/B.

**Acceptance**

* `/` renders the new landing page with the specified copy/design.
* Lighthouse: good performance, a11y, best practices (>=90).
* No console errors; CTAs route correctly; modal traps focus and is ESC-dismissible.
* Works in both light/dark if the app theme toggle exists; otherwise default to light.

**References**

* HeroUI intro/installation/Next.js guides and components. ([HeroUI (Previously NextUI)][1])

---

If you want, I can also draft the exact `layout.tsx` and `page.tsx` files next.

[1]: https://www.heroui.com/docs/guide/introduction?utm_source=chatgpt.com "Introduction | HeroUI (Previously NextUI)"
[2]: https://www.heroui.com/docs/guide/tailwind-v4?utm_source=chatgpt.com "Tailwind v4"
[3]: https://www.heroui.com/docs/customization/theme?utm_source=chatgpt.com "Theme"
[4]: https://github.com/vercel/next.js/discussions/72228?utm_source=chatgpt.com "framer-motion for Next.js 15.0.2 #72228"
[5]: https://www.heroui.com/docs/components/button?utm_source=chatgpt.com "Button"
[6]: https://www.heroui.com/docs/customization/override-styles?utm_source=chatgpt.com "Override styles | HeroUI (Previously NextUI)"
[7]: https://www.heroui.com/docs/guide/installation?utm_source=chatgpt.com "Installation"
