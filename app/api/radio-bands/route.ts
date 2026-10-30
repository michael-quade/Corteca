import { NextResponse } from 'next/server';
import { getModelBands } from '@/web/lib/corteca/radioBandStore';

/** WiFi radio bands per device model, learned from online APs. */
export async function GET() {
  try {
    return NextResponse.json({ models: await getModelBands() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to read radio bands' }, { status: 500 });
  }
}
