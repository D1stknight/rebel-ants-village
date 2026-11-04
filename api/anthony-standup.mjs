// Ant-Thony's stand-up set maker (Nov 2, Admin Hub > Players > Events > Set maker). Admins only.
//   GET                                                   -> { ok, styles: [{ id, label, inspiredBy }] }
//   POST { action: 'write', minutes 1-5, style?, topic? } -> { ok, set: { title, bits, minutes, style } }
//   POST { action: 'voice', text, temperature? }          -> audio/wav: one bit in his own voice (temperature 0.2-1.2: how
//                                                            much his delivery varies; the economy's default 0.5 is steady)
//   POST { action: 'sayas', list: [[written, said]...] }  -> { ok, sayAs }: how he says words (every site, every line he says)
// The writer is the Rebel Economy's (POST /api/anthony/standup: his persona and rules, the colony's week) with Universe's
// own week beside it; the voice is the economy's (POST /api/anthony/voice, his saved voice). A style is a way of telling
// jokes inspired by a comic (long stories, high energy, crowd work...): the economy never puts the comic's name, jokes or
// voice in the prompt. The Admin Hub joins the voiced bits into one MP3 for the show.
import { isAdminRequest } from './_admin-auth.mjs';
import { underLimits, econVoice, clean, sayAsList, setSayAs, SAY_AS_DEFAULT } from './_anthony.mjs';
import { daily } from './_site-stats.mjs';

const env = (k) => String(process.env[k] || '').trim();
const VILLAGES = { hub: 'the Hub', ronin: 'Ronin', samurai: 'Samurai', shogun: 'Shogun', bushi: 'Bushi', buke: 'Buke', ashigaru: 'Ashigaru', kenshi: 'Kenshi', yamabushi: 'Yamabushi', sohei: 'Sohei', wokou: 'Wokou', warrior: 'Warrior', 'cute-creepy': 'Cute & Creepy', chumpz: 'Chumpz Cove', 'saints-la': 'Saints of LA' };

async function econ(path, init = {}, ms = 175000) {
  const base = env('REBEL_ECONOMY_URL').replace(/\/+$/, ''), key = env('REBEL_ECONOMY_SERVICE_KEY');
  if (!base || !key) return { status: 503, d: { ok: false, error: 'The Rebel Economy link is not set up yet' } };
  try {
    const r = await fetch(base + path, { ...init, headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(ms) });
    const d = await r.json().catch(() => ({}));
    return { status: r.status, d };
  } catch (e) { return { status: 504, d: { ok: false, error: 'The Rebel Economy did not answer' } }; }
}

// Universe's week, for the writer (only what the site counted: no names, no accounts)
export async function universeWeek(now = Date.now()) {
  const lines = ['Rebel Universe (rebeluniverse.io) is the colony\'s 3D world in the browser: 15 villages (the Hub, the eleven faction villages and the friend villages Chumpz Cove, Saints of LA and Cute & Creepy), 157 games and puzzles, Book One\'s quests, chests and secrets, 300 badges, Antthony\'s Comedy Club in the forest west of the Hub, players walking, chatting and talking together.'];
  try {
    const w = await daily(7, now), sum = {};
    for (const d of w.days) for (const [k, v] of Object.entries(d.counts || {})) sum[k] = (sum[k] || 0) + v;
    const villages = Object.entries(sum).filter(([k]) => k.startsWith('village:')).map(([k, v]) => [k.slice(8), v]).sort((a, b) => b[1] - a[1]);
    const pts = Object.entries(sum).filter(([k]) => k.startsWith('pts:')).reduce((a, [, v]) => a + v, 0);
    const bits = [];
    if (w.week.players) bits.push(`${w.week.players} players walked around Universe this week (${w.week.signed} of them signed in)`);
    if (villages.length) bits.push(`the busiest village was ${VILLAGES[villages[0][0]] || villages[0][0]}${villages[1] ? `, then ${VILLAGES[villages[1][0]] || villages[1][0]}` : ''}`);
    if (sum.forges) bits.push(`${sum.forges} Rebels were forged into 3D characters`);
    if (sum.badges) bits.push(`${sum.badges} badges were earned`);
    if (pts) bits.push(`${pts.toLocaleString('en-US')} Rebel Points were paid for chests, games and riddles`);
    if (bits.length) lines.push('This week: ' + bits.join('; ') + '.');
  } catch (e) { /* (a set without the week's numbers is still a set) */ }
  return lines.join('\n');
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!isAdminRequest(req)) return res.status(401).json({ ok: false, error: 'Admins only' });
  if (req.method === 'GET') {
    const r = await econ('/api/anthony/standup', { method: 'GET' }, 15000);
    if (r.status === 404) return res.status(503).json({ ok: false, error: 'The Rebel Economy has no set writer for apps yet (rebel-economy-core: merge claude/standup-for-apps)' });
    const sayAs = await sayAsList(true);
    return res.status(r.d?.ok ? 200 : r.status >= 400 ? r.status : 502).json(r.d?.ok ? { ok: true, styles: r.d.styles || [], parts: !!r.d.parts, sayAs, sayAsDefault: SAY_AS_DEFAULT } : { ok: false, error: r.d?.error || 'No styles', sayAs, sayAsDefault: SAY_AS_DEFAULT });
  }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'GET or POST' });
  const b = typeof req.body === 'object' && req.body ? req.body : (() => { try { return JSON.parse(req.body || '{}'); } catch (e) { return {}; } })();
  if (b.action === 'write') {
    if (!(await underLimits([['standup:write:h', 30, 3600]]))) return res.status(429).json({ ok: false, error: 'Thirty sets an hour: try again in a while' });
    const minutes = Math.max(1, Math.min(5, Math.round(+b.minutes || 3)));
    const body = { minutes, extra: (await universeWeek()).slice(0, 3000) };
    const style = clean(b.style, 40), topic = clean(b.topic, 300);
    if (style) body.style = style;
    if (topic) body.topic = topic;
    const r = await econ('/api/anthony/standup', { method: 'POST', body: JSON.stringify(body) });
    if (r.status === 404) return res.status(503).json({ ok: false, error: 'The Rebel Economy has no set writer for apps yet (rebel-economy-core: merge claude/standup-for-apps)' });
    if (!r.d?.ok || !r.d.set) {
      const why = { no_ai_key: 'The economy has no AI key set', budget: 'The economy\'s AI budget for today is used up', platform_only: 'This site\'s economy key may not write sets' }[r.d?.error] || r.d?.error || 'No set came back';
      return res.status(r.status >= 400 ? r.status : 502).json({ ok: false, error: why });
    }
    const s = r.d.set, bits = (Array.isArray(s.bits) ? s.bits : []).map((x) => clean(x, 900)).filter(Boolean).slice(0, 60);
    return res.status(200).json({ ok: true, set: { title: clean(s.title, 80) || 'Live at the Comedy Club', bits, minutes, style: s.style || style || null } });
  }
  if (b.action === 'voice') {
    const text = clean(b.text, 900);
    if (!text) return res.status(400).json({ ok: false, error: 'Nothing to say' });
    if (!(await underLimits([['standup:voice:d', 400, 86400]]))) return res.status(429).json({ ok: false, error: 'His voice needs a rest (400 lines a day for sets)' });
    const v = await econVoice(text, 120000, { temperature: +b.temperature || undefined });
    if (!v.ok) return res.status(v.status).json({ ok: false, error: v.error });
    res.setHeader('Content-Type', 'audio/wav');
    return res.status(200).send(v.wav);
  }
  if (b.action === 'sayas') {
    try { return res.status(200).json({ ok: true, sayAs: await setSayAs(b.list) }); }
    catch (e) { return res.status(503).json({ ok: false, error: 'Could not save the list' }); }
  }
  return res.status(400).json({ ok: false, error: 'Unknown action' });
}
