"use client";

import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/web/lib/fetchWithAuth";
import { distanceMeters, type LatLng } from "@/web/lib/networkLocation";

/** null = none, "error" = couldn't read it, undefined = still loading. */
export type Stored = LatLng | null | "error";
export interface Detected extends LatLng { accuracy: number | null }

// Corteca's stored position: per gateway and network snapshot, so the top bar's Refresh re-reads it.
const storedCache = new Map<string, Promise<Stored>>();
// Corteca's Autodetect lookup (a Google geolocation request on Nokia's side): once per gateway
// for the page's lifetime unless ↻ asks again.
const detectCache = new Map<string, Promise<Detected | null | "error">>();

function cached<T>(cache: Map<string, Promise<T | "error">>, key: string, prefix: string, fresh: boolean, load: () => Promise<T | "error">) {
  let p = fresh ? undefined : cache.get(key);
  if (!p) {
    p = load().catch(() => "error" as const);
    const mine = p;
    void mine.then((v) => { if (v === "error" && cache.get(key) === mine) cache.delete(key); });
    for (const k of cache.keys()) if (k.startsWith(prefix)) cache.delete(k);
    cache.set(key, p);
  }
  return p;
}

const readStored = (mac: string, snapshot: string | null, fresh: boolean) =>
  cached(storedCache, `${mac}|${snapshot ?? ""}`, `${mac}|`, fresh, async () => {
    const r = await fetchWithAuth(`/api/network/${encodeURIComponent(mac)}/location`);
    return r.ok ? ((await r.json()) as { location: LatLng | null }).location : "error";
  });

const readDetected = (mac: string, fresh: boolean) =>
  cached(detectCache, mac, `${mac}\u0000`, fresh, async () => {
    const r = await fetchWithAuth(`/api/network/${encodeURIComponent(mac)}/location/detect`);
    return r.ok ? ((await r.json()) as { detected: Detected | null }).detected : "error";
  });

/** How far apart the two positions may be before they count as different. */
export function locationTolerance(d: Detected): number {
  return Math.max(50, d.accuracy ?? 0);
}

/** Detected position vs. Corteca's stored one: null while either is unknown. */
export function compareLocations(stored: Stored | undefined, detected: Detected | null | "error" | undefined) {
  if (!detected || detected === "error" || stored === undefined || stored === "error") return null;
  if (stored === null) return { differs: true, distance: null as number | null };
  const distance = distanceMeters(stored, detected);
  return { differs: distance > locationTolerance(detected), distance };
}

/**
 * The gateway's location as Corteca stores it and as Corteca's Autodetect finds it now — both
 * read-only. `reload()` re-reads both (↻).
 */
export function useGatewayLocation(mac: string, snapshot: string | null) {
  const [stored, setStored] = useState<Stored | undefined>(undefined);
  const [detected, setDetected] = useState<Detected | null | "error" | undefined>(undefined);
  const [reloads, setReloads] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fresh = reloads > 0;
    // A manual refresh keeps what is shown until the new answers arrive.
    if (!fresh) { setStored(undefined); setDetected(undefined); }
    setBusy(true);
    const s = readStored(mac, snapshot, fresh).then((v) => { if (!cancelled) setStored(v); });
    const d = readDetected(mac, fresh).then((v) => { if (!cancelled) setDetected(v); });
    void Promise.all([s, d]).then(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [mac, snapshot, reloads]);
  // Another gateway or snapshot starts without a forced re-read.
  useEffect(() => { setReloads(0); }, [mac, snapshot]);

  return { stored, detected, busy, reload: () => setReloads((n) => n + 1) };
}
