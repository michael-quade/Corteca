"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchWithAuth } from "@/web/lib/fetchWithAuth";
import { isMeshCount, MESH_BATCH, MESH_PARALLEL, type MeshCount } from "@/web/lib/meshCounts";

const KEY = "corteca.meshCounts.v1";

interface Stored { reportAt: number; readAt: number; counts: Record<string, MeshCount | null> }

function load(reportAt: number): Stored | null {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? "null") as Stored | null;
    return s && s.reportAt === reportAt && s.counts ? s : null;
  } catch { return null; }
}

function save(s: Stored) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* quota / private mode */ }
}

export interface MeshCountsState {
  /** Home WiFi ID → live count; null = Corteca has no mesh for it. Missing = not read (yet / failed). */
  counts: Map<string, MeshCount | null>;
  failed: Set<string>;
  loading: boolean;
  done: number;
  total: number;
  readAt: number | null;
  reread: () => void;
}

/**
 * Live mesh counts for `ids` (homes the report lists as online), read in batches once per
 * deployment report (cached in this browser; `reread()` reads them again).
 */
export function useMeshCounts(ids: string[], reportAt: number | null, enabled: boolean): MeshCountsState {
  const [counts, setCounts] = useState<Map<string, MeshCount | null>>(new Map());
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(0);
  const [readAt, setReadAt] = useState<number | null>(null);
  const [force, setForce] = useState(0);
  const run = useRef(0);
  const usedForce = useRef(0);
  const idsKey = ids.join(",");

  useEffect(() => {
    if (!enabled || reportAt == null || !idsKey) return;
    const want = idsKey.split(",");
    const stored = force !== usedForce.current ? null : load(reportAt);
    usedForce.current = force;
    const have = new Map<string, MeshCount | null>(
      stored ? Object.entries(stored.counts).filter(([, v]) => v === null || isMeshCount(v)) : [],
    );
    const todo = want.filter((id) => !have.has(id));
    setCounts(new Map(have)); setFailed(new Set()); setReadAt(stored?.readAt ?? null);
    setDone(want.length - todo.length);
    if (!todo.length) { setLoading(false); return; }

    const me = ++run.current;
    setLoading(true);
    const lost = new Set<string>();
    const batches: string[][] = [];
    for (let i = 0; i < todo.length; i += MESH_BATCH) batches.push(todo.slice(i, i + MESH_BATCH));

    const one = async (batch: string[]) => {
      try {
        const r = await fetchWithAuth("/api/network-map/mesh-counts", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: batch }),
        });
        const j = r.ok ? await r.json() as { meshes?: Record<string, unknown> } : null;
        for (const id of batch) {
          const v = j?.meshes?.[id];
          if (v === null || isMeshCount(v)) have.set(id, v); else lost.add(id);
        }
      } catch { batch.forEach((id) => lost.add(id)); }
      if (run.current !== me) return;
      setCounts(new Map(have)); setFailed(new Set(lost));
      setDone((n) => n + batch.length);
    };

    (async () => {
      for (let i = 0; i < batches.length; i += MESH_PARALLEL) {
        await Promise.all(batches.slice(i, i + MESH_PARALLEL).map(one));
        if (run.current !== me) return;
      }
      const at = Date.now();
      setReadAt(at); setLoading(false);
      save({ reportAt, readAt: at, counts: Object.fromEntries(have) });
    })();
    return () => { run.current++; };
  }, [enabled, reportAt, idsKey, force]);

  const reread = useCallback(() => setForce((n) => n + 1), []);
  return { counts, failed, loading, done, total: ids.length, readAt, reread };
}
