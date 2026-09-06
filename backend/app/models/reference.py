"""
Kalakar Setu — Reference Data Models
Craft types, states, districts, and supported languages.
"""

from sqlalchemy import String, Boolean, ForeignKey
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


class SupportedLanguage(Base):
    __tablename__ = "supported_languages"

    code: Mapped[str] = mapped_column(String(10), primary_key=True)  # e.g. "hi"
    name_en: Mapped[str] = mapped_column(String(50), nullable=False)
    name_native: Mapped[str] = mapped_column(String(50), nullable=False)
    display_order: Mapped[int] = mapped_column(default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
