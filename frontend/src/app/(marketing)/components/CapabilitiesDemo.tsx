"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { Activity, Database, GitBranch } from "lucide-react";

const TABS = [
  { id: "routing", label: "Ticket Routing", icon: GitBranch },
  { id: "confidence", label: "Confidence Score", icon: Activity },
  { id: "retrieval", label: "RAG Retrieval", icon: Database },
] as const;
type Tab = typeof TABS[number]["id"];

// ─── Panel 1: Ticket routing output ────────────────────────────────────────

function RoutingPanel() {
  return (
    <div className="space-y-4 font-mono text-sm">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <span className="text-zinc-400 text-xs uppercase tracking-widest">Ticket #1042</span>
        <span className="text-xs bg-orange-900/40 text-orange-300 border border-orange-800/50 rounded px-2 py-0.5 font-sans">P2 · HIGH</span>
      </div>

      <div className="text-zinc-200 text-base font-sans font-medium">
        &ldquo;Login fails after SSO migration&rdquo;
      </div>

      <div className="space-y-2.5 text-xs">
        <Row label="Intent" value="TROUBLESHOOTING" valueClass="text-purple-400" />
        <BarRow label="Complexity" value={0.78} color="bg-orange-400" />
        <BarRow label="Urgency" value={0.50} color="bg-yellow-400" />

        <div className="pt-1 border-t border-zinc-800" />

        <Row label="Priority" value="P2 — high" valueClass="text-orange-300" />
        <Row label="Requires senior" value="yes" valueClass="text-amber-300" />
        <Row label="Assigned to" value="sarah@company.com (load: 3)" valueClass="text-green-400" />
      </div>

      <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-3 text-xs text-zinc-500 leading-relaxed">
        <span className="text-zinc-600">routing_reason: </span>
        <span className="text-zinc-400">&ldquo;troubleshooting query; high complexity (0.78)&rdquo;</span>
      </div>

      <div className="flex gap-2 pt-1 flex-wrap">
        <Badge color="purple">CASPER profiling</Badge>
        <Badge color="orange">load-balanced</Badge>
        <Badge color="green">auto-assigned</Badge>
      </div>
    </div>
  );
}

// ─── Panel 2: Confidence breakdown ─────────────────────────────────────────

const factors = [
  { label: "Retrieval quality",   value: 0.847, weight: 0.30, color: "bg-indigo-400" },
  { label: "Citation coverage",   value: 0.667, weight: 0.22, color: "bg-violet-400" },
  { label: "Semantic coherence",  value: 0.791, weight: 0.13, color: "bg-purple-400" },
  { label: "Completeness",        value: 0.803, weight: 0.08, color: "bg-blue-400" },
  { label: "Info density",        value: 0.642, weight: 0.08, color: "bg-cyan-400" },
  { label: "Source diversity",    value: 0.571, weight: 0.19, color: "bg-teal-400" },
];

function ConfidencePanel() {
  return (
    <div className="space-y-4 font-mono text-sm">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <span className="text-zinc-400 text-xs uppercase tracking-widest">CASPER Breakdown — intent: troubleshooting</span>
      </div>

      <div className="space-y-2.5">
        {factors.map((f) => (
          <div key={f.label} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-400">{f.label}</span>
              <span className="text-zinc-300">{f.value.toFixed(3)}</span>
            </div>
            <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${f.color}`}
                initial={{ width: 0 }}
                whileInView={{ width: `${f.value * 100}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: factors.indexOf(f) * 0.08, ease: "easeOut" }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-3 space-y-1.5 text-xs">
        <CalcRow label="raw weighted score" value="0.772" />
        <CalcRow label="× KB calibration (982 chunks)" value="× 0.982" />
        <CalcRow label="− spread penalty" value="− 0.021" />
        <div className="border-t border-zinc-800 pt-1.5 flex justify-between font-semibold">
          <span className="text-zinc-300">final confidence</span>
          <span className="text-green-400">0.763</span>
        </div>
        <div className="flex justify-between text-zinc-500">
          <span>adaptive threshold (troubleshooting)</span>
          <span>0.520</span>
        </div>
        <div className="flex justify-between font-semibold">
          <span className="text-zinc-300">should_escalate</span>
          <span className="text-blue-400">false</span>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Badge color="indigo">intent-adaptive weights</Badge>
        <Badge color="green">no escalation</Badge>
      </div>
    </div>
  );
}

// ─── Panel 3: RAG retrieval ─────────────────────────────────────────────────

const chunks = [
  { rank: 1, source: "auth-troubleshooting.md §3", score: 0.891 },
  { rank: 2, source: "sso-migration-guide.pdf p.4", score: 0.847 },
  { rank: 3, source: "session-management.md §2.1", score: 0.812 },
  { rank: 4, source: "oauth-debugging.md §5", score: 0.779 },
  { rank: 5, source: "error-codes.md #SSO-401", score: 0.731 },
  { rank: 6, source: "faq-login.md Q14", score: 0.694 },
];

function RetrievalPanel() {
  return (
    <div className="space-y-4 font-mono text-sm">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <span className="text-zinc-400 text-xs uppercase tracking-widest">24 candidates → MMR → 6 chunks</span>
        <span className="text-xs text-zinc-500">λ=0.55 (diversity-first)</span>
      </div>

      <div className="space-y-2">
        {chunks.map((c, i) => (
          <motion.div
            key={c.rank}
            initial={{ opacity: 0, x: -8 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: i * 0.06 }}
            className="flex items-center gap-3"
          >
            <span className="text-zinc-600 w-4 text-right shrink-0">[{c.rank}]</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-zinc-300 text-xs truncate">{c.source}</span>
                <span className="text-zinc-500 text-xs shrink-0">{c.score.toFixed(3)}</span>
              </div>
              <div className="h-1 mt-1 rounded-full bg-zinc-800 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-indigo-500/60"
                  initial={{ width: 0 }}
                  whileInView={{ width: `${(c.score - 0.60) / 0.35 * 100}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: i * 0.07, ease: "easeOut" }}
                />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-3 text-xs space-y-1">
        <Row label="context_relevance" value="0.831" valueClass="text-green-400" />
        <Row label="source_diversity" value="0.712" valueClass="text-blue-400" />
        <Row label="score_gap (top−2nd)" value="0.044" valueClass="text-zinc-300" />
        <Row label="score_variance" value="0.0041" valueClass="text-zinc-300" />
        <Row label="information_density" value="0.641" valueClass="text-zinc-300" />
      </div>

      <div className="flex gap-2 flex-wrap">
        <Badge color="indigo">FAISS + MMR re-rank</Badge>
        <Badge color="purple">semantic dedup</Badge>
        <Badge color="blue">cached embeddings</Badge>
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function Row({ label, value, valueClass = "text-zinc-300" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-zinc-500">{label}</span>
      <span className={valueClass}>{value}</span>
    </div>
  );
}

function BarRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-zinc-500 w-20 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          whileInView={{ width: `${value * 100}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        />
      </div>
      <span className="text-zinc-400 w-10 text-right shrink-0">{value.toFixed(2)}</span>
    </div>
  );
}

function CalcRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-zinc-500">{label}</span>
      <span className="text-zinc-300">{value}</span>
    </div>
  );
}

const badgeColors = {
  purple: "bg-purple-900/40 text-purple-300 border-purple-800/40",
  orange: "bg-orange-900/40 text-orange-300 border-orange-800/40",
  green:  "bg-green-900/40  text-green-300  border-green-800/40",
  indigo: "bg-indigo-900/40 text-indigo-300 border-indigo-800/40",
  blue:   "bg-blue-900/40   text-blue-300   border-blue-800/40",
  amber:  "bg-amber-900/40  text-amber-300  border-amber-800/40",
};

function Badge({ children, color }: { children: React.ReactNode; color: keyof typeof badgeColors }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[11px] border font-sans ${badgeColors[color]}`}>
      {children}
    </span>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

export default function CapabilitiesDemo() {
  const prefersReduced = useReducedMotion();
  const [active, setActive] = useState<Tab>("routing");

  const panels: Record<Tab, React.ReactNode> = {
    routing: <RoutingPanel />,
    confidence: <ConfidencePanel />,
    retrieval: <RetrievalPanel />,
  };

  return (
    <section className="mx-auto max-w-6xl px-6 py-16 lg:py-24">
      <div className="text-center mb-12">
        <motion.p
          initial={prefersReduced ? {} : { opacity: 0, y: 8 }}
          whileInView={prefersReduced ? {} : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="text-sm font-semibold uppercase tracking-widest text-indigo-400 mb-3"
        >
          Live system output
        </motion.p>
        <motion.h2
          initial={prefersReduced ? {} : { opacity: 0, y: 8 }}
          whileInView={prefersReduced ? {} : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-3xl lg:text-4xl font-bold tracking-tight text-white font-geist mb-4"
        >
          What CASPER actually produces
        </motion.h2>
        <motion.p
          initial={prefersReduced ? {} : { opacity: 0, y: 8 }}
          whileInView={prefersReduced ? {} : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-zinc-400 max-w-xl mx-auto"
        >
          Real output from a single support ticket passing through the pipeline — routing decision, confidence breakdown, and retrieval trace.
        </motion.p>
      </div>

      <motion.div
        initial={prefersReduced ? {} : { opacity: 0, y: 16 }}
        whileInView={prefersReduced ? {} : { opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden"
      >
        {/* Tab bar */}
        <div className="flex border-b border-zinc-800 bg-zinc-900/80">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = active === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActive(tab.id)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors border-b-2 ${
                  isActive
                    ? "border-indigo-500 text-white bg-zinc-800/50"
                    : "border-transparent text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Panel content */}
        <div className="p-6">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            {panels[active]}
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
