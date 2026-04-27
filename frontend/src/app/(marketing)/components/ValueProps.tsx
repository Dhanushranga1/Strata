"use client";

import { motion, useReducedMotion } from "framer-motion";
import { BookOpenCheck, BrainCircuit, CircuitBoard, GitBranch, Shield, SlidersHorizontal } from "lucide-react";

const valueProps = [
  {
    icon: BrainCircuit,
    title: "CASPER Auto-Routing",
    description: "Every ticket is profiled at creation — intent, complexity, urgency — then routed to the right rep automatically. No manual assignment queues.",
    iconClass: "text-indigo-400",
    tag: "Core AI",
  },
  {
    icon: BookOpenCheck,
    title: "Cited Answers",
    description: "RAG over your knowledge base with inline [1][2][3] citations. Reps see exactly which doc line backed each sentence before they send.",
    iconClass: "text-violet-400",
    tag: "AI Quality",
  },
  {
    icon: SlidersHorizontal,
    title: "P1–P7 Priority Scoring",
    description: "CASPER scores every ticket P1 (critical outage) to P7 (simple lookup) from urgency signals and query complexity. No manual triage.",
    iconClass: "text-orange-400",
    tag: "Intelligence",
  },
  {
    icon: GitBranch,
    title: "Adaptive Escalation",
    description: "Confidence-based escalation uses an intent-aware threshold — troubleshooting escalates earlier, factual lookups need less certainty.",
    iconClass: "text-pink-400",
    tag: "Reliability",
  },
  {
    icon: CircuitBoard,
    title: "Frictionless KB Ingest",
    description: "Drop in PDFs, DOCX, Markdown, or plain text. The system chunks, embeds, and deduplicates automatically. Role-gated access per org.",
    iconClass: "text-emerald-400",
    tag: "Knowledge",
  },
  {
    icon: Shield,
    title: "Multi-Org & Roles",
    description: "Customer, rep, and admin roles with full org isolation. Invite teammates by email, switch orgs, and audit every CASPER routing decision.",
    iconClass: "text-amber-400",
    tag: "Enterprise",
  },
];

export default function ValueProps() {
  const prefersReduced = useReducedMotion();

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
          What&apos;s inside
        </motion.p>
        <motion.h2
          initial={prefersReduced ? {} : { opacity: 0, y: 8 }}
          whileInView={prefersReduced ? {} : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-3xl lg:text-4xl font-bold tracking-tight text-white font-geist mb-4"
        >
          Everything you need to scale support
        </motion.h2>
        <motion.p
          initial={prefersReduced ? {} : { opacity: 0, y: 8 }}
          whileInView={prefersReduced ? {} : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-zinc-400 max-w-xl mx-auto"
        >
          From intelligent routing to confidence-scored answers, every feature is designed
          to make your reps faster and your customers happier.
        </motion.p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {valueProps.map((item, index) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={item.title}
              initial={prefersReduced ? {} : { opacity: 0, y: 10 }}
              whileInView={prefersReduced ? {} : { opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.07 }}
              className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 hover:border-zinc-700 transition-colors"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
                    <Icon className={`w-4 h-4 ${item.iconClass}`} />
                  </div>
                  <h3 className="font-semibold text-sm text-white font-geist">{item.title}</h3>
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600 border border-zinc-700 rounded px-1.5 py-0.5 shrink-0">
                  {item.tag}
                </span>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed">{item.description}</p>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
