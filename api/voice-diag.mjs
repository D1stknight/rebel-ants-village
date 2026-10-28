// POST /api/voice-diag   (dev previews only: production answers 404)
// A phone's voice report (assets/village-voice.js report(), Oct 28): its audio and voice state every few seconds while
// voice is on, so a real iPhone test says what the phone did (audio contexts, audio session, microphone, connections,
// packets and audio levels in and out). One log line per report in the runtime logs ("[voice-diag]"), nothing kept.
// No names or account ids: a random id per page load.
const seen = new Map(); // caller -> [window start, count] (one instance's count: enough for a few phones on a preview)

export default async function handler(req, res) {
  if (process.env.VERCEL_ENV === 'production') return res.status(404).end();
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).end(); }
  const who = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'x', now = Date.now(), w = seen.get(who);
  if (!w || now - w[0] > 60000) seen.set(who, [now, 1]); else if (++w[1] > 40) return res.status(429).end();
  if (seen.size > 500) seen.clear();
  let raw = typeof req.body === 'string' ? req.body : req.body && typeof req.body === 'object' ? JSON.stringify(req.body) : '';
  if (!raw) for await (const c of req) { raw += c; if (raw.length > 8000) break; }
  if (raw.length > 8000) return res.status(413).end();
  let d = null; try { d = JSON.parse(raw); } catch (e) {}
  if (!d || typeof d !== 'object' || typeof d.pid !== 'string' || d.pid.length > 16) return res.status(400).end();
  console.log('[voice-diag] ' + JSON.stringify(d).slice(0, 6000));
  return res.status(204).end();
}
