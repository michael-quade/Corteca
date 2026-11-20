"use client";

import { CortecaCard } from "@/web/components/corteca/CortecaCard";
import { FillProgress } from "@/web/components/fleet/FillProgress";
import { TimeBars } from "@/web/components/fleet/TimeBars";
import type { ReportTrendResponse } from "@/web/lib/fleet/reportTrend";
import type { FillState } from "@/web/lib/fleet/useFleetFill";

/** Poor-backhaul episodes and the Beacons having them, per day (Corteca's daily backhaul report). */
export function BackhaulTrendCard({ state }: { state: FillState<ReportTrendResponse> }) {
  const days = state.data?.types.backhaul ?? [];
  return (
    <CortecaCard
      title="Poor backhaul per day"
      info="Corteca's daily backhaul report lists every period a Beacon's backhaul was poor. Its ranking is empty on demo2, so this is the fleet view of backhaul quality."
    >
      <FillProgress state={state} unit="report days" what="the daily backhaul reports" />
      {state.data && (
        <TimeBars
          rows={days.map((d) => ({ t: d.day, episodes: d.summary?.events, beacons: d.summary?.devices }))}
          series={[{ key: "beacons", label: "Beacons with poor backhaul", color: "#2563eb" }]}
          height={200}
        />
      )}
    </CortecaCard>
  );
}
