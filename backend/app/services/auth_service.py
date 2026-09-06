"""
Kalakar Setu — Auth Service
OTP generation, verification, user creation, and JWT token management.
"""

import random
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import hash_otp, verify_otp_hash, create_access_token, create_refresh_token
from app.core.firebase import verify_firebase_id_token
from app.core.rate_limit import rate_limiter
from app.models.user import User
from app.models.otp import OTPVerification
from app.services.sms_service import get_sms_provider

logger = logging.getLogger(__name__)

# The frontend's "Skip sign-in (Dev only)" button always uses this fixed
# number. It exists specifically to remove friction during testing, so it
# must never itself get stuck behind the same rate limiter real users hit —
# defeats the point of a dev bypass. Exempt in DEBUG only.
# Normalized form (see AuthPhoneRequest.normalized_phone) — request_otp/
# verify_otp always receive the phone already normalized to this shape.
DEV_BYPASS_PHONE = "+919999999999"

# Initialize SMS provider from config
sms_provider = get_sms_provider(
    provider_name=settings.SMS_PROVIDER,
    account_sid=settings.TWILIO_ACCOUNT_SID,
    auth_token=settings.TWILIO_AUTH_TOKEN,
    from_number=settings.TWILIO_FROM_NUMBER,
)


def get_current_time() -> datetime:
    """Current UTC time, timezone-aware.

    Must stay aware: a naive datetime written to a Postgres
    TIMESTAMP WITH TIME ZONE column gets interpreted using the driver's/
    system's local timezone rather than UTC, silently shifting it (this
    was a real bug here — OTPs looked expired the instant they were
    created, because expires_at was written ~5.5h off). Comparisons
    against a value read back from SQLite (which can lose the offset and
    come back naive) go through `_naive()` below so both DBs stay safe.
    """
    return datetime.now(timezone.utc)


def _naive(dt: datetime) -> datetime:
    """Strip tzinfo if present, so aware/naive datetimes from different
    DB backends can be compared safely."""
    return dt.replace(tzinfo=None) if dt.tzinfo else dt


def generate_otp() -> str:
    """Generate a random 6-digit OTP code."""
    if settings.DEBUG:
        # In debug mode, use predictable OTP for easier testing
        return "123456"
    return str(random.randint(100000, 999999))


async def request_otp(db: AsyncSession, phone: str) -> dict:
    """
    Generate and send an OTP to the given phone number.
    Returns dict with success status, message, and cooldown info.
    """
    # Rate limit check — skipped for the dev-bypass number (see constant above).
    is_dev_bypass = settings.DEBUG and phone == DEV_BYPASS_PHONE
    allowed, reason, wait_seconds = (True, "", 0) if is_dev_bypass else rate_limiter.check(phone)
    if not allowed:
        if reason == "cooldown":
            return {
                "success": False,
                "message": "Please wait before requesting another OTP.",
                "cooldown_seconds": wait_seconds,
                "error_code": "OTP_COOLDOWN",
            }
        else:
            return {
                "success": False,
                "message": "Too many OTP requests. Please try again later.",
                "cooldown_seconds": wait_seconds,
                "error_code": "OTP_RATE_LIMIT",
            }

    # Generate OTP
    otp_code = generate_otp()
    otp_hashed = hash_otp(otp_code)
    now = get_current_time()
    expires_at = now + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)

    # Invalidate any existing unused OTPs for this phone
    existing = await db.execute(
        select(OTPVerification).where(
            OTPVerification.phone_number == phone,
            OTPVerification.is_verified == False,
        )
    )
    for old_otp in existing.scalars().all():
        old_otp.is_verified = True  # Mark as used/expired

    # Store new OTP
    otp_record = OTPVerification(
        phone_number=phone,
        otp_hash=otp_hashed,
        expires_at=expires_at,
        created_at=now,
    )
    db.add(otp_record)
    await db.flush()

    # Send OTP via SMS provider
    sent = await sms_provider.send_otp(phone, otp_code)
    if not sent:
        return {
            "success": False,
            "message": "Failed to send OTP. Please try again.",
            "cooldown_seconds": 0,
            "error_code": "SMS_FAILED",
        }

    # Record for rate limiting (not for the exempted dev-bypass number)
    if not is_dev_bypass:
        rate_limiter.record(phone)

    return {
        "success": True,
        "message": "OTP sent successfully.",
        "cooldown_seconds": settings.OTP_COOLDOWN_SECONDS,
    }


async def verify_otp(db: AsyncSession, phone: str, otp_code: str) -> dict:
    """
    Verify an OTP code and return JWT tokens if valid.
    Creates a new user account if the phone number is not registered.
    """
    # Find the latest unverified OTP for this phone
    result = await db.execute(
        select(OTPVerification)
        .where(
            OTPVerification.phone_number == phone,
            OTPVerification.is_verified == False,
        )
        .order_by(OTPVerification.created_at.desc())
        .limit(1)
    )
    otp_record = result.scalar_one_or_none()

    if not otp_record:
        return {
            "success": False,
            "message": "No pending OTP found. Please request a new one.",
            "error_code": "OTP_NOT_FOUND",
        }

    now = _naive(get_current_time())
    expires_at = _naive(otp_record.expires_at)

    # Check expiry
    if now > expires_at:
        otp_record.is_verified = True  # Mark expired
        return {
            "success": False,
            "message": "OTP has expired. Please request a new one.",
            "error_code": "OTP_EXPIRED",
        }

    # Check max attempts
    if otp_record.attempts >= settings.OTP_MAX_VERIFY_ATTEMPTS:
        otp_record.is_verified = True  # Lock out
        return {
            "success": False,
            "message": "Too many failed attempts. Please request a new OTP.",
            "error_code": "OTP_MAX_ATTEMPTS",
        }

    # Verify the OTP
    otp_record.attempts += 1
    if not verify_otp_hash(otp_code, otp_record.otp_hash):
        remaining = settings.OTP_MAX_VERIFY_ATTEMPTS - otp_record.attempts
        return {
            "success": False,
            "message": f"Invalid OTP. {remaining} attempts remaining.",
            "error_code": "OTP_INVALID",
        }

    # OTP verified successfully
    otp_record.is_verified = True

    return await _find_or_create_user_and_issue_tokens(db, phone)


async def _find_or_create_user_and_issue_tokens(db: AsyncSession, phone: str) -> dict:
    """Shared by all verified-phone-number auth paths (OTP, Firebase Phone Auth)."""
    user_result = await db.execute(
        select(User).where(User.phone_number == phone)
    )
    user = user_result.scalar_one_or_none()
    is_new_user = user is None

    if is_new_user:
        user = User(phone_number=phone)
        db.add(user)
        await db.flush()

    token_data = {"sub": user.id, "phone": phone}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    return {
        "success": True,
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "is_new_user": is_new_user,
        "onboarding_completed": user.onboarding_completed,
    }


async def verify_firebase_phone(db: AsyncSession, id_token: str) -> dict:
    """
    Verifies a phone number authenticated via Firebase Phone Authentication.
    The frontend hands us the Firebase ID token from its signInWithPhoneNumber
    flow; we verify its signature against Google's public certs rather than
    trusting the client-supplied phone number.
    """
    if not settings.FIREBASE_PROJECT_ID:
        logger.error("FIREBASE_PROJECT_ID is not configured; cannot verify Firebase tokens.")
        return {
            "success": False,
            "message": "Phone sign-in is not configured on the server.",
            "error_code": "FIREBASE_NOT_CONFIGURED",
        }

    claims = await verify_firebase_id_token(id_token)
    if claims is None:
        return {
            "success": False,
            "message": "Could not verify phone number. Please try again.",
            "error_code": "FIREBASE_INVALID_TOKEN",
        }

    phone = claims.get("phone_number")
    if not phone:
        return {
            "success": False,
            "message": "Verification response did not include a phone number.",
            "error_code": "FIREBASE_MISSING_PHONE",
        }

    return await _find_or_create_user_and_issue_tokens(db, phone)


async def refresh_access_token(db: AsyncSession, user_id: str) -> dict:
    """Issue a new access token for a valid user."""
    user_result = await db.execute(
        select(User).where(User.id == user_id, User.is_active == True)
    )
    user = user_result.scalar_one_or_none()

    if not user:
        return {"success": False, "error_code": "USER_NOT_FOUND"}

    token_data = {"sub": user.id, "phone": user.phone_number}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    return {
        "success": True,
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }
