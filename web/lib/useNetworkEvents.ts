"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchWithAuth } from "@/web/lib/fetchWithAuth";
import { normaliseMac, parseEvents, type NetworkEvent } from "@/web/lib/networkEvents";
import type { EventNames } from "@/web/lib/eventItems";
import type { McpNetwork } from "@/web/lib/mcpNetwork";
import { clientName } from "@/web/lib/clientFields";

export type EventsLoad =
  | { status: "idle" | "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; events: NetworkEvent[]; truncated: boolean };

type Result = Exclude<EventsLoad, { status: "idle" | "loading" }>;

// Per network snapshot, so switching tabs doesn't re-read and Refresh does.
const cache = new Map<string, Promise<Result>>();

function readEvents(networkId: string, snapshot: string): Promise<Result> {
  const key = `${networkId}|${snapshot}`;
  let p = cache.get(key);
  if (!p) {
    p = fetchWithAuth(`/api/networks/${encodeURIComponent(networkId)}/activity`)
      .then(async (r): Promise<Result> => {
        const json = await r.json().catch(() => null);
        if (!r.ok) return { status: "error", error: json?.error ?? `HTTP ${r.status}` };
        return { status: "ready", events: parseEvents(json), truncated: !!json?.truncated };
      })
      .catch((e): Result => ({ status: "error", error: e instanceof Error ? e.message : String(e) }));
    p.then((v) => { if (v.status === "error") cache.delete(key); });
    cache.set(key, p);
  }
  return p;
}

/** The network's Corteca activity log (last 30 days), read in the background after each MCP load. */
export function useNetworkEvents(networkId: string | null, snapshot: string | null) {
  const [state, setState] = useState<EventsLoad>({ status: "idle" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!networkId) return;
    let cancelled = false;
    setState((s) => (s.status === "ready" ? s : { status: "loading" }));
    readEvents(networkId, snapshot ?? "").then((r) => { if (!cancelled) setState(r); });
    return () => { cancelled = true; };
  }, [networkId, snapshot, attempt]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { state, retry };
}

export interface EventDeviceNames extends EventNames {
  /** Link text: "Gateway · Beacon 19.1", "MBR · Beacon 10", "Beacon 9 · FB-53", client name. */
  label: (mac: string | null) => string;
  /** The diagram selection for a MAC, or null if it isn't in the network now. */
  selection: (mac: string | null) => { kind: "ap" | "client"; id: string } | null;
}

/** Names for event rows from the loaded network (nicknames applied). */
export function useEventNames(network: McpNetwork | null): EventDeviceNames {
  return useMemo(() => {
    const aps = new Map((network?.aps ?? []).map((a) => [normaliseMac(a.mac), a]));
    const members = new Map((network?.members ?? []).map((m) => [normaliseMac(m.id), m]));
    const gateway = network?.aps.find((a) => a.role === "root");
    const short = (mac: string | null, fallback?: string) => {
      if (!mac) return fallback ?? "Network";
      const ap = aps.get(mac);
      if (ap) return ap.nickname ?? (ap.role === "root" ? "Gateway" : ap.model);
      const m = members.get(mac);
      return m ? clientName(m) : fallback ?? mac;
    };
    const label = (mac: string | null) => {
      const ap = mac ? aps.get(mac) : undefined;
      if (!ap) return short(mac);
      if (ap.nickname) return `${ap.nickname} · ${ap.model}`;
      return ap.role === "root" ? `Gateway · ${ap.model}` : `${ap.model} · ${ap.mac.slice(-5)}`;
    };
    const selection = (mac: string | null) => {
      const ap = mac ? aps.get(mac) : undefined;
      if (ap) return { kind: "ap" as const, id: ap.mac };
      const m = mac ? members.get(mac) : undefined;
      return m ? { kind: "client" as const, id: m.id } : null;
    };
    return { short, label, selection, gatewayMac: gateway ? normaliseMac(gateway.mac) : null };
  }, [network]);
}
