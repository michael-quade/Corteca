# Project Guidelines

## What This App Is

**Corteca Vibe Project** — a Next.js 14 internal dashboard that wraps the Nokia Corteca Home Controller (HomeWifi Edge) API. It gives operators a browser-based UI to search subscribers, visualize home networks, inspect devices, run fleet reports, monitor alarms, and track software deployments — all without using the raw API or the Nokia Corteca Console directly.

The app runs on Vercel (or any Node host) and acts as a secure proxy: all Nokia API calls happen server-side (Next.js API routes), so credentials never reach the browser.

---

## Application Features

### Pages & Routes

| Route | Feature | Description |
|---|---|---|
| `/` | Login | Full-screen landing page with Nokia background image. Authenticates against the Corteca API. Username is plain text — not email type. |
| `/gate` | Site Gate | Separate username/password gate (SITE_USERNAME / SITE_PASSWORD env vars) that protects the entire app before Corteca login. Enforced by `middleware.ts`. |
| `/dashboard` | Dashboard | Card grid linking to all features. |
| `/devices` | Device Search | Search subscribers by name, email, MAC, UUID, or serial. Shows all devices on their home network with status, model, and IP. |
| `/network-visualizer` | Home Network Visualizer | Search a subscriber, then renders: interactive D3 topology graph, Leaflet map pin, ethernet port panels per AP (with live/config/spec fallback), and a raw API debug panel. Subscriber card includes a blue "Launch Corteca Console" button linked to the gateway MAC. |
| `/network-map` | Global Network Map | Leaflet map of every managed network in the fleet, clustered by location. Color-coded online/offline. Sidebar with deployment stats, search, and per-network detail panel. |
| `/reports` | Performance Reports Hub | Card grid of all available report types. |
| `/reports/[reportType]` | Performance Report | Fetches a specific report type, renders a Recharts bar chart + sortable/filterable/sticky-header table. Account names enriched via batch lookups. Report types: reboot, congestion, noise, new-devices, coverage, cloud-disconnections, claim, backhaul-quality. |
| `/reboot-report` | Reboot Report | Dedicated page for the reboot report with Recharts bar chart and sortable/sticky-header table. |
| `/sw-overview` | Beacon SW Overview | Heatmap matrix of active Beacon firmware versions across the fleet by model. Drilldown modal per cell, unknown firmware list, deployment report table. |
| `/device-browser` | Device Data Model Browser | USP TR-369 data model explorer. Search for a device by MAC, browse the full parameter tree, set parameters via modal with confirmation. |
| `/alarms` | Network Alarms | Query the ouife fault manager for open alarms by date range, severity (critical/major/minor/clear), optional device MAC, and alarm type (standard vs. custom). Results in a sortable table with clickable severity filter chips and per-row Corteca Console launch button. Includes "Cross Reference Reboot Report" — fetches the latest reboot report and cross-matches alarm AP MACs; matched APs are shown grouped with their alarm rows and reboot events, color-coded per AP. |
| `/api-usage` | API Usage Dashboard | Live stats on Corteca API calls, bytes sent/received, rate limit hits for the current session. Persisted per-session in PostgreSQL via Prisma. |

---

## Global Features (All Pages)

### API Log Panel

Every page has a collapsible dark terminal-style **API Log** panel pinned at the bottom of the document. It is rendered once in `Providers.tsx` and does not require any per-page code.

- **What it shows:** every `fetchWithAuth` call — method, URL path, HTTP status (color-coded), duration in ms, and the response body (click any row to expand)
- **Newest at top.** Resets automatically on each route change.
- **Buttons:** Copy All (formats all entries as plain text to clipboard), Clear
- **Error highlight:** rows with 4xx/5xx status get a red-tinted background

**Architecture:**
1. `web/lib/fetchWithAuth.ts` — exports `setApiLogInterceptor(fn)`. The interceptor is called after every fetch with `ApiCallLogEntry` (timestamp, method, url, status, statusText, durationMs, bodyPromise).
2. `web/contexts/ApiLogContext.tsx` — `ApiLogProvider` registers the interceptor on mount, stores up to 200 entries in state (newest first), and resets on `usePathname()` change.
3. `web/components/ApiLogPanel.tsx` — the collapsible UI. Reads entries from `useApiLog()`.
4. `web/components/Providers.tsx` — wraps `<ApiLogProvider>` around the app and renders `<ApiLogPanel />` after `{children}`.

---

## Middleware

`middleware.ts` (root) enforces the site gate on every request:
- `/gate` and `/api/gate` are always allowed through
- If `SITE_USERNAME`/`SITE_PASSWORD` env vars are not set, gate is skipped (local dev)
- Otherwise checks `site_auth` cookie (base64 of `user:pass`); redirects to `/gate` if missing or wrong
- Matcher excludes `_next/static`, `_next/image`, and `favicon.ico`

---

## Authentication Architecture (Two-Tier)

### Tier 1 — Site Gate
- Route: `/gate` → `POST /api/gate`
- Env vars: `SITE_USERNAME`, `SITE_PASSWORD`
- Sets an `httpOnly` cookie `site_auth` (base64 of `user:pass`)
- Middleware (`middleware.ts`) checks this cookie on every request

### Tier 2 — Corteca API Login
- Route: `/` → `POST /api/auth/login`
- Authenticates against `${CORTECA_API_BASE_URL}/auth/token` using `X-Service-Type: KC` header + `clientId`/`clientSecret` headers + `{ email, grant_type: 'password', password }` body
- Sets three cookies: `corteca_token` (access, httpOnly), `corteca_refresh_token` (httpOnly), `corteca_email` (client-readable for display)
- `AuthContext` (`web/contexts/AuthContext.tsx`) provides `isAuthenticated`, `login()`, `logout()`, `refreshSession()` to all client components
- `fetchWithAuth` fires a `corteca:session-expired` DOM event on 401, triggering `ReloginModal`
- **Username is plain text (not email type)** — Corteca usernames are not always email addresses. Do not use `type="email"` on login inputs.

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
- Stats are flushed to PostgreSQL `ApiSession` table via `PUT /api/sessions`

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

### API Routes Reference

| Route | Method | Purpose |
|---|---|---|
| `/api/auth/login` | POST | Authenticate against Corteca; sets cookies |
| `/api/auth/logout` | POST | Clears auth cookies |
| `/api/auth/session` | GET | Returns `{ authenticated, email }` from cookies |
| `/api/gate` | POST / DELETE | Site gate login / logout |
| `/api/subscribers` | GET | Search subscribers by `name` query param |
| `/api/network/[deviceId]` | GET | Full network topology for a device (mesh, members, configs) |
| `/api/network/[deviceId]/ethernet` | GET | Ethernet port live status for a device |
| `/api/network/[deviceId]/datamodel` | GET | USP TR-369 data model for a device |
| `/api/network/[deviceId]/datamodel/set` | POST | Set a USP parameter value |
| `/api/networks/[networkId]/members` | GET | Connected client devices for a network |
| `/api/network-map` | GET | Fleet-wide deployment report (cached in DB + memory) |
| `/api/network-map/account-names` | GET | Batch subscriber name lookup by MAC or ID |
| `/api/network-map/locate` | GET | Geolocate a network by IP |
| `/api/network-map/device-info/[mac]` | GET | Single device info (online status, model, firmware) |
| `/api/reports/[reportType]` | GET | Fetch a performance report by type |
| `/api/reboot-report` | GET | Fetch the latest reboot report as CSV, returns parsed rows |
| `/api/alarms` | GET | Query ouife fault manager for alarms |
| `/api/sw-matrix` | GET / POST | Read or update the Beacon SW release matrix |
| `/api/sw-overview` | GET | SW fleet overview (wraps deployment report) |
| `/api/stats` | GET | In-memory API call stats for current process |
| `/api/sessions` | GET / PUT | List or update API session records in DB |
| `/api/cron/keepalive` | GET | Pings Supabase via Prisma to prevent auto-pause; called by Vercel Cron |

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

Console launch buttons appear in:
- `AlarmTable` — per alarm row
- `AlarmCrossRefTable` — group header per AP
- `app/network-visualizer/page.tsx` — subscriber card after network is loaded

---

## Alarm Cross-Reference Feature

In `/alarms`, after fetching alarms, the user can click **"Cross Reference Reboot Report"** to:
1. Fetch `/api/reboot-report` (the latest reboot CSV from Corteca)
2. Normalize both AP MACs (from alarms) and device MACs (from the reboot CSV) by stripping separators and uppercasing
3. Find APs that appear in both datasets
4. Render `AlarmCrossRefTable` — each matching AP gets a color-coded card (cycles through 6-color pastel palette) showing alarm rows and reboot event rows

**MAC normalization:** `mac.toUpperCase().replace(/[:\-\s]/g, "")` — handles colon, hyphen, any case.

The reboot report MAC column is found heuristically — checks `home_wifi_id`, `device_id`, `ap_id`, `mac`, `mac_address` in order, then falls back to any column whose values all match the MAC regex.

---

## Data Layer (Prisma + PostgreSQL)

Uses Prisma with a Supabase PostgreSQL database. Three models:

| Model | Purpose |
|---|---|
| `SwMatrix` | Singleton (id=1). Stores the Beacon firmware release matrix: `beaconModels` (JSON array) and `releases` (JSON array). Seeded via `prisma/seed.js`. |
| `DeploymentReport` | Singleton (id=1). Cached deployment report: device list, column headers, raw rows, stats, USP map. Updated when SW Overview fetches fresh data. Shared across serverless instances via DB. |
| `ApiSession` | One row per login session. Tracks call count, bytes sent/received, rate limit hits. Persisted via `PUT /api/sessions` with debounce; final flush on logout using `keepalive`. |

### Database Commands
```bash
npm run db:push       # push schema to DB (uses DIRECT_URL)
npm run db:generate   # regenerate Prisma client
npm run db:studio     # open Prisma Studio
npm run seed-matrix   # seed initial SW matrix data
```

### Supabase Keepalive Cron

Supabase free-tier projects auto-pause after 7 days with no database activity. `vercel.json` defines a daily Vercel Cron job (`0 8 * * *`) that hits `GET /api/cron/keepalive`, which runs `SELECT 1` via Prisma to register activity.

- Authenticated via `CRON_SECRET` — Vercel automatically sends `Authorization: Bearer $CRON_SECRET` on cron-triggered requests; the route checks it if the env var is set (skipped in local dev).
- `middleware.ts` allows `/api/cron/*` through the site gate unconditionally, since cron requests carry no `site_auth` cookie.
- Cron jobs only fire on deployed Vercel environments (Hobby plan: once/day max), not in local dev.

---

## Key Server-Side Library Modules (`web/lib/`)

| Module | Purpose |
|---|---|
| `corteca/cortecaFetch.ts` | Wraps `fetch` with timeout, stats tracking, and rate-limit detection |
| `corteca/apiStats.ts` | In-memory counters (calls, bytes, rate limits) reset on login |
| `corteca/reportCache.ts` | In-memory + DB cache for the fleet deployment report; avoids re-fetching on every request |
| `corteca/nameCache.ts` | Server-side MAC→accountName cache shared between API routes |
| `corteca/deploymentReport.ts` | Fetches and normalises the Corteca deployment report; populates `reportCache` and DB |
| `corteca/networkTopology.ts` | Normalises raw mesh topology API shapes into a consistent tree structure |
| `corteca/subscribers.ts` | Subscriber search and lookup helpers |
| `corteca/network.ts` | Network device and member fetch helpers |
| `corteca/usp.ts` | USP TR-369 data model traversal helpers |
| `corteca/types.ts` | All shared TypeScript interfaces (Subscriber, Member, MeshAP, etc.) |
| `fetchWithAuth.ts` | Client-side authenticated fetch; fires DOM events for stats, triggers ReloginModal on 401, fires the `ApiLogInterceptor` for the API log panel |
| `reportNameEnrichment.ts` | `findDeviceIdInfo()` heuristic to find MAC/serial columns in CSV report rows; `injectAccountNames()` to prepend account name column |
| `reportTypes.ts` | `REPORT_CONFIGS` — display name, chart color, Corteca type strings for all 8 report types |
| `networkTopology.ts` | Parses raw mesh/topo API responses into normalised `NetworkTopologyData` |
| `networkMembers.ts` | Fetches and normalises connected client members for a network |
| `sessionHistory.ts` | LocalStorage session record helpers for the API usage dashboard |
| `swMatrix.ts` | Beacon SW release matrix helpers |
| `geoUtils.ts` | Latitude/longitude helpers for the network map |
| `prisma.ts` | Prisma client singleton (avoids too-many-connections in serverless) |
| `utils.ts` | `cn()` — clsx + tailwind-merge for conditional Tailwind classes |

---

## Environment Variables

All required. Copy `.env.example` to `.env.local` to get started.

| Variable | Description |
|---|---|
| `CORTECA_API_BASE_URL` | Nokia API base URL (e.g. `https://l1api.demo2.homewifi.nokia.com`) |
| `CORTECA_CLIENT_ID` | Corteca OAuth client ID (sent as `clientId` header, not query param) |
| `CORTECA_CLIENT_SECRET` | Corteca OAuth client secret (sent as `clientSecret` header) |
| `NEXT_PUBLIC_CORTECA_CONSOLE_URL` | Nokia Console base URL — public, safe for browser (e.g. `https://console.demo2.homewifi.nokia.com`) |
| `DATABASE_URL` | Pooled PostgreSQL URI (PgBouncer port 6543) — used by the app at runtime |
| `DIRECT_URL` | Direct PostgreSQL URI (port 5432) — used only by `prisma db push` and seed scripts |
| `SITE_USERNAME` | Gate username protecting the entire app |
| `SITE_PASSWORD` | Gate password |
| `CRON_SECRET` | Bearer token Vercel Cron sends to `/api/cron/*` routes; optional, skips auth check if unset (local dev) |

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

## Key Client Libraries

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

```
app/
  page.tsx                        # Login (landing)
  gate/page.tsx                   # Site gate login
  dashboard/page.tsx
  devices/page.tsx
  network-visualizer/page.tsx
  network-map/page.tsx
  reports/page.tsx
  reports/[reportType]/page.tsx
  reboot-report/page.tsx
  sw-overview/page.tsx
  device-browser/page.tsx
  alarms/page.tsx
  api-usage/page.tsx
  api/
    auth/{login,logout,session}/route.ts
    gate/route.ts
    subscribers/route.ts
    network/[deviceId]/{route,ethernet,datamodel,datamodel/set}.ts
    networks/[networkId]/members/route.ts
    network-map/{route,account-names,locate,device-info/[mac]}.ts
    reports/[reportType]/route.ts
    reboot-report/route.ts
    alarms/route.ts
    sw-matrix/route.ts
    sw-overview/route.ts
    stats/route.ts
    sessions/route.ts

web/
  components/
    ApiLogPanel.tsx               # Global API log panel (bottom of every page)
    DashboardCard.tsx
    DataModelBrowser.tsx
    EthernetPortPanel.tsx
    GlobalNetworkMap.tsx
    Navbar.tsx
    NetworkMap.tsx
    NetworkMapControls.tsx
    NetworkMapSearch.tsx
    NetworkTopologyMap.tsx
    Providers.tsx                 # Wraps ApiLogProvider + ApiLogPanel + Auth + Stats
    RebootChart.tsx
    ReportChart.tsx
    SubscriberSearch.tsx
    SwDrilldown.tsx
    SwHeatmap.tsx
    UnknownFirmwareList.tsx
    UsageChart.tsx
    modals/
      AssignFirmwareModal.tsx
      ConfirmModal.tsx
      LoginModal.tsx
      ReloginModal.tsx
      SetParameterModal.tsx
      SwMatrixModal.tsx
    tables/
      AlarmTable.tsx              # Sortable alarm table with severity filter + Console button
      AlarmCrossRefTable.tsx      # Cross-reference view: alarms + reboots grouped by AP MAC
      ColumnFilter.tsx
      DeploymentTable.tsx
      NetworkMembersTable.tsx
      RebootTable.tsx
      ReportTable.tsx
      SessionTable.tsx
      SwNetworkTable.tsx
    ui/
      Button.tsx
  contexts/
    ApiLogContext.tsx             # Stores API log entries; registers fetchWithAuth interceptor
    ApiStatsContext.tsx           # Accumulates call/byte stats; persists sessions to DB
    AuthContext.tsx               # isAuthenticated, login(), logout(), refreshSession()
  lib/
    corteca/
      apiStats.ts
      client.ts
      cortecaFetch.ts
      deploymentReport.ts
      devices.ts
      nameCache.ts
      network.ts
      provisioning.ts
      reportCache.ts
      subscribers.ts
      types.ts
      usp.ts
    fetchWithAuth.ts
    geoUtils.ts
    networkMembers.ts
    networkTopology.ts
    prisma.ts
    reportNameEnrichment.ts
    reportTypes.ts
    sessionHistory.ts
    swMatrix.ts
    utils.ts

middleware.ts                     # Site gate enforcer — redirects to /gate if no cookie
```

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

# 3. Push DB schema and seed SW matrix
npm run db:push
npm run seed-matrix

# 4. Run dev server
npm run dev

# 5. Build for production
npm run build
npm run start
```

**Prerequisites:** Node 18+, PostgreSQL (Supabase recommended), Nokia Corteca API credentials (base URL, client ID, client secret).
