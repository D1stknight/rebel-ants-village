// RAAP <-> Universe dev connection, v1 (Oct 19). The five operations of raap-core
// docs/integrations/universe-v1/CONTRACT.md (branch docs/universe-raap-handoff-20261019) for the one piece of server-held
// equipment the game has: a Rebel's weapon (forge-weapon.mjs, the holder's pick, else the NFT trait).
//   READ     the Rebel's weapon, the catalog, the actions open now, a state version + commitment
//   PREPARE  one exact WEAPON_EQUIP / WEAPON_UNEQUIP against that state (nothing reserved)
//   EXECUTE  the owner-approved request (EIP-191 personal_sign), once: one guarded save of the weapon choice + receipt
//   RECEIPT  the saved result of a request id, never executing again
//   EVENTS   the confirmed experiences the player shares (_raap-universe-events.mjs): off without an events section,
//            the player's link + sharing consent (raap-universe-link) and an installed source key
// Zero charge, no Economy effect. New records only under raap:v1:dev:*. The one shared game key it writes is the Rebel's
// weapon choice, the same record the Forge's weapon chips write, inside one Lua script that re-reads the exact raw bytes
// the action was approved against (dev and production share Redis, so a version counter alone can't see a human write).
// Pinned connection: env RAAP_UNIVERSE_DEV_CONNECTION (JSON, below); the bearer key is checked by raap-universe.mjs.
// Retention: every raap:v1:dev record of a connection expires at its pinned retainUntil (never before validUntil, so a
// request id stays a tombstone for as long as that request could run); the weapon choice itself never expires.
import crypto from 'node:crypto';
import { recoverMessageAddress } from 'viem';
import { WEAPONS, weaponForTrait } from './_weapon-catalog.mjs';

export const MAX_BODY = 65536, MAX_LIFETIME = 900;
const OPS = ['READ', 'PREPARE', 'EXECUTE', 'RECEIPT', 'EVENTS'];
const CHEST_OPS = ['READ', 'PREPARE', 'EXECUTE', 'RECEIPT', 'LINK_STATUS'];
export const EVENT_KINDS = ['CHEST_OPENED', 'FIRST_GAME_CLEAR', 'PLACE_RIDDLE_SOLVED', 'TREASURE_DIG_FIND'];
// when a record written for a request may expire: the connection's retention end, and never before the request itself
// has closed (+5 minutes for clocks)
export const retainAt = (c, expiresAt = 0) => Math.max(c.retainUntil, expiresAt + 300);
const ZERO = { currency: 'REBEL', units: '0' };
const ABSENT = '__RAAP_ABSENT__';
const HALF_N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n >> 1n;   // low-s bound (secp256k1)

// ---- canonical JSON (RFC 8785 for this schema: safe integers only) + domain-separated SHA-256 ----
export function canonical(value) {
  if (value === null || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'string') {
    for (let i = 0; i < value.length; i++) {
      const c = value.charCodeAt(i);
      if (c >= 0xd800 && c <= 0xdbff) { const n = value.charCodeAt(++i); if (!(n >= 0xdc00 && n <= 0xdfff)) throw Error('INVALID_UNICODE'); }
      else if (c >= 0xdc00 && c <= 0xdfff) throw Error('INVALID_UNICODE');
    }
    return JSON.stringify(value);
  }
  if (typeof value === 'number') { if (!Number.isSafeInteger(value)) throw Error('INVALID_NUMBER'); return JSON.stringify(value); }
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) throw Error('INVALID_JSON_VALUE');
  return '{' + Object.keys(value).sort().map((k) => canonical(k) + ':' + canonical(value[k])).join(',') + '}';
}
const sha256 = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');
export const commitment = (domain, value) => '0x' + sha256(domain + '\0' + canonical(value));
export const requestCommitment = (r) => commitment('raap.universe.action.v1', r);
export const receiptIdOf = (connectionId, requestId) => commitment('universe.raap.receipt-id.v1', { connectionId, requestId });
export const playerIdOf = (wallet) => `wallet:eip155:1:${wallet}`;

// the readable message the owner signs (contract reference-protocol.mjs personalMessage, byte for byte)
export function personalMessage(r) {
  const verb = r.action.kind === 'WEAPON_EQUIP' ? 'Equip weapon' : 'Unequip weapon';
  return [
    'RAAP approval', '', `${verb} for Rebel #${r.asset.tokenId}`,
    `Weapon ID: ${r.action.weaponId}`,
    'Maximum game charge: 0 REBEL. No Economy payment or award.',
    'This approves one game action. It is not an Ethereum transaction or NFT transfer.',
    `Player wallet: ${r.player.wallet}`,
    `Expires (UTC): ${new Date(r.expiresAt * 1000).toISOString()}`,
    '', 'Verification details',
    'Protocol: RAAP Universe Action / 1',
    `Environment: ${r.environment}`, `Website: ${r.issuer}`, `Game: ${r.audience}`,
    `Network chain ID: ${r.asset.chainId}`, `Collection: ${r.asset.collection}`,
    `Controller epoch: ${r.controller.epoch}`, `Rebel account: ${r.account}`,
    `State version: ${r.state.version}`, `Journal: ${r.journalId}`,
    `Request ID: ${r.requestId}`, `Request: ${requestCommitment(r)}`
  ].join('\n');
}

// ---- strict shapes (schemas.json: every field required, no extra fields) ----
const RX = { addr: /^0x[0-9a-f]{40}$/, hex32: /^0x[0-9a-f]{64}$/, dec: /^(0|[1-9][0-9]{0,77})$/, id: /^[a-zA-Z0-9_.:-]{1,128}$/,
  player: /^wallet:eip155:1:0x[0-9a-f]{40}$/, origin: /^https:\/\/[a-z0-9.-]+(:[0-9]{1,5})?$/, sig: /^0x[0-9a-f]{128}(1b|1c)$/ };
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const exact = (v, keys) => isObj(v) && Object.keys(v).length === keys.length && keys.every((k) => Object.hasOwn(v, k));
const str = (v, rx, max = 0) => typeof v === 'string' && rx.test(v) && (!max || v.length <= max);
const secs = (v) => Number.isSafeInteger(v) && v >= 1;
const isAsset = (a) => exact(a, ['chainId', 'collection', 'tokenId']) && a.chainId === 1 && str(a.collection, RX.addr) && str(a.tokenId, RX.dec);
const isState = (s) => exact(s, ['version', 'commitment']) && str(s.version, RX.dec) && str(s.commitment, RX.hex32);
const isZero = (c) => exact(c, ['currency', 'units']) && c.currency === 'REBEL' && c.units === '0';
const isAction = (a) => exact(a, ['kind', 'weaponId']) && ['WEAPON_EQUIP', 'WEAPON_UNEQUIP'].includes(a.kind) && str(a.weaponId, RX.id);
const isTarget = (t) => exact(t, ['playerId', 'asset', 'connectionId']) && str(t.playerId, RX.player) && isAsset(t.asset) && str(t.connectionId, RX.id);
const isRequest = (r) => exact(r, ['schema', 'environment', 'issuer', 'audience', 'tenant', 'journalId', 'requestId', 'connectionId', 'connectionRevision',
  'player', 'asset', 'controller', 'account', 'contextCommitment', 'state', 'configurationCommitment', 'action', 'maximumCharge', 'economyEffect', 'issuedAt', 'expiresAt'])
  && r.schema === 'raap.universe.action.v1' && r.environment === 'dev' && str(r.issuer, RX.origin, 256) && str(r.audience, RX.origin, 256)
  && str(r.tenant, RX.id) && str(r.journalId, RX.hex32) && str(r.requestId, RX.hex32) && str(r.connectionId, RX.id) && str(r.connectionRevision, RX.dec)
  && exact(r.player, ['id', 'wallet', 'economyAccountId']) && str(r.player.id, RX.player) && str(r.player.wallet, RX.addr) && r.player.economyAccountId === null
  && isAsset(r.asset) && exact(r.controller, ['address', 'epoch']) && str(r.controller.address, RX.addr) && secs(r.controller.epoch)
  && str(r.account, RX.addr) && str(r.contextCommitment, RX.hex32) && isState(r.state) && str(r.configurationCommitment, RX.hex32)
  && isAction(r.action) && isZero(r.maximumCharge) && r.economyEffect === 'NONE' && secs(r.issuedAt) && secs(r.expiresAt);
const isAuthorized = (a) => exact(a, ['schema', 'request', 'ownerApproval']) && a.schema === 'raap.universe.authorized-action.v1' && isRequest(a.request)
  && exact(a.ownerApproval, ['scheme', 'signer', 'signature']) && a.ownerApproval.scheme === 'eip191-personal-sign'
  && str(a.ownerApproval.signer, RX.addr) && str(a.ownerApproval.signature, RX.sig);
export function isOperation(o) {
  if (!isObj(o)) return false;
  switch (o.operation) {
    case 'READ': return exact(o, ['operation', 'target']) && isTarget(o.target);
    case 'PREPARE': return exact(o, ['operation', 'target', 'action']) && isTarget(o.target) && isAction(o.action);
    case 'EXECUTE': return exact(o, ['operation', 'authorization']) && isAuthorized(o.authorization);
    case 'RECEIPT': return exact(o, ['operation', 'target', 'requestId', 'requestCommitment']) && isTarget(o.target) && str(o.requestId, RX.hex32) && str(o.requestCommitment, RX.hex32);
    case 'EVENTS': return exact(o, ['operation', 'target', 'afterCursor', 'limit']) && isTarget(o.target) && str(o.afterCursor, RX.dec) && Number.isSafeInteger(o.limit) && o.limit >= 1 && o.limit <= 25;
    default: return false;
  }
}

// ---- the pinned connection: one wallet, one Rebel, one RAAP journal (nothing in a request chooses these) ----
// RAAP_UNIVERSE_DEV_CONNECTION = { schema: 'universe.raap.connection.v2', environment: 'dev', connectionId, connectionRevision,
//   issuer (RAAP's origin), audience (this dev preview's origin), tenant, journalId, wallet, asset: { chainId: 1, collection,
//   tokenId }, collectionKey, account, controllerEpoch, operations (this route: READ, PREPARE, EXECUTE, RECEIPT, EVENTS),
//   status: 'ACTIVE' | 'DISCONNECTED', validUntil (Unix s: access ends), retainUntil (Unix s, >= validUntil: records end),
//   chest: null | { operations (READ, PREPARE, EXECUTE, RECEIPT, LINK_STATUS), chests: [chest ids] } (raap-universe-chest),
//   events: null | { keyId, eventKinds } (experience sharing) }. A null section = that part stays off; the account link
//   (raap-universe-link) is on only with chest or events.
const uniq = (a, allowed, max) => Array.isArray(a) && a.length > 0 && a.length <= max && a.every((o) => allowed(o)) && new Set(a).size === a.length;
export function connectionConfig(env) {
  let c; try { c = JSON.parse(env.RAAP_UNIVERSE_DEV_CONNECTION || 'null'); } catch (e) { return null; }
  const ok = exact(c, ['schema', 'environment', 'connectionId', 'connectionRevision', 'issuer', 'audience', 'tenant', 'journalId', 'wallet', 'asset',
    'collectionKey', 'account', 'controllerEpoch', 'operations', 'status', 'validUntil', 'retainUntil', 'chest', 'events'])
    && c.schema === 'universe.raap.connection.v2' && c.environment === 'dev' && str(c.connectionId, RX.id) && str(c.connectionRevision, RX.dec)
    && str(c.issuer, RX.origin, 256) && str(c.audience, RX.origin, 256) && str(c.tenant, RX.id) && str(c.journalId, RX.hex32) && str(c.wallet, RX.addr)
    && isAsset(c.asset) && /^[a-z0-9_]{1,64}$/.test(c.collectionKey) && str(c.account, RX.addr) && secs(c.controllerEpoch)
    && uniq(c.operations, (o) => OPS.includes(o), OPS.length)
    && ['ACTIVE', 'DISCONNECTED'].includes(c.status) && secs(c.validUntil) && secs(c.retainUntil) && c.retainUntil >= c.validUntil
    && (c.chest === null || (exact(c.chest, ['operations', 'chests']) && uniq(c.chest.operations, (o) => CHEST_OPS.includes(o), CHEST_OPS.length)
      && uniq(c.chest.chests, (id) => str(id, RX.id), 64)))
    && (c.events === null || (exact(c.events, ['keyId', 'eventKinds']) && str(c.events.keyId, RX.id) && uniq(c.events.eventKinds, (k) => EVENT_KINDS.includes(k), 4)));
  return ok ? c : null;
}

// ---- records ----
const devKey = (rest) => { const k = 'raap:v1:dev:' + rest; if (!/^raap:v1:dev:[A-Za-z0-9_.:-]{1,300}$/.test(k)) throw Error('Bad key'); return k; };
const playerHash = (playerId) => commitment('universe.raap.player.v1', playerId).slice(2);
const choiceKey = (c) => `forge:weapon-choice:v1:${c.collectionKey}:${c.asset.tokenId}`;   // the Forge's own record
const WEAPON_IDS = Object.keys(WEAPONS).sort();
const stateKeys = (c) => [choiceKey(c), ...WEAPON_IDS.map((id) => `forge:weapon:v1:${id}`)];  // the pick + each weapon's approval
const versionKey = (c) => devKey(`player:${playerHash(playerIdOf(c.wallet))}:version`);
const requestKey = (c, requestId) => devKey(`request:${c.connectionId}:${requestId}`);

// the reviewed handler: catalog, rules, operations and record mapping (no secret)
export function configurationCommitment(c) {
  return commitment('universe.raap.configuration.v1', {
    handler: 'universe-raap-weapon/1', environment: 'dev', connectionId: c.connectionId, connectionRevision: c.connectionRevision,
    issuer: c.issuer, audience: c.audience, tenant: c.tenant, journalId: c.journalId, playerId: playerIdOf(c.wallet), asset: c.asset,
    collectionKey: c.collectionKey, account: c.account, controllerEpoch: c.controllerEpoch, operations: [...c.operations].sort(),
    actions: ['WEAPON_EQUIP', 'WEAPON_UNEQUIP'], maxLifetime: MAX_LIFETIME, validUntil: c.validUntil,
    retention: { until: c.retainUntil, records: 'raap:v1:dev request receipts + version expire then (never before their request has closed); the weapon choice never expires' },
    catalog: WEAPON_IDS.map((id) => ({ weaponId: id, label: WEAPONS[id].name, trait: WEAPONS[id].trait, hilt: WEAPONS[id].hilt })),
    equipped: 'choice.weaponId, else the NFT Weapons trait; none or a weapon not approved = null; only approved weapons equip',
    keys: { equipment: choiceKey(c), catalog: 'forge:weapon:v1:<weaponId>', version: 'raap:v1:dev:player:<playerHash>:version', request: 'raap:v1:dev:request:<connectionId>:<requestId>' },
    maximumCharge: ZERO, economyEffect: 'NONE'
  });
}
export function stateCommitmentOf(c, raws, cc) {
  const records = stateKeys(c).map((key, i) => ({ key, rawSha256: raws[i] == null ? null : '0x' + sha256(raws[i]) }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return commitment('universe.raap.state.v1', { playerId: playerIdOf(c.wallet), records, configurationCommitment: cc });
}
async function readState(c, deps) {
  const vals = await deps.redis(['MGET', ...stateKeys(c), versionKey(c)]);
  if (!Array.isArray(vals) || vals.length !== stateKeys(c).length + 1 || vals.some((v) => v !== null && typeof v !== 'string')) throw Error('State unreadable');
  const version = vals.pop() ?? '0';
  if (!RX.dec.test(version)) throw Error('State unreadable');
  return { raws: vals, version };
}
const parse = (raw) => { try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; } };
// what the game shows: the holder's pick, else the NFT trait (assets/rebel-weapon.js resolve); only approved weapons show
function equipmentOf(raws, trait) {
  const approved = {}; WEAPON_IDS.forEach((id, i) => { const r = parse(raws[i + 1]); approved[id] = !!(r && r.approved && r.glbUrl); });
  const fromTrait = weaponForTrait(trait), pick = parse(raws[0]) || fromTrait;
  const equipped = pick && pick.weaponId !== 'none' && WEAPONS[pick.weaponId] && approved[pick.weaponId] ? pick.weaponId : null;
  return { approved, equipped, hilt: pick?.hilt === 'L' ? 'L' : 'R', fromTrait };
}
function refusalFor(action, eq, owned) {
  if (!owned) return 'NOT_OWNED';
  if (!WEAPONS[action.weaponId]) return 'UNSUPPORTED_ACTION';
  if (action.kind === 'WEAPON_EQUIP') return !eq.approved[action.weaponId] ? 'UNSUPPORTED_ACTION' : eq.equipped === action.weaponId ? 'STALE_STATE' : 'NONE';
  return eq.equipped === action.weaponId ? 'NONE' : 'STALE_STATE';
}
const sameAsset = (a, b) => canonical(a) === canonical(b);
const targetOf = (c) => ({ playerId: playerIdOf(c.wallet), asset: c.asset, connectionId: c.connectionId });

// ---- owner approval: canonical low-s 65-byte ECDSA over the exact readable message, from the pinned wallet ----
// (the direct key of the wallet; nothing here reads on-chain code, so ERC-1271 / delegation-code checks never apply)
export async function signedBy(message, a, wallet) {
  if (!exact(a, ['scheme', 'signer', 'signature']) || a.scheme !== 'eip191-personal-sign' || a.signer !== wallet || !str(a.signature, RX.sig)) return false;
  const sig = a.signature, rr = BigInt('0x' + sig.slice(2, 66)), ss = BigInt('0x' + sig.slice(66, 130));
  if (rr === 0n || ss === 0n || ss > HALF_N) return false;
  let signer = null;
  try { signer = (await recoverMessageAddress({ message, signature: sig })).toLowerCase(); } catch (e) { return false; }
  return signer === wallet;
}
export const ownerSigned = (auth, wallet) => signedBy(personalMessage(auth.request), auth.ownerApproval, wallet);

// One guarded save: same request id = the saved receipt; every authoritative record and the version must still be exactly
// what the request was approved against; still inside its time. Checks first, then one MSET (nothing fallible after).
// KEYS: request, version, weapon choice, the six weapon records. ARGV: expected version, issuedAt, expiresAt, new choice,
// new version, receipt, retain-until (Unix s: receipt + version expire then), then the expected raw value of KEYS[3..].
export const EXECUTE_LUA = `
local prior=redis.call('GET',KEYS[1])
if prior then return {'RECORDED',prior} end
if (redis.call('GET',KEYS[2]) or '0')~=ARGV[1] then return {'STALE'} end
for i=3,#KEYS do
  if (redis.call('GET',KEYS[i]) or '${ABSENT}')~=ARGV[i+5] then return {'STALE'} end
end
local t=tonumber(redis.call('TIME')[1])
if t<tonumber(ARGV[2]) or t>=tonumber(ARGV[3]) then return {'EXPIRED'} end
redis.call('MSET',KEYS[3],ARGV[4],KEYS[2],ARGV[5],KEYS[1],ARGV[6])
redis.call('EXPIREAT',KEYS[1],tonumber(ARGV[7]))
redis.call('EXPIREAT',KEYS[2],tonumber(ARGV[7]))
return {'APPLIED'}
`;

const fail = (status, error, extra) => ({ status, body: { schema: 'universe.raap.error.v1', error, ...(extra || {}) } });
const ok = (body) => ({ status: 200, body });
// shared with the chest, link and events modules
export const V = { RX, isObj, exact, str, secs, isAsset, isState, isZero, isTarget, uniq };
export { devKey, playerHash, targetOf, sameAsset, ABSENT, ZERO, fail, ok, parse, sha256 };

// raw = the exact request bytes. deps = { env, now() (Unix s), redis(args) (one command), owner(collectionKey, tokenId)
// (live owner, lowercase), trait(collectionKey, tokenId) (the NFT Weapons trait), contract(collectionKey) (lowercase) }.
export async function handleOperation(raw, deps) {
  if (!Buffer.isBuffer(raw) || !raw.length || raw.length > MAX_BODY) return fail(400, 'MALFORMED');
  let text, op;
  try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(raw); op = JSON.parse(text); } catch (e) { return fail(400, 'MALFORMED'); }
  if (!isOperation(op)) return fail(400, 'MALFORMED');
  try { if (canonical(op) !== text) return fail(400, 'NOT_CANONICAL'); } catch (e) { return fail(400, 'MALFORMED'); }

  const c = connectionConfig(deps.env);
  if (deps.env.VERCEL_ENV === 'production' || !c) return fail(403, 'CONNECTION_UNAVAILABLE');
  // shared experiences (_raap-universe-events.mjs): a read, so it stays readable after the connection closes
  if (op.operation === 'EVENTS') {
    if (!c.operations.includes('EVENTS') || !c.events || !deps.events) return fail(403, 'OPERATION_NOT_ENABLED');
    if (canonical(op.target) !== canonical(targetOf(c))) return fail(403, 'NOT_AUTHORIZED');
    return deps.events(c, op);
  }
  if (!c.operations.includes(op.operation)) return fail(403, 'OPERATION_NOT_PERMITTED');
  const now = deps.now();
  // a closed connection keeps its saved results readable and takes nothing new
  if (op.operation !== 'RECEIPT' && (c.status !== 'ACTIVE' || now >= c.validUntil)) return fail(403, 'CONNECTION_CLOSED');
  if (op.operation !== 'EXECUTE' && canonical(op.target) !== canonical(targetOf(c))) return fail(403, 'NOT_AUTHORIZED');

  if (op.operation === 'RECEIPT') {
    const saved = parse(await deps.redis(['GET', requestKey(c, op.requestId)]));
    if (!saved) return ok({ schema: 'universe.raap.receipt-read.v1', requestId: op.requestId, status: 'NOT_FOUND', receipt: null });
    if (saved.requestCommitment !== op.requestCommitment) return fail(409, 'REQUEST_ID_CONFLICT');
    return ok({ schema: 'universe.raap.receipt-read.v1', requestId: op.requestId, status: 'FOUND', receipt: saved });
  }
  if ((await deps.contract(c.collectionKey)) !== c.asset.collection) return fail(403, 'CONNECTION_UNAVAILABLE');
  const cc = configurationCommitment(c);
  const live = async () => {
    const s = await readState(c, deps);
    return { ...s, state: { version: s.version, commitment: stateCommitmentOf(c, s.raws, cc) } };
  };
  const owned = async () => (await deps.owner(c.collectionKey, c.asset.tokenId)) === c.wallet;   // the wallet itself, not a delegate

  if (op.operation === 'READ' || op.operation === 'PREPARE') {
    const [s, trait, own] = await Promise.all([live(), deps.trait(c.collectionKey, c.asset.tokenId), owned()]);
    const eq = equipmentOf(s.raws, trait);
    if (op.operation === 'PREPARE') {
      const reason = refusalFor(op.action, eq, own);
      if (reason !== 'NONE') return fail(422, 'ACTION_UNAVAILABLE', { reason });
      return ok({ schema: 'universe.raap.preparation.v1', target: op.target, action: op.action, state: s.state, configurationCommitment: cc,
        maximumCharge: ZERO, economyEffect: 'NONE', observedAt: now, expiresAt: Math.min(now + MAX_LIFETIME, c.validUntil) });
    }
    const weapons = WEAPON_IDS.map((id) => {
      const refusal = refusalFor({ kind: 'WEAPON_EQUIP', weaponId: id }, eq, own);
      return { weaponId: id, label: WEAPONS[id].name, eligible: refusal === 'NONE', refusal };
    });
    const availableActions = weapons.filter((w) => w.eligible).map((w) => ({ kind: 'WEAPON_EQUIP', weaponId: w.weaponId }))
      .concat(own && eq.equipped ? [{ kind: 'WEAPON_UNEQUIP', weaponId: eq.equipped }] : []);
    return ok({ schema: 'universe.raap.inventory.v1', target: op.target, state: s.state, configurationCommitment: cc, equippedWeaponId: eq.equipped,
      weapons, availableActions, observedAt: now });
  }

  // ---- EXECUTE ----
  const auth = op.authorization, r = auth.request;
  const pinned = r.issuer === c.issuer && r.audience === c.audience && r.connectionId === c.connectionId && r.connectionRevision === c.connectionRevision
    && r.tenant === c.tenant && r.journalId === c.journalId && r.player.wallet === c.wallet && r.player.id === playerIdOf(c.wallet)
    && r.controller.address === c.wallet && r.controller.epoch === c.controllerEpoch && r.account === c.account && sameAsset(r.asset, c.asset)
    && auth.ownerApproval.signer === c.wallet;
  if (!pinned || !(await ownerSigned(auth, c.wallet))) return fail(403, 'NOT_AUTHORIZED');
  const rc = requestCommitment(r), rKey = requestKey(c, r.requestId);
  const savedResult = (raw2) => { const s = parse(raw2); return s && s.requestCommitment === rc ? ok(s) : fail(409, 'REQUEST_ID_CONFLICT'); };
  const prior = await deps.redis(['GET', rKey]);
  if (prior) return savedResult(prior);

  const receipt = (status, reason, before, after, effects, committedAt) => ({
    schema: 'universe.raap.action-receipt.v1', environment: 'dev', connectionId: r.connectionId, requestId: r.requestId, requestCommitment: rc,
    receiptId: receiptIdOf(r.connectionId, r.requestId), playerId: r.player.id, asset: r.asset, controllerEpoch: r.controller.epoch,
    origin: 'RAAP_APPROVED', action: r.action, status, reason, before, after, effects,
    actualCharge: status === 'APPLIED' || status === 'DECLINED' ? ZERO : null, economyEffect: 'NONE', committedAt });
  // a definite refusal is kept like a success: the same request id always gets this answer
  const decline = async (reason, before) => {
    const d = receipt('DECLINED', reason, before, before, [], null);
    let set;
    try { set = await deps.redis(['SET', rKey, canonical(d), 'NX', 'EXAT', String(retainAt(c, r.expiresAt))]); } catch (e) { return fail(503, 'RECEIPT_NOT_SAVED', { committed: false }); }
    return set === 'OK' ? ok(d) : savedResult(await deps.redis(['GET', rKey]));
  };

  const [s, trait, own] = await Promise.all([live(), deps.trait(c.collectionKey, c.asset.tokenId), owned()]);
  if (!(r.issuedAt <= now && now < r.expiresAt && r.expiresAt - r.issuedAt <= MAX_LIFETIME && r.expiresAt <= c.validUntil)) return decline('EXPIRED', s.state);
  if (r.configurationCommitment !== cc) return decline('RULES_CHANGED', s.state);
  if (!own) return decline('NOT_OWNED', s.state);
  if (r.state.version !== s.state.version || r.state.commitment !== s.state.commitment) return decline('STALE_STATE', s.state);
  const eq = equipmentOf(s.raws, trait), reason = refusalFor(r.action, eq, own);
  if (reason !== 'NONE') return decline(reason, s.state);

  const equip = r.action.kind === 'WEAPON_EQUIP', weaponId = r.action.weaponId;
  const hilt = equip ? (eq.fromTrait?.weaponId === weaponId ? eq.fromTrait.hilt : WEAPONS[weaponId].hilt) : eq.hilt;
  const choice = JSON.stringify({ weaponId: equip ? weaponId : 'none', hilt, at: new Date(now * 1000).toISOString(), origin: 'RAAP_APPROVED', requestId: r.requestId });
  const version = (BigInt(s.version) + 1n).toString();
  const after = { version, commitment: stateCommitmentOf(c, [choice, ...s.raws.slice(1)], cc) };
  const applied = receipt('APPLIED', 'NONE', s.state, after, [{ kind: 'EQUIPMENT', slot: 'weapon', beforeWeaponId: eq.equipped, afterWeaponId: equip ? weaponId : null }], now);
  let res;
  try {
    res = await deps.redis(['EVAL', EXECUTE_LUA, String(stateKeys(c).length + 2), rKey, versionKey(c), ...stateKeys(c),
      s.version, String(r.issuedAt), String(r.expiresAt), choice, version, canonical(applied), String(retainAt(c, r.expiresAt)), ...s.raws.map((v) => v ?? ABSENT)]);
  } catch (e) { res = null; }
  if (!Array.isArray(res)) return ok(receipt('OUTCOME_UNKNOWN', 'AWAITING_CONFIRMATION', s.state, null, [], null));   // check RECEIPT, never resend
  if (res[0] === 'APPLIED') return ok(applied);
  if (res[0] === 'RECORDED') return savedResult(res[1]);
  if (res[0] === 'EXPIRED') return decline('EXPIRED', s.state);
  if (res[0] === 'STALE') { let cur = s.state; try { cur = (await live()).state; } catch (e) {} return decline('STALE_STATE', cur); }
  return ok(receipt('OUTCOME_UNKNOWN', 'AWAITING_CONFIRMATION', s.state, null, [], null));
}
