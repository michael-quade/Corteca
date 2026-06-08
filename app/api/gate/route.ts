import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { username, password } = await req.json() as { username: string; password: string };

  const validUser = process.env.SITE_USERNAME;
  const validPass = process.env.SITE_PASSWORD;

  if (!validUser || !validPass || username !== validUser || password !== validPass) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const token = Buffer.from(`${username}:${password}`).toString('base64');
  const res   = NextResponse.json({ ok: true });
  res.cookies.set('site_auth', token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path:     '/',
    maxAge:   60 * 60 * 24 * 30, // 30 days
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set('site_auth', '', { maxAge: 0, path: '/' });
  return res;
}
