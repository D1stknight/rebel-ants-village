// Forges cost Rebel Points (plans v2: 20,000 a forge, every forge; Miguel, Oct 20: for launch).
//   GET  /api/forge-start?quote=1  -> a charge id: one use, 15 minutes, bound to the wallet, the Economy account and the Rebel
//   POST /api/forge-start {chargeId} -> the points are taken under the economy key village:forge:<chargeId> (the same key
//        never takes twice, so a retried start never charges twice), then the forge window opens; at most SITE_DAILY paid
//        forges a day for the whole site
//   A rig of this Rebel finishing inside the window keeps the points (forge-rig-status -> keepForge). A window that ends
//   without one gives them back (key village:forge-refund:<chargeId>), from forge-sweep (the production cron) or the
//   Rebel's next forge status read (settleDue); when a sculpt or rig in it failed, the forge comes back too (a forge the
//   holder left unfinished stays used, as before forges had a price). A forge that could not open after the points were
//   taken gives them back at once. A wallet whose forge for this Rebel is still open carries on in it: nothing is taken.
// Records (shared by production and previews, like the economy itself): forge:charge:v1:quote:<id> (15 min),
// :rec:<id> (details) + :st:<id> (the state, changed only by compare-and-set), 90 days; :due (zset id -> due time, ms);
// :rebel:<col>:<tok> (the Rebel's last 20 charges); :site:<day> (paid forges that UTC day); :lock:<id> (one settler).
// States: new -> debiting -> charged -> opening -> open -> kept | refunding -> refunded; debiting -> declined (nothing
// taken); charged / opening -> refunding -> released (the window never opened).
import crypto from 'crypto';
import { redis, forgeStatus, forgePrecheck, openForge, giveForgeBack } from './_wallet.mjs';
import { econDebit, econCredit } from './_econ.mjs';

const rawPrice = process.env.FORGE_PRICE_POINTS;
export const FORGE_PRICE = rawPrice == null || rawPrice === '' ? 20000 : Math.max(0, parseInt(rawPrice, 10) || 0);   // 0 = free forges, as before
export const SITE_DAILY = Math.max(1, parseInt(process.env.FORGE_SITE_DAILY || '40', 10));
const P = 'forge:charge:v1', TTL = 90 * 86400, QUOTE_TTL = 900, WINDOW_MS = 24 * 3600e3, GRACE_MS = 3600e3, WAIT_MAX_MS = 24 * 3600e3;
const K = {
  quote: (id) => `${P}:quote:${id}`, rec: (id) => `${P}:rec:${id}`, st: (id) => `${P}:st:${id}`, due: `${P}:due`,
  rebel: (c, t) => `${P}:rebel:${c}:${t}`, site: (d) => `${P}:site:${d}`, lock: (id) => `${P}:lock:${id}`
};
export const CHARGE_ID = /^[0-9a-f]{32}$/;
const utcDay = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);
// the economy refused for good: nothing was taken (anything else may have been taken: the same key is tried again)
const DEFINITE = new Set(['insufficient_balance', 'user_not_found', 'user_not_active', 'economy_paused', 'invalid_amount', 'invalid_input', 'unauthorized', 'forbidden']);

const CAS = "if redis.call('GET', KEYS[1]) == ARGV[1] then redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3]) return 1 end return 0";
async function cas(id, from, to) { const [r] = await redis([['EVAL', CAS, '1', K.st(id), from, to, String(TTL)]]); return Number(r?.result) === 1; }
async function load(id) {
  const [r, s] = await redis([['GET', K.rec(id)], ['GET', K.st(id)]]);
  let rec = null; try { rec = r?.result ? JSON.parse(r.result) : null; } catch (e) {}
  return rec ? { ...rec, status: s?.result || null } : null;
}
const save = ({ status, ...rec }) => redis([['SET', K.rec(rec.id), JSON.stringify(rec), 'EX', String(TTL)]]);
const reasonText = (why, col, tok) => `Rebel Forge · ${col === 'battle_for_colony' ? 'Rebel' : col} #${tok}${why ? ' · ' + why : ''}`;

// what the page shows of a charge (only to the wallet that made it)
export const summary = (r) => r && { chargeId: r.id, status: r.status, amount: r.amount, at: r.at, chargedAt: r.chargedAt || null,
  startedAt: r.startedAt || null, dueAt: r.dueAt || null, keptAt: r.keptAt || null, refundedAt: r.refundedAt || null, why: r.refundWhy || null };

export async function newQuote({ wallet, u, col, tok }) {
  const id = crypto.randomBytes(16).toString('hex');
  await redis([['SET', K.quote(id), JSON.stringify({ wallet, u, col, tok, amount: FORGE_PRICE, at: Date.now() }), 'EX', String(QUOTE_TTL)]]);
  return { chargeId: id, price: FORGE_PRICE, expiresIn: QUOTE_TTL };
}

// the newest charge of this Rebel made by this wallet (the page's "last forge" line)
export async function lastCharge(col, tok, wallet) {
  const [l] = await redis([['LRANGE', K.rebel(col, tok), '0', '4']]);
  for (const id of l?.result || []) { const r = await load(id); if (r && r.wallet === wallet && r.status !== 'declined') return summary(r); }
  return null;
}

function refusal(r) {
  if (r.reason === 'daily') return { ok: false, error: 'This wallet has started enough forges for today. Come back tomorrow.', code: 'wallet_daily', used: r.used, limit: r.limit, left: r.left };
  if (r.reason === 'lifetime') return { ok: false, error: 'This Rebel has been forged the most times it can be.', code: 'no_forges_left', used: r.used, limit: r.limit, left: r.left };
  return { ok: false, error: `You have used all ${r.limit} of your forges for this Rebel`, code: 'no_forges_left', used: r.used, limit: r.limit, left: r.left };
}
async function decline(rec, status, body) {
  if (rec.site) { await redis([['DECR', K.site(rec.site)]]).catch(() => {}); rec.site = null; }
  rec.declined = { status, body }; await save(rec);
  await cas(rec.id, rec.status, 'declined');
  return { status, body };
}

// give the points back: final 'refunded' (the window ran out; forgeBack: the forge too) or 'released' (it never opened).
// One settler at a time; a failure leaves 'refunding' in the due set and the next settle tries again with the same key.
async function refund(rec, final, why, forgeBack = false) {
  const [lock] = await redis([['SET', K.lock(rec.id), '1', 'NX', 'EX', '120']]);
  if (lock?.result !== 'OK') return false;
  try {
    if (rec.status !== 'refunding') {
      rec.final = final; rec.refundWhy = why; rec.forgeBackDue = !!forgeBack; await save(rec);
      await redis([['ZADD', K.due, String(Date.now()), rec.id]]);          // a refund that fails is tried again by the sweep
      if (!(await cas(rec.id, rec.status, 'refunding'))) return false;
      rec.status = 'refunding';
    }
    const c = await econCredit({ userId: rec.u, amount: rec.amount, type: 'refund', idempotencyKey: `village:forge-refund:${rec.id}`,
      reason: reasonText(`points back: ${rec.refundWhy || why}`, rec.col, rec.tok), metadata: { kind: 'forge_refund', chargeId: rec.id, collectionKey: rec.col, tokenId: rec.tok } });
    rec.refundTx = c.transactionId; rec.refundedAt = Date.now(); rec.balance = c.newBalance;
    if ((rec.final || final) === 'refunded' && rec.forgeBackDue && !rec.forgeBack) { await giveForgeBack(rec.col, rec.tok, rec.owner); rec.forgeBack = true; }
    if ((rec.final || final) === 'released' && rec.site) { await redis([['DECR', K.site(rec.site)]]); rec.site = null; }
    await save(rec);
    await cas(rec.id, 'refunding', rec.final || final);
    await redis([['ZREM', K.due, rec.id]]);
    rec.status = rec.final || final;
    return true;
  } catch (e) {
    console.warn('[forge-charge] refund not done yet', rec.id, e.code || e.message);
    return false;
  } finally {
    await redis([['DEL', K.lock(rec.id)]]).catch(() => {});
  }
}

// POST /api/forge-start for a paid forge -> { status, body }
export async function startPaidForge({ chargeId, wallet, owner, u, col, tok }) {
  if (!CHARGE_ID.test(String(chargeId || ''))) return { status: 400, body: { ok: false, error: 'Get a new forge quote first', code: 'quote_required', price: FORGE_PRICE } };
  let rec = await load(chargeId);
  if (!rec) {
    const [q] = await redis([['GETDEL', K.quote(chargeId)]]);
    let quote = null; try { quote = q?.result ? JSON.parse(q.result) : null; } catch (e) {}
    if (!quote || quote.wallet !== wallet || quote.u !== u || quote.col !== col || quote.tok !== tok)
      return { status: 409, body: { ok: false, error: 'This forge quote has run out. Try again.', code: 'quote_expired', price: FORGE_PRICE } };
    const [made] = await redis([['SET', K.st(chargeId), 'new', 'NX', 'EX', String(TTL)]]);
    if (made?.result !== 'OK') return { status: 409, body: { ok: false, error: 'This forge is already starting', code: 'busy' } };
    rec = { id: chargeId, u, wallet, owner, col, tok, amount: quote.amount, at: Date.now() };
    await save(rec);
    await redis([['LPUSH', K.rebel(col, tok), chargeId], ['LTRIM', K.rebel(col, tok), '0', '19'], ['EXPIRE', K.rebel(col, tok), String(TTL)]]);
    rec.status = 'new';
  }
  if (rec.wallet !== wallet || rec.u !== u || rec.col !== col || rec.tok !== tok) return { status: 403, body: { ok: false, error: 'This forge was started by someone else', code: 'not_your_forge' } };
  const done = (r, extra = {}) => ({ status: 200, body: { ok: true, used: r.used, limit: r.limit, left: r.left, price: rec.amount, charged: rec.amount, balance: rec.balance ?? null, charge: summary(rec), ...extra } });

  if (rec.status === 'open' || rec.status === 'kept') return done(await forgeStatus(col, tok, owner), { already: true });
  if (rec.status === 'declined') return rec.declined || { status: 409, body: { ok: false, error: 'Try again', code: 'charge_closed' } };
  if (['refunding', 'refunded', 'released'].includes(rec.status)) return { status: 409, body: { ok: false, error: 'Your points for this forge were given back. Start a new one.', code: 'charge_closed', charge: summary(rec) } };

  if (rec.status === 'new') {
    const pre = await forgePrecheck(col, tok, owner);
    // this wallet's forge for the Rebel is still open (a page that lost track of it): carry on in it, nothing taken
    if (pre.open && pre.open.wallet === wallet) return decline(rec, 200, { ok: true, already: true, used: pre.used, limit: pre.limit, left: pre.left, price: rec.amount, charged: 0 });
    if (!pre.ok) return decline(rec, 429, refusal(pre));
    if (!(await cas(rec.id, 'new', 'debiting'))) return { status: 409, body: { ok: false, error: 'This forge is already starting', code: 'busy' } };
    rec.status = 'debiting';
    // the site's paid forges today (counted by the start that won the state change, so a racing twin never counts twice)
    const d = utcDay(), [n] = await redis([['INCR', K.site(d)], ['EXPIRE', K.site(d), '172800']]);
    if (Number(n?.result) > SITE_DAILY) { await redis([['DECR', K.site(d)]]); return decline(rec, 429, { ok: false, error: 'The Forge is full for today. Come back tomorrow.', code: 'site_daily' }); }
    rec.site = d; await save(rec);
  }

  if (rec.status === 'debiting') {
    try {
      const d = await econDebit({ userId: u, amount: rec.amount, idempotencyKey: `village:forge:${rec.id}`, reason: reasonText('a forge', col, tok),
        metadata: { kind: 'forge', chargeId: rec.id, collectionKey: col, tokenId: tok } });
      rec.tx = d.transactionId; rec.balance = d.newBalance; rec.chargedAt = Date.now(); await save(rec);
      if (!(await cas(rec.id, 'debiting', 'charged'))) return { status: 409, body: { ok: false, error: 'This forge is already starting', code: 'busy' } };
      rec.status = 'charged';
    } catch (e) {
      if (DEFINITE.has(e.code)) {
        const poor = e.code === 'insufficient_balance';
        return decline(rec, poor ? 402 : 409, { ok: false, code: poor ? 'not_enough_points' : 'econ_refused', price: rec.amount,
          error: poor ? `A forge takes ${rec.amount.toLocaleString('en-US')} Rebel Points. Earn more in the village or get a points pack.` : (e.message || 'The Rebel Economy did not take the points') });
      }
      return { status: 502, body: { ok: false, error: 'The Rebel Economy did not answer. Try again: you are never charged twice.', code: 'econ_retry', retry: true, chargeId: rec.id } };
    }
  }

  if (rec.status === 'charged' || rec.status === 'opening') {
    let r = null;
    if (rec.status === 'opening') {               // a start that stopped half way: its window may be open already
      const st = await forgeStatus(col, tok, owner);
      if (st.open && st.open.wallet === wallet && Date.parse(st.open.startedAt) >= (rec.chargedAt || 0) - 1000) r = { ok: true, used: st.used, limit: st.limit, left: st.left, open: st.open };
    } else if (!(await cas(rec.id, 'charged', 'opening'))) return { status: 409, body: { ok: false, error: 'This forge is already starting', code: 'busy' } };
    rec.status = 'opening';
    if (!r) r = await openForge(col, tok, wallet, owner);
    if (!r.ok) {
      const back = await refund(rec, 'released', 'the forge could not open');
      return { status: 429, body: { ...refusal(r), refunded: back, charge: summary(rec) } };
    }
    rec.startedAt = Date.parse(r.open.startedAt) || Date.now(); rec.dueAt = rec.startedAt + WINDOW_MS + GRACE_MS; rec.n = r.open.n;
    await save(rec);
    await redis([['ZADD', K.due, String(rec.dueAt), rec.id]]);
    await cas(rec.id, 'opening', 'open');
    rec.status = 'open';
    return done(r);
  }
  return { status: 409, body: { ok: false, error: 'Try again', code: 'busy' } };
}

// a rig of this Rebel finished (forge-rig-status): the newest open charge whose window the build was made in keeps its points
export async function keepForge(col, tok, builtAt) {
  const [l] = await redis([['LRANGE', K.rebel(col, tok), '0', '19']]);
  for (const id of l?.result || []) {
    const rec = await load(id);
    if (!rec || rec.status !== 'open') continue;
    if (builtAt && (builtAt < rec.startedAt - 5e3 || builtAt > rec.startedAt + WINDOW_MS)) continue;
    if (await cas(id, 'open', 'kept')) { rec.keptAt = Date.now(); await save(rec); await redis([['ZREM', K.due, id]]); return id; }
  }
  return null;
}

// what came of the Rebel's builds made in a charge's window (the list is newest first): 'rigged' (a rig finished),
// 'busy' (a rig running, or a sculpt the sweep looked at in the last 2 h), 'failed' (the newest build's sculpt or rig
// failed, or its sculpt never finished), 'unfinished' (its sculpt is done, no rig: the holder stopped at the versions)
// or null (no build: the holder stopped before the sculpt)
const SCULPTING = new Set(['queued_for_future_3d_generation', 'submitted_to_meshy', 'meshy_pending', 'meshy_in_progress']);
async function windowResult(rec) {
  const [l] = await redis([['LRANGE', `forge:3d-builds:v1:${rec.col}:${rec.tok}`, '0', '19']]);
  const ids = l?.result || [];
  if (!ids.length) return null;
  const got = await redis(ids.map((id) => ['GET', `forge:3d-build:v1:${id}`]));
  let busy = false, newest = null;
  for (const g of got) {
    let b = null; try { b = g?.result ? JSON.parse(g.result) : null; } catch (e) {}
    const at = Date.parse(b?.createdAt || '') || 0;
    if (!b || at < rec.startedAt - 5e3 || at > rec.startedAt + WINDOW_MS) continue;
    if (b.forgeRig?.status === 'succeeded') return 'rigged';
    if (b.forgeRig?.status === 'running' || (SCULPTING.has(b.status) && Date.now() - (Date.parse(b.updatedAt || '') || 0) < 2 * 3600e3)) busy = true;
    newest = newest || b;
  }
  if (busy) return 'busy';
  if (!newest) return null;
  return newest.forgeRig?.status === 'failed' || newest.status === 'failed' || SCULPTING.has(newest.status) ? 'failed' : 'unfinished';
}

// windows that ended (and refunds still owed): keep the points when a rig finished in the window, wait while one is
// running, else give them back. All due charges, or one Rebel's. -> [[chargeId, what]]
export async function settleDue({ col, tok, limit = 20 } = {}) {
  const now = Date.now(), out = [];
  let ids;
  if (col) { const [l] = await redis([['LRANGE', K.rebel(col, tok), '0', '19']]); ids = l?.result || []; }
  else { const [z] = await redis([['ZRANGEBYSCORE', K.due, '-inf', String(now), 'LIMIT', '0', String(limit)]]); ids = z?.result || []; }
  for (const id of ids) {
    const rec = await load(id);
    if (!rec) { if (!col) await redis([['ZREM', K.due, id]]); continue; }
    if (rec.status === 'refunding') { out.push([id, (await refund(rec, rec.final || 'refunded', rec.refundWhy || 'the forge ended without a character')) ? rec.status : 'retry']); continue; }
    if (rec.status !== 'open') { if (!col && rec.status !== 'opening') await redis([['ZREM', K.due, id]]); continue; }
    if (!(rec.dueAt <= now)) continue;
    const w = await windowResult(rec);
    if (w === 'rigged') {
      if (await cas(id, 'open', 'kept')) { rec.keptAt = now; await save(rec); }
      await redis([['ZREM', K.due, id]]); out.push([id, 'kept']); continue;
    }
    // still sculpting or rigging: look again in an hour, for at most a day past the window
    if (w === 'busy' && now < rec.startedAt + WINDOW_MS + WAIT_MAX_MS) { rec.dueAt = now + GRACE_MS; await save(rec); await redis([['ZADD', K.due, String(rec.dueAt), id]]); out.push([id, 'later']); continue; }
    const failed = w === 'failed' || w === 'busy';
    out.push([id, (await refund(rec, 'refunded', failed ? 'the forge failed' : 'the forge ended without a character', failed)) ? 'refunded' : 'retry']);
  }
  return out;
}
