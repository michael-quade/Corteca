// Shared types used across all Corteca API clients

export interface CortecaConfig {
  baseUrl: string;   // e.g. "https://l1api.example.homewifi.nokia.com"
  clientId: string;
  clientSecret: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

// MAC address in uppercase hyphen-separated format: "AA-BB-CC-DD-EE-FF"
export type MacAddress = string;

export type NetworkId = MacAddress;   // home_wifi_id = root device MAC
export type DeviceId = MacAddress;    // network device (AP/router) MAC
export type MemberId = MacAddress;    // connected station/client MAC
export type CustomerId = string;      // subscriber UUID

// ─── Subscriber / Search ──────────────────────────────────────────────────

export interface HomeWifi {
  id: NetworkId;
  status: {
    online: boolean;
  };
}

export interface Subscriber {
  customer_id: CustomerId;
  uuid: CustomerId;
  name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  serial_number?: string;
  home_wifis: HomeWifi[];
}

export interface SubscriberSearchParams {
  email?: string;
  name?: string;
  device_id?: MacAddress;
  uuid?: string;
  serial_no?: string;
  live_status?: boolean;
  page?: number;
  size?: number;
}

// ─── Network Device ───────────────────────────────────────────────────────

export interface DeviceStatus {
  online: boolean;
  model: string;
  sw_version?: string;
  hw_version?: string;
  hw_id?: string;
  sw_id?: string;
  last_boot?: string;
  last_offline?: string;
  first_seen?: string;
  unmanaged?: boolean;
}

export interface DeviceLiveStatus {
  online: boolean;
  sw_version: string;
  model: string;
}

// ─── Members / Stations ───────────────────────────────────────────────────

export type DeviceType =
  | 'TV'
  | 'PHONE'
  | 'LAPTOP'
  | 'TABLET'
  | 'GAMING'
  | 'APPLIANCE'
  | 'CAMERA'
  | 'SPEAKER'
  | 'OTHER';

export type Mobility = 'MOBILE' | 'STATIC';

export interface MemberProfile {
  member_id: MemberId;
  name?: string;
  type?: DeviceType;
  mobility?: Mobility;
  model_name?: string;
  manufacturer?: string;
  operating_system?: string;
  type_confidence?: number;
  type_set_by?: 'SYSTEM' | 'USER' | 'FING' | 'FINGERBANK';
}

export interface Member {
  id: MemberId;
  alias?: string;
  connected: boolean;
  paused?: boolean;
  device_id?: DeviceId;
  type?: string;
  wifi_standard?: string;
  ipv4?: string;
  channel?: number;
  frequency?: number;
  rssi?: number;
  tx_rate?: number;
  rx_rate?: number;
  first_seen?: string;
  last_seen?: string;
  capable_24ghz?: boolean;
  capable_5ghz?: boolean;
  client_capabilities?: {
    wifi_standard?: string;
    ht_mode?: string;
    bandwidth?: string;
  };
}

// ─── Mesh / Topology ──────────────────────────────────────────────────────

export interface MeshAP {
  id: DeviceId;
  online: boolean;
  role: 'controller' | 'agent';
  ip_address?: string;
  ssids?: string[];
  model?: string;
  serial_number?: string;
}

export interface MeshTopology {
  aps: MeshAP[];
  meshbackhaulnodes?: MeshBackhaulNode[];
  links?: MeshLink[];
}

export interface MeshBackhaulNode {
  id: DeviceId;
  parent_id: DeviceId;
  medium: 'ethernet' | 'wireless';
}

export interface MeshLink {
  from: DeviceId;
  to: DeviceId;
  medium: string;
  rssi?: number;
  phy_rate?: number;
}

// ─── Diagnostics ──────────────────────────────────────────────────────────

export interface DiagnosticsRequest {
  internet_quality?: boolean;
  latency_quality?: boolean;
  service_quality?: boolean;
  wifi_channel_score?: boolean;
  wifi_quality?: boolean;
  speedtest_model?: 'ookla' | 'mlab' | 'tr143';
}

export interface DiagnosticsResult {
  diagnostic_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  type?: string;
  download_speed?: number;
  upload_speed?: number;
  latency?: number;
  created_at: string;
  completed_at?: string;
}

// ─── WiFi Radio ───────────────────────────────────────────────────────────

export interface WiFiRadio {
  id: string;
  band: '2.4GHz' | '5GHz' | '6GHz';
  auto: boolean;
  channel: number;
  htmode: string;
  wifi7_capable?: boolean;
}

// ─── Network Slice ────────────────────────────────────────────────────────

export interface NetworkSlice {
  slice_id: string;
  name: string;
  vlan_id?: number;
  ssids?: string[];
  status?: 'active' | 'inactive' | 'error';
}

// ─── Provisioning ─────────────────────────────────────────────────────────

export interface ProvisionDeviceRequest {
  mac: MacAddress;
  password?: string;
  oui?: string;
  pc?: string;
  sn?: string;
  acs?: boolean;
  derived?: boolean;
}

// ─── Association ──────────────────────────────────────────────────────────

export interface AssociateSubscriberRequest {
  uuid: CustomerId;
  home_wifi_id: NetworkId;
  name?: string;
  email?: string;
}

// ─── Campaigns ────────────────────────────────────────────────────────────

export type CampaignType = 'firmware' | 'config' | 'script';

export interface CampaignRule {
  rule_id: string;
  name: string;
  type: CampaignType;
  status: 'active' | 'paused' | 'completed';
  created_at: string;
}

// ─── Notifications ────────────────────────────────────────────────────────

export type NotificationEvent =
  | 'DEVICE_ADDED'
  | 'DEVICE_DELETED'
  | 'DEVICE_CONNECTED'
  | 'FOUND_UNPROVISONED_DEVICE';

export interface OssBssNotification {
  event: NotificationEvent;
  event_time: string;
  home_wifi?: NetworkId;
  uuid?: CustomerId;
  device_id: DeviceId;
  password?: string;
  ip_addr?: string;
  port?: string;
}

// ─── Historical Stats ─────────────────────────────────────────────────────

export interface StatsQuery {
  from: string;   // ISO 8601
  to: string;
  interface?: string;
}

export interface WanRatePoint {
  timestamp: string;
  download_rate: number;
  upload_rate: number;
}

export interface WanUsagePoint {
  timestamp: string;
  tx_bytes: number;
  rx_bytes: number;
}
