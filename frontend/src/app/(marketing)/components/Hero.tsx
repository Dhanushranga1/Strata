'use client';

import { Button, Chip } from '@heroui/react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, BookOpenCheck, BrainCircuit, Zap } from 'lucide-react';
import BrandWordmark from './BrandWordmark';
import { InteractiveCursor } from '@/ui/backgrounds/AnimatedBackgrounds';
import { v } from '@/ui/motion/variants';

interface HeroProps {
  variant?: 'a' | 'b';
  wordmarkVariant?: 'aurora' | 'neon' | 'mono';
}

export default function Hero({
  variant = 'a',
  wordmarkVariant = 'aurora',
}: HeroProps) {
  const prefersReduced = useReducedMotion();

  return (
    <section className="relative overflow-hidden min-h-screen flex items-center bg-zinc-950">
      {/* Subtle radial glow — hero only, low opacity */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(91,124,255,0.12),transparent)] pointer-events-none" />
      {/* Dot grid */}
      <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
      {/* Mouse follow — very subtle */}
      <InteractiveCursor />

      <motion.div
        className="mx-auto max-w-5xl px-6 py-32 text-center relative z-10"
        variants={v.list}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={v.item} className="mb-8">
          <BrandWordmark variant={wordmarkVariant} size="lg" align="center" />
        </motion.div>

        {/* Audience badge */}
        <motion.div variants={v.item} className="flex justify-center mb-6">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-indigo-500/25 bg-indigo-500/10 text-indigo-300 text-sm font-medium">
            <BrainCircuit className="w-3.5 h-3.5" />
            Built for SaaS support teams
          </span>
        </motion.div>

        {/* Headline — one gradient, rest is plain white */}
        <motion.h1
          variants={v.item}
          className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6 text-white"
        >
          Resolve tickets{' '}
          <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
            2× faster
          </span>
          <br />
          with answers that cite your docs.
        </motion.h1>

        <motion.p
          variants={v.item}
          className="text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed mb-10"
        >
          TicketPilot combines a full ticketing system with CASPER — an adaptive
          AI engine that automatically routes tickets, drafts KB-grounded
          replies with citations, and escalates based on real confidence, not
          guesswork.
        </motion.p>

        {/* CTAs */}
        <motion.div
          variants={v.item}
          className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10"
        >
          <Button
            as="a"
            href="/signup"
            size="lg"
            className="bg-indigo-500 hover:bg-indigo-400 text-white border-0 px-8 h-12 text-base font-semibold shadow-lg shadow-indigo-500/20 transition-colors"
            endContent={<ArrowRight className="size-4" />}
          >
            Start free
          </Button>
          <Button
            as="a"
            href="#how"
            variant="bordered"
            size="lg"
            className="border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white px-8 h-12 text-base bg-transparent transition-colors"
          >
            See how it works
          </Button>
        </motion.div>

        {/* Feature chips */}
        <motion.div
          variants={v.item}
          className="flex flex-wrap items-center justify-center gap-2"
        >
          {[
            { icon: BrainCircuit, text: 'CASPER auto-routing' },
            { icon: BookOpenCheck, text: 'Cited KB answers' },
            { icon: Zap, text: 'P1–P7 priority scoring' },
          ].map(f => (
            <Chip
              key={f.text}
              startContent={<f.icon className="size-3.5" />}
              variant="bordered"
              size="sm"
              className="border-zinc-700 bg-zinc-900/60 text-zinc-400 text-xs"
            >
              {f.text}
            </Chip>
          ))}
        </motion.div>

        <motion.p variants={v.item} className="text-xs text-zinc-600 mt-6">
          No credit card required · Setup in under 5 minutes
        </motion.p>
      </motion.div>

      {/* Bottom fade to next section */}
      <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-zinc-950 to-transparent pointer-events-none" />
    </section>
  );
}
