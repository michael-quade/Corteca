import { setWorkerUrl, getVersion, type Map as MlMap } from "maplibre-gl";

// Shared MapLibre setup for the fleet Network Map and the REST visualizer's
// location map. Browser-only: import it from components loaded with ssr: false.

// MapLibre 6 loads its worker from a separate file that Next doesn't bundle; it is
// copied to public/ on postinstall (scripts/copy-maplibre-worker.mjs).
if (typeof window !== "undefined") {
  setWorkerUrl(new URL(`/maplibre/maplibre-gl-worker.mjs?v=${getVersion()}`, window.location.origin).href);
}

// OpenFreeMap: free OpenStreetMap vector tiles, no key or usage cap. Positron is
// its muted grey style; tintBasemap() moves it onto the Corteca palette.
export const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

const LABEL = "#525252";   // neutral-600
const BASEMAP: [layer: string, property: string, value: string][] = [
  ["background", "background-color", "#f5f7fa"],
  ["water", "fill-color", "#dbe5f1"],
  ["waterway", "line-color", "#c9d7ea"],
  ["park", "fill-color", "#e9eef0"],
  ["landcover_wood", "fill-color", "#e6ebee"],
  ["landuse_residential", "fill-color", "#eef1f4"],
  ["building", "fill-color", "#e4e8ee"],
  ["boundary_2", "line-color", "#c3c9d2"],
  ["boundary_3", "line-color", "#d4d9e0"],
  ["boundary_disputed", "line-color", "#c3c9d2"],
  ["water_name_point_label", "text-color", "#6b84ad"],
  ["water_name_line_label", "text-color", "#6b84ad"],
  ...["label_country_1", "label_country_2", "label_country_3", "label_state", "label_city",
      "label_city_capital", "label_town", "label_village", "label_other"]
    .map((id) => [id, "text-color", LABEL] as [string, string, string]),
];

/** Recolours the Positron basemap to the Corteca palette (grey ground, soft blue water, grey labels). */
export function tintBasemap(map: MlMap) {
  for (const [id, prop, value] of BASEMAP) {
    if (map.getLayer(id)) map.setPaintProperty(id, prop as Parameters<MlMap["setPaintProperty"]>[1], value);
  }
}

/** Map frame: rounded, hairline ring, and Corteca-style popup cards (MapLibre puts popups inside the map). */
export const MAP_FRAME =
  "relative isolate overflow-hidden rounded-xl bg-[#f5f7fa] ring-1 ring-neutral-200 " +
  "[&_.maplibregl-popup-content]:rounded-xl [&_.maplibregl-popup-content]:p-0 [&_.maplibregl-popup-content]:shadow-lg " +
  "[&_.maplibregl-popup-content]:ring-1 [&_.maplibregl-popup-content]:ring-black/5";
