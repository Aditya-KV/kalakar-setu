"""
Kalakar Setu — LLM-powered Catalog Structuring
Turns a raw voice transcript into a polished, bilingual e-commerce listing
using an LLM. Two interchangeable free-tier providers are supported — Groq
is tried first (faster, more generous free-tier rate limits), then Gemini.
If neither API key is configured, or every configured provider fails for
any reason, this module returns None so the caller falls back to the
deterministic keyword+template pipeline in speech_service.py. It never
raises and never fabricates a partial/malformed result.
"""

import json
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)

_groq_client = None
_groq_client_init_attempted = False
_gemini_client = None
_gemini_client_init_attempted = False

SOURCE_LANGUAGE_NAMES = {
    "hi": "Hindi",
    "mr": "Marathi",
    "en": "English",
}

REQUIRED_ATTRIBUTE_GROUPS = ("material", "color", "technique")


def _build_prompt(transcript: str, source_language: str, craft_type: str | None) -> str:
    language_name = SOURCE_LANGUAGE_NAMES.get(source_language, source_language)
    craft_line = craft_type or "not specified"
    return f"""You are structuring a spoken product description from an Indian artisan into an e-commerce catalog listing.

The artisan spoke in {language_name}. Raw transcript (verbatim, may contain speech-recognition errors):
"{transcript}"

Craft type: {craft_line}

Return ONLY a JSON object with exactly this shape, nothing else:
{{
  "title": {{"en": "...", "hi": "...", "mr": "..."}},
  "description": {{"en": "...", "hi": "...", "mr": "..."}},
  "attributes": {{"material": ["..."], "color": ["..."], "technique": ["..."]}},
  "keywords": ["..."]
}}

Rules:
- title: a short, appealing product title (roughly 5-8 words), in English, Hindi, and Marathi.
- description: a polished 2-4 sentence marketplace description in English, Hindi, and Marathi, based only on what the artisan actually said — you may rephrase for clarity and marketplace appeal, but do not add materials, colors, techniques, prices, or claims that are not present in or clearly implied by the transcript.
- attributes: list only material/color/technique words actually mentioned or clearly implied by the transcript. Use empty arrays for anything not mentioned — never guess.
- keywords: 5-10 relevant English search keywords, deduplicated, lowercase.
- If the transcript is too short or unclear to extract a field confidently, use an empty string or empty array for that field rather than inventing content.
- Output valid JSON only — no markdown code fences, no commentary."""


def _normalize(data: dict) -> dict | None:
    """Validates the shape an LLM returned and coerces it to the exact schema
    the rest of the app expects. Returns None if the shape is unusable."""
    try:
        title = data["title"]
        description = data["description"]
        attributes_raw = data.get("attributes", {})
        attributes = {
            group: [str(v) for v in attributes_raw.get(group, []) if str(v).strip()]
            for group in REQUIRED_ATTRIBUTE_GROUPS
        }
        keywords = [str(k).strip() for k in data.get("keywords", []) if str(k).strip()]

        title_en = str(title["en"]).strip()
        title_hi = str(title["hi"]).strip()
        description_en = str(description["en"]).strip()
        description_hi = str(description["hi"]).strip()

        if not title_en or not description_en:
            return None

        normalized_title = {"en": title_en, "hi": title_hi or title_en}
        normalized_description = {"en": description_en, "hi": description_hi or description_en}
        for source, target in ((title, normalized_title), (description, normalized_description)):
            marathi = source.get("mr")
            if isinstance(marathi, str) and marathi.strip():
                target["mr"] = marathi.strip()

        return {
            "title": normalized_title,
            "description": normalized_description,
            "attributes": attributes,
            "keywords": keywords,
        }
    except (KeyError, TypeError, ValueError) as e:
        logger.warning(f"LLM response had an unusable shape: {e}")
        return None


def _get_groq_client():
    global _groq_client, _groq_client_init_attempted
    if not settings.GROQ_API_KEY:
        return None
    if _groq_client is None and not _groq_client_init_attempted:
        _groq_client_init_attempted = True
        try:
            from groq import Groq

            _groq_client = Groq(api_key=settings.GROQ_API_KEY)
        except Exception as e:
            logger.warning(f"Failed to initialize Groq client: {e}")
            _groq_client = None
    return _groq_client


def _get_gemini_client():
    global _gemini_client, _gemini_client_init_attempted
    if not settings.GEMINI_API_KEY:
        return None
    if _gemini_client is None and not _gemini_client_init_attempted:
        _gemini_client_init_attempted = True
        try:
            from google import genai

            _gemini_client = genai.Client(api_key=settings.GEMINI_API_KEY)
        except Exception as e:
            logger.warning(f"Failed to initialize Gemini client: {e}")
            _gemini_client = None
    return _gemini_client


def _generate_via_groq(transcript: str, source_language: str, craft_type: str | None) -> dict | None:
    client = _get_groq_client()
    if client is None:
        return None
    try:
        prompt = _build_prompt(transcript, source_language, craft_type)
        completion = client.chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.4,
        )
        data = json.loads(completion.choices[0].message.content)
        return _normalize(data)
    except Exception as e:
        logger.warning(f"Groq catalog structuring failed: {e}")
        return None


def _generate_via_gemini(transcript: str, source_language: str, craft_type: str | None) -> dict | None:
    client = _get_gemini_client()
    if client is None:
        return None
    try:
        from google.genai import types

        prompt = _build_prompt(transcript, source_language, craft_type)
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.4,
            ),
        )
        data = json.loads(response.text)
        return _normalize(data)
    except Exception as e:
        logger.warning(f"Gemini catalog structuring failed: {e}")
        return None


def generate_structured_listing(
    transcript: str, source_language: str, craft_type: str | None = None
) -> dict | None:
    """
    Structures a transcript into a bilingual catalog listing via whichever
    LLM provider is configured (Groq tried first, then Gemini). Returns a
    dict with an added "generated_by" key ("groq" or "gemini") on success,
    or None if no provider is configured or every configured provider fails
    — the caller is expected to fall back to the deterministic
    keyword+template pipeline in that case.
    """
    result = _generate_via_groq(transcript, source_language, craft_type)
    if result:
        return {**result, "generated_by": "groq"}

    result = _generate_via_gemini(transcript, source_language, craft_type)
    if result:
        return {**result, "generated_by": "gemini"}

    return None
