// What Ant-Thony knows about Universe (Nov 1, admin): docs/anthony-universe-guide.txt (tools/gen-anthony-guide.mjs, at
// most 24,000 characters), deployed with this function, sent to the Rebel Economy with this app's key (POST
// /api/anthony/knowledge { text }). The economy keeps it per app key, so the dev preview (Preview key) and
// rebeluniverse.io (Production key) each send their own. Send it again whenever Universe changes.
//   GET                    -> { ok, guide: { chars, sha }, stored: { chars, at } | null, sent: { sha, chars, at } | null, current }
//   POST { action:'send' } -> { ok, chars, at }
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { isAdminRequest } from './_admin-auth.mjs';
import { econCall, redis } from './_econ.mjs';
import { SITE } from './_anthony.mjs';

const SENT = `anthony:guide:sent:v1:${SITE}`;
const FILE = 'docs/anthony-universe-guide.txt';
async function guide() {
  // (the deploy's own copy: vercel.json includeFiles; the working folder first, then beside this file)
  const text = await fs.readFile(path.join(process.cwd(), FILE), 'utf8').catch(() => fs.readFile(new URL('../' + FILE, import.meta.url), 'utf8'));
  return { text, chars: text.length, sha: crypto.createHash('sha256').update(text).digest('hex').slice(0, 16) };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!isAdminRequest(req)) return res.status(401).json({ ok: false, error: 'Admin only' });
  let g;
  try { g = await guide(); } catch (e) { return res.status(500).json({ ok: false, error: 'The guide file is not in this deploy' }); }
  try {
    if (req.method === 'POST') {
      const r = await econCall('/api/anthony/knowledge', { text: g.text }, 'POST', 20000);
      if (!r.ok || !r.data?.ok) return res.status(r.status === 403 ? 403 : 502).json({ ok: false, error: r.data?.error || r.data?.message || `The economy answered ${r.status}` });
      const sent = { sha: g.sha, chars: r.data.chars, at: r.data.at || new Date().toISOString() };
      try { await redis([['SET', SENT, JSON.stringify(sent)]]); } catch (e) {}
      return res.status(200).json({ ok: true, ...sent });
    }
    if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'GET or POST' });
    const [r, s] = await Promise.all([econCall('/api/anthony/knowledge', null, 'GET', 10000).catch((e) => ({ ok: false, status: e.status || 502, data: {} })),
      redis([['GET', SENT]]).then((x) => { try { return x?.[0]?.result ? JSON.parse(x[0].result) : null; } catch (e) { return null; } }).catch(() => null)]);
    const stored = r.ok && r.data?.ok ? { chars: r.data.chars || 0, at: r.data.at || null, app: r.data.app || null } : null;
    return res.status(200).json({ ok: true, guide: { chars: g.chars, sha: g.sha }, stored, storedError: stored ? null : (r.data?.error || `economy ${r.status}`), sent: s, current: !!(s && s.sha === g.sha && stored && stored.chars === g.chars) });
  } catch (e) { return res.status(e.status || 500).json({ ok: false, error: e.message }); }
}
