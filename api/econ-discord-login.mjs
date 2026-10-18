// Sign in to the Rebel Economy with Discord, step 1: off to Discord's consent page.
//   GET ?return=<path on this site>&popup=1
// On another host of the same deploy (www, a commit URL) it first moves to the one origin this deploy signs in on, so
// the session cookie lands where Discord sends the player back. See api/_econ.mjs.
import { enforceRateLimit } from './_guard.mjs';
import { econEnv, newStateCookie, safeReturn, publicOrigin, hostOf, discordAuthorizeUrl, finishPage } from './_econ.mjs';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const q = req.query || {};
  const ret = safeReturn(q.return), popup = q.popup === '1';
  try {
    const e = econEnv();
    if (!e.DISCORD_CLIENT_ID || !e.DISCORD_CLIENT_SECRET || !e.VILLAGE_SESSION_SECRET || !e.REBEL_ECONOMY_URL || !e.REBEL_ECONOMY_SERVICE_KEY) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(503).send(finishPage({ ok: false, message: 'Sign-in is not set up on this site yet.', ret, popup }));
    }
    const origin = publicOrigin(req);
    if (new URL(origin).host !== hostOf(req)) {
      const u = new URL(req.url, origin);
      res.setHeader('Location', `${origin}${u.pathname}${u.search}`);
      return res.status(302).end();
    }
    if (!(await enforceRateLimit(req, res, 'econ-login', 60, 3600, 'sign-in attempts'))) return;
    const { state, cookie } = newStateCookie({ ret, popup });
    res.setHeader('Set-Cookie', cookie);
    res.setHeader('Location', discordAuthorizeUrl(req, state));
    return res.status(302).end();
  } catch (err) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(err.status || 500).send(finishPage({ ok: false, message: err.message || 'Sign-in failed. Please try again.', ret, popup }));
  }
}
