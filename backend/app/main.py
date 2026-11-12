import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .auth import decode_token
from .config import get_settings
from .db import Base, SessionLocal, engine, retire_outdated_tables
from .models import User
from .realtime import broadcaster
from .routers import auth, places, pools, users
from .scheduler import start_scheduler

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    if settings.auto_create_tables:
        retire_outdated_tables()
        Base.metadata.create_all(engine)
    broadcaster.bind(asyncio.get_running_loop())
    scheduler = start_scheduler()
    yield
    if scheduler:
        scheduler.shutdown(wait=False)


app = FastAPI(title="TravelTrack Plaksha", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origin_list,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(pools.router)
app.include_router(places.router)


@app.get("/health")
def health():
    return {"ok": True}


@app.websocket("/ws")
async def board_socket(ws: WebSocket, token: str = ""):
    """Live board feed. Messages: {type: 'pool.upsert', pool} | {type: 'pool.delete', id}."""
    try:
        user_id = decode_token(token)
    except HTTPException:
        await ws.close(code=4401)
        return
    with SessionLocal() as db:
        if db.get(User, user_id) is None:
            await ws.close(code=4401)
            return

    await broadcaster.connect(ws)
    try:
        while True:
            msg = await ws.receive_text()
            if msg == "ping":
                await ws.send_text("pong")
    except WebSocketDisconnect:
        pass
    finally:
        broadcaster.disconnect(ws)
