from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import StaticPool

from .config import get_settings


def _make_engine(url: str):
    if url.startswith("sqlite"):
        kwargs: dict = {"connect_args": {"check_same_thread": False}}
        if url in ("sqlite://", "sqlite:///:memory:"):
            kwargs["poolclass"] = StaticPool
        return create_engine(url, **kwargs)
    return create_engine(url, pool_pre_ping=True, pool_size=5, max_overflow=5)


engine = _make_engine(get_settings().sqlalchemy_url)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def retire_outdated_tables() -> None:
    """Make way for the current pools schema (free-form places, seats only).

    `create_all` never alters existing tables, so a database from before places had coordinates
    would break every pool query. On a local SQLite file the whole database is copied to
    `<file>.pre-places.bak` and the two ride tables are dropped so they get recreated (users and
    push subscriptions are kept). On any other database this refuses to start instead: recreate
    the tables there with db/schema.sql.
    """
    import logging
    import shutil
    from pathlib import Path

    from sqlalchemy import inspect

    insp = inspect(engine)
    if not insp.has_table("pools"):
        return
    if "origin_name" in {c["name"] for c in insp.get_columns("pools")}:
        return
    if engine.dialect.name != "sqlite":
        raise RuntimeError(
            "The pools table predates free-form places. Recreate it with db/schema.sql "
            "(drop pool_members and pools first)."
        )
    log = logging.getLogger(__name__)
    path = engine.url.database
    if path and path != ":memory:" and Path(path).exists():
        backup = Path(str(path) + ".pre-places.bak")
        if not backup.exists():
            engine.dispose()
            shutil.copy2(path, backup)
        log.warning("Old ride tables found. Backup kept at %s; recreating pools.", backup)
    with engine.begin() as conn:
        conn.exec_driver_sql("DROP TABLE IF EXISTS pool_members")
        conn.exec_driver_sql("DROP TABLE IF EXISTS pools")


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
