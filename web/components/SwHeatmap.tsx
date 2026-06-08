"use client";

import { useMemo } from "react";
import { cn } from "@/web/lib/utils";
import type { NetworkSwEntry, SwSelection } from "@/web/components/SwOverview.types";

interface SwHeatmapProps {
  beaconModels: string[];
  networks: NetworkSwEntry[];
  filter: "all" | "online" | "offline";
  onSelect: (sel: SwSelection) => void;
  activeSelection: SwSelection | null;
  buildMatrix: Record<string, Record<string, string>>;
}

interface CellCounts {
  total: number;
  online: number;
  offline: number;
}

function selectionMatches(sel: SwSelection | null, releaseName: string, beaconModel: string): boolean {
  if (!sel) return false;
  if (sel.type === "cell") return sel.releaseName === releaseName && sel.beaconModel === beaconModel;
  if (sel.type === "release") return sel.releaseName === releaseName;
  if (sel.type === "model") return sel.beaconModel === beaconModel;
  return false;
}

function CellBadge({ counts, isActive }: { counts: CellCounts; isActive: boolean }) {
  const { total, online, offline } = counts;
  if (total === 0) {
    return <span className="text-neutral-200 text-xs">—</span>;
  }

  const color =
    offline === 0
      ? isActive
        ? "bg-emerald-600 text-white"
        : "bg-emerald-100 text-emerald-800"
      : online === 0
      ? isActive
        ? "bg-neutral-500 text-white"
        : "bg-neutral-100 text-neutral-600"
      : isActive
      ? "bg-amber-500 text-white"
      : "bg-amber-100 text-amber-800";

  return (
    <span className={cn("inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold tabular-nums", color)}>
      {total}
    </span>
  );
}

export function SwHeatmap({ beaconModels, networks, filter, onSelect, activeSelection, buildMatrix }: SwHeatmapProps) {
  // Build counts per (releaseName × beaconModel)
  const { activeReleases, cellMap, releaseTotals, modelTotals } = useMemo(() => {
    const raw = new Map<string, Map<string, CellCounts>>();
    // Seed from all matrix releases so newly added rows appear even with 0 devices
    const releasesSet = new Set<string>(Object.keys(buildMatrix));

    for (const n of networks) {
      if (!n.releaseName || !n.beaconModel) continue;
      releasesSet.add(n.releaseName);

      if (!raw.has(n.releaseName)) raw.set(n.releaseName, new Map());
      const modelMap = raw.get(n.releaseName)!;
      if (!modelMap.has(n.beaconModel)) modelMap.set(n.beaconModel, { total: 0, online: 0, offline: 0 });
      const c = modelMap.get(n.beaconModel)!;

      const counted =
        filter === "all"
          ? true
          : filter === "online"
          ? n.online
          : !n.online;

      if (counted) {
        c.total += 1;
        if (n.online) c.online += 1;
        else c.offline += 1;
      }
    }

    // Sort releases newest-to-oldest by string descending
    const activeReleases = Array.from(releasesSet).sort((a, b) => b.localeCompare(a));

    // Pre-compute totals
    const releaseTotals = new Map<string, number>();
    const modelTotals = new Map<string, number>();

    for (const release of activeReleases) {
      let rt = 0;
      for (const model of beaconModels) {
        const c = raw.get(release)?.get(model);
        const n = c?.total ?? 0;
        rt += n;
        modelTotals.set(model, (modelTotals.get(model) ?? 0) + n);
      }
      releaseTotals.set(release, rt);
    }

    return { activeReleases, cellMap: raw, releaseTotals, modelTotals };
  }, [networks, beaconModels, filter]);

  if (activeReleases.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-neutral-400">
        No matched firmware data available. Make sure the deployment report is loaded.
      </p>
    );
  }

  const isModelActive = (m: string) => activeSelection?.type === "model" && activeSelection.beaconModel === m;
  const isReleaseActive = (r: string) => activeSelection?.type === "release" && activeSelection.releaseName === r;

  return (
    <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] rounded-lg border border-neutral-200">
      <table className="w-full text-sm border-collapse">
        <thead className="sticky top-0 z-20">
          <tr className="border-b border-neutral-200 bg-neutral-50">
            <th className="sticky left-0 z-30 bg-neutral-50 px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-neutral-500 min-w-[110px]">
              Release
            </th>
            {beaconModels.map((model) => (
              <th key={model} className="bg-neutral-50 px-3 py-3 text-center">
                <button
                  type="button"
                  onClick={() => onSelect({ type: "model", beaconModel: model })}
                  className={cn(
                    "whitespace-nowrap text-xs font-medium uppercase tracking-wide transition-colors",
                    isModelActive(model)
                      ? "text-blue-700 underline"
                      : "text-neutral-500 hover:text-neutral-800",
                  )}
                >
                  {model}
                </button>
              </th>
            ))}
            <th className="bg-neutral-50 px-3 py-3 text-center text-xs font-medium uppercase tracking-wide text-neutral-500">
              Total
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {activeReleases.map((release) => (
            <tr key={release} className="bg-white hover:bg-neutral-50 transition-colors">
              <td className="sticky left-0 z-10 bg-inherit px-4 py-2.5">
                <button
                  type="button"
                  onClick={() => onSelect({ type: "release", releaseName: release })}
                  className={cn(
                    "text-xs font-mono font-semibold transition-colors",
                    isReleaseActive(release)
                      ? "text-blue-700 underline"
                      : "text-neutral-700 hover:text-neutral-900",
                  )}
                >
                  {release}
                </button>
              </td>
              {beaconModels.map((model) => {
                const counts = cellMap.get(release)?.get(model) ?? { total: 0, online: 0, offline: 0 };
                const isActive = selectionMatches(activeSelection, release, model);
                const buildStr = buildMatrix[release]?.[model] ?? null;
                return (
                  <td key={model} className="px-3 py-2 text-center">
                    {counts.total > 0 ? (
                      <button
                        type="button"
                        onClick={() => onSelect({ type: "cell", releaseName: release, beaconModel: model })}
                        className="flex flex-col items-center gap-0.5"
                        title={`${counts.online} online, ${counts.offline} offline`}
                      >
                        <CellBadge counts={counts} isActive={isActive} />
                        {buildStr && (
                          <span className="font-mono text-[10px] leading-tight text-neutral-400">
                            {buildStr}
                          </span>
                        )}
                      </button>
                    ) : buildStr ? (
                      <span className="font-mono text-[10px] leading-tight text-neutral-300">
                        {buildStr}
                      </span>
                    ) : (
                      <span className="text-neutral-200 text-xs">—</span>
                    )}
                  </td>
                );
              })}
              <td className="px-3 py-2.5 text-center">
                <span className="text-xs font-semibold tabular-nums text-neutral-600">
                  {releaseTotals.get(release) ?? 0}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-neutral-200 bg-neutral-50">
            <td className="sticky left-0 z-10 bg-neutral-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Total
            </td>
            {beaconModels.map((model) => (
              <td key={model} className="px-3 py-2.5 text-center">
                <span className="text-xs font-semibold tabular-nums text-neutral-600">
                  {modelTotals.get(model) ?? 0}
                </span>
              </td>
            ))}
            <td className="px-3 py-2.5 text-center">
              <span className="text-xs font-bold tabular-nums text-neutral-800">
                {Array.from(releaseTotals.values()).reduce((s, v) => s + v, 0)}
              </span>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
