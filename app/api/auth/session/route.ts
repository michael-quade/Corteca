import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const token = req.cookies.get('corteca_token')?.value;
  const email = req.cookies.get('corteca_email')?.value;

  if (!token || !email) {
    return NextResponse.json({ authenticated: false });
  }

  return NextResponse.json({ authenticated: true, email });
}
