"use client";

import { useEffect, useRef, useState } from "react";
import { fetchWithAuth } from "@/web/lib/fetchWithAuth";
import type { EthernetPort } from "@/web/components/EthernetPortPanel";

// Live port status per gateway MAC and network snapshot (so Refresh re-reads it).
const liveCache = new Map<string, EthernetPort[] | "error">();

/** Live TR-181 Ethernet ports of the gateway (null while loading, "error" if unavailable). */
export function useGatewayPorts(gatewayMac: string | undefined, snapshot: string | null): EthernetPort[] | "error" | null {
  const key = gatewayMac ? `${gatewayMac}|${snapshot ?? ""}` : "";
  const [ports, setPorts] = useState<EthernetPort[] | "error" | null>(gatewayMac ? liveCache.get(key) ?? null : "error");

  const lastMac = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!gatewayMac) { setPorts("error"); return; }
    if (liveCache.has(key)) { setPorts(liveCache.get(key)!); return; }
    let cancelled = false;
    // A refresh of the same gateway keeps the previous values until the new ones arrive.
    if (lastMac.current !== gatewayMac) setPorts(null);
    lastMac.current = gatewayMac;
    fetchWithAuth(`/api/network/${encodeURIComponent(gatewayMac)}/ethernet`)
      .then(async (r) => {
        const body = (await r.json().catch(() => null)) as { ports?: EthernetPort[] } | null;
        const result = r.ok && body?.ports?.length ? body.ports : "error";
        liveCache.set(key, result);
        if (!cancelled) setPorts(result);
      })
      .catch(() => { if (!cancelled) setPorts("error"); });
    return () => { cancelled = true; };
  }, [gatewayMac, key]);

  return ports;
}
