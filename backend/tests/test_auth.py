"""The account file, the login, and the settings that change both."""

from __future__ import annotations

import mimetypes
from pathlib import Path

import pytest
from test_api import make_client

from app import auth
from app.accounts import Accounts, hash_password, verify_password

LOGIN = {"username": "admin", "password": "admin"}


# --------------------------------------------------------------------- password


def test_hash_roundtrip():
    stored = hash_password("correct horse")
    assert verify_password(stored, "correct horse")
    assert not verify_password(stored, "correct hors")
    assert stored.startswith("pbkdf2_sha256$")


def test_hash_is_salted():
    assert hash_password("same") != hash_password("same")


@pytest.mark.parametrize(
    "stored",
    ["", "junk", "pbkdf2_sha256$1", "md5$1$aa$bb", "pbkdf2_sha256$x$aa$bb"],
)
def test_malformed_hashes_are_rejected(stored: str):
    assert not verify_password(stored, "anything")


# --------------------------------------------------------------------- accounts


def test_no_file_means_open_access(tmp_path: Path):
    accounts = Accounts(tmp_path / "auth.json")
    assert accounts.current() is None


def test_enable_writes_the_file_and_survives_a_reload(account_file: Path):
    Accounts(account_file).enable("liu", "hunter2")

    assert account_file.exists()
    reloaded = Accounts(account_file)
    assert reloaded.current() is not None
    assert reloaded.verify("liu", "hunter2")
    assert not reloaded.verify("liu", "hunter3")
    assert not reloaded.verify("admin", "hunter2")


def test_deleting_the_file_reopens_the_dashboard_without_a_restart(account_file: Path):
    """The documented way out of a forgotten password, and it has to be immediate:

    a process that caches the account until the next restart would leave someone
    locked out of their own car with the file already gone."""
    accounts = Accounts(account_file)
    accounts.enable("admin", "admin")
    assert accounts.current() is not None

    account_file.unlink()
    assert accounts.current() is None
    assert not accounts.verify("admin", "admin")


def test_the_shipped_default_is_flagged(account_file: Path):
    accounts = Accounts(account_file)
    assert accounts.enable("admin", "admin").default_password is True
    assert Accounts(account_file).enable("admin", "something").default_password is False


def test_changing_the_password_clears_the_default_flag(account_file: Path):
    accounts = Accounts(account_file)
    accounts.enable("admin", "admin")
    updated = accounts.change(password="a real one")

    assert updated.default_password is False
    assert accounts.verify("admin", "a real one")


def test_disabling_removes_the_file(account_file: Path):
    accounts = Accounts(account_file)
    accounts.enable("admin", "admin")
    accounts.disable()

    assert accounts.current() is None
    assert not account_file.exists()


def test_a_corrupt_file_opens_rather_than_locking_the_owner_out(account_file: Path):
    account_file.parent.mkdir(parents=True)
    account_file.write_text("{ this is not json", encoding="utf-8")

    assert Accounts(account_file).current() is None


def test_the_password_is_not_stored_in_plain_text(account_file: Path):
    Accounts(account_file).enable("admin", "hunter2")

    raw = account_file.read_text(encoding="utf-8")
    assert "hunter2" not in raw


# ----------------------------------------------------------------------- the API


def test_an_open_dashboard_says_so():
    with make_client() as client:
        assert client.get("/api/v1/session").json() == {
            "required": False,
            "authenticated": True,
            "username": None,
            "default_password": False,
        }


def test_login_opens_the_api_and_sign_out_closes_it(locked: Accounts):
    with make_client(accounts=locked) as client:
        assert client.get("/api/v1/session").json() == {
            "required": True,
            "authenticated": False,
            "username": "admin",
            "default_password": True,
        }

        assert client.post("/api/v1/session", json=LOGIN).status_code == 204
        assert client.get("/api/v1/session").json()["authenticated"] is True
        assert client.get("/api/v1/cars").status_code == 200

        assert client.delete("/api/v1/session").status_code == 204
        assert client.get("/api/v1/cars").status_code == 401


def test_a_wrong_password_sets_no_cookie(locked: Accounts):
    with make_client(accounts=locked) as client:
        response = client.post(
            "/api/v1/session", json={"username": "admin", "password": "nope"}
        )

    assert response.status_code == 401
    assert "set-cookie" not in {name.lower() for name in response.headers}


def test_a_wrong_username_is_refused(locked: Accounts):
    with make_client(accounts=locked) as client:
        response = client.post("/api/v1/session", json={"username": "root", "password": "admin"})

    assert response.status_code == 401


def test_repeated_failures_are_throttled(locked: Accounts):
    with make_client(accounts=locked) as client:
        codes = [
            client.post(
                "/api/v1/session", json={"username": "admin", "password": "nope"}
            ).status_code
            for _ in range(12)
        ]

    assert codes[:10] == [401] * 10
    assert codes[10] == 429


def test_a_successful_login_resets_the_counter(locked: Accounts):
    with make_client(accounts=locked) as client:
        for _ in range(9):
            client.post("/api/v1/session", json={"username": "admin", "password": "nope"})
        assert client.post("/api/v1/session", json=LOGIN).status_code == 204
        assert (
            client.post(
                "/api/v1/session", json={"username": "admin", "password": "nope"}
            ).status_code
            == 401
        )


def test_login_is_refused_when_nothing_is_configured():
    with make_client() as client:
        assert client.post("/api/v1/session", json=LOGIN).status_code == 400


def test_changing_the_password_signs_other_browsers_out(locked: Accounts):
    """Two browsers, one password change: the other one is locked out, this one is not."""
    with make_client(accounts=locked) as mine, make_client(accounts=locked) as other:
        for client in (mine, other):
            assert client.post("/api/v1/session", json=LOGIN).status_code == 204

        response = mine.put(
            "/api/v1/settings/auth",
            json={"enabled": True, "new_password": "a better one", "current_password": "admin"},
        )
        assert response.status_code == 200
        assert response.json()["default_password"] is False

        # Its cookie was signed with the old hash, so it is worthless now.
        assert other.get("/api/v1/cars").status_code == 401
        # The browser that made the change was handed a fresh one.
        assert mine.get("/api/v1/cars").status_code == 200


def test_settings_require_the_current_password(locked: Accounts):
    with make_client(accounts=locked) as client:
        client.post("/api/v1/session", json=LOGIN)

        assert (
            client.put(
                "/api/v1/settings/auth",
                json={"enabled": True, "new_password": "sneaky", "current_password": "wrong"},
            ).status_code
            == 403
        )
        assert client.put("/api/v1/settings/auth", json={"enabled": False}).status_code == 403


def test_settings_need_a_login(locked: Accounts):
    with make_client(accounts=locked) as client:
        assert client.put("/api/v1/settings/auth", json={"enabled": False}).status_code == 401


def test_enabling_protection_from_an_open_dashboard(account_file: Path):
    accounts = Accounts(account_file)
    with make_client(accounts=accounts) as client:
        response = client.put(
            "/api/v1/settings/auth",
            json={"enabled": True, "username": "admin", "new_password": "admin"},
        )

        assert response.status_code == 200
        assert response.json()["required"] is True
        assert response.json()["default_password"] is True
        assert accounts.current() is not None


def test_disabling_protection_reopens_the_dashboard(locked: Accounts):
    with make_client(accounts=locked) as client:
        client.post("/api/v1/session", json=LOGIN)
        response = client.put(
            "/api/v1/settings/auth", json={"enabled": False, "current_password": "admin"}
        )

        assert response.status_code == 200
        assert response.json()["required"] is False
        assert client.get("/api/v1/cars").status_code == 200


def test_short_passwords_and_blank_usernames_are_refused(locked: Accounts):
    with make_client(accounts=locked) as client:
        client.post("/api/v1/session", json=LOGIN)

        assert (
            client.put(
                "/api/v1/settings/auth",
                json={"enabled": True, "new_password": "abc", "current_password": "admin"},
            ).status_code
            == 400
        )
        assert (
            client.put(
                "/api/v1/settings/auth",
                json={"enabled": True, "username": "   ", "current_password": "admin"},
            ).status_code
            == 400
        )


def test_the_cookie_is_httponly_and_samesite(locked: Accounts):
    with make_client(accounts=locked) as client:
        response = client.post("/api/v1/session", json=LOGIN)

    cookie = response.headers["set-cookie"].lower()
    assert "httponly" in cookie
    assert "samesite=strict" in cookie
    assert f"max-age={auth.SESSION_SECONDS}" in cookie


# ----------------------------------------------------------------------- headers


def test_security_headers_are_present():
    with make_client() as client:
        response = client.get("/api/v1/cars")

    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["referrer-policy"] == "no-referrer"
    assert "script-src 'self'" in response.headers["content-security-policy"]
    assert "frame-ancestors 'none'" in response.headers["content-security-policy"]


def test_docs_are_exempt_from_the_policy():
    with make_client() as client:
        response = client.get("/api/docs")

    assert "content-security-policy" not in response.headers


def test_the_shell_is_revalidated_not_cached():
    """An index.html the browser may reuse for days is a dashboard stuck on an old
    build, with nothing on screen to say so."""
    with make_client() as client:
        assert client.get("/").headers["cache-control"] == "no-cache"


def test_the_manifest_gets_a_real_media_type():
    """Python's table does not know .webmanifest. Served as text/plain, browsers
    ignore the file and the app cannot be installed."""
    assert mimetypes.guess_type("app.webmanifest")[0] == "application/manifest+json"
