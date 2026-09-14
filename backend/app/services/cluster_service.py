"""
Kalakar Setu — Craft Cluster Service
Auto-assigns sellers into real-world craft communities (see
app/models/reference.py::Cluster) based on their craft_types + state_code,
and serves cluster listings/detail for the buyer-facing browse experience.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.reference import Cluster
from app.models.user import User


async def assign_cluster(db: AsyncSession, user: User) -> None:
    """
    Re-evaluate and set (or clear) this user's cluster_id from their
    current craft_types + state_code. Never raises — a seller whose
    craft/location doesn't match any known cluster simply keeps
    cluster_id = None and is treated as a normal, standalone seller.
    Call this after any change to craft_types or state_code.
    """
    if not user.craft_types or not user.state_code:
        user.cluster_id = None
        return

    result = await db.execute(
        select(Cluster).where(
            Cluster.state_code == user.state_code,
            Cluster.craft_type.in_(user.craft_types),
            Cluster.is_active == True,
        )
    )
    match = result.scalars().first()
    user.cluster_id = match.id if match else None


async def get_clusters(db: AsyncSession, state_code: str | None = None) -> list[Cluster]:
    """List active craft clusters, optionally filtered by state."""
    query = select(Cluster).where(Cluster.is_active == True).order_by(Cluster.name)
    if state_code:
        query = query.where(Cluster.state_code == state_code)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_cluster(db: AsyncSession, cluster_id: str) -> Cluster | None:
    result = await db.execute(select(Cluster).where(Cluster.id == cluster_id))
    return result.scalar_one_or_none()


async def get_cluster_members(db: AsyncSession, cluster_id: str) -> list[User]:
    """Sellers currently assigned to this cluster."""
    result = await db.execute(
        select(User).where(User.cluster_id == cluster_id, User.is_active == True)
    )
    return list(result.scalars().all())
