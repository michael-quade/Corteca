"use client";

import { useEffect, useRef, useState } from "react";
import { fetchWithAuth } from "@/web/lib/fetchWithAuth";
import type { EthernetPort } from "@/web/components/EthernetPortPanel";

type Result = EthernetPort[] | "error";

// Successful reads per gateway and network snapshot (so Refresh re-reads). Failures are never
// cached: the gateway sometimes drops one of several USP reads sent at once, and a cached failure
// kept the panel on "Live port status unavailable" for the whole snapshot.
const liveCache = new Map<string, EthernetPort[]>();
// Reads in progress per gateway: the page (switch inference) and the AP panels share one.
const inflight = new Map<string, Promise<Result>>();

const normMac = (mac: string) => mac.toUpperCase().replace(/:/g, "-");

async function fetchPorts(mac: string): Promise<Result> {
  try {
    const r = await fetchWithAuth(`/api/network/${encodeURIComponent(mac)}/ethernet`);
    const body = (await r.json().catch(() => null)) as { ports?: unknown } | null;
    return r.ok && Array.isArray(body?.ports) && body.ports.length ? (body.ports as EthernetPort[]) : "error";
  } catch {
    return "error";
  }
}

/**
 * The gateway's live TR-181 Ethernet ports: one shared read per gateway, retried once on failure.
 * `snapshot` null = a fresh read that isn't cached (the page reads again after every MCP load).
 */
export function readGatewayPorts(gatewayMac: string, snapshot: string | null): Promise<Result> {
  const mac = normMac(gatewayMac);
  const key = snapshot === null ? null : `${mac}|${snapshot}`;
  const cached = key ? liveCache.get(key) : undefined;
  if (cached) return Promise.resolve(cached);
  let p = inflight.get(mac);
  if (!p) {
    p = fetchPorts(mac)
      .then((r) => (r === "error" ? new Promise<Result>((ok) => setTimeout(() => ok(fetchPorts(mac)), 1500)) : r))
      .finally(() => inflight.delete(mac));
    inflight.set(mac, p);
  }
  return p.then((r) => { if (key && r !== "error") liveCache.set(key, r); return r; });
}

/** Live TR-181 Ethernet ports of the gateway (null while loading, "error" if unavailable). */
export function useGatewayPorts(gatewayMac: string | undefined, snapshot: string | null): Result | null {
  const key = gatewayMac ? `${normMac(gatewayMac)}|${snapshot ?? ""}` : "";
  const [ports, setPorts] = useState<Result | null>(gatewayMac ? liveCache.get(key) ?? null : "error");

  const lastMac = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!gatewayMac) { setPorts("error"); return; }
    const cached = liveCache.get(key);
    if (cached) { setPorts(cached); return; }
    let cancelled = false;
    // A refresh of the same gateway keeps the previous values until the new ones arrive.
    if (lastMac.current !== gatewayMac) setPorts(null);
    lastMac.current = gatewayMac;
    void readGatewayPorts(gatewayMac, snapshot ?? "").then((r) => { if (!cancelled) setPorts(r); });
    return () => { cancelled = true; };
  }, [gatewayMac, key, snapshot]);

  return ports;
}
