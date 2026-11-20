"use client";

import { rangeDays, type FleetTabId } from "./fleetTabs";
import type { AlarmsResponse } from "./alarms";
import type { AutomationResponse } from "./automation";
import type { EventsResponse } from "./clusterEvents";
import type { InventoryResponse } from "./inventory";
import type { OnboardingResponse } from "./onboarding";
import type { RankingResponse, RankingType } from "./rankings";
import type { ReportTrendResponse } from "./reportTrend";
import type { SteeringResponse } from "./steering";
import { useFleetResource } from "./useFleetData";
import { useFleetFill } from "./useFleetFill";
import type { FleetSettings } from "./useFleetSettings";

type Need = "inventory" | RankingType | "steering" | "automation" | "onboarding" | "alarms" | "alarms24h" | "events"
  | "trendStability" | "trendRf" | "trendOnboarding";

/** What each tab reads. Overview reads the cheap summaries its tiles show (alarms: last 24 h only). */
const NEEDS: Record<FleetTabId, Need[]> = {
  overview: ["inventory", "reboot", "cloud_disconnection", "coverage", "steering", "alarms24h"],
  inventory: ["inventory"],
  stability: ["reboot", "cloud_disconnection", "trendStability"],
  rf: ["coverage", "noise", "obss", "events", "trendRf"],
  steering: ["steering"],
  alarms: ["alarms"],
  automation: ["automation"],
  onboarding: ["onboarding", "trendOnboarding"],
};

/**
 * Every Fleet Metrics read, started only for the tab on screen. Answers are kept for the page's
 * lifetime, so a tab opened before shows at once.
 */
export function useFleetViewData(settings: FleetSettings) {
  const days = rangeDays(settings.range);
  const want = new Set(NEEDS[settings.tab]);
  const url = (n: Need, u: string) => (want.has(n) ? u : null);
  const rank = (t: RankingType) => url(t, `/api/fleet/rankings/${t}?days=${days}`);
  const trend = (n: Need, types: string) => url(n, `/api/fleet/report-trend?types=${types}&days=${days}`);

  return {
    inventory: useFleetResource<InventoryResponse>(url("inventory", "/api/fleet/inventory")),
    reboots: useFleetResource<RankingResponse>(rank("reboot")),
    disconnects: useFleetResource<RankingResponse>(rank("cloud_disconnection")),
    coverage: useFleetResource<RankingResponse>(rank("coverage")),
    noise: useFleetResource<RankingResponse>(rank("noise")),
    obss: useFleetResource<RankingResponse>(rank("obss")),
    steering: useFleetResource<SteeringResponse>(url("steering", `/api/fleet/steering?days=${days}`)),
    automation: useFleetResource<AutomationResponse>(url("automation", `/api/fleet/automation?days=${days}`)),
    onboarding: useFleetResource<OnboardingResponse>(url("onboarding", `/api/fleet/onboarding?days=${days}`)),
    alarms: useFleetFill<AlarmsResponse>(url("alarms", `/api/fleet/alarms?days=${days}`)),
    alarms24h: useFleetFill<AlarmsResponse>(url("alarms24h", "/api/fleet/alarms?days=1")),
    events: useFleetFill<EventsResponse>(url("events", `/api/fleet/events?days=${days}`)),
    trendStability: useFleetFill<ReportTrendResponse>(trend("trendStability", "reboot,cloud_disconnection,shaped_event")),
    trendRf: useFleetFill<ReportTrendResponse>(trend("trendRf", "backhaul")),
    trendOnboarding: useFleetFill<ReportTrendResponse>(trend("trendOnboarding", "new_device,claim")),
  };
}

export type FleetViewData = ReturnType<typeof useFleetViewData>;
