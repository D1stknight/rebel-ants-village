# Universe ↔ RAAP: account link, experience sharing and one chest (dev) — handback

Prepared October 19, 2026, by the Universe chat, against raap-core branch `docs/universe-raap-handoff-20261019`
(commit `ee51bae`, `docs/integrations/universe-v1/chest/` + `RAAP_ADAPTER_HANDBACK_20261019.md` +
`docs/RAAP_G3_G4_OWNER_DECISION_20261019.md`). Universe repository `D1stknight/rebel-ants-village`, branch `dev` only.
Nothing here is on `main` / production. **Nothing is switched on, no live action was performed, no real points were
paid, no shared record was written, no key or credential was created.**

**Corrected Oct 19 (later)** after RAAP's review of `291f167` (raap-core `75232c3`,
`docs/integrations/universe-v1/chest/RAAP_REVIEW_20261019.md`): a repeated EXECUTE never starts or finishes a credit
(§5), shared experiences bind the consent in force when the claim happened (§4), records end exactly at `retainUntil`
with a settlement margin inside the term, and unresolved obligations are kept and exported at the term's end (§6a).
Summary of the three corrections and their checks: §13.

## In plain words (for Miguel)

- **Built:** (1) a page (`/raap-link.html` on the dev preview) where you, signed in with your wallet *and* your Rebel
  Economy account (Discord or name + PIN), sign once to link the two for RAAP; (2) a separate yes to share new confirmed
  experiences (chest openings and the other server-confirmed awards) with your Rebel; (3) a door for RAAP to open one
  exact chest you approved with your wallet, paying that chest's normal points once.
- **Off:** every part stays off until its settings exist in Vercel (Preview only) and RAAP has a new operating approval.
  Production refuses all of it.
- **Normal play:** unchanged. No wallet signature for ordinary moves; a chest still pays once, whoever opens it (you in
  the game or RAAP with your approval); held rewards are still paid by the game on a later day.
- **Not possible yet:** proving the Rebel walked to the chest (the game checks that in the browser), and settling a lost
  payment answer automatically (§10: the Economy has no read-only lookup; nothing is ever paid twice meanwhile).
- **Your decisions still open:** the storage term (`retainUntil`), what happens to a chest credit still unresolved when
  that term ends (§6a: it is kept and listed, never deleted by itself), switching it on, and the events signing key.

## 1. Where things are

| | |
|---|---|
| Branch | `dev` |
| Commits | `e85996e` v1 review fixes (retention, rate-limit namespace, connection v2); `83a251b` ledger helpers shared with the RAAP path (awards byte-identical); `cf3222f` account link + sharing + page; `d84010c` chest action; `8da8f5a` experience feed (EVENTS); `4269fab` link status privacy; `f1cd546` this document + `docs/raap-universe-chest-v1-examples.json`. RAAP review corrections (§13): `0784553` (1), `6a8a98b` (2), `0718239` (3) + the docs commit |
| Changed files | `api/_raap-universe-chest.mjs`, `api/raap-universe-chest.mjs`, `api/_raap-universe-link.mjs`, `api/raap-universe-link.mjs`, `api/_raap-universe-events.mjs`, `api/_raap-universe-http.mjs`, `api/raap-universe-obligations.mjs` (new); `api/_raap-universe.mjs`, `api/raap-universe.mjs`, `api/_econ-ledger.mjs`, `api/_econ.mjs`, `api/econ-award.mjs`, `vercel.json` (chest route 60 s), `raap-link.html` (new), docs |
| Endpoints (dev preview, behind Vercel Authentication) | `POST /api/raap-universe-chest` (RAAP's server: bearer); `GET` / `POST /api/raap-universe-link` (the player's browser, same origin); `POST /api/raap-universe` gains `EVENTS`; `GET /api/raap-universe-obligations` (the Admin Hub session: the term-end export, §6a); page `/raap-link.html` |
| Deployed | code only; every new route answers `403` without its settings |
| Live-observed | nothing |

The weapon contract is unchanged (`economyEffect: "NONE"`); the v1 handback (`docs/raap-universe-v1.md`) carries the
two review fixes and the direct-key wording.

## 2. Switching on (Preview environment only; never Production)

One connection JSON for everything (`RAAP_UNIVERSE_DEV_CONNECTION`, format v2, template in `docs/raap-universe-v1.md`
§2) with two optional sections, plus the existing bearer `RAAP_UNIVERSE_DEV_CONNECTION_KEY`:

```json
"retainUntil": <Miguel's storage term, Unix s, >= validUntil>,
"chest": { "operations": ["READ", "PREPARE", "EXECUTE", "RECEIPT", "LINK_STATUS"], "chests": ["hub-chest-wood-2"] },
"events": { "keyId": "<the reviewed source key id>", "eventKinds": ["CHEST_OPENED"] }
```

- `chest: null` and `events: null` = the link page, the chest route and EVENTS stay off. The link page is on when either
  section exists; sharing only with `events`. Every listed chest must be in the server catalog (else the chest route is
  off). `"operations"` (the weapon route's) must also list `"EVENTS"` for the feed.
- `RAAP_UNIVERSE_DEV_SOURCE_KEY` — **only when events are approved**: `0x` + 64 hex (an Ed25519 seed, the contract's
  vector format), a secret, Preview only, entered by Miguel; RAAP admits its public key + `keyId`. Not created.
- RAAP's reserved values: `connectionId` `raap-universe-dev-909-v1`, revision `1`; `tenant` / `controllerEpoch` from a
  fresh installed-worker authority read; `validUntil` and `retainUntil` from the next approval. Chest, link and events
  share the weapon connection's id, pins and bearer.
- The page must be opened on the exact dev origin (= `audience`), else its POSTs are refused (`NOT_SAME_ORIGIN`).

## 3. The account link (browser, `/api/raap-universe-link`, page `/raap-link.html`)

| Operation | Who / what | Result |
|---|---|---|
| `GET` | anyone; details only for the connection's wallet session or the linked account | pins, server time, the two signed-in accounts (wallet; Economy name + kind), link status, sharing status, revocations ready to sign |
| `PREPARE_LINK {target}` | wallet session = the pinned wallet **and** an Economy session; live owner = that wallet (owner only, no delegates) | the exact `EconomyLink` + `consentMessage` text: fresh random `linkId`, next `revision`, `accountCommitment = H("universe.raap.economy-account.v1", {environment, connectionId, linkId, economyUserId})`, approve within 5 min, link at most 24 h and never past `validUntil`; a one-use challenge (6 min) keeps the private user id server-side |
| `SAVE_LINK {authorization}` | both sessions **again**: the same Economy account (`ACCOUNT_CHANGED`) and wallet; the live owner; every pin; time; the owner's EIP-191 signature (low-s, `v` 27/28) over the reference message | one Lua script: challenge consumed, previous link exactly as read, link + pointer + account index saved → `LINKED` |
| `PREPARE_SHARING` / `SAVE_SHARING` | as above, and the signed-in account must be the linked one (`NOT_LINKED_ACCOUNT`) | a `SharingConsent` (kinds ⊆ the connection's `eventKinds`, `publicExperienceConsent: true`, `gameplayAuthority: false`, ≤ 24 h, ≤ the link) → `SHARING` |
| `REVOKE {authorization}` | the wallet's fresh signature (`UNLINK_UNIVERSE_ECONOMY_ACCOUNT` or `STOP_SHARING_UNIVERSE_EXPERIENCES`); the request comes ready from `GET` (server time + fresh nonce); nonce once | `REVOKED`; never reopens; works after expiry |
| `DISCONNECT {link}` | the linked Economy account itself, no wallet | ends its own link only |

Rules: a new link (another account, or the same one again) always gets a new `linkId` and a higher `revision`, so older
chest preparations and sharing selections stop matching and nothing carries over. A Rebel seen with another owner
ends its current link permanently (`OWNER_CHANGED`); a different `controllerEpoch` / `connectionRevision` makes old links
`EXPIRED`. POSTs: `Origin` = the dev origin, JSON only, `Sec-Fetch-Site` same-origin if sent, never with a bearer (RAAP's
key is not a sign-in), 30 a minute per caller. Responses never contain the Economy user id, cookies, PINs, Discord
tokens or keys.

## 4. Experience sharing (the feed)

- Recorded **at the moment of a confirmed award**, only under the consent **in force when the claim happened**: the
  exact bytes of the account's current link and sharing selection are read *before* the claim is admitted (the award
  route before `award()`; the chest action before its admit) and carried to the recorder. A fact is written only when
  that link and that selection were saved before the claim's time, cover it and its kind, are still in force now, and —
  checked atomically in the append script — the account index, the link pointer, the link record and the sharing record
  are still byte for byte the ones read (an unlink, a new link, a stopped or replaced selection in between: no fact;
  the latest selection is never used in place of the one read). Kinds: chests (`CHEST_OPENED`), first game clears
  (`FIRST_GAME_CLEAR`), place riddles (`PLACE_RIDDLE_SOLVED`), Treasure Dig finds (`TREASURE_DIG_FIND`); ordinary play =
  `OWNER_PLAYED`, a RAAP-approved chest = `RAAP_APPROVED` + its request id. Original time; nothing earlier is back-filled;
  a held reward's later payment is not a new fact; no signature per move, the award and its answer unchanged.
- `sourceRecordId = H("universe.raap.source-record.v1", {economyUserId, kind: chest|game|riddle|find, id})` (a find's id
  = `<game>:<UTC day>:<n>`); `eventId = H("rebel.universe.fact-id.v1", {environment, playerId, kind, sourceRecordId})`,
  saved once (a duplicate is refused); `sourceRecordDigest = H("universe.raap.source-record-digest.v1", {sourceRecordId,
  award, id, settlement, units, economyTransactionId, occurredAt})`; `facts.rewards` = paid points only
  (`{kind: REBEL_POINTS, id: "REBEL", quantity}`; a held award has `[]`).
- `EVENTS {target, afterCursor, limit ≤ 25}` on `/api/raap-universe`: ascending after the cursor, `nextCursor` = the last
  returned (or the input), `hasMore`; each fact signed with Ed25519 over `"rebel.universe.fact.v1" NUL canonical(fact)`
  (`keyId` = the connection's). Readable after the connection closes. Off without the events section, `EVENTS` in
  `operations` and the installed source key.
- The village award route (`api/econ-award.mjs`) calls the recorder after a confirmed award only when a RAAP connection
  is set (the module is loaded lazily: production loads and reads nothing); it never changes the award or its answer.

## 5. One chest (RAAP server, `POST /api/raap-universe-chest`)

Transport and refusals as the weapon route (canonical bytes, strict schema, bearer, no `Origin`, never production),
120 a minute under `raap:v1:dev:rl:chest:*`.

| Operation | Answer | Changes |
|---|---|---|
| `LINK_STATUS {target}` | `universe.raap.link-status.v1`: `target`, `connectionRevision`, `controllerEpoch`, `status` (`LINKED` / `NOT_LINKED` / `EXPIRED` / `REVOKED`), `link` (or null), `validUntil` (or null), `sharing` (`status`, `selectionId`, `eventKinds`, `validUntil`, or null), `observedAt` | none |
| `READ {target, link}` | `universe.raap.chest-inventory.v1`: the allowlisted chests, `rewardUnits` from the catalog, `available` / `refusal` (`NONE`, `ALREADY_CLAIMED`, `NOT_OWNED`) | none |
| `PREPARE {target, link, action}` | `universe.raap.chest-preparation.v1`: state, configuration commitment, zero charge, `economyEffect` (catalog units, beneficiary = the link's account commitment, `idempotencyCommitment = H("universe.raap.chest-credit.v1", {idempotencyKey: "village:chest:<id>:<user>"})`, `EXISTING_DAILY_CAP`), `expiresAt = min(now + 900, validUntil, link end, retainUntil − 300)`; or `422 ACTION_UNAVAILABLE` + reason (`403 CONNECTION_CLOSED` once no request can end inside the term) | none |
| `EXECUTE {authorization}` | `universe.raap.chest-receipt.v1` | at most one claim + one credit or one held record |
| `RECEIPT {target, link, requestId, requestCommitment}` | `universe.raap.chest-receipt-read.v1` | none |

A `link` that is not the current one → `409 LINK_CHANGED`; a current link not `LINKED` → `403 LINK_NOT_ACTIVE`.

**EXECUTE, in order:** pins (issuer = RAAP, audience = this dev origin, connection, tenant, journal, player, controller
+ epoch, account, asset, beneficiary = the link's commitment) and the owner's low-s EIP-191 signature over the reference
`chestMessage` (`403 NOT_AUTHORIZED`, nothing saved; a weapon signature is never chest authority) → the same request id
returns its saved result (other content `409`) → saved declines: link not the current `LINKED` one (`NOT_AUTHORIZED`),
time (`EXPIRED`: lifetime ≤ 900 s, ending by `validUntil`, the link's end and `retainUntil − 300`), idempotency commitment, chest not allowed
(`UNSUPPORTED_ACTION`), configuration or amount changed (`RULES_CHANGED`), live owner (`NOT_OWNED`, and the link ends),
already claimed by anyone (`ALREADY_CLAIMED`), state (`STALE_STATE`) → the Economy settings exist (else `503`, nothing
claimed) → **one Lua script** re-checks the version, the link pointer and record bytes, the claim, the held record and
Redis time, then (nothing fallible after): claims the chest in the game's own `econ:v1:claimed:<user>` (the member
`chest:<id>` a human claim uses), bumps the version, and under the existing daily cap either holds the reward as an
ordinary owed record (`APPLIED` + `HELD`, final) or saves the intent (`ADMITTED`) → **in the same invocation only**, the
intent is marked `CREDITING` (confirmed write) **before** the one Economy credit with the existing key
`village:chest:<id>:<user>` → `APPLIED` + `PAID` with the exact `economyTransactionId` (the answer must name that user
and amount). The beneficiary and the key are the ones fixed in the intent at the admit (no link read after it).

**A saved request is only read back.** A repeated EXECUTE (any time, any link or owner state) and RECEIPT return the
saved final receipt, or `PENDING` / `OUTCOME_UNKNOWN`; they never start, finish or re-send a credit and read no owner.
An intent left `ADMITTED` (the call stopped between the admit and its credit) stays `PENDING` with its claim and evidence:
continuing it is an operator's decision (§6a), not built here. Anything unexpected after the admit answers with the
saved record or `OUTCOME_UNKNOWN`, never with a no-effect claim.

| Saved state | RAAP reads | Meaning |
|---|---|---|
| final receipt `APPLIED` + `PAID` | as saved | claimed and credited once; the transaction id kept; `recordCommitment = H("universe.raap.chest-record.v1", {settlement: "PAID", economyTransactionId, idempotencyCommitment, units})` |
| final receipt `APPLIED` + `HELD` | as saved | claimed; the ordinary owed record saved (no transaction id); the game pays it on a later day, the receipt stays `HELD`; `recordCommitment` binds the owed record's SHA-256 |
| final receipt `DECLINED` | as saved | definite refusal before any effect; or the Economy refused for certain after admission (then the claim and today's count were returned, reason `NOT_AUTHORIZED`) |
| intent `ADMITTED` | `PENDING` | claimed, credit **not sent**; stays so (no automatic continuation); kept and listed (§6a) |
| intent `CREDITING` | `OUTCOME_UNKNOWN` | the credit was sent or may have been; **never sent again from here**; the claim stays (no double pay possible); kept and listed (§6a), with any Economy answer (a confirmed transaction id whose final receipt could not be saved, or a definite refusal that could not be undone) |

Never part of a chest approval: `payOwed` (other held rewards are only paid by the game), other chests, other accounts.
The location is not verified by the server (the browser checks it today), so a receipt proves an owner-approved claim
and its reward, not navigation.

## 6. Keys

**New (all `raap:v1:dev:*`; ordinary records expire exactly at `retainUntil`, never later; §6a):**
`chest-request:<connectionId>:<requestId>` (final receipt; an unresolved intent has no expiry), `obligations:<connectionId>`
(the unresolved intents' request ids, no expiry; empty = gone), `player:<playerHash>:version` (shared with the weapon),
`link:<linkId>`, `link-current:<connectionId>:<playerHash>`, `link-account:<connectionId>:<accountHash>`,
`sharing:<linkId>`, `link-nonce:<nonce>`, `link-challenge:<nonce>` (6 min), `event-id:<eventId>`,
`cursor:<connectionId>:<playerHash>`, `events:<connectionId>:<playerHash>`, `rl:{universe,chest,link}:<caller>:<window>`
(about two minutes, clamped to `retainUntil`; nothing is counted or written at or past it).

**Existing game records a live chest EXECUTE writes, exactly as a human claim does:** `econ:v1:claimed:<user>`
(`chest:<id>`), `econ:v1:day:<user>:<UTC day>` (3-day expiry as today), `econ:v1:owed:<user>` (held; never expires),
`econ:v1:log:<user>` (last 40); and the Economy's own ledger through `/api/internal/credit` (`game_reward`, source
`rebel-ants-village`). **Read only:** the catalog, the chain owner, the collection config. Not touched: Forge records,
the weapon choice (chest path), the protected R7 records, other players, the Economy core.

## 6a. Retention and the term's end

- **Ordinary records** (every key in §6 except the two below) expire **exactly** at the connection's `retainUntil`,
  never later: `EXAT retainUntil` (challenges and rate-limit windows end earlier, clamped to it). Nothing is counted or
  written at or past `retainUntil` (the link route answers `CONNECTION_CLOSED`; LINK_STATUS / RECEIPT still read).
- **Settlement margin inside the term:** a request (weapon or chest) must end at least `SETTLE_MARGIN` = 300 s before
  `retainUntil` — PREPARE caps `expiresAt` at `retainUntil − 300`, EXECUTE declines a later one (`EXPIRED`) — so the one
  invocation that admits a request finishes (the chest route runs at most 60 s) while its records can still be written.
  `retainUntil` may equal `validUntil`; a connection whose term leaves no room answers PREPARE with `CONNECTION_CLOSED`.
  A final chest write (PAID, refusal undo) checks Redis time first: at or past `retainUntil` it is not written (`LATE`)
  and the intent stays unresolved with the Economy's answer on it.
- **Unresolved obligations are not ordinary records.** A chest intent still `ADMITTED` (PENDING) or `CREDITING`
  (OUTCOME_UNKNOWN) has **no automatic expiry**, and its request id sits in `raap:v1:dev:obligations:<connectionId>`
  (no expiry) until its final receipt is written. Reaching `retainUntil` therefore never discards one: it stays readable
  through RECEIPT and in the export. Nothing finishes, retries or deletes it automatically.
- **Export (term-end path):** `GET /api/raap-universe-obligations[?connectionId=]` — dev only (production `403`), the
  Admin Hub session only (`401 ADMIN_ONLY` otherwise), read-only (no Economy call, no write; checked byte for byte). For
  each unresolved obligation: request id, `receipt` (`PENDING` / `OUTCOME_UNKNOWN`), `intent`, `credit` (`NOT_SENT` =
  ADMITTED, nothing was sent; `UNKNOWN` = it may have reached the Economy; `CONFIRMED` = paid, only the final receipt
  could not be saved: `economyAnswer.transactionId`; `REFUSED` = a definite Economy refusal whose undo could not be
  written), chest, village, units, the exact Economy `idempotencyKey` (`village:chest:<id>:<user>`) and its commitment,
  the beneficiary (`economyUserId`, `linkId`, `accountCommitment`), `acceptedAt`, `creditingAt`, the signed request and
  the owner's approval. Works with the connection variable removed (`?connectionId=`).
- **Game records are untouched by the end:** the chest claims (`econ:v1:claimed`), held rewards (`econ:v1:owed`, paid by
  the game later with the same key), today's count and the award log keep their existing rules.
- **Open decision (Miguel, with RAAP):** what to do with anything the export still lists at the term's end — keep it
  where it is, copy the export somewhere, re-send the exact credit by its key, or delete it on a date. No date,
  permanent store, hosting extension or recovery job was chosen; until then those intents simply stay.

## 7. Statuses

| HTTP | When |
|---|---|
| 200 | answers and receipts (`APPLIED`, `DECLINED`, `PENDING`, `OUTCOME_UNKNOWN`) |
| 400 | `MALFORMED`, `NOT_CANONICAL` |
| 401 | `NOT_AUTHENTICATED`; link route: `WALLET_NOT_SIGNED_IN`, `ECONOMY_NOT_SIGNED_IN` |
| 403 | `CONNECTION_UNAVAILABLE`, `CONNECTION_CLOSED`, `OPERATION_NOT_PERMITTED`, `OPERATION_NOT_ENABLED`, `NOT_AUTHORIZED`, `LINK_NOT_ACTIVE`, `NOT_OWNED`, `WRONG_WALLET`, `NOT_LINKED_ACCOUNT`, `EXPIRED`, `NOT_SAME_ORIGIN` |
| 409 | `REQUEST_ID_CONFLICT`, `LINK_CHANGED`, `CHALLENGE_NOT_FOUND`, `ACCOUNT_CHANGED`, `WALLET_CHANGED`, `CONNECTION_CHANGED`, `NONCE_USED`, `SELECTION_CHANGED` |
| 422 | `ACTION_UNAVAILABLE` + reason; `EVENT_KIND_NOT_ENABLED` |
| 429 | `RATE_LIMITED` |
| 503 | `TEMPORARILY_UNAVAILABLE` / `RECEIPT_NOT_SAVED` — no no-effect claim on EXECUTE (an admitted request answers with its saved state or `OUTCOME_UNKNOWN`); `committed: false` only where nothing can have been written (READ / PREPARE ownership unknown, the link route's ownership check) |

## 8. Points to confirm with RAAP (proposals; no agreed format was changed)

1. `LINK_STATUS` (the transport detail the handoff left to Universe): operation `{operation: "LINK_STATUS", target}` on
   the chest route, answer shape in §5.
2. Browser additions outside the `LinkOperation` union: `GET` (status + revocations ready to sign, since there is no
   `PREPARE_REVOKE`) and `DISCONNECT {link}` (the linked account's own control the handoff describes).
3. Chest, link and events use the weapon connection (one `connectionId`, pins and bearer); identity requests reverse
   issuer / audience as specified.
4. `PENDING` / `OUTCOME_UNKNOWN` as in §5 (accepted in part: no automatic completion; corrected); after admission a
   definite Economy refusal is a saved `DECLINED` (`NOT_AUTHORIZED`, before = after = the request state; the live version
   stays bumped).
5. The chest state commitment `H("universe.raap.chest-state.v1", {playerId, records, configurationCommitment})` over the
   link pointer + record and the chest's claim / held record (named by the account commitment), the configuration
   commitment `universe.raap.chest-configuration.v1` (handler `universe-raap-chest/1`, pins, chests + amounts, daily
   cap, retention, keys), and the record / source formulas in §4–5.
6. Wallet profile: the direct-key EIP-191 signature of the pinned wallet (`EIP7702_DIRECT_V1` for e0d5) is admitted;
   ERC-1271, delegation-code validation and delegates are not (`docs/raap-universe-v1.md` §8).

## 9. R7

G3 item use stays **open by Miguel's choice** (no item, potion, quest consumption or rig job was built). G4's chest path is
built and off; it counts only after a live, approved claim.

## 10. Unresolved dependencies

- **Resolving a lost credit answer.** The Economy (`rebel-economy-core` `/api/internal/*`: resolve, credit, debit,
  name-auth, user-by-wallet, bootstrap) has **no read-only transaction lookup**. Its credit is idempotent (unique per
  tenant + key: a repeated key answers with the first transaction and never pays twice), but a re-send pays if the first
  never landed — so it is a payment decision, not a read. Until an operator decides to re-send the exact same credit, or
  the Economy owner adds a read-only lookup by idempotency key (Economy scope, not requested here), `OUTCOME_UNKNOWN`
  stays unknown. Meanwhile the chest stays claimed, so it can never be paid twice. A paid credit whose receipt could not be
  saved is logged with its request id and transaction id (no secrets) for the operator.
- The events source key (not created) and its admission at RAAP.
- `retainUntil` (Miguel's storage term) and the term-end handling of unresolved obligations (§6a). Held rewards and
  claims are game records and never expire.
- A current operating approval, the connection values, the Vercel settings and RAAP's adapter for link / chest / events.
- Protected records: no code path to them (stand-ins byte-identical locally); RAAP's six permitted baseline reads of
  today stand; nothing new was read live.

## 11. Verification (local, Oct 19; before RAAP's review — the corrected results are in §13)

- RAAP bench (`redis-server` 7.0 behind an Upstash-style REST shim, the repo's real handlers, a fake Economy with the real
  idempotency rule and failure switches, sessions as signed cookies, viem signatures from public test keys, RAAP's chest
  `schemas.json` + `reference.mjs` + the parent `reference-protocol.mjs`): **205 / 205**. Link: guards (sessions, wrong
  wallet, origin, cross-site, bearer, content type, production, off), reference messages + verifier, account switch,
  wallet switch, replay, two saves at once, expiry, high-s, other signer, tampering, replacement by another account,
  sharing (not the linked account, kinds not offered, off), stop sharing + nonce once, unlink, disconnect, owner change,
  epoch change, rate limit, retention, visitors see no details. Page in Chromium (desktop + phone) with a test wallet:
  link, share, stop sharing, disconnect, no script errors, no sideways scroll. Chest: guards, LINK_STATUS, READ, PREPARE,
  paid (one credit, transaction id, claim, today, log, no payOwed), same request again, id conflict, RECEIPT, human after
  RAAP and human first, two human / RAAP races, held + paid later by the game (receipt stays HELD), lost reply / 5xx / bad
  body / no answer (OUTCOME_UNKNOWN, never re-sent, claim kept), definite refusal (claim returned), crash before the credit
  (PENDING; then finished once after 30 s — removed by correction 1, §13), four copies at once, every decline, schema + reference receipt verifier, retention,
  keys, privacy. Events: off without key / operation / section, the contract's Ed25519 vector, fact contents, no
  back-fill, kinds not shared, unlinked accounts, held → `[]` and no second fact, RAAP-approved fact, duplicates, paging,
  stop sharing, readable after close, finds, retention, nothing RAAP touched without a connection.
- Weapon bench 82 / 82; econ tests 65 / 65; the ledger old vs new on the same awards: byte-identical answers, Redis
  contents and Economy calls; RAAP's chest `verify-fixtures.mjs`: PASS.
- **Not verified:** anything live — Vercel settings, Upstash running these Lua scripts (`SET … EXAT` inside a script,
  `ZRANGEBYSCORE`), the real Economy, a real wallet showing these messages, RAAP's adapter.

## 12. Rollback

- Off: set `chest` / `events` to `null`, or `"status": "DISCONNECTED"`, or remove the variables; redeploy `dev`.
- Code: `git revert 0718239 6a8a98b 0784553` (the review corrections), then `4269fab 8da8f5a d84010c cf3222f` (events,
  chest, link); `83a251b` (ledger helpers) and `e85996e` (v1 fixes) can stay — they change no game behaviour.
- Data: the ordinary `raap:v1:dev:*` records in §6 expire at `retainUntil` (exact keys, no wildcard deletes needed).
  Unresolved chest intents and their `obligations:<connectionId>` list do not expire (§6a): they are handled only by the
  decision listed there, never by a rollback script. A live chest claim's game effects (the claim, its points or held
  record) are the game's own and are not undone by removing RAAP records.

Examples: `docs/raap-universe-chest-v1-examples.json` (local bench pairs; public test keys, `.invalid` origins, a fake
Economy, a stand-in owner of #909; no live authority).

## 13. RAAP review corrections (Oct 19, review `75232c3` of `291f167`)

Proposals 1, 2, 3, 5 and 6 accepted as documented; proposal 4 corrected as below. Still on `dev` only and **off**: no
key, no Vercel variable, no live claim, no payment, no Economy core or `main` change; game rewards and answers, other
players and the protected #909 / sample262 records unchanged.

| # | Correction | Code | Focused result (local bench) |
|---|---|---|---|
| 1 | A repeated EXECUTE never starts or finishes a credit: the 30 s replay-to-settle branch is gone; a saved request is only read back. No answer after an admit claims `committed: false`. | `0784553` | An intent left ADMITTED (its CREDITING mark failed): repeats at once, after 31 s, after the request expired, after an unlink, after an owner change → each `PENDING`, **0 credit calls, 0 owner reads**; RECEIPT `PENDING`; the claim and intent kept; a human claim is "already", nothing paid. Kept: the single invocation's success (APPLIED + PAID, one credit), lost reply → `OUTCOME_UNKNOWN` + RECEIPT `OUTCOME_UNKNOWN`, never re-sent; CREDITING mark answer lost + read back down → `OUTCOME_UNKNOWN` (200), no credit; paid but receipt not saved → `OUTCOME_UNKNOWN`, one credit; no chest answer in the run has `committed: false`. |
| 2 | Shared facts bind the consent in force when the claim happened, checked atomically at the append. | `6a8a98b` | A claim from before the link was saved, or between the link and the sharing consent, or with no consent read before it → not recorded; a link + consent saved while an earlier claim was being paid → paid as usual, not recorded; sharing stopped, or a rebind + new selection, while the claim was being paid → not recorded under either; a revoke inside the append window → not recorded (the script compares the exact records); the consent in force throughout → recorded once under that selection, again → duplicate; a RAAP chest whose sharing stopped while its credit was in flight → PAID, not recorded; every award paid and answered as before. |
| 3 | Records end exactly at `retainUntil`; requests end 300 s before it; unresolved obligations kept, listed and exported. | `0718239` | Tight connection (`retainUntil = validUntil = now + 1000`): PREPARE ends at `retainUntil − 300`; a review ending at `retainUntil − 100` → DECLINED `EXPIRED`, receipt ends at `retainUntil`; PAID / HELD receipts and the version end at `retainUntil`; every link, sharing, event, nonce, challenge and rate-limit record of the connection ends at or before it (none later); at or past it nothing is counted or written. Unresolved: ADMITTED, lost reply, paid-receipt-not-saved, paid past the term (`LATE`), refusal past the term (`LATE`) → no expiry, all five listed (and only those); the admin export shows each with its exact key, beneficiary, link, signed request + approval and transaction id (`NOT_SENT` / `UNKNOWN` / `CONFIRMED` / `REFUSED`), byte-for-byte read-only, `401` without the admin session, `403` in production. **Real boundary** (Redis expiry, `retainUntil` 5.5 min out): before the end every ordinary record of the connection (receipts, version, link, link pointer, account index, sharing, feed, cursor) has `EXPIRETIME` = `retainUntil` and the three unresolved keys none; after it every ordinary record is gone, the ADMITTED and lost-reply intents and their list remain (still no end), RECEIPT reads `PENDING` / `OUTCOME_UNKNOWN` for them and `NOT_FOUND` for the paid one, the export lists exactly those two with their keys and beneficiaries, the game's claims, held owed record and award log are byte-identical, and EXECUTE answers `CONNECTION_CLOSED` with 0 credit calls and nothing written. |

**Open (not decided here):** Miguel's storage term and operating dates, and what happens to anything the export still
lists at the term's end (§6a). The missing read-only Economy settlement lookup stays a dependency, not permission to
re-credit. Retirement is **not** claimed complete while any obligation is listed.

Bench totals on `0718239`: RAAP chest / link / events / retention **260 / 260**, real boundary **10 / 10**, weapon
**87 / 87**, econ **65 / 65**.
