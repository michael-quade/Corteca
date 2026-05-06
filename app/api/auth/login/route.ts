import { NextRequest, NextResponse } from 'next/server';
import { resetApiStats } from '@/web/lib/corteca/apiStats';

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  const baseUrl = process.env.CORTECA_API_BASE_URL;
  const clientId = process.env.CORTECA_CLIENT_ID;
  const clientSecret = process.env.CORTECA_CLIENT_SECRET;

  if (!baseUrl || !clientId || !clientSecret) {
    return NextResponse.json(
      { error: 'Corteca API is not configured. Check server environment variables.' },
      { status: 503 }
    );
  }

  const requestUrl = `${baseUrl}/auth/token`;
  const requestHeaders = {
    'Content-Type': 'application/json',
    'X-Service-Type': 'KC',
    clientId,
    clientSecret,
  };
  const requestBody = { email, grant_type: 'password', password };

  console.log('[corteca auth] POST', requestUrl);
  console.log('[corteca auth] headers:', JSON.stringify(requestHeaders, null, 2));
  console.log('[corteca auth] body:', JSON.stringify(requestBody, null, 2));

  let cortecaRes: Response;
  try {
    cortecaRes = await fetch(requestUrl, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(requestBody),
    });
  } catch {
    return NextResponse.json(
      { error: 'Could not reach the Corteca API. Check CORTECA_API_BASE_URL.' },
      { status: 502 }
    );
  }

  if (!cortecaRes.ok) {
    const body = await cortecaRes.text();

    if (cortecaRes.status === 401) {
      let reason = 'Invalid credentials.';
      try {
        const json = JSON.parse(body);
        reason = json.error_description ?? json.message ?? json.error ?? body;
      } catch {
        if (body) reason = body;
      }
      console.error('[corteca auth] 401:', reason);
      return NextResponse.json({ error: reason }, { status: 401 });
    }

    console.error('[corteca auth] unexpected error:', cortecaRes.status, body);
    return NextResponse.json(
      { error: `Corteca error (${cortecaRes.status}): ${body}` },
      { status: 502 }
    );
  }

  resetApiStats();
  const { access_token, refresh_token, expires_in } = await cortecaRes.json();

  const res = NextResponse.json({ email });

  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  };

  res.cookies.set('corteca_token', access_token, {
    ...cookieOpts,
    maxAge: expires_in ?? 900,
  });
  res.cookies.set('corteca_refresh_token', refresh_token, {
    ...cookieOpts,
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  res.cookies.set('corteca_email', email, {
    httpOnly: false, // readable by client for display
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  return res;
}
