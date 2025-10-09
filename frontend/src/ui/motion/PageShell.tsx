'use client'
import { m } from 'framer-motion'
import { usePathname } from 'next/navigation'
import { v, durations, easings } from './variants'

export function PageShell({ children }: { children: React.ReactNode }) {
  const key = usePathname()
  
  return (
    <m.div
      key={key}
      variants={v.fade}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{
        duration: durations.base,
        ease: easings.standard
      }}
      className="w-full"
    >
      {children}
    </m.div>
  )
}