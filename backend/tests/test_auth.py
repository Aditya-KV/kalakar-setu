"""
Kalakar Setu — Backend Auth & Profile Integration Tests
"""

import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.config import settings


@pytest.mark.asyncio
async def test_health_check():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


@pytest.mark.asyncio
async def test_reference_languages():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/api/v1/reference/languages")
    assert response.status_code == 200
    langs = response.json()
    assert len(langs) >= 3
    assert any(l["code"] == "hi" for l in langs)


@pytest.mark.asyncio
async def test_auth_and_onboarding_flow():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Request OTP
        req_res = await ac.post("/api/v1/auth/request-otp", json={"phone_number": "9876543210"})
        assert req_res.status_code == 200
        assert req_res.json()["success"] is True

        # 2. Verify OTP (using debug OTP 123456)
        verify_res = await ac.post(
            "/api/v1/auth/verify-otp",
            json={"phone_number": "9876543210", "otp_code": "123456"},
        )
        assert verify_res.status_code == 200
        token_data = verify_res.json()
        assert "access_token" in token_data
        access_token = token_data["access_token"]

        # 3. Get Profile
        headers = {"Authorization": f"Bearer {access_token}"}
        profile_res = await ac.get("/api/v1/profile", headers=headers)
        assert profile_res.status_code == 200
        profile = profile_res.json()
        assert profile["phone_number"] == "+919876543210"

        # 4. Update Onboarding Progress
        onboard_res = await ac.put(
            "/api/v1/profile/onboarding",
            headers=headers,
            json={
                "step": 3,
                "display_name": "Ramesh Kumar",
                "craft_types": ["pottery", "weaving"],
                "state_code": "RJ",
                "district_code": "RJ-JAI",
                "completed": True,
            },
        )
        assert onboard_res.status_code == 200
        updated_profile = onboard_res.json()
        assert updated_profile["display_name"] == "Ramesh Kumar"
        assert updated_profile["onboarding_completed"] is True

        # 5. Check Seller Readiness
        readiness_res = await ac.get("/api/v1/profile/readiness", headers=headers)
        assert readiness_res.status_code == 200
        readiness = readiness_res.json()
        assert readiness["profile_complete"] is True
        assert readiness["completion_percentage"] == 100


@pytest.mark.asyncio
async def test_firebase_verify_success():
    """Test sign-in via a verified Firebase ID token issues real tokens."""
    # A number unique to this run — the test DB file persists across runs, so a
    # fixed number here would collide with a previous run's leftover user.
    unique_phone = f"+91{int(datetime.now(timezone.utc).timestamp()) % 1_000_000_000:09d}"

    with patch.object(settings, "FIREBASE_PROJECT_ID", "test-project"), patch(
        "app.services.auth_service.verify_firebase_id_token",
        new=AsyncMock(return_value={"phone_number": unique_phone}),
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.post("/api/v1/auth/firebase-verify", json={"id_token": "fake-valid-token"})
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["is_new_user"] is True

    # A second sign-in with the same verified phone should reuse the same account.
    with patch.object(settings, "FIREBASE_PROJECT_ID", "test-project"), patch(
        "app.services.auth_service.verify_firebase_id_token",
        new=AsyncMock(return_value={"phone_number": unique_phone}),
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res2 = await ac.post("/api/v1/auth/firebase-verify", json={"id_token": "fake-valid-token"})
    assert res2.status_code == 200
    assert res2.json()["is_new_user"] is False


@pytest.mark.asyncio
async def test_firebase_verify_rejects_invalid_token():
    """Test a token that fails Firebase signature verification is rejected."""
    with patch.object(settings, "FIREBASE_PROJECT_ID", "test-project"), patch(
        "app.services.auth_service.verify_firebase_id_token", new=AsyncMock(return_value=None)
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.post("/api/v1/auth/firebase-verify", json={"id_token": "forged-token"})
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_firebase_verify_requires_server_configuration():
    """Test a clean, actionable error when FIREBASE_PROJECT_ID isn't configured."""
    with patch.object(settings, "FIREBASE_PROJECT_ID", ""):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.post("/api/v1/auth/firebase-verify", json={"id_token": "any-token"})
    assert res.status_code == 503
