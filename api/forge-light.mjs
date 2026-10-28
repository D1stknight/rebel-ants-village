// GET /api/forge-light?rig=<a Forge rig's file in our store> -> { ok, url }: that rig's light copy for crowds (made by
// api/_forge-light.mjs the first time anyone asks, then kept; remade when the rig gets its games pack later).
//   202 { ok:false, pending:true }: another request is making it (ask again in a few seconds)
//   404 { ok:false }: it can't be made (not a Mixamo skeleton, an unreadable file); asked again after a few hours
// Public and read-mostly: every rig in the store is made at most once, so the work is bounded by the store itself; the
// making is limited per address too.
import { put } from '@vercel/blob';
import { redis } from './_wallet.mjs';
import { enforceRateLimit } from './_guard.mjs';
import { makeLight, LIGHT_VERSION } from './_forge-light.mjs';

const RIG = /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\/forge\/3d-builds\/[a-z0-9_]+\/[0-9]{1,12}\/[A-Za-z0-9_-]+_forge_rig[A-Za-z0-9_-]*\.glb$/;
const STORE = /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\//;
const KEY = (rig) => `forge:light:v${LIGHT_VERSION}:${rig}`, LOCK = (rig) => `forge:light:lock:${rig}`;
const FAILED_FOR = 6 * 3600 * 1000, MAX_BYTES = 60 * 1024 * 1024;

async function bytesOf(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(25000) });
  if (!r.ok) throw new Error('fetch ' + r.status);
  const b = new Uint8Array(await r.arrayBuffer());
  if (b.length > MAX_BYTES) throw new Error('too big');
  return b;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'GET only' });
  const rig = String(req.query?.rig || '');
  if (!RIG.test(rig)) return res.status(400).json({ ok: false, error: 'rig must be a Forge rig in our store' });
  try {
    const [cur, games] = await redis([['GET', KEY(rig)], ['GET', `forge:games:v1:${rig}`]]);
    let rec = null; try { rec = cur?.result ? JSON.parse(cur.result) : null; } catch (e) {}
    const pack = typeof games?.result === 'string' && STORE.test(games.result) ? games.result : null;
    const old = rec?.url ? rec : null, sent = (url) => { res.setHeader('Cache-Control', 'public, max-age=300'); return res.status(200).json({ ok: true, url }); };
    // made already (a games pack made since, or remade: once more with its emotes, unless that failed lately)
    if (old && (old.pack === pack || !pack || (old.packFailed === pack && Date.now() - old.packFailedAt < FAILED_FOR))) return sent(old.url);
    if (rec?.failed && rec.pack === pack && Date.now() - rec.at < FAILED_FOR) return res.status(404).json({ ok: false, error: 'no light copy for this rig' });
    if (!(await enforceRateLimit(req, res, 'forge-light', 60, 3600, 'light copies'))) return;
    const [lock] = await redis([['SET', LOCK(rig), '1', 'NX', 'EX', 90]]);
    if (lock?.result !== 'OK') return old ? sent(old.url) : res.status(202).json({ ok: false, pending: true });
    try {
      const [rigBytes, packBytes] = await Promise.all([bytesOf(rig), pack ? bytesOf(pack).catch(() => null) : null]);
      const { glb, info } = await makeLight(rigBytes, { pack: packBytes });
      const name = new URL(rig).pathname.slice(1).replace(/\.glb$/, '').replace(/^forge\/3d-builds\//, 'forge/light/') + '_light.glb';
      const url = (await put(name, Buffer.from(glb), { access: 'public', addRandomSuffix: true, contentType: 'model/gltf-binary' })).url;
      rec = { url, pack: packBytes ? pack : null, ...(pack && !packBytes ? { packFailed: pack, packFailedAt: Date.now() } : {}), v: LIGHT_VERSION, ...info, at: Date.now() };
      await redis([['SET', KEY(rig), JSON.stringify(rec)], ['DEL', LOCK(rig)]]);
      return res.status(200).json({ ok: true, url });
    } catch (e) {
      // a light copy made before stays (it only lacks the emotes)
      if (old) { await redis([['SET', KEY(rig), JSON.stringify({ ...old, packFailed: pack, packFailedAt: Date.now() })], ['DEL', LOCK(rig)]]); return sent(old.url); }
      await redis([['SET', KEY(rig), JSON.stringify({ failed: String(e?.message || e).slice(0, 200), pack, at: Date.now() }), 'EX', Math.round(FAILED_FOR / 1000)], ['DEL', LOCK(rig)]]);
      return res.status(404).json({ ok: false, error: 'no light copy for this rig' });
    }
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'light copies are not available right now' });
  }
}
