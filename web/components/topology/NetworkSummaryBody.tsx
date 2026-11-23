"use client";

import type { ReactNode } from "react";
import { cn } from "@/web/lib/utils";
import { StatusPill } from "@/web/components/corteca/StatusPill";
import { SUMMARY_BANDS, type NetworkSummary } from "@/web/lib/networkSummary";
import type { Band } from "@/web/lib/topologyFlow";
import type { ClientFilters } from "@/web/lib/topologySelection";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="min-w-0 text-right text-sm font-medium text-neutral-900">{children}</dd>
    </div>
  );
}

/** A band / Wired count that toggles the toolbar's band filter (other clients fade out). */
function FilterRow({ label, count, active, indent, onClick }: {
  label: string; count: number; active: boolean; indent?: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={`${label}: ${count} clients. ${active ? "Showing only these; click to show all." : "Click to show only these clients."}`}
      onClick={onClick}
      className={cn(
        "flex w-full items-baseline justify-between gap-4 rounded-md px-1.5 py-0.5 text-left",
        indent && "pl-5",
        active ? "bg-blue-50 ring-1 ring-blue-600" : "hover:bg-neutral-100"
      )}
    >
      <span className={cn("text-xs", active ? "font-medium text-blue-700" : "text-blue-600")}>{label}</span>
      <span className="text-sm font-medium tabular-nums text-neutral-900">{count}</span>
    </button>
  );
}

function capturedLabel(iso: string): string {
  const d = new Date(iso);
  const mins = Math.max(0, Math.round((Date.now() - d.getTime()) / 60_000));
  const ago = mins < 1 ? "just now" : mins < 60 ? `${mins} min ago` : `${Math.round(mins / 60)} h ago`;
  return `${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} (${ago})`;
}

/** The open drawer's content: status, gateway, APs by model, clients by WiFi band / wired. */
export function NetworkSummaryBody({ summary, capturedAt, filters, onFiltersChange }: {
  summary: NetworkSummary;
  capturedAt: string | null;
  filters: ClientFilters;
  onFiltersChange: (f: ClientFilters) => void;
}) {
  const { gateway, aps, clients } = summary;
  const toggleBand = (b: Band) => onFiltersChange({
    ...filters,
    bands: filters.bands.includes(b) ? filters.bands.filter((x) => x !== b) : [...filters.bands, b],
  });
  const bands = SUMMARY_BANDS.filter((b) => clients.bands[b] > 0);
  const offline = aps.total - aps.online;

  return (
    <div className="space-y-3 px-3.5 pb-3.5 pt-1">
      <div className="flex flex-wrap items-center gap-2">
        {gateway && <StatusPill tone={gateway.online ? "good" : "poor"}>{gateway.online ? "Online" : "Offline"}</StatusPill>}
        {capturedAt && <span className="text-xs text-neutral-500" title={capturedAt}>data {capturedLabel(capturedAt)}</span>}
      </div>

      <dl className="space-y-1.5 border-t border-neutral-100 pt-3">
        {gateway && <Row label="Gateway">{gateway.model || "—"}</Row>}
        {gateway?.firmware && <Row label="Firmware"><span className="break-all text-xs">{gateway.firmware}</span></Row>}
        <Row label="Access points">
          <span className="tabular-nums">{aps.total}</span>
          <span className={cn("ml-1 text-xs font-normal", offline ? "text-amber-700" : "text-neutral-500")}>
            · {offline ? `${aps.online} online, ${offline} offline` : "all online"}
          </span>
        </Row>
        <dd className="space-y-0.5 text-right text-xs text-neutral-700">
          {aps.models.map((m) => (
            <span key={`${m.gateway}:${m.model}`} className="block">
              {m.count} × {m.model}{m.gateway && <span className="text-neutral-500"> (gateway)</span>}
            </span>
          ))}
        </dd>
      </dl>

      <dl className="space-y-1 border-t border-neutral-100 pt-3">
        <Row label="Clients online"><span className="tabular-nums">{clients.total}</span></Row>
        <div className="flex items-baseline justify-between gap-4 px-1.5">
          <dt className="text-xs text-neutral-500">WiFi</dt>
          <dd className="text-sm font-medium tabular-nums text-neutral-900">{clients.wifi}</dd>
        </div>
        {bands.map((b) => (
          <FilterRow key={b} label={b} count={clients.bands[b]} indent active={filters.bands.includes(b)} onClick={() => toggleBand(b)} />
        ))}
        {clients.mlo > 0 && (
          <p className="pl-5 text-[11px] text-neutral-500">{clients.mlo} multi-link (MLO), counted on one band</p>
        )}
        <FilterRow label="Wired" count={clients.wired} active={filters.bands.includes("Wired")} onClick={() => toggleBand("Wired")} />
      </dl>
      <p className="text-[11px] text-neutral-500">Click a band or Wired to show only those clients on the diagram.</p>
    </div>
  );
}
