"use client";

import Link from "next/link";
import type { RankingColumn } from "@/web/components/tables/FleetRankingTable";
import { bandChannel, fmtInt, prettyModel } from "@/web/lib/fleet/labels";
import { consoleUrl, normaliseMac, visualizerUrl } from "@/web/lib/fleet/links";
import type { RankingRow } from "@/web/lib/fleet/rankings";

/** Column building blocks for Fleet Metrics ranking tables. */

const CONSOLE_ICON = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </svg>
);

export const rankCol: RankingColumn = { key: "rank", label: "#", numeric: true, render: (r) => r.rank, sort: (r) => r.rank };

/** A device MAC opening the Corteca console. */
export function ConsoleMac({ mac }: { mac: string }) {
  return (
    <a href={consoleUrl(mac)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-xs font-medium text-blue-600 hover:text-blue-700" title="Open in the Corteca console">
      {normaliseMac(mac)} {CONSOLE_ICON}
    </a>
  );
}

/** A home network (root MAC) opening the MCP visualizer. */
export function NetworkLink({ id }: { id: string }) {
  return (
    <Link href={visualizerUrl(id)} className="font-mono text-xs font-medium text-blue-600 hover:text-blue-700" title="Open in the MCP network visualizer">
      {normaliseMac(id)}
    </Link>
  );
}

export const deviceCol: RankingColumn = {
  key: "device", label: "Device", sort: (r) => r.deviceId ?? "",
  render: (r) => (r.deviceId ? <ConsoleMac mac={r.deviceId} /> : "—"),
};

export const networkCol: RankingColumn = {
  key: "network", label: "Network", sort: (r) => r.networkId ?? "",
  render: (r) => (r.networkId ? <NetworkLink id={r.networkId} /> : "—"),
};

export const modelCol: RankingColumn = { key: "model", label: "Model", render: (r) => prettyModel(r.model), sort: (r) => prettyModel(r.model) };

export const subscriberCol: RankingColumn = {
  key: "subscriber", label: "Subscriber ID", sort: (r) => r.subscriberId ?? "",
  render: (r) => r.subscriberId ? <span className="text-xs text-neutral-600">{r.subscriberId}</span> : <span className="text-neutral-400">—</span>,
};

export const bandCol: RankingColumn = { key: "band", label: "Band · channel", render: (r) => bandChannel(r.frequency), sort: (r) => r.frequency ?? 0 };

export function countCol(label: string): RankingColumn {
  return { key: "count", label, numeric: true, render: (r) => fmtInt(r.count), sort: (r) => r.count };
}

export function valueCol(key: keyof RankingRow, label: string, fmt: (v: number) => string): RankingColumn {
  return {
    key, label, numeric: true,
    render: (r) => (typeof r[key] === "number" ? fmt(r[key] as number) : "—"),
    sort: (r) => (typeof r[key] === "number" ? (r[key] as number) : -Infinity),
  };
}

/** Short label for a ranked device in charts: "Beacon 3.1 · 12-A1-10". */
export function deviceLabel(r: RankingRow): string {
  const mac = normaliseMac(r.deviceId ?? r.networkId ?? "");
  return `${prettyModel(r.model)} · ${mac.slice(-8)}`;
}
