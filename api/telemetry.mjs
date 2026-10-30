// POST /api/telemetry   { events: [{ k, p, ... }] }  (assets/site-report.js, by sendBeacon) -> 204
// What goes wrong on players' screens, for the Admin Hub's dashboard: script errors, startup problems, how long pages took
// to be ready. Public (players aren't signed in), so everything is checked and capped (api/_telemetry.mjs: 12 events a
// call, 120 per address in 10 minutes, page names / numbers / scrubbed messages only); a page of another site is refused.
import { record } from './_telemetry.mjs';
import { clientIp } from './_guard.mjs';

const OURS = /^(rebeluniverse\.io|www\.rebeluniverse\.io|rebel-ants-village[a-z0-9-]*\.vercel\.app|localhost|127\.0\.0\.1)(:\d+)?$/i;

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false }); }
  const origin = String(req.headers.origin || '');
  if (origin) { let host = ''; try { host = new URL(origin).host; } catch (e) {} if (!OURS.test(host)) return res.status(403).json({ ok: false }); }
  let body = req.body;
  if (typeof body === 'string') { if (body.length > 16000) return res.status(413).json({ ok: false }); try { body = JSON.parse(body); } catch (e) { body = null; } }
  if (!body || typeof body !== 'object' || !Array.isArray(body.events)) return res.status(400).json({ ok: false });
  try {
    const r = await record(body.events, clientIp(req));
    if (r.limited) return res.status(429).json({ ok: false });
  } catch (e) { console.warn('[telemetry]', e.message); } // (a report lost is no reason to bother the page)
  res.status(204).end();
}
