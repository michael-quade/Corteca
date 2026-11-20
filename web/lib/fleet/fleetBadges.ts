import type { TabBadge } from "@/web/components/fleet/FleetTabs";
import { fmtInt } from "./labels";
import { splitNoisy } from "./noisy";
import type { FleetTabId } from "./fleetTabs";
import type { FleetViewData } from "./useFleetViewData";
import type { FleetSettings } from "./useFleetSettings";

/**
 * Tab badges: what needs attention in each view whose data is in. `null` = data in, nothing to
 * flag (clears an older badge); tabs whose data isn't loaded are left out (keep their badge).
 */
export function fleetBadges(d: FleetViewData, settings: FleetSettings): Partial<Record<FleetTabId, TabBadge | null>> {
  const b: Partial<Record<FleetTabId, TabBadge | null>> = {};
  if (d.inventory.data) b.inventory = null;
  if (d.reboots.data || d.disconnects.data) b.stability = null;
  if (d.steering.data) b.steering = null;
  if (d.alarms.data || d.alarms24h.data) b.alarms = null;
  if (d.automation.data) b.automation = null;
  if (d.onboarding.data) b.onboarding = null;
  const inv = d.inventory.data;
  if (inv) {
    const off = settings.hideStale ? inv.totals.offline - inv.totals.offlineOverYear : inv.totals.offline;
    b.inventory = { text: `${fmtInt(off)} offline`, tone: "amber", hint: "WiFi points offline now" };
  }
  const aside = [d.reboots, d.disconnects].reduce((n, r) => n + splitNoisy(r.data?.rows ?? [], (x) => x.count, settings.noisy).setAside.length, 0);
  if (aside) b.stability = { text: `${aside} set aside`, tone: "amber", hint: "Noisy devices left out of the charts" };

  const st = d.steering.data;
  const never = st?.buckets.find((x) => x.label === "0%")?.count ?? 0;
  if (never) b.steering = { text: `${fmtInt(never)} at 0%`, tone: "amber", hint: "Clients Corteca never steered successfully (last 24 h)" };

  const al = (d.alarms.data ?? d.alarms24h.data);
  if (al?.totals.CRITICAL) b.alarms = { text: `${fmtInt(al.totals.CRITICAL)} critical`, tone: "red", hint: d.alarms.data ? "Critical alarm changes in the range" : "Critical alarm changes in the last 24 h" };

  const failed = d.automation.data?.rules.reduce((n, r) => n + r.totals.failure, 0) ?? 0;
  if (failed) b.automation = { text: `${fmtInt(failed)} failed`, tone: "red", hint: "Failed proactive rule runs" };

  const claims = d.onboarding.data?.failedClaims.length ?? 0;
  if (claims) b.onboarding = { text: `${fmtInt(claims)} failed claims`, tone: "amber", hint: "Subscribers with failed claims" };
  return b;
}
