import type { Map as MlMap, GeoJSONSource, ExpressionSpecification } from "maplibre-gl";
import { ONLINE, OFFLINE, SELECT, TEXT, pointRadius } from "./fleetMapStyle";

/** One home network on the location map, drawn exactly like the fleet Network Map draws networks:
 *  a status dot for a single access point, a white count bubble (green ring, red if any AP is
 *  offline) when the home has Beacons too — all at the gateway's address, the only one known. */
export const HOME_SOURCE = "home";
export const HOME_LAYER = {
  halo: "home-halo",
  bubble: "home-bubble",
  count: "home-count",
  selected: "home-selected",
  point: "home-point",
} as const;
export const HOME_HIT_LAYERS = [HOME_LAYER.bubble, HOME_LAYER.point];

export interface HomeFeature { lat: number; lng: number; aps: number; offline: number; online: boolean; pinned: boolean }

function collection(h: HomeFeature | null): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: h ? [{
      type: "Feature",
      geometry: { type: "Point", coordinates: [h.lng, h.lat] },
      properties: { aps: h.aps, offline: h.offline, online: h.online, pinned: h.pinned },
    }] : [],
  };
}

const BUBBLE = 15;   // the fleet map's smallest group bubble (fewer than 10)
const isGroup: ExpressionSpecification = [">", ["get", "aps"], 1];
const ring: ExpressionSpecification = ["case", [">", ["get", "offline"], 0], OFFLINE, ONLINE];

export function addHomeLayers(map: MlMap) {
  map.addSource(HOME_SOURCE, { type: "geojson", data: collection(null) });
  map.addLayer({
    id: HOME_LAYER.halo, type: "circle", source: HOME_SOURCE, filter: isGroup,
    paint: { "circle-radius": BUBBLE + 7, "circle-color": ring, "circle-opacity": 0.16, "circle-blur": 0.4 },
  });
  // Pinned card: blue ring around the dot or the bubble, as on the fleet map.
  map.addLayer({
    id: HOME_LAYER.selected, type: "circle", source: HOME_SOURCE, filter: ["get", "pinned"],
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, ["case", isGroup, BUBBLE + 6, 11], 14, ["case", isGroup, BUBBLE + 6, 14]],
      "circle-color": SELECT, "circle-opacity": 0.15, "circle-stroke-width": 2, "circle-stroke-color": SELECT,
    },
  });
  map.addLayer({
    id: HOME_LAYER.bubble, type: "circle", source: HOME_SOURCE, filter: isGroup,
    paint: { "circle-radius": BUBBLE, "circle-color": "#ffffff", "circle-stroke-width": 3, "circle-stroke-color": ring },
  });
  map.addLayer({
    id: HOME_LAYER.count, type: "symbol", source: HOME_SOURCE, filter: isGroup,
    layout: { "text-field": ["to-string", ["get", "aps"]], "text-font": ["Noto Sans Bold"], "text-size": 12, "text-allow-overlap": true },
    paint: { "text-color": TEXT },
  });
  map.addLayer({
    id: HOME_LAYER.point, type: "circle", source: HOME_SOURCE, filter: ["!", isGroup],
    paint: {
      "circle-radius": pointRadius(),
      "circle-color": ["case", ["get", "online"], ONLINE, OFFLINE],
      "circle-stroke-width": 2, "circle-stroke-color": "#ffffff",
    },
  });
}

export function setHome(map: MlMap, h: HomeFeature) {
  (map.getSource(HOME_SOURCE) as GeoJSONSource | undefined)?.setData(collection(h));
}
