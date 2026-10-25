// The Free to play roster (Oct 20): forged characters anyone can play from the lobby (guests, wallets without a Rebel
// and holders whose own Rebels are not forged yet), with real Rebel Points when signed in. The NPC Forge's Free to play
// box ticks them.
//   GET                      -> { ok, tokens: ['262', 'chumpz:1270', ...], saved, updatedAt, env }   (public; saved false = the default)
//   POST { tokens: [...] }   -> save the roster (admin). Each one it adds needs a public forged character with a rig
//                               (the forge:active-character:v1:local_testing_wallet:<collection>:<token> record guests
//                               load); ones already on it stay while they wait for theirs (answered as waiting)
//   POST { reset: true }     -> back to the default (admin)
// An entry is a Rebel's number ('262') or, since Oct 25, a Chumpz / Saint as '<collection>:<token>' ('chumpz:1270',
// 'saints:1998'). Never #001 (the starter, always the first card; #893 joined Oct 24 with its Sept 27 rig) nor the
// Chumpz Racer (chumpz:900001: its own lobby card). Production and the previews keep their own copy (like the ticker),
// so trying a roster on a preview never changes the live lobby.
import { isAdminRequest } from './_admin-auth.mjs';
import { redis } from './_wallet.mjs';

const ENV = process.env.VERCEL_ENV === 'production' ? 'prod' : 'dev';
const KEY = `site:free-roster:v1:${ENV}`;
const COL = 'battle_for_colony';
// the friend collections forged in the Rebel Forge (assets/friend-collections.json; the lobby's FRIEND_LABELS)
const FRIENDS = { chumpz: 'Chumpz', saints: 'Saint' };
export const NEVER = new Set(['1', 'chumpz:900001']);
// the lobby's showcase until a roster is saved (index.html VILLAGE_RIGGED)
export const DEFAULT_TOKENS = ['262', '469', '1555', '4998', '1738', '3421', '609', '4722', '4', '893'];
const MAX = 40;
// '262' = Rebel #262, 'chumpz:1270' = Chumpz #1270; null when it is neither
export function parseEntry(e) {
  const s = String(e ?? '').trim();
  if (/^[1-9]\d{0,5}$/.test(s)) return { col: COL, tok: s, key: s };
  const m = /^([a-z]+):(0|[1-9]\d{0,9})$/.exec(s);
  return m && FRIENDS[m[1]] ? { col: m[1], tok: m[2], key: s } : null;
}
const label = (p) => (p.col === COL ? '#' + p.tok : `${FRIENDS[p.col]} #${p.tok}`);
const sampleKey = (p) => `forge:active-character:v1:local_testing_wallet:${p.col}:${p.tok}`;

// the guests' character for each entry, when it is a public one with a rig
async function publicRigs(entries) {
  if (!entries.length) return new Map();
  const rows = await redis(entries.map((p) => ['GET', sampleKey(p)]));
  const out = new Map();
  rows.forEach((r, i) => {
    let a = null; try { a = r?.result ? JSON.parse(r.result) : null; } catch (e) {}
    const p = entries[i];
    const rig = a && !a.walletAddress && String(a.tokenId) === p.tok && (a.collectionKey || COL) === p.col && (a.forgeRigGlbUrl || a.characterBundle?.forgeRigGlbUrl);
    if (rig) out.set(p.key, { thumb: a.forgeRigThumbUrl || a.characterBundle?.forgeRigThumbUrl || null });
  });
  return out;
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const [r] = await redis([['GET', KEY]]);
      let d = null; try { d = r?.result ? JSON.parse(r.result) : null; } catch (e) {}
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=20, stale-while-revalidate=60');
      const saved = Array.isArray(d?.tokens);
      return res.status(200).json({ ok: true, tokens: (saved ? d.tokens : DEFAULT_TOKENS).filter((t) => !NEVER.has(t)), saved, updatedAt: d?.updatedAt || null, env: ENV });
    }
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
    if (!isAdminRequest(req)) return res.status(401).json({ ok: false, error: 'Admin authentication required' });
    const b = req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
    if (b.reset) { await redis([['DEL', KEY]]); return res.status(200).json({ ok: true, tokens: DEFAULT_TOKENS, saved: false, updatedAt: null, env: ENV }); }
    const tokens = [...new Set((Array.isArray(b.tokens) ? b.tokens : []).map((t) => String(t).trim()))];
    if (tokens.length > MAX) return res.status(400).json({ ok: false, error: `At most ${MAX} on the roster` });
    const bad = tokens.filter((t) => !parseEntry(t));
    if (bad.length) return res.status(400).json({ ok: false, error: `Not a Rebel number or a Chumpz / Saint (chumpz:N, saints:N): ${bad.join(', ')}` });
    const entries = tokens.map(parseEntry);
    const never = entries.filter((p) => NEVER.has(p.key));
    if (never.length) return res.status(400).json({ ok: false, error: `${never.map(label).join(', ')} can't be on the roster (#001 is the starter, the Chumpz Racer has its own card)` });
    // Oct 25 (Miguel ticked Chumpz #1270: "No public forged character with a rig for #893"): a tick saves the whole
    // list, so only what it adds needs its public character; entries already on the roster (the saved list, or the
    // showcase while none is saved) stay and wait for theirs
    const [cur] = await redis([['GET', KEY]]);
    let was = null; try { was = cur?.result ? JSON.parse(cur.result) : null; } catch (e) {}
    const onRoster = new Set(Array.isArray(was?.tokens) ? was.tokens : DEFAULT_TOKENS);
    const rigs = await publicRigs(entries);
    const missing = entries.filter((p) => !rigs.has(p.key) && !onRoster.has(p.key));
    if (missing.length) return res.status(400).json({ ok: false, code: 'no_public_rig', missing: missing.map((p) => p.key), error: `No public forged character with a rig for ${missing.map(label).join(', ')}: make one in the Forge as admin first ("Make this my Rebel / Chumpz / Saint")` });
    const waiting = entries.filter((p) => !rigs.has(p.key)).map((p) => p.key);
    const out = { tokens, updatedAt: new Date().toISOString() };
    await redis([['SET', KEY, JSON.stringify(out)]]);
    return res.status(200).json({ ok: true, ...out, saved: true, env: ENV, ...(waiting.length ? { waiting } : {}) });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || 'Roster failed' });
  }
}
