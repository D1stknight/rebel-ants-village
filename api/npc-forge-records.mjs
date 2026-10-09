// NPC Forge records (admin): every NPC in the NPC Forge list (name, key, collection, renders, build, rig, checks), kept
// on the server so the list is the same on any computer and survives a cleared browser.
//   GET                                   -> { ok, records: [record, ...] }   newest first
//   POST {action:'save', records:[...]}   -> store / replace records (by id)
//   POST {action:'remove', id}            -> drop one record (its build, rig and any approved NPC stay)
import { isAdminRequest } from './_admin-auth.mjs';

const KEY = 'npc:forge:v1';
const ID = /^n[a-z0-9]{3,24}$/;
const SLUG = /^[a-z0-9_]{0,60}$/;
const URL_OK = /^https:\/\/[a-z0-9.-]+\/[\w./%?=&:-]{1,600}$/;
const PHASES = new Set(['draft', 'uploading', 'building', 'sculpting', 'storing', 'rigging', 'done', 'failed']);

async function redis(commands) {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '';
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';
  if (!url || !token) throw new Error('Redis is not configured');
  const r = await fetch(`${url}/pipeline`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(commands) });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error || `Redis request failed with status ${r.status}`);
  return Array.isArray(data) ? data : [];
}

const text = (v, max) => String(v == null ? '' : v).replace(/[<>]/g, '').slice(0, max);
const url = (v) => (typeof v === 'string' && URL_OK.test(v) ? v : null);
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
// the hands panel (rigger 2.18): per hand offsets (fractions of the hand length) and size, glove / cuff colours
const fit = (o) => {
  if (!o || typeof o !== 'object') return null;
  const n = (k, lo, hi, d) => { const v = Number(o[k]); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
  return { along: n('along', -0.6, 0.6, 0), thumb: n('thumb', -0.6, 0.6, 0), back: n('back', -0.6, 0.6, 0), size: n('size', 0.6, 1.5, 1) };
};
const hex = (v) => (/^#[0-9a-f]{6}$/i.test(String(v || '')) ? String(v).toLowerCase() : null);
const handFit = (h) => (h && typeof h === 'object' ? { Left: fit(h.Left), Right: fit(h.Right), glove: hex(h.glove), cuff: hex(h.cuff) } : null);

function clean(r) {
  if (!r || typeof r !== 'object' || !ID.test(String(r.id || ''))) throw new Error('Bad record id');
  const refs = {};
  for (const s of ['front', 'back', 'left', 'right']) { const u = url(r.refs?.[s]?.url); if (u) refs[s] = { url: u }; }
  const out = {
    id: r.id, name: text(r.name, 80), key: SLUG.test(String(r.key || '')) ? String(r.key || '') : '', keyTouched: !!r.keyTouched,
    collection: SLUG.test(String(r.collection || '')) ? String(r.collection || '') : '', factionId: text(r.factionId, 40), role: text(r.role, 30),
    refs, phase: PHASES.has(r.phase) ? r.phase : 'draft', err: r.err ? text(r.err, 600) : null,
    buildId: /^[\w.:-]{1,120}$/.test(String(r.buildId || '')) ? r.buildId : null, stored: !!r.stored, approvedKey: SLUG.test(String(r.approvedKey || '')) ? r.approvedKey || null : null,
    meshy: r.meshy && typeof r.meshy === 'object' ? { p: num(r.meshy.p), glb: url(r.meshy.glb), thumb: url(r.meshy.thumb) } : null,
    rig: r.rig && typeof r.rig === 'object' ? { url: url(r.rig.url), thumb: url(r.rig.thumb), p: num(r.rig.p), step: text(r.rig.step, 40), qa: r.rig.qa && typeof r.rig.qa === 'object' ? r.rig.qa : null, ...(r.rig.handFit ? { handFit: handFit(r.rig.handFit) } : {}) } : null,
    ...(r.handFit ? { handFit: handFit(r.handFit) } : {}),
    updatedAt: num(r.updatedAt) || Date.now()
  };
  const json = JSON.stringify(out);
  if (json.length > 60000) throw new Error('Record too large');
  return [out.id, json];
}

export default async function handler(req, res) {
  if (!isAdminRequest(req)) return res.status(401).json({ ok: false, error: 'Admin authentication required' });
  try {
    if (req.method === 'GET') {
      const [r] = await redis([['HGETALL', KEY]]);
      const flat = Array.isArray(r?.result) ? r.result : []; const records = [];
      for (let i = 0; i + 1 < flat.length; i += 2) { try { records.push(JSON.parse(flat[i + 1])); } catch (e) {} }
      records.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ ok: true, records });
    }
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
    const b = req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
    if (b.action === 'save') {
      const list = (Array.isArray(b.records) ? b.records : []).slice(0, 50).map(clean);
      if (list.length) await redis([['HSET', KEY, ...list.flat()]]);
      return res.status(200).json({ ok: true, saved: list.length });
    }
    if (b.action === 'remove') {
      if (!ID.test(String(b.id || ''))) return res.status(400).json({ ok: false, error: 'Bad record id' });
      await redis([['HDEL', KEY, b.id]]);
      return res.status(200).json({ ok: true, removed: b.id });
    }
    return res.status(400).json({ ok: false, error: 'Unknown action' });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
}
