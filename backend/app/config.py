from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./traveltrack.db"
    auto_create_tables: bool = True

    jwt_secret: str = "change-me"
    jwt_ttl_hours: int = 24 * 14

    # Microsoft Entra ID (Office 365) app registration
    ms_client_id: str = ""
    ms_tenant_id: str = ""  # Directory (tenant) ID GUID; empty = any work/school tenant
    allowed_domain: str = "plaksha.edu.in"
    dev_login: bool = False

    cors_origins: str = "http://localhost:3000"

    vapid_public_key: str = ""
    vapid_private_key: str = ""
    vapid_subject: str = "mailto:travel-admin@plaksha.edu.in"

    scheduler_enabled: bool = True
    scheduler_interval_minutes: int = 10
    reminder_lead_minutes: int = 45
    archive_after_minutes: int = 30
    booking_unlock_minutes: int = 30
    match_grace_minutes: int = 15

    # Two rides match when both their pickups and their drops are within this many km.
    match_radius_km: float = 2.0
    # Place search behind /places/search and /places/reverse. With GEOAPIFY_API_KEY set it uses
    # Geoapify (reliable, free tier); without it, the public Photon instance at GEOCODER_URL.
    geoapify_api_key: str = ""
    geocoder_url: str = "https://photon.komoot.io"

    @property
    def ms_authority_tenant(self) -> str:
        return self.ms_tenant_id or "organizations"

    @property
    def cors_origin_list(self) -> list[str]:
        origins = set()
        for o in self.cors_origins.split(","):
            cleaned = o.strip()
            if cleaned:
                origins.add(cleaned)
                origins.add(cleaned.rstrip("/"))
                origins.add(cleaned.rstrip("/") + "/")
        return list(origins)

    @property
    def sqlalchemy_url(self) -> str:
        url = self.database_url
        # Supabase / Neon hand out plain postgres:// URLs; route them through psycopg v3.
        for prefix in ("postgres://", "postgresql://"):
            if url.startswith(prefix):
                return "postgresql+psycopg://" + url[len(prefix):]
        return url


@lru_cache
def get_settings() -> Settings:
    return Settings()
