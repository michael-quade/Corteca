"use client";

import { cn } from "@/web/lib/utils";
import { WIFI_GENERATIONS, type ModelWifiMap, type WifiGeneration } from "@/web/lib/wifiGeneration";

interface WifiFilterPillsProps {
  beaconModels: string[];
  modelWifi: ModelWifiMap;
  selected: WifiGeneration[];
  onChange: (selected: WifiGeneration[]) => void;
}

export function WifiFilterPills({ beaconModels, modelWifi, selected, onChange }: WifiFilterPillsProps) {
  const toggle = (gen: WifiGeneration) =>
    onChange(selected.includes(gen) ? selected.filter((g) => g !== gen) : [...selected, gen]);

  const untagged = beaconModels.filter((m) => !modelWifi[m]).length;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-neutral-500">WiFi:</span>
      {WIFI_GENERATIONS.map((gen) => {
        const active = selected.includes(gen);
        const count = beaconModels.filter((m) => modelWifi[m] === gen).length;
        return (
          <button
            key={gen}
            type="button"
            onClick={() => toggle(gen)}
            aria-pressed={active}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
              active
                ? "bg-blue-50 text-blue-700 ring-1 ring-blue-600"
                : "border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50",
            )}
          >
            {gen}
            <span className={cn("tabular-nums", active ? "text-blue-500" : "text-neutral-400")}>{count}</span>
          </button>
        );
      })}
      {selected.length > 0 && (
        <button
          type="button"
          onClick={() => onChange([])}
          className="text-xs font-medium text-blue-600 underline-offset-2 hover:underline"
        >
          Clear
        </button>
      )}
      {untagged > 0 && (
        <span className="text-xs text-neutral-400">
          {untagged} model{untagged !== 1 ? "s" : ""} without a WiFi type — set it in SW Matrix
        </span>
      )}
    </div>
  );
}
