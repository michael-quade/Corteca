import { NextRequest, NextResponse } from 'next/server';
import { streamJson } from '@/web/lib/corteca/streamJson';
import { callMcpTool, McpError } from '@/web/lib/corteca/mcpClient';

// Runs the MCP analyze-network tool (all network-analyzer specialists). It returns
// a Markdown report: overall state, current findings, recent history, devices.
// Measured 35 s – 2.5 min, so these need more than the usual 60 s (Vercel Fluid compute allows 300 s).
export const maxDuration = 300;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ homeWifiId: string }> }
) {
  const token = req.cookies.get('corteca_token')?.value;
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { homeWifiId } = await params;
  const id = decodeURIComponent(homeWifiId).toUpperCase().replace(/:/g, '-');
  const message = req.nextUrl.searchParams.get('message')?.trim().slice(0, 2000);

  const started = Date.now();
  // Streams heartbeats while the tool runs, so proxies don't drop the request.
  return streamJson(async () => {
    try {
      const result = await callMcpTool(token, 'analyze-network', { homeWifiId: id, ...(message ? { message } : {}) }, 290_000);
      const text = result.content?.filter((c) => c.type === 'text' && c.text).map((c) => c.text).join('\n\n') ?? '';
      if (result.isError || !text) return { error: text || 'MCP analysis returned no report' };
      return { homeWifiId: id, durationMs: Date.now() - started, report: text };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error('[mcp analyze] error:', message);
      return { error: e instanceof McpError && e.status === 401 ? 'Session expired — sign in again and rerun.' : message };
    }
  });
}
