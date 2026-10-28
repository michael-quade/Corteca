"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { createPortal } from "react-dom";
import { Map as MlMap, Popup } from "maplibre-gl";
import { STYLE_URL, tintBasemap, MAP_FRAME } from "@/web/lib/mapBasemap";
import { cn } from "@/web/lib/utils";
import type { LatLng } from "@/web/lib/networkLocation";
import { MapZoomButtons } from "./MapZoomButtons";
import { HomeNetworkCard, type LocationAp } from "./HomeNetworkCard";
import { HOME_HIT_LAYERS, addHomeLayers, setHome } from "./homeMapStyle";

const ZOOM = 16;

/** Centre and zoom, shared between two maps of the same place (a small one and its expanded view). */
export type MapView = { center: [number, number]; zoom: number };

/**
 * The home network at the gateway's location, drawn like the fleet Network Map: one status dot, or a
 * count bubble when the home also has Beacons (only the gateway's location is known, so Beacons aren't
 * spread around it). Hover shows the home's card with every access point; click pins it.
 * `compact` (side panel): no card, legend or zoom buttons, Ctrl/⌘ + scroll to zoom so the panel still
 * scrolls, and no attribution control: the caller must show the map credit (OpenStreetMap, OpenFreeMap,
 * OpenMapTiles). `onMapClick`: any click on the map (not a drag). `view`: start from it, and keep it updated.
 */
export function LocationMap({ location, aps, className, compact = false, onMapClick, view }: {
  location: LatLng;
  aps: LocationAp[];
  className: string;
  compact?: boolean;
  onMapClick?: () => void;
  view?: MutableRefObject<MapView | null>;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const mapRef   = useRef<MlMap | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const [popupEl] = useState(() => (typeof document !== "undefined" ? document.createElement("div") : null));
  const [ready, setReady] = useState(false);
  const [card, setCard]   = useState<"hover" | "pinned" | null>(null);
  const cardRef = useRef(card);
  cardRef.current = card;
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;
  const { lat, lng } = location;

  useEffect(() => {
    if (!mountRef.current) return;
    const map = new MlMap({
      container: mountRef.current,
      style: STYLE_URL,
      center: view?.current?.center ?? [lng, lat],
      zoom: view?.current?.zoom ?? ZOOM,
      // Compact maps credit the data in their caption: the control covered the map there.
      attributionControl: compact ? false : { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
      cooperativeGestures: compact,
    });
    map.touchZoomRotate.disableRotation();
    mapRef.current = map;
    map.on("load", () => { tintBasemap(map); addHomeLayers(map); setReady(true); });

    const onHome = (e: { point: { x: number; y: number } }) =>
      map.queryRenderedFeatures([e.point.x, e.point.y], { layers: HOME_HIT_LAYERS }).length > 0;
    for (const layer of HOME_HIT_LAYERS) {
      map.on("mouseenter", layer, () => {
        map.getCanvas().style.cursor = "pointer";
        if (!compact && cardRef.current !== "pinned") setCard("hover");
      });
      map.on("mouseleave", layer, () => {
        map.getCanvas().style.cursor = "";
        if (cardRef.current === "hover") setCard(null);
      });
    }
    // Full map: a click on the home pins its card, on empty map closes it.
    map.on("click", (e) => {
      if (!compact) setCard(onHome(e) ? "pinned" : null);
      onMapClickRef.current?.();
    });
    if (view) map.on("moveend", () => { const c = map.getCenter(); view.current = { center: [c.lng, c.lat], zoom: map.getZoom() }; });
    if (!compact && popupEl) {
      popupRef.current = new Popup({ closeButton: false, closeOnClick: false, offset: 22, maxWidth: "none" }).setDOMContent(popupEl);
    }
    return () => { popupRef.current?.remove(); popupRef.current = null; map.remove(); mapRef.current = null; setReady(false); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, compact]);

  const apCount = aps.length;
  const offline = aps.filter((a) => !a.online).length;
  const gatewayOnline = (aps.find((a) => a.isRoot) ?? aps[0])?.online ?? false;
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    setHome(map, { lat, lng, aps: Math.max(1, apCount), offline, online: gatewayOnline, pinned: card === "pinned" });
  }, [ready, lat, lng, apCount, offline, gatewayOnline, card]);

  useEffect(() => {
    const map = mapRef.current, popup = popupRef.current;
    if (!ready || !map || !popup) return;
    if (card) { popup.setLngLat([lng, lat]); if (!popup.isOpen()) popup.addTo(map); }
    else popup.remove();
  }, [ready, card, lat, lng]);

  const recenter = () => mapRef.current?.easeTo({ center: [lng, lat], zoom: ZOOM, duration: 500 });

  return (
    <div className={cn(MAP_FRAME, className)}>
      <div ref={mountRef} className="h-full w-full" />
      {!compact && (
        <>
          <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-lg border border-neutral-200 bg-white/95 px-3 py-2 text-[11px] text-neutral-600 shadow-sm">
            <p className="mb-1 font-semibold text-neutral-700">{apCount} access point{apCount === 1 ? "" : "s"} at the gateway&apos;s address</p>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />Online</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />Offline</span>
              {apCount > 1 && (
                <span className="flex items-center gap-1.5">
                  <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-emerald-500 bg-white text-[7px] font-bold text-neutral-800">{apCount}</span>
                  APs (red ring if any offline)
                </span>
              )}
            </div>
          </div>
          <MapZoomButtons
            onZoomIn={() => mapRef.current?.zoomIn({ duration: 250 })}
            onZoomOut={() => mapRef.current?.zoomOut({ duration: 250 })}
            onFit={recenter}
            fitLabel="Back to the network"
          />
        </>
      )}
      {card && popupEl && createPortal(
        <HomeNetworkCard aps={aps} pinned={card === "pinned"} onClose={() => setCard(null)} />,
        popupEl,
      )}
    </div>
  );
}
