"""
Kalakar Setu — Craft Cluster Data Generator

One-time (re-runnable) data pipeline that uses Scrapling to build the seed
data for the "artisan cluster" feature: real craft communities across
India, grouped by (craft_type x state), each with a short background
story assembled from Wikipedia.

Source: Wikipedia's "Geographical indications in India" table, which
lists every GI-tag-registered Indian handicraft with its state. This is
the same authoritative, real-world craft-cluster geography referenced in
the feature discussion (e.g. Channapatna toys -> Karnataka woodcraft,
Bidriware -> Karnataka metalwork, Kutch embroidery -> Gujarat embroidery).

Output: backend/scripts/output/craft_clusters.json — a list of cluster
seed rows ready to load into the `clusters` table via the Alembic data
migration / seed_reference_data().

Safe to fail: any single page fetch that errors or times out is skipped;
the run always finishes and writes whatever it collected.
"""

import json
import re
import time
from pathlib import Path

from scrapling.fetchers import Fetcher

GI_LIST_URL = "https://en.wikipedia.org/wiki/Geographical_indications_in_India"
OUTPUT_PATH = Path(__file__).parent / "output" / "craft_clusters.json"

# Matches this app's own CraftType vocabulary (see app/services/reference_service.py).
# Order matters — more specific keywords are checked before broad fallbacks
# (e.g. "block print" before the "weaving" fallback catches Ajrakh/Bagh
# print correctly instead of lumping them in with plain textiles).
CRAFT_KEYWORD_RULES: list[tuple[str, list[str]]] = [
    ("papier_mache", ["papier", "paper mache", "paper-mache", "paper mâché"]),
    ("block_print", ["block print", "ajrakh", "bagh print", "dabu print", "sanganeri", "bagru print"]),
    ("jewelry", ["jewellery", "jewelry", "ornament", "oxidised", "filigree", "bead craft", "silver ware"]),
    ("stone", ["marble", "stone carving", "stone craft", "granite", "soapstone", "stone inlay"]),
    ("leather", ["leather", "mojari", "jutti", "kolhapuri chappal", "juttis"]),
    ("bamboo", ["bamboo", "cane craft", "cane furniture", "cane work"]),
    ("metalwork", ["brass", "bidri", "bell metal", "dokra", "dhokra", "copper", "metal craft", "wrought iron", "silverware", "bronze"]),
    ("papier_mache", ["papier"]),
    ("painting", ["painting", "patachitra", "pattachitra", "madhubani", "warli", "kalamkari", "thangka", "phad", "miniature", "pichwai"]),
    ("embroidery", ["embroidery", "kantha", "chikankari", "phulkari", "kasuti", "zardozi", "aari work"]),
    ("woodwork", ["wood", "rosewood", "sandalwood", "toys", "wood carving", "wood inlay", "wood craft"]),
    ("pottery", ["pottery", "terracotta", "ceramic", "blue pottery", "earthen"]),
    (
        "weaving",
        [
            "sari", "saree", "silk", "shawl", "handloom", "textile", "fabric",
            "ikat", "ikkat", "brocade", "jamdani", "khadi", "carpet", "durrie",
            "dhurrie", "rug", "weave", "weaving", "pashmina", "cotton",
        ],
    ),
]

STATE_NAME_TO_CODE = {
    "Andhra Pradesh": "AP", "Arunachal Pradesh": "AR", "Assam": "AS", "Bihar": "BR",
    "Chhattisgarh": "CT", "Goa": "GA", "Gujarat": "GJ", "Haryana": "HR",
    "Himachal Pradesh": "HP", "Jharkhand": "JH", "Karnataka": "KA", "Kerala": "KL",
    "Madhya Pradesh": "MP", "Maharashtra": "MH", "Manipur": "MN", "Meghalaya": "ML",
    "Mizoram": "MZ", "Nagaland": "NL", "Odisha": "OR", "Orissa": "OR", "Punjab": "PB",
    "Rajasthan": "RJ", "Sikkim": "SK", "Tamil Nadu": "TN", "Telangana": "TG",
    "Tripura": "TR", "Uttar Pradesh": "UP", "Uttarakhand": "UK", "West Bengal": "WB",
    "Delhi": "DL", "Jammu and Kashmir": "JK", "Jammu & Kashmir": "JK",
}

# Canonical display names matching this app's own states seed data
# (app/services/reference_service.py) rather than whichever Wikipedia
# spelling happened to be scraped last.
STATE_CODE_TO_NAME = {
    "AP": "Andhra Pradesh", "AR": "Arunachal Pradesh", "AS": "Assam", "BR": "Bihar",
    "CT": "Chhattisgarh", "GA": "Goa", "GJ": "Gujarat", "HR": "Haryana",
    "HP": "Himachal Pradesh", "JH": "Jharkhand", "KA": "Karnataka", "KL": "Kerala",
    "MP": "Madhya Pradesh", "MH": "Maharashtra", "MN": "Manipur", "ML": "Meghalaya",
    "MZ": "Mizoram", "NL": "Nagaland", "OR": "Odisha", "PB": "Punjab",
    "RJ": "Rajasthan", "SK": "Sikkim", "TN": "Tamil Nadu", "TG": "Telangana",
    "TR": "Tripura", "UP": "Uttar Pradesh", "UK": "Uttarakhand", "WB": "West Bengal",
    "DL": "Delhi", "JK": "Jammu & Kashmir",
}

CRAFT_LABELS = {
    "pottery": "Pottery & Ceramics", "weaving": "Weaving & Textiles",
    "embroidery": "Embroidery", "woodwork": "Woodwork & Carving",
    "metalwork": "Metalwork & Brass", "painting": "Painting & Art",
    "bamboo": "Bamboo & Cane", "leather": "Leather Craft", "stone": "Stone Carving",
    "block_print": "Block Printing", "jewelry": "Jewelry & Ornaments",
    "papier_mache": "Papier-Mache",
}

MAX_SOURCE_ITEMS_PER_CLUSTER = 3
REQUEST_DELAY_SECONDS = 0.4


def classify_craft(name: str) -> str | None:
    lowered = name.lower()
    for craft_type, keywords in CRAFT_KEYWORD_RULES:
        if any(kw in lowered for kw in keywords):
            return craft_type
    return None


def cell_text_and_link(cell) -> tuple[str, str | None]:
    anchors = cell.css("a")
    if anchors:
        return anchors[0].text.strip(), anchors[0].attrib.get("href")
    return cell.text.strip(), None


def fetch_gi_handicrafts() -> list[dict]:
    page = Fetcher.get(GI_LIST_URL, stealthy_headers=True)
    if page.status != 200:
        raise RuntimeError(f"Failed to fetch GI list: status {page.status}")

    table = page.css("table.wikitable")[0]
    rows = table.css("tr")[1:]

    entries = []
    for row in rows:
        cells = row.css("td")
        if len(cells) < 5:
            continue
        type_text = cells[3].text.strip()
        if type_text not in ("Handicraft", "Handicrafts", "Handi Crafts"):
            continue
        name, link = cell_text_and_link(cells[2])
        state_name, _ = cell_text_and_link(cells[4])
        if not name or not state_name:
            continue
        state_code = STATE_NAME_TO_CODE.get(state_name)
        craft_type = classify_craft(name)
        if not state_code or not craft_type:
            continue
        entries.append({
            "name": name,
            "state_code": state_code,
            "craft_type": craft_type,
            "wiki_url": link,
        })
    return entries


MAX_PARAGRAPH_CHARS = 420


def _trim_to_complete_sentence(text: str, max_chars: int) -> str:
    if len(text) <= max_chars:
        return text
    truncated = text[:max_chars]
    last_stop = truncated.rfind(". ")
    if last_stop > max_chars * 0.4:
        return truncated[: last_stop + 1]
    return truncated.rstrip() + "…"


def fetch_lead_paragraph(wiki_url: str) -> str | None:
    try:
        page = Fetcher.get(wiki_url, stealthy_headers=True)
    except Exception:
        return None
    if page.status != 200:
        return None
    for p in page.css("p"):
        text = re.sub(r"\[\d+\]", "", (p.text or "")).strip()
        text = re.sub(r"\s+", " ", text)
        if len(text) > 60:
            return _trim_to_complete_sentence(text, MAX_PARAGRAPH_CHARS)
    return None


def build_clusters(entries: list[dict]) -> list[dict]:
    groups: dict[tuple[str, str], list[dict]] = {}
    for entry in entries:
        key = (entry["craft_type"], entry["state_code"])
        groups.setdefault(key, []).append(entry)

    clusters = []
    for (craft_type, state_code), items in sorted(groups.items()):
        representatives = items[:MAX_SOURCE_ITEMS_PER_CLUSTER]
        story_parts = []
        source_items = []
        for item in representatives:
            paragraph = fetch_lead_paragraph(item["wiki_url"]) if item["wiki_url"] else None
            time.sleep(REQUEST_DELAY_SECONDS)
            if paragraph:
                story_parts.append(paragraph)
            source_items.append({"name": item["name"], "wiki_url": item["wiki_url"]})

        craft_label = CRAFT_LABELS.get(craft_type, craft_type)
        state_name = STATE_CODE_TO_NAME.get(state_code, state_code)
        names = ", ".join(i["name"] for i in representatives)
        joined_story = " ".join(part.rstrip(".") + "." for part in story_parts)
        clusters.append({
            "craft_type": craft_type,
            "state_code": state_code,
            "name": f"{state_name} {craft_label} Cluster",
            "story": joined_story or f"A community of {craft_label.lower()} artisans in {state_name}, known for {names}.",
            "member_craft_names": [i["name"] for i in items],
            "source_items": source_items,
        })
    return clusters


def main():
    print("Fetching GI handicraft list from Wikipedia...")
    entries = fetch_gi_handicrafts()
    print(f"Classified {len(entries)} handicraft entries into known craft types.")

    print("Building clusters and fetching background stories (this takes a few minutes)...")
    clusters = build_clusters(entries)
    print(f"Built {len(clusters)} craft clusters across India.")

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(clusters, f, ensure_ascii=False, indent=2)
    print(f"Wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
