"use client";

import { useCallback, useSyncExternalStore } from "react";

// Minimized page sections (e.g. the MCP visualizer's AI analysis / Access Points / Clients under the
// diagram), remembered in this browser. One store for the whole page, so every open network tab
// shows the same sections minimized.

const KEY = "corteca.foldedSections.v1";
let folded: Record<string, boolean> | null = null;
const listeners = new Set<() => void>();

function load(): Record<string, boolean> {
  if (folded) return folded;
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "{}") as unknown;
    folded = v && typeof v === "object" ? (v as Record<string, boolean>) : {};
  } catch {
    folded = {};
  }
  return folded;
}

export function setSectionFolded(id: string, value: boolean) {
  folded = { ...load(), [id]: value };
  try { localStorage.setItem(KEY, JSON.stringify(folded)); } catch { /* not remembered */ }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** [minimized, set] for one section id. */
export function useFoldedSection(id: string): [boolean, (value: boolean) => void] {
  const value = useSyncExternalStore(subscribe, () => !!load()[id], () => false);
  const set = useCallback((v: boolean) => setSectionFolded(id, v), [id]);
  return [value, set];
}
