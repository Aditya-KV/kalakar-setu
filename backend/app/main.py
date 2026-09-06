"""
Kalakar Setu — FastAPI Application Entry Point
Main application setup with CORS, routing, startup events, and health checks.
"""

import os
import uuid
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.db.session import init_db, async_session_factory
from app.api.routes import auth, profile, reference, media, catalog, listing, address, marketplace, order, pricing
from app.integrations.ondc.router import router as ondc_router
from app.services.reference_service import seed_reference_data

# Configure logging
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Startup
    logger.info(f"🚀 Starting {settings.APP_NAME}")
    logger.info(f"📦 Database: {settings.DATABASE_URL.split('@')[-1] if '@' in settings.DATABASE_URL else settings.DATABASE_URL}")

    # Create tables (dev mode — use Alembic in production)
    await init_db()
    logger.info("✅ Database tables created")

    # Seed reference data
    async with async_session_factory() as session:
        await seed_reference_data(session)
        await session.commit()
    logger.info("✅ Reference data seeded")

    # The segmentation model (isnet-general-use, ~170MB) is deliberately
    # NOT pre-warmed here anymore. Doing so kept the model resident in
    # every container's memory from the moment it started, whether or not
    # anyone ever used Photo Studio — measured at ~325MB extra idle RSS,
    # which is why Railway's memory graph jumped from ~50MB to 500-600MB
    # baseline right after that change shipped. It now lazy-loads on the
    # first real call to remove_background() instead (see
    # app/services/image_studio/segmentation.py's cached singleton) — the
    # model stays baked into the Docker image (no network download either
    # way), so the only trade-off is that whichever request is first to
    # need it after a fresh deploy pays a one-time ~60-80s cold-disk-read
    # cost instead of that cost happening at startup.
    yield

    # Shutdown
    logger.info(f"👋 Shutting down {settings.APP_NAME}")


# Create FastAPI application
app = FastAPI(
    title=settings.APP_NAME,
    description=(
        "AI-Driven Market Linkage and Smart Cataloging API "
        "for Marginalized Artisans — Phase 1: Auth, Onboarding & Profile"
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Local-disk upload fallback (only used when Supabase Storage isn't
# configured — see app/services/storage_service.py). Serves whatever
# save_file() wrote to ./uploads at the same "/uploads/..." URLs it returns.
_uploads_dir = os.path.join(os.getcwd(), "uploads")
os.makedirs(_uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=_uploads_dir), name="uploads")


# Request ID middleware for correlation (NFR-O-01)
@app.middleware("http")
async def add_request_id(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    request.state.request_id = request_id
    response: Response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


# Register API routes
app.include_router(auth.router, prefix="/api/v1")
app.include_router(profile.router, prefix="/api/v1")
app.include_router(reference.router, prefix="/api/v1")
app.include_router(media.router, prefix="/api/v1")
app.include_router(catalog.router, prefix="/api/v1")
app.include_router(listing.router, prefix="/api/v1")
app.include_router(address.router, prefix="/api/v1")
app.include_router(marketplace.router, prefix="/api/v1")
app.include_router(order.router, prefix="/api/v1")
app.include_router(pricing.router, prefix="/api/v1")

# ONDC — mounted at /ondc (not /api/v1), per ONDC_SUBSCRIBER_URL. This is
# the one path ONDC's own network calls; see app/integrations/ondc/.
app.include_router(ondc_router, prefix="/ondc", tags=["ONDC"])


# Health check
@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "version": "1.0.0",
    }


@app.get("/", tags=["Root"])
async def root():
    return {
        "service": settings.APP_NAME,
        "message": "Kalakar Setu API — Empowering Artisans Digitally 🎨",
        "docs": "/docs",
        "health": "/health",
    }
