"use client"

import { useEntitlements } from "@/hooks/useEntitlements"
import { UpgradeBanner } from "./UpgradeBanner"
import type { PlanId } from "@/lib/plans"

interface FeatureGateProps {
  feature: string
  requiredPlan?: PlanId
  description?: string
  /** If true, render nothing (instead of UpgradeBanner) when locked */
  silent?: boolean
  children: React.ReactNode
}

export function FeatureGate({ feature, requiredPlan, description, silent = false, children }: FeatureGateProps) {
  const { can } = useEntitlements()

  if (can(feature)) return <>{children}</>
  if (silent) return null
  return <UpgradeBanner feature={feature} requiredPlan={requiredPlan} description={description} />
}
