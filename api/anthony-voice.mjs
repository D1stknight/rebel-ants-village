// Ant-Thony's voice (Nov 1): POST { text, token, guestKey? } -> audio/wav, his saved voice from the Rebel Economy
// (POST /api/anthony/voice with this app's key). Only a line his brain just gave (/api/anthony-talk's voiceToken for
// exactly that text, 10 minutes), so nobody can make him say anything else. Limits per player and per site.
import { asker, underLimits, voiceTokenOk, econVoice, clean } from './_anthony.mjs';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  const b = typeof req.body === 'object' && req.body ? req.body : (() => { try { return JSON.parse(req.body || '{}'); } catch (e) { return {}; } })();
  const text = clean(b.text, 900);
  if (!text || !voiceTokenOk(text, b.token)) return res.status(403).json({ ok: false, error: 'Not a line of his' });
  const who = asker(req, b.guestKey);
  const ok = who.signedIn
    ? await underLimits([[`voice:${who.id}:10m`, 20, 600], [`voice:${who.id}:d`, 80, 86400], ['voice:site:d', 2500, 86400]])
    : await underLimits([[`voice:${who.id}:10m`, 10, 600], [`voice:${who.id}:d`, 30, 86400], [`voice:ip:${who.ip}:d`, 60, 86400], ['voice:site:d', 2500, 86400]]);
  if (!ok) return res.status(429).json({ ok: false, error: 'His voice needs a rest' });
  const v = await econVoice(text);
  if (!v.ok) return res.status(v.status).json({ ok: false, error: v.error });
  res.setHeader('Content-Type', 'audio/wav');
  if (v.ms) res.setHeader('X-Voice-Ms', v.ms);
  return res.status(200).send(v.wav);
}
