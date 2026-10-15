// NPC library: the forged NPCs Miguel approved in the NPC Forge (admin), used by the village for every NPC with that key.
//   GET                                   -> { ok, npcs: { key: entry } }   (public: the village reads it at startup)
//   POST {action:'approve', key, entry}   -> store / replace one NPC (admin)
//   POST {action:'remove', key}           -> drop one NPC (admin); placed NPCs with that key go back to placeholders
import { isAdminRequest } from './_admin-auth.mjs';

const KEY = 'npc:library:v1';
const CLEAN = /^[a-z0-9_]{2,60}$/;
const ID = /^[A-Za-z0-9_.:-]{1,120}$/;
const GLB_OK = /^(https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\/[\w./-]+\.glb|\/assets\/[\w./-]+\.glb)$/;
const IMG_OK = /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\/[\w./-]+\.(jpg|jpeg|png|webp)$/;

async function redis(commands) {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '';
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';
  if (!url || !token) throw new Error('Redis is not configured');
  const r = await fetch(`${url}/pipeline`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(commands) });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error || `Redis request failed with status ${r.status}`);
  return Array.isArray(data) ? data : [];
}

const text = (v, max) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, max);
function cleanEntry(key, e) {
  if (!e || typeof e !== 'object') throw new Error('Missing entry');
  if (!GLB_OK.test(String(e.modelUrl || ''))) throw new Error('modelUrl must be a GLB in our Blob store or /assets');
  if (e.thumbUrl && !IMG_OK.test(String(e.thumbUrl))) throw new Error('thumbUrl must be an image in our Blob store');
  const scale = Number(e.modelScale || 1.9);
  if (!Number.isFinite(scale) || scale < 0.2 || scale > 6) throw new Error('modelScale out of range');
  const out = {
    key,
    displayName: text(e.displayName, 60) || key,
    factionId: CLEAN.test(String(e.factionId || '')) ? e.factionId : (String(e.factionId || '').match(/^[a-z0-9-]{2,40}$/) ? e.factionId : null),
    role: text(e.role, 30) || 'villager',
    modelUrl: String(e.modelUrl),
    thumbUrl: e.thumbUrl || null,
    modelScale: scale,
    buildId: ID.test(String(e.buildId || '')) ? e.buildId : null,
    qa: e.qa && typeof e.qa === 'object' ? { verdict: text(e.qa.verdict, 12), reasons: Array.isArray(e.qa.reasons) ? e.qa.reasons.slice(0, 12).map((r) => text(r, 140)) : [] } : null,
    approvedAt: new Date().toISOString()
  };
  return out;
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const [r] = await redis([['HGETALL', KEY]]);
      const flat = Array.isArray(r?.result) ? r.result : [];
      const npcs = {};
      for (let i = 0; i + 1 < flat.length; i += 2) { try { npcs[flat[i]] = JSON.parse(flat[i + 1]); } catch (e) {} }
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ ok: true, npcs });
    }
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
    if (!isAdminRequest(req)) return res.status(401).json({ ok: false, error: 'Admin authentication required' });
    const b = req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
    const key = String(b.key || '');
    if (!CLEAN.test(key)) return res.status(400).json({ ok: false, error: 'key must be 2-60 of a-z 0-9 _' });
    if (b.action === 'approve') {
      const entry = cleanEntry(key, b.entry);
      await redis([['HSET', KEY, key, JSON.stringify(entry)]]);
      return res.status(200).json({ ok: true, npc: entry });
    }
    if (b.action === 'remove') {
      await redis([['HDEL', KEY, key]]);
      return res.status(200).json({ ok: true, removed: key });
    }
    return res.status(400).json({ ok: false, error: 'Unknown action' });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
}
