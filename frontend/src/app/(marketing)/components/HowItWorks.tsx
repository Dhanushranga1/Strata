"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Bot, FileText, UserCheck } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: FileText,
    title: "Ingest docs → vectors",
    description: "Upload your knowledge base (PDFs, DOCX, MD, TXT). Our system automatically chunks and embeds your content for semantic search.",
    color: "text-[rgb(var(--brand))]",
    bgColor: "bg-[rgb(var(--brand))]/10"
  },
  {
    number: "02", 
    icon: Bot,
    title: "Ask AI → cited answer + confidence",
    description: "Customers or reps ask questions. Gemini searches your docs and provides answers with citations and confidence scores.",
    color: "text-[rgb(var(--accent))]",
    bgColor: "bg-[rgb(var(--accent))]/10"
  },
  {
    number: "03",
    icon: UserCheck,
    title: "Escalate on low confidence → rep lane",
    description: "When AI confidence is low, tickets automatically escalate to human reps with full context and suggested responses.",
    color: "text-[rgb(var(--success))]",
    bgColor: "bg-[rgb(var(--success))]/10"
  }
];

export default function HowItWorks() {
  const prefersReduced = useReducedMotion();

  return (
    <section className="mx-auto max-w-6xl px-6 py-16 lg:py-24">
      <div className="text-center mb-16">
        <motion.h2
          initial={prefersReduced ? {} : { opacity: 0, y: 8 }}
          whileInView={prefersReduced ? {} : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-3xl lg:text-4xl font-bold tracking-tight text-[rgb(var(--text))] font-geist mb-4"
        >
          How it works
        </motion.h2>
        <motion.p
          initial={prefersReduced ? {} : { opacity: 0, y: 8 }}
          whileInView={prefersReduced ? {} : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-lg text-[rgb(var(--muted))] max-w-2xl mx-auto"
        >
          From knowledge ingestion to intelligent escalation in three simple steps.
        </motion.p>
      </div>

      <div className="space-y-8 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-8">
        {steps.map((step, index) => {
          const IconComponent = step.icon;
          const isLast = index === steps.length - 1;
          
          return (
            <div key={step.number} className="relative">
              <motion.div
                initial={prefersReduced ? {} : { opacity: 0, y: 8 }}
                whileInView={prefersReduced ? {} : { opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.2 }}
                className="relative flex flex-col items-center text-center lg:items-start lg:text-left"
              >
                {/* Step number and icon */}
                <div className="flex items-center gap-4 mb-6">
                  <div className={`relative flex items-center justify-center w-16 h-16 rounded-full ${step.bgColor} border-2 border-[rgb(var(--surface))] shadow-sm`}>
                    <IconComponent className={`h-8 w-8 ${step.color}`} />
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-[rgb(var(--text))] text-[rgb(var(--surface))] rounded-full flex items-center justify-center text-xs font-bold">
                      {step.number}
                    </div>
                  </div>
                  
                  {/* Arrow connector (desktop only) */}
                  {!isLast && (
                    <div className="hidden lg:block">
                      <ArrowRight className="h-6 w-6 text-[rgb(var(--muted))]/60" />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="space-y-4">
                  <h3 className="text-xl lg:text-2xl font-semibold text-[rgb(var(--text))] font-geist">
                    {step.title}
                  </h3>
                  <p className="text-[rgb(var(--muted))] leading-relaxed">
                    {step.description}
                  </p>
                </div>

                {/* Mobile arrow (vertical) */}
                {!isLast && (
                  <div className="lg:hidden mt-8 mb-4">
                    <div className="w-px h-8 bg-gradient-to-b from-[rgb(var(--muted))]/40 to-transparent mx-auto" />
                  </div>
                )}
              </motion.div>
            </div>
          );
        })}
      </div>
    </section>
  );
}