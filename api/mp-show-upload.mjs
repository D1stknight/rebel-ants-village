// POST /api/mp-show-upload  { name, type, data (base64) }  (the Admin Hub, signed in as admin)  -> { ok, url }
// A show's audio for the Colony Stage (Antthony's set, a host's recording): an mp3 / m4a / ogg / webm / wav of 3 MB at most
// (a Vercel function takes 4.5 MB a request, and base64 adds a third: about 6 minutes of mono at 64 kbps), kept in the
// site's file store under shows/.
import { put } from '@vercel/blob';
import { isAdminRequest } from './_admin-auth.mjs';

const TYPES = { 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'm4a', 'audio/ogg': 'ogg', 'audio/webm': 'webm', 'audio/wav': 'wav', 'audio/x-wav': 'wav' };
export const config = { api: { bodyParser: { sizeLimit: '4.5mb' } } };

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false, error: 'Method not allowed' }); }
  let admin = false; try { admin = isAdminRequest(req); } catch (e) { admin = false; }
  if (!admin) return res.status(401).json({ ok: false, error: 'Admin login required' });
  let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } }
  const ext = TYPES[String(b?.type || '').toLowerCase()];
  if (!ext) return res.status(400).json({ ok: false, error: 'An mp3, m4a, ogg, webm or wav file' });
  const bytes = Buffer.from(String(b?.data || '').replace(/^data:[^;]+;base64,/, ''), 'base64');
  if (bytes.length < 1000) return res.status(400).json({ ok: false, error: 'That file is empty' });
  if (bytes.length > 3 * 1024 * 1024) return res.status(413).json({ ok: false, error: '3 MB at most (try 64 kbps mono)' });
  const slug = String(b?.name || 'show').toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'show';
  try {
    const out = await put(`shows/${slug}.${ext}`, bytes, { access: 'public', contentType: Object.keys(TYPES).find(t => TYPES[t] === ext) || 'audio/mpeg', addRandomSuffix: true, cacheControlMaxAge: 31536000 });
    return res.status(200).json({ ok: true, url: out.url, bytes: bytes.length });
  } catch (e) {
    return res.status(502).json({ ok: false, error: 'The file store did not take it' });
  }
}
