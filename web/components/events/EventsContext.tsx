"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { EVENT_CATEGORIES, type EventCategory } from "@/web/lib/networkEvents";
import { buildEventItems, type EventItem } from "@/web/lib/eventItems";
import { eventsToday, type EventPeriod } from "@/web/lib/eventStats";
import { useEventAcks, type EventAcksApi } from "@/web/lib/eventAcks";
import { useEventNames, useNetworkEvents, type EventDeviceNames, type EventsLoad, type OfflineNameSources } from "@/web/lib/useNetworkEvents";
import type { McpNetwork } from "@/web/lib/mcpNetwork";

export type DrawerMode = "closed" | "open" | "expanded";
export const DRAWER_MIN = 320;
const DRAWER_DEFAULT = 380;
const STORE = "corteca.eventsDrawer.v1";

/** Everything the events drawer, AP / client panels and diagram badges read. */
export interface EventsUi {
  networkId: string;
  load: EventsLoad["status"];
  error: string | null;
  truncated: boolean;
  retry: () => void;
  /** All rows, newest first. */
  items: EventItem[];
  now: number;
  names: EventDeviceNames;
  drawer: DrawerMode;
  setDrawer: (m: DrawerMode) => void;
  width: number;
  setWidth: (w: number) => void;
  period: EventPeriod;
  setPeriod: (p: EventPeriod) => void;
  categories: Set<EventCategory>;
  toggleCategory: (c: EventCategory) => void;
  device: string | null;
  setDevice: (mac: string | null) => void;
  routine: boolean;
  setRoutine: (on: boolean) => void;
  acks: EventAcksApi;
  /** AP whose panel should scroll to its Events section (set by the diagram badge). */
  focusAp: string | null;
  setFocusAp: (mac: string | null) => void;
  /** Open the drawer filtered to one device. */
  showDevice: (mac: string) => void;
  today: number;
}

export const EventsContext = createContext<EventsUi | null>(null);
export const useEvents = () => useContext(EventsContext);

function stored(): { open: boolean; width: number } {
  try {
    const v = JSON.parse(localStorage.getItem(STORE) ?? "null");
    if (v && typeof v === "object") return { open: !!v.open, width: Number(v.width) || DRAWER_DEFAULT };
  } catch { /* no storage */ }
  return { open: false, width: DRAWER_DEFAULT };
}

function store(v: { open: boolean; width: number }) {
  try { localStorage.setItem(STORE, JSON.stringify(v)); } catch { /* no storage */ }
}

/** Owned by a network's workspace: loads its activity log and holds the drawer / filter state. */
export function useEventsController(networkId: string, homeWifiId: string | null, network: McpNetwork | null, offline?: OfflineNameSources): EventsUi {
  const { state, retry } = useNetworkEvents(homeWifiId, network?.capturedAt ?? null);
  const names = useEventNames(network, offline);
  const acks = useEventAcks();
  const [drawer, setDrawerState] = useState<DrawerMode>(() => (stored().open ? "open" : "closed"));
  const [width, setWidthState] = useState(() => stored().width);
  const [period, setPeriod] = useState<EventPeriod>(30);
  const [categories, setCategories] = useState(() => new Set(EVENT_CATEGORIES.filter((c) => c.on).map((c) => c.id)));
  const [device, setDevice] = useState<string | null>(null);
  const [routine, setRoutine] = useState(false);
  const [focusAp, setFocusAp] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Keep "3 h ago" and the period windows current.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { if (state.status === "ready") setNow(Date.now()); }, [state]);

  const items = useMemo(
    () => (state.status === "ready" ? buildEventItems(state.events, names) : []),
    [state, names]
  );

  const setDrawer = useCallback((m: DrawerMode) => {
    setDrawerState(m);
    if (m !== "expanded") store({ ...stored(), open: m === "open" });
  }, []);
  const setWidth = useCallback((w: number) => {
    setWidthState(w);
    store({ ...stored(), width: w });
  }, []);
  const toggleCategory = useCallback((c: EventCategory) => {
    setCategories((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c); else next.add(c);
      return next;
    });
  }, []);
  const showDevice = useCallback((mac: string) => {
    setDevice(mac);
    setDrawer("open");
  }, [setDrawer]);

  const today = useMemo(() => eventsToday(items, now), [items, now]);

  return useMemo(() => ({
    networkId,
    load: state.status,
    error: state.status === "error" ? state.error : null,
    truncated: state.status === "ready" && state.truncated,
    retry, items, now, names,
    drawer, setDrawer, width, setWidth,
    period, setPeriod, categories, toggleCategory, device, setDevice, routine, setRoutine,
    acks, focusAp, setFocusAp, showDevice, today,
  }), [networkId, state, retry, items, now, names, drawer, setDrawer, width, setWidth, period, categories,
    toggleCategory, device, routine, acks, focusAp, showDevice, today]);
}
