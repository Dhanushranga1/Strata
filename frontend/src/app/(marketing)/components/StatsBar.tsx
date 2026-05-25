'use client';

import { motion, useReducedMotion } from 'framer-motion';

const stats = [
  { value: '4', label: 'Query intent classes' },
  { value: '6', label: 'Confidence factors' },
  { value: 'P1–P7', label: 'Priority levels' },
  { value: 'MMR', label: 'Intent-adaptive retrieval' },
  { value: '0-admin', label: 'Ticket routing setup' },
  { value: '60 s', label: 'KB cache TTL' },
];

export default function StatsBar() {
  const prefersReduced = useReducedMotion();

  return (
    <div className="border-y border-zinc-800 bg-zinc-900/40">
      <div className="mx-auto max-w-6xl px-6 py-5">
        <div className="grid grid-cols-3 md:grid-cols-6 gap-6 md:gap-0 md:divide-x md:divide-zinc-800">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={prefersReduced ? {} : { opacity: 0, y: 6 }}
              whileInView={prefersReduced ? {} : { opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
              className="text-center md:px-6"
            >
              <div className="text-lg font-bold text-white font-mono tracking-tight">
                {s.value}
              </div>
              <div className="text-xs text-zinc-500 mt-0.5 leading-tight">
                {s.label}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
