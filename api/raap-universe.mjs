// POST /api/raap-universe: RAAP's server connection to the game, dev only (Oct 19). v1 = a Rebel's weapon: READ, PREPARE,
// EXECUTE (owner-approved equip / unequip, zero charge), RECEIPT. The operations live in _raap-universe.mjs.
// RAAP's worker sends Authorization: Bearer <RAAP_UNIVERSE_DEV_CONNECTION_KEY> (and the Vercel protection bypass on the
// preview). Without the key and RAAP_UNIVERSE_DEV_CONNECTION, on production, or from a browser (Origin) it answers 403.
import { ownerOf } from './_wallet.mjs';
import { getToken } from './_nft.mjs';
import { getCollection } from './_collections.mjs';
import { handleOperation } from './_raap-universe.mjs';
import { eventsPage } from './_raap-universe-events.mjs';
import { rawBody, redis, send, refusal, devRateLimit, errorBody } from './_raap-universe-http.mjs';

const deps = {
  env: process.env, now: () => Math.floor(Date.now() / 1000), redis,
  owner: (collectionKey, tokenId) => ownerOf(collectionKey, tokenId),
  trait: async (collectionKey, tokenId) => { const t = await getToken(collectionKey, tokenId); const w = (t.traits || []).find((x) => x.trait_type === 'Weapons'); return w ? String(w.value) : null; },
  contract: async (collectionKey) => (await getCollection(collectionKey))?.contract?.toLowerCase() || null,
  events: (c, op) => eventsPage(c, op, deps)
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return send(res, 405, errorBody('METHOD_NOT_ALLOWED')); }
  const no = refusal(req);
  if (no) return send(res, no[0], errorBody(no[1]));
  if (!(await devRateLimit(req, 'universe', 120, 60))) return send(res, 429, errorBody('RATE_LIMITED'));
  try {
    const out = await handleOperation(await rawBody(req), deps);
    return send(res, out.status, out.body);
  } catch (e) {
    // a read or check failed before any game change: nothing was saved
    return send(res, 503, errorBody('TEMPORARILY_UNAVAILABLE', { committed: false }));
  }
}
