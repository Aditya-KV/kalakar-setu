"""
ONDC "context" object helpers.

Nearly every ONDC message carries a `context` object identifying the
transaction, the acting domain/subscriber, and a timestamp. Callbacks
(e.g. on_search replying to search) must echo most of the incoming
context back, with the action swapped and a fresh message_id/timestamp.
"""

import uuid
from datetime import datetime, timezone

from app.core.config import settings


def build_callback_context(incoming_context: dict, action: str) -> dict:
    """Build the context for a callback (e.g. incoming action="search" ->
    outgoing action="on_search"), preserving the transaction identity."""
    return {
        **incoming_context,
        "action": action,
        "bap_id": incoming_context.get("bap_id"),
        "bap_uri": incoming_context.get("bap_uri"),
        "bpp_id": settings.ONDC_SUBSCRIBER_ID,
        "bpp_uri": settings.ONDC_SUBSCRIBER_URL,
        "message_id": str(uuid.uuid4()),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
