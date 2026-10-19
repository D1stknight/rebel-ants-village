// /api/raap-universe-link: the player's own page (raap-link.html) links the signed-in wallet to the signed-in Rebel
// Economy account for RAAP, and gives or ends experience sharing. Dev only, off unless the RAAP connection has a chest
// or events section. The operations live in _raap-universe-link.mjs.
//   GET   the page's status (who is signed in, the link, sharing, revocations ready to sign)
//   POST  a LinkOperation (PREPARE_LINK, SAVE_LINK, PREPARE_SHARING, SAVE_SHARING, REVOKE) or DISCONNECT
// POST is same-origin only: Origin = the connection's dev origin, JSON, never with a bearer (RAAP's key is not a sign-in).
import { walletOf, ownerOf } from './_wallet.mjs';
import { econSessionOf } from './_econ.mjs';
import { connectionConfig } from './_raap-universe.mjs';
import { handleLinkOperation, linkStatusPage } from './_raap-universe-link.mjs';
import { redis, send, devRateLimit, errorBody } from './_raap-universe-http.mjs';

const deps = { env: process.env, now: () => Math.floor(Date.now() / 1000), redis, owner: (collectionKey, tokenId) => ownerOf(collectionKey, tokenId) };

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (process.env.VERCEL_ENV === 'production') return send(res, 403, errorBody('CONNECTION_UNAVAILABLE'));
  if (req.method !== 'GET' && req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return send(res, 405, errorBody('METHOD_NOT_ALLOWED')); }
  if (!(await devRateLimit(req, 'link', 30, 60))) return send(res, 429, errorBody('RATE_LIMITED'));
  const session = { wallet: walletOf(req), econ: econSessionOf(req) };
  try {
    if (req.method === 'GET') { const out = await linkStatusPage(session, deps); return send(res, out.status, out.body); }
    const c = connectionConfig(process.env), site = String(req.headers['sec-fetch-site'] || '');
    if (!c || String(req.headers.origin || '') !== c.audience || (site && site !== 'same-origin') || req.headers.authorization
      || !/^application\/json(;|$)/i.test(String(req.headers['content-type'] || '').trim())) return send(res, 403, errorBody('NOT_SAME_ORIGIN'));
    let op = req.body;
    if (typeof op === 'string') { if (op.length > 65536) return send(res, 400, errorBody('MALFORMED')); try { op = JSON.parse(op); } catch (e) { return send(res, 400, errorBody('MALFORMED')); } }
    const out = await handleLinkOperation(op, session, deps);
    return send(res, out.status, out.body);
  } catch (e) {
    return send(res, 503, errorBody('TEMPORARILY_UNAVAILABLE', { committed: false }));
  }
}
