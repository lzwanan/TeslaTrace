"""The one account this dashboard can have.

Not a user system: a single username and password, stored in one small JSON file
next to the container's volume. The point is to be able to lock the door, not to
model an organisation — no roles, no invitations, no password reset by email.

The file is the whole state. If it is absent the dashboard is open, which is the
default: a first run should show the car, not a login box.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import secrets
from dataclasses import dataclass
from pathlib import Path

log = logging.getLogger(__name__)

DEFAULT_USER = "admin"
DEFAULT_PASSWORD = "admin"

# OWASP's floor for PBKDF2-HMAC-SHA256. The only place a password is hashed is a
# login, so the cost is paid once per session rather than on every request.
ITERATIONS = 200_000


def hash_password(password: str, *, salt: bytes | None = None) -> str:
    salt = salt if salt is not None else secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, ITERATIONS)
    return f"pbkdf2_sha256${ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_password(stored: str, password: str) -> bool:
    try:
        algorithm, rounds, salt_hex, digest_hex = stored.split("$")
        if algorithm != "pbkdf2_sha256":
            return False
        digest = hashlib.pbkdf2_hmac(
            "sha256", password.encode(), bytes.fromhex(salt_hex), int(rounds)
        )
    except (ValueError, TypeError):
        return False
    return secrets.compare_digest(digest.hex(), digest_hex)


@dataclass(frozen=True, slots=True)
class Account:
    username: str
    password_hash: str
    # Set when the password is still the shipped default, so the UI can nag.
    # Cheaper and clearer than re-hashing "admin" on every page load.
    default_password: bool

    @property
    def signing_secret(self) -> str:
        """Sessions are signed with the password hash: change the password, and
        every session dies without a session table."""
        return self.password_hash


class Accounts:
    """Loads and saves the account file.

    ``path=None`` keeps everything in memory — used by tests and by a deployment
    whose data directory is not writable.
    """

    def __init__(self, path: Path | None = None) -> None:
        self._path = path
        self._account = self._read()
        self._stamp = self._stamp_now()
        self._last_error: str | None = None

    @property
    def path(self) -> Path | None:
        return self._path

    @property
    def last_error(self) -> str | None:
        return self._last_error

    def _stamp_now(self) -> int | None:
        try:
            return self._path.stat().st_mtime_ns if self._path else None
        except OSError:
            return None

    def current(self) -> Account | None:
        """The file is the source of truth, not this object.

        Deleting ``auth.json`` is the documented way out of a forgotten password,
        and it has to work without a restart. One ``stat`` per request is a
        rounding error next to the database query that follows it, and the file
        is only re-read when it actually changed.
        """
        if self._path is None:
            return self._account
        stamp = self._stamp_now()
        if stamp != self._stamp:
            self._stamp = stamp
            self._account = self._read()
        return self._account

    def _read(self) -> Account | None:
        if self._path is None or not self._path.exists():
            return None
        try:
            data = json.loads(self._path.read_text(encoding="utf-8"))
            return Account(
                username=str(data["username"]),
                password_hash=str(data["password"]),
                default_password=bool(data.get("default_password", False)),
            )
        except (OSError, ValueError, KeyError) as error:
            # A damaged file must not lock the owner out of their own car, but it
            # must be loud: silently running open would be worse.
            log.error("cannot read %s (%s); access protection is OFF", self._path, error)
            return None

    def _write(self, account: Account | None) -> None:
        self._account = account
        self._last_error = None
        if self._path is None:
            return
        try:
            self._path.parent.mkdir(parents=True, exist_ok=True)
            if account is None:
                self._path.unlink(missing_ok=True)
                return
            payload = {
                "version": 1,
                "username": account.username,
                "password": account.password_hash,
                "default_password": account.default_password,
            }
            temporary = self._path.with_suffix(".tmp")
            temporary.write_text(json.dumps(payload, indent=2), encoding="utf-8")
            os.chmod(temporary, 0o600)
            temporary.replace(self._path)
        except OSError as error:
            self._last_error = str(error)
            raise RuntimeError(f"cannot write {self._path}: {error}") from error
        finally:
            # We just wrote it; do not re-read our own work on the next request.
            self._stamp = self._stamp_now()

    def verify(self, username: str, password: str) -> bool:
        account = self.current()
        if account is None:
            return False
        # Compare the username first so a wrong name does not pay for a hash.
        if not secrets.compare_digest(username, account.username):
            return False
        return verify_password(account.password_hash, password)

    def confirm(self, password: str) -> bool:
        """Re-authentication for a settings change on an unlocked laptop."""
        account = self.current()
        return bool(account) and verify_password(account.password_hash, password)

    def enable(self, username: str, password: str) -> Account:
        account = Account(
            username=username,
            password_hash=hash_password(password),
            default_password=(username == DEFAULT_USER and password == DEFAULT_PASSWORD),
        )
        self._write(account)
        log.info("access protection enabled for %r", username)
        return account

    def change(self, *, username: str | None = None, password: str | None = None) -> Account:
        account = self._account
        if account is None:
            raise RuntimeError("no account to change")
        updated = Account(
            username=username or account.username,
            password_hash=hash_password(password) if password else account.password_hash,
            default_password=account.default_password and password is None,
        )
        if password:
            updated = Account(updated.username, updated.password_hash, False)
        self._write(updated)
        return updated

    def disable(self) -> None:
        self._write(None)
        log.info("access protection disabled — the dashboard is open")
