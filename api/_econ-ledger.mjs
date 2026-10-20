// What the village has paid each economy account (Redis), and the paying itself. The server decides every award:
// the amount comes from api/_econ-catalog.mjs (tools/gen-econ-catalog.mjs), never from the browser.
//   - a chest, a game's first clear and a place riddle pay once per account (claimed set; the economy's idempotency
//     key village:<kind>:<id>:<user> makes sure a retry never pays twice either)
//   - a game's finds (the Treasure Dig chests) pay up to their own amount a day per game
//   - at most CAP points a day per account (UTC days); an award past it is held (owed) and paid on a later day, the
//     first time the player is back (econ-me, or their next award)
// Keys: econ:v1:claimed:<u> (set kind:id), econ:v1:day:<u>:<day> (paid that day), econ:v1:find:<u>:<game>:<day>,
// econ:v1:owed:<u> (hash idempotency key -> award), econ:v1:log:<u> (the last 40 awards, newest first).
// The RAAP chest action (api/_raap-universe-chest.mjs) claims and pays a chest through these same keys, the same
// idempotency key and the same owed records (KEYS, oneTimeKey, owedRecord, logEntry), so one chest pays once whichever
// side claims it.
import CATALOG from './_econ-catalog.mjs';
import { redis, econCredit } from './_econ.mjs';

export const CAP = Math.max(100, parseInt(process.env.ECON_DAILY_CAP || '2000', 10));
// one-time awards (chests, first clears, riddles) skip the cap (Miguel, Oct 20: yes); only repeatable finds count toward
// it. ECON_ONE_TIME_UNCAPPED=0 puts them back under the cap.
export const ONE_TIME_UNCAPPED = process.env.ECON_ONE_TIME_UNCAPPED !== '0';
const P = 'econ:v1';
export const DAY_TTL = 60 * 60 * 24 * 3;
export const KEYS = {
  claimed: (u) => `${P}:claimed:${u}`, day: (u, day) => `${P}:day:${u}:${day}`, find: (u, id, day) => `${P}:find:${u}:${id}:${day}`,
  owed: (u) => `${P}:owed:${u}`, log: (u) => `${P}:log:${u}`
};
// the economy's idempotency key of a one-time award (chest, first clear, riddle): the same key never pays twice
export const oneTimeKey = (kind, id, u) => `village:${kind}:${id}:${u}`;
// whether an award counts toward the daily cap
export const capApplies = (kind) => !(ONE_TIME_UNCAPPED && kind !== 'find');
// an award held past the cap, as payOwed() reads it back (the hash field is its idempotency key)
export const owedRecord = (a) => JSON.stringify(a);
export const logEntry = (a, at = Date.now()) => JSON.stringify({ k: a.kind, id: a.id, v: a.village, p: a.amount, at });
export const catalog = () => CATALOG;
export const utcDay = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);
const KIND = { chest: 'chests', game: 'games', riddle: 'riddles', find: 'digs' };
export const ID = /^[A-Za-z0-9][A-Za-z0-9_:.-]{0,119}$/;
const err = (status, message, code) => Object.assign(new Error(message), { status, code });

// the award's catalog entry -> { amount, village, cap (finds), reason }
export function lookup(kind, id) {
  const table = catalog()[KIND[kind]];
  const e = table && ID.test(String(id || '')) ? table[id] : null;
  if (!e) return null;
  const what = { chest: 'chest', game: 'first clear', riddle: 'riddle solved', find: 'find' }[kind];
  return kind === 'find' ? { amount: e[0], cap: e[1], village: e[2], reason: `Rebel Ants Village · ${e[2]} · ${id} · ${what}` }
    : { amount: e[0], village: e[1], reason: `Rebel Ants Village · ${e[1]} · ${id} · ${what}` };
}

async function credit(u, a) {
  const r = await econCredit({ userId: u, amount: a.amount, reason: a.reason, metadata: { kind: a.kind, id: a.id, village: a.village }, idempotencyKey: a.ikey });
  await redis([['LPUSH', KEYS.log(u), logEntry(a)], ['LTRIM', KEYS.log(u), '0', '39']]).catch(() => {});
  return r;
}

// pay what was held on earlier days, oldest first, while today's cap has room; an award the cap no longer applies to
// (a one-time award held before they skipped it) pays at once
export async function payOwed(u) {
  const [all] = await redis([['HGETALL', KEYS.owed(u)]]);
  const flat = Array.isArray(all?.result) ? all.result : [];
  const items = [];
  for (let i = 0; i + 1 < flat.length; i += 2) { try { items.push({ ikey: flat[i], ...JSON.parse(flat[i + 1]) }); } catch (e) {} }
  items.sort((a, b) => (a.at || 0) - (b.at || 0));
  const day = utcDay(), dk = KEYS.day(u, day);
  let paid = 0, balance = null;
  for (const a of items) {
    const capped = capApplies(a.kind);
    if (capped && a.day === day) continue;                             // held today: wait for tomorrow
    if (capped) {
      const [t] = await redis([['INCRBY', dk, String(a.amount)], ['EXPIRE', dk, String(DAY_TTL)]]);
      if (Number(t?.result) > CAP) { await redis([['DECRBY', dk, String(a.amount)]]); continue; }
    }
    try { balance = (await credit(u, a)).newBalance; paid += a.amount; await redis([['HDEL', KEYS.owed(u), a.ikey]]); }
    catch (e) { if (capped) await redis([['DECRBY', dk, String(a.amount)]]).catch(() => {}); break; }
  }
  return { paid, balance };
}

// one award for the signed-in player u -> { paid, held, already, capped, balance, today, cap }
// info (optional, filled in, never part of the answer): { ikey, at, settled: 'PAID' | 'HELD', transactionId } once the
// award is saved (the shared-experience feed reads it)
export async function award(u, kind, id, info) {
  const e = lookup(kind, id);
  if (!e) throw err(400, 'Unknown award', 'unknown_award');
  const day = utcDay(), dk = KEYS.day(u, day), undo = [];
  const a = { kind, id, village: e.village, amount: e.amount, reason: e.reason, day, at: Date.now() };
  if (kind === 'find') {
    const fk = KEYS.find(u, id, day);
    const [n] = await redis([['INCRBY', fk, String(e.amount)], ['EXPIRE', fk, String(DAY_TTL)]]);
    if (Number(n?.result) > e.cap) { await redis([['DECRBY', fk, String(e.amount)]]); return { paid: 0, capped: true, ...(await today(u)) }; }
    a.ikey = `village:find:${id}:${day}:${Number(n.result)}:${u}`;
    undo.push(['DECRBY', fk, String(e.amount)]);
  } else {
    const [added] = await redis([['SADD', KEYS.claimed(u), `${kind}:${id}`]]);
    if (Number(added?.result) !== 1) return { paid: 0, already: true, ...(await today(u)) };
    a.ikey = oneTimeKey(kind, id, u);
    undo.push(['SREM', KEYS.claimed(u), `${kind}:${id}`]);
  }
  if (capApplies(kind)) {
    const [t] = await redis([['INCRBY', dk, String(e.amount)], ['EXPIRE', dk, String(DAY_TTL)]]);
    if (Number(t?.result) > CAP) {
      await redis([['DECRBY', dk, String(e.amount)], ['HSET', KEYS.owed(u), a.ikey, owedRecord(a)]]);
      if (info) Object.assign(info, { ikey: a.ikey, at: a.at, settled: 'HELD', transactionId: null });
      return { paid: 0, held: e.amount, ...(await today(u)) };
    }
    undo.push(['DECRBY', dk, String(e.amount)]);
  }
  try {
    const r = await credit(u, a);
    if (info) Object.assign(info, { ikey: a.ikey, at: a.at, settled: 'PAID', transactionId: r.transactionId || null });
    return { paid: e.amount, balance: r.newBalance, ...(await today(u)) };
  } catch (x) {
    await redis(undo).catch(() => {});                                   // not paid: the award can be tried again
    throw x;
  }
}

// today's paid points, the cap, what is held, and every one-time award this account has had (kind:id)
export async function today(u) {
  const [d, o] = await redis([['GET', KEYS.day(u, utcDay())], ['HVALS', KEYS.owed(u)]]);
  const owed = (Array.isArray(o?.result) ? o.result : []).reduce((s, v) => { try { return s + (Number(JSON.parse(v).amount) || 0); } catch (e) { return s; } }, 0);
  return { today: Number(d?.result) || 0, cap: CAP, owed };
}
export async function claimed(u) {
  const [c] = await redis([['SMEMBERS', KEYS.claimed(u)]]);
  return Array.isArray(c?.result) ? c.result.map(String) : [];
}
export async function recent(u) {
  const [l] = await redis([['LRANGE', KEYS.log(u), '0', '19']]);
  return (Array.isArray(l?.result) ? l.result : []).map((s) => { try { return JSON.parse(s); } catch (e) { return null; } }).filter(Boolean);
}
