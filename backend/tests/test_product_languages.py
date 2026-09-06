from app.schemas.catalog import StructureResponse
from app.schemas.listing import BilingualText, ListingCreateRequest
from app.services.llm_service import _normalize, _build_prompt


def test_marathi_survives_structure_and_publish_payloads():
    result = StructureResponse(
        title={"en": "Clay pot", "hi": "मिट्टी का घड़ा", "mr": "मातीचे मडके"},
        description={"en": "Handmade pot", "hi": "हाथ से बना घड़ा", "mr": "हाताने बनवलेले मडके"},
        attributes={},
    )
    listing = ListingCreateRequest(**result.model_dump(exclude={"generated_by"}), price=400)
    assert listing.model_dump()["title"]["mr"] == "मातीचे मडके"
    assert listing.model_dump()["description"]["mr"] == "हाताने बनवलेले मडके"


def test_legacy_bilingual_products_remain_valid():
    text = BilingualText(en="Pot", hi="घड़ा")
    assert text.mr is None


def test_llm_preserves_marathi_without_inventing_missing_translation():
    data = {"title": {"en": "Pot", "hi": "घड़ा", "mr": " मडके "},
            "description": {"en": "Handmade", "hi": "हाथ से बना", "mr": None}}
    result = _normalize(data)
    assert result["title"]["mr"] == "मडके"
    assert "mr" not in result["description"]
    assert "Marathi" in _build_prompt("Pot", "en", None)
