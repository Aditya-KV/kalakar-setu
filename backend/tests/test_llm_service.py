"""
Kalakar Setu — LLM Catalog Structuring Tests
"""

from unittest.mock import patch, MagicMock

from app.services import llm_service


def _reset_clients():
    llm_service._groq_client = None
    llm_service._groq_client_init_attempted = False
    llm_service._gemini_client = None
    llm_service._gemini_client_init_attempted = False


def test_generate_structured_listing_returns_none_without_any_api_key():
    """Test both provider paths are skipped entirely (no crash) when no key is configured."""
    with patch("app.services.llm_service.settings.GROQ_API_KEY", ""), \
         patch("app.services.llm_service.settings.GEMINI_API_KEY", ""):
        _reset_clients()
        result = llm_service.generate_structured_listing("some transcript", "hi", "Saree")
        assert result is None


def test_normalize_accepts_well_formed_response():
    """Test a well-formed LLM JSON payload is accepted and coerced to the expected shape."""
    data = {
        "title": {"en": "Handwoven Cotton Saree", "hi": "हाथ से बुनी सूती साड़ी"},
        "description": {"en": "A beautiful handwoven saree.", "hi": "एक सुंदर हाथ से बुनी साड़ी।"},
        "attributes": {"material": ["Cotton"], "color": ["Red"], "technique": ["Handwoven"]},
        "keywords": ["saree", "cotton", "handwoven"],
    }
    result = llm_service._normalize(data)
    assert result is not None
    assert result["title"]["en"] == "Handwoven Cotton Saree"
    assert result["attributes"]["material"] == ["Cotton"]
    assert "saree" in result["keywords"]


def test_normalize_rejects_missing_required_fields():
    """Test malformed/incomplete LLM output is rejected rather than passed through partially."""
    assert llm_service._normalize({"title": {"en": "X", "hi": "Y"}}) is None
    assert llm_service._normalize({}) is None


def test_normalize_falls_back_hindi_to_english_when_missing():
    """Test a missing Hindi variant doesn't produce an empty string in the response."""
    data = {
        "title": {"en": "Wooden Elephant", "hi": ""},
        "description": {"en": "A hand-carved wooden elephant.", "hi": ""},
        "attributes": {"material": [], "color": [], "technique": []},
        "keywords": [],
    }
    result = llm_service._normalize(data)
    assert result["title"]["hi"] == "Wooden Elephant"
    assert result["description"]["hi"] == "A hand-carved wooden elephant."


def test_groq_tried_first_and_tagged_when_both_keys_configured():
    """Test Groq is attempted before Gemini, and a successful Groq result is tagged accordingly."""
    with patch("app.services.llm_service.settings.GROQ_API_KEY", "fake-groq-key"), \
         patch("app.services.llm_service.settings.GEMINI_API_KEY", "fake-gemini-key"):
        _reset_clients()

        mock_message = MagicMock()
        mock_message.content = (
            '{"title": {"en": "Handwoven Cotton Saree", "hi": "साड़ी"}, '
            '"description": {"en": "A saree.", "hi": "साड़ी।"}, '
            '"attributes": {"material": ["Cotton"], "color": [], "technique": []}, '
            '"keywords": ["saree"]}'
        )
        mock_completion = MagicMock()
        mock_completion.choices = [MagicMock(message=mock_message)]

        mock_groq_client = MagicMock()
        mock_groq_client.chat.completions.create.return_value = mock_completion

        with patch("app.services.llm_service._get_groq_client", return_value=mock_groq_client), \
             patch("app.services.llm_service._get_gemini_client") as mock_get_gemini:
            result = llm_service.generate_structured_listing("transcript", "hi", "Saree")
            assert result is not None
            assert result["generated_by"] == "groq"
            assert result["title"]["en"] == "Handwoven Cotton Saree"
            mock_get_gemini.assert_not_called()


def test_falls_back_to_gemini_when_groq_fails():
    """Test a Groq failure falls through to Gemini rather than giving up immediately."""
    with patch("app.services.llm_service.settings.GROQ_API_KEY", "fake-groq-key"), \
         patch("app.services.llm_service.settings.GEMINI_API_KEY", "fake-gemini-key"):
        _reset_clients()

        mock_groq_client = MagicMock()
        mock_groq_client.chat.completions.create.side_effect = RuntimeError("groq quota exceeded")

        mock_gemini_response = MagicMock()
        mock_gemini_response.text = (
            '{"title": {"en": "Wooden Elephant", "hi": "हाथी"}, '
            '"description": {"en": "A carved elephant.", "hi": "हाथी।"}, '
            '"attributes": {"material": ["Wood"], "color": [], "technique": []}, '
            '"keywords": ["elephant"]}'
        )
        mock_gemini_client = MagicMock()
        mock_gemini_client.models.generate_content.return_value = mock_gemini_response

        with patch("app.services.llm_service._get_groq_client", return_value=mock_groq_client), \
             patch("app.services.llm_service._get_gemini_client", return_value=mock_gemini_client):
            result = llm_service.generate_structured_listing("transcript", "hi", "Elephant")
            assert result is not None
            assert result["generated_by"] == "gemini"
            assert result["title"]["en"] == "Wooden Elephant"


def test_generate_structured_listing_falls_back_to_none_when_both_providers_fail():
    """Test any exception in both providers (network, quota, bad JSON) yields None, not a crash."""
    with patch("app.services.llm_service.settings.GROQ_API_KEY", "fake-groq-key"), \
         patch("app.services.llm_service.settings.GEMINI_API_KEY", "fake-gemini-key"):
        _reset_clients()

        mock_groq_client = MagicMock()
        mock_groq_client.chat.completions.create.side_effect = RuntimeError("groq down")
        mock_gemini_client = MagicMock()
        mock_gemini_client.models.generate_content.side_effect = RuntimeError("gemini down")

        with patch("app.services.llm_service._get_groq_client", return_value=mock_groq_client), \
             patch("app.services.llm_service._get_gemini_client", return_value=mock_gemini_client):
            result = llm_service.generate_structured_listing("transcript", "hi", "Saree")
            assert result is None
