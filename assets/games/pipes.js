// The Canal Gates (Oct 15, Buke): the engineer's canal stones have been turned about. Every stone carries a piece of
// channel; click a stone (or move the frame with the arrows and press Space) to turn it a quarter. Water runs from the
// spout through every channel that meets the next; it is right when the water reaches every stone and no channel runs
// out into the dirt (an open end leaks). Five boards from 4 x 4 to 7 x 7, the same board each time (a fixed seed per
// level), each opens when the one before is done (kept on this device). Score: the board x 20, +10 within 10% of the
// fewest turns.
// Oct 17: How to play (the rules in a few lines); the HUD's Restart is R (the old board's leak marks now go with it).
// Oct 17 (Miguel: "make it 15 of these boards. add 1 3 hints only"): boards 6-15, 7 x 7 up to 11 x 11 (its rim ends
// 0.7 m short of the Buke plaza's cliff stairs and canal spout, 8.5 m either side of the spot). Seeds picked with a
// solver (scratchpad lv/pipes: edge matching, no loops, no closed pieces, then branching): every board, the first five
// too, has exactly one answer, so its fewest turns are exact; they get harder (less of the board settles by plain edge
// matching; board 15 needs a what-if or two). H (or the Hint button) turns the next stone the water needs into place:
// three a board (the info line counts them down), and no few-turns bonus after one. The camera aims a little nearer:
// the near rim sat under the hint bar at every size.
// def: { at: [x, z] (frame coords of the board's middle), cell: 1.2, levels: [{ n, seed }], pass, points }
(function () {
  const LEVELS = [{ n: 4, seed: 11 }, { n: 5, seed: 23 }, { n: 5, seed: 37 }, { n: 6, seed: 41 }, { n: 7, seed: 59 },
    // Oct 17: one answer each; fewest turns 62, 82, 77, 114, 121, 141, 143, 183, 151, 172 (scratchpad lv/pipes)
    { n: 7, seed: 45 }, { n: 8, seed: 423 }, { n: 8, seed: 22 }, { n: 9, seed: 752 }, { n: 9, seed: 85 },
    { n: 10, seed: 646 }, { n: 10, seed: 971 }, { n: 11, seed: 1090 }, { n: 11, seed: 5656 }, { n: 11, seed: 185 }];
  const HINTS = 3; // hints a board
  const N_ = 1, E_ = 2, S_ = 4, W_ = 8, DIRS = [[N_, 0, -1, S_], [E_, 1, 0, W_], [S_, 0, 1, N_], [W_, -1, 0, E_]];
  const rot = (m, r) => ((m << r) | (m >> (4 - r))) & 15;
  // a random spanning tree over the board from the spout (random Prim: frontier edges picked at random)
  function generate(n, seed) {
    let s = seed >>> 0 || 1; const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
    const mask = new Array(n * n).fill(0), inTree = new Array(n * n).fill(false), src = Math.floor(n / 2) * n + Math.floor(n / 2);
    inTree[src] = true; let frontier = [];
    const addF = i => { const x = i % n, y = Math.floor(i / n); for (const [b, dx, dy, ob] of DIRS) { const a = x + dx, c = y + dy; if (a >= 0 && c >= 0 && a < n && c < n && !inTree[c * n + a]) frontier.push([i, c * n + a, b, ob]); } };
    addF(src);
    while (frontier.length) {
      const k = Math.floor(rnd() * frontier.length), [i, j, b, ob] = frontier[k]; frontier.splice(k, 1); if (inTree[j]) continue;
      // fewer four-way crossings: skip an edge that would give a tile four channels, if another edge can reach j
      const deg = m => (m & 1) + (m >> 1 & 1) + (m >> 2 & 1) + (m >> 3 & 1);
      if (deg(mask[i]) >= 3 && frontier.some(f => f[1] === j && deg(mask[f[0]]) < 3)) { frontier.push([i, j, b, ob]); if (rnd() < .7) continue; }
      mask[i] |= b; mask[j] |= ob; inTree[j] = true; addF(j);
    }
    // turn every stone a random number of quarters (the solution is the turns back)
    const turns = mask.map(() => Math.floor(rnd() * 4));
    const start = mask.map((m, i) => rot(m, turns[i]));
    // the fewest clockwise turns from the scrambled stone back to a shape that fits (symmetric stones need fewer)
    const best = start.reduce((sum, m, i) => { for (let r = 0; r < 4; r++) if (rot(m, r) === mask[i]) return sum + r; return sum; }, 0);
    return { n, mask, start, src, best };
  }
  const G = {
    title: 'The Canal Gates',
    howTo: { lines: [
      'Turn the canal stones until the water from the spout reaches every stone and no channel leaks.',
      'Every stone carries a piece of channel: a straight, a bend, a T, a cross, or a basin where a channel ends.',
      'Water runs from the spout (the tall stone in the middle) through every channel that lines up with a channel on the next stone.',
      'A wet channel that runs into the dirt at the edge, or into the side of a stone with no channel there, leaks: the orange marks. Dark channels are still dry.',
      'Click (or tap) a stone to turn it a quarter turn clockwise. Or move the gold frame with the arrows / W A S D (or the pads) and press Space.',
      'H (or the Hint button) turns the next stone the water needs into place: three hints a board. R (or ⟲, or Restart) starts the board again.',
      'Turns are counted: finish within a tenth of the fewest (the result tells it) with no hint for 10 more points.',
      'Tip: start at the edges and corners. A channel there can only point inwards, which settles the stone.'],
      img: 'howto/pipes.png', caption: 'One click from done: the framed T leaks into the dirt, and the five stones past it are dry. One more quarter turn waters all 16.' },
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const LV = def.levels || LEVELS, CELL = def.cell || 1.2, AT = def.at || [0, 0];
      const KEY = 'rebelAntsCanalProgress:' + (def.id || 'pipes');
      let solvedUpTo = 0; try { solvedUpTo = Math.max(0, Math.min(LV.length, Number(localStorage.getItem(KEY)) || 0)); } catch (e) {}
      const mat = (k, c, em, o = {}) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(...(o.spec || [.05, .05, .05])); if (em) m.emissiveColor = new B.Color3(...em); if (o.flat) m.disableLighting = true; if (o.alpha != null) m.alpha = o.alpha; return m; });
      const slabM = mat('slab', [.55, .52, .45], [.1, .095, .08]), mossM = mat('moss', [.34, .4, .24], [.06, .075, .04]), wallM = mat('chanWall', [.4, .37, .32], [.07, .065, .055]);
      const dryM = mat('dry', [.24, .2, .16], [.04, .035, .03]), waterM = mat('water', [.25, .55, .8], [.12, .32, .52], { spec: [.6, .7, .8], alpha: .88 }), leakM = mat('leak', [.75, .45, .2], [.5, .25, .08], { flat: true, alpha: .8 });
      const rimM = mat('rim', [.3, .28, .25], [.05, .05, .045]), selM = mat('sel', [1, .85, .35], [1, .78, .25], { flat: true }), woodM = mat('wood', [.42, .3, .18], [.08, .055, .03]);
      const src = (m, mt) => { m.material = mt; m.isPickable = false; m.isVisible = false; ctx.add(m); return m; };
      const W2 = CELL * .26; // channel width
      const sSlab = src(B.MeshBuilder.CreateBox('canSlab', { width: CELL * .96, height: .22, depth: CELL * .96 }, scene), slabM);
      const sMoss = src(B.MeshBuilder.CreateBox('canMoss', { width: CELL * .3, height: .02, depth: CELL * .3 }, scene), mossM);
      const sDryArm = src(B.MeshBuilder.CreateBox('canDryArm', { width: W2, height: .02, depth: CELL * .5 }, scene), dryM);
      const sWetArm = src(B.MeshBuilder.CreateBox('canWetArm', { width: W2 * .92, height: .03, depth: CELL * .5 }, scene), waterM);
      const sHub = src(B.MeshBuilder.CreateCylinder('canHub', { height: .02, diameter: W2 * 1.4, tessellation: 12 }, scene), dryM);
      const sWetHub = src(B.MeshBuilder.CreateCylinder('canWetHub', { height: .03, diameter: W2 * 1.32, tessellation: 12 }, scene), waterM);
      const sLip = src(B.MeshBuilder.CreateBox('canLip', { width: .07, height: .1, depth: CELL * .5 }, scene), wallM);
      const sBasin = src(B.MeshBuilder.CreateCylinder('canBasin', { height: .2, diameter: CELL * .52, tessellation: 16 }, scene), wallM);
      const sBasinIn = src(B.MeshBuilder.CreateCylinder('canBasinIn', { height: .02, diameter: CELL * .42, tessellation: 16 }, scene), dryM);
      const sBasinWater = src(B.MeshBuilder.CreateCylinder('canBasinWater', { height: .03, diameter: CELL * .4, tessellation: 16 }, scene), waterM);
      const sLeak = src(B.MeshBuilder.CreateDisc('canLeak', { radius: W2 * .7, tessellation: 12 }, scene), leakM);
      const sRim = src(B.MeshBuilder.CreateBox('canRim', { width: CELL, height: .32, depth: CELL }, scene), rimM);
      const sSel = src(B.MeshBuilder.CreateTorus('canSel', { diameter: CELL * 1.18, thickness: .06, tessellation: 4 }, scene), selM);
      const sSpout = src(B.MeshBuilder.CreateBox('canSpout', { width: CELL * .5, height: .7, depth: CELL * .5 }, scene), wallM);
      const sSpoutCap = src(B.MeshBuilder.CreateBox('canSpoutCap', { width: CELL * .6, height: .08, depth: CELL * .6 }, scene), woodM);
      let board = null; // { k, n, mask[], cur[], turns, hints, nodes[], tiles: [{ node, wet: [], dry: [] }], sel, best, wet: Set, leaks[] }
      const st = { phase: 'pick', spin: [], wait: 0, t: 0 };
      const posOf = i => new V3(AT[0] + (i % board.n - (board.n - 1) / 2) * CELL, 0, AT[1] + ((board.n - 1) / 2 - Math.floor(i / board.n)) * CELL);
      // water from the spout along channels that meet; leaks = channel ends with nothing to meet
      function flow() {
        const n = board.n, cur = board.cur, wet = new Set([board.src]), q = [board.src], leaks = [];
        while (q.length) { const i = q.pop(), x = i % n, y = Math.floor(i / n);
          for (const [b, dx, dy, ob] of DIRS) { if (!(cur[i] & b)) continue; const a = x + dx, c = y + dy;
            if (a < 0 || c < 0 || a >= n || c >= n || !(cur[c * n + a] & ob)) { leaks.push([i, b]); continue; }
            const j = c * n + a; if (!wet.has(j)) { wet.add(j); q.push(j); } } }
        return { wet, leaks };
      }
      function build(k) {
        if (board) [...board.nodes, ...board.leaks].forEach(n => { try { n.dispose(); } catch (e) {} }); // a restart: the old leak marks too
        st.spin = [];
        const L = LV[k], g = generate(L.n, L.seed), n = L.n;
        board = { k, n, mask: g.mask, cur: g.start.slice(), src: g.src, best: g.best, turns: 0, hints: 0, nodes: [], tiles: [], sel: g.src, wet: new Set(), leaks: [] };
        const inst = (s, parent, x, y, z, ry = 0) => { const m = s.createInstance('canPart'); m.parent = parent; m.position.set(x, y, z); m.rotation.y = ry; board.nodes.push(m); ctx.add(m); return m; };
        for (let i = 0; i < n * n; i++) {
          const node = new B.TransformNode('canTile', scene); node.parent = ctx.frame; ctx.add(node); board.nodes.push(node); const p = posOf(i); node.position.set(p.x, 0, p.z);
          const slab = inst(sSlab, node, 0, .11, 0); slab.isPickable = true; slab.metadata = { canCell: i };
          // the stone's own channels, built for its solved shape turned back by its scramble (the node turns as a whole)
          const base = g.mask[i], turnsBack = (() => { for (let r = 0; r < 4; r++) if (rot(base, r) === g.start[i]) return r; return 0; })();
          const t = { node, wet: [], dry: [], arms: base, deg: (base & 1) + (base >> 1 & 1) + (base >> 2 & 1) + (base >> 3 & 1), r: turnsBack };
          [[N_, 0, 1, 0], [E_, 1, 0, Math.PI / 2], [S_, 0, -1, Math.PI], [W_, -1, 0, -Math.PI / 2]].forEach(([b, ax, az, ry]) => { if (!(base & b)) return;
            const cx = ax * CELL * .25, cz = az * CELL * .25;
            t.dry.push(inst(sDryArm, node, cx, .225, cz, ry)); const w = inst(sWetArm, node, cx, .235, cz, ry); w.setEnabled(false); t.wet.push(w);
            const off = W2 * .5 + .035; inst(sLip, node, cx + (az ? off : 0), .27, cz + (ax ? off : 0), ry); inst(sLip, node, cx - (az ? off : 0), .27, cz - (ax ? off : 0), ry); });
          if (t.deg === 1 && i !== g.src) { inst(sBasin, node, 0, .32, 0); t.dry.push(inst(sBasinIn, node, 0, .425, 0)); const w = inst(sBasinWater, node, 0, .435, 0); w.setEnabled(false); t.wet.push(w); }
          else { t.dry.push(inst(sHub, node, 0, .225, 0)); const w = inst(sWetHub, node, 0, .235, 0); w.setEnabled(false); t.wet.push(w); }
          if (t.deg <= 2) { inst(sMoss, node, CELL * .3 * ((i * 7) % 3 - 1 || 1), .225, CELL * .3 * ((i * 5) % 2 ? 1 : -1)); }
          if (i === g.src) { inst(sSpout, node, 0, .55, 0); inst(sSpoutCap, node, 0, .94, 0); }
          node.rotation.y = turnsBack * Math.PI / 2;
          board.tiles.push(t);
        }
        const rimAt = (x, y) => new V3(AT[0] + (x - (n - 1) / 2) * CELL, 0, AT[1] + ((n - 1) / 2 - y) * CELL);
        for (let x = -1; x <= n; x++) for (const y of [-1, n]) { const p = rimAt(x, y), m = sRim.createInstance('canRimI'); m.parent = ctx.frame; ctx.add(m); m.position.set(p.x, .16, p.z); board.nodes.push(m); }
        for (let y = 0; y < n; y++) for (const x of [-1, n]) { const p = rimAt(x, y), m = sRim.createInstance('canRimI'); m.parent = ctx.frame; ctx.add(m); m.position.set(p.x, .16, p.z); board.nodes.push(m); }
        board.selNode = sSel.createInstance('canSelI'); board.selNode.parent = ctx.frame; ctx.add(board.selNode); board.selNode.rotation.y = Math.PI / 4; board.nodes.push(board.selNode);
        // the Rebel stands off the south-west corner; past 10 x 10 that is on the cliff stairs west of the Buke plaza, so
        // there it stands beside the near rim instead
        const sp = posOf(g.src); if (n <= 10) ctx.player.place(sp.x - CELL * (n / 2 + 1.4), sp.z - CELL * (n / 2 + .6), Math.PI / 4); else ctx.player.place(sp.x - CELL * (n / 2 - .5), sp.z - CELL * (n / 2 + 1.4), .63);
        // aimed 15% of the board nearer: the near rim clears the hint bar (it sat under it at every size), the far rim
        // stays under the title bar (scratchpad lv/cam/fit.mjs: y 70 .. 437 of 540 for 4 x 4 .. 11 x 11)
        const span = n * CELL;
        st.cam = [AT[0], span * 1.25 + 3.5, AT[1] - span * .85 - 2.1]; st.at = [AT[0], 0, AT[1] - span * .15];
        refresh(); info();
      }
      function refresh() {
        const f = flow(); board.wet = f.wet;
        board.tiles.forEach((t, i) => { const w = f.wet.has(i); t.wet.forEach(m => m.setEnabled(w)); t.dry.forEach(m => m.setEnabled(!w)); });
        board.leaks.forEach(m => m.dispose()); board.leaks = [];
        f.leaks.forEach(([i, b]) => { const p = posOf(i), d = DIRS.find(D => D[0] === b); const m = sLeak.createInstance('canLeakI'); m.parent = ctx.frame; ctx.add(m); m.rotation.x = Math.PI / 2; m.position.set(p.x + d[1] * CELL * .5, .24, p.z - d[2] * CELL * .5); board.leaks.push(m); });
        const sp = posOf(board.sel); board.selNode.position.set(sp.x, .26, sp.z);
        return f;
      }
      const info = () => { if (!board) return H.info('Pick a board'); H.info(`Board ${board.k + 1} / ${LV.length} · turns ${board.turns} · water reaches ${board.wet.size} / ${board.n * board.n} · hints left ${HINTS - board.hints}`); };
      // a stone's new angle (t.r quarters) as one clockwise spin from where it is now
      const spin = t => { st.spin = st.spin.filter(s => s.node !== t.node); const from = t.node.rotation.y; let to = t.r * Math.PI / 2; while (to <= from + 1e-3) to += 2 * Math.PI; st.spin.push({ node: t.node, from, to, end: t.r * Math.PI / 2, t: 0 }); };
      // done when the water reaches every stone and nothing leaks
      function check(f) {
        if (f.wet.size !== board.n * board.n || f.leaks.length) return;
        st.phase = 'solved'; st.wait = 1.5; ctx.sound('gamewin'); H.msg('The water runs true', 1400, `${board.turns} turns`); pads.style.display = 'none';
        if (board.k + 1 > solvedUpTo) { solvedUpTo = board.k + 1; try { localStorage.setItem(KEY, String(solvedUpTo)); } catch (e) {} }
      }
      function turn(i) {
        if (st.phase !== 'play' || i == null || i < 0 || i >= board.n * board.n) return;
        board.cur[i] = rot(board.cur[i], 1); board.turns++; board.sel = i;
        const t = board.tiles[i]; t.r = (t.r + 1) % 4; spin(t);
        ctx.sound('thock'); const f = refresh(); info(); check(f);
      }
      // H: the first stone not yet turned right, going out from the spout along the plan's channels (where the water goes
      // next), turned into place; its turns are the hint's, not counted. Three a board; no few-turns bonus after one.
      function hint() {
        if (st.phase !== 'play' || !board) return;
        if (board.hints >= HINTS) { H.msg('No hints left', 1300, `${HINTS} a board`); return; }
        const n = board.n, seen = new Set([board.src]), q = [board.src]; let i = -1;
        for (let h = 0; h < q.length && i < 0; h++) { const c = q[h], x = c % n, y = Math.floor(c / n); if (board.cur[c] !== board.mask[c]) { i = c; break; }
          for (const [b, dx, dy] of DIRS) { const j = (y + dy) * n + x + dx; if ((board.mask[c] & b) && !seen.has(j)) { seen.add(j); q.push(j); } } }
        if (i < 0) return;
        let r = 1; while (rot(board.cur[i], r) !== board.mask[i]) r++;
        board.hints++; board.cur[i] = board.mask[i]; board.sel = i; const t = board.tiles[i]; t.r = (t.r + r) % 4; spin(t);
        const left = HINTS - board.hints; ctx.sound('thock'); H.msg('This stone goes so', 1300, left ? `${left} hint${left > 1 ? 's' : ''} left` : 'that was the last hint');
        const f = refresh(); info(); check(f);
      }
      function moveSel(dx, dy) { if (st.phase !== 'play') return; const n = board.n, x = Math.max(0, Math.min(n - 1, board.sel % n + dx)), y = Math.max(0, Math.min(n - 1, Math.floor(board.sel / n) + dy)); board.sel = y * n + x; const sp = posOf(board.sel); board.selNode.position.set(sp.x, .26, sp.z); }
      function restart() { if (st.phase !== 'play') return; build(board.k); H.msg('Again', 600); }
      const hud = document.getElementById('gameHud');
      const pick = document.createElement('div');
      pick.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(' + (LV.length > 6 && innerWidth >= 600 ? 560 : 380) + 'px,92vw);background:rgba(16,12,10,.94);border:1px solid rgba(216,179,92,.6);border-radius:14px;padding:16px;text-align:center;pointer-events:auto;font:15px/1.4 Georgia,serif;color:#eee';
      const drawPick = () => { pick.innerHTML = `<div style="font:700 13px/1.2 Georgia,serif;letter-spacing:.14em;text-transform:uppercase;color:#d8b35c;margin-bottom:10px">The Canal Gates</div><div style="margin-bottom:12px;color:#bbb">Turn the canal stones until the water reaches every one and nothing leaks.</div>`
        + `<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px">${LV.map((L, k) => { const open = k <= solvedUpTo, done = k < solvedUpTo; return `<button type="button" data-k="${k}" ${open ? '' : 'disabled'} style="padding:8px 2px;border-radius:9px;border:1px solid ${open ? '#d8b35c' : '#444'};background:${done ? 'rgba(216,179,92,.25)' : 'rgba(255,255,255,.04)'};color:${open ? '#fff' : '#666'};font:700 15px Georgia,serif;cursor:${open ? 'pointer' : 'default'}">${open ? `${k + 1}<div style="font:11px Georgia,serif;opacity:.75">${L.n} × ${L.n}</div>` : '🔒'}${done ? ' ✓' : ''}</button>`; }).join('')}</div>`;
        pick.querySelectorAll('button[data-k]').forEach(b => b.onclick = (e) => { e.stopPropagation(); b.blur(); choose(+b.dataset.k); }); };
      function choose(k) { if (st.phase !== 'pick' || k > solvedUpTo || k >= LV.length) return; pick.remove(); st.phase = 'play'; build(k); pads.style.display = 'grid'; H.msg(`Board ${k + 1}`, 900, k >= 3 ? 'a hard one' : ''); }
      const pads = document.createElement('div');
      pads.style.cssText = 'position:absolute;bottom:62px;right:16px;display:none;grid-template-columns:repeat(3,46px);grid-template-rows:repeat(3,40px);gap:5px;pointer-events:auto';
      const pad = (t, area, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.style.cssText = `grid-area:${area};border-radius:8px;border:1px solid #b8964a;background:rgba(20,14,10,.82);color:#ffe9b0;font:700 16px Georgia,serif;cursor:pointer`; b.onclick = (e) => { e.stopPropagation(); b.blur(); fn(); }; pads.appendChild(b); };
      pad('↑', '1 / 2', () => moveSel(0, -1)); pad('←', '2 / 1', () => moveSel(-1, 0)); pad('→', '2 / 3', () => moveSel(1, 0)); pad('↓', '3 / 2', () => moveSel(0, 1)); pad('↻', '2 / 2', () => turn(board.sel)); pad('⟲', '1 / 3', restart); pad('Hint', '3 / 3', hint);
      hud.append(pick, pads);
      drawPick();
      st.cam = [AT[0], 11, AT[1] - 9]; st.at = [AT[0], 0, AT[1]];
      ctx.look(st.cam, st.at, def.fov || .8);
      H.title(def.title || 'The Canal Gates'); H.score(''); info();
      H.hint('Click a stone to turn it (or the arrows and <kbd>Space</kbd>). Water must reach every stone with no leaks (the orange marks). <kbd>H</kbd> hint (3 a board), <kbd>R</kbd> starts again.');
      const inst = {
        update(dt) {
          ctx.look(st.cam, st.at);
          for (let k = st.spin.length - 1; k >= 0; k--) { const s = st.spin[k]; s.t += dt / .16; const u = Math.min(1, s.t); s.node.rotation.y = s.from + (s.to - s.from) * u * u * (3 - 2 * u); if (u >= 1) { s.node.rotation.y = s.end; st.spin.splice(k, 1); } }
          if (st.phase === 'solved' && (st.wait -= dt) <= 0) {
            st.phase = 'done'; H.hint('');
            const k = board.k, score = (k + 1) * 20 + (board.turns <= Math.ceil(board.best * 1.1) && !board.hints ? 10 : 0);
            ctx.finish({ score, label: 'points', solved: true, extra: `Board ${k + 1} (${board.n} × ${board.n}) in ${board.turns} turns (it can be done in ${board.best})${board.hints ? `, ${board.hints} hint${board.hints > 1 ? 's' : ''}` : ''}.${k + 1 < LV.length ? ` Board ${k + 2} is open.` : ' Every board done.'}` });
          }
        },
        key(e, down) {
          if (!down || e.repeat) return; const k = e.key.toLowerCase();
          if (st.phase === 'pick') { const n = k === '0' ? 10 : parseInt(k, 10); if (n >= 1 && n <= LV.length) choose(n - 1); return; } // 1-9, 0 = the tenth
          if (k === 'arrowup' || k === 'w') moveSel(0, -1); else if (k === 'arrowdown' || k === 's') moveSel(0, 1); else if (k === 'arrowleft' || k === 'a') moveSel(-1, 0); else if (k === 'arrowright' || k === 'd') moveSel(1, 0);
          else if (k === ' ' || k === 'enter') turn(board.sel); else if (k === 'r') restart(); else if (k === 'h') hint();
        },
        pointer(evt) {
          if (evt.type !== B.PointerEventTypes.POINTERDOWN || st.phase !== 'play') return;
          const hit = scene.pickWithRay(ctx.ray(), m => m.metadata?.canCell != null);
          const i = hit?.pickedMesh?.metadata?.canCell; if (i != null) turn(i);
        },
        restart, // the HUD's Restart: the board as it was picked (the same scramble, no turns)
        _test: { st, turn, moveSel, choose, flow, rot, generate, restart, hint, HINTS, get board() { return board; }, LV },
        dispose() { pick.remove(); pads.remove(); if (board) { board.nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); board.leaks.forEach(n => { try { n.dispose(); } catch (e) {} }); } }
      };
      return inst;
    }
  };
  window.RebelGames.register('pipes', G);
})();
