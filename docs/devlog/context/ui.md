Here’s a **developer-ready, copy-paste** spec to refine TicketPilot’s frontend using your design system. Hand this to your AI agent as-is.

# TicketPilot — Frontend Refinement Spec (Design System v1)

**Scope:** Apply the “Clarity, Control, Performance” system to TicketPilot’s Next.js app using **shadcn/ui + Radix UI + Tailwind**, **Lucide icons**, and **Geist + Inter** fonts.
**Targets:** Login/Signup, Dashboard (Bento), Tickets List/Detail (+ Ask AI), Rep Console, Admin → Roles, Account → Request Rep, Settings.
**Non-goals:** New backend features, notifications, sockets, analytics. Keep dependencies minimal.

---

## 0) Objectives & Done-When

**Objectives**

1. Establish **design tokens** (colors, spacing, radii), **typography** (Geist/Inter), **iconography** (Lucide), and **motion** rules.
2. Implement core **UI primitives** (Button, Input, Select, Textarea, Dialog w/ Glassmorphism, Card, Badge, Tooltip, Toaster).
3. Add higher-order components: **BentoGrid**, **DataTable** (TanStack), **Pagination**, **StatusBadge**, **AIMessage**, **RepActionBar**, **RoleSelect**, **KBIngestModal**.
4. Apply page refinements to **/login**, **/signup**, **/tickets**, **/tickets/\[id]**, **/rep**, **/admin/roles**, **/account/request-rep**, \*\*/settings/\*\`.
5. Accessibility (WCAG 2.1 AA), dark mode, performance (RSC, code-split), and QA checklists.

**Done-When**

* All target pages render with the new tokens/typography and components.
* Focus rings, reduced-motion, and color contrast pass automated checks.
* Rep/Admin gating visible in UI; actions disabled appropriately.
* Lighthouse: **Performance ≥ 90**, **Accessibility ≥ 95** on target pages (desktop).

---

## 1) Project Setup & Conventions

### 1.1 Packages (already used stack; confirm or add)

```bash
# icons & motion
npm i lucide-react framer-motion
# shadcn CLI (if not present)
npx shadcn@latest init
# install needed shadcn components as code (no runtime dep)
npx shadcn@latest add button input textarea select label dialog card badge tooltip separator dropdown-menu tabs toast table
# theme toggling (optional but recommended)
npm i next-themes
```

### 1.2 Fonts (Next.js `next/font`)

Use **Geist** (headings/UI) + **Inter** (body). In `frontend/src/app/layout.tsx`:

```tsx
import { Geist, Inter } from "next/font/google";

export const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
export const inter = Inter({ subsets: ["latin"], variable: "--font-inter"] });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geist.variable} ${inter.variable} antialiased`}>{children}</body>
    </html>
  );
}
```

### 1.3 Tailwind tokens & theme

`tailwind.config.ts`:

```ts
import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Brand system
        brand: {
          DEFAULT: "#3B82F6", // Blue 500
          50: "#EFF6FF", 100: "#DBEAFE", 200: "#BFDBFE", 300: "#93C5FD",
          400: "#60A5FA", 500: "#3B82F6", 600: "#2563EB", 700: "#1D4ED8",
          800: "#1E40AF", 900: "#1E3A8A"
        },
        accent: { DEFAULT: "#EC4899" },
        success: { DEFAULT: "#22C55E" },
        warning: { DEFAULT: "#F97316" },
        danger:  { DEFAULT: "#EF4444" },

        // Surfaces
        surface:  { light: "#FFFFFF", dark: "#1A1B1E" },
        canvas:   { light: "#F8F9FA", dark: "#111214" },
      },
      borderRadius: {
        xl: "1rem", "2xl": "1.25rem",
      },
      boxShadow: {
        // Subtle elevation
        card: "0 1px 2px 0 rgba(0,0,0,0.05)",
        cardHover: "0 8px 24px -8px rgba(0,0,0,0.15)"
      },
      transitionDuration: {
        fast: "150ms", base: "220ms"
      }
    }
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
```

### 1.4 Global CSS & tokens

`src/app/globals.css`:

```css
:root {
  --bg: #F8F9FA;
  --surface: #FFFFFF;
  --text: 17, 24, 39; /* slate-800 */
  --ring: 59, 130, 246; /* brand-500 */
}
.dark {
  --bg: #111214;
  --surface: #1A1B1E;
  --text: 229, 231, 235; /* zinc-200 */
  --ring: 59, 130, 246;
}

html, body { background: var(--bg); color: rgb(var(--text)); }
* { outline: none; }
:focus-visible {
  box-shadow: 0 0 0 2px rgba(var(--ring), .7);
  border-radius: 6px;
}

/* Glassmorphism overlay for dialogs */
.glass {
  background: rgba(255,255,255,.08);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255,255,255,.15);
}
.dark .glass {
  background: rgba(17,17,20,.5);
  border-color: rgba(255,255,255,.08);
}
```

### 1.5 Motion rules

* **Default:** 150–220ms; ease-out for entrances, ease-in for exits.
* **Reduced motion:** Respect `prefers-reduced-motion: reduce` → disable scale/translate.

---

## 2) Core Components (implementation notes)

> Use shadcn base components; extend via class-variance-authority (CVA) where helpful. Keep props small, predictable.

### 2.1 Button (variants + micro-interaction)

`src/components/ui/button.tsx` (if not already from shadcn, extend it):

```tsx
"use client";
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-transform duration-fast disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
  {
    variants: {
      variant: {
        primary: "bg-brand-500 text-white hover:bg-brand-600",
        secondary: "bg-accent text-white hover:opacity-95",
        destructive: "bg-danger text-white hover:bg-red-600",
        outline: "border border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900",
        ghost: "hover:bg-zinc-100 dark:hover:bg-zinc-900",
        link: "text-brand-600 underline-offset-4 hover:underline"
      },
      size: {
        sm: "h-8 px-3", md: "h-10 px-4", lg: "h-11 px-5"
      }
    },
    defaultVariants: { variant: "primary", size: "md" }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), "active:scale-[0.98]")}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
```

### 2.2 Inputs (Text, Textarea, Select) with states

* Use shadcn Input/Textarea/Select; ensure `aria-invalid`, `aria-describedby` for errors.
* Focus ring matches brand; invalid state uses `danger`.

Error helper text component:

```tsx
export function FieldError({ id, children }: { id: string; children?: React.ReactNode }) {
  if (!children) return null;
  return <p id={id} className="mt-1 text-xs text-danger">{children}</p>;
}
```

### 2.3 Dialog (Glassmorphism overlay)

Wrap shadcn Dialog, apply `.glass` to `DialogContent` container background and `backdrop-blur` to overlay:

```tsx
<Dialog>
  <DialogTrigger asChild><Button>Open</Button></DialogTrigger>
  <DialogContent className="glass backdrop-blur-xl">
    ...
  </DialogContent>
</Dialog>
```

### 2.4 Card

Use shadcn Card; extend hover:

```tsx
<Card className="shadow-card hover:shadow-cardHover transition-shadow duration-base rounded-2xl" />
```

### 2.5 Badge & StatusBadge

Ticket statuses:

```tsx
export function StatusBadge({ status }: { status: "open"|"in_progress"|"resolved"|"closed"|"escalated" }) {
  const map = {
    open: "bg-brand-100 text-brand-700",
    in_progress: "bg-warning/15 text-warning",
    resolved: "bg-success/15 text-success",
    closed: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    escalated: "bg-danger/15 text-danger"
  };
  return <span className={`px-2.5 py-1 text-xs rounded-full ${map[status]}`}>{status.replace("_"," ")}</span>;
}
```

### 2.6 Tooltip & Toaster

* Use shadcn Tooltip for icon-only buttons.
* Add shadcn Sonner Toast for confirmations (“Saved”, “Escalated”, etc.).

---

## 3) Composite Components

### 3.1 BentoGrid

`src/components/BentoGrid.tsx`

```tsx
export function BentoGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-6 auto-rows-[10rem]">
      {children}
    </div>
  );
}
export function BentoCard({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("col-span-6 md:col-span-3 rounded-2xl shadow-card hover:shadow-cardHover bg-[color:var(--surface)] p-4 md:p-6", className)} {...props} />;
}
```

Usage: mix spans for variety (`md:col-span-2`, `md:row-span-2` for tall charts).

### 3.2 DataTable (TanStack)

* Use shadcn table skeleton + TanStack Table.
* Row actions in `DropdownMenu` with ellipsis `MoreHorizontal` (Lucide).
* On mobile: collapse columns → stack important fields, move actions to a bottom row.

### 3.3 Pagination

Shadcn `Pagination` or custom: Prev/Next + page size (10/20/50).

### 3.4 AIMessage (citations + confidence)

```tsx
export function AIMessage({ content, citations, confidence, suggest }: {
  content: string; citations: { label: string; score?: number }[]; confidence: number; suggest?: boolean;
}) {
  return (
    <div className="rounded-2xl border p-4 bg-zinc-50 dark:bg-zinc-900">
      <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: content /* or markdown->html sanitized */ }} />
      <div className="mt-3 flex items-center gap-3 text-xs">
        <span className="px-2 py-1 rounded bg-zinc-200 dark:bg-zinc-800">Confidence: {confidence.toFixed(2)}</span>
        {suggest && <span className="px-2 py-1 rounded bg-warning/15 text-warning">Consider escalating</span>}
      </div>
      {citations?.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-brand-600">Sources</summary>
          <ul className="mt-2 space-y-1">{citations.map((c, i) => <li key={i} className="text-xs">{c.label}{c.score ? ` (score ${c.score.toFixed(2)})` : ""}</li>)}</ul>
        </details>
      )}
    </div>
  );
}
```

### 3.5 RepActionBar

Buttons: Assign to me, Escalate (Dialog reason), Resolve, Close, Reopen (if closed), Acknowledge, Priority Select.

* Disable buttons based on status; show tooltips.

### 3.6 RoleSelect (Admin)

Dropdown (customer | rep | admin) with optimistic toast, reverting on failure.

### 3.7 KBIngestModal (Rep)

Tabs: Upload | Paste text; call `/api/kb/ingest` (rep-only). Show chunks/vectors result in a toast.

---

## 4) Page Refinements

> File paths assume `src/app` (App Router). Adjust to your structure.

### 4.1 `/login` & `/signup`

* **Layout:** Single-column, centered, minimal distractions.
* **Components:** `Input`, `Button` (primary), optional `Separator` + SSO buttons (Google/GitHub placeholders).
* **UX:** Inline validation with `FieldError`. “Forgot password?” link.
* **Motion:** subtle fade/slide in `220ms`.
* **A11y:** labels connected via `htmlFor`/`id`.

### 4.2 `/app/dashboard` (Bento)

Cards (examples):

* **My Tickets** (counts: open, escalated, resolved)
* **Needs Attention** (list top 5 with `StatusBadge`)
* **Recent Activity** (message/thread snippets)
* **Quick Actions** (Create ticket, KB ingest)
* **Search** (global search entry)

### 4.3 `/tickets` (List)

* **Controls row:** search input (debounced), status filter (`All | open | in_progress | resolved | closed | escalated`), page size.
* **Table:** columns: Title (link), Status (badge), Priority, Assignee, Messages, Last activity.
* **Row actions:** View, Resolve/Close (confirm), Assign to me.
* **Mobile:** card list view (stack fields), actions in dropdown.

### 4.4 `/tickets/[id]` (Detail)

* **Header:** Title, `StatusBadge`, Priority pill, Assignee, timestamps.
* **RepActionBar** (if role rep/admin).
* **Thread:** user/rep/AI message bubbles (AI uses `AIMessage`).
* **Composer:** textarea + **Ask AI** button (Phase 4). Show cooldown state.

### 4.5 `/rep` (Rep Console)

* **Header** with counts (from `/api/rep/counts`).
* **Tabs/Lane selector:** Needs Attention | Open | Escalated | All.
* **Controls:** `q` search, “Mine only”.
* **List:** ticket cards (title, badges, assignee, message\_count, last activity).
* **Inline actions:** Assign to me, Escalate (dialog), Acknowledge, Resolve/Close.
* **KBIngestModal** accessible here.

### 4.6 `/admin/roles`

* **Guard:** only admin.
* **Table:** Email, Role (RoleSelect), Last updated.
* **Search:** filter by email.
* **Feedback:** toast on save, revert on error.

### 4.7 `/account/request-rep`

* **Guard:** logged-in customer.
* If pending request exists: show status and disable form.
* Else textarea (optional reason) + Submit → success message.

### 4.8 `/settings/*`

* **Layout:** Sidebar (Profile / Billing / Notifications).
* **Content:** forms with Save (primary), destructive actions (destructive button + confirm dialog).

---

## 5) Accessibility & Theming

* **Contrast:** Ensure text/icon contrast ≥ WCAG AA (use brand-600+ on light, brand-400+ on dark backgrounds).
* **Focus:** `:focus-visible` ring (already set) and visible outlines on actionable elements.
* **Labels:** Every input has `<Label htmlFor="...">`.
* **Keyboard:** Dialog traps focus; Esc closes; menus navigable by arrows/enter.
* **Reduced motion:** Wrap motion in `if (!prefersReducedMotion)`.
* **Dark mode:** Use `next-themes`; add theme toggle in header (optional).

---

## 6) Performance

* Prefer **RSC** (Server Components) for data fetch heavy lists; keep client components only where interactivity is needed.
* **Code-split**: dynamic import DataTable, KBIngestModal.
* **Icons:** import only used Lucide icons (named imports).
* **Images:** Next.js `<Image/>` with `fill`/`sizes`.
* **Memoization:** cache expensive table column defs.

---

## 7) File Map (create/update)

```
src/
  app/
    (public)/login/page.tsx
    (public)/signup/page.tsx
    (protected)/dashboard/page.tsx
    (protected)/tickets/page.tsx
    (protected)/tickets/[id]/page.tsx
    (protected)/rep/page.tsx
    (protected)/admin/roles/page.tsx
    (protected)/account/request-rep/page.tsx
    (protected)/settings/layout.tsx
    (protected)/settings/profile/page.tsx
    (protected)/settings/billing/page.tsx
    (protected)/settings/notifications/page.tsx
  components/
    BentoGrid.tsx
    AIMessage.tsx
    RepActionBar.tsx
    RoleSelect.tsx
    KBIngestModal.tsx
  components/ui/
    button.tsx input.tsx textarea.tsx select.tsx dialog.tsx card.tsx badge.tsx tooltip.tsx dropdown-menu.tsx separator.tsx tabs.tsx toast.tsx table.tsx
  lib/
    utils.ts (cn helper)
    a11y.ts (reduced motion hook)
```

---

## 8) Acceptance Tests (manual)

* **Login/Signup:** keyboard-only completion; invalid email shows inline error; focus moves to first invalid control.
* **Dark mode:** toggle persists; contrast still passes.
* **Tickets List:** search + filter + pagination work; mobile collapse readable.
* **Ticket Detail:** sending message updates thread; Ask AI bubble renders with citations/confidence; cooldown indicated.
* **Rep Console:** lane tabs filter correctly; Assign/Escalate/Acknowledge/Status changes update UI after success.
* **Admin Roles:** changing role updates immediately; customer cannot access page.
* **Request Rep:** duplicate pending returns proper message; after admin approval, `/rep` becomes accessible on reload.

---

## 9) Agent Task List (step-by-step)

1. **Tokens & fonts:** Apply §1.2–1.4. Ensure globals.css variables and Tailwind theme are live.
2. **Install shadcn components** listed in §1.1; replace any ad-hoc buttons/inputs with the refined versions in §2.1–2.2.
3. **Build composite components:** BentoGrid, DataTable baseline, Pagination, StatusBadge, AIMessage, RepActionBar, RoleSelect, KBIngestModal.
4. **Refine pages** per §4 with minimal code churn: keep existing data hooks; swap UI.
5. **A11y pass:** labels, aria, focus, reduced motion.
6. **Performance pass:** RSC vs client, dynamic imports for heavy components, icon imports trimmed.
7. **QA pass** against §8; fix any blockers.
8. **Polish:** hover states, micro-interactions, empty/loading states with skeletons.

---

## 10) Code Snippets (quick starts)

### Tickets List table columns (example)

```tsx
const columns: ColumnDef<Ticket>[] = [
  { header: "Title", accessorKey: "title",
    cell: ({ row }) => <Link href={`/tickets/${row.original.id}`} className="text-brand-700 hover:underline">{row.original.title}</Link> },
  { header: "Status", accessorKey: "status", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
  { header: "Priority", accessorKey: "priority",
    cell: ({ row }) => <span className="capitalize">{row.original.priority}</span> },
  { header: "Assignee", accessorKey: "assignee_email", cell: ({ row }) => row.original.assignee_email ?? "Unassigned" },
  { header: "Msgs", accessorKey: "message_count" },
  { header: "Last Activity", accessorKey: "last_message_at",
    cell: ({ row }) => formatDistanceToNow(new Date(row.original.last_message_at), { addSuffix: true }) },
  { id: "actions", cell: ({ row }) => <RowActions ticket={row.original} /> }
];
```

### Escalate dialog (reason)

```tsx
const [open, setOpen] = useState(false);
<Dialog open={open} onOpenChange={setOpen}>
  <DialogTrigger asChild><Button variant="secondary">Escalate</Button></DialogTrigger>
  <DialogContent className="glass">
    <DialogHeader><DialogTitle>Escalate ticket</DialogTitle></DialogHeader>
    <Textarea placeholder="Reason (optional)" value={reason} onChange={e=>setReason(e.target.value)} />
    <div className="flex gap-2 justify-end">
      <Button variant="outline" onClick={()=>setOpen(false)}>Cancel</Button>
      <Button onClick={submitEscalate}>Confirm</Button>
    </div>
  </DialogContent>
</Dialog>
```

---

## 11) Risks & Mitigations

* **Contrast failures in dark mode:** test with Axe/Lighthouse; bump text to brand-400+ on dark.
* **Over-animation on low devices:** honor `prefers-reduced-motion`; avoid layout thrashing.
* **Bundle bloat:** tree-shake Lucide; dynamic import DataTable; keep charts lazy (future).
* **Form errors missed:** always connect `aria-describedby` and focus first invalid field.

---

## 12) Future Nice-to-Haves (post-launch)

* Command Palette (Radix `Dialog` + kbd shortcuts).
* Saved filters/views on Tickets and Rep Console.
* Theme tokens via CSS variables for live theming.

---

**That’s the full blueprint.** If you want, I can also generate the precise **diffs** for your existing files (e.g., `/rep/page.tsx`, `/tickets/[id]/page.tsx`) to accelerate implementation.
