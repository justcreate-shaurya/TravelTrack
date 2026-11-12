import time
from types import SimpleNamespace

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from app import auth

CLIENT = "11111111-2222-3333-4444-555555555555"
TENANT = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)


@pytest.fixture(autouse=True)
def fake_jwks(monkeypatch):
    stub = SimpleNamespace(get_signing_key_from_jwt=lambda _t: SimpleNamespace(key=KEY.public_key()))
    monkeypatch.setattr(auth, "_ms_jwks", lambda: stub)


def token(**overrides) -> str:
    now = int(time.time())
    claims = {
        "aud": CLIENT,
        "iss": f"https://login.microsoftonline.com/{TENANT}/v2.0",
        "tid": TENANT,
        "iat": now,
        "nbf": now,
        "exp": now + 3600,
        "nonce": "nonce-123456",
        "name": "Avnet Singh",
        "preferred_username": "Avnet.Singh@plaksha.edu.in",
        **overrides,
    }
    claims = {k: v for k, v in claims.items() if v is not None}
    return jwt.encode(claims, KEY, algorithm="RS256", headers={"kid": "test"})


def test_endpoint_signs_in_and_creates_user(client):
    r = client.post("/auth/microsoft", json={"id_token": token(), "nonce": "nonce-123456"})
    assert r.status_code == 200, r.text
    user = r.json()["user"]
    assert user["email"] == "avnet.singh@plaksha.edu.in"
    assert user["name"] == "Avnet Singh"
    assert user["onboarded"] is False


def test_meta_exposes_ms_config(client):
    m = client.get("/meta").json()
    assert m["ms_client_id"] == CLIENT and m["ms_tenant"] == TENANT


@pytest.mark.parametrize(
    "overrides,nonce,code",
    [
        ({"tid": "ffffffff-0000-0000-0000-000000000000", "iss": "https://login.microsoftonline.com/ffffffff-0000-0000-0000-000000000000/v2.0"}, "nonce-123456", "WRONG_TENANT"),
        ({"preferred_username": "someone@outlook.com"}, "nonce-123456", "WRONG_DOMAIN"),
        ({"aud": "some-other-app"}, "nonce-123456", "BAD_MS_TOKEN"),
        ({"iss": "https://evil.example.com/v2.0"}, "nonce-123456", "BAD_MS_TOKEN"),
        ({"exp": int(time.time()) - 600}, "nonce-123456", "BAD_MS_TOKEN"),
        ({}, "different-nonce", "BAD_MS_TOKEN"),
    ],
)
def test_rejections(client, overrides, nonce, code):
    r = client.post("/auth/microsoft", json={"id_token": token(**overrides), "nonce": nonce})
    assert r.status_code in (401, 403)
    assert r.json()["detail"]["code"] == code


def test_email_claim_preferred_over_upn(client):
    t = token(email="Riya.K@plaksha.edu.in", preferred_username="riya.k_alt@plaksha.edu.in")
    r = client.post("/auth/microsoft", json={"id_token": t, "nonce": "nonce-123456"})
    assert r.json()["user"]["email"] == "riya.k@plaksha.edu.in"
