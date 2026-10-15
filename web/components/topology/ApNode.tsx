"use client";

import { Handle, type NodeProps } from "@xyflow/react";
import { cn } from "@/web/lib/utils";
import { AP_H, AP_W, type ApFlowNode } from "@/web/lib/topologyFlow";
import { HIDDEN_HANDLE, handleLayout, isSelected, useTopologyUi } from "./TopologyContext";

function GatewayGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="13" width="20" height="8" rx="2" />
      <path d="M6 17h.01M10 17h.01M12 9a4 4 0 0 1 4 4M12 5a8 8 0 0 1 8 8" />
    </svg>
  );
}

function BeaconGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="14" r="2" />
      <path d="M8.5 10.5a5 5 0 0 1 7 0M5.5 7.5a9 9 0 0 1 13 0" />
    </svg>
  );
}

export function ApNode({ data }: NodeProps<ApFlowNode>) {
  const { ap } = data;
  const isRoot = ap.role === "root";
  const ui = useTopologyUi();
  const selected = isSelected(ui, "ap", ap.mac);
  const handles = handleLayout(ui.layout);

  return (
    <div
      role="button"
      aria-pressed={selected}
      aria-label={`${ap.name} ${ap.model} ${ap.mac}`}
      style={{ width: AP_W, height: AP_H }}
      className={cn(
        "relative flex cursor-pointer items-center gap-3 rounded-xl border bg-white px-3 shadow-sm transition-shadow hover:shadow-md",
        ap.online ? "border-neutral-200" : "border-dashed border-neutral-300 opacity-60",
        selected && "border-violet-500 ring-2 ring-violet-500/40"
      )}
    >
      <Handle type="target" position={handles.target} style={handles.style} className={HIDDEN_HANDLE} />

      <div
        className={cn(
          "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full ring-2 ring-offset-2",
          isRoot ? "bg-blue-50 text-blue-600" : "bg-indigo-50 text-indigo-600",
          ap.online ? "ring-emerald-500" : "ring-neutral-300"
        )}
        title={ap.online ? "Online" : "Offline"}
      >
        {isRoot ? <GatewayGlyph /> : <BeaconGlyph />}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
          {ap.name}{ap.online ? "" : " · Offline"}
        </p>
        <p className="truncate text-sm font-semibold text-neutral-900" title={ap.model}>{ap.model}</p>
        <p className="truncate font-mono text-[11px] text-neutral-500" title={`Firmware ${ap.firmware}`}>
          {ap.firmware || ap.mac}
        </p>
      </div>

      <span
        className="absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-neutral-900 px-1.5 text-[11px] font-semibold text-white shadow"
        title={`${ap.clientCount} connected clients`}
      >
        {ap.clientCount}
      </span>

      <Handle type="source" position={handles.source} style={handles.style} className={HIDDEN_HANDLE} />
    </div>
  );
}
