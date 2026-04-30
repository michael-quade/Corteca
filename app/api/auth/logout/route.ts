import { NextResponse } from 'next/server';

export async function POST() {
  const res = NextResponse.json({ ok: true });

  for (const name of ['corteca_token', 'corteca_refresh_token', 'corteca_email']) {
    res.cookies.set(name, '', { maxAge: 0, path: '/' });
  }

  return res;
}
