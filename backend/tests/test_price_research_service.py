from unittest.mock import patch, MagicMock

from app.services import price_research_service as prs


def _fake_span(text: str) -> MagicMock:
    span = MagicMock()
    span.text = text
    return span


def _fake_page(status: int, price_texts: list[str]) -> MagicMock:
    page = MagicMock()
    page.status = status
    page.css.return_value = [_fake_span(t) for t in price_texts]
    return page


def test_returns_none_without_craft_type():
    assert prs.find_reference_prices(None) is None
    assert prs.find_reference_prices("") is None


def test_returns_none_for_unknown_craft_type():
    assert prs.find_reference_prices("underwater_basket_weaving") is None


def test_returns_none_when_fetch_status_not_200():
    fake_fetcher = MagicMock()
    fake_fetcher.get.return_value = _fake_page(404, [])
    with patch("scrapling.fetchers.Fetcher", fake_fetcher):
        assert prs.find_reference_prices("pottery") is None


def test_returns_none_when_too_few_prices_found():
    fake_fetcher = MagicMock()
    fake_fetcher.get.return_value = _fake_page(200, ["₹ 240 ", "₹ 500"])
    with patch("scrapling.fetchers.Fetcher", fake_fetcher):
        assert prs.find_reference_prices("pottery") is None


def test_returns_summary_when_enough_prices_found():
    fake_fetcher = MagicMock()
    fake_fetcher.get.return_value = _fake_page(
        200, ["₹ 240 ", "₹ 1,100", "₹ 90", "₹ 650", "not a price"]
    )
    with patch("scrapling.fetchers.Fetcher", fake_fetcher):
        result = prs.find_reference_prices("pottery")
    # sorted prices: 90, 240, 650, 1100 -> even count, median is the mean of the two middle values
    assert result == {"median": 445, "min": 90, "max": 1100, "sample_size": 4}


def test_filters_out_of_range_prices():
    fake_fetcher = MagicMock()
    fake_fetcher.get.return_value = _fake_page(
        200, ["₹ 5", "₹ 999999", "₹ 100", "₹ 200", "₹ 300"]
    )
    with patch("scrapling.fetchers.Fetcher", fake_fetcher):
        result = prs.find_reference_prices("pottery")
    assert result["sample_size"] == 3
    assert result["min"] == 100
    assert result["max"] == 300


def test_never_raises_on_fetch_exception():
    fake_fetcher = MagicMock()
    fake_fetcher.get.side_effect = RuntimeError("network down")
    with patch("scrapling.fetchers.Fetcher", fake_fetcher):
        assert prs.find_reference_prices("pottery") is None
