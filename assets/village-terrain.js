// Village terrain v1 (Oct 2026). The Terrain Lab's "look 3" for the real villages:
// a 513² heightmap (seeded noise + water erosion), a painted ground material (grass / dirt / rock / roads by slope,
// height and where water runs), far mountains, swaying grass and pines / rocks scattered by slope.
// Each village gets a recipe; only the hub has one so far. Loaded by village.html (hub default; ?terrain=old turns it off).
/* global BABYLON */

export const TERRAIN_RECIPES = {
  hub: {
    seed: 1337, dropSeed: 99, drops: 70000,
    hills: 0.85,            // rolling hills between the courtyard and the dojos
    flatHalf: 112,          // the courtyard square stays flat at 0
    hillStart: 112, hillFull: 190,
    wallStart: 295,         // mountain wall at the edge of the map (all placed objects sit inside 290)
    palette: {
      grassA: [0.30, 0.37, 0.16], grassB: [0.50, 0.50, 0.24], wet: [0.20, 0.30, 0.14],
      dirt: [0.46, 0.36, 0.24], rockTint: [0.92, 0.90, 0.86]
    },
    grass: { count: 90000, base: [0.16, 0.26, 0.08], tip: [0.62, 0.68, 0.30] },
    pines: { file: 'pine_1.glb', count: 300, scale: [2.2, 4.2], trunk: 0.32, settle: .35, sink: .15 },
    rocks: { file: 'rock_1.glb', count: 240, scale: [1.0, 3.2], body: 0.75, settle: .9, sink: .1 },
    // A stream that leaves the north-east mountain wall as a waterfall, drops into a plunge pool and winds down to a pond
    // outside the courtyard corner. Points are [x, z]; the route keeps 20 m clear of every placed object.
    water: {
      path: [[326, 322], [312, 309], [304.2, 301.2], [286, 282], [270, 262], [257, 250], [240, 238], [224, 216], [207, 207], [192, 188], [178, 176], [163, 160]],
      lip: 1, pool: 2, halfW: 3.4, depth: 1.1, poolR: 8, pondR: 15
    }
  },
  // Ronin: the unseen elite. A shut-in valley under tall jagged black cliffs, near-black pines, dead trees, ash-grey
  // peaks, crimson spider lilies, heavy cold mist and a dim sun. Matte black and crimson, like their armour.
  ronin: {
    seed: 7331, dropSeed: 41, drops: 80000,
    hills: .95, shape: { fbm: 24, ridge: 28, wall: 120 },
    flatHalf: 112, hillStart: 112, hillFull: 170, wallStart: 250,
    palette: {
      grassA: [0.14, 0.17, 0.14], grassB: [0.2, 0.2, 0.17], wet: [0.08, 0.1, 0.09],
      dirt: [0.24, 0.18, 0.16], rockTint: [0.33, 0.31, 0.36], highTint: [0.82, 0.82, 0.9], peak: [0.30, 0.30, 0.33]
    },
    grass: { count: 70000, base: [0.06, 0.08, 0.05], tip: [0.3, 0.3, 0.19] },
    flowers: { count: 3600, stem: [0.03, 0.06, 0.03], petal: [0.85, 0.05, 0.06] },
    pines: { file: 'pine_1.glb', count: 240, scale: [2.6, 4.8], trunk: 0.32, settle: .35, sink: .15, tint: [0.3, 0.34, 0.33] },
    deadTrees: { count: 120, scale: [1.6, 3.2], trunk: 0.3, settle: .3, sink: .05 },
    rocks: { file: 'rock_1.glb', count: 320, scale: [1.0, 3.6], body: 0.75, settle: .9, sink: .1, tint: [0.5, 0.5, 0.56] },
    // village look: thick cold mist, dimmer light, a heavy sky, dark stone courtyard
    fog: { density: .0034, day: [.34, .35, .40], night: [.03, .03, .05] },
    light: { sun: .95, hemi: .95 },
    sky: { turbidity: 14, luminance: .55, rayleigh: 1.1, mieCoefficient: .009 },
    court: { court: [.42, .4, .43], plaza: [.36, .34, .38], path: [.4, .37, .4] }
  },
  // Samurai: the disciplined core of the colony, crimson and gold. Golden-hour light, terraced green hills with stone
  // risers, bamboo groves, cherry trees and pink flower beds, pines, and tall karst stone pillars with a waterfall
  // pouring from the north-west cliffs. Cobblestone courtyard.
  samurai: {
    seed: 2468, dropSeed: 17, drops: 60000,
    hills: .9, shape: { fbm: 26, ridge: 18, wall: 80,
      spires: [{ from: 285, cell: 46, chance: .75, radius: [9, 18], height: [45, 115] },
               { from: 420, cell: 120, chance: .8, radius: [28, 55], height: [90, 260] }] },
    flatHalf: 112, hillStart: 112, hillFull: 175, wallStart: 285,
    terraces: { step: 3.2, sharp: .86, from: 118, to: 260 },
    palette: {
      grassA: [0.22, 0.32, 0.13], grassB: [0.40, 0.42, 0.19], wet: [0.15, 0.25, 0.11],
      dirt: [0.50, 0.40, 0.28], rockTint: [0.86, 0.85, 0.82], highTint: [1.0, 1.0, .9], peak: [0.74, 0.73, 0.7]
    },
    grass: { count: 85000, base: [0.12, 0.22, 0.06], tip: [0.6, 0.62, 0.28] },
    flowers: { count: 6500, stem: [0.12, 0.25, 0.08], petal: [0.98, 0.62, 0.74] },
    pines: { file: 'pine_1.glb', count: 170, scale: [2.0, 3.8], trunk: 0.32, settle: .35, sink: .15 },
    rocks: { file: 'rock_1.glb', count: 200, scale: [1.0, 3.0], body: 0.75, settle: .9, sink: .1, tint: [1.15, 1.08, .95], minSq: 245 }, // none on the terraces
    extras: [
      { file: 'bamboo.glb', count: 170, scale: [.8, 1.25], body: .35, settle: .3, sink: .1, cull: 260, maxSlope: .5,
        clump: { freq: .012, ox: 77, above: .12 } },
      { file: 'cherry_blossom.glb', count: 14, scale: [.75, 1.05], body: .9, trunkFromMesh: true, settle: .6, sink: .2, cull: 230, minSq: 125, maxSq: 230, maxSlope: .35, road: 12 }
    ],
    water: {
      path: [[-330, 318], [-316, 304], [-307.5, 295.5], [-290, 276], [-272, 252], [-252, 236], [-234, 214], [-214, 202], [-197, 184], [-180, 171], [-166, 158]],
      lip: 1, pool: 2, halfW: 3.6, depth: 1.1, poolR: 8, pondR: 15
    },
    fog: { density: .0019, day: [.84, .8, .72], night: [.05, .05, .1] },
    light: { sun: 1.05, hemi: .95, tint: [1.0, .92, .8] },
    sky: { turbidity: 7, luminance: 1, rayleigh: 2.2, mieCoefficient: .006 },
    court: { texture: 'stone', court: [1.55, 1.45, 1.3], plaza: [1.3, 1.2, 1.08], path: [1.2, 1.1, .98] },
    // The village itself is built into the ground (from Miguel's art): the great dojo on a high stone terrace at the
    // back, the library and forge on a west terrace, the guest house on an east one, ramps up from a cobbled plaza,
    // cobbled roads and lanes, grass and flower beds everywhere else (the flat cobble courtyard is not used).
    // Rects are [x0, z0, x1, z1]; ramps climb along their axis from 'from' to 'to' (metres).
    village: {
      rect: [-66, -62, 66, 92], res: .8, wall: 1.1,
      terraces: [
        { r: [-30, 38, 30, 88], h: 4.6 },  // great dojo + training yard
        { r: [-60, 26, -27, 88], h: 2.8 }, // library + forge
        { r: [26, 30, 60, 88], h: 2.2 }    // guest house
      ],
      ramps: [
        { r: [-6, 25, 6, 38], axis: 'z', from: 0, to: 4.6 },
        { r: [-45, 15, -36, 26], axis: 'z', from: 0, to: 2.8 },
        { r: [17, 33, 26, 41], axis: 'x', from: 0, to: 2.2 }
      ],
      // cobble: [x0, z0, x1, z1, halfWidth] lanes, ['c', x, z, r] circles, ['r', x0, z0, x1, z1] rects
      pave: [
        [0, -112, 0, 30, 3.6], ['c', 0, 19, 13], ['r', -7, 24, 7, 39], ['r', -28, 39.5, 28, 80],
        [-19, -36, -19, 15, 2.4], [19, -36, 19, 10, 2.4], [-3, -20, -19, -20, 2.2], [3, -20, 19, -20, 2.2],
        [-19, -31, -37, -31, 1.4], [-19, -9, -37, -9, 1.4], [-19, 5, -37, 5, 1.4], [19, -31, 37, -31, 1.4], [19, -9, 37, -9, 1.4],
        [-8, 12, -40.5, 15, 2.2], ['r', -45, 14, -36, 27], [-40.5, 26, -40.5, 70, 2.0], [-40.5, 47, -33, 47, 1.6],
        [9, 25, 17, 37, 2.0], ['r', 16, 33, 27, 41], [27, 37, 35, 45, 1.8]
      ],
      grass: 18000, flowers: 1800
    }
  },
  // Wokou: sea raiders' harbour. A bay to the south (the sea runs out to the horizon, rocky islets offshore), a
  // stone quay with piers, the village rising on terraces up a rocky pine slope: training yard, dojo on top.
  wokou: {
    seed: 5150, dropSeed: 23, drops: 60000,
    hills: .95, shape: { fbm: 28, ridge: 30, wall: 70 },
    flatHalf: 86, hillStart: 86, hillFull: 150, wallStart: 290,
    coast: { shore: -32, headland: -72, bayHalf: 56, headWidth: 70, wobble: 10, beach: .16, cliff: 1.4, depth: 26, shelf: .22, islets: true },
    sea: { y: -3, deck: 0, waves: .18, shallow: [.2, .62, .58], mid: [.03, .3, .42], deep: [.01, .09, .19], sky: [.72, .84, .93] },
    palette: {
      grassA: [0.34, 0.37, 0.19], grassB: [0.52, 0.49, 0.29], wet: [0.2, 0.28, 0.14],
      dirt: [0.64, 0.54, 0.38], sand: [0.84, 0.76, 0.57], rockTint: [1.08, 1.06, 1.03], highTint: [1.0, 1.0, .95], peak: [0.82, 0.82, 0.8]
    },
    grass: { count: 60000, base: [0.16, 0.22, 0.08], tip: [0.66, 0.62, 0.36] },
    pines: { file: 'pine_1.glb', count: 260, scale: [1.8, 3.2], trunk: 0.32, settle: .35, sink: .15 },
    rocks: { file: 'rock_1.glb', count: 420, scale: [1.2, 3.8], body: 0.75, settle: .9, sink: .1, tint: [1.12, 1.1, 1.06], minSq: 90 },
    fog: { density: .0015, day: [.8, .86, .92], night: [.04, .05, .1] },
    light: { sun: 1.08, hemi: 1.0, tint: [1.0, .97, .9] },
    sky: { turbidity: 5, luminance: 1, rayleigh: 2.4, mieCoefficient: .005 },
    court: { texture: 'stone', court: [1.55, 1.45, 1.3], plaza: [1.3, 1.2, 1.08], path: [1.2, 1.1, .98] },
    village: {
      rect: [-78, -60, 78, 106], res: .8, wall: 1.1,
      terraces: [
        { r: [-52, -30, 52, 40], h: 0, abs: true }, // stone quay along the bay
        { r: [-28, 58, 28, 104], h: 4.2, abs: true }, // dojo
        { r: [-74, 34, -25, 104], h: 2.6, abs: true }, // hall
        { r: [25, 30, 74, 92], h: 2.2, abs: true }  // trading house
      ],
      digs: [{ r: [-50, -66, 50, -29], h: -7.5, edge: .6 }], // deep water right up to the quay wall
      ramps: [
        { r: [-6, 48, 6, 58], axis: 'z', from: 0, to: 4.2 },
        { r: [-48, 24, -40, 34], axis: 'z', from: 0, to: 2.6 },
        { r: [17, 40, 25, 48], axis: 'x', from: 0, to: 2.2 }
      ],
      pave: [
        ['r', -50, -30, 50, -19], [0, -30, 0, 23, 3.4], ['c', 0, 12, 13], [0, 49, 0, 58, 3.4], ['r', -7, 47, 7, 59],
        [-21, 23, 21, 23, 1.6], [-21, 49, 21, 49, 1.6], [-21, 23, -21, 49, 1.6], [21, 23, 21, 49, 1.6],
        [-8, 5, -37, 5, 2.0], [8, 5, 39, 5, 2.0], [-30, -19, -30, 5, 1.8], [30, -19, 30, 5, 1.8],
        ['r', -26, 58.5, 26, 100], [-13, 16, -44, 20, 2.0], ['r', -49, 23, -39, 35], [-44, 34, -44, 74, 2.0], [-44, 52, -36, 52, 1.6],
        [9, 18, 17, 44, 2.0], ['r', 16, 39, 26, 49], [26, 44, 37, 53, 1.8]
      ],
      dirt: [['r', -19, 25, 19, 47]],
      grass: 14000, flowers: 0
    }
  },
  // Yamabushi: mountain mystics. The village stands on a cliff-top mesa above a deep ravine full of blue mist: a cobbled
  // lower plaza behind the gate, stone stairs up a retaining wall (burrow arches) to the dojo terrace with its training
  // yard, a rope bridge out to a rock pillar. Stone pillars rise out of the mist, waterfalls pour off the cliffs, and the
  // highest peaks of all the villages ring the valley. From Miguel's three Yamabushi images.
  yamabushi: {
    seed: 8642, dropSeed: 31, drops: 70000, roads: false,
    hills: 1.5, shape: { fbm: 30, ridge: 34, wall: 190,
      spires: [{ from: 118, cell: 64, chance: .42, radius: [12, 22], height: [40, 95] },
               { from: 380, cell: 150, chance: .5, radius: [40, 70], height: [100, 220] }] },
    flatHalf: 100, hillStart: 100, hillFull: 220, wallStart: 235,
    // the mesa: inside these shapes the ground stays up; outside it drops 52 m into the ravine (fading out by the peaks)
    mesa: { drop: 52, cliff: 7, wobble: 3, fade: [175, 265],
      pieces: [{ r: [-64, -62, 64, 88], round: 16 }, { r: [-13, -86, 13, -56], round: 6 }, { c: [100, 54, 13] }] },
    falls: { count: 6, ring: [112, 300], minDrop: 24, spacing: 65, width: [5, 9] },
    mist: { layers: [[-42, .7], [-33, .45], [-24, .22]], color: [.7, .8, .95], glow: .35 },
    palette: {
      grassA: [0.2, 0.33, 0.15], grassB: [0.36, 0.42, 0.2], wet: [0.14, 0.24, 0.13],
      dirt: [0.52, 0.43, 0.3], rockTint: [0.9, 0.94, 0.98], highTint: [0.95, 1.0, 1.02], peak: [0.9, 0.93, 0.97]
    },
    grass: { count: 70000, base: [0.1, 0.2, 0.07], tip: [0.5, 0.6, 0.3] },
    flowers: { count: 2600, stem: [0.1, 0.22, 0.08], petal: [0.62, 0.76, 1.0] },
    pines: { file: 'pine_1.glb', count: 330, scale: [2.0, 3.8], trunk: 0.32, settle: .35, sink: .15 },
    rocks: { file: 'rock_1.glb', count: 380, scale: [1.2, 3.6], body: 0.75, settle: .9, sink: .1, tint: [.82, .95, .8], minSq: 70 }, // mossy boulders
    extras: [ // pines along the rim of the mesa, off the paving
      { file: 'pine_1.glb', count: 46, scale: [1.6, 2.8], body: .32, settle: .35, sink: .15, minSq: 0, maxSq: 115, maxSlope: .3, road: 0, village: true }
    ],
    fog: { density: .0016, day: [.66, .75, .86], night: [.04, .05, .1] },
    light: { sun: 1.02, hemi: 1.0, tint: [.96, .98, 1.04] },
    sky: { turbidity: 6, luminance: 1, rayleigh: 2.6, mieCoefficient: .005 },
    court: { texture: 'stone', court: [1.45, 1.42, 1.38], plaza: [1.25, 1.22, 1.18], path: [1.15, 1.12, 1.08] },
    village: {
      rect: [-74, -92, 116, 98], res: 1, wall: 1.1,
      terraces: [
        { r: [-90, -60, 90, 110], h: 4 },     // lower plaza (gate, well, houses)
        { r: [-90, 24, 120, 110], h: 10.5 }   // dojo terrace + the bridge pillar
      ],
      ramps: [
        { r: [-5, -72, 5, -60], axis: 'z', from: 0, to: 4 },     // stairs up from the landing to the gate
        { r: [-6, 10, 6, 24], axis: 'z', from: 4, to: 10.5 }    // great stairs up to the dojo terrace
      ],
      pave: [
        ['r', -58, -58, 58, 22.5], ['r', -11, -84, 11, -60], ['r', -6, -73, 6, -59], ['r', -7, 9, 7, 25],
        ['r', -58, 25.5, 58, 84], ['r', 56, 50.5, 68, 57.5], ['c', 100, 54, 10]
      ],
      dirt: [['r', -20, 30, 20, 52]],
      grass: 7000, flowers: 700
    }
  }
};

// The courtyard village of a recipe: terrace height, cobble paving and wall test, all from the spec above.
export function makeVillageShape(V, baseAt = () => 0) {
  const [X0, Z0, X1, Z1] = V.rect, wall = V.wall;
  const rectD = (r, x, z) => { const dx = Math.max(r[0] - x, x - r[2]), dz = Math.max(r[1] - z, z - r[3]); return dx > 0 || dz > 0 ? Math.hypot(Math.max(dx, 0), Math.max(dz, 0)) : Math.max(dx, dz); };
  const inside = (x, z) => x > X0 && x < X1 && z > Z0 && z < Z1;
  // final height over a base ground b: terraces rise h above it ('abs' terraces: to height h, e.g. a quay over a
  // beach), ramps climb from the base; the base stays wherever it is already higher
  const apply = (x, z, b) => {
    if (!inside(x, z)) return b;
    let y = b;
    for (const t of V.terraces) { const d = rectD(t.r, x, z); if (d < 0) { const w = smooth(0, wall, -d); y = Math.max(y, t.abs ? b + (t.h - b) * w : b + t.h * w); } }
    for (const t of V.digs || []) { const d = rectD(t.r, x, z); if (d < 0) y = Math.min(y, b + (Math.min(b, t.h) - b) * smooth(0, t.edge ?? wall, -d)); } // dredged harbour
    for (const R of V.ramps) {
      const r = R.r, a = R.axis === 'x' ? 0 : 1, lo = r[a], hi = r[a + 2], u = a ? z : x, v = a ? x : z, vlo = r[1 - a], vhi = r[3 - a];
      if (u < lo || u > hi + wall || v < vlo - .3 || v > vhi + .3) continue;
      const t = Math.min(1, (u - lo) / (hi - lo)), side = smooth(0, .3, Math.min(v - vlo + .3, vhi + .3 - v));
      y = Math.max(y, b + (R.from + (R.to - R.from) * t) * side);
    }
    return y;
  };
  const h = (x, z) => apply(x, z, baseAt(x, z));
  const segD = (x, z, ax, az, bx, bz) => { const vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz || 1, t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / l2)); return Math.hypot(x - ax - t * vx, z - az - t * vz); };
  const pave = (x, z) => {
    let p = 0;
    for (const q of V.pave) {
      let d;
      if (q[0] === 'c') d = Math.hypot(x - q[1], z - q[2]) - q[3];
      else if (q[0] === 'r') d = rectD(q.slice(1), x, z);
      else d = segD(x, z, q[0], q[1], q[2], q[3]) - q[4];
      p = Math.max(p, 1 - smooth(-.4, .6, d));
    }
    return p;
  };
  // steep stone faces (terrace walls, ramp sides) are not walkable
  const isWall = (x, z) => { if (!inside(x, z)) return false; const e = .35, y = h(x, z); return Math.max(Math.abs(h(x + e, z) - y), Math.abs(h(x - e, z) - y), Math.abs(h(x, z + e) - y), Math.abs(h(x, z - e) - y)) / e > 1.1; };
  const dirt = (x, z) => {
    let p = 0;
    for (const q of V.dirt || []) { const d = q[0] === 'c' ? Math.hypot(x - q[1], z - q[2]) - q[3] : q[0] === 'r' ? rectD(q.slice(1), x, z) : segD(x, z, q[0], q[1], q[2], q[3]) - q[4]; p = Math.max(p, 1 - smooth(-.4, .6, d)); }
    return p;
  };
  return { rect: V.rect, inside, apply, h, pave, dirt, isWall };
}

// ── seeded noise ─────────────────────────────────────────
function makeNoise(seed) {
  const perm = new Uint8Array(512);
  let s = seed; const p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  const grad = (h, x, y) => { const g = h & 7; const u = g < 4 ? x : y, v = g < 4 ? y : x; return ((g & 1) ? -u : u) + ((g & 2) ? -2 * v : 2 * v) * .5; };
  function perlin(x, y) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255; x -= Math.floor(x); y -= Math.floor(y);
    const u = fade(x), v = fade(y), a = perm[X] + Y, b = perm[X + 1] + Y;
    return (1 - v) * ((1 - u) * grad(perm[a], x, y) + u * grad(perm[b], x - 1, y)) + v * ((1 - u) * grad(perm[a + 1], x, y - 1) + u * grad(perm[b + 1], x - 1, y - 1));
  }
  const fbm = (x, y, o = 5) => { let s = 0, a = .5, f = 1; for (let i = 0; i < o; i++) { s += a * perlin(x * f, y * f); f *= 2.03; a *= .5; } return s; };
  const ridged = (x, y, o = 5) => { let s = 0, a = .5, f = 1, w = 1; for (let i = 0; i < o; i++) { let n = 1 - Math.abs(perlin(x * f + 17, y * f - 9)); n *= n * w; w = Math.min(1, n * 2); s += a * n; f *= 2.1; a *= .5; } return s; };
  return { perlin, fbm, ridged };
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const rng = seed => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };

export const SIZE = 700, N = 513, CELL = SIZE / (N - 1), SUBDIV = 256;

export function makeBaseHeight(recipe) {
  const { fbm, ridged } = makeNoise(recipe.seed), cap = makeCoastCap(recipe);
  return (x, z) => {
    const r = Math.hypot(x, z), s = Math.max(Math.abs(x), Math.abs(z));
    const wx = x + 45 * fbm(x * .004 + 5.2, z * .004 + 1.3, 3), wz = z + 45 * fbm(x * .004 - 3.7, z * .004 + 8.1, 3);
    const sh = recipe.shape || {}, hills = ((fbm(wx * .0075, wz * .0075) * (sh.fbm ?? 30) + ridged(wx * .011, wz * .011) * (sh.ridge ?? 16)) + 5) * recipe.hills;
    const ring = smooth(recipe.hillStart, recipe.hillFull, s);
    const wall = smooth(recipe.wallStart, 352, s) * (30 + ridged(wx * .0055 + 3, wz * .0055) * (sh.wall ?? 70));
    const far = smooth(360, 1300, r) * (40 + ridged(x * .0022, z * .0022) * 260);
    let base = Math.max(0, hills) * ring + wall + far;
    if (sh.spires) for (const sp of sh.spires) base += spireHeight(sp, x, z, s, recipe.seed);
    return cap ? Math.min(base, cap(x, z)) : base;
  };
}

// Coast (recipe.coast + recipe.sea): south of a wavy shoreline the land is capped down into a sea bed. Near the shore
// the cap rises gently (beach) in the bay and steeply (cliffs) on the headlands; out at sea a few rocky islets.
export function makeCoastCap(recipe) {
  const C = recipe.coast, seaY = recipe.sea?.y ?? -3; if (!C) return null;
  const { fbm, ridged } = makeNoise(recipe.seed + 101);
  return (x, z) => {
    const ax = Math.abs(x);
    const shore = C.shore + C.headland * smooth(C.bayHalf, C.bayHalf + C.headWidth, ax) + C.wobble * fbm(x * .012 + 3, 7.7, 3);
    const d = shore - z; // > 0: out to sea
    const slope = C.beach + (C.cliff - C.beach) * smooth(C.bayHalf - 10, C.bayHalf + 30, ax) * (.6 + .8 * fbm(x * .02, z * .02 + 5, 2));
    let y = d <= 0 ? seaY + slope * -d : seaY - Math.min(C.depth, 1.2 + d * C.shelf);
    if (C.islets && d > 110) { // rocky islets standing out of the sea, well out past the harbour
      const r = ridged(x * .011 + 9, z * .011 - 4, 3), m = smooth(.74, .9, r + .2 * fbm(x * .04, z * .04, 2)) * smooth(110, 170, d);
      y = Math.max(y, y + Math.sqrt(m) * (C.depth + 5 + 9 * r));
    }
    return y;
  };
}

// Mesa (recipe.mesa): the ground stays up inside the pieces (rounded rects { r, round } and circles { c: [x, z, r] }) and
// falls away in a cliff outside them, `drop` metres down into a ravine; the drop fades out again towards the peaks.
// dist(x, z): metres outside the nearest piece (negative inside); cut(x, z): how far the ground is lowered there.
export function makeMesa(recipe) {
  const M = recipe.mesa; if (!M) return null;
  const { fbm, ridged } = makeNoise(recipe.seed + 303);
  const pieceD = (p, x, z) => {
    if (p.c) return Math.hypot(x - p.c[0], z - p.c[1]) - p.c[2];
    const rr = p.round || 0, [x0, z0, x1, z1] = p.r, dx = Math.max(x0 + rr - x, x - x1 + rr, 0), dz = Math.max(z0 + rr - z, z - z1 + rr, 0);
    const out = Math.hypot(dx, dz) - rr;
    return dx > 0 || dz > 0 ? out : Math.max(x0 - x, x - x1, z0 - z, z - z1);
  };
  const dist = (x, z) => { let d = Infinity; for (const p of M.pieces) d = Math.min(d, pieceD(p, x, z)); return d + (M.wobble || 0) * fbm(x * .035 + 7, z * .035 - 3, 3); };
  const cut = (x, z) => {
    let d = dist(x, z); if (d <= 0) return 0;
    d += smooth(0, 4, d) * 7 * fbm(x * .045 + 11, z * .045 - 2, 3); if (d <= 0) return 0; // the face bulges and recedes below the lip
    // the face: steep in places, slanting rock in others, broken by a few ledges (where pines can stand)
    const w = M.cliff * (.5 + 3.4 * Math.max(0, fbm(x * .016 + 1, z * .016 - 6, 2) + .3)), p = smooth(0, w, d), q = p * 4, ledge = (Math.floor(q) + smooth(.55, 1, q - Math.floor(q))) / 4;
    const face = (p + (ledge - p) * smooth(-.1, .3, fbm(x * .03 - 4, z * .03 + 2, 2))) * (1 - smooth(M.fade[0], M.fade[1], d));
    return face * (M.drop - 7 * ridged(x * .05, z * .05, 3) * (1 - smooth(w, w + 30, d)));
  };
  return { dist, cut };
}

// Karst stone pillars (steep sides, rounded tops), one per jittered grid cell, fading in from `from` metres out.
function spireHeight(sp, x, z, s, seed) {
  const fade = smooth(sp.from, sp.from + sp.cell, s); if (fade <= 0) return 0;
  const hsh = (a, b, k) => { let h = (a * 374761393 + b * 668265263 + (seed + k) * 2246822519) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
  const ci = Math.floor(x / sp.cell), cj = Math.floor(z / sp.cell); let best = 0;
  for (let a = ci - 1; a <= ci + 1; a++) for (let b = cj - 1; b <= cj + 1; b++) {
    if (hsh(a, b, 7) > sp.chance) continue;
    const cx = (a + .2 + .6 * hsh(a, b, 1)) * sp.cell, cz = (b + .2 + .6 * hsh(a, b, 2)) * sp.cell;
    const r = sp.radius[0] + (sp.radius[1] - sp.radius[0]) * hsh(a, b, 3), ht = sp.height[0] + (sp.height[1] - sp.height[0]) * hsh(a, b, 4);
    const ang = Math.atan2(z - cz, x - cx), wob = 1 + .18 * Math.sin(3 * ang + 6 * hsh(a, b, 5)) + .1 * Math.sin(5 * ang + 6 * hsh(a, b, 6));
    const d = Math.hypot(x - cx, z - cz) / (r * wob); if (d >= 1) continue;
    const v = ht * (1 - smooth(.62, 1, d)) * (1 - .18 * d * d);
    if (v > best) best = v;
  }
  return best * fade;
}

// Heightmap with droplet erosion; roads along the two axes follow a smoothed copy of the land; courtyard flat.
export function buildHeightmap(recipe) {
  const baseHeight = makeBaseHeight(recipe);
  const H = new Float32Array(N * N), flow = new Float32Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) H[j * N + i] = baseHeight(i * CELL - SIZE / 2, j * CELL - SIZE / 2);
  const R = 2, brush = [];
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) { const d = Math.hypot(dx, dy); if (d <= R) brush.push([dx, dy, 1 - d / (R + .5)]); }
  const bsum = brush.reduce((s, b) => s + b[2], 0); brush.forEach(b => b[2] /= bsum);
  const rnd = rng(recipe.dropSeed);
  const hAt = (x, y) => { const i = x | 0, j = y | 0, u = x - i, v = y - j, k = j * N + i; return { h: H[k] * (1 - u) * (1 - v) + H[k + 1] * u * (1 - v) + H[k + N] * (1 - u) * v + H[k + N + 1] * u * v, gx: (H[k + 1] - H[k]) * (1 - v) + (H[k + N + 1] - H[k + N]) * v, gy: (H[k + N] - H[k]) * (1 - u) + (H[k + N + 1] - H[k + 1]) * u }; };
  for (let n = 0; n < recipe.drops; n++) {
    let x = rnd() * (N - 3) + 1, y = rnd() * (N - 3) + 1, dx = 0, dy = 0, speed = 1, water = 1, sed = 0;
    for (let step = 0; step < 40; step++) {
      const i = x | 0, j = y | 0; if (i < 2 || j < 2 || i > N - 3 || j > N - 3) break;
      const u = x - i, v = y - j, s = hAt(x, y);
      dx = dx * .05 - s.gx * .95; dy = dy * .05 - s.gy * .95; const len = Math.hypot(dx, dy); if (len < 1e-6) break; dx /= len; dy /= len;
      const nx = x + dx, ny = y + dy; if (nx < 2 || ny < 2 || nx > N - 3 || ny > N - 3) break;
      const dh = hAt(nx, ny).h - s.h, cap = Math.max(-dh, .01) * speed * water * 4;
      flow[j * N + i] += water;
      if (sed > cap || dh > 0) {
        const dep = dh > 0 ? Math.min(dh, sed) : (sed - cap) * .3; sed -= dep; const k = j * N + i;
        H[k] += dep * (1 - u) * (1 - v); H[k + 1] += dep * u * (1 - v); H[k + N] += dep * (1 - u) * v; H[k + N + 1] += dep * u * v;
      } else { const er = Math.min((cap - sed) * .3, -dh); for (const [bx, by, w] of brush) { const k = (j + by) * N + i + bx; const take = Math.min(H[k], er * w); H[k] -= take; sed += take; } }
      speed = Math.sqrt(Math.max(0, speed * speed + dh * -4)); water *= .99; x = nx; y = ny;
    }
  }
  const blur = (src, rad) => {
    const tmp = new Float32Array(N * N), out = new Float32Array(N * N);
    for (let j = 0; j < N; j++) { let acc = 0, cnt = 0; for (let i = -rad; i < N + rad; i++) { if (i + rad < N) { acc += src[j * N + i + rad]; cnt++; } if (i - rad - 1 >= 0) { acc -= src[j * N + i - rad - 1]; cnt--; } if (i >= 0 && i < N) tmp[j * N + i] = acc / cnt; } }
    for (let i = 0; i < N; i++) { let acc = 0, cnt = 0; for (let j = -rad; j < N + rad; j++) { if (j + rad < N) { acc += tmp[(j + rad) * N + i]; cnt++; } if (j - rad - 1 >= 0) { acc -= tmp[(j - rad - 1) * N + i]; cnt--; } if (j >= 0 && j < N) out[j * N + i] = acc / cnt; } }
    return out;
  };
  // rice-paddy style terraces: the hills step up in flat shelves with short steep (stone-painted) risers
  if (recipe.terraces) {
    const T = recipe.terraces;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = i * CELL - SIZE / 2, z = j * CELL - SIZE / 2, sq = Math.max(Math.abs(x), Math.abs(z)), k = j * N + i;
      const w = smooth(T.from, T.from + 12, sq) * (1 - smooth(T.to - 25, T.to, sq)); if (w <= 0) continue;
      const q = H[k] / T.step, fl = Math.floor(q), tq = (fl + smooth(T.sharp, 1, q - fl)) * T.step;
      H[k] = H[k] * (1 - w) + tq * w;
    }
  }
  const soft = blur(blur(H, 9), 9);
  const path = new Uint8Array(N * N);
  const f0 = recipe.flatHalf;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = i * CELL - SIZE / 2, z = j * CELL - SIZE / 2, s = Math.max(Math.abs(x), Math.abs(z)), k = j * N + i;
    const road = recipe.roads === false ? 1e9 : Math.min(Math.abs(x), Math.abs(z));
    if (s > f0 - 8) { const w = 1 - smooth(4, 16, road); if (w > 0) H[k] = H[k] * (1 - w) + soft[k] * w; path[k] = Math.round((1 - smooth(3, 6.5, road)) * 255); }
    H[k] *= smooth(f0, f0 + 16, s);
  }
  // courtyard village: terraces raised out of the flat courtyard, cobble wherever the spec paves
  const coast = makeCoastCap(recipe);
  if (coast) for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const k = j * N + i; H[k] = Math.min(H[k], coast(i * CELL - SIZE / 2, j * CELL - SIZE / 2)); }
  const mesa = makeMesa(recipe);
  if (mesa) for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const k = j * N + i; H[k] -= mesa.cut(i * CELL - SIZE / 2, j * CELL - SIZE / 2); }
  let pave = null; const Hb = new Float32Array(H); // ground before the village is built into it
  if (recipe.village) {
    const V = makeVillageShape(recipe.village); pave = new Uint8Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = i * CELL - SIZE / 2, z = j * CELL - SIZE / 2, k = j * N + i;
      if (Math.max(Math.abs(x), Math.abs(z)) > f0 + 4) continue;
      if (V.inside(x, z)) H[k] = V.apply(x, z, H[k]);
      pave[k] = Math.round(255 * V.pave(x, z));
      const dt = V.dirt(x, z); if (dt > 0) path[k] = Math.max(path[k], Math.round(230 * dt));
    }
  }
  const water = recipe.water ? carveWater(H, recipe.water) : null;
  return { H, Hb, flow, path, pave, baseHeight, water };
}

// ── River + waterfall ─────────────────────────────────────
// The stream follows a smooth curve through the control points. Water levels: a calm upper stream at the lip, a fall
// straight down into the plunge pool, then a level that only ever goes down (never above the ground beside it) to the
// pond. The ground is cut to a river bed with soft banks; around the pool the banks are steep (a small cliff bowl).
const hBil = (H, x, z) => {
  const fx = Math.min(N - 1.001, Math.max(0, (x + SIZE / 2) / CELL)), fz = Math.min(N - 1.001, Math.max(0, (z + SIZE / 2) / CELL));
  const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, k = j * N + i;
  return H[k] * (1 - u) * (1 - v) + H[k + 1] * u * (1 - v) + H[k + N] * (1 - u) * v + H[k + N + 1] * u * v;
};
function carveWater(H, W) {
  const P = W.path, cr = (a, b, c, d, t) => .5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
  const pts = [], ctrlAt = [];
  for (let i = 0; i < P.length - 1; i++) {
    const a = P[Math.max(0, i - 1)], b = P[i], c = P[i + 1], d = P[Math.min(P.length - 1, i + 2)];
    const len = Math.hypot(c[0] - b[0], c[1] - b[1]), n = Math.max(2, Math.ceil(len));
    ctrlAt[i] = pts.length;
    for (let k = 0; k < n; k++) { const t = k / n; pts.push({ x: cr(a[0], b[0], c[0], d[0], t), z: cr(a[1], b[1], c[1], d[1], t) }); }
  }
  ctrlAt[P.length - 1] = pts.length; pts.push({ x: P[P.length - 1][0], z: P[P.length - 1][1] });
  let acc = 0; pts.forEach((p, i) => { if (i) acc += Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z); p.s = acc; });
  pts.forEach((p, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], l = Math.hypot(b.x - a.x, b.z - a.z) || 1; p.dx = (b.x - a.x) / l; p.dz = (b.z - a.z) / l; });
  const cross = p => { let m = Infinity; for (let o = -(W.halfW + 2); o <= W.halfW + 2; o += 1) m = Math.min(m, hBil(H, p.x - p.dz * o, p.z + p.dx * o)); return m; };
  const iLip = ctrlAt[W.lip], iPool = ctrlAt[W.pool], last = pts.length - 1;
  const pool = { x: pts[iPool].x, z: pts[iPool].z, r: W.poolR }, pond = { x: pts[last].x, z: pts[last].z, r: W.pondR };
  let wTop = Infinity; for (let i = 0; i <= iLip; i++) wTop = Math.min(wTop, cross(pts[i]) - 1);
  // the pool sits below all the ground its surface covers
  let wPool = Infinity; for (let a = 0; a < 6.28; a += .3) for (let r = 0; r <= W.poolR * 1.3 + 1.4; r += 1.5) wPool = Math.min(wPool, hBil(H, pool.x + Math.cos(a) * r, pool.z + Math.sin(a) * r) - .4);
  const fallLen = Math.max(3, Math.hypot(pts[iLip].x - pool.x, pts[iLip].z - pool.z) - W.poolR * 1.1);
  for (let i = 0; i <= last; i++) {
    const p = pts[i];
    if (i <= iLip) { p.w = wTop; p.kind = 'stream'; }
    else if (i < iPool && p.s - pts[iLip].s < fallLen) { p.w = wTop + (wPool - wTop) * (p.s - pts[iLip].s) / fallLen; p.kind = 'fall'; }
    else if (i < iPool) { p.w = wPool; p.kind = 'fall'; p.inPool = true; }
    else { p.w = i === iPool ? wPool : Math.min(pts[i - 1].w - .015, cross(p) - .7); p.kind = 'river'; }
  }
  pool.w = wPool; pond.w = pts[last].w;
  const wet = new Float32Array(N * N), dist = new Float32Array(N * N).fill(255);
  const cut = (k, target) => { if (target < H[k]) H[k] = target; };
  const bank = (d, w, halfW, depth, slope) => w + .25 - (depth + .25) * (1 - smooth(halfW * .4, halfW + 1.2, d)) + Math.max(0, d - (halfW + 1.2)) * slope;
  const visit = (cx, cz, R, fn) => {
    const i0 = Math.max(0, Math.floor((cx - R + SIZE / 2) / CELL)), i1 = Math.min(N - 1, Math.ceil((cx + R + SIZE / 2) / CELL));
    const j0 = Math.max(0, Math.floor((cz - R + SIZE / 2) / CELL)), j1 = Math.min(N - 1, Math.ceil((cz + R + SIZE / 2) / CELL));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const d = Math.hypot(i * CELL - SIZE / 2 - cx, j * CELL - SIZE / 2 - cz); if (d <= R) fn(j * N + i, d); }
  };
  const mark = (k, d, edge) => { if (d < dist[k]) dist[k] = d; const wv = 1 - smooth(edge, edge + 5, d); if (wv > wet[k]) wet[k] = wv; };
  const bankW = 12, lipP = pts[iLip];
  // cells behind the lip line (within 40 m of it) belong to the upper stream; nothing below may cut them
  const aboveLip = k => { const x = (k % N) * CELL - SIZE / 2 - lipP.x, z = ((k / N) | 0) * CELL - SIZE / 2 - lipP.z; return x * x + z * z < 1600 && x * lipP.dx + z * lipP.dz < .4; };
  for (const p of pts) {
    const steep = p.kind !== 'river' ? 2.2 : .6;
    visit(p.x, p.z, W.halfW + 1.2 + bankW, (k, d) => {
      if (p.kind !== 'stream' && aboveLip(k)) return; // only the upper stream shapes the ground behind the lip: a cliff
      cut(k, bank(d, p.w, W.halfW, p.inPool ? 0 : p.kind === 'fall' ? 1.8 : W.depth, steep)); mark(k, d - W.halfW, 0);
    });
  }
  // pool and pond: irregular shorelines (radius wobbles with the angle)
  const shore = (c, k, seed, amp = 1) => { const i = k % N, j = (k / N) | 0, a = Math.atan2(j * CELL - SIZE / 2 - c.z, i * CELL - SIZE / 2 - c.x); return c.r * (1 + amp * (.22 * Math.sin(3 * a + seed) + .12 * Math.sin(5 * a + seed * 2.3) + .06 * Math.sin(9 * a + seed * .7))); };
  // plunge pool: a near-vertical rock bowl
  // steep only on the fall side; open and gentle downstream so the fall can be seen
  const upX = (lipP.x - pool.x) / Math.hypot(lipP.x - pool.x, lipP.z - pool.z), upZ = (lipP.z - pool.z) / Math.hypot(lipP.x - pool.x, lipP.z - pool.z);
  visit(pool.x, pool.z, pool.r * 1.3 + 1.5 + 22, (k, d) => {
    if (aboveLip(k)) return;
    const x = (k % N) * CELL - SIZE / 2 - pool.x, z = ((k / N) | 0) * CELL - SIZE / 2 - pool.z, c = d > .01 ? (x * upX + z * upZ) / d : 1;
    const r = shore(pool, k, 1.3, .5); cut(k, bank(d, pool.w, r, W.depth + .5, .45 + 4.5 * smooth(-.1, .6, c))); mark(k, d - r, 0);
  });
  visit(pond.x, pond.z, pond.r * 1.45 + 1.5 + 16, (k, d) => { const r = shore(pond, k, 4.1); cut(k, bank(d, pond.w, r, W.depth + .6, .45)); mark(k, d - r, 0); });
  return { pts, iLip, iPool, pool, pond, halfW: W.halfW, wet, dist };
}

// Height read from a CreateGround-style vertex grid, triangle by triangle (exactly what is drawn).
export function makeGridSampler(pos, n, size) {
  const cell = size / n;
  const tri = (a, b, c, x, z) => {
    const ax = pos[a], az = pos[a + 2], bx = pos[b], bz = pos[b + 2], cx = pos[c], cz = pos[c + 2];
    const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz); if (Math.abs(d) < 1e-12) return null;
    const l1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d, l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d, l3 = 1 - l1 - l2;
    return (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) ? null : l1 * pos[a + 1] + l2 * pos[b + 1] + l3 * pos[c + 1];
  };
  return (x, z) => {
    if (Math.abs(x) > size / 2 || Math.abs(z) > size / 2) return null;
    const col = Math.min(n - 1, Math.max(0, Math.floor((x + size / 2) / cell))), row = Math.min(n - 1, Math.max(0, Math.floor((size / 2 - z) / cell)));
    const v = (c, r) => (c + r * (n + 1)) * 3;
    const t1 = tri(v(col + 1, row + 1), v(col + 1, row), v(col, row), x, z); if (t1 !== null) return t1;
    const t2 = tri(v(col, row + 1), v(col + 1, row + 1), v(col, row), x, z); return t2 !== null ? t2 : 0;
  };
}

// The hub's previous terrain (120-subdivision mesh, hash noise), so placed objects keep the same height above ground.
export function makeOldHubSampler() {
  const hash = (x, z) => { const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return n - Math.floor(n); };
  const sn = (x, z) => { const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz); return hash(ix, iz) * (1 - ux) * (1 - uz) + hash(ix + 1, iz) * ux * (1 - uz) + hash(ix, iz + 1) * (1 - ux) * uz + hash(ix + 1, iz + 1) * ux * uz; };
  const f = (x, z) => sn(x * .012, z * .012) * 4 + sn(x * .028, z * .028) * 2 + sn(x * .065, z * .065) * .8 + sn(x * .15, z * .15) * .3;
  const n = 120, pos = new Float32Array((n + 1) * (n + 1) * 3);
  for (let row = 0; row <= n; row++) for (let col = 0; col <= n; col++) {
    const x = col * 700 / n - 350, z = (n - row) * 700 / n - 350, k = (col + row * (n + 1)) * 3, d = Math.hypot(x, z);
    pos[k] = x; pos[k + 2] = z; pos[k + 1] = (f(x, z) - 3.5) * Math.max(0, Math.min(1, (d - 100) / 55));
  }
  return makeGridSampler(pos, n, 700);
}

// ── Babylon side ─────────────────────────────────────────
export function createVillageTerrain(scene, baseRecipe, opts = {}) {
  const t0 = performance.now();
  const recipe = { ...baseRecipe, grass: { ...baseRecipe.grass }, pines: { ...baseRecipe.pines }, rocks: { ...baseRecipe.rocks }, deadTrees: baseRecipe.deadTrees && { ...baseRecipe.deadTrees }, flowers: baseRecipe.flowers && { ...baseRecipe.flowers } };
  const c = opts.counts || {};
  if (Number.isFinite(c.grass)) recipe.grass.count = c.grass;
  if (Number.isFinite(c.pines)) recipe.pines.count = c.pines;
  if (Number.isFinite(c.rocks)) recipe.rocks.count = c.rocks;
  const hm = buildHeightmap(recipe);
  const H0 = hm.H, H = new Float32Array(H0), path0 = hm.path, path = new Uint8Array(path0);
  const ground = BABYLON.MeshBuilder.CreateGround('gnd', { width: SIZE, height: SIZE, subdivisions: SUBDIV, updatable: true }, scene);
  let pos = ground.getVerticesData(BABYLON.VertexBuffer.PositionKind);
  let sampler = null;
  const VS = recipe.village ? makeVillageShape(recipe.village, (x, z) => hBil(hm.Hb, x, z)) : null;
  function writeHeights() {
    pos = ground.getVerticesData(BABYLON.VertexBuffer.PositionKind, true, true) || pos;
    for (let row = 0; row <= SUBDIV; row++) for (let col = 0; col <= SUBDIV; col++) pos[(col + row * (SUBDIV + 1)) * 3 + 1] = H[(SUBDIV - row) * 2 * N + col * 2];
    // under the village's own fine ground the big mesh is pushed down out of sight
    // (kept below the lowest point of the fine ground around each vertex, so it never shows through a step or the sea bed)
    if (VS) for (let k = 0; k < pos.length; k += 3) if (VS.inside(pos[k], pos[k + 2])) {
      let lo = Infinity; for (const dx of [-2.8, 0, 2.8]) for (const dz of [-2.8, 0, 2.8]) lo = Math.min(lo, VS.h(pos[k] + dx, pos[k + 2] + dz));
      pos[k + 1] = Math.min(-2, lo - 1.5);
    }
    ground.updateVerticesData(BABYLON.VertexBuffer.PositionKind, pos);
    ground.createNormals(true);
    ground.refreshBoundingInfo();
    sampler = makeGridSampler(pos.slice(), SUBDIV, SIZE);
  }
  writeHeights();

  // mask: R = where water runs, G = roads and building yards
  let fmax = 0; for (let k = 0; k < hm.flow.length; k++) fmax = Math.max(fmax, Math.log1p(hm.flow[k]));
  const mask = new Uint8Array(N * N * 4);
  function writeMask() { for (let k = 0; k < N * N; k++) { mask[k * 4] = Math.round(255 * Math.min(1, Math.max(Math.log1p(hm.flow[k]) / (fmax * .7), hm.water ? hm.water.wet[k] : 0))); mask[k * 4 + 1] = path[k]; mask[k * 4 + 2] = hm.pave ? hm.pave[k] : 0; mask[k * 4 + 3] = 255; } }
  writeMask();
  const maskTex = new BABYLON.RawTexture(mask, N, N, BABYLON.Engine.TEXTUREFORMAT_RGBA, scene, false, false, BABYLON.Texture.BILINEAR_SAMPLINGMODE);
  maskTex.wrapU = maskTex.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE;
  const material = makeTerrainMaterial(scene, maskTex, recipe.palette, recipe.village, recipe.sea, !!recipe.mesa);
  ground.material = material;

  // horizon: the same land continues into far mountains (sunk under the main terrain inside the square)
  const far = BABYLON.MeshBuilder.CreateGround('terrainFar', { width: 3200, height: 3200, subdivisions: 160, updatable: true }, scene);
  const fp = far.getVerticesData(BABYLON.VertexBuffer.PositionKind);
  for (let i = 0; i < fp.length; i += 3) { const x = fp[i], z = fp[i + 2]; fp[i + 1] = hm.baseHeight(x, z) - ((Math.abs(x) < 352 && Math.abs(z) < 352) ? 8 : 0); }
  far.updateVerticesData(BABYLON.VertexBuffer.PositionKind, fp);
  // keep only the ring outside the village square: inside, the far mesh (20 m cells) would poke up through river cuts
  { const idx = far.getIndices(), keep = [], out = i => Math.max(Math.abs(fp[i * 3]), Math.abs(fp[i * 3 + 2])) >= 345;
    for (let t = 0; t < idx.length; t += 3) if (out(idx[t]) || out(idx[t + 1]) || out(idx[t + 2])) keep.push(idx[t], idx[t + 1], idx[t + 2]);
    far.setIndices(keep); }
  far.createNormals(true);
  far.material = material; far.isPickable = false; far.metadata = { type: 'visual_backdrop', visualOnly: true };
  far.freezeWorldMatrix();

  const waterMeshes = hm.water ? buildWater(scene, hm.water) : [];
  const seaY = recipe.sea ? (recipe.sea.y ?? -3) : null;
  const sea = recipe.sea ? buildSea(scene, recipe.sea, H0, seaY) : null;
  const mesa = makeMesa(recipe), mist = recipe.mist ? buildMist(scene, recipe.mist) : null;

  // The village's own ground: a fine grid (0.8 m) so terrace walls and ramps come out crisp. Named 'pa…' so the
  // admin placement/snap rays (which look for the courtyard and 'pa' path meshes) land on it.
  let villageGround = null;
  if (VS) {
    const [X0, Z0, X1, Z1] = VS.rect, res = recipe.village.res || 1;
    const nx = Math.round((X1 - X0) / res), nz = Math.round((Z1 - Z0) / res);
    villageGround = BABYLON.MeshBuilder.CreateGround('paVillageGround', { width: X1 - X0, height: Z1 - Z0, subdivisionsX: nx, subdivisionsY: nz, updatable: false }, scene);
    villageGround.position.set((X0 + X1) / 2, 0, (Z0 + Z1) / 2); villageGround.bakeCurrentTransformIntoVertices();
    const vp = villageGround.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    for (let k = 0; k < vp.length; k += 3) vp[k + 1] = VS.h(vp[k], vp[k + 2]);
    villageGround.setVerticesData(BABYLON.VertexBuffer.PositionKind, vp, false);
    villageGround.createNormals(true); villageGround.refreshBoundingInfo();
    villageGround.material = material; villageGround.receiveShadows = true;
    villageGround.metadata = { type: 'village_ground', villageGround: true, terrainShadow: true };
    villageGround.freezeWorldMatrix();
  }

  const T = {
    recipe, ground, far, material, maskTex, subdiv: SUBDIV, buildMs: Math.round(performance.now() - t0),
    villageGround, villageShape: VS, sea, seaY,
    // the sea is not walkable (piers and boats add their own walk surfaces)
    seaBlocks(x, z) { return seaY !== null && T.heightAt(x, z) < seaY + .35; },
    // nor is anything off the edge of a mesa (bridges add their own walk surfaces)
    mesa, mist, falls: [], mesaBlocks(x, z) { return !!mesa && mesa.dist(x, z) > .6; },
    heightAt: (x, z) => (VS && VS.inside(x, z)) ? VS.h(x, z) : sampler(x, z),
    oldHeightAt: opts.oldHeightAt || null,
    pads: [], decor: null, decorBlockers: null, water: hm.water, waterMeshes,
    // 0..1 loudness of running water heard at (x, z): the fall carries ~120 m, the stream ~35 m
    waterSoundAt(x, z) {
      let v = 0;
      for (const f of T.falls) v = Math.max(v, .8 * Math.max(0, 1 - Math.hypot(x - f.x, z - f.z) / 170) ** 1.6); // cliff waterfalls carry far
      const Wt = hm.water; if (!Wt) return v;
      const f = Wt.pts[Wt.iLip + 2] || Wt.pts[Wt.iLip];
      v = Math.max(v, Math.max(0, 1 - Math.hypot(x - f.x, z - f.z) / 120) ** 1.6);
      for (let i = 0; i < Wt.pts.length; i += 6) { const p = Wt.pts[i]; v = Math.max(v, .35 * Math.max(0, 1 - Math.hypot(x - p.x, z - p.z) / 35) ** 1.5); }
      return v;
    },
    // 0..1 loudness of the surf heard at (x, z): full at the shoreline, fading out ~170 m away (0 without a sea)
    surfSoundAt(x, z) {
      if (seaY === null) return 0;
      if (!T._shoreDist) T._shoreDist = shoreDistanceField(T.heightAt, seaY);
      const S = T._shoreDist, u = (x + SIZE / 2) / S.cell, v = (z + SIZE / 2) / S.cell;
      if (u < 0 || v < 0 || u > S.n - 1 || v > S.n - 1) return 0;
      const i = Math.min(S.n - 2, Math.floor(u)), j = Math.min(S.n - 2, Math.floor(v)), fu = u - i, fv = v - j, D = S.d, n = S.n;
      const d = (D[j * n + i] * (1 - fu) + D[j * n + i + 1] * fu) * (1 - fv) + (D[(j + 1) * n + i] * (1 - fu) + D[(j + 1) * n + i + 1] * fu) * fv;
      return Math.max(0, 1 - Math.max(0, d - 6) / 170) ** 1.2;
    },
    // metres from the water's edge (negative = in the water), 255 when far away
    waterEdgeDist(x, z) {
      if (!hm.water) return 255;
      const i = Math.round((x + SIZE / 2) / CELL), j = Math.round((z + SIZE / 2) / CELL);
      if (i < 0 || j < 0 || i >= N || j >= N) return 255;
      return hm.water.dist[j * N + i];
    },
    // Height of the flat yard a building of this footprint gets at (x, z): the average untouched ground under it.
    padHeightAt(x, z, radius) {
      if (VS && VS.inside(x, z)) return VS.h(x, z); // the village's terraces are already flat
      const rIn = radius + 2;
      let sum = 0, cnt = 0;
      const i0 = Math.max(0, Math.floor((x - rIn + SIZE / 2) / CELL)), i1 = Math.min(N - 1, Math.ceil((x + rIn + SIZE / 2) / CELL));
      const j0 = Math.max(0, Math.floor((z - rIn + SIZE / 2) / CELL)), j1 = Math.min(N - 1, Math.ceil((z + rIn + SIZE / 2) / CELL));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { if (Math.hypot(i * CELL - SIZE / 2 - x, j * CELL - SIZE / 2 - z) <= rIn * .7) { sum += H0[j * N + i]; cnt++; } }
      return cnt ? sum / cnt : null;
    },
    // Flat yards under buildings. pads: [{x, z, radius}] (radius = building footprint). Rebuilt from the untouched map
    // each time, so loading the layout again gives the same ground.
    applyPads(pads) {
      H.set(H0); path.set(path0);
      const kept = [];
      for (const p of pads) {
        const rIn = p.radius + 2, rOut = rIn + 14;
        const i0 = Math.max(0, Math.floor((p.x - rOut + SIZE / 2) / CELL)), i1 = Math.min(N - 1, Math.ceil((p.x + rOut + SIZE / 2) / CELL));
        const j0 = Math.max(0, Math.floor((p.z - rOut + SIZE / 2) / CELL)), j1 = Math.min(N - 1, Math.ceil((p.z + rOut + SIZE / 2) / CELL));
        const y = T.padHeightAt(p.x, p.z, p.radius);
        if (y === null) continue;
        if (VS && VS.inside(p.x, p.z)) { kept.push({ ...p, y, rIn, rOut }); continue; } // no yard inside the village
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
          const d = Math.hypot(i * CELL - SIZE / 2 - p.x, j * CELL - SIZE / 2 - p.z), k = j * N + i;
          const w = 1 - smooth(rIn, rOut, d); if (w > 0) H[k] = H[k] * (1 - w) + y * w;
          const yard = (1 - smooth(rIn - 1, rIn + 4, d)) * 190; if (yard > path[k]) path[k] = yard;
        }
        kept.push({ ...p, y, rIn, rOut });
      }
      T.pads = kept;
      writeHeights(); writeMask(); maskTex.update(mask);
      return kept;
    },
    // grass, pines and rocks, away from the courtyard, roads, building yards and placed objects
    async buildDecor(avoid = []) {
      if (T.decor) return T.decor;
      T.decor = await buildDecor(scene, T, avoid);
      return T.decor;
    },
    decorBlocksPoint(x, z, padding = 0) {
      if (VS && VS.isWall(x, z)) return true;
      if (T.mesaBlocks(x, z)) return true; // the cliff edge
      const g = T.decorBlockers; if (!g) return false;
      const cx = Math.floor((x + 400) / 20), cz = Math.floor((z + 400) / 20);
      for (let a = cx - 1; a <= cx + 1; a++) for (let b = cz - 1; b <= cz + 1; b++) {
        const list = g.get(a * 1000 + b); if (!list) continue;
        for (const o of list) { const dx = x - o.x, dz = z - o.z, rr = o.r + padding; if (dx * dx + dz * dz <= rr * rr) return true; }
      }
      return false;
    }
  };
  if (recipe.falls) T.falls = buildFalls(scene, T, recipe.falls);
  return T;
}

function makeTerrainMaterial(scene, maskTex, P, V, SEA, MESA) {
  const vr = V ? V.rect : [0, 0, 0, 0];
  const v3 = a => `vec3(${a.map(n => n.toFixed(3)).join(',')})`;
  const m = new BABYLON.CustomMaterial('terrainMat', scene);
  m.specularColor = new BABYLON.Color3(.03, .03, .03);
  m.AddUniform('uGrassTex', 'sampler2D', new BABYLON.Texture('assets/ground_diffuse.jpg', scene));
  m.AddUniform('uRockTex', 'sampler2D', new BABYLON.Texture('assets/stone_diffuse.jpg', scene));
  m.AddUniform('uMaskTex', 'sampler2D', maskTex);
  m.Fragment_Definitions(`
    float th2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
    float tvn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(th2(i),th2(i+vec2(1.,0.)),f.x), mix(th2(i+vec2(0.,1.)),th2(i+vec2(1.,1.)),f.x), f.y); }
    float tfbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<4;i++){ s+=a*tvn(p); p*=2.03; a*=.5; } return s; }
    vec3 terrainColor(vec3 pw, vec3 nw){
      vec2 p = pw.xz;
      float slope = 1.0 - clamp(nw.y, 0.0, 1.0);
      vec4 mask = texture2D(uMaskTex, clamp(p/700.0 + 0.5, 0.0, 1.0));
      float inside = step(abs(p.x), 350.0) * step(abs(p.y), 350.0);
      float wet = mask.r * inside, road = mask.g * inside, pave = mask.b * inside;
      float vil = step(${vr[0].toFixed(1)}, p.x) * step(p.x, ${vr[2].toFixed(1)}) * step(${vr[1].toFixed(1)}, p.y) * step(p.y, ${vr[3].toFixed(1)});
      float macro = tfbm(p*0.018), micro = tfbm(p*0.4);
      vec3 grass = mix(${v3(P.grassA)}, ${v3(P.grassB)}, smoothstep(0.3,0.75,macro));
      grass = mix(grass, ${v3(P.wet)}, wet*0.8);
      float gl = dot(texture2D(uGrassTex, p*0.33).rgb, vec3(0.333)), gl2 = dot(texture2D(uGrassTex, p*0.047).rgb, vec3(0.333));
      grass *= (0.6 + 0.8*mix(gl, gl2, 0.45)) * (0.9 + 0.2*micro);
      vec3 dirt = ${v3(P.dirt)} * (0.8 + 0.4*micro);
      vec3 bw = pow(abs(nw), vec3(4.0)); bw /= (bw.x + bw.y + bw.z);
      vec3 rock = texture2D(uRockTex, pw.zy*0.05).rgb*bw.x + texture2D(uRockTex, pw.xz*0.05).rgb*bw.y + texture2D(uRockTex, pw.xy*0.05).rgb*bw.z;
      rock *= ${v3(P.rockTint)}; rock = mix(rock, rock*vec3(0.72,0.78,0.7), wet);
      vec3 col = mix(grass, dirt, clamp(road + smoothstep(0.17,0.3,slope)*0.55*(1.0-wet), 0.0, 1.0));
      // village cobble (warm, like the courtyard stone) and finer, lighter stone on the terrace walls
      vec3 cob = texture2D(uRockTex, p*0.16).rgb;
      cob = mix(vec3(dot(cob, vec3(0.333))), cob, 0.55) * vec3(1.02,0.98,0.9) * (0.85 + 0.25*macro);
      // ramps read as stone steps: a dark riser line every 0.38 m of height
      cob *= 1.0 - 0.45 * vil * smoothstep(0.12, 0.2, slope) * (1.0 - smoothstep(0.45, 0.6, slope)) * smoothstep(0.8, 0.95, fract(pw.y / 0.38));
      col = mix(col, cob, smoothstep(0.25, 0.75, pave) * (1.0 - smoothstep(0.3, 0.5, slope)));
      vec3 wallStone = (texture2D(uRockTex, pw.zy*0.22).rgb*bw.x + texture2D(uRockTex, pw.xz*0.22).rgb*bw.y + texture2D(uRockTex, pw.xy*0.22).rgb*bw.z);
      wallStone = mix(vec3(dot(wallStone, vec3(0.333))), wallStone, 0.3) * vec3(1.0,0.99,0.95);
      ${MESA ? `// mesa cliffs: coarse granite with rain streaks running down, moss on the ledges
      vec3 granite = texture2D(uRockTex, pw.zy*0.016).rgb*bw.x + texture2D(uRockTex, pw.xz*0.016).rgb*bw.y + texture2D(uRockTex, pw.xy*0.016).rgb*bw.z;
      granite = mix(vec3(dot(granite, vec3(0.333))), granite, 0.4) * ${v3(P.rockTint)};
      granite *= 0.72 + 0.5 * tfbm(vec2((pw.x + pw.z) * 0.22, pw.y * 0.012));
      granite = mix(granite, ${v3(P.grassA)} * 0.8, smoothstep(0.45, 0.8, nw.y) * 0.7 + smoothstep(0.6, 0.9, tfbm(pw.xz*0.07 + pw.y*0.03)) * 0.35);
      rock = mix(rock, granite, smoothstep(-0.5, -4.0, pw.y));` : ''}
      rock = mix(rock, wallStone, vil${MESA ? ' * smoothstep(-4.0, -0.5, pw.y)' : ''});
      col = mix(col, rock, smoothstep(0.3, 0.46, slope + (micro-0.5)*0.14));
      col = mix(col, col*${v3(P.highTint || [1.12, 1.04, .78])}, smoothstep(30.0, 70.0, pw.y)*(1.0 - smoothstep(0.3,0.45,slope)));
      col = mix(col, ${v3(P.peak || [.9, .92, .95])}, smoothstep(150.0, 230.0, pw.y + micro*20.0)*(1.0-smoothstep(0.45,0.6,slope)));
      ${SEA ? `// shore: sand on the beach and under the water, darker and greener as it gets deeper
      float seaY = ${(SEA.y ?? -3).toFixed(2)};
      vec3 sand = ${v3(P.sand || [.78, .7, .52])} * (0.85 + 0.3*micro);
      col = mix(col, sand, smoothstep(seaY + 1.8, seaY + 0.5, pw.y + (micro-0.5)*0.8) * (1.0 - smoothstep(0.35, 0.6, slope)));
      col *= mix(vec3(1.0), vec3(0.62, 0.78, 0.8), smoothstep(seaY, seaY - 8.0, pw.y));` : ''}
      return col;
    }
  `);
  m.Fragment_Custom_Diffuse(`diffuseColor = terrainColor(vPositionW, normalize(vNormalW));`);
  return m;
}

// Instances are split into 16 map tiles (each tile one mesh) so tiles behind the camera are skipped.
function tileOf(x, z) { return Math.min(3, Math.max(0, Math.floor((x + 350) / 175))) * 4 + Math.min(3, Math.max(0, Math.floor((z + 350) / 175))); }

async function buildDecor(scene, T, avoid) {
  const R = T.recipe, rnd = rng(R.seed * 7 + 3), { fbm } = makeNoise(R.seed + 11);
  const meshes = [], blockers = new Map(), cullTiles = []; // cullTiles: map tiles switched off beyond a distance
  const addBlocker = (x, z, r) => { const key = Math.floor((x + 400) / 20) * 1000 + Math.floor((z + 400) / 20); if (!blockers.has(key)) blockers.set(key, []); blockers.get(key).push({ x, z, r }); };
  const h = T.heightAt;
  const slopeAt = (x, z) => { const y = h(x, z); return Math.hypot(h(x + 2, z) - y, h(x, z + 2) - y) / 2; };
  // avoid grid: placed objects and building yards
  const av = new Map();
  const addAvoid = (x, z, r) => { for (let a = Math.floor((x - r + 400) / 20); a <= Math.floor((x + r + 400) / 20); a++) for (let b = Math.floor((z - r + 400) / 20); b <= Math.floor((z + r + 400) / 20); b++) { const k = a * 1000 + b; if (!av.has(k)) av.set(k, []); av.get(k).push({ x, z, r }); } };
  avoid.forEach(o => addAvoid(o.x, o.z, o.r));
  T.pads.forEach(p => addAvoid(p.x, p.z, p.rIn + 4));
  const clear = (x, z, extra = 0) => { const list = av.get(Math.floor((x + 400) / 20) * 1000 + Math.floor((z + 400) / 20)); if (!list) return true; for (const o of list) { const rr = o.r + extra; if ((x - o.x) ** 2 + (z - o.z) ** 2 < rr * rr) return false; } return true; };
  const sq = (x, z) => Math.max(Math.abs(x), Math.abs(z)), roadD = R.roads === false ? () => 1e9 : (x, z) => Math.min(Math.abs(x), Math.abs(z));
  const villagePave = T.villageShape ? T.villageShape.pave : () => 1;
  const dry = (x, z, m = .8) => T.seaY === null || T.seaY === undefined || h(x, z) > T.seaY + m; // above the sea
  const m4 = new BABYLON.Matrix(), q = new BABYLON.Quaternion(), S = new BABYLON.Vector3(), P = new BABYLON.Vector3();

  function fillTiles(protoParts, buffers, counts, name) {
    for (let t = 0; t < 16; t++) {
      if (!counts[t]) continue;
      protoParts.forEach((proto, pi) => {
        // Each tile gets its OWN copy of the geometry. Babylon keeps a mesh's thin-instance matrices on its geometry,
        // so tiles sharing one geometry all drew the last tile's matrices (with their own counts, reading past the end:
        // the long stray triangles, and pines/rocks/flowers in the wrong places).
        const m = new BABYLON.Mesh(`${name}_${t}_${pi}`, scene);
        BABYLON.VertexData.ExtractFromMesh(proto).applyToMesh(m);
        m.material = proto.material; m.useVertexColors = proto.useVertexColors; m.hasVertexAlpha = proto.hasVertexAlpha;
        m.isVisible = true; m.setEnabled(true);
        m.thinInstanceSetBuffer('matrix', buffers[t].slice(0, counts[t] * 16), 16, true);
        m.thinInstanceRefreshBoundingInfo(false);
        m.isPickable = false; m.metadata = { type: 'terrain_decor', visualOnly: true };
        m.freezeWorldMatrix();
        meshes.push(m);
      });
    }
    protoParts.forEach(p => p.setEnabled(false));
  }

  // grass clump: 3 tapered blades, dark base, light tip
  {
    const G = R.grass, bp = [], bc = [], bi = [];
    for (let b = 0; b < 3; b++) {
      const a = b * 2.1 + .3, ox = Math.cos(a) * .08, oz = Math.sin(a) * .08, w = .05, hgt = .55 + b * .12, lean = .18;
      const dx = Math.cos(a + 1.57) * w, dz = Math.sin(a + 1.57) * w, base = bp.length / 3;
      bp.push(ox - dx, 0, oz - dz, ox + dx, 0, oz + dz, ox + Math.cos(a) * lean, hgt, oz + Math.sin(a) * lean);
      bc.push(...G.base, 1, ...G.base, 1, ...G.tip, 1); bi.push(base, base + 1, base + 2);
    }
    const blade = new BABYLON.Mesh('terrainGrass', scene);
    const vd = new BABYLON.VertexData(); vd.positions = bp; vd.colors = bc; vd.indices = bi;
    const nrm = []; BABYLON.VertexData.ComputeNormals(bp, bi, nrm); vd.normals = nrm.map((v, i) => i % 3 === 1 ? 1 : v * .2); vd.applyToMesh(blade);
    const gm = new BABYLON.CustomMaterial('terrainGrassMat', scene); gm.backFaceCulling = false; gm.specularColor = BABYLON.Color3.Black(); gm.AddUniform('uTime', 'float', 0);
    gm.Vertex_After_WorldPosComputed(`worldPos.x += sin(uTime*1.7 + worldPos.x*0.13 + worldPos.z*0.07) * 0.16 * position.y; worldPos.z += cos(uTime*1.3 + worldPos.x*0.05 + worldPos.z*0.11) * 0.08 * position.y;`);
    gm.onBindObservable.add(() => gm.getEffect()?.setFloat('uTime', performance.now() / 1000));
    scene.onBeforeRenderObservable.add(() => { if (gm._newUniformInstances) gm._newUniformInstances['float-uTime'] = performance.now() / 1000; });
    blade.material = gm; blade.useVertexColors = true; blade.hasVertexAlpha = false;
    const count = G.count, per = Math.ceil(count / 16) * 3, bufs = [...Array(16)].map(() => new Float32Array(per * 16)), cnt = new Array(16).fill(0);
    let placed = 0, tries = 0;
    while (placed < count && tries < count * 6) {
      tries++;
      const x = (rnd() - .5) * 690, z = (rnd() - .5) * 690;
      if (sq(x, z) < R.flatHalf + 2 || roadD(x, z) < 5 || T.waterEdgeDist(x, z) < 1.2 || !dry(x, z)) continue;
      if (fbm(x * .02, z * .02, 3) < -.12 + rnd() * .1) continue;
      if (!clear(x, z, -1)) continue;
      const y = h(x, z), sl = Math.abs(h(x + 1, z) - y) + Math.abs(h(x, z + 1) - y); if (sl > .8) continue;
      const t = tileOf(x, z); if (cnt[t] >= per) continue;
      const s = .8 + rnd() * .8; BABYLON.Quaternion.FromEulerAnglesToRef(0, rnd() * 6.28, 0, q);
      S.set(s, s * (.8 + rnd() * .6), s); P.set(x, y - .02, z);
      BABYLON.Matrix.ComposeToRef(S, q, P, m4); m4.copyToArray(bufs[t], cnt[t] * 16); cnt[t]++; placed++;
    }
    // the village's lawns and beds: everywhere in the courtyard that is not cobble, wall or a placed object
    const VS = T.villageShape, vg = VS ? (R.village.grass || 0) : 0;
    for (let n = 0, tr = 0; n < vg && tr < vg * 8; tr++) {
      const x = (rnd() - .5) * 2 * (R.flatHalf + 2), z = (rnd() - .5) * 2 * (R.flatHalf + 2);
      if (villagePave(x, z) > .12 || VS.isWall(x, z) || !clear(x, z, -.5) || !dry(x, z, 1.2)) continue;
      if (fbm(x * .05, z * .05, 3) < -.3 + rnd() * .1) continue;
      const t = tileOf(x, z); if (cnt[t] >= per) continue;
      const s = .75 + rnd() * .7; BABYLON.Quaternion.FromEulerAnglesToRef(0, rnd() * 6.28, 0, q);
      S.set(s, s * (.8 + rnd() * .6), s); P.set(x, h(x, z) - .02, z);
      BABYLON.Matrix.ComposeToRef(S, q, P, m4); m4.copyToArray(bufs[t], cnt[t] * 16); cnt[t]++; n++;
    }
    const before = meshes.length;
    fillTiles([blade], bufs, cnt, 'terrainGrass');
    // grass tiles far from the camera are switched off (blades there are smaller than a pixel)
    meshes.slice(before).forEach(m => { const t = +m.name.split('_')[1]; cullTiles.push({ m, x: -262.5 + Math.floor(t / 4) * 175, z: -262.5 + (t % 4) * 175, d: 150 }); });
    let lastCull = 0;
    scene.onBeforeRenderObservable.add(() => {
      const now = performance.now(); if (now - lastCull < 400) return; lastCull = now;
      const c = scene.activeCamera?.globalPosition; if (!c) return;
      for (const g of cullTiles) { const dx = Math.max(0, Math.abs(c.x - g.x) - 87.5), dz = Math.max(0, Math.abs(c.z - g.z) - 87.5), on = dx * dx + dz * dz < g.d * g.d; if (g.m.isEnabled() !== on) g.m.setEnabled(on); }
    });
  }

  // red spider lilies (or any small flower): a stalk and six thin petals, in clumps
  function buildFlowers(F) {
    const bp = [], bc = [], bi = [], tri = (a, b, c, col) => { const o = bp.length / 3; bp.push(...a, ...b, ...c); bc.push(...col, 1, ...col, 1, ...col, 1); bi.push(o, o + 1, o + 2); };
    tri([-.02, 0, 0], [.02, 0, 0], [0, .55, 0], F.stem); tri([0, 0, -.02], [0, 0, .02], [0, .55, 0], F.stem);
    for (let i = 0; i < 6; i++) { const a = i * 1.047, cx = Math.cos(a), cz = Math.sin(a); tri([0, .55, 0], [cx * .16 - cz * .03, .6, cz * .16 + cx * .03], [cx * .26, .68, cz * .26], F.petal); }
    const flower = new BABYLON.Mesh('terrainFlower', scene), vd = new BABYLON.VertexData(), nrm = [];
    BABYLON.VertexData.ComputeNormals(bp, bi, nrm); vd.positions = bp; vd.colors = bc; vd.indices = bi; vd.normals = nrm.map((v, i) => i % 3 === 1 ? 1 : v * .2); vd.applyToMesh(flower);
    // own material: same wind as the grass, and the petals keep a faint glow of their own colour even in the dark
    const fm = new BABYLON.CustomMaterial('terrainFlowerMat', scene); fm.backFaceCulling = false; fm.specularColor = BABYLON.Color3.Black(); fm.AddUniform('uTime', 'float', 0);
    fm.Vertex_After_WorldPosComputed(`worldPos.x += sin(uTime*1.7 + worldPos.x*0.13 + worldPos.z*0.07) * 0.12 * position.y; worldPos.z += cos(uTime*1.3 + worldPos.x*0.05 + worldPos.z*0.11) * 0.06 * position.y;`);
    fm.Fragment_Before_FragColor(`color.rgb = max(color.rgb, vColor.rgb * 0.55);`);
    fm.onBindObservable.add(() => fm.getEffect()?.setFloat('uTime', performance.now() / 1000));
    scene.onBeforeRenderObservable.add(() => { if (fm._newUniformInstances) fm._newUniformInstances['float-uTime'] = performance.now() / 1000; });
    flower.material = fm; flower.useVertexColors = true; flower.hasVertexAlpha = false;
    const per = Math.ceil(F.count / 16) * 4, bufs = [...Array(16)].map(() => new Float32Array(per * 16)), cnt = new Array(16).fill(0);
    let placed = 0, tries = 0;
    while (placed < F.count && tries < F.count * 30) {
      tries++;
      const x = (rnd() - .5) * 680, z = (rnd() - .5) * 680;
      if (sq(x, z) < R.flatHalf + 4 || roadD(x, z) < 4 || T.waterEdgeDist(x, z) < 1 || !dry(x, z, 1.5)) continue;
      if (fbm(x * .03 + 40, z * .03, 3) < .18) continue; // clumps
      if (!clear(x, z, 0) || slopeAt(x, z) > .5) continue;
      const t = tileOf(x, z); if (cnt[t] >= per) continue;
      const sc = .8 + rnd() * .6; BABYLON.Quaternion.FromEulerAnglesToRef(0, rnd() * 6.28, 0, q);
      S.set(sc, sc * (.85 + rnd() * .4), sc); P.set(x, h(x, z) - .02, z);
      BABYLON.Matrix.ComposeToRef(S, q, P, m4); m4.copyToArray(bufs[t], cnt[t] * 16); cnt[t]++; placed++;
    }
    const VS = T.villageShape, vf = VS ? (R.village.flowers || 0) : 0;
    for (let n = 0, tr = 0; n < vf && tr < vf * 40; tr++) {
      const [X0, Z0, X1, Z1] = VS.rect, x = X0 + rnd() * (X1 - X0), z = Z0 + rnd() * (Z1 - Z0);
      if (villagePave(x, z) > .05 || VS.isWall(x, z) || !clear(x, z, .3) || !dry(x, z, 1.5)) continue;
      if (fbm(x * .08 + 40, z * .08, 3) < .12) continue; // beds
      const t = tileOf(x, z); if (cnt[t] >= per) continue;
      const sc = .75 + rnd() * .55; BABYLON.Quaternion.FromEulerAnglesToRef(0, rnd() * 6.28, 0, q);
      S.set(sc, sc * (.85 + rnd() * .4), sc); P.set(x, h(x, z) - .02, z);
      BABYLON.Matrix.ComposeToRef(S, q, P, m4); m4.copyToArray(bufs[t], cnt[t] * 16); cnt[t]++; n++;
    }
    fillTiles([flower], bufs, cnt, 'terrainFlower');
  }

  async function scatter(spec, ok, blockR, cast) {
    let parts;
    if (spec.build) parts = [spec.build(scene)];
    else {
      const res = await BABYLON.SceneLoader.ImportMeshAsync('', '/assets/buildings/', spec.file, scene);
      parts = res.meshes.filter(mm => mm.getTotalVertices() > 0);
      parts.forEach(mm => { mm.setParent(null); mm.bakeCurrentTransformIntoVertices(); });
      res.meshes.filter(mm => mm.getTotalVertices() === 0).forEach(mm => mm.dispose());
    }
    if (spec.tint) parts.forEach(mm => { // darker version of the shared model, for this village only
      const m = mm.material; if (!m) return; const c = m.clone(m.name + '_tint'); mm.material = c;
      const t = new BABYLON.Color3(...spec.tint);
      if (c.albedoColor) c.albedoColor = c.albedoColor.multiply(t); if (c.diffuseColor) c.diffuseColor = c.diffuseColor.multiply(t);
    });
    // trunk circles found in the model (cherry trees: the trunk is well off the pivot), else one circle at the pivot
    let trunk = null;
    if (spec.trunkFromMesh) {
      const P = []; parts.forEach(mm => { const p = mm.getVerticesData(BABYLON.VertexBuffer.PositionKind); if (p) for (let i = 0; i < p.length; i++) P.push(p[i]); });
      let y0 = Infinity, y1 = -Infinity; for (let i = 1; i < P.length; i += 3) { y0 = Math.min(y0, P[i]); y1 = Math.max(y1, P[i]); }
      trunk = [];
      for (const [a, b, kk] of [[0, .05, .8], [.05, .14, 1.1]]) {
        const xs = [], zs = []; for (let i = 0; i < P.length; i += 3) { const f = (P[i + 1] - y0) / (y1 - y0); if (f >= a && f < b) { xs.push(P[i]); zs.push(P[i + 2]); } }
        if (!xs.length) continue;
        const cx = xs.reduce((q, x) => q + x, 0) / xs.length, cz = zs.reduce((q, z) => q + z, 0) / zs.length;
        const d = xs.map((x, i) => Math.hypot(x - cx, zs[i] - cz)).sort((p, q) => p - q);
        trunk.push({ x: cx, z: cz, r: Math.max(.4, d[Math.floor(d.length * .5)] * kk) });
      }
    }
    const per = spec.count, bufs = [...Array(16)].map(() => new Float32Array(per * 16)), cnt = new Array(16).fill(0);
    let k = 0, t = 0;
    while (k < spec.count && t < spec.count * 40) {
      t++;
      const x = (rnd() - .5) * 680, z = (rnd() - .5) * 680; if (!ok(x, z) || !clear(x, z, 2)) continue;
      const s = spec.scale[0] + rnd() * (spec.scale[1] - spec.scale[0]), yaw = rnd() * 6.28; BABYLON.Quaternion.FromEulerAnglesToRef(0, yaw, 0, q);
      // sit on the lowest ground under the base so the downhill side never floats
      let low = h(x, z); const rr = (spec.settle || .3) * s;
      for (let a = 0; a < 8; a++) low = Math.min(low, h(x + Math.cos(a * .785) * rr, z + Math.sin(a * .785) * rr));
      S.set(s, s, s); P.set(x, low - (spec.sink ?? .15) * s, z);
      BABYLON.Matrix.ComposeToRef(S, q, P, m4); const tile = tileOf(x, z); m4.copyToArray(bufs[tile], cnt[tile] * 16); cnt[tile]++; k++;
      if (trunk) { const c = Math.cos(yaw), sn = Math.sin(yaw); for (const tr of trunk) addBlocker(x + (tr.x * c + tr.z * sn) * s, z + (-tr.x * sn + tr.z * c) * s, tr.r * s); }
      else addBlocker(x, z, blockR * s);
      addAvoid(x, z, blockR * s + 1);
    }
    const before = meshes.length;
    fillTiles(parts, bufs, cnt, 'terrain_' + (spec.file ? spec.file.replace('.glb', '') : spec.name));
    if (cast) meshes.slice(before).forEach(m => cast(m));
    return k;
  }
  const pinesPlaced = await scatter(R.pines, (x, z) => dry(x, z, 2.5) && sq(x, z) > R.flatHalf + 38 && roadD(x, z) > 9 && T.waterEdgeDist(x, z) > 4 && slopeAt(x, z) < .55 && fbm(x * .006 + 9, z * .006, 3) > -.02, R.pines.trunk, T.castShadow);
  const rocksPlaced = await scatter(R.rocks, (x, z) => { const s = slopeAt(x, z); return sq(x, z) > (R.rocks.minSq ?? R.flatHalf + 13) && roadD(x, z) > 7 && T.waterEdgeDist(x, z) > .5 && s > .22 && s < .9; }, R.rocks.body, T.castShadow);
  if (R.deadTrees) await scatter({ ...R.deadTrees, name: 'deadTree', build: makeDeadTreeProto }, (x, z) => dry(x, z, 2) && sq(x, z) > R.flatHalf + 20 && roadD(x, z) > 8 && T.waterEdgeDist(x, z) > 3 && slopeAt(x, z) < .7, R.deadTrees.trunk, T.castShadow);
  if (R.flowers) buildFlowers(R.flowers);
  // extra scattered models (bamboo groves, cherry trees ...), optionally in clumps and switched off far away
  for (const ex of R.extras || []) {
    const before = meshes.length;
    await scatter(ex, (x, z) => {
      const q = sq(x, z); if (q < (ex.minSq ?? R.flatHalf + 20) || q > (ex.maxSq ?? 340) || roadD(x, z) < (ex.road ?? 8)) return false;
      if (T.waterEdgeDist(x, z) < (ex.water ?? 3) || slopeAt(x, z) > (ex.maxSlope ?? .55) || !dry(x, z, 2)) return false;
      if (ex.village && (villagePave(x, z) > .05 || T.villageShape?.isWall(x, z) || T.mesaBlocks(x, z))) return false; // the village's unpaved rim
      return !ex.clump || fbm(x * ex.clump.freq + ex.clump.ox, z * ex.clump.freq, 3) > ex.clump.above;
    }, ex.body, ex.shadow === false ? null : T.castShadow);
    if (ex.cull) meshes.slice(before).forEach(m => { const t = +m.name.split('_').slice(-2)[0]; cullTiles.push({ m, x: -262.5 + Math.floor(t / 4) * 175, z: -262.5 + (t % 4) * 175, d: ex.cull }); });
  }
  T.decorBlockers = blockers;
  return { meshes, pinesPlaced, rocksPlaced };
}

// ── Water surfaces ───────────────────────────────────────
// Plain lit materials (no reflection passes, so almost free): a tiling ripple normal map scrolls along the stream,
// fast and pale on the waterfall. Spray and mist at the foot of the fall are two small particle systems.
function makeRippleNormalTex(scene) {
  const S = 128, data = new Uint8Array(S * S * 4), TAU = Math.PI * 2;
  const waves = [[3, 1, .9, .3], [1, 4, .7, 1.7], [5, -2, .45, 2.9], [-2, 7, .3, .8], [8, 3, .2, 4.1]];
  const h = (x, y) => waves.reduce((acc, [a, b, amp, ph]) => acc + amp * Math.sin(TAU * (a * x + b * y) / S + ph), 0);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let nx = -(h(x + 1, y) - h(x - 1, y)) * 1.6, ny = -(h(x, y + 1) - h(x, y - 1)) * 1.6, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const k = (y * S + x) * 4; data[k] = (nx * .5 + .5) * 255; data[k + 1] = (ny * .5 + .5) * 255; data[k + 2] = (nz * .5 + .5) * 255; data[k + 3] = 255;
  }
  const t = new BABYLON.RawTexture(data, S, S, BABYLON.Engine.TEXTUREFORMAT_RGBA, scene, true, false, BABYLON.Texture.TRILINEAR_SAMPLINGMODE);
  t.wrapU = t.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
  return t;
}
function softDotTex(scene) {
  const t = new BABYLON.DynamicTexture('waterSprayTex', { width: 64, height: 64 }, scene, false), c = t.getContext();
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.5, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, 64, 64); t.update(); t.hasAlpha = true; return t;
}
function buildWater(scene, Wt) {
  const meshes = [], normalTex = makeRippleNormalTex(scene);
  const mk = (name, diffuse, emissive, alpha, scale) => {
    const m = new BABYLON.StandardMaterial(name, scene);
    m.diffuseColor = new BABYLON.Color3(...diffuse); m.emissiveColor = new BABYLON.Color3(...emissive);
    m.specularColor = new BABYLON.Color3(.85, .88, .85); m.specularPower = 90; m.alpha = alpha;
    const b = normalTex.clone(); b.uScale = scale[0]; b.vScale = scale[1]; b.level = .55; m.bumpTexture = b;
    m.backFaceCulling = false;
    return m;
  };
  const waterMat = mk('waterMat', [.07, .19, .2], [.01, .03, .035], .86, [1, 1]);
  const fallMat = mk('waterfallMat', [.5, .64, .7], [.13, .18, .21], .9, [1, 1]);
  // ribbon between two sample indices; uv: u across (metres / 6), v along (metres / 6)
  function ribbon(name, i0, i1, mat, widen = .8) {
    const pos = [], uv = [], idx = [], P = Wt.pts, hw = Wt.halfW + widen;
    let v = 0;
    for (let i = i0; i <= i1; i++) {
      const p = P[i]; if (i > i0) { const q = P[i - 1]; v += Math.hypot(p.x - q.x, p.z - q.z, p.w - q.w) / 6; }
      pos.push(p.x - p.dz * hw, p.w, p.z + p.dx * hw, p.x + p.dz * hw, p.w, p.z - p.dx * hw);
      uv.push(0, v, hw * 2 / 6, v);
      if (i > i0) { const b = (i - i0) * 2; idx.push(b - 2, b - 1, b, b - 1, b + 1, b); }
    }
    const m = new BABYLON.Mesh(name, scene), vd = new BABYLON.VertexData(), nrm = [];
    BABYLON.VertexData.ComputeNormals(pos, idx, nrm);
    vd.positions = pos; vd.indices = idx; vd.normals = nrm; vd.uvs = uv; vd.applyToMesh(m);
    m.material = mat; return m;
  }
  function disc(name, c, mat) {
    const m = BABYLON.MeshBuilder.CreateDisc(name, { radius: c.r * (c === Wt.pool ? 1.2 : 1.45) + 1.4, tessellation: 48 }, scene); // the bank draws the shoreline
    m.rotation.x = Math.PI / 2; m.position.set(c.x, c.w, c.z); m.material = mat;
    return m;
  }
  const P = Wt.pts, last = P.length - 1;
  meshes.push(ribbon('waterStream', 0, Wt.iLip, waterMat));
  const iFallEnd = Math.min(Wt.iPool, P.findIndex((p, i) => i > Wt.iLip && p.inPool) + 1 || Wt.iPool);
  Wt.iFallEnd = iFallEnd;
  meshes.push(ribbon('waterFall', Wt.iLip, iFallEnd, fallMat, 1.0));
  // the river ribbon starts at the pool's edge and ends inside the pond (less double-layered water)
  const near = (p, c, f) => Math.hypot(p.x - c.x, p.z - c.z) < c.r * f;
  let iRiver0 = Wt.iPool; while (iRiver0 < last && near(P[iRiver0], Wt.pool, .85)) iRiver0++;
  let iRiver1 = last; while (iRiver1 > iRiver0 && near(P[iRiver1], Wt.pond, .35)) iRiver1--;
  meshes.push(ribbon('waterRiver', Math.max(Wt.iPool, iRiver0 - 1), Math.min(last, iRiver1 + 1), waterMat));
  meshes.push(disc('waterPool', Wt.pool, waterMat));
  meshes.push(disc('waterPond', Wt.pond, waterMat));
  meshes.forEach(m => { m.isPickable = false; m.receiveShadows = true; m.metadata = { type: 'terrain_water', visualOnly: true }; m.alphaIndex = 10; m.freezeWorldMatrix(); });
  // flow: the stream ripples drift downstream, the fall pours
  const wb = waterMat.bumpTexture, fb = fallMat.bumpTexture; fb.uScale = 3.5; fb.vScale = .45; fb.level = 1.6;
  scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(.05, scene.getEngine().getDeltaTime() / 1000);
    wb.vOffset -= dt * .12; fb.vOffset -= dt * 1.4;
  });
  // spray + mist where the fall hits the pool
  const tex = softDotTex(scene), hit = P[Math.max(Wt.iLip, iFallEnd - 1)];
  const at = new BABYLON.Vector3(hit.x, Wt.pool.w + .2, hit.z);
  const spray = new BABYLON.ParticleSystem('waterfallSpray', 160, scene);
  spray.particleTexture = tex; spray.emitter = at.clone();
  spray.minEmitBox = new BABYLON.Vector3(-2.5, 0, -2.5); spray.maxEmitBox = new BABYLON.Vector3(2.5, .3, 2.5);
  spray.color1 = new BABYLON.Color4(.92, .96, 1, .55); spray.color2 = new BABYLON.Color4(.85, .92, .96, .35); spray.colorDead = new BABYLON.Color4(.9, .95, 1, 0);
  spray.minSize = .5; spray.maxSize = 1.6; spray.minLifeTime = .7; spray.maxLifeTime = 1.5; spray.emitRate = 110;
  spray.direction1 = new BABYLON.Vector3(-1.5, 3.5, -1.5); spray.direction2 = new BABYLON.Vector3(1.5, 6, 1.5); spray.gravity = new BABYLON.Vector3(0, -7, 0);
  spray.minEmitPower = .8; spray.maxEmitPower = 1.6; spray.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD; spray.start();
  const mist = new BABYLON.ParticleSystem('waterfallMist', 40, scene);
  mist.particleTexture = tex; mist.emitter = at.clone();
  mist.minEmitBox = new BABYLON.Vector3(-4, 0, -4); mist.maxEmitBox = new BABYLON.Vector3(4, 1, 4);
  mist.color1 = new BABYLON.Color4(.9, .94, .97, .16); mist.color2 = new BABYLON.Color4(.85, .9, .95, .1); mist.colorDead = new BABYLON.Color4(.9, .94, .97, 0);
  mist.minSize = 4; mist.maxSize = 8; mist.minLifeTime = 3; mist.maxLifeTime = 5; mist.emitRate = 9;
  mist.direction1 = new BABYLON.Vector3(-.4, .5, -.4); mist.direction2 = new BABYLON.Vector3(.4, 1.1, .4); mist.minEmitPower = .4; mist.maxEmitPower = .9;
  mist.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD; mist.start();
  return meshes;
}

// ── Cliff waterfalls and valley mist (mesa villages) ──────────
// Waterfalls are found where flat ground ends in a tall cliff facing the village (recipe.falls: how many, in which
// ring, how tall at least, how far apart); each is a ribbon laid down the rock face from the lip, streaks pouring,
// with spray-mist at the foot. Returns [{ x, z, top, bottom }] (the sound follows them).
function buildFalls(scene, T, F) {
  const h = T.heightAt, rnd = rng(T.recipe.seed * 13 + 5), cands = [], out = [];
  const grad = (x, z) => [(h(x + 1.5, z) - h(x - 1.5, z)) / 3, (h(x, z + 1.5) - h(x, z - 1.5)) / 3];
  for (let x = -336; x <= 336; x += 6) for (let z = -336; z <= 336; z += 6) {
    const r = Math.hypot(x, z); if (r < F.ring[0] || r > F.ring[1]) continue;
    const [gx, gz] = grad(x, z); if (Math.hypot(gx, gz) > .4) continue; // the lip: fairly flat ground on top
    const ux = -x / r, uz = -z / r, y = h(x, z), y1 = h(x + ux * 10, z + uz * 10), y2 = h(x + ux * 40, z + uz * 40);
    if (y < -15 || y - y1 < 8 || y - y2 < F.minDrop) continue; // a cliff right in front, towards the village
    cands.push({ x, z, ux, uz, score: y - y2 + rnd() * 6 });
  }
  cands.sort((a, b) => b.score - a.score);
  const tex = new BABYLON.DynamicTexture('fallStreakTex', { width: 64, height: 256 }, scene, true), c = tex.getContext(), img = c.createImageData(64, 256), r2 = rng(77);
  const col = [...Array(64)].map(() => .45 + .55 * r2());
  for (let y = 0; y < 256; y++) for (let x = 0; x < 64; x++) {
    const k = (y * 64 + x) * 4, edge = Math.min(1, Math.min(x, 63 - x) / 9), a = col[x] * (.7 + .3 * Math.sin(y * .1 + x * 1.7)) * edge;
    img.data[k] = 235; img.data[k + 1] = 244; img.data[k + 2] = 250; img.data[k + 3] = Math.round(255 * a);
  }
  c.putImageData(img, 0, 0); tex.update(); tex.hasAlpha = true; tex.wrapU = tex.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
  const mat = new BABYLON.StandardMaterial('cliffFallMat', scene);
  mat.diffuseTexture = tex; mat.useAlphaFromDiffuseTexture = true; mat.diffuseColor = new BABYLON.Color3(.85, .92, .97);
  mat.emissiveColor = new BABYLON.Color3(.32, .38, .44); mat.specularColor = new BABYLON.Color3(.3, .3, .3); mat.backFaceCulling = false;
  mat.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND; mat.disableDepthWrite = true;
  const dot = softDotTex(scene);
  for (const cd of cands) {
    if (out.length >= F.count) break;
    if (out.some(o => Math.hypot(o.lx - cd.x, o.lz - cd.z) < F.spacing)) continue;
    // walk from the lip down the face (small steps, steered downhill), the ribbon 0.7 m off the rock
    let px = cd.x, pz = cd.z, dx = cd.ux, dz = cd.uz, flat = 0;
    const P = [], y0 = h(px, pz);
    for (let n = 0; n < 400; n++) {
      const [gx, gz] = grad(px, pz), gl = Math.hypot(gx, gz), y = h(px, pz);
      if (gl > .05) { dx = dx * .7 - gx / gl * .3; dz = dz * .7 - gz / gl * .3; const l = Math.hypot(dx, dz); dx /= l; dz /= l; }
      const nl = Math.hypot(gx, 1, gz); P.push([px - gx / nl * .7, y + .7 / nl, pz - gz / nl * .7]);
      flat = gl < .3 && y0 - y > 10 ? flat + 1 : 0;
      if (flat > 5 || y < -46) break;
      const st = gl > 2 ? .35 : .9; px += dx * st; pz += dz * st;
    }
    if (P.length < 8 || y0 - P[P.length - 1][1] < F.minDrop * .8) continue;
    const w = F.width[0] + rnd() * (F.width[1] - F.width[0]), pos = [], uv = [], idx = [];
    let v = 0;
    for (let i = 0; i < P.length; i++) {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)], tx = b[0] - a[0], tz = b[2] - a[2], tl = Math.hypot(tx, tz) || 1;
      const sx = -tz / tl * w / 2, sz = tx / tl * w / 2, spread = 1 + .5 * i / P.length;
      if (i) v += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1], P[i][2] - P[i - 1][2]) / 14;
      pos.push(P[i][0] - sx * spread, P[i][1], P[i][2] - sz * spread, P[i][0] + sx * spread, P[i][1], P[i][2] + sz * spread);
      uv.push(0, v, w / 6, v);
      if (i) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
    }
    const m = new BABYLON.Mesh('cliffFall_' + out.length, scene), vd = new BABYLON.VertexData(), nrm = [];
    BABYLON.VertexData.ComputeNormals(pos, idx, nrm); vd.positions = pos; vd.indices = idx; vd.normals = nrm; vd.uvs = uv; vd.applyToMesh(m);
    m.material = mat; m.isPickable = false; m.alphaIndex = 12; m.metadata = { type: 'terrain_water', visualOnly: true }; m.freezeWorldMatrix();
    const foot = P[P.length - 1], ps = new BABYLON.ParticleSystem('cliffFallMist_' + out.length, 30, scene);
    ps.particleTexture = dot; ps.emitter = new BABYLON.Vector3(foot[0], foot[1] + 1, foot[2]);
    ps.minEmitBox = new BABYLON.Vector3(-w / 2, 0, -w / 2); ps.maxEmitBox = new BABYLON.Vector3(w / 2, 2, w / 2);
    ps.color1 = new BABYLON.Color4(.92, .96, 1, .22); ps.color2 = new BABYLON.Color4(.85, .9, .96, .14); ps.colorDead = new BABYLON.Color4(.9, .95, 1, 0);
    ps.minSize = 6; ps.maxSize = 13; ps.minLifeTime = 3; ps.maxLifeTime = 5.5; ps.emitRate = 7;
    ps.direction1 = new BABYLON.Vector3(-.5, .6, -.5); ps.direction2 = new BABYLON.Vector3(.5, 1.4, .5); ps.minEmitPower = .5; ps.maxEmitPower = 1.2;
    ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD; ps.start();
    const mid = P[Math.floor(P.length / 2)];
    out.push({ x: mid[0], z: mid[2], lx: cd.x, lz: cd.z, top: y0, bottom: foot[1], mesh: m });
  }
  scene.onBeforeRenderObservable.add(() => { tex.vOffset -= Math.min(.05, scene.getEngine().getDeltaTime() / 1000) * 1.3; });
  return out;
}
// Mist lying in the ravine (recipe.mist): a few huge soft cloud layers at fixed heights, drifting slowly. Lit by the
// scene (dark at night) with a little glow of their own, so the valley keeps a faint blue shimmer after dark.
function buildMist(scene, M) {
  const S = 256, mk = (i) => {
    const t = new BABYLON.DynamicTexture('valleyMistTex_' + i, { width: S, height: S }, scene, true), c = t.getContext(), img = c.createImageData(S, S);
    const { perlin } = makeNoise(4242 + i * 17), per = (x, y, f) => { // tileable noise: blend of four shifted copies
      const u = x / S, v = y / S, n = (a, b) => perlin(a * f, b * f);
      return n(u, v) * (1 - u) * (1 - v) + n(u + 1, v) * u * (1 - v) + n(u, v + 1) * (1 - u) * v + n(u + 1, v + 1) * u * v;
    };
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const n = per(x, y, 4) * .6 + per(x, y, 8) * .3 + per(x, y, 16) * .15, a = Math.min(1, Math.max(0, .55 + n * 1.6));
      const k = (y * S + x) * 4; img.data[k] = img.data[k + 1] = img.data[k + 2] = 255; img.data[k + 3] = Math.round(255 * a);
    }
    c.putImageData(img, 0, 0); t.update(); t.hasAlpha = true; t.wrapU = t.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE; return t;
  };
  const layers = M.layers.map(([y, alpha], i) => {
    const g = BABYLON.MeshBuilder.CreateGround('valleyMist_' + i, { width: 1500, height: 1500, subdivisions: 1 }, scene);
    g.position.y = y; g.isPickable = false; g.metadata = { type: 'visual_backdrop', visualOnly: true };
    const m = new BABYLON.StandardMaterial('valleyMistMat_' + i, scene), tx = mk(i);
    tx.uScale = tx.vScale = 7 + i * 2.3; tx.uOffset = i * .37; tx.vOffset = i * .61;
    m.diffuseTexture = tx; m.useAlphaFromDiffuseTexture = true; m.diffuseColor = new BABYLON.Color3(...M.color);
    m.emissiveColor = new BABYLON.Color3(...M.color.map(v => v * (M.glow ?? .3))); m.specularColor = BABYLON.Color3.Black();
    m.alpha = alpha; m.backFaceCulling = false; m.disableDepthWrite = true; m.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
    g.material = m; g.alphaIndex = 5 + i; g.freezeWorldMatrix();
    return { g, tx, sp: .0016 * (1 + i * .6) };
  });
  scene.onBeforeRenderObservable.add(() => { const dt = Math.min(.05, scene.getEngine().getDeltaTime() / 1000); for (const L of layers) { L.tx.uOffset += dt * L.sp; L.tx.vOffset += dt * L.sp * .4; } });
  return layers;
}

// A gnarled dead tree (trunk and bare branches, one mesh), about 4.6 m tall at scale 1.
// ── Sea (coastal villages) ─────────────────────────────────
// Metres to the nearest shoreline (sea cells next to land) on a 4 m grid over the map: two-pass chamfer distance.
function shoreDistanceField(heightAt, seaY) {
  const cell = 4, n = Math.floor(SIZE / cell) + 1, wet = new Uint8Array(n * n), d = new Float32Array(n * n).fill(1e9);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) wet[j * n + i] = heightAt(i * cell - SIZE / 2, j * cell - SIZE / 2) < seaY ? 1 : 0;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i; if (!wet[k]) continue;
    if ((i > 0 && !wet[k - 1]) || (i < n - 1 && !wet[k + 1]) || (j > 0 && !wet[k - n]) || (j < n - 1 && !wet[k + n])) d[k] = 0;
  }
  const a = cell, b = cell * Math.SQRT2, relax = (k, k2, w) => { if (d[k2] + w < d[k]) d[k] = d[k2] + w; };
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i;
    if (i > 0) relax(k, k - 1, a);
    if (j > 0) { relax(k, k - n, a); if (i > 0) relax(k, k - n - 1, b); if (i < n - 1) relax(k, k - n + 1, b); }
  }
  for (let j = n - 1; j >= 0; j--) for (let i = n - 1; i >= 0; i--) {
    const k = j * n + i;
    if (i < n - 1) relax(k, k + 1, a);
    if (j < n - 1) { relax(k, k + n, a); if (i < n - 1) relax(k, k + n + 1, b); if (i > 0) relax(k, k + n - 1, b); }
  }
  return { cell, n, d };
}

// One big gently-waving surface at sea level. Colour and see-through come from the depth of the ground under each
// point (a small depth texture): clear turquoise in the shallows (the sand shows through), deep blue further out,
// a moving foam line where the water meets the shore, sky tint at grazing angles, sparkle from the ripple normals.
function buildSea(scene, S, H, seaY) {
  const data = new Uint8Array(N * N * 4);
  for (let k = 0; k < N * N; k++) { const d = seaY - H[k]; data[k * 4] = Math.round(255 * Math.min(1, Math.max(0, (d + 1) / 25))); data[k * 4 + 3] = 255; }
  const depthTex = new BABYLON.RawTexture(data, N, N, BABYLON.Engine.TEXTUREFORMAT_RGBA, scene, false, false, BABYLON.Texture.BILINEAR_SAMPLINGMODE);
  depthTex.wrapU = depthTex.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE;
  const sea = BABYLON.MeshBuilder.CreateGround('seaSurface', { width: 3200, height: 3200, subdivisions: 240 }, scene);
  sea.position.y = seaY; sea.isPickable = false; sea.metadata = { type: 'visual_backdrop', visualOnly: true, sea: true };
  const m = new BABYLON.CustomMaterial('seaMat', scene);
  m.diffuseColor = new BABYLON.Color3(1, 1, 1); m.specularColor = new BABYLON.Color3(.8, .78, .72); m.specularPower = 320;
  m.emissiveColor = new BABYLON.Color3(.0, .02, .03); m.alpha = .999; m.backFaceCulling = false;
  m.AddUniform('uDepthTex', 'sampler2D', depthTex); m.AddUniform('uTime', 'float', 0);
  const c3 = a => `vec3(${a.map(n => n.toFixed(3)).join(',')})`;
  m.Vertex_Before_PositionUpdated(`positionUpdated.y += sin(position.x*0.07 + uTime*1.05)*${(S.waves ?? .2).toFixed(3)} + sin(position.z*0.095 - uTime*0.85)*${((S.waves ?? .2) * .7).toFixed(3)} + sin((position.x + position.z)*0.23 + uTime*1.9)*0.05;`);
  // wave normals: a few travelling waves in different directions, summed (no texture, so no visible tiling)
  m.Fragment_Before_Lights(`
    vec2 wp = vPositionW.xz; float tt = uTime; vec2 g = vec2(0.0);
    const int NW = 7; vec3 W[7];
    W[0] = vec3(0.71, 0.70, 0.21); W[1] = vec3(-0.45, 0.89, 0.33); W[2] = vec3(0.95, -0.31, 0.52); W[3] = vec3(-0.83, -0.55, 0.81);
    W[4] = vec3(0.2, 0.98, 1.3); W[5] = vec3(0.6, -0.8, 2.1); W[6] = vec3(-0.98, 0.17, 3.3);
    for (int i = 0; i < NW; i++) { float k = W[i].z, ph = dot(W[i].xy, wp) * k + tt * sqrt(9.8 * k) * 0.55 + float(i) * 1.7; g += W[i].xy * cos(ph) * (0.13 / (1.0 + float(i) * 0.7)); }
    float fade = 1.0 / (1.0 + length(vEyePosition.xyz - vPositionW) * 0.004);
    normalW = normalize(vec3(-g.x * fade, 1.0, -g.y * fade));
  `);
  m.Fragment_Definitions(`
    float seaDepth(vec2 p){ vec2 uv = p / 700.0 + 0.5; if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 40.0; return texture2D(uDepthTex, uv).r * 25.0 - 1.0; }
  `);
  m.Fragment_Custom_Diffuse(`
    float dSea = seaDepth(vPositionW.xz);
    vec3 wc = mix(${c3(S.shallow || [.2, .66, .62])}, ${c3(S.mid || [.04, .38, .52])}, smoothstep(0.4, 5.0, dSea));
    wc = mix(wc, ${c3(S.deep || [.02, .13, .27])}, smoothstep(5.0, 22.0, dSea));
    diffuseColor = wc * 0.7;
  `);
  m.Fragment_Custom_Alpha(`alpha = mix(0.32, 0.95, smoothstep(0.2, 8.0, seaDepth(vPositionW.xz)));`);
  m.Fragment_Before_FragColor(`
    float dS = seaDepth(vPositionW.xz);
    float fn = sin(vPositionW.x*0.7 + uTime*1.3) * sin(vPositionW.z*0.9 - uTime*1.1);
    float foam = clamp((1.0 - smoothstep(0.0, 0.85, dS + fn*0.22)) * (0.6 + 0.4*sin(uTime*1.7 - dS*8.0)), 0.0, 1.0);
    vec3 eyeV = normalize(vEyePosition.xyz - vPositionW);
    float fres = pow(1.0 - clamp(eyeV.y, 0.0, 1.0), 5.0);
    color.rgb = mix(color.rgb, ${c3(S.sky || [.7, .82, .9])}, fres * 0.5);
    color.rgb = mix(color.rgb, vec3(0.95, 0.97, 0.96), foam * 0.85);
    color.a = max(color.a, foam * 0.9);
  `);
  sea.material = m;
  scene.onBeforeRenderObservable.add(() => {
    const t = performance.now() / 1000;
    if (m._newUniformInstances) m._newUniformInstances['float-uTime'] = t;
  });
  m.onBindObservable.add(() => m.getEffect()?.setFloat('uTime', performance.now() / 1000));
  return { mesh: sea, material: m, depthTex };
}

function makeDeadTreeProto(scene) {
  const parts = [], cyl = (h, top, bot, x, y, z, rx, rz) => { const c = BABYLON.MeshBuilder.CreateCylinder('dt', { height: h, diameterTop: top, diameterBottom: bot, tessellation: 6 }, scene); c.position.set(x, y, z); c.rotation.x = rx; c.rotation.z = rz; parts.push(c); };
  cyl(4.4, .26, .55, 0, 2.15, 0, 0, .08);
  [[-.5, 2.9, .1, .25, .9, 1.4, .2], [.55, 3.2, -.1, -.2, -.85, 1.2, .18], [-.3, 3.75, -.05, -.15, .55, 1.0, .15], [.3, 3.95, .1, .2, -.5, .9, .13], [.4, 2.3, .15, .3, -1.1, .9, .15], [-.75, 3.55, .2, .4, 1.25, .7, .1], [.8, 3.75, -.2, -.35, -1.3, .6, .09]]
    .forEach(([x, y, z, rx, rz, h, d]) => cyl(h, d * .4, d, x, y, z, rx, rz));
  const m = BABYLON.Mesh.MergeMeshes(parts, true, true);
  m.name = 'terrainDeadTree';
  const mat = new BABYLON.StandardMaterial('terrainDeadTreeMat', scene);
  mat.diffuseColor = new BABYLON.Color3(.075, .06, .05); mat.specularColor = new BABYLON.Color3(.02, .02, .02);
  m.material = mat;
  return m;
}
