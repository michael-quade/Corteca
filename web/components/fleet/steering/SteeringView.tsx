"use client";

import { useState } from "react";
import { CortecaCard } from "@/web/components/corteca/CortecaCard";
import { HealthTile } from "@/web/components/corteca/HealthTile";
import { SegmentedControl } from "@/web/components/corteca/SegmentedControl";
import { HBarChart } from "@/web/components/fleet/HBarChart";
import { TimeBars } from "@/web/components/fleet/TimeBars";
import { ViewStatus } from "@/web/components/fleet/ViewStatus";
import { SteeringTables } from "./SteeringTables";
import { fmtInt, pctOf, prettyModel } from "@/web/lib/fleet/labels";
import { rangeLabel, type FleetRange } from "@/web/lib/fleet/fleetTabs";
import type { SteeringResponse } from "@/web/lib/fleet/steering";
import type { FleetResource } from "@/web/lib/fleet/useFleetData";

/** Outcome colours: categorical slots 1–3 (validated with the Network Map's gateway colours). */
export const OUTCOME_SERIES = [
  { key: "success", label: "Steered", color: "#2a78d6" },
  { key: "moved2g", label: "Moved to 2.4 GHz", color: "#1baf7a" },
  { key: "notMoved", label: "Not moved", color: "#eb6834" },
];

const icon = (d: string) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>;
const ICONS = {
  clients: icon("M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 19a6 6 0 0 1 12 0M16 11a3 3 0 1 0 0-6M22 19a6 6 0 0 0-5-5.9"),
  rate: icon("M4 18 10 12l4 4 6-8"),
  never: icon("M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18zM6 6l12 12"),
  tries: icon("M4 12h12M12 6l6 6-6 6"),
};

/**
 * Steering: how well Corteca moves clients to a better band / AP. Client figures cover the
 * clients steered in the last 24 h (Corteca's steering report is one day at a time); attempt
 * counts come from their history, limited to the selected range.
 */
export function SteeringView({ res, range }: { res: FleetResource<SteeringResponse>; range: FleetRange }) {
  const [group, setGroup] = useState<"model" | "mesh">("model");
  const d = res.data;
  if (!d) return <ViewStatus loading={res.loading} error={res.error} what="the steering report (about 10 s)" />;
  const a = d.attempts;
  const never = d.buckets.find((b) => b.label === "0%")?.count ?? 0;
  const groups = group === "model"
    ? d.byModel.slice(0, 10).map((m) => ({ label: `${prettyModel(m.model)} (${m.clients})`, value: m.avg }))
    : d.byMesh.slice(0, 10).map((m) => ({ label: `${m.mesh} (${m.clients})`, value: m.avg }));

  return (
    <div className="space-y-6">
      <CortecaCard title="Steering" info="Clients Corteca tried to steer in the last 24 hours, with each client's success rate as Corteca reports it.">
        <div className="grid grid-cols-2 gap-y-4 md:grid-cols-4 md:divide-x md:divide-neutral-200">
          <HealthTile icon={ICONS.clients} label="Clients steered (24 h)" value={fmtInt(d.clients)} sub={`${fmtInt(d.networks)} networks`} />
          <HealthTile icon={ICONS.rate} label="Average success rate" value={`${d.avgSuccess.toFixed(0)}%`} sub="per client" />
          <HealthTile icon={ICONS.never} label="Never steered" value={fmtInt(never)} sub={`${pctOf(never, d.clients, 0)} of clients at 0%`} />
          <HealthTile icon={ICONS.tries} label={`Attempts (${rangeLabel(range)})`} value={fmtInt(a.total)} sub={`${pctOf(a.success, a.total, 0)} steered · ${pctOf(a.notMoved, a.total, 0)} not moved`} />
        </div>
      </CortecaCard>

      <CortecaCard title="Steering attempts per day" info={`From the history of the clients steered in the last 24 h, so earlier days only count clients that are still being steered. Last ${rangeLabel(range)}, UTC.`}>
        <TimeBars rows={d.attemptsByDay.map((x) => ({ ...x, t: x.day }))} series={OUTCOME_SERIES} />
      </CortecaCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <CortecaCard title="Clients by success rate">
          <HBarChart rows={d.buckets.map((b) => ({ label: b.label, value: b.count }))} series={[{ key: "value", label: "Clients", color: "#2563eb" }]} labelWidth={80} />
        </CortecaCard>
        <CortecaCard
          title="Average success"
          info="Average of the clients' success rates, per AP model or mesh type (clients in brackets)."
          actions={<SegmentedControl label="Group by" value={group} onChange={setGroup} options={[{ value: "model", label: "AP model" }, { value: "mesh", label: "Mesh type" }]} />}
        >
          <HBarChart rows={groups} series={[{ key: "value", label: "Average success", color: "#2563eb" }]} unit="%" max={100} labelWidth={210} />
        </CortecaCard>
      </div>

      <SteeringTables data={d} />
    </div>
  );
}
