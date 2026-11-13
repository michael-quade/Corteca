"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { PRIORITIES, type Priority } from "@/web/lib/eventPriority";
import { TDS_GROUPS, toTdsItems, type TdsGroup, type TdsItem } from "@/web/lib/tdsEvents";
import { tdsToday, type TdsRange } from "@/web/lib/tdsStats";
import { DRAWER_MIN, type DrawerMode, type EventsUi } from "@/web/components/events/EventsContext";

export const TDS_TITLE = "TDS Network Events RCR";
const DRAWER_DEFAULT = 400;
const STORE = "corteca.tdsEventsDrawer.v1";
export { DRAWER_MIN };

/** The TDS events popout: same activity log as the standard one, its own view state. */
export interface TdsUi {
  base: EventsUi;
  /** `base` with this popout's drawer, for the shared row / tile components. */
  eventsUi: EventsUi;
  items: TdsItem[];
  drawer: DrawerMode;
  setDrawer: (m: DrawerMode) => void;
  width: number;
  setWidth: (w: number) => void;
  range: TdsRange;
  setRange: (r: TdsRange) => void;
  priorities: Set<Priority>;
  togglePriority: (p: Priority) => void;
  groups: Set<TdsGroup>;
  toggleGroup: (g: TdsGroup) => void;
  device: string | null;
  setDevice: (mac: string | null) => void;
  routine: boolean;
  setRoutine: (on: boolean) => void;
  today: number;
}

export const TdsEventsContext = createContext<TdsUi | null>(null);
export const useTdsEvents = () => useContext(TdsEventsContext);

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

function toggled<T>(set: Set<T>, v: T): Set<T> {
  const next = new Set(set);
  if (next.has(v)) next.delete(v); else next.add(v);
  return next;
}

/** Owned by a network's workspace, next to the standard events controller it reads from. */
export function useTdsEventsController(base: EventsUi): TdsUi {
  const [drawer, setDrawerState] = useState<DrawerMode>(() => (stored().open && base.drawer === "closed" ? "open" : "closed"));
  const [width, setWidthState] = useState(() => stored().width);
  const [range, setRange] = useState<TdsRange>({ kind: "preset", days: 30 });
  const [priorities, setPriorities] = useState<Set<Priority>>(() => new Set(PRIORITIES));
  const [groups, setGroups] = useState(() => new Set(TDS_GROUPS.filter((g) => g.on).map((g) => g.id)));
  const [device, setDevice] = useState<string | null>(null);
  const [routine, setRoutine] = useState(false);

  const items = useMemo(() => toTdsItems(base.items, base.names), [base.items, base.names]);

  // One events popout at a time: opening this one closes the standard one, and vice versa.
  const { drawer: baseDrawer, setDrawer: setBaseDrawer } = base;
  const setDrawer = useCallback((m: DrawerMode) => {
    setDrawerState(m);
    if (m !== "closed" && baseDrawer !== "closed") setBaseDrawer("closed");
    if (m !== "expanded") store({ ...stored(), open: m === "open" });
  }, [baseDrawer, setBaseDrawer]);
  const prevBase = useRef(baseDrawer);
  useEffect(() => {
    if (prevBase.current === "closed" && baseDrawer !== "closed") {
      setDrawerState("closed");
      store({ ...stored(), open: false });
    }
    prevBase.current = baseDrawer;
  }, [baseDrawer]);

  const setWidth = useCallback((w: number) => {
    setWidthState(w);
    store({ ...stored(), width: w });
  }, []);
  const togglePriority = useCallback((p: Priority) => setPriorities((s) => toggled(s, p)), []);
  const toggleGroup = useCallback((g: TdsGroup) => setGroups((s) => toggled(s, g)), []);

  const eventsUi = useMemo<EventsUi>(() => ({ ...base, drawer, setDrawer }), [base, drawer, setDrawer]);
  const today = useMemo(() => tdsToday(items, base.now), [items, base.now]);

  return useMemo(() => ({
    base, eventsUi, items, drawer, setDrawer, width, setWidth, range, setRange,
    priorities, togglePriority, groups, toggleGroup, device, setDevice, routine, setRoutine, today,
  }), [base, eventsUi, items, drawer, setDrawer, width, setWidth, range, priorities, togglePriority, groups,
    toggleGroup, device, routine, today]);
}
