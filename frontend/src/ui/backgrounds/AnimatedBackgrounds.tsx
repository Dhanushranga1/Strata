"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";

// Floating Orbs Background - Inspired by modern SaaS landing pages
export function FloatingOrbs() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll();
  const y1 = useTransform(scrollYProgress, [0, 1], [0, -100]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, -200]);

  const orbs = [
    {
      size: "w-72 h-72",
      position: "top-1/4 left-1/4",
      gradient: "from-primary/20 via-secondary/10 to-transparent",
      delay: 0,
      duration: 20,
    },
    {
      size: "w-96 h-96",
      position: "top-3/4 right-1/4", 
      gradient: "from-secondary/15 via-accent/8 to-transparent",
      delay: 5,
      duration: 25,
    },
    {
      size: "w-80 h-80",
      position: "bottom-1/4 left-1/3",
      gradient: "from-accent/20 via-primary/5 to-transparent",
      delay: 10,
      duration: 30,
    },
  ];

  return (
    <div ref={containerRef} className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {orbs.map((orb, index) => (
        <motion.div
          key={index}
          className={`absolute ${orb.size} ${orb.position} bg-gradient-radial ${orb.gradient} blur-3xl rounded-full`}
          style={{ y: index % 2 === 0 ? y1 : y2 }}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.6, 0.3],
            rotate: [0, 360],
          }}
          transition={{
            duration: orb.duration,
            delay: orb.delay,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      ))}
      
      {/* Mesh gradient overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.1),transparent_50%),radial-gradient(circle_at_80%_80%,rgba(139,92,246,0.1),transparent_50%),radial-gradient(circle_at_40%_40%,rgba(59,130,246,0.05),transparent_50%)]" />
    </div>
  );
}

// Animated Grid Background
export function AnimatedGrid() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 -z-10 pointer-events-none">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgb(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,rgb(var(--border))_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_110%)] opacity-20" />
      
      {/* Animated grid squares */}
      <div className="absolute inset-0">
        {Array.from({ length: 20 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-primary rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              scale: [0, 1, 0],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 3,
              delay: Math.random() * 2,
              repeat: Infinity,
              repeatDelay: Math.random() * 3,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// Particle Flow Background - Modern tech aesthetic
export function ParticleFlow() {
  const particles = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 4 + 1,
    speed: Math.random() * 0.5 + 0.1,
  }));

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute rounded-full bg-gradient-to-r from-primary/40 to-secondary/20"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
          }}
          animate={{
            x: [-20, 20],
            y: [-20, 20],
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: particle.speed * 20,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      ))}
      
      {/* Flowing lines */}
      <svg className="absolute inset-0 w-full h-full">
        {Array.from({ length: 5 }).map((_, i) => (
          <motion.path
            key={i}
            d={`M${i * 200},0 Q${i * 200 + 100},200 ${i * 200 + 200},400 T${i * 200 + 400},800`}
            stroke="url(#gradient)"
            strokeWidth="1"
            fill="none"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.3 }}
            transition={{
              duration: 3,
              delay: i * 0.5,
              repeat: Infinity,
              repeatType: "reverse",
            }}
          />
        ))}
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgb(var(--primary))" stopOpacity="0.5" />
            <stop offset="100%" stopColor="rgb(var(--secondary))" stopOpacity="0.1" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

// Aurora Background - Inspired by GitHub's design
export function AuroraBackground() {
  const { scrollYProgress } = useScroll();
  const opacity = useTransform(scrollYProgress, [0, 0.3], [1, 0]);

  return (
    <motion.div 
      className="fixed inset-0 -z-10 pointer-events-none"
      style={{ opacity }}
    >
      {/* Aurora effect */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_20%_40%,rgba(99,102,241,0.15),transparent),radial-gradient(ellipse_80%_80%_at_80%_50%,rgba(139,92,246,0.1),transparent),radial-gradient(ellipse_100%_60%_at_60%_60%,rgba(236,72,153,0.1),transparent)]" />
      
      {/* Moving aurora streams */}
      <motion.div
        className="absolute inset-0 bg-[conic-gradient(from_0deg_at_50%_50%,rgba(99,102,241,0.1)_0deg,transparent_60deg,transparent_300deg,rgba(139,92,246,0.1)_360deg)]"
        animate={{ rotate: 360 }}
        transition={{
          duration: 60,
          repeat: Infinity,
          ease: "linear",
        }}
      />
      
      {/* Subtle noise texture */}
      <div className="absolute inset-0 opacity-[0.015] bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iYSIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIj48cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIGZpbGw9IiMwMDAiLz48Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIxIiBmaWxsPSIjZmZmIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2EpIi8+PC9zdmc+')]" />
    </motion.div>
  );
}

// Mesh Gradient Background - Apple-style
export function MeshGradient() {
  return (
    <div className="fixed inset-0 -z-10 pointer-events-none">
      {/* Base dark background */}
      <div className="absolute inset-0 bg-background" />
      
      {/* Animated mesh gradients */}
      <motion.div
        className="absolute inset-0"
        animate={{
          background: [
            "radial-gradient(600px circle at 20% 30%, rgba(99,102,241,0.15), transparent 40%), radial-gradient(800px circle at 80% 70%, rgba(139,92,246,0.1), transparent 40%), radial-gradient(400px circle at 40% 80%, rgba(236,72,153,0.1), transparent 40%)",
            "radial-gradient(600px circle at 80% 20%, rgba(99,102,241,0.15), transparent 40%), radial-gradient(800px circle at 20% 80%, rgba(139,92,246,0.1), transparent 40%), radial-gradient(400px circle at 60% 40%, rgba(236,72,153,0.1), transparent 40%)",
            "radial-gradient(600px circle at 40% 70%, rgba(99,102,241,0.15), transparent 40%), radial-gradient(800px circle at 70% 30%, rgba(139,92,246,0.1), transparent 40%), radial-gradient(400px circle at 20% 50%, rgba(236,72,153,0.1), transparent 40%)",
          ],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "linear",
        }}
      />
      
      {/* Noise overlay for texture */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48ZmlsdGVyIGlkPSJub2lzZSI+PGZlVHVyYnVsZW5jZSB0eXBlPSJmcmFjdGFsTm9pc2UiIGJhc2VGcmVxdWVuY3k9IjAuOSIgbnVtT2N0YXZlcz0iNCIgc3RpdGNoVGlsZXM9InN0aXRjaCIvPjwvZmlsdGVyPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWx0ZXI9InVybCgjbm9pc2UpIiBvcGFjaXR5PSIwLjAyIi8+PC9zdmc+')] opacity-30" />
    </div>
  );
}

// Interactive Cursor Follow Effect - For landing page hero
export function InteractiveCursor() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const updateMousePosition = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener("mousemove", updateMousePosition);
    return () => window.removeEventListener("mousemove", updateMousePosition);
  }, []);

  return (
    <motion.div
      className="fixed inset-0 -z-10 pointer-events-none"
      animate={{
        background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(99,102,241,0.05), transparent 40%)`,
      }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    />
  );
}