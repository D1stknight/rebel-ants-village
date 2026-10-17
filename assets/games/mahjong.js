// The Tile Garden (Oct 15, Samurai): tile solitaire on the garden table. Take the tiles off in matching pairs; a tile
// can be taken when nothing lies on it and its left or right side is open. Five gardens from the 42-tile Garden Path to
// the 148-tile Shogun's Castle (four layers). Every deal is made by taking free pairs off the full layout, so it can
// always be cleared, but a careless pair can still bury the tiles you need. H shows a pair (no clean bonus), S shuffles
// what is left into a deal that can still be cleared (two per garden), U takes the last pair back. Blocked tiles are
// shaded. Score: the garden x 20, +10 with no hint or shuffle; a garden left unfinished scores its pairs.
// def: { pass, points }
// Oct 17 (Miguel: the puzzles need a how-to, every board a Restart): howTo (the rules in a few lines) and inst.restart
// (the same deal back on the table, its two shuffles too, the clock from 0; hints still count: they cost the bonus).
(function () {
  const rect = (out, l, x0, y0, cols, rows) => { for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push([l, x0 + c * 2, y0 + r * 2]); return out; };
  const GARDENS = [
    { name: 'The Garden Path', make: () => { const o = []; rect(o, 0, 0, 0, 8, 4); rect(o, 1, 4, 2, 4, 2); rect(o, 2, 6, 3, 2, 1); return o; } },
    { name: 'The Moon Bridge', make: () => { const o = []; rect(o, 0, 0, 2, 10, 4); rect(o, 0, 4, 0, 6, 1); rect(o, 0, 4, 10, 6, 1); rect(o, 1, 2, 3, 8, 3); rect(o, 2, 6, 5, 4, 1); return o; } },
    { name: 'The Torii Gate', make: () => { const o = []; rect(o, 0, 0, 0, 2, 7); rect(o, 0, 18, 0, 2, 7); rect(o, 0, 4, 0, 7, 2); rect(o, 0, 4, 10, 7, 2); rect(o, 1, 0, 1, 2, 6); rect(o, 1, 18, 1, 2, 6); rect(o, 1, 6, 1, 4, 1); rect(o, 1, 6, 11, 4, 1); rect(o, 2, 1, 2, 1, 5); rect(o, 2, 19, 2, 1, 5); rect(o, 0, 6, 5, 4, 1); return o; } },
    { name: 'The Pagoda', make: () => { const o = []; rect(o, 0, 0, 0, 10, 6); rect(o, 1, 2, 2, 8, 4); rect(o, 2, 4, 4, 6, 2); rect(o, 3, 8, 5, 2, 1); return o; } },
    { name: "The Shogun's Castle", make: () => { const o = []; rect(o, 0, 0, 0, 12, 6); rect(o, 1, 2, 1, 10, 5); rect(o, 2, 6, 3, 6, 3); rect(o, 3, 8, 4, 4, 2); return o; } }];
  const overlap = (a, b) => Math.abs(a[1] - b[1]) < 2 && Math.abs(a[2] - b[2]) < 2;
  function freeTiles(pos, alive) { const out = [];
    for (let i = 0; i < pos.length; i++) { if (!alive[i]) continue; const p = pos[i]; let top = false, left = false, right = false;
      for (let j = 0; j < pos.length && !top; j++) { if (!alive[j] || j === i) continue; const q = pos[j];
        if (q[0] === p[0] + 1 && overlap(p, q)) top = true;
        else if (q[0] === p[0] && Math.abs(q[2] - p[2]) < 2) { if (q[1] === p[1] - 2) left = true; else if (q[1] === p[1] + 2) right = true; } }
      if (!top && (!left || !right)) out.push(i); }
    return out; }
  function deal(pos, alive, kinds, rnd) { // kinds for the live tiles: free pairs taken off in a random order share a kind
    const live = alive.map((a, i) => a ? i : -1).filter(i => i >= 0);
    for (let attempt = 0; attempt < 300; attempt++) { const al = alive.slice(), kind = new Array(pos.length).fill(-1), pairs = []; let left = live.length, ok = true, k = 0;
      const bag = []; while (bag.length < live.length / 2) bag.push(...kinds); bag.length = live.length / 2; for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
      while (left) { const f = freeTiles(pos, al); if (f.length < 2) { ok = false; break; } // both tiles free at the same time: a player could take this pair here
        const ia = Math.floor(rnd() * f.length), a = f[ia], f2 = f.filter((x, j) => j !== ia), b = f2[Math.floor(rnd() * f2.length)]; al[a] = al[b] = false; kind[a] = kind[b] = bag[k++]; pairs.push([a, b]); left -= 2; }
      if (ok) { kind.pairs = pairs; return kind; } }
    return null; }
  function solveFrom(pos, alive0, kind, ms) { // the pairs that clear the garden from here: [[a, b], ...], [] when clear, null when none (or out of time: .timeout)
    const t0 = performance.now(), seen = new Set(), alive = alive0.slice(); let out = null, timeout = false;
    const key = () => { let k = ''; for (let i = 0; i < alive.length; i += 30) { let v = 0; for (let j = i; j < Math.min(alive.length, i + 30); j++) v = v * 2 + (alive[j] ? 1 : 0); k += v.toString(36) + ','; } return k; };
    (function rec(path) { if (out || timeout) return; if (performance.now() - t0 > ms) { timeout = true; return; }
      if (!alive.some(Boolean)) { out = path.slice(); return; } const k = key(); if (seen.has(k)) return; seen.add(k);
      const free = freeTiles(pos, alive), by = {}; for (const i of free) (by[kind[i]] = by[kind[i]] || []).push(i);
      const left = {}; alive.forEach((a, i) => { if (a) left[kind[i]] = (left[kind[i]] || 0) + 1; });
      const pairs = []; for (const k2 in by) { const a = by[k2]; for (let x = 0; x < a.length; x++) for (let y = x + 1; y < a.length; y++) {
        // safe first: all of a kind free (2 or 4 left), then pairs that lie on others (higher layers)
        const safe = a.length === left[k2] ? 2 : 0; pairs.push([a[x], a[y], safe + (pos[a[x]][0] + pos[a[y]][0]) * .1]); } }
      pairs.sort((p, q) => q[2] - p[2]); if (pairs.length && pairs[0][2] >= 2) pairs.length = 1; // a safe pair never needs another try
      for (const [a, b2] of pairs) { alive[a] = alive[b2] = false; path.push([a, b2]); rec(path); path.pop(); alive[a] = alive[b2] = true; if (out || timeout) return; } })([]);
    if (out) return out; const r = null; solveFrom.timeout = timeout; return r; }
  const SUIT = ['#c0392b', '#2e8b57', '#2f6fb3'];
  function symbol(g, k, x, y, w, h) { // 0-26: dots / bamboo / rings 1-9; 27-35 honours
    const cx = x + w / 2, cy = y + h / 2, u = w / 6;
    if (k < 27) { const s = Math.floor(k / 9), n = k % 9 + 1, col = SUIT[s];
      const P = { 1: [[0, 0]], 2: [[0, -1], [0, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1.2], [1, -1.2], [-1, 0], [1, 0], [-1, 1.2], [1, 1.2]],
        7: [[-1, -1.3], [0, -1.3], [1, -1.3], [-1, .3], [1, .3], [-1, 1.4], [1, 1.4]], 8: [[-1, -1.4], [1, -1.4], [-1, -.47], [1, -.47], [-1, .47], [1, .47], [-1, 1.4], [1, 1.4]], 9: [[-1, -1.3], [0, -1.3], [1, -1.3], [-1, 0], [0, 0], [1, 0], [-1, 1.3], [0, 1.3], [1, 1.3]] }[n];
      const r = n === 1 ? u * 1.3 : u * .62;
      for (const [dx, dy] of P) { const px = cx + dx * u * 1.45, py = cy + dy * u * 1.55;
        if (s === 0) { g.fillStyle = col; g.beginPath(); g.arc(px, py, r, 0, 7); g.fill(); }
        else if (s === 1) { g.fillStyle = col; g.fillRect(px - r * .38, py - r * 1.25, r * .76, r * 2.5); g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(px - r * .38, py - r * .08, r * .76, r * .16); }
        else { g.strokeStyle = col; g.lineWidth = Math.max(2, r * .38); g.beginPath(); g.arc(px, py, r * .8, 0, 7); g.stroke(); } }
      return; }
    const kk = k - 27; g.save(); g.translate(cx, cy);
    if (kk === 0) { g.fillStyle = '#e8a317'; g.beginPath(); g.arc(0, 0, u * 1.2, 0, 7); g.fill(); g.strokeStyle = '#e8a317'; g.lineWidth = u * .3; for (let a = 0; a < 8; a++) { g.beginPath(); g.moveTo(Math.cos(a * .785) * u * 1.6, Math.sin(a * .785) * u * 1.6); g.lineTo(Math.cos(a * .785) * u * 2.2, Math.sin(a * .785) * u * 2.2); g.stroke(); } }
    else if (kk === 1) { g.fillStyle = '#3b4a8a'; g.beginPath(); g.arc(0, 0, u * 1.7, 0, 7); g.fill(); g.fillStyle = '#f4ecd6'; g.beginPath(); g.arc(u * .8, -u * .4, u * 1.5, 0, 7); g.fill(); }
    else if (kk === 2) { g.fillStyle = '#5b6b5b'; g.beginPath(); g.moveTo(-u * 2, u * 1.4); g.lineTo(-u * .4, -u * 1.6); g.lineTo(u * .5, -u * .2); g.lineTo(u * 1.1, -u * 1); g.lineTo(u * 2.1, u * 1.4); g.closePath(); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(-u * .9, -u * .7); g.lineTo(-u * .4, -u * 1.6); g.lineTo(u * .05, -u * .8); g.closePath(); g.fill(); }
    else if (kk === 3) { g.strokeStyle = '#2f6fb3'; g.lineWidth = u * .45; for (const yy of [-u, u * .3, u * 1.6]) { g.beginPath(); for (let t = -2; t <= 2.001; t += .25) { const px = t * u, py = yy + Math.sin(t * 2.2) * u * .45; t > -2 ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke(); } }
    else if (kk === 4) { g.fillStyle = '#e2581f'; g.beginPath(); g.moveTo(0, -u * 2.1); g.bezierCurveTo(u * 1.9, -u * .4, u * 1.4, u * 1.9, 0, u * 1.9); g.bezierCurveTo(-u * 1.4, u * 1.9, -u * 1.9, -u * .4, 0, -u * 2.1); g.fill(); g.fillStyle = '#f6c443'; g.beginPath(); g.arc(0, u * .8, u * .75, 0, 7); g.fill(); }
    else if (kk === 5) { g.fillStyle = '#3d8b37'; g.beginPath(); g.ellipse(0, 0, u * .95, u * 2, .6, 0, 7); g.fill(); g.strokeStyle = '#1f5a1c'; g.lineWidth = u * .18; g.beginPath(); g.moveTo(-u * 1.1, u * 1.5); g.lineTo(u * 1.1, -u * 1.5); g.stroke(); }
    else if (kk === 6) { g.fillStyle = '#c9971c'; g.beginPath(); for (let a = 0; a < 10; a++) { const r = a % 2 ? u * .85 : u * 2, ang = -Math.PI / 2 + a * Math.PI / 5; a ? g.lineTo(Math.cos(ang) * r, Math.sin(ang) * r) : g.moveTo(Math.cos(ang) * r, Math.sin(ang) * r); } g.closePath(); g.fill(); }
    else if (kk === 7) { g.fillStyle = '#e07aa5'; for (let a = 0; a < 5; a++) { const ang = a * 1.2566; g.beginPath(); g.ellipse(Math.cos(ang) * u * 1.05, Math.sin(ang) * u * 1.05, u * .95, u * .62, ang, 0, 7); g.fill(); } g.fillStyle = '#f6d55c'; g.beginPath(); g.arc(0, 0, u * .55, 0, 7); g.fill(); }
    else { g.fillStyle = '#7a1f1f'; g.beginPath(); g.ellipse(0, -u * 1.25, u * .62, u * .55, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(0, -u * .1, u * .5, u * .55, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(0, u * 1.3, u * .82, u * 1.0, 0, 0, 7); g.fill(); // the ant
      g.strokeStyle = '#7a1f1f'; g.lineWidth = u * .2; for (const sy of [-.1, .25, .6]) for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(0, u * sy); g.lineTo(sx * u * 1.6, u * (sy + .5)); g.stroke(); } g.beginPath(); g.moveTo(-u * .25, -u * 1.7); g.lineTo(-u * .8, -u * 2.3); g.moveTo(u * .25, -u * 1.7); g.lineTo(u * .8, -u * 2.3); g.stroke(); }
    g.restore(); }
  const G = {
    title: 'The Tile Garden',
    howTo: {
      lines: ['Clear the garden table by taking the tiles off in matching pairs: two tiles with the same picture.',
        'Only a free tile can be taken: nothing lies on top of it, and its left or right side is open. Blocked tiles are shaded.',
        'Click a free tile, then a free tile that matches it. Clicking a different tile holds that one instead.',
        'U takes the last pair back. H shows a pair that still lets you clear the garden, S shuffles the tiles that are left (two shuffles a garden); a hint or a shuffle costs the clean bonus.',
        'Tip: don\'t just take the first pair you see. Free the tall stacks and the long rows first, or you may bury a tile you need.']
    },
    start(ctx) {
      const B = ctx.B, H = ctx.HUD, scene = ctx.scene, def = ctx.def, KEY = 'rebelAntsTilesProgress:' + (def.id || 'mahjong');
      let solvedUpTo = 0; try { solvedUpTo = Math.max(0, Math.min(GARDENS.length, Number(localStorage.getItem(KEY)) || 0)); } catch (e) {}
      let seed = (Date.now() & 0xffff) + 1; const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
      const mat = (k, c, em) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(.05, .05, .05); if (em) m.emissiveColor = new B.Color3(...em); return m; });
      const woodM = mat('table', [.34, .2, .12], [.08, .05, .03]), brassM = mat('brass', [.75, .58, .25], [.2, .15, .05]);
      const nodes = [], keep = n => { n.parent = n.parent || ctx.frame; ctx.add(n); nodes.push(n); if (n.isPickable !== undefined) n.isPickable = false; return n; };
      const TEX = 1024, tex = new B.DynamicTexture('tgTex', { width: TEX, height: TEX }, scene, true); tex.hasAlpha = false;
      const boardM = new B.StandardMaterial('tgBoardMat', scene); boardM.diffuseTexture = tex; boardM.emissiveTexture = tex; boardM.emissiveColor = new B.Color3(.62, .62, .62); boardM.diffuseColor = new B.Color3(.55, .55, .55); boardM.specularColor = new B.Color3(0, 0, 0);
      const S = 4.4, TY = .95;
      { const t = keep(B.MeshBuilder.CreateBox('tgTable', { width: S + .5, height: .14, depth: S + .5 }, scene)); t.material = woodM; t.position.y = TY - .07;
        for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const l = keep(B.MeshBuilder.CreateBox('tgLeg', { width: .16, height: TY - .14, depth: .16 }, scene)); l.material = woodM; l.position.set(x * (S / 2), (TY - .14) / 2, z * (S / 2)); }
        for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const w = keep(B.MeshBuilder.CreateCylinder('tgWeight', { diameter: .16, height: .1, tessellation: 12 }, scene)); w.material = brassM; w.position.set(x * (S / 2 - .05), TY + .05, z * (S / 2 - .05)); } }
      const board = keep(B.MeshBuilder.CreateGround('tgBoard', { width: S, height: S }, scene)); board.material = boardM; board.position.y = TY + .005; board.isPickable = true; board.metadata = { tgBoard: true };
      let bd = null; // { k, G, pos, alive, kind, sel, hints, shuffles, time, undo: [[a, b]], flash: { tiles, t, good }, TW, TH, OX, OY, OFF, order }
      const st = { phase: 'pick', t: 0, dirty: false };
      const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
      const KINDS = [...Array(36).keys()];
      function build(k) {
        const g = GARDENS[k], pos = g.make(), alive = pos.map(() => true), kinds = k === 0 ? KINDS.slice(0, 21).sort(() => rnd() - .5) : KINDS;
        const kind = deal(pos, alive, kinds, rnd);
        const maxX = Math.max(...pos.map(p => p[1])) + 2, maxY = Math.max(...pos.map(p => p[2])) + 2, layers = Math.max(...pos.map(p => p[0])) + 1;
        const TW = Math.min((TEX - 80) / (maxX / 2 + layers * .14), (TEX - 80) / ((maxY / 2) * 1.3 + layers * .14)), TH = TW * 1.3, OFF = TW * .14;
        const OX = (TEX - (maxX / 2 * TW + layers * OFF)) / 2 + layers * OFF, OY = (TEX - (maxY / 2 * TH + layers * OFF)) / 2 + layers * OFF;
        const order = pos.map((_, i) => i).sort((a, b) => pos[a][0] - pos[b][0] || pos[a][2] - pos[b][2] || pos[a][1] - pos[b][1]);
        bd = { k, G: g, pos, alive, kind, kind0: kind.slice(), sel: -1, hints: 0, shuffles: 0, time: 0, undo: [], flash: null, TW, TH, OX, OY, OFF, order }; // kind0: the deal (a shuffle rewrites kind)
        ctx.player.place(0, cam[2] - 1.6, 0); draw(); info();
      }
      const faceRect = i => { const [l, x, y] = bd.pos[i]; return [bd.OX + x / 2 * bd.TW - l * bd.OFF, bd.OY + y / 2 * bd.TH - l * bd.OFF, bd.TW, bd.TH]; };
      const left = () => bd.alive.filter(Boolean).length;
      function moves() { const f = freeTiles(bd.pos, bd.alive), by = {}; for (const i of f) (by[bd.kind[i]] = by[bd.kind[i]] || []).push(i); let n = 0; const pairs = []; for (const k in by) { const a = by[k]; n += a.length * (a.length - 1) / 2; if (a.length > 1) pairs.push([a[0], a[1]]); } return { n, pairs, free: new Set(f) }; }
      const info = () => { if (!bd) { H.info('Pick a garden'); return; } const m = moves(); H.info(`Garden ${bd.k + 1} / ${GARDENS.length} · ${bd.G.name} · tiles ${left()} · pairs to take ${m.n} · shuffles ${2 - bd.shuffles} · ${fmt(bd.time)}${bd.hints ? ` · hints ${bd.hints}` : ''}`); };
      const draw = () => { st.dirty = true; }; // painted once per frame at most
      function paint() {
        const g = tex.getContext(), m = moves(), flash = bd.flash ? new Set(bd.flash.tiles) : null;
        g.fillStyle = '#2f4a2c'; g.fillRect(0, 0, TEX, TEX); // the garden cloth
        const grd = g.createRadialGradient(TEX / 2, TEX / 2, TEX * .2, TEX / 2, TEX / 2, TEX * .75); grd.addColorStop(0, 'rgba(255,255,255,.06)'); grd.addColorStop(1, 'rgba(0,0,0,.35)'); g.fillStyle = grd; g.fillRect(0, 0, TEX, TEX);
        for (const i of bd.order) { if (!bd.alive[i]) continue; const [x, y, w, h] = faceRect(i), d = bd.OFF, r = w * .1;
          g.fillStyle = '#8d7350'; rr(g, x + d * .5, y + d * .5, w, h, r); g.fill(); g.fillStyle = '#c9b48a'; rr(g, x + d * .25, y + d * .25, w, h, r); g.fill(); // the tile's sides
          g.fillStyle = '#f4ecd6'; rr(g, x, y, w, h, r); g.fill(); g.strokeStyle = 'rgba(90,70,40,.6)'; g.lineWidth = 2; g.stroke();
          symbol(g, bd.kind[i], x, y, w, h);
          if (!m.free.has(i)) { g.fillStyle = 'rgba(30,25,15,.28)'; rr(g, x, y, w, h, r); g.fill(); } // blocked
          if (i === bd.sel) { g.strokeStyle = '#ffbf28'; g.lineWidth = 6; rr(g, x + 2, y + 2, w - 4, h - 4, r); g.stroke(); }
          if (flash && flash.has(i)) { g.strokeStyle = bd.flash.good ? '#2fd060' : '#e03030'; g.lineWidth = 7; rr(g, x + 2, y + 2, w - 4, h - 4, r); g.stroke(); } }
        tex.update();
      }
      function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r); g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath(); }
      function tap(i) { if (st.phase !== 'play' || i == null || !bd.alive[i]) return false;
        const free = new Set(freeTiles(bd.pos, bd.alive)); if (!free.has(i)) { bd.flash = { tiles: [i], t: 0, good: false }; H.msg('That tile is held fast', 900, 'nothing on it, and its left or right side open'); ctx.note(220, 'lantern'); draw(); return false; }
        if (bd.sel < 0 || bd.sel === i) { bd.sel = bd.sel === i ? -1 : i; ctx.note(600, 'lantern'); draw(); return true; }
        if (bd.kind[bd.sel] !== bd.kind[i]) { bd.sel = i; ctx.note(600, 'lantern'); draw(); return true; } // not a pair: the new tile is held instead
        const a = bd.sel; bd.alive[a] = bd.alive[i] = false; bd.sel = -1; bd.undo.push([a, i]); ctx.note(880, 'bell'); draw(); info(); check(); return true; }
      function undo() { if (st.phase !== 'play') return; const p = bd.undo.pop(); if (!p) return; bd.alive[p[0]] = bd.alive[p[1]] = true; bd.sel = -1; ctx.note(330, 'lantern'); draw(); info(); }
      function hint() { if (st.phase !== 'play') return; const m = moves(); if (!m.pairs.length) { H.msg('No pair can be taken', 1300, (2 - bd.shuffles) ? 'shuffle the tiles (S)' : 'take a pair back (U)'); return; }
        // a pair from a way that still clears the garden (searched for up to 0.4 s), else any pair
        const way = solveFrom(bd.pos, bd.alive, bd.kind, 400);
        if (!way && !solveFrom.timeout) { H.msg('This garden can no longer be cleared', 2200, (2 - bd.shuffles) ? 'take pairs back (U) or shuffle (S)' : 'take pairs back (U)'); return; }
        const p = way ? way[0] : m.pairs[Math.floor(rnd() * m.pairs.length)]; bd.hints++; bd.flash = { tiles: p, t: 0, good: true }; H.msg('This pair', 1100); draw(); info(); }
      function shuffle() { if (st.phase !== 'play') return; if (bd.shuffles >= 2) { H.msg('No shuffles left', 1000); return; }
        const d = deal(bd.pos, bd.alive, [0], rnd); if (!d) { H.msg('The tiles will not mix', 1000); return; }
        // the same kinds stay in play, a pair of them on each pair of places a player could take in turn
        const have = {}; bd.alive.forEach((a, i) => { if (a) have[bd.kind[i]] = (have[bd.kind[i]] || 0) + 1; }); const want = []; for (const k in have) for (let n = 0; n < have[k] / 2; n++) want.push(+k);
        for (let i = want.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [want[i], want[j]] = [want[j], want[i]]; }
        d.pairs.forEach(([a, b], w) => { bd.kind[a] = bd.kind[b] = want[w]; });
        bd.shuffles++; bd.sel = -1; bd.undo = []; ctx.sound('thock'); H.msg('The tiles are mixed', 1000, `${2 - bd.shuffles} shuffle${2 - bd.shuffles === 1 ? '' : 's'} left`); draw(); info(); }
      function restart() { if (st.phase !== 'play' || !bd) return; bd.alive.fill(true); bd.kind = bd.kind0.slice(); Object.assign(bd, { sel: -1, undo: [], shuffles: 0, time: 0, flash: null }); draw(); info(); H.msg('Start again', 900, 'the same deal'); }
      function check() { if (left() === 0) { st.phase = 'won'; st.wt = 0; pads.style.display = 'none'; ctx.sound('gamewin'); H.msg('The garden is clear', 1600, fmt(bd.time));
          if (bd.k + 1 > solvedUpTo) { solvedUpTo = bd.k + 1; try { localStorage.setItem(KEY, String(solvedUpTo)); } catch (e) {} } return true; }
        const m = moves(); if (!m.n) { if (bd.shuffles < 2) H.msg('No pair can be taken', 1800, 'shuffle (S) or take a pair back (U)'); else H.msg('No pair can be taken', 1800, 'take a pair back (U), or quit'); }
        return false; }
      const hud = document.getElementById('gameHud');
      const pick = document.createElement('div');
      pick.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(420px,92vw);background:rgba(14,20,12,.95);border:1px solid rgba(216,179,92,.6);border-radius:14px;padding:16px;text-align:center;pointer-events:auto;font:15px/1.4 system-ui,sans-serif;color:#eee';
      const drawPick = () => { pick.innerHTML = `<div style="font:800 13px/1.2 system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#d8b35c;margin-bottom:10px">The Tile Garden</div><div style="margin-bottom:12px;color:#bbb">Take the tiles off in matching pairs. A tile is free with nothing on it and its left or right side open.</div>`
        + `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${GARDENS.map((L, k) => { const open = k <= solvedUpTo, ok = k < solvedUpTo, n = L.make().length; return `<button type="button" data-k="${k}" ${open ? '' : 'disabled'} style="padding:8px 2px;border-radius:9px;border:1px solid ${open ? '#d8b35c' : '#444'};background:${ok ? 'rgba(216,179,92,.2)' : 'rgba(255,255,255,.04)'};color:${open ? '#fff' : '#666'};font:700 15px system-ui,sans-serif;cursor:${open ? 'pointer' : 'default'}">${open ? `${k + 1}${ok ? ' ✓' : ''}<div style="font:500 11px system-ui;color:#c9b88f">${n} tiles</div>` : `${k + 1}<div style="font:500 11px system-ui">locked</div>`}</button>`; }).join('')}</div>`
          + `<div style="margin-top:10px;font-size:12px;color:#998">Keys 1-${GARDENS.length} pick a garden</div>`;
        pick.querySelectorAll('button[data-k]').forEach(b => b.onclick = (e) => { e.stopPropagation(); b.blur(); choose(+b.dataset.k); }); };
      const pads = document.createElement('div');
      pads.style.cssText = 'position:absolute;bottom:62px;right:14px;display:none;gap:6px;pointer-events:auto';
      const padBtn = (t, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.style.cssText = 'min-width:52px;height:40px;padding:0 10px;border-radius:9px;border:1px solid #d8b35c;background:rgba(14,20,12,.88);color:#fff1d2;font:700 15px system-ui;cursor:pointer'; b.onclick = (e) => { e.stopPropagation(); b.blur(); fn(); }; pads.appendChild(b); return b; };
      padBtn('Undo', undo); padBtn('Shuffle', shuffle); padBtn('Hint', hint);
      function choose(k) { if (st.phase !== 'pick' || k > solvedUpTo || k >= GARDENS.length) return; pick.remove(); st.phase = 'play'; build(k); pads.style.display = 'flex'; H.msg(`Garden ${k + 1}`, 900, `${GARDENS[k].name}: ${bd.pos.length} tiles`); }
      hud.append(pick, pads); drawPick();
      const cam = [0, TY + 3.8, -2.2], at = [0, TY, -.3]; // closer than the other boards: the tiles are small
      ctx.player.place(0, cam[2] - 1.6, 0); ctx.look(cam, at, def.fov || .8); // the player waits behind the camera, out of the picture
      { const g = tex.getContext(); g.fillStyle = '#2f4a2c'; g.fillRect(0, 0, TEX, TEX); tex.update(); }
      H.title(def.title || 'The Tile Garden'); H.score(''); info();
      H.hint('Click two free tiles that match to take them. <kbd>H</kbd> a pair, <kbd>S</kbd> shuffle, <kbd>U</kbd> take a pair back.');
      const tileAt = () => { const hit = scene.pickWithRay(ctx.ray(), m => m.metadata?.tgBoard); if (!hit?.pickedPoint) return null; const l = ctx.toLocal(hit.pickedPoint);
        const px = (l.x + S / 2) / S * TEX, py = (S / 2 - l.z) / S * TEX;
        for (let q = bd.order.length - 1; q >= 0; q--) { const i = bd.order[q]; if (!bd.alive[i]) continue; const [x, y, w, h] = faceRect(i); if (px >= x && px <= x + w && py >= y && py <= y + h) return i; }
        return null; };
      return {
        update(dt) {
          ctx.look(cam, at); st.t += dt; if (!bd) return; if (st.dirty) { st.dirty = false; paint(); }
          if (st.phase === 'play') { const s = Math.floor(bd.time); bd.time += dt; if (Math.floor(bd.time) !== s) info(); }
          if (bd.flash && (bd.flash.t += dt) > 1.4) { bd.flash = null; draw(); }
          if (st.phase === 'won' && (st.wt += dt) > 2) { st.phase = 'done'; H.hint(''); const k = bd.k, clean = !bd.hints && !bd.shuffles;
            ctx.finish({ score: (k + 1) * 20 + (clean ? 10 : 0), label: 'points', solved: true, extra: `${bd.G.name} (garden ${k + 1}, ${bd.pos.length} tiles) cleared in ${fmt(bd.time)}${bd.hints ? `, ${bd.hints} hint${bd.hints > 1 ? 's' : ''}` : ''}${bd.shuffles ? `, ${bd.shuffles} shuffle${bd.shuffles > 1 ? 's' : ''}` : ''}.${k + 1 < GARDENS.length ? ` Garden ${k + 2} is open.` : ' Every garden is clear.'}` }); }
        },
        key(e, down) {
          if (!down || e.repeat) return; const k = e.key.toLowerCase();
          if (st.phase === 'pick') { const n = parseInt(k, 10); if (n >= 1 && n <= GARDENS.length) choose(n - 1); return; }
          if (st.phase !== 'play') return;
          if (k === 'u' || (k === 'z' && (e.ctrlKey || e.metaKey))) undo(); else if (k === 'h') hint(); else if (k === 's') shuffle();
        },
        pointer(evt) { const T = B.PointerEventTypes; if (st.phase !== 'play' || !bd) return; if (evt.type === T.POINTERDOWN) tap(tileAt()); },
        restart, // the HUD's Restart button
        _test: { st, choose, tap, undo, hint, shuffle, moves, freeTiles: () => freeTiles(bd.pos, bd.alive), get bd() { return bd; }, GARDENS, draw: () => { st.dirty = false; paint(); }, unlock(k) { solvedUpTo = k; drawPick(); },
          greedy() { // play the deal out taking any free pair (gets stuck: tests)
            let n = 0; for (let guard = 0; guard < 400 && st.phase === 'play'; guard++) { const m = moves(); if (!m.pairs.length) break; const [a, b] = m.pairs[0]; bd.sel = -1; tap(a); tap(b); n++; } return n; },
          solve(ms = 3000) { const way = solveFrom(bd.pos, bd.alive, bd.kind, ms); if (!way) return solveFrom.timeout ? 'timeout' : 'none'; for (const [a, b] of way) { bd.sel = -1; tap(a); tap(b); } return way.length; }, solveFrom: ms => solveFrom(bd.pos, bd.alive, bd.kind, ms) },
        dispose() { pick.remove(); pads.remove(); nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); try { boardM.dispose(); tex.dispose(); } catch (e) {} }
      };
    }
  };
  G._lib = { freeTiles, deal, solveFrom, GARDENS }; // tests
  window.RebelGames.register('mahjong', G);
})();
