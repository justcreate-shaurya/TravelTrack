import os
import sys
from pathlib import Path

# Configure before the app (and its engine) is imported.
os.environ.update(
    DATABASE_URL="sqlite://",
    DEV_LOGIN="true",
    SCHEDULER_ENABLED="false",
    JWT_SECRET="test-secret-test-secret-test-secret",
    VAPID_PUBLIC_KEY="",
    VAPID_PRIVATE_KEY="",
    MS_CLIENT_ID="11111111-2222-3333-4444-555555555555",
    MS_TENANT_ID="aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    MATCH_RADIUS_KM="2.0",
    MATCH_GRACE_MINUTES="15",
    GEOCODER_URL="https://geocoder.test",
)
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(autouse=True)
def no_network(monkeypatch):
    """No test may reach the real geocoder. Tests that need results install their own fake."""
    from app import geocoder

    def blocked(url, params):
        raise AssertionError(f"unexpected network call to {url}")

    monkeypatch.setattr(geocoder, "http_get", blocked)
    geocoder.clear_cache()
    yield
    geocoder.clear_cache()


@pytest.fixture()
def client():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def login(client):
    def _login(email: str, phone: str = "9876543210", upi: str | None = None) -> dict:
        r = client.post("/auth/dev", json={"email": email})
        assert r.status_code == 200, r.text
        headers = {"Authorization": f"Bearer {r.json()['token']}"}
        body = {"phone": phone, "batch": "2027"}
        if upi:
            body["upi_id"] = upi
        r = client.patch("/me", json=body, headers=headers)
        assert r.status_code == 200, r.text
        return headers

    return _login
