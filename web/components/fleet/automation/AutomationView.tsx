"use client";

import { CortecaCard } from "@/web/components/corteca/CortecaCard";
import { HealthTile } from "@/web/components/corteca/HealthTile";
import { Notice } from "@/web/components/corteca/Notice";
import { TimeBars } from "@/web/components/fleet/TimeBars";
import { ViewStatus } from "@/web/components/fleet/ViewStatus";
import { RulesCard } from "./RulesCard";
import { SchedulesCard } from "./SchedulesCard";
import { fmtInt } from "@/web/lib/fleet/labels";
import { rangeLabel, type FleetRange } from "@/web/lib/fleet/fleetTabs";
import type { AutomationResponse } from "@/web/lib/fleet/automation";
import type { FleetResource } from "@/web/lib/fleet/useFleetData";

export const RUN_SERIES = [
  { key: "success", label: "Rebooted", color: "#16a34a" },
  { key: "failure", label: "Failed", color: "#dc2626" },
  { key: "skipped", label: "Skipped", color: "#a3a3a3" },
];

const icon = (d: string) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>;
const ICONS = {
  rules: icon("M4 6h16M4 12h10M4 18h7"),
  done: icon("M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5"),
  failed: icon("M6 6l12 12M18 6 6 18"),
  sched: icon("M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18zM12 7v5l3 2"),
};

/** Automation (read-only): proactive reboot rules and their runs, scheduled speed / latency tests. */
export function AutomationView({ res, range }: { res: FleetResource<AutomationResponse>; range: FleetRange }) {
  const d = res.data;
  if (!d) return <ViewStatus loading={res.loading} error={res.error} what="proactive rules and schedules" />;
  const sum = (k: "success" | "failure" | "skipped") => d.rules.reduce((a, r) => a + r.totals[k], 0);
  const on = d.rules.filter((r) => r.enabled).length;

  return (
    <div className="space-y-6">
      {d.errors.length > 0 && <Notice title="Some automation data couldn't be read">{d.errors.join(" · ")}</Notice>}
      <CortecaCard title="Automation" info={`Proactive rules reboot devices when a condition holds; schedules run speed / latency tests. Runs over the last ${rangeLabel(range)}. Shown only — nothing here changes a rule or schedule.`}>
        <div className="grid grid-cols-2 gap-y-4 md:grid-cols-4 md:divide-x md:divide-neutral-200">
          <HealthTile icon={ICONS.rules} label="Proactive rules" value={`${on} on`} sub={`${d.rules.length} in all`} />
          <HealthTile icon={ICONS.done} label="Rule reboots" value={fmtInt(sum("success"))} sub={`${fmtInt(sum("skipped"))} skipped`} />
          <HealthTile icon={ICONS.failed} label="Failed rule runs" value={fmtInt(sum("failure"))} sub={`last ${rangeLabel(range)}`} />
          <HealthTile icon={ICONS.sched} label="Test schedules" value={`${d.schedules.filter((s) => s.enabled).length} on`} sub={`${d.schedules.length} in all`} />
        </div>
      </CortecaCard>
      <CortecaCard title="Proactive rule runs per day" info="All rules together: devices rebooted, failed, or skipped (condition not met / device offline).">
        <TimeBars rows={d.ruleDaily.map((x) => ({ ...x, t: x.day }))} series={RUN_SERIES} height={200} />
      </CortecaCard>
      <RulesCard rules={d.rules} />
      <SchedulesCard schedules={d.schedules} />
    </div>
  );
}
