"use client";

import { useEffect, useRef, useState } from "react";
import { fetchWithAuth } from "@/web/lib/fetchWithAuth";
import type { GeoRegion } from "@/web/lib/regionFilter";

interface Point { mac: string; lat: number; lng: number }

const DEBOUNCE_MS = 400; // networks arrive in batches while locating

/** Continent / country / state-province per located network (MAC → region), looked up as they arrive. */
export function useNetworkRegions(devices: Point[]): Map<string, GeoRegion> {
  const [regions, setRegions] = useState(new Map<string, GeoRegion>());
  const asked = useRef(new Map<string, string>()); // mac → "lat,lng" already sent

  useEffect(() => {
    const todo = devices.filter((d) => asked.current.get(d.mac) !== `${d.lat},${d.lng}`);
    if (todo.length === 0) return;
    const t = setTimeout(() => {
      for (const d of todo) asked.current.set(d.mac, `${d.lat},${d.lng}`);
      void fetchWithAuth("/api/network-map/regions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ points: todo.map(({ mac, lat, lng }) => ({ mac, lat, lng })) }),
      })
        .then(async (r) => (r.ok ? ((await r.json()) as { regions: Record<string, GeoRegion> }).regions : null))
        .catch(() => null)
        .then((got) => {
          if (!got) { for (const d of todo) asked.current.delete(d.mac); return; }
          setRegions((m) => { const n = new Map(m); for (const [mac, r] of Object.entries(got)) n.set(mac, r); return n; });
        });
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [devices]);

  return regions;
}
