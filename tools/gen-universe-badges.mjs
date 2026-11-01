// node tools/gen-universe-badges.mjs: writes api/_universe-badges.mjs, the badges Universe sends to the Rebel Economy's
// Badge Wall (api/_universe-badge-send.mjs), and docs/universe-badges-economy.ts (the same list in the economy's own
// catalog format, for rebel-economy-core src/lib/badges/catalog-universe.ts). Every badge in
// assets/badges/medals/badges.json goes (run tools/gen-badge-art.mjs first), with the same ids ("universe:" + id there).
// Run it after adding or renaming badges (and give the economy the new list), or after chests or games change
// (tools/gen-econ-catalog.mjs, tools/gen-game-list.mjs and tools/gen-badge-world.mjs first).
//   BADGE_IDS     badge name (what a story's progression keeps) -> badge id
//   LEDGER_CHECKS what the server must see before a badge goes, from the badge's own rule:
//                 the village's ledger (api/_econ-ledger.mjs: chests and first clears and place riddles claimed once per
//                 account): { chests: n } | { chest: id } | { chestsAll: [ids] } | { games: [ids] } | { gamesN: n }
//                 | { gamesOf: [ids], n } | { riddles: [ids], n } | { points: n } (the one-time Rebel Points)
//                 the boards (api/game-board.mjs: the best place under the account): { board: [place, how many] }
//                 the Forge (the wallet's own forged character): { forge: collection | 'gloves' | 'trio' }
//   ECONOMY_V1    the 85 badges the economy's catalog had on Oct 29: what is sent when its catalog can't be read
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(ROOT, 'village.html'), 'utf8');
const lineJSON = (name) => { const m = html.match(new RegExp(`^const ${name} = (.*);$`, 'm')); if (!m) throw new Error(`no ${name} line in village.html`); return JSON.parse(m[1]); };
const GAME_LIST = lineJSON('GAME_LIST'), WORLD = lineJSON('BADGE_WORLD');
const ECONOMY_V1 = ['arcade-initiate', 'book1-colony-awake', 'book1-echo-witness', 'book1-faction-envoy', 'book1-storm-watcher', 'builder-world-builder', 'chest-first-coin', 'chest-hunter', 'chest-master', 'chumpz-cove-party', 'collector-relic-keeper', 'community-colony-caller', 'crest-ashigaru', 'crest-buke', 'crest-bushi', 'crest-chumpz', 'crest-cute-creepy', 'crest-hub', 'crest-kenshi', 'crest-ronin', 'crest-saints-la', 'crest-samurai', 'crest-shogun', 'crest-sohei', 'crest-warrior', 'crest-wokou', 'crest-yamabushi', 'explorer-forest-wanderer', 'explorer-pathfinder', 'explorer-realm-traveler', 'explorer-root-runner', 'explorer-sprout', 'games-all', 'games-ashigaru', 'games-buke', 'games-bushi', 'games-chumpz', 'games-cute-creepy', 'games-hub', 'games-kenshi', 'games-ronin', 'games-saints-la', 'games-samurai', 'games-shogun', 'games-sohei', 'games-warrior', 'games-wokou', 'games-yamabushi', 'legend-chest-hub', 'legend-chest-ronin', 'legend-chest-shogun', 'legend-chest-wokou', 'legend-chest-yamabushi', 'mini-ants-15', 'mini-ants-5', 'moon-tales-coven', 'moon-tales-gathering', 'ronin-unseen-hand', 'ronin-watcher', 'saints-la-party', 'samurai-initiate', 'secret-beneath-roots', 'secrets-ashigaru', 'secrets-buke', 'secrets-bushi', 'secrets-chumpz', 'secrets-count-10', 'secrets-count-100', 'secrets-count-25', 'secrets-count-50', 'secrets-count-75', 'secrets-cute-creepy', 'secrets-hub', 'secrets-kenshi', 'secrets-ronin', 'secrets-samurai', 'secrets-saints-la', 'secrets-shogun', 'secrets-sohei', 'secrets-warrior', 'secrets-wokou', 'secrets-yamabushi', 'story-dust-reader', 'story-first-warning', 'story-hub-initiate'];

const all = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/badges/medals/badges.json'), 'utf8')).badges;
const BADGE_IDS = Object.fromEntries(all.map((b) => [b.name, b.badgeId]));
if (Object.keys(BADGE_IDS).length !== all.length) throw new Error('two badges share a name');
if (new Set(all.map((b) => b.badgeId)).size !== all.length) throw new Error('two badges share an id');

const gamesOf = (v) => GAME_LIST.filter((g) => v === 'all' || g[2] === v).map((g) => g[0]).sort();
const gamesOfKinds = (kinds) => GAME_LIST.filter((g) => kinds.includes(g[3])).map((g) => g[0]).sort();
const chestTotal = Object.values(WORLD.chests).flat().length;
function check(b) {
  const t = b.rule?.type, v = b.rule?.value;
  switch (t) {
    case 'chestCount': return { chests: Number(v) };
    case 'chestTotal': return { chests: v === 'all' ? chestTotal : Number(v) };
    case 'chestId': return { chest: v };
    case 'chestSet': return { chestsAll: [...(WORLD[v] || [])] };
    case 'villageGames': case 'allGames': { const games = gamesOf(t === 'allGames' ? 'all' : v); if (!games.length) throw new Error(`${b.badgeId}: no games`); return { games }; }
    case 'gamesCleared': return { gamesN: Number(v) };
    case 'kindGames': { const ids = gamesOfKinds(v.kinds); if (!ids.length) throw new Error(`${b.badgeId}: no games of ${v.kinds}`); return { gamesOf: ids, n: v.n ?? ids.length }; }
    case 'gamesAll': return { games: [...v].sort() };
    case 'placeRiddles': { const ids = Array.isArray(v) ? v : WORLD.riddles; return { riddles: [...ids], n: Array.isArray(v) || v === 'all' ? ids.length : Number(v) }; }
    case 'points': return { points: Number(v) };
    case 'boardRank': return { board: [v.rank, v.n] };
    case 'forged': return { forge: v };
    default: return null;
  }
}
const LEDGER_CHECKS = {};
for (const b of all) { const c = check(b); if (c) LEDGER_CHECKS[b.badgeId] = c; }
const out = `// Written by tools/gen-universe-badges.mjs: do not edit by hand.
export const BADGE_IDS = ${JSON.stringify(BADGE_IDS)};
export const LEDGER_CHECKS = ${JSON.stringify(LEDGER_CHECKS)};
export const ECONOMY_V1 = ${JSON.stringify(ECONOMY_V1)};
`;
fs.writeFileSync(path.join(ROOT, 'api/_universe-badges.mjs'), out);

// the economy's catalog format (rebel-economy-core src/lib/badges/types.ts): [id, name, tier, how to earn, evidence],
// in families; tiers common | rare | epic | legendary | mythic | secret (Uncommon -> rare, a hidden badge -> secret)
const TIER = { Common: 'common', Uncommon: 'rare', Rare: 'rare', Epic: 'epic', Legendary: 'legendary', Mythic: 'mythic' };
const FAMILY = { explorer: ['explorer', 'Explorer', 'Exploring Universe: villages, rooms, swimming, weather, photos'], story: ['story', 'Story', 'Book One, the Moon Tales, Chumpz Cove and Saints of LA'],
  ronin: ['ronin', 'Ronin', 'The Ronin path'], samurai: ['samurai', 'Samurai', 'The Samurai path'], arcade: ['arcade', 'Arcade', 'The 158 games, their levels and medals'],
  rivals: ['rivals', 'Rivals & Boards', 'Beating the villagers at their own games, and the leaderboards'], riddles: ['riddles', 'Riddles', 'Riddle-givers and place riddles'],
  community: ['community', 'Community', 'Villagers and players: talk, chat, voice, groups, events, emotes'], forge: ['forge', 'Forge', 'Forged characters and who you play as'],
  dedication: ['dedication', 'Dedication', 'Days played, time, Rebel Points and seasons'], builder: ['builder', 'Builder', 'Shaping the land'],
  villages: ['villages', 'Village Crests', 'Every quest in a village, and a village mastered'], secrets: ['secrets', 'Secrets', 'Hidden things in every village'], collector: ['collector', 'Collector', 'Chests and collectibles'] };
const fams = new Map();
for (const b of all) {
  const f = FAMILY[b.category] || [b.category, b.categoryLabel || b.category, ''];
  if (!fams.has(f[0])) fams.set(f[0], { id: f[0], name: f[1], note: f[2], badges: [] });
  fams.get(f[0]).badges.push([b.badgeId, b.name, b.hidden ? 'secret' : TIER[b.rarity] || 'common', b.requirement, 'C']);
}
const ts = `// Rebel Universe's badges, written by tools/gen-universe-badges.mjs (rebel-ants-village) for the economy's
// src/lib/badges/catalog-universe.ts: tuples [id, name, tier, how to earn, evidence]. Full id = "universe:" + id.
// ${all.length} badges. Art: https://raw.githubusercontent.com/D1stknight/rebel-ants-village/main/assets/badges/medals/<id>.webp
import type { FamilyDef } from "./types";

export const UNIVERSE_FAMILIES: FamilyDef[] = [
${[...fams.values()].map((f) => `  { id: ${JSON.stringify(f.id)}, name: ${JSON.stringify(f.name)}, note: ${JSON.stringify(f.note)}, badges: [\n${f.badges.map((t) => `    ${JSON.stringify(t)},`).join('\n')}\n  ] },`).join('\n')}
];
`;
fs.mkdirSync(path.join(ROOT, 'docs'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'docs/universe-badges-economy.ts'), ts);
// the same list as JSON (for the economy's chat and RAAP): every badge, whether the economy had it on Oct 29 (new:
// false) or it came with the 300 (new: true), its tier in the economy's words and ours, how it is earned, whether
// Universe's server checks it before it goes, its medal
const V1 = new Set(ECONOMY_V1), ART = 'https://raw.githubusercontent.com/D1stknight/rebel-ants-village/dev/assets/badges/medals/';
const json = { generated: 'tools/gen-universe-badges.mjs', count: all.length, new: all.filter((b) => !V1.has(b.badgeId)).length,
  families: [...fams.values()].map((f) => ({ id: f.id, name: f.name, note: f.note })),
  badges: all.map((b) => ({ id: b.badgeId, fullId: 'universe:' + b.badgeId, name: b.name, family: (FAMILY[b.category] || [b.category])[0], tier: b.hidden ? 'secret' : TIER[b.rarity] || 'common', rarity: b.rarity,
    hidden: !!b.hidden, howToEarn: b.requirement, description: b.description, new: !V1.has(b.badgeId), serverChecked: !!LEDGER_CHECKS[b.badgeId], art: ART + b.badgeId + '.webp' })) };
fs.writeFileSync(path.join(ROOT, 'docs/universe-badges.json'), JSON.stringify(json, null, 1) + '\n');
console.log(`api/_universe-badges.mjs: ${all.length} badges, ${Object.keys(LEDGER_CHECKS).length} checked by the server; docs/universe-badges-economy.ts: ${fams.size} families; docs/universe-badges.json: ${json.new} new`);
