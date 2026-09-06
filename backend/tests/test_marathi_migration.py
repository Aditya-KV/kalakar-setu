import importlib.util
from pathlib import Path

import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations


def test_marathi_migration_preserves_legacy_rows_and_accepts_new_text():
    path = Path(__file__).parents[1] / "alembic/versions/6ce335b20a88_add_marathi_product_and_order_text.py"
    spec = importlib.util.spec_from_file_location("marathi_migration", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    engine = sa.create_engine("sqlite:///:memory:")
    with engine.begin() as connection:
        connection.execute(sa.text("CREATE TABLE listings (id TEXT PRIMARY KEY, title_en TEXT NOT NULL)"))
        connection.execute(sa.text("CREATE TABLE order_items (id TEXT PRIMARY KEY, title_en TEXT NOT NULL)"))
        connection.execute(sa.text("INSERT INTO listings VALUES ('old', 'Existing pot')"))
        connection.execute(sa.text("INSERT INTO order_items VALUES ('old-order', 'Existing pot')"))
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
        assert connection.execute(sa.text("SELECT title_en, title_mr, description_mr FROM listings")).one() == ("Existing pot", None, None)
        assert connection.execute(sa.text("SELECT title_mr FROM order_items")).scalar() is None
        connection.execute(sa.text("UPDATE listings SET title_mr = :title, description_mr = :description"),
                           {"title": "मडके", "description": "हाताने बनवलेले"})
        assert connection.execute(sa.text("SELECT title_mr FROM listings")).scalar_one() == "मडके"
    engine.dispose()
