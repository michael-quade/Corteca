"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchWithAuth } from "@/web/lib/fetchWithAuth";
import type { McpAccessPoint, McpNetwork } from "@/web/lib/mcpNetwork";
import { osmUrl, type LatLng } from "@/web/lib/networkLocation";
import { DetailSection } from "./DetailParts";
import { CanvasOverlayFrame, useCanvasOverlay } from "./CanvasOverlay";
import type { MapView } from "@/web/components/map/LocationMap";

// MapLibre is only downloaded when a gateway or WAN panel opens.
const LocationMap = dynamic(() => import("@/web/components/map/LocationMap").then((m) => m.LocationMap), {
  ssr: false,
  loading: () => <div className="h-56 animate-pulse rounded-xl bg-neutral-100" />,
});

// Per gateway, for the page's lifetime: null = Corteca has no position, "error" = couldn't read it.
const cache = new Map<string, Promise<LatLng | null | "error">>();

function readLocation(mac: string): Promise<LatLng | null | "error"> {
  let p = cache.get(mac);
  if (!p) {
    p = fetchWithAuth(`/api/network/${encodeURIComponent(mac)}/location`)
      .then(async (r) => (r.ok ? ((await r.json()) as { location: LatLng | null }).location : "error" as const))
      .catch(() => "error" as const);
    p.then((v) => { if (v === "error") cache.delete(mac); });
    cache.set(mac, p);
  }
  return p;
}

/**
 * Gateway / WAN panel "Location": mini-map of the home (one marker, as on the fleet Network Map).
 * A click on the map (or its expand button) opens it over the diagram area at the same view, where
 * it zooms and drags freely and the marker's card lists the access points; × or Esc puts it back.
 */
export function GatewayLocation({ network, gateway }: { network: McpNetwork; gateway: McpAccessPoint }) {
  const [loc, setLoc] = useState<LatLng | null | "error" | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    setLoc(undefined);
    void readLocation(gateway.mac).then((v) => { if (!cancelled) setLoc(v); });
    return () => { cancelled = true; };
  }, [gateway.mac]);

  const overlay = useCanvasOverlay();
  const view = useRef<MapView | null>(null);
  const setOpen = overlay?.setOpen;
  const expand = setOpen ? () => setOpen(true) : undefined;
  const collapse = useCallback(() => setOpen?.(false), [setOpen]);
  // A new gateway starts at its own view; leaving the panel closes the expanded map.
  useEffect(() => { view.current = null; }, [gateway.mac]);
  useEffect(() => collapse, [collapse]);

  const aps = network.aps.map((a) => ({
    id: a.mac, label: a.nickname ?? (a.role === "root" ? a.model : `${a.model} · ${a.mac.slice(-5)}`), model: a.model, online: a.online, isRoot: a.role === "root", clients: a.clientCount,
  }));

  return (
    <DetailSection title="Location" summary={loc && loc !== "error" ? "Map of the home, from the gateway's Corteca summary" : "No location from Corteca"}>
      {loc === undefined && <div className="h-56 animate-pulse rounded-xl bg-neutral-100" />}
      {loc === "error" && <p className="text-xs text-neutral-500">Location unavailable: Corteca didn&apos;t return the device summary.</p>}
      {loc === null && <p className="text-xs text-neutral-500">Corteca has no location for this gateway.</p>}
      {loc && loc !== "error" && (
        <>
          <div className="relative">
            <LocationMap
              location={loc} aps={aps} compact className={expand ? "h-56 cursor-zoom-in" : "h-56"}
              onMapClick={expand}
              view={view}
            />
            {expand && (
              <button
                type="button" onClick={expand} aria-label="Expand map" title="Expand the map over the diagram"
                className="absolute right-2 top-2 z-10 rounded-lg border border-neutral-200 bg-white p-1.5 text-neutral-600 shadow-sm hover:bg-neutral-100 hover:text-neutral-900"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                </svg>
              </button>
            )}
          </div>
          {overlay?.open && (
            <CanvasOverlayFrame kicker="Location" title={aps.find((a) => a.isRoot)?.label ?? "Gateway"} onClose={collapse}>
              {/* Full map: zoom buttons, plain scroll zoom; the marker's card lists the access points. */}
              <LocationMap location={loc} aps={aps} className="h-full rounded-none ring-0" view={view} />
            </CanvasOverlayFrame>
          )}
          <p className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-2 text-[11px] text-neutral-400">
            <span>
              {aps.length > 1 ? `${aps.length} access points at the gateway's address.` : "The gateway's address."}
              {expand && " Click the map to expand it."}
            </span>
            <a href={osmUrl(loc)} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap font-medium text-blue-600 hover:underline">
              Open in OpenStreetMap ↗
            </a>
          </p>
          {/* The compact map has no attribution control (it covered the Beacons), so credit the data here. */}
          <p className="mt-0.5 text-[10px] text-neutral-400">
            Map © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="hover:underline">OpenStreetMap</a> contributors
            · <a href="https://openfreemap.org" target="_blank" rel="noopener noreferrer" className="hover:underline">OpenFreeMap</a>
            · <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener noreferrer" className="hover:underline">OpenMapTiles</a>
          </p>
        </>
      )}
    </DetailSection>
  );
}
