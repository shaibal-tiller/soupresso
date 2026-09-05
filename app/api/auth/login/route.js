import { NextResponse } from 'next/server';
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from '@/lib/auth';

// The password is compared here, server-side, against an environment
// variable. It is never sent to, or stored in, the browser bundle.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { email, password } = body || {};
  const expectedEmail = process.env.APP_EMAIL;
  const expectedPassword = process.env.APP_PASSWORD;

  if (!expectedEmail || !expectedPassword) {
    return NextResponse.json(
      { error: 'Server is not configured (APP_EMAIL / APP_PASSWORD missing).' },
      { status: 500 }
    );
  }

  const emailOk = typeof email === 'string' && email.trim().toLowerCase() === expectedEmail.toLowerCase();
  const passwordOk = typeof password === 'string' && password === expectedPassword;

  if (!emailOk || !passwordOk) {
    // Deliberately generic — don't reveal which field was wrong.
    return NextResponse.json({ error: 'Incorrect email or password.' }, { status: 401 });
  }

  const token = await createSessionToken(expectedEmail);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
