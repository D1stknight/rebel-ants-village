// Is the Rebel Economy link set up on this deploy? Names only, never values.
//   GET -> { ok, ready, env: { NAME: true|false }, economyHost, callback, deploy, economy: { reachable, keyAccepted } }
// The key check asks the economy for a wallet nobody has (read-only): 404 = the key works, 401 = it doesn't.
import { enforceRateLimit } from './_guard.mjs';
import { econEnv, econReady, economyHost, callbackUrl, econCall } from './_econ.mjs';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!(await enforceRateLimit(req, res, 'econ-status', 60, 3600, 'status checks'))) return;
  const env = econEnv(), out = { ok: true, ready: econReady(), env, economyHost: economyHost(), callback: callbackUrl(req), deploy: process.env.VERCEL_ENV || 'local', economy: null };
  if (env.REBEL_ECONOMY_URL && env.REBEL_ECONOMY_SERVICE_KEY) {
    try {
      const r = await econCall(`/api/internal/user-by-wallet?address=0x${'0'.repeat(39)}1`, null, 'GET');
      out.economy = { reachable: true, keyAccepted: r.status !== 401 && r.status !== 403, status: r.status };
    } catch (e) { out.economy = { reachable: false, keyAccepted: false, error: e.message }; }
  }
  return res.status(200).json(out);
}
