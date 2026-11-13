"use client";

// Acknowledged / silenced diagram badges, per AP. Kept in this browser only (each
// operator decides for themselves); shared by every open network tab.

import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { EventAck } from "./eventStats";

const KEY = "corteca.eventAcks.v1";
type Acks = Record<string, EventAck>;

const listeners = new Set<() => void>();
let cache: Acks | null = null;

function read(): Acks {
  if (cache) return cache;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    cache = raw && typeof raw === "object" ? (raw as Acks) : {};
  } catch {
    cache = {};
  }
  return cache;
}

function write(next: Acks) {
  cache = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private window / blocked: keep in memory */ }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) { cache = null; l(); } };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(l); window.removeEventListener("storage", onStorage); };
}

const EMPTY: Acks = {};

export interface EventAcksApi {
  acks: Acks;
  acknowledge: (mac: string) => void;
  /** `until` ms, or -1 for "until I turn it back on". */
  silence: (mac: string, until: number) => void;
  unsilence: (mac: string) => void;
}

export function useEventAcks(): EventAcksApi {
  const acks = useSyncExternalStore(subscribe, read, () => EMPTY);
  const update = useCallback((mac: string, change: (a: EventAck) => EventAck) => {
    const all = read();
    write({ ...all, [mac]: change(all[mac] ?? {}) });
  }, []);
  return useMemo(() => ({
    acks,
    acknowledge: (mac: string) => update(mac, (a) => ({ ...a, ackAt: Date.now() })),
    silence: (mac: string, until: number) => update(mac, (a) => ({ ...a, silencedUntil: until })),
    unsilence: (mac: string) => update(mac, (a) => ({ ...a, silencedUntil: undefined })),
  }), [acks, update]);
}
