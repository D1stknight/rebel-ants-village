// Walk floors and walls from a building's own triangles (Oct 2026). A grid over the piece (in its own frame, metres, y up)
// records where geometry is at each height and which faces are flat enough to stand on; a flood fill from the ground
// round it climbs every step it can (one step at most stepUp high, with room for the body above it), so porches, raised
// floors, plinths with steps and stairs come out as walkable floors at their own heights, and whatever stands at body
// height that the walk cannot reach (walls, posts, counters, rails, a raised floor with no steps) comes out as walls.
// The village turns the result into kit decks and wall boxes for every placed copy (village.html addAutoWalk).
// Pure JS, no Babylon: village.html runs it once per piece type; tools run the same code in Node.
(function (root) {
  // g grid (m); ground: the ground's height in the piece's frame; stepUp: the highest step; low: geometry this far above a floor
  // (up to stepUp) right under the feet makes it no floor (a low block, not a step); band: the body's height range, kept clear
  // within radius of where it stands; inflate: walls widened by this; minFloor: floors lower than this are left to the ground
  const DEF = { g: .1, ground: 0, stepUp: .5, drop: 1.2, low: .12, band: 2.2, radius: .2, inflate: .3, margin: 1.2, minFloor: .08, slice: .1, maxCells: 1.2e6 };

  // tris: Float32Array / array of 9 numbers per triangle (x, y, z of a, b, c)
  function fromTriangles(tris, opts = {}) {
    const o = { ...DEF, ...opts }, nT = Math.floor(tris.length / 9);
    if (!nT) return null;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < nT * 9; i += 3) {
      const x = tris[i], y = tris[i + 1], z = tris[i + 2];
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }
    let g = o.g;
    const spanX = maxX - minX + 2 * o.margin, spanZ = maxZ - minZ + 2 * o.margin;
    while ((spanX / g) * (spanZ / g) > o.maxCells) g *= 1.25;
    const x0 = minX - o.margin, z0 = minZ - o.margin, W = Math.ceil(spanX / g) + 1, H = Math.ceil(spanZ / g) + 1, N = W * H;
    const G0 = o.ground, ys0 = Math.min(G0, minY) - .2, SL = o.slice, NS = Math.ceil((Math.max(maxY, G0 + o.band) + o.band + .5 - ys0) / SL) + 1, WD = Math.ceil(NS / 32);
    const occ = new Uint32Array(N * WD);
    const mark = (x, y, z) => {
      const i = Math.floor((x - x0) / g), k = Math.floor((z - z0) / g); if (i < 0 || k < 0 || i >= W || k >= H) return;
      const s = Math.floor((y - ys0) / SL); if (s < 0 || s >= NS) return;
      occ[(k * W + i) * WD + (s >> 5)] |= 1 << (s & 31);
    };
    // candidates: heights of the flat faces over each cell (up to CAP per cell)
    const CAP = 6, cand = new Float32Array(N * CAP).fill(NaN), nc = new Uint8Array(N);
    const addCand = (c, y) => {
      const b = c * CAP, n = nc[c];
      for (let q = 0; q < n; q++) if (Math.abs(cand[b + q] - y) < .02) { if (y > cand[b + q]) cand[b + q] = y; return; }
      if (n < CAP) { cand[b + n] = y; nc[c] = n + 1; return; }
      let lo = 0; for (let q = 1; q < CAP; q++) if (cand[b + q] < cand[b + lo]) lo = q; // full: keep the highest ones
      if (y > cand[b + lo]) cand[b + lo] = y;
    };
    // solid: each triangle clipped to every grid column it crosses; the height range of the clipped piece is marked
    const P0 = new Float64Array(30), P1 = new Float64Array(30), strip = new Float64Array(30), EPS = 1e-4;
    const clip = (src, n, axis, v, keepAbove, dst) => { // keep the part of the polygon with p[axis] >= v (or <= v)
      let m = 0;
      for (let q = 0; q < n; q++) {
        const a = q * 3, b = ((q + 1) % n) * 3, pa = src[a + axis], pb = src[b + axis];
        const ina = keepAbove ? pa >= v : pa <= v, inb = keepAbove ? pb >= v : pb <= v;
        if (ina) { dst[m * 3] = src[a]; dst[m * 3 + 1] = src[a + 1]; dst[m * 3 + 2] = src[a + 2]; m++; }
        if (ina !== inb) { const t = (v - pa) / (pb - pa); dst[m * 3] = src[a] + (src[b] - src[a]) * t; dst[m * 3 + 1] = src[a + 1] + (src[b + 1] - src[a + 1]) * t; dst[m * 3 + 2] = src[a + 2] + (src[b + 2] - src[a + 2]) * t; m++; }
      }
      return m;
    };
    const markRange = (c, ylo, yhi) => {
      const s0 = Math.max(0, Math.floor((ylo - ys0) / SL)), s1 = Math.min(NS - 1, Math.floor((yhi - ys0) / SL)), b = c * WD;
      for (let s = s0; s <= s1; s++) occ[b + (s >> 5)] |= 1 << (s & 31);
    };
    for (let t = 0; t < nT; t++) {
      const j = t * 9, xa = tris[j], xb = tris[j + 3], xc = tris[j + 6], za = tris[j + 2], zb = tris[j + 5], zc = tris[j + 8];
      const i0 = Math.max(0, Math.floor((Math.min(xa, xb, xc) - x0 - EPS) / g)), i1 = Math.min(W - 1, Math.floor((Math.max(xa, xb, xc) - x0 + EPS) / g));
      const k0 = Math.max(0, Math.floor((Math.min(za, zb, zc) - z0 - EPS) / g)), k1 = Math.min(H - 1, Math.floor((Math.max(za, zb, zc) - z0 + EPS) / g));
      if (i0 === i1 && k0 === k1) markRange(k0 * W + i0, Math.min(tris[j + 1], tris[j + 4], tris[j + 7]), Math.max(tris[j + 1], tris[j + 4], tris[j + 7]));
      else for (let i = i0; i <= i1; i++) {
        const cx0 = x0 + i * g, cx1 = cx0 + g;
        for (let q = 0; q < 9; q++) P0[q] = tris[j + q];
        let n = clip(P0, 3, 0, cx0 - EPS, true, P1); if (n < 1) continue; // a face lying on a grid line belongs to both sides
        n = clip(P1, n, 0, cx1 + EPS, false, P0); if (n < 1) continue;
        const nStrip = n; let zl = Infinity, zh = -Infinity; // the triangle within this column of cells, and its z extent
        for (let q = 0; q < n * 3; q++) strip[q] = P0[q];
        for (let q = 0; q < n; q++) { const z = strip[q * 3 + 2]; if (z < zl) zl = z; if (z > zh) zh = z; }
        const ka = Math.max(k0, Math.floor((zl - z0 - EPS) / g)), kb = Math.min(k1, Math.floor((zh - z0 + EPS) / g));
        for (let k = ka; k <= kb; k++) {
          const cz0 = z0 + k * g, cz1 = cz0 + g;
          let m = clip(strip, nStrip, 2, cz0 - EPS, true, P1); if (m < 1) continue;
          m = clip(P1, m, 2, cz1 + EPS, false, P0); if (m < 1) continue;
          let lo = Infinity, hi = -Infinity;
          for (let q = 0; q < m; q++) { const y = P0[q * 3 + 1]; if (y < lo) lo = y; if (y > hi) hi = y; }
          markRange(k * W + i, lo, hi);
        }
      }
      const ax = tris[j], ay = tris[j + 1], az = tris[j + 2], bx = tris[j + 3], by = tris[j + 4], bz = tris[j + 5], cx = tris[j + 6], cy = tris[j + 7], cz = tris[j + 8];
      // flat enough to stand on (either winding): its height at every cell centre it covers
      const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, nl = Math.hypot(nx, ny, nz);
      if (nl < 1e-9 || Math.abs(ny) / nl < .85) continue; // walkable up to about 32 degrees (not up a roof)
      const den = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz); if (Math.abs(den) < 1e-12) continue;
      for (let k = k0; k <= k1; k++) {
        const pz = z0 + (k + .5) * g;
        for (let i = i0; i <= i1; i++) {
          const px = x0 + (i + .5) * g;
          const l1 = ((bz - cz) * (px - cx) + (cx - bx) * (pz - cz)) / den, l2 = ((cz - az) * (px - cx) + (ax - cx) * (pz - cz)) / den, l3 = 1 - l1 - l2;
          if (l1 < -1e-4 || l2 < -1e-4 || l3 < -1e-4) continue;
          addCand(k * W + i, l1 * ay + l2 * by + l3 * cy);
        }
      }
    }
    // is anything solid in the height range [ylo, yhi] over cell c
    const rangeMask = (ylo, yhi) => { const s0 = Math.max(0, Math.floor((ylo - ys0) / SL)), s1 = Math.min(NS - 1, Math.floor((yhi - ys0) / SL)); return [s0, s1]; };
    const occAt = (c, s0, s1) => {
      if (s1 < s0) return false;
      const b = c * WD;
      for (let w = s0 >> 5; w <= s1 >> 5; w++) {
        let m = 0xffffffff;
        if (w === s0 >> 5) m &= 0xffffffff << (s0 & 31);
        if (w === s1 >> 5) m &= (s1 & 31) === 31 ? 0xffffffff : ((1 << ((s1 & 31) + 1)) - 1);
        if (occ[b + w] & m) return true;
      }
      return false;
    };
    // a floor at y over cell (i, k) holds the body: nothing solid just above it right there (y + low .. y + stepUp: below
    // that height anything else is a step up, met by the walk as a floor of its own), and nothing at body height
    // (y + stepUp .. y + band) within the body's radius
    const R = Math.max(0, Math.round(o.radius / g)), disc = [];
    for (let dk = -R; dk <= R; dk++) for (let di = -R; di <= R; di++) if (di * di + dk * dk <= R * R + .5) disc.push([di, dk]);
    const standable = (i, k, y) => {
      const [a0, a1] = rangeMask(y + o.low, y + o.stepUp);
      if (occAt(k * W + i, a0, a1)) return false;
      const [s0, s1] = rangeMask(y + o.stepUp + .001, y + o.band);
      for (const [di, dk] of disc) { const ii = i + di, kk = k + dk; if (ii < 0 || kk < 0 || ii >= W || kk >= H) continue; if (occAt(kk * W + ii, s0, s1)) return false; }
      return true;
    };
    // flood fill from the ground round the piece, always onto the highest floor within a step
    const level = new Float32Array(N).fill(NaN), queue = new Int32Array(N * 4); let qh = 0, qt = 0;
    const groundOk = new Int8Array(N).fill(-1);
    const groundStand = c => { if (groundOk[c] < 0) groundOk[c] = standable(c % W, Math.floor(c / W), G0) ? 1 : 0; return groundOk[c] === 1; };
    const push = c => { if (qt < queue.length) queue[qt++] = c; };
    if (o.seeds) { // inside a room: from where the player starts (x, z, floor height)
      for (const [sx, sz, sy = G0] of o.seeds) {
        const i = Math.floor((sx - x0) / g), k = Math.floor((sz - z0) / g); if (i < 0 || k < 0 || i >= W || k >= H) continue;
        const c = k * W + i; let y = NaN;
        for (let q = 0; q < nc[c]; q++) { const h = cand[c * CAP + q]; if (h <= sy + o.stepUp && h >= sy - .3 && h > G0 + .02 && !(h <= y) && standable(i, k, h)) y = h; }
        if (y !== y) y = G0;
        level[c] = y; push(c);
      }
    } else {
      for (let i = 0; i < W; i++) for (const k of [0, H - 1]) { const c = k * W + i; if (groundStand(c)) { level[c] = G0; push(c); } }
      for (let k = 1; k < H - 1; k++) for (const i of [0, W - 1]) { const c = k * W + i; if (groundStand(c)) { level[c] = G0; push(c); } }
    }
    const memo = new Map(); // (cell, candidate) -> standable
    // the highest floor of cell d the body can stand on, reached from a floor at f (NaN: none)
    const bestFrom = (d, f) => {
      let best = NaN;
      const b = d * CAP, ii = d % W, kk = (d - ii) / W;
      for (let q = 0; q < nc[d]; q++) {
        const y = cand[b + q];
        if (y > f + o.stepUp || y < f - o.drop || y <= G0 + .02 || (best === best && y <= best)) continue;
        const key = b + q; let ok = memo.get(key);
        if (ok === undefined) { ok = standable(ii, kk, y); memo.set(key, ok); }
        if (ok) best = y;
      }
      if (best !== best && G0 <= f + o.stepUp && G0 >= f - o.drop && groundStand(d)) best = G0;
      return best;
    };
    while (qh < qt) {
      const c = queue[qh++], f = level[c], i = c % W, k = (c - i) / W;
      for (const [di, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ii = i + di, kk = k + dk; if (ii < 0 || kk < 0 || ii >= W || kk >= H) continue;
        const d = kk * W + ii;
        let best = bestFrom(d, f);
        // the cells at a step's edge hold its riser and nosing (no floor there): step up over up to 0.4 m of them onto the
        // floor beyond, as long as what stands in them is part of the step (nothing above the floor stepped onto: a railing
        // or a wall is never stepped through)
        if (best !== best) {
          for (let n = 2; n <= Math.max(2, Math.round(.4 / g)); n++) {
            const i2 = ii + di * (n - 1), k2 = kk + dk * (n - 1); if (i2 < 0 || k2 < 0 || i2 >= W || k2 >= H) break;
            const e = k2 * W + i2, up = bestFrom(e, f);
            if (!(up === up && up > f + .03)) continue;
            const [t0, t1] = rangeMask(up + .2, up + o.band); let stepLike = true;
            for (let m = 0; m < n - 1 && stepLike; m++) { const cm = (kk + dk * m) * W + (ii + di * m); if (occAt(cm, t0, t1)) stepLike = false; }
            if (!stepLike) break;
            if (!(level[e] >= up - .005)) { for (let m = 0; m < n - 1; m++) { const cm = (kk + dk * m) * W + (ii + di * m); if (!(level[cm] >= up - .005)) level[cm] = up; } level[e] = up; push(e); }
            break;
          }
          continue;
        }
        if (!(level[d] >= best - .005)) { level[d] = best; push(d); }
      }
    }
    // walls: cells the walk never reaches with something solid at body height above the floor beside them (the highest one
    // reached within 0.2 m: a wall standing on a veranda counts from the veranda) or above the ground, or a floor top there.
    // Each wall belongs to that floor: a room tests it only there (a prop on a stage stops the body on the stage, not under it)
    const [gs0, gs1] = rangeMask(G0 + .15, G0 + o.band);
    const wall = new Uint8Array(N), LQ = .3, classes = new Map();
    for (let c = 0; c < N; c++) {
      if (level[c] === level[c]) continue;
      const i = c % W, k = (c - i) / W; let m = -Infinity;
      for (let dk = -2; dk <= 2; dk++) for (let di = -2; di <= 2; di++) { const ii = i + di, kk = k + dk; if (ii < 0 || kk < 0 || ii >= W || kk >= H) continue; const y = level[kk * W + ii]; if (y === y && y > m) m = y; }
      let hit = occAt(c, gs0, gs1) || (nc[c] && cand[c * CAP] > G0 + .15);
      if (!hit && m > G0 + .15) { const [a0, a1] = rangeMask(m + .15, m + o.band); hit = occAt(c, a0, a1); }
      if (!hit) continue;
      wall[c] = 1;
      const key = Math.round((m > -Infinity ? m : G0) / LQ);
      if (!classes.has(key)) classes.set(key, []); classes.get(key).push(c);
    }
    // widen the walls by about the body's half-width (the village tests the body's centre against them), then boxes on a 2-cell grid
    const IR = Math.max(0, Math.round(o.inflate / g)), wide = new Uint8Array(N), P = 2, W2 = Math.ceil(W / P), H2 = Math.ceil(H / P), blockers = [];
    const one = new Uint8Array(N), tmp = new Uint8Array(N), dil = new Uint8Array(N);
    for (const [key, cells] of classes) {
      one.fill(0); tmp.fill(0); dil.fill(0); for (const c of cells) one[c] = 1;
      if (IR) {
        for (let k = 0; k < H; k++) { let last = -1e9; for (let i = 0; i < W; i++) { if (one[k * W + i]) last = i; if (i - last <= IR) tmp[k * W + i] = 1; } last = 1e9; for (let i = W - 1; i >= 0; i--) { if (one[k * W + i]) last = i; if (last - i <= IR) tmp[k * W + i] = 1; } }
        for (let i = 0; i < W; i++) { let last = -1e9; for (let k = 0; k < H; k++) { if (tmp[k * W + i]) last = k; if (k - last <= IR) dil[k * W + i] = 1; } last = 1e9; for (let k = H - 1; k >= 0; k--) { if (tmp[k * W + i]) last = k; if (last - k <= IR) dil[k * W + i] = 1; } }
      } else dil.set(one);
      const w2 = new Int32Array(W2 * H2);
      for (let k = 0; k < H; k++) for (let i = 0; i < W; i++) if (dil[k * W + i]) { wide[k * W + i] = 1; w2[Math.floor(k / P) * W2 + Math.floor(i / P)] = 1; }
      for (const [i0, k0, i1, k1] of rects(w2, W2, H2, v => v === 1)) blockers.push([r2(x0 + i0 * g * P), r2(z0 + k0 * g * P), r2(x0 + (i1 + 1) * g * P), r2(z0 + (k1 + 1) * g * P), r2(key * LQ)]);
    }
    // floors as boxes: equal heights (5 cm) merged into rectangles
    const Q = .05, floorKey = new Int32Array(N).fill(-2147483648);
    let nFloor = 0;
    for (let c = 0; c < N; c++) {
      const y = level[c]; if (!(y === y && y > G0 + o.minFloor && y <= (o.maxFloor ?? Infinity))) continue;
      if (o.skipFloor) { const i = c % W, k = (c - i) / W; if (o.skipFloor(x0 + (i + .5) * g, z0 + (k + .5) * g, y)) continue; } // a room's own decks own that floor
      floorKey[c] = Math.round(y / Q); nFloor++;
    }
    const decks = rects(floorKey, W, H, v => v !== -2147483648).map(([i0, k0, i1, k1, v]) => [r2(x0 + i0 * g), r2(z0 + k0 * g), r2(x0 + (i1 + 1) * g), r2(z0 + (k1 + 1) * g), r2(v * Q)]);
    return { decks, blockers, cells: N, floorCells: nFloor, g, grid: { x0, z0, W, H }, _level: o.keepGrid ? level : undefined, _wall: o.keepGrid ? wide : undefined,
      _dbg: o.debug ? { cand, nc, CAP, occAt, rangeMask, standable } : undefined };
  }
  const r2 = v => Math.round(v * 100) / 100;
  // cover the cells whose value passes ok() with rectangles of one value each: always the largest one left (histogram
  // method), so floors and walls come out as a few big boxes; a few stray single cells are dropped (minCells)
  function rects(vals, W, H, ok, minCells = 2) {
    const out = [], byVal = new Map();
    for (let c = 0; c < W * H; c++) if (ok(vals[c])) { const v = vals[c]; if (!byVal.has(v)) byVal.set(v, []); byVal.get(v).push(c); }
    const mask = new Uint8Array(W * H), h = new Int32Array(W + 1), st = new Int32Array(W + 2), sh = new Int32Array(W + 2);
    for (const [v, cells] of byVal) {
      let left = cells.length; for (const c of cells) mask[c] = 1;
      let k0 = H, k1 = -1, i0 = W, i1 = -1; for (const c of cells) { const i = c % W, k = (c - i) / W; if (k < k0) k0 = k; if (k > k1) k1 = k; if (i < i0) i0 = i; if (i > i1) i1 = i; }
      while (left > 0) {
        let best = 0, bi0 = 0, bk0 = 0, bi1 = -1, bk1 = -1;
        h.fill(0);
        for (let k = k0; k <= k1; k++) {
          for (let i = i0; i <= i1; i++) h[i] = mask[k * W + i] ? h[i] + 1 : 0;
          let top = 0;
          for (let i = i0; i <= i1 + 1; i++) {
            const hh = i <= i1 ? h[i] : 0; let start = i;
            while (top > 0 && sh[top - 1] >= hh) {
              top--; const s0 = st[top], height = sh[top], area = height * (i - s0);
              if (area > best) { best = area; bi0 = s0; bi1 = i - 1; bk1 = k; bk0 = k - height + 1; }
              start = s0;
            }
            st[top] = start; sh[top] = hh; top++;
          }
        }
        if (best < minCells) break;
        for (let k = bk0; k <= bk1; k++) for (let i = bi0; i <= bi1; i++) mask[k * W + i] = 0;
        left -= best; out.push([bi0, bk0, bi1, bk1, v]);
      }
      for (const c of cells) mask[c] = 0;
    }
    return out;
  }
  root.WalkGen = { fromTriangles, DEF };
})(typeof window !== 'undefined' ? window : globalThis);
