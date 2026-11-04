// Golden tickets (Nov 2): the front row at a Colony Stage event (the Comedy Club's first row of chairs, 8 seats), for the
// players who hold one. Per event (Admin Hub > Events: the price, how many sold, how many drawn) and per time it runs (a
// repeating event's every time is its own): a free raffle for signed-in players until the doors open, drawn as they open;
// tickets sold for Rebel Points until the event ends (the Rebel Economy takes the points, once per player and time).
//   GET  ?event=<id>                          -> { ok, golden: null | { price, buy, raffle, sold, entries, drawn, winners, left,
//                                                 starts, mine: 'bought' | 'won' | 'entered' | 'lost' | 'paying' | null, signedIn } }
//   POST { event, action: 'enter' }           -> the same, entered (signed in, before it starts, once)
//   POST { event, action: 'buy' }             -> the same, bought (signed in, while tickets are left; never charged twice)
//   POST { event, action: 'config', price, buy, raffle } (admins) -> saved for that event (0 / 0 / 0 = none)
//   POST { event, action: 'refund' }          (admins) -> every ticket of its current time paid back
//   GET  ?event=<id>&list=1                   (admins) -> + holders: [{ u, how }]
// The event and its current time come from the rooms' public list (live now or within 30 days): nothing from the page.
// Tickets to get in (Nov 4, Miguel: "the tickets should be for the entire show not just front seats"): cfg.entry = the
// show needs a ticket (the event's hall lets in only holders: api/mp-ticket.mjs signs the claim, realtime/src/stage.js
// checks it); then buy = how many are sold (up to 100,000) and raffle = how many are drawn free, with no front row.
import { econSessionOf, econDebit, econCredit, redis } from './_econ.mjs';
import { isAdminRequest } from './_admin-auth.mjs';
import { siteOf, roomsUrl } from './mp-ticket.mjs';
import { enforceRateLimit } from './_guard.mjs';
import crypto from 'node:crypto';

export const SEATS = 8;
const EVENT_ID = /^[A-Za-z0-9_-]{10}$/;
const DEFINITE = new Set(['insufficient_balance', 'user_not_found', 'user_not_active', 'economy_paused', 'invalid_amount', 'invalid_input', 'unauthorized', 'forbidden']);
const P = () => `golden:v1:${siteOf()}:`;
const K = {
  cfg: (id) => P() + 'cfg:' + id,
  time: (id, starts) => P() + `t:${id}:${starts}`,          // hash: sold, drawn, buy:<u> (json), won:<u>
  entries: (id, starts) => P() + `t:${id}:${starts}:raffle`  // set of accounts
};
const KEEP = 60 * 86400; // (a time's records: two months)

export async function eventOf(id, fetchImpl = fetch) {
  const url = roomsUrl(siteOf()); if (!url || !EVENT_ID.test(String(id || ''))) return null;
  const r = await fetchImpl(url.replace(/^ws/, 'http') + '/v1/events', { signal: AbortSignal.timeout(6000) });
  const d = await r.json().catch(() => null); if (!r.ok || !d?.ok) throw Object.assign(new Error('The rooms did not answer'), { status: 502 });
  return [...(d.live || []), ...(d.next || [])].find((e) => e.id === id) || null;
}
const cfgOf = (raw) => { try { const c = JSON.parse(raw || 'null'); return c && (c.buy > 0 || c.raffle > 0) ? c : null; } catch (e) { return null; } };
export const MAX_TICKETS = 100000;
export function cleanCfg(b) {
  const entry = !!b.entry, price = Math.max(0, Math.min(1000000, Math.round(+b.price || 0)));
  const buy = Math.max(0, Math.min(entry ? MAX_TICKETS : SEATS, Math.round(+b.buy || 0))), raffle = Math.max(0, Math.min(entry ? 1000 : SEATS - buy, Math.round(+b.raffle || 0)));
  return { price: buy ? Math.max(1, price) : 0, buy, raffle, ...(entry ? { entry: true } : {}) };
}

// the raffle draws once its time has started (the first read after the doors open: HSETNX picks the one that draws)
async function draw(tk, ek, n, now) {
  const [nx] = await redis([['HSETNX', tk, 'drawn', String(now)]]);
  if (+nx?.result !== 1) return;
  const [m, all] = await redis([['SMEMBERS', ek], ['HGETALL', tk]]);
  const bought = new Set(); const h = all?.result || []; for (let i = 0; i < h.length; i += 2) if (String(h[i]).startsWith('buy:')) bought.add(String(h[i]).slice(4));
  const pool = (m?.result || []).filter((u) => !bought.has(u));
  for (let i = pool.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const won = pool.slice(0, n);
  await redis([...won.map((u) => ['HSET', tk, 'won:' + u, String(now)]), ['HSET', tk, 'winners', String(won.length)], ['EXPIRE', tk, String(KEEP)], ['EXPIRE', ek, String(KEEP)]]);
}
// a ticket held for a buyer before the points are taken (or the one they already have): 1 new, 2 theirs already, 0 sold out
const HOLD = `local cur = redis.call('HGET', KEYS[1], 'buy:' .. ARGV[1])
if cur then return {2, cur} end
if redis.call('HGET', KEYS[1], 'won:' .. ARGV[1]) then return {3, ''} end
local sold = tonumber(redis.call('HGET', KEYS[1], 'sold') or '0')
if sold >= tonumber(ARGV[2]) then return {0, ''} end
redis.call('HINCRBY', KEYS[1], 'sold', 1)
redis.call('HSET', KEYS[1], 'buy:' .. ARGV[1], ARGV[3])
redis.call('EXPIRE', KEYS[1], ARGV[4])
return {1, ARGV[3]}`;

async function stateOf(ev, cfg, u, { doDraw = true } = {}) {
  const tk = K.time(ev.id, ev.starts), ek = K.entries(ev.id, ev.starts), now = Date.now();
  if (doDraw && cfg?.raffle > 0 && now >= ev.starts) await draw(tk, ek, cfg.raffle, now);
  const cmds = [['HGET', tk, 'sold'], ['HGET', tk, 'drawn'], ['HGET', tk, 'winners'], ['SCARD', ek]];
  if (u) cmds.push(['HGET', tk, 'buy:' + u], ['HGET', tk, 'won:' + u], ['SISMEMBER', ek, u]);
  const r = await redis(cmds), v = (i) => r[i]?.result;
  const sold = +v(0) || 0, drawn = +v(1) || 0;
  let mine = null;
  if (u) {
    let buy = null; try { buy = v(4) ? JSON.parse(v(4)) : null; } catch (e) {}
    mine = buy ? (buy.status === 'bought' ? 'bought' : buy.status === 'refunded' ? null : 'paying') : v(5) ? 'won' : +v(6) ? (drawn ? 'lost' : 'entered') : null;
  }
  return { entry: !!cfg?.entry, price: cfg?.price || 0, buy: cfg?.buy || 0, raffle: cfg?.raffle || 0, sold, left: Math.max(0, (cfg?.buy || 0) - sold), entries: +v(3) || 0, drawn: !!drawn, winners: +v(2) || 0,
    starts: ev.starts, ends: ev.ends, live: !!ev.live, mine, raffleOpen: !!cfg?.raffle && now < ev.starts, buyOpen: !!cfg?.buy && now < ev.ends };
}

// may this account watch the show of a ticketed event? (api/mp-ticket.mjs: the claim it signs into the hall's ticket)
// null = the event needs no ticket; admins always
export async function ticketClaim(id, u, admin) {
  const cfg = cfgOf((await redis([['GET', K.cfg(id)]]))[0]?.result);
  if (!cfg?.entry) return null;
  if (admin) return true;
  if (!u) return false;
  const ev = await eventOf(id); if (!ev) return false;
  const st = await stateOf(ev, cfg, u); // (also draws the raffle once the doors are open)
  return st.mine === 'bought' || st.mine === 'won';
}

async function pay(ev, cfg, s, rec, tk) {
  const key = `village:golden:${ev.id}:${ev.starts}:${s.u}`;
  try {
    const d = await econDebit({ userId: s.u, amount: cfg.price, idempotencyKey: key, reason: `${cfg.entry ? 'A ticket' : 'A golden ticket'}: ${String(ev.title || 'a Colony Stage event').slice(0, 80)}`,
      metadata: { kind: 'golden_ticket', eventId: ev.id, starts: ev.starts } });
    await redis([['HSET', tk, 'buy:' + s.u, JSON.stringify({ ...rec, status: 'bought', tx: d.transactionId, paidAt: Date.now() })]]);
    return { ok: true, balance: d.newBalance };
  } catch (e) {
    if (DEFINITE.has(e.code)) { // (nothing was taken: the ticket goes back)
      await redis([['HDEL', tk, 'buy:' + s.u], ['HINCRBY', tk, 'sold', '-1']]);
      return { ok: false, status: e.code === 'insufficient_balance' ? 402 : 409, error: e.code === 'insufficient_balance' ? `${cfg.entry ? 'A ticket' : 'A golden ticket'} takes ${cfg.price.toLocaleString('en-US')} Rebel Points.` : (e.message || 'The Rebel Economy did not take the points'), code: e.code === 'insufficient_balance' ? 'not_enough_points' : 'econ_refused' };
    }
    return { ok: false, status: 502, error: 'The Rebel Economy did not answer. Try again: you are never charged twice.', code: 'econ_retry', retry: true };
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const b = req.method === 'POST' ? (typeof req.body === 'object' && req.body ? req.body : (() => { try { return JSON.parse(req.body || '{}'); } catch (e) { return {}; } })()) : {};
  const id = String((req.method === 'GET' ? req.query?.event : b.event) || '');
  if (!EVENT_ID.test(id)) return res.status(400).json({ ok: false, error: 'Which event?' });
  try {
    const admin = isAdminRequest(req);
    if (req.method === 'POST' && b.action === 'config') {
      if (!admin) return res.status(401).json({ ok: false, error: 'Admins only' });
      const c = cleanCfg(b);
      await redis(c.buy || c.raffle ? [['SET', K.cfg(id), JSON.stringify(c)]] : [['DEL', K.cfg(id)]]);
      return res.status(200).json({ ok: true, cfg: c.buy || c.raffle ? c : null });
    }
    const [ev, cfgRaw] = await Promise.all([eventOf(id), redis([['GET', K.cfg(id)]]).then((r) => r[0]?.result)]);
    const cfg = cfgOf(cfgRaw);
    if (!ev) return res.status(404).json({ ok: false, error: 'No such event now (or not within 30 days)', cfg: admin ? cfg : undefined });
    const s = econSessionOf(req), u = s?.u || null, tk = K.time(ev.id, ev.starts);
    if (req.method === 'GET') {
      const golden = cfg ? { ...(await stateOf(ev, cfg, u)), signedIn: !!u } : null;
      if (golden && admin && req.query?.list) {
        const all = (await redis([['HGETALL', tk]]))[0]?.result || [], holders = [];
        for (let i = 0; i + 1 < all.length; i += 2) { const [k, v] = [all[i], all[i + 1]]; if (k.startsWith('buy:')) { let o = {}; try { o = JSON.parse(v); } catch (e) {} holders.push({ u: k.slice(4), how: o.status || 'paying' }); } else if (k.startsWith('won:')) holders.push({ u: k.slice(4), how: 'won' }); }
        golden.holders = holders;
      }
      return res.status(200).json({ ok: true, golden, cfg: admin ? cfg : undefined });
    }
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'GET or POST' });
    if (b.action === 'refund') {
      if (!admin) return res.status(401).json({ ok: false, error: 'Admins only' });
      const all = (await redis([['HGETALL', tk]]))[0]?.result || []; let back = 0, failed = 0;
      for (let i = 0; i + 1 < all.length; i += 2) {
        if (!all[i].startsWith('buy:')) continue;
        let o = {}; try { o = JSON.parse(all[i + 1]); } catch (e) {}
        if (o.status !== 'bought') continue;
        const who = all[i].slice(4);
        try { await econCredit({ userId: who, amount: o.price || cfg?.price || 0, type: 'refund', idempotencyKey: `village:golden-refund:${ev.id}:${ev.starts}:${who}`, reason: 'A golden ticket paid back', metadata: { kind: 'golden_refund', eventId: ev.id, starts: ev.starts } });
          await redis([['HSET', tk, all[i], JSON.stringify({ ...o, status: 'refunded', refundedAt: Date.now() })], ['HINCRBY', tk, 'sold', '-1']]); back++; } catch (e) { failed++; }
      }
      return res.status(200).json({ ok: true, refunded: back, failed });
    }
    if (!cfg) return res.status(404).json({ ok: false, error: 'This event has no golden tickets' });
    if (!u) return res.status(401).json({ ok: false, error: 'Sign in for a golden ticket', code: 'sign_in' });
    if (!(await enforceRateLimit(req, res, 'golden', 30, 600, 'golden ticket requests'))) return;
    const now = Date.now();
    if (b.action === 'enter') {
      if (!cfg.raffle) return res.status(409).json({ ok: false, error: 'No raffle for this event' });
      if (now >= ev.starts) return res.status(409).json({ ok: false, error: 'The raffle closed when the doors opened' });
      await redis([['SADD', K.entries(ev.id, ev.starts), u], ['EXPIRE', K.entries(ev.id, ev.starts), String(KEEP)]]);
      return res.status(200).json({ ok: true, golden: { ...(await stateOf(ev, cfg, u)), signedIn: true } });
    }
    if (b.action === 'buy') {
      if (!cfg.buy || !cfg.price) return res.status(409).json({ ok: false, error: 'No tickets for sale for this event' });
      if (now >= ev.ends) return res.status(409).json({ ok: false, error: 'This event is over' });
      const rec = { status: 'paying', price: cfg.price, at: now };
      const [held] = await redis([['EVAL', HOLD, '1', tk, u, String(cfg.buy), JSON.stringify(rec), String(KEEP)]]);
      const [code, cur] = Array.isArray(held?.result) ? held.result : [0, ''];
      if (+code === 0) return res.status(409).json({ ok: false, error: 'Sold out', code: 'sold_out', golden: { ...(await stateOf(ev, cfg, u)), signedIn: true } });
      if (+code === 3) return res.status(200).json({ ok: true, golden: { ...(await stateOf(ev, cfg, u)), signedIn: true } }); // (they won one)
      let r0 = rec; try { r0 = JSON.parse(cur || 'null') || rec; } catch (e) {}
      if (r0.status === 'bought') return res.status(200).json({ ok: true, golden: { ...(await stateOf(ev, cfg, u)), signedIn: true } });
      if (r0.status === 'refunded') return res.status(409).json({ ok: false, error: 'Your ticket for this time was paid back', code: 'refunded' });
      // (a new hold, or an earlier try whose answer was lost: the same key, so the points are never taken twice)
      const p = await pay(ev, { ...cfg, price: r0.price || cfg.price }, s, r0, tk);
      if (!p.ok) return res.status(p.status).json({ ok: false, error: p.error, code: p.code, retry: p.retry, golden: { ...(await stateOf(ev, cfg, u)), signedIn: true } });
      return res.status(200).json({ ok: true, balance: p.balance, golden: { ...(await stateOf(ev, cfg, u)), signedIn: true } });
    }
    return res.status(400).json({ ok: false, error: 'Unknown action' });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, error: e.status ? e.message : 'Golden tickets are not available right now' });
  }
}
