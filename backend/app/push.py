"""Web Push via VAPID. No-ops when VAPID keys aren't configured."""

import json
import logging
import uuid
from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import get_settings
from .models import PushSubscription

log = logging.getLogger(__name__)


def push_enabled() -> bool:
    s = get_settings()
    return bool(s.vapid_public_key and s.vapid_private_key)


def notify_users(
    db: Session, user_ids: Iterable[uuid.UUID], title: str, body: str, url: str = "/"
) -> int:
    if not push_enabled():
        return 0
    from pywebpush import WebPushException, webpush

    s = get_settings()
    ids = list(set(user_ids))
    if not ids:
        return 0
    subs = db.scalars(select(PushSubscription).where(PushSubscription.user_id.in_(ids))).all()
    payload = json.dumps({"title": title, "body": body, "url": url})
    sent = 0
    for sub in subs:
        try:
            webpush(
                subscription_info={"endpoint": sub.endpoint, "keys": {"p256dh": sub.p256dh, "auth": sub.auth}},
                data=payload,
                vapid_private_key=s.vapid_private_key,
                vapid_claims={"sub": s.vapid_subject},
                ttl=60 * 60,
            )
            sent += 1
        except WebPushException as exc:
            status = getattr(exc.response, "status_code", None)
            if status in (404, 410):  # subscription expired / unsubscribed
                db.delete(sub)
            else:
                log.warning("push failed for %s: %s", sub.endpoint[:40], exc)
    db.commit()
    return sent
