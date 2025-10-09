"use client";

import { Button, Chip } from "@heroui/react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { CheckCircle, ArrowRight, BookOpenCheck, Shield, Zap, Stars, Sparkles } from "lucide-react";
import BrandWordmark from "./BrandWordmark";
import { AuroraBackground, InteractiveCursor } from "@/ui/backgrounds/AnimatedBackgrounds";
import { TypewriterText } from "@/ui/components/LoadingComponents";
import { v } from "@/ui/motion/variants";

interface HeroProps {
  variant?: "a" | "b";
  wordmarkVariant?: "aurora" | "neon" | "mono";
}

export default function Hero({ variant = "a", wordmarkVariant = "aurora" }: HeroProps) {
  const prefersReduced = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 1], [0, -100]);

  const heroContent = {
    a: {
      headline: "Resolve tickets 2× faster—with answers that cite your docs.",
      subheadline: "TicketPilot pairs a modern ticketing core with Gemini-powered replies grounded in your knowledge base. Every suggestion includes sources and confidence—so reps trust what they send."
    },
    b: {
      headline: "AI support that shows its work.",
      subheadline: "TicketPilot pairs a modern ticketing core with Gemini-powered replies grounded in your knowledge base. Every suggestion includes sources and confidence—so reps trust what they send."
    }
  };

  const content = heroContent[variant];

  // Use existing variants from our motion system
  const containerVariants = v.list;
  const itemVariants = v.item;

  return (
    <section className="relative overflow-hidden min-h-screen flex items-center">
      {/* Animated Backgrounds */}
      <AuroraBackground />
      <InteractiveCursor />
      
      {/* Additional floating elements */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Floating orbs */}
        {Array.from({ length: 6 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-primary/30 rounded-full blur-sm"
            style={{
              left: `${20 + i * 15}%`,
              top: `${30 + (i % 2) * 40}%`,
            }}
            animate={{
              y: [0, -20, 0],
              opacity: [0.3, 0.8, 0.3],
            }}
            transition={{
              duration: 3 + i * 0.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      <motion.div 
        className="mx-auto max-w-7xl px-6 py-32 text-center relative z-10"
        style={{ y: heroY }}
      >
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-8"
        >
          <motion.div variants={itemVariants}>
            <BrandWordmark variant={wordmarkVariant} size="lg" align="center" />
          </motion.div>
          
          <motion.div variants={itemVariants} className="space-y-6">
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-tight">
              <span className="inline-block">
                <span className="bg-gradient-to-r from-blue-400 via-purple-500 to-pink-400 bg-clip-text text-transparent">
                  <TypewriterText text="Resolve tickets" delay={0.5} />
                </span>
              </span>
              <br />
              <span className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 bg-clip-text text-transparent">
                <TypewriterText text="2× faster" delay={1.2} />
              </span>
              <br />
              <span className="text-foreground/90">
                <TypewriterText text="with answers that cite your docs." delay={1.8} />
              </span>
            </h1>

            <motion.p 
              className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed"
              variants={itemVariants}
            >
              {content.subheadline}
            </motion.p>
          </motion.div>

          <motion.div 
            variants={itemVariants}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <Button
                as="a"
                href="/signup"
                size="lg"
                className="bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white border-0 px-8 py-6 text-lg font-semibold shadow-lg shadow-primary/25"
                endContent={<ArrowRight className="size-5" />}
              >
                Start free
              </Button>
            </motion.div>
            
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <Button 
                as="a" 
                href="#how" 
                variant="bordered"
                size="lg"
                className="border-border/50 hover:border-primary/50 px-8 py-6 text-lg backdrop-blur-sm bg-surface/50"
              >
                See how it works
              </Button>
            </motion.div>
          </motion.div>

          <motion.div 
            variants={itemVariants}
            className="flex flex-wrap items-center justify-center gap-3"
          >
            {[
              { icon: BookOpenCheck, text: "Cited answers" },
              { icon: Zap, text: "Smart escalation" }, 
              { icon: Shield, text: "Enterprise roles" },
            ].map((feature, index) => (
              <motion.div
                key={feature.text}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ 
                  delay: 2.5 + index * 0.1, 
                  duration: 0.4,
                  ease: "easeOut",
                }}
                whileHover={{ scale: 1.05 }}
              >
                <Chip 
                  startContent={<feature.icon className="size-4" />} 
                  variant="bordered"
                  className="border-border/30 bg-surface/30 backdrop-blur-sm hover:border-primary/50 transition-colors"
                >
                  {feature.text}
                </Chip>
              </motion.div>
            ))}
          </motion.div>

          <motion.div variants={itemVariants}>
            <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Stars className="size-4 text-yellow-500" />
              No credit card required
              <Stars className="size-4 text-yellow-500" />
            </p>
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
          animate={{ y: [0, 10, 0] }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <div className="w-6 h-10 border-2 border-muted-foreground/30 rounded-full flex justify-center">
            <motion.div
              className="w-1 h-3 bg-primary rounded-full mt-2"
              animate={{ y: [0, 14, 0] }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}