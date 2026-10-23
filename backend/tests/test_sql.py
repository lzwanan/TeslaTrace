"""Guard rails for the SQL layer.

We cannot talk to PostgreSQL in CI, so two things are checked statically:
syntax (via sqlglot's postgres dialect) and the query-shape rules that keep a
13M-row table from being scanned.
"""

from __future__ import annotations

from pathlib import Path

import pytest
import sqlglot

SQL_DIR = Path(__file__).resolve().parent.parent / "app" / "sql"
FILES = sorted(SQL_DIR.glob("*.sql"))


def test_sql_files_exist():
    assert {path.name for path in FILES} >= {
        "cars.sql",
        "driving_stats.sql",
        "last_position.sql",
        "recent_drives.sql",
    }


@pytest.mark.parametrize("path", FILES, ids=lambda p: p.name)
def test_sql_parses_as_postgres(path: Path):
    sqlglot.parse(path.read_text(encoding="utf-8"), read="postgres")


@pytest.mark.parametrize("name", ["last_position.sql", "recent_drives.sql", "driving_stats.sql"])
def test_queries_are_scoped_to_one_car(name: str):
    """A missing car_id filter turns a 5ms lookup into a full table scan."""
    sql = (SQL_DIR / name).read_text(encoding="utf-8")
    assert "car_id" in sql
    assert "%(car_id)s" in sql


@pytest.mark.parametrize("name", ["last_position.sql", "recent_drives.sql"])
def test_queries_are_bounded(name: str):
    sql = (SQL_DIR / name).read_text(encoding="utf-8").lower()
    assert "limit" in sql


def test_no_ddl_is_issued():
    """TeslaTrace runs on a SELECT-only role; any DDL would break setup."""
    banned = ("create ", "alter ", "drop ", "insert ", "update ", "delete ", "grant ")
    for path in FILES:
        text = path.read_text(encoding="utf-8").lower()
        for word in banned:
            assert word not in text, f"{path.name} must stay read-only ({word.strip()} found)"
