// RAAP <-> Universe dev: one exact chest, owner-approved (Oct 19). raap-core docs/integrations/universe-v1/chest
// (README §2-3, CONTRACT_NOTES, protocol.d.ts, reference.mjs). G4's World action: an existing chest, its existing reward.
//   READ         the connection's allowlisted chests: reward (the server catalog), available / refusal, the state
//   PREPARE      one CHEST_OPEN against the current account link and state: the exact reward and its idempotency
//                commitment (the existing economy key village:chest:<id>:<user>, hashed: the user id stays here)
//   EXECUTE      the owner-approved request, once. One Lua script saves the intent and claims the chest in the game's
//                own ledger (the same claimed set a human claim uses), under the existing daily cap: past it the reward
//                is held as an ordinary owed record (HELD). Else the intent is marked CREDITING and the economy credit
//                is sent once with the existing key: PAID keeps its transaction id. Never pays other held rewards
//                (no payOwed). A lost or unclear credit answer stays OUTCOME_UNKNOWN: it is never sent again from here.
//   RECEIPT      the saved result (an admitted request reads PENDING, a credit in flight OUTCOME_UNKNOWN)
//   LINK_STATUS  the current account link for the connection's Rebel (never the Economy user id)
// Off unless RAAP_UNIVERSE_DEV_CONNECTION has a chest section whose chests are all in the catalog. Never production.
// Records: raap:v1:dev:chest-request:<connectionId>:<requestId> and the player's version (until retainUntil).
// Shared game records it writes, exactly as a human claim does: econ:v1:claimed:<user> (chest:<id>),
// econ:v1:day:<user>:<UTC day>, econ:v1:owed:<user> (held), econ:v1:log:<user>; the Economy credit (game_reward).
import { canonical, commitment, playerIdOf, connectionConfig, retainAt, signedBy, V, devKey, playerHash, targetOf, ABSENT, ZERO, fail, ok, parse, sha256 } from './_raap-universe.mjs';
import { currentLink, linkStatus, refOf, isLinkRef, ownership, endLinkIfSold, sharingKey, sharingStatus, currentKey, linkKey } from './_raap-universe-link.mjs';
import { lookup, KEYS, oneTimeKey, capApplies, owedRecord, logEntry, CAP, DAY_TTL, ONE_TIME_UNCAPPED, utcDay } from './_econ-ledger.mjs';

const { RX, exact, str, secs, isAsset, isState, isZero, isTarget } = V;
export const MAX_LIFETIME = 900;
const RESUME_AFTER = 30;            // an ADMITTED intent older than this is picked up again by a repeated EXECUTE
// economy answers that mean "not done" (it refused before writing anything)
const DEFINITE = new Set(['user_not_found', 'user_not_active', 'economy_paused', 'invalid_amount', 'invalid_input', 'unauthorized', 'forbidden']);

export const requestCommitmentOf = (r) => commitment(r.schema, r);
export const chestReceiptId = (r) => commitment('universe.raap.chest-receipt-id.v1', { connectionId: r.connectionId, requestId: r.requestId });
export const idempotencyCommitment = (key) => commitment('universe.raap.chest-credit.v1', { idempotencyKey: key });
const stamp = (t) => new Date(t * 1000).toISOString();
// the readable message the owner signs (reference.mjs chestMessage, byte for byte)
export function chestMessage(r) {
  return ['RAAP approval', '', `Open one Universe chest for Rebel #${r.asset.tokenId}`, `Chest ID: ${r.action.chestId}`,
    `Maximum game charge: 0 REBEL. Existing chest reward: ${r.economyEffect.units} REBEL points.`,
    'The game\'s daily cap may hold this reward for later. No other held rewards are included.',
    'This approves one chest claim, not navigation, an Ethereum transaction or an NFT transfer.',
    `Player wallet: ${r.player.wallet}`, `Linked account: ${r.link.accountCommitment}`, `Expires (UTC): ${stamp(r.expiresAt)}`, '', 'Verification details',
    'Protocol: RAAP Universe Chest / 1', `Environment: ${r.environment}`, `Website: ${r.issuer}`, `Game: ${r.audience}`,
    `Network chain ID: ${r.asset.chainId}`, `Collection: ${r.asset.collection}`, `Controller epoch: ${r.controller.epoch}`,
    `Rebel account: ${r.account}`, `Connection: ${r.connectionId} / ${r.connectionRevision}`, `Account link: ${r.link.linkId} / ${r.link.revision}`,
    `State version: ${r.state.version}`, `Journal: ${r.journalId}`, `Request ID: ${r.requestId}`, `Request: ${requestCommitmentOf(r)}`].join('\n');
}

// ---- strict shapes (chest/schemas.json) ----
const isAction = (a) => exact(a, ['kind', 'chestId']) && a.kind === 'CHEST_OPEN' && str(a.chestId, RX.id);
const isReward = (e) => exact(e, ['kind', 'currency', 'units', 'beneficiary', 'idempotencyCommitment', 'settlement']) && e.kind === 'EXISTING_CHEST_REWARD'
  && e.currency === 'REBEL' && str(e.units, RX.dec) && str(e.beneficiary, RX.hex32) && str(e.idempotencyCommitment, RX.hex32) && e.settlement === 'EXISTING_DAILY_CAP';
const isRequest = (r) => exact(r, ['schema', 'environment', 'issuer', 'audience', 'tenant', 'journalId', 'requestId', 'connectionId', 'connectionRevision', 'player', 'asset',
  'controller', 'account', 'contextCommitment', 'state', 'configurationCommitment', 'action', 'maximumCharge', 'economyEffect', 'issuedAt', 'expiresAt', 'link'])
  && r.schema === 'raap.universe.chest-action.v1' && r.environment === 'dev' && str(r.issuer, RX.origin, 256) && str(r.audience, RX.origin, 256)
  && str(r.tenant, RX.id) && str(r.journalId, RX.hex32) && str(r.requestId, RX.hex32) && str(r.connectionId, RX.id) && str(r.connectionRevision, RX.dec)
  && exact(r.player, ['id', 'wallet', 'economyAccountId']) && str(r.player.id, RX.player) && str(r.player.wallet, RX.addr) && r.player.economyAccountId === null
  && isAsset(r.asset) && exact(r.controller, ['address', 'epoch']) && str(r.controller.address, RX.addr) && secs(r.controller.epoch) && str(r.account, RX.addr)
  && str(r.contextCommitment, RX.hex32) && isState(r.state) && str(r.configurationCommitment, RX.hex32) && isAction(r.action) && isZero(r.maximumCharge)
  && isReward(r.economyEffect) && secs(r.issuedAt) && secs(r.expiresAt) && isLinkRef(r.link);
const isAuthorized = (a) => exact(a, ['schema', 'request', 'ownerApproval']) && a.schema === 'raap.universe.authorized-chest-action.v1' && isRequest(a.request)
  && exact(a.ownerApproval, ['scheme', 'signer', 'signature']) && a.ownerApproval.scheme === 'eip191-personal-sign' && str(a.ownerApproval.signer, RX.addr) && str(a.ownerApproval.signature, RX.sig);
export function isChestOperation(o) {
  if (!V.isObj(o)) return false;
  switch (o.operation) {
    case 'READ': return exact(o, ['operation', 'target', 'link']) && isTarget(o.target) && isLinkRef(o.link);
    case 'PREPARE': return exact(o, ['operation', 'target', 'link', 'action']) && isTarget(o.target) && isLinkRef(o.link) && isAction(o.action);
    case 'EXECUTE': return exact(o, ['operation', 'authorization']) && isAuthorized(o.authorization);
    case 'RECEIPT': return exact(o, ['operation', 'target', 'link', 'requestId', 'requestCommitment']) && isTarget(o.target) && isLinkRef(o.link) && str(o.requestId, RX.hex32) && str(o.requestCommitment, RX.hex32);
    case 'LINK_STATUS': return exact(o, ['operation', 'target']) && isTarget(o.target);
    default: return false;
  }
}

// ---- configuration ----
// the chests this connection may open, from the server catalog (a chest id the catalog doesn't know = the route stays off)
export function chestRows(c) {
  const rows = [...c.chest.chests].sort().map((id) => { const e = lookup('chest', id); return e ? { chestId: id, villageId: e.village, rewardUnits: String(e.amount) } : null; });
  return rows.every(Boolean) ? rows : null;
}
export function chestConfigurationCommitment(c, rows) {
  return commitment('universe.raap.chest-configuration.v1', {
    handler: 'universe-raap-chest/1', environment: 'dev', connectionId: c.connectionId, connectionRevision: c.connectionRevision, issuer: c.issuer, audience: c.audience,
    tenant: c.tenant, journalId: c.journalId, playerId: playerIdOf(c.wallet), asset: c.asset, collectionKey: c.collectionKey, account: c.account,
    controllerEpoch: c.controllerEpoch, operations: [...c.chest.operations].sort(), chests: rows,
    reward: { kind: 'EXISTING_CHEST_REWARD', currency: 'REBEL', settlement: 'EXISTING_DAILY_CAP', dailyCap: CAP, oneTimeUncapped: ONE_TIME_UNCAPPED,
      claim: 'once per Economy account (econ:v1:claimed:<user> chest:<id>)', credit: 'village:chest:<id>:<user>', heldRewardsPaidHere: false },
    maxLifetime: MAX_LIFETIME, validUntil: c.validUntil, retention: { until: c.retainUntil }, link: { approveSeconds: 300, maxSeconds: 86400 },
    keys: { request: 'raap:v1:dev:chest-request:<connectionId>:<requestId>', version: 'raap:v1:dev:player:<playerHash>:version', link: 'raap:v1:dev:link:<linkId>' },
    maximumCharge: ZERO
  });
}
const versionKey = (c) => devKey(`player:${playerHash(playerIdOf(c.wallet))}:version`);
const requestKey = (c, requestId) => devKey(`chest-request:${c.connectionId}:${requestId}`);
const member = (id) => `chest:${id}`;

// ---- state: the link pointer + record, and each chest's claim and held record, named by the account commitment ----
const READ_LUA = `
local out={redis.call('GET',KEYS[1]) or '0',redis.call('GET',KEYS[2]) or '${ABSENT}',redis.call('GET',KEYS[3]) or '${ABSENT}'}
local n=tonumber(ARGV[1])
for i=1,n do out[#out+1]=tostring(redis.call('SISMEMBER',KEYS[4],ARGV[1+i])) end
for i=1,n do out[#out+1]=redis.call('HGET',KEYS[5],ARGV[1+n+i]) or '${ABSENT}' end
return out
`;
export function chestStateCommitment(c, cc, s, ids) {
  const A = s.rec.accountCommitment, h = (v) => (v === ABSENT || v == null ? null : '0x' + sha256(v));
  const records = [{ key: currentKey(c), rawSha256: h(s.currentRaw) }, { key: linkKey(s.rec.linkId), rawSha256: h(s.linkRaw) }];
  ids.forEach((id, i) => {
    records.push({ key: `econ:v1:claimed:${A}#${member(id)}`, rawSha256: s.claimed[i] ? '0x' + sha256('1') : null });
    records.push({ key: `econ:v1:owed:${A}#village:chest:${id}:${A}`, rawSha256: h(s.owed[i]) });
  });
  records.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return commitment('universe.raap.chest-state.v1', { playerId: playerIdOf(c.wallet), records, configurationCommitment: cc });
}
// one atomic read: { version, currentRaw, linkRaw, rec, claimed[], owed[] } for the link record cur (its user)
async function readState(c, deps, cur, ids) {
  const u = cur.rec.economyUserId;
  const vals = await deps.redis(['EVAL', READ_LUA, '5', versionKey(c), currentKey(c), linkKey(cur.rec.linkId), KEYS.claimed(u), KEYS.owed(u),
    String(ids.length), ...ids.map(member), ...ids.map((id) => oneTimeKey('chest', id, u))]);
  if (!Array.isArray(vals) || vals.length !== 3 + 2 * ids.length || !RX.dec.test(String(vals[0]))) throw Error('State unreadable');
  return { version: String(vals[0]), currentRaw: vals[1], linkRaw: vals[2], rec: cur.rec, claimed: vals.slice(3, 3 + ids.length).map((v) => String(v) === '1'),
    owed: vals.slice(3 + ids.length) };
}
const stateOf = (c, cc, s, ids) => ({ version: s.version, commitment: chestStateCommitment(c, cc, s, ids) });

// ---- the guarded writes ----
// Admit: same request id = the saved record; the version, the link pointer + record, the chest's claim and held record
// must be exactly what the request was approved against; inside its time (Redis clock). Then, with nothing fallible
// after: claim the chest, bump the version, and either hold the reward past the daily cap (HELD, final receipt) or save
// the intent (ADMITTED). KEYS: request, version, current, link, claimed, owed, day. ARGV: version, link id, link raw,
// member, idempotency key, owed raw, issuedAt, expiresAt, capped, amount, cap, day ttl, new version, intent, held
// receipt, owed record, retain-until
export const ADMIT_LUA = `
local prior=redis.call('GET',KEYS[1])
if prior then return {'RECORDED',prior} end
if (redis.call('GET',KEYS[2]) or '0')~=ARGV[1] then return {'STALE'} end
if (redis.call('GET',KEYS[3]) or '${ABSENT}')~=ARGV[2] then return {'LINK'} end
if (redis.call('GET',KEYS[4]) or '${ABSENT}')~=ARGV[3] then return {'LINK'} end
if redis.call('SISMEMBER',KEYS[5],ARGV[4])==1 then return {'CLAIMED'} end
if (redis.call('HGET',KEYS[6],ARGV[5]) or '${ABSENT}')~=ARGV[6] then return {'STALE'} end
local t=tonumber(redis.call('TIME')[1])
if t<tonumber(ARGV[7]) or t>=tonumber(ARGV[8]) then return {'EXPIRED'} end
redis.call('SADD',KEYS[5],ARGV[4])
redis.call('SET',KEYS[2],ARGV[13],'EXAT',tonumber(ARGV[17]))
if ARGV[9]=='1' then
  local n=redis.call('INCRBY',KEYS[7],tonumber(ARGV[10]))
  redis.call('EXPIRE',KEYS[7],tonumber(ARGV[12]))
  if n>tonumber(ARGV[11]) then
    redis.call('DECRBY',KEYS[7],tonumber(ARGV[10]))
    redis.call('HSET',KEYS[6],ARGV[5],ARGV[16])
    redis.call('SET',KEYS[1],ARGV[15],'EXAT',tonumber(ARGV[17]))
    return {'HELD'}
  end
end
redis.call('SET',KEYS[1],ARGV[14],'EXAT',tonumber(ARGV[17]))
return {'ADMITTED'}
`;
// compare-and-set of the request record. KEYS: request. ARGV: expected raw, new raw, retain-until
const CAS_LUA = `
if redis.call('GET',KEYS[1])~=ARGV[1] then return 'CHANGED' end
redis.call('SET',KEYS[1],ARGV[2],'EXAT',tonumber(ARGV[3]))
return 'DONE'
`;
// paid: the final receipt + the player's award log line. KEYS: request, log. ARGV: crediting raw, receipt, retain-until, log entry
const PAID_LUA = `
if redis.call('GET',KEYS[1])~=ARGV[1] then return 'CHANGED' end
redis.call('SET',KEYS[1],ARGV[2],'EXAT',tonumber(ARGV[3]))
redis.call('LPUSH',KEYS[2],ARGV[4])
redis.call('LTRIM',KEYS[2],0,39)
return 'DONE'
`;
// the economy refused for certain: the claim and today's count go back (as a human claim's does), declined.
// KEYS: request, claimed, day. ARGV: crediting raw, member, capped, amount, declined receipt, retain-until
const UNDO_LUA = `
if redis.call('GET',KEYS[1])~=ARGV[1] then return 'CHANGED' end
redis.call('SREM',KEYS[2],ARGV[2])
if ARGV[3]=='1' then redis.call('DECRBY',KEYS[3],tonumber(ARGV[4])) end
redis.call('SET',KEYS[1],ARGV[5],'EXAT',tonumber(ARGV[6]))
return 'DECLINED'
`;

// ---- receipts ----
function receiptOf(r, rc, o) {
  return { schema: 'universe.raap.chest-receipt.v1', environment: 'dev', connectionId: r.connectionId, requestId: r.requestId, requestCommitment: rc,
    receiptId: chestReceiptId(r), playerId: r.player.id, asset: r.asset, controllerEpoch: r.controller.epoch, origin: 'RAAP_APPROVED', link: r.link,
    action: r.action, status: o.status, reason: o.reason, before: o.before, after: o.after, effects: o.effects,
    actualCharge: o.status === 'APPLIED' || o.status === 'DECLINED' ? ZERO : null, economyEffect: r.economyEffect,
    acceptedAt: o.acceptedAt, committedAt: o.committedAt, reward: o.reward };
}
const NONE_REWARD = (ic) => ({ status: 'NONE', units: '0', economyTransactionId: null, idempotencyCommitment: ic, recordCommitment: null });
const UNKNOWN_REWARD = (ic) => ({ status: 'UNKNOWN', units: null, economyTransactionId: null, idempotencyCommitment: ic, recordCommitment: null });
const paidRecord = (tx, ic, units) => commitment('universe.raap.chest-record.v1', { settlement: 'PAID', economyTransactionId: tx, idempotencyCommitment: ic, units });
const heldRecord = (owed, ic, units) => commitment('universe.raap.chest-record.v1', { settlement: 'HELD', owedRecordSha256: '0x' + sha256(owed), idempotencyCommitment: ic, units });
// a saved record as RAAP reads it: a final receipt, or an intent (ADMITTED = PENDING, CREDITING = OUTCOME_UNKNOWN)
function render(rec) {
  if (rec.schema === 'universe.raap.chest-receipt.v1') return rec;
  const r = rec.request;
  return receiptOf(r, rec.requestCommitment, { status: rec.status === 'ADMITTED' ? 'PENDING' : 'OUTCOME_UNKNOWN', reason: 'AWAITING_CONFIRMATION', before: r.state,
    after: null, effects: [], acceptedAt: rec.acceptedAt, committedAt: null, reward: UNKNOWN_REWARD(r.economyEffect.idempotencyCommitment) });
}

// raw = the exact request bytes. deps = { env, now() (Unix s), redis(args) (one command), owner(collectionKey, tokenId),
// contract(collectionKey), credit({ userId, amount, reason, metadata, idempotencyKey }) (the economy, econCredit),
// creditReady() (the economy settings exist), onClaim(claim) (optional: the experience feed) }
export async function handleChestOperation(raw, deps) {
  if (!Buffer.isBuffer(raw) || !raw.length || raw.length > 65536) return fail(400, 'MALFORMED');
  let text, op;
  try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(raw); op = JSON.parse(text); } catch (e) { return fail(400, 'MALFORMED'); }
  if (!isChestOperation(op)) return fail(400, 'MALFORMED');
  try { if (canonical(op) !== text) return fail(400, 'NOT_CANONICAL'); } catch (e) { return fail(400, 'MALFORMED'); }

  const c = connectionConfig(deps.env), rows = c && c.chest ? chestRows(c) : null;
  if (deps.env.VERCEL_ENV === 'production' || !c || !c.chest || !rows) return fail(403, 'CONNECTION_UNAVAILABLE');
  if (!c.chest.operations.includes(op.operation)) return fail(403, 'OPERATION_NOT_PERMITTED');
  const now = deps.now();
  if (!['RECEIPT', 'LINK_STATUS'].includes(op.operation) && (c.status !== 'ACTIVE' || now >= c.validUntil)) return fail(403, 'CONNECTION_CLOSED');
  if (op.operation !== 'EXECUTE' && canonical(op.target) !== canonical(targetOf(c))) return fail(403, 'NOT_AUTHORIZED');
  const cc = chestConfigurationCommitment(c, rows), byId = Object.fromEntries(rows.map((x) => [x.chestId, x]));

  if (op.operation === 'LINK_STATUS') {
    const cur = await currentLink(c, deps), rec = cur.rec, status = linkStatus(c, rec, now);
    const s = rec ? parse(await deps.redis(['GET', sharingKey(rec.linkId)])) : null;
    return ok({ schema: 'universe.raap.link-status.v1', target: op.target, connectionRevision: c.connectionRevision, controllerEpoch: c.controllerEpoch, status,
      link: rec ? refOf(rec) : null, validUntil: rec ? rec.validUntil : null,
      sharing: s ? { status: sharingStatus(c, rec, s, now), selectionId: s.selectionId, eventKinds: s.eventKinds, validUntil: s.validUntil } : null, observedAt: now });
  }
  if (op.operation === 'RECEIPT') {
    const saved = parse(await deps.redis(['GET', requestKey(c, op.requestId)]));
    if (!saved) return ok({ schema: 'universe.raap.chest-receipt-read.v1', requestId: op.requestId, status: 'NOT_FOUND', receipt: null });
    const v = render(saved);
    if (v.requestCommitment !== op.requestCommitment || canonical(v.link) !== canonical(op.link)) return fail(409, 'REQUEST_ID_CONFLICT');
    return ok({ schema: 'universe.raap.chest-receipt-read.v1', requestId: op.requestId, status: 'FOUND', receipt: v });
  }
  if ((await deps.contract(c.collectionKey)) !== c.asset.collection) return fail(403, 'CONNECTION_UNAVAILABLE');

  if (op.operation === 'READ' || op.operation === 'PREPARE') {
    const cur = await currentLink(c, deps);
    if (!cur.rec || canonical(refOf(cur.rec)) !== canonical(op.link)) return fail(409, 'LINK_CHANGED');
    if (linkStatus(c, cur.rec, now) !== 'LINKED') return fail(403, 'LINK_NOT_ACTIVE');
    const own = await ownership(c, deps);
    if (own === 'UNKNOWN') return fail(503, 'TEMPORARILY_UNAVAILABLE', { committed: false });
    if (own === 'NOT_OWNED') await endLinkIfSold(c, deps, now);
    const ids = op.operation === 'READ' ? rows.map((x) => x.chestId) : [op.action.chestId];
    if (op.operation === 'PREPARE' && !byId[op.action.chestId]) return fail(422, 'ACTION_UNAVAILABLE', { reason: 'UNSUPPORTED_ACTION' });
    const s = await readState(c, deps, cur, ids);
    if (s.currentRaw !== cur.rec.linkId || s.linkRaw !== cur.raw) return fail(409, 'LINK_CHANGED');
    const refusal = (i) => (own !== 'OWNED' ? 'NOT_OWNED' : s.claimed[i] ? 'ALREADY_CLAIMED' : 'NONE');
    if (op.operation === 'READ') {
      return ok({ schema: 'universe.raap.chest-inventory.v1', target: op.target, link: op.link, state: stateOf(c, cc, s, ids), configurationCommitment: cc, observedAt: now,
        chests: rows.map((x, i) => ({ chestId: x.chestId, villageId: x.villageId, rewardUnits: x.rewardUnits, available: refusal(i) === 'NONE', refusal: refusal(i) })) });
    }
    if (refusal(0) !== 'NONE') return fail(422, 'ACTION_UNAVAILABLE', { reason: refusal(0) });
    const x = byId[op.action.chestId];
    return ok({ schema: 'universe.raap.chest-preparation.v1', target: op.target, link: op.link, action: op.action, state: stateOf(c, cc, s, ids),
      configurationCommitment: cc, maximumCharge: ZERO,
      economyEffect: { kind: 'EXISTING_CHEST_REWARD', currency: 'REBEL', units: x.rewardUnits, beneficiary: cur.rec.accountCommitment,
        idempotencyCommitment: idempotencyCommitment(oneTimeKey('chest', x.chestId, cur.rec.economyUserId)), settlement: 'EXISTING_DAILY_CAP' },
      observedAt: now, expiresAt: Math.min(now + MAX_LIFETIME, c.validUntil, cur.rec.validUntil) });
  }

  // ---- EXECUTE ----
  const auth = op.authorization, r = auth.request;
  const pinned = r.issuer === c.issuer && r.audience === c.audience && r.connectionId === c.connectionId && r.connectionRevision === c.connectionRevision
    && r.tenant === c.tenant && r.journalId === c.journalId && r.player.wallet === c.wallet && r.player.id === playerIdOf(c.wallet)
    && r.controller.address === c.wallet && r.controller.epoch === c.controllerEpoch && r.account === c.account && canonical(r.asset) === canonical(c.asset)
    && r.economyEffect.beneficiary === r.link.accountCommitment && auth.ownerApproval.signer === c.wallet;
  if (!pinned || !(await signedBy(chestMessage(r), auth.ownerApproval, c.wallet))) return fail(403, 'NOT_AUTHORIZED');
  const rc = requestCommitmentOf(r), rKey = requestKey(c, r.requestId), ic = r.economyEffect.idempotencyCommitment, retain = String(retainAt(c, r.expiresAt));
  const savedResult = async (raw2) => {
    const rec = parse(raw2);
    if (!rec || (rec.requestCommitment !== rc)) return fail(409, 'REQUEST_ID_CONFLICT');
    // an intent the first executor left behind before sending anything is finished now (never a second credit)
    if (rec.status === 'ADMITTED' && now - rec.acceptedAt >= RESUME_AFTER) return settle(raw2, rec);
    return ok(render(rec));
  };
  // a definite refusal is kept like a success: the same request id always gets this answer
  const decline = async (reason, before) => {
    const d = receiptOf(r, rc, { status: 'DECLINED', reason, before, after: before, effects: [], acceptedAt: null, committedAt: null, reward: NONE_REWARD(ic) });
    let set;
    try { set = await deps.redis(['SET', rKey, canonical(d), 'NX', 'EXAT', retain]); } catch (e) { return fail(503, 'RECEIPT_NOT_SAVED', { committed: false }); }
    return set === 'OK' ? ok(d) : savedResult(await deps.redis(['GET', rKey]));
  };
  // send the one credit for an admitted intent: ADMITTED -> CREDITING (nothing sent unless that write is confirmed)
  async function settle(admittedRaw, rec) {
    const crediting = canonical({ ...rec, status: 'CREDITING', creditingAt: deps.now() });
    let mark;
    try { mark = await deps.redis(['EVAL', CAS_LUA, '1', rKey, admittedRaw, crediting, retain]); } catch (e) { return ok(render(rec)); }   // still ADMITTED: PENDING
    if (mark !== 'DONE') return ok(render(parse(await deps.redis(['GET', rKey])) || rec));
    const lrec = parse(await deps.redis(['GET', linkKey(r.link.linkId)]));
    const u = lrec?.economyUserId, x = byId[r.action.chestId] || { villageId: rec.village, rewardUnits: r.economyEffect.units };
    if (!u) return ok(render(parse(crediting)));                         // cannot happen: the record outlives the request
    let res, err = null;
    try {
      res = await deps.credit({ userId: u, amount: Number(r.economyEffect.units), reason: lookup('chest', r.action.chestId)?.reason || `Rebel Ants Village · ${x.villageId} · ${r.action.chestId} · chest`,
        metadata: { kind: 'chest', id: r.action.chestId, village: x.villageId, origin: 'RAAP_APPROVED', requestId: r.requestId }, idempotencyKey: oneTimeKey('chest', r.action.chestId, u) });
    } catch (e) { err = e; }
    if (err) {
      if (!(err.economyStatus && DEFINITE.has(err.code))) return ok(render(parse(crediting)));        // no answer / unclear: OUTCOME_UNKNOWN, kept
      const d = receiptOf(r, rc, { status: 'DECLINED', reason: 'NOT_AUTHORIZED', before: r.state, after: r.state, effects: [], acceptedAt: null, committedAt: null, reward: NONE_REWARD(ic) });
      let undo;
      try { undo = await deps.redis(['EVAL', UNDO_LUA, '3', rKey, KEYS.claimed(u), rec.dayKey ? KEYS.day(u, rec.dayKey) : KEYS.day(u, utcDay()), crediting,
        member(r.action.chestId), rec.capped ? '1' : '0', r.economyEffect.units, canonical(d), retain]); } catch (e) { undo = null; }
      return undo === 'DECLINED' ? ok(d) : ok(render(parse(crediting)));
    }
    const tx = String(res?.transactionId || '');
    // the economy's answer must be this very credit (a repeated key answers with its first transaction)
    if (!RX.id.test(tx) || res.userId !== u || res.amount !== r.economyEffect.units) {
      const kept = canonical({ ...parse(crediting), economyAnswer: { transactionId: tx || null, sameUser: res?.userId === u, amount: res?.amount ?? null } });
      try { await deps.redis(['EVAL', CAS_LUA, '1', rKey, crediting, kept, retain]); } catch (e) {}
      return ok(render(parse(crediting)));
    }
    const committedAt = Math.max(deps.now(), rec.acceptedAt);
    const fin = receiptOf(r, rc, { status: 'APPLIED', reason: 'NONE', before: r.state, after: rec.after, effects: [{ kind: 'CHEST_CLAIM', chestId: r.action.chestId }],
      acceptedAt: rec.acceptedAt, committedAt, reward: { status: 'PAID', units: r.economyEffect.units, economyTransactionId: tx, idempotencyCommitment: ic, recordCommitment: paidRecord(tx, ic, r.economyEffect.units) } });
    let saved = null;
    for (let i = 0; i < 3 && saved !== 'DONE'; i++) {
      try { saved = await deps.redis(['EVAL', PAID_LUA, '2', rKey, KEYS.log(u), crediting, canonical(fin), retain,
        logEntry({ kind: 'chest', id: r.action.chestId, village: x.villageId, amount: Number(r.economyEffect.units) }, rec.acceptedAt * 1000)]); } catch (e) { saved = null; }
      if (saved === 'CHANGED') break;
    }
    if (saved !== 'DONE') {
      // paid, but the receipt could not be saved: keep the exact evidence for the operator; RECEIPT stays OUTCOME_UNKNOWN
      console.error('[raap-universe-chest] paid, receipt not saved', JSON.stringify({ requestId: r.requestId, economyTransactionId: tx }));
      return ok(render(parse(crediting)));
    }
    await claimed(r, u, rec.acceptedAt, 'PAID', tx);
    return ok(fin);
  }
  const claimed = async (r2, u, at, settled, tx) => { if (deps.onClaim) { try { await deps.onClaim({ c, u, kind: 'chest', id: r2.action.chestId, village: byId[r2.action.chestId]?.villageId, units: r2.economyEffect.units, settled, transactionId: tx, at, origin: 'RAAP_APPROVED', requestId: r2.requestId }); } catch (e) {} } };

  const prior = await deps.redis(['GET', rKey]);
  if (prior) return savedResult(prior);

  const cur = await currentLink(c, deps);
  if (!cur.rec || canonical(refOf(cur.rec)) !== canonical(r.link) || linkStatus(c, cur.rec, now) !== 'LINKED') return decline('NOT_AUTHORIZED', r.state);
  if (!(r.issuedAt <= now && now < r.expiresAt && r.expiresAt - r.issuedAt <= MAX_LIFETIME && r.expiresAt <= c.validUntil && r.expiresAt <= cur.rec.validUntil)) return decline('EXPIRED', r.state);
  const id = r.action.chestId, x = byId[id], u = cur.rec.economyUserId, ikey = oneTimeKey('chest', id, u);
  if (r.economyEffect.idempotencyCommitment !== idempotencyCommitment(ikey)) return decline('NOT_AUTHORIZED', r.state);
  if (!x) return decline(r.configurationCommitment !== cc ? 'RULES_CHANGED' : 'UNSUPPORTED_ACTION', r.state);
  const s = await readState(c, deps, cur, [id]), live = stateOf(c, cc, s, [id]);
  if (r.configurationCommitment !== cc || r.economyEffect.units !== x.rewardUnits) return decline('RULES_CHANGED', live);
  const own = await ownership(c, deps);
  if (own === 'UNKNOWN') return fail(503, 'TEMPORARILY_UNAVAILABLE', { committed: false });
  if (own === 'NOT_OWNED') { await endLinkIfSold(c, deps, now); return decline('NOT_OWNED', live); }
  if (s.claimed[0]) return decline('ALREADY_CLAIMED', live);
  if (r.state.version !== live.version || r.state.commitment !== live.commitment) return decline('STALE_STATE', live);
  if (!deps.creditReady()) return fail(503, 'TEMPORARILY_UNAVAILABLE', { committed: false });

  // admitted from here: the claim, the version and either the held record or the intent, in one script
  const e = lookup('chest', id), capped = capApplies('chest'), day = utcDay(now * 1000), version = (BigInt(s.version) + 1n).toString();
  const owed = owedRecord({ kind: 'chest', id, village: e.village, amount: e.amount, reason: e.reason, day, at: now * 1000, ikey, origin: 'RAAP_APPROVED', requestId: r.requestId });
  const afterWith = (owedRaw) => ({ version, commitment: chestStateCommitment(c, cc, { ...s, claimed: [true], owed: [owedRaw] }, [id]) });
  const held = receiptOf(r, rc, { status: 'APPLIED', reason: 'NONE', before: r.state, after: afterWith(owed), effects: [{ kind: 'CHEST_CLAIM', chestId: id }], acceptedAt: now, committedAt: now,
    reward: { status: 'HELD', units: x.rewardUnits, economyTransactionId: null, idempotencyCommitment: ic, recordCommitment: heldRecord(owed, ic, x.rewardUnits) } });
  const intent = canonical({ schema: 'universe.raap.chest-intent.v1', status: 'ADMITTED', requestCommitment: rc, request: r, acceptedAt: now, after: afterWith(ABSENT),
    capped, dayKey: day, village: e.village });
  let res;
  try {
    res = await deps.redis(['EVAL', ADMIT_LUA, '7', rKey, versionKey(c), currentKey(c), linkKey(cur.rec.linkId), KEYS.claimed(u), KEYS.owed(u), KEYS.day(u, day),
      s.version, cur.rec.linkId, cur.raw, member(id), ikey, s.owed[0], String(r.issuedAt), String(r.expiresAt), capped ? '1' : '0', String(e.amount), String(CAP),
      String(DAY_TTL), version, intent, canonical(held), owed, retain]);
  } catch (err) { res = null; }
  if (!Array.isArray(res)) {
    // the admit may or may not have happened: read it back once; never claim twice
    const back = await deps.redis(['GET', rKey]).catch(() => null);
    return back ? savedResult(back) : ok(receiptOf(r, rc, { status: 'OUTCOME_UNKNOWN', reason: 'AWAITING_CONFIRMATION', before: r.state, after: null, effects: [], acceptedAt: null, committedAt: null, reward: UNKNOWN_REWARD(ic) }));
  }
  if (res[0] === 'RECORDED') return savedResult(res[1]);
  if (res[0] === 'EXPIRED') return decline('EXPIRED', live);
  if (res[0] === 'CLAIMED') return decline('ALREADY_CLAIMED', live);
  if (res[0] === 'LINK') return decline('NOT_AUTHORIZED', live);
  if (res[0] === 'STALE') { let now2 = live; try { const c2 = await currentLink(c, deps); if (c2.rec && c2.rec.linkId === cur.rec.linkId) now2 = stateOf(c, cc, await readState(c, deps, c2, [id]), [id]); } catch (e2) {} return decline('STALE_STATE', now2); }
  if (res[0] === 'HELD') { await claimed(r, u, now, 'HELD', null); return ok(held); }
  return settle(intent, parse(intent));
}
