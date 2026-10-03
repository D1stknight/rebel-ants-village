// Village terrain v1 (Oct 2026). The Terrain Lab's "look 3" for the real villages:
// a 513² heightmap (seeded noise + water erosion), a painted ground material (grass / dirt / rock / roads by slope,
// height and where water runs), far mountains, swaying grass and pines / rocks scattered by slope.
// Each village gets a recipe; only the hub has one so far. Loaded by village.html only with ?terrain=new.
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
    pines: { file: 'pine_1.glb', count: 300, scale: [2.2, 4.2], trunk: 0.32 },
    rocks: { file: 'rock_1.glb', count: 240, scale: [1.0, 3.2], body: 0.75 }
  }
};

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
  const { fbm, ridged } = makeNoise(recipe.seed);
  return (x, z) => {
    const r = Math.hypot(x, z), s = Math.max(Math.abs(x), Math.abs(z));
    const wx = x + 45 * fbm(x * .004 + 5.2, z * .004 + 1.3, 3), wz = z + 45 * fbm(x * .004 - 3.7, z * .004 + 8.1, 3);
    const hills = ((fbm(wx * .0075, wz * .0075) * 30 + ridged(wx * .011, wz * .011) * 16) + 5) * recipe.hills;
    const ring = smooth(recipe.hillStart, recipe.hillFull, s);
    const wall = smooth(recipe.wallStart, 352, s) * (30 + ridged(wx * .0055 + 3, wz * .0055) * 70);
    const far = smooth(360, 1300, r) * (40 + ridged(x * .0022, z * .0022) * 260);
    return Math.max(0, hills) * ring + wall + far;
  };
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
  const soft = blur(blur(H, 9), 9);
  const path = new Uint8Array(N * N);
  const f0 = recipe.flatHalf;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = i * CELL - SIZE / 2, z = j * CELL - SIZE / 2, s = Math.max(Math.abs(x), Math.abs(z)), k = j * N + i;
    const road = Math.min(Math.abs(x), Math.abs(z));
    if (s > f0 - 8) { const w = 1 - smooth(4, 16, road); if (w > 0) H[k] = H[k] * (1 - w) + soft[k] * w; path[k] = Math.round((1 - smooth(3, 6.5, road)) * 255); }
    H[k] *= smooth(f0, f0 + 16, s);
  }
  return { H, flow, path, baseHeight };
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
  const recipe = { ...baseRecipe, grass: { ...baseRecipe.grass }, pines: { ...baseRecipe.pines }, rocks: { ...baseRecipe.rocks } };
  const c = opts.counts || {};
  if (Number.isFinite(c.grass)) recipe.grass.count = c.grass;
  if (Number.isFinite(c.pines)) recipe.pines.count = c.pines;
  if (Number.isFinite(c.rocks)) recipe.rocks.count = c.rocks;
  const hm = buildHeightmap(recipe);
  const H0 = hm.H, H = new Float32Array(H0), path0 = hm.path, path = new Uint8Array(path0);
  const ground = BABYLON.MeshBuilder.CreateGround('gnd', { width: SIZE, height: SIZE, subdivisions: SUBDIV, updatable: true }, scene);
  let pos = ground.getVerticesData(BABYLON.VertexBuffer.PositionKind);
  let sampler = null;
  function writeHeights() {
    pos = ground.getVerticesData(BABYLON.VertexBuffer.PositionKind, true, true) || pos;
    for (let row = 0; row <= SUBDIV; row++) for (let col = 0; col <= SUBDIV; col++) pos[(col + row * (SUBDIV + 1)) * 3 + 1] = H[(SUBDIV - row) * 2 * N + col * 2];
    ground.updateVerticesData(BABYLON.VertexBuffer.PositionKind, pos);
    ground.createNormals(true);
    ground.refreshBoundingInfo();
    sampler = makeGridSampler(pos.slice(), SUBDIV, SIZE);
  }
  writeHeights();

  // mask: R = where water runs, G = roads and building yards
  let fmax = 0; for (let k = 0; k < hm.flow.length; k++) fmax = Math.max(fmax, Math.log1p(hm.flow[k]));
  const mask = new Uint8Array(N * N * 4);
  function writeMask() { for (let k = 0; k < N * N; k++) { mask[k * 4] = Math.round(255 * Math.min(1, Math.log1p(hm.flow[k]) / (fmax * .7))); mask[k * 4 + 1] = path[k]; mask[k * 4 + 3] = 255; } }
  writeMask();
  const maskTex = new BABYLON.RawTexture(mask, N, N, BABYLON.Engine.TEXTUREFORMAT_RGBA, scene, false, false, BABYLON.Texture.BILINEAR_SAMPLINGMODE);
  maskTex.wrapU = maskTex.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE;
  const material = makeTerrainMaterial(scene, maskTex, recipe.palette);
  ground.material = material;

  // horizon: the same land continues into far mountains (sunk under the main terrain inside the square)
  const far = BABYLON.MeshBuilder.CreateGround('terrainFar', { width: 3200, height: 3200, subdivisions: 160, updatable: true }, scene);
  const fp = far.getVerticesData(BABYLON.VertexBuffer.PositionKind);
  for (let i = 0; i < fp.length; i += 3) { const x = fp[i], z = fp[i + 2]; fp[i + 1] = hm.baseHeight(x, z) - ((Math.abs(x) < 352 && Math.abs(z) < 352) ? 6 : 0); }
  far.updateVerticesData(BABYLON.VertexBuffer.PositionKind, fp); far.createNormals(true);
  far.material = material; far.isPickable = false; far.metadata = { type: 'visual_backdrop', visualOnly: true };
  far.freezeWorldMatrix();

  const T = {
    recipe, ground, far, material, maskTex, subdiv: SUBDIV, buildMs: Math.round(performance.now() - t0),
    heightAt: (x, z) => sampler(x, z),
    oldHeightAt: opts.oldHeightAt || null,
    pads: [], decor: null, decorBlockers: null,
    // Height of the flat yard a building of this footprint gets at (x, z): the average untouched ground under it.
    padHeightAt(x, z, radius) {
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
      const g = T.decorBlockers; if (!g) return false;
      const cx = Math.floor((x + 400) / 20), cz = Math.floor((z + 400) / 20);
      for (let a = cx - 1; a <= cx + 1; a++) for (let b = cz - 1; b <= cz + 1; b++) {
        const list = g.get(a * 1000 + b); if (!list) continue;
        for (const o of list) { const dx = x - o.x, dz = z - o.z, rr = o.r + padding; if (dx * dx + dz * dz <= rr * rr) return true; }
      }
      return false;
    }
  };
  return T;
}

function makeTerrainMaterial(scene, maskTex, P) {
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
      float wet = mask.r * inside, road = mask.g * inside;
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
      col = mix(col, rock, smoothstep(0.3, 0.46, slope + (micro-0.5)*0.14));
      col = mix(col, col*vec3(1.12,1.04,0.78), smoothstep(30.0, 70.0, pw.y)*(1.0 - smoothstep(0.3,0.45,slope)));
      col = mix(col, vec3(0.9,0.92,0.95), smoothstep(150.0, 230.0, pw.y + micro*20.0)*(1.0-smoothstep(0.45,0.6,slope)));
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
  const meshes = [], blockers = new Map();
  const addBlocker = (x, z, r) => { const key = Math.floor((x + 400) / 20) * 1000 + Math.floor((z + 400) / 20); if (!blockers.has(key)) blockers.set(key, []); blockers.get(key).push({ x, z, r }); };
  const h = T.heightAt;
  const slopeAt = (x, z) => { const y = h(x, z); return Math.hypot(h(x + 2, z) - y, h(x, z + 2) - y) / 2; };
  // avoid grid: placed objects and building yards
  const av = new Map();
  const addAvoid = (x, z, r) => { for (let a = Math.floor((x - r + 400) / 20); a <= Math.floor((x + r + 400) / 20); a++) for (let b = Math.floor((z - r + 400) / 20); b <= Math.floor((z + r + 400) / 20); b++) { const k = a * 1000 + b; if (!av.has(k)) av.set(k, []); av.get(k).push({ x, z, r }); } };
  avoid.forEach(o => addAvoid(o.x, o.z, o.r));
  T.pads.forEach(p => addAvoid(p.x, p.z, p.rIn + 4));
  const clear = (x, z, extra = 0) => { const list = av.get(Math.floor((x + 400) / 20) * 1000 + Math.floor((z + 400) / 20)); if (!list) return true; for (const o of list) { const rr = o.r + extra; if ((x - o.x) ** 2 + (z - o.z) ** 2 < rr * rr) return false; } return true; };
  const sq = (x, z) => Math.max(Math.abs(x), Math.abs(z)), roadD = (x, z) => Math.min(Math.abs(x), Math.abs(z));
  const m4 = new BABYLON.Matrix(), q = new BABYLON.Quaternion(), S = new BABYLON.Vector3(), P = new BABYLON.Vector3();

  function fillTiles(protoParts, buffers, counts, name) {
    for (let t = 0; t < 16; t++) {
      if (!counts[t]) continue;
      protoParts.forEach((proto, pi) => {
        const m = proto.clone(`${name}_${t}_${pi}`);
        m.isVisible = true; m.setEnabled(true);
        m.thinInstanceSetBuffer('matrix', buffers[t].subarray(0, counts[t] * 16), 16, true);
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
      if (sq(x, z) < R.flatHalf + 2 || roadD(x, z) < 5) continue;
      if (fbm(x * .02, z * .02, 3) < -.12 + rnd() * .1) continue;
      if (!clear(x, z, -1)) continue;
      const y = h(x, z), sl = Math.abs(h(x + 1, z) - y) + Math.abs(h(x, z + 1) - y); if (sl > .8) continue;
      const t = tileOf(x, z); if (cnt[t] >= per) continue;
      const s = .8 + rnd() * .8; BABYLON.Quaternion.FromEulerAnglesToRef(0, rnd() * 6.28, 0, q);
      S.set(s, s * (.8 + rnd() * .6), s); P.set(x, y - .02, z);
      BABYLON.Matrix.ComposeToRef(S, q, P, m4); m4.copyToArray(bufs[t], cnt[t] * 16); cnt[t]++; placed++;
    }
    fillTiles([blade], bufs, cnt, 'terrainGrass');
  }

  async function scatter(spec, ok, blockR, cast) {
    const res = await BABYLON.SceneLoader.ImportMeshAsync('', '/assets/buildings/', spec.file, scene);
    const parts = res.meshes.filter(mm => mm.getTotalVertices() > 0);
    parts.forEach(mm => { mm.setParent(null); mm.bakeCurrentTransformIntoVertices(); });
    res.meshes.filter(mm => mm.getTotalVertices() === 0).forEach(mm => mm.dispose());
    const per = spec.count, bufs = [...Array(16)].map(() => new Float32Array(per * 16)), cnt = new Array(16).fill(0);
    let k = 0, t = 0;
    while (k < spec.count && t < spec.count * 40) {
      t++;
      const x = (rnd() - .5) * 680, z = (rnd() - .5) * 680; if (!ok(x, z) || !clear(x, z, 2)) continue;
      const s = spec.scale[0] + rnd() * (spec.scale[1] - spec.scale[0]); BABYLON.Quaternion.FromEulerAnglesToRef(0, rnd() * 6.28, 0, q);
      S.set(s, s, s); P.set(x, h(x, z) - .15 * s, z);
      BABYLON.Matrix.ComposeToRef(S, q, P, m4); const tile = tileOf(x, z); m4.copyToArray(bufs[tile], cnt[tile] * 16); cnt[tile]++; k++;
      addBlocker(x, z, blockR * s); addAvoid(x, z, blockR * s + 1);
    }
    const before = meshes.length;
    fillTiles(parts, bufs, cnt, 'terrain_' + spec.file.replace('.glb', ''));
    if (cast) meshes.slice(before).forEach(m => cast(m));
    return k;
  }
  const pinesPlaced = await scatter(R.pines, (x, z) => sq(x, z) > R.flatHalf + 38 && roadD(x, z) > 9 && slopeAt(x, z) < .55 && fbm(x * .006 + 9, z * .006, 3) > -.02, R.pines.trunk, T.castShadow);
  const rocksPlaced = await scatter(R.rocks, (x, z) => { const s = slopeAt(x, z); return sq(x, z) > R.flatHalf + 13 && roadD(x, z) > 7 && s > .22 && s < .9; }, R.rocks.body, T.castShadow);
  T.decorBlockers = blockers;
  return { meshes, pinesPlaced, rocksPlaced };
}
