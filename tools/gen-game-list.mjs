// Every mini-game in the village layouts (quest spots and room hotspots with a game) -> the GAME_LIST line in
// village.html, which the journal's Games tab lists. Run after adding or removing a game: node tools/gen-game-list.mjs
import fs from 'fs';
const ROOT = new URL('..', import.meta.url).pathname;
const files = [['hub', 'assets/world-layout.json'], ...fs.readdirSync(ROOT + 'assets/world-layouts').filter(f => f.endsWith('.json')).sort().map(f => [f.slice(0, -5), 'assets/world-layouts/' + f])];
const out = [], seen = new Set();
const add = (id, title, v) => { if (!id || seen.has(id)) return; seen.add(id); out.push([String(id), String(title), v]); };
for (const [v, f] of files) {
  const L = JSON.parse(fs.readFileSync(ROOT + f, 'utf8')), arr = Array.isArray(L) ? L : (L.objects || []);
  for (const o of arr) { const c = o?.spotConfig, g = c?.game; if (g?.type) add(g.id || c.spotId, g.title || g.type, v); }
  for (const o of arr) if (o?.type === 'interior_room_configs') for (const c of Object.values(o.configs || {})) for (const h of c.hotspots || []) if (h.game?.type) add(h.game.id || h.hotspotId, h.game.title || h.linkName || h.game.type, v);
}
const line = `const GAME_LIST = ${JSON.stringify(out)};`;
const P = ROOT + 'village.html', html = fs.readFileSync(P, 'utf8'), re = /^const GAME_LIST = .*;$/m;
if (!re.test(html)) { console.error('no GAME_LIST line in village.html'); process.exit(1); }
const next = html.replace(re, () => line);
if (next !== html) fs.writeFileSync(P, next);
console.log(out.length, 'games', next !== html ? '(village.html updated)' : '(unchanged)');
