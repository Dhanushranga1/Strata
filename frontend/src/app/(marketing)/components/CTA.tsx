"use client";

import { Button, Chip } from "@heroui/react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, Check, Shield, Sparkles, Zap, Stars, Trophy, Rocket, Users } from "lucide-react";
import { AuroraBackground, InteractiveCursor } from "../../../ui/backgrounds/AnimatedBackgrounds";
import { TypewriterText } from "../../../ui/components/LoadingComponents";
import { v } from "../../../ui/motion/variants";

const trustSignals = [
  { icon: Shield, text: "No credit card required" },
  { icon: Zap, text: "Setup in 2 minutes" },
  { icon: Trophy, text: "14-day free trial" },
  { icon: Users, text: "Cancel anytime" }
];

const metrics = [
  { value: "2x", label: "Faster resolution" },
  { value: "99.9%", label: "Uptime SLA" },
  { value: "500+", label: "Happy teams" },
  { value: "24/7", label: "Support" }
];

export default function CTA() {
  const prefersReduced = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const ctaY = useTransform(scrollYProgress, [0.7, 1], [0, -50]);

  const handleStartFree = () => {
    // Analytics event
    if (typeof window !== "undefined" && (window as any).gtag) { // eslint-disable-line @typescript-eslint/no-explicit-any
      (window as any).gtag("event", "click", { // eslint-disable-line @typescript-eslint/no-explicit-any
        event_category: "CTA",
        event_label: "StartFree",
        event_action: "footer"
      });
    }
  };

  return (
    <section className="relative overflow-hidden min-h-screen flex items-center">
      {/* Animated Backgrounds - matching Hero */}
      <AuroraBackground />
      <InteractiveCursor />
      
      {/* Additional floating elements - matching Hero pattern */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 8 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1.5 h-1.5 bg-secondary/40 rounded-full blur-sm"
            style={{
              left: `${15 + i * 12}%`,
              top: `${25 + (i % 3) * 25}%`,
            }}
            animate={{
              y: [0, -25, 0],
              opacity: [0.4, 0.8, 0.4],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 4 + i * 0.3,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.2,
            }}
          />
        ))}
      </div>

      <motion.div 
        className="mx-auto max-w-6xl px-6 text-center relative z-10"
        style={{ y: ctaY }}
      >
        <motion.div
          variants={v.list}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="space-y-8"
        >
          {/* Decorative header - matching Hero's BrandWordmark pattern */}
          <motion.div variants={v.item}>
            <motion.div 
              className="mx-auto w-20 h-20 mb-8 rounded-2xl bg-gradient-to-br from-secondary/20 to-primary/20 backdrop-blur-xl border border-secondary/20 flex items-center justify-center shadow-2xl"
              whileHover={{ scale: 1.05, rotate: 5 }}
              animate={{ 
                rotate: [0, -2, 2, 0],
              }}
              transition={{ 
                rotate: { duration: 6, repeat: Infinity, ease: "easeInOut" },
                scale: { duration: 0.3 }
              }}
            >
              <Rocket className="w-8 h-8 text-primary" />
            </motion.div>
          </motion.div>
          
          {/* Main headline - matching Hero typography */}
          <motion.div variants={v.item} className="space-y-6">
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
              <span className="bg-gradient-to-r from-blue-400 via-purple-500 to-pink-400 bg-clip-text text-transparent">
                <TypewriterText text="Ready to transform" delay={0.2} />
              </span>
              <br />
              <span className="text-foreground/90">
                <TypewriterText text="your support experience?" delay={0.8} />
              </span>
            </h2>

            <motion.p 
              className="text-lg sm:text-xl text-muted-foreground max-w-4xl mx-auto leading-relaxed"
              variants={v.item}
            >
              Join thousands of teams delivering faster, smarter customer support with AI-powered insights, seamless knowledge management, and intelligent automation that actually works.
            </motion.p>
          </motion.div>

          {/* CTA Buttons - matching Hero pattern */}
          <motion.div 
            variants={v.item}
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
                className="bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white border-0 px-10 py-6 text-lg font-semibold shadow-lg shadow-primary/25"
                endContent={<ArrowRight className="size-5" />}
                onPress={handleStartFree}
              >
                Start Free Trial
              </Button>
            </motion.div>
            
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <Button 
                as="a" 
                href="/contact" 
                variant="bordered"
                size="lg"
                className="border-border/50 hover:border-primary/50 px-10 py-6 text-lg backdrop-blur-sm bg-surface/50"
              >
                Book a Demo
              </Button>
            </motion.div>
          </motion.div>

          {/* Trust signals - matching Hero chips pattern */}
          <motion.div 
            variants={v.item}
            className="flex flex-wrap items-center justify-center gap-3"
          >
            {trustSignals.map((signal, index) => (
              <motion.div
                key={signal.text}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ 
                  delay: 1.2 + index * 0.1, 
                  duration: 0.4,
                  ease: "easeOut",
                }}
                whileHover={{ scale: 1.05 }}
              >
                <Chip 
                  startContent={<signal.icon className="size-4" />} 
                  variant="bordered"
                  className="border-border/30 bg-surface/30 backdrop-blur-sm hover:border-primary/50 transition-colors"
                >
                  {signal.text}
                </Chip>
              </motion.div>
            ))}
          </motion.div>

          {/* Metrics grid */}
          <motion.div 
            variants={v.item}
            className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto mt-16"
          >
            {metrics.map((metric, index) => (
              <motion.div
                key={metric.label}
                className="bg-surface/30 backdrop-blur-xl border border-border/20 rounded-xl p-6 text-center hover:bg-surface/40 transition-all duration-300"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 1.5 + index * 0.1, duration: 0.5 }}
                whileHover={{ scale: 1.02, y: -2 }}
              >
                <div className="text-2xl lg:text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-2">
                  {metric.value}
                </div>
                <div className="text-sm text-muted-foreground font-medium">
                  {metric.label}
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Security footer - matching Hero's final element */}
          <motion.div variants={v.item} className="pt-8">
            <p className="text-sm text-muted-foreground flex items-center justify-center gap-4 flex-wrap">
              <span className="flex items-center gap-2">
                <Shield className="size-4 text-green-500" />
                Enterprise Security
              </span>
              <span className="flex items-center gap-2">
                <Stars className="size-4 text-yellow-500" />
                SOC 2 Compliant
              </span>
              <span className="flex items-center gap-2">
                <Shield className="size-4 text-blue-500" />
                GDPR Ready
              </span>
            </p>
          </motion.div>
        </motion.div>
      </motion.div>
    </section>
  );
}