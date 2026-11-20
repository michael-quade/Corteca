"use client";

import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/web/lib/fetchWithAuth";
import { useFleetVersion } from "./useFleetData";

/** An answer from a filling route (`/api/fleet/alarms`, `/events`, `/report-trend`). */
export interface Filling { pending: number; total: number; errors: string[] }

export interface FillState<T> { data: T | null; error: string | null; loading: boolean; progress: { done: number; total: number } | null }

const finished = new Map<string, unknown>();

/**
 * Reads a route that fills hourly / daily rollups: asks again while it reports `pending`
 * buckets (showing each partial answer), stops when none are left or a round makes no
 * progress. Finished answers are kept for the page's lifetime (cleared by Refresh).
 */
export function useFleetFill<T extends Filling>(url: string | null): FillState<T> {
  const version = useFleetVersion();
  const [state, setState] = useState<FillState<T>>({ data: null, error: null, loading: !!url, progress: null });

  useEffect(() => {
    if (version > 0) finished.clear();
  }, [version]);

  useEffect(() => {
    if (!url) { setState({ data: null, error: null, loading: false, progress: null }); return; }
    const done = finished.get(url) as T | undefined;
    if (done) { setState({ data: done, error: null, loading: false, progress: null }); return; }
    let alive = true;
    setState((s) => ({ data: s.data, error: null, loading: true, progress: null }));
    (async () => {
      let last = Infinity;
      for (let round = 0; round < 60 && alive; round++) {
        const res = await fetchWithAuth(url);
        const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
        if (!alive) return;
        if (!res.ok || !body) { setState((s) => ({ ...s, error: body?.error ?? `Request failed (${res.status})`, loading: false })); return; }
        const more = body.pending > 0 && body.pending < last;
        setState({ data: body, error: null, loading: more, progress: more ? { done: body.total - body.pending, total: body.total } : null });
        if (!more) { if (!body.pending) finished.set(url, body); return; }
        last = body.pending;
      }
    })().catch((e: unknown) => alive && setState((s) => ({ ...s, error: e instanceof Error ? e.message : String(e), loading: false })));
    return () => { alive = false; };
  }, [url, version]);

  return state;
}
