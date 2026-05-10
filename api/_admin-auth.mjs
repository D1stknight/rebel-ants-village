import crypto from 'crypto';

const COOKIE_NAME = 'ra_admin_session';
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function signPayload(payloadB64) {
  const secret = getRequiredEnv('ADMIN_SESSION_SECRET');
  return crypto
    .createHmac('sha256', secret)
    .update(payloadB64)
    .digest('base64url');
}

function safeEqual(a, b) {
  const aBuf = Buffer.from(String(a || ''));
  const bBuf = Buffer.from(String(b || ''));
  return aBuf.length === bBuf.length && crypto.timingSafeEqual(aBuf, bBuf);
}

export function isValidAdminPassword(password) {
  const expected = getRequiredEnv('ADMIN_PASSWORD');
  return safeEqual(password, expected);
}

export function createAdminSessionToken() {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    role: 'admin',
    iat: now,
    exp: now + SESSION_TTL_SECONDS
  };

  const payloadB64 = base64url(JSON.stringify(payload));
  const signature = signPayload(payloadB64);
  return `${payloadB64}.${signature}`;
}

export function verifyAdminSessionToken(token) {
  if (!token || typeof token !== 'string') return false;

  const [payloadB64, signature] = token.split('.');
  if (!payloadB64 || !signature) return false;

  const expectedSignature = signPayload(payloadB64);
  if (!safeEqual(signature, expectedSignature)) return false;

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);

    return (
      payload &&
      payload.role === 'admin' &&
      typeof payload.exp === 'number' &&
      payload.exp > now
    );
  } catch {
    return false;
  }
}

export function readCookie(req, name) {
  const raw = req.headers.cookie || '';
  const parts = raw.split(';').map(part => part.trim());

  for (const part of parts) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;

    const key = part.slice(0, eq);
    const value = part.slice(eq + 1);

    if (key === name) {
      return decodeURIComponent(value);
    }
  }

  return null;
}

export function getAdminSessionFromRequest(req) {
  return readCookie(req, COOKIE_NAME);
}

export function isAdminRequest(req) {
  return verifyAdminSessionToken(getAdminSessionFromRequest(req));
}

export function buildAdminSessionCookie(token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secure}`;
}

export function buildClearAdminSessionCookie() {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}
