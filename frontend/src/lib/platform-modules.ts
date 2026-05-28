import type { PlanId } from "./plans"
import {
  Ticket, BookOpen, Monitor, FileText, ShoppingCart,
  ShieldCheck, TrendingDown, LayoutGrid, GitPullRequest,
  AlertTriangle, Users, Zap, Globe, Receipt,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

export interface ModuleStats {
  stats: string[]
  health: "healthy" | "warning" | "critical"
}

export interface PlatformModule {
  id: string
  name: string
  description: string
  href: string
  Icon: LucideIcon
  accent: string          // tailwind bg color for icon circle
  textAccent: string      // tailwind text color for icon
  borderAccent: string    // tailwind border-l color when active
  feature: string         // entitlement key
  requiredPlan: PlanId
  statsEndpoint?: string  // GET endpoint returning ModuleStats
  comingSoon?: boolean
}

export const PLATFORM_MODULES: PlatformModule[] = [
  {
    id: "ticketpilot",
    name: "TicketPilot",
    description: "AI support tickets, SLA, canned responses, CSAT",
    href: "/tickets",
    Icon: Ticket,
    accent: "bg-violet-500/15",
    textAccent: "text-violet-400",
    borderAccent: "border-violet-500",
    feature: "ticketing",
    requiredPlan: "community",
    statsEndpoint: "/api/tickets/platform-stats",
  },
  {
    id: "billingvault",
    name: "BillingVault",
    description: "Invoices, clients, PDF generation with letterhead, payment tracking",
    href: "/billing",
    Icon: Receipt,
    accent: "bg-emerald-500/15",
    textAccent: "text-emerald-400",
    borderAccent: "border-emerald-500",
    feature: "billing",
    requiredPlan: "starter",
    statsEndpoint: "/api/billing/platform-stats",
  },
  {
    id: "knowbase",
    name: "KnowBase",
    description: "Searchable SOPs, runbooks, and how-to articles",
    href: "/knowbase",
    Icon: BookOpen,
    accent: "bg-indigo-500/15",
    textAccent: "text-indigo-400",
    borderAccent: "border-indigo-500",
    feature: "know_base",
    requiredPlan: "starter",
    statsEndpoint: "/api/knowbase/platform-stats",
  },
  {
    id: "assetlog",
    name: "AssetLog",
    description: "Hardware & software inventory, QR codes, warranty alerts",
    href: "/assets",
    Icon: Monitor,
    accent: "bg-blue-500/15",
    textAccent: "text-blue-400",
    borderAccent: "border-blue-500",
    feature: "assets",
    requiredPlan: "starter",
    statsEndpoint: "/api/assets/platform-stats",
  },
  {
    id: "contractvault",
    name: "ContractVault",
    description: "Vendor directory and contract renewal tracking",
    href: "/contracts",
    Icon: FileText,
    accent: "bg-emerald-500/15",
    textAccent: "text-emerald-400",
    borderAccent: "border-emerald-500",
    feature: "contracts",
    requiredPlan: "starter",
    statsEndpoint: "/api/contracts/platform-stats",
  },
  {
    id: "procureflow",
    name: "ProcureFlow",
    description: "Purchase requests, approvals, and PO tracking",
    href: "/procurement",
    Icon: ShoppingCart,
    accent: "bg-amber-500/15",
    textAccent: "text-amber-400",
    borderAccent: "border-amber-500",
    feature: "procurement",
    requiredPlan: "starter",
    statsEndpoint: "/api/procurement/platform-stats",
  },
  {
    id: "servicehub",
    name: "ServiceHub",
    description: "Employee self-service portal with dynamic request forms",
    href: "/servicehub",
    Icon: LayoutGrid,
    accent: "bg-cyan-500/15",
    textAccent: "text-cyan-400",
    borderAccent: "border-cyan-500",
    feature: "service_hub",
    requiredPlan: "starter",
    statsEndpoint: "/api/servicehub/platform-stats",
  },
  {
    id: "patchwatch",
    name: "PatchWatch",
    description: "Patch status by device and severity, maintenance windows",
    href: "/patches",
    Icon: ShieldCheck,
    accent: "bg-red-500/15",
    textAccent: "text-red-400",
    borderAccent: "border-red-500",
    feature: "patches",
    requiredPlan: "business",
    statsEndpoint: "/api/patches/platform-stats",
  },
  {
    id: "costlens",
    name: "CostLens",
    description: "Unused licenses, idle assets, renewal forecasts",
    href: "/costlens",
    Icon: TrendingDown,
    accent: "bg-green-500/15",
    textAccent: "text-green-400",
    borderAccent: "border-green-500",
    feature: "cost_lens",
    requiredPlan: "business",
    statsEndpoint: "/api/costlens/platform-stats",
  },
  {
    id: "changeboard",
    name: "ChangeBoard",
    description: "Lightweight RFC workflow, change calendar, blackout periods",
    href: "/changes",
    Icon: GitPullRequest,
    accent: "bg-violet-500/15",
    textAccent: "text-violet-400",
    borderAccent: "border-violet-500",
    feature: "change_board",
    requiredPlan: "business",
    statsEndpoint: "/api/changes/platform-stats",
  },
  {
    id: "incidentbridge",
    name: "IncidentBridge",
    description: "P1 war room, live incident timeline, stakeholder comms",
    href: "/incidents",
    Icon: AlertTriangle,
    accent: "bg-rose-500/15",
    textAccent: "text-rose-400",
    borderAccent: "border-rose-500",
    feature: "incidents",
    requiredPlan: "business",
    statsEndpoint: "/api/incidents/platform-stats",
  },
  {
    id: "flowbot",
    name: "FlowBot",
    description: "IF/THEN automation rules for ticket routing and actions",
    href: "/automation",
    Icon: Zap,
    accent: "bg-yellow-500/15",
    textAccent: "text-yellow-400",
    borderAccent: "border-yellow-500",
    feature: "flowbot",
    requiredPlan: "business",
    statsEndpoint: "/api/automation/platform-stats",
  },
  {
    id: "statuscast",
    name: "StatusCast",
    description: "Public uptime and incident status page",
    href: "/statuscast",
    Icon: Globe,
    accent: "bg-teal-500/15",
    textAccent: "text-teal-400",
    borderAccent: "border-teal-500",
    feature: "status_cast",
    requiredPlan: "business",
    statsEndpoint: "/api/statuscast/platform-stats",
  },
  {
    id: "peoplesync",
    name: "PeopleSync",
    description: "Joiner / Mover / Leaver IT checklists and HR automation",
    href: "/peoplesync",
    Icon: Users,
    accent: "bg-pink-500/15",
    textAccent: "text-pink-400",
    borderAccent: "border-pink-500",
    feature: "people_sync",
    requiredPlan: "enterprise",
    comingSoon: true,
  },
]

export const PLAN_LABELS: Record<PlanId, string> = {
  community: "Community",
  starter: "Starter",
  business: "Business",
  enterprise: "Enterprise",
}

export const PLAN_COLORS: Record<PlanId, string> = {
  community: "bg-zinc-700 text-zinc-200",
  starter:   "bg-blue-900/60 text-blue-300",
  business:  "bg-violet-900/60 text-violet-300",
  enterprise:"bg-amber-900/60 text-amber-300",
}
