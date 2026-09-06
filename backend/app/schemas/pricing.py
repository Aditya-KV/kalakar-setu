"""
Kalakar Setu — Price Prediction Schemas
"""

from pydantic import BaseModel
from typing import Optional


class PricePredictionRequest(BaseModel):
    craft_type: Optional[str] = None
    title_en: str
    description_en: str
    materials: list[str] = []
    state_code: Optional[str] = None
    district_code: Optional[str] = None


class PriceReasoning(BaseModel):
    en: str
    hi: str


class PricePredictionResponse(BaseModel):
    available: bool
    suggested_price: Optional[int] = None
    price_range_min: Optional[int] = None
    price_range_max: Optional[int] = None
    reasoning: Optional[PriceReasoning] = None
    confidence: Optional[str] = None
    generated_by: Optional[str] = None
