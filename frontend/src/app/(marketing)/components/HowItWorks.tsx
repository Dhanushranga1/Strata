"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Bot, FileText, GitMerge, UserCheck } from "lucide-react";

const steps = [
  {
    icon: FileText,
    title: "Upload your knowledge base",
    description: "Drop in PDFs, DOCX, Markdown, or plain text. TicketPilot chunks and embeds your docs into a semantic search index — no configuration needed.",
    iconClass: "text-indigo-400",
    step: "01",
  },
  {
    icon: GitMerge,
    title: "CASPER profiles every ticket",
    description: "At creation, CASPER classifies the intent (factual / procedural / troubleshooting), scores urgency and complexity, and assigns a P1–P7 priority.",
    iconClass: "text-violet-400",
    step: "02",
  },
  {
    icon: Bot,
    title: "AI drafts a cited answer",
    description: "Gemini searches your KB with intent-adaptive MMR retrieval and writes a reply with inline [1][2][3] citations and a calibrated confidence score.",
    iconClass: "text-cyan-400",
    step: "03",
  },
  {
    icon: UserCheck,
    title: "Auto-assigned to the right rep",
    description: "Complex tickets go to senior reps. Simple lookups go to the lowest-load rep. Load-balanced in real-time — zero manual triage.",
    iconClass: "text-emerald-400",
    step: "04",
  },
];

export default function HowItWorks() {
  const prefersReduced = useReducedMotion();

  return (
    <section id="how" className="mx-auto max-w-6xl px-6 py-16 lg:py-24">
      <div className="text-center mb-12">
        <motion.p
          initial={prefersReduced ? {} : { opacity: 0, y: 8 }}
          whileInView={prefersReduced ? {} : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="text-sm font-semibold uppercase tracking-widest text-indigo-400 mb-3"
        >
          How it works
        </motion.p>
        <motion.h2
          initial={prefersReduced ? {} : { opacity: 0, y: 8 }}
          whileInView={prefersReduced ? {} : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-3xl lg:text-4xl font-bold tracking-tight text-white font-geist mb-4"
        >
          From ticket to resolution in four steps
        </motion.h2>
        <motion.p
          initial={prefersReduced ? {} : { opacity: 0, y: 8 }}
          whileInView={prefersReduced ? {} : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-zinc-400 max-w-xl mx-auto"
        >
          Knowledge ingestion to intelligent routing and AI-drafted reply — fully automated, no manual queue management.
        </motion.p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <motion.div
              key={step.step}
              initial={prefersReduced ? {} : { opacity: 0, y: 12 }}
              whileInView={prefersReduced ? {} : { opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="relative rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 hover:border-zinc-700 transition-colors"
            >
              {/* Step number watermark */}
              <div className="absolute top-4 right-4 text-3xl font-bold text-zinc-800 font-mono select-none">
                {step.step}
              </div>

              <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center mb-4">
                <Icon className={`w-5 h-5 ${step.iconClass}`} />
              </div>

              <h3 className="font-semibold text-white text-sm font-geist mb-2 pr-8 leading-snug">
                {step.title}
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                {step.description}
              </p>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
