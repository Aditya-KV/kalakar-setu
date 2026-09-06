"""
Kalakar Setu — Firebase Phone Auth Token Verification
Verifies Firebase ID tokens directly against Google's public certs, without
the firebase-admin SDK: verifying a token's signature only needs those public
keys plus our project ID (for the aud/iss claims) — no service account or
Application Default Credentials required, which firebase-admin's Auth client
otherwise insists on constructing even for read-only verification.
"""

import logging
import time

import httpx
from jose import JWTError, jwt as jose_jwt

from app.core.config import settings

logger = logging.getLogger(__name__)

GOOGLE_CERTS_URL = (
    "https://www.googleapis.com/robot/v1/metadata/x509/"
    "securetoken@system.gserviceaccount.com"
)
CERTS_CACHE_TTL_SECONDS = 3600

_certs_cache: dict[str, str] = {}
_certs_cache_expires_at: float = 0.0


async def _get_google_certs() -> dict[str, str]:
    global _certs_cache, _certs_cache_expires_at
    if _certs_cache and time.monotonic() < _certs_cache_expires_at:
        return _certs_cache

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(GOOGLE_CERTS_URL)
        response.raise_for_status()
        _certs_cache = response.json()
        _certs_cache_expires_at = time.monotonic() + CERTS_CACHE_TTL_SECONDS
        return _certs_cache


async def verify_firebase_id_token(id_token: str) -> dict | None:
    """Verifies a Firebase ID token's signature and claims, returning its decoded
    payload, or None if the token is invalid, expired, or misconfigured."""
    if not settings.FIREBASE_PROJECT_ID:
        logger.error("FIREBASE_PROJECT_ID is not configured; cannot verify Firebase tokens.")
        return None

    try:
        unverified_header = jose_jwt.get_unverified_header(id_token)
        kid = unverified_header.get("kid")
        if not kid:
            return None

        certs = await _get_google_certs()
        cert_pem = certs.get(kid)
        if not cert_pem:
            logger.warning("No matching Google cert found for Firebase token's key id.")
            return None

        return jose_jwt.decode(
            id_token,
            cert_pem,
            algorithms=["RS256"],
            audience=settings.FIREBASE_PROJECT_ID,
            issuer=f"https://securetoken.google.com/{settings.FIREBASE_PROJECT_ID}",
        )
    except (JWTError, httpx.HTTPError, ValueError) as e:
        logger.warning(f"Firebase ID token verification failed: {e}")
        return None
