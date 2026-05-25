'use client';
import { LazyMotion, domAnimation, MotionConfig } from 'framer-motion';

export default function MotionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LazyMotion features={domAnimation}>
      <MotionConfig
        reducedMotion="user"
        transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
      >
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}
