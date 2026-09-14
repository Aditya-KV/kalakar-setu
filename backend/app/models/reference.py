"""
Kalakar Setu — Reference Data Models
Craft types, states, districts, and supported languages.
"""

import uuid
from sqlalchemy import String, Boolean, Text, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.db.session import Base


class CraftType(Base):
    __tablename__ = "craft_types"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)  # e.g. "pottery"
    name_en: Mapped[str] = mapped_column(String(100), nullable=False)
    name_hi: Mapped[str] = mapped_column(String(100), nullable=False)
    icon: Mapped[str | None] = mapped_column(String(50), nullable=True)  # emoji/icon name
    display_order: Mapped[int] = mapped_column(default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class State(Base):
    __tablename__ = "states"

    code: Mapped[str] = mapped_column(String(5), primary_key=True)  # e.g. "RJ"
    name_en: Mapped[str] = mapped_column(String(100), nullable=False)
    name_hi: Mapped[str] = mapped_column(String(100), nullable=False)


class District(Base):
    __tablename__ = "districts"

    code: Mapped[str] = mapped_column(String(10), primary_key=True)  # e.g. "RJ-JAI"
    state_code: Mapped[str] = mapped_column(
        String(5), ForeignKey("states.code"), index=True, nullable=False
    )
    name_en: Mapped[str] = mapped_column(String(100), nullable=False)
    name_hi: Mapped[str] = mapped_column(String(100), nullable=False)


class Cluster(Base):
    """
    An artisan craft cluster — a real-world community of sellers who
    share a craft type and a region (e.g. "Woodwork & Carving cluster,
    Karnataka" covering Channapatna toy-makers). Sellers are matched into
    a cluster automatically from their craft_types + state_code; a seller
    with no matching cluster simply has no cluster_id and behaves exactly
    as before (a normal, standalone seller).

    Seeded from real Geographical Indication (GI) craft data — see
    backend/scripts/scrape_craft_clusters.py.
    """

    __tablename__ = "clusters"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    craft_type: Mapped[str] = mapped_column(String(50), ForeignKey("craft_types.id"), index=True, nullable=False)
    state_code: Mapped[str] = mapped_column(String(5), ForeignKey("states.code"), index=True, nullable=False)
    story: Mapped[str] = mapped_column(Text, nullable=False)
    # Named GI craft items behind this cluster's story, e.g.
    # ["Channapatna toys and dolls", "Mysore Rosewood Inlay"].
    member_craft_names: Mapped[list | None] = mapped_column(JSON, nullable=True, default=list)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class SupportedLanguage(Base):
    __tablename__ = "supported_languages"

    code: Mapped[str] = mapped_column(String(10), primary_key=True)  # e.g. "hi"
    name_en: Mapped[str] = mapped_column(String(50), nullable=False)
    name_native: Mapped[str] = mapped_column(String(50), nullable=False)
    display_order: Mapped[int] = mapped_column(default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
