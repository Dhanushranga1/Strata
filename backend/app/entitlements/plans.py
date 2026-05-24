from typing import TypedDict


class PlanDef(TypedDict):
    features: dict[str, bool]
    limits: dict[str, int]  # -1 = unlimited


PLANS: dict[str, PlanDef] = {
    "community": {
        "features": {
            "ai_rag":          False,
            "kb":              False,
            "sla_config":      False,
            "analytics":       False,
            "monthly_reports": False,
            "audit_log":       False,
        },
        "limits": {
            "agents":     5,
            "ai_queries": 0,
        },
    },
    "starter": {
        "features": {
            "ai_rag":          True,
            "kb":              True,
            "sla_config":      True,
            "analytics":       False,
            "monthly_reports": False,
            "audit_log":       False,
        },
        "limits": {
            "agents":     -1,
            "ai_queries": 5_000,
        },
    },
    "business": {
        "features": {
            "ai_rag":          True,
            "kb":              True,
            "sla_config":      True,
            "analytics":       True,
            "monthly_reports": True,
            "audit_log":       True,
        },
        "limits": {
            "agents":     -1,
            "ai_queries": 25_000,
        },
    },
    "enterprise": {
        "features": {
            "ai_rag":          True,
            "kb":              True,
            "sla_config":      True,
            "analytics":       True,
            "monthly_reports": True,
            "audit_log":       True,
        },
        "limits": {
            "agents":     -1,
            "ai_queries": -1,
        },
    },
}

# Maps feature -> minimum plan that unlocks it (for 402 error messages)
FEATURE_MIN_PLAN: dict[str, str] = {
    "ai_rag":          "starter",
    "kb":              "starter",
    "sla_config":      "starter",
    "analytics":       "business",
    "monthly_reports": "business",
    "audit_log":       "business",
}
