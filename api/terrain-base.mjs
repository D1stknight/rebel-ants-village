// GET /api/terrain-base?village=<id>&v=<SHA-256 of assets/village-terrain.js>
// A village's heightmap base (the seeded noise and water erosion: the slow part of its terrain, 1-4 s in a phone's
// browser) worked out here once and kept by the CDN and the browser: the address names the module's exact version, so a
// kept copy is never stale and a new version is a new address (Oct 24). The page checks the copy against the module it
// runs and otherwise works the terrain out itself, so the ground is the same to the bit either way.
// 404 for an unknown village or another module version; any other query is refused before any work.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { TERRAIN_RECIPES, heightmapBase, packHeightmapBase } from '../assets/village-terrain.js';

// the module's own bytes, as the site serves them (vercel.json includeFiles; next to this file locally)
function moduleBytes() {
  for (const f of [path.join(process.cwd(), 'assets/village-terrain.js'), path.join(path.dirname(fileURLToPath(import.meta.url)), '../assets/village-terrain.js')]) {
    try { return fs.readFileSync(f); } catch (e) {}
  }
  return null;
}
let CODE = null;
function codeHash() {
  if (CODE === null) { const b = moduleBytes(); CODE = b ? crypto.createHash('sha256').update(b).digest('hex') : ''; }
  return CODE;
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  const q = req.query || {}, keys = Object.keys(q);
  const village = String(q.village || ''), v = String(q.v || '');
  if (keys.some(k => k !== 'village' && k !== 'v') || !/^[a-z-]{2,24}$/.test(village) || !/^[0-9a-f]{64}$/.test(v)) return res.status(400).json({ ok: false, error: 'Bad request' });
  const code = codeHash();
  const recipe = Object.prototype.hasOwnProperty.call(TERRAIN_RECIPES, village) ? TERRAIN_RECIPES[village] : null;
  if (!recipe || !code || v !== code) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(404).json({ ok: false, error: !recipe ? 'No such village' : 'Another version of the terrain' });
  }
  try {
    const packed = packHeightmapBase(heightmapBase(recipe), code, village);
    if (!packed) { res.setHeader('Cache-Control', 'no-store'); return res.status(404).json({ ok: false, error: 'Nothing to send' }); }
    const body = zlib.gzipSync(Buffer.from(packed.buffer, packed.byteOffset, packed.byteLength), { level: 9, memLevel: 9 });
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable');
    return res.status(200).send(body);
  } catch (e) {
    console.error('terrain-base failed', village, e);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(500).json({ ok: false, error: 'Could not work it out' });
  }
}
