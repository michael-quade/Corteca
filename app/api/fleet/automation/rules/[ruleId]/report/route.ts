import { NextRequest, NextResponse } from "next/server";
import { cortecaGet } from "@/web/lib/fleet/cortecaRead";
import { parseRuleReport } from "@/web/lib/fleet/automation";

/** One proactive rule's per-device run list (`/proactive-engine/rules/{id}/reports` CSV), newest first. Read-only. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ ruleId: string }> }) {
  const token = req.cookies.get("corteca_token")?.value;
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const base = process.env.CORTECA_API_BASE_URL;
  if (!base) return NextResponse.json({ error: "API not configured" }, { status: 503 });
  const { ruleId } = await params;
  if (!/^[\w-]{6,64}$/.test(ruleId)) return NextResponse.json({ error: "Bad rule id" }, { status: 400 });
  try {
    const rows = parseRuleReport(await cortecaGet(base, token, `/proactive-engine/rules/${ruleId}/reports`, { csv: true }));
    return NextResponse.json({ rows: rows.slice(0, 500), total: rows.length });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
