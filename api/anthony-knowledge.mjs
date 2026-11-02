// What Ant-Thony knows about Universe (Nov 1, admin): docs/anthony-universe-guide.txt (tools/gen-anthony-guide.mjs, at
// most 24,000 characters), deployed with this function, sent to the Rebel Economy with this app's key (POST
// /api/anthony/knowledge { text }). The economy keeps it per app key, so the dev preview (Preview key) and
// rebeluniverse.io (Production key) each send their own. Send it again whenever Universe changes.
//   GET                    -> { ok, guide: { chars, sha }, stored: { chars, at } | null, sent: { sha, chars, at } | null, current }
//   POST { action:'send' } -> { ok, chars, at }
//   POST { action:'creator' } -> his dad = the Universe account signed in in this browser; { action:'creator-clear' }
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { isAdminRequest } from './_admin-auth.mjs';
import { econCall, redis } from './_econ.mjs';
import { SITE, creator, setCreator } from './_anthony.mjs';
import { econSessionOf, isNameSession } from './_econ.mjs';

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
    const b = req.method === 'POST' ? (typeof req.body === 'object' && req.body ? req.body : (() => { try { return JSON.parse(req.body || '{}'); } catch (e) { return {}; } })()) : {};
    // his dad: the Universe account signed in in this browser (Discord or a name), or none
    if (req.method === 'POST' && b.action === 'creator') {
      const se = econSessionOf(req);
      if (!se) return res.status(400).json({ ok: false, error: 'Sign in to Universe in this browser first (Discord or your name), then press it again.' });
      const v = { u: String(se.u), d: isNameSession(se) ? null : String(se.d), name: String(se.n || se.un || '').slice(0, 64), kind: isNameSession(se) ? 'name' : 'discord', at: new Date().toISOString() };
      await setCreator(v);
      return res.status(200).json({ ok: true, creator: { name: v.name, kind: v.kind, at: v.at } });
    }
    if (req.method === 'POST' && b.action === 'creator-clear') { await setCreator(null); return res.status(200).json({ ok: true, creator: null }); }
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
    const dad = await creator(true).catch(() => null);
    return res.status(200).json({ ok: true, guide: { chars: g.chars, sha: g.sha }, stored, storedError: stored ? null : (r.data?.error || `economy ${r.status}`), sent: s, current: !!(s && s.sha === g.sha && stored && stored.chars === g.chars),
      creator: dad ? { name: dad.name, kind: dad.kind, at: dad.at } : null });
  } catch (e) { return res.status(e.status || 500).json({ ok: false, error: e.message }); }
}
