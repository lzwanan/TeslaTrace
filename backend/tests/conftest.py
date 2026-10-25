"""Shared fixtures.

`locked` is an account store that already has admin/admin in it, written to a
temporary file so a test that changes the password cannot leak into the next one.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from app.accounts import Accounts


@pytest.fixture
def account_file(tmp_path: Path) -> Path:
    return tmp_path / "data" / "auth.json"


@pytest.fixture
def locked(account_file: Path) -> Accounts:
    accounts = Accounts(account_file)
    accounts.enable("admin", "admin")
    return accounts
