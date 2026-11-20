"use client";

import { cn } from "@/web/lib/utils";
import { GATEWAY_KINDS, GATEWAY_KIND_META, pct, type GatewayKind } from "@/web/lib/homeApStats";
import { GATEWAY_COLOR } from "./gatewayColors";

/**
 * Share of homes by the type of their primary gateway: one 100% bar (segments labelled when wide
 * enough) over a legend whose rows filter the table.
 */
export function GatewayMixBar({ byKind, total, selected, onSelect }: {
  byKind: Record<GatewayKind, number>;
  total: number;
  selected: GatewayKind | null;
  onSelect: (k: GatewayKind | null) => void;
}) {
  const kinds = GATEWAY_KINDS.filter((k) => byKind[k] > 0);
  return (
    <div className="space-y-3">
      <div className="flex h-9 w-full gap-[2px] overflow-hidden rounded-lg" role="img"
        aria-label={kinds.map((k) => `${GATEWAY_KIND_META[k].label} ${byKind[k]} (${pct(byKind[k], total)})`).join(", ")}>
        {kinds.map((k) => {
          const share = total ? byKind[k] / total : 0;
          return (
            <button
              key={k} type="button" onClick={() => onSelect(selected === k ? null : k)}
              title={`${GATEWAY_KIND_META[k].label}: ${byKind[k].toLocaleString()} homes (${pct(byKind[k], total)})`}
              style={{ width: `${share * 100}%`, backgroundColor: GATEWAY_COLOR[k] }}
              className={cn(
                "flex min-w-[3px] items-center justify-center overflow-hidden text-xs font-semibold transition-opacity",
                k === "beacon" || k === "ont" ? "text-white" : "text-neutral-900",
                selected && selected !== k && "opacity-30",
              )}
            >
              {share >= 0.08 && <span className="truncate px-1 tabular-nums">{pct(byKind[k], total)}</span>}
            </button>
          );
        })}
      </div>

      <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {kinds.map((k) => (
          <li key={k}>
            <button
              type="button" onClick={() => onSelect(selected === k ? null : k)} title={GATEWAY_KIND_META[k].hint}
              aria-pressed={selected === k}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-neutral-50",
                selected === k && "bg-blue-50 ring-1 ring-blue-600",
              )}
            >
              <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: GATEWAY_COLOR[k] }} />
              <span className="min-w-0 flex-1 truncate text-neutral-700">{GATEWAY_KIND_META[k].label}</span>
              <span className="font-semibold tabular-nums text-neutral-900">{byKind[k].toLocaleString()}</span>
              <span className="w-12 text-right text-xs tabular-nums text-neutral-500">{pct(byKind[k], total)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
