"""add Marathi product and order text

Revision ID: 6ce335b20a88
Revises: 497fd9961982
Create Date: 2026-09-06 12:29:27.341169

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6ce335b20a88'
down_revision: Union[str, None] = '497fd9961982'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Nullable additions preserve existing listings and order snapshots. No
    # translation is fabricated or backfilled for older products.
    if op.get_bind().dialect.name == "postgresql":
        op.execute("SET LOCAL lock_timeout = '5s'")
        op.execute("SET LOCAL statement_timeout = '30s'")
    op.add_column('listings', sa.Column('title_mr', sa.Text(), nullable=True))
    op.add_column('listings', sa.Column('description_mr', sa.Text(), nullable=True))
    op.add_column('order_items', sa.Column('title_mr', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('order_items', 'title_mr')
    op.drop_column('listings', 'description_mr')
    op.drop_column('listings', 'title_mr')
