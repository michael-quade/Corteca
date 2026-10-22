"use client";

import { useCallback, useRef, useState } from "react";
import { fetchWithAuth } from "@/web/lib/fetchWithAuth";
import type { Subscriber } from "@/web/lib/corteca/types";
import type { SearchField } from "@/web/lib/subscriberSearch";

export interface SubscriberSearchState {
  results: Subscriber[] | null;
  /** Fields actually searched (what Auto detect chose). */
  fields: SearchField[];
  /** Corteca may have more matches than returned. */
  truncated: boolean;
  loading: boolean;
  error: string | null;
}

const IDLE: SubscriberSearchState = { results: null, fields: [], truncated: false, loading: false, error: null };

/** Runs `/api/subscribers` searches; a newer search wins over a slower older one. */
export function useSubscriberSearch() {
  const [state, setState] = useState<SubscriberSearchState>(IDLE);
  const seq = useRef(0);

  const search = useCallback(async (query: string, field: SearchField): Promise<Subscriber[] | null> => {
    const q = query.trim();
    const id = ++seq.current;
    if (!q) { setState(IDLE); return null; }
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetchWithAuth(`/api/subscribers?q=${encodeURIComponent(q)}&field=${field}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Search failed.");
      if (id !== seq.current) return null;
      const results: Subscriber[] = data.results ?? [];
      setState({ results, fields: data.fields ?? [], truncated: !!data.truncated, loading: false, error: null });
      return results;
    } catch (err) {
      if (id === seq.current) {
        setState({ results: null, fields: [], truncated: false, loading: false, error: err instanceof Error ? err.message : "Search failed." });
      }
      return null;
    }
  }, []);

  const reset = useCallback(() => { seq.current++; setState(IDLE); }, []);

  return { ...state, search, reset };
}
