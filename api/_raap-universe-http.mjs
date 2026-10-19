// What the RAAP connection's HTTP routes share (raap-universe, raap-universe-chest): the exact request bytes, one
// confirmed Redis command, the bearer / production / browser refusals, a rate limit kept under raap:v1:dev:*, and
// canonical JSON answers. The operations themselves live in _raap-universe*.mjs.
import crypto from 'node:crypto';
import { canonical, MAX_BODY } from './_raap-universe.mjs';
import { clientIp } from './_guard.mjs';

export const errorBody = (code, extra) => ({ schema: 'universe.raap.error.v1', error: code, ...(extra || {}) });
const equal = (a, b) => { const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || '')); return x.length === y.length && crypto.timingSafeEqual(x, y); };

// the exact bytes RAAP sent (the runtime keeps them readable after parsing req.body), at most MAX_BODY
export function rawBody(req) {
  return new Promise((resolve) => {
    const parts = []; let n = 0, done = false;
    const end = (v) => { if (!done) { done = true; clearTimeout(timer); resolve(v); } };
    const timer = setTimeout(() => end(null), 4000);
    req.on('data', (chunk) => { n += chunk.length; if (n <= MAX_BODY) parts.push(Buffer.from(chunk)); });
    req.on('end', () => end(n > MAX_BODY ? null : Buffer.concat(parts)));
    req.on('error', () => end(null));
  });
}

// one Redis command, confirmed (as raap-world.mjs)
export async function redis(args) {
  const origin = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL, token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!origin || !token) throw Error('Storage unavailable');
  const r = await fetch(origin + '/pipeline', { method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify([args]),
    signal: AbortSignal.timeout(4000), redirect: 'error', cache: 'no-store' });
  const data = await r.json();
  if (!r.ok || data?.length !== 1 || !data[0] || data[0].error || !Object.hasOwn(data[0], 'result')) throw Error('Storage did not confirm this command');
  return data[0].result;
}

export function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(canonical(body));
}

// RAAP's worker only: the dedicated dev bearer, never production, never a browser (Origin). null = let it through.
export function refusal(req) {
  if (!req.headers.authorization) return [401, 'NOT_AUTHENTICATED'];
  const key = process.env.RAAP_UNIVERSE_DEV_CONNECTION_KEY;
  if (process.env.VERCEL_ENV === 'production' || !/^[0-9a-f]{64}$/.test(key || '') || !equal(req.headers.authorization, 'Bearer ' + key) || req.headers.origin)
    return [403, 'CONNECTION_UNAVAILABLE'];
  return null;
}

// fixed-window count per route and caller, under raap:v1:dev:rl:* (the game's own rl:* limits stay as they are).
// Fails open like the game's limiter: the operation's own reads then fail if storage is down.
export async function devRateLimit(req, route, limit, windowSec) {
  const win = Math.floor(Date.now() / 1000 / windowSec);
  const who = crypto.createHash('sha256').update('raap-rl:' + clientIp(req)).digest('hex').slice(0, 16);
  const key = `raap:v1:dev:rl:${route}:${who}:${win}`;
  try {
    const n = Number(await redis(['INCR', key]));
    await redis(['EXPIRE', key, String(windowSec + 60)]).catch(() => {});
    return n <= limit;
  } catch (e) { return true; }
}
