"use client";

import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/web/lib/fetchWithAuth";
import type { EthernetPort } from "@/web/components/EthernetPortPanel";

// Live port status per gateway MAC, kept while the page is open.
const liveCache = new Map<string, EthernetPort[] | "error">();

/** Live TR-181 Ethernet ports of the gateway (null while loading, "error" if unavailable). */
export function useGatewayPorts(gatewayMac: string | undefined): EthernetPort[] | "error" | null {
  const [ports, setPorts] = useState<EthernetPort[] | "error" | null>(gatewayMac ? liveCache.get(gatewayMac) ?? null : "error");

  useEffect(() => {
    if (!gatewayMac) { setPorts("error"); return; }
    if (liveCache.has(gatewayMac)) { setPorts(liveCache.get(gatewayMac)!); return; }
    let cancelled = false;
    setPorts(null);
    fetchWithAuth(`/api/network/${encodeURIComponent(gatewayMac)}/ethernet`)
      .then(async (r) => {
        const body = (await r.json().catch(() => null)) as { ports?: EthernetPort[] } | null;
        const result = r.ok && body?.ports?.length ? body.ports : "error";
        liveCache.set(gatewayMac, result);
        if (!cancelled) setPorts(result);
      })
      .catch(() => { if (!cancelled) setPorts("error"); });
    return () => { cancelled = true; };
  }, [gatewayMac]);

  return ports;
}
