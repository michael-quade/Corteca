"use client";

import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/web/lib/fetchWithAuth";
import type { PortLayout } from "@/web/lib/portLayouts";

// One read per page load, shared by every panel (layouts change rarely).
let pending: Promise<Map<string, PortLayout>> | null = null;

function load(): Promise<Map<string, PortLayout>> {
  pending ??= fetchWithAuth("/api/port-layouts")
    .then(async (r) => {
      const body = (await r.json().catch(() => null)) as { layouts?: PortLayout[] } | null;
      if (!r.ok || !Array.isArray(body?.layouts)) throw new Error("port layouts unavailable");
      return new Map(body.layouts.map((l) => [l.model, l]));
    })
    .catch(() => {
      pending = null; // try again next time
      return new Map<string, PortLayout>();
    });
  return pending;
}

/** Stored port layouts by modelKey() (null while loading; empty if unavailable). */
export function usePortLayouts(): Map<string, PortLayout> | null {
  const [layouts, setLayouts] = useState<Map<string, PortLayout> | null>(null);
  useEffect(() => {
    let cancelled = false;
    void load().then((l) => { if (!cancelled) setLayouts(l); });
    return () => { cancelled = true; };
  }, []);
  return layouts;
}
