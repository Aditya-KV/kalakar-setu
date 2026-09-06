"""
Kalakar Setu — Core Configuration
Loads settings from environment variables / .env file.
"""

from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Kalakar Setu"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./kalakarsetu.db"

    # JWT
    JWT_SECRET_KEY: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    # Long-lived on purpose: the app is designed to ask for OTP/phone
    # verification only once per device, then silently refresh the access
    # token in the background indefinitely until the user explicitly logs out.
    REFRESH_TOKEN_EXPIRE_DAYS: int = 3650

    # OTP
    OTP_EXPIRE_MINUTES: int = 5
    OTP_COOLDOWN_SECONDS: int = 60
    OTP_MAX_REQUESTS_PER_WINDOW: int = 3
    OTP_RATE_WINDOW_MINUTES: int = 5
    OTP_MAX_VERIFY_ATTEMPTS: int = 5

    # SMS Provider
    SMS_PROVIDER: str = "mock"
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_FROM_NUMBER: str = ""

    # Firebase Phone Authentication — only the project ID is needed to verify
    # ID tokens (verify_id_token checks the token's signature against Google's
    # public certs and its `aud` claim against this project; no service
    # account key required). From the Firebase Console > Project Settings.
    FIREBASE_PROJECT_ID: str = ""

    # LLM-powered catalog structuring — turns a raw voice transcript into a
    # polished, bilingual listing (title/description/attributes/keywords).
    # Two interchangeable free-tier providers are supported; whichever key(s)
    # are set get tried, in this order: Groq, then Gemini. Leave both blank
    # and catalog structuring silently falls back to the deterministic
    # keyword+template pipeline in speech_service.py — never breaks, just less rich.
    GROQ_API_KEY: str = ""  # free, no card: https://console.groq.com/keys
    GROQ_MODEL: str = "openai/gpt-oss-120b"
    GEMINI_API_KEY: str = ""  # free, no card: https://aistudio.google.com/apikey
    GEMINI_MODEL: str = "gemini-2.0-flash"

    # Supabase — used as managed Postgres (via DATABASE_URL below) and for
    # file storage (product photos). Leave SUPABASE_URL/SUPABASE_SERVICE_KEY
    # blank to keep saving uploads to local disk (served at /uploads via
    # StaticFiles) — the same graceful-fallback pattern as the LLM providers.
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_KEY: str = ""  # the "service_role" secret key, not the anon/public key
    SUPABASE_STORAGE_BUCKET: str = "product-media"

    # ONDC — B2B seller-side integration (search/on_search only for now; see
    # app/integrations/ondc/). Kalakar Setu is the ONE seller-app integration
    # point for every artisan on the platform, so no artisan integrates with
    # ONDC individually. Leave ONDC_MODE=mock while developing — the adapter
    # never fails hard on missing config, it just can't reach a real buyer.
    ONDC_MODE: str = "mock"  # "mock" | "sandbox" | "staging" | "production"
    ONDC_DOMAIN: str = "ONDC:RET18"
    ONDC_SUBSCRIBER_ID: str = "prototype.kalakarsetu.local"
    ONDC_SUBSCRIBER_URL: str = "/ondc"
    # Where we POST /on_search, /on_select, etc. — the sandbox/mock buyer's
    # base URL. Blank until you have one (see the ONDC section of README).
    ONDC_BUYER_CALLBACK_URL: str = ""
    # Left blank until Phase 30 (protocol signing) — not needed for the
    # search/on_search milestone.
    ONDC_SIGNING_PRIVATE_KEY: str = ""
    ONDC_SIGNING_PUBLIC_KEY: str = ""

    # CORS
    CORS_ORIGINS: str = "http://localhost:8081,http://localhost:19006"

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
    }


settings = Settings()
