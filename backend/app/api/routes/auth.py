"""
Kalakar Setu — Auth Routes
OTP request, verification, token refresh, and logout.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.auth import (
    RequestOTPRequest,
    RequestOTPResponse,
    VerifyOTPRequest,
    TokenResponse,
    RefreshTokenRequest,
    FirebaseVerifyRequest,
)
from app.services import auth_service
from app.core.security import decode_token

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/request-otp", response_model=RequestOTPResponse)
async def request_otp(
    body: RequestOTPRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Send a one-time password to the given phone number.
    Rate-limited: max 3 requests per 5 minutes, 60s cooldown between requests.
    """
    phone = body.normalized_phone
    result = await auth_service.request_otp(db, phone)

    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS
            if result.get("error_code") in ("OTP_COOLDOWN", "OTP_RATE_LIMIT")
            else status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result["message"],
            headers={"Retry-After": str(result.get("cooldown_seconds", 60))},
        )

    return RequestOTPResponse(
        success=True,
        message=result["message"],
        cooldown_seconds=result["cooldown_seconds"],
    )


@router.post("/verify-otp", response_model=TokenResponse)
async def verify_otp(
    body: VerifyOTPRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Verify OTP code and return JWT access + refresh tokens.
    Creates a new user account if the phone number is not registered.
    """
    phone = body.normalized_phone
    result = await auth_service.verify_otp(db, phone, body.otp_code)

    if not result["success"]:
        error_code = result.get("error_code", "")
        status_code = {
            "OTP_NOT_FOUND": status.HTTP_404_NOT_FOUND,
            "OTP_EXPIRED": status.HTTP_410_GONE,
            "OTP_MAX_ATTEMPTS": status.HTTP_429_TOO_MANY_REQUESTS,
            "OTP_INVALID": status.HTTP_400_BAD_REQUEST,
        }.get(error_code, status.HTTP_400_BAD_REQUEST)

        raise HTTPException(status_code=status_code, detail=result["message"])

    return TokenResponse(
        access_token=result["access_token"],
        refresh_token=result["refresh_token"],
        token_type=result["token_type"],
        is_new_user=result["is_new_user"],
        onboarding_completed=result["onboarding_completed"],
    )


@router.post("/firebase-verify", response_model=TokenResponse)
async def firebase_verify(
    body: FirebaseVerifyRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Completes sign-in after Firebase Phone Authentication verifies the user's
    number, returning JWT access + refresh tokens. Creates a new user account
    if the phone number is not registered.
    """
    result = await auth_service.verify_firebase_phone(db, body.id_token)

    if not result["success"]:
        error_code = result.get("error_code", "")
        status_code = {
            "FIREBASE_INVALID_TOKEN": status.HTTP_400_BAD_REQUEST,
            "FIREBASE_MISSING_PHONE": status.HTTP_400_BAD_REQUEST,
            "FIREBASE_NOT_CONFIGURED": status.HTTP_503_SERVICE_UNAVAILABLE,
        }.get(error_code, status.HTTP_400_BAD_REQUEST)
        raise HTTPException(status_code=status_code, detail=result["message"])

    return TokenResponse(
        access_token=result["access_token"],
        refresh_token=result["refresh_token"],
        token_type=result["token_type"],
        is_new_user=result["is_new_user"],
        onboarding_completed=result["onboarding_completed"],
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    body: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db),
):
    """Refresh an access token using a valid refresh token."""
    payload = decode_token(body.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token.",
        )

    user_id = payload.get("sub")
    result = await auth_service.refresh_access_token(db, user_id)

    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive.",
        )

    return TokenResponse(
        access_token=result["access_token"],
        refresh_token=result["refresh_token"],
        token_type=result["token_type"],
    )


@router.post("/logout")
async def logout():
    """
    Logout endpoint. Client should discard tokens.
    For stateless JWT, this is a client-side operation.
    A token blacklist can be added for enhanced security.
    """
    return {"message": "Logged out successfully. Please discard your tokens."}
