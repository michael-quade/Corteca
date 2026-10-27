// Copies MapLibre's web worker into public/ so the browser can load it.
// MapLibre 6 loads its worker from a URL next to its own module, which Next's
// bundler doesn't emit; web/lib/mapBasemap.ts points setWorkerUrl() at this copy.
// Runs on postinstall (locally and on Vercel); the copy is gitignored.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const dist = dirname(require.resolve("maplibre-gl/package.json")) + "/dist";
const out = join(process.cwd(), "public", "maplibre");
mkdirSync(out, { recursive: true });
copyFileSync(join(dist, "maplibre-gl-worker.mjs"), join(out, "maplibre-gl-worker.mjs"));
console.log("Copied maplibre-gl-worker.mjs to public/maplibre/");
