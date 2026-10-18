// Valet Parking (Oct 15, Saints of LA): the purple lowrider is boxed in. Cars only roll forward and back along their
// own line; get the lowrider out through the gap in the curb on the right. Click a car (or Tab through them), then the
// arrows or a click on a free square in its line slide it; one slide of a car, however far, is one move. U undoes, R
// starts again. Seven lots from 5 to 30 moves (the fewest moves found by a solver); each opens when the one before
// is done. Score: the lot x 20, +10 in the fewest moves.
// Oct 17: How to play (the rules) and Restart beside Quit (the same as R: every car back where the lot started).
// Oct 17 (Miguel: "make it 15"): lots 8-15, 33 to 49 moves (the hardest 6 x 6 lot there is needs 51). Made by hill
// climbing on car sets (scratchpad lv/valet): for a set of cars, every position they can reach is searched back from
// every position with the lowrider out, and the farthest one is that set's hardest start; cars were added, dropped or
// swapped while it got harder (a car whose removal kept the fewest moves was dropped: none was). Each lot's fewest
// moves checked again by the old breadth-first solver from its start; no two of the new lots share more than six cars.
// The camera sits a little farther back and aims nearer: the near curb sat under the hint bar.
// def: { at: [x, z] (frame coords of the lot's middle), cell: 1.4, levels: [{ cars: [{ x, y, len, h }], best }], pass, points }
(function () {
  const LEVELS = [
    { best: 5, cars: [{ x: 1, y: 2, len: 2, h: true }, { x: 3, y: 4, len: 2, h: true }, { x: 4, y: 0, len: 2, h: true }, { x: 1, y: 3, len: 2, h: true }, { x: 0, y: 0, len: 3, h: true }, { x: 1, y: 4, len: 2, h: false }, { x: 5, y: 3, len: 2, h: false }, { x: 5, y: 1, len: 2, h: false }, { x: 4, y: 1, len: 2, h: false }] },
    { best: 8, cars: [{ x: 1, y: 2, len: 2, h: true }, { x: 4, y: 0, len: 3, h: false }, { x: 3, y: 4, len: 2, h: false }, { x: 1, y: 3, len: 2, h: true }, { x: 5, y: 2, len: 2, h: false }, { x: 3, y: 3, len: 2, h: true }, { x: 0, y: 3, len: 2, h: false }, { x: 2, y: 0, len: 2, h: true }, { x: 1, y: 4, len: 2, h: false }, { x: 5, y: 4, len: 2, h: false }, { x: 2, y: 4, len: 2, h: false }, { x: 3, y: 1, len: 2, h: false }] },
    { best: 12, cars: [{ x: 2, y: 2, len: 2, h: true }, { x: 1, y: 2, len: 2, h: false }, { x: 5, y: 2, len: 2, h: false }, { x: 4, y: 1, len: 2, h: true }, { x: 4, y: 2, len: 2, h: false }, { x: 3, y: 0, len: 2, h: false }, { x: 1, y: 1, len: 2, h: true }, { x: 2, y: 3, len: 2, h: true }, { x: 2, y: 4, len: 2, h: false }, { x: 3, y: 4, len: 3, h: true }] },
    { best: 16, cars: [{ x: 0, y: 2, len: 2, h: true }, { x: 1, y: 3, len: 3, h: true }, { x: 3, y: 1, len: 2, h: false }, { x: 0, y: 0, len: 2, h: false }, { x: 1, y: 5, len: 2, h: true }, { x: 0, y: 4, len: 2, h: true }, { x: 4, y: 4, len: 2, h: true }, { x: 5, y: 0, len: 3, h: false }, { x: 4, y: 1, len: 2, h: false }, { x: 2, y: 1, len: 2, h: false }, { x: 4, y: 5, len: 2, h: true }, { x: 3, y: 0, len: 2, h: true }, { x: 4, y: 3, len: 2, h: true }] },
    { best: 20, cars: [{ x: 2, y: 2, len: 2, h: true }, { x: 3, y: 4, len: 2, h: true }, { x: 0, y: 3, len: 2, h: true }, { x: 4, y: 2, len: 2, h: false }, { x: 0, y: 0, len: 3, h: true }, { x: 4, y: 0, len: 2, h: false }, { x: 5, y: 4, len: 2, h: false }, { x: 0, y: 1, len: 2, h: false }, { x: 1, y: 4, len: 2, h: false }, { x: 2, y: 3, len: 2, h: false }] },
    { best: 26, cars: [{ x: 1, y: 2, len: 2, h: true }, { x: 3, y: 4, len: 2, h: true }, { x: 3, y: 0, len: 2, h: false }, { x: 0, y: 4, len: 2, h: false }, { x: 0, y: 1, len: 3, h: true }, { x: 0, y: 0, len: 2, h: true }, { x: 5, y: 0, len: 2, h: false }, { x: 4, y: 1, len: 2, h: false }, { x: 3, y: 2, len: 2, h: false }, { x: 1, y: 3, len: 2, h: true }, { x: 5, y: 4, len: 2, h: false }, { x: 2, y: 4, len: 2, h: false }] },
    { best: 30, cars: [{ x: 0, y: 2, len: 2, h: true }, { x: 4, y: 2, len: 2, h: false }, { x: 0, y: 4, len: 2, h: false }, { x: 2, y: 0, len: 2, h: false }, { x: 4, y: 4, len: 2, h: false }, { x: 3, y: 0, len: 2, h: false }, { x: 1, y: 4, len: 3, h: true }, { x: 0, y: 3, len: 2, h: true }, { x: 3, y: 2, len: 2, h: false }, { x: 4, y: 0, len: 2, h: true }] },
    // Oct 17: 33 to 49 moves (scratchpad lv/valet: the hardest start of each car set, checked by breadth-first search)
    { best: 33, cars: [{ x: 3, y: 2, len: 2, h: true }, { x: 0, y: 1, len: 2, h: false }, { x: 5, y: 0, len: 3, h: false }, { x: 2, y: 2, len: 3, h: false }, { x: 0, y: 3, len: 2, h: true }, { x: 1, y: 1, len: 2, h: true }, { x: 3, y: 4, len: 3, h: true }, { x: 3, y: 5, len: 2, h: true }, { x: 1, y: 5, len: 2, h: true }, { x: 3, y: 0, len: 2, h: false }, { x: 0, y: 0, len: 3, h: true }] },
    { best: 35, cars: [{ x: 0, y: 2, len: 2, h: true }, { x: 2, y: 1, len: 2, h: false }, { x: 0, y: 4, len: 2, h: false }, { x: 5, y: 0, len: 2, h: false }, { x: 5, y: 2, len: 2, h: false }, { x: 2, y: 3, len: 2, h: false }, { x: 4, y: 4, len: 2, h: true }, { x: 0, y: 0, len: 3, h: true }, { x: 0, y: 1, len: 2, h: true }, { x: 1, y: 5, len: 2, h: true }, { x: 3, y: 4, len: 2, h: false }, { x: 3, y: 3, len: 2, h: true }, { x: 4, y: 1, len: 2, h: false }] },
    { best: 36, cars: [{ x: 3, y: 2, len: 2, h: true }, { x: 4, y: 3, len: 2, h: true }, { x: 5, y: 0, len: 3, h: false }, { x: 3, y: 3, len: 3, h: false }, { x: 2, y: 0, len: 3, h: false }, { x: 0, y: 3, len: 2, h: false }, { x: 1, y: 5, len: 2, h: true }, { x: 0, y: 0, len: 2, h: true }, { x: 1, y: 4, len: 2, h: true }] },
    { best: 38, cars: [{ x: 0, y: 2, len: 2, h: true }, { x: 0, y: 0, len: 2, h: false }, { x: 2, y: 2, len: 3, h: false }, { x: 4, y: 3, len: 2, h: true }, { x: 1, y: 1, len: 2, h: true }, { x: 3, y: 1, len: 2, h: false }, { x: 2, y: 0, len: 3, h: true }, { x: 3, y: 5, len: 2, h: true }, { x: 5, y: 0, len: 3, h: false }, { x: 1, y: 5, len: 2, h: true }, { x: 3, y: 3, len: 2, h: false }] },
    { best: 41, cars: [{ x: 0, y: 2, len: 2, h: true }, { x: 1, y: 3, len: 3, h: true }, { x: 3, y: 4, len: 2, h: true }, { x: 5, y: 2, len: 2, h: false }, { x: 4, y: 0, len: 2, h: true }, { x: 2, y: 0, len: 2, h: true }, { x: 1, y: 0, len: 2, h: false }, { x: 4, y: 1, len: 3, h: false }, { x: 3, y: 5, len: 2, h: true }, { x: 3, y: 1, len: 2, h: false }, { x: 2, y: 4, len: 2, h: false }, { x: 0, y: 3, len: 3, h: false }] },
    { best: 44, cars: [{ x: 0, y: 2, len: 2, h: true }, { x: 2, y: 1, len: 3, h: true }, { x: 4, y: 4, len: 2, h: false }, { x: 2, y: 0, len: 2, h: true }, { x: 5, y: 4, len: 2, h: false }, { x: 2, y: 2, len: 2, h: false }, { x: 3, y: 2, len: 2, h: false }, { x: 1, y: 5, len: 3, h: true }, { x: 1, y: 4, len: 3, h: true }, { x: 0, y: 0, len: 2, h: false }, { x: 4, y: 0, len: 2, h: true }, { x: 5, y: 1, len: 2, h: false }, { x: 4, y: 3, len: 2, h: true }] },
    { best: 47, cars: [{ x: 1, y: 2, len: 2, h: true }, { x: 1, y: 3, len: 3, h: true }, { x: 4, y: 4, len: 2, h: true }, { x: 3, y: 0, len: 2, h: true }, { x: 3, y: 4, len: 2, h: false }, { x: 2, y: 0, len: 2, h: false }, { x: 0, y: 2, len: 3, h: false }, { x: 0, y: 1, len: 2, h: true }, { x: 0, y: 5, len: 2, h: true }, { x: 0, y: 0, len: 2, h: true }, { x: 4, y: 1, len: 3, h: false }, { x: 4, y: 5, len: 2, h: true }, { x: 5, y: 1, len: 3, h: false }] },
    { best: 49, cars: [{ x: 2, y: 2, len: 2, h: true }, { x: 1, y: 4, len: 2, h: false }, { x: 2, y: 3, len: 2, h: false }, { x: 3, y: 0, len: 2, h: false }, { x: 5, y: 0, len: 3, h: false }, { x: 4, y: 5, len: 2, h: true }, { x: 4, y: 0, len: 3, h: false }, { x: 0, y: 0, len: 3, h: true }, { x: 0, y: 1, len: 2, h: false }, { x: 0, y: 3, len: 2, h: true }, { x: 1, y: 1, len: 2, h: true }, { x: 2, y: 5, len: 2, h: true }, { x: 4, y: 4, len: 2, h: true }] }
  ];
  const N = 6, PAINT = ['sl_car_blue', 'sl_car_gold', 'sl_car_red', 'sl_car_black', 'sl_car_white'];
  const G = {
    title: 'Valet Parking',
    howTo: { lines: [
      'Get the purple lowrider out through the gap in the curb on the right.',
      'Cars only roll forward and back along their own line: they never turn, and they cannot pass through each other.',
      'Click (or tap) a car, or press Tab (or ⇥) to step through them: the gold outline marks it and the glowing dots show where it can roll. Click a dot (or a free square in its line), or press the arrows / W A S D to roll it one square at a time.',
      'Moving a car counts as one move however far it rolls (more slides of the same car in a row still count once).',
      'U (or ↶) undoes; R (or ⟲, or Restart) parks every car back where the lot started.',
      'The fewest moves are shown at the top: clear the lot in them for 10 more points.',
      'Tip: start from the lowrider: which car blocks its way out, and which cars block that one?'],
      img: 'howto/valet.png', caption: 'A lot cleared in its fewest moves, as numbered: the gold car rolls left so the red one can roll down out of the row, the blue car rolls up, and the lowrider is out.' },
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const LV = def.levels || LEVELS, CELL = def.cell || 1.4, AT = def.at || [0, 0];
      const KEY = 'rebelAntsValetProgress:' + (def.id || 'valet');
      let solvedUpTo = 0; try { solvedUpTo = Math.max(0, Math.min(LV.length, Number(localStorage.getItem(KEY)) || 0)); } catch (e) {}
      const mat = (k, c, em, o = {}) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(.05, .05, .05); if (em) m.emissiveColor = new B.Color3(...em); if (o.flat) m.disableLighting = true; if (o.alpha != null) m.alpha = o.alpha; return m; });
      const asphaltM = mat('asphalt', [.18, .18, .2], [.05, .05, .055]), lineM = mat('line', [.92, .92, .9], [.5, .5, .48], { flat: true }), curbM = mat('curb', [.62, .6, .58], [.12, .12, .11]);
      const exitM = mat('exit', [.95, .78, .2], [.8, .6, .1], { flat: true }), selM = mat('sel', [1, .85, .35], [1, .78, .25], { flat: true, alpha: .85 }), dotM = mat('dot', [1, .9, .5], [.8, .7, .3], { flat: true, alpha: .55 });
      const nodes = [], keep = n => { n.parent = n.parent || ctx.frame; ctx.add(n); nodes.push(n); if (n.isPickable !== undefined) n.isPickable = false; return n; };
      const cellPos = (x, y) => new V3(AT[0] + (x - (N - 1) / 2) * CELL, 0, AT[1] + ((N - 1) / 2 - y) * CELL);
      // the lot: asphalt with painted squares, a curb round it with a gap at the right end of row 2 and EXIT marks
      { const lot = keep(B.MeshBuilder.CreateBox('valetLot', { width: N * CELL, height: .08, depth: N * CELL }, scene)); lot.material = asphaltM; lot.position.set(AT[0], .04, AT[1]); lot.isPickable = true; lot.metadata = { valetLot: true };
        for (let k = 0; k <= N; k++) { const a = keep(B.MeshBuilder.CreateBox('valetLine', { width: N * CELL, height: .01, depth: .05 }, scene)); a.material = lineM; a.position.set(AT[0], .085, AT[1] + (k - N / 2) * CELL);
          const b = keep(B.MeshBuilder.CreateBox('valetLine', { width: .05, height: .01, depth: N * CELL }, scene)); b.material = lineM; b.position.set(AT[0] + (k - N / 2) * CELL, .085, AT[1]); }
        for (let i = -1; i <= N; i++) for (const [x, y] of [[i, -1], [i, N], [-1, i], [N, i]]) { if (x === N && y === 2) continue; if ((x === -1 || x === N) && (y < 0 || y >= N)) continue; const c = keep(B.MeshBuilder.CreateBox('valetCurb', { width: CELL, height: .22, depth: CELL }, scene)); c.material = curbM; const p = cellPos(x, y); c.position.set(p.x, .11, p.z); }
        for (const [x, y] of [[-1, -1], [N, -1], [-1, N], [N, N]]) { const c = keep(B.MeshBuilder.CreateBox('valetCurb', { width: CELL, height: .22, depth: CELL }, scene)); c.material = curbM; const p = cellPos(x, y); c.position.set(p.x, .11, p.z); }
        for (let k = 0; k < 3; k++) { const a = keep(B.MeshBuilder.CreateDisc('valetExit', { radius: CELL * .22, tessellation: 3 }, scene)); a.material = exitM; const p = cellPos(N + .2 + k * .45, 2); a.position.set(p.x, .1, p.z); a.rotation.x = Math.PI / 2; a.rotation.y = Math.PI / 2; } }
      const sel = keep(B.MeshBuilder.CreateBox('valetSel', { width: 1, height: .03, depth: 1 }, scene)); sel.material = selM; sel.setEnabled(false);
      let board = null; // { k, cars: [{ x, y, len, h, node }], sel, moves, hist[], lastCar, dots[] }
      const st = { phase: 'pick', anim: null, wait: 0 };
      const carCenter = c => { const a = cellPos(c.h ? c.x : c.x, c.h ? c.y : c.y), b = cellPos(c.h ? c.x + c.len - 1 : c.x, c.h ? c.y : c.y + c.len - 1); return V3.Lerp(a, b, .5); };
      function grid(skip) { const g = new Int8Array(N * N).fill(-1); board.cars.forEach((c, k) => { if (k === skip) return; for (let i = 0; i < c.len; i++) { const x = c.h ? c.x + i : c.x, y = c.h ? c.y : c.y + i; g[y * N + x] = k; } }); return g; }
      function placeCar(c, k) { const p = carCenter(c); c.node.position.set(p.x, .09, p.z); c.node.rotation.y = c.h ? 0 : Math.PI / 2; const s = .35; c.node.scaling.set((c.len * CELL * .9) / 7.6, s, s); }
      function build(k) {
        if (board) { board.cars.forEach(c => { try { c.node.dispose(); } catch (e) {} }); board.dots.forEach(d => d.dispose()); } // a restart leaves no old dots behind
        board = { k, cars: LV[k].cars.map(c => ({ ...c })), sel: 0, moves: 0, hist: [], lastCar: -1, dots: [] };
        board.cars.forEach((c, i) => { c.node = ctx.kit(i === 0 ? 'sl_car_purple' : PAINT[(i * 3 + k) % PAINT.length]); c.node.getChildMeshes(false).forEach(m => { m.isPickable = true; m.metadata = { ...(m.metadata || {}), valetCar: i }; }); placeCar(c, i); });
        ctx.player.place(AT[0] - CELL * 4.3, AT[1] - CELL * 3.6, Math.PI / 4);
        // a little farther and aimed nearer: the near curb clears the hint bar (it sat under it), the far one the title bar
        st.cam = [AT[0], N * CELL * 1.31 + 3.36, AT[1] - N * CELL * .905 - 2.42]; st.at = [AT[0] + .4, 0, AT[1] - N * CELL * .17];
        select(0); info();
      }
      function select(i) { if (!board || i < 0 || i >= board.cars.length) return; board.sel = i; const c = board.cars[i], p = carCenter(c); sel.setEnabled(true); sel.position.set(p.x, .1, p.z); sel.scaling.set(c.h ? c.len * CELL : CELL * .96, 1, c.h ? CELL * .96 : c.len * CELL); dots(); }
      function dots() { board.dots.forEach(d => d.dispose()); board.dots = []; const c = board.cars[board.sel]; reach(board.sel).forEach(p => { const d = B.MeshBuilder.CreateDisc('valetDot', { radius: CELL * .14, tessellation: 12 }, scene); d.material = dotM; d.parent = ctx.frame; ctx.add(d); d.rotation.x = Math.PI / 2; const q = cellPos(c.h ? (p > c.x ? p + c.len - 1 : p) : c.x, c.h ? c.y : (p > c.y ? p + c.len - 1 : p)); d.position.set(q.x, .1, q.z); d.isPickable = false; board.dots.push(d); }); }
      // the positions the selected car can roll to (its start square along its line)
      function reach(i) { const c = board.cars[i], g = grid(i), out = []; for (const dir of [-1, 1]) for (let p = (c.h ? c.x : c.y) + dir; ; p += dir) { const lo = p, hi = p + c.len - 1; if (lo < 0 || hi >= N) break; const cell = dir < 0 ? lo : hi, x = c.h ? cell : c.x, y = c.h ? c.y : cell; if (g[y * N + x] >= 0) break; out.push(p); } return out; }
      const info = () => H.info(board ? `Lot ${board.k + 1} / ${LV.length} · moves ${board.moves} · fewest ${LV[board.k].best}` : 'Pick a lot');
      function slide(i, p) {
        if (st.phase !== 'play' || st.anim) return false; const c = board.cars[i]; if (!reach(i).includes(p)) return false;
        board.hist.push({ i, from: c.h ? c.x : c.y, moves: board.moves, last: board.lastCar });
        if (board.lastCar !== i) { board.moves++; board.lastCar = i; }
        const from = carCenter(c); if (c.h) c.x = p; else c.y = p; const to = carCenter(c);
        st.anim = { c, i, from, to, t: 0 }; ctx.sound('thock'); info(); return true;
      }
      function step(dx, dy) { if (!board) return; const c = board.cars[board.sel]; if (c.h ? dy : dx) return; slide(board.sel, (c.h ? c.x : c.y) + (c.h ? dx : dy)); }
      function undo() { if (st.phase !== 'play' || st.anim || !board.hist.length) return; const h = board.hist.pop(), c = board.cars[h.i]; if (c.h) c.x = h.from; else c.y = h.from; board.moves = h.moves; board.lastCar = h.last; placeCar(c, h.i); select(h.i); info(); }
      function restart() { if (st.phase !== 'play') return; st.anim = null; build(board.k); H.msg('Again', 600); } // a car still rolling is parked back too
      function done() { const c = board.cars[0]; return c.x + c.len - 1 === N - 1; }
      const hud = document.getElementById('gameHud');
      const pick = document.createElement('div');
      pick.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(' + (LV.length > 6 && innerWidth >= 600 ? 560 : 390) + 'px,92vw);background:rgba(14,10,22,.94);border:1px solid rgba(180,120,255,.6);border-radius:14px;padding:16px;text-align:center;pointer-events:auto;font:15px/1.4 system-ui,sans-serif;color:#eee';
      const drawPick = () => { pick.innerHTML = `<div style="font:800 13px/1.2 system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#c79bff;margin-bottom:10px">Valet Parking</div><div style="margin-bottom:12px;color:#bbb">Get the purple lowrider out through the gap on the right.</div>`
        + `<div style="display:grid;grid-template-columns:repeat(${LV.length > 6 && innerWidth >= 600 ? 5 : 4},1fr);gap:8px">${LV.map((L, k) => { const open = k <= solvedUpTo, ok = k < solvedUpTo; return `<button type="button" data-k="${k}" ${open ? '' : 'disabled'} style="padding:8px 2px;border-radius:9px;border:1px solid ${open ? '#c79bff' : '#444'};background:${ok ? 'rgba(199,155,255,.25)' : 'rgba(255,255,255,.04)'};color:${open ? '#fff' : '#666'};font:700 15px system-ui,sans-serif;cursor:${open ? 'pointer' : 'default'}">${open ? `${k + 1}<div style="font:11px system-ui;opacity:.75">${L.best} moves</div>` : '🔒'}${ok ? ' ✓' : ''}</button>`; }).join('')}</div>`;
        pick.querySelectorAll('button[data-k]').forEach(b => b.onclick = (e) => { e.stopPropagation(); b.blur(); choose(+b.dataset.k); }); };
      function choose(k) { if (st.phase !== 'pick' || k > solvedUpTo || k >= LV.length) return; pick.remove(); st.phase = 'play'; build(k); pads.style.display = 'grid'; H.msg(`Lot ${k + 1}`, 900, k >= 4 ? 'a hard one' : ''); }
      const pads = document.createElement('div');
      pads.style.cssText = 'position:absolute;bottom:62px;right:16px;display:none;grid-template-columns:repeat(3,46px);grid-template-rows:repeat(3,40px);gap:5px;pointer-events:auto';
      const pad = (t, area, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.style.cssText = `grid-area:${area};border-radius:8px;border:1px solid #9b6be0;background:rgba(18,12,28,.82);color:#efe2ff;font:700 16px system-ui;cursor:pointer`; b.onclick = (e) => { e.stopPropagation(); b.blur(); fn(); }; pads.appendChild(b); };
      pad('↑', '1 / 2', () => step(0, -1)); pad('←', '2 / 1', () => step(-1, 0)); pad('→', '2 / 3', () => step(1, 0)); pad('↓', '3 / 2', () => step(0, 1)); pad('⇥', '2 / 2', () => select((board.sel + 1) % board.cars.length)); pad('↶', '1 / 1', undo); pad('⟲', '1 / 3', restart);
      hud.append(pick, pads);
      drawPick();
      st.cam = [AT[0], 11.5, AT[1] - 9.5]; st.at = [AT[0], 0, AT[1]];
      ctx.look(st.cam, st.at, def.fov || .8);
      H.title(def.title || 'Valet Parking'); H.score(''); info();
      H.hint('Click a car (or <kbd>Tab</kbd>), then the arrows or a glowing dot to roll it. <kbd>U</kbd> undo, <kbd>R</kbd> start again.');
      return {
        update(dt) {
          ctx.look(st.cam, st.at);
          const a = st.anim;
          if (a) { a.t += dt / .22; const u = Math.min(1, a.t), e = u * u * (3 - 2 * u); const p = V3.Lerp(a.from, a.to, e); a.c.node.position.x = p.x; a.c.node.position.z = p.z;
            if (u >= 1) { st.anim = null; select(a.i);
              if (done()) { st.phase = 'out'; st.t = 0; sel.setEnabled(false); board.dots.forEach(d => d.dispose()); board.dots = []; ctx.sound('gamewin'); H.msg('Out!', 1200, `${board.moves} moves`); pads.style.display = 'none';
                if (board.k + 1 > solvedUpTo) { solvedUpTo = board.k + 1; try { localStorage.setItem(KEY, String(solvedUpTo)); } catch (e) {} } } } }
          if (st.phase === 'out') { st.t += dt; const c = board.cars[0]; c.node.position.x += dt * Math.min(9, st.t * 9); if (st.t > 1.4) {
            st.phase = 'done'; H.hint(''); const k = board.k, best = LV[k].best, score = (k + 1) * 20 + (board.moves <= best ? 10 : 0);
            ctx.finish({ score, label: 'points', solved: true, extra: `Lot ${k + 1} cleared in ${board.moves} moves (the fewest is ${best}).${k + 1 < LV.length ? ` Lot ${k + 2} is open.` : ' Every lot cleared.'}` }); } }
        },
        key(e, down) {
          if (!down || e.repeat) return; const k = e.key.toLowerCase();
          if (st.phase === 'pick') { const n = k === '0' ? 10 : parseInt(k, 10); if (n >= 1 && n <= LV.length) choose(n - 1); return; } // 1-9, 0 = the tenth
          if (k === 'arrowup' || k === 'w') step(0, -1); else if (k === 'arrowdown' || k === 's') step(0, 1); else if (k === 'arrowleft' || k === 'a') step(-1, 0); else if (k === 'arrowright' || k === 'd') step(1, 0);
          else if (k === 'tab') { e.preventDefault?.(); select((board.sel + 1) % board.cars.length); } else if (k === 'u' || k === 'z' || k === 'backspace') undo(); else if (k === 'r') restart();
        },
        pointer(evt) {
          if (evt.type !== B.PointerEventTypes.POINTERDOWN || st.phase !== 'play' || st.anim) return;
          const hit = scene.pickWithRay(ctx.ray(), m => m.metadata?.valetCar != null || m.metadata?.valetLot); if (!hit?.pickedMesh) return;
          const ci = hit.pickedMesh.metadata?.valetCar; if (ci != null) { select(ci); return; }
          const l = ctx.toLocal(hit.pickedPoint), x = Math.round((l.x - AT[0]) / CELL + (N - 1) / 2), y = Math.round((N - 1) / 2 - (l.z - AT[1]) / CELL), c = board.cars[board.sel];
          if (c.h && y === c.y) { const p = x > c.x ? x - c.len + 1 : x; slide(board.sel, p); } else if (!c.h && x === c.x) { const p = y > c.y ? y - c.len + 1 : y; slide(board.sel, p); }
        },
        restart,
        _test: { st, slide, select, step, undo, choose, reach, get board() { return board; }, LV, N },
        dispose() { pick.remove(); pads.remove(); if (board) { board.cars.forEach(c => { try { c.node.dispose(); } catch (e) {} }); board.dots.forEach(d => { try { d.dispose(); } catch (e) {} }); } nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); }
      };
    }
  };
  window.RebelGames.register('valet', G);
})();
