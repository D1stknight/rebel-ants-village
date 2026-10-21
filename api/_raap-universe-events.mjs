// RAAP <-> Universe dev: confirmed experiences a player chose to share with their Rebel (Oct 19). raap-core
// docs/integrations/universe-v1 CONTRACT.md "Normal-play facts" + chest/README §4. Nothing here pays, awards or
// changes play: it only writes down server-confirmed awards, as they happen, for a player who is linked AND sharing.
//   consentInForce  read just before a claim is admitted (api/econ-award.mjs before the award; the chest action before
//                 its admit): the exact bytes of that account's current link and sharing selection. Off (no reads at
//                 all) unless the connection has an events section.
//   recordClaim   called right after the confirmed award with that consent. A fact only when that very link and
//                 selection were saved before the claim happened, cover its time and kind, are still in force now, and
//                 are byte for byte the same at the append (one Lua script checks the account index, the link pointer,
//                 the link record and the sharing record): an unlink, a new link or a stopped / replaced selection in
//                 between means no fact. Never the latest selection in place of the one in force at the claim.
//                 Original time, stable event id (once per source record). Earlier claims are never back-filled; a
//                 later payment of a held reward makes no second fact.
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
// append once per event id, and only while the consent read before the claim is still exactly in force.
// KEYS: event id, cursor, feed, account index, link pointer, link, sharing. ARGV: unsigned fact, retain-until, link id,
// link raw, sharing raw. -1 = the consent changed (no fact), 0 = already recorded, n = recorded at cursor n
const APPEND_LUA = `
if redis.call('GET',KEYS[4])~=ARGV[3] or redis.call('GET',KEYS[5])~=ARGV[3] then return -1 end
if redis.call('GET',KEYS[6])~=ARGV[4] or redis.call('GET',KEYS[7])~=ARGV[5] then return -1 end
if not redis.call('SET',KEYS[1],'1','NX','EXAT',tonumber(ARGV[2])) then return 0 end
local n=redis.call('INCR',KEYS[2])
redis.call('EXPIREAT',KEYS[2],tonumber(ARGV[2]))
redis.call('ZADD',KEYS[3],n,ARGV[1])
redis.call('EXPIREAT',KEYS[3],tonumber(ARGV[2]))
return n
`;

// the consent in force for account u right now -> { linkId, linkRaw, sharingRaw } (exact bytes; sharingRaw may be null),
// or null (off, or no current link for that account). Call it before the claim is admitted.
export async function consentInForce(u, deps) {
  const c = connectionConfig(deps.env);
  if (deps.env.VERCEL_ENV === 'production' || !c || !c.events) return null;
  const linkId = await deps.redis(['GET', accountIndexKey(c, u)]);
  if (!linkId || (await deps.redis(['GET', currentKey(c)])) !== linkId) return null;
  const linkRaw = await deps.redis(['GET', linkKey(linkId)]);
  return linkRaw ? { linkId, linkRaw, sharingRaw: (await deps.redis(['GET', sharingKey(linkId)])) || null } : null;
}

// a confirmed award -> 'OFF' | 'NOT_LINKED' | 'NOT_SHARED' | 'CHANGED' | 'DUPLICATE' | 'RECORDED'
// claim = { u, kind, id, sourceId (id; a find: id:day:n), village, units, settled: 'PAID' | 'HELD', transactionId, at (Unix s),
//           origin: 'OWNER_PLAYED' | 'RAAP_APPROVED', requestId, consent (consentInForce, read before the claim) };
// deps = { env, now(), redis(args) }
export async function recordClaim(claim, deps) {
  const c = connectionConfig(deps.env);
  if (deps.env.VERCEL_ENV === 'production' || !c || !c.events || !FACT[claim.kind]) return 'OFF';
  const k = claim.consent;
  if (!k || !k.linkId || !k.linkRaw) return 'NOT_LINKED';
  const rec = parse(k.linkRaw), s = parse(k.sharingRaw), now = deps.now(), occurredAt = Math.floor(claim.at);
  // that link: saved before the claim, in force at its time and still now
  if (!rec || rec.linkId !== k.linkId || rec.economyUserId !== claim.u || !(rec.savedAt <= occurredAt)
    || linkStatus(c, rec, occurredAt) !== 'LINKED' || linkStatus(c, rec, now) !== 'LINKED') return 'NOT_LINKED';
  const [kind, result] = FACT[claim.kind];
  // that selection: the same, for this kind
  if (!s || !(s.savedAt <= occurredAt) || sharingStatus(c, rec, s, occurredAt) !== 'SHARING' || sharingStatus(c, rec, s, now) !== 'SHARING'
    || !s.eventKinds.includes(kind)) return 'NOT_SHARED';
  const playerId = playerIdOf(c.wallet);
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
  const n = Number(await deps.redis(['EVAL', APPEND_LUA, '7', eventIdKey(fact.eventId), cursorKey(c), feedKey(c), accountIndexKey(c, claim.u), currentKey(c),
    linkKey(k.linkId), sharingKey(k.linkId), canonical(fact), String(retainAt(c)), k.linkId, k.linkRaw, k.sharingRaw]));
  return n > 0 ? 'RECORDED' : n === 0 ? 'DUPLICATE' : 'CHANGED';
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
