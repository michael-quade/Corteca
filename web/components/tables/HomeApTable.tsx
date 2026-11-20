"use client";

import { useMemo, useState } from "react";
import { cn } from "@/web/lib/utils";
import { TABLE_HEAD_ROW } from "@/web/components/corteca/styles";
import { StatusPill } from "@/web/components/corteca/StatusPill";
import { GATEWAY_KIND_META, type HomeApRow } from "@/web/lib/homeApStats";
import { GATEWAY_COLOR } from "@/web/components/map/gatewayColors";

const CONSOLE_BASE = process.env.NEXT_PUBLIC_CORTECA_CONSOLE_URL ?? "https://console.demo2.homewifi.nokia.com";
const consoleUrl = (mac: string) => `${CONSOLE_BASE}/home-troubleshooting/dashboard?mac=${mac.toUpperCase().replace(/:/g, "-")}`;

type Col = "accountName" | "homeId" | "customerId" | "gatewayModel" | "kind" | "aps" | "online";

const COLS: { key: Col; label: string; num?: boolean }[] = [
  { key: "accountName", label: "Account name" },
  { key: "homeId", label: "Home WiFi ID" },
  { key: "customerId", label: "Customer ID" },
  { key: "kind", label: "Gateway type" },
  { key: "gatewayModel", label: "Gateway model" },
  { key: "aps", label: "WiFi devices", num: true },
  { key: "online", label: "Status" },
];

const sortValue = (h: HomeApRow, c: Col): string | number =>
  c === "aps" ? h.aps : c === "online" ? (h.online ? 1 : 0) : c === "kind" ? GATEWAY_KIND_META[h.kind].label : h[c];

/** One row per home: gateway, its type, and how many WiFi devices (gateway + Beacons) it has. Row click opens the console. */
export function HomeApTable({ homes }: { homes: HomeApRow[] }) {
  const [sort, setSort] = useState<{ col: Col; dir: 1 | -1 }>({ col: "aps", dir: -1 });
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? homes.filter((h) => [h.accountName, h.homeId, h.customerId, h.gatewayModel].some((v) => v.toLowerCase().includes(q)))
      : homes;
    return [...list].sort((a, b) => {
      const x = sortValue(a, sort.col), y = sortValue(b, sort.col);
      const d = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
      return d * sort.dir || a.homeId.localeCompare(b.homeId);
    });
  }, [homes, query, sort]);

  const toggleSort = (col: Col) =>
    setSort((s) => (s.col === col ? { col, dir: s.dir === 1 ? -1 : 1 } : { col, dir: col === "aps" ? -1 : 1 }));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <input
          type="search" value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Search account, MAC, customer ID or model"
          className="w-full max-w-sm rounded-lg border border-neutral-300 px-3 py-1.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
        />
        <span className="text-xs text-neutral-500">{rows.length.toLocaleString()} of {homes.length.toLocaleString()} homes</span>
      </div>
      <div className="max-h-[60vh] overflow-auto rounded-xl ring-1 ring-neutral-200">
        <table className="w-full min-w-max border-collapse text-sm">
          <thead className="sticky top-0 z-10">
            <tr className={TABLE_HEAD_ROW}>
              {COLS.map((c) => (
                <th key={c.key} className={cn("whitespace-nowrap px-3 py-2 text-xs font-semibold text-neutral-700", c.num ? "text-right" : "text-left")}>
                  <button type="button" onClick={() => toggleSort(c.key)} className="hover:text-blue-700">
                    {c.label}
                    {sort.col === c.key && <span className="text-blue-600">{sort.dir === 1 ? " ↑" : " ↓"}</span>}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.map((h) => (
              <tr
                key={h.homeId} title="Open in the Corteca console"
                onClick={() => window.open(consoleUrl(h.homeId), "_blank", "noopener,noreferrer")}
                className="cursor-pointer bg-white transition-colors hover:bg-neutral-50"
              >
                <td className="max-w-[220px] truncate px-3 py-1.5 font-medium text-neutral-900">{h.accountName || "—"}</td>
                <td className="px-3 py-1.5 font-mono text-xs text-neutral-700">{h.homeId}</td>
                <td className="max-w-[200px] truncate px-3 py-1.5 text-neutral-700">{h.customerId || "—"}</td>
                <td className="px-3 py-1.5 text-neutral-700">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: GATEWAY_COLOR[h.kind] }} />
                    {GATEWAY_KIND_META[h.kind].label}
                  </span>
                </td>
                <td className="max-w-[220px] truncate px-3 py-1.5 text-neutral-700">{h.gatewayModel || "—"}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-neutral-900">
                  <span className="font-semibold">{h.aps}</span>
                  <span className="ml-1.5 text-xs text-neutral-500">{h.onlineAps} online</span>
                </td>
                <td className="px-3 py-1.5">
                  <StatusPill tone={h.online ? "good" : "neutral"}>{h.online ? "Online" : "Offline"}</StatusPill>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={COLS.length} className="bg-white px-3 py-6 text-center text-sm text-neutral-500">No homes match.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
