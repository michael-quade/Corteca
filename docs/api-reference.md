# Corteca Home Controller API Reference

**Version:** BBD Release 26.01 (March 2026)  
**Base URL pattern:** `https://l1api.{instance}.homewifi.nokia.com`  
**Swagger UI:** `https://edge.{instance}.homewifi.nokia.com/v3/swagger-ui/index.html`

> **Path format:** Every endpoint URL includes the microservice name as the first path segment.  
> Example: `GET /devicehub/devices/{device_id}/system/status`  
> Path parameters use **snake_case** (`device_id`, `home_wifi_id`, `member_id`) in actual requests.

---

## Table of Contents

1. [Authentication](#authentication)
2. [Rate Limiting](#rate-limiting)
3. [Key Identifiers](#key-identifiers)
4. [Microservices](#microservices)
5. [Subscriber Search](#subscriber-search)
6. [Network Device](#network-device)
7. [SSID](#ssid)
8. [Connected Devices (Members/Stations)](#connected-devices)
9. [Speed Test & Diagnostics](#speed-test--diagnostics)
10. [RSSI & Steering History](#rssi--steering-history)
11. [Topology & Mesh](#topology--mesh)
12. [Network History & Activity Log](#network-history--activity-log)
13. [Network Device Health](#network-device-health)
14. [WAN & Router Information](#wan--router-information)
15. [WLAN Configuration](#wlan-configuration)
16. [Reboot & Factory Reset](#reboot--factory-reset)
17. [Parental Controls](#parental-controls)
18. [Historical Statistics](#historical-statistics)
19. [Live Traffic](#live-traffic)
20. [Network Slicing](#network-slicing)
21. [WiFi Radios & Channels](#wifi-radios--channels)
22. [Support Operations](#support-operations)
23. [Device Provisioning](#device-provisioning)
24. [Device Association (Subscriber ↔ Device)](#device-association)
25. [Device Claim](#device-claim)
26. [Campaigns](#campaigns)
27. [Subscriber Account Management (Keycloak)](#subscriber-account-management)
28. [Kafka Data Ingestion](#kafka-data-ingestion)
29. [L1 Problem Finder](#l1-problem-finder)
30. [API Notifications (Webhooks)](#api-notifications)
31. [Data Privacy](#data-privacy)
32. [Advanced Device Management — Nokia CGI](#advanced-device-management--nokia-cgi)
33. [Advanced Device Management — USP/TR-069](#advanced-device-management--usptr-069)
34. [QoS / Airtime Management](#qos--airtime-management)
35. [HDM Integration](#hdm-integration)
36. [Analytics Dashboard](#analytics-dashboard)
37. [FCC Broadband Compliance](#fcc-broadband-compliance)
38. [Backup & Restore](#backup--restore)
39. [Firmware Upgrade](#firmware-upgrade)
40. [Container Apps Management](#container-apps-management)
41. [L2 API (Metrics, Alarms, Steering)](#l2-api)
42. [Onboarding (Third-Party CPE)](#onboarding-third-party-cpe)
43. [JavaScript Extension Management](#javascript-extension-management)
44. [Event Analyzer](#event-analyzer)
45. [Fault Manager (Tenant Alarms)](#fault-manager-tenant-alarms)
46. [Application Management (Container Registry)](#application-management-container-registry)
47. [Proactive Engine](#proactive-engine)

---

## Authentication

**Microservice:** `auth`

Authentication uses Keycloak (OAuth2). You need a `clientId`/`clientSecret` (identifies your application) and a username/password (identifies the user).

### Get access token from credentials

```
POST /auth/token
```

**Headers:**

| Header | Value |
|--------|-------|
| `X-Service-Type` | `KC` |
| `clientId` | Your application client ID |
| `clientSecret` | Your application client secret |
| `Content-Type` | `application/json` |

**Request body:**

```json
{
  "email": "user@example.com",
  "grant_type": "password",
  "password": "yourpassword"
}
```

**Response:** Returns `access_token` and `refresh_token`.

> Do NOT request a new token until the current one expires. Use the refresh token first.

---

### Get access token from refresh token

```
POST /auth/token
```

**Headers:** Same as above.

**Request body:**

```json
{
  "grant_type": "refresh_token",
  "refresh_token": "your-refresh-token"
}
```

**Swagger:** `auth#/token/identifyUser`

---

## Rate Limiting

- **200 API calls** per 5 minutes per user/tenant
- **Max 10 concurrent users**
- Calls must be **sequential** (one at a time, not parallel)
- For periodic/streaming data, use the Kafka interface instead

---

## Key Identifiers

| Identifier | What it is | Format |
|---|---|---|
| `home_wifi_id` / `network_id` | Home network ID = root device MAC | `AA-BB-CC-DD-EE-FF` (uppercase, hyphen-separated) |
| `device_id` | Any AP/router MAC (root or extender) | Same format |
| `member_id` | Connected client/station MAC | Same format |
| `customer_id` / `uuid` | Subscriber UUID | String |

---

## Microservices

| Microservice | Swagger `primaryName` | Purpose |
|---|---|---|
| auth | `auth` | Authentication tokens |
| device-hub | `device-hub` | Device-level control: SSID, radio, system, CGI |
| home-hub | `home-hub` | Home network level: members, mesh, WAN, slices |
| measures | `measures` | Speed tests, diagnostics, recommendations |
| subscribers | `subscribers` | Subscriber/inventory management |
| device-management | `device-management` | Device status, online stats |
| station-profiles | `station-profiles` | Device profiles, fingerprinting, friendly names |
| device-provisioning | `device-provisioning` | Provision/de-provision devices |
| stats | `stats` | WAN/device usage statistics |
| activity-log | `activity-log` | Network event history, logs |
| dashboard-bff | `dashboard-bff` | Subscriber search, RSSI, tenant config |
| onboarding | `onboarding` | Third-party CPE onboarding history |
| scheduler | `scheduler` | Campaign/FCC compliance schedules |
| upgrader | `upgrader` | Firmware lifecycle |
| container-management | `container-management` | Software module management |
| data-ingestion | `data-ingestion` | Kafka subscriptions |
| acs-proxy | `acs-proxy` | HDM server (TR-069) integration |
| ouife | `ouife` | L2 metrics, alarms, DFS, steering |
| shardhub | `shardhub` | Shard management |
| application-management | `application-management` | Container asset registry (apps, versions, assets) |
| extension-management | `extension-management` | JavaScript provisioning for USP devices |
| event-analyzer | `event-analyzer` | Device event statistics tracking |
| fmserver | `fmserver` | Tenant-level fault management / alarms |
| proactive-engine | `proactive-engine` | Condition-based automation rules (e.g. auto-reboot) |
| onboarding | `onboarding` | Third-party CPE onboarding transactions (Home Agent) |
| usp-mqtt-logger | `usp-mqtt-logger` | Fetch device logs, async op status |

---

## Subscriber Search

**Microservice:** `dashboard-bff`

### Search subscribers

```
GET /subscribers  (deprecated)
GET /subscribers  (current)
```

**Swagger:** `dashboard-bff#/subscribers/getSubscribers`

**Query parameters:**

| Parameter | Description |
|---|---|
| `email` | Wildcard search by email (requires mobile app account) |
| `name` | Wildcard search by name (requires mobile app account) |
| `device_id` | MAC address (uppercase, hyphen-separated). Minimum 4 octets recommended |
| `uuid` | Subscriber ID. First 4 chars minimum recommended |
| `serial_no` | Serial number (Nokia/USP devices) |
| `ops` | OUI + Product Class + Serial Number combination |
| `live_status` | `true` to include live online status (slower); default `false` |

**Key response fields:**

| Field | Value |
|---|---|
| `name` / `first_name` + `last_name` | Subscriber name |
| `email` | Subscriber email |
| `home_wifis[0].id` | Root device MAC address (= network ID) |
| `home_wifis[0].status.online` | Online status |
| `serial_number` | Device serial number |
| `customer_id` | Subscriber UUID |

---

### Get subscriber count

**Swagger:** `dashboard-bff#/subscribers/getSubscribersCount`

---

### Get MAC address from serial number

**Swagger:** `home-hub#/networks/networksGet`

Query with `serial_no`. Returns home topology including MAC address.

---

## Network Device

**Microservice:** `device-management`, `device-hub`, `device-catalogue`, `station-profiles`

### Get device status

```
GET /devices/{deviceId}/status
```

**Swagger:** `device-management#/Device Management/devicesDeviceIdStatusGet`

**Response fields:** `online`, `last_boot`, `model`, `firmware_version`, `hw_id`, `sw_id`, `unmanaged` flag.

---

### Get device live status (direct from device)

```
GET /devices/{deviceId}/system/status
```

**Swagger:** `device-hub#/System/devicesDeviceIdSystemStatusGet`

Returns: online/offline, software version, model (live, direct from device).

---

### Get device software features

```
GET /software-features
```

**Swagger:** `device-catalogue#/Device Catalogue/getSoftwareFeatures`

Returns: speed test mode support, list of advanced features (`misc_feature`).

---

### Get router/bridge mode

```
GET /devices/{deviceId}/networks
```

**Swagger:** `device-hub#/Networks/devicesDeviceIdNetworksGet`

Bridge mode if response has `service_type` = `"INTERNET"` and `type` = `"bridge"`.  
*Nokia broadband devices only.*

---

### Get device serial number

```
GET /devices/{deviceId}/system/info
```

**Swagger:** `device-hub#/System/devicesDeviceIdSystemInfoGet`

*Note:* For Nokia/USP devices, get serial number from the mesh/topology API instead.

---

### Change device friendly name

```
PUT /networks/{homeWifiId}/member-profiles/{memberId}
GET /networks/{homeWifiId}/member-profiles
GET /networks/{homeWifiId}/member-profiles/{memberId}
```

**Swagger:** `station-profiles#/Station profile/networksHomeWifiIdMemberProfilesMemberIdPut`

---

### Get live memory and CPU usage

```
GET /devices/{deviceId}/system/info
```

**Swagger:** `device-hub#/System/devicesDeviceIdSystemInfoGet`

Returns persistent (ROM/Flash) and non-persistent memory in Kbytes; CPU usage in %.  
*USP and TR-069 devices only.*

---

### Get total online device count by model

```
GET /stats
```

**Swagger:** `device-management#/Stats/statsGet`

---

## SSID

**Microservice:** `device-hub`

### Get live SSID list

```
GET /devices/{deviceId}/wifi/vaps
```

**Swagger:** `device-hub#/Virtual Access Points/devicesDeviceIdWifiVapsGet`

If `enabled = true` and `hidden = false`, SSID is visible and can be used in heatmap filtering.

---

## Connected Devices

**Microservices:** `home-hub`, `station-profiles`, `device-hub`

### Get all devices in home network

```
GET /networks/{homeWifiId}/members
```

**Swagger:** `home-hub#/Members/networksHomeWifiIdMembersGet`

Returns online and offline stations with live RSSI, tx/rx rates.  
For MLO stations: check `links` field — each link is an affiliated station.

---

### Get device profile (fingerprinting)

```
GET /networks/{homeWifiId}/member-profiles
GET /networks/{homeWifiId}/member-profiles/{memberId}
```

**Swagger:** `station-profiles#/Station profile/networksHomeWifiIdMemberProfilesGet`

**Response fields:**

| Field | Description |
|---|---|
| `type` | Device type (TV, PHONE, LAPTOP, OTHER, etc.) |
| `mobility` | `MOBILE` or `STATIC` |
| `type_set_by` | `SYSTEM`, `USER`, `FING`, `FINGERBANK` |
| `type_confidence` | 0–100; 100 = user-set |
| `model_name` | Device model |
| `manufacturer` | Manufacturer name |
| `operating_system` | OS |

---

### Change device friendly name or type

```
PUT /networks/{homeWifiId}/member-profiles/{memberId}
```

**Swagger:** `station-profiles#/Station profile/networksHomeWifiIdMemberProfilesMemberIdPut`

---

### Pause or resume internet access

```
PATCH /networks/{homeWifiId}/members/{id}
```

**Swagger:** `home-hub#/Members/networksHomeWifiIdMembersIdPatch`

*Third-party CPEs only. For Nokia BB devices, use CGI parental control.*

---

### Get internet access status

```
GET /networks/{homeWifiId}/members
```

`paused: true` means internet is blocked.

**Swagger:** `home-hub#/Members/networksHomeWifiIdMembersGet`

---

### Get device types and quality scores

```
GET /types
```

**Swagger:** `station-profiles#/types/typesGet`

Returns connectivity/stability/coverage score thresholds per device type.

---

### Delete offline device

```
DELETE /networks/{homeWifiId}/stations/{id}
```

**Swagger:** `home-hub#/Stations/networksHomeWifiIdStationsIdDelete`

---

### Get devices connected to a specific network device

```
GET /devices/{deviceId}/wifi/stations
```

**Swagger:** `device-hub#/Stations/devicesDeviceIdWifiStationsGet`

*USP, TR-069, and select Nokia BB devices.*

---

### Get devices connected per SSID (assoc list)

```
GET /devices/{deviceId}/wifi/vaps/{id}/assoclist
```

**Swagger:** `device-hub#/Virtual Access Points/devicesDeviceIdWifiVapsIdAssoclistGet`

Returns: client MAC, RSSI, MCS, physical rate, tx/rx bytes. *Home Agent integrated devices.*

---

### Get failing-to-connect devices

```
GET /devices/{deviceId}/wifi/failed-stations
```

**Swagger:** `device-hub#/Stations/devicesDeviceIdWifiFailedStationsGet`

Returns: MAC address, failure reason, attempt timestamp. *USP devices only.*

---

## Speed Test & Diagnostics

**Microservice:** `measures`

### Initiate a diagnostic or speed test

```
POST /networks/{homeWifiId}/diagnostics
```

**Swagger:** `measures#/WiFi health - Diagnostics/networksHomeWifiIdDiagnosticsPost`

**Request body options:**

| Field | Description |
|---|---|
| `internet_quality` | Speed test (Ookla/Mlab/TR-143) |
| `latency_quality` | Ping test |
| `service_quality` | Service quality diagnostic |
| `wifi_channel_score` | Channel score diagnostic |
| `wifi_quality` | WiFi quality diagnostic |
| `speedtest_model` | Override speed test engine |

Returns a `diagnostic_id` to poll for results.

---

### Get diagnostic result / poll status

```
GET /networks/{homeWifiId}/diagnostics/{diagnosticId}
```

**Swagger:** `measures#/WiFi health - Diagnostics/networksHomeWifiIdDiagnosticsDiagnosticIdGet`

---

### Get diagnostics history

```
GET /networks/{homeWifiId}/diagnostics
```

**Swagger:** `measures#/WiFi health - Diagnostics/networksHomeWifiIdDiagnosticsGet`

Returns last 30 days, max 100 entries. Filter with `?filter=internet_quality` or `latency_quality`.

---

### Get/Set speed test configuration

```
GET /speedtest/configs
PUT /speedtest/configs
```

**Swagger:** `device-hub#/speedtest/speedtestConfigsGet` / `speedtestConfigsPut`

**Config fields:** `mode` (none/ookla/mlab/tr-143), `host`, download/upload URLs, `time_duration` (TR-143).  
Set `model: "RDOF"` for FCC compliance testing.

---

### Get speed test mode on device

```
GET /devices/{deviceId}/speedtest/params
```

**Swagger:** `device-hub#/Speed Test mode/devicesDeviceIdSpeedtestparamsGet`

---

### Neighbor WiFi scan

```
GET /networks/{homeWifiId}/devices/{deviceId}/scan
```

**Swagger:** `measures#/Measures/networksHomeWifiIdDevicesDeviceIdScanGet`

Allow up to 5 min timeout. Returns nearby WiFi APs and their signal levels.

---

## RSSI & Steering History

**Microservice:** `dashboard-bff`

### Get RSSI and steering event history

```
GET /networks/{homeWifiId}/members/{memberId}/rssi
```

**Swagger:** `dashboard-bff#/RSSI/networksHomeWifiIdMembersMemberIdRssiGet`

**Query params:** `from`, `to` (timestamps).

**Response fields:** `operation` (ASSOCIATION / DISASSOCIATION / RSSI_THRESHOLD_CHANGE), `device_id` (which AP), `channel`, RSSI value.  
For MLO: `links` field contains per-link RSSI and band.

---

## Topology & Mesh

**Microservice:** `home-hub`, `device-hub`

### Get mesh topology

```
GET /networks/{homeWifiId}/mesh
```

**Swagger:** `home-hub#/Topology/networksHomeWifiIdMeshGet`

**Response structure:**
- `aps[]` — list of access points: online status, role (`controller`/`agent`), IP, SSIDs
- `meshbackhaulnodes[]` — nodes connected via backhaul
- `mlds` — MLO config (WiFi 7 devices)
- `links[]` — link info between endpoints; multiple objects per endpoint pair for MLO

---

### Onboard extender (add to trusted list)

```
POST /devices/{deviceId}/mesh/onboard
```

**Swagger:** `device-hub#/Extender/devicesDeviceIdMeshOnboardPost`

**Required params:** `serial_number` of extender, root device MAC. *Nokia USP/Home Agent only.*

---

### Get trusted extender list

```
GET /devices/{deviceId}/mesh/onboard
```

**Swagger:** `device-hub#/Extender/devicesDeviceIdMeshOnboardGet`

---

### Remove extender from trusted list

```
POST /devices/{deviceId}/mesh/offboard
```

**Swagger:** `device-hub#/Extender/devicesDeviceIdMeshOffboardPost`

---

### Remove offline extender from mesh

```
DELETE /devices/{deviceId}/wifi/extender/{extenderId}
```

**Swagger:** `device-hub#/Extender/devicesDeviceIdWifiExtenderIdDelete`

---

### Get modem/gateway association

```
GET /networks/{homeWifiId}/gateway
```

**Swagger:** `home-hub#/Topology/networksHomeWifiIdGatewayGet`

Pass modem MAC → returns connected gateways. Pass gateway MAC → returns connected modem. *USP only.*

---

## Network History & Activity Log

**Microservice:** `activity-log`

### Search network activity

```
GET /networks/{homeWifiId}/activity
```

**Swagger:** `activity-log#/Networks/getNetworkActivity`

**Query parameters:**

| Parameter | Description |
|---|---|
| `device_id` | Filter by extender MAC |
| `origin` | `USER`, `AGENT`, `DEVICE`, `MESHNETWORK` |
| `operation` | e.g. `DEV_REBOOT`, `DEV_FIRMWARE_UPGRADED` (comma-separated for multiple) |
| `from` / `to` | Date range |
| `page` / `size` | Pagination |

---

### Download activity history (CSV/text)

```
GET /networks/{homeWifiId}/activity/download
```

**Swagger:** `activity-log#/Networks/downloadNetworkActivity`

Set `Accept: text/csv` or `Accept: text/plain` header.

---

### Log session event (care agent session tracking)

```
POST /networks/{homeWifiId}/activity
```

**Swagger:** `activity-log#/Networks/postNetworkActivity`

**Body:** `{"operation": "session_start"}` or `{"operation": "session_stop"}`

---

### Custom USP data model subscriptions

| Action | Swagger |
|---|---|
| Create subscription | `activity-log#/Monitors/createActivityLogMonitor` |
| Update subscription | `activity-log#/Monitors/updateActivityLogMonitor` |
| Delete subscription | `activity-log#/Monitors/deleteActivityLogMonitor` |
| List subscriptions | `activity-log#/Monitors/listActivityLogMonitors` |
| Get one subscription | `activity-log#/Monitors/getActivityLogMonitor` |
| Get event history by path | `activity-log#/Device Events/getDeviceMonitorEvents` |
| Download event history | `activity-log#/Device Events/downloadDeviceMonitorEvents` |
| Get event count | `activity-log#/Device Events/getDeviceMonitorEventsCount` |

Limits: max 2 subscriptions, max 25 data model paths each. Rate-limited if > 3 events/5 min. *USP only.*

---

### Fetch device logs

```
POST /networks/{homeWifiId}/logs           # initiate fetch
GET  /networks/{homeWifiId}/logs/status    # poll status
```

**Swagger:** `activity-log#/Networks/postLogs` / `getLogsStatus`

Uploads logs to an HTTP server or S3 bucket.

---

## Network Device Health

**Microservice:** `device-management`

All of the following use:

```
GET /devices/{deviceId}/status
```

**Swagger:** `device-management#/Device Management/devicesDeviceIdStatusGet`

| Data point | Field |
|---|---|
| Online/offline | `online` |
| IP address | Use mesh API (`home-hub`) or networks API (`device-hub`) instead |
| First seen | `first_seen` |
| Last boot | `last_boot` |
| Last offline | `last_offline` |
| Uptime | Derived from `last_boot` |
| Software version | `sw_version` |
| Hardware version | `hw_version` |
| Model | `model` |

---

## WAN & Router Information

**Microservice:** `device-hub`

### Get WAN info (IP, DNS, DHCP config)

```
GET /devices/{deviceId}/networks
```

**Swagger:** `device-hub#/Networks/devicesDeviceIdNetworksGet`

---

### Get WAN counters (live tx/rx bytes)

```
GET /devices/{deviceId}/wan/counters
```

**Swagger:** `device-hub#/WAN/devicesDeviceIdWanCountersGet`

Also returns WAN PHY rate (max/current bit rate, duplex mode) for Ethernet WAN. *Nokia BB and USP.*

---

### Get WLAN current config

```
GET /devices/{deviceId}/wifi/vaps
```

**Swagger:** `device-hub#/Virtual Access Points/devicesDeviceIdWifiVapsGet`

Returns: SSIDs, WiFi standard, encryption, operating channel.

---

### Get devices connected (all in home network)

```
GET /networks/{homeWifiId}/members
```

**Swagger:** `home-hub#/Members/networksHomeWifiIdMembersGet`

---

### Get single device detailed info

```
GET /networks/{homeWifiId}/member-profiles/{memberId}
```

**Swagger:** `station-profiles#/Station profile/networksHomeWifiIdMemberProfilesMemberIdGet`

---

## WLAN Configuration

**Microservice:** `device-hub`, `home-hub`

### Set WLAN config (SSID name, password, encryption)

```
PATCH /devices/{deviceId}/wifi/vaps
```

**Swagger:** `device-hub#/Virtual Access Points/devicesDeviceIdWifiVapsPatch`

Config propagates from root to extenders automatically on mesh networks.

---

### Modify WiFi network (SSID name + password, home-level)

```
PATCH /networks/{homeWifiId}/wifi/vaps
```

**Swagger:** `home-hub#/WiFi VAPs/networksHomeWifiIdWifiVapsPatch`

---

### Manage WiFi (SSID split, name, password)

```
PATCH /networks/{homeWifiId}/main-wifi
```

**Swagger:** `home-hub#/Main WiFi/networksHomeWifiIdMainWifiPatch`

*Third-party Home Agent CPEs only.*

---

### Restart WiFi radio

```
POST /devices/{deviceId}/wifi/radios/{radioId}/reset
```

**Swagger:** `device-hub#/WiFi Radios/devicesDeviceIdWifiRadiosIdResetPost`

---

## Reboot & Factory Reset

**Microservice:** `device-hub`

### Reboot device

```
POST /devices/{deviceId}/system/reboot
```

**Swagger:** `device-hub#/System/devicesDeviceIdSystemRebootPost`

---

### Factory reset device

```
POST /devices/{deviceId}/system/factory
```

**Swagger:** `device-hub#/System/devicesDeviceIdSystemFactoryPost`

Usually only the root needs to be reset. Extenders don't store much local data.

---

## Parental Controls

**Microservices:** `device-hub`, `home-hub`, `station-profiles`

### Get firewall / parental control capability

```
GET /firewall/capability
```

**Swagger:** `device-hub#/Firewall/getFirewallCapability`

Returns which parental control method the device supports.

---

### Get family profiles (Nokia BB devices)

```
GET /devices/{deviceId}/firewall/profile
```

**Swagger:** `device-hub#/Firewall/devicesDeviceIdFirewallProfileGet`

---

### Family profile CRUD (third-party USP)

```
GET    /networks/{homeWifiId}/groups
GET    /networks/{homeWifiId}/groups/{groupId}
PUT    /networks/{homeWifiId}/groups/{groupId}
DELETE /networks/{homeWifiId}/groups/{groupId}
```

**Swagger:** `station-profiles#/Stations group/networksHomeWifiIdGroupsGet` etc.

---

### Rules management (schedules)

```
POST   /networks/{homeWifiId}/groups/{groupId}/rules
DELETE /networks/{homeWifiId}/groups/{groupId}/rules
DELETE /networks/{homeWifiId}/groups/{groupId}/rules/{ruleId}
PATCH  /networks/{homeWifiId}/groups/{groupId}/rules/{ruleId}
```

**Swagger:** `station-profiles#/Stations group/...`

---

### Member management (add/remove from profile)

```
POST   /networks/{homeWifiId}/groups/{groupId}/members
DELETE /networks/{homeWifiId}/groups/{groupId}/members/{mac}
```

**Swagger:** `station-profiles#/Stations group/...`

---

### Pause / resume internet for a device

```
PATCH /networks/{homeWifiId}/members/{id}
GET   /networks/{homeWifiId}/members
GET   /networks/{homeWifiId}/members/{id}
```

**Swagger:** `home-hub#/Members/networksHomeWifiIdMembersIdPatch`

*For Nokia BB: use CGI parental control instead.*

---

## Historical Statistics

**Microservice:** `stats`

### Historical WAN rates (broadband rates)

```
GET /wan/rates
```

**Swagger:** `stats#/WAN Statistics/getWanRates`

Query params: `from`, `to`, `interface` (USP only, for per-WAN filtering).

---

### Historical WAN usage (broadband usage)

```
GET /wan/usage
```

**Swagger:** `stats#/WAN Statistics/getWanUsage`

Returns aggregated Tx/Rx bytes for the period.

---

### Historical device usage

```
GET /stations/usage
```

**Swagger:** `stats#/Station Statistics/getAggregatedStationUsage`

Returns aggregated traffic of all stations for the period.

---

## Live Traffic

**Microservice:** `device-hub`

### Live WLAN traffic per BSSID

```
GET /devices/{deviceId}/wifi/vaps/stats
```

**Swagger:** `device-hub#/Virtual Access Points/devicesDeviceIdWifiVapsStatsGet`

*USP and TR-069 (root only).*

---

### Live device traffic (per connected station)

```
GET /devices/{deviceId}/stations/usage
```

**Swagger:** `device-hub#/Device Usage/devicesDeviceIdStationsUsageGet`

*Nokia BB (Home Agent) and USP. Some Nokia BB models excluded.*

---

## Network Slicing

**Microservice:** `home-hub`

*Nokia USP-enabled devices only. Max 2 slices per home (configurable).*

| Action | Method | Path | Swagger |
|---|---|---|---|
| Create slice | POST | `/networks/{homeWifiId}/slice` | `home-hub#/Slice/networksHomeWifiIdSlicePost` |
| Update slice | PATCH | `/networks/{homeWifiId}/slice/{sliceId}` | `...SliceSliceIdPatch` |
| Get all slices | GET | `/networks/{homeWifiId}/slice` | `...SliceGet` |
| Delete slice | DELETE | `/networks/{homeWifiId}/slice/{sliceId}` | `...SliceSliceIdDelete` |
| Get slice health | GET | `/networks/{homeWifiId}/slice/{sliceId}/status` | `...SliceSliceIdStatusGet` |
| Get slice stations | GET | `/networks/{homeWifiId}/slice/{sliceId}/stations` | `...SliceSliceIdStationsGet` |
| Get average latency | GET | `/networks/{homeWifiId}/slice/{sliceId}/latency` | `...SliceSliceIdLatencyGet` |
| Get historical latency | GET | `/networks/{homeWifiId}/slice/{sliceId}/historical-latency` | `...SliceSliceIdHistoricalLatencyGet` |

> Create may take 2–3 minutes to respond.

---

## WiFi Radios & Channels

**Microservice:** `device-hub`

### Get channel info

```
GET /devices/{deviceId}/wifi/channels
```

**Swagger:** `device-hub#/WiFi Radios/devicesDeviceIdWifiChannelsGet`

Returns supported bands, channels, channel widths.

---

### Get WiFi radio config

```
GET /devices/{deviceId}/wifi/radios
```

**Swagger:** `device-hub#/WiFi Radios/devicesDeviceIdWifiRadiosGet`

Returns: `auto` (ACS on/off), `channel`, `htmode` (bandwidth), WiFi-7 capability.

---

### Set WiFi radio config

```
PUT /devices/{deviceId}/wifi/radios/{radioId}
```

**Swagger:** `device-hub#/WiFi Radios/devicesDeviceIdWifiRadiosIdPut`

Set `auto`, `channel`, and `htmode` together.

---

### Get channel utilization

```
GET /devices/{deviceId}/wifi/radios/{radioId}/channel-utilization
```

**Swagger:** `device-hub#/WiFi Radios/devicesDeviceIdWifiRadiosIdChannelUtilizationGet`

---

### Get interference data

```
GET /devices/{deviceId}/wifi/interference
```

**Swagger:** `device-hub#/WiFi Radios/devicesDeviceIdWifiInterferenceGet`

*Nokia BB Home Agent, select models (e.g. Beacon 3) only.*

---

## Support Operations

**Microservice:** `device-hub`, `activity-log`

### Reset admin password (to sticker default)

```
POST /devices/{deviceId}/router/ui/reset-password
```

**Swagger:** `device-hub#/Router/devicesDeviceIdRouterUiResetPasswordPost`

---

### Reset WiFi password (to sticker default)

```
POST /devices/{deviceId}/wifi/vaps/{id}/reset-password
```

**Swagger:** `device-hub#/Virtual Access Points/devicesDeviceIdWifiVapsIdResetPasswordPost`

---

### Get SSID password policy

```
GET /password-policy
```

**Swagger:** `device-hub#/Password Policy/getPasswordPolicy`

*Nokia USP devices only.*

---

## Device Provisioning

**Microservice:** `device-provisioning`

### Get count of provisioned devices

```
GET /devices
```

**Swagger:** `device-provisioning#/devices/devicesGet`

---

### Provision a single device

```
PUT /devices/{deviceId}/credential
```

**Swagger:** `device-provisioning#/devices/updateDeviceCredential`

**Body fields:**

| Field | Required | Notes |
|---|---|---|
| `mac` | Yes | Device MAC address |
| `password` | Conditional | Required unless TR-069 only |
| `oui` | Conditional | Required for TR-069 |
| `pc` (product class) | Conditional | Required for TR-069 |
| `sn` (serial number) | Conditional | Required for TR-069; optional for pre-pairing |
| `acs` | No | `true` only if TR-069 manager installed |
| `derived` | No | `true` if Home Agent sends hashed password |

---

### Bulk provision (CSV upload)

```
PUT /provisioning/credentials
```

**Swagger:** `device-provisioning#/Provisioning/updateCredentials`

---

### Bulk de-provision (CSV upload)

```
DELETE /provisioning/credentials
```

**Swagger:** `device-provisioning#/Provisioning/deleteAllCredentials`

---

### Delete single device from provisioning list

```
DELETE /provisioning/credentials/{deviceId}
```

**Swagger:** `device-provisioning#/Provisioning/deleteCredentials`

---

### Validate provisioning status

```
POST /provisioning/validate
```

**Swagger:** `device-provisioning#/Provisioning/validateCredentials`

**Authorization header:** `Basic {base64(MAC:password)}`

---

### Change tenant ID of provisioned device

```
PUT /devices/{deviceId}/tenant
```

**Swagger:** `device-provisioning#/devices/updateTenantdevice`

Header: `X-REALM_ID: <sourceTenant>`. Body: `{ "tenant_id": "<targetTenant>" }`.  
Pre-condition: no CustomerID associated.

---

### Download unauthenticated device list

```
GET /reports
```

**Swagger:** `device-provisioning#/Reports/reportsGet`

Returns CSV: `client_id`, `username`, `password`, `IP`, `port`, `created_at`.

---

## Device Association

**Microservice:** `subscribers`

### Associate device(s) with a CustomerID

```
POST /subscribers
```

**Swagger:** `subscribers#/Subscribers/addSubscriber`

**Body:**

```json
{
  "uuid": "customer-id",
  "home_wifi_id": "AA-BB-CC-DD-EE-FF",
  "name": "optional name",
  "email": "optional@email.com"
}
```

**Customer ID constraints:** lowercase alphanumeric + `_` + `-`; max recommended 10 chars.

---

### Bulk associate (CSV upload)

```
POST /subscribers/upload
```

**Swagger:** `subscribers#/Subscribers/uploadSubscribers`

---

### Add device to existing home network

```
PUT /subscribers/{uuid}
```

**Swagger:** `subscribers#/subscribers/updatesSubscription`

---

### Get CustomerID by device MAC

```
GET /subscribers/network/{networkId}
```

**Swagger:** `subscribers#/Subscribers/getSubscriberByNetworkId`

---

### Get association status by CustomerID

```
GET /subscribers/{uuid}
```

**Swagger:** `subscribers#/Subscribers/getSubscriber`

---

### Update CustomerID or add devices

```
PUT /subscribers/{uuid}/update
```

**Swagger:** `subscribers#/Subscribers/updateSubscriber`

---

### Delete subscriber (all data)

```
DELETE /subscribers/{uuid}
```

**Swagger:** `subscribers#/Subscribers/deleteSubscriber`

---

### Bulk delete subscribers (CSV)

```
POST /subscribers/bulk-dissociation
```

**Swagger:** `subscribers#/Subscribers/bulkDissociation`

CSV columns: `uuid`, `devices` (semicolon-separated MACs). Leave `devices` empty to delete all. Max 5 MB. Timeout: 180 s min.

---

### De-associate single device from CustomerID

```
DELETE /subscribers/{uuid}/devices/{deviceId}
```

**Swagger:** `subscribers#/Subscribers/deleteAnExtenderDevice`

If `deviceId` is root, all extenders are also removed.

---

### De-associate all devices from CustomerID

```
DELETE /subscribers/{uuid}/topology
```

**Swagger:** `subscribers#/Subscribers/deletesTopologyAndDevicesOfTheSubscriber`

---

### Delete single device from home network topology

```
DELETE /networks/{homeWifiId}/topology/{deviceId}
```

**Swagger:** `home-hub#/Topology/networksHomeWifiIdTopologyDeviceidDelete`

Query params: `check_status=true` (only if offline), `factory_reset=true` (reset before delete).

---

### Delete entire home network topology

```
DELETE /networks/{homeWifiId}/topology
```

**Swagger:** `home-hub#/Topology/networksHomeWifiIdTopologyDelete`

Query param: `factory_reset=true`.

---

## Device Claim

**Microservice:** `subscribers`

### Check if device is claimed

```
GET /subscribers/device/{deviceId}/status
```

**Swagger:** `subscribers#/Subscribers/getDeviceAssociationStatus`

Can be called **without an access token**. Returns only claimed/unclaimed, no subscriber info.

---

### Associate device to end-user account (claim)

```
POST /subscribers/claim
```

**Swagger:** `subscribers#/Subscribers/...`

Called by mobile app after account creation and email verification.

---

## Campaigns

**Microservice:** `scheduler`

> **Note:** Paths use `/schedules` (not `/rules` as some older docs may show).

### Schedule CRUD

```
GET    /schedules                          # list all schedules (filter: ?type=RDOF &action=INSTALL_CONTAINER)
POST   /schedules                          # create schedule
GET    /schedules/{schedule_id}            # get one schedule
PATCH  /schedules/{schedule_id}            # update schedule
DELETE /schedules/{schedule_id}            # delete schedule
PUT    /schedules/{schedule_id}/pause      # pause or unpause (body: {"pause": true})
```

**Schedule body fields:**

| Field | Description |
|---|---|
| `name` | Schedule name |
| `enabled` | true/false |
| `cron` | Cron expression (unix epoch int) |
| `time_zone` | e.g. `"Asia/Kolkata"` |
| `type` | `RDOF` (FCC) or other |
| `action` | `INSTALL_CONTAINER`, `UPGRADE_FIRMWARE`, etc. |
| `data` | Action-specific data (`test_type`, `max_rx_rate`, etc.) |
| `events` | Trigger on device events: `["NEW_DEVICE"]` |
| `apply_on_boot` | Apply when device boots |
| `duration_in_hours` | Campaign window duration |

**Campaign types:** firmware upgrade, configuration push, JavaScript scripting (zero-touch onboarding), RDOF speed testing.

### Device assignment

```
GET    /schedules/{schedule_id}/devices                      # list devices in schedule
POST   /schedules/{schedule_id}/devices                      # add devices (CSV or model filter)
DELETE /schedules/{schedule_id}/devices/{device_id}          # remove device from schedule
```

### Reports & trends

```
GET /schedules/{schedule_id}/reports                         # CSV report for schedule
GET /schedules/{schedule_id}/devices/{device_id}/reports     # per-device report
GET /schedules/{schedule_id}/trends                          # intent trends (params: from, to)
GET /schedules/{schedule_id}/compliance                      # compliance score (Nokia BB only)
```

### Configuration

```
POST /configs                              # create scheduler config (e.g. latency_server_url for RDOF)
```

---

## Subscriber Account Management

**Microservice:** `auth`

*Keycloak-based subscriber (end-user) accounts.*

| Action | Swagger |
|---|---|
| Create subscriber account | `auth#/credentials/createCredentials` |
| Reset subscriber password | `auth#/credentials/resetPassword` |
| Update subscriber account | `auth#/credentials/updateCredentials` |
| Delete subscriber account | `auth#/credentials/deleteCredentials` |
| Get credentials from UUID | `auth#/credentials/getsCredentialsByUserUuid` |

---

## Kafka Data Ingestion

**Microservice:** `data-ingestion`

*Only available if the operator has enabled this feature.*

| Action | Method | Swagger |
|---|---|---|
| List supported topics | GET | `data-ingestion#/subscribe/getAvailableTopics` |
| Subscribe to topic | POST | `data-ingestion#/Data Ingestion/subscribeDataIngestion` |
| List subscribed topics | GET | `data-ingestion#/Data Ingestion/unsubscribeDataIngestion` |
| Unsubscribe from topic | DELETE | `data-ingestion#/Data Ingestion/unsubscribeDataIngestion` |

---

## L1 Problem Finder

**Microservice:** `measures`

### Get active problems (recommendations)

```
GET /networks/{homeWifiId}/recommendations
```

**Swagger:** `measures#/Recommendations/networksHomeWifiIdRecommendationsGet`

For live-data-based problems: run diagnostics first (`POST /diagnostics`), wait for completion, then call this.

---

### Get problems history

```
GET /networks/{homeWifiId}/recommendations/history
```

**Swagger:** `measures#/Recommendations/networksHomeWifiIdRecommendationsHistoryGet`

---

### Get/Set global problem finder configuration

```
GET /config/recommendations
PUT /config/recommendations
```

**Swagger:** `measures#/Recommendations/configRecommendationsGet` / `configRecommendationsPut`

Config fields: enable/disable problem types, `visible_to_user` flag, sample duration, event count thresholds.

---

### Get/Set per-user problem finder settings

```
GET   /networks/{homeWifiId}/config/recommendations
PATCH /networks/{homeWifiId}/config/recommendations/{recommendationId}
```

**Swagger:** `measures#/Recommendations/networksHomeWifiIdConfigRecommendationsGet`

Use `ignore` to suppress all problems for a subscriber; `ignored_devices` for a specific device.

---

## API Notifications

**Delivery:** HTTPS POST to operator-configured URL.  
**Auth:** HTTP Basic (predefined username/password).  
**Retry:** 3 retries, then cache for 4 hours. Timeout: 2 seconds per request.  
**Batch size:** Up to 20 events per POST, sorted oldest first.

### Supported events

| Event | Trigger |
|---|---|
| `DEVICE_ADDED` | New device onboarded, or subscriber claims device |
| `DEVICE_DELETED` | Device deleted via API |
| `DEVICE_CONNECTED` | Device connects to Home Controller |
| `FOUND_UNPROVISONED_DEVICE` | Unprovisioned device tries to authenticate (dedicated platforms only) |

### Sample payload

```json
[
  {
    "event": "DEVICE_ADDED",
    "event_time": "2019-07-26T10:55:28.693Z",
    "home_wifi": "AA-BB-CC-DD-EE-FF",
    "uuid": "subscriber-uuid",
    "device_id": "AA-BB-CC-DD-EE-FF"
  },
  {
    "event": "FOUND_UNPROVISONED_DEVICE",
    "device_id": "AA-BB-CC-DD-EE-FF",
    "password": "device-password",
    "ip_addr": "203.0.113.1",
    "port": "8883",
    "event_time": "2019-07-26T10:55:28.693Z"
  }
]
```

### Get pending/missed notifications

```
GET /subscribers/oss-bss/events
```

**Swagger:** `subscribers#/OssBss Event/getsQueuedDevices`

---

## Data Privacy

**Microservice:** `home-hub`

| Action | Method | Path | Swagger |
|---|---|---|---|
| Get data collection status | GET | `/networks/{homeWifiId}/privacy-data/status` | `home-hub#/Privacy Data/networksHomeWifiIdPrivacyDataStatusGet` |
| Enable data collection | PUT | `/networks/{homeWifiId}/privacy-data/status` | `...StatusPut` |
| Disable data collection | PUT | `/networks/{homeWifiId}/privacy-data/status` | Same endpoint, different body |
| Get collected private data (CSV) | GET | `/networks/{homeWifiId}/privacy-data` | `...networksHomeWifiIdPrivacyDataGet` |

*Nokia BB (Home Agent) and USP only.*

---

## Advanced Device Management — Nokia CGI

**Microservice:** `device-hub`

CGI calls are wrapped in a REST POST to:

```
POST /devices/{deviceId}/router/management
```

**Body structure:**

```json
{
  "payload": {
    "data": "act=SetLedGlb&EnableGbl=1",
    "headers": { "Content-Type": "application/x-www-form-urlencoded" },
    "id": "any-string",
    "method": "GET | POST",
    "resource": "cgi-script-name.cgi"
  }
}
```

**Success response:** `{"result": 0, "reason": 0}`

---

### Onboarding readiness check

```
resource: login_app.cgi?sts
method:   GET
```

Response fields: `mesh`, `onboard`, `gwsnum` (serial), `gwready`.

---

### WiFi onboarding (set SSID + password)

```
resource: whw_onboarding_app.cgi
method:   POST
data:     act=ConfigWhwPswd&pswdNew=...&wl_ssid=...&wpaKey=...
```

**Password rules:** 8–24 chars, alphanumeric + `!#+,-./:=@_`, first char not special, at least 2 character classes.

---

### Extender onboarding

```
resource: whw_zerotouchonb_app.cgi
method:   POST
data:     act=AddBeacon&BeaconSrn=ALCL11113333
```

### Extender onboarding status poll

```
resource: whw_zerotouchonb_status_app.cgi?gmode=check|start|poll
method:   GET
```

Status progression: `NotDetected` → `NotConnected` → `Connected` → `Configured` → `Connection_Good/Bad/Average`

---

### LED control

**Global:**
```
resource: ledctrl_app.cgi
data:     act=SetLedGlb&EnableGbl=1
```

**Per device:**
```
resource: ledctrl_app.cgi
data:     act=SetLedMac&MacAddr=AA:BB:CC:DD:EE:FF&Enable=1
```

**Status:**
```
resource: ledctrl_status_app.cgi
method:   GET
```

---

### Guest WiFi

```
resource: wlan_config_app.cgi
data:     act=ConfigWhwGuest&enable=1&wl_ssid=GuestNet&wpaKey=pass&dura=240&iso=0&accessType=password
```

`dura=0` = permanent; `dura=N` = expires after N minutes.

---

### Networking mode (bridge/RGW)

```
resource: whw_beacon_mode_app.cgi
data:     act=setWorkMode&brEnable=1   (bridge) / brEnable=0 (RGW)
```

**Status:**
```
resource: whw_beacon_mode_app.cgi?getWorkMode
```
Response: `{"workMode": "RGW" | "AP_Bridge"}`

---

### WAN connection mode (DHCP/PPPoE/static)

```
resource: whw_beacon_mode_app.cgi
data:     act=WanConnEdit&type=dhcp&oid=1
          act=WanConnEdit&type=pppoe&pppoe_username=x&pppoe_password=x&oid=1
          act=WanConnEdit&type=static&ipAddr=...&subnetMask=...&defGateway=...&priDns=...&secDns=...&oid=1
```

---

### Static IP reservation

**Add:**
```
resource: lan_ipv4_app.cgi
data:     act=Add&bindmac=AA:BB:CC:DD:EE:FF&bindip=192.168.1.100
```

**Delete:**
```
data: act=Del&oid=5
```

**List:** `GET dhcpv4_server_status_app.cgi`

---

### Port forwarding

**Add:**
```
resource: portmapps_app.cgi
data:     act=Add&wanif=ip,1,1,1&en_map=1&proto=TCP&serverIp=192.168.1.60&nat_value=1&etPortStart=8080&etPortEnd=8080&inPortStart=80&inPortEnd=80
```

**List:** `GET portmapps_status_app.cgi`

---

### Custom DNS

```
resource: wan_config_app.cgi
data:     act=CustomDNS&oid=1&type=dhcp&priCusDns=8.8.8.8&secCusDns=8.8.4.4&enCusDns=1
```

**List:** `GET wan_list_app.cgi?gmode=DNS` *(unauthenticated)*

---

### UPnP

```
resource: upnp_app.cgi
data:     act=setUpnpMode&upnpEnable=1
```

**Status:** `GET upnp_status_app.cgi`

---

### Parental control (Nokia BB CGI)

**Base CGI:** `parental_ctrl_nok_app.cgi`

| Operation | `act` value | Key params |
|---|---|---|
| Create/modify profile | `NPCSetProfile` | `pid`, `profileName`, `internetCtrl` |
| Create/modify schedule | `NPCSetSchedule` | `parentid`, `schid`, `schEnable`, `schBedtime`, `startTime`, `endTime`, `dayOfWeek` |
| Move device to profile | `NPCMoveDevice` | `srcPid`, `destPid`, `devIdx` |
| Delete schedule | `NPCDeleteSchedule` | `parentid`, `schid` |
| Delete device from profile | `NPCDeleteDevice` | `srcPid`, `devIdx` |
| Delete profile | `NPCDeleteProfile` | `srcPid` |

**Status GET:** `parental_ctrl_nok_status_app.cgi?gmode=getallinfo|allgrpnames|allgrpcnt|homegrp|onegrpidx&gpid=N`

**Day of week:** 0=Sunday, 1=Monday, … 6=Saturday

---

### FWA/FastMile device info

```
resource: device_info_status_app.cgi
method:   GET
```

Returns: `IMEI`, `ProductClass`, `SerialNumber`, `HardwareVersion`, `SoftwareVersion`, `UpTime`, active device counts.

---

### FastMile statistics (SIM, 5G/LTE)

```
resource: fastmile_stats_app.cgi
method:   GET
```

Returns: `sim_cfg` (Status, IMSI, ICCID), `cell_5G_stats_cfg` (PCI, Band, SNR, RSRP, NetworkInUse), `cell_LTE_stats_cfg`.

---

### APN details

```
resource: apn_status_app.cgi
method:   GET
```

Returns: `MNC`, `MCC`, `APN`, `APNType`, `Protocol`.

---

### Geo-location

```
resource: location_app.cgi
method:   POST (set) / GET (read)
```

---

## Advanced Device Management — USP/TR-069

**Microservice:** `device-hub`, `home-hub`

### Advanced radio settings

```
GET/PUT /devices/{deviceId}/wifi/radios/{radioId}
```

**Swagger:** `device-hub#/WiFi Radios/devicesDeviceIdWifiRadiosGet`

---

### Advanced SSID settings

```
GET/PATCH /devices/{deviceId}/wifi/vaps
```

**Swagger:** `device-hub#/Virtual Access Points/devicesDeviceIdWifiVapsGet`

---

### Port forwarding

```
GET/POST/DELETE /devices/{deviceId}/nat/port-mappings
```

**Swagger:** `device-hub#/NAT/...`

---

### LAN DHCP server settings

```
GET/PUT /devices/{deviceId}/lan/dhcp
```

**Swagger:** `device-hub#/LAN/...`

---

### LAN IP address and subnet mask

```
PUT /devices/{deviceId}/lan/ip
```

**Swagger:** `device-hub#/LAN/...`

---

### Static IP for a station

```
POST /devices/{deviceId}/stations/{mac}/static-ip   (assign)
GET  /devices/{deviceId}/stations/{mac}/static-ip   (get current)
```

**Swagger:** `device-hub#/Stations/...`

---

### WAN settings

```
GET    /devices/{deviceId}/wan
PUT    /devices/{deviceId}/wan/{wanId}
DELETE /devices/{deviceId}/wan/{wanId}
```

**Swagger:** `device-hub#/WAN/...`

---

## QoS / Airtime Management

**Microservice:** `device-hub`

### List prioritized devices

```
GET /devices/{deviceId}/qos/priority
```

**Swagger:** `device-hub#/QoS/...`

---

### Set/reset device prioritization

```
PUT /devices/{deviceId}/qos/priority/{stationMac}
```

**Swagger:** `device-hub#/QoS/...`

---

## HDM Integration

**Microservice:** `acs-proxy`

Wraps Nokia ACS/HDM (TR-069) server operations. *Nokia Broadband (finepoint) devices only unless noted.*

### Device search & retrieval

```
GET /devices                              # search ACS devices (?search=column:value e.g. serial_number:ALCLFC383F22)
GET /devices/{device_id}                  # get device details from ACS
DELETE /devices/{device_id}               # delete device from ACS
```

### Device data access

```
GET /devices/{device_id}/config           # full device configuration from ACS
GET /devices/{device_id}/config_tags      # filtered config name/value pairs (?params=[...])
GET /devices/{device_id}/cached_params    # cached parameter tags (?refresh=true &params=[...])
GET /devices/{device_id}/browse/{data_model_path}  # browse TR-069 data model tree
GET /devices/{device_id}/log              # device log entries (?size=1000 &sort=descending &start_dt &end_dt)
GET /devices/{device_id}/firmwares        # firmware history list
```

### Device operations

```
PUT  /devices/{device_id}/refresh         # refresh device params in ACS (?full_refresh=true)
POST /devices/{device_id}/system/reboot   # reboot device via ACS
POST /devices/{device_id}/system/factory_reset  # factory reset via ACS
POST /devices/{device_id}/sync_operations   # synchronous TR-069 Get/Set (body: {rpc, parameters})
POST /devices/{device_id}/async_operations  # asynchronous TR-069 Get/Set (body: {rpc, parameters})
```

**sync/async_operations body:**
```json
{
  "rpc": "Get",
  "parameters": {
    "parameter": [
      { "name": "string", "type": "string", "value": "string" }
    ]
  }
}
```

### Backup & restore (finepoint only)

```
PUT /devices/{device_id}/system/backup    # trigger backup (body: {backup: {url, fms, username, password}})
PUT /devices/{device_id}/system/restore   # trigger restore with download (body: {restore: {url, ...}})
```

### Provisioning (legacy Swagger names)

| Action | Swagger |
|---|---|
| Provision device into HDM | `acs-proxy#/.../provisionDevice` |
| Validate HDM provision | `acs-proxy#/.../validateProvision` |
| Trigger firmware upgrade via HDM | `acs-proxy#/.../triggerUpgrade` |
| Get operation status | `acs-proxy#/.../getOperationStatus` |

---

## Analytics Dashboard

**Microservice:** `dashboard-bff`

| Endpoint | Swagger |
|---|---|
| Performance reports | `dashboard-bff#/Analytics/...` |
| Device ranking | `dashboard-bff#/Analytics/...` |
| Quality indicators | `dashboard-bff#/Analytics/...` |
| Device connection activity | `dashboard-bff#/Analytics/...` |

---

## FCC Broadband Compliance

**Microservice:** `scheduler`

FCC RDOF compliance uses the same `/schedules` API (see [Campaigns](#campaigns)) with `type: "RDOF"`.

1. Set speed test config: `PUT /speedtest/configs` with `model: "RDOF"` and `time_duration: 15` seconds
2. Create schedule: `POST /schedules` with `type: "RDOF"` and `data.test_type: "SPEED"`
3. Add devices: `POST /schedules/{schedule_id}/devices`
4. Reports: `GET /schedules/{schedule_id}/reports` and per-device `GET /schedules/{schedule_id}/devices/{device_id}/reports`
5. Compliance score: `GET /schedules/{schedule_id}/compliance` (Nokia BB only)

---

## Backup & Restore

**Microservice:** `upgrader`

```
GET  /devices/{deviceId}/backup/config       # get available configs
POST /devices/{deviceId}/backup              # trigger backup
GET  /devices/{deviceId}/backup              # get available backups
POST /devices/{deviceId}/restore             # trigger restore
GET  /devices/{deviceId}/operations/{opId}   # poll operation status
```

**Swagger:** `upgrader#/Backup/...`

---

## Firmware Upgrade

**Microservice:** `upgrader`

```
POST   /firmware                          # provision firmware image
DELETE /firmware/{imageId}                # delete provisioned firmware
GET    /firmware                          # list all uploaded images
GET    /devices/{deviceId}/firmware       # get current firmware on device
POST   /devices/{deviceId}/firmware/upgrade  # trigger upgrade
GET    /devices/{deviceId}/operations/{opId} # poll operation status
```

**Swagger:** `upgrader#/Firmware/...`

---

## Container Apps Management

**Microservice:** `container-management`, `application-management`

### On-device container management

```
GET    /devices/{deviceId}/containers/available           # containers available for install
GET    /devices/{deviceId}/containers                     # installed containers
GET    /devices/{deviceId}/containers/{containerId}       # container details
GET    /devices/{deviceId}/containers/metadata            # all container metadata
PATCH  /devices/{deviceId}/containers/{containerId}/autostart
POST   /devices/{deviceId}/containers/{containerId}/start
POST   /devices/{deviceId}/containers/{containerId}/stop
POST   /devices/{deviceId}/containers/install
DELETE /devices/{deviceId}/containers/{containerId}       # uninstall
PUT    /devices/{deviceId}/containers/{containerId}       # update
GET    /devices/{deviceId}/containers/operations/{opId}   # poll status
GET    /devices/{deviceId}/containers/events              # events history
```

### Statistics

```
GET /containers/{containerId}/install-count               # total installations
GET /containers/{containerId}/install-limit               # max installation limit
GET /containers/{containerId}/install-stats               # installation statistics
```

### Corteca Marketplace

```
GET /marketplace/containers                 # available containers
POST /marketplace/containers/{id}/purchase  # purchase
GET /marketplace/containers/{id}/compatibility
GET /marketplace/containers/{id}/license
GET /marketplace/categories
GET /marketplace/statuses
GET /marketplace/target-users
```

---

## L2 API

**Microservices:** `ouife`, `fmserver`, `proactive-engine`

### Network device metrics (historical CSV)

```
GET /devices/{deviceId}/metrics
```

**Swagger:** `ouife#/Metrics/...`

---

### Events & alarms

| Scope | Swagger |
|---|---|
| Device-level events | `ouife#/Events/getDeviceEvents` |
| Device-level alarms | `ouife#/Alarms/getDeviceAlarms` |
| Cluster-level events | `ouife#/Events/getClusterEvents` |
| Cluster-level alarms | `ouife#/Alarms/getClusterAlarms` |
| Tenant-level alarms | `fmserver#/Alarms/getTenantAlarms` |
| Custom alarms | `ouife#/Alarms/getCustomAlarms` |
| Device steering events | `ouife#/Steering/getSteeringEvents` |

---

### DFS statistics

```
GET /devices/{deviceId}/dfs-stats
```

**Swagger:** `ouife#/DFS/getDfsStats`

---

### Device location

```
GET/PUT /devices/{deviceId}/location
```

**Swagger:** `ouife#/Location/...`

---

### MLO steering configuration

```
GET/PUT /devices/{deviceId}/mlo-steering
```

**Swagger:** `ouife#/MLO/...`

---

### Prohibited channel configuration

```
GET/PUT /devices/{deviceId}/prohibited-channels
```

**Swagger:** `ouife#/Channels/...`

---

### Manual WiFi optimization trigger

```
POST /devices/{deviceId}/optimize-wifi
```

**Swagger:** `ouife#/Optimization/...`

---

### Proactive reboot campaigns

```
POST   /proactive/rules          # create rule
GET    /proactive/rules          # list rules
PUT    /proactive/rules/{ruleId} # update rule
DELETE /proactive/rules/{ruleId} # delete rule
```

**Swagger:** `proactive-engine#/...`

---

## Onboarding (Third-Party CPE)

**Microservice:** `onboarding`

*Third-party CPEs integrated through the Home Agent only.*

```
GET   /networks/{home_wifi_id}/onboard           # list onboarding processes (?status &state)
POST  /networks/{home_wifi_id}/onboard           # start new onboarding transaction
GET   /networks/{home_wifi_id}/onboard/{id}      # get transaction status
PATCH /networks/{home_wifi_id}/onboard/{id}      # validate/advance transaction (body: {"status": "WAITING"})
```

**POST body:**
```json
{
  "timeout": 0,
  "validation": true,
  "server_id": "string",
  "device_id": "string"
}
```

---

## JavaScript Extension Management

**Microservice:** `extension-management`

*USP-enabled Wi-Fi points only.*

### Execute a provisioned JavaScript API

```
POST /devices/{device_id}/api/{api_id}
```

`api_id` is formed from the target endpoint: e.g. `GET_DEVICEHUB_DEVICES_FINGERPRINT_STATIONS`.  
Body includes `pathVariables`, `queryParams`, `requestBody`, `headers`.

### Provision (manage JavaScript scripts)

```
GET    /provision                          # list all JavaScript metadata
POST   /provision                          # create JavaScript metadata + hooks
GET    /provision/{provision_id}           # get one script's metadata
PATCH  /provision/{provision_id}           # update metadata
DELETE /provision/{provision_id}           # delete
POST   /provision/{provision_id}/upload    # upload JavaScript file (?modules=comma-separated)
```

**POST /provision body fields:**

| Field | Description |
|---|---|
| `name` | Script name |
| `usage` | `generic` or specific use-case |
| `models` | Device models this script applies to |
| `firmwares` | Compatible firmware versions |
| `arguments` | Input argument definitions |
| `hooks` | Trigger conditions: `{ type: "DEVICE_OPERATIONS", apis: [...] }` |
| `enable` | Active state |

---

## Event Analyzer

**Microservice:** `event-analyzer`

Tracks and aggregates device event statistics.

```
GET  /event/stats         # get event statistics (?devices=comma-sep-MACs &tenantId=string; max 10 devices)
POST /event/stats         # record an event (body: {deviceId, eventName})
GET  /event/stats/download  # download all stats as CSV (columns: MacAddr, EventName, Count, Timestamps, service)
```

---

## Fault Manager (Tenant Alarms)

**Microservice:** `fmserver`

```
GET /alarms/{severity}    # tenant-level alarms by severity (critical/major/minor/clear/all)
                          # params: date_start, date_end (yyyy-MM-dd'T'HH:mm:ss UTC), device_id, page, size, categories
GET /unsupportedmodels    # list of unsupported device models from S3
```

**Alarm categories:** `lowMemory`, `lowFlash`, `lowRAM`, `wirelessInterface2.4G`, `wirelessInterface5G`, `cloudConnectionLost`, `watchDog`, `zombie`, `cpuUtilization`, `radioUptime`, `noiseInterference2G`, `noiseInterference5G`, `generalErrorMsg`

> Max time range per query: 7 days. Start date must be after 2016-12-31.

---

## Application Management (Container Registry)

**Microservice:** `application-management`

Manages the Corteca application/container registry (apps and their versioned assets).

### Application CRUD

```
GET    /apps                               # list apps (?category &device_model &firmware)
POST   /apps                               # create app (body: {fqdn, name})
GET    /apps/{app-uuid}                    # get app details
PUT    /apps/{app-uuid}                    # update app (body: {categories, description, maintainer_name, maintainer_url, metadata})
DELETE /apps/{app-uuid}                    # delete app
GET    /categories                         # list all app categories
```

### Version management

```
GET    /apps/{app-uuid}/versions           # list all versions
POST   /apps/{app-uuid}/versions           # create version (body: {label, metadata, released, summary})
GET    /apps/{app-uuid}/download-info/{version-label}  # get download info for a version
```

### Asset management

```
GET    /apps/{app-uuid}/assets             # list assets
POST   /apps/{app-uuid}/assets             # upload new asset (multipart/form-data)
GET    /apps/{app-uuid}/assets/{asset-uuid}  # get asset details
PUT    /apps/{app-uuid}/assets/{asset-uuid}  # edit asset (multipart/form-data)
DELETE /apps/{app-uuid}/assets/{asset-uuid}  # delete asset
```

---

## Proactive Engine

**Microservice:** `proactive-engine`

Condition-based automation rules (e.g. reboot if CPU > X%). Multi-tenant: use `X-Realm-Id` header.

### Rules CRUD

```
GET    /rules                              # list all rules
POST   /rules                              # create rule
GET    /rules/{rule_id}                    # get rule
PUT    /rules/{rule_id}                    # full update
PATCH  /rules/{rule_id}                    # update status only (body: {"enabled": true})
DELETE /rules/{rule_id}                    # delete rule
POST   /rules/sync                         # sync rules across shards
GET    /rules/conditions                   # list available condition types and possible values
```

**Rule body fields:**

| Field | Description |
|---|---|
| `type` | Rule action type, e.g. `REBOOT` |
| `name` | Display name |
| `enabled` | Active state |
| `condition` | `{ type: "CPU_USAGE", value: "string" }` — see `/conditions` for options |
| `cron` | Schedule (unix epoch int) |
| `duration_in_hours` | Campaign window |
| `tz` | Timezone e.g. `"Asia/Kolkata"` |
| `wan_threshold` | `{ ul_kbps, dl_kbps }` — only trigger if WAN traffic is below threshold |
| `model` | Filter by device model |
| `maclist` | Comma-separated MAC list |

### Reports & trends

```
GET /rules/{rule_id}/reports               # execution results for last 30 days (default)
GET /rules/{rule_id}/trends                # trends for a rule (?from &to — ISO 8601, max 30 days)
```

---

*End of API Reference*
