"""In-process WebSocket fan-out for live seat counts.

Single-process only. If you run several API workers, swap this for Supabase Realtime
or Postgres LISTEN/NOTIFY.
"""

import asyncio
import logging

from fastapi import WebSocket

log = logging.getLogger(__name__)


class Broadcaster:
    def __init__(self) -> None:
        self.clients: set[WebSocket] = set()
        self.loop: asyncio.AbstractEventLoop | None = None

    def bind(self, loop: asyncio.AbstractEventLoop) -> None:
        self.loop = loop

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self.clients.add(ws)

    def disconnect(self, ws: WebSocket) -> None:
        self.clients.discard(ws)

    async def _send_all(self, message: dict) -> None:
        for ws in list(self.clients):
            try:
                await ws.send_json(message)
            except Exception:  # client went away mid-send
                self.clients.discard(ws)

    def publish(self, message: dict) -> None:
        """Thread-safe: callable from sync endpoints (threadpool) and the scheduler thread."""
        if self.loop is None or not self.clients:
            return
        try:
            running = asyncio.get_running_loop()
        except RuntimeError:
            running = None
        if running is self.loop:
            self.loop.create_task(self._send_all(message))
        else:
            asyncio.run_coroutine_threadsafe(self._send_all(message), self.loop)


broadcaster = Broadcaster()
