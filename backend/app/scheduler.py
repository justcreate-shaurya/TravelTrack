"""Background jobs (every SCHEDULER_INTERVAL_MINUTES):

1. Archive pools 30 min past their window_end (status -> departed).
2. Push a reminder ~45 min before departure to every rider.

You could run the same logic with Supabase pg_cron instead; see db/schema.sql.
"""

import logging
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy import select

from .config import get_settings
from .db import SessionLocal
from .enums import PoolStatus
from .models import Pool
from .push import notify_users
from .services import ACTIVE, first_name, publish_delete, reminder_text

log = logging.getLogger(__name__)


def archive_job(now: datetime | None = None) -> int:
    s = get_settings()
    now = now or datetime.now(timezone.utc)
    cutoff = now - timedelta(minutes=s.archive_after_minutes)
    with SessionLocal() as db:
        pools = db.scalars(
            select(Pool).where(Pool.status.in_(ACTIVE), Pool.window_end < cutoff)
        ).all()
        for pool in pools:
            pool.status = PoolStatus.departed
        db.commit()
        for pool in pools:
            publish_delete(pool.id)
    if pools:
        log.info("archived %d pools", len(pools))
    return len(pools)


def reminder_job(now: datetime | None = None) -> int:
    s = get_settings()
    now = now or datetime.now(timezone.utc)
    horizon = now + timedelta(minutes=s.reminder_lead_minutes)
    sent = 0
    with SessionLocal() as db:
        pools = db.scalars(
            select(Pool).where(
                Pool.status.in_(ACTIVE),
                Pool.reminder_sent_at.is_(None),
                Pool.window_start > now,
                Pool.window_start <= horizon,
            )
        ).all()
        for pool in pools:
            mins = max(1, int((pool.window_start - now).total_seconds() // 60))
            for m in pool.members:
                others = [first_name(o.user) for o in pool.members if o.user_id != m.user_id]
                title, body = reminder_text(pool, mins, others)
                sent += notify_users(db, [m.user_id], title, body, f"/pool/{pool.id}")
            pool.reminder_sent_at = now
        db.commit()
    return sent


def run_jobs() -> None:
    try:
        archive_job()
        reminder_job()
    except Exception:  # keep the scheduler alive
        log.exception("scheduled job failed")


def start_scheduler() -> BackgroundScheduler | None:
    s = get_settings()
    if not s.scheduler_enabled:
        return None
    scheduler = BackgroundScheduler(timezone="UTC")
    scheduler.add_job(
        run_jobs,
        "interval",
        minutes=s.scheduler_interval_minutes,
        id="pool-maintenance",
        next_run_time=datetime.now(timezone.utc),
        max_instances=1,
        coalesce=True,
    )
    scheduler.start()
    return scheduler
