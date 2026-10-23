"""Guard rails for the SQL layer.

We cannot talk to PostgreSQL in CI, so two things are checked statically:
syntax (via sqlglot's postgres dialect) and the query-shape rules that keep a
13M-row table from being scanned.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest
import sqlglot

SQL_DIR = Path(__file__).resolve().parent.parent / "app" / "sql"
FILES = sorted(SQL_DIR.glob("*.sql"))

PLACEHOLDER = re.compile(r"%\(\w+\)s")

# The only query that is not scoped to a car: it lists them.
UNSCOPED = {"cars.sql"}


def parseable(sql: str) -> str:
    """`%(name)s` is psycopg's syntax, not SQL.

    sqlglot reads it as a modulo expression and, depending on the version, either
    tolerates it or fails outright — which is how this test spent several commits
    passing locally against a newer sqlglot while CI failed on every file.
    """
    return PLACEHOLDER.sub("NULL", sql)


def test_sql_files_exist():
    assert {path.name for path in FILES} >= {
        "cars.sql",
        "driving_stats.sql",
        "last_position.sql",
        "recent_drives.sql",
    }


@pytest.mark.parametrize("path", FILES, ids=lambda p: p.name)
def test_sql_parses_as_postgres(path: Path):
    sqlglot.parse(parseable(path.read_text(encoding="utf-8")), read="postgres")


@pytest.mark.parametrize("path", FILES, ids=lambda p: p.name)
def test_every_file_uses_bound_parameters(path: Path):
    """A literal car id or limit in the SQL would defeat the placeholder check above."""
    if path.name in UNSCOPED:
        return
    assert PLACEHOLDER.search(path.read_text(encoding="utf-8")), path.name



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
