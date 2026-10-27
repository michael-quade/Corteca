"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Map as MlMap, Marker } from "maplibre-gl";
import type { NetworkTopologyData } from "./NetworkTopologyMap";
import { buildTree, flatNodes } from "@/web/lib/networkTopology";
import { filterConnectedDevices } from "@/web/lib/networkMembers";
import { STYLE_URL, tintBasemap, MAP_FRAME } from "@/web/lib/mapBasemap";
import { MapZoomButtons } from "@/web/components/map/MapZoomButtons";
import { ApMapPin, ApMapCard } from "@/web/components/map/ApMapPin";

// ── Location extraction ───────────────────────────────────────────────────────

function extractLatLng(summary: unknown): { lat: number; lng: number } | null {
  if (!summary || typeof summary !== "object") return null;
  const s = summary as Record<string, unknown>;
  const n = (v: unknown) => { const x = Number(v); return isNaN(x) ? undefined : x; };

  let lat = n(s.latitude ?? s.lat ?? s.Latitude);
  let lng = n(s.longitude ?? s.lng ?? s.lon ?? s.Longitude);

  if (lat === undefined || lng === undefined) {
    const loc = s.location ?? s.coordinates ?? s.gps ?? s.address;
    if (loc && typeof loc === "object") {
      const l = loc as Record<string, unknown>;
      lat = n(l.latitude ?? l.lat);
      lng = n(l.longitude ?? l.lng ?? l.lon);
    }
  }

  if (lat === undefined || lng === undefined || (lat === 0 && lng === 0)) return null;
  return { lat, lng };
}

// Only the gateway's location is known, so Beacons are pinned at fixed screen offsets
// around it (below and to the sides, clear of the gateway's chip) at any zoom.
function beaconOffset(i: number, n: number): [number, number] {
  const deg = n === 1 ? 90 : -20 + (220 * i) / (n - 1);
  const rad = (deg * Math.PI) / 180;
  return [Math.round(150 * Math.cos(rad)), Math.round(95 * Math.sin(rad))];
}

const ZOOM = 17;

// ── Component ─────────────────────────────────────────────────────────────────

interface Props { data: NetworkTopologyData }

export function NetworkMap({ data }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const mapRef   = useRef<MlMap | null>(null);
  const [ready, setReady]       = useState(false);
  const [pins, setPins]         = useState(new Map<string, HTMLDivElement>());
  const [selected, setSelected] = useState<string | null>(null);

  const location = extractLatLng(data.summary);
  const lat = location?.lat, lng = location?.lng;

  const apNodes = useMemo(
    () => flatNodes(buildTree(data.topology, data.networks, data.mesh, data.configs ?? {}, data.rootDeviceId)),
    [data.topology, data.networks, data.mesh, data.configs, data.rootDeviceId],
  );
  const clientsPerAp = useMemo(() => {
    const m = new Map<string, number>(apNodes.map((n) => [n.id, 0]));
    for (const d of filterConnectedDevices(data.members)) m.set(d.apId, (m.get(d.apId) ?? 0) + 1);
    return m;
  }, [apNodes, data.members]);
  const apKey = apNodes.map((n) => `${n.id}:${n.isRoot ? 1 : 0}`).join(",");

  useEffect(() => {
    if (!mountRef.current || lat === undefined || lng === undefined) return;
    const map = new MlMap({
      container: mountRef.current,
      style: STYLE_URL,
      center: [lng, lat],
      zoom: ZOOM,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
    });
    map.touchZoomRotate.disableRotation();
    mapRef.current = map;
    map.on("load", () => { tintBasemap(map); setReady(true); });
    // A click on the map (not on a pin) clears the selection.
    map.on("click", (e) => {
      if (!(e.originalEvent.target as HTMLElement | null)?.closest(".maplibregl-marker")) setSelected(null);
    });
    return () => { map.remove(); mapRef.current = null; setReady(false); };
  }, [lat, lng]);

  // One marker per AP; their content is rendered into the marker elements with portals.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || lat === undefined || lng === undefined) return;
    const beacons = apNodes.filter((n) => !n.isRoot);
    const markers: Marker[] = [];
    const els = new Map<string, HTMLDivElement>();
    for (const node of apNodes) {
      const el = document.createElement("div");
      const offset = node.isRoot || apNodes.length === 1 ? [0, 0] : beaconOffset(beacons.indexOf(node), beacons.length);
      markers.push(new Marker({ element: el, anchor: "bottom", offset: offset as [number, number] }).setLngLat([lng, lat]).addTo(map));
      if (node.isRoot) el.style.zIndex = "1";
      els.set(node.id, el);
    }
    setPins(els);
    return () => { for (const m of markers) m.remove(); setPins(new Map()); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, apKey, lat, lng]);

  if (!location) {
    return (
      <div className="flex h-[480px] xl:h-[800px] items-center justify-center rounded-xl bg-[#f5f7fa] text-sm text-neutral-500 ring-1 ring-neutral-200">
        No location data available for this network.
      </div>
    );
  }

  const selectedNode = apNodes.find((n) => n.id === selected);

  return (
    <div className={`${MAP_FRAME} h-[480px] xl:h-[800px]`}>
      <div ref={mountRef} className="h-full w-full" />
      <MapZoomButtons
        onZoomIn={() => mapRef.current?.zoomIn({ duration: 250 })}
        onZoomOut={() => mapRef.current?.zoomOut({ duration: 250 })}
        onFit={() => mapRef.current?.easeTo({ center: [location.lng, location.lat], zoom: ZOOM, duration: 500 })}
        fitLabel="Back to the network"
      />
      {selectedNode && (
        <div className="absolute left-3 top-3 z-10 rounded-xl bg-white shadow-lg ring-1 ring-black/5">
          <ApMapCard node={selectedNode} clients={clientsPerAp.get(selectedNode.id) ?? 0} onClose={() => setSelected(null)} />
        </div>
      )}
      {apNodes.map((node) => {
        const el = pins.get(node.id);
        return el ? createPortal(
          <ApMapPin
            node={node}
            clients={clientsPerAp.get(node.id) ?? 0}
            selected={node.id === selected}
            onSelect={() => setSelected((s) => (s === node.id ? null : node.id))}
          />,
          el,
          node.id,
        ) : null;
      })}
    </div>
  );
}
