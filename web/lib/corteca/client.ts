import type { CortecaConfig, TokenResponse } from './types';

interface TokenStore {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

let tokenStore: TokenStore | null = null;

function getConfig(): CortecaConfig {
  const baseUrl = process.env.CORTECA_API_BASE_URL;
  const clientId = process.env.CORTECA_CLIENT_ID;
  const clientSecret = process.env.CORTECA_CLIENT_SECRET;

  if (!baseUrl || !clientId || !clientSecret) {
    throw new Error('Missing CORTECA_API_BASE_URL, CORTECA_CLIENT_ID, or CORTECA_CLIENT_SECRET env vars');
  }

  return { baseUrl, clientId, clientSecret };
}

async function fetchToken(username: string, password: string): Promise<TokenStore> {
  const config = getConfig();

  const res = await fetch(`${config.baseUrl}/auth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Service-Type': 'KC',
      clientId: config.clientId,
      clientSecret: config.clientSecret,
    },
    body: JSON.stringify({ email: username, grant_type: 'password', password }),
  });

  if (!res.ok) {
    throw new Error(`Auth failed: ${res.status} ${await res.text()}`);
  }

  const data: TokenResponse = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000 - 30_000, // 30s buffer
  };
}

async function refreshToken(): Promise<TokenStore> {
  if (!tokenStore) throw new Error('No token to refresh');

  const config = getConfig();

  const res = await fetch(`${config.baseUrl}/auth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Service-Type': 'KC',
      clientId: config.clientId,
      clientSecret: config.clientSecret,
    },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: tokenStore.refreshToken,
    }),
  });

  if (!res.ok) {
    tokenStore = null;
    throw new Error(`Token refresh failed: ${res.status}`);
  }

  const data: TokenResponse = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000 - 30_000,
  };
}

export async function login(username: string, password: string): Promise<void> {
  tokenStore = await fetchToken(username, password);
}

export async function getAccessToken(): Promise<string> {
  if (!tokenStore) throw new Error('Not authenticated. Call login() first.');

  if (Date.now() >= tokenStore.expiresAt) {
    tokenStore = await refreshToken();
  }

  return tokenStore.accessToken;
}

export async function cortecaFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const config = getConfig();
  const token = await getAccessToken();

  const res = await fetch(`${config.baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Corteca API error ${res.status} for ${path}: ${body}`);
  }

  // Some endpoints return 204 No Content
  const contentType = res.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    return undefined as unknown as T;
  }

  return res.json() as Promise<T>;
}
