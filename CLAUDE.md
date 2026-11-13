# Project Guidelines

## What This App Is

**Corteca Vibe Project** — a Next.js 15 internal dashboard that wraps the Nokia Corteca Home Controller (HomeWifi Edge) API. It gives operators a browser-based UI to search subscribers, visualize home networks, inspect devices, run fleet reports, monitor alarms, and track software deployments — all without using the raw API or the Nokia Corteca Console directly.

The app runs on Vercel (or any Node host) and acts as a secure proxy: all Nokia API calls happen server-side (Next.js API routes), so credentials never reach the browser.

---

## Application Features

### Pages & Routes

| Route | Feature | Description |
|---|---|---|
| `/` | Login | Full-screen landing page with Nokia background image. Authenticates against the Corteca API. Username is plain text — not email type. |
| `/gate` | Site Gate | Separate username/password gate (SITE_USERNAME / SITE_PASSWORD env vars) that protects the entire app before Corteca login. Enforced by `middleware.ts`. |
| `/dashboard` | Dashboard | Landing page styled after the Corteca console home: time-of-day greeting with the user's first name, "Corteca dashboards" grid of wide tiles (`DASHBOARD_CARD_HREFS` in `web/lib/navItems.tsx`: Reports, Network Map, Device browser, SW overview — two per row, an odd last tile spans both columns so the rows stay even) to the right of a tall featured tile for the MCP visualizer (`DASHBOARD_FEATURED_HREF`, left column), and an "Other applications" dropdown for every remaining page (incl. Device Search, Network Alarms and the REST `/network-visualizer`, which are no longer tiles but stay in the nav Menu). |
| `/devices` | Device Search | Customer search as in the Corteca console (`SubscriberSearch`: Auto detect / Name / Email / Customer ID / MAC / Serial number chips, results table) — see **Subscriber search** below. Shows all devices on their home network with status, model, and IP. |
| `/network-visualizer` | Home Network Visualizer | Search a subscriber, then renders: interactive D3 topology graph (wheel zoom by distance, `wheelPixels()`), a MapLibre location map (`NetworkMap` → `web/components/map/LocationMap.tsx`: the home as one marker at the gateway's location, drawn like the fleet Network Map — a status dot, or a count bubble with green/red ring when there are Beacons (`homeMapStyle.ts`; only the gateway's location is known, so Beacons are not spread around it); hover shows a `HomeNetworkCard` listing every AP with status and clients, click pins it), ethernet port panels per AP (gateway: live TR-181 with config/spec fallback; mesh Beacons: built from Corteca reports by `meshApPorts()` — see Ethernet ports below), and a raw API debug panel. Subscriber card includes a blue "Launch Corteca Console" button linked to the gateway MAC. |
| `/mcp-network-visualizer` | Home Network Visualizer (MCP) | **Network tabs:** up to 5 networks open at once (`MAX_NETWORK_TABS`), one tab each in a strip under the top bar (`NetworkTabs`: subscriber name or root MAC, gateway model, spinner while loading/refreshing, pulsing ✦ while AI runs, blue dot when a load/refresh/AI run finished in the background, red dot on error, ×, hover tip). Every open network is its own `NetworkWorkspace` (`web/components/mcp/`), kept mounted and hidden when not on screen, so switching never re-asks MCP and each tab's Refresh / AI analysis / troubleshooting run in parallel; the top bar acts on the tab on screen. Opening a network that is already open switches to it; a 6th opens `TabLimitModal` (close one → "Close & open"); closing a tab whose AI run is in progress asks first (`ConfirmModal`). Open tabs survive a page reload (sessionStorage, `web/lib/networkTabs.ts` / `useNetworkTabs.ts`): only the tab on screen reloads at once, the others when first picked; a tab's canvas mounts only once it has been on screen (so it measures itself). The URL carries the on-screen tab's view only; a `?network=` link not yet open becomes a tab (or the limit dialog). Compact top bar (title, subscriber search with floating results, subscriber/network chip with data-captured time and Console button) and a left "Recent networks" rail/drawer (localStorage; shows each network's gateway model; per-row × removes one entry, Clear removes all) keep the diagram at the top of the page, sized to the window. Network data comes from the Corteca AI MCP server's `retrieve-network-data` tool. Renders a React Flow topology canvas (`web/components/topology/`: AP cards with status ring and client badge, lines in one scheme — **solid = cable, dashed = WiFi** (backhaul, wired clients, switch lines, WiFi client-card connectors); backhaul/switch/WAN lines are 3 px (`BACKHAUL_WIDTH`), client lines thinner; WiFi backhaul coloured by Corteca's `backhaulQuality` (Beacon 24's "normal" / "bad" read as fair / poor) and labelled on two lines, band · channel over RSSI · rate ("6 GHz · Ch 37" / "-58 dBm · 2.4 Gbps"; the channel appears once the gateway's wifi-details read arrives; an MLO backhaul reads "MLO · 9.2 Gbps" over one line per band, "6 GHz · -50 dBm · 5.8 Gbps"; a "\n" in a label stacks it and `labelSize()` sizes it), Ethernet backhaul port · rate; moving dots (`FlowPath`, faster on faster links) on every backhaul, switch and WAN link that has a rate, one client card per AP with stacked band sections (6/5/2.4 GHz, wired) collapsing to "+N", legend, minimap, full screen; ELK layout; Ethernet backhaul below 1 Gbps flagged amber; an Ethernet backhaul plugged straight into a gateway port is labelled with the port, "LAN 1 · 10 Gbps", from the live host table — `link.port`, set by `applySwitches()` — and the link panel shows "Gateway port"), per-AP cards (`McpAccessPointCards`), the `NetworkMembersTable` (its **Connection** column comes from `memberConnection()` in `web/lib/memberConnection.ts`: WiFi standard · channel · band, or "Wired · LAN 3 · 100 Mbps" / "Wired · LAN 1 · via switch (inferred)", and its **Connected AP** column shows the AP's nickname (or model), then model · Gateway · MAC — for a client behind a switch, the AP the switch hangs off; Device Search, with no network context, keeps the bare MAC; no Status column — a paused client gets a yellow "Paused" pill by its name; the second tab is **Recently disconnected**: MCP lists only clients online now, so `useMemberHistory()` reads Corteca's REST client history (`/api/networks/[id]/members`, ~2 s) after each MCP load, in parallel with the gateway reads — the diagram never waits on it — and `recentlyDisconnected()` (`web/lib/recentlyDisconnected.ts`) keeps clients last seen in the last 30 days that aren't online now, drops the Beacons' own radio/backhaul MACs (AP MACs, "Beacon 9" / "Nokia WiFi Beacon 19.1" names, device-map `WIFI_EXTENDER`), uses `extender_id` as the last AP (a Beacon's client lists the gateway as `device_id`), treats `channel: -1` + LAN `port_number` as wired, and merges rows with the same name **only when both MACs are randomized** (locally administered; three "SonosZP" speakers with factory MACs stay three rows); that tab adds Last seen (+ last disconnect reason) and labels the AP column "Last AP"), and a raw MCP debug panel. **Network events** (Corteca's activity log, `/api/networks/[id]/activity`, read in the background after each MCP load, cached per snapshot): a collapsible drawer under the diagram legend (`web/components/events/`: one row "Network events · 3 today · N in 30 days" when collapsed, open/closed and width remembered in localStorage; open = resizable drawer, 320 px to half the canvas, with 24 h / 7 days / 30 days, count tiles (Reboots, AP offline, Backhaul degraded, New clients), per-day bars coloured outage / degraded / info (click jumps to the day), category chips (Online / offline, Mesh, Channels, Clients, Operator on; Diagnostics and Console sessions off), device picker, "Show routine events", and the list grouped by day; ⤢ expands it over the whole canvas in the full card layout, "Back to drawer" / Esc returns). Rows fold related events (`buildEventItems()`): switch-off / lost / reboot / back online on one device = one outage ("Gateway switched off for 2 h 26 min, then rebooted"), a Beacon going down with the gateway says so, backhaul good/fair → bad until it recovers (or the AP leaves / rejoins the mesh) = one episode, channel changes within 5 min and band flips within 30 min = one row; click a row for its fields and raw Corteca events; CSV download. The top bar's **Events** button (red "N today") opens it. **Diagram vs. events drawers** (`useDrawerFit()` in `web/components/topology/useDrawerFit.ts`, both drawers): while a drawer is open at a comfortable width (≤ 40% of the canvas, `DRAWER_FIT_SHARE` — e.g. its default), every fit (first view of a network, Fit button, layout switch, full screen) uses left padding = the drawer's width, so the diagram sits to its right; opening a drawer or resizing it to a comfortable width refits that way, collapsing it refits to the whole canvas, and a drawer stretched wider or expanded over the canvas never moves the view (it may cover the diagram). With a drawer and a detail panel both open some overlap is accepted. **Later data refits** (`useCanvasFit()`, same file): the first fit uses the first MCP data, and the gateway reads can widen the diagram a lot afterwards (A8-FB-40-AE-FC-E3: an inferred switch with 13 wired SonosZP), so every new `network` object (gateway extras, Refresh) refits — unless the user has panned / zoomed since the last fit (only real gestures count; a view restored from the URL doesn't, since it's saved after automatic fits too) or something is selected. Expanding a "+N" client section doesn't refit. **TDS Network Events RCR** (`web/components/tds-events/`, TDS feature request 1.1–1.3): a second, separate events popout as a row under the Network events row — same activity log, its own drawer / expanded view / width (localStorage `corteca.tdsEventsDrawer.v1`) and filters; opening either popout closes the other (the standard one is otherwise unchanged). Every row gets a **P1 Critical / P2 High / P3 Medium / P4 Low** level (`eventPriority()` in `web/lib/eventPriority.ts`; a row's level = the highest of its events, so lost → reboot → back online is P1; unknown operations P4; requested events Corteca hasn't been seen logging are matched by keyword) shown as a pill on each row and in the CSV (row + event level); bars stacked P1–P4 in red / orange / yellow / slate, **hourly** for ranges ≤ 36 h; date range 24 h / 7 days / 30 days / **Custom** (two dates inside the 30 days Corteca keeps); Severity chips + Type chips (adds **Firmware & config**; console sign-ins filed with Console sessions), device picker, routine toggle (lone reconnects stay P2, good ↔ fair backhaul P3, both hidden as routine); the count tiles follow every filter (a one-line summary in the drawer). A drawer stretched to ≥ 600 px (`ROOMY_WIDTH`) switches to the expanded view's arrangement — bars + severity timeline on the left, filters on the right (no bar legend or timeline caption; the chips carry the colours) — so the extra width is used and the fixed top gets shorter; axis labels keep 3 bars apart. The expanded view adds a **severity timeline** (`TdsTimeline`: one lane per level, dots at the exact time, bars for outages / episodes, dots drawn above bars, hover = row, click = jump to the day) beside the filters. Wording for operations the standard popout shows raw (`toTdsItems()` in `web/lib/tdsEvents.ts`, on copies): firmware upgrade started / done (old → new) / failed, config push sent / applied / failed, factory reset (`DEV_REBOOT` reason *FactoryReset), new network device (`NEW_NODE`, `NETWORK_EXTENDER_ADDED`, `DEV_CLAIMED`, `NEW_DEV_CONNECTED`), interference alarm (`UBUS_NOISE_ALARM`: `freq` MHz, `noise` dBm), reboot requested (`DEVICE_REBOOT`), device removed (`STATION_DELETED`), custom tag, app account / profile changes, **Main WiFi password set** (P2; see Activity log notes). The AP panel has an **Events** section between Ethernet ports and Radios (online/offline bar, tallies, its events, "Open in Network events") and the client panel ends with **Device events** (joins, renames, type changes). AP cards get a badge for reboots / outages in the last 30 days ("6× offline · 30 days", red if within 24 h); click it to **Acknowledge** (hidden until the next outage, then "New · …") or **Silence** (24 h / 7 days / until turned back on; a grey bell-off icon shows instead), stored per AP in this browser only (`eventAcks.ts`). The AP panel's Uplink / Backhaul / Downlink rows are in its Access point section (no separate Mesh section). MCP returns no location, so the **gateway and WAN panels** open with a **Location** mini-map (`GatewayLocation` → `/api/network/[gatewayMac]/location`, cached per gateway; MapLibre loads only when such a panel opens): the compact `LocationMap` with the home's marker (no card; any click expands), Ctrl/⌘ + scroll to zoom so the panel still scrolls, an "Open in OpenStreetMap" link and the map credit in the caption (compact maps have no attribution control). A click on the mini-map (or its expand button) opens a full `LocationMap` **over the diagram area**, left of the detail panel, at the mini-map's view (`CanvasOverlayFrame` in `CanvasOverlay.tsx`, portalled into the canvas; plain scroll zoom, zoom buttons, legend, hover/pinned home card); × or Esc closes it (while it's open the canvas ignores its own keys), and so does leaving the panel. The AP panel's **Ethernet ports** list has one row per port with its RJ-45 jack (`PortIcon`: live gateway ports by link status; Beacon ports by what Corteca reports, dashed = wireless backhaul or nothing reported), and under each negotiated rate the port's maximum ("1 Gbps · of 10 Gbps", "full speed", "max 1 Gbps" for an empty port): gateway = TR-181 `MaxBitRate`, filled from the spec sheet where TR-181 says auto (`withSpecMaxRates`); Beacons = the port layout's speeds. The detail panel is `w-[25rem]`. Every detail-panel section (`DetailSection` in `DetailParts.tsx`, all right-side panels: AP, client, link, switch, WAN) has a grey header strip pinned to the top of the panel while its section scrolls — blue outline icon (`SectionIcon`, by section name), 13 px dark title, period switches, fold arrow on the right — and folds to its title and a one-line summary ("Online · 11 clients · uplink to …", "9 connections · 0 AP moves · …") via the arrow / title; collapsed sections are remembered by section name across panels and reloads (`useSectionCollapse()`, localStorage `corteca.detailSections.v1`), and the badge's "Events" button opens the Events section if it is folded. AP cards show model + MAC (firmware is in the detail panel); zoom/fit buttons sit beside the legend (top-left); the legend (`TopologyLegend`) minimises to a one-line "Key" row like the events rows (‹ in its header, remembered in localStorage `corteca.legendOpen.v1`), the zoom buttons stay (in a row beside the minimised key, a column beside the open one). Interaction: click an AP, client pill or link to open a detail side panel and highlight its path to the gateway — if opening the panel pans the diagram aside, closing it pans back (unless the user moved the view meanwhile; dragging never closes the panel); AP cards and table rows select the same node; client search (name/MAC/IP); filter chips fade non-matching clients, in labelled groups — **Band** (6/5/2.4 GHz, Wired), **WiFi network** (SSIDs), **Look for** (weak signal < -70 dBm, could use faster band, older WiFi); any chip within a group matches, groups combine; every chip and layout button has a quick hover/focus tip (`Hint` in `web/components/ui/Hint.tsx`, not `title`); detail panel also shows AP public IP / hardware / last offline / top clients by traffic, link PHY rate and traffic, client traffic, supported bands and last disconnect reason; a "data captured" time sits above the canvas; Tree / Sideways / Radial layouts; arrow keys step through devices, Esc clears (`useCanvasKeyboard`: a click anywhere in the canvas re-focuses it, since clicked edge labels dropped focus to `<body>` and Esc did nothing). View state lives in the URL (`?network=…&sel=client:…&band=5,2.4&ssid=…&weak=1&slowband=1&layout=radial&v=x,y,zoom`) — `?network=<root MAC>` deep-links straight to a network without a subscriber search. A **Refresh** button in the top bar re-reads the network from MCP while keeping the diagram, selection, filters, zoom and expanded sections; gateway reads (Ethernet ports, backhaul standard) are cached per network snapshot (`capturedAt`), so they re-read too, showing the previous values until the new ones arrive. A failed refresh keeps the old data with an error. An **AI analysis** card under the diagram (top-bar "AI analysis" button jumps there and runs it) runs MCP `analyze-network` on demand and shows Corteca's state pill and the Markdown report; Beacons with findings get an amber badge on their diagram card, and AP/client panels show the report lines about them. The same card's "Troubleshoot a problem" box runs `troubleshoot-network`. The AP panel's **Radios** section shows each radio's channel, width, busy airtime split (transmit / own clients / other networks), average, noise and Tx power; the client panel shows the WiFi standard ("WiFi 6 (802.11ax)"); an "Older WiFi (4/5)" filter chip (`oldwifi=1`) fades newer clients. The top bar's "data … ago" time re-renders every 30 s. **Inferred switches** are drawn as dashed "Switch · inferred" cards between the AP port and what sits behind it (Beacons, plus a client card for wired clients behind it); the AP → switch line is labelled with the port and its negotiated rate ("LAN 1 · 1 Gbps"), clicking the card or its line opens a panel with the evidence and the devices behind it (`?sel=switch:<id>`), and selecting a device behind it highlights the path through it; selecting the AP it hangs off also highlights a switch that has wired clients, with those clients (Beacons behind it stay dimmed). An **Internet** card sits above the gateway (`internet` node, green/red ring from the gateway's WAN connection status, WAN IPv4), joined by a blue `wan` edge whose pill shows "WAN · 5 Gbps" (the WAN port's negotiated rate); clicking the card or pill opens the WAN panel (`?sel=wan:<gateway MAC>`: status, public IP, uptime, traffic, WAN interface name/services/addressing, WAN IPv4/IPv6, default gateway, DNS, LAN IP, a double-NAT / CGNAT note for private WAN addresses, and the WAN port's max/current rate, duplex). Highlighted paths to the gateway continue to the Internet. Wired clients are **their own pill nodes** (`wired`, id `wc:<MAC>`), each linked from the AP or inferred switch it is plugged into by a `wiredLink` line (`wl:<MAC>`) labelled with port and link speed ("LAN 3 · 100 Mbps"); behind a switch the line has no label (the switch line carries the port and shared speed). Client cards hold WiFi clients only. The client panel's Type row says the same ("Wired · LAN 3 · 100 Mbps") and wired clients have no PHY row. A WiFi client's panel ends with **Roaming history** (`ClientRoaming` + `RoamingTimeline`, read when the panel opens via `useRoamingHistory()`, cached per network snapshot): 24 h / 7 days / 14 days, a bar of its connections coloured by AP (grey = not connected; hovering anywhere on it shows that connection — AP, start · duration, band · channel · signal, how it ended — or the offline gap in a bubble under the pointer, thin segments snap within 4 px), moves between APs, band changes, disconnects, "Time on each AP" (share of connected time · total over the period), and the connections newest first (AP, band · channel, signal at join and lowest, how it ended: moved to …, disconnected + reason, AP switched off, connected now) — see **Client roaming history** below. |
| `/network-map` | Global Network Map | MapLibre GL map (`GlobalNetworkMap`, `web/components/map/`) of every located network in the fleet on OpenFreeMap's Positron vector tiles, recoloured to the Corteca palette (`tintBasemap()` in `web/lib/mapBasemap.ts`, shared with the REST visualizer's location map). Networks are green/red dots; nearby ones group into white count bubbles with a green ring (red if any is offline) — click to zoom in. Hover a dot for its card (account, customer ID, status pill, gateway model/firmware, APs and clients from `/api/network-map/device-info/[mac]`, Corteca Console button); click pins it (blue ring, filters the deployment table), clicking empty map or × closes it. Legend top-left, zoom/fit buttons top-right; the map keeps fitting newly located networks until the user moves it. Network status tiles, search, and the deployment report table sit around it. **Location filters** beside the search (`RegionFilterBar` → `MultiSelectMenu`, multi-select with network counts): Continent, Country (United States and Canada first, then A–Z) and, when the US and/or Canada is ticked, State / province (grouped by country). Picked states/provinces narrow the US/Canada to just those; other picked countries stay whole; unticking a higher level drops picks it no longer allows (`pruneFilter`). The map shows only matching networks (and refits), and the deployment report lists only their rows — so with a filter set, networks that aren't on the map (offline, no Customer ID, no location) drop out of the table. Regions come from `POST /api/network-map/regions` (Corteca's device summary has lat/lng only, no country). |
| `/reports` | Performance Reports Hub | Card grid of all available report types. |
| `/reports/[reportType]` | Performance Report | Fetches a specific report type, renders a Recharts bar chart + sortable/filterable/sticky-header table. Account names enriched via batch lookups. Report types: reboot, congestion, noise, new-devices, coverage, cloud-disconnections, claim, backhaul-quality. |
| `/reboot-report` | Reboot Report | Dedicated page for the reboot report with Recharts bar chart and sortable/sticky-header table. |
| `/sw-overview` | Beacon SW Overview | Styled after the Corteca console (light grey ground, white rounded cards, blue outline actions, pastel status pills). A "Fleet health" card (Beacons / Online / Known releases / Unknown firmware tiles — counts and share of the fleet only, no ratings; Online tile filters to online, Unknown tile opens the unknown list) sits above a heatmap matrix of active Beacon firmware versions across the fleet by model. WiFi filter pills (WiFi 5 / WiFi 6/6E / WiFi 7, multi-select) limit columns to models of those generations. Drilldown modal per cell, unknown firmware list, deployment report table. |
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
- `fetchWithAuth` fires a `corteca:session-expired` DOM event on 401, triggering `ReloginModal`. The page stays as it is behind the dialog (an expired session doesn't clear `isAuthenticated`); if the user hasn't signed back in after **5 minutes** (`RELOGIN_GRACE_MS`), `AuthContext` signs out and goes to the login page.
- **Sign out** (navbar button or the dialog's Sign out) → `logout()` clears the cookies, then a full load of `/` (the login page), after `ApiStatsProvider` has flushed the session.
- Redirecting signed-out users is central in `AuthContext`: anywhere but `/` and `/gate` without a session goes to `/`. Pages don't redirect themselves; they just show their loading state until signed in.
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
| `/api/subscribers` | GET | Subscriber search: `?q=…&field=auto\|name\|email\|customerId\|mac\|serial` (legacy `?name=`). Returns `{ results, fields, truncated }` — see **Subscriber search** |
| `/api/network/[deviceId]` | GET | Full network topology for a device (mesh, members, configs) |
| `/api/network/[deviceId]/ethernet` | GET | Ethernet port live status for a device |
| `/api/network/[deviceId]/datamodel` | GET | USP TR-369 data model for a device |
| `/api/network/[deviceId]/datamodel/set` | POST | Set a USP parameter value |
| `/api/network/[deviceId]/device-names` | GET / POST | GET: user-given Beacon/client names + detected manufacturer/model/category from the gateway's `X_ALU-COM_LAN_DEVICE_MAP` (USP). POST `{ mac, alias }`: sets that device's `HostAlias` (empty = remove), then reads it back and only reports success if it matches |
| `/api/network/[deviceId]/location` | GET | The gateway's position from its Corteca device summary (`/ouife/devices/{mac}/summary`, `extractLatLng()` in `web/lib/networkLocation.ts`); returns `{ location: { lat, lng } \| null }` |
| `/api/network/[deviceId]/wan` | GET | The gateway's Internet connection from TR-181 (one USP GET of `WAN_PATHS`): the IP interface carrying the INTERNET service (`X_ALU-COM_ServiceList`), followed down `LowerLayers` (Ethernet.Link → VLAN/PPP → Ethernet.Interface) to the WAN port; returns `{ wan: WanInfo }` (`parseWan()` in `web/lib/wanInfo.ts`) |
| `/api/network/[deviceId]/wifi-details` | GET | From the gateway's EasyMesh Data Elements: every Beacon's radios (channel, width, airtime utilization, noise) and the WiFi standard (WiFi 4–7, MLO) of each backhaul and client station |
| `/api/networks/[networkId]/members/[memberId]/rssi` | GET | Corteca's per-client association / RSSI history (`dashboard-bff`), last `ROAMING_DAYS` (14) unless `from`/`to` given — the MCP client panel's Roaming history |
| `/api/networks/[networkId]/activity` | GET | Corteca's activity log for the last 30 days (`?days=` ≤ 30), all pages; data sanitised server-side (payloads, password/key-looking fields dropped); returns `{ events, from, to, truncated }` |
| `/api/networks/[networkId]/members` | GET | Corteca's client list for a network (REST): connected clients **and** history (`connected: false`, `last_seen`, `extender_id`, `last_disconnected_reason_code`) — the MCP visualizer's Recently disconnected tab |
| `/api/radio-bands` | GET | WiFi radio bands per device model learned from online APs (`RadioBands` table + memory shared via `globalThis`) |
| `/api/port-layouts` | GET | Ethernet port layouts per device model learned from gateways' live ports (`PortLayout` table + memory; DB failures fall back to memory) |
| `/api/mcp/network/[homeWifiId]` | GET | Calls the MCP `retrieve-network-data` tool (mesh + clients) for a root node MAC; optional `query` param overrides the natural-language query |
| `/api/mcp/analyze/[homeWifiId]` | GET | MCP `analyze-network` (all specialists); returns `{ report }` Markdown. `maxDuration = 300` |
| `/api/mcp/troubleshoot/[homeWifiId]` | GET | MCP `troubleshoot-network` for `?query=`; returns `{ diagnosis: { summary, problems, rootCauses, recommendedActions } }`. `maxDuration = 300` |
| `/api/network-map` | GET | Fleet-wide deployment report (cached in DB + memory) |
| `/api/network-map/account-names` | GET | Batch subscriber name lookup by MAC or ID |
| `/api/network-map/locate` | GET | Geolocate a network by IP |
| `/api/network-map/regions` | POST | `{ points: [{ mac, lat, lng }] }` → `{ regions: { [mac]: GeoRegion } }`: continent, country, US/Canada state or province, worked out offline (`regionOf()` in `web/lib/geoRegions.ts`) — no Corteca call |
| `/api/network-map/device-info/[mac]` | GET | Single device info (online status, model, firmware) |
| `/api/reports/[reportType]` | GET | Fetch a performance report by type |
| `/api/reboot-report` | GET | Fetch the latest reboot report as CSV, returns parsed rows |
| `/api/alarms` | GET | Query ouife fault manager for alarms |
| `/api/sw-matrix` | GET / POST | Read or update the Beacon SW release matrix |
| `/api/sw-overview` | GET | SW fleet overview (wraps deployment report) |
| `/api/stats` | GET | In-memory API call stats for current process |
| `/api/sessions` | GET / PUT | List or update API session records in DB |

### Subscriber search

All three search boxes (`SubscriberSearch` on Device Search / REST visualizer / Device browser, the MCP top bar's `SubscriberSearchBox` with a field select, and the ⌘K `CommandPalette`, Auto only) call `/api/subscribers` via `useSubscriberSearch()`. `web/lib/subscriberSearch.ts` maps the field to `GET /dashboard-bff/subscribers` params (checked on demo2):
- `name`, `email`: case-insensitive substring. `uuid` (customer ID): **case-sensitive** substring, so a mixed-case input is also sent lowercased. `device_id` (MAC): prefix of **≥ 4 octets, uppercase hyphenated only** (anything else → `Invalid MAC …`), so input is normalised and < 4 octets is rejected with a 400. `serial_no`: **uppercase** prefix.
- An email containing **`+` never matches** (even `%2B`), so the part before the `+` is searched and results filtered on the full address.
- **Auto detect**: MAC pattern → MAC; 4 letters + hex with a digit (`ALCL…`) → serial; `@` → email; otherwise name + email + customer ID in parallel, merged by customer ID.
- MAC/serial searches also return **networks with no subscriber** (only `home_wifis`): shown as "Unassigned network" (`subscriberName()`), keyed by network (`subscriberKey()`), and still openable. `home_wifis[]` carry `root`, `sn` (serial), `pc` (model).
- Each query asks for 20 rows; `truncated` = some query returned a full page.

### Corteca AI MCP Server

Nokia's Corteca AI MCP server (`corteca-mcp-server`, R26.03) exposes Corteca network capabilities as Model Context Protocol tools. Each tool runs an AI agent on Nokia's side that picks the right Corteca APIs and returns structured results, so a client can ask in natural language instead of calling individual endpoints. Results are AI-generated and may be incomplete — verify before acting on them. All tools are **read-only**; none change device or network state.

**Connection**
- Endpoint `${CORTECA_API_BASE_URL}/ai/mcp` (override with `CORTECA_MCP_URL`). Streamable HTTP; responses arrive as SSE (`event: message` / `data: {…}`).
- Auth: `Authorization: Bearer <token>`. The same token as the Corteca APIs (`corteca_token`) is accepted. OAuth auto-discovery / dynamic client registration is **not** supported yet — a client without a token falls back to DCR and gets a 404 on `/register`.
- Requires a Corteca L1+L2+L3 license.
- Server-side client: `web/lib/corteca/mcpClient.ts` (`callMcpTool(token, name, args)` does initialize → `notifications/initialized` → `tools/call`).

**Tools** — all take `homeWifiId` = the home network ID, normally the root node MAC **uppercase hyphen-separated** (`AA-BB-CC-DD-EE-FF`).

| Tool | What it does | Arguments | Returns |
|---|---|---|---|
| `retrieve-network-data` | Fetches live network state. A sub-agent chooses which backend APIs to call (e.g. mesh topology / access points, connected clients) from a natural-language `query`. | `homeWifiId`, `query` (e.g. "mesh topology and connected clients"), optional `deviceId` (a specific AP MAC for device-level data), optional `structuredContent: true` (JSON only in `structuredContent`, text is a short summary) | `{ results: [{ apiId, ok, status, data }] }` — seen `apiId`s: `mesh` (UspMesh: `aps[]` with model/firmware/status/ssids/`meshbackhaulnodes`, `links[]` with per-endpoint RSSI `metric`, data rates, errors) and `members` (clients: alias, hostname, AP `device_id`, band/channel/frequency, signal, rx/tx rates, capabilities) |
| `analyze-network` | Runs network-analyzer "specialists" and returns a report with findings and suggestions. | `homeWifiId`, optional `message` (focus the analysis, e.g. "Printer in the studio does not connect"), optional `specialists[]` from: `homeConnectivity`, `homeNeedsFwUpgrade`, `backhaulSignalStrength`, `clientsOutOfCoverage`, `clientConnection`, `apHealth`, `interference` (all run when omitted) | Analysis report with suggestions |
| `troubleshoot-network` | AI troubleshooter: gathers evidence from the knowledge base, live network data and the analyzer specialists, then diagnoses *why* something is wrong and *how* to fix it. Diagnoses only — never acts. | `homeWifiId`, `query` (a focused problem description, e.g. "Living room TV keeps dropping off WiFi"), optional `structuredContent` | Narrative summary, detected problems with evidence, likely root causes with confidence, recommended next actions |

**Usage notes**
- Calls are slow because an AI agent runs per call: ~10–20 s for `retrieve-network-data` (`maxDuration = 60`); **measured 30 s – 2.5 min for `analyze-network` / `troubleshoot-network`**, so their routes set `maxDuration = 300` (needs Vercel Fluid compute) and call with a 290 s timeout. The UI shows an elapsed timer. **They stream** (`web/lib/corteca/streamJson.ts`): the response starts immediately and sends a space every 5 s, then the JSON (leading whitespace is valid JSON); after streaming starts the status is always 200 and failures arrive as `{ error }`. Without this, production showed "Failed to fetch" — most likely a proxy dropping the long silent request (the route never returned an HTTP error).
- `analyze-network` returns **Markdown, not JSON** (sections: Overall State with a `State:` line, Current Findings, Recent History, Devices, Data Coverage); wording changes run to run. `web/lib/aiAnalysis.ts` keeps parsing loose: lines are attached to the devices whose MAC they mention — when a line mentions a client MAC, the AP MACs in it (the client's AP, "on extender …") are context and only the client gets it — and only lines with clear issue words (upgrade available, N>0 disconnects/reboots, degraded, unstable, weak, poor) count as findings. Only APs get diagram badges (most clients have a disconnect or two per week). `troubleshoot-network` with `structuredContent: true` returns JSON `{ summary, problems[{title,evidence}], rootCauses[{description,confidence}], recommendedActions[{kind,what,reason}] }`.
- Client WiFi standard: MCP members already carry `wifi_standard` (e.g. `"802.11ac"`); it matched the gateway's association-request decode on every client checked, so `clientStandard()` (`web/lib/wifiDetails.ts`) uses it and falls back to the gateway decode (which also gives MLO).
- **Radios** (gateway Data Elements, `Device.WiFi.DataElements.Network.Device.{i}.Radio.{j}`; the gateway is the EasyMesh controller, so one read covers every Beacon, `Device.{i}.ID` = AP MAC): `Utilization`, `Transmit`, `ReceiveSelf`, `ReceiveOther` (airtime from other networks / interference) and `X_ALU-COM_EWMA_*` averages are **0–255 linear** (→ %); `Noise` is ANPI (**dBm = value/2 − 110**); `CurrentOperatingClassProfile.{k}` lists one entry per width the radio covers — the widest class gives the width (e.g. 137 = 6 GHz 320 MHz, 129 = 5 GHz 160 MHz) and the 20 MHz class the primary channel (`web/lib/wifiRadios.ts`). Beacons in one mesh normally share channels (the wireless backhaul needs it), so "same channel" is not flagged. **A backhaul link has no channel in MCP**, so `applyWifiDetails()` takes it (and the width) from the parent AP's radio on the link's band — child AP as fallback; an exact band label, else the only radio of that family ("5 GHz" ↔ "5 GHz high") — into `link.channel` / `link.widthMhz`; the link panel shows a "Channel" row ("37 · 320 MHz"). Without the gateway read the label stays band-only.
- `retrieve-network-data` lets the agent choose APIs, so an expected `apiId` can be missing or `ok: false` — always handle that.
- Mesh data has no explicit tree: each AP's `meshbackhaulnodes` lists its downstream AP serials (`web/lib/mcpNetwork.ts` builds the tree from it).
- **Nicknames are not in MCP** (or the REST topology/mesh/members endpoints), but they **are on the gateway**: USP `Device.X_ALU-COM_LAN_DEVICE_MAP.DeviceMap.{i}.HostAlias` holds the user-given names the Corteca console shows — Beacons (`DeviceCategory = WIFI_EXTENDER`, e.g. "MBR", "Kitchen") and clients (e.g. "TV Living Room") — plus `DeviceCategory`, `Manufacturer`, `ModelName`. `Device.X_ALU-COM_BeaconInfo.Beacon.{i}.FriendlyName` and the Beacon's own `X_ALU-COM_FriendlyName` are empty/defaults. The MCP visualizer reads it via `GET /api/network/[gatewayMac]/device-names` after the MCP data loads and applies it with `applyDeviceNames()` (`web/lib/deviceNames.ts`): AP cards show the nickname with the model as the kicker, client aliases are replaced (the original kept as "Detected name"), and the client panel adds "Detected as" (manufacturer · model — the gateway's own guess, sometimes wrong) and category. If the call fails (gateway offline), formal model names are kept (never sequential numbering). The REST visualizer uses the same route and `applyNamesToTopology()`: mesh APs get `nickname` (which `buildTree` in `web/lib/networkTopology.ts` prefers for diagram and map labels), members get the nickname as `alias`, and Ethernet card titles / port switch lists show nicknames.
- **Ethernet ports:** MCP has no per-port data. The **gateway** exposes live `Device.Ethernet.Interface.*` + `Device.Hosts.Host.*` (via `/api/network/[deviceId]/ethernet`). **Mesh APs don't** — their data model only has `DeviceInfo`/`X_ALU-COM_Wifi` (Ethernet isn't in the TR-181 Data Elements yet). For mesh APs the visualizer builds ports from MCP members (wired clients' `port_number`, 1 = WAN so 2 = LAN 1, and rx rate) plus the Ethernet backhaul link — labelled as reported, not live; empty ports can't be confirmed. **A gateway port's host list includes everything bridged behind it** — with Ethernet-backhauled Beacons that is every Beacon client too. `/api/network/[deviceId]/ethernet` returns all active hosts per port (`connectedHosts`; `connectedHost` only when exactly one), and `web/lib/portHosts.ts` splits them using MCP data into Beacons on the port, devices reached via those Beacons, and direct devices. ≥2 Beacons/direct devices that Corteca knows on a port ⇒ shown as an inferred "Switch" (active hosts Corteca doesn't list — e.g. an old randomized iPhone MAC — are shown but never count: every connected wired device appears in Corteca's clients); the gateway's host table goes stale (a host keeps its old `Layer1Interface` and `Active=true` after moving to WiFi), so hosts on a port whose link isn't Up, or that MCP reports as WiFi clients of the gateway, are counted as "N stale" and never drive the switch inference; Beacons on a switch show their client counts from MCP ("5 WiFi · 0 wired"), since some gateways don't attribute Beacon clients to any port; a mesh AP's Ethernet uplink is labelled with the gateway port it lands on ("Gateway LAN 1 (switch)"). The REST visualizer's `EthernetPortPanel` takes the same classification via its optional `context` prop (`portContextFromTopology()` in `web/lib/ethernetPorts.ts`). REST members carry the same `port_number` / `rx_statistics.rate` as MCP members (checked on 80-AB and 60-98-49-FF-9F-60; they also list the Beacons themselves as disconnected `ethernet` members with port 0). The REST visualizer's mesh Beacon panels come from `web/lib/meshApPorts.ts`: `restNetwork()` runs the REST mesh + members through `normaliseMcpNetwork()` and `applySwitches()` (with the gateway's live ports), and `meshApPorts()` fills the config/model-spec port layout — wired clients by `wiredPort()`, ≥2 on one port as an inferred switch (port rate = the port↔switch link), the Ethernet backhaul on WAN with its rate and gateway landing port (`gatewayPortOf`), clients with no or an unlisted port as extra rows; anything else is a neutral grey "Not Connected" (Corteca reports nothing on it; a mesh port can't be confirmed empty), rendered by `web/components/ReportedPortCells.tsx`. **Port layout per model:** mesh Beacons don't report their ports, but the same model working as a gateway does, so the ethernet route records each gateway model's live layout (`PortLayout`); both visualizers lay out a mesh Beacon's ports with `beaconPortLayout()` — this network's gateway if it is the same model, else the stored layout, else Nokia's spec sheet (`portSpecs.ts`), else generic WAN + 3 LAN — and say which in the panel note. The MCP AP panel (`ApEthernetPorts`) renders `meshApPorts()` the same way as the REST panel (every port, "Not Connected", inferred switch rows). A Beacon with a WiFi backhaul shows its WAN port as "Wireless backhaul · 6 GHz" (kind `wireless`; links to the backhaul in the MCP panel) unless a wired client is reported on it. Spec sheets don't say which LAN port is the fast one: listed fastest first, confirmed for Beacon 19.1 (LAN 1 negotiated 10 Gbps live).
- **Inferred switches on the canvas** (`web/lib/inferredSwitches.ts`, applied with `applySwitches()` after the gateway's live ports load in `useGatewayExtras`): gateway ports from the live host table (link Up, ≥2 Corteca-known Beacons/wired clients, via `portHosts.ts`); any AP's port — and the gateway's when live ports are unavailable — from ≥2 connected wired clients with the same Corteca `port_number`. A switch inferred from `port_number` takes its line's rate from the clients behind it (the highest `rx_statistics.rate`; behind a switch each reports the port↔switch link), the same rule as `meshApPorts()`; before, only live gateway switches had a rate. **The gateway's host table doesn't always list devices behind a switch** (48-41-7B-42-DC-61, a Beacon 3.1 gateway: LAN 2's hosts were only the 2 Beacons, while Corteca reported 2 wired clients with `port_number` 3 = LAN 2 too), so `classifyPortHosts(port, network, label)` adds the gateway's connected wired clients Corteca reports on that port to `direct`, and with live ports the gateway's own `port_number` switches still count on ports the host table doesn't show as a switch. A port with no current hosts reads "Not Connected" (old host-table entries — link down, device now on WiFi — only in the hover note, never "N stale"). That catches a client switch behind a mesh Beacon, but not a Beacon behind a mesh Beacon's switch, and chained switches show as one. `buildFlowGraph` adds a `switch` node and a `switchUplink` edge (`swu:<switch id>`); backhaul edges keep their `bh:<parent>:<child>` id but are drawn from the switch; a wired client's `wiredLink` comes from its owner (`clientOwner()`: switch, else AP); WiFi client cards are per AP (`cl:<AP>` / `<AP>:<band>`).
- **Clients without a nickname**: when the reported name is a placeholder (`Unknown_<mac>`, a MAC, or empty), `applyDeviceNames()` / `applyNamesToTopology()` show the gateway's detected model instead (e.g. "iPad Pro 12.9\" 2nd Gen (Wi-Fi)", as the Corteca console does), else manufacturer + category ("Google sensor"); identical derived names get the MAC's last bytes ("Nest Protect · 5A-94"). Real hostnames and user nicknames are never replaced; the original name stays visible in the client panel.
- **Renaming** (MCP visualizer): the pencil next to a Beacon's or client's name in the detail panel opens `RenameDeviceModal` (via `DeviceRenameProvider` / `useDeviceRename()` in `web/components/topology/DeviceRename.tsx`); it is offered only for devices in the gateway's device map. Save → `POST /api/network/[gatewayMac]/device-names` → USP SET `DeviceMap.{i}.HostAlias` on the customer's gateway (so the Corteca console/app show it too); the USP reply can be HTTP 200 even when rejected, so the route verifies by reading the value back. On success the page updates its names locally (`setNickname`) without re-reading.
- **Wired client port and speed** (`wiredPort()` / `wiredLinkLabel()` in `inferredSwitches.ts`): port = Corteca `port_number` − 1 ("LAN n"); checked against the gateway's live host table on 8 of 8 gateway-wired clients (80-AB, Kevin Doms 60-98-49-FF-9F-60). Mesh AP ports can't be cross-checked (no Ethernet object) and the physical port label hasn't been confirmed. Speed = the member's `rx_statistics.rate` (kbps), which matches the live port rate for a device plugged straight into a port; **behind a switch it is the port↔switch link, not the device** (e.g. a 100 Mbps Roku behind a gigabit switch reads 1 Gbps), so it is not shown there. `port_number` also appears on some WiFi clients — only used for wired.
- **MLO (WiFi 7 multi-link)** — seen on 11 of 103 WiFi 7 gateways in demo2 (2026-10-30; e.g. A8-FB-40-AE-F5-C3 MLO backhaul, 60-98-49-FF-A6-C0 MLO clients). **Backhaul:** MCP sends one link record per band for the same two APs; `buildBackhaul()` folds ≥2 WiFi records into one link with `mloBands[]` (fastest first; the link's rate/PHY/traffic/errors are totals, `band` = "6 GHz + 5 GHz high", standard = WiFi 7 MLO without the gateway), the link panel adds a "Bands" section. **Clients:** one member row per MLO client keyed by its MLD MAC, with `links[]` (per band: bssid, channel, frequency, per-link `mac`, signal, rx/tx rates); the top-level `frequency` names one link but `signal` can be another link's (6 GHz filed at -21 dBm that was really 2.4 GHz), so `clientSignalDbm()` takes the signal of the link on the filed band; `clientLinks()` / `clientBands()` (`clientFields.ts`): band filters match any link, `bandUpgrade()` uses the fastest, the client panel has a "Links" section and the Connection column reads "802.11be · MLO · 6 GHz (Ch 133) + 2.4 GHz (Ch 6)". **APs:** MCP's `mlds` (AP MLDs with their link BSSIDs, plus a `BSTA` MLD for the backhaul) → `ap.mlo` → "MLO" chip on the card. **Gateway:** MLO stations (backhaul and clients) are **not** in `Radio.*.BSS.*.STA` (no association request to decode) — only in `Device.{i}.APMLD.{j}.STAMLD.{k}` (`MLDMACAddress`, `AffiliatedSTA.*.MACAddress`/`BSSID`); wifi-details maps each to WiFi 7 MLO (backhaul when an affiliated MAC is a `BackhaulSta`).
- **Backhaul radio / channel by BSSID:** an AP may run fronthaul and backhaul on different radios (channels) of one band, so `applyWifiDetails()` finds a link's radio by the parent's BSSID in the link record (`parentBssid`, matched to `Radio.*.BSS.*.BSSID`), then the child's `BackhaulSta.MACAddress`, and only then by band label (no guess when several radios share the band). Matched radios get `backhaul: true` → a "Backhaul" tag in the AP panel's Radios section.
- Mesh link `medium` (`"wifi-6"`, `"ethernet"`) names the **band**, not the WiFi standard: every wireless backhaul seen reports `"wifi-6"` and its endpoint BSSIDs belong to the APs' 6 GHz (`BAND06`) radios, including links between WiFi 7 Beacons. Tri-band WiFi 6 Beacons with no 6 GHz radio (e.g. Beacon 6) split 5 GHz into `BAND50LOW`/`BAND50HIGH` radios and back-haul on the high one (`medium` `"wifi-5high"`). MCP gives no backhaul WiFi standard; the gateway does: `Device.WiFi.DataElements.Network.Device.*.Radio.*.BSS.*.STA.*.ClientCapabilities` holds the raw (Re)Association Request each child Beacon's backhaul station (`…Radio.*.BackhaulSta.MACAddress`, = the child endpoint's `bssid` in the MCP link) sent. A station only includes a generation's capabilities element when the AP offers it, so the highest element present is the link's standard (HT → WiFi 4, VHT → 5, HE → 6, EHT → 7; Multi-Link element → MLO). `/api/network/[gatewayMac]/wifi-details` reads only the needed values with USP search paths (falling back to the whole Data Elements tree) and decodes them (`web/lib/wifiAssociation.ts`); the page fetches it after each MCP load with the names (`useGatewayExtras`) and merges it in with `applyWifiDetails()`; the link panel then shows "WiFi 7 (802.11be) · 6 GHz" plus "Multi-link (MLO)" for WiFi 7. Backhaul stations are **not** in `Device.WiFi.AccessPoint.*.AssociatedDevice` (no `OperatingStandard`). If the read fails or decodes nothing, the band-only view stays. `buildBackhaul()` sets `band` from the endpoint BSSIDs (falling back to the medium), so the link panel shows "WiFi · 6 GHz" or "WiFi · 5 GHz high", and AP "Bands" list radios ("2.4 GHz · 5 GHz low · 5 GHz high"). **"5 GHz low/high" only for an AP that reports both `BAND50LOW` and `BAND50HIGH`** (Beacon 6, Beacon 24): single-5 GHz Beacons also tag their one radio `BAND50HIGH` (Beacon 9), so they read plain "5 GHz" (`radioLabeler()` in `mcpNetwork.ts`; the Radios section uses the same rule in `labelRadios()`). Client-facing band lists (`ssidBands`, filter chips) keep a single "5 GHz".
- **Beacon 6 reports backhaul `dataRate` / `data-rate-*` in Mbps** (e.g. `dataRate 1441` next to `phyRate 1441000`), newer Beacons in kbps. `linkRateKbps()` treats a data rate under 1% of the PHY rate as Mbps.
- Units: link/client `data-rate-*`, `derivedData.dataRate|phyRate` and client `rx/tx_statistics.rate` are kbps; `*-bytes` / `statistics.bytes` are cumulative byte counters. From the AP's view, its tx is the client's download.
- **Activity log** (`web/lib/networkEvents.ts`, checked on demo2 2026-11-12): `GET /activity-log/networks/{id}/activity_traces/?from&to&size&page` (the docs' `/networks/{id}/activity` returns 500). **At most 500 rows per page, pages start at 0** — a busy network fills 500 in under a week, so the route pages (up to 10). Rows: `{ id, date, operation, device_id, member_id, origin{type,origin_id}, service, data }`; **a client's events carry its MAC in `device_id`** (`member_id` filtering returns nothing). Operations seen: `DEV_CONNECTION_LOST/OK` (`CONNECT`/`BOOT` flags; an OK with no LOST before it is a routine reconnect), `DEV_SWITCH_OFF/ON`, `DEV_REBOOT` (`reason` e.g. LocalReboot, `role` Controller/Agent, `time_off` in **ms**, 0 = unknown), `NODE_OFFLINE/ONLINE` (`new_health`), `MESH_BACKHAUL_STATUS_CHANGED` (`prev/new_health` good/normal/bad — normal reads as fair; one network flapped normal↔bad 122× a month), `MESH_BACKHAUL_TYPE_CHANGED` (`prev/new_medium` wifi-6, wifi-5high…), `USP_CHANNEL_CHANGE` (`new_channel` only, no band), `NEW_MEMBER_IN_NETWORK`, `DEVICE_TYPE_CHANGE`, `DEVICE_FRIENDLYNAME_CHANGE`, `HOME_CONSOLE_LOGS` + `SYSTEM_LOGIN` (every console visit — filed as Console sessions), `MEASURES_DIAGNOSTICS_UPDATED`, `UBUS_LOG_UPLOAD`, devicehub `PUT_/POST_…` operator changes. **`POST_DEVICEHUB_DEVICES_ROUTER_ITEM.data.payload` can contain `pswdNew` / `wpaKey`** — `sanitiseEventData()` drops payloads and secret-looking keys/values before anything leaves the server. On demo2 (2026-11-13) all 69 such requests were `act=ConfigWhwPswd` (`resource=whw_onboarding_app.cgi`, with `wl_ssid`) and Corteca had already blanked the password fields, so the route's `markSsidResets()` (`web/lib/ssidReset.ts`, before sanitising) flags `act=ConfigWhwPswd` or a filled `pswdNew` / `wpaKey` as `data.ssid_reset = "true"` — only the flag leaves the server. Also seen across 80 networks: `DEV_FIRMWARE_UPGRADED` (`STATUS` initiated, or none with `old/new_firmware`; `ERROR_MESSAGE`), `DEV_CONFIG_PUSH` (`STATUS` initiated / success, `CONFIG_NAME`), `DEV_REBOOT` reasons `FactoryReset` / `LocalFactoryReset` / `RemoteFactoryReset` / `RemoteReboot` / `power_cycle`, `NEW_NODE`, `NETWORK_EXTENDER_ADDED`, `DEV_CLAIMED`, `NEW_DEV_CONNECTED`, `UBUS_NOISE_ALARM`, `STATION_DELETED` (`station_mac`), `DEVICE_REBOOT` (origin USER), `SUBSCRIBER_CUSTOM_TAG_UPDATE`, `USER_PROFILE_CREATE` / `USER_PROFILE_PREFERRED_LANGUAGE_UPDATE`, `DEV_TIMEZONE_CHANGED`. Never seen: restore / backup, network slices, network ID, radio restart, role change / promoted to root, IPv4 update, failed association / no IP, gateway connected to modem.
- **Client roaming history** (`web/lib/roamingHistory.ts`): `GET /dashboard-bff/networks/{id}/members/{MAC}/rssi?from&to` (checked on demo2 2026-11-09) returns `{ init_date, end_date, events[] }` with `ASSOCIATED` (AP `device_id`, `band` "5GHz_high", `channel`, `rssi_value`), `DISASSOCIATED` (`reason_code`), `RSSI_CHANGED` (samples while connected; one at `init_date` = already connected) and `DEV_SWITCH_OFF` (that AP off). Not the docs' `ASSOCIATION` / `timestamp` names. Without from/to it gives 7 days; history reaches ~2.5 weeks back. Rows repeat and can arrive out of order. `roamSessions()` turns them into sessions: an `ASSOCIATED` while connected to another AP/band = a roam (no DISASSOCIATED in between), a reconnect within 2 min of a disconnect also counts as a move, re-association to the same AP/band is the same session. **MLO:** events carry `links[]` (frequency, rssi, sometimes channel), and the top-level `band` names one link, so the band comes from the links and a changed link set on the same AP isn't a band change; an MLO association is often filed twice within a second — by the Beacon (links with frequencies) and by the gateway (no frequencies) — the gateway copy is dropped (`isGhostAssociation`), else it reads as a fake roam. Corteca sometimes misses the reconnect after an AP restart, so `withLiveConnection()` adds the connection MCP shows now. The fleet-wide alternative, `/ouife/steering/details/ouifeapi` (CSV, ~8 MB per day for the whole cluster, no per-network filter), isn't used.
- **Rates** are formatted everywhere by `formatRate()` (`web/lib/rateFormat.ts`): always "Mbps"/"Gbps", whole Mbps, Gbps without trailing zeros ("100 Mbps", "1 Gbps", "2.5 Gbps"); diagram labels keep up to 1 decimal, detail panels up to 2 ("1.44 Gbps").
- **Port order in the layout** (`web/lib/flowOrder.ts`, applied at the end of `buildFlowGraph`): what hangs off a device is ordered by port — LAN 1, LAN 2, … (switches, wired clients, Beacons wired straight into a gateway port: `network.beaconPorts` from the live host table), then wireless Beacons, then the WiFi client card. Nodes are emitted depth-first in that order; Tree/Sideways force it with `elk.layered.crossingMinimization.forceNodeModelOrder` (LAN 1 left / on top), Radial uses `elk.radial.sorter: ID` with each node's `orderId` (clockwise).
- Topology canvas rule: **no edge may run under a card it doesn't connect, and no backhaul label may cover a card or another label, in any layout.** Tree/Sideways draw edges along ELK's orthogonal routes (never bezier between handles); Radial uses straight routes after `spreadRadial()`. Edge components must take their path and label position from `edge.data.points` + `labelBox()`, not from React Flow's `sourceX/targetX`.
- In-app usage: `/mcp-network-visualizer` → `GET /api/mcp/network/[homeWifiId]` → `retrieve-network-data`.
- Claude Code usage: registered locally as MCP server `corteca`, authenticated by `scripts/corteca-mcp-headers.mjs` (a `headersHelper` that logs in with `CORTECA_CLIENT_ID`/`CORTECA_CLIENT_SECRET` + `CORTECA_MCP_USERNAME`/`CORTECA_MCP_PASSWORD` from `.env`). Tokens last ~15 min; reconnect via `/mcp` if calls start returning 401.

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
- `app/mcp-network-visualizer/page.tsx` — subscriber card

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

Uses Prisma with a Neon PostgreSQL database (moved from Supabase on 2026-11-04). Five models:

| Model | Purpose |
|---|---|
| `SwMatrix` | Singleton (id=1). Stores the Beacon firmware release matrix: `beaconModels` (JSON array — entries are a model name string, or `{ name, wifi }` when a WiFi generation is set) and `releases` (JSON array). Seeded via `prisma/seed.js`. |
| `DeploymentReport` | Singleton (id=1). Cached deployment report: device list, column headers, raw rows, stats, USP map. Updated when SW Overview fetches fresh data. Shared across serverless instances via DB. |
| `PortLayout` | One row per device model (`modelKey()`: "beacon 10"): RJ-45 ports (name, WAN or not, max Mbps), hardware version, source (`live`/`documentation`/`manual`), sample MAC. Written by `/api/network/[deviceId]/ethernet` (in `after()`, so no latency) whenever a gateway's live ports differ from what's stored. |
| `RadioBands` | One row per device model (`modelKey()`): the WiFi radio bands its online APs have reported (`["2.4 GHz", "5 GHz"]`; union over APs, a split 5 GHz low/high wins over plain 5 GHz), sample MAC. Written by `/api/mcp/network/[id]` and `/api/network/[deviceId]` in `after()` (no latency) when a model's list grows. If the DB is unreachable, learning stays in memory and the built-in `RADIO_SPECS` table covers. |
| `ApiSession` | One row per login session. Tracks call count, bytes sent/received, rate limit hits. Persisted via `PUT /api/sessions` with debounce; final flush on logout using `keepalive`. |

### Database Commands
```bash
npm run db:push       # push schema to DB (uses DIRECT_URL)
npm run db:generate   # regenerate Prisma client
npm run db:studio     # open Prisma Studio
npm run seed-matrix   # seed initial SW matrix data
```

### Neon connection

- **Driver:** `web/lib/prisma.ts` gives Prisma the Neon serverless driver (`@prisma/adapter-neon` + `@neondatabase/serverless` over `ws`, `driverAdapters` preview feature) whenever `DATABASE_URL` is a `neon.tech` URL — a WebSocket on port 443. Prisma's own Postgres connection to Neon's pooler failed from Vercel ("Can't reach database server"), and the corporate network blocks the Postgres protocol (TCP to 5432 opens, the TLS handshake hangs) while 443 works, so the adapter also makes `npm run dev` reach the DB from the office. Other URLs connect the normal way.
- `next.config.mjs` lists `ws`, `@neondatabase/serverless` and `@prisma/adapter-neon` in `serverExternalPackages`: bundled, `ws` fails at runtime with `b.mask is not a function`.
- **Connection strings:** pooled host (`-pooler`) for `DATABASE_URL` with `sslmode=require&pgbouncer=true&connection_limit=1&connect_timeout=15`, direct host for `DIRECT_URL`; drop Neon's `channel_binding=require`. `Authentication failed for user (not available)` in the Vercel logs = wrong password in the Vercel value (Vercel hides sensitive values — overwrite, then redeploy).
- **Free plan:** compute suspends after ~5 min idle; the first query afterwards wakes it (~0.5 s). There is no inactivity pause of the project, so no keepalive cron.
- **Schema changes from the corporate network:** `prisma db push` needs port 5432. Generate the SQL offline (`npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`, or `--from-url` off-network for a diff) and run it in the Neon SQL editor, or push from another network.
- Timestamps are `timestamp(3)` (UTC) as Prisma defines them; the old Supabase tables had `timestamptz`.

---

## Key Server-Side Library Modules (`web/lib/`)

| Module | Purpose |
|---|---|
| `corteca/cortecaFetch.ts` | Wraps `fetch` with timeout, stats tracking, and rate-limit detection |
| `corteca/apiStats.ts` | In-memory counters (calls, bytes, rate limits) reset on login |
| `corteca/reportCache.ts` | In-memory + DB cache for the fleet deployment report; avoids re-fetching on every request |
| `corteca/mcpClient.ts` | Minimal Streamable-HTTP MCP client (`callMcpTool`) for the Corteca AI MCP server; uses the user's `corteca_token` as bearer |
| `corteca/nameCache.ts` | Server-side MAC→accountName cache shared between API routes |
| `corteca/deploymentReport.ts` | Fetches and normalises the Corteca deployment report; populates `reportCache` and DB |
| `corteca/networkTopology.ts` | Normalises raw mesh topology API shapes into a consistent tree structure |
| `corteca/subscribers.ts` | Subscriber search and lookup helpers |
| `corteca/network.ts` | Network device and member fetch helpers |
| `corteca/usp.ts` | USP TR-369 data model traversal helpers |
| `corteca/types.ts` | All shared TypeScript interfaces (Subscriber, Member, MeshAP, etc.) |
| `fetchWithAuth.ts` | Client-side authenticated fetch; fires DOM events for stats, triggers ReloginModal on 401, fires the `ApiLogInterceptor` for the API log panel |
| `reportNameEnrichment.ts` | `findDeviceIdInfo()` heuristic to find MAC/serial columns in CSV report rows; `injectAccountNames()` to prepend account name column |
| `subscriberSearch.ts` | Search fields, Auto detect, Corteca query mapping (`upstreamQueries()`), `subscriberName()` / `subscriberKey()` |
| `useSubscriberSearch.ts` | Client hook for `/api/subscribers` (latest search wins) |
| `reportTypes.ts` | `REPORT_CONFIGS` — display name, chart color, Corteca type strings for all 8 report types |
| `networkTopology.ts` | Parses raw mesh/topo API responses into normalised `NetworkTopologyData` |
| `topologyFlow.ts` | `buildFlowGraph()` (McpNetwork → React Flow nodes/edges, one client node per AP so each subtree stays one card wide, sizes pre-measured), `layoutFlowGraph()` (ELK; returns node positions **and** edge routes in `edge.data.points`), `backhaulLabel()` |
| `edgeGeometry.ts` | Edge/label geometry for the topology canvas: `labelBox()` (where a backhaul label sits), `layoutProblems()` (edge under a card, label covering a card/label), `spreadRadial()` (scales a radial layout out from the gateway until `layoutProblems()` is empty) |
| `portLayouts.ts` | Port layout types, `modelKey()`, `beaconPortLayout()` (mesh Beacon layout: same-model gateway live → stored → spec sheet → generic, with a source note), `withSpecMaxRates()` |
| `radioBands.ts` | AP radio bands: `radioBandLabels()` (BAND24/BAND50LOW/… → labels, low/high only when both 5 GHz radios), `RADIO_SPECS` (per model, from a 2026-10-30 survey of online APs in the fleet), `bandsForModel()` (learned ∪ spec), `applyModelBands()` — **an offline AP reports no bands**, so the MCP visualizer fills them from its model and `BandsValue` notes "from other Beacon 3.1s · AP offline" / "Beacon 3.1 spec · AP offline"; `meshApBands()` (online APs' bands from a raw mesh payload) |
| `corteca/radioBandStore.ts` | Server: `getModelBands()`, `recordApBands()` (RadioBands table + memory on `globalThis`) |
| `useModelBands.ts` | Client hook: learned bands per model, fetched once per page load |
| `portSpecs.ts` | RJ-45 layouts from Nokia's spec sheets (WAN + LAN speeds per model); fills LAN max speeds TR-181 reports as auto |
| `corteca/portLayoutStore.ts` | Server: `getPortLayouts()`, `recordLivePortLayout()` (PortLayout table + memory cache) |
| `usePortLayouts.ts` | Client hook: stored layouts, fetched once per page load |
| `ethernetPorts.ts` | REST visualizer Ethernet ports: live → device config → model-spec fallback (`resolvePorts`) |
| `meshApPorts.ts` | REST visualizer mesh Beacon ports: `restNetwork()` (REST topology → McpNetwork + switches), `meshApPorts()` (reported wired clients, switch, uplink per port) |
| `portHosts.ts` | Classifies hosts learned on a gateway Ethernet port (Beacons / via-Beacon / direct), infers switches, finds the gateway port a mesh AP's backhaul uses |
| `deviceNames.ts` | `applyDeviceNames()` (MCP network) and `applyNamesToTopology()` (REST topology) — overlay gateway device-map nicknames (AP `nickname`, client `alias`, identity fields) |
| `clientInsights.ts` | Client traffic, supported bands, `bandUpgrade()` (client on a slower band than it and its AP support for that SSID), IEEE disconnect-reason text (`reasonText()`), top talkers per AP |
| `networkEvents.ts` | Activity log events: `parseEvents()`, `sanitiseEventData()`, categories (`EVENT_CATEGORIES`, `eventCategory()`), health / medium wording |
| `eventItems.ts` | `buildEventItems()`: raw events → rows (outages, backhaul episodes, channel / band bursts, singles, routine) with titles, details, fields |
| `eventStats.ts` | Period / device filters, `summarise()`, `dayBuckets()`, `apStats()`, `timelineSegments()`, `eventsToday()`, diagram badge `apBadge()` / `isSilenced()` |
| `eventFormat.ts` / `eventAcks.ts` / `useNetworkEvents.ts` | Time / duration wording and CSV; acknowledged / silenced badges (localStorage, per AP); the fetch hook + `useEventNames()` (device names and diagram selections for event rows) |
| `eventPriority.ts` / `tdsEvents.ts` / `tdsStats.ts` / `ssidReset.ts` | TDS Network Events RCR: P1–P4 per event and row (`eventPriority()`, `itemPriority()`, `PRIORITY_META`); TDS rows (`toTdsItems()`: level, `TdsGroup` category, extra wording); range / filters / hourly-or-daily buckets / CSV with levels; server-side WiFi password flag (`markSsidResets()`) |
| `roamingHistory.ts` / `useRoamingHistory.ts` | Client roaming history: `parseRssiHistory()`, `roamSessions()`, `withLiveConnection()`, `sessionsSince()`, `summarise()`; the hook reads `/api/networks/[id]/members/[mac]/rssi` per network snapshot |
| `topologySelection.ts` | Selection types, path highlight (`highlightFor`), client filters, search, keyboard order, and URL (de)serialisation for the MCP visualizer |
| `recentNetworks.ts` | localStorage list of networks recently opened in the MCP visualizer (with subscriber, for the header chip) |
| `networkTabs.ts` / `useNetworkTabs.ts` | MCP visualizer tabs: `MAX_NETWORK_TABS`, `TabStatus`, sessionStorage restore; the hook opens (switch if open, else add, else park in `pending` for the limit dialog), closes, activates and tracks per-tab status / "updated in the background" |
| `useTopologyViewState.ts` | One tab's view state; the tab on screen mirrors it into the query string via `history.replaceState` |
| `mcpNetwork.ts` | `normaliseMcpNetwork()` — turns an MCP `retrieve-network-data` payload into `NetworkTopologyData` (synthesising the AP tree from `meshbackhaulnodes`), AP summaries, and `Member[]` |
| `networkMembers.ts` | Fetches and normalises connected client members for a network |
| `sessionHistory.ts` | LocalStorage session record helpers for the API usage dashboard |
| `swMatrix.ts` | Beacon SW release matrix helpers |
| `wifiGeneration.ts` | WiFi generation list/type for Beacon models (client + server safe) |
| `geoUtils.ts` | Marker / account-name localStorage caches for the network map |
| `geoRegions.ts` | Server only: `regionOf(lat, lng)` — country + UN M49 continent from `@rapideditor/country-coder` (US/Canada always North America; everyday names via `Intl.DisplayNames`), US states / Canadian provinces by point-in-polygon on Natural Earth 1:50m admin-1 (`web/lib/geo/us-ca-admin1.json`, 0.01° coordinates; within ~50 km of an outline counts; US territories such as Puerto Rico stand in for a state) |
| `regionFilter.ts` | `GeoRegion`, `RegionFilter`, `matchesRegion()`, `filterOptions()` (counts per level, US/Canada first), `pruneFilter()`, `describeFilter()` |
| `useRegionFilter.ts` / `useNetworkRegions.ts` | Network Map hooks: regions per located network (debounced POSTs as networks arrive) and the filter state / filtered networks / MAC set for the table |
| `wheelZoom.ts` | `wheelPixels()`: wheel distance in CSS pixels whatever the unit; the REST topology graph zooms by distance so a smooth-scrolling mouse (one notch = a burst of small events) zooms one step per notch |
| `networkLocation.ts` | `extractLatLng()` (lat/lng from a device summary, any key names), `osmUrl()` |
| `mapBasemap.ts` | MapLibre setup shared by both maps: `setWorkerUrl()` to the worker copied into `public/maplibre/`, `STYLE_URL` (OpenFreeMap Positron), `tintBasemap()` (Corteca palette), `MAP_FRAME` (frame + popup card classes) |
| `prisma.ts` | Prisma client singleton (avoids too-many-connections in serverless); Neon serverless driver adapter for `neon.tech` URLs |
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
| `DATABASE_URL` | Neon pooled URI (`-pooler` host) — used by the app at runtime, through the Neon serverless driver |
| `DIRECT_URL` | Neon direct URI (port 5432) — used only by `prisma db push` and seed scripts |
| `CORTECA_MCP_URL` | Optional. Corteca AI MCP endpoint; defaults to `${CORTECA_API_BASE_URL}/ai/mcp` |
| `SITE_USERNAME` | Gate username protecting the entire app |
| `SITE_PASSWORD` | Gate password |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 3 — utility classes only, `cn()` for conditionals |
| UI Components | Radix UI (Dialog, Popover, Tabs, Slot) |
| Charts | Recharts |
| Graph diagrams | React Flow (`@xyflow/react`) + ELK (`elkjs`) for layout — MCP visualizer only; loaded via `next/dynamic` with `ssr: false` |
| Maps | MapLibre GL JS 6 + OpenFreeMap vector tiles (fleet Network Map, REST visualizer location map; loaded via `next/dynamic` with `ssr: false`) |
| ORM | Prisma 5 |
| Database | PostgreSQL (Neon), via the Neon serverless driver |
| Auth | Custom cookie-based (no NextAuth) |
| Deployment | Vercel (serverless) |

**Prohibited:** Material UI, Emotion, Styled Components, `@apply` in CSS (except global base styles).

---

## Key Client Libraries

- **`clsx` + `tailwind-merge`** → combined as `cn()` in `web/lib/utils.ts` for safe conditional class merging
- **`recharts`** → all charts (bar, area). Import only what's needed.
- **`maplibre-gl`** → both maps (no Leaflet). Load with `next/dynamic` + `ssr: false`; import `maplibre-gl/dist/maplibre-gl.css` in the component. MapLibre 6 loads its web worker from a separate file that Next doesn't bundle: `postinstall` runs `scripts/copy-maplibre-worker.mjs` to copy it to `public/maplibre/` (gitignored) and `web/lib/mapBasemap.ts` points `setWorkerUrl()` at it. Paint expressions: a `["zoom"]` expression can't be nested (e.g. inside `"+"`) — write a separate curve.
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
  mcp-network-visualizer/page.tsx
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
    network/[deviceId]/{route,ethernet,wan,location,datamodel,datamodel/set}.ts
    mcp/{network,analyze,troubleshoot}/[homeWifiId]/route.ts
    networks/[networkId]/{activity/route,members/{route,[memberId]/rssi/route}}.ts
    network-map/{route,account-names,locate,regions,device-info/[mac]}.ts
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
    landing/                      # Dashboard landing page: LandingCard, FeaturedCard, OtherAppsSelect
    corteca/                      # Corteca-console look: CortecaPage (page shell), CortecaCard, StatusPill, HealthTile, OutlineButton, SegmentedControl, Notice, styles.ts (CARD)
    alarms/                       # Network Alarms: AlarmQueryForm (+ .types.ts), AlarmSeverityChips, severity.ts
    NetworkDebugPanel.tsx         # REST visualizer raw-response debug panel
    SwFleetHealth.tsx             # SW Overview fleet health tiles
    DataModelBrowser.tsx
    EthernetPortPanel.tsx
    ReportedPortCells.tsx         # EthernetPortPanel cells for mesh Beacon ports built from Corteca reports
    GlobalNetworkMap.tsx          # Fleet Network Map (MapLibre): clusters, hover/pinned network card
    map/                          # MapLibre pieces: RegionFilterBar + MultiSelectMenu (Network Map location filters), fleetMapStyle.ts (cluster/point layers), FleetMapPopup, FleetMapOverlay (legend), MapZoomButtons, LocationMap (the home as one fleet-style marker; full or compact), homeMapStyle.ts (its dot/bubble layers), HomeNetworkCard (AP list card)
    PortFaceplate.tsx             # Rear view of a device's RJ-45 ports (REST port panel); PortIcon jack for the MCP AP panel's port rows
    McpAccessPointCards.tsx
    mcp/                          # MCP visualizer tabs: NetworkWorkspace (one open network: data, Refresh, gateway reads, AI, view), NetworkTabs (tab strip, tabLabel())
    McpTopBar.tsx                 # MCP visualizer top bar: search, subscriber chip, AI analysis, Refresh, Console button (+ .types.ts)
    McpDebugPanel.tsx             # Raw retrieve-network-data response (debug); exports McpResponse
    events/                       # MCP visualizer network events: EventsContext (useEventsController: load, drawer, filters, acks), EventsDrawer (under the legend), EventsExpanded (over the canvas), EventsBody, EventSummaryTiles, EventDayBars, EventFilters, EventList, EventRow, EventsChrome, ApEvents + BadgeAckBar (AP panel), ClientEvents (client panel), EventBadge (AP card badge + acknowledge / silence popover)
    tds-events/                   # TDS Network Events RCR popout: TdsEventsContext (useTdsEventsController, own drawer/filters on top of the standard controller), TdsEventsDrawer, TdsEventsExpanded, TdsBody (fixed top over the list), TdsBars (P1–P4 bars + PriorityPill), TdsTimeline (exact-time severity lanes), TdsFilters (range incl. custom, severity / type chips, device, routine)
    ai/                           # MCP visualizer AI: AiAnalysisCard, MarkdownReport, DiagnosisView, TroubleshootForm
    SubscriberSearch.tsx          # Customer search: field chips + SubscriberResultsTable
    SubscriberSearchBox.tsx       # Compact subscriber search (field select) with dropdown results
    search/SearchFieldChips.tsx   # Auto detect / Name / Email / Customer ID / MAC / Serial number chips
    RecentNetworksDrawer.tsx      # Left rail + overlay list of recently viewed networks
    topology/                     # React Flow canvas for the MCP visualizer
      TopologyCanvas.tsx          # ReactFlow + ELK layout, legend, minimap, full screen
      ApNode.tsx                  # AP card node
      ClientClusterNode.tsx       # Per-AP client card, sections stacked by band
      BackhaulEdge.tsx            # Quality-coloured, rate-weighted backhaul edge drawn along its layout route
      RouteEdge.tsx               # AP → client-card connector; routePath() rounds orthogonal routes
      GatewayLocation.tsx         # Gateway / WAN panel "Location" mini-map (location fetched once per gateway); expands over the diagram
      CanvasOverlay.tsx           # Context + frame for panel content drawn over the diagram area (the expanded map)
      ApEthernetPorts.tsx         # AP detail panel "Ethernet ports" (compact faceplate + port list): gateway live (REST, fetched on open, cached), mesh APs from MCP wired clients
      ApRadios.tsx                # AP panel "Radios": channel, width, airtime bar, noise (gateway Data Elements)
      AiNotesSection.tsx          # AP/client panel lines from the AI analysis report
      ClientRoaming.tsx           # Client panel "Roaming history": period chips, summary, time per AP, connection list
      RoamingTimeline.tsx         # Its bar of connections coloured by AP
      SwitchNode.tsx              # Inferred switch card (dashed)
      SwitchUplinkEdge.tsx        # AP port → switch line, labelled "LAN 1 · 1 Gbps"
      SwitchDetails.tsx           # Switch panel: evidence, Beacons and wired clients behind it
      WiredClientNode.tsx         # A wired client's own pill node
      WiredLinkEdge.tsx           # AP/switch port → wired client line, labelled "LAN 3 · 100 Mbps"
      InternetNode.tsx            # Internet card above the gateway (WAN status)
      WanEdge.tsx                 # Internet → gateway line with the "WAN · 5 Gbps" pill
      FlowPath.tsx                # Moving-dot overlay on links with a rate (backhaul, switch, WAN); flowSeconds()
      WanDetails.tsx              # WAN panel: Internet connection, WAN interface, WAN port
      flowTypes.ts                # React Flow nodeTypes / edgeTypes for the canvas
      SectionIcon.tsx             # Detail-panel section header icons, by section name
      useSectionCollapse.ts       # Folded detail-panel sections (localStorage, shared by every panel)
      DeviceRename.tsx            # Rename context: panel pencil → RenameDeviceModal → gateway HostAlias
      useGatewayPorts.ts          # Gateway's live Ethernet ports: `readGatewayPorts()` shares one in-flight read between the page and the AP panels, retries once, caches successes only (a failed read of several sent at once used to stick as "unavailable")
      TopologyLegend.tsx
      ZoomControls.tsx            # +/−/Fit buttons shown beside the legend
      useCanvasKeyboard.ts        # Arrow keys / Esc for the canvas; clicks keep focus on it
      TopologyToolbar.tsx         # Client search, filter chips, layout switch, full screen
      TopologyContext.tsx         # Selection/highlight/filter/layout context read by nodes & edges
      NodeDetailPanel.tsx         # Side panel: AP / link details (+ ClientDetails.tsx, DetailParts.tsx)
      qualityStyles.ts            # Shared good/fair/poor Tailwind classes
    Navbar.tsx
    NetworkMap.tsx                # REST visualizer location map (MapLibre): the home's marker + AP card
    NetworkMapControls.tsx
    NetworkMapSearch.tsx
    NetworkTopologyMap.tsx
    Providers.tsx                 # Wraps ApiLogProvider + ApiLogPanel + Auth + Stats
    RebootChart.tsx
    ReportChart.tsx
    SwDrilldown.tsx
    SwHeatmap.tsx
    UnknownFirmwareList.tsx
    WifiFilterPills.tsx
    UsageChart.tsx
    modals/
      AssignFirmwareModal.tsx
      ConfirmModal.tsx
      LoginModal.tsx
      RenameDeviceModal.tsx       # Edit a Beacon/client nickname (+ .types.ts)
      TabLimitModal.tsx           # MCP visualizer: all tabs in use — close one to open the waiting network (+ .types.ts)
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
      SubscriberResultsTable.tsx  # Search results: name, email, MAC, customer ID, serial, model, status
      SwNetworkTable.tsx
    ui/
      Button.tsx
      Hint.tsx                    # Quick hover/focus tip (toolbar chips, network tabs)
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
      mcpClient.ts
      nameCache.ts
      network.ts
      provisioning.ts
      reportCache.ts
      subscribers.ts
      types.ts
      usp.ts
    fetchWithAuth.ts
    clientInsights.ts
    networkEvents.ts              # Activity log: parse, sanitise, categories
    eventItems.ts                 # Activity events → grouped rows
    eventStats.ts                 # Event filters, totals, per-AP stats, diagram badge
    eventFormat.ts                # Event times / durations, CSV
    eventAcks.ts                  # Acknowledged / silenced badges (this browser)
    useNetworkEvents.ts           # Activity log fetch + event device names
    eventPriority.ts              # P1–P4 severity per activity-log event / row
    tdsEvents.ts                  # TDS rows: level, category, wording
    tdsStats.ts                   # TDS range, filters, buckets, CSV
    ssidReset.ts                  # Server: flags WiFi password requests before sanitising
    roamingHistory.ts             # Client roaming sessions from Corteca's per-client RSSI history
    useRoamingHistory.ts
    deviceNames.ts
    wifiAssociation.ts            # Decodes a (Re)Association Request into WiFi generation + MLO
    rateFormat.ts                 # formatRate(): "100 Mbps" / "1 Gbps" / "2.5 Gbps" for every link speed
    flowOrder.ts                  # Port-ordered (LAN 1, 2, …) depth-first node order for the canvas layout
    inferredSwitches.ts           # Switches inferred from gateway ports / wired clients' port numbers; owner lookups
    clientFields.ts               # Client band / signal / name helpers (re-exported by topologyFlow)
    clientCluster.ts              # Client-card sizing and clusterNode() for the canvas
    wifiRadios.ts                 # Data Elements radio → channel/width/airtime/noise (operating classes, 0–255 and ANPI scales)
    wifiDetails.ts                # wifi-details types, validation, applyWifiDetails(), clientStandard()
    aiAnalysis.ts                 # analyze-network report parsing / per-device notes, troubleshoot diagnosis validation
    useAiAnalysis.ts              # On-demand analyze / troubleshoot state for the open network
    useGatewayExtras.ts           # Fetches gateway names + wifi-details + ports + WAN after each MCP load
    wanInfo.ts                    # WanInfo type, parseWan() (TR-181 WAN interface → port chain), double-NAT note
    portHosts.ts
    ethernetPorts.ts
    meshApPorts.ts                # REST visualizer: mesh Beacon ports from members/backhaul/inferred switches
    edgeGeometry.ts
    geoUtils.ts
    wheelZoom.ts                  # wheelPixels(): wheel distance for the REST topology graph zoom
    networkLocation.ts            # extractLatLng(), osmUrl()
    mapBasemap.ts                 # MapLibre worker URL, Positron style, Corteca tint, map frame classes
    mcpNetwork.ts
    topologyFlow.ts
    topologySelection.ts
    recentNetworks.ts
    networkTabs.ts                # MCP visualizer open tabs: limit, status type, sessionStorage
    useNetworkTabs.ts
    useTopologyViewState.ts
    networkMembers.ts
    networkTopology.ts
    prisma.ts
    reportNameEnrichment.ts
    reportTypes.ts
    sessionHistory.ts
    swMatrix.ts
    utils.ts
    wifiGeneration.ts

middleware.ts                     # Site gate enforcer — redirects to /gate if no cookie
```

## Component Naming

- **Files:** PascalCase for all component files (e.g., `UserTable.tsx`)
- **Exports:** Named exports for all components
- **Props:** Define component props in a matching `.types.ts` file if they exceed 5 properties

## Corteca Style (UI standard)

"**Corteca style**" means: make the page look and behave like the real Nokia Corteca console (Home troubleshooting / console home). When asked to build or change a dashboard "in the Corteca style", follow this section. Reference implementations: `app/sw-overview/page.tsx`, `app/alarms/page.tsx`, `app/devices/page.tsx`; building blocks live in `web/components/corteca/`.

### Page template
```tsx
if (isLoading || !isAuthenticated) return <CortecaLoading />;

return (
  <CortecaPage
    title="My Dashboard"                                   // breadcrumb: "Dashboards / My Dashboard"
    crumbs={[{ label: "Parent", href: "/parent" }]}        // optional middle crumbs
    meta="One-line description · Report as of …"           // small grey line under the title
    actions={<OutlineButton icon={…}>Refresh</OutlineButton>}
  >
    {error && <Notice tone="error" title="Couldn't load …">{error}</Notice>}
    <CortecaCard title="Summary" info="Optional (i) tooltip text">
      <div className="grid grid-cols-2 gap-y-4 md:grid-cols-4 md:divide-x md:divide-neutral-200">
        <HealthTile icon={…} label="Online" value="1,196" sub="90.2% of Beacons" onClick={…} />
      </div>
    </CortecaCard>
    <CortecaCard title="Details" actions={<StatusPill tone="info">…</StatusPill>}>
      <MyTable … />  {/* table follows Table Conventions; no outer border of its own beyond rounded-xl ring */}
    </CortecaCard>
  </CortecaPage>
);
```

### Building blocks (`web/components/corteca/`)
| Component | Use for |
|---|---|
| `CortecaPage`, `CortecaLoading` | Every dashboard page shell and its loading state. Light grey ground `bg-[#f5f7fa]` (hides the global background image). |
| `CortecaCard` | Every content block: white, `rounded-2xl`, soft shadow (`CARD` in `styles.ts`), bold `text-lg` title, optional (i) `info` tooltip and right-side `actions`. |
| `HealthTile` | Summary counts in a 4-up grid split by `divide-x`: outline icon, label, big number, `sub` line (share/context) or a pill. Click → filter/scroll. |
| `StatusPill` | Status/labels: fully rounded pastel pill. Tones: `good` (emerald), `fair` (yellow), `poor` (red), `neutral` (grey), `info` (blue), `online` (stronger green — use where it must contrast with `neutral` grey, e.g. matrix cells). |
| `OutlineButton` | Secondary/page actions: blue outline + blue text + leading icon. |
| `ui/Button` (default) | Primary action: solid `bg-blue-600`, `rounded-lg`. One primary per form. |
| `SegmentedControl` | Small mutually exclusive toggles (filters, periods): active = `bg-blue-50 text-blue-700 ring-blue-600`. |
| `Notice` | Errors (`tone="error"`, red-50) and progress/info (`tone="info"`, blue-50), with icon and optional close. Never raw red `<p>` boxes. |
| `CARD`, `TABLE_HEAD_ROW` (`styles.ts`) | When a component draws its own card/table header instead of using `CortecaCard`. |

### Colours & shapes
- **Blue = action/link/selection** (`blue-600`; hover `blue-700`; tint `blue-50`). Links in values are `font-medium text-blue-600`. Selected items get a blue ring (`ring-2 ring-blue-600`).
- **Green/yellow/red only mean status**, never decoration or actions (no green "New Report" buttons).
- Corners: cards `rounded-2xl`, inputs/buttons `rounded-lg`, pills `rounded-full`. Prefer hairline rings/shadows over grey borders.
- Text: card titles `text-lg font-semibold text-neutral-900`; labels `text-sm text-neutral-700`; meta `text-xs text-neutral-500`. Table headers `text-xs font-semibold text-neutral-700`, normal case (no small grey uppercase).
- Inputs: `rounded-lg border-neutral-300`, focus `border-blue-600 ring-2 ring-blue-600/20`. Checkboxes `accent-blue-600`.
- Spinners: `border-neutral-200 border-t-blue-600`. Nav active item: `bg-blue-50 text-blue-700`.
- Icons: thin outline (`strokeWidth 1.5`), `currentColor`.

### Rules learned from feedback
- **Summary tiles show data only** — counts and shares (e.g. "90.2% of Beacons"), **no Good/Fair/Poor ratings or thresholds** unless explicitly asked.
- Show device names by **formal model name** ("Beacon 10"); never invent sequential numbering. Use MAC suffixes only to disambiguate identical models in lists.
- Status pills that must be told apart at a glance need clearly different hues (hence `online` green vs `neutral` grey).
- Page content must start near the top: one compact header (title/meta/actions), no large intro blocks or stacked headers.

### Checklist for a new or restyled page
1. Wrap in `CortecaPage` with breadcrumb title, meta, actions; loading via `CortecaLoading`.
2. Every block in a `CortecaCard`; summaries as `HealthTile` grids.
3. Actions blue (`OutlineButton` / blue primary); status as `StatusPill`; errors/progress as `Notice`.
4. Tables follow **Table Conventions** inside a card.
5. Forms/modals/tables extracted per **Component Architecture**; files < 300 lines.
6. Check it in the browser (headless Playwright) before calling it done.

**Exceptions:** the MCP visualizer (`/mcp-network-visualizer`) uses its own compact top bar + Recent rail instead of `CortecaPage`, and the dashboard landing page (`/dashboard`) uses the console-home layout (`web/components/landing/`). Both still use the same colours and shapes.

---

## Styling Patterns

All dashboards follow the **Corteca Style** — see the section above.

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

## Deployment (GitLab CI → Vercel)

Source lives on Nokia GitLab (`gitlabe1.ext.net.nokia.com/mquade/corteca-dashboards`, remote `gitlab`; local `main` tracks it). The GitHub remote (`origin`) is legacy — the corporate network (Zscaler) blocks pushes to GitHub.

`.gitlab-ci.yml` deploys every push to `main` to Vercel production with `vercel deploy --prod` on the `docker`-tagged instance runner. Vercel builds remotely using the env vars configured in the Vercel project.

- **GitLab CI/CD variables:** `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (masked, not protected).
- **Commit details in Vercel:** the job installs git, marks the checkout as a safe directory, and checks out the branch by name so the CLI can read commit metadata; it also passes GitLab-style `--meta gitlab*` fields, which is what makes the Vercel dashboard show the commit message/SHA/branch.
- **Deploy history:** GitLab → Operate → Environments → `production`.
- **GitHub mirror:** project mirroring is admin-only on Nokia GitLab, so the `mirror_github` job pushes `main` to `origin` (fast-forward only, `allow_failure`) when the masked CI variable `GITHUB_TOKEN` (fine-grained, Contents read & write on `michael-quade/Corteca`) is set.

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

**Prerequisites:** Node 18+, PostgreSQL (Neon recommended), Nokia Corteca API credentials (base URL, client ID, client secret).
