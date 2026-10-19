// Rebel points for the signed-in village player, decided here (api/_econ-ledger.mjs), paid by the Rebel Economy.
//   POST { kind:'chest'|'game'|'riddle'|'find', id } -> { ok, paid, held, already, capped, balance, today, cap, owed }
// The browser only says what happened (this chest opened, that game cleared); the amount comes from the catalog and
// every one-time award pays once per account. Guests (no ra_econ session) get 401: their points stay practice points.
import { enforceRateLimit } from './_guard.mjs';
import { econSessionOf } from './_econ.mjs';
import { award, payOwed, ID } from './_econ-ledger.mjs';

const KINDS = new Set(['chest', 'game', 'riddle', 'find']);

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
    const r = await award(s.u, kind, id);
    return res.status(200).json({ ok: true, signedIn: true, kind, id, ...r });
  } catch (e) {
    console.error('[econ-award]', e.message, e.code || '');
    return res.status(e.status || 500).json({ ok: false, signedIn: true, error: e.message || 'The award did not go through', retry: !(e.status >= 400 && e.status < 500) });
  }
}
