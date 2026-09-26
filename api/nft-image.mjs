// GET /api/nft-image?c=battle_for_colony&t=4998&s=thumb|full
// Lazy image cache: the first request for a token copies its image into our Blob store as WebP
// (thumb 512px, full 1024px); every later request is a redirect to that copy. Only tokens players use get stored.
import { put } from '@vercel/blob';
import sharp from 'sharp';
import { enforceRateLimit } from './_guard.mjs';
import { getToken, isTokenId, redis } from './_nft.mjs';
import { getCollection } from './_collections.mjs';

const SIZES = { thumb: { px: 512, q: 82 }, full: { px: 1024, q: 88 } };
const MAX_BYTES = 25 * 1024 * 1024;

function isPublicHttps(u) {
  try {
    const x = new URL(u);
    const h = x.hostname.toLowerCase();
    return x.protocol === 'https:' && h.includes('.') && h !== 'localhost' && !/^[0-9.]+$/.test(h) && !h.includes(':') &&
      !h.endsWith('.local') && !h.endsWith('.internal');
  } catch (e) { return false; }
}

async function fetchImage(url) {
  if (!isPublicHttps(url)) throw new Error('bad source');
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { accept: 'image/*' } });
    if (!r.ok) throw new Error('source ' + r.status);
    const len = Number(r.headers.get('content-length') || 0);
    if (len > MAX_BYTES) throw new Error('source too large');
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > MAX_BYTES) throw new Error('source too large');
    return buf;
  } finally {
    clearTimeout(timer);
  }
}

function redirect(res, url) {
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, immutable');
  res.statusCode = 302;
  res.setHeader('Location', url);
  return res.end();
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  const c = String(req.query?.c || 'battle_for_colony');
  const t = String(req.query?.t || '');
  const s = SIZES[req.query?.s] ? String(req.query.s) : 'full';
  const col = getCollection(c);
  if (!col || !isTokenId(t)) return res.status(400).json({ ok: false, error: 'Invalid collection or token' });

  const indexKey = `nft:img:v1:${col.key}:${t}:${s}`;
  const [hit] = await redis([['GET', indexKey]]);
  if (hit?.result) return redirect(res, hit.result);

  // Cache miss: fill it (rate limited, since it downloads + resizes).
  if (!(await enforceRateLimit(req, res, 'nft-img-fill', 300, 3600, 'image requests'))) return;
  let token;
  try {
    token = await getToken(col.key, t);
  } catch (e) {
    return res.status(502).json({ ok: false, error: 'NFT lookup unavailable' });
  }
  for (const src of token.sourceImages || []) {
    try {
      const raw = await fetchImage(src);
      const { px, q } = SIZES[s];
      const webp = await sharp(raw, { animated: false, limitInputPixels: 80e6 })
        .resize(px, px, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: q })
        .toBuffer();
      const blob = await put(`nft/${col.key}/${t}_${s}.webp`, webp, {
        access: 'public',
        contentType: 'image/webp',
        addRandomSuffix: false,
        allowOverwrite: true,
        cacheControlMaxAge: 31536000
      });
      await redis([['SET', indexKey, blob.url]]);
      return redirect(res, blob.url);
    } catch (e) {
      console.warn('nft-image source failed:', src, e.message);
    }
  }
  // Nothing worked: send the browser to the best original so the card still shows something.
  const fallback = (token.sourceImages || []).find(isPublicHttps);
  if (fallback) {
    res.setHeader('Cache-Control', 'no-store');
    res.statusCode = 302;
    res.setHeader('Location', fallback);
    return res.end();
  }
  return res.status(404).json({ ok: false, error: 'No image' });
}
