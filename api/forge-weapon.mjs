// Weapons (Sept 29). The collection has 6 weapons, worn on the back in the NFT art ("-2" = the other shoulder).
// Each is modelled once (image -> Meshy 3D), approved by Miguel, then worn by every Rebel on its back, riding the
// Spine2 bone. The Rebel's own weapon trait is pre-picked; the holder can swap to any of the 6.
//
// Public:
//   GET ?action=catalog                       -> the approved weapons (id, name, glbUrl, mount) for the Forge + village
//   GET ?action=choice&tokenId=N              -> the holder's pick for this Rebel (or null = use the NFT trait)
//   POST {action:'choose', tokenId, weaponId} -> holder (or admin) picks the Rebel's weapon ('none' allowed)
// Admin (weapon studio, spends image + Meshy credits):
//   POST {action:'ref', weaponId, tokenIds[], notes?}  -> reference image of the weapon alone (from NFT art)
//   POST {action:'mesh', weaponId, imageUrl}           -> Meshy image-to-3D
//   POST {action:'status', weaponId}                   -> poll Meshy; stores the GLB in our Blob when done
//   POST {action:'optimize', weaponId}                 -> 512 px WebP textures, pruned: the file players load (glbUrl)
//   POST {action:'set', weaponId, patch}               -> edit the record (mount, approved, glbUrl...)
//   GET  ?action=studio                                -> every record, approved or not
import { put } from '@vercel/blob';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { textureCompress, prune, dedup } from '@gltf-transform/functions';
import sharp from 'sharp';
import { isAdminRequest } from './_admin-auth.mjs';
import { enforceRateLimit } from './_guard.mjs';
import { forgeImageEdit, fetchImageAsDataUrl } from './_forge-image.mjs';
import { redis, walletOf, ownerOf } from './_wallet.mjs';

export const WEAPONS = {
  celestial_fang: { name: 'Celestial Fang', trait: 'Celestial-Fang', hilt: 'R', look: 'a PAIR of short swords (twin ninjato) in dark scabbards, hilts wrapped in green cord, carried crossed together' },
  dawns_light_arrows: { name: "Dawn's Light Arrows", trait: "Dawn's-Light-Arrows", hilt: 'R', look: 'a quiver full of black-fletched arrows' },
  eclipse_edge: { name: 'Eclipse Edge', trait: 'Eclipse-Edge', hilt: 'R', look: 'a single katana in a black scabbard, black wrapped hilt with a dark round guard' },
  soulrender: { name: 'Soulrender', trait: 'Soulrender', hilt: 'L', look: 'a single sword in a dark red-brown scabbard' },
  stormbringer_blade: { name: 'Stormbringer Blade', trait: 'Stormbringer-Blade', hilt: 'L', look: 'a katana in a dark red scabbard with a grey wrapped hilt' },
  whisper_of_dawn: { name: 'Whisper of Dawn', trait: 'Whisper-of-Dawn', hilt: 'L', look: 'a katana in a blue scabbard with a dark wrapped hilt' }
};
// Drawn props (Sept 29, weapon moves): what the Rebel holds when the weapon is out. Made in the same studio, from the
// weapon's own reference image. Katanas: the bare blade in the right hand (the scabbard model hides meanwhile);
// Celestial Fang: one short sword in each hand; Dawn's Light Arrows: a bow in the left hand.
const DRAWN = (what) => `the SAME weapon as in the image, now DRAWN and held ready: ${what}. Bare, clean blade edge; same hilt, wrap, guard and colours as the image. No scabbard.`;
export const PROPS = {
  eclipse_edge_drawn: { name: 'Eclipse Edge (drawn)', base: 'eclipse_edge', look: DRAWN('the katana out of its black scabbard') },
  soulrender_drawn: { name: 'Soulrender (drawn)', base: 'soulrender', look: DRAWN('the sword out of its red-brown scabbard') },
  stormbringer_blade_drawn: { name: 'Stormbringer Blade (drawn)', base: 'stormbringer_blade', look: DRAWN('the katana out of its dark red scabbard') },
  whisper_of_dawn_drawn: { name: 'Whisper of Dawn (drawn)', base: 'whisper_of_dawn', look: DRAWN('the katana out of its blue scabbard') },
  celestial_fang_drawn: { name: 'Celestial Fang (one drawn blade)', base: 'celestial_fang', look: DRAWN('ONLY ONE of the twin short swords, out of its scabbard (a single short straight sword)') },
  dawns_light_bow: { name: "Dawn's Light Bow", base: 'dawns_light_arrows', look: 'a strung longbow that belongs with this quiver: same wood, colours, wraps and fittings, a recurve samurai-style bow, bowstring drawn thin and straight, no arrows' }
};
// which prop goes in which hand when drawn
export const HELD = {
  eclipse_edge: { right: 'eclipse_edge_drawn' }, soulrender: { right: 'soulrender_drawn' }, stormbringer_blade: { right: 'stormbringer_blade_drawn' },
  whisper_of_dawn: { right: 'whisper_of_dawn_drawn' }, celestial_fang: { right: 'celestial_fang_drawn', left: 'celestial_fang_drawn' }, dawns_light_arrows: { left: 'dawns_light_bow' }
};
const ALL = { ...WEAPONS, ...PROPS };
// NFT trait value -> { weaponId, side of the hilt (the character's own left / right shoulder) }
export function weaponForTrait(value) {
  const v = String(value || '');
  const base = v.replace(/-2$/, '');
  const id = Object.keys(WEAPONS).find((k) => WEAPONS[k].trait === base);
  if (!id) return null;
  const hilt = WEAPONS[id].hilt;
  return { weaponId: id, hilt: /-2$/.test(v) ? (hilt === 'R' ? 'L' : 'R') : hilt };
}

const K = (id) => `forge:weapon:v1:${id}`;
const CK = (c, t) => `forge:weapon-choice:v1:${c}:${t}`;
const MESHY = 'https://api.meshy.ai/openapi/v1/image-to-3d';
const DEFAULT_MOUNT = { bone: 'Spine2', pos: [0, -0.02, -0.16], rot: [0, 0, 38], scale: 1 };   // behind the upper back, hilt over a shoulder

async function getRec(id) { const [r] = await redis([['GET', K(id)]]); try { return r?.result ? JSON.parse(r.result) : null; } catch (e) { return null; } }
async function setRec(id, rec) { await redis([['SET', K(id), JSON.stringify(rec)]]); return rec; }

// the stored NFT image of a token (the nft-image route redirects to our Blob copy), called in-process
async function nftImageUrl(tokenId) {
  const mod = await import('./nft-image.mjs');
  return new Promise((resolve) => {
    const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, status(c) { this.statusCode = c; return this; },
      end() { resolve(this.headers.location || null); }, send() { resolve(this.headers.location || null); }, json() { resolve(this.headers.location || null); } };
    Promise.resolve(mod.default({ method: 'GET', query: { c: 'battle_for_colony', t: String(tokenId), s: 'full' }, headers: {} }, res)).then(() => resolve(res.headers.location || null)).catch(() => resolve(null));
  });
}

function refPrompt(w, notes) {
  return `
The images are NFT portraits of Rebel Ants characters. Each one carries the SAME weapon on its back, seen behind the shoulder: ${w.look}.
Draw ONLY that weapon, alone, as a clean product reference for a 3D modelling pipeline:
- the whole weapon, full length, nothing cut off, exactly the shapes, colours, wraps and details of the reference images
- carried form: blades stay in their scabbards; arrows stay in their quiver
- laid out horizontally across the image, seen straight from the side, centred, filling about 80 % of the width
- plain light-grey background, soft even lighting, no shadows on the background
- same hand-drawn, bold-outline cartoon style as the NFT art, but as a clean single object
No character, no hands, no ants, no text, no second copy.
${notes ? '\n' + notes : ''}`.trim();
}

function propPrompt(w, notes) {
  return `
The image is a clean product reference of a Rebel Ants weapon. Draw ${w.look}.
Draw ONLY that one object, alone, as a clean product reference for a 3D modelling pipeline:
- the whole object, full length, nothing cut off, in the same colours, materials and hand-drawn bold-outline cartoon style as the image
- laid out horizontally across the image, seen straight from the side, centred, filling about 80 % of the width
- plain light-grey background, soft even lighting, no shadows on the background
No character, no hands, no text, no second copy.
${notes ? '\n' + notes : ''}`.trim();
}

function body(req) { if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (e) { return {}; } } return req.body || {}; }

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const b = body(req);
  const action = String(req.query?.action || b.action || '');
  const admin = isAdminRequest(req);
  try {
    // ---- public ----
    if (req.method === 'GET' && action === 'catalog') {
      const ids = Object.keys(WEAPONS), pids = Object.keys(PROPS);
      const rs = await redis(ids.concat(pids).map((id) => ['GET', K(id)]));
      const recs = {}; ids.concat(pids).forEach((id, i) => { try { recs[id] = rs[i]?.result ? JSON.parse(rs[i].result) : null; } catch (e) { recs[id] = null; } });
      const ok = (id) => (recs[id] && recs[id].approved && recs[id].glbUrl ? recs[id] : null);
      const heldOf = (id) => { const h = {}; for (const [hand, pid] of Object.entries(HELD[id] || {})) { const r = ok(pid); if (r) h[hand] = { id: pid, glbUrl: r.glbUrl, grip: r.grip || null }; } return Object.keys(h).length ? h : null; };
      const list = ids.map((id) => { const r = ok(id); return r ? { id, name: WEAPONS[id].name, trait: WEAPONS[id].trait, hilt: WEAPONS[id].hilt, glbUrl: r.glbUrl, thumbUrl: r.refUrl || null, mount: r.mount || DEFAULT_MOUNT, held: heldOf(id) } : null; }).filter(Boolean);
      res.setHeader('Cache-Control', 'public, max-age=60');
      return res.status(200).json({ ok: true, weapons: list });
    }
    if (req.method === 'GET' && action === 'choice') {
      const t = String(req.query?.tokenId || ''), c = String(req.query?.collectionKey || 'battle_for_colony');
      if (!/^\d{1,78}$/.test(t)) return res.status(400).json({ ok: false, error: 'Missing tokenId' });
      const [r] = await redis([['GET', CK(c, t)]]);
      let v = null; try { v = r?.result ? JSON.parse(r.result) : null; } catch (e) {}
      return res.status(200).json({ ok: true, choice: v });
    }
    if (req.method === 'POST' && action === 'choose') {
      if (!(await enforceRateLimit(req, res, 'weapon-choose', 60, 3600, 'weapon changes'))) return;
      const t = String(b.tokenId || ''), c = String(b.collectionKey || 'battle_for_colony');
      const weaponId = String(b.weaponId || '');
      if (!/^\d{1,78}$/.test(t)) return res.status(400).json({ ok: false, error: 'Missing tokenId' });
      if (weaponId !== 'none' && !WEAPONS[weaponId]) return res.status(400).json({ ok: false, error: 'Unknown weapon' });
      const hilt = ['L', 'R'].includes(b.hilt) ? b.hilt : (WEAPONS[weaponId]?.hilt || 'R');
      if (!admin) {
        const wallet = walletOf(req);
        if (!wallet) return res.status(401).json({ ok: false, error: 'Sign in with your wallet to choose a weapon', code: 'wallet_required' });
        const owner = await ownerOf(c, t);
        if (!owner || owner !== wallet) return res.status(403).json({ ok: false, error: 'Only the wallet that holds this Rebel can choose its weapon', code: 'not_owner' });
      }
      const choice = { weaponId, hilt, at: new Date().toISOString() };
      await redis([['SET', CK(c, t), JSON.stringify(choice)]]);
      return res.status(200).json({ ok: true, choice });
    }

    // ---- admin: weapon studio ----
    if (!admin) return res.status(401).json({ ok: false, error: 'Admin only' });
    if (req.method === 'GET' && action === 'studio') {
      const ids = Object.keys(WEAPONS);
      const rs = await redis(ids.map((id) => ['GET', K(id)]));
      return res.status(200).json({ ok: true, weapons: ids.map((id, i) => { let r = null; try { r = rs[i]?.result ? JSON.parse(rs[i].result) : null; } catch (e) {} return { id, ...WEAPONS[id], rec: r }; }) });
    }
    const id = String(b.weaponId || '');
    if (!ALL[id]) return res.status(400).json({ ok: false, error: 'Unknown weaponId' });
    const w = ALL[id];
    let rec = (await getRec(id)) || { id, name: w.name, mount: DEFAULT_MOUNT, approved: false, history: [] };

    if (action === 'ref') {
      const apiKey = process.env.OPENAI_API_KEY;
      const toks = (Array.isArray(b.tokenIds) ? b.tokenIds : []).map(String).filter((x) => /^\d{1,5}$/.test(x)).slice(0, 3);
      // a drawn prop starts from its weapon's own approved reference image
      const baseRef = w.base ? (await getRec(w.base))?.refUrl : null;
      if (w.base && !baseRef) return res.status(400).json({ ok: false, error: 'Make the base weapon first' });
      if (!w.base && !toks.length) return res.status(400).json({ ok: false, error: 'tokenIds (1-3 Rebels with this weapon) needed' });
      const urls = w.base ? [baseRef] : (await Promise.all(toks.map(nftImageUrl))).filter(Boolean);
      if (!urls.length) return res.status(502).json({ ok: false, error: 'Could not load the NFT images' });
      const images = await Promise.all(urls.map(fetchImageAsDataUrl));
      const { imageBase64, imageModel } = await forgeImageEdit({ apiKey, prompt: w.base ? propPrompt(w, String(b.notes || '')) : refPrompt(w, String(b.notes || '')), images, size: '1536x1024' });
      const blob = await put(`forge/weapons/${id}_ref_${Date.now()}.png`, Buffer.from(imageBase64, 'base64'), { access: 'public', contentType: 'image/png', addRandomSuffix: true });
      rec = { ...rec, refUrl: blob.url, refModel: imageModel, refFrom: toks, history: [...(rec.history || []), { refUrl: blob.url, at: new Date().toISOString() }].slice(-12) };
      await setRec(id, rec);
      return res.status(200).json({ ok: true, rec });
    }
    if (action === 'mesh') {
      const imageUrl = String(b.imageUrl || rec.refUrl || '');
      if (!/^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\//.test(imageUrl)) return res.status(400).json({ ok: false, error: 'imageUrl must be our Blob' });
      const r = await fetch(MESHY, { method: 'POST', headers: { Authorization: `Bearer ${process.env.MESHY_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: imageUrl, ai_model: 'meshy-6', should_texture: true, enable_pbr: false, should_remesh: true, topology: 'triangle', target_polycount: Number(b.polycount || 24000), symmetry_mode: ['off', 'auto', 'on'].includes(b.symmetry) ? b.symmetry : 'auto', target_formats: ['glb'] }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.result) return res.status(502).json({ ok: false, error: j.message || `Meshy ${r.status}` });
      rec = { ...rec, taskId: j.result, meshImageUrl: imageUrl, meshStatus: 'PENDING', meshStartedAt: new Date().toISOString() };
      await setRec(id, rec);
      return res.status(200).json({ ok: true, rec });
    }
    if (action === 'status') {
      if (!rec.taskId) return res.status(400).json({ ok: false, error: 'No Meshy task' });
      const r = await fetch(`${MESHY}/${encodeURIComponent(rec.taskId)}`, { headers: { Authorization: `Bearer ${process.env.MESHY_API_KEY}` } });
      const j = await r.json().catch(() => ({}));
      rec.meshStatus = j.status || rec.meshStatus; rec.meshProgress = j.progress ?? rec.meshProgress; rec.meshThumb = j.thumbnail_url || rec.meshThumb || null;
      const glb = j.model_urls?.glb;
      if (String(j.status).toUpperCase() === 'SUCCEEDED' && glb && rec.meshTaskStored !== rec.taskId) {
        const g = await fetch(glb); const buf = Buffer.from(await g.arrayBuffer());
        const blob = await put(`forge/weapons/${id}_${rec.taskId}.glb`, buf, { access: 'public', contentType: 'model/gltf-binary', addRandomSuffix: true });
        rec.rawGlbUrl = blob.url; rec.meshTaskStored = rec.taskId; rec.rawBytes = buf.length;
      }
      await setRec(id, rec);
      return res.status(200).json({ ok: true, rec });
    }
    if (action === 'optimize') {
      const src = String(b.glbUrl || rec.rawGlbUrl || '');
      if (!/^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\//.test(src)) return res.status(400).json({ ok: false, error: 'No stored GLB to optimize' });
      const input = new Uint8Array(await (await fetch(src)).arrayBuffer());
      const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
      const doc = await io.readBinary(input);
      await doc.transform(dedup(), prune(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [Number(b.texture || 512), Number(b.texture || 512)], quality: 82 }));
      const outBytes = Buffer.from(await io.writeBinary(doc));
      const blob = await put(`forge/weapons/${id}_opt.glb`, outBytes, { access: 'public', contentType: 'model/gltf-binary', addRandomSuffix: true });
      rec = { ...rec, glbUrl: blob.url, glbBytes: outBytes.length, optimizedFrom: src };
      await setRec(id, rec);
      return res.status(200).json({ ok: true, rec, bytes: { in: input.length, out: outBytes.length } });
    }
    if (action === 'set') {
      const p = b.patch || {};
      for (const k of ['glbUrl', 'approved', 'mount', 'notes', 'grip']) if (k in p) rec[k] = p[k];
      if (rec.glbUrl && !/^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\//.test(rec.glbUrl)) return res.status(400).json({ ok: false, error: 'glbUrl must be our Blob' });
      await setRec(id, rec);
      return res.status(200).json({ ok: true, rec });
    }
    return res.status(400).json({ ok: false, error: 'Unknown action' });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || 'Weapon request failed' });
  }
}
