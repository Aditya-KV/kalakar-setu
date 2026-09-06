"""
Kalakar Setu — Database Session Management
Async SQLAlchemy engine and session factory. Works unchanged against either
the local SQLite dev database or a managed Postgres instance (e.g. Supabase)
— only the DATABASE_URL needs to change.
"""

import logging
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings

logger = logging.getLogger(__name__)

is_sqlite = "sqlite" in settings.DATABASE_URL
is_postgres = "postgres" in settings.DATABASE_URL

connect_args = {}
if is_sqlite:
    connect_args = {"check_same_thread": False}
elif is_postgres:
    # Supabase's connection pooler (PgBouncer, "Transaction" mode) doesn't
    # support asyncpg's server-side prepared statements. Disabling the
    # statement cache is the documented fix and is harmless against a
    # direct (non-pooled) Postgres connection too.
    connect_args = {"statement_cache_size": 0}

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    connect_args=connect_args,
)

async_session_factory = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


class Base(DeclarativeBase):
    """Base class for all database models."""
    pass


async def get_db():
    """FastAPI dependency — yields an async database session."""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """
    Creates all tables from the current models — SQLite dev/test only.
    Against Postgres (Supabase), schema is owned by Alembic migrations
    instead (see backend/alembic/); this is a no-op there so a stray
    create_all() never races with — or silently diverges from — the
    real migration history.
    """
    if not is_sqlite:
        logger.info("Skipping create_all() — non-SQLite database, schema is managed by Alembic.")
        return
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
