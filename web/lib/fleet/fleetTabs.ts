/** Fleet Metrics views (one tab each), time ranges and the URL / storage keys they use. */

export const FLEET_TABS = [
  { id: "overview", label: "Overview" },
  { id: "inventory", label: "Inventory" },
  { id: "stability", label: "Stability" },
  { id: "rf", label: "RF & coverage" },
  { id: "steering", label: "Steering" },
  { id: "alarms", label: "Alarms" },
  { id: "automation", label: "Automation" },
  { id: "onboarding", label: "Onboarding & apps" },
] as const;

export type FleetTabId = (typeof FLEET_TABS)[number]["id"];

export function isFleetTab(v: string | null | undefined): v is FleetTabId {
  return FLEET_TABS.some((t) => t.id === v);
}

export const FLEET_RANGES = [
  { value: "1d", label: "1 day", days: 1 },
  { value: "7d", label: "7 days", days: 7 },
  { value: "30d", label: "30 days", days: 30 },
] as const;

export type FleetRange = (typeof FLEET_RANGES)[number]["value"];

export function isFleetRange(v: string | null | undefined): v is FleetRange {
  return FLEET_RANGES.some((r) => r.value === v);
}

export function rangeDays(range: FleetRange): number {
  return FLEET_RANGES.find((r) => r.value === range)?.days ?? 7;
}

export function rangeLabel(range: FleetRange): string {
  return FLEET_RANGES.find((r) => r.value === range)?.label ?? range;
}

/**
 * The plain dates (yyyy-mm-dd, UTC) Corteca's report rankings need: `from` = today − days,
 * `to` = today. ISO timestamps (or no dates at all) make the ranking endpoint answer 500.
 */
export function rankingDates(days: number, now = new Date()): { from: string; to: string } {
  const day = (d: Date) => d.toISOString().slice(0, 10);
  return { from: day(new Date(now.getTime() - days * 86_400_000)), to: day(now) };
}

/** Default "noisy device" factor: a device with more than this × the next device's count is set aside. */
export const DEFAULT_NOISY_FACTOR = 10;
export const NOISY_STORAGE_KEY = "corteca.fleetNoisy.v1";
