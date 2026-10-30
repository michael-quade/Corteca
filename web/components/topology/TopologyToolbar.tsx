"use client";

import { useMemo, useState } from "react";
import { cn } from "@/web/lib/utils";
import { Hint } from "@/web/components/ui/Hint";
import type { McpNetwork } from "@/web/lib/mcpNetwork";
import { clientName, type Band, type LayoutMode } from "@/web/lib/topologyFlow";
import {
  EMPTY_FILTERS, WEAK_SIGNAL_DBM, filtersActive, searchClients, ssidsOf, type ClientFilters, type Selection,
} from "@/web/lib/topologySelection";

const BANDS: Band[] = ["6 GHz", "5 GHz", "2.4 GHz", "Wired"];
const LAYOUTS: { mode: LayoutMode; label: string }[] = [
  { mode: "tree", label: "Tree" },
  { mode: "horizontal", label: "Sideways" },
  { mode: "radial", label: "Radial" },
];
const LAYOUT_HINT: Record<LayoutMode, string> = {
  tree: "Gateway at the top, Beacons and clients below it.",
  horizontal: "Gateway on the left, the network spreading to the right.",
  radial: "Gateway in the middle, the network in rings around it.",
};

const BAND_HINT: Partial<Record<Band, string>> = {
  "6 GHz": "Show only clients connected on 6 GHz; the rest fade out. Pick several bands to show any of them.",
  "5 GHz": "Show only clients connected on 5 GHz; the rest fade out. Pick several bands to show any of them.",
  "2.4 GHz": "Show only clients connected on 2.4 GHz; the rest fade out. Pick several bands to show any of them.",
  "Wired": "Show only clients plugged in with an Ethernet cable; the rest fade out.",
};

function Chip({ active, onClick, hint, children }: { active: boolean; onClick: () => void; hint: string; children: React.ReactNode }) {
  return (
    <Hint text={hint}>
      {(id) => (
        <button
          type="button"
          aria-pressed={active}
          aria-describedby={id}
          onClick={onClick}
          className={cn(
            "whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
            active ? "border-violet-600 bg-violet-600 text-white" : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400"
          )}
        >
          {children}
        </button>
      )}
    </Hint>
  );
}

/** Short name for a group of chips. */
const GroupLabel = ({ children }: { children: React.ReactNode }) => (
  <span className="ml-1 whitespace-nowrap text-[11px] font-medium text-neutral-400">{children}</span>
);

function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

export interface TopologyToolbarProps {
  network: McpNetwork;
  filters: ClientFilters;
  onFiltersChange: (f: ClientFilters) => void;
  matchCount: number;
  layout: LayoutMode;
  onLayoutChange: (l: LayoutMode) => void;
  onSelect: (sel: Selection) => void;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
}

export function TopologyToolbar(props: TopologyToolbarProps) {
  const { network, filters, onFiltersChange, matchCount, layout, onLayoutChange, onSelect, fullscreen, onToggleFullscreen } = props;
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchClients(network, query), [network, query]);
  const ssids = useMemo(() => ssidsOf(network), [network]);
  const total = network.members.filter((m) => m.connected).length;

  function pick(id: string) {
    onSelect({ kind: "client", id });
    setQuery("");
  }

  return (
    <div className="relative z-20 flex flex-wrap items-center gap-2 border-b border-neutral-200 bg-white px-3 py-2">
      <div className="relative">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && results[0]) pick(results[0].id);
            if (e.key === "Escape") setQuery("");
            e.stopPropagation(); // keep arrow keys out of the canvas navigation
          }}
          placeholder="Find client: name, MAC or IP"
          aria-label="Find client"
          className="w-60 rounded-md border border-neutral-300 px-2.5 py-1.5 text-xs placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
        {query.trim() && (
          <ul className="absolute left-0 top-full z-20 mt-1 max-h-72 w-72 overflow-auto rounded-lg border border-neutral-200 bg-white py-1 shadow-lg">
            {results.length === 0 && <li className="px-3 py-2 text-xs text-neutral-400">No matching clients</li>}
            {results.map((m) => (
              <li key={m.id}>
                <button type="button" onClick={() => pick(m.id)} className="flex w-full flex-col px-3 py-1.5 text-left hover:bg-violet-50">
                  <span className="text-xs font-medium text-neutral-900">{clientName(m)}</span>
                  <span className="font-mono text-[10px] text-neutral-400">{m.id}{m.ipv4 ? ` · ${m.ipv4}` : ""}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Groups combine: 5 GHz + Weak signal = weak clients on 5 GHz. Within a group, any chip matches. */}
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Client filters">
        <span role="group" aria-label="Band" className="flex flex-wrap items-center gap-1.5">
          <GroupLabel>Band</GroupLabel>
          {BANDS.map((b) => (
            <Chip key={b} hint={BAND_HINT[b] ?? `Show only ${b} clients; the rest fade out.`} active={filters.bands.includes(b)} onClick={() => onFiltersChange({ ...filters, bands: toggle(filters.bands, b) })}>{b}</Chip>
          ))}
        </span>
        <span className="mx-0.5 h-4 w-px bg-neutral-200" />
        {ssids.length > 0 && (
          <span role="group" aria-label="WiFi network" className="flex flex-wrap items-center gap-1.5">
            <GroupLabel>WiFi network</GroupLabel>
            {ssids.map((s) => (
              <Chip key={s} hint={`Show only clients on the “${s}” WiFi network (SSID); the rest fade out.`} active={filters.ssids.includes(s)} onClick={() => onFiltersChange({ ...filters, ssids: toggle(filters.ssids, s) })}>{s}</Chip>
            ))}
            <span className="mx-0.5 h-4 w-px bg-neutral-200" />
          </span>
        )}
        <span role="group" aria-label="Look for" className="flex flex-wrap items-center gap-1.5">
          <GroupLabel>Look for</GroupLabel>
          <Chip
            hint={`Show only WiFi clients with a signal weaker than ${WEAK_SIGNAL_DBM} dBm: often too far from their Beacon.`}
            active={filters.weak} onClick={() => onFiltersChange({ ...filters, weak: !filters.weak })}
          >Weak signal &lt; {WEAK_SIGNAL_DBM} dBm</Chip>
          <Chip
            hint="Show only clients on a slower band than both they and their Beacon support, e.g. on 2.4 GHz while 5 GHz capable."
            active={filters.slowBand} onClick={() => onFiltersChange({ ...filters, slowBand: !filters.slowBand })}
          >Could use faster band</Chip>
          <Chip
            hint="Show only clients using WiFi 5 (802.11ac) or older: they use more airtime for the same data, slowing the radio for everyone."
            active={filters.olderWifi} onClick={() => onFiltersChange({ ...filters, olderWifi: !filters.olderWifi })}
          >Older WiFi (4/5)</Chip>
        </span>
        {filtersActive(filters) && (
          <>
            <span className="text-xs text-neutral-500" title="Clients matching every group you picked">{matchCount} of {total} clients</span>
            <button type="button" onClick={() => onFiltersChange(EMPTY_FILTERS)} className="text-xs text-violet-700 hover:underline">Clear</button>
          </>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="flex rounded-md border border-neutral-200 p-0.5" role="group" aria-label="Layout">
          {LAYOUTS.map(({ mode, label }) => (
            <Hint key={mode} text={LAYOUT_HINT[mode]}>
              {(id) => (
                <button
                  type="button"
                  aria-pressed={layout === mode}
                  aria-describedby={id}
                  onClick={() => onLayoutChange(mode)}
                  className={cn(
                    "rounded px-2 py-1 text-xs font-medium",
                    layout === mode ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"
                  )}
                >
                  {label}
                </button>
              )}
            </Hint>
          ))}
        </div>
        <button
          type="button"
          onClick={onToggleFullscreen}
          className="rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
        >
          {fullscreen ? "Exit full screen" : "Full screen"}
        </button>
      </div>
    </div>
  );
}
