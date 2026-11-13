"use client";

import { useCallback, useSyncExternalStore } from "react";

// Which detail-panel sections the user has collapsed, by section id ("Ethernet ports").
// Shared by every panel and kept in this browser, so a section collapsed on one Beacon
// stays collapsed on the next one and after a reload.

const STORE = "corteca.detailSections.v1";
const EMPTY: ReadonlySet<string> = new Set();
let collapsed: ReadonlySet<string> | null = null;
const listeners = new Set<() => void>();

function read(): ReadonlySet<string> {
  if (collapsed) return collapsed;
  try {
    const v = JSON.parse(localStorage.getItem(STORE) ?? "[]");
    collapsed = new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  } catch {
    collapsed = new Set();
  }
  return collapsed;
}

function write(id: string, value: boolean) {
  const next = new Set(read());
  if (value) next.add(id); else next.delete(id);
  collapsed = next;
  try { localStorage.setItem(STORE, JSON.stringify([...next])); } catch { /* no storage */ }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/** [collapsed, setCollapsed] for one section id. */
export function useSectionCollapse(id: string): [boolean, (value: boolean) => void] {
  const set = useSyncExternalStore(subscribe, read, () => EMPTY);
  const setCollapsed = useCallback((value: boolean) => write(id, value), [id]);
  return [set.has(id), setCollapsed];
}
