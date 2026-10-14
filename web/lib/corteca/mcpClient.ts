// Minimal Streamable-HTTP MCP client for the Corteca AI MCP server.
// Server-side only. Authenticates with the same bearer token as the Corteca APIs.

import { cortecaFetch } from './cortecaFetch';

const PROTOCOL_VERSION = '2025-06-18';

export function mcpUrl(): string | null {
  if (process.env.CORTECA_MCP_URL) return process.env.CORTECA_MCP_URL;
  const base = process.env.CORTECA_API_BASE_URL;
  return base ? `${base}/ai/mcp` : null;
}

export class McpError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id?: number;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
}

// Responses arrive either as plain JSON or as an SSE stream of `data:` lines.
async function readRpcResponse(res: Response, id: number): Promise<JsonRpcResponse> {
  const text = await res.text();
  if (!(res.headers.get('content-type') ?? '').includes('text/event-stream')) {
    return JSON.parse(text) as JsonRpcResponse;
  }
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith('data:')) continue;
    try {
      const msg = JSON.parse(line.slice(5).trim()) as JsonRpcResponse;
      if (msg.id === id) return msg;
    } catch { /* non-JSON keepalive */ }
  }
  throw new McpError('MCP response stream ended without a result', 502);
}

export interface McpToolResult {
  content?: Array<{ type: string; text?: string }>;
  structuredContent?: unknown;
  isError?: boolean;
}

export async function callMcpTool(
  token: string,
  name: string,
  args: Record<string, unknown>,
  timeoutMs = 55_000
): Promise<McpToolResult> {
  const url = mcpUrl();
  if (!url) throw new McpError('MCP not configured', 503);

  let sessionId: string | null = null;
  let nextId = 1;

  async function post(body: Record<string, unknown>): Promise<Response> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': PROTOCOL_VERSION,
    };
    if (sessionId) headers['Mcp-Session-Id'] = sessionId;
    const res = await cortecaFetch(url!, { method: 'POST', headers, body: JSON.stringify(body) }, timeoutMs);
    if (!res.ok && res.status !== 202) {
      const detail = await res.text().catch(() => '');
      throw new McpError(`MCP ${res.status}${detail ? `: ${detail.slice(0, 300)}` : ''}`, res.status);
    }
    return res;
  }

  async function request(method: string, params: Record<string, unknown>) {
    const id = nextId++;
    const res = await post({ jsonrpc: '2.0', id, method, params });
    sessionId ??= res.headers.get('mcp-session-id');
    const msg = await readRpcResponse(res, id);
    if (msg.error) throw new McpError(`MCP ${method} failed: ${msg.error.message}`, 502);
    return msg.result ?? {};
  }

  await request('initialize', {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: 'corteca-dashboard', version: '1.0' },
  });
  await post({ jsonrpc: '2.0', method: 'notifications/initialized' });

  return (await request('tools/call', { name, arguments: args })) as McpToolResult;
}

// Prefer structuredContent; fall back to the first JSON object found in the text content.
export function toolPayload(result: McpToolResult): unknown {
  if (result.structuredContent) return result.structuredContent;
  for (const c of result.content ?? []) {
    if (c.type !== 'text' || !c.text) continue;
    try { return JSON.parse(c.text); } catch { /* summary text */ }
    const start = c.text.indexOf('{');
    if (start >= 0) {
      try { return JSON.parse(c.text.slice(start)); } catch { /* not JSON */ }
    }
  }
  return null;
}
