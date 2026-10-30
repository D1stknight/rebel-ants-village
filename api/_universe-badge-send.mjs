// Universe's badges on the Rebel Economy's Badge Wall (economy.rebelants.io/badges, the Rebel Console's Badges page).
// A badge is earned in the player's browser and kept with the account's saved story (api/story-save.mjs). When a story
// is saved, the badges it has that the economy hasn't had yet go to POST /api/internal/badges ({ userId, award: [ids] },
// at most 40 a call: the economy's limit) with this site's own app key; the economy keeps them on the player's account
// and takes only Universe's own badges from our key.
// - only the badges the economy's catalog has (api/_universe-badges.mjs, tools/gen-universe-badges.mjs)
// - a chest or game-clear badge also needs the village's own ledger to agree (the chests and first clears it paid this
//   account, api/_econ-ledger.mjs); until it does, the badge waits and goes with a later save
// - econ:v1:badges:sent:<u> = the badges the economy took (production and previews share it, as they share the
//   economy), so each is sent once; :lock:<u> keeps two saves at once from sending the same ones; :retry:<u> waits 5
//   minutes after the economy said no or didn't answer
// - never slows a save past its budget and never breaks it (a badge is a bonus): what didn't go is sent next time
import { BADGE_IDS, LEDGER_CHECKS } from './_universe-badges.mjs';
import { econCall, redis } from './_econ.mjs';
import { KEYS } from './_econ-ledger.mjs';
import { bump } from './_site-stats.mjs';

const PROG = 'rebelAntsProgression:v1';
export const PER_CALL = 40;
const P = 'econ:v1:badges';
export const BADGE_KEYS = { sent: (u) => `${P}:sent:${u}`, lock: (u) => `${P}:lock:${u}`, retry: (u) => `${P}:retry:${u}` };
const KEEP = 60 * 60 * 24 * 400, RETRY = 300;

// the badge ids a saved story has earned (the names its progression keeps -> ids; badges the economy doesn't list are left out)
export function storyBadgeIds(story) {
  let p = null;
  try { p = JSON.parse(story?.keys?.[PROG] || 'null'); } catch (e) { p = null; }
  const names = Array.isArray(p?.badges) ? p.badges : [];
  return [...new Set(names.map((n) => BADGE_IDS[String(n)]).filter(Boolean))];
}

// whether the village's ledger agrees with a chest or game-clear badge (claimed: the account's one-time awards, 'kind:id')
export function ledgerAgrees(id, claimed) {
  const c = LEDGER_CHECKS[id];
  if (!c) return true;
  if (c.chests) { let n = 0; for (const k of claimed) if (k.startsWith('chest:')) n++; return n >= c.chests; }
  if (c.chest) return claimed.has(`chest:${c.chest}`);
  if (c.games) return c.games.every((g) => claimed.has(`game:${g}`));
  return false;
}

// -> { sent: [ids the economy took now], waiting: [ids the ledger doesn't agree with yet], error? }
export async function sendStoryBadges(u, story, { budgetMs = 2500, site = '' } = {}) {
  const until = Date.now() + budgetMs, ids = storyBadgeIds(story), out = { sent: [], waiting: [] };
  if (!u || !ids.length) return out;
  const K = BADGE_KEYS, checked = ids.some((id) => LEDGER_CHECKS[id]);
  const [s, w, c] = await redis([['SMEMBERS', K.sent(u)], ['GET', K.retry(u)], ...(checked ? [['SMEMBERS', KEYS.claimed(u)]] : [])]);
  const sent = new Set(Array.isArray(s?.result) ? s.result : []), claimed = new Set(Array.isArray(c?.result) ? c.result : []);
  const todo = [];
  for (const id of ids) {
    if (sent.has(id)) continue;
    if (ledgerAgrees(id, claimed)) todo.push(id); else out.waiting.push(id);
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
  if (out.sent.length || out.error) console.info('[badges]', u, site, 'sent', out.sent.length, out.error ? `stopped: ${out.error}` : '', out.waiting.length ? `${out.waiting.length} waiting on the ledger` : '');
  return out;
}
