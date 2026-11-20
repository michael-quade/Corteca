"use client";

import { RankingCard } from "@/web/components/fleet/RankingCard";
import { countCol, deviceCol, modelCol, rankCol, subscriberCol } from "@/web/components/fleet/rankingColumns";
import { StabilityTrends } from "./StabilityTrends";
import { rangeLabel, type FleetRange } from "@/web/lib/fleet/fleetTabs";
import type { RankingResponse } from "@/web/lib/fleet/rankings";
import type { ReportTrendResponse } from "@/web/lib/fleet/reportTrend";
import type { FleetResource } from "@/web/lib/fleet/useFleetData";
import type { FillState } from "@/web/lib/fleet/useFleetFill";

const COLUMNS = (countLabel: string) => [rankCol, deviceCol, modelCol, subscriberCol, countCol(countLabel)];

/** Stability: reboots, cloud disconnections and shaped events per day, then the devices that rebooted and lost the cloud most often. */
export function StabilityView({ reboots, disconnects, trend, range, noisy }: {
  reboots: FleetResource<RankingResponse>;
  disconnects: FleetResource<RankingResponse>;
  trend: FillState<ReportTrendResponse>;
  range: FleetRange;
  noisy: number;
}) {
  return (
    <div className="space-y-6">
      <StabilityTrends state={trend} noisy={noisy} />
      <div className="grid gap-6 xl:grid-cols-2">
        <RankingCard
          title="Most reboots"
          info={`Reboots per device over the last ${rangeLabel(range)}, from Corteca's daily reboot reports (worst 100).`}
          res={reboots}
          columns={COLUMNS("Reboots")}
          chart={{ value: (r) => r.count, seriesLabel: "Reboots" }}
          noisyFactor={noisy}
        />
        <RankingCard
          title="Most cloud disconnections"
          info={`Times a device lost its connection to the Corteca cloud over the last ${rangeLabel(range)}, from the daily cloud-disconnection reports (worst 100).`}
          res={disconnects}
          columns={COLUMNS("Disconnections")}
          chart={{ value: (r) => r.count, seriesLabel: "Disconnections" }}
          noisyFactor={noisy}
        />
      </div>
    </div>
  );
}
