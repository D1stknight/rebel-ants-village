# Universe ↔ RAAP connection, v1 (dev) — handback

Prepared October 19, 2026, by the Universe chat, against raap-core branch `docs/universe-raap-handoff-20261019`
(commit `1ad46ac`, `docs/integrations/universe-v1/`). Universe repository `D1stknight/rebel-ants-village`, branch `dev` only.
Nothing here is on `main` / production, and no live action was performed.

**Updated Oct 19 (later)** after RAAP's adapter review (`RAAP_ADAPTER_HANDBACK_20261019.md`): bounded retention
(`retainUntil`, §2 / §6), the rate limit kept under `raap:v1:dev:rl:*` (§3), the direct-key wallet wording (§8), and the
connection format v2 (§2). The chest action, the wallet ↔ Economy account link and experience sharing are in
`docs/raap-universe-chest-v1.md`.

**Corrected Oct 19 (later)** after RAAP's review of `291f167` (raap-core `75232c3`): records end exactly at
`retainUntil` (no +5 minutes past it) and requests end at least 300 s before it (§2, §4); EXECUTE never answers with a
no-effect claim (`committed: false` removed, §4 step 7).

## In plain words (for Miguel)

- **What was built:** a private door in the game's server that only RAAP's server can use (it needs a secret key).
  Through it RAAP can (1) look at a Rebel's weapon and which weapons it may wear, (2) prepare one exact change,
  (3) apply that change after the Rebel's owner has signed a readable approval in their wallet, and (4) read back the
  saved result later without doing the action again.
- **What it can change:** only the Rebel's weapon pick — the same pick the Forge's weapon buttons save. Equip one of the
  six weapons, or put the weapon away. It costs nothing, pays nothing, never touches Rebel Points, never moves an NFT.
- **Why it is safe to have on dev:** it stays switched off until two settings exist in Vercel (Preview only); it refuses
  production, refuses browsers, refuses anyone but the one wallet and Rebel written into its settings, and refuses a
  request if anything changed since it was approved (for example you changed the weapon by hand in the Forge meanwhile).
  Sending the same request twice never applies it twice.
- **What it does not do yet:** items that get used up, quests and normal-play history. The game keeps those in the
  player's browser today, so they cannot be offered as server facts yet (details in §9–10).
- **To switch it on (later, when you and the RAAP chat say so):** RAAP's operator makes a new secret key, you add two
  settings in Vercel → Project → Settings → Environment Variables, **Preview only** (§2). Nobody pastes the key in a chat.
- **Cost:** no new service or subscription. Each call is a few database reads, one ownership check on the chain
  (free read) and, for an approved change, one database write. RAAP's records (~1–2 KB each) are kept until a date set
  when the connection is approved (`retainUntil`, §2), then they expire by themselves.

## 1. Where things are

| | |
|---|---|
| Branch | `dev` |
| Commits | `9406992` weapon table moved into `api/_weapon-catalog.mjs` (same exports, checked); `b2980e9` the connection (`api/_raap-universe.mjs`, `api/raap-universe.mjs`); this document + `docs/raap-universe-v1-examples.json`; `e85996e` review fixes (retention, rate-limit namespace, connection v2); later commits: `docs/raap-universe-chest-v1.md` §1 |
| Endpoint | `POST https://rebel-ants-village-git-dev-miguel-concepcions-projects.vercel.app/api/raap-universe` (behind Vercel Authentication: needs `x-vercel-protection-bypass`) |
| Deployed | code only. Without its two settings every call answers `403 CONNECTION_UNAVAILABLE`. |
| Live-observed | nothing. No real wallet, Rebel, key or shared record was used. |

Local evidence: §13. Everything RAAP-side (adapter, journal, Life admission, the operating approval) is still to do.

## 2. Switching it on (Preview environment only)

Two Vercel variables, **Preview** scope (never Production):

- `RAAP_UNIVERSE_DEV_CONNECTION_KEY` — 64 lowercase hex characters (32 random bytes), made by RAAP's operator and stored
  on RAAP's worker; Miguel pastes it into Vercel. It is a **new** key: the old World key is not reused or widened.
- `RAAP_UNIVERSE_DEV_CONNECTION` — the pinned connection (not secret). Values known today for #909, the rest RAAP fills:

```json
{
  "schema": "universe.raap.connection.v2",
  "environment": "dev",
  "connectionId": "<RAAP: id, [a-zA-Z0-9_.:-]{1,128}>",
  "connectionRevision": "1",
  "issuer": "https://raap.rebelants.io",
  "audience": "https://rebel-ants-village-git-dev-miguel-concepcions-projects.vercel.app",
  "tenant": "<RAAP tenant id>",
  "journalId": "0xc9343ad4392022340c3ae695bbc72dfeb146b7277aaeb5ada3f064546f2ab626",
  "wallet": "0x3135887f360975b341a0ce0b442e9660d5d5e0d5",
  "asset": { "chainId": 1, "collection": "0x96c1469c1c76e3bb0e37c23a830d0eea6bcf9221", "tokenId": "909" },
  "collectionKey": "battle_for_colony",
  "account": "0x7227bf9bd62aba3a09228dcd443538ba7da8677f",
  "controllerEpoch": "<RAAP: current controller epoch, integer>",
  "operations": ["READ", "PREPARE", "EXECUTE", "RECEIPT"],
  "status": "ACTIVE",
  "validUntil": "<RAAP: Unix seconds, no later than the approved access term>",
  "retainUntil": "<Miguel's operating decision: Unix seconds, >= validUntil>",
  "chest": null,
  "events": null
}
```

`controllerEpoch`, `validUntil` and `retainUntil` are numbers in the real value. Every field is required; an unknown
field or a bad value makes the whole connection unavailable (403). `retainUntil` is the storage term: every
`raap:v1:dev:*` record of this connection (receipts / request tombstones, the version counter, rate-limit windows)
expires **exactly** then, never later. It must be at or after `validUntil` (it may be equal). Every request must end at
least `SETTLE_MARGIN` = 300 s before `retainUntil` (PREPARE caps `expiresAt` at `retainUntil − 300`, EXECUTE declines a
later one `EXPIRED`), so a tombstone always outlives its request's approval and a request id can never run again while
it could still be valid — inside the term, not past it. The weapon choice itself (a game record) never expires. Nothing
older than this version used a 90-day term in a live record (none was ever written).
`chest` / `events` stay `null` for the weapon-only connection (the chest, link and sharing sections are described in
`docs/raap-universe-chest-v1.md`). `"operations"` may also list `"EVENTS"` there. A Vercel variable change needs a redeploy of `dev` to take effect.
Disconnect = set `"status": "DISCONNECTED"` (or remove the variables): new READ/PREPARE/EXECUTE refused, saved results
stay readable through RECEIPT.

## 3. Transport and authentication

- `POST`, body = the contract's `Operation` JSON in the **canonical encoding** (RFC 8785 as in `reference-protocol.mjs`:
  sorted keys, no whitespace, safe integers only). Bytes that differ from `canonical(JSON.parse(body))` are refused
  (`400 NOT_CANONICAL`), which also refuses duplicate keys. UTF-8 only, no BOM, at most 64 KiB, strict schema (no extra
  fields, every field present) → else `400 MALFORMED`.
- `Authorization: Bearer <RAAP_UNIVERSE_DEV_CONNECTION_KEY>` (constant-time compare); missing → `401 NOT_AUTHENTICATED`,
  wrong → `403 CONNECTION_UNAVAILABLE`. A request with an `Origin` header (a browser) is refused. `VERCEL_ENV=production`
  is refused before anything else. 120 requests a minute per caller, counted under
  `raap:v1:dev:rl:universe:<caller hash>:<minute>` (expires after ~2 minutes; the game's own `rl:*` limits are untouched),
  `429 {error: RATE_LIMITED}` past it.
- Responses are canonical JSON too, `Cache-Control: private, no-store`.

## 4. Operations

Full request/response pairs from the local bench: `docs/raap-universe-v1-examples.json` (public test-only key, `.invalid`
origins, local Redis, a stand-in owner of #909 — **not** a live authority).

| Operation | Answer | Changes |
|---|---|---|
| `READ {target}` | `universe.raap.inventory.v1`: state, configurationCommitment, equippedWeaponId, the six weapons with eligible / refusal, availableActions, observedAt | none |
| `PREPARE {target, action}` | `universe.raap.preparation.v1` with the current state, zero charge, `expiresAt = min(now + 900, validUntil, retainUntil − 300)`; or `422 {error: ACTION_UNAVAILABLE, reason}` (`403 CONNECTION_CLOSED` once no request can end inside the term) | none, nothing reserved |
| `EXECUTE {authorization}` | `universe.raap.action-receipt.v1` (APPLIED / DECLINED / OUTCOME_UNKNOWN) | the weapon pick, once |
| `RECEIPT {target, requestId, requestCommitment}` | `universe.raap.receipt-read.v1` FOUND / NOT_FOUND; other commitment → `409` | none |
| `EVENTS` | `403 OPERATION_NOT_ENABLED` (§9) | none |

`target` must equal the pinned one (`wallet:eip155:1:<wallet>`, the pinned asset, the connectionId) or `403 NOT_AUTHORIZED`.

### EXECUTE, in order

1. Strict schema + canonical bytes (§3).
2. Pinned domain: issuer, audience, connectionId, connectionRevision, tenant, journalId, player id / wallet,
   controller address + epoch, account and asset must equal the connection; `ownerApproval.signer` = the pinned wallet.
   Nothing in the request chooses the verification configuration. Mismatch → `403 NOT_AUTHORIZED`, nothing saved.
3. Owner signature: EIP-191 `personal_sign` over `personalMessage(request)` exactly as `reference-protocol.mjs`
   (verified against the fixture vector and RAAP's own verifier, §13); canonical 65-byte ECDSA, `v` 27/28, **low-s only**
   (the high-s twin of a valid signature is refused), recovered address = signer = wallet. Failure → `403`, nothing saved.
4. Same `requestId` already saved → that receipt (byte-identical) if the request commitment matches, else
   `409 REQUEST_ID_CONFLICT`. No second change, no version increment.
5. Checks, each a **DECLINED** receipt that is saved like a success (the same request id always gets this answer):
   `EXPIRED` (outside `issuedAt <= now < expiresAt`, lifetime over 900 s, past the connection's `validUntil`, or ending
   later than `retainUntil − 300`) →
   `RULES_CHANGED` (configurationCommitment differs) → `NOT_OWNED` (the live `ownerOf` on chain is not the pinned wallet;
   delegate.xyz delegates are **not** accepted for RAAP actions) → `STALE_STATE` (version or state commitment differs) →
   the action itself (`UNSUPPORTED_ACTION`: unknown or not approved weapon; `STALE_STATE`: equipping what is already
   equipped, or unequipping what is not).
6. One Lua script (`EXECUTE_LUA`) re-reads, inside Redis: the request key (another copy may have saved first), the
   version, and the **exact raw bytes** of the weapon pick and the six weapon records the request was approved against,
   then Redis time against issuedAt / expiresAt. Only then one `MSET` (pick, version, receipt) and `EXPIREAT` (the
   retention end) on the receipt and the version.
   A human change or a competing request in between → `DECLINED STALE_STATE` with the state as it now is.
7. Lost answer from Redis → `OUTCOME_UNKNOWN` (`after: null`, `actualCharge: null`), HTTP 200. Query RECEIPT; never resend
   automatically. (Locally: the save happened, RECEIPT then showed APPLIED, a resend got that same receipt.)
   An unexpected failure → `503 {error: TEMPORARILY_UNAVAILABLE}`; a decline that could not be saved →
   `503 {error: RECEIPT_NOT_SAVED}` (no no-effect claim: RAAP reads RECEIPT). A decline that finds another answer already
   saved for that request id returns the saved one (else `OUTCOME_UNKNOWN`).

## 5. The game's rules this follows (unchanged)

- **Equipped weapon** = the Rebel's saved pick (`forge:weapon-choice:v1:battle_for_colony:<token>`), else its NFT
  `Weapons` trait; `none`, or a weapon whose studio record is not approved with a model, shows nothing (`null`) —
  the same rule as `assets/rebel-weapon.js` in the village and `forge-v2.html`.
- **Weapons** (`api/_weapon-catalog.mjs`, all six approved today): `celestial_fang` Celestial Fang, `dawns_light_arrows`
  Dawn's Light Arrows, `eclipse_edge` Eclipse Edge, `soulrender` Soulrender, `stormbringer_blade` Stormbringer Blade,
  `whisper_of_dawn` Whisper of Dawn. No weapon is bought, unlocked or changed in power by this connection.
- **#909 today** (public read, Oct 19): no saved pick; trait `Stormbringer-Blade-2` → wears `stormbringer_blade` on the
  right shoulder. Available: equip any of the other five, unequip `stormbringer_blade`.
- **Shoulder**: equip = the weapon's own side, except the Rebel's trait weapon, which goes back to the trait's side
  (`-2` = the other shoulder), as the Forge does. Unequip keeps the side.
- **The saved pick** written by RAAP: `{"weaponId", "hilt", "at", "origin": "RAAP_APPROVED", "requestId"}` — the game
  reads `weaponId` / `hilt` only, so the village and Forge show it with no change.
- **Whose property**: the weapon pick belongs to the Rebel token (collection + token id), not to the wallet or to an
  appearance. It stays with the NFT when it is sold (existing rule). #909 wearing sample 262's appearance does not touch
  #262's pick: the key is #909's own.
- Human play is unchanged: the Forge's weapon buttons (`POST /api/forge-weapon {action: 'choose'}`, holder or delegate)
  still write the pick directly. They do not count in the version (see §6), and RAAP sees every such change.

## 6. State, version, configuration

- `stateCommitment = H("universe.raap.state.v1", {playerId, records:[{key, rawSha256}], configurationCommitment})`,
  records sorted by key, `rawSha256` = SHA-256 of the exact stored bytes or `null`. Records: the Rebel's weapon pick and
  `forge:weapon:v1:<id>` for the six weapons (approval = eligibility). `H` = the contract's domain-separated SHA-256.
- `version` = `raap:v1:dev:player:<playerHash>:version` (absent = `"0"`), +1 on every APPLIED RAAP action.
  **Human weapon changes do not increment it** (the production handler is not modified); they always change the raw
  bytes (each save writes a new `at` time), so the commitment — checked again inside the atomic save — catches them.
  RAAP must compare **both** version and commitment.
- `configurationCommitment = H("universe.raap.configuration.v1", {...})` over: handler `universe-raap-weapon/1`, every
  pinned connection field including `validUntil`, operations, actions, max lifetime 900, the retention end, the six
  weapons (id, label, trait, side), the equipped rule, the record mapping, zero charge. No secret. Any change → old
  requests `RULES_CHANGED`.
- New records (all `raap:v1:dev:*`, enforced in code): `raap:v1:dev:player:<playerHash>:version`,
  `raap:v1:dev:request:<connectionId>:<requestId>` (the receipt), both until exactly `retainUntil`;
  `raap:v1:dev:rl:universe:<caller hash>:<minute>` (rate limit, ~2 minutes, clamped to `retainUntil`; nothing counted or
  written at or past it). Nothing else new.
- Shared game records: **writes** `forge:weapon-choice:v1:battle_for_colony:909` only (EXECUTE, APPLIED);
  **reads** the six `forge:weapon:v1:<id>`, the NFT metadata cache `nft:meta:v1:battle_for_colony:909`, the chain owner.
  Never reads or writes the protected R7 appearance / writer / admission / receipt records, the Economy, or any balance.

## 7. Statuses and reasons

| HTTP | When |
|---|---|
| 200 | READ / PREPARE / RECEIPT answers; EXECUTE receipts (APPLIED, DECLINED, OUTCOME_UNKNOWN) |
| 400 | `MALFORMED`, `NOT_CANONICAL` |
| 401 / 403 | `NOT_AUTHENTICATED`; `CONNECTION_UNAVAILABLE`, `CONNECTION_CLOSED`, `NOT_AUTHORIZED`, `OPERATION_NOT_PERMITTED`, `OPERATION_NOT_ENABLED` |
| 409 | `REQUEST_ID_CONFLICT` |
| 422 | PREPARE refused: `ACTION_UNAVAILABLE` + reason (`NOT_OWNED`, `UNSUPPORTED_ACTION`, `STALE_STATE`) |
| 429 | rate limit |
| 503 | `TEMPORARILY_UNAVAILABLE` / `RECEIPT_NOT_SAVED` (no `committed` claim) |

Receipt reasons used: `NONE`, `EXPIRED`, `RULES_CHANGED`, `NOT_OWNED`, `STALE_STATE`, `UNSUPPORTED_ACTION`,
`AWAITING_CONFIRMATION`. Not used by weapons: `INSUFFICIENT_RESOURCES`, `NOT_AUTHORIZED` (refused before any receipt).

## 8. Owner / controller boundary

Universe checks: the bearer connection, the pinned mapping, the owner's signature, the live on-chain owner (owner only),
the game rules, the state. RAAP's worker must check immediately before dispatch: current controller and epoch, account
context, revocation / pause, the exact action permission. Universe cannot verify `contextCommitment`; it is only bound
by the signature.
Signature profile: the **direct key of the pinned wallet** signs — EIP-191 `personal_sign`, low-s, `v` 27/28, recovered
address = the wallet. The handler does not look at on-chain code, so an account that also carries EIP-7702 delegation
code is not refused for that: this is RAAP's `EIP7702_DIRECT_V1` profile for e0d5 (the same direct key signs; RAAP
proves the reviewed delegation code on its side). Not accepted: ERC-1271 / contract-wallet signatures, any validation
that relies on delegation code, and delegate.xyz delegates (owner only).

## 9. Normal-play facts (EVENTS) — not enabled

What exists on the server today: the Rebel Economy awards (`api/econ-award.mjs`, ledger `econ:v1:*`): chests, first game
clears, place riddles, Treasure Dig finds — once per **Economy account** (Discord or name + PIN), not per wallet.
Before EVENTS can deliver anything:
1. a server-confirmed wallet ↔ Economy account link (none exists in Universe; the facts above are not a wallet's),
2. a sharing selection / consent record RAAP can verify (the handoff leaves its format to RAAP),
3. a dedicated Ed25519 source key at Universe (not created; it is a new credential),
4. then a per-player cursor feed of `rebel.universe.fact.v1` from the ledger's claims (source record = `kind:id` in
   `econ:v1:claimed:<user>`). The ledger keeps times only in its last-40 log (`econ:v1:log:<user>`), so a durable
   per-claim time and cursor are part of that work.
Quests, collectibles, badges and game scores are kept in the player's browser (`localStorage`), so they are not facts.

## 10. R7 G3/G4 shortlist (real IDs, nothing invented)

**(a) A usable / consumable item with a real quantity and effect: none exists on the server.** The game has no
server-held item counts. Collectibles (relic fragments, moon cakes, message bottles, ...) are browser-only and are never
used up. The only server quantities are Forge allowances (paid image / 3D work) and glove re-fits (a rig job) — both
spend real provider money, so neither is a candidate. Choosing an item to move server-side is Miguel's game decision.

**(b) A World interaction with a real saved effect: opening a chest.** Handler `POST /api/econ-award {kind:'chest', id}`
(`api/econ-award.mjs` → `api/_econ-ledger.mjs`), amounts from `api/_econ-catalog.mjs` (102 chests), e.g.
`hub-chest-wood-2` (10), `hub-chest-iron-1` (25), `hub-chest-gold-1` (50), `hub-chest-silver-1` (100),
`ashi-chest-treasure-1` (500), `hub-chest-legend-1` (1000). Saved effect: `econ:v1:claimed:<economyUserId>` gets
`chest:<id>` once per account; **economy side effect: it credits that many Rebel Points** through the Economy
(`/api/internal/credit`, idempotency key `village:chest:<id>:<user>`), inside the 2,000-a-day cap (more is held for a
later day). Being at the chest is checked only in the browser today.
Smallest server changes for a RAAP version: the wallet ↔ Economy link (§9.1), a RAAP-origin claim path writing the same
ledger key with a receipt, and an explicit owner approval for the award (it is not zero-award), or a chest-free task.
Same shape: place riddles (`kind:'riddle'`, 8, 810 points in all), Treasure Dig (`kind:'find'`, 10 a find, 40 a day).
Quest steps (Book One, side quests, Moon Tales, Chumpz Cove, Saints of LA) are browser-only today.

## 11. Character saves and the R7 writer fence

Unchanged. `api/forge-active-character-save.mjs` still refuses an enrolled wallet's World-admitted save while the
writer fence differs from `RAAP_WORLD_QUALIFICATION_COMMITMENT` ("The World writer changed; refresh before selecting").
After `RAAP_WORLD_VALID_UNTIL` (tonight, Oct 20 00:00 UTC = 8 p.m. Eastern) `worldConfiguration()` returns null: a save
by the e0d5 wallet then goes through as an ordinary human save (pointers only, no World admission; the fence and the
admissions are left as they are). Such a save **replaces the protected #909 / selected pointers** — the existing human
route, but avoid it while RAAP still needs the sample-262 baseline. `/api/raap-world` answers 400 after that time (its
connection expires). This change does not read, write or advance the fence.

## 12. Protected records

This change has no code path to the six fixed keys or the `raap:r7:world-selection:v1:<scope>:*` receipts (the record
list in §6 is fixed in code). Verified locally: stand-in copies of all seven were byte-identical (SHA-256 + length) after
the whole bench. **A fresh baseline of the real records was not captured**: this environment has no access to the shared
Redis. RAAP's worker can capture it through the existing World transport (its allowlist covers `MGET` of the build /
character / selected / fence / admission keys and `GET` of exact receipt keys; a prefix scan is not in that allowlist).

## 13. Verification (local, Oct 19)

- RAAP's own `verify-fixtures.mjs` (ethers 6.17.0, ajv 8.20.0): PASS.
- Bench (`redis-server` 7.0 behind an Upstash-style REST shim, the repo's real handlers, viem-signed requests from public
  test keys, ajv against `schemas.json`): **77 / 77** first, **82 / 82** after the review fixes. Covers: fixture canonical bytes / commitment / message / receipt id
  / signature through this module; tamper and high-s refused; 401 / 403 / production / browser / missing config;
  whitespace, key order, duplicate keys, extra field, oversize, float refused; READ / PREPARE / receipt schemas; equip
  applied, version 0 → 1, the game's own `choice` route shows it; same request again → identical receipt, nothing
  re-applied; same id other content → 409; RECEIPT found / not found / wrong commitment; a human Forge change while a
  review is open → DECLINED STALE_STATE (human pick kept); a human change **inside** the race window (between the read
  and the save) → DECLINED; two approved actions on one state at once → exactly one applied; one request sent four times
  at once → one receipt, applied once; unequip → nothing equipped; expired / too long / past the deadline / other signer
  / changed after signing / other epoch / other journal / old version / old rules / Rebel sold (NOT_OWNED, READ offers
  nothing) / weapon unapproved; the trait weapon returns to its trait shoulder; a lost answer → OUTCOME_UNKNOWN, RECEIPT
  then APPLIED once, resend → same receipt; disconnected → reads refused, receipts readable; no keys outside the expected
  set; protected stand-ins byte-identical. After the fixes: every receipt and the version expire at the pinned
  `retainUntil` (no 90-day term), the weapon choice has no expiry, the rate limit writes only `raap:v1:dev:rl:*` (no
  `rl:raap-universe:*`), a v1 connection and `retainUntil < validUntil` are refused. After RAAP's review (87 / 87):
  every `raap:v1:dev` record ends exactly at `retainUntil` (none later); with `retainUntil = validUntil = now + 600`
  PREPARE ends at `retainUntil − 300`, a request ending at `retainUntil − 100` is DECLINED `EXPIRED` (its receipt ends at
  `retainUntil`), a request inside the term applies with receipt and version ending at `retainUntil`.
- Not verified: anything live (Vercel env, the real key, the real owner, Upstash scripting in production use — the same
  `EVAL` / `TIME` / `MSET` features run in the existing World save today), RAAP's adapter, the RAAP controller checks.

## 14. Rollback

- Off: remove (or never set) the two Preview variables, or set `"status": "DISCONNECTED"`; redeploy `dev`.
- Code: `git revert b2980e9` (the connection) — `9406992` (catalog move) can stay, it changes no behaviour.
- Data: only `raap:v1:dev:player:*:version`, `raap:v1:dev:request:<connectionId>:*` (both expire at `retainUntil`)
  and `raap:v1:dev:rl:universe:*` (minutes) are new (exact keys, no wildcard deletes needed). A weapon pick RAAP applied is undone by the owner choosing again in the Forge, or by a RAAP unequip /
  equip — never by restoring old bytes.
