# Code review and refactoring backlog — 2026-11-12

Whole-repo review. Nothing in this list has been changed yet. Line numbers are as of commit `1b05446`, so check them before you act.

**Coverage:** every API route, all of `web/lib/corteca/`, the contexts, `fetchWithAuth`, the MCP workspace and its hooks, and the network-map, REST visualizer, report, reboot-report and alarm pages were read in full. The topology components, the tables, the sw-overview page and the pure parsing libraries (`mcpNetwork`, `topologyFlow`, `networkTopology`, `roamingHistory`) were only pattern-scanned.

`tsc --noEmit` passes.

---

## 1. Fix now

- [ ] **Committed password.** In `docs/Nokia-HomeWifi-Edge-API.postman_collection.json`, the collection variable `password` for `username` = `admin` is non-empty: 16 characters, not a placeholder. It was committed in e141049 (2026-06-10), so it is also on the GitHub mirror. It has not been tested. If it is live, rotate it, then blank the value; consider scrubbing it from history.
- [ ] **Dependencies.** `npm audit --omit=dev` reports 1 critical (`next` 15.5.19, fix available) and 5 high (`xlsx` 0.18.5 with no npm fix, nanoid, postcss, sharp, source-map-js). Upgrade `next`. For `xlsx`, switch to the SheetJS CDN build or `exceljs`; exposure is low because it only parses our own file and writes exports.
- [ ] **Alarms time-zone bug.** In `app/alarms/page.tsx:27-34`, `defaultStart`/`defaultEnd` use `toISOString().slice(0,16)` (UTC clock time) as `datetime-local` values, and the form then converts them as local time. In America/Chicago the default "last 24 h" becomes 18 h ago → 6 h in the future. Fix: format the local time for the input.
- [ ] **Locate route caches failures.** `app/api/network-map/locate/route.ts:136-139` caches any non-OK answer (401, 5xx) as a `null` "known miss" for the life of the process. Cache only real "no location" answers and add a TTL. The `rateLimitHit` guard (~line 112) never stops anything, because every request has already started in `Promise.all`; use a small concurrency pool instead.
- [ ] **Routes with no Corteca token check.** `POST /api/sw-matrix` overwrites the release matrix. `/api/sessions` PUT accepts any id with no validation, and its GET lists every session. `/api/stats`, `/api/port-layouts` and `/api/radio-bands` are also open. All of these rely on the site gate alone, and the gate fails open when `SITE_USERNAME`/`SITE_PASSWORD` are unset.
- [ ] **Gate cookie holds the password.** `site_auth` is base64(`user:pass`) with a 30-day lifetime (`app/api/gate/route.ts:13`), checked with a plain `!==`. Replace it with an HMAC-signed token and a timing-safe compare.

## 2. Design gaps

- [ ] **Refresh token is never used.** Login stores `corteca_refresh_token` for 30 days, but nothing reads it. The access token lasts about 15 minutes (`maxAge: expires_in ?? 900`), so users see ReloginModal every ~15 minutes. Add a refresh flow on 401, either server-side or in `fetchWithAuth`.
- [ ] **Login route.** It uses raw `fetch` with no timeout and an unguarded `req.json()`, logs the username, and echoes the upstream error body. `resetApiStats()` resets a process-global counter whenever anyone logs in.
- [ ] **Unvalidated path parameters.** Path params are interpolated into upstream URLs without validation or encoding:
  - `app/api/network/[deviceId]/route.ts:42-44,58,60`
  - `app/api/networks/[networkId]/members/route.ts:19`
  - `app/api/network-map/device-info/[mac]/route.ts:56-64`
  - `web/lib/corteca/usp.ts:29,60`
  - the locate route (~line 117)
  - `ethernet/route.ts:34`, which also accepts a caller-supplied `endpointId`

  A `..%2F` segment could retarget a request, including the USP SET route. It runs with the caller's own token, so this is hardening.
- [ ] **Server caches shared across users.** `DeploymentReport` (in memory and in the DB), `nameCache`, `coordCache` and `infoCache` are filled with one user's token and served to everyone. That is fine only if every user has the same tenant and role.
- [ ] **Module-level caches may be per-route copies.** `radioBandStore.ts:9-11` says Next bundles routes separately and uses `globalThis` for that reason. `reportCache`, `nameCache`, `apiStats`, `swMatrix` (`cached`), `portLayoutStore` (`cache`), `coordCache` and `infoCache` are plain module variables. If that is true, `clearSwMatrixCache`/`clearNameCache` and the USP routes' endpoint lookup through `reportCache` don't see other routes' data. Not verified in a production build; move them to `globalThis` or the DB.
- [ ] **No single-flight on the deployment report.** `ensureDeploymentReport` (`deploymentReport.ts`) lets parallel cold requests each POST a generate request.
- [ ] **API Usage counts the wrong calls.** The dashboard counts browser→Next calls, not Corteca calls. Server `apiStats` is never read, because nothing fetches `/api/stats`. Even so, `cortecaFetch.ts:24` clones and reads every response without a content-length, and `fetchWithAuth.ts:44-51` reads each body up to twice, even with the log panel closed. Either count real calls server-side and return them, or drop the body reads. `ApiSession` byte counters are 32-bit `Int` and not tied to a user.
- [ ] **Sensitive data in logs.** There are 76 console calls in server code. Search terms (names, emails) are logged at `subscribers/route.ts:20`, account names at `account-names/route.ts:65`, SET values (which can be WiFi passwords) at `datamodel/set/route.ts:42,46`, and the reboot-report route logs the head of the CSV.
- [ ] **PII left in localStorage after logout.** Subscriber names, customer IDs, home coordinates (`corteca:markers:v2`, `corteca:names:v4`) and recent networks with subscriber all stay in `localStorage` after logout. Clear them in `logout()`.
- [ ] **Races.** `app/reports/[reportType]/page.tsx:43-99` (switching report type) and `handleSubscriberSelect` in `app/network-visualizer/page.tsx:80` have no cancellation. Add AbortController or a request id. AI fetches in the MCP workspace aren't aborted when a tab closes.
- [ ] **No security headers** in `next.config.mjs` (CSP, frame-ancestors, nosniff, referrer policy).
- [ ] **`web/lib/swMatrix.ts`** imports `fs` and `xlsx` at the top level. Its DB auto-seed reads `docs/SW Release Matrix.xlsx`, which may not be traced into the Vercel function.

## 3. Refactoring, by payoff

1. [ ] **Delete the dead SDK.** These files in `web/lib/corteca/` are imported by nothing (1,142 lines):

   | File | Lines |
   |---|---|
   | `client.ts` | 123 |
   | `network.ts` | 443 |
   | `devices.ts` | 328 |
   | `provisioning.ts` | 63 |
   | `subscribers.ts` | 175 |
   | `index.ts` | 10 |

   They contain a second `cortecaFetch` with a different signature, a single-user `tokenStore`, and destructive helpers (`factoryResetDevice`, `deleteSubscriber`, `changeDeviceTenant`). In `types.ts`, 31 of the 33 exports are unused; keep `Subscriber` and `Member`. Update CLAUDE.md, which lists these files as live.
2. [ ] **`withCorteca(handler)` route wrapper.** About 30 routes repeat the token check, base-URL check, header building, MAC normalising and error mapping. The wrapper would:
   - validate path params with `parseMac()`, which fixes the injection issue;
   - pass upstream 401s through (the USP routes return 502 today);
   - give token refresh and real per-call stats one place to live.
3. [ ] **USP helper `uspGet(ctx, paths)` with endpoint-ID caching.** Five routes hand-build USP GETs. Ethernet, device-names and wifi-details each re-implement "group params by instance", with an O(n²) object spread inside the loop. After each MCP load, four gateway reads each resolve the endpoint id with `/device-management/devices/{id}/config`. Cache that lookup with in-flight dedupe. `mcpClient.callMcpTool` also runs initialize + notification on every call; consider reusing the session.
4. [ ] **Fold the reboot report into the generic report page.**
   - Drop `/reboot-report`, `/api/reboot-report`, `RebootChart` and `RebootTable` in favour of `/reports/reboot`.
   - Unify the CSV parser. `parseRow`/`parseCsv` are identical in `reports/[reportType]/route.ts` and `reboot-report/route.ts`, with a better third copy in `deploymentReport.ts`. None handles `""` escapes or quoted newlines.
   - Add a `useAccountNames(rows)` hook to replace the account-name enrichment loop, which is copied in the reports page and the reboot page with a variant in network-map. The lookups are N+1 (one upstream call per MAC).
5. [ ] **Shared helpers.**
   - `consoleUrl`/`CONSOLE_BASE` is defined 7 times: the network-visualizer page, UnknownFirmwareList, FleetMapPopup, SwNetworkTable, DeploymentTable, AlarmTable and McpTopBar.
   - MAC normalising is written inline about 34 times in 6 variants; add `normMac()`.
   - Spinner markup appears 33 times in 24 files; add a `Spinner` component.
   - `safeFetch` and `extractDeviceIds` are copied in network/[deviceId] and device-info. `extractName` (account-names) duplicates `extractSubName` (locate). The locate route's `extractLatLng` duplicates the one in `web/lib/networkLocation.ts`.
   - The `"Home WiFi ID" || "MAC"` column lookup is in 7 files.
   - Seven tables each carry their own sort/filter state; add a `useTableSort` hook. `ColumnFilter` is used only by DeploymentTable.
6. [ ] **Tooling and CI.**
   - There is no ESLint config, so `next lint` prompts interactively and lint never runs. Six `exhaustive-deps` disables are unchecked.
   - There are no tests. Add fixture-based unit tests for the pure libraries: `roamingHistory`, `inferredSwitches`, `mcpNetwork`, `wifiAssociation`, `subscriberSearch`, `portHosts`. They would turn the "checked on demo2" facts in CLAUDE.md into checks.
   - `.gitlab-ci.yml` deploys `main` to production with no typecheck, lint or build gate. Its comment still mentions a `vercel.json` that no longer exists.
7. [ ] **Network Map page.** `app/network-map/page.tsx` is 300 lines with 16 `useState` calls. Move the load, locate and name orchestration into a hook. Each 50-name batch re-maps every row and re-renders the table. `/api/network-map` returns the full `rawRows` for the whole fleet on every load.
8. [ ] **REST visualizer page.** `app/network-visualizer/page.tsx` has about 50 lines of inline fetch and port resolution; move them to a hook. `deviceId` is not URL-encoded.
9. [ ] **MCP canvas relayout (not measured).** In `web/components/mcp/NetworkWorkspace.tsx:72-76`, one `useMemo` re-runs the whole pipeline (normalise → names → bands → wifi → switches → AI) whenever any of 7 inputs arrives. `TopologyCanvas.tsx:75-95` then re-runs `buildFlowGraph` and the async ELK layout on every `network` identity change, about 5–6 times per load. Stage the memos and key the layout on structural changes only. `useGatewayPorts` `liveCache` is unbounded.

## 4. Style and documentation drift

- `web/lib/mcpNetwork.ts` (384 lines) is the only live file over the 300-line rule. `app/network-map/page.tsx` is exactly at 300.
- There are 42 violet/purple/indigo accent uses in 26 files, against the blue-only rule; for example, the `border-t-violet-600` spinners in NetworkWorkspace.
- NetworkWorkspace shows errors in a raw red div instead of a `Notice`.
- There are 145 `title=` attributes, against the `Hint` rule.
- There are 58 `as Record<string, unknown>` and 21 `as unknown as` casts, with no runtime validation of upstream shapes.
- The "no Content-Type on bodyless GET" rule is broken in the network, locate, device-info and reports routes. It apparently works there, but it is inconsistent with the rule.

## Suggested order

1. The **Fix now** list, plus deleting the dead SDK. These are small and independent.
2. The `withCorteca` wrapper, `parseMac` and `uspGet` with the endpoint cache, plus token refresh. Together they close most of the design gaps.
3. ESLint, a typecheck/build gate in CI, and a first batch of unit tests.
4. The reboot-report merge, shared helpers, the table sort hook and the Network Map hook.
5. MCP relayout performance, then the style drift.
