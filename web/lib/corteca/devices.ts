// Microservices: device-management, device-hub, device-catalogue, station-profiles
// Network device status, configuration, and management

import { cortecaFetch } from './client';
import type {
  DeviceId,
  NetworkId,
  MemberId,
  DeviceStatus,
  DeviceLiveStatus,
  Member,
  MemberProfile,
  DeviceType,
  WiFiRadio,
} from './types';

// ─── Device Status ────────────────────────────────────────────────────────

export async function getDeviceStatus(deviceId: DeviceId): Promise<DeviceStatus> {
  return cortecaFetch(`/device-management/devices/${deviceId}/status`);
}

export async function getDeviceLiveStatus(
  deviceId: DeviceId
): Promise<DeviceLiveStatus> {
  return cortecaFetch(`/device-hub/devices/${deviceId}/system/status`);
}

export async function getDeviceSystemInfo(
  deviceId: DeviceId
): Promise<{ serial_number?: string; memory?: object; cpu_usage?: number }> {
  return cortecaFetch(`/device-hub/devices/${deviceId}/system/info`);
}

export async function getDeviceSoftwareFeatures(
  deviceId: DeviceId
): Promise<{ speedtest_modes: string[]; misc_features: string[] }> {
  return cortecaFetch(
    `/device-catalogue/software-features?device_id=${deviceId}`
  );
}

export async function getDeviceNetworks(
  deviceId: DeviceId
): Promise<{ service_type?: string; type?: string; ip_address?: string }[]> {
  return cortecaFetch(`/device-hub/devices/${deviceId}/networks`);
}

export async function getOnlineDeviceCountByModel(): Promise<
  { model: string; online: number; offline: number }[]
> {
  return cortecaFetch('/device-management/stats');
}

// ─── Connected Members ────────────────────────────────────────────────────

export async function getNetworkMembers(
  networkId: NetworkId
): Promise<Member[]> {
  return cortecaFetch(`/home-hub/networks/${networkId}/members`);
}

export async function getMember(
  networkId: NetworkId,
  memberId: MemberId
): Promise<Member> {
  return cortecaFetch(`/home-hub/networks/${networkId}/members/${memberId}`);
}

export async function patchMember(
  networkId: NetworkId,
  memberId: MemberId,
  data: { paused?: boolean }
): Promise<void> {
  return cortecaFetch(`/home-hub/networks/${networkId}/members/${memberId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function pauseMemberInternet(
  networkId: NetworkId,
  memberId: MemberId
): Promise<void> {
  return patchMember(networkId, memberId, { paused: true });
}

export async function resumeMemberInternet(
  networkId: NetworkId,
  memberId: MemberId
): Promise<void> {
  return patchMember(networkId, memberId, { paused: false });
}

export async function deleteOfflineMember(
  networkId: NetworkId,
  memberId: MemberId
): Promise<void> {
  return cortecaFetch(
    `/home-hub/networks/${networkId}/stations/${memberId}`,
    { method: 'DELETE' }
  );
}

// ─── Member Profiles (fingerprinting) ────────────────────────────────────

export async function getMemberProfiles(
  networkId: NetworkId
): Promise<MemberProfile[]> {
  return cortecaFetch(
    `/station-profiles/networks/${networkId}/member-profiles`
  );
}

export async function getMemberProfile(
  networkId: NetworkId,
  memberId: MemberId
): Promise<MemberProfile> {
  return cortecaFetch(
    `/station-profiles/networks/${networkId}/member-profiles/${memberId}`
  );
}

export async function updateMemberProfile(
  networkId: NetworkId,
  memberId: MemberId,
  data: { name?: string; type?: DeviceType }
): Promise<void> {
  return cortecaFetch(
    `/station-profiles/networks/${networkId}/member-profiles/${memberId}`,
    { method: 'PUT', body: JSON.stringify(data) }
  );
}

export async function getDeviceTypeScores(): Promise<
  { type: string; connectivity: number; stability: number; coverage: number }[]
> {
  return cortecaFetch('/station-profiles/types');
}

// ─── Devices connected to a network device ────────────────────────────────

export async function getStationsOnDevice(
  deviceId: DeviceId
): Promise<{ mac: string; rssi?: number; tx_rate?: number }[]> {
  return cortecaFetch(`/device-hub/devices/${deviceId}/wifi/stations`);
}

export async function getFailedStations(
  deviceId: DeviceId
): Promise<{ mac: string; reason: string; attempted_at: string }[]> {
  return cortecaFetch(`/device-hub/devices/${deviceId}/wifi/failed-stations`);
}

// ─── SSID ─────────────────────────────────────────────────────────────────

export interface Vap {
  id: string;
  ssid: string;
  enabled: boolean;
  hidden: boolean;
  band: string;
  encryption?: string;
  channel?: number;
}

export async function getDeviceVaps(deviceId: DeviceId): Promise<Vap[]> {
  return cortecaFetch(`/device-hub/devices/${deviceId}/wifi/vaps`);
}

export async function patchDeviceVaps(
  deviceId: DeviceId,
  data: Partial<Vap>
): Promise<void> {
  return cortecaFetch(`/device-hub/devices/${deviceId}/wifi/vaps`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function patchNetworkVaps(
  networkId: NetworkId,
  data: { ssid?: string; password?: string }
): Promise<void> {
  return cortecaFetch(`/home-hub/networks/${networkId}/wifi/vaps`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function resetVapPassword(
  deviceId: DeviceId,
  vapId: string
): Promise<void> {
  return cortecaFetch(
    `/device-hub/devices/${deviceId}/wifi/vaps/${vapId}/reset-password`,
    { method: 'POST' }
  );
}

export async function getVapAssocList(
  deviceId: DeviceId,
  vapId: string
): Promise<{ mac: string; rssi: number; tx_rate: number; rx_bytes: number }[]> {
  return cortecaFetch(
    `/device-hub/devices/${deviceId}/wifi/vaps/${vapId}/assoclist`
  );
}

export async function getVapStats(deviceId: DeviceId): Promise<object> {
  return cortecaFetch(`/device-hub/devices/${deviceId}/wifi/vaps/stats`);
}

// ─── WLAN Configuration ───────────────────────────────────────────────────

export async function restartWifiRadio(
  deviceId: DeviceId,
  radioId: string
): Promise<void> {
  return cortecaFetch(
    `/device-hub/devices/${deviceId}/wifi/radios/${radioId}/reset`,
    { method: 'POST' }
  );
}

// ─── WiFi Radios ──────────────────────────────────────────────────────────

export async function getWifiRadios(deviceId: DeviceId): Promise<WiFiRadio[]> {
  return cortecaFetch(`/device-hub/devices/${deviceId}/wifi/radios`);
}

export async function updateWifiRadio(
  deviceId: DeviceId,
  radioId: string,
  data: { auto?: boolean; channel?: number; htmode?: string }
): Promise<void> {
  return cortecaFetch(
    `/device-hub/devices/${deviceId}/wifi/radios/${radioId}`,
    { method: 'PUT', body: JSON.stringify(data) }
  );
}

export async function getChannelInfo(
  deviceId: DeviceId
): Promise<{ bands: string[]; channels: number[]; widths: string[] }[]> {
  return cortecaFetch(`/device-hub/devices/${deviceId}/wifi/channels`);
}

export async function getChannelUtilization(
  deviceId: DeviceId,
  radioId: string
): Promise<{ channel: number; utilization: number }[]> {
  return cortecaFetch(
    `/device-hub/devices/${deviceId}/wifi/radios/${radioId}/channel-utilization`
  );
}

export async function getInterferenceData(
  deviceId: DeviceId
): Promise<object> {
  return cortecaFetch(`/device-hub/devices/${deviceId}/wifi/interference`);
}

// ─── Reboot / Factory Reset ───────────────────────────────────────────────

export async function rebootDevice(deviceId: DeviceId): Promise<void> {
  return cortecaFetch(`/device-hub/devices/${deviceId}/system/reboot`, {
    method: 'POST',
  });
}

export async function factoryResetDevice(deviceId: DeviceId): Promise<void> {
  return cortecaFetch(`/device-hub/devices/${deviceId}/system/factory`, {
    method: 'POST',
  });
}

// ─── Support ──────────────────────────────────────────────────────────────

export async function resetAdminPassword(deviceId: DeviceId): Promise<void> {
  return cortecaFetch(
    `/device-hub/devices/${deviceId}/router/ui/reset-password`,
    { method: 'POST' }
  );
}

export async function getSsidPasswordPolicy(
  deviceId: DeviceId
): Promise<{ rules: { regexp_reverse: string; error: string }[] }> {
  return cortecaFetch(`/device-hub/password-policy?device_id=${deviceId}`);
}

// ─── WAN ─────────────────────────────────────────────────────────────────

export interface WanInterface {
  name: string;
  type: string;
  ip_address?: string;
  gateway?: string;
  dns?: string[];
  enabled: boolean;
}

export async function getDeviceWan(deviceId: DeviceId): Promise<WanInterface[]> {
  return cortecaFetch(`/device-hub/devices/${deviceId}/networks`);
}

export async function getWanCounters(
  deviceId: DeviceId
): Promise<{ tx_bytes: number; rx_bytes: number; download_rate: number; upload_rate: number }> {
  return cortecaFetch(`/device-hub/devices/${deviceId}/wan/counters`);
}

// ─── Live device traffic ──────────────────────────────────────────────────

export async function getLiveDeviceTraffic(
  deviceId: DeviceId
): Promise<{ mac: string; tx_bytes: number; rx_bytes: number }[]> {
  return cortecaFetch(`/device-hub/devices/${deviceId}/stations/usage`);
}

// ─── Offline data model access ────────────────────────────────────────────

export async function getOfflineDeviceData(
  deviceId: DeviceId
): Promise<Record<string, unknown>> {
  return cortecaFetch(`/device-management/devices/${deviceId}/config`);
}
