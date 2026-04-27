"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Building2, Headphones, LifeBuoy, Rocket } from "lucide-react";

const personas = [
  {
    icon: Headphones,
    title: "SaaS Support Teams",
    pain: "Drowning in repetitive tickets that your docs already answer.",
    gain: "CASPER auto-routes every ticket and drafts KB-grounded replies in seconds — reps review, not research.",
    accent: "indigo",
  },
  {
    icon: LifeBuoy,
    title: "Customer Success Leaders",
    pain: "High-touch accounts escalating to your best reps for simple questions.",
    gain: "Confidence scoring surfaces the tickets that genuinely need senior attention. Simple lookups resolve themselves.",
    accent: "violet",
  },
  {
    icon: Building2,
    title: "Technical Support Ops",
    pain: "No visibility into which reps are overloaded and which tickets are actually urgent.",
    gain: "CASPER assigns P1–P7 priority at creation time from urgency and complexity signals, load-balanced to the right rep.",
    accent: "cyan",
  },
  {
    icon: Rocket,
    title: "Growing Startups",
    pain: "A two-person support team buried under tickets they can't keep up with.",
    gain: "Start with zero admin setup. Upload your docs, invite your team, and CASPER handles routing and prioritisation automatically.",
    accent: "emerald",
  },
];

const accentClasses: Record<string, { icon: string; tag: string }> = {
  indigo:  { icon: "text-indigo-400",  tag: "text-indigo-400 border-indigo-800/50" },
  violet:  { icon: "text-violet-400",  tag: "text-violet-400 border-violet-800/50" },
  cyan:    { icon: "text-cyan-400",    tag: "text-cyan-400   border-cyan-800/50" },
  emerald: { icon: "text-emerald-400", tag: "text-emerald-400 border-emerald-800/50" },
};

export default function TargetAudience() {
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
          Who it&apos;s for
        </motion.p>
        <motion.h2
          initial={prefersReduced ? {} : { opacity: 0, y: 8 }}
          whileInView={prefersReduced ? {} : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-3xl lg:text-4xl font-bold tracking-tight text-white font-geist mb-4"
        >
          Built for teams that can&apos;t afford slow support
        </motion.h2>
        <motion.p
          initial={prefersReduced ? {} : { opacity: 0, y: 8 }}
          whileInView={prefersReduced ? {} : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-zinc-400 max-w-xl mx-auto"
        >
          Whether you&apos;re a startup with two reps or an enterprise org with hundreds of daily tickets,
          TicketPilot scales with you.
        </motion.p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {personas.map((p, i) => {
          const Icon = p.icon;
          const cls = accentClasses[p.accent];
          return (
            <motion.div
              key={p.title}
              initial={prefersReduced ? {} : { opacity: 0, y: 12 }}
              whileInView={prefersReduced ? {} : { opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 space-y-4 hover:border-zinc-700 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
                    <Icon className={`w-4.5 h-4.5 ${cls.icon}`} />
                  </div>
                  <h3 className="font-semibold text-white font-geist">{p.title}</h3>
                </div>
              </div>

              <div className="space-y-2.5 text-sm">
                <div className="flex gap-2">
                  <span className="text-red-400 font-medium shrink-0 text-xs uppercase tracking-wide mt-0.5">Problem</span>
                  <span className="text-zinc-400 leading-relaxed">{p.pain}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-green-400 font-medium shrink-0 text-xs uppercase tracking-wide mt-0.5">Solution</span>
                  <span className="text-zinc-300 leading-relaxed">{p.gain}</span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
