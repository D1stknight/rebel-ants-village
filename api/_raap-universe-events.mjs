// RAAP <-> Universe dev: confirmed experiences a player chose to share with their Rebel (Oct 19). raap-core
// docs/integrations/universe-v1 CONTRACT.md "Normal-play facts" + chest/README §4. Nothing here pays, awards or
// changes play: it only writes down server-confirmed awards, as they happen, for a player who is linked AND sharing.
//   recordClaim   called right after a confirmed award (api/econ-award.mjs: chest, first clear, place riddle, Treasure
//                 Dig find; api/_raap-universe-chest.mjs: a RAAP-approved chest). Off (no reads at all) unless the
//                 connection has an events section; then one lookup by account, and a fact only when that account's
//                 current link is LINKED and its sharing selection covers the kind. Original time, stable event id
//                 (once per source record), the consent / link / epoch in force at that moment. Earlier claims are
//                 never back-filled; a later payment of a held reward makes no second fact.
//   eventsPage    EVENTS on /api/raap-universe: pages after a cursor, signed with the source key (Ed25519 over
//                 "rebel.universe.fact.v1" NUL canonical(fact)). No key installed (RAAP_UNIVERSE_DEV_SOURCE_KEY) = off.
// Records (until retainUntil): raap:v1:dev:event-id:<eventId> (once), raap:v1:dev:cursor:<connectionId>:<playerHash>
// (the feed's sequence), raap:v1:dev:events:<connectionId>:<playerHash> (sorted by cursor; facts without key id /
// signature: those are added when served).
import crypto from 'node:crypto';
import { canonical, commitment, playerIdOf, connectionConfig, retainAt, devKey, playerHash, parse, fail, ok } from './_raap-universe.mjs';
import { accountIndexKey, currentKey, linkKey, sharingKey, linkStatus, sharingStatus } from './_raap-universe-link.mjs';

const FACT = { chest: ['CHEST_OPENED', 'OPENED'], game: ['FIRST_GAME_CLEAR', 'CLEARED'], riddle: ['PLACE_RIDDLE_SOLVED', 'SOLVED'], find: ['TREASURE_DIG_FIND', 'FOUND'] };
const feedKey = (c) => devKey(`events:${c.connectionId}:${playerHash(playerIdOf(c.wallet))}`);
const cursorKey = (c) => devKey(`cursor:${c.connectionId}:${playerHash(playerIdOf(c.wallet))}`);
const eventIdKey = (eventId) => devKey(`event-id:${eventId}`);
// append once per event id. KEYS: event id, cursor, feed. ARGV: unsigned fact, retain-until
const APPEND_LUA = `
if not redis.call('SET',KEYS[1],'1','NX','EXAT',tonumber(ARGV[2])) then return 0 end
local n=redis.call('INCR',KEYS[2])
redis.call('EXPIREAT',KEYS[2],tonumber(ARGV[2]))
redis.call('ZADD',KEYS[3],n,ARGV[1])
redis.call('EXPIREAT',KEYS[3],tonumber(ARGV[2]))
return n
`;

// a confirmed award -> 'OFF' | 'NOT_LINKED' | 'NOT_SHARED' | 'DUPLICATE' | 'RECORDED'
// claim = { u, kind, id, sourceId (id; a find: id:day:n), village, units, settled: 'PAID' | 'HELD', transactionId, at (Unix s),
//           origin: 'OWNER_PLAYED' | 'RAAP_APPROVED', requestId }; deps = { env, now(), redis(args) }
export async function recordClaim(claim, deps) {
  const c = connectionConfig(deps.env);
  if (deps.env.VERCEL_ENV === 'production' || !c || !c.events || !FACT[claim.kind]) return 'OFF';
  const linkId = await deps.redis(['GET', accountIndexKey(c, claim.u)]);
  if (!linkId) return 'NOT_LINKED';
  const [current, raw, sRaw] = [await deps.redis(['GET', currentKey(c)]), await deps.redis(['GET', linkKey(linkId)]), await deps.redis(['GET', sharingKey(linkId)])];
  const rec = parse(raw), s = parse(sRaw), now = deps.now();
  if (current !== linkId || !rec || rec.economyUserId !== claim.u || linkStatus(c, rec, now) !== 'LINKED') return 'NOT_LINKED';
  const [kind, result] = FACT[claim.kind];
  if (sharingStatus(c, rec, s, now) !== 'SHARING' || !s.eventKinds.includes(kind)) return 'NOT_SHARED';
  const playerId = playerIdOf(c.wallet), occurredAt = Math.floor(claim.at);
  const sourceRecordId = commitment('universe.raap.source-record.v1', { economyUserId: claim.u, kind: claim.kind, id: claim.sourceId });
  const units = String(claim.units);
  const fact = {
    schema: 'rebel.universe.fact.v1', environment: 'dev', issuerId: 'rebel.universe',
    eventId: commitment('rebel.universe.fact-id.v1', { environment: 'dev', playerId, kind, sourceRecordId }),
    selectionId: s.selectionId, playerId, wallet: c.wallet, asset: c.asset, controllerEpoch: c.controllerEpoch,
    origin: claim.origin, requestId: claim.origin === 'RAAP_APPROVED' ? claim.requestId : null, kind, sourceRecordId,
    sourceRecordDigest: commitment('universe.raap.source-record-digest.v1', { sourceRecordId, award: claim.kind, id: claim.sourceId, settlement: claim.settled, units,
      economyTransactionId: claim.transactionId || null, occurredAt }),
    occurredAt, observedAt: Math.max(now, occurredAt),
    // paid points only: a held reward is in the source record, and its later payment is not a new experience
    facts: { subjectId: claim.id, locationId: claim.village || null, result, rewards: claim.settled === 'PAID' ? [{ kind: 'REBEL_POINTS', id: 'REBEL', quantity: units }] : [] }
  };
  const n = await deps.redis(['EVAL', APPEND_LUA, '3', eventIdKey(fact.eventId), cursorKey(c), feedKey(c), canonical(fact), String(retainAt(c))]);
  return Number(n) > 0 ? 'RECORDED' : 'DUPLICATE';
}

// the source key: RAAP_UNIVERSE_DEV_SOURCE_KEY = 0x + 64 hex (an Ed25519 seed, as the contract's offline vector)
export function sourceKey(env) {
  const seed = String(env.RAAP_UNIVERSE_DEV_SOURCE_KEY || '').trim();
  if (!/^0x[0-9a-f]{64}$/.test(seed)) return null;
  try { return crypto.createPrivateKey({ key: Buffer.from('302e020100300506032b657004220420' + seed.slice(2), 'hex'), format: 'der', type: 'pkcs8' }); } catch (e) { return null; }
}
export const publicKeyHex = (key) => '0x' + crypto.createPublicKey(key).export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex');
export const factSigningBytes = (fact) => Buffer.from('rebel.universe.fact.v1\0' + canonical(fact), 'utf8');

// EVENTS { target, afterCursor, limit } for the connection c (target already checked) -> { status, body }
export async function eventsPage(c, op, deps) {
  const key = sourceKey(deps.env);
  if (!key || !c.events) return fail(403, 'OPERATION_NOT_ENABLED');
  const after = BigInt(op.afterCursor);
  if (after > 9007199254740991n) return ok({ schema: 'universe.raap.events.v1', events: [], nextCursor: op.afterCursor, hasMore: false });
  const rows = await deps.redis(['ZRANGEBYSCORE', feedKey(c), '(' + op.afterCursor, '+inf', 'WITHSCORES', 'LIMIT', '0', String(op.limit + 1)]);
  const items = [];
  for (let i = 0; i + 1 < (rows || []).length; i += 2) items.push({ doc: parse(rows[i]), cursor: String(rows[i + 1]) });
  const page = items.slice(0, op.limit).filter((x) => x.doc);
  const events = page.map(({ doc, cursor }) => {
    const unsigned = { ...doc, keyId: c.events.keyId, cursor };
    return { ...unsigned, signature: '0x' + crypto.sign(null, factSigningBytes(unsigned), key).toString('hex') };
  });
  return ok({ schema: 'universe.raap.events.v1', events, nextCursor: page.length ? page[page.length - 1].cursor : op.afterCursor, hasMore: items.length > op.limit });
}
