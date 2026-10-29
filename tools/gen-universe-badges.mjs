// node tools/gen-universe-badges.mjs: writes api/_universe-badges.mjs, the badges Universe sends to the Rebel Economy's
// Badge Wall (api/_universe-badge-send.mjs). The economy's catalog (rebel-economy-core src/lib/badges/catalog-universe.ts)
// holds the same ones: every badge in assets/badges/medals/badges.json but the placeholders nobody can earn yet, with the
// same ids ("universe:" + id there). Run it after adding or renaming badges (and add them to the economy's catalog too),
// or after chests or games change (tools/gen-econ-catalog.mjs first).
//   BADGE_IDS     badge name (what a story's progression keeps) -> badge id
//   LEDGER_CHECKS the badges the village's own ledger must agree with before one is sent (api/_econ-ledger.mjs: a
//                 chest or a game's first clear claimed once per account): { chests: n } | { chest: id } | { games: [ids] }
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { default: CATALOG } = await import(path.join(ROOT, 'api/_econ-catalog.mjs'));
// in the game's list, but nothing awards them yet ("Future ..." in their requirement)
const PLACEHOLDERS = new Set(['story-tunnel-witness', 'story-old-roots', 'ronin-shadow-walker', 'samurai-honor-guard', 'arcade-combo-spark', 'community-signal-carrier', 'builder-root-sculptor']);

const all = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/badges/medals/badges.json'), 'utf8')).badges;
const list = all.filter((b) => !PLACEHOLDERS.has(b.badgeId));
const BADGE_IDS = Object.fromEntries(list.map((b) => [b.name, b.badgeId]));
if (Object.keys(BADGE_IDS).length !== list.length) throw new Error('two badges share a name');

const gamesOf = (v) => Object.entries(CATALOG.games).filter(([, e]) => v === 'all' || e[1] === v).map(([id]) => id).sort();
const LEDGER_CHECKS = {};
for (const b of list) {
  const id = b.badgeId;
  let m;
  if (id === 'chest-first-coin') LEDGER_CHECKS[id] = { chests: 1 };
  else if (/^chest-/.test(id) && (m = /^Open (\d+) chests$/.exec(b.requirement))) LEDGER_CHECKS[id] = { chests: Number(m[1]) };
  else if ((m = /^legend-chest-(.+)$/.exec(id))) {
    const chest = Object.keys(CATALOG.chests).filter((c) => CATALOG.chests[c][1] === m[1] && /-chest-legend-1$/.test(c));
    if (chest.length !== 1) throw new Error(`${id}: ${chest.length} legend chests in ${m[1]}`);
    LEDGER_CHECKS[id] = { chest: chest[0] };
  } else if ((m = /^games-(.+)$/.exec(id))) {
    const games = gamesOf(m[1]);
    if (!games.length) throw new Error(`${id}: no games`);
    LEDGER_CHECKS[id] = { games };
  }
}
const out = `// Written by tools/gen-universe-badges.mjs: do not edit by hand.
export const BADGE_IDS = ${JSON.stringify(BADGE_IDS)};
export const LEDGER_CHECKS = ${JSON.stringify(LEDGER_CHECKS)};
`;
fs.writeFileSync(path.join(ROOT, 'api/_universe-badges.mjs'), out);
console.log(`api/_universe-badges.mjs: ${list.length} badges (${all.length - list.length} placeholders left out), ${Object.keys(LEDGER_CHECKS).length} checked against the ledger`);
