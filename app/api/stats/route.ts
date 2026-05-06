import { NextResponse } from 'next/server';
import { getApiStats } from '@/web/lib/corteca/apiStats';

export async function GET() {
  return NextResponse.json(getApiStats());
}
