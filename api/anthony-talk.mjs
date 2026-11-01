// Ant-Thony talks (Nov 1): POST { kind: 'greet' | 'ask', question?, transcript?, village, place?, guestKey? }
//   greet: his once-a-day hello when a player walks up (at most once per player per UTC day; a later one answers skip)
//   ask:   a player typed a question; transcript = the last lines between them [{ who: 'me' | 'him', text }]
// -> { ok, reply, tipped?, voiceToken } (voiceToken lets /api/anthony-voice speak exactly this reply)
// His brain is the Rebel Economy's (POST /api/anthony/reply with this app's key): it knows Universe from the guide
// this site sends it (Admin Hub > Ant-Thony). Signed-in players are named by their economy account (member.userId,
// the id the points use) and he may tip them a few points (canTip): the economy pays that itself, with its caps; the
// page only shows it. Guests can talk too, without tips.
import { econCall } from './_econ.mjs';
import { asker, underLimits, firstGreetToday, voiceToken, clean, VILLAGE_NAMES } from './_anthony.mjs';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  const b = typeof req.body === 'object' && req.body ? req.body : (() => { try { return JSON.parse(req.body || '{}'); } catch (e) { return {}; } })();
  const kind = b.kind === 'greet' ? 'greet' : b.kind === 'ask' ? 'ask' : null;
  if (!kind) return res.status(400).json({ ok: false, error: 'kind must be greet or ask' });
  const village = VILLAGE_NAMES[String(b.village || '')] ? String(b.village) : null;
  if (!village) return res.status(400).json({ ok: false, error: 'Unknown village' });
  const who = asker(req, b.guestKey);
  const place = clean(b.place, 80);
  const where = `${VILLAGE_NAMES[village]}${place ? ` (${place})` : ''}`;
  const name = who.signedIn ? who.name : 'a guest';

  let body;
  if (kind === 'greet') {
    if (!(await underLimits([[`greet:site:${new Date().toISOString().slice(0, 10)}`, 1500, 86400]]))) return res.status(200).json({ ok: true, skip: true, why: 'budget' });
    if (!(await firstGreetToday(who))) return res.status(200).json({ ok: true, skip: true, why: 'today' });
    body = {
      scene: `You are walking around ${where} in Rebel Universe, the Rebel Ants' 3D world, as your own 3D character. ${who.signedIn ? name : 'A guest player'} just walked up to you. Wave and greet them with one short line in character, maybe a hint of something fun to do here. No questions back needed.`,
      member: who.signedIn ? { userId: who.userId, name, ...(who.discordId ? { discordId: who.discordId } : {}) } : undefined, short: true, spoken: true
    };
  } else {
    const question = clean(b.question, 300);
    if (question.length < 2) return res.status(400).json({ ok: false, error: 'Type a question first' });
    const ok = who.signedIn
      ? await underLimits([[`ask:${who.id}:10m`, 12, 600], [`ask:${who.id}:d`, 60, 86400], ['ask:site:d', 3000, 86400]])
      : await underLimits([[`ask:${who.id}:10m`, 6, 600], [`ask:${who.id}:d`, 20, 86400], [`ask:ip:${who.ip}:d`, 40, 86400], ['ask:site:d', 3000, 86400]]);
    if (!ok) return res.status(429).json({ ok: false, error: 'Ant-Thony needs a breather: ask again in a few minutes.' });
    const lines = (Array.isArray(b.transcript) ? b.transcript : []).slice(-10)
      .map((l) => ({ name: l?.who === 'him' ? 'Ant-Thony' : (who.signedIn ? name : 'Guest'), text: clean(l?.text, 400) })).filter((l) => l.text);
    lines.push({ name: who.signedIn ? name : 'Guest', text: question });
    body = {
      scene: `You are roaming ${where} in Rebel Universe, the Rebel Ants' 3D world, as your own 3D character. ${who.signedIn ? name : 'A guest player'} walked up to you and typed a question. Answer it as their buddy and guide to Universe: how to play, what a game or thing is, where something is, how to fix a problem. Keep it short and clear.`,
      member: who.signedIn ? { userId: who.userId, name, ...(who.discordId ? { discordId: who.discordId } : {}) } : undefined, transcript: lines.slice(-12), spoken: true, canTip: who.signedIn
    };
  }
  let r;
  try { r = await econCall('/api/anthony/reply', body, 'POST', 45000); }
  catch (e) { return res.status(e.status || 502).json({ ok: false, error: e.status === 503 ? 'Ant-Thony is not connected yet.' : 'Ant-Thony did not answer: try again.' }); }
  const d = r.data || {};
  if (!r.ok || !d.ok || !d.reply) {
    if (d.error === 'daily_cap' || r.status === 429) return res.status(429).json({ ok: false, error: 'Ant-Thony has talked all day: come back tomorrow.' });
    if (r.status === 401 || r.status === 403) return res.status(503).json({ ok: false, error: 'Ant-Thony is not connected yet.' });
    return res.status(502).json({ ok: false, error: 'Ant-Thony lost his train of thought: try again.' });
  }
  const reply = clean(d.reply, 900);
  return res.status(200).json({ ok: true, reply, ...(Number(d.tipped) > 0 ? { tipped: Math.round(Number(d.tipped)) } : {}), voiceToken: voiceToken(reply) });
}
