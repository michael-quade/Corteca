#!/usr/bin/env node
// headersHelper for the Corteca AI MCP server (Claude Code).
// Logs in with the same password grant as /api/auth/login and prints
// {"Authorization": "Bearer <token>"} as JSON on stdout.
// Reads CORTECA_API_BASE_URL, CORTECA_CLIENT_ID, CORTECA_CLIENT_SECRET,
// CORTECA_MCP_USERNAME, CORTECA_MCP_PASSWORD from the environment or ../.env.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const envPath = join(dirname(fileURLToPath(import.meta.url)), '..', '.env');
const fileEnv = {};
try {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) fileEnv[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
} catch {}

const env = (k) => process.env[k] || fileEnv[k];
const required = [
  'CORTECA_API_BASE_URL',
  'CORTECA_CLIENT_ID',
  'CORTECA_CLIENT_SECRET',
  'CORTECA_MCP_USERNAME',
  'CORTECA_MCP_PASSWORD',
];
const missing = required.filter((k) => !env(k));
if (missing.length) {
  console.error(`corteca-mcp-headers: missing ${missing.join(', ')}`);
  process.exit(1);
}

const res = await fetch(`${env('CORTECA_API_BASE_URL')}/auth/token`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Service-Type': 'KC',
    clientId: env('CORTECA_CLIENT_ID'),
    clientSecret: env('CORTECA_CLIENT_SECRET'),
  },
  body: JSON.stringify({
    email: env('CORTECA_MCP_USERNAME'),
    grant_type: 'password',
    password: env('CORTECA_MCP_PASSWORD'),
  }),
});

if (!res.ok) {
  console.error(`corteca-mcp-headers: token request failed (${res.status}): ${await res.text()}`);
  process.exit(1);
}

const { access_token } = await res.json();
process.stdout.write(JSON.stringify({ Authorization: `Bearer ${access_token}` }));
