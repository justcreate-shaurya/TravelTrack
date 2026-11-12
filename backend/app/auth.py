import uuid
from datetime import datetime, timedelta, timezone
from functools import lru_cache

import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .config import get_settings
from .db import get_db
from .errors import fail
from .models import User

bearer = HTTPBearer(auto_error=False)
ALGO = "HS256"


def is_campus_email(email: str) -> bool:
    domain = get_settings().allowed_domain.lower()
    return email.lower().strip().endswith("@" + domain)


@lru_cache
def _ms_jwks() -> jwt.PyJWKClient:
    tenant = get_settings().ms_authority_tenant
    return jwt.PyJWKClient(
        f"https://login.microsoftonline.com/{tenant}/discovery/v2.0/keys",
        cache_keys=True,
        lifespan=6 * 3600,
    )


def verify_microsoft_id_token(id_token: str, nonce: str | None) -> dict:
    """Verify an Entra ID (v2.0) ID token and enforce the Plaksha tenant + email domain."""
    settings = get_settings()
    if not settings.ms_client_id:
        fail(503, "MS_NOT_CONFIGURED", "Microsoft sign-in isn't configured on the server")
    try:
        key = _ms_jwks().get_signing_key_from_jwt(id_token).key
        claims = jwt.decode(
            id_token,
            key,
            algorithms=["RS256"],
            audience=settings.ms_client_id,
            options={"require": ["exp", "iat", "aud", "iss", "tid"]},
            leeway=60,
        )
    except (jwt.PyJWTError, KeyError, ValueError):
        fail(401, "BAD_MS_TOKEN", "Microsoft sign-in failed, try again")

    tid = claims["tid"]
    # v2.0 issuer is tenant-specific; with the shared "organizations" key set we must check it ourselves.
    if claims["iss"] != f"https://login.microsoftonline.com/{tid}/v2.0":
        fail(401, "BAD_MS_TOKEN", "Microsoft sign-in failed, try again")
    if settings.ms_tenant_id and tid.lower() != settings.ms_tenant_id.lower():
        fail(403, "WRONG_TENANT", f"Sign in with your @{settings.allowed_domain} Microsoft account")
    if nonce is not None and claims.get("nonce") != nonce:
        fail(401, "BAD_MS_TOKEN", "Sign-in expired, try again")

    email = (claims.get("email") or claims.get("preferred_username") or claims.get("upn") or "").lower()
    if not is_campus_email(email):
        fail(403, "WRONG_DOMAIN", f"Sign in with your @{settings.allowed_domain} account")
    return {"email": email, "name": claims.get("name") or email.split("@")[0]}


def issue_token(user: User) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "hd": settings.allowed_domain,
        "iat": now,
        "exp": now + timedelta(hours=settings.jwt_ttl_hours),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGO)


def decode_token(token: str) -> uuid.UUID:
    settings = get_settings()
    try:
        claims = jwt.decode(token, settings.jwt_secret, algorithms=[ALGO])
        if claims.get("hd") != settings.allowed_domain or not is_campus_email(claims.get("email", "")):
            raise jwt.InvalidTokenError("domain")
        return uuid.UUID(claims["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        fail(401, "BAD_TOKEN", "Session expired, sign in again")


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if creds is None:
        fail(401, "NO_TOKEN", "Sign in first")
    user = db.get(User, decode_token(creds.credentials))
    if user is None:
        fail(401, "BAD_TOKEN", "Session expired, sign in again")
    return user


def require_onboarded(user: User = Depends(get_current_user)) -> User:
    if not user.onboarded:
        fail(403, "ONBOARDING_REQUIRED", "Add your WhatsApp number first")
    return user
