// Shared request guards for the Forge APIs (Phase 0 security hotfix):
// per-IP rate limits (Redis), URL allowlists, id validation and HTML-safe sanitizing of stored records.
import { isAdminRequest } from './_admin-auth.mjs';

function redisConfig() {
  return {
    url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '',
    token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || ''
  };
}

export function clientIp(req) {
  const fwd = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  return (fwd || String(req.headers?.['x-real-ip'] || '') || 'unknown').replace(/[^0-9a-fA-F:.]/g, '').slice(0, 64) || 'unknown';
}

// Fixed-window counter. Returns { ok, count, limit }. Admins are never limited. Fails open if Redis is down.
export async function rateLimit(req, bucket, limit, windowSec) {
  if (isAdminRequest(req)) return { ok: true, count: 0, limit, admin: true };
  const { url, token } = redisConfig();
  if (!url || !token) return { ok: true, count: 0, limit };
  const win = Math.floor(Date.now() / 1000 / windowSec);
  const key = `rl:${bucket}:${clientIp(req)}:${win}`;
  try {
    const r = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([['INCR', key], ['EXPIRE', key, windowSec + 60]])
    });
    const data = await r.json();
    const count = Number(data?.[0]?.result || 0);
    return { ok: count <= limit, count, limit };
  } catch (e) {
    return { ok: true, count: 0, limit };
  }
}

export async function enforceRateLimit(req, res, bucket, limit, windowSec, what = 'requests') {
  const rl = await rateLimit(req, bucket, limit, windowSec);
  if (rl.ok) return true;
  const hours = Math.round(windowSec / 3600);
  res.status(429).json({ ok: false, error: `Too many ${what}. Please try again ${hours >= 1 ? `in ${hours}h` : 'later'}.` });
  return false;
}

export function requireAdmin(req, res) {
  if (isAdminRequest(req)) return true;
  res.status(401).json({ ok: false, error: 'Admin authentication required' });
  return false;
}

const BLOB_HOST = /\.public\.blob\.vercel-storage\.com$/i;
const ASSET_HOSTS = [
  BLOB_HOST,
  /^assets\.meshy\.ai$/i,
  /(^|\.)meshy\.ai$/i,
  /^raw\.githubusercontent\.com$/i,
  /(^|\.)seadn\.io$/i,
  /(^|\.)openseauserdata\.com$/i,
  /(^|\.)rebelants\.io$/i,
  /^rebel-ants-village[a-z0-9-]*\.vercel\.app$/i
];

// https URL on a known asset host, no quotes/whitespace/brackets (safe to drop into HTML attributes).
export function isAllowedAssetUrl(value, { blobOnly = false } = {}) {
  if (typeof value !== 'string' || value.length > 2048 || /["'<>\s`\\]/.test(value)) return false;
  let u;
  try { u = new URL(value); } catch (e) { return false; }
  if (u.protocol !== 'https:') return false;
  if (blobOnly) return BLOB_HOST.test(u.hostname);
  if (u.hostname === 'raw.githubusercontent.com' && !u.pathname.startsWith('/D1stknight/rebel-ants-village/')) return false;
  return ASSET_HOSTS.some((re) => re.test(u.hostname));
}

// Same-origin relative asset path (e.g. /assets/character/...) or an allowed https asset URL.
export function isAllowedModelRef(value) {
  if (typeof value !== 'string') return false;
  if (/^\/?assets\/[A-Za-z0-9_./-]+\.(glb|gltf|png|jpe?g|webp)$/i.test(value) && !value.includes('..')) return true;
  if (/^\/api\/nft-image\?c=[a-z0-9_]{1,60}&t=[0-9]{1,78}&s=(thumb|full)$/.test(value)) return true;
  return isAllowedAssetUrl(value);
}

export function isCleanId(value, max = 160) {
  return typeof value === 'string' && value.length > 0 && value.length <= max && /^[A-Za-z0-9_.:-]+$/.test(value);
}

// Deep copy with every string made HTML-inert: < > become look-alike angle quotes. URLs and ids are validated separately.
export function sanitizeDeep(value, depth = 0) {
  if (depth > 12) return null;
  if (typeof value === 'string') return value.replace(/</g, '‹').replace(/>/g, '›');
  if (Array.isArray(value)) return value.slice(0, 500).map((v) => sanitizeDeep(v, depth + 1));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (!/^[A-Za-z0-9_$-]{1,80}$/.test(k)) continue;
      out[k] = sanitizeDeep(v, depth + 1);
    }
    return out;
  }
  return value;
}

// Blob pathname (no leading slash) of an allowed Blob URL, or null.
export function blobPathOf(value) {
  if (!isAllowedAssetUrl(value, { blobOnly: true })) return null;
  try { return decodeURIComponent(new URL(value).pathname.replace(/^\/+/, '')); } catch (e) { return null; }
}
