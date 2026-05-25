'use client';

import { Chip } from '@heroui/react';
import { motion, useReducedMotion } from 'framer-motion';

const terminalLines = [
  {
    text: "$ ticket created: 'Login fails after password reset'",
    color: 'text-muted-foreground',
  },
  { text: '  → CASPER profiling…', color: 'text-blue-400' },
  {
    text: '  intent: troubleshooting  complexity: 0.72  urgency: 0.50',
    color: 'text-purple-400',
  },
  { text: '  priority: P2  requires_senior: true', color: 'text-orange-400' },
  {
    text: '  → Routing to senior rep: sarah@company.com (load: 3)',
    color: 'text-green-400',
  },
  { text: '', color: '' },
  { text: '$ AI drafting response…', color: 'text-muted-foreground' },
  {
    text: '  KB search: 24 candidates → MMR → 6 chunks (troubleshooting λ=0.55)',
    color: 'text-blue-400',
  },
  {
    text: '  context_relevance: 0.83  source_diversity: 0.71',
    color: 'text-purple-400',
  },
  {
    text: '  confidence: 0.81  threshold: 0.52  escalate: false',
    color: 'text-green-400',
  },
  { text: '', color: '' },
  {
    text: '  "After a password reset, cached sessions may persist. [1]',
    color: 'text-foreground',
  },
  {
    text: '   Clear browser cookies and retry. If the issue persists,',
    color: 'text-foreground',
  },
  {
    text: '   check SSO config under Settings > Auth. [2][3]"',
    color: 'text-foreground',
  },
];

export default function SocialProof() {
  const prefersReduced = useReducedMotion();

  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      <div className="text-center mb-10">
        <motion.h2
          initial={prefersReduced ? {} : { opacity: 0, y: 8 }}
          whileInView={prefersReduced ? {} : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-3xl md:text-4xl font-bold tracking-tight text-foreground font-geist mb-3"
        >
          See it in action
        </motion.h2>
        <motion.p
          initial={prefersReduced ? {} : { opacity: 0, y: 8 }}
          whileInView={prefersReduced ? {} : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-muted-foreground"
        >
          From ticket creation to AI-drafted, cited reply — fully automated.
        </motion.p>
      </div>

      {/* Terminal card */}
      <motion.div
        initial={prefersReduced ? {} : { opacity: 0, y: 16 }}
        whileInView={prefersReduced ? {} : { opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="rounded-2xl border border-white/10 bg-zinc-950/80 backdrop-blur-sm overflow-hidden"
      >
        {/* Terminal chrome */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-white/5 bg-zinc-900/60">
          <div className="w-3 h-3 rounded-full bg-red-500/70" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
          <div className="w-3 h-3 rounded-full bg-green-500/70" />
          <span className="ml-3 text-xs text-muted-foreground font-mono">
            ticketpilot — casper routing
          </span>
        </div>

        <div className="p-6 font-mono text-sm space-y-1">
          {terminalLines.map((line, i) => (
            <motion.p
              key={i}
              initial={prefersReduced ? { opacity: 1 } : { opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.05 * i, duration: 0.3 }}
              className={`leading-relaxed ${line.color}`}
            >
              {line.text || ' '}
            </motion.p>
          ))}
        </div>

        {/* Source chips */}
        <div className="px-6 pb-6 flex flex-wrap gap-2">
          <Chip variant="flat" size="sm">
            Source [1]: auth-troubleshooting.md §3
          </Chip>
          <Chip variant="flat" size="sm">
            Source [2]: session-management.pdf p.7
          </Chip>
          <Chip variant="flat" size="sm">
            Source [3]: sso-config.md §2.1
          </Chip>
          <Chip variant="flat" size="sm" color="success">
            Confidence: 0.81 · No escalation
          </Chip>
          <Chip variant="flat" size="sm" color="warning">
            P2 · Assigned: sarah@company.com
          </Chip>
        </div>
      </motion.div>
    </section>
  );
}
