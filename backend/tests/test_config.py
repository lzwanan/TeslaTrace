from __future__ import annotations

from app.config import Settings


def clean(**overrides) -> Settings:
    """Settings that ignore the developer's own backend/.env.

    A local run needs one of those; a test that reads it asserts whatever that
    file happens to contain, and passes or fails by machine.
    """
    return Settings(_env_file=None, **overrides)


def test_defaults_match_teslamate_compose_names(monkeypatch):
    monkeypatch.setenv("DATABASE_PASS", "s3cret")
    settings = clean()

    assert settings.database_host == "database"
    assert settings.database_name == "teslamate"
    assert settings.mqtt_host == "mosquitto"
    assert settings.tz == "Asia/Shanghai"
    assert settings.data_dir == "data"  # the account file lives here, not in env
    assert settings.auth_file.name == "auth.json"


def test_env_overrides(monkeypatch):
    monkeypatch.setenv("DATABASE_HOST", "192.168.1.9")
    monkeypatch.setenv("DATABASE_PORT", "6543")
    monkeypatch.setenv("MQTT_USERNAME", "tesla")
    monkeypatch.setenv("MQTT_PASSWORD", "pw")
    monkeypatch.setenv("LOG_LEVEL", "debug")

    settings = clean()

    assert settings.database_host == "192.168.1.9"
    assert settings.database_port == 6543
    assert settings.log_level == "DEBUG"
    assert settings.mqtt_client_kwargs == {
        "hostname": "mosquitto",
        "port": 1883,
        "username": "tesla",
        "password": "pw",
    }


def test_dsn_escapes_credentials():
    settings = clean(database_pass="p@ss/word:1")
    dsn = settings.dsn

    assert "p%40ss%2Fword%3A1" in dsn
    assert dsn.startswith("postgresql://teslamate:")
    assert dsn.endswith(":5432/teslamate")


def test_mqtt_kwargs_omit_credentials_when_anonymous():
    assert clean().mqtt_client_kwargs == {"hostname": "mosquitto", "port": 1883}
