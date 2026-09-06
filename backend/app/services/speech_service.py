"""
Kalakar Setu — Voice Cataloger Speech Service (Bolo-Likho)
Converts artisan voice recordings into transcripts, bilingual translations,
and a structured e-commerce catalog listing (title, description, attributes, keywords).

Follows the same "best-effort real processing with an honest fallback" pattern as
app/services/image_service.py: try the real engine, and if it is unreachable
(no internet, unsupported codec, unintelligible audio) surface that clearly
instead of fabricating content the artisan never said.
"""

import io
import logging
import re
from tempfile import NamedTemporaryFile

import speech_recognition as sr
from pydub import AudioSegment
from deep_translator import GoogleTranslator

logger = logging.getLogger(__name__)

# Maps the app's short language codes (shared with locales/*.json) to the
# BCP-47 tags Google's speech API expects.
ASR_LANGUAGE_MAP = {
    "hi": "hi-IN",
    "mr": "mr-IN",
    "en": "en-IN",
}

TRANSLATION_TARGETS = ["en", "hi"]

# Keyword dictionaries used for lightweight, offline attribute extraction.
# Each canonical English attribute maps to spoken keyword variants across
# English, Hindi and Marathi so a raw transcript can be scanned directly.
MATERIAL_KEYWORDS: dict[str, list[str]] = {
    "Cotton": ["cotton", "सूती", "सूत", "कापूस"],
    "Silk": ["silk", "रेशम", "रेशमी", "रेशीम"],
    "Wood": ["wood", "wooden", "लकड़ी", "लकड़ी का", "लाकडी"],
    "Terracotta": ["terracotta", "clay", "मिट्टी", "माती", "टेराकोटा"],
    "Brass": ["brass", "पीतल"],
    "Copper": ["copper", "तांबा", "ताम्र"],
    "Silver": ["silver", "चांदी", "चांदीचे"],
    "Wool": ["wool", "woolen", "ऊन", "ऊनी", "लोकर"],
    "Jute": ["jute", "जूट", "ज्यूट"],
    "Bamboo": ["bamboo", "बांस", "बांबू"],
    "Leather": ["leather", "चमड़ा", "चामडे"],
    "Stone": ["stone", "पत्थर", "दगड"],
}

COLOR_KEYWORDS: dict[str, list[str]] = {
    "Red": ["red", "लाल", "तांबडा"],
    "Blue": ["blue", "नीला", "निळा"],
    "Green": ["green", "हरा", "हिरवा"],
    "Yellow": ["yellow", "पीला", "पिवळा"],
    "Black": ["black", "काला", "काळा"],
    "White": ["white", "सफ़ेद", "सफेद", "पांढरा"],
    "Orange": ["orange", "नारंगी", "केशरी"],
    "Pink": ["pink", "गुलाबी"],
    "Natural Dye": ["natural dye", "प्राकृतिक रंग", "नैसर्गिक रंग"],
}

TECHNIQUE_KEYWORDS: dict[str, list[str]] = {
    "Handwoven": ["handwoven", "hand woven", "हाथ से बुना", "हाथ से बुनी", "हातमाग"],
    "Hand-painted": ["hand painted", "hand-painted", "हाथ से बना", "हाताने रंगवलेले"],
    "Block Print": ["block print", "ब्लॉक प्रिंट", "छपाई"],
    "Hand-carved": ["carved", "hand carved", "नक्काशी", "कोरीव काम"],
    "Hand-thrown": ["hand thrown", "wheel thrown", "चाक पर बना", "चाकावर बनवलेले"],
    "Embroidery": ["embroidery", "कढ़ाई", "भरतकाम"],
    "Hand-molded": ["hand molded", "हाथ से गढ़ा", "हाताने घडवलेले"],
}

ATTRIBUTE_GROUPS = {
    "material": MATERIAL_KEYWORDS,
    "color": COLOR_KEYWORDS,
    "technique": TECHNIQUE_KEYWORDS,
}


def transcribe_audio(audio_bytes: bytes, filename: str, language: str = "hi") -> dict:
    """
    Transcribes a voice recording to text (FR-4.1, FR-4.2).
    Accepts whatever container the client recorded (m4a, webm, wav, ...) and
    converts it to a recognizer-compatible WAV via ffmpeg/pydub before running
    Google's free web speech ASR.
    """
    asr_language = ASR_LANGUAGE_MAP.get(language, "hi-IN")

    try:
        audio_format = (filename.rsplit(".", 1)[-1] if "." in filename else "m4a").lower()
        segment = AudioSegment.from_file(io.BytesIO(audio_bytes), format=audio_format)
        segment = segment.set_channels(1).set_frame_rate(16000)

        with NamedTemporaryFile(suffix=".wav", delete=True) as wav_file:
            segment.export(wav_file.name, format="wav")

            recognizer = sr.Recognizer()
            with sr.AudioFile(wav_file.name) as source:
                audio_data = recognizer.record(source)

            result = recognizer.recognize_google(
                audio_data, language=asr_language, show_all=True
            )

        if not result:
            return {
                "transcript": "",
                "confidence": 0.0,
                "used_fallback": False,
                "issues": ["Could not understand the audio. Please speak clearly and try again."],
            }

        best = result["alternative"][0] if isinstance(result, dict) else {"transcript": str(result)}
        return {
            "transcript": best.get("transcript", "").strip(),
            "confidence": round(float(best.get("confidence", 0.85)), 2),
            "used_fallback": False,
            "issues": [],
        }

    except sr.UnknownValueError:
        return {
            "transcript": "",
            "confidence": 0.0,
            "used_fallback": False,
            "issues": ["Could not understand the audio. Please speak clearly and try again."],
        }
    except (sr.RequestError, Exception) as e:
        logger.warning(f"ASR transcription failed, cannot process this recording: {e}")
        return {
            "transcript": "",
            "confidence": 0.0,
            "used_fallback": True,
            "issues": ["Speech service is unreachable right now. Please check your connection and retry."],
        }


def translate_text(text: str, source_language: str, target_languages: list[str] | None = None) -> dict:
    """
    Translates transcript text into the app's supported languages (FR-4.3).
    Always includes the source language itself (untranslated) in the result map.
    Falls back to the original text for any language the translator cannot reach,
    rather than fabricating a translation.
    """
    targets = target_languages or TRANSLATION_TARGETS
    translations: dict[str, str] = {source_language: text}

    if not text:
        return {lang: "" for lang in {source_language, *targets}}

    for lang in targets:
        if lang == source_language:
            continue
        try:
            translated = GoogleTranslator(source=source_language, target=lang).translate(text)
            translations[lang] = translated or text
        except Exception as e:
            logger.warning(f"Translation to '{lang}' failed, using source text: {e}")
            translations[lang] = text

    return translations


def _find_matches(text: str, keyword_map: dict[str, list[str]]) -> list[str]:
    lowered = text.lower()
    matches = []
    for canonical, variants in keyword_map.items():
        for variant in variants:
            if variant.lower() in lowered:
                matches.append(canonical)
                break
    return matches


def extract_attributes(text: str) -> dict:
    """Scans transcript text for material, color and technique keywords (FR-4.5)."""
    return {group: _find_matches(text, keywords) for group, keywords in ATTRIBUTE_GROUPS.items()}


def extract_keywords(attributes: dict, craft_type: str | None = None) -> list[str]:
    """Builds a deduplicated search-keyword list from matched attributes (FR-4.5)."""
    keywords: list[str] = []
    for values in attributes.values():
        keywords.extend(values)
    if craft_type:
        keywords.append(craft_type)
    # De-duplicate while preserving order
    seen = set()
    unique_keywords = []
    for kw in keywords:
        key = kw.lower()
        if key not in seen:
            seen.add(key)
            unique_keywords.append(kw)
    return unique_keywords


def _clean_transcript(text: str) -> str:
    """Trims filler whitespace and stray punctuation spacing from a raw transcript."""
    cleaned = re.sub(r"\s+", " ", text).strip()
    if cleaned and cleaned[-1] not in ".!?।":
        cleaned += "."
    return cleaned


def generate_title(attributes: dict, craft_type: str | None) -> dict:
    """Builds a bilingual product title from matched attributes (FR-4.4)."""
    descriptors_en = []
    if attributes.get("technique"):
        descriptors_en.append(attributes["technique"][0])
    if attributes.get("material"):
        descriptors_en.append(attributes["material"][0])
    base_en = craft_type or "Handcrafted Piece"
    title_en = " ".join([*descriptors_en, base_en]).strip()

    try:
        title_hi = GoogleTranslator(source="en", target="hi").translate(title_en) or title_en
    except Exception as e:
        logger.warning(f"Title translation to 'hi' failed, using English title: {e}")
        title_hi = title_en

    return {"en": title_en, "hi": title_hi}


def generate_description(transcript: str, translations: dict) -> dict:
    """Builds a bilingual description/origin-story from the cleaned transcript (FR-4.4)."""
    cleaned_source = _clean_transcript(transcript)
    description_en = _clean_transcript(translations.get("en", cleaned_source))
    description_hi = _clean_transcript(translations.get("hi", cleaned_source))
    return {"en": description_en, "hi": description_hi}
