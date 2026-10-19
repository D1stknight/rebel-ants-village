// POST /api/raap-universe: RAAP's server connection to the game, dev only (Oct 19). v1 = a Rebel's weapon: READ, PREPARE,
// EXECUTE (owner-approved equip / unequip, zero charge), RECEIPT. The operations live in _raap-universe.mjs.
// RAAP's worker sends Authorization: Bearer <RAAP_UNIVERSE_DEV_CONNECTION_KEY> (and the Vercel protection bypass on the
// preview). Without the key and RAAP_UNIVERSE_DEV_CONNECTION, on production, or from a browser (Origin) it answers 403.
import crypto from 'node:crypto';
import { enforceRateLimit } from './_guard.mjs';
import { ownerOf } from './_wallet.mjs';
import { getToken } from './_nft.mjs';
import { getCollection } from './_collections.mjs';
import { handleOperation, canonical, MAX_BODY } from './_raap-universe.mjs';

const equal = (a, b) => { const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || '')); return x.length === y.length && crypto.timingSafeEqual(x, y); };
// the exact bytes RAAP sent (the runtime keeps them readable after parsing req.body), at most MAX_BODY
function rawBody(req) {
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
async function redis(args) {
  const origin = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL, token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!origin || !token) throw Error('Storage unavailable');
  const r = await fetch(origin + '/pipeline', { method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify([args]),
    signal: AbortSignal.timeout(4000), redirect: 'error', cache: 'no-store' });
  const data = await r.json();
  if (!r.ok || data?.length !== 1 || !data[0] || data[0].error || !Object.hasOwn(data[0], 'result')) throw Error('Storage did not confirm this command');
  return data[0].result;
}
const deps = {
  env: process.env, now: () => Math.floor(Date.now() / 1000), redis,
  owner: (collectionKey, tokenId) => ownerOf(collectionKey, tokenId),
  trait: async (collectionKey, tokenId) => { const t = await getToken(collectionKey, tokenId); const w = (t.traits || []).find((x) => x.trait_type === 'Weapons'); return w ? String(w.value) : null; },
  contract: async (collectionKey) => (await getCollection(collectionKey))?.contract?.toLowerCase() || null
};
function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(canonical(body));
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  const error = (code) => ({ schema: 'universe.raap.error.v1', error: code });
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return send(res, 405, error('METHOD_NOT_ALLOWED')); }
  if (!req.headers.authorization) return send(res, 401, error('NOT_AUTHENTICATED'));
  const key = process.env.RAAP_UNIVERSE_DEV_CONNECTION_KEY;
  if (process.env.VERCEL_ENV === 'production' || !/^[0-9a-f]{64}$/.test(key || '') || !equal(req.headers.authorization, 'Bearer ' + key) || req.headers.origin)
    return send(res, 403, error('CONNECTION_UNAVAILABLE'));
  if (!(await enforceRateLimit(req, res, 'raap-universe', 120, 60, 'requests'))) return;
  try {
    const out = await handleOperation(await rawBody(req), deps);
    return send(res, out.status, out.body);
  } catch (e) {
    // a read or check failed before any game change: nothing was saved
    return send(res, 503, { ...error('TEMPORARILY_UNAVAILABLE'), committed: false });
  }
}
