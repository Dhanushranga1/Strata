"use client";

import { Button, Chip } from "@heroui/react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, BrainCircuit, Shield, Zap } from "lucide-react";
import { v } from "../../../ui/motion/variants";

const trustSignals = [
  { icon: Shield, text: "No credit card required" },
  { icon: Zap, text: "Setup in under 5 minutes" },
  { icon: BrainCircuit, text: "CASPER active on day one" },
];

export default function CTA() {
  const prefersReduced = useReducedMotion();

  return (
    <section className="relative bg-zinc-950 border-t border-zinc-800">
      {/* Single subtle top glow */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,rgba(91,124,255,0.07),transparent)] pointer-events-none" />

      <motion.div
        className="relative mx-auto max-w-3xl px-6 py-24 text-center"
        variants={v.list}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
      >
        <motion.div variants={v.item} className="space-y-5 mb-10">
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight text-white">
            Your support team deserves{" "}
            <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
              smarter tools.
            </span>
          </h2>
          <p className="text-lg text-zinc-400 max-w-xl mx-auto leading-relaxed">
            Upload your knowledge base, invite your team, and let CASPER handle routing and
            prioritisation from day one. No spreadsheets, no manual triage.
          </p>
        </motion.div>

        <motion.div
          variants={v.item}
          className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8"
        >
          <Button
            as="a"
            href="/signup"
            size="lg"
            className="bg-indigo-500 hover:bg-indigo-400 text-white border-0 px-10 h-12 text-base font-semibold shadow-lg shadow-indigo-500/20 transition-colors"
            endContent={<ArrowRight className="size-4" />}
          >
            Get started free
          </Button>
          <Button
            as="a"
            href="/login"
            variant="bordered"
            size="lg"
            className="border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white px-10 h-12 text-base bg-transparent transition-colors"
          >
            Sign in
          </Button>
        </motion.div>

        <motion.div
          variants={v.item}
          className="flex flex-wrap items-center justify-center gap-2"
        >
          {trustSignals.map((s) => (
            <Chip
              key={s.text}
              startContent={<s.icon className="size-3.5" />}
              variant="bordered"
              size="sm"
              className="border-zinc-700 bg-zinc-900/60 text-zinc-400 text-xs"
            >
              {s.text}
            </Chip>
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
}
