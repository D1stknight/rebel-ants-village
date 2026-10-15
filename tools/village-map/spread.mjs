// Spread chests / collectibles over a village's walkable, reachable ground (aerial walk map from mapgen.mjs):
// farthest-point sampling so every pick is as far as possible from every other pick and from the fixed anchors
// (gate, spots, markers, doors, NPCs, kept chests), on open ground (6 m clearance), not on steep or high hills.
import fs from 'fs';
export function spread({ map, layout, count, keep = [], maxH = 30, maxR = Infinity, minAnchor = 14, clear = 2, extraAnchors = [] }) {
  const { R, STEP, n, walk, reach, h } = map;
  const at = (i, j) => (i < 0 || j < 0 || i >= n || j >= n) ? 0 : walk[j * n + i];
  const solidTypes = new Set(['dojo_5','dojo_6','dojo_7','dojo_9','shrine_2','torii','tree_1','pine_1','cherry_blossom','rock_1','fence_1','wooden_sign','toro_lantern','hangingLantern']);
  const solids = layout.filter(o => solidTypes.has(o.type) || /^(sam|ronin|wok|yam|buke|ashi|bushi|kenshi|sohei|war|shogun|cc|chz|sl)_/.test(o.type)).map(o => [o.position.x, o.position.z, /dojo|shrine/.test(o.type) ? 16 : 5]);
  const anchors = [...extraAnchors, ...keep.map(k => [k.x, k.z])];
  const cand = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i; if (!reach[k]) continue;
    const x = -R + i * STEP, z = -R + j * STEP;
    if (Math.hypot(x, z) > maxR || h[k] > maxH) continue;
    let ok = true; for (let a = -clear; a <= clear && ok; a++) for (let b = -clear; b <= clear; b++) if (!at(i + a, j + b)) { ok = false; break; }
    if (!ok) continue;
    // not steep: neighbours within 1.2 m
    if (Math.abs(h[k] - h[k + 1]) > 1.2 || Math.abs(h[k] - h[k + n]) > 1.2) continue;
    if (solids.some(([sx, sz, r]) => Math.hypot(x - sx, z - sz) < r)) continue;
    if (anchors.some(([ax, az]) => Math.hypot(x - ax, z - az) < minAnchor)) continue;
    cand.push([x, z, h[k]]);
  }
  const picks = [];
  const dist = cand.map(([x, z]) => Math.min(Infinity, ...anchors.map(([ax, az]) => Math.hypot(x - ax, z - az))));
  for (let p = 0; p < count; p++) {
    let best = -1, bd = -1;
    for (let c = 0; c < cand.length; c++) if (dist[c] > bd) { bd = dist[c]; best = c; }
    if (best < 0) break;
    const [x, z] = cand[best]; picks.push({ x, z, nearest: +bd.toFixed(1) });
    for (let c = 0; c < cand.length; c++) dist[c] = Math.min(dist[c], Math.hypot(cand[c][0] - x, cand[c][1] - z));
  }
  return { picks, candidates: cand.length };
}

// Overlay: the aerial render with dots for every item (chests by tier, collectibles, spots, markers, doors, gate).
export async function overlay(sharp, aerialPng, map, items, outPng, title) {
  const W = 1000, R = map.R, px = x => (x + R) / (2 * R) * W, pz = z => (R - z) / (2 * R) * W; // aerial camera: up = +z
  const col = { wood:'#a0622d', iron:'#9aa3ad', gold:'#f2c14e', silver:'#dfe8f5', treasure:'#e04040', legend:'#ff9d00' };
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}"><style>text{font:600 13px sans-serif;paint-order:stroke;stroke:#000;stroke-width:3px}</style>`;
  svg += `<text x="12" y="24" fill="#fff" style="font-size:18px">${title}</text>`;
  for (const it of items) {
    const x = px(it.x), y = pz(it.z);
    if (it.type === 'treasure_chest') svg += `<rect x="${x - 7}" y="${y - 7}" width="14" height="14" fill="${col[it.tier] || '#a0622d'}" stroke="#000" stroke-width="2"/><text x="${x + 9}" y="${y + 5}" fill="${col[it.tier] || '#fff'}">${it.tier}</text>`;
    else if (it.type === 'collectible') svg += `<circle cx="${x}" cy="${y}" r="6" fill="#5ecfca" stroke="#000" stroke-width="2"/>`;
    else if (it.type === 'quest_spot') svg += `<path d="M${x} ${y - 6}L${x + 6} ${y}L${x} ${y + 6}L${x - 6} ${y}Z" fill="${it.tier === 'secret' ? '#b873f2' : '#e8c56a'}" stroke="#000" stroke-width="1.5"/>`;
    else if (it.type === 'village_gate') svg += `<circle cx="${x}" cy="${y}" r="9" fill="none" stroke="#fff" stroke-width="3"/>`;
    else svg += `<circle cx="${x}" cy="${y}" r="3" fill="#fff" opacity=".7"/>`;
  }
  const lg = [['chest (by tier)', '#f2c14e', 'r'], ['collectible', '#5ecfca', 'c'], ['quest spot', '#e8c56a', 'd'], ['secret', '#b873f2', 'd'], ['gate', '#fff', 'o']];
  lg.forEach(([t, c, s], i) => { const y = 980 - (lg.length - i) * 20; svg += s === 'r' ? `<rect x="14" y="${y - 6}" width="12" height="12" fill="${c}"/>` : s === 'o' ? `<circle cx="20" cy="${y}" r="6" fill="none" stroke="${c}" stroke-width="2"/>` : s === 'd' ? `<path d="M20 ${y - 6}L26 ${y}L20 ${y + 6}L14 ${y}Z" fill="${c}"/>` : `<circle cx="20" cy="${y}" r="6" fill="${c}"/>`; svg += `<text x="34" y="${y + 5}" fill="#fff">${t}</text>`; });
  svg += '</svg>';
  await sharp(aerialPng).resize(W, W).composite([{ input: Buffer.from(svg) }]).png().toFile(outPng);
}
