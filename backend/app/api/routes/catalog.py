"""
Kalakar Setu — Voice Cataloger (Bolo-Likho) Routes
Endpoints for voice-to-text transcription/translation and structured listing generation.
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form

from app.api.deps import get_current_user_id
from app.schemas.catalog import (
    VoiceDescribeResponse,
    StructureRequest,
    StructureResponse,
)
from app.services import speech_service, llm_service

router = APIRouter(prefix="/catalog", tags=["Voice Cataloger"])


@router.post("/voice-describe", response_model=VoiceDescribeResponse)
async def voice_describe(
    file: UploadFile = File(...),
    language: str = Form("hi"),
    user_id: str = Depends(get_current_user_id),
):
    """
    Transcribes an uploaded voice recording and translates it into the app's
    supported languages (FR-4.1, FR-4.2, FR-4.3).
    """
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty audio file uploaded")

    result = speech_service.transcribe_audio(contents, file.filename or "recording.m4a", language)

    translations = {}
    if result["transcript"]:
        translations = speech_service.translate_text(result["transcript"], language)

    return VoiceDescribeResponse(
        transcript=result["transcript"],
        source_language=language,
        confidence=result["confidence"],
        used_fallback=result["used_fallback"],
        issues=result["issues"],
        translations=translations,
    )


@router.post("/structure", response_model=StructureResponse)
async def structure_listing(
    body: StructureRequest,
    user_id: str = Depends(get_current_user_id),
):
    """
    Parses a transcript into a structured, bilingual e-commerce listing:
    title, description, attributes and search keywords (FR-4.4, FR-4.5).
    """
    if not body.transcript.strip():
        raise HTTPException(status_code=400, detail="Transcript is empty")

    # Prefer an LLM (Groq, then Gemini) for richer, more natural bilingual
    # listings. Falls back to the deterministic keyword+template pipeline if
    # neither API key is configured or every configured provider fails
    # (network, quota, malformed output).
    ai_result = llm_service.generate_structured_listing(
        body.transcript, body.source_language, body.craft_type
    )
    if ai_result:
        return StructureResponse(**ai_result)

    attributes = speech_service.extract_attributes(body.transcript)
    keywords = speech_service.extract_keywords(attributes, body.craft_type)
    translations = speech_service.translate_text(body.transcript, body.source_language)

    title = speech_service.generate_title(attributes, body.craft_type)
    description = speech_service.generate_description(body.transcript, translations)

    return StructureResponse(
        title=title,
        description=description,
        attributes=attributes,
        keywords=keywords,
        generated_by="keyword_fallback",
    )
