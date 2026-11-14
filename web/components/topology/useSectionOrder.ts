"use client";

import { useCallback, useSyncExternalStore } from "react";

// The user's own section order per detail-panel kind ("ap", "client", "link", "switch", "wan"),
// set by dragging the section chips. Kept in this browser. Gateway and Beacon panels share "ap":
// sections one of them doesn't have (Location, Backhaul history) keep their place in the list.

const STORE = "corteca.sectionOrder.v1";
type Orders = Readonly<Record<string, readonly string[]>>;
const EMPTY: Orders = {};
let orders: Orders | null = null;
const listeners = new Set<() => void>();

function read(): Orders {
  if (orders) return orders;
  try {
    const v = JSON.parse(localStorage.getItem(STORE) ?? "{}") as unknown;
    const out: Record<string, string[]> = {};
    if (v && typeof v === "object") {
      for (const [k, list] of Object.entries(v)) {
        if (Array.isArray(list)) out[k] = list.filter((x): x is string => typeof x === "string");
      }
    }
    orders = out;
  } catch {
    orders = {};
  }
  return orders;
}

function write(kind: string, list: string[] | null) {
  const next: Record<string, readonly string[]> = { ...read() };
  if (list) next[kind] = list; else delete next[kind];
  orders = next;
  try { localStorage.setItem(STORE, JSON.stringify(next)); } catch { /* no storage */ }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/**
 * The panel's sections (`present`, in their built-in order) in the saved order. A section the
 * saved order doesn't know goes right after the section it follows in the built-in order (or
 * first), so new or panel-specific sections land where they normally would.
 */
export function arrangeSections(present: string[], saved: readonly string[] | undefined): string[] {
  if (!saved?.length) return present;
  const out = saved.filter((id) => present.includes(id));
  present.forEach((id, i) => {
    if (out.includes(id)) return;
    const before = present.slice(0, i).reverse().find((p) => out.includes(p));
    out.splice(before ? out.indexOf(before) + 1 : 0, 0, id);
  });
  return out;
}

/**
 * The order to save after the user moved sections: `shown` as now, plus saved sections this panel
 * doesn't have, each kept right after the section it followed before.
 */
function withAbsent(shown: string[], saved: readonly string[] | undefined): string[] {
  const out = [...shown];
  (saved ?? []).forEach((id, i) => {
    if (out.includes(id)) return;
    const before = saved!.slice(0, i).reverse().find((p) => out.includes(p));
    out.splice(before ? out.indexOf(before) + 1 : 0, 0, id);
  });
  return out;
}

/** [saved order or undefined, save(shown order), reset()] for one panel kind. */
export function useSectionOrder(kind: string): [readonly string[] | undefined, (shown: string[]) => void, () => void] {
  const all = useSyncExternalStore(subscribe, read, () => EMPTY);
  const saved = all[kind];
  const save = useCallback((shown: string[]) => write(kind, withAbsent(shown, read()[kind])), [kind]);
  const reset = useCallback(() => write(kind, null), [kind]);
  return [saved, save, reset];
}
