'use client';

import { motion, useReducedMotion } from 'framer-motion';
import {
  Activity,
  BarChart3,
  BrainCircuit,
  GitBranch,
  Route,
  Target,
} from 'lucide-react';

const features = [
  {
    icon: Target,
    title: 'Intent Classification',
    body: 'Classifies each query as factual, procedural, troubleshooting, or comparison using compiled regex patterns. Selects the purpose-built weight matrix for that type.',
    iconClass: 'text-indigo-400',
  },
  {
    icon: BarChart3,
    title: '6-Factor Confidence',
    body: 'Retrieval quality, citation coverage, semantic coherence, completeness, density, and diversity — blended with softmax-mixed intent weights, not a static formula.',
    iconClass: 'text-violet-400',
  },
  {
    icon: Route,
    title: 'Load-Balanced Routing',
    body: 'Complex/urgent tickets go to senior reps; standard tickets go to the lowest-load rep. Load is tracked in-process per request to stay balanced.',
    iconClass: 'text-emerald-400',
  },
  {
    icon: Activity,
    title: 'KB-Density Calibration',
    body: 'Confidence is multiplied by a log-sigmoid function of KB size. A sparse 5-doc KB gets a trust discount; a 1,000-chunk KB scores at near-full confidence.',
    iconClass: 'text-orange-400',
  },
  {
    icon: GitBranch,
    title: 'Intent-Adaptive MMR',
    body: 'Retrieval diversity is tuned per intent. Troubleshooting uses λ=0.55 (wide diversity net); factual queries use λ=0.82 (precision-first, one authoritative source).',
    iconClass: 'text-cyan-400',
  },
  {
    icon: BrainCircuit,
    title: 'Adaptive Escalation',
    body: 'Escalation thresholds are not fixed numbers. They adapt to intent, KB health, and query complexity — cutting false escalations on simple factual lookups.',
    iconClass: 'text-pink-400',
  },
];

export default function CASPERSpotlight() {
  const prefersReduced = useReducedMotion();

  return (
    <section className="mx-auto max-w-6xl px-6 py-16 lg:py-24">
      <div className="text-center mb-12">
        <motion.div
          initial={prefersReduced ? {} : { opacity: 0, scale: 0.9 }}
          whileInView={prefersReduced ? {} : { opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="flex justify-center mb-4"
        >
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-indigo-500/25 bg-indigo-500/10 text-indigo-300 text-sm font-medium">
            <BrainCircuit className="w-3.5 h-3.5" />
            Under the hood
          </span>
        </motion.div>
        <motion.h2
          initial={prefersReduced ? {} : { opacity: 0, y: 8 }}
          whileInView={prefersReduced ? {} : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-3xl lg:text-4xl font-bold tracking-tight text-white font-geist mb-4"
        >
          Meet CASPER
        </motion.h2>
        <motion.p
          initial={prefersReduced ? {} : { opacity: 0, y: 8 }}
          whileInView={prefersReduced ? {} : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-zinc-400 max-w-2xl mx-auto"
        >
          <strong className="text-zinc-200">
            Contextual Adaptive Scoring with Probabilistic Ensemble Ranking.
          </strong>{' '}
          Unlike static RAG pipelines that apply the same weights to every
          query, CASPER adapts its scoring model based on what kind of question
          is being asked and how dense your knowledge base is.
        </motion.p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {features.map((f, i) => {
          const Icon = f.icon;
          return (
            <motion.div
              key={f.title}
              initial={prefersReduced ? {} : { opacity: 0, y: 10 }}
              whileInView={prefersReduced ? {} : { opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.07 }}
              className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 hover:border-zinc-700 transition-colors"
            >
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
                  <Icon className={`w-4 h-4 ${f.iconClass}`} />
                </div>
                <h3 className="font-semibold text-sm text-white font-geist">
                  {f.title}
                </h3>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed">{f.body}</p>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
