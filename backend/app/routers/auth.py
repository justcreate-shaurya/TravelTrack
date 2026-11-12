from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import is_campus_email, issue_token, verify_microsoft_id_token
from ..config import get_settings
from ..db import get_db
from ..errors import fail
from ..models import User
from ..push import push_enabled
from ..schemas import AuthOut, DevLoginIn, MeOut, MetaOut, MicrosoftLoginIn

router = APIRouter(tags=["auth"])


def _upsert_user(db: Session, email: str, name: str, avatar: str | None) -> User:
    email = email.lower().strip()
    user = db.scalars(select(User).where(User.email == email)).first()
    if user is None:
        user = User(email=email, name=name, avatar_url=avatar)
        db.add(user)
    else:
        user.avatar_url = avatar or user.avatar_url
    db.commit()
    db.refresh(user)
    return user


@router.get("/meta", response_model=MetaOut)
def meta():
    s = get_settings()
    return MetaOut(
        ms_client_id=s.ms_client_id,
        ms_tenant=s.ms_authority_tenant,
        dev_login=s.dev_login,
        allowed_domain=s.allowed_domain,
        vapid_public_key=s.vapid_public_key if push_enabled() else "",
        match_grace_minutes=s.match_grace_minutes,
        match_radius_km=s.match_radius_km,
        booking_unlock_minutes=s.booking_unlock_minutes,
    )


@router.post("/auth/microsoft", response_model=AuthOut)
def microsoft_login(body: MicrosoftLoginIn, db: Session = Depends(get_db)):
    info = verify_microsoft_id_token(body.id_token, body.nonce)
    user = _upsert_user(db, info["email"], info["name"], None)
    return AuthOut(token=issue_token(user), user=MeOut.model_validate(user))


@router.post("/auth/dev", response_model=AuthOut)
def dev_login(body: DevLoginIn, db: Session = Depends(get_db)):
    s = get_settings()
    if not s.dev_login:
        fail(404, "NOT_FOUND", "Not found")
    if not is_campus_email(body.email):
        fail(403, "WRONG_DOMAIN", f"Use an @{s.allowed_domain} address")
    local = body.email.split("@")[0]
    name = body.name or " ".join(p.capitalize() for p in local.replace("_", ".").split("."))
    user = _upsert_user(db, body.email, name, None)
    return AuthOut(token=issue_token(user), user=MeOut.model_validate(user))
