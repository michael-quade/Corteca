"use client";

import { useState } from "react";
import { CortecaCard } from "@/web/components/corteca/CortecaCard";
import { StatusPill } from "@/web/components/corteca/StatusPill";
import { FleetTable } from "@/web/components/tables/FleetTable";
import { RuleReport } from "./RuleReport";
import { cronText } from "@/web/lib/fleet/cronText";
import { fmtInt } from "@/web/lib/fleet/labels";
import type { RuleRow } from "@/web/lib/fleet/automation";

/** Proactive rules; "Devices" opens a rule's per-device run list under the table. */
export function RulesCard({ rules }: { rules: RuleRow[] }) {
  const [open, setOpen] = useState<RuleRow | null>(null);
  return (
    <CortecaCard title="Proactive rules">
      <FleetTable<RuleRow>
        rows={rules}
        rowKey={(r) => r.id}
        maxHeight="max-h-[420px]"
        empty="No proactive rules."
        columns={[
          { key: "name", label: "Rule", render: (r) => <span className="font-medium">{r.name}</span>, sort: (r) => r.name },
          { key: "on", label: "Status", render: (r) => <StatusPill tone={r.enabled ? "good" : "neutral"}>{r.enabled ? "On" : "Off"}</StatusPill>, sort: (r) => Number(r.enabled) },
          { key: "type", label: "Action", render: (r) => r.type.charAt(0) + r.type.slice(1).toLowerCase(), sort: (r) => r.type },
          { key: "cond", label: "Condition", render: (r) => r.condition, sort: (r) => r.condition },
          { key: "scope", label: "Applies to", render: (r) => r.scope, sort: (r) => r.scope },
          { key: "when", label: "Runs", render: (r) => <span className="text-xs">{cronText(r.cron)}{r.timeZone ? ` · ${r.timeZone}` : ""}</span> },
          { key: "ok", label: "Rebooted", numeric: true, render: (r) => fmtInt(r.totals.success), sort: (r) => r.totals.success },
          { key: "fail", label: "Failed", numeric: true, render: (r) => fmtInt(r.totals.failure), sort: (r) => r.totals.failure },
          { key: "skip", label: "Skipped", numeric: true, render: (r) => fmtInt(r.totals.skipped), sort: (r) => r.totals.skipped },
          {
            key: "dev", label: "", render: (r) => (
              <button type="button" onClick={() => setOpen(open?.id === r.id ? null : r)} className="text-xs font-medium text-blue-600 hover:text-blue-700">
                {open?.id === r.id ? "Hide devices" : "Devices"}
              </button>
            ),
          },
        ]}
      />
      {open && <RuleReport rule={open} onClose={() => setOpen(null)} />}
    </CortecaCard>
  );
}
