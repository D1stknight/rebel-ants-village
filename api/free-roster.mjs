// The Free to play roster (Oct 20): forged Rebels anyone can play from the lobby (guests, wallets without a Rebel and
// holders whose own Rebels are not forged yet), with real Rebel Points when signed in. The NPC Forge's Rebels list
// ticks them.
//   GET                      -> { ok, tokens: ['262', ...], saved, updatedAt, env }   (public; saved false = the default)
//   POST { tokens: [...] }   -> save the roster (admin). Each Rebel needs a public forged character with a rig (the
//                               forge:active-character:v1:local_testing_wallet:<collection>:<token> record guests load)
//   POST { reset: true }     -> back to the default (admin)
// Never #001 (the starter, always the first card; #893 joined Oct 24 with its Sept 27 rig). Production and the
// previews keep their own copy (like the ticker), so trying a roster on a preview never changes the live lobby.
import { isAdminRequest } from './_admin-auth.mjs';
import { redis } from './_wallet.mjs';

const ENV = process.env.VERCEL_ENV === 'production' ? 'prod' : 'dev';
const KEY = `site:free-roster:v1:${ENV}`;
const COL = 'battle_for_colony';
export const NEVER = new Set(['1']);
// the lobby's showcase until a roster is saved (index.html VILLAGE_RIGGED)
export const DEFAULT_TOKENS = ['262', '469', '1555', '4998', '1738', '3421', '609', '4722', '4', '893'];
const MAX = 40;
const sampleKey = (tok) => `forge:active-character:v1:local_testing_wallet:${COL}:${tok}`;

// the guests' character for a Rebel, when it is a public one with a rig
async function publicRigs(tokens) {
  if (!tokens.length) return new Map();
  const rows = await redis(tokens.map((t) => ['GET', sampleKey(t)]));
  const out = new Map();
  rows.forEach((r, i) => {
    let a = null; try { a = r?.result ? JSON.parse(r.result) : null; } catch (e) {}
    const rig = a && !a.walletAddress && String(a.tokenId) === tokens[i] && (a.forgeRigGlbUrl || a.characterBundle?.forgeRigGlbUrl);
    if (rig) out.set(tokens[i], { thumb: a.forgeRigThumbUrl || a.characterBundle?.forgeRigThumbUrl || null });
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
    if (tokens.length > MAX) return res.status(400).json({ ok: false, error: `At most ${MAX} Rebels` });
    const bad = tokens.filter((t) => !/^[1-9]\d{0,5}$/.test(t));
    if (bad.length) return res.status(400).json({ ok: false, error: `Not a Rebel number: ${bad.join(', ')}` });
    const never = tokens.filter((t) => NEVER.has(t));
    if (never.length) return res.status(400).json({ ok: false, error: `#${never.join(', #')} can't be on the roster (#001 is the starter)` });
    const rigs = await publicRigs(tokens);
    const missing = tokens.filter((t) => !rigs.has(t));
    if (missing.length) return res.status(400).json({ ok: false, code: 'no_public_rig', missing, error: `No public forged character with a rig for #${missing.join(', #')}: make one in the Forge as admin first ("Make this my Rebel")` });
    const out = { tokens, updatedAt: new Date().toISOString() };
    await redis([['SET', KEY, JSON.stringify(out)]]);
    return res.status(200).json({ ok: true, ...out, saved: true, env: ENV });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || 'Roster failed' });
  }
}
