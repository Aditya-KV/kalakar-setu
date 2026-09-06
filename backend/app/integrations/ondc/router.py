"""
ONDC-facing routes. Mounted at /ondc (NOT /api/v1 — this is the path ONDC's
network itself calls, per ONDC_SUBSCRIBER_URL), so it has no auth
dependency: the caller is the ONDC network, not one of our own app users.

Only /search is implemented — see ONDC_SETUP.md for why select/init/confirm
are deliberately deferred (Milestones 5-6 of the prototype plan).
"""

from fastapi import APIRouter, Request, BackgroundTasks

from app.integrations.ondc.adapter import ONDCAdapter

router = APIRouter()
_adapter = ONDCAdapter()


@router.post("/search")
async def search(request: Request, background_tasks: BackgroundTasks):
    try:
        payload = await request.json()
    except Exception:
        payload = {}

    # ACK immediately — ONDC is callback-oriented, so the real catalogue
    # comes later via our own POST to the buyer's /on_search.
    background_tasks.add_task(_adapter.handle_search, payload)

    return {"message": {"ack": {"status": "ACK"}}}
