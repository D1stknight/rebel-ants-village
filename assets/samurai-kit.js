// Samurai building kit (Oct 2026). Designed in Blender (work/sam/models.py); this file builds the same low-poly
// shapes in the browser, so no model files are downloaded. Each building type is built once into a hidden template
// (one mesh per material) and every placed copy is a set of instances of it: cheap to draw, cheap to place.
// Doorways are lit recesses; link a room by adding a Door (admin > Doors) in front of one.
/* global BABYLON */
(function () {
  const TILE = { roof: [1.6, 1.4], roof_brown: [1.6, 1.4], plaster_old: [3, 3], slate: [2.4, 2.4], wood: [1.6, 1.6], darkwood: [1.6, 1.6], plaster: [3, 3], stone: [2.4, 2.4], thatch: [2, 1.6], bark: [1.4, 1.6], earth: [4, 4], shoji: [1.2, 1.5],
    facade_apt: [6, 4.6], facade_stucco: [5, 4.6], facade_brick: [6, 4.6], facade_office: [6, 4.2], facade_glass: [4, 4], facade_shop: [8, 5.2], rollup: [3, 3], sl_brick: [2.4, 2.4], stucco: [3, 3], deco: [3, 3], seigaiha: [2.4, 2.4], sand_ring: [4, 4], checker_cc: [3.2, 3.2], bamboo_wall: [2.4, 2.4] };
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
    T.roof_brown = pixelTex(scene, 'roof_brown', S, (x, y, i) => { const col = (x * 8) % 1, row = (y * 6) % 1; let f = (.55 + .45 * Math.sin(col * Math.PI)) * (Math.min(1, row / .18) * .35 + .65) * (.85 + .3 * n[i]); if (col < .04 || col > .96) f *= .45; return mul([98, 52, 42], f); });
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
    T.noren_kenshi = bannerTex(scene, 'noren_kenshi', '#1f5753', '#d8b450', 'logo:kenshi', false, true);
    T.noren_kenshi_scroll = bannerTex(scene, 'noren_kenshi_scroll', '#1f5753', '#d8b450', 'scroll', false, true);
    T.noren_kenshi_map = bannerTex(scene, 'noren_kenshi_map', '#c9a24a', '#1f4a46', 'board', false, true);
    T.noren_sohei = bannerTex(scene, 'noren_sohei', '#c38d2a', '#f8edd2', 'logo:sohei', false, true);
    T.noren_sohei_books = bannerTex(scene, 'noren_sohei_books', '#c38d2a', '#f8edd2', 'books', false, true);
    T.noren_sohei_dots = bannerTex(scene, 'noren_sohei_dots', '#a8432a', '#f8edd2', 'dots', false, true);
    const nd = noise(S, 16, 4, 21), nd2 = noise(S, 40, 2, 22), r9 = rng(23);
    T.needles = pixelTex(scene, 'needles', S, (x, y, i) => { let f = .55 + .35 * nd[i] + .3 * nd2[i]; if (r9() < .07) f *= 1.35; return [44 * f, 74 * f, 46 * f]; });
    T.leaves = pixelTex(scene, 'leaves', S, (x, y, i) => { let f = .55 + .35 * nd[i] + .3 * nd2[i]; if (r9() < .08) f *= 1.3; return [70 * f, 96 * f, 40 * f]; });
    T.needles_dark = pixelTex(scene, 'needles_dark', S, (x, y, i) => { const f = .45 + .35 * nd[i] + .25 * nd2[i]; return [28 * f, 50 * f, 34 * f]; });
    const bk = noise(S, 3, 5, 24), bk2 = noise(S, 10, 3, 25);
    const bk3 = noise(S, 24, 2, 28);
    T.bark_old = pixelTex(scene, 'bark_old', S, (x, y, i) => { const g = Math.abs(Math.sin((x * 9 + bk[i] * .35) * Math.PI)), f = .42 + .38 * g ** .6 + .14 * bk2[i] + .12 * bk3[i]; return [92 * f + 12, 80 * f + 10, 70 * f + 8]; });
    const gn = noise(S, 6, 5, 26); T.granite = pixelTex(scene, 'granite', S, (x, y, i) => { const f = .55 + .45 * gn[i]; return [96 * f, 98 * f, 104 * f]; });
    const mn = noise(S, 8, 4, 27); T.moss = pixelTex(scene, 'moss', S, (x, y, i) => { const f = .5 + .5 * mn[i]; return [46 * f, 70 * f, 38 * f]; });
    const po = noise(S, 5, 4, 31); T.plaster_old = pixelTex(scene, 'plaster_old', S, (x, y, i) => mul([176, 168, 152], .78 + .22 * po[i]));
    const sl = noise(S, 7, 4, 32); T.slate = pixelTex(scene, 'slate', S, (x, y, i) => { const g = ((x * 4) % 1 < .03 || (y * 4) % 1 < .03) ? .55 : 1; return mul([62, 62, 68], g * (.8 + .3 * sl[i])); });
    T.ronin_floor = floorTex(scene, 'ronin_floor', '#2c2c31', '#b9a57c', 'ronin');
    T.noren_ronin = bannerTex(scene, 'noren_ronin', '#6a1a1d', '#e3cfa4', 'logo:ronin', false, true);
    T.banner_ronin_scroll = bannerTex(scene, 'ronin_scroll', '#6a1a1d', '#e3cfa4', 'scroll');
    T.banner_ronin_board = bannerTex(scene, 'ronin_board', '#6a1a1d', '#e3cfa4', 'board');
    T.noren_wokou = bannerTex(scene, 'noren_wokou', '#1c2a4c', '#d9a743', 'logo:wokou', false, true);
    T.noren_bushi = bannerTex(scene, 'noren_bushi', '#7d2b22', '#d9b35a', 'logo:bushi', false, true);
    T.banner_bushi_scroll = bannerTex(scene, 'bushi_scroll', '#7d2b22', '#d9b35a', 'scroll');
    T.banner_bushi_board = bannerTex(scene, 'bushi_board', '#7d2b22', '#d9b35a', 'board');
    T.noren_ashigaru = bannerTex(scene, 'noren_ashigaru', '#8c1c1c', '#d8b45a', 'logo:ashigaru', false, true);
    T.banner_ashi_scroll = bannerTex(scene, 'ashi_scroll', '#8c1c1c', '#d8b45a', 'scroll');
    T.banner_ashi_board = bannerTex(scene, 'ashi_board', '#8c1c1c', '#d8b45a', 'board');
    T.ashi_door = bannerTex(scene, 'ashi_door', '#141012', '#d8b45a', 'logo:ashigaru');
    T.noren_warrior = bannerTex(scene, 'noren_warrior', '#34502e', '#dcb24e', 'logo:warrior', false, true);
    T.banner_war_wheel = bannerTex(scene, 'war_wheel', '#c9a043', '#3a2a18', 'wheel');
    T.noren_shogun = bannerTex(scene, 'noren_shogun', '#5f1d45', '#d8b04a', 'logo:shogun', false, true);
    T.banner_shogun_mon = bannerTex(scene, 'shogun_mon', '#c9a043', '#2a1d14', 'dots');
    const sk = noise(S, 3, 5, 43); // the painted screen behind the dojo's dais: misty mountains on gold
    T.shogun_screen = pixelTex(scene, 'shogun_screen', S, (x, y, i) => { if (Math.min(x, 1 - x, y, 1 - y) < .025) return [40, 26, 16]; if ((x * 4) % 1 < .012) return [120, 96, 50]; const m1 = .45 + .18 * Math.sin(x * 9 + 1) + .1 * sk[i], m2 = .3 + .12 * Math.sin(x * 14 + 3); return y < m2 ? [70, 84, 72] : y < m1 ? [116, 124, 106] : [214, 184, 112]; });
    const rp = noise(S, 4, 4, 51); // purple slate shingles (Cute & Creepy)
    T.roof_purple = pixelTex(scene, 'roof_purple', S, (x, y, i) => { const row = (y * 8) % 1, off = Math.floor(y * 8) % 2 ? .5 : 0, col = (x * 6 + off) % 1; let f = (.62 + .38 * Math.min(1, row / .5)) * (.82 + .3 * rp[i]); if (row > .9 || col < .05) f *= .5; return mul([74, 52, 98], f); });
    T.banner_cc = bannerTex(scene, 'cc', '#3a1d4f', '#d9cbe8', 'spider');
    T.sign_book = bannerTex(scene, 'cc_book', '#3a2616', '#e8dcc0', 'book');
    T.sign_dice = bannerTex(scene, 'cc_dice', '#3a2616', '#f1e8d6', 'dice');
    const bs = rng(52); const spines = Array.from({ length: 64 }, () => [[110, 40, 40], [50, 70, 110], [70, 100, 60], [140, 110, 50], [90, 50, 110]][Math.floor(bs() * 5)].map(v => v * (.7 + .5 * bs())));
    T.books = pixelTex(scene, 'books', S, (x, y) => { const sh = (y * 5) % 1; if (sh > .86) return [60, 38, 22]; const k = Math.floor(x * 16) + 16 * Math.floor(y * 5), c = spines[k % 64]; return (x * 16) % 1 < .08 ? mul(c, .5) : sh < .12 * (1 + (k % 3)) ? [40, 26, 16] : c; });
    // ── Cute & Creepy gang (Miguel's NFTs): faces, kimonos, cat coats, drawn on canvases ──
    const cv = (name, W, H, draw) => { const t = new BABYLON.DynamicTexture('samKit_' + name, { width: W, height: H }, scene, true), c = t.getContext(); draw(c, W, H); t.update(); t.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE; return t; };
    const lash = (c, x, y, w, col, n = 4) => { c.strokeStyle = col; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.arc(x, y - w * .35, w * .6, .25 * Math.PI, .75 * Math.PI); c.stroke(); c.lineWidth = 3.5; for (let k = 0; k < n; k++) { const a = (.3 + .4 * k / (n - 1)) * Math.PI, px = x + Math.cos(a) * w * .6, py = y - w * .35 + Math.sin(a) * w * .6; c.beginPath(); c.moveTo(px, py); c.lineTo(px + Math.cos(a) * 12, py + Math.sin(a) * 12); c.stroke(); } };
    const dot = (c, x, y, r, col) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); };
    const ell = (c, x, y, rx, ry, col, a = 0) => { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, a, 0, 7); c.fill(); };
    const catEye = (c, x, y, iris) => { ell(c, x, y, 26, 22, '#f6f2e8'); ell(c, x, y, 19, 19, iris); ell(c, x, y, 5, 16, '#111'); dot(c, x - 6, y - 7, 4, '#fff'); c.strokeStyle = '#111'; c.lineWidth = 4; c.beginPath(); c.ellipse(x, y, 26, 22, 0, 0, 7); c.stroke(); };
    // Kokeshi Flower Moon: white skin, closed eyes under red shadow, blood tears, small red lips, blush
    T.face_fm = cv('face_fm', 256, 256, (c, W) => {
      c.fillStyle = '#f4eee9'; c.fillRect(0, 0, W, W);
      for (const x of [88, 168]) { ell(c, x, 140, 34, 16, 'rgba(210,30,40,.55)'); lash(c, x, 150, 34, '#1a1012'); c.strokeStyle = '#a8121c'; c.lineWidth = 4; c.beginPath(); c.moveTo(x - 8, 158); c.lineTo(x - 10, 190); c.stroke(); dot(c, x - 10, 192, 4, '#a8121c'); ell(c, x + (x < 128 ? -16 : 16), 182, 20, 11, 'rgba(240,120,130,.45)'); }
      ell(c, 128, 206, 11, 6, '#c8202c'); ell(c, 123, 203, 5, 4, '#e0404c'); ell(c, 133, 203, 5, 4, '#e0404c');
    });
    // Nariko: pale blue skin, glowing blue shadow, closed eyes, blue lips, sparkles
    T.face_nr = cv('face_nr', 256, 256, (c, W) => {
      c.fillStyle = '#b9d2ee'; c.fillRect(0, 0, W, W);
      for (const x of [88, 168]) { ell(c, x, 140, 38, 20, 'rgba(40,110,230,.75)'); ell(c, x, 140, 22, 10, 'rgba(150,220,255,.7)'); lash(c, x, 150, 34, '#0c1630'); for (let k = 0; k < 6; k++) dot(c, x - 30 + k * 12, 122 + (k % 2) * 6, 2, '#eaf6ff'); }
      ell(c, 128, 206, 11, 6, '#2a4fa8'); ell(c, 128, 203, 6, 3, '#6f9fe8');
    });
    // Ostara: white skin, dark sockets with glowing teal eyes, black streaks, stitched mouth, a star on the forehead
    T.face_os = cv('face_os', 256, 256, (c, W) => {
      c.fillStyle = '#ebe9f0'; c.fillRect(0, 0, W, W);
      for (const x of [88, 168]) { ell(c, x, 146, 30, 24, '#1a2226'); ell(c, x, 146, 14, 12, '#6ff2e0'); dot(c, x, 146, 6, '#d8fffa'); c.strokeStyle = '#1a2226'; c.lineWidth = 7; c.beginPath(); c.moveTo(x, 168); c.lineTo(x - 3, 214); c.stroke(); }
      c.fillStyle = '#1a2226'; c.beginPath(); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, r = k % 2 ? 4 : 13; c.lineTo(128 + Math.cos(a) * r, 108 + Math.sin(a) * r); } c.fill();
      dot(c, 122, 182, 3, '#1a2226'); dot(c, 134, 182, 3, '#1a2226');
      c.strokeStyle = '#1a2226'; c.lineWidth = 3; c.beginPath(); c.moveTo(116, 204); c.lineTo(140, 204); c.stroke(); for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(118 + k * 7, 198); c.lineTo(118 + k * 7, 210); c.stroke(); }
    });
    // Mamoru: a white skull mask on black fur, green slit eyes, orange dots, whiskers
    T.face_mamoru = cv('face_mamoru', 256, 256, (c, W) => {
      c.fillStyle = '#171415'; c.fillRect(0, 0, W, W);
      ell(c, 128, 150, 92, 78, '#efe9de'); ell(c, 128, 212, 40, 22, '#efe9de');
      for (const x of [86, 170]) { ell(c, x, 140, 34, 30, '#171415'); catEye(c, x, 140, '#3fbf6a'); for (let k = 0; k < 3; k++) dot(c, x + (x < 128 ? -38 : 38), 112 + k * 14, 4, '#f08a1c'); }
      c.fillStyle = '#171415'; c.beginPath(); c.moveTo(118, 176); c.lineTo(138, 176); c.lineTo(128, 190); c.fill();
      c.strokeStyle = '#171415'; c.lineWidth = 3; c.beginPath(); c.moveTo(104, 206); c.quadraticCurveTo(128, 222, 152, 206); c.stroke(); for (let k = 0; k < 5; k++) { c.beginPath(); c.moveTo(110 + k * 9, 204 + (k === 2 ? 4 : 2)); c.lineTo(110 + k * 9, 214); c.stroke(); }
      c.strokeStyle = '#efe9de'; c.lineWidth = 2.5; for (const sd of [-1, 1]) for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(128 + sd * 60, 192 + k * 8); c.lineTo(128 + sd * 124, 180 + k * 14); c.stroke(); }
    });
    // Mochi: white fur, red and black patches by the ears, green eyes, pink nose, a smile, red cheek marks
    T.face_mochi = cv('face_mochi', 256, 256, (c, W) => {
      c.fillStyle = '#f8f4ef'; c.fillRect(0, 0, W, W);
      ell(c, 40, 40, 70, 60, '#d63a44'); ell(c, 222, 46, 60, 52, '#1c1a1c'); ell(c, 210, 40, 40, 30, '#d63a44');
      for (const x of [86, 170]) catEye(c, x, 140, '#4cc06a');
      for (const sd of [-1, 1]) { ell(c, 128 + sd * 66, 182, 18, 9, 'rgba(230,80,100,.55)'); for (let k = 0; k < 3; k++) { c.strokeStyle = '#7a7070'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(128 + sd * 50, 190 + k * 8); c.lineTo(128 + sd * 122, 178 + k * 14); c.stroke(); } }
      ell(c, 128, 180, 10, 7, '#f08aa0'); c.strokeStyle = '#3a2a2a'; c.lineWidth = 3; c.beginPath(); c.moveTo(108, 194); c.quadraticCurveTo(118, 206, 128, 194); c.quadraticCurveTo(138, 206, 148, 194); c.stroke();
    });
    // cat coats (planar on the body's front): Mamoru's skeleton, Mochi's patches
    T.coat_mamoru = cv('coat_mamoru', 256, 256, (c, W) => {
      c.fillStyle = '#171415'; c.fillRect(0, 0, W, W); c.strokeStyle = '#efe9de'; c.lineCap = 'round';
      c.lineWidth = 10; c.beginPath(); c.moveTo(128, 30); c.lineTo(128, 190); c.stroke();
      c.lineWidth = 8; for (let k = 0; k < 4; k++) { const y = 60 + k * 26; for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(128, y); c.quadraticCurveTo(128 + sd * 70, y - 8, 128 + sd * 74, y + 22); c.stroke(); } }
      ell(c, 128, 200, 40, 22, '#efe9de'); ell(c, 128, 204, 18, 10, '#171415');
    });
    T.coat_mochi = cv('coat_mochi', 256, 256, (c, W) => { c.fillStyle = '#f8f4ef'; c.fillRect(0, 0, W, W); ell(c, 128, 150, 70, 80, '#fbe3ea'); ell(c, 34, 80, 40, 50, '#d63a44'); ell(c, 220, 190, 46, 40, '#1c1a1c'); ell(c, 228, 120, 26, 30, '#d63a44'); });
    // kimonos (wrapped round the body: u 0..1 = once round; the front is at u .75)
    const kimono = (name, base, draw) => cv(name, 512, 256, (c, W, H) => { c.fillStyle = base; c.fillRect(0, 0, W, H); draw(c, W, H); });
    const collar = (c, col, edge) => { c.fillStyle = col; c.beginPath(); c.moveTo(384 - 46, 0); c.lineTo(384, 70); c.lineTo(384 + 46, 0); c.fill(); c.strokeStyle = edge; c.lineWidth = 8; c.beginPath(); c.moveTo(384 - 52, 0); c.lineTo(384, 78); c.lineTo(384 + 52, 0); c.stroke(); };
    T.kimono_fm = kimono('kimono_fm', '#141113', (c, W, H) => {
      const skull = (x, y, s) => { ell(c, x, y, 9 * s, 8 * s, '#f2ece4'); c.fillRect(x - 5 * s, y + 4 * s, 10 * s, 6 * s); dot(c, x - 3.5 * s, y, 2.4 * s, '#141113'); dot(c, x + 3.5 * s, y, 2.4 * s, '#141113'); };
      for (let y = 18; y < H; y += 36) for (let x = (y / 36 % 2) * 22; x < W; x += 44) skull(x, y, 1.2);
      c.fillStyle = '#a3141c'; c.fillRect(384 - 60, 0, 120, H); c.strokeStyle = '#e8b04a'; c.lineWidth = 2.5; for (let y = 10; y < H; y += 18) for (let x = 384 - 60; x < 384 + 60; x += 20) { c.beginPath(); c.arc(x, y, 9, Math.PI, 2 * Math.PI); c.stroke(); }
      collar(c, '#f2ece4', '#a3141c');
    });
    T.kimono_nr = kimono('kimono_nr', '#0e1a3c', (c, W, H) => {
      c.strokeStyle = '#a9c4e8'; c.lineWidth = 2.5; for (let y = 8; y < H * .45; y += 14) for (let x = (y / 14 % 2) * 9; x < W; x += 18) { c.beginPath(); c.arc(x, y, 9, Math.PI, 2 * Math.PI); c.stroke(); }
      c.strokeStyle = '#4a6cb8'; c.lineWidth = 4; for (let k = 0; k < 14; k++) { const x = (k * 77) % W, y = H * .62 + (k % 3) * 26; c.beginPath(); c.arc(x, y, 12, .2, 3); c.arc(x + 18, y - 4, 10, 3.6, 6); c.stroke(); }
      c.fillStyle = '#c9d6e8'; c.fillRect(384 - 30, H * .45, 60, H * .55); collar(c, '#c9d6e8', '#5a7cc8');
    });
    T.kimono_os = kimono('kimono_os', '#0f3a3a', (c, W, H) => {
      const bun = (x, y) => { c.fillStyle = '#2f7a72'; ell(c, x, y, 12, 8, '#2f7a72'); ell(c, x + 10, y - 6, 6, 6, '#2f7a72'); ell(c, x + 8, y - 16, 2.5, 8, '#2f7a72', -.3); ell(c, x + 13, y - 15, 2.5, 8, '#2f7a72', .2); };
      for (let y = 40; y < H; y += 46) for (let x = (y / 46 % 2) * 30; x < W; x += 60) bun(x, y);
      for (let k = 0; k < 10; k++) { const x = (k * 113) % W, y = 20 + (k * 53) % H; c.strokeStyle = '#7fd8c8'; c.lineWidth = 3; c.beginPath(); c.arc(x, y, 8, .8, 5.4); c.stroke(); }
      c.fillStyle = '#101416'; c.fillRect(384 - 34, 0, 68, H); c.strokeStyle = '#d8e4e4'; c.lineWidth = 5; c.beginPath(); c.arc(384, H * .5, 16, .7, 5.6); c.stroke();
      collar(c, '#101416', '#2f7a72');
    });
    // Chumpz: palm fronds (leaflets slanting off the midrib), banana leaves (fine parallel veins), ringed palm bark
    const pl = noise(S, 6, 3, 61);
    T.palm_leaf = pixelTex(scene, 'palm_leaf', S, (x, y, i) => { const g = (Math.abs(x - .5) * 3 + y * 9) % 1, f = (g < .14 ? .55 : .9 + .12 * pl[i]) * (Math.abs(x - .5) < .03 ? .7 : 1); return [58 * f, 112 * f, 34 * f]; });
    T.banana_leaf = pixelTex(scene, 'banana_leaf', S, (x, y, i) => { const v = (y * 40 + Math.abs(x - .5) * 6) % 1, f = (v < .1 ? .82 : 1) * (.9 + .15 * pl[i]) * (Math.abs(x - .5) < .025 ? .8 : 1); return [92 * f, 150 * f, 46 * f]; });
    T.palm_bark = pixelTex(scene, 'palm_bark', S, (x, y, i) => { const r = (y * 6) % 1, f = (r < .18 ? .55 : .85 + .12 * pl[i]); return [110 * f, 88 * f, 62 * f]; });
    // weathered painted planks (paint chipped to the wood), patchwork corrugated tin, the giant banana, brick, bottles
    const pk = noise(S, 10, 4, 62), pk2 = noise(S, 3, 3, 63);
    const planks = (name, paint) => pixelTex(scene, name, S, (x, y, i) => { const col = (x * 6) % 1; if (col < .04) return [40, 28, 18]; const chip = pk[i] + .35 * pk2[i] > 1.02; const f = .82 + .18 * Math.sin(y * 40 + Math.floor(x * 6) * 3) * .3 + .1 * pk[i]; return chip ? mul([122, 88, 56], f) : mul(paint, f); });
    T.plank_teal = planks('plank_teal', [74, 168, 160]); T.plank_yellow = planks('plank_yellow', [222, 182, 72]); T.plank_red = planks('plank_red', [176, 64, 52]);
    const tins = [[70, 120, 170], [168, 64, 56], [78, 160, 150], [150, 92, 52], [140, 140, 136], [196, 150, 60]];
    T.tin_roof = pixelTex(scene, 'tin_roof', S, (x, y, i) => { const b = tins[(Math.floor(x * 2) * 3 + Math.floor(y * 2) * 2 + Math.floor(x * 2) * Math.floor(y * 2)) % tins.length], r = .78 + .22 * Math.sin(x * S * .9); const rust = pk[i] > .78 ? .55 : 1; return mul(rust < 1 ? [130, 70, 40] : b, r * (.88 + .15 * pk2[i])); });
    T.banana_big = pixelTex(scene, 'banana_big', S, (x, y, i) => { const st = (x * 5) % 1 < .05 ? .7 : 1, spot = pk[i] > .8 ? .45 : 1; return mul([238, 196, 66], st * spot * (.9 + .12 * pk2[i])); });
    T.brick = pixelTex(scene, 'brick', S, (x, y, i) => { const row = Math.floor(y * 8), col = (x * 4 + (row % 2) * .5) % 1; if ((y * 8) % 1 < .1 || col < .05) return [180, 170, 150]; return mul([150, 80, 60], .8 + .3 * pk[i]); });
    T.bottles = cv('bottles', 512, 256, (c, W, H) => { c.fillStyle = '#4a2e18'; c.fillRect(0, 0, W, H); const r = rng(64); for (let row = 0; row < 3; row++) { c.fillStyle = '#2a1a0c'; c.fillRect(0, row * H / 3 + H / 3 - 10, W, 10); for (let x = 6; x < W - 10; x += 14 + r() * 6) { c.fillStyle = ['#2f7a3a', '#7a4a1c', '#c9d8d0', '#3a6aa0', '#a82a2a'][Math.floor(r() * 5)]; const h = 40 + r() * 30, y0 = row * H / 3 + H / 3 - 10 - h; c.fillRect(x, y0 + h * .3, 10, h * .7); c.fillRect(x + 3, y0, 4, h * .32); } } });
    T.sign_fishbook = bannerTex(scene, 'chz_fishbook', '#3d6a88', '#ece6d4', 'fishbook', false, true);
    T.sign_chzdice = bannerTex(scene, 'chz_dice', '#a8282c', '#f6efe2', 'dice', false, true);
    // ── Chumpz apes (Miguel's NFTs): fur (grey, tinted per ape), faces, muzzles, torsos (u once round, front at .75) ──
    const furStrokes = (c, W, H, base, dk, lt, seed) => {
      c.fillStyle = base; c.fillRect(0, 0, W, H); const r = rng(seed); c.lineCap = 'round';
      for (let k = 0; k < W * H / 80; k++) { const x = r() * W, y = r() * H, L = 5 + r() * 9, a = Math.PI / 2 + (r() - .5) * .9; c.strokeStyle = r() < .5 ? dk : lt; c.globalAlpha = .25 + r() * .35; c.lineWidth = 1.2 + r() * 1.4; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); c.stroke(); }
      c.globalAlpha = 1;
    };
    T.fur = cv('fur', 256, 256, (c, W) => furStrokes(c, W, W, '#d9d9d9', '#8c8c8c', '#ffffff', 73)); T.fur.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
    for (const [id, o] of Object.entries(APE_LOOK)) {
      T['face_' + id] = cv('face_' + id, 256, 256, (c, W) => {
        furStrokes(c, W, W, o.fur, o.furD, o.furL, 81);
        c.fillStyle = o.skin; c.beginPath(); c.ellipse(128, 168, 80, 92, 0, 0, 7); c.fill(); ell(c, 94, 120, 46, 38, o.skin); ell(c, 162, 120, 46, 38, o.skin); // heart-shaped bare face
        c.strokeStyle = o.skinD; c.lineCap = 'round'; c.lineWidth = 2.5;
        for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(102, 96 + k * 7); c.quadraticCurveTo(128, 90 + k * 7, 154, 96 + k * 7); c.stroke(); } // forehead lines
        for (const x of [96, 160]) {
          ell(c, x, 142, 18, 11, o.eye); if (o.pupil) dot(c, x + (x < 128 ? 2 : -2), 142, 5.5, o.pupil);
          c.strokeStyle = '#1a1210'; c.lineWidth = 3.5; c.beginPath(); c.ellipse(x, 142, 18, 11, 0, 0, 7); c.stroke();
          c.lineWidth = 5; c.beginPath(); c.moveTo(x - 21, 136); c.quadraticCurveTo(x, 124, x + 21, 136); c.stroke(); // the heavy lid
          c.strokeStyle = o.skinD; c.lineWidth = 2.5; c.beginPath(); c.moveTo(x - 15, 159); c.quadraticCurveTo(x, 166, x + 15, 159); c.stroke(); // bags
          c.beginPath(); c.moveTo(x - 12, 168); c.quadraticCurveTo(x, 173, x + 12, 168); c.stroke();
        }
        c.lineWidth = 3; c.beginPath(); c.moveTo(121, 152); c.lineTo(117, 196); c.moveTo(135, 152); c.lineTo(139, 196); c.stroke(); // nose bridge
      });
      T['muzzle_' + id] = cv('muzzle_' + id, 256, 256, (c, W) => {
        c.fillStyle = o.skin; c.fillRect(0, 0, W, W);
        for (const sd of [-1, 1]) ell(c, 128 + sd * 22, 96, 13, 8, '#26160f', sd * .5); // nostrils
        c.strokeStyle = o.skinD; c.lineCap = 'round'; c.lineWidth = 3; c.beginPath(); c.moveTo(128, 108); c.lineTo(128, 142); c.stroke();
        if (o.grin) { // the racer's big toothy grin
          c.fillStyle = '#f3eee2'; c.beginPath(); c.ellipse(128, 170, 66, 26, 0, 0, 7); c.fill(); c.strokeStyle = '#2a1a12'; c.lineWidth = 5; c.stroke();
          c.lineWidth = 2.5; c.beginPath(); c.moveTo(64, 170); c.lineTo(192, 170); c.stroke(); for (let k = -4; k <= 4; k++) { c.beginPath(); c.moveTo(128 + k * 13, 146 + Math.abs(k) * 1.5); c.lineTo(128 + k * 13, 194 - Math.abs(k) * 1.5); c.stroke(); }
        } else { c.strokeStyle = '#2a1a12'; c.lineWidth = 5; c.beginPath(); c.moveTo(70, 172); c.quadraticCurveTo(128, 162, 186, 172); c.stroke(); }
        c.strokeStyle = o.skinD; c.lineWidth = 2.5; c.beginPath(); c.moveTo(104, 214); c.quadraticCurveTo(128, 224, 152, 214); c.stroke();
      });
      T['torso_' + id] = cv('torso_' + id, 512, 256, (c, W, H) => {
        furStrokes(c, W, H, o.fur, o.furD, o.furL, 91);
        const F = 384, B = 128; // front and back centres
        if (o.top === 'overalls') {
          c.fillStyle = o.cloth; c.fillRect(0, 168, W, H - 168); c.fillRect(F - 72, 56, 144, 120);
          c.strokeStyle = o.cloth; c.lineWidth = 24; for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(F + sd * 58, 70); c.lineTo(F + sd * 74, -4); c.stroke(); c.beginPath(); c.moveTo(B + sd * 74, -4); c.lineTo(B - sd * 20, 172); c.stroke(); }
          c.strokeStyle = o.clothL; c.lineWidth = 2; c.setLineDash([6, 5]); c.strokeRect(F - 64, 64, 128, 104); c.strokeRect(F - 34, 92, 68, 50); c.beginPath(); c.moveTo(0, 180); c.lineTo(W, 180); c.stroke(); c.setLineDash([]);
          c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 3; const r = rng(17); for (let k = 0; k < 60; k++) { const x = r() * W, y = 170 + r() * 86; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 6, y + 14); c.stroke(); }
          for (const sd of [-1, 1]) { dot(c, F + sd * 56, 70, 8, '#d0a640'); dot(c, F + sd * 56, 70, 3, '#7a5a18'); }
        } else if (o.top === 'tank') {
          c.fillStyle = o.cloth; c.fillRect(0, 118, W, H - 118); c.fillRect(F - 74, 22, 148, 100); c.fillRect(B - 74, 22, 148, 100);
          c.fillStyle = o.fur; c.beginPath(); c.ellipse(F, 22, 42, 30, 0, 0, 7); c.fill(); // the neckline
          c.fillStyle = '#121110'; c.strokeStyle = '#121110'; c.lineCap = 'round'; // the gorilla print
          dot(c, F, 104, 15); c.beginPath(); c.ellipse(F, 140, 36, 25, 0, 0, 7); c.fill(); c.lineWidth = 13;
          for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(F + sd * 26, 126); c.lineTo(F + sd * 42, 176); c.stroke(); c.beginPath(); c.moveTo(F + sd * 14, 158); c.lineTo(F + sd * 16, 178); c.stroke(); }
          c.fillStyle = o.pants; c.fillRect(0, 206, W, 50);
        } else { // bare chest: lighter skin on the chest and belly, shorts
          ell(c, F - 34, 104, 38, 27, o.chest); ell(c, F + 34, 104, 38, 27, o.chest); ell(c, F, 156, 36, 34, o.chest);
          c.strokeStyle = o.skinD; c.lineWidth = 2; c.beginPath(); c.moveTo(F, 86); c.lineTo(F, 186); c.moveTo(F - 30, 152); c.lineTo(F + 30, 152); c.moveTo(F - 28, 170); c.lineTo(F + 28, 170); c.stroke();
          for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(F + sd * 4, 128); c.quadraticCurveTo(F + sd * 40, 140, F + sd * 70, 118); c.stroke(); dot(c, F + sd * 34, 112, 3, o.skinD); }
          c.fillStyle = o.pants; c.fillRect(0, 206, W, 50);
        }
      });
    }
    T.ape_bandana = cv('ape_bandana', 128, 128, (c, W) => { c.fillStyle = '#2a5cc8'; c.fillRect(0, 0, W, W); for (let y = 8; y < W; y += 24) for (let x = (y / 24 % 2) * 12 + 6; x < W; x += 24) { dot(c, x, y, 4, '#eef2fa'); c.strokeStyle = '#eef2fa'; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, 7, 0, 7); c.stroke(); } c.strokeStyle = '#eef2fa'; c.lineWidth = 3; c.strokeRect(2, 2, W - 4, W - 4); });
    T.band_rb = cv('band_rb', 256, 64, (c, W, H) => { c.fillStyle = '#c4242a'; c.fillRect(0, 0, W, H); c.fillStyle = '#2346b0'; for (let x = 0; x < W; x += 40) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 18, 0); c.lineTo(x + 30, 22); c.lineTo(x + 12, 40); c.lineTo(x + 26, 64); c.lineTo(x + 6, 64); c.lineTo(x - 4, 38); c.lineTo(x + 8, 20); c.fill(); } });
    T.cap_logo = cv('cap_logo', 256, 128, (c, W, H) => {
      c.fillStyle = '#1f5fd6'; c.fillRect(0, 0, W, H); c.fillStyle = '#d8282c'; for (const x of [70, 104]) { c.beginPath(); c.moveTo(x, 8); c.lineTo(x + 30, 8); c.lineTo(x + 18, 34); c.lineTo(x - 12, 34); c.fill(); }
      c.textAlign = 'center'; c.font = 'italic bold 52px Arial'; c.lineWidth = 7; c.strokeStyle = '#c82024'; c.strokeText('CHUMPZ', 128, 84); c.fillStyle = '#ffffff'; c.fillText('CHUMPZ', 128, 84);
      c.font = 'italic bold 20px Arial'; c.fillText('RACING', 128, 112); c.strokeStyle = '#ffffff'; c.lineWidth = 4; c.strokeRect(3, 3, W - 6, H - 6);
    });
    T.patch_apechain = cv('patch_apechain', 256, 96, (c, W, H) => { c.fillStyle = '#2062d8'; c.fillRect(0, 0, W, H); c.textAlign = 'center'; c.fillStyle = '#ffffff'; c.font = 'bold 40px Arial'; c.fillText('APECHAIN', 128, 62); c.strokeStyle = '#ffffff'; c.lineWidth = 4; c.strokeRect(5, 5, W - 10, H - 10); });
    // ── Saints of LA: angel murals, the winged-halo emblem, signs, the court, facades for the city blocks ──
    const wingFan = (c, x, y, s, dir, col, edge) => { // a spread wing, root at (x, y), sweeping up and out to dir (+1 right / -1 left)
      c.fillStyle = col; c.strokeStyle = edge; c.lineWidth = 2;
      for (let row = 2; row >= 0; row--) for (let k = 11; k >= 0; k--) {
        const t = k / 11, rx = x + dir * s * .8 * t, ry = y - s * .5 * Math.sin(t * Math.PI * .55) + row * s * .07;
        const L = s * (.18 + .42 * t) * (1 - row * .25), ang = Math.PI / 2 - dir * (.35 + 1.0 * t), cx = rx + Math.cos(ang) * L * .5, cy = ry + Math.sin(ang) * L * .5;
        c.beginPath(); c.ellipse(cx, cy, L * .5, L * .11, ang, 0, 7); c.fill(); c.stroke();
      }
    };
    const halo = (c, x, y, rx, ry, w, col) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 7); c.stroke(); };
    T.emblem_saints = cv('emblem_saints', 256, 256, (c, W) => { // gold wings rising from a shield under a halo, on navy
      c.fillStyle = '#16244a'; c.fillRect(0, 0, W, W);
      halo(c, 128, 58, 46, 14, 9, '#e0b44c');
      wingFan(c, 118, 150, 120, -1, '#d9aa45', '#8a6420'); wingFan(c, 138, 150, 120, 1, '#d9aa45', '#8a6420');
      c.fillStyle = '#e8bf58'; c.beginPath(); c.moveTo(128, 100); c.lineTo(150, 130); c.lineTo(128, 214); c.lineTo(106, 130); c.fill();
    });
    T.mural_angel = cv('mural_angel', 512, 512, (c, W) => { // a painted angel: blue sky, white wings, gold halo, sunflowers
      const g = c.createLinearGradient(0, 0, 0, W); g.addColorStop(0, '#2c5ea8'); g.addColorStop(1, '#173a78'); c.fillStyle = g; c.fillRect(0, 0, W, W);
      for (let k = 0; k < 40; k++) { c.fillStyle = `rgba(255,255,255,${.04 + .05 * (k % 3)})`; c.beginPath(); c.arc((k * 97) % W, (k * 53) % W, 10 + (k % 5) * 6, 0, 7); c.fill(); }
      wingFan(c, 220, 250, 260, -1, '#f4f1ea', '#9aa4b8'); wingFan(c, 292, 250, 260, 1, '#f4f1ea', '#9aa4b8');
      c.fillStyle = '#1e3d82'; c.beginPath(); c.moveTo(256, 230); c.lineTo(340, 512); c.lineTo(172, 512); c.fill(); // robe
      c.fillStyle = '#c0894f'; c.beginPath(); c.ellipse(256, 200, 46, 58, 0, 0, 7); c.fill(); // face
      c.fillStyle = '#2a1a12'; c.beginPath(); c.ellipse(256, 178, 58, 66, 0, Math.PI, 0); c.fill(); c.fillRect(198, 178, 18, 110); c.fillRect(296, 178, 18, 110); // hair
      c.fillStyle = '#2a1a12'; for (const x of [238, 274]) { c.beginPath(); c.ellipse(x, 202, 7, 4, 0, 0, 7); c.fill(); }
      c.strokeStyle = '#8a3a2a'; c.lineWidth = 4; c.beginPath(); c.moveTo(244, 234); c.quadraticCurveTo(256, 240, 268, 234); c.stroke();
      halo(c, 256, 110, 70, 20, 12, '#f0c050'); halo(c, 256, 200, 110, 110, 6, 'rgba(240,192,80,.55)');
      for (const [x, y, r] of [[60, 440, 40], [130, 470, 34], [450, 440, 42], [390, 480, 30], [470, 330, 26]]) { // sunflowers
        c.fillStyle = '#f2b72a'; for (let k = 0; k < 12; k++) { const a = k * .5236; c.beginPath(); c.ellipse(x + Math.cos(a) * r * .7, y + Math.sin(a) * r * .7, r * .35, r * .14, a, 0, 7); c.fill(); }
        c.fillStyle = '#5a3412'; c.beginPath(); c.arc(x, y, r * .38, 0, 7); c.fill();
      }
    });
    T.mural_wings = cv('mural_wings', 512, 512, (c, W) => { c.fillStyle = '#1b2c5c'; c.fillRect(0, 0, W, W); halo(c, 256, 120, 90, 26, 14, '#e8b84c'); wingFan(c, 236, 300, 300, -1, '#dcac48', '#7a5418'); wingFan(c, 276, 300, 300, 1, '#dcac48', '#7a5418'); });
    const saintSign = (name, draw) => cv(name, 256, 256, (c, W) => { c.fillStyle = '#16244a'; c.fillRect(0, 0, W, W); c.strokeStyle = '#d9aa45'; c.lineWidth = 8; c.strokeRect(10, 10, W - 20, W - 20); halo(c, 128, 62, 50, 14, 8, '#e8bf58'); c.strokeStyle = '#e8bf58'; c.fillStyle = '#e8bf58'; c.lineWidth = 9; c.lineJoin = 'round'; draw(c); });
    T.sign_saints_book = saintSign('sign_saints_book', c => { c.beginPath(); c.moveTo(128, 120); c.quadraticCurveTo(84, 104, 44, 118); c.lineTo(44, 200); c.quadraticCurveTo(84, 188, 128, 204); c.quadraticCurveTo(172, 188, 212, 200); c.lineTo(212, 118); c.quadraticCurveTo(172, 104, 128, 120); c.lineTo(128, 204); c.stroke(); });
    T.sign_saints_game = saintSign('sign_saints_game', c => {
      c.beginPath(); c.moveTo(70, 120); c.lineTo(186, 120); c.quadraticCurveTo(222, 122, 226, 170); c.quadraticCurveTo(230, 214, 200, 210); c.quadraticCurveTo(184, 206, 172, 186); c.lineTo(84, 186); c.quadraticCurveTo(72, 206, 56, 210); c.quadraticCurveTo(26, 214, 30, 170); c.quadraticCurveTo(34, 122, 70, 120); c.fill();
      c.fillStyle = '#16244a'; c.fillRect(64, 146, 34, 10); c.fillRect(76, 134, 10, 34); for (const [x, y] of [[176, 140], [196, 156], [156, 156], [176, 172]]) { c.beginPath(); c.arc(x, y, 7, 0, 7); c.fill(); }
    });
    T.court_tex = cv('court_tex', 512, 256, (c, W, H) => { // basketball court: blue court, orange keys and centre, white lines
      c.fillStyle = '#5d6f9c'; c.fillRect(0, 0, W, H); c.fillStyle = '#2e4f9e'; c.fillRect(16, 16, W - 32, H - 32);
      c.fillStyle = '#d0763a'; c.fillRect(16, 88, 92, 80); c.fillRect(W - 108, 88, 92, 80); c.beginPath(); c.arc(W / 2, H / 2, 30, 0, 7); c.fill();
      c.strokeStyle = '#f2f2ee'; c.lineWidth = 4; c.strokeRect(16, 16, W - 32, H - 32); c.beginPath(); c.moveTo(W / 2, 16); c.lineTo(W / 2, H - 16); c.stroke();
      c.beginPath(); c.arc(W / 2, H / 2, 30, 0, 7); c.stroke(); c.strokeRect(16, 88, 92, 80); c.strokeRect(W - 108, 88, 92, 80);
      for (const [x, s] of [[16, 1], [W - 16, -1]]) { c.beginPath(); c.arc(x + s * 92, H / 2, 40, -Math.PI / 2, Math.PI / 2, s < 0); c.stroke(); c.beginPath(); c.moveTo(x, 30); c.lineTo(x + s * 60, 30); c.arc(x + s * 20, H / 2, 98, -Math.PI / 2 + .25, Math.PI / 2 - .25, s < 0); c.lineTo(x, H - 30); c.stroke(); }
    });
    T.garage_int = cv('garage_int', 512, 256, (c, W, H) => { // the shop's back wall: tool chests, shelves, a tyre stack, a neon sign
      c.fillStyle = '#5c6066'; c.fillRect(0, 0, W, H); c.fillStyle = '#4a4e54'; c.fillRect(0, H * .72, W, H * .28);
      for (const x of [30, 200, 380]) { c.fillStyle = '#b8262a'; c.fillRect(x, 120, 90, 64); c.fillStyle = '#7a1416'; for (let k = 0; k < 5; k++) c.fillRect(x + 6, 126 + k * 11, 78, 4); }
      c.fillStyle = '#3a3a3e'; for (const y of [40, 80]) c.fillRect(130, y, 60, 6); c.fillStyle = '#d0a040'; for (let k = 0; k < 6; k++) c.fillRect(134 + k * 9, 62, 6, 18);
      c.fillStyle = '#1a1a1c'; for (let k = 0; k < 4; k++) { c.beginPath(); c.ellipse(320, 178 - k * 18, 26, 9, 0, 0, 7); c.fill(); }
      c.fillStyle = '#4fc0ff'; c.font = 'bold 30px Arial'; c.textAlign = 'center'; c.fillText('SAINTS AUTO', 256, 30);
    });
    T.arcade_int = cv('arcade_int', 512, 256, (c, W, H) => { c.fillStyle = '#120e22'; c.fillRect(0, 0, W, H); const cols = ['#ff3b8d', '#3be0ff', '#ffd43b', '#7cff5a', '#b25aff']; for (let k = 0; k < 7; k++) { const x = 20 + k * 70; c.fillStyle = '#222'; c.fillRect(x, 70, 50, 150); c.fillStyle = cols[k % 5]; c.fillRect(x + 6, 84, 38, 34); c.fillRect(x, 60, 50, 12); } c.fillStyle = 'rgba(180,90,255,.4)'; c.fillRect(0, 0, W, 24); });
    T.door_glass = cv('door_glass', 256, 256, (c, W) => { c.fillStyle = '#2a2420'; c.fillRect(0, 0, W, W); const g = c.createLinearGradient(0, 0, 0, W); g.addColorStop(0, '#f0c27a'); g.addColorStop(1, '#a8743c'); c.fillStyle = g; for (const x of [18, 134]) c.fillRect(x, 20, 104, 228); c.fillStyle = 'rgba(60,40,24,.5)'; c.fillRect(40, 150, 60, 98); c.fillRect(160, 120, 40, 128); c.fillStyle = '#c9a050'; for (const x of [112, 140]) c.fillRect(x, 120, 6, 40); c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(18, 20, 30, 228); c.fillRect(134, 20, 30, 228); });
    T.rollup = cv('rollup', 128, 128, (c, W) => { c.fillStyle = '#9aa0a6'; c.fillRect(0, 0, W, W); c.fillStyle = '#7d838a'; for (let y = 0; y < W; y += 8) c.fillRect(0, y, W, 3); }); T.rollup.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
    // facades for the city blocks (one tile = one bay of one storey; TILE gives its size in metres)
    const facade = (name, wall, glass, draw) => { const t = cv(name, 256, 256, (c, W) => { c.fillStyle = wall; c.fillRect(0, 0, W, W); draw(c, W, glass); }); t.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE; return t; };
    const sash = (c, x, y, w, h, glass, frame) => { c.fillStyle = frame; c.fillRect(x - 5, y - 5, w + 10, h + 12); c.fillStyle = glass; c.fillRect(x, y, w, h); c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(x, y, w * .4, h); c.fillStyle = frame; c.fillRect(x + w / 2 - 2, y, 4, h); };
    T.facade_apt = facade('facade_apt', '#d8c4a2', '#3b4a5a', (c, W, g) => { for (const x of [36, 146]) sash(c, x, 70, 74, 110, g, '#f0e6d4'); });
    T.facade_stucco = facade('facade_stucco', '#e6d7ba', '#33465c', (c, W, g) => { sash(c, 60, 64, 136, 104, g, '#f6efe2'); c.fillStyle = 'rgba(0,0,0,.06)'; c.fillRect(0, 236, W, 20); });
    T.facade_brick = facade('facade_brick', '#9a4e36', '#2e3a48', (c, W, g) => { c.fillStyle = 'rgba(0,0,0,.15)'; for (let y = 0; y < W; y += 12) { c.fillRect(0, y, W, 2); for (let x = (y / 12 % 2) * 14; x < W; x += 28) c.fillRect(x, y, 2, 12); } for (const x of [40, 150]) { c.fillStyle = '#d8cbb4'; c.fillRect(x - 6, 52, 78, 8); sash(c, x, 62, 66, 120, g, '#5a2a1c'); } });
    T.facade_office = facade('facade_office', '#b8b6b0', '#2c3e56', (c, W, g) => { c.fillStyle = g; c.fillRect(0, 70, W, 120); c.fillStyle = 'rgba(255,255,255,.15)'; c.fillRect(0, 70, W, 30); c.fillStyle = '#9a9890'; for (let x = 0; x < W; x += 64) c.fillRect(x, 70, 6, 120); });
    T.facade_glass = facade('facade_glass', '#3c5878', '#5e86ad', (c, W) => { for (let y = 0; y < W; y += 64) for (let x = 0; x < W; x += 64) { c.fillStyle = (x * 7 + y * 3) % 5 ? '#4f7398' : '#7da2c4'; c.fillRect(x + 3, y + 3, 58, 58); } c.fillStyle = '#9fb4c8'; for (let x = 0; x < W; x += 64) c.fillRect(x, 0, 3, W); for (let y = 0; y < W; y += 64) c.fillRect(0, y, W, 3); });
    T.facade_shop = facade('facade_shop', '#cdbb98', '#2f3f52', (c, W, g) => { c.fillStyle = g; c.fillRect(14, 50, 228, 150); c.fillStyle = 'rgba(255,220,150,.35)'; c.fillRect(14, 120, 228, 80); c.fillStyle = '#5a4a36'; for (const x of [14, 128, 236]) c.fillRect(x, 50, 6, 150); });
    T.parking = cv('parking', 256, 256, (c, W) => { c.fillStyle = '#3a3a3c'; c.fillRect(0, 0, W, W); c.fillStyle = '#d8d8d0'; for (let x = 0; x < W; x += 32) { c.fillRect(x, 0, 4, 100); c.fillRect(x, 156, 4, 100); } });
    const tt = noise(S, 2, 3, 41); // tatami: woven rush, a black cloth border
    T.tatami = pixelTex(scene, 'tatami', S, (x, y, i) => { const e = Math.min(x, 1 - x, y, 1 - y); if (e < .025) return [26, 24, 20]; const f = (.84 + .1 * Math.sin(y * S * 2.2) + .08 * tt[i]); return [184 * f, 168 * f, 104 * f]; });
    const mp = noise(S, 4, 4, 42); // the campaign map on the dojo's table: land, hills, a river
    // rooms: the sunlit view out of the doorway; hanging scrolls (a column of brush characters, a red seal, silk mount)
    // the Forest Dojo's open sides: layered pines in soft light; the sky through its roof well, leaves round the rim
    T.forestview = cv('forestview', 512, 256, (c, W, H) => {
      let sd = 7; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
      const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#d6e8dc'); g.addColorStop(.55, '#eef3dc'); g.addColorStop(.62, '#a9c48e'); g.addColorStop(1, '#4f7234'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      for (const [y0, hgt, col, n, w] of [[150, 70, '#9db8a2', 30, 22], [168, 110, '#5f8a5c', 22, 30], [190, 170, '#2f5530', 14, 44]]) {
        c.fillStyle = col;
        for (let k = 0; k < n; k++) { const x = r() * W, h = hgt * (.7 + .5 * r()), ww = w * (.7 + .5 * r()); c.beginPath(); c.moveTo(x, y0 - h); c.lineTo(x + ww / 2, y0); c.lineTo(x - ww / 2, y0); c.closePath(); c.fill(); c.fillRect(x - ww / 2, y0, ww, 4); }
      }
      c.fillStyle = 'rgba(240,246,226,.35)'; c.fillRect(0, 150, W, 18);
      for (let k = 0; k < 7; k++) { const x = r() * W, w = 6 + r() * 7; c.fillStyle = '#3a2a1c'; c.fillRect(x, 60 + r() * 40, w, H); c.fillStyle = 'rgba(40,78,36,.9)'; for (let q = 0; q < 5; q++) { c.beginPath(); c.ellipse(x + (r() - .5) * 60, 40 + r() * 70, 24 + r() * 18, 14 + r() * 10, 0, 0, 7); c.fill(); } }
      c.fillStyle = 'rgba(70,110,50,.8)'; for (let k = 0; k < 120; k++) { c.fillRect(r() * W, H - 30 + r() * 30, 2, -6 - r() * 10); }
    });
    T.skyhole = cv('skyhole', 128, 128, (c, W, H) => {
      const g = c.createRadialGradient(W / 2, H / 2, 4, W / 2, H / 2, W / 2); g.addColorStop(0, '#fffdf0'); g.addColorStop(.55, '#e6f5d2'); g.addColorStop(1, '#7da35f'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      let sd = 3; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
      for (let k = 0; k < 70; k++) { const a = r() * 6.283, d = W * (.34 + .2 * r()); c.fillStyle = k % 3 ? 'rgba(46,92,38,.85)' : 'rgba(92,140,60,.8)'; c.beginPath(); c.ellipse(W / 2 + Math.cos(a) * d, H / 2 + Math.sin(a) * d, 9 + r() * 9, 5 + r() * 5, a, 0, 7); c.fill(); }
    });
    T.doorview = cv('doorview', 64, 256, (c, W, H) => { const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#f6efdc'); g.addColorStop(.5, '#fffaf0'); g.addColorStop(.66, '#f0dfb6'); g.addColorStop(1, '#cdb88a'); c.fillStyle = g; c.fillRect(0, 0, W, H); });
    const brush = (c, x, y, s, r) => {
      c.strokeStyle = '#17110c'; c.lineCap = 'round'; c.lineJoin = 'round';
      for (let k = 0, n = 3 + Math.floor(r() * 4); k < n; k++) {
        const kind = r(), x0 = x + (r() - .5) * s * .7, y0 = y + (r() - .5) * s * .7; c.lineWidth = s * (.06 + .07 * r()); c.beginPath();
        if (kind < .35) { c.moveTo(x - s * .42 + r() * s * .2, y0); c.quadraticCurveTo(x, y0 - s * .08, x + s * .42 - r() * s * .2, y0 + s * .05); }
        else if (kind < .65) { c.moveTo(x0, y - s * .45 + r() * s * .2); c.quadraticCurveTo(x0 + s * .05, y, x0 - s * .04, y + s * .45 - r() * s * .2); }
        else if (kind < .88) { c.moveTo(x0, y0); c.quadraticCurveTo(x0 + s * .15, y0 + s * .2, x0 + s * .35 * (r() < .5 ? -1 : 1), y0 + s * .4); }
        else c.arc(x0, y0, s * .05, 0, 7);
        c.stroke();
      }
    };
    const scrollTex = (name, seed, chars) => cv(name, 256, 640, (c, W, H) => {
      const r = rng(seed); c.fillStyle = '#26383a'; c.fillRect(0, 0, W, H);
      c.fillStyle = 'rgba(200,170,90,.35)'; for (let y = 8; y < H; y += 16) for (let x = (y / 16) % 2 ? 8 : 0; x < W; x += 16) c.fillRect(x, y, 3, 3);
      c.fillStyle = '#a8894a'; c.fillRect(0, 70, W, 16); c.fillRect(0, H - 134, W, 16);
      c.fillStyle = '#efe5cc'; c.fillRect(24, 86, W - 48, H - 220);
      const top = 86 + 60, step = (H - 220 - 120) / Math.max(1, chars - 1);
      for (let i = 0; i < chars; i++) brush(c, W / 2, top + i * step, 78, r);
      c.fillStyle = '#b3261e'; c.fillRect(W / 2 + 34, H - 190, 26, 26); c.fillStyle = '#efe5cc'; c.fillRect(W / 2 + 40, H - 184, 6, 14);
    });
    T.scroll_sam = scrollTex('scroll_sam', 7, 4); T.scroll_sam2 = scrollTex('scroll_sam2', 23, 3);
    // the arcade's four games (Hub Rebel Arcade): attract screens, cabinet marquees, neon signs over each game's row
    const GAMES = { fw: ['FACTION WARS', '#ff3b5c', '#3bd5ff'], raid: ['THE RAID', '#b25aff', '#ffcf3b'], tunnel: ['ANT TUNNEL', '#3bffb0', '#ff8a3b'], shuffle: ['EGG SHUFFLE', '#ffd43b', '#ff3b8d'] };
    const neonText = (c, txt, x, y, size, col) => { c.font = `900 ${size}px Arial Black, Arial, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
      c.shadowColor = col; c.shadowBlur = size * .5; c.strokeStyle = col; c.lineWidth = size * .14; c.strokeText(txt, x, y); c.shadowBlur = size * .25; c.fillStyle = '#ffffff'; c.fillText(txt, x, y); c.shadowBlur = 0; };
    for (const [g, [title, a, b]] of Object.entries(GAMES)) {
      T['scr_' + g] = cv('scr_' + g, 256, 200, (c, W, H) => {
        const r = rng(g.length * 97); c.fillStyle = '#05040c'; c.fillRect(0, 0, W, H);
        if (g === 'fw') { c.fillStyle = '#123018'; c.fillRect(0, 120, W, 80); for (let k = 0; k < 7; k++) { c.fillStyle = a; c.fillRect(18 + k * 14, 128 + (k % 2) * 10, 8, 14); c.fillStyle = b; c.fillRect(W - 26 - k * 14, 128 + (k % 2) * 10, 8, 14); } c.fillStyle = '#ffffff'; c.fillRect(W / 2 - 2, 100, 4, 60); }
        else if (g === 'raid') { c.fillStyle = '#1c1430'; for (let k = 0; k < 5; k++) c.fillRect(10 + k * 50, 70, 40, 120); c.fillStyle = '#ffb030'; for (let k = 0; k < 5; k++) { c.beginPath(); c.arc(30 + k * 50, 86, 6, 0, 7); c.fill(); } c.fillStyle = a; c.fillRect(110, 150, 36, 30); }
        else if (g === 'tunnel') { c.strokeStyle = '#2a6a4a'; c.lineWidth = 14; c.beginPath(); c.moveTo(10, 180); for (let k = 0; k < 6; k++) c.lineTo(20 + k * 45, k % 2 ? 70 : 170); c.stroke(); c.strokeStyle = a; c.lineWidth = 3; c.stroke(); for (let k = 0; k < 9; k++) { c.fillStyle = k % 3 ? '#ffe066' : '#8af'; c.fillRect(r() * W, 60 + r() * 130, 5, 5); } }
        else { for (let k = 0; k < 5; k++) { c.fillStyle = k === 2 ? a : '#f2ead8'; c.beginPath(); c.ellipse(30 + k * 49, 140, 18, 24, 0, 0, 7); c.fill(); } c.fillStyle = b; c.beginPath(); c.moveTo(128, 70); c.lineTo(118, 100); c.lineTo(138, 100); c.fill(); }
        neonText(c, title, W / 2, 34, title.length > 9 ? 26 : 32, a); c.font = 'bold 14px monospace'; c.fillStyle = b; c.textAlign = 'center'; c.fillText('PRESS O TO PLAY', W / 2, H - 10);
      });
      T['mq_' + g] = cv('mq_' + g, 512, 128, (c, W, H) => { const gr = c.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, '#120a24'); gr.addColorStop(.5, '#24103e'); gr.addColorStop(1, '#120a24'); c.fillStyle = gr; c.fillRect(0, 0, W, H); neonText(c, title, W / 2, H / 2 + 4, title.length > 9 ? 56 : 66, a); });
      T['sign_' + g] = cv('sign_' + g, 1024, 192, (c, W, H) => { c.clearRect(0, 0, W, H); neonText(c, title, W / 2, H / 2 + 6, 120, a); });
    }
    T.runner = cv('runner', 128, 512, (c, W, H) => { c.fillStyle = '#6e1414'; c.fillRect(0, 0, W, H); c.fillStyle = '#c9a452'; c.fillRect(8, 0, 8, H); c.fillRect(W - 16, 0, 8, H); c.fillStyle = 'rgba(201,164,82,.55)'; for (let y = 32; y < H; y += 64) { c.beginPath(); c.moveTo(W / 2, y - 18); c.lineTo(W / 2 + 18, y); c.lineTo(W / 2, y + 18); c.lineTo(W / 2 - 18, y); c.fill(); } });
    T.sign_prizes = cv('sign_prizes', 512, 128, (c, W, H) => { c.clearRect(0, 0, W, H); neonText(c, 'PRIZES', W / 2, H / 2 + 4, 76, '#ffd43b'); });
    T.sign_claw = cv('sign_claw', 512, 128, (c, W, H) => { c.fillStyle = '#120a24'; c.fillRect(0, 0, W, H); neonText(c, 'ANT CLAW', W / 2, H / 2 + 4, 64, '#3bd5ff'); });
    T.war_map = pixelTex(scene, 'war_map', S, (x, y, i) => { const e = Math.min(x, 1 - x, y, 1 - y); if (e < .03) return [92, 64, 36]; const v = mp[i]; if (Math.abs(y - .5 - .18 * Math.sin(x * 7)) < .015) return [70, 110, 120]; return v > .62 ? [96, 112, 70] : v > .45 ? [150, 150, 96] : [196, 178, 128]; });
    T._cv = cv; // for ROOM_TEX
    return T;
  }
  // ── room-only textures: drawn the first time a room material asks for one (cv: makeTextures' canvas helper) ──
  const goldLeaf = (c, W, H, seed, base = [222, 178, 92]) => { // squares of gold leaf with fine seams
    const r = rng(seed);
    for (let y = 0; y < H; y += 32) for (let x = 0; x < W; x += 32) { const f = .9 + .18 * r(); c.fillStyle = `rgb(${base[0] * f | 0},${base[1] * f | 0},${base[2] * f | 0})`; c.fillRect(x, y, 32, 32); }
    c.fillStyle = 'rgba(110,70,20,.18)'; for (let y = 0; y < H; y += 32) c.fillRect(0, y, W, 1); for (let x = 0; x < W; x += 32) c.fillRect(x, 0, 1, H);
  };
  const ROOM_TEX = {
    // Shogun Throne Room: cranes and clouds on gold (the side walls); the great pine on gold leaf (the screen behind the throne)
    fusuma_cranes: cv => cv('fusuma_cranes', 512, 384, (c, W, H) => {
      goldLeaf(c, W, H, 61, [226, 196, 128]); const r = rng(62);
      c.fillStyle = 'rgba(255,248,226,.6)'; for (const [x, y, w] of [[30, 60, 200], [290, 40, 210], [110, 250, 260], [370, 230, 130]]) { c.beginPath(); c.ellipse(x + w / 2, y, w / 2, 15, 0, 0, 7); c.fill(); c.beginPath(); c.ellipse(x + w * .7, y - 12, w / 4, 11, 0, 0, 7); c.fill(); }
      c.fillStyle = '#2c4a72'; c.beginPath(); c.moveTo(0, H); for (let x = 0; x <= W; x += 16) c.lineTo(x, H - 46 - 10 * Math.sin(x / 30)); c.lineTo(W, H); c.fill();
      c.strokeStyle = 'rgba(240,226,190,.8)'; c.lineWidth = 2; for (let k = 0; k < 9; k++) { const x = k * 60 + 10; c.beginPath(); c.arc(x, H - 36, 14, Math.PI, 0); c.stroke(); }
      const crane = (x, y, s, fl) => {
        c.save(); c.translate(x, y); c.scale(fl * s, s);
        c.fillStyle = '#f7f4ec'; c.beginPath(); c.ellipse(0, 0, 30, 14, -.2, 0, 7); c.fill();
        c.fillStyle = '#1b1b1b'; c.beginPath(); c.moveTo(-26, 2); c.lineTo(-48, 12); c.lineTo(-24, 10); c.fill();
        c.strokeStyle = '#f7f4ec'; c.lineWidth = 6; c.beginPath(); c.moveTo(22, -6); c.quadraticCurveTo(34, -34, 26, -54); c.stroke();
        c.strokeStyle = '#1b1b1b'; c.lineWidth = 4; c.beginPath(); c.moveTo(30, -30); c.quadraticCurveTo(32, -44, 26, -52); c.stroke();
        c.fillStyle = '#c8202a'; c.beginPath(); c.arc(26, -56, 5, 0, 7); c.fill(); c.fillStyle = '#d8b050'; c.beginPath(); c.moveTo(29, -56); c.lineTo(44, -52); c.lineTo(29, -53); c.fill();
        c.strokeStyle = '#2a2a2a'; c.lineWidth = 2.5; for (const lx of [-4, 6]) { c.beginPath(); c.moveTo(lx, 12); c.lineTo(lx + 2, 48); c.stroke(); }
        c.restore();
      };
      crane(120, 300, 1.1, 1); crane(200, 312, .9, -1); crane(400, 300, 1, -1);
      for (const [x, y, s] of [[300, 120, .8], [380, 90, .6], [150, 140, .7]]) { c.save(); c.translate(x, y); c.scale(s, s); c.fillStyle = '#f7f4ec'; c.beginPath(); c.ellipse(0, 0, 26, 9, 0, 0, 7); c.fill(); c.beginPath(); c.moveTo(-6, 0); c.lineTo(-30, -38); c.lineTo(10, -4); c.fill(); c.beginPath(); c.moveTo(-6, 0); c.lineTo(-24, 34); c.lineTo(12, 4); c.fill(); c.fillStyle = '#1b1b1b'; c.beginPath(); c.moveTo(-30, -38); c.lineTo(-22, -24); c.lineTo(-16, -28); c.fill(); c.strokeStyle = '#f7f4ec'; c.lineWidth = 4; c.beginPath(); c.moveTo(22, 0); c.lineTo(46, -6); c.stroke(); c.fillStyle = '#c8202a'; c.beginPath(); c.arc(47, -6, 3.5, 0, 7); c.fill(); c.restore(); }
      for (let k = 0; k < 6; k++) { c.fillStyle = 'rgba(70,110,60,.9)'; const x = 20 + r() * 470; c.beginPath(); c.ellipse(x, H - 50, 10 + r() * 14, 6, 0, 0, 7); c.fill(); }
    }),
    byobu_pine: cv => cv('byobu_pine', 768, 256, (c, W, H) => {
      goldLeaf(c, W, H, 63); const r = rng(64);
      c.fillStyle = '#2f5576'; c.beginPath(); c.moveTo(0, H); for (let x = 0; x <= W; x += 12) c.lineTo(x, H - 30 - 12 * Math.sin(x / 40) - (x > 420 ? 20 : 0)); c.lineTo(W, H); c.fill();
      c.fillStyle = '#4a4a42'; for (const [x, w, h] of [[60, 120, 56], [520, 160, 70], [660, 90, 44]]) { c.beginPath(); c.moveTo(x, H); c.quadraticCurveTo(x + w * .3, H - h, x + w * .55, H - h * .8); c.quadraticCurveTo(x + w * .8, H - h * .5, x + w, H); c.fill(); }
      c.strokeStyle = '#45291a'; c.lineCap = 'round';
      c.lineWidth = 26; c.beginPath(); c.moveTo(110, H - 20); c.bezierCurveTo(170, 160, 90, 110, 230, 92); c.bezierCurveTo(330, 80, 420, 120, 560, 70); c.stroke();
      c.lineWidth = 12; for (const [a, b, d, e] of [[230, 92, 300, 40], [380, 100, 470, 140], [470, 82, 640, 46], [160, 130, 70, 80]]) { c.beginPath(); c.moveTo(a, b); c.quadraticCurveTo((a + d) / 2, Math.min(b, e) - 20, d, e); c.stroke(); }
      for (const [x, y, rx] of [[300, 40, 70], [470, 140, 64], [640, 46, 80], [70, 80, 56], [560, 70, 60], [230, 92, 50], [400, 96, 46]]) {
        c.fillStyle = '#183a22'; c.beginPath(); c.ellipse(x, y, rx, rx * .34, 0, 0, 7); c.fill();
        c.fillStyle = '#2f6a3a'; c.beginPath(); c.ellipse(x - 4, y - 6, rx * .82, rx * .2, 0, 0, 7); c.fill();
        c.strokeStyle = 'rgba(90,150,90,.7)'; c.lineWidth = 2; for (let k = 0; k < 10; k++) { const px = x - rx * .8 + k * rx * .17; c.beginPath(); c.moveTo(px, y - 4); c.lineTo(px + 4, y - 14 - r() * 6); c.stroke(); }
      }
      c.strokeStyle = 'rgba(120,80,30,.35)'; c.lineWidth = 3; for (let k = 1; k < 6; k++) { c.beginPath(); c.moveTo(k * W / 6, 0); c.lineTo(k * W / 6, H); c.stroke(); }
    }),
    // Shogun Court of Records: the white pebbles of the court; the drawer walls (labels, brass pulls)
    pebbles_white: cv => { const t = cv('pebbles_white', 256, 256, (c, W) => { c.fillStyle = '#d8d4c8'; c.fillRect(0, 0, W, W); const r = rng(65); for (let k = 0; k < 1500; k++) { const v = 168 + r() * 76 | 0; c.fillStyle = `rgb(${v},${v - 3},${v - 11})`; c.beginPath(); c.ellipse(r() * W, r() * W, 2 + r() * 3, 1.5 + r() * 2.5, r() * 3, 0, 7); c.fill(); } }); t.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE; return t; },
    drawers: cv => { const t = cv('drawers', 256, 256, (c, W) => {
      c.fillStyle = '#24160b'; c.fillRect(0, 0, W, W); const r = rng(66);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 5; j++) {
        const x = i * 64 + 3, y = j * 51.2 + 3, f = .86 + .2 * r(); c.fillStyle = `rgb(${110 * f | 0},${74 * f | 0},${42 * f | 0})`; c.fillRect(x, y, 58, 45);
        c.fillStyle = 'rgba(40,22,10,.3)'; for (let g = 0; g < 4; g++) c.fillRect(x, y + 6 + g * 10 + r() * 4, 58, 1);
        c.fillStyle = '#ece3cc'; c.fillRect(x + 18, y + 5, 22, 11); c.fillStyle = '#20160e'; c.fillRect(x + 22, y + 8, 6, 2); c.fillRect(x + 30, y + 8, 2, 6); c.fillRect(x + 33, y + 11, 4, 2);
        c.fillStyle = '#b58a3a'; c.beginPath(); c.arc(x + 29, y + 29, 6, 0, 7); c.fill(); c.strokeStyle = '#6a4a18'; c.lineWidth = 2; c.beginPath(); c.arc(x + 29, y + 33, 6, 0, Math.PI); c.stroke();
      }
    }); t.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE; return t; },
    // Shogun Keep: the valley at dusk from the castle windows
    valley_view: cv => cv('valley_view', 768, 256, (c, W, H) => {
      const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2e1c4a'); g.addColorStop(.42, '#8a4a78'); g.addColorStop(.58, '#e59a6c'); g.addColorStop(.62, '#7a4a6a'); g.addColorStop(1, '#2a2036'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      const sg = c.createRadialGradient(520, 140, 4, 520, 140, 90); sg.addColorStop(0, 'rgba(255,226,150,1)'); sg.addColorStop(.18, 'rgba(255,200,120,.8)'); sg.addColorStop(1, 'rgba(255,170,110,0)'); c.fillStyle = sg; c.fillRect(380, 40, 280, 200);
      const r = rng(67);
      for (const [base, amp, col] of [[150, 26, '#6a4272'], [162, 34, '#4c3060'], [178, 22, '#36244a']]) { c.fillStyle = col; c.beginPath(); c.moveTo(0, H); let y = base; for (let x = 0; x <= W; x += 8) { y = base - amp * (.5 + .5 * Math.sin(x / (40 + amp) + base)) - 8 * r(); c.lineTo(x, y); } c.lineTo(W, H); c.fill(); }
      c.strokeStyle = 'rgba(250,190,130,.75)'; c.lineWidth = 5; c.beginPath(); c.moveTo(0, 214); c.bezierCurveTo(200, 196, 330, 236, 500, 206); c.bezierCurveTo(600, 190, 690, 214, W, 200); c.stroke();
      c.fillStyle = 'rgba(230,200,220,.18)'; c.fillRect(0, 186, W, 10);
      for (let k = 0; k < 40; k++) { const x = r() * W, y = 220 + r() * 30, w = 10 + r() * 16; c.fillStyle = '#1c1424'; c.beginPath(); c.moveTo(x - w / 2 - 3, y); c.lineTo(x, y - 7); c.lineTo(x + w / 2 + 3, y); c.fill(); c.fillRect(x - w / 2, y, w, 6); if (r() < .6) { c.fillStyle = '#f2b860'; c.fillRect(x - 1, y + 2, 2, 2); } }
    }),
    // Shogun War Council: gold constellations on the purple dome; the colony map in gold on the round table
    dome_stars: cv => cv('dome_stars', 512, 256, (c, W, H) => {
      const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1a0c2e'); g.addColorStop(1, '#4a2268'); c.fillStyle = g; c.fillRect(0, 0, W, H); const r = rng(68);
      for (let k = 0; k < 260; k++) { const a = .3 + .7 * r(); c.fillStyle = `rgba(240,200,110,${a})`; c.beginPath(); c.arc(r() * W, r() * (H - 20), .6 + 1.4 * r() * r(), 0, 7); c.fill(); }
      c.strokeStyle = 'rgba(232,190,96,.85)'; c.fillStyle = '#f2cf78'; c.lineWidth = 1.5;
      for (let q = 0; q < 7; q++) { const x0 = 30 + q * 70 + r() * 20, y0 = 40 + r() * 130, pts = Array.from({ length: 4 + (r() * 3 | 0) }, (_, i) => [x0 + i * 14 + r() * 18, y0 + (r() - .5) * 50]); c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke(); for (const [x, y] of pts) { c.beginPath(); c.arc(x, y, 2.6, 0, 7); c.fill(); } }
      c.fillStyle = '#c99a44'; c.fillRect(0, H - 14, W, 6); c.fillStyle = '#7a5a26'; c.fillRect(0, H - 8, W, 2);
    }),
    council_map: cv => cv('council_map', 512, 512, (c, W) => {
      const C = W / 2, gold = '#dcb456'; c.fillStyle = '#0f0a07'; c.fillRect(0, 0, W, W); const r = rng(69);
      c.strokeStyle = gold; c.lineWidth = 6; c.beginPath(); c.arc(C, C, 246, 0, 7); c.stroke(); c.lineWidth = 2; c.beginPath(); c.arc(C, C, 232, 0, 7); c.stroke();
      for (let k = 0; k < 48; k++) { const a = k / 48 * 6.283, l = k % 4 ? 8 : 16; c.beginPath(); c.moveTo(C + Math.cos(a) * 232, C + Math.sin(a) * 232); c.lineTo(C + Math.cos(a) * (232 - l), C + Math.sin(a) * (232 - l)); c.stroke(); }
      c.strokeStyle = 'rgba(220,180,86,.5)'; c.lineWidth = 3; for (const s of [1, -1]) { c.beginPath(); c.moveTo(C - 200, C + s * 40); for (let x = -200; x <= 200; x += 10) c.lineTo(C + x, C + s * (40 + 24 * Math.sin(x / 34))); c.stroke(); }
      c.fillStyle = 'rgba(220,180,86,.7)'; for (let k = 0; k < 40; k++) { const a = r() * 6.283, d = 60 + r() * 150, x = C + Math.cos(a) * d, y = C + Math.sin(a) * d; c.beginPath(); c.moveTo(x - 6, y + 4); c.lineTo(x, y - 6); c.lineTo(x + 6, y + 4); c.fill(); }
      c.strokeStyle = gold; c.lineWidth = 2;
      for (let k = 0; k < 11; k++) {
        const a = k / 11 * 6.283 - Math.PI / 2, d = 150 + 26 * Math.sin(k * 2.3), x = C + Math.cos(a) * d, y = C + Math.sin(a) * d;
        c.setLineDash([6, 5]); c.beginPath(); c.moveTo(C, C); c.quadraticCurveTo(C + Math.cos(a + .3) * d * .5, C + Math.sin(a + .3) * d * .5, x, y); c.stroke(); c.setLineDash([]);
        c.fillStyle = gold; c.beginPath(); c.arc(x, y, 10, 0, 7); c.fill(); c.fillStyle = '#0f0a07'; c.beginPath(); c.arc(x, y, 5, 0, 7); c.fill();
        for (let p = 0; p < 6; p++) { const b = p / 6 * 6.283; c.fillStyle = gold; c.beginPath(); c.arc(x + Math.cos(b) * 14, y + Math.sin(b) * 14, 3, 0, 7); c.fill(); }
      }
      c.fillStyle = gold; c.beginPath(); c.arc(C, C, 26, 0, 7); c.fill(); c.fillStyle = '#0f0a07'; c.beginPath(); c.arc(C, C, 18, 0, 7); c.fill(); c.fillStyle = gold; c.beginPath(); c.arc(C, C, 8, 0, 7); c.fill();
      for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283; c.beginPath(); c.moveTo(C + Math.cos(a) * 30, C + Math.sin(a) * 30); c.lineTo(C + Math.cos(a + .12) * 46, C + Math.sin(a + .12) * 46); c.lineTo(C + Math.cos(a - .12) * 46, C + Math.sin(a - .12) * 46); c.fill(); }
    }),
    // Bushi: sunrise through the War Room's round window; the sand of its relief table; the go board in the floor; the rising
    // sun and crossed swords across the dojo's back wall
    sunrise: cv => cv('sunrise', 512, 512, (c, W) => {
      const g = c.createLinearGradient(0, 0, 0, W); g.addColorStop(0, '#3a3c78'); g.addColorStop(.35, '#a8577a'); g.addColorStop(.62, '#f2934e'); g.addColorStop(.75, '#ffd27a'); g.addColorStop(1, '#ffe7a8'); c.fillStyle = g; c.fillRect(0, 0, W, W);
      const s = c.createRadialGradient(256, 400, 10, 256, 400, 200); s.addColorStop(0, 'rgba(255,250,220,1)'); s.addColorStop(.25, 'rgba(255,230,150,.9)'); s.addColorStop(1, 'rgba(255,190,110,0)'); c.fillStyle = s; c.fillRect(0, 160, W, 352);
      c.fillStyle = 'rgba(255,214,170,.5)'; for (const [x, y, w] of [[60, 150, 180], [280, 110, 170], [150, 250, 220]]) { c.beginPath(); c.ellipse(x + w / 2, y, w / 2, 12, 0, 0, 7); c.fill(); }
      for (const [y0, col] of [[400, '#4b3a6a'], [430, '#2c2a52'], [462, '#1c1e3c']]) { c.fillStyle = col; c.beginPath(); c.moveTo(0, W); for (let x = 0; x <= W; x += 16) c.lineTo(x, y0 - 26 * Math.sin(x / 70 + y0) - 14 * Math.sin(x / 23)); c.lineTo(W, W); c.fill(); }
    }),
    relief_sand: cv => { const t = cv('relief_sand', 256, 256, (c, W) => { c.fillStyle = '#c8ad7e'; c.fillRect(0, 0, W, W); const r = rng(72); for (let k = 0; k < 900; k++) { const v = 150 + r() * 70 | 0; c.fillStyle = `rgba(${v},${v * .84 | 0},${v * .6 | 0},.5)`; c.fillRect(r() * W, r() * W, 2, 2); } c.strokeStyle = 'rgba(110,84,50,.35)'; c.lineWidth = 2; for (let k = 0; k < 6; k++) { c.beginPath(); for (let x = 0; x <= W; x += 8) c.lineTo(x, 30 + k * 40 + 10 * Math.sin(x / 30 + k)); c.stroke(); } }); t.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE; return t; },
    goban: cv => cv('goban', 512, 512, (c, W) => {
      const g = c.createLinearGradient(0, 0, W, W); g.addColorStop(0, '#d9b277'); g.addColorStop(1, '#c99e60'); c.fillStyle = g; c.fillRect(0, 0, W, W); const r = rng(73);
      c.strokeStyle = 'rgba(150,100,50,.25)'; c.lineWidth = 1; for (let k = 0; k < 60; k++) { const y = r() * W; c.beginPath(); c.moveTo(0, y); c.bezierCurveTo(W / 3, y + (r() - .5) * 20, 2 * W / 3, y + (r() - .5) * 20, W, y); c.stroke(); }
      const m = 22, s = (W - 2 * m) / 18; c.strokeStyle = '#1a120a'; c.lineWidth = 2.5; for (let k = 0; k < 19; k++) { c.beginPath(); c.moveTo(m, m + k * s); c.lineTo(W - m, m + k * s); c.stroke(); c.beginPath(); c.moveTo(m + k * s, m); c.lineTo(m + k * s, W - m); c.stroke(); }
      c.fillStyle = '#1a120a'; for (const a of [3, 9, 15]) for (const b of [3, 9, 15]) { c.beginPath(); c.arc(m + a * s, m + b * s, 5, 0, 7); c.fill(); }
    }),
    shogiban: cv => cv('shogiban', 256, 256, (c, W) => { c.fillStyle = '#dcb87e'; c.fillRect(0, 0, W, W); const m = 16, s = (W - 2 * m) / 9; c.strokeStyle = '#2a1a0c'; c.lineWidth = 2; for (let k = 0; k <= 9; k++) { c.beginPath(); c.moveTo(m, m + k * s); c.lineTo(W - m, m + k * s); c.stroke(); c.beginPath(); c.moveTo(m + k * s, m); c.lineTo(m + k * s, W - m); c.stroke(); } c.fillStyle = '#2a1a0c'; for (const a of [3, 6]) for (const b of [3, 6]) { c.beginPath(); c.arc(m + a * s, m + b * s, 3, 0, 7); c.fill(); } }),
    mural_bushi: cv => cv('mural_bushi', 1024, 256, (c, W, H) => {
      c.fillStyle = '#16244a'; c.fillRect(0, 0, W, H); const r = rng(74);
      for (let k = 0; k < 400; k++) { c.fillStyle = `rgba(40,64,120,${.2 + .3 * r()})`; c.fillRect(r() * W, r() * H, 6, 2); }
      c.save(); c.translate(W / 2, H * .62); c.fillStyle = 'rgba(214,92,46,.55)'; for (let k = 0; k < 16; k++) { c.rotate(Math.PI / 8); c.beginPath(); c.moveTo(0, 0); c.lineTo(-40, -420); c.lineTo(40, -420); c.fill(); } c.restore();
      c.fillStyle = '#c8402a'; c.beginPath(); c.arc(W / 2, H * .62, 86, 0, 7); c.fill(); c.strokeStyle = '#d9b35a'; c.lineWidth = 6; c.stroke();
      c.fillStyle = '#16244a'; c.fillRect(0, H * .86, W, H);
      for (const s of [-1, 1]) { c.save(); c.translate(W / 2, H * .55); c.rotate(s * .75); c.fillStyle = '#e8e8ee'; c.fillRect(-6, -150, 12, 210); c.beginPath(); c.moveTo(-6, -150); c.lineTo(0, -168); c.lineTo(6, -150); c.fill(); c.fillStyle = '#d9b35a'; c.fillRect(-26, 58, 52, 10); c.fillStyle = '#2a1a12'; c.fillRect(-8, 68, 16, 60); c.restore(); }
      c.strokeStyle = '#d9b35a'; c.lineWidth = 8; c.strokeRect(10, 10, W - 20, H - 20);
    }),
    // Ashigaru: the rice-planting calendar wheel. Kenshi: raked sand (rings, lines), the kata scrolls
    calendar_wheel: cv => cv('calendar_wheel', 512, 512, (c, W) => {
      const C = W / 2, cols = ['#7fae4a', '#9cc35a', '#5f9a3a', '#3f7a2c', '#2f6a26', '#4a7a2a', '#c9a640', '#d8b24a', '#b8862e', '#8a6a3a', '#6a5236', '#7a6a50'];
      c.fillStyle = '#3a2614'; c.fillRect(0, 0, W, W);
      for (let k = 0; k < 12; k++) { const a0 = k / 12 * 6.283 - Math.PI / 2, a1 = a0 + 6.283 / 12; c.fillStyle = cols[k]; c.beginPath(); c.moveTo(C, C); c.arc(C, C, 236, a0, a1); c.closePath(); c.fill(); c.strokeStyle = '#2a1a0c'; c.lineWidth = 4; c.stroke();
        const am = (a0 + a1) / 2, x = C + Math.cos(am) * 170, y = C + Math.sin(am) * 170; c.strokeStyle = '#2a1a0c'; c.lineWidth = 3; for (let q = 0; q < 3 + (k % 4); q++) { c.beginPath(); c.moveTo(x - 10 + q * 7, y + 18); c.quadraticCurveTo(x - 6 + q * 7, y, x - 12 + q * 9, y - 20); c.stroke(); }
        c.fillStyle = '#f2e6c8'; for (let q = 0; q <= k % 6; q++) { c.beginPath(); c.arc(C + Math.cos(am) * 222 + (q - 2) * 2, C + Math.sin(am) * 222, 3, 0, 7); c.fill(); } }
      c.fillStyle = '#d8b45a'; c.beginPath(); c.arc(C, C, 70, 0, 7); c.fill(); c.fillStyle = '#3a2614'; c.beginPath(); c.arc(C, C, 52, 0, 7); c.fill();
      c.strokeStyle = '#7fae4a'; c.lineWidth = 7; c.beginPath(); c.moveTo(C, C + 34); c.lineTo(C, C - 26); c.stroke(); for (const s of [-1, 1]) { c.beginPath(); c.moveTo(C, C + 6); c.quadraticCurveTo(C + s * 22, C - 6, C + s * 26, C - 28); c.stroke(); }
    }),
    raked_rings: cv => cv('raked_rings', 512, 512, (c, W) => { c.fillStyle = '#e4e0d4'; c.fillRect(0, 0, W, W); const r = rng(81); for (let k = 0; k < 1600; k++) { const v = 196 + r() * 50 | 0; c.fillStyle = `rgba(${v},${v - 2},${v - 8},.6)`; c.fillRect(r() * W, r() * W, 2, 2); } c.strokeStyle = 'rgba(120,114,100,.55)'; c.lineWidth = 3; for (let rr = 20; rr < W / 2; rr += 14) { c.beginPath(); c.arc(W / 2, W / 2, rr, 0, 7); c.stroke(); } }),
    rake_lines: cv => { const t = cv('rake_lines', 256, 256, (c, W) => { c.fillStyle = '#d6d2c4'; c.fillRect(0, 0, W, W); const r = rng(82); for (let k = 0; k < 900; k++) { const v = 186 + r() * 50 | 0; c.fillStyle = `rgba(${v},${v - 2},${v - 8},.6)`; c.fillRect(r() * W, r() * W, 2, 2); } c.strokeStyle = 'rgba(112,106,94,.55)'; c.lineWidth = 3; for (let y = 8; y < W; y += 16) { c.beginPath(); for (let x = 0; x <= W; x += 8) c.lineTo(x, y + 2.5 * Math.sin(x / W * Math.PI * 4)); c.stroke(); } }); t.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE; return t; },
    kata_scroll: cv => cv('kata_scroll', 256, 640, (c, W, H) => {
      c.fillStyle = '#e9e1cc'; c.fillRect(0, 0, W, H); c.fillStyle = '#26383a'; c.fillRect(0, 0, W, 24); c.fillRect(0, H - 24, W, 24); const r = rng(83);
      const fig = (x, y, s, pose) => { c.strokeStyle = '#1a1410'; c.lineCap = 'round'; c.lineWidth = 5 * s; c.beginPath(); c.arc(x, y - 52 * s, 9 * s, 0, 7); c.stroke(); c.beginPath(); c.moveTo(x, y - 42 * s); c.lineTo(x + pose * 4 * s, y); c.stroke();
        c.beginPath(); c.moveTo(x + pose * 4 * s, y); c.lineTo(x - 16 * s, y + 34 * s); c.moveTo(x + pose * 4 * s, y); c.lineTo(x + 18 * s, y + 34 * s); c.stroke();
        const hx = x + pose * 22 * s, hy = y - 36 * s - (1 - Math.abs(pose)) * 8 * s; c.beginPath(); c.moveTo(x, y - 34 * s); c.lineTo(hx, hy); c.stroke(); c.lineWidth = 3 * s; c.beginPath(); c.moveTo(hx, hy); c.lineTo(hx + pose * 44 * s, hy - (1.4 - Math.abs(pose)) * 40 * s); c.stroke(); };
      for (let k = 0; k < 4; k++) { const y = 120 + k * 135, pose = [-1, .3, 1, -.4][k]; fig(80, y, 1.1, pose); c.strokeStyle = '#9a2a1e'; c.lineWidth = 3; c.beginPath(); c.arc(150, y - 20, 26, -1.2 + pose, 1.4 + pose); c.stroke(); c.beginPath(); c.moveTo(150 + 26 * Math.cos(1.4 + pose), y - 20 + 26 * Math.sin(1.4 + pose)); c.lineTo(150 + 34 * Math.cos(1.2 + pose), y - 20 + 34 * Math.sin(1.2 + pose)); c.stroke();
        c.fillStyle = '#1a1410'; for (let q = 0; q < 5; q++) c.fillRect(205 + (r() - .5) * 6, y - 60 + q * 22, 14, 4 + r() * 6); }
      c.fillStyle = '#b8302a'; c.fillRect(196, 560, 30, 30);
    }),
    // Yamabushi: the waterfall curtain over the cave mouth, the misty void beyond it, star charts, the night through the
    // library's high window, the paper charms. Sohei: the silk banners of the Rite Hall
    falls_streaks: cv => { const t = cv('falls_streaks', 128, 256, (c, W, H) => { c.clearRect(0, 0, W, H); const r = rng(91); for (let k = 0; k < 90; k++) { const x = r() * W, w = 1 + r() * 4, a = .2 + .6 * r(); const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, `rgba(240,248,255,${a})`); g.addColorStop(.5, `rgba(220,236,250,${a * .6})`); g.addColorStop(1, `rgba(240,248,255,${a})`); c.fillStyle = g; c.fillRect(x, 0, w, H); } c.fillStyle = 'rgba(230,242,252,.18)'; c.fillRect(0, 0, W, H); }); t.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE; return t; },
    mist_view: cv => cv('mist_view', 512, 256, (c, W, H) => { const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#9fb6c8'); g.addColorStop(.6, '#c9d6de'); g.addColorStop(1, '#7d93a3'); c.fillStyle = g; c.fillRect(0, 0, W, H); const r = rng(92); for (const [y0, a, col] of [[120, 40, 'rgba(110,132,150,.55)'], [150, 30, 'rgba(90,112,130,.6)']]) { c.fillStyle = col; c.beginPath(); c.moveTo(0, H); for (let x = 0; x <= W; x += 8) c.lineTo(x, y0 - a * (.5 + .5 * Math.sin(x / 50 + y0)) - 10 * r()); c.lineTo(W, H); c.fill(); } for (let k = 0; k < 5; k++) { c.fillStyle = 'rgba(235,242,246,.35)'; c.fillRect(0, 90 + k * 30 + r() * 10, W, 8 + r() * 10); } }),
    star_chart: cv => cv('star_chart', 256, 512, (c, W, H) => { c.fillStyle = '#16233c'; c.fillRect(0, 0, W, H); c.fillStyle = '#2a1a10'; c.fillRect(0, 0, W, 18); c.fillRect(0, H - 18, W, 18); const r = rng(93); c.strokeStyle = 'rgba(200,220,255,.4)'; c.lineWidth = 1.5; c.beginPath(); c.arc(W / 2, H * .42, 100, 0, 7); c.stroke(); c.beginPath(); c.arc(W / 2, H * .42, 60, 0, 7); c.stroke(); for (let k = 0; k < 12; k++) { const a = k / 12 * 6.283; c.beginPath(); c.moveTo(W / 2 + Math.cos(a) * 60, H * .42 + Math.sin(a) * 60); c.lineTo(W / 2 + Math.cos(a) * 100, H * .42 + Math.sin(a) * 100); c.stroke(); }
      c.fillStyle = '#eef4ff'; for (let k = 0; k < 160; k++) { c.beginPath(); c.arc(r() * W, 20 + r() * (H - 40), .6 + 1.6 * r() * r(), 0, 7); c.fill(); } c.strokeStyle = 'rgba(160,200,255,.8)'; for (let q = 0; q < 5; q++) { const x0 = 30 + r() * 180, y0 = 260 + r() * 200; c.beginPath(); c.moveTo(x0, y0); for (let i = 0; i < 4; i++) c.lineTo(x0 + (r() - .5) * 70, y0 + (r() - .5) * 70); c.stroke(); } c.fillStyle = '#d6dcea'; for (let q = 0; q < 6; q++) c.fillRect(220, 40 + q * 22, 12, 4 + r() * 6); }),
    night_sky: cv => cv('night_sky', 256, 256, (c, W) => { const g = c.createLinearGradient(0, 0, 0, W); g.addColorStop(0, '#060a1c'); g.addColorStop(1, '#1d2c4c'); c.fillStyle = g; c.fillRect(0, 0, W, W); const r = rng(94); c.fillStyle = '#ffffff'; for (let k = 0; k < 120; k++) { c.globalAlpha = .4 + .6 * r(); c.beginPath(); c.arc(r() * W, r() * W * .9, .5 + 1.2 * r() * r(), 0, 7); c.fill(); } c.globalAlpha = 1; c.fillStyle = '#f2eedc'; c.beginPath(); c.arc(180, 70, 22, 0, 7); c.fill(); c.fillStyle = '#0d1530'; c.beginPath(); c.arc(190, 62, 20, 0, 7); c.fill(); }),
    charm: cv => cv('charm', 64, 192, (c, W, H) => { c.fillStyle = '#f4efe2'; c.fillRect(0, 0, W, H); c.fillStyle = '#b8241c'; for (let k = 0; k < 6; k++) c.fillRect(22 + (k % 2) * 6, 22 + k * 24, 14, 6 + (k % 3) * 4); c.fillStyle = '#1a1410'; c.fillRect(20, 160, 24, 20); c.strokeStyle = '#b8241c'; c.lineWidth = 2; c.strokeRect(6, 6, W - 12, H - 12); }),
    silk: cv => cv('silk', 256, 512, (c, W, H) => { const g = c.createLinearGradient(0, 0, W, 0); g.addColorStop(0, '#e9cf8a'); g.addColorStop(.5, '#f6e4b0'); g.addColorStop(1, '#e9cf8a'); c.fillStyle = g; c.fillRect(0, 0, W, H); c.strokeStyle = 'rgba(180,140,60,.12)'; for (let y = 0; y < H; y += 4) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); } c.strokeStyle = '#b8862e'; c.lineWidth = 6; c.strokeRect(8, 8, W - 16, H - 16); }),
    water_ripple: cv => { const t = cv('water_ripple', 256, 256, (c, W) => { const g = c.createLinearGradient(0, 0, W, 0); g.addColorStop(0, '#1d4a52'); g.addColorStop(.5, '#2a6470'); g.addColorStop(1, '#1d4a52'); c.fillStyle = g; c.fillRect(0, 0, W, W); const r = rng(76); for (let k = 0; k < 140; k++) { c.strokeStyle = `rgba(190,230,235,${.12 + .25 * r()})`; c.lineWidth = 1 + 2 * r(); const x = r() * W, y = r() * W, l = 10 + 30 * r(); c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 4, y + l / 2, x, y + l); c.stroke(); } }); t.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE; return t; },
    // Buke: the canyon from the cliff tunnels' windows; the engineers' blueprints
    canyon_view: cv => cv('canyon_view', 512, 256, (c, W, H) => {
      const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#8fb6d8'); g.addColorStop(.5, '#e8d8b4'); g.addColorStop(1, '#c08a52'); c.fillStyle = g; c.fillRect(0, 0, W, H); const r = rng(75);
      for (const [x0, w, top, col] of [[0, 150, 40, '#a8683c'], [360, 160, 60, '#9a5e36'], [140, 240, 130, '#c48a54']]) { c.fillStyle = col; c.beginPath(); c.moveTo(x0, H); c.lineTo(x0, top + 20); for (let x = x0; x <= x0 + w; x += 10) c.lineTo(x, top + 8 * r()); c.lineTo(x0 + w, H); c.fill(); c.fillStyle = 'rgba(70,40,20,.25)'; for (let y = top + 20; y < H; y += 18) c.fillRect(x0, y, w, 3); }
      c.fillStyle = '#5a7a3a'; for (let k = 0; k < 30; k++) { c.beginPath(); c.ellipse(140 + r() * 240, 200 + r() * 40, 8 + r() * 10, 5, 0, 0, 7); c.fill(); }
      c.strokeStyle = 'rgba(120,170,200,.8)'; c.lineWidth = 6; c.beginPath(); c.moveTo(150, H); c.bezierCurveTo(220, 220, 300, 240, 380, H); c.stroke();
    }),
    blueprint: cv => cv('blueprint', 512, 384, (c, W, H) => {
      c.fillStyle = '#1d4f86'; c.fillRect(0, 0, W, H); c.strokeStyle = 'rgba(200,225,255,.18)'; c.lineWidth = 1; for (let x = 0; x < W; x += 16) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); } for (let y = 0; y < H; y += 16) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
      c.strokeStyle = '#e6f0ff'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(40, 220); c.lineTo(470, 220); c.stroke(); c.beginPath(); c.moveTo(40, 220); c.quadraticCurveTo(255, 60, 470, 220); c.stroke();
      for (let k = 1; k < 10; k++) { const x = 40 + k * 43, y = 220 - (1 - ((x - 255) / 215) ** 2) * 80; c.beginPath(); c.moveTo(x, 220); c.lineTo(x, y); c.stroke(); if (k < 9) { c.beginPath(); c.moveTo(x, 220); c.lineTo(x + 43, 220 - (1 - ((x + 43 - 255) / 215) ** 2) * 80); c.stroke(); } }
      c.lineWidth = 1.5; c.beginPath(); c.moveTo(40, 260); c.lineTo(470, 260); c.stroke(); for (const x of [40, 470]) { c.beginPath(); c.moveTo(x, 250); c.lineTo(x, 270); c.stroke(); }
      c.beginPath(); c.arc(110, 320, 34, 0, 7); c.stroke(); c.beginPath(); c.arc(110, 320, 12, 0, 7); c.stroke(); for (let k = 0; k < 12; k++) { const a = k / 12 * 6.283; c.beginPath(); c.moveTo(110 + Math.cos(a) * 34, 320 + Math.sin(a) * 34); c.lineTo(110 + Math.cos(a) * 42, 320 + Math.sin(a) * 42); c.stroke(); }
      c.fillStyle = '#e6f0ff'; c.font = '16px serif'; c.fillText('SPAN 32', 230, 285); c.fillText('LOAD x3', 380, 340); c.strokeRect(300, 300, 160, 60);
    }),
    // Wokou: the sea through the boat shed's doors and the dojo's round window, the trade-routes chart, porcelain, the wave
    // tiles of the dojo floor. Warrior: the battle mural, the torn banners (green and rust), the ring sand
    sea_view: cv => cv('sea_view', 768, 256, (c, W, H) => {
      const hz = H * .55, g = c.createLinearGradient(0, 0, 0, hz); g.addColorStop(0, '#6f93b8'); g.addColorStop(1, '#dfe6e4'); c.fillStyle = g; c.fillRect(0, 0, W, hz);
      const s = c.createLinearGradient(0, hz, 0, H); s.addColorStop(0, '#4a7a8c'); s.addColorStop(1, '#1d4458'); c.fillStyle = s; c.fillRect(0, hz, W, H - hz); const r = rng(101);
      c.fillStyle = 'rgba(255,255,255,.45)'; for (let k = 0; k < 14; k++) { c.beginPath(); c.ellipse(r() * W, 18 + r() * 80, 40 + r() * 80, 7 + r() * 10, 0, 0, 7); c.fill(); }
      for (const [x0, w, h, col] of [[40, 180, 34, '#55707a'], [470, 120, 22, '#61797f'], [640, 90, 40, '#4d6870']]) { c.fillStyle = col; c.beginPath(); c.moveTo(x0, hz); for (let x = 0; x <= w; x += 6) c.lineTo(x0 + x, hz - h * Math.sin(Math.PI * x / w) * (.8 + .2 * r())); c.lineTo(x0 + w, hz); c.fill(); }
      c.strokeStyle = 'rgba(230,240,245,.35)'; c.lineWidth = 1.5; for (let k = 0; k < 140; k++) { const x = r() * W, y = hz + 4 + r() * (H - hz), l = 6 + 22 * r(); c.beginPath(); c.moveTo(x, y); c.lineTo(x + l, y); c.stroke(); }
      c.fillStyle = '#2a1c14'; c.beginPath(); c.moveTo(300, hz + 3); c.lineTo(352, hz + 3); c.lineTo(346, hz - 4); c.lineTo(306, hz - 4); c.fill(); c.fillStyle = '#7a2a1c'; c.fillRect(318, hz - 40, 18, 35); c.fillRect(338, hz - 30, 10, 25);
    }),
    trade_map: cv => cv('trade_map', 1024, 512, (c, W, H) => {
      c.fillStyle = '#b9cbb8'; c.fillRect(0, 0, W, H); const r = rng(102);
      for (let k = 0; k < 1600; k++) { c.fillStyle = `rgba(90,70,30,${.02 + .04 * r()})`; c.fillRect(r() * W, r() * H, 2 + 8 * r(), 2 + 8 * r()); }
      const ports = [];
      for (const [cx, cy, R] of [[150, 140, 95], [420, 330, 120], [700, 150, 80], [880, 360, 100], [560, 90, 40], [260, 420, 50], [800, 60, 35], [960, 180, 30]]) {
        const ph = r() * 6, ph2 = r() * 6; c.beginPath(); for (let k = 0; k <= 64; k++) { const a = k / 64 * 6.283, rr = R * (1 + .22 * Math.sin(3 * a + ph) + .12 * Math.sin(7 * a + ph2)); k ? c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * .8) : c.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * .8); }
        c.fillStyle = '#dcc79a'; c.fill(); c.strokeStyle = '#6b5130'; c.lineWidth = 3; c.stroke(); c.strokeStyle = 'rgba(70,90,110,.35)'; c.lineWidth = 8; c.stroke();
        c.fillStyle = 'rgba(110,130,70,.35)'; for (let q = 0; q < 6; q++) { c.beginPath(); c.arc(cx + (r() - .5) * R, cy + (r() - .5) * R * .6, 6 + r() * 12, 0, 7); c.fill(); }
        ports.push([cx + (r() - .5) * R * .8, cy + (r() - .5) * R * .5]);
      }
      c.strokeStyle = '#a3241a'; c.lineWidth = 3; c.setLineDash([10, 8]);
      for (const [a, b] of [[0, 1], [1, 2], [2, 3], [0, 4], [4, 2], [1, 5], [2, 6], [3, 7], [1, 3]]) { const [x0, y0] = ports[a], [x1, y1] = ports[b]; c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo((x0 + x1) / 2 + (r() - .5) * 120, (y0 + y1) / 2 + (r() - .5) * 90, x1, y1); c.stroke(); }
      c.setLineDash([]);
      for (const [x, y] of ports) { c.fillStyle = '#a3241a'; c.beginPath(); c.arc(x, y, 8, 0, 7); c.fill(); c.fillStyle = '#2a1a10'; c.fillRect(x + 12, y - 4, 30 + r() * 30, 5); }
      const rose = (x, y, R) => { c.strokeStyle = '#4a3420'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, R, 0, 7); c.stroke(); for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283, l = k % 2 ? R * .6 : R * 1.15; c.fillStyle = k % 2 ? '#8a6a40' : '#3a2814'; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a - .14) * R * .3, y + Math.sin(a - .14) * R * .3); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.lineTo(x + Math.cos(a + .14) * R * .3, y + Math.sin(a + .14) * R * .3); c.fill(); } };
      rose(90, 430, 50);
      c.save(); c.translate(640, 300); c.fillStyle = '#3a2410'; c.beginPath(); c.moveTo(-26, 0); c.lineTo(26, 0); c.lineTo(20, 9); c.lineTo(-20, 9); c.fill(); c.fillStyle = '#8a2a1c'; c.fillRect(-6, -34, 16, 32); c.restore();
      c.strokeStyle = '#4a3420'; c.lineWidth = 10; c.strokeRect(5, 5, W - 10, H - 10); c.lineWidth = 2; c.strokeRect(18, 18, W - 36, H - 36);
    }),
    porcelain: cv => cv('porcelain', 128, 256, (c, W, H) => {
      c.fillStyle = '#f2f3f4'; c.fillRect(0, 0, W, H); c.fillStyle = '#23468e';
      for (const y of [8, 26, H - 34, H - 16]) c.fillRect(0, y, W, 6);
      c.strokeStyle = '#23468e'; c.lineWidth = 3; for (let x = 0; x < W; x += 16) { c.beginPath(); c.arc(x + 8, 48, 8, Math.PI, 0); c.stroke(); }
      for (const [x, y, s] of [[34, 120, 22], [96, 160, 16], [64, 196, 12]]) { for (let k = 0; k < 6; k++) { const a = k / 6 * 6.283; c.beginPath(); c.ellipse(x + Math.cos(a) * s * .6, y + Math.sin(a) * s * .6, s * .5, s * .25, a, 0, 7); c.fill(); } c.fillStyle = '#f2f3f4'; c.beginPath(); c.arc(x, y, s * .25, 0, 7); c.fill(); c.fillStyle = '#23468e'; }
      c.lineWidth = 2; c.beginPath(); c.moveTo(10, 210); c.bezierCurveTo(40, 150, 70, 240, 120, 90); c.stroke();
    }),
    seigaiha: cv => { const t = cv('seigaiha', 256, 256, (c, W) => {
      c.fillStyle = '#16294a'; c.fillRect(0, 0, W, W);
      for (let row = -1; row <= 8; row++) for (let col = -1; col <= 4; col++) {
        const x = col * 64 + (row % 2 ? 32 : 0), y = row * 32 + 32;
        for (const [rr, f] of [[32, '#1e3a66'], [25, '#c9a24a'], [22, '#1e3a66'], [15, '#2a4e84'], [12, '#1e3a66'], [6, '#c9a24a']]) { c.fillStyle = f; c.beginPath(); c.arc(x, y, rr, Math.PI, 0); c.closePath(); c.fill(); }
      }
    }); t.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE; return t; },
    mural_battle: cv => cv('mural_battle', 1024, 256, (c, W, H) => {
      const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#5a2a1a'); g.addColorStop(.55, '#b8693a'); g.addColorStop(1, '#3a2014'); c.fillStyle = g; c.fillRect(0, 0, W, H); const r = rng(103);
      c.strokeStyle = '#e8c070'; c.lineWidth = 10; c.beginPath(); c.arc(860, 70, 46, .4, 5.6); c.stroke(); c.lineWidth = 4; c.beginPath(); c.moveTo(895, 52); c.lineTo(880, 70); c.lineTo(898, 84); c.stroke();
      c.fillStyle = 'rgba(40,20,12,.6)'; c.beginPath(); c.moveTo(0, H); for (let x = 0; x <= W; x += 16) c.lineTo(x, 170 - 30 * Math.sin(x / 90) - 10 * r()); c.lineTo(W, H); c.fill();
      for (let k = 0; k < 10; k++) { c.fillStyle = `rgba(90,70,60,${.2 + .2 * r()})`; c.beginPath(); c.ellipse(r() * W, 60 + r() * 80, 60 + r() * 60, 20, 0, 0, 7); c.fill(); }
      const ant = (x, y, s, dir, flag) => {
        c.save(); c.translate(x, y); c.scale(dir * s, s); c.fillStyle = '#1a0f0a'; c.strokeStyle = '#1a0f0a'; c.lineWidth = 3;
        c.beginPath(); c.ellipse(-14, -26, 12, 9, -.3, 0, 7); c.fill(); c.beginPath(); c.ellipse(0, -40, 7, 12, .2, 0, 7); c.fill(); c.beginPath(); c.arc(6, -58, 8, 0, 7); c.fill();
        for (const [a, b] of [[-8, -8], [0, -6], [6, -4]]) { c.beginPath(); c.moveTo(a / 2, -34); c.lineTo(a, -16); c.lineTo(a + b, 0); c.stroke(); }
        c.beginPath(); c.moveTo(8, -64); c.quadraticCurveTo(14, -78, 22, -76); c.stroke(); c.beginPath(); c.moveTo(4, -64); c.quadraticCurveTo(4, -80, 12, -82); c.stroke();
        c.lineWidth = 2.5; c.beginPath(); c.moveTo(-6, -20); c.lineTo(40, -70); c.stroke(); c.fillStyle = '#c8c0b0'; c.beginPath(); c.moveTo(40, -70); c.lineTo(36, -62); c.lineTo(48, -78); c.fill();
        if (flag) { c.strokeStyle = '#1a0f0a'; c.beginPath(); c.moveTo(-10, -30); c.lineTo(-10, -110); c.stroke(); c.fillStyle = '#34502e'; c.fillRect(-10, -110, -30, 40); c.strokeStyle = '#d8b04a'; c.lineWidth = 2; c.beginPath(); c.arc(-25, -90, 9, .4, 5.6); c.stroke(); }
        c.restore();
      };
      for (let k = 0; k < 34; k++) { const x = 20 + k * 30 + r() * 12, row = k % 3; ant(x, 200 + row * 20 + r() * 6, .7 + row * .18, k > 22 ? -1 : 1, k % 7 === 2); }
      c.strokeStyle = 'rgba(30,15,10,.6)'; c.lineWidth = 8; c.strokeRect(4, 4, W - 8, H - 8);
    }),
    banner_torn: cv => tornBanner(cv, 'banner_torn', '#33502e', '#d8b04a', 104),
    banner_torn_rust: cv => tornBanner(cv, 'banner_torn_rust', '#6e2a1a', '#d89a4a', 105),
    // Cute & Creepy: the manor's checker floor, the gang's portraits, stained glass (purple manor, green crypt), the spell book.
    // Chumpz: bamboo walls, tiki masks, the turquoise sea through the cabin windows, the treasure map. Saints: the skyline
    // through the HQ's glass wall, the rotunda's dome, the LA mural, the neon signs, the scoreboard, the maple court
    checker_cc: cv => { const t = cv('checker_cc', 256, 256, (c, W) => { const q = W / 4, r = rng(111); for (let i = 0; i < 4; i++) for (let k = 0; k < 4; k++) { c.fillStyle = (i + k) % 2 ? '#d6cde4' : '#24172f'; c.fillRect(i * q, k * q, q, q); } for (let n = 0; n < 900; n++) { c.fillStyle = `rgba(${r() < .5 ? '0,0,0' : '255,255,255'},${.03 + .04 * r()})`; c.fillRect(r() * W, r() * W, 2 + 4 * r(), 2 + 4 * r()); } c.strokeStyle = 'rgba(20,10,30,.6)'; c.lineWidth = 2; for (let i = 0; i <= 4; i++) { c.beginPath(); c.moveTo(i * q, 0); c.lineTo(i * q, W); c.stroke(); c.beginPath(); c.moveTo(0, i * q); c.lineTo(W, i * q); c.stroke(); } }); t.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE; return t; },
    cc_portraits: cv => cv('cc_portraits', 1024, 320, (c, W, H) => {
      const pw = W / 4;
      for (let k = 0; k < 4; k++) {
        const x0 = k * pw, cx = x0 + pw / 2, cy = H / 2 + 10, g = c.createRadialGradient(cx, cy - 30, 10, cx, cy, 170); g.addColorStop(0, ['#5a3a72', '#3a2a4a', '#2e3c52', '#4a2a3a'][k]); g.addColorStop(1, '#120a18'); c.fillStyle = g; c.fillRect(x0, 0, pw, H);
        if (k === 0) { c.fillStyle = '#f2f0f6'; c.beginPath(); c.moveTo(cx - 70, H - 20); c.quadraticCurveTo(cx - 80, 80, cx, 70); c.quadraticCurveTo(cx + 80, 80, cx + 70, H - 20); for (let w = 0; w < 5; w++) c.lineTo(cx + 70 - w * 35 - 17, H - 40 + (w % 2) * 20); c.fill(); c.fillStyle = '#1a1020'; for (const s of [-1, 1]) { c.beginPath(); c.ellipse(cx + s * 24, 150, 10, 15, 0, 0, 7); c.fill(); } c.beginPath(); c.ellipse(cx, 196, 12, 8, 0, 0, 7); c.fill(); c.fillStyle = '#e04a7a'; c.beginPath(); c.moveTo(cx + 26, 92); c.lineTo(cx + 60, 74); c.lineTo(cx + 56, 110); c.fill(); c.beginPath(); c.moveTo(cx + 26, 92); c.lineTo(cx - 6, 72); c.lineTo(cx - 2, 108); c.fill(); }
        if (k === 1) { c.fillStyle = '#e8762a'; c.beginPath(); c.ellipse(cx, 190, 82, 70, 0, 0, 7); c.fill(); c.strokeStyle = '#b8541a'; c.lineWidth = 4; for (const dx of [-40, 0, 40]) { c.beginPath(); c.ellipse(cx + dx, 190, 22, 68, 0, 0, 7); c.stroke(); } c.fillStyle = '#ffd25a'; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(cx + s * 40, 168); c.lineTo(cx + s * 16, 168); c.lineTo(cx + s * 28, 148); c.fill(); } c.beginPath(); c.moveTo(cx - 40, 212); c.quadraticCurveTo(cx, 240, cx + 40, 212); c.lineTo(cx + 30, 222); c.quadraticCurveTo(cx, 236, cx - 30, 222); c.fill(); c.fillStyle = '#16101c'; c.fillRect(cx - 50, 92, 100, 18); c.fillRect(cx - 34, 30, 68, 64); c.fillStyle = '#6a2a8a'; c.fillRect(cx - 34, 80, 68, 10); }
        if (k === 2) { c.fillStyle = '#0d0a10'; c.beginPath(); c.ellipse(cx, 230, 74, 70, 0, 0, 7); c.fill(); c.beginPath(); c.arc(cx, 140, 62, 0, 7); c.fill(); for (const s of [-1, 1]) { c.beginPath(); c.moveTo(cx + s * 56, 120); c.lineTo(cx + s * 44, 66); c.lineTo(cx + s * 18, 92); c.fill(); } c.fillStyle = '#f2e6ff'; for (let q = 0; q < 10; q++) { const a = Math.PI * (.15 + .7 * q / 9); c.beginPath(); c.ellipse(cx + Math.cos(a) * 72, 196 + Math.sin(a) * 18, 14, 9, a, 0, 7); c.fill(); } c.fillStyle = '#8ff07a'; for (const s of [-1, 1]) { c.beginPath(); c.ellipse(cx + s * 24, 136, 13, 16, 0, 0, 7); c.fill(); } c.fillStyle = '#0d0a10'; for (const s of [-1, 1]) c.fillRect(cx + s * 24 - 3, 124, 6, 24); }
        if (k === 3) { c.fillStyle = '#efe8dc'; c.beginPath(); c.ellipse(cx, 150, 58, 66, 0, 0, 7); c.fill(); c.fillStyle = '#1a1020'; for (const s of [-1, 1]) { c.beginPath(); c.ellipse(cx + s * 22, 146, 15, 18, 0, 0, 7); c.fill(); } c.beginPath(); c.moveTo(cx, 166); c.lineTo(cx - 7, 180); c.lineTo(cx + 7, 180); c.fill(); for (let t = -3; t <= 3; t++) c.fillRect(cx + t * 8 - 2, 192, 4, 10); c.fillStyle = '#7a2a5a'; c.beginPath(); c.moveTo(cx - 90, H); c.quadraticCurveTo(cx, 200, cx + 90, H); c.fill(); for (const [fx, fy, fc] of [[-48, 92, '#ff6a9a'], [-22, 80, '#ffd25a'], [10, 82, '#8a6aff'], [40, 94, '#ff6a9a']]) { c.fillStyle = fc; c.beginPath(); c.arc(cx + fx, fy, 13, 0, 7); c.fill(); } }
        c.strokeStyle = '#c9a24a'; c.lineWidth = 10; c.strokeRect(x0 + 5, 5, pw - 10, H - 10);
      }
    }),
    stained_purple: cv => stainedGlass(cv, 'stained_purple', ['#5a2a9a', '#8a4ad0', '#2a6a9a', '#c9a24a', '#3a1a6a'], 112),
    stained_green: cv => stainedGlass(cv, 'stained_green', ['#2a8a4a', '#6ad07a', '#1a5a3a', '#c9d04a', '#0e3a24'], 113),
    spellbook: cv => cv('spellbook', 256, 192, (c, W, H) => {
      c.fillStyle = '#e8dcc0'; c.fillRect(0, 0, W, H); c.fillStyle = 'rgba(120,90,50,.25)'; c.fillRect(W / 2 - 6, 0, 12, H); const r = rng(114);
      for (const x0 of [16, W / 2 + 14]) { for (let y = 20; y < H - 20; y += 14) { c.fillStyle = '#3a2a4a'; c.fillRect(x0, y, 40 + r() * 54, 4); } }
      c.strokeStyle = '#4ad07a'; c.lineWidth = 3; c.beginPath(); c.arc(W * .25, 110, 26, 0, 7); c.stroke(); c.beginPath(); c.moveTo(W * .25, 84); c.lineTo(W * .25, 136); c.moveTo(W * .25 - 26, 110); c.lineTo(W * .25 + 26, 110); c.stroke();
      c.strokeStyle = '#a06ae0'; c.beginPath(); c.arc(W * .75, 104, 22, .6, 5.6); c.stroke(); c.fillStyle = '#a06ae0'; for (let k = 0; k < 5; k++) { const a = k / 5 * 6.283; c.beginPath(); c.arc(W * .75 + Math.cos(a) * 34, 104 + Math.sin(a) * 34, 3, 0, 7); c.fill(); }
    }),
    bamboo_wall: cv => { const t = cv('bamboo_wall', 256, 256, (c, W) => { const r = rng(115), n = 8, w = W / n; for (let k = 0; k < n; k++) { const x = k * w, g = c.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, '#8a7a34'); g.addColorStop(.35, '#d8c870'); g.addColorStop(.7, '#b8a450'); g.addColorStop(1, '#6a5a22'); c.fillStyle = g; c.fillRect(x + 1, 0, w - 2, W); for (const y of [40 + r() * 20, 150 + r() * 30]) { c.fillStyle = '#5a4a1a'; c.fillRect(x + 1, y, w - 2, 5); c.fillStyle = '#e8dc90'; c.fillRect(x + 1, y + 5, w - 2, 2); } } }); t.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE; return t; },
    tiki_mask: cv => cv('tiki_mask', 128, 256, (c, W, H) => {
      c.fillStyle = '#6a3e1e'; c.fillRect(0, 0, W, H); c.fillStyle = '#4a2a12'; for (let y = 0; y < H; y += 9) c.fillRect(0, y, W, 2);
      c.fillStyle = '#2a160a'; c.fillRect(10, 30, W - 20, 22); for (const s of [-1, 1]) { c.fillStyle = '#f0e0b0'; c.beginPath(); c.ellipse(W / 2 + s * 26, 86, 18, 22, 0, 0, 7); c.fill(); c.fillStyle = '#1a0e06'; c.beginPath(); c.arc(W / 2 + s * 26, 88, 9, 0, 7); c.fill(); }
      c.fillStyle = '#3a200e'; c.beginPath(); c.moveTo(W / 2, 100); c.lineTo(W / 2 - 14, 150); c.lineTo(W / 2 + 14, 150); c.fill();
      c.fillStyle = '#1a0e06'; c.fillRect(18, 170, W - 36, 50); c.fillStyle = '#f0e0b0'; for (let k = 0; k < 6; k++) { c.fillRect(22 + k * 15, 172, 10, 14); c.fillRect(22 + k * 15, 204, 10, 14); }
      c.fillStyle = '#e0a020'; c.fillRect(0, 0, W, 10); c.fillRect(0, H - 12, W, 12);
    }),
    sea_turq: cv => cv('sea_turq', 768, 256, (c, W, H) => {
      const hz = H * .5, g = c.createLinearGradient(0, 0, 0, hz); g.addColorStop(0, '#5ab8e8'); g.addColorStop(1, '#d8f4f6'); c.fillStyle = g; c.fillRect(0, 0, W, hz);
      const s = c.createLinearGradient(0, hz, 0, H); s.addColorStop(0, '#2ac4c4'); s.addColorStop(1, '#0a8a9a'); c.fillStyle = s; c.fillRect(0, hz, W, H - hz); const r = rng(116);
      c.fillStyle = 'rgba(255,255,255,.7)'; for (let k = 0; k < 10; k++) { c.beginPath(); c.ellipse(r() * W, 20 + r() * 70, 40 + r() * 60, 10 + r() * 8, 0, 0, 7); c.fill(); }
      for (const [x0, w] of [[90, 140], [520, 90]]) { c.fillStyle = '#e8d8a0'; c.beginPath(); c.ellipse(x0 + w / 2, hz + 4, w / 2, 9, 0, 0, 7); c.fill(); c.fillStyle = '#3a8a3a'; c.beginPath(); c.ellipse(x0 + w / 2, hz - 6, w * .36, 16, 0, Math.PI, 0); c.fill(); for (let k = 0; k < 3; k++) { const px = x0 + w * (.3 + .2 * k); c.strokeStyle = '#5a3a1a'; c.lineWidth = 3; c.beginPath(); c.moveTo(px, hz - 4); c.quadraticCurveTo(px + 6, hz - 30, px + 2, hz - 46); c.stroke(); c.fillStyle = '#2a7a2a'; for (let q = 0; q < 5; q++) { c.beginPath(); c.ellipse(px + 2 + Math.cos(q * 1.26) * 12, hz - 46 + Math.sin(q * 1.26) * 5, 14, 4, q * 1.26, 0, 7); c.fill(); } } }
      c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = 1.5; for (let k = 0; k < 120; k++) { const x = r() * W, y = hz + 6 + r() * (H - hz), l = 6 + 18 * r(); c.beginPath(); c.moveTo(x, y); c.lineTo(x + l, y); c.stroke(); }
    }),
    treasure_map: cv => cv('treasure_map', 512, 384, (c, W, H) => {
      c.fillStyle = '#dcc79a'; c.fillRect(0, 0, W, H); const r = rng(117); for (let k = 0; k < 900; k++) { c.fillStyle = `rgba(100,70,30,${.03 + .05 * r()})`; c.fillRect(r() * W, r() * H, 3 + 8 * r(), 3 + 8 * r()); }
      c.fillStyle = '#9ac4b4'; c.fillRect(30, 30, W - 60, H - 60); c.beginPath(); for (let k = 0; k <= 48; k++) { const a = k / 48 * 6.283, rr = 120 * (1 + .2 * Math.sin(3 * a + 1) + .1 * Math.sin(7 * a)); k ? c.lineTo(W / 2 + Math.cos(a) * rr * 1.2, H / 2 + Math.sin(a) * rr * .8) : c.moveTo(W / 2 + Math.cos(a) * rr * 1.2, H / 2 + Math.sin(a) * rr * .8); }
      c.fillStyle = '#e8d4a0'; c.fill(); c.strokeStyle = '#5a4020'; c.lineWidth = 3; c.stroke();
      c.strokeStyle = '#8a2a1a'; c.setLineDash([8, 8]); c.lineWidth = 3; c.beginPath(); c.moveTo(150, 260); c.bezierCurveTo(200, 160, 290, 260, 340, 170); c.stroke(); c.setLineDash([]);
      c.lineWidth = 7; c.beginPath(); c.moveTo(326, 156); c.lineTo(354, 184); c.moveTo(354, 156); c.lineTo(326, 184); c.stroke();
      c.fillStyle = '#3a6a2a'; for (const [x, y] of [[200, 150], [230, 230], [300, 250]]) { c.beginPath(); c.arc(x, y, 12, 0, 7); c.fill(); }
      c.fillStyle = '#e8c040'; c.beginPath(); c.ellipse(160, 270, 22, 12, -.3, 0, 7); c.fill(); c.strokeStyle = '#5a4020'; c.lineWidth = 2; c.stroke();
      c.strokeStyle = '#4a3420'; c.lineWidth = 2; c.beginPath(); c.arc(430, 300, 34, 0, 7); c.stroke(); c.fillStyle = '#4a3420'; c.beginPath(); c.moveTo(430, 262); c.lineTo(424, 300); c.lineTo(436, 300); c.fill();
      c.strokeStyle = '#5a4020'; c.lineWidth = 8; c.strokeRect(6, 6, W - 12, H - 12);
    }),
    la_skyline: cv => cv('la_skyline', 1024, 384, (c, W, H) => {
      const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2a1a5a'); g.addColorStop(.45, '#c85a6a'); g.addColorStop(.7, '#f4a45a'); g.addColorStop(1, '#f8d090'); c.fillStyle = g; c.fillRect(0, 0, W, H); const r = rng(118);
      c.fillStyle = '#6a4a6a'; c.beginPath(); c.moveTo(0, H * .72); for (let x = 0; x <= W; x += 20) c.lineTo(x, H * .62 - 40 * Math.sin(x / 140) - 16 * r()); c.lineTo(W, H); c.lineTo(0, H); c.fill();
      for (let x = 260; x < 760; x += 26 + r() * 20) { const h = 60 + r() * 150 * (1 - Math.abs(x - 510) / 300), w = 18 + r() * 26; c.fillStyle = '#2a1e3a'; c.fillRect(x, H * .78 - h, w, h + H * .22); c.fillStyle = 'rgba(255,220,140,.8)'; for (let q = 0; q < h / 8; q++) if (r() < .45) c.fillRect(x + 3 + (q % 3) * (w / 3), H * .78 - h + 6 + q * 7, 3, 2); }
      c.fillStyle = '#1a1226'; c.fillRect(0, H * .86, W, H * .14);
      for (let k = 0; k < 9; k++) { const px = 40 + k * 120 + r() * 40, ph = 120 + r() * 70; c.strokeStyle = '#1a1226'; c.lineWidth = 4; c.beginPath(); c.moveTo(px, H * .88); c.quadraticCurveTo(px + 8, H * .88 - ph / 2, px + 4, H * .88 - ph); c.stroke(); c.fillStyle = '#1a1226'; for (let q = 0; q < 7; q++) { const a = q / 7 * 6.283; c.beginPath(); c.ellipse(px + 4 + Math.cos(a) * 16, H * .88 - ph + Math.sin(a) * 6, 18, 4, a, 0, 7); c.fill(); } }
      c.fillStyle = '#fff4c0'; for (let k = 0; k < 40; k++) c.fillRect(r() * W, H * .88 + r() * H * .1, 2, 2);
    }),
    deco_dome: cv => cv('deco_dome', 512, 256, (c, W, H) => {
      const g = c.createLinearGradient(0, H, 0, 0); g.addColorStop(0, '#1e3a4a'); g.addColorStop(1, '#0e1e2a'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      c.fillStyle = 'rgba(216,178,92,.85)'; for (let k = 0; k < 16; k++) { const x = k * W / 16; c.beginPath(); c.moveTo(x + 6, H); c.lineTo(x + W / 32, 0); c.lineTo(x + W / 16 - 6, H); c.fill(); }
      c.fillStyle = '#0e1e2a'; for (let k = 0; k < 16; k++) { const x = k * W / 16; c.beginPath(); c.moveTo(x + 12, H); c.lineTo(x + W / 32, 30); c.lineTo(x + W / 16 - 12, H); c.fill(); }
      const r = rng(119); c.fillStyle = '#f4e4b0'; for (let k = 0; k < 60; k++) { c.beginPath(); c.arc(r() * W, r() * H * .8, .6 + 1.4 * r(), 0, 7); c.fill(); }
      c.fillStyle = '#d8b25c'; c.fillRect(0, H - 10, W, 10);
    }),
    mural_la: cv => cv('mural_la', 512, 256, (c, W, H) => {
      const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#f45a7a'); g.addColorStop(.5, '#f8a44a'); g.addColorStop(1, '#f8d870'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      c.fillStyle = '#ffe890'; c.beginPath(); c.arc(W / 2, H * .62, 70, Math.PI, 0); c.fill(); c.fillStyle = 'rgba(244,90,122,.7)'; for (let k = 0; k < 5; k++) c.fillRect(W / 2 - 80, H * .62 - 60 + k * 14, 160, 5);
      c.fillStyle = '#2a1430'; c.fillRect(0, H * .8, W, H * .2); c.beginPath(); c.moveTo(150, H * .8); c.lineTo(170, H * .7); c.lineTo(250, H * .68); c.lineTo(300, H * .72); c.lineTo(360, H * .74); c.lineTo(370, H * .8); c.fill(); for (const x of [190, 330]) { c.beginPath(); c.arc(x, H * .82, 14, 0, 7); c.fill(); }
      for (const px of [60, 110, 420, 470]) { c.strokeStyle = '#2a1430'; c.lineWidth = 5; c.beginPath(); c.moveTo(px, H * .82); c.quadraticCurveTo(px + 10, H * .5, px + 4, H * .25); c.stroke(); c.fillStyle = '#2a1430'; for (let q = 0; q < 7; q++) { const a = q / 7 * 6.283; c.beginPath(); c.ellipse(px + 4 + Math.cos(a) * 22, H * .25 + Math.sin(a) * 8, 24, 5, a, 0, 7); c.fill(); } }
      c.strokeStyle = '#d8b25c'; c.lineWidth = 8; c.strokeRect(4, 4, W - 8, H - 8);
    }),
    neon_open: cv => cv('neon_open', 256, 96, (c, W, H) => { c.clearRect(0, 0, W, H); c.font = 'bold 64px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.shadowColor = '#ff3aa0'; c.shadowBlur = 18; c.strokeStyle = '#ff6ac0'; c.lineWidth = 6; c.strokeText('OPEN', W / 2, H / 2 + 2); c.shadowBlur = 0; c.strokeStyle = '#ffe0f4'; c.lineWidth = 2; c.strokeText('OPEN', W / 2, H / 2 + 2); }),
    neon_block: cv => cv('neon_block', 512, 128, (c, W, H) => { c.clearRect(0, 0, W, H); c.font = 'bold 66px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; for (const [txt, x, col] of [['BLOCK', W * .3, '#2ae0d0'], ['PARTY', W * .72, '#ff8a2a']]) { c.shadowColor = col; c.shadowBlur = 20; c.strokeStyle = col; c.lineWidth = 7; c.strokeText(txt, x, H / 2); c.shadowBlur = 0; c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.strokeText(txt, x, H / 2); } }),
    scoreboard: cv => cv('scoreboard', 256, 128, (c, W, H) => { c.fillStyle = '#08060c'; c.fillRect(0, 0, W, H); c.font = 'bold 22px sans-serif'; c.textAlign = 'center'; c.fillStyle = '#d8b25c'; c.fillText('SAINTS', W * .25, 28); c.fillText('GUEST', W * .75, 28); c.font = 'bold 56px monospace'; c.fillStyle = '#ff4a3a'; c.fillText('88', W * .25, 92); c.fillText('86', W * .75, 92); c.fillStyle = '#4aff6a'; c.font = 'bold 18px monospace'; c.fillText('4TH  0:24', W / 2, 118); c.strokeStyle = '#6a4a9a'; c.lineWidth = 4; c.strokeRect(2, 2, W - 4, H - 4); }),
    court_maple: cv => cv('court_maple', 1024, 512, (c, W, H) => {
      const r = rng(120); for (let y = 0; y < H; y += 16) for (let x = (y / 16 % 2) * 60 - 60; x < W; x += 120) { c.fillStyle = `rgb(${206 + r() * 24 | 0},${158 + r() * 20 | 0},${98 + r() * 18 | 0})`; c.fillRect(x, y, 120, 16); c.fillStyle = 'rgba(90,60,30,.25)'; c.fillRect(x, y + 15, 120, 1); c.fillRect(x, y, 1, 16); }
      c.fillStyle = 'rgba(92,40,140,.85)'; for (const x0 of [0, W - 200]) { c.fillRect(x0, H / 2 - 80, 200, 160); c.beginPath(); c.arc(x0 ? W - 200 : 200, H / 2, 80, x0 ? Math.PI / 2 : -Math.PI / 2, x0 ? Math.PI * 1.5 : Math.PI / 2); c.fill(); }
      c.beginPath(); c.arc(W / 2, H / 2, 70, 0, 7); c.fill();
      c.strokeStyle = '#e8c86a'; c.lineWidth = 6; c.strokeRect(10, 10, W - 20, H - 20); c.beginPath(); c.moveTo(W / 2, 10); c.lineTo(W / 2, H - 10); c.stroke(); c.beginPath(); c.arc(W / 2, H / 2, 70, 0, 7); c.stroke();
      for (const x0 of [10, W - 10]) { const d = x0 < W / 2 ? 1 : -1; c.beginPath(); c.arc(x0 + d * 50, H / 2, 210, -Math.PI / 2 * .93, Math.PI / 2 * .93, d < 0); c.stroke(); c.strokeRect(Math.min(x0, x0 + d * 190), H / 2 - 80, 190, 160); }
    }),
    slot_reels: cv => cv('slot_reels', 192, 96, (c, W, H) => { c.fillStyle = '#1a1208'; c.fillRect(0, 0, W, H); for (let k = 0; k < 3; k++) { const x = 8 + k * 62; c.fillStyle = '#f4f0e4'; c.fillRect(x, 12, 52, 72); c.fillStyle = '#f2c81a'; c.beginPath(); c.moveTo(x + 10, 60); c.quadraticCurveTo(x + 26, 70, x + 44, 40); c.quadraticCurveTo(x + 30, 58, x + 10, 50); c.fill(); c.fillStyle = '#d82a1a'; if (k === 1) { c.font = 'bold 30px sans-serif'; c.fillText('7', x + 18, 44); } } c.strokeStyle = '#e8b030'; c.lineWidth = 4; c.strokeRect(2, 2, W - 4, H - 4); }),
    sand_ring: cv => { const t = cv('sand_ring', 256, 256, (c, W) => { c.fillStyle = '#c9a874'; c.fillRect(0, 0, W, W); const r = rng(106); for (let k = 0; k < 3000; k++) { const v = r(); c.fillStyle = v < .5 ? `rgba(120,90,50,${.08 + .1 * r()})` : `rgba(240,220,180,${.08 + .12 * r()})`; c.fillRect(r() * W, r() * W, 1 + 3 * r(), 1 + 3 * r()); } }); t.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE; return t; }
  };
  // a lancet of stained glass: leaded panes in the palette, a moon roundel, lit from behind (rooms)
  function stainedGlass(cv, name, pal, seed) {
    return cv(name, 256, 512, (c, W, H) => {
      const r = rng(seed); c.fillStyle = pal[4]; c.fillRect(0, 0, W, H);
      for (let y = 0; y < H; y += 40) for (let x = 0; x < W; x += 42) { c.fillStyle = pal[(r() * 4) | 0]; c.beginPath(); c.moveTo(x + 3, y + 3 + r() * 8); c.lineTo(x + 39, y + 3 + r() * 8); c.lineTo(x + 39 - r() * 8, y + 37); c.lineTo(x + 3 + r() * 8, y + 37); c.fill(); }
      c.fillStyle = '#f4ecd0'; c.beginPath(); c.arc(W / 2, H * .3, 52, 0, 7); c.fill(); c.fillStyle = pal[4]; c.beginPath(); c.arc(W / 2 + 22, H * .3 - 12, 46, 0, 7); c.fill();
      c.strokeStyle = '#120a14'; c.lineWidth = 5; for (let y = 0; y <= H; y += 40) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); } for (let x = 0; x <= W; x += 42) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
      c.lineWidth = 7; c.beginPath(); c.arc(W / 2, H * .3, 56, 0, 7); c.stroke(); c.strokeRect(4, 4, W - 8, H - 8);
    });
  }
  // a battle banner worn to rags: cloth with a gold border and the cracked circle, its lower edge torn, holes through it
  function tornBanner(cv, name, cloth, gold, seed) {
    const t = cv(name, 128, 384, (c, W, H) => {
      const r = rng(seed); c.clearRect(0, 0, W, H); c.fillStyle = cloth; c.beginPath(); c.moveTo(0, 0); c.lineTo(W, 0); c.lineTo(W, H * .7);
      for (let x = W; x >= 0; x -= 8) c.lineTo(x, H * (.72 + .26 * r() * r()) - (x % 16 ? 0 : 10 * r())); c.closePath(); c.fill();
      c.fillStyle = 'rgba(0,0,0,.18)'; for (let k = 0; k < 40; k++) c.fillRect(r() * W, r() * H * .8, 2 + 6 * r(), 8 + 30 * r());
      c.strokeStyle = gold; c.lineWidth = 5; c.beginPath(); c.moveTo(8, H * .66); c.lineTo(8, 8); c.lineTo(W - 8, 8); c.lineTo(W - 8, H * .64); c.stroke();
      c.lineWidth = 9; c.beginPath(); c.arc(W / 2, 110, 34, .5, 5.5); c.stroke(); c.lineWidth = 4; c.beginPath(); c.moveTo(W / 2 + 34, 92); c.lineTo(W / 2 + 18, 110); c.lineTo(W / 2 + 36, 126); c.stroke();
      c.globalCompositeOperation = 'destination-out'; for (let k = 0; k < 5; k++) { c.beginPath(); c.ellipse(16 + r() * (W - 32), 160 + r() * 120, 4 + 8 * r(), 6 + 12 * r(), r(), 0, 7); c.fill(); } c.globalCompositeOperation = 'source-over';
    });
    return t;
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
    } else if (icon === 'spider') { // the Cute & Creepy spider, hanging on its thread
      c.lineWidth = 4; c.beginPath(); c.moveTo(W / 2, 30); c.lineTo(W / 2, H / 2 - 60); c.stroke();
      c.beginPath(); c.ellipse(W / 2, H / 2 - 30, 26, 30, 0, 0, 7); c.fill(); c.beginPath(); c.ellipse(W / 2, H / 2 + 35, 40, 52, 0, 0, 7); c.fill();
      c.lineWidth = 8; for (const sd of [-1, 1]) for (let k = 0; k < 4; k++) { const y0 = H / 2 - 40 + k * 16; c.beginPath(); c.moveTo(W / 2 + sd * 20, y0); c.lineTo(W / 2 + sd * (70 + 8 * k), y0 - 40 + k * 22); c.lineTo(W / 2 + sd * (95 + 6 * k), y0 + 10 + k * 34); c.stroke(); }
    } else if (icon === 'book') {
      c.lineWidth = 8; c.beginPath(); c.moveTo(W / 2, 330); c.quadraticCurveTo(W / 2 - 50, 300, W / 2 - 100, 320); c.lineTo(W / 2 - 100, 200); c.quadraticCurveTo(W / 2 - 50, 180, W / 2, 210); c.quadraticCurveTo(W / 2 + 50, 180, W / 2 + 100, 200); c.lineTo(W / 2 + 100, 320); c.quadraticCurveTo(W / 2 + 50, 300, W / 2, 330); c.closePath(); c.stroke(); c.beginPath(); c.moveTo(W / 2, 210); c.lineTo(W / 2, 330); c.stroke();
      for (let i = 0; i < 4; i++) for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(W / 2 + sd * 20, 235 + i * 20); c.lineTo(W / 2 + sd * 80, 230 + i * 20); c.stroke(); }
    } else if (icon === 'dice') {
      for (const [cx, cy, rot, n] of [[W / 2 - 50, H / 2 + 20, -.2, 5], [W / 2 + 55, H / 2 - 10, .25, 3]]) { c.save(); c.translate(cx, cy); c.rotate(rot); c.fillRect(-42, -42, 84, 84); c.fillStyle = '#3a2616'; for (const [px, py] of n === 5 ? [[-22, -22], [22, -22], [0, 0], [-22, 22], [22, 22]] : [[-22, -22], [0, 0], [22, 22]]) { c.beginPath(); c.arc(px, py, 9, 0, 7); c.fill(); } c.restore(); c.fillStyle = fg; }
    } else if (icon === 'fishbook') { // the bait & book shop: a fish and an open book
      c.fillStyle = '#c9d4dc'; c.beginPath(); c.ellipse(W / 2 - 62, H / 2, 58, 26, 0, 0, 7); c.fill(); c.beginPath(); c.moveTo(W / 2 - 118, H / 2); c.lineTo(W / 2 - 150, H / 2 - 26); c.lineTo(W / 2 - 150, H / 2 + 26); c.fill();
      c.fillStyle = '#26323a'; c.beginPath(); c.arc(W / 2 - 22, H / 2 - 6, 5, 0, 7); c.fill(); c.strokeStyle = '#7f96a4'; c.lineWidth = 3; for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(W / 2 - 60 - k * 14, H / 2, 14, -1, 1); c.stroke(); }
      c.fillStyle = fg; c.strokeStyle = '#6a4a2a'; c.lineWidth = 4; for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(W / 2 + 80, H / 2 - 40); c.quadraticCurveTo(W / 2 + 80 + sd * 30, H / 2 - 50, W / 2 + 80 + sd * 62, H / 2 - 40); c.lineTo(W / 2 + 80 + sd * 62, H / 2 + 34); c.quadraticCurveTo(W / 2 + 80 + sd * 30, H / 2 + 24, W / 2 + 80, H / 2 + 34); c.closePath(); c.fill(); c.stroke(); for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(W / 2 + 80 + sd * 10, H / 2 - 24 + k * 14); c.lineTo(W / 2 + 80 + sd * 52, H / 2 - 24 + k * 14); c.stroke(); } }
    } else if (icon === 'wheel') { // six circles round a seventh, in a ring (the Warrior hall's gold banners)
      c.lineWidth = 9; c.beginPath(); c.arc(W / 2, H / 2, 92, 0, 7); c.stroke();
      c.beginPath(); c.arc(W / 2, H / 2, 24, 0, 7); c.fill();
      for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; c.beginPath(); c.arc(W / 2 + Math.cos(a) * 58, H / 2 + Math.sin(a) * 58, 17, 0, 7); c.fill(); c.beginPath(); c.moveTo(W / 2, H / 2); c.lineTo(W / 2 + Math.cos(a) * 92, H / 2 + Math.sin(a) * 92); c.stroke(); }
    } else if (icon === 'board') {
      c.lineWidth = 6; const S0 = 150, x0 = W / 2 - S0 / 2, y0 = H / 2 - S0 / 2; c.strokeRect(x0, y0, S0, S0);
      for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(x0 + i * S0 / 4, y0); c.lineTo(x0 + i * S0 / 4, y0 + S0); c.moveTo(x0, y0 + i * S0 / 4); c.lineTo(x0 + S0, y0 + i * S0 / 4); c.stroke(); }
      for (const [a, b] of [[0, 0], [2, 1], [1, 3], [3, 2]]) c.fillRect(x0 + a * S0 / 4 + 8, y0 + b * S0 / 4 + 8, S0 / 4 - 16, S0 / 4 - 16);
    } else { c.fillRect(W / 2 - 12, 170, 24, 210); c.fillRect(W / 2 - 70, 150, 140, 55); }
    }
    c.setTransform(1, 0, 0, 1, 0, 0); t.update(); t.hasAlpha = false; return t;
  }

  // a square dark slate floor with the faction emblem inlaid in a ring (Ronin dojo)
  function floorTex(scene, name, bg, fg, faction) {
    const W = 512, t = new BABYLON.DynamicTexture('samKit_' + name, { width: W, height: W }, scene, true), c = t.getContext();
    c.fillStyle = bg; c.fillRect(0, 0, W, W); c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 3;
    for (let i = 1; i < 8; i++) { c.beginPath(); c.moveTo(i * W / 8, 0); c.lineTo(i * W / 8, W); c.moveTo(0, i * W / 8); c.lineTo(W, i * W / 8); c.stroke(); }
    c.strokeStyle = fg; c.lineWidth = 14; c.beginPath(); c.arc(W / 2, W / 2, W * .36, 0, 7); c.stroke();
    t.update();
    logoMask(faction, img => { const L = W * .5, o = document.createElement('canvas'); o.width = o.height = L; const oc = o.getContext('2d'); oc.drawImage(img, 0, 0, L, L); oc.globalCompositeOperation = 'source-in'; oc.fillStyle = fg; oc.fillRect(0, 0, L, L); c.drawImage(o, (W - L) / 2, (W - L) / 2); t.update(); });
    return t;
  }
  // Faction emblems on banners: cloth and emblem colours per faction (banner_<faction> materials)
  const FACTION_BANNERS = {
    samurai: ['#961816', '#ecd6aa'], wokou: ['#1c2a4c', '#d9a743'], yamabushi: ['#25402d', '#d6a640'], ronin: ['#6a1a1d', '#e3cfa4'],
    shogun: ['#5f1d45', '#d8b04a'], bushi: ['#7d2b22', '#d9b35a'], buke: ['#5e1a20', '#d8b35c'], ashigaru: ['#8c1c1c', '#d8b45a'],
    kenshi: ['#1f5753', '#d8b450'], sohei: ['#c38d2a', '#f8edd2'], warrior: ['#34502e', '#dcb24e']
  };
  const logoImgs = {};
  function logoMask(id, cb) {
    let L = logoImgs[id];
    if (!L) { L = logoImgs[id] = { img: new Image(), ready: false, waiting: [] }; L.img.onload = () => { L.ready = true; L.waiting.splice(0).forEach(f => f(L.img)); }; L.img.src = 'assets/brand/factions/' + id + '.png'; }
    if (L.ready) cb(L.img); else L.waiting.push(cb);
  }

  // the Chumpz apes (Miguel's NFTs): colours per ape; kit types chz_ape_<id>, rigged (see APE_J), rebel-sized (~3.3 m)
  const APE_LOOK = {
    racer: { fur: '#e2d5b6', furD: '#b4a482', furL: '#f6efdf', skin: '#d6b49c', skinD: '#9e7a64', eye: '#d42a1e', pupil: '#2a0605', grin: true, top: 'overalls', cloth: '#6b4220', clothL: '#a87a4c', hat: 'cap', bandana: true, pantsMat: 'ape_overall', shins: 'ape_overall' },
    band: { fur: '#8e8a86', furD: '#5c5854', furL: '#b8b4ae', skin: '#a0948a', skinD: '#665a52', eye: '#e6cc2a', pupil: '#2a2208', top: 'tank', cloth: '#3a3836', pants: '#2e4569', hat: 'headband', earring: true, pantsMat: 'ape_denim' },
    chain: { fur: '#c4b08c', furD: '#8e7a58', furL: '#ded0b2', skin: '#b8987e', skinD: '#80624a', eye: '#f2efe6', top: 'bare', chest: '#c8aa90', pants: '#76663f', hat: 'bucket', chain: true, bandana: true, earring: true, pantsMat: 'ape_khaki' },
    peel: { fur: '#cfc4ac', furD: '#9c9078', furL: '#e8e0cf', skin: '#bea490', skinD: '#866c5a', eye: '#f0ece2', pupil: '#222222', top: 'overalls', cloth: '#6b4220', clothL: '#a87a4c', hat: 'peel', glasses: 'shades', bandana: true, earring: true, pantsMat: 'ape_overall', shins: 'ape_overall' },
    peng: { fur: '#3b3835', furD: '#222222', furL: '#5a554f', skin: '#4f4945', skinD: '#28231f', eye: '#e8e4da', pupil: '#111111', top: 'overalls', cloth: '#6b4220', clothL: '#a87a4c', hat: 'penguin', glasses: 'goggles', bandana: true, pantsMat: 'ape_overall', shins: 'ape_overall' }
  };
  const hex3 = (h, k = 1) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255 * k);

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
    noren_kenshi: { tex: 'noren_kenshi' }, noren_kenshi_scroll: { tex: 'noren_kenshi_scroll' }, noren_kenshi_map: { tex: 'noren_kenshi_map' },
    noren_sohei: { tex: 'noren_sohei' }, noren_sohei_books: { tex: 'noren_sohei_books' }, noren_sohei_dots: { tex: 'noren_sohei_dots' },
    bronze: { col: [.3, .36, .27], spec: [.6, .55, .4], power: 40 },
    roof_brown: { tex: 'roof_brown' }, straw: { col: [.78, .64, .36] },
    plaster_old: { tex: 'plaster_old' }, slate: { tex: 'slate' }, ronin_floor: { tex: 'ronin_floor' }, noren_ronin: { tex: 'noren_ronin' },
    banner_ronin_scroll: { tex: 'banner_ronin_scroll' }, banner_ronin_board: { tex: 'banner_ronin_board' },
    needles: { tex: 'needles' }, needles_dark: { tex: 'needles_dark' }, bark_old: { tex: 'bark_old' }, granite: { tex: 'granite' }, moss: { tex: 'moss' },
    noren_ashigaru: { tex: 'noren_ashigaru' }, noren_bushi: { tex: 'noren_bushi' }, banner_bushi_scroll: { tex: 'banner_bushi_scroll' }, banner_bushi_board: { tex: 'banner_bushi_board' }, noren_wokou: { tex: 'noren_wokou' }, banner_ashi_scroll: { tex: 'banner_ashi_scroll' }, banner_ashi_board: { tex: 'banner_ashi_board' }, ashi_door: { tex: 'ashi_door' },
    noren_warrior: { tex: 'noren_warrior' }, banner_war_wheel: { tex: 'banner_war_wheel' }, tatami: { tex: 'tatami' }, war_map: { tex: 'war_map' },
    noren_shogun: { tex: 'noren_shogun' }, banner_shogun_mon: { tex: 'banner_shogun_mon' }, shogun_screen: { tex: 'shogun_screen' }, cushion: { col: [.36, .1, .26] }, cloth_purple: { col: [.38, .1, .28] },
    roof_purple: { tex: 'roof_purple' }, plaster_cc: { tex: 'plaster_old', tint: [.66, .6, .62] }, stone_dark: { tex: 'stone', tint: [.6, .56, .66] }, banner_cc: { tex: 'banner_cc' }, sign_book: { tex: 'sign_book' }, sign_dice: { tex: 'sign_dice' }, books: { tex: 'books', em: [.32, .2, .1] },
    window_glow: { col: [.95, .62, .22], em: [.95, .55, .16] }, teal_glow: { col: [.2, .8, .7], em: [.12, .7, .6] }, brew: { col: [.3, 1, .45], em: [.25, .95, .4] }, glow_green: { glow: [.3, 1, .45] }, glow_warm: { glow: [.85, .36, .06] },
    pumpkin: { col: [.88, .42, .08], em: [.3, .1, 0] }, ghost: { col: [.75, .85, 1], em: [.55, .7, .95], alpha: .55 }, candle: { col: [.92, .88, .76] }, bone: { col: [.86, .82, .72] },
    face_fm: { tex: 'face_fm' }, face_nr: { tex: 'face_nr', em: [.08, .14, .3] }, face_os: { tex: 'face_os', em: [.06, .1, .1] }, face_mamoru: { tex: 'face_mamoru' }, face_mochi: { tex: 'face_mochi' },
    coat_mamoru: { tex: 'coat_mamoru' }, coat_mochi: { tex: 'coat_mochi' }, kimono_fm: { tex: 'kimono_fm' }, kimono_nr: { tex: 'kimono_nr' }, kimono_os: { tex: 'kimono_os' },
    skin_w: { col: [.95, .92, .9] }, skin_blue: { col: [.72, .82, .93] }, hair_black: { col: [.06, .06, .07], spec: [.3, .3, .35], power: 30 }, hair_blue: { col: [.06, .12, .3], spec: [.3, .4, .6], power: 30 },
    obi_red: { col: [.62, .07, .1] }, obi_silver: { col: [.78, .82, .88], spec: [.6, .6, .7], power: 40 }, obi_black: { col: [.06, .07, .08] }, horn: { col: [.88, .9, .95] }, ear_os: { col: [.1, .14, .18] },
    flower_pink: { col: [.95, .55, .66] }, flower_teal: { col: [.3, .75, .7], em: [.05, .2, .18] }, flower_orange: { col: [.95, .5, .12] }, ear_pink: { col: [.95, .62, .7] },
    cat_black: { col: [.07, .065, .07] }, cat_white: { col: [.95, .93, .9] }, collar_red: { col: [.7, .08, .1] }, gem_green: { col: [.2, .9, .4], em: [.1, .6, .25] },
    orb: { col: [.6, .85, 1], em: [.45, .75, 1] }, glow_blue: { glow: [.35, .6, 1] },
    palm_leaf: { tex: 'palm_leaf' }, banana_leaf: { tex: 'banana_leaf' }, palm_bark: { tex: 'palm_bark' }, coconut: { col: [.36, .24, .12] }, banana: { col: [.95, .8, .22] }, banana_stem: { col: [.36, .5, .18] }, flower_purple: { col: [.45, .12, .3] },
    plank_teal: { tex: 'plank_teal' }, plank_yellow: { tex: 'plank_yellow' }, plank_red: { tex: 'plank_red' }, tin_roof: { tex: 'tin_roof' }, banana_big: { tex: 'banana_big' }, brick: { tex: 'brick' },
    bottles: { tex: 'bottles', em: [.25, .17, .08] }, sign_fishbook: { tex: 'sign_fishbook' }, sign_chzdice: { tex: 'sign_chzdice' }, awning: { col: [.95, .82, .36] }, curtain_red: { col: [.55, .08, .1] },
    felt_green: { col: [.12, .45, .3] }, felt_blue: { col: [.14, .3, .6] }, felt_red: { col: [.6, .12, .12] }, darts: { col: [.12, .1, .08] }, fish: { col: [.66, .72, .78], spec: [.8, .8, .8], power: 60 },
    net: { col: [.62, .56, .42] }, lily: { col: [.26, .55, .2] }, smoke: { col: [.7, .7, .7], em: [.25, .25, .25], alpha: .32 },
    bottle_green: { col: [.15, .45, .2], spec: [.8, .8, .8], power: 80 }, bottle_brown: { col: [.42, .22, .08], spec: [.8, .8, .8], power: 80 }, bottle_clear: { col: [.75, .85, .82], spec: [.9, .9, .9], power: 90 },
    sack: { col: [.7, .62, .46] }, leaf: { col: [.26, .42, .14] }, leaves: { tex: 'leaves' },
    ape_overall: { col: [.42, .25, .12] }, ape_denim: { col: [.18, .27, .42] }, ape_khaki: { col: [.46, .38, .25] }, ape_bandana: { tex: 'ape_bandana' }, band_rb: { tex: 'band_rb' },
    cap_blue: { col: [.1, .33, .78] }, cap_logo: { tex: 'cap_logo' }, hat_white: { col: [.9, .89, .86] }, patch_apechain: { tex: 'patch_apechain' },
    glass_dark: { col: [.03, .035, .04], spec: [.9, .9, .9], power: 90 }, peng_blue: { col: [.42, .6, .9] }, peng_white: { col: [.95, .95, .95] }, peng_beak: { col: [.95, .6, .12] },
    ...Object.fromEntries(Object.entries(APE_LOOK).flatMap(([id, o]) => [['fur_' + id, { tex: 'fur', tint: hex3(o.fur, 1 / .85) }], ['skin_' + id, { col: hex3(o.skin) }], ['face_' + id, { tex: 'face_' + id }], ['muzzle_' + id, { tex: 'muzzle_' + id }], ['torso_' + id, { tex: 'torso_' + id }]])),
    deco: { tex: 'plaster', tint: [1.04, .98, .88] }, deco_trim: { col: [.86, .82, .72] }, navy: { col: [.07, .11, .25], spec: [.2, .2, .3], power: 30 },
    emblem_saints: { tex: 'emblem_saints' }, mural_angel: { tex: 'mural_angel' }, mural_wings: { tex: 'mural_wings' }, sign_saints_book: { tex: 'sign_saints_book', em: [.12, .1, .06] }, sign_saints_game: { tex: 'sign_saints_game', em: [.12, .1, .06] },
    court_tex: { tex: 'court_tex' }, door_glass: { tex: 'door_glass', em: [.55, .45, .3] }, garage_int: { tex: 'garage_int', em: [.28, .28, .28] }, arcade_int: { tex: 'arcade_int', em: [.7, .6, .8] }, rollup: { tex: 'rollup' },
    facade_apt: { tex: 'facade_apt' }, facade_stucco: { tex: 'facade_stucco' }, facade_brick: { tex: 'facade_brick' }, facade_office: { tex: 'facade_office' }, facade_glass: { tex: 'facade_glass', spec: [.6, .6, .7], power: 60 }, facade_shop: { tex: 'facade_shop' }, parking: { tex: 'parking' },
    sl_brick: { tex: 'brick' }, stucco: { tex: 'plaster', tint: [1.02, .9, .74] }, concrete: { col: [.6, .58, .55] }, concrete_dark: { col: [.36, .37, .39] }, dark_panel: { col: [.14, .14, .16] }, roof_flat: { col: [.42, .41, .4] },
    win_dark: { col: [.06, .08, .12], spec: [.8, .8, .85], power: 64 }, win_lit: { col: [.9, .76, .48], em: [.5, .38, .18] },
    tire: { col: [.04, .04, .045] }, chrome: { col: [.78, .78, .8], spec: [1, 1, 1], power: 90 }, glass_car: { col: [.07, .1, .14], spec: [.9, .9, .9], power: 80 }, tail: { col: [.7, .05, .05], em: [.35, .02, .02] }, headlamp: { col: [.95, .92, .8], em: [.4, .38, .3] },
    paint_blue: { col: [.06, .17, .5], spec: [.9, .9, .95], power: 70 }, paint_gold: { col: [.66, .5, .18], spec: [.9, .85, .6], power: 70 }, paint_red: { col: [.5, .05, .06], spec: [.9, .9, .9], power: 70 },
    paint_black: { col: [.035, .035, .04], spec: [.9, .9, .9], power: 70 }, paint_white: { col: [.82, .82, .8], spec: [.9, .9, .9], power: 70 }, paint_purple: { col: [.3, .1, .4], spec: [.9, .9, .9], power: 70 },
    metal: { col: [.52, .53, .55], spec: [.5, .5, .5], power: 30 }, canopy: { col: [.92, .91, .87] }, orange: { col: [.95, .5, .1] }, lime: { col: [.42, .68, .2] }, red_fruit: { col: [.72, .1, .08] },
    blue_lift: { col: [.14, .28, .68] }, hoop_orange: { col: [.9, .35, .08] }, backboard: { col: [.93, .93, .92] }, sign_letter: { col: [.94, .94, .92] }, awning_red: { col: [.62, .12, .1] }, awning_green: { col: [.14, .4, .26] },
    spirit: { col: [.35, .62, 1], em: [.3, .62, 1] }, glow_spirit: { glow: [.3, .58, 1] }, // Yamabushi spirit lanterns: icy blue flame
    ...Object.fromEntries(Object.keys(FACTION_BANNERS).filter(id => id !== 'samurai' && id !== 'wokou').map(id => ['banner_' + id, { tex: 'banner_' + id, faction: id }])),
    lacquer_red: { col: [.42, .045, .035], spec: [.55, .45, .42], power: 64 }, lacquer_black: { col: [.03, .025, .022], spec: [.5, .5, .5], power: 64 },
    drum_skin: { col: [.86, .79, .62] }, persimmon: { col: [.74, .34, .12] }, kabuki_green: { col: [.1, .3, .17] },
    mirror_black: { col: [.025, .025, .03], spec: [.85, .85, 1], power: 140 }, moonbar: { col: [.55, .65, .92], em: [.42, .52, .86] }, cloth_black: { col: [.035, .035, .045] },
    shoji_red: { tex: 'shoji', tint: [1, .32, .28], em: [.32, .04, .03] }, mist_low: { col: [.78, .84, .92], alpha: .16 },
    emblem_ronin_red: { img: 'assets/brand/factions/ronin.png', tint: [.85, .08, .08], em: [.42, .02, .02] },
    ...Object.fromEntries(['samurai', 'ronin', 'shogun', 'bushi', 'buke', 'ashigaru', 'kenshi', 'yamabushi', 'sohei', 'wokou', 'warrior'].map(f => ['mark_' + f, { img: 'assets/brand/factions/' + f + '.png', tint: [.95, .74, .36], em: [.3, .2, .06] }])),
    forestview: { tex: 'forestview', self: true }, skyhole: { tex: 'skyhole', self: true }, firefly: { col: [.75, 1, .35], em: [.7, 1, .3] }, amber: { col: [.95, .6, .2], em: [.85, .45, .1] }, andon: { col: [.98, .86, .62], em: [.78, .58, .3] }, doorview: { tex: 'doorview', self: true },
    scroll_sam: { tex: 'scroll_sam' }, scroll_sam2: { tex: 'scroll_sam2' }, lacing: { col: [.78, .64, .3] },
    neon_cyan: { col: [.1, .9, 1], em: [.12, .9, 1] }, neon_pink: { col: [1, .2, .72], em: [1, .16, .66] }, neon_purple: { col: [.6, .3, 1], em: [.55, .25, 1] }, neon_gold: { col: [1, .8, .3], em: [1, .72, .26] },
    arcade_wall: { tex: 'plaster', tint: [.32, .29, .47] }, arcade_floor: { tex: 'darkwood', tint: [1.05, .98, 1.2] }, glass: { col: [.6, .8, 1], spec: [.9, .9, 1], power: 80, alpha: .22 },
    lantern_violet: { col: [.55, .2, .9], em: [.5, .16, .9] }, lantern_cyan: { col: [.15, .75, .9], em: [.1, .7, .9] },
    emblem_rebel: { img: 'assets/brand/icon-512.png', self: true }, books_dim: { tex: 'books' }, runner: { tex: 'runner' }, map_table: { tex: 'war_map' },
    sign_prizes: { tex: 'sign_prizes', self: true, alphaTex: true }, sign_claw: { tex: 'sign_claw', self: true },
    ...Object.fromEntries(['fw', 'raid', 'tunnel', 'shuffle'].flatMap(g => [['scr_' + g, { tex: 'scr_' + g, self: true }], ['mq_' + g, { tex: 'mq_' + g, self: true }], ['sign_' + g, { tex: 'sign_' + g, self: true, alphaTex: true }]])),
    wisteria: { col: [.6, .42, .86], em: [.1, .05, .16] }, wisteria_pale: { col: [.82, .72, .96], em: [.12, .1, .16] }, brass: { col: [.72, .55, .24], spec: [.8, .7, .4], power: 50 }, paper: { col: [.94, .91, .84] },
    fusuma_cranes: { tex: 'fusuma_cranes' }, byobu_pine: { tex: 'byobu_pine' }, pebbles_white: { tex: 'pebbles_white' }, drawers: { tex: 'drawers' }, valley_view: { tex: 'valley_view', self: true },
    dome_stars: { tex: 'dome_stars', em: [.16, .1, .2] }, council_map: { tex: 'council_map', em: [.2, .16, .08] },
    shaft_moon: { shaft: [.5, .62, 1], alpha: .12 }, moonfloor: { col: [.3, .36, .55], em: [.2, .25, .45] },
    stone_blue: { tex: 'stone', tint: [.66, .74, .9] }, sand_table: { tex: 'relief_sand' }, goban: { tex: 'goban' }, shogiban: { tex: 'shogiban' }, mural_bushi: { tex: 'mural_bushi', em: [.12, .12, .14] }, sunrise: { tex: 'sunrise', self: true },
    go_black: { col: [.04, .04, .05], spec: [.6, .6, .6], power: 60 }, go_white: { col: [.93, .92, .88], spec: [.5, .5, .5], power: 50 }, chalk: { col: [.9, .9, .86], em: [.1, .1, .1] },
    canyon_view: { tex: 'canyon_view', self: true }, blueprint: { tex: 'blueprint', em: [.08, .12, .2] }, drawers_iron: { tex: 'drawers', tint: [.5, .56, .58] }, rock_tan: { tex: 'granite', tint: [1.12, .94, .74] },
    rice_wheel: { tex: 'calendar_wheel' }, raked_sand: { tex: 'raked_rings' }, rake_lines: { tex: 'rake_lines' }, kata_scroll: { tex: 'kata_scroll' }, drawers_seed: { tex: 'drawers', tint: [1.12, 1.05, .82] },
    glass_teal: { col: [.3, .72, .7], spec: [.9, .9, .9], power: 80, alpha: .28 }, koi_orange: { col: [.95, .45, .1], em: [.12, .05, 0] }, koi_white: { col: [.96, .95, .92] }, mud: { col: [.22, .15, .09], spec: [.5, .45, .4], power: 50 },
    sawdust: { col: [.86, .74, .5] }, clay: { col: [.62, .3, .16] }, sprout: { col: [.36, .62, .2], em: [.03, .08, .02] }, maple_red: { col: [.74, .12, .07], em: [.08, 0, 0] }, plaster_teal: { tex: 'plaster', tint: [.7, .86, .84] },
    steel: { col: [.62, .66, .68], spec: [.9, .9, .95], power: 90 }, shaft_white: { shaft: [.86, .94, 1], alpha: .11 }, shoji_lit: { tex: 'shoji', em: [.62, .56, .42] },
    falls_curtain: { tex: 'falls_streaks', alphaTex: true, em: [.42, .5, .58] }, mist_view: { tex: 'mist_view', self: true }, moss_glow: { col: [.16, .5, .44], em: [.05, .3, .26] }, star_chart: { tex: 'star_chart', em: [.08, .1, .18] },
    night_sky: { tex: 'night_sky', self: true }, charm: { tex: 'charm' }, silk: { tex: 'silk', em: [.25, .2, .1] }, bell_bronze: { col: [.42, .3, .16], spec: [.7, .6, .4], power: 50 }, drawers_red: { tex: 'drawers', tint: [1.05, .72, .56] },
    olive: { col: [.34, .36, .2] }, shaft_sun: { shaft: [1, .82, .55], alpha: .1 }, water_flow: { tex: 'water_ripple', spec: [.7, .7, .7], power: 80, em: [.04, .08, .1] },
    sea_view: { tex: 'sea_view', self: true }, trade_map: { tex: 'trade_map', em: [.14, .12, .08] }, porcelain: { tex: 'porcelain', spec: [.8, .8, .8], power: 80 }, seigaiha: { tex: 'seigaiha' },
    maroon: { col: [.34, .09, .09] }, leather: { col: [.4, .24, .13] }, silk_red: { tex: 'silk', tint: [1, .42, .36] }, silk_teal: { tex: 'silk', tint: [.42, .8, .78] }, silk_purple: { tex: 'silk', tint: [.66, .46, .9] },
    spice_orange: { col: [.86, .48, .1] }, spice_red: { col: [.62, .1, .06] }, spice_yellow: { col: [.92, .74, .16] }, spice_brown: { col: [.46, .26, .12] }, tea_green: { col: [.36, .48, .2] },
    coin: { col: [.95, .74, .26], spec: [1, .9, .5], power: 60, em: [.14, .09, .02] }, rust: { col: [.42, .18, .09], spec: [.3, .2, .15], power: 20 }, mural_battle: { tex: 'mural_battle', em: [.12, .08, .06] },
    banner_torn: { tex: 'banner_torn', alphaTex: true }, banner_torn_rust: { tex: 'banner_torn_rust', alphaTex: true }, sand_ring: { tex: 'sand_ring' },
    mark_warrior_chalk: { img: 'assets/brand/factions/warrior.png', tint: [.95, .93, .88], em: [.22, .22, .2] },
    checker_cc: { tex: 'checker_cc', spec: [.4, .4, .45], power: 60 }, cc_portraits: { tex: 'cc_portraits', em: [.14, .1, .16] }, stained_purple: { tex: 'stained_purple', self: true }, stained_green: { tex: 'stained_green', self: true },
    spellbook: { tex: 'spellbook', em: [.3, .28, .22] }, potion_pink: { col: [1, .3, .7], em: [.7, .14, .45], alpha: .85 }, potion_cyan: { col: [.2, .9, 1], em: [.1, .6, .7], alpha: .85 }, potion_lime: { col: [.6, 1, .2], em: [.36, .7, .1], alpha: .85 }, potion_violet: { col: [.6, .3, 1], em: [.4, .16, .8], alpha: .85 },
    tent_stripe: { col: [.42, .16, .52] }, crystal: { col: [.7, .85, 1], em: [.35, .5, .8], spec: [1, 1, 1], power: 90, alpha: .6 },
    bamboo_wall: { tex: 'bamboo_wall' }, tiki_mask: { tex: 'tiki_mask' }, sea_turq: { tex: 'sea_turq', self: true }, treasure_map: { tex: 'treasure_map', em: [.16, .14, .1] },
    glass_frost: { col: [.82, .9, .95], em: [.22, .28, .32], alpha: .7 }, lure_glow: { col: [.5, 1, .4], em: [.5, 1, .3] }, lure_orange: { col: [1, .6, .2], em: [1, .5, .1] }, aqua: { col: [.2, .7, .8], em: [.05, .22, .26], alpha: .35 },
    la_skyline: { tex: 'la_skyline', self: true }, deco_dome: { tex: 'deco_dome', em: [.2, .18, .14] }, mural_la: { tex: 'mural_la', em: [.14, .1, .08] },
    neon_open: { tex: 'neon_open', self: true, alphaTex: true }, neon_block: { tex: 'neon_block', self: true, alphaTex: true }, scoreboard: { tex: 'scoreboard', self: true }, court_maple: { tex: 'court_maple', spec: [.4, .35, .3], power: 40 },
    glass_green: { col: [.2, .7, .3], em: [.3, .8, .35] }, slot_reels: { tex: 'slot_reels', self: true }, jungle_wall: { tex: 'plaster', tint: [.34, .52, .34] }, velvet: { col: [.3, .08, .26] }, records: { col: [.03, .03, .04], spec: [.7, .7, .7], power: 80 }, white: { col: [.94, .94, .92] },
    glow: { glow: [.95, .5, .16] } // soft pool of lantern light on the ground (night only)
  };
  let TEX = null; const MATS = {};
  function glowTex(scene) {
    const S = 128, t = new BABYLON.DynamicTexture('samKit_glowTex', { width: S, height: S }, scene, true), c = t.getContext();
    const g = c.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.35, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, S, S); t.hasAlpha = true; t.update(); return t;
  }
  let SHAFT = null;
  function shaftTex(scene) { // u across the sheet (soft ends, faint streaks), v down it (top = v 1)
    if (SHAFT && !SHAFT.isDisposed?.()) return SHAFT;
    const W = 128, H = 128, t = new BABYLON.DynamicTexture('samKit_shaftTex', { width: W, height: H }, scene, true), c = t.getContext(), r = rng(71);
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.55, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = 'destination-out'; for (let k = 0; k < 18; k++) { c.fillStyle = `rgba(0,0,0,${.15 + .35 * r()})`; c.fillRect(r() * W, 0, 2 + r() * 6, H); }
    const e = c.createLinearGradient(0, 0, W, 0); e.addColorStop(0, 'rgba(0,0,0,1)'); e.addColorStop(.12, 'rgba(0,0,0,0)'); e.addColorStop(.88, 'rgba(0,0,0,0)'); e.addColorStop(1, 'rgba(0,0,0,1)'); c.fillStyle = e; c.fillRect(0, 0, W, H);
    t.hasAlpha = true; t.update(); return SHAFT = t;
  }
  function material(scene, name) {
    if (MATS[name] && !MATS[name].isDisposed?.()) return MATS[name];
    TEX = TEX || makeTextures(scene);
    const room = name.startsWith('rm_'), d = MAT[room ? name.slice(3) : name]; // rm_<name>: a room's copy (see ROOMS)
    if (d.faction && !TEX[d.tex]) TEX[d.tex] = bannerTex(scene, d.faction, ...FACTION_BANNERS[d.faction], 'logo:' + d.faction); // made on first use
    if (d.tex && !TEX[d.tex] && ROOM_TEX[d.tex]) TEX[d.tex] = ROOM_TEX[d.tex](TEX._cv); // room textures too
    if (d.shaft) { // a sheet of light falling from a window or a slit: additive, bright at the top, gone at the floor (rooms)
      const m = new BABYLON.StandardMaterial('samKit_' + name, scene), tx = shaftTex(scene);
      m.diffuseColor = BABYLON.Color3.Black(); m.specularColor = BABYLON.Color3.Black(); m.disableLighting = true;
      m.emissiveColor = new BABYLON.Color3(...d.shaft); m.emissiveTexture = tx; m.opacityTexture = tx;
      m.alphaMode = BABYLON.Engine.ALPHA_ADD; m.alpha = d.alpha ?? .14; m.backFaceCulling = false; m.disableDepthWrite = true;
      MATS[name] = m; return m;
    }
    if (d.glow) {
      const m = new BABYLON.StandardMaterial('samKit_' + name, scene), tx = glowTex(scene);
      m.diffuseColor = BABYLON.Color3.Black(); m.specularColor = BABYLON.Color3.Black(); m.disableLighting = true;
      m.emissiveColor = new BABYLON.Color3(...d.glow); m.emissiveTexture = tx; m.opacityTexture = tx;
      m.alphaMode = BABYLON.Engine.ALPHA_ADD; m.alpha = 0; m.backFaceCulling = false; m.zOffset = -2; m.disableDepthWrite = true;
      if (room) { m.alpha = .5; MATS[name] = m; return m; }
      m.metadata = { kitGlow: true };
      MATS[name] = m; setLightFactor(); return m;
    }
    const m = new BABYLON.StandardMaterial('samKit_' + name, scene);
    if (d.img) { const t = new BABYLON.Texture(d.img, scene, false, true); t.hasAlpha = true; m.diffuseTexture = t; m.useAlphaFromDiffuseTexture = true; m.transparencyMode = 1; if (d.tint) m.diffuseColor = new BABYLON.Color3(...d.tint); } // alpha test
    else if (d.tex) { m.diffuseTexture = TEX[d.tex]; if (d.tint) m.diffuseColor = new BABYLON.Color3(...d.tint); if (d.alphaTex) { TEX[d.tex].hasAlpha = true; m.useAlphaFromDiffuseTexture = true; m.transparencyMode = 2; m.disableDepthWrite = true; } } else m.diffuseColor = new BABYLON.Color3(...d.col);
    if (d.alpha) { m.alpha = d.alpha; m.disableDepthWrite = true; } // ghosts
    m.specularColor = new BABYLON.Color3(...(d.spec || [.04, .04, .04])); m.specularPower = d.power || 16;
    if (d.em) m.emissiveColor = new BABYLON.Color3(...d.em);
    if (d.self) { m.emissiveTexture = m.diffuseTexture; m.disableLighting = true; }
    m.backFaceCulling = false; m.twoSidedLighting = true; m.maxSimultaneousLights = room ? 6 : 4;
    if (room) { MATS[name] = m; return m; } // lit by the room's own lights (added after the village froze its materials)
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
    part(m) { m = (this.remap && this.remap[m]) || m; m = (this.remap2 && this.remap2[m]) || m; if (this.room) m = 'rm_' + m; return this.parts[m] || (this.parts[m] = { p: [], n: [], uv: [], i: [] }); }
    poly(m, pts, uvs, nrm) {
      const P = this.part(m), base = P.p.length / 3;
      let nn = nrm;
      if (!nrm) { // Newell normal (robust for any planar polygon)
        let a = [0, 0, 0]; for (let k = 0; k < pts.length; k++) { const c = pts[k], d = pts[(k + 1) % pts.length]; a[0] += (c[1] - d[1]) * (c[2] + d[2]); a[1] += (c[2] - d[2]) * (c[0] + d[0]); a[2] += (c[0] - d[0]) * (c[1] + d[1]); }
        nn = norm(a);
      }
      const [tu, tv] = tileOf(m), ax = Math.abs(nn[0]) > Math.abs(nn[1]) ? (Math.abs(nn[0]) > Math.abs(nn[2]) ? 0 : 2) : (Math.abs(nn[1]) > Math.abs(nn[2]) ? 1 : 2);
      const o = this.o;
      pts.forEach((q, k) => {
        if (o) P.p.push(q[0] - o[0], q[2] - o[2], q[1] - o[1]); else P.p.push(q[0], q[2], q[1]); P.n.push(nn[0], nn[2], nn[1]);
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
        if (ax === 'x') { if (!o.open) recess(M, cx, c, z0, dw, dh, 1.6, fx); for (const s of [-1, 1]) M.block('darkwood', cx + s * (dw / 2 + .12), c + fx * .2, z0, .24, .2, dh + .2); M.block('darkwood', cx, c + fx * .2, z0 + dh, dw + .5, .2, .25); }
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
  // ── organic shapes (smooth shaded): value noise, a grid of shared vertices, curved tubes and lumpy blobs ──
  function hash3(x, y, z) { let h = (x * 374761393 + y * 668265263 + z * 1274126177) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
  function vnoise(x, y, z) {
    const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z), u = x - X, v = y - Y, w = z - Z, f = t => t * t * (3 - 2 * t), a = f(u), b = f(v), c = f(w);
    const L = (i, j, k) => hash3(X + i, Y + j, Z + k), mix = (p, q, t) => p + (q - p) * t;
    return mix(mix(mix(L(0, 0, 0), L(1, 0, 0), a), mix(L(0, 1, 0), L(1, 1, 0), a), b), mix(mix(L(0, 0, 1), L(1, 0, 1), a), mix(L(0, 1, 1), L(1, 1, 1), a), b), c) * 2 - 1;
  }
  // G[i][j] points (Blender coords), U[i][j] uvs; normals averaged over the grid (wrapJ: the last column repeats the first)
  function smoothGrid(M, m, G, U, wrapJ, NG) {
    const P = M.part(m), base = P.p.length / 3, R = G.length, C = G[0].length;
    for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) {
      const jm = wrapJ ? (j === 0 ? C - 2 : j - 1) : Math.max(0, j - 1), jp = wrapJ ? (j === C - 1 ? 1 : j + 1) : Math.min(C - 1, j + 1);
      const im = Math.max(0, i - 1), ip = Math.min(R - 1, i + 1);
      let n = cross(sub(G[i][jp], G[i][jm]), sub(G[ip][j], G[im][j]));
      if (Math.hypot(...n) < 1e-9) { const k = i === 0 ? 1 : R - 2; n = cross(sub(G[k][jp], G[k][jm]), sub(G[i === 0 ? k + 1 : k - 1][j], G[k][j])); if (i === 0) n = n.map(v => -v); }
      n = NG ? NG[i][j] : norm(n); const q = G[i][j], o = M.o || [0, 0, 0];
      P.p.push(q[0] - o[0], q[2] - o[2], q[1] - o[1]); P.n.push(n[0], n[2], n[1]); P.uv.push(U[i][j][0], U[i][j][1]);
    }
    for (let i = 0; i < R - 1; i++) for (let j = 0; j < C - 1; j++) { const a = base + i * C + j, b = a + 1, c = a + C, d = c + 1; P.i.push(a, b, d, a, d, c); }
  }
  // Catmull-Rom through pts, n samples per span
  function spline(pts, n) {
    const out = [];
    for (let k = 0; k < pts.length - 1; k++) {
      const p0 = pts[Math.max(0, k - 1)], p1 = pts[k], p2 = pts[k + 1], p3 = pts[Math.min(pts.length - 1, k + 2)];
      for (let s = 0; s < n; s++) { const t = s / n, t2 = t * t, t3 = t2 * t; out.push([0, 1, 2].map(a => .5 * (2 * p1[a] + (-p0[a] + p2[a]) * t + (2 * p0[a] - 5 * p1[a] + 4 * p2[a] - p3[a]) * t2 + (-p0[a] + 3 * p1[a] - 3 * p2[a] + p3[a]) * t3))); }
    }
    out.push(pts[pts.length - 1].slice()); return out;
  }
  const lerpArr = (A, t) => { const f = t * (A.length - 1), i = Math.min(A.length - 2, Math.floor(f)), u = f - i; return A[i] + (A[i + 1] - A[i]) * u; };
  // a gnarled tube along a curve: radius profile R (sampled along), twisting ridges, noise; o.seed, o.ridge, o.k, o.twist
  function curveTube(M, m, pts, R, o = {}) {
    const C = o.segs || 16, path = spline(pts, o.n || 5), Np = path.length, G = [], U = [];
    let N = null, len = 0;
    for (let i = 0; i < Np; i++) {
      const T = norm(sub(path[Math.min(Np - 1, i + 1)], path[Math.max(0, i - 1)]));
      if (!N) { const a = Math.abs(T[2]) < .9 ? [0, 0, 1] : [1, 0, 0]; N = norm(cross(cross(T, a), T)); }
      else { const d = N[0] * T[0] + N[1] * T[1] + N[2] * T[2]; N = norm([N[0] - T[0] * d, N[1] - T[1] * d, N[2] - T[2] * d]); }
      const Bv = cross(T, N), t = i / (Np - 1), r = lerpArr(R, t);
      if (i) len += Math.hypot(...sub(path[i], path[i - 1]));
      const row = [], urow = [];
      for (let j = 0; j <= C; j++) {
        const th = (j % C) / C * Math.PI * 2, rid = (o.ridge ?? .12) * Math.sin((o.k ?? 6) * th + (o.twist ?? .3) * len) + (o.bump ?? .1) * vnoise(Math.cos(th) * 1.3 + (o.seed || 0), Math.sin(th) * 1.3, len * .6);
        const rr = r * (1 + rid), c = path[i];
        row.push([c[0] + rr * (Math.cos(th) * N[0] + Math.sin(th) * Bv[0]), c[1] + rr * (Math.cos(th) * N[1] + Math.sin(th) * Bv[1]), c[2] + rr * (Math.cos(th) * N[2] + Math.sin(th) * Bv[2])]);
        urow.push([j / C * Math.max(1, Math.round(r * 3)), len / 1.6]);
      }
      G.push(row); U.push(urow);
    }
    smoothGrid(M, m, G, U, true);
    if (o.cap !== false) { const c = path[Np - 1]; M.poly(m, G[Np - 1].slice(0, C).map(q => q).reverse().map(q => [q[0] * .3 + c[0] * .7, q[1] * .3 + c[1] * .7, q[2] * .3 + c[2] * .7])); }
    return path;
  }
  // lumpy ellipsoid (rocks, foliage clumps, moss): radii rx, ry, rz; amp/freq of the lumps; flat: squash the underside
  function blob(M, m, c, rx, ry, rz, o = {}) {
    const S = o.segs || 14, Rn = o.rings || 8, G = [], U = [], NG = [], amp = o.amp ?? .18, fq = o.freq ?? 1.6, sd = o.seed || 0;
    for (let i = 0; i <= Rn; i++) {
      const th = Math.PI * i / Rn, row = [], urow = [], nrow = [];
      for (let j = 0; j <= S; j++) {
        const ph = 2 * Math.PI * (j % S) / S, d = [Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph), Math.cos(th)];
        // lumps ease toward the pole's own value near the poles (else the first ring folds over the pole or rings it
        // with a crater: dark spots on top)
        const lump = q => 1 + amp * vnoise(q[0] * fq + sd, q[1] * fq + sd * .7, q[2] * fq - sd * 1.3) + amp * .5 * vnoise(q[0] * fq * 2.7 + sd, q[1] * fq * 2.7, q[2] * fq * 2.7 + 5);
        const kp = lump([0, 0, d[2] >= 0 ? 1 : -1]), ea = Math.sin(th) ** 1.5;
        let k = kp + (lump(d) - kp) * ea;
        let z = d[2] * rz * k; if (o.flat && z < 0) z *= o.flat;
        row.push([c[0] + d[0] * rx * k, c[1] + d[1] * ry * k, c[2] + z]); urow.push([j / S * (o.uvs || 3), i / Rn * (o.uvs || 3) * .6]);
        nrow.push(norm([-d[0] / rx, -d[1] / ry, -d[2] / rz])); // the ellipsoid's own normal (also at the poles), in smoothGrid's sense
      }
      G.push(row); U.push(urow); NG.push(nrow);
    }
    // lumps tilt the normals: blend the grid normals in, except at the poles
    const P0 = M.part(m).p.length; smoothGrid(M, m, G, U, true);
    const Pn = M.part(m).n;
    for (let i = 0, v = P0; i <= Rn; i++) for (let j = 0; j <= S; j++, v += 3) {
      const g = [Pn[v], Pn[v + 2], Pn[v + 1]], e = NG[i][j], w = (i === 0 || i === Rn || !Number.isFinite(g[0]) || Math.hypot(...g) < .5) ? 0 : .6;
      const nb = norm([e[0] * (1 - w) + g[0] * w, e[1] * (1 - w) + g[1] * w, e[2] * (1 - w) + g[2] * w]); Pn[v] = nb[0]; Pn[v + 1] = nb[2]; Pn[v + 2] = nb[1];
    }
  }
  // drop the triangles of part m from index i0 to i1 whose centre (kit coordinates) passes test: a tunnel mouth in a cave wall
  function cutTris(M, m, i0, i1, test) {
    const P = M.part(m), p = P.p, I = P.i, keep = [];
    for (let t = i0; t < i1; t += 3) { const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3; if (!test([(p[a] + p[b] + p[c]) / 3, (p[a + 2] + p[b + 2] + p[c + 2]) / 3, (p[a + 1] + p[b + 1] + p[c + 1]) / 3])) keep.push(I[t], I[t + 1], I[t + 2]); }
    P.i = [...I.slice(0, i0), ...keep, ...I.slice(i1)];
  }
  const segDist = (q, a, b) => { const d = sub(b, a), L = d[0] * d[0] + d[1] * d[1] + d[2] * d[2], t = L ? Math.max(0, Math.min(1, ((q[0] - a[0]) * d[0] + (q[1] - a[1]) * d[1] + (q[2] - a[2]) * d[2]) / L)) : 0; return Math.hypot(q[0] - a[0] - t * d[0], q[1] - a[1] - t * d[1], q[2] - a[2] - t * d[2]); };
  const nearPath = (pts, r) => q => { for (let i = 0; i + 1 < pts.length; i++) if (segDist(q, pts[i], pts[i + 1]) < r) return true; return false; };
  // Ashigaru long hall: banner on the front wall to one side of the door (side -1 left, 1 right)
  function ashiHall(M, mat, side) {
    const W = 15, D = 9, Z = .8;
    M.block('stone', 0, 0, 0, W + 1.2, D + 1.2, Z); steps(M, 0, -(D + 1.2) / 2, Z, 4, 2);
    walls(M, 0, 0, Z, W, D, 4.2, { door: [3.2, 3.1], windows: [['front', -side * 4.8, Z + 1.3, 2.4, 1.5], ['left', -1.5, Z + 1.3, 2.6, 1.5], ['right', 1.5, Z + 1.3, 2.6, 1.5], ['back', 0, Z + 1.3, 3, 1.5]] });
    banner(M, side * 4.6, -D / 2 - .18, Z + 4, 3.2, 3.6, mat);
    noren(M, 0, -D / 2 - .2, Z + 3.05, 3.4, .9, 'noren_ashigaru');
    M.roof(0, 0, Z + 4.6, W + 3, D + 3, 3.2, { lift: .7 });
    for (const sd of [-1, 1]) lantern(M, sd * 2.2, -D / 2 - .6, Z + 3.3, .22);
    for (const [x, y] of [[-side * 6.6, -D / 2 - 1.3], [-side * 5.6, -D / 2 - 1.4]]) M.block('wood', x, y, 0, .9, .8, .8);
    M.cyl('wood', [-side * 7.4, -D / 2 - .9, 0], .35, .85, 10);
  }
  function ashiPalisade(M, withBanner) {
    const L = 8, n = 15;
    for (let i = 0; i < n; i++) { const x = -L / 2 + .27 + i * (L - .54) / (n - 1), h = 4.3 + .4 * Math.sin(i * 2.7) + .2 * Math.cos(i * 1.3); M.cyl('bark', [x, 0, -.4], .27, h + .4, 7); M.cyl('bark', [x, 0, h], .27, .8, 7, .02); }
    for (const z of [1.4, 3.3]) M.box('darkwood', [0, .32, z], [L, .14, .24]);
    for (const x of [-2.6, 2.6]) M.rod('wood', [x, .35, 3.1], [x, 2.6, -.2], .12, 6);
    if (withBanner) banner(M, 0, -.3, 4, 1.6, 2.8, 'banner_ashigaru');
  }
  // a pile of logs along x (length L, n layers)
  function ashiLogs(M, cx, cy, z0, L, n) {
    for (let k = 0; k < n; k++) { const m = n - k + 1; for (let i = 0; i < m; i++) { const y = cy + (i - (m - 1) / 2) * .5; M.rod('bark', [cx - L / 2, y, z0 + .25 + k * .43], [cx + L / 2, y, z0 + .25 + k * .43], .24, 8); } }
    for (const sd of [-1, 1]) for (const sy of [-1, 1]) M.block('darkwood', cx + sd * (L / 2 - .4), cy + sy * ((n + 1) * .25 + .1), z0, .14, .14, n * .45 + .2);
  }
  function warHouseExtras(M, tile) {
    noren(M, 0, -3.25 - .2, 3.05, 2.4, .9, 'noren_warrior'); if (tile) banner(M, -3.05, -3.25 - .18, 3.4, 1.1, 2.2, 'banner_warrior');
    for (const y of [-2.4, 2.4]) M.block('wood', 6.9, y, 0, .2, .2, 2.1);
    M.quad('thatch', [[5.2, -3.1, 2.9], [5.2, 3.1, 2.9], [7.4, 3.1, 2.1], [7.4, -3.1, 2.1]]); M.quad('thatch', [[7.4, -3.1, 2.1], [7.4, 3.1, 2.1], [5.2, 3.1, 2.9], [5.2, -3.1, 2.9]]);
    ashiLogs(M, 5.9, -.2, 0, 1.4, 3); M.block('wood', 5.8, 1.9, 0, .8, .8, .8);
  }
  // battered stone (castle bases): a w0 x d0 footprint narrowing to w1 x d1 at height h
  function batter(M, m, cx, cy, z0, w0, d0, w1, d1, h) {
    const b = (sx, sy) => [cx + sx * w0 / 2, cy + sy * d0 / 2, z0], t = (sx, sy) => [cx + sx * w1 / 2, cy + sy * d1 / 2, z0 + h];
    M.poly(m, [b(-1, -1), b(1, -1), t(1, -1), t(-1, -1)]); M.poly(m, [b(1, 1), b(-1, 1), t(-1, 1), t(1, 1)]);
    M.poly(m, [b(1, -1), b(1, 1), t(1, 1), t(1, -1)]); M.poly(m, [b(-1, 1), b(-1, -1), t(-1, -1), t(-1, 1)]);
    M.poly(m, [t(-1, -1), t(1, -1), t(1, 1), t(-1, 1)]);
  }
  // a front gable (A-frame over a roof's middle, faced in dark timber with gold edges): front at yF, eave ze, ridge zr
  function shogunGable(M, cx, yF, ze, zr, hw, yB) {
    for (const sd of [-1, 1]) M.quad('roof', [[cx + sd * hw, yF, ze], [cx, yF, zr], [cx, yB, zr], [cx + sd * hw, yB, ze]], [[0, 0], [0, 2.2], [3, 2.2], [3, 0]]);
    M.poly('darkwood', [[cx - hw + .4, yF + .25, ze + .12], [cx + hw - .4, yF + .25, ze + .12], [cx, yF + .25, zr - .25]]);
    for (const sd of [-1, 1]) M.rod('gold', [cx + sd * (hw + .15), yF - .05, ze - .08], [cx, yF - .05, zr + .08], .1, 5);
    M.box('darkwood', [cx, (yF + yB) / 2, zr + .1], [.36, yB - yF, .3]);
  }
  // ── Cute & Creepy helpers ──
  // steep gable roof, ridge along x at z + h; gables filled with wall material; front (-y) overhang o
  function steepRoof(M, m, cx, cy, z, w, d, h, o, gableMat, front) {
    const hw = w / 2 + o, hd = d / 2 + o, k = m === 'tin_roof' ? .25 : 1, sl = Math.hypot(hd, h + o * h / (d / 2)) * k, zE = z - o * h / (d / 2);
    if (front) { // ridge along y (a porch gable facing -y)
      const ww = w / 2 + o, L = d + o;
      for (const sd of [-1, 1]) M.quad(m, [[cx + sd * ww, cy - d / 2 - o, zE], [cx, cy - d / 2 - o, z + h], [cx, cy + d / 2, z + h], [cx + sd * ww, cy + d / 2, zE]], [[0, 0], [0, sl / 2], [L * k / 2, sl / 2], [L * k / 2, 0]]);
      M.poly(gableMat, [[cx - w / 2, cy - d / 2, z], [cx + w / 2, cy - d / 2, z], [cx, cy - d / 2, z + h - .1]]);
      M.box('darkwood', [cx, cy - o / 2, z + h], [.3, d + o, .3]); return;
    }
    for (const sd of [-1, 1]) M.quad(m, [[cx - hw, cy + sd * hd, zE], [cx + hw, cy + sd * hd, zE], [cx + hw, cy, z + h], [cx - hw, cy, z + h]], [[0, 0], [w * k / 2, 0], [w * k / 2, sl / 2], [0, sl / 2]]);
    for (const sd of [-1, 1]) M.poly(gableMat, [[cx + sd * w / 2, cy - d / 2, z], [cx + sd * w / 2, cy + d / 2, z], [cx + sd * w / 2, cy, z + h - .1]]);
    M.box('darkwood', [cx, cy, z + h], [w + 2 * o, .3, .3]);
  }
  function archPts(x, y, z0, w, h) { return [[x - w / 2, y, z0], [x + w / 2, y, z0], [x + w / 2, y, z0 + h * .62], [x + w * .3, y, z0 + h * .9], [x, y, z0 + h], [x - w * .3, y, z0 + h * .9], [x - w / 2, y, z0 + h * .62]]; }
  // gothic window (pointed arch, glowing) on a wall facing -y (face 1: +y), with a dark frame and mullion
  function gwin(M, x, y, z0, w, h, face = -1, mat = 'window_glow') {
    const P = archPts(x, y + face * .01, z0, w, h); M.poly(mat, face < 0 ? P : P.slice().reverse());
    for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; M.rod('darkwood', [a[0], a[1] + face * .03, a[2]], [b[0], b[1] + face * .03, b[2]], .06, 4); }
    M.rod('darkwood', [x, y + face * .03, z0], [x, y + face * .03, z0 + h], .04, 4); M.rod('darkwood', [x - w / 2, y + face * .03, z0 + h * .45], [x + w / 2, y + face * .03, z0 + h * .45], .04, 4);
  }
  function gwinSide(M, x, y, z0, w, h, sd, mat = 'window_glow') { const P = archPts(0, 0, z0, w, h).map(p => [x + sd * .01, y + p[0], p[2]]); M.poly(mat, sd > 0 ? P : P.slice().reverse()); M.rod('darkwood', [x + sd * .03, y, z0], [x + sd * .03, y, z0 + h], .05, 4); }
  function archDoor(M, x, y, z0, w, h) { M.poly('darkwood', archPts(x, y, z0, w, h)); M.poly('window_glow', archPts(x, y - .01, z0 + h * .7, w * .4, h * .22)); M.block('iron', x + w * .3, y - .06, z0 + h * .4, .1, .06, .1); for (const z of [.25, .6]) M.box('iron', [x, y - .04, z0 + h * z], [w * .9, .03, .08]); }
  function dormer(M, x, y, z0, w, mat = 'window_glow') {
    M.block('stone_dark', x, y, z0, w, 1.6, 1.6); gwin(M, x, y - .82, z0 + .2, w * .5, 1.2, -1, mat);
    steepRoof(M, 'roof_purple', x, y, z0 + 1.6, w + .1, 1.6, 1, .25, 'stone_dark', true);
  }
  function ironCrest(M, x, y, z, L) { M.box('iron', [x, y, z + .55], [L, .05, .05]); for (let i = 0; i <= Math.round(L / .5); i++) { const px = x - L / 2 + i * L / Math.round(L / .5); M.rod('iron', [px, y, z + .1], [px, y, z + .7], .025, 3); M.cyl('iron', [px, y, z + .7], .05, .14, 4, .005); } }
  function ccCottage(M, W, D, v, winMat) {
    const H = 3.4, lean = v === 2 ? .08 : v === 1 ? -.05 : .03;
    M.block('stone_dark', 0, 0, 0, W + .5, D + .5, 1);
    M.block('plaster_cc', 0, 0, 1, W, D, H);
    for (const x of [-W / 2, -W / 6, W / 6, W / 2]) for (const y of [-D / 2 - .02, D / 2 + .02]) M.block('darkwood', x, y, 1, .26, .14, H);
    for (const y of [-D / 2 - .03, D / 2 + .03]) { M.block('darkwood', 0, y, 1, W + .2, .14, .22); M.block('darkwood', 0, y, 1 + H - .2, W + .2, .14, .22); }
    M.block('darkwood', -W / 4, -D / 2 - .06, 1, 1.2, .1, 2.2); M.block('iron', -W / 4 + .4, -D / 2 - .12, 2, .08, .06, .08); // door
    M.block(winMat, W / 4, -D / 2 - .05, 2, 1.3, .06, 1.1); M.box('darkwood', [W / 4, -D / 2 - .09, 2.55], [1.3, .04, .08]); M.box('darkwood', [W / 4, -D / 2 - .09, 2.55], [.08, .04, 1.1]);
    for (const sd of [-1, 1]) M.block(winMat, sd * (W / 2 + .03), 0, 2.1, .06, 1.1, 1);
    M.block(winMat, -W / 4, -D / 2 - .5, 3.4, .3, .3, .4); M.block('iron', -W / 4, -D / 2 - .5, 3.8, .36, .36, .06);
    const z = 1 + H; steepRoof(M, 'roof_purple', 0, 0, z, W, D, 3.8 + v * .5, .6, 'plaster_cc');
    dormer(M, W / 5, -D / 2 + 1.2, z + .7, 1.6, winMat);
    const cx = -W / 2 + 1.2; M.box('stone_dark', [cx + lean * 2, D / 4, z + 2.6], [1, 1, 4.6], lean * .5, lean); M.box('stone_dark', [cx + lean * 4.4, D / 4, z + 5], [1.25, 1.25, .3], lean * .5, lean);
    M.quad('glow', [[-W / 4 - 2, -D / 2 - 3.6, .05], [-W / 4 + 2, -D / 2 - 3.6, .05], [-W / 4 + 2, -D / 2 + .4, .05], [-W / 4 - 2, -D / 2 + .4, .05]]);
  }
  function ccCauldron(M, x, y, z) {
    for (let k = 0; k < 3; k++) { const a = k * 2.094; M.rod('iron', [x + Math.cos(a) * .9, y + Math.sin(a) * .9, z], [x + Math.cos(a) * .55, y + Math.sin(a) * .55, z + .7], .05, 4); }
    for (let k = 0; k < 5; k++) { const a = k * 1.25; M.rod('bark', [x + Math.cos(a) * .6, y + Math.sin(a) * .6, z + .08], [x - Math.cos(a) * .2, y - Math.sin(a) * .2, z + .2], .08, 5); }
    M.quad('fire', [[x - .4, y, z + .1], [x + .4, y, z + .1], [x, y, z + .7]]); M.quad('fire', [[x, y - .4, z + .1], [x, y + .4, z + .1], [x, y, z + .65]]);
    M.sphere('iron', [x, y, z + 1.05], .72, .8, 12, 6); M.cyl('iron', [x, y, z + 1.45], .66, .1, 12);
    M.cyl('brew', [x, y, z + 1.5], .6, .02, 12);
    for (const [dx, dy, r] of [[.2, .1, .1], [-.25, -.05, .08], [0, -.25, .07]]) M.sphere('brew', [x + dx, y + dy, z + 1.55], r, 1, 6, 3);
    M.quad('glow_green', [[x - 2.4, y - 2.4, .06], [x + 2.4, y - 2.4, .06], [x + 2.4, y + 2.4, .06], [x - 2.4, y + 2.4, .06]]);
  }
  // jack-o'-lantern of radius r at (x, y, z) turned by a (its face toward -y before turning)
  function ccPumpkin(M, x, y, z, r, a) {
    const c = Math.cos(a), s = Math.sin(a), R = (px, py, pz) => [x + px * c - py * s, y + px * s + py * c, z + pz];
    for (let k = 0; k < 6; k++) { const b = k / 6 * Math.PI * 2; M.sphere('pumpkin', R(Math.cos(b) * r * .32, Math.sin(b) * r * .32, r * .78), r * .72, .95, 8, 5); }
    M.cyl('leaf', R(0, 0, r * 1.45), r * .1, r * .4, 5, r * .05);
    const yF = -r * 1.02, P = pts => pts.map(([px, pz]) => R(px * r, yF, pz * r));
    for (const sd of [-1, 1]) M.poly('fire', P([[sd * .18, .95], [sd * .48, .95], [sd * .33, 1.22]]).reverse());
    M.poly('fire', P([[-.5, .55], [-.3, .45], [-.15, .55], [0, .42], [.15, .55], [.3, .45], [.5, .55], [.35, .32], [-.35, .32]]).reverse());
  }
  function ccSkeleton(M, x, y, z) {
    M.sphere('bone', [x, y, z + 1.7], .2, 1.1, 8, 5); for (const sd of [-1, 1]) M.quad('dark', [[x + sd * .08 - .04, y - .19, z + 1.72], [x + sd * .08 + .04, y - .19, z + 1.72], [x + sd * .08 + .04, y - .19, z + 1.8], [x + sd * .08 - .04, y - .19, z + 1.8]]);
    M.rod('bone', [x, y, z + 1.5], [x, y, z + .7], .04, 4); for (let i = 0; i < 4; i++) M.tube('bone', [x, y, z + 1.38 - i * .14], [x, y, z + 1.34 - i * .14], .2 - i * .02, .2 - i * .02, 8, false);
    for (const sd of [-1, 1]) { M.rod('bone', [x + sd * .2, y, z + 1.45], [x + sd * .3, y - .1, z + .95], .03, 3); M.rod('bone', [x + sd * .1, y, z + .7], [x + sd * .14, y - .05, z], .035, 3); }
  }
  function ccStone(M, x, y, kind, h) {
    if (kind === 'cross') { M.block('stone_dark', x, y, 0, .25, .2, h); M.block('stone_dark', x, y, h * .62, .9, .2, .22); }
    else if (kind === 'obelisk') { M.block('stone_dark', x, y, 0, .7, .7, .3); M.cyl('stone_dark', [x, y, .3], .3, h - .5, 4, .12); M.cyl('stone_dark', [x, y, h - .2], .12, .3, 4, .01); }
    else { M.block('stone_dark', x, y, 0, .9, .22, h - .45); M.tube('stone_dark', [x, y - .11, h - .45], [x, y + .11, h - .45], .45, .45, 12); }
    M.block('stone_dark', x, y, 0, 1.1, .5, .14);
  }
  function ccCandles(M, x, y, n) { for (let i = 0; i < n; i++) { const a = i * 2.4, r = .12 + .1 * i, px = x + Math.cos(a) * r, py = y + Math.sin(a) * r, h = .18 + .12 * ((i * 7) % 3); M.cyl('candle', [px, py, 0], .05, h, 6); M.quad('fire', [[px - .04, py, h], [px + .04, py, h], [px, py, h + .14]]); } }
  function ccSign(M, x, y, z, mat, w = 1.8) { M.rod('iron', [x - w / 2 - .2, y + .7, z + .5], [x - w / 2 - .2, y, z + .5], .04, 4); M.box('darkwood', [x, y, z], [w + .2, .1, w * .7 + .2]); M.quad(mat, [[x - w / 2, y - .06, z - w * .35], [x + w / 2, y - .06, z - w * .35], [x + w / 2, y - .06, z + w * .35], [x - w / 2, y - .06, z + w * .35]]); for (const sd of [-1, 1]) M.rod('iron', [x + sd * w / 2, y, z + w * .35 + .1], [x + sd * w / 2, y, z + .5 + w * .35], .015, 3); }
  // sphere with a picture on its front half: u from x, v from z (planar, as seen from the front); plain behind
  function faceSphere(M, mat, backMat, c, r, sz = 1, segs = 18, rings = 12) {
    const P = (i, j) => { const th = Math.PI * i / rings, ph = 2 * Math.PI * j / segs; return [c[0] + r * Math.sin(th) * Math.cos(ph), c[1] + r * Math.sin(th) * Math.sin(ph), c[2] + r * sz * Math.cos(th)]; };
    const uv = p => [.5 + (p[0] - c[0]) / (2 * r), .5 + (p[2] - c[2]) / (2 * r * sz)];
    for (let i = 0; i < rings; i++) for (let j = 0; j < segs; j++) {
      const q = [P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)], pts = [];
      for (const p of q) if (!pts.length || Math.hypot(...sub(p, pts[pts.length - 1])) > 1e-6) pts.push(p);
      if (pts.length > 3 && Math.hypot(...sub(pts[0], pts[pts.length - 1])) < 1e-6) pts.pop();
      if (pts.length < 3) continue;
      const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      M.poly(cy < c[1] ? mat : backMat, pts, pts.map(uv));
    }
  }
  // surface of revolution round the z axis: prof [[radius, z], ...] bottom to top; u once round (front at .75)
  function lathe(M, m, prof, segs = 20) {
    const z0 = prof[0][1], H = prof[prof.length - 1][1] - z0, p = (r, z, a) => [r * Math.cos(a), r * Math.sin(a), z];
    for (let i = 0; i < prof.length - 1; i++) for (let j = 0; j < segs; j++) {
      const a0 = j / segs * Math.PI * 2, a1 = (j + 1) / segs * Math.PI * 2, [r0, za] = prof[i], [r1, zb] = prof[i + 1], v0 = (za - z0) / H, v1 = (zb - z0) / H;
      M.poly(m, [p(r0, za, a0), p(r0, za, a1), p(r1, zb, a1), p(r1, zb, a0)], [[j / segs, v0], [(j + 1) / segs, v0], [(j + 1) / segs, v1], [j / segs, v1]]);
    }
  }
  // a bob of hair over a head at c: covers the back and top, leaves the face open below the fringe at cutZ, hangs
  // straight at the sides down to bobZ
  function hairBob(M, m, c, r, cutZ, bobZ) {
    const segs = 20, rings = 12, R = r * 1.07;
    const P = (i, j) => { const th = Math.PI * i / rings, ph = 2 * Math.PI * j / segs, rr = th > Math.PI / 2 ? R : R * Math.sin(th); return [c[0] + rr * Math.cos(ph), c[1] + rr * Math.sin(ph) * (th > Math.PI / 2 ? 1 : 1), Math.max(bobZ, c[2] + R * Math.cos(th))]; };
    for (let i = 0; i < rings; i++) for (let j = 0; j < segs; j++) {
      const q = [P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)], cx = (q[0][0] + q[2][0]) / 2 - c[0], cy = (q[0][1] + q[2][1]) / 2 - c[1], cz = (q[0][2] + q[2][2]) / 2;
      if (cz <= bobZ + .001 && q.every(p => p[2] <= bobZ + .001)) continue;
      if (cy < -r * .2 && cz < cutZ && Math.abs(cx) < r * .72) continue; // the face
      const pts = []; for (const p of q) if (!pts.length || Math.hypot(...sub(p, pts[pts.length - 1])) > 1e-6) pts.push(p);
      if (pts.length > 3 && Math.hypot(...sub(pts[0], pts[pts.length - 1])) < 1e-6) pts.pop();
      if (pts.length >= 3) M.poly(m, pts);
    }
    M.box(m, [c[0], c[1] - R * .82, cutZ + .02], [r * 1.5, .08, .06]); // the fringe's straight cut
  }
  function kokeshi(M, kimono, obi, face, skin, hair) {
    M.cyl('darkwood', [0, 0, 0], .44, .05, 16);
    lathe(M, kimono, [[.42, .05], [.5, .2], [.52, .45], [.47, .76], [.36, .98], [.24, 1.06]]);
    lathe(M, obi, [[.525, .44], [.515, .62]]); M.box(obi, [0, -.52, .53], [.34, .05, .16]);
    faceSphere(M, face, skin, [0, 0, 1.4], .4);
    hairBob(M, hair, [0, 0, 1.4], .4, 1.53, 1.12);
  }
  function luckyCat(M, coat, fur, face, earIn) {
    faceSphere(M, coat, fur, [0, 0, .55], .55, 1);
    faceSphere(M, face, fur, [0, -.05, 1.3], .46, .86);
    for (const sd of [-1, 1]) { M.cyl(fur, [sd * .27, 0, 1.56], .16, .36, 6, .01); M.cyl(earIn, [sd * .27, -.06, 1.6], .09, .24, 5, .01); M.sphere(fur, [sd * .24, -.38, .08], .16, .7, 8, 4); }
    curveTube(M, fur, [[0, .45, .2], [.3, .62, .35], [.42, .55, .75], [.3, .45, .9]], [.09, .08, .07, .03], { segs: 8, n: 3, ridge: .02, bump: .02, seed: 9 });
  }
  function ccFlower(M, m, x, y, z, r) { for (let k = 0; k < 5; k++) { const a = k * 1.2566; M.sphere(m, [x + Math.cos(a) * r * .55, y - .01, z + Math.sin(a) * r * .55], r * .5, .6, 6, 3); } M.sphere('gold', [x, y - .04, z], r * .25, 1, 5, 3); }
  // a leaf / frond as a strip along a spine (pt(f), f 0..1), half-width w(f), folded down from the midrib by fold;
  // d = the leaf's horizontal direction (the sides spread perpendicular to it)
  function leafStrip(M, m, pt, w, d, fold, n) {
    const side = [-d[1], d[0], 0];
    for (let i = 0; i < n; i++) {
      const f0 = i / n, f1 = (i + 1) / n, a = pt(f0), b = pt(f1), w0 = w(f0), w1 = w(f1);
      for (const sd of [-1, 1]) {
        const E = (p, ww) => [p[0] + side[0] * sd * ww, p[1] + side[1] * sd * ww, p[2] - fold * ww];
        M.poly(m, sd > 0 ? [a, b, E(b, w1), E(a, w0)] : [E(a, w0), E(b, w1), b, a], sd > 0 ? [[.5, f0], [.5, f1], [1, f1], [1, f0]] : [[0, f0], [0, f1], [.5, f1], [.5, f0]]);
      }
    }
  }
  // a boat hull along y (length L, half-beam B, gunwale height G above the keel at 0): lofted planked sides, a floor
  function chzHull(M, L, B, G, side, floor) {
    const n = 10, st = [...Array(n + 1)].map((_, k) => { const f = k / n, y = -L / 2 + L * f, w = B * Math.pow(Math.sin(Math.PI * Math.min(1, .04 + f * .96)), .7), sheer = G + .25 * Math.pow(2 * f - 1, 2); return { y, w, sheer }; });
    for (let k = 0; k < n; k++) { const a = st[k], b = st[k + 1];
      for (const sd of [-1, 1]) { const P = (s, t) => [sd * s.w * t, s.y, t === 1 ? s.sheer : t === .6 ? G * .35 : 0]; for (const [t0, t1] of [[0, .6], [.6, 1]]) M.poly(side, sd > 0 ? [P(a, t0), P(b, t0), P(b, t1), P(a, t1)] : [P(a, t1), P(b, t1), P(b, t0), P(a, t0)]); }
      M.poly(floor, [[-a.w * .55, a.y, .25], [a.w * .55, a.y, .25], [b.w * .55, b.y, .25], [-b.w * .55, b.y, .25]]);
      for (const sd of [-1, 1]) M.rod('darkwood', [sd * a.w, a.y, a.sheer], [sd * b.w, b.y, b.sheer], .05, 4);
    }
  }
  function chzStool(M, x, y, z) { M.cyl('wood', [x, y, z + .7], .26, .08, 8); for (let k = 0; k < 3; k++) { const a = k * 2.094; M.rod('darkwood', [x + Math.cos(a) * .2, y + Math.sin(a) * .2, z], [x + Math.cos(a) * .08, y + Math.sin(a) * .08, z + .7], .03, 3); } }
  function chzTable(M, x, y, z) {
    M.cyl('wood', [x, y, z], .45, .8, 10, .45); M.cyl('darkwood', [x, y, z + .8], .7, .08, 12);
    for (let k = 0; k < 3; k++) { const a = k * 2.094 + .4; chzStool(M, x + Math.cos(a) * 1.1, y + Math.sin(a) * 1.1, z); }
    for (const [dx, dy, m] of [[.2, .1, 'bottle_green'], [-.25, .15, 'bottle_brown']]) { M.cyl(m, [x + dx, y + dy, z + .88], .05, .22, 6); M.cyl(m, [x + dx, y + dy, z + 1.1], .05, .09, 6, .02); }
  }
  function chzLantern(M, x, y, z) { M.block('iron', x, y, z, .34, .34, .06); M.block('window_glow', x, y, z - .45, .28, .28, .45); M.cyl('iron', [x, y, z + .06], .22, .16, 4, .03); M.block('iron', x, y, z - .5, .34, .34, .05); }
  // a big banana along x (length L, radius r, centre sag s), brown ends; on: the ends tip up (resting on posts)
  function chzBanana(M, x, y, z, L, r, s, on) {
    const pts = []; for (let k = 0; k <= 6; k++) { const f = k / 6, u = f * 2 - 1; pts.push([x + u * L / 2, y, z - s * (1 - u * u) + (on ? .6 * u * u : 0)]); }
    curveTube(M, 'banana_big', pts, [r * .18, r * .62, r * .92, r, r * .92, r * .62, r * .2], { segs: 10, n: 3, ridge: .12, k: 5, bump: .04, seed: 2 });
    for (const sd of [-1, 1]) M.cyl('darkwood', [x + sd * (L / 2 + .1), y, z + (on ? .6 : 0) - .15], r * .18, .5, 6, r * .1);
  }
  function chzFish(M, x, y, z) { M.rod('rope', [x, y, z], [x, y, z - .25], .01, 3); M.sphere('fish', [x, y, z - .6], .12, 3.2, 6, 4); M.poly('fish', [[x, y, z - 1.0], [x - .12, y, z - 1.22], [x + .12, y, z - 1.22]]); }
  function chzDoor(M, sign, plank) { // a plank door against a wall, front faces -y
    const W = 2.2, H = 3.6; for (const sd of [-1, 1]) M.block('palm_bark', sd * (W / 2 + .12), -.12, 0, .24, .24, H + .2); M.block('palm_bark', 0, -.12, H, W + .5, .24, .24);
    M.block(plank, 0, -.04, 0, W, .08, H); for (let x = -W / 2 + .28; x < W / 2; x += .28) M.block('darkwood', x, -.09, 0, .02, .02, H); M.box('darkwood', [0, -.1, H / 2], [W, .03, .12], 0, 0, .9); M.sphere('brass', [.75, -.14, 1.8], .07, 1, 6, 3);
    M.box('darkwood', [0, -.08, H + .72], [2.4, .08, .9]); M.quad(sign, [[-1.1, -.13, H + .32], [1.1, -.13, H + .32], [1.1, -.13, H + 1.12], [-1.1, -.13, H + 1.12]]);
  }
  function chzShop(M, plank, sign, kind) {
    const W = 12, D = 8, Z = .5, H = 3.8, yF = -D / 2;
    M.block('wood', 0, -1, 0, W + 1, D + 2, Z); steps(M, 0, yF - 2, Z, 4, 1, .45);
    M.block(plank, 0, D / 2 - .15, Z, W, .3, H); M.block(plank, -W / 2 + .15, 0, Z, .3, D, H); M.block(plank, W / 2 - .15, 0, Z, .3, D, H);
    for (const x of [-W / 2, -W / 6, W / 6, W / 2]) M.block('wood', x, yF, Z, .34, .34, H);
    M.block(plank, 0, yF, Z + H - .9, W, .25, .9);
    M.quad(sign, [[-4.2, yF - .16, Z + H - .85], [4.2, yF - .16, Z + H - .85], [4.2, yF - .16, Z + H + 1.1], [-4.2, yF - .16, Z + H + 1.1]]); M.box('darkwood', [0, yF - .04, Z + H + .1], [8.6, .1, 2.1]);
    steepRoof(M, 'tin_roof', 0, 0, Z + H, W, D, 2.6, .7, plank);
    if (kind === 'bait') {
      M.quad('books', [[-W / 2 + .5, D / 2 - .32, Z + .5], [-1, D / 2 - .32, Z + .5], [-1, D / 2 - .32, Z + 2.9], [-W / 2 + .5, D / 2 - .32, Z + 2.9]]);
      M.block('wood', 2.5, 1, Z, 4, 1, .9); M.quad('net', [[1, D / 2 - .33, Z + .8], [W / 2 - .5, D / 2 - .33, Z + .8], [W / 2 - .5, D / 2 - .33, Z + 3.2], [1, D / 2 - .33, Z + 3.2]]);
      for (let i = 0; i < 8; i++) M.rod('wood', [-W / 2 - .2 + i * .18, yF - .6, 0], [-W / 2 + .1 + i * .2, yF - .3, 3.4], .025, 3);
      M.block('wood', W / 2 + .6, yF - .6, 0, 1, .9, .8); M.sphere('net', [W / 2 + .4, yF - 1.6, .4], .55, .5, 8, 4);
    } else {
      for (const [x, y, m] of [[-3, -.5, 'felt_green'], [0, 1.4, 'felt_red'], [3, -.5, 'felt_green']]) { M.block('darkwood', x, y, Z, 2.2, 1.3, .8); M.block(m, x, y, Z + .8, 2, 1.1, .04); for (const sd of [-1, 1]) chzStool(M, x + sd * 1.5, y, Z); }
      M.quad('teal_glow', [[-W / 2 + .5, D / 2 - .32, Z + 2.4], [W / 2 - .5, D / 2 - .32, Z + 2.4], [W / 2 - .5, D / 2 - .32, Z + 3.3], [-W / 2 + .5, D / 2 - .32, Z + 3.3]]);
    }
    for (const sd of [-1, 1]) chzLantern(M, sd * (W / 2 - .2), yF - .3, Z + H - .1);
  }
  function chzShack(M, plank, roof) {
    const W = 6.4, D = 5, Z = .5, H = 3;
    M.block('wood', 0, -.8, 0, W + .6, D + 1.8, Z); M.block(plank, 0, 0, Z, W, D, H);
    for (const x of [-W / 2, W / 2]) for (const y of [-D / 2, D / 2]) M.block('wood', x, y, Z, .26, .26, H);
    M.block('darkwood', -1.2, -D / 2 - .03, Z, 1.1, .08, 2.2); M.block('window_glow', 1.4, -D / 2 - .03, Z + 1.2, 1.2, .06, 1); M.box('wood', [1.4, -D / 2 - .07, Z + 1.7], [1.4, .05, .1]);
    for (let i = 0; i <= 6; i++) M.block('wood', -W / 2 - .2 + i * (W + .4) / 6, -D / 2 - 1.6, Z, .1, .1, .9); M.box('wood', [0, -D / 2 - 1.6, Z + .9], [W + .5, .1, .1]);
    steepRoof(M, roof, 0, -.6, Z + H, W, D + 1.2, 2.2, .6, plank);
    for (const x of [-W / 2 - .2, W / 2 + .2]) M.block('wood', x, -D / 2 - 1.6, Z, .2, .2, H);
    chzLantern(M, -.4, -D / 2 - .3, Z + 2.4);
  }
  function warPalisade(M, withBanner) {
    const L = 8, n = 14;
    M.block('stone', 0, 0, 0, L, .9, .45);
    for (let i = 0; i < n; i++) { const x = -L / 2 + .29 + i * (L - .58) / (n - 1), h = 4.6 + .35 * Math.sin(i * 2.7) + .2 * Math.cos(i * 1.3); M.cyl('bark', [x, 0, -.3], .28, h + .3, 7); M.cyl('bark', [x, 0, h], .28, .85, 7, .02); for (const z of [1.2, h - .7]) M.cyl('iron', [x, 0, z], .3, .16, 7); }
    for (const z of [1.5, 3.6]) M.box('darkwood', [0, .34, z], [L, .14, .24]);
    for (const x of [-2.6, 2.6]) M.rod('wood', [x, .36, 3.4], [x, 2.6, -.2], .12, 6);
    if (withBanner) { M.cyl('darkwood', [0, .55, 0], .1, 7.8, 8); M.box('darkwood', [0, .5, 7.5], [1.8, .1, .1]); M.quad('banner_warrior', [[-.8, .46, 4.9], [.8, .46, 4.9], [.8, .46, 7.45], [-.8, .46, 7.45]]); M.quad('banner_warrior', [[.8, .44, 4.9], [-.8, .44, 4.9], [-.8, .44, 7.45], [.8, .44, 7.45]], [[1, 0], [0, 0], [0, 1], [1, 1]]); M.cyl('gold', [0, .55, 7.8], .1, .3, 6, .02); }
  }
  function steps(M, cx, yEdge, zTop, width, n, tread = .45) { for (let i = 0; i < n; i++) M.block('stone', cx, yEdge - (i + .5) * tread, 0, width, tread, zTop - i * zTop / n); }

  // ── Chumpz apes: low-poly, rigged. Each part's geometry is authored in the rest pose (Blender coords, front -y) and
  //    built relative to its joint (Kit.o), so the joints can turn (walk / run / jump / kick, see animateApe) ──
  const APE_J = { pelvis: [0, 0, 1.1], neck: [0, 0, 2.45], sh_l: [-.62, 0, 2.18], sh_r: [.62, 0, 2.18], el_l: [-.68, -.02, 1.56], el_r: [.68, -.02, 1.56], hip_l: [-.22, 0, 1.1], hip_r: [.22, 0, 1.1], kn_l: [-.22, 0, .55], kn_r: [.22, 0, .55] };
  const APE_TREE = [['pelvis', null], ['neck', 'pelvis'], ['sh_l', 'pelvis'], ['sh_r', 'pelvis'], ['el_l', 'sh_l'], ['el_r', 'sh_r'], ['hip_l', null], ['hip_r', null], ['kn_l', 'hip_l'], ['kn_r', 'hip_r']];
  const APE_TORSO = [[.4, 1.1], [.47, 1.25], [.5, 1.5], [.54, 1.8], [.6, 2.05], [.6, 2.2], [.5, 2.36], [.26, 2.48], [.14, 2.52]], APE_SY = .72, APE_HEAD = [0, -.04, 2.8], APE_HEAD_K = 1.2;
  // lathe with an elliptical section (depth sy) round (0, cy)
  function latheE(M, m, prof, segs = 20, sy = 1, cy = 0) {
    const z0 = prof[0][1], H = prof[prof.length - 1][1] - z0, p = (r, z, a) => [r * Math.cos(a), cy + r * sy * Math.sin(a), z];
    for (let i = 0; i < prof.length - 1; i++) for (let j = 0; j < segs; j++) {
      const a0 = j / segs * Math.PI * 2, a1 = (j + 1) / segs * Math.PI * 2, [r0, za] = prof[i], [r1, zb] = prof[i + 1], v0 = (za - z0) / H, v1 = (zb - z0) / H;
      M.poly(m, [p(r0, za, a0), p(r0, za, a1), p(r1, zb, a1), p(r1, zb, a0)], [[j / segs, v0], [(j + 1) / segs, v0], [(j + 1) / segs, v1], [j / segs, v1]]);
    }
  }
  const apeTorsoR = z => { const P = APE_TORSO; if (z <= P[0][1]) return P[0][0]; for (let i = 1; i < P.length; i++) if (z <= P[i][1]) { const [r0, z0] = P[i - 1], [r1, z1] = P[i]; return r0 + (r1 - r0) * (z - z0) / (z1 - z0); } return P[P.length - 1][0]; };
  const onTorso = (a, z, k = 1.05) => { const r = apeTorsoR(z) * k; return [r * Math.cos(a), r * APE_SY * Math.sin(a), z]; };
  const FRONT = Math.PI * 1.5;
  function apePart(M, o, id, j) {
    const f = 'fur_' + id, sk = 'skin_' + id, sd = j.endsWith('_l') ? -1 : 1, [hx, hy, hz] = APE_HEAD, furO = { segs: 10, n: 3, ridge: .04, k: 7, bump: .06, seed: 11 };
    if (j === 'pelvis') { // torso, seat, neck, bandana / gold chain
      latheE(M, 'torso_' + id, APE_TORSO, 20, APE_SY);
      latheE(M, o.pantsMat, [[.05, .92], [.3, .95], [.42, 1.02], [.42, 1.13]], 16, .76);
      M.cyl(f, [0, .02, 2.38], .22, .28, 10);
      if (o.bandana) {
        latheE(M, 'ape_bandana', [[apeTorsoR(2.36) * 1.05, 2.36], [apeTorsoR(2.47) * 1.06, 2.47]], 16, APE_SY);
        const P = [], U = []; for (let i = 0; i <= 4; i++) { const t = i / 4, z = 2.44 - .44 * t, w = .62 * (1 - t) + .02, row = [], urow = []; for (let s = 0; s <= 4; s++) { const e = s / 4 * 2 - 1; row.push(onTorso(FRONT + e * w, z, 1.06 + .03 * t)); urow.push([.5 + e * (1 - t) * .5, 1 - t]); } P.push(row); U.push(urow); }
        M.grid('ape_bandana', P, U); M.sphere('ape_bandana', onTorso(FRONT + .25, 2.38, 1.12), .07, 1, 6, 4);
      }
      if (o.chain) {
        const N = 34; for (let k = 0; k < N; k++) { const a = k / N * Math.PI * 2, z = 2.46 - .4 * Math.max(0, -Math.sin(a)) ** 2; M.sphere('gold', onTorso(a, z, 1.08), .034, 1, 6, 3); }
        const c = onTorso(FRONT, 1.98, 1.1); M.tube('gold', c, [c[0], c[1] - .04, c[2]], .1, .1, 12); M.tube('dark', [c[0], c[1] - .041, c[2]], [c[0], c[1] - .042, c[2]], .05, .05, 8, false);
      }
    } else if (j === 'neck') { // head: fur skull with the face picture, brow ridge, muzzle, ears; hats and glasses
      faceSphere(M, 'face_' + id, f, APE_HEAD, .42, 1.02, 18, 12);
      blob(M, sk, [0, -.41, 2.86], .3, .07, .07, { amp: 0, segs: 12, rings: 6 });
      faceSphere(M, 'muzzle_' + id, sk, [0, -.3, 2.6], .24, .78, 14, 8);
      for (const s of [-1, 1]) { blob(M, sk, [s * .45, -.02, 2.8], .06, .13, .16, { amp: .05, segs: 10, rings: 6 }); blob(M, f, [s * .43, .02, 2.8], .05, .12, .14, { amp: 0, segs: 8, rings: 5 }); }
      if (o.earring) for (const s of [-1, 1]) M.tube('gold', [s * .49, -.06, 2.62], [s * .49, -.03, 2.62], .035, .035, 8, false);
      if (o.hat === 'cap') {
        latheE(M, 'cap_blue', [[.45, 2.86], [.45, 2.98], [.4, 3.1], [.28, 3.2], [.1, 3.27], [0, 3.28]], 18, 1, hy);
        M.quad('cap_logo', [[-.25, -.53, 2.87], [.25, -.53, 2.87], [.21, -.46, 3.13], [-.21, -.46, 3.13]]);
        const n = 10; for (let i = 0; i < n; i++) { const B = [i / n, (i + 1) / n].map(u => { const th = u * Math.PI, x = .43 * Math.cos(th), yi = hy - Math.sqrt(Math.max(0, .45 * .45 - x * x)), yo = yi - .3 * Math.sin(th) ** .7 - .02, z = 2.87 - .05 * Math.sin(th); return [[x, yi, z], [x, yo, z - .03]]; }); M.poly('cap_blue', [B[0][0], B[1][0], B[1][1], B[0][1]]); }
        M.sphere('cap_blue', [0, hy, 3.28], .045, 1, 6, 3);
      } else if (o.hat === 'headband') {
        latheE(M, 'band_rb', [[.44, 2.88], [.415, 3.0]], 18, 1, hy);
        M.sphere('band_rb', [-.42, -.12, 2.95], .08, 1, 6, 4); for (const dz of [0, .1]) M.quad('band_rb', [[-.44, -.06, 2.95], [-.48, .1, 2.98 - dz], [-.5, .14, 2.82 - dz], [-.45, -.04, 2.9]]);
        curveTube(M, 'banana', [[-.42, -.2, 3.34], [-.5, -.24, 3.08], [-.5, -.22, 2.82], [-.44, -.18, 2.62]], [.03, .07, .08, .065, .03], { segs: 8, n: 3, ridge: .1, k: 5, bump: .02, seed: 4 });
        M.cyl('darkwood', [-.42, -.2, 3.33], .02, .06, 5);
      } else if (o.hat === 'bucket') {
        latheE(M, 'hat_white', [[.64, 2.85], [.6, 2.88], [.47, 2.97], [.46, 3.2], [.4, 3.3], [.2, 3.33], [0, 3.335]], 20, 1, hy);
        M.quad('patch_apechain', [[-.2, -.525, 3.03], [.2, -.525, 3.03], [.2, -.51, 3.19], [-.2, -.51, 3.19]]);
        M.rod('rope', [.44, -.2, 2.95], [.5, -.24, 2.66], .008, 3); M.quad('ape_bandana', [[.47, -.26, 2.66], [.53, -.22, 2.66], [.53, -.22, 2.48], [.47, -.26, 2.48]]);
      } else if (o.hat === 'peel') {
        M.cyl('darkwood', [0, hy, 3.2], .05, .12, 6, .03);
        for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + k * Math.PI / 2 + .2, d = [Math.cos(a), Math.sin(a)]; leafStrip(M, 'banana', u => [d[0] * (.05 + .44 * u), hy + d[1] * (.05 + .44 * u), 3.25 + .09 * Math.sin(Math.PI * u) - .3 * u * u], u => .17 * Math.sin(Math.PI * Math.min(1, .35 + u * .75)), d, .05, 6); }
        M.cyl('banana', [0, hy, 3.18], .1, .14, 8, .07);
      } else if (o.hat === 'penguin') {
        latheE(M, 'peng_blue', [[.45, 2.88], [.445, 3.0], [.38, 3.13], [.24, 3.24], [0, 3.29]], 18, 1, hy);
        blob(M, 'peng_white', [0, -.47, 3.04], .24, .06, .13, { amp: 0, segs: 12, rings: 6 });
        for (const s of [-1, 1]) { M.sphere('dark', [s * .08, -.53, 3.08], .035, 1, 6, 3); blob(M, 'peng_blue', [s * .47, -.02, 2.68], .07, .2, .28, { amp: .04, segs: 10, rings: 6 }); M.rod('rope', [s * .47, -.06, 2.42], [s * .3, -.42, 1.96], .012, 3); }
        M.tube('peng_beak', [0, -.52, 3.0], [0, -.64, 2.97], .05, .005, 6);
      }
      if (o.glasses === 'shades') {
        for (const s of [-1, 1]) { M.box('glass_dark', [s * .13, -.48, 2.76], [.22, .03, .11]); M.rod('iron', [s * .24, -.47, 2.79], [s * .43, -.1, 2.8], .012, 3); }
        M.box('iron', [0, -.48, 2.79], [.06, .02, .02]);
      } else if (o.glasses === 'goggles') {
        for (const s of [-1, 1]) { M.tube('iron', [s * .13, -.43, 2.76], [s * .13, -.5, 2.76], .1, .1, 12); M.tube('glass_dark', [s * .13, -.5, 2.76], [s * .13, -.505, 2.76], .085, .085, 12); }
        latheE(M, 'iron', [[.445, 2.73], [.445, 2.79]], 18, 1, hy);
      }
    } else if (j.startsWith('sh')) { // upper arm (fur)
      const x = .62 * sd; M.sphere(f, [x, 0, 2.18], .2, 1, 10, 6);
      curveTube(M, f, [[x, 0, 2.18], [x + sd * .04, -.01, 1.88], [x + sd * .06, -.02, 1.56]], [.18, .16, .14], furO);
    } else if (j.startsWith('el')) { // forearm (big, furry), hand
      const x = .68 * sd; M.sphere(f, [x, -.02, 1.56], .14, 1, 8, 5);
      curveTube(M, f, [[x, -.02, 1.56], [x, -.05, 1.25], [x - sd * .01, -.05, .98]], [.14, .17, .12], furO);
      blob(M, sk, [x, -.07, .86], .1, .12, .13, { amp: .08, segs: 10, rings: 6 });
      for (let k = 0; k < 4; k++) M.rod(sk, [x + (k - 1.5) * .045, -.12, .82], [x + (k - 1.5) * .05, -.1, .7], .028, 4);
      M.rod(sk, [x - sd * .07, -.14, .9], [x - sd * .06, -.2, .82], .03, 4);
    } else if (j.startsWith('hip')) { // thigh: pants (overalls) or shorts over fur
      const x = .22 * sd, p = o.pantsMat;
      if (o.shins) curveTube(M, p, [[x, 0, 1.12], [x, -.01, .84], [x, 0, .56]], [.23, .2, .17], { segs: 10, n: 3, ridge: .02, bump: .03, seed: 13 });
      else { curveTube(M, p, [[x, 0, 1.12], [x, -.01, .95], [x, 0, .76]], [.24, .23, .22], { segs: 10, n: 3, ridge: .02, bump: .03, seed: 13 }); curveTube(M, f, [[x, 0, .8], [x, 0, .56]], [.18, .16], furO); }
    } else { // shin, foot
      const x = .22 * sd, lo = o.shins || f;
      M.sphere(lo, [x, 0, .55], .17, 1, 8, 5);
      curveTube(M, lo, [[x, 0, .55], [x, .01, .3], [x, 0, .12]], [.17, .15, .13], o.shins ? { segs: 10, n: 3, ridge: .02, bump: .03, seed: 14 } : furO);
      if (o.shins) M.cyl(lo, [x, 0, .1], .16, .1, 10);
      blob(M, sk, [x, -.08, .05], .14, .24, .07, { amp: .06, flat: .5, segs: 10, rings: 6 });
      for (let k = 0; k < 4; k++) M.sphere(sk, [x + (k - 1.5) * .06, -.3, .05], .04, 1, 5, 3);
      M.sphere(sk, [x - sd * .13, -.22, .05], .05, 1, 5, 3);
    }
  }

  // ── Saints of LA (friend collection): a city block. Fronts face -y. Storeys ~4.6 m (the Rebels are ~3.4 m tall) ──
  // windows on a wall facing -y (face -1) / +y (face 1): nx bays from x0 to x1, storeys from z0 every sh; a share lit at night
  function slWin(M, face, yW, x0, x1, nx, z0, storeys, sh, w, h, lit = .3, seed = 1) {
    for (let s = 0; s < storeys; s++) for (let i = 0; i < nx; i++) {
      const x = x0 + (i + .5) * (x1 - x0) / nx, z = z0 + s * sh, on = ((i * 7 + s * 13 + seed * 5) % 10) / 10 < lit;
      M.block(on ? 'win_lit' : 'win_dark', x, yW + face * .04, z, w, .1, h); M.block('deco_trim', x, yW + face * .1, z - .25, w + .4, .22, .25);
    }
  }
  function slWinX(M, face, xW, y0, y1, ny, z0, storeys, sh, w, h, lit = .3, seed = 1) {
    for (let s = 0; s < storeys; s++) for (let i = 0; i < ny; i++) {
      const y = y0 + (i + .5) * (y1 - y0) / ny, z = z0 + s * sh, on = ((i * 5 + s * 11 + seed * 3) % 10) / 10 < lit;
      M.block(on ? 'win_lit' : 'win_dark', xW + face * .04, y, z, .1, w, h); M.block('deco_trim', xW + face * .1, y, z - .25, .22, w + .4, .25);
    }
  }
  const slAC = (M, pts, z) => { for (const [x, y] of pts) { M.block('metal', x, y, z, 2.4, 1.7, 1.3); M.cyl('iron', [x, y, z + 1.3], .55, .08, 8); } };
  // a wall picture on a face: face 'front' (-y), 'left' (-x), 'right' (+x); u runs left to right as seen from outside
  function slPic(M, m, face, a, b, z0, z1, d) {
    if (face === 'front') M.quad(m, [[a, d, z0], [b, d, z0], [b, d, z1], [a, d, z1]]);
    else if (face === 'right') M.quad(m, [[d, a, z0], [d, b, z0], [d, b, z1], [d, a, z1]]);
    else M.quad(m, [[d, b, z0], [d, a, z0], [d, a, z1], [d, b, z1]]);
  }
  function slShrubs(M, x, y, z, n, s = 1) { for (let k = 0; k < n; k++) blob(M, 'leaves', [x + (k - (n - 1) / 2) * .9 * s, y + Math.sin(k * 2.1) * .2, z + .4 * s], .6 * s, .55 * s, .6 * s, { amp: .25, freq: 2, seed: k + 3, segs: 7, rings: 4 }); }
  function slPlanter(M, x, y, z, L, flowers) {
    M.block('concrete', x, y, z, L, 1.3, .9); M.block('earth', x, y, z + .9, L - .3, 1.0, .05);
    slShrubs(M, x, y, z + .8, Math.max(2, Math.round(L / 1.1)), .9);
    if (flowers) for (let k = 0; k < Math.round(L); k++) M.sphere('flower_pink', [x - L / 2 + .5 + k, y - .45, z + 1.25], .18, .8, 5, 3);
  }
  // a classic sedan along x (front -x), lowered (gold spokes) or stock; paint = material
  function slCar(M, paint, low) {
    const L = 7.6, Wd = 2.7, z0 = low ? .34 : .52, hw = Wd / 2;
    M.block(paint, 0, 0, z0, L, Wd, .95); M.block(paint, .2, 0, z0 + .95, L - .6, Wd - .08, .14);
    const cz = z0 + 1.09, top = cz + 1.0, P = (x, y, z) => [x, y, z];
    const b0 = -1.2, b1 = 2.3, t0 = -.55, t1 = 1.75, wb = hw - .06, wt = hw - .32;
    M.quad(paint, [P(t0, -wt, top), P(t1, -wt, top), P(t1, wt, top), P(t0, wt, top)]);
    M.poly('glass_car', [P(b0, wb, cz), P(b0, -wb, cz), P(t0, -wt, top), P(t0, wt, top)]);           // windshield
    M.poly('glass_car', [P(b1, -wb, cz), P(b1, wb, cz), P(t1, wt, top), P(t1, -wt, top)]);           // rear window
    for (const s of [-1, 1]) M.poly('glass_car', s < 0 ? [P(b0, -wb, cz), P(b1, -wb, cz), P(t1, -wt, top), P(t0, -wt, top)] : [P(b1, wb, cz), P(b0, wb, cz), P(t0, wt, top), P(t1, wt, top)]);
    for (const x of [-2.55, 2.55]) for (const s of [-1, 1]) {
      M.tube('tire', [x, s * (hw - .42), .52], [x, s * (hw + .02), .52], .55, .55, 12);
      M.tube(low ? 'gold' : 'chrome', [x, s * (hw + .02), .52], [x, s * (hw + .05), .52], .36, .36, 10);
    }
    for (const x of [-L / 2 - .08, L / 2 + .08]) M.block('chrome', x, 0, z0 + .12, .2, Wd + .1, .3);
    for (const s of [-1, 1]) { M.block('headlamp', -L / 2 - .02, s * (hw - .45), z0 + .55, .06, .5, .3); M.block('tail', L / 2 + .02, s * (hw - .4), z0 + .5, .06, .45, .25); }
    M.block('chrome', 0, -hw - .02, z0 + .6, L - 1, .04, .08); M.block('chrome', 0, hw + .02, z0 + .6, L - 1, .04, .08);
  }
  // city filler: one quarter of a block (50 x 56), buildings round a parking lot; face -y to the street
  function slBuilding(M, fac, x, y, w, d, h, ac = 2) {
    M.block(fac, x, y, 0, w, d, h); M.block('roof_flat', x, y, h, w + .4, d + .4, .5);
    slAC(M, [...Array(ac)].map((_, k) => [x - w / 3 + k * w / (ac + 1) + 2, y + (k % 2 ? 2 : -2)]), h + .5);
  }
  // letters for the hillside sign (stroke boxes in a 6 x 9 cell)
  const SL_FONT = { H: [[0, 0, 1.3, 9], [4.7, 0, 6, 9], [0, 3.85, 6, 5.15]], O: [[0, 0, 1.3, 9], [4.7, 0, 6, 9], [0, 0, 6, 1.3], [0, 7.7, 6, 9]], L: [[0, 0, 1.3, 9], [0, 0, 6, 1.3]],
    Y: [[2.35, 0, 3.65, 4.8], ['d', 3, 4.6, .55, 9], ['d', 3, 4.6, 5.45, 9]], W: [['d', .5, 9, 1.7, 0], ['d', 1.7, 0, 3, 6.2], ['d', 3, 6.2, 4.3, 0], ['d', 4.3, 0, 5.5, 9]],
    D: [[0, 0, 1.3, 9], [0, 0, 4.4, 1.3], [0, 7.7, 4.4, 9], [4.7, 1.6, 6, 7.4], ['d', 4.2, .65, 5.35, 1.9], ['d', 4.2, 8.35, 5.35, 7.1]] };

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
    wok_house(M) { M.remap = { thatch: 'roof' }; B.sam_house(M); M.remap = null; banner(M, -3.05, -3.25 - .18, 3.4, 1.1, 2.2, 'banner_wokou'); },
    wok_house_thatch(M) { B.sam_house(M); banner(M, -3.05, -3.25 - .18, 3.4, 1.1, 2.2, 'banner_wokou'); },
    wok_trade_house(M) { M.remap = { thatch: 'roof' }; B.sam_house(M); M.remap = null; banner(M, -3.05, -3.25 - .2, 3.4, 2.1, 2.3, 'banner_board'); noren(M, 0, -3.25 - .2, 3.05, 2.4, .9, 'noren_wokou'); }, // board banner beside the door, not across it
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
    yam_house(M) { M.remap = { thatch: 'roof' }; B.sam_house(M); M.remap = null; noren(M, 0, -3.25 - .2, 3.05, 2.4, .9, 'noren_yamabushi'); banner(M, -3.05, -3.25 - .18, 3.4, 1.1, 2.2, 'banner_yamabushi'); },
    yam_house_thatch(M) { B.sam_house(M); noren(M, 0, -3.25 - .2, 3.05, 2.4, .9, 'noren_yam_dots'); banner(M, -3.05, -3.25 - .18, 3.4, 1.1, 2.2, 'banner_yamabushi'); },
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
    buke_house(M) { M.remap = { thatch: 'roof' }; B.sam_house(M); M.remap = null; noren(M, 0, -3.25 - .2, 3.05, 2.4, .9, 'noren_buke'); banner(M, -3.05, -3.25 - .18, 3.4, 1.1, 2.2, 'banner_buke'); },
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
    // a tunnel mouth for a cliff face (the Cliff Tunnels' door): dressed stone round a timber-shored opening, its rails running
    // out, lamps on brackets, the clan's noren across the top; the front faces -y, its back against the rock
    buke_tunnel_door(M) {
      const W = 3.6, D = 4.4;
      for (const s of [-1, 1]) { M.block('stone', s * (W / 2 + 1.4), 1, 0, 2.8, 2, 7.4); M.block('stone', s * (W / 2 + .15), 1.4, 0, .3, 2.8, D); }
      M.block('stone', 0, 1, D, W + .2, 2, 7.4 - D); M.block('dark', 0, 2.75, 0, W, .1, D); M.block('dark', 0, 1.4, D - .02, W, 2.8, .05); M.block('earth', 0, 1.4, -.05, W, 2.8, .06);
      for (const s of [-1, 1]) { M.block('darkwood', s * (W / 2 + .1), -.12, 0, .42, .42, D + .3); M.rod('darkwood', [s * (W / 2 + .1), -.12, D - 1], [s * (W / 2 - .7), -.12, D + .05], .12, 4); }
      M.block('darkwood', 0, -.12, D, W + 1.1, .46, .46); M.block('darkwood', 0, 1.2, D - .35, W, .4, .35);
      for (const s of [-1, 1]) { M.rod('iron', [s * .45, 2.7, .12], [s * .45, -2.6, .12], .05, 4); for (let k = 0; k < 7; k++) M.block('darkwood', 0, 2.4 - k * .8, 0, 1.4, .25, .1); }
      for (const s of [-1, 1]) { M.rod('iron', [s * 2.7, -.1, 4.6], [s * 2.7, -.55, 4.6], .04, 4); lantern(M, s * 2.7, -.6, 4.55, .26); }
      noren(M, 0, -.36, D - .06, W - .2, 1.1, 'noren_buke');
    },
    // a deck hatch (the Ship Hold's door): the coaming on the deck (1.05 above the waterline, as the ship's own deck), the cover
    // standing open on its hinges at the far edge, the ladder's top poking up out of the dark; floats with the ship
    wok_hatch(M) {
      const z = 1.05, w = 1.7;
      for (const sd of [-1, 1]) { M.block('darkwood', sd * (w / 2 + .1), 0, z, .2, w + .4, .32); M.block('darkwood', 0, sd * (w / 2 + .1), z, w, .2, .32); }
      M.quad('dark', [[-w / 2, -w / 2, z + .03], [w / 2, -w / 2, z + .03], [w / 2, w / 2, z + .03], [-w / 2, w / 2, z + .03]]);
      M.box('wood', [0, w / 2 + .25 + .34 * w / 2, z + .3 + .94 * w / 2], [w, .1, w], 0, -.35); for (const t of [-.5, .5]) M.box('iron', [t * w * .6, w / 2 + .32 + .34 * w / 2, z + .3 + .94 * w / 2], [.1, .04, w * .9], 0, -.35);
      for (const sd of [-1, 1]) M.rod('wood', [sd * .45, -.25, z - .2], [sd * .45, .05, z + .8], .05, 4); M.rod('wood', [-.45, -.13, z + .42], [.45, -.13, z + .42], .035, 3);
      M.rod('rope', [w / 2 + .1, w / 2 + .1, z + .32], [w / 2 + .05, w / 2 + .5, z + 1.75], .02, 3);
    },
    // a plank wall closing the land end of the boat shed, with the Boat Shed's door (a lit recess), a lantern and the Wokou noren;
    // front faces -y; it stands between the shed's end posts (9 m), on the shed's stone base
    wok_shed_wall(M) {
      const W = 9, H = 4.5, DW = 2.6, DH = 3.6;
      for (const sd of [-1, 1]) M.block('wood', sd * (W + DW) / 4, 0, .3, (W - DW) / 2, .2, H - .3);
      M.block('wood', 0, 0, DH + .3, DW, .2, H - DH - .3);
      for (let x = -W / 2 + .5; x < W / 2; x += .5) if (Math.abs(x) > DW / 2 + .15) M.block('darkwood', x, -.11, .3, .04, .02, H - .3);
      recess(M, 0, -.1, .3, DW, DH, .6);
      for (const sd of [-1, 1]) M.block('darkwood', sd * (DW / 2 + .1), -.15, .3, .2, .3, DH + .1); M.block('darkwood', 0, -.15, DH + .3, DW + .6, .3, .25);
      noren(M, 0, -.32, DH + .25, DW - .2, 1, 'noren_wokou'); lantern(M, DW / 2 + .7, -.4, 3.3, .26); M.rod('iron', [DW / 2 + .7, -.1, 3.9], [DW / 2 + .7, -.4, 3.9], .03, 3);
    },
    // a cellar door in the storehouse floor (the Stores' door): a sloped timber hatch box, both leaves thrown open on the ground,
    // the dark hole with the top steps showing, a post lantern by it; the high end is +y
    war_cellar_door(M) {
      const W = 2.2, L = 2.6, h0 = .3, h1 = 1, sl = Math.hypot(L, h1 - h0);
      for (const sd of [-1, 1]) M.poly('darkwood', [[sd * W / 2, -L / 2, 0], [sd * W / 2, L / 2, 0], [sd * W / 2, L / 2, h1], [sd * W / 2, -L / 2, h0]]);
      M.block('darkwood', 0, L / 2 - .07, 0, W, .14, h1); M.block('darkwood', 0, -L / 2 + .07, 0, W, .14, h0);
      M.quad('dark', [[-W / 2 + .05, -L / 2 + .14, .22], [W / 2 - .05, -L / 2 + .14, .22], [W / 2 - .05, L / 2 - .14, .22], [-W / 2 + .05, L / 2 - .14, .22]]);
      for (let k = 0; k < 3; k++) M.block('stone', 0, -L / 2 + .5 + k * .55, .22, W - .2, .08, .04 - k * .01);
      for (const sd of [-1, 1]) { M.block('wood', sd * (W / 2 + W / 4 + .06), 0, 0, W / 2, sl, .1); for (const t of [-.3, .3]) M.block('iron', sd * (W / 2 + W / 4 + .06), t * sl, .1, W / 2 - .1, .08, .02); M.block('iron', sd * (W / 2 + .4), 0, .1, .08, .3, .05); }
      piece(M, 'buke_post_lantern', W / 2 + .5, L / 2 + .4, 0);
    },
    // a heavy iron-banded door for the forge's back wall (the Armory's): timber frame, the cracked circle on a plaque over it, a
    // torch bracket; front faces -y, its back against the wall
    war_armory_door(M) {
      const W = 2.4, H = 4.2;
      for (const sd of [-1, 1]) M.block('darkwood', sd * (W / 2 + .15), -.15, 0, .3, .3, H + .3); M.block('darkwood', 0, -.15, H, W + .6, .3, .3);
      M.block('wood', 0, -.06, 0, W, .12, H); for (const z of [.6, 2.1, 3.6]) M.block('iron', 0, -.14, z, W, .04, .16); for (let x = -W / 2 + .3; x < W / 2; x += .4) M.block('darkwood', x, -.13, 0, .02, .02, H);
      M.tube('iron', [.7, -.2, 2], [.7, -.24, 2], .14, .14, 10, false); M.sphere('iron', [.7, -.16, 2], .06, 1, 6, 3);
      M.block('darkwood', 0, -.1, H + .45, 1.3, .1, 1.3); M.quad('mark_warrior', [[-.55, -.16, H + .5], [.55, -.16, H + .5], [.55, -.16, H + 1.6], [-.55, -.16, H + 1.6]]);
      M.rod('iron', [-W / 2 - .6, -.05, 3.2], [-W / 2 - .6, -.4, 3.2], .03, 3); M.cyl('iron', [-W / 2 - .6, -.45, 3.2], .14, .2, 6, .2); flame(M, -W / 2 - .6, -.45, 3.4, .25);
    },
    // a dojo's inner door (the Forest Dojo room's, on the back wall inside the forest dojo): a dark frame, two lit shoji
    // panels with the right one slid across onto a warm doorway, the Rebel emblem on a board above, a paper lantern hung
    // from each post (it fits a 3.4 m bay); front faces -y
    hub_inner_door(M) {
      const W = 2.6, H = 3.4, O = .35; // O: how far the slid panel passes the middle
      recess(M, (O + W / 2) / 2, -.04, .12, W / 2 - O, H - .1, .8);
      M.block('darkwood', 0, -.12, 0, W + .56, .5, .12);
      for (const sd of [-1, 1]) M.block('darkwood', sd * (W / 2 + .14), -.12, 0, .28, .5, H + .3);
      M.block('darkwood', 0, -.12, H + .02, W + .56, .5, .3);
      M.block('shoji', -W / 4, -.2, .12, W / 2, .05, H - .1);          // the left panel, front track
      M.block('shoji', -W / 4 + O, -.08, .12, W / 2, .05, H - .1);     // the right one slid left behind it
      for (const [x, y] of [[-W / 4, -.23], [-W / 4 + O, -.11]]) for (let k = 1; k < 4; k++) M.block('darkwood', x - W / 4 + k * W / 8, y, .12, .03, .02, H - .1);
      M.block('darkwood', 0, -.16, H + .42, 1.3, .1, 1.3); M.quad('emblem_rebel', [[-.55, -.22, H + .47], [.55, -.22, H + .47], [.55, -.22, H + 1.57], [-.55, -.22, H + 1.57]]);
      for (const sd of [-1, 1]) { const x = sd * (W / 2 + .14); M.rod('darkwood', [x, -.37, 3.3], [x, -.64, 3.3], .03, 3); lantern(M, x, -.64, 2.7, .2); }
    },
    // the game hall's back-room door (the Game Hall's): a purple arched door with a pumpkin lamp either side; front faces -y
    cc_hall_door(M) {
      archDoor(M, 0, -.02, 0, 2.4, 3.6); M.poly('roof_purple', archPts(0, -.04, .3, 2, 2.6)); for (const z of [1.1, 2]) M.box('iron', [0, -.07, z], [2.1, .03, .08]);
      for (const sd of [-1, 1]) { M.rod('iron', [sd * 1.7, 0, 2.6], [sd * 1.7, -.4, 2.6], .03, 3); ccPumpkin(M, sd * 1.7, -.45, 2.2, .26, 0); }
      M.quad('sign_dice', [[-.9, -.06, 3.75], [.9, -.06, 3.75], [.9, -.06, 4.7], [-.9, -.06, 4.7]]);
    },
    // a back door of a Chumpz shop: a plank door in a frame with a sign board over it (lounge / casino / back store)
    chz_lounge_door(M) { chzDoor(M, 'tiki_mask', 'plank_teal'); },
    chz_casino_door(M) { chzDoor(M, 'sign_chzdice', 'plank_red'); },
    chz_store_door(M) { chzDoor(M, 'sign_fishbook', 'plank_yellow'); },
    // a companionway hatch on a sailboat's stern deck (the Ship Cabin's door): a little doghouse with its door, floats with the boat
    chz_cabin_hatch(M) {
      const z = .3; M.block('plank_red', 0, 0, z, 1.6, 1.2, 1.1); M.box('wood', [0, 0, z + 1.2], [1.8, 1.4, .1], 0, .12);
      M.block('darkwood', 0, -.61, z + .05, .9, .02, .9); M.block('brass', .3, -.63, z + .5, .06, .02, .06); chzLantern(M, .65, -.7, z + 1.5);
    },
    // the custom shop's door in the garage's back wall (the Garage's): a steel door, a red light, the neon OPEN over it
    sl_shop_door(M) {
      const W = 2.4, H = 4.2; M.block('metal', 0, -.06, 0, W + .4, .12, H + .3); M.block('dark_panel', 0, -.14, .05, W, .04, H); for (const z of [1.4, 2.8]) M.block('metal', 0, -.17, z, W, .02, .06);
      M.rod('chrome', [.8, -.22, 1.6], [.8, -.22, 2.4], .04, 5); M.sphere('paint_red', [0, -.2, H + .45], .14, 1, 8, 4); M.quad('neon_open', [[-1.4, -.18, H + .7], [1.4, -.18, H + .7], [1.4, -.18, H + 1.75], [-1.4, -.18, H + 1.75]]);
    },
    buke_post_lantern(M) {
      M.block('darkwood', 0, 0, 0, .22, .22, 1.35); M.block('lantern', 0, 0, 1.35, .36, .36, .42); M.block('darkwood', 0, 0, 1.77, .5, .5, .08);
      M.cyl('darkwood', [0, 0, 1.85], .3, .2, 4, .04);
      M.quad('glow', [[-1.8, -1.8, .07], [1.8, -1.8, .07], [1.8, 1.8, .07], [-1.8, 1.8, .07]]);
    },
    // boarding plank from a pier (top end, deck level) down 2 m to a ship's deck; 5 m long along y
    wok_gangplank(M) {
      const a = Math.atan2(2, 5);
      M.box('wood', [0, 0, -1.06], [1.1, Math.hypot(5, 2), .12], 0, -a);
      for (let i = 0; i < 9; i++) { const t = (i + .5) / 9; M.box('darkwood', [0, -2.5 + 5 * t, -2 * t - .97], [1.1, .08, .06], 0, -a); }
      for (const sd of [-1, 1]) { for (const t of [0, .5, 1]) M.block('darkwood', sd * .6, -2.5 + 5 * t, -2 * t - 1, .08, .08, 1); M.rod('rope', [sd * .6, -2.5, .95], [sd * .6, 2.5, -1.05], .025, 4); }
    },
    // ── Kenshi (swordmasters): dark wood, white plaster, grey tile, teal + gold banners with the blade emblem ──
    kenshi_great_dojo(M) { M.remap = { red: 'darkwood', banner_red: 'banner_kenshi' }; B.sam_great_dojo(M); M.remap = null; noren(M, 0, -15 / 2 + 2.05, 5.45, 5.6, 1.5, 'noren_kenshi'); },
    kenshi_library(M) { M.remap = { noren_yam_books: 'noren_kenshi_scroll', banner_yamabushi: 'banner_kenshi' }; B.yam_library(M); },
    kenshi_hall(M) { M.remap = { banner_navy: 'banner_kenshi' }; B.sam_library(M); M.remap = null; noren(M, 0, -9 / 2 - .22, 5.3, 4.2, 1.3, 'noren_kenshi_map'); },
    kenshi_house(M) { M.remap = { thatch: 'roof' }; B.sam_house(M); M.remap = null; noren(M, 0, -3.25 - .2, 3.05, 2.4, .9, 'noren_kenshi'); banner(M, -3.05, -3.25 - .18, 3.4, 1.1, 2.2, 'banner_kenshi'); },
    kenshi_gate(M) { M.remap = { red: 'darkwood', banner_red: 'banner_kenshi' }; B.sam_gate(M); M.remap = null; noren(M, 0, -1.3, 5.1, 5, 1.7, 'noren_kenshi'); },
    kenshi_forge(M) { M.remap = { thatch: 'roof', banner_gold: 'banner_kenshi' }; B.sam_forge(M); },
    kenshi_banner_pole(M) { M.remap = { banner_red: 'banner_kenshi' }; B.sam_banner_pole(M); },
    // well under a hexagonal tiled pavilion with a gold finial, on a stone base with buckets
    kenshi_well_pavilion(M) {
      M.cyl('stone', [0, 0, 0], 3.6, .35, 6); M.cyl('stone', [0, 0, .35], 1.25, .9, 14); M.cyl('water', [0, 0, .55], 1.02, .72, 14);
      for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + Math.PI / 6; M.block('darkwood', Math.cos(a) * 2.7, Math.sin(a) * 2.7, .35, .24, .24, 3.2); }
      M.cyl('darkwood', [0, 0, 3.45], 3.1, .3, 6); M.cyl('roof', [0, 0, 3.75], 3.9, 2.1, 6, .2); M.cyl('darkwood', [0, 0, 3.6], 4, .18, 6);
      M.sphere('gold', [0, 0, 6.05], .3, 1.2, 8, 5); M.cyl('gold', [0, 0, 5.8], .1, .3, 6);
      M.box('wood', [0, 0, 2.6], [2.8, .16, .16]); M.cyl('rope', [0, 0, 1.4], .03, 1.2, 4); M.cyl('darkwood', [0, 0, 1.2], .22, .3, 8);
      for (const [x, y] of [[1.9, -1.4], [-2.1, -1.1], [2.2, 1.2], [-1.6, 1.8]]) { M.cyl('wood', [x, y, .35], .3, .5, 8, .26); M.cyl('darkwood', [x, y, .78], .31, .05, 8); }
    },
    // watchtower: a tapered stone base with a door, the lookout room on top under a tiled roof
    kenshi_watchtower(M) {
      const S = 5.4, H = 7;
      M.cyl('stone', [0, 0, 0], S * .72, H, 4, S * .62); M.quad('dark', [[-.6, -S * .48, .1], [.6, -S * .48, .1], [.6, -S * .46, 2.2], [-.6, -S * .46, 2.2]]);
      M.block('wood', 0, 0, H, S + .6, S + .6, .3);
      for (const x of [-S / 2, S / 2]) for (const y of [-S / 2, S / 2]) M.block('darkwood', x, y, H + .3, .22, .22, 2.6);
      for (const [x, y, sx, sy] of [[0, -S / 2, S, .12], [0, S / 2, S, .12], [-S / 2, 0, .12, S], [S / 2, 0, .12, S]]) { M.block('darkwood', x, y, H + .9, sx, sy, .12); M.block('darkwood', x, y, H + 1.25, sx, sy, .12); }
      M.roof(0, 0, H + 2.9, S + 2.4, S + 2.4, 1.9, { lift: .6 });
      banner(M, 0, -S / 2 - .1, H + 2.6, 1.2, 1, 'banner_kenshi'); lantern(M, S / 2, -S / 2, H + 2.75, .22);
    },
    // wall-top fence, 8 m: stone pillars with a dark wood lattice between (for the compound walls)
    kenshi_wall_fence(M) {
      for (const x of [-4, 0, 4]) { M.block('stone', x, 0, 0, .7, .7, 1.6); M.block('stone', x, 0, 1.6, .85, .85, .14); }
      for (const z of [.35, 1.25]) for (const h of [-1, 1]) M.box('darkwood', [h * 2, 0, z], [3.3, .14, .12]);
      for (let i = 0; i < 14; i++) { const x = -3.3 + i * (6.6 / 13); if (Math.abs(x) < .4) continue; M.block('darkwood', x, 0, .35, .07, .07, .9); }
    },
    // ── Sohei (monastic warriors): dark wood, white plaster, grey tile, gold + cream banners with the cross-and-sun ──
    sohei_great_dojo(M) { M.remap = { red: 'darkwood', banner_red: 'banner_sohei' }; B.sam_great_dojo(M); M.remap = null; noren(M, 0, -15 / 2 + 2.05, 5.45, 5.6, 1.5, 'noren_sohei'); },
    sohei_library(M) { M.remap = { noren_yam_books: 'noren_sohei_books', banner_yamabushi: 'banner_sohei' }; B.yam_library(M); },
    sohei_hall(M) { M.remap = { banner_navy: 'banner_sohei' }; B.sam_library(M); M.remap = null; noren(M, 0, -9 / 2 - .22, 4.0, 3.2, 1.2, 'noren_sohei_dots'); },
    sohei_house(M) { M.remap = { thatch: 'roof' }; B.sam_house(M); M.remap = null; noren(M, 0, -3.25 - .2, 3.05, 2.4, .9, 'noren_sohei'); banner(M, -3.05, -3.25 - .18, 3.4, 1.1, 2.2, 'banner_sohei'); },
    sohei_shop(M) { M.remap = { thatch: 'roof' }; B.sam_house(M); M.remap = null; banner(M, -3.05, -3.25 - .2, 3.4, 2.1, 2.3, 'banner_board'); noren(M, 0, -3.25 - .2, 3.05, 2.4, .9, 'noren_sohei'); }, // board banner beside the door, not across it
    sohei_gate(M) { M.remap = { red: 'darkwood', banner_red: 'banner_sohei' }; B.sam_gate(M); M.remap = null; noren(M, 0, -1.3, 5.1, 5, 1.7, 'noren_sohei'); },
    sohei_banner_pole(M) { M.remap = { banner_red: 'banner_sohei' }; B.sam_banner_pole(M); },
    // compound wall, 8 m: white plaster between dark posts on a low stone plinth, under a tiled coping
    sohei_wall(M) {
      M.block('stone', 0, 0, 0, 8, .9, .5); M.block('plaster', 0, 0, .5, 8, .55, 2.3);
      for (const x of [-4, -2, 0, 2, 4]) M.block('darkwood', x, 0, .5, .2, .62, 2.3);
      M.block('darkwood', 0, 0, 2.8, 8.1, .66, .16);
      M.roof(0, 0, 2.95, 8.6, 1.5, .45, { lift: .05, gable: false, ornaments: false });
    },
    // bell tower: a stone base, four posts and a tiled roof over a big bronze bell with a log striker
    sohei_bell_tower(M) {
      M.block('stone', 0, 0, 0, 6, 6, 1.2); steps(M, 0, -3, 1.2, 2.4, 3);
      for (const x of [-2.2, 2.2]) for (const y of [-2.2, 2.2]) M.block('darkwood', x, y, 1.2, .3, .3, 4.4);
      for (const y of [-2.2, 2.2]) M.box('darkwood', [0, y, 5.5], [5, .3, .3]); for (const x of [-2.2, 2.2]) M.box('darkwood', [x, 0, 5.5], [.3, 5, .3]);
      M.box('darkwood', [0, 0, 5.2], [4.8, .25, .25]);
      M.roof(0, 0, 5.75, 7.4, 7.4, 2.4, { lift: .7 });
      M.cyl('bronze', [0, 0, 2.1], .95, 2.4, 16, .78); M.cyl('bronze', [0, 0, 4.5], .62, .3, 12, .2); M.cyl('bronze', [0, 0, 2.05], 1.0, .12, 16);
      M.rod('rope', [0, 0, 4.75], [0, 0, 5.15], .05, 4);
      M.rod('bark', [-2.1, -1.6, 2.9], [-.9, -1.6, 2.9], .16, 7); for (const x of [-2, -1.1]) M.rod('rope', [x, -1.6, 2.95], [x, -1.6, 5.1], .02, 3);
    },
    // stairs (see STAIRS below): built at their placed size, so stretched stairs keep ~0.3 m steps
    kit_stairs_stone(M) { buildStairs(M, 'kit_stairs_stone'); },
    kit_stairs_wood(M) { buildStairs(M, 'kit_stairs_wood'); },
    kit_stairs_cliff(M) { buildStairs(M, 'kit_stairs_cliff'); },
    // ── Ashigaru (foot soldiers' round fort): white plaster and timber, dark tile and thatch, sharpened stakes,
    //    crimson + gold banners with the sprout emblem ──
    // great dojo on a stone plinth: open front between red curtains, a black hanging with the emblem in the doorway
    ashi_great_dojo(M) {
      const W = 24, D = 15, Z = 1.4;
      M.block('stone', 0, 0, 0, W + 1.6, D + 1.6, Z); steps(M, 0, -(D + 1.6) / 2, Z, 8, 4); M.block('wood', 0, 0, Z, W + .8, D + .8, .12);
      walls(M, 0, 0, Z + .12, W, D, 5.4, { door: [7, 4.4], windows: [['left', -3, Z + 2.2, 3, 1.6], ['left', 3, Z + 2.2, 3, 1.6], ['right', -3, Z + 2.2, 3, 1.6], ['right', 3, Z + 2.2, 3, 1.6], ['back', -7, Z + 2.2, 3, 1.6], ['back', 7, Z + 2.2, 3, 1.6]] });
      M.quad('ashi_door', [[-2.2, -D / 2 + 1.2, Z + .3], [2.2, -D / 2 + 1.2, Z + .3], [2.2, -D / 2 + 1.2, Z + 4.4], [-2.2, -D / 2 + 1.2, Z + 4.4]]);
      for (const sd of [-1, 1]) { // red curtains gathered to the sides of the opening
        M.quad('cloth', [[sd * 3.5, -D / 2 - .2, Z + 4.45], [sd * 1.7, -D / 2 - .25, Z + 4.45], [sd * 2.9, -D / 2 - .3, Z + 1.6], [sd * 3.5, -D / 2 - .22, Z + .4]]);
        M.quad('cloth', [[sd * 3.5, -D / 2 - .22, Z + .4], [sd * 2.9, -D / 2 - .3, Z + 1.6], [sd * 3.2, -D / 2 - .26, Z + .3], [sd * 3.5, -D / 2 - .2, Z + .3]]);
      }
      M.quad('cloth', [[-3.6, -D / 2 - .24, Z + 4.5], [3.6, -D / 2 - .24, Z + 4.5], [3.6, -D / 2 - .24, Z + 3.8], [-3.6, -D / 2 - .24, Z + 3.8]]);
      for (const sd of [-1, 1]) for (const x of [6, 9.6]) banner(M, sd * x, -D / 2 - .18, Z + 4.9, 2, 3.6, 'banner_ashigaru');
      M.roof(0, 0, Z + 5.5, W + 3.6, D + 3.6, 3.6, { lift: .8 });
      for (const sd of [-1, 1]) lantern(M, sd * 4.4, -D / 2 - .6, Z + 4.6);
      for (const sd of [-1, 1]) { M.block('wood', sd * 6.4, -D / 2 - 1.9, 0, 1, .8, .8); M.block('wood', sd * 6.6, -D / 2 - 1.8, .8, .8, .6, .6); M.cyl('wood', [sd * 7.6, -D / 2 - 1.5, 0], .35, .8, 10); }
    },
    // long hall (archive / strategy hall): plaster and timber on a stone base, a big banner beside the lit doorway
    ashi_archive(M) { ashiHall(M, 'banner_ashi_scroll', -1); },
    ashi_strategy_hall(M) { ashiHall(M, 'banner_ashi_board', 1); },
    ashi_house(M) { B.sam_house(M); noren(M, 0, -3.25 - .2, 3.05, 2.4, .9, 'noren_ashigaru'); },
    ashi_house_tile(M) { M.remap = { thatch: 'roof' }; B.sam_house(M); M.remap = null; noren(M, 0, -3.25 - .2, 3.05, 2.4, .9, 'noren_ashigaru'); banner(M, -3.05, -3.25 - .18, 3.4, 1.1, 2.2, 'banner_ashigaru'); },
    ashi_house_brown(M) { M.remap = { thatch: 'roof_brown' }; B.sam_house(M); M.remap = null; noren(M, 0, -3.25 - .2, 3.05, 2.4, .9, 'noren_ashigaru'); },
    ashi_watchtower(M) { M.remap = { banner_red: 'banner_ashigaru' }; B.sam_watchtower(M); M.remap = null; banner(M, 0, -2.1, 7.6, 1.8, 3.4, 'banner_ashigaru'); },
    ashi_banner_pole(M) { M.remap = { banner_red: 'banner_ashigaru' }; B.sam_banner_pole(M); },
    // gate between two square towers (stone base, timber walls with a big banner, gallery, tiled roof); a roofed
    // gateway with open doors between them
    ashi_gate(M) {
      const OW = 6, S = 4.6, H = 7.4;
      for (const sd of [-1, 1]) {
        const x = sd * (OW / 2 + S / 2 + .2);
        M.block('stone', x, 0, 0, S + .5, S + .5, 1.6);
        for (const px of [-1, 1]) for (const py of [-1, 1]) M.block('darkwood', x + px * (S / 2 - .15), py * (S / 2 - .15), 1.6, .3, .3, H - 1.6);
        for (const [cx, cy, sx, sy] of [[x, -S / 2 + .15, S - .3, .2], [x, S / 2 - .15, S - .3, .2], [x - S / 2 + .15, 0, .2, S - .3], [x + S / 2 - .15, 0, .2, S - .3]]) { M.block('wood', cx, cy, 1.6, sx, sy, H - 2.8); M.block('darkwood', cx, cy, 1.6 + (H - 2.8) / 2, sx + .06, sy + .06, .18); }
        M.block('wood', x, 0, H - 1.2, S + 1, S + 1, .25);
        for (const [cx, cy, sx, sy] of [[x, -(S + 1) / 2, S + 1, .12], [x, (S + 1) / 2, S + 1, .12], [x - (S + 1) / 2, 0, .12, S + 1], [x + (S + 1) / 2, 0, .12, S + 1]]) { M.block('darkwood', cx, cy, H - .55, sx, sy, .12); M.block('darkwood', cx, cy, H - .95, sx, sy, .1); }
        for (const px of [-1, 1]) for (const py of [-1, 1]) M.block('darkwood', x + px * (S + .8) / 2, py * (S + .8) / 2, H - 1, .16, .16, 2.2);
        M.roof(x, 0, H + 1.1, S + 2.6, S + 2.6, 1.9, { lift: .5, ornaments: false });
        banner(M, x, -S / 2 - .05, H - 1.5, 2.4, 3.6, 'banner_ashigaru');
        lantern(M, x - sd * (S / 2 + .3), -S / 2 - .3, H - 1.3, .24);
      }
      for (const sd of [-1, 1]) for (const y of [-1.3, 1.3]) M.block('darkwood', sd * (OW / 2 + .1), y, 0, .4, .4, 5.4);
      for (const y of [-1.3, 1.3]) M.box('darkwood', [0, y, 5.2], [OW + 1, .4, .4]);
      M.block('wood', 0, 0, 5.4, OW + 1.2, 3.2, .3);
      for (const sd of [-1, 1]) M.block('wood', sd * (OW / 2 - .15), 2.75, 0, .2, 2.7, 4.6); // doors swung open, back against the towers
      M.roof(0, 0, 5.75, OW + 2.6, 4.6, 1.8, { lift: .6 });
      noren(M, 0, -1.55, 5.15, OW - .4, 1.2, 'noren_ashigaru');
    },
    // 8 m of palisade: sharpened stakes, two rails and raking props on the inside (+y); outside faces -y
    ashi_palisade(M) { ashiPalisade(M, false); },
    ashi_palisade_banner(M) { ashiPalisade(M, true); },
    // plank bridge over the moat, 20 m: rises 2.4 m from the outer bank (-y end, at the origin) to the gate
    ashi_bridge(M) {
      const L = 20, Wd = 3.4, H = 2.4, a = Math.atan2(H, L), Ls = Math.hypot(L, H), zAt = y => H * (y + L / 2) / L;
      M.box('wood', [0, 0, H / 2 - .13], [Wd, Ls, .26], 0, a);
      for (let i = 0; i < 46; i++) { const y = -L / 2 + .25 + i * (L - .5) / 45; M.box('darkwood', [0, y, zAt(y) + .005], [Wd, .05, .03], 0, a); }
      for (const sd of [-1, 1]) M.box('darkwood', [sd * (Wd / 2 - .1), 0, H / 2 - .45], [.24, Ls, .32], 0, a);
      for (let i = 0; i <= 8; i++) {
        const y = -L / 2 + .3 + i * (L - .6) / 8, z = zAt(y);
        for (const sd of [-1, 1]) { M.block('darkwood', sd * (Wd / 2 + .06), y, z - .4, .2, .2, 1.6); M.cyl('darkwood', [sd * (Wd / 2 + .06), y, z + 1.2], .1, .08, 6, .03); }
        if (i > 1 && i < 8) for (const sd of [-1, 1]) M.block('darkwood', sd * (Wd / 2 - .3), y, -4.2, .3, .3, z + 4); // piles down into the ditch
      }
      for (const sd of [-1, 1]) for (const dz of [1.1, .6]) M.rod('wood', [sd * (Wd / 2 + .06), -L / 2 + .3, zAt(-L / 2 + .3) + dz], [sd * (Wd / 2 + .06), L / 2 - .3, zAt(L / 2 - .3) + dz], .06, 5);
    },
    // open workshop shed: thatched roof on posts, a workbench with tools, a log pile, a sawhorse
    ashi_workshop(M) {
      const W = 10, D = 7;
      M.block('earth', 0, 0, 0, W + .6, D + .6, .12);
      for (const x of [-W / 2 + .3, 0, W / 2 - .3]) for (const y of [-D / 2 + .3, D / 2 - .3]) M.block('wood', x, y, 0, .32, .32, y < 0 ? 3.6 : 3.3);
      for (const y of [-D / 2 + .3, D / 2 - .3]) M.box('wood', [0, y, y < 0 ? 3.6 : 3.3], [W + .4, .3, .3]);
      M.roof(0, 0, 3.6, W + 2.6, D + 2.6, 2.6, { lift: .3, mat: 'thatch', fascia: 'darkwood', ornaments: false, gable: false });
      M.block('wood', 0, D / 2 - .3, 0, W - .6, .2, 2); // back wall boards
      M.block('wood', -1.5, 1.6, 0, 4, 1.1, .9); M.block('darkwood', -1.5, 1.6, .9, 4.2, 1.2, .1);
      for (let i = 0; i < 5; i++) M.rod('iron', [-3.2 + i * .45, D / 2 - .45, 1.1], [-3.2 + i * .45, D / 2 - .45, 1.8], .03, 4);
      M.block('iron', -.6, 1.5, 1, .9, .35, .25); M.cyl('wood', [-2.6, 1.6, 1], .2, .35, 8);
      ashiLogs(M, 2.6, .8, 0, 3.4, 3);
      for (const sd of [-1, 1]) for (const x of [-1, 1]) M.rod('wood', [-3.2 + x * .7, -1.8 + sd * .45, 0], [-3.2 + x * .7, -1.8 - sd * .2, .9], .07, 5);
      M.box('wood', [-3.2, -1.8, .85], [2.2, .25, .25]);
      ashiLogs(M, W / 2 + 1.2, -1, 0, 3, 2);
    },
    ashi_log_pile(M) { ashiLogs(M, 0, 0, 0, 4, 3); },
    // cheval de frise: a log with crossed sharpened stakes, 3.4 m
    ashi_barricade(M) {
      M.rod('bark', [-1.7, 0, .75], [1.7, 0, .75], .18, 8);
      for (let i = 0; i < 4; i++) { const x = -1.35 + i * .9; for (const sd of [-1, 1]) { M.rod('wood', [x, -sd * .9, 0], [x, sd * .7, 1.5], .07, 5); M.cyl('wood', [x, sd * .7, 1.5], .07, 0, 5, .01); } }
    },
    // short fence of sharpened stakes, 3 m
    ashi_stake_fence(M) {
      for (let i = 0; i < 9; i++) { const x = -1.35 + i * .34, h = 1.4 + .15 * Math.sin(i * 2.1); M.cyl('wood', [x, 0, 0], .15, h, 6); M.cyl('wood', [x, 0, h], .15, .35, 6, .01); }
      for (const z of [.45, 1.05]) M.box('darkwood', [0, .12, z], [3, .08, .12]);
    },
    // archery target: a straw roll on a stand
    ashi_target(M) {
      for (const sd of [-1, 1]) M.rod('wood', [sd * .7, .35, 0], [sd * .4, 0, 1.9], .06, 5);
      M.rod('wood', [0, .7, 0], [0, .08, 1.7], .06, 5);
      M.tube('straw', [0, -.08, 1.25], [0, .12, 1.25], .62, .62, 16);
      for (const [r, m, k] of [[.46, 'red', 1], [.3, 'plaster', 2], [.14, 'red', 3]]) M.tube(m, [0, -.08 - .005 * k, 1.25], [0, -.085 - .005 * k, 1.25], r, r, 16);
    },
    // ── Ronin (the forgotten clan): dark timber, aged plaster, charcoal tile, grey granite; crimson banners ──
    // the dojo (Miguel's image 2): a U of halls round an open training floor with the emblem inlaid, a railing and
    // central stairs at the front, weapon racks, heavy bags, an altar at the back. 30 x 24 m; front faces -y
    ronin_great_dojo(M) {
      M.remap = { plaster: 'plaster_old' };
      const Z = 1.6, W = 30, D = 24;
      M.block('stone', 0, 0, 0, W, D, Z); steps(M, 0, -D / 2, Z, 9, 5); // granite platform, stairs at the front
      M.block('slate', 0, -1.6, Z, 18, 15, .08); M.quad('ronin_floor', [[-6.5, -8.5, Z + .1], [6.5, -8.5, Z + .1], [6.5, 4.5, Z + .1], [-6.5, 4.5, Z + .1]]);
      // back hall and the two wings
      walls(M, 0, 8.5, Z, W - .4, 6.6, 5.2, { door: [4, 3.6], windows: [['front', -9, Z + 1.6, 3.4, 1.8], ['front', 9, Z + 1.6, 3.4, 1.8], ['back', -8, Z + 1.6, 3, 1.6], ['back', 8, Z + 1.6, 3, 1.6]] });
      for (const sd of [-1, 1]) walls(M, sd * 12, -3.4, Z, 5.8, 17, 4.6, { windows: [[sd < 0 ? 'right' : 'left', -3, Z + 1.4, 3, 1.6], [sd < 0 ? 'right' : 'left', 3.5, Z + 1.4, 3, 1.6], [sd < 0 ? 'left' : 'right', 0, Z + 1.4, 3, 1.6]] });
      M.remap = null;
      M.roof(0, 8.5, Z + 5.2, W + 2.6, 9.4, 3.2, { lift: .8 });
      for (const sd of [-1, 1]) M.roof(sd * 12, -3.6, Z + 4.6, 8.6, 19.6, 2.6, { lift: .6, ornaments: false });
      // the open floor: posts, a railing along the front with a gap for the stairs, the altar, racks, bags
      for (const x of [-8.6, -4.3, 0, 4.3, 8.6]) M.block('darkwood', x, 5.1, Z, .4, .4, 5.2);
      for (const sd of [-1, 1]) { for (const y of [-10.6, -6, -1.4, 3]) M.block('darkwood', sd * 8.85, y, Z, .36, .36, 4.6); M.box('darkwood', [sd * 8.85, -3.8, Z + 4.4], [.3, 15, .35]); }
      for (const sd of [-1, 1]) { for (const x of [5, 8.5]) { M.block('darkwood', sd * x, -11.6, Z, .24, .24, 1.15); M.cyl('iron', [sd * x, -11.6, Z + 1.15], .16, .12, 4, .1); } M.box('darkwood', [sd * 6.75, -11.6, Z + .95], [3.6, .14, .14]); M.box('darkwood', [sd * 6.75, -11.6, Z + .45], [3.6, .1, .1]); }
      M.block('darkwood', 0, 4.2, Z, 4.2, 1.4, .9); M.block('wood', 0, 4.2, Z + .9, 4.6, 1.6, .12); M.cyl('darkwood', [0, 4.2, Z + 1], .6, .45, 10); // altar with the drum
      for (const sd of [-1, 1]) { lantern(M, sd * 2.6, 4.4, Z + 1.6, .2); M.block('stone', sd * 2.6, 4.4, Z, .4, .4, 1); }
      for (const [x, y] of [[-7.8, -6], [-7.8, -1.5], [7.8, -6], [7.8, -1.5]]) { M.block('darkwood', x, y, Z, .5, 2.4, .12); for (let i = 0; i < 5; i++) M.rod('wood', [x, y - .9 + i * .45, Z + .1], [x - Math.sign(x) * .1, y - .9 + i * .45, Z + 2.4], .04, 4); }
      for (const [x, y] of [[-6.4, -8.8], [6.4, -8.8], [-6.4, 2.2], [6.4, 2.2]]) { M.rod('rope', [x, y, Z + 4.4], [x, y, Z + 3.2], .03, 4); M.cyl('cloth', [x, y, Z + 1.1], .32, 2.1, 10); M.cyl('darkwood', [x, y, Z + 3.1], .34, .12, 10); }
      banner(M, 0, 5.15 - .25, Z + 5, 2.8, 3.4, 'banner_ronin');
      for (const sd of [-1, 1]) { banner(M, sd * (W / 2 + .02), -3.4, Z + 4.2, 2, 3.2, 'banner_ronin'); lantern(M, sd * 9.6, -12, Z + 4.2, .25); lantern(M, sd * 4.8, 5.2 - .5, Z + 4.6, .25); }
    },
    // the library: two storeys, a lit shop room with shelves below, a balcony with a railing, a scroll banner
    ronin_library(M) {
      const W = 16, D = 10;
      M.block('stone', 0, 0, 0, W + 1.6, D + 1.6, .9); steps(M, 0, -(D + 1.6) / 2, .9, 5, 2);
      M.remap = { plaster: 'plaster_old' };
      walls(M, 0, 0, .9, W, D, 4, { door: [5, 3.2], windows: [['front', -5.4, 1.9, 2.8, 1.8], ['front', 5.4, 1.9, 2.8, 1.8], ['left', -2, 1.9, 3, 1.8], ['right', 2, 1.9, 3, 1.8]] });
      for (let i = 0; i < 4; i++) M.block('wood', -1.8 + i * 1.2, -D / 2 + 1.6, .9, .9, .5, 2.6); // shelves seen through the door
      M.block('wood', 0, -D / 2 - .8, 4.9, W + 1, 2, .25); // balcony
      for (let i = 0; i <= 10; i++) M.block('darkwood', -W / 2 - .3 + i * (W + .6) / 10, -D / 2 - 1.7, 5.15, .14, .14, 1);
      M.box('darkwood', [0, -D / 2 - 1.7, 6.15], [W + .8, .16, .16]); M.box('darkwood', [0, -D / 2 - 1.7, 5.6], [W + .8, .1, .1]);
      for (const x of [-W / 2 - .2, -W / 4, W / 4, W / 2 + .2]) M.block('darkwood', x, -D / 2 - 1.7, .9, .26, .26, 4);
      walls(M, 0, .6, 5.15, W - 1.6, D - 1.6, 3.4, { windows: [['front', -4.6, 5.9, 2.4, 1.6], ['front', 0, 5.9, 2.4, 1.6], ['front', 4.6, 5.9, 2.4, 1.6], ['left', 0, 5.9, 3, 1.6], ['right', 0, 5.9, 3, 1.6]], postStep: 2.8 });
      M.remap = null;
      M.roof(0, -.2, 4.9, W + 2.8, D + 3.4, 1, { lift: .5, gable: false, ornaments: false });
      M.roof(0, .6, 8.55, W + 1.6, D + 1.8, 3.3, { lift: .8 });
      banner(M, W / 2 - 3.2, -D / 2 - 1.85, 8.3, 3.2, 4.2, 'banner_ronin_scroll');
      for (const sd of [-1, 1]) { lantern(M, sd * 3, -D / 2 - .4, 3.8, .24); lantern(M, sd * (W / 2 + .1), -D / 2 - 1.8, 8.2, .24); }
    },
    // strategy hall: wide single storey with a veranda and a big board banner
    ronin_strategy_hall(M) {
      const W = 18, D = 11;
      M.block('stone', 0, 0, 0, W + 2.4, D + 2.4, .9); steps(M, 0, -(D + 2.4) / 2, .9, 5, 2);
      M.remap = { plaster: 'plaster_old' };
      walls(M, 0, .6, .9, W, D - 1.2, 4.6, { door: [3.6, 3.2], windows: [['front', -6.5, 2, 2.6, 1.8], ['left', 0, 2, 3, 1.8], ['right', 0, 2, 3, 1.8], ['back', 0, 2, 3, 1.8]] });
      M.remap = null;
      M.block('wood', 0, -D / 2 - .2, .9, W + 1.6, 1.8, .12);
      for (let i = 0; i <= 6; i++) M.block('darkwood', -W / 2 - .6 + i * (W + 1.2) / 6, -D / 2 - .9, 1, .3, .3, 4.3);
      for (const sd of [-1, 1]) { M.box('darkwood', [sd * (W / 4 + 1.8), -D / 2 - .9, 1.9], [W / 2 - 2.6, .12, .12]); for (let i = 0; i < 7; i++) M.block('darkwood', sd * (3 + i * 1.05), -D / 2 - .9, 1, .08, .08, .9); }
      M.roof(0, 0, 5.4, W + 3.6, D + 3.6, 3.4, { lift: .8 });
      banner(M, 4.4, -D / 2 + .25, 5.2, 5, 3.8, 'banner_ronin_board');
      noren(M, 0, -D / 2 + .3, 4, 3.4, .9, 'noren_ronin');
      for (const sd of [-1, 1]) lantern(M, sd * 2.6, -D / 2 - .9, 4.9, .24);
      for (const [x, y] of [[-8.2, -D / 2 - 2], [8.6, -D / 2 - 1.8]]) { M.block('wood', x, y, 0, .9, .8, .8); M.block('wood', x + .3, y + .1, .8, .7, .6, .6); }
    },
    ronin_house(M) { M.remap = { thatch: 'roof', plaster: 'plaster_old' }; B.sam_house(M); M.remap = null; noren(M, 0, -3.25 - .2, 3.05, 2.4, .9, 'noren_ronin'); banner(M, -3.05, -3.25 - .18, 3.4, 1.1, 2.2, 'banner_ronin'); },
    ronin_house_large(M) {
      const W = 12, D = 8;
      M.block('stone', 0, 0, 0, W + 1, D + 1, .7);
      M.remap = { plaster: 'plaster_old' };
      walls(M, 0, 0, .7, W, D, 3.8, { door: [2.4, 2.8], windows: [['front', -3.6, 1.7, 2.4, 1.6], ['front', 3.6, 1.7, 2.4, 1.6], ['left', 0, 1.7, 2.6, 1.6], ['right', 0, 1.7, 2.6, 1.6]] });
      M.remap = null;
      M.roof(0, 0, 4.5, W + 3, D + 3, 3, { lift: .6 });
      noren(M, 0, -D / 2 - .2, 3.4, 2.6, .9, 'noren_ronin'); banner(M, -5.2, -D / 2 - .18, 4, 1.2, 2.6, 'banner_ronin');
      lantern(M, 1.8, -D / 2 - .5, 3.9, .22); M.block('wood', 4.6, -D / 2 - 1.1, 0, 1, .9, .9); M.cyl('wood', [5.7, -D / 2 - .9, 0], .35, .85, 10);
    },
    // gate: a timber gatehouse with a tiled roof and open studded doors between two granite bastions, each with a
    // small lit watch cabin on top and a long banner; braziers on stone posts in front
    ronin_gate(M) {
      const OW = 6.4, S = 6;
      for (const sd of [-1, 1]) {
        const x = sd * (OW / 2 + S / 2);
        M.block('stone', x, 0, 0, S, 6.4, 6.6); M.block('stone', x, 0, 6.6, S + .4, 6.8, .35);
        M.remap = { plaster: 'plaster_old' }; walls(M, x, 0, 6.95, 3.6, 3.6, 2.6, { windows: [['front', 0, 7.7, 2, 1.3], [sd < 0 ? 'left' : 'right', 0, 7.7, 1.8, 1.3]], postStep: 1.8 }); M.remap = null;
        M.roof(x, 0, 9.55, 5.6, 5.6, 1.9, { lift: .5, ornaments: false });
        banner(M, x, -3.22, 6.1, 2.6, 4.6, 'banner_ronin');
        M.block('stone', sd * (OW / 2 + S + 1.4), -4.6, 0, .9, .9, 1.6); M.cyl('iron', [sd * (OW / 2 + S + 1.4), -4.6, 1.6], .4, .4, 8, .55); M.quad('fire', [[sd * (OW / 2 + S + 1.4) - .35, -4.6, 2], [sd * (OW / 2 + S + 1.4) + .35, -4.6, 2], [sd * (OW / 2 + S + 1.4) + .15, -4.6, 2.8], [sd * (OW / 2 + S + 1.4) - .15, -4.6, 2.8]]);
        M.quad('glow', [[sd * (OW / 2 + S + 1.4) - 2.2, -6.8, .06], [sd * (OW / 2 + S + 1.4) + 2.2, -6.8, .06], [sd * (OW / 2 + S + 1.4) + 2.2, -2.4, .06], [sd * (OW / 2 + S + 1.4) - 2.2, -2.4, .06]]);
      }
      for (const sd of [-1, 1]) for (const y of [-1.6, 1.6]) M.block('darkwood', sd * (OW / 2 + .2), y, 0, .5, .5, 6.2);
      for (const y of [-1.6, 1.6]) M.box('darkwood', [0, y, 6], [OW + 1.4, .45, .5]);
      M.block('darkwood', 0, 0, 6.25, OW + 1.6, 3.8, .35);
      M.roof(0, 0, 6.6, OW + 4, 5.6, 2.2, { lift: .7 });
      for (const sd of [-1, 1]) { M.block('darkwood', sd * (OW / 2 - .15), 3, 0, .22, 3, 5.6); for (const z of [1.2, 2.6, 4]) for (const k of [-1, 0, 1]) M.cyl('iron', [sd * (OW / 2 - .28), 3 + k * .9, z], .06, .03, 4); }
      noren(M, 0, -1.95, 5.75, OW - .6, 1.1, 'noren_ronin');
      for (const sd of [-1, 1]) lantern(M, sd * (OW / 2 + .2), -2.05, 5.4, .26);
    },
    // granite wall, 8 m, with a dark tiled coping
    ronin_wall(M) {
      M.block('stone', 0, 0, 0, 8, 1.6, 3.8);
      M.block('darkwood', 0, 0, 3.8, 8.1, 1.9, .18);
      M.roof(0, 0, 3.98, 8.6, 2.6, .55, { lift: .1, gable: false, ornaments: false });
    },
    ronin_wall_banner(M) { B.ronin_wall(M); banner(M, 0, -.82, 3.55, 1.7, 2.9, 'banner_ronin'); },
    // stone lantern pillar: a square granite post with a lit lantern box and a little roof
    ronin_lantern_pillar(M) {
      M.block('stone', 0, 0, 0, .9, .9, .35); M.block('stone', 0, 0, .35, .62, .62, 1.5);
      M.block('darkwood', 0, 0, 1.85, .7, .7, .08); M.block('lantern', 0, 0, 1.93, .52, .52, .55);
      for (const [x, y] of [[-.28, -.28], [.28, -.28], [-.28, .28], [.28, .28]]) M.block('darkwood', x, y, 1.93, .07, .07, .55);
      M.cyl('roof', [0, 0, 2.48], .62, .32, 4, .1);
      M.quad('glow', [[-2.2, -2.2, .06], [2.2, -2.2, .06], [2.2, 2.2, .06], [-2.2, 2.2, .06]]);
    },
    // dark wood railing, 4 m, iron caps (terraces, stairs, the yard)
    ronin_rail(M) {
      for (const x of [-2, 0, 2]) { M.block('darkwood', x, 0, 0, .2, .2, 1.15); M.cyl('iron', [x, 0, 1.15], .14, .1, 4, .08); }
      M.box('darkwood', [0, 0, 1], [4.1, .14, .14]); M.box('darkwood', [0, 0, .5], [4.1, .1, .1]);
      for (let i = 0; i < 8; i++) M.block('darkwood', -1.75 + i * .5, 0, .5, .05, .05, .5);
    },
    // the well under a small tiled roof on four posts, lanterns hanging from the beams
    ronin_well(M) {
      M.cyl('stone', [0, 0, 0], 1.45, 1.05, 16); M.cyl('water', [0, 0, .3], 1.18, .7, 16); M.cyl('stone', [0, 0, 1.05], 1.55, .12, 16);
      for (const [x, y] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) M.block('darkwood', x, y, 0, .22, .22, 3.1);
      for (const y of [-1.5, 1.5]) M.box('darkwood', [0, y, 3], [3.4, .2, .2]);
      M.box('wood', [0, 0, 2.7], [3.2, .18, .18]); M.cyl('rope', [0, 0, 1.5], .03, 1.15, 4); M.cyl('darkwood', [0, 0, 1.25], .22, .3, 8);
      M.roof(0, 0, 3.15, 4.4, 4.4, 1.3, { lift: .35, ornaments: false });
      for (const [x, y] of [[-1.5, -1.6], [1.5, -1.6]]) lantern(M, x, y, 2.8, .2);
      M.cyl('wood', [1.9, .9, 0], .3, .45, 8, .26); M.block('wood', -2, .6, 0, .6, .6, .6);
    },
    // wooden training dummy (three arms, a leg) on a square base
    ronin_dummy(M) {
      M.block('stone', 0, 0, 0, .9, .9, .25); M.cyl('wood', [0, 0, .25], .24, 1.9, 10);
      for (const z of [.7, 1.25, 1.75]) M.cyl('rope', [0, 0, z], .27, .14, 10);
      for (const [z, a] of [[1.55, .45], [1.55, -.45], [1.15, 0]]) M.rod('darkwood', [0, 0, z], [Math.sin(a) * .62, -Math.cos(a) * .62, z + .04], .05, 5);
      M.rod('darkwood', [0, 0, .55], [.1, -.55, .3], .06, 5);
      M.cyl('darkwood', [0, 0, 2.15], .26, .1, 10);
    },
    ronin_banner_pole(M) {
      M.cyl('darkwood', [0, 0, 0], .1, 5.6, 8); M.block('stone', 0, 0, 0, .7, .7, .4);
      M.box('darkwood', [0, -.02, 5.3], [1.8, .1, .1]);
      M.quad('banner_ronin', [[-.8, -.06, 1.6], [.8, -.06, 1.6], [.8, -.06, 5.25], [-.8, -.06, 5.25]]);
      for (const sd of [-1, 1]) M.cyl('iron', [sd * .9, -.02, 5.3], .06, .14, 4, .02);
      M.cyl('gold', [0, 0, 5.6], .1, .3, 6, .02);
    },
    // a dark shrub (three needle clumps) and a mossy rock garden (beds along the walls)
    ronin_shrub(M) { for (const [x, y, r, k] of [[0, 0, 1.1, 1], [.8, .4, .8, 2], [-.7, .3, .75, 3]]) blob(M, k === 1 ? 'needles_dark' : 'needles', [x, y, r * .7], r * 1.2, r * 1.1, r * .9, { amp: .3, freq: 2.4, seed: k * 11, segs: 10, rings: 6, flat: .5 }); },
    ronin_rock_garden(M) {
      for (const [x, y, s, k] of [[0, 0, 1.3, 1], [1.7, .6, .8, 2], [-1.5, .4, .9, 3], [.6, -1.2, .6, 4]]) blob(M, 'granite', [x, y, s * .35], s * 1.25, s, s * .85, { amp: .22, seed: k * 5.3, segs: 12, rings: 7, flat: .3 });
      blob(M, 'moss', [.3, .2, 1.05], 1.1, .9, .3, { amp: .25, seed: 9, segs: 10, rings: 6 });
      for (const [x, y, r, k] of [[-2.2, -.8, .7, 5], [2.6, -.6, .6, 6], [-.4, 1.6, .65, 7]]) blob(M, 'needles_dark', [x, y, r * .6], r * 1.2, r * 1.1, r * .85, { amp: .3, freq: 2.4, seed: k * 13, segs: 10, rings: 6, flat: .5 });
    },
    // stone brazier with a fire (paths, the gate court)
    ronin_brazier(M) {
      M.block('stone', 0, 0, 0, .8, .8, 1.1); M.cyl('iron', [0, 0, 1.1], .45, .35, 8, .6);
      M.quad('fire', [[-.4, 0, 1.4], [.4, 0, 1.4], [.15, 0, 2.3], [-.15, 0, 2.3]]); M.quad('fire', [[0, -.4, 1.4], [0, .4, 1.4], [0, .15, 2.2], [0, -.15, 2.2]]);
      M.quad('glow', [[-2.4, -2.4, .06], [2.4, -2.4, .06], [2.4, 2.4, .06], [-2.4, 2.4, .06]]);
    },
    // ── Bushi (tactical officers): pale stone, white plaster, dark timber and tile; crimson + gold banners ──
    // great dojo: a wide hall with a central front gable, the open middle bay hung with crimson curtains and a big
    // banner, banners on the columns; on a stone plinth with stairs. 26 x 16 m, front faces -y
    bushi_great_dojo(M) {
      const W = 26, D = 16, Z = 1;
      M.block('stone', 0, 0, 0, W + 2, D + 2, Z); steps(M, 0, -(D + 2) / 2, Z, 10, 3);
      M.block('wood', 0, -D / 2 - .2, Z, W + 1.4, 1.8, .14); // veranda
      walls(M, 0, 1.2, Z, W - 1, D - 2.4, 5.6, { door: [8.4, 4.8], windows: [['left', -2, Z + 2, 3.4, 1.8], ['left', 3, Z + 2, 3.4, 1.8], ['right', -2, Z + 2, 3.4, 1.8], ['right', 3, Z + 2, 3.4, 1.8], ['back', -7, Z + 2, 3.4, 1.8], ['back', 7, Z + 2, 3.4, 1.8]] });
      for (let i = 0; i < 7; i++) { if (i === 3) continue; const x = -W / 2 + .6 + i * (W - 1.2) / 6; M.cyl('darkwood', [x, -D / 2 - .8, Z], .34, 5.6, 10); M.cyl('stone', [x, -D / 2 - .8, Z], .48, .35, 8); banner(M, x, -D / 2 - 1.18, Z + 4.6, .9, 2.8, 'banner_bushi'); } // the middle bay stays open
      M.box('darkwood', [0, -D / 2 - .8, Z + 5.6], [W, .45, .5]);
      for (const sd of [-1, 1]) { M.quad('cloth', [[sd * 4.3, -D / 2 - .05, Z + 4.8], [sd * 1.8, -D / 2 - .12, Z + 4.8], [sd * 3.6, -D / 2 - .2, Z + 1.8], [sd * 4.3, -D / 2 - .08, Z + .2]]); }
      M.quad('cloth', [[-4.3, -D / 2 - .14, Z + 4.85], [4.3, -D / 2 - .14, Z + 4.85], [4.3, -D / 2 - .14, Z + 4.1], [-4.3, -D / 2 - .14, Z + 4.1]]);
      banner(M, 0, -D / 2 + .9, Z + 4.6, 3.4, 4.2, 'banner_bushi');
      M.roof(0, 0, Z + 5.9, W + 4.6, D + 5, 4, { lift: .9 });
      { // the front gable: an A-frame roof over the middle bay, its triangle faced in dark timber with the gold crest
        const yF = -D / 2 - 2.1, yB = 1.5, ze = Z + 7, zr = Z + 10.2, hw = 6;
        for (const sd of [-1, 1]) M.quad('roof', [[sd * hw, yF, ze], [0, yF, zr], [0, yB, zr], [sd * hw, yB, ze]], [[0, 0], [0, 2.2], [3, 2.2], [3, 0]]);
        M.poly('darkwood', [[-hw + .5, yF + .25, ze + .15], [hw - .5, yF + .25, ze + .15], [0, yF + .25, zr - .3]]);
        for (const sd of [-1, 1]) M.rod('darkwood', [sd * (hw + .2), yF - .05, ze - .1], [0, yF - .05, zr + .1], .16, 6);
        M.box('darkwood', [0, (yF + yB) / 2, zr + .12], [.4, yB - yF, .35]);
        M.tube('gold', [0, yF + .18, Z + 8.2], [0, yF + .1, Z + 8.2], .6, .6, 14); M.tube('darkwood', [0, yF + .1, Z + 8.2], [0, yF + .06, Z + 8.2], .36, .36, 14);
      }
      for (const sd of [-1, 1]) { lantern(M, sd * 6.4, -D / 2 - 1.3, Z + 5.4, .26); M.block('wood', sd * 11.6, -D / 2 - 2.2, 0, 1, .8, .8); M.cyl('wood', [sd * 12.6, -D / 2 - 2, 0], .36, .9, 10); }
    },
    bushi_library(M) { M.remap2 = { plaster_old: 'plaster', banner_ronin_scroll: 'banner_bushi_scroll', banner_ronin: 'banner_bushi', noren_ronin: 'noren_bushi' }; B.ronin_library(M); M.remap2 = null; },
    bushi_strategy_hall(M) { M.remap2 = { plaster_old: 'plaster', banner_ronin_board: 'banner_bushi_board', banner_ronin: 'banner_bushi', noren_ronin: 'noren_bushi' }; B.ronin_strategy_hall(M); M.remap2 = null; },
    bushi_house(M) { M.remap = { thatch: 'roof' }; B.sam_house(M); M.remap = null; noren(M, 0, -3.25 - .2, 3.05, 2.4, .9, 'noren_bushi'); banner(M, -3.05, -3.25 - .18, 3.4, 1.1, 2.2, 'banner_bushi'); },
    bushi_house_thatch(M) { B.sam_house(M); noren(M, 0, -3.25 - .2, 3.05, 2.4, .9, 'noren_bushi'); },
    // the gate: the Ronin bastion gate in Bushi colours, with a long banner hung in the opening
    bushi_gate(M) { M.remap2 = { plaster_old: 'plaster', banner_ronin: 'banner_bushi', noren_ronin: 'noren_bushi' }; B.ronin_gate(M); M.remap2 = null; banner(M, 0, -1.2, 5.4, 3.6, 4.7, 'banner_bushi'); },
    // fortress wall, 8 m: dressed stone 5 m high, a tiled coping, a parapet rail on the inside (+y)
    bushi_wall(M) {
      M.block('stone', 0, 0, 0, 8, 2.2, 5); M.block('stone', 0, 0, 5, 8.05, 2.35, .3);
      M.block('plaster', 0, -.85, 5.3, 8, .4, .9); M.block('darkwood', 0, -.85, 6.2, 8.1, .5, .12);
      M.roof(0, -.85, 6.32, 8.6, 1.4, .45, { lift: .05, gable: false, ornaments: false });
      for (const x of [-4, -2, 0, 2, 4]) M.block('darkwood', x, .95, 5.3, .14, .14, 1.05);
      M.box('darkwood', [0, .95, 6.25], [8.1, .12, .12]);
    },
    // corner / wall tower: a battered stone base, a lit timber cabin with a gallery, tiled roof, a long banner
    bushi_tower(M) {
      const S = 7.2, H = 7.5;
      M.cyl('stone', [0, 0, 0], S * .72, H, 4, S * .64);
      M.remap = { plaster: 'plaster' }; walls(M, 0, 0, H, 4.6, 4.6, 2.8, { windows: [['front', 0, H + .8, 2.4, 1.3], ['left', 0, H + .8, 2.2, 1.3], ['right', 0, H + .8, 2.2, 1.3], ['back', 0, H + .8, 2.2, 1.3]], postStep: 2.3 }); M.remap = null;
      M.block('wood', 0, 0, H, 6.4, 6.4, .2);
      for (const [x, y, sx, sy] of [[0, -3.15, 6.4, .12], [0, 3.15, 6.4, .12], [-3.15, 0, .12, 6.4], [3.15, 0, .12, 6.4]]) { M.block('darkwood', x, y, H + .95, sx, sy, .12); M.block('darkwood', x, y, H + .5, sx, sy, .1); }
      M.roof(0, 0, H + 2.8, 7.4, 7.4, 2.2, { lift: .6 });
      banner(M, 0, -S * .48 - .05, H - .6, 2, 4.2, 'banner_bushi');
      lantern(M, 2.6, -3.2, H + 2.6, .24); lantern(M, -2.6, -3.2, H + 2.6, .24);
    },
    // forge: an open timber hall on a stone floor, tiled roof, a tall stone chimney, the hearth, anvils, armour stands
    bushi_forge(M) {
      const W = 12, D = 9;
      M.block('stone', 0, 0, 0, W + .6, D + .6, .3);
      for (const x of [-W / 2 + .3, -W / 6, W / 6, W / 2 - .3]) for (const y of [-D / 2 + .3, D / 2 - .3]) M.block('darkwood', x, y, .3, .4, .4, 4.2);
      M.block('plaster', 0, D / 2 - .3, .3, W, .3, 4.2); M.block('plaster', -W / 2 + .3, 1, .3, .3, D / 2, 4.2);
      for (const y of [-D / 2 + .3, D / 2 - .3]) M.block('darkwood', 0, y, 4.4, W + .3, .4, .35);
      M.roof(0, 0, 4.7, W + 3, D + 3, 3, { lift: .6, ornaments: false });
      M.block('stone', W / 2 - 1.6, D / 2 - 1.5, .3, 3, 2.6, 2.2); M.block('stone', W / 2 - 1.6, D / 2 - .9, 2.5, 1.8, 1.6, 9);
      M.quad('fire', [[W / 2 - 2.6, D / 2 - 2.82, .8], [W / 2 - .6, D / 2 - 2.82, .8], [W / 2 - .6, D / 2 - 2.82, 1.8], [W / 2 - 2.6, D / 2 - 2.82, 1.8]]);
      for (const x of [-1.2, 1.8]) { M.block('stone', x, -.8, .3, .7, .7, .5); M.block('iron', x, -.8, .8, 1.2, .45, .3); }
      for (const [x, y] of [[-4.6, 2.6], [-3.4, 2.6], [-2.2, 2.6]]) { M.block('darkwood', x, y, .3, .5, .5, .2); M.cyl('darkwood', [x, y, .5], .06, 1.2, 4); M.block('iron', x, y, 1.3, .7, .4, .7); M.sphere('iron', [x, y, 2.25], .26, 1.1, 8, 5); M.box('iron', [x, y, 2.0], [.9, .2, .12]); }
      M.cyl('water', [-.2, 2.2, .3], .5, .7, 10); M.cyl('darkwood', [-.2, 2.2, .3], .55, .08, 10);
      for (let i = 0; i < 5; i++) M.rod('iron', [-W / 2 + .9 + i * .35, D / 2 - .5, .5], [-W / 2 + .9 + i * .35, D / 2 - .5, 2.6], .04, 4);
      banner(M, -2, -D / 2 + .1, 4.3, 1.2, 2.4, 'banner_bushi');
    },
    // storehouse (kura): stone base, white plaster walls, heavy dark doors, tiled roof; crates and barrels outside
    bushi_storehouse(M) {
      const W = 12, D = 8;
      M.block('stone', 0, 0, 0, W + .6, D + .6, 1); steps(M, 0, -(D + .6) / 2, 1, 3, 2);
      walls(M, 0, 0, 1, W, D, 4.4, { windows: [['left', 0, 3.4, 1.2, 1], ['right', 0, 3.4, 1.2, 1]], postStep: 4 });
      M.block('darkwood', 0, -D / 2 - .18, 1, 3.2, .12, 3.2); M.block('iron', 0, -D / 2 - .26, 2.4, .2, .06, .5);
      M.block('darkwood', 0, -D / 2 - .2, 4.2, 4, .2, .3);
      M.roof(0, 0, 5.4, W + 2.4, D + 2.4, 2.8, { lift: .5, ornaments: false });
      for (const [x, y, z, sz] of [[-4.6, -D / 2 - 1.4, 0, 1.1], [-3.4, -D / 2 - 1.5, 0, 1], [-4, -D / 2 - 1.4, 1.1, .9], [4.4, -D / 2 - 1.5, 0, 1.1]]) M.block('wood', x, y, z, sz, sz, sz);
      for (const [x, y] of [[5.6, -D / 2 - 1.2], [6.5, -D / 2 - .4], [-5.8, -D / 2 - .6]]) { M.cyl('wood', [x, y, 0], .42, 1.15, 10, .42); for (const z of [.15, .95]) M.cyl('darkwood', [x, y, z], .44, .06, 10); }
      banner(M, 3.2, -D / 2 - .18, 4.6, 1.2, 2.6, 'banner_bushi');
    },
    // a banner on its own frame (two posts, top and bottom bars), as round the training yard
    bushi_banner_frame(M) {
      for (const sd of [-1, 1]) { M.block('darkwood', sd * .85, 0, 0, .16, .16, 3.6); M.cyl('iron', [sd * .85, 0, 3.6], .1, .12, 4, .02); }
      M.box('darkwood', [0, 0, 3.4], [1.9, .12, .12]); M.box('darkwood', [0, 0, 1.15], [1.9, .1, .1]);
      M.quad('banner_bushi', [[-.72, -.08, 1.2], [.72, -.08, 1.2], [.72, -.08, 3.35], [-.72, -.08, 3.35]]);
      M.block('stone', 0, 0, 0, 2.2, .5, .2);
    },
    bushi_banner_pole(M) { M.remap = { banner_red: 'banner_bushi' }; B.sam_banner_pole(M); },
    // ── Warrior (frontline veterans' stake fort): dark timber, white plaster, dark tile and thatch, iron-banded
    //    stakes, green + gold banners, torches ──
    // great dojo (Miguel's image 3 inside, images 1/2/4 outside): a wide hall under one big hip roof on a stone base,
    // a veranda with a railing and central stairs, the open middle bay; inside two tatami fields, a raised dais with
    // the campaign map table, banners on the back wall, weapon racks and armour stands along the sides. 28 x 18 m hall,
    // front faces -y; the floor (deck) is walkable
    war_great_dojo(M) {
      const W = 28, D = 18, Z = 1.4, yF = -D / 2 + 1, yE = yF - 4.4; // hall front wall, veranda edge
      M.block('stone', 0, (yE + D / 2 + 1 + 1) / 2, 0, W + 2, D / 2 + 2 - yE, Z); steps(M, 0, yE, Z, 8, 4);
      M.block('wood', 0, (yE + D / 2 + 1.5) / 2, Z, W + 1.4, D / 2 + 1.5 - yE, .1);
      walls(M, 0, 1, Z, W, D, 5.6, { door: [10, 4.8], open: true, windows: [['front', -9.5, Z + 1.6, 4, 2.2], ['front', 9.5, Z + 1.6, 4, 2.2], ['left', -4, Z + 1.8, 4, 1.8], ['left', 4, Z + 1.8, 4, 1.8], ['right', -4, Z + 1.8, 4, 1.8], ['right', 4, Z + 1.8, 4, 1.8], ['back', -8, Z + 2.2, 3.4, 1.6], ['back', 8, Z + 2.2, 3.4, 1.6]] });
      for (const sd of [-1, 1]) { banner(M, sd * 6.6, yF - .2, Z + 5, 1.9, 3.8, 'banner_warrior'); lantern(M, sd * 3.8, yF - .5, Z + 4.9, .28); }
      // veranda: posts along the edge, the railing with a gap for the stairs, racks by the wall
      for (let i = 0; i <= 8; i++) { const x = -W / 2 + .3 + i * (W - .6) / 8; if (Math.abs(x) < 4) continue; M.cyl('darkwood', [x, yE + .5, Z], .26, 5.4, 8); }
      M.box('darkwood', [0, yE + .5, Z + 5.5], [W + .4, .4, .5]);
      for (const sd of [-1, 1]) {
        M.block('darkwood', sd * 4.4, yE + .5, Z, .5, .5, 1.6); M.cyl('iron', [sd * 4.4, yE + .5, Z + 1.6], .3, .2, 4, .1);
        for (const z of [.5, 1]) M.box('darkwood', [sd * (4.4 + (W / 2 - 4.4) / 2), yE + .5, Z + z], [W / 2 - 4.4, .14, .14]);
        for (let i = 0; i < 9; i++) M.block('darkwood', sd * (5.6 + i * 1.05), yE + .5, Z, .08, .08, 1);
        banner(M, sd * 4.4, yE + .2, Z + 4.2, 1.4, 3, 'banner_warrior');
        for (const x of [8.2, 11.4]) { const xx = sd * x; for (const s2 of [-1, 1]) M.block('darkwood', xx + s2 * 1.2, yF - .5, Z, .12, .4, 1.8); M.box('darkwood', [xx, yF - .5, Z + 1.4], [2.6, .4, .1]); for (let k = 0; k < 6; k++) { const px = xx - 1 + k * .4; M.rod('wood', [px, yF - .45, Z + .05], [px, yF - .6, Z + 2.5], .035, 4); M.cyl('iron', [px, yF - .6, Z + 2.45], .05, .3, 4, .005); } }
      }
      M.roof(0, -1.2, Z + 5.6, W + 4.6, D + 8, 5.4, { lift: 1 });
      // inside: two tatami fields, the dais with the map table, banners and lanterns, racks and armour along the sides
      for (const x0 of [-8.3, .3]) M.quad('tatami', [[x0, yF + 1.2, Z + .11], [x0 + 8, yF + 1.2, Z + .11], [x0 + 8, yF + 9.2, Z + .11], [x0, yF + 9.2, Z + .11]]);
      const yD = D / 2 + 1 - 3.2; M.block('wood', 0, yD, Z, 16, 4.4, .6); steps(M, 0, yD - 2.2, Z + .6, 6, 2, .35);
      M.block('darkwood', 0, yD + .2, Z + .6, 3.4, 2, .65); M.quad('war_map', [[-1.6, yD - .7, Z + 1.26], [1.6, yD - .7, Z + 1.26], [1.6, yD + 1.1, Z + 1.26], [-1.6, yD + 1.1, Z + 1.26]]);
      for (const sd of [-1, 1]) { M.block('darkwood', sd * 4, yD + .2, Z + .6, 2.4, .7, .4); banner(M, sd * 3.6, D / 2 + 1 - .2, Z + 4.6, 1.6, 3, 'banner_warrior', 1); lantern(M, sd * 6.6, yD - 1.6, Z + 1.8, .22); M.cyl('darkwood', [sd * 6.6, yD - 1.6, Z + .6], .08, 1.2, 4); }
      for (const sd of [-1, 1]) {
        const x = sd * (W / 2 - .8);
        for (const y of [yF + 2, yF + 6, yF + 10]) { M.block('darkwood', x, y, Z, .5, 2.4, .12); for (let k = 0; k < 5; k++) M.rod('wood', [x, y - .9 + k * .45, Z + .1], [x - sd * .1, y - .9 + k * .45, Z + 2.5], .04, 4); }
        for (const y of [yF + 4, yF + 8, yF + 12]) { const xa = x - sd * .6; M.block('darkwood', xa, y, Z, .5, .5, .2); M.cyl('darkwood', [xa, y, Z + .2], .06, 1.2, 4); M.block('iron', xa, y, Z + 1.2, .7, .4, .7); M.sphere('iron', [xa, y, Z + 2.15], .26, 1.1, 8, 5); M.box('iron', [xa, y, Z + 1.9], [.9, .2, .12]); }
      }
    },
    war_forge(M) { M.remap2 = { banner_bushi: 'banner_warrior' }; B.bushi_forge(M); M.remap2 = null; },
    // storehouse: an open thatched shed on posts, sacks of rice, barrels and crates, a banner on the corner post
    war_storehouse(M) {
      const W = 14, D = 8;
      M.block('earth', 0, 0, 0, W + .6, D + .6, .15);
      for (const x of [-W / 2 + .3, -W / 6, W / 6, W / 2 - .3]) for (const y of [-D / 2 + .3, D / 2 - .3]) M.block('wood', x, y, .15, .34, .34, y < 0 ? 3.8 : 3.5);
      for (const y of [-D / 2 + .3, D / 2 - .3]) M.box('darkwood', [0, y, y < 0 ? 3.95 : 3.65], [W + .4, .32, .32]);
      M.roof(0, 0, 3.9, W + 2.6, D + 2.6, 2.8, { lift: .35, mat: 'thatch', fascia: 'darkwood', ornaments: false, gable: false });
      M.block('wood', 0, D / 2 - .3, .15, W - .6, .2, 2.4); M.block('wood', -W / 2 + .3, 0, .15, .2, D - .6, 2.4);
      for (let k = 0; k < 3; k++) for (let i = 0; i < 6 - k; i++) for (const y of [2.2, 3]) M.sphere('sack', [-5.6 + i * .9 + k * .45, y, .5 + k * .62], .5, .66, 8, 4);
      for (const [x, y] of [[1.2, 2.6], [2.2, 2.6], [1.7, 1.7], [4.8, 2.8], [5.6, 2]]) { M.cyl('wood', [x, y, .15], .42, 1.15, 10, .42); for (const z of [.3, 1.1]) M.cyl('darkwood', [x, y, z], .44, .06, 10); }
      for (const [x, y, z, sz] of [[3.4, -.6, .15, 1.1], [4.6, -.5, .15, 1], [4, -.6, 1.25, .9], [-2, -1.2, .15, 1.2], [-.8, -1.4, .15, .9]]) M.block('wood', x, y, z, sz, sz, sz);
      for (const [x, y] of [[-6.4, -D / 2 - 1.3], [6.6, -D / 2 - 1.1], [-5.6, -D / 2 - 1.5]]) M.sphere('sack', [x, y, .4], .5, .7, 8, 4);
      banner(M, W / 2 - .3, -D / 2 + .1, 3.6, 1.1, 2.4, 'banner_warrior');
    },
    // two-storey house (the Ronin library's frame): a big banner on the upper floor, a balcony
    war_house_large(M) { M.remap2 = { plaster_old: 'plaster', banner_ronin_scroll: 'banner_warrior', banner_ronin: 'banner_warrior', noren_ronin: 'noren_warrior' }; B.ronin_library(M); M.remap2 = null; },
    // hall with a veranda and two gold banners with the wheel crest, either side of the door
    war_hall(M) {
      M.remap2 = { plaster_old: 'plaster', banner_ronin_board: 'banner_war_wheel', banner_ronin: 'banner_warrior', noren_ronin: 'noren_warrior' }; B.ronin_strategy_hall(M); M.remap2 = null;
      banner(M, -4.4, -11 / 2 + .25, 5.2, 5, 3.8, 'banner_war_wheel');
    },
    // houses: dark tile (or thatch), a green noren, a banner, a thatched lean-to with firewood on the right
    war_house(M) { M.remap = { thatch: 'roof' }; B.sam_house(M); M.remap = null; warHouseExtras(M, true); },
    war_house_thatch(M) { B.sam_house(M); warHouseExtras(M, false); },
    war_well(M) { B.ronin_well(M); for (const [x, y] of [[2.6, -.6], [2.9, .4]]) { M.cyl('wood', [x, y, 0], .4, 1.05, 10, .4); for (const z of [.15, .85]) M.cyl('darkwood', [x, y, z], .42, .06, 10); } M.block('wood', -2.6, -.8, 0, .9, .9, .9); },
    // the gate tower: two timber towers with iron-banded posts either side of the opening, a gallery with windows
    // over it under a tiled roof, long green banners on the front, the doors swung open; 15 m wide, front faces -y
    war_gate(M) {
      const OW = 6.4, S = 3.6, H = 6.6;
      for (const sd of [-1, 1]) {
        const x = sd * (OW / 2 + S / 2);
        M.block('stone', x, 0, 0, S + .5, 4.4, .6);
        M.block('wood', x, 0, .6, S, 3.6, H - .6);
        for (const px of [-1, 1]) for (const py of [-1, 1]) { const cx = x + px * (S / 2), cy = py * 1.8; M.cyl('darkwood', [cx, cy, 0], .3, H + .2, 8); for (const z of [1.2, 3.4, 5.6]) M.cyl('iron', [cx, cy, z], .33, .18, 8); }
        for (const z of [2.2, 4.4]) M.box('darkwood', [x, -1.82, z], [S, .1, .16]);
        banner(M, x, -1.9, H - .3, 2.2, 4.6, 'banner_warrior');
      }
      M.block('darkwood', 0, 0, H, OW + 2 * S + 1.4, 4.8, .4);
      for (const [cx, cy, sx, sy] of [[0, -2.4, OW + 2 * S + 1.4, .14], [0, 2.4, OW + 2 * S + 1.4, .14], [-(OW / 2 + S + .7), 0, .14, 4.8], [(OW / 2 + S + .7), 0, .14, 4.8]]) { M.block('darkwood', cx, cy, H + 1.05, sx, sy, .14); M.block('darkwood', cx, cy, H + .6, sx, sy, .1); }
      for (let i = 0; i <= 12; i++) M.block('darkwood', -(OW / 2 + S + .6) + i * (OW + 2 * S + 1.2) / 12, -2.4, H + .4, .1, .1, .7);
      M.remap = { plaster: 'wood' }; walls(M, 0, .4, H + .4, OW + 4, 3, 2.2, { windows: [['front', -3, H + 1, 1.6, 1.1], ['front', 0, H + 1, 1.6, 1.1], ['front', 3, H + 1, 1.6, 1.1], ['back', -2, H + 1, 1.6, 1.1], ['back', 2, H + 1, 1.6, 1.1]], postStep: 1.6 }); M.remap = null;
      M.roof(0, .2, H + 2.6, OW + 2 * S + 3.4, 7.2, 2.6, { lift: .8 });
      for (const sd of [-1, 1]) { M.block('wood', sd * (OW / 2 - .15), 3.2, 0, .24, 3.2, 5.4); for (const z of [1.2, 2.7, 4.2]) M.box('iron', [sd * (OW / 2 - .3), 3.2, z], [.06, 3.1, .12]); }
      for (const sd of [-1, 1]) lantern(M, sd * (OW / 2 - .5), -2.3, H - .1, .26);
      noren(M, 0, -2.42, H - .05, OW - .8, 1, 'noren_warrior');
    },
    // watchtower: four timber legs with cross bracing, a planked cabin with a railing, a tiled roof, a ladder; ~13 m
    war_watchtower(M) {
      const H = 9, S = 3.4, B0 = 4.6;
      M.block('stone', 0, 0, 0, B0 + 1, B0 + 1, .5);
      const leg = (x, y, z) => { const f = z / H; return [x * (B0 / 2 * (1 - f) + S / 2 * f), y * (B0 / 2 * (1 - f) + S / 2 * f), z]; };
      for (const x of [-1, 1]) for (const y of [-1, 1]) M.rod('wood', leg(x, y, .5), leg(x, y, H + 3), .2, 6);
      for (const [z0, z1] of [[.6, 4.6], [4.6, 8.8]]) for (const [a, b] of [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]]) {
        M.rod('wood', leg(a[0], a[1], z0), leg(b[0], b[1], z1), .09, 4); M.rod('wood', leg(b[0], b[1], z0), leg(a[0], a[1], z1), .09, 4);
        M.rod('darkwood', leg(a[0], a[1], z1), leg(b[0], b[1], z1), .11, 4);
      }
      M.block('wood', 0, 0, H, S + 1.2, S + 1.2, .3);
      for (const [x, y, sx, sy] of [[0, -(S + 1.2) / 2, S + 1.2, .12], [0, (S + 1.2) / 2, S + 1.2, .12], [-(S + 1.2) / 2, 0, .12, S + 1.2], [(S + 1.2) / 2, 0, .12, S + 1.2]]) { M.block('wood', x, y, H + .3, sx, sy, 1.1); M.block('darkwood', x, y, H + 1.4, sx + .1, sy + .1, .14); M.block('darkwood', x, y, H + .85, sx + .06, sy + .06, .08); }
      M.roof(0, 0, H + 3, S + 2.8, S + 2.8, 2, { lift: .5 });
      for (let i = 0; i < 12; i++) M.box('wood', [0, -B0 / 2 - .35, .8 + i * .72], [.9, .07, .07]);
      for (const s2 of [-1, 1]) M.rod('wood', [s2 * .45, -B0 / 2 - .35, .5], [s2 * .45, -S / 2 - .55, H + .3], .05, 4);
      lantern(M, S / 2 + .1, -S / 2 - .1, H + 2.8, .22);
    },
    // 8 m of palisade: tall sharpened stakes with iron bands on a stone footing, two rails and raking props on the
    // inside (+y); outside faces -y. The banner variant has a banner pole behind, flying above the stakes
    war_palisade(M) { warPalisade(M, false); },
    war_palisade_banner(M) { warPalisade(M, true); },
    // torch post: an iron fire basket on a timber post over a stone foot; a pool of light at night
    war_torch(M) {
      M.block('stone', 0, 0, 0, .6, .6, .4); M.cyl('darkwood', [0, 0, .4], .1, 1.6, 6);
      for (let k = 0; k < 3; k++) { const a = k * 2.094; M.rod('darkwood', [Math.cos(a) * .5, Math.sin(a) * .5, 0], [0, 0, 1.1], .045, 4); }
      M.cyl('iron', [0, 0, 1.95], .14, .34, 8, .3); M.cyl('iron', [0, 0, 2.28], .31, .04, 8);
      M.quad('fire', [[-.24, 0, 2.2], [.24, 0, 2.2], [.08, 0, 2.85], [-.08, 0, 2.85]]); M.quad('fire', [[0, -.24, 2.2], [0, .24, 2.2], [0, .08, 2.75], [0, -.08, 2.75]]);
      M.quad('glow', [[-2.6, -2.6, .06], [2.6, -2.6, .06], [2.6, 2.6, .06], [-2.6, 2.6, .06]]);
    },
    // spear rack, 3 m: two uprights, rails, nine spears with iron heads
    war_spear_rack(M) {
      for (const sd of [-1, 1]) { M.block('darkwood', sd * 1.45, 0, 0, .16, .6, 2.1); M.block('darkwood', sd * 1.45, 0, 0, .3, .9, .14); }
      for (const z of [.35, 1.6]) M.box('darkwood', [0, 0, z], [3.1, .5, .1]);
      for (let i = 0; i < 9; i++) { const x = -1.2 + i * .3; M.rod('wood', [x, .06, .1], [x, -.04, 2.9], .03, 4); M.cyl('iron', [x, -.04, 2.88], .055, .38, 4, .005); }
    },
    // training horse: a log on two pairs of crossed legs (round the yard)
    war_sawhorse(M) {
      M.rod('bark', [-1.3, 0, 1.05], [1.3, 0, 1.05], .13, 7);
      for (const x of [-1, 1]) { M.rod('wood', [x, -.6, 0], [x, .3, 1.3], .07, 5); M.rod('wood', [x, .6, 0], [x, -.3, 1.3], .07, 5); }
    },
    // straw archery target on a three-legged stand
    war_target(M) {
      for (const sd of [-1, 1]) M.rod('wood', [sd * .75, .35, 0], [sd * .3, 0, 1.9], .06, 5);
      M.rod('wood', [0, .8, 0], [0, .08, 1.8], .06, 5);
      M.tube('straw', [0, -.08, 1.3], [0, .14, 1.3], .7, .7, 18);
      for (const r of [.58, .42, .26, .1]) M.tube('rope', [0, -.085, 1.3], [0, -.09, 1.3], r, r - .04, 18, false);
    },
    // rail fence, 4 m, on a kerb of stone blocks (round the training yard)
    war_fence(M) {
      M.block('stone', 0, 0, 0, 4.05, .55, .22);
      for (const x of [-1.9, 0, 1.9]) { M.block('darkwood', x, 0, .22, .2, .2, 1.15); M.cyl('darkwood', [x, 0, 1.37], .12, .1, 4, .06); }
      for (const z of [.62, 1.15]) M.box('wood', [0, 0, .22 + z], [4.05, .1, .14]);
    },
    // a small broadleaf tree (the shade trees of the fort): a crooked trunk, a crown of leafy clumps; ~5 m
    war_tree(M) {
      curveTube(M, 'bark', [[0, 0, -.2], [.15, .1, 1.2], [-.1, .05, 2.4], [.2, -.1, 3.4]], [.26, .2, .14], { segs: 8, n: 3, ridge: .1, bump: .08, seed: 3 });
      curveTube(M, 'bark', [[-.05, .05, 2], [-.7, .3, 2.8], [-1.2, .4, 3.4]], [.11, .07], { segs: 6, n: 3, seed: 5 });
      curveTube(M, 'bark', [[.1, 0, 2.6], [.8, -.4, 3.3], [1.2, -.5, 3.8]], [.1, .06], { segs: 6, n: 3, seed: 7 });
      for (const [x, y, z, r, k] of [[0, 0, 4.4, 1.6, 1], [-1.3, .4, 3.8, 1.15, 2], [1.3, -.5, 4, 1.2, 3], [.3, .9, 3.7, 1.1, 4], [-.2, -.9, 3.9, 1.05, 5]]) blob(M, 'leaves', [x, y, z], r * 1.15, r * 1.1, r * .85, { amp: .28, freq: 2.2, seed: k * 17, segs: 10, rings: 6, flat: .6 });
    },
    war_bush(M) { for (const [x, y, r, k] of [[0, 0, .9, 1], [.7, .3, .65, 2], [-.6, .25, .6, 3]]) blob(M, 'leaves', [x, y, r * .6], r * 1.2, r * 1.1, r * .9, { amp: .3, freq: 2.4, seed: k * 23, segs: 9, rings: 5, flat: .5 }); },
    war_banner_pole(M) { M.remap2 = { banner_ronin: 'banner_warrior' }; B.ronin_banner_pole(M); M.remap2 = null; },
    // ── Shogun (the commanders' hilltop castle): battered stone, white plaster, dark tile with gold trim, purple +
    //    gold banners ──
    // the keep (tenshu): a battered stone base, three plastered storeys under stepped tiled roofs with front gables
    // and gold ornaments; ~30 m tall, base 26 x 22 m, front faces -y
    shogun_keep(M) {
      batter(M, 'stone', 0, 0, 0, 26, 22, 22, 18, 8);
      M.block('darkwood', 0, -10.6, 0, 4, .5, 4.2); M.block('iron', 0, -10.9, 2, .1, .1, 2.2); for (const sd of [-1, 1]) M.block('darkwood', sd * 2.25, -10.7, 0, .5, .6, 4.6);
      M.box('darkwood', [0, -10.75, 4.7], [5.2, .6, .5]);
      const st = [[8, 20, 16, 5, 'front', 1], [13.6, 15, 12, 4.2, 'front', .8], [18.4, 10.5, 8.5, 3.6, 'front', .6]];
      st.forEach(([z, w, d, h], k) => {
        walls(M, 0, 0, z, w, d, h, { windows: [['front', -w / 4, z + h * .4, 2, 1.3], ['front', w / 4, z + h * .4, 2, 1.3], ['front', 0, z + h * .4, 2, 1.3], ['back', -w / 4, z + h * .4, 2, 1.3], ['back', w / 4, z + h * .4, 2, 1.3], ['left', 0, z + h * .4, 2, 1.3], ['right', 0, z + h * .4, 2, 1.3]], postStep: 2.6 });
        M.box('gold', [0, -d / 2 - .22, z + h - .2], [w + .3, .06, .12]);
        if (k < 2) {
          M.roof(0, 0, z + h, w + 4, d + 4, 1.8, { lift: .7, gable: false, ornaments: false });
          shogunGable(M, 0, -d / 2 - 2.2, z + h + .5, z + h + 3.4, w * .22, -d / 2 + 2);
        }
      });
      M.roof(0, 0, 22, 15, 13, 4, { lift: 1 });
      shogunGable(M, 0, -6.8, 22.6, 25.6, 3.2, -2.5);
      for (const sd of [-1, 1]) { M.cyl('gold', [sd * 4.1, 0, 26.3], .3, 1.1, 6, .1); M.sphere('gold', [sd * 4.1, 0, 26.2], .35, 1, 6, 4); }
      for (const sd of [-1, 1]) { banner(M, sd * 7, -9.9 - .1, 16.6, 1.6, 3.2, 'banner_shogun'); lantern(M, sd * 3.2, -11.1, 4.3, .3); }
    },
    // corner turret (yagura): a battered stone base, two white storeys under tiled roofs with gold ornaments
    shogun_turret(M) {
      batter(M, 'stone', 0, 0, 0, 9, 9, 7.4, 7.4, 5.5);
      walls(M, 0, 0, 5.5, 6.4, 6.4, 3, { windows: [['front', 0, 6.6, 1.4, 1], ['left', 0, 6.6, 1.4, 1], ['right', 0, 6.6, 1.4, 1], ['back', 0, 6.6, 1.4, 1]], postStep: 3.2 });
      M.roof(0, 0, 8.5, 9, 9, 1.2, { lift: .5, gable: false, ornaments: false });
      walls(M, 0, 0, 9, 4.6, 4.6, 2.3, { windows: [['front', 0, 9.8, 1.2, .9], ['left', 0, 9.8, 1.2, .9], ['right', 0, 9.8, 1.2, .9]], postStep: 2.3 });
      M.roof(0, 0, 11.3, 7, 7, 2.2, { lift: .6 });
      banner(M, 0, -3.25, 8.3, 1.4, 2.6, 'banner_shogun');
    },
    // castle wall, 8 m: battered stone 4.5 m, a white plaster parapet with loopholes on the outside (-y), a tiled
    // coping; the stone top is a walkway
    shogun_wall(M) {
      batter(M, 'stone', 0, 0, 0, 8, 3.4, 8, 2.4, 4.5);
      M.block('plaster', 0, -.85, 4.5, 8, .6, 1.7);
      for (const x of [-3, -1, 1, 3]) M.quad('dark', [[x - .2, -1.16, 5.4], [x + .2, -1.16, 5.4], [x + .2, -1.16, 5.8], [x - .2, -1.16, 5.8]]);
      M.block('darkwood', 0, -.85, 6.2, 8.1, .66, .12);
      M.roof(0, -.85, 6.32, 8.6, 1.5, .45, { lift: .05, gable: false, ornaments: false });
    },
    shogun_gate(M) { M.remap2 = { plaster_old: 'plaster', banner_ronin: 'banner_shogun', noren_ronin: 'noren_shogun' }; B.ronin_gate(M); M.remap2 = null; for (const sd of [-1, 1]) banner(M, sd * 1.9, -2.1, 5.6, 1.6, 3.8, 'banner_shogun'); M.box('gold', [0, -2.2, 6.4], [2.6, .08, .5]); },
    // small roofed gate at the head of the central stairs
    shogun_inner_gate(M) {
      for (const sd of [-1, 1]) for (const y of [-.7, .7]) { M.block('darkwood', sd * 3.2, y, 0, .4, .4, 4.2); M.cyl('stone', [sd * 3.2, y, 0], .4, .3, 8); }
      for (const y of [-.7, .7]) M.box('darkwood', [0, y, 4], [7.6, .36, .4]);
      M.block('darkwood', 0, 0, 4.2, 7.8, 2, .3); M.roof(0, 0, 4.5, 9.6, 3.6, 1.6, { lift: .6 });
      for (const sd of [-1, 1]) banner(M, sd * 3.2, -.95, 3.7, 1, 2.6, 'banner_shogun');
      M.box('gold', [0, -.92, 4.05], [1.4, .06, .3]);
    },
    // great dojo: the Warrior hall in Shogun colours, a front gable with the gold crest, wide purple hangings, the
    // painted screen behind the dais, cushions round the map table
    shogun_great_dojo(M) {
      M.remap2 = { banner_warrior: 'banner_shogun' }; B.war_great_dojo(M); M.remap2 = null;
      const Z = 1.4, yF = -8;
      for (const sd of [-1, 1]) banner(M, sd * 8.6, yF - .38, Z + 5.2, 5, 3.6, 'banner_shogun');
      shogunGable(M, 0, yF - 5.4, Z + 8.4, Z + 11.6, 6.5, 0);
      M.tube('gold', [0, yF - 5.3, Z + 9.6], [0, yF - 5.4, Z + 9.6], .7, .7, 14); M.tube('darkwood', [0, yF - 5.4, Z + 9.6], [0, yF - 5.45, Z + 9.6], .42, .42, 14);
      M.box('gold', [0, yF - 4.9, Z + 5.55], [28.5, .06, .14]);
      M.quad('shogun_screen', [[-2.6, 9.83, Z + .7], [2.6, 9.83, Z + .7], [2.6, 9.83, Z + 4], [-2.6, 9.83, Z + 4]].map(p => p), [[1, 0], [0, 0], [0, 1], [1, 1]]);
      for (const [x, y] of [[-2.2, 5.6], [-.7, 5.4], [.7, 5.4], [2.2, 5.6], [-2.2, 8.2], [2.2, 8.2]]) M.block('cushion', x, y, 2, .7, .7, .14);
    },
    shogun_library(M) { M.remap2 = { plaster_old: 'plaster', banner_ronin_scroll: 'banner_shogun', banner_ronin: 'banner_shogun', noren_ronin: 'noren_shogun' }; B.ronin_library(M); M.remap2 = null; for (const sd of [-1, 1]) banner(M, sd * 2.8, -5 - .4, 4.6, 1.1, 2.4, 'banner_shogun'); },
    shogun_strategy_hall(M) { M.remap2 = { plaster_old: 'plaster', banner_ronin_board: 'banner_shogun_mon', banner_ronin: 'banner_shogun', noren_ronin: 'noren_shogun' }; B.ronin_strategy_hall(M); M.remap2 = null; },
    shogun_house(M) { M.remap = { thatch: 'roof' }; B.sam_house(M); M.remap = null; noren(M, 0, -3.25 - .2, 3.05, 2.4, .9, 'noren_shogun'); banner(M, -3.05, -3.25 - .18, 3.4, 1.1, 2.2, 'banner_shogun'); },
    shogun_house_large(M) { M.remap2 = { plaster_old: 'plaster', banner_ronin: 'banner_shogun', noren_ronin: 'noren_shogun' }; B.ronin_house_large(M); M.remap2 = null; },
    shogun_storehouse(M) { M.remap2 = { banner_bushi: 'banner_shogun' }; B.bushi_storehouse(M); M.remap2 = null; },
    // shrine: vermilion posts and gold trim on a stone base, two tiled roofs, purple curtains, a gilded altar
    shogun_shrine(M) {
      const W = 7, D = 6, Z = 1.2;
      M.block('stone', 0, 0, 0, W + 2, D + 2, Z); steps(M, 0, -(D + 2) / 2, Z, 3.2, 3);
      M.block('wood', 0, 0, Z, W + 1, D + 1, .12);
      for (const x of [-W / 2, -W / 6, W / 6, W / 2]) for (const y of [-D / 2, D / 2]) { M.cyl('red', [x, y, Z], .2, 4, 8); M.cyl('gold', [x, y, Z + 3.85], .24, .15, 8); }
      for (const y of [-D / 2, D / 2]) M.box('red', [0, y, Z + 4.05], [W + .4, .3, .3]); for (const x of [-W / 2, W / 2]) M.box('red', [x, 0, Z + 4.05], [.3, D + .4, .3]);
      M.block('plaster', 0, D / 2, Z, W, .2, 3.8); M.block('plaster', -W / 2, 0, Z, .2, D, 3.8); M.block('plaster', W / 2, 0, Z, .2, D, 3.8);
      M.block('darkwood', 0, D / 2 - 1, Z + .12, 3, 1.2, 1.1); M.block('gold', 0, D / 2 - 1, Z + 1.22, 1.4, .8, .9); M.cyl('gold', [0, D / 2 - 1, Z + 2.1], .3, .5, 8, .05);
      for (const sd of [-1, 1]) M.quad('cloth_purple', [[sd * 3.4, -D / 2 - .05, Z + 3.9], [sd * 1.4, -D / 2 - .05, Z + 3.9], [sd * 2.8, -D / 2 - .1, Z + 1.4], [sd * 3.4, -D / 2 - .06, Z + .4]]);
      M.roof(0, 0, Z + 4.2, W + 3, D + 3, 1.2, { lift: .6, gable: false, ornaments: false });
      M.block('red', 0, 0, Z + 5.4, W - 1.6, D - 1.6, .7);
      M.roof(0, 0, Z + 6.1, W + 1.4, D + 1.4, 2.4, { lift: .8 });
      M.box('gold', [0, -D / 2 - .2, Z + 4.1], [W + .4, .06, .14]);
      for (const sd of [-1, 1]) { banner(M, sd * (W / 2 + .9), -D / 2 - .9, 3.4, .9, 2.6, 'banner_shogun'); M.block('darkwood', sd * (W / 2 + .9), -D / 2 - .8, 0, .14, .14, 3.5); }
      for (const sd of [-1, 1]) lantern(M, sd * 1.6, -D / 2 - .3, Z + 3.8, .22);
    },
    // arched garden bridge over the pond, 11 m: wooden deck on a curve, rails with gold caps (deck: two ramps)
    shogun_bridge(M) {
      const L = 11, Wd = 2.4, H = 1.3, zAt = y => H * Math.cos(y / (L / 2) * Math.PI / 2);
      const n = 14;
      for (let i = 0; i < n; i++) { const y0 = -L / 2 + i * L / n, y1 = y0 + L / n, z0 = zAt(y0), z1 = zAt(y1); M.box('wood', [0, (y0 + y1) / 2, (z0 + z1) / 2 - .12], [Wd, Math.hypot(L / n, z1 - z0) + .02, .24], 0, Math.atan2(z1 - z0, L / n)); }
      for (const sd of [-1, 1]) {
        for (let i = 0; i <= 6; i++) { const y = -L / 2 + .3 + i * (L - .6) / 6, z = zAt(y); M.block('darkwood', sd * (Wd / 2 - .08), y, z - .2, .16, .16, 1.15); M.sphere('gold', [sd * (Wd / 2 - .08), y, z + 1], .11, 1, 6, 3); }
        for (let i = 0; i < 12; i++) { const y0 = -L / 2 + .3 + i * (L - .6) / 12, y1 = y0 + (L - .6) / 12; M.rod('darkwood', [sd * (Wd / 2 - .08), y0, zAt(y0) + .85], [sd * (Wd / 2 - .08), y1, zAt(y1) + .85], .05, 4); }
        for (const y of [-2.6, 2.6]) M.block('stone', sd * (Wd / 2 - .3), y, -2.2, .5, .5, zAt(y) + 2.1);
      }
    },
    // dark railing, 4 m, gold ball finials (terrace edges)
    shogun_rail(M) {
      for (const x of [-2, 0, 2]) { M.block('darkwood', x, 0, 0, .2, .2, 1.15); M.sphere('gold', [x, 0, 1.25], .13, 1, 6, 4); }
      M.box('darkwood', [0, 0, 1], [4.1, .14, .14]); M.box('darkwood', [0, 0, .5], [4.1, .1, .1]);
      for (let i = 0; i < 8; i++) M.block('darkwood', -1.75 + i * .5, 0, .5, .05, .05, .5);
    },
    shogun_banner_pole(M) { M.remap2 = { banner_ronin: 'banner_shogun' }; B.ronin_banner_pole(M); M.remap2 = null; },
    // ── Cute & Creepy (friend collection: a haunted hilltop village): dark stone, purple shingle roofs, glowing
    //    windows, wrought iron, jack-o'-lanterns, candles, ghosts ──
    // the gothic manor (the gang's hall): stone walls, a steep purple roof with dormers and an iron crest, two round
    // turrets with pointed roofs, a gabled porch with the arched door, spider banners; 27 m wide, front faces -y
    cc_manor(M) {
      const W = 20, D = 12, H = 7.4;
      M.block('stone_dark', 0, 0, 0, W + 1.2, D + 1.2, .8); steps(M, 0, -(D + 1.2) / 2 - 2, .8, 4, 2, .5);
      M.block('stone_dark', 0, 0, .8, W, D, H);
      for (const x of [-7.4, -3.6, 3.6, 7.4]) { gwin(M, x, -D / 2 - .02, 2.2, 1.5, 2.6); gwin(M, x, -D / 2 - .02, 5.3, 1.3, 1.8); gwin(M, x, D / 2 + .02, 3, 1.4, 2.4, 1); }
      for (const sd of [-1, 1]) gwinSide(M, sd * (W / 2 + .02), 0, 3, 1.4, 2.4, sd);
      steepRoof(M, 'roof_purple', 0, 0, .8 + H, W, D, 6.2, .7, 'stone_dark');
      for (const x of [-5.5, 0, 5.5]) dormer(M, x, -D / 2 + 1.6, .8 + H + 1.2, 2.2);
      ironCrest(M, 0, 0, .8 + H + 6.2, W - 1);
      // the porch: a gabled stone bay with the arched door
      M.block('stone_dark', 0, -D / 2 - 1.1, .8, 6, 2.2, 5.6);
      steepRoof(M, 'roof_purple', 0, -D / 2 - 1.3, 6.4, 6.4, 2.8, 2.6, .4, 'stone_dark', true);
      archDoor(M, 0, -D / 2 - 2.22, .8, 2.6, 3.8);
      gwin(M, 0, -D / 2 - 2.22, 5, 1, 1.2);
      for (const sd of [-1, 1]) { banner(M, sd * 5.5, -D / 2 - .06, .8 + H - .4, 1.8, 3.8, 'banner_cc'); M.block('iron', sd * 2.1, -D / 2 - 2.3, 3.6, .14, .3, .14); M.block('window_glow', sd * 2.1, -D / 2 - 2.45, 3, .4, .4, .55); }
      M.block('stone_dark', 6.5, 2, .8 + H, 1.4, 1.4, 6.5); M.block('stone_dark', 6.5, 2, .8 + H + 6.5, 1.7, 1.7, .4);
      for (const sd of [-1, 1]) { // round turrets on the front corners
        const x = sd * (W / 2 + 1.2), y = -D / 2 + .6;
        M.cyl('stone_dark', [x, y, 0], 2.5, 11, 14); M.cyl('stone_dark', [x, y, 11], 2.75, .5, 14);
        M.cyl('roof_purple', [x, y, 11.5], 3.1, 5.4, 14, .06); M.rod('iron', [x, y, 16.6], [x, y, 18.2], .06, 4); M.sphere('iron', [x, y, 17.4], .16, 1, 6, 3);
        for (const z of [2.6, 6.4, 9]) gwin(M, x, y - 2.52, z, .9, 1.5);
      }
      M.quad('glow', [[-3.6, -D / 2 - 6.4, .06], [3.6, -D / 2 - 6.4, .06], [3.6, -D / 2 - 1.6, .06], [-3.6, -D / 2 - 1.6, .06]]);
    },
    // crooked cottages: a stone footing, dark timber and old plaster, a steep purple roof, a leaning chimney
    cc_cottage(M) { ccCottage(M, 8, 6.4, 0, 'window_glow'); },
    cc_cottage_b(M) { ccCottage(M, 9, 7, 1, 'window_glow'); },
    // the witch's cottage: green windows, a crooked chimney, herbs drying under the eaves, the cauldron outside
    cc_witch_hut(M) {
      ccCottage(M, 9, 7.2, 2, 'brew');
      for (let i = 0; i < 6; i++) { const x = -3.4 + i * 1.1; M.rod('rope', [x, -4, 3.6], [x, -4, 3.1], .015, 3); M.cyl('leaf', [x, -4, 2.7], .14, .45, 5, .04); }
      ccCauldron(M, 5.6, -5, 0);
    },
    cc_cauldron(M) { ccCauldron(M, 0, 0, 0); },
    // the library: a stone hall with a great arched opening onto glowing bookshelves, gothic windows, a book sign
    cc_library(M) {
      const W = 13, D = 9, H = 5.6;
      M.block('stone_dark', 0, 0, 0, W + .8, D + .8, .6); steps(M, -2.6, -(D + .8) / 2, .6, 4, 2, .4);
      M.block('stone_dark', 0, 0, .6, W, D, H);
      M.poly('books', archPts(-2.6, -D / 2 - .03, .6, 4, 4.2)); // the shelves seen through the arch
      for (const sd of [-1, 1]) M.block('darkwood', -2.6 + sd * 2.15, -D / 2 - .1, .6, .3, .3, 3.2);
      M.rod('darkwood', [-4.75, -D / 2 - .12, 3.8], [-.45, -D / 2 - .12, 3.8], .1, 5);
      M.block('wood', -1, -D / 2 + 1.4, .6, 1.8, 1, .9); M.block('candle', -1.5, -D / 2 + 1.4, 1.5, .1, .1, .25); M.quad('fire', [[-1.56, -D / 2 + 1.36, 1.75], [-1.44, -D / 2 + 1.36, 1.75], [-1.5, -D / 2 + 1.36, 1.95]].concat([[-1.5, -D / 2 + 1.36, 1.95]]));
      for (const x of [2.4, 4.8]) { gwin(M, x, -D / 2 - .02, 1.8, 1.3, 2.4); gwin(M, x, -D / 2 - .02, 4.6, 1, 1.2); }
      for (const sd of [-1, 1]) gwinSide(M, sd * (W / 2 + .02), 0, 2, 1.4, 2.4, sd);
      steepRoof(M, 'roof_purple', 0, 0, .6 + H, W, D, 5.4, .6, 'stone_dark');
      dormer(M, 3.6, -D / 2 + 1.4, .6 + H + 1, 1.8);
      M.block('stone_dark', -4.5, 2, .6 + H, 1.2, 1.2, 5.6);
      ccSign(M, 1.2, -D / 2 - .9, 5, 'sign_book');
    },
    // the game hall: timber over stone, an open front with tables in teal light, bunting, the dice sign
    cc_game_hall(M) {
      const W = 14, D = 9, H = 5;
      M.block('stone_dark', 0, 0, 0, W + .8, D + .8, .7); steps(M, 0, -(D + .8) / 2, .7, 4, 2, .4);
      M.block('wood', 0, 1, .7, W, D - 2, H); // back room
      M.quad('teal_glow', [[-W / 2 + .6, -D / 2 + 2.95, .75], [W / 2 - .6, -D / 2 + 2.95, .75], [W / 2 - .6, -D / 2 + 2.95, .7 + H - .5], [-W / 2 + .6, -D / 2 + 2.95, .7 + H - .5]]);
      for (const x of [-W / 2 + .3, -W / 6, W / 6, W / 2 - .3]) M.block('darkwood', x, -D / 2 + .3, .7, .34, .34, H);
      M.box('darkwood', [0, -D / 2 + .3, .7 + H - .2], [W + .2, .36, .4]);
      M.block('wood', 0, 0, .7, W, D, .1);
      for (const x of [-4, 0, 4]) { M.block('darkwood', x, -1, .7, 2.2, 1.3, .9); M.block('teal_glow', x, -1, 1.61, 1.8, .9, .04); for (const sd of [-1, 1]) M.block('darkwood', x + sd * 1.5, -1, .7, .5, .5, .5); }
      for (let i = 0; i < 12; i++) { const x0 = -W / 2 + .6 + i * (W - 1.2) / 12, x1 = x0 + (W - 1.2) / 12, zc = .7 + H - .6 - .5 * Math.sin((i + .5) / 12 * Math.PI); M.poly(i % 3 === 0 ? 'banner_cc' : i % 3 === 1 ? 'pumpkin' : 'teal_glow', [[x0, -D / 2 + .1, zc + .3], [x1, -D / 2 + .1, zc + .3], [(x0 + x1) / 2, -D / 2 + .1, zc - .45]]); }
      steepRoof(M, 'roof_purple', 0, 0, .7 + H, W + .4, D + .4, 5, .7, 'wood');
      for (const x of [-4.5, 4.5]) dormer(M, x, -D / 2 + 1.5, .7 + H + 1, 1.8, 'teal_glow');
      ccSign(M, 0, -D / 2 - .3, .7 + H + 2.4, 'sign_dice', 3);
      for (const sd of [-1, 1]) M.block('teal_glow', sd * (W / 2 + .02), 0, 2.4, .04, 1.2, 1.4);
    },
    // the giant dead tree of the square: a twisted trunk with roots, long crooked branches hung with lanterns, in a
    // stone planter ringed with pumpkins; ~15 m
    cc_great_tree(M) {
      M.tube('stone_dark', [0, 0, 0], [0, 0, .7], 4.6, 4.6, 20); M.cyl('earth', [0, 0, .7], 4.3, .05, 20);
      curveTube(M, 'bark_old', [[0, 0, 0], [.3, .2, 2.5], [-.4, .3, 5], [.2, -.2, 7.5], [-.2, 0, 9]], [1.5, 1.05, .8, .6, .4], { segs: 14, n: 4, ridge: .2, bump: .12, seed: 2, k: 7 });
      for (let k = 0; k < 5; k++) { const a = k * 1.26 + .3; curveTube(M, 'bark_old', [[Math.cos(a) * .6, Math.sin(a) * .6, 1.2], [Math.cos(a) * 1.9, Math.sin(a) * 1.9, .7], [Math.cos(a) * 3, Math.sin(a) * 3, .6]], [.55, .28], { segs: 8, n: 3, seed: 10 + k }); }
      const br = [[0, 6, 8.6, 5.2], [1.1, 5.4, 9.4, 4.8], [2.3, 6.4, 9, 5.6], [3.4, 5, 9.8, 4.6], [4.5, 6.6, 8.8, 5.4], [5.6, 7.4, 9.6, 3.8]];
      br.forEach(([a, z0, z1, L], k) => {
        const c = Math.cos(a), s = Math.sin(a), tip = [c * L, s * L, z1 + .6 * Math.sin(k * 2.1)];
        curveTube(M, 'bark_old', [[c * .3, s * .3, z0], [c * L * .45, s * L * .45, z0 + 1.6], [c * L * .8 - s * .6, s * L * .8 + c * .6, z1 - .3], tip], [.42, .26, .14, .05], { segs: 8, n: 3, seed: 20 + k });
        curveTube(M, 'bark_old', [[c * L * .5, s * L * .5, z0 + 1.7], [c * L * .55 + s * 1.2, s * L * .55 - c * 1.2, z0 + 3], [c * L * .5 + s * 2, s * L * .5 - c * 2, z0 + 3.4]], [.14, .04], { segs: 6, n: 3, seed: 40 + k });
        for (const f of [.5, .8]) { const p = [c * L * f - s * .3 * f, s * L * f + c * .3 * f, z0 + (z1 - z0) * f + 1.1 * f]; M.rod('rope', p, [p[0], p[1], p[2] - 1.2], .015, 3); M.block('iron', p[0], p[1], p[2] - 1.32, .3, .3, .06); M.block('window_glow', p[0], p[1], p[2] - 1.8, .26, .26, .46); M.cyl('iron', [p[0], p[1], p[2] - 1.34], .2, .2, 4, .03); }
      });
      for (let k = 0; k < 9; k++) { const a = k * .7 + .2, r = 4.2 + .3 * Math.sin(k * 3); ccPumpkin(M, Math.cos(a) * r, Math.sin(a) * r, .7, .32 + .1 * Math.abs(Math.sin(k * 1.7)), a + Math.PI / 2); }
      M.quad('glow', [[-6, -6, .08], [6, -6, .08], [6, 6, .08], [-6, 6, .08]]);
    },
    // a twisted dead tree, ~7 m
    cc_dead_tree(M) {
      curveTube(M, 'bark_old', [[0, 0, -.2], [.3, .1, 1.6], [-.2, .2, 3.2], [.2, -.1, 4.6]], [.5, .36, .24, .14], { segs: 10, n: 3, ridge: .2, bump: .12, seed: 4, k: 6 });
      for (let k = 0; k < 4; k++) { const a = k * 1.7 + .4, c = Math.cos(a), s = Math.sin(a); curveTube(M, 'bark_old', [[c * .15, s * .15, 2.6 + k * .5], [c * 1.4, s * 1.4, 3.6 + k * .4], [c * 2.4 - s * .5, s * 2.4 + c * .5, 4.8 + k * .3], [c * 3 - s * .9, s * 3 + c * .9, 5.2 + k * .5]], [.2, .12, .06, .02], { segs: 6, n: 3, seed: 50 + k }); }
      for (let k = 0; k < 3; k++) { const a = k * 2.1 + 1; curveTube(M, 'bark_old', [[Math.cos(a) * .3, Math.sin(a) * .3, .3], [Math.cos(a) * 1, Math.sin(a) * 1, 0], [Math.cos(a) * 1.6, Math.sin(a) * 1.6, -.15]], [.24, .08], { segs: 6, n: 3, seed: 60 + k }); }
    },
    cc_pumpkin(M) { ccPumpkin(M, 0, 0, 0, .45, 0); M.quad('glow', [[-1.2, -1.2, .05], [1.2, -1.2, .05], [1.2, 1.2, .05], [-1.2, 1.2, .05]]); },
    cc_pumpkins(M) { for (const [x, y, r, a] of [[0, 0, .5, 0], [.85, .3, .34, -.4], [-.75, .35, .3, .5], [.3, .9, .26, .2]]) ccPumpkin(M, x, y, 0, r, a); M.quad('glow', [[-1.8, -1.8, .05], [1.8, -1.8, .05], [1.8, 1.8, .05], [-1.8, 1.8, .05]]); },
    // iron street lamp with a glowing lantern
    cc_lamp(M) {
      M.cyl('stone_dark', [0, 0, 0], .32, .35, 8); M.cyl('iron', [0, 0, .35], .07, 2.9, 6);
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; M.rod('iron', [Math.cos(a) * .08, Math.sin(a) * .08, 2.6], [Math.cos(a) * .3, Math.sin(a) * .3, 2.95], .025, 3); }
      M.block('window_glow', 0, 0, 3.05, .34, .34, .5); for (const [x, y] of [[-.18, -.18], [.18, -.18], [-.18, .18], [.18, .18]]) M.block('iron', x, y, 3.05, .04, .04, .5);
      M.cyl('iron', [0, 0, 3.55], .3, .3, 4, .03); M.rod('iron', [0, 0, 3.8], [0, 0, 4.05], .02, 3);
      M.quad('glow_warm', [[-2.6, -2.6, .06], [2.6, -2.6, .06], [2.6, 2.6, .06], [-2.6, 2.6, .06]]);
    },
    // wrought-iron fence, 4 m: spear-topped bars on a stone kerb, a stone pillar at the -x end
    cc_fence(M) {
      M.block('stone_dark', 0, 0, 0, 4, .45, .45);
      for (let i = 0; i < 17; i++) { const x = -1.7 + i * .225; M.rod('iron', [x, 0, .45], [x, 0, 1.9], .022, 3); M.cyl('iron', [x, 0, 1.9], .045, .16, 4, .005); }
      for (const z of [.75, 1.65]) M.box('iron', [.15, 0, z], [3.7, .05, .06]);
      M.block('stone_dark', -2, 0, 0, .62, .62, 2.3); M.block('stone_dark', -2, 0, 2.3, .74, .74, .16); M.sphere('stone_dark', [-2, 0, 2.6], .2, 1, 6, 3);
    },
    // the village gate: stone pillars crowned with great jack-o'-lanterns, lanterns, skeletons, the iron gates open
    cc_gate(M) {
      const OW = 5.4;
      for (const sd of [-1, 1]) {
        const x = sd * (OW / 2 + .9);
        M.block('stone_dark', x, 0, 0, 1.8, 1.8, 3.8); M.block('stone_dark', x, 0, 3.8, 2.1, 2.1, .3);
        ccPumpkin(M, x, 0, 4.1, .8, 0);
        M.block('iron', x, -.95, 2.6, .12, .3, .12); M.block('window_glow', x, -1.15, 2, .44, .44, .6); M.cyl('iron', [x, -1.15, 2.6], .3, .25, 4, .04);
        ccSkeleton(M, x + sd * 1.15, -.5, 1.1);
        // the gate leaf swung open (inward, +y), scrolls along the top
        const hx = sd * OW / 2, L = OW / 2 - .1;
        for (let i = 0; i <= 10; i++) { const f = i / 10, px = hx - sd * .1 * f, py = .2 + L * f * .95, h = 3.2 + .5 * Math.sin(f * Math.PI); M.rod('iron', [px, py, .1], [px, py, h], .03, 3); M.cyl('iron', [px, py, h], .06, .2, 4, .005); }
        for (const z of [.4, 1.6, 2.9]) M.rod('iron', [hx, .2, z], [hx - sd * .1, .2 + L * .95, z], .04, 3);
        for (let k = 0; k < 3; k++) M.tube('iron', [hx - sd * .05, .2 + L * (.2 + k * .3), 2.6], [hx - sd * .07, .2 + L * (.2 + k * .3), 2.6], .32, .28, 10, false);
        M.quad('glow', [[x - 2.2, -3.6, .06], [x + 2.2, -3.6, .06], [x + 2.2, .8, .06], [x - 2.2, .8, .06]]);
      }
    },
    // a cluster of graves: headstones (round, cross, obelisk), earth mounds, candles
    cc_graves(M) {
      ccStone(M, -2.2, 0, 'round', 1.3); ccStone(M, 0, .4, 'cross', 1.6); ccStone(M, 2.2, -.1, 'obelisk', 2.1);
      for (const x of [-2.2, 0, 2.2]) M.block('earth', x, -1.4, 0, 1.1, 2.2, .25);
      ccCandles(M, -1.1, -.6, 3); ccCandles(M, 1.2, -.7, 2);
      M.quad('glow', [[-3, -3, .05], [3, -3, .05], [3, 2, .05], [-3, 2, .05]]);
    },
    // the crypt: a dark stone mausoleum with a gabled roof, columns, an arched doorway full of candles, an iron cross
    cc_crypt(M) {
      const W = 6, D = 7, H = 3.6;
      M.block('stone_dark', 0, 0, 0, W + .8, D + .8, .5); steps(M, 0, -(D + .8) / 2, .5, 2.4, 2, .4);
      M.block('stone_dark', 0, .4, .5, W, D - .8, H);
      M.poly('interior', archPts(0, -D / 2 + .38, .5, 2.2, 2.8));
      for (const sd of [-1, 1]) { M.cyl('stone_dark', [sd * 2.3, -D / 2 - .1, .5], .26, H, 10); M.block('stone_dark', sd * 2.3, -D / 2 - .1, .5, .7, .7, .3); }
      M.block('stone_dark', 0, -D / 2 - .1, .5 + H, W + .4, 1.2, .4);
      steepRoof(M, 'stone_dark', 0, 0, .9 + H, W + .2, D + .6, 2.2, .3, 'stone_dark');
      M.rod('iron', [0, -D / 2, .9 + H + 2.2], [0, -D / 2, .9 + H + 3.4], .07, 4); M.rod('iron', [-.4, -D / 2, .9 + H + 3], [.4, -D / 2, .9 + H + 3], .06, 4);
      ccCandles(M, -.6, -D / 2 + .8, 4); ccCandles(M, .7, -D / 2 + .9, 3); ccCandles(M, 1.6, -D / 2 - .7, 2); ccCandles(M, -1.6, -D / 2 - .7, 3);
      M.quad('glow', [[-3.2, -D / 2 - 3.4, .06], [3.2, -D / 2 - 3.4, .06], [3.2, -D / 2 + 1, .06], [-3.2, -D / 2 + 1, .06]]);
    },
    cc_well(M) { M.remap = { roof: 'roof_purple', wood: 'darkwood', stone: 'stone_dark' }; B.sam_well(M); M.remap = null; M.cyl('iron', [0, 0, 1.4], .22, .3, 8, .18); },
    // scarecrow target: a sack head with a stitched grin, straw body, arms on a crossbar, a target on the chest
    cc_scarecrow(M) {
      M.cyl('darkwood', [0, 0, 0], .07, 2.3, 5); M.rod('darkwood', [-.9, 0, 1.75], [.9, 0, 1.75], .05, 4);
      M.cyl('straw', [0, 0, .7], .3, 1.2, 8, .36); M.sphere('sack', [0, 0, 2.25], .3, 1.1, 8, 5);
      for (const sd of [-1, 1]) { M.quad('dark', [[sd * .14 - .05, -.29, 2.3], [sd * .14 + .05, -.29, 2.3], [sd * .14 + .05, -.29, 2.38], [sd * .14 - .05, -.29, 2.38]]); M.cyl('straw', [sd * .95, 0, 1.75], .1, .25, 5, .02); M.rod('straw', [sd * .2, 0, 1.75], [sd * .9, 0, 1.75], .1, 5); }
      M.box('dark', [0, -.3, 2.12], [.3, .01, .04]);
      for (const [r, m, k] of [[.24, 'plaster', 1], [.16, 'red', 2], [.07, 'plaster', 3]]) M.tube(m, [0, -.36 - .005 * k, 1.35], [0, -.37 - .005 * k, 1.35], r, r, 14);
      M.cyl('sack', [0, 0, 2.48], .36, .06, 8); M.cyl('sack', [0, 0, 2.52], .16, .3, 6, .04); // hat
    },
    // a ghost: floating, pale and glowing (bobs gently, see animate)
    cc_ghost(M) {
      M.sphere('ghost', [0, 0, 2.05], .48, 1.05, 12, 6);
      const n = 14, ring = (z, r, w) => Array.from({ length: n }, (_, k) => { const a = k / n * Math.PI * 2; return [Math.cos(a) * r, Math.sin(a) * r, z + w * Math.sin(a * 5)]; });
      const rows = [ring(2.0, .5, 0), ring(1.4, .62, .02), ring(.9, .74, .06), ring(.5, .82, .14)];
      for (let i = 0; i < rows.length - 1; i++) for (let k = 0; k < n; k++) { const k2 = (k + 1) % n; M.poly('ghost', [rows[i][k], rows[i][k2], rows[i + 1][k2], rows[i + 1][k]]); }
      for (const sd of [-1, 1]) { M.rod('ghost', [sd * .4, -.1, 1.65], [sd * .85, -.35, 1.3], .14, 6); M.quad('dark', [[sd * .17 - .08, -.46, 2.08], [sd * .17 + .08, -.46, 2.08], [sd * .17 + .06, -.45, 2.26], [sd * .17 - .06, -.45, 2.26]]); }
      M.quad('dark', [[-.1, -.47, 1.82], [.1, -.47, 1.82], [.08, -.46, 1.95], [-.08, -.46, 1.95]]);
    },
    cc_candles(M) { ccCandles(M, 0, 0, 5); M.quad('glow', [[-1.4, -1.4, .05], [1.4, -1.4, .05], [1.4, 1.4, .05], [-1.4, 1.4, .05]]); },
    cc_bench(M) { M.block('darkwood', 0, 0, .45, 2.4, .5, .1); for (const sd of [-1, 1]) M.block('darkwood', sd * 1, 0, 0, .12, .45, .45); M.block('darkwood', 0, .22, .55, 2.4, .08, .55); },
    // ── the Cute & Creepy gang (Miguel's NFTs), low poly: three kokeshi dolls and two lucky cats; used as NPC
    //    models (fallbackType 'kit:<type>') or placed as figures. Front faces -y; they rock / wave (see animate) ──
    cc_flower_moon(M) { // Kokeshi Flower Moon: black kimono with skulls, red front panel, skull and flower crown, hairpins
      kokeshi(M, 'kimono_fm', 'obi_red', 'face_fm', 'skin_w', 'hair_black');
      M.sphere('bone', [0, .06, 1.86], .15, .95, 8, 5); for (const sd of [-1, 1]) M.quad('dark', [[sd * .055 - .03, -.085, 1.86], [sd * .055 + .03, -.085, 1.86], [sd * .055 + .03, -.085, 1.9], [sd * .055 - .03, -.085, 1.9]]);
      for (const [x, y, z, r] of [[-.2, -.02, 1.8, .09], [.2, -.02, 1.8, .09], [-.1, -.1, 1.76, .07], [.12, -.1, 1.76, .07], [0, .18, 1.84, .08]]) ccFlower(M, 'flower_pink', x, y, z, r);
      for (const sd of [-1, 1]) { M.rod('darkwood', [sd * .2, .12, 1.72], [sd * .52, .1, 1.98], .018, 4); M.sphere('red', [sd * .52, .1, 1.98], .04, 1, 5, 3); }
      for (const [x, z, r] of [[.46, .55, .13], [.44, .32, .1], [-.47, .7, .1]]) ccFlower(M, 'flower_pink', x, -.15, z, r);
    },
    cc_nariko(M) { // Nariko: blue kokeshi with horns, holding a crackling lightning orb (subpart cc_orb)
      kokeshi(M, 'kimono_nr', 'obi_silver', 'face_nr', 'skin_blue', 'hair_blue');
      for (const sd of [-1, 1]) curveTube(M, 'horn', [[sd * .22, 0, 1.66], [sd * .42, -.02, 1.84], [sd * .4, 0, 2.08]], [.075, .045, .01], { segs: 8, n: 3, ridge: .05, bump: .03, seed: 3 });
      for (const sd of [-1, 1]) M.sphere('skin_blue', [sd * .2, -.5, .72], .08, 1, 6, 4);
    },
    cc_ostara(M) { // Ostara: teal kokeshi with long bunny ears, a skull crown with teal flowers, glowing eyes
      kokeshi(M, 'kimono_os', 'obi_black', 'face_os', 'skin_w', 'hair_black');
      for (const sd of [-1, 1]) { M.sphere('ear_os', [sd * .17, .06, 2.08], .12, 2.9, 8, 6); M.sphere('flower_teal', [sd * .17, -.03, 2.1], .06, 3.6, 6, 4); }
      M.sphere('bone', [0, .02, 1.84], .14, .95, 8, 5); for (const sd of [-1, 1]) M.quad('teal_glow', [[sd * .05 - .03, -.12, 1.84], [sd * .05 + .03, -.12, 1.84], [sd * .05 + .03, -.12, 1.88], [sd * .05 - .03, -.12, 1.88]]);
      for (const [x, y, z, r] of [[-.2, -.04, 1.8, .08], [.2, -.04, 1.8, .08], [0, -.12, 1.94, .06]]) ccFlower(M, 'flower_teal', x, y, z, r);
    },
    cc_mamoru(M) { // Mamoru: black skeleton lucky cat, a skull with a candle on its head, a jack-o'-lantern under one paw
      luckyCat(M, 'coat_mamoru', 'cat_black', 'face_mamoru', 'flower_orange');
      M.sphere('bone', [0, -.02, 1.72], .2, .9, 8, 5); for (const sd of [-1, 1]) M.quad('dark', [[sd * .07 - .045, -.2, 1.71], [sd * .07 + .045, -.2, 1.71], [sd * .07 + .045, -.2, 1.77], [sd * .07 - .045, -.2, 1.77]]);
      M.cyl('candle', [0, 0, 1.86], .07, .3, 8); for (const [a, h] of [[0, .12], [2, .18], [4, .1]]) M.cyl('candle', [Math.cos(a) * .07, Math.sin(a) * .07, 2.16 - h], .025, h, 4);
      M.cyl('collar_red', [0, 0, .96], .43, .1, 14); M.sphere('gem_green', [0, -.45, .99], .09, 1, 8, 4); M.tube('gold', [0, -.44, .99], [0, -.46, .99], .12, .12, 10, false);
      ccPumpkin(M, -.46, -.42, 0, .3, .2); M.rod('cat_black', [-.3, -.28, .72], [-.42, -.44, .58], .1, 6); M.sphere('cat_black', [-.43, -.46, .56], .12, 1, 6, 4);
    },
    cc_mochi(M) { // Mochi: white and red lucky cat with a skull on its head, a gold koban, cherry blossoms
      luckyCat(M, 'coat_mochi', 'cat_white', 'face_mochi', 'ear_pink');
      M.sphere('bone', [0, -.02, 1.72], .19, .9, 8, 5); for (const sd of [-1, 1]) M.quad('dark', [[sd * .07 - .045, -.19, 1.71], [sd * .07 + .045, -.19, 1.71], [sd * .07 + .045, -.19, 1.77], [sd * .07 - .045, -.19, 1.77]]);
      M.cyl('collar_red', [0, 0, .96], .43, .1, 14); M.sphere('gold', [0, -.46, .9], .1, 1, 8, 4);
      M.tube('gold', [-.4, -.52, .55], [-.4, -.46, .55], .26, .26, 14); M.tube('dark', [-.4, -.525, .55], [-.4, -.53, .55], .1, .1, 8, false);
      M.rod('cat_white', [-.3, -.28, .74], [-.36, -.48, .7], .1, 6); M.sphere('cat_white', [-.36, -.5, .7], .12, 1, 6, 4);
      for (const [x, y, z, r] of [[.5, -.3, .1, .13], [.62, 0, .25, .11], [-.62, .1, .2, .12], [.55, -.2, .45, .1]]) ccFlower(M, 'flower_pink', x, y, z, r);
    },
    // subparts (built under their own pivot so they move): the beckoning paws, Mamoru's flame, Nariko's orb
    cc_paw_black(M) { M.rod('cat_black', [0, 0, 0], [.02, -.08, .4], .11, 7); M.sphere('cat_black', [.02, -.09, .46], .14, 1, 8, 5); for (const x of [-.05, 0, .05]) M.sphere('bone', [.02 + x, -.22, .5], .028, 1, 5, 3); M.sphere('bone', [.02, -.22, .42], .045, 1, 5, 3); },
    cc_paw_white(M) { M.rod('cat_white', [0, 0, 0], [.02, -.08, .4], .11, 7); M.sphere('cat_white', [.02, -.09, .46], .14, 1, 8, 5); for (const x of [-.05, 0, .05]) M.sphere('ear_pink', [.02 + x, -.22, .5], .028, 1, 5, 3); M.sphere('ear_pink', [.02, -.22, .42], .045, 1, 5, 3); },
    cc_candle_flame(M) { M.quad('fire', [[-.05, 0, 0], [.05, 0, 0], [0, 0, .16]]); M.quad('fire', [[0, -.05, 0], [0, .05, 0], [0, 0, .14]]); },
    cc_orb(M) {
      M.sphere('orb', [0, 0, 0], .2, 1, 12, 8);
      for (let k = 0; k < 6; k++) { const a = k * 1.05, b = a + .6; M.rod('orb', [Math.cos(a) * .2, Math.sin(a) * .2 * .5, Math.sin(a) * .2], [Math.cos(b) * .34, Math.sin(b) * .1, Math.sin(b * 1.3) * .3], .012, 3); }
      M.quad('glow_blue', [[-1.6, -1.6, -.7], [1.6, -1.6, -.7], [1.6, 1.6, -.7], [-1.6, 1.6, -.7]]);
    },
    // ── Chumpz (the apes' tropical banana-bar village) ──
    // coconut palm, ~9 m: a leaning ringed trunk, a crown of drooping fronds, coconuts
    chz_palm(M) {
      const T = [2, .3, 8.4];
      curveTube(M, 'palm_bark', [[0, 0, -.2], [.25, .05, 3], [.9, .15, 6], [T[0], T[1], T[2]]], [.34, .27, .22, .18], { segs: 8, n: 4, ridge: .06, bump: .06, k: 3, seed: 5 });
      for (let k = 0; k < 9; k++) {
        const a = k / 9 * Math.PI * 2 + .3, d = [Math.cos(a), Math.sin(a)], L = 4.4 + .6 * Math.sin(k * 2.3), up = .5 + .3 * Math.cos(k * 1.7);
        leafStrip(M, 'palm_leaf', f => [T[0] + d[0] * L * f, T[1] + d[1] * L * f, T[2] + up * 2 * f * (1 - f) * 2 - 1.6 * f * f * f], f => .75 * Math.sin(Math.PI * Math.min(1, f * 1.15)) * (1 - .3 * f), d, .35, 6);
      }
      for (const [x, y] of [[.25, .2], [-.2, .15], [.05, -.25], [-.1, -.05]]) M.sphere('coconut', [T[0] + x, T[1] + y, T[2] - .35], .2, 1, 7, 4);
    },
    // banana plant, ~3.5 m: a green stem, big drooping leaves, a hanging bunch with its purple flower
    chz_banana(M) {
      M.cyl('banana_stem', [0, 0, 0], .2, 2.2, 8, .14);
      for (let k = 0; k < 7; k++) {
        const a = k / 7 * Math.PI * 2 + .5, d = [Math.cos(a), Math.sin(a)], L = 2.1 + .4 * Math.sin(k * 1.9), z0 = 1.9 + .3 * (k % 3);
        leafStrip(M, 'banana_leaf', f => [d[0] * L * f, d[1] * L * f, z0 + 1.1 * f * (1 - f) * 2 - .9 * f * f], f => .42 * Math.sin(Math.PI * Math.min(1, .15 + f * .95)), d, .12, 5);
      }
      M.rod('banana_stem', [.1, -.1, 2.1], [.45, -.4, 1.5], .04, 4);
      for (let r = 0; r < 4; r++) for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, c = [.45 + Math.cos(a) * .14, -.4 + Math.sin(a) * .14, 1.62 - r * .14]; M.rod('banana', c, [c[0] + Math.cos(a) * .12, c[1] + Math.sin(a) * .12, c[2] + .14], .035, 4); }
      M.sphere('flower_purple', [.47, -.42, 1.02], .1, 1.6, 6, 4);
    },
    // the banana bar (images 1, 3, 4): a two-storey shack on a deck, the open ground floor with the long bar, bottle
    // shelves, kegs, the stage with its red curtain, pool tables, darts; a balcony with string lights and the giant
    // banana sign, yellow awnings, a patchwork tin roof, the outside stair. 24 x 16 m, front faces -y; floor walkable
    chz_bar(M) {
      const W = 24, D = 14, Z = .7, H1 = 4.4, yF = -D / 2;
      M.block('wood', 0, -1.6, 0, W + 2, D + 3.2, Z); steps(M, 0, yF - 3.2, Z, 8, 2, .45); // deck + porch, steps
      for (let i = 0; i < 9; i++) M.box('darkwood', [-W / 2 - .5 + i * (W + 1) / 8, yF - 3.2, Z / 2], [.3, .3, Z]);
      // ground floor: back and side walls, posts along the open front, doors swung open
      M.block('plank_teal', 0, D / 2 - .15, Z, W, .3, H1); M.block('plank_teal', -W / 2 + .15, 0, Z, .3, D, H1); M.block('plank_teal', W / 2 - .15, 0, Z, .3, D, H1);
      for (const x of [-W / 2, -W / 4, -2.6, 2.6, W / 4, W / 2]) M.block('wood', x, yF, Z, .4, .4, H1);
      for (const sd of [-1, 1]) { M.block('plank_yellow', sd * 4.1, yF - 1.2, Z, .18, 2.6, 3.4); M.box('darkwood', [sd * 4.1, yF - 1.2, Z + 1.7], [.2, 2.7, .12], .6 * sd); }
      // the bar: counter, shelves of bottles, kegs, stools
      M.block('wood', 2, D / 2 - 2.4, Z, 12, 1, 1.15); M.block('darkwood', 2, D / 2 - 2.4, Z + 1.15, 12.4, 1.2, .1);
      M.quad('bottles', [[-4, D / 2 - .32, Z + 1.3], [8, D / 2 - .32, Z + 1.3], [8, D / 2 - .32, Z + 3.6], [-4, D / 2 - .32, Z + 3.6]]);
      for (const x of [-2, -.6, .8]) { M.cyl('wood', [x, D / 2 - 1.2, Z + 1.25], .45, .9, 10); for (const z of [.15, .75]) M.cyl('iron', [x, D / 2 - 1.2, Z + 1.25 + z], .47, .05, 10); }
      for (let i = 0; i < 7; i++) chzStool(M, -3 + i * 1.7, D / 2 - 3.5, Z);
      // the stage (left): raised, red curtain behind, a mic, string lights
      M.block('wood', -W / 2 + 3.6, yF + 3, Z, 6.4, 5, .5); M.quad('curtain_red', [[-W / 2 + .5, yF + 5.4, Z + .5], [-W / 2 + 6.7, yF + 5.4, Z + .5], [-W / 2 + 6.7, yF + 5.4, Z + 3.9], [-W / 2 + .5, yF + 5.4, Z + 3.9]]);
      M.cyl('iron', [-W / 2 + 3.6, yF + 2, Z + .5], .03, 1.5, 4); M.sphere('iron', [-W / 2 + 3.6, yF + 2, Z + 2.05], .08, 1, 6, 3);
      // pool tables and darts (right), round tables
      for (const [x, y, m] of [[7.5, -1.5, 'felt_green'], [7.5, 2, 'felt_blue']]) { M.block('darkwood', x, y, Z, 3, 1.6, .85); M.block(m, x, y, Z + .85, 2.7, 1.3, .05); for (const sx of [-1, 1]) for (const sy of [-1, 1]) M.block('darkwood', x + sx * 1.3, y + sy * .65, Z, .18, .18, .85); }
      M.tube('darts', [W / 2 - .32, 3, Z + 2.2], [W / 2 - .34, 3, Z + 2.2], .45, .45, 16);
      for (const [x, y] of [[-2.5, -3], [0, -1], [2.8, -3.2], [-4.5, -.5]]) chzTable(M, x, y, Z);
      // upper floor, balcony with railing and string lights, upper walls with lit windows
      M.block('wood', 0, -1, Z + H1, W + .6, D + 2.4, .3);
      for (let i = 0; i <= 12; i++) { const x = -W / 2 + i * W / 12; M.block('wood', x, yF - 2, Z + H1 + .3, .14, .14, 1.1); }
      M.box('wood', [0, yF - 2, Z + H1 + 1.4], [W + .2, .16, .16]); M.box('wood', [0, yF - 2, Z + H1 + .85], [W + .2, .1, .1]);
      for (const x of [-W / 2, -W / 4, 0, W / 4, W / 2]) M.block('wood', x, yF - 2, Z, .36, .36, H1 + 1.6);
      for (let i = 0; i < 24; i++) { const x = -W / 2 + .5 + i * (W - 1) / 23, z = Z + H1 + 2.6 - .35 * Math.sin((i % 6) / 5 * Math.PI); M.sphere('window_glow', [x, yF - 2.05, z], .08, 1, 5, 3); }
      M.rod('rope', [-W / 2, yF - 2.05, Z + H1 + 2.6], [W / 2, yF - 2.05, Z + H1 + 2.6], .015, 3);
      M.block('plank_teal', 0, 0, Z + H1 + .3, W - 1, D - 1.4, 3.6);
      for (const x of [-8, -3, 3, 8]) { M.block('window_glow', x, -D / 2 + .68, Z + H1 + 1.4, 1.6, .06, 1.2); M.box('plank_yellow', [x, -D / 2 + .62, Z + H1 + 2.05], [1.9, .08, .14]); M.box('plank_yellow', [x, -D / 2 + .62, Z + H1 + 1.35], [1.9, .08, .14]); }
      for (const [x, y] of [[-6, -1], [0, 1], [6, -1]]) chzTable(M, x, y - D / 2 + .2 - 1, Z + H1 + .3);
      // the giant banana sign hung on the balcony front
      chzBanana(M, 0, yF - 2.5, Z + H1 + 2.4, 13, .95, 1.5);
      for (const sd of [-1, 1]) M.rod('rope', [sd * 5, yF - 2.4, Z + H1 + 2.6], [sd * 5, yF - 2.4, Z + H1 + 1.9], .04, 4);
      // yellow awnings either side of the doors
      for (const sd of [-1, 1]) { const x0 = sd * 4.6, x1 = sd * 11; M.quad('awning', [[Math.min(x0, x1), yF - .1, Z + 3.8], [Math.max(x0, x1), yF - .1, Z + 3.8], [Math.max(x0, x1), yF - 3, Z + 3], [Math.min(x0, x1), yF - 3, Z + 3]]); for (const x of [x0, x1]) M.rod('wood', [x, yF - 3, Z], [x, yF - 3, Z + 3.05], .06, 4); }
      // roof: tin patchwork with thatch patches, a chimney; the outside stair (right)
      steepRoof(M, 'tin_roof', 0, 0, Z + H1 + 3.9, W, D, 4.2, .9, 'plank_teal');
      for (const [x, y] of [[-6, -3.2], [5, 2.6]]) M.box('thatch', [x, y * .9, Z + H1 + 3.9 + 4.2 * (1 - Math.abs(y) / (D / 2 + .9)) + .08], [5, 3, .2], 0, Math.atan2(4.2, D / 2 + .9) * -Math.sign(y));
      M.block('brick', 7.5, 2.4, Z + H1 + 5, 1.2, 1.2, 4.2);
      for (let i = 0; i < 14; i++) M.block('wood', W / 2 + 1.1, 4.2 - i * .62, (i + 1) * (Z + H1 + .3) / 14 - .15, 1.6, .62, .15);
      M.rod('wood', [W / 2 + 1.9, 4.6, Z + H1 + 1.4], [W / 2 + 1.9, -4.4, .8], .07, 4);
      for (const [x, y] of [[-W / 2 - .3, yF - 2.4], [W / 2 + .3, yF - 2.4], [-2.6, yF - .2], [2.6, yF - .2]]) chzLantern(M, x, y, Z + 3.3);
      for (const [x, y] of [[-W / 2 - .2, yF - 4], [W / 2 - 3, yF - 4.2], [-6, yF - 4.4]]) M.cyl('wood', [x, y, 0], .45, 1.1, 10, .45);
    },
    // bait & book shop: turquoise planks, an open front onto shelves, rods and nets, the fish-and-book sign
    chz_bait_shop(M) { chzShop(M, 'plank_teal', 'sign_fishbook', 'bait'); },
    // the dice hall: yellow and red planks, felt card tables inside, the dice sign
    chz_dice_hall(M) { chzShop(M, 'plank_yellow', 'sign_chzdice', 'dice'); },
    // shacks: colourful planks, a tin roof, a porch, a lit window; the hut has a thatched roof
    chz_shack(M) { chzShack(M, 'plank_teal', 'tin_roof'); },
    chz_shack_red(M) { chzShack(M, 'plank_red', 'tin_roof'); },
    chz_hut(M) { chzShack(M, 'plank_yellow', 'thatch'); },
    // smokehouse: a brick oven with a tall chimney (smoke), an open shed hung with fish
    chz_smokehouse(M) {
      M.block('stone', 0, 0, 0, 7, 5, .2);
      for (const x of [-3.2, 0, 3.2]) for (const y of [-2.2, 2.2]) M.block('wood', x, y, .2, .25, .25, 2.9);
      steepRoof(M, 'tin_roof', 0, 0, 3.1, 7, 5, 1.6, .5, 'wood');
      M.block('brick', 2.2, .9, .2, 2, 2, 1.6); M.block('brick', 2.6, 1.2, 1.8, 1, 1, 5); M.quad('fire', [[1.5, -.12, .5], [2.9, -.12, .5], [2.9, -.12, 1.2], [1.5, -.12, 1.2]]);
      for (let k = 0; k < 5; k++) M.sphere('smoke', [2.6 + .2 * k, 1.2 + .1 * k, 7.2 + k * .9], .4 + .15 * k, 1, 6, 4);
      for (let i = 0; i < 6; i++) chzFish(M, -2.6 + i * .6, -.3, 2.4);
      M.box('wood', [-1.1, -.3, 2.55], [4, .1, .1]);
      M.quad('glow', [[.2, -2.8, .25], [4.2, -2.8, .25], [4.2, 1, .25], [.2, 1, .25]]);
    },
    // fish drying rack: a frame hung with fish
    chz_fish_rack(M) { for (const x of [-1.6, 1.6]) M.block('wood', x, 0, 0, .14, .14, 2.3); M.box('wood', [0, 0, 2.2], [3.5, .1, .1]); for (let i = 0; i < 6; i++) chzFish(M, -1.3 + i * .52, 0, 2.15); },
    // the giant banana over the well: a stone well ringed with plants and barrels, the banana resting on two posts
    chz_banana_well(M) {
      M.cyl('stone', [0, 0, 0], 2.2, .9, 16); M.cyl('water', [0, 0, .2], 1.8, .65, 16); M.cyl('stone', [0, 0, .9], 2.35, .14, 16);
      for (const [x, z] of [[-3.6, 2.4], [3.4, 3.2]]) M.block('wood', x, .2, 0, .4, .4, z);
      chzBanana(M, 0, .2, 4, 9.5, 1.1, 1.3, true);
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + .3; leafStrip(M, 'banana_leaf', f => [Math.cos(a) * (2.5 + 1.2 * f), Math.sin(a) * (2.5 + 1.2 * f), .2 + .9 * f * (1 - f) * 2], f => .3 * Math.sin(Math.PI * Math.min(1, .2 + f)), [Math.cos(a), Math.sin(a)], .1, 4); }
      for (const [x, y] of [[-2.8, -1.4], [2.9, -1], [2.4, 1.8]]) { M.cyl('wood', [x, y, 0], .42, 1.1, 10, .42); for (const z of [.15, .9]) M.cyl('iron', [x, y, z], .44, .05, 10); }
    },
    // boardwalk, 8 x 6: plank deck (top at the origin) on posts down into the water, rope posts on the water side (-y)
    chz_dock(M) {
      M.block('wood', 0, 0, -.3, 8, 6, .3);
      for (let i = 0; i < 16; i++) M.box('darkwood', [-3.75 + i * .5, 0, .005], [.04, 6, .02]);
      for (const x of [-3.8, 0, 3.8]) for (const y of [-2.8, 0, 2.8]) M.cyl('bark', [x, y, -4], .18, 4, 6);
      for (const x of [-3.8, 0, 3.8]) { M.cyl('wood', [x, -2.9, 0], .16, 1.1, 8); M.cyl('rope', [x, -2.9, .7], .19, .2, 8); }
      for (const sd of [-1, 1]) M.rod('rope', [0, -2.9, .9], [sd * 3.8, -2.9, .9], .03, 3);
    },
    // narrow pier, 3 x 10, out into the lagoon, rope rails both sides
    chz_pier(M) {
      M.block('wood', 0, 0, -.25, 3, 10, .25);
      for (let i = 0; i < 20; i++) M.box('darkwood', [0, -4.75 + i * .5, .005], [3, .04, .02]);
      for (const sd of [-1, 1]) for (const y of [-4.8, -1.6, 1.6, 4.8]) { M.cyl('bark', [sd * 1.35, y, -4], .17, 5.1, 6); M.cyl('rope', [sd * 1.35, y, .7], .2, .18, 8); }
      for (const sd of [-1, 1]) M.rod('rope', [sd * 1.35, -4.8, .85], [sd * 1.35, 4.8, .85], .03, 3);
    },
    // rowboat with oars, a net and a barrel (floats on the water)
    chz_rowboat(M) {
      const L = 4.6;
      chzHull(M, L, .95, .95, 'plank_teal', 'wood');
      for (const y of [-.6, .7]) M.box('wood', [0, y, .8], [1.8, .3, .08]);
      for (const sd of [-1, 1]) M.rod('wood', [sd * .9, -.2, .9], [sd * 1.8, .9, .6], .04, 4);
      M.cyl('wood', [.3, 1.4, .4], .3, .6, 8); M.sphere('net', [-.3, -1.4, .55], .45, .4, 8, 4);
    },
    // fishing sailboat, ~9 m: a single mast with a furled sail, nets
    chz_sailboat(M) {
      const L = 9;
      chzHull(M, L, 1.6, 1.45, 'plank_red', 'wood');
      M.cyl('wood', [0, .6, .5], .14, 8, 8); M.rod('wood', [0, .6, 2.2], [0, 4, 2.2], .09, 6); M.rod('sack', [0, .7, 2.4], [0, 3.9, 2.4], .3, 8);
      M.rod('rope', [0, .6, 8.3], [0, L / 2 - .2, 1.3], .02, 3); M.rod('rope', [0, .6, 8.3], [0, -L / 2 + .3, 1.3], .02, 3);
      M.sphere('net', [-.6, -2.6, 1], .7, .4, 8, 4); M.cyl('wood', [.7, -3, .6], .35, .7, 8);
    },
    chz_barrels(M) { for (const [x, y, z] of [[0, 0, 0], [.95, .2, 0], [.4, .9, 0], [.45, .35, 1.12]]) { M.cyl('wood', [x, y, z], .44, 1.1, 10, .44); for (const dz of [.15, .9]) M.cyl('iron', [x, y, z + dz], .46, .05, 10); } },
    chz_crates(M) {
      for (const [x, y, z, s] of [[0, 0, 0, 1], [1.05, .1, 0, .9], [.5, 0, 1, .85]]) { M.block('wood', x, y, z, s, s, s); M.box('darkwood', [x, y - s / 2 - .01, z + s / 2], [s, .02, .08], .78); }
      M.block('wood', -1.2, .2, 0, 1.1, .8, .5); for (let i = 0; i < 9; i++) M.rod('banana', [-1.6 + (i % 3) * .3, -.05 + Math.floor(i / 3) * .25, .55], [-1.45 + (i % 3) * .3, -.05 + Math.floor(i / 3) * .25, .7], .05, 4);
    },
    chz_bottles(M) { for (let i = 0; i < 9; i++) { const a = i * 2.39, r = .3 + .25 * (i % 4), x = Math.cos(a) * r, y = Math.sin(a) * r, m = ['bottle_green', 'bottle_brown', 'bottle_clear'][i % 3]; if (i % 3 === 2) M.rod(m, [x, y, .06], [x + .28, y + .1, .06], .055, 6); else { M.cyl(m, [x, y, 0], .055, .22, 6); M.cyl(m, [x, y, .22], .055, .1, 6, .02); } } },
    chz_table(M) { chzTable(M, 0, 0, 0); },
    chz_lantern_post(M) { M.cyl('wood', [0, 0, 0], .14, 2.5, 6); M.cyl('rope', [0, 0, 1.6], .17, .4, 8); M.rod('wood', [0, 0, 2.3], [.55, 0, 2.3], .05, 4); chzLantern(M, .55, 0, 2.25); M.quad('glow', [[-2, -2, .05], [2, -2, .05], [2, 2, .05], [-2, 2, .05]]); },
    chz_net_line(M) { for (const x of [-2, 2]) M.cyl('wood', [x, 0, 0], .12, 2.2, 6); M.rod('rope', [-2, 0, 2], [2, 0, 2], .02, 3); for (let i = 0; i < 4; i++) M.quad('net', [[-2 + i, 0, .4 + .2 * Math.sin(i)], [-1 + i, 0, .5], [-1 + i, 0, 2], [-2 + i, 0, 2]]); },
    chz_lilypads(M) { for (let i = 0; i < 9; i++) { const a = i * 2.4, r = .4 + .35 * (i % 4); M.cyl('lily', [Math.cos(a) * r * 1.6, Math.sin(a) * r * 1.6, 0], .32 + .1 * (i % 3), .03, 9); if (i % 4 === 0) M.sphere('flower_pink', [Math.cos(a) * r * 1.6, Math.sin(a) * r * 1.6, .08], .08, .8, 6, 3); } },
    cc_banner_pole(M) {
      M.cyl('iron', [0, 0, 0], .07, 5.6, 6); M.cyl('stone_dark', [0, 0, 0], .4, .4, 8, .32);
      M.box('iron', [0, -.02, 5.3], [1.8, .06, .06]); for (const sd of [-1, 1]) M.cyl('iron', [sd * .9, -.02, 5.3], .05, .2, 4, .005);
      M.quad('banner_cc', [[-.8, -.06, 1.8], [.8, -.06, 1.8], [.8, -.06, 5.25], [-.8, -.06, 5.25]]);
      M.rod('iron', [0, 0, 5.6], [0, 0, 6], .03, 3); M.sphere('iron', [0, 0, 5.75], .1, 1, 6, 3);
    },
    // vegetable garden: a raised bed of dark earth with rows of greens, a plank edge, bean stakes
    war_garden(M) {
      M.block('darkwood', 0, 0, 0, 6.2, 3.2, .3); M.block('earth', 0, 0, 0, 5.9, 2.9, .34);
      for (let r = 0; r < 4; r++) for (let i = 0; i < 8; i++) M.sphere('leaf', [-2.5 + i * .72 + (r % 2) * .2, -1.05 + r * .7, .42], .26 + .05 * Math.sin(i * 3 + r), .7, 6, 3);
      for (let i = 0; i < 5; i++) M.rod('wood', [-2.6 + i * 1.3, 1.35, .3], [-2.6 + i * 1.3, 1.35, 1.6], .03, 4);
      M.rod('rope', [-2.6, 1.35, 1.5], [2.6, 1.35, 1.5], .015, 3);
    },
    // ── Ronin (the forgotten clan) ──
    // the giant bonsai of the plaza: a twisted old trunk with roots clasping a mossy rock mound, long branches ending
    // in layered cloud pads of pine needles. ~14 m tall, crown ~26 m across; base at the origin (mound 2.3 m high)
    ronin_bonsai(M) {
      const H0 = 2.25, moundZ = r => 2.4 * Math.sqrt(Math.max(0, 1 - (r / 7) ** 2));
      // rock mound, boulders round its foot, moss, low shrubs, a kerb of flat stones
      blob(M, 'granite', [0, 0, -.3], 7, 6.8, 2.6, { amp: .1, freq: 1.4, seed: 3, segs: 28, rings: 10, flat: .2, uvs: 5 });
      for (let k = 0; k < 15; k++) { const a = k / 15 * 6.28 + .3 * Math.sin(k * 3.1), r = 6.2 + .9 * Math.sin(k * 1.7), s = 1 + .6 * Math.abs(Math.sin(k * 2.3)); blob(M, 'granite', [Math.cos(a) * r, Math.sin(a) * r, s * .35], s * 1.25, s, s * .85, { amp: .22, seed: k * 7.1, segs: 12, rings: 7, flat: .3 }); }
      for (let k = 0; k < 9; k++) { const a = k / 9 * 6.28 + 1.1, r = 3 + 1.6 * Math.abs(Math.sin(k * 1.9)); blob(M, 'moss', [Math.cos(a) * r, Math.sin(a) * r, moundZ(r) - .25], 1.6, 1.3, .45, { amp: .25, seed: 40 + k, segs: 10, rings: 6 }); }
      for (let k = 0; k < 11; k++) { const a = k / 11 * 6.28 + .45, r = 7.3 + .5 * Math.sin(k * 2.9), s = .7 + .35 * Math.abs(Math.sin(k * 1.3)); blob(M, 'needles_dark', [Math.cos(a) * r, Math.sin(a) * r, s * .5], s * 1.2, s * 1.1, s * .8, { amp: .3, freq: 2.4, seed: 60 + k, segs: 10, rings: 6 }); }
      for (let k = 0; k < 30; k++) { const a = k / 30 * 6.28, r = 8.6; M.box('stone', [Math.cos(a) * r, Math.sin(a) * r, .1], [1.6, .9, .25], a + Math.PI / 2); }
      // trunk: flared base, leaning and twisting up to the crown
      const trunk = [[0, 0, H0 - .6], [-.5, .2, H0 + 1.4], [.7, .5, H0 + 3.4], [1.9, -.1, H0 + 5], [1.3, -.6, H0 + 6.8], [-.3, -.3, H0 + 8.2], [-1.5, .4, H0 + 9.6], [-.9, .7, H0 + 10.9], [.1, .4, H0 + 11.8]];
      const tp = curveTube(M, 'bark_old', trunk, [3.6, 2.7, 2.25, 1.95, 1.7, 1.45, 1.22, 1.0, .78, .56], { segs: 24, n: 6, ridge: .17, k: 7, twist: .42, bump: .12, seed: 1 });
      const at = z => tp.reduce((b, p) => Math.abs(p[2] - z) < Math.abs(b[2] - z) ? p : b, tp[0]);
      // roots over the mound
      for (let k = 0; k < 9; k++) {
        const a = k / 9 * 6.28 + .35, P = [];
        for (const r of [1.2, 2.4, 3.6, 4.8, 5.9, 6.8]) P.push([Math.cos(a + .06 * r * Math.sin(k)) * r, Math.sin(a + .06 * r * Math.sin(k)) * r, Math.max(.05, moundZ(r) + .15) + (r < 2 ? H0 - moundZ(r) - .2 : 0)]);
        curveTube(M, 'bark_old', P, [.95, .7, .52, .36, .24, .13], { segs: 10, n: 3, ridge: .1, k: 3, twist: .5, bump: .15, seed: 10 + k });
      }
      // branches -> cloud pads [start z on the trunk, points..., pad: [x, y, z, rx, ry, h]]
      const branches = [
        [H0 + 4.2, [[5, -2.2, H0 + 4.9], [9, -3.2, H0 + 4.6], [12.4, -2.6, H0 + 5.3]], [12.8, -2.6, H0 + 5.9, 4.6, 3.6, 1.9], [[7.4, -4.1, H0 + 5.4, 2.4, 2, 1.2]]],
        [H0 + 5.3, [[-4, 1.6, H0 + 5.8], [-8, 2.1, H0 + 5.9], [-11.6, 1, H0 + 6.6]], [-12, 1, H0 + 7.2, 4.4, 3.5, 1.8], [[-6.8, 3.2, H0 + 6.6, 2.2, 1.9, 1.1]]],
        [H0 + 7, [[3.8, 3, H0 + 7.8], [7.4, 5, H0 + 8.2]], [7.9, 5.3, H0 + 8.9, 3.7, 3, 1.6], []],
        [H0 + 8, [[-3.9, -3.4, H0 + 8.8], [-7, -5.5, H0 + 9]], [-7.5, -5.9, H0 + 9.6, 3.5, 2.9, 1.5], []],
        [H0 + 9, [[3.4, -4, H0 + 9.6], [5.6, -6.1, H0 + 10.1]], [6, -6.4, H0 + 10.7, 3.1, 2.6, 1.4], []],
        [H0 + 10.2, [[-3.8, 3, H0 + 11], [-6, 4.6, H0 + 11.4]], [-6.4, 4.8, H0 + 12, 3.2, 2.7, 1.4], []],
        [H0 + 6.2, [[2.8, 4.6, H0 + 6.4], [4, 8.2, H0 + 6.2]], [4.2, 8.8, H0 + 6.9, 3, 2.6, 1.3], []]
      ];
      const pads = [[.2, .5, H0 + 12.6, 4.2, 3.6, 2.2], [2.6, -1.6, H0 + 11.2, 2.8, 2.4, 1.5], [-2.8, 2.2, H0 + 9.6, 2.6, 2.2, 1.4], [3.2, 2.2, H0 + 10.4, 2.6, 2.3, 1.4], [-3.4, -2, H0 + 7.4, 2.4, 2.1, 1.3]];
      branches.forEach(([z0, pts, pad, extra], bi) => {
        const s = at(z0), wig = [s];
        [s, ...pts].forEach((q, k, A) => { if (!k) return; const p0 = A[k - 1]; wig.push([(p0[0] + q[0]) / 2 + .7 * Math.sin(bi * 2.3 + k), (p0[1] + q[1]) / 2 + .7 * Math.cos(bi * 1.7 + k), (p0[2] + q[2]) / 2 + .5 * Math.sin(bi + k * 1.9)], q); });
        curveTube(M, 'bark_old', wig, [1.05, .8, .6, .44, .3], { segs: 14, n: 3, ridge: .1, k: 4, twist: .6, bump: .12, seed: 20 + bi });
        pads.push(pad, ...extra);
        for (const e of extra) { const q = pts[Math.floor(pts.length / 2)]; curveTube(M, 'bark_old', [q, [(q[0] + e[0]) / 2, (q[1] + e[1]) / 2, q[2] + .2], [e[0], e[1], e[2] - .3]], [.24, .18, .12], { segs: 8, n: 3, ridge: .05, bump: .1, seed: 30 + bi }); }
      });
      // a cloud pad: a dark flattened base and lighter needle tufts over its top and rim
      pads.forEach(([x, y, z, rx, ry, h], pi) => {
        blob(M, 'needles_dark', [x, y, z], rx * .96, ry * .96, h * .72, { amp: .22, freq: 1.8, seed: 80 + pi * 3, segs: 18, rings: 9, flat: .6, uvs: 4 });
        blob(M, 'needles_dark', [x + .3 * rx * Math.sin(pi), y + .3 * ry * Math.cos(pi), z - h * .55], rx * .78, ry * .74, h * .42, { amp: .26, freq: 2.1, seed: 120 + pi, segs: 16, rings: 7, uvs: 4 }); // the drooping layer under it
        const n = Math.round(14 + rx * ry * 1.5);
        for (let k = 0; k < n; k++) { // tufts packed over the top (sunflower spiral), the outer ones lower: a rounded cloud
          const a = k * 2.39996 + pi, f = Math.sqrt((k + .5) / n), px = x + Math.cos(a) * rx * .9 * f, py = y + Math.sin(a) * ry * .9 * f;
          const top = z + h * .55 * Math.sqrt(Math.max(0, 1 - f * f)) + .05, r = .62 + .42 * hash3(k, pi, 3);
          blob(M, f > .78 ? 'needles_dark' : 'needles', [px, py, top], r * 1.2, r * 1.1, r * .7, { amp: .34, freq: 2.8, seed: pi * 13 + k, segs: 9, rings: 5, flat: .5 });
        }
      });
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

  // ── stairs ──────────────────────────────────────────────────────────────
  // At scale 1: stone and wooden stairs climb 4 m in 6.4 m towards +y with a landing at the top; cliff stairs climb 12 m
  // in two flights with a landing between. Flights are [y from, y to, height from, height to]; landings [y from, y to, height].
  // Each placed staircase is built at its own size (the root's scale is undone on its meshes), with as many steps as
  // keep each one ~0.3 m high; the walk surface uses the same count (stairsSteps), so feet stand on the treads.
  const STAIRS = {
    kit_stairs_stone: { W: 3, flights: [[-3.2, 3.2, 0, 4]], landings: [[3.2, 4.4, 4]] },
    kit_stairs_wood: { W: 2.6, wood: true, flights: [[-3.2, 3.2, 0, 4]], landings: [[3.2, 4.4, 4]] },
    kit_stairs_cliff: { W: 3, lanterns: true, flights: [[-10.6, -1, 0, 6], [1, 10.6, 6, 12]], landings: [[-1, 1, 6], [10.6, 11.8, 12]] }
  };
  const STEP = .3;
  function stairsSteps(type, sy = 1) { const S = STAIRS[type]; return S ? S.flights.map(f => Math.max(3, Math.round((f[3] - f[2]) * sy / STEP))) : null; }
  function buildStairs(M, type) {
    const S = STAIRS[type], [sx, sy, sz] = M.stairsScale || [1, 1, 1], W = S.W * sx, n = stairsSteps(type, sy);
    S.flights.forEach(([a, b, h0, h1], k) => {
      const y0 = a * sz, y1 = b * sz, z0 = h0 * sy, z1 = h1 * sy, N = n[k], t = (y1 - y0) / N, L = Math.hypot(y1 - y0, z1 - z0), ang = Math.atan2(z1 - z0, y1 - y0);
      for (let i = 0; i < N; i++) {
        const top = z0 + (i + 1) * (z1 - z0) / N, yc = y0 + (i + .5) * t;
        if (S.wood) M.box('wood', [0, yc, top - .05], [W, t + .04, .1]);
        else { M.block('stone', 0, yc, 0, W, t + .02, top); for (const sd of [-1, 1]) M.block('stone', sd * (W / 2 + .2), yc, 0, .4, t + .02, top + .45); }
      }
      if (S.wood) for (const sd of [-1, 1]) {
        M.box('darkwood', [sd * W / 2, (y0 + y1) / 2, (z0 + z1) / 2 - .15], [.16, L, .32], 0, ang);
        const posts = Math.max(2, Math.ceil(L / 2.5));
        for (let q = 0; q <= posts; q++) { const f = q / posts; M.block('darkwood', sd * (W / 2 + .1), y0 + f * (y1 - y0), 0, .16, .16, z0 + f * (z1 - z0) + 1); }
        M.rod('darkwood', [sd * (W / 2 + .1), y0, z0 + 1], [sd * (W / 2 + .1), y1, z1 + 1], .05, 6);
      }
    });
    S.landings.forEach(([a, b, h]) => {
      const y0 = a * sz, y1 = b * sz, z = h * sy;
      if (S.wood) { M.block('wood', 0, (y0 + y1) / 2, z - .12, W, y1 - y0, .12); for (const sd of [-1, 1]) for (const y of [y0, y1]) M.block('darkwood', sd * (W / 2 - .1), y, 0, .18, .18, z); }
      else { M.block('stone', 0, (y0 + y1) / 2, 0, W, y1 - y0, z); for (const sd of [-1, 1]) M.block('stone', sd * (W / 2 + .2), (y0 + y1) / 2, 0, .4, y1 - y0, z + .45); }
      if (S.lanterns && h < S.landings[S.landings.length - 1][2]) for (const sd of [-1, 1]) M.cyl('lantern', [sd * (W / 2 + .2), (y0 + y1) / 2, z + .45], .16, .35, 6);
    });
  }
  // a placed staircase's own meshes, at its size; rebuilt when it is rescaled (refreshStairs, from the walk-surface pass)
  const stairsKey = r => [r.scaling.x, r.scaling.y, r.scaling.z].map(v => Math.abs(v || 1).toFixed(3)).join('|');
  function buildStairsFor(root, type, scene, shadows, skipShadows) {
    const sx = Math.abs(root.scaling.x || 1), sy = Math.abs(root.scaling.y || 1), sz = Math.abs(root.scaling.z || 1), M = new Kit();
    M.stairsScale = [sx, sy, sz]; B[type](M);
    for (const [mat, P] of Object.entries(M.parts)) {
      const m = new BABYLON.Mesh(`${root.name}_${mat}`, scene), vd = new BABYLON.VertexData();
      vd.positions = P.p; vd.normals = P.n; vd.uvs = P.uv; vd.indices = P.i; vd.applyToMesh(m);
      m.material = material(scene, mat); m.parent = root; m.scaling.set(1 / sx, 1 / sy, 1 / sz);
      m.isPickable = true; m._editRoot = root; m.checkCollisions = false; m.receiveShadows = true; m.metadata = { kitStairsMesh: true };
      if (shadows && !skipShadows) shadows.addShadowCaster(m);
    }
    root._kitStairsKey = stairsKey(root); root._kitStairsShadows = shadows; root._kitStairsSkip = skipShadows;
  }
  function refreshStairs(root, scene) {
    const type = root?.metadata?.type; if (!STAIRS[type] || root._kitStairsKey === stairsKey(root)) return false;
    root.getChildMeshes(true).forEach(m => { if (m.metadata?.kitStairsMesh) m.dispose(); });
    buildStairsFor(root, type, scene || root.getScene(), root._kitStairsShadows, root._kitStairsSkip);
    return true;
  }

  // ── templates + placement ───────────────────────────────────────────────
  const templates = {};
  let parkRoot = null, roomPark = null;
  function template(scene, type) {
    const t = templates[type];
    if (t && t.every(m => !m.isDisposed())) return t;
    const M = new Kit(); B[type](M);
    parkRoot = parkRoot && !parkRoot.isDisposed() ? parkRoot : new BABYLON.TransformNode('samKitTemplates', scene);
    parkRoot.position.set(0, -10000, 0);
    // a room's templates park apart: the village hides its own top-level nodes while you are inside a room
    // (room_* types: the rooms and their moving parts)
    const inRoom = type.startsWith('room_');
    if (inRoom && !(roomPark && !roomPark.isDisposed())) { roomPark = new BABYLON.TransformNode('samKitRoomTemplates', scene); roomPark.position.set(0, -10000, 0); roomPark.metadata = { keepInInteriors: true }; }
    const park = inRoom ? roomPark : parkRoot;
    const meshes = Object.entries(M.parts).map(([mat, P]) => {
      const m = new BABYLON.Mesh(`samKit_${type}_${mat}`, scene), vd = new BABYLON.VertexData();
      vd.positions = P.p; vd.normals = P.n; vd.uvs = P.uv; vd.indices = P.i; vd.applyToMesh(m);
      m.material = material(scene, mat); m.parent = park; m.isPickable = false; m.receiveShadows = true; m.metadata = { isKitTemplate: true };
      m.freezeNormals();
      return m;
    });
    return (templates[type] = meshes);
  }
  Object.assign(B, {
    // the Saints HQ (images 1-4): art-deco, cream stone with navy pilasters, a stepped central tower standing proud of
    // the front with the gold winged-halo emblem, the entrance under a navy canopy, three storeys, AC units on the roof
    sl_hq(M) {
      const W = 44, D = 22, H = 15, yF = -D / 2, ty = yF + 5;
      M.block('concrete', 0, 0, 0, W + .6, D + .6, .8); M.block('deco', 0, 0, 0, W, D, H);
      M.block('deco_trim', 0, 0, H, W + .8, D + .8, .6); M.block('deco', 0, 0, H + .6, W - 1, D - 1, .9);
      M.block('deco', 0, ty, 0, 16, 12, 19); M.block('deco_trim', 0, ty, 19, 16.6, 12.6, .4); M.block('deco', 0, ty, 19.4, 12, 10, 2.6); M.block('deco', 0, ty, 22, 8, 8, 2.2); M.block('deco', 0, ty, 24.2, 4, 6, 1.8);
      for (const sd of [-1, 1]) { M.block('navy', sd * 5.6, yF - 1.07, 5.6, 1.3, .16, 12.8); M.block('deco_trim', sd * 7.7, yF - 1.06, 0, .7, .2, 19); M.block('deco', sd * 4.6, ty - 4.6, 19.4, 1.2, 1.4, 4.2); }
      M.quad('emblem_saints', [[-3.8, yF - 1.1, 9.4], [3.8, yF - 1.1, 9.4], [3.8, yF - 1.1, 17.2], [-3.8, yF - 1.1, 17.2]]);
      for (const x of [-1.3, 1.3]) M.block('win_dark', x, yF - 1.06, 17.8, .9, .1, 3.6);
      M.block('door_glass', 0, yF - 1.04, .8, 6.4, .1, 5.1); M.block('navy', 0, yF - 1.06, 5.9, 7.6, .2, 2.4);
      M.quad('emblem_saints', [[-1, yF - 1.18, 6.2], [1, yF - 1.18, 6.2], [1, yF - 1.18, 7.9], [-1, yF - 1.18, 7.9]]);
      M.block('navy', 0, yF - 2.7, 5.7, 9, 3.3, .45); M.block('gold', 0, yF - 4.36, 5.7, 9.2, .14, .5);
      for (const sd of [-1, 1]) { M.block('iron', sd * 4.7, yF - 1.4, 3.7, .3, .5, 1); M.block('lantern', sd * 4.7, yF - 1.6, 3, .5, .5, .8); }
      M.quad('glow', [[-6, yF - 7, .06], [6, yF - 7, .06], [6, yF - 1, .06], [-6, yF - 1, .06]]);
      slWin(M, -1, yF, -21, -8.6, 3, 1.6, 3, 4.6, 2.3, 3, .3, 1); slWin(M, -1, yF, 8.6, 21, 3, 1.6, 3, 4.6, 2.3, 3, .3, 2);
      for (const x of [-21.7, -12.9, 12.9, 21.7]) M.block('navy', x, yF - .08, 1.2, .9, .16, 13.4);
      for (const sd of [-1, 1]) slWinX(M, sd, sd * W / 2, -8, 8, 4, 1.6, 3, 4.6, 2.2, 3, .3, sd + 4);
      slWin(M, 1, D / 2, -20, 20, 8, 1.6, 3, 4.6, 2.2, 3, .2, 7);
      slAC(M, [[-16, 4], [-10, 6], [12, 5], [17, 2], [3, 8]], H + 1.5);
    },
    // the arena (images 1, 4): a round hall, angel murals and gold wings all round, a ribbed low dome, the portal
    sl_arena(M) {
      const R = 17, H = 11, segs = 32;
      lathe(M, 'concrete', [[R + .5, 0], [R + .5, .9], [R, .9], [R, H], [R + .7, H], [R + .7, H + .9]], segs);
      lathe(M, 'concrete', [[R + .3, H + .9], [R - 2, H + 1.7], [R - 7, H + 3.3], [R - 12, H + 4.3], [3.4, H + 4.9], [3.4, H + 5.5], [0, H + 5.7]], segs);
      for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; M.rod('concrete', [Math.cos(a) * (R + .2), Math.sin(a) * (R + .2), H + 1], [Math.cos(a) * 3.6, Math.sin(a) * 3.6, H + 5.1], .35, 5); }
      const rr = (R + .1) / Math.cos(Math.PI / 18) + .08;
      for (let k = 0; k < 12; k++) {
        const a0 = (k * 30 + 5) / 180 * Math.PI, a1 = a0 + 20 / 180 * Math.PI, mid = (a0 + a1) / 2;
        if (Math.abs(Math.sin(mid) + 1) < .2) continue; // the portal (front)
        if (Math.abs(Math.cos(mid)) > .97) { M.quad('rollup', [[Math.cos(a0) * rr, Math.sin(a0) * rr, .9], [Math.cos(a1) * rr, Math.sin(a1) * rr, .9], [Math.cos(a1) * rr, Math.sin(a1) * rr, 5.4], [Math.cos(a0) * rr, Math.sin(a0) * rr, 5.4]]); continue; }
        M.quad(k % 2 ? 'mural_wings' : 'mural_angel', [[Math.cos(a0) * rr, Math.sin(a0) * rr, 1.6], [Math.cos(a1) * rr, Math.sin(a1) * rr, 1.6], [Math.cos(a1) * rr, Math.sin(a1) * rr, 9.8], [Math.cos(a0) * rr, Math.sin(a0) * rr, 9.8]]);
      }
      M.block('concrete', 0, -R - .3, 0, 11, 3.4, 8); M.block('deco_trim', 0, -R - .3, 8, 11.6, 3.8, .4);
      M.block('door_glass', 0, -R - 2.02, .6, 6.4, .1, 5); M.block('navy', 0, -R - 2.06, 5.8, 9, .14, 2);
      M.quad('emblem_saints', [[-1, -R - 2.16, 5.9], [1, -R - 2.16, 5.9], [1, -R - 2.16, 7.7], [-1, -R - 2.16, 7.7]]);
      M.quad('glow', [[-6, -R - 8, .06], [6, -R - 8, .06], [6, -R - 2, .06], [-6, -R - 2, .06]]);
    },
    // the library (images 1, 2): red brick, two storeys, arched upper windows, lit shop windows full of books, the
    // book-under-a-halo sign, an angel mural on the left wall, ivy on the corner
    sl_library(M) {
      const W = 22, D = 16, H = 11, yF = -D / 2;
      M.block('sl_brick', 0, 0, 0, W, D, H); M.block('deco_trim', 0, 0, H, W + .6, D + .6, .5); M.block('sl_brick', 0, 0, H + .5, W - .4, D - .4, .8);
      M.block('deco_trim', 0, 0, 5.2, W + .3, D + .3, .3);
      for (const x of [-6.6, 6.6]) { M.block('books', x, yF - .05, .8, 5.6, .1, 3.8); M.block('darkwood', x, yF - .1, .5, 6, .2, .3); M.block('darkwood', x, yF - .1, 4.6, 6, .2, .3); M.block('darkwood', x, yF - .12, .8, .2, .2, 3.8); }
      M.block('door_glass', 0, yF - .05, 0, 3.4, .1, 4.4); M.block('darkwood', 0, yF - .12, 4.4, 4, .24, .4);
      for (const x of [-8.4, -5, 5, 8.4]) { M.poly('win_dark', archPts(x, yF - .05, 6.2, 2.2, 3.8).reverse()); M.block('deco_trim', x, yF - .1, 5.95, 2.6, .2, .25); }
      M.quad('sign_saints_book', [[-2.3, yF - .12, 6], [2.3, yF - .12, 6], [2.3, yF - .12, 10.4], [-2.3, yF - .12, 10.4]]);
      slPic(M, 'mural_angel', 'left', -7, 7, .8, 10.4, -W / 2 - .06);
      slWinX(M, 1, W / 2, -6, 6, 3, 6.2, 1, 4, 2, 3, .4, 2); slWin(M, 1, D / 2, -8, 8, 4, 6.2, 1, 4, 2, 3, .3, 3);
      for (let k = 0; k < 9; k++) blob(M, 'leaves', [W / 2 + .2, yF + .2 + (k % 3) * .5, 1 + k * 1.1], .45, .45, .7, { amp: .3, freq: 2.2, seed: k, segs: 6, rings: 4 });
      slAC(M, [[-5, 2], [4, -1]], H + 1.3);
    },
    // the game hall (images 1, 2): charcoal panels, a wall of glass upstairs, arcade cabinets glowing behind the
    // ground-floor windows, the controller-under-a-halo sign, an angel mural on the right wall
    sl_game_hall(M) {
      const W = 26, D = 16, H = 11, yF = -D / 2;
      M.block('dark_panel', 0, 0, 0, W, D, H); M.block('metal', 0, 0, H, W + .5, D + .5, .5);
      for (const x of [-7.5, 7.5]) { M.block('arcade_int', x, yF - .05, .8, 7, .1, 3.8); M.block('metal', x, yF - .1, 4.6, 7.4, .2, .25); }
      M.block('door_glass', 0, yF - .05, 0, 3.6, .1, 4.4);
      for (let i = 0; i < 8; i++) { const x = -11.4 + i * 3.26; if (Math.abs(x) < 3) continue; M.block(i % 3 ? 'win_dark' : 'win_lit', x, yF - .05, 5.8, 2.9, .1, 4.4); M.block('metal', x + 1.55, yF - .1, 5.8, .14, .18, 4.4); }
      M.quad('sign_saints_game', [[-2.6, yF - .12, 5.8], [2.6, yF - .12, 5.8], [2.6, yF - .12, 10.6], [-2.6, yF - .12, 10.6]]);
      slPic(M, 'mural_angel', 'right', -7, 7, .8, 10.4, W / 2 + .06);
      slWin(M, 1, D / 2, -10, 10, 5, 6, 1, 4, 2.4, 3, .3, 5); slWinX(M, -1, -W / 2, -6, 6, 3, 6, 1, 4, 2, 3, .3, 6);
      slAC(M, [[-7, 3], [2, -2], [8, 4]], H + .5);
    },
    // the auto shop (images 1, 2): three open bays with lifts, tool chests along the back, a gold-wings mural between
    // the bays, planters on the roof. Fronts face -y; the cars are placed separately (sl_car_*)
    sl_garage(M) {
      const W = 34, D = 16, H = 7, yF = -D / 2;
      M.block('concrete_dark', 0, D / 2 - .3, 0, W, .6, H); for (const sd of [-1, 1]) M.block('concrete_dark', sd * (W / 2 - .3), 0, 0, .6, D, H);
      M.block('concrete', 0, 0, H - .5, W + .4, D + .4, .6); M.block('concrete_dark', 0, 0, .02, W - 1, D - 1, .05);
      for (const [a, b] of [[-17, -15.2], [-6.8, -4.2], [4.2, 6.8], [15.2, 17]]) M.block('concrete_dark', (a + b) / 2, yF + .3, 0, b - a, .6, H - .5);
      M.block('navy', 0, yF + .3, 5.6, W, .66, .9);
      M.quad('garage_int', [[-W / 2 + .7, D / 2 - .62, .1], [W / 2 - .7, D / 2 - .62, .1], [W / 2 - .7, D / 2 - .62, 5.6], [-W / 2 + .7, D / 2 - .62, 5.6]]);
      for (const x of [-5.5, 5.5]) slPic(M, 'mural_wings', 'front', x - 1.2, x + 1.2, .6, 5.2, yF - .02);
      for (const x of [-11, 11]) for (const sd of [-1, 1]) { M.block('blue_lift', x + sd * 3.4, -1, 0, .4, .4, 4.2); M.block('blue_lift', x + sd * 2.4, -1, 1.8, 2, .25, .2); }
      for (let k = 0; k < 5; k++) M.block('window_glow', -14 + k * 7, 0, H - .52, 3, .3, .04);
      for (const x of [-12, 0, 12]) slPlanter(M, x, 2, H + .1, 6, k => k);
    },
    // apartments (image 1): warm stucco, three storeys, balconies with iron rails and pots, the side stair
    sl_apartments(M) {
      const W = 30, D = 14, S = 4.6, H = S * 3, yF = -D / 2;
      M.block('stucco', 0, 0, 0, W, D, H); M.block('deco_trim', 0, 0, H, W + .5, D + .5, .5);
      for (let u = 0; u < 3; u++) { const x = -10 + u * 10; M.block('darkwood', x - 2, yF - .05, 0, 1.6, .1, 3.2); M.block('win_dark', x + 1.8, yF - .05, 1.2, 3, .1, 2); }
      slWin(M, -1, yF, -15, 15, 6, S + 1.2, 2, S, 2.2, 2.4, .35, 4);
      for (let s = 1; s < 3; s++) for (let u = 0; u < 3; u++) {
        const x = -10 + u * 10, z = s * S;
        M.block('concrete', x, yF - .9, z - .3, 7, 1.8, .3);
        for (let i = 0; i <= 10; i++) M.rod('iron', [x - 3.4 + i * .68, yF - 1.75, z], [x - 3.4 + i * .68, yF - 1.75, z + 1.1], .03, 3);
        M.block('iron', x, yF - 1.75, z + 1.1, 7, .08, .08);
        slShrubs(M, x + 2.4, yF - 1.2, z, 2, .6);
      }
      for (let s = 0; s < 3; s++) { const z = s * S; M.box('concrete', [W / 2 + 1.1, (s % 2 ? 1 : -1) * 2.5, z + S / 2], [2, 6, .3], 0, (s % 2 ? -1 : 1) * Math.atan2(S, 6)); M.block('concrete', W / 2 + 1.1, (s % 2 ? -1 : 1) * 5.4, z + S - .3, 2, 2, .3); }
      for (const sd of [-1, 1]) slWinX(M, sd, sd * W / 2, -5, 5, 2, 1.2, 3, S, 2, 2.4, .3, sd + 8);
      slAC(M, [[-8, 2], [6, -1]], H + .5);
    },
    // the market tent (images 1, 2): a white canopy over tables of oranges, greens and tomatoes
    sl_market(M) {
      const s = 3.2, z = 3.6;
      for (const [x, y] of [[-s, -s], [s, -s], [s, s], [-s, s]]) M.cyl('metal', [x, y, 0], .08, z, 6);
      const T = [0, 0, z + 1.6], C = [[-s - .3, -s - .3, z], [s + .3, -s - .3, z], [s + .3, s + .3, z], [-s - .3, s + .3, z]];
      for (let k = 0; k < 4; k++) M.poly('canopy', [C[k], C[(k + 1) % 4], T]);
      for (const [x, y, w] of [[0, -1.6, 5], [0, 1.8, 5]]) {
        M.block('wood', x, y, .85, w, 1.4, .1); for (const sx of [-1, 1]) M.block('wood', x + sx * (w / 2 - .2), y, 0, .15, 1.2, .85);
        for (let i = 0; i < 4; i++) { const cx = x - w / 2 + .7 + i * 1.2; M.block('wood', cx, y, .95, 1, 1, .35); const m = ['orange', 'lime', 'red_fruit', 'orange'][i]; for (let k = 0; k < 6; k++) M.sphere(m, [cx - .3 + (k % 3) * .3, y - .25 + Math.floor(k / 3) * .5, 1.38], .16, 1, 6, 4); }
      }
      for (let k = 0; k < 3; k++) M.block('wood', 3.8, -2 + k * 1.2, 0, 1, 1, .5 + (k % 2) * .5);
    },
    // the basketball court (images 1, 2, 4): painted court on the plaza, a hoop at each end
    sl_court(M) {
      M.quad('court_tex', [[-15, -8, .04], [15, -8, .04], [15, 8, .04], [-15, 8, .04]]);
      for (const sd of [-1, 1]) {
        M.cyl('metal', [sd * 16, 0, 0], .16, 4.7, 8); M.rod('metal', [sd * 16, 0, 4.5], [sd * 14.7, 0, 4.5], .1, 6);
        M.block('backboard', sd * 14.6, 0, 3.9, .1, 1.9, 1.2); M.tube('hoop_orange', [sd * 14.1, 0, 4.0], [sd * 14.1, 0, 4.05], .32, .32, 12, false);
      }
    },
    // a tall Washingtonia palm (~20 m): thin ringed trunk, the brown skirt of dead fronds, a small fan crown
    sl_palm_tall(M) {
      const T = [1.1, .2, 20];
      curveTube(M, 'palm_bark', [[0, 0, -.2], [.25, .05, 7], [.65, .12, 14], [T[0], T[1], T[2]]], [.42, .33, .28, .26], { segs: 7, n: 4, ridge: .05, bump: .05, k: 3, seed: 7 });
      blob(M, 'bark', [T[0], T[1], T[2] - .9], .5, .5, 1.1, { amp: .25, freq: 2.4, seed: 4, segs: 8, rings: 5 });
      for (let k = 0; k < 13; k++) {
        const a = k / 13 * Math.PI * 2, d = [Math.cos(a), Math.sin(a)], L = 2.6 + .4 * Math.sin(k * 1.7), up = .6 + .4 * Math.cos(k * 2.3);
        leafStrip(M, 'palm_leaf', f => [T[0] + d[0] * L * f, T[1] + d[1] * L * f, T[2] + up * 1.4 * f * (1 - f) * 2 - .8 * f * f * f], f => .55 * Math.sin(Math.PI * Math.min(1, f * 1.1 + .1)), d, .2, 4);
      }
    },
    sl_car_blue(M) { slCar(M, 'paint_blue', true); }, sl_car_gold(M) { slCar(M, 'paint_gold', true); }, sl_car_red(M) { slCar(M, 'paint_red', false); },
    sl_car_black(M) { slCar(M, 'paint_black', false); }, sl_car_white(M) { slCar(M, 'paint_white', false); }, sl_car_purple(M) { slCar(M, 'paint_purple', true); },
    sl_streetlight(M) { M.cyl('metal', [0, 0, 0], .2, 8.4, 8, .12); M.rod('metal', [0, 0, 8.2], [0, -2.4, 8.5], .08, 5); M.block('metal', 0, -2.6, 8.15, .7, .9, .35); M.block('lantern', 0, -2.6, 8.05, .55, .7, .12); M.quad('glow', [[-3, -5.6, .06], [3, -5.6, .06], [3, .4, .06], [-3, .4, .06]]); },
    sl_util_pole(M) { M.cyl('bark', [0, 0, -.3], .26, 11.6, 7, .2); M.block('darkwood', 0, 0, 10.2, 3.6, .2, .2); for (const x of [-1.5, 0, 1.5]) M.cyl('bone', [x, 0, 10.4], .07, .3, 5); M.cyl('metal', [.35, 0, 8], .3, 1.1, 8); },
    sl_planter(M) { slPlanter(M, 0, 0, 0, 4, true); },
    sl_bench(M) { M.block('concrete', 0, 0, 0, 3.2, .7, .5); M.block('wood', 0, 0, .5, 3.2, .7, .1); M.block('wood', 0, .32, .6, 3.2, .1, .6); },
    // city filler round the block (placed by the terrain): quarter blocks of shops, brick walk-ups, apartments, offices
    sl_lot_a(M) {
      slBuilding(M, 'facade_stucco', -2, -18, 44, 14, 9.2, 3);
      for (let k = 0; k < 5; k++) M.box(k % 2 ? 'awning_red' : 'awning_green', [-20 + k * 9, -25.6, 3.6], [7.4, 2, .2], 0, .3);
      M.quad('parking', [[-24, -10, .05], [8, -10, .05], [8, 26, .05], [-24, 26, .05]]); slBuilding(M, 'facade_apt', 15, 12, 18, 26, 13.8, 2);
    },
    sl_lot_b(M) { slBuilding(M, 'facade_brick', -9, -6, 30, 40, 18.4, 3); slBuilding(M, 'facade_shop', 15, -19, 16, 14, 5.2, 1); M.quad('parking', [[8, -10, .05], [24, -10, .05], [24, 26, .05], [8, 26, .05]]); },
    sl_lot_c(M) { slBuilding(M, 'facade_apt', 0, -10, 44, 18, 27.6, 4); slBuilding(M, 'facade_stucco', -12, 16, 20, 18, 9.2, 1); M.quad('parking', [[4, 6, .05], [24, 6, .05], [24, 26, .05], [4, 26, .05]]); },
    sl_lot_d(M) { slBuilding(M, 'facade_office', -6, -4, 30, 34, 21, 3); M.quad('parking', [[12, -26, .05], [24, -26, .05], [24, 26, .05], [12, 26, .05]]); slBuilding(M, 'facade_shop', -6, -24.5, 30, 5, 5.2, 0); },
    // downtown towers on the skyline
    sl_tower_a(M) { slBuilding(M, 'facade_glass', 0, 0, 30, 30, 120, 0); M.block('facade_glass', 0, 0, 120.5, 22, 22, 14); M.block('metal', 0, 0, 134.5, 16, 16, 2); },
    sl_tower_b(M) { slBuilding(M, 'facade_glass', 0, 0, 24, 24, 150, 0); M.cyl('metal', [0, 0, 150.5], .5, 22, 6, .1); },
    sl_tower_c(M) { slBuilding(M, 'facade_office', 0, 0, 34, 26, 90, 2); M.block('facade_office', 0, 0, 90.5, 24, 18, 12); },
    // the hillside sign: white letters on scaffold posts
    sl_hills_sign(M) {
      const word = 'HOLLYWOOD', adv = 7.4, x0 = -(word.length * adv - 1.4) / 2;
      [...word].forEach((ch, i) => {
        const ox = x0 + i * adv;
        for (const st of SL_FONT[ch]) {
          if (st[0] === 'd') { const [, ax, az, bx, bz] = st, dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz); M.box('sign_letter', [ox + (ax + bx) / 2, 0, (az + bz) / 2], [L + 1.1, .4, 1.3], 0, 0, -Math.atan2(dz, dx)); }
          else M.block('sign_letter', ox + (st[0] + st[2]) / 2, 0, st[1], st[2] - st[0], .4, st[3] - st[1]);
        }
        for (const px of [1, 5]) M.rod('metal', [ox + px, .5, -4], [ox + px, .5, 8], .12, 4);
      });
    }
  });
  // the apes: one part type per joint (built under its pivot), the whole ape as one piece for previews
  for (const [id, o] of Object.entries(APE_LOOK)) {
    const type = 'chz_ape_' + id;
    for (const [j] of APE_TREE) B[type + '__' + j] = M => { M.o = APE_J[j]; apePart(M, o, id, j); };
    B[type] = M => { for (const [j] of APE_TREE) apePart(M, o, id, j); };
  }
  // fresh, unparented meshes of a type (one per material), for the terrain's thin-instanced scatter (palms, bananas)
  function protoMeshes(scene, type) {
    if (!B[type]) return [];
    const M = new Kit(); B[type](M);
    return Object.entries(M.parts).map(([mat, P]) => { const m = new BABYLON.Mesh(`samKitProto_${type}_${mat}`, scene), vd = new BABYLON.VertexData(); vd.positions = P.p; vd.normals = P.n; vd.uvs = P.uv; vd.indices = P.i; vd.applyToMesh(m); m.material = material(scene, mat); m.isPickable = false; return m; });
  }
  // Fill a placed root (from spawnAsset) with instances of the type's template meshes.
  // floating pieces (ghosts): their instances bob and sway under the placed root, so saved positions never move
  const FLOAT = new Set(['cc_ghost']), floaters = [];
  // characters: the body rocks (kokeshi) or breathes (cats); subparts under their own pivots wave, flicker, pulse
  const CHAR = { cc_flower_moon: 'rock', cc_nariko: 'rock', cc_ostara: 'rock', cc_mamoru: 'bob', cc_mochi: 'bob' };
  const SUBPARTS = { cc_mamoru: [['cc_paw_black', [.36, -.25, .92], 'wave'], ['cc_candle_flame', [0, 0, 2.17], 'flicker']], cc_mochi: [['cc_paw_white', [.36, -.25, .92], 'wave']], cc_nariko: [['cc_orb', [0, -.56, .74], 'pulse']] };
  const actors = [];
  function animateActors(t) {
    for (let i = actors.length - 1; i >= 0; i--) {
      const a = actors[i]; if (a.body.isDisposed?.()) { actors.splice(i, 1); continue; }
      if (a.kind === 'ape') { animateApe(a, t); continue; }
      if (a.kind === 'rock') { a.body.rotation.z = .07 * Math.sin(t * 1.5 + a.ph); a.body.rotation.x = .035 * Math.sin(t * 1.1 + a.ph * 2); }
      else { const b = Math.sin(t * 1.8 + a.ph); a.body.scaling.set(1 + .015 * b, 1 - .012 * b, 1 + .015 * b); }
      for (const s of a.subs) {
        if (s.kind === 'wave') s.node.rotation.x = .25 - .55 * Math.max(0, Math.sin(t * 3 + a.ph));
        else if (s.kind === 'flicker') { const f = 1 + .22 * Math.sin(t * 13 + a.ph) + .12 * Math.sin(t * 31); s.node.scaling.set(1 - .1 * (f - 1), f, 1 - .1 * (f - 1)); }
        else { const p = 1 + .1 * Math.sin(t * 5 + a.ph) + .05 * Math.sin(t * 17); s.node.scaling.setAll(p); s.node.rotation.y = t * 1.3; }
      }
    }
  }
  // apes: the joints are pivots; the gait comes from how fast the placed root actually moves (NPC patrols, the
  // player), so nothing outside has to drive it. actorAction(root, 'jump' | 'kick') plays a one-shot move.
  const APE_L1 = .55, APE_L2 = .54;
  function buildApe(root, type, scene, shadows, skipShadows) {
    const body = new BABYLON.TransformNode(root.name + '_body', scene), N = {}; body.parent = root;
    for (const [j, par] of APE_TREE) {
      const n = N[j] = new BABYLON.TransformNode(root.name + '_' + j, scene), p = APE_J[j], q = par ? APE_J[par] : [0, 0, 0];
      n.parent = par ? N[par] : body; n.position.set(p[0] - q[0], p[2] - q[2], p[1] - q[1]);
      buildInto(n, type + '__' + j, scene, root, shadows, skipShadows);
    }
    N.neck.scaling.setAll(APE_HEAD_K); // the art's big heads
    actors.push({ kind: 'ape', root, body, N, subs: [], ph: Math.random() * 6.28, g: 0, v: 0, tl: null, last: null, act: null });
    ensureAnim(scene);
  }
  function animateApe(a, t) {
    const dt = a.tl == null ? 0 : Math.min(.1, Math.max(0, t - a.tl)); a.tl = t;
    const p = a.root.getAbsolutePosition(), sc = Math.abs(a.root.absoluteScaling?.y || 1) || 1;
    const d = a.last ? Math.hypot(p.x - a.last.x, p.z - a.last.z) / sc : 0; a.last = { x: p.x, z: p.z };
    const sp = dt > 0 && d < 2 ? d / dt : 0; // metres (in the ape's own size) per second; a teleport reads as standing
    a.v += (Math.min(12, sp) - a.v) * Math.min(1, dt * 6);
    const v = a.v < .05 ? 0 : a.v, A = Math.min(1, v / 2), R = Math.min(1, Math.max(0, (v - 4.5) / 3)), idle = 1 - A, N = a.N;
    a.g += dt * v / (2.6 + .25 * v) * Math.PI * 2; // one stride (two steps) per 2.6 + .25 v metres
    const g = a.g, s = Math.sin(g), br = Math.sin(t * 1.7 + a.ph);
    const kn = q => -A * (.06 + (.8 + .6 * R) * Math.max(0, Math.cos(q)) ** 1.5);
    let thL = (.42 + .25 * R) * A * s, thR = -thL, knL = kn(g), knR = kn(g + Math.PI);
    const sw = (.32 + .3 * R) * A * s, sway = .05 * idle * Math.sin(t * 1.1 + a.ph);
    let shL = -sw + sway, shR = sw + sway, elL = .3 + (.3 + .7 * R) * A + .1 * A * s, elR = .3 + (.3 + .7 * R) * A - .1 * A * s, splay = .12 + .08 * R;
    let lean = -(.04 * A + .2 * R), twist = .1 * A * s, lift = 0;
    if (a.act) {
      if (a.act.t0 == null) a.act.t0 = t;
      const u = (t - a.act.t0) / a.act.dur;
      if (u >= 1 || u < 0) a.act = null;
      else {
        const w = Math.sin(Math.PI * u), L = (x, y, k = w) => x + (y - x) * k;
        if (a.act.kind === 'jump') { thL = L(thL, .95); thR = L(thR, .75); knL = L(knL, -1.5); knR = L(knR, -1.3); shL = L(shL, 2.5); shR = L(shR, 2.4); elL = L(elL, .4); elR = L(elR, .4); lift = 1.3 * w; }
        else { const ext = Math.min(1, Math.max(0, (u - .25) / .2)); thR = L(thR, 1.7); knR = L(knR, -1.6 + 1.55 * ext); thL = L(thL, -.12); knL = L(knL, -.25); lean = L(lean, .28); shL = L(shL, .9); shR = L(shR, -.6); splay += .3 * w; }
      }
    }
    N.hip_l.rotation.x = thL; N.hip_r.rotation.x = thR; N.kn_l.rotation.x = knL; N.kn_r.rotation.x = knR;
    N.sh_l.rotation.set(shL, 0, -splay); N.sh_r.rotation.set(shR, 0, splay); N.el_l.rotation.x = elL; N.el_r.rotation.x = elR;
    N.pelvis.rotation.set(lean, twist, 0); N.pelvis.scaling.set(1 + .012 * br * idle, 1 + .008 * br * idle, 1 + .012 * br * idle);
    N.neck.rotation.set(-lean * .6 + .04 * idle * Math.sin(t * .7 + a.ph), idle * .35 * Math.sin(t * .31 + a.ph) * (Math.sin(t * .13 + a.ph) > 0 ? 1 : .3), 0);
    // keep the lower foot on the ground: drop the body by what the bent legs lose in reach
    const reach = (th, k) => APE_L1 * Math.cos(th) + APE_L2 * Math.cos(th + k);
    a.body.position.y = Math.max(reach(thL, knL), reach(thR, knR)) - APE_L1 - APE_L2 + lift;
  }
  function actorAction(root, kind, dur) { const a = actors.find(x => x.root === root); if (a) a.act = { kind, t0: null, dur: dur || (kind === 'jump' ? .9 : 1.1) }; return !!a; }
  function ensureAnim(scene) { if (!scene._kitFloat) scene._kitFloat = scene.onBeforeRenderObservable.add(() => animate(performance.now() / 1000)); }
  function animate(t) {
    animateActors(t);
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i]; if (f.root.isDisposed?.()) { floaters.splice(i, 1); continue; }
      // each ghost drifts round its own loop (3-5 m), rising and sinking, turning to face where it goes, leaning in
      const w = .22 + .06 * Math.sin(f.ph * 3), A = t * w + f.ph, R = 3 + 2 * Math.abs(Math.sin(f.ph * 1.7)), sx = Math.sign(Math.sin(f.ph * 5)) || 1;
      const px = R * Math.cos(A), pz = R * .7 * Math.sin(A) * sx, vx = -Math.sin(A), vz = .7 * Math.cos(A) * sx;
      for (const m of f.root.getChildMeshes(true)) { m.position.set(px, .7 + .6 * Math.sin(t * .9 + f.ph) + .2 * Math.sin(t * 2.3 + f.ph * 2), pz); m.rotation.set(.12 * Math.sin(t * 1.3 + f.ph), Math.atan2(-vx, -vz), .1 * Math.sin(t * 1.1 + f.ph)); }
    }
  }
  function build(root, type, scene, shadows, skipShadows) {
    if (!B[type]) return false;
    if (APE_LOOK[type.slice(8)] && type.startsWith('chz_ape_')) { buildApe(root, type, scene, shadows, skipShadows); return true; }
    if (CHAR[type]) { // a body node to rock, subparts on pivots inside it
      const body = new BABYLON.TransformNode(root.name + '_body', scene); body.parent = root;
      const subs = (SUBPARTS[type] || []).map(([st, [x, y, z], kind]) => { const n = new BABYLON.TransformNode(root.name + '_' + st, scene); n.parent = body; n.position.set(x, z, y); buildInto(n, st, scene, root, shadows, skipShadows); return { node: n, kind }; });
      buildInto(body, type, scene, root, shadows, skipShadows);
      actors.push({ body, subs, kind: CHAR[type], ph: Math.random() * 6.28 });
      if (!scene._kitFloat) scene._kitFloat = scene.onBeforeRenderObservable.add(() => animate(performance.now() / 1000));
      return true;
    }
    if (FLOAT.has(type)) { floaters.push({ root, ph: (root.position.x * 1.7 + root.position.z) % 6.28 }); if (!scene._kitFloat) scene._kitFloat = scene.onBeforeRenderObservable.add(() => animate(performance.now() / 1000)); }
    if (STAIRS[type]) { buildStairsFor(root, type, scene, shadows, skipShadows); return true; }
    buildInto(root, type, scene, root, shadows, skipShadows);
    return true;
  }
  function buildInto(parent, type, scene, editRoot, shadows, skipShadows) {
    for (const t of template(scene, type)) {
      const inst = t.createInstance(`${parent.name}_${t.name.split('_').pop()}`), isGlow = !!t.material?.metadata?.kitGlow;
      inst.parent = parent; inst.isPickable = !isGlow; inst._editRoot = editRoot; inst.checkCollisions = false;
      if (shadows && !skipShadows && !isGlow) shadows.addShadowCaster(inst);
    }
  }
  // walkable decks in the type's own frame (Babylon x/z, deck top y above the origin)
  // stairs: walk surface on the treads (steps = how many), then the top landing
  const stairs = (W, R, H, n, surface) => [{ x: 0, z: 0, halfX: W / 2 - .05, halfZ: R / 2, y0: 0, y1: H, steps: n, surface }, { x: 0, z: R / 2 + .6, halfX: W / 2 - .05, halfZ: .75, y: H, surface }];
  // ── rooms: interiors behind a dojo door (village.html buildInteriorRoom builds one when the entrance's interiorDefinition.kit
  // names it). Built like the buildings, but every part gets the room's own copy of its material (Kit.room -> 'rm_' + name:
  // never frozen, up to 6 lights) so the room's lights reach it; village lights are kept off the room's meshes.
  // ROOMS (Babylon coordinates, the room's floor top at y 0): bounds [minX, maxX, minZ, maxZ] for the player, blockers
  // ({ box: [x0, z0, x1, z1] } | { circle: [x, z, r] }), spawn [x, z, facing], exit [x, z] (walk into it to leave),
  // hemi { i, c, g } fill light, lights [{ p: [x, y, z], c, i, r }] point lights.
  const SD = { HX: 20, HY: 16, H: 9, CX: 13.5, CY: [-10.5, -3.5, 3.5, 10.5], ZN: 12.6, DW: 7, DH: 5.8, AW: 10, AD: 1.9, AZ: 8.4, DZ: .8 };
  const AR = { HX: 22, HY: 20, H: 12, DW: 7, DH: 6, CABS: [-12.6, -10.2, -7.8, -5.4, 5.4, 7.8, 10.2, 12.6], COLS: [-12, -4, 4, 12] };
  const LB = { HX: 18, HY: 22, H: 11, DW: 6, DH: 5.6, BAYS: [-19.8, -15.4, -11, -6.6, -2.2, 2.2, 6.6, 11, 15.4, 19.8], SHELF: [-19.8, -11, -2.2, 6.6, 15.4] };
  // Samurai rooms: Library (SL: the moon window in the back wall, the garden behind it), Forge (SF), Ancestor Hall (SA)
  const SL = { HX: 13, HY: 11, H: 8, DW: 3.6, DH: 3.6, WIN: { r: 2.6, z: 3.9 }, CUB: { y0: -9.6, y1: 9.6, z0: .5, rows: 8, cell: .6, d: .9 }, DESKS: [[-5, -1.6], [0, -1.6], [5, -1.6], [-5, 3], [0, 3], [5, 3]] };
  const SF = { HX: 12, HY: 10, H: 9, DW: 3.4, DH: 3.6, HEARTH: [0, -8.4, 5.2, 2.6], ANV: [[-2.2, -3.8], [2.4, -4.4]] };
  const SA = { HX: 12, HY: 15, WALL: 3.2, VAULT: 4.2, DW: 3.2, DH: 3, TIERS: 5 };
  // Ronin rooms: Shadow Dojo (RS: moonlight slits), Strategy Room (RT), Hall of Debts (HD), The Old Door (OD: dais, door)
  const RS = { HX: 18, HY: 15, H: 9, DW: 6, DH: 5.2, SLITS: [-12.5, -7.5, -2.5, 2.5, 7.5, 12.5], SQ: 7 };
  const RT = { HX: 9, HY: 7, H: 6, DW: 3, DH: 3.4, TAB: [0, -1.6] };
  const HD = { HX: 5, HY: 22, H: 10, DW: 3.2, DH: 4.2 };
  const OD = { HX: 15, HY: 18, H: 16, DW: 4, DH: 4.6, DAIS: { x: 7, y0: -18, y1: -13, h: 1.8 }, ST: { x: 3, y1: -10.6, n: 6 }, STAT: 9.2 };
  // Hub Ancient Tunnels: the passage (PATH, Babylon x/z = kit x/y) winding from the door to the Great Root Chamber (CH: centre,
  // radius, dome height), a side passage to the Root Records (REC) and one to the First Seal (SEAL); tunnel radius TR at height TZ
  const AT = { PATH: [[0, 20.6], [0, 15], [-4, 8], [2, 0], [-3, -7.5], [0, -10.5]], CH: [0, -24, 14.5, 12], REC: [[2, 0], [9, -1.5], [14.5, -3]], RECC: [16.5, -3.4, 4.6],
    SEAL: [[-13.5, -24], [-20, -25]], SEALC: [-23.5, -25.2, 4.2], TR: 3, TZ: 2.2 };
  // Hub Forest Dojo: the living tree in the middle (TR: trunk base radius, ring radius), the roof well over it (HOLE)
  const FD = { HX: 17, HY: 15, H: 9.5, DW: 6, DH: 5.2, HOLE: 4.2, TR: 2.3, RING: 8, DUM: 9.2,
    FLIES: [[-5, 4, 3.2], [4, 6, 2.4], [7, -3, 3.6], [-7, -5, 2.6], [2, -8, 3], [-3, 9, 4], [10, 2, 2.2], [-10, 1, 3.4], [6, 9, 2.8], [-6, -10, 3.8], [12, -8, 2.5], [-12, 7, 2.9], [0, 12, 3.3], [9, -11, 4.2]] };
  // Hub Video Theatre (behind the Gathering Hall): the door at the front-left corner (DX), the stage and screen on the front
  // wall, the hanamichi walkway (HN), masu box seating, six tiers rising to the back platform and the projector booth
  const TH = { HX: 16, HY: 22, H: 12, DW: 4.4, DH: 4.8, DX: -12.6, ST: { x0: -10, x1: 10, y0: 15, y1: 21.6, h: 1.1 }, HN: { x0: -9, x1: -7.6, y0: .4, h: .9 },
    TIER: { y0: -2, d: 2.3, r: .4, n: 6 }, BACK: 2.4, SCR: { w: 14.2, h: 8, z0: 1.7 } };
  // Hub Gathering Hall: the stage (ST), the raised hearth (HE: centre y, half size, height), the canopy ropes (ROPES)
  const GH = { HX: 24, HY: 20, H: 13, DW: 7, DH: 6, ST: { x0: -9, x1: 9, y0: -20, y1: -14.5, h: 1.2 }, HE: { cy: -1, s: 3.5, h: .45 }, ROPES: [-12, -8, -4, 0, 4, 8, 12, 16], COLS: [[-14, -8], [14, -8], [-14, 6], [14, 6]] };
  // Shogun rooms (rebel scale: a Rebel stands 3.4 m, so chairs sit at .85 and tables at 1.45)
  // TS Throne Room: the long table (y0..y1, half width, height), the seats, the chairs' x, the banner poles' x, the dais and its
  // stairs, the throne's y, the canopy posts [x, yBack, yFront], the colonnade (x, ys)
  const TS = { HX: 17, HY: 25, H: 12, DW: 6, DH: 5.6, TAB: { y0: -14.5, y1: 11.5, hw: 1.8, h: 1.45 }, SEATS: [-12, -7.6, -3.2, 1.2, 5.6, 10], CHX: 2.85, BX: 4.7,
    DAIS: { y0: -25, y1: -19.4, h: 1.2, hw: 8 }, ST: { hw: 3, d: 2.2, n: 4 }, THR: -22.4, CAN: [2.7, -24.3, -20.5], CX: 10.2, COLS: [-15, -7, 1, 9] };
  // CR Court of Records: the bench (half width, tiers [y0, y1, top]), the white-pebble court, the seal press, the ladders [side, y], drawer wall height
  const CR = { HX: 15, HY: 13, H: 11, DW: 4, DH: 4.6, BW: 10.2, TIERS: [[-8.6, -6.4, .8], [-10.8, -8.6, 1.6], [-13, -10.8, 2.4]], SAND: [-6.5, -3.6, 6.5, 6.6],
    PRESS: [10.2, 9.6], LAD: [[-1, -6], [-1, 6.5], [1, -7.5], [1, 3.5]], DRW: 7.8 };
  // KP Keep: galleries 3 m deep (inner edge I) at LV (back, front, back), stairs of N treads up the side walls between them
  const KP = { HX: 11, HY: 11, H: 24, DW: 3.6, DH: 4.6, I: 8, LV: [6, 12, 18], N: 20 };
  // WC War Council: round, radius R, walls WH, dome DOME above them; NS wall segments (the door = two of them); the table, the chairs' ring, the screen [w, h, bottom]
  const WC = { R: 14, WH: 7, DOME: 7, DW: 3.66, DH: 4.6, TAB: 5.2, SEAT: 6.6, NS: 48, SCR: [7.2, 4.05, 1.8] };
  // Bushi rooms. WR War Room: the relief table [cx, cy, half x, half y, top], the round east window. BG Strategy Hall: the go
  // board inlaid in the floor (half size B, centre BY), the go and shogi tables. BD Dojo: the officers' galleries (depth G,
  // height GH, to GY), their stairs (to SY), the commander's dais [half x, y0, y1, h], the formation blocks on the floor
  const WR = { HX: 15, HY: 12, H: 9, DW: 4, DH: 4.6, TAB: [0, -1.5, 6.4, 3.6, 1.35], WIN: { y: -1.5, z: 4.6, r: 3.2 } };
  const BG = { HX: 14, HY: 12, H: 8, DW: 4, DH: 4.6, B: 6, BY: -1.5, GO: [[-11.6, -7], [-11.6, -1.5], [-11.6, 4]], SH: [[11.6, -7], [11.6, -1.5], [11.6, 4]] };
  const BD = { HX: 19, HY: 15, H: 10, DW: 6, DH: 5.4, G: 3, GH: 3.2, GY: 7, SY: 11.6, DA: [4, -15, -12.2, .6], BLK: [[0, -6], [-2.2, -3.6], [2.2, -3.6], [-4.4, -1.2], [4.4, -1.2], [-1.4, 1.8], [1.4, 1.8], [0, 4.6]] };
  // Buke rooms. AV Archive Vault: barrel vaults (spring SPR, rise RISE) on squat pillars (x PX, ys PY), the round vault door
  // (radius, centre height) and the inner vault behind it [half x, depth, height]. BH Great Hall: the canal (half width CY,
  // depth CD) and its two bridges (x, half width BW, ramp past each bank BL, top BT), the roof ridge. BT Cliff Tunnels: the
  // tunnel boxes [x0, y0, x1, y1], the lift chamber, the shaft height. EW Engineer Workshop: the waterwheel (y, axle height,
  // radius) beyond the left wall, the overhead gear shaft height
  const AV = { HX: 12, HY: 15, H: 8.4, DW: 3.6, DH: 4.4, PX: 4, PY: [-10, -5, 0, 5, 10], SPR: 4.2, RISE: 3.6, VD: { r: 2.6, z: 2.2 }, IN: [3, 4.4, 4.2] };
  const BH = { HX: 22, HY: 14, H: 12, DW: 6, DH: 5.6, CY: 2.2, CD: 1.1, BR: [-8, 8], BW: 1.25, BL: 1.2, BT: .75, RIDGE: 16.5 };
  const BT = { W: 6, TH: 5, SEG: [[-3, -5, 3, 21], [-29, -5, 3, 1], [-29, -37, -23, 1]], LIFT: [-31, -43, -21, -33], SH: 22 };
  const EW = { HX: 14, HY: 11, H: 10, DW: 4, DH: 4.6, WY: -3, WZ: 3.8, WR: 3.4, GZ: 6.8 };
  // Ashigaru rooms. AW Workshop (the forest doors in the right wall). AA Seed Archive: low eaves H, the thatch up to RIDGE. OC Dojo:
  // the balance logs [x0, y0, x1, y1] at height LH with a stump step at each end, the crawl net, the mud pit, the climbing wall
  const AW = { HX: 13, HY: 10, H: 8, DW: 4.4, DH: 4.6, FD: [-6, 2] };
  const AA = { HX: 10, HY: 9, H: 4.4, RIDGE: 9, DW: 3.6, DH: 4 };
  const OC = { HX: 18, HY: 14, H: 9, DW: 6, DH: 5.4, LH: .9, LOGS: [[-14, 7.7, -4, 8.3], [-6.3, -12, -5.7, -3]], NET: [3, 3.6, 10, 7.6], MUD: [2.5, -7, 10, -2.5], WALL: [16.8, -7, 18, 1] };
  // Kenshi rooms. KD Duel Hall: the sand circle (radius C) under the skylight (half size SKY), the still pool. KL Library of Forms:
  // the koi pond [x, y, r] and its bridge (half width BR). KF Polishing Studio: the running channel. KM Meditation Room: the garden
  const KD = { HX: 15, HY: 15, H: 10, DW: 4.4, DH: 4.8, C: 5.5, SKY: 2.6, POOL: [-9, -14.4, 9, -10] };
  const KL = { HX: 12, HY: 12, H: 8, DW: 3.6, DH: 4.4, P: [0, -1, 4.2], BR: 1.3, BT: .8 };
  const KF = { HX: 10, HY: 9, H: 7, DW: 3.4, DH: 4.4, CH: [-8, -2.6, 8, -1.4], BX: [-6.4, -2.6, 2.6, 6.4] }; // BX: the benches over the channel (a plank bridge between the middle two)
  const KM = { HX: 13, HY: 13, H: 9, DW: 3.6, DH: 4.4, G: [-8.5, -9.5, 8.5, 5.5] };
  // Yamabushi rooms. YF Falls Cave: the cave (centre y, radii), its mouth on the falls [half width, bottom, top], the hermit's
  // ledge [x, y, r, h]. YL Library: the galleries at GH on three sides, the stair up the left wall (front y -> back y). YS Spirit
  // Shrine: the pebble ring. YD Descent Path: a square shaft (half size S, the well inside I), N flights down the walls from TOP
  const YF = { CY: -2, RX: 15, RY: 12, RZ: 9, MOUTH: [7.4, .4, 7.4], LEDGE: [9, -6.5, 2.4, .8] }; // ledge [x, z, r, h]: its step stone is h / 2 (two .4 steps)
  const YL = { HX: 11, HY: 11, H: 13, DW: 3.6, DH: 4.4, GH: 6, ST: [8, -6] };
  const YS = { HX: 15, HY: 15, H: 12, DW: 4.4, DH: 5, R: 7 };
  const YD = { S: 13, I: 9, TOP: 30, N: 10, DROP: 3, PH: 16.5 };
  // flight k runs down the right, back, left, front strip in turn and ends on a corner landing; the entry landing runs along the
  // front strip at the top
  function ydPlan() {
    const { S, I, TOP, N, DROP } = YD, strips = [
      { box: [I, -I, S, I], axis: 'z', hiAtMin: false, rail: [I - .15, -I, I + .1, I], corner: [I, -S, S, -I] },
      { box: [-I, -S, I, -I], axis: 'x', hiAtMin: false, rail: [-I, -I - .1, I, -I + .15], corner: [-S, -S, -I, -I] },
      { box: [-S, -I, -I, I], axis: 'z', hiAtMin: true, rail: [-I - .1, -I, -I + .15, I], corner: [-S, I, -I, S] },
      { box: [-I, I, I, S], axis: 'x', hiAtMin: true, rail: [-I, I - .15, I, I + .1], corner: [I, I, S, S] }];
    return Array.from({ length: N }, (_, k) => { const s = strips[k % 4], hi = TOP - k * DROP; return { ...s, k, hi, lo: hi - DROP }; });
  }
  // Sohei rooms. SB Bell Temple: the bell (lip height, radius), its frame's posts at +-FP. SG Great Dojo: the goma altar [half x,
  // y0, y1, h], the training ring. SK Library: the revolving repository (radius). SR Rite Hall: the walkway (half width WK) over the
  // pool to the stage (from ST back), the side ledges (width LD), the walkway height Y
  const SB = { HX: 12, HY: 12, H: 16, DW: 4, DH: 4.8, LIP: 2.2, BR: 2.6, FP: 4.2 };
  const SG = { HX: 19, HY: 15, H: 11, DW: 6, DH: 5.4, AL: [3.5, -15, -10.2, 1.2], RING: 8 };
  const SK = { HX: 12, HY: 12, H: 10, DW: 3.6, DH: 4.4, RZ: 3.2 };
  const SR = { HX: 15, HY: 13, H: 10, DW: 3.6, DH: 4.4, WK: 1.6, ST: -9, LD: 2.8, FD: 2.4, Y: .5 }; // LD side ledges, FD front walk: a body wide, so the walk goes round the pool
  // Wokou: the ship's hold (hull half-width, half-length, deck height, the hatch's y, floor half-width; the hull narrows into
  // the bow), the trade house (the counter at y CY, its gap GX), the boat shed (the slip pool's half-width PX and front edge PY),
  // the dojo (the pool PL, the round window radius WR at height WZ, the stepping posts winding across the pool)
  const WH = { HX: 5, HY: 14, H: 5.3, HT: 11, FW: 3.6 };
  function whW(y) { return y > -5 ? 1 : Math.max(.35, 1 - Math.pow((-5 - y) / 9, 1.6) * .65); }
  const WT = { HX: 13, HY: 10, H: 8, DW: 3.6, DH: 4.4, CY: 1.6, GX: [8, 10.6] };
  const WS = { HX: 15, HY: 10, H: 11, DW: 4.4, DH: 5, PX: 6.5, PY: -3.6 };
  const WD = { HX: 18, HY: 15, H: 10, DW: 6, DH: 5.4, PL: [-7.5, -9.5, 7.5, 1.5], WR: 3.4, WZ: 5.4 };
  const WDP = Array.from({ length: 11 }, (_, k) => [2.6 * Math.sin(k * .55), WD.PL[3] - k * (WD.PL[3] - WD.PL[1]) / 10, [.4, .8, 1.2, 1.6, 2, 2.4, 2, 1.6, 1.2, .8, .4][k]]);
  // Warrior: the armory, the fighting ring (a square sand pit RS, N tiers ST high and W wide up to the walkway), the stores (a
  // cellar: the stair SX wide from y SY[0] up to the trapdoor at SY[1]), the veterans' hall (the fire pit's stone ring FR)
  const XA = { HX: 14, HY: 11, H: 9, DW: 3.6, DH: 4.4 };
  const XD = { HX: 18, HY: 18, H: 10, DW: 4.4, DH: 6.8, RS: 6, ST: .4, W: 1.4, N: 5 };
  function xdTiers() { const out = []; for (let k = 1; k <= XD.N; k++) { const a = XD.RS + (k - 1) * XD.W, b = k === XD.N ? XD.HX : XD.RS + k * XD.W; out.push({ k, y: k * XD.ST, a, b, boxes: [[-b, -b, b, -a], [-b, a, b, b], [-b, -a, -a, a], [a, -a, b, a]] }); } return out; }
  const XS = { HX: 15, HY: 12, H: 9, SX: 1.8, SY: [3.6, 12] };
  const XV = { HX: 15, HY: 12, H: 11, DW: 3.6, DH: 4.4, FR: 2.2 };
  // Cute & Creepy: the manor's foyer (the gallery GH high across the back to GY, the stair flights against the side walls (x SX)
  // from y ST[0] up to ST[1]), the crypt (the entry landing LH high from y LY, its steps down to SY; the vault springs at VS),
  // the witch's cottage, the game hall (the pumpkin lane along the right wall, x LX)
  const CM = { HX: 15, HY: 15, H: 14, DW: 3.6, DH: 5, GH: 6.4, GY: -10, SX: [12.2, 15], ST: [4, -10] };
  const CK = { HX: 8, HY: 15, H: 6.4, DW: 3, DH: 4.2, LH: 1.6, LY: 10, SY: 7.2, VS: 2.6 };
  const CW = { HX: 7, HY: 6, H: 5.2, DW: 2.6, DH: 3.8 };
  const CG = { HX: 14, HY: 12, H: 9, DW: 3.6, DH: 4.6, LX: [9.6, 13] };
  // Chumpz: the tiki lounge (the bar along the back, the dance floor DF), the jungle casino (the banana wheel WR on the back wall
  // at height WZ), the bait shop's back room, the cabin under the sailboat's stern
  const ZB = { HX: 13, HY: 10, H: 7, DW: 3.4, DH: 4.4, DF: [-4, -1, 4, 5] };
  const ZC = { HX: 13, HY: 11, H: 8, DW: 3.4, DH: 4.4, WR: 3.2, WZ: 4.4 };
  const ZT = { HX: 7, HY: 6, H: 5, DW: 2.4, DH: 3.8 };
  const ZS = { HX: 6, HY: 5, H: 4.6, DW: 1.8, DH: 3.6 };
  // Saints: the HQ loft (glass wall at the back), the arena (the court CX x CY, the stand stepping up behind the far sideline from
  // y B0 in BN tiers BW deep and BR high), the custom shop, the library rotunda (radius R, wall WH, dome DOME), the block party
  const QH = { HX: 17, HY: 13, H: 9, DW: 4, DH: 4.8 };
  const QA = { HX: 20, HY: 15, H: 14, DW: 4.4, DH: 5, CX: 14, CY: 7.6, B0: -8.4, BW: 1.32, BR: .44, BN: 5 };
  function qaTiers() { return Array.from({ length: QA.BN }, (_, i) => ({ k: i + 1, y: (i + 1) * QA.BR, a: QA.B0 - i * QA.BW, b: i === QA.BN - 1 ? -QA.HY : QA.B0 - (i + 1) * QA.BW })); }
  const QG = { HX: 13, HY: 10, H: 8, DW: 4.4, DH: 4.8 };
  const QL = { R: 12, WH: 7, DOME: 5, DW: 3.66, DH: 4.6, NS: 48 };
  const QB = { HX: 15, HY: 12, H: 8, DW: 3.6, DH: 4.4, LN: [-14.6, -4.4], LY: [-11.6, 3.6] };
  const ROOMS = {
    room_hub_library: {
      bounds: [-LB.HX, LB.HX, -LB.HY, LB.HY + .2], spawn: [0, 17.6, Math.PI], exit: [0, LB.HY + .3], ceil: LB.H,
      hemi: { i: .55, c: [1, .9, .74], g: [.3, .22, .16] },
      lights: [{ p: [0, 6.5, 0], c: [1, .78, .5], i: 1, r: 14 }, { p: [0, 7, -16], c: [.85, .88, 1], i: .45, r: 16 }, { p: [0, 9, 8], c: [1, .86, .66], i: .5, r: 26 }, { p: [0, 5, 19.5], c: [.92, .94, 1], i: .4, r: 12 }],
      blockers: [...LB.SHELF.flatMap(y => [{ box: [-LB.HX, y - 2.2, -LB.HX + 1.05, y + 2.2] }, { box: [LB.HX - 1.05, y - 2.2, LB.HX, y + 2.2] }]),
        { circle: [0, 0, 2.75] }, { box: [-6, -LB.HY, 6, -20.6] }, ...[[-10.5, 9], [10.5, 9], [-10.5, 14], [10.5, 14]].map(([x, z]) => ({ box: [x - 1.6, z - .9, x + 1.6, z + .9] })),
        { box: [-8.6, -4.3, -4.4, -1.7] }, { box: [-7.2, -15.6, -1.8, -14.4] }, { box: [1.8, -15.6, 7.2, -14.4] }, { box: [-16.4, 19.6, -11.2, LB.HY] }, { box: [11.2, 19.6, 16.4, LB.HY] }, { circle: [-7, 19.6, .9] }]
    },
    room_hub_arcade: {
      bounds: [-AR.HX, AR.HX, -AR.HY, AR.HY + .2], spawn: [0, 15.6, Math.PI], exit: [0, AR.HY + .3], ceil: AR.H,
      hemi: { i: .66, c: [.7, .64, 1], g: [.2, .16, .3] },
      lights: [{ p: [0, 6, -15.5], c: [.5, .65, 1], i: 1.1, r: 22 }, { p: [-16, 8, 0], c: [1, .4, .82], i: .8, r: 26 }, { p: [16, 8, 0], c: [.35, .88, 1], i: .8, r: 26 },
        { p: [0, 5.5, 15], c: [1, .86, .64], i: .55, r: 15 }, { p: [0, 7, 0], c: [.92, .66, 1], i: .6, r: 18 }],
      blockers: [{ box: [-AR.HX, -14.1, -20.3, -3.9] }, { box: [-AR.HX, 3.9, -20.3, 14.1] }, { box: [20.3, -14.1, AR.HX, -3.9] }, { box: [20.3, 3.9, AR.HX, 14.1] },
        { box: [-8.6, -AR.HY, 8.6, -17.15] }, { circle: [-6.5, -16.2, .75] }, { circle: [6.5, -16.2, .75] }, ...AR.COLS.flatMap(z => [{ circle: [-15.5, z, .65] }, { circle: [15.5, z, .65] }]),
        { box: [-7, -12.1, -2, -10.9] }, { box: [2, -12.1, 7, -10.9] }, { box: [11.6, 13.6, 18.4, AR.HY] }, { box: [-16.3, 13.9, -13.7, 16.5] }, { circle: [7.6, 17.6, .9] }]
    },
    room_sam_library: {
      bounds: [-SL.HX, SL.HX, -SL.HY, SL.HY + .2], spawn: [0, 6.4, Math.PI], exit: [0, SL.HY + .3], ceil: SL.H,
      hemi: { i: .62, c: [1, .9, .76], g: [.3, .22, .16] },
      lights: [{ p: [0, 5.5, 0], c: [1, .84, .62], i: .7, r: 18 }, { p: [0, 3.5, -13.4], c: [1, .9, .7], i: .9, r: 8 }, { p: [-6, 2.2, 1], c: [1, .76, .48], i: .45, r: 9 }, { p: [6, 2.2, 1], c: [1, .76, .48], i: .45, r: 9 }],
      blockers: [...SL.DESKS.map(([x, z]) => ({ box: [x - 1, z - .45, x + 1, z + .45] })), { box: [-SL.HX, SL.CUB.y0, -SL.HX + SL.CUB.d + .05, SL.CUB.y1] }, { box: [SL.HX - SL.CUB.d - .05, SL.CUB.y0, SL.HX, SL.CUB.y1] }]
    },
    room_sam_forge: {
      bounds: [-SF.HX, SF.HX, -SF.HY, SF.HY + .2], spawn: [0, 5.4, Math.PI], exit: [0, SF.HY + .3], ceil: SF.H,
      hemi: { i: .32, c: [1, .8, .62], g: [.16, .09, .05] },
      lights: [{ p: [0, 1.7, -8], c: [1, .5, .18], i: 1.5, r: 15, flicker: .3 }, { p: [0, 4.2, -3], c: [1, .66, .36], i: .5, r: 12 }, { p: [0, 3, 8.5], c: [.92, .94, 1], i: .35, r: 8 }],
      blockers: [{ box: [-SF.HEARTH[2] / 2 - .2, -SF.HY, SF.HEARTH[2] / 2 + .2, SF.HEARTH[1] + SF.HEARTH[3] / 2 + .1] }, { box: [-4.5, -8.7, -2.7, -7.7] }, ...SF.ANV.map(([x, z]) => ({ circle: [x, z, .75] })),
        { box: [4.2, -7, 6.9, -6] }, { box: [-SF.HX, -6.6, -SF.HX + .7, 4.6] }, { box: [SF.HX - .5, -5, SF.HX, 5] }, { box: [7.5, 4, 11.5, 8] }]
    },
    room_sam_ancestors: {
      bounds: [-SA.HX, SA.HX, -SA.HY, SA.HY + .2], spawn: [0, 10.2, Math.PI], exit: [0, SA.HY + .3], ceil: SA.WALL + SA.VAULT - .4,
      hemi: { i: .34, c: [1, .82, .6], g: [.14, .09, .06] },
      lights: [{ p: [0, 2.6, -12.5], c: [1, .72, .36], i: 1.3, r: 14, flicker: .18 }, { p: [0, 2, 0], c: [1, .6, .3], i: .55, r: 10, flicker: .2 }, { p: [-7, 3, 7], c: [1, .86, .66], i: .4, r: 10 }, { p: [0, 3, 13.5], c: [.92, .94, 1], i: .3, r: 7 }],
      blockers: [{ box: [-9, -SA.HY, 9, -SA.HY + 3.6] }, { circle: [0, 0, 1.2] }, { box: [-11.6, 5.4, -8.2, 8.8] }]
    },
    room_ronin_shadow_dojo: {
      bounds: [-RS.HX, RS.HX, -RS.HY, RS.HY + .2], spawn: [0, 10.6, Math.PI], exit: [0, RS.HY + .3], ceil: RS.H,
      hemi: { i: .22, c: [.55, .6, .86], g: [.05, .05, .08] },
      lights: [{ p: [-8, 8, 0], c: [.62, .72, 1], i: .75, r: 21 }, { p: [8, 8, 0], c: [.62, .72, 1], i: .75, r: 21 }, { p: [0, 3.2, -12.5], c: [1, .18, .14], i: .8, r: 11 }, { p: [0, 4, 12.6], c: [.9, .92, 1], i: .3, r: 8 }],
      blockers: [{ box: [-RS.HX, 9.5, -RS.HX + .8, 13.5] }, { box: [RS.HX - .8, 9.5, RS.HX, 13.5] }]
    },
    room_ronin_strategy: {
      bounds: [-RT.HX, RT.HX, -RT.HY, RT.HY + .2], spawn: [0, 2.6, Math.PI], exit: [0, RT.HY + .3], ceil: RT.H,
      hemi: { i: .2, c: [.8, .66, .55], g: [.1, .06, .05] },
      lights: [{ p: [RT.TAB[0], 1.4, RT.TAB[1]], c: [1, .6, .3], i: 1.15, r: 9, flicker: .35 }, { p: [-8, 3, 0], c: [.6, .7, 1], i: .35, r: 7 }, { p: [0, 3, 6], c: [.9, .92, 1], i: .22, r: 5 }],
      blockers: [{ box: [RT.TAB[0] - 1.45, RT.TAB[1] - .95, RT.TAB[0] + 1.45, RT.TAB[1] + .95] }, { box: [RT.HX - .9, -4.6, RT.HX, -.6] }]
    },
    room_ronin_debts: {
      bounds: [-HD.HX, HD.HX, -HD.HY, HD.HY + .2], spawn: [0, 17.6, Math.PI], exit: [0, HD.HY + .3], ceil: HD.H,
      hemi: { i: .26, c: [.78, .72, .66], g: [.1, .08, .07] },
      lights: [{ p: [0, 1.9, -19.4], c: [1, .55, .25], i: 1.25, r: 15, flicker: .3 }, { p: [0, 6, -2], c: [1, .78, .58], i: .38, r: 22 }, { p: [0, 3.5, 19], c: [.9, .92, 1], i: .3, r: 8 }],
      blockers: [{ box: [-1.9, -HD.HY, 1.9, -18.7] }]
    },
    room_ronin_old_door: {
      bounds: [-OD.HX, OD.HX, -OD.HY, OD.HY + .2], spawn: [0, 13.6, Math.PI], exit: [0, OD.HY + .3], ceil: OD.H,
      hemi: { i: .24, c: [.55, .62, .86], g: [.06, .06, .09] },
      lights: [{ p: [0, 14, -14], c: [.66, .76, 1], i: 1.15, r: 23 }, { p: [-4.5, 2.2, -11.5], c: [1, .5, .2], i: .8, r: 10, flicker: .3 }, { p: [4.5, 2.2, -11.5], c: [1, .5, .2], i: .8, r: 10, flicker: .3 }, { p: [0, 3.8, 15.6], c: [.9, .92, 1], i: .3, r: 8 }],
      decks: [{ box: [-OD.DAIS.x, OD.DAIS.y0, OD.DAIS.x, OD.DAIS.y1], y: OD.DAIS.h }, { box: [-OD.ST.x, OD.DAIS.y1, OD.ST.x, OD.ST.y1], y0: 0, y1: OD.DAIS.h, axis: 'z', steps: OD.ST.n, flip: true }],
      blockers: [{ circle: [-OD.STAT, -12, 1.5] }, { circle: [OD.STAT, -12, 1.5] }, { circle: [-4.5, -11.5, .75] }, { circle: [4.5, -11.5, .75] }]
    },
    room_hub_tunnels: {
      bounds: [-28, 22, -39, 20.8], spawn: [0, 16.5, Math.PI], exit: [0, 20.9], ceil: 5.4,
      hemi: { i: .3, c: [.62, .78, .8], g: [.12, .1, .08] },
      lights: [{ p: [0, 5, -24], c: [1, .6, .22], i: 1.25, r: 22, flicker: .3 }, { p: [-3, 3, 4], c: [.3, 1, .85], i: .7, r: 12 }, { p: [16, 3, -3.4], c: [.35, 1, .8], i: .6, r: 9 },
        { p: [-23, 3.5, -25.2], c: [.45, .7, 1], i: .8, r: 10 }, { p: [0, 3.5, 17], c: [.95, .95, 1], i: .45, r: 9 }],
      walk: [{ path: AT.PATH, r: 2 }, { circle: [AT.CH[0], AT.CH[1], AT.CH[2] - 1.2] }, { path: AT.REC, r: 1.9 }, { circle: AT.RECC }, { path: AT.SEAL, r: 1.9 }, { circle: AT.SEALC }],
      blockers: [{ circle: [AT.CH[0], AT.CH[1], 4.6] }, { circle: [-25.2, -25.2, 1.4] }]
    },
    room_hub_forest_dojo: {
      bounds: [-FD.HX, FD.HX, -FD.HY, FD.HY + .2], spawn: [0, 10.6, Math.PI], exit: [0, FD.HY + .3], ceil: FD.H,
      hemi: { i: .66, c: [.92, 1, .84], g: [.24, .34, .16] },
      lights: [{ p: [0, 9.5, 0], c: [1, .96, .82], i: 1.25, r: 17 }, { p: [-11, 5, 4], c: [.9, 1, .78], i: .45, r: 16 }, { p: [11, 5, -4], c: [.9, 1, .78], i: .45, r: 16 }, { p: [0, 4, 13], c: [.95, .96, 1], i: .35, r: 10 }],
      parts: FD.FLIES.map(([x, z, y], i) => ({ type: 'room_hub_forest_firefly', p: [x, y, z], anim: { bob: [.35 + (i % 3) * .12, 2.6 + (i % 4) * .7] } })),
      blockers: [{ circle: [0, 0, FD.TR + .25] }, ...Array.from({ length: 6 }, (_, k) => { const a = k / 6 * Math.PI * 2 + Math.PI / 6; return { circle: [Math.cos(a) * FD.DUM, Math.sin(a) * FD.DUM, .55] }; }),
        { box: [-FD.HX, -9, -FD.HX + .9, -3] }, { box: [FD.HX - .9, 3, FD.HX, 9] }]
    },
    room_hub_theatre: {
      bounds: [-TH.HX, TH.HX, -TH.HY, TH.HY + .2], spawn: [TH.DX, 16.8, Math.PI], exit: [TH.DX, TH.HY + .3], ceil: TH.H,
      hemi: { i: .42, c: [.86, .8, .9], g: [.2, .14, .14] },
      lights: [{ p: [0, 7.5, 16.5], c: [1, .86, .64], i: 1.2, r: 17 }, { p: [-8, 9, 3], c: [1, .72, .48], i: .55, r: 19 }, { p: [8, 9, 3], c: [1, .72, .48], i: .55, r: 19 },
        { p: [0, 6.5, -18], c: [.85, .9, 1], i: .6, r: 12 }, { p: [TH.DX, 4, 20], c: [.92, .94, 1], i: .35, r: 9 }],
      decks: [{ box: [TH.ST.x0, TH.ST.y0, TH.ST.x1, TH.ST.y1], y: TH.ST.h }, { box: [-2, TH.ST.y0 - 2.2, 2, TH.ST.y0], y0: 0, y1: TH.ST.h, axis: 'z', steps: 4 },
        { box: [TH.HN.x0, TH.HN.y0, TH.HN.x1, TH.ST.y0], y: TH.HN.h }, { box: [TH.HN.x0, TH.HN.y0 - 1.4, TH.HN.x1, TH.HN.y0], y0: 0, y1: TH.HN.h, axis: 'z', steps: 3 },
        ...Array.from({ length: TH.TIER.n }, (_, k) => ({ box: [-TH.HX, TH.TIER.y0 - TH.TIER.d * (k + 1), TH.HX, TH.TIER.y0 - TH.TIER.d * k], y: TH.TIER.r * (k + 1) })),
        { box: [-TH.HX, -TH.HY, TH.HX, TH.TIER.y0 - TH.TIER.d * TH.TIER.n], y: TH.BACK }],
      blockers: [{ box: [-3, -TH.HY, 3, -19.4], minY: 2 }]
    },
    room_hub_gathering: {
      bounds: [-GH.HX, GH.HX, -GH.HY, GH.HY + .2], spawn: [0, 15.6, Math.PI], exit: [0, GH.HY + .3], ceil: GH.H,
      hemi: { i: .74, c: [1, .87, .72], g: [.36, .25, .18] },
      lights: [{ p: [0, 1.9, GH.HE.cy], c: [1, .55, .25], i: 1.15, r: 13, flicker: .2 }, { p: [-12, 8.5, 2], c: [1, .8, .56], i: .85, r: 27 }, { p: [12, 8.5, 2], c: [1, .8, .56], i: .85, r: 27 },
        { p: [0, 7.5, -14.5], c: [1, .86, .64], i: 1.15, r: 18 }, { p: [0, 5, 18], c: [.92, .94, 1], i: .4, r: 12 }],
      decks: [{ box: [-GH.HE.s, GH.HE.cy - GH.HE.s, GH.HE.s, GH.HE.cy + GH.HE.s], y: GH.HE.h }, { box: [GH.ST.x0, GH.ST.y0, GH.ST.x1, GH.ST.y1], y: GH.ST.h },
        { box: [-2.5, GH.ST.y1, 2.5, GH.ST.y1 + 2.4], y0: 0, y1: GH.ST.h, axis: 'z', steps: 4, flip: true }],
      blockers: [{ box: [-1.6, GH.HE.cy - 1.6, 1.6, GH.HE.cy + 1.6] }, { box: [-10, -9, -8.4, 7] }, { box: [8.4, -9, 10, 7] }, ...GH.COLS.map(([x, z]) => ({ circle: [x, z, .62] })),
        { circle: [-5.5, -17.6, 1.35], minY: 1 }, { circle: [5.5, -17.6, 1.35], minY: 1 }, { box: [-8.6, GH.ST.y0, 8.6, -19] }]
    },
    room_sam_dojo: {
      bounds: [-SD.HX, SD.HX, -SD.HY, SD.HY + .2], spawn: [0, 11.6, Math.PI], exit: [0, SD.HY + .3],
      hemi: { i: .6, c: [1, .9, .76], g: [.32, .24, .18] },
      lights: [{ p: [0, 6, -9.6], c: [1, .7, .42], i: 1.05, r: 17 }, { p: [0, 10.5, -1], c: [1, .86, .66], i: .55, r: 30 }, { p: [0, 4.5, 13.2], c: [.92, .94, 1], i: .4, r: 12 }],
      blockers: [{ box: [-11.4, -SD.HY, 11.4, -10.3] }, ...SD.CY.flatMap(z => [{ circle: [-SD.CX, z, .78] }, { circle: [SD.CX, z, .78] }]),
        { box: [-SD.HX, -7.9, -18.85, -4.1] }, { box: [-SD.HX, .1, -18.85, 3.9] }, { circle: [16.6, -6, .62] }, { circle: [16.6, 2, .62] },
        { box: [14.9, 11.25, 17.7, 13.35] }, { box: [-8.25, 14.7, -4.95, SD.HY] }, { box: [5.9, 14.4, 7.3, 15.8] }]
    },
    room_shogun_throne: {
      bounds: [-TS.HX, TS.HX, -TS.HY, TS.HY + .2], spawn: [0, TS.HY - 4.6, Math.PI], exit: [0, TS.HY + .3], ceil: TS.H,
      hemi: { i: .5, c: [1, .9, .8], g: [.26, .18, .22] },
      lights: [{ p: [0, 6.5, -21.5], c: [1, .86, .6], i: 1.15, r: 15 }, { p: [0, 8, -8], c: [1, .82, .58], i: .75, r: 22 }, { p: [0, 8, 8], c: [1, .82, .58], i: .65, r: 20 },
        { p: [-13, 6, 0], c: [.82, .6, 1], i: .35, r: 20 }, { p: [13, 6, 0], c: [.82, .6, 1], i: .35, r: 20 }, { p: [0, 4, TS.HY - 2.5], c: [.92, .94, 1], i: .4, r: 10 }],
      decks: [{ box: [-TS.DAIS.hw, TS.DAIS.y0, TS.DAIS.hw, TS.DAIS.y1], y: TS.DAIS.h }, { box: [-TS.ST.hw, TS.DAIS.y1, TS.ST.hw, TS.DAIS.y1 + TS.ST.d], y0: 0, y1: TS.DAIS.h, axis: 'z', steps: TS.ST.n, flip: true }],
      blockers: [{ box: [-TS.CHX - .6, TS.TAB.y0 - .1, TS.CHX + .6, TS.TAB.y1 + .1] }, ...TS.SEATS.flatMap(y => [{ circle: [-TS.BX, y, .32] }, { circle: [TS.BX, y, .32] }]),
        ...TS.COLS.flatMap(y => [{ circle: [-TS.CX, y, .72] }, { circle: [TS.CX, y, .72] }]), { circle: [0, -16.1, .6] }, { circle: [0, TS.THR, 1.25], minY: .8 },
        ...[-1, 1].flatMap(s => [{ circle: [s * TS.CAN[0], TS.CAN[1], .26], minY: .8 }, { circle: [s * TS.CAN[0], TS.CAN[2], .26], minY: .8 }, { circle: [s * 6.2, -22, .95], minY: .8 },
          { circle: [s * 7.4, -24.3, .75], minY: .8 }, { circle: [s * 4, 18.5, .6] }, { circle: [s * (TS.HX - 1.4), -17.5, .5] }, { circle: [s * (TS.HX - 1.4), -2.5, .5] }, { circle: [s * (TS.HX - 1.4), 12.5, .5] }])]
    },
    room_shogun_records: {
      bounds: [-CR.HX, CR.HX, -CR.HY, CR.HY + .2], spawn: [0, CR.HY - 4.6, Math.PI], exit: [0, CR.HY + .3], ceil: CR.H,
      hemi: { i: .55, c: [.95, .94, 1], g: [.3, .26, .24] },
      lights: [{ p: [0, 9, -1], c: [.95, .96, 1], i: .8, r: 20 }, { p: [0, 4.8, -10.4], c: [1, .8, .55], i: .85, r: 12 }, { p: [-9, 4, 5], c: [1, .84, .62], i: .45, r: 12 },
        { p: [9, 4, 5], c: [1, .84, .62], i: .45, r: 12 }, { p: [0, 3, CR.HY - 1.2], c: [.92, .94, 1], i: .35, r: 8 }],
      blockers: [{ box: [-CR.BW - .25, -CR.HY, CR.BW + .25, -6.3] }, { box: [-CR.HX, -12.7, -CR.HX + .8, 12.7] }, { box: [CR.HX - .8, -12.7, CR.HX, 12.7] },
        ...CR.LAD.map(([s, y]) => ({ box: s < 0 ? [-CR.HX + .6, y - .45, -CR.HX + 1.8, y + .45] : [CR.HX - 1.8, y - .45, CR.HX - .6, y + .45] })),
        { box: [CR.PRESS[0] - 1.2, CR.PRESS[1] - .7, CR.PRESS[0] + 1.2, CR.PRESS[1] + .7] }, { box: [-8.8, CR.HY - .7, -6.2, CR.HY] }, { box: [-CR.HX + .75, 8.6, -9.4, 11.8] }]
    },
    room_shogun_keep: {
      bounds: [-KP.HX, KP.HX, -KP.HY, KP.HY + .2], spawn: [0, KP.HY - 4.6, Math.PI], exit: [0, KP.HY + .3], ceil: KP.H,
      hemi: { i: .5, c: [1, .9, .82], g: [.22, .18, .2] },
      lights: [{ p: [0, 21, -9.5], c: [1, .76, .6], i: .9, r: 14 }, { p: [0, 14.5, 9.5], c: [1, .84, .64], i: .6, r: 12 }, { p: [0, 8.5, -9.5], c: [1, .84, .64], i: .6, r: 12 },
        { p: [0, 4, 0], c: [1, .8, .56], i: .75, r: 16 }, { p: [0, 3.5, 9], c: [.92, .94, 1], i: .35, r: 8 }, { p: [0, 22, 0], c: [.85, .7, 1], i: .35, r: 20 }],
      // galleries (walk beneath them), flight A solid from the floor, B and C on beams (walk beneath)
      decks: [{ box: [-KP.HX, -KP.HY, KP.HX, -KP.I], y: KP.LV[0], under: true }, { box: [-KP.HX, KP.I, KP.HX, KP.HY], y: KP.LV[1], under: true }, { box: [-KP.HX, -KP.HY, KP.HX, -KP.I], y: KP.LV[2], under: true },
        { box: [KP.I, -KP.I, KP.HX, 6], y0: 0, y1: KP.LV[0], axis: 'z', steps: KP.N, flip: true }, { box: [-KP.HX, -KP.I, -KP.I, KP.I], y0: KP.LV[0], y1: KP.LV[1], axis: 'z', steps: KP.N, under: true },
        { box: [KP.I, -KP.I, KP.HX, KP.I], y0: KP.LV[1], y1: KP.LV[2], axis: 'z', steps: KP.N, flip: true, under: true }],
      // the railings hold only at their own level (minY / maxY); ground furniture only on the ground (maxY)
      blockers: [{ circle: [0, 0, 1.05] }, ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => ({ circle: [a * KP.I, b * KP.I, .42] })),
        { box: [-KP.I, -KP.I - .15, KP.I, -KP.I + .1], minY: 5, maxY: 7 }, { box: [-KP.I, KP.I - .1, KP.I, KP.I + .15], minY: 11, maxY: 13 }, { box: [-KP.HX, -KP.I - .15, KP.I, -KP.I + .1], minY: 17 },
        { box: [KP.I - .15, -KP.I, KP.I + .1, 6], minY: .25, maxY: 6.6 }, { box: [-KP.I - .1, -KP.I, -KP.I + .15, KP.I], minY: 6.25, maxY: 12.6 }, { box: [KP.I - .15, -KP.I, KP.I + .1, KP.I], minY: 12.25, maxY: 18.6 },
        { box: [-1.6, -KP.HY, 1.6, -8.05], maxY: .5 }, { box: [-KP.HX, -5, -9.6, 6.7], maxY: .5 }, { box: [-6.2, KP.HY - .7, -3.8, KP.HY], maxY: .5 }, { box: [3.8, KP.HY - .7, 6.2, KP.HY], maxY: .5 },
        { box: [-2.1, KP.HY - .65, 2.1, KP.HY], minY: 11.5, maxY: 12.5 }, { box: [-1.3, -KP.HY, 1.3, -KP.HY + .8], minY: 17.5 }, { circle: [10.2, -10.3, .45], minY: 17.5 }, { circle: [-10.2, -10.3, .45], minY: 17.5 }]
    },
    room_shogun_council: {
      bounds: [-WC.R, WC.R, -WC.R, WC.R + .4], spawn: [0, WC.R - 4.6, Math.PI], exit: [0, WC.R + .3], ceil: WC.WH + WC.DOME - 1.5,
      hemi: { i: .42, c: [.86, .78, 1], g: [.2, .14, .22] },
      lights: [{ p: [0, 5.5, 0], c: [1, .82, .54], i: 1.2, r: 15 }, { p: [-8, 5, -6], c: [.8, .62, 1], i: .45, r: 14 }, { p: [8, 5, -6], c: [.8, .62, 1], i: .45, r: 14 },
        { p: [0, 10.5, 0], c: [.95, .85, 1], i: .45, r: 18 }, { p: [0, 3, WC.R - 2], c: [.92, .94, 1], i: .35, r: 8 }],
      walk: [{ circle: [0, 0, WC.R - .35] }, { box: [-WC.DW / 2, WC.R - 2, WC.DW / 2, WC.R + .45] }],
      blockers: [{ circle: [0, 0, WC.SEAT + .6] }, { box: [-WC.SCR[0] / 2 - .5, -WC.R, WC.SCR[0] / 2 + .5, -12.9] },
        ...[Math.PI / 6, 5 * Math.PI / 6, 7 * Math.PI / 6, 11 * Math.PI / 6].map(t => ({ circle: [Math.cos(t) * (WC.R - 1), Math.sin(t) * (WC.R - 1), .75] }))]
    },
    room_bushi_war: {
      bounds: [-WR.HX, WR.HX, -WR.HY, WR.HY + .2], spawn: [0, WR.HY - 4.6, Math.PI], exit: [0, WR.HY + .3], ceil: WR.H,
      hemi: { i: .48, c: [.82, .86, 1], g: [.24, .2, .22] },
      lights: [{ p: [WR.HX - 1.6, 4.6, WR.WIN.y], c: [1, .62, .32], i: 1.25, r: 20 }, { p: [0, 6.5, WR.TAB[1]], c: [1, .86, .66], i: .7, r: 14 }, { p: [-10, 5, 0], c: [.7, .78, 1], i: .4, r: 14 }, { p: [0, 3.5, WR.HY - 1.5], c: [.92, .94, 1], i: .35, r: 8 }],
      blockers: [{ box: [WR.TAB[0] - WR.TAB[2] - .3, WR.TAB[1] - WR.TAB[3] - .3, WR.TAB[0] + WR.TAB[2] + .3, WR.TAB[1] + WR.TAB[3] + .3] }, { circle: [-8.4, WR.TAB[1], .75] },
        { box: [-11.2, -WR.HY, 11.2, -WR.HY + 1] }, { circle: [-11.4, -8.6, .45] }, { box: [-WR.HX, 4.5, -WR.HX + 1, 9.5] }, { box: [6.6, WR.HY - .8, 11.4, WR.HY] }]
    },
    room_bushi_strategy: {
      bounds: [-BG.HX, BG.HX, -BG.HY, BG.HY + .2], spawn: [0, BG.HY - 4.6, Math.PI], exit: [0, BG.HY + .3], ceil: BG.H,
      hemi: { i: .62, c: [1, .94, .84], g: [.32, .26, .2] },
      lights: [{ p: [0, 6, BG.BY], c: [1, .9, .74], i: .85, r: 16 }, { p: [-10, 4, -1.5], c: [1, .84, .62], i: .45, r: 12 }, { p: [10, 4, -1.5], c: [1, .84, .62], i: .45, r: 12 }, { p: [0, 4, -10.5], c: [1, .8, .56], i: .5, r: 9 }, { p: [0, 3.5, BG.HY - 1.5], c: [.92, .94, 1], i: .35, r: 8 }],
      blockers: [...[...BG.GO, ...BG.SH].map(([x, z]) => ({ box: [x - .9, z - 1.75, x + .9, z + 1.75] })), ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => ({ circle: [a * (BG.B + 1), BG.BY + b * (BG.B + 1), .75] })),
        { box: [-3.2, -BG.HY, 3.2, -BG.HY + 1.3] }]
    },
    room_bushi_dojo: {
      bounds: [-BD.HX, BD.HX, -BD.HY, BD.HY + .2], spawn: [0, BD.HY - 4.6, Math.PI], exit: [0, BD.HY + .3], ceil: BD.H,
      hemi: { i: .56, c: [.9, .92, 1], g: [.26, .22, .22] },
      lights: [{ p: [0, 7, -12], c: [1, .62, .4], i: 1, r: 18 }, { p: [0, 8, 0], c: [1, .88, .72], i: .6, r: 24 }, { p: [-16.5, 6.5, -4], c: [.8, .86, 1], i: .4, r: 14 }, { p: [16.5, 6.5, -4], c: [.8, .86, 1], i: .4, r: 14 }, { p: [0, 4.5, BD.HY - 1.5], c: [.92, .94, 1], i: .4, r: 10 }],
      decks: [...[-1, 1].flatMap(s => [{ box: s < 0 ? [-BD.HX, -BD.HY, -BD.HX + BD.G, BD.GY] : [BD.HX - BD.G, -BD.HY, BD.HX, BD.GY], y: BD.GH },
        { box: s < 0 ? [-BD.HX, BD.GY, -BD.HX + BD.G, BD.SY] : [BD.HX - BD.G, BD.GY, BD.HX, BD.SY], y0: 0, y1: BD.GH, axis: 'z', steps: 11, flip: true }]),
        { box: [-BD.DA[0], BD.DA[1], BD.DA[0], BD.DA[2]], y: BD.DA[3] }, { box: [-1.6, BD.DA[2], 1.6, BD.DA[2] + .9], y0: 0, y1: BD.DA[3], axis: 'z', steps: 2, flip: true }],
      blockers: [{ box: [-BD.HX + BD.G - .1, -BD.HY, -BD.HX + BD.G + .15, BD.GY], minY: 2.6 }, { box: [BD.HX - BD.G - .15, -BD.HY, BD.HX - BD.G + .1, BD.GY], minY: 2.6 },
        ...BD.BLK.map(([x, z]) => ({ circle: [x, z, .75] })), { circle: [0, -13.7, .7], minY: .3 }, ...[-1, 1].map(s => ({ circle: [s * 2.6, -13.9, .4], minY: .3 }))]
    },
    room_buke_vault: {
      bounds: [-AV.HX, AV.HX, -AV.HY - AV.IN[1], AV.HY + .2], spawn: [0, AV.HY - 4.6, Math.PI], exit: [0, AV.HY + .3], ceil: AV.SPR + AV.RISE - .4,
      hemi: { i: .38, c: [.86, .9, .78], g: [.16, .18, .12] },
      lights: [{ p: [-AV.PX, 3.4, -7.5], c: [1, .7, .38], i: .7, r: 11, flicker: .15 }, { p: [AV.PX, 3.4, -2.5], c: [1, .7, .38], i: .7, r: 11, flicker: .15 }, { p: [-AV.PX, 3.4, 2.5], c: [1, .7, .38], i: .7, r: 11, flicker: .15 },
        { p: [AV.PX, 3.4, 7.5], c: [1, .7, .38], i: .7, r: 11, flicker: .15 }, { p: [0, 2.6, -AV.HY - 2.2], c: [1, .86, .5], i: .9, r: 6 }, { p: [0, 3.5, AV.HY - 1.5], c: [.92, .94, 1], i: .35, r: 8 }],
      walk: [{ box: [-AV.HX, -AV.HY, AV.HX, AV.HY + .2] }, { box: [-1.35, -AV.HY - 2.2, 1.35, -AV.HY + 1.8] }, { box: [-AV.IN[0], -AV.HY - AV.IN[1], AV.IN[0], -AV.HY - .3] }], // the doorway zone overlaps both rooms by a body's width
      blockers: [...AV.PY.flatMap(y => [{ circle: [-AV.PX, y, .85] }, { circle: [AV.PX, y, .85] }]), { box: [-AV.HX, -AV.HY, -AV.HX + 1, AV.HY - 2] }, { box: [AV.HX - 1, -AV.HY, AV.HX, AV.HY - 2] },
        { box: [AV.VD.r - .35, -AV.HY, AV.VD.r + .35, -AV.HY + 2 * AV.VD.r + .2] }, { circle: [0, -AV.HY - 3, .7] }]
    },
    room_buke_great_hall: {
      bounds: [-BH.HX, BH.HX, -BH.HY, BH.HY + .2], spawn: [0, BH.HY - 4.6, Math.PI], exit: [0, BH.HY + .3], ceil: BH.H + 3,
      hemi: { i: .55, c: [1, .9, .78], g: [.28, .22, .18] },
      lights: [{ p: [0, 7, -10], c: [1, .76, .48], i: .9, r: 18 }, { p: [0, 7, 8], c: [1, .82, .58], i: .7, r: 18 }, { p: [-14, 1.2, 0], c: [.55, .75, 1], i: .4, r: 10 }, { p: [14, 1.2, 0], c: [.55, .75, 1], i: .4, r: 10 },
        { p: [0, 11, 0], c: [1, .9, .78], i: .4, r: 24 }, { p: [0, 4, BH.HY - 1.5], c: [.92, .94, 1], i: .4, r: 10 }],
      decks: BH.BR.flatMap(x => [{ box: [x - BH.BW, -BH.CY - BH.BL, x + BH.BW, 0], y0: 0, y1: BH.BT, axis: 'z' }, { box: [x - BH.BW, 0, x + BH.BW, BH.CY + BH.BL], y0: BH.BT, y1: 0, axis: 'z' }]),
      flows: [{ mat: 'water_flow', u: .05 }],
      blockers: [{ box: [-BH.HX, -BH.CY, BH.HX, BH.CY], maxY: .05 }, ...BH.BR.flatMap(x => [{ box: [x - BH.BW - .2, -BH.CY, x - BH.BW + .05, BH.CY], minY: .05 }, { box: [x + BH.BW - .05, -BH.CY, x + BH.BW + .2, BH.CY], minY: .05 }]), // the canal holds only on the floor: the bridge ramps are above .05 within a body's width of it
        { box: [-5, -BH.HY, 5, -10.4] }, ...[-1, 1].flatMap(s => [{ box: [s * 12 - 4.7, -8.5, s * 12 + 4.7, -5.5] }, { circle: [s * 6.2, -9.2, .6] }])]
    },
    room_buke_tunnels: {
      bounds: [-31, 3, -43, 21.2], spawn: [0, 16.4, Math.PI], exit: [0, 21.3], ceil: BT.TH - .2,
      hemi: { i: .4, c: [1, .9, .74], g: [.22, .16, .1] },
      lights: [{ p: [0, 4, 9], c: [1, .7, .4], i: .8, r: 13, flicker: .2 }, { p: [-13, 4, -2], c: [1, .7, .4], i: .8, r: 13, flicker: .2 }, { p: [-26, 4, -22], c: [1, .7, .4], i: .7, r: 12, flicker: .2 },
        { p: [-27.5, 3, -10], c: [1, .88, .66], i: .7, r: 12 }, { p: [-26, 9, -38], c: [.9, .94, 1], i: .9, r: 16 }, { p: [0, 3, 19.5], c: [.92, .94, 1], i: .35, r: 8 }],
      walk: [...BT.SEG.map(b => ({ box: b })), { box: BT.LIFT }],
      decks: [{ box: [-28, -40, -24, -36], y: .3 }],
      blockers: [{ box: [-6.3, -2.85, -4.1, -1.15] }, { box: [-30.6, -42.6, -28.4, -40.4] }, { circle: [-22.2, -42, .7] }, ...[[-28, -40], [-24, -40], [-28, -36], [-24, -36]].map(([x, z]) => ({ circle: [x, z, .2] }))]
    },
    room_buke_workshop: {
      bounds: [-EW.HX, EW.HX, -EW.HY, EW.HY + .2], spawn: [0, EW.HY - 4.6, Math.PI], exit: [0, EW.HY + .3], ceil: EW.H,
      hemi: { i: .55, c: [1, .94, .84], g: [.28, .24, .18] },
      lights: [{ p: [-11.5, 5, EW.WY], c: [.95, .96, 1], i: .9, r: 14 }, { p: [3, 5.5, -1], c: [1, .86, .64], i: .7, r: 14 }, { p: [8.5, 4, 6], c: [1, .84, .6], i: .45, r: 9 }, { p: [0, 3.5, EW.HY - 1.5], c: [.92, .94, 1], i: .35, r: 8 }],
      // the wheel turns its gear; the gear above it (and the shaft) turns the other way, faster; the shaft's gears drive the small ones below
      parts: [{ type: 'room_buke_waterwheel', p: [-EW.HX - 1.7, EW.WZ, EW.WY], anim: { spinX: -.45 } }, { type: 'room_buke_gear_18', p: [-10.9, EW.WZ, EW.WY], anim: { spinX: -.45 } },
        { type: 'room_buke_gear_12', p: [-10.9, EW.GZ, EW.WY], anim: { spinX: .675 } }, { type: 'room_buke_gear_14', p: [-1, EW.GZ, EW.WY], anim: { spinX: .675 } },
        { type: 'room_buke_gear_08', p: [-1, EW.GZ - 2.2, EW.WY], anim: { spinX: -1.18 } }, { type: 'room_buke_gear_14', p: [8, EW.GZ, EW.WY], anim: { spinX: .675 } }, { type: 'room_buke_gear_08', p: [8, EW.GZ - 2.2, EW.WY], anim: { spinX: -1.18 } },
        { type: 'room_buke_grindstone', p: [-1, 1.2, EW.WY], anim: { spinX: -1.6 } }, { type: 'room_buke_saw', p: [8, 1.3, EW.WY], anim: { spinX: -3.2 } }],
      flows: [{ mat: 'water_flow', v: -.5 }],
      blockers: [{ box: [-EW.HX, -7.2, -9.4, 1.2] }, { box: [-4.2, 1.1, 6.2, 4.5] }, ...[[5.5, 7.6], [10.5, 7.6], [5.5, -8.4], [10.5, -8.4]].map(([x, z]) => ({ box: [x - 1.4, z - 1.1, x + 1.4, z + 1.1] })), { box: [-3, -EW.HY, 3, -EW.HY + 1] },
        { box: [-2, -4, 0, -2] }, { box: [7, -4, 9, -2] }, { box: [11.6, 1.4, 13.4, 3.2] }]
    },
    room_ashi_workshop: {
      bounds: [-AW.HX, AW.HX, -AW.HY, AW.HY + .2], spawn: [0, AW.HY - 4.6, Math.PI], exit: [0, AW.HY + .3], ceil: AW.H,
      hemi: { i: .62, c: [1, .94, .82], g: [.3, .26, .18] },
      lights: [{ p: [11, 4, -2], c: [.96, .98, .9], i: .9, r: 16 }, { p: [0, 6, 0], c: [1, .88, .7], i: .6, r: 18 }, { p: [4, 3.5, -8], c: [1, .84, .6], i: .45, r: 9 }, { p: [0, 3.5, AW.HY - 1.5], c: [.92, .94, 1], i: .35, r: 8 }],
      blockers: [{ box: [-9.4, -5.4, -2.6, -2.6] }, { box: [-9.4, .6, -2.6, 3.4] }, { box: [.6, -7.4, 6.4, -4.6] }, { box: [.4, -AW.HY, 7.6, -8.2] }, { box: [-10.8, 5, -5.2, 9] }, { box: [-AW.HX, -8.2, -AW.HX + 1.1, 8.2] }, { box: [4.9, 3.1, 7.1, 4.9] }]
    },
    room_ashi_archive: {
      bounds: [-AA.HX, AA.HX, -AA.HY, AA.HY + .2], spawn: [0, AA.HY - 4.6, Math.PI], exit: [0, AA.HY + .3], ceil: AA.RIDGE - .6,
      hemi: { i: .55, c: [1, .92, .74], g: [.3, .24, .14] },
      lights: [{ p: [0, 5, 0], c: [1, .86, .6], i: .7, r: 14 }, { p: [0, 3, -7], c: [1, .82, .56], i: .5, r: 9 }, { p: [0, 3, AA.HY - 1.3], c: [.92, .94, 1], i: .35, r: 7 }],
      blockers: [{ box: [-AA.HX, -8.2, -AA.HX + 1, 8.2] }, { box: [AA.HX - 1, -8.2, AA.HX, 8.2] }, { box: [-2.4, -1.4, 2.4, 1.4] }, { box: [-8.6, 6.2, -5.4, AA.HY] }, { circle: [6.4, 6.8, .8] }, { box: [-3.6, -AA.HY, 3.6, -AA.HY + .6] }]
    },
    room_ashi_dojo: {
      bounds: [-OC.HX, OC.HX, -OC.HY, OC.HY + .2], spawn: [0, OC.HY - 4.6, Math.PI], exit: [0, OC.HY + .3], ceil: OC.H,
      hemi: { i: .6, c: [1, .92, .78], g: [.3, .24, .16] },
      lights: [{ p: [0, 7, 0], c: [1, .88, .7], i: .8, r: 22 }, { p: [-10, 5, 6], c: [1, .86, .64], i: .4, r: 12 }, { p: [10, 5, -6], c: [1, .86, .64], i: .4, r: 12 }, { p: [0, 4, OC.HY - 1.5], c: [.92, .94, 1], i: .4, r: 10 }],
      decks: [{ box: OC.LOGS[0], y: OC.LH }, { box: [OC.LOGS[0][0] - 1, OC.LOGS[0][1] - .1, OC.LOGS[0][0], OC.LOGS[0][3] + .1], y: OC.LH / 2 }, { box: [OC.LOGS[0][2], OC.LOGS[0][1] - .1, OC.LOGS[0][2] + 1, OC.LOGS[0][3] + .1], y: OC.LH / 2 },
        { box: OC.LOGS[1], y: OC.LH }, { box: [OC.LOGS[1][0] - .1, OC.LOGS[1][1] - 1, OC.LOGS[1][2] + .1, OC.LOGS[1][1]], y: OC.LH / 2 }, { box: [OC.LOGS[1][0] - .1, OC.LOGS[1][3], OC.LOGS[1][2] + .1, OC.LOGS[1][3] + 1], y: OC.LH / 2 }],
      blockers: [{ box: OC.NET }, { box: OC.WALL }, ...[-9, -3, 3, 9].map(x => ({ circle: [x, -11.4, .8] })), { box: [-17.4, -12.6, -12.6, -9.6] }, ...[-9.4, -7.4, -5.4, -3.4].map(x => ({ circle: [x, -1.6, .25] }))]
    },
    room_kenshi_duel: {
      bounds: [-KD.HX, KD.HX, -KD.HY, KD.HY + .2], spawn: [0, KD.HY - 4.6, Math.PI], exit: [0, KD.HY + .3], ceil: KD.H,
      hemi: { i: .38, c: [.72, .9, .9], g: [.12, .16, .16] },
      lights: [{ p: [0, 9, 0], c: [.92, .97, 1], i: 1.2, r: 14 }, { p: [0, 3, -12], c: [.5, .9, .86], i: .4, r: 8 }, { p: [-11, 4, 4], c: [.7, .9, .9], i: .3, r: 12 }, { p: [11, 4, 4], c: [.7, .9, .9], i: .3, r: 12 }, { p: [0, 3.5, KD.HY - 1.5], c: [.92, .94, 1], i: .35, r: 8 }],
      decks: [{ circle: [0, 0, KD.C + .35], y: .15 }],
      blockers: [{ box: [KD.POOL[0] - .3, KD.POOL[1] - .2, KD.POOL[2] + .3, KD.POOL[3] + .3] }, { box: [-1.6, -KD.C - .9, 1.6, -KD.C + .1], minY: .1 }, { box: [-KD.HX, -6, -KD.HX + .8, 6] }, { box: [KD.HX - .8, -6, KD.HX, 6] }]
    },
    room_kenshi_library: {
      bounds: [-KL.HX, KL.HX, -KL.HY, KL.HY + .2], spawn: [0, KL.HY - 4.6, Math.PI], exit: [0, KL.HY + .3], ceil: KL.H,
      hemi: { i: .55, c: [.86, .96, .94], g: [.2, .24, .22] },
      lights: [{ p: [0, 5, -1], c: [.9, 1, .96], i: .7, r: 12 }, { p: [-8, 4, 0], c: [1, .9, .74], i: .45, r: 10 }, { p: [8, 4, 0], c: [1, .9, .74], i: .45, r: 10 }, { p: [0, 3.5, KL.HY - 1.4], c: [.92, .94, 1], i: .35, r: 8 }],
      decks: [{ box: [-KL.BR, KL.P[1] - KL.P[2] - 1.4, KL.BR, KL.P[1]], y0: 0, y1: KL.BT, axis: 'z' }, { box: [-KL.BR, KL.P[1], KL.BR, KL.P[1] + KL.P[2] + 1.4], y0: KL.BT, y1: 0, axis: 'z' }],
      parts: [['a', .32], ['b', .22], ['c', .45]].map(([k, w]) => ({ type: 'room_kenshi_koi_' + k, p: [KL.P[0], .1, KL.P[1]], anim: { spin: w } })),
      blockers: [{ circle: [KL.P[0], KL.P[1], KL.P[2] + .25], maxY: .05 }, { box: [-KL.BR - .2, KL.P[1] - KL.P[2], -KL.BR + .05, KL.P[1] + KL.P[2]], minY: .05 }, { box: [KL.BR - .05, KL.P[1] - KL.P[2], KL.BR + .2, KL.P[1] + KL.P[2]], minY: .05 },
        ...[[-8.6, -8.6], [8.6, -8.6], [-9.4, 0], [9.4, 0], [-8.6, 7], [8.6, 7]].map(([x, z]) => ({ circle: [x, z, 1] }))]
    },
    room_kenshi_forge: {
      bounds: [-KF.HX, KF.HX, -KF.HY, KF.HY + .2], spawn: [0, KF.HY - 4.6, Math.PI], exit: [0, KF.HY + .3], ceil: KF.H,
      hemi: { i: .48, c: [.8, .92, .94], g: [.16, .2, .2] },
      lights: [{ p: [0, 3, -2], c: [.8, .95, 1], i: .6, r: 12 }, { p: [-7, 3, 3], c: [.6, .92, .88], i: .35, r: 8 }, { p: [7, 3, 3], c: [.6, .92, .88], i: .35, r: 8 }, { p: [0, 3.5, -7], c: [1, .9, .74], i: .5, r: 9 }, { p: [0, 3, KF.HY - 1.3], c: [.92, .94, 1], i: .35, r: 7 }],
      flows: [{ mat: 'water_flow', u: .3 }],
      decks: [{ box: [-.7, KF.CH[1] - 1.1, .7, KF.CH[3] + 1.1], y: .12 }], // the plank bridge over the channel (longer than the channel's reach: a body's width)
      blockers: [{ box: KF.CH, maxY: .1 }, ...KF.BX.map(x => ({ box: [x - .9, -3.2, x + .9, -.8] })), { box: [-KF.HX, -4, -KF.HX + .9, 6] }, { box: [KF.HX - .9, -4, KF.HX, 6] }, { box: [-6.4, -KF.HY, 6.4, -6.8] }]
    },
    room_kenshi_meditation: {
      bounds: [-KM.HX, KM.HX, -KM.HY, KM.HY + .2], spawn: [0, KM.HY - 4.6, Math.PI], exit: [0, KM.HY + .3], ceil: KM.H,
      hemi: { i: .34, c: [.6, .8, .82], g: [.12, .14, .14] },
      lights: [{ p: [0, 5, -2], c: [.7, .92, .92], i: .55, r: 16 }, { p: [-2, 3, -3], c: [1, .76, .5], i: .35, r: 6 }, { p: [0, 4, -11.5], c: [1, .86, .62], i: .55, r: 10 }, { p: [0, 3, KM.HY - 1.3], c: [.92, .94, 1], i: .35, r: 8 }],
      blockers: [{ box: [KM.G[0] - .2, KM.G[1] - .2, KM.G[2] + .2, KM.G[3] + .2] }, { box: [-5, -KM.HY, 5, -12.2] }]
    },
    room_yam_falls: {
      bounds: [-YF.RX, YF.RX, YF.CY - YF.RY, YF.RY + 1.8], spawn: [0, 8.8, Math.PI], exit: [0, 13.7], ceil: YF.RZ - 1.2,
      hemi: { i: .42, c: [.6, .78, .9], g: [.12, .16, .18] },
      lights: [{ p: [0, 5, -11], c: [.85, .94, 1], i: .85, r: 16 }, { p: [-8, 1.5, -2], c: [.3, 1, .9], i: .5, r: 8 }, { p: [9, 1.5, 3], c: [.3, 1, .9], i: .5, r: 8 }, { p: [9, 3, -6.5], c: [1, .72, .4], i: .5, r: 6, flicker: .25 }, { p: [0, 3, 12], c: [.92, .94, 1], i: .35, r: 7 }],
      walk: [{ circle: [0, YF.CY, 11.2] }, { box: [-2.1, 6, 2.1, 13.9] }],
      decks: [{ circle: [YF.LEDGE[0], YF.LEDGE[1], YF.LEDGE[2]], y: YF.LEDGE[3] }, { circle: [YF.LEDGE[0] - .6, YF.LEDGE[1] + 2.6, .95], y: YF.LEDGE[3] / 2 }],
      flows: [{ mat: 'falls_curtain', v: 1.1 }],
      blockers: [{ box: [-8.4, -14.2, 8.4, -10.6] }, { circle: [-7, 2, 2.5] }, { circle: [4.5, -1.5, 2.1] }, { circle: [YF.LEDGE[0] + .4, YF.LEDGE[1] - .7, 1], minY: .8 }, ...[[-10, -6], [-4.4, 6.6], [11, 4.5]].map(([x, z]) => ({ circle: [x, z, 1.3] }))]
    },
    room_yam_library: {
      bounds: [-YL.HX, YL.HX, -YL.HY, YL.HY + .2], spawn: [2, YL.HY - 4.6, Math.PI], exit: [0, YL.HY + .3], ceil: YL.H,
      hemi: { i: .42, c: [.72, .88, .92], g: [.16, .18, .18] },
      lights: [{ p: [0, 8, 0], c: [.55, .8, 1], i: .7, r: 14 }, { p: [0, 3, 3], c: [1, .86, .64], i: .55, r: 12 }, { p: [0, 9.5, -8.5], c: [1, .86, .64], i: .5, r: 10 }, { p: [6, 9.5, -10], c: [.6, .7, 1], i: .4, r: 8 }, { p: [0, 3.5, YL.HY - 1.4], c: [.92, .94, 1], i: .35, r: 8 }],
      decks: [{ box: [-YL.HX, -YL.HY, YL.HX, -YL.HY + 3], y: YL.GH, under: true }, { box: [YL.HX - 3, -YL.HY, YL.HX, YL.HY], y: YL.GH, under: true }, { box: [-YL.HX, -YL.HY, -YL.HX + 3, YL.ST[1]], y: YL.GH, under: true },
        { box: [-YL.HX, YL.ST[1], -YL.HX + 3, YL.ST[0]], y0: 0, y1: YL.GH, axis: 'z', steps: 20, flip: true }],
      parts: [{ type: 'room_yam_spiral', p: [0, 0, 0], anim: { spin: .12 } }],
      blockers: [{ box: [-YL.HX + 2.85, YL.ST[1], -YL.HX + 3.1, YL.ST[0]], minY: .3, maxY: 6.6 }, { box: [-YL.HX + 3, -YL.HY + 2.85, YL.HX - 3, -YL.HY + 3.1], minY: 5.5 }, { box: [YL.HX - 3.1, -YL.HY + 3, YL.HX - 2.85, YL.HY], minY: 5.5 },
        { box: [-YL.HX + 2.85, -YL.HY + 3, -YL.HX + 3.1, YL.ST[1]], minY: 5.5 }, { box: [YL.HX - 1, -6, YL.HX, 8], maxY: .5 }, { box: [-2.2, -1.4, 2.2, 1.4] }, { circle: [9.5, 9.2, .6], minY: 5.5 }]
    },
    room_yam_shrine: {
      bounds: [-YS.HX, YS.HX, -YS.HY, YS.HY + .2], spawn: [0, YS.HY - 4.6, Math.PI], exit: [0, YS.HY + .3], ceil: YS.H,
      hemi: { i: .46, c: [.66, .84, .94], g: [.14, .16, .18] },
      lights: [{ p: [0, 8, 0], c: [.82, .92, 1], i: 1, r: 18 }, ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => ({ p: [a * 8.6, 2.4, b * 8.6], c: [.35, .7, 1], i: .55, r: 9, flicker: .2 })), { p: [0, 3.2, 7], c: [.9, .94, 1], i: .55, r: 12 }],
      parts: Array.from({ length: 14 }, (_, k) => { const a = k / 14 * Math.PI * 2, d = 4.6 + (k % 3) * .8; return { type: 'room_yam_charm', p: [Math.cos(a) * d, 2.2 + (k % 4) * 1.1, Math.sin(a) * d], ry: a, anim: { bob: [.35 + (k % 3) * .1, 3 + (k % 4) * .6], sway: [.25, 2.6 + (k % 2) * .8] } }; }),
      blockers: [{ circle: [0, 0, 3.9] }, ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => ({ circle: [a * 8.6, b * 8.6, .8] })), ...[-1, 1].map(s => ({ circle: [s * 3.4, YS.R + .7, .4] })), { box: [YS.HX - 1, -6, YS.HX, 2] }]
    },
    room_yam_descent: {
      bounds: [-YD.S, YD.S, -YD.S, YD.S + .2], spawn: [5.5, YD.S - 2.2, Math.PI / 2, YD.TOP], exit: [0, YD.S + .3], ceil: YD.TOP + 6,
      hemi: { i: .28, c: [.6, .78, .92], g: [.08, .1, .14] },
      lights: [{ p: [0, YD.TOP + 4, 10], c: [.92, .96, 1], i: .6, r: 14 }, { p: [0, 20, 0], c: [.4, .62, 1], i: .45, r: 18 }, { p: [0, 1.5, 0], c: [.35, .7, 1], i: 1.2, r: 18 }, { p: [11, 16, -11], c: [1, .72, .42], i: .45, r: 10, flicker: .2 }, { p: [-11, 9, 11], c: [1, .72, .42], i: .45, r: 10, flicker: .2 }],
      decks: [{ box: [-YD.I, YD.I, YD.S, YD.S], y: YD.TOP, under: true }, ...ydPlan().flatMap(f => [{ box: f.box, y0: f.hiAtMin ? f.hi : f.lo, y1: f.hiAtMin ? f.lo : f.hi, axis: f.axis, steps: 12, under: true }, ...(f.lo > 0 ? [{ box: f.corner, y: f.lo, under: true }] : [])]),
        { circle: [0, 0, 2.6], y: YD.PH, under: true }, { box: [2.4, -1.2, YD.I, 1.2], y: YD.PH, under: true }],
      blockers: [{ box: [-YD.I, YD.I - .15, YD.I, YD.I + .1], minY: YD.TOP - .5 }, ...ydPlan().flatMap(f => (f.k === 4 ? [[f.rail[0], f.rail[1], f.rail[2], -1.2], [f.rail[0], 1.2, f.rail[2], f.rail[3]]] : [f.rail]).map(b => ({ box: b, minY: f.lo - .2, maxY: f.hi + .6 }))),
        { box: [2.4, -1.35, YD.I, -1.15], minY: YD.PH - .5, maxY: YD.PH + .7 }, { box: [2.4, 1.15, YD.I, 1.35], minY: YD.PH - .5, maxY: YD.PH + .7 },
        ...Array.from({ length: 16 }, (_, k) => k * Math.PI / 8).filter(a => Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) > .5).map(a => ({ box: [Math.cos(a) * 2.7 - .28, Math.sin(a) * 2.7 - .28, Math.cos(a) * 2.7 + .28, Math.sin(a) * 2.7 + .28], minY: YD.PH - .5, maxY: YD.PH + .7 })),
        { circle: [0, 0, 1.6], maxY: YD.PH - .5 }, { circle: [0, 0, 5], maxY: .4 }, { box: [-YD.S, YD.I, YD.S, YD.S], maxY: 1 }]
    },
    room_sohei_bell: {
      bounds: [-SB.HX, SB.HX, -SB.HY, SB.HY + .2], spawn: [0, SB.HY - 4.6, Math.PI], exit: [0, SB.HY + .3], ceil: SB.H,
      hemi: { i: .45, c: [1, .88, .7], g: [.24, .18, .12] },
      lights: [{ p: [0, 10, 0], c: [1, .86, .62], i: .7, r: 16 }, { p: [-9, 2.5, -6], c: [1, .7, .4], i: .55, r: 9, flicker: .2 }, { p: [9, 2.5, -6], c: [1, .7, .4], i: .55, r: 9, flicker: .2 }, { p: [0, 3, 6], c: [1, .84, .6], i: .45, r: 10 }, { p: [0, 3.5, SB.HY - 1.4], c: [.92, .94, 1], i: .35, r: 8 }],
      parts: [{ type: 'room_sohei_shumoku', p: [SB.FP + 1.6, SB.LIP + 7.8, 0], anim: { sway: [.12, 3.2] } }],
      blockers: [{ circle: [0, 0, SB.BR + .2] }, ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => ({ circle: [a * SB.FP, b * SB.FP, .7] })), { box: [SB.FP + .2, -.6, SB.FP + 4.6, .6] },
        { box: [-SB.HX, -9, -SB.HX + 1.2, 3] }, { box: [SB.HX - 1.2, -9, SB.HX, 3] }, { circle: [-6, 6.5, 1] }]
    },
    room_sohei_dojo: {
      bounds: [-SG.HX, SG.HX, -SG.HY, SG.HY + .2], spawn: [0, SG.HY - 4.6, Math.PI], exit: [0, SG.HY + .3], ceil: SG.H,
      hemi: { i: .4, c: [1, .86, .66], g: [.22, .16, .1] },
      lights: [{ p: [0, 3.2, -12.6], c: [1, .55, .2], i: 1.4, r: 18, flicker: .35 }, { p: [0, 8, 0], c: [1, .86, .64], i: .5, r: 22 }, { p: [-11, 5, 0], c: [1, .8, .55], i: .35, r: 12 }, { p: [11, 5, 0], c: [1, .8, .55], i: .35, r: 12 }, { p: [0, 4, SG.HY - 1.5], c: [.92, .94, 1], i: .4, r: 10 }],
      // the altar platform is open below for the deck test (its steps are steep: a solid side would stop the player two treads short)
      // and held from the floor by a blocker that lets go above the first tread
      decks: [{ box: [-SG.AL[0], SG.AL[1], SG.AL[0], SG.AL[2]], y: SG.AL[3], under: true }, { box: [-1.6, SG.AL[2], 1.6, SG.AL[2] + 1.2], y0: 0, y1: SG.AL[3], axis: 'z', steps: 4, flip: true }],
      blockers: [{ box: [-SG.AL[0], SG.AL[1], SG.AL[0], SG.AL[2]], maxY: .5 }, { circle: [0, -12.6, 1.7], minY: .8 }, ...[-8, -2, 4, 10].flatMap(z => [{ circle: [-11, z, .7] }, { circle: [11, z, .7] }]), ...[30, 150, 210, 330].map(d => { const a = d * Math.PI / 180; return { circle: [Math.cos(a) * 11.6, 1 + Math.sin(a) * 9.4, .8] }; })]
    },
    room_sohei_library: {
      bounds: [-SK.HX, SK.HX, -SK.HY, SK.HY + .2], spawn: [0, SK.HY - 4.6, Math.PI], exit: [0, SK.HY + .3], ceil: SK.H,
      hemi: { i: .5, c: [1, .9, .74], g: [.26, .2, .14] },
      lights: [{ p: [0, 7, 0], c: [1, .86, .6], i: .7, r: 14 }, { p: [-7, 3, 4], c: [1, .8, .55], i: .45, r: 9 }, { p: [7, 3, 4], c: [1, .8, .55], i: .45, r: 9 }, { p: [0, 3, -9], c: [1, .8, .55], i: .45, r: 9 }, { p: [0, 3.5, SK.HY - 1.4], c: [.92, .94, 1], i: .35, r: 8 }],
      parts: [{ type: 'room_sohei_rinzo', p: [0, .5, -1], anim: { spin: .1 } }],
      blockers: [{ circle: [0, -1, SK.RZ + .9] }, { box: [-SK.HX, -10, -SK.HX + 1, 10] }, { box: [SK.HX - 1, -10, SK.HX, 10] }, ...[[-6.5, 5.5], [6.5, 5.5], [-6.5, -7], [6.5, -7]].map(([x, z]) => ({ box: [x - 1.5, z - 1.4, x + 1.5, z + 1.4] }))]
    },
    room_sohei_rite: {
      bounds: [-SR.HX, SR.HX, -SR.HY, SR.HY + .2], spawn: [0, SR.HY - 4.6, Math.PI, SR.Y], exit: [0, SR.HY + .3], ceil: SR.H,
      hemi: { i: .45, c: [1, .88, .66], g: [.22, .16, .08] },
      lights: [{ p: [0, 5, -10.5], c: [1, .84, .55], i: .8, r: 14 }, { p: [-6, 1.2, 0], c: [1, .7, .35], i: .5, r: 10 }, { p: [6, 1.2, 2], c: [1, .7, .35], i: .5, r: 10 }, { p: [0, 7, 4], c: [1, .9, .7], i: .4, r: 18 }, { p: [0, 3.5, SR.HY - 1.4], c: [.92, .94, 1], i: .35, r: 8 }],
      decks: [{ box: [-SR.WK, SR.ST, SR.WK, SR.HY], y: SR.Y }, { box: [-SR.HX, -SR.HY, SR.HX, SR.ST], y: SR.Y + .3 }, { box: [-SR.HX, SR.ST, -SR.HX + SR.LD, SR.HY], y: SR.Y }, { box: [SR.HX - SR.LD, SR.ST, SR.HX, SR.HY], y: SR.Y },
        { box: [-SR.HX, SR.HY - SR.FD, SR.HX, SR.HY], y: SR.Y }],
      parts: Array.from({ length: 12 }, (_, k) => ({ type: 'room_sohei_float_lantern', p: [(k % 2 ? 1 : -1) * (3.2 + (k * 1.7) % 8.6), .3, -7 + (k * 2.9) % 17], anim: { bob: [.05, 2.6 + (k % 3) * .7], spin: .1 * ((k % 3) - 1) } })),
      flows: [{ mat: 'water_flow', u: .02 }],
      blockers: [{ box: [-SR.HX + SR.LD, SR.ST, -SR.WK, SR.HY - SR.FD] }, { box: [SR.WK, SR.ST, SR.HX - SR.LD, SR.HY - SR.FD] }, { box: [-SR.HX, -SR.HY, SR.HX, -11.4] }]
    },
    room_wok_hold: {
      bounds: [-WH.HX, WH.HX, -WH.HY, WH.HY + .2], spawn: [0, WH.HT - 3.6, Math.PI], exit: [0, WH.HT + 1.4], ceil: WH.H - .2,
      hemi: { i: .26, c: [.9, .74, .52], g: [.12, .08, .05] },
      lights: [{ p: [0, 4.2, WH.HT], c: [.9, .95, 1], i: .7, r: 10 }, ...[-9, -2, 5].map(z => ({ p: [0, 3.8, z], c: [1, .72, .4], i: .55, r: 8, flicker: .2 })), { p: [0, 1, -11.4], c: [1, .8, .4], i: .4, r: 5 }],
      walk: [{ box: [-3.4, -5, 3.4, WH.HY] }, { box: [-2.6, -9.6, 2.6, -2.4] }, { box: [-1.8, -12.6, 1.8, -6.8] }],
      parts: [-9, -2, 5].map((z, k) => ({ type: 'room_wok_lantern', p: [0, WH.H - .35, z], anim: { swing: [.14, 3.6 + k * .4], sway: [.08, 4.4 + k * .3] } })),
      blockers: [{ box: [-3.6, 1.4, -1.8, 9.4] }, { box: [1.9, -4.4, 3.6, 6.4] }, { circle: [0, -11.6, 1] }]
    },
    room_wok_trade: {
      bounds: [-WT.HX, WT.HX, -WT.HY, WT.HY + .2], spawn: [0, WT.HY - 4.6, Math.PI], exit: [0, WT.HY + .3], ceil: WT.H,
      hemi: { i: .5, c: [1, .88, .7], g: [.24, .16, .1] },
      lights: [{ p: [0, 6, 4], c: [1, .86, .62], i: .65, r: 16 }, { p: [0, 5, -6], c: [1, .84, .6], i: .55, r: 14 }, { p: [-10, 3, 5], c: [1, .76, .48], i: .4, r: 8 }, { p: [10, 4, 0], c: [1, .86, .7], i: .4, r: 10 }, { p: [0, 3.5, WT.HY - 1.4], c: [.92, .94, 1], i: .35, r: 8 }],
      blockers: [{ box: [-WT.HX, WT.CY - .6, WT.GX[0], WT.CY + .6] }, { box: [WT.GX[1], WT.CY - .6, WT.HX, WT.CY + .6] }, { box: [-WT.HX, 2.6, -11, 9] }, { box: [-12.6, -WT.HY, -3.4, -8.4] }, { box: [-1.8, -6.8, 3.6, -4.2] }, { box: [11.2, -8, WT.HX, 8] }]
    },
    room_wok_shed: {
      bounds: [-WS.HX, WS.HX, -WS.HY, WS.HY + .2], spawn: [0, WS.HY - 4.6, Math.PI], exit: [0, WS.HY + .3], ceil: WS.H,
      hemi: { i: .55, c: [.86, .92, 1], g: [.2, .2, .2] },
      lights: [{ p: [0, 6, -9], c: [.9, .96, 1], i: .85, r: 20 }, { p: [-9, 5, 3], c: [1, .84, .6], i: .45, r: 10 }, { p: [9, 5, 3], c: [1, .84, .6], i: .45, r: 10 }, { p: [0, 8, 2], c: [1, .9, .74], i: .4, r: 14 }, { p: [0, 3.5, WS.HY - 1.4], c: [.92, .94, 1], i: .35, r: 8 }],
      flows: [{ mat: 'water_flow', u: .04 }],
      blockers: [{ box: [-WS.PX, -WS.HY, WS.PX, WS.PY] }, { box: [-2.9, WS.PY, 2.9, 4.1] }, { box: [2.9, -5.8, 4.3, 4.2] }, { box: [-12.8, -.2, -8.2, 5] }, { box: [7.2, -.6, 12.8, 3.6] }, { box: [-WS.HX, -6.4, -WS.HX + 1, 6.4] }, { box: [-13.6, -4.4, -11.2, -1.6] }]
    },
    room_wok_dojo: {
      bounds: [-WD.HX, WD.HX, -WD.HY, WD.HY + .2], spawn: [0, WD.HY - 4.6, Math.PI], exit: [0, WD.HY + .3], ceil: WD.H,
      hemi: { i: .45, c: [.8, .9, 1], g: [.14, .16, .2] },
      lights: [{ p: [0, WD.WZ, -WD.HY + 1.5], c: [.85, .94, 1], i: .9, r: 18 }, { p: [0, 7, 0], c: [1, .88, .68], i: .5, r: 20 }, { p: [-12, 4, 6], c: [1, .82, .58], i: .4, r: 12 }, { p: [12, 4, 6], c: [1, .82, .58], i: .4, r: 12 }, { p: [0, 3.5, WD.HY - 1.5], c: [.92, .94, 1], i: .4, r: 10 }],
      decks: WDP.map(([x, z, y]) => ({ circle: [x, z, 1.15], y, under: true })),
      walk: [{ box: [-WD.HX, WD.PL[3], WD.HX, WD.HY + .2] }, { box: [-WD.HX, -WD.HY, WD.HX, WD.PL[1]] }, { box: [-WD.HX, WD.PL[1] - 1.8, WD.PL[0], WD.PL[3] + 1.8] }, { box: [WD.PL[2], WD.PL[1] - 1.8, WD.HX, WD.PL[3] + 1.8] }, ...WDP.map(([x, z]) => ({ circle: [x, z, 1.95] })), ...[WDP[0], WDP[WDP.length - 1]].map(([x, z], k) => ({ box: [x - 2, k ? z - 1.8 : z - .6, x + 2, k ? z + .6 : z + 1.8] }))], // the end posts step off onto the floor (pool side .6 m only)
      parts: [[-11, -6], [11, -6], [-11, 0], [11, 0], [-11, 6], [11, 6]].map(([x, z], k) => ({ type: 'room_wok_chain', p: [x, WD.H - .45, z], anim: { sway: [.06, 4 + k * .4], swing: [.04, 5 + k * .3] } })),
      flows: [{ mat: 'water_flow', u: .015, v: .01 }],
      blockers: [{ box: [-WD.HX, -12, -WD.HX + .9, 6] }, { box: [WD.HX - .9, -12, WD.HX, 6] }, ...[[-11, -6], [11, -6], [-11, 0], [11, 0], [-11, 6], [11, 6]].map(([x, z]) => ({ circle: [x, z, .5] }))]
    },
    room_war_armory: {
      bounds: [-XA.HX, XA.HX, -XA.HY, XA.HY + .2], spawn: [0, XA.HY - 4.6, Math.PI], exit: [0, XA.HY + .3], ceil: XA.H,
      hemi: { i: .45, c: [1, .84, .66], g: [.24, .14, .08] },
      lights: [{ p: [-10.6, 2.5, -8.6], c: [1, .55, .22], i: 1.1, r: 12, flicker: .3 }, { p: [0, 7, 0], c: [1, .86, .66], i: .55, r: 18 }, { p: [9, 4, -4], c: [1, .8, .55], i: .4, r: 10 }, { p: [0, 5, -9], c: [1, .82, .6], i: .45, r: 10 }, { p: [0, 3.5, XA.HY - 1.4], c: [.92, .94, 1], i: .35, r: 8 }],
      parts: [{ type: 'room_war_grindwheel', p: [8.4, 1.25, -5], anim: { spinX: 2.4 } }],
      blockers: [{ box: [-XA.HX, -9, -XA.HX + 1.2, 9] }, { box: [XA.HX - 1.2, -9, XA.HX, 9] }, { box: [-12.8, -XA.HY, -8.4, -6.4] }, { box: [7, -6.2, 9.8, -3.8] }, { box: [-4.9, -2.3, -1.1, .7] }, { box: [1.1, -2.3, 4.9, .7] }, { box: [-1.2, -XA.HY, 1.2, -9.6] }, ...[-6, 6].map(x => ({ box: [x - 1, -XA.HY, x + 1, -9.6] }))]
    },
    room_war_dojo: {
      bounds: [-XD.HX, XD.HX, -XD.HY, XD.HY + .2], spawn: [0, XD.HY - 4.6, Math.PI, XD.N * XD.ST], exit: [0, XD.HY + .3], ceil: XD.H,
      hemi: { i: .42, c: [1, .86, .64], g: [.22, .16, .1] },
      lights: [...[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => ({ p: [a * 6.7, 3.8, b * 6.7], c: [1, .6, .26], i: .55, r: 12, flicker: .25 })), { p: [0, 8.5, 0], c: [1, .9, .72], i: .7, r: 16 }],
      decks: xdTiers().flatMap(t => t.boxes.map(box => ({ box, y: t.y }))),
      parts: [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b], k) => ({ type: 'room_war_bag', p: [a * 15, XD.H - .3, b * 9], anim: { swing: [.05, 3 + k * .3], sway: [.04, 3.6 + k * .2] } })),
      blockers: [...[[-1, -1], [1, -1], [-1, 1], [1, 1]].flatMap(([a, b]) => [{ circle: [a * 15, b * 9, .7], minY: 1.6 }, { circle: [a * 15.6, b * 15.6, 1.6], minY: 1.6 }, { circle: [a * 6.7, b * 6.7, .35] }]), { box: [-XD.HX, -6, -XD.HX + .9, 6], minY: 1.6 }, { box: [XD.HX - .9, -6, XD.HX, 6], minY: 1.6 }]
    },
    room_war_stores: {
      bounds: [-XS.HX, XS.HX, -XS.HY, XS.HY], spawn: [0, 1, Math.PI], exit: [0, 5], ceil: XS.H, // the exit fires at the foot of the stair (it is solid)
      hemi: { i: .36, c: [1, .86, .64], g: [.18, .12, .08] },
      lights: [{ p: [0, 7.5, 9.5], c: [.92, .96, 1], i: .65, r: 12 }, ...[-7.5, 0, 7.5].map(x => ({ p: [x, 6.2, -5], c: [1, .76, .44], i: .45, r: 10, flicker: .15 })), { p: [9.6, 3, 6.4], c: [1, .8, .5], i: .5, r: 8 }],
      blockers: [...[-10, -5, 0, 5, 10].map(x => ({ box: [x - 1.1, -11.2, x + 1.1, -.6] })), { box: [7.4, 4.8, 11.8, 8.2] }, { box: [-12.6, 8.4, -7.4, XS.HY] }, { box: [-XS.SX - .3, 3, XS.SX + .3, XS.HY] }]
    },
    room_war_veterans: {
      bounds: [-XV.HX, XV.HX, -XV.HY, XV.HY + .2], spawn: [0, XV.HY - 4.6, Math.PI], exit: [0, XV.HY + .3], ceil: XV.H,
      hemi: { i: .32, c: [1, .82, .6], g: [.16, .1, .06] },
      lights: [{ p: [0, 2.2, 0], c: [1, .56, .22], i: 1.3, r: 14, flicker: .35 }, { p: [0, 8, -4], c: [1, .86, .66], i: .4, r: 18 }, { p: [-10, 4, 0], c: [1, .8, .55], i: .3, r: 10 }, { p: [0, 4.5, -9.5], c: [1, .9, .74], i: .45, r: 8 }, { p: [0, 3.5, XV.HY - 1.4], c: [.92, .94, 1], i: .35, r: 8 }],
      blockers: [{ circle: [0, 0, XV.FR + .5] }, ...Array.from({ length: 8 }, (_, k) => { const a = k / 8 * Math.PI * 2 + .2; return { circle: [Math.cos(a) * 4.6, Math.sin(a) * 4.6, .55] }; }), { box: [XV.HX - 1, -8, XV.HX, 8] }, { box: [-8.4, -XV.HY, -3.6, -10.6] }, { box: [3.6, -XV.HY, 8.4, -10.6] }]
    },
    room_cc_manor: {
      bounds: [-CM.HX, CM.HX, -CM.HY, CM.HY + .2], spawn: [0, CM.HY - 4.6, Math.PI], exit: [0, CM.HY + .3], ceil: CM.H,
      hemi: { i: .34, c: [.82, .7, 1], g: [.16, .1, .2] },
      lights: [{ p: [0, 8.5, -1], c: [1, .82, .5], i: .9, r: 18, flicker: .12 }, { p: [0, 10, -13.5], c: [.7, .45, 1], i: .7, r: 16 }, { p: [-11, 3, 6], c: [1, .76, .45], i: .4, r: 10, flicker: .2 }, { p: [11, 3, 6], c: [1, .76, .45], i: .4, r: 10, flicker: .2 }, { p: [0, 2.5, -12.8], c: [1, .55, .2], i: .7, r: 9, flicker: .3 }],
      decks: [{ box: [-CM.HX, -CM.HY, CM.HX, CM.GY], y: CM.GH, under: true }, ...[-1, 1].map(sd => ({ box: [sd < 0 ? -CM.SX[1] : CM.SX[0], CM.ST[1], sd < 0 ? -CM.SX[0] : CM.SX[1], CM.ST[0]], y0: 0, y1: CM.GH, axis: 'z', steps: 20, flip: true }))],
      parts: [{ type: 'room_cc_chandelier', p: [0, CM.H - .25, -1], anim: { spin: .06 } }, { type: 'room_cc_ghost', p: [-6, CM.GH + .4, -12.6], anim: { bob: [.3, 3.4] } }, { type: 'room_cc_ghost', p: [7.5, .9, 4], anim: { bob: [.25, 2.8], spin: .3 } }],
      blockers: [{ box: [-CM.SX[0], CM.GY - .1, CM.SX[0], CM.GY + .16], minY: 5.5 }, ...[-1, 1].map(sd => ({ box: [sd * CM.SX[0] - .16, CM.ST[1], sd * CM.SX[0] + .16, CM.ST[0]], minY: .3, maxY: 6.8 })), { box: [-3, -CM.HY, 3, -13.6], maxY: 1 }, { circle: [7.5, 4, .7], maxY: 1 }, ...[-9, -3, 3, 9].map(x => ({ circle: [x, CM.GY + .3, .55], maxY: CM.GH - 1 }))]
    },
    room_cc_crypt: {
      bounds: [-CK.HX, CK.HX, -CK.HY, CK.HY + .2], spawn: [0, CK.LY + 1.2, Math.PI, CK.LH], exit: [0, CK.HY + .3], ceil: CK.H,
      hemi: { i: .22, c: [.6, .9, .7], g: [.06, .1, .08] },
      lights: [...[[-5.6, 6], [5.6, -6], [-5.6, -6], [5.6, 6]].map(([x, z]) => ({ p: [x, 1.6, z], c: [.4, 1, .5], i: .5, r: 8, flicker: .25 })), { p: [0, 3, -12.6], c: [.6, 1, .7], i: .8, r: 9, flicker: .15 }, { p: [0, 3.4, CK.HY - 2], c: [.9, .94, 1], i: .3, r: 7 }],
      decks: [{ box: [-CK.HX, CK.LY, CK.HX, CK.HY + .2], y: CK.LH }, { box: [-1.8, CK.SY, 1.8, CK.LY], y0: 0, y1: CK.LH, axis: 'z', steps: 7 }, { box: [-3.2, -CK.HY, 3.2, -10.6], y: .45 }],
      blockers: [{ box: [-CK.HX, CK.LY - .15, -1.9, CK.LY + .1], minY: 1.2 }, { box: [1.9, CK.LY - .15, CK.HX, CK.LY + .1], minY: 1.2 }, { box: [-1.7, -14.3, 1.7, -11.3], minY: .3 }, ...[-1, 1].flatMap(sd => [-8.4, -3.6, 1.2].map(y => ({ box: [sd * 5 - 1, y - 1.7, sd * 5 + 1, y + 1.7] })))]
    },
    room_cc_witch: {
      bounds: [-CW.HX, CW.HX, -CW.HY, CW.HY + .2], spawn: [0, CW.HY - 4.6, Math.PI], exit: [0, CW.HY + .3], ceil: CW.H,
      hemi: { i: .32, c: [.82, .72, 1], g: [.14, .1, .16] },
      lights: [{ p: [0, 1.8, -3.6], c: [.45, 1, .4], i: .8, r: 7, flicker: .3 }, { p: [0, 1.2, -5.2], c: [1, .55, .2], i: .6, r: 6, flicker: .35 }, { p: [5, 3, 2], c: [.7, .55, 1], i: .4, r: 7 }, { p: [-4, 3.2, 1], c: [1, .8, .55], i: .35, r: 7 }],
      parts: [{ type: 'room_cc_bubbles', p: [0, 1.5, -3.6], anim: { bob: [.06, 1.2] } }, ...[[-3, 2], [2.6, 3], [4, -3.4]].map(([x, z], k) => ({ type: 'room_cc_bat', p: [x, CW.H - .3, z], ry: k * 1.3, anim: { sway: [.18, 2.4 + k * .5] } }))],
      blockers: [{ box: [-2.6, -CW.HY, 2.6, -4.6] }, { circle: [0, -3.6, 1.1] }, { box: [-CW.HX, -4.2, -6, 3.2] }, { box: [3.2, -3.6, 6.4, -.4] }, { circle: [-3.6, -4.4, .7] }, { box: [CW.HX - .8, -5.6, CW.HX, -4.2] }]
    },
    room_cc_game: {
      bounds: [-CG.HX, CG.HX, -CG.HY, CG.HY + .2], spawn: [0, CG.HY - 4.6, Math.PI], exit: [0, CG.HY + .3], ceil: CG.H,
      hemi: { i: .38, c: [.9, .72, 1], g: [.18, .1, .16] },
      lights: [{ p: [0, 7, 0], c: [1, .62, .3], i: .6, r: 18 }, { p: [-10, 3, -8.4], c: [.6, .7, 1], i: .6, r: 8, flicker: .2 }, { p: [11.3, 4, -4], c: [1, .55, .2], i: .5, r: 12 }, { p: [-4, 4, -2], c: [.86, .6, 1], i: .5, r: 10 }, { p: [5, 3.5, -9], c: [1, .6, .9], i: .45, r: 8 }],
      parts: [{ type: 'room_cc_crystal', p: [-10, 1.75, -8.6], anim: { bob: [.06, 2.2], spin: .5 } }, { type: 'room_cc_claw', p: [5, 3.1, -9.1], anim: { bob: [.35, 4.2], sway: [.05, 3] } }],
      blockers: [{ box: [-6.8, -4, -1.2, 0] }, { box: [CG.LX[0] - .2, -CG.HY, CG.HX, 6.2] }, { circle: [-10, -8.4, 2.9] }, { box: [3.8, -10.4, 6.2, -7.8] }, ...[[-12.6, 9], [-12.6, 0], [6.6, 9]].map(([x, z]) => ({ circle: [x, z, .4] }))]
    },
    room_chz_lounge: {
      bounds: [-ZB.HX, ZB.HX, -ZB.HY, ZB.HY + .2], spawn: [0, ZB.HY - 4.6, Math.PI], exit: [0, ZB.HY + .3], ceil: ZB.H,
      hemi: { i: .45, c: [.8, 1, .96], g: [.2, .18, .1] },
      lights: [{ p: [-1.5, 3.4, -9], c: [.3, .9, 1], i: .7, r: 10 }, { p: [0, 5.6, 2], c: [1, .5, .9], i: .55, r: 12 }, { p: [-9, 3.4, 4], c: [1, .76, .4], i: .45, r: 10, flicker: .2 }, { p: [9, 3.4, 4], c: [1, .76, .4], i: .45, r: 10, flicker: .2 }, { p: [12, 2.4, 2], c: [1, .4, .8], i: .4, r: 6 }],
      parts: [{ type: 'room_chz_mirrorball', p: [0, ZB.H - .3, 2], anim: { spin: .5 } }, ...[[-6, 2.6, 'a'], [-2.4, 3.6, 'b'], [1.6, 2.2, 'a'], [3.6, 3.4, 'b']].map(([x, y, t], k) => ({ type: 'room_chz_fish_' + t, p: [x, y, -9.4], anim: { bob: [.25, 3 + k * .7], sway: [.15, 2.2 + k * .4] } }))],
      blockers: [{ box: [-9.2, -6.8, 6.2, -5.2] }, { box: [11, 1, ZB.HX, 3] }, ...[[-9.5, 2], [-9.5, 6.4], [-5.8, 7.6]].map(([x, z]) => ({ circle: [x, z, 1.4] })), ...[[-12.3, -9.3], [12.3, -9.3], [-12.3, 9.3], [12.3, 9.3]].map(([x, z]) => ({ circle: [x, z, .45] })), { circle: [9, 7.6, .8] }, { circle: [11.6, -6.4, .8] }]
    },
    room_chz_casino: {
      bounds: [-ZC.HX, ZC.HX, -ZC.HY, ZC.HY + .2], spawn: [0, ZC.HY - 4.6, Math.PI], exit: [0, ZC.HY + .3], ceil: ZC.H,
      hemi: { i: .45, c: [1, .92, .7], g: [.16, .2, .1] },
      lights: [{ p: [0, 6, -9.5], c: [1, .86, .4], i: .8, r: 12 }, ...[[-6.5, -2.6], [6.5, -2.6], [0, 3]].map(([x, z]) => ({ p: [x, 4.4, z], c: [1, .9, .64], i: .45, r: 9 })), { p: [-11, 3, 0], c: [1, .5, .8], i: .4, r: 8 }],
      parts: [{ type: 'room_chz_wheel', p: [0, ZC.WZ, -ZC.HY + .55], anim: { spinZ: .45 } }],
      blockers: [...[[-6.5, -2.6], [6.5, -2.6], [0, 3]].map(([x, z]) => ({ box: [x - 2.6, z - 1.6, x + 2.6, z + 1.6] })), ...[[-9.5, -6], [9.5, -6], [-9.5, 5.4], [9.5, 5.4]].map(([x, z]) => ({ circle: [x, z, .7] })), { box: [-ZC.HX, -7.4, -11.6, 7.4] }, { box: [8, 5.6, ZC.HX, 9.6] }, { box: [-4, -ZC.HY, 4, -10] }]
    },
    room_chz_bait: {
      bounds: [-ZT.HX, ZT.HX, -ZT.HY, ZT.HY + .2], spawn: [0, ZT.HY - 4.6, Math.PI], exit: [0, ZT.HY + .3], ceil: ZT.H,
      hemi: { i: .45, c: [.86, .96, 1], g: [.16, .2, .22] },
      lights: [{ p: [-2, 1.6, -5], c: [.4, 1, .6], i: .6, r: 6 }, { p: [0, 4.4, 0], c: [.94, .98, 1], i: .6, r: 10 }, { p: [4.4, 2.4, -5], c: [.6, .85, 1], i: .4, r: 5 }, { p: [3.6, 2.4, 2], c: [1, .86, .6], i: .35, r: 6 }],
      blockers: [{ box: [-ZT.HX, -4.2, -6.1, 4.2] }, { box: [-5.6, -ZT.HY, 1.6, -4.7] }, { box: [2.1, -2.4, 5.1, .3] }, { box: [ZT.HX - .7, -5, ZT.HX, 4] }, { box: [3.4, -ZT.HY, 5.6, -5.6] }]
    },
    room_chz_cabin: {
      bounds: [-ZS.HX, ZS.HX, -ZS.HY, ZS.HY + .2], spawn: [0, ZS.HY - 4.6, Math.PI], exit: [0, ZS.HY + .3], ceil: ZS.H - .1,
      hemi: { i: .5, c: [.8, 1, 1], g: [.24, .2, .14] },
      lights: [{ p: [0, 2.6, -4.6], c: [.6, 1, 1], i: .9, r: 9 }, { p: [0, 3.6, .4], c: [1, .8, .5], i: .5, r: 7, flicker: .2 }, { p: [-4, 2, 3], c: [1, .86, .6], i: .3, r: 5 }],
      parts: [{ type: 'room_wok_lantern', p: [0, ZS.H - .15, .4], anim: { swing: [.12, 3.8], sway: [.06, 4.6] } }],
      walk: [{ box: [-5.2, -4.2, 5.2, ZS.HY + .2] }],
      blockers: [{ box: [-1.7, -3.5, 1.7, -1.3] }, { box: [-ZS.HX, .8, -2.2, 4.2] }, { box: [3.4, 2, ZS.HX, 3.8] }, { circle: [4.6, -3, .7] }]
    },
    room_sl_hq: {
      bounds: [-QH.HX, QH.HX, -QH.HY, QH.HY + .2], spawn: [0, QH.HY - 4.6, Math.PI], exit: [0, QH.HY + .3], ceil: QH.H,
      hemi: { i: .55, c: [1, .9, .86], g: [.24, .2, .22] },
      lights: [{ p: [0, 5, -12], c: [1, .62, .42], i: 1, r: 22 }, { p: [0, 6.2, -4], c: [1, .86, .5], i: .55, r: 10 }, { p: [-10, 5, 5], c: [.94, .96, 1], i: .45, r: 14 }, { p: [10, 5, 5], c: [.94, .96, 1], i: .45, r: 14 }, { p: [0, 4, QH.HY - 1.5], c: [.92, .94, 1], i: .35, r: 9 }],
      blockers: [{ box: [-5.2, -6.4, 5.2, -1.6] }, { box: [-14.6, 3.4, -6.2, 8.6] }, { box: [7.2, 8.4, QH.HX, 12.4] }, ...[[-15.6, -11.6], [15.6, -11.6], [-15.8, 11.6]].map(([x, z]) => ({ circle: [x, z, .8] }))]
    },
    room_sl_arena: {
      bounds: [-QA.HX, QA.HX, -QA.HY, QA.HY + .2], spawn: [0, QA.HY - 4.6, Math.PI], exit: [0, QA.HY + .3], ceil: QA.H,
      hemi: { i: .45, c: [.94, .88, 1], g: [.24, .18, .26] },
      lights: [{ p: [0, 12, 0], c: [1, .96, .9], i: 1, r: 26 }, { p: [-9, 10, 0], c: [.92, .9, 1], i: .5, r: 16 }, { p: [9, 10, 0], c: [.92, .9, 1], i: .5, r: 16 }, { p: [0, 5, -12], c: [.8, .6, 1], i: .4, r: 14 }, { p: [0, 4, QA.HY - 2], c: [1, .9, .6], i: .4, r: 12 }],
      decks: qaTiers().map(t => ({ box: [-15, t.b, 15, t.a], y: t.y })),
      blockers: [{ circle: [-QA.CX - 1.2, 0, .9] }, { circle: [QA.CX + 1.2, 0, .9] }, ...[-6, 6].map(x => ({ box: [x - 2.4, 8.8, x + 2.4, 9.8] }))]
    },
    room_sl_garage: {
      bounds: [-QG.HX, QG.HX, -QG.HY, QG.HY + .2], spawn: [0, QG.HY - 4.6, Math.PI], exit: [0, QG.HY + .3], ceil: QG.H,
      hemi: { i: .5, c: [.94, .96, 1], g: [.2, .2, .22] },
      lights: [{ p: [-4, 6.5, -2], c: [.94, .98, 1], i: .7, r: 14 }, { p: [8, 4, -6.4], c: [1, .96, .9], i: .7, r: 8 }, { p: [4, 6, 4], c: [.94, .98, 1], i: .45, r: 12 }, { p: [0, 5.6, -9.4], c: [1, .3, .7], i: .5, r: 8 }, { p: [-11, 3, 4], c: [1, .86, .7], i: .3, r: 8 }],
      blockers: [{ box: [-8.4, -4.2, .4, .2] }, { box: [4.6, -QG.HY, QG.HX, -3.2] }, { box: [-QG.HX, -6, -12, 4] }, { box: [-6, -QG.HY, 2, -8.6] }, ...[[-10.6, 6.6], [-11.6, 5], [-9.4, 4.6]].map(([x, z]) => ({ circle: [x, z, .7] })), ...[[11, 7.6], [11.8, 6.2]].map(([x, z]) => ({ circle: [x, z, .55] }))]
    },
    room_sl_library: {
      bounds: [-QL.R, QL.R, -QL.R, QL.R + .4], spawn: [0, QL.R - 4.6, Math.PI], exit: [0, QL.R + .3], ceil: QL.WH + QL.DOME - 1.2,
      hemi: { i: .5, c: [1, .94, .82], g: [.24, .2, .16] },
      lights: [{ p: [0, 5, 0], c: [1, .9, .7], i: .8, r: 14 }, ...[0, 2, 4].map(k => { const a = k * Math.PI / 3; return { p: [Math.cos(a) * 6.5, 2.6, Math.sin(a) * 6.5], c: [.6, 1, .6], i: .35, r: 6 }; }), { p: [0, 9.5, 0], c: [.9, .9, 1], i: .4, r: 16 }],
      walk: [{ circle: [0, 0, QL.R - 1.1] }, { box: [-QL.DW / 2, QL.R - 3, QL.DW / 2, QL.R + .45] }],
      blockers: [{ circle: [0, 0, 3] }, ...[0, 1, 2, 3, 4, 5].map(k => { const a = k * Math.PI / 3; return { circle: [Math.cos(a) * 6.8, Math.sin(a) * 6.8, 1.5] }; }), ...[-1, 1].map(s => ({ box: [s * 7.2 - 1.2, 7.6, s * 7.2 + 1.2, 9.4] }))]
    },
    room_sl_game: {
      bounds: [-QB.HX, QB.HX, -QB.HY, QB.HY + .2], spawn: [2, QB.HY - 4.6, Math.PI], exit: [0, QB.HY + .3], ceil: QB.H,
      hemi: { i: .36, c: [.7, .96, 1], g: [.2, .12, .1] },
      lights: [{ p: [-9.5, 5.5, -4], c: [.4, 1, .95], i: .6, r: 16 }, { p: [7, 5, -.5], c: [1, .7, .4], i: .55, r: 12 }, { p: [10, 3.4, -9], c: [1, .5, .2], i: .55, r: 9 }, { p: [-9.5, 2, -10.5], c: [1, .96, .9], i: .5, r: 7 }, { p: [0, 4, QB.HY - 1.5], c: [.92, .94, 1], i: .35, r: 8 }],
      parts: [{ type: 'room_sl_discoball', p: [5, QB.H - .5, -2], anim: { spin: .6 } }, ...[-1, 1].map(s => ({ type: 'room_sl_record', p: [10 + s * .8, 1.26, -9.6], anim: { spin: 3.4 } }))],
      blockers: [{ box: [QB.LN[0] - .4, -QB.HY, QB.LN[1] + .2, QB.LY[1]] }, ...[-4, 3].map(z => ({ box: [5.2, z - 1.6, 8.8, z + 1.6] })), { box: [7.2, -QB.HY, 13.6, -8.4] }, ...[QB.LN[0] + 1.3, QB.LN[0] + 4, QB.LN[0] + 6.6, QB.LN[0] + 9.2].map(x => ({ circle: [x, QB.LY[1] + 1, .5] }))]
    }
  };
  // ── room furniture (kit coordinates: z up, the hall's entrance wall is +y) ──
  function yoroi(M, x, y, z) { // a samurai armour on its box stand, facing the hall (+y)
    M.block('lacquer_black', x, y, z, 1.7, 1.3, .36); M.block('gold', x, y + .66, z + .1, .9, .03, .14);
    M.cyl('lacquer_black', [x, y, z + .36], .09, 1.2, 8);
    for (let k = 0; k < 4; k++) { const z0 = z + .52 + k * .22, r0 = .8 - k * .06; M.cyl('lacquer_red', [x, y, z0], r0, .24, 16, r0 - .05); M.cyl('lacing', [x, y, z0], r0 + .015, .035, 16); }
    M.cyl('lacquer_red', [x, y, z + 1.38], .56, .9, 16, .63);
    for (let k = 0; k < 4; k++) M.cyl('lacing', [x, y, z + 1.45 + k * .2], .575 + k * .016, .035, 16);
    M.box('lacquer_black', [x, y + .52, z + 2.2], [.86, .16, .3]);
    for (const s of [-1, 1]) {
      M.box('lacquer_red', [x + s * .84, y, z + 1.85], [.13, .7, .92], 0, 0, s * .2);
      for (let k = 0; k < 3; k++) M.box('lacing', [x + s * (.82 + k * .045 * -1 + .06), y, z + 1.55 + k * .28], [.15, .72, .035], 0, 0, s * .2);
      M.box('lacquer_black', [x + s * .45, y, z + 2.3], [.32, .8, .12]);
      M.rod('iron', [x + s * .66, y + .05, z + 2.2], [x + s * .78, y + .15, z + 1.3], .12, 6); M.cyl('gold', [x + s * .78, y + .15, z + 1.22], .14, .1, 8);
    }
    M.cyl('lacquer_black', [x, y, z + 2.28], .3, .18, 12);
    for (let k = 0; k < 3; k++) { const r0 = .52 + k * .08; M.cyl('lacquer_red', [x, y - .04, z + 2.7 - k * .13], r0, .13, 16, r0 - .06); M.cyl('lacing', [x, y - .04, z + 2.7 - k * .13], r0 + .01, .03, 16); }
    M.sphere('iron', [x, y, z + 2.86], .44, .82, 14, 7);
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; M.rod('lacing', [x + Math.cos(a) * .05, y + Math.sin(a) * .05, z + 3.22], [x + Math.cos(a) * .44, y + Math.sin(a) * .44, z + 2.88], .018, 4); }
    M.box('lacquer_red', [x, y + .34, z + 2.5], [.44, .2, .32]); M.box('dark', [x, y + .45, z + 2.44], [.26, .03, .05]);
    for (const s of [-1, 1]) { M.box('lacquer_black', [x + s * .45, y + .3, z + 2.78], [.08, .22, .26], 0, 0, s * .3); M.rod('gold', [x + s * .09, y + .44, z + 3.0], [x + s * .5, y + .52, z + 3.62], .035, 5); }
    M.rod('gold', [x, y + .4, z + 3.05], [x, y + .47, z + 3.05], .17, 12);
  }
  function katanakake(M, x, y, z, w = 2.8) { // sword stand: three swords, hilts to the left as seen from the hall
    M.block('lacquer_black', x, y, z, w, .6, .14);
    for (const s of [-1, 1]) { M.block('lacquer_black', x + s * (w / 2 - .22), y, z + .14, .16, .44, 1.12); for (let k = 0; k < 3; k++) M.block('gold', x + s * (w / 2 - .22), y + .1, z + .44 + k * .3, .2, .26, .05); }
    for (let k = 0; k < 3; k++) {
      const zz = z + .52 + k * .3, L = w + .3 - k * .5, x1 = x + L / 2, x0 = x1 - L, yy = y + .14;
      M.rod('dark', [x0, yy, zz], [x0 + .62, yy, zz + .01], .055, 6); M.rod('gold', [x0, yy, zz], [x0 + .04, yy, zz], .06, 6);
      M.rod('gold', [x0 + .62, yy, zz], [x0 + .67, yy, zz], .12, 12);
      M.rod('lacquer_black', [x0 + .67, yy, zz + .01], [x1, yy, zz + .07], .06, 6); M.rod('gold', [x1 - .06, yy, zz + .065], [x1, yy, zz + .07], .062, 6);
    }
  }
  function andon(M, x, y, z, s = 1.4) { // floor lamp: paper box on a black frame
    for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) M.block('lacquer_black', x + dx * .3 * s, y + dy * .3 * s, z, .06 * s, .06 * s, 1.5 * s);
    M.block('andon', x, y, z + .5 * s, .56 * s, .56 * s, .88 * s); M.block('lacquer_black', x, y, z + 1.42 * s, .72 * s, .72 * s, .06 * s); M.block('lacquer_black', x, y, z + .44 * s, .68 * s, .68 * s, .06 * s);
  }
  function bonsai(M, x, y, z) {
    M.cyl('lacquer_black', [x, y, z], .5, .34, 12, .6); M.cyl('earth', [x, y, z + .33], .52, .03, 12);
    M.rod('bark', [x, y, z + .3], [x + .18, y, z + .95], .1, 6); M.rod('bark', [x + .18, y, z + .95], [x - .22, y + .05, z + 1.45], .08, 6); M.rod('bark', [x + .1, y, z + .8], [x + .5, y - .05, z + 1.1], .05, 5);
    for (const [dx, dy, dz, r] of [[-.32, .02, 1.55, .44], [.52, -.04, 1.18, .34], [-.04, -.08, 1.86, .3], [.1, .12, 1.4, .3]]) M.sphere('leaf', [x + dx, y + dy, z + dz], r, .55, 10, 5);
  }
  function taiko(M, x, y, z) { // a big drum on its stand, skins facing +-y
    const R = 1.05, L = 1.5, zc = z + 1.8;
    for (const s of [-1, 1]) { M.block('darkwood', x + s * 1.15, y, z, .3, 2, .25); for (const t of [-1, 1]) M.rod('darkwood', [x + s * 1.15, y + t * .8, z + .2], [x + s * 1.02, y + t * .25, zc - .2], .09, 6); M.block('darkwood', x + s * 1.02, y, zc - .3, .22, .7, .2); }
    M.tube('lacquer_red', [x, y - L / 2, zc], [x, y, zc], .95, 1.1, 18, false); M.tube('lacquer_red', [x, y, zc], [x, y + L / 2, zc], 1.1, .95, 18, false);
    for (const t of [-1, 1]) {
      M.rod('drum_skin', [x, y + t * (L / 2 - .02), zc], [x, y + t * (L / 2 + .015), zc], .97, 18);
      for (let k = 0; k < 18; k++) { const a = k / 18 * Math.PI * 2; M.box('gold', [x + Math.cos(a) * .92, y + t * (L / 2 - .05), zc + Math.sin(a) * .92], [.07, .07, .07]); }
      M.rod('lacquer_black', [x + .25 * t, y - .9, zc + 1.12], [x + .25 * t + .1, y + .9, zc + 1.1], .045, 6);
    }
    M.rod('gold', [x - .2, y, zc + 1.1], [x + .2, y, zc + 1.1], .02, 4);
    M.cyl('gold', [x, y, zc + 1.03], .12, .1, 8);
  }
  function chochin(M, x, y, ztop, cord, r = .46, h = 1.1) { // hanging paper lantern
    const zb = ztop - cord; M.rod('rope', [x, y, ztop], [x, y, zb], .025, 4);
    M.cyl('lacquer_black', [x, y, zb - .12], r * .62, .12, 12);
    M.tube('lantern', [x, y, zb - .12 - h / 2], [x, y, zb - .12], r, r * .66, 14, false); M.tube('lantern', [x, y, zb - .12 - h], [x, y, zb - .12 - h / 2], r * .66, r, 14, false);
    for (const f of [.25, .5, .75]) M.cyl('dark', [x, y, zb - .12 - h * f], r * (1 - .34 * Math.abs(f - .5) * 2) + .006, .025, 14);
    M.cyl('lacquer_black', [x, y, zb - .24 - h], r * .62, .12, 12);
  }
  function makiwara(M, x, y) { M.block('stone', x, y, 0, .9, .9, .25); M.block('wood', x, y, .25, .34, .34, 2.6); M.cyl('straw', [x, y, 1.45], .3, .78, 10); for (const zz of [1.5, 1.82, 2.12]) M.cyl('rope', [x, y, zz], .315, .05, 10); }
  function cabinet(M, x0, y0, f, g, body, neon) { // an arcade cabinet against a side wall: f = +1 left wall (faces +x), -1 right wall
    const W = 1.5, D = 1.4, P = (a, b, z) => [x0 + f * b, y0 + f * a, z], Q = (a, b, z) => P(a, b, z);
    M.box('lacquer_black', P(0, D / 2 - .05, .15), [D - .1, W - .06, .3]); M.box(body, P(0, D / 2, 1.65), [D, W, 2.7]); M.box('lacquer_black', P(0, D / 2, 3.15), [D, W + .04, .3]);
    M.quad('mq_' + g, [Q(-W / 2 + .04, D + .006, 3.02), Q(W / 2 - .04, D + .006, 3.02), Q(W / 2 - .04, D + .006, 3.28), Q(-W / 2 + .04, D + .006, 3.28)]);
    M.quad('dark', [Q(-.66, D + .004, 1.72), Q(.66, D + .004, 1.72), Q(.66, D + .004, 2.84), Q(-.66, D + .004, 2.84)]);
    M.quad('scr_' + g, [Q(-.58, D + .008, 1.8), Q(.58, D + .008, 1.8), Q(.58, D + .008, 2.76), Q(-.58, D + .008, 2.76)]);
    M.box('lacquer_black', P(0, D + .2, 1.44), [.46, W - .1, .14], 0, 0, f * .3);
    M.rod('lacquer_black', P(-.36, D + .22, 1.5), P(-.36, D + .24, 1.68), .03, 6); M.sphere(neon, P(-.36, D + .24, 1.72), .07, 1, 8, 4);
    for (let k = 0; k < 3; k++) M.cyl(['neon_cyan', 'neon_gold', 'neon_pink'][k], P(.02 + k * .15, D + .2, 1.5), .045, .05, 8);
    for (const t of [-1, 1]) M.box(neon, P(t * (W / 2 + .01), D - .02, 1.65), [.05, .05, 2.7]);
    M.box('gold', P(0, D + .006, .75), [.02, .36, .44]); for (const t of [-1, 1]) M.box('neon_gold', P(t * .08, D + .02, .86), [.01, .04, .12]);
  }
  function bookcase(M, side, yc, w, h, X) { // floor-to-cornice shelves against a side wall (x = side * X), books facing the hall
    const d = .95, xm = side * (X - d / 2), xb = side * (X - .1), y0 = yc - w / 2 + .2, y1 = yc + w / 2 - .2, A = side < 0 ? [y0, y1] : [y1, y0];
    M.block('darkwood', xm, yc, 0, d, w, .32); M.block('darkwood', side * (X - d / 2 - .05), yc, h, d + .2, w + .3, .32);
    for (const t of [-1, 1]) M.block('darkwood', xm, yc + t * (w / 2 - .1), 0, d, .2, h);
    const rows = 6, rh = (h - .5) / rows;
    for (let r = 0; r < rows; r++) {
      const z0 = .38 + r * rh, v0 = (r % 5) * .2;
      M.block('darkwood', xm, yc, z0 - .07, d - .02, w - .3, .07);
      M.quad('books_dim', [[xb, A[0], z0], [xb, A[1], z0], [xb, A[1], z0 + rh - .1], [xb, A[0], z0 + rh - .1]], [[0, v0], [(w - .4) / 1.5, v0], [(w - .4) / 1.5, v0 + .2], [0, v0 + .2]]);
    }
  }
  function wallQuad(M, side, yc, z0, w, h, mat, X) { // a sign or picture on a side wall (x = side * X), reads the right way round from inside
    const x = side * (X - .06), y0 = yc - w / 2, y1 = yc + w / 2, A = side < 0 ? [y0, y1] : [y1, y0];
    M.quad(mat, [[x, A[0], z0], [x, A[1], z0], [x, A[1], z0 + h], [x, A[0], z0 + h]]);
  }
  function kakejiku(M, side, y, zTop, w, h, mat) { // hanging scroll on a side wall (x = side * HX), reads the right way round from the hall
    const x = side * (SD.HX - .05), y0 = y - w / 2, y1 = y + w / 2, A = side < 0 ? [y0, y1] : [y1, y0];
    M.quad(mat, [[x, A[0], zTop - h], [x, A[1], zTop - h], [x, A[1], zTop], [x, A[0], zTop]]);
    M.rod('darkwood', [x - side * .04, y0 - .14, zTop - h], [x - side * .04, y1 + .14, zTop - h], .065, 8); M.rod('darkwood', [x - side * .03, y0 - .04, zTop], [x - side * .03, y1 + .04, zTop], .04, 6);
    M.rod('rope', [x - side * .02, y0 + .1, zTop], [x - side * .02, y, zTop + .5], .015, 4); M.rod('rope', [x - side * .02, y1 - .1, zTop], [x - side * .02, y, zTop + .5], .015, 4);
  }
  // ── shared room pieces (kit coordinates: z up, the door in the front wall, +y) ──
  // a rectangular hall: floor slab, side + back walls (wainscot, rail, posts, top beam), the front wall with its doorway (a
  // short reveal and the daylight view), the ceiling and its beams. o: { HX, HY, H, T, DW, DH, floor, wall, wain, wainH, rail,
  // post, posts: [y, ..] (side walls) | postEvery, beam, ceil, ceilBeam, ceilEvery, doorFrame, noCeil, noFloor, leftOpen / rightOpen: [y0, y1, z0, z1] }
  function hall(M, o) {
    const { HX, HY, H } = o, T = o.T ?? .4, DW = o.DW ?? 6, DH = o.DH ?? 5.6, WH = o.wainH ?? 2.4, PE = o.postEvery || 4, DX = o.DX || 0;
    if (!o.noFloor) M.block(o.floor || 'wood', 0, 0, -.3, 2 * HX + 2 * T, 2 * HY + 2 * T + 2.6, .3);
    const ys = o.posts || (o.post ? Array.from({ length: Math.floor(2 * HY / PE + 1e-6) + 1 }, (_, k) => -HY + k * PE) : []);
    for (const s of [-1, 1]) {
      const op = s < 0 ? o.leftOpen : o.rightOpen, xw = s * (HX + T / 2), L = HY + T; // an opening in a side wall [y0, y1, z0, z1]
      if (op) { const [a, b, c, d] = op; M.block(o.wall, xw, (-L + a) / 2, 0, T, a + L, H + .4); M.block(o.wall, xw, (b + L) / 2, 0, T, L - b, H + .4); if (c > 0) M.block(o.wall, xw, (a + b) / 2, 0, T, b - a, c); M.block(o.wall, xw, (a + b) / 2, d, T, b - a, H + .4 - d); }
      else M.block(o.wall, xw, 0, 0, T, 2 * HY + 2 * T, H + .4);
      if (o.wain) M.block(o.wain, s * (HX - .06), 0, 0, .12, 2 * HY, WH);
      if (o.rail) M.block(o.rail, s * (HX - .12), 0, WH, .24, 2 * HY, .16);
      for (const y of ys) M.block(o.post, s * (HX - .14), y, 0, .28, .42, H);
      if (o.beam) M.block(o.beam, s * (HX - .16), 0, H - .34, .32, 2 * HY, .34);
    }
    if (o.backOpen) { // an opening in the back wall [x0, x1, z0, z1] (a window onto something behind it)
      const [a, b, c, d] = o.backOpen, yb = -HY - T / 2;
      M.block(o.wall, (-HX - T + a) / 2, yb, 0, a + HX + T, T, H + .4); M.block(o.wall, (b + HX + T) / 2, yb, 0, HX + T - b, T, H + .4);
      M.block(o.wall, (a + b) / 2, yb, 0, b - a, T, c); M.block(o.wall, (a + b) / 2, yb, d, b - a, T, H + .4 - d);
    } else M.block(o.wall, 0, -HY - T / 2, 0, 2 * HX + 2 * T, T, H + .4);
    if (o.wain) M.block(o.wain, 0, -HY + .06, 0, 2 * HX, .12, WH);
    if (o.rail) M.block(o.rail, 0, -HY + .12, WH, 2 * HX, .24, .16);
    if (o.beam) M.block(o.beam, 0, -HY + .16, H - .34, 2 * HX, .32, .34);
    const yf = HY + T / 2;
    M.block(o.wall, 0, yf, DH, 2 * HX + 2 * T, T, H + .4 - DH);
    for (const [a, b] of [[-HX - T, DX - DW / 2], [DX + DW / 2, HX + T]]) {
      if (b - a < .01) continue;
      M.block(o.wall, (a + b) / 2, yf, 0, b - a, T, DH);
      const ai = Math.max(a, -HX), bi = Math.min(b, HX);
      if (o.wain) M.block(o.wain, (ai + bi) / 2, HY - .06, 0, bi - ai, .12, WH);
      if (o.rail) M.block(o.rail, (ai + bi) / 2, HY - .12, WH, bi - ai, .24, .16);
    }
    if (o.beam) M.block(o.beam, 0, HY - .16, H - .34, 2 * HX, .32, .34);
    const fr = o.doorFrame || 'darkwood';
    for (const s of [-1, 1]) M.block(fr, DX + s * (DW / 2 + .1), HY + .75, 0, .2, 1.5, DH);
    M.block(fr, DX, HY + .75, DH, DW + .4, 1.5, .2);
    M.quad('doorview', [[DX - DW / 2, HY + 1.45, 0], [DX + DW / 2, HY + 1.45, 0], [DX + DW / 2, HY + 1.45, DH], [DX - DW / 2, HY + 1.45, DH]]);
    if (o.noCeil) return;
    M.block(o.ceil || o.wall, 0, 0, H, 2 * HX + 2 * T, 2 * HY + 2 * T, .25);
    if (o.ceilBeam) for (let y = -HY + (o.ceilEvery || 4); y < HY - .1; y += o.ceilEvery || 4) M.block(o.ceilBeam, 0, y, H - .45, 2 * HX, .4, .45);
  }
  // a picture / sign / banner flat on a wall, reading the right way round from inside: wall 'left' (x = -HX), 'right' (x = HX),
  // 'back' (y = -HY), 'front' (y = HY); u = centre along the wall, z0 = bottom
  function wallArt(M, wall, u, z0, w, h, mat, HX, HY, inset = .06, uv) {
    const x = HX - inset, y = HY - inset, a = u - w / 2, b = u + w / 2, z1 = z0 + h;
    M.quad(mat, wall === 'left' ? [[-x, a, z0], [-x, b, z0], [-x, b, z1], [-x, a, z1]] : wall === 'right' ? [[x, b, z0], [x, a, z0], [x, a, z1], [x, b, z1]]
      : wall === 'back' ? [[b, -y, z0], [a, -y, z0], [a, -y, z1], [b, -y, z1]] : [[a, y, z0], [b, y, z0], [b, y, z1], [a, y, z1]], uv);
  }
  // n solid treads from base up to base + rise over y0..y1 (x0..x1), rising toward +y (dir 1) or -y (dir -1); the room deck
  // { box: [x0, y0, x1, y1], y0: base, y1: base + rise, axis: 'z', steps: n, flip: dir < 0 } walks on the same treads
  function stairsK(M, mat, x0, x1, y0, y1, base, rise, n, dir = 1, nose) {
    const run = (y1 - y0) / n;
    for (let k = 0; k < n; k++) {
      const yc = dir > 0 ? y0 + (k + .5) * run : y1 - (k + .5) * run, top = base + rise * (k + 1) / n;
      M.block(mat, (x0 + x1) / 2, yc, base, x1 - x0, run, top - base);
      if (nose) M.block(nose, (x0 + x1) / 2, yc - dir * (run / 2 - .03), top - .03, x1 - x0, .06, .05);
    }
  }
  // an upright ant warrior in stone on its plinth, facing +y (the hall), a spear in its right hands
  function antStatue(M, x, y, z, s, mat) {
    M.block('stone_dark', x, y, z, 2.6 * s, 2.6 * s, .9 * s); M.block(mat, x, y, z + .9 * s, 2.3 * s, 2.3 * s, .2 * s);
    const b = z + 1.1 * s, P = (dx, dy, dz) => [x + dx * s, y + dy * s, b + dz * s];
    for (const t of [-1, 1]) { M.rod(mat, P(t * .35, 0, 2.2), P(t * .5, .1, 1.1), .2 * s, 8); M.rod(mat, P(t * .5, .1, 1.1), P(t * .45, -.05, 0), .16 * s, 8); M.sphere(mat, P(t * .45, .12, .08), .22 * s, .5, 8, 4); }
    M.sphere(mat, P(0, -.75, 2.6), .85 * s, 1.15, 12, 7);
    M.sphere(mat, P(0, 0, 3.15), .5 * s, 1.5, 12, 7); M.sphere(mat, P(0, .08, 2.35), .42 * s, 1, 10, 6);
    M.sphere(mat, P(0, .25, 4.25), .48 * s, 1.1, 12, 7);
    for (const t of [-1, 1]) {
      M.rod(mat, P(t * .22, .25, 4.6), P(t * .55, .55, 5.4), .05 * s, 6); M.rod(mat, P(t * .55, .55, 5.4), P(t * .75, .95, 5.6), .04 * s, 6);
      M.rod(mat, P(t * .14, .62, 4.05), P(t * .05, .82, 3.92), .06 * s, 6);
      M.rod(mat, P(t * .45, 0, 3.6), P(t * .85, .35, 3), .13 * s, 8); M.rod(mat, P(t * .85, .35, 3), P(t * .6, .6, 2.7), .11 * s, 8);
      M.rod(mat, P(t * .42, 0, 3.05), P(t * .75, .1, 2.5), .11 * s, 8);
    }
    M.rod('darkwood', P(.62, .62, .1), P(.62, .62, 6.2), .07 * s, 6); M.cyl('iron', P(.62, .62, 6.2), .12 * s, .7 * s, 6, .01);
  }
  function lanternS(M, x, y, ztop, mat, r = .3, h = .62) { // a small festival lantern on a short cord
    const zb = ztop - .18;
    M.rod('rope', [x, y, ztop], [x, y, zb], .02, 4); M.cyl('lacquer_black', [x, y, zb - .06], r * .6, .06, 8);
    M.tube(mat, [x, y, zb - .06 - h / 2], [x, y, zb - .06], r, r * .62, 10, false); M.tube(mat, [x, y, zb - .06 - h], [x, y, zb - .06 - h / 2], r * .62, r, 10, false);
    M.cyl('lacquer_black', [x, y, zb - .12 - h], r * .6, .06, 8);
  }
  Object.assign(B, {
    // the Samurai Great Dojo's hall: a plank floor round a tatami training square, two rows of columns carrying a raised nave
    // (shoji clerestory, coffered ceiling), shoji windows high on the side walls, the dais (kamiza) with the great Samurai
    // banner in its alcove, two armours, the sword stand, lamps and bonsai; weapon racks, makiwara posts, scrolls, a taiko by
    // the door; the doorway looks out into daylight. NFT frames and hotspots come from the room's config (village layout).
    // the Hub's Rebel Library (rebuilt from Miguel's room): a book-lined hall. The Warning plays on the screen at the far end
    // between red curtains, the Book lies on a lit lectern in the middle (book GLB + hotspot from the room config), reading
    // tables with lamps, a map table, scroll racks by the door, paper lanterns; NFT frames between the bookcases.
    room_hub_library(M) {
      M.room = true;
      const { HX, HY, H, DW, DH, SHELF } = LB, T = .4;
      M.block('wood', 0, 0, -.3, 2 * HX + 2 * T, 2 * HY + 2 * T + 2.6, .3);
      M.quad('runner', [[-1.6, -18.5, .012], [1.6, -18.5, .012], [1.6, HY, .012], [-1.6, HY, .012]], [[0, 0], [1, 0], [1, (HY + 18.5) / 6.4], [0, (HY + 18.5) / 6.4]]);
      for (const s of [-1, 1]) {
        M.block('plaster', s * (HX + T / 2), 0, 0, T, 2 * HY + 2 * T, H + .4);
        M.block('darkwood', s * (HX - .06), 0, 0, .12, 2 * HY, 1.6); M.block('wood', s * (HX - .12), 0, 1.6, .24, 2 * HY, .16);
        for (let k = 0; k <= 10; k++) M.block('wood', s * (HX - .14), -HY + k * 4.4, 0, .28, .42, H);
        M.block('wood', s * (HX - .16), 0, 7.4, .32, 2 * HY, .34); M.block('wood', s * (HX - .16), 0, H - .34, .32, 2 * HY, .34);
        for (const y of SHELF) bookcase(M, s, y, 4.1, 7.2, HX);
        for (let k = 0; k < 10; k++) { const y0 = -HY + k * 4.4 + .3, y1 = y0 + 3.8, x = s * (HX - .04), q = s < 0 ? [y0, y1] : [y1, y0]; M.quad('shoji', [[x, q[0], 7.9], [x, q[1], 7.9], [x, q[1], 10.2], [x, q[0], 10.2]], [[0, 0], [3.8 / 1.2, 0], [3.8 / 1.2, 1.5], [0, 1.5]]); }
      }
      // the far wall: the screen's carved frame, gold trim, red curtains, a low stage, benches facing it
      M.block('plaster', 0, -HY - T / 2, 0, 2 * HX + 2 * T, T, H + .4); M.block('darkwood', 0, -HY + .06, 0, 2 * HX, .12, 1.6); M.block('wood', 0, -HY + .12, 1.6, 2 * HX, .24, .16);
      M.block('darkwood', 0, -HY + .7, 0, 12, 1.4, .4); M.block('gold', 0, -HY + 1.38, .34, 12, .04, .06);
      M.quad('dark', [[4.2, -HY + .05, 2.8], [-4.2, -HY + .05, 2.8], [-4.2, -HY + .05, 7.6], [4.2, -HY + .05, 7.6]]);
      for (const [cx, cz, w, h] of [[0, 2.6, 9.2, .4], [0, 7.8, 9.2, .4], [-4.45, 5.2, .5, 5.6], [4.45, 5.2, .5, 5.6]]) M.box('darkwood', [cx, -HY + .2, cz], [w, .35, h]);
      for (const [cx, cz, w, h] of [[0, 2.83, 8.5, .06], [0, 7.57, 8.5, .06], [-4.22, 5.2, .06, 4.8], [4.22, 5.2, .06, 4.8]]) M.box('gold', [cx, -HY + .38, cz], [w, .04, h]);
      M.box('darkwood', [0, -HY + .3, 8.6], [10.4, .6, .5]); M.box('gold', [0, -HY + .62, 8.6], [1.6, .04, .3]);
      for (const s of [-1, 1]) for (let k = 0; k < 5; k++) M.box('cloth', [s * (5.1 + k * .32), -HY + .55 + (k % 2) * .12, 4.6], [.3, .14, 8.2]);
      for (const s of [-1, 1]) { M.block('darkwood', s * 4.5, -15, .1, 5.2, 1.1, .45); M.block('cloth', s * 4.5, -15, .55, 5.1, 1, .12); for (const t of [-1, 1]) M.block('darkwood', s * 4.5 + t * 2.3, -15, 0, .3, .9, .12); }
      // the front wall: the door, plaster, scroll racks either side
      const yf = HY + T / 2;
      M.block('plaster', 0, yf, DH, 2 * HX + 2 * T, T, H + .4 - DH);
      for (const s of [-1, 1]) { M.block('plaster', s * ((HX + T + DW / 2) / 2), yf, 0, HX + T - DW / 2, T, DH); M.block('darkwood', s * ((HX + DW / 2) / 2), HY - .06, 0, HX - DW / 2, .12, 1.6); M.block('wood', s * (DW / 2 + .22), HY - .06, 0, .44, .44, DH); }
      M.block('darkwood', 0, HY - .06, DH, 2 * HX, .44, .32); M.block('wood', 0, HY - .16, 7.4, 2 * HX, .32, .34); M.block('wood', 0, HY - .16, H - .34, 2 * HX, .32, .34);
      for (const s of [-1, 1]) M.block('darkwood', s * (DW / 2 + .1), HY + .75, 0, .2, 1.5, DH);
      M.block('darkwood', 0, HY + .75, DH, DW + .4, 1.5, .2);
      M.quad('doorview', [[-DW / 2, HY + 1.45, 0], [DW / 2, HY + 1.45, 0], [DW / 2, HY + 1.45, DH], [-DW / 2, HY + 1.45, DH]]);
      for (const s of [-1, 1]) {
        const cx = s * 13.8; M.block('darkwood', cx, HY - .7, 0, 5.2, 1.3, .25); M.block('darkwood', cx, HY - .7, 3.4, 5.4, 1.4, .2);
        for (let i = 0; i <= 4; i++) M.block('darkwood', cx - 2.5 + i * 1.25, HY - .7, .25, .1, 1.3, 3.15);
        for (let r = 0; r < 3; r++) { M.block('darkwood', cx, HY - .7, 1.2 + r * 1.05, 5.2, 1.3, .06); for (let i = 0; i < 4; i++) for (let k = 0; k < 3; k++) { const x = cx - 2.15 + i * 1.25 + k * .3, z = .5 + r * 1.05; M.rod('plaster', [x, HY - 1.3, z], [x, HY - .1, z], .12, 8); M.rod('red', [x, HY - .75, z], [x, HY - .65, z], .125, 8); } }
      }
      // the Book's lectern on its round dais, reading tables with lamps and cushions, the map table
      M.cyl('darkwood', [0, 0, 0], 2.6, .35, 32); M.cyl('gold', [0, 0, .33], 2.62, .04, 32); M.cyl('wood', [0, 0, .35], 2.45, .03, 32);
      M.block('darkwood', 0, 0, .38, .5, .5, 1.15); M.box('darkwood', [0, 0, 1.62], [1.3, 1, .14], 0, -.32, 0); M.box('gold', [0, -.5, 1.47], [1.3, .04, .04], 0, -.32, 0);
      for (const [x, y] of [[-10.5, 9], [10.5, 9], [-10.5, 14], [10.5, 14]]) {
        M.block('darkwood', x, y, .55, 3, 1.6, .12); for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) M.block('darkwood', x + a * 1.35, y + b * .65, 0, .14, .14, .55);
        for (const t of [-1, 1]) M.block('cloth', x, y + t * 1.35, 0, 1.2, .9, .16);
        andon(M, x + 1, y, .67, .55); M.block('plaster', x - .6, y, .67, .7, .5, .08); M.block('books_dim', x - .3, y + .2, .67, .5, .35, .18);
      }
      const mx = -6.5, my = -3; M.block('darkwood', mx, my, 0, 4, 2.4, .9); M.block('darkwood', mx, my, .9, 4.2, 2.6, .08); M.quad('map_table', [[mx - 1.9, my - 1.1, .99], [mx + 1.9, my - 1.1, .99], [mx + 1.9, my + 1.1, .99], [mx - 1.9, my + 1.1, .99]]);
      M.cyl('bronze', [mx + 1.4, my + .6, .98], .12, .05, 8); M.rod('red', [mx - 1.2, my - .6, .99], [mx - .3, my - .2, .99], .03, 4);
      // ceiling: beams, coffers, paper lanterns
      M.block('wood', 0, 0, H, 2 * HX + 2 * T, 2 * HY + 2 * T, .25);
      for (let i = 0; i <= 8; i++) M.block('darkwood', -HX + i * (2 * HX / 8), 0, H - .3, .25, 2 * HY, .3);
      for (let j = 0; j <= 10; j++) M.block('darkwood', 0, -HY + j * 4.4, H - .45, 2 * HX, .4, .45);
      M.remap = { lantern: 'andon' }; for (const [x, y] of [[-9, -8], [9, -8], [-9, 2], [9, 2], [-9, 12], [9, 12], [0, -9], [0, 15]]) chochin(M, x, y, H - .45, 1.6, .55, 1.25); M.remap = null;
    },
    // the Hub's Rebel Arcade (rebuilt from Miguel's room): a dojo at night lit by neon. Four games, four cabinets each
    // (hotspots from the room config), a neon sign over each row, the big screen in a red torii on a stage, the Rebel Ants
    // emblem inlaid in a glowing ring, a prize counter and a claw machine by the door, violet and cyan lanterns.
    room_hub_arcade(M) {
      M.room = true;
      const { HX, HY, H, DW, DH, CABS, COLS } = AR, T = .4;
      M.block('arcade_floor', 0, 0, -.3, 2 * HX + 2 * T, 2 * HY + 2 * T + 2.6, .3);
      for (const [x0, y0, x1, y1] of [[-13, -14, 13, -13.86], [-13, 13.86, 13, 14], [-13, -14, -12.86, 14], [12.86, -14, 13, 14]]) M.quad('neon_cyan', [[x0, y0, .012], [x1, y0, .012], [x1, y1, .012], [x0, y1, .012]]);
      M.cyl('neon_pink', [0, 0, 0], 6.35, .02, 48); M.cyl('lacquer_black', [0, 0, 0], 6.08, .03, 48); M.cyl('neon_purple', [0, 0, 0], 4.62, .036, 40); M.cyl('lacquer_black', [0, 0, 0], 4.5, .04, 40);
      M.quad('emblem_rebel', [[4.3, 4.3, .045], [-4.3, 4.3, .045], [-4.3, -4.3, .045], [4.3, -4.3, .045]]);
      // walls: dark indigo plaster over a black wainscot with a cyan rail, posts, a pink strip under the ceiling
      for (const s of [-1, 1]) {
        M.block('arcade_wall', s * (HX + T / 2), 0, 0, T, 2 * HY + 2 * T, H + .4);
        M.block('lacquer_black', s * (HX - .06), 0, 0, .12, 2 * HY, 2.4); M.block('neon_cyan', s * (HX - .14), 0, 2.4, .06, 2 * HY, .07);
        for (let k = 0; k <= 10; k++) M.block('darkwood', s * (HX - .14), -HY + k * 4, 0, .28, .4, H);
        M.block('neon_pink', s * (HX - .2), 0, H - .55, .06, 2 * HY, .07);
        for (const [i, g] of [[0, s < 0 ? 'raid' : 'tunnel'], [1, s < 0 ? 'fw' : 'shuffle']]) {
          const neon = { fw: 'neon_pink', raid: 'neon_purple', tunnel: 'neon_cyan', shuffle: 'neon_gold' }[g], body = { fw: 'paint_red', raid: 'paint_purple', tunnel: 'paint_blue', shuffle: 'paint_gold' }[g];
          for (const y of CABS.slice(i * 4, i * 4 + 4)) cabinet(M, s * HX, y, -s, g, body, neon);
          wallQuad(M, s, i ? 9 : -9, 6.6, 9, 1.69, 'sign_' + g, HX);
        }
      }
      // back wall: the stage, the big screen's black backing and its red torii, neon trim; front wall: the door, the emblem over it
      M.block('arcade_wall', 0, -HY - T / 2, 0, 2 * HX + 2 * T, T, H + .4); M.block('lacquer_black', 0, -HY + .06, 0, 2 * HX, .12, 2.4); M.block('neon_cyan', 0, -HY + .14, 2.4, 2 * HX, .06, .07);
      M.block('lacquer_black', 0, -HY + 1.4, 0, 17.2, 2.8, .6); M.block('neon_pink', 0, -HY + 2.82, .52, 17.2, .05, .06);
      M.quad('dark', [[7, -HY + .03, 2.4], [-7, -HY + .03, 2.4], [-7, -HY + .03, 10.4], [7, -HY + .03, 10.4]]);
      for (const [x0, z0, x1, z1] of [[-6.85, 2.55, 6.85, 2.65], [-6.85, 10.15, 6.85, 10.25], [-6.85, 2.55, -6.75, 10.25], [6.75, 2.55, 6.85, 10.25]]) M.box('neon_pink', [(x0 + x1) / 2, -HY + .1, (z0 + z1) / 2], [x1 - x0, .06, z1 - z0]);
      for (const s of [-1, 1]) { M.cyl('lacquer_red', [s * 7.7, -HY + 1.2, .6], .45, H - 1.4, 14); M.cyl('lacquer_black', [s * 7.7, -HY + 1.2, .6], .58, .4, 14); M.cyl('neon_cyan', [s * 7.7, -HY + 1.2, 1.05], .47, .06, 14); }
      M.box('lacquer_red', [0, -HY + 1.2, 10.75], [16.6, .55, .5]); M.box('lacquer_black', [0, -HY + 1.2, 11.35], [18.4, .9, .5]); M.box('gold', [0, -HY + 1.68, 10.75], [2, .05, .42]);
      for (const s of [-1, 1]) M.box('gold', [s * 9.15, -HY + 1.2, 11.35], [.12, .92, .52]);
      const yf = HY + T / 2;
      M.block('arcade_wall', 0, yf, DH, 2 * HX + 2 * T, T, H + .4 - DH);
      for (const s of [-1, 1]) { M.block('arcade_wall', s * ((HX + T + DW / 2) / 2), yf, 0, HX + T - DW / 2, T, DH); M.block('lacquer_black', s * ((HX + DW / 2) / 2), HY - .06, 0, HX - DW / 2, .12, 2.4); M.block('neon_cyan', s * ((HX + DW / 2) / 2), HY - .14, 2.4, HX - DW / 2, .06, .07); M.block('lacquer_red', s * (DW / 2 + .25), HY - .1, 0, .5, .5, DH + .3); }
      M.block('lacquer_red', 0, HY - .1, DH, DW + 1, .5, .4); M.block('neon_pink', 0, HY - .38, DH - .06, DW, .05, .06);
      for (const s of [-1, 1]) M.block('lacquer_black', s * (DW / 2 + .1), HY + .75, 0, .2, 1.5, DH);
      M.block('lacquer_black', 0, HY + .75, DH, DW + .4, 1.5, .2);
      M.quad('doorview', [[-DW / 2, HY + 1.45, 0], [DW / 2, HY + 1.45, 0], [DW / 2, HY + 1.45, DH], [-DW / 2, HY + 1.45, DH]]);
      M.cyl('neon_gold', [0, HY - .1, 9.3], 2.35, .06, 40); M.quad('emblem_rebel', [[-2.2, HY - .12, 7.1], [2.2, HY - .12, 7.1], [2.2, HY - .12, 11.5], [-2.2, HY - .12, 11.5]]);
      // columns, beams with purple neon underneath, the ceiling
      for (const s of [-1, 1]) for (const y of COLS) { M.cyl('stone', [s * 15.5, y, 0], .7, .3, 12); M.cyl('lacquer_red', [s * 15.5, y, .3], .45, H - .3, 14); for (const zz of [.42, H - .9]) M.cyl('neon_cyan', [s * 15.5, y, zz], .47, .06, 14); }
      M.block('lacquer_black', 0, 0, H, 2 * HX + 2 * T, 2 * HY + 2 * T, .3);
      for (const x of [-15.5, 0, 15.5]) { M.block('darkwood', x, 0, H - .8, .6, 2 * HY, .8); M.block('neon_purple', x, 0, H - .84, .1, 2 * HY, .05); }
      for (const y of COLS) { M.block('darkwood', 0, y, H - .7, 2 * HX, .5, .7); M.block('neon_purple', 0, y, H - .74, 2 * HX, .08, .05); }
      M.remap = { lantern: 'lantern_violet' }; for (const s of [-1, 1]) for (const y of [-8, 0, 8]) chochin(M, s * 18.5, y, H - .8, 2.4, .5, 1.2);
      M.remap = { lantern: 'lantern_cyan' }; for (const [x, y] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) chochin(M, x, y, H - .8, 2.2, .55, 1.3);
      M.remap = null;
      // benches facing the screen, the prize counter and the claw machine by the door
      for (const s of [-1, 1]) { M.block('lacquer_black', s * 4.5, -11.5, .1, 5, 1.1, .45); M.block('cloth_purple', s * 4.5, -11.5, .55, 4.9, 1, .12); M.block('neon_purple', s * 4.5, -11.5, .04, 4.6, .9, .05); for (const t of [-1, 1]) M.block('lacquer_black', s * 4.5 + t * 2.2, -11.5, 0, .3, .9, .12); }
      M.block('lacquer_black', 15, 15, 0, 6.6, 1.2, 1.4); M.block('gold', 15, 15, 1.4, 6.8, 1.35, .08); M.block('neon_gold', 15, 14.38, .1, 6.6, .04, .05);
      for (let i = 0; i < 2; i++) M.block('darkwood', 15, HY - .45, 2.2 + i * 1.6, 6.4, .7, .1);
      for (let i = 0; i < 2; i++) for (let k = 0; k < 7; k++) M.sphere(['flower_pink', 'neon_cyan', 'banana', 'neon_purple', 'red', 'neon_gold', 'lime'][(k + i * 3) % 7], [12.4 + k * .86, HY - .45, 2.62 + i * 1.6], .32, 1, 8, 5);
      M.quad('sign_prizes', [[12.4, HY - .2, 5.6], [17.6, HY - .2, 5.6], [17.6, HY - .2, 6.9], [12.4, HY - .2, 6.9]]);
      M.block('lacquer_black', -15, 15.2, 0, 2.4, 2.4, 1.2); M.block('neon_cyan', -15, 15.2, 1.2, 2.5, 2.5, .06);
      M.box('glass', [-15, 15.2, 2.35], [2.3, 2.3, 2.2]); for (const [x, y] of [[-1.1, -1.1], [1.1, -1.1], [1.1, 1.1], [-1.1, 1.1]]) M.block('lacquer_black', -15 + x, 15.2 + y, 1.2, .1, .1, 2.3);
      M.block('lacquer_black', -15, 15.2, 3.5, 2.5, 2.5, .3); M.quad('sign_claw', [[-16.2, 13.94, 3.52], [-13.8, 13.94, 3.52], [-13.8, 13.94, 3.78], [-16.2, 13.94, 3.78]]);
      for (let k = 0; k < 9; k++) M.sphere(['flower_pink', 'neon_cyan', 'banana', 'neon_purple', 'red', 'lime'][k % 6], [-15.7 + (k % 3) * .7, 14.5 + Math.floor(k / 3) * .7, 1.5], .3, 1, 8, 5);
      M.rod('iron', [-15, 15.2, 3.45], [-15, 15.2, 2.6], .03, 4); for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2; M.rod('iron', [-15, 15.2, 2.6], [-15 + Math.cos(a) * .25, 15.2 + Math.sin(a) * .25, 2.3], .025, 4); }
    },
    // the Samurai Library: a scholar's hall. Both side walls are honeycombs of scroll cubbies, six low calligraphy desks wait
    // with ink and paper, and the back wall opens in a round moon window onto a small garden with a red maple and a lantern
    room_sam_library(M) {
      M.room = true;
      const { HX, HY, H, DW, DH, WIN, CUB, DESKS } = SL, wz = WIN.z, wr = WIN.r;
      hall(M, { HX, HY, H, DW, DH, floor: 'wood', wall: 'plaster', wain: 'darkwood', wainH: 1, rail: 'wood', post: 'wood', posts: [-HY, -10.1, 10.1, HY], beam: 'darkwood', ceil: 'wood', ceilBeam: 'darkwood', ceilEvery: 2.75, backOpen: [-wr - .1, wr + .1, wz - wr - .1, wz + wr + .1] });
      // the moon window: plaster closing the corners of the square opening round the circle, a dark ring of wood
      const yb = -HY - .2, n = 32;
      for (let k = 0; k < n; k++) {
        const a0 = k / n * 6.2832, a1 = (k + 1) / n * 6.2832, sq = a => { const c = Math.cos(a), s2 = Math.sin(a), m = Math.max(Math.abs(c), Math.abs(s2)); return [c / m * (wr + .1), s2 / m * (wr + .1)]; };
        const [s0x, s0z] = sq(a0), [s1x, s1z] = sq(a1);
        for (const yy of [yb + .2, yb - .2]) M.poly('plaster', [[Math.cos(a0) * wr, yy, wz + Math.sin(a0) * wr], [Math.cos(a1) * wr, yy, wz + Math.sin(a1) * wr], [s1x, yy, wz + s1z], [s0x, yy, wz + s0z]]);
        M.rod('darkwood', [Math.cos(a0) * wr, yb + .22, wz + Math.sin(a0) * wr], [Math.cos(a1) * wr, yb + .22, wz + Math.sin(a1) * wr], .09, 6);
      }
      // the garden behind it: moss and gravel, a red maple, a stone lantern, a basin, the sky above
      const gy0 = -HY - 4.6, gy1 = -HY - .4;
      M.block('earth', 0, (gy0 + gy1) / 2, -.3, 9, gy1 - gy0, .3); M.quad('stone', [[-4.5, gy0, .01], [4.5, gy0, .01], [4.5, gy1, .01], [-4.5, gy1, .01]], [[0, 0], [3, 0], [3, 1.4], [0, 1.4]]); blob(M, 'moss', [-1.2, gy0 + 1.8, 0], 2.2, 1.3, .35, { seed: 2, flat: .2 });
      for (const [x0, w] of [[-4.7, .4], [4.7, .4]]) M.block('plaster', x0, (gy0 + gy1) / 2, 0, w, gy1 - gy0, H); M.block('plaster', 0, gy0 - .2, 0, 9.8, .4, H);
      M.quad('skyhole', [[-4.5, gy0, H], [4.5, gy0, H], [4.5, gy1, H], [-4.5, gy1, H]]);
      curveTube(M, 'bark', [[1.2, gy0 + 2, -.1], [1.4, gy0 + 2.1, 1.6], [.8, gy0 + 2, 3.2], [-.2, gy0 + 2.3, 4.4]], [.24, .2, .14, .08], { segs: 8, n: 4, seed: 7 });
      for (const [dx, dz, rr] of [[-.4, 4.6, 1.5], [1.2, 4, 1.2], [.4, 5.3, 1.1], [-1.4, 3.8, 1], [1.9, 4.9, .9]]) blob(M, dx > 0 ? 'red' : 'flower_orange', [dx, gy0 + 2.1, dz], rr, rr * .8, rr * .6, { seed: dx * 7, amp: .3 });
      M.block('stone', -2.6, gy0 + 1.4, 0, .5, .5, .9); M.block('stone', -2.6, gy0 + 1.4, .9, .9, .9, .5); M.block('window_glow', -2.6, gy0 + 1.4, 1.4, .5, .5, .4); M.block('stone', -2.6, gy0 + 1.4, 1.8, 1.1, 1.1, .25);
      M.cyl('stone', [2.8, gy0 + 1.2, 0], .55, .5, 12); M.cyl('water', [2.8, gy0 + 1.2, .49], .42, .02, 12);
      // the scroll walls: lattices of cubbies, a scroll or three in each
      let sd = 17; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
      const caps = ['red', 'gold', 'kabuki_green', 'plaster', 'lacquer_red'];
      for (const side of [-1, 1]) {
        const xb = side * (HX - .02), xf = side * (HX - CUB.d), xm = (xb + xf) / 2, nc = Math.round((CUB.y1 - CUB.y0) / CUB.cell), z1 = CUB.z0 + CUB.rows * CUB.cell;
        M.quad('dark', side < 0 ? [[xb, CUB.y0, CUB.z0], [xb, CUB.y1, CUB.z0], [xb, CUB.y1, z1], [xb, CUB.y0, z1]] : [[xb, CUB.y1, CUB.z0], [xb, CUB.y0, CUB.z0], [xb, CUB.y0, z1], [xb, CUB.y1, z1]]);
        M.block('darkwood', xm, 0, 0, CUB.d, CUB.y1 - CUB.y0 + .1, CUB.z0); M.block('darkwood', xm, 0, z1, CUB.d + .1, CUB.y1 - CUB.y0 + .2, .14);
        for (let i = 0; i <= nc; i++) M.block('darkwood', xm, CUB.y0 + i * CUB.cell, CUB.z0, CUB.d, .04, z1 - CUB.z0);
        for (let j = 0; j <= CUB.rows; j++) M.block('darkwood', xm, 0, CUB.z0 + j * CUB.cell - .02, CUB.d, CUB.y1 - CUB.y0, .04);
        for (let i = 0; i < nc; i++) for (let j = 0; j < CUB.rows; j++) {
          const yc = CUB.y0 + (i + .5) * CUB.cell, zc = CUB.z0 + j * CUB.cell + .02, nS = 1 + ((r() * 3) | 0);
          for (let q = 0; q < nS; q++) { const rad = .07 + .03 * r(), yy = yc + (q - (nS - 1) / 2) * .17, zz = zc + rad + (q % 2) * .1; M.rod('plaster', [xf, yy, zz], [xb - side * .1, yy, zz], rad, 6); M.rod(caps[(r() * caps.length) | 0], [xf - side * .01, yy, zz], [xf + side * .03, yy, zz], rad + .015, 6); }
        }
      }
      // the desks: ink, brushes, a sheet of practice characters, a cushion to kneel on
      for (const [x, y] of DESKS) {
        M.block('lacquer_black', x, y, .32, 1.9, .8, .06); for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) M.block('lacquer_black', x + a * .85, y + b * .32, 0, .08, .08, .32);
        M.quad('scroll_sam2', [[x - .5, y - .3, .385], [x + .3, y - .3, .385], [x + .3, y + .3, .385], [x - .5, y + .3, .385]], [[0, .3], [1, .3], [1, .7], [0, .7]]);
        M.block('dark', x + .6, y - .1, .38, .26, .38, .04); for (let q = 0; q < 2; q++) M.rod('bark', [x + .5 + q * .1, y + .22, .4], [x + .55 + q * .1, y + .34, .4], .012, 3);
        M.block('cushion', x, y + .85, .015, .8, .7, .1); andon(M, x - 1.25, y + .2, 0, .5);
      }
      // hanging scrolls either side of the moon window and of the door
      for (const sd2 of [-1, 1]) { wallArt(M, 'back', sd2 * 7.2, 1.8, 1.3, 4, sd2 < 0 ? 'scroll_sam' : 'scroll_sam2', HX, HY, .07); wallArt(M, 'front', sd2 * 4.2, 1.6, 1, 3, 'scroll_sam', HX, HY, .07); }
    },
    // the Samurai Forge: the smiths' working hall. The great charcoal hearth glows under its iron hood, the box bellows beside
    // it, two anvils with their hammers, the quench trough, blades on the wall from raw bar to polished edge, steel and charcoal
    room_sam_forge(M) {
      M.room = true;
      const { HX, HY, H, DW, DH, HEARTH, ANV } = SF;
      hall(M, { HX, HY, H, DW, DH, floor: 'earth', wall: 'plaster_old', wain: 'stone', wainH: 1.6, rail: 'darkwood', post: 'darkwood', postEvery: 4, beam: 'darkwood', ceil: 'darkwood', ceilBeam: 'darkwood', ceilEvery: 2.5 });
      const [hx, hy, hw, hd] = HEARTH;
      M.block('stone', hx, hy, 0, hw, hd, .9); M.block('dark', hx, hy, .9, hw - .5, hd - .5, .06);
      let sd = 9; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
      for (let k = 0; k < 26; k++) M.sphere(k % 3 ? 'fire' : 'lantern', [hx + (r() - .5) * (hw - .8), hy + (r() - .5) * (hd - .8), .98], .12 + .1 * r(), .55, 8, 4);
      for (let k = 0; k < 3; k++) flame(M, hx - 1.2 + k * 1.2, hy + (r() - .5) * .5, .95, .55 + .15 * r());
      M.quad('glow_warm', [[hx - 2.6, hy + hd / 2 + .02, .9], [hx + 2.6, hy + hd / 2 + .02, .9], [hx + 2.6, hy + hd / 2 + .02, 3.6], [hx - 2.6, hy + hd / 2 + .02, 3.6]]);
      const z0 = 3.3, z1 = 6.6, w0 = hw / 2 + .4, d0 = hd / 2 + .4, w1 = .8, yc = hy - .3;
      M.quad('iron', [[hx - w0, yc + d0, z0], [hx + w0, yc + d0, z0], [hx + w1, yc + w1, z1], [hx - w1, yc + w1, z1]]);
      for (const t of [-1, 1]) M.quad('iron', [[hx + t * w0, yc + d0, z0], [hx + t * w0, yc - d0, z0], [hx + t * w1, yc - w1, z1], [hx + t * w1, yc + w1, z1]]);
      M.block('iron', hx, yc, z1, 1.6, 1.6, H - z1); M.block('darkwood', hx, yc + d0, z0 - .12, 2 * w0 + .1, .14, .14);
      // the bellows, the anvils and hammers, the quench trough
      M.block('darkwood', -3.6, -8.2, 0, 1.8, .8, .9); M.block('wood', -3.6, -8.2, .9, 1.9, .9, .06); M.rod('darkwood', [-2.6, -8.2, .55], [-1.9, -8.2, .55], .05, 6); M.block('darkwood', -1.85, -8.2, .35, .1, .4, .4);
      for (const [x, y] of ANV) {
        M.cyl('bark', [x, y, 0], .5, .58, 12); M.block('iron', x, y, .58, .5, 1, .3); M.block('iron', x, y, .88, .7, 1.25, .16); M.rod('iron', [x, y + .62, .96], [x, y + 1.05, .96], .1, 8);
        M.rod('bark', [x + .2, y - .2, 1.05], [x + .55, y - .55, 1.05], .03, 5); M.box('iron', [x + .58, y - .58, 1.05], [.14, .14, .26]);
      }
      M.block('darkwood', 5.5, -6.5, 0, 2.6, .9, .7); M.quad('water', [[4.3, -6.85, .66], [6.7, -6.85, .66], [6.7, -6.15, .66], [4.3, -6.15, .66]]);
      // blades on the left wall, raw to finished; tools on the right wall
      const stages = [['iron', 'iron', .09], ['iron', 'iron', .07], ['iron', 'stone_dark', .06], ['stone_dark', 'gold', .055], ['chrome', 'gold', .05], ['chrome', 'gold', .05]];
      M.block('darkwood', -HX + .3, -1, .9, .5, 11, .1); M.block('darkwood', -HX + .3, -1, 2.6, .5, 11, .1);
      stages.forEach(([m1, m2, rad], k) => { const y = -5.6 + k * 1.9, z = 1.25 + (k % 2) * .9; M.rod(m1, [-HX + .4, y - .6, z], [-HX + .4, y + .7, z + .02], rad, 6); if (k > 2) { M.rod('lacquer_black', [-HX + .4, y - .95, z], [-HX + .4, y - .6, z], .045, 6); M.block(m2, -HX + .4, y - .62, z - .05, .1, .06, .1); } });
      for (let k = 0; k < 6; k++) { const y = -4 + k * 1.5; M.rod('iron', [HX - .25, y, 2.8], [HX - .25, y + .05, 1.4], .03, 4); M.rod('iron', [HX - .25, y + .15, 2.8], [HX - .25, y + .3, 1.4], .03, 4); M.box('darkwood', [HX - .2, y + .1, 2.95], [.1, .5, .14]); }
      // steel blocks, charcoal sacks, firewood
      for (let k = 0; k < 7; k++) blob(M, 'iron', [3.4 + (k % 3) * .45, -8.5 + Math.floor(k / 3) * .35, .15 + (k > 2 ? .22 : 0)], .26, .2, .14, { seed: k, amp: .3 });
      for (let k = 0; k < 4; k++) { M.cyl('sack', [8.6 + (k % 2) * 1.1, 5 + Math.floor(k / 2) * 1.2, 0], .48, .9, 10, .4); M.cyl('dark', [8.6 + (k % 2) * 1.1, 5 + Math.floor(k / 2) * 1.2, .9], .38, .04, 10); }
      for (let k = 0; k < 9; k++) M.rod('bark', [9.2 + (k % 3) * .32, 6.8, .18 + Math.floor(k / 3) * .3], [9.2 + (k % 3) * .32, 8.2, .18 + Math.floor(k / 3) * .3], .14, 6);
    },
    // the Samurai Ancestor Hall: an earthen vault under the burrow, ribbed with old timber. Up the far wall a stepped altar holds
    // two hundred gold memorial tablets with candles between them; incense rises from a great censer; the armour of the first
    // Samurai stands in a glass case by the door
    room_sam_ancestors(M) {
      M.room = true;
      const { HX, HY, WALL, VAULT, DW, DH, TIERS } = SA, HT = WALL + VAULT;
      hall(M, { HX, HY, H: WALL, DW, DH, floor: 'stone', wall: 'earth', post: 'darkwood', postEvery: 3, beam: 'darkwood', noCeil: true });
      const N = 14, arc = k => { const a = Math.PI * k / N; return [Math.cos(a) * HX, WALL + Math.sin(a) * VAULT]; };
      for (let k = 0; k < N; k++) { const [x0, z0] = arc(k), [x1, z1] = arc(k + 1); M.quad('earth', [[x0, -HY - .4, z0], [x1, -HY - .4, z1], [x1, HY + .4, z1], [x0, HY + .4, z0]], [[0, 0], [1, 0], [1, 2 * HY / 3], [0, 2 * HY / 3]]); }
      for (const yy of [-HY - .2, HY + .2]) for (let k = 0; k < N; k++) { const [x0, z0] = arc(k), [x1, z1] = arc(k + 1); M.poly('earth', [[0, yy, WALL], [x0, yy, z0], [x1, yy, z1]]); }
      for (let y = -HY + 1.5; y < HY; y += 3) for (let k = 0; k < N; k++) { const [x0, z0] = arc(k), [x1, z1] = arc(k + 1); M.rod('darkwood', [x0 * .985, y, z0 - .05], [x1 * .985, y, z1 - .05], .14, 6); }
      M.quad('runner', [[-1.2, -HY + 3.6, .012], [1.2, -HY + 3.6, .012], [1.2, HY, .012], [-1.2, HY, .012]], [[0, 0], [1, 0], [1, (2 * HY - 3.6) / 6.4], [0, (2 * HY - 3.6) / 6.4]]);
      // the stepped altar and its tablets and candles
      for (let t = 0; t < TIERS; t++) {
        const y0 = -HY + 3.6 - (t + 1) * .65, zt = .5 + t * .55, w = 18 - t * 1.6;
        M.block('lacquer_black', 0, (-HY + y0) / 2 + .02, 0, w, y0 + HY, zt); M.block('gold', 0, y0 + .02, zt - .04, w, .04, .04);
        const nT = 40, x0 = -w / 2 + .3, step = (w - .6) / (nT - 1);
        for (let k = 0; k < nT; k++) {
          const x = x0 + k * step, y = y0 + .3, h = .42 + .06 * Math.sin(k * 1.7 + t);
          M.block('lacquer_black', x, y, zt, .2, .12, .05); M.block('gold', x, y, zt + .05, .15, .05, h); M.cyl('gold', [x, y, zt + .05 + h], .08, .03, 6);
          if (k % 5 === 2) { M.cyl('candle', [x + step / 2, y - .12, zt], .03, .16, 6); M.cyl('fire', [x + step / 2, y - .12, zt + .16], .025, .07, 5, .004); }
        }
      }
      wallArt(M, 'back', 0, 4, 5, 2.2, 'banner_red', HX, HY, .3);
      // the great censer and its smoke
      M.cyl('bronze', [0, 0, 0], .9, .5, 16, .7); M.cyl('bronze', [0, 0, .5], .5, .4, 12); M.cyl('bronze', [0, 0, .9], 1.1, .55, 18, .8); M.cyl('dark', [0, 0, 1.44], .9, .03, 16);
      for (const t of [-1, 1]) M.quad('smoke', [[t * .2 - .3, t * .15, 1.5], [t * .2 + .3, t * .15, 1.5], [t * .4 + .5, t * .15, 4.8], [t * .4 - .5, t * .15, 4.8]]);
      // the first Samurai's armour in its glass case, lanterns along the sides
      yoroi(M, -9.9, 7.1, 0); M.box('glass', [-9.9, 7.1, 1.7], [3.2, 3.2, 3.4]); M.block('lacquer_black', -9.9, 7.1, 3.4, 3.3, 3.3, .1);
      for (const sd2 of [-1, 1]) for (let y = -9; y <= 9; y += 4.5) chochin(M, sd2 * (HX - 1.6), y, WALL + 2.4, 1.2, .32, .7);
    },
    // the Ronin Shadow Dojo (training): a black hall at night. Its floor is lacquered like still water and crossed by bars of
    // moonlight from slits in the roof; crimson paper screens ring the walls, the red handprint fills the far wall, black
    // cloths hang in ranks to train in, shuriken boards on the side walls
    room_ronin_shadow_dojo(M) {
      M.room = true;
      const { HX, HY, H, DW, DH, SLITS, SQ } = RS;
      hall(M, { HX, HY, H, DW, DH, floor: 'mirror_black', wall: 'lacquer_black', wain: 'darkwood', wainH: 1.4, rail: 'lacquer_red', post: 'lacquer_black', postEvery: 3.75, beam: 'darkwood', noCeil: true });
      // the roof between the slits, the night through them, the bars on the floor and the light falling in
      const edges = [-HY - .4, ...SLITS.flatMap(y => [y - .45, y + .45]), HY + .4];
      for (let i = 0; i < edges.length; i += 2) M.block('lacquer_black', 0, (edges[i] + edges[i + 1]) / 2, H, 2 * HX + .8, edges[i + 1] - edges[i], .3);
      for (const y of SLITS) {
        M.quad('moonbar', [[-HX, y - .45, H + .7], [HX, y - .45, H + .7], [HX, y + .45, H + .7], [-HX, y + .45, H + .7]]);
        M.quad('moonfloor', [[-HX + .9, y - .55, .012], [HX - .9, y - .55, .012], [HX - .9, y + .55, .012], [-HX + .9, y + .55, .012]]);
        M.quad('shaft_moon', [[-HX + 1, y, .05], [HX - 1, y, .05], [HX - 1, y, H], [-HX + 1, y, H]]);
        M.block('darkwood', 0, y - .5, H - .5, 2 * HX, .16, .5); M.block('darkwood', 0, y + .5, H - .5, 2 * HX, .16, .5);
      }
      // the sparring square: a crimson border on the black floor
      for (const [x0, y0, x1, y1] of [[-SQ, -SQ - .2, SQ, -SQ], [-SQ, SQ, SQ, SQ + .2], [-SQ - .2, -SQ - .2, -SQ, SQ + .2], [SQ, -SQ - .2, SQ + .2, SQ + .2]]) M.quad('lacquer_red', [[x0, y0, .016], [x1, y0, .016], [x1, y1, .016], [x0, y1, .016]]);
      // crimson screens between the posts, the handprint on the far wall
      for (const sd of [-1, 1]) for (let y = -HY; y < HY - .1; y += 3.75) wallArt(M, sd < 0 ? 'left' : 'right', y + 1.875, 2.2, 3.35, 3.2, 'shoji_red', HX, HY, .05);
      wallArt(M, 'back', 0, .9, 8.4, 7.6, 'emblem_ronin_red', HX, HY, .06);
      for (const sd of [-1, 1]) wallArt(M, 'back', sd * 10.5, 2.2, 3.4, 3.2, 'shoji_red', HX, HY, .05);
      // black cloths hanging in ranks near the back
      for (const [ry, off] of [[-9.6, 0], [-11.8, 1.6]]) for (let k = 0; k < 7; k++) { const x = -12 + off + k * 4; M.quad('cloth_black', [[x - .7, ry, .35], [x + .7, ry, .35], [x + .7, ry, H - .6], [x - .7, ry, H - .6]]); M.rod('darkwood', [x - .9, ry, H - .55], [x + .9, ry, H - .55], .05, 6); }
      // shuriken boards on the side walls, shuriken stuck in them
      for (const sd of [-1, 1]) for (const y of [-5, 5]) {
        const x = sd * (HX - .2); M.rod('straw', [x, y, 3], [x - sd * .3, y, 3], .85, 16); for (const rr of [.3, .58]) M.rod('red', [x - sd * .31, y, 3 + rr], [x - sd * .33, y, 3 + rr], .05, 4);
        for (const [dy, dz] of [[.2, .3], [-.35, -.1], [.1, -.45]]) { const cx = x - sd * .34; M.box('iron', [cx, y + dy, 3 + dz], [.04, .34, .06]); M.box('iron', [cx, y + dy, 3 + dz], [.04, .06, .34]); }
      }
      // blade racks either side of the door
      for (const sd of [-1, 1]) { const x = sd * (HX - .4); M.block('lacquer_black', x, 11.5, 0, .4, 3.8, .1); M.block('lacquer_black', x, 11.5, 1.7, .4, 3.8, .1); for (const t of [-1, 1]) M.block('lacquer_black', x, 11.5 + t * 1.85, 0, .3, .12, 1.9); for (let k = 0; k < 6; k++) M.rod(k % 2 ? 'iron' : 'lacquer_black', [x, 9.9 + k * .62, .12], [x - sd * .1, 9.9 + k * .62 + .05, 1.78], .035, 6); }
    },
    // the Ronin Strategy Room: a small dark room for one plan at a time. Targets pinned across the back wall joined by red
    // string, a low table with the map and a single candle, incense smoke, a wall panel slid half open on hidden blades
    room_ronin_strategy(M) {
      M.room = true;
      const { HX, HY, H, DW, DH, TAB } = RT;
      hall(M, { HX, HY, H, DW, DH, floor: 'darkwood', wall: 'plaster_old', wain: 'darkwood', wainH: 1, rail: 'lacquer_black', post: 'lacquer_black', postEvery: 3.5, beam: 'lacquer_black', ceil: 'darkwood', ceilBeam: 'lacquer_black', ceilEvery: 3.5 });
      for (let i = 0; i < 6; i++) for (let j = 0; j < 8; j++) { const x0 = -5.4 + i * 1.8, y0 = -5.6 + j * .9; if (y0 > 5) continue; M.quad('tatami', [[x0, y0, .015], [x0 + 1.8, y0, .015], [x0 + 1.8, y0 + .9, .015], [x0, y0 + .9, .015]]); }
      // the target wall: a dark board, cards pinned up, red string from pin to pin
      M.block('darkwood', 0, -HY + .1, 1.1, 12.4, .12, 3.7); wallArt(M, 'back', 0, 1.3, 12, 3.3, 'plaster_old', HX, HY, .17);
      const pins = [[-5.2, 4], [-3.6, 2.2], [-1.6, 3.7], [.2, 1.9], [1.9, 3.9], [3.6, 2.4], [5.1, 3.6], [-4.4, 1.6], [4.6, 1.5]];
      pins.forEach(([u, z], k) => { wallArt(M, 'back', u, z - .45, .8, .95, k % 2 ? 'scroll_sam' : 'scroll_sam2', HX, HY, .19); M.sphere('red', [u, -HY + .24, z + .38], .06, 1, 6, 4); });
      for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [1, 7], [5, 8], [0, 2], [3, 5], [2, 4]]) { const [ua, za] = pins[a], [ub, zb] = pins[b]; M.rod('red', [ua, -HY + .26, za + .38], [ub, -HY + .26, zb + .38], .018, 3); }
      // the low table, its map, the candle, the incense and its smoke, cushions
      const [tx, ty] = TAB; M.block('lacquer_black', tx, ty, .3, 2.6, 1.6, .08); for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) M.block('lacquer_black', tx + a * 1.15, ty + b * .65, 0, .12, .12, .3);
      M.quad('map_table', [[tx - 1.15, ty - .65, .385], [tx + 1.15, ty - .65, .385], [tx + 1.15, ty + .65, .385], [tx - 1.15, ty + .65, .385]]);
      M.cyl('bronze', [tx + .8, ty + .3, .38], .09, .03, 8); M.cyl('candle', [tx + .8, ty + .3, .41], .04, .2, 8); M.cyl('fire', [tx + .8, ty + .3, .61], .035, .12, 6, .005);
      M.cyl('bronze', [tx - .85, ty - .35, .38], .12, .1, 10, .09); M.rod('bark', [tx - .85, ty - .35, .48], [tx - .82, ty - .35, .78], .008, 3);
      M.quad('smoke', [[tx - 1.05, ty - .35, .8], [tx - .65, ty - .35, .8], [tx - .5, ty - .35, 2.6], [tx - 1.2, ty - .35, 2.6]]);
      for (const [x, y] of [[tx, ty - 1.4], [tx, ty + 1.4], [tx - 1.9, ty], [tx + 1.9, ty]]) M.block('cushion', x, y, .015, .75, .75, .12);
      // the hidden blades: the right wall's panel slid half open on a dark recess with a rack of blades
      const x = HX - .1; M.block('dark', x + .02, -2.6, 0, .1, 4, 3.3); M.block('plaster_old', x - .12, -1.4, 0, .1, 1.7, 3.3); M.block('darkwood', x - .18, -1.4, 0, .06, 1.8, .1); M.block('darkwood', x - .18, -1.4, 3.2, .06, 1.8, .1);
      for (let k = 0; k < 5; k++) { const z = .7 + k * .5; M.rod('iron', [x - .3, -4.4, z], [x - .3, -2.6, z + .05], .03, 4); M.rod('lacquer_black', [x - .3, -4.55, z], [x - .3, -4.4, z], .04, 6); M.block('lacquer_red', x - .25, -4.3, z - .06, .08, .12, .12); }
      // the round window: moonlight through a lattice
      M.rod('moonbar', [-HX + .02, 1, 2.9], [-HX + .1, 1, 2.9], .9, 20); M.rod('darkwood', [-HX + .12, 1, 2.9], [-HX + .16, 1, 2.9], 1.02, 20);
      for (const d of [-.5, 0, .5]) { M.box('darkwood', [-HX + .2, 1 + d, 2.9], [.04, .05, 1.7]); M.box('darkwood', [-HX + .2, 1, 2.9 + d], [.04, 1.7, .05]); }
    },
    // the Ronin Hall of Debts (lore): a long stone gallery whose walls are covered with small wooden debt tablets hung on red
    // cords, thousands of them, every debt the Ronin owe or are owed. Mist on the floor, candles along the walls, at the far
    // end a black stone altar with the red handprint and one flame
    room_ronin_debts(M) {
      M.room = true;
      const { HX, HY, H, DW, DH } = HD;
      hall(M, { HX, HY, H, DW, DH, floor: 'stone', wall: 'stone_dark', post: 'darkwood', postEvery: 4, beam: 'darkwood', ceil: 'darkwood', ceilBeam: 'darkwood', ceilEvery: 4 });
      M.quad('granite', [[-1.2, -HY, .014], [1.2, -HY, .014], [1.2, HY, .014], [-1.2, HY, .014]], [[0, 0], [1, 0], [1, 2 * HY / 2.4], [0, 2 * HY / 2.4]]);
      // the tablets: rows of small plaques on the side walls, each on a red cord
      let sd = 21; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
      const mats = ['wood', 'wood', 'wood', 'plaster', 'darkwood'];
      for (const side of [-1, 1]) for (let row = 0; row < 8; row++) {
        const z = 1.3 + row * .95, x = side * (HX - .08);
        M.rod('red', [x, -HY + .4, z + .42], [x, HY - .4, z + .42], .012, 3);
        for (let y = -HY + .5; y < HY - .5; y += .34 + .06 * r()) {
          const w = .2 + .05 * r(), h = .32 + .08 * r(), t = (r() - .5) * .08, zz = z - .06 * r(), m = mats[(r() * mats.length) | 0];
          const a = side < 0 ? [y - w / 2, y + w / 2] : [y + w / 2, y - w / 2];
          M.quad(m, [[x, a[0] + t, zz], [x, a[1] + t, zz], [x, a[1] - t, zz + h], [x, a[0] - t, zz + h]]);
          M.quad('red', [[x, y - .012, zz + h], [x, y + .012, zz + h], [x, y + .012, z + .42], [x, y - .012, z + .42]]);
        }
      }
      // candles along the walls, mist low over the floor
      for (const side of [-1, 1]) for (let y = -16; y <= 18; y += 3) { M.cyl('bronze', [side * (HX - .5), y, 0], .14, .06, 8); M.cyl('candle', [side * (HX - .5), y, .06], .06, .34, 8); M.cyl('fire', [side * (HX - .5), y, .4], .045, .14, 6, .005); }
      for (const z of [.22, .42, .7]) M.quad('mist_low', [[-HX, -HY, z], [HX, -HY, z], [HX, HY, z], [-HX, HY, z]]);
      // the altar: black stone, the handprint, a flame in a bronze bowl, the rope above
      M.block('stone_dark', 0, -20.4, 0, 3.4, 2.2, 1.2); M.block('stone_dark', 0, -20.4, 1.2, 3.8, 2.6, .18);
      M.quad('emblem_ronin_red', [[-.8, -19.08, .18], [.8, -19.08, .18], [.8, -19.08, 1.1], [-.8, -19.08, 1.1]]);
      M.cyl('bronze', [0, -20.4, 1.38], .45, .26, 14, .3); M.cyl('fire', [0, -20.4, 1.6], .3, .7, 8, .02); M.cyl('lantern', [0, -20.4, 1.6], .14, .45, 6, .01);
      for (const t of [-1, 1]) { M.cyl('bronze', [t * 1.5, -20.4, 1.38], .1, .05, 8); M.cyl('candle', [t * 1.5, -20.4, 1.43], .07, .5, 8); M.cyl('fire', [t * 1.5, -20.4, 1.93], .05, .16, 6, .005); }
      for (let k = 0; k < 10; k++) { const x0 = -2.6 + k * .52, x1 = x0 + .52, sag = q => 4.3 - .5 * Math.sin(Math.PI * (q + 2.6) / 5.2); M.rod('rope', [x0, -21.6, sag(x0)], [x1, -21.6, sag(x1)], .12, 8); }
      wallArt(M, 'back', 0, 2.6, 4.2, 4.2, 'emblem_ronin_red', HX, HY, .08);
    },
    // The Old Door (Ronin, M45): a rock-cut chamber behind the fortress wall. A colossal granite double door fills the far
    // wall above a dais, carved with a ring and the marks of all eleven factions and sealed with the red hand; two ant guardians
    // stand beside the stairs, braziers burn, moonlight falls through a crack in the roof onto the seal
    room_ronin_old_door(M) {
      M.room = true;
      const { HX, HY, H, DW, DH, DAIS, ST, STAT } = OD;
      hall(M, { HX, HY, H, DW, DH, floor: 'stone', wall: 'granite', doorFrame: 'stone_dark', ceil: 'granite' });
      // rough rock along the walls
      let sd = 31; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
      for (const side of [-1, 1]) for (let y = -HY + 2; y < HY - 1; y += 3.2) blob(M, 'granite', [side * (HX - .6), y, 2 + 6 * r()], 1.5, 2 + r(), 3 + 2 * r(), { seed: y * side, amp: .25, flat: .7 });
      for (let x = -HX + 2; x < HX - 1; x += 3.4) if (Math.abs(x) > 6) blob(M, 'granite', [x, -HY + .7, 3 + 5 * r()], 2, 1.4, 3.5, { seed: x * 3, amp: .25 });
      // the crack in the roof, the moonlight through it
      const crack = [[-8, -2], [-5, -5], [-2, -6], [0, -9], [2, -11], [1, -14], [3, -16]];
      for (let i = 0; i + 1 < crack.length; i++) { const [x0, y0] = crack[i], [x1, y1] = crack[i + 1]; M.quad('moonbar', [[x0 - .3, y0, H - .02], [x1 - .3, y1, H - .02], [x1 + .3, y1, H - .02], [x0 + .3, y0, H - .02]]); }
      for (const a of [0, 1.2, 2.4]) M.quad('shaft_moon', [[-2.2 * Math.cos(a), -12 - 2.2 * Math.sin(a), DAIS.h], [2.2 * Math.cos(a), -12 + 2.2 * Math.sin(a), DAIS.h], [2.4 * Math.cos(a), -9.5 + 2.4 * Math.sin(a), H], [-2.4 * Math.cos(a), -9.5 - 2.4 * Math.sin(a), H]]);
      // the dais and its stairs
      M.block('stone_dark', 0, (DAIS.y0 + DAIS.y1) / 2, 0, 2 * DAIS.x, DAIS.y1 - DAIS.y0, DAIS.h);
      stairsK(M, 'stone_dark', -ST.x, ST.x, DAIS.y1, ST.y1, 0, DAIS.h, ST.n, -1);
      // the door: two leaves, the frame, the ring, the eleven marks, the red hand over the seam, the rope
      const zb = DAIS.h, zt = zb + 13.2, yd = -HY + .5;
      for (const t of [-1, 1]) M.block('granite', t * 2.52, yd, zb, 5, .8, zt - zb);
      M.block('stone_dark', 0, yd + .05, zt, 13, 1, 1.6); for (const t of [-1, 1]) M.block('stone_dark', t * 5.8, yd + .05, zb, 1.6, 1, zt - zb);
      const zc = zb + 6.8;
      for (const rad of [4.4, 3.95, 2.1]) for (let k = 0; k < 40; k++) { const a0 = k / 40 * 6.283, a1 = (k + 1) / 40 * 6.283; M.rod('gold', [Math.cos(a0) * rad, yd + .42, zc + Math.sin(a0) * rad], [Math.cos(a1) * rad, yd + .42, zc + Math.sin(a1) * rad], .06, 4); }
      ['samurai', 'ronin', 'shogun', 'bushi', 'buke', 'ashigaru', 'kenshi', 'yamabushi', 'sohei', 'wokou', 'warrior'].forEach((f, k) => {
        const a = Math.PI / 2 - k / 11 * 6.283, cx = Math.cos(a) * 3.2, cz = zc + Math.sin(a) * 3.2, q = .52;
        M.quad('mark_' + f, [[cx + q, yd + .43, cz - q], [cx - q, yd + .43, cz - q], [cx - q, yd + .43, cz + q], [cx + q, yd + .43, cz + q]]);
      });
      M.quad('emblem_ronin_red', [[1.5, yd + .44, zc - 1.5], [-1.5, yd + .44, zc - 1.5], [-1.5, yd + .44, zc + 1.5], [1.5, yd + .44, zc + 1.5]]);
      M.box('dark', [0, yd + .41, (zb + zt) / 2], [.06, .02, zt - zb]);
      for (let k = 0; k < 14; k++) { const x0 = -6.3 + k * .9, x1 = x0 + .9, sag = q => zt - .4 - 1.2 * Math.sin(Math.PI * (q + 6.3) / 12.6); M.rod('rope', [x0, yd + .6, sag(x0)], [x1, yd + .6, sag(x1)], .2, 8); }
      for (let k = 0; k < 6; k++) { const x = -5 + k * 2, z = zt - .4 - 1.2 * Math.sin(Math.PI * (x + 6.3) / 12.6); for (let q = 0; q < 3; q++) M.box('plaster', [x, yd + .68, z - .35 - q * .3], [.3, .02, .28], q % 2 ? .4 : -.4); }
      // the guardians and the braziers
      for (const t of [-1, 1]) antStatue(M, t * STAT, -12, 0, 1.25, 'granite');
      for (const t of [-1, 1]) { M.cyl('bronze', [t * 4.5, -11.5, 0], .3, 1.1, 10, .2); M.cyl('bronze', [t * 4.5, -11.5, 1.1], .55, .35, 14, .7); flame(M, t * 4.5, -11.5, 1.42); }
    },
    // the Hub's Ancient Tunnels (Book One's deepest place): root-veined earth passages lit by glowing fungi and amber
    // crystals wind down from the door to the Great Root Chamber, where roots as thick as halls come down from the dome to the
    // Thing Below: a sleeping heart of root and amber that pulses. A side passage holds the Root Records (carved tablets),
    // another ends at the First Seal, a round stone door carved with the colony's marks
    room_hub_tunnels(M) {
      M.room = true;
      const { PATH, CH, REC, RECC, SEAL, SEALC, TR, TZ } = AT;
      let sd = 5; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
      M.block('earth', -3, -9, -.3, 52, 62, .3);
      const k3 = p => [p[0], p[1], TZ], E = () => M.part('earth').i.length, ix = [E()];
      curveTube(M, 'earth', PATH.map(k3), [TR + .2, TR, TR, TR + .2, TR, TR + .4], { segs: 16, n: 6, ridge: .1, k: 5, bump: .14, cap: false, seed: 1 }); ix.push(E());
      curveTube(M, 'earth', REC.map(k3), [TR, TR - .2, TR - .1], { segs: 14, n: 6, ridge: .1, k: 5, bump: .14, cap: false, seed: 2 }); ix.push(E());
      curveTube(M, 'earth', SEAL.map(k3), [TR, TR - .1], { segs: 14, n: 6, ridge: .1, k: 5, bump: .14, cap: false, seed: 3 }); ix.push(E());
      blob(M, 'earth', [CH[0], CH[1], 0], CH[2], CH[2], CH[3], { segs: 28, rings: 14, amp: .07, freq: 1.2, seed: 4 }); ix.push(E());
      blob(M, 'earth', [RECC[0], RECC[1], 0], RECC[2] + .4, RECC[2] + .4, 4.4, { segs: 18, rings: 9, amp: .1, seed: 5 }); ix.push(E());
      blob(M, 'earth', [SEALC[0], SEALC[1], 0], SEALC[2] + .4, SEALC[2] + .4, 5.2, { segs: 18, rings: 9, amp: .1, seed: 6 }); ix.push(E());
      // open the mouths where the passages meet: each chamber's wall inside a passage, the main passage's wall where the side
      // passage leaves it and the side passage's stub inside the main one (last ranges first, so the earlier ones keep their place)
      const mainP = spline(PATH.map(k3), 6), recP = spline(REC.map(k3), 6), sealP = spline(SEAL.map(k3), 6), hole = TR - .6;
      cutTris(M, 'earth', ix[5], ix[6], nearPath(sealP, hole)); cutTris(M, 'earth', ix[4], ix[5], nearPath(recP, hole));
      cutTris(M, 'earth', ix[3], ix[4], q => nearPath(mainP, hole)(q) || nearPath(sealP, hole)(q));
      cutTris(M, 'earth', ix[1], ix[2], nearPath(mainP, TR - .5)); cutTris(M, 'earth', ix[0], ix[1], nearPath(recP, hole));
      // a dark box round all of it, so any seam between the passages and the chambers shows rock, never the sky
      { const [x0, x1, y0, y1, z0, z1] = [-32, 26, -43, 25, -1, 14]; for (const [a, b] of [[[x0, y0], [x1, y0]], [[x1, y0], [x1, y1]], [[x1, y1], [x0, y1]], [[x0, y1], [x0, y0]]]) M.quad('dark', [[a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1]]); M.quad('dark', [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]); M.quad('dark', [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]]); }
      // the doorway: dressed stones round the opening, daylight beyond
      for (const sx of [-1, 1]) M.block('stone', sx * 2.3, 20.4, 0, .8, .9, 4.2);
      M.block('stone', 0, 20.4, 4.2, 5.4, .9, .7); M.quad('doorview', [[-1.9, 20.95, 0], [1.9, 20.95, 0], [1.9, 20.95, 4.2], [-1.9, 20.95, 4.2]]);
      // roots along the passages and down the dome
      const path = spline(PATH.map(k3), 6);
      for (let i = 2; i < path.length - 3; i += 3) {
        const [x, y] = path[i], a = r() * 6.283, side = r() < .5 ? -1 : 1;
        curveTube(M, 'bark', [[x + Math.cos(a) * 2, y + Math.sin(a) * 2, 4.9], [x + side * 1.4, y + (r() - .5) * 2, 3.6], [x + side * 2.5, y + (r() - .5) * 2.5, 1.2], [x + side * 2.2, y + (r() - .5) * 3, -.1]], [.32, .26, .2, .12], { segs: 8, n: 4, seed: i });
      }
      for (let k = 0; k < 14; k++) {
        const a = k / 14 * Math.PI * 2 + .2 * r(), rr2 = 5 + 7 * r(), top = [CH[0] + Math.cos(a) * 3.5, CH[1] + Math.sin(a) * 3.5, CH[3] - .5];
        curveTube(M, 'bark', [top, [CH[0] + Math.cos(a) * (rr2 * .6), CH[1] + Math.sin(a) * (rr2 * .6), CH[3] * .6], [CH[0] + Math.cos(a + .2) * rr2, CH[1] + Math.sin(a + .2) * rr2, 1.5], [CH[0] + Math.cos(a + .3) * (rr2 + 1.2), CH[1] + Math.sin(a + .3) * (rr2 + 1.2), -.2]], [.9 + .4 * r(), .7, .45, .25], { segs: 10, n: 5, ridge: .12, seed: k + 20 });
      }
      // the Thing Below: the root heart, its amber veins, roots holding it
      blob(M, 'bark_old', [CH[0], CH[1], 3.4], 3.8, 3.6, 4.6, { segs: 24, rings: 14, amp: .16, freq: 1.4, seed: 9 });
      for (let k = 0; k < 10; k++) {
        const a = k / 10 * Math.PI * 2, z0 = 1 + 5.5 * r();
        curveTube(M, 'amber', [[CH[0] + Math.cos(a) * 3.9, CH[1] + Math.sin(a) * 3.7, z0], [CH[0] + Math.cos(a + .35) * 4.15, CH[1] + Math.sin(a + .35) * 3.95, z0 + 1.2], [CH[0] + Math.cos(a + .7) * 3.9, CH[1] + Math.sin(a + .7) * 3.7, z0 + 2.1]], [.09, .07, .04], { segs: 6, n: 4, ridge: 0, bump: 0, seed: k });
      }
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + .4; curveTube(M, 'bark', [[CH[0] + Math.cos(a) * 3.2, CH[1] + Math.sin(a) * 3.2, 6.8], [CH[0] + Math.cos(a) * 4.4, CH[1] + Math.sin(a) * 4.4, 3.5], [CH[0] + Math.cos(a) * 5.4, CH[1] + Math.sin(a) * 5.4, .3]], [.55, .5, .32], { segs: 10, n: 4, seed: k + 40 }); }
      // glowing fungi and amber crystals
      const fungi = (x, y, n) => { for (let q = 0; q < n; q++) { const fx = x + (r() - .5) * 1.2, fy = y + (r() - .5) * 1.2, h = .25 + .5 * r(); M.cyl('plaster', [fx, fy, 0], .05, h, 6); M.sphere('teal_glow', [fx, fy, h], .16 + .14 * r(), .45, 8, 4); } };
      const crystals = (x, y, n) => { for (let q = 0; q < n; q++) { const h = .6 + 1.2 * r(); M.box('amber', [x + (r() - .5) * .9, y + (r() - .5) * .9, h / 2], [.22, .22, h], (r() - .5) * .8, (r() - .5) * .6); } };
      for (let i = 4; i < path.length - 2; i += 5) { const [x, y] = path[i]; fungi(x + (i % 2 ? 1.6 : -1.6), y, 6); }
      for (const [x, y] of [[-9, -18], [9, -30], [-6, -35], [11, -19], [-12, -30]]) fungi(x, y, 9);
      for (const [x, y] of [[8, -15], [-10, -15], [12, -27], [3, -36], [-4, 2.5], [15, 1]]) crystals(x, y, 7);
      // ancient tablets on the chamber wall: the old emblem carved in stone
      for (const a of [-1.15, -.55, .55, 1.15]) { const x = CH[0] + Math.sin(a) * 12.4, y = CH[1] - Math.cos(a) * 12.4; M.box('granite', [x, y, 2.6], [2.8, .5, 3.6], -a); }
      for (const a of [-1.15, -.55, .55, 1.15]) { const x = CH[0] + Math.sin(a) * 12.12, y = CH[1] - Math.cos(a) * 12.12, ca = Math.cos(a), sa = Math.sin(a); M.quad('emblem_rebel', [[x + 1.1 * ca, y + 1.1 * sa, 1.5], [x - 1.1 * ca, y - 1.1 * sa, 1.5], [x - 1.1 * ca, y - 1.1 * sa, 3.7], [x + 1.1 * ca, y + 1.1 * sa, 3.7]]); }
      // the Root Records: tablets leaning round the alcove
      for (let k = 0; k < 7; k++) { const a = -1.4 + k * .48, x = RECC[0] + Math.cos(a) * 3.6, y = RECC[1] + Math.sin(a) * 3.6; M.box('granite', [x, y, 1.1], [.3, 1.3, 2.2], a, 0, .12); }
      M.block('granite', RECC[0], RECC[1], 0, 1.6, 1, .9); M.quad('scroll_sam', [[RECC[0] - .5, RECC[1] - .52, .92], [RECC[0] + .5, RECC[1] - .52, .92], [RECC[0] + .5, RECC[1] + .52, .92], [RECC[0] - .5, RECC[1] + .52, .92]]);
      // the First Seal: a round stone door in the alcove's far wall, rings of carving, eleven marks, a blue light in its heart
      const sx = SEALC[0] - SEALC[2] + .9, sy = SEALC[1], sz = 3.1;
      M.rod('granite', [sx - .5, sy, sz], [sx + .3, sy, sz], 3, 32); M.rod('stone_dark', [sx + .3, sy, sz], [sx + .36, sy, sz], 2.3, 32);
      for (const rad of [2.95, 2.25, 1.2]) for (let k = 0; k < 32; k++) { const a0 = k / 32 * 6.283, a1 = (k + 1) / 32 * 6.283; M.rod('gold', [sx + .38, sy + Math.cos(a0) * rad, sz + Math.sin(a0) * rad], [sx + .38, sy + Math.cos(a1) * rad, sz + Math.sin(a1) * rad], .05, 4); }
      for (let k = 0; k < 11; k++) { const a = k / 11 * 6.283; M.rod('bronze', [sx + .34, sy + Math.cos(a) * 2.6, sz + Math.sin(a) * 2.6], [sx + .46, sy + Math.cos(a) * 2.6, sz + Math.sin(a) * 2.6], .26, 10); }
      M.rod('glow_blue', [sx + .36, sy, sz], [sx + .5, sy, sz], .8, 16);
      for (const t of [-1, 1]) M.block('granite', sx + .2, sy + t * 3.3, 0, 1.4, .9, 6.2);
      M.block('granite', sx + .2, sy, 6.1, 1.4, 7.5, .9);
    },
    // the Hub's Forest Dojo (training): a dojo built round a living tree. The trunk rises from its roots in the middle of the
    // floor and out through a well in the roof where the light falls in; a rope with paper streamers girds it, six straw
    // posts stand round the training ring, the sides open onto the forest over a low wall, fireflies drift in the shade
    room_hub_forest_dojo(M) {
      M.room = true;
      const { HX, HY, H, DW, DH, HOLE, TR, RING, DUM } = FD;
      hall(M, { HX, HY, H, DW, DH, floor: 'wood', wall: 'plaster', wain: 'darkwood', wainH: 1.2, rail: 'wood', post: 'bark', postEvery: 3.75, beam: 'darkwood', noCeil: true });
      // the forest beyond the open sides (over the low wall), rolled bamboo blinds above
      for (const sd of [-1, 1]) for (let y = -HY; y < HY - .1; y += 3.75) { wallArt(M, sd < 0 ? 'left' : 'right', y + 1.875, 1.2, 3.55, 5, 'forestview', HX, HY, .07); M.rod('straw', [sd * (HX - .2), y + .15, 6.45], [sd * (HX - .2), y + 3.6, 6.45], .16, 8); }
      for (let x = -HX; x < HX - .1; x += 3.4) { wallArt(M, 'back', x + 1.7, 1.2, 3.2, 5, 'forestview', HX, HY, .07); M.rod('straw', [x + .15, -HY + .2, 6.45], [x + 3.25, -HY + .2, 6.45], .16, 8); M.block('bark', x, -HY + .14, 0, .3, .3, H); }
      // the roof: boards round the well, rafters, the well's rim, the sky and leaves above it
      const T = .25;
      M.block('wood', 0, (HOLE + HY + .4) / 2, H, 2 * HX + .8, HY + .4 - HOLE, T); M.block('wood', 0, -(HOLE + HY + .4) / 2, H, 2 * HX + .8, HY + .4 - HOLE, T);
      M.block('wood', -(HOLE + HX + .4) / 2, 0, H, HX + .4 - HOLE, 2 * HOLE, T); M.block('wood', (HOLE + HX + .4) / 2, 0, H, HX + .4 - HOLE, 2 * HOLE, T);
      for (let x = -HX + 3.4; x < HX; x += 3.4) if (Math.abs(x) > HOLE) M.block('darkwood', x, 0, H - .42, .3, 2 * HY, .42);
      for (const sd of [-1, 1]) { M.block('darkwood', 0, sd * HOLE, H - .5, 2 * HOLE + .6, .4, .75); M.block('darkwood', sd * HOLE, 0, H - .5, .4, 2 * HOLE + .6, .75); }
      M.quad('skyhole', [[-HOLE, -HOLE, H + 4.5], [HOLE, -HOLE, H + 4.5], [HOLE, HOLE, H + 4.5], [-HOLE, HOLE, H + 4.5]]);
      for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, d = HOLE + .3 + (k % 3) * .4; blob(M, k % 2 ? 'leaves' : 'leaf', [Math.cos(a) * d, Math.sin(a) * d, H + 1.2 + (k % 4) * .5], 1.6, 1.4, .9, { seed: k, amp: .3, flat: .6 }); }
      // the tree: roots over the floor, the trunk through the well, boughs over the roof
      M.cyl('moss', [0, 0, 0], 4.6, .04, 28); M.cyl('earth', [0, 0, 0], 3.1, .07, 24);
      for (let k = 0; k < 8; k++) {
        const a = k / 8 * Math.PI * 2 + .2 * Math.sin(k * 2.3), L = 4.6 + 1.6 * ((k * 37) % 5) / 4;
        curveTube(M, 'bark', [[Math.cos(a) * 1.2, Math.sin(a) * 1.2, 1.1], [Math.cos(a) * 2.4, Math.sin(a) * 2.4, .45], [Math.cos(a + .12) * (L - 1.2), Math.sin(a + .12) * (L - 1.2), .16], [Math.cos(a + .2) * L, Math.sin(a + .2) * L, .02]], [.62, .42, .2, .07], { segs: 10, n: 4, ridge: .1, k: 4, seed: k });
      }
      curveTube(M, 'bark', [[0, 0, -.2], [.25, .15, 3], [-.15, .3, 6.5], [.2, -.1, 10.5], [.5, -.3, 14]], [TR, 1.75, 1.55, 1.4, 1.1], { segs: 18, n: 5, ridge: .16, k: 7, twist: .4, seed: 3 });
      for (const [a, z] of [[0, 11.5], [2.1, 12.4], [4.2, 13]]) curveTube(M, 'bark', [[.3, -.1, z - .8], [Math.cos(a) * 2.4, Math.sin(a) * 2.4, z + .4], [Math.cos(a + .3) * 4.6, Math.sin(a + .3) * 4.6, z + 1.2]], [.6, .38, .16], { segs: 10, n: 4, seed: a * 3 });
      // the rope and its paper streamers round the trunk
      for (let k = 0; k < 20; k++) { const a0 = k / 20 * Math.PI * 2, a1 = (k + 1) / 20 * Math.PI * 2, r = TR - .35; M.rod('rope', [Math.cos(a0) * r, Math.sin(a0) * r, 2.4], [Math.cos(a1) * r, Math.sin(a1) * r, 2.4], .13, 8); }
      for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2 + .3, r = TR - .2, x = Math.cos(a) * r, y = Math.sin(a) * r; for (let q = 0; q < 3; q++) M.box('plaster', [x * (1 + .03 * q), y * (1 + .03 * q), 2.15 - q * .26], [.26, .02, .24], (q % 2 ? .4 : -.4)); }
      // the training ring and its straw posts, bokken racks by the walls, fallen leaves
      for (let k = 0; k < 40; k++) { const a0 = k / 40 * Math.PI * 2, a1 = (k + 1) / 40 * Math.PI * 2; M.quad('darkwood', [[Math.cos(a0) * RING, Math.sin(a0) * RING, .012], [Math.cos(a1) * RING, Math.sin(a1) * RING, .012], [Math.cos(a1) * (RING + .35), Math.sin(a1) * (RING + .35), .012], [Math.cos(a0) * (RING + .35), Math.sin(a0) * (RING + .35), .012]]); }
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + Math.PI / 6; makiwara(M, Math.cos(a) * DUM, Math.sin(a) * DUM); }
      for (const [sd, y0] of [[-1, -6], [1, 6]]) {
        const x = sd * (HX - .45); M.block('darkwood', x, y0, 0, .5, 6, .12); M.block('darkwood', x, y0, 1.7, .5, 6, .1);
        for (const t of [-1, 1]) M.block('darkwood', x, y0 + t * 2.9, 0, .4, .15, 1.9);
        for (let k = 0; k < 9; k++) M.rod('wood', [x - sd * .05, y0 - 2.4 + k * .6, .14], [x + sd * .12, y0 - 2.4 + k * .6 + .08, 1.75], .04, 6);
      }
      let sdd = 11; const rr = () => (sdd = (sdd * 16807) % 2147483647) / 2147483647;
      for (let k = 0; k < 90; k++) { const a = rr() * 6.283, d = 2.6 + rr() * 12, x = Math.cos(a) * d, y = Math.sin(a) * d * .85; if (Math.abs(x) > HX - .6 || Math.abs(y) > HY - .6) continue; M.box(k % 3 ? 'flower_orange' : 'leaf', [x, y, .015], [.22, .14, .006], rr() * 3); }
      // light falling through the well
      for (const a of [0, Math.PI / 3, 2 * Math.PI / 3]) { const c = Math.cos(a) * HOLE * .8, s2 = Math.sin(a) * HOLE * .8; M.quad('glow', [[-c, -s2, .2], [c, s2, .2], [c * .9, s2 * .9, H + 1], [-c * .9, -s2 * .9, H + 1]]); }
    },
    room_hub_forest_firefly(M) { M.room = true; M.sphere('firefly', [0, 0, 0], .07, 1, 6, 4); M.sphere('glow', [0, 0, 0], .32, 1, 6, 4); },
    // the Hub's Video Theatre (lore films), behind the Gathering Hall: a kabuki house. The screen fills the stage's proscenium
    // on the front wall between drawn black / persimmon / green curtains, the hanamichi walkway runs back through masu box
    // seating, six cushion tiers rise to the back platform and the projector booth throws its beam over everyone's heads
    room_hub_theatre(M) {
      M.room = true;
      const { HX, HY, H, DW, DH, DX, ST, HN, TIER, BACK, SCR } = TH;
      hall(M, { HX, HY, H, DW, DH, DX, floor: 'darkwood', wall: 'plaster', wain: 'lacquer_black', wainH: 2.6, rail: 'gold', post: 'darkwood', postEvery: 4, beam: 'lacquer_black', ceil: 'lacquer_black' });
      // ceiling coffers: a gold grid
      for (let x = -HX + 4; x < HX; x += 4) M.block('gold', x, 0, H - .08, .1, 2 * HY, .08);
      for (let y = -HY + 4; y < HY; y += 4) M.block('gold', 0, y, H - .08, 2 * HX, .1, .08);
      // the stage, its front stairs, the proscenium round the screen, the drawn curtains, footlights
      const sy = (ST.y0 + ST.y1) / 2, sw = ST.x1 - ST.x0, sd = ST.y1 - ST.y0;
      M.block('darkwood', 0, sy, 0, sw, sd, ST.h - .05); M.block('wood', 0, sy, ST.h - .05, sw, sd, .05);
      M.block('lacquer_black', 0, ST.y0 - .02, .04, sw, .05, ST.h - .12); M.block('gold', 0, ST.y0 - .05, ST.h - .1, sw + .06, .06, .06);
      stairsK(M, 'darkwood', -2, 2, ST.y0 - 2.2, ST.y0, 0, ST.h, 4, 1, 'gold');
      const z0 = ST.h + .6, z1 = z0 + SCR.h, hw = SCR.w / 2;
      M.quad('dark', [[-hw - .1, HY - .05, z0 - .1], [hw + .1, HY - .05, z0 - .1], [hw + .1, HY - .05, z1 + .1], [-hw - .1, HY - .05, z1 + .1]]);
      for (const [cx, cz, w, h] of [[0, z0 - .35, SCR.w + 1.4, .5], [0, z1 + .35, SCR.w + 1.4, .5], [-hw - .45, (z0 + z1) / 2, .5, SCR.h + 1.2], [hw + .45, (z0 + z1) / 2, .5, SCR.h + 1.2]]) M.box('lacquer_black', [cx, HY - .25, cz], [w, .4, h]);
      for (const [cx, cz, w, h] of [[0, z0 - .08, SCR.w + .3, .06], [0, z1 + .08, SCR.w + .3, .06], [-hw - .16, (z0 + z1) / 2, .06, SCR.h + .2], [hw + .16, (z0 + z1) / 2, .06, SCR.h + .2]]) M.box('gold', [cx, HY - .46, cz], [w, .04, h]);
      const stripes = ['lacquer_black', 'persimmon', 'kabuki_green'];
      for (const sd2 of [-1, 1]) for (let k = 0; k < 9; k++) M.box(stripes[k % 3], [sd2 * (hw + 1.1 + k * .28), HY - .6 - (k % 2) * .16, (ST.h + z1 + 1.4) / 2], [.3, .16, z1 + 1.4 - ST.h]);
      for (let k = 0; k < 36; k++) M.box(stripes[k % 3], [-sw / 2 - .4 + (k + .5) * (sw + .8) / 36, HY - .55, z1 + 1.15], [(sw + .8) / 36 + .01, .2, 1.3]);
      for (let k = 0; k < 9; k++) M.cyl('andon', [-8 + k * 2, ST.y0 + .25, ST.h], .12, .14, 8);
      // the hanamichi: a raised walkway from the stage back through the seats, steps down at its end
      M.block('darkwood', (HN.x0 + HN.x1) / 2, (HN.y0 + ST.y0) / 2, 0, HN.x1 - HN.x0, ST.y0 - HN.y0, HN.h - .04); M.block('wood', (HN.x0 + HN.x1) / 2, (HN.y0 + ST.y0) / 2, HN.h - .04, HN.x1 - HN.x0, ST.y0 - HN.y0, .04);
      stairsK(M, 'darkwood', HN.x0, HN.x1, HN.y0 - 1.4, HN.y0, 0, HN.h, 3, 1, 'gold');
      for (let y = HN.y0 + 1; y < ST.y0; y += 2.8) for (const x of [HN.x0 - .08, HN.x1 + .08]) M.cyl('andon', [x, y, HN.h - .25], .09, .12, 6);
      // masu seats: square boxes of low rails with four cushions each, right of the hanamichi
      const mx0 = -6.4, my1 = 12.4, cell = 1.9, nx = 10, ny = 7;
      for (let i = 0; i <= nx; i++) M.block('darkwood', mx0 + i * cell, my1 - ny * cell / 2, 0, .1, ny * cell, .22);
      for (let j = 0; j <= ny; j++) M.block('darkwood', mx0 + nx * cell / 2, my1 - j * cell, 0, nx * cell, .1, .22);
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) for (const [a, b] of [[-.42, -.42], [.42, -.42], [-.42, .42], [.42, .42]]) M.block('cushion', mx0 + (i + .5) * cell + a, my1 - (j + .5) * cell + b, 0, .62, .62, .1);
      // the tiers, cushions in rows, the back platform with the projector booth and its beam
      for (let k = 0; k < TIER.n; k++) {
        const ya = TIER.y0 - TIER.d * (k + 1), yb = ya + TIER.d, h = TIER.r * (k + 1);
        M.block('darkwood', 0, (ya + yb) / 2, 0, 2 * HX, TIER.d, h - .04); M.block('wood', 0, (ya + yb) / 2, h - .04, 2 * HX, TIER.d, .04); M.block('gold', 0, yb - .02, h - .05, 2 * HX, .05, .05);
        for (let x = -HX + 1.2; x < HX - .6; x += 1.3) M.block('cushion', x, ya + .8, h, .66, .66, .1);
      }
      const yb0 = TIER.y0 - TIER.d * TIER.n;
      M.block('darkwood', 0, (-HY + yb0) / 2, 0, 2 * HX, yb0 + HY, BACK - .04); M.block('wood', 0, (-HY + yb0) / 2, BACK - .04, 2 * HX, yb0 + HY, .04);
      M.block('darkwood', 0, -20.7, BACK, 6, 2.6, 4.2); M.block('lacquer_black', 0, -20.7, BACK + 4.2, 6.4, 3, .2);
      M.block('window_glow', 0, -19.38, BACK + 2.2, 1.6, .06, .9); M.block('iron', 0, -19.7, BACK + 2.6, .5, .5, .5);
      M.quad('glow', [[-.5, -19.3, BACK + 2.6], [.5, -19.3, BACK + 2.6], [hw * .8, HY - .6, z1 - 1], [-hw * .8, HY - .6, z0 + 1]]);
      // house lanterns along the side walls, crest drapes
      for (const sd2 of [-1, 1]) for (let y = -14; y <= 14; y += 4) chochin(M, sd2 * (HX - 1.4), y, H - .5, 2.6, .4, .95);
      for (const sd2 of [-1, 1]) for (const y of [-6, 6]) { M.block('curtain_red', sd2 * (HX - .1), y, 6.4, .06, 2.2, 4.6); M.rod('gold', [sd2 * (HX - .12), y, 9.2], [sd2 * (HX - .18), y, 9.2], .55, 16); }
    },
    // the Hub's Gathering Hall (players meet, parties): a festival canopy of paper lanterns over the whole hall, the banners
    // of all fifteen villages round the walls, a raised hearth with the hanging kettle in the middle, long low tables with
    // cushions either side, the music stage at the back (taiko, a gold folding screen with the Rebel emblem), the event board
    room_hub_gathering(M) {
      M.room = true;
      const { HX, HY, H, DW, DH, ST, HE, ROPES, COLS } = GH;
      hall(M, { HX, HY, H, DW, DH, floor: 'wood', wall: 'plaster', wain: 'darkwood', wainH: 2.2, rail: 'wood', post: 'wood', posts: [-18, -12, -6, 0, 6, 12, 18], beam: 'darkwood', ceil: 'wood', ceilBeam: 'darkwood', ceilEvery: 4 });
      // the floor: a dark border round the middle, a runner from the door
      for (const [x0, y0, x1, y1] of [[-11.4, -12, 11.4, -11.4], [-11.4, 9.4, 11.4, 10], [-11.4, -12, -10.8, 10], [10.8, -12, 11.4, 10]]) M.quad('darkwood', [[x0, y0, .012], [x1, y0, .012], [x1, y1, .012], [x0, y1, .012]]);
      M.quad('runner', [[-1.4, 10, .012], [1.4, 10, .012], [1.4, HY, .012], [-1.4, HY, .012]], [[0, 0], [1, 0], [1, (HY - 10) / 6.4], [0, (HY - 10) / 6.4]]);
      // the raised hearth: a stone platform with a wooden top, the fire pit, the kettle on its hook from the ceiling beam
      const hy = HE.cy, hs = HE.s, hh = HE.h;
      M.block('stone', 0, hy, 0, 2 * hs, 2 * hs, hh - .08); M.block('wood', 0, hy, hh - .08, 2 * hs, 2 * hs, .08);
      for (const [x, y, w, d] of [[0, hy - hs, 2 * hs + .1, .1], [0, hy + hs, 2 * hs + .1, .1], [-hs, hy, .1, 2 * hs + .1], [hs, hy, .1, 2 * hs + .1]]) M.block('darkwood', x, y, hh - .1, w, d, .12);
      M.block('stone', 0, hy, hh, 3.2, 3.2, .18); M.block('dark', 0, hy, hh + .02, 2.6, 2.6, .17); M.block('earth', 0, hy, hh + .1, 2.5, 2.5, .08);
      for (let k = 0; k < 11; k++) { const a = k * 2.4, r = .25 + (k % 4) * .22; M.sphere(k % 3 ? 'fire' : 'lantern', [Math.cos(a) * r, hy + Math.sin(a) * r, hh + .2], .15 + (k % 3) * .03, .55, 8, 4); }
      for (const a of [0, 2.1, 4.2]) M.rod('bark', [Math.cos(a) * .9, hy + Math.sin(a) * .9, hh + .22], [Math.cos(a) * .15, hy + Math.sin(a) * .15, hh + .5], .1, 6);
      for (const [dx, dy, r, h] of [[0, 0, .42, 1.05], [.24, .1, .26, .7], [-.22, -.12, .28, .78]]) M.cyl('fire', [dx, hy + dy, hh + .24], r, h, 8, .02);
      M.rod('wood', [0, hy, H - .45], [0, hy, 3.05], .06, 6); M.box('darkwood', [0, hy, 3.2], [.95, .16, .36]); M.rod('iron', [0, hy, 3.05], [0, hy, 2.3], .03, 4);
      M.sphere('iron', [0, hy, 1.86], .48, .78, 14, 7); M.cyl('iron', [0, hy, 2.18], .2, .08, 10); M.rod('iron', [.36, hy, 1.96], [.7, hy, 2.18], .06, 6);
      for (let k = 0; k <= 6; k++) { const a0 = k / 6 * Math.PI, a1 = (k + 1) / 6 * Math.PI; if (k < 6) M.rod('iron', [Math.cos(a0) * .38, hy, 2.2 + Math.sin(a0) * .12], [Math.cos(a1) * .38, hy, 2.2 + Math.sin(a1) * .12], .02, 4); }
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + Math.PI / 8; M.block('cushion', Math.cos(a) * 2.55, hy + Math.sin(a) * 2.55, hh, .8, .8, .13); }
      // the long low tables with cushions and place settings
      for (const sd of [-1, 1]) {
        const x = sd * 9.2;
        M.block('darkwood', x, -1, .34, 1.6, 16, .1); for (const y of [-8.5, -4.6, -.6, 3.4, 6.5]) for (const t of [-1, 1]) M.block('darkwood', x + t * .64, y, 0, .14, .14, .34);
        for (let k = 0; k < 12; k++) {
          const y = -8.3 + k * 1.33;
          for (const t of [-1, 1]) { M.block('cushion', x + t * 1.3, y, 0, .8, .8, .13); M.cyl('lacquer_red', [x + t * .45, y, .44], .15, .07, 10); M.rod('wood', [x + t * .52, y + .2, .45], [x + t * .2, y + .26, .45], .012, 3); }
          if (k % 3 === 1) { M.cyl('plaster', [x, y + .66, .44], .1, .32, 8, .06); M.cyl('lacquer_black', [x, y + .66, .76], .04, .05, 6); }
        }
      }
      // red columns round the middle
      for (const [x, y] of COLS) { M.cyl('stone', [x, y, 0], .78, .32, 12); M.cyl('lacquer_red', [x, y, .32], .5, H - .32, 14); for (const zz of [2.3, H - .9]) M.cyl('gold', [x, y, zz], .52, .08, 14); }
      // the stage: floor, red fascia with gold trim, front stairs, taiko, the folding screen with the emblem, curtains
      const sy = (ST.y0 + ST.y1) / 2, sw = ST.x1 - ST.x0, sd2 = ST.y1 - ST.y0;
      M.block('darkwood', 0, sy, 0, sw, sd2, ST.h - .06); M.block('wood', 0, sy, ST.h - .06, sw, sd2, .06);
      M.block('lacquer_red', 0, ST.y1 + .02, .05, sw, .05, ST.h - .2); M.block('gold', 0, ST.y1 + .05, ST.h - .14, sw + .06, .06, .08); M.block('gold', 0, ST.y1 + .05, .02, sw + .06, .06, .06);
      stairsK(M, 'darkwood', -2.5, 2.5, ST.y1, ST.y1 + 2.4, 0, ST.h, 4, -1, 'gold');
      for (const sd of [-1, 1]) taiko(M, sd * 5.5, -17.6, ST.h);
      for (let i = 0; i < 6; i++) {
        const x0 = 8.4 - i * 2.8, x1 = x0 - 2.8, ya = -19.15 - (i % 2 ? .3 : 0), yb = -19.15 - (i % 2 ? 0 : .3), z0 = ST.h, z1 = ST.h + 4.8;
        M.quad('shogun_screen', [[x0, ya, z0], [x1, yb, z0], [x1, yb, z1], [x0, ya, z1]], [[i / 6, 0], [(i + 1) / 6, 0], [(i + 1) / 6, 1], [i / 6, 1]]);
        M.rod('lacquer_black', [x0, ya, z1], [x1, yb, z1], .06, 6); M.rod('lacquer_black', [x0, ya, z0 + .03], [x1, yb, z0 + .03], .05, 6); M.rod('lacquer_black', [x0, ya, z0], [x0, ya, z1], .05, 6);
      }
      M.quad('emblem_rebel', [[1.9, -18.95, ST.h + .9], [-1.9, -18.95, ST.h + .9], [-1.9, -18.95, ST.h + 4.7], [1.9, -18.95, ST.h + 4.7]]);
      for (const sd of [-1, 1]) {
        for (let k = 0; k < 5; k++) M.box('curtain_red', [sd * (9.2 + k * .3), -15 - (k % 2) * .12, (ST.h + 9.6) / 2], [.3, .14, 9.6 - ST.h]);
        andon(M, sd * 8.2, -15.3, ST.h, .9);
      }
      M.block('curtain_red', 0, -15.05, 8.8, 20.4, .22, 1.3); M.block('gold', 0, -14.92, 8.78, 20.4, .06, .08);
      // the festival canopy: ropes across the hall, sagging, a lantern every 3 m, red and white
      for (const [ri, y] of ROPES.entries()) {
        const zr = x => 9.9 - 1.25 * (1 - (x / HX) ** 2);
        for (let x = -HX; x < HX - .1; x += 3) M.rod('rope', [x, y, zr(x)], [x + 3, y, zr(x + 3)], .025, 4);
        for (let k = 0, x = -21; x <= 21.01; x += 3, k++) lanternS(M, x, y, zr(x), (k + ri) % 2 ? 'andon' : 'lantern', .3, .62);
      }
      // the villages' banners: six on each side wall, Chumpz and Saints on the front wall, the Hub's over the door
      const side = [['banner_red', 'banner_ronin', 'banner_shogun', 'banner_bushi', 'banner_buke', 'banner_ashigaru'], ['banner_kenshi', 'banner_yamabushi', 'banner_sohei', 'banner_wokou', 'banner_warrior', 'banner_cc']];
      for (const [si, sd] of [[0, -1], [1, 1]]) for (const [k, y] of [-15, -9, -3, 3, 9, 15].entries()) {
        wallArt(M, sd < 0 ? 'left' : 'right', y, 5.3, 2.4, 6.2, side[si][k], HX, HY, .1);
        M.rod('darkwood', [sd * (HX - .16), y - 1.4, 11.55], [sd * (HX - .16), y + 1.4, 11.55], .06, 6);
      }
      for (const [x, cloth, mark] of [[-15, 'plank_teal', 'banana_big'], [15, 'navy', 'emblem_saints']]) {
        M.block(cloth, x, HY - .12, 5.3, 2.4, .06, 6.2); M.rod('darkwood', [x - 1.4, HY - .2, 11.55], [x + 1.4, HY - .2, 11.55], .06, 6);
        wallArt(M, 'front', x, 7.6, 1.9, 1.9, mark, HX, HY, .17);
      }
      M.block('lacquer_black', 0, HY - .12, 7, 3.8, .06, 4.6); M.rod('darkwood', [-2.2, HY - .2, 11.65], [2.2, HY - .2, 11.65], .06, 6); wallArt(M, 'front', 0, 7.6, 3.3, 3.3, 'emblem_rebel', HX, HY, .17);
      // the event board by the door: a dark frame, notices pinned up
      M.block('darkwood', -10, HY - .14, 1.1, 4.4, .16, 3); wallArt(M, 'front', -10, 1.3, 4, 2.6, 'plaster', HX, HY, .24);
      for (const [u, z, w, h, m] of [[-11.3, 2.6, .9, 1.1, 'scroll_sam'], [-10.1, 2.3, 1, 1.3, 'scroll_sam2'], [-8.9, 2.7, .8, 1, 'scroll_sam'], [-10.7, 1.45, 1.2, .7, 'scroll_sam2'], [-9.2, 1.5, .9, .8, 'scroll_sam']]) wallArt(M, 'front', u, z, w, h, m, HX, HY, .25);
      M.block('darkwood', -10, HY - .3, 4.15, 4.6, .3, .18);
      // lamps along the walls
      for (const sd of [-1, 1]) for (const y of [-12, 0, 12]) andon(M, sd * (HX - 1.2), y, 0, 1.2);
    },
    room_sam_dojo(M) {
      M.room = true;
      const { HX, HY, H, CX, CY, ZN, DW, DH, AW, AD, AZ, DZ } = SD, T = .4;
      // floor: planks, the tatami square on a dark rail, cushions along it, the stone entry by the door
      M.block('wood', 0, 0, -.3, 2 * HX + 2 * T, 2 * HY + 2 * T + 2, .3);
      const TX = 12, TY = 7, mw = 2.4, mh = 1.4;
      M.block('darkwood', 0, 0, 0, 2 * TX + .5, 2 * TY + .5, .05);
      for (let i = 0; i < 10; i++) for (let j = 0; j < 10; j++) { const x0 = -TX + i * mw, y0 = -TY + j * mh; M.quad('tatami', [[x0, y0, .065], [x0 + mw, y0, .065], [x0 + mw, y0 + mh, .065], [x0, y0 + mh, .065]]); }
      for (const s of [-1, 1]) for (let k = 0; k < 7; k++) { const y = -5.4 + k * 1.8; M.block('cloth', s * 11.1, y, .065, 1.15, 1.15, .16); for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) M.box('gold', [s * 11.1 + a * .55, y + b * .55, .2], [.08, .08, .08]); }
      M.quad('stone', [[-5, 12.8, .015], [5, 12.8, .015], [5, HY + 1.3, .015], [-5, HY + 1.3, .015]], [[0, 0], [4.2, 0], [4.2, 1.85], [0, 1.85]]);
      M.block('darkwood', 0, 12.7, 0, 10.4, .24, .07);
      // side walls: dark wainscot to 2.6 m, plaster above, posts every 4 m, beams, a band of shoji windows high up
      for (const s of [-1, 1]) {
        M.block('plaster', s * (HX + T / 2), 0, 0, T, 2 * HY + 2 * T, H + .6);
        M.block('darkwood', s * (HX - .06), 0, 0, .12, 2 * HY, 2.6); M.block('wood', s * (HX - .12), 0, 2.6, .24, 2 * HY, .2);
        for (let k = 0; k <= 8; k++) M.block('wood', s * (HX - .14), -HY + k * 4, 0, .28, .42, H);
        M.block('wood', s * (HX - .16), 0, 6.3, .32, 2 * HY, .34); M.block('wood', s * (HX - .16), 0, H - .34, .32, 2 * HY, .34);
        for (let k = 0; k < 8; k++) { const y0 = -HY + k * 4 + .25, y1 = y0 + 3.5, x = s * (HX - .04), q = s < 0 ? [y0, y1] : [y1, y0]; M.quad('shoji', [[x, q[0], 6.75], [x, q[1], 6.75], [x, q[1], 8.55], [x, q[0], 8.55]], [[0, 0], [3.5 / 1.2, 0], [3.5 / 1.2, 1.2], [0, 1.2]]); }
      }
      // back wall with the alcove (tokonoma) behind the dais
      const yb = -HY - T / 2;
      for (const s of [-1, 1]) {
        const w = HX + T - AW / 2, cx = s * (AW / 2 + w / 2), wi = HX - AW / 2, ci = s * (AW / 2 + wi / 2);
        M.block('plaster', cx, yb, 0, w, T, H + .6); M.block('darkwood', ci, -HY + .06, 0, wi, .12, 2.6); M.block('wood', ci, -HY + .12, 2.6, wi, .24, .2);
        M.block('wood', ci, -HY + .16, 6.3, wi, .32, .34); M.block('wood', ci, -HY + .16, H - .34, wi, .32, .34);
        for (const x of [AW / 2 + 4, AW / 2 + 9.5]) M.block('wood', s * x, -HY + .14, 0, .42, .28, H);
        M.block('plaster', s * (AW / 2 + T / 2), -HY - AD / 2, 0, T, AD, AZ);
        M.block('darkwood', s * (AW / 2 + .18), -HY + .12, 0, .52, .52, AZ + .3);
      }
      M.block('plaster', 0, yb, AZ, AW, T, H + .6 - AZ); M.block('plaster', 0, -HY - AD - T / 2, 0, AW + 2 * T, T, AZ); M.block('wood', 0, -HY - AD / 2, AZ - .2, AW, AD, .2);
      const ys = -HY - AD + .05; M.quad('shogun_screen', [[AW / 2, ys, DZ], [-AW / 2, ys, DZ], [-AW / 2, ys, AZ - .2], [AW / 2, ys, AZ - .2]], [[0, 0], [2, 0], [2, 1], [0, 1]]); // gold-leaf screen
      for (let k = 1; k < 4; k++) M.box('darkwood', [-AW / 2 + k * AW / 4, ys + .03, (DZ + AZ - .2) / 2], [.08, .06, AZ - .2 - DZ]);
      M.block('darkwood', 0, -HY + .12, AZ, AW + 1, .52, .45);
      // front wall: the doorway, shoji screens either side, plaster end bays, plaster above the doors
      const yf = HY + T / 2;
      M.block('plaster', 0, yf, DH, 2 * HX + 2 * T, T, H + .6 - DH);
      for (const s of [-1, 1]) {
        M.block('plaster', s * (14 + (HX + T - 14) / 2), yf, 0, HX + T - 14, T, DH);
        M.block('darkwood', s * 17, HY - .06, 0, 6, .12, 2.6); M.block('wood', s * 17, HY - .12, 2.6, 6, .24, .2);
        const x0 = DW / 2 + .42, x1 = 14, n = 4, pw = (x1 - x0) / n;
        for (let k = 0; k < n; k++) {
          const a = s * (x0 + k * pw), b = s * (x0 + (k + 1) * pw), q = HY + .02, P = s > 0 ? [a, b] : [b, a];
          M.quad('shoji', [[P[0], q, .08], [P[1], q, .08], [P[1], q, DH - .08], [P[0], q, DH - .08]], [[0, 0], [pw / 1.2, 0], [pw / 1.2, (DH - .16) / 1.5], [0, (DH - .16) / 1.5]]);
          M.block('darkwood', s * (x0 + k * pw), HY, 0, .16, .22, DH);
        }
        M.block('wood', s * 14, HY - .06, 0, .42, .42, H); M.block('wood', s * 17, HY - .14, 0, .42, .28, H);
        M.block('wood', s * (DW / 2 + .21), HY - .06, 0, .42, .42, DH);
        for (let k = 0; k < 2; k++) { const xs = s * (DW / 2 + .5 + k * 1.6 + .8); M.block('darkwood', xs, HY - .3 - k * .14, .06, 1.6, .06, DH - .2); } // the door leaves, slid open
      }
      M.block('darkwood', 0, HY - .06, DH, 2 * HX, .42, .32); M.block('darkwood', 0, HY, 0, 2 * HX, .42, .06);
      M.block('wood', 0, HY - .16, 6.3, 2 * HX, .32, .34); M.block('wood', 0, HY - .16, H - .34, 2 * HX, .32, .34);
      for (const s of [-1, 1]) M.block('darkwood', s * (DW / 2 + .1), HY + .75, 0, .2, 1.5, DH);
      M.block('darkwood', 0, HY + .75, DH, DW + .4, 1.5, .2);
      M.quad('doorview', [[-DW / 2, HY + 1.45, 0], [DW / 2, HY + 1.45, 0], [DW / 2, HY + 1.45, DH], [-DW / 2, HY + 1.45, DH]]);
      // columns on stone bases, the beams, the aisle ceilings, the raised nave: shoji clerestory and a coffered ceiling
      for (const s of [-1, 1]) for (const y of CY) { M.cyl('stone', [s * CX, y, 0], .78, .32, 12); M.cyl('wood', [s * CX, y, .32], .46, ZN - .32, 14); M.cyl('iron', [s * CX, y, .32], .5, .14, 14); M.cyl('iron', [s * CX, y, H - .55], .5, .12, 14); }
      for (const s of [-1, 1]) {
        M.block('wood', s * CX, 0, H - .1, .62, 2 * HY, .72);
        for (const y of CY) M.block('wood', s * (CX + (HX - CX) / 2), y, H - .1, HX - CX, .5, .6);
        M.block('wood', s * (CX + (HX - CX) / 2), 0, H + .6, HX - CX, 2 * HY, .12);
        for (let k = 0; k <= 16; k++) M.block('darkwood', s * (CX + (HX - CX) / 2), -HY + k * 2, H + .42, HX - CX, .14, .18);
        M.block('plaster', s * CX, 0, H + .6, .3, 2 * HY, ZN - H - .6);
        for (let k = 0; k < 8; k++) { const y0 = -HY + k * 4 + .4, y1 = y0 + 3.2, x = s * (CX - .17), q = s < 0 ? [y1, y0] : [y0, y1]; M.quad('shoji', [[x, q[0], H + 1.1], [x, q[1], H + 1.1], [x, q[1], ZN - .5], [x, q[0], ZN - .5]], [[0, 0], [3.2 / 1.2, 0], [3.2 / 1.2, (ZN - H - 1.6) / 1.5], [0, (ZN - H - 1.6) / 1.5]]); M.block('wood', s * (CX - .16), y0 - .2, H + .6, .2, .3, ZN - H - .6); }
      }
      for (const s of [-1, 1]) M.block('plaster', 0, s * (HY + T / 2), H + .6, 2 * CX, T, ZN - H);
      M.block('wood', 0, 0, ZN + .25, 2 * CX + .4, 2 * HY + .4, .15);
      for (let i = 0; i <= 12; i++) M.block('darkwood', -CX + i * (2 * CX / 12), 0, ZN, .2, 2 * HY, .26);
      for (let j = 0; j <= 16; j++) M.block('darkwood', 0, -HY + j * 2, ZN, 2 * CX, .2, .26);
      // the dais: polished top, gold edge, a step; the great banner in the alcove, armours, the sword stand, lamps, bonsai, incense
      M.block('darkwood', 0, -HY - AD / 2 + (HY - 10.9 + AD) / 2 - AD / 2, 0, 22.8, HY - 10.9 + AD, DZ);
      M.block('wood', 0, -HY - AD / 2 + (HY - 10.9 + AD) / 2 - AD / 2, DZ, 22.6, HY - 10.9 + AD - .2, .05);
      M.block('gold', 0, -10.95, DZ - .14, 22.8, .06, .06); M.block('darkwood', 0, -10.6, 0, 20.4, .6, .4); M.block('gold', 0, -10.32, .34, 20.4, .04, .04);
      const by = -HY - AD + .12, bw = 3.4, bz = AZ - .45, bh = 6.6;
      M.quad('banner_red', [[bw / 2, by, bz - bh], [-bw / 2, by, bz - bh], [-bw / 2, by, bz], [bw / 2, by, bz]]);
      M.rod('darkwood', [-bw / 2 - .3, by + .06, bz + .05], [bw / 2 + .3, by + .06, bz + .05], .07, 8); for (const s of [-1, 1]) M.cyl('gold', [s * (bw / 2 + .3), by + .06, bz - .03], .1, .16, 8);
      for (const s of [-1, 1]) M.quad('scroll_sam2', s < 0 ? [[-AW / 2 + .05, -HY - AD + .6, 2.4], [-AW / 2 + .05, -HY - .4, 2.4], [-AW / 2 + .05, -HY - .4, 6.2], [-AW / 2 + .05, -HY - AD + .6, 6.2]] : [[AW / 2 - .05, -HY - .4, 2.4], [AW / 2 - .05, -HY - AD + .6, 2.4], [AW / 2 - .05, -HY - AD + .6, 6.2], [AW / 2 - .05, -HY - .4, 6.2]]);
      M.cyl('bronze', [0, -HY - .9, DZ], .34, .5, 12, .42); for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2; M.rod('bronze', [Math.cos(a) * .3, -HY - .9 + Math.sin(a) * .3, DZ], [Math.cos(a) * .36, -HY - .9 + Math.sin(a) * .36, DZ + .2], .05, 4); }
      for (const s of [-1, 1]) { yoroi(M, s * 7.4, -14.3, DZ + .05); andon(M, s * 3.9, -12.3, DZ + .05, 1.25); bonsai(M, s * 10.3, -15.3, DZ + .05); }
      katanakake(M, 0, -11.7, DZ + .05);
      // weapon racks (left wall), makiwara posts (right aisle), scrolls, hanging lanterns, the taiko, shoe shelf and flowers by the door
      M.block('darkwood', -19.45, -6, 0, .7, 3.6, .3); M.block('darkwood', -19.62, -6, 2.15, .3, 3.6, .14); for (const t of [-1, 1]) M.block('darkwood', -19.62, -6 + t * 1.7, 0, .24, .2, 2.4);
      for (let k = 0; k < 9; k++) { const y = -6 - 1.45 + k * .36; M.rod('wood', [-19.38, y, .3], [-19.68, y, 2.65], .05, 6); M.rod('dark', [-19.37, y, .3], [-19.43, y, .9], .058, 6); }
      for (const zz of [1.1, 3.7]) M.block('darkwood', -19.78, 2, zz, .22, 3.6, .14);
      for (let k = 0; k < 5; k++) { const y = 2 - 1.4 + k * .7, nag = k % 2; M.rod('darkwood', [-19.55, y, .05], [-19.66, y, 4.4], .055, 6); M.cyl('iron', [-19.55, y, .05], .07, .12, 6);
        if (nag) M.box('iron', [-19.67, y + .06, 4.75], [.05, .16, .75], 0, 0, .1); else M.box('iron', [-19.66, y, 4.66], [.06, .1, .55]); M.cyl('gold', [-19.66, y, 4.36], .07, .08, 6); }
      makiwara(M, 16.6, -6); makiwara(M, 16.6, 2);
      kakejiku(M, -1, 14, 6.1, 1.7, 4.25, 'scroll_sam'); kakejiku(M, 1, 10, 6.1, 1.7, 4.25, 'scroll_sam2'); kakejiku(M, -1, -14, 6.1, 1.7, 4.25, 'scroll_sam2'); kakejiku(M, 1, -14, 6.1, 1.7, 4.25, 'scroll_sam');
      for (const s of [-1, 1]) for (const y of CY) chochin(M, s * 16.75, y, H - .1, .55);
      for (const [x, y] of [[-6, -5], [6, -5], [-6, 5], [6, 5]]) chochin(M, x, y, ZN, 3.4, .58, 1.35);
      taiko(M, 16.3, 12.3, 0);
      M.block('darkwood', -6.6, 15.35, 0, 3.2, 1.1, 1.3); for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) M.block('interior', -7.65 + i * 1.05, 14.79, .15 + j * .58, .9, .02, .45);
      for (const x of [-7.4, -6.9, -6.2, -5.7]) { M.block('wood', x, 15.1, 1.3, .3, .62, .08); M.block('dark', x, 15.1, 1.38, .06, .5, .04); }
      M.block('darkwood', 6.6, 15.1, 0, 1.3, 1.3, .62); M.cyl('lacquer_black', [6.6, 15.1, .62], .3, .55, 10, .2);
      for (const [dx, dy, dz, c] of [[0, 0, 1.9, 'flower_pink'], [.25, .1, 1.6, 'flower_pink'], [-.22, -.05, 1.7, 'red'], [.05, -.2, 1.45, 'flower_pink']]) { M.rod('leaf', [6.6, 15.1, 1.1], [6.6 + dx, 15.1 + dy, dz], .025, 4); M.sphere(c, [6.6 + dx, 15.1 + dy, dz], .13, 1, 8, 4); }
    }
  });
  // ── Shogun rooms ──
  // a small fire: tongues of flame round a bright core, embers (braziers, hearths, altars)
  function flame(M, x, y, z, s = 1, mats = ['fire', 'lantern']) { // mats: [tongues, core] ('spirit', 'orb' for the Yamabushi blue flames)
    M.cyl(mats[1], [x, y, z], .42 * s, .45 * s, 8, .06 * s);
    for (const [dx, dy, h, r] of [[0, 0, 1.15, .3], [.2, .08, .78, .2], [-.18, .1, .84, .2], [.05, -.2, .7, .18], [-.08, -.12, .95, .16]]) M.cyl(mats[0], [x + dx * s, y + dy * s, z], r * s, h * s, 6, .01);
    for (let k = 0; k < 6; k++) { const a = k * 1.05; M.sphere(k % 2 ? mats[0] : mats[1], [x + Math.cos(a) * .34 * s, y + Math.sin(a) * .34 * s, z + .04], .08 * s, .6, 5, 3); }
  }
  // floating stairs: n treads along a strip, axis 'y' (x0..x1 wide, y0 -> y1) or 'x' (y0..y1 wide, x0 -> x1); h0 / h1 = the
  // heights the room deck gives at the strip's min / max end (tread i at h0 + (h1 - h0)(i + 1) / n); stringers under both edges
  function flightK(M, mat, axis, x0, x1, y0, y1, h0, h1, n, nose = 'gold') {
    const a0 = axis === 'y' ? y0 : x0, a1 = axis === 'y' ? y1 : x1, run = (a1 - a0) / n, down = h1 > h0 ? -1 : 1;
    for (let i = 0; i < n; i++) {
      const h = h0 + (h1 - h0) * (i + 1) / n, ac = a0 + (i + .5) * run, ae = ac + down * (run / 2 - .03);
      if (axis === 'y') { M.block(mat, (x0 + x1) / 2, ac, h - .14, x1 - x0, run + .02, .14); if (nose) M.block(nose, (x0 + x1) / 2, ae, h - .03, x1 - x0, .06, .05); }
      else { M.block(mat, ac, (y0 + y1) / 2, h - .14, run + .02, y1 - y0, .14); if (nose) M.block(nose, ae, (y0 + y1) / 2, h - .03, .06, y1 - y0, .05); }
    }
    const hA = h0 + (h1 - h0) / n, L = Math.hypot(a1 - a0, h1 - hA), ang = Math.atan2(h1 - hA, a1 - a0);
    for (const e of axis === 'y' ? [x0 + .15, x1 - .15] : [y0 + .15, y1 - .15]) {
      if (axis === 'y') M.box('darkwood', [e, (a0 + a1) / 2, (hA + h1) / 2 - .32], [.24, L, .45], 0, ang); else M.box('darkwood', [(a0 + a1) / 2, e, (hA + h1) / 2 - .32], [L, .24, .45], 0, 0, -ang);
    }
  }
  // a lacquered chair at (x, y) facing (cos a, sin a): seat at .85, a tall back with a purple panel, arms
  function chairAt(M, x, y, a, mat = 'lacquer_black', cush = 'cushion', z0 = 0) {
    const c = Math.cos(a), s = Math.sin(a), P = (f, l, z) => [x + f * c - l * s, y + f * s + l * c, z + z0];
    M.box(mat, P(0, 0, .8), [.95, .95, .1], a); M.box(cush, P(.04, 0, .9), [.84, .84, .1], a);
    for (const [f, l] of [[-.4, -.4], [.4, -.4], [.4, .4], [-.4, .4]]) M.box(mat, P(f, l, .38), [.09, .09, .76], a);
    M.box(mat, P(-.45, 0, 1.75), [.09, .95, 1.8], a); M.box('gold', P(-.45, 0, 2.68), [.13, 1.02, .08], a); M.box(cush, P(-.395, 0, 1.8), [.02, .66, 1.2], a);
    for (const l of [-.45, .45]) { M.box(mat, P(-.02, l, 1.22), [.86, .08, .08], a); M.box(mat, P(.36, l, 1.03), [.07, .07, .36], a); }
  }
  Object.assign(B, {
    // the Shogun's Throne Room (quest): the Shogun Table down the middle, 26 m of black lacquer with twelve seats (eleven
    // villages and the colony), each seat's banner on a pole behind it; up four steps at its head the throne under a gold
    // canopy hung with wisteria, more wisteria falling from a trellis along the back wall, a great pine on gold leaf behind;
    // black columns, cranes on gold between the wall posts, purple armours either side of the dais
    room_shogun_throne(M) {
      M.room = true;
      const { HX, HY, H, DW, DH, TAB, SEATS, CHX, BX, DAIS, ST, THR, CAN, CX, COLS } = TS;
      hall(M, { HX, HY, H, DW, DH, floor: 'darkwood', wall: 'plaster', wain: 'lacquer_black', wainH: 1.2, rail: 'gold', post: 'lacquer_black', postEvery: 5, beam: 'lacquer_black', ceil: 'darkwood', ceilBeam: 'lacquer_black', ceilEvery: 3.125, doorFrame: 'lacquer_black' });
      for (let x = -HX + 4.25; x < HX - .1; x += 4.25) M.block('lacquer_black', x, 0, H - .45, .4, 2 * HY, .45);
      for (let x = -8.5; x < 8.4; x += 4.25) for (let y = -HY + 3.125; y < 12.6; y += 3.125) M.quad('gold', [[x + .32, y + .32, H - .03], [x + 3.93, y + .32, H - .03], [x + 3.93, y + 2.8, H - .03], [x + .32, y + 2.8, H - .03]]);
      // the purple carpet under the table, gold border
      M.quad('cloth_purple', [[-5.2, -16.6, .012], [5.2, -16.6, .012], [5.2, 13.4, .012], [-5.2, 13.4, .012]]);
      for (const [x0, y0, x1, y1] of [[-5.2, -16.6, 5.2, -16.35], [-5.2, 13.15, 5.2, 13.4], [-5.2, -16.6, -4.95, 13.4], [4.95, -16.6, 5.2, 13.4]]) M.quad('gold', [[x0, y0, .016], [x1, y0, .016], [x1, y1, .016], [x0, y1, .016]]);
      // the Shogun Table: lacquer top on an apron and seven pairs of legs, a purple runner between gold lines, a tray, a cup and a scroll at every seat
      const ty = (TAB.y0 + TAB.y1) / 2, tl = TAB.y1 - TAB.y0, th = TAB.h, hw = TAB.hw;
      M.block('lacquer_black', 0, ty, th - .1, 2 * hw, tl, .1); M.block('gold', 0, ty, th - .14, 2 * hw + .04, tl + .04, .04); M.block('lacquer_black', 0, ty, th - .42, 2 * hw - .3, tl - .3, .28);
      for (let k = 0; k < 7; k++) { const y = TAB.y0 + .5 + k * (tl - 1) / 6; for (const s of [-1, 1]) { M.block('lacquer_black', s * (hw - .3), y, 0, .26, .26, th - .42); M.block('gold', s * (hw - .3), y, .04, .3, .3, .08); } }
      M.quad('cloth_purple', [[-.6, TAB.y0 + .4, th + .004], [.6, TAB.y0 + .4, th + .004], [.6, TAB.y1 - .4, th + .004], [-.6, TAB.y1 - .4, th + .004]]);
      for (const s of [-1, 1]) M.block('gold', s * .66, ty, th, .05, tl - .8, .008);
      // the seats and their banners: eleven villages and the colony
      const bl = ['banner_red', 'banner_ronin', 'banner_bushi', 'banner_buke', 'banner_ashigaru', 'banner_kenshi'], br = ['banner_shogun', 'banner_yamabushi', 'banner_sohei', 'banner_wokou', 'banner_warrior', 'rebel'];
      SEATS.forEach((y, k) => {
        for (const s of [-1, 1]) {
          chairAt(M, s * CHX, y, s < 0 ? 0 : Math.PI);
          const tx = s * (hw - .55); M.block('lacquer_red', tx, y, th, .5, .7, .04); M.cyl('gold', [tx, y + .16, th + .04], .07, .1, 8, .09); M.rod('paper', [tx - .16, y - .2, th + .08], [tx + .16, y - .2, th + .08], .04, 6);
          const x = s * BX, mat = (s < 0 ? bl : br)[k], z0 = 3.4, z1 = 8, a = y + .1, b = y + 1.55;
          M.cyl('stone', [x, y, 0], .32, .26, 10); M.cyl('lacquer_black', [x, y, .26], .075, 8.3, 8); M.cyl('gold', [x, y, 8.56], .11, .3, 8, .02);
          M.rod('lacquer_black', [x, y, z1 + .05], [x, y + 1.62, z1 + .05], .05, 6);
          const q = s > 0 ? [[x, a, z0], [x, b, z0], [x, b, z1], [x, a, z1]] : [[x, b, z0], [x, a, z0], [x, a, z1], [x, b, z1]]; // reads from the aisle
          if (mat === 'rebel') { M.quad('lacquer_black', q); const m0 = (a + b) / 2; M.quad('emblem_rebel', [[x + .015, m0 - .62, 5.2], [x + .015, m0 + .62, 5.2], [x + .015, m0 + .62, 6.44], [x + .015, m0 - .62, 6.44]]); }
          else M.quad(mat, q);
        }
      });
      // the colonnade
      for (const y of COLS) for (const s of [-1, 1]) { const x = s * CX; M.block('stone', x, y, 0, 1.4, 1.4, .4); M.cyl('lacquer_black', [x, y, .4], .5, H - 1.1, 14); for (const zz of [1.4, 7.2, H - 1.6]) M.cyl('gold', [x, y, zz], .53, .12, 14); M.block('lacquer_black', x, y, H - .7, 1.5, 1.5, .25); M.block('gold', x, y, H - .74, 1.56, 1.56, .05); }
      // the walls: cranes on gold between the posts (the NFT bays left plain), a purple valance with gold crests, lamps
      const nft = [-12.5, 2.5, 17.5];
      for (const s of [-1, 1]) {
        const wall = s < 0 ? 'left' : 'right';
        for (let y = -22.5; y <= 22.51; y += 5) {
          if (nft.some(v => Math.abs(v - y) < .1)) continue;
          wallArt(M, wall, y, 1.5, 4.3, 3.9, 'fusuma_cranes', HX, HY, .08, Math.round((y + 22.5) / 5) % 2 ? [[1, 0], [0, 0], [0, 1], [1, 1]] : undefined);
          for (const zz of [1.4, 5.4]) M.block('gold', s * (HX - .1), y, zz, .06, 4.5, .1);
          for (const t of [-1, 1]) M.block('gold', s * (HX - .1), y + t * 2.2, 1.4, .06, .1, 4.1);
        }
        wallArt(M, wall, 0, 5.9, 2 * HY - .6, 1, 'cloth_purple', HX, HY, .12);
        for (let y = -20; y <= 20.01; y += 5) M.rod('gold', [s * (HX - .13), y, 6.4], [s * (HX - .17), y, 6.4], .3, 12);
        for (const y of [-17.5, -2.5, 12.5]) andon(M, s * (HX - 1.4), y, 0, 1.3);
      }
      // the dais: dark stone under black lacquer and gold, tatami on top, four steps
      const dy = (DAIS.y0 + DAIS.y1) / 2, dd = DAIS.y1 - DAIS.y0, dz = DAIS.h;
      M.block('stone_dark', 0, dy, 0, 2 * DAIS.hw, dd, dz - .1); M.block('lacquer_black', 0, dy, dz - .1, 2 * DAIS.hw, dd, .1);
      M.block('gold', 0, DAIS.y1 + .01, dz - .14, 2 * DAIS.hw + .04, .05, .1); for (const s of [-1, 1]) M.block('gold', s * (DAIS.hw + .01), dy, dz - .14, .05, dd, .1);
      for (let i = 0; i < 8; i++) for (let j = 0; j < 6; j++) { const x0 = -DAIS.hw + .2 + i * 1.95, y0 = DAIS.y0 + .1 + j * .9; M.quad('tatami', [[x0, y0, dz + .005], [x0 + 1.95, y0, dz + .005], [x0 + 1.95, y0 + .9, dz + .005], [x0, y0 + .9, dz + .005]]); }
      stairsK(M, 'lacquer_black', -ST.hw, ST.hw, DAIS.y1, DAIS.y1 + ST.d, 0, dz, ST.n, -1, 'gold');
      // the incense burner before the steps
      M.cyl('bronze', [0, -16.1, 0], .5, .9, 12, .38); M.cyl('bronze', [0, -16.1, .9], .55, .5, 12, .4); M.cyl('bronze', [0, -16.1, 1.4], .3, .35, 10, .05);
      for (const t of [-1, 1]) M.rod('bronze', [t * .5, -16.1, 1.2], [t * .72, -16.1, 1.55], .05, 6);
      M.quad('smoke', [[-.35, -16.1, 1.7], [.35, -16.1, 1.7], [.6, -16.1, 4.6], [-.6, -16.1, 4.6]]);
      // the throne: black and gold, the crown on its back
      M.block('lacquer_black', 0, THR, dz, 2.1, 1.8, .55); M.block('gold', 0, THR + .91, dz + .12, 2.12, .03, .3); M.block('cloth_purple', 0, THR + .1, dz + .55, 1.8, 1.4, .18);
      M.block('lacquer_black', 0, THR - .8, dz + .55, 2.3, .24, 3.1); M.quad('mark_shogun', [[.8, THR - .67, dz + 1.7], [-.8, THR - .67, dz + 1.7], [-.8, THR - .67, dz + 3.3], [.8, THR - .67, dz + 3.3]]);
      M.block('gold', 0, THR - .8, dz + 3.65, 2.5, .3, .12); M.cyl('gold', [0, THR - .8, dz + 3.77], .18, .75, 8, .03);
      for (const s of [-1, 1]) { M.block('lacquer_black', s * 1.02, THR + .05, dz + .55, .24, 1.55, .85); M.block('gold', s * 1.02, THR + .05, dz + 1.4, .3, 1.62, .06); M.rod('gold', [s * 1.2, THR - .8, dz + 3.75], [s * .62, THR - .8, dz + 4.4], .06, 6); }
      // the canopy: gold posts, a purple roof with a gold finial, a valance fringed in gold, wisteria hanging all round
      const [cx0, cyA, cyB] = CAN, cz = dz + 6.8, ym = (cyA + cyB) / 2;
      for (const s of [-1, 1]) for (const y of [cyA, cyB]) { M.cyl('lacquer_black', [s * cx0, y, dz], .24, .32, 10); M.cyl('gold', [s * cx0, y, dz + .32], .14, 6.5, 10); }
      M.box('gold', [0, cyA, cz], [2 * cx0 + .34, .18, .18]); M.box('gold', [0, cyB, cz], [2 * cx0 + .34, .18, .18]); for (const s of [-1, 1]) M.box('gold', [s * cx0, ym, cz], [.18, cyB - cyA + .34, .18]);
      const E = .35, C4 = [[-cx0 - E, cyA - E, cz + .08], [cx0 + E, cyA - E, cz + .08], [cx0 + E, cyB + E, cz + .08], [-cx0 - E, cyB + E, cz + .08]], ap = [0, ym, cz + 1.3];
      for (let k = 0; k < 4; k++) M.poly('cloth_purple', [C4[k], C4[(k + 1) % 4], ap]);
      M.cyl('gold', [0, ym, ap[2] - .1], .16, .55, 8, .03); M.sphere('gold', [0, ym, ap[2] + .55], .18, 1, 8, 4);
      for (let k = 0; k < 4; k++) { const a = C4[k], b = C4[(k + 1) % 4]; M.quad('cloth_purple', [[a[0], a[1], cz - .55], [b[0], b[1], cz - .55], [b[0], b[1], cz + .08], [a[0], a[1], cz + .08]]); M.rod('gold', [a[0], a[1], cz - .55], [b[0], b[1], cz - .55], .035, 4); M.rod('gold', [a[0], a[1], cz + .08], [b[0], b[1], cz + .08], .035, 4); }
      let sd = 77; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
      const raceme = (x, y, z, L) => { M.tube(r() < .7 ? 'wisteria' : 'wisteria_pale', [x, y, z], [x + (r() - .5) * .15, y + (r() - .5) * .15, z - L], .12 + .05 * r(), .02, 6, false); if (r() < .6) M.sphere('leaf', [x + (r() - .5) * .25, y + (r() - .5) * .25, z + .04], .16 + .08 * r(), .45, 6, 3); };
      for (let k = 0; k < 4; k++) { const a = C4[k], b = C4[(k + 1) % 4], n = Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / .34); for (let i = 0; i < n; i++) { const t = (i + .5) / n; raceme(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, cz - .55, .5 + .6 * r()); } }
      // the pine screen behind the throne: six gold-leaf panels standing in a zigzag
      for (let i = 0; i < 6; i++) {
        const x0 = 6 - i * 2, x1 = x0 - 2, ya = -24.7 + (i % 2 ? -.25 : 0), yb = -24.7 + (i % 2 ? 0 : -.25), z0 = dz, z1 = dz + 4.6;
        M.quad('byobu_pine', [[x0, ya, z0], [x1, yb, z0], [x1, yb, z1], [x0, ya, z1]], [[i / 6, 0], [(i + 1) / 6, 0], [(i + 1) / 6, 1], [i / 6, 1]]);
        M.rod('lacquer_black', [x0, ya, z1], [x1, yb, z1], .06, 6); M.rod('lacquer_black', [x0, ya, z0 + .04], [x1, yb, z0 + .04], .06, 6); M.rod('lacquer_black', [x0, ya, z0], [x0, ya, z1], .06, 6);
      }
      M.rod('lacquer_black', [-6, -24.7, dz], [-6, -24.7, dz + 4.6], .06, 6);
      // the wisteria along the back wall: two old vines from stone planters up to a trellis, a curtain of flowers from it
      const tz = 9.6;
      for (const s of [-1, 1]) { const x = s * 7.4; M.block('stone', x, -24.3, dz, 1.3, 1.1, .7); M.block('earth', x, -24.3, dz + .7, 1.1, .9, .04); curveTube(M, 'bark', [[x, -24.3, dz + .7], [x + s * .4, -24.4, dz + 3], [x - s * .3, -24.5, dz + 6], [x, -24.6, tz]], [.24, .2, .16, .12], { segs: 8, n: 5, seed: 30 + s }); }
      M.rod('darkwood', [-9, -24.55, tz], [9, -24.55, tz], .08, 6); M.rod('darkwood', [-9, -23.6, tz], [9, -23.6, tz], .06, 6); for (let x = -9; x <= 9.01; x += 1.5) M.rod('darkwood', [x, -24.9, tz], [x, -23.6, tz], .05, 4);
      for (let k = 0; k < 70; k++) { const s = k % 2 ? 1 : -1, x = s * (3.6 + r() * 5.2), y = -24.8 + r() * 1.25; raceme(x, y, tz - .05, .6 + 1.4 * r()); }
      // the Shogun's banners either side, the crown above, purple armours on the dais
      for (const s of [-1, 1]) { wallArt(M, 'back', s * 11.4, 1.4, 2.8, 7.2, 'banner_shogun', HX, HY, .1); M.rod('lacquer_black', [s * 11.4 - 1.7, -HY + .16, 8.7], [s * 11.4 + 1.7, -HY + .16, 8.7], .06, 6); }
      wallArt(M, 'back', 0, 9.95, 1.7, 1.7, 'mark_shogun', HX, HY, .1);
      M.remap2 = { lacquer_red: 'cloth_purple', lacing: 'gold' }; for (const s of [-1, 1]) yoroi(M, s * 6.2, -22, dz); M.remap2 = null;
      // two bronze lanterns inside the door
      for (const s of [-1, 1]) { const x = s * 4, y = 18.5; M.cyl('bronze', [x, y, 0], .55, .3, 8); M.cyl('bronze', [x, y, .3], .16, 2.2, 8); M.cyl('bronze', [x, y, 2.5], .5, .2, 8); M.block('bronze', x, y, 2.7, .8, .8, .9); M.block('window_glow', x, y, 2.85, .62, .82, .6); M.block('window_glow', x, y, 2.85, .82, .62, .6); M.cyl('bronze', [x, y, 3.6], .75, .5, 8, .1); M.sphere('bronze', [x, y, 4.15], .14, 1, 6, 3); }
    },
    // the Shogun's Court of Records (lore): the magistrate's bench in three tiers across the back, the court of white pebbles
    // before it with the straw mat where a petitioner kneels; the side walls are drawers up to the cornice with rolling ladders
    // on brass rails, lattice windows above; the seal press by the door, the court guards' three capture poles, record boxes
    room_shogun_records(M) {
      M.room = true;
      const { HX, HY, H, DW, DH, BW, TIERS, SAND, PRESS, LAD, DRW } = CR;
      hall(M, { HX, HY, H, DW, DH, floor: 'darkwood', wall: 'plaster', beam: 'darkwood', ceil: 'darkwood', ceilBeam: 'darkwood', ceilEvery: 3.25, doorFrame: 'darkwood' });
      const [sx0, sy0, sx1, sy1] = SAND;
      M.quad('pebbles_white', [[sx0, sy0, .02], [sx1, sy0, .02], [sx1, sy1, .02], [sx0, sy1, .02]], [[0, 0], [(sx1 - sx0) / 2, 0], [(sx1 - sx0) / 2, (sy1 - sy0) / 2], [0, (sy1 - sy0) / 2]]);
      for (const [x, y, w, d] of [[(sx0 + sx1) / 2, sy0, sx1 - sx0 + .5, .25], [(sx0 + sx1) / 2, sy1, sx1 - sx0 + .5, .25], [sx0, (sy0 + sy1) / 2, .25, sy1 - sy0], [sx1, (sy0 + sy1) / 2, .25, sy1 - sy0]]) M.block('stone_dark', x, y, 0, w, d, .1);
      M.block('straw', 0, 2.2, .02, 1.3, 2.2, .04); for (let k = 0; k < 6; k++) M.block('rope', 0, 1.2 + k * .4, .061, 1.32, .03, .005);
      // the bench: three tiers, lacquer fronts with gold edges, screens at its ends
      for (const [y0, y1, h] of TIERS) { const yc = (y0 + y1) / 2; M.block('darkwood', 0, yc, 0, 2 * BW, y1 - y0, h - .06); M.block('wood', 0, yc, h - .06, 2 * BW, y1 - y0, .06); M.block('lacquer_black', 0, y1 + .01, .06, 2 * BW, .04, h - .16); M.block('gold', 0, y1 + .02, h - .12, 2 * BW + .02, .05, .06); }
      for (const s of [-1, 1]) M.block('darkwood', s * (BW + .12), -9.7, 0, .24, 6.6, TIERS[2][2] + 1.2);
      for (const [ti, xs] of [[0, [-7, -3.5, 3.5, 7]], [1, [-5.2, 5.2]]]) {
        const [, y1, h] = TIERS[ti];
        for (const x of xs) { M.block('lacquer_black', x, y1 - .55, h, 2.4, .8, .55); M.block('paper', x - .45, y1 - .55, h + .55, .9, .55, .01); M.block('stone_dark', x + .65, y1 - .6, h + .55, .32, .22, .06); M.rod('lacquer_black', [x + .2, y1 - .4, h + .58], [x + .55, y1 - .38, h + .58], .02, 4); M.block('cushion', x, y1 - 1.5, h, .9, .9, .12); }
      }
      const [, my1, mh] = TIERS[2];
      M.block('lacquer_black', 0, my1 - .6, mh, 3.6, .9, .62); M.block('gold', 0, my1 - .14, mh + .52, 3.62, .04, .08); M.block('gold', .9, my1 - .6, mh + .62, .36, .36, .3); M.block('paper', -.7, my1 - .6, mh + .62, 1.1, .6, .01);
      M.block('cushion', 0, -12.3, mh, 1.2, 1.2, .14); M.block('lacquer_black', 0, -12.3, mh + .14, .9, .25, .35);
      wallArt(M, 'back', 0, 2.9, 7, 3.6, 'banner_shogun_mon', HX, HY, .08); wallArt(M, 'back', 0, 6.8, 2, 2, 'mark_shogun', HX, HY, .1);
      for (const s of [-1, 1]) { M.cyl('lacquer_black', [s * 2.4, -12.5, mh], .06, 3.2, 6); M.box('gold', [s * 2.4, -12.5, mh + 3.3], [.5, .06, .5]); M.cyl('gold', [s * 2.4, -12.5, mh], .14, .12, 8); }
      // the drawer walls: a carcass to the cornice, its face all drawers, stiles, the brass ladder rail, lattice windows above
      for (const s of [-1, 1]) {
        const xi = s * (HX - .62), y0 = -12.5, y1 = 12.5, L = y1 - y0, uu = L / 1.6, vv = (DRW - .3) / 1.6, wall = s < 0 ? 'left' : 'right';
        M.block('darkwood', s * (HX - .3), 0, 0, .62, L + .2, DRW + .1);
        M.quad('drawers', s < 0 ? [[xi, y0, .2], [xi, y1, .2], [xi, y1, DRW - .1], [xi, y0, DRW - .1]] : [[xi, y1, .2], [xi, y0, .2], [xi, y0, DRW - .1], [xi, y1, DRW - .1]], [[0, 0], [uu, 0], [uu, vv], [0, vv]]);
        M.block('darkwood', s * (HX - .45), 0, DRW, .9, L + .4, .3); M.block('darkwood', s * (HX - .5), 0, 0, 1, L + .4, .2);
        for (let y = y0; y <= y1 + .01; y += 3.125) M.block('darkwood', s * (HX - .66), y, 0, .1, .14, DRW);
        M.rod('brass', [s * (HX - .82), y0 + .2, DRW - .3], [s * (HX - .82), y1 - .2, DRW - .3], .04, 6);
        for (let k = 0; k < 4; k++) { const yc = -9.4 + k * 6.25; wallArt(M, wall, yc, 8.5, 4, 1.8, 'shoji', HX, HY, .05); M.block('darkwood', s * (HX - .06), yc, 8.4, .1, 4.2, .1); M.block('darkwood', s * (HX - .06), yc, 10.3, .1, 4.2, .1); }
      }
      for (const [s, y] of LAD) {
        const xt = s * (HX - .9), xb = s * (HX - 1.7), zt = DRW - .25;
        for (const t of [-1, 1]) { M.rod('wood', [xt, y + t * .32, zt], [xb, y + t * .32, 0], .045, 6); M.rod('brass', [xt, y + t * .36, zt + .05], [xt + s * .1, y + t * .36, zt - .05], .03, 4); M.rod('iron', [xb, y + t * .32, .07], [xb + .001, y + t * .32, .07], .07, 8); }
        for (let k = 1; k < 18; k++) { const f = k / 18; M.rod('wood', [xt + (xb - xt) * f, y - .32, zt * (1 - f)], [xt + (xb - xt) * f, y + .32, zt * (1 - f)], .03, 4); }
      }
      for (const [s, y, z] of [[-1, -2.1, 2.2], [-1, 9.3, 4.6], [1, -3.6, 1.4], [1, 8.1, 5.6], [1, .4, 3.1]]) { const x = s * (HX - .78); M.block('wood', x, y, z, .34, .38, .3); M.block('paper', x + s * .05, y, z + .3, .2, .3, .02); }
      // the seal press: a screw press on its table, paper under the platen, the red ink, the gold seal
      const [px, py] = PRESS;
      M.block('darkwood', px, py, 0, 2.2, 1.2, 1.45); M.block('wood', px, py, 1.45, 2.3, 1.3, .06);
      for (const t of [-1, 1]) M.block('darkwood', px + t * .62, py, 1.51, .2, .55, 2.4);
      M.block('darkwood', px, py, 3.9, 1.6, .6, .35); M.cyl('wood', [px, py, 2.1], .11, 1.8, 10); for (let k = 0; k < 10; k++) M.cyl('darkwood', [px, py, 2.25 + k * .15], .14, .04, 10);
      M.rod('iron', [px - .8, py, 3.65], [px + .8, py, 3.65], .045, 6); for (const t of [-1, 1]) M.sphere('iron', [px + t * .82, py, 3.65], .08, 1, 6, 3);
      M.block('darkwood', px, py, 1.95, 1, .5, .15); M.block('paper', px, py, 1.51, .86, .44, .24);
      M.cyl('red', [px - .85, py - .25, 1.51], .14, .05, 12); M.block('gold', px + .88, py - .3, 1.51, .2, .2, .26); M.block('paper', px + .7, py + .3, 1.51, .5, .35, .03);
      // the three capture poles of the court guards (fork, T-head, barbs) on their rack by the door
      const rx = -7.5, ry = HY - .32;
      M.block('darkwood', rx, ry, 0, 2.4, .4, .25); M.block('darkwood', rx, ry + .06, 3.1, 2.4, .26, .16);
      [-.7, 0, .7].forEach((dx, k) => {
        const x = rx + dx, z = 4.6; M.rod('darkwood', [x, ry, .25], [x, ry, z], .05, 6);
        if (k === 0) for (const t of [-1, 1]) { M.rod('iron', [x, ry, z], [x + t * .35, ry, z + .4], .03, 4); M.rod('iron', [x + t * .35, ry, z + .4], [x + t * .35, ry, z + .62], .03, 4); }
        else if (k === 1) { M.rod('iron', [x, ry, z], [x, ry, z + .2], .03, 4); M.rod('iron', [x - .3, ry, z + .2], [x + .3, ry, z + .2], .04, 4); for (let q = 0; q < 7; q++) M.rod('iron', [x - .27 + q * .09, ry, z + .2], [x - .27 + q * .09, ry - .1, z + .3], .012, 3); }
        else { M.rod('iron', [x, ry, z - .1], [x, ry, z + .8], .025, 4); for (let q = 0; q < 6; q++) { const zz = z - .1 + q * .14, sg = q % 2 ? 1 : -1; M.rod('iron', [x, ry, zz], [x + sg * .16, ry - .08, zz + .1], .015, 3); } }
      });
      for (const [x, y, z, w] of [[-11.6, 9.6, 0, 1.6], [-11.6, 9.6, .82, 1.4], [-11.4, 11.1, 0, 1.4], [-10.2, 10.4, 0, 1.2], [-11.5, 11.1, .82, 1.2]]) { M.block('lacquer_black', x, y, z, w, w * .7, .8); M.block('cloth_purple', x, y, z + .38, w + .02, .08, .06); M.block('cloth_purple', x, y, z + .38, .08, w * .7 + .02, .06); }
      for (const [x, y] of [[-4.5, -1], [4.5, -1], [-4.5, 5], [4.5, 5]]) chochin(M, x, y, H - .45, 2.6, .5, 1.2);
    },
    // the Shogun's Keep (lore / treasure): the castle's tall well. Stairs climb its walls flight over flight to a gallery on each
    // level and the lookout at the top, whose windows look over the valley at dusk; the great pillar rises through the middle,
    // the Shogun's banner hangs down the well; the treasury chests under the stairs, the Shogun's armour and swords, the bow
    // gallery, the tea alcove, the telescope and the map table at the lookout
    room_shogun_keep(M) {
      M.room = true;
      const { HX, HY, H, DW, DH, I, LV, N } = KP, [L1, L2, L3] = LV;
      hall(M, { HX, HY, H, DW, DH, floor: 'darkwood', wall: 'plaster', wain: 'darkwood', wainH: 1.4, rail: 'lacquer_black', post: 'darkwood', postEvery: 5.5, beam: 'darkwood', ceil: 'darkwood', ceilBeam: 'darkwood', ceilEvery: 2.75 });
      for (const z of LV) for (const s of [-1, 1]) { M.block('darkwood', s * (HX - .16), 0, z - .6, .32, 2 * HY, .3); M.block('darkwood', 0, s * (HY - .16), z - .6, 2 * HX, .32, .3); }
      // the galleries: plank floors on joists
      const slab = (y0, y1, z) => { M.block('darkwood', 0, (y0 + y1) / 2, z - .35, 2 * HX, y1 - y0, .35); M.quad('wood', [[-HX, y0, z + .005], [HX, y0, z + .005], [HX, y1, z + .005], [-HX, y1, z + .005]], [[0, 0], [2 * HX / 1.6, 0], [2 * HX / 1.6, (y1 - y0) / 1.6], [0, (y1 - y0) / 1.6]]); for (let x = -HX + 1; x < HX; x += 1.4) M.block('darkwood', x, (y0 + y1) / 2, z - .65, .22, y1 - y0, .3); };
      slab(-HY, -I, L1); slab(I, HY, L2); slab(-HY, -I, L3);
      // flight A solid from the floor (right wall, rising to the back), B and C on stringers (left wall to the front, right wall to the back)
      stairsK(M, 'darkwood', I, HX, -I, 6, 0, L1, N, -1, 'gold');
      const flight = (x0, x1, y0, y1, base, rise, dir) => {
        const run = (y1 - y0) / N;
        for (let k = 0; k < N; k++) { const yc = dir > 0 ? y0 + (k + .5) * run : y1 - (k + .5) * run, top = base + rise * (k + 1) / N; M.block('darkwood', (x0 + x1) / 2, yc, top - .14, x1 - x0, run + .02, .14); M.block('gold', (x0 + x1) / 2, yc - dir * (run / 2 - .03), top - .03, x1 - x0, .06, .05); }
        const L = Math.hypot(y1 - y0, rise), ang = Math.atan2(rise, y1 - y0) * dir;
        for (const x of [x0 + .15, x1 - .15]) M.box('darkwood', [x, (y0 + y1) / 2, base + rise / 2 - .3], [.24, L, .5], 0, ang);
      };
      flight(-HX, -I, -I, I, L1, L2 - L1, 1); flight(I, HX, -I, I, L2, L3 - L2, -1);
      // railings along the gallery edges and up the open side of every flight; the four great posts at the corners of the well
      const rail = (a, b, h = 1.6) => {
        M.rod('lacquer_black', [a[0], a[1], a[2] + h], [b[0], b[1], b[2] + h], .06, 6);
        const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / .9));
        for (let k = 0; k <= n; k++) { const t = k / n, p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; M.rod('darkwood', p, [p[0], p[1], p[2] + h], .035, 4); }
      };
      rail([-I, -I, L1], [I, -I, L1]); rail([-I, I, L2], [I, I, L2]); rail([-HX, -I, L3], [I, -I, L3]);
      rail([I, 6, 0], [I, -I, L1]); rail([-I, -I, L1], [-I, I, L2]); rail([I, I, L2], [I, -I, L3]);
      for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) M.block('darkwood', a * I, b * I, 0, .5, .5, H);
      // the great pillar, gold-banded at every floor, the banner down the well
      M.block('stone', 0, 0, 0, 2.6, 2.6, .5); M.cyl('lacquer_black', [0, 0, .5], .85, H - .5, 18); for (const z of [1.4, L1 + .6, L2 + .6, L3 + .6, H - 1.2]) M.cyl('gold', [0, 0, z], .9, .16, 18);
      M.quad('banner_shogun', [[1.5, -I + .4, L1 + 1.2], [-1.5, -I + .4, L1 + 1.2], [-1.5, -I + .4, L3 - .4], [1.5, -I + .4, L3 - .4]]); M.rod('lacquer_black', [-1.8, -I + .4, L3 - .3], [1.8, -I + .4, L3 - .3], .07, 6);
      for (const t of [-1, 1]) M.rod('rope', [t * 1.7, -I + .4, L3 - .3], [t * 1.7, -I, L3 + 1.6], .02, 3);
      // windows: the valley at dusk, behind lattices
      const win = (wall, u, z0, w, h, u0, u1) => {
        wallArt(M, wall, u, z0, w, h, 'valley_view', HX, HY, .03, [[u0, 0], [u1, 0], [u1, 1], [u0, 1]]);
        const n = Math.round(w / .55), fr = (a, b) => wall === 'back' ? [-a, -HY + .12, b] : wall === 'front' ? [a, HY - .12, b] : [wall === 'left' ? -HX + .12 : HX - .12, a, b];
        for (let k = 1; k < n; k++) { const v = u - w / 2 + k * w / n; M.rod('darkwood', fr(wall === 'back' ? -v : v, z0), fr(wall === 'back' ? -v : v, z0 + h), .035, 4); }
        for (const zz of [z0, z0 + h]) M.rod('darkwood', fr(wall === 'back' ? -(u - w / 2) : u - w / 2, zz), fr(wall === 'back' ? -(u + w / 2) : u + w / 2, zz), .08, 4);
      };
      win('back', 6.6, L3 + 1.2, 4.4, 3, 0, 1 / 3); win('back', 0, L3 + 1.2, 4.4, 3, 1 / 3, 2 / 3); win('back', -6.6, L3 + 1.2, 4.4, 3, 2 / 3, 1);
      win('left', -9.5, L3 + 1.2, 2.4, 3, .78, .92); win('right', -9.5, L3 + 1.2, 2.4, 3, .06, .2);
      win('left', -9.5, L1 + 1.2, 2.2, 2, .2, .32); win('right', -9.5, L1 + 1.2, 2.2, 2, .62, .74);
      win('front', -6, L2 + 1.2, 2.6, 2.4, .4, .55); win('front', 6, L2 + 1.2, 2.6, 2.4, .45, .6);
      win('left', -2.5, 2.2, 1.8, 1.6, .3, .38); win('left', 4, 2.2, 1.8, 1.6, .52, .6);
      // the ground floor: the treasury under the stairs, the Shogun's armour and swords, spear racks by the door
      for (const [k, y] of [-3.6, -.6, 2.4, 5.4].entries()) {
        const x = -HX + .95; M.block('lacquer_black', x, y, 0, 1.3, 2.2, 1.2); M.block('gold', x, y, 1.2, 1.34, 2.24, .06);
        for (const t of [-1, 1]) { M.block('gold', x, y + t * 1.08, 0, 1.36, .08, 1.26); M.block('gold', x + .66, y + t * .7, .5, .04, .3, .3); }
        M.block('cloth_purple', x + .67, y, .2, .03, .12, 1);
        if (k % 2) for (let q = 0; q < 6; q++) M.cyl('gold', [x + 1.1, y + .4 - (q % 2) * .5, q * .07], .15, .06, 10);
      }
      M.remap2 = { lacquer_red: 'cloth_purple', lacing: 'gold' }; yoroi(M, 0, -9.9, 0); M.remap2 = null; katanakake(M, 0, -8.45, 0, 2.6);
      for (const s of [-1, 1]) { const x = s * 5, y = HY - .35; M.block('darkwood', x, y, 0, 2.2, .4, .2); M.block('darkwood', x, y + .05, 3.2, 2.2, .3, .14); for (let k = 0; k < 5; k++) { const xx = x - .8 + k * .4; M.rod('darkwood', [xx, y, .2], [xx, y, 4.6], .045, 6); M.box('iron', [xx, y, 4.85], [.06, .06, .5]); } }
      // the bow gallery (first floor, back wall)
      M.block('darkwood', 0, -HY + .25, L1 + 1.3, 17.4, .3, .1); M.block('darkwood', 0, -HY + .25, L1 + 3.6, 17.4, .3, .1);
      for (let k = 0; k < 7; k++) { const x = -7.2 + k * 2.4; curveTube(M, 'lacquer_black', [[x, -HY + .32, L1 + .4], [x + .25, -HY + .36, L1 + 2.2], [x, -HY + .32, L1 + 4.2]], [.05, .06, .05], { segs: 6, n: 4, seed: k }); M.rod('paper', [x, -HY + .32, L1 + .45], [x, -HY + .32, L1 + 4.15], .01, 3); }
      for (const s of [-1, 1]) { const x = s * 9.4; M.cyl('lacquer_black', [x, -HY + .5, L1], .25, 1.4, 10); for (let q = 0; q < 6; q++) M.rod('wood', [x + (q % 3 - 1) * .08, -HY + .5 + (q > 2 ? .06 : -.06), L1 + 1], [x + (q % 3 - 1) * .1, -HY + .5, L1 + 2.2], .015, 3); }
      // the tea alcove (second floor, front wall)
      M.block('wood', 0, HY - .3, L2, 4, .6, .25); wallArt(M, 'front', 0, L2 + .9, 1.4, 3.2, 'scroll_sam2', HX, HY, .1);
      M.cyl('bronze', [1.2, HY - .32, L2 + .25], .14, .5, 8, .1); for (const [dx, dz] of [[0, .7], [.1, .9], [-.08, .85]]) M.sphere('flower_pink', [1.2 + dx, HY - .32, L2 + .25 + dz], .1, 1, 6, 3);
      M.cyl('iron', [-1.2, HY - .32, L2 + .25], .2, .14, 10); M.sphere('iron', [-1.2, HY - .32, L2 + .55], .2, .8, 10, 5); M.rod('darkwood', [-1.05, HY - .32, L2 + .72], [-.85, HY - .32, L2 + .92], .015, 4); // the kettle on the alcove's platform: the gallery in front stays open
      // the lookout (top floor): the map table, the telescope on its tripod, a brazier
      // (the gallery is a body's width deep: the table is shallow, the telescope and brazier stand in the two end corners)
      M.block('darkwood', 0, -HY + .4, L3, 2.4, .7, 1.4); M.quad('war_map', [[-1.1, -HY + .1, L3 + 1.41], [1.1, -HY + .1, L3 + 1.41], [1.1, -HY + .7, L3 + 1.41], [-1.1, -HY + .7, L3 + 1.41]]);
      for (const a of [0, 2.1, 4.2]) M.rod('darkwood', [10.2, -10.3, L3 + 2.2], [10.2 + Math.cos(a) * .45, -10.3 + Math.sin(a) * .45, L3], .04, 4);
      M.rod('brass', [10.15, -9.8, L3 + 2.1], [10.25, -10.8, L3 + 2.45], .11, 10); M.rod('brass', [10.25, -10.8, L3 + 2.45], [10.27, -10.9, L3 + 2.48], .14, 10);
      M.cyl('iron', [-10.2, -10.3, L3], .4, .9, 10, .6); for (let k = 0; k < 6; k++) M.sphere(k % 2 ? 'fire' : 'lantern', [-10.2 + Math.cos(k) * .18, -10.3 + Math.sin(k) * .18, L3 + .95], .13, .6, 6, 3);
    },
    // the Shogun's War Council (video): a round chamber under a purple dome of gold constellations, the round lacquer table inlaid
    // with the colony map in gold and twelve chairs round it, a ring of lanterns over it; the generals' helmets and the war fans
    // between the posts, the Shogun's banners either side of the screen, where the film plays in a gold frame
    room_shogun_council(M) {
      M.room = true;
      const { R, WH, DOME, DW, DH, TAB, SEAT, NS, SCR } = WC, da = 2 * Math.PI / NS, a0 = Math.PI / 2 - da; // the door: segments 0 and 1, centred on +y
      const P = (t, r, z) => [Math.cos(t) * r, Math.sin(t) * r, z];
      M.block('darkwood', 0, 0, -.3, 2 * R + 2, 2 * R + 4, .3);
      const ring = (r0, r1, mat, z = .012) => { for (let k = 0; k < NS; k++) { const a = k * da, b = a + da; M.quad(mat, [P(a, r0, z), P(b, r0, z), P(b, r1, z), P(a, r1, z)]); } };
      ring(7.7, 12.4, 'lacquer_black', .008); ring(7.5, 7.7, 'gold'); ring(12.4, 12.55, 'gold');
      for (let k = 0; k < 12; k++) { const t = k * Math.PI / 6 + Math.PI / 12, n = [-Math.sin(t) * .06, Math.cos(t) * .06]; M.quad('gold', [[Math.cos(t) * 7.7 + n[0], Math.sin(t) * 7.7 + n[1], .014], [Math.cos(t) * 12.4 + n[0], Math.sin(t) * 12.4 + n[1], .014], [Math.cos(t) * 12.4 - n[0], Math.sin(t) * 12.4 - n[1], .014], [Math.cos(t) * 7.7 - n[0], Math.sin(t) * 7.7 - n[1], .014]]); }
      // the wall: plaster over a dark wainscot, a beam and a gold band at the top, the doorway in two segments
      for (let k = 0; k < NS; k++) {
        const a = a0 + k * da, b = a + da, door = k < 2, zb = door ? DH : 0;
        M.quad('plaster', [P(a, R, zb), P(b, R, zb), P(b, R, WH), P(a, R, WH)], [[0, zb / 3], [1, zb / 3], [1, WH / 3], [0, WH / 3]]);
        if (!door) { M.quad('darkwood', [P(a, R - .06, 0), P(b, R - .06, 0), P(b, R - .06, 1.3), P(a, R - .06, 1.3)]); M.quad('lacquer_black', [P(a, R - .1, 1.3), P(b, R - .1, 1.3), P(b, R - .1, 1.45), P(a, R - .1, 1.45)]); }
        M.quad('darkwood', [P(a, R - .1, WH - .5), P(b, R - .1, WH - .5), P(b, R - .1, WH), P(a, R - .1, WH)]); M.quad('gold', [P(a, R - .14, WH - .08), P(b, R - .14, WH - .08), P(b, R - .14, WH + .04), P(a, R - .14, WH + .04)]);
      }
      const dl = P(a0 + 2 * da, R, 0), dr = P(a0, R, 0);
      for (const p of [dl, dr]) { M.block('lacquer_black', p[0], p[1] + .4, 0, .3, 1, DH); M.quad('plaster', [[p[0], p[1], 0], [p[0], R + .55, 0], [p[0], R + .55, DH], [p[0], p[1], DH]]); }
      M.block('lacquer_black', 0, dr[1] + .4, DH, DW + .6, 1, .3); M.quad('plaster', [[dl[0], dl[1], DH], [dr[0], dr[1], DH], [dr[0], R + .55, DH], [dl[0], R + .55, DH]]);
      M.quad('doorview', [[-DW / 2, R + .5, 0], [DW / 2, R + .5, 0], [DW / 2, R + .5, DH], [-DW / 2, R + .5, DH]]);
      for (let k = 0; k < 12; k++) { const t = k * Math.PI / 6 + Math.PI / 12; M.box('darkwood', P(t, R - .2, WH / 2), [.4, .5, WH], t); }
      // the dome: purple, gold stars and constellations, twelve gold ribs, the crown in a gold ring at the top
      const Ri = 10, G = [], U = [];
      for (let i = 0; i <= Ri; i++) { const e = i / Ri * Math.PI / 2, rho = R * Math.cos(e), z = WH + DOME * Math.sin(e), row = [], urow = []; for (let j = 0; j <= NS; j++) { row.push(P(j * da, rho, z)); urow.push([j / NS * 4, i / Ri]); } G.push(row); U.push(urow); }
      M.grid('dome_stars', G, U);
      for (let k = 0; k < 12; k++) { const t = k * Math.PI / 6 + Math.PI / 12; let prev = null; for (let i = 0; i <= 10; i++) { const e = i / 10 * Math.PI / 2 * .96, q = P(t, (R - .12) * Math.cos(e), WH + (DOME - .12) * Math.sin(e)); if (prev) M.rod('gold', prev, q, .07, 5); prev = q; } }
      M.cyl('gold', [0, 0, WH + DOME - .32], 1.4, .14, 24); M.quad('mark_shogun', [[-1.1, -1.1, WH + DOME - .34], [1.1, -1.1, WH + DOME - .34], [1.1, 1.1, WH + DOME - .34], [-1.1, 1.1, WH + DOME - .34]]);
      // the round table on its pedestal and legs, the gold rim, the colony map inlaid in its top; the twelve chairs
      M.cyl('lacquer_black', [0, 0, 0], 1.6, .3, 24, 1.4); M.cyl('lacquer_black', [0, 0, .3], .9, 1.02, 16);
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; M.rod('lacquer_black', P(a, .8, .9), P(a, 3.9, 1.3), .09, 6); M.cyl('lacquer_black', P(a, 4.1, 0), .12, 1.32, 8); }
      M.cyl('lacquer_black', [0, 0, 1.32], TAB, .13, NS); M.tube('gold', [0, 0, 1.3], [0, 0, 1.47], TAB + .04, TAB + .04, NS, false);
      const mp = [], mu = []; for (let k = 0; k < NS; k++) { const t = k * da; mp.push(P(t, TAB - .3, 1.455)); mu.push([.5 + .5 * Math.cos(t), .5 + .5 * Math.sin(t)]); } M.poly('council_map', mp, mu);
      for (let k = 0; k < 12; k++) { const t = k * Math.PI / 6, p = P(t, SEAT, 0); chairAt(M, p[0], p[1], t + Math.PI); }
      // the lantern ring over the table, on three chains from the dome
      const cz = 6.4;
      for (let k = 0; k < 24; k++) M.rod('gold', P(k / 24 * 6.283, 2.8, cz), P((k + 1) / 24 * 6.283, 2.8, cz), .06, 5);
      for (let k = 0; k < 12; k++) { const p = P(k / 12 * 6.283, 2.8, cz); lanternS(M, p[0], p[1], cz, 'andon', .26, .55); }
      for (let k = 0; k < 3; k++) M.rod('gold', P(k / 3 * 6.283, 2.8, cz), [0, 0, WH + DOME - .45], .025, 4);
      // round the wall: the screen at the back between the Shogun's banners, war fans east and west, helmets on their stands
      const [sw, sh, sz] = SCR, sy = -13.25;
      M.block('lacquer_black', 0, sy - .12, sz - .3, sw + .9, .24, sh + .6); M.box('gold', [0, sy + .01, sz + sh / 2], [sw + .5, .02, sh + .2]); M.quad('dark', [[sw / 2, sy + .03, sz], [-sw / 2, sy + .03, sz], [-sw / 2, sy + .03, sz + sh], [sw / 2, sy + .03, sz + sh]]);
      const wallQ = (t, z0, w, h, mat, inset = .25) => { const c = Math.cos(t), s = Math.sin(t), r0 = R - inset, tx = -s * w / 2, ty = c * w / 2; M.quad(mat, [[c * r0 + tx, s * r0 + ty, z0], [c * r0 - tx, s * r0 - ty, z0], [c * r0 - tx, s * r0 - ty, z0 + h], [c * r0 + tx, s * r0 + ty, z0 + h]]); };
      for (const t of [4 * Math.PI / 3, 5 * Math.PI / 3]) { wallQ(t, 1.6, 2.4, 5, 'banner_shogun'); M.rod('lacquer_black', P(t - .1, R - .3, 6.7), P(t + .1, R - .3, 6.7), .05, 6); }
      for (const t of [0, Math.PI]) {
        const c = Math.cos(t), s = Math.sin(t), q = d => P(t, R - .3 - d, 0);
        M.rod('lacquer_black', [q(.03)[0], q(.03)[1], 2.5], [q(.03)[0], q(.03)[1], 3.45], .05, 6);
        M.rod('lacquer_black', [q(0)[0], q(0)[1], 4.1], [q(.05)[0], q(.05)[1], 4.1], .7, 18); M.rod('gold', [q(.05)[0], q(.05)[1], 4.1], [q(.07)[0], q(.07)[1], 4.1], .62, 18); M.rod('red', [q(.07)[0], q(.07)[1], 4.1], [q(.08)[0], q(.08)[1], 4.1], .26, 14);
        M.rod('cloth_purple', [q(.04)[0], q(.04)[1], 2.5], [q(.04)[0] + s * .05, q(.04)[1] - c * .05, 1.9], .04, 4);
      }
      for (const t of [Math.PI / 6, 5 * Math.PI / 6, 7 * Math.PI / 6, 11 * Math.PI / 6]) {
        const c = Math.cos(t), s = Math.sin(t), [x, y] = P(t, R - 1, 0);
        M.box('lacquer_black', [x, y, .7], [.9, 1.1, 1.4], t); M.box('cloth_purple', [x, y, 1.42], [.95, 1.15, .04], t);
        for (let q = 0; q < 3; q++) M.cyl('lacquer_black', [x, y, 1.66 + q * .12], .66 - q * .06, .1, 14, .62 - q * .06);
        M.sphere('iron', [x, y, 2.05], .48, .8, 12, 6); M.cyl('gold', [x - c * .42, y - s * .42, 2.1], .1, .12, 8);
        for (const g of [-1, 1]) M.rod('gold', [x - c * .42, y - s * .42, 2.2], [x - c * .55 - s * g * .38, y - s * .55 + c * g * .38, 2.95], .045, 5);
      }
    }
  });
  // ── Bushi and Buke rooms ──
  // a wooden gear in the kit's y-z plane (axle along x): rim, hub, spokes, teeth; r = pitch radius
  function gearK(M, r, n, w) {
    for (const rr of [r - .12, r - .42]) M.tube('wood', [-w / 2, 0, 0], [w / 2, 0, 0], rr, rr, 28, false);
    for (let k = 0; k < 28; k++) { const a0 = k / 28 * 6.283, a1 = (k + 1) / 28 * 6.283; for (const x of [-w / 2, w / 2]) M.quad('wood', [[x, Math.cos(a0) * (r - .42), Math.sin(a0) * (r - .42)], [x, Math.cos(a1) * (r - .42), Math.sin(a1) * (r - .42)], [x, Math.cos(a1) * (r - .12), Math.sin(a1) * (r - .12)], [x, Math.cos(a0) * (r - .12), Math.sin(a0) * (r - .12)]]); }
    M.rod('darkwood', [-w / 2 - .04, 0, 0], [w / 2 + .04, 0, 0], Math.max(.22, r * .22), 12); M.rod('iron', [-w / 2 - .3, 0, 0], [w / 2 + .3, 0, 0], .1, 8);
    for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2; M.box('darkwood', [0, Math.cos(a) * (r - .02), Math.sin(a) * (r - .02)], [w, .22, .26], 0, a); }
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + .3; M.rod('darkwood', [0, Math.cos(a) * r * .2, Math.sin(a) * r * .2], [0, Math.cos(a) * (r - .4), Math.sin(a) * (r - .4)], .07, 4); }
  }
  // a timber railing along a straight run a -> b (top rail at h), posts every ~1.2 m
  function railK(M, a, b, h = 1.5, mat = 'lacquer_black', post = 'darkwood') {
    M.rod(mat, [a[0], a[1], a[2] + h], [b[0], b[1], b[2] + h], .06, 6);
    const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 1.2));
    for (let k = 0; k <= n; k++) { const t = k / n, p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; M.rod(post, p, [p[0], p[1], p[2] + h], .05, 4); }
  }
  Object.assign(B, {
    // the Bushi War Room (lore): the colony modelled in sand on a great relief table, its river, every village on it with its
    // banner on a pin, unit markers on the roads; the round window in the east wall full of sunrise, its light across the floor;
    // map racks, the Bushi standard, the commander's chair, the quivers by the door
    room_bushi_war(M) {
      M.room = true;
      const { HX, HY, H, DW, DH, TAB, WIN } = WR, [cx, cy, hx, hy, tz] = TAB;
      hall(M, { HX, HY, H, DW, DH, floor: 'stone_blue', wall: 'stone_blue', wain: 'navy', wainH: 1.3, rail: 'gold', post: 'darkwood', postEvery: 4, beam: 'darkwood', ceil: 'darkwood', ceilBeam: 'darkwood', ceilEvery: 3 });
      M.block('darkwood', cx, cy, 0, 2 * hx, 2 * hy, tz - .45); M.block('gold', cx, cy, tz - .47, 2 * hx + .1, 2 * hy + .1, .06);
      for (const s of [-1, 1]) { M.block('darkwood', cx, cy + s * (hy + .02), tz - .45, 2 * hx + .1, .12, .55); M.block('darkwood', cx + s * (hx + .02), cy, tz - .45, .12, 2 * hy + .1, .55); }
      // the relief: hills, a ridge in the west, the river's valley winding through
      const base = tz - .42, riv = x => cy + 1.1 * Math.sin((x - cx) * .5);
      const hgt = (x, y) => Math.max(0, .1 + .3 * Math.max(0, Math.sin(x * .9 + 1) * Math.cos(y * 1.3)) + .22 * Math.max(0, 1 - Math.hypot(x - cx + 4.4, y - cy - 1.7) / 2.2) - .18 * Math.max(0, 1 - Math.abs(y - riv(x)) / .7));
      const G = [], U = [];
      for (let j = 0; j <= 20; j++) { const row = [], ur = []; for (let i = 0; i <= 34; i++) { const x = cx - hx + i / 34 * 2 * hx, y = cy - hy + j / 20 * 2 * hy; row.push([x, y, base + hgt(x, y)]); ur.push([i / 34 * 3, j / 20 * 2]); } G.push(row); U.push(ur); }
      M.grid('sand_table', G, U);
      const at = (x, y) => base + hgt(x, y);
      for (let x = cx - hx + .2; x < cx + hx - .5; x += .5) M.rod('water', [x, riv(x), at(x, riv(x)) + .03], [x + .5, riv(x + .5), at(x + .5, riv(x + .5)) + .03], .1, 5);
      const fl = ['banner_red', 'banner_ronin', 'banner_shogun', 'banner_bushi', 'banner_buke', 'banner_ashigaru', 'banner_kenshi', 'banner_yamabushi', 'banner_sohei', 'banner_wokou', 'banner_warrior'];
      const village = (x, y, mat) => { const z = at(x, y); M.block('wood', x, y, z, .34, .28, .18); M.block('roof', x, y, z + .18, .42, .36, .07); M.rod('iron', [x + .24, y, z], [x + .24, y, z + .66], .014, 4); M.quad(mat, [[x + .25, y, z + .32], [x + .62, y, z + .32], [x + .62, y, z + .64], [x + .25, y, z + .64]]); };
      fl.forEach((m, k) => { const a = k / 11 * Math.PI * 2 - Math.PI / 2, x = cx + 5.1 * Math.cos(a), y = cy + 2.75 * Math.sin(a); village(x, y, m);
        for (let q = 0; q < 6; q++) { const t0 = q / 6, t1 = (q + .6) / 6, x0 = cx + (x - cx) * t0, y0 = cy + (y - cy) * t0, x1 = cx + (x - cx) * t1, y1 = cy + (y - cy) * t1; M.rod('rope', [x0, y0, at(x0, y0) + .02], [x1, y1, at(x1, y1) + .02], .025, 3); }
        if (k % 2 === 0) for (const t of [.38, .62]) { const px = cx + (x - cx) * t, py = cy + (y - cy) * t; M.cyl(['navy', 'lacquer_red', 'gold'][(k / 2 + t * 10 | 0) % 3], [px, py, at(px, py)], .1, .16, 8); } });
      village(cx, cy, 'emblem_rebel');
      // the round east window: sunrise behind a gold ring and a navy lattice; its light falling across to the table
      const wx = HX - .06, { y: wy, z: wz, r: wr } = WIN, n = 40, disc = [], duv = [];
      for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2; disc.push([wx, wy + Math.cos(a) * wr, wz + Math.sin(a) * wr]); duv.push([.5 - .5 * Math.cos(a), .5 + .5 * Math.sin(a)]); }
      M.poly('sunrise', disc, duv);
      for (let k = 0; k < n; k++) { const a0 = k / n * 6.283, a1 = (k + 1) / n * 6.283; M.rod('gold', [wx - .05, wy + Math.cos(a0) * wr, wz + Math.sin(a0) * wr], [wx - .05, wy + Math.cos(a1) * wr, wz + Math.sin(a1) * wr], .14, 6); M.rod('navy', [wx - .06, wy + Math.cos(a0) * wr * .52, wz + Math.sin(a0) * wr * .52], [wx - .06, wy + Math.cos(a1) * wr * .52, wz + Math.sin(a1) * wr * .52], .05, 4); }
      for (const d of [-.5, 0, .5]) { const h = Math.sqrt(1 - d * d) * wr; M.rod('navy', [wx - .07, wy + d * wr, wz - h], [wx - .07, wy + d * wr, wz + h], .05, 4); M.rod('navy', [wx - .07, wy - h, wz + d * wr], [wx - .07, wy + h, wz + d * wr], .05, 4); }
      M.block('stone', wx - .2, wy, wz - wr - .55, .5, 2 * wr + .8, .4);
      M.quad('shaft_sun', [[4.4, wy + 2.9, .05], [4.4, wy - 2.9, .05], [wx - .12, wy - 2.6, wz + .6], [wx - .12, wy + 2.6, wz + .6]]);
      // map racks along the back wall: pigeonholes full of rolled maps
      for (const s of [-1, 1]) { const x0 = s * 5.5; M.block('darkwood', x0, -HY + .45, 0, 7.6, .9, 3.6); for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) { const x = x0 - 3.2 + i * 1.28, z = .3 + j * .82; M.quad('dark', [[x - .55, -HY + .91, z], [x + .55, -HY + .91, z], [x + .55, -HY + .91, z + .7], [x - .55, -HY + .91, z + .7]]); for (let q = 0; q < 3; q++) M.rod((i + j + q) % 3 ? 'paper' : 'straw', [x - .36 + q * .36, -HY + .98, z + .16 + (q % 2) * .26], [x - .36 + q * .36, -HY + .42, z + .16 + (q % 2) * .26], .13, 8); } }
      // the standard, the commander's chair at the head of the table, the signal flags, the quivers
      M.cyl('stone', [-11.4, -8.6, 0], .4, .3, 8); M.cyl('darkwood', [-11.4, -8.6, .3], .08, 6.6, 8); M.rod('darkwood', [-11.4, -8.6, 6.6], [-11.4, -6.4, 6.6], .05, 6); M.quad('banner_bushi', [[-11.36, -6.4, 2.6], [-11.36, -8.5, 2.6], [-11.36, -8.5, 6.55], [-11.36, -6.4, 6.55]]); M.cyl('gold', [-11.4, -8.6, 6.9], .1, .3, 6, .02);
      chairAt(M, -8.4, cy, 0, 'lacquer_black', 'navy');
      M.block('darkwood', -HX + .5, 7, 0, .8, 5, .3); for (let k = 0; k < 6; k++) { const y = 5 + k * .8; M.rod('darkwood', [-HX + .5, y, .3], [-HX + .3, y, 3.8], .04, 4); M.quad(['red', 'paper', 'navy', 'gold', 'cloth_black', 'red'][k], [[-HX + .32, y, 3], [-HX + .32, y + .7, 3], [-HX + .32, y + .7, 3.7], [-HX + .32, y, 3.7]]); }
      for (let k = 0; k < 5; k++) { const x = 7.2 + k * .9, y = HY - .4; M.cyl('lacquer_black', [x, y, 0], .22, 1.5, 10); for (let q = 0; q < 6; q++) M.rod('wood', [x + (q % 3 - 1) * .07, y + (q > 2 ? .06 : -.06), 1], [x + (q % 3 - 1) * .09, y, 2.3], .015, 3); }
      for (const [x, y] of [[-12.6, 9.6], [12.6, 9.6], [12.6, -9.6]]) andon(M, x, y, 0, 1.25);
    },
    // the Bushi Strategy Hall (games / lore): a giant go board inlaid in the floor with a game half played on it, stones you walk
    // between, their bowls at the corners; go tables down one wall and shogi tables down the other, each game left mid-play with
    // its cushions; the alcove with the crossed swords scroll, the ranking board by the door
    room_bushi_strategy(M) {
      M.room = true;
      const { HX, HY, H, DW, DH, B: Bh, BY, GO, SH } = BG;
      hall(M, { HX, HY, H, DW, DH, floor: 'wood', wall: 'plaster', wain: 'navy', wainH: 1.2, rail: 'gold', post: 'darkwood', postEvery: 4, beam: 'darkwood', ceil: 'wood', ceilBeam: 'darkwood', ceilEvery: 3 });
      M.block('darkwood', 0, BY, 0, 2 * Bh + .6, 2 * Bh + .6, .02); M.quad('goban', [[-Bh, BY - Bh, .03], [Bh, BY - Bh, .03], [Bh, BY + Bh, .03], [-Bh, BY + Bh, .03]]);
      const pt = k => -Bh + (22 / 512 + k * (468 / 512) / 18) * 2 * Bh, used = new Set();
      let sd = 91; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
      const stone = (i, j, w) => { const key = i * 19 + j; if (used.has(key)) return; used.add(key); M.sphere(w ? 'go_white' : 'go_black', [pt(i), BY + pt(j), .15], .28, .42, 12, 6); };
      for (const [ci, cj] of [[3, 3], [15, 3], [3, 15], [15, 15], [9, 9], [9, 14]]) for (let k = 0; k < 8; k++) stone(Math.max(0, Math.min(18, ci + Math.round((r() - .5) * 6))), Math.max(0, Math.min(18, cj + Math.round((r() - .5) * 6))), r() < .5);
      for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const x = a * (Bh + 1), y = BY + b * (Bh + 1); M.cyl('darkwood', [x, y, 0], .62, .62, 16, .7); M.cyl('lacquer_black', [x, y, .62], .66, .06, 16); for (let q = 0; q < 5; q++) M.sphere((a + b) % 4 ? 'go_white' : 'go_black', [x + (q % 3 - 1) * .2, y + (q > 2 ? .15 : -.12), .62], .14, .42, 8, 4); }
      // the side tables: low boards on their feet, the game on top, a cushion each side, bowls
      const table = (x, y, board, go) => {
        M.block('wood', x, y, 0, 1.3, 1.3, .55); for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) M.block('darkwood', x + a * .5, y + b * .5, 0, .2, .2, .12);
        M.quad(board, [[x - .62, y - .62, .555], [x + .62, y - .62, .555], [x + .62, y + .62, .555], [x - .62, y + .62, .555]]);
        for (const t of [-1, 1]) M.block('cushion', x, y + t * 1.3, 0, .95, .95, .14);
        for (let q = 0; q < (go ? 22 : 14); q++) { const px = x - .55 + r() * 1.1, py = y - .55 + r() * 1.1; if (go) M.sphere(r() < .5 ? 'go_white' : 'go_black', [px, py, .57], .045, .5, 6, 3); else M.box('wood', [px, py, .58], [.08, .1, .035], r() < .5 ? 0 : Math.PI); }
        M.cyl('darkwood', [x + .85, y - .9, 0], .18, .3, 10); M.cyl('darkwood', [x + .85, y + .9, 0], .18, .3, 10);
      };
      for (const [x, y] of GO) table(x, y, 'goban', true); for (const [x, y] of SH) table(x, y, 'shogiban', false);
      // the alcove: a raised floor, the crossed swords scroll, flowers in a bronze vase; the ranking board; lanterns over the board
      M.block('wood', 0, -HY + .65, 0, 6, 1.3, .3); wallArt(M, 'back', 0, 1.2, 2.2, 5, 'banner_bushi_scroll', HX, HY, .08); M.rod('darkwood', [-1.3, -HY + .12, 6.25], [1.3, -HY + .12, 6.25], .05, 6);
      M.cyl('bronze', [1.9, -HY + .6, .3], .2, .7, 10, .12); for (const [dx, dz] of [[0, .9], [.12, 1.1], [-.1, 1.05], [.05, 1.25]]) M.sphere('flower_pink', [1.9 + dx, -HY + .6, .3 + dz], .1, 1, 6, 3);
      wallArt(M, 'front', -6.5, 1.8, 3.2, 3.6, 'banner_bushi_board', HX, HY, .08);
      for (const [x, y] of [[-3.5, BY - 3.5], [3.5, BY - 3.5], [-3.5, BY + 3.5], [3.5, BY + 3.5]]) chochin(M, x, y, H - .3, 2.2, .5, 1.2);
      for (const [x, y] of [[-12.8, -10.6], [12.8, -10.6], [-12.8, 9], [12.8, 9]]) andon(M, x, y, 0, 1.2);
    },
    // the Bushi Dojo (training): the rising sun and crossed swords painted across the back wall over the commander's dais; the
    // blue stone floor painted with the drill's lines, its wooden unit blocks standing in a wedge on them; the officers'
    // galleries along both walls, up their stairs from the door end, practice swords racked along their fronts
    room_bushi_dojo(M) {
      M.room = true;
      const { HX, HY, H, DW, DH, G, GH, GY, SY, DA, BLK } = BD;
      hall(M, { HX, HY, H, DW, DH, floor: 'stone_blue', wall: 'plaster', wain: 'navy', wainH: 1.2, rail: 'gold', post: 'darkwood', postEvery: 5, beam: 'darkwood', ceil: 'darkwood', ceilBeam: 'darkwood', ceilEvery: 3.75 });
      wallArt(M, 'back', 0, 2.6, 25.5, 6.4, 'mural_bushi', HX, HY, .08);
      const line = (x0, y0, x1, y1, w, m = 'chalk') => { const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), nx = -dy / L * w / 2, ny = dx / L * w / 2; M.quad(m, [[x0 + nx, y0 + ny, .014], [x0 - nx, y0 - ny, .014], [x1 - nx, y1 - ny, .014], [x1 + nx, y1 + ny, .014]]); };
      for (let k = -4; k <= 4; k++) { line(k * 2.4, -9.6, k * 2.4, 9.6, .07); line(-9.6, k * 2.4, 9.6, k * 2.4, .07); }
      line(0, -8.2, -6.6, 3.4, .16, 'gold'); line(0, -8.2, 6.6, 3.4, .16, 'gold'); line(-6.6, 3.4, 6.6, 3.4, .12, 'gold');
      for (let k = 0; k < 40; k++) { const a0 = k / 40 * 6.283, a1 = (k + 1) / 40 * 6.283; line(Math.cos(a0) * 11.6, Math.sin(a0) * 11.6 - 1, Math.cos(a1) * 11.6, Math.sin(a1) * 11.6 - 1, .09); }
      BLK.forEach(([x, y], k) => { M.block(k % 3 === 2 ? 'lacquer_red' : 'navy', x, y, 0, 1.2, 1.2, .6); M.block('gold', x, y, .6, .5, .5, .02); M.block('darkwood', x, y + .4, .6, .1, .1, .5); });
      // the galleries: solid below, plank floors, gold edges, railings; the stairs; practice swords on their fronts
      for (const s of [-1, 1]) {
        const xi = s * (HX - G), xc = s * (HX - G / 2), yc = (-HY + GY) / 2, L = GY + HY;
        M.block('darkwood', xc, yc, 0, G, L, GH - .15); M.block('wood', xc, yc, GH - .15, G, L, .15); M.block('gold', xi, yc, GH - .22, .06, L, .1);
        railK(M, [xi, -HY, GH], [xi, GY, GH], 1.6); railK(M, [xi, GY, GH], [xi, SY, 0], 1.6);
        stairsK(M, 'darkwood', s < 0 ? -HX : HX - G, s < 0 ? -HX + G : HX, GY, SY, 0, GH, 11, -1, 'gold');
        M.block('darkwood', xi - s * .06, yc, 1.7, .12, L - 1, .14); M.block('darkwood', xi - s * .06, yc, .25, .12, L - 1, .14);
        for (let k = 0; k < 16; k++) { const y = -HY + 1.1 + k * 1.3; M.rod('wood', [xi - s * .2, y, .3], [xi - s * .08, y, 2.5], .045, 6); M.rod('wood', [xi - s * .3, y + .25, .3], [xi - s * .1, y + .25, 2.3], .04, 6); }
        for (const y of [-10, -2, 6]) wallArt(M, s < 0 ? 'left' : 'right', y, GH + 1.6, 1.4, 3.4, 'banner_bushi', HX, HY, .08);
      }
      // the commander's dais: tatami, the camp stool, the war fan on its stand, two standards
      M.block('darkwood', 0, (DA[1] + DA[2]) / 2, 0, 2 * DA[0], DA[2] - DA[1], DA[3]); stairsK(M, 'darkwood', -1.6, 1.6, DA[2], DA[2] + .9, 0, DA[3], 2, -1, 'gold');
      for (let i = 0; i < 4; i++) M.quad('tatami', [[-DA[0] + .1 + i * 1.95, DA[1] + .1, DA[3] + .005], [-DA[0] + .1 + (i + 1) * 1.95, DA[1] + .1, DA[3] + .005], [-DA[0] + .1 + (i + 1) * 1.95, DA[2] - .1, DA[3] + .005], [-DA[0] + .1 + i * 1.95, DA[2] - .1, DA[3] + .005]]);
      const z0 = DA[3], sy = -13.7;
      for (const t of [-1, 1]) { M.rod('darkwood', [-.45, sy + t * .35, z0], [.45, sy - t * .35, z0 + .8], .04, 4); M.rod('darkwood', [.45, sy + t * .35, z0], [-.45, sy - t * .35, z0 + .8], .04, 4); }
      M.box('navy', [0, sy, z0 + .82], [1, .9, .06]);
      M.rod('darkwood', [1.4, sy, z0], [1.4, sy, z0 + 1.4], .04, 4); M.rod('lacquer_black', [1.4, sy, z0 + 1.9], [1.42, sy, z0 + 1.9], .42, 16); M.rod('red', [1.43, sy, z0 + 1.9], [1.44, sy, z0 + 1.9], .2, 12); M.rod('lacquer_black', [1.4, sy, z0 + 1.4], [1.4, sy, z0 + 1.55], .03, 4);
      for (const t of [-1, 1]) { const x = t * 2.6, y = -13.9; M.cyl('stone', [x, y, z0], .3, .2, 8); M.cyl('darkwood', [x, y, z0 + .2], .06, 6.6, 6); M.rod('darkwood', [x, y, z0 + 6.7], [x, y + 1.4, z0 + 6.7], .04, 4); M.quad('banner_bushi', t > 0 ? [[x, y + .06, z0 + 3], [x, y + 1.4, z0 + 3], [x, y + 1.4, z0 + 6.65], [x, y + .06, z0 + 6.65]] : [[x, y + 1.4, z0 + 3], [x, y + .06, z0 + 3], [x, y + .06, z0 + 6.65], [x, y + 1.4, z0 + 6.65]]); }
      for (const [x, y] of [[-6, 13.4], [6, 13.4], [-6, -13.4], [6, -13.4]]) andon(M, x, y, 0, 1.3);
    },
    // the Buke Archive Vault (lore / secret): three stone barrel vaults on squat mossy pillars, ribbed at every bay, oil lamps on
    // the pillars; iron drawer cabinets in every bay of the side walls, one drawer sealed in red and locked; at the far end the
    // round vault door stands open on the inner vault, the colony's charter on its pedestal under a gold lamp
    room_buke_vault(M) {
      M.room = true;
      const { HX, HY, H, DW, DH, PX, PY, SPR, RISE, VD, IN } = AV;
      hall(M, { HX, HY, H, DW, DH, floor: 'stone', wall: 'stone', wain: 'moss', wainH: .9, noCeil: true, backOpen: [-VD.r, VD.r, 0, VD.z + VD.r] });
      for (const cx of [-8, 0, 8]) { const G = [], U = []; for (const y of [-HY - .2, HY + .2]) { const row = [], ur = []; for (let k = 0; k <= 16; k++) { const a = k / 16 * Math.PI; row.push([cx + Math.cos(a) * 4, y, SPR + Math.sin(a) * RISE]); ur.push([k / 16 * 3.5, (y + HY) / 2.4]); } G.push(row); U.push(ur); } M.grid('stone', G, U); }
      for (const y of PY) for (const cx of [-8, 0, 8]) for (let k = 0; k < 12; k++) { const a0 = k / 12 * Math.PI, a1 = (k + 1) / 12 * Math.PI; M.rod('stone_dark', [cx + Math.cos(a0) * 3.85, y, SPR + Math.sin(a0) * (RISE - .15)], [cx + Math.cos(a1) * 3.85, y, SPR + Math.sin(a1) * (RISE - .15)], .16, 5); }
      for (const y of PY) for (const s of [-1, 1]) {
        const x = s * PX; M.block('stone', x, y, 0, 1.9, 1.9, .3); M.cyl('stone', [x, y, .3], .75, SPR - .9, 14); M.cyl('moss', [x, y, .3], .78, .9, 14); M.block('stone_dark', x, y, SPR - .6, 1.8, 1.8, .6);
        M.rod('iron', [x - s * .75, y, 2.6], [x - s * 1.08, y, 2.8], .04, 4); M.cyl('bronze', [x - s * 1.12, y, 2.78], .17, .12, 8, .1); flame(M, x - s * 1.12, y, 2.9, .24);
      }
      // the iron cabinets, the locked drawer
      for (const s of [-1, 1]) for (const y of [-12.5, -7.5, -2.5, 2.5, 7.5]) {
        const xc = s * (HX - .45), xf = s * (HX - .92);
        M.block('iron', xc, y, 0, .9, 3.8, 3.4); M.block('iron', xc - s * .02, y, 3.4, 1, 3.9, .12);
        M.quad('drawers_iron', s < 0 ? [[xf, y - 1.8, .15], [xf, y + 1.8, .15], [xf, y + 1.8, 3.25], [xf, y - 1.8, 3.25]] : [[xf, y + 1.8, .15], [xf, y - 1.8, .15], [xf, y - 1.8, 3.25], [xf, y + 1.8, 3.25]], [[0, 0], [2.25, 0], [2.25, 1.94], [0, 1.94]]);
      }
      const lx = -HX + .92; M.block('lacquer_red', lx + .04, -2.2, 1.6, .06, .5, .34); M.box('gold', [lx + .1, -2.2, 1.77], [.06, .14, .16]); M.sphere('red', [lx + .12, -2.2, 1.62], .07, .5, 6, 3);
      for (const t of [-1, 1]) M.rod('red', [lx + .1, -2.2 - .25 * t, 1.94], [lx + .1, -2.2 + .25 * t, 1.62], .015, 3);
      // the round vault door: its iron ring, the stone filling the square cut round it, the door standing open on its hinge
      const yb = -HY + .03, n = 32, fz = [VD.z - VD.r, VD.z + VD.r];
      for (let k = 0; k < n; k++) { const a0 = k / n * 6.283, a1 = (k + 1) / n * 6.283, p = a => [Math.cos(a) * (VD.r + .12), yb, VD.z + Math.sin(a) * (VD.r + .12)]; if (p(a0)[2] > .05 || p(a1)[2] > .05) M.rod('iron', p(a0), p(a1), .2, 6); }
      const amin = -Math.asin(VD.z / VD.r);
      for (const [cxs, czs, a0, a1] of [[1, 1, 0, Math.PI / 2], [-1, 1, Math.PI / 2, Math.PI], [-1, 0, Math.PI, Math.PI - amin], [1, 0, amin, 0]]) {
        const corner = [cxs * VD.r, yb, czs ? fz[1] : 0], pts = [corner]; for (let k = 0; k <= 10; k++) { const a = a0 + (a1 - a0) * k / 10; pts.push([Math.cos(a) * VD.r, yb, VD.z + Math.sin(a) * VD.r]); } M.poly('stone', pts);
      }
      const dx = VD.r + .05, dyc = -HY + VD.r + .12;
      M.rod('iron', [dx - .3, dyc, VD.z], [dx + .3, dyc, VD.z], VD.r, 32); M.rod('stone_dark', [dx - .32, dyc, VD.z], [dx - .3, dyc, VD.z], VD.r - .45, 32);
      for (let k = 0; k < 16; k++) { const a = k / 16 * 6.283; M.sphere('bronze', [dx - .34, dyc + Math.cos(a) * (VD.r - .22), VD.z + Math.sin(a) * (VD.r - .22)], .09, 1, 6, 3); }
      for (let k = 0; k < 6; k++) { const a = k / 6 * 6.283; M.rod('bronze', [dx - .45, dyc, VD.z], [dx - .45, dyc + Math.cos(a) * .7, VD.z + Math.sin(a) * .7], .05, 4); } M.rod('bronze', [dx - .3, dyc, VD.z], [dx - .55, dyc, VD.z], .14, 8);
      for (const t of [-1, 1]) M.block('iron', VD.r + .1, -HY + .2, VD.z + t * 1.5 - .3, .5, .4, .6);
      // the inner vault
      const iy = -HY - IN[1] / 2;
      M.block('stone', 0, iy, -.3, 2 * IN[0] + 1, IN[1] + .4, .3); M.block('stone', 0, iy, IN[2], 2 * IN[0] + 1, IN[1] + .4, .3);
      for (const s of [-1, 1]) M.block('stone', s * (IN[0] + .25), iy, 0, .5, IN[1] + .4, IN[2]); M.block('stone', 0, -HY - IN[1] - .25, 0, 2 * IN[0] + 1, .5, IN[2]);
      for (const s of [-1, 1]) for (let j = 0; j < 3; j++) { M.block('iron', s * (IN[0] - .4), iy, .1 + j * 1.25, .7, IN[1] - .8, .08); for (let q = 0; q < 3; q++) M.block(q % 2 ? 'lacquer_red' : 'lacquer_black', s * (IN[0] - .4), iy - 1.2 + q * 1.2, .18 + j * 1.25, .55, .8, .55); }
      M.block('stone_dark', 0, -HY - 3, 0, 1.1, .9, 1.3); M.block('lacquer_black', 0, -HY - 3, 1.3, .9, .5, .2); M.quad('paper', [[-.4, -HY - 3.2, 1.51], [.4, -HY - 3.2, 1.51], [.4, -HY - 2.75, 1.51], [-.4, -HY - 2.75, 1.51]]);
      M.rod('gold', [0, -HY - 3, IN[2]], [0, -HY - 3, IN[2] - .9], .02, 3); lanternS(M, 0, -HY - 3, IN[2] - .9, 'andon', .26, .5);
    },
    // the Buke Great Hall (gathering): a canal runs through the hall from wall to wall under two arched footbridges; across the
    // far wall a wall of round shields with the trident, the lord's seat on its low dais before it between braziers; long tables
    // and benches; the roof open to its timber trusses, the clan's banners hanging from the tie beams
    room_buke_great_hall(M) {
      M.room = true;
      const { HX, HY, H, DW, DH, CY, CD, BR, BW, BL, BT: TOP, RIDGE } = BH;
      hall(M, { HX, HY, H, DW, DH, noFloor: true, wall: 'plaster', wain: 'darkwood', wainH: 1.6, rail: 'gold', post: 'darkwood', postEvery: 4, beam: 'darkwood', noCeil: true });
      M.block('darkwood', 0, (CY + HY + 3) / 2, -.3, 2 * HX + .8, HY + 3 - CY, .3); M.block('darkwood', 0, (-CY - HY - .4) / 2, -.3, 2 * HX + .8, HY + .4 - CY, .3);
      for (const s of [-1, 1]) { M.block('stone', 0, s * (CY + .15), -CD - .3, 2 * HX + .8, .3, CD + .3); M.block('stone', 0, s * (CY + .3), 0, 2 * HX, .6, .08); }
      M.block('stone_dark', 0, 0, -CD - .3, 2 * HX + .8, 2 * CY + .6, .3);
      M.quad('water_flow', [[-HX - .4, -CY, -.45], [HX + .4, -CY, -.45], [HX + .4, CY, -.45], [-HX - .4, CY, -.45]], [[0, 0], [2 * HX / 3, 0], [2 * HX / 3, 2 * CY / 3], [0, 2 * CY / 3]]);
      for (const s of [-1, 1]) { const x = s * (HX - .03); M.quad('dark', [[x, -CY, -CD], [x, CY, -CD], [x, CY, 0], [x, -CY, 0]]); for (let k = 0; k < 12; k++) { const a0 = k / 12 * Math.PI, a1 = (k + 1) / 12 * Math.PI; M.rod('stone', [x - s * .08, -Math.cos(a0) * (CY + .3), Math.sin(a0) * (CY + .3) * .8], [x - s * .08, -Math.cos(a1) * (CY + .3), Math.sin(a1) * (CY + .3) * .8], .22, 5); } const arc = [[x - s * .02, -CY, 0]]; for (let k = 0; k <= 12; k++) { const a = k / 12 * Math.PI; arc.push([x - s * .02, -Math.cos(a) * CY, Math.sin(a) * CY * .8]); } M.poly('dark', arc); }
      // the two bridges: plank decks rising to the middle, stringers, red railings with gold caps
      const L = CY + BL;
      for (const bx of BR) {
        for (let k = 0; k < 12; k++) { const y0 = -L + k * 2 * L / 12, y1 = y0 + 2 * L / 12, z0 = TOP * (1 - Math.abs(y0) / L), z1 = TOP * (1 - Math.abs(y1) / L); M.quad('wood', [[bx - BW, y0, z0 + .03], [bx + BW, y0, z0 + .03], [bx + BW, y1, z1 + .03], [bx - BW, y1, z1 + .03]]); M.rod('darkwood', [bx - BW, (y0 + y1) / 2, (z0 + z1) / 2 + .02], [bx + BW, (y0 + y1) / 2, (z0 + z1) / 2 + .02], .03, 3); }
        for (const s of [-1, 1]) { const x = bx + s * BW; M.rod('darkwood', [x, -L, -.15], [x, 0, TOP - .12], .16, 6); M.rod('darkwood', [x, 0, TOP - .12], [x, L, -.15], .16, 6); railK(M, [x, -L + .4, TOP * .4 / L], [x, 0, TOP], 1.3, 'lacquer_red', 'lacquer_red'); railK(M, [x, 0, TOP], [x, L - .4, TOP * .4 / L], 1.3, 'lacquer_red', 'lacquer_red'); for (const y of [-L + .4, 0, L - .4]) M.sphere('gold', [x, y, TOP * (1 - Math.abs(y) / L) + 1.36], .1, 1, 6, 3); }
      }
      // the shield wall, crossed spears behind every other shield; the banners either side
      for (let rr = 0; rr < 3; rr++) for (let c = 0; c < 9; c++) {
        const x = -16 + c * 4, z = 3.2 + rr * 2.9, y = -HY + .12;
        if ((rr + c) % 2) for (const t of [-1, 1]) { M.rod('darkwood', [x - 1.7 * t, y + .03, z - 1.5], [x + 1.7 * t, y + .03, z + 1.5], .045, 4); M.box('iron', [x + 1.75 * t, y + .03, z + 1.55], [.08, .06, .4], 0, 0, -t * .85); }
        M.rod('lacquer_red', [x, y + .05, z], [x, y + .17, z], .95, 22); M.tube('gold', [x, y + .1, z], [x, y + .2, z], 1, 1, 22, false); M.cyl('gold', [x, y + .2, z], .14, .02, 8);
        M.quad('mark_buke', [[x + .62, y + .185, z - .62], [x - .62, y + .185, z - .62], [x - .62, y + .185, z + .62], [x + .62, y + .185, z + .62]]);
      }
      for (const s of [-1, 1]) { wallArt(M, 'back', s * 19.6, 1.2, 2.6, 7.4, 'banner_buke', HX, HY, .1); }
      // the lord's seat on its dais, braziers
      M.block('stone', 0, -12.2, 0, 10, 3.6, .5); M.block('darkwood', 0, -12.2, .5, 10, 3.6, .06); chairAt(M, 0, -12.4, Math.PI / 2, 'lacquer_black', 'lacquer_red', .56);
      for (const s of [-1, 1]) { const x = s * 6.2, y = -9.2; for (let k = 0; k < 3; k++) { const a = k / 3 * 6.283; M.rod('iron', [x + Math.cos(a) * .5, y + Math.sin(a) * .5, 0], [x, y, 1.1], .05, 4); } M.cyl('iron', [x, y, 1.05], .6, .35, 12, .75); flame(M, x, y, 1.38, .8); }
      // long tables and benches
      for (const s of [-1, 1]) { const x = s * 12, y = -7; M.block('darkwood', x, y, 1.3, 9, 1.6, .12); for (const dx of [-4, 0, 4]) for (const t of [-1, 1]) M.block('darkwood', x + dx, y + t * .6, 0, .22, .22, 1.3); for (const t of [-1, 1]) { M.block('darkwood', x, y + t * 1.1, .7, 9, .5, .1); for (const dx of [-4, 0, 4]) M.block('darkwood', x + dx, y + t * 1.1, 0, .18, .4, .7); }
        for (let k = 0; k < 6; k++) { M.cyl('bronze', [x - 3.8 + k * 1.5, y + (k % 2 ? .35 : -.35), 1.42], .12, .2, 8, .1); } }
      // the roof: two slopes of boards up to the ridge, the gables, trusses every four metres, banners from the tie beams
      for (const s of [-1, 1]) { const span = Math.hypot(HX + .2, RIDGE - H); M.quad('darkwood', [[s * (HX + .2), -HY - .4, H], [0, -HY - .4, RIDGE], [0, HY + .4, RIDGE], [s * (HX + .2), HY + .4, H]], [[0, 0], [span / 1.6, 0], [span / 1.6, (2 * HY + .8) / 1.6], [0, (2 * HY + .8) / 1.6]]); }
      for (const y of [-HY - .2, HY + .2]) M.poly('plaster', [[-HX - .4, y, H + .4], [HX + .4, y, H + .4], [0, y, RIDGE + .3]]);
      for (let y = -12; y <= 12.01; y += 4) {
        M.box('darkwood', [0, y, H - 1.8], [2 * HX, .5, .6]); M.block('darkwood', 0, y, H - 1.5, .5, .5, RIDGE - H + 1.4);
        for (const s of [-1, 1]) { M.rod('darkwood', [s * HX, y, H - .2], [0, y, RIDGE - .1], .26, 6); M.rod('darkwood', [0, y, H - .9], [s * HX / 2, y, (H + RIDGE) / 2 - .3], .18, 5); }
        if (y !== 0) for (const s of [-1, 1]) { const x = s * 10.5; M.quad('banner_buke', [[x - .8, y + .3, H - 6.2], [x + .8, y + .3, H - 6.2], [x + .8, y + .3, H - 2.1], [x - .8, y + .3, H - 2.1]]); M.rod('darkwood', [x - 1, y + .3, H - 2.05], [x + 1, y + .3, H - 2.05], .05, 4); }
      }
      for (const s of [-1, 1]) for (const f of [.33, .66]) { const x = s * HX * (1 - f), z = H + (RIDGE - H) * f - .25; M.rod('darkwood', [x, -HY, z], [x, HY, z], .14, 5); }
      for (const [x, y] of [[-18, 11.5], [18, 11.5], [-18, 5], [18, 5]]) andon(M, x, y, 0, 1.3);
    },
    // the Buke Cliff Tunnels (explore): the engineers' tunnels cut into the canyon wall, square-cut rock shored with timber every
    // three metres, cart rails along the floor and a loaded cart, lamps on the caps, windows cut through to the canyon with the
    // daylight falling in; at the end the lift chamber, its shaft open to the sky, the cage, the winch, the great pulley
    room_buke_tunnels(M) {
      M.room = true;
      const { TH, SEG, LIFT, SH } = BT;
      M.block('rock_tan', -14, -11, -.3, 36, 68, .3);
      for (const [x0, y0, x1, y1] of SEG) M.block('rock_tan', (x0 + x1) / 2, (y0 + y1) / 2, TH, x1 - x0, y1 - y0, .6);
      // the walls round the outline of the tunnels (the door gap at the near end, the windows in the west wall of the last run)
      const wall = (a, b, h = TH) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]), ang = Math.atan2(b[1] - a[1], b[0] - a[0]); M.box('rock_tan', [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, h / 2], [L + .5, .5, h], ang); };
      const win = [-9, -16, -23];
      wall([3, 21], [3, -5]); wall([3, -5], [-23, -5]); wall([-23, -5], [-23, -33]); wall([-23, -33], [-21, -33], SH); wall([-21, -33], [-21, -43], SH); wall([-21, -43], [-31, -43], SH); wall([-31, -43], [-31, -33], SH); wall([-31, -33], [-29, -33], SH);
      let yy = -33; for (const w of win) { wall([-29, yy], [-29, w - 1.6]); M.box('rock_tan', [-29, w, .8], [.5, 3.2, 1.6]); M.box('rock_tan', [-29, w, (TH + 3.6) / 2], [.5, 3.2, TH - 3.6]); yy = w + 1.6; } wall([-29, yy], [-29, 1]);
      wall([-29, 1], [-3, 1]); wall([-3, 1], [-3, 21]);
      for (const t of [-1, 1]) M.block('rock_tan', t * 2.45, 21.2, 0, 1.1, .6, TH); M.block('rock_tan', 0, 21.2, 4.2, 6, .6, TH - 4.2);
      M.quad('doorview', [[-1.9, 21.45, 0], [1.9, 21.45, 0], [1.9, 21.45, 4.2], [-1.9, 21.45, 4.2]]); for (const t of [-1, 1]) M.block('darkwood', t * 2, 20.85, 0, .3, .3, 4.3); M.block('darkwood', 0, 20.85, 4.2, 4.3, .3, .3);
      for (const w of win) { M.quad('canyon_view', [[-29.6, w + 1.5, 1.6], [-29.6, w - 1.5, 1.6], [-29.6, w - 1.5, 3.6], [-29.6, w + 1.5, 3.6]], [[(w + 24) / 30, 0], [(w + 27) / 30, 0], [(w + 27) / 30, 1], [(w + 24) / 30, 1]]); M.quad('shaft_sun', [[-25, w + 2, .05], [-25, w - 2, .05], [-28.8, w - 1.4, 3.5], [-28.8, w + 1.4, 3.5]]); }
      // timber shoring every three metres; a lamp on every third cap
      const shore = (x, y, along) => { const o = 2.75; if (along === 'y') { for (const t of [-1, 1]) M.block('darkwood', x + t * o, y, 0, .32, .32, TH - .1); M.block('darkwood', x, y, TH - .45, 2 * o + .32, .36, .36); } else { for (const t of [-1, 1]) M.block('darkwood', x, y + t * o, 0, .32, .32, TH - .1); M.block('darkwood', x, y, TH - .45, .36, 2 * o + .32, .36); } };
      let li = 0; const lamp = (x, y) => { if (li++ % 3 === 1) lanternS(M, x, y, TH - .45, 'lantern', .28, .55); };
      for (let y = 19; y > 1.5; y -= 3) { shore(0, y, 'y'); lamp(0, y); } for (let x = -5; x > -21.5; x -= 3) { shore(x, -2, 'x'); lamp(x, -2); } for (let y = -7; y > -31.5; y -= 3) { shore(-26, y, 'y'); lamp(-26, y); }
      // cart rails (curving round the corners), sleepers, the cart
      const rp = [[0, 20]]; for (let k = 0; k <= 8; k++) { const t = k / 8 * Math.PI / 2; rp.push([-3 + 3 * Math.cos(t), 1 - 3 * Math.sin(t)]); } for (let k = 0; k <= 8; k++) { const t = k / 8 * Math.PI / 2; rp.push([-23 - 3 * Math.sin(t), -5 + 3 * Math.cos(t)]); } rp.push([-26, -36]);
      let acc = 0;
      for (let i = 0; i + 1 < rp.length; i++) { const [ax, ay] = rp[i], [bx, by] = rp[i + 1], L = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / L * .45, ny = (bx - ax) / L * .45;
        for (const t of [-1, 1]) M.rod('iron', [ax + nx * t, ay + ny * t, .14], [bx + nx * t, by + ny * t, .14], .05, 4);
        for (let d = (.8 - acc % .8); d < L; d += .8) { const f = d / L; M.box('darkwood', [ax + (bx - ax) * f, ay + (by - ay) * f, .05], [.25, 1.4, .1], Math.atan2(by - ay, bx - ax)); } acc += L; }
      M.block('wood', -5.2, -2, .35, 1.8, 1.3, 1); M.block('darkwood', -5.2, -2, 1.3, 1.9, 1.4, .1); for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) M.rod('iron', [-5.2 + a * .6, -2 + b * .5, .35], [-5.2 + a * .6, -2 + b * .62, .35], .25, 10);
      for (let k = 0; k < 7; k++) M.sphere('rock_tan', [-5.2 + (k % 3 - 1) * .45, -2 + (k > 3 ? .25 : -.25), 1.45], .32, .8, 8, 4);
      // the lift chamber: the shaft to the sky, the cage on the floor, the great pulley, the winch, the counterweight
      const [lx0, ly0, lx1, ly1] = LIFT; M.block('rock_tan', (lx0 + lx1) / 2, (ly0 + ly1) / 2, SH, lx1 - lx0 + 1, ly1 - ly0 + 1, .5); M.quad('skyhole', [[-28, -40, SH - .05], [-24, -40, SH - .05], [-24, -36, SH - .05], [-28, -36, SH - .05]]);
      M.block('darkwood', -26, -38, 0, 4, 4, .3); for (const [x, y] of [[-28, -40], [-24, -40], [-28, -36], [-24, -36]]) M.block('darkwood', x, y, 0, .3, .3, 3.6); for (const y of [-40, -36]) M.block('darkwood', -26, y, 3.6, 4.3, .3, .3);
      for (const x of [-27.2, -24.8]) M.rod('rope', [x, -38, 3.9], [x, -38, SH - 2.8], .05, 4);
      M.block('darkwood', -26, -38, SH - 2, 6, .6, .5); M.rod('iron', [-26, -38, SH - 2.8], [-21.9, -42, SH - 2.8], .04, 3); M.rod('rope', [-22.2, -42, SH - 2.8], [-22.2, -42, 6.5], .05, 4); M.block('stone', -22.2, -42, 4.6, 1.1, 1.1, 1.9);
      M.rod('rope', [-28.6, -41.5, 1.4], [-26, -38, SH - 2.8], .045, 4);
      M.block('darkwood', -29.5, -41.5, 0, 2.2, 2.2, .3); for (const t of [-1, 1]) M.block('darkwood', -29.5 + t * .9, -41.5, .3, .25, .4, 1.6);
    },
    // a wheel and gears for the workshop (spinning parts)
    room_buke_waterwheel(M) {
      M.room = true; const R = EW.WR, w = 1.2;
      for (const x of [-w / 2, w / 2]) for (let k = 0; k < 32; k++) { const a0 = k / 32 * 6.283, a1 = (k + 1) / 32 * 6.283; M.rod('darkwood', [x, Math.cos(a0) * R, Math.sin(a0) * R], [x, Math.cos(a1) * R, Math.sin(a1) * R], .12, 5); M.rod('darkwood', [x, Math.cos(a0) * (R - .7), Math.sin(a0) * (R - .7)], [x, Math.cos(a1) * (R - .7), Math.sin(a1) * (R - .7)], .09, 5); }
      for (let k = 0; k < 16; k++) { const a = k / 16 * 6.283; M.box('wood', [0, Math.cos(a) * (R - .32), Math.sin(a) * (R - .32)], [w + .1, .72, .1], 0, a); }
      for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283; for (const x of [-w / 2, w / 2]) M.rod('darkwood', [x, 0, 0], [x, Math.cos(a) * (R - .7), Math.sin(a) * (R - .7)], .1, 5); }
      M.rod('iron', [-w / 2 - .3, 0, 0], [w / 2 + .3, 0, 0], .32, 10);
    },
    room_buke_gear_18(M) { M.room = true; gearK(M, 1.8, 24, .36); },
    room_buke_gear_12(M) { M.room = true; gearK(M, 1.2, 16, .36); },
    room_buke_gear_14(M) { M.room = true; gearK(M, 1.4, 18, .3); },
    room_buke_gear_08(M) { M.room = true; gearK(M, .8, 10, .3); },
    room_buke_grindstone(M) { M.room = true; M.rod('stone', [-.22, 0, 0], [.22, 0, 0], .85, 24); M.rod('iron', [-.6, 0, 0], [.6, 0, 0], .08, 6); M.rod('darkwood', [.22, 0, 0], [.4, 0, 0], .3, 10); },
    room_buke_saw(M) { M.room = true; M.rod('iron', [-.02, 0, 0], [.02, 0, 0], .75, 32); for (let k = 0; k < 32; k++) { const a = k / 32 * 6.283; M.box('iron', [0, Math.cos(a) * .78, Math.sin(a) * .78], [.04, .08, .08], 0, a + .5); } M.rod('iron', [-.35, 0, 0], [.35, 0, 0], .06, 6); },
    // the Buke Engineer Workshop (training): a waterwheel turns beyond the left wall's great opening, its axle driving a train of
    // wooden gears up to the line shaft under the roof and along it, belts down to a grindstone and a saw; bridge models on the
    // long table, one loaded on the stress rig with its weight hanging; drafting tables with blueprints, the theodolite
    room_buke_workshop(M) {
      M.room = true;
      const { HX, HY, H, DW, DH, WY, WZ, GZ } = EW;
      hall(M, { HX, HY, H, DW, DH, floor: 'wood', wall: 'plaster', wain: 'olive', wainH: 1.2, rail: 'brass', post: 'darkwood', postEvery: 4.4, beam: 'darkwood', ceil: 'darkwood', ceilBeam: 'darkwood', ceilEvery: 2.75, leftOpen: [WY - 4.2, WY + 4.2, 0, 8] });
      // outside the opening: the wheel pit, the race of water, the canyon beyond
      const ox = -HX - .4; M.block('stone', ox - 2.2, WY, -1.2, 4.6, 8.8, 1.2);
      M.quad('water_flow', [[ox - 4.2, WY - 4.2, .15], [ox, WY - 4.2, .15], [ox, WY + 4.2, .15], [ox - 4.2, WY + 4.2, .15]], [[0, 0], [1.4, 0], [1.4, 2.8], [0, 2.8]]);
      for (const s of [-1, 1]) M.block('stone', ox - 2.2, WY + s * 4.45, 0, 4.6, .5, 8.4);
      M.quad('canyon_view', [[ox - 4.5, WY - 4.2, 0], [ox - 4.5, WY + 4.2, 0], [ox - 4.5, WY + 4.2, 8.4], [ox - 4.5, WY - 4.2, 8.4]]); M.block('stone', ox - 2.2, WY, 8.4, 4.6, 9, .4);
      // the axle through the wall, its frame, the line shaft and its hangers, the belts
      M.rod('iron', [-16.2, WY, WZ], [-10.3, WY, WZ], .2, 8); for (const x of [-13.2, -10.3]) { M.block('darkwood', x, WY, 0, .5, 1.6, WZ - .25); M.block('darkwood', x, WY, WZ - .3, .6, .9, .3); }
      M.rod('iron', [-10.9, WY, GZ], [9.4, WY, GZ], .14, 8); for (const x of [-6, 3.5]) { M.block('darkwood', x, WY, GZ + .2, .3, .3, H - GZ - .2); M.block('darkwood', x, WY, GZ - .2, .5, .6, .4); }
      for (const x of [-1, 8]) { for (const t of [-1, 1]) M.box('rope', [x + .45, WY + t * .55, (GZ - 2.2 + 1.5) / 2], [.12, .02, GZ - 2.2 - 1.5]); }
      // the grindstone and the saw bench under the belts
      M.block('darkwood', -1, WY, 0, 1.8, 1.4, .7); M.block('wood', -1, WY, .7, 1.6, .5, .3); M.block('water', -1, WY, .95, 1.4, .4, .05);
      M.block('darkwood', 8, WY, 0, 2, 1.6, 1.2); M.block('wood', 8, WY, 1.2, 2.2, 1.8, .1);
      // the long table: bridge models, the stress rig at its end with its weight
      const ty = 2.8; M.block('darkwood', 1, ty, 1.3, 10, 2.4, .12); for (const [dx, t] of [[-4.6, -1], [4.6, -1], [-4.6, 1], [4.6, 1], [0, -1], [0, 1]]) M.block('darkwood', 1 + dx, ty + t * 1, 0, .2, .2, 1.3);
      const truss = (x0, y, z, L, h) => { for (const zz of [z, z + h]) M.rod('wood', [x0, y, zz], [x0 + L, y, zz], .03, 4); const n = 6; for (let k = 0; k <= n; k++) { const x = x0 + k * L / n; M.rod('wood', [x, y, z], [x, y, z + h], .02, 3); if (k < n) M.rod('wood', [x, y, k % 2 ? z : z + h], [x + L / n, y, k % 2 ? z + h : z], .018, 3); } };
      for (const dy of [-.35, .35]) truss(-3.4, ty + dy, 1.45, 2.6, .4);
      for (let k = 0; k <= 10; k++) { const a = k / 10 * Math.PI; if (k < 10) M.rod('wood', [-.2 + 2.6 * k / 10, ty, 1.45 + Math.sin(a) * .7], [-.2 + 2.6 * (k + 1) / 10, ty, 1.45 + Math.sin((k + 1) / 10 * Math.PI) * .7], .035, 4); M.rod('wood', [-.2 + 2.6 * k / 10, ty, 1.45], [-.2 + 2.6 * k / 10, ty, 1.45 + Math.sin(a) * .7], .015, 3); } M.rod('wood', [-.2, ty, 1.45], [2.4, ty, 1.45], .03, 4);
      for (const x of [3.4, 5.6]) M.block('darkwood', x, ty, 1.42, .3, .9, .6); for (const dy of [-.3, .3]) { M.rod('wood', [3.4, ty + dy, 2.02], [4.5, ty + dy, 1.9], .03, 4); M.rod('wood', [4.5, ty + dy, 1.9], [5.6, ty + dy, 2.02], .03, 4); }
      M.rod('rope', [4.5, ty, 1.88], [4.5, ty, 1.5], .015, 3); M.block('stone', 4.5, ty, 1.0, .4, .4, .5); M.block('darkwood', 4.5, ty + .9, 1.42, .6, .2, .9);
      // the drafting tables: tilted boards with blueprints, stools, lamps
      for (const [x, y, f] of [[5.5, 7.6, 1], [10.5, 7.6, 1], [5.5, -8.4, -1], [10.5, -8.4, -1]]) {
        for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) M.block('darkwood', x + a * 1.1, y + b * .8, 0, .14, .14, 1.4 + (b * f > 0 ? .4 : 0));
        const yn = y - f * .9, yf = y + f * .9; M.quad('blueprint', [[x - 1.2, yn, 1.45], [x + 1.2, yn, 1.45], [x + 1.2, yf, 1.95], [x - 1.2, yf, 1.95]]); M.rod('brass', [x - 1.15, yn, 1.47], [x + 1.15, yn, 1.47], .03, 4);
        M.cyl('darkwood', [x, y - f * 1.8, 0], .32, .9, 10); M.rod('brass', [x + 1, yf, 1.95], [x + 1, yf, 2.6], .02, 3); M.cyl('brass', [x + 1, yf - f * .2, 2.55], .16, .2, 8, .05);
      }
      // drawings on the back wall, a barrel of rolled plans, the theodolite on its tripod
      wallArt(M, 'back', 4, 2.2, 7, 4.2, 'blueprint', HX, HY, .08); M.block('darkwood', 4, -HY + .1, 6.4, 7.4, .1, .12);
      M.cyl('wood', [11.6, -9.6, 0], .5, 1.3, 12, .45); for (let k = 0; k < 7; k++) M.rod(k % 2 ? 'paper' : 'blueprint', [11.6 + (k % 3 - 1) * .2, -9.6 + (k > 3 ? .15 : -.15), .6], [11.6 + (k % 3 - 1) * .24, -9.6 + (k > 3 ? .18 : -.18), 1.9], .07, 6);
      for (let k = 0; k < 3; k++) { const a = k / 3 * 6.283; M.rod('darkwood', [12.5, 2.3, 2.2], [12.5 + Math.cos(a) * .6, 2.3 + Math.sin(a) * .6, 0], .035, 4); } M.cyl('brass', [12.5, 2.3, 2.2], .14, .25, 8); M.rod('brass', [12.2, 2.3, 2.55], [12.8, 2.3, 2.6], .08, 8);
      for (const [x, y] of [[-12.4, 9.4], [12.6, 9.4]]) andon(M, x, y, 0, 1.25);
    }
  });
  // ── Ashigaru and Kenshi rooms ──
  // a village piece drawn into a room at (x, y, z), turned by a about z (kit coordinates): its builder's polygons moved on the way in
  function piece(M, type, x, y, z = 0, a = 0) {
    const c = Math.cos(a), s = Math.sin(a), R = p => [x + p[0] * c - p[1] * s, y + p[0] * s + p[1] * c, z + p[2]], N = n => [n[0] * c - n[1] * s, n[0] * s + n[1] * c, n[2]];
    const poly = M.poly; M.poly = (m, pts, uvs, nrm) => poly.call(M, m, pts.map(R), uvs, nrm && N(nrm));
    try { B[type](M); } finally { M.poly = poly; }
  }
  // a disc in a plane: centre c, axes u, v (unit), radius r, n segments; uv polar (the texture's centre at the disc's centre)
  function discK(M, mat, c, u, v, r, n = 32) {
    const pts = [], uv = []; for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a); pts.push([c[0] + r * (ca * u[0] + sa * v[0]), c[1] + r * (ca * u[1] + sa * v[1]), c[2] + r * (ca * u[2] + sa * v[2])]); uv.push([.5 + .5 * ca, .5 + .5 * sa]); }
    M.poly(mat, pts, uv);
  }
  // a wooden kata mannequin on its plinth, facing +y, in one of four sword forms (high, middle, low guard, thrust)
  function mannequin(M, x, y, form) {
    M.block('stone', x, y, 0, 1.3, 1.3, .35); const z = .35, P = (dx, dy, dz) => [x + dx, y + dy, z + dz];
    for (const t of [-1, 1]) { M.rod('wood', P(t * .22, 0, 1.55), P(t * .32, .15 * (form === 3 ? -t : 0), .8), .1, 6); M.rod('wood', P(t * .32, .15 * (form === 3 ? -t : 0), .8), P(t * .3, .1, 0), .09, 6); M.sphere('darkwood', P(t * .32, .15 * (form === 3 ? -t : 0), .8), .11, 1, 6, 3); }
    M.box('wood', P(0, 0, 2.1), [.6, .32, 1.1]); M.sphere('wood', P(0, .02, 2.95), .26, 1.15, 10, 5); M.cyl('darkwood', P(0, 0, 2.62), .09, .14, 6);
    const hand = [P(0, .55, 3.1), P(0, .6, 2.15), P(0, .62, 1.5), P(.1, .75, 2.2)][form], tip = [P(0, -.1, 4.4), P(0, 1.7, 2.6), P(0, 1.4, .6), P(.15, 2.2, 2.25)][form];
    for (const t of [-1, 1]) { M.rod('wood', P(t * .36, 0, 2.55), [(P(t * .36, 0, 2.55)[0] + hand[0]) / 2 + t * .12, (P(0, 0, 0)[1] + hand[1]) / 2 + .1, (2.55 + z + hand[2]) / 2], .07, 5); M.rod('wood', [(P(t * .36, 0, 2.55)[0] + hand[0]) / 2 + t * .12, (P(0, 0, 0)[1] + hand[1]) / 2 + .1, (2.55 + z + hand[2]) / 2], [hand[0] + t * .06, hand[1], hand[2]], .065, 5); }
    M.rod('wood', hand, tip, .045, 6); M.rod('darkwood', hand, [hand[0] + (hand[0] - tip[0]) * .18, hand[1] + (hand[1] - tip[1]) * .18, hand[2] + (hand[2] - tip[2]) * .18], .05, 6);
  }
  Object.assign(B, {
    // the Ashigaru Workshop (craft): two logs in their cradles, the two-man saw halfway through one, sawdust under them;
    // sawhorses and planks, the long bench and its tools, the pile of sharpened palisade stakes, spear shafts drying on the high
    // rack; the forest through the great doors pushed open in the right wall
    room_ashi_workshop(M) {
      M.room = true;
      const { HX, HY, H, DW, DH, FD } = AW;
      hall(M, { HX, HY, H, DW, DH, floor: 'earth', wall: 'wood', post: 'darkwood', postEvery: 4, beam: 'darkwood', ceil: 'wood', ceilBeam: 'darkwood', ceilEvery: 2.5, rightOpen: [FD[0], FD[1], 0, 6] });
      M.quad('forestview', [[HX + 3, FD[1] + 1, -.1], [HX + 3, FD[0] - 1, -.1], [HX + 3, FD[0] - 1, 6.6], [HX + 3, FD[1] + 1, 6.6]]); M.block('earth', HX + 1.6, (FD[0] + FD[1]) / 2, -.3, 3.2, FD[1] - FD[0] + 2, .3);
      for (const [y, w] of [[FD[0] - 1.6, 2.6], [FD[1] + 1.6, 2.6]]) M.block('wood', HX - .45, y, 0, .3, w, 6.1); M.block('darkwood', HX - .3, (FD[0] + FD[1]) / 2, 6, .6, FD[1] - FD[0] + 6, .3);
      let sd = 101; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
      for (let k = 0; k < 9; k++) { const x = -8 + r() * 14, y = -8 + r() * 15, w = 1 + r() * 2; M.quad('sawdust', [[x - w, y - w * .6, .012], [x + w, y - w * .5, .012], [x + w * .8, y + w * .6, .012], [x - w * .9, y + w * .5, .012]]); }
      // the log cradles, the logs, the saw
      for (const y of [-4, 2]) {
        for (const x of [-8.4, -3.6]) for (const t of [-1, 1]) M.rod('darkwood', [x, y - t * .9, 0], [x, y + t * .55, 1.7], .1, 5);
        M.rod('bark', [-9.2, y, 1.45], [-2.8, y, 1.45], .62, 12); for (const x of [-9.25, -2.75]) M.rod('wood', [x, y, 1.45], [x + (x < -5 ? -.02 : .02), y, 1.45], .58, 12);
      }
      M.box('iron', [-6, -4, 1.25], [.02, 2.6, .34]); for (const t of [-1, 1]) M.rod('wood', [-6, -4 + t * 1.3, 1.25], [-6, -4 + t * 1.3, 2.3], .05, 5);
      for (let k = 0; k < 14; k++) M.sphere('sawdust', [-6 + (r() - .5) * .9, -4 + (r() - .5) * 1.4, 0], .18 + .1 * r(), .4, 6, 3);
      // sawhorses with planks, the long bench and the tool rack, the shaving horse
      for (const x of [1.4, 5.6]) { for (const t of [-1, 1]) for (const s of [-1, 1]) M.rod('darkwood', [x + t * .4, -6 + s * .5, 0], [x, -6 + s * .35, 1.1], .06, 4); M.box('wood', [x, -6, 1.12], [.2, 1.2, .14]); }
      for (const dz of [0, .08]) M.box('wood', [3.5, -6 + dz * 3, 1.24 + dz], [5.4, .5, .08]);
      M.block('darkwood', 4, -HY + .75, 0, 7, 1.3, 1.3); M.block('wood', 4, -HY + .75, 1.3, 7.2, 1.4, .1);
      for (let k = 0; k < 6; k++) { const x = 1 + k * 1.1; M.rod('wood', [x, -HY + .6, 1.42], [x + .4, -HY + .9, 1.42], .04, 4); M.cyl('darkwood', [x + .45, -HY + .92, 1.36], .12, .14, 8); }
      M.block('darkwood', 4, -HY + .1, 2.2, 6.4, .12, 2.2); for (let k = 0; k < 12; k++) { const x = 1.3 + (k % 6) * 1.05, z = 2.6 + (k > 5 ? 1.1 : 0); M.rod('iron', [x, -HY + .2, z + .6], [x, -HY + .24, z], .03, 4); M.block(k % 3 ? 'wood' : 'iron', x, -HY + .26, z - .3, .12, .06, .34); }
      M.block('darkwood', 6, 4, .6, .6, 1.8, .14); for (const t of [-1, 1]) M.rod('darkwood', [6, 4 + t * .7, 0], [6, 4 + t * .5, .6], .06, 4); M.box('wood', [6, 3.5, 1.05], [.5, .3, .7], 0, .5);
      // the stake pile, the spear shafts drying on the high rack along the left wall
      for (let lay = 0; lay < 3; lay++) for (let i = 0; i < 9 - lay * 2; i++) { const x = -10.2 + lay * .5 + i * .55, z = .16 + lay * .28; M.rod('wood', [x, 5.4, z], [x, 8.2, z], .15, 6); M.cyl('wood', [x, 8.2, z], .15, 0, 6, .01); M.rod('wood', [x, 8.2, z], [x, 8.75, z], .15, 6, 0); M.tube('wood', [x, 8.2, z], [x, 8.8, z], .15, .01, 6, false); }
      for (const z of [4, 4.7]) for (const y of [-6, 0, 6]) { M.block('darkwood', -HX + .5, y, z - .3, .9, .2, .14); } for (const z of [4, 4.7]) M.rod('darkwood', [-HX + .9, -7, z], [-HX + .9, 7, z], .07, 5);
      for (let k = 0; k < 18; k++) { const x = -HX + .25 + (k % 4) * .2, z = 4.15 + (k % 2) * .7; M.rod(k % 5 ? 'wood' : 'bark', [x, -7.6, z], [x, 7.6, z], .05, 5); }
      for (let k = 0; k < 5; k++) M.rod('wood', [-HX + .3, -2 + k * .6, 0], [-HX + .5, -1.6 + k * .6, 5.2], .05, 5);
      for (const [x, y] of [[-11.6, 8.6], [11.6, 8.6], [11.6, -8.6]]) andon(M, x, y, 0, 1.2);
    },
    // the Ashigaru Seed Archive (lore): a low thatched hall. Shelves of clay pots with sprouts in them along both walls, seed
    // drawers beneath; the rice-planting calendar wheel on the back wall between the scroll banners; sheaves of rice hung from the
    // thatch; seed trays on the table in the middle, sacks of seed by the door, the rice mortar
    room_ashi_archive(M) {
      M.room = true;
      const { HX, HY, H, DW, DH, RIDGE } = AA;
      hall(M, { HX, HY, H, DW, DH, floor: 'earth', wall: 'plaster_old', wain: 'darkwood', wainH: 1, rail: 'wood', post: 'darkwood', postEvery: 3, beam: 'darkwood', noCeil: true });
      // the thatch: two slopes, rafters, purlins, the ridge beam, the gables
      for (const s of [-1, 1]) { const span = Math.hypot(HX + .3, RIDGE - H); M.quad('thatch', [[s * (HX + .3), -HY - .3, H], [0, -HY - .3, RIDGE], [0, HY + .3, RIDGE], [s * (HX + .3), HY + .3, H]], [[0, 0], [span / 2, 0], [span / 2, (2 * HY + .6) / 1.6], [0, (2 * HY + .6) / 1.6]]); }
      for (const y of [-HY - .2, HY + .2]) M.poly('plaster_old', [[-HX - .4, y, H + .3], [HX + .4, y, H + .3], [0, y, RIDGE + .2]]);
      for (let y = -HY + .6; y < HY; y += 1.5) for (const s of [-1, 1]) M.rod('bark', [s * HX, y, H - .1], [0, y, RIDGE - .15], .1, 5);
      M.rod('darkwood', [0, -HY, RIDGE - .3], [0, HY, RIDGE - .3], .22, 6); for (const s of [-1, 1]) for (const f of [.35, .7]) M.rod('bark', [s * HX * (1 - f), -HY, H + (RIDGE - H) * f - .2], [s * HX * (1 - f), HY, H + (RIDGE - H) * f - .2], .12, 5);
      for (const s of [-1, 1]) M.box('darkwood', [s * 4.5, 0, 6.5], [.2, 2 * HY, .3]);
      let sd = 111; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
      for (const s of [-1, 1]) for (let y = -7.5; y <= 7.6; y += 1.2) { const x = s * 4.5 + (r() - .5) * .3, z = 6.4 - .6 * r(); M.rod('rope', [x, y, 6.5], [x, y, z], .015, 3); M.tube('straw', [x, y, z], [x, y, z - 1.2], .12, .38, 8, true); M.cyl('rope', [x, y, z - .25], .14, .06, 8); }
      // the pot shelves and the seed drawers along both side walls
      for (const s of [-1, 1]) {
        const x = s * (HX - .45), xf = s * (HX - .9);
        M.block('darkwood', x, 0, 0, .9, 16.4, 1); M.quad('drawers_seed', s < 0 ? [[xf, -8.1, .08], [xf, 8.1, .08], [xf, 8.1, .92], [xf, -8.1, .92]] : [[xf, 8.1, .08], [xf, -8.1, .08], [xf, -8.1, .92], [xf, 8.1, .92]], [[0, 0], [16.2 / 1.6, 0], [16.2 / 1.6, .52], [0, .52]]);
        for (const z of [1.9, 2.9, 3.85]) { M.block('wood', x, 0, z - .08, .9, 16.4, .08); for (let y = -7.6; y <= 7.7; y += .7) { const px = x - s * .05, h = .28 + .06 * r(); M.cyl('clay', [px, y, z], .2, h, 10, .24); M.cyl('earth', [px, y, z + h - .01], .2, .02, 10); if (r() < .85) for (let q = 0; q < 3; q++) M.rod('sprout', [px, y, z + h], [px + (r() - .5) * .25, y + (r() - .5) * .25, z + h + .18 + .2 * r()], .03, 3); } }
        for (let y = -8; y <= 8.01; y += 4) M.block('darkwood', x, y, 0, .95, .14, 4.2);
      }
      // the calendar wheel on the back wall, the scroll banners either side
      discK(M, 'rice_wheel', [0, -HY + .2, 2.6], [-1, 0, 0], [0, 0, 1], 1.9, 48); M.tube('darkwood', [0, -HY + .12, 2.6], [0, -HY + .28, 2.6], 1.98, 1.98, 48, false);
      M.rod('darkwood', [0, -HY + .1, 2.6], [0, -HY + .36, 2.6], .14, 10); M.box('gold', [.2, -HY + .3, 3.5], [.08, .03, 1.7], .2);
      for (const s of [-1, 1]) wallArt(M, 'back', s * 4, .9, 1.6, 3.2, 'banner_ashi_scroll', HX, HY, .1);
      // the seed table and its trays
      M.block('darkwood', 0, 0, 0, 4.2, 2.2, 1.2); M.block('wood', 0, 0, 1.2, 4.4, 2.4, .08);
      for (const [tx, ty] of [[-1.2, -.5], [1.1, -.5], [-1.2, .55], [1.1, .55]]) { M.block('wood', tx, ty, 1.28, 1.6, .9, .12); M.block('earth', tx, ty, 1.36, 1.5, .8, .03); for (let i = 0; i < 6; i++) for (let jj = 0; jj < 3; jj++) M.rod('sprout', [tx - .62 + i * .25, ty - .25 + jj * .25, 1.39], [tx - .62 + i * .25 + .04, ty - .25 + jj * .25, 1.52 + .05 * r()], .02, 3); }
      lanternS(M, 0, 0, 5.4, 'andon', .32, .6); M.rod('rope', [0, 0, 6.4], [0, 0, 5.4], .015, 3);
      // sacks by the door, the rice mortar and its pounder
      for (let k = 0; k < 7; k++) M.sphere('sack', [-7.6 + (k % 3) * .9, 7.2 + (k > 2 ? .9 : 0) + (k > 5 ? -.45 : 0), .55 + (k > 5 ? .8 : 0)], .55, .78, 8, 4);
      M.cyl('wood', [6.4, 6.8, 0], .65, .85, 12, .55); M.cyl('dark', [6.4, 6.8, .84], .45, .02, 12); M.rod('wood', [6.4, 6.8, .9], [6.6, 6.5, 2.6], .08, 6); M.cyl('wood', [6.6, 6.5, 2.4], .2, .5, 8);
    },
    // the Ashigaru Dojo (training): an earth-floored obstacle course. Two balance logs on trestles (stumps to step up), climbing
    // ropes from the rafters, the crawl net, the mud pit in its log border, the climbing wall, straw targets along the back
    room_ashi_dojo(M) {
      M.room = true;
      const { HX, HY, H, DW, DH, LH, LOGS, NET, MUD, WALL } = OC;
      hall(M, { HX, HY, H, DW, DH, floor: 'earth', wall: 'wood', wain: 'darkwood', wainH: 1.2, rail: 'wood', post: 'darkwood', postEvery: 4, beam: 'darkwood', ceil: 'wood', ceilBeam: 'darkwood', ceilEvery: 3.5 });
      // the balance logs: a log on trestles, a stump at each end
      for (const [x0, y0, x1, y1] of LOGS) {
        const alongX = x1 - x0 > y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, L = alongX ? x1 - x0 : y1 - y0;
        if (alongX) M.rod('bark', [x0, cy, LH - .3], [x1, cy, LH - .3], .3, 10); else M.rod('bark', [cx, y0, LH - .3], [cx, y1, LH - .3], .3, 10);
        for (let k = 0; k <= 3; k++) { const f = k / 3, px = alongX ? x0 + .5 + f * (L - 1) : cx, py = alongX ? cy : y0 + .5 + f * (L - 1); for (const t of [-1, 1]) M.rod('darkwood', alongX ? [px, py + t * .5, 0] : [px + t * .5, py, 0], [px, py, LH - .45], .07, 4); }
        for (const e of [-1, 1]) { const sx = alongX ? (e < 0 ? x0 - .5 : x1 + .5) : cx, sy = alongX ? cy : (e < 0 ? y0 - .5 : y1 + .5); M.cyl('bark', [sx, sy, 0], .5, LH / 2, 10); M.cyl('wood', [sx, sy, LH / 2 - .01], .48, .02, 10); }
      }
      // climbing ropes on their beam
      M.rod('darkwood', [-11, -1.6, H - 1.2], [-1.8, -1.6, H - 1.2], .2, 6); for (const t of [-1, 1]) M.block('darkwood', t < 0 ? -11.2 : -1.6, -1.6, 0, .3, .3, H - 1.2);
      for (const x of [-9.4, -7.4, -5.4, -3.4]) { M.rod('rope', [x, -1.6, H - 1.3], [x, -1.6, .4], .05, 5); for (let k = 0; k < 5; k++) M.sphere('rope', [x, -1.6, 1 + k * 1.3], .11, 1, 6, 3); }
      // the crawl net on its frame, low
      const [nx0, ny0, nx1, ny1] = NET; for (const [x, y] of [[nx0, ny0], [nx1, ny0], [nx0, ny1], [nx1, ny1]]) M.block('darkwood', x, y, 0, .2, .2, 1.1);
      M.quad('net', [[nx0, ny0, 1], [nx1, ny0, 1], [nx1, ny1, 1], [nx0, ny1, 1]], [[0, 0], [(nx1 - nx0) / .6, 0], [(nx1 - nx0) / .6, (ny1 - ny0) / .6], [0, (ny1 - ny0) / .6]]);
      for (let x = nx0; x <= nx1 + .01; x += .6) M.rod('rope', [x, ny0, 1], [x, ny1, 1], .015, 3); for (let y = ny0; y <= ny1 + .01; y += .6) M.rod('rope', [nx0, y, 1], [nx1, y, 1], .015, 3);
      // the mud pit and its log border
      const [mx0, my0, mx1, my1] = MUD; M.quad('mud', [[mx0, my0, .014], [mx1, my0, .014], [mx1, my1, .014], [mx0, my1, .014]]);
      for (const [a, b] of [[[mx0, my0], [mx1, my0]], [[mx1, my0], [mx1, my1]], [[mx1, my1], [mx0, my1]], [[mx0, my1], [mx0, my0]]]) M.rod('bark', [a[0], a[1], .14], [b[0], b[1], .14], .14, 6);
      let sd = 121; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647; for (let k = 0; k < 9; k++) M.sphere('mud', [mx0 + .6 + r() * (mx1 - mx0 - 1.2), my0 + .5 + r() * (my1 - my0 - 1), .02], .3 + .3 * r(), .25, 6, 3);
      // the climbing wall on the right, holds and the rope at its top; straw targets along the back; a log pile and stake fences
      M.block('wood', (WALL[0] + WALL[2]) / 2, (WALL[1] + WALL[3]) / 2, 0, WALL[2] - WALL[0], WALL[3] - WALL[1], 6.4);
      for (let k = 0; k < 30; k++) M.sphere(k % 3 ? 'darkwood' : 'lacquer_red', [WALL[0] - .05, WALL[1] + .4 + r() * (WALL[3] - WALL[1] - .8), .5 + r() * 5.6], .14, .7, 6, 3);
      for (const y of [WALL[1] + 1.5, WALL[3] - 1.5]) M.rod('rope', [WALL[0] - .1, y, 6.4], [WALL[0] - .4, y, .3], .04, 4);
      for (const x of [-9, -3, 3, 9]) piece(M, 'ashi_target', x, -11.4, 0, Math.PI);
      piece(M, 'ashi_log_pile', -15, -11.1, 0, Math.PI / 2); for (const x of [-15.4, 15.4]) piece(M, 'ashi_stake_fence', x, 9, 0, Math.PI / 2);
      for (const s of [-1, 1]) wallArt(M, s < 0 ? 'left' : 'right', -8, 2.2, 1.8, 3.6, 'banner_ashigaru', HX, HY, .08);
      for (const [x, y] of [[-16.6, 12.6], [16.6, 12.6], [-16.6, 0], [16.6, 6]]) andon(M, x, y, 0, 1.2);
    },
    // the Kenshi Duel Hall (training): one circle of raked white sand under the round skylight, its light falling straight onto
    // it; two kneeling marks at its edge and the sword stand; at the far end the still pool with its single stone, the banner
    room_kenshi_duel(M) {
      M.room = true;
      const { HX, HY, H, DW, DH, C, SKY, POOL } = KD;
      hall(M, { HX, HY, H, DW, DH, floor: 'slate', wall: 'plaster_teal', wain: 'darkwood', wainH: 1.2, rail: 'steel', post: 'darkwood', postEvery: 5, beam: 'darkwood', noCeil: true });
      // the ceiling round the skylight, the square opening filled round to a circle, the sky
      for (const [x, y, w, d] of [[0, -(SKY + HY) / 2 - .2, 2 * HX + .8, HY - SKY + .4], [0, (SKY + HY) / 2 + .2, 2 * HX + .8, HY - SKY + .4], [-(SKY + HX) / 2 - .2, 0, HX - SKY + .4, 2 * SKY], [(SKY + HX) / 2 + .2, 0, HX - SKY + .4, 2 * SKY]]) M.block('darkwood', x, y, H, w, d, .3);
      for (const [sx, sy, a0] of [[1, 1, 0], [-1, 1, Math.PI / 2], [-1, -1, Math.PI], [1, -1, 3 * Math.PI / 2]]) { const pts = [[sx * SKY, sy * SKY, H - .01]]; for (let k = 0; k <= 8; k++) { const a = a0 + k / 8 * Math.PI / 2; pts.push([Math.cos(a) * SKY, Math.sin(a) * SKY, H - .01]); } M.poly('darkwood', pts); }
      M.quad('skyhole', [[-SKY, -SKY, H + .6], [SKY, -SKY, H + .6], [SKY, SKY, H + .6], [-SKY, SKY, H + .6]]); for (let k = 0; k < 32; k++) { const a0 = k / 32 * 6.283, a1 = (k + 1) / 32 * 6.283; M.rod('steel', [Math.cos(a0) * SKY, Math.sin(a0) * SKY, H - .05], [Math.cos(a1) * SKY, Math.sin(a1) * SKY, H - .05], .09, 4); }
      for (let x = -HX + 3.75; x < HX; x += 3.75) for (const s of [-1, 1]) if (Math.abs(x) > SKY + .5) M.block('darkwood', x, s * (HY / 2 + 1.5), H - .4, .3, HY - 3, .4);
      for (const a of [0, Math.PI / 3, 2 * Math.PI / 3]) { const c = Math.cos(a) * SKY * .9, s = Math.sin(a) * SKY * .9; M.quad('shaft_white', [[-c, -s, .2], [c, s, .2], [c, s, H - .1], [-c, -s, H - .1]]); }
      // the circle: a stone ring, raked white sand
      M.cyl('stone', [0, 0, 0], C + .35, .15, 48); discK(M, 'raked_sand', [0, 0, .155], [1, 0, 0], [0, 1, 0], C, 48);
      for (const t of [-1, 1]) M.block('cushion', t * (C - .9), 0, .155, .9, .9, .1);
      M.block('lacquer_black', 0, -C - .4, .15, 2.6, .5, .5); for (const t of [-1, 1]) M.block('lacquer_black', t * 1.1, -C - .4, .65, .14, .3, .5); M.rod('lacquer_black', [-1.2, -C - .4, 1.05], [1.15, -C - .4, 1.08], .05, 6); M.rod('steel', [-1.1, -C - .38, 1.1], [1.2, -C - .38, 1.14], .02, 4);
      // the still pool, its kerb, the single stone
      const [px0, py0, px1, py1] = POOL; M.block('stone', (px0 + px1) / 2, (py0 + py1) / 2, 0, px1 - px0 + .6, py1 - py0 + .6, .22); M.quad('water', [[px0, py0, .2], [px1, py0, .2], [px1, py1, .2], [px0, py1, .2]]);
      blob(M, 'granite', [0, (py0 + py1) / 2, .2], .9, .7, 1.3, { segs: 12, rings: 7, amp: .14, seed: 7 });
      wallArt(M, 'back', 0, 2.6, 2.4, 6, 'banner_kenshi', HX, HY, .08); M.rod('darkwood', [-1.4, -HY + .14, 8.65], [1.4, -HY + .14, 8.65], .05, 6);
      // shoji high on the side walls, a few practice swords, lamps
      for (const s of [-1, 1]) for (const y of [-10, -5, 0, 5, 10]) wallArt(M, s < 0 ? 'left' : 'right', y, 6.2, 3.6, 2, 'shoji', HX, HY, .05);
      for (const s of [-1, 1]) { const x = s * (HX - .35); M.block('darkwood', x, 0, 0, .5, 5, .2); M.block('darkwood', x, 0, 2.2, .3, 5, .12); for (let k = 0; k < 7; k++) M.rod('wood', [x, -2.1 + k * .7, .2], [x - s * .12, -2.1 + k * .7, 2.5], .045, 5); }
      for (const [x, y] of [[-12.8, 12.6], [12.8, 12.6], [-12.8, -12.6], [12.8, -12.6]]) andon(M, x, y, 0, 1.2);
    },
    // the Kenshi Library of Forms (lore): kata scrolls the height of the walls, wooden mannequins frozen in sword forms on their
    // plinths, and in the middle a koi pond under a stone bridge, the koi turning slowly round it
    room_kenshi_library(M) {
      M.room = true;
      const { HX, HY, H, DW, DH, P, BR, BT } = KL, [px, py, pr] = P;
      hall(M, { HX, HY, H, DW, DH, floor: 'wood', wall: 'plaster_teal', wain: 'darkwood', wainH: 1.1, rail: 'darkwood', post: 'darkwood', postEvery: 4, beam: 'darkwood', ceil: 'wood', ceilBeam: 'darkwood', ceilEvery: 3 });
      for (const s of [-1, 1]) for (const y of [-5.5, 4]) { wallArt(M, s < 0 ? 'left' : 'right', y, 1.2, 3, 6.2, 'kata_scroll', HX, HY, .08); M.rod('darkwood', [s * (HX - .14), y - 1.7, 7.45], [s * (HX - .14), y + 1.7, 7.45], .07, 8); M.rod('darkwood', [s * (HX - .16), y - 1.6, 1.15], [s * (HX - .16), y + 1.6, 1.15], .09, 8); }
      // the pond: a stone rim, the water, lily pads; the bridge
      M.tube('stone', [px, py, -.05], [px, py, .2], pr + .35, pr + .35, 40, false); M.tube('stone', [px, py, -.05], [px, py, .2], pr, pr, 40, false);
      for (let k = 0; k < 40; k++) { const a0 = k / 40 * 6.283, a1 = (k + 1) / 40 * 6.283; M.quad('stone', [[px + Math.cos(a0) * pr, py + Math.sin(a0) * pr, .2], [px + Math.cos(a1) * pr, py + Math.sin(a1) * pr, .2], [px + Math.cos(a1) * (pr + .35), py + Math.sin(a1) * (pr + .35), .2], [px + Math.cos(a0) * (pr + .35), py + Math.sin(a0) * (pr + .35), .2]]); }
      discK(M, 'water', [px, py, .02], [1, 0, 0], [0, 1, 0], pr, 40);
      for (const [a, d, rr] of [[.6, 3, .45], [2.2, 3.2, .38], [3.7, 2.6, .5], [5.1, 3.4, .35], [4.4, 1.6, .3]]) discK(M, 'lily', [px + Math.cos(a) * d, py + Math.sin(a) * d, .05], [1, 0, 0], [0, 1, 0], rr, 12);
      const L = pr + 1.4;
      for (let k = 0; k < 14; k++) { const y0 = py - L + k * 2 * L / 14, y1 = y0 + 2 * L / 14, z0 = BT * (1 - Math.abs(y0 - py) / L), z1 = BT * (1 - Math.abs(y1 - py) / L); M.quad('stone', [[px - BR, y0, z0 + .04], [px + BR, y0, z0 + .04], [px + BR, y1, z1 + .04], [px - BR, y1, z1 + .04]]); }
      for (const s of [-1, 1]) { const x = px + s * BR; M.rod('stone', [x, py - L, -.1], [x, py, BT - .1], .18, 6); M.rod('stone', [x, py, BT - .1], [x, py + L, -.1], .18, 6); railK(M, [x, py - pr, BT * (1 - pr / L)], [x, py, BT], 1.1, 'stone', 'stone'); railK(M, [x, py, BT], [x, py + pr, BT * (1 - pr / L)], 1.1, 'stone', 'stone'); }
      // the mannequins in their forms
      [[-8.6, -8.6, 0], [8.6, -8.6, 1], [-9.4, 0, 2], [9.4, 0, 3], [-8.6, 7, 1], [8.6, 7, 0]].forEach(([x, y, f]) => mannequin(M, x, y, f));
      // bamboo in pots by the door, a reading desk
      for (const s of [-1, 1]) { const x = s * 4.2, y = HY - 1; M.cyl('clay', [x, y, 0], .55, .7, 12, .6); for (let k = 0; k < 5; k++) M.rod('needles', [x + (k % 3 - 1) * .15, y + (k > 2 ? .12 : -.12), .7], [x + (k % 3 - 1) * .3, y + (k > 2 ? .25 : -.25), 4.2 + k * .25], .05, 5); }
      M.block('darkwood', 0, -HY + 1.2, 0, 3, 1, .55); M.block('paper', 0, -HY + 1.2, .55, 1.4, .6, .01); M.block('cushion', 0, -HY + 2.2, 0, .9, .9, .12);
      for (const [x, y] of [[-10.8, 10.8], [10.8, 10.8], [-10.8, -10.8], [10.8, -10.8]]) andon(M, x, y, 0, 1.2);
    },
    // koi for the library pond (spinning parts: each swims a circle round the pond's centre)
    room_kenshi_koi_a(M) { M.room = true; koiK(M, 2.6, 'koi_orange'); }, room_kenshi_koi_b(M) { M.room = true; koiK(M, 3.3, 'koi_white'); }, room_kenshi_koi_c(M) { M.room = true; koiK(M, 1.7, 'koi_orange'); },
    // the Kenshi Polishing Studio (craft): water-stone benches over the running channel, blades laid on them; blade cases in teal
    // glass along both walls; at the back the test line of rolled straw mats, two of them cut
    room_kenshi_forge(M) {
      M.room = true;
      const { HX, HY, H, DW, DH, CH } = KF, [cx0, cy0, cx1, cy1] = CH;
      hall(M, { HX, HY, H, DW, DH, floor: 'slate', wall: 'plaster_teal', wain: 'darkwood', wainH: 1, rail: 'steel', post: 'darkwood', postEvery: 3, beam: 'darkwood', ceil: 'darkwood', ceilBeam: 'darkwood', ceilEvery: 3 });
      M.block('stone', (cx0 + cx1) / 2, (cy0 + cy1) / 2, -.4, cx1 - cx0 + .6, cy1 - cy0 + .6, .5); M.block('stone_dark', (cx0 + cx1) / 2, (cy0 + cy1) / 2, -.4, cx1 - cx0, cy1 - cy0, .3);
      M.quad('water_flow', [[cx0, cy0, -.12], [cx1, cy0, -.12], [cx1, cy1, -.12], [cx0, cy1, -.12]], [[0, 0], [(cx1 - cx0) / 3, 0], [(cx1 - cx0) / 3, .4], [0, .4]]);
      for (const s of [-1, 1]) M.quad('dark', [[s < 0 ? cx0 : cx1, cy0, -.4], [s < 0 ? cx0 : cx1, cy1, -.4], [s < 0 ? cx0 : cx1, cy1, .1], [s < 0 ? cx0 : cx1, cy0, .1]]);
      M.block('wood', 0, (cy0 + cy1) / 2, -.05, 1.4, cy1 - cy0 + 2.2, .17); for (const t of [-1, 1]) M.block('darkwood', t * .66, (cy0 + cy1) / 2, .12, .08, cy1 - cy0 + 2.2, .05); // the plank bridge
      for (const x of KF.BX) {
        for (const t of [-1, 1]) M.block('darkwood', x + t * .7, -2, 0, .2, 2.2, .45); M.block('wood', x, -2, .45, 1.8, 2.2, .1);
        M.block('stone', x - .3, -2.3, .55, .7, .3, .12); M.block('slate', x + .4, -2.3, .55, .5, .3, .1); M.rod('steel', [x - .8, -1.6, .6], [x + .75, -1.62, .62], .03, 4); M.box('steel', [x, -1.6, .61], [1.4, .08, .015]); M.cyl('cushion', [x, -.4, 0], .42, .12, 10);
      }
      // the cases: dark frames, teal glass fronts, blades on their stands inside
      for (const s of [-1, 1]) for (const y of [-1.5, 3.5]) {
        const x = s * (HX - .45), xf = s * (HX - .9); M.block('darkwood', x, y, 0, .9, 4.4, 4); M.block('dark', x + s * .1, y, .6, .5, 4, 3.2);
        for (let k = 0; k < 3; k++) { const z = 1.2 + k * .95; M.rod('steel', [x - s * .1, y - 1.5, z], [x - s * .1, y + 1.5, z + .05], .028, 4); M.box('steel', [x - s * .1, y, z], [.015, 3, .07]); M.rod('lacquer_black', [x - s * .1, y + 1.5, z + .05], [x - s * .1, y + 1.95, z + .07], .04, 6); M.rod('gold', [x - s * .1, y + 1.48, z + .05], [x - s * .1, y + 1.53, z + .05], .09, 10); }
        M.quad('glass_teal', s < 0 ? [[xf, y - 2.1, .4], [xf, y + 2.1, .4], [xf, y + 2.1, 3.9], [xf, y - 2.1, 3.9]] : [[xf, y + 2.1, .4], [xf, y - 2.1, .4], [xf, y - 2.1, 3.9], [xf, y + 2.1, 3.9]]);
      }
      // the test line of straw mats
      M.block('darkwood', 0, -HY + 1.6, 0, 12, .8, .3);
      for (let k = 0; k < 6; k++) { const x = -5 + k * 2, cut = k === 1 || k === 4; M.rod('iron', [x, -HY + 1.6, .3], [x, -HY + 1.6, .8], .04, 4); M.cyl('straw', [x, -HY + 1.6, .3], .24, cut ? .9 : 1.9, 12); for (let q = 0; q < 3; q++) M.cyl('rope', [x, -HY + 1.6, .55 + q * .5], .25, .05, 12); if (cut) { M.box('straw', [x + .5, -HY + 2.2, .24], [.48, 1, .48], .4, Math.PI / 2); M.quad('sawdust', [[x - .24, -HY + 1.36, 1.2], [x + .24, -HY + 1.36, 1.2], [x + .24, -HY + 1.84, 1.25], [x - .24, -HY + 1.84, 1.25]]); } }
      wallArt(M, 'back', 0, 2.8, 2, 3.8, 'banner_kenshi', HX, HY, .08);
      for (const [x, y] of [[-8.6, 7.6], [8.6, 7.6]]) andon(M, x, y, 0, 1.2);
    },
    // the Kenshi Meditation Room (video): an indoor zen garden, raked gravel in waves round a moss island with one red maple and
    // three stones in their rings, the walkway round it, cushions facing it; the film plays as shadow-play on the great shoji
    room_kenshi_meditation(M) {
      M.room = true;
      const { HX, HY, H, DW, DH, G } = KM, [gx0, gy0, gx1, gy1] = G;
      hall(M, { HX, HY, H, DW, DH, floor: 'wood', wall: 'plaster_teal', wain: 'darkwood', wainH: 1.2, rail: 'darkwood', post: 'darkwood', postEvery: 3.25, beam: 'darkwood', ceil: 'darkwood', ceilBeam: 'darkwood', ceilEvery: 3.25 });
      M.block('darkwood', (gx0 + gx1) / 2, (gy0 + gy1) / 2, 0, gx1 - gx0 + .4, gy1 - gy0 + .4, .16);
      M.quad('rake_lines', [[gx0, gy0, .17], [gx1, gy0, .17], [gx1, gy1, .17], [gx0, gy1, .17]], [[0, 0], [(gx1 - gx0) / 2, 0], [(gx1 - gx0) / 2, (gy1 - gy0) / 2], [0, (gy1 - gy0) / 2]]);
      blob(M, 'moss', [-2, -3, .1], 3, 2.2, .8, { segs: 18, rings: 8, amp: .1, seed: 12, flat: .1 });
      curveTube(M, 'bark', [[-2, -3, .5], [-1.6, -3.2, 1.8], [-2.3, -2.8, 3.2], [-1.8, -3.1, 4.2]], [.22, .17, .12, .08], { segs: 8, n: 5, seed: 13 });
      let sd = 131; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
      for (let k = 0; k < 16; k++) { const a = r() * 6.283, d = .4 + r() * 1.6; M.sphere('maple_red', [-1.9 + Math.cos(a) * d, -3 + Math.sin(a) * d * .8, 3.9 + (r() - .3) * 1.1], .55 + .25 * r(), .6, 8, 4); }
      for (const [x, y, s] of [[4, 1, 1], [5.5, -6, .8], [-6, 2.4, .9]]) { discK(M, 'raked_sand', [x, y, .18], [1, 0, 0], [0, 1, 0], 1.7 * s, 28); blob(M, 'granite', [x, y, .1], .7 * s, .55 * s, .8 * s, { segs: 12, rings: 7, amp: .16, seed: x * 10 | 0 }); }
      for (let k = 0; k < 5; k++) M.block('cushion', -6 + k * 3, gy1 + 1.4, 0, .95, .95, .14);
      // the great shoji: paper lit from behind in a dark frame, where the film plays
      M.block('darkwood', 0, -HY + .2, 1.3, 9.8, .3, 5.6); M.quad('shoji_lit', [[4.6, -HY + .37, 1.6], [-4.6, -HY + .37, 1.6], [-4.6, -HY + .37, 6.6], [4.6, -HY + .37, 6.6]], [[0, 0], [9.2 / 1.2, 0], [9.2 / 1.2, 5 / 1.5], [0, 5 / 1.5]]);
      for (const s of [-1, 1]) { andon(M, s * 6, -HY + .9, 0, 1.3); wallArt(M, 'back', s * 9.6, 1.6, 1.6, 4.4, 'banner_kenshi', HX, HY, .08); }
      for (const [x, y] of [[-11.4, 11.4], [11.4, 11.4]]) andon(M, x, y, 0, 1.2);
    }
  });
  // ── Yamabushi and Sohei rooms ──
  // a stone lantern (toro) at (x, y) with its flame in the light box (fire colours or the Yamabushi blue)
  function toroK(M, x, y, mats = ['fire', 'lantern'], s = 1) {
    M.cyl('stone', [x, y, 0], .6 * s, .3 * s, 8); M.cyl('stone', [x, y, .3 * s], .2 * s, 1.5 * s, 8); M.block('stone', x, y, 1.8 * s, 1 * s, 1 * s, .2 * s);
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) M.block('stone', x + a * .34 * s, y + b * .34 * s, 2 * s, .14 * s, .14 * s, .8 * s);
    flame(M, x, y, 2.05 * s, .32 * s, mats); M.cyl('stone', [x, y, 2.8 * s], .85 * s, .35 * s, 8, .15 * s); M.sphere('stone', [x, y, 3.25 * s], .16 * s, 1, 6, 3);
  }
  Object.assign(B, {
    // the Yamabushi Falls Cave (explore): a wet rock cave behind a waterfall, the water pouring past its mouth, mist and the void
    // beyond; pools on the floor, moss glowing blue on the rocks, the hermit's shrine on its ledge with candles and a straw mat
    room_yam_falls(M) {
      M.room = true;
      const { CY, RX, RY, RZ, MOUTH, LEDGE } = YF, [mw, mz0, mz1] = MOUTH;
      M.block('granite', 0, 0, -.3, 2 * RX + 2, 2 * RY + 8, .3);
      const E = () => M.part('granite').i.length, i0 = E();
      blob(M, 'granite', [0, CY, 0], RX, RY, RZ, { segs: 30, rings: 14, amp: .08, freq: 1.1, seed: 21, flat: .05 }); const i1 = E();
      const pass = [[0, 14.2, 2.4], [0, 10.5, 2.4], [0, 7.5, 2.3]]; curveTube(M, 'granite', pass, [2.7, 2.6, 2.7], { segs: 14, n: 5, ridge: .1, k: 4, bump: .1, cap: false, seed: 22 });
      // the cave's wall opened where the passage comes in and where it looks out on the falls
      cutTris(M, 'granite', i0, i1, q => nearPath(spline(pass, 5), 2.1)(q) || (q[1] < CY - RY * .62 && Math.abs(q[0]) < mw && q[2] > mz0 && q[2] < mz1));
      for (const t of [-1, 1]) M.block('stone', t * 2.4, 14.4, 0, .9, .9, 4.4); M.block('stone', 0, 14.4, 4.3, 5.6, .9, .7); M.quad('doorview', [[-1.95, 14.85, 0], [1.95, 14.85, 0], [1.95, 14.85, 4.3], [-1.95, 14.85, 4.3]]);
      // the falls: two layers of pouring water across the mouth, spray, the misty void, the pool under it
      const yf = CY - RY * .86;
      for (const [dy, du] of [[0, 1], [-.6, 1.6]]) M.quad('falls_curtain', [[-mw - 1, yf + dy, -1.5], [mw + 1, yf + dy, -1.5], [mw + 1, yf + dy, mz1 + 1.6], [-mw - 1, yf + dy, mz1 + 1.6]], [[0, 0], [du * 2, 0], [du * 2, 2.4], [0, 2.4]]);
      for (let k = 0; k < 4; k++) M.quad('mist_low', [[-mw - 2, yf + 1.2 - k * .5, .2 + k * .35], [mw + 2, yf + 1.2 - k * .5, .2 + k * .35], [mw + 2, yf + 1.2 - k * .5, 1.6 + k * .5], [-mw - 2, yf + 1.2 - k * .5, 1.6 + k * .5]]);
      M.quad('mist_view', [[mw + 8, yf - 7, -6], [-mw - 8, yf - 7, -6], [-mw - 8, yf - 7, 16], [mw + 8, yf - 7, 16]]);
      M.quad('water', [[-mw - 2, yf + 2.2, .05], [mw + 2, yf + 2.2, .05], [mw + 2, yf - 4, .05], [-mw - 2, yf - 4, .05]]);
      for (let k = 0; k < 9; k++) { const a = -1 + k * .25; blob(M, 'granite', [a * (mw + 1.5), yf + 1.6 + (k % 2) * .6, .2], .9 + (k % 3) * .3, .8, .8 + (k % 2) * .5, { segs: 10, rings: 6, amp: .18, seed: 30 + k }); }
      // pools with their rims, wet rocks, the blue moss
      for (const [x, y, r] of [[-7, 2, 2.2], [4.5, -1.5, 1.8]]) { discK(M, 'water', [x, y, .06], [1, 0, 0], [0, 1, 0], r, 24); M.tube('stone_dark', [x, y, 0], [x, y, .18], r + .2, r + .2, 24, false); }
      for (const [x, y, s] of [[-10, -6, 1.3], [-4.4, 6.6, 1], [11, 4.5, 1.2]]) blob(M, 'granite', [x, y, 0], 1.3 * s, 1.1 * s, 1.4 * s, { segs: 12, rings: 7, amp: .2, seed: x * 7 | 0 });
      let sd = 141; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
      for (let k = 0; k < 16; k++) { const a = k / 16 * 6.283 + r() * .3, d = 9.2 + r() * 1.4, x = Math.cos(a) * d * 1.1, y = CY + Math.sin(a) * d * .82; if (y > 5 || (y < CY - 8 && Math.abs(x) < 8)) continue; blob(M, 'moss_glow', [x, y, .02], .6 + r() * .6, .45 + r() * .4, .06, { segs: 8, rings: 3, amp: .25, seed: k + 50, flat: 1 }); if (k % 3 === 0) M.sphere('spirit', [x * .85, y * .85, .6 + r() * 1.6], .07, 1, 6, 3); }
      for (const [x, y, s] of [[-10, -6, 1.3], [-4.4, 6.6, 1], [11, 4.5, 1.2]]) blob(M, 'moss_glow', [x, y, 1.3 * s], .7 * s, .55 * s, .08, { segs: 8, rings: 3, amp: .2, seed: x * 3 | 0, flat: 1 });
      // the hermit's ledge: a raised rock shelf, a step, the little shrine, candles, the straw mat
      const [lx, ly, lr, lh] = LEDGE;
      blob(M, 'granite', [lx, ly, lh - .45], lr + .3, lr, .45, { segs: 16, rings: 6, amp: .06, seed: 61, flat: 3 }); M.cyl('stone_dark', [lx, ly, 0], lr, lh - .02, 20); discK(M, 'stone', [lx, ly, lh], [1, 0, 0], [0, 1, 0], lr, 20);
      M.cyl('stone', [lx - .6, ly + 2.6, 0], .95, lh / 2, 12);
      const sx = lx + .4, sy = ly - .7; M.block('stone', sx, sy, lh, 1.6, 1.2, .3); M.block('darkwood', sx, sy, lh + .3, 1.2, .9, 1.1); M.roof(sx, sy, lh + 1.4, 1.8, 1.5, .5, { lift: .15, ornaments: false, gable: false }); M.quad('charm', [[sx - .2, sy - .46, lh + .5], [sx + .2, sy - .46, lh + .5], [sx + .2, sy - .46, lh + 1.25], [sx - .2, sy - .46, lh + 1.25]]);
      for (let k = 0; k < 5; k++) { const cx = lx - 1.2 + k * .45, cy = ly + .6 + (k % 2) * .25; M.cyl('candle', [cx, cy, lh], .05, .28 + .1 * (k % 3), 6); M.sphere('fire', [cx, cy, lh + .36 + .1 * (k % 3)], .05, 1.6, 5, 3); }
      M.block('straw', lx - .4, ly + .8, lh, 1.1, .8, .03);
    },
    // the Yamabushi Library (lore): a two-storey atrium, galleries round three sides up the stair on the left wall; the spiral of
    // the Yamabushi hanging through it, turning slowly, blue lights along its arms; herb jars and bundles, star charts on the
    // gallery's back wall, the telescope at the high window full of night
    room_yam_library(M) {
      M.room = true;
      const { HX, HY, H, DW, DH, GH, ST } = YL;
      hall(M, { HX, HY, H, DW, DH, floor: 'wood', wall: 'plaster_teal', wain: 'darkwood', wainH: 1.2, rail: 'darkwood', post: 'darkwood', postEvery: 5.5, beam: 'darkwood', ceil: 'darkwood', ceilBeam: 'darkwood', ceilEvery: 2.75 });
      // the galleries (plank floors on joists), the stair, the railings
      const slab = (x0, y0, x1, y1) => { M.block('darkwood', (x0 + x1) / 2, (y0 + y1) / 2, GH - .35, x1 - x0, y1 - y0, .35); M.quad('wood', [[x0, y0, GH + .005], [x1, y0, GH + .005], [x1, y1, GH + .005], [x0, y1, GH + .005]]); };
      slab(-HX, -HY, HX, -HY + 3); slab(HX - 3, -HY + 3, HX, HY); slab(-HX, -HY + 3, -HX + 3, ST[1]);
      for (const [x, y] of [[-HX + 3, -HY + 3], [HX - 3, -HY + 3], [HX - 3, HY - .3]]) M.block('darkwood', x, y, 0, .4, .4, GH);
      stairsK(M, 'darkwood', -HX, -HX + 3, ST[1], ST[0], 0, GH, 20, -1, 'gold');
      railK(M, [-HX + 3, -HY + 3, GH], [HX - 3, -HY + 3, GH], 1.5); railK(M, [HX - 3, -HY + 3, GH], [HX - 3, HY, GH], 1.5); railK(M, [-HX + 3, -HY + 3, GH], [-HX + 3, ST[1], GH], 1.5); railK(M, [-HX + 3, ST[0], 0], [-HX + 3, ST[1], GH], 1.5);
      // herb shelves (ground floor, right wall), jars, herb bundles hanging from the gallery edge
      let sd = 151; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
      M.block('darkwood', HX - .45, 1, 0, .9, 14, .3); for (const z of [1.3, 2.4, 3.5, 4.6]) { M.block('wood', HX - .45, 1, z - .08, .9, 14, .08); for (let y = -5.6; y < 7.7; y += .65) { const h = .3 + .15 * r(); M.cyl('glass', [HX - .5, y, z], .2, h, 10); M.sphere(['leaf', 'sprout', 'bark', 'straw', 'flower_purple'][(r() * 5) | 0], [HX - .5, y, z + h * .35], .15, .9, 6, 3); M.cyl('wood', [HX - .5, y, z + h], .12, .06, 8); } }
      for (let y = -6; y < 9; y += 1.3) { const x = HX - 3.1, zt = GH - .4; M.rod('rope', [x, y, zt], [x, y, zt - .6], .015, 3); M.tube(r() < .5 ? 'leaf' : 'straw', [x, y, zt - .6], [x, y, zt - 1.4], .08, .26, 6, true); }
      // star charts on the gallery's back wall, the window and the telescope
      for (const u of [-6.5, -2.2, 2.2, 6.5]) { wallArt(M, 'back', u, GH + .8, 3, 5.2, 'star_chart', HX, HY, .07); M.rod('darkwood', [u - 1.7, -HY + .1, GH + 6.05], [u + 1.7, -HY + .1, GH + 6.05], .06, 6); }
      // the high window and the telescope at the far end of the right gallery (the walk along the galleries ends there)
      wallArt(M, 'right', 9.2, GH + 1.4, 3, 3.6, 'night_sky', HX, HY, .04); for (const d of [-1, 0, 1]) M.rod('darkwood', [HX - .1, 9.2 + d, GH + 1.4], [HX - .1, 9.2 + d, GH + 5], .04, 4); M.block('darkwood', HX - .2, 9.2, GH + 1.3, .3, 3.4, .12);
      for (let k = 0; k < 3; k++) { const a = k / 3 * 6.283; M.rod('darkwood', [9.5, 9.2, GH + 2.3], [9.5 + Math.cos(a) * .55, 9.2 + Math.sin(a) * .55, GH], .035, 4); } M.rod('brass', [9, 9.1, GH + 2.15], [10.3, 9.3, GH + 2.75], .12, 10); M.rod('brass', [10.3, 9.3, GH + 2.75], [10.5, 9.33, GH + 2.82], .15, 10);
      // the reading table under the spiral, cushions, a blue-flame brazier
      M.block('darkwood', 0, 0, 0, 4, 2.4, .55); M.block('paper', -.6, 0, .55, 1.4, .9, .01); M.block('paper', .9, .2, .55, .8, .6, .01); for (const t of [-1, 1]) M.block('cushion', 0, t * 1.9, 0, .9, .9, .12);
      M.cyl('iron', [-6, 6, 0], .5, .7, 10, .6); flame(M, -6, 6, .72, .55, ['spirit', 'orb']);
      for (const [x, y] of [[9.6, 9.6], [-6, -9.6]]) andon(M, x, y, 0, 1.2);
    },
    // the spiral hanging through the library's atrium (a spinning part): a helix of wood narrowing downwards, leaves of thin
    // board along it, blue lights
    room_yam_spiral(M) {
      M.room = true; const P = [];
      for (let k = 0; k <= 48; k++) { const t = k / 48, a = t * Math.PI * 6, rr = 2.2 - 1.6 * t; P.push([Math.cos(a) * rr, Math.sin(a) * rr, 12.6 - 8 * t]); }
      curveTube(M, 'wood', P, P.map((_, k) => .14 - .08 * k / 48), { segs: 6, n: 2, seed: 3 });
      P.forEach((p, k) => { if (k % 4 === 0) M.box('needles', [p[0], p[1], p[2] - .1], [.5, .22, .03], Math.atan2(p[1], p[0])); if (k % 6 === 3) M.sphere('spirit', [p[0] * 1.08, p[1] * 1.08, p[2] - .25], .12, 1, 6, 3); });
      M.rod('rope', [0, 0, 12.9], [0, 0, 12.6], .02, 3); M.rod('rope', [0, 0, 12.6], [P[0][0], P[0][1], P[0][2]], .02, 3); M.sphere('orb', [P[48][0], P[48][1], P[48][2] - .3], .2, 1, 8, 4);
    },
    // the Yamabushi Spirit Shrine (lore): the sacred boulder on its bed of white pebbles, bound by the shimenawa with its paper
    // streamers; blue spirit flames in four stone lanterns; paper charms drifting in the air round it; a weathered torii, the ema
    room_yam_shrine(M) {
      M.room = true;
      const { HX, HY, H, DW, DH, R } = YS;
      hall(M, { HX, HY, H, DW, DH, floor: 'darkwood', wall: 'plaster_teal', wain: 'darkwood', wainH: 1.4, rail: 'darkwood', post: 'darkwood', postEvery: 5, beam: 'darkwood', ceil: 'darkwood', ceilBeam: 'darkwood', ceilEvery: 3.75 });
      discK(M, 'pebbles_white', [0, 0, .03], [1, 0, 0], [0, 1, 0], R, 48); M.tube('stone_dark', [0, 0, 0], [0, 0, .16], R + .15, R + .15, 48, false);
      blob(M, 'granite', [0, 0, 0], 3.4, 3, 4.4, { segs: 20, rings: 10, amp: .14, freq: 1.3, seed: 71, flat: .2 }); blob(M, 'moss', [.3, -.2, 3.7], 1.8, 1.5, .55, { segs: 12, rings: 5, amp: .16, seed: 72 });
      const zr = 2.5, rr = 3.42;
      for (const [dz, ph] of [[0, 0], [.18, .5]]) for (let k = 0; k < 32; k++) { const a0 = k / 32 * 6.283 + ph, a1 = (k + 1) / 32 * 6.283 + ph; M.rod('rope', [Math.cos(a0) * rr, Math.sin(a0) * rr * .9, zr + dz], [Math.cos(a1) * rr, Math.sin(a1) * rr * .9, zr + dz], .2, 5); }
      for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283, x = Math.cos(a) * (rr + .1), y = Math.sin(a) * (rr + .1) * .9, tx = -Math.sin(a) * .18, ty = Math.cos(a) * .18; let z = zr - .1; for (let q = 0; q < 4; q++) { const s2 = q % 2 ? 1 : -1; M.quad('paper', [[x - tx + s2 * tx * .5, y - ty + s2 * ty * .5, z], [x + tx + s2 * tx * .5, y + ty + s2 * ty * .5, z], [x + tx - s2 * tx * .5, y + ty - s2 * ty * .5, z - .32], [x - tx - s2 * tx * .5, y - ty - s2 * ty * .5, z - .32]]); z -= .32; } }
      for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) toroK(M, a * 8.6, b * 8.6, ['spirit', 'orb'], 1);
      // the torii before the ring
      const ty = R + .7; for (const s of [-1, 1]) { M.cyl('darkwood', [s * 3.4, ty, 0], .26, 6.2, 12, .22); M.cyl('stone', [s * 3.4, ty, 0], .4, .3, 10); }
      M.box('darkwood', [0, ty, 5.4], [7.8, .4, .32]); M.box('lacquer_black', [0, ty, 6.25], [9.2, .55, .36]); M.block('darkwood', 0, ty, 5.55, .3, .3, .55);
      // the ema rack, banners, the spiral emblem high on the back wall, offerings
      M.block('darkwood', HX - .5, -2, 0, .5, 7.6, .2); M.block('darkwood', HX - .5, -2, 2.4, .3, 7.6, .14); for (const t of [-1, 1]) M.block('darkwood', HX - .5, -2 + t * 3.7, 0, .2, .2, 2.6);
      for (let k = 0; k < 22; k++) M.box('wood', [HX - .62, -5.4 + (k % 11) * .68, 1.75 - (k > 10 ? .62 : 0)], [.04, .5, .36]);
      for (const s of [-1, 1]) wallArt(M, 'back', s * 9, 2.2, 2.6, 6.4, 'banner_yamabushi', HX, HY, .08); wallArt(M, 'back', 0, 6.5, 3, 3, 'mark_yamabushi', HX, HY, .08);
      M.block('darkwood', 0, -R - 1, 0, 2.4, .9, .9); for (const [dx, m] of [[-.6, 'straw'], [0, 'paper'], [.6, 'clay']]) M.cyl(m, [dx, -R - 1, .9], .22, .3, 8);
    },
    // a paper charm (ofuda) drifting in the shrine (a part: bobbing and swaying)
    room_yam_charm(M) { M.room = true; M.quad('charm', [[-.14, 0, -.42], [.14, 0, -.42], [.14, 0, .42], [-.14, 0, .42]]); M.rod('rope', [0, 0, .42], [0, 0, .7], .006, 3); },
    // the Yamabushi Descent Path (quest): a square shaft cut down through the mountain, the stair running down its walls flight
    // under flight, a lamp at every second landing; a rope bridge out to the stone pillar in the middle (a little shrine on it);
    // mist hanging at three depths, a pool glowing blue at the bottom; the climb starts on the landing by the door
    room_yam_descent(M) {
      M.room = true;
      const { S, I, TOP, DROP, PH } = YD, Hs = TOP + 6;
      M.block('stone_dark', 0, 0, -.3, 2 * S + 1, 2 * S + 1, .3); M.block('granite', 0, 0, Hs, 2 * S + 1, 2 * S + 1, .5);
      for (const s of [-1, 1]) { M.block('granite', s * (S + .25), 0, 0, .5, 2 * S + 1, Hs); M.block('granite', 0, s * (S + .25), 0, 2 * S + 1, .5, Hs); }
      let sd = 161; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
      for (let k = 0; k < 30; k++) { const side = k % 4, t = (r() - .5) * 2 * (S - 1), z = 1 + r() * (Hs - 3), p = side === 0 ? [S - .2, t] : side === 1 ? [-S + .2, t] : side === 2 ? [t, S - .2] : [t, -S + .2]; blob(M, k % 5 ? 'granite' : 'moss', [p[0], p[1], z], 1 + r() * 1.4, .8 + r(), .9 + r() * 1.2, { segs: 9, rings: 5, amp: .22, seed: k + 80 }); }
      // the entry landing (front strip, the top), the doorway, the flights and their landings, railings
      const plat = (x0, y0, x1, y1, z) => { M.block('darkwood', (x0 + x1) / 2, (y0 + y1) / 2, z - .3, x1 - x0, y1 - y0, .3); M.quad('wood', [[x0, y0, z + .005], [x1, y0, z + .005], [x1, y1, z + .005], [x0, y1, z + .005]]); };
      plat(-I, I, S, S, TOP);
      for (const t of [-1, 1]) M.block('stone', t * 2.3, S + .2, TOP, .8, .5, 4.6); M.block('stone', 0, S + .2, TOP + 4.5, 5.4, .5, .6); M.quad('doorview', [[-1.9, S + .45, TOP], [1.9, S + .45, TOP], [1.9, S + .45, TOP + 4.5], [-1.9, S + .45, TOP + 4.5]]);
      railK(M, [-I, I, TOP], [I, I, TOP], 1.4);
      ydPlan().forEach(f => {
        const [x0, y0, x1, y1] = f.box, h0 = f.hiAtMin ? f.hi : f.lo, h1 = f.hiAtMin ? f.lo : f.hi;
        flightK(M, 'darkwood', f.axis === 'z' ? 'y' : 'x', x0, x1, y0, y1, h0, h1, 12);
        if (f.lo > 0) { const [cx0, cy0, cx1, cy1] = f.corner; plat(cx0, cy0, cx1, cy1, f.lo); M.block('darkwood', (cx0 + cx1) / 2 + ((cx0 + cx1) > 0 ? -1.6 : 1.6), (cy0 + cy1) / 2 + ((cy0 + cy1) > 0 ? -1.6 : 1.6), f.lo - 4, .3, .3, 4); if (f.k % 2) lanternS(M, (cx0 + cx1) / 2, (cy0 + cy1) / 2, f.lo + 3.2, 'lantern', .3, .55); }
        const [rx0, ry0, rx1, ry1] = f.rail, along = f.axis === 'z', a = along ? [ (rx0 + rx1) / 2, ry0, f.hiAtMin ? f.hi : f.lo] : [rx0, (ry0 + ry1) / 2, f.hiAtMin ? f.hi : f.lo], b = along ? [(rx0 + rx1) / 2, ry1, f.hiAtMin ? f.lo : f.hi] : [rx1, (ry0 + ry1) / 2, f.hiAtMin ? f.lo : f.hi];
        if (f.k === 4) { const m = [a[0], 0, (a[2] + b[2]) / 2]; railK(M, a, [m[0], -1.2, a[2] + (b[2] - a[2]) * (7.8 / 18)], 1.3, 'rope', 'darkwood'); railK(M, [m[0], 1.2, a[2] + (b[2] - a[2]) * (10.2 / 18)], b, 1.3, 'rope', 'darkwood'); }
        else railK(M, a, b, 1.3, 'rope', 'darkwood');
      });
      // the rope bridge, the pillar and its little shrine
      for (let k = 0; k < 14; k++) { const x = 2.5 + k * (I - 2.5) / 14; M.box('wood', [x + .2, 0, PH - .06], [.36, 2.3, .08]); }
      for (const s of [-1, 1]) { M.rod('rope', [2.4, s * 1.25, PH + 1.2], [I, s * 1.25, PH + 1.2], .04, 4); M.rod('rope', [2.4, s * 1.2, PH - .05], [I, s * 1.2, PH - .05], .05, 4); for (let k = 0; k <= 6; k++) { const x = 2.4 + k * (I - 2.4) / 6; M.rod('rope', [x, s * 1.22, PH - .05], [x, s * 1.25, PH + 1.2], .02, 3); } }
      M.cyl('granite', [0, 0, 0], 1.6, PH - .4, 14, 1.9); M.cyl('stone', [0, 0, PH - .4], 2.6, .4, 20); discK(M, 'stone', [0, 0, PH + .002], [1, 0, 0], [0, 1, 0], 2.6, 20);
      for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8; if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) <= .5) continue; M.cyl('darkwood', [Math.cos(a) * 2.5, Math.sin(a) * 2.5, PH], .06, 1.2, 4); }
      M.block('stone', -.8, 0, PH, 1.2, 1, .3); M.block('darkwood', -.8, 0, PH + .3, .8, .7, .8); M.roof(-.8, 0, PH + 1.1, 1.3, 1.2, .4, { lift: .12, ornaments: false, gable: false }); flame(M, .4, .7, PH, .25, ['spirit', 'orb']);
      // mist at three depths, the blue pool at the bottom, a trickle of water down one wall
      for (const z of [8, 15, 22]) M.quad('mist_low', [[-I, -I, z], [I, -I, z], [I, I, z], [-I, I, z]]);
      discK(M, 'water', [0, 0, .05], [1, 0, 0], [0, 1, 0], 5, 32); discK(M, 'spirit', [0, 0, .06], [1, 0, 0], [0, 1, 0], 3.2, 24); M.tube('stone_dark', [0, 0, 0], [0, 0, .25], 5.2, 5.2, 32, false);
      M.quad('falls_curtain', [[-S + .3, -4, 0], [-S + .3, -2.4, 0], [-S + .3, -2.4, Hs - 1], [-S + .3, -4, Hs - 1]], [[0, 0], [.4, 0], [.4, 6], [0, 6]]);
    },
    // the Sohei Bell Temple (lore): the great bronze bell hanging in its massive timber frame, the striking log on its ropes
    // swinging gently beside it; tiered racks of candles along the walls, the wooden fish drum on its cushion, saffron banners
    room_sohei_bell(M) {
      M.room = true;
      const { HX, HY, H, DW, DH, LIP, BR, FP } = SB;
      hall(M, { HX, HY, H, DW, DH, floor: 'wood', wall: 'plaster', wain: 'darkwood', wainH: 1.6, rail: 'gold', post: 'darkwood', postEvery: 4, beam: 'darkwood', ceil: 'darkwood', ceilBeam: 'darkwood', ceilEvery: 3 });
      // the frame: four posts, double beams, braces, the hook
      const zt = LIP + 8.2;
      for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { M.block('stone', a * FP, b * FP, 0, 1.4, 1.4, .5); M.block('darkwood', a * FP, b * FP, .5, .8, .8, zt + .6); M.rod('darkwood', [a * FP, b * FP, zt - 2.2], [a * (FP - 1.6), b * FP, zt - .1], .14, 4); }
      for (const s of [-1, 1]) { M.box('darkwood', [0, s * FP, zt + .3], [2 * FP + 1.4, .9, .7]); M.box('darkwood', [s * FP, 0, zt + 1.05], [.9, 2 * FP + 1.4, .7]); }
      M.box('darkwood', [0, 0, zt + .3], [2 * FP, .9, .7]); M.rod('iron', [0, 0, zt], [0, 0, zt - .6], .12, 6);
      // the bell: flared lip, body, bands, the dome, the bosses, the striking seats, the dragon loop
      M.tube('bell_bronze', [0, 0, LIP], [0, 0, LIP + .5], BR, BR - .25, 36, false); M.tube('bell_bronze', [0, 0, LIP + .5], [0, 0, LIP + 5.4], BR - .25, BR - .42, 36, false);
      discK(M, 'dark', [0, 0, LIP + .9], [1, 0, 0], [0, 1, 0], BR - .3, 24); M.sphere('bell_bronze', [0, 0, LIP + 5.4], BR - .42, .42, 24, 8);
      for (const z of [LIP + 1.6, LIP + 1.85, LIP + 4.6]) M.tube('bronze', [0, 0, z], [0, 0, z + .12], BR - .3 - (z - LIP) * .035, BR - .3 - (z - LIP) * .035, 36, false);
      for (let q = 0; q < 4; q++) for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { const a = q * Math.PI / 2 + (i - 1.5) * .17, z = LIP + 3.5 + j * .32, rr = BR - .38 - (z - LIP) * .03; M.sphere('bronze', [Math.cos(a) * rr, Math.sin(a) * rr, z], .08, 1, 6, 3); }
      for (const s of [-1, 1]) { M.rod('gold', [s * (BR - .38), 0, LIP + 1.2], [s * (BR - .3), 0, LIP + 1.2], .3, 16); }
      for (const s of [-1, 1]) curveTube(M, 'bell_bronze', [[s * .5, 0, LIP + 6.3], [s * .4, 0, LIP + 7.1], [0, 0, LIP + 7.5], [-s * .1, 0, LIP + 7.2]], [.16, .14, .12, .1], { segs: 8, n: 4, seed: 90 + s });
      // candle racks, the fish drum, banners, the emblem
      for (const s of [-1, 1]) { const x = s * (HX - .6); for (let t = 0; t < 3; t++) { M.block('darkwood', x - s * t * .25, -3, .7 + t * .5, .5, 11.4, .08); for (let k = 0; k < 14; k++) { const y = -8.4 + k * .8 + (t % 2) * .4; M.cyl('candle', [x - s * t * .25, y, .78 + t * .5], .05, .26 + .08 * ((k + t) % 3), 6); M.sphere('fire', [x - s * t * .25, y, 1.12 + t * .5 + .08 * ((k + t) % 3)], .05, 1.6, 5, 3); } } M.block('darkwood', x, -3, 0, .7, 11.6, .7); }
      M.block('cushion', -6, 6.5, 0, 1.6, 1.6, .2); M.sphere('wood', [-6, 6.5, 1], .85, .82, 14, 7); M.rod('dark', [-6.8, 6.5, 1.02], [-5.2, 6.5, 1.02], .06, 4); M.rod('wood', [-5, 7.4, .3], [-4.4, 7.6, 1.2], .04, 4); M.sphere('wood', [-4.35, 7.62, 1.25], .14, 1, 6, 3);
      for (const s of [-1, 1]) wallArt(M, 'back', s * 7.5, 2, 2.4, 6.4, 'banner_sohei', HX, HY, .08); wallArt(M, 'back', 0, 5.6, 3, 3, 'mark_sohei', HX, HY, .08);
      for (const [x, y] of [[-10.6, 10.6], [10.6, 10.6]]) andon(M, x, y, 0, 1.2);
    },
    // the striking log (a part, swinging on its ropes from the beam above)
    room_sohei_shumoku(M) { M.room = true; const z = -6.2; M.rod('bark', [-2.4, 0, z], [2.4, 0, z], .38, 12); M.rod('wood', [-2.45, 0, z], [-2.4, 0, z], .36, 12); for (const x of [-1.5, 1.5]) { M.rod('rope', [x, 0, z + .38], [x, 0, 0], .05, 4); M.cyl('rope', [x - .1, 0, z], .4, .12, 10); } M.rod('rope', [2.4, 0, z], [3.4, 0, z - 1], .03, 3); },
    // the Sohei Great Dojo (training): the goma fire burning on its stone altar at the head of the hall under the Sohei banner,
    // smoke rising; the training ring on the stone floor, staffs and naginata in their racks round it; pillars wrapped in prayer
    // ribbons, more ribbons hanging
    room_sohei_dojo(M) {
      M.room = true;
      const { HX, HY, H, DW, DH, AL, RING } = SG, [ax, ay0, ay1, ah] = AL;
      hall(M, { HX, HY, H, DW, DH, floor: 'wood', wall: 'plaster', wain: 'darkwood', wainH: 1.4, rail: 'gold', post: 'darkwood', postEvery: 5, beam: 'darkwood', ceil: 'darkwood', ceilBeam: 'darkwood', ceilEvery: 3.75 });
      discK(M, 'stone', [0, 1, .012], [1, 0, 0], [0, 1, 0], RING + 1, 48); M.tube('orange', [0, 1, .01], [0, 1, .025], RING, RING, 48, false);
      for (let k = 0; k < 48; k++) { const a0 = k / 48 * 6.283, a1 = (k + 1) / 48 * 6.283; M.quad('orange', [[Math.cos(a0) * RING, 1 + Math.sin(a0) * RING, .02], [Math.cos(a1) * RING, 1 + Math.sin(a1) * RING, .02], [Math.cos(a1) * (RING + .18), 1 + Math.sin(a1) * (RING + .18), .02], [Math.cos(a0) * (RING + .18), 1 + Math.sin(a0) * (RING + .18), .02]]); }
      // the altar, its steps, the fire pit and the pyre, smoke, the banner
      M.block('stone', 0, (ay0 + ay1) / 2, 0, 2 * ax, ay1 - ay0, ah); M.block('gold', 0, ay1 + .01, ah - .1, 2 * ax, .04, .08); stairsK(M, 'stone', -1.6, 1.6, ay1, ay1 + 1.2, 0, ah, 4, -1);
      const fy = -12.6; M.block('stone_dark', 0, fy, ah, 3, 3, .5); M.block('dark', 0, fy, ah + .45, 2.4, 2.4, .06);
      for (let lay = 0; lay < 5; lay++) for (let k = 0; k < 4; k++) { const o = -.9 + k * .6, z = ah + .55 + lay * .22; if (lay % 2) M.rod('wood', [o, fy - 1.1, z], [o, fy + 1.1, z], .1, 5); else M.rod('wood', [-1.1, fy + o, z], [1.1, fy + o, z], .1, 5); }
      flame(M, 0, fy, ah + .7, 1.7); flame(M, -.5, fy + .4, ah + .9, .9); flame(M, .5, fy - .3, ah + .9, 1);
      for (let k = 0; k < 3; k++) M.quad('smoke', [[-1 - k * .3, fy + k * .1, ah + 3 + k * 2], [1 + k * .3, fy + k * .1, ah + 3 + k * 2], [1.4 + k * .4, fy + k * .1, ah + 5 + k * 2], [-1.4 - k * .4, fy + k * .1, ah + 5 + k * 2]]);
      wallArt(M, 'back', 0, ah + .4, 5.4, 7.4, 'banner_sohei', HX, HY, .08);
      for (const s of [-1, 1]) toroK(M, s * 5.2, -13.4, ['fire', 'lantern'], .9);
      // the weapon racks round the ring: staffs and naginata
      for (const d of [30, 150, 210, 330]) {
        const a = d * Math.PI / 180, x = Math.cos(a) * 11.6, y = 1 + Math.sin(a) * 9.4, t = Math.atan2(-Math.cos(a), Math.sin(a)), c = Math.cos(t), s = Math.sin(t);
        M.box('darkwood', [x, y, .15], [2.4, .5, .3], t); M.box('darkwood', [x, y, 2.6], [2.4, .3, .12], t);
        for (let k = 0; k < 5; k++) { const o = -.9 + k * .45, px = x + c * o, py = y + s * o; M.rod('wood', [px, py, .3], [px, py, 4.4], .05, 5); if (k % 2) M.box('steel', [px, py, 4.75], [.08, .05, .7], t); }
      }
      // the pillars wound with prayer ribbons, more ribbons hanging from them
      for (const z of [-8, -2, 4, 10]) for (const sx of [-1, 1]) {
        const x = sx * 11; M.cyl('stone', [x, z, 0], .7, .3, 10); M.cyl('darkwood', [x, z, .3], .45, H - .6, 12);
        const cols = ['orange', 'red', 'paper']; for (let q = 0; q < 3; q++) { let prev = null; for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI * 6 + q * 2.1, p = [x + Math.cos(a) * .48, z + Math.sin(a) * .48, 1.2 + i * .22]; if (prev) M.rod(cols[q], prev, p, .035, 3); prev = p; } }
        for (let q = 0; q < 4; q++) { const a = q * 1.57 + .4; M.box(cols[q % 3], [x + Math.cos(a) * .5, z + Math.sin(a) * .5, 5.4], [.14, .02, 1.6], a); }
      }
    },
    // the Sohei Library (lore): the octagonal sutra repository turning slowly on its pivot in the middle; low desks with sutras
    // open on them, sutra boxes stacked on the shelves along the walls
    room_sohei_library(M) {
      M.room = true;
      const { HX, HY, H, DW, DH, RZ } = SK;
      hall(M, { HX, HY, H, DW, DH, floor: 'wood', wall: 'plaster_old', wain: 'darkwood', wainH: 1.2, rail: 'lacquer_red', post: 'lacquer_red', postEvery: 4, beam: 'darkwood', ceil: 'darkwood', ceilBeam: 'darkwood', ceilEvery: 3 });
      M.cyl('stone', [0, -1, 0], RZ + .8, .5, 8); M.tube('gold', [0, -1, .5], [0, -1, .56], RZ + .8, RZ + .8, 8, false); M.cyl('stone_dark', [0, -1, .5], RZ + .4, .02, 8);
      for (const s of [-1, 1]) { const x = s * (HX - .5); for (let t = 0; t < 5; t++) { M.block('darkwood', x, 0, .2 + t * 1.1, 1, 19, .08); for (let k = 0; k < 18; k++) { const y = -8.6 + k * 1.02; M.block(k % 3 ? 'lacquer_red' : 'lacquer_black', x, y, .28 + t * 1.1, .8, .8, .55); M.block('gold', x - s * .41, y, .5 + t * 1.1, .02, .5, .08); } } M.block('darkwood', x, 0, 0, 1.1, 19.6, .2); }
      for (const [x, y] of [[-6.5, 5.5], [6.5, 5.5], [-6.5, -7], [6.5, -7]]) { M.block('lacquer_red', x, y, 0, 2.6, 1.1, .55); M.quad('scroll_sam', [[x - 1.1, y - .4, .56], [x + 1.1, y - .4, .56], [x + 1.1, y + .4, .56], [x - 1.1, y + .4, .56]]); M.rod('darkwood', [x - 1.2, y - .42, .62], [x - 1.2, y + .42, .62], .07, 6); for (const t of [-1, 1]) M.block('cushion', x + t * .9, y + 1.15, 0, .9, .9, .12); }
      for (const s of [-1, 1]) wallArt(M, 'back', s * 6, 2.4, 2, 5, 'banner_sohei', HX, HY, .08); wallArt(M, 'back', 0, 4.4, 2.4, 2.4, 'mark_sohei', HX, HY, .08);
      for (const [x, y] of [[-10.4, 10.4], [10.4, 10.4], [-10.4, -10.6], [10.4, -10.6]]) andon(M, x, y, 0, 1.2);
    },
    // the revolving sutra repository (a part): eight faces of small drawers between red posts, push bars, the roof and its finial
    room_sohei_rinzo(M) {
      M.room = true; const R = SK.RZ, n = 8, Hh = 5.6;
      for (let k = 0; k < n; k++) {
        const a0 = (k + .5) / n * 6.283, a1 = (k + 1.5) / n * 6.283, p0 = [Math.cos(a0) * R, Math.sin(a0) * R], p1 = [Math.cos(a1) * R, Math.sin(a1) * R], L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
        M.quad('drawers_red', [[p0[0], p0[1], .4], [p1[0], p1[1], .4], [p1[0], p1[1], Hh], [p0[0], p0[1], Hh]], [[0, 0], [L / 1.2, 0], [L / 1.2, (Hh - .4) / 1.2], [0, (Hh - .4) / 1.2]]);
        M.cyl('lacquer_red', [p0[0] * 1.02, p0[1] * 1.02, 0], .16, Hh + .3, 8); const am = (a0 + a1) / 2; M.rod('darkwood', [Math.cos(am) * (R + .1), Math.sin(am) * (R + .1), 1.6], [Math.cos(am) * (R + .9), Math.sin(am) * (R + .9), 1.6], .07, 5);
      }
      M.cyl('darkwood', [0, 0, 0], R + .1, .4, n); M.cyl('lacquer_red', [0, 0, Hh], R + .4, .3, n); M.cyl('roof', [0, 0, Hh + .3], R + .8, 1.4, n, .5); M.cyl('gold', [0, 0, Hh + 1.7], .4, .9, 8, .05); M.sphere('gold', [0, 0, Hh + 2.7], .28, 1, 8, 4);
    },
    // the Sohei Rite Hall (video): the floor a shallow pool with paper lanterns floating on it, the walkway across it to the stage,
    // the silk banners hanging over the stage (the film plays on the middle one), the golden light from the high windows
    room_sohei_rite(M) {
      M.room = true;
      const { HX, HY, H, DW, DH, WK, ST, LD, FD, Y } = SR;
      hall(M, { HX, HY, H, DW, DH, floor: 'stone_dark', wall: 'plaster', wain: 'darkwood', wainH: 1.4, rail: 'gold', post: 'darkwood', postEvery: 4.333, beam: 'darkwood', ceil: 'darkwood', ceilBeam: 'darkwood', ceilEvery: 3.25 });
      M.quad('water_flow', [[-HX + LD, ST, .25], [HX - LD, ST, .25], [HX - LD, HY - FD, .25], [-HX + LD, HY - FD, .25]], [[0, 0], [(2 * HX - 2 * LD) / 4, 0], [(2 * HX - 2 * LD) / 4, (HY - FD - ST) / 4], [0, (HY - FD - ST) / 4]]);
      const deck = (x0, y0, x1, y1, z, mat = 'wood') => { M.block('darkwood', (x0 + x1) / 2, (y0 + y1) / 2, 0, x1 - x0, y1 - y0, z - .06); M.block(mat, (x0 + x1) / 2, (y0 + y1) / 2, z - .06, x1 - x0, y1 - y0, .06); };
      deck(-WK, ST, WK, HY, Y); deck(-HX, ST, -HX + LD, HY, Y, 'stone'); deck(HX - LD, ST, HX, HY, Y, 'stone'); deck(-HX, HY - FD, HX, HY, Y); deck(-HX, -HY, HX, ST, Y + .3);
      for (const s of [-1, 1]) for (let y = ST + 1; y < HY - FD - .1; y += 2.4) { M.cyl('lacquer_red', [s * (WK + .05), y, Y], .06, .9, 6); M.sphere('gold', [s * (WK + .05), y, Y + .95], .08, 1, 6, 3); }
      for (const s of [-1, 1]) M.rod('lacquer_red', [s * (WK + .05), ST + 1, Y + .85], [s * (WK + .05), ST + 1 + 2.4 * Math.floor((HY - FD - .1 - ST - 1) / 2.4), Y + .85], .04, 4);
      // the silk banners on their beam, incense on the stage
      M.box('darkwood', [0, -11.8, 8.4], [18, .3, .3]); for (const [x, w] of [[-6.6, 4], [0, 5.4], [6.6, 4]]) { M.quad('silk', [[x + w / 2, -11.75, 2], [x - w / 2, -11.75, 2], [x - w / 2, -11.75, 8.25], [x + w / 2, -11.75, 8.25]]); M.rod('darkwood', [x - w / 2 - .1, -11.75, 1.98], [x + w / 2 + .1, -11.75, 1.98], .05, 6); }
      for (const s of [-1, 1]) { const ix = s * 13.6, iy = -12.1; M.cyl('bronze', [ix, iy, Y + .3], .5, .7, 12, .4); M.quad('smoke', [[ix - .3, iy, Y + 1.2], [ix + .3, iy, Y + 1.2], [ix + .7, iy, Y + 5], [ix - .7, iy, Y + 5]]); }
      // high windows and the light sheets falling across the pool
      for (const s of [-1, 1]) for (const y of [-4, 3]) { wallArt(M, s < 0 ? 'left' : 'right', y, 6.6, 3, 2, 'shoji_lit', HX, HY, .05); M.quad('shaft_sun', [[s * (HX - 8), y + 1.6, .3], [s * (HX - 8), y - 1.6, .3], [s * (HX - .1), y - 1.4, 7.5], [s * (HX - .1), y + 1.4, 7.5]]); }
      for (const [x, y] of [[-2.5, HY - FD - 1], [2.5, HY - FD - 1]]) andon(M, x, y, .25, 1.1); // standing in the pool by the walkway
    },
    // a paper lantern floating on the pool (a part: bobbing, turning slowly)
    room_sohei_float_lantern(M) { M.room = true; M.block('wood', 0, 0, 0, .6, .6, .06); M.block('andon', 0, 0, .06, .44, .44, .46); M.block('darkwood', 0, 0, .52, .52, .52, .04); }
  });
  // ── Wokou and Warrior rooms ──
  // draw f() moved to (x, y, z) and turned by a (for helpers that build at the origin)
  function atK(M, x, y, z, a, f) {
    const c = Math.cos(a), s = Math.sin(a), poly = M.poly;
    M.poly = (m, pts, uvs, nrm) => poly.call(M, m, pts.map(p => [x + p[0] * c - p[1] * s, y + p[0] * s + p[1] * c, z + p[2]]), uvs, nrm && [nrm[0] * c - nrm[1] * s, nrm[0] * s + nrm[1] * c, nrm[2]]);
    try { f(); } finally { M.poly = poly; }
  }
  // a round shield on a wall (side -1 left wall, +1 right), the cracked circle on it
  function shieldK(M, side, y, z, r, X, HY) {
    const x = side * (X - .1); M.rod('darkwood', [x - side * .04, y, z], [x + side * .04, y, z], r, 18); M.tube('iron', [x - side * .1, y, z], [x + side * .06, y, z], r + .04, r + .04, 18, false);
    M.sphere('iron', [x - side * .1, y, z], r * .22, .5, 8, 4); wallArt(M, side < 0 ? 'left' : 'right', y, z - r * .7, r * 1.4, r * 1.4, 'mark_warrior', X - .2, HY, 0);
  }
  // a weapon rack along a side wall from y0 to y1: spears and halberds leaning, swords on pegs, helmets
  function weaponWall(M, side, y0, y1, X, seed, worn) {
    let sd = seed; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647, x = side * (X - .45);
    for (const z of [.4, 2.6]) M.block('darkwood', x, (y0 + y1) / 2, z, .5, y1 - y0, .14);
    for (let y = y0 + .3; y < y1; y += .42) {
      const tilt = worn ? (r() - .5) * .12 : 0, L = 3.6 + r() * (worn && r() < .25 ? -1.2 : .8), top = [x - side * .15 + tilt, y + tilt, L];
      M.rod('wood', [x + side * .1, y, .1], top, .045, 5);
      const k = r(); if (k < .5) M.box('steel', [top[0], top[1], top[2] + .32], [.06, .14, .62]); else if (k < .8) { M.box('steel', [top[0], top[1] + .14, top[2] - .1], [.05, .36, .5]); M.box('steel', [top[0], top[1], top[2] + .25], [.05, .08, .4]); } else M.cyl('iron', [top[0], top[1], top[2] - .1], .1, .4, 6, .02);
    }
    for (let y = y0 + .8; y < y1 - .4; y += 1.7) { const z = 4.2 + (r() - .5) * .3; M.box('steel', [side * (X - .14), y, z], [.06, 1.5, .12], 0, (r() - .5) * .3); M.box('darkwood', [side * (X - .14), y - .95, z], [.08, .4, .14]); }
    for (let y = y0 + 1.2; y < y1 - .4; y += 2.6) { M.rod('darkwood', [side * X, y, 5.6], [side * (X - .4), y, 5.6], .04, 4); M.sphere(worn && r() < .5 ? 'rust' : 'iron', [side * (X - .45), y, 5.85], .34, 1.05, 10, 5); M.box('iron', [side * (X - .45), y, 5.6], [.74, .5, .1]); }
  }
  Object.assign(B, {
    // the Wokou Ship Hold (explore): down the ladder from the deck hatch into the hull, its ribs curving up into the deck beams
    // low overhead; crates lashed along one side, barrels along the other, hammocks slung in the bow, lanterns swinging with the
    // swell, bilge water in the bow round the captain's chest of gold
    room_wok_hold(M) {
      M.room = true;
      const { HX, HY, H, HT, FW } = WH, st = [];
      for (let y = -HY; y <= HY + .01; y += 1) st.push(y);
      const ring = y => { const s = whW(y); return [[-HX * s, y, H], [-HX * s, y, 2.8], [-4.5 * s, y, 1.3], [-FW * s, y, 0], [FW * s, y, 0], [4.5 * s, y, 1.3], [HX * s, y, 2.8], [HX * s, y, H]]; };
      const P = st.map(ring); M.grid('darkwood', P, st.map((y, i) => P[i].map((_, k) => [k * .9, y / 1.6])));
      M.poly('darkwood', P[0]); M.poly('darkwood', P[P.length - 1]);
      // plank floor (the bow left to the bilge water), deck beams and the deck over them with the hatch, ribs and knees
      for (let i = 0; i + 1 < st.length; i++) { const a = st[i], b = st[i + 1], wa = FW * whW(a) - .05, wb = FW * whW(b) - .05; M.quad(a < -10.5 ? 'water' : 'wood', [[-wa, a, .02], [wa, a, .02], [wb, b, .02], [-wb, b, .02]], [[-wa / 1.6, a / 1.6], [wa / 1.6, a / 1.6], [wb / 1.6, b / 1.6], [-wb / 1.6, b / 1.6]]); }
      const cy = [...st.filter(y => y < HT - 1.5), HT - 1.5, HT + 1.5, ...st.filter(y => y > HT + 1.5)];
      for (let i = 0; i + 1 < cy.length; i++) { const a = cy[i], b = cy[i + 1], wa = HX * whW(a), wb = HX * whW(b);
        if (a >= HT - 1.5 && b <= HT + 1.5) for (const sd of [-1, 1]) M.quad('wood', [[sd * 1.5, a, H], [sd * wa, a, H], [sd * wb, b, H], [sd * 1.5, b, H]]); else M.quad('wood', [[-wa, a, H], [wa, a, H], [wb, b, H], [-wb, b, H]]); }
      for (let y = -12.5; y <= 12.6; y += 1.5) {
        const s = whW(y), w = HX * s; M.block('darkwood', 0, y, H - .32, 2 * w - .2, .3, .32);
        const q = ring(y).map(p => [p[0] - Math.sign(p[0]) * .12, p[1], p[2]]); for (const [a, b] of [[0, 1], [1, 2], [2, 3], [4, 5], [5, 6], [6, 7]]) M.rod('darkwood', q[a], q[b], .1, 5);
        for (const sd of [-1, 1]) M.rod('darkwood', [sd * (w - .15), y, H - 1.3], [sd * (w - 1.1), y, H - .3], .08, 4);
      }
      // the hatch: its coaming, daylight through it and down the ladder
      for (const sd of [-1, 1]) { M.block('darkwood', sd * 1.6, HT, H - .1, .2, 3.2, .45); M.block('darkwood', 0, HT + sd * 1.6, H - .1, 3.4, .2, .45); }
      M.quad('skyhole', [[-1.5, HT - 1.5, H + .3], [1.5, HT - 1.5, H + .3], [1.5, HT + 1.5, H + .3], [-1.5, HT + 1.5, H + .3]]);
      M.quad('shaft_white', [[-1.4, HT - 2.2, 0], [1.4, HT - 2.2, 0], [1.4, HT - .4, H], [-1.4, HT - .4, H]]); M.quad('shaft_white', [[0, HT - 2.8, 0], [0, HT - .4, 0], [0, HT + .6, H], [0, HT - 1.4, H]]);
      for (const sd of [-1, 1]) M.rod('wood', [sd * .55, HT + 1.4, 0], [sd * .55, HT + .3, H + .6], .07, 5);
      for (let k = 1; k < 15; k++) { const t = k / 15; M.rod('wood', [-.55, HT + 1.4 - 1.1 * t, (H + .6) * t], [.55, HT + 1.4 - 1.1 * t, (H + .6) * t], .045, 4); }
      // the cabin bulkhead behind the ladder: a closed door, a lantern
      M.block('darkwood', 0, HY - .1, 0, 1.8, .1, 3.2); M.block('iron', .6, HY - .18, 1.5, .1, .06, .3); M.cyl('lantern', [-1.6, HY - .3, 3], .16, .4, 6);
      // crates lashed along the port side, barrels to starboard, rope coils, a sack or two
      for (const [y, z, sz] of [[2, 0, 1.2], [3.3, 0, 1.2], [4.6, 0, 1.2], [6.6, 0, 1.2], [7.9, 0, 1.2], [2.6, 1.2, 1.1], [3.9, 1.2, 1.1], [7.2, 1.2, 1.1], [3.3, 2.3, 1]]) { M.block('wood', -2.75, y, z, sz, sz, sz); M.block('darkwood', -2.75, y, z + sz * .45, sz + .02, sz + .02, .08); }
      for (const y of [2.6, 4.2, 7.2]) { M.rod('rope', [-3.5, y, 3.35], [-2.1, y, 3.35], .03, 3); M.rod('rope', [-2.1, y, 3.35], [-2.1, y, .05], .03, 3); }
      for (let y = -3.8; y <= 6; y += 1.05) { M.cyl('wood', [2.75, y, 0], .46, 1.1, 12, .42); for (const z of [.15, .95]) M.cyl('iron', [2.75, y, z], .47, .06, 12); }
      for (const y of [-3.3, -1.2, .9, 3, 5.1]) { M.rod('wood', [2.75, y - .5, 1.6], [2.75, y + .5, 1.6], .42, 12); for (const dy of [-.35, .35]) M.rod('iron', [2.75, y + dy - .03, 1.6], [2.75, y + dy + .03, 1.6], .43, 12); }
      for (const [x, y] of [[-2.6, .6], [2.4, -5]]) for (let k = 0; k < 4; k++) M.tube('rope', [x, y, k * .09], [x, y, k * .09 + .08], .45 - k * .04, .45 - k * .04, 12, false);
      M.sphere('sack', [-2.5, -.6, .4], .5, .7, 8, 4); M.sphere('sack', [-2.9, -1.3, .4], .5, .7, 8, 4);
      // hammocks slung between the beams in the bow, one with a sleeper's bundle in it
      for (const [x, y0, y1, full] of [[-1.5, -9.5, -6.5, true], [1.5, -9.5, -6.5, false], [-1.2, -12.5, -9.5, false]]) {
        const rows = [], uv = []; for (let i = 0; i <= 8; i++) { const t = i / 8, y = y0 + (y1 - y0) * t, z = H - .5 - 1.4 * Math.sin(Math.PI * t); rows.push([[x - .45, y, z + .12], [x, y, z], [x + .45, y, z + .12]]); uv.push([[0, t], [.5, t], [1, t]]); }
        M.grid('sail', rows, uv); for (const y of [y0, y1]) M.rod('rope', [x, y, H - .35], [x, y + (y1 > y0 ? 1 : -1) * .3 * (y === y0 ? 1 : -1), H - .55], .02, 3);
        if (full) { M.sphere('cloth', [x, (y0 + y1) / 2, H - 1.75], .4, .6, 8, 4); M.sphere('sack', [x, (y0 + y1) / 2 - .6, H - 1.7], .3, .7, 8, 4); }
      }
      // the captain's chest in the bilge, open, gold spilling out
      M.block('darkwood', 0, -11.6, 0, 2.2, 1.6, .25); M.block('darkwood', 0, -11.6, .25, 1.6, .9, .8); for (const dx of [-.6, .6]) M.block('iron', dx, -11.6, .25, .08, .92, .82);
      M.box('darkwood', [0, -12.12, 1.5], [1.6, .1, .9], 0, -.28); for (let k = 0; k < 16; k++) { const a = k * 2.4, d = .1 + .05 * k; M.sphere('coin', [Math.cos(a) * d * .9, -11.6 + Math.sin(a) * d * .5, 1.05 + .06 * (k % 3)], .12, .5, 6, 3); }
      for (const [dx, dy] of [[.5, -.6], [.9, -.2], [-.7, .6], [1.2, .3]]) M.cyl('coin', [dx, -11.6 + dy, .26], .12, .03, 8);
    },
    // a lantern hanging from a deck beam (a part: it swings with the ship)
    room_wok_lantern(M) { M.room = true; M.rod('rope', [0, 0, 0], [0, 0, -.7], .02, 3); M.cyl('iron', [0, 0, -.82], .2, .12, 6, .05); M.block('window_glow', 0, 0, -1.32, .3, .3, .5); for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) M.rod('iron', [a * .17, b * .17, -1.34], [a * .17, b * .17, -.82], .02, 3); M.block('iron', 0, 0, -1.4, .38, .38, .08); },
    // the Wokou Trade House (lore): the merchant's counting hall, the long counter with the scales, the abacus and the ledger;
    // spice sacks open along one wall, bolts of silk hanging along the other, porcelain behind glass, the strongbox, and the
    // trade-routes chart of every port the raiders sail to across the back wall
    room_wok_trade(M) {
      M.room = true;
      const { HX, HY, H, DW, DH, CY, GX } = WT;
      hall(M, { HX, HY, H, DW, DH, floor: 'darkwood', wall: 'plaster_old', wain: 'maroon', wainH: 1.3, rail: 'gold', post: 'darkwood', postEvery: 4, beam: 'darkwood', ceil: 'darkwood', ceilBeam: 'darkwood', ceilEvery: 2.5 });
      for (const [x0, x1] of [[-HX, GX[0]], [GX[1], HX]]) { M.block('darkwood', (x0 + x1) / 2, CY, 0, x1 - x0, 1, 1.25); M.block('wood', (x0 + x1) / 2, CY, 1.25, x1 - x0, 1.2, .08); M.block('maroon', (x0 + x1) / 2, CY + .51, .2, x1 - x0, .02, .85); }
      M.block('wood', GX[0] + .06, CY, 1.33, .08, 1.2, 1.15);
      // the scales, the abacus, coins, the ledger, the bell
      const zc = 1.33; M.rod('gold', [-3, CY, zc], [-3, CY, zc + 1.1], .04, 6); M.rod('gold', [-3.7, CY, zc + 1.1], [-2.3, CY, zc + 1.1], .03, 4); M.cyl('gold', [-3, CY, zc], .25, .05, 10);
      for (const [x, h] of [[-3.65, .55], [-2.35, .75]]) { for (const t of [-1, 1]) M.rod('gold', [x, CY, zc + 1.1], [x + t * .14, CY, zc + h], .008, 3); M.cyl('gold', [x, CY, zc + h - .03], .2, .04, 10); }
      M.cyl('coin', [-2.35, CY, zc + .76], .08, .06, 8);
      M.block('darkwood', 2, CY, zc, 1.1, .12, .06); for (const sd of [-1, 1]) M.block('darkwood', 2 + sd * .52, CY, zc, .06, .12, .7); M.block('darkwood', 2, CY, zc + .64, 1.1, .12, .06);
      for (let k = 0; k < 7; k++) { const x = 1.6 + k * .13; M.rod('brass', [x, CY, zc + .06], [x, CY, zc + .64], .008, 3); for (let b = 0; b < 4; b++) M.sphere(b ? 'darkwood' : 'lacquer_red', [x, CY, zc + .14 + b * .1 + (k % 3 ? 0 : .18)], .045, .7, 6, 3); }
      for (const [x, y, n] of [[-1, CY - .2, 6], [-.7, CY + .25, 4], [-.4, CY - .1, 8]]) for (let k = 0; k < n; k++) M.cyl('coin', [x, y, zc + k * .03], .1, .025, 8);
      M.block('paper', 4.6, CY, zc, 1.1, .8, .03); M.block('maroon', 4.6, CY, zc - .01, 1.2, .86, .02); M.rod('darkwood', [4.6, CY - .4, zc + .04], [4.6, CY + .4, zc + .04], .02, 4); M.sphere('brass', [6.4, CY, zc + .1], .12, .8, 8, 4);
      // behind the counter: the merchant's desk and the strongbox
      M.block('darkwood', 0, -5.5, 0, 3.4, 2, .9); M.block('paper', -.6, -5.4, .9, 1, .7, .02); M.block('cushion', 0, -3.9, 0, 1, 1, .14);
      M.block('darkwood', 2.6, -5.6, 0, 1.6, 1.1, 1); for (const dx of [-.5, 0, .5]) M.block('iron', 2.6 + dx, -5.6, 0, .07, 1.12, 1.02); M.block('brass', 2.6, -5.04, .55, .2, .04, .22);
      // the trade-routes chart across the back wall, porcelain cases to its left
      wallArt(M, 'back', 4.5, 1.4, 14, 5.6, 'trade_map', HX, HY, .06); M.block('darkwood', 4.5, -HY + .1, 7.05, 14.4, .2, .14); M.block('darkwood', 4.5, -HY + .1, 1.25, 14.4, .2, .14);
      for (const x of [-11, -8, -5]) {
        M.block('darkwood', x, -HY + .55, 0, 2.8, .9, .2); M.block('darkwood', x, -HY + .55, 2.7, 2.8, .9, .14); for (const sd of [-1, 1]) M.block('darkwood', x + sd * 1.35, -HY + .55, 0, .1, .9, 2.84); M.block('darkwood', x, -HY + .55, 1.35, 2.7, .86, .05);
        M.quad('glass', [[x - 1.3, -HY + 1, .2], [x + 1.3, -HY + 1, .2], [x + 1.3, -HY + 1, 2.7], [x - 1.3, -HY + 1, 2.7]]);
        for (const [z, dx, s] of [[.2, -.7, 1], [.2, .7, .8], [1.4, -.6, .7], [1.4, .1, 1], [1.4, .8, .6]]) atK(M, x + dx, -HY + .55, z, 0, () => lathe(M, 'porcelain', [[0, 0], [.16 * s, 0], [.22 * s, .12 * s], [.28 * s, .4 * s], [.22 * s, .66 * s], [.1 * s, .8 * s], [.13 * s, .92 * s], [.001, .92 * s]], 14));
      }
      // spice sacks along the left wall, open, with scoops; silks hanging along the right wall
      [['spice_orange', 3.2], ['spice_red', 4.3], ['spice_yellow', 5.4], ['spice_brown', 6.5], ['tea_green', 7.6], ['spice_red', 8.6]].forEach(([m, y], k) => {
        const x = -12.1 + (k % 2) * .25; M.cyl('sack', [x, y, 0], .46, .8, 10, .5); M.tube('sack', [x, y, .8], [x, y, .92], .5, .56, 10, false); M.sphere(m, [x, y, .8], .44, .35, 10, 4);
        if (k % 2) M.rod('brass', [x + .2, y, .95], [x + .5, y + .1, 1.25], .03, 4);
      });
      M.rod('darkwood', [HX - 1, -7.4, 7.5], [HX - 1, 7.4, 7.5], .06, 6);
      ['silk_red', 'silk', 'silk_teal', 'silk_purple'].forEach((m, k0) => { for (let k = k0; k < 11; k += 4) { const y = -6.6 + k * 1.32, rows = [], uv = []; for (let i = 0; i <= 6; i++) { const t = i / 6, z = 7.45 - 5.2 * t, dx = .12 * Math.sin(t * 7 + k); rows.push([[HX - 1 + dx, y - .55, z], [HX - 1 + dx, y + .55, z]]); uv.push([[0, 1 - t], [1, 1 - t]]); } M.grid(m, rows, uv); } });
      // rugs, lanterns, the Wokou banners either side of the door
      M.quad('runner', [[-3, 3, .01], [3, 3, .01], [3, 8.6, .01], [-3, 8.6, .01]]);
      for (const [x, y] of [[-6, 5], [6, 5], [-6, -4], [6, -4]]) chochin(M, x, y, H - .3, 1.6, .4, .9);
      for (const s of [-1, 1]) wallArt(M, 'front', s * 6.2, 1.6, 2, 4.6, 'banner_wokou', HX, HY, .08);
    },
    // the Wokou Boat Shed (craft): a junk being built on the slipway, its ribs up on the cradle, the scaffold beside it; the
    // great sea doors open on the bay, the slip running down into the water in the floor; the steam box for bending planks, the
    // sail spread out on the sewing table, tools along the wall
    room_wok_shed(M) {
      M.room = true;
      const { HX, HY, H, DW, DH, PX, PY } = WS;
      hall(M, { HX, HY, H, DW, DH, noFloor: true, wall: 'wood', post: 'darkwood', postEvery: 4, beam: 'darkwood', ceil: 'wood', ceilBeam: 'darkwood', ceilEvery: 2.5, backOpen: [-PX, PX, 0, 7.4] });
      for (const [x0, y0, x1, y1] of [[-HX - .4, -HY - .4, -PX, HY + 1.6], [PX, -HY - .4, HX + .4, HY + 1.6], [-PX, PY, PX, HY + 1.6]]) M.block('darkwood', (x0 + x1) / 2, (y0 + y1) / 2, -.3, x1 - x0, y1 - y0, .3);
      M.block('stone_dark', 0, (PY - 24) / 2, -1.8, 2 * PX + 1, PY + 24, .2); for (const sd of [-1, 1]) M.block('stone', sd * (PX + .1), (PY - HY) / 2, -1.6, .2, PY + HY, 1.6); M.block('stone', 0, PY + .1, -1.6, 2 * PX, .2, 1.6);
      M.quad('water_flow', [[-PX, -24, -.45], [PX, -24, -.45], [PX, PY, -.45], [-PX, PY, -.45]], [[0, 0], [2 * PX / 4, 0], [2 * PX / 4, (PY + 24) / 4], [0, (PY + 24) / 4]]);
      M.quad('water', [[-40, -60, -.5], [40, -60, -.5], [40, -24, -.5], [-40, -24, -.5]]);
      M.quad('sea_view', [[34, -26, -8], [-34, -26, -8], [-34, -26, 20], [34, -26, 20]]);
      // the sea doors swung back against the wall
      for (const sd of [-1, 1]) { const x0 = sd * (PX + .2), x1 = sd * (PX + 6.6); M.block('wood', (x0 + x1) / 2, -HY + .25, 0, 6.4, .14, 7.3); for (const z of [1, 6.2]) M.block('darkwood', (x0 + x1) / 2, -HY + .36, z, 6.4, .08, .3); M.box('darkwood', [(x0 + x1) / 2, -HY + .36, 3.6], [6.6, .08, .26], 0, 0, sd * .72); }
      // the slipway into the water, the cradle and the hull on it
      const slip = Math.atan2(1.15, 12.6); for (const sd of [-1, 1]) M.box('darkwood', [sd * 1.3, -2.7, -.32], [.4, 12.7, .3], 0, slip);
      for (let y = -8.5; y <= 3; y += 1) M.block('wood', 0, y, -.9 + (y + 9) / 12.6 * 1.15, 3.4, .25, .14);
      for (const y of [-4.4, -1.2, 2]) M.block('darkwood', 0, y, -.2 + (y + 9) / 12.6 * 1.15, 3.2, .6, 1.05);
      const hw = y => 2.8 * Math.sqrt(Math.max(0, 1 - Math.pow((y + 1.2) / 5, 2)));
      M.rod('darkwood', [0, -5.8, 1.2], [0, 3.4, 1.2], .16, 6); curveTube(M, 'darkwood', [[0, -5.8, 1.2], [0, -6.4, 2.6], [0, -6.6, 4.6]], [.16, .15, .13], { segs: 6, n: 4, seed: 7 }); M.rod('darkwood', [0, 3.4, 1.2], [0, 3.8, 4.4], .15, 6);
      for (let y = -5; y <= 3.1; y += .9) { const w = hw(y), q = [[-w, y, 4.2], [-w * .85, y, 2.4], [-w * .45, y, 1.4], [0, y, 1.2], [w * .45, y, 1.4], [w * .85, y, 2.4], [w, y, 4.2]]; for (let k = 0; k + 1 < q.length; k++) M.rod('wood', q[k], q[k + 1], .09, 5); }
      for (const t of [.12, .3, .48]) for (const sd of [-1, 1]) { const pts = []; for (let y = -4.6; y <= 2.8; y += .9) { const w = hw(y); pts.push([sd * w * (.45 + t * .9), y, 1.4 + t * 2.2]); } for (let k = 0; k + 1 < pts.length; k++) M.rod('wood', pts[k], pts[k + 1], .14, 4); }
      for (const y of [-5, -1, 3]) M.block('darkwood', 3.6, y, 0, .25, .25, 2.4); M.block('wood', 3.6, -1, 2.3, .9, 8.6, .1); for (let k = 0; k < 7; k++) M.rod('wood', [3.4 + k * .05, 3.9, .4 * k], [3.8 + k * .05, 3.9, .4 * k], .04, 3);
      for (const sd of [-1, 1]) M.rod('wood', [3.3, 3.9 + sd * .25, 0], [3.9, 3.9 + sd * .25, 2.4], .05, 4);
      M.block('darkwood', 0, -1.2, H - 1.2, .4, 14, .4); M.block('iron', 0, -1.2, H - 1.7, .5, .3, .4); M.rod('rope', [0, -1.2, H - 1.7], [0, -1.2, 5.6], .03, 3); M.block('wood', 0, -1.2, 5.4, 3, .3, .12);
      // steam box with its fire and kettle, planks stacked and leaning
      for (const y of [.6, 4]) for (const sd of [-1, 1]) M.rod('darkwood', [-10.5 + sd * .7, y, 0], [-10.5 + sd * .3, y, 1], .07, 4);
      M.block('wood', -10.5, 2.3, 1, 1.4, 5, 1); M.cyl('iron', [-10.5, -.4, 0], .5, .9, 10); flame(M, -10.5, -.4, .05, .4); M.rod('iron', [-10.5, -.3, .9], [-10.5, .3, 1.5], .06, 6);
      for (let k = 0; k < 4; k++) M.quad('smoke', [[-11 - k * .2, 4.9, 2 + k * .9], [-10 + k * .2, 4.9, 2 + k * .9], [-9.8 + k * .3, 5.1, 3 + k * .9], [-11.2 - k * .3, 5.1, 3 + k * .9]]);
      for (let k = 0; k < 6; k++) M.block('wood', -12.4, -3, k * .14, 2, 2.6, .12); for (let k = 0; k < 5; k++) M.box('wood', [-14.5, -6 + k * .6, 2.6], [.08, .4, 5.2], 0, .18);
      // the sail on the sewing table, spools, the rolled sail, the stool
      M.block('wood', 10, 1.5, .9, 5.2, 3.8, .1); for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) M.block('darkwood', 10 + a * 2.4, 1.5 + b * 1.7, 0, .14, .14, .9);
      M.quad('sail', [[7.6, -.2, 1.01], [12.4, -.2, 1.01], [12.4, 3.2, 1.01], [7.6, 3.2, 1.01]]); M.quad('sail', [[12.4, -.2, 1.01], [12.4, 3.2, 1.01], [12.7, 3.2, .3], [12.7, -.2, .3]]);
      for (const [x, y, m] of [[8.2, .4, 'rope'], [8.6, .5, 'cloth'], [9, .3, 'rope']]) M.cyl(m, [x, y, 1.01], .09, .16, 8);
      M.rod('sail', [7.8, -1.6, .32], [12.2, -1.6, .32], .3, 10); M.cyl('wood', [8.6, 4.4, 0], .3, .7, 8);
      // tools along the left wall, rope coils, lanterns on posts
      M.block('darkwood', -HX + .2, 0, 1.4, .1, 12, 3.4);
      for (let y = -5.4; y <= 5.4; y += 1.2) { const k = Math.round(y * 10) % 3; if (k === 0) { M.box('steel', [-HX + .3, y, 3.4], [.04, .9, .32]); M.box('darkwood', [-HX + .3, y + .55, 3.4], [.08, .3, .14]); } else if (k === 1) { M.rod('wood', [-HX + .32, y, 2], [-HX + .32, y, 3.8], .04, 4); M.box('steel', [-HX + .36, y, 3.8], [.08, .3, .14]); } else { M.rod('wood', [-HX + .32, y, 2.2], [-HX + .32, y, 3.2], .04, 4); M.cyl('darkwood', [-HX + .32, y - .2, 3.2], .14, .4, 8); } }
      for (const [x, y] of [[-6.8, 7.4], [12.6, 7.6], [9, -7.5]]) for (let k = 0; k < 4; k++) M.tube('rope', [x, y, k * .1], [x, y, k * .1 + .09], .5 - k * .05, .5 - k * .05, 12, false);
      for (const [x, y] of [[-7, -1], [7, 6]]) { M.block('darkwood', x, y, 0, .2, .2, 4); chochin(M, x + .5, y, 4, .3, .3, .6); }
    },
    // the Wokou Great Dojo (training): the floor tiled in waves round a pool, stepping posts winding across it rising and falling;
    // chains with grappling hooks hanging from the beams; the round sea window in the back wall between the Wokou banners;
    // boarding weapons on the walls, the climbing net
    room_wok_dojo(M) {
      M.room = true;
      const { HX, HY, H, DW, DH, PL, WR, WZ } = WD, [px0, py0, px1, py1] = PL;
      hall(M, { HX, HY, H, DW, DH, noFloor: true, wall: 'plaster', wain: 'navy', wainH: 1.4, rail: 'gold', post: 'darkwood', postEvery: 5, beam: 'darkwood', ceil: 'darkwood', ceilBeam: 'darkwood', ceilEvery: 3.75, backOpen: [-WR, WR, WZ - WR, WZ + WR] });
      for (const [x0, y0, x1, y1] of [[-HX - .4, -HY - .4, px0, HY + 1.6], [px1, -HY - .4, HX + .4, HY + 1.6], [px0, py1, px1, HY + 1.6], [px0, -HY - .4, px1, py0]]) M.block('seigaiha', (x0 + x1) / 2, (y0 + y1) / 2, -.3, x1 - x0, y1 - y0, .3);
      M.block('stone_dark', (px0 + px1) / 2, (py0 + py1) / 2, -1.6, px1 - px0, py1 - py0, .2);
      for (const sd of [-1, 1]) { M.block('stone', sd < 0 ? px0 + .1 : px1 - .1, (py0 + py1) / 2, -1.4, .2, py1 - py0, 1.5); M.block('stone', (px0 + px1) / 2, sd < 0 ? py0 + .1 : py1 - .1, -1.4, px1 - px0, .2, 1.5); }
      M.quad('water_flow', [[px0, py0, -.35], [px1, py0, -.35], [px1, py1, -.35], [px0, py1, -.35]], [[0, 0], [(px1 - px0) / 4, 0], [(px1 - px0) / 4, (py1 - py0) / 4], [0, (py1 - py0) / 4]]);
      for (const sd of [-1, 1]) { M.block('gold', sd < 0 ? px0 - .06 : px1 + .06, (py0 + py1) / 2, 0, .12, py1 - py0 + .24, .05); M.block('gold', (px0 + px1) / 2, sd < 0 ? py0 - .06 : py1 + .06, 0, px1 - px0 + .24, .12, .05); }
      for (const [x, y, h] of WDP) { M.cyl('darkwood', [x, y, -1.4], .42, h + 1.4, 12); M.cyl('wood', [x, y, h - .02], .46, .04, 12); M.cyl('iron', [x, y, h - .3], .44, .08, 12); M.cyl('rope', [x, y, -.25], .45, .1, 12); }
      // the round window onto the sea: the wall round it, the frame, bars, the view
      const yb = -HY - .01, n = 64;
      for (let k = 0; k < n; k++) {
        const a0 = k / n * Math.PI * 2, a1 = (k + 1) / n * Math.PI * 2, C = a => [WR * Math.cos(a), WZ + WR * Math.sin(a)], S = a => { const c = Math.cos(a), s = Math.sin(a), m = Math.max(Math.abs(c), Math.abs(s)); return [WR * c / m, WZ + WR * s / m]; };
        const [c0, c1, s0, s1] = [C(a0), C(a1), S(a0), S(a1)]; M.poly('plaster', [[c0[0], yb, c0[1]], [c1[0], yb, c1[1]], [s1[0], yb, s1[1]], [s0[0], yb, s0[1]]]);
      }
      M.tube('darkwood', [0, -HY - .25, WZ], [0, -HY + .2, WZ], WR, WR, 48, false); M.tube('gold', [0, -HY + .18, WZ], [0, -HY + .26, WZ], WR + .14, WR + .14, 48, false);
      M.rod('iron', [-WR, -HY - .1, WZ], [WR, -HY - .1, WZ], .07, 6); M.rod('iron', [0, -HY - .1, WZ - WR], [0, -HY - .1, WZ + WR], .07, 6); M.tube('iron', [0, -HY - .13, WZ], [0, -HY - .07, WZ], WR * .45, WR * .45, 32, false);
      M.quad('sea_view', [[16, -HY - 8, -4], [-16, -HY - 8, -4], [-16, -HY - 8, 14], [16, -HY - 8, 14]]);
      for (const s of [-1, 1]) wallArt(M, 'back', s * 8.6, 1.8, 3, 7, 'banner_wokou', HX, HY, .08);
      // boarding weapons on the side walls, the climbing net, the anchor
      for (const side of [-1, 1]) { M.block('darkwood', side * (HX - .3), -3, 1.4, .3, 15, .14); M.block('darkwood', side * (HX - .3), -3, 3.4, .3, 15, .14);
        for (let y = -10; y <= 4; y += 1) { const k = (y + 10) % 3; if (k === 0) { curveTube(M, 'steel', [[side * (HX - .35), y, 1.6], [side * (HX - .35), y + .1, 2.6], [side * (HX - .35), y + .35, 3.3]], [.05, .05, .02], { segs: 4, n: 3, seed: y }); M.rod('darkwood', [side * (HX - .35), y, 1.2], [side * (HX - .35), y, 1.6], .05, 4); } else if (k === 1) { M.rod('wood', [side * (HX - .35), y, 1.2], [side * (HX - .35), y, 3.6], .04, 4); M.box('steel', [side * (HX - .35), y + .14, 3.4], [.05, .36, .34]); } else { M.rod('wood', [side * (HX - .35), y, .2], [side * (HX - .35), y, 4.6], .04, 4); M.box('steel', [side * (HX - .35), y, 4.8], [.05, .1, .5]); } } }
      for (let i = 0; i <= 8; i++) M.rod('rope', [-HX + .5, 6 + i * .9, .3], [-HX + .5, 6 + i * .9, 7.4], .035, 3); for (let j = 0; j <= 8; j++) M.rod('rope', [-HX + .5, 6, .3 + j * .9], [-HX + .5, 13.2, .3 + j * .9], .035, 3);
      M.rod('iron', [HX - 1.4, 9, .3], [HX - 1.4, 9, 3.4], .12, 6); curveTube(M, 'iron', [[HX - 1.4, 7.6, 1.2], [HX - 1.4, 8.2, .5], [HX - 1.4, 9, .3], [HX - 1.4, 9.8, .5], [HX - 1.4, 10.4, 1.2]], [.12, .12, .12, .12, .12], { segs: 6, n: 4, seed: 4 }); M.rod('iron', [HX - 1.4, 8.2, 3], [HX - 1.4, 9.8, 3], .08, 6); M.tube('iron', [HX - 1.4, 9, 3.6], [HX - 1.4, 9, 3.75], .3, .3, 10, false);
      for (const [x, y] of [[-12, 12], [12, 12], [-12, -12.6], [12, -12.6]]) chochin(M, x, y, H - .3, 1.8, .45, 1);
    },
    // a chain hanging from a beam with a grappling hook on its end (a part: swaying)
    room_wok_chain(M) { M.room = true; for (let k = 0; k < 14; k++) { const z = -k * .32; M.box('iron', [0, 0, z - .16], k % 2 ? [.05, .2, .3] : [.2, .05, .3]); } const zb = -4.6; M.rod('iron', [0, 0, zb + .1], [0, 0, zb - .7], .05, 6); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; curveTube(M, 'iron', [[0, 0, zb - .7], [Math.cos(a) * .3, Math.sin(a) * .3, zb - .8], [Math.cos(a) * .42, Math.sin(a) * .42, zb - .5], [Math.cos(a) * .36, Math.sin(a) * .36, zb - .3]], [.045, .045, .04, .02], { segs: 4, n: 3, seed: k }); } M.tube('iron', [0, 0, zb + .12], [0, 0, zb + .2], .12, .12, 8, false); },
    // the Warrior Armory (craft): every wall packed with battle-worn weapons and dented shields and helmets; the forge hearth
    // in the corner, the grinding wheel turning, the repair benches with their anvils; the cracked-circle standard between two
    // suits of armour at the far end
    room_war_armory(M) {
      M.room = true;
      const { HX, HY, H, DW, DH } = XA;
      hall(M, { HX, HY, H, DW, DH, floor: 'earth', wall: 'plaster_old', wain: 'darkwood', wainH: 1.2, rail: 'rust', post: 'darkwood', postEvery: 4.4, beam: 'darkwood', ceil: 'darkwood', ceilBeam: 'darkwood', ceilEvery: 2.75 });
      for (const side of [-1, 1]) { weaponWall(M, side, -9, 9, HX, side < 0 ? 181 : 182, true); for (let y = -7.5; y <= 7.6; y += 2.5) shieldK(M, side, y, 7, .7 + (Math.abs(y * 10) % 3) * .08, HX, HY); }
      // the forge hearth in the far left corner, its hood, the quench trough
      const fx = -10.6, fy = -8.6; M.block('stone_dark', fx, fy, 0, 4, 4.4, 1.1); M.block('dark', fx, fy, 1.1, 2.6, 2.8, .05); flame(M, fx, fy, 1.12, 1.1); flame(M, fx + .6, fy + .3, 1.12, .6);
      M.box('stone_dark', [fx, fy, 3.1], [3.6, 3.8, .3]); M.cyl('stone_dark', [fx, fy, 3.2], 1.6, 2.2, 4, .5); M.cyl('stone_dark', [fx, fy, 5.4], .5, H - 5.4, 8);
      M.block('wood', fx + 3, fy + 1.6, 0, 1.2, 2.4, .8); M.quad('water', [[fx + 2.5, fy + .5, .78], [fx + 3.5, fy + .5, .78], [fx + 3.5, fy + 2.7, .78], [fx + 2.5, fy + 2.7, .78]]);
      // the grinding wheel's frame and treadle (the stone turns: a part)
      for (const sd of [-1, 1]) { M.block('darkwood', 8.4 + sd * .7, -5, 0, .2, 2, .25); M.rod('darkwood', [8.4 + sd * .7, -5.6, .2], [8.4 + sd * .7, -5, 1.3], .07, 4); M.rod('darkwood', [8.4 + sd * .7, -4.4, .2], [8.4 + sd * .7, -5, 1.3], .07, 4); }
      M.box('wood', [8.4, -4.2, .2], [1.2, .9, .08], 0, .2); M.cyl('wood', [8.4, -5.8, 0], .5, .6, 10); M.quad('water', [[7.95, -6.25, .58], [8.85, -6.25, .58], [8.85, -5.35, .58], [7.95, -5.35, .58]]);
      // two repair benches with anvils, hammers, tongs, broken blades
      for (const bx of [-3, 3]) {
        M.block('darkwood', bx, -.8, 0, 3.6, 2.6, .12); for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) M.block('darkwood', bx + a * 1.6, -.8 + b * 1.1, 0, .2, .2, 1.1); M.block('wood', bx, -.8, 1.1, 3.6, 2.6, .12);
        M.block('iron', bx - .6, -.8, 1.22, .5, .4, .5); M.box('iron', [bx - .6, -.8, 1.82], [1.1, .4, .22]); M.cyl('iron', [bx - 1.15, -.8, 1.72], .2, .2, 8, .02);
        M.rod('wood', [bx + .5, -1.4, 1.27], [bx + 1.2, -1.2, 1.27], .04, 4); M.block('iron', bx + 1.25, -1.2, 1.22, .3, .18, .18); M.rod('iron', [bx + .4, -.2, 1.25], [bx + 1.4, .1, 1.25], .025, 4); M.box('steel', [bx + .6, .2, 1.24], [1.4, .1, .03], .3); M.box('steel', [bx - .3, .4, 1.24], [.7, .1, .03], -.2);
      }
      // the far end: the standard on its pole, two war armours, the emblem
      M.cyl('darkwood', [0, -HY + .6, 0], .12, 7.4, 8); M.cyl('stone', [0, -HY + .6, 0], .6, .4, 10); M.rod('darkwood', [-1.4, -HY + .6, 7], [1.4, -HY + .6, 7], .06, 6); M.quad('banner_warrior', [[1.3, -HY + .6, 3], [-1.3, -HY + .6, 3], [-1.3, -HY + .6, 6.95], [1.3, -HY + .6, 6.95]]); M.cyl('gold', [0, -HY + .6, 7.4], .18, .5, 6, .02);
      M.remap = { lacquer_red: 'rust', lacquer_black: 'darkwood', lacing: 'leather', gold: 'iron' }; for (const x of [-6, 6]) yoroi(M, x, -HY + .9, 0); M.remap = null;
      wallArt(M, 'back', 0, 7.2, 1.6, 1.6, 'mark_warrior', HX, HY, .08);
      for (const [x, y] of [[-6, 6.5], [6, 6.5]]) chochin(M, x, y, H - .3, 1.4, .4, .9);
    },
    // the grinding wheel (a part on its axle, turning)
    room_war_grindwheel(M) { M.room = true; M.rod('granite', [-.3, 0, 0], [.3, 0, 0], .95, 18); M.rod('iron', [-.85, 0, 0], [.85, 0, 0], .07, 6); M.rod('darkwood', [.3, 0, 0], [.32, 0, 0], .5, 10); M.box('wood', [.75, .25, .25], [.08, .08, .6]); },
    // the Warrior Fighting Ring (training): the square sand pit sunk in the hall's floor, the cracked circle chalked in it, the
    // wooden seats stepping up round it to the walkway; heavy bags hanging at the sides, battle drums in the corners, torches
    // at the ring's corners, banners on every wall, weapon racks
    room_war_dojo(M) {
      M.room = true;
      const { HX, HY, H, DW, DH, RS, N, ST } = XD, TOP = N * ST;
      hall(M, { HX, HY, H, DW, DH, floor: 'earth', wall: 'plaster_old', wain: 'darkwood', wainH: TOP + 1.2, rail: 'gold', post: 'darkwood', postEvery: 6, beam: 'darkwood', ceil: 'darkwood', ceilBeam: 'darkwood', ceilEvery: 3 });
      M.quad('sand_ring', [[-RS, -RS, .02], [RS, -RS, .02], [RS, RS, .02], [-RS, RS, .02]], [[0, 0], [3, 0], [3, 3], [0, 3]]);
      M.quad('mark_warrior_chalk', [[3.4, 3.4, .03], [-3.4, 3.4, .03], [-3.4, -3.4, .03], [3.4, -3.4, .03]]);
      for (const [a, b, c, d] of [[-RS + .4, -RS + .4, RS - .4, -RS + .5], [-RS + .4, RS - .5, RS - .4, RS - .4], [-RS + .4, -RS + .4, -RS + .5, RS - .4], [RS - .5, -RS + .4, RS - .4, RS - .4]]) M.quad('chalk', [[a, b, .03], [c, b, .03], [c, d, .03], [a, d, .03]]);
      for (const t of xdTiers()) for (const [x0, y0, x1, y1] of t.boxes) { M.block(t.k === N ? 'wood' : (t.k % 2 ? 'darkwood' : 'wood'), (x0 + x1) / 2, (y0 + y1) / 2, 0, x1 - x0, y1 - y0, t.y); }
      for (const t of xdTiers()) if (t.k < N + 1) { const a = t.a; for (const [x0, y0, x1, y1] of [[-a, -a, a, -a + .06], [-a, a - .06, a, a], [-a, -a, -a + .06, a], [a - .06, -a, a, a]]) M.block('gold', (x0 + x1) / 2, (y0 + y1) / 2, t.y - .04, x1 - x0, y1 - y0, .05); }
      for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const x = a * 6.7, y = b * 6.7; M.cyl('darkwood', [x, y, ST], .14, 3, 6); M.cyl('iron', [x, y, ST + 3], .35, .25, 8, .45); flame(M, x, y, ST + 3.2, .45); }
      for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) taiko(M, a * 15.6, b * 15.6, TOP);
      for (const w of ['back', 'left', 'right']) for (const u of [-9, 0, 9]) wallArt(M, w, u, TOP + 2.2, 2.4, 5.2, 'banner_warrior', HX, HY, .08);
      for (const u of [-10, 10]) wallArt(M, 'front', u, TOP + 2.2, 2.4, 5.2, 'banner_warrior', HX, HY, .08);
      for (const side of [-1, 1]) { const x = side * (HX - .45); M.block('darkwood', x, 0, TOP + .3, .5, 12, .12); M.block('darkwood', x, 0, TOP + 2.3, .5, 12, .12); for (let y = -5.6; y <= 5.6; y += .7) { M.rod('wood', [x + side * .1, y, TOP + .1], [x - side * .12, y, TOP + 3.6], .045, 5); M.box('steel', [x - side * .12, y, TOP + 3.9], [.05, .12, .5]); } }
    },
    // a heavy bag on its chain (a part, swinging a little)
    room_war_bag(M) { M.room = true; const L = XD.H - .3 - (XD.N * XD.ST + 3.2); M.rod('iron', [0, 0, 0], [0, 0, -L], .04, 4); M.cyl('leather', [0, 0, -L - 2.1], .55, 2.1, 12); for (const z of [-L - .3, -L - 1.8]) M.cyl('rope', [0, 0, z], .57, .1, 12); M.cyl('darkwood', [0, 0, -L - 2.2], .5, .1, 12); },
    // the Warrior Stores (quest): the cellar under the storehouse, down the stone stair from the trapdoor; aisles of racks to the
    // beams, rice bags, arrow bundles, barrels and crates on every shelf, ladders against them; the quartermaster's desk with
    // the ledger and the tally board
    room_war_stores(M) {
      M.room = true;
      const { HX, HY, H, SX, SY } = XS;
      hall(M, { HX, HY: HY - .7, H, DW: .01, DH: .01, floor: 'earth', wall: 'stone', wain: 'stone_dark', wainH: .8, post: 'darkwood', postEvery: 4, beam: 'darkwood', noCeil: true });
      for (const [x0, y0, x1, y1] of [[-HX - .4, -HY, HX + .4, 9.4], [-HX - .4, 9.4, -SX - .2, HY], [SX + .2, 9.4, HX + .4, HY]]) M.block('darkwood', (x0 + x1) / 2, (y0 + y1) / 2, H, x1 - x0, y1 - y0, .25);
      for (let y = -HY + 2.4; y < 9.3; y += 2.4) M.block('darkwood', 0, y, H - .45, 2 * HX, .4, .45);
      // the stair up to the trapdoor, its rails, daylight
      stairsK(M, 'stone', -SX, SX, SY[0], SY[1], 0, H, 24, 1);
      for (const sd of [-1, 1]) railK(M, [sd * SX, SY[0], 0], [sd * SX, SY[1], H], 1.2, 'darkwood', 'darkwood');
      M.quad('skyhole', [[-SX - .2, 9.4, H + .4], [SX + .2, 9.4, H + .4], [SX + .2, HY, H + .4], [-SX - .2, HY, H + .4]]); M.block('wood', SX + .3, 9.6, H + .25, .1, 2.4, 2);
      M.quad('shaft_white', [[-SX, 4, 0], [SX, 4, 0], [SX, 10.6, H], [-SX, 10.6, H]]);
      // the racks, loaded
      let sd = 191; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
      for (const x of [-10, -5, 0, 5, 10]) {
        for (const y of [-11, -8.4, -5.8, -3.2, -.8]) for (const dx of [-.9, .9]) M.block('darkwood', x + dx, y, 0, .2, .2, 6.8);
        for (const z of [.15, 2.35, 4.55, 6.7]) M.block('wood', x, -5.9, z, 2.1, 10.4, .1);
        for (const z of [.25, 2.45, 4.65]) for (let y = -10.6; y < -1.1; y += 1.3) {
          const k = r();
          if (k < .32) { for (let q = 0; q < 2; q++) M.sphere('sack', [x - .4 + q * .8, y + .1, z + .4], .45, .75, 8, 4); M.sphere('sack', [x, y + .1, z + .95], .42, .7, 8, 4); }
          else if (k < .55) { for (let q = 0; q < 14; q++) { const a = q * 2.4, d = .04 + .015 * q; M.rod('wood', [x - .9, y + Math.cos(a) * d * 2, z + .25 + Math.sin(a) * d * 2], [x + .9, y + Math.cos(a) * d * 2, z + .25 + Math.sin(a) * d * 2], .018, 3); } M.rod('rope', [x - .2, y, z + .25], [x - .15, y, z + .25], .16, 8); M.quad('paper', [[x + .75, y - .2, z + .1], [x + .95, y - .2, z + .1], [x + .95, y + .2, z + .4], [x + .75, y + .2, z + .4]]); }
          else if (k < .78) { M.rod('wood', [x - .9, y, z + .45], [x + .9, y, z + .45], .45, 12); for (const dx of [-.6, .6]) M.rod('iron', [x + dx - .03, y, z + .45], [x + dx + .03, y, z + .45], .46, 12); }
          else { M.block('wood', x, y, z, 1.8, 1.1, 1.1); M.block('darkwood', x, y, z + .5, 1.82, 1.12, .08); }
        }
      }
      for (const [x, y] of [[-7.5, -6], [7.5, -3]]) { for (const s2 of [-1, 1]) M.rod('wood', [x + s2 * .4, y, 0], [x + s2 * .4 - .3 * Math.sign(x), y, 6.4], .05, 4); for (let k = 1; k < 16; k++) { const t = k / 16; M.rod('wood', [x - .4 - .3 * Math.sign(x) * t, y, 6.4 * t], [x + .4 - .3 * Math.sign(x) * t, y, 6.4 * t], .03, 3); } }
      // barrels against the front wall, crates by the stair
      for (const [x, z] of [[-11.8, 0], [-10.8, 0], [-9.8, 0], [-8.8, 0], [-11.3, .9], [-10.3, .9], [-9.3, .9], [-10.8, 1.8], [-9.8, 1.8]]) { M.rod('wood', [x, 8.6, z + .45], [x, 11.3, z + .45], .45, 12); for (const dy of [.4, 2.3]) M.rod('iron', [x, 8.6 + dy, z + .45], [x, 8.65 + dy, z + .45], .46, 12); }
      for (const [x, y, z, s] of [[3.2, 4.2, 0, 1.2], [3.4, 5.6, 0, 1.1], [3.3, 4.8, 1.2, 1]]) M.block('wood', x, y, z, s, s, s);
      // the quartermaster's desk: ledger, tally sticks, the abacus, a lamp, the stool; the tally board on the wall
      M.block('darkwood', 9.6, 6.4, 0, 3.4, 2, 1.1); M.block('paper', 9.2, 6.2, 1.1, 1.1, .8, .02); M.cyl('wood', [10.6, 6, 1.1], .14, .3, 8); for (let k = 0; k < 7; k++) M.rod('wood', [10.6 + (k % 3 - 1) * .05, 6 + (k % 2) * .05, 1.15], [10.6 + (k % 3 - 1) * .08, 6, 1.75], .015, 3);
      M.block('darkwood', 8.4, 6.8, 1.1, 1, .1, .06); andon(M, 10.9, 7.1, 1.1, .5); M.cyl('wood', [9.6, 8, 0], .35, .75, 8);
      M.block('dark', 9.6, HY - .82, 1.6, 4, .06, 2.4); for (let k = 0; k < 18; k++) M.block('chalk', 8 + k * .18 + (k % 5 === 4 ? .1 : 0), HY - .86, 2 + (k > 9 ? 1 : 0), .03, .02, k % 5 === 4 ? .5 : .4);
      for (const [x, y] of [[-7.5, -8], [0, -12.6 + 2], [7.5, -4], [-2.5, 4], [2.5, 8]]) chochin(M, x, y, H - .3, 1.2, .38, .8);
    },
    // the Warrior Veterans' Hall (video): torn battle banners hanging from every rafter, the long battle mural, worn chairs
    // round the fire pit in its broken stone ring; the great cracked stone ring over the screen on the far wall, trophy tables
    room_war_veterans(M) {
      M.room = true;
      const { HX, HY, H, DW, DH, FR } = XV;
      hall(M, { HX, HY, H, DW, DH, floor: 'darkwood', wall: 'plaster_old', wain: 'darkwood', wainH: 1.4, rail: 'rust', post: 'darkwood', postEvery: 4, beam: 'darkwood', ceil: 'darkwood', ceilBeam: 'darkwood', ceilEvery: 2.4 });
      let sd = 201; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
      for (let y = -HY + 2.4; y < HY - .1; y += 2.4) for (const x of [-10, -5, 0, 5, 10]) {
        if (Math.abs(x) < 1 && Math.abs(y) < 3) continue;
        const w = 1.3 + .5 * r(), h = 2.6 + 1.6 * r(), m = r() < .5 ? 'banner_torn' : 'banner_torn_rust', zt = H - .5, dx = (r() - .5) * 1.2;
        M.rod('darkwood', [x + dx - w / 2 - .1, y, zt], [x + dx + w / 2 + .1, y, zt], .04, 4); M.quad(m, [[x + dx - w / 2, y, zt - h], [x + dx + w / 2, y, zt - h], [x + dx + w / 2, y, zt], [x + dx - w / 2, y, zt]]);
      }
      wallArt(M, 'left', 0, 1.8, 22, 5.5, 'mural_battle', HX, HY, .06); M.block('darkwood', -HX + .1, 0, 7.35, .2, 22.4, .14); M.block('darkwood', -HX + .1, 0, 1.65, .2, 22.4, .14);
      // the fire pit in its broken ring, the worn chairs round it (one knocked over)
      for (let k = 0; k < 14; k++) { if (k === 3 || k === 4) continue; const a = k / 14 * Math.PI * 2; blob(M, 'stone', [Math.cos(a) * FR, Math.sin(a) * FR, 0], .5, .42, .45 + .15 * (k % 3), { segs: 8, rings: 4, amp: .2, seed: 210 + k }); }
      M.cyl('dark', [0, 0, 0], FR - .4, .05, 16); for (let k = 0; k < 6; k++) { const a = k * 1.05; M.rod('bark', [Math.cos(a) * 1.2, Math.sin(a) * 1.2, .1], [-Math.cos(a) * .2, -Math.sin(a) * .2, .5], .12, 6); }
      flame(M, 0, 0, .15, 1.5); flame(M, .4, -.3, .2, .8); for (let k = 0; k < 3; k++) M.quad('smoke', [[-1 - k * .4, k * .2, 3 + k * 2.2], [1 + k * .4, k * .2, 3 + k * 2.2], [1.5 + k * .5, k * .2, 5.2 + k * 2.2], [-1.5 - k * .5, k * .2, 5.2 + k * 2.2]]); M.quad('glow', [[-3, -3, .04], [3, -3, .04], [3, 3, .04], [-3, 3, .04]]);
      for (let k = 0; k < 8; k++) {
        const a = k / 8 * Math.PI * 2 + .2, x = Math.cos(a) * 4.6, y = Math.sin(a) * 4.6, f = a + Math.PI, c = Math.cos(f), s = Math.sin(f), P = (u, v, z) => [x + u * c - v * s, y + u * s + v * c, z];
        if (k === 5) { M.box('wood', P(0, 0, .25), [.9, .9, .1], f, 1.3); M.box('wood', P(-.5, 0, .9), [.1, .9, 1.4], f, 1.3); continue; }
        M.box('wood', P(0, 0, .8), [.9, .9, .1], f); for (const [u, v] of [[-.38, -.38], [.38, -.38], [.38, .38], [-.38, .38]]) M.box('darkwood', P(u, v, .4), [.08, .08, .8], f); M.box('wood', P(-.45, 0, 1.55), [.08, .9, 1.4], f); M.box('leather', P(.02, 0, .88), [.8, .8, .06], f);
      }
      // the far wall: the dark board behind the screen, the great broken stone ring over it, trophy tables, war horns
      M.block('dark', 0, -HY + .08, 1.1, 7.8, .08, 4.4);
      for (let k = 0; k < 20; k++) { if (k === 4) continue; const a0 = k / 20 * Math.PI * 2 + (k > 4 ? .06 : 0), a1 = (k + 1) / 20 * Math.PI * 2 - .02, zc = 8.2, R = 1.9; M.box('stone', [Math.cos((a0 + a1) / 2) * R, -HY + .3, zc + Math.sin((a0 + a1) / 2) * R], [R * (a1 - a0) * 1.05, .4, .55], 0, 0, -(a0 + a1) / 2 - Math.PI / 2); }
      for (const tx of [-6, 6]) { M.block('darkwood', tx, -HY + .9, 0, 4.6, 1.4, 1.1); M.sphere('iron', [tx - 1.2, -HY + .9, 1.45], .34, 1.05, 10, 5); M.box('steel', [tx + .3, -HY + .8, 1.14], [1.6, .12, .04], .2); M.box('steel', [tx + .9, -HY + 1.1, 1.14], [.6, .12, .04], -.5); curveTube(M, 'bone', [[tx + 1.2, -HY + .9, 1.2], [tx + 1.5, -HY + .9, 1.5], [tx + 1.9, -HY + .9, 1.6]], [.12, .09, .05], { segs: 6, n: 3, seed: tx }); }
      // the right wall: crossed weapons and shields between the high windows
      for (const y of [-6, 0, 6]) { wallArt(M, 'right', y, 6.4, 2.4, 1.8, 'shoji_lit', HX, HY, .05); shieldK(M, 1, y, 3.6, .8, HX, HY); for (const t of [-1, 1]) M.box('steel', [HX - .16, y, 3.6], [.05, .1, 3], 0, t * .7); }
      for (const [x, y] of [[-7, 8], [7, 8]]) chochin(M, x, y, H - .4, 1.5, .4, .9);
    }
  });
  // ── Cute & Creepy and Chumpz rooms ──
  function ccCat(M, x, y, z) { // a black cat curled on a cushion, facing +y, green eyes
    M.cyl('cushion', [x, y, z], .62, .2, 12); M.sphere('cat_black', [x, y, z + .5], .44, .66, 10, 5); M.sphere('cat_black', [x + .06, y + .34, z + .74], .26, .92, 10, 5);
    for (const s of [-1, 1]) { M.cyl('cat_black', [x + .06 + s * .13, y + .32, z + .92], .07, .17, 4, .005); M.sphere('glow_green', [x + .06 + s * .09, y + .57, z + .78], .04, 1, 6, 3); }
    curveTube(M, 'cat_black', [[x - .36, y - .2, z + .3], [x - .5, y + .2, z + .26], [x - .3, y + .5, z + .24], [x, y + .56, z + .22]], [.07, .07, .06, .04], { segs: 6, n: 3, seed: 3 });
  }
  function ccBat(M, x, y, z, s = 1) { // a little bat hanging upside down from (x, y, z), wings folded round it
    M.rod('dark', [x, y, z], [x, y, z - .12 * s], .01, 3); M.sphere('cat_black', [x, y, z - .32 * s], .14 * s, 1.5, 8, 4); M.sphere('cat_black', [x, y, z - .56 * s], .11 * s, 1, 8, 4);
    for (const t of [-1, 1]) { M.poly('cat_black', [[x, y, z - .14 * s], [x + t * .26 * s, y + .04, z - .3 * s], [x + t * .2 * s, y + .06, z - .5 * s], [x, y + .08, z - .46 * s]]); M.cyl('cat_black', [x + t * .05 * s, y, z - .7 * s], .03 * s, .1 * s, 4, .005); M.sphere('glow_warm', [x + t * .04 * s, y + .1 * s, z - .55 * s], .018 * s, 1, 5, 3); }
  }
  function dieK(M, x, y, z, s, a, top) { // a big white die (pips on its five visible faces), turned by a
    const c = Math.cos(a), sn = Math.sin(a), R = (u, v, w) => [x + u * c - v * sn, y + u * sn + v * c, z + w];
    M.box('white', R(0, 0, s / 2), [s, s, s], a); const pip = (u, v, w) => M.sphere('dark', R(u, v, w), s * .08, .4, 6, 3);
    const P = { 1: [[0, 0]], 2: [[-.25, -.25], [.25, .25]], 3: [[-.25, -.25], [0, 0], [.25, .25]], 4: [[-.25, -.25], [.25, -.25], [-.25, .25], [.25, .25]], 5: [[-.25, -.25], [.25, -.25], [0, 0], [-.25, .25], [.25, .25]], 6: [[-.25, -.28], [.25, -.28], [-.25, 0], [.25, 0], [-.25, .28], [.25, .28]] };
    for (const [u, v] of P[top]) pip(u * s, v * s, s + .002); for (const [u, w] of P[7 - top === 1 ? 2 : 3]) pip(u * s, -s / 2 - .002, s / 2 + w * s); for (const [v, w] of P[top === 5 ? 4 : 5]) pip(s / 2 + .002, v * s, s / 2 + w * s);
  }
  Object.assign(B, {
    // the Cute & Creepy Gothic Manor (lore): the grand foyer, the checker floor, the twin stairs climbing the side walls to the
    // gallery, the candle chandelier turning slowly, purple stained glass above the gallery, the gang's portraits by the door,
    // spider banners, the fireplace under the gallery, ghosts drifting about
    room_cc_manor(M) {
      M.room = true;
      const { HX, HY, H, DW, DH, GH, GY, SX, ST } = CM;
      hall(M, { HX, HY, H, DW, DH, floor: 'checker_cc', wall: 'plaster_cc', wain: 'darkwood', wainH: 2, rail: 'gold', post: 'stone_dark', postEvery: 5, beam: 'darkwood', ceil: 'darkwood', ceilBeam: 'darkwood', ceilEvery: 3.75 });
      // the gallery, its columns and balustrade, the stairs up to it
      M.block('darkwood', 0, (-HY + GY) / 2, GH - .4, 2 * HX, HY + GY, .4); M.quad('cloth_purple', [[-SX[0] + .6, GY - 2.4, GH + .01], [SX[0] - .6, GY - 2.4, GH + .01], [SX[0] - .6, GY - 1, GH + .01], [-SX[0] + .6, GY - 1, GH + .01]]);
      for (const x of [-9, -3, 3, 9]) { M.cyl('stone_dark', [x, GY + .3, 0], .42, GH - .4, 12); M.cyl('gold', [x, GY + .3, GH - .7], .5, .2, 12); M.cyl('stone', [x, GY + .3, 0], .6, .3, 12); }
      railK(M, [-SX[0], GY, GH], [SX[0], GY, GH], 1.2, 'lacquer_black', 'darkwood');
      for (const sd of [-1, 1]) { stairsK(M, 'stone_dark', sd < 0 ? -SX[1] : SX[0], sd < 0 ? -SX[0] : SX[1], ST[1], ST[0], 0, GH, 20, -1, 'gold'); railK(M, [sd * SX[0], ST[0], 0], [sd * SX[0], ST[1], GH], 1.2, 'lacquer_black', 'darkwood'); M.cyl('gold', [sd * SX[0], ST[0], 1.2], .1, .3, 8); }
      for (const sd of [-1, 1]) for (let k = 2; k < 20; k += 5) { const y = ST[0] - (ST[0] - ST[1]) * (k + .5) / 20, z = GH * (k + 1) / 20; ccPumpkin(M, sd * (SX[1] - .5), y, z, .32, sd * .4); }
      // stained glass over the gallery, spider banners between, gothic windows above the stairs
      for (const x of [-7, 0, 7]) { gwin(M, x, -HY, GH + 1.2, 2.6, 5.4, 1, 'stained_purple'); M.block('stone_dark', x, -HY + .1, GH + 1.1, 3, .2, .2); }
      for (const x of [-3.5, 3.5]) wallArt(M, 'back', x, GH + 1.6, 1.6, 4.4, 'banner_cc', HX, HY, .08);
      for (const sd of [-1, 1]) for (const y of [-5, 2]) gwinSide(M, sd * (HX - .02), y, 8, 2, 4.2, -sd, 'stained_purple');
      // the fireplace under the gallery
      M.block('stone_dark', 0, -HY + .6, 0, 6, 1.2, 3.8); M.block('dark', 0, -HY + 1.21, .3, 3, .02, 2.2); M.block('stone', 0, -HY + .8, 3.8, 6.6, 1.6, .3); flame(M, 0, -HY + .8, .3, .8); flame(M, -.6, -HY + .9, .3, .5); flame(M, .6, -HY + .9, .3, .5);
      for (const x of [-2.6, 2.6]) { M.cyl('candle', [x, -HY + .7, 4.1], .06, .4, 6); M.sphere('fire', [x, -HY + .7, 4.58], .06, 1.6, 5, 3); }
      // the gang's portraits by the door, in gold frames
      [-10, -5.6, 5.6, 10].forEach((u, k) => { wallArt(M, 'front', u, 2.8, 2.8, 3.6, 'cc_portraits', HX, HY, .1, [[k / 4, 0], [(k + 1) / 4, 0], [(k + 1) / 4, 1], [k / 4, 1]]); for (const [dx, dz, w, h] of [[0, -.1, 3.1, .16], [0, 3.6, 3.1, .16], [-1.48, 1.7, .16, 3.9], [1.48, 1.7, .16, 3.9]]) M.block('gold', u + dx, HY - .08, 2.8 + dz, w, .1, h); });
      // candelabras at the stair feet, pumpkin lanterns by the door
      for (const sd of [-1, 1]) { const x = sd * (SX[0] - 1), y = ST[0] + .8; M.cyl('iron', [x, y, 0], .3, .1, 8); M.rod('iron', [x, y, .1], [x, y, 2.2], .05, 5); for (const t of [-1, 0, 1]) { M.rod('iron', [x, y, 2], [x + t * .4, y, 2.3], .03, 4); M.cyl('candle', [x + t * .4, y, 2.3], .05, .3, 6); M.sphere('fire', [x + t * .4, y, 2.66], .05, 1.6, 5, 3); } }
      for (const x of [-3.4, 3.4]) ccPumpkin(M, x, HY - 1, 0, .5, 0);
    },
    // the manor's chandelier (a part, turning slowly): two iron rings of candles on chains, crystal drops
    room_cc_chandelier(M) {
      M.room = true; const z1 = -4.6, z2 = -3.8;
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; M.rod('iron', [0, 0, 0], [Math.cos(a) * 2.4, Math.sin(a) * 2.4, z1], .025, 3); }
      M.tube('iron', [0, 0, z1 - .05], [0, 0, z1 + .05], 2.4, 2.4, 32, false); M.tube('iron', [0, 0, z2 - .05], [0, 0, z2 + .05], 1.2, 1.2, 24, false); M.rod('iron', [0, 0, 0], [0, 0, z1 - .6], .05, 5); M.sphere('iron', [0, 0, z1 - .7], .16, 1, 8, 4);
      for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2, x = Math.cos(a) * 2.4, y = Math.sin(a) * 2.4; M.cyl('iron', [x, y, z1 + .05], .1, .06, 6); M.cyl('candle', [x, y, z1 + .1], .06, .34, 6); M.sphere('fire', [x, y, z1 + .52], .06, 1.6, 5, 3); M.sphere('glass', [x * 1.04, y * 1.04, z1 - .3], .07, 1.6, 5, 3); }
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + .3, x = Math.cos(a) * 1.2, y = Math.sin(a) * 1.2; M.cyl('candle', [x, y, z2 + .05], .05, .3, 6); M.sphere('fire', [x, y, z2 + .43], .05, 1.6, 5, 3); }
    },
    room_cc_ghost(M) { M.room = true; piece(M, 'cc_ghost', 0, 0, -1); },
    // the Cute & Creepy Crypt (quest: the Crypt Key): down the steps from the landing into the vault, sarcophagi in two rows,
    // cute skulls in the wall niches, green candles everywhere, the great coffin with the glowing keyhole on its dais at the end
    // under the green stained glass
    room_cc_crypt(M) {
      M.room = true;
      const { HX, HY, H, DW, DH, LH, LY, SY, VS } = CK;
      M.block('stone_dark', 0, 0, -.3, 2 * HX + 1, 2 * HY + 3, .3);
      for (const sd of [-1, 1]) M.block('stone_dark', sd * (HX + .2), 0, 0, .4, 2 * HY + .8, VS + .05);
      const n = 18, arc = Array.from({ length: n + 1 }, (_, i) => { const ang = Math.PI * i / n; return [-Math.cos(ang) * HX, VS + (H - VS) * Math.sin(ang)]; });
      const rows = [], uv = []; for (let y = -HY - .2; y <= HY + .21; y += 2.5) { rows.push(arc.map(([x, z]) => [x, y, z])); uv.push(arc.map((_, i) => [i / n * 6, y / 2.4])); } M.grid('stone_dark', rows, uv);
      for (let y = -HY + 1.5; y < HY; y += 3) for (let i = 0; i < n; i++) M.rod('stone', [arc[i][0] * .97, y, arc[i][1] - .08], [arc[i + 1][0] * .97, y, arc[i + 1][1] - .08], .14, 5);
      for (const yw of [-HY, HY]) M.poly('stone_dark', [[-HX, yw, 0], [HX, yw, 0], ...arc.slice().reverse().map(([x, z]) => [x, yw, z])]);
      // the landing at the door, its balustrade, the steps down; the doorway
      M.block('stone', 0, (LY + HY) / 2, 0, 2 * HX, HY - LY, LH); stairsK(M, 'stone', -1.8, 1.8, SY, LY, 0, LH, 7, 1);
      for (const sd of [-1, 1]) railK(M, [sd * 1.9, LY, LH], [sd * HX, LY, LH], 1, 'iron', 'iron');
      M.quad('doorview', [[-DW / 2, HY - .02, LH], [DW / 2, HY - .02, LH], [DW / 2, HY - .02, LH + DH], [-DW / 2, HY - .02, LH + DH]]); for (const sd of [-1, 1]) M.block('stone', sd * (DW / 2 + .2), HY - .2, LH, .4, .4, DH + .2); M.block('stone', 0, HY - .2, LH + DH, DW + .8, .4, .4);
      // the sarcophagi, their effigies and nameplates, flowers and a pumpkin on some
      let sd0 = 221; const r = () => (sd0 = (sd0 * 16807) % 2147483647) / 2147483647;
      for (const sd of [-1, 1]) for (const y of [-8.4, -3.6, 1.2]) {
        const x = sd * 5; M.block('stone', x, y, 0, 1.8, 3.2, .9); M.block('stone_dark', x, y, .9, 2, 3.4, .22); blob(M, 'stone', [x, y + .2, 1.12], .5, 1.3, .24, { segs: 10, rings: 5, amp: .1, seed: (y * 10 | 0) + sd * 50 }); M.sphere('stone', [x, y - 1.15, 1.32], .3, .9, 8, 4); M.block('gold', x - sd * .91, y, .45, .02, .9, .22);
        if (r() < .5) ccPumpkin(M, x + .3, y + 1.2, 1.12, .22, 0); else for (let k = 0; k < 3; k++) M.sphere(['flower_pink', 'flower_purple', 'flower_orange'][k], [x - .2 + k * .2, y + 1.1, 1.18], .07, .8, 6, 3);
      }
      // the skull niches in the side walls, two rows
      for (const sd of [-1, 1]) for (let y = -12; y <= 8; y += 1.6) for (const z of [.7, 1.75]) {
        const x = sd * (HX - .02); M.quad('dark', [[x, y - .35, z], [x, y + .35, z], [x, y + .35, z + .62], [x, y - .35, z + .62]]); const sx = sd * (HX - .24);
        M.sphere('bone', [sx, y, z + .28], .2, 1, 8, 5); for (const t of [-1, 1]) M.sphere('dark', [sx - sd * .17, y + t * .08, z + .3], .05, 1, 5, 3); M.quad('dark', [[sx - sd * .2, y - .05, z + .14], [sx - sd * .2, y + .05, z + .14], [sx - sd * .2, y, z + .2]]);
        if ((y * 10 + z * 3 | 0) % 3 === 0) for (const t of [-1, 1]) M.poly('pumpkin', [[sx, y, z + .5], [sx, y + t * .18, z + .58], [sx, y + t * .18, z + .42]]);
      }
      // green candles along the aisle and on the steps, cobwebs in the corners of the vault
      for (const sd of [-1, 1]) for (let y = -9; y <= 5; y += 3.5) for (let k = 0; k < 3; k++) { const px = sd * (2.7 + (k % 2) * .25), py = y + (k - 1) * .3, h = .3 + .15 * k; M.cyl('candle', [px, py, 0], .06, h, 6); flame(M, px, py, h, .14, ['glow_green', 'brew']); }
      for (const sd of [-1, 1]) for (const y of [-HY + .12, LY - .22]) { // a web: threads fanning down and in from the corner, three sagging rings
        const cx = sd * (HX - .12), cz = VS + 1.5, sp = 6, at = (i, rr) => { const a = -Math.PI / 2 + i / (sp - 1) * Math.PI / 2; return [cx - sd * Math.cos(a) * rr, y, cz + Math.sin(a) * rr]; };
        for (let i = 0; i < sp; i++) M.rod('bone', [cx, y, cz], at(i, 1.6), .012, 3);
        for (const rr of [.45, .9, 1.35]) for (let i = 0; i < sp - 1; i++) { const a = at(i, rr), b = at(i + 1, rr); M.rod('bone', a, [(a[0] + b[0]) / 2, y, (a[2] + b[2]) / 2 - .05 * rr], .01, 3); M.rod('bone', [(a[0] + b[0]) / 2, y, (a[2] + b[2]) / 2 - .05 * rr], b, .01, 3); }
      }
      // the dais and the great coffin with the Crypt Key's lock, chains across it, candles round it, the green window above
      M.block('stone', 0, (-HY - 10.6) / 2, 0, 6.4, HY - 10.6, .45); M.block('stone_dark', 0, -10.6 - .05, 0, 6.4, .1, .45);
      const cy = -12.8, cz = .45, cw = 1.3, cl = 3.2; M.poly('darkwood', [[-cw * .7, cy - cl / 2, cz], [cw * .7, cy - cl / 2, cz], [cw, cy + cl * .2, cz], [cw * .6, cy + cl / 2, cz], [-cw * .6, cy + cl / 2, cz], [-cw, cy + cl * .2, cz]]);
      for (const z of [cz + .9]) M.poly('velvet', [[-cw * .7, cy - cl / 2, z], [cw * .7, cy - cl / 2, z], [cw, cy + cl * .2, z], [cw * .6, cy + cl / 2, z], [-cw * .6, cy + cl / 2, z], [-cw, cy + cl * .2, z]]);
      const ring = [[-cw * .7, cy - cl / 2], [cw * .7, cy - cl / 2], [cw, cy + cl * .2], [cw * .6, cy + cl / 2], [-cw * .6, cy + cl / 2], [-cw, cy + cl * .2]];
      for (let k = 0; k < 6; k++) { const a = ring[k], b = ring[(k + 1) % 6]; M.quad('darkwood', [[a[0], a[1], cz], [b[0], b[1], cz], [b[0], b[1], cz + .9], [a[0], a[1], cz + .9]]); }
      M.block('gold', 0, cy + cl / 2 + .01, cz + .3, .5, .04, .4); M.quad('glow_green', [[-.12, cy + cl / 2 + .04, cz + .36], [.12, cy + cl / 2 + .04, cz + .36], [.04, cy + cl / 2 + .04, cz + .5], [-.04, cy + cl / 2 + .04, cz + .5]]);
      for (const t of [-.6, .6]) M.rod('iron', [-cw - .05, cy + t, cz + .92], [cw + .05, cy + t, cz + .92], .05, 5);
      for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2, px = Math.cos(a) * 2.6, py = cy + Math.sin(a) * 2; if (Math.abs(px) > 3.1 || py > -10.7) continue; M.cyl('candle', [px, py, .45], .06, .4, 6); flame(M, px, py, .85, .14, ['glow_green', 'brew']); }
      gwin(M, 0, -HY, 2.4, 2.4, 3.6, 1, 'stained_green');
    },
    // the Cute & Creepy Witch's Cottage (lore): the cauldron bubbling green over the hearth, shelves of bright potions, herbs
    // and little bats hanging from the beams, the black cat by the fire, the spell book open on its lectern, the broom by the door
    room_cc_witch(M) {
      M.room = true;
      const { HX, HY, H, DW, DH } = CW;
      hall(M, { HX, HY, H, DW, DH, floor: 'wood', wall: 'plaster_cc', wain: 'darkwood', wainH: 1, post: 'darkwood', postEvery: 3, beam: 'darkwood', ceil: 'darkwood', ceilBeam: 'darkwood', ceilEvery: 2 });
      M.block('stone', 0, -HY + .6, 0, 5, 1.2, 3.2); M.block('dark', 0, -HY + 1.21, .2, 2.6, .02, 1.8); M.cyl('stone', [0, -HY + .6, 3.2], .8, H - 3.2, 8, .6); flame(M, 0, -HY + .9, .2, .5);
      ccCauldron(M, 0, -3.6, 0);
      // potion shelves on the left wall
      for (const z of [.9, 1.9, 2.9]) { M.block('darkwood', -HX + .45, -.5, z - .08, .9, 7.2, .08); }
      M.block('darkwood', -HX + .45, -4.1, 0, .9, .1, 3.6); M.block('darkwood', -HX + .45, 3.1, 0, .9, .1, 3.6);
      let sd0 = 231; const r = () => (sd0 = (sd0 * 16807) % 2147483647) / 2147483647, pots = ['potion_pink', 'potion_cyan', 'potion_lime', 'potion_violet'];
      for (const z of [.9, 1.9, 2.9]) for (let y = -3.8; y < 2.9; y += .42) { const h = .2 + .2 * r(), m = pots[(r() * 4) | 0], x = -HX + .4 + (r() - .5) * .2; if (r() < .5) { M.cyl(m, [x, y, z], .12, h, 8); M.cyl(m, [x, y, z + h], .05, .12, 6); } else { M.sphere(m, [x, y, z + .14], .15, 1, 8, 4); M.cyl(m, [x, y, z + .26], .04, .14, 6); } M.cyl('wood', [x, y, z + h + .12], .05, .05, 6); }
      // herbs drying from the beams, the black cat on its cushion
      for (let k = 0; k < 9; k++) { const x = -5 + k * 1.25, y = k % 2 ? -2 : 2, zt = H - .45; M.rod('rope', [x, y, zt], [x, y, zt - .4], .012, 3); M.tube(k % 3 ? 'leaf' : 'straw', [x, y, zt - .4], [x, y, zt - 1], .06, .2, 6, true); }
      ccCat(M, -3.6, -4.4, 0);
      // the spell book on its lectern, candles, a table of jars, the broom, the round window full of moon
      M.cyl('darkwood', [4.8, -2, 0], .08, 1.3, 6); M.cyl('darkwood', [4.8, -2, 0], .4, .1, 8); M.box('darkwood', [4.8, -2.05, 1.38], [1, .8, .08], 0, .35); M.box('spellbook', [4.8, -2.1, 1.44], [.9, .66, .02], 0, .35);
      for (const t of [-1, 1]) { M.cyl('candle', [4.8 + t * .6, -2, 1.1], .05, .3, 6); M.sphere('fire', [4.8 + t * .6, -2, 1.46], .05, 1.6, 5, 3); }
      M.block('darkwood', 5, -1.6, 0, 2.4, 1.6, .9); for (const [dx, dy, m] of [[-.8, -.3, 'potion_lime'], [-.3, .3, 'glass'], [.5, -.2, 'potion_pink']]) M.cyl(m, [5 + dx, -1.6 + dy, .9], .14, .3, 8);
      M.cyl('stone', [5.7, -1.2, .9], .16, .14, 8); M.rod('darkwood', [5.65, -1.2, 1], [5.9, -1.1, 1.3], .03, 4);
      M.rod('wood', [HX - .4, -5.2, 0], [HX - .7, -4.6, 2.8], .05, 5); M.cyl('straw', [HX - .38, -5.25, 0], .3, .7, 8, .08);
      discK(M, 'night_sky', [HX - .05, 2.4, 2.9], [0, 1, 0], [0, 0, 1], .9, 24); M.tube('darkwood', [HX - .1, 2.4, 2.9], [HX, 2.4, 2.9], .98, .98, 24, false); for (const t of [0, 1]) M.rod('darkwood', [HX - .06, 2.4 - (t ? 0 : .9), 2.9 - (t ? .9 : 0)], [HX - .06, 2.4 + (t ? 0 : .9), 2.9 + (t ? .9 : 0)], .03, 4);
      M.quad('runner', [[-1.6, -1, .01], [1.6, -1, .01], [1.6, 3.6, .01], [-1.6, 3.6, .01]]);
    },
    // the cauldron's bubbles (a part, bobbing) and a bat hanging from a beam (a part, swaying)
    room_cc_bubbles(M) { M.room = true; for (const [dx, dy, rr] of [[.2, .1, .1], [-.25, -.05, .08], [0, -.25, .07], [.1, .3, .06]]) M.sphere('brew', [dx, dy, 0], rr, 1, 6, 3); },
    room_cc_bat(M) { M.room = true; ccBat(M, 0, 0, 0, 1.2); },
    // the Cute & Creepy Game Hall (games): the spooky fair, the giant dice on the dice table, the pumpkin bowling lane, the fortune
    // teller's tent with the crystal ball glowing, the plushie claw machine; bunting and lights, pumpkin lanterns on posts
    room_cc_game(M) {
      M.room = true;
      const { HX, HY, H, DW, DH, LX } = CG;
      hall(M, { HX, HY, H, DW, DH, floor: 'checker_cc', wall: 'plaster_cc', wain: 'darkwood', wainH: 1.4, rail: 'pumpkin', post: 'darkwood', postEvery: 4, beam: 'darkwood', ceil: 'darkwood', ceilBeam: 'darkwood', ceilEvery: 3 });
      for (const [a, b] of [[[-HX, -HY + .3], [HX, -HY + .3]], [[-HX + .3, -HY], [-HX + .3, HY]], [[HX - .3, -HY], [HX - .3, HY]], [[-HX, HY - .3], [HX, HY - .3]]]) {
        const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.round(L / .9);
        for (let k = 0; k < n; k++) { const t0 = k / n, t1 = (k + 1) / n, p = t => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], z = t => H - 1 - .5 * Math.sin(Math.PI * ((t * L / 4.5) % 1)); const [x0, y0] = p(t0), [x1, y1] = p(t1), [xm, ym] = p((t0 + t1) / 2); M.poly(['banner_cc', 'pumpkin', 'cloth_purple'][k % 3], [[x0, y0, z(t0)], [x1, y1, z(t1)], [xm, ym, z((t0 + t1) / 2) - .55]]); if (k % 2) M.sphere('window_glow', [xm, ym, z((t0 + t1) / 2) + .04], .07, 1, 5, 3); }
      }
      // the giant dice on the dice table
      M.block('darkwood', -4, -2, 0, 5.2, 3.6, .95); M.block('felt_green', -4, -2, .95, 4.9, 3.3, .05); for (const sd of [-1, 1]) { M.block('darkwood', -4, -2 + sd * 1.72, .95, 5.2, .16, .2); M.block('darkwood', -4 + sd * 2.52, -2, .95, .16, 3.6, .2); }
      dieK(M, -5.4, -2.4, 1, 1.1, .3, 5); dieK(M, -3.6, -1.4, 1, 1.1, -.5, 3); dieK(M, -2.6, -2.8, 1, .8, .9, 6);
      // the pumpkin bowling lane along the right wall
      const lx = (LX[0] + LX[1]) / 2, lw = LX[1] - LX[0];
      M.block('wood', lx, -3, 0, lw - .8, 17.6, .06); for (const sd of [-1, 1]) M.block('dark', lx + sd * (lw / 2 - .2), -3, 0, .4, 17.6, .04); for (const sd of [-1, 1]) M.block('pumpkin', lx + sd * (lw / 2), -3, 0, .08, 17.6, .3);
      for (const [i, j] of [[0, 0], [-1, 1], [1, 1], [-2, 2], [0, 2], [2, 2], [-3, 3], [-1, 3], [1, 3], [3, 3]]) { const px = lx + i * .32, py = -9.4 - j * .5; atK(M, px, py, .06, 0, () => lathe(M, 'white', [[0, 0], [.12, 0], [.16, .25], [.1, .5], [.07, .62], [.1, .74], [.001, .82]], 10)); M.sphere('bone', [px, py, .92], .07, 1, 6, 3); }
      M.quad('cloth_purple', [[LX[0], -11.8, 0], [LX[1], -11.8, 0], [LX[1], -11.8, 2.6], [LX[0], -11.8, 2.6]]);
      M.block('darkwood', lx, 5.2, 0, 1.4, 1.6, .7); for (const [dx, dy] of [[-.35, -.4], [.35, -.4], [0, .3]]) ccPumpkin(M, lx + dx, 5.2 + dy, .7, .32, dx);
      // the fortune teller's tent: striped cone roof, curtains open at the front, the table and the crystal ball
      const tx = -10, ty = -8.4, tr = 2.6;
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; M.cyl('darkwood', [tx + Math.cos(a) * tr, ty + Math.sin(a) * tr, 0], .07, 3, 5); }
      for (let k = 0; k < 16; k++) { const a0 = k / 16 * Math.PI * 2, a1 = (k + 1) / 16 * Math.PI * 2; M.poly(k % 2 ? 'tent_stripe' : 'pumpkin', [[tx + Math.cos(a0) * (tr + .3), ty + Math.sin(a0) * (tr + .3), 3], [tx + Math.cos(a1) * (tr + .3), ty + Math.sin(a1) * (tr + .3), 3], [tx, ty, 5.4]]);
        const front = Math.sin((a0 + a1) / 2) > .3 && Math.cos((a0 + a1) / 2) > -.2; if (!front) M.quad('cloth_purple', [[tx + Math.cos(a0) * tr, ty + Math.sin(a0) * tr, 0], [tx + Math.cos(a1) * tr, ty + Math.sin(a1) * tr, 0], [tx + Math.cos(a1) * tr, ty + Math.sin(a1) * tr, 3], [tx + Math.cos(a0) * tr, ty + Math.sin(a0) * tr, 3]]); }
      M.cyl('velvet', [tx, ty - .2, 0], .8, .9, 14, .9); M.cyl('gold', [tx, ty - .2, .9], .2, .1, 10); for (const [dx, dy] of [[-.5, .1], [.45, .25]]) M.box('paper', [tx + dx, ty - .2 + dy, .93], [.2, .3, .01], .4 * dx);
      M.cyl('velvet', [tx, ty + 1.2, 0], .4, .5, 10);
      // the claw machine
      const kx = 5, ky = -9.1; M.block('lacquer_red', kx, ky, 0, 2.2, 2.2, 1.3); M.block('lacquer_black', kx, ky, 3.4, 2.3, 2.3, .5); M.quad('neon_pink', [[kx - 1.1, ky + 1.16, 3.5], [kx + 1.1, ky + 1.16, 3.5], [kx + 1.1, ky + 1.16, 3.8], [kx - 1.1, ky + 1.16, 3.8]]);
      for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) M.block('lacquer_black', kx + a * 1.05, ky + b * 1.05, 1.3, .1, .1, 2.1);
      for (const sdx of [-1, 1]) M.quad('glass', [[kx + sdx * 1.08, ky - 1.08, 1.3], [kx + sdx * 1.08, ky + 1.08, 1.3], [kx + sdx * 1.08, ky + 1.08, 3.4], [kx + sdx * 1.08, ky - 1.08, 3.4]]); M.quad('glass', [[kx - 1.08, ky + 1.08, 1.3], [kx + 1.08, ky + 1.08, 1.3], [kx + 1.08, ky + 1.08, 3.4], [kx - 1.08, ky + 1.08, 3.4]]);
      for (let k = 0; k < 12; k++) { const px = kx - .8 + (k % 4) * .5, py = ky - .7 + ((k / 4) | 0) * .5, m = ['ghost', 'pumpkin', 'cat_black'][k % 3]; M.sphere(m, [px, py, 1.5 + (k % 2) * .1], .2, .9, 8, 4); }
      M.block('lacquer_black', kx, ky + 1.2, .9, .8, .3, .3); M.rod('iron', [kx + .2, ky + 1.3, 1.2], [kx + .2, ky + 1.3, 1.5], .03, 4); M.sphere('lacquer_red', [kx + .2, ky + 1.3, 1.55], .07, 1, 6, 3);
      // pumpkin lanterns on posts
      for (const [x, y] of [[-12.6, 9], [-12.6, 0], [6.6, 9]]) { M.cyl('darkwood', [x, y, 0], .1, 2, 5); ccPumpkin(M, x, y, 2, .4, 0); }
      wallArt(M, 'back', -1, 4.6, 2.4, 3.6, 'banner_cc', HX, HY, .08);
    },
    // the crystal ball glowing on the fortune teller's table and the claw over the plushies (parts)
    room_cc_crystal(M) { M.room = true; M.sphere('crystal', [0, 0, .32], .32, 1, 14, 7); M.sphere('glow_blue', [0, 0, .32], .14, 1, 8, 4); },
    room_cc_claw(M) { M.room = true; M.rod('iron', [0, 0, 0], [0, 0, -.6], .015, 3); M.cyl('iron', [0, 0, -.76], .12, .16, 6); for (let k = 0; k < 3; k++) { const a = k * 2.094; M.rod('iron', [0, 0, -.76], [Math.cos(a) * .2, Math.sin(a) * .2, -1], .02, 3); M.rod('iron', [Math.cos(a) * .2, Math.sin(a) * .2, -1], [Math.cos(a) * .1, Math.sin(a) * .1, -1.2], .02, 3); } },
    // the Chumpz Tiki Lounge (the bar's back room): bamboo walls and a thatch ceiling, the bamboo bar with the aquarium glowing
    // behind it, tiki masks, the jukebox, the light-up dance floor under the mirror ball, torches, palms in pots, surfboards
    room_chz_lounge(M) {
      M.room = true;
      const { HX, HY, H, DW, DH, DF } = ZB;
      hall(M, { HX, HY, H, DW, DH, floor: 'wood', wall: 'bamboo_wall', wain: 'plank_teal', wainH: 1, rail: 'palm_bark', post: 'palm_bark', postEvery: 4, beam: 'palm_bark', ceil: 'thatch', ceilBeam: 'bark', ceilEvery: 2.5 });
      for (const [a, b] of [[[-HX, -HY + .2], [HX, -HY + .2]], [[-HX + .2, -HY], [-HX + .2, HY]], [[HX - .2, -HY], [HX - .2, HY]], [[-HX, HY - .2], [HX, HY - .2]]]) { const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.round(L / .7); for (let k = 0; k < n; k++) { const t = (k + .5) / n, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t, nx = -(b[1] - a[1]) / L, ny = (b[0] - a[0]) / L, s = k % 2 ? 1 : -1; M.poly('banana_leaf', [[x - (b[0] - a[0]) / L * .35, y - (b[1] - a[1]) / L * .35, H], [x + (b[0] - a[0]) / L * .35, y + (b[1] - a[1]) / L * .35, H], [x + nx * .3 * s, y + ny * .3 * s, H - 1 - .3 * (k % 3)]]); } }
      // the aquarium on the back wall and the bamboo bar in front of it
      const ay = -HY + .6; M.block('bamboo_wall', -1.5, ay, 0, 13.4, 1.2, 1.4); M.block('bamboo_wall', -1.5, ay, 5, 13.4, 1.2, .5);
      M.quad('aqua', [[5, -HY + .05, 1.4], [-8, -HY + .05, 1.4], [-8, -HY + .05, 5], [5, -HY + .05, 5]]); M.quad('sawdust', [[-8, ay - .6, 1.42], [5, ay - .6, 1.42], [5, ay + .58, 1.42], [-8, ay + .58, 1.42]]); M.quad('glass', [[-8, ay + .6, 1.4], [5, ay + .6, 1.4], [5, ay + .6, 5], [-8, ay + .6, 5]]);
      for (let k = 0; k < 9; k++) { const x = -7.4 + k * 1.5; M.sphere(['flower_pink', 'orange', 'flower_purple'][k % 3], [x, ay - .2, 1.5], .25 + .1 * (k % 2), 1.2, 8, 4); M.tube('leaf', [x + .5, ay, 1.42], [x + .55, ay, 2.6 + (k % 3) * .4], .08, .02, 5, true); }
      for (let k = 0; k < 14; k++) M.sphere('glass', [-6 + (k % 7) * 1.7, ay + .1, 2 + (k * .37) % 2.8], .05, 1, 5, 3);
      M.block('bamboo_wall', -1.5, -6, 0, 15, 1.2, 1.2); M.block('wood', -1.5, -6, 1.2, 15.4, 1.5, .1); for (let k = 0; k < 7; k++) chzStool(M, -8 + k * 2.1, -4.6, 0);
      for (const [dx, m] of [[-6, 'bottle_green'], [-4.4, 'bottle_brown'], [-2.6, 'bottle_clear'], [.6, 'bottle_green'], [3, 'bottle_brown']]) { M.cyl(m, [dx, -6, 1.3], .07, .3, 6); M.cyl(m, [dx, -6, 1.6], .03, .12, 5); }
      for (const x of [-11, -10, 7.5, 9.5]) wallArt(M, 'back', x, 1.6, .9, 1.8, 'tiki_mask', HX, HY, .06); for (const y of [-4, 4]) { wallArt(M, 'left', y, 2.2, 1, 2, 'tiki_mask', HX, HY, .06); wallArt(M, 'right', y + 3, 2.2, 1, 2, 'tiki_mask', HX, HY, .06); }
      // the jukebox
      const jx = HX - .9, jy = 2; M.block('plank_red', jx, jy, 0, 1.4, 1.8, 1.8); M.sphere('plank_red', [jx, jy, 1.8], .9, .6, 12, 5); M.quad('window_glow', [[jx - .71, jy - .6, .9], [jx - .71, jy + .6, .9], [jx - .71, jy + .6, 1.7], [jx - .71, jy - .6, 1.7]]);
      for (const [m, dz] of [['neon_pink', 0], ['neon_cyan', .2], ['neon_gold', .4]]) curveTube(M, m, [[jx - .72, jy - .85, .2], [jx - .72, jy - .9, 1.6 + dz], [jx - .72, jy, 2.35 + dz * .5], [jx - .72, jy + .9, 1.6 + dz], [jx - .72, jy + .85, .2]], [.04, .04, .04, .04, .04], { segs: 4, n: 4, seed: 9 });
      // the light-up dance floor, the tables, the tiki torches, palms in pots, surfboards
      const [dx0, dy0, dx1, dy1] = DF, ts = 2; for (let i = 0; i < (dx1 - dx0) / ts; i++) for (let j = 0; j < (dy1 - dy0) / ts; j++) M.block(['neon_cyan', 'neon_pink', 'neon_gold', 'neon_purple'][(i + 2 * j) % 4], dx0 + (i + .5) * ts, dy0 + (j + .5) * ts, 0, ts - .08, ts - .08, .03);
      for (const [x, y] of [[-9.5, 2], [-9.5, 6.4], [-5.8, 7.6]]) chzTable(M, x, y, 0);
      for (const [x, y] of [[-12.3, -9.3], [12.3, -9.3], [-12.3, 9.3], [12.3, 9.3]]) { M.cyl('palm_bark', [x, y, 0], .12, 2.6, 6); M.cyl('bamboo_wall', [x, y, 2.2], .2, .5, 8, .26); flame(M, x, y, 2.7, .5); }
      for (const [x, y] of [[9, 7.6], [11.6, -6.4]]) { M.cyl('clay', [x, y, 0], .55, .8, 10, .7); M.rod('palm_bark', [x, y, .7], [x + .2, y, 3.2], .1, 6); for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; M.poly('palm_leaf', [[x + .2, y, 3.2], [x + .2 + Math.cos(a) * 1.6, y + Math.sin(a) * 1.6, 2.5], [x + .2 + Math.cos(a + .25) * 1.2, y + Math.sin(a + .25) * 1.2, 2.9]]); } }
      for (const [y, m] of [[-6, 'plank_yellow'], [-4, 'plank_red'], [6, 'plank_teal']]) M.sphere(m, [-HX + .3, y, 3.6], .5, 3.4, 12, 6);
      for (const [x, y] of [[-6, 0], [6, 0], [0, 6]]) chzLantern(M, x, y, H - .5);
    },
    // the mirror ball over the dance floor and the fish in the aquarium (parts)
    room_chz_mirrorball(M) { M.room = true; M.rod('iron', [0, 0, 0], [0, 0, -.6], .02, 3); M.sphere('mirror_black', [0, 0, -1.05], .45, 1, 14, 8); for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2, e = ((k * 7) % 5 - 2) * .3; M.box('glass', [Math.cos(a) * .44 * Math.cos(e), Math.sin(a) * .44 * Math.cos(e), -1.05 + .44 * Math.sin(e)], [.1, .1, .1], a); } },
    room_chz_fish_a(M) { M.room = true; M.sphere('fish', [0, 0, 0], .16, .55, 8, 4); M.poly('fish', [[-.2, 0, 0], [-.38, 0, .12], [-.38, 0, -.12]]); M.sphere('orange', [.06, 0, .02], .06, 1, 5, 3); },
    room_chz_fish_b(M) { M.room = true; M.sphere('orange', [0, 0, 0], .13, .6, 8, 4); M.poly('orange', [[-.16, 0, 0], [-.3, 0, .1], [-.3, 0, -.1]]); M.sphere('white', [0, 0, .02], .07, 1.2, 5, 3); },
    // the Chumpz Jungle Casino (the dice hall's back room): green felt dice tables, the giant banana wheel spinning on the back
    // wall, palm trunks for columns, gold banana chandeliers, slot machines, the cashier's cage
    room_chz_casino(M) {
      M.room = true;
      const { HX, HY, H, DW, DH, WR, WZ } = ZC;
      hall(M, { HX, HY, H, DW, DH, floor: 'darkwood', wall: 'jungle_wall', wain: 'plank_yellow', wainH: 1.2, rail: 'gold', post: 'palm_bark', postEvery: 4.4, beam: 'darkwood', ceil: 'darkwood', ceilBeam: 'gold', ceilEvery: 3 });
      M.quad('felt_red', [[-HX + 1.4, -HY + 1.4, .01], [HX - 1.4, -HY + 1.4, .01], [HX - 1.4, HY - 1.4, .01], [-HX + 1.4, HY - 1.4, .01]], [[0, 0], [6, 0], [6, 6], [0, 6]]);
      // the wheel's frame and pointer (the wheel itself turns: a part), lights round it
      M.tube('darkwood', [0, -HY + .1, WZ], [0, -HY + .3, WZ], WR + .5, WR + .5, 40, false); discK(M, 'darkwood', [0, -HY + .1, WZ], [1, 0, 0], [0, 0, 1], WR + .5, 40);
      for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; M.sphere('window_glow', [Math.cos(a) * (WR + .3), -HY + .32, WZ + Math.sin(a) * (WR + .3)], .08, 1, 5, 3); }
      M.poly('lacquer_red', [[0, -HY + .75, WZ + WR - .3], [-.3, -HY + .75, WZ + WR + .5], [.3, -HY + .75, WZ + WR + .5]]); M.block('darkwood', 0, -HY + .4, 0, 4, .6, WZ - WR - .4);
      // the dice tables
      for (const [x, y] of [[-6.5, -2.6], [6.5, -2.6], [0, 3]]) {
        M.block('darkwood', x, y, 0, 4.8, 2.8, .9); M.block('felt_green', x, y, .9, 4.4, 2.4, .04); for (const sd of [-1, 1]) { M.block('darkwood', x, y + sd * 1.32, .9, 4.8, .16, .3); M.block('darkwood', x + sd * 2.32, y, .9, .16, 2.8, .3); }
        M.quad('chalk', [[x - 1.6, y - .6, .945], [x + 1.6, y - .6, .945], [x + 1.6, y - .56, .945], [x - 1.6, y - .56, .945]]); dieK(M, x - .4, y + .2, .94, .2, .5, 4); dieK(M, x + .1, y + .4, .94, .2, -.3, 2);
        for (let k = 0; k < 5; k++) for (let q = 0; q < 3 + (k % 3); q++) M.cyl(['lacquer_red', 'felt_blue', 'white', 'gold', 'felt_green'][k], [x - 1.4 + k * .7, y - .9, .94 + q * .04], .1, .035, 10);
        const cz = H - 1.6; M.tube('gold', [x, y, cz], [x, y, cz + .08], 1.2, 1.2, 20, false); for (let k = 0; k < 3; k++) M.rod('gold', [x + Math.cos(k * 2.09) * 1.2, y + Math.sin(k * 2.09) * 1.2, cz], [x, y, H], .02, 3);
        M.remap = { banana: 'gold', banana_stem: 'gold' }; for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; chzBanana(M, x + Math.cos(a) * 1.2, y + Math.sin(a) * 1.2, cz - .25, .7, .09, .1); } M.remap = null;
        for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + .5; M.sphere('window_glow', [x + Math.cos(a) * 1.2, y + Math.sin(a) * 1.2, cz + .2], .08, 1.4, 5, 3); }
      }
      // palm trunks for columns, their fronds under the ceiling
      for (const [x, y] of [[-9.5, -6], [9.5, -6], [-9.5, 5.4], [9.5, 5.4]]) { curveTube(M, 'palm_bark', [[x, y, 0], [x + .2, y, H * .4], [x - .1, y + .1, H * .8], [x, y, H]], [.42, .36, .32, .3], { segs: 8, n: 4, bump: .06, seed: x * 3 + y | 0 }); for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; M.poly('palm_leaf', [[x, y, H - .2], [x + Math.cos(a) * 2.6, y + Math.sin(a) * 2.6, H - 1.2], [x + Math.cos(a + .3) * 1.8, y + Math.sin(a + .3) * 1.8, H - .4]]); } }
      // slot machines along the left wall, the cashier's cage
      for (let y = -6.4; y <= 6.5; y += 1.6) { const x = -HX + .65; M.block('plank_red', x, y, 0, 1.1, 1.2, 1.9); M.block('gold', x, y, 1.9, 1.2, 1.3, .12); M.quad('slot_reels', [[x + .56, y + .45, 1], [x + .56, y - .45, 1], [x + .56, y - .45, 1.5], [x + .56, y + .45, 1.5]]); M.quad('neon_gold', [[x + .56, y + .5, 1.65], [x + .56, y - .5, 1.65], [x + .56, y - .5, 1.8], [x + .56, y + .5, 1.8]]); M.rod('metal', [x + .1, y - .66, 1.2], [x + .1, y - .66, 1.7], .03, 4); M.sphere('lacquer_red', [x + .1, y - .66, 1.75], .07, 1, 6, 3); M.block('felt_green', x + .1, y + 1.4, 0, .6, .6, .7); }
      const cx0 = 8, cy0 = 5.6; M.block('darkwood', (cx0 + HX) / 2, cy0, 0, HX - cx0, .4, 1.2); M.block('darkwood', cx0, (cy0 + 9.6) / 2, 0, .4, 9.6 - cy0, 1.2); M.block('wood', (cx0 + HX) / 2, cy0, 1.2, HX - cx0 + .2, .5, .08);
      for (let x = cx0 + .3; x < HX; x += .3) M.rod('iron', [x, cy0, 1.28], [x, cy0, 3.2], .025, 4); M.block('darkwood', (cx0 + HX) / 2, cy0, 3.2, HX - cx0, .3, .2); M.quad('sign_chzdice', [[cx0 + .5, cy0 - .17, 3.4], [HX - .5, cy0 - .17, 3.4], [HX - .5, cy0 - .17, 4.8], [cx0 + .5, cy0 - .17, 4.8]]);
      for (let k = 0; k < 4; k++) M.cyl('gold', [10 + k * .5, cy0 + 1, 1.28], .1, .06 + .04 * k, 10);
    },
    // the banana wheel (a part, turning about its axle out of the wall): sixteen segments, a banana on every other one, pegs
    room_chz_wheel(M) {
      M.room = true; const R = ZC.WR, n = 16, cols = ['felt_green', 'banana', 'felt_red', 'gold'];
      for (let k = 0; k < n; k++) { const a0 = k / n * Math.PI * 2, a1 = (k + 1) / n * Math.PI * 2; M.poly(cols[k % 4], [[0, .02, 0], [Math.cos(a0) * R, .02, Math.sin(a0) * R], [Math.cos(a1) * R, .02, Math.sin(a1) * R]]); M.sphere('gold', [Math.cos(a0) * (R - .08), .08, Math.sin(a0) * (R - .08)], .07, 1, 5, 3); M.rod('darkwood', [0, .03, 0], [Math.cos(a0) * R, .03, Math.sin(a0) * R], .025, 3); }
      for (let k = 0; k < n; k += 2) { const a = (k + .5) / n * Math.PI * 2; atK(M, Math.cos(a) * R * .66, .06, Math.sin(a) * R * .66, 0, () => chzBanana(M, 0, 0, 0, .7, .1, .1)); }
      M.tube('gold', [0, -.02, 0], [0, .1, 0], R + .05, R + .05, 40, false); M.rod('gold', [0, -.05, 0], [0, .16, 0], .38, 16); M.sphere('banana', [0, .18, 0], .2, .6, 10, 4);
    },
    // the Chumpz Bait Shop's back room (shop): rod racks, bait tanks with lures glowing in them, the trophy fish on the wall,
    // nets and buoys overhead, the frosted cooler door, the counter and the register, tackle boxes
    room_chz_bait(M) {
      M.room = true;
      const { HX, HY, H, DW, DH } = ZT;
      hall(M, { HX, HY, H, DW, DH, floor: 'wood', wall: 'plank_teal', wain: 'wood', wainH: 1, rail: 'plank_yellow', post: 'wood', postEvery: 3, beam: 'wood', ceil: 'wood', ceilBeam: 'darkwood', ceilEvery: 2 });
      // rod racks
      for (const z of [.3, 2.2]) M.block('darkwood', -HX + .4, 0, z, .5, 8, .12);
      for (let y = -3.6; y <= 3.7; y += .45) { M.rod('darkwood', [-HX + .45, y, .35], [-HX + .2, y + .1, 3.9], .03, 4); M.cyl('metal', [-HX + .42, y, 1], .07, .08, 6); M.rod('rope', [-HX + .2, y + .1, 3.9], [-HX + .5, y + .14, 2.6], .004, 3); }
      // bait tanks with glowing lures
      for (const x of [-4.3, -1.9, .5]) { M.block('wood', x, -HY + .7, 0, 2.2, 1.2, .9); M.quad('aqua', [[x - 1, -HY + .14, .92], [x + 1, -HY + .14, .92], [x + 1, -HY + .14, 1.9], [x - 1, -HY + .14, 1.9]]); M.quad('glass', [[x - 1, -HY + 1.2, .9], [x + 1, -HY + 1.2, .9], [x + 1, -HY + 1.2, 1.9], [x - 1, -HY + 1.2, 1.9]]); for (const sdx of [-1, 1]) M.quad('glass', [[x + sdx, -HY + .14, .9], [x + sdx, -HY + 1.2, .9], [x + sdx, -HY + 1.2, 1.9], [x + sdx, -HY + .14, 1.9]]);
        for (let k = 0; k < 6; k++) M.sphere(k % 2 ? 'lure_glow' : 'lure_orange', [x - .7 + k * .28, -HY + .5 + (k % 3) * .2, 1.1 + (k % 2) * .4], .06, 1.6, 6, 3); }
      // the frosted cooler door, the counter, the register
      const cx = 4.5; M.block('metal', cx, -HY + .1, 0, 2.4, .2, 3.4); M.quad('glass_frost', [[cx - .9, -HY + .22, .3], [cx + .9, -HY + .22, .3], [cx + .9, -HY + .22, 3.1], [cx - .9, -HY + .22, 3.1]]); M.rod('chrome', [cx - .7, -HY + .35, 1.2], [cx - .7, -HY + .35, 2.2], .05, 6);
      M.block('wood', 3.6, -1, 0, 2.8, 2.4, 1.1); M.block('wood', 3.6, -1, 1.1, 3, 2.6, .08); M.block('metal', 3.2, -1, 1.18, .7, .6, .4); M.quad('window_glow', [[2.9, -.69, 1.3], [3.5, -.69, 1.3], [3.5, -.69, 1.52], [2.9, -.69, 1.52]]);
      // the trophy fish on the right wall
      for (const [y, z, s] of [[-3.6, 2.6, 1.1], [-1, 3.3, .9], [1.6, 2.5, 1.3], [3.6, 3.4, .8]]) { M.block('darkwood', HX - .08, y, z - .5 * s, .1, 1.6 * s, 1 * s); M.sphere('fish', [HX - .25, y, z], .3 * s, .45, 10, 5); M.poly('fish', [[HX - .25, y - .9 * s, z], [HX - .25, y - 1.25 * s, z + .3 * s], [HX - .25, y - 1.25 * s, z - .3 * s]]); M.sphere('dark', [HX - .32, y + .62 * s, z + .05], .04, 1, 5, 3); }
      // nets and buoys overhead, tackle boxes, a cooler, a bucket
      for (const [x0, x1, y] of [[-5, 1, 2], [-2, 4, -2.6]]) { const rows = [], uv = []; for (let i = 0; i <= 6; i++) { const t = i / 6, x = x0 + (x1 - x0) * t, z = H - .2 - .8 * Math.sin(Math.PI * t); rows.push([[x, y - .6, z], [x, y + .6, z + .1]]); uv.push([[t * 3, 0], [t * 3, 1]]); } M.grid('net', rows, uv); for (const t of [.3, .6]) M.sphere('orange', [x0 + (x1 - x0) * t, y, H - .2 - .8 * Math.sin(Math.PI * t) - .25], .22, 1, 8, 4); }
      for (const [x, y, m] of [[-4.6, 3.6, 'lacquer_red'], [-3.6, 4.4, 'felt_green'], [5.6, 3.8, 'white']]) { M.block(m, x, y, 0, 1, .6, .5); M.block('metal', x, y, .5, .3, .1, .06); }
      M.cyl('metal', [-1.4, 4.6, 0], .3, .5, 10, .34); M.tube('metal', [-1.4, 4.6, .5], [-1.4, 4.6, .52], .34, .34, 10, false);
      M.quad('sign_fishbook', [[-2, HY - .06, 3.6], [2, HY - .06, 3.6], [2, HY - .06, 4.6], [-2, HY - .06, 4.6]]);
    },
    // the Chumpz Ship Cabin (quest: the map piece): under the sailboat's stern, the curved stern windows full of turquoise sea,
    // the chart table with the treasure map and the captain's instruments, the hammock, the sea chest, the lantern swinging
    room_chz_cabin(M) {
      M.room = true;
      const { HX, HY, H, DW, DH } = ZS;
      M.block('wood', 0, 0, -.3, 2 * HX + 1, 2 * HY + 3, .3);
      for (const sd of [-1, 1]) { M.poly('plank_red', [[sd * HX, -HY + .6, 0], [sd * HX, HY, 0], [sd * (HX - .9), HY, H], [sd * (HX - .9), -HY + .9, H]]); for (let y = -HY + 1.4; y < HY; y += 1.4) M.rod('darkwood', [sd * (HX - .06), y, 0], [sd * (HX - .96), y, H], .08, 4); }
      M.block('wood', 0, 0, H, 2 * HX, 2 * HY + .4, .2); for (let y = -HY + 1; y < HY; y += 1.2) M.block('darkwood', 0, y, H - .25, 2 * HX - 1.6, .22, .25);
      // the front wall with its door
      for (const [a, b] of [[-HX, -DW / 2], [DW / 2, HX]]) M.block('plank_red', (a + b) / 2, HY + .1, 0, b - a, .2, H); M.block('plank_red', 0, HY + .1, DH, DW, .2, H - DH); M.quad('doorview', [[-DW / 2, HY + .3, 0], [DW / 2, HY + .3, 0], [DW / 2, HY + .3, DH], [-DW / 2, HY + .3, DH]]); for (const sd of [-1, 1]) M.block('darkwood', sd * (DW / 2 + .1), HY, 0, .2, .3, DH);
      // the curved stern: five windows between mullions, the sea outside
      const sx = t => t * (HX - .4), sy = t => -HY - .8 * (1 - t * t) + .6, N = 10;
      for (let k = 0; k < N; k++) { const t0 = -1 + 2 * k / N, t1 = -1 + 2 * (k + 1) / N, p0 = [sx(t0), sy(t0)], p1 = [sx(t1), sy(t1)];
        M.quad('plank_red', [[p0[0], p0[1], 0], [p1[0], p1[1], 0], [p1[0], p1[1], 1.2], [p0[0], p0[1], 1.2]]); M.quad('plank_red', [[p0[0], p0[1], 3.5], [p1[0], p1[1], 3.5], [p1[0], p1[1], H], [p0[0], p0[1], H]]);
        if (k % 2 === 0) M.rod('darkwood', [p0[0], p0[1] + .05, 1.2], [p0[0], p0[1] + .05, 3.5], .09, 5); M.rod('darkwood', [p0[0], p0[1] + .05, 2.35], [p1[0], p1[1] + .05, 2.35], .03, 3); }
      M.rod('darkwood', [sx(1), sy(1) + .05, 1.2], [sx(1), sy(1) + .05, 3.5], .09, 5); M.block('darkwood', 0, -HY + .2, 1.1, 2 * HX - 1, .5, .14);
      M.quad('sea_turq', [[9, -HY - 4, -2], [-9, -HY - 4, -2], [-9, -HY - 4, 6], [9, -HY - 4, 6]]);
      // the chart table, the map, the instruments, a stool
      M.block('darkwood', 0, -2.4, 0, 3, 1.8, .95); M.quad('treasure_map', [[-1.2, -3.1, .96], [1.2, -3.1, .96], [1.2, -1.7, .96], [-1.2, -1.7, .96]]);
      M.cyl('brass', [.9, -2.9, .96], .16, .06, 12); M.rod('brass', [-1, -1.9, 1], [-.5, -2, 1.05], .02, 4); M.rod('brass', [-1, -1.9, 1], [-.8, -1.8, 1.25], .02, 4); M.rod('paper', [1.2, -1.8, 1.02], [.2, -1.8, 1.02], .06, 8); M.cyl('brass', [-1.1, -2.9, .96], .1, .3, 8); M.sphere('window_glow', [-1.1, -2.9, 1.34], .1, 1.2, 6, 3);
      M.cyl('wood', [0, -.6, 0], .3, .7, 8);
      // the hammock across the front-left corner, the sea chest, a barrel, rope
      const rows = [], uv = []; for (let i = 0; i <= 8; i++) { const t = i / 8, x = -HX + .8 + 3.2 * t, y = 1.2 + 2.8 * t, z = 2.6 - 1 * Math.sin(Math.PI * t); rows.push([[x - .3, y + .3, z + .1], [x + .3, y - .3, z + .1]]); uv.push([[0, t], [1, t]]); } M.grid('sail', rows, uv); M.rod('rope', [-HX + .5, .9, 3.2], [-HX + .8, 1.2, 2.7], .02, 3); M.rod('rope', [-HX + 4.3, 4.3, 3.2], [-HX + 4, 4, 2.7], .02, 3);
      M.block('darkwood', 4.7, 2.9, 0, 1.6, 1, .8); M.box('darkwood', [4.7, 2.9, .9], [1.62, 1.02, .26]); for (const dx of [-.5, .5]) M.block('brass', 4.7 + dx, 2.9, 0, .06, 1.04, .92);
      M.cyl('wood', [4.6, -3, 0], .5, 1.2, 12, .45); for (const z of [.2, 1]) M.cyl('iron', [4.6, -3, z], .51, .05, 12); for (let k = 0; k < 4; k++) M.tube('rope', [-4.2, -3, k * .09], [-4.2, -3, k * .09 + .08], .45 - k * .04, .45 - k * .04, 12, false);
    }
  });
  // ── Saints of LA rooms ──
  function slChair(M, x, y, a, seat = 'paint_black', z0 = 0) { // a modern chair at (x, y) facing (cos a, sin a)
    const c = Math.cos(a), s = Math.sin(a), P = (f, l, z) => [x + f * c - l * s, y + f * s + l * c, z0 + z];
    M.box(seat, P(0, 0, .82), [.8, .8, .1], a); M.box(seat, P(-.38, 0, 1.4), [.08, .8, 1.1], a); for (const [f, l] of [[-.32, -.32], [.32, -.32], [.32, .32], [-.32, .32]]) M.box('chrome', P(f, l, .4), [.05, .05, .8], a);
  }
  function slPin(M, x, y) { atK(M, x, y, 0, 0, () => lathe(M, 'white', [[0, 0], [.1, 0], [.15, .22], [.09, .46], [.06, .56], [.09, .68], [.001, .78]], 10)); M.cyl('paint_red', [x, y, .52], .065, .05, 10); }
  Object.assign(B, {
    // the Saints HQ (quest: the briefing): a loft with a glass wall onto the LA skyline at dusk, the giant wings mural, the halo
    // ringed in gold neon over the briefing table, sofas, the kitchen counter, trophies; the screen for the briefings
    room_sl_hq(M) {
      M.room = true;
      const { HX, HY, H, DW, DH } = QH;
      hall(M, { HX, HY, H, DW, DH, floor: 'concrete', wall: 'stucco', wain: 'concrete_dark', wainH: .3, post: 'metal', postEvery: 6.5, beam: 'metal', ceil: 'concrete', ceilBeam: 'metal', ceilEvery: 3.25, backOpen: [-HX + .6, HX - .6, .3, H - .4] });
      M.quad('glass', [[HX - .6, -HY - .2, .3], [-HX + .6, -HY - .2, .3], [-HX + .6, -HY - .2, H - .4], [HX - .6, -HY - .2, H - .4]]);
      for (let x = -HX + .6; x <= HX - .5; x += 2.6) M.block('metal', x, -HY - .2, .3, .14, .2, H - .7); M.block('metal', 0, -HY - .2, 4.6, 2 * HX - 1.2, .2, .14);
      M.quad('la_skyline', [[44, -HY - 16, -8], [-44, -HY - 16, -8], [-44, -HY - 16, 26], [44, -HY - 16, 26]]); M.block('concrete', 0, -HY - 3, -.3, 2 * HX + 6, 5.6, .3); for (let x = -HX; x <= HX; x += 1.2) M.rod('metal', [x, -HY - 5.6, 0], [x, -HY - 5.6, 1.2], .03, 4); M.rod('metal', [-HX - 3, -HY - 5.6, 1.2], [HX + 3, -HY - 5.6, 1.2], .05, 5);
      wallArt(M, 'left', 0, .8, 20, 6.4, 'mural_wings', HX, HY, .06);
      // the briefing table, its chairs, the halo over it
      M.block('white', 0, -4, .9, 9.6, 3.2, .12); for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) M.block('metal', a * 4.4, -4 + b * 1.3, 0, .12, .12, .9); M.quad('emblem_saints', [[-1, -5, 1.03], [1, -5, 1.03], [1, -3, 1.03], [-1, -3, 1.03]]);
      for (let k = 0; k < 5; k++) for (const sd of [-1, 1]) slChair(M, -3.6 + k * 1.8, -4 + sd * 2.2, sd > 0 ? -Math.PI / 2 : Math.PI / 2);
      const hz = 6.2; for (let k = 0; k < 48; k++) { const a0 = k / 48 * Math.PI * 2, a1 = (k + 1) / 48 * Math.PI * 2; M.rod('neon_gold', [Math.cos(a0) * 3.4, -4 + Math.sin(a0) * 1.6, hz], [Math.cos(a1) * 3.4, -4 + Math.sin(a1) * 1.6, hz], .12, 5); }
      for (const [x, y] of [[-3.4, -4], [3.4, -4], [0, -2.4], [0, -5.6]]) M.rod('metal', [x, y, hz], [x, y, H], .015, 3);
      // the sofas and their rug, the kitchen counter, plants, the trophy case
      M.quad('runner', [[-14, 3.4, .01], [-6, 3.4, .01], [-6, 9.4, .01], [-14, 9.4, .01]]);
      M.block('paint_purple', -10.4, 8, 0, 8, 1.2, .9); M.block('paint_purple', -10.4, 8.5, .9, 8, .3, .9); M.block('paint_purple', -14, 5.4, 0, 1.2, 4.4, .9); M.block('paint_purple', -14.5, 5.4, .9, .3, 4.4, .9);
      M.block('glass', -10, 5.6, .5, 3, 1.6, .06); for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) M.block('chrome', -10 + a * 1.4, 5.6 + b * .7, 0, .06, .06, .5); M.cyl('hoop_orange', [-10.4, 5.4, .56], .2, .02, 10); M.sphere('hoop_orange', [-9.4, 5.8, .76], .22, 1, 10, 5);
      M.block('concrete_dark', 11.6, 11.6, 0, 8.4, 1.4, 1.05); M.block('white', 11.6, 11.6, 1.05, 8.6, 1.6, .08); M.block('chrome', 15.6, 11.4, 0, 1.4, 1.4, 3.4); M.block('paint_black', 9.2, 11.6, 1.13, .5, .4, .5);
      for (let k = 0; k < 3; k++) chzStool(M, 9 + k * 1.6, 10.4, 0);
      for (const [x, y] of [[-15.6, -11.6], [15.6, -11.6], [-15.8, 11.6]]) { M.cyl('concrete_dark', [x, y, 0], .6, .9, 10, .5); for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; M.sphere('leaf', [x + Math.cos(a) * .4, y + Math.sin(a) * .4, 1.4 + (k % 3) * .3], .45, .6, 8, 4); } }
      M.block('glass', HX - .5, 7.6, 0, .9, 3, 2.2); for (let k = 0; k < 3; k++) atK(M, HX - .5, 6.6 + k, 1, 0, () => lathe(M, 'gold', [[0, 0], [.18, 0], [.06, .1], [.05, .3], [.22, .45], [.26, .7], [.001, .7]], 12));
      for (const [x, y] of [[-6, 0], [6, 0], [-6, 8], [6, 8]]) { M.rod('metal', [x, y, H], [x, y, 6], .015, 3); M.cyl('metal', [x, y, 5.6], .4, .4, 10, .1); M.sphere('window_glow', [x, y, 5.6], .14, 1, 6, 3); }
    },
    // the Saints Arena (games): the maple court with its purple keys and gold lines, the hoops at both ends, the stand climbing
    // behind the far sideline, the courtside chairs, the scoreboard hanging over centre court, spotlights, the Saints banners
    room_sl_arena(M) {
      M.room = true;
      const { HX, HY, H, DW, DH, CX, CY } = QA;
      hall(M, { HX, HY, H, DW, DH, floor: 'concrete_dark', wall: 'concrete', wain: 'paint_purple', wainH: 2.6, rail: 'gold', post: 'metal', postEvery: 8, beam: 'metal', ceil: 'metal', ceilBeam: 'metal', ceilEvery: 5 });
      M.block('paint_purple', 0, 0, 0, 2 * CX + 2, 2 * CY + 2, .015); M.quad('court_maple', [[-CX, -CY, .02], [CX, -CY, .02], [CX, CY, .02], [-CX, CY, .02]]);
      for (const t of qaTiers()) { M.block('concrete', 0, (t.a + t.b) / 2, 0, 30, t.a - t.b, t.y); M.block(t.k % 2 ? 'paint_purple' : 'gold', 0, t.a - .35, t.y, 30, .5, .1); }
      for (const sd of [-1, 1]) {
        const bx = sd * (CX + 1.2); M.block('paint_black', bx, 0, 0, 1.6, 1.4, .9); M.rod('metal', [bx, 0, .9], [bx, 0, 4.6], .14, 8); M.rod('metal', [bx, 0, 4.6], [sd * (CX - .2), 0, 5], .12, 8);
        M.block('backboard', sd * (CX - .3), 0, 4.3, .1, 2.2, 1.3); M.quad('hoop_orange', [[sd * (CX - .36), -.45, 4.55], [sd * (CX - .36), .45, 4.55], [sd * (CX - .36), .45, 5.1], [sd * (CX - .36), -.45, 5.1]]);
        const rx = sd * (CX - .85); M.tube('hoop_orange', [rx, 0, 4.55], [rx, 0, 4.6], .3, .3, 16, false); for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; M.rod('white', [rx + Math.cos(a) * .3, Math.sin(a) * .3, 4.55], [rx + Math.cos(a) * .18, Math.sin(a) * .18, 3.95], .01, 3); }
      }
      // the scoreboard over centre court, spotlights, banners, the courtside chairs and the ball rack
      M.block('metal', 0, 0, 9.8, 4.2, 4.2, 2.4); for (const [a, b] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) { const p = a ? [a * 2.12, 0] : [0, b * 2.12]; M.quad('scoreboard', a ? [[p[0], -1.9 * a, 10], [p[0], 1.9 * a, 10], [p[0], 1.9 * a, 12], [p[0], -1.9 * a, 12]] : [[1.9 * b, p[1], 10], [-1.9 * b, p[1], 10], [-1.9 * b, p[1], 12], [1.9 * b, p[1], 12]]); }
      for (const [x, y] of [[-1.8, -1.8], [1.8, 1.8], [-1.8, 1.8], [1.8, -1.8]]) M.rod('metal', [x, y, 12.2], [x, y, H], .02, 3);
      for (const [x, y] of [[-8, -4], [8, 4], [-8, 4], [8, -4]]) M.quad('shaft_white', [[x - 2.4, y, .05], [x + 2.4, y, .05], [x * .2 + .6, y * .2, H - .2], [x * .2 - .6, y * .2, H - .2]]);
      for (const sd of [-1, 1]) wallArt(M, sd < 0 ? 'left' : 'right', 0, 5.4, 5, 5, 'emblem_saints', HX, HY, .08);
      for (const x of [-12, -6, 0, 6, 12]) { M.quad(x % 12 ? 'paint_purple' : 'gold', [[x + 1.2, -HY + .3, H - 5.2], [x - 1.2, -HY + .3, H - 5.2], [x - 1.2, -HY + .3, H - .4], [x + 1.2, -HY + .3, H - .4]]); M.rod('gold', [x - 1.3, -HY + .32, H - .4], [x + 1.3, -HY + .32, H - .4], .05, 4); }
      for (const x of [-6, 6]) for (let k = 0; k < 4; k++) slChair(M, x - 1.8 + k * 1.2, 9.3, -Math.PI / 2, 'paint_purple');
      M.block('metal', -10, 9.6, 0, 1.6, .8, 1.1); for (let k = 0; k < 6; k++) M.sphere('hoop_orange', [-10.5 + (k % 3) * .5, 9.4 + (k > 2 ? .4 : 0), 1.3], .22, 1, 10, 5);
    },
    // the Saints Custom Shop (the garage's back room): the purple lowrider up on its hydraulic lift, pegboard walls of tools, tyre
    // stacks, the paint booth with a gold hood drying in it, the neon OPEN sign over the bench, chrome rims, oil drums
    room_sl_garage(M) {
      M.room = true;
      const { HX, HY, H, DW, DH } = QG;
      hall(M, { HX, HY, H, DW, DH, floor: 'concrete_dark', wall: 'concrete', wain: 'paint_black', wainH: 1.2, rail: 'neon_pink', post: 'metal', postEvery: 5, beam: 'metal', ceil: 'concrete', ceilBeam: 'metal', ceilEvery: 3.25 });
      for (let x = -12; x <= 12; x += 3) M.quad('chalk', [[x - .05, -HY + .2, .03], [x + .05, -HY + .2, .03], [x + .05, HY - .2, .03], [x - .05, HY - .2, .03]]);
      // the lift and the lowrider on it
      for (const x of [-8.6, .6]) { M.block('blue_lift', x, -2, 0, .5, .5, 4.4); M.block('blue_lift', x, -2, 0, 1, 1.4, .2); for (const sd of [-1, 1]) M.box('blue_lift', [x + (x < 0 ? 1 : -1) * 1, -2 + sd * .7, 1.75], [2, .18, .14], 0, 0, 0); }
      atK(M, -4, -2, 1.85, 0, () => slCar(M, 'paint_purple', true));
      // pegboard and tools on the left wall, the red tool chest
      M.block('dark_panel', -HX + .08, -1, 1, .1, 9, 3.2); let sd0 = 241; const r = () => (sd0 = (sd0 * 16807) % 2147483647) / 2147483647;
      for (let y = -5; y <= 3; y += .5) for (const z of [1.5, 2.5, 3.5]) { const k = r(); if (k < .4) M.box('chrome', [-HX + .18, y, z], [.03, .08, .6], 0, (r() - .5) * .4); else if (k < .7) { M.box('chrome', [-HX + .18, y, z + .1], [.03, .06, .45]); M.box('paint_red', [-HX + .18, y, z - .18], [.05, .12, .3]); } else if (k < .85) { M.rod('darkwood', [-HX + .2, y, z - .3], [-HX + .2, y, z + .2], .03, 4); M.box('chrome', [-HX + .2, y, z + .24], [.06, .3, .1]); } }
      M.block('paint_red', -HX + .6, -5.4, 0, 1, 1.4, 1.8); for (let k = 0; k < 6; k++) M.block('chrome', -HX + 1.11, -5.4, .2 + k * .27, .02, 1.2, .03);
      // tyre stacks, the paint booth, the neon OPEN sign over the bench, chrome rims, oil drums
      for (const [x, y, n] of [[-10.6, 6.6, 5], [-11.6, 5, 4], [-9.4, 4.6, 3]]) for (let k = 0; k < n; k++) { M.tube('tire', [x, y, k * .42], [x, y, k * .42 + .38], .6, .6, 14, false); M.tube('tire', [x, y, k * .42], [x, y, k * .42 + .38], .32, .32, 14, false); M.quad('tire', [[x - .6, y, k * .42 + .38], [x + .6, y, k * .42 + .38], [x + .6, y + .01, k * .42 + .38], [x - .6, y + .01, k * .42 + .38]]); }
      const bx0 = 4.8, by1 = -3.4; for (const [x, y] of [[bx0, by1], [HX - .2, by1], [bx0, -HY + .2]]) M.block('metal', x, y, 0, .12, .12, 4.4); M.block('metal', (bx0 + HX) / 2, by1, 4.4, HX - bx0, .12, .12); M.block('metal', bx0, (by1 - HY) / 2, 4.4, .12, HY + by1, .12);
      M.quad('glass_frost', [[bx0, by1, 0], [HX - .2, by1, 0], [HX - .2, by1, 4.4], [bx0, by1, 4.4]]); M.quad('glass_frost', [[bx0, -HY + .2, 0], [bx0, by1, 0], [bx0, by1, 4.4], [bx0, -HY + .2, 4.4]]);
      M.block('metal', 8.8, -6.6, 0, 1.6, .8, 1.1); M.box('paint_gold', [8.8, -6.6, 1.5], [2.4, .12, 1.6], 0, .5); M.rod('chrome', [10.4, -5.6, 1.4], [10.8, -5.4, 1.6], .05, 5); M.block('window_glow', 8.8, -HY + .3, 3.4, 3, .1, .6);
      M.block('darkwood', -2, -9.3, 0, 8, 1.2, 1.05); M.block('metal', -2, -9.3, 1.05, 8.2, 1.4, .08); M.quad('neon_open', [[-.5, -HY + .12, 3.6], [-3.5, -HY + .12, 3.6], [-3.5, -HY + .12, 4.8], [-.5, -HY + .12, 4.8]]);
      for (const [y, z] of [[1, 2.8], [3, 2.8], [5, 2.8], [2, 4.4], [4, 4.4]]) { M.rod('chrome', [HX - .2, y, z], [HX - .3, y, z], .5, 16); M.rod('dark', [HX - .32, y, z], [HX - .34, y, z], .3, 12); for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; M.rod('chrome', [HX - .33, y, z], [HX - .33, y + Math.cos(a) * .45, z + Math.sin(a) * .45], .03, 3); } }
      for (const [x, y, m] of [[11, 7.6, 'paint_blue'], [11.8, 6.2, 'paint_red']]) { M.cyl(m, [x, y, 0], .5, 1.3, 12); for (const z of [.3, 1]) M.cyl('metal', [x, y, z], .51, .05, 12); }
      wallArt(M, 'front', -8, 1.6, 6, 3.6, 'mural_wings', HX, HY, .08);
    },
    // the Saints Library rotunda (lore): the deco dome painted with gold rays and stars, the round reading room under it, the
    // librarian's round desk in the middle, reading tables with green banker's lamps, bookcases round the walls, LA murals in two
    // bays, the card catalogue by the door
    room_sl_library(M) {
      M.room = true;
      const { R, WH, DOME, DW, DH, NS } = QL, da = 2 * Math.PI / NS, a0 = Math.PI / 2 - da, P = (t, r, z) => [Math.cos(t) * r, Math.sin(t) * r, z];
      M.block('darkwood', 0, 0, -.3, 2 * R + 2, 2 * R + 4, .3);
      const ring = (r0, r1, mat, z = .012) => { for (let k = 0; k < NS; k++) { const a = k * da, b = a + da; M.quad(mat, [P(a, r0, z), P(b, r0, z), P(b, r1, z), P(a, r1, z)]); } };
      ring(0, 3.4, 'navy', .006); ring(3.4, 3.6, 'gold'); ring(3.6, 9.4, 'deco', .008); ring(9.4, 9.6, 'gold'); ring(9.6, R, 'navy', .006);
      for (let k = 0; k < 8; k++) { const t = k * Math.PI / 4, n = [-Math.sin(t) * .3, Math.cos(t) * .3]; M.poly('gold', [[Math.cos(t) * 3.6 + n[0], Math.sin(t) * 3.6 + n[1], .014], [Math.cos(t) * 9.4, Math.sin(t) * 9.4, .014], [Math.cos(t) * 3.6 - n[0], Math.sin(t) * 3.6 - n[1], .014]]); }
      // the wall and its doorway (segments 0 and 1), pilasters, the gold band, bookcases and murals in the bays
      for (let k = 0; k < NS; k++) { const a = a0 + k * da, b = a + da, door = k < 2, zb = door ? DH : 0; M.quad('deco', [P(a, R, zb), P(b, R, zb), P(b, R, WH), P(a, R, WH)], [[0, zb / 3], [1, zb / 3], [1, WH / 3], [0, WH / 3]]); M.quad('gold', [P(a, R - .14, WH - .4), P(b, R - .14, WH - .4), P(b, R - .14, WH - .26), P(a, R - .14, WH - .26)]); }
      const dl = P(a0 + 2 * da, R, 0), dr = P(a0, R, 0);
      for (const p of [dl, dr]) { M.block('deco_trim', p[0], p[1] + .4, 0, .3, 1, DH); M.quad('deco', [[p[0], p[1], 0], [p[0], R + .55, 0], [p[0], R + .55, DH], [p[0], p[1], DH]]); }
      M.block('deco_trim', 0, dr[1] + .4, DH, DW + .6, 1, .4); M.quad('deco', [[dl[0], dl[1], DH], [dr[0], dr[1], DH], [dr[0], R + .55, DH], [dl[0], R + .55, DH]]); M.quad('doorview', [[-DW / 2, R + .5, 0], [DW / 2, R + .5, 0], [DW / 2, R + .5, DH], [-DW / 2, R + .5, DH]]);
      for (let k = 0; k < 12; k++) { const t = k * Math.PI / 6 + Math.PI / 12; M.box('deco_trim', P(t, R - .25, WH / 2), [.5, .6, WH], t); M.cyl('gold', P(t, R - .3, WH - 1), .32, .3, 8); }
      for (let bay = 0; bay < 12; bay++) {
        const t0 = bay * Math.PI / 6 + Math.PI / 12 + .05, t1 = t0 + Math.PI / 6 - .1, mid = (t0 + t1) / 2; if (Math.abs(Math.sin(mid) - 1) < .1) continue; // the door's bay
        const mural = Math.abs(Math.cos(mid)) > .97, segs = 4;
        for (let q = 0; q < segs; q++) { const a = t0 + (t1 - t0) * q / segs, b = t0 + (t1 - t0) * (q + 1) / segs;
          if (mural) M.quad('mural_la', [P(a, R - .2, 1.4), P(b, R - .2, 1.4), P(b, R - .2, 5.4), P(a, R - .2, 5.4)], [[q / segs, 0], [(q + 1) / segs, 0], [(q + 1) / segs, 1], [q / segs, 1]]);
          else { M.quad('books', [P(a, R - .62, .3), P(b, R - .62, .3), P(b, R - .62, 5.6), P(a, R - .62, 5.6)], [[q, 0], [q + 1, 0], [q + 1, 3], [q, 3]]); for (const z of [.3, 1.6, 2.9, 4.2, 5.5]) M.quad('darkwood', [P(a, R - .7, z), P(b, R - .7, z), P(b, R - .1, z), P(a, R - .1, z)]); M.quad('darkwood', [P(a, R - .1, 5.6), P(b, R - .1, 5.6), P(b, R - .7, 5.75), P(a, R - .7, 5.75)]); }
        }
      }
      // the dome
      const Ri = 10, G = [], U = []; for (let i = 0; i <= Ri; i++) { const e = i / Ri * Math.PI / 2, rho = R * Math.cos(e), z = WH + DOME * Math.sin(e), row = [], urow = []; for (let j = 0; j <= NS; j++) { row.push(P(j * da, rho, z)); urow.push([j / NS * 4, i / Ri]); } G.push(row); U.push(urow); }
      M.grid('deco_dome', G, U); M.cyl('gold', [0, 0, WH + DOME - .3], 1.6, .14, 24); M.quad('emblem_saints', [[-1.2, -1.2, WH + DOME - .32], [1.2, -1.2, WH + DOME - .32], [1.2, 1.2, WH + DOME - .32], [-1.2, 1.2, WH + DOME - .32]]);
      // the round desk, the globe, the reading tables with their lamps and chairs, the card catalogue
      M.tube('darkwood', [0, 0, 0], [0, 0, 1.1], 2.5, 2.5, 32, false); M.tube('darkwood', [0, 0, 0], [0, 0, 1.1], 1.9, 1.9, 32, false); for (let k = 0; k < 32; k++) { const a = k / 32 * Math.PI * 2, b = (k + 1) / 32 * Math.PI * 2; M.quad('gold', [P(a, 1.9, 1.1), P(b, 1.9, 1.1), P(b, 2.6, 1.12), P(a, 2.6, 1.12)]); }
      M.cyl('brass', [0, 0, 0], .2, 1.4, 8); M.sphere('paint_blue', [0, 0, 1.9], .5, 1, 14, 7); M.tube('brass', [0, -.03, 1.9], [0, .03, 1.9], .56, .56, 20, false);
      for (let k = 0; k < 6; k++) {
        const a = k * Math.PI / 3, c = Math.cos(a), s = Math.sin(a), x = c * 6.8, y = s * 6.8; // none on the door's axis (90 deg)
        M.box('darkwood', [x, y, .88], [1.3, 2.6, .1], a); for (const [f, l] of [[-.5, -1.1], [.5, -1.1], [.5, 1.1], [-.5, 1.1]]) M.box('darkwood', [x + f * c - l * s, y + f * s + l * c, .42], [.1, .1, .84], a);
        M.cyl('brass', [x, y, .93], .1, .5, 6); M.box('glass_green', [x, y, 1.48], [.3, .9, .2], a); for (const sd of [-1, 1]) slChair(M, x + sd * 1.3 * c, y + sd * 1.3 * s, a + (sd > 0 ? Math.PI : 0), 'paint_black');
      }
      for (const s of [-1, 1]) { M.block('darkwood', s * 7.2, 8.5, 0, 2.4, 1.8, 1.6); M.quad('drawers', [[s * 7.2 - 1.2, 7.59, .1], [s * 7.2 + 1.2, 7.59, .1], [s * 7.2 + 1.2, 7.59, 1.5], [s * 7.2 - 1.2, 7.59, 1.5]]); M.block('white', s * 7.2, 8.5, 1.6, 2.5, 1.9, .06); }
    },
    // the Saints Game Hall (games: the Block Party): four bowling lanes on the left with pins standing and screens over them, pool
    // tables, the DJ booth with its turntables and speaker stacks under the neon BLOCK PARTY sign, the disco ball turning
    room_sl_game(M) {
      M.room = true;
      const { HX, HY, H, DW, DH, LN, LY } = QB;
      hall(M, { HX, HY, H, DW, DH, floor: 'arcade_floor', wall: 'dark_panel', wain: 'neon_cyan', wainH: .1, rail: 'neon_pink', post: 'metal', postEvery: 6, beam: 'metal', ceil: 'dark_panel', ceilBeam: 'metal', ceilEvery: 3 });
      // the lanes, gutters and dividers, the pins, the backstop and the screens, the ball returns, benches
      const lw = (LN[1] - LN[0]) / 4;
      for (let i = 0; i < 4; i++) {
        const x = LN[0] + lw * (i + .5); M.block('wood', x, (LY[0] + LY[1]) / 2, 0, lw - .6, LY[1] - LY[0], .05); for (const sd of [-1, 1]) M.block('dark', x + sd * (lw / 2 - .15), (LY[0] + LY[1]) / 2, 0, .3, LY[1] - LY[0], .02);
        for (const [a, b] of [[0, 0], [-1, 1], [1, 1], [-2, 2], [0, 2], [2, 2], [-3, 3], [-1, 3], [1, 3], [3, 3]]) slPin(M, x + a * .2, LY[0] + 1.6 - b * .34);
        M.quad('scoreboard', [[x - .9, LY[0] - .1, 4.2], [x + .9, LY[0] - .1, 4.2], [x + .9, LY[0] - .1, 5.1], [x - .9, LY[0] - .1, 5.1]]);
        for (let q = 0; q < 6; q++) M.block('window_glow', x - .9 + q * .36, LY[1] - .2, .06, .2, .1, .02);
      }
      for (let i = 0; i <= 4; i++) M.block('metal', LN[0] + lw * i, (LY[0] + LY[1]) / 2, 0, .1, LY[1] - LY[0], .3);
      M.block('dark', (LN[0] + LN[1]) / 2, LY[0] - .3, 0, LN[1] - LN[0], .6, 2.4); M.block('neon_cyan', (LN[0] + LN[1]) / 2, LY[0] - .02, 2.4, LN[1] - LN[0], .06, .12);
      for (const x of [LN[0] + 1.3, LN[0] + 4, LN[0] + 6.6, LN[0] + 9.2]) { M.block('metal', x, LY[1] + 1, 0, .9, .9, .7); M.sphere('metal', [x, LY[1] + 1, .7], .45, .6, 10, 4); for (const [dx, m] of [[-.2, 'paint_blue'], [.2, 'paint_red']]) M.sphere(m, [x + dx, LY[1] + 1.3, .9], .22, 1, 10, 5); }
      for (const x of [-12, -7]) { M.block('paint_red', x, 8, 0, 4, 1, .5); M.block('paint_red', x, 8.45, .5, 4, .2, .8); }
      // pool tables, the cue rack, the DJ booth, the speakers, the sign
      for (const [y, m] of [[-4, 'felt_blue'], [3, 'felt_green']]) { M.block('darkwood', 7, y, 0, 3.6, 2, .9); M.block(m, 7, y, .9, 3.2, 1.6, .05); for (const sx of [-1, 0, 1]) for (const sy of [-1, 1]) M.cyl('dark', [7 + sx * 1.6, y + sy * .8, .92], .1, .04, 8); for (let k = 0; k < 6; k++) M.sphere(['paint_red', 'paint_gold', 'paint_blue', 'white', 'paint_black', 'paint_purple'][k], [6.4 + (k % 3) * .3, y - .2 + (k > 2 ? .3 : 0), 1.05], .1, 1, 8, 4); }
      M.block('darkwood', HX - .15, 0, 1, .2, 3, .1); for (let k = 0; k < 7; k++) M.rod('darkwood', [HX - .25, -1.2 + k * .4, .3], [HX - .25, -1.2 + k * .4, 2.6], .025, 4);
      M.block('dark_panel', 10.4, -9.6, 0, 6.4, 1.6, 1.1); M.block('neon_cyan', 10.4, -8.79, .9, 6.4, .02, .08); M.block('metal', 10.4, -9.6, 1.1, 6.6, 1.8, .06); for (const s of [-1, 1]) M.cyl('metal', [10.4 + s * .8, -9.6, 1.16], .36, .08, 16); M.block('paint_black', 10.4, -9.6, 1.16, .5, .6, .14);
      for (const x of [7.6, 13.2]) { M.block('paint_black', x, -10.6, 0, 1.4, 1.2, 3.4); for (const z of [.9, 2.4]) { M.rod('records', [x, -9.99, z], [x, -9.95, z], .45, 16); M.rod('metal', [x, -9.96, z], [x, -9.9, z], .14, 10); } }
      M.quad('neon_block', [[13.8, -HY + .1, 4.2], [7, -HY + .1, 4.2], [7, -HY + .1, 5.9], [13.8, -HY + .1, 5.9]]);
      for (const [a, b] of [[-HX + .1, HY - .1], [HX - .1, HY - .1]]) M.block('neon_pink', a, 0, 3, .06, 2 * HY - 1, .1);
    },
    // the disco ball and a record on a turntable (parts)
    room_sl_discoball(M) { M.room = true; M.rod('metal', [0, 0, 0], [0, 0, -.5], .02, 3); M.sphere('chrome', [0, 0, -1.1], .6, 1, 16, 8); for (let k = 0; k < 40; k++) { const a = k * 2.4, e = Math.asin(((k * 37) % 40) / 20 - 1); M.box('glass', [Math.cos(a) * .6 * Math.cos(e), Math.sin(a) * .6 * Math.cos(e), -1.1 + .6 * Math.sin(e)], [.1, .1, .1], a); } },
    room_sl_record(M) { M.room = true; M.cyl('records', [0, 0, 0], .32, .02, 20); M.cyl('paint_red', [0, 0, .021], .1, .005, 12); M.cyl('metal', [0, 0, 0], .015, .05, 6); }
  });
  // a koi swimming a circle of radius d round its pivot (body, tail, fins); facing along +x at (0, d)
  function koiK(M, d, mat) {
    M.sphere(mat, [0, d, -.06], .26, .55, 10, 5); M.box(mat, [0, d, -.06], [.9, .34, .18]); M.sphere(mat, [.38, d, -.06], .18, .6, 8, 4);
    M.poly(mat, [[-.45, d, -.06], [-.85, d + .25, -.06], [-.85, d - .25, -.06]]); for (const t of [-1, 1]) M.poly('koi_white', [[.1, d + t * .15, -.07], [-.1, d + t * .42, -.07], [-.2, d + t * .17, -.07]]);
    M.sphere('lacquer_red', [.05, d + .1, .03], .12, .4, 6, 3);
  }
  // the Samurai great dojo's stone base (walk round the hall, up to its door) and its front steps; the layout's collision box covers only the walls
  const samDojoDeck = [{ x: 0, z: 0, halfX: 12, halfZ: 8.5, y: 1.35 }, { x: 0, z: -9.4, halfX: 4, halfZ: .9, y0: 0, y1: 1.2, steps: 4, surface: 'stone' }];
  const decks = { sam_great_dojo: samDojoDeck, wok_pier: [{ x: 0, z: 0, halfX: 2.05, halfZ: 4.5, y: 0 }], // a little past each end: steps on from the quay
    wok_boat: [{ x: 0, z: 0, halfX: 1.7, halfZ: 3, y: 1.05 }], wok_gangplank: [{ x: 0, z: 0, halfX: .55, halfZ: 2.5, y0: 0, y1: -2 }],
    kit_stairs_stone: stairs(3, 6.4, 4, 10, 'stone'), kit_stairs_wood: stairs(2.6, 6.4, 4, 12, 'wood'),
    kit_stairs_cliff: [{ x: 0, z: -10.6 + 4.8, halfX: 1.45, halfZ: 4.8, y0: 0, y1: 6, steps: 15, surface: 'stone' }, { x: 0, z: 0, halfX: 1.45, halfZ: 1.05, y: 6, surface: 'stone' },
      { x: 0, z: 1 + 4.8, halfX: 1.45, halfZ: 4.8, y0: 6, y1: 12, steps: 15, surface: 'stone' }, { x: 0, z: 10.6 + .6, halfX: 1.45, halfZ: .75, y: 12, surface: 'stone' }], yam_bridge: [{ x: 0, z: 0, halfX: 1.45, halfZ: 16.2, y: 0 }], buke_footbridge: [{ x: 0, z: 0, halfX: 1.2, halfZ: 4.1, y: 0 }], ashi_bridge: [{ x: 0, z: 0, halfX: 1.55, halfZ: 10.3, y0: 0, y1: 2.4 }],
    war_great_dojo: [{ x: 0, z: (-12.4 + 10.5) / 2, halfX: 14.7, halfZ: (10.5 + 12.4) / 2, y: 1.5 }, { x: 0, z: -12.4 - .9, halfX: 3.9, halfZ: .9, y0: 0, y1: 1.4, steps: 4, surface: 'stone' }],
    shogun_great_dojo: [{ x: 0, z: (-12.4 + 10.5) / 2, halfX: 14.7, halfZ: (10.5 + 12.4) / 2, y: 1.5 }, { x: 0, z: -12.4 - .9, halfX: 3.9, halfZ: .9, y0: 0, y1: 1.4, steps: 4, surface: 'stone' }],
    chz_bar: [{ x: 0, z: -1.6, halfX: 13, halfZ: 8.6, y: .7 }, { x: 0, z: -7 - 3.2 - .45, halfX: 4, halfZ: .45, y0: 0, y1: .7, steps: 2, surface: 'wood' }],
    chz_bait_shop: [{ x: 0, z: -1, halfX: 6.5, halfZ: 5, y: .5 }], chz_dice_hall: [{ x: 0, z: -1, halfX: 6.5, halfZ: 5, y: .5 }],
    chz_dock: [{ x: 0, z: 0, halfX: 4.05, halfZ: 3.05, y: 0 }], chz_pier: [{ x: 0, z: 0, halfX: 1.55, halfZ: 5.05, y: 0 }],
    shogun_bridge: [{ x: 0, z: -2.75, halfX: 1.05, halfZ: 2.75, y0: 0, y1: 1.3 }, { x: 0, z: 2.75, halfX: 1.05, halfZ: 2.75, y0: 1.3, y1: 0 }],
    ronin_great_dojo: [{ x: 0, z: 0, halfX: 15, halfZ: 12, y: 1.6 }, { x: 0, z: -13.13, halfX: 4.4, halfZ: 1.13, y0: 0, y1: 1.6, steps: 5, surface: 'stone' }],
    // the Bushi dojo's stone base, its veranda boards and three front steps; the Ashigaru dojo's floor and four steps
    bushi_great_dojo: [{ x: 0, z: 0, halfX: 14, halfZ: 9, y: 1 }, { x: 0, z: -8.2, halfX: 13.7, halfZ: .9, y: 1.14 }, { x: 0, z: -9.675, halfX: 5, halfZ: .675, y0: 0, y1: 1, steps: 3, surface: 'stone' }],
    ashi_great_dojo: [{ x: 0, z: 0, halfX: 12.8, halfZ: 8.3, y: 1.52 }, { x: 0, z: -9.2, halfX: 4, halfZ: .9, y0: 0, y1: 1.4, steps: 4, surface: 'stone' }] };
  // the dojos built on the Samurai dojo share its base and steps
  for (const t of ['wok_great_dojo', 'yam_great_dojo', 'kenshi_great_dojo', 'sohei_great_dojo', 'buke_great_hall']) decks[t] = samDojoDeck;
  window.SamuraiKit = { build, setLightFactor, animate, actorAction, protoMeshes, decks, rooms: ROOMS, stairsSteps, refreshStairs, types: Object.keys(B), _Kit: Kit, _B: B, _org: { blob, curveTube } };
})();
