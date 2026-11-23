"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_VISIBLE, PICKABLE_COLUMNS, type ColumnKey } from "@/web/components/tables/memberColumns";

const STORAGE_KEY = "corteca.clientColumns.v1";
const KNOWN = new Set<ColumnKey>(PICKABLE_COLUMNS.map((c) => c.key));

/** The client table's chosen columns, remembered in this browser (shared by every client table). */
export function useClientColumns() {
  const [visible, setVisible] = useState<ColumnKey[]>(DEFAULT_VISIBLE);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as unknown;
      if (Array.isArray(saved)) setVisible(saved.filter((k): k is ColumnKey => KNOWN.has(k as ColumnKey)));
    } catch { /* private mode / bad value: defaults */ }
  }, []);

  const save = useCallback((next: ColumnKey[]) => {
    setVisible(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* not remembered */ }
  }, []);

  const toggle = useCallback((key: ColumnKey) => {
    save(visible.includes(key) ? visible.filter((k) => k !== key) : [...visible, key]);
  }, [visible, save]);

  const reset = useCallback(() => save(DEFAULT_VISIBLE), [save]);

  return { visible, toggle, reset };
}
