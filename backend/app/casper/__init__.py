"""
CASPER — AI Foundation Layer for Strata.

Single import point for all AI operations:

    from app.casper import casper_engine

    # On ticket creation
    result = casper_engine.process_ticket_creation(...)

    # On AI chat
    result = casper_engine.process_chat(...)

    # Register a tool from any module
    from app.casper.tools import Tool
    casper_engine.tool_registry.register(Tool(...))

    # Register a searchable entity namespace from any module
    from app.casper.correlator import EntityNamespace
    casper_engine.correlator.register_namespace(EntityNamespace(...))
"""

from .engine import (
    CASPEREngine,
    TicketAIResult,
    ChatAIResult,
)
from .tools import (
    ToolRegistry,
    Tool,
    ExecutionContext,
    ToolResult,
)
from .correlator import (
    EntityCorrelator,
    EntityNamespace,
    CorrelatedEntity,
)

# Module-level singleton — shared across all requests
casper_engine = CASPEREngine()

__all__ = [
    "casper_engine",
    "CASPEREngine",
    "TicketAIResult",
    "ChatAIResult",
    "ToolRegistry",
    "Tool",
    "ExecutionContext",
    "ToolResult",
    "EntityCorrelator",
    "EntityNamespace",
    "CorrelatedEntity",
]
