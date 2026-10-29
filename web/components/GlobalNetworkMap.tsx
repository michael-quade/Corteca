"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Map as MlMap, Popup, LngLatBounds, type GeoJSONSource, type MapLayerMouseEvent } from "maplibre-gl";
import type { DeviceMarker } from "@/app/api/network-map/locate/route";
import type { NetworkDeviceInfo } from "@/app/api/network-map/device-info/[mac]/route";
import { fetchWithAuth } from "@/web/lib/fetchWithAuth";
import { STYLE_URL, tintBasemap, MAP_FRAME } from "@/web/lib/mapBasemap";
import { SOURCE, LAYER, addNetworkLayers, toFeatureCollection, setSelected } from "@/web/components/map/fleetMapStyle";
import { FleetMapPopup } from "@/web/components/map/FleetMapPopup";
import { FleetMapOverlay } from "@/web/components/map/FleetMapOverlay";

interface Props {
  devices: DeviceMarker[];
  progress: number;
  flyToTarget?: { lat: number; lng: number } | null;
  resetViewTrigger?: number;
  onPopupClose?: () => void;
}

interface Open { device: DeviceMarker; pinned: boolean }

const FIT = { padding: 56, maxZoom: 10 };

export function GlobalNetworkMap({ devices, progress, flyToTarget, resetViewTrigger, onPopupClose }: Props) {
  const mountRef    = useRef<HTMLDivElement>(null);
  const mapRef      = useRef<MlMap | null>(null);
  const popupRef    = useRef<Popup | null>(null);
  const [popupEl]   = useState(() => (typeof document !== "undefined" ? document.createElement("div") : null));
  const [ready, setReady] = useState(false);
  const [open, setOpen]   = useState<Open | null>(null);
  const openRef     = useRef<Open | null>(null);
  const byMacRef    = useRef(new Map<string, DeviceMarker>());
  const userMovedRef = useRef(false);   // stop auto-fitting once the user has moved the map
  const [details, setDetails] = useState(new Map<string, NetworkDeviceInfo | null>());
  const onPopupCloseRef = useRef(onPopupClose);
  onPopupCloseRef.current = onPopupClose;

  const show = useCallback((next: Open | null) => {
    const map = mapRef.current, popup = popupRef.current;
    const prev = openRef.current;
    openRef.current = next;
    setOpen(next);
    if (!map || !popup) return;
    setSelected(map, next?.pinned ? next.device.mac : null);
    if (next) {
      popup.setLngLat([next.device.lng, next.device.lat]);
      if (!popup.isOpen()) popup.addTo(map);
    } else {
      popup.remove();
    }
    if (prev?.pinned && (!next || next.device.mac !== prev.device.mac)) onPopupCloseRef.current?.();
  }, []);

  useEffect(() => {
    if (!mountRef.current || !popupEl) return;
    const map = new MlMap({
      container: mountRef.current,
      style: STYLE_URL,
      center: [10, 20],
      zoom: 1.5,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
    });
    map.touchZoomRotate.disableRotation();
    mapRef.current = map;
    popupRef.current = new Popup({ closeButton: false, closeOnClick: false, offset: 14, maxWidth: "none" }).setDOMContent(popupEl);

    map.on("load", () => {
      tintBasemap(map);
      addNetworkLayers(map);
      setReady(true);
    });

    const deviceAt = (e: MapLayerMouseEvent) => byMacRef.current.get(String(e.features?.[0]?.properties?.mac ?? ""));
    map.on("mouseenter", LAYER.points, (e) => {
      map.getCanvas().style.cursor = "pointer";
      const d = deviceAt(e);
      if (d && !openRef.current?.pinned) show({ device: d, pinned: false });
    });
    map.on("mouseleave", LAYER.points, () => {
      map.getCanvas().style.cursor = "";
      if (openRef.current && !openRef.current.pinned) show(null);
    });
    map.on("click", LAYER.points, (e) => {
      const d = deviceAt(e);
      if (d) show({ device: d, pinned: true });
    });
    map.on("mouseenter", LAYER.clusters, () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", LAYER.clusters, () => { map.getCanvas().style.cursor = ""; });
    map.on("click", LAYER.clusters, async (e) => {
      const f = e.features?.[0];
      if (!f || f.geometry.type !== "Point") return;
      const zoom = await (map.getSource(SOURCE) as GeoJSONSource).getClusterExpansionZoom(f.properties.cluster_id);
      map.easeTo({ center: f.geometry.coordinates as [number, number], zoom: zoom + 0.5, duration: 500 });
    });
    // A click on empty map closes a pinned card.
    map.on("click", (e) => {
      if (map.queryRenderedFeatures(e.point, { layers: [LAYER.points, LAYER.clusters] }).length === 0 && openRef.current) show(null);
    });
    map.on("movestart", (e) => { if ((e as { originalEvent?: Event }).originalEvent) userMovedRef.current = true; });

    return () => {
      popupRef.current?.remove();
      map.remove();
      mapRef.current = null; popupRef.current = null;
      setReady(false);
    };
  }, [popupEl, show]);

  const fitAll = useCallback((duration = 600) => {
    const map = mapRef.current;
    const all = [...byMacRef.current.values()];
    if (!map || all.length === 0) return;
    const bounds = all.reduce((b, d) => b.extend([d.lng, d.lat]), new LngLatBounds([all[0].lng, all[0].lat], [all[0].lng, all[0].lat]));
    map.fitBounds(bounds, { ...FIT, duration });
  }, []);

  // Plot networks as they're located; keep fitting them in view until the user moves the map.
  useEffect(() => {
    byMacRef.current = new Map(devices.map((d) => [d.mac, d]));
    const map = mapRef.current;
    if (!ready || !map) return;
    (map.getSource(SOURCE) as GeoJSONSource).setData(toFeatureCollection(devices));
    if (devices.length === 0) { userMovedRef.current = false; show(null); return; }
    if (!userMovedRef.current) fitAll(devices.length === byMacRef.current.size && progress >= 100 ? 600 : 0);
    // Names arrive after locating: keep the open card's network current.
    // A card for a network the region filter now hides closes.
    const cur = openRef.current;
    if (cur) {
      const d = byMacRef.current.get(cur.device.mac);
      if (!d) show(null); else if (d !== cur.device) show({ ...cur, device: d });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devices, ready]);

  useEffect(() => {
    if (!flyToTarget || !mapRef.current) return;
    userMovedRef.current = true;
    mapRef.current.flyTo({ center: [flyToTarget.lng, flyToTarget.lat], zoom: 13, duration: 1200 });
  }, [flyToTarget]);

  useEffect(() => {
    if (!resetViewTrigger) return;
    userMovedRef.current = false;
    fitAll();
  }, [resetViewTrigger, fitAll]);

  // Load AP / client counts for the open card (cached per network).
  const openMac = open?.device.mac;
  useEffect(() => {
    if (!openMac || details.has(openMac)) return;
    let cancelled = false;
    void fetchWithAuth(`/api/network-map/device-info/${encodeURIComponent(openMac)}`)
      .then(async (r) => (r.ok ? (await r.json()) as NetworkDeviceInfo : null))
      .catch(() => null)
      .then((info) => { if (!cancelled) setDetails((m) => new Map(m).set(openMac, info)); });
    return () => { cancelled = true; };
  }, [openMac, details]);

  // Re-anchor the card once its details have loaded and it has grown.
  useEffect(() => {
    const popup = popupRef.current;
    if (popup?.isOpen()) popup.setLngLat(popup.getLngLat());
  }, [details]);

  return (
    <div
      className={`${MAP_FRAME} h-[600px]`}
    >
      <div ref={mountRef} className="h-full w-full" />
      <FleetMapOverlay
        count={devices.length}
        onZoomIn={() => mapRef.current?.zoomIn({ duration: 250 })}
        onZoomOut={() => mapRef.current?.zoomOut({ duration: 250 })}
        onFit={() => { userMovedRef.current = false; fitAll(); }}
      />
      {progress < 100 && (
        <div className="absolute inset-x-0 bottom-0 z-10 h-1 bg-neutral-200/60">
          <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      )}
      {open && popupEl && createPortal(
        <FleetMapPopup
          device={open.device}
          details={details.has(open.device.mac) ? details.get(open.device.mac) : undefined}
          pinned={open.pinned}
          onClose={() => show(null)}
        />,
        popupEl,
      )}
    </div>
  );
}
