"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import type { McpAccessPoint, McpNetwork } from "@/web/lib/mcpNetwork";
import { osmUrl } from "@/web/lib/networkLocation";
import { DetailSection } from "./DetailParts";
import { CanvasOverlayFrame, useCanvasOverlay } from "./CanvasOverlay";
import { LocationCheck, type LocationSource } from "./LocationCheck";
import { compareLocations, useGatewayLocation } from "./useGatewayLocation";
import type { MapView } from "@/web/components/map/LocationMap";

// MapLibre is only downloaded when a gateway or WAN panel opens.
const LocationMap = dynamic(() => import("@/web/components/map/LocationMap").then((m) => m.LocationMap), {
  ssr: false,
  loading: () => <div className="h-56 animate-pulse rounded-xl bg-neutral-100" />,
});

/**
 * Gateway / WAN panel "Location": mini-map of the home (one marker, as on the fleet Network Map).
 * Corteca's stored position is checked against Corteca's Autodetect (read-only); when they differ
 * the panel flags it and the map shows the detected position (switchable) — in this view only.
 * A click on the map (or its expand button) opens it over the diagram area at the same view, where
 * it zooms and drags freely and the marker's card lists the access points; × or Esc puts it back.
 */
export function GatewayLocation({ network, gateway }: { network: McpNetwork; gateway: McpAccessPoint }) {
  const { stored, detected, busy, reload } = useGatewayLocation(gateway.mac, network.capturedAt);
  const [source, setSource] = useState<LocationSource>("detected");
  const view = useRef<MapView | null>(null);
  useEffect(() => { setSource("detected"); }, [gateway.mac]);

  const cmp = compareLocations(stored, detected);
  const storedLoc = stored && stored !== "error" ? stored : null;
  const detectedLoc = detected && detected !== "error" ? detected : null;
  // Our view: the detected position when it differs from Corteca's (unless switched back).
  const showDetected = !!cmp?.differs && !!detectedLoc && (source === "detected" || !storedLoc);
  const loc = showDetected ? detectedLoc : storedLoc;
  // A moved marker (other gateway, detected ↔ stored) opens the map centred on it, not at the old
  // view; reset while rendering, since the map reads `view` when it is created in its own effect.
  const locKey = loc ? `${gateway.mac}|${loc.lat},${loc.lng}` : "";
  const lastLocKey = useRef(locKey);
  if (lastLocKey.current !== locKey) { lastLocKey.current = locKey; view.current = null; }

  const overlay = useCanvasOverlay();
  const setOpen = overlay?.setOpen;
  const expand = setOpen ? () => setOpen(true) : undefined;
  const collapse = useCallback(() => setOpen?.(false), [setOpen]);
  // Leaving the panel closes the expanded map.
  useEffect(() => collapse, [collapse]);

  const aps = network.aps.map((a) => ({
    id: a.mac, label: a.nickname ?? (a.role === "root" ? a.model : `${a.model} · ${a.mac.slice(-5)}`), model: a.model, online: a.online, isRoot: a.role === "root", clients: a.clientCount,
  }));

  return (
    <DetailSection
      title="Location"
      summary={cmp?.differs ? "Differs from Corteca's Autodetect" : loc ? "Map of the home, from the gateway's Corteca summary" : "No location from Corteca"}
      actions={<LocationRefresh busy={busy} onClick={reload} />}
    >
      {stored === undefined && <div className="h-56 animate-pulse rounded-xl bg-neutral-100" />}
      {stored !== undefined && <LocationCheck stored={stored} detected={detected} source={source} onSource={setSource} />}
      {stored === "error" && !loc && <p className="text-xs text-neutral-500">Location unavailable: Corteca didn&apos;t return the device summary.</p>}
      {stored === null && !loc && <p className="text-xs text-neutral-500">Corteca has no location for this gateway.</p>}
      {loc && stored !== undefined && (
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
              {showDetected ? "Position from Corteca's Autodetect (this view only)." : "Position stored in Corteca."}
              {aps.length > 1 && ` ${aps.length} access points at the gateway's address.`}
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

/** Re-reads Corteca's stored position and re-runs Autodetect. */
function LocationRefresh({ busy, onClick }: { busy: boolean; onClick: () => void }) {
  return (
    <button
      type="button" onClick={onClick} disabled={busy}
      aria-label="Refresh location" title="Check the location with Corteca again"
      className="rounded-lg p-1 text-blue-600 hover:bg-blue-50 disabled:text-neutral-400 disabled:hover:bg-transparent"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={busy ? "animate-spin" : undefined}>
        <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />
      </svg>
    </button>
  );
}
