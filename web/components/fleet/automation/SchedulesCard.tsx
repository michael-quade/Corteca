"use client";

import { CortecaCard } from "@/web/components/corteca/CortecaCard";
import { StatusPill } from "@/web/components/corteca/StatusPill";
import { ConsoleMac } from "@/web/components/fleet/rankingColumns";
import { FleetTable } from "@/web/components/tables/FleetTable";
import { cronText } from "@/web/lib/fleet/cronText";
import { fmtInt } from "@/web/lib/fleet/labels";
import type { ScheduleRow } from "@/web/lib/fleet/automation";

type Result = NonNullable<ScheduleRow["results"]>["perDevice"][number];

/** Test schedules, then for each enabled one: compliance, the devices below target and average results. */
export function SchedulesCard({ schedules }: { schedules: ScheduleRow[] }) {
  const active = schedules.filter((s) => s.enabled);
  return (
    <CortecaCard title="Speed and latency test schedules" info="Compliance is Corteca's score for how many planned tests ran and met the target. Results are averages per subscriber over the range.">
      <FleetTable<ScheduleRow>
        rows={schedules}
        rowKey={(s) => s.id}
        maxHeight="max-h-[320px]"
        empty="No schedules."
        columns={[
          { key: "name", label: "Schedule", render: (s) => <span className="font-medium">{s.name}</span>, sort: (s) => s.name },
          { key: "on", label: "Status", render: (s) => <StatusPill tone={s.enabled ? "good" : "neutral"}>{s.enabled ? "On" : "Off"}</StatusPill>, sort: (s) => Number(s.enabled) },
          { key: "type", label: "Test", render: (s) => s.testType.charAt(0) + s.testType.slice(1).toLowerCase(), sort: (s) => s.testType },
          { key: "when", label: "Runs", render: (s) => <span className="text-xs">{cronText(s.cron)}{s.timeZone ? ` · ${s.timeZone}` : ""}</span> },
          { key: "dev", label: "Devices", numeric: true, render: (s) => (s.devices == null ? "—" : fmtInt(s.devices)), sort: (s) => s.devices ?? -1 },
          { key: "score", label: "Compliance", numeric: true, render: (s) => (s.compliance ? s.compliance.score.toFixed(1) : "—"), sort: (s) => s.compliance?.score ?? -1 },
          { key: "tests", label: "Tests run", numeric: true, render: (s) => (s.results ? `${fmtInt(s.results.tests)}${s.results.failed ? ` (${fmtInt(s.results.failed)} failed)` : ""}` : "—"), sort: (s) => s.results?.tests ?? -1 },
        ]}
      />
      {active.map((s) => (s.compliance?.nonCompliant.length || s.results?.perDevice.length) ? (
        <div key={s.id} className="mt-5 space-y-3">
          <h3 className="text-sm font-semibold text-neutral-900">{s.name}</h3>
          <div className="grid gap-4 xl:grid-cols-2">
            {!!s.compliance?.nonCompliant.length && (
              <FleetTable
                rows={s.compliance.nonCompliant}
                rowKey={(d) => d.deviceId}
                maxHeight="max-h-[260px]"
                columns={[
                  { key: "dev", label: "Below target", render: (d) => <ConsoleMac mac={d.deviceId} />, sort: (d) => d.deviceId },
                  { key: "sub", label: "Subscriber", render: (d) => d.subscriberId, sort: (d) => d.subscriberId },
                  { key: "score", label: "Score", numeric: true, render: (d) => d.score.toFixed(1), sort: (d) => d.score },
                ]}
              />
            )}
            {!!s.results?.perDevice.length && (
              <FleetTable<Result>
                rows={s.results.perDevice}
                rowKey={(r) => `${r.subscriberId}:${r.kind}`}
                maxHeight="max-h-[260px]"
                columns={[
                  { key: "sub", label: "Subscriber", render: (r) => r.subscriberId, sort: (r) => r.subscriberId },
                  { key: "kind", label: "Measure", render: (r) => r.kind, sort: (r) => r.kind },
                  { key: "avg", label: "Average", numeric: true, render: (r) => `${r.avg.toFixed(1)} ${r.unit}`, sort: (r) => r.avg },
                  { key: "n", label: "Tests", numeric: true, render: (r) => fmtInt(r.n), sort: (r) => r.n },
                ]}
              />
            )}
          </div>
        </div>
      ) : null)}
    </CortecaCard>
  );
}
