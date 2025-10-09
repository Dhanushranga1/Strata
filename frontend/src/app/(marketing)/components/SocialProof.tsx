"use client";

import { Card, CardBody, Chip, Kbd } from "@heroui/react";
import { motion, useReducedMotion } from "framer-motion";

const lines = [
  "Q: Warranty window for Model X in EU?",
  "→ Searching KB…",
  "→ Top sources: /warranty.md §4, /eu-policy.pdf p.12",
  "Draft:",
  '"Model X includes a 24-month warranty across EU member states..."',
];

export default function SocialProof() {
  const prefersReduced = useReducedMotion();
  return (
    <section id="how" className="mx-auto max-w-5xl px-6 py-16">
      <h2 className="text-3xl md:text-4xl font-semibold mb-6">AI answers, with sources</h2>
      <Card className="rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.04)] dark:bg-white/5 backdrop-blur">
        <CardBody className="p-6 font-mono text-sm">
          {lines.map((l,i)=>(
            <motion.div
              key={i}
              initial={prefersReduced ? {opacity:1} : {opacity:0}}
              whileInView={{opacity:1}}
              transition={{delay:0.1*i}}
              className="whitespace-pre-wrap"
            >
              {l}
            </motion.div>
          ))}
          <div className="mt-4 flex flex-wrap gap-2">
            <Chip variant="flat">Sources: warranty.md §4</Chip>
            <Chip variant="flat">eu-policy.pdf p.12</Chip>
            <Chip variant="flat" color="success">Confidence: High</Chip>
          </div>
          <p className="mt-4 text-[rgb(var(--muted))]">
            Tip: refine scope with <Kbd>EU</Kbd> <Kbd>Model X</Kbd> <Kbd>Warranty</Kbd>
          </p>
        </CardBody>
      </Card>
    </section>
  );
}