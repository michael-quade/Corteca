"use client";

import { useCallback, useState } from "react";
import { SegmentedControl } from "@/web/components/corteca/SegmentedControl";
import { RankingCard } from "@/web/components/fleet/RankingCard";
import { bandCol, countCol, deviceCol, modelCol, networkCol, rankCol, valueCol } from "@/web/components/fleet/rankingColumns";
import { bandChannel, bandOf, fmtInt, prettyModel } from "@/web/lib/fleet/labels";
import { normaliseMac } from "@/web/lib/fleet/links";
import { rangeLabel, type FleetRange } from "@/web/lib/fleet/fleetTabs";
import type { RankingResponse, RankingRow } from "@/web/lib/fleet/rankings";
import type { EventsResponse } from "@/web/lib/fleet/clusterEvents";
import type { ReportTrendResponse } from "@/web/lib/fleet/reportTrend";
import type { FillState } from "@/web/lib/fleet/useFleetFill";
import { BackhaulTrendCard } from "./BackhaulTrendCard";
import { RadioChangesCard } from "./RadioChangesCard";
import type { FleetResource } from "@/web/lib/fleet/useFleetData";

type Band = "all" | "2.4 GHz" | "5 GHz" | "6 GHz";
const BANDS: { value: Band; label: string }[] = [
  { value: "all", label: "All bands" }, { value: "2.4 GHz", label: "2.4 GHz" }, { value: "5 GHz", label: "5 GHz" }, { value: "6 GHz", label: "6 GHz" },
];

const dbm = (v: number) => `${v.toFixed(1)} dBm`;
const pct = (v: number) => `${v.toFixed(1)}%`;
const radioLabel = (r: RankingRow) => `${prettyModel(r.model)} · ${normaliseMac(r.deviceId ?? r.networkId ?? "").slice(-8)} · ${bandChannel(r.frequency).replace(" · ", " ")}`;

/**
 * RF & coverage: the networks whose clients see the weakest signal, the noisiest radios and
 * the channels most crowded by neighbouring networks (per band), the radio changes Corteca made,
 * and poor backhaul per day.
 */
export function RfView({ coverage, noise, obss, events, backhaul, range }: {
  coverage: FleetResource<RankingResponse>;
  noise: FleetResource<RankingResponse>;
  obss: FleetResource<RankingResponse>;
  events: FillState<EventsResponse>;
  backhaul: FillState<ReportTrendResponse>;
  range: FleetRange;
}) {
  const [band, setBand] = useState<Band>("all");
  const filter = useCallback((r: RankingRow) => band === "all" || bandOf(r.frequency) === band, [band]);
  const period = `over the last ${rangeLabel(range)}`;
  const bandSwitch = <SegmentedControl label="Band" options={BANDS} value={band} onChange={setBand} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-sm text-neutral-700">Band {bandSwitch}</div>
      <RankingCard
        title="Weakest coverage"
        info={`Networks whose clients spent the most time below Corteca's coverage threshold ${period}. Ranked by Corteca's affected metric (clients × time affected).`}
        res={coverage}
        filter={filter}
        columns={[rankCol, networkCol, modelCol, bandCol,
          valueCol("affectedPct", "Time below", pct), valueCol("avg", "Avg client RSSI", dbm), valueCol("worst", "Worst", dbm),
          valueCol("stations", "Clients", fmtInt), countCol("Samples")]}
        chart={{ value: (r) => r.affectedPct ?? 0, seriesLabel: "Time below threshold", unit: "%", max: 100, label: radioLabel, rankOrder: true }}
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <RankingCard
          title="Noisiest radios"
          info={`Average noise floor per radio ${period} (closer to 0 dBm = noisier). A worst of 0 means Corteca recorded no peak.`}
          res={noise}
          filter={filter}
          columns={[rankCol, deviceCol, modelCol, bandCol, valueCol("avg", "Avg noise", dbm), valueCol("worst", "Worst", dbm), countCol("Samples")]}
        />
        <RankingCard
          title="Most congested channels"
          info={`Share of airtime used by other (neighbouring) networks on the radio's channel ${period} — Corteca's OBSS report.`}
          res={obss}
          filter={filter}
          columns={[rankCol, deviceCol, modelCol, bandCol, valueCol("avg", "Avg busy", pct), valueCol("worst", "Worst", pct), countCol("Samples")]}
          chart={{ value: (r) => r.avg ?? 0, seriesLabel: "Airtime used by others", unit: "%", max: 100, label: radioLabel }}
        />
      </div>
      <RadioChangesCard state={events} range={range} />
      <BackhaulTrendCard state={backhaul} />
    </div>
  );
}
