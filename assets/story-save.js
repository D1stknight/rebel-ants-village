// The story save (Oct 25): a player's story (the quest chain, side quests and series, chests, secrets, finds, badges,
// games, riddles) kept under their Rebel Economy account as well as in the browser, so it follows them to any device.
// The same merge runs in the browser (village.html StorySync) and on the server (api/story-save.mjs): two saves of one
// story combine and nothing that was done is lost: lists join, best scores win, a side quest keeps its latest step and
// the quest chain that is further along wins (its Hub journey flags come with it).
// A save is { keys: { <localStorage key>: string | null }, t: { <key>: ms the device last saw it change } }.
export const STORY_KEYS = ['rebelAntsProgression:v1', 'rebelAntsSideQuests:v1', 'rebelAntsTutorialQuestChain:v1',
  'rebelAntsTutorialQuestChain:pendingHubReturn', 'rebelAntsTutorialQuestChain:leftHubForRonin', 'rebelAntsTutorialQuestChain:hubJourneyVisitedAway'];
const [PROG, SIDE, CHAIN] = STORY_KEYS, CHAIN_FLAGS = STORY_KEYS.slice(3);
export const STORY_MAX = 512 * 1024;   // characters in all the keys together
const LOG_MAX = 600;                   // the Rebel points log keeps its newest entries

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const arr = (v) => (Array.isArray(v) ? v : []);
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const parse = (s) => { if (typeof s !== 'string' || !s) return null; try { return JSON.parse(s); } catch (e) { return null; } };
const union = (x, y) => [...new Set([...arr(x), ...arr(y)])];
// the same content in any key order (deciding "did the merge change anything")
export function canonical(v) {
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  if (isObj(v)) return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
  return JSON.stringify(v === undefined ? null : v);
}
function perKey(x, y, f) {
  const out = {};
  for (const k of new Set([...Object.keys(isObj(x) ? x : {}), ...Object.keys(isObj(y) ? y : {})])) {
    const a = isObj(x) ? x[k] : undefined, b = isObj(y) ? y[k] : undefined;
    out[k] = a === undefined ? b : b === undefined ? a : f(a, b, k);
  }
  return out;
}
const later = (a, b) => (String(b || '') > String(a || '') ? b : a);

function mergeGame(x, y) {
  if (!isObj(x) || !isObj(y)) return isObj(x) ? x : y;
  const low = !!(x.low || y.low), bx = num(x.best), by = num(y.best), has = (k) => k in x || k in y;
  const out = { ...x, ...y, ...(num(y.at) > num(x.at) ? y : x) };   // the latest play's other fields (last, at)
  if (has('plays')) out.plays = Math.max(num(x.plays), num(y.plays));
  if (has('cleared')) out.cleared = !!(x.cleared || y.cleared);
  if (has('best')) out.best = low ? (bx && by ? Math.min(bx, by) : bx || by) : Math.max(bx, by);   // a time trial's best is its lowest time
  if (low) out.low = true;
  const cleared = [x.clearedAt, y.clearedAt].map(Number).filter((n) => n > 0);
  if (cleared.length) out.clearedAt = Math.min(...cleared); else delete out.clearedAt;
  // the badges' game facts (Oct 31): the levels solved and the songs cleared on hard join, the most levels known, the
  // best medal, the best place on the board
  for (const k of ['lv', 'hard']) if (Array.isArray(x[k]) || Array.isArray(y[k])) out[k] = union(x[k], y[k]).sort((a, b) => a - b);
  if (has('lvn')) out.lvn = Math.max(num(x.lvn), num(y.lvn));
  if (has('medal')) { const M = { bronze: 1, silver: 2, gold: 3 }; out.medal = (M[y.medal] || 0) > (M[x.medal] || 0) ? y.medal : x.medal; }
  if (has('rank')) { const r = [x.rank, y.rank].map(Number).filter((n) => n > 0); if (r.length) out.rank = Math.min(...r); else delete out.rank; }
  return out;
}
// the badge counters (ProgressionState.stats): a list joins (the rooms, villagers, days played ...), a number keeps the
// larger (each device counts its own share; the larger is the closer one)
const STAT_LIST_MAX = 1200;
function mergeStat(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) return union(a, b).slice(0, STAT_LIST_MAX);
  return Math.max(num(a), num(b));
}
function mergeRiddle(x, y) {
  if (!isObj(x) || !isObj(y)) return isObj(x) ? x : y;
  const solved = !!(x.solved || y.solved), out = { ...x, ...y };
  if ('asked' in x || 'asked' in y) out.asked = !!(x.asked || y.asked);
  if ('solved' in x || 'solved' in y) out.solved = solved;
  if ('part' in x || 'part' in y) out.part = solved ? num((x.solved ? x : y).part) : Math.max(num(x.part), num(y.part));
  if (x.def || y.def) out.def = x.def || y.def;     // a travelling riddle's text, read in another village
  if ('at' in x || 'at' in y) out.at = Math.max(num(x.at), num(y.at));
  return out;
}
const logKey = (e) => [num(e?.at), e?.chestId || '', e?.gameId || '', e?.riddleId || '', e?.findId || '', e?.villageId || '', num(e?.points)].join('|');
function mergeProgression(x, y) {
  if (!isObj(x) || !isObj(y)) return isObj(x) ? x : y;
  const out = { ...y, ...x }, has = (k) => k in x || k in y;
  for (const k of ['badges', 'completedQuests', 'villagesVisited', 'chestsOpened', 'collectiblesFound', 'secretsFound', 'spotsUsed', 'journalEntriesUnlocked']) {
    if (Array.isArray(x[k]) || Array.isArray(y[k])) out[k] = union(x[k], y[k]);
  }
  if (has('xp')) out.xp = Math.max(num(x.xp), num(y.xp));
  if (has('rebelPoints')) out.rebelPoints = Math.max(num(x.rebelPoints), num(y.rebelPoints));   // practice points (an account's are in the economy)
  if (has('rebelPointsLog')) { const log = new Map(); for (const e of [...arr(x.rebelPointsLog), ...arr(y.rebelPointsLog)]) if (isObj(e) && !log.has(logKey(e))) log.set(logKey(e), e);
    out.rebelPointsLog = [...log.values()].sort((a, b) => num(a.at) - num(b.at) || (logKey(a) < logKey(b) ? -1 : 1)).slice(-LOG_MAX); }
  const objs = { secretParts: union, ecosystemActions: (a, b) => a || b, customJournalEntries: (a) => a, games: mergeGame, riddles: mergeRiddle, gamePointsDay: (a, b) => Math.max(num(a), num(b)),
    stats: mergeStat, forged: (a, b) => a || b };
  for (const [k, f] of Object.entries(objs)) if (has(k)) out[k] = perKey(x[k], y[k], f);
  if (has('updatedAt')) out.updatedAt = later(x.updatedAt, y.updatedAt) || null;
  return out;
}
function mergeSide(x, y) {
  if (!isObj(x) || !isObj(y)) return isObj(x) ? x : y;
  const done = union(x.done, y.done), D = new Set(done), active = {};
  for (const [q, st] of Object.entries(isObj(x.active) ? x.active : {})) if (!D.has(q)) active[q] = st;
  for (const [q, st] of Object.entries(isObj(y.active) ? y.active : {})) {
    if (D.has(q)) continue;
    if (!active[q] || num(st?.touched) > num(active[q]?.touched)) active[q] = st;   // the step it was on last
  }
  return { ...y, ...x, active, done };
}
// the chain further along: more quests done (a chain at its end counts a half more); a tie goes to the newer save
const chainRank = (c) => arr(c?.completedQuestIds).length + (c?.completed ? 0.5 : 0);

// merge two saves of one story; a wins ties of equal age (the server passes the cloud first)
export function mergeStory(a, b) {
  const ka = isObj(a?.keys) ? a.keys : {}, kb = isObj(b?.keys) ? b.keys : {}, ta = isObj(a?.t) ? a.t : {}, tb = isObj(b?.t) ? b.t : {};
  const keys = {}, t = {};
  const pick = (k, v) => { keys[k] = v; const tt = Math.max(num(ta[k]), num(tb[k])); if (tt) t[k] = tt; };
  // the progression and the side quests: joined
  for (const [k, f] of [[PROG, mergeProgression], [SIDE, mergeSide]]) {
    const x = parse(ka[k]), y = parse(kb[k]);
    if (!x && !y) { if (ka[k] != null || kb[k] != null) pick(k, ka[k] ?? kb[k] ?? null); continue; }
    if (!y) { pick(k, ka[k]); continue; }
    if (!x) { pick(k, kb[k]); continue; }
    const m = f(x, y);
    pick(k, canonical(m) === canonical(x) ? ka[k] : canonical(m) === canonical(y) ? kb[k] : JSON.stringify(m));
  }
  // the quest chain: the one further along, with its Hub journey flags; the quests done on either side stay done
  const cx = parse(ka[CHAIN]), cy = parse(kb[CHAIN]);
  const useB = cy && (!cx || chainRank(cy) > chainRank(cx) || (chainRank(cy) === chainRank(cx) && num(tb[CHAIN]) > num(ta[CHAIN])));
  const src = useB ? kb : ka;
  if (cx || cy) {
    const c = useB ? cy : cx, other = useB ? cx : cy;
    const done = union(c.completedQuestIds, other?.completedQuestIds);
    pick(CHAIN, done.length === arr(c.completedQuestIds).length ? src[CHAIN] : JSON.stringify({ ...c, completedQuestIds: done }));
  } else if (ka[CHAIN] != null || kb[CHAIN] != null) pick(CHAIN, ka[CHAIN] ?? kb[CHAIN]);
  for (const k of CHAIN_FLAGS) if (src[k] != null) pick(k, src[k]);
  return { keys, t };
}

// how far a save is (a line for the player: "12 quests, 40 chests")
export function storySummary(save) {
  const p = parse(save?.keys?.[PROG]) || {}, c = parse(save?.keys?.[CHAIN]) || {}, s = parse(save?.keys?.[SIDE]) || {};
  return { quests: union(arr(p.completedQuests), union(arr(c.completedQuestIds), arr(s.done))).length, chests: arr(p.chestsOpened).length,
    secrets: arr(p.secretsFound).length, badges: arr(p.badges).length };
}
export const storySize = (save) => Object.values(isObj(save?.keys) ? save.keys : {}).reduce((n, v) => n + (typeof v === 'string' ? v.length : 0), 0);
// a save from a request: only the story keys, strings or null, within STORY_MAX
export function cleanStory(raw) {
  if (!isObj(raw) || !isObj(raw.keys)) return null;
  const keys = {}, t = {};
  for (const k of STORY_KEYS) {
    const v = raw.keys[k];
    if (v === null || typeof v === 'string') keys[k] = v;
    const tt = num(isObj(raw.t) ? raw.t[k] : 0); if (tt > 0) t[k] = Math.round(tt);
  }
  const save = { keys, t };
  return storySize(save) <= STORY_MAX ? save : null;
}
// does b hold anything a doesn't (the merge of the two differs from a)?
export function storyAdds(a, b) {
  const m = mergeStory(a, b);
  return STORY_KEYS.some((k) => { const x = a?.keys?.[k] ?? null, y = m.keys[k] ?? null; if (x === y) return false;
    const px = parse(x), py = parse(y); return px && py ? canonical(px) !== canonical(py) : true; });
}
