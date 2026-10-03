// Samurai building kit (Oct 2026). Designed in Blender (work/sam/models.py); this file builds the same low-poly
// shapes in the browser, so no model files are downloaded. Each building type is built once into a hidden template
// (one mesh per material) and every placed copy is a set of instances of it: cheap to draw, cheap to place.
// Doorways are lit recesses; link a room by adding a Door (admin > Doors) in front of one.
/* global BABYLON */
(function () {
  const TILE = { roof: [1.6, 1.4], wood: [1.6, 1.6], darkwood: [1.6, 1.6], plaster: [3, 3], stone: [2.4, 2.4], thatch: [2, 1.6], bark: [1.4, 1.6], earth: [4, 4], shoji: [1.2, 1.5] };
  const tileOf = m => TILE[m] || [1, 1];

  // ── textures (drawn once on small canvases) ─────────────────────────────
  function rng(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
  function noise(S, scale, oct, seed) {
    const r = rng(seed * 977 + 13), out = new Float32Array(S * S); let mx = 0;
    for (let o = 0; o < oct; o++) {
      const n = Math.max(2, Math.round(scale * 2 ** o)), g = new Float32Array(n * n); for (let i = 0; i < g.length; i++) g[i] = r();
      const amp = 1 / 2 ** o;
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const fx = x / S * n, fy = y / S * n, ix = Math.floor(fx), iy = Math.floor(fy), u = fx - ix, v = fy - iy, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
        const a = g[(iy % n) * n + ix % n], b = g[(iy % n) * n + (ix + 1) % n], c = g[((iy + 1) % n) * n + ix % n], d = g[((iy + 1) % n) * n + (ix + 1) % n];
        out[y * S + x] += amp * ((a * (1 - su) + b * su) * (1 - sv) + (c * (1 - su) + d * su) * sv);
      }
    }
    for (const v of out) mx = Math.max(mx, v); for (let i = 0; i < out.length; i++) out[i] /= mx; return out;
  }
  function pixelTex(scene, name, S, fn) {
    const t = new BABYLON.DynamicTexture('samKit_' + name, { width: S, height: S }, scene, true), ctx = t.getContext(), img = ctx.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const c = fn(x / S, y / S, y * S + x), k = (y * S + x) * 4; img.data[k] = c[0]; img.data[k + 1] = c[1]; img.data[k + 2] = c[2]; img.data[k + 3] = 255; }
    ctx.putImageData(img, 0, 0); t.update(); t.wrapU = t.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE; return t;
  }
  const mul = (c, f) => [c[0] * f, c[1] * f, c[2] * f];
  function makeTextures(scene) {
    const S = 256, T = {};
    let n = noise(S, 4, 4, 1);
    T.roof = pixelTex(scene, 'roof', S, (x, y, i) => { const col = (x * 8) % 1, row = (y * 6) % 1; let f = (.55 + .45 * Math.sin(col * Math.PI)) * (Math.min(1, row / .18) * .35 + .65) * (.85 + .3 * n[i]); if (col < .04 || col > .96) f *= .45; return mul([52, 58, 66], f); });
    const gr = noise(S, 3, 4, 2);
    T.wood = pixelTex(scene, 'wood', S, (x, y, i) => { const st = Math.sin(x * 200 + gr[i] * 6) * .5 + .5; let f = .75 + .18 * st + .12 * gr[i]; if ((x * 5) % 1 < .03) f *= .45; return mul([96, 62, 38], f); });
    T.darkwood = pixelTex(scene, 'darkwood', S, (x, y, i) => { const st = Math.sin(x * 200 + gr[i] * 6) * .5 + .5; let f = .75 + .18 * st + .12 * gr[i]; if ((x * 5) % 1 < .03) f *= .45; return mul([43, 26, 15], f); });
    n = noise(S, 6, 4, 3); T.plaster = pixelTex(scene, 'plaster', S, (x, y, i) => mul([226, 214, 190], .9 + .1 * n[i]));
    const sn = noise(S, 8, 4, 4), r = rng(5), rows = 5, blocks = [];
    for (let ri = 0; ri < rows; ri++) { let xx = ri % 2 ? -(10 + r() * 50) : 0; while (xx < S) { const bw = 40 + r() * 50, c = 105 + r() * 45; blocks.push([xx, ri * S / rows, bw, c]); xx += bw; } }
    T.stone = pixelTex(scene, 'stone', S, (x, y, i) => {
      const px = x * S, py = y * S, ri = Math.floor(py / (S / rows)), ry = py - ri * S / rows; let c = 70;
      for (const b of blocks) { if (Math.floor(b[1] / (S / rows)) !== ri) continue; for (const dx of [-S, 0, S]) { const bx = px - b[0] - dx; if (bx > 2 && bx < b[2] - 2 && ry > 2 && ry < S / rows - 2) c = b[3]; } }
      return mul([c, c - 3, c - 9], .85 + .25 * sn[i]);
    });
    const tn = noise(S, 3, 4, 6); T.thatch = pixelTex(scene, 'thatch', S, (x, y, i) => { let f = .6 + .3 * (Math.sin(x * S * .9 + tn[i] * 20) * .5 + .5) + .2 * tn[i]; if ((y * 7) % 1 < .06) f *= .6; return mul([150, 118, 62], f); });
    const bn = noise(S, 3, 4, 8); T.bark = pixelTex(scene, 'bark', S, (x, y, i) => mul([88, 64, 44], .65 + .25 * (Math.sin(x * S * .5 + bn[i] * 14) * .5 + .5) + .15 * bn[i]));
    const en = noise(S, 5, 4, 9); T.earth = pixelTex(scene, 'earth', S, (x, y, i) => mul([104, 76, 50], .7 + .4 * en[i]));
    T.shoji = pixelTex(scene, 'shoji', S, (x, y) => ((x * 4) % 1 < .06 || (y * 5) % 1 < .06) ? [70, 48, 30] : [240, 226, 190]);
    T.banner_red = bannerTex(scene, 'red', '#961816', '#ecd6aa', 'ant');
    T.banner_navy = bannerTex(scene, 'navy', '#222c48', '#e6dec8', 'books');
    T.banner_gold = bannerTex(scene, 'gold', '#ba8026', '#faecc8', 'hammer');
    return T;
  }
  function bannerTex(scene, name, bg, fg, icon) {
    const W = 256, H = 512, t = new BABYLON.DynamicTexture('samKit_banner_' + name, { width: W, height: H }, scene, true), c = t.getContext();
    c.fillStyle = bg; c.fillRect(0, 0, W, H); c.strokeStyle = '#c9a452'; c.lineWidth = 6; c.strokeRect(13, 13, W - 26, H - 26);
    c.fillStyle = fg; c.strokeStyle = fg; c.lineCap = 'round';
    if (icon === 'ant') {
      const cx = W / 2, cy = H * .5, s = 200;
      for (const [dy, rx, ry] of [[-.3, .11, .1], [0, .09, .13], [.36, .17, .24]]) { c.beginPath(); c.ellipse(cx, cy + dy * s, rx * s, ry * s, 0, 0, 7); c.fill(); }
      c.lineWidth = 7;
      for (const sd of [-1, 1]) {
        for (const [y0, x1, y1, x2, y2] of [[-.05, .28, -.22, .42, -.32], [0, .32, .05, .46, .18], [.05, .28, .28, .38, .46]]) { c.beginPath(); c.moveTo(cx, cy + y0 * s); c.lineTo(cx + sd * x1 * s, cy + y1 * s); c.lineTo(cx + sd * x2 * s, cy + y2 * s); c.stroke(); }
        c.beginPath(); c.moveTo(cx + sd * .04 * s, cy - .38 * s); c.lineTo(cx + sd * .16 * s, cy - .58 * s); c.lineTo(cx + sd * .3 * s, cy - .62 * s); c.stroke();
      }
    } else if (icon === 'books') {
      c.lineWidth = 6; for (const [yy, ww] of [[300, 150], [250, 170], [200, 140]]) { c.strokeRect(W / 2 - ww / 2, yy, ww, 40); c.beginPath(); c.moveTo(W / 2 - ww / 2 + 14, yy + 20); c.lineTo(W / 2 + ww / 2 - 14, yy + 20); c.stroke(); }
    } else { c.fillRect(W / 2 - 12, 170, 24, 210); c.fillRect(W / 2 - 70, 150, 140, 55); }
    t.update(); t.hasAlpha = false; return t;
  }

  // ── materials ───────────────────────────────────────────────────────────
  const MAT = {
    roof: { tex: 'roof' }, wood: { tex: 'wood' }, darkwood: { tex: 'darkwood' }, plaster: { tex: 'plaster' }, stone: { tex: 'stone' },
    thatch: { tex: 'thatch' }, bark: { tex: 'bark' }, earth: { tex: 'earth' }, shoji: { tex: 'shoji', em: [.5, .38, .2] },
    red: { col: [.55, .06, .05] }, gold: { col: [.85, .62, .22], spec: [.9, .75, .4], power: 40 }, dark: { col: [.03, .02, .015] },
    interior: { col: [.1, .06, .03], em: [.45, .25, .1] }, lantern: { col: [.9, .25, .08], em: [.95, .3, .1] }, fire: { col: [1, .5, .1], em: [1, .45, .08] },
    cloth: { col: [.6, .09, .07] }, rope: { col: [.62, .5, .32] }, iron: { col: [.12, .12, .13], spec: [.5, .5, .55], power: 48 }, water: { col: [.05, .12, .14], spec: [.8, .8, .8], power: 90 },
    banner_red: { tex: 'banner_red' }, banner_navy: { tex: 'banner_navy' }, banner_gold: { tex: 'banner_gold' },
    glow: { glow: [.95, .5, .16] } // soft pool of lantern light on the ground (night only)
  };
  let TEX = null; const MATS = {};
  function glowTex(scene) {
    const S = 128, t = new BABYLON.DynamicTexture('samKit_glowTex', { width: S, height: S }, scene, true), c = t.getContext();
    const g = c.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.35, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, S, S); t.hasAlpha = true; t.update(); return t;
  }
  function material(scene, name) {
    if (MATS[name] && !MATS[name].isDisposed?.()) return MATS[name];
    TEX = TEX || makeTextures(scene);
    const d = MAT[name];
    if (d.glow) {
      const m = new BABYLON.StandardMaterial('samKit_' + name, scene), tx = glowTex(scene);
      m.diffuseColor = BABYLON.Color3.Black(); m.specularColor = BABYLON.Color3.Black(); m.disableLighting = true;
      m.emissiveColor = new BABYLON.Color3(...d.glow); m.emissiveTexture = tx; m.opacityTexture = tx;
      m.alphaMode = BABYLON.Engine.ALPHA_ADD; m.alpha = 0; m.backFaceCulling = false; m.zOffset = -2; m.disableDepthWrite = true;
      m.metadata = { kitGlow: true };
      MATS[name] = m; setLightFactor(); return m;
    }
    const m = new BABYLON.StandardMaterial('samKit_' + name, scene);
    if (d.tex) m.diffuseTexture = TEX[d.tex]; else m.diffuseColor = new BABYLON.Color3(...d.col);
    m.specularColor = new BABYLON.Color3(...(d.spec || [.04, .04, .04])); m.specularPower = d.power || 16;
    if (d.em) m.emissiveColor = new BABYLON.Color3(...d.em);
    m.backFaceCulling = false; m.twoSidedLighting = true; m.maxSimultaneousLights = 4;
    if (d.em) m.metadata = { kitBaseEmissive: m.emissiveColor.clone() }; // brightened at night: left unfrozen
    else m.freeze();
    MATS[name] = m; if (d.em) setLightFactor(); return m;
  }
  // Time of day + weather light factor from the village (.04 bright day ... 1 night, up to 1.25 in storms):
  // lit windows, doorways and lanterns glow softly by day and fully at night; lantern ground pools only show at night.
  let lightFactor = .04;
  function setLightFactor(f) {
    lightFactor = Number.isFinite(f) ? f : lightFactor;
    const k = Math.min(1, Math.max(0, lightFactor)), em = .6 + .7 * k, pool = Math.min(1, Math.max(0, (lightFactor - .15) / .6));
    for (const m of Object.values(MATS)) {
      if (!m || m.isDisposed?.()) continue;
      if (m.metadata?.kitBaseEmissive) m.emissiveColor = m.metadata.kitBaseEmissive.scale(em);
      if (m.metadata?.kitGlow) m.alpha = .7 * pool;
    }
  }

  // ── geometry builder (Blender coordinates: z up, fronts face -y) ────────
  // Converted to Babylon on output: (x, y, z) -> (x, z, y).
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  function rotZYX(rz, ry, rx) {
    const cz = Math.cos(rz), sz = Math.sin(rz), cy = Math.cos(ry), sy = Math.sin(ry), cx = Math.cos(rx), sx = Math.sin(rx);
    const Rz = [[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]], Ry = [[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]], Rx = [[1, 0, 0], [0, cx, -sx], [0, sx, cx]];
    const m = (A, B) => A.map((r, i) => [0, 1, 2].map(j => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
    return m(m(Rz, Ry), Rx);
  }
  const app = (R, v) => [R[0][0] * v[0] + R[0][1] * v[1] + R[0][2] * v[2], R[1][0] * v[0] + R[1][1] * v[1] + R[1][2] * v[2], R[2][0] * v[0] + R[2][1] * v[1] + R[2][2] * v[2]];

  class Kit {
    constructor() { this.parts = {}; }
    part(m) { return this.parts[m] || (this.parts[m] = { p: [], n: [], uv: [], i: [] }); }
    poly(m, pts, uvs, nrm) {
      const P = this.part(m), base = P.p.length / 3;
      let nn = nrm;
      if (!nrm) { // Newell normal (robust for any planar polygon)
        let a = [0, 0, 0]; for (let k = 0; k < pts.length; k++) { const c = pts[k], d = pts[(k + 1) % pts.length]; a[0] += (c[1] - d[1]) * (c[2] + d[2]); a[1] += (c[2] - d[2]) * (c[0] + d[0]); a[2] += (c[0] - d[0]) * (c[1] + d[1]); }
        nn = norm(a);
      }
      const [tu, tv] = tileOf(m), ax = Math.abs(nn[0]) > Math.abs(nn[1]) ? (Math.abs(nn[0]) > Math.abs(nn[2]) ? 0 : 2) : (Math.abs(nn[1]) > Math.abs(nn[2]) ? 1 : 2);
      pts.forEach((q, k) => {
        P.p.push(q[0], q[2], q[1]); P.n.push(nn[0], nn[2], nn[1]);
        if (uvs) P.uv.push(uvs[k][0], uvs[k][1]);
        else if (ax === 2) P.uv.push(q[0] / tu, q[1] / tv); else if (ax === 0) P.uv.push(q[1] / tu, q[2] / tv); else P.uv.push(q[0] / tu, q[2] / tv);
      });
      for (let k = 1; k < pts.length - 1; k++) P.i.push(base, base + k, base + k + 1);
    }
    box(m, c, s, rz = 0, rx = 0, ry = 0) {
      const R = rotZYX(rz, ry, rx), V = (x, y, z) => { const v = app(R, [x * s[0], y * s[1], z * s[2]]); return [v[0] + c[0], v[1] + c[1], v[2] + c[2]]; };
      const F = [[[1, 0, 0], [[.5, -.5, -.5], [.5, .5, -.5], [.5, .5, .5], [.5, -.5, .5]]], [[-1, 0, 0], [[-.5, .5, -.5], [-.5, -.5, -.5], [-.5, -.5, .5], [-.5, .5, .5]]],
        [[0, 1, 0], [[.5, .5, -.5], [-.5, .5, -.5], [-.5, .5, .5], [.5, .5, .5]]], [[0, -1, 0], [[-.5, -.5, -.5], [.5, -.5, -.5], [.5, -.5, .5], [-.5, -.5, .5]]],
        [[0, 0, 1], [[-.5, -.5, .5], [.5, -.5, .5], [.5, .5, .5], [-.5, .5, .5]]], [[0, 0, -1], [[-.5, .5, -.5], [.5, .5, -.5], [.5, -.5, -.5], [-.5, -.5, -.5]]]];
      for (const [n, q] of F) this.poly(m, q.map(p => V(...p)), null, norm(app(R, n)));
    }
    block(m, x, y, z0, sx, sy, sz, rz = 0) { this.box(m, [x, y, z0 + sz / 2], [sx, sy, sz], rz); }
    ring(c, ax, r, segs) { // points of a circle around axis ax (unit) at centre c
      const t = Math.abs(ax[2]) < .9 ? [0, 0, 1] : [1, 0, 0], u = norm(cross(ax, t)), v = cross(ax, u), out = [];
      for (let k = 0; k < segs; k++) { const a = k / segs * Math.PI * 2; out.push([c[0] + r * (Math.cos(a) * u[0] + Math.sin(a) * v[0]), c[1] + r * (Math.cos(a) * u[1] + Math.sin(a) * v[1]), c[2] + r * (Math.cos(a) * u[2] + Math.sin(a) * v[2])]); }
      return out;
    }
    tube(m, a, b, r1, r2, segs, cap = true) {
      const ax = norm(sub(b, a)), A = this.ring(a, ax, r1, segs), B = this.ring(b, ax, r2, segs);
      for (let k = 0; k < segs; k++) { const k2 = (k + 1) % segs; this.poly(m, [A[k], A[k2], B[k2], B[k]]); }
      if (cap) { this.poly(m, A.slice().reverse()); if (r2 > .001) this.poly(m, B); }
    }
    cyl(m, p, r, h, segs = 8, r2 = null) { this.tube(m, [p[0], p[1], p[2]], [p[0], p[1], p[2] + h], r, r2 == null ? r : r2, segs); }
    rod(m, a, b, r, segs = 6) { this.tube(m, a, b, r, r, segs); }
    sphere(m, c, r, sz = 1, segs = 10, rings = 6) {
      const P = (i, j) => { const th = Math.PI * i / rings, ph = 2 * Math.PI * j / segs; return [c[0] + r * Math.sin(th) * Math.cos(ph), c[1] + r * Math.sin(th) * Math.sin(ph), c[2] + r * sz * Math.cos(th)]; };
      for (let i = 0; i < rings; i++) for (let j = 0; j < segs; j++) this.poly(m, [P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)].filter((q, k, arr) => k === 0 || Math.hypot(...sub(q, arr[k - 1])) > 1e-6));
    }
    quad(m, pts, uvs = [[0, 0], [1, 0], [1, 1], [0, 1]]) { this.poly(m, pts, uvs); }
    grid(m, P, U) { for (let i = 0; i < P.length - 1; i++) for (let j = 0; j < P[0].length - 1; j++) this.poly(m, [P[i][j], P[i][j + 1], P[i + 1][j + 1], P[i + 1][j]], [U[i][j], U[i][j + 1], U[i + 1][j + 1], U[i + 1][j]]); }
    // Japanese hip roof: sagging slopes, upturned corners, ridge beam, small gables, gold end ornaments
    roof(cx, cy, z, w, d, h, o = {}) {
      const lift = o.lift ?? .6, mat = o.mat || 'roof', fascia = o.fascia || 'wood', n = 10, m = 5;
      const hw0 = w / 2, hd0 = d / 2, L = Math.max(.2, (w - d) / 2 + d * .12), [tu, tv] = tileOf(mat), sl = Math.hypot(hd0, h);
      const ring = t => [hw0 * (1 - t) + L * t, hd0 * (1 - t) + d * .02 * t, z + h * t ** 1.35];
      for (const [[ax, ay], [ox, oy]] of [[[1, 0], [0, -1]], [[0, 1], [1, 0]], [[-1, 0], [0, 1]], [[0, -1], [-1, 0]]]) {
        const P = [], U = [];
        for (let i = 0; i <= m; i++) {
          const t = i / m, [hw, hd, zz] = ring(t), span = ax ? hw : hd, depth = ax ? hd : hw, row = [], urow = [];
          for (let j = 0; j <= n; j++) { const u = -1 + 2 * j / n; row.push([cx + ax * u * span + ox * depth, cy + ay * u * span + oy * depth, zz + lift * Math.abs(u) ** 3 * (1 - t) ** 1.5]); urow.push([u * span / tu, t * sl / tv]); }
          P.push(row); U.push(urow);
        }
        this.grid(mat, P, U);
        const [hw, hd, zz] = ring(0), span = ax ? hw : hd, depth = ax ? hd : hw;
        for (let j = 0; j < n; j++) {
          const u0 = -1 + 2 * j / n, u1 = -1 + 2 * (j + 1) / n;
          const p0 = [cx + ax * u0 * span + ox * depth, cy + ay * u0 * span + oy * depth, zz + lift * Math.abs(u0) ** 3], p1 = [cx + ax * u1 * span + ox * depth, cy + ay * u1 * span + oy * depth, zz + lift * Math.abs(u1) ** 3];
          this.quad(fascia, [[p0[0], p0[1], p0[2] - .35], [p1[0], p1[1], p1[2] - .35], p1, p0]);
        }
      }
      const [hwT, hdT, zT] = ring(1);
      this.box(o.ridge || 'darkwood', [cx, cy, zT + .25], [2 * hwT + .6, Math.max(.5, 2 * hdT + .4), .5]);
      if (o.gable !== false) for (const s of [-1, 1]) { const gx = cx + s * (hwT + .05); this.poly('darkwood', [[gx, cy - d * .18, zT - h * .22], [gx, cy + d * .18, zT - h * .22], [gx, cy, zT + .45]]); }
      if (o.ornaments !== false) for (const s of [-1, 1]) this.cyl('gold', [cx + s * (hwT + .2), cy, zT + .45], .22, .9, 6, .05);
    }
  }

  // ── shared pieces ───────────────────────────────────────────────────────
  function lantern(M, x, y, z, r = .3) {
    M.cyl('lantern', [x, y, z - .6], r, .6, 8); M.cyl('darkwood', [x, y, z - .05], r * .75, .08, 8); M.cyl('darkwood', [x, y, z - .68], r * .75, .08, 8);
    M.rod('rope', [x, y, z], [x, y, z + .6], .02, 4);
  }
  function banner(M, x, y, ztop, w, h, mat, face = -1) {
    const yy = y + face * .02;
    let pts = [[x - w / 2, yy, ztop - h], [x + w / 2, yy, ztop - h], [x + w / 2, yy, ztop], [x - w / 2, yy, ztop]];
    M.quad(mat, pts);
    M.rod('darkwood', [x - w / 2 - .15, yy + face * .05, ztop + .05], [x + w / 2 + .15, yy + face * .05, ztop + .05], .05, 6);
  }
  function recess(M, x, y, z0, w, h, depth, face = -1) {
    const yb = y - face * depth;
    M.quad('interior', [[x - w / 2, yb, z0], [x + w / 2, yb, z0], [x + w / 2, yb, z0 + h], [x - w / 2, yb, z0 + h]]);
    M.quad('interior', [[x - w / 2, y, z0], [x - w / 2, yb, z0], [x - w / 2, yb, z0 + h], [x - w / 2, y, z0 + h]]);
    M.quad('interior', [[x + w / 2, yb, z0], [x + w / 2, y, z0], [x + w / 2, y, z0 + h], [x + w / 2, yb, z0 + h]]);
    M.quad('interior', [[x - w / 2, y, z0 + h], [x + w / 2, y, z0 + h], [x + w / 2, yb, z0 + h], [x - w / 2, yb, z0 + h]]);
    M.quad('darkwood', [[x - w / 2, y, z0 + .01], [x + w / 2, y, z0 + .01], [x + w / 2, yb, z0 + .01], [x - w / 2, yb, z0 + .01]]);
  }
  function walls(M, cx, cy, z0, w, d, h, o = {}) {
    const door = o.door, doorSide = o.doorSide || 'front', windows = o.windows || [], step = o.postStep || 3.2, wall = 'plaster', t = .3;
    const sides = { front: [cy - d / 2, 'x'], back: [cy + d / 2, 'x'], left: [cx - w / 2, 'y'], right: [cx + w / 2, 'y'] };
    for (const [name, [c, ax]] of Object.entries(sides)) {
      const L = ax === 'x' ? w : d;
      if (door && name === doorSide) {
        const [dw, dh] = door, seg = (L - dw) / 2;
        for (const s of [-1, 1]) { const off = s * (dw / 2 + seg / 2); if (ax === 'x') M.block(wall, cx + off, c, z0, seg, t, h); else M.block(wall, c, cy + off, z0, t, seg, h); }
        if (ax === 'x') M.block(wall, cx, c, z0 + dh, dw, t, h - dh); else M.block(wall, c, cy, z0 + dh, t, dw, h - dh);
        const fx = name === 'front' || name === 'left' ? -1 : 1;
        if (ax === 'x') { recess(M, cx, c, z0, dw, dh, 1.6, fx); for (const s of [-1, 1]) M.block('darkwood', cx + s * (dw / 2 + .12), c + fx * .2, z0, .24, .2, dh + .2); M.block('darkwood', cx, c + fx * .2, z0 + dh, dw + .5, .2, .25); }
      } else if (ax === 'x') M.block(wall, cx, c, z0, L, t, h); else M.block(wall, c, cy, z0, t, L, h);
      const n = Math.max(1, Math.round(L / step));
      for (let i = 0; i <= n; i++) {
        const u = -L / 2 + L * i / n;
        if (door && name === doorSide && Math.abs(u) < door[0] / 2 + .4) continue;
        if (ax === 'x') M.block('wood', cx + u, c, z0, .38, t + .14, h); else M.block('wood', c, cy + u, z0, t + .14, .38, h);
      }
      for (const zz of [z0, z0 + h * .62, z0 + h - .25]) { if (ax === 'x') M.block('wood', cx, c, zz, L + .2, t + .1, .25); else M.block('wood', c, cy, zz, t + .1, L + .2, .25); }
    }
    for (const [side, off, zw, ww, wh] of windows) {
      const [c, ax] = sides[side], fx = side === 'front' || side === 'left' ? -1 : 1, p = c + fx * (t / 2 + .03), uv = [[0, 0], [ww / 1.2, 0], [ww / 1.2, wh / 1.5], [0, wh / 1.5]];
      if (ax === 'x') { M.quad('shoji', [[cx + off - ww / 2, p, zw], [cx + off + ww / 2, p, zw], [cx + off + ww / 2, p, zw + wh], [cx + off - ww / 2, p, zw + wh]], uv); M.box('darkwood', [cx + off, p, zw - .05], [ww + .2, .12, .12]); M.box('darkwood', [cx + off, p, zw + wh + .05], [ww + .2, .12, .12]); }
      else { M.quad('shoji', [[p, cy + off + ww / 2, zw], [p, cy + off - ww / 2, zw], [p, cy + off - ww / 2, zw + wh], [p, cy + off + ww / 2, zw + wh]], uv); M.box('darkwood', [p, cy + off, zw - .05], [.12, ww + .2, .12]); M.box('darkwood', [p, cy + off, zw + wh + .05], [.12, ww + .2, .12]); }
    }
  }
  function steps(M, cx, yEdge, zTop, width, n, tread = .45) { for (let i = 0; i < n; i++) M.block('stone', cx, yEdge - (i + .5) * tread, 0, width, tread, zTop - i * zTop / n); }

  // ── buildings ───────────────────────────────────────────────────────────
  const B = {
    sam_great_dojo(M) {
      const W = 22, D = 15;
      M.block('stone', 0, 0, 0, W + 2, D + 2, 1.2); steps(M, 0, -(D + 2) / 2, 1.2, 8, 4); M.block('wood', 0, 0, 1.2, W + 1, D + 1, .15);
      walls(M, 0, .6, 1.35, W - 4, D - 4, 5.6, { door: [6, 4.2], windows: [['left', -2, 3, 3.5, 2], ['left', 2.5, 3, 3.5, 2], ['right', -2, 3, 3.5, 2], ['right', 2.5, 3, 3.5, 2], ['back', -5, 3, 3.5, 2], ['back', 5, 3, 3.5, 2]] });
      for (let i = 0; i < 6; i++) { const x = -W / 2 + .6 + i * (W - 1.2) / 5; M.cyl('red', [x, -D / 2 + .2, 1.35], .3, 5.7, 10); M.cyl('stone', [x, -D / 2 + .2, 1.35], .42, .3, 8); }
      for (const s of [-1, 1]) M.cyl('red', [s * (W / 2 - .6), D / 2 - .2, 1.35], .3, 5.7, 10);
      M.box('red', [0, -D / 2 + .2, 6.55], [W, .4, .4]);
      M.roof(0, .3, 6.95, W + 4, D + 4, 2.4, { lift: .9, gable: false, ornaments: false });
      walls(M, 0, .6, 8.3, 14, 7, 2.6, { windows: [['front', -4, 8.9, 3, 1.4], ['front', 0, 8.9, 3, 1.4], ['front', 4, 8.9, 3, 1.4]], postStep: 3.5 });
      M.roof(0, .6, 10.85, 19, 12, 4.4, { lift: 1.3 });
      for (const s of [-1, 1]) banner(M, s * 6.2, -D / 2 + 1.75, 6.6, 2.8, 4.9, 'banner_red');
      for (const x of [-9, -4.5, 4.5, 9]) lantern(M, x, -D / 2 - .4, 6.75);
      M.block('gold', 0, .6 - 3.5 - .2, 10.15, 2.6, .1, .5);
    },
    sam_library(M) {
      const W = 13, D = 9;
      M.block('stone', 0, 0, 0, W + 1.4, D + 1.4, .8); steps(M, 0, -(D + 1.4) / 2, .8, 4, 3);
      walls(M, 0, 0, .8, W, D, 4.6, { door: [3, 3.2], windows: [['front', -4, 1.8, 2.4, 1.8], ['front', 4, 1.8, 2.4, 1.8], ['left', 0, 1.8, 3, 1.8], ['right', 0, 1.8, 3, 1.8]] });
      M.roof(0, 0, 5.3, W + 3.4, D + 3.4, 3.6, { lift: .9 });
      for (const s of [-1, 1]) banner(M, s * 2.4, -D / 2 - .18, 4.9, 1.3, 3, 'banner_navy');
      for (const s of [-1, 1]) lantern(M, s * 5.6, -D / 2 - 1.2, 5.2);
      M.block('wood', -5.2, -D / 2 - 1.6, 0, 1.1, .8, .7); M.block('wood', -4.9, -D / 2 - 1.5, .7, .8, .6, .5);
      for (let i = 0; i < 3; i++) M.rod('plaster', [-6.1, -D / 2 - 1.3 + i * .25, .35], [-5.2, -D / 2 - 1.3 + i * .25, .35], .11, 6);
    },
    sam_forge(M) {
      const W = 10, D = 8;
      M.block('stone', 0, 0, 0, W, D, .3);
      for (const x of [-W / 2 + .3, 0, W / 2 - .3]) for (const y of [-D / 2 + .3, D / 2 - .3]) M.block('wood', x, y, .3, .4, .4, 4.2);
      M.block('wood', 0, D / 2 - .3, .3, W, .3, 4.2); M.block('wood', -W / 2 + .3, 1, .3, .3, D / 2, 4.2);
      for (const y of [-D / 2 + .3, D / 2 - .3]) M.block('wood', 0, y, 4.3, W + .3, .4, .35);
      M.roof(0, 0, 4.5, W + 3, D + 3, 3.4, { lift: .35, mat: 'thatch', fascia: 'darkwood', ornaments: false });
      M.block('stone', W / 2 - 1.8, D / 2 - 1.6, .3, 2.6, 2.4, 2);
      M.quad('fire', [[W / 2 - 2.6, D / 2 - 2.81, .7], [W / 2 - 1, D / 2 - 2.81, .7], [W / 2 - 1, D / 2 - 2.81, 1.6], [W / 2 - 2.6, D / 2 - 2.81, 1.6]]);
      M.block('stone', W / 2 - 1.8, D / 2 - 1.2, 2.3, 1.4, 1.4, 7.4);
      M.block('iron', -.5, -.6, .3, 1, .5, .45); M.block('iron', -.5, -.6, .75, 1.3, .45, .25);
      M.cyl('water', [1.6, -1.8, .3], .5, .7, 10); M.cyl('darkwood', [1.6, -1.8, .3], .55, .08, 10);
      for (let i = 0; i < 4; i++) M.rod('iron', [-W / 2 + .7 + i * .35, 1.5, .4], [-W / 2 + .7 + i * .35, 1.5, 2.4], .04, 4);
      for (const s of [-1, 1]) banner(M, s * 2.5, -D / 2 + .1, 4.2, 1.1, 2.4, 'banner_gold');
    },
    sam_market_stall(M) {
      const W = 5, D = 3;
      for (const x of [-W / 2 + .15, W / 2 - .15]) for (const y of [-D / 2 + .15, D / 2 - .15]) M.block('wood', x, y, 0, .2, .2, y < 0 ? 2.9 : 2.4);
      M.block('wood', 0, -D / 2 + .5, 0, W - .3, .9, 1); M.block('darkwood', 0, -D / 2 + .5, 1, W - .1, 1, .1);
      M.quad('cloth', [[-W / 2 - .3, -D / 2 - .6, 2.75], [W / 2 + .3, -D / 2 - .6, 2.75], [W / 2 + .3, D / 2 + .2, 2.45], [-W / 2 - .3, D / 2 + .2, 2.45]]);
      for (let i = 0; i < 6; i++) { const x0 = -W / 2 - .3 + i * (W + .6) / 6, s = (W + .6) / 6; M.poly('cloth', [[x0, -D / 2 - .6, 2.75], [x0 + s, -D / 2 - .6, 2.75], [x0 + s / 2, -D / 2 - .6, 2.4]]); }
      for (const [x, c] of [[-1.6, 'earth'], [-.6, 'red'], [.5, 'gold'], [1.5, 'earth']]) M.cyl(c, [x, -D / 2 + .5, 1.1], .28, .35, 8, .2);
      for (const [x, y] of [[-W / 2 - .7, .2], [W / 2 + .7, -.3]]) M.block('wood', x, y, 0, .8, .8, .7);
      M.cyl('wood', [W / 2 + .7, .9, 0], .38, .9, 10); M.cyl('darkwood', [W / 2 + .7, .9, .88], .4, .06, 10);
      M.block('wood', 0, D / 2 - .3, 0, W - .4, .6, 1.6); for (let i = 0; i < 4; i++) M.cyl('plaster', [-1.8 + i * 1.2, D / 2 - .3, 1.6], .2, .3, 8);
      lantern(M, -W / 2 + .2, -D / 2 - .45, 2.65, .22); lantern(M, W / 2 - .2, -D / 2 - .45, 2.65, .22);
    },
    sam_house(M) {
      const W = 9, D = 6.5;
      M.block('stone', 0, 0, 0, W + .8, D + .8, .5);
      walls(M, 0, 0, .5, W, D, 3.4, { door: [2.2, 2.6], windows: [['front', 2.8, 1.5, 1.8, 1.3], ['left', 0, 1.5, 2, 1.3], ['right', 0, 1.5, 2, 1.3]] });
      M.roof(0, 0, 3.9, W + 3, D + 3, 3.3, { lift: .4, mat: 'thatch', fascia: 'darkwood', ornaments: false });
      M.block('wood', 0, -D / 2 - .9, 0, W - 1, 1.4, .45); lantern(M, -1.7, -D / 2 - .6, 3.7, .22);
    },
    sam_gate(M) {
      const OW = 5, OH = 5.2;
      for (const s of [-1, 1]) { const x = s * (OW / 2 + 2.2); M.block('stone', x, 0, 0, 4.4, 3.6, 1.2); walls(M, x, 0, 1.2, 4, 3.2, 4.4, { postStep: 2 }); }
      for (const s of [-1, 1]) { M.cyl('red', [s * (OW / 2 + .25), -1, 0], .35, OH + .6, 10); M.cyl('red', [s * (OW / 2 + .25), 1, 0], .35, OH + .6, 10); M.block('darkwood', s * (OW / 2 - .1), -1.6, 0, .25, 2.4, OH - .2, s * .9); }
      M.box('red', [0, -1, OH + .3], [OW + 1.4, .45, .5]); M.box('red', [0, 1, OH + .3], [OW + 1.4, .45, .5]); M.block('darkwood', 0, 0, OH + .55, OW + 1.6, 2.6, .5);
      M.roof(0, 0, 6.3, OW + 11, 6, 2.6, { lift: .8 });
      for (const s of [-1, 1]) banner(M, s * (OW / 2 + 2.2), -1.65, 5.2, 1.5, 3.4, 'banner_red');
      for (const s of [-1, 1]) lantern(M, s * (OW / 2 + .2), -1.8, OH + .1);
      M.block('gold', 0, -1.26, OH + .2, 1.6, .08, .55);
    },
    sam_palisade(M) {
      const L = 8, n = 14; M.block('stone', 0, 0, 0, L, 1.3, 1.1);
      for (let i = 0; i < n; i++) { const x = -L / 2 + .29 + i * (L - .58) / (n - 1), h = 3.6 + .35 * Math.sin(i * 2.3); M.cyl('bark', [x, 0, 1], .28, h, 7); M.cyl('bark', [x, 0, 1 + h], .28, .7, 7, .02); }
      for (const z of [2.2, 3.7]) M.box('darkwood', [0, -.3, z], [L, .14, .22]);
    },
    sam_watchtower(M) {
      const H = 8.5, S = 3.6;
      M.block('stone', 0, 0, 0, S + 1.2, S + 1.2, .6);
      for (const x of [-S / 2, S / 2]) for (const y of [-S / 2, S / 2]) M.rod('wood', [x * 1.12, y * 1.12, .6], [x * .92, y * .92, H], .2, 6);
      for (const z of [3, 6]) { const f = 1.12 - .2 * z / H; for (const [a, b] of [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]]) M.rod('wood', [a[0] * S / 2 * f, a[1] * S / 2 * f, z], [b[0] * S / 2 * f, b[1] * S / 2 * f, z], .1, 5); }
      M.block('wood', 0, 0, H, S + .8, S + .8, .3);
      for (const [x, y, sx, sy] of [[0, -(S + .8) / 2, S + .8, .15], [0, (S + .8) / 2, S + .8, .15], [-(S + .8) / 2, 0, .15, S + .8], [(S + .8) / 2, 0, .15, S + .8]]) { M.block('plaster', x, y, H + .3, sx, sy, 1); M.block('wood', x, y, H + 1.3, sx + .1, sy + .1, .15); }
      for (const x of [-S / 2, S / 2]) for (const y of [-S / 2, S / 2]) M.block('wood', x * .92, y * .92, H + .3, .22, .22, 2.4);
      M.roof(0, 0, H + 2.7, S + 2.6, S + 2.6, 1.8, { lift: .5 });
      for (let i = 0; i < 10; i++) M.box('wood', [0, -S / 2 * 1.15 - .1, .8 + i * .8], [1, .08, .08]);
      for (const s of [-1, 1]) M.rod('wood', [s * .5, -S / 2 * 1.15 - .1, .6], [s * .5, -S / 2 * .95, H], .06, 4);
      banner(M, 0, -(S + .8) / 2 - .1, H + 1.25, 1.2, 1, 'banner_red'); lantern(M, S / 2, -S / 2, H + 2.55, .22);
    },
    sam_well(M) {
      M.cyl('stone', [0, 0, 0], 1.25, 1, 14); M.cyl('water', [0, 0, .2], 1, .78, 14);
      for (const s of [-1, 1]) M.block('wood', s * 1.2, 0, 0, .22, .22, 2.8);
      M.box('wood', [0, 0, 2.55], [2.7, .2, .2]); M.cyl('rope', [0, 0, 1.4], .03, 1.1, 4); M.cyl('darkwood', [0, 0, 1.1], .22, .3, 8);
      M.roof(0, 0, 2.75, 3.4, 2.2, 1, { lift: .3, ornaments: false });
      M.block('wood', 1.6, .6, 0, .5, .5, .5); M.cyl('wood', [-1.6, .5, 0], .25, .4, 8);
    },
    sam_burrow(M) {
      M.sphere('earth', [0, 1.4, 0], 4.2, .62, 16, 8);
      const n = 12, r = 1.55, zc = 1.55, pts = []; for (let i = 0; i <= n; i++) pts.push([Math.cos(Math.PI * i / n) * r, -2.45, zc + Math.sin(Math.PI * i / n) * r]);
      for (let i = 0; i < n; i++) { const a = pts[i], b = pts[i + 1]; M.poly('dark', [a, b, [0, a[1], zc]]); M.rod('wood', [a[0], a[1] - .05, a[2]], [b[0], b[1] - .05, b[2]], .16, 6); }
      M.quad('dark', [[-r, -2.45, 0], [r, -2.45, 0], [r, -2.45, zc], [-r, -2.45, zc]]);
      for (const s of [-1, 1]) M.block('wood', s * (r + .05), -2.5, 0, .3, .3, zc);
      M.quad('fire', [[-.35, -1, .5], [.35, -1, .5], [.35, -1, 1], [-.35, -1, 1]]);
      for (const s of [-1, 1]) { M.cyl('wood', [s * 2.3, -2.6, 0], .1, 2.1, 6); lantern(M, s * 2.3, -2.6, 2.05, .2); }
      M.block('stone', 0, -3, 0, 3.6, 1, .12);
    },
    sam_banner_pole(M) {
      M.cyl('darkwood', [0, 0, 0], .1, 6.8, 8); M.cyl('stone', [0, 0, 0], .45, .35, 8, .3);
      M.rod('darkwood', [0, .05, 6.4], [1.5, .05, 6.4], .05, 6);
      M.quad('banner_red', [[.1, -.02, 1.6], [1.45, -.02, 1.6], [1.45, -.02, 6.35], [.1, -.02, 6.35]]);
      M.cyl('gold', [0, 0, 6.8], .12, .35, 6, .02);
    },
    sam_training_post(M) {
      M.cyl('stone', [0, 0, 0], .55, .3, 8); M.cyl('wood', [0, 0, .3], .32, 2.3, 10);
      for (const z of [1, 1.55, 2.1]) M.cyl('rope', [0, 0, z], .35, .28, 10);
      for (const [z, a] of [[1.75, .5], [1.75, -.5], [1.2, 0]]) M.rod('wood', [0, 0, z], [Math.sin(a) * .8, -Math.cos(a) * .8, z - .1], .07, 6);
      M.cyl('wood', [0, 0, 2.6], .34, .12, 10);
    },
    sam_weapon_rack(M) {
      for (const s of [-1, 1]) M.block('darkwood', s * 1.2, 0, 0, .14, .5, 1.9);
      for (const z of [.5, 1.5]) M.box('darkwood', [0, 0, z], [2.6, .5, .1]);
      for (let i = 0; i < 6; i++) { const x = -1 + i * .4; M.rod('wood', [x, .05, .05], [x, -.05, 2.6], .035, 5); M.cyl('iron', [x, -.05, 2.55], .06, .35, 5, .005); }
    },
    // stone toro lantern for paths and stairs: the light box glows (no real light, so any number is cheap)
    sam_stone_lantern(M) {
      M.cyl('stone', [0, 0, 0], .5, .22, 6, .42); M.cyl('stone', [0, 0, .22], .17, 1.05, 6, .14);
      M.block('stone', 0, 0, 1.27, .78, .78, .14);
      M.block('lantern', 0, 0, 1.41, .46, .46, .48);
      for (const x of [-.25, .25]) for (const y of [-.25, .25]) M.block('stone', x, y, 1.41, .1, .1, .48);
      M.block('stone', 0, 0, 1.89, .7, .7, .1);
      M.cyl('stone', [0, 0, 1.99], .62, .38, 4, .05); M.sphere('stone', [0, 0, 2.42], .09, 1, 6, 4);
      M.quad('glow', [[-2.6, -2.6, .07], [2.6, -2.6, .07], [2.6, 2.6, .07], [-2.6, 2.6, .07]]);
    }
  };

  // ── templates + placement ───────────────────────────────────────────────
  const templates = {};
  let parkRoot = null;
  function template(scene, type) {
    const t = templates[type];
    if (t && t.every(m => !m.isDisposed())) return t;
    const M = new Kit(); B[type](M);
    parkRoot = parkRoot && !parkRoot.isDisposed() ? parkRoot : new BABYLON.TransformNode('samKitTemplates', scene);
    parkRoot.position.set(0, -10000, 0);
    const meshes = Object.entries(M.parts).map(([mat, P]) => {
      const m = new BABYLON.Mesh(`samKit_${type}_${mat}`, scene), vd = new BABYLON.VertexData();
      vd.positions = P.p; vd.normals = P.n; vd.uvs = P.uv; vd.indices = P.i; vd.applyToMesh(m);
      m.material = material(scene, mat); m.parent = parkRoot; m.isPickable = false; m.receiveShadows = true; m.metadata = { isKitTemplate: true };
      m.freezeNormals();
      return m;
    });
    return (templates[type] = meshes);
  }
  // Fill a placed root (from spawnAsset) with instances of the type's template meshes.
  function build(root, type, scene, shadows, skipShadows) {
    if (!B[type]) return false;
    for (const t of template(scene, type)) {
      const inst = t.createInstance(`${root.name}_${t.name.split('_').pop()}`), isGlow = !!t.material?.metadata?.kitGlow;
      inst.parent = root; inst.isPickable = !isGlow; inst._editRoot = root; inst.checkCollisions = false;
      if (shadows && !skipShadows && !isGlow) shadows.addShadowCaster(inst);
    }
    return true;
  }
  window.SamuraiKit = { build, setLightFactor, types: Object.keys(B), _Kit: Kit, _B: B };
})();
