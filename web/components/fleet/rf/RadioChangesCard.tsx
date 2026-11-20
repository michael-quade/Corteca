"use client";

import { useState } from "react";
import { CortecaCard } from "@/web/components/corteca/CortecaCard";
import { FillProgress } from "@/web/components/fleet/FillProgress";
import { ConsoleMac } from "@/web/components/fleet/rankingColumns";
import { TimeBars } from "@/web/components/fleet/TimeBars";
import { FleetTable } from "@/web/components/tables/FleetTable";
import { fmtInt, prettyModel } from "@/web/lib/fleet/labels";
import { rangeLabel, type FleetRange } from "@/web/lib/fleet/fleetTabs";
import type { EventsResponse } from "@/web/lib/fleet/clusterEvents";
import type { FillState } from "@/web/lib/fleet/useFleetFill";

const MAIN = [
  { key: "channel", label: "Channel / bandwidth", color: "#2a78d6" },
  { key: "radio", label: "Radio on / off", color: "#eb6834" },
  { key: "dfs", label: "DFS radar", color: "#1baf7a" },
  { key: "reboot", label: "Reboots", color: "#525252" },
];
const ROUTINE = [
  { key: "power", label: "Power changes", color: "#d4d4d4" },
  { key: "threshold", label: "Thresholds exceeded", color: "#a3a3a3" },
  { key: "other", label: "Other", color: "#e5e5e5" },
];

type Ap = EventsResponse["aps"][number];

/** Radio / configuration changes Corteca logged across the cluster, and the APs that change most. */
export function RadioChangesCard({ state, range }: { state: FillState<EventsResponse>; range: FleetRange }) {
  const [routine, setRoutine] = useState(false);
  const d = state.data;
  const routineTotal = d ? (d.totals.power ?? 0) + (d.totals.threshold ?? 0) + (d.totals.other ?? 0) : 0;
  return (
    <CortecaCard
      title="Radio changes"
      info={`Changes Corteca's RRM and the APs logged in the last ${rangeLabel(range)} (UTC), from the cluster event log. Power changes and threshold notices are routine and hidden unless switched on.`}
      actions={
        <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
          <input type="checkbox" className="accent-blue-600" checked={routine} onChange={(e) => setRoutine(e.target.checked)} />
          Show routine{d ? ` (${fmtInt(routineTotal)})` : ""}
        </label>
      }
    >
      <div className="space-y-4">
        <FillProgress state={state} unit="hours" what="the cluster event log" />
        {d && (
          <>
            <TimeBars rows={d.series} series={routine ? [...MAIN, ...ROUTINE] : MAIN} hourly={d.bucket === "hour"} height={220} />
            <FleetTable<Ap>
              rows={d.aps}
              rowKey={(a) => a.mac}
              maxHeight="max-h-[360px]"
              limit={200}
              empty="No radio changes in this range."
              columns={[
                { key: "mac", label: "AP", render: (a) => <ConsoleMac mac={a.mac} />, sort: (a) => a.mac },
                { key: "model", label: "Model", render: (a) => prettyModel(a.model), sort: (a) => prettyModel(a.model) },
                { key: "total", label: "Changes", numeric: true, render: (a) => fmtInt(a.total), sort: (a) => a.total },
                ...MAIN.map((s) => ({ key: s.key, label: s.label, numeric: true, render: (a: Ap) => fmtInt(Number(a[s.key as keyof Ap]) || 0), sort: (a: Ap) => Number(a[s.key as keyof Ap]) || 0 })),
              ]}
            />
          </>
        )}
      </div>
    </CortecaCard>
  );
}
