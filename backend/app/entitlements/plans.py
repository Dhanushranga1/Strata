from typing import TypedDict


class PlanDef(TypedDict):
    features: dict[str, bool]
    limits: dict[str, int]  # -1 = unlimited


_COMMUNITY_FEATURES = {
    "ai_rag":          False,
    "kb":              False,
    "know_base":       False,
    "sla_config":      False,
    "analytics":       False,
    "monthly_reports": False,
    "audit_log":       False,
    "billing":         False,
    "assets":          False,
    "contracts":       False,
    "procurement":     False,
    "service_hub":     False,
    "patches":         False,
    "cost_lens":       False,
    "change_board":    False,
    "incidents":       False,
    "flowbot":         False,
    "status_cast":     False,
    "people_sync":     False,
}

_STARTER_FEATURES = {**_COMMUNITY_FEATURES,
    "ai_rag":          True,
    "kb":              True,
    "know_base":       True,
    "sla_config":      True,
    "billing":         True,
    "assets":          True,
    "contracts":       True,
    "procurement":     True,
    "service_hub":     True,
}

_BUSINESS_FEATURES = {**_STARTER_FEATURES,
    "analytics":       True,
    "monthly_reports": True,
    "audit_log":       True,
    "patches":         True,
    "cost_lens":       True,
    "change_board":    True,
    "incidents":       True,
    "flowbot":         True,
    "status_cast":     True,
}

_ENTERPRISE_FEATURES = {**_BUSINESS_FEATURES,
    "people_sync":     True,
}

PLANS: dict[str, PlanDef] = {
    "community":  {"features": _COMMUNITY_FEATURES,  "limits": {"agents": 5,  "ai_queries": 0}},
    "starter":    {"features": _STARTER_FEATURES,    "limits": {"agents": -1, "ai_queries": 5_000}},
    "business":   {"features": _BUSINESS_FEATURES,   "limits": {"agents": -1, "ai_queries": 25_000}},
    "enterprise": {"features": _ENTERPRISE_FEATURES, "limits": {"agents": -1, "ai_queries": -1}},
}

# Maps feature -> minimum plan that unlocks it (for 402 error messages)
FEATURE_MIN_PLAN: dict[str, str] = {
    "ai_rag":          "starter",
    "kb":              "starter",
    "know_base":       "starter",
    "sla_config":      "starter",
    "analytics":       "business",
    "monthly_reports": "business",
    "audit_log":       "business",
    "billing":         "starter",
    "assets":          "starter",
    "contracts":       "starter",
    "procurement":     "starter",
    "service_hub":     "starter",
    "patches":         "business",
    "cost_lens":       "business",
    "change_board":    "business",
    "incidents":       "business",
    "flowbot":         "business",
    "status_cast":     "business",
    "people_sync":     "enterprise",
}
