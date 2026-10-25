"""Sessions, without a user table.

The cookie is ``<expiry>.<hmac>``, signed with the stored password hash. Three
consequences worth keeping:

* nothing is stored server side — no session table, no in-memory map to leak;
* changing the password invalidates every session at once, which is the only
  revocation mechanism a single-account dashboard needs;
* the cookie is HttpOnly and SameSite=Strict, so a script on the page cannot read
  it and another site cannot make the browser send it.

Login attempts are throttled per client address. The counter lives in memory and
resets on restart, which is fine for a household deployment: it stops a script
guessing a short token, not a determined attacker with weeks to spare.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
import time
from dataclasses import dataclass, field

COOKIE = "tt_session"

# Long enough to be invisible in daily use, short enough that a forgotten session
# on someone else's laptop eventually dies.
SESSION_SECONDS = 30 * 24 * 3600


def sign(secret: str, expires_at: int) -> str:
    digest = hmac.new(secret.encode(), str(expires_at).encode(), hashlib.sha256).hexdigest()
    return f"{expires_at}.{digest}"


def verify(secret: str, value: str, now: int | None = None) -> bool:
    """True when the cookie was issued for this secret and has not expired."""
    expires_text, _, digest = value.partition(".")
    if not expires_text.isdigit() or not digest:
        return False
    if int(expires_text) < (now if now is not None else int(time.time())):
        return False
    expected = hmac.new(secret.encode(), expires_text.encode(), hashlib.sha256).hexdigest()
    return secrets.compare_digest(digest, expected)


def issue(secret: str, now: int | None = None) -> str:
    return sign(secret, (now if now is not None else int(time.time())) + SESSION_SECONDS)


@dataclass
class Throttle:
    """Failed logins per client address, inside a sliding window."""

    limit: int = 10
    window: float = 60.0
    failures: dict[str, list[float]] = field(default_factory=dict)

    def _recent(self, key: str, now: float) -> list[float]:
        hits = [stamp for stamp in self.failures.get(key, []) if now - stamp < self.window]
        if hits:
            self.failures[key] = hits
        else:
            self.failures.pop(key, None)
        return hits

    def blocked(self, key: str, now: float | None = None) -> bool:
        return len(self._recent(key, now if now is not None else time.monotonic())) >= self.limit

    def fail(self, key: str, now: float | None = None) -> None:
        stamp = now if now is not None else time.monotonic()
        self.failures.setdefault(key, []).append(stamp)

    def clear(self, key: str) -> None:
        self.failures.pop(key, None)
