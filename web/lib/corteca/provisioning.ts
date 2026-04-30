// Microservice: device-provisioning
// Device provisioning, de-provisioning, and tenant management

import { cortecaFetch } from './client';
import type { DeviceId, ProvisionDeviceRequest } from './types';

export async function getProvisionedDeviceCount(): Promise<{ count: number }> {
  return cortecaFetch('/device-provisioning/devices');
}

export async function provisionDevice(
  data: ProvisionDeviceRequest
): Promise<void> {
  return cortecaFetch(
    `/device-provisioning/devices/${data.mac}/credential`,
    { method: 'PUT', body: JSON.stringify(data) }
  );
}

export async function deleteProvisionedDevice(
  deviceId: DeviceId
): Promise<void> {
  return cortecaFetch(
    `/device-provisioning/provisioning/credentials/${deviceId}`,
    { method: 'DELETE' }
  );
}

export async function validateProvisioningStatus(
  mac: string,
  password: string
): Promise<{ provisioned: boolean }> {
  const credentials = Buffer.from(`${mac}:${password}`).toString('base64');
  return cortecaFetch('/device-provisioning/provisioning/validate', {
    method: 'POST',
    headers: { Authorization: `Basic ${credentials}` },
  });
}

export async function changeDeviceTenant(
  deviceId: DeviceId,
  sourceTenant: string,
  targetTenantId: string
): Promise<void> {
  return cortecaFetch(`/device-provisioning/devices/${deviceId}/tenant`, {
    method: 'PUT',
    headers: { 'X-REALM_ID': sourceTenant },
    body: JSON.stringify({ tenant_id: targetTenantId }),
  });
}

export async function downloadUnauthenticatedDevices(): Promise<string> {
  // Returns CSV text
  const config = { baseUrl: process.env.CORTECA_API_BASE_URL! };
  const { getAccessToken } = await import('./client');
  const token = await getAccessToken();

  const res = await fetch(`${config.baseUrl}/device-provisioning/reports`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'text/csv' },
  });

  return res.text();
}
