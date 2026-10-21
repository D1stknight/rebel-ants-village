// GET /api/raap-universe-obligations[?connectionId=]: the admin's export of the RAAP chest obligations still unresolved
// (dev only). The term-end path: ordinary raap:v1:dev records end exactly at retainUntil; an intent still PENDING /
// OUTCOME_UNKNOWN has no automatic end and is listed here with its exact evidence (the signed request, the beneficiary,
// the exact economy key, any confirmed credit id) until Miguel decides. Read-only: it never pays, retries, changes or
// deletes anything, and the game's claims and owed records are not touched.
import { isAdminRequest } from './_admin-auth.mjs';
import { connectionConfig } from './_raap-universe.mjs';
import { listObligations } from './_raap-universe-chest.mjs';
import { redis, send, errorBody } from './_raap-universe-http.mjs';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (process.env.VERCEL_ENV === 'production') return send(res, 403, errorBody('CONNECTION_UNAVAILABLE'));
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return send(res, 405, errorBody('METHOD_NOT_ALLOWED')); }
  if (!isAdminRequest(req)) return send(res, 401, errorBody('ADMIN_ONLY'));
  const c = connectionConfig(process.env), id = String(req.query?.connectionId || c?.connectionId || '');
  if (!/^[a-zA-Z0-9_.:-]{1,128}$/.test(id)) return send(res, 400, errorBody('MALFORMED'));
  try {
    const out = await listObligations(id, { redis, now: () => Math.floor(Date.now() / 1000) });
    return send(res, 200, { ...out, retainUntil: c && c.connectionId === id ? c.retainUntil : null });
  } catch (e) { return send(res, 503, errorBody('TEMPORARILY_UNAVAILABLE')); }
}
