"""
Kalakar Setu — Push Notification Service
Sends push notifications via Expo's push API (https://exp.host/--/api/v2/push/send)
to a user's registered Expo push token. Best-effort and always safe to
fail: a missing token, an unreachable Expo push service, or a malformed
response never raises — the caller's own action (placing an order,
updating fulfillment status) must succeed regardless of whether the
notification actually got delivered.
"""

import logging

import httpx

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


async def send_push_notification(
    push_token: str | None,
    title: str,
    body: str,
    data: dict | None = None,
) -> bool:
    """
    Sends one push notification to the given Expo push token. Returns
    True if Expo accepted the request, False otherwise (including when
    push_token is None/not a real Expo token) — never raises.
    """
    if not push_token or not push_token.startswith("ExponentPushToken"):
        return False

    payload = {
        "to": push_token,
        "title": title,
        "body": body,
        "data": data or {},
        "sound": "default",
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                EXPO_PUSH_URL,
                json=payload,
                headers={"Accept": "application/json", "Content-Type": "application/json"},
            )
        if response.status_code != 200:
            logger.warning(f"Expo push send failed: {response.status_code} {response.text}")
            return False
        result = response.json()
        ticket = (result.get("data") or {})
        if ticket.get("status") == "error":
            logger.warning(f"Expo push ticket error: {ticket.get('message')}")
            return False
        return True
    except Exception as e:
        logger.warning(f"Expo push send raised: {e}")
        return False
