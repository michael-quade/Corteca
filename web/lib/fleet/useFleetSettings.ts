"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_NOISY_FACTOR, NOISY_STORAGE_KEY, isFleetRange, isFleetTab,
  type FleetRange, type FleetTabId,
} from "./fleetTabs";
import { parseNoisyFactor } from "./noisy";

export interface FleetSettings {
  tab: FleetTabId;
  range: FleetRange;
  /** Noisy-device factor (0 = off). */
  noisy: number;
  /** Hide WiFi points offline for more than a year (Inventory). */
  hideStale: boolean;
}

const DEFAULTS: FleetSettings = { tab: "overview", range: "7d", noisy: DEFAULT_NOISY_FACTOR, hideStale: false };

function readStoredNoisy(): number | null {
  try { return parseNoisyFactor(localStorage.getItem(NOISY_STORAGE_KEY)); } catch { return null; }
}

/**
 * Tab, range, noisy-device factor and the stale switch, mirrored into the query string
 * (`?tab=stability&range=30d&noisy=10&stale=hide`) so a link opens the same view. The factor is
 * also remembered in this browser; a link's own value wins.
 */
export function useFleetSettings(): [FleetSettings, (patch: Partial<FleetSettings>) => void, boolean] {
  const [settings, setSettings] = useState<FleetSettings>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const tab = q.get("tab");
    const range = q.get("range");
    setSettings({
      tab: isFleetTab(tab) ? tab : DEFAULTS.tab,
      range: isFleetRange(range) ? range : DEFAULTS.range,
      noisy: parseNoisyFactor(q.get("noisy")) ?? readStoredNoisy() ?? DEFAULT_NOISY_FACTOR,
      hideStale: q.get("stale") === "hide",
    });
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const q = new URLSearchParams(window.location.search);
    q.set("tab", settings.tab);
    q.set("range", settings.range);
    if (settings.noisy === DEFAULT_NOISY_FACTOR) q.delete("noisy"); else q.set("noisy", String(settings.noisy));
    if (settings.hideStale) q.set("stale", "hide"); else q.delete("stale");
    window.history.replaceState(window.history.state, "", `${window.location.pathname}?${q}`);
  }, [settings, ready]);

  const update = useCallback((patch: Partial<FleetSettings>) => {
    setSettings((s) => ({ ...s, ...patch }));
    if (patch.noisy !== undefined) {
      try { localStorage.setItem(NOISY_STORAGE_KEY, String(patch.noisy)); } catch { /* storage blocked */ }
    }
  }, []);

  return [settings, update, ready];
}
