"""
Kalakar Setu — Pytest Fixtures & Database Setup
"""

import os

# Tests always run against a local, disposable SQLite database — regardless
# of what DATABASE_URL is set to for the real running server (e.g. Supabase
# Postgres). This must happen before any `app.*` module is imported anywhere
# in the test session, since app.core.config.settings is instantiated once
# at import time; conftest.py is guaranteed to load first, so this is safe.
# A fresh database per process also prevents an old on-disk test schema from
# hiding or breaking model changes. It never touches the configured database.
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"

import pytest_asyncio
from app.db.session import init_db, async_session_factory
from app.services.reference_service import seed_reference_data


@pytest_asyncio.fixture(autouse=True, scope="function")
async def setup_test_db():
    """Initialize database tables and seed reference data before each test."""
    await init_db()
    async with async_session_factory() as session:
        await seed_reference_data(session)
        await session.commit()
