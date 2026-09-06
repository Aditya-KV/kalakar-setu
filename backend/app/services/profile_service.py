"""
Kalakar Setu — Profile Service
CRUD operations for user profiles and onboarding state management.
"""

from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.consent import ConsentRecord


async def get_profile(db: AsyncSession, user_id: str) -> User | None:
    """Get a user profile by ID."""
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def update_profile(db: AsyncSession, user_id: str, data: dict) -> User | None:
    """Update permitted profile fields."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        return None

    allowed_fields = {
        "display_name", "preferred_language", "craft_types",
        "state_code", "district_code"
    }
    for key, value in data.items():
        if key in allowed_fields and value is not None:
            setattr(user, key, value)

    user.updated_at = datetime.now(timezone.utc)
    return user


async def update_onboarding(db: AsyncSession, user_id: str, data: dict) -> User | None:
    """
    Update onboarding progress and optionally set profile fields
    that are collected during onboarding steps.
    """
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        return None

    # Update onboarding step
    step = data.get("step")
    if step is not None:
        user.onboarding_step = step

    # Update profile fields collected during onboarding
    profile_fields = {
        "display_name", "preferred_language", "craft_types",
        "state_code", "district_code"
    }
    for key, value in data.items():
        if key in profile_fields and value is not None:
            setattr(user, key, value)

    # Mark completed if flagged
    if data.get("completed"):
        user.onboarding_completed = True

    user.updated_at = datetime.now(timezone.utc)
    return user


async def get_seller_readiness(db: AsyncSession, user_id: str) -> dict:
    """Compute seller readiness checklist."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        return {"error": "User not found"}

    has_name = bool(user.display_name)
    has_craft = bool(user.craft_types and len(user.craft_types) > 0)
    has_location = bool(user.state_code and user.district_code)

    checks = [has_name, has_craft, has_location, user.onboarding_completed]
    completed = sum(1 for c in checks if c)
    total = len(checks)

    return {
        "profile_complete": all(checks),
        "has_display_name": has_name,
        "has_craft_type": has_craft,
        "has_location": has_location,
        "onboarding_completed": user.onboarding_completed,
        "gem_connected": bool(user.gem_seller_id),
        "ondc_connected": bool(user.ondc_subscriber_id),
        "completion_percentage": int((completed / total) * 100),
    }


async def record_consent(
    db: AsyncSession,
    user_id: str,
    consent_type: str,
    policy_version: str,
    ip_address: str | None = None,
) -> ConsentRecord:
    """Record a user consent event."""
    record = ConsentRecord(
        user_id=user_id,
        consent_type=consent_type,
        policy_version=policy_version,
        ip_address=ip_address,
    )
    db.add(record)
    await db.flush()
    return record


async def request_deactivation(db: AsyncSession, user_id: str) -> bool:
    """Request account deactivation. Does not immediately delete data."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        return False

    user.deactivation_requested_at = datetime.now(timezone.utc)
    user.is_active = False
    user.updated_at = datetime.now(timezone.utc)
    return True
