import { NextRequest, NextResponse } from 'next/server';
import { cortecaFetch } from '@/web/lib/corteca/cortecaFetch';

export async function GET(
  req: NextRequest,
  { params }: { params: { networkId: string } }
) {
  const token = req.cookies.get('corteca_token')?.value;
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const baseUrl = process.env.CORTECA_API_BASE_URL;
  if (!baseUrl) {
    return NextResponse.json({ error: 'API not configured' }, { status: 503 });
  }

  const { networkId } = params;
  const url = `${baseUrl}/home-hub/networks/${networkId}/members`;

  console.log('[corteca members] GET', url);

  let cortecaRes: Response;
  try {
    cortecaRes = await cortecaFetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Could not reach the Corteca API.' },
      { status: 502 }
    );
  }

  if (!cortecaRes.ok) {
    const body = await cortecaRes.text();
    console.error('[corteca members] error:', cortecaRes.status, body);
    return NextResponse.json(
      { error: `Corteca error (${cortecaRes.status}): ${body}` },
      { status: cortecaRes.status }
    );
  }

  return NextResponse.json(await cortecaRes.json());
}
