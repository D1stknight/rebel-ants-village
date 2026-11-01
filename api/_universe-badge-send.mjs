// Universe's badges on the Rebel Economy's Badge Wall (economy.rebelants.io/badges, the Rebel Console's Badges page).
// A badge is earned in the player's browser and kept with the account's saved story (api/story-save.mjs). When a story
// is saved, the badges it has that the economy hasn't had yet go to POST /api/internal/badges ({ userId, award: [ids] },
// at most 40 a call: the economy's limit) with this site's own app key; the economy keeps them on the player's account
// and takes only Universe's own badges from our key.
// - only the badges the economy's catalog has: it is read from the economy (GET /api/internal/badges, kept 15 minutes;
//   ECONOMY_V1 = the 85 it had on Oct 29 when it can't be read), so a badge the economy doesn't know yet waits instead
//   of being taken as sent (the economy skips ids it doesn't know and still answers ok)
// - a badge with a server check (api/_universe-badges.mjs LEDGER_CHECKS, from its rule) also needs the server to agree:
//   the village's own ledger (the chests, first clears and place riddles it paid this account, api/_econ-ledger.mjs;
//   the one-time Rebel Points), the board places kept under the account (api/game-board.mjs), the wallet's own forged
//   characters (the wallet session on the save's request); until it does, the badge waits and goes with a later save
// - econ:v1:badges:sent:<u> = the badges the economy took (production and previews share it, as they share the
//   economy), so each is sent once; :lock:<u> keeps two saves at once from sending the same ones; :retry:<u> waits 5
//   minutes after the economy said no or didn't answer
// - never slows a save past its budget and never breaks it (a badge is a bonus): what didn't go is sent next time
import { BADGE_IDS, LEDGER_CHECKS, ECONOMY_V1 } from './_universe-badges.mjs';
import { econCall, redis } from './_econ.mjs';
import { KEYS, oneTimeEarned } from './_econ-ledger.mjs';
import { bump } from './_site-stats.mjs';
import { renameBadges } from '../assets/story-save.js';

const PROG = 'rebelAntsProgression:v1';
export const PER_CALL = 40;
const P = 'econ:v1:badges';
export const BADGE_KEYS = { sent: (u) => `${P}:sent:${u}`, lock: (u) => `${P}:lock:${u}`, retry: (u) => `${P}:retry:${u}`, known: () => `${P}:known` };
const KEEP = 60 * 60 * 24 * 400, RETRY = 300, KNOWN_TTL = 900;
// the boards' place under the account (api/game-board.mjs rankKey): per deploy, like the boards
const BOARD_ENV = process.env.VERCEL_ENV === 'production' ? 'prod' : 'dev';
const rankKey = (u) => `games:board:v1:${BOARD_ENV}:rank:${u}`;
const FORGE_COLS = ['battle_for_colony', 'chumpz', 'saints'];

// the badge ids a saved story has earned (the names its progression keeps -> ids, a renamed badge's old name counted as
// its new one: assets/story-save.js BADGE_RENAMES; badges the economy doesn't list are left out)
export function storyBadgeIds(story) {
  let p = null;
  try { p = JSON.parse(story?.keys?.[PROG] || 'null'); } catch (e) { p = null; }
  const names = renameBadges(p?.badges);
  return [...new Set(names.map((n) => BADGE_IDS[String(n)]).filter(Boolean))];
}

function progressionOf(story) { try { return JSON.parse(story?.keys?.[PROG] || 'null'); } catch (e) { return null; } }
// whether the server agrees with a badge's check (claimed: the account's one-time awards, 'kind:id'; ranks: the board
// places under the account { '<kind>:<game>': place }; forge: the wallet's own forged characters, checked)
export function ledgerAgrees(id, claimed, ranks = {}, forge = {}) {
  const c = LEDGER_CHECKS[id];
  if (!c) return true;
  const count = (pre) => { let n = 0; for (const k of claimed) if (k.startsWith(pre)) n++; return n; };
  if (c.chests) return count('chest:') >= c.chests;
  if (c.chest) return claimed.has(`chest:${c.chest}`);
  if (c.chestsAll) return c.chestsAll.length > 0 && c.chestsAll.every((x) => claimed.has(`chest:${x}`));
  if (c.games) return c.games.every((g) => claimed.has(`game:${g}`));
  if (c.gamesN) return count('game:') >= c.gamesN;
  if (c.gamesOf) return c.gamesOf.filter((g) => claimed.has(`game:${g}`)).length >= c.n;
  if (c.riddles) return c.riddles.filter((r) => claimed.has(`riddle:${r}`)).length >= c.n;
  if (c.points) return oneTimeEarned([...claimed]) >= c.points;
  if (c.board) { const [place, n] = c.board; return Object.values(ranks || {}).filter((r) => Number(r) >= 1 && Number(r) <= place).length >= n; }
  if (c.forge) return !!forge[c.forge];
  return false;
}
const needs = (ids, k) => ids.some((id) => LEDGER_CHECKS[id] && k(LEDGER_CHECKS[id]));
// the wallet's own forged characters the saved story names (ProgressionState.forged { collection: token, gloves:
// 'collection:token' }), each read back: the wallet's own record of that token (its holder was checked when it was made)
export async function verifiedForge(story, wallet) {
  const f = progressionOf(story)?.forged, out = {};
  if (!wallet || !f || typeof f !== 'object') return out;
  const cols = FORGE_COLS.filter((c) => /^\d{1,7}$/.test(String(f[c] || '')));
  if (!cols.length) return out;
  const rows = await redis([['MGET', ...cols.map((c) => `forge:active-character:v1:${wallet}:${c}:${f[c]}`)]]);
  const recs = Array.isArray(rows[0]?.result) ? rows[0].result : [];
  const build = {};
  cols.forEach((c, i) => {
    let r = null; try { r = JSON.parse(recs[i] || 'null'); } catch (e) { r = null; }
    if (r && String(r.walletAddress || '').toLowerCase() === wallet && r.collectionKey === c && String(r.tokenId) === String(f[c])) { out[c] = true; build[c] = r.activeForgeBuildId || null; }
  });
  const g = /^([a-z0-9_]{1,40}):(\d{1,7})$/.exec(String(f.gloves || ''));
  if (g && out[g[1]] && String(f[g[1]]) === g[2] && build[g[1]]) {
    const [b] = await redis([['GET', `forge:3d-build:v1:${build[g[1]]}`]]);
    try { if (JSON.parse(b?.result || 'null')?.forgeRig?.gloves?.doneAt) out.gloves = true; } catch (e) {}
  }
  out.trio = FORGE_COLS.every((c) => out[c]);
  return out;
}
// the Universe badges the economy's catalog has now (its read of a player's badges carries the catalog), kept 15 minutes
export async function economyKnown(u) {
  const K = BADGE_KEYS.known();
  try { const [c] = await redis([['GET', K]]); if (c?.result) return new Set(JSON.parse(c.result)); } catch (e) {}
  try {
    const r = await econCall(`/api/internal/badges?userId=${encodeURIComponent(u)}&app=universe`, null, 'GET', 2500);
    const ids = (Array.isArray(r.data?.catalog) ? r.data.catalog : []).map((b) => String(b?.id || '')).filter((id) => id.startsWith('universe:')).map((id) => id.slice(9));
    if (r.ok && ids.length) { await redis([['SET', K, JSON.stringify(ids), 'EX', String(KNOWN_TTL)]]).catch(() => {}); return new Set(ids); }
  } catch (e) {}
  return new Set(ECONOMY_V1);
}

// -> { sent: [ids the economy took now], waiting: [ids the server doesn't agree with yet], later: [ids the economy
//      doesn't know yet], error? }
export async function sendStoryBadges(u, story, { budgetMs = 2500, site = '', wallet = null } = {}) {
  const until = Date.now() + budgetMs, ids0 = storyBadgeIds(story), out = { sent: [], waiting: [], later: [] };
  if (!u || !ids0.length) return out;
  const K = BADGE_KEYS;
  const [s, w] = await redis([['SMEMBERS', K.sent(u)], ['GET', K.retry(u)]]);
  const sent = new Set(Array.isArray(s?.result) ? s.result : []), ids = ids0.filter((id) => !sent.has(id));
  if (!ids.length) return out;
  const ledger = needs(ids, (c) => !c.board && !c.forge), boards = needs(ids, (c) => c.board), forged = needs(ids, (c) => c.forge);
  const [c, rk] = await redis([ledger ? ['SMEMBERS', KEYS.claimed(u)] : ['PING'], boards ? ['HGETALL', rankKey(u)] : ['PING']]);
  const claimed = new Set(ledger && Array.isArray(c?.result) ? c.result : []);
  const ranks = {}; if (boards && Array.isArray(rk?.result)) for (let i = 0; i + 1 < rk.result.length; i += 2) ranks[rk.result[i]] = Number(rk.result[i + 1]);
  const forge = forged ? await verifiedForge(story, wallet).catch(() => ({})) : {};
  const known = await economyKnown(u);
  const todo = [];
  for (const id of ids) {
    if (!known.has(id)) { out.later.push(id); continue; }
    if (ledgerAgrees(id, claimed, ranks, forge)) todo.push(id); else out.waiting.push(id);
  }
  if (!todo.length) return out;
  if (w?.result) return { ...out, error: 'retry_later' };
  const [lock] = await redis([['SET', K.lock(u), '1', 'NX', 'EX', '30']]);
  if (lock?.result !== 'OK') return { ...out, error: 'busy' };
  try {
    for (let i = 0; i < todo.length; i += PER_CALL) {
      const left = until - Date.now(), wait = Math.min(left, 6000);
      if (left < 800) { out.error = 'budget'; break; }
      const chunk = todo.slice(i, i + PER_CALL);
      let r;
      try { r = await econCall('/api/internal/badges', { userId: u, award: chunk, context: { source: 'rebel-universe', site } }, 'POST', wait); }
      catch (e) { out.error = e.status === 504 && wait < 6000 ? 'budget' : e.message; break; }   // cut by this save's budget: the next save goes on
      if (!r.ok || r.data?.ok !== true || r.data?.ready === false) {
        out.error = r.data?.error || (r.data?.ready === false ? 'not_ready' : `economy_${r.status}`);
        break;
      }
      await redis([['SADD', K.sent(u), ...chunk], ['EXPIRE', K.sent(u), String(KEEP)]]);
      out.sent.push(...chunk); await bump({ badges: chunk.length }); // (the dashboard)
    }
  } catch (e) { out.error = e.message; }
  finally {
    const after = [['DEL', K.lock(u)]];
    if (out.error && out.error !== 'budget') after.push(['SET', K.retry(u), '1', 'EX', String(RETRY)]);
    await redis(after).catch(() => {});
  }
  if (out.sent.length || out.error) console.info('[badges]', u, site, 'sent', out.sent.length, out.error ? `stopped: ${out.error}` : '', out.waiting.length ? `${out.waiting.length} waiting on the server's checks` : '', out.later.length ? `${out.later.length} not in the economy's catalog yet` : '');
  return out;
}
