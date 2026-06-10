# Project Guidelines

## What This App Is

**Corteca Vibe Project** — a Next.js 14 internal dashboard that wraps the Nokia Corteca Home Controller (HomeWifi Edge) API. It gives operators a browser-based UI to search subscribers, visualize home networks, inspect devices, run fleet reports, monitor alarms, and track software deployments — all without using the raw API or the Nokia Corteca Console directly.

The app runs on Vercel (or any Node host) and acts as a secure proxy: all Nokia API calls happen server-side (Next.js API routes), so credentials never reach the browser.

---

## Application Features

### Pages & Routes

| Route | Feature | Description |
|---|---|---|
| `/` | Login | Full-screen landing page with Nokia background image. Authenticates against the Corteca API. |
| `/gate` | Site Gate | A separate username/password gate (SITE_USERNAME / SITE_PASSWORD env vars) that protects the entire app before Corteca login. Runs as a simple cookie check in middleware. |
| `/dashboard` | Dashboard | Card grid linking to all features. |
| `/devices` | Device Search | Search subscribers by name, email, MAC, UUID, or serial. Shows all devices on their home network with status, model, and IP. |
| `/network-visualizer` | Home Network Visualizer | Search a subscriber, then renders: interactive D3 topology graph, Leaflet map pin, ethernet port panels per AP (with live/config/spec fallback), and a raw API debug panel. Includes a "Launch Corteca Console" button linked to the gateway MAC. |
| `/network-map` | Global Network Map | Leaflet map of every managed network in the fleet, clustered by location. Color-coded online/offline. Sidebar with deployment stats, search, and per-network detail panel. |
| `/reports` | Performance Reports Hub | Card grid of all available report types. |
| `/reports/[reportType]` | Performance Report | Fetches a specific report type, renders a Recharts bar chart + sortable/filterable table. Account names are enriched via batch lookups. Report types: reboot, congestion, noise, new-devices, coverage, cloud-disconnections, claim, backhaul-quality. |
| `/reboot-report` | Reboot Report | Dedicated page for the reboot report with its own chart and table. |
| `/sw-overview` | Beacon SW Overview | Heatmap matrix of active Beacon firmware versions across the fleet by model. Drilldown modal per cell, unknown firmware list, deployment report table. |
| `/device-browser` | Device Data Model Browser | USP TR-369 data model explorer. Search for a device by MAC, browse the full parameter tree, set parameters via modal with confirmation. |
| `/alarms` | Network Alarms | Query the ouife fault manager for open alarms by date range, severity (critical/major/minor/clear), optional device MAC, and alarm type (standard vs. custom). Results in a sortable table with severity filter chips and per-row Corteca Console launch button. |
| `/api-usage` | API Usage Dashboard | Live stats on Corteca API calls, bytes sent/received, rate limit hits for the current session. Persisted per-session in PostgreSQL via Prisma. |

---

## Authentication Architecture (Two-Tier)

### Tier 1 — Site Gate
- Route: `/gate` → `POST /api/gate`
- Env vars: `SITE_USERNAME`, `SITE_PASSWORD`
- Sets an `httpOnly` cookie `site_auth` (base64 of user:pass)
- Middleware checks this cookie before allowing any page access
- Protects the entire app from public access; separate from Corteca credentials

### Tier 2 — Corteca API Login
- Route: `/` → `POST /api/auth/login`
- Authenticates against `${CORTECA_API_BASE_URL}/auth/token` using `X-Service-Type: KC` header + `clientId`/`clientSecret` headers + `{ email, grant_type: 'password', password }` body
- Sets three cookies: `corteca_token` (access, httpOnly), `corteca_refresh_token` (httpOnly), `corteca_email` (client-readable for display)
- `AuthContext` provides `isAuthenticated`, `login()`, `logout()`, `refreshSession()` to all client components
- `fetchWithAuth` client helper fires a `corteca:session-expired` DOM event on 401, triggering `ReloginModal`
- Username field is plain text (not email type) — Corteca usernames are not always email addresses

---

## API Route Conventions

All Corteca API calls are **server-side only** in `app/api/` routes. Never call the Nokia API from the browser.

### cortecaFetch
Use `cortecaFetch` (not raw `fetch`) for all upstream Nokia API calls:
```ts
import { cortecaFetch } from '@/web/lib/corteca/cortecaFetch';

const res = await cortecaFetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }, 30_000);
```
- Wraps fetch with a configurable timeout (default 20s)
- Tracks API stats (call count, bytes sent/received, rate limit hits) in memory via `apiStats.ts`
- Stats are persisted to PostgreSQL `ApiSession` table on session end

### GET Request Headers
**Never send `Content-Type` on bodyless GET requests.** Some Nokia API gateways (ouife) return `417 Expectation Failed` if `Content-Type` is present with no body. Use only `Authorization` and `Accept` headers on GETs.

### ouife Microservice
- All ouife paths end with `/ouifeapi` suffix (e.g. `GET /ouife/alarms/details/ouifeapi`)
- The `isCustomAlarm` parameter is effectively required on the alarms endpoint — default to `False` for standard system alarms. Omitting it causes a `417` response.
- ouife returns `{ count, alarmsDetailsList: [...] }` — the normaliser in `app/api/alarms/route.ts` handles multiple possible wrapper key names.

### Auth Token
Every API route reads the token from:
```ts
const token = req.cookies.get('corteca_token')?.value;
```

---

## Corteca Console URL Pattern

To link to the Corteca Home Controller console for a specific device:
```ts
const CONSOLE_BASE = process.env.NEXT_PUBLIC_CORTECA_CONSOLE_URL ?? "https://console.demo2.homewifi.nokia.com";

function consoleUrl(mac: string): string {
  return `${CONSOLE_BASE}/home-troubleshooting/dashboard?mac=${mac.toUpperCase().replace(/:/g, "-")}`;
}
```
MACs from the API are colon-separated lowercase (`aa:bb:cc:dd:ee:ff`). The console expects uppercase hyphen-separated (`AA-BB-CC-DD-EE-FF`).

---

## Data Layer (Prisma + PostgreSQL)

Uses Prisma with a Supabase PostgreSQL database. Three models:

| Model | Purpose |
|---|---|
| `SwMatrix` | Singleton (id=1). Stores the Beacon firmware release matrix: `beaconModels` (JSON array) and `releases` (JSON array). Seeded via `prisma/seed.js`. |
| `DeploymentReport` | Singleton (id=1). Cached deployment report: device list, column headers, raw rows, stats, USP map. Updated when SW Overview fetches fresh data. |
| `ApiSession` | One row per login session. Tracks call count, bytes sent/received, rate limit hits. Used by the API Usage dashboard. |

### Database Commands
```bash
npm run db:push       # push schema to DB (uses DIRECT_URL)
npm run db:generate   # regenerate Prisma client
npm run db:studio     # open Prisma Studio
npm run seed-matrix   # seed initial SW matrix data
```

---

## Environment Variables

All required. Copy `.env.example` to `.env.local` to get started.

| Variable | Description |
|---|---|
| `CORTECA_API_BASE_URL` | Nokia API base URL (e.g. `https://l1api.demo2.homewifi.nokia.com`) |
| `CORTECA_CLIENT_ID` | Corteca OAuth client ID (sent as header, not query param) |
| `CORTECA_CLIENT_SECRET` | Corteca OAuth client secret (sent as header) |
| `NEXT_PUBLIC_CORTECA_CONSOLE_URL` | Nokia Console base URL — public, safe for browser (e.g. `https://console.demo2.homewifi.nokia.com`) |
| `DATABASE_URL` | Pooled PostgreSQL URI (PgBouncer port 6543) — used by the app at runtime |
| `DIRECT_URL` | Direct PostgreSQL URI (port 5432) — used only by `prisma db push` and seed scripts |
| `SITE_USERNAME` | Gate username protecting the entire app |
| `SITE_PASSWORD` | Gate password |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 3 — utility classes only, `cn()` for conditionals |
| UI Components | Radix UI (Dialog, Popover, Tabs, Slot) |
| Charts | Recharts |
| Maps | Leaflet + react-leaflet (loaded via `next/dynamic` with `ssr: false`) |
| ORM | Prisma 5 |
| Database | PostgreSQL (Supabase) |
| Auth | Custom cookie-based (no NextAuth) |
| Deployment | Vercel (serverless) |

**Prohibited:** Material UI, Emotion, Styled Components, `@apply` in CSS (except global base styles).

---

## Key Libraries

- **`clsx` + `tailwind-merge`** → combined as `cn()` in `web/lib/utils.ts` for safe conditional class merging
- **`recharts`** → all charts (bar, area). Import only what's needed.
- **`leaflet` + `react-leaflet`** → maps. Always load with `next/dynamic` + `ssr: false`. Import Leaflet CSS in the component.
- **`@radix-ui/react-dialog`** → all modals. Never build modals inline in page files.
- **`xlsx`** → Excel export in the SW Overview deployment report table
- **`@prisma/client`** → database access, server-side only

---

## Component Architecture & Decomposition

- **Modularization Rule:** DO NOT create single component files exceeding 300 lines.
- **Mandatory Extraction:** If a component contains a Modal, Table, or Form, that sub-component MUST be extracted into its own file.
- **No Inline Modals:** Never define modal content within a page or parent component file.
- **No Alerts:** When making a simple confirmation or notification alert, make it into a modal using a standard confirm modal window.

## File Structure

- **Modals:** `web/components/modals/[ModalName].tsx`
- **Tables:** `web/components/tables/[TableName].tsx`
- **Pages:** `app/[route]/page.tsx` — high-level layout and data-fetching only; UI details delegated to components
- **API Routes:** `app/api/[resource]/route.ts` — proxy calls to Nokia API, never expose credentials
- **Shared lib:** `web/lib/` — utilities, type definitions, Corteca API client modules
- **Contexts:** `web/contexts/` — React context providers (AuthContext, ApiStatsContext)

## Component Naming

- **Files:** PascalCase for all component files (e.g., `UserTable.tsx`)
- **Exports:** Named exports for all components
- **Props:** Define component props in a matching `.types.ts` file if they exceed 5 properties

## Styling Patterns

- Use utility classes directly in `className`
- Use `cn()` (Tailwind Merge + CLSX) for conditional classes
- Avoid `@apply` in CSS files unless creating a global base style

---

## Table Conventions

All data tables must:
- Use `min-w-max w-full` on the `<table>` so all columns render without squishing
- Use `overflow-auto max-h-[60vh]` on the scroll container so the `<thead>` can be `sticky top-0`
- Use `bg-neutral-100` (not transparent) on the sticky header row with `shadow-[0_1px_0_0_#e5e7eb]` separator
- Use `bg-white` on body rows with `hover:bg-neutral-50`

---

## Building From Scratch

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env.local
# Fill in all variables

# 3. Push DB schema and seed
npm run db:push
npm run seed-matrix

# 4. Run dev server
npm run dev

# 5. Build for production
npm run build
npm run start
```

**Prerequisites:** Node 18+, PostgreSQL (Supabase recommended), Nokia Corteca API credentials (base URL, client ID, client secret).
