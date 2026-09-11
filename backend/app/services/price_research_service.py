"""
Kalakar Setu — Price Research Service
Looks up real seller listing prices for similar handmade items on
IndiaMART (a large Indian B2B handicrafts marketplace) via Scrapling, so
the AI price prediction can be grounded in actual market data instead of
a pure LLM guess.

Best-effort and always safe to fail: any network/parsing issue, or a craft
category we don't have a mapping for (e.g. a brand-new category the AI
just invented for an unusual item), simply returns None so
llm_service.predict_price() falls back to its unguided estimate exactly
as before. This never raises and never blocks listing creation.
"""

import logging
import re

logger = logging.getLogger(__name__)

# IndiaMART category-listing pages, keyed by this app's own craft_type
# vocabulary (see llm_service.KNOWN_CRAFT_CATEGORIES). Each of these pages
# was confirmed to statically render real seller listings with prices — no
# JS/browser needed. A craft_type outside this fixed mapping (a new
# category the AI invented for an item that doesn't fit any of these)
# simply gets no reference prices; it's never forced into a wrong bucket.
CATEGORY_PAGES: dict[str, str] = {
    "pottery": "ceramic-pottery.html",
    "weaving": "fabric.html",
    "embroidery": "hand-embroidery.html",
    "woodwork": "wooden-decorative-item.html",
    "metalwork": "brass-handicrafts.html",
    "painting": "paintings.html",
    "bamboo": "bamboo-craft.html",
    "leather": "leather-bags.html",
    "stone": "marble-statue.html",
    "block_print": "block-print-fabric.html",
    "jewelry": "oxidised-jewellery.html",
    "papier_mache": "paper-mache.html",
}

_PRICE_RE = re.compile(r"[\d,]{2,7}")
_MIN_SAMPLE_SIZE = 3


def _extract_prices(page) -> list[int]:
    prices = []
    for el in page.css(".prc"):
        match = _PRICE_RE.search(el.text or "")
        if not match:
            continue
        try:
            value = int(match.group(0).replace(",", ""))
        except ValueError:
            continue
        # Sanity bounds — filters out stray unrelated numbers (e.g. a
        # "Min Order Qty" figure) that could slip past the .prc selector.
        if 10 <= value <= 500_000:
            prices.append(value)
    return prices


def find_reference_prices(craft_type: str | None) -> dict | None:
    """
    Returns a summary of real seller listing prices for the given craft
    category — {median, min, max, sample_size} (all INR) — or None if the
    category isn't one we have a mapping for, or the fetch/parse failed.
    Never raises.
    """
    if not craft_type:
        return None
    slug = CATEGORY_PAGES.get(craft_type)
    if not slug:
        return None

    try:
        from scrapling.fetchers import Fetcher
    except Exception as e:
        logger.warning(f"Scrapling not available: {e}")
        return None

    try:
        page = Fetcher.get(
            f"https://dir.indiamart.com/impcat/{slug}",
            stealthy_headers=True,
            timeout=10,
        )
        if page.status != 200:
            return None
        prices = sorted(_extract_prices(page))
    except Exception as e:
        logger.warning(f"Price research fetch failed for craft_type={craft_type!r}: {e}")
        return None

    if len(prices) < _MIN_SAMPLE_SIZE:
        return None

    n = len(prices)
    median = prices[n // 2] if n % 2 else (prices[n // 2 - 1] + prices[n // 2]) // 2
    return {
        "median": median,
        "min": prices[0],
        "max": prices[-1],
        "sample_size": n,
    }
