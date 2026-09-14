"""
Kalakar Setu — Craft Cluster Seed Loader

Loads backend/scripts/output/craft_clusters.json (produced by
scrape_craft_clusters.py) into the `clusters` table. Idempotent: an
existing cluster for the same (craft_type, state_code) has its
name/story/member_craft_names refreshed rather than duplicated, so this
is safe to re-run whenever the scrape is refreshed.

Run after the clusters table migration has been applied:
    venv/Scripts/python.exe scripts/load_craft_clusters.py
"""

import asyncio
import json
from pathlib import Path

from sqlalchemy import select

from app.db.session import async_session_factory
from app.models.reference import Cluster

DATA_PATH = Path(__file__).parent / "output" / "craft_clusters.json"


async def main():
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        clusters = json.load(f)

    created, updated = 0, 0
    async with async_session_factory() as db:
        for row in clusters:
            result = await db.execute(
                select(Cluster).where(
                    Cluster.craft_type == row["craft_type"],
                    Cluster.state_code == row["state_code"],
                )
            )
            existing = result.scalar_one_or_none()
            if existing:
                existing.name = row["name"]
                existing.story = row["story"]
                existing.member_craft_names = row["member_craft_names"]
                updated += 1
            else:
                db.add(Cluster(
                    name=row["name"],
                    craft_type=row["craft_type"],
                    state_code=row["state_code"],
                    story=row["story"],
                    member_craft_names=row["member_craft_names"],
                ))
                created += 1
        await db.commit()

    print(f"Loaded {len(clusters)} clusters ({created} created, {updated} updated).")


if __name__ == "__main__":
    asyncio.run(main())
