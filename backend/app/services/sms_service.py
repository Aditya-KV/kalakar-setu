"""
Kalakar Setu — SMS Service
Adapter pattern for SMS providers. Mock provider for dev/hackathon.
"""

import logging
from typing import Protocol

logger = logging.getLogger(__name__)


class SMSProvider(Protocol):
    """Interface for SMS providers."""

    async def send_otp(self, phone: str, otp: str) -> bool:
        """Send an OTP to the given phone number. Returns True on success."""
        ...


class MockSMSProvider:
    """
    Mock SMS provider for development and hackathon demo.
    Logs OTP to console instead of sending real SMS.
    """

    async def send_otp(self, phone: str, otp: str) -> bool:
        logger.info(f"[MOCK SMS] OTP for {phone}: {otp}")
        print(f"\n{'='*50}")
        print(f"  MOCK SMS to {phone}")
        print(f"  OTP Code: {otp}")
        print(f"{'='*50}\n")
        return True


class TwilioSMSProvider:
    """
    Real Twilio SMS provider for production.
    Requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER in config.
    """

    def __init__(self, account_sid: str, auth_token: str, from_number: str):
        self.account_sid = account_sid
        self.auth_token = auth_token
        self.from_number = from_number

    async def send_otp(self, phone: str, otp: str) -> bool:
        try:
            # In production, use httpx to call Twilio API
            # For now, this is a placeholder
            logger.info(f"[TWILIO] Sending OTP to {phone}")
            # TODO: Implement actual Twilio API call
            # async with httpx.AsyncClient() as client:
            #     response = await client.post(
            #         f"https://api.twilio.com/2010-04-01/Accounts/{self.account_sid}/Messages.json",
            #         auth=(self.account_sid, self.auth_token),
            #         data={
            #             "To": phone,
            #             "From": self.from_number,
            #             "Body": f"Your Kalakar Setu verification code is: {otp}",
            #         },
            #     )
            #     return response.status_code == 201
            return True
        except Exception as e:
            logger.error(f"[TWILIO] Failed to send OTP: {e}")
            return False


def get_sms_provider(provider_name: str = "mock", **kwargs) -> SMSProvider:
    """Factory function to create the configured SMS provider."""
    if provider_name == "twilio":
        return TwilioSMSProvider(
            account_sid=kwargs.get("account_sid", ""),
            auth_token=kwargs.get("auth_token", ""),
            from_number=kwargs.get("from_number", ""),
        )
    return MockSMSProvider()
