from pydantic import BaseModel


class OrgEntitlements(BaseModel):
    plan_id: str
    features: dict[str, bool]
    limits: dict[str, int]  # -1 = unlimited
    ai_queries_used: int = 0
