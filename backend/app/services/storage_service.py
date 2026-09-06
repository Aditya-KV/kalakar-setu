"""
Kalakar Setu — File Storage Service
Saves uploaded/generated files (product photos, gallery variants) to
Supabase Storage when configured, or to local disk otherwise — the same
graceful-fallback pattern used for the LLM providers. Callers never need
to know which backend is active; save_file() always returns a URL that
can be safely prefixed with HOST_URL by the frontend for local files, or
is already a complete public URL for Supabase-hosted files.
"""

import os
import uuid
import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# Local fallback directory — unchanged from the original local-disk behavior.
UPLOAD_DIR = os.path.join(os.getcwd(), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


def _supabase_configured() -> bool:
    return bool(settings.SUPABASE_URL and settings.SUPABASE_SERVICE_KEY)


def save_file(file_bytes: bytes, filename_suffix: str, content_type: str = "image/jpeg", extension: str = "jpg") -> str:
    """
    Saves a file and returns its URL.
    - Supabase configured: uploads to Storage, returns the full public URL.
    - Otherwise: saves to local ./uploads, returns a relative "/uploads/..."
      path (served by the StaticFiles mount registered in main.py).
    Never raises for a storage failure — falls back to local disk so an
    upload never fails outright just because Supabase is briefly unreachable.
    `extension` defaults to "jpg" for backward compatibility with existing
    callers — pass "png" for a transparent-background export.
    """
    filename = f"{uuid.uuid4().hex}_{filename_suffix}.{extension}"

    if _supabase_configured():
        url = _upload_to_supabase(file_bytes, filename, content_type)
        if url:
            return url
        logger.warning("Supabase Storage upload failed, falling back to local disk.")

    return _save_local(file_bytes, filename)


def _upload_to_supabase(file_bytes: bytes, filename: str, content_type: str) -> str | None:
    try:
        url = f"{settings.SUPABASE_URL}/storage/v1/object/{settings.SUPABASE_STORAGE_BUCKET}/{filename}"
        headers = {
            # Supabase's gateway requires BOTH headers — `apikey` alone
            # identifies the caller to Kong (routing/rate-limiting), while
            # `Authorization: Bearer` is what the Storage service itself
            # checks for the actual role (service_role bypasses RLS).
            # Missing `apikey` here was causing every upload to fail.
            "apikey": settings.SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
            "Content-Type": content_type,
            "x-upsert": "true",
        }
        response = httpx.post(url, headers=headers, content=file_bytes, timeout=30.0)
        response.raise_for_status()
        return f"{settings.SUPABASE_URL}/storage/v1/object/public/{settings.SUPABASE_STORAGE_BUCKET}/{filename}"
    except httpx.HTTPStatusError as e:
        # Log the actual response body — the status code alone ("400 Bad
        # Request") hides the real reason (bad bucket, bad key, RLS, etc.).
        logger.warning(f"Supabase Storage upload error: {e.response.status_code} {e.response.text}")
        return None
    except Exception as e:
        logger.warning(f"Supabase Storage upload error: {e}")
        return None


def _save_local(file_bytes: bytes, filename: str) -> str:
    filepath = os.path.join(UPLOAD_DIR, filename)
    with open(filepath, "wb") as f:
        f.write(file_bytes)
    return f"/uploads/{filename}"


def read_file(url: str) -> bytes:
    """
    Reads back a previously-saved file's bytes, given the URL save_file()
    returned — works for both a full Supabase Storage URL and a local
    "/uploads/..." relative path, so callers (e.g. re-processing an
    original photo) don't need to know which backend stored it.
    """
    if url.startswith("http://") or url.startswith("https://"):
        response = httpx.get(url, timeout=30.0)
        response.raise_for_status()
        return response.content

    filepath = os.path.join(os.getcwd(), url.lstrip("/"))
    with open(filepath, "rb") as f:
        return f.read()
