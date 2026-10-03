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
    T.banner_red = bannerTex(scene, 'red', '#961816', '#ecd6aa', 'logo:samurai');
    T.banner_navy = bannerTex(scene, 'navy', '#222c48', '#e6dec8', 'books');
    T.banner_gold = bannerTex(scene, 'gold', '#ba8026', '#faecc8', 'hammer');
    T.banner_wokou = bannerTex(scene, 'wokou', '#1c2a4c', '#d9a743', 'logo:wokou');
    T.banner_scroll = bannerTex(scene, 'scroll', '#1f2f55', '#d9c79a', 'scroll');
    T.banner_board = bannerTex(scene, 'board', '#c79a4a', '#3b2a17', 'board');
    T.sail = bannerTex(scene, 'sail', '#e8dcbf', '#8a5a2c', 'logo:wokou', true);
    T.banner_yam_books = bannerTex(scene, 'yam_books', '#25402d', '#d6a640', 'books');
    T.banner_yam_dots = bannerTex(scene, 'yam_dots', '#25402d', '#d6a640', 'dots');
    T.noren_yamabushi = bannerTex(scene, 'noren_yamabushi', '#25402d', '#d6a640', 'logo:yamabushi', false, true);
    T.noren_yam_books = bannerTex(scene, 'noren_yam_books', '#25402d', '#d6a640', 'books', false, true);
    T.noren_yam_dots = bannerTex(scene, 'noren_yam_dots', '#25402d', '#d6a640', 'dots', false, true);
    T.noren_buke = bannerTex(scene, 'noren_buke', '#5e1a20', '#d8b35c', 'logo:buke', false, true);
    T.banner_buke_scroll = bannerTex(scene, 'buke_scroll', '#5e1a20', '#d8b35c', 'scroll');
    T.noren_buke_map = bannerTex(scene, 'noren_buke_map', '#c49b48', '#4a1a16', 'board', false, true);
    return T;
  }
  function bannerTex(scene, name, bg, fg, icon, sail, wide) {
    const W = wide ? 512 : 256, H = wide ? 160 : 512, t = new BABYLON.DynamicTexture('samKit_banner_' + name, { width: W, height: H }, scene, true), c = t.getContext();
    c.fillStyle = bg; c.fillRect(0, 0, W, H);
    if (sail) { c.strokeStyle = 'rgba(90,60,30,.45)'; c.lineWidth = 5; for (let y = 40; y < H; y += 64) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); } }
    else { c.strokeStyle = '#c9a452'; c.lineWidth = 6; c.strokeRect(13, 13, W - 26, H - 26); }
    c.fillStyle = fg; c.strokeStyle = fg; c.lineCap = 'round';
    // icons are drawn in the tall banner's frame (256 x 512, centred); a wide cloth shows them scaled into its middle
    const k = wide ? H * .86 / 256 : 1, frame = () => c.setTransform(k, 0, 0, k, wide ? W / 2 - 128 * k : 0, wide ? H / 2 - 256 * k : 0);
    if (wide) { frame(); } {
    const W = 256, H = 512;
    if (icon.startsWith('logo:')) { // the faction's emblem (white mask in assets/brand/factions), tinted; drawn once it loads
      logoMask(icon.slice(5), img => {
        const L = sail ? 210 : 200, o = document.createElement('canvas'); o.width = o.height = L; const oc = o.getContext('2d');
        oc.drawImage(img, 0, 0, L, L); oc.globalCompositeOperation = 'source-in'; oc.fillStyle = fg; oc.fillRect(0, 0, L, L);
        frame(); c.drawImage(o, (W - L) / 2, H * (sail ? .46 : .5) - L / 2); c.setTransform(1, 0, 0, 1, 0, 0); t.update();
      });
    } else if (icon === 'ant') {
      const cx = W / 2, cy = H * .5, s = 200;
      for (const [dy, rx, ry] of [[-.3, .11, .1], [0, .09, .13], [.36, .17, .24]]) { c.beginPath(); c.ellipse(cx, cy + dy * s, rx * s, ry * s, 0, 0, 7); c.fill(); }
      c.lineWidth = 7;
      for (const sd of [-1, 1]) {
        for (const [y0, x1, y1, x2, y2] of [[-.05, .28, -.22, .42, -.32], [0, .32, .05, .46, .18], [.05, .28, .28, .38, .46]]) { c.beginPath(); c.moveTo(cx, cy + y0 * s); c.lineTo(cx + sd * x1 * s, cy + y1 * s); c.lineTo(cx + sd * x2 * s, cy + y2 * s); c.stroke(); }
        c.beginPath(); c.moveTo(cx + sd * .04 * s, cy - .38 * s); c.lineTo(cx + sd * .16 * s, cy - .58 * s); c.lineTo(cx + sd * .3 * s, cy - .62 * s); c.stroke();
      }
    } else if (icon === 'dots') { // three circles in a triangle (tea house / inn)
      c.lineWidth = 8; for (const [dx, dy] of [[0, -46], [-42, 28], [42, 28]]) { c.beginPath(); c.arc(W / 2 + dx, H / 2 + dy, 34, 0, 7); c.stroke(); c.beginPath(); c.arc(W / 2 + dx, H / 2 + dy, 12, 0, 7); c.fill(); }
    } else if (icon === 'books') {
      c.lineWidth = 6; for (const [yy, ww] of [[300, 150], [250, 170], [200, 140]]) { c.strokeRect(W / 2 - ww / 2, yy, ww, 40); c.beginPath(); c.moveTo(W / 2 - ww / 2 + 14, yy + 20); c.lineTo(W / 2 + ww / 2 - 14, yy + 20); c.stroke(); }
    } else if (icon === 'scroll') {
      c.lineWidth = 8; c.save(); c.translate(W / 2, H / 2); c.rotate(-.5);
      c.strokeRect(-55, -120, 110, 240); c.beginPath(); c.arc(-55, -120, 16, 0, 7); c.arc(55, 120, 16, 0, 7); c.stroke();
      for (let i = -80; i <= 80; i += 32) { c.beginPath(); c.moveTo(-35, i); c.lineTo(35, i); c.stroke(); }
      c.restore();
    } else if (icon === 'board') {
      c.lineWidth = 6; const S0 = 150, x0 = W / 2 - S0 / 2, y0 = H / 2 - S0 / 2; c.strokeRect(x0, y0, S0, S0);
      for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(x0 + i * S0 / 4, y0); c.lineTo(x0 + i * S0 / 4, y0 + S0); c.moveTo(x0, y0 + i * S0 / 4); c.lineTo(x0 + S0, y0 + i * S0 / 4); c.stroke(); }
      for (const [a, b] of [[0, 0], [2, 1], [1, 3], [3, 2]]) c.fillRect(x0 + a * S0 / 4 + 8, y0 + b * S0 / 4 + 8, S0 / 4 - 16, S0 / 4 - 16);
    } else { c.fillRect(W / 2 - 12, 170, 24, 210); c.fillRect(W / 2 - 70, 150, 140, 55); }
    }
    c.setTransform(1, 0, 0, 1, 0, 0); t.update(); t.hasAlpha = false; return t;
  }

  // Faction emblems on banners: cloth and emblem colours per faction (banner_<faction> materials)
  const FACTION_BANNERS = {
    samurai: ['#961816', '#ecd6aa'], wokou: ['#1c2a4c', '#d9a743'], yamabushi: ['#25402d', '#d6a640'], ronin: ['#0e0d10', '#9a161a'],
    shogun: ['#2e2147', '#d8b04a'], bushi: ['#1b2a48', '#cfae5c'], buke: ['#5e1a20', '#d8b35c'], ashigaru: ['#24402a', '#d9c98e'],
    kenshi: ['#1d4a4c', '#d7e3e0'], sohei: ['#b8611c', '#f4e6c4'], warrior: ['#6b2a1a', '#e2c08a']
  };
  const logoImgs = {};
  function logoMask(id, cb) {
    let L = logoImgs[id];
    if (!L) { L = logoImgs[id] = { img: new Image(), ready: false, waiting: [] }; L.img.onload = () => { L.ready = true; L.waiting.splice(0).forEach(f => f(L.img)); }; L.img.src = 'assets/brand/factions/' + id + '.png'; }
    if (L.ready) cb(L.img); else L.waiting.push(cb);
  }

  // ── materials ───────────────────────────────────────────────────────────
  const MAT = {
    roof: { tex: 'roof' }, wood: { tex: 'wood' }, darkwood: { tex: 'darkwood' }, plaster: { tex: 'plaster' }, stone: { tex: 'stone' },
    thatch: { tex: 'thatch' }, bark: { tex: 'bark' }, earth: { tex: 'earth' }, shoji: { tex: 'shoji', em: [.5, .38, .2] },
    red: { col: [.55, .06, .05] }, gold: { col: [.85, .62, .22], spec: [.9, .75, .4], power: 40 }, dark: { col: [.03, .02, .015] },
    interior: { col: [.1, .06, .03], em: [.45, .25, .1] }, lantern: { col: [.9, .25, .08], em: [.95, .3, .1] }, fire: { col: [1, .5, .1], em: [1, .45, .08] },
    cloth: { col: [.6, .09, .07] }, rope: { col: [.62, .5, .32] }, iron: { col: [.12, .12, .13], spec: [.5, .5, .55], power: 48 }, water: { col: [.05, .12, .14], spec: [.8, .8, .8], power: 90 },
    banner_red: { tex: 'banner_red' }, banner_navy: { tex: 'banner_navy' }, banner_gold: { tex: 'banner_gold' },
    banner_wokou: { tex: 'banner_wokou' }, banner_scroll: { tex: 'banner_scroll' }, banner_board: { tex: 'banner_board' }, sail: { tex: 'sail' },
    banner_yam_books: { tex: 'banner_yam_books' }, banner_yam_dots: { tex: 'banner_yam_dots' },
    noren_yamabushi: { tex: 'noren_yamabushi' }, noren_yam_books: { tex: 'noren_yam_books' }, noren_yam_dots: { tex: 'noren_yam_dots' },
    noren_buke: { tex: 'noren_buke' }, banner_buke_scroll: { tex: 'banner_buke_scroll' }, noren_buke_map: { tex: 'noren_buke_map' },
    spirit: { col: [.35, .62, 1], em: [.3, .62, 1] }, glow_spirit: { glow: [.3, .58, 1] }, // Yamabushi spirit lanterns: icy blue flame
    ...Object.fromEntries(Object.keys(FACTION_BANNERS).filter(id => id !== 'samurai' && id !== 'wokou').map(id => ['banner_' + id, { tex: 'banner_' + id, faction: id }])),
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
    if (d.faction && !TEX[d.tex]) TEX[d.tex] = bannerTex(scene, d.faction, ...FACTION_BANNERS[d.faction], 'logo:' + d.faction); // made on first use
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
    part(m) { m = (this.remap && this.remap[m]) || m; return this.parts[m] || (this.parts[m] = { p: [], n: [], uv: [], i: [] }); }
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
  // noren: a short split curtain across the top of a doorway (the house's sign); front faces -y
  function noren(M, x, y, ztop, w, h, mat) {
    const n = 4, gap = .05, pw = (w - gap * (n - 1)) / n;
    for (let i = 0; i < n; i++) { const x0 = x - w / 2 + i * (pw + gap); M.quad(mat, [[x0, y, ztop - h], [x0 + pw, y, ztop - h], [x0 + pw, y, ztop], [x0, y, ztop]], [[i / n, 0], [(i + 1) / n, 0], [(i + 1) / n, 1], [i / n, 1]]); }
    M.rod('darkwood', [x - w / 2 - .1, y - .03, ztop + .03], [x + w / 2 + .1, y - .03, ztop + .03], .045, 6);
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
    // ── Wokou (sea raiders' harbour): navy + gold ant banners, dark wood, tiled roofs; piers, ships, cargo ──
    wok_great_dojo(M) { M.remap = { red: 'darkwood', banner_red: 'banner_wokou' }; B.sam_great_dojo(M); },
    wok_hall(M) { M.remap = { banner_navy: 'banner_scroll' }; B.sam_library(M); },
    wok_house(M) { M.remap = { thatch: 'roof' }; B.sam_house(M); M.remap = null; banner(M, 2.8, -3.25 - .18, 3.4, 1.1, 2.2, 'banner_wokou'); },
    wok_house_thatch(M) { B.sam_house(M); banner(M, 2.8, -3.25 - .18, 3.4, 1.1, 2.2, 'banner_wokou'); },
    wok_trade_house(M) { M.remap = { thatch: 'roof' }; B.sam_house(M); M.remap = null; banner(M, -.6, -3.25 - .2, 3.5, 3.4, 2.6, 'banner_board'); banner(M, -3.6, -3.25 - .18, 3.4, .9, 2.2, 'banner_wokou'); },
    wok_watchtower(M) { M.remap = { banner_red: 'banner_wokou' }; B.sam_watchtower(M); M.remap = null; banner(M, 0, -2.1, 6.8, 1.7, 3.6, 'banner_wokou'); },
    wok_banner_pole(M) { M.remap = { banner_red: 'banner_wokou' }; B.sam_banner_pole(M); },
    // pier segment 4 x 8 m: deck top at the origin, posts down into the sea bed
    wok_pier(M) {
      M.block('wood', 0, 0, -.28, 4, 8, .28);
      for (let i = 0; i < 8; i++) M.box('darkwood', [0, -3.75 + i * 1.07, .005], [4, .05, .02]);
      for (const y of [-3.7, 0, 3.7]) { for (const x of [-1.85, 1.85]) M.cyl('bark', [x, y, -12], .17, 12.1, 6); M.box('darkwood', [0, y, -.45], [4.3, .24, .24]); }
      for (const [x, y] of [[1.75, 3.6], [-1.75, 3.6]]) M.cyl('darkwood', [x, y, 0], .13, .45, 6);
    },
    // trading junk with an ant sail; waterline at the origin, bow towards -y
    wok_boat(M) {
      const L = 14, st = 12, hull = [], hullU = [], half = y => 2.2 * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(y + .9) / (L / 2), 2.2)), .55);
      for (let i = 0; i <= st; i++) {
        const y = -L / 2 + L * i / st, w = half(y), sh = 1.25 + .5 * Math.pow(Math.abs(y) / (L / 2), 2) + (y < 0 ? .35 * Math.pow(-y / (L / 2), 2) : 0);
        const ring = [[-w, y, sh], [-w * .98, y, .4], [-w * .7, y, -.6], [0, y, -1.3], [w * .7, y, -.6], [w * .98, y, .4], [w, y, sh]];
        hull.push(ring); hullU.push(ring.map((p, k) => [k / 6 * 3, i / st * 7]));
      }
      M.grid('darkwood', hull, hullU);
      for (let i = 0; i < st; i++) { const a = hull[i], b = hull[i + 1]; M.quad('wood', [[a[0][0] + .12, a[0][1], a[0][2] - .25], [a[6][0] - .12, a[6][1], a[6][2] - .25], [b[6][0] - .12, b[6][1], b[6][2] - .25], [b[0][0] + .12, b[0][1], b[0][2] - .25]]); }
      for (const side of [0, 6]) for (let i = 0; i < st; i++) M.rod('wood', hull[i][side], hull[i + 1][side], .09, 5);
      M.block('wood', 0, 4.6, 1.2, 3, 2.6, 1.6); M.roof(0, 4.6, 2.8, 3.8, 3.4, 1.1, { lift: .25, ornaments: false, gable: false });
      M.cyl('darkwood', [0, -.6, 1], .16, 11.5, 8);
      const sw = 6.2, z0 = 3, z1 = 10.8; M.quad('sail', [[-sw / 2, -.85, z0], [sw / 2, -.85, z0], [sw / 2 * .86, -.85, z1], [-sw / 2 * .86, -.85, z1]]);
      for (let k = 0; k <= 5; k++) { const z = z0 + (z1 - z0) * k / 5, f = 1 - .14 * k / 5; M.rod('bark', [-sw / 2 * f - .1, -.9, z], [sw / 2 * f + .1, -.9, z], .05, 4); }
      M.rod('rope', [0, -.6, 11.2], [0, -L / 2 + .3, 2.1], .025, 3); M.rod('rope', [0, -.6, 11.2], [0, L / 2 - .4, 2.6], .025, 3);
      M.block('darkwood', 0, L / 2 - .1, -.8, .15, .9, 2.4);
      M.cyl('lantern', [0, L / 2 - .7, 2.9], .18, .45, 6);
    },
    // boat shed: thatched roof on posts, a hull being built inside, a ladder and timber
    wok_boathouse(M) {
      const W = 9, D = 14, H = 4.2;
      M.block('stone', 0, 0, 0, W + 1, D + 1, .3);
      for (const x of [-W / 2, W / 2]) for (const y of [-D / 2, 0, D / 2]) M.block('wood', x, y, .3, .35, .35, H);
      for (const x of [-W / 2, W / 2]) M.block('darkwood', x, 0, H + .3, .4, D + .6, .3);
      const r = H + 2.6, e = .8, pts = s => [[s * (W / 2 + e), -D / 2 - e, H - .2], [s * (W / 2 + e), D / 2 + e, H - .2], [0, D / 2 + e, r], [0, -D / 2 - e, r]];
      M.quad('thatch', pts(-1), [[0, 0], [D / 1.6, 0], [D / 1.6, 2.6], [0, 2.6]]); M.quad('thatch', pts(1), [[0, 0], [D / 1.6, 0], [D / 1.6, 2.6], [0, 2.6]]);
      for (const y of [-D / 2, D / 2]) M.poly('wood', [[-W / 2, y, H + .3], [W / 2, y, H + .3], [0, y, r - .2]]);
      M.box('darkwood', [0, 0, r + .05], [.35, D + 1.8, .35]);
      M.rod('bark', [0, -5.5, .7], [0, 5.5, .7], .14, 6);
      for (let i = 0; i < 9; i++) { const y = -4.6 + i * 1.15, w = 1.8 * Math.sqrt(Math.max(0, 1 - Math.pow(y / 5.6, 2))); M.rod('wood', [-w, y, 2.2], [-w * .6, y, .9], .07, 4); M.rod('wood', [-w * .6, y, .9], [0, y, .6], .07, 4); M.rod('wood', [0, y, .6], [w * .6, y, .9], .07, 4); M.rod('wood', [w * .6, y, .9], [w, y, 2.2], .07, 4); }
      for (let i = 0; i < 3; i++) M.block('wood', -1.6 + i * .25, 0, .3 + i * .3, 2.6, .3, .3);
      M.rod('wood', [3.3, -6.2, .3], [3.6, -5.4, 3.6], .06, 4); M.rod('wood', [3.9, -6.2, .3], [4.2, -5.4, 3.6], .06, 4);
      for (let i = 0; i < 6; i++) M.box('wood', [3.75 + .05 * i, -6.1 + .12 * i, .7 + i * .5], [.7, .06, .06]);
      for (let i = 0; i < 4; i++) M.block('wood', -3.4, 4.8, .3 + i * .28, .3, 3.2, .26);
    },
    // harbour crane: post, swinging arm out over the water (-y), rope and a net of cargo
    wok_crane(M) {
      M.block('stone', 0, 0, 0, 1.6, 1.6, .4); M.cyl('darkwood', [0, 0, .4], .22, 6, 8);
      M.rod('darkwood', [0, .1, 5.6], [0, -4.6, 6.4], .14, 6); M.rod('wood', [0, 0, 3.2], [0, -2.6, 6.05], .1, 5);
      M.rod('rope', [0, -4.5, 6.3], [0, -4.5, 2.4], .03, 4); M.sphere('rope', [0, -4.5, 1.9], .6, 1.1, 8, 5);
      for (let i = 0; i < 3; i++) M.block('wood', -.25 + i * .2, -4.45, 1.5 + i * .25, .5, .5, .3);
    },
    // crates, barrels and a coil of rope, for quays and decks
    wok_cargo(M) {
      for (const [x, y, z, s] of [[0, 0, 0, 1.1], [1.2, .1, 0, 1], [.5, 0, 1.1, .95], [-1.1, .6, 0, .9]]) { M.block('wood', x, y, z, s, s, s); M.box('darkwood', [x, y - s / 2 - .01, z + s / 2], [s + .02, .03, s * .15]); M.box('darkwood', [x, y - s / 2 - .01, z + s / 2], [s * .15, .03, s + .02]); }
      for (const [x, y] of [[2.4, -.3], [2.5, .7], [-2.1, -.5]]) { M.cyl('wood', [x, y, 0], .42, 1.15, 10, .42); for (const z of [.15, .95]) M.cyl('darkwood', [x, y, z], .44, .06, 10); }
      M.cyl('rope', [-2.2, .9, 0], .5, .18, 10, .45);
    },
    // low rail fence, 4 m (training yards, quays)
    wok_fence(M) {
      for (const x of [-2, 0, 2]) { M.block('darkwood', x, 0, 0, .18, .18, 1.25); M.cyl('darkwood', [x, 0, 1.25], .1, .08, 6, .03); }
      for (const z of [.45, .95]) M.box('wood', [0, 0, z], [4.1, .1, .12]);
    },
    // ── Yamabushi (mountain mystics): dark wood, white plaster, grey tile and thatch, green + gold banners ──
    yam_great_dojo(M) { M.remap = { red: 'wood', banner_red: 'banner_yamabushi' }; B.sam_great_dojo(M); M.remap = null; noren(M, 0, -15 / 2 + 2.05, 5.45, 5.6, 1.5, 'noren_yamabushi'); },
    // two storeys: shop room below, balcony with a railing and the reading room above
    yam_library(M) {
      const W = 13, D = 9;
      M.block('stone', 0, 0, 0, W + 1.4, D + 1.4, .7); steps(M, 0, -(D + 1.4) / 2, .7, 4, 2);
      walls(M, 0, 0, .7, W, D, 3.8, { door: [3.2, 3], windows: [['front', -4, 1.6, 2.6, 1.6], ['front', 4, 1.6, 2.6, 1.6], ['left', 0, 1.6, 3, 1.6], ['right', 0, 1.6, 3, 1.6]] });
      noren(M, 0, -D / 2 - .2, 3.65, 3.6, 1.1, 'noren_yam_books');
      M.roof(0, 0, 4.5, W + 2.6, D + 2.6, 1.2, { lift: .5, gable: false, ornaments: false });
      // balcony on the front, upper floor set back
      M.block('wood', 0, -D / 2 - .6, 4.5, W + .8, 1.8, .22);
      for (let i = 0; i <= 8; i++) { const x = -W / 2 - .3 + i * (W + .6) / 8; M.block('darkwood', x, -D / 2 - 1.4, 4.72, .14, .14, 1.05); }
      M.box('darkwood', [0, -D / 2 - 1.4, 5.75], [W + .7, .16, .12]); M.box('darkwood', [0, -D / 2 - 1.4, 5.2], [W + .7, .08, .08]);
      walls(M, 0, .6, 4.72, W - 1, D - 1.6, 3.2, { windows: [['front', -3.6, 5.5, 2.4, 1.5], ['front', 0, 5.5, 2.4, 1.5], ['front', 3.6, 5.5, 2.4, 1.5], ['left', 0, 5.5, 2.4, 1.4], ['right', 0, 5.5, 2.4, 1.4]] });
      M.roof(0, .6, 7.9, W + 2, D + 1.2, 3.2, { lift: .8 });
      for (const s of [-1, 1]) lantern(M, s * 5.2, -D / 2 - 1.4, 4.4, .22);
      banner(M, -W / 2 - .2, -D / 2 - .25, 3.6, 1.1, 2.4, 'banner_yamabushi');
    },
    yam_house(M) { M.remap = { thatch: 'roof' }; B.sam_house(M); M.remap = null; noren(M, 0, -3.25 - .2, 3.05, 2.4, .9, 'noren_yamabushi'); banner(M, 2.8, -3.25 - .18, 3.4, 1.1, 2.2, 'banner_yamabushi'); },
    yam_house_thatch(M) { B.sam_house(M); noren(M, 0, -3.25 - .2, 3.05, 2.4, .9, 'noren_yam_dots'); banner(M, 2.8, -3.25 - .18, 3.4, 1.1, 2.2, 'banner_yamabushi'); },
    yam_gate(M) { M.remap = { red: 'darkwood', banner_red: 'banner_yamabushi' }; B.sam_gate(M); M.remap = null; noren(M, 0, -1.3, 5.1, 5, 1.7, 'noren_yamabushi'); },
    yam_banner_pole(M) { M.remap = { banner_red: 'banner_yamabushi' }; B.sam_banner_pole(M); },
    // plank bridge 32 m long (along y), deck top at the origin; ends rest on the cliffs, a rope rail on posts
    yam_bridge(M) {
      const L = 32, Wd = 3;
      M.block('wood', 0, 0, -.25, Wd, L, .25);
      for (let i = 0; i < 40; i++) M.box('darkwood', [0, -L / 2 + .4 + i * (L - .8) / 39, .005], [Wd, .05, .02]);
      for (const x of [-Wd / 2 + .1, Wd / 2 - .1]) M.box('darkwood', [x, 0, -.45], [.22, L, .3]);
      for (let i = 0; i <= 8; i++) {
        const y = -L / 2 + .3 + i * (L - .6) / 8;
        for (const s of [-1, 1]) { M.block('darkwood', s * (Wd / 2 + .05), y, -.4, .18, .18, 1.55); M.cyl('darkwood', [s * (Wd / 2 + .05), y, 1.15], .1, .08, 6, .03); }
        M.box('darkwood', [0, y, -.55], [Wd + .5, .2, .2]);
      }
      for (const s of [-1, 1]) for (const z of [1.05, .55]) M.rod('rope', [s * (Wd / 2 + .05), -L / 2 + .3, z], [s * (Wd / 2 + .05), L / 2 - .3, z], .035, 4);
      for (const e of [-1, 1]) for (const s of [-1, 1]) M.rod('darkwood', [s * (Wd / 2 - .1), e * (L / 2 - 1), -.5], [s * (Wd / 2 - .1), e * (L / 2 - 4.5), -4], .14, 6); // struts down to the cliff faces
    },
    // tunnel into a retaining wall: a stone arch with a dark passage and a warm light deep inside; back at y = 0
    yam_burrow_arch(M) {
      const r = 1.6, zc = 1.9, n = 12, d = 1;
      for (let i = 0; i < n; i++) {
        const a0 = Math.PI * i / n, a1 = Math.PI * (i + 1) / n, am = (a0 + a1) / 2;
        M.box('stone', [Math.cos(am) * (r + .35), -d / 2, zc + Math.sin(am) * (r + .35)], [.75, d, .72 * Math.PI * (r + .35) / n * 1.05], 0, 0, -am);
      }
      for (const s of [-1, 1]) M.block('stone', s * (r + .35), -d / 2, 0, .75, d, zc);
      M.block('stone', 0, -d / 2, 0, 2 * r + 1.6, d + .2, .25);
      const pts = []; for (let i = 0; i <= n; i++) pts.push([Math.cos(Math.PI * i / n) * r, -.02, zc + Math.sin(Math.PI * i / n) * r]);
      for (let i = 0; i < n; i++) M.poly('dark', [pts[i], pts[i + 1], [0, -.02, zc]]);
      M.quad('dark', [[-r, -.02, .25], [r, -.02, .25], [r, -.02, zc], [-r, -.02, zc]]);
      M.quad('fire', [[-.4, .4, .6], [.4, .4, .6], [.4, .4, 1.2], [-.4, .4, 1.2]]);
      lantern(M, r + .9, -d - .1, 2.9, .2); M.box('darkwood', [r + .9, -d / 2 - .25, 2.95], [.1, d + .4, .1]);
    },
    // spirit lantern: a stone toro whose light burns icy blue (the Yamabushi's flame), blue pool of light at night
    yam_spirit_lantern(M) { M.remap = { lantern: 'spirit', glow: 'glow_spirit' }; B.sam_stone_lantern(M); },
    // small open shrine for the lookout pillar: four posts, a tiled roof, offering box and bell
    yam_shrine(M) {
      M.block('stone', 0, 0, 0, 4.4, 4.4, .4); steps(M, 0, -2.2, .4, 2, 1);
      for (const x of [-1.7, 1.7]) for (const y of [-1.7, 1.7]) M.block('darkwood', x, y, .4, .26, .26, 3);
      M.box('darkwood', [0, -1.7, 3.3], [4, .3, .3]); M.box('darkwood', [0, 1.7, 3.3], [4, .3, .3]);
      M.roof(0, 0, 3.45, 5.4, 5.4, 1.7, { lift: .6 });
      M.block('wood', 0, .6, .4, 1.6, 1, .9); M.block('darkwood', 0, .6, 1.3, 1.7, 1.1, .08);
      M.rod('rope', [0, -1.7, 3.1], [0, -1.7, 2.1], .03, 4); M.sphere('gold', [0, -1.7, 1.95], .22, 1.1, 8, 5);
      banner(M, 0, -1.85, 3.1, 2.2, .6, 'banner_yamabushi');
    },
    // low wooden bench (training yard)
    yam_bench(M) { M.block('wood', 0, 0, .42, 2.6, .45, .12); for (const x of [-1.05, 1.05]) M.block('darkwood', x, 0, 0, .18, .4, .42); },
    // stone training weights: a bar through two stone wheels on a rack
    yam_stone_weights(M) {
      for (const s of [-1, 1]) M.block('darkwood', s * 1.1, 0, 0, .14, .4, .9);
      M.rod('darkwood', [-1.3, 0, .82], [1.3, 0, .82], .06, 6);
      for (const s of [-1, 1]) M.tube('stone', [s * .75, -.14, .82], [s * .75, .14, .82], .5, .5, 10);
      M.cyl('stone', [1.9, .3, 0], .35, .32, 8); M.cyl('stone', [1.85, .3, .32], .28, .26, 8); M.block('stone', -1.9, .2, 0, .55, .45, .4);
    },
    // ── Buke (noble defenders): dark wood, white plaster on grey stone, maroon + gold banners with the trident ──
    buke_great_hall(M) { M.remap = { red: 'darkwood', banner_red: 'banner_buke' }; B.sam_great_dojo(M); M.remap = null; noren(M, 0, -15 / 2 + 2.05, 5.45, 5.6, 1.5, 'noren_buke'); },
    // archive: a stone ground floor (big doorway, red curtains) under a timber and plaster upper floor with a scroll banner
    buke_archive(M) {
      const W = 12, D = 9;
      M.block('stone', 0, 0, 0, W + 1, D + 1, .6); steps(M, 0, -(D + 1) / 2, .6, 4, 2);
      M.remap = { plaster: 'stone', wood: 'stone' };
      walls(M, 0, 0, .6, W, D, 3.8, { door: [3.4, 3.1] });
      M.remap = null;
      M.block('darkwood', 0, -D / 2 - .1, 4.4, W + .4, .5, .3); M.block('darkwood', 0, D / 2 + .1, 4.4, W + .4, .5, .3);
      walls(M, 0, 0, 4.7, W - .4, D - .4, 3.4, { windows: [['front', -4, 5.6, 1.6, 1.4], ['front', 4, 5.6, 1.6, 1.4], ['left', -2, 5.6, 1.6, 1.4], ['left', 2, 5.6, 1.6, 1.4], ['right', -2, 5.6, 1.6, 1.4], ['right', 2, 5.6, 1.6, 1.4]] });
      M.roof(0, 0, 8.1, W + 2.6, D + 2.6, 3.4, { lift: .8 });
      banner(M, 0, -D / 2 + .2 - .2, 7.7, 3.4, 2.8, 'banner_buke_scroll');
      noren(M, 0, -D / 2 - .2, 3.75, 3.6, 1, 'noren_buke');
      for (const sd of [-1, 1]) { M.quad('cloth', [[sd * 1.75, -D / 2 - .22, .7], [sd * 2.25, -D / 2 - .22, .7], [sd * 2.25, -D / 2 - .22, 3.7], [sd * 1.75, -D / 2 - .22, 3.7]]); lantern(M, sd * 2.8, -D / 2 - .5, 3.6, .22); }
      for (const [x, y] of [[-4.6, -D / 2 - 1.2], [4.4, -D / 2 - 1.3]]) { M.block('wood', x, y, 0, 1, .8, .8); M.block('wood', x + .2, y + .1, .8, .8, .6, .6); }
    },
    // strategy hall: the library's frame with a gold map banner over the door and trident banners
    buke_strategy_hall(M) { M.remap = { banner_navy: 'banner_buke' }; B.sam_library(M); M.remap = null; noren(M, 0, -9 / 2 - .22, 5.3, 4.2, 1.3, 'noren_buke_map'); },
    buke_house(M) { M.remap = { thatch: 'roof' }; B.sam_house(M); M.remap = null; noren(M, 0, -3.25 - .2, 3.05, 2.4, .9, 'noren_buke'); banner(M, 2.8, -3.25 - .18, 3.4, 1.1, 2.2, 'banner_buke'); },
    // gatehouse between two stone bastions with braziers and banners on top; open doors, a noren across the opening
    buke_gate(M) {
      const OW = 5.4, OH = 5;
      for (const sd of [-1, 1]) {
        const x = sd * (OW / 2 + 3.1);
        M.block('stone', x, 0, 0, 6, 5.6, 5.6); M.block('stone', x, 0, 5.6, 6.3, 5.9, .3);
        for (const [px, py] of [[-2.9, -2.8], [2.9, -2.8], [-2.9, 2.8], [2.9, 2.8], [0, -2.8]]) M.block('darkwood', x + px, py, 5.9, .2, .2, 1.1);
        for (const z of [6.4, 6.9]) { M.box('darkwood', [x, -2.8, z], [6, .12, .12]); M.box('darkwood', [x - 2.9, 0, z], [.12, 5.6, .12]); M.box('darkwood', [x + 2.9, 0, z], [.12, 5.6, .12]); }
        M.cyl('iron', [x - sd * 1.3, -1.3, 5.9], .25, .7, 6, .1); M.cyl('iron', [x - sd * 1.3, -1.3, 6.6], .7, .3, 10, .8);
        M.quad('fire', [[x - sd * 1.3 - .5, -1.3, 6.8], [x - sd * 1.3 + .5, -1.3, 6.8], [x - sd * 1.3 + .25, -1.3, 7.7], [x - sd * 1.3 - .25, -1.3, 7.7]]);
        M.quad('fire', [[x - sd * 1.3, -1.8, 6.8], [x - sd * 1.3, -.8, 6.8], [x - sd * 1.3, -1.05, 7.7], [x - sd * 1.3, -1.55, 7.7]]);
        M.cyl('darkwood', [x + sd * 1.6, -2, 5.9], .09, 5, 8); M.rod('darkwood', [x + sd * 1.6, -2.05, 10.6], [x + sd * 1.6 - sd * 1.5, -2.05, 10.6], .05, 6);
        M.quad('banner_buke', [[x + sd * 1.6 - (sd > 0 ? 1.45 : 0), -2.08, 6.6], [x + sd * 1.6 + (sd > 0 ? 0 : 1.45), -2.08, 6.6], [x + sd * 1.6 + (sd > 0 ? 0 : 1.45), -2.08, 10.55], [x + sd * 1.6 - (sd > 0 ? 1.45 : 0), -2.08, 10.55]]);
        banner(M, x, -2.82, 4.8, 1.8, 3.6, 'banner_buke');
      }
      for (const sd of [-1, 1]) for (const y of [-1.2, 1.2]) M.cyl('darkwood', [sd * (OW / 2 + .2), y, 0], .3, OH + .8, 10);
      for (const y of [-1.2, 1.2]) M.box('darkwood', [0, y, OH + .45], [OW + 1.4, .45, .5]);
      M.block('darkwood', 0, 0, OH + .7, OW + 1.8, 3, .35);
      M.roof(0, 0, OH + 1.05, OW + 4.4, 4.8, 1.9, { lift: .6 });
      for (const sd of [-1, 1]) M.block('darkwood', sd * (OW / 2 - .15), -2.1, 0, .2, 2.2, OH - .3, sd * .9);
      noren(M, 0, -1.48, OH + .2, OW - .3, 1.7, 'noren_buke');
      for (const sd of [-1, 1]) lantern(M, sd * (OW / 2 + .2), -1.65, OH - .1, .22);
    },
    buke_banner_pole(M) { M.remap = { banner_red: 'banner_buke' }; B.sam_banner_pole(M); },
    // stone footbridge over a canal, 8 m long (along y), deck top at the origin, low parapets
    buke_footbridge(M) {
      M.block('stone', 0, 0, -.6, 3, 8, .6);
      for (const sd of [-1, 1]) { M.block('stone', sd * 1.35, 0, 0, .3, 8, .55); M.block('stone', 0, sd * 3.4, -2.4, 3.4, 1.2, 1.8); }
      for (const sd of [-1, 1]) for (const y of [-3.6, 3.6]) { M.block('stone', sd * 1.35, y, 0, .42, .42, .9); M.cyl('stone', [sd * 1.35, y, .9], .18, .18, 4, .05); }
      for (const sd of [-1, 1]) M.box('stone', [0, sd * 2.2, -.95], [3, 1.6, .7], 0, sd * .35); // haunches of the arch
    },
    // stone water outlet for a canal end: a small arch in the wall with water pouring out; back at y = 0, lip at z = 0
    buke_canal_spout(M) {
      M.block('stone', 0, -.4, -2.2, 3.2, .8, 3.6);
      M.quad('dark', [[-.7, -.82, .2], [.7, -.82, .2], [.7, -.82, 1.1], [-.7, -.82, 1.1]]);
      for (let i = 0; i <= 6; i++) { const a = Math.PI * i / 6; M.box('stone', [Math.cos(a) * .95, -.85, 1.1 + Math.sin(a) * .6], [.3, .3, .3]); }
      M.quad('water', [[-.6, -.9, .2], [.6, -.9, .2], [.6, -1.5, -1.6], [-.6, -1.5, -1.6]]);
    },
    // wooden post lantern (fences, stairs); lights up at night like the stone ones
    buke_post_lantern(M) {
      M.block('darkwood', 0, 0, 0, .22, .22, 1.35); M.block('lantern', 0, 0, 1.35, .36, .36, .42); M.block('darkwood', 0, 0, 1.77, .5, .5, .08);
      M.cyl('darkwood', [0, 0, 1.85], .3, .2, 4, .04);
      M.quad('glow', [[-1.8, -1.8, .07], [1.8, -1.8, .07], [1.8, 1.8, .07], [-1.8, 1.8, .07]]);
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
  // walkable decks in the type's own frame (Babylon x/z, deck top y above the origin)
  const decks = { wok_pier: [{ x: 0, z: 0, halfX: 2.05, halfZ: 4.05, y: 0 }], yam_bridge: [{ x: 0, z: 0, halfX: 1.45, halfZ: 16.2, y: 0 }], buke_footbridge: [{ x: 0, z: 0, halfX: 1.2, halfZ: 4.1, y: 0 }] };
  window.SamuraiKit = { build, setLightFactor, decks, types: Object.keys(B), _Kit: Kit, _B: B };
})();
