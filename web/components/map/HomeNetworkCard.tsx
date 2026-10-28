"use client";

import { StatusPill } from "@/web/components/corteca/StatusPill";
import { cn } from "@/web/lib/utils";

/** An access point of the home on a location map (the gateway, or a Beacon in the same house). */
export interface LocationAp { id: string; label: string; model: string; online: boolean; isRoot: boolean; clients: number }

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="min-w-0 text-right text-sm font-medium text-neutral-900">{children}</dd>
    </div>
  );
}

/** The home's card over the map, laid out like the fleet Network Map's card (FleetMapPopup):
 *  hover previews it, click pins it. Lists every access point with status and client count. */
export function HomeNetworkCard({ aps, pinned, onClose }: { aps: LocationAp[]; pinned: boolean; onClose: () => void }) {
  const gateway = aps.find((a) => a.isRoot) ?? aps[0];
  if (!gateway) return null;
  const ordered = [gateway, ...aps.filter((a) => a !== gateway)];
  const clients = aps.reduce((n, a) => n + a.clients, 0);
  const mac = gateway.id.toUpperCase().replace(/:/g, "-");

  return (
    <div className="w-64 p-4 font-sans">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-neutral-900">Home network</p>
          <p className="truncate text-xs text-neutral-500">{mac}</p>
        </div>
        {pinned && (
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-1 -mt-1 rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        )}
      </div>

      <div className="mt-2">
        <StatusPill tone={gateway.online ? "good" : "poor"}>{gateway.online ? "Online" : "Offline"}</StatusPill>
      </div>

      <dl className="mt-3 space-y-1.5 border-t border-neutral-100 pt-3">
        {gateway.model && <Row label="Gateway">{gateway.model}</Row>}
        <Row label="Clients">{clients}</Row>
      </dl>

      <p className="mt-3 border-t border-neutral-100 pt-3 text-xs text-neutral-500">
        {aps.length} access point{aps.length === 1 ? "" : "s"} at this address
      </p>
      <ul className="mt-1.5 space-y-1">
        {ordered.map((a) => (
          <li key={a.id} className="flex items-center gap-2 text-sm">
            <span className={cn("h-2 w-2 flex-shrink-0 rounded-full", a.online ? "bg-emerald-500" : "bg-red-500")} />
            <span className="min-w-0 truncate font-medium text-neutral-900">{a.label}</span>
            {a.isRoot && <span className="flex-shrink-0 text-[10px] font-semibold text-neutral-500">Gateway</span>}
            <span className="flex-1" />
            <span className="flex-shrink-0 text-xs tabular-nums text-neutral-500">{a.clients} client{a.clients === 1 ? "" : "s"}</span>
          </li>
        ))}
      </ul>
      {aps.length > 1 && <p className="mt-2 text-[11px] text-neutral-400">Only the gateway&apos;s location is known; Beacons are in the same home.</p>}
    </div>
  );
}
