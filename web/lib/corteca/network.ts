// Microservices: home-hub, measures, activity-log, stats
// Topology, diagnostics, history, statistics, slicing

import { cortecaFetch } from './client';
import type {
  NetworkId,
  DeviceId,
  MemberId,
  MeshTopology,
  DiagnosticsRequest,
  DiagnosticsResult,
  NetworkSlice,
  StatsQuery,
  WanRatePoint,
  WanUsagePoint,
} from './types';

// ─── Mesh / Topology ──────────────────────────────────────────────────────

export async function getMeshTopology(networkId: NetworkId): Promise<MeshTopology> {
  return cortecaFetch(`/home-hub/networks/${networkId}/mesh`);
}

export async function onboardExtender(
  deviceId: DeviceId,
  serialNumber: string
): Promise<void> {
  return cortecaFetch(`/device-hub/devices/${deviceId}/mesh/onboard`, {
    method: 'POST',
    body: JSON.stringify({ serial_number: serialNumber }),
  });
}

export async function offboardExtender(
  deviceId: DeviceId,
  serialNumber: string
): Promise<void> {
  return cortecaFetch(`/device-hub/devices/${deviceId}/mesh/offboard`, {
    method: 'POST',
    body: JSON.stringify({ serial_number: serialNumber }),
  });
}

export async function getTrustedExtenders(
  deviceId: DeviceId
): Promise<{ serial_number: string }[]> {
  return cortecaFetch(`/device-hub/devices/${deviceId}/mesh/onboard`);
}

export async function removeOfflineExtender(
  deviceId: DeviceId,
  extenderId: DeviceId
): Promise<void> {
  return cortecaFetch(
    `/device-hub/devices/${deviceId}/wifi/extender/${extenderId}`,
    { method: 'DELETE' }
  );
}

export async function getModemGatewayAssociation(
  networkId: NetworkId
): Promise<object> {
  return cortecaFetch(`/home-hub/networks/${networkId}/gateway`);
}

export async function deleteDeviceFromTopology(
  networkId: NetworkId,
  deviceId: DeviceId,
  options?: { checkStatus?: boolean; factoryReset?: boolean }
): Promise<void> {
  const params = new URLSearchParams();
  if (options?.checkStatus) params.set('check_status', 'true');
  if (options?.factoryReset) params.set('factory_reset', 'true');
  return cortecaFetch(
    `/home-hub/networks/${networkId}/topology/${deviceId}?${params}`,
    { method: 'DELETE' }
  );
}

export async function deleteTopology(
  networkId: NetworkId,
  options?: { factoryReset?: boolean }
): Promise<void> {
  const params = options?.factoryReset ? '?factory_reset=true' : '';
  return cortecaFetch(`/home-hub/networks/${networkId}/topology${params}`, {
    method: 'DELETE',
  });
}

// ─── Diagnostics / Speed Test ─────────────────────────────────────────────

export async function startDiagnostic(
  networkId: NetworkId,
  request: DiagnosticsRequest
): Promise<{ diagnostic_id: string }> {
  return cortecaFetch(`/measures/networks/${networkId}/diagnostics`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function getDiagnosticResult(
  networkId: NetworkId,
  diagnosticId: string
): Promise<DiagnosticsResult> {
  return cortecaFetch(
    `/measures/networks/${networkId}/diagnostics/${diagnosticId}`
  );
}

export async function getDiagnosticsHistory(
  networkId: NetworkId,
  filter?: 'internet_quality' | 'latency_quality' | string
): Promise<DiagnosticsResult[]> {
  const params = filter ? `?filter=${filter}` : '';
  return cortecaFetch(`/measures/networks/${networkId}/diagnostics${params}`);
}

export async function runSpeedTest(
  networkId: NetworkId,
  model?: 'ookla' | 'mlab' | 'tr143'
): Promise<{ diagnostic_id: string }> {
  return startDiagnostic(networkId, {
    internet_quality: true,
    speedtest_model: model,
  });
}

export async function runPingTest(
  networkId: NetworkId
): Promise<{ diagnostic_id: string }> {
  return startDiagnostic(networkId, { latency_quality: true });
}

export async function getNeighborScan(
  networkId: NetworkId,
  deviceId: DeviceId
): Promise<object> {
  return cortecaFetch(
    `/measures/networks/${networkId}/devices/${deviceId}/scan`
  );
}

// ─── RSSI & Steering History ──────────────────────────────────────────────

export interface RssiEvent {
  operation: 'ASSOCIATION' | 'DISASSOCIATION' | 'RSSI_THRESHOLD_CHANGE';
  device_id: DeviceId;
  channel: number;
  rssi?: number;
  timestamp: string;
  links?: { band: string; rssi: number }[];
}

export async function getRssiHistory(
  networkId: NetworkId,
  memberId: MemberId,
  from: string,
  to: string
): Promise<RssiEvent[]> {
  return cortecaFetch(
    `/dashboard-bff/networks/${networkId}/members/${memberId}/rssi?from=${from}&to=${to}`
  );
}

// ─── Activity Log / Network History ──────────────────────────────────────

export interface ActivityQuery {
  device_id?: DeviceId;
  origin?: 'USER' | 'AGENT' | 'DEVICE' | 'MESHNETWORK';
  operation?: string;
  from?: string;
  to?: string;
  page?: number;
  size?: number;
}

export type ActivityOrigin = 'USER' | 'AGENT' | 'DEVICE' | 'MESHNETWORK';

export interface ActivityEvent {
  id?: string;
  operation: string;
  origin?: ActivityOrigin;
  device_id?: DeviceId;
  timestamp?: string;
  created_at?: string;
  details?: object;
  metadata?: Record<string, unknown>;
}

export async function getNetworkActivity(
  networkId: NetworkId,
  query?: ActivityQuery
): Promise<ActivityEvent[]> {
  const params = new URLSearchParams(
    Object.entries(query ?? {})
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, String(v)])
  );
  return cortecaFetch(
    `/activity-log/networks/${networkId}/activity?${params}`
  );
}

export async function logSessionEvent(
  networkId: NetworkId,
  operation: 'session_start' | 'session_stop'
): Promise<void> {
  return cortecaFetch(`/activity-log/networks/${networkId}/activity`, {
    method: 'POST',
    body: JSON.stringify({ operation }),
  });
}

export async function initiateLogFetch(
  networkId: NetworkId
): Promise<{ operation_id: string }> {
  return cortecaFetch(`/activity-log/networks/${networkId}/logs`, {
    method: 'POST',
  });
}

export async function getLogFetchStatus(
  networkId: NetworkId
): Promise<{ status: string; url?: string }> {
  return cortecaFetch(`/activity-log/networks/${networkId}/logs/status`);
}

// ─── Historical Statistics ────────────────────────────────────────────────

export async function getWanRates(
  networkId: NetworkId,
  query: StatsQuery
): Promise<WanRatePoint[]> {
  const params = new URLSearchParams(
    Object.entries(query)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, String(v)])
  );
  return cortecaFetch(`/stats/networks/${networkId}/wan/rates?${params}`);
}

export async function getWanUsage(
  networkId: NetworkId,
  query: StatsQuery
): Promise<WanUsagePoint[]> {
  const params = new URLSearchParams(
    Object.entries(query)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, String(v)])
  );
  return cortecaFetch(`/stats/networks/${networkId}/wan/usage?${params}`);
}

export async function getDeviceUsageHistory(
  networkId: NetworkId,
  query: StatsQuery
): Promise<{ mac: string; tx_bytes: number; rx_bytes: number }[]> {
  const params = new URLSearchParams(
    Object.entries(query)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, String(v)])
  );
  return cortecaFetch(`/stats/networks/${networkId}/stations/usage?${params}`);
}

// ─── Problem Finder (Recommendations) ────────────────────────────────────

export interface Recommendation {
  id: string;
  type: string;
  severity: string;
  description: string;
  device_id?: DeviceId;
  member_id?: MemberId;
  created_at: string;
}

export async function getActiveRecommendations(
  networkId: NetworkId
): Promise<Recommendation[]> {
  return cortecaFetch(`/measures/networks/${networkId}/recommendations`);
}

export async function getRecommendationsHistory(
  networkId: NetworkId,
  from?: string,
  to?: string
): Promise<Recommendation[]> {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  return cortecaFetch(
    `/measures/networks/${networkId}/recommendations/history?${params}`
  );
}

// ─── Network Slicing ──────────────────────────────────────────────────────

export async function createSlice(
  networkId: NetworkId,
  data: { name: string; vlan_id?: number; ssids?: string[] }
): Promise<NetworkSlice> {
  return cortecaFetch(`/home-hub/networks/${networkId}/slice`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getSlices(networkId: NetworkId): Promise<NetworkSlice[]> {
  return cortecaFetch(`/home-hub/networks/${networkId}/slice`);
}

export async function updateSlice(
  networkId: NetworkId,
  sliceId: string,
  data: Partial<NetworkSlice>
): Promise<void> {
  return cortecaFetch(`/home-hub/networks/${networkId}/slice/${sliceId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteSlice(
  networkId: NetworkId,
  sliceId: string
): Promise<void> {
  return cortecaFetch(`/home-hub/networks/${networkId}/slice/${sliceId}`, {
    method: 'DELETE',
  });
}

export async function getSliceHealth(
  networkId: NetworkId,
  sliceId: string
): Promise<{ status: string }> {
  return cortecaFetch(
    `/home-hub/networks/${networkId}/slice/${sliceId}/status`
  );
}

export async function getSliceLatency(
  networkId: NetworkId,
  sliceId: string
): Promise<{ average_latency_ms: number }> {
  return cortecaFetch(
    `/home-hub/networks/${networkId}/slice/${sliceId}/latency`
  );
}

// ─── Parental Controls ────────────────────────────────────────────────────

export interface ParentalGroup {
  group_id: string;
  name: string;
  members: MemberId[];
}

export interface ParentalRule {
  rule_id: string;
  name: string;
  enabled: boolean;
  start_time: string;
  end_time: string;
  days_of_week: number[];
  is_bedtime?: boolean;
}

export async function getParentalGroups(
  networkId: NetworkId
): Promise<ParentalGroup[]> {
  return cortecaFetch(`/station-profiles/networks/${networkId}/groups`);
}

export async function createParentalGroup(
  networkId: NetworkId,
  name: string
): Promise<ParentalGroup> {
  return cortecaFetch(`/station-profiles/networks/${networkId}/groups`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export async function updateParentalGroup(
  networkId: NetworkId,
  groupId: string,
  data: { name: string }
): Promise<void> {
  return cortecaFetch(
    `/station-profiles/networks/${networkId}/groups/${groupId}`,
    { method: 'PUT', body: JSON.stringify(data) }
  );
}

export async function deleteParentalGroup(
  networkId: NetworkId,
  groupId: string
): Promise<void> {
  return cortecaFetch(
    `/station-profiles/networks/${networkId}/groups/${groupId}`,
    { method: 'DELETE' }
  );
}

export async function addMemberToGroup(
  networkId: NetworkId,
  groupId: string,
  memberId: MemberId
): Promise<void> {
  return cortecaFetch(
    `/station-profiles/networks/${networkId}/groups/${groupId}/members`,
    { method: 'POST', body: JSON.stringify({ member_id: memberId }) }
  );
}

export async function removeMemberFromGroup(
  networkId: NetworkId,
  groupId: string,
  memberId: MemberId
): Promise<void> {
  return cortecaFetch(
    `/station-profiles/networks/${networkId}/groups/${groupId}/members/${memberId}`,
    { method: 'DELETE' }
  );
}

export async function createGroupRule(
  networkId: NetworkId,
  groupId: string,
  rule: Omit<ParentalRule, 'rule_id'>
): Promise<ParentalRule> {
  return cortecaFetch(
    `/station-profiles/networks/${networkId}/groups/${groupId}/rules`,
    { method: 'POST', body: JSON.stringify(rule) }
  );
}

export async function deleteGroupRule(
  networkId: NetworkId,
  groupId: string,
  ruleId: string
): Promise<void> {
  return cortecaFetch(
    `/station-profiles/networks/${networkId}/groups/${groupId}/rules/${ruleId}`,
    { method: 'DELETE' }
  );
}
