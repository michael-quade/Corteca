import { NextResponse } from 'next/server';
import { getPortLayouts } from '@/web/lib/corteca/portLayoutStore';

/** Ethernet port layouts per device model, learned from gateways' live ports. */
export async function GET() {
  try {
    return NextResponse.json({ layouts: await getPortLayouts() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to read port layouts' }, { status: 500 });
  }
}
