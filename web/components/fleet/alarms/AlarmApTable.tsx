"use client";

import { FleetTable } from "@/web/components/tables/FleetTable";
import { ConsoleMac } from "@/web/components/fleet/rankingColumns";
import { fmtInt, prettyModel } from "@/web/lib/fleet/labels";
import type { AlarmsResponse } from "@/web/lib/fleet/alarms";

type Ap = AlarmsResponse["aps"][number];

/** APs by raised alarms (set-aside ones tinted). */
export function AlarmApTable({ aps, aside }: { aps: Ap[]; aside: Set<string> }) {
  return (
    <FleetTable<Ap>
      rows={aps}
      rowKey={(a) => a.mac}
      tinted={(a) => aside.has(a.mac)}
      maxHeight="max-h-[420px]"
      limit={300}
      columns={[
        { key: "mac", label: "AP", render: (a) => <ConsoleMac mac={a.mac} />, sort: (a) => a.mac },
        { key: "model", label: "Model", render: (a) => prettyModel(a.model), sort: (a) => prettyModel(a.model) },
        { key: "cus", label: "Customer ID", render: (a) => <span className="text-xs text-neutral-600">{a.customerId || "—"}</span>, sort: (a) => a.customerId },
        { key: "raised", label: "Raised", numeric: true, render: (a) => fmtInt(a.raised), sort: (a) => a.raised },
        { key: "critical", label: "Critical", numeric: true, render: (a) => fmtInt(a.critical), sort: (a) => a.critical },
      ]}
    />
  );
}
