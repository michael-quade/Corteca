"use client";

import type { DeviceMarker } from "@/app/api/network-map/locate/route";
import type { NetworkDeviceInfo } from "@/app/api/network-map/device-info/[mac]/route";
import { StatusPill } from "@/web/components/corteca/StatusPill";

const CONSOLE_BASE = process.env.NEXT_PUBLIC_CORTECA_CONSOLE_URL ?? "https://console.demo2.homewifi.nokia.com";

function consoleUrl(mac: string): string {
  return `${CONSOLE_BASE}/home-troubleshooting/dashboard?mac=${mac.toUpperCase().replace(/:/g, "-")}`;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="text-right text-sm font-medium text-neutral-900">{children}</dd>
    </div>
  );
}

const Skeleton = () => <span className="inline-block h-3 w-14 animate-pulse rounded bg-neutral-200 align-middle" />;

/** Network card shown over the map: hover previews it, click pins it (with a close button). */
export function FleetMapPopup({ device, details, pinned, onClose }: {
  device: DeviceMarker;
  details: NetworkDeviceInfo | null | undefined;   // undefined = loading, null = couldn't load
  pinned: boolean;
  onClose: () => void;
}) {
  const name = device.accountName || device.customerId || device.mac;
  const sub = device.accountName && device.customerId ? device.customerId : device.mac;

  return (
    <div className="w-64 p-4 font-sans">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-neutral-900">{name}</p>
          {sub !== name && <p className="truncate text-xs text-neutral-500">{sub}</p>}
        </div>
        {pinned && (
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-1 -mt-1 rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        )}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <StatusPill tone={device.online ? "good" : "poor"}>{device.online ? "Online" : "Offline"}</StatusPill>
        {device.country && <span className="text-xs text-neutral-500">{device.country}</span>}
      </div>

      <dl className="mt-3 space-y-1.5 border-t border-neutral-100 pt-3">
        {device.model && <Row label="Gateway">{device.model}</Row>}
        {device.firmware && <Row label="Firmware"><span className="text-xs">{device.firmware}</span></Row>}
        <Row label="Access points">
          {details === undefined ? <Skeleton /> : details && details.aps.length > 0
            ? details.aps.map((a) => <span key={a.model} className="block">{a.count > 1 ? `${a.count} × ` : ""}{a.model}</span>)
            : "—"}
        </Row>
        <Row label="Clients">{details === undefined ? <Skeleton /> : details ? details.clientCount : "—"}</Row>
      </dl>

      <a
        href={consoleUrl(device.mac)} target="_blank" rel="noopener noreferrer"
        className="mt-4 flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
      >
        Launch Corteca Console
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M5 2H2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V7" /><path d="M8 1h3v3M11 1 6 6" />
        </svg>
      </a>
    </div>
  );
}
