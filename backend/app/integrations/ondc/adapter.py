"""
Marketplace adapter interface — keeps the rest of the app marketplace-
agnostic. A future GeM (or other) integration implements the same shape
under app/integrations/gem/ without touching listing/order business logic.

Only `handle_search` is implemented for this milestone. The others raise
NotImplementedError on purpose — select/init/confirm are Milestones 5-6,
deliberately not built yet (see ONDC_SETUP.md for why).
"""

from abc import ABC, abstractmethod

# Note: handlers open their own DB session internally (see service.py)
# rather than accepting one — these run from a FastAPI BackgroundTask
# *after* the request's own session has already been closed, so reusing
# a request-scoped session here would be a real (if easy to miss) bug.


class MarketplaceAdapter(ABC):
    @abstractmethod
    async def handle_search(self, payload: dict) -> None: ...

    @abstractmethod
    async def handle_select(self, payload: dict) -> None: ...

    @abstractmethod
    async def handle_init(self, payload: dict) -> None: ...

    @abstractmethod
    async def handle_confirm(self, payload: dict) -> None: ...


class ONDCAdapter(MarketplaceAdapter):
    async def handle_search(self, payload: dict) -> None:
        from app.integrations.ondc.service import process_search

        await process_search(payload)

    async def handle_select(self, payload: dict) -> None:
        raise NotImplementedError("ONDC select/on_select is not implemented yet.")

    async def handle_init(self, payload: dict) -> None:
        raise NotImplementedError("ONDC init/on_init is not implemented yet.")

    async def handle_confirm(self, payload: dict) -> None:
        raise NotImplementedError("ONDC confirm/on_confirm is not implemented yet.")
