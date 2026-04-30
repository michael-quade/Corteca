import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const token = req.cookies.get('corteca_token')?.value;
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const baseUrl = process.env.CORTECA_API_BASE_URL;
  if (!baseUrl) {
    return NextResponse.json({ error: 'API not configured' }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const name = searchParams.get('name');
  if (!name?.trim()) {
    return NextResponse.json({ error: 'name query param is required' }, { status: 400 });
  }

  const params = new URLSearchParams({ name: name.trim(), size: '20' });
  const url = `${baseUrl}/dashboard-bff/subscribers?${params}`;

  console.log('[corteca subscribers] GET', url);

  let cortecaRes: Response;
  try {
    cortecaRes = await fetch(url, {
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
    console.error('[corteca subscribers] error:', cortecaRes.status, body);
    return NextResponse.json(
      { error: `Corteca error (${cortecaRes.status}): ${body}` },
      { status: cortecaRes.status }
    );
  }

  return NextResponse.json(await cortecaRes.json());
}
