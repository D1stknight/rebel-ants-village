// POST /api/raap-universe-chest: RAAP's server opens one exact, owner-approved chest (dev only, Oct 19): READ, PREPARE,
// EXECUTE, RECEIPT, LINK_STATUS. The operations live in _raap-universe-chest.mjs; the player's account link and sharing
// in raap-universe-link.mjs. Same bearer and refusals as /api/raap-universe (no key, production or a browser -> 403);
// off unless RAAP_UNIVERSE_DEV_CONNECTION has a chest section.
import { ownerOf } from './_wallet.mjs';
import { getCollection } from './_collections.mjs';
import { econCredit } from './_econ.mjs';
import { handleChestOperation } from './_raap-universe-chest.mjs';
import { recordClaim } from './_raap-universe-events.mjs';
import { rawBody, redis, send, refusal, devRateLimit, errorBody } from './_raap-universe-http.mjs';

const deps = {
  env: process.env, now: () => Math.floor(Date.now() / 1000), redis,
  owner: (collectionKey, tokenId) => ownerOf(collectionKey, tokenId),
  contract: async (collectionKey) => (await getCollection(collectionKey))?.contract?.toLowerCase() || null,
  credit: (args) => econCredit(args),
  creditReady: () => !!(String(process.env.REBEL_ECONOMY_URL || '').trim() && String(process.env.REBEL_ECONOMY_SERVICE_KEY || '').trim()),
  // a claimed chest becomes a shared experience when the player shares them (RAAP_APPROVED + the request id), under the
  // consent read before the admit
  onClaim: (x) => recordClaim({ u: x.u, kind: 'chest', id: x.id, sourceId: x.id, village: x.village, units: x.units, settled: x.settled,
    transactionId: x.transactionId, at: x.at, origin: 'RAAP_APPROVED', requestId: x.requestId, consent: x.consent }, deps)
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return send(res, 405, errorBody('METHOD_NOT_ALLOWED')); }
  const no = refusal(req);
  if (no) return send(res, no[0], errorBody(no[1]));
  if (!(await devRateLimit(req, 'chest', 120, 60))) return send(res, 429, errorBody('RATE_LIMITED'));
  try {
    const out = await handleChestOperation(await rawBody(req), deps);
    return send(res, out.status, out.body);
  } catch (e) {
    // unexpected: no claim either way (after an admit the handler answers itself; RAAP reads RECEIPT, never resends)
    return send(res, 503, errorBody('TEMPORARILY_UNAVAILABLE'));
  }
}
