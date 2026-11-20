"use client";

import { StatusPill, type PillTone } from "@/web/components/corteca/StatusPill";
import { ConsoleMac } from "@/web/components/fleet/rankingColumns";
import { ViewStatus } from "@/web/components/fleet/ViewStatus";
import { FleetTable } from "@/web/components/tables/FleetTable";
import type { RuleReportRow, RuleRow } from "@/web/lib/fleet/automation";
import { useFleetResource } from "@/web/lib/fleet/useFleetData";

const TONE: Record<string, PillTone> = { SUCCESS: "good", FAILURE: "poor", FAILED: "poor", SKIPPED: "neutral" };

/** One rule's per-device runs (Corteca's rule report), newest first. */
export function RuleReport({ rule, onClose }: { rule: RuleRow; onClose: () => void }) {
  const res = useFleetResource<{ rows: RuleReportRow[]; total: number }>(`/api/fleet/automation/rules/${encodeURIComponent(rule.id)}/report`);
  return (
    <div className="mt-4 rounded-xl bg-neutral-50 p-4 ring-1 ring-neutral-200">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-neutral-900">{rule.name} · devices</h3>
        <button type="button" onClick={onClose} className="text-xs font-medium text-blue-600 hover:text-blue-700">Close</button>
      </div>
      {!res.data ? <ViewStatus loading={res.loading} error={res.error} what="the rule's runs" /> : (
        <FleetTable<RuleReportRow>
          rows={res.data.rows}
          rowKey={(r, i) => `${r.mac}:${r.at}:${i}`}
          maxHeight="max-h-[320px]"
          empty="This rule hasn't run on any device yet."
          columns={[
            { key: "at", label: "Run at", render: (r) => new Date(r.at).toLocaleString(), sort: (r) => r.at },
            { key: "mac", label: "Device", render: (r) => <ConsoleMac mac={r.mac} />, sort: (r) => r.mac },
            { key: "sn", label: "Serial", render: (r) => <span className="font-mono text-xs">{r.serial || "—"}</span> },
            { key: "sub", label: "Subscriber", render: (r) => r.subscriberId || "—", sort: (r) => r.subscriberId },
            { key: "res", label: "Result", render: (r) => <StatusPill tone={TONE[r.result.toUpperCase()] ?? "info"}>{r.result.charAt(0) + r.result.slice(1).toLowerCase()}</StatusPill>, sort: (r) => r.result },
          ]}
        />
      )}
    </div>
  );
}
