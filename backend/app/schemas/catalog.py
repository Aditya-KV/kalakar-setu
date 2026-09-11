"""
Kalakar Setu — Voice Cataloger (Bolo-Likho) Pydantic Schemas
"""

from pydantic import BaseModel, Field


class VoiceDescribeResponse(BaseModel):
    transcript: str
    source_language: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    used_fallback: bool
    issues: list[str] = []
    translations: dict[str, str] = {}


class StructureRequest(BaseModel):
    transcript: str
    source_language: str = "hi"
    craft_type: str | None = None


class BilingualText(BaseModel):
    en: str
    hi: str
    mr: str | None = None


class ProductAttributes(BaseModel):
    material: list[str] = []
    color: list[str] = []
    technique: list[str] = []


class StructureResponse(BaseModel):
    title: BilingualText
    description: BilingualText
    attributes: ProductAttributes
    keywords: list[str] = []
    # Best-guess craft category inferred from the transcript itself (not
    # limited to a fixed list — a new/uncommon craft is returned as-is).
    # None when the transcript gives too little to go on.
    craft_type: str | None = None
    # "gemini" when the AI-structured pipeline produced this listing,
    # "keyword_fallback" when it fell back to the deterministic pipeline
    # (no API key configured, or the Gemini call failed).
    generated_by: str = "keyword_fallback"
