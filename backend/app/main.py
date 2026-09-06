"""
Kalakar Setu — FastAPI Application Entry Point
Main application setup with CORS, routing, startup events, and health checks.
"""

import os
import uuid
import asyncio
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
from app.services.image_studio.segmentation import get_session as get_segmentation_session

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

    # Pre-warm the Virtual Product Studio's segmentation model. Even though
    # it's baked into the Docker image at build time (no network download),
    # a fresh container still pays a real one-time cost (~60s observed)
    # reading that ~170MB file off disk for the first time. Doing it here
    # keeps that cost inside startup — before the app accepts traffic —
    # instead of risking a timeout/crash on whichever user's enhance
    # request happens to be first against a newly-started container.
    try:
        await asyncio.to_thread(get_segmentation_session)
        logger.info("✅ Segmentation model warmed up")
    except Exception as e:
        logger.warning(f"Segmentation model warm-up failed, will lazy-load on first use instead: {e}")

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
