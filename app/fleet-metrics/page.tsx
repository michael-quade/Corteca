"use client";

import { useState } from "react";
import { useAuth } from "@/web/contexts/AuthContext";
import { CortecaLoading, CortecaPage } from "@/web/components/corteca/CortecaPage";
import { OutlineButton } from "@/web/components/corteca/OutlineButton";
import { SegmentedControl } from "@/web/components/corteca/SegmentedControl";
import { FleetViews } from "@/web/components/fleet/FleetViews";
import { NoisyControl } from "@/web/components/fleet/NoisyControl";
import { FLEET_RANGES } from "@/web/lib/fleet/fleetTabs";
import { FleetDataProvider, useFleetRefresh } from "@/web/lib/fleet/useFleetData";
import { useFleetSettings } from "@/web/lib/fleet/useFleetSettings";

const REFRESH_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5" />
  </svg>
);

function FleetMetrics() {
  const [settings, update, ready] = useFleetSettings();
  const refresh = useFleetRefresh();
  const [busy, setBusy] = useState(false);

  return (
    <CortecaPage
      title="Fleet Metrics"
      meta="Fleet-wide health from Corteca's device stats, daily reports, cluster alarm and event logs, steering, automation and onboarding · read-only"
      actions={
        <>
          <NoisyControl value={settings.noisy} onChange={(noisy) => update({ noisy })} />
          <SegmentedControl label="Time range" options={FLEET_RANGES.map((r) => ({ value: r.value, label: r.label }))} value={settings.range} onChange={(range) => update({ range })} />
          <OutlineButton icon={busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" /> : REFRESH_ICON} onClick={refresh} disabled={busy}>
            Refresh
          </OutlineButton>
        </>
      }
    >
      {ready && <FleetViews settings={settings} update={update} onLoading={setBusy} />}
    </CortecaPage>
  );
}

export default function FleetMetricsPage() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading || !isAuthenticated) return <CortecaLoading />;
  return (
    <FleetDataProvider>
      <FleetMetrics />
    </FleetDataProvider>
  );
}
