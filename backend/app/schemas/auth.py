"""
Kalakar Setu — Auth Schemas
Pydantic models for auth request/response validation.
"""

from pydantic import BaseModel, Field
import re


class PhoneNumberMixin(BaseModel):
    phone_number: str = Field(
        ...,
        min_length=10,
        max_length=15,
        description="Indian mobile number (10 digits, optionally with +91 prefix)",
        examples=["+919876543210", "9876543210"],
    )

    @property
    def normalized_phone(self) -> str:
        """Normalize to +91XXXXXXXXXX format."""
        digits = re.sub(r"[^\d]", "", self.phone_number)
        if len(digits) == 10:
            return f"+91{digits}"
        if len(digits) == 12 and digits.startswith("91"):
            return f"+{digits}"
        return f"+{digits}"


class RequestOTPRequest(PhoneNumberMixin):
    """Request to send an OTP to a phone number."""
    pass


class RequestOTPResponse(BaseModel):
    success: bool
    message: str
    cooldown_seconds: int = Field(
        default=60, description="Seconds before resend is allowed"
    )


class VerifyOTPRequest(PhoneNumberMixin):
    """Verify an OTP code."""
    otp_code: str = Field(
        ..., min_length=6, max_length=6, pattern=r"^\d{6}$",
        description="6-digit OTP code",
    )


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    is_new_user: bool = False
    onboarding_completed: bool = False


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class FirebaseVerifyRequest(BaseModel):
    """Verify a phone number authenticated via Firebase Phone Authentication."""
    id_token: str = Field(
        ...,
        description="The Firebase ID token from the client's signInWithPhoneNumber flow",
    )


class ErrorResponse(BaseModel):
    detail: str
    error_code: str | None = None
    wait_seconds: int | None = None
