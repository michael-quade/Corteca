"use client";

import { CortecaCard } from "@/web/components/corteca/CortecaCard";
import { HealthTile } from "@/web/components/corteca/HealthTile";
import { Notice } from "@/web/components/corteca/Notice";
import { HBarChart } from "@/web/components/fleet/HBarChart";
import { ViewStatus } from "@/web/components/fleet/ViewStatus";
import { OfflineAgeChart } from "./OfflineAgeChart";
import { fmtInt, pctOf, prettyModel } from "@/web/lib/fleet/labels";
import type { InventoryResponse } from "@/web/lib/fleet/inventory";
import type { FleetResource } from "@/web/lib/fleet/useFleetData";

const MODEL_ROWS = 12;
const ONLINE = "#16a34a";
const OFFLINE = "#d4d4d4";

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>
);
const ICONS = {
  all: icon("M4 6h16v12H4zM8 10h8M8 14h5"),
  online: icon("M5 12.5l4 4 10-10"),
  offline: icon("M12 8v5M12 16h.01M4 20h16L12 4z"),
  stale: icon("M12 7v5l3 2M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z"),
};

/**
 * Inventory: how many WiFi points are online, how long offline ones have been gone, which
 * models they are and how many firmware versions each model runs. "Hide offline > 1 year"
 * takes long-dead devices out of the offline counts.
 */
export function InventoryView({ res, hideStale, onHideStale }: {
  res: FleetResource<InventoryResponse>;
  hideStale: boolean;
  onHideStale: (v: boolean) => void;
}) {
  const inv = res.data;
  if (!inv) return <ViewStatus loading={res.loading} error={res.error} what="the fleet inventory" />;

  const t = inv.totals;
  const offline = hideStale ? t.offline - t.offlineOverYear : t.offline;
  const managed = t.online + offline;
  const models = inv.models
    .map((m) => ({ ...m, offlineShown: hideStale ? m.offline - m.offlineOverYear : m.offline }))
    .filter((m) => m.online + m.offlineShown > 0)
    .sort((a, b) => b.online + b.offlineShown - (a.online + a.offlineShown))
    .slice(0, MODEL_ROWS);

  return (
    <div className="space-y-6">
      {inv.warnings.length > 0 && <Notice title="Some of the inventory couldn't be read">{inv.warnings.join(" · ")}</Notice>}

      <CortecaCard
        title="WiFi points"
        info="Live counts from Corteca's device management. Provisioned = every WiFi point ever provisioned, including ones no longer managed."
        actions={
          <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
            <input type="checkbox" className="accent-blue-600" checked={hideStale} onChange={(e) => onHideStale(e.target.checked)} />
            Hide offline &gt; 1 year
          </label>
        }
      >
        <div className="grid grid-cols-2 gap-y-4 md:grid-cols-4 md:divide-x md:divide-neutral-200">
          <HealthTile icon={ICONS.all} label="Managed" value={fmtInt(managed)} sub={t.provisioned != null ? `${fmtInt(t.provisioned)} provisioned` : undefined} />
          <HealthTile icon={ICONS.online} label="Online" value={fmtInt(t.online)} sub={`${pctOf(t.online, managed)} of managed`} />
          <HealthTile icon={ICONS.offline} label="Offline" value={fmtInt(offline)} sub={`${pctOf(offline, managed)} of managed`} />
          <HealthTile
            icon={ICONS.stale} label="Offline > 1 year" value={fmtInt(t.offlineOverYear)}
            sub={hideStale ? "hidden from the counts" : `${pctOf(t.offlineOverYear, t.offline)} of offline`}
            onClick={() => onHideStale(!hideStale)} hint={hideStale ? "Show them again" : "Hide them from the counts"}
          />
        </div>
      </CortecaCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <CortecaCard title="Online and offline by model" info={`The ${MODEL_ROWS} models with the most WiFi points. Managed and unmanaged entries of a model are added together.`}>
          <HBarChart
            rows={models.map((m) => ({ label: prettyModel(m.model), online: m.online, offline: m.offlineShown }))}
            series={[{ key: "online", label: "Online", color: ONLINE }, { key: "offline", label: hideStale ? "Offline (≤ 1 year)" : "Offline", color: OFFLINE }]}
            labelWidth={190}
          />
        </CortecaCard>
        <CortecaCard title="Offline WiFi points by time since last seen" info="From Corteca's device-status report (offline devices only), by Last offline. Devices gone for years are probably not coming back.">
          {inv.offlineAge.length ? <OfflineAgeChart buckets={inv.offlineAge} /> : <p className="text-sm text-neutral-500">The offline device list couldn&apos;t be read.</p>}
        </CortecaCard>
      </div>

      <CortecaCard title="Firmware versions per model" info="Distinct firmware versions Corteca has seen for each model. More versions = a more fragmented fleet to upgrade.">
        <HBarChart
          rows={inv.firmware.slice(0, MODEL_ROWS).map((f) => ({ label: prettyModel(f.model), versions: f.versions }))}
          series={[{ key: "versions", label: "Firmware versions", color: "#2563eb" }]}
          labelWidth={190}
        />
      </CortecaCard>
    </div>
  );
}
