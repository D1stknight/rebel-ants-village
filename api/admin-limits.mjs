// GET  /api/admin-limits                 -> { ok, site, limits: [{ key, label, per, help, group, def, min, max, value, saved }], updatedAt }
// POST /api/admin-limits { set: { key: number | null } } | { reset: true }   (admin) -> the same
// The Admin Hub's Limits page (admin.html #limits): the per-wifi limits and Ant-Thony's daily budget (api/_limits.mjs).
// Admins only. Each site keeps its own (the live admin changes the live site's); a change reaches every function within
// 30 seconds.
import { isAdminRequest } from './_admin-auth.mjs';
import { LIMITS, LIMITS_SITE, readLimits, saveLimits } from './_limits.mjs';

const view = d => ({
  ok: true, site: LIMITS_SITE, updatedAt: d.updatedAt || null,
  limits: Object.entries(LIMITS).map(([key, x]) => ({ key, ...x, value: d.values[key], saved: d.saved[key] != null }))
});

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  let admin = false; try { admin = isAdminRequest(req); } catch (e) { admin = false; }
  if (!admin) return res.status(401).json({ ok: false, error: 'Admin login required' });
  try {
    if (req.method === 'GET') return res.status(200).json(view(await readLimits({ fresh: true })));
    if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ ok: false, error: 'Method not allowed' }); }
    let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } }
    if (!b || typeof b !== 'object') return res.status(400).json({ ok: false, error: 'Nothing to save' });
    const r = await saveLimits({ set: b.set, reset: b.reset === true, by: 'admin' });
    if (!r.ok) return res.status(400).json({ ok: false, error: r.error, bad: r.bad });
    return res.status(200).json(view(r));
  } catch (e) {
    return res.status(e.code === 'no_redis' ? 503 : 500).json({ ok: false, error: e.code === 'no_redis' ? 'Redis is not set up on this site' : e?.message || 'Limits failed' });
  }
}
