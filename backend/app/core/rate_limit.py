"""
Kalakar Setu — Rate Limiting for OTP
In-memory rate limiter (suitable for single-instance / pilot).
For production multi-instance, replace with Redis-based limiter.
"""

from datetime import datetime, timezone, timedelta
from typing import Dict, Tuple
from app.core.config import settings


class OTPRateLimiter:
    """
    Tracks OTP request timestamps per phone number.
    Enforces:
    - Cooldown between consecutive requests (OTP_COOLDOWN_SECONDS)
    - Max requests within a rolling window (OTP_MAX_REQUESTS_PER_WINDOW in OTP_RATE_WINDOW_MINUTES)
    """

    def __init__(self):
        # phone_number -> list of request timestamps
        self._requests: Dict[str, list] = {}

    def _cleanup(self, phone: str):
        """Remove expired entries outside the rate window."""
        if phone not in self._requests:
            return
        cutoff = datetime.now(timezone.utc) - timedelta(
            minutes=settings.OTP_RATE_WINDOW_MINUTES
        )
        self._requests[phone] = [
            ts for ts in self._requests[phone] if ts > cutoff
        ]

    def check(self, phone: str) -> Tuple[bool, str, int]:
        """
        Check if an OTP request is allowed for this phone.
        Returns: (allowed: bool, reason: str, wait_seconds: int)
        """
        self._cleanup(phone)
        now = datetime.now(timezone.utc)
        requests = self._requests.get(phone, [])

        # Check cooldown since last request
        if requests:
            last_request = requests[-1]
            elapsed = (now - last_request).total_seconds()
            cooldown = settings.OTP_COOLDOWN_SECONDS
            if elapsed < cooldown:
                wait = int(cooldown - elapsed) + 1
                return False, "cooldown", wait

        # Check max requests in window
        if len(requests) >= settings.OTP_MAX_REQUESTS_PER_WINDOW:
            oldest_in_window = requests[0]
            window_end = oldest_in_window + timedelta(
                minutes=settings.OTP_RATE_WINDOW_MINUTES
            )
            wait = int((window_end - now).total_seconds()) + 1
            return False, "max_requests", max(wait, 1)

        return True, "", 0

    def record(self, phone: str):
        """Record an OTP request for rate limiting."""
        now = datetime.now(timezone.utc)
        if phone not in self._requests:
            self._requests[phone] = []
        self._requests[phone].append(now)
        self._cleanup(phone)


# Singleton instance
rate_limiter = OTPRateLimiter()
