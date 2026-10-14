import { NextRequest, NextResponse } from 'next/server';
import { callMcpTool, toolPayload, McpError } from '@/web/lib/corteca/mcpClient';

// retrieve-network-data runs an AI sub-agent server-side, so calls can take a while.
export const maxDuration = 60;

const QUERY = 'both mesh topology / access points and connected clients';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ homeWifiId: string }> }
) {
  const token = req.cookies.get('corteca_token')?.value;
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { homeWifiId } = await params;
  // MCP expects the root node MAC uppercase hyphen-separated.
  const id = decodeURIComponent(homeWifiId).toUpperCase().replace(/:/g, '-');
  const query = req.nextUrl.searchParams.get('query')?.trim() || QUERY;

  const started = Date.now();
  try {
    const result = await callMcpTool(token, 'retrieve-network-data', {
      homeWifiId: id,
      query,
      structuredContent: true,
    });
    if (result.isError) {
      const msg = result.content?.find((c) => c.type === 'text')?.text ?? 'MCP tool returned an error';
      return NextResponse.json({ error: msg }, { status: 502 });
    }
    const summary = result.content?.find((c) => c.type === 'text')?.text ?? null;
    return NextResponse.json({
      homeWifiId: id,
      query,
      durationMs: Date.now() - started,
      summary,
      payload: toolPayload(result),
    });
  } catch (e) {
    const status = e instanceof McpError ? e.status : 502;
    const message = e instanceof Error ? e.message : String(e);
    console.error('[mcp network] error:', message);
    return NextResponse.json({ error: message }, { status });
  }
}
