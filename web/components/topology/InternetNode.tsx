"use client";

import { Handle, type NodeProps } from "@xyflow/react";
import { cn } from "@/web/lib/utils";
import { NET_H, NET_W, type InternetFlowNode } from "@/web/lib/topologyFlow";
import { wanConnected } from "@/web/lib/wanInfo";
import { HIDDEN_HANDLE, handleLayout, isSelected, useTopologyUi } from "./TopologyContext";

export function GlobeGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 0 20M12 2a15.3 15.3 0 0 0 0 20" />
    </svg>
  );
}

/** The Internet, above the gateway; its status comes from the gateway's WAN interface. */
export function InternetNode({ data }: NodeProps<InternetFlowNode>) {
  const { gateway, wan } = data;
  const ui = useTopologyUi();
  const selected = isSelected(ui, "wan", gateway.mac);
  const handles = handleLayout(ui.layout);
  const info = wan && wan !== "error" ? wan : null;
  const up = info ? wanConnected(info) : null;
  const status = wan === undefined ? "Checking…" : !info ? "Status unknown" : up ? "Connected" : info.connection ?? info.status;
  // The gateway's WAN IPv4; Corteca's public IP (often a long IPv6) when it isn't known.
  const ip = info?.ipv4 || gateway.wanIp;

  return (
    <div
      role="button"
      aria-pressed={selected}
      aria-label={`Internet: ${status}`}
      onClick={() => ui.select(selected ? null : { kind: "wan", id: gateway.mac })}
      style={{ width: NET_W, height: NET_H }}
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-xl border border-neutral-200 bg-white px-3 shadow-sm transition-shadow hover:shadow-md",
        selected && "border-violet-500 ring-2 ring-violet-500/40"
      )}
    >
      <Handle type="target" position={handles.target} style={handles.style} className={HIDDEN_HANDLE} />
      <span
        className={cn(
          "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 ring-2 ring-offset-2",
          up === true ? "ring-emerald-500" : up === false ? "ring-red-500" : "ring-neutral-300"
        )}
        title={status}
      >
        <GlobeGlyph />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Internet</p>
        <p className={cn("truncate text-sm font-semibold", up === false ? "text-red-700" : "text-neutral-900")}>{status}</p>
        {ip && <p className="truncate font-mono text-[11px] text-neutral-500" title={info?.ipv4 ? "WAN IP address" : "Public IP"}>{ip}</p>}
      </div>
      <Handle type="source" position={handles.source} style={handles.style} className={HIDDEN_HANDLE} />
    </div>
  );
}
