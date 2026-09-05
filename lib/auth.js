// Session handling for the single shared login.
//
// How the password actually stays secret:
//   - APP_PASSWORD and SESSION_SECRET live only as environment variables
//     (Vercel Project Settings -> Environment Variables in production,
//     .env.local for development). They are never written into any file
//     that ships to the browser, and never appear in client-side JS.
//   - The login API route (app/api/auth/login/route.js) compares the
//     submitted password to APP_PASSWORD on the server only.
//   - On success, it signs a short JWT (using SESSION_SECRET) and sets it
//     as an httpOnly, secure, sameSite cookie. httpOnly means client-side
//     JavaScript cannot read the cookie at all — it's invisible to
//     view-source, devtools console, browser extensions, everything.
//   - middleware.js verifies that signed cookie on every request to a
//     protected page/API route before allowing it through.
//
// To change the password later: update APP_PASSWORD in Vercel's dashboard
// and redeploy (no code change needed, nothing to leak).

import { SignJWT, jwtVerify } from 'jose';

const COOKIE_NAME = 'soupresso_session';
const SESSION_DURATION_HOURS = 24 * 14; // 14 days

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      'SESSION_SECRET is not set (or too short). Set it to a long random string in your environment variables.'
    );
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(email) {
  const key = getSecretKey();
  return await new SignJWT({ email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_HOURS}h`)
    .sign(key);
}

export async function verifySessionToken(token) {
  try {
    const key = getSecretKey();
    const { payload } = await jwtVerify(token, key);
    return payload;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
export const SESSION_MAX_AGE_SECONDS = SESSION_DURATION_HOURS * 60 * 60;
