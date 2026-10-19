// RAAP <-> Universe dev: the player's wallet <-> Rebel Economy account link, and experience-sharing consent (Oct 19).
// raap-core docs/integrations/universe-v1/chest (README §1-2, CONTRACT_NOTES, protocol.d.ts, reference.mjs). The player
// uses it in the browser (raap-link.html) while signed in to BOTH the wallet (ra_wallet) and the Rebel Economy (ra_econ:
// Discord or name + PIN); the Economy user id never leaves Universe (RAAP sees an opaque account commitment).
//   PREPARE_LINK      the exact EconomyLink to sign: this connection's wallet + Rebel, a fresh random link id, the next
//                     revision, the account commitment, at most 24 h (and never past the connection's validUntil)
//   SAVE_LINK         the owner's EIP-191 signature over consentMessage(request); both sessions, the live owner and every
//                     pin checked again; the one-use challenge is consumed and the link saved in one Lua script
//   PREPARE_SHARING / SAVE_SHARING   the same for a SharingConsent (which confirmed experiences may be shared, 24 h)
//   REVOKE            wallet-signed RevokeConsent: unlink, or stop sharing (GET hands out the exact request to sign)
//   DISCONNECT        the linked Economy account itself, no wallet signature: ends its own link (nothing else)
//   GET               the page's status: pins, server time, the two signed-in accounts, the link and sharing
// A new link (another account, or the same one again) gets a new link id and revision: older chest preparations and
// sharing selections stop matching. A Rebel seen with another owner ends its link (OWNER_CHANGED).
// Records (raap:v1:dev:*, expire at the connection's retainUntil): link-challenge:<nonce> (6 min), link:<linkId>,
// link-current:<connectionId>:<playerHash>, link-account:<connectionId>:<accountHash> (the claim-time lookup for the
// event feed), sharing:<linkId>, link-nonce:<nonce> (used revocation nonces).
import crypto from 'node:crypto';
import { canonical, commitment, playerIdOf, connectionConfig, retainAt, signedBy, V, devKey, playerHash, targetOf, ABSENT, fail, ok, parse, EVENT_KINDS } from './_raap-universe.mjs';

const { RX, exact, str, secs, isAsset, isTarget, uniq } = V;
export const APPROVE = 300, LINK_MAX = 86400;
const stamp = (t) => new Date(t * 1000).toISOString();
const rand32 = () => '0x' + crypto.randomBytes(32).toString('hex');
export const requestCommitmentOf = (r) => commitment(r.schema, r);
export const accountCommitment = ({ connectionId, linkId, economyUserId }) =>
  commitment('universe.raap.economy-account.v1', { environment: 'dev', connectionId, linkId, economyUserId });

// ---- the readable messages (reference.mjs consentMessage, byte for byte) ----
function identityLines(r) {
  return [`Player wallet: ${r.wallet}`, `Rebel: ${r.asset.collection} #${r.asset.tokenId}`, `Network chain ID: ${r.asset.chainId}`,
    `Controller epoch: ${r.controllerEpoch}`, `Game: ${r.issuer}`, `RAAP: ${r.audience}`, `Environment: ${r.environment}`,
    `Connection: ${r.connectionId} / ${r.connectionRevision}`, `Account link: ${r.link.linkId} / ${r.link.revision}`,
    `Account commitment: ${r.link.accountCommitment}`, `Nonce: ${r.nonce}`, `Request: ${requestCommitmentOf(r)}`];
}
export function consentMessage(r) {
  let lines;
  if (r.schema === 'raap.universe.economy-link.v1') lines = ['Link my signed-in Universe Economy account to this wallet',
    'This links the account just shown in Universe. It does not play, pay, spend points or share public history.',
    `Approve before (UTC): ${stamp(r.approveBefore)}`, `Link ends (UTC): ${stamp(r.validUntil)}`];
  else if (r.schema === 'raap.universe.sharing-consent.v1') lines = [`Share confirmed Universe experiences with Rebel #${r.asset.tokenId}`,
    `Event types: ${r.eventKinds.join(', ')}`,
    'These experiences may appear in this Rebel\'s public history. This does not authorize game actions or award extra points or XP.',
    `Selection: ${r.selectionId}`, `Approve before (UTC): ${stamp(r.approveBefore)}`, `Sharing ends (UTC): ${stamp(r.validUntil)}`];
  else lines = [r.purpose === 'UNLINK_UNIVERSE_ECONOMY_ACCOUNT' ? 'Disconnect my Universe Economy account link' : 'Stop sharing Universe experiences',
    'This stops future use of this permission. Existing game rewards and saved receipts are preserved.',
    `Selection: ${r.selectionId ?? 'all selections for this link'}`, `Approve before (UTC): ${stamp(r.expiresAt)}`];
  return ['RAAP approval', '', ...lines, 'This is not an Ethereum transaction or NFT transfer.', '', 'Verification details', ...identityLines(r)].join('\n');
}

// ---- strict shapes (chest/schemas.json) ----
export const isLinkRef = (l) => exact(l, ['linkId', 'revision', 'accountCommitment']) && str(l.linkId, RX.hex32) && str(l.revision, RX.dec) && str(l.accountCommitment, RX.hex32);
const BASE = ['schema', 'environment', 'issuer', 'audience', 'connectionId', 'connectionRevision', 'wallet', 'asset', 'controllerEpoch', 'link', 'nonce', 'issuedAt'];
const baseOk = (r) => r.environment === 'dev' && str(r.issuer, RX.origin, 256) && str(r.audience, RX.origin, 256) && str(r.connectionId, RX.id)
  && str(r.connectionRevision, RX.dec) && str(r.wallet, RX.addr) && isAsset(r.asset) && secs(r.controllerEpoch) && isLinkRef(r.link) && str(r.nonce, RX.hex32) && secs(r.issuedAt);
const isKinds = (k) => uniq(k, (x) => EVENT_KINDS.includes(x), 4);
const isLinkRequest = (r) => exact(r, [...BASE, 'approveBefore', 'validUntil', 'purpose']) && r.schema === 'raap.universe.economy-link.v1' && baseOk(r)
  && secs(r.approveBefore) && secs(r.validUntil) && r.purpose === 'LINK_UNIVERSE_ECONOMY_ACCOUNT';
const isSharingRequest = (r) => exact(r, [...BASE, 'approveBefore', 'validUntil', 'purpose', 'selectionId', 'eventKinds', 'publicExperienceConsent', 'gameplayAuthority'])
  && r.schema === 'raap.universe.sharing-consent.v1' && baseOk(r) && secs(r.approveBefore) && secs(r.validUntil) && r.purpose === 'SHARE_CONFIRMED_UNIVERSE_EXPERIENCES'
  && str(r.selectionId, RX.hex32) && isKinds(r.eventKinds) && r.publicExperienceConsent === true && r.gameplayAuthority === false;
const isRevokeRequest = (r) => exact(r, [...BASE, 'purpose', 'selectionId', 'expiresAt']) && r.schema === 'raap.universe.revoke-consent.v1' && baseOk(r) && secs(r.expiresAt)
  && ((r.purpose === 'UNLINK_UNIVERSE_ECONOMY_ACCOUNT' && r.selectionId === null) || (r.purpose === 'STOP_SHARING_UNIVERSE_EXPERIENCES' && str(r.selectionId, RX.hex32)));
const envelope = (a, schema, isReq) => exact(a, ['schema', 'request', 'ownerApproval']) && a.schema === schema && isReq(a.request)
  && exact(a.ownerApproval, ['scheme', 'signer', 'signature']) && a.ownerApproval.scheme === 'eip191-personal-sign' && str(a.ownerApproval.signer, RX.addr) && str(a.ownerApproval.signature, RX.sig);
export function isLinkOperation(o) {
  if (!V.isObj(o)) return false;
  switch (o.operation) {
    case 'PREPARE_LINK': return exact(o, ['operation', 'target']) && isTarget(o.target);
    case 'SAVE_LINK': return exact(o, ['operation', 'authorization']) && envelope(o.authorization, 'raap.universe.authorized-economy-link.v1', isLinkRequest);
    case 'PREPARE_SHARING': return exact(o, ['operation', 'target', 'link', 'eventKinds']) && isTarget(o.target) && isLinkRef(o.link) && isKinds(o.eventKinds);
    case 'SAVE_SHARING': return exact(o, ['operation', 'authorization']) && envelope(o.authorization, 'raap.universe.authorized-sharing-consent.v1', isSharingRequest);
    case 'REVOKE': return exact(o, ['operation', 'authorization']) && envelope(o.authorization, 'raap.universe.authorized-revoke-consent.v1', isRevokeRequest);
    case 'DISCONNECT': return exact(o, ['operation', 'link']) && isLinkRef(o.link);       // the linked Economy account's own control
    default: return false;
  }
}

// ---- records ----
const challengeKey = (nonce) => devKey(`link-challenge:${nonce}`);
export const linkKey = (linkId) => devKey(`link:${linkId}`);
export const currentKey = (c) => devKey(`link-current:${c.connectionId}:${playerHash(playerIdOf(c.wallet))}`);
export const accountIndexKey = (c, economyUserId) =>
  devKey(`link-account:${c.connectionId}:${commitment('universe.raap.account-index.v1', { connectionId: c.connectionId, economyUserId }).slice(2)}`);
export const sharingKey = (linkId) => devKey(`sharing:${linkId}`);
const nonceKey = (nonce) => devKey(`link-nonce:${nonce}`);
export const refOf = (rec) => ({ linkId: rec.linkId, revision: rec.revision, accountCommitment: rec.accountCommitment });
// the link the connection's Rebel has now: { id, raw, rec } (all null when none)
export async function currentLink(c, deps) {
  const id = await deps.redis(['GET', currentKey(c)]);
  if (!id) return { id: null, raw: null, rec: null };
  const raw = await deps.redis(['GET', linkKey(id)]);
  return { id, raw, rec: parse(raw) };
}
// LINKED / EXPIRED / REVOKED / NOT_LINKED for the connection as it is configured now
export function linkStatus(c, rec, now) {
  if (!rec) return 'NOT_LINKED';
  if (rec.status !== 'ACTIVE') return 'REVOKED';
  if (rec.connectionId !== c.connectionId || rec.connectionRevision !== c.connectionRevision || rec.controllerEpoch !== c.controllerEpoch
    || rec.wallet !== c.wallet || canonical(rec.asset) !== canonical(c.asset) || now >= rec.validUntil || now >= c.validUntil || c.status !== 'ACTIVE') return 'EXPIRED';
  return 'LINKED';
}
// the sharing selection in force for a link record (or null), and its status
export function sharingStatus(c, rec, sharing, now) {
  if (!sharing) return 'NOT_SHARING';
  if (sharing.status !== 'ACTIVE') return 'REVOKED';
  if (!rec || sharing.linkId !== rec.linkId || sharing.linkRevision !== rec.revision || linkStatus(c, rec, now) !== 'LINKED' || now >= sharing.validUntil || !c.events) return 'EXPIRED';
  return 'SHARING';
}
// the owner, owner only (no delegates): 'OWNED' / 'NOT_OWNED' / 'UNKNOWN' (the chain did not answer)
export async function ownership(c, deps) {
  let o = null;
  try { o = await deps.owner(c.collectionKey, c.asset.tokenId); } catch (e) {}
  return !o || !RX.addr.test(o) ? 'UNKNOWN' : o === c.wallet ? 'OWNED' : 'NOT_OWNED';
}

// end a link (and its sharing): the raw bytes must still be the ones read. KEYS: link, account index, sharing.
// ARGV: link raw, revoked link record, link id, retain-until, revoked sharing record (or ABSENT), sharing raw (or ABSENT)
const REVOKE_LINK_LUA = `
if redis.call('GET',KEYS[1])~=ARGV[1] then return 'CHANGED' end
redis.call('SET',KEYS[1],ARGV[2],'EXAT',tonumber(ARGV[4]))
if redis.call('GET',KEYS[2])==ARGV[3] then redis.call('DEL',KEYS[2]) end
if ARGV[5]~='${ABSENT}' and (redis.call('GET',KEYS[3]) or '${ABSENT}')==ARGV[6] then redis.call('SET',KEYS[3],ARGV[5],'EXAT',tonumber(ARGV[4])) end
return 'REVOKED'
`;
export async function revokeLink(c, deps, cur, by, now) {
  if (!cur.rec || cur.rec.status !== 'ACTIVE') return 'REVOKED';
  const sRaw = await deps.redis(['GET', sharingKey(cur.rec.linkId)]), s = parse(sRaw);
  const rec = canonical({ ...cur.rec, status: 'REVOKED', revokedAt: now, revokedBy: by });
  const sh = s && s.status === 'ACTIVE' ? canonical({ ...s, status: 'REVOKED', revokedAt: now, revokedBy: by }) : ABSENT;
  return deps.redis(['EVAL', REVOKE_LINK_LUA, '3', linkKey(cur.rec.linkId), accountIndexKey(c, cur.rec.economyUserId), sharingKey(cur.rec.linkId),
    cur.raw, rec, cur.rec.linkId, String(retainAt(c)), sh, sRaw ?? ABSENT]);
}
// a Rebel seen with another owner ends its current link (best effort; a chain that did not answer changes nothing)
export async function endLinkIfSold(c, deps, now) {
  try { const cur = await currentLink(c, deps); if (cur.rec?.status === 'ACTIVE') await revokeLink(c, deps, cur, 'OWNER_CHANGED', now); } catch (e) {}
}

// consume the link challenge and save the new link + pointer + account index; the previous link (if any) must be
// exactly as read. KEYS: challenge, current, new link, new account index, previous link, previous account index.
// ARGV: challenge raw, previous link id (or ABSENT), previous link raw, new record, new link id, retain-until
const SAVE_LINK_LUA = `
if redis.call('GET',KEYS[1])~=ARGV[1] then return 'USED' end
if (redis.call('GET',KEYS[2]) or '${ABSENT}')~=ARGV[2] then return 'CHANGED' end
if ARGV[2]~='${ABSENT}' and (redis.call('GET',KEYS[5]) or '${ABSENT}')~=ARGV[3] then return 'CHANGED' end
redis.call('DEL',KEYS[1])
redis.call('SET',KEYS[3],ARGV[4],'EXAT',tonumber(ARGV[6]))
redis.call('SET',KEYS[2],ARGV[5],'EXAT',tonumber(ARGV[6]))
if ARGV[2]~='${ABSENT}' and KEYS[6]~=KEYS[4] and redis.call('GET',KEYS[6])==ARGV[2] then redis.call('DEL',KEYS[6]) end
redis.call('SET',KEYS[4],ARGV[5],'EXAT',tonumber(ARGV[6]))
return 'SAVED'
`;
// consume the sharing challenge; the link must still be the current one, unchanged. KEYS: challenge, current, link,
// sharing. ARGV: challenge raw, link id, link raw, sharing record, retain-until
const SAVE_SHARING_LUA = `
if redis.call('GET',KEYS[1])~=ARGV[1] then return 'USED' end
if redis.call('GET',KEYS[2])~=ARGV[2] then return 'CHANGED' end
if redis.call('GET',KEYS[3])~=ARGV[3] then return 'CHANGED' end
redis.call('DEL',KEYS[1])
redis.call('SET',KEYS[4],ARGV[4],'EXAT',tonumber(ARGV[5]))
return 'SAVED'
`;
const CAS_LUA = `
if redis.call('GET',KEYS[1])~=ARGV[1] then return 'CHANGED' end
redis.call('SET',KEYS[1],ARGV[2],'EXAT',tonumber(ARGV[3]))
return 'DONE'
`;

// the fields every request of this connection carries (issuer = this game, audience = RAAP)
const pinsOf = (c) => ({ environment: 'dev', issuer: c.audience, audience: c.issuer, connectionId: c.connectionId, connectionRevision: c.connectionRevision,
  wallet: c.wallet, asset: c.asset, controllerEpoch: c.controllerEpoch });
const pinned = (r, c) => Object.entries(pinsOf(c)).every(([k, v]) => canonical(r[k]) === canonical(v));
const accountOf = (econ) => ({ kind: /^name:/.test(String(econ.d || '')) ? 'name' : 'discord', name: String(econ.n || econ.un || '').slice(0, 64) });
export const linkEnabled = (c) => !!(c && (c.chest || c.events));

// a RevokeConsent ready to sign (GET hands these out: the server's clock, a fresh nonce; REVOKE spends the nonce once)
function revokeRequest(c, rec, purpose, selectionId, now) {
  return { schema: 'raap.universe.revoke-consent.v1', ...pinsOf(c), link: refOf(rec), nonce: rand32(), issuedAt: now, purpose, selectionId, expiresAt: now + APPROVE };
}

// session = { wallet (signed-in wallet or null), econ (the ra_econ session or null) }; deps = { env, now(), redis(args),
// owner(collectionKey, tokenId) }. -> { status, body }
export async function linkStatusPage(session, deps) {
  const c = connectionConfig(deps.env), now = deps.now();
  if (deps.env.VERCEL_ENV === 'production' || !linkEnabled(c)) return ok({ schema: 'universe.raap.link-page.v1', enabled: false, now });
  const cur = await currentLink(c, deps), rec = cur.rec, status = linkStatus(c, rec, now);
  const s = rec ? parse(await deps.redis(['GET', sharingKey(rec.linkId)])) : null, sStatus = sharingStatus(c, rec, s, now);
  const mine = !!(rec && session.econ && rec.economyUserId === session.econ.u);
  // the link's details (reference, account kind, sharing, revocations) only for the wallet's holder or the linked account
  if (session.wallet !== c.wallet && !mine) {
    return ok({ schema: 'universe.raap.link-page.v1', enabled: true, now,
      connection: { connectionId: c.connectionId, connectionRevision: c.connectionRevision, game: c.audience, raap: c.issuer, wallet: c.wallet, asset: c.asset,
        controllerEpoch: c.controllerEpoch, validUntil: c.validUntil, sharing: !!c.events, eventKinds: c.events ? c.events.eventKinds : [], target: targetOf(c) },
      session: { wallet: session.wallet || null, walletMatches: false, economy: session.econ ? accountOf(session.econ) : null },
      link: { status, link: null, validUntil: null, account: null, mine: false }, sharing: { status: sStatus, selectionId: null, eventKinds: [], validUntil: null },
      revoke: { unlink: null, stopSharing: null } });
  }
  return ok({
    schema: 'universe.raap.link-page.v1', enabled: true, now,
    connection: { connectionId: c.connectionId, connectionRevision: c.connectionRevision, game: c.audience, raap: c.issuer, wallet: c.wallet, asset: c.asset,
      controllerEpoch: c.controllerEpoch, validUntil: c.validUntil, sharing: !!c.events, eventKinds: c.events ? c.events.eventKinds : [], target: targetOf(c) },
    session: { wallet: session.wallet || null, walletMatches: session.wallet === c.wallet, economy: session.econ ? accountOf(session.econ) : null },
    link: rec ? { status, link: refOf(rec), validUntil: rec.validUntil, account: { kind: rec.accountKind }, mine } : { status, link: null, validUntil: null, account: null, mine: false },
    sharing: s ? { status: sStatus, selectionId: s.selectionId, eventKinds: s.eventKinds, validUntil: s.validUntil } : { status: sStatus, selectionId: null, eventKinds: [], validUntil: null },
    revoke: {
      unlink: rec && rec.status === 'ACTIVE' ? (() => { const r = revokeRequest(c, rec, 'UNLINK_UNIVERSE_ECONOMY_ACCOUNT', null, now); return { request: r, message: consentMessage(r) }; })() : null,
      stopSharing: s && s.status === 'ACTIVE' ? (() => { const r = revokeRequest(c, rec, 'STOP_SHARING_UNIVERSE_EXPERIENCES', s.selectionId, now); return { request: r, message: consentMessage(r) }; })() : null
    }
  });
}

// op = the parsed LinkOperation (or DISCONNECT); session and deps as above
export async function handleLinkOperation(op, session, deps) {
  if (!isLinkOperation(op)) return fail(400, 'MALFORMED');
  const c = connectionConfig(deps.env);
  if (deps.env.VERCEL_ENV === 'production' || !linkEnabled(c)) return fail(403, 'CONNECTION_UNAVAILABLE');
  const now = deps.now(), econ = session.econ;
  if ((op.operation === 'PREPARE_SHARING' || op.operation === 'SAVE_SHARING') && !c.events) return fail(403, 'OPERATION_NOT_ENABLED');
  if (op.operation !== 'REVOKE' && op.operation !== 'DISCONNECT' && (c.status !== 'ACTIVE' || now >= c.validUntil)) return fail(403, 'CONNECTION_CLOSED');
  // who is signed in: the wallet for everything but DISCONNECT; the Economy account for everything but REVOKE
  if (op.operation !== 'DISCONNECT') {
    if (!session.wallet) return fail(401, 'WALLET_NOT_SIGNED_IN');
    if (session.wallet !== c.wallet) return fail(403, 'WRONG_WALLET');
  }
  if (op.operation !== 'REVOKE' && !econ) return fail(401, 'ECONOMY_NOT_SIGNED_IN');
  if (op.target && canonical(op.target) !== canonical(targetOf(c))) return fail(403, 'NOT_AUTHORIZED');
  const retain = String(retainAt(c));

  if (op.operation === 'PREPARE_LINK' || op.operation === 'PREPARE_SHARING' || op.operation === 'SAVE_LINK' || op.operation === 'SAVE_SHARING') {
    const own = await ownership(c, deps);
    if (own === 'NOT_OWNED') { await endLinkIfSold(c, deps, now); return fail(403, 'NOT_OWNED'); }
    if (own !== 'OWNED') return fail(503, 'TEMPORARILY_UNAVAILABLE', { committed: false });
  }

  if (op.operation === 'PREPARE_LINK') {
    const validUntil = Math.min(now + LINK_MAX, c.validUntil);
    if (validUntil <= now + APPROVE) return fail(403, 'CONNECTION_CLOSED');
    const cur = await currentLink(c, deps);
    const revision = cur.rec ? (BigInt(cur.rec.revision) + 1n).toString() : '1';
    const linkId = rand32(), nonce = rand32();
    const request = { schema: 'raap.universe.economy-link.v1', ...pinsOf(c),
      link: { linkId, revision, accountCommitment: accountCommitment({ connectionId: c.connectionId, linkId, economyUserId: econ.u }) },
      nonce, issuedAt: now, approveBefore: now + APPROVE, validUntil, purpose: 'LINK_UNIVERSE_ECONOMY_ACCOUNT' };
    const challenge = { kind: 'LINK', request, economyUserId: econ.u, accountKind: accountOf(econ).kind, wallet: session.wallet,
      prevLinkId: cur.id, prevRaw: cur.raw, prevEconomyUserId: cur.rec ? cur.rec.economyUserId : null };
    await deps.redis(['SET', challengeKey(nonce), canonical(challenge), 'EX', String(APPROVE + 60)]);
    return ok({ schema: 'universe.raap.link-preparation.v1', request, message: consentMessage(request),
      accounts: { wallet: c.wallet, asset: c.asset, economy: accountOf(econ) },
      replaces: cur.rec ? { link: refOf(cur.rec), status: linkStatus(c, cur.rec, now), sameAccount: cur.rec.economyUserId === econ.u } : null });
  }

  if (op.operation === 'SAVE_LINK' || op.operation === 'SAVE_SHARING') {
    const auth = op.authorization, r = auth.request, kind = op.operation === 'SAVE_LINK' ? 'LINK' : 'SHARING';
    const chRaw = await deps.redis(['GET', challengeKey(r.nonce)]), ch = parse(chRaw);
    if (!ch || ch.kind !== kind || canonical(ch.request) !== canonical(r)) return fail(409, 'CHALLENGE_NOT_FOUND');   // expired, used, or not this one
    if (ch.economyUserId !== econ.u) return fail(409, 'ACCOUNT_CHANGED');
    if (ch.wallet !== session.wallet) return fail(409, 'WALLET_CHANGED');
    if (!pinned(r, c)) return fail(409, 'CONNECTION_CHANGED');
    if (!(r.issuedAt <= now && now < r.approveBefore && r.approveBefore <= r.issuedAt + APPROVE && r.validUntil > r.approveBefore
      && r.validUntil <= r.issuedAt + LINK_MAX && r.validUntil <= c.validUntil)) return fail(403, 'EXPIRED');
    if (!(await signedBy(consentMessage(r), auth.ownerApproval, c.wallet))) return fail(403, 'NOT_AUTHORIZED');
    const rc = requestCommitmentOf(r);
    if (kind === 'LINK') {
      const rec = { schema: 'universe.raap.link-record.v1', linkId: r.link.linkId, revision: r.link.revision, accountCommitment: r.link.accountCommitment,
        economyUserId: econ.u, accountKind: ch.accountKind, connectionId: c.connectionId, connectionRevision: c.connectionRevision, wallet: c.wallet,
        asset: c.asset, controllerEpoch: c.controllerEpoch, issuedAt: r.issuedAt, validUntil: r.validUntil, requestCommitment: rc,
        ownerApproval: auth.ownerApproval, savedAt: now, status: 'ACTIVE', revokedAt: null, revokedBy: null };
      const prevKey = ch.prevLinkId ? linkKey(ch.prevLinkId) : linkKey(r.link.linkId);
      const prevIndex = ch.prevEconomyUserId ? accountIndexKey(c, ch.prevEconomyUserId) : accountIndexKey(c, econ.u);
      const res = await deps.redis(['EVAL', SAVE_LINK_LUA, '6', challengeKey(r.nonce), currentKey(c), linkKey(r.link.linkId), accountIndexKey(c, econ.u), prevKey, prevIndex,
        chRaw, ch.prevLinkId ?? ABSENT, ch.prevRaw ?? ABSENT, canonical(rec), r.link.linkId, retain]);
      if (res === 'USED') return fail(409, 'CHALLENGE_NOT_FOUND');
      if (res !== 'SAVED') return fail(409, 'LINK_CHANGED');
      return ok({ schema: 'universe.raap.link-saved.v1', link: r.link, status: 'LINKED', validUntil: r.validUntil });
    }
    const cur = await currentLink(c, deps);
    if (linkStatus(c, cur.rec, now) !== 'LINKED' || canonical(refOf(cur.rec)) !== canonical(r.link) || ch.linkId !== cur.rec.linkId) return fail(409, 'LINK_CHANGED');
    if (cur.rec.economyUserId !== econ.u) return fail(403, 'NOT_LINKED_ACCOUNT');
    if (!r.eventKinds.every((k) => c.events.eventKinds.includes(k)) || r.validUntil > cur.rec.validUntil) return fail(409, 'CONNECTION_CHANGED');
    const s = { schema: 'universe.raap.sharing-record.v1', selectionId: r.selectionId, linkId: cur.rec.linkId, linkRevision: cur.rec.revision,
      eventKinds: r.eventKinds, issuedAt: r.issuedAt, validUntil: r.validUntil, requestCommitment: rc, ownerApproval: auth.ownerApproval, savedAt: now,
      status: 'ACTIVE', revokedAt: null, revokedBy: null };
    const res = await deps.redis(['EVAL', SAVE_SHARING_LUA, '4', challengeKey(r.nonce), currentKey(c), linkKey(cur.rec.linkId), sharingKey(cur.rec.linkId),
      chRaw, cur.rec.linkId, cur.raw, canonical(s), retain]);
    if (res === 'USED') return fail(409, 'CHALLENGE_NOT_FOUND');
    if (res !== 'SAVED') return fail(409, 'LINK_CHANGED');
    return ok({ schema: 'universe.raap.sharing-saved.v1', link: r.link, selectionId: r.selectionId, eventKinds: r.eventKinds, status: 'SHARING', validUntil: r.validUntil });
  }

  if (op.operation === 'PREPARE_SHARING') {
    const cur = await currentLink(c, deps);
    if (linkStatus(c, cur.rec, now) !== 'LINKED' || canonical(refOf(cur.rec)) !== canonical(op.link)) return fail(409, 'LINK_CHANGED');
    if (cur.rec.economyUserId !== econ.u) return fail(403, 'NOT_LINKED_ACCOUNT');
    if (!op.eventKinds.every((k) => c.events.eventKinds.includes(k))) return fail(422, 'EVENT_KIND_NOT_ENABLED');
    const validUntil = Math.min(now + LINK_MAX, cur.rec.validUntil, c.validUntil);
    if (validUntil <= now + APPROVE) return fail(403, 'CONNECTION_CLOSED');
    const nonce = rand32();
    const request = { schema: 'raap.universe.sharing-consent.v1', ...pinsOf(c), link: refOf(cur.rec), nonce, issuedAt: now, approveBefore: now + APPROVE, validUntil,
      purpose: 'SHARE_CONFIRMED_UNIVERSE_EXPERIENCES', selectionId: rand32(), eventKinds: op.eventKinds, publicExperienceConsent: true, gameplayAuthority: false };
    const challenge = { kind: 'SHARING', request, economyUserId: econ.u, wallet: session.wallet, linkId: cur.rec.linkId };
    await deps.redis(['SET', challengeKey(nonce), canonical(challenge), 'EX', String(APPROVE + 60)]);
    return ok({ schema: 'universe.raap.sharing-preparation.v1', request, message: consentMessage(request) });
  }

  if (op.operation === 'REVOKE') {
    const auth = op.authorization, r = auth.request;
    if (!pinned(r, c)) return fail(409, 'CONNECTION_CHANGED');
    if (!(r.issuedAt <= now && now < r.expiresAt && r.expiresAt <= r.issuedAt + APPROVE)) return fail(403, 'EXPIRED');
    if (!(await signedBy(consentMessage(r), auth.ownerApproval, c.wallet))) return fail(403, 'NOT_AUTHORIZED');
    const raw = await deps.redis(['GET', linkKey(r.link.linkId)]), rec = parse(raw);
    if (!rec || canonical(refOf(rec)) !== canonical(r.link)) return fail(409, 'LINK_CHANGED');
    if ((await deps.redis(['SET', nonceKey(r.nonce), '1', 'NX', 'EXAT', String(retainAt(c, r.expiresAt))])) !== 'OK') return fail(409, 'NONCE_USED');
    if (r.purpose === 'UNLINK_UNIVERSE_ECONOMY_ACCOUNT') {
      const res = await revokeLink(c, deps, { id: rec.linkId, raw, rec }, 'WALLET', now);
      return res === 'REVOKED' ? ok({ schema: 'universe.raap.link-revoked.v1', link: r.link, status: 'REVOKED' }) : fail(409, 'LINK_CHANGED');
    }
    const sRaw = await deps.redis(['GET', sharingKey(rec.linkId)]), s = parse(sRaw);
    if (!s || s.selectionId !== r.selectionId) return fail(409, 'SELECTION_CHANGED');
    if (s.status === 'ACTIVE') {
      const res = await deps.redis(['EVAL', CAS_LUA, '1', sharingKey(rec.linkId), sRaw, canonical({ ...s, status: 'REVOKED', revokedAt: now, revokedBy: 'WALLET' }), retain]);
      if (res !== 'DONE') return fail(409, 'SELECTION_CHANGED');
    }
    return ok({ schema: 'universe.raap.sharing-revoked.v1', link: r.link, selectionId: r.selectionId, status: 'REVOKED' });
  }

  // DISCONNECT: the linked Economy account ends its own link (it cannot touch another account's)
  const raw = await deps.redis(['GET', linkKey(op.link.linkId)]), rec = parse(raw);
  if (!rec || canonical(refOf(rec)) !== canonical(op.link)) return fail(409, 'LINK_CHANGED');
  if (rec.economyUserId !== econ.u) return fail(403, 'NOT_LINKED_ACCOUNT');
  const res = await revokeLink(c, deps, { id: rec.linkId, raw, rec }, 'ACCOUNT', now);
  return res === 'REVOKED' ? ok({ schema: 'universe.raap.link-revoked.v1', link: op.link, status: 'REVOKED' }) : fail(409, 'LINK_CHANGED');
}
