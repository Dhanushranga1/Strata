"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, X, Zap, ArrowRight, Shield, Users, BarChart3, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

interface Plan {
  id: string;
  name: string;
  price: string;
  period: string;
  description: string;
  badge?: string;
  badgeColor?: string;
  cta: string;
  ctaHref: string;
  ctaVariant: "primary" | "outline" | "enterprise";
  color: string;
  features: { label: string; included: boolean }[];
}

const PLANS: Plan[] = [
  {
    id: "community",
    name: "Community",
    price: "Free",
    period: "forever",
    description: "For individuals and tiny teams getting started.",
    cta: "Start free",
    ctaHref: "/signup",
    ctaVariant: "outline",
    color: "border-border",
    features: [
      { label: "Up to 5 agents", included: true },
      { label: "Unlimited tickets", included: true },
      { label: "CSAT ratings", included: true },
      { label: "AI assistant (CASPER)", included: false },
      { label: "Knowledge base", included: false },
      { label: "SLA policies", included: false },
      { label: "AssetLog", included: false },
      { label: "ContractVault", included: false },
      { label: "BillingVault", included: false },
      { label: "Analytics", included: false },
      { label: "PatchWatch / CostLens", included: false },
      { label: "ChangeBoard / IncidentBridge", included: false },
      { label: "FlowBot automation", included: false },
      { label: "Audit log", included: false },
    ],
  },
  {
    id: "starter",
    name: "Starter",
    price: "$99",
    period: "/ month",
    description: "For small IT teams that need AI + the full operations suite.",
    badge: "Most popular",
    badgeColor: "bg-violet-500/15 text-violet-300 border border-violet-500/25",
    cta: "Start Starter",
    ctaHref: "/signup?plan=starter",
    ctaVariant: "primary",
    color: "border-violet-500/40",
    features: [
      { label: "Unlimited agents", included: true },
      { label: "Unlimited tickets", included: true },
      { label: "CSAT + SLA policies", included: true },
      { label: "AI assistant (5,000 queries/mo)", included: true },
      { label: "KnowBase (SOPs + runbooks)", included: true },
      { label: "SLA policies + ETR", included: true },
      { label: "AssetLog (hardware + licenses)", included: true },
      { label: "ContractVault (vendors + renewals)", included: true },
      { label: "BillingVault (invoicing)", included: true },
      { label: "ProcureFlow + ServiceHub", included: true },
      { label: "Customer ticket portal", included: true },
      { label: "Analytics", included: false },
      { label: "ChangeBoard / IncidentBridge", included: false },
      { label: "FlowBot automation", included: false },
    ],
  },
  {
    id: "business",
    name: "Business",
    price: "$299",
    period: "/ month",
    description: "For growing IT teams that need automation, incidents, and cost control.",
    cta: "Start Business",
    ctaHref: "/signup?plan=business",
    ctaVariant: "primary",
    color: "border-border",
    features: [
      { label: "Everything in Starter", included: true },
      { label: "AI assistant (25,000 queries/mo)", included: true },
      { label: "Advanced analytics + monthly reports", included: true },
      { label: "Audit log (full history)", included: true },
      { label: "PatchWatch (patch management)", included: true },
      { label: "CostLens (license waste + spend)", included: true },
      { label: "ChangeBoard (RFC + blackouts)", included: true },
      { label: "IncidentBridge (P1 war room)", included: true },
      { label: "FlowBot (IF/THEN automation)", included: true },
      { label: "StatusCast (public status page)", included: true },
      { label: "Webhooks + API access", included: true },
      { label: "PeopleSync (HR IT)", included: false },
      { label: "SSO / SAML", included: false },
      { label: "Dedicated success manager", included: false },
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    period: "pricing",
    description: "For large orgs with compliance, SSO, and HR automation needs.",
    badge: "Contact us",
    badgeColor: "bg-amber-500/15 text-amber-300 border border-amber-500/25",
    cta: "Talk to sales",
    ctaHref: "mailto:sales@strata.io",
    ctaVariant: "enterprise",
    color: "border-amber-500/30",
    features: [
      { label: "Everything in Business", included: true },
      { label: "Unlimited AI queries", included: true },
      { label: "PeopleSync (joiner/mover/leaver)", included: true },
      { label: "SSO / SAML / LDAP", included: true },
      { label: "Custom data retention", included: true },
      { label: "SLA guarantees (99.9% uptime)", included: true },
      { label: "Dedicated Slack channel", included: true },
      { label: "Custom onboarding + migration", included: true },
      { label: "White-label options", included: true },
      { label: "Invoice billing (no card)", included: true },
      { label: "Priority support queue", included: true },
      { label: "Security review + BAA", included: true },
      { label: "Unlimited storage", included: true },
      { label: "Custom integrations", included: true },
    ],
  },
];

const WHY_STRATA = [
  { icon: Zap, title: "AI-first, not AI-bolted", body: "CASPER is the connective tissue of every module — not a chatbot you added later." },
  { icon: Layers, title: "One platform, 13 modules", body: "Replace 8 disconnected tools with a single workspace your team actually uses." },
  { icon: Shield, title: "SME-grade security", body: "Row-level security, full audit log, and rate-limited AI on every plan." },
  { icon: Users, title: "Built for small IT teams", body: "No ITIL bloat. No 6-month implementation. Up and running in 20 minutes." },
];

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);

  return (
    <div className="min-h-screen bg-[color:var(--bg)] text-[rgb(var(--text))] font-inter">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border max-w-7xl mx-auto">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          <Layers className="w-5 h-5 text-primary" />
          Strata
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/login" className="text-muted-foreground hover:text-foreground transition-colors">Sign in</Link>
          <Link href="/signup" className="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            Get started free
          </Link>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-16 space-y-16">
        {/* Hero */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Simple, honest pricing
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            One platform for every IT operation. Start free, scale as you grow.
          </p>

          {/* Annual toggle */}
          <div className="flex items-center justify-center gap-3 pt-2">
            <span className={cn("text-sm", !annual ? "text-foreground font-medium" : "text-muted-foreground")}>Monthly</span>
            <button
              onClick={() => setAnnual(p => !p)}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                annual ? "bg-primary" : "bg-muted"
              )}
            >
              <span className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                annual ? "translate-x-6" : "translate-x-1"
              )} />
            </button>
            <span className={cn("text-sm", annual ? "text-foreground font-medium" : "text-muted-foreground")}>
              Annual <span className="text-emerald-400 text-xs font-medium">Save 20%</span>
            </span>
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {PLANS.map((plan) => {
            const price = annual && plan.price !== "Free" && plan.price !== "Custom"
              ? `$${Math.round(parseInt(plan.price.replace("$", "")) * 0.8)}`
              : plan.price;

            return (
              <div
                key={plan.id}
                className={cn(
                  "rounded-2xl border bg-card p-6 flex flex-col gap-5 relative",
                  plan.color
                )}
              >
                {plan.badge && (
                  <span className={cn("absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap", plan.badgeColor)}>
                    {plan.badge}
                  </span>
                )}

                <div className="space-y-1">
                  <h2 className="text-lg font-bold">{plan.name}</h2>
                  <p className="text-sm text-muted-foreground leading-snug">{plan.description}</p>
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold">{price}</span>
                  <span className="text-sm text-muted-foreground">{plan.period}</span>
                </div>

                <a
                  href={plan.ctaHref}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold transition-colors",
                    plan.ctaVariant === "primary" && "bg-primary text-primary-foreground hover:bg-primary/90",
                    plan.ctaVariant === "outline" && "border border-border hover:bg-accent text-foreground",
                    plan.ctaVariant === "enterprise" && "bg-amber-600 text-white hover:bg-amber-700",
                  )}
                >
                  {plan.cta} <ArrowRight className="w-3.5 h-3.5" />
                </a>

                <ul className="space-y-2 flex-1">
                  {plan.features.map((f) => (
                    <li key={f.label} className="flex items-start gap-2 text-sm">
                      {f.included
                        ? <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-px" />
                        : <X className="w-4 h-4 text-muted-foreground/40 shrink-0 mt-px" />}
                      <span className={f.included ? "text-foreground" : "text-muted-foreground/50"}>
                        {f.label}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Why Strata */}
        <div className="space-y-8">
          <h2 className="text-2xl font-bold text-center">Why teams choose Strata</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {WHY_STRATA.map((item) => (
              <div key={item.title} className="rounded-xl border border-border bg-card p-5 space-y-2">
                <item.icon className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-sm">{item.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto space-y-6">
          <h2 className="text-2xl font-bold text-center">Common questions</h2>
          <div className="space-y-4">
            {[
              {
                q: "Can I try Strata before paying?",
                a: "Yes — the Community plan is free forever with unlimited tickets and 5 agents. No credit card required.",
              },
              {
                q: "What counts as an 'agent'?",
                a: "Any team member with a Rep or Admin role. Customers who submit tickets don't count against your agent limit.",
              },
              {
                q: "Can I switch plans at any time?",
                a: "Yes. Upgrades are instant. Downgrades take effect at the end of your billing period.",
              },
              {
                q: "What is CASPER?",
                a: "CASPER is Strata's AI core — it scores tickets, drafts replies, searches your knowledge base, and correlates assets, contracts, and articles to surface the right answer fast.",
              },
              {
                q: "Is my data secure?",
                a: "Yes. All data is isolated per organisation with row-level security. We never train on your data.",
              },
            ].map((item) => (
              <details key={item.q} className="group rounded-xl border border-border bg-card">
                <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-sm font-medium list-none">
                  {item.q}
                  <span className="text-muted-foreground text-lg group-open:rotate-45 transition-transform">+</span>
                </summary>
                <p className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </div>

        {/* CTA footer */}
        <div className="text-center space-y-4 py-8">
          <h2 className="text-2xl font-bold">Ready to consolidate your IT stack?</h2>
          <p className="text-muted-foreground">Join teams that replaced 8+ tools with one platform.</p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/signup" className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-colors flex items-center gap-2">
              Start free today <ArrowRight className="w-4 h-4" />
            </Link>
            <a href="mailto:sales@strata.io" className="px-6 py-3 border border-border rounded-xl text-sm font-medium hover:bg-accent transition-colors">
              Talk to sales
            </a>
          </div>
          <p className="text-xs text-muted-foreground">No credit card required · Cancel anytime · GDPR-compliant</p>
        </div>
      </div>
    </div>
  );
}
