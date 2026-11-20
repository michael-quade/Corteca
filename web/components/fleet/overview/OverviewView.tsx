"use client";

import { CortecaCard } from "@/web/components/corteca/CortecaCard";
import { HealthTile } from "@/web/components/corteca/HealthTile";
import { HBarChart } from "@/web/components/fleet/HBarChart";
import { deviceLabel } from "@/web/components/fleet/rankingColumns";
import { bandChannel, fmtInt, pctOf, prettyModel } from "@/web/lib/fleet/labels";
import { normaliseMac } from "@/web/lib/fleet/links";
import { splitNoisy } from "@/web/lib/fleet/noisy";
import { rangeLabel, type FleetRange, type FleetTabId } from "@/web/lib/fleet/fleetTabs";
import type { FleetViewData } from "@/web/lib/fleet/useFleetViewData";

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>
);
const ICONS = {
  online: icon("M5 12.5l4 4 10-10"),
  reboot: icon("M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5"),
  cloud: icon("M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 9a4.5 4.5 0 0 0 1 9zM4 4l16 16"),
  signal: icon("M4 18h.01M8 18v-3M12 18v-6M16 18V9M20 18V6"),
  steer: icon("M4 12h12M12 6l6 6-6 6"),
  alarm: icon("M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0"),
};

const dash = "…";

/** Overview: one headline per view (click a tile to open it), plus the top reboots and weakest coverage. */
export function OverviewView({ data, range, noisy, onOpen }: {
  data: FleetViewData;
  range: FleetRange;
  noisy: number;
  onOpen: (tab: FleetTabId) => void;
}) {
  const inv = data.inventory.data;
  const reboots = splitNoisy(data.reboots.data?.rows ?? [], (r) => r.count, noisy);
  const cloud = splitNoisy(data.disconnects.data?.rows ?? [], (r) => r.count, noisy);
  const coverage = data.coverage.data?.rows ?? [];
  const steering = data.steering.data;
  const alarms = data.alarms24h.data;
  const topReboot = reboots.kept[0];
  const topCloud = cloud.kept[0];
  const worstCov = coverage[0];
  const period = rangeLabel(range);

  return (
    <div className="space-y-6">
      <CortecaCard title="Fleet at a glance" info={`WiFi points are live counts, steering covers the clients steered in the last 24 h, alarms the last 24 h; the rest covers the last ${period}. Click a tile to open its view.`}>
        <div className="grid grid-cols-2 gap-y-4 md:grid-cols-3 xl:grid-cols-6 xl:divide-x xl:divide-neutral-200">
          <HealthTile
            icon={ICONS.online} label="WiFi points online" onClick={() => onOpen("inventory")}
            value={inv ? fmtInt(inv.totals.online) : dash}
            sub={inv ? `${pctOf(inv.totals.online, inv.totals.managed)} of ${fmtInt(inv.totals.managed)}` : undefined}
          />
          <HealthTile
            icon={ICONS.reboot} label="Most reboots, one device" onClick={() => onOpen("stability")}
            value={topReboot ? fmtInt(topReboot.count) : dash} sub={topReboot ? deviceLabel(topReboot) : undefined}
          />
          <HealthTile
            icon={ICONS.cloud} label="Most cloud disconnections" onClick={() => onOpen("stability")}
            value={topCloud ? fmtInt(topCloud.count) : dash}
            sub={topCloud ? `${deviceLabel(topCloud)}${cloud.setAside.length ? ` · ${cloud.setAside.length} set aside` : ""}` : undefined}
          />
          <HealthTile
            icon={ICONS.signal} label="Weakest coverage" onClick={() => onOpen("rf")}
            value={worstCov?.affectedPct != null ? `${worstCov.affectedPct.toFixed(0)}%` : dash}
            sub={worstCov ? `time below threshold · ${normaliseMac(worstCov.networkId ?? "").slice(-8)}` : undefined}
          />
          <HealthTile
            icon={ICONS.steer} label="Steering success" onClick={() => onOpen("steering")}
            value={steering ? `${steering.avgSuccess.toFixed(0)}%` : dash}
            sub={steering ? `avg of ${fmtInt(steering.clients)} clients · 24 h` : undefined}
          />
          <HealthTile
            icon={ICONS.alarm} label="Critical alarms · 24 h" onClick={() => onOpen("alarms")}
            value={alarms ? fmtInt(alarms.totals.CRITICAL ?? 0) : dash}
            sub={alarms ? `${fmtInt((alarms.totals.MAJOR ?? 0) + (alarms.totals.MINOR ?? 0))} major / minor` : data.alarms24h.progress ? `reading ${data.alarms24h.progress.done}/${data.alarms24h.progress.total} h` : undefined}
          />
        </div>
      </CortecaCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <CortecaCard title="Most reboots" actions={<OpenLink onClick={() => onOpen("stability")} />}>
          <HBarChart
            rows={reboots.kept.slice(0, 5).map((r) => ({ label: deviceLabel(r), value: r.count }))}
            series={[{ key: "value", label: "Reboots", color: "#2563eb" }]}
          />
        </CortecaCard>
        <CortecaCard title="Weakest coverage" actions={<OpenLink onClick={() => onOpen("rf")} />}>
          <HBarChart
            rows={coverage.slice(0, 5).map((r) => ({
              label: `${prettyModel(r.model)} · ${normaliseMac(r.networkId ?? "").slice(-8)}`,
              sub: bandChannel(r.frequency), value: r.affectedPct ?? 0,
            }))}
            series={[{ key: "value", label: "Time below threshold", color: "#2563eb" }]}
            unit="%" max={100}
          />
        </CortecaCard>
      </div>
    </div>
  );
}

function OpenLink({ onClick }: { onClick: () => void }) {
  return <button type="button" onClick={onClick} className="text-sm font-medium text-blue-600 hover:text-blue-700">Open view →</button>;
}
