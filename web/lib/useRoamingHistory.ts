"use client";

import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/web/lib/fetchWithAuth";
import { parseRssiHistory, type RssiHistory } from "@/web/lib/roamingHistory";

export type RoamingState = { status: "loading" } | { status: "error" } | { status: "ready"; history: RssiHistory };

// Per network snapshot and client, so reopening a panel doesn't re-read and Refresh does.
const cache = new Map<string, Promise<RssiHistory | null>>();

function readHistory(networkId: string, memberId: string, snapshot: string): Promise<RssiHistory | null> {
  const key = `${networkId}|${memberId}|${snapshot}`;
  let p = cache.get(key);
  if (!p) {
    p = fetchWithAuth(`/api/networks/${encodeURIComponent(networkId)}/members/${encodeURIComponent(memberId)}/rssi`)
      .then(async (r) => (r.ok ? parseRssiHistory(await r.json().catch(() => null)) : null))
      .catch(() => null);
    p.then((v) => { if (!v) cache.delete(key); });
    cache.set(key, p);
  }
  return p;
}

/** A client's association / RSSI history (client panel "Roaming history"), read when the panel opens. */
export function useRoamingHistory(networkId: string | null, memberId: string, snapshot: string | null): RoamingState {
  const [state, setState] = useState<RoamingState>({ status: "loading" });
  useEffect(() => {
    if (!networkId) return;
    let cancelled = false;
    setState({ status: "loading" });
    readHistory(networkId, memberId, snapshot ?? "").then((history) => {
      if (!cancelled) setState(history ? { status: "ready", history } : { status: "error" });
    });
    return () => { cancelled = true; };
  }, [networkId, memberId, snapshot]);
  return state;
}
