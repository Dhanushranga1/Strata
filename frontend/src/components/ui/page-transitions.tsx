/**
 * Smooth Page Transitions
 * Wraps page content with fade-in and slide-up animations
 */

import { motion, AnimatePresence } from "framer-motion"
import { ReactNode } from "react"

export interface PageTransitionProps {
  children: ReactNode
  /**
   * Unique key for the page (usually pathname)
   */
  pageKey?: string
  /**
   * Animation variant
   */
  variant?: "fade" | "slide" | "scale" | "none"
  /**
   * Custom className
   */
  className?: string
}

const variants = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  slide: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  },
  scale: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 1.05 },
  },
  none: {
    initial: {},
    animate: {},
    exit: {},
  },
}

export function PageTransition({
  children,
  pageKey,
  variant = "slide",
  className = "",
}: PageTransitionProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pageKey}
        initial={variants[variant].initial}
        animate={variants[variant].animate}
        exit={variants[variant].exit}
        transition={{
          duration: 0.2,
          ease: "easeInOut",
        }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

/**
 * Stagger Children Animation
 * Animates children with a stagger effect
 */
export interface StaggerProps {
  children: ReactNode
  /**
   * Delay between each child animation (in seconds)
   */
  staggerDelay?: number
  /**
   * Custom className
   */
  className?: string
}

export function StaggerChildren({
  children,
  staggerDelay = 0.1,
  className = "",
}: StaggerProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        visible: {
          transition: {
            staggerChildren: staggerDelay,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/**
 * Stagger Item
 * Individual item in a staggered animation
 */
export interface StaggerItemProps {
  children: ReactNode
  /**
   * Custom className
   */
  className?: string
}

export function StaggerItem({ children, className = "" }: StaggerItemProps) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 },
      }}
      transition={{ duration: 0.3 }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/**
 * Slide In From Side
 * Animates content sliding in from left, right, top, or bottom
 */
export interface SlideInProps {
  children: ReactNode
  from?: "left" | "right" | "top" | "bottom"
  delay?: number
  duration?: number
  className?: string
}

export function SlideIn({
  children,
  from = "bottom",
  delay = 0,
  duration = 0.4,
  className = "",
}: SlideInProps) {
  const directions = {
    left: { x: -50, y: 0 },
    right: { x: 50, y: 0 },
    top: { x: 0, y: -50 },
    bottom: { x: 0, y: 50 },
  }

  return (
    <motion.div
      initial={{ opacity: 0, ...directions[from] }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration, delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/**
 * Scale In Animation
 * Scales element from small to normal size
 */
export interface ScaleInProps {
  children: ReactNode
  delay?: number
  duration?: number
  className?: string
}

export function ScaleIn({
  children,
  delay = 0,
  duration = 0.3,
  className = "",
}: ScaleInProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        duration,
        delay,
        type: "spring",
        stiffness: 300,
        damping: 25,
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/**
 * Hover Scale Effect
 * Scales element on hover with spring animation
 */
export interface HoverScaleProps {
  children: ReactNode
  scale?: number
  className?: string
}

export function HoverScale({
  children,
  scale = 1.05,
  className = "",
}: HoverScaleProps) {
  return (
    <motion.div
      whileHover={{ scale }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
