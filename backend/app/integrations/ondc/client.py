"""
Outbound ONDC callback client. No signing yet (Phase 30 in the prototype
plan) — fine for mock/local testing, required before real sandbox/staging.
"""

import logging
import httpx

logger = logging.getLogger(__name__)


async def post_callback(url: str, payload: dict, headers: dict | None = None) -> tuple[int, dict | None]:
    """POST a callback payload. Never raises — callers log the result via
    IntegrationEvent regardless of success, since a failed callback is a
    normal, expected occurrence (buyer app down, wrong URL, etc.), not a
    bug in our own service."""
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(url, json=payload, headers=headers or {})
            try:
                body = response.json()
            except ValueError:
                body = None
            return response.status_code, body
    except httpx.HTTPError as e:
        logger.warning(f"ONDC callback to {url} failed: {e}")
        return 0, None


async def send_on_search(payload: dict, buyer_callback_url: str) -> tuple[int, dict | None]:
    if not buyer_callback_url:
        logger.warning("ONDC_BUYER_CALLBACK_URL not configured — on_search not sent.")
        return 0, None
    return await post_callback(f"{buyer_callback_url.rstrip('/')}/on_search", payload)
