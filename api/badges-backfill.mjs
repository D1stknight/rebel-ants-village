// Admin: send every saved story's badges to the Rebel Economy's Badge Wall now (api/_universe-badge-send.mjs). A
// story save sends them anyway; this is for the players who haven't saved since badges went there. This site's stories
// only (production's on rebeluniverse.io, a preview its own); each account's badges still go once. The Admin Hub calls
// it again with the cursor it answers until done.
//   POST { cursor } -> { ok, cursor (the next one; '0' = done), done, accounts, sent, waiting, stopped: { why: n } }
import { isAdminRequest } from './_admin-auth.mjs';
import { redis } from './_econ.mjs';
import { sendStoryBadges } from './_universe-badge-send.mjs';

const SITE = process.env.VERCEL_ENV === 'production' ? 'prod' : 'dev';
const PREFIX = `story:v1:${SITE}:`;
const ACCOUNT = /^[A-Za-z0-9_-]{6,64}$/;   // story:v1:<site>:<u> (not its :ver key)

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  if (!isAdminRequest(req)) return res.status(401).json({ ok: false, error: 'Admins only' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    let cursor = /^\d{1,20}$/.test(String(body.cursor ?? '0')) ? String(body.cursor ?? '0') : '0';
    const until = Date.now() + 40000, out = { accounts: 0, sent: 0, waiting: 0, stopped: {} };
    do {
      const [scan] = await redis([['SCAN', cursor, 'MATCH', `${PREFIX}*`, 'COUNT', '25']]);
      const [next, keys] = Array.isArray(scan?.result) ? scan.result : ['0', []];
      cursor = String(next);
      const users = (keys || []).map((k) => String(k).slice(PREFIX.length)).filter((u) => ACCOUNT.test(u));
      for (const u of users) {
        const [d] = await redis([['GET', PREFIX + u]]);
        let doc = null; try { doc = d?.result ? JSON.parse(d.result) : null; } catch (e) { doc = null; }
        if (!doc?.keys) continue;
        out.accounts++;
        try {
          const r = await sendStoryBadges(u, { keys: doc.keys }, { site: SITE, budgetMs: Math.max(1500, Math.min(6000, until + 20000 - Date.now())) });
          out.sent += r.sent.length; out.waiting += r.waiting.length;
          if (r.error) out.stopped[r.error] = (out.stopped[r.error] || 0) + 1;
        } catch (e) { out.stopped[e.message] = (out.stopped[e.message] || 0) + 1; }
      }
    } while (cursor !== '0' && Date.now() < until);
    return res.status(200).json({ ok: true, site: SITE, cursor, done: cursor === '0', ...out });
  } catch (e) {
    console.error('[badges-backfill]', e.message);
    return res.status(e.status || 500).json({ ok: false, error: e.message || 'The badges did not go' });
  }
}
