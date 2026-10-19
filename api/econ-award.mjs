// Rebel points for the signed-in village player, decided here (api/_econ-ledger.mjs), paid by the Rebel Economy.
//   POST { kind:'chest'|'game'|'riddle'|'find', id } -> { ok, paid, held, already, capped, balance, today, cap, owed }
// The browser only says what happened (this chest opened, that game cleared); the amount comes from the catalog and
// every one-time award pays once per account. Guests (no ra_econ session) get 401: their points stay practice points.
import { enforceRateLimit } from './_guard.mjs';
import { econSessionOf } from './_econ.mjs';
import { award, payOwed, ID, lookup } from './_econ-ledger.mjs';

const KINDS = new Set(['chest', 'game', 'riddle', 'find']);

// RAAP dev only: a player who shares confirmed experiences with their Rebel gets this award written down as it
// happened, once (_raap-universe-events.mjs), under the consent in force just before the claim (read first, checked
// again at the append). Loaded only when a RAAP connection is set; never changes the award or the answer.
const raapDeps = async () => ({ env: process.env, now: () => Math.floor(Date.now() / 1000), redis: (await import('./_raap-universe-http.mjs')).redis });
async function consentBefore(u) {
  try { return await (await import('./_raap-universe-events.mjs')).consentInForce(u, await raapDeps()); }
  catch (e) { console.warn('[econ-award] shared experience consent', e.message); return null; }
}
async function shareExperience(u, kind, id, r, info, consent) {
  try {
    await (await import('./_raap-universe-events.mjs')).recordClaim({ u, kind, id, sourceId: kind === 'find' ? info.ikey.slice('village:find:'.length, -(u.length + 1)) : id,
      village: lookup(kind, id)?.village, units: r.paid || r.held, settled: info.settled, transactionId: info.transactionId, at: Math.floor(info.at / 1000),
      origin: 'OWNER_PLAYED', requestId: null, consent }, await raapDeps());
  } catch (e) { console.warn('[econ-award] shared experience', e.message); }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  try {
    const s = econSessionOf(req);
    if (!s) return res.status(401).json({ ok: false, signedIn: false, error: 'Sign in to keep your Rebel points' });
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const kind = String(body.kind || ''), id = String(body.id || '');
    if (!KINDS.has(kind) || !ID.test(id)) return res.status(400).json({ ok: false, error: 'Unknown award' });
    if (!(await enforceRateLimit(req, res, `econ-award:${s.u}`, 400, 3600, 'awards'))) return;
    await payOwed(s.u).catch((e) => console.warn('[econ-award] owed', e.message));
    const consent = process.env.RAAP_UNIVERSE_DEV_CONNECTION ? await consentBefore(s.u) : null;
    const info = {};
    const r = await award(s.u, kind, id, info);
    if (info.settled && consent) await shareExperience(s.u, kind, id, r, info, consent);
    return res.status(200).json({ ok: true, signedIn: true, kind, id, ...r });
  } catch (e) {
    console.error('[econ-award]', e.message, e.code || '');
    return res.status(e.status || 500).json({ ok: false, signedIn: true, error: e.message || 'The award did not go through', retry: !(e.status >= 400 && e.status < 500) });
  }
}
