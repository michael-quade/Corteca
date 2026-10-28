"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { createPortal } from "react-dom";
import { Map as MlMap, Marker } from "maplibre-gl";
import { STYLE_URL, tintBasemap, MAP_FRAME } from "@/web/lib/mapBasemap";
import { cn } from "@/web/lib/utils";
import type { LatLng } from "@/web/lib/networkLocation";
import { MapZoomButtons } from "./MapZoomButtons";
import { ApMapPin, ApMapCard, type LocationAp } from "./ApMapPin";

// Only the gateway's location is known, so Beacons are drawn at screen offsets around it
// (clear of the gateway's chip). Zooming out shrinks the offsets with the map, as if the
// Beacons were in the house; once they'd crowd the gateway they fold into its chip ("+3 Beacons").
function beaconOffset(i: number, n: number, compact: boolean): [number, number] {
  // Full map: below and to the sides. Compact (side panel): an arc below, so chips fit the width.
  const [from, span, rx, ry] = compact ? [25, 130, 95, 70] : [-20, 220, 150, 95];
  const deg = n === 1 ? 90 : from + (span * i) / (n - 1);
  const rad = (deg * Math.PI) / 180;
  return [Math.round(rx * Math.cos(rad)), Math.round(ry * Math.sin(rad))];
}

const ZOOM = 17;
const offsetScale = (zoom: number) => Math.min(1, 2 ** (zoom - ZOOM));
const FOLD_SCALE = 0.6;   // below this (about zoom 16.3) Beacons fold into the gateway chip

/** Centre and zoom, shared between two maps of the same place (a small one and its expanded view). */
export type MapView = { center: [number, number]; zoom: number };

/**
 * The gateway pinned at its location with its Beacons around it, as name chips (status, clients).
 * Without `onPinClick` a click opens the AP's card on the map; with it the page handles selection.
 * `compact` (side panel): no zoom buttons, Ctrl/⌘ + scroll to zoom so the panel still scrolls, and no
 * attribution control: the caller must show the map credit (OpenStreetMap, OpenFreeMap, OpenMapTiles).
 * `onMapClick`: a click on the map itself (not a pin or a drag). `view`: start from it, and keep it updated.
 */
export function LocationMap({ location, aps, className, compact = false, selectedId, onPinClick, onMapClick, view }: {
  location: LatLng;
  aps: LocationAp[];
  className: string;
  compact?: boolean;
  selectedId?: string | null;
  onPinClick?: (id: string) => void;
  onMapClick?: () => void;
  view?: MutableRefObject<MapView | null>;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const mapRef   = useRef<MlMap | null>(null);
  const [ready, setReady]   = useState(false);
  const [pins, setPins]     = useState(new Map<string, HTMLDivElement>());
  const [ownSel, setOwnSel] = useState<string | null>(null);
  const [folded, setFolded] = useState(false);
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;
  const { lat, lng } = location;
  const selected = onPinClick ? selectedId ?? null : ownSel;
  const apKey = aps.map((a) => `${a.id}:${a.isRoot ? 1 : 0}`).join(",");

  useEffect(() => {
    if (!mountRef.current) return;
    const map = new MlMap({
      container: mountRef.current,
      style: STYLE_URL,
      center: view?.current?.center ?? [lng, lat],
      zoom: view?.current?.zoom ?? ZOOM,
      // Compact maps credit the data in their caption: the control covered the Beacons there.
      attributionControl: compact ? false : { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
      cooperativeGestures: compact,
    });
    map.touchZoomRotate.disableRotation();
    mapRef.current = map;
    map.on("load", () => { tintBasemap(map); setReady(true); });
    // A click on the map (not on a pin) clears the map's own selection.
    map.on("click", (e) => {
      if ((e.originalEvent.target as HTMLElement | null)?.closest(".maplibregl-marker")) return;
      setOwnSel(null);
      onMapClickRef.current?.();
    });
    if (view) map.on("moveend", () => { const c = map.getCenter(); view.current = { center: [c.lng, c.lat], zoom: map.getZoom() }; });
    return () => { map.remove(); mapRef.current = null; setReady(false); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, compact]);

  // One marker per AP; their content is rendered into the marker elements with portals.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const beacons = aps.filter((a) => !a.isRoot);
    const markers: Marker[] = [];
    const placed: { marker: Marker; el: HTMLDivElement; offset: [number, number] }[] = [];
    const els = new Map<string, HTMLDivElement>();
    for (const ap of aps) {
      const el = document.createElement("div");
      const marker = new Marker({ element: el, anchor: "bottom" }).setLngLat([lng, lat]).addTo(map);
      markers.push(marker);
      if (ap.isRoot || aps.length === 1) el.style.zIndex = "1";
      else placed.push({ marker, el, offset: beaconOffset(beacons.indexOf(ap), beacons.length, compact) });
      els.set(ap.id, el);
    }
    const place = () => {
      const f = offsetScale(map.getZoom());
      for (const { marker, el, offset } of placed) {
        marker.setOffset([offset[0] * f, offset[1] * f]);
        el.style.display = f < FOLD_SCALE ? "none" : "";
      }
      setFolded(placed.length > 0 && f < FOLD_SCALE);
    };
    place();
    map.on("zoom", place);
    setPins(els);
    return () => { map.off("zoom", place); for (const m of markers) m.remove(); setPins(new Map()); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, apKey, lat, lng, compact]);

  const recenter = () => mapRef.current?.easeTo({ center: [lng, lat], zoom: ZOOM, duration: 500 });
  const card = !onPinClick ? aps.find((a) => a.id === ownSel) : undefined;

  return (
    <div className={cn(MAP_FRAME, className)}>
      <div ref={mountRef} className="h-full w-full" />
      {!compact && (
        <MapZoomButtons
          onZoomIn={() => mapRef.current?.zoomIn({ duration: 250 })}
          onZoomOut={() => mapRef.current?.zoomOut({ duration: 250 })}
          onFit={recenter}
          fitLabel="Back to the network"
        />
      )}
      {card && (
        <div className="absolute left-3 top-3 z-10 rounded-xl bg-white shadow-lg ring-1 ring-black/5">
          <ApMapCard node={card} clients={card.clients} onClose={() => setOwnSel(null)} />
        </div>
      )}
      {aps.map((ap) => {
        const el = pins.get(ap.id);
        return el ? createPortal(
          <ApMapPin
            node={ap}
            clients={ap.clients}
            selected={ap.id === selected}
            folded={ap.isRoot && folded ? aps.length - 1 : 0}
            // A folded gateway chip zooms back in to show its Beacons.
            onSelect={() => {
              if (ap.isRoot && folded) recenter();
              else if (onPinClick) onPinClick(ap.id);
              else setOwnSel((s) => (s === ap.id ? null : ap.id));
            }}
          />,
          el,
          ap.id,
        ) : null;
      })}
    </div>
  );
}
