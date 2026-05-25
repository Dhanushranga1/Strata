'use client';

import { motion } from 'framer-motion';

// Modern spinner with Midnight Prism colors
export function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <motion.div
      className={`${sizeClasses[size]} relative`}
      animate={{ rotate: 360 }}
      transition={{
        duration: 1,
        repeat: Infinity,
        ease: 'linear',
      }}
    >
      <div className="absolute inset-0 rounded-full border-2 border-muted"></div>
      <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary"></div>
    </motion.div>
  );
}

// Pulsing dots loader
export function PulsingDots() {
  return (
    <div className="flex items-center space-x-1">
      {[0, 1, 2].map(index => (
        <motion.div
          key={index}
          className="w-2 h-2 bg-primary rounded-full"
          animate={{
            scale: [1, 1.5, 1],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            delay: index * 0.2,
          }}
        />
      ))}
    </div>
  );
}

// Success animation checkmark
export function SuccessCheckmark({
  size = 'md',
}: {
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <motion.div
      className={`${sizeClasses[size]} relative`}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 10 }}
    >
      <motion.svg
        className="w-full h-full text-success"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <motion.path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M5 13l4 4L19 7"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        />
      </motion.svg>
    </motion.div>
  );
}

// Floating action button with ripple effect
export function FloatingButton({
  children,
  onClick,
  className = '',
  disabled,
  type = 'button',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}) {
  return (
    <motion.button
      className={`relative overflow-hidden rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl ${className}`}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      disabled={disabled}
      type={type}
    >
      <motion.div
        className="absolute inset-0 bg-white"
        initial={{ scale: 0, opacity: 0.5 }}
        whileTap={{ scale: 4, opacity: 0 }}
        transition={{ duration: 0.3 }}
      />
      {children}
    </motion.button>
  );
}

// Shimmer loading effect for cards
export function ShimmerCard({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse ${className}`}>
      <div className="bg-muted/50 rounded-lg p-6 space-y-4">
        <div className="flex items-center space-x-4">
          <div className="rounded-full bg-muted h-10 w-10"></div>
          <div className="space-y-2 flex-1">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-3 bg-muted rounded w-1/2"></div>
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-3 bg-muted rounded"></div>
          <div className="h-3 bg-muted rounded w-5/6"></div>
        </div>
      </div>
    </div>
  );
}

// Typing animation for text
export function TypewriterText({
  text,
  delay = 0,
}: {
  text: string;
  delay?: number;
}) {
  return (
    <motion.span
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay }}
    >
      {text.split('').map((char, index) => (
        <motion.span
          key={index}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            duration: 0.05,
            delay: delay + index * 0.05,
          }}
        >
          {char}
        </motion.span>
      ))}
    </motion.span>
  );
}
