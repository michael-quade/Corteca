import { NextRequest, NextResponse } from 'next/server';
import { streamJson } from '@/web/lib/corteca/streamJson';
import { callMcpTool, toolPayload, McpError } from '@/web/lib/corteca/mcpClient';

// Runs the MCP troubleshoot-network tool for a plain-language problem. It returns
// { summary, problems[], rootCauses[], recommendedActions[] }; it diagnoses only.
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
  const query = req.nextUrl.searchParams.get('query')?.trim().slice(0, 2000);
  if (!query) return NextResponse.json({ error: 'Describe the problem to troubleshoot' }, { status: 400 });

  const started = Date.now();
  // Streams heartbeats while the tool runs, so proxies don't drop the request.
  return streamJson(async () => {
    try {
      const result = await callMcpTool(token, 'troubleshoot-network', { homeWifiId: id, query, structuredContent: true }, 290_000);
      const summary = result.content?.find((c) => c.type === 'text')?.text ?? null;
      if (result.isError) return { error: summary ?? 'MCP troubleshooting failed' };
      return { homeWifiId: id, query, durationMs: Date.now() - started, summary, diagnosis: toolPayload(result) };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error('[mcp troubleshoot] error:', message);
      return { error: e instanceof McpError && e.status === 401 ? 'Session expired — sign in again and rerun.' : message };
    }
  });
}
