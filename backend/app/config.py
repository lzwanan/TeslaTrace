"""Configuration.

Deliberately tiny: every field below is one TeslaMate already has, with the same
name, so setup is "copy six lines out of your TeslaMate compose file". Nothing
here needs tuning to get a running dashboard.
"""

from __future__ import annotations

from urllib.parse import quote

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_host: str = "database"
    database_port: int = 5432
    database_name: str = "teslamate"
    database_user: str = "teslamate"
    database_pass: str = ""

    mqtt_host: str = "mosquitto"
    mqtt_port: int = 1883
    mqtt_username: str = ""
    mqtt_password: str = ""

    tz: str = "Asia/Shanghai"
    auth_token: str = ""
    log_level: str = "INFO"

    @field_validator("log_level")
    @classmethod
    def _upper(cls, v: str) -> str:
        return v.upper()

    @property
    def dsn(self) -> str:
        """Build a DSN with escaped credentials (passwords often contain @ or /)."""
        user = quote(self.database_user, safe="")
        password = quote(self.database_pass, safe="")
        return (
            f"postgresql://{user}:{password}"
            f"@{self.database_host}:{self.database_port}/{self.database_name}"
        )

    @property
    def mqtt_client_kwargs(self) -> dict:
        kwargs: dict = {"hostname": self.mqtt_host, "port": self.mqtt_port}
        if self.mqtt_username:
            kwargs["username"] = self.mqtt_username
            kwargs["password"] = self.mqtt_password or None
        return kwargs
