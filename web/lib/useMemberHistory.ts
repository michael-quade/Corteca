"use client";

import { useEffect, useRef, useState } from "react";
import { fetchWithAuth } from "@/web/lib/fetchWithAuth";
import type { Member } from "@/web/lib/corteca/types";

export type HistoryState = { status: "loading" } | { status: "error" } | { status: "ready"; members: Member[] };

/**
 * Corteca's client history for a network (REST members, ~2 s), read after each MCP load for the
 * "Recently disconnected" tab. It never holds up the page: the diagram and panels render from MCP
 * first, and a refresh keeps the previous list until the new one arrives.
 */
export function useMemberHistory(networkId: string | null, snapshot: unknown): HistoryState {
  const [state, setState] = useState<HistoryState>({ status: "loading" });
  const lastId = useRef<string | null>(null);

  useEffect(() => {
    if (lastId.current !== networkId) setState({ status: "loading" });
    lastId.current = networkId;
    if (!networkId || !snapshot) return;
    let cancelled = false;
    fetchWithAuth(`/api/networks/${encodeURIComponent(networkId)}/members`)
      .then(async (r) => {
        const body = (await r.json().catch(() => null)) as unknown;
        const list = Array.isArray(body) ? body : (body as { content?: unknown } | null)?.content;
        if (cancelled) return;
        setState(r.ok && Array.isArray(list) ? { status: "ready", members: list as Member[] } : { status: "error" });
      })
      .catch(() => { if (!cancelled) setState({ status: "error" }); });
    return () => { cancelled = true; };
  }, [networkId, snapshot]);

  return state;
}
