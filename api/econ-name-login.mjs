// Name + PIN sign-in, for players without Discord: the casino's colony name accounts in the Rebel Economy
// (rebel-economy-core /api/internal/name-auth). On success the village's own session is set (the ra_econ cookie,
// d = "name:<slug>"), as the Discord sign-in does.
//   POST { action: 'login' | 'register', name, pin } -> { ok: true, name, message, created }
//                                                     | { ok: false, code, message }   (taken, unknown name, wrong PIN, locked...)
// The player's address goes to the economy for its rate limits (every village player reaches it from this server).
import { enforceRateLimit, clientIp } from './_guard.mjs';
import { econReady, econSessionCookie, econNameAuth, NAME_ID } from './_econ.mjs';
import { bump } from './_site-stats.mjs';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  if (!econReady()) return res.status(503).json({ ok: false, code: 'not_set_up', message: 'Sign-in is not set up on this site yet.' });
  let body = {};
  try { body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); } catch (e) {}
  const action = body.action === 'register' || body.action === 'login' ? body.action : '';
  if (!action) return res.status(400).json({ ok: false, code: 'invalid_input', message: 'Sign in or make an account.' });
  if (!(await enforceRateLimit(req, res, 'econ-name', 40, 600, 'sign-in attempts'))) return;
  if (action === 'register' && !(await enforceRateLimit(req, res, 'econ-name-new', 10, 3600, 'new accounts'))) return;

  let r;
  try {
    r = await econNameAuth({ action, name: String(body.name || '').slice(0, 40), pin: String(body.pin || '').slice(0, 12), player: clientIp(req) });
  } catch (e) {
    return res.status(e.status || 502).json({ ok: false, code: 'unreachable', message: e.message || 'The Rebel Economy did not answer' });
  }
  const d = r.data || {};
  if (r.status === 404) return res.status(503).json({ ok: false, code: 'unavailable', message: 'Name sign-in is not switched on in the Rebel Economy yet.' });
  if (r.status === 429) return res.status(429).json({ ok: false, code: 'rate_limited', message: d.message || 'Too many tries. Try again later.' });
  if (!r.ok) return res.status(502).json({ ok: false, code: 'economy_error', message: d.message || 'The Rebel Economy did not answer' });
  if (!d.ok) return res.status(200).json({ ok: false, code: String(d.code || 'failed'), message: String(d.message || 'Not signed in.') });

  const id = d.identity || {};
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(String(d.userId || '')) || !NAME_ID.test(String(id.id || ''))) {
    return res.status(502).json({ ok: false, code: 'economy_error', message: 'The Rebel Economy sent an account the village does not know' });
  }
  const name = String(id.displayName || id.username || '').slice(0, 64);
  res.setHeader('Set-Cookie', econSessionCookie({ u: d.userId, d: id.id, un: id.username, n: name, a: null }));
  await bump({ 'signin:name': 1, ...(d.created ? { 'new:name': 1 } : {}) }); // (the dashboard)
  return res.status(200).json({ ok: true, name, message: String(d.message || ''), created: !!d.created });
}
