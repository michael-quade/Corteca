"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { fetchWithAuth } from "@/web/lib/fetchWithAuth";

/**
 * Fleet Metrics data: one shared answer per URL for the page's lifetime, so tabs that need the
 * same read (Overview and Stability both use the reboot ranking) ask once, and switching back
 * to a tab is instant. Refresh drops everything and the tab on screen reads again
 * (`refresh=1` also skips the routes' server cache).
 */
interface Entry { promise: Promise<unknown>; data?: unknown; error?: string }

interface FleetDataApi {
  version: number;
  get: (url: string) => Entry;
  refresh: () => void;
}

const Ctx = createContext<FleetDataApi | null>(null);

async function load(url: string): Promise<unknown> {
  const res = await fetchWithAuth(url);
  const body = await res.json().catch(() => null) as { error?: string } | null;
  if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
  return body;
}

export function FleetDataProvider({ children }: { children: ReactNode }) {
  const store = useRef(new Map<string, Entry>());
  const forced = useRef(false);
  const [version, setVersion] = useState(0);

  const get = useCallback((url: string): Entry => {
    const hit = store.current.get(url);
    if (hit) return hit;
    const full = forced.current ? `${url}${url.includes("?") ? "&" : "?"}refresh=1` : url;
    const entry: Entry = { promise: Promise.resolve() };
    entry.promise = load(full).then(
      (d) => { entry.data = d; },
      (e: unknown) => { entry.error = e instanceof Error ? e.message : String(e); },
    );
    store.current.set(url, entry);
    return entry;
  }, []);

  const refresh = useCallback(() => {
    store.current.clear();
    forced.current = true;
    setVersion((v) => v + 1);
  }, []);

  return <Ctx.Provider value={{ version, get, refresh }}>{children}</Ctx.Provider>;
}

export function useFleetRefresh(): () => void {
  const api = useContext(Ctx);
  if (!api) throw new Error("useFleetRefresh outside FleetDataProvider");
  return api.refresh;
}

/** Bumped by Refresh; hooks with their own caches clear them when it changes. */
export function useFleetVersion(): number {
  const api = useContext(Ctx);
  if (!api) throw new Error("useFleetVersion outside FleetDataProvider");
  return api.version;
}

export interface FleetResource<T> { data: T | null; error: string | null; loading: boolean }

/** Reads `url` (or nothing when null) through the shared store. */
export function useFleetResource<T>(url: string | null): FleetResource<T> {
  const api = useContext(Ctx);
  if (!api) throw new Error("useFleetResource outside FleetDataProvider");
  const { get, version } = api;
  const [state, setState] = useState<FleetResource<T>>({ data: null, error: null, loading: !!url });

  useEffect(() => {
    if (!url) { setState({ data: null, error: null, loading: false }); return; }
    let alive = true;
    const entry = get(url);
    if (entry.data !== undefined || entry.error) {
      setState({ data: (entry.data as T) ?? null, error: entry.error ?? null, loading: false });
      return;
    }
    setState((s) => ({ data: s.data, error: null, loading: true }));
    entry.promise.then(() => {
      if (alive) setState({ data: (entry.data as T) ?? null, error: entry.error ?? null, loading: false });
    });
    return () => { alive = false; };
  }, [url, get, version]);

  return state;
}
