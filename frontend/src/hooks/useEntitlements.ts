"use client"

import { useOrganization } from "@/contexts/OrganizationContext"
import { FEATURE_MIN_PLAN, PLANS, type PlanId } from "@/lib/plans"

export function useEntitlements() {
  const { currentOrganization } = useOrganization()
  const planId = ((currentOrganization?.plan_id) ?? "community") as PlanId
  const plan = PLANS[planId] ?? PLANS.community

  const can = (feature: string): boolean => plan.features[feature] ?? false
  const limit = (name: string): number => plan.limits[name] ?? 0
  const upgradeUrl = (targetPlan?: string): string => {
    const target = targetPlan ?? FEATURE_MIN_PLAN["ai_rag"] ?? "starter"
    return `/pricing?highlight=${target}`
  }

  return { planId, can, limit, upgradeUrl }
}
