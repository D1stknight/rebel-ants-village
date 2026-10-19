// Sign in to the Rebel Economy with Discord, step 2: Discord sends the player back here.
//   GET ?code&state (or ?error=access_denied)
// Checks the one-time state, swaps the code for the Discord account, finds (or makes) its economy account through
// /api/internal/resolve and sets the ra_econ session cookie. A popup gets a page that tells the game tab and closes;
// a full-page sign-in goes straight back to where it started. See api/_econ.mjs.
import { enforceRateLimit } from './_guard.mjs';
import { readStateCookie, clearStateCookie, discordUserFromCode, econResolve, econSessionCookie, finishPage } from './_econ.mjs';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const q = req.query || {};
  const st = readStateCookie(req, String(q.state || ''));
  const ret = st?.ret || '/village.html', popup = !!st?.popup;
  const page = (status, ok, message, cookies = []) => {
    res.setHeader('Set-Cookie', [clearStateCookie(), ...cookies]);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(status).send(finishPage({ ok, message, ret, popup }));
  };
  try {
    if (!st) return page(400, false, 'This sign-in expired. Please try again from the village.');
    if (q.error) return page(200, false, q.error === 'access_denied' ? 'Discord sign-in was cancelled.' : 'Discord did not sign you in. Please try again.');
    if (!q.code) return page(400, false, 'Discord did not send a sign-in code. Please try again.');
    if (!(await enforceRateLimit(req, res, 'econ-callback', 60, 3600, 'sign-in attempts'))) return;
    const d = await discordUserFromCode(req, q.code);
    const acct = await econResolve({ discordId: d.id, username: d.username, displayName: d.global_name || d.username });
    const cookie = econSessionCookie({ u: acct.userId, d: d.id, un: d.username, n: acct.displayName || d.global_name || d.username, a: d.avatar });
    if (!popup) {
      res.setHeader('Set-Cookie', [clearStateCookie(), cookie]);
      res.setHeader('Location', ret);
      return res.status(302).end();
    }
    return page(200, true, `Welcome, ${acct.displayName || d.global_name || d.username}. Your Rebel points now go to your account.`, [cookie]);
  } catch (err) {
    console.error('[econ-discord-callback]', err.message, err.code || err.detail || '');
    return page(err.status && err.status < 500 ? err.status : 502, false, err.message || 'Sign-in failed. Please try again.');
  }
}
