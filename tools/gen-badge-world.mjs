// What the badges count, read from the layouts -> the BADGE_WORLD line in village.html (in the badge definitions,
// next to COLLECTIBLE_TOTAL): how many rooms and villagers there are, each village's chests, the treasure and legend
// chests, the relic fragments, ancient scrolls and root memories, the place riddles. Run it after adding or removing
// rooms, NPCs, chests, collectibles or place riddles, and after tools/gen-econ-catalog.mjs (points: every one-time
// Rebel Point award, chests + first clears + place riddles, for the Every Point badge):
//   node tools/gen-badge-world.mjs
import fs from 'fs';
import CATALOG from '../api/_econ-catalog.mjs';
const ROOT = new URL('..', import.meta.url).pathname;
const files = [['hub', 'assets/world-layout.json'], ...fs.readdirSync(ROOT + 'assets/world-layouts').filter((f) => f.endsWith('.json')).sort().map((f) => [f.slice(0, -5), 'assets/world-layouts/' + f])];
const rooms = new Set(), sealed = new Set(), npcs = new Set(), chests = {}, treasure = [], legend = [], relics = [], scrolls = [], roots = [], riddles = [];
const chest = (v, id, tier) => {
  if (!id || Object.values(chests).some((l) => l.includes(id))) return;
  (chests[v] ||= []).push(id);
  if (tier === 'treasure') treasure.push(id);
  if (tier === 'legend') legend.push(id);
};
for (const [v, f] of files) {
  const L = JSON.parse(fs.readFileSync(ROOT + f, 'utf8')), arr = Array.isArray(L) ? L : (L.objects || []);
  for (const o of arr) {
    const d = o?.interiorDefinition;
    if (o?.type === 'interior_entrance' && d) { const id = d.id || d.kit; if (id) { rooms.add(id); if (d.requiresQuestId) sealed.add(id); } }
    if (o?.type === 'npc') { const id = o.npcId || o.metadata?.npcId; if (id) npcs.add(`${v}:${id}`); }
    if (o?.type === 'treasure_chest') chest(v, o.chestId || o.name, o.chestTier);
    if (o?.type === 'collectible' && o.collectibleId) {
      const key = `${v}:${o.collectibleId}`;   // as village.html keeps it (getCollectibleStateKey)
      if (/^ancient-relic-fragment-/.test(o.collectibleId)) relics.push(key);
      if (o.collectibleType === 'ancient_scroll') scrolls.push(key);
      if (o.collectibleType === 'root_memory') roots.push(key);
    }
    if (o?.spotConfig?.riddle?.id) riddles.push(o.spotConfig.riddle.id);
    if (o?.type === 'interior_room_configs') for (const rc of Object.values(o.configs || {})) for (const ch of rc.chests || []) chest(v, ch.chestId, ch.chestTier);
  }
}
const points = ['chests', 'games', 'riddles'].reduce((n, k) => n + Object.values(CATALOG[k] || {}).reduce((m, e) => m + (Number(e[0]) || 0), 0), 0);
const world = { points, rooms: rooms.size, sealed: [...sealed].sort(), npcs: npcs.size, chests, treasure, legend, relics, scrolls, roots, riddles };
const line = `const BADGE_WORLD = ${JSON.stringify(world)};`;
const P = ROOT + 'village.html', html = fs.readFileSync(P, 'utf8'), re = /^const BADGE_WORLD = .*;$/m;
if (!re.test(html)) { console.error('no BADGE_WORLD line in village.html'); process.exit(1); }
const next = html.replace(re, () => line);
if (next !== html) fs.writeFileSync(P, next);
const nChests = Object.values(chests).reduce((n, l) => n + l.length, 0);
console.log(`one-time points ${points}, rooms ${world.rooms} (sealed ${world.sealed.length}), villagers ${world.npcs}, chests ${nChests} (treasure ${treasure.length}, legend ${legend.length}), relics ${relics.length}, scrolls ${scrolls.length}, root memories ${roots.length}, place riddles ${riddles.length}`, next !== html ? '(village.html updated)' : '(unchanged)');
