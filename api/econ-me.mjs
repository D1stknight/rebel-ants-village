// The village player's Rebel Economy account.
//   GET                     -> { ok, configured, signedIn, name, avatar, balance, today, cap, owed, claimed, recent }
//   POST { action:'logout' } -> clears the session
// Signed in = the ra_econ cookie (api/econ-discord-callback). The balance is the economy's (every game's points);
// today / cap / owed / claimed are the village's own ledger (api/_econ-ledger.mjs). Points held past an earlier day's
// cap are paid here, once there is room today.
import { enforceRateLimit } from './_guard.mjs';
import { econReady, econSessionOf, clearEconCookie, econResolve } from './_econ.mjs';
import { payOwed, today, claimed, recent } from './_econ-ledger.mjs';

// the Discord picture, or Discord's own default one (an account without a picture: index (id >> 22) % 6)
const avatarUrl = (s) => (s.a && /^[A-Za-z0-9_]+$/.test(s.a) ? `https://cdn.discordapp.com/avatars/${s.d}/${s.a}.png?size=64`
  : `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(s.d) >> 22n) % 6n)}.png`);

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const body = req.method === 'POST' ? (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})) : {};
    if (req.method === 'POST' && body.action === 'logout') {
      res.setHeader('Set-Cookie', clearEconCookie());
      return res.status(200).json({ ok: true, signedIn: false });
    }
    if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });
    const configured = econReady(), s = configured ? econSessionOf(req) : null;
    if (!s) return res.status(200).json({ ok: true, configured, signedIn: false });
    if (!(await enforceRateLimit(req, res, `econ-me:${s.u}`, 900, 3600, 'account checks'))) return;
    let paidNow = 0;
    try { paidNow = (await payOwed(s.u)).paid; } catch (e) { console.warn('[econ-me] owed', e.message); }
    const [acct, t, c, r] = await Promise.all([
      econResolve({ discordId: s.d, username: s.un || s.n, displayName: s.n }).catch((e) => ({ error: e.message })),
      today(s.u), claimed(s.u), recent(s.u).catch(() => [])
    ]);
    return res.status(200).json({
      ok: true, configured, signedIn: true, name: s.n || s.un, avatar: avatarUrl(s),
      balance: acct.error ? null : acct.balance, balanceError: acct.error || null,
      today: t.today, cap: t.cap, owed: t.owed, paidNow, claimed: c, recent: r
    });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, error: e.message || 'Account check failed' });
  }
}
