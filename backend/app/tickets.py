from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import Optional, List
from datetime import datetime
import os
import json
import time
import psycopg
from psycopg.rows import dict_row
import uuid

from .schemas import (
    TicketCreate, TicketSummary, TicketDetail, TicketListResponse,
    MessageCreate, MessageOut, TicketWithMessages,
    ChatRequest, ChatResponse, Citation
)
from .auth import User, get_current_user
from .observability import get_observer, log_rag_metrics

router = APIRouter(prefix="/api", tags=["tickets"])

DATABASE_URL = os.getenv("DATABASE_URL")

def get_db_connection():
    """Get database connection."""
    if not DATABASE_URL:
        raise HTTPException(500, "DATABASE_URL not configured")
    return psycopg.connect(DATABASE_URL, row_factory=dict_row)

def get_user_role(user_id: str) -> str:
    """Get user role from database, default to 'customer'."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT role FROM app.user_roles WHERE user_id = %s", (user_id,))
        result = cursor.fetchone()
        return result["role"] if result else "customer"

def is_rep(user: User) -> bool:
    """Check if user has rep or admin role."""
    actual_role = get_user_role(user.id)
    return actual_role in ("rep", "admin")

@router.post("/tickets", response_model=TicketDetail, status_code=status.HTTP_201_CREATED)
def create_ticket(payload: TicketCreate, user: User = Depends(get_current_user)):
    """Create a new ticket with initial message."""
    user_role = get_user_role(user.id)
    
    # Map admin to rep for messages (DB constraint only allows: customer, rep, ai, system)
    message_sender_role = "rep" if user_role == "admin" else user_role
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # 1) Insert ticket
        cursor.execute("""
            INSERT INTO app.tickets (created_by, title, description, status, message_count)
            VALUES (%s, %s, %s, 'open', 0)
            RETURNING id, created_by, assignee_id, title, description, status, 
                      message_count, last_message_at, created_at, updated_at
        """, (user.id, payload.title, payload.description))
        
        ticket_row = cursor.fetchone()
        ticket_id = ticket_row["id"]
        
        # 2) Insert initial message
        cursor.execute("""
            INSERT INTO app.messages (ticket_id, sender_id, sender_role, body)
            VALUES (%s, %s, %s, %s)
            RETURNING id, ticket_id, sender_id, sender_role, body, created_at
        """, (ticket_id, user.id, message_sender_role, payload.description))
        
        message_row = cursor.fetchone()
        
        # 3) Update ticket message_count and last_message_at
        cursor.execute("""
            UPDATE app.tickets 
            SET message_count = 1, last_message_at = %s, updated_at = %s
            WHERE id = %s
            RETURNING last_message_at
        """, (message_row["created_at"], datetime.utcnow(), ticket_id))
        
        updated_ticket = cursor.fetchone()
        
        conn.commit()
        
        # Return TicketDetail
        return TicketDetail(
            id=str(ticket_row["id"]),
            created_by=str(ticket_row["created_by"]),
            assignee_id=str(ticket_row["assignee_id"]) if ticket_row["assignee_id"] else None,
            title=ticket_row["title"],
            description=ticket_row["description"],
            status=ticket_row["status"],
            message_count=1,
            last_message_at=updated_ticket["last_message_at"],
            created_at=ticket_row["created_at"]
        )

@router.get("/tickets", response_model=TicketListResponse)
def list_tickets(
    status_filter: str = Query("open", pattern="^(open|closed|all)$"),
    q: Optional[str] = Query(None, max_length=100),
    mine: Optional[bool] = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
):
    """List tickets with filters and pagination."""
    user_is_rep = is_rep(user)
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Build WHERE conditions
        where_conditions = []
        params = []
        
        # Access control
        if not user_is_rep:
            # Customers only see their tickets
            where_conditions.append("created_by = %s")
            params.append(user.id)
        elif user_is_rep and mine:
            # Reps can filter to their own tickets
            where_conditions.append("created_by = %s")
            params.append(user.id)
        
        # Status filter
        if status_filter != "all":
            where_conditions.append("status = %s")
            params.append(status_filter)
        
        # Search in title
        if q:
            where_conditions.append("title ILIKE %s")
            params.append(f"%{q}%")
        
        where_clause = "WHERE " + " AND ".join(where_conditions) if where_conditions else ""
        
        # Get total count
        count_query = f"SELECT COUNT(*) as total FROM app.tickets {where_clause}"
        cursor.execute(count_query, params)
        total = cursor.fetchone()["total"]
        
        # Get paginated results
        list_query = f"""
            SELECT id, title, status, message_count, last_message_at, created_at
            FROM app.tickets 
            {where_clause}
            ORDER BY last_message_at DESC
            LIMIT %s OFFSET %s
        """
        cursor.execute(list_query, params + [limit, offset])
        tickets = cursor.fetchall()
        
        items = [
            TicketSummary(
                id=str(ticket["id"]),
                title=ticket["title"],
                status=ticket["status"],
                message_count=ticket["message_count"],
                last_message_at=ticket["last_message_at"],
                created_at=ticket["created_at"]
            )
            for ticket in tickets
        ]
        
        return TicketListResponse(
            items=items,
            total=total,
            offset=offset,
            limit=limit
        )

@router.get("/tickets/{ticket_id}", response_model=TicketWithMessages)
def get_ticket(ticket_id: str, user: User = Depends(get_current_user)):
    """Get ticket details with messages."""
    user_is_rep = is_rep(user)
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Get ticket
        cursor.execute("""
            SELECT id, created_by, assignee_id, title, description, status, 
                   message_count, last_message_at, created_at, updated_at
            FROM app.tickets WHERE id = %s
        """, (ticket_id,))
        
        ticket_row = cursor.fetchone()
        if not ticket_row:
            raise HTTPException(status_code=404, detail="Ticket not found")
        
        # Check access
        if not user_is_rep and ticket_row["created_by"] != uuid.UUID(user.id):
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Get messages
        cursor.execute("""
            SELECT id, ticket_id, sender_id, sender_role, body, created_at
            FROM app.messages 
            WHERE ticket_id = %s
            ORDER BY created_at ASC
        """, (ticket_id,))
        
        message_rows = cursor.fetchall()
        
        ticket = TicketDetail(
            id=str(ticket_row["id"]),
            created_by=str(ticket_row["created_by"]),
            assignee_id=str(ticket_row["assignee_id"]) if ticket_row["assignee_id"] else None,
            title=ticket_row["title"],
            description=ticket_row["description"],
            status=ticket_row["status"],
            message_count=ticket_row["message_count"],
            last_message_at=ticket_row["last_message_at"],
            created_at=ticket_row["created_at"]
        )
        
        messages = [
            MessageOut(
                id=str(msg["id"]),
                ticket_id=str(msg["ticket_id"]),
                sender_id=str(msg["sender_id"]),
                sender_role=msg["sender_role"],
                body=msg["body"],
                created_at=msg["created_at"]
            )
            for msg in message_rows
        ]
        
        return TicketWithMessages(ticket=ticket, messages=messages)

@router.get("/tickets/{ticket_id}/messages", response_model=List[MessageOut])
def get_messages(
    ticket_id: str, 
    user: User = Depends(get_current_user),
    limit: int = Query(10, ge=1, le=100),
    order: str = Query("asc", regex="^(asc|desc)$")
):
    """Get messages for a ticket."""
    user_is_rep = is_rep(user)
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Check ticket exists and access
        cursor.execute("""
            SELECT created_by FROM app.tickets WHERE id = %s
        """, (ticket_id,))
        
        ticket_row = cursor.fetchone()
        if not ticket_row:
            raise HTTPException(status_code=404, detail="Ticket not found")
        
        # Check access
        if not user_is_rep and ticket_row["created_by"] != uuid.UUID(user.id):
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Get messages with limit and order
        order_clause = "ASC" if order == "asc" else "DESC"
        cursor.execute(f"""
            SELECT id, ticket_id, sender_id, sender_role, body, created_at
            FROM app.messages 
            WHERE ticket_id = %s
            ORDER BY created_at {order_clause}
            LIMIT %s
        """, (ticket_id, limit))
        
        message_rows = cursor.fetchall()
        
        messages = [
            MessageOut(
                id=str(msg["id"]),
                ticket_id=str(msg["ticket_id"]),
                sender_id=str(msg["sender_id"]),
                sender_role=msg["sender_role"],
                body=msg["body"],
                created_at=msg["created_at"]
            )
            for msg in message_rows
        ]
        
        return messages

@router.post("/tickets/{ticket_id}/messages", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
def post_message(ticket_id: str, payload: MessageCreate, user: User = Depends(get_current_user)):
    """Add a message to a ticket."""
    user_is_rep = is_rep(user)
    user_role = get_user_role(user.id)
    
    # Map admin to rep for messages (DB constraint only allows: customer, rep, ai, system)
    message_sender_role = "rep" if user_role == "admin" else user_role
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Check ticket exists and access
        cursor.execute("""
            SELECT id, created_by, message_count
            FROM app.tickets WHERE id = %s
        """, (ticket_id,))
        
        ticket_row = cursor.fetchone()
        if not ticket_row:
            raise HTTPException(status_code=404, detail="Ticket not found")
        
        # Check access
        if not user_is_rep and ticket_row["created_by"] != uuid.UUID(user.id):
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Insert message
        cursor.execute("""
            INSERT INTO app.messages (ticket_id, sender_id, sender_role, body)
            VALUES (%s, %s, %s, %s)
            RETURNING id, ticket_id, sender_id, sender_role, body, created_at
        """, (ticket_id, user.id, message_sender_role, payload.body))
        
        message_row = cursor.fetchone()
        
        # Update ticket message_count and last_message_at
        cursor.execute("""
            UPDATE app.tickets 
            SET message_count = message_count + 1, 
                last_message_at = %s, 
                updated_at = %s
            WHERE id = %s
        """, (message_row["created_at"], datetime.utcnow(), ticket_id))
        
        conn.commit()
        
        return MessageOut(
            id=str(message_row["id"]),
            ticket_id=str(message_row["ticket_id"]),
            sender_id=str(message_row["sender_id"]),
            sender_role=message_row["sender_role"],
            body=message_row["body"],
            created_at=message_row["created_at"]
        )

# Phase 4: AI Chat endpoint

# Simple in-memory rate limiting
chat_cooldown = {}
CHAT_COOLDOWN_SECONDS = int(os.getenv("CHAT_COOLDOWN_SECONDS", "8"))
CONFIDENCE_THRESHOLD = float(os.getenv("CONFIDENCE_THRESHOLD", "0.55"))
CONFIDENCE_MIN_CHUNKS = int(os.getenv("CONFIDENCE_MIN_CHUNKS", "2"))

def fetch_chunks_by_faiss_ids(faiss_ids: List[int]) -> List[dict]:
    """Fetch chunk details from database by FAISS IDs."""
    if not faiss_ids:
        return []
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT c.id as chunk_id, c.doc_id, c.text, c.faiss_id, d.title
            FROM app.chunks c
            JOIN app.documents d ON d.id = c.doc_id
            WHERE c.faiss_id = ANY(%s)
            ORDER BY c.faiss_id
        """, (faiss_ids,))
        return cursor.fetchall()

@router.post("/tickets/{ticket_id}/chat", response_model=ChatResponse)
def chat_with_ai(
    ticket_id: str,
    payload: ChatRequest,
    user: User = Depends(get_current_user)
):
    """Generate AI response for a ticket using enhanced RAG with comprehensive observability."""
    
    # Start observability tracking
    observer = get_observer()
    operation_id = observer.start_operation(ticket_id, user.id, "chat")
    
    # Import here to avoid circular dependencies
    from .rag import retrieve, compute_confidence, should_escalate
    from .ai import generate_completion, compute_prompt_hash, generate_structured_completion
    from .redact import scrub
    
    # 1) Verify ticket exists and user has access
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Check ticket access (same rules as viewing ticket)
        if is_rep(user):
            cursor.execute("SELECT id FROM app.tickets WHERE id = %s", (ticket_id,))
        else:
            cursor.execute("SELECT id FROM app.tickets WHERE id = %s AND created_by = %s", 
                         (ticket_id, user.id))
        
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Ticket not found")
    
    # 2) Rate limiting per ticket
    now = time.time()
    last_chat = chat_cooldown.get(ticket_id, 0)
    if now - last_chat < CHAT_COOLDOWN_SECONDS:
        raise HTTPException(status_code=429, detail="Please wait before asking again")
    chat_cooldown[ticket_id] = now
    
    # 3) PII scrub the query
    clean_query = scrub(payload.query)
    observer.record_embedding_metrics(clean_query, 0)  # Will update with actual timing
    
    # 4) Retrieve relevant chunks using enhanced RAG with metrics
    retrieval_start = time.time()
    retrieval_result = retrieve(clean_query, fetch_chunks_by_faiss_ids)
    retrieval_latency = int((time.time() - retrieval_start) * 1000)
    
    # Handle new enhanced return format
    if len(retrieval_result) == 6:
        chunks, sources, context, scores, faiss_ids, retrieval_metrics = retrieval_result
    else:
        # Fallback for old format
        chunks, sources, context, scores, faiss_ids = retrieval_result
        retrieval_metrics = {}
        observer.add_warning("Using fallback retrieval format")
    
    # Record retrieval metrics
    observer.record_retrieval_metrics(len(chunks), scores, retrieval_metrics, retrieval_latency)
    
    if not chunks:
        # No relevant context found - enhanced escalation handling
        observer.add_warning("No relevant chunks found in knowledge base")
        
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Enhanced no-context response with escalation details
            no_context_response = "I don't have enough information in the knowledge base to answer your question. This issue requires human assistance."
            
            # Record generation metrics for no-context case
            observer.record_generation_metrics(
                response=no_context_response,
                confidence=0.0,
                citations_count=0,
                model=os.getenv("GENAI_MODEL", "gemini-1.5-pro"),
                latency_ms=0,
                escalation_triggered=True
            )
            
            # Comprehensive escalation metadata
            escalation_info = {
                "requires_human": True,
                "uncertainty_level": "critical",
                "complexity_score": 1.0,
                "missing_info": ["no_relevant_context"],
                "triggered_signals": ["no_chunks_retrieved", "insufficient_knowledge_base"],
                "escalation_reason": "No relevant information found in knowledge base"
            }
            
            cursor.execute("""
                INSERT INTO app.messages (ticket_id, sender_id, sender_role, body, meta)
                VALUES (%s, %s, 'ai', %s, %s)
                RETURNING id, created_at
            """, (
                ticket_id, 
                user.id, 
                no_context_response,
                json.dumps({
                    "citations": [],
                    "confidence": 0.0,
                    "model": os.getenv("GENAI_MODEL", "gemini-1.5-pro"),
                    "suggest_escalation": True,
                    "escalation_info": escalation_info,
                    "retrieval_metrics": {"no_chunks": 1.0}
                })
            ))
            
            message_row = cursor.fetchone()
            message_id = str(message_row["id"])
            
            # Update ticket stats
            cursor.execute("""
                UPDATE app.tickets 
                SET message_count = message_count + 1, 
                    last_message_at = %s, 
                    updated_at = %s
                WHERE id = %s
            """, (message_row["created_at"], datetime.utcnow(), ticket_id))
            
            # Auto-flag ticket for no context case
            cursor.execute("SELECT status FROM app.tickets WHERE id = %s", (ticket_id,))
            ticket_status = cursor.fetchone()
            
            if ticket_status and ticket_status["status"] != 'closed':
                cursor.execute("""
                    UPDATE app.tickets 
                    SET needs_attention = true 
                    WHERE id = %s
                """, (ticket_id,))
                
                cursor.execute("""
                    INSERT INTO app.messages (ticket_id, sender_id, sender_role, body)
                    VALUES (%s, %s, 'system', %s)
                """, (
                    ticket_id, 
                    user.id, 
                    "[system] AI escalation: No relevant knowledge base content (confidence 0.00)"
                ))
                
                cursor.execute("""
                    UPDATE app.tickets 
                    SET message_count = message_count + 1
                    WHERE id = %s
                """, (ticket_id,))
            
            conn.commit()
            
            # Log metrics and return
            metrics = observer.finish_operation()
            if metrics:
                log_rag_metrics(metrics)
            
            return ChatResponse(
                message_id=message_id,
                content=no_context_response,
                citations=[],
                confidence=0.0,
                suggest_escalation=True
            )
    
    # 5) Generate AI response with enhanced structured generation
    generation_start = time.time()
    try:
        # Try structured generation first
        try:
            structured_response, latency_ms = generate_structured_completion(context, clean_query, sources)
            ai_response = structured_response.response
            
            # Extract confidence from structured response
            confidence_breakdown = structured_response.confidence_indicators
            base_confidence = sum(confidence_breakdown.values()) / len(confidence_breakdown)
            
        except Exception as structured_error:
            observer.add_warning(f"Structured generation failed: {structured_error}")
            # Fallback to basic generation
            ai_response, latency_ms = generate_completion(context, clean_query, sources)
            confidence_breakdown = {}
            base_confidence = 0.5  # Neutral confidence for fallback
            
    except Exception as e:
        observer.add_error(f"AI generation failed: {e}")
        raise HTTPException(status_code=502, detail=f"AI generation failed: {str(e)}")
    
    generation_latency = int((time.time() - generation_start) * 1000)
    
    # 6) Enhanced confidence computation with retrieval metrics
    try:
        # Get conversation length for escalation context
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) as count FROM app.messages WHERE ticket_id = %s", (ticket_id,))
            conversation_length = cursor.fetchone()["count"] + 1
        
        # Compute comprehensive confidence
        confidence, confidence_components = compute_confidence(
            scores, ai_response, len(chunks), retrieval_metrics
        )
        
        # Determine escalation with enhanced logic
        should_escalate_flag, escalation_details = should_escalate(
            confidence, retrieval_metrics, ai_response, conversation_length
        )
        
    except Exception as conf_error:
        observer.add_warning(f"Enhanced confidence computation failed: {conf_error}")
        # Fallback to basic confidence
        confidence = base_confidence
        confidence_components = {"fallback": base_confidence}
        should_escalate_flag = confidence < CONFIDENCE_THRESHOLD
        escalation_details = {"fallback_escalation": should_escalate_flag}
    
    # Record generation metrics
    import re
    citations_count = len(re.findall(r'\[\d+\]', ai_response))
    observer.record_generation_metrics(
        response=ai_response,
        confidence=confidence,
        citations_count=citations_count,
        model=os.getenv("GENAI_MODEL", "gemini-1.5-pro"),
        latency_ms=generation_latency,
        escalation_triggered=should_escalate_flag
    )
    
    # 7) Build enhanced citations with confidence scores
    citations = []
    for i, chunk in enumerate(chunks):
        # Calculate per-citation confidence if available
        citation_confidence = scores[i] if i < len(scores) else 0.5
        
        citation = Citation(
            label=sources[i] if i < len(sources) else f"[{i+1}] Unknown",
            doc_id=str(chunk.get('doc_id', '')),
            chunk_id=str(chunk.get('chunk_id', '')),
            faiss_id=chunk.get('faiss_id', -1),
            score=citation_confidence
        )
        citations.append(citation)
    
    # 8) Persist enhanced AI message with comprehensive metadata
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Build comprehensive message metadata
        message_meta = {
            "citations": [c.dict() for c in citations],
            "confidence": confidence,
            "confidence_breakdown": confidence_components,
            "model": os.getenv("GENAI_MODEL", "gemini-1.5-pro"),
            "suggest_escalation": should_escalate_flag,
            "escalation_details": escalation_details,
            "retrieval_metrics": retrieval_metrics,
            "generation_latency_ms": latency_ms,
            "conversation_length": conversation_length
        }
        
        cursor.execute("""
            INSERT INTO app.messages (ticket_id, sender_id, sender_role, body, meta)
            VALUES (%s, %s, 'ai', %s, %s)
            RETURNING id, created_at
        """, (ticket_id, user.id, ai_response, json.dumps(message_meta)))
        
        message_row = cursor.fetchone()
        message_id = str(message_row["id"])
        
        # Update ticket stats
        cursor.execute("""
            UPDATE app.tickets 
            SET message_count = message_count + 1, 
                last_message_at = %s, 
                updated_at = %s
            WHERE id = %s
        """, (message_row["created_at"], datetime.utcnow(), ticket_id))
        
        # Enhanced escalation handling with detailed reasoning
        if should_escalate_flag:
            # Check if ticket is not closed before flagging
            cursor.execute("SELECT status FROM app.tickets WHERE id = %s", (ticket_id,))
            ticket_status = cursor.fetchone()
            
            if ticket_status and ticket_status["status"] != 'closed':
                # Set needs_attention flag
                cursor.execute("""
                    UPDATE app.tickets 
                    SET needs_attention = true 
                    WHERE id = %s
                """, (ticket_id,))
                
                # Enhanced system message with escalation details
                escalation_reason = escalation_details.get("reasoning", "AI suggested escalation")
                cursor.execute("""
                    INSERT INTO app.messages (ticket_id, sender_id, sender_role, body)
                    VALUES (%s, %s, 'system', %s)
                """, (
                    ticket_id, 
                    user.id, 
                    f"[system] {escalation_reason} (confidence {confidence:.2f})"
                ))
                
                # Update message count again for the system message
                cursor.execute("""
                    UPDATE app.tickets 
                    SET message_count = message_count + 1
                    WHERE id = %s
                """, (ticket_id,))
        
        # Enhanced ai_runs logging with comprehensive metrics
        try:
            prompt_hash = compute_prompt_hash(context, clean_query)
            cursor.execute("""
                INSERT INTO app.ai_runs (
                    ticket_id, user_id, model, prompt_hash, top_k, confidence,
                    suggest_escalation, input_chars, output_chars, latency_ms
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                ticket_id, user.id, os.getenv("GENAI_MODEL", "gemini-1.5-pro"),
                prompt_hash, len(chunks), confidence, should_escalate_flag,
                len(payload.query), len(ai_response), latency_ms
            ))
        except Exception as e:
            # Don't fail the main request if logging fails
            print(f"Failed to log ai_runs: {e}")
        
        conn.commit()
    
    # Complete observability tracking and log metrics
    metrics = observer.finish_operation()
    if metrics:
        log_rag_metrics(metrics)
    
    return ChatResponse(
        message_id=message_id,
        content=ai_response,
        citations=citations,
        confidence=confidence,
        suggest_escalation=should_escalate_flag
    )