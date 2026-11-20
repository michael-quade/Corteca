"use client";

import { useEffect, useMemo, useState } from "react";
import type { TabBadge } from "./FleetTabs";
import type { FleetTabId } from "@/web/lib/fleet/fleetTabs";
import { FleetTabs } from "./FleetTabs";
import { AlarmsView } from "./alarms/AlarmsView";
import { AutomationView } from "./automation/AutomationView";
import { InventoryView } from "./inventory/InventoryView";
import { OnboardingView } from "./onboarding/OnboardingView";
import { OverviewView } from "./overview/OverviewView";
import { RfView } from "./rf/RfView";
import { StabilityView } from "./stability/StabilityView";
import { SteeringView } from "./steering/SteeringView";
import { fleetBadges } from "@/web/lib/fleet/fleetBadges";
import { useFleetViewData } from "@/web/lib/fleet/useFleetViewData";
import type { FleetSettings } from "@/web/lib/fleet/useFleetSettings";

/**
 * Tab strip + the view on screen. A view's reads start the first time its tab opens; answers
 * are shared and kept, so switching back is instant. Badges appear once a view's data is in.
 */
export function FleetViews({ settings, update, onLoading }: {
  settings: FleetSettings;
  update: (patch: Partial<FleetSettings>) => void;
  onLoading: (busy: boolean) => void;
}) {
  const d = useFleetViewData(settings);
  const busy = Object.values(d).some((r) => r.loading);
  useEffect(() => onLoading(busy), [busy, onLoading]);
  // A tab keeps its badge after you leave it (its data is no longer read then); a tab whose
  // data is in again gets a fresh one, or none.
  const fresh = useMemo(() => fleetBadges(d, settings), [d, settings]);
  const [badges, setBadges] = useState<Partial<Record<FleetTabId, TabBadge | null>>>({});
  const freshKey = JSON.stringify(fresh);
  useEffect(() => setBadges((prev) => ({ ...prev, ...fresh })), [freshKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = Object.fromEntries(Object.entries(badges).filter(([, b]) => b)) as Partial<Record<FleetTabId, TabBadge>>;
  const { range, noisy, tab } = settings;

  return (
    <div className="space-y-6">
      <FleetTabs active={tab} badges={shown} onSelect={(t) => update({ tab: t })} />
      <div role="tabpanel">
        {tab === "overview" && <OverviewView data={d} range={range} noisy={noisy} onOpen={(t) => update({ tab: t })} />}
        {tab === "inventory" && <InventoryView res={d.inventory} hideStale={settings.hideStale} onHideStale={(hideStale) => update({ hideStale })} />}
        {tab === "stability" && <StabilityView reboots={d.reboots} disconnects={d.disconnects} trend={d.trendStability} range={range} noisy={noisy} />}
        {tab === "rf" && <RfView coverage={d.coverage} noise={d.noise} obss={d.obss} events={d.events} backhaul={d.trendRf} range={range} />}
        {tab === "steering" && <SteeringView res={d.steering} range={range} />}
        {tab === "alarms" && <AlarmsView state={d.alarms} range={range} noisy={noisy} />}
        {tab === "automation" && <AutomationView res={d.automation} range={range} />}
        {tab === "onboarding" && <OnboardingView res={d.onboarding} trend={d.trendOnboarding} range={range} />}
      </div>
    </div>
  );
}
