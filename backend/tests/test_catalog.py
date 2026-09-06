"""
Kalakar Setu — Voice Cataloger (Bolo-Likho) Tests
"""

from app.services import speech_service


def test_extract_attributes_from_hindi_transcript():
    """Test attribute keyword extraction from a Hindi transcript."""
    transcript = "यह हाथ से बुनी सूती साड़ी है, प्राकृतिक रंगों से बनी है।"
    attributes = speech_service.extract_attributes(transcript)
    assert "Cotton" in attributes["material"]
    assert "Handwoven" in attributes["technique"]
    assert "Natural Dye" in attributes["color"]


def test_extract_attributes_from_english_transcript():
    """Test attribute keyword extraction from an English transcript."""
    transcript = "This is a hand-painted terracotta vase with a blue finish."
    attributes = speech_service.extract_attributes(transcript)
    assert "Terracotta" in attributes["material"]
    assert "Hand-painted" in attributes["technique"]
    assert "Blue" in attributes["color"]


def test_extract_keywords_dedupes_and_includes_craft_type():
    """Test keyword extraction produces a deduplicated list including the craft type."""
    attributes = {"material": ["Cotton"], "color": ["Red"], "technique": ["Handwoven"]}
    keywords = speech_service.extract_keywords(attributes, craft_type="Ajrakh Block Print")
    assert keywords == ["Cotton", "Red", "Handwoven", "Ajrakh Block Print"]


def test_generate_title_uses_matched_attributes():
    """Test bilingual title generation composes technique + material + craft type."""
    attributes = {"material": ["Cotton"], "color": [], "technique": ["Handwoven"]}
    title = speech_service.generate_title(attributes, craft_type="Saree")
    assert title["en"] == "Handwoven Cotton Saree"
    assert title["hi"]  # Hindi variant should be populated (translated or a safe fallback)


def test_generate_title_falls_back_without_attributes():
    """Test title generation still produces a sensible default with no matched attributes."""
    title = speech_service.generate_title({"material": [], "color": [], "technique": []}, craft_type=None)
    assert title["en"] == "Handcrafted Piece"


def test_generate_description_cleans_and_punctuates_transcript():
    """Test description generation trims whitespace and ensures terminal punctuation."""
    translations = {"en": "  this saree is made from natural dyes  ", "hi": "यह साड़ी प्राकृतिक रंगों से बनी है"}
    description = speech_service.generate_description("raw transcript", translations)
    assert description["en"] == "this saree is made from natural dyes."
    assert description["hi"].endswith("।") or description["hi"].endswith(".")


def test_translate_text_includes_source_language_untranslated():
    """Test translation map always carries the original source-language text."""
    translations = speech_service.translate_text("", "hi")
    assert translations == {"hi": "", "en": ""}


def test_transcribe_audio_handles_invalid_bytes_gracefully():
    """Test that unrecognizable/corrupt audio bytes fail safely without crashing or fabricating text."""
    result = speech_service.transcribe_audio(b"not-real-audio-data", "recording.m4a", "hi")
    assert result["transcript"] == ""
    assert result["confidence"] == 0.0
    assert len(result["issues"]) > 0
