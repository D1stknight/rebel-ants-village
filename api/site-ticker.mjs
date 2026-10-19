// Landing page ticker (Oct 18, Miguel: "in the main landing page where you connect your wallet, there is a scrolling text
// on the bottom, i would like in admin to be able to change this scrolling text, that way i can make announcements").
//   GET                          -> { ok, items: [line] | null, seconds, updatedAt, env }   (public; null = the page's own lines)
//   POST { items, seconds }      -> save the lines (admin): up to 12 lines of up to 160 characters, 12-120 s a loop
//   POST { reset: true }         -> back to the page's own lines (admin)
// Production and the previews keep their own copy (like the game boards), so trying a line on a preview never shows on
// the live site.
import { isAdminRequest } from './_admin-auth.mjs';

const ENV = process.env.VERCEL_ENV === 'production' ? 'prod' : 'dev';
const KEY = `site:ticker:v1:${ENV}`;

async function redis(commands) {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '';
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';
  if (!url || !token) throw new Error('Redis is not configured');
  const r = await fetch(`${url}/pipeline`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(commands) });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error || `Redis request failed with status ${r.status}`);
  return Array.isArray(data) ? data : [];
}

// plain text only: no markup, one line each, the page draws its own separators
const cleanItems = (items) => (Array.isArray(items) ? items : String(items || '').split('\n'))
  .map((t) => String(t == null ? '' : t).replace(/[<>]/g, '').replace(/^\s*✦\s*/, '').replace(/\s+/g, ' ').trim().slice(0, 160))
  .filter(Boolean).slice(0, 12);

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const [r] = await redis([['GET', KEY]]);
      let d = null; try { d = r?.result ? JSON.parse(r.result) : null; } catch (e) {}
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=20, stale-while-revalidate=60');
      return res.status(200).json({ ok: true, items: d?.items?.length ? d.items : null, seconds: d?.seconds || null, updatedAt: d?.updatedAt || null, env: ENV });
    }
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
    if (!isAdminRequest(req)) return res.status(401).json({ ok: false, error: 'Admin authentication required' });
    const b = req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
    if (b.reset) { await redis([['DEL', KEY]]); return res.status(200).json({ ok: true, items: null, seconds: null, updatedAt: null, env: ENV }); }
    const items = cleanItems(b.items);
    if (!items.length) return res.status(400).json({ ok: false, error: 'Write at least one line' });
    const seconds = Math.round(Math.min(120, Math.max(12, Number(b.seconds) || 30)));
    const out = { items, seconds, updatedAt: new Date().toISOString() };
    await redis([['SET', KEY, JSON.stringify(out)]]);
    return res.status(200).json({ ok: true, ...out, env: ENV });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || 'Ticker failed' });
  }
}
