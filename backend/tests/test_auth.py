"""Session cookie, login throttling and the headers that go with them."""

from __future__ import annotations

import time

import pytest
from test_api import make_client

from app import auth
from app.config import Settings

SECRET = "s3cret-token"


def test_cookie_roundtrip_and_expiry():
    cookie = auth.issue(SECRET)
    assert auth.verify(SECRET, cookie)
    # A second short of the expiry is still valid; one second past is not.
    expires = int(cookie.split(".")[0])
    assert auth.verify(SECRET, cookie, now=expires - 1)
    assert not auth.verify(SECRET, cookie, now=expires + 1)


def test_cookie_is_bound_to_the_secret():
    """Rotating AUTH_TOKEN must log everyone out — that is the whole revocation story."""
    cookie = auth.issue(SECRET)
    assert not auth.verify("another-token", cookie)


@pytest.mark.parametrize("value", ["", "junk", "123", "123.", ".abc", "abc.def"])
def test_malformed_cookies_are_rejected(value: str):
    assert not auth.verify(SECRET, value)


def test_tampered_cookie_is_rejected():
    cookie = auth.issue(SECRET)
    expires, _, digest = cookie.partition(".")
    assert not auth.verify(SECRET, f"{int(expires) + 3600}.{digest}")


def test_throttle_blocks_after_the_limit():
    throttle = auth.Throttle(limit=3, window=60)
    for index in range(3):
        assert not throttle.blocked("1.2.3.4", now=index)
        throttle.fail("1.2.3.4", now=index)
    assert throttle.blocked("1.2.3.4", now=3)
    # A different client is unaffected, and a success clears the counter.
    assert not throttle.blocked("5.6.7.8", now=3)
    throttle.clear("1.2.3.4")
    assert not throttle.blocked("1.2.3.4", now=3)


def test_throttle_forgets_old_failures():
    throttle = auth.Throttle(limit=2, window=10)
    throttle.fail("1.2.3.4", now=0)
    throttle.fail("1.2.3.4", now=1)
    assert throttle.blocked("1.2.3.4", now=2)
    assert not throttle.blocked("1.2.3.4", now=30)


def test_session_endpoint_reports_an_open_dashboard():
    with make_client() as client:
        body = client.get("/api/v1/session").json()

    assert body == {"required": False, "authenticated": True}


def test_login_sets_a_cookie_that_opens_the_api():
    with make_client(settings=Settings(auth_token=SECRET)) as client:
        assert client.get("/api/v1/session").json() == {"required": True, "authenticated": False}
        assert client.get("/api/v1/cars").status_code == 401

        assert client.post("/api/v1/session", json={"token": SECRET}).status_code == 204
        assert client.get("/api/v1/session").json()["authenticated"] is True
        assert client.get("/api/v1/cars").status_code == 200

        assert client.delete("/api/v1/session").status_code == 204
        assert client.get("/api/v1/cars").status_code == 401


def test_wrong_token_does_not_set_a_cookie():
    with make_client(settings=Settings(auth_token=SECRET)) as client:
        response = client.post("/api/v1/session", json={"token": "nope"})

    assert response.status_code == 401
    assert "set-cookie" not in {name.lower() for name in response.headers}


def test_repeated_failures_are_throttled():
    with make_client(settings=Settings(auth_token=SECRET)) as client:
        codes = [client.post("/api/v1/session", json={"token": "nope"}).status_code for _ in range(12)]

    assert codes[:10] == [401] * 10
    assert codes[10] == 429


def test_a_success_resets_the_counter():
    with make_client(settings=Settings(auth_token=SECRET)) as client:
        for _ in range(9):
            client.post("/api/v1/session", json={"token": "nope"})
        assert client.post("/api/v1/session", json={"token": SECRET}).status_code == 204
        # Ten more wrong guesses are allowed again, not blocked from the first one.
        assert client.post("/api/v1/session", json={"token": "nope"}).status_code == 401


def test_login_is_refused_when_no_token_is_configured():
    with make_client() as client:
        assert client.post("/api/v1/session", json={"token": "anything"}).status_code == 400


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


def test_session_cookie_is_httponly_and_samesite():
    with make_client(settings=Settings(auth_token=SECRET)) as client:
        response = client.post("/api/v1/session", json={"token": SECRET})

    cookie = response.headers["set-cookie"].lower()
    assert "httponly" in cookie
    assert "samesite=strict" in cookie
    assert f"max-age={auth.SESSION_SECONDS}" in cookie


def test_session_survives_a_restart():
    """Nothing is stored server side: the cookie alone is the proof."""
    with make_client(settings=Settings(auth_token=SECRET)) as client:
        client.post("/api/v1/session", json={"token": SECRET})
        cookie = client.cookies.get(auth.COOKIE)

    assert cookie
    assert auth.verify(SECRET, cookie)
    assert int(cookie.split(".")[0]) > time.time()
