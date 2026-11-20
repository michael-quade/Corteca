"use client";

import { useMemo, useState, type ReactNode } from "react";
import { CortecaCard } from "@/web/components/corteca/CortecaCard";
import { HealthTile } from "@/web/components/corteca/HealthTile";
import { SegmentedControl } from "@/web/components/corteca/SegmentedControl";
import { HomeApTable } from "@/web/components/tables/HomeApTable";
import {
  homesFromReport, summariseHomes, bucketOf, bucketLabel, pct, GATEWAY_KIND_META, type GatewayKind,
} from "@/web/lib/homeApStats";
import { GatewayMixBar } from "./GatewayMixBar";
import { ApCountChart } from "./ApCountChart";

type Scope = "all" | "online";

const Icon = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{children}</svg>
);
const HomeIcon = () => <Icon><path d="M3 11 12 4l9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-5h4v5" /></Icon>;
const WifiIcon = () => <Icon><path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0" /><path d="M12 19.5h.01" /></Icon>;
const BeaconIcon = () => <Icon><rect x="7" y="3" width="10" height="18" rx="3" /><path d="M10 17h4" /></Icon>;
const FiberIcon = () => <Icon><rect x="3" y="8" width="18" height="10" rx="2" /><path d="M7 13h.01M11 13h.01M15 13h2M12 8V4" /></Icon>;
const TowerIcon = () => <Icon><path d="M12 10v11M8 21l4-11 4 11M9 17h6" /><path d="M8.5 6.5a5 5 0 0 1 7 0M6 4a8.5 8.5 0 0 1 12 0" /><circle cx="12" cy="9" r="1" /></Icon>;

const KIND_TILES: { kind: GatewayKind; icon: ReactNode }[] = [
  { kind: "beacon", icon: <BeaconIcon /> },
  { kind: "ont", icon: <FiberIcon /> },
  { kind: "fwa", icon: <TowerIcon /> },
];

/**
 * Network Map: WiFi devices per home across the whole deployment report (not the map's filters):
 * totals, primary gateway type, homes by device count, and a per-home table. Chart picks filter the table.
 */
export function HomeApCard({ rawRows }: { rawRows: Record<string, string>[] }) {
  const [scope, setScope] = useState<Scope>("all");
  const [kind, setKind] = useState<GatewayKind | null>(null);
  const [bucket, setBucket] = useState<number | null>(null);

  const allHomes = useMemo(() => homesFromReport(rawRows), [rawRows]);
  const homes = useMemo(() => (scope === "online" ? allHomes.filter((h) => h.online) : allHomes), [allHomes, scope]);
  const s = useMemo(() => summariseHomes(homes), [homes]);
  const tableHomes = useMemo(
    () => homes.filter((h) => (!kind || h.kind === kind) && (!bucket || bucketOf(h.aps) === bucket)),
    [homes, kind, bucket],
  );
  const loose = useMemo(() => rawRows.filter((r) => !(r["Home WiFi ID"] ?? "").trim()).length, [rawRows]);

  if (!allHomes.length) return null;

  const filterText = [
    kind && GATEWAY_KIND_META[kind].label,
    bucket && `${bucketLabel(bucket)} WiFi device${bucket === 1 ? "" : "s"}`,
  ].filter(Boolean).join(" · ");

  return (
    <CortecaCard
      title="WiFi devices per home"
      info={`Whole deployment report, not the map's filters. A home is a Home WiFi ID; its gateway (primary RG) is the device whose MAC is the Home WiFi ID. WiFi devices = gateway + Beacons in the report.${loose ? ` ${loose.toLocaleString()} devices with no Home WiFi ID are left out.` : ""}`}
      actions={
        <SegmentedControl<Scope>
          label="Homes" value={scope} onChange={(v) => { setScope(v); setKind(null); setBucket(null); }}
          options={[{ value: "all", label: "All homes" }, { value: "online", label: "Gateway online" }]}
        />
      }
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-y-4 md:grid-cols-5 md:divide-x md:divide-neutral-200">
          <HealthTile icon={<HomeIcon />} label="Homes" value={s.homes.toLocaleString()} sub={`${s.aps.toLocaleString()} WiFi devices`} />
          <HealthTile icon={<WifiIcon />} label="Avg WiFi devices per home" value={s.avg.toFixed(2)}
            sub={`${pct(s.homes - s.buckets[0].homes, s.homes)} of homes have 2+`} />
          {KIND_TILES.map(({ kind: k, icon }) => (
            <HealthTile
              key={k} icon={icon} label={`${GATEWAY_KIND_META[k].label} as gateway`} value={s.byKind[k].toLocaleString()}
              sub={`${pct(s.byKind[k], s.homes)} of homes`} hint={GATEWAY_KIND_META[k].hint}
              onClick={() => setKind(kind === k ? null : k)}
            />
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <section>
            <h3 className="mb-3 text-sm font-semibold text-neutral-900">Primary gateway (RG)</h3>
            <GatewayMixBar byKind={s.byKind} total={s.homes} selected={kind} onSelect={setKind} />
          </section>
          <section>
            <h3 className="mb-1 text-sm font-semibold text-neutral-900">Homes by number of WiFi devices</h3>
            <ApCountChart buckets={s.buckets} total={s.homes} selected={bucket} onSelect={setBucket} />
          </section>
        </div>

        <section>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-neutral-900">Homes</h3>
            {filterText && (
              <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-0.5 text-xs font-medium text-blue-700">
                {filterText}
                <button type="button" onClick={() => { setKind(null); setBucket(null); }} className="hover:underline" aria-label="Clear filter">
                  Clear
                </button>
              </span>
            )}
          </div>
          <HomeApTable homes={tableHomes} />
        </section>
      </div>
    </CortecaCard>
  );
}
