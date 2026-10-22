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
| `/dashboard` | Dashboard | Landing page styled after the Corteca console home: time-of-day greeting with the user's first name, "Corteca dashboards" grid of wide tiles (`DASHBOARD_CARD_HREFS` in `web/lib/navItems.tsx`), a tall featured tile for the MCP visualizer (`DASHBOARD_FEATURED_HREF`), and an "Other applications" dropdown for every remaining page (incl. the REST `/network-visualizer`, which is no longer a tile but stays in the nav menu). |
| `/devices` | Device Search | Search subscribers by name, email, MAC, UUID, or serial. Shows all devices on their home network with status, model, and IP. |
| `/network-visualizer` | Home Network Visualizer | Search a subscriber, then renders: interactive D3 topology graph, Leaflet map pin, ethernet port panels per AP (gateway: live TR-181 with config/spec fallback; mesh Beacons: built from Corteca reports by `meshApPorts()` — see Ethernet ports below), and a raw API debug panel. Subscriber card includes a blue "Launch Corteca Console" button linked to the gateway MAC. |
| `/mcp-network-visualizer` | Home Network Visualizer (MCP) | Compact top bar (title, subscriber search with floating results, subscriber/network chip with data-captured time and Console button) and a left "Recent networks" rail/drawer (localStorage; shows each network's gateway model; per-row × removes one entry, Clear removes all) keep the diagram at the top of the page, sized to the window. Network data comes from the Corteca AI MCP server's `retrieve-network-data` tool. Renders a React Flow topology canvas (`web/components/topology/`: AP cards with status ring and client badge, backhaul links coloured by Corteca's `backhaulQuality` with width/flow animation by data rate, one client card per AP with stacked band sections (6/5/2.4 GHz, wired) collapsing to "+N", legend, minimap, full screen; ELK layout; Ethernet backhaul below 1 Gbps flagged amber; an Ethernet backhaul plugged straight into a gateway port is labelled with the port, "LAN 1 · 10 Gbps", from the live host table — `link.port`, set by `applySwitches()` — and the link panel shows "Gateway port"), per-AP cards (`McpAccessPointCards`), the `NetworkMembersTable`, and a raw MCP debug panel. No Leaflet map (MCP returns no geo data). AP cards show model + MAC (firmware is in the detail panel); zoom/fit buttons sit beside the legend (top-left). Interaction: click an AP, client pill or link to open a detail side panel and highlight its path to the gateway — if opening the panel pans the diagram aside, closing it pans back (unless the user moved the view meanwhile; dragging never closes the panel); AP cards and table rows select the same node; client search (name/MAC/IP); filter chips (band, SSID, weak signal < -70 dBm, could use faster band) fade non-matching clients; detail panel also shows AP public IP / hardware / last offline / top clients by traffic, link PHY rate and traffic, client traffic, supported bands and last disconnect reason; a "data captured" time sits above the canvas; Tree / Sideways / Radial layouts; arrow keys step through devices, Esc clears (`useCanvasKeyboard`: a click anywhere in the canvas re-focuses it, since clicked edge labels dropped focus to `<body>` and Esc did nothing). View state lives in the URL (`?network=…&sel=client:…&band=5,2.4&ssid=…&weak=1&slowband=1&layout=radial&v=x,y,zoom`) — `?network=<root MAC>` deep-links straight to a network without a subscriber search. A **Refresh** button in the top bar re-reads the network from MCP while keeping the diagram, selection, filters, zoom and expanded sections; gateway reads (Ethernet ports, backhaul standard) are cached per network snapshot (`capturedAt`), so they re-read too, showing the previous values until the new ones arrive. A failed refresh keeps the old data with an error. An **AI analysis** card under the diagram (top-bar "AI analysis" button jumps there and runs it) runs MCP `analyze-network` on demand and shows Corteca's state pill and the Markdown report; Beacons with findings get an amber badge on their diagram card, and AP/client panels show the report lines about them. The same card's "Troubleshoot a problem" box runs `troubleshoot-network`. The AP panel's **Radios** section shows each radio's channel, width, busy airtime split (transmit / own clients / other networks), average, noise and Tx power; the client panel shows the WiFi standard ("WiFi 6 (802.11ax)"); an "Older WiFi (4/5)" filter chip (`oldwifi=1`) fades newer clients. The top bar's "data … ago" time re-renders every 30 s. **Inferred switches** are drawn as dashed "Switch · inferred" cards between the AP port and what sits behind it (Beacons, plus a client card for wired clients behind it); the AP → switch line is labelled with the port and its negotiated rate ("LAN 1 · 1 Gbps"), clicking the card or its line opens a panel with the evidence and the devices behind it (`?sel=switch:<id>`), and selecting a device behind it highlights the path through it. An **Internet** card sits above the gateway (`internet` node, green/red ring from the gateway's WAN connection status, WAN IPv4), joined by a blue `wan` edge whose pill shows "WAN · 5 Gbps" (the WAN port's negotiated rate); clicking the card or pill opens the WAN panel (`?sel=wan:<gateway MAC>`: status, public IP, uptime, traffic, WAN interface name/services/addressing, WAN IPv4/IPv6, default gateway, DNS, LAN IP, a double-NAT / CGNAT note for private WAN addresses, and the WAN port's max/current rate, duplex). Highlighted paths to the gateway continue to the Internet. Wired clients are **their own pill nodes** (`wired`, id `wc:<MAC>`), each linked from the AP or inferred switch it is plugged into by a `wiredLink` line (`wl:<MAC>`) labelled with port and link speed ("LAN 3 · 100 Mbps"); behind a switch the line has no label (the switch line carries the port and shared speed). Client cards hold WiFi clients only. The client panel's Type row says the same ("Wired · LAN 3 · 100 Mbps") and wired clients have no PHY row. |
| `/network-map` | Global Network Map | Leaflet map of every managed network in the fleet, clustered by location. Color-coded online/offline. Sidebar with deployment stats, search, and per-network detail panel. |
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
| `/api/subscribers` | GET | Search subscribers by `name` query param |
| `/api/network/[deviceId]` | GET | Full network topology for a device (mesh, members, configs) |
| `/api/network/[deviceId]/ethernet` | GET | Ethernet port live status for a device |
| `/api/network/[deviceId]/datamodel` | GET | USP TR-369 data model for a device |
| `/api/network/[deviceId]/datamodel/set` | POST | Set a USP parameter value |
| `/api/network/[deviceId]/device-names` | GET / POST | GET: user-given Beacon/client names + detected manufacturer/model/category from the gateway's `X_ALU-COM_LAN_DEVICE_MAP` (USP). POST `{ mac, alias }`: sets that device's `HostAlias` (empty = remove), then reads it back and only reports success if it matches |
| `/api/network/[deviceId]/wan` | GET | The gateway's Internet connection from TR-181 (one USP GET of `WAN_PATHS`): the IP interface carrying the INTERNET service (`X_ALU-COM_ServiceList`), followed down `LowerLayers` (Ethernet.Link → VLAN/PPP → Ethernet.Interface) to the WAN port; returns `{ wan: WanInfo }` (`parseWan()` in `web/lib/wanInfo.ts`) |
| `/api/network/[deviceId]/wifi-details` | GET | From the gateway's EasyMesh Data Elements: every Beacon's radios (channel, width, airtime utilization, noise) and the WiFi standard (WiFi 4–7, MLO) of each backhaul and client station |
| `/api/networks/[networkId]/members` | GET | Connected client devices for a network |
| `/api/port-layouts` | GET | Ethernet port layouts per device model learned from gateways' live ports (`PortLayout` table + memory; DB failures fall back to memory) |
| `/api/mcp/network/[homeWifiId]` | GET | Calls the MCP `retrieve-network-data` tool (mesh + clients) for a root node MAC; optional `query` param overrides the natural-language query |
| `/api/mcp/analyze/[homeWifiId]` | GET | MCP `analyze-network` (all specialists); returns `{ report }` Markdown. `maxDuration = 300` |
| `/api/mcp/troubleshoot/[homeWifiId]` | GET | MCP `troubleshoot-network` for `?query=`; returns `{ diagnosis: { summary, problems, rootCauses, recommendedActions } }`. `maxDuration = 300` |
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
- **Radios** (gateway Data Elements, `Device.WiFi.DataElements.Network.Device.{i}.Radio.{j}`; the gateway is the EasyMesh controller, so one read covers every Beacon, `Device.{i}.ID` = AP MAC): `Utilization`, `Transmit`, `ReceiveSelf`, `ReceiveOther` (airtime from other networks / interference) and `X_ALU-COM_EWMA_*` averages are **0–255 linear** (→ %); `Noise` is ANPI (**dBm = value/2 − 110**); `CurrentOperatingClassProfile.{k}` lists one entry per width the radio covers — the widest class gives the width (e.g. 137 = 6 GHz 320 MHz, 129 = 5 GHz 160 MHz) and the 20 MHz class the primary channel (`web/lib/wifiRadios.ts`). Beacons in one mesh normally share channels (the wireless backhaul needs it), so "same channel" is not flagged.
- `retrieve-network-data` lets the agent choose APIs, so an expected `apiId` can be missing or `ok: false` — always handle that.
- Mesh data has no explicit tree: each AP's `meshbackhaulnodes` lists its downstream AP serials (`web/lib/mcpNetwork.ts` builds the tree from it).
- **Nicknames are not in MCP** (or the REST topology/mesh/members endpoints), but they **are on the gateway**: USP `Device.X_ALU-COM_LAN_DEVICE_MAP.DeviceMap.{i}.HostAlias` holds the user-given names the Corteca console shows — Beacons (`DeviceCategory = WIFI_EXTENDER`, e.g. "MBR", "Kitchen") and clients (e.g. "TV Living Room") — plus `DeviceCategory`, `Manufacturer`, `ModelName`. `Device.X_ALU-COM_BeaconInfo.Beacon.{i}.FriendlyName` and the Beacon's own `X_ALU-COM_FriendlyName` are empty/defaults. The MCP visualizer reads it via `GET /api/network/[gatewayMac]/device-names` after the MCP data loads and applies it with `applyDeviceNames()` (`web/lib/deviceNames.ts`): AP cards show the nickname with the model as the kicker, client aliases are replaced (the original kept as "Detected name"), and the client panel adds "Detected as" (manufacturer · model — the gateway's own guess, sometimes wrong) and category. If the call fails (gateway offline), formal model names are kept (never sequential numbering). The REST visualizer uses the same route and `applyNamesToTopology()`: mesh APs get `nickname` (which `buildTree` in `web/lib/networkTopology.ts` prefers for diagram and map labels), members get the nickname as `alias`, and Ethernet card titles / port switch lists show nicknames.
- **Ethernet ports:** MCP has no per-port data. The **gateway** exposes live `Device.Ethernet.Interface.*` + `Device.Hosts.Host.*` (via `/api/network/[deviceId]/ethernet`). **Mesh APs don't** — their data model only has `DeviceInfo`/`X_ALU-COM_Wifi` (Ethernet isn't in the TR-181 Data Elements yet). For mesh APs the visualizer builds ports from MCP members (wired clients' `port_number`, 1 = WAN so 2 = LAN 1, and rx rate) plus the Ethernet backhaul link — labelled as reported, not live; empty ports can't be confirmed. **A gateway port's host list includes everything bridged behind it** — with Ethernet-backhauled Beacons that is every Beacon client too. `/api/network/[deviceId]/ethernet` returns all active hosts per port (`connectedHosts`; `connectedHost` only when exactly one), and `web/lib/portHosts.ts` splits them using MCP data into Beacons on the port, devices reached via those Beacons, and direct devices. ≥2 Beacons/direct devices that Corteca knows on a port ⇒ shown as an inferred "Switch" (active hosts Corteca doesn't list — e.g. an old randomized iPhone MAC — are shown but never count: every connected wired device appears in Corteca's clients); the gateway's host table goes stale (a host keeps its old `Layer1Interface` and `Active=true` after moving to WiFi), so hosts on a port whose link isn't Up, or that MCP reports as WiFi clients of the gateway, are counted as "N stale" and never drive the switch inference; Beacons on a switch show their client counts from MCP ("5 WiFi · 0 wired"), since some gateways don't attribute Beacon clients to any port; a mesh AP's Ethernet uplink is labelled with the gateway port it lands on ("Gateway LAN 1 (switch)"). The REST visualizer's `EthernetPortPanel` takes the same classification via its optional `context` prop (`portContextFromTopology()` in `web/lib/ethernetPorts.ts`). REST members carry the same `port_number` / `rx_statistics.rate` as MCP members (checked on 80-AB and 60-98-49-FF-9F-60; they also list the Beacons themselves as disconnected `ethernet` members with port 0). The REST visualizer's mesh Beacon panels come from `web/lib/meshApPorts.ts`: `restNetwork()` runs the REST mesh + members through `normaliseMcpNetwork()` and `applySwitches()` (with the gateway's live ports), and `meshApPorts()` fills the config/model-spec port layout — wired clients by `wiredPort()`, ≥2 on one port as an inferred switch (port rate = the port↔switch link), the Ethernet backhaul on WAN with its rate and gateway landing port (`gatewayPortOf`), clients with no or an unlisted port as extra rows; anything else is a neutral "Nothing reported" (never "Empty"), rendered by `web/components/ReportedPortCells.tsx`. **Port layout per model:** mesh Beacons don't report their ports, but the same model working as a gateway does, so the ethernet route records each gateway model's live layout (`PortLayout`); both visualizers lay out a mesh Beacon's ports with `beaconPortLayout()` — this network's gateway if it is the same model, else the stored layout, else Nokia's spec sheet (`portSpecs.ts`), else generic WAN + 3 LAN — and say which in the panel note. The MCP AP panel (`ApEthernetPorts`) renders `meshApPorts()` the same way as the REST panel (every port, "Nothing reported", inferred switch rows). A Beacon with a WiFi backhaul shows its WAN port as "Wireless backhaul · 6 GHz" (kind `wireless`; links to the backhaul in the MCP panel) unless a wired client is reported on it. Spec sheets don't say which LAN port is the fast one: listed fastest first, confirmed for Beacon 19.1 (LAN 1 negotiated 10 Gbps live).
- **Inferred switches on the canvas** (`web/lib/inferredSwitches.ts`, applied with `applySwitches()` after the gateway's live ports load in `useGatewayExtras`): gateway ports from the live host table (link Up, ≥2 Corteca-known Beacons/wired clients, via `portHosts.ts`); any AP's port — and the gateway's when live ports are unavailable — from ≥2 connected wired clients with the same Corteca `port_number`. That catches a client switch behind a mesh Beacon, but not a Beacon behind a mesh Beacon's switch, and chained switches show as one. `buildFlowGraph` adds a `switch` node and a `switchUplink` edge (`swu:<switch id>`); backhaul edges keep their `bh:<parent>:<child>` id but are drawn from the switch; a wired client's `wiredLink` comes from its owner (`clientOwner()`: switch, else AP); WiFi client cards are per AP (`cl:<AP>` / `<AP>:<band>`).
- **Clients without a nickname**: when the reported name is a placeholder (`Unknown_<mac>`, a MAC, or empty), `applyDeviceNames()` / `applyNamesToTopology()` show the gateway's detected model instead (e.g. "iPad Pro 12.9\" 2nd Gen (Wi-Fi)", as the Corteca console does), else manufacturer + category ("Google sensor"); identical derived names get the MAC's last bytes ("Nest Protect · 5A-94"). Real hostnames and user nicknames are never replaced; the original name stays visible in the client panel.
- **Renaming** (MCP visualizer): the pencil next to a Beacon's or client's name in the detail panel opens `RenameDeviceModal` (via `DeviceRenameProvider` / `useDeviceRename()` in `web/components/topology/DeviceRename.tsx`); it is offered only for devices in the gateway's device map. Save → `POST /api/network/[gatewayMac]/device-names` → USP SET `DeviceMap.{i}.HostAlias` on the customer's gateway (so the Corteca console/app show it too); the USP reply can be HTTP 200 even when rejected, so the route verifies by reading the value back. On success the page updates its names locally (`setNickname`) without re-reading.
- **Wired client port and speed** (`wiredPort()` / `wiredLinkLabel()` in `inferredSwitches.ts`): port = Corteca `port_number` − 1 ("LAN n"); checked against the gateway's live host table on 8 of 8 gateway-wired clients (80-AB, Kevin Doms 60-98-49-FF-9F-60). Mesh AP ports can't be cross-checked (no Ethernet object) and the physical port label hasn't been confirmed. Speed = the member's `rx_statistics.rate` (kbps), which matches the live port rate for a device plugged straight into a port; **behind a switch it is the port↔switch link, not the device** (e.g. a 100 Mbps Roku behind a gigabit switch reads 1 Gbps), so it is not shown there. `port_number` also appears on some WiFi clients — only used for wired.
- Mesh link `medium` (`"wifi-6"`, `"ethernet"`) names the **band**, not the WiFi standard: every wireless backhaul seen reports `"wifi-6"` and its endpoint BSSIDs belong to the APs' 6 GHz (`BAND06`) radios, including links between WiFi 7 Beacons. Tri-band WiFi 6 Beacons with no 6 GHz radio (e.g. Beacon 6) split 5 GHz into `BAND50LOW`/`BAND50HIGH` radios and back-haul on the high one (`medium` `"wifi-5high"`). MCP gives no backhaul WiFi standard; the gateway does: `Device.WiFi.DataElements.Network.Device.*.Radio.*.BSS.*.STA.*.ClientCapabilities` holds the raw (Re)Association Request each child Beacon's backhaul station (`…Radio.*.BackhaulSta.MACAddress`, = the child endpoint's `bssid` in the MCP link) sent. A station only includes a generation's capabilities element when the AP offers it, so the highest element present is the link's standard (HT → WiFi 4, VHT → 5, HE → 6, EHT → 7; Multi-Link element → MLO). `/api/network/[gatewayMac]/wifi-details` reads only the needed values with USP search paths (falling back to the whole Data Elements tree) and decodes them (`web/lib/wifiAssociation.ts`); the page fetches it after each MCP load with the names (`useGatewayExtras`) and merges it in with `applyWifiDetails()`; the link panel then shows "WiFi 7 (802.11be) · 6 GHz" plus "Multi-link (MLO)" for WiFi 7. Backhaul stations are **not** in `Device.WiFi.AccessPoint.*.AssociatedDevice` (no `OperatingStandard`). If the read fails or decodes nothing, the band-only view stays. `buildBackhaul()` sets `band` from the endpoint BSSIDs (falling back to the medium), so the link panel shows "WiFi · 6 GHz" or "WiFi · 5 GHz high", and AP "Bands" list radios ("2.4 GHz · 5 GHz low · 5 GHz high"). Client-facing band lists (`ssidBands`, filter chips) keep a single "5 GHz".
- **Beacon 6 reports backhaul `dataRate` / `data-rate-*` in Mbps** (e.g. `dataRate 1441` next to `phyRate 1441000`), newer Beacons in kbps. `linkRateKbps()` treats a data rate under 1% of the PHY rate as Mbps.
- Units: link/client `data-rate-*`, `derivedData.dataRate|phyRate` and client `rx/tx_statistics.rate` are kbps; `*-bytes` / `statistics.bytes` are cumulative byte counters. From the AP's view, its tx is the client's download.
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

Uses Prisma with a Supabase PostgreSQL database. Four models:

| Model | Purpose |
|---|---|
| `SwMatrix` | Singleton (id=1). Stores the Beacon firmware release matrix: `beaconModels` (JSON array — entries are a model name string, or `{ name, wifi }` when a WiFi generation is set) and `releases` (JSON array). Seeded via `prisma/seed.js`. |
| `DeploymentReport` | Singleton (id=1). Cached deployment report: device list, column headers, raw rows, stats, USP map. Updated when SW Overview fetches fresh data. Shared across serverless instances via DB. |
| `PortLayout` | One row per device model (`modelKey()`: "beacon 10"): RJ-45 ports (name, WAN or not, max Mbps), hardware version, source (`live`/`documentation`/`manual`), sample MAC. Written by `/api/network/[deviceId]/ethernet` (in `after()`, so no latency) whenever a gateway's live ports differ from what's stored. |
| `ApiSession` | One row per login session. Tracks call count, bytes sent/received, rate limit hits. Persisted via `PUT /api/sessions` with debounce; final flush on logout using `keepalive`. |

### Database Commands
```bash
npm run db:push       # push schema to DB (uses DIRECT_URL)
npm run db:generate   # regenerate Prisma client
npm run db:studio     # open Prisma Studio
npm run seed-matrix   # seed initial SW matrix data
```

### Supabase Keepalive Cron

Supabase free-tier projects auto-pause after 7 days with no database activity. `vercel.json` defines a daily Vercel Cron job (`0 8 * * *`) that hits `GET /api/cron/keepalive`.

**Important:** Supabase's pause detection only counts requests through its REST API (PostgREST) or dashboard access — a direct Postgres connection (Prisma/PgBouncer) does **not** reset the inactivity timer, confirmed by Supabase staff. The route therefore does two things:
1. `prisma.$queryRaw\`SELECT 1\`` — harmless, but does not affect pause detection on its own.
2. `fetch` to `${SUPABASE_URL}/rest/v1/sw_matrix?select=id&limit=1` using `SUPABASE_SERVICE_ROLE_KEY` — this is the part that actually registers as activity with Supabase. If `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` are unset, this step is skipped (`restPing: "skipped"` in the response) and the pause countdown will **not** be reset.

`SUPABASE_SERVICE_ROLE_KEY` accepts either key style: legacy `service_role` JWTs (start with `eyJ`, sent on both `apikey` and `Authorization: Bearer`) or newer `sb_secret_...` keys (not JWTs — sent on `apikey` only, since PostgREST fails to verify them as a Bearer JWT). The route detects which style it got.

- Authenticated via `CRON_SECRET` — Vercel automatically sends `Authorization: Bearer $CRON_SECRET` on cron-triggered requests; the route checks it if the env var is set (skipped in local dev).
- `middleware.ts` allows `/api/cron/*` through the site gate unconditionally, since cron requests carry no `site_auth` cookie.
- Cron jobs only fire on deployed Vercel environments (Hobby plan: once/day max, logs retained 1 hour), not in local dev.

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
| `reportTypes.ts` | `REPORT_CONFIGS` — display name, chart color, Corteca type strings for all 8 report types |
| `networkTopology.ts` | Parses raw mesh/topo API responses into normalised `NetworkTopologyData` |
| `topologyFlow.ts` | `buildFlowGraph()` (McpNetwork → React Flow nodes/edges, one client node per AP so each subtree stays one card wide, sizes pre-measured), `layoutFlowGraph()` (ELK; returns node positions **and** edge routes in `edge.data.points`), `backhaulLabel()` |
| `edgeGeometry.ts` | Edge/label geometry for the topology canvas: `labelBox()` (where a backhaul label sits), `layoutProblems()` (edge under a card, label covering a card/label), `spreadRadial()` (scales a radial layout out from the gateway until `layoutProblems()` is empty) |
| `portLayouts.ts` | Port layout types, `modelKey()`, `beaconPortLayout()` (mesh Beacon layout: same-model gateway live → stored → spec sheet → generic, with a source note), `withSpecMaxRates()` |
| `portSpecs.ts` | RJ-45 layouts from Nokia's spec sheets (WAN + LAN speeds per model); fills LAN max speeds TR-181 reports as auto |
| `corteca/portLayoutStore.ts` | Server: `getPortLayouts()`, `recordLivePortLayout()` (PortLayout table + memory cache) |
| `usePortLayouts.ts` | Client hook: stored layouts, fetched once per page load |
| `ethernetPorts.ts` | REST visualizer Ethernet ports: live → device config → model-spec fallback (`resolvePorts`) |
| `meshApPorts.ts` | REST visualizer mesh Beacon ports: `restNetwork()` (REST topology → McpNetwork + switches), `meshApPorts()` (reported wired clients, switch, uplink per port) |
| `portHosts.ts` | Classifies hosts learned on a gateway Ethernet port (Beacons / via-Beacon / direct), infers switches, finds the gateway port a mesh AP's backhaul uses |
| `deviceNames.ts` | `applyDeviceNames()` (MCP network) and `applyNamesToTopology()` (REST topology) — overlay gateway device-map nicknames (AP `nickname`, client `alias`, identity fields) |
| `clientInsights.ts` | Client traffic, supported bands, `bandUpgrade()` (client on a slower band than it and its AP support for that SSID), IEEE disconnect-reason text, top talkers per AP |
| `topologySelection.ts` | Selection types, path highlight (`highlightFor`), client filters, search, keyboard order, and URL (de)serialisation for the MCP visualizer |
| `recentNetworks.ts` | localStorage list of networks recently opened in the MCP visualizer (with subscriber, for the header chip) |
| `useTopologyViewState.ts` | Hook that mirrors the MCP visualizer's view state into the query string via `history.replaceState` |
| `mcpNetwork.ts` | `normaliseMcpNetwork()` — turns an MCP `retrieve-network-data` payload into `NetworkTopologyData` (synthesising the AP tree from `meshbackhaulnodes`), AP summaries, and `Member[]` |
| `networkMembers.ts` | Fetches and normalises connected client members for a network |
| `sessionHistory.ts` | LocalStorage session record helpers for the API usage dashboard |
| `swMatrix.ts` | Beacon SW release matrix helpers |
| `wifiGeneration.ts` | WiFi generation list/type for Beacon models (client + server safe) |
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
| `CORTECA_MCP_URL` | Optional. Corteca AI MCP endpoint; defaults to `${CORTECA_API_BASE_URL}/ai/mcp` |
| `SITE_USERNAME` | Gate username protecting the entire app |
| `SITE_PASSWORD` | Gate password |
| `CRON_SECRET` | Bearer token Vercel Cron sends to `/api/cron/*` routes; optional, skips auth check if unset (local dev) |
| `SUPABASE_URL` | Supabase project REST URL (e.g. `https://<ref>.supabase.co`) — required for the keepalive cron to actually prevent auto-pause |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase secret/service_role key, used by the keepalive cron to hit the REST API (the only kind of request Supabase's pause detection counts) |

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
    network/[deviceId]/{route,ethernet,wan,datamodel,datamodel/set}.ts
    mcp/{network,analyze,troubleshoot}/[homeWifiId]/route.ts
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
    landing/                      # Dashboard landing page: LandingCard, FeaturedCard, OtherAppsSelect
    corteca/                      # Corteca-console look: CortecaPage (page shell), CortecaCard, StatusPill, HealthTile, OutlineButton, SegmentedControl, Notice, styles.ts (CARD)
    alarms/                       # Network Alarms: AlarmQueryForm (+ .types.ts), AlarmSeverityChips, severity.ts
    NetworkDebugPanel.tsx         # REST visualizer raw-response debug panel
    SwFleetHealth.tsx             # SW Overview fleet health tiles
    DataModelBrowser.tsx
    EthernetPortPanel.tsx
    ReportedPortCells.tsx         # EthernetPortPanel cells for mesh Beacon ports built from Corteca reports
    GlobalNetworkMap.tsx
    McpAccessPointCards.tsx
    McpTopBar.tsx                 # MCP visualizer top bar: search, subscriber chip, AI analysis, Refresh, Console button (+ .types.ts)
    McpDebugPanel.tsx             # Raw retrieve-network-data response (debug); exports McpResponse
    ai/                           # MCP visualizer AI: AiAnalysisCard, MarkdownReport, DiagnosisView, TroubleshootForm
    SubscriberSearchBox.tsx       # Compact subscriber search with dropdown results
    RecentNetworksDrawer.tsx      # Left rail + overlay list of recently viewed networks
    topology/                     # React Flow canvas for the MCP visualizer
      TopologyCanvas.tsx          # ReactFlow + ELK layout, legend, minimap, full screen
      ApNode.tsx                  # AP card node
      ClientClusterNode.tsx       # Per-AP client card, sections stacked by band
      BackhaulEdge.tsx            # Quality-coloured, rate-weighted backhaul edge drawn along its layout route
      RouteEdge.tsx               # AP → client-card connector; routePath() rounds orthogonal routes
      ApEthernetPorts.tsx         # AP detail panel "Ethernet ports": gateway live (REST, fetched on open, cached), mesh APs from MCP wired clients
      ApRadios.tsx                # AP panel "Radios": channel, width, airtime bar, noise (gateway Data Elements)
      AiNotesSection.tsx          # AP/client panel lines from the AI analysis report
      SwitchNode.tsx              # Inferred switch card (dashed)
      SwitchUplinkEdge.tsx        # AP port → switch line, labelled "LAN 1 · 1 Gbps"
      SwitchDetails.tsx           # Switch panel: evidence, Beacons and wired clients behind it
      WiredClientNode.tsx         # A wired client's own pill node
      WiredLinkEdge.tsx           # AP/switch port → wired client line, labelled "LAN 3 · 100 Mbps"
      InternetNode.tsx            # Internet card above the gateway (WAN status)
      WanEdge.tsx                 # Internet → gateway line with the "WAN · 5 Gbps" pill
      WanDetails.tsx              # WAN panel: Internet connection, WAN interface, WAN port
      flowTypes.ts                # React Flow nodeTypes / edgeTypes for the canvas
      DeviceRename.tsx            # Rename context: panel pencil → RenameDeviceModal → gateway HostAlias
      useGatewayPorts.ts          # Cached fetch of the gateway's live Ethernet ports (shared by gateway and mesh AP panels)
      TopologyLegend.tsx
      ZoomControls.tsx            # +/−/Fit buttons shown beside the legend
      useCanvasKeyboard.ts        # Arrow keys / Esc for the canvas; clicks keep focus on it
      TopologyToolbar.tsx         # Client search, filter chips, layout switch, full screen
      TopologyContext.tsx         # Selection/highlight/filter/layout context read by nodes & edges
      NodeDetailPanel.tsx         # Side panel: AP / link details (+ ClientDetails.tsx, DetailParts.tsx)
      qualityStyles.ts            # Shared good/fair/poor Tailwind classes
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
    WifiFilterPills.tsx
    UsageChart.tsx
    modals/
      AssignFirmwareModal.tsx
      ConfirmModal.tsx
      LoginModal.tsx
      RenameDeviceModal.tsx       # Edit a Beacon/client nickname (+ .types.ts)
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
    mcpNetwork.ts
    topologyFlow.ts
    topologySelection.ts
    recentNetworks.ts
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
- Vercel Cron (`vercel.json`) keeps working — crons are registered from the deployed `vercel.json`.

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
