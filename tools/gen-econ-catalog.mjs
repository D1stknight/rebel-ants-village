// What every Rebel-point award pays, read from the layouts -> api/_econ-catalog.mjs, so the server (api/econ-award)
// decides the amount, never the browser. Run after adding, removing or re-pricing chests, games or place riddles:
//   node tools/gen-econ-catalog.mjs
//   chests  { id: [points, village] }           village chests (rewardAmount, else the tier) + room chests (tier)
//   games   { id: [points, village] }           a game's first clear: its points x GAME_POINTS_X (as village.html pays)
//   riddles { id: [points, village] }           a place riddle solved: its points x GAME_POINTS_X
//   digs    { id: [points a find, a day, village] }   games that pay for finds inside them (the Treasure Dig chests)
import fs from 'fs';
const ROOT = new URL('..', import.meta.url).pathname;
const html = fs.readFileSync(ROOT + 'village.html', 'utf8');
const X = Number((html.match(/^const GAME_POINTS_X = (\d+);$/m) || [])[1]);
const TIER = Object.fromEntries([...html.matchAll(/^\s{2}(\w+):\s+\{ points:(\d+),/gm)].map((m) => [m[1], Number(m[2])]));
if (!X || !TIER.wood || !TIER.legend) { console.error('GAME_POINTS_X or CHEST_TIERS not found in village.html'); process.exit(1); }
const files = [['hub', 'assets/world-layout.json'], ...fs.readdirSync(ROOT + 'assets/world-layouts').filter((f) => f.endsWith('.json')).sort().map((f) => [f.slice(0, -5), 'assets/world-layouts/' + f])];
const out = { chests: {}, games: {}, riddles: {}, digs: {} }, dupes = [];
const put = (k, id, val) => { if (!id) return; if (out[k][id]) dupes.push(`${k}:${id}`); else out[k][id] = val; };
const chestPoints = (o) => (o.rewardType === 'rebel_points' && Number(o.rewardAmount) > 0 ? Number(o.rewardAmount) : TIER[o.chestTier] || TIER.wood);
for (const [v, f] of files) {
  const L = JSON.parse(fs.readFileSync(ROOT + f, 'utf8')), arr = Array.isArray(L) ? L : (L.objects || []);
  for (const o of arr) {
    if (o?.type === 'treasure_chest') put('chests', o.chestId || o.name, [chestPoints(o), v]);
    const c = o?.spotConfig, g = c?.game;
    if (g?.type) {
      const id = g.id || c.spotId;
      if (Number(g.points) > 0) put('games', id, [Number(g.points) * X, v]);
      if (g.type === 'treasure') put('digs', id, [Number(g.chestPoints ?? 10), Number(g.chestCap ?? 40), v]);
    }
    if (c?.riddle?.id && Number(c.riddle.points) > 0) put('riddles', c.riddle.id, [Number(c.riddle.points) * X, v]);
    if (o?.type === 'interior_room_configs') for (const rc of Object.values(o.configs || {})) {
      for (const ch of rc.chests || []) put('chests', ch.chestId, [TIER[ch.chestTier] || TIER.wood, v]);
      for (const h of rc.hotspots || []) if (h.game?.type && Number(h.game.points) > 0) put('games', h.game.id || h.hotspotId, [Number(h.game.points) * X, v]);
    }
  }
}
const sum = (k) => Object.values(out[k]).reduce((s, a) => s + a[0], 0);
const file = ROOT + 'api/_econ-catalog.mjs', next = `// Written by tools/gen-econ-catalog.mjs from the layouts: do not edit by hand.\nexport default ${JSON.stringify(out)};\n`;
const prev = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
if (next !== prev) fs.writeFileSync(file, next);
console.log(`chests ${Object.keys(out.chests).length} (${sum('chests')}), games ${Object.keys(out.games).length} (${sum('games')}), riddles ${Object.keys(out.riddles).length} (${sum('riddles')}), digs ${Object.keys(out.digs).length}`, next !== prev ? '(written)' : '(unchanged)');
if (dupes.length) console.log('kept the first of', dupes.join(', '));
