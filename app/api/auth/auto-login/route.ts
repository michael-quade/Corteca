import { NextResponse } from 'next/server';

export async function POST() {
  const email = process.env.CORTECA_API_LOGIN_UNAME;
  const password = process.env.CORTECA_API_LOGIN_PWD;
  const baseUrl = process.env.CORTECA_API_BASE_URL;
  const clientId = process.env.CORTECA_CLIENT_ID;
  const clientSecret = process.env.CORTECA_CLIENT_SECRET;

  if (!email || !password || !baseUrl || !clientId || !clientSecret) {
    return NextResponse.json(
      { error: 'Auto-login credentials are not configured on the server.' },
      { status: 503 }
    );
  }

  let cortecaRes: Response;
  try {
    cortecaRes = await fetch(`${baseUrl}/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Type': 'KC',
        clientId,
        clientSecret,
      },
      body: JSON.stringify({ email, grant_type: 'password', password }),
    });
  } catch {
    return NextResponse.json(
      { error: 'Could not reach the Corteca API. Check CORTECA_API_BASE_URL.' },
      { status: 502 }
    );
  }

  if (!cortecaRes.ok) {
    const body = await cortecaRes.text();
    let reason = `Authentication failed (${cortecaRes.status})`;
    try {
      const json = JSON.parse(body);
      reason = json.error_description ?? json.message ?? json.error ?? reason;
    } catch { /* use default reason */ }
    return NextResponse.json({ error: reason }, { status: cortecaRes.status >= 500 ? 502 : 401 });
  }

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
    maxAge: 60 * 60 * 24 * 30,
  });
  res.cookies.set('corteca_email', email, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  return res;
}
