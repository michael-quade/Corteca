// Microservice: dashboard-bff, subscribers
// Subscriber search and association management

import { cortecaFetch } from './client';
import type {
  Subscriber,
  SubscriberSearchParams,
  CustomerId,
  NetworkId,
  DeviceId,
  MacAddress,
  AssociateSubscriberRequest,
} from './types';

// ─── Search ───────────────────────────────────────────────────────────────

export async function searchSubscribers(
  params: SubscriberSearchParams
): Promise<Subscriber[]> {
  const query = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, String(v)])
  );
  return cortecaFetch(`/dashboard-bff/subscribers?${query}`);
}

export async function getSubscriberCount(
  params: SubscriberSearchParams
): Promise<{ count: number }> {
  const query = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, String(v)])
  );
  return cortecaFetch(`/dashboard-bff/subscribers/count?${query}`);
}

export async function getMacFromSerial(
  serialNumber: string
): Promise<{ network_id: NetworkId; device_id: DeviceId }> {
  return cortecaFetch(`/home-hub/networks?serial_no=${serialNumber}`);
}

// ─── Association ──────────────────────────────────────────────────────────

export async function associateSubscriber(
  data: AssociateSubscriberRequest
): Promise<void> {
  return cortecaFetch('/subscribers', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getSubscriberByNetworkId(
  networkId: NetworkId
): Promise<Subscriber> {
  return cortecaFetch(`/subscribers/network/${networkId}`);
}

export async function getSubscriberById(
  customerId: CustomerId
): Promise<Subscriber> {
  return cortecaFetch(`/subscribers/${customerId}`);
}

export async function updateSubscriber(
  customerId: CustomerId,
  data: Partial<AssociateSubscriberRequest>
): Promise<void> {
  return cortecaFetch(`/subscribers/${customerId}/update`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function addDeviceToSubscriber(
  customerId: CustomerId,
  data: { home_wifi_id: NetworkId }
): Promise<void> {
  return cortecaFetch(`/subscribers/${customerId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteSubscriber(customerId: CustomerId): Promise<void> {
  return cortecaFetch(`/subscribers/${customerId}`, { method: 'DELETE' });
}

export async function deassociateDevice(
  customerId: CustomerId,
  deviceId: DeviceId
): Promise<void> {
  return cortecaFetch(`/subscribers/${customerId}/devices/${deviceId}`, {
    method: 'DELETE',
  });
}

export async function deassociateAllDevices(
  customerId: CustomerId
): Promise<void> {
  return cortecaFetch(`/subscribers/${customerId}/topology`, {
    method: 'DELETE',
  });
}

export async function getDeviceClaimStatus(
  deviceId: DeviceId
): Promise<{ claimed: boolean }> {
  // Can be called without auth token
  const config = { baseUrl: process.env.CORTECA_API_BASE_URL! };
  const res = await fetch(
    `${config.baseUrl}/subscribers/device/${deviceId}/status`
  );
  return res.json();
}

// ─── Pending notifications ────────────────────────────────────────────────

export async function getPendingNotifications(): Promise<
  { event: string; device_id: string; network_id: string; uuid: string }[]
> {
  return cortecaFetch('/subscribers/oss-bss/events');
}

// ─── Keycloak subscriber account management ───────────────────────────────

export interface SubscriberAccountRequest {
  username: string;
  email: string;
  password?: string;
  first_name?: string;
  last_name?: string;
}

export async function createSubscriberAccount(
  data: SubscriberAccountRequest
): Promise<{ uuid: CustomerId }> {
  return cortecaFetch('/auth/credentials', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function resetSubscriberPassword(
  uuid: CustomerId,
  newPassword: string
): Promise<void> {
  return cortecaFetch(`/auth/credentials/${uuid}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ password: newPassword }),
  });
}

export async function updateSubscriberAccount(
  uuid: CustomerId,
  data: Partial<SubscriberAccountRequest>
): Promise<void> {
  return cortecaFetch(`/auth/credentials/${uuid}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteSubscriberAccount(uuid: CustomerId): Promise<void> {
  return cortecaFetch(`/auth/credentials/${uuid}`, { method: 'DELETE' });
}

export async function getSubscriberCredentialsByUuid(
  uuid: CustomerId
): Promise<SubscriberAccountRequest> {
  return cortecaFetch(`/auth/credentials/uuid/${uuid}`);
}
