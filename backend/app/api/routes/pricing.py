"""
Kalakar Setu — Price Prediction Routes
An AI-estimated fair price for a handmade product, based on craft type,
materials, and the artisan's region — not real-time market data (see
llm_service.predict_price). Never fails hard: if no LLM provider is
configured or every one fails, returns available=false so the frontend can
let the seller price the item manually without interruption.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.api.deps import get_current_user_id
from app.schemas.pricing import PricePredictionRequest, PricePredictionResponse
from app.models.reference import State, District
from app.services import llm_service

router = APIRouter(prefix="/pricing", tags=["Price Prediction"])


@router.post("/predict", response_model=PricePredictionResponse)
async def predict_price(
    body: PricePredictionRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    state_name = None
    district_name = None

    if body.district_code:
        result = await db.execute(select(District).where(District.code == body.district_code))
        district = result.scalar_one_or_none()
        if district:
            district_name = district.name_en

    if body.state_code:
        result = await db.execute(select(State).where(State.code == body.state_code))
        state = result.scalar_one_or_none()
        if state:
            state_name = state.name_en

    prediction = llm_service.predict_price(
        craft_type=body.craft_type,
        title_en=body.title_en,
        description_en=body.description_en,
        materials=body.materials,
        state_name=state_name,
        district_name=district_name,
    )

    if not prediction:
        return PricePredictionResponse(available=False)

    return PricePredictionResponse(
        available=True,
        suggested_price=prediction["suggested_price"],
        price_range_min=prediction["price_range_min"],
        price_range_max=prediction["price_range_max"],
        reasoning=prediction["reasoning"],
        confidence=prediction["confidence"],
        generated_by=prediction["generated_by"],
        reference_prices=prediction.get("reference_prices"),
    )
