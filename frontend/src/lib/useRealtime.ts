"use client";

import { useEffect } from "react";

import { API_URL, api, ApiError } from "./api";
import { useStore } from "./store";
import type { Pool } from "./types";

type Message = { type: "pool.upsert"; pool: Pool } | { type: "pool.delete"; id: string };

/**
 * Live board updates over WebSocket, with backoff reconnect and a resync on reconnect.
 * Mounted once by the signed-in layout (app/(app)/layout.tsx).
 */
export function useRealtime() {
  const token = useStore((s) => s.token);

  useEffect(() => {
    if (!token) return;
    const { upsertPool, removePool, setLive, refreshPools } = useStore.getState();
    const wsUrl = API_URL.replace(/^http/, "ws") + `/ws?token=${encodeURIComponent(token)}`;

    let ws: WebSocket | null = null;
    let retry = 0;
    let closed = false;
    let ping: ReturnType<typeof setInterval> | undefined;
    let reconnect: ReturnType<typeof setTimeout> | undefined;
    const contactTimers = new Map<string, ReturnType<typeof setTimeout>>();

    // Broadcasts are viewer-neutral: they carry no contact link, so a WhatsApp group link added
    // or changed by the creator would not reach riders. For a ride I am in, refetch my own view
    // of it. The ride page does its own refetch for the ride it is showing.
    const refreshContact = (pool: Pool) => {
      const meId = useStore.getState().me?.id;
      if (!meId || !pool.members.some((m) => m.user.id === meId)) return;
      if (window.location.pathname.replace(/\/+$/, "") === `/pool/${pool.id}`) return;
      clearTimeout(contactTimers.get(pool.id));
      contactTimers.set(
        pool.id,
        setTimeout(() => {
          contactTimers.delete(pool.id);
          api
            .pool(pool.id)
            .then((fresh) => !closed && useStore.getState().upsertPool(fresh, true))
            .catch((e) => {
              if (!closed && e instanceof ApiError && e.status === 404) removePool(pool.id);
            });
        }, 400),
      );
    };

    const connect = () => {
      ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        if (retry > 0) refreshPools().catch(() => {});
        retry = 0;
        setLive(true);
        ping = setInterval(() => ws?.readyState === WebSocket.OPEN && ws.send("ping"), 25_000);
      };
      ws.onmessage = (ev) => {
        if (ev.data === "pong") return;
        try {
          const msg = JSON.parse(ev.data) as Message;
          if (msg.type === "pool.upsert") {
            upsertPool(msg.pool);
            if (msg.pool.status !== "departed") refreshContact(msg.pool);
          }
          else if (msg.type === "pool.delete") removePool(msg.id);
        } catch {
          /* ignore malformed frames */
        }
      };
      ws.onclose = (ev) => {
        setLive(false);
        clearInterval(ping);
        if (closed || ev.code === 4401) return;
        retry += 1;
        reconnect = setTimeout(connect, Math.min(30_000, 1000 * 2 ** retry));
      };
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") refreshPools().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisible);
    connect();

    return () => {
      closed = true;
      clearInterval(ping);
      clearTimeout(reconnect);
      for (const t of contactTimers.values()) clearTimeout(t);
      document.removeEventListener("visibilitychange", onVisible);
      ws?.close();
      setLive(false);
    };
  }, [token]);
}
