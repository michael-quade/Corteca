import type { Map as MlMap, ExpressionSpecification } from "maplibre-gl";
import type { DeviceMarker } from "@/app/api/network-map/locate/route";

export const SOURCE = "networks";
export const LAYER = {
  clusterHalo: "net-cluster-halo",
  clusters: "net-clusters",
  clusterCount: "net-cluster-count",
  selected: "net-selected",
  points: "net-points",
} as const;

// Tailwind colours used across the app
const ONLINE  = "#10b981"; // emerald-500
const OFFLINE = "#ef4444"; // red-500
const SELECT  = "#2563eb"; // blue-600
const TEXT    = "#262626"; // neutral-800

export function toFeatureCollection(devices: DeviceMarker[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: devices.map((d) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [d.lng, d.lat] },
      properties: { mac: d.mac, online: d.online },
    })),
  };
}

/** Network points, grouped into clusters that count their offline networks (red ring if any). */
export function addNetworkLayers(map: MlMap) {
  map.addSource(SOURCE, {
    type: "geojson",
    data: toFeatureCollection([]),
    cluster: true,
    clusterRadius: 44,
    clusterMaxZoom: 12,
    clusterProperties: { offline: ["+", ["case", ["get", "online"], 0, 1]] },
  });

  const isCluster: ExpressionSpecification = ["has", "point_count"];
  const clusterRadius: ExpressionSpecification = ["step", ["get", "point_count"], 15, 10, 18, 100, 22, 1000, 27];

  map.addLayer({
    id: LAYER.clusterHalo, type: "circle", source: SOURCE, filter: isCluster,
    paint: {
      "circle-radius": ["+", clusterRadius, 7],
      "circle-color": ["case", [">", ["get", "offline"], 0], OFFLINE, ONLINE],
      "circle-opacity": 0.16,
      "circle-blur": 0.4,
    },
  });
  map.addLayer({
    id: LAYER.clusters, type: "circle", source: SOURCE, filter: isCluster,
    paint: {
      "circle-radius": clusterRadius,
      "circle-color": "#ffffff",
      "circle-stroke-width": 3,
      "circle-stroke-color": ["case", [">", ["get", "offline"], 0], OFFLINE, ONLINE],
    },
  });
  map.addLayer({
    id: LAYER.clusterCount, type: "symbol", source: SOURCE, filter: isCluster,
    layout: {
      "text-field": ["get", "point_count_abbreviated"],
      "text-font": ["Noto Sans Bold"],
      "text-size": 12,
      "text-allow-overlap": true,
    },
    paint: { "text-color": TEXT },
  });

  // Zoom expressions can't be nested, so the selection ring gets its own curve (point + 6 px).
  const pointRadius = (extra = 0): ExpressionSpecification => ["interpolate", ["linear"], ["zoom"], 2, 5 + extra, 8, 6.5 + extra, 14, 8 + extra];
  map.addLayer({
    id: LAYER.selected, type: "circle", source: SOURCE,
    filter: ["==", ["get", "mac"], ""],
    paint: {
      "circle-radius": pointRadius(6),
      "circle-color": SELECT,
      "circle-opacity": 0.15,
      "circle-stroke-width": 2,
      "circle-stroke-color": SELECT,
    },
  });
  map.addLayer({
    id: LAYER.points, type: "circle", source: SOURCE, filter: ["!", isCluster],
    paint: {
      "circle-radius": pointRadius(),
      "circle-color": ["case", ["get", "online"], ONLINE, OFFLINE],
      "circle-stroke-width": 2,
      "circle-stroke-color": "#ffffff",
    },
  });
}

/** Rings the selected network in blue (none when mac is null). */
export function setSelected(map: MlMap, mac: string | null) {
  map.setFilter(LAYER.selected, ["==", ["get", "mac"], mac ?? ""]);
}
