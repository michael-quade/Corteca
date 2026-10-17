"use client";

import { useEffect, useRef, useState } from "react";
import { fetchWithAuth } from "@/web/lib/fetchWithAuth";
import type { BackhaulStandards } from "@/app/api/network/[deviceId]/backhaul-standard/route";

// Per gateway MAC and network snapshot (so Refresh re-reads it); null = unavailable.
const cache = new Map<string, BackhaulStandards | null>();

const GENERATIONS = new Set(["WiFi 4", "WiFi 5", "WiFi 6", "WiFi 7"]);

/** Drops anything that isn't a well-formed entry, so odd responses leave the band-only view. */
function sanitise(raw: unknown): BackhaulStandards | null {
  if (!raw || typeof raw !== "object") return null;
  const out: BackhaulStandards = {};
  for (const [mac, v] of Object.entries(raw as Record<string, unknown>)) {
    const e = v as { generation?: unknown; ieee?: unknown; mlo?: unknown } | null;
    if (e && GENERATIONS.has(String(e.generation)) && /^802\.11[a-z]{1,2}$/.test(String(e.ieee))) {
      out[mac.toLowerCase()] = { generation: String(e.generation), ieee: String(e.ieee), mlo: e.mlo === true };
    }
  }
  return out;
}

/** WiFi standard of each wireless backhaul, keyed by the child's backhaul station MAC (null while loading or unavailable). */
export function useBackhaulStandards(gatewayMac: string | undefined, snapshot: string | null): BackhaulStandards | null {
  const key = gatewayMac ? `${gatewayMac}|${snapshot ?? ""}` : "";
  const [standards, setStandards] = useState<BackhaulStandards | null>(gatewayMac ? cache.get(key) ?? null : null);

  const lastMac = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!gatewayMac) { setStandards(null); return; }
    if (cache.has(key)) { setStandards(cache.get(key)!); return; }
    let cancelled = false;
    // A refresh of the same gateway keeps the previous values until the new ones arrive.
    if (lastMac.current !== gatewayMac) setStandards(null);
    lastMac.current = gatewayMac;
    fetchWithAuth(`/api/network/${encodeURIComponent(gatewayMac)}/backhaul-standard`)
      .then(async (r) => {
        const body = (await r.json().catch(() => null)) as { standards?: unknown } | null;
        const result = r.ok ? sanitise(body?.standards) : null;
        cache.set(key, result);
        if (!cancelled) setStandards(result);
      })
      .catch(() => { if (!cancelled) setStandards(null); });
    return () => { cancelled = true; };
  }, [gatewayMac, key]);

  return standards;
}
