// The story save (assets/story-save.js): the signed-in player's story, kept under their Rebel Economy account.
//   GET  -> { ok, signedIn, account, story: { keys, t } | null, ver, at }
//   POST { story: { keys, t }, replace? } -> { ok, account, story, ver, at, changed }
// account = the economy's id of the signed-in player (a device remembers whose story it holds).
// A POST is merged into the saved story (two devices' progress combine; nothing done is lost), or replaces it when the
// player started over on purpose (replace: an admin reset). One story per account and site: production saves on
// rebeluniverse.io, previews under their own key (a test on the dev preview never changes the live story). Guests (no
// ra_econ session) get 401: their story stays in their browser.
import { enforceRateLimit } from './_guard.mjs';
import { econSessionOf, redis } from './_econ.mjs';
import { mergeStory, cleanStory, storySize, canonical } from '../assets/story-save.js';

const SITE = process.env.VERCEL_ENV === 'production' ? 'prod' : 'dev';
const KEY = (u) => `story:v1:${SITE}:${u}`, VER = (u) => `story:v1:${SITE}:${u}:ver`;
const KEEP = 60 * 60 * 24 * 400;   // a story nobody played for 400 days goes
// write only if nobody wrote since this request read the story (two devices at once: the second merges again)
const CAS = `if (tonumber(redis.call('GET', KEYS[2]) or '0') ~= tonumber(ARGV[1])) then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3]) redis.call('SET', KEYS[2], ARGV[1] + 1, 'EX', ARGV[3]) return 1`;

async function readStory(u) {
  const [data, ver] = await redis([['GET', KEY(u)], ['GET', VER(u)]]);
  let doc = null; try { doc = data?.result ? JSON.parse(data.result) : null; } catch (e) { doc = null; }
  return { story: doc?.keys ? { keys: doc.keys, t: doc.t || {} } : null, at: doc?.at || null, ver: Number(ver?.result || 0) };
}
const same = (a, b) => !!a && !!b && Object.keys({ ...a.keys, ...b.keys }).every((k) => {
  const x = a.keys[k] ?? null, y = b.keys[k] ?? null; if (x === y) return true;
  try { return canonical(JSON.parse(x)) === canonical(JSON.parse(y)); } catch (e) { return false; } });

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const s = econSessionOf(req);
    if (!s) return res.status(401).json({ ok: false, signedIn: false, error: 'Sign in to keep your story on your account' });
    if (req.method === 'GET') {
      if (!(await enforceRateLimit(req, res, `story-get:${s.u}`, 240, 3600, 'story reads'))) return;
      const cur = await readStory(s.u);
      return res.status(200).json({ ok: true, signedIn: true, account: s.u, ...cur });
    }
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
    if (!(await enforceRateLimit(req, res, `story-put:${s.u}`, 480, 3600, 'story saves'))) return;
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const incoming = cleanStory(body.story);
    if (!incoming) return res.status(400).json({ ok: false, error: 'That story save is not readable or too big' });
    for (let tries = 0; tries < 4; tries++) {
      const cur = await readStory(s.u);
      const next = body.replace === true || !cur.story ? incoming : mergeStory(cur.story, incoming);
      if (cur.story && same(cur.story, next)) return res.status(200).json({ ok: true, account: s.u, story: cur.story, ver: cur.ver, at: cur.at, changed: false });
      const at = Date.now(), doc = JSON.stringify({ keys: next.keys, t: next.t, at });
      const [w] = await redis([['EVAL', CAS, 2, KEY(s.u), VER(s.u), cur.ver, doc, KEEP]]);
      if (Number(w?.result) === 1) return res.status(200).json({ ok: true, account: s.u, story: next, ver: cur.ver + 1, at, changed: true, size: storySize(next) });
    }
    return res.status(409).json({ ok: false, error: 'The story changed on another device: try again', retry: true });
  } catch (e) {
    console.error('[story-save]', e.message);
    return res.status(e.status || 500).json({ ok: false, error: e.message || 'The story did not save', retry: true });
  }
}
