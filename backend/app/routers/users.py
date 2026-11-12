from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..db import get_db
from ..errors import fail
from ..models import PushSubscription, User
from ..schemas import MeOut, MeUpdate, PushSubIn

router = APIRouter(tags=["me"])


@router.get("/me", response_model=MeOut)
def read_me(user: User = Depends(get_current_user)):
    return user


@router.patch("/me", response_model=MeOut)
def update_me(body: MeUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    data = body.model_dump(exclude_unset=True)
    if "phone" in data and not data["phone"]:
        fail(422, "PHONE_REQUIRED", "A WhatsApp number is required")
    for key, value in data.items():
        setattr(user, key, value)
    db.commit()
    db.refresh(user)
    return user


@router.post("/push/subscribe", status_code=204)
def push_subscribe(body: PushSubIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    p256dh, auth = body.keys.get("p256dh"), body.keys.get("auth")
    if not p256dh or not auth:
        fail(422, "BAD_SUBSCRIPTION", "Push subscription is missing keys")
    sub = db.scalars(select(PushSubscription).where(PushSubscription.endpoint == body.endpoint)).first()
    if sub is None:
        db.add(PushSubscription(user_id=user.id, endpoint=body.endpoint, p256dh=p256dh, auth=auth))
    else:
        sub.user_id, sub.p256dh, sub.auth = user.id, p256dh, auth
    db.commit()


@router.post("/push/unsubscribe", status_code=204)
def push_unsubscribe(body: PushSubIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    sub = db.scalars(
        select(PushSubscription).where(
            PushSubscription.endpoint == body.endpoint, PushSubscription.user_id == user.id
        )
    ).first()
    if sub:
        db.delete(sub)
        db.commit()
