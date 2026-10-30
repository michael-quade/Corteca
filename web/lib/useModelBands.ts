"use client";

import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/web/lib/fetchWithAuth";
import type { ModelBands } from "@/web/lib/radioBands";

// One read per page load (bands per model change rarely). Not needed to draw anything: only APs
// that report no bands (offline) use it, and they fall back to the built-in table meanwhile.
let pending: Promise<Map<string, ModelBands>> | null = null;

function load(): Promise<Map<string, ModelBands>> {
  pending ??= fetchWithAuth("/api/radio-bands")
    .then(async (r) => {
      const body = (await r.json().catch(() => null)) as { models?: ModelBands[] } | null;
      if (!r.ok || !Array.isArray(body?.models)) throw new Error("radio bands unavailable");
      return new Map(body.models.map((m) => [m.model, m]));
    })
    .catch(() => {
      pending = null;
      return new Map<string, ModelBands>();
    });
  return pending;
}

/** Learned radio bands by modelKey() (null while loading). */
export function useModelBands(): Map<string, ModelBands> | null {
  const [models, setModels] = useState<Map<string, ModelBands> | null>(null);
  useEffect(() => {
    let cancelled = false;
    void load().then((m) => { if (!cancelled) setModels(m); });
    return () => { cancelled = true; };
  }, []);
  return models;
}
