"use client";

import * as Popover from "@radix-ui/react-popover";
import { cn } from "@/web/lib/utils";
import type { Member } from "@/web/lib/corteca/types";
import type { ConnectedAp } from "@/web/lib/memberConnection";
import type { DisconnectedMember } from "@/web/lib/recentlyDisconnected";
import { timeAgo } from "@/web/lib/recentlyDisconnected";
import { disconnectReason } from "@/web/lib/clientInsights";
import { StatusPill } from "@/web/components/corteca/StatusPill";

// Pieces of NetworkMembersTable: cells and the per-column filter popover.

/** Name + MAC, a Paused pill when parental controls paused it, other MACs it was seen under. */
export function DeviceCell({ m }: { m: DisconnectedMember }) {
  const others = m.otherMacs?.length ?? 0;
  return (
    <td className="px-4 py-3">
      <p className="flex items-center gap-2 font-medium text-neutral-900">
        {m.alias ?? "—"}
        {m.paused && <StatusPill tone="fair">Paused</StatusPill>}
      </p>
      <p className="mt-0.5 font-mono text-xs text-neutral-400">{m.id}</p>
      {others > 0 && (
        <p className="mt-0.5 text-xs text-neutral-500" title={m.otherMacs!.join(", ")}>
          +{others} older randomized MAC{others === 1 ? "" : "s"}
        </p>
      )}
    </td>
  );
}

/** Nickname (or model) on top; model, gateway tag and MAC below. */
export function ConnectedApCell({ ap }: { ap: ConnectedAp | null }) {
  if (!ap) return <td className="px-4 py-3 text-neutral-400">—</td>;
  const sub = [ap.name && ap.model, ap.gateway && "Gateway"].filter(Boolean).join(" · ");
  return (
    <td className="px-4 py-3">
      <p className="font-medium text-neutral-900">{ap.name ?? (ap.model || "Unknown AP")}</p>
      <p className="mt-0.5 text-xs text-neutral-500">
        {sub && `${sub} · `}<span className="font-mono">{ap.mac}</span>
      </p>
    </td>
  );
}

/** "3 h ago" with the date on hover, and why it last disconnected. */
export function LastSeenCell({ m }: { m: Member }) {
  const reason = disconnectReason(m);
  const t = Date.parse(m.last_seen ?? "");
  return (
    <td className="px-4 py-3">
      <p className="text-neutral-700" title={Number.isFinite(t) ? new Date(t).toLocaleString() : undefined}>{timeAgo(m.last_seen)}</p>
      {reason && <p className="mt-0.5 text-xs text-neutral-500">{reason}</p>}
    </td>
  );
}


interface FilterPopoverProps {
  value: string;
  onChange: (v: string) => void;
  active: boolean;
}

export function FilterPopover({ value, onChange, active }: FilterPopoverProps) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          title="Filter"
          className={cn(
            "rounded p-0.5 transition-colors hover:bg-neutral-200",
            active ? "text-blue-600" : "text-neutral-400 hover:text-neutral-600"
          )}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M1 2h10L7 6.5V10.5L5 9.5V6.5L1 2Z" />
          </svg>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={4}
          className={cn(
            "z-50 min-w-[180px] rounded-md border border-neutral-200 bg-white p-2 shadow-md",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          )}
        >
          <p className="mb-1.5 text-xs font-medium text-neutral-500">Filter</p>
          <input
            autoFocus
            type="text"
            placeholder="Type to filter…"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={cn(
              "w-full rounded border border-neutral-200 px-2 py-1.5 text-sm",
              "placeholder:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-1"
            )}
          />
          {value && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="mt-1.5 w-full rounded px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
            >
              Clear filter
            </button>
          )}
          <Popover.Arrow className="fill-neutral-200" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
