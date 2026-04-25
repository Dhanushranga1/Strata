from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime

class ChatRequest(BaseModel):
    """Request schema for chat messages"""
    query: str = Field(..., min_length=1, max_length=1000, description="User query text")

class TicketCreate(BaseModel):
    title: str = Field(min_length=3, max_length=120)
    description: str = Field(min_length=10, max_length=4000)
    tags: Optional[List[str]] = Field(default_factory=list)
    priority: str = Field(default="normal", pattern="^(low|normal|high|urgent)$")
    customer_email: Optional[str] = None

class TicketSummary(BaseModel):
    id: str
    title: str
    status: str
    priority: str
    priority_level: Optional[int] = None
    needs_attention: bool = False
    is_overdue: bool = False
    message_count: int
    last_message_at: datetime
    created_at: datetime
    tags: List[str] = Field(default_factory=list)
    assignee_id: Optional[str] = None
    assignee_email: Optional[str] = None
    customer_email: Optional[str] = None

class TicketDetail(TicketSummary):
    created_by: str
    description: str
    escalated_to: Optional[str] = None
    escalated_to_email: Optional[str] = None
    escalated_at: Optional[datetime] = None
    expected_resolve_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    resolution_note: Optional[str] = None
    customer_rating: Optional[int] = None
    updated_at: Optional[datetime] = None

class TicketListResponse(BaseModel):
    items: List[TicketSummary]
    total: int
    offset: int
    limit: int

class MessageCreate(BaseModel):
    body: str = Field(min_length=1, max_length=8000)
    is_internal: bool = False
    sender_role: Optional[str] = None  # allow system/ai override

class MessageOut(BaseModel):
    id: str
    ticket_id: str
    sender_id: str
    sender_role: str
    body: str
    created_at: datetime
    is_internal: bool = False
    meta: Optional[dict] = None

class TicketWithMessages(BaseModel):
    ticket: TicketDetail
    messages: List[MessageOut]

class TagsRequest(BaseModel):
    tags: List[str] = Field(max_length=10)  # max 10 tags

class ResolutionRequest(BaseModel):
    resolution_note: Optional[str] = Field(default=None, max_length=2000)
    status: str = Field(default="resolved", pattern="^(resolved|closed)$")

class RatingRequest(BaseModel):
    rating: int = Field(ge=1, le=5)

# Phase 4: AI Chat schemas
class ChatRequest(BaseModel):
    query: str = Field(min_length=1, max_length=2000)

class Citation(BaseModel):
    label: str
    doc_id: str
    chunk_id: str
    faiss_id: int
    score: Optional[float] = None

class ChatResponse(BaseModel):
    message_id: str
    content: str
    citations: List[Citation]
    confidence: float
    suggest_escalation: bool

# Phase 5: Rep Console schemas
class QueueItem(BaseModel):
    id: str
    title: str
    status: str
    priority: str
    priority_level: Optional[int] = None
    needs_attention: bool
    assignee_id: Optional[str] = None
    message_count: int
    last_message_at: datetime
    created_at: datetime
    escalated_to_name: Optional[str] = None
    escalated_at: Optional[datetime] = None
    expected_resolve_at: Optional[datetime] = None
    etr_set_at: Optional[datetime] = None

class QueueResponse(BaseModel):
    items: List[QueueItem]
    total: int
    offset: int
    limit: int

class QueueCounts(BaseModel):
    needs_attention: int
    open_active: int
    escalated: int
    all: int
    resolved_today: int = 0

class EscalateRequest(BaseModel):
    reason: Optional[str] = Field(default=None, max_length=400)
    escalated_to_user_id: Optional[str] = Field(default=None)

class StatusChangeRequest(BaseModel):
    status: str = Field(pattern="^(open|in_progress|resolved|closed|escalated)$")

class AssignRequest(BaseModel):
    assignee_id: Optional[str] = None  # None => assign to caller

class AckAttentionRequest(BaseModel):
    note: Optional[str] = Field(default=None, max_length=200)

class PriorityRequest(BaseModel):
    priority: str = Field(pattern="^(low|normal|high|urgent)$")

class PriorityLevelRequest(BaseModel):
    priority_level: int = Field(ge=1, le=7)

class ETRRequest(BaseModel):
    expected_resolve_at: datetime

# Phase 3: AI Feedback schemas
class FeedbackRequest(BaseModel):
    message_id: str = Field(..., description="UUID of the AI message")
    feedback_type: Literal['positive', 'negative'] = Field(..., description="User feedback on AI response quality")

class FeedbackResponse(BaseModel):
    ok: bool
    message: str

# Phase 5A: Admin Tools and Role Management schemas
Role = Literal["customer", "rep", "admin"]
RoleRequestStatus = Literal["pending", "approved", "denied", "cancelled"]

class UserRoleItem(BaseModel):
    user_id: str
    email: Optional[str] = None
    role: Role
    role_updated_at: Optional[datetime] = None

class SetRoleRequest(BaseModel):
    role: Role

class RoleRequestCreate(BaseModel):
    reason: Optional[str] = Field(default=None, max_length=400)

class RoleRequestItem(BaseModel):
    id: str
    user_id: str
    email: Optional[str] = None
    reason: Optional[str] = None
    status: RoleRequestStatus
    created_at: datetime
    decided_at: Optional[datetime] = None

class DecideRoleRequest(BaseModel):
    decision: Literal["approve", "deny"]

class DiagnosticInfo(BaseModel):
    timestamp: datetime
    database_version: Optional[str] = None
    extensions: List[str]
    schemas: List[str]
    table_counts: dict

# Assignment schemas
class RepWorkloadItem(BaseModel):
    user_id: str
    email: Optional[str] = None
    role: str
    open_tickets: int

class RepWorkloadResponse(BaseModel):
    reps: List[RepWorkloadItem]
    total_unassigned: int

class AutoAssignResponse(BaseModel):
    assigned: int
    skipped: int
    details: List[dict]