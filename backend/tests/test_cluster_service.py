"""
Kalakar Setu — Craft Cluster Service Tests
"""

import pytest
from app.db.session import async_session_factory
from app.models.user import User
from app.models.reference import Cluster
from app.services import cluster_service


async def _make_user(db, **kwargs) -> User:
    user = User(phone_number=kwargs.pop("phone_number", "+919999900001"), **kwargs)
    db.add(user)
    await db.flush()
    return user


@pytest.mark.asyncio
async def test_seller_is_assigned_to_a_matching_cluster():
    async with async_session_factory() as db:
        db.add(Cluster(
            name="Woodwork & Carving Cluster",
            craft_type="woodwork",
            state_code="KA",
            story="Home to Channapatna's toy-makers.",
            member_craft_names=["Channapatna toys and dolls"],
        ))
        await db.flush()

        user = await _make_user(db, craft_types=["woodwork"], state_code="KA")
        await cluster_service.assign_cluster(db, user)

        assert user.cluster_id is not None


@pytest.mark.asyncio
async def test_seller_with_no_matching_cluster_stays_a_normal_seller():
    async with async_session_factory() as db:
        db.add(Cluster(
            name="Woodwork & Carving Cluster",
            craft_type="woodwork",
            state_code="KA",
            story="Home to Channapatna's toy-makers.",
        ))
        await db.flush()

        # Right craft, wrong state — no match.
        user = await _make_user(db, phone_number="+919999900002", craft_types=["woodwork"], state_code="TN")
        await cluster_service.assign_cluster(db, user)

        assert user.cluster_id is None


@pytest.mark.asyncio
async def test_seller_with_no_craft_or_location_stays_unassigned():
    async with async_session_factory() as db:
        user = await _make_user(db, phone_number="+919999900003")
        await cluster_service.assign_cluster(db, user)

        assert user.cluster_id is None


@pytest.mark.asyncio
async def test_reassignment_clears_stale_cluster_when_craft_changes():
    async with async_session_factory() as db:
        db.add(Cluster(
            name="Woodwork & Carving Cluster",
            craft_type="woodwork",
            state_code="KA",
            story="Home to Channapatna's toy-makers.",
        ))
        await db.flush()

        user = await _make_user(db, craft_types=["woodwork"], state_code="KA")
        await cluster_service.assign_cluster(db, user)
        assert user.cluster_id is not None

        # Seller switches craft entirely; no cluster covers "pottery" in KA yet.
        user.craft_types = ["pottery"]
        await cluster_service.assign_cluster(db, user)
        assert user.cluster_id is None


@pytest.mark.asyncio
async def test_get_cluster_members_returns_only_assigned_active_sellers():
    async with async_session_factory() as db:
        cluster = Cluster(
            name="Woodwork & Carving Cluster",
            craft_type="woodwork",
            state_code="KA",
            story="Home to Channapatna's toy-makers.",
        )
        db.add(cluster)
        await db.flush()

        member = await _make_user(db, craft_types=["woodwork"], state_code="KA")
        await cluster_service.assign_cluster(db, member)

        other = await _make_user(db, phone_number="+919999900004")
        await db.flush()

        members = await cluster_service.get_cluster_members(db, cluster.id)

        assert [m.id for m in members] == [member.id]
