export type PlanId = 'community' | 'starter' | 'business' | 'enterprise'

interface PlanDef {
  features: Record<string, boolean>
  limits: Record<string, number>  // -1 = unlimited
}

export const PLANS: Record<PlanId, PlanDef> = {
  community: {
    features: {
      ai_rag:          false,
      kb:              false,
      sla_config:      false,
      analytics:       false,
      monthly_reports: false,
      audit_log:       false,
    },
    limits: {
      agents:     5,
      ai_queries: 0,
    },
  },
  starter: {
    features: {
      ai_rag:          true,
      kb:              true,
      sla_config:      true,
      analytics:       false,
      monthly_reports: false,
      audit_log:       false,
    },
    limits: {
      agents:     -1,
      ai_queries: 5_000,
    },
  },
  business: {
    features: {
      ai_rag:          true,
      kb:              true,
      sla_config:      true,
      analytics:       true,
      monthly_reports: true,
      audit_log:       true,
    },
    limits: {
      agents:     -1,
      ai_queries: 25_000,
    },
  },
  enterprise: {
    features: {
      ai_rag:          true,
      kb:              true,
      sla_config:      true,
      analytics:       true,
      monthly_reports: true,
      audit_log:       true,
    },
    limits: {
      agents:     -1,
      ai_queries: -1,
    },
  },
}

// Minimum plan required to unlock each feature (for upgrade messaging)
export const FEATURE_MIN_PLAN: Record<string, PlanId> = {
  ai_rag:          'starter',
  kb:              'starter',
  sla_config:      'starter',
  analytics:       'business',
  monthly_reports: 'business',
  audit_log:       'business',
}
