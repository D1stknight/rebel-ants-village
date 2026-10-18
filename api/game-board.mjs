// Shared leaderboards for the village mini-games: the top 10 of every game, one entry per wallet (its best).
//   GET  ?game=<id>&kind=s|t                          -> { ok, game, kind, top: [{ rank, name, tag, value, at, you }], you, signedIn }
//   POST { game, kind, value, rebel: { col, id } }     -> the same, after keeping this wallet's best (needs a wallet session)
//   POST { action:'remove', game, kind, wallet }       -> drops one entry (admin)
// kind 's' = points (higher is better), 't' = seconds of a time trial (lower is better). Posting needs the wallet sign-in
// (the ra_wallet cookie): guests see the boards but don't post. The name shown is the Rebel's ("Rebel #262") when the
// signed-in wallet holds it (owner or delegate), else just "Rebel"; the tag is the wallet, shortened. Boards are kept per
// deploy (production / previews), so scores from dev tests never show on the live site.
import { enforceRateLimit } from './_guard.mjs';
import { isAdminRequest } from './_admin-auth.mjs';
import { walletOf, holderOf, redis, isAddr } from './_wallet.mjs';

const ENV = process.env.VERCEL_ENV === 'production' ? 'prod' : 'dev';
const P = `games:board:v1:${ENV}`;
const GAME = /^[a-z0-9][a-z0-9-]{1,63}$/;
const COL = /^[a-z0-9_]{2,40}$/;
const MAX_BOARDS = 800;                     // the game list is ~160; this only stops junk ids from making keys forever
const LABEL = { battle_for_colony: 'Rebel', chumpz: 'Chumpz', saints: 'Saint' };
const short = (a) => (isAddr(a) ? `${a.slice(0, 6)}…${a.slice(-4)}` : '');

function valueOf(kind, v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (kind === 's') return n >= 0 && n <= 1e7 ? Math.round(n) : null;
  return n >= 0.5 && n <= 36000 ? Math.round(n * 10) / 10 : null;           // seconds, to the tenth
}

async function board(game, kind, wallet) {
  const z = `${P}:${kind}:${game}`, who = `${P}:who:${kind}:${game}`;
  const [top, mine, myScore] = await redis([
    [kind === 's' ? 'ZREVRANGE' : 'ZRANGE', z, '0', '9', 'WITHSCORES'],
    wallet ? [kind === 's' ? 'ZREVRANK' : 'ZRANK', z, wallet] : ['PING'],
    wallet ? ['ZSCORE', z, wallet] : ['PING']
  ]);
  const flat = Array.isArray(top?.result) ? top.result : [];
  const rows = [];
  for (let i = 0; i + 1 < flat.length; i += 2) rows.push({ wallet: String(flat[i]), value: Number(flat[i + 1]) });
  const info = rows.length ? (await redis([['HMGET', who, ...rows.map((r) => r.wallet)]]))[0]?.result || [] : [];
  const out = rows.map((r, i) => {
    let d = {}; try { d = JSON.parse(info[i] || '{}') || {}; } catch (e) {}
    return { rank: i + 1, name: String(d.n || 'Rebel'), tag: short(r.wallet), value: r.value, at: d.at || null, you: !!wallet && r.wallet === wallet };
  });
  const rank = Number.isInteger(mine?.result) ? mine.result + 1 : null;
  return { ok: true, game, kind, top: out, you: wallet && rank ? { rank, value: Number(myScore?.result) } : null, signedIn: !!wallet };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const body = req.method === 'POST' ? (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})) : {};
    const q = req.method === 'GET' ? (req.query || {}) : body;
    const game = String(q.game || ''), kind = q.kind === 't' ? 't' : 's';
    if (!GAME.test(game)) return res.status(400).json({ ok: false, error: 'Unknown game' });
    const wallet = walletOf(req);

    if (req.method === 'GET') {
      // per wallet when signed in (players behind one shared address don't use up each other's allowance)
      if (!(await enforceRateLimit(req, res, wallet ? `game-board-get:${wallet}` : 'game-board-get', 1500, 3600, 'leaderboard requests'))) return;
      return res.status(200).json(await board(game, kind, wallet));
    }
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

    if (body.action === 'remove') {
      if (!isAdminRequest(req)) return res.status(401).json({ ok: false, error: 'Admin authentication required' });
      const w = String(body.wallet || '').toLowerCase();
      if (!isAddr(w)) return res.status(400).json({ ok: false, error: 'wallet must be an address' });
      await redis([['ZREM', `${P}:${kind}:${game}`, w], ['HDEL', `${P}:who:${kind}:${game}`, w]]);
      return res.status(200).json(await board(game, kind, null));
    }

    if (!wallet) return res.status(401).json({ ok: false, error: 'Sign in with your wallet to post scores', signedIn: false });
    if (!(await enforceRateLimit(req, res, `game-board-post:${wallet}`, 300, 3600, 'score posts'))) return;
    const value = valueOf(kind, body.value);
    if (value == null) return res.status(400).json({ ok: false, error: 'Score out of range' });

    const z = `${P}:${kind}:${game}`, idx = `${P}:index`;
    const [known, count, prev] = await redis([['SISMEMBER', idx, `${kind}:${game}`], ['SCARD', idx], ['ZSCORE', z, wallet]]);
    if (!known?.result && Number(count?.result || 0) >= MAX_BOARDS) return res.status(400).json({ ok: false, error: 'Too many boards' });
    const old = prev?.result == null ? null : Number(prev.result);
    const better = old == null || (kind === 's' ? value > old : value < old);
    if (better) {
      // the Rebel's name only when this wallet holds it (owner or delegate.xyz delegate)
      const col = COL.test(String(body.rebel?.col || '')) ? String(body.rebel.col) : 'battle_for_colony';
      const id = /^\d{1,7}$/.test(String(body.rebel?.id ?? '')) ? String(Number(body.rebel.id)) : null;
      let name = 'Rebel';
      if (id) { try { const h = await holderOf(col, id, wallet); if (h.holder) name = `${LABEL[col] || 'Rebel'} #${id.padStart(3, '0')}`; } catch (e) {} }
      await redis([
        ['ZADD', z, String(value), wallet],
        ['HSET', `${P}:who:${kind}:${game}`, wallet, JSON.stringify({ n: name, at: new Date().toISOString() })],
        ['SADD', idx, `${kind}:${game}`]
      ]);
    }
    const out = await board(game, kind, wallet);
    return res.status(200).json({ ...out, posted: true, improved: better, previous: old });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || 'Leaderboard failed' });
  }
}
