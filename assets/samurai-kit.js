// Samurai building kit (Oct 2026). Designed in Blender (work/sam/models.py); this file builds the same low-poly
// shapes in the browser, so no model files are downloaded. Each building type is built once into a hidden template
// (one mesh per material) and every placed copy is a set of instances of it: cheap to draw, cheap to place.
// Doorways are lit recesses; link a room by adding a Door (admin > Doors) in front of one.
/* global BABYLON */
(function () {
  const TILE = { roof: [1.6, 1.4], roof_brown: [1.6, 1.4], plaster_old: [3, 3], slate: [2.4, 2.4], wood: [1.6, 1.6], darkwood: [1.6, 1.6], plaster: [3, 3], stone: [2.4, 2.4], thatch: [2, 1.6], bark: [1.4, 1.6], earth: [4, 4], shoji: [1.2, 1.5] };
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
    const tt = noise(S, 2, 3, 41); // tatami: woven rush, a black cloth border
    T.tatami = pixelTex(scene, 'tatami', S, (x, y, i) => { const e = Math.min(x, 1 - x, y, 1 - y); if (e < .025) return [26, 24, 20]; const f = (.84 + .1 * Math.sin(y * S * 2.2) + .08 * tt[i]); return [184 * f, 168 * f, 104 * f]; });
    const mp = noise(S, 4, 4, 42); // the campaign map on the dojo's table: land, hills, a river
    T.war_map = pixelTex(scene, 'war_map', S, (x, y, i) => { const e = Math.min(x, 1 - x, y, 1 - y); if (e < .03) return [92, 64, 36]; const v = mp[i]; if (Math.abs(y - .5 - .18 * Math.sin(x * 7)) < .015) return [70, 110, 120]; return v > .62 ? [96, 112, 70] : v > .45 ? [150, 150, 96] : [196, 178, 128]; });
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
    } else if (icon === 'spider') { // the Cute & Creepy spider, hanging on its thread
      c.lineWidth = 4; c.beginPath(); c.moveTo(W / 2, 30); c.lineTo(W / 2, H / 2 - 60); c.stroke();
      c.beginPath(); c.ellipse(W / 2, H / 2 - 30, 26, 30, 0, 0, 7); c.fill(); c.beginPath(); c.ellipse(W / 2, H / 2 + 35, 40, 52, 0, 0, 7); c.fill();
      c.lineWidth = 8; for (const sd of [-1, 1]) for (let k = 0; k < 4; k++) { const y0 = H / 2 - 40 + k * 16; c.beginPath(); c.moveTo(W / 2 + sd * 20, y0); c.lineTo(W / 2 + sd * (70 + 8 * k), y0 - 40 + k * 22); c.lineTo(W / 2 + sd * (95 + 6 * k), y0 + 10 + k * 34); c.stroke(); }
    } else if (icon === 'book') {
      c.lineWidth = 8; c.beginPath(); c.moveTo(W / 2, 330); c.quadraticCurveTo(W / 2 - 50, 300, W / 2 - 100, 320); c.lineTo(W / 2 - 100, 200); c.quadraticCurveTo(W / 2 - 50, 180, W / 2, 210); c.quadraticCurveTo(W / 2 + 50, 180, W / 2 + 100, 200); c.lineTo(W / 2 + 100, 320); c.quadraticCurveTo(W / 2 + 50, 300, W / 2, 330); c.closePath(); c.stroke(); c.beginPath(); c.moveTo(W / 2, 210); c.lineTo(W / 2, 330); c.stroke();
      for (let i = 0; i < 4; i++) for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(W / 2 + sd * 20, 235 + i * 20); c.lineTo(W / 2 + sd * 80, 230 + i * 20); c.stroke(); }
    } else if (icon === 'dice') {
      for (const [cx, cy, rot, n] of [[W / 2 - 50, H / 2 + 20, -.2, 5], [W / 2 + 55, H / 2 - 10, .25, 3]]) { c.save(); c.translate(cx, cy); c.rotate(rot); c.fillRect(-42, -42, 84, 84); c.fillStyle = '#3a2616'; for (const [px, py] of n === 5 ? [[-22, -22], [22, -22], [0, 0], [-22, 22], [22, 22]] : [[-22, -22], [0, 0], [22, 22]]) { c.beginPath(); c.arc(px, py, 9, 0, 7); c.fill(); } c.restore(); c.fillStyle = fg; }
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
    sack: { col: [.7, .62, .46] }, leaf: { col: [.26, .42, .14] }, leaves: { tex: 'leaves' },
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
    if (d.tex) { m.diffuseTexture = TEX[d.tex]; if (d.tint) m.diffuseColor = new BABYLON.Color3(...d.tint); } else m.diffuseColor = new BABYLON.Color3(...d.col);
    if (d.alpha) { m.alpha = d.alpha; m.disableDepthWrite = true; } // ghosts
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
    part(m) { m = (this.remap && this.remap[m]) || m; m = (this.remap2 && this.remap2[m]) || m; return this.parts[m] || (this.parts[m] = { p: [], n: [], uv: [], i: [] }); }
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
      n = NG ? NG[i][j] : norm(n); const q = G[i][j];
      P.p.push(q[0], q[2], q[1]); P.n.push(n[0], n[2], n[1]); P.uv.push(U[i][j][0], U[i][j][1]);
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
    const hw = w / 2 + o, hd = d / 2 + o, sl = Math.hypot(hd, h + o * h / (d / 2)), zE = z - o * h / (d / 2);
    if (front) { // ridge along y (a porch gable facing -y)
      const ww = w / 2 + o, L = d + o;
      for (const sd of [-1, 1]) M.quad(m, [[cx + sd * ww, cy - d / 2 - o, zE], [cx, cy - d / 2 - o, z + h], [cx, cy + d / 2, z + h], [cx + sd * ww, cy + d / 2, zE]], [[0, 0], [0, sl / 2], [L / 2, sl / 2], [L / 2, 0]]);
      M.poly(gableMat, [[cx - w / 2, cy - d / 2, z], [cx + w / 2, cy - d / 2, z], [cx, cy - d / 2, z + h - .1]]);
      M.box('darkwood', [cx, cy - o / 2, z + h], [.3, d + o, .3]); return;
    }
    for (const sd of [-1, 1]) M.quad(m, [[cx - hw, cy + sd * hd, zE], [cx + hw, cy + sd * hd, zE], [cx + hw, cy, z + h], [cx - hw, cy, z + h]], [[0, 0], [w / 2, 0], [w / 2, sl / 2], [0, sl / 2]]);
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
  function warPalisade(M, withBanner) {
    const L = 8, n = 14;
    M.block('stone', 0, 0, 0, L, .9, .45);
    for (let i = 0; i < n; i++) { const x = -L / 2 + .29 + i * (L - .58) / (n - 1), h = 4.6 + .35 * Math.sin(i * 2.7) + .2 * Math.cos(i * 1.3); M.cyl('bark', [x, 0, -.3], .28, h + .3, 7); M.cyl('bark', [x, 0, h], .28, .85, 7, .02); for (const z of [1.2, h - .7]) M.cyl('iron', [x, 0, z], .3, .16, 7); }
    for (const z of [1.5, 3.6]) M.box('darkwood', [0, .34, z], [L, .14, .24]);
    for (const x of [-2.6, 2.6]) M.rod('wood', [x, .36, 3.4], [x, 2.6, -.2], .12, 6);
    if (withBanner) { M.cyl('darkwood', [0, .55, 0], .1, 7.8, 8); M.box('darkwood', [0, .5, 7.5], [1.8, .1, .1]); M.quad('banner_warrior', [[-.8, .46, 4.9], [.8, .46, 4.9], [.8, .46, 7.45], [-.8, .46, 7.45]]); M.quad('banner_warrior', [[.8, .44, 4.9], [-.8, .44, 4.9], [-.8, .44, 7.45], [.8, .44, 7.45]], [[1, 0], [0, 0], [0, 1], [1, 1]]); M.cyl('gold', [0, .55, 7.8], .1, .3, 6, .02); }
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
  // floating pieces (ghosts): their instances bob and sway under the placed root, so saved positions never move
  const FLOAT = new Set(['cc_ghost']), floaters = [];
  // characters: the body rocks (kokeshi) or breathes (cats); subparts under their own pivots wave, flicker, pulse
  const CHAR = { cc_flower_moon: 'rock', cc_nariko: 'rock', cc_ostara: 'rock', cc_mamoru: 'bob', cc_mochi: 'bob' };
  const SUBPARTS = { cc_mamoru: [['cc_paw_black', [.36, -.25, .92], 'wave'], ['cc_candle_flame', [0, 0, 2.17], 'flicker']], cc_mochi: [['cc_paw_white', [.36, -.25, .92], 'wave']], cc_nariko: [['cc_orb', [0, -.56, .74], 'pulse']] };
  const actors = [];
  function animateActors(t) {
    for (let i = actors.length - 1; i >= 0; i--) {
      const a = actors[i]; if (a.body.isDisposed?.()) { actors.splice(i, 1); continue; }
      if (a.kind === 'rock') { a.body.rotation.z = .07 * Math.sin(t * 1.5 + a.ph); a.body.rotation.x = .035 * Math.sin(t * 1.1 + a.ph * 2); }
      else { const b = Math.sin(t * 1.8 + a.ph); a.body.scaling.set(1 + .015 * b, 1 - .012 * b, 1 + .015 * b); }
      for (const s of a.subs) {
        if (s.kind === 'wave') s.node.rotation.x = .25 - .55 * Math.max(0, Math.sin(t * 3 + a.ph));
        else if (s.kind === 'flicker') { const f = 1 + .22 * Math.sin(t * 13 + a.ph) + .12 * Math.sin(t * 31); s.node.scaling.set(1 - .1 * (f - 1), f, 1 - .1 * (f - 1)); }
        else { const p = 1 + .1 * Math.sin(t * 5 + a.ph) + .05 * Math.sin(t * 17); s.node.scaling.setAll(p); s.node.rotation.y = t * 1.3; }
      }
    }
  }
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
  const decks = { wok_pier: [{ x: 0, z: 0, halfX: 2.05, halfZ: 4.5, y: 0 }], // a little past each end: steps on from the quay
    wok_boat: [{ x: 0, z: 0, halfX: 1.7, halfZ: 3, y: 1.05 }], wok_gangplank: [{ x: 0, z: 0, halfX: .55, halfZ: 2.5, y0: 0, y1: -2 }],
    kit_stairs_stone: stairs(3, 6.4, 4, 10, 'stone'), kit_stairs_wood: stairs(2.6, 6.4, 4, 12, 'wood'),
    kit_stairs_cliff: [{ x: 0, z: -10.6 + 4.8, halfX: 1.45, halfZ: 4.8, y0: 0, y1: 6, steps: 15, surface: 'stone' }, { x: 0, z: 0, halfX: 1.45, halfZ: 1.05, y: 6, surface: 'stone' },
      { x: 0, z: 1 + 4.8, halfX: 1.45, halfZ: 4.8, y0: 6, y1: 12, steps: 15, surface: 'stone' }, { x: 0, z: 10.6 + .6, halfX: 1.45, halfZ: .75, y: 12, surface: 'stone' }], yam_bridge: [{ x: 0, z: 0, halfX: 1.45, halfZ: 16.2, y: 0 }], buke_footbridge: [{ x: 0, z: 0, halfX: 1.2, halfZ: 4.1, y: 0 }], ashi_bridge: [{ x: 0, z: 0, halfX: 1.55, halfZ: 10.3, y0: 0, y1: 2.4 }],
    war_great_dojo: [{ x: 0, z: (-12.4 + 10.5) / 2, halfX: 14.7, halfZ: (10.5 + 12.4) / 2, y: 1.5 }, { x: 0, z: -12.4 - .9, halfX: 3.9, halfZ: .9, y0: 0, y1: 1.4, steps: 4, surface: 'stone' }],
    shogun_great_dojo: [{ x: 0, z: (-12.4 + 10.5) / 2, halfX: 14.7, halfZ: (10.5 + 12.4) / 2, y: 1.5 }, { x: 0, z: -12.4 - .9, halfX: 3.9, halfZ: .9, y0: 0, y1: 1.4, steps: 4, surface: 'stone' }],
    shogun_bridge: [{ x: 0, z: -2.75, halfX: 1.05, halfZ: 2.75, y0: 0, y1: 1.3 }, { x: 0, z: 2.75, halfX: 1.05, halfZ: 2.75, y0: 1.3, y1: 0 }],
    ronin_great_dojo: [{ x: 0, z: 0, halfX: 15, halfZ: 12, y: 1.6 }, { x: 0, z: -13.13, halfX: 4.4, halfZ: 1.13, y0: 0, y1: 1.6, steps: 5, surface: 'stone' }] };
  window.SamuraiKit = { build, setLightFactor, animate, decks, stairsSteps, refreshStairs, types: Object.keys(B), _Kit: Kit, _B: B, _org: { blob, curveTube } };
})();
