"use client";

import { CortecaCard } from "@/web/components/corteca/CortecaCard";
import { HealthTile } from "@/web/components/corteca/HealthTile";
import { Notice } from "@/web/components/corteca/Notice";
import { FillProgress } from "@/web/components/fleet/FillProgress";
import { TimeBars } from "@/web/components/fleet/TimeBars";
import { ViewStatus } from "@/web/components/fleet/ViewStatus";
import { AppsTable } from "./AppsTable";
import { OnboardingTables } from "./OnboardingTables";
import { fmtInt } from "@/web/lib/fleet/labels";
import { rangeDays, rangeLabel, type FleetRange } from "@/web/lib/fleet/fleetTabs";
import type { OnboardingResponse } from "@/web/lib/fleet/onboarding";
import type { ReportTrendResponse } from "@/web/lib/fleet/reportTrend";
import type { FleetResource } from "@/web/lib/fleet/useFleetData";
import type { FillState } from "@/web/lib/fleet/useFleetFill";

const icon = (d: string) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>;
const ICONS = {
  claim: icon("M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18zM9 9l6 6M15 9l-6 6"),
  wait: icon("M7 4h10M7 20h10M8 4c0 5 8 5 8 8s-8 3-8 8M16 4c0 5-8 5-8 8"),
  lock: icon("M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3"),
  app: icon("M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"),
};

/** Onboarding & apps: claims, WiFi points waiting or refused, new WiFi points per day, container apps. */
export function OnboardingView({ res, trend, range }: { res: FleetResource<OnboardingResponse>; trend: FillState<ReportTrendResponse>; range: FleetRange }) {
  const d = res.data;
  if (!d) return <ViewStatus loading={res.loading} error={res.error} what="onboarding and apps" />;
  const since = new Date(Date.now() - rangeDays(range) * 86_400_000).toISOString();
  const recentClaims = d.failedClaims.filter((c) => c.last >= since).length;
  const installed = d.apps.reduce((a, x) => a + (x.installed ?? 0), 0);
  const t = trend.data;
  const rows = t ? t.days.map((day, i) => ({ t: day, new_device: t.types.new_device?.[i]?.summary?.events, claim: t.types.claim?.[i]?.summary?.events })) : [];

  return (
    <div className="space-y-6">
      {d.errors.length > 0 && <Notice title="Some onboarding data couldn't be read">{d.errors.join(" · ")}</Notice>}
      <CortecaCard title="Onboarding" info="Subscriber claims that failed, WiFi points registered but not yet claimed, and WiFi points that tried to connect but failed authentication.">
        <div className="grid grid-cols-2 gap-y-4 md:grid-cols-4 md:divide-x md:divide-neutral-200">
          <HealthTile icon={ICONS.claim} label="Subscribers with failed claims" value={fmtInt(d.failedClaims.length)} sub={`${recentClaims} in the last ${rangeLabel(range)}`} />
          <HealthTile icon={ICONS.wait} label="Waiting to be claimed" value={fmtInt(d.claimable.length) + (d.claimableCapped ? "+" : "")} sub="registered WiFi points" />
          <HealthTile icon={ICONS.lock} label="Unauthenticated" value={fmtInt(d.unauthenticated.length) + (d.unauthenticatedCapped ? "+" : "")} sub="refused by provisioning" />
          <HealthTile icon={ICONS.app} label="Container app installs" value={fmtInt(installed)} sub={`${d.apps.length} apps`} />
        </div>
      </CortecaCard>

      <CortecaCard title="New WiFi points and claims per day" info="From Corteca's daily new-device and claim reports. Corteca keeps 7 days of reports; older days appear once the daily update has stored them.">
        <FillProgress state={trend} unit="report days" what="the daily reports" />
        {t && <TimeBars rows={rows} series={[{ key: "new_device", label: "New WiFi points", color: "#2a78d6" }, { key: "claim", label: "Claims", color: "#eb6834" }]} height={200} />}
      </CortecaCard>

      <OnboardingTables data={d} since={since} />
      <CortecaCard title="Container apps" info={`Installed / uninstalled = all time. Installs, failures and removals (device removed or factory reset) = last ${rangeLabel(range)}.`}>
        <AppsTable apps={d.apps} />
      </CortecaCard>
    </div>
  );
}
