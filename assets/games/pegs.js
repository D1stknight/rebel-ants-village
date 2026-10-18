// The Hermit's Pegs (Oct 15, Yamabushi): spirit stones on the hermit's cross-shaped board. A stone jumps over a
// stone beside it (up, down, left or right) into an empty hole two away, and the stone it jumps leaves the board.
// Clear the board until one stone is left, in the gold hole. Click a stone, then a glowing hole; U undoes, R starts
// again, H finds a good jump (no clean bonus then). Seven boards, from six stones to the full 32-stone solitaire
// (each checked by a solver). Score: the board x 20, +10 without a hint.
// Oct 17: How to play (the rules + a picked stone and its two jumps, howto/pegs.png); the HUD's Restart is R (now also
// mid-jump: the jump is dropped).
// Oct 17 (Miguel: "make this one 10 boards"): boards 8-10 go past the full board: The Far Corner (the full cross,
// corner to far corner) and two on the French board (37 holes: the corners between the arms filled in, 36 stones; only
// starts the colour classes allow). Their ways come from a beam search (scratchpad lv/pegs/beam.mjs), checked jump by
// jump (lv/pegs/ways.mjs, verify10.mjs); the plain search cannot find them in time, so such a level carries its way:
// H reads the next jump off a known way at once (the level's, or one an earlier H found), else searches as before
// (1.5 s cap; positions as numbers now, its dead ends kept for the next press, the way's own jumps tried first, and it
// stops where it meets a known way) and, when time runs out, says how many jumps back H knows the way again.
// lv/pegs/verify10.mjs presses H from the start of every board to one stone in the gold hole.
// def: { levels: [{ name, rows?: [board shape], pegs: [[x, y], ...] | 'full', empty?: [x, y], goal: [x, y], way?: 'fxfytxty ...' }], pass, points }
(function () {
  const ROWS = ['..ooo..', '..ooo..', 'ooooooo', 'ooooooo', 'ooooooo', '..ooo..', '..ooo..'];
  const FRENCH = ['..ooo..', '.ooooo.', 'ooooooo', 'ooooooo', 'ooooooo', '.ooooo.', '..ooo..'];
  const LEVELS = [
    { name: 'The Cross', pegs: [[3, 1], [2, 2], [3, 2], [4, 2], [3, 3], [3, 4]], goal: [3, 3] },
    { name: 'The Plus', pegs: [[3, 1], [3, 2], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [3, 4], [3, 5]], goal: [3, 3] },
    { name: 'The Lantern', pegs: [[3, 0], [2, 1], [3, 1], [4, 1], [3, 3], [4, 3], [1, 4], [3, 4], [4, 4], [2, 5], [4, 5], [2, 6], [3, 6]], goal: [3, 3] },
    { name: 'The Falls', pegs: [[2, 0], [3, 0], [3, 1], [0, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [2, 3], [4, 3], [5, 3], [6, 3], [1, 4], [2, 4], [3, 4], [4, 4], [2, 6]], goal: [3, 3] },
    { name: 'The Mountain', pegs: [[2, 0], [3, 0], [2, 1], [3, 1], [0, 2], [1, 2], [3, 2], [4, 2], [5, 2], [0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [0, 4], [2, 4], [4, 4], [5, 4], [2, 5], [3, 5], [2, 6], [3, 6]], goal: [3, 3] },
    { name: "The Hermit's Board", pegs: 'full', empty: [3, 3], goal: [3, 3] },
    { name: 'The Last Stone', pegs: 'full', empty: [3, 1], goal: [3, 4] },
    { name: 'The Far Corner', pegs: 'full', empty: [2, 0], goal: [2, 6], note: 'from one corner of the cross to the far one',
      way: '4020 4240 6242 3252 6462 6242 4341 1232 2022 3212 0222 2321 0323 4543 4042 5452 5232 2422 4323 2624 2325 0424 2123 3133 2545 3335 2325 3634 4644 4424 2426' },
    { name: 'The French Board', rows: FRENCH, pegs: 'full', empty: [3, 1], goal: [3, 5], note: 'four more holes: 36 stones',
      way: '5131 4341 6242 3252 3032 1131 2321 2022 4042 2523 2321 0222 2141 4143 4525 4345 6444 2242 0323 5535 6343 4345 2624 2325 0424 5232 2444 3234 4626 4424 2523 4525 2624 2325 1535' },
    { name: 'Corner to Corner', rows: FRENCH, pegs: 'full', empty: [2, 0], goal: [4, 6], note: 'the French board, corner to far corner',
      way: '4020 3230 1131 2321 2523 0424 3414 0222 2224 0323 3032 2022 5131 2321 2141 4525 4345 4143 1434 6444 3454 6264 4644 4345 6444 3234 5254 1535 2646 3436 5434 5535 4626 3436 2646' }
  ];
  // a board's holes and its jumps [from, over, to], one shape per pattern of rows (the hermit's cross unless a level says)
  const SHAPES = new Map();
  function shapeOf(rows = ROWS) {
    const k = rows.join('/'); if (SHAPES.has(k)) return SHAPES.get(k);
    const HOLES = []; rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === 'o') HOLES.push([x, y]); }));
    const IDX = new Map(HOLES.map(([x, y], i) => [x + ',' + y, i]));
    const MOVES = []; HOLES.forEach(([x, y], i) => { for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const o = IDX.get((x + dx) + ',' + (y + dy)), t = IDX.get((x + 2 * dx) + ',' + (y + 2 * dy)); if (o != null && t != null) MOVES.push([i, o, t]); } });
    const S = { rows, HOLES, IDX, MOVES }; SHAPES.set(k, S); return S;
  }
  const MOVES = shapeOf(ROWS).MOVES; // the cross's jumps: the search's default
  // a position as a number, a bit per hole (exact up to 53 holes)
  const P2 = Array.from({ length: 53 }, (_, i) => 2 ** i), keyOf = p => { let k = 0; for (let i = 0; i < p.length; i++) if (p[i]) k += P2[i]; return k; };
  // depth-first search with dead positions remembered (pass the board's own set and a later search starts wiser): a way
  // to one stone on the goal as its jumps, 'slow' when the time is up, or null when there is none. known (a Map of
  // positions already on a way) ends the search where it meets one: the way returned then stops there.
  function findWay(pegs, goal, ms = 1500, moves = MOVES, dead = new Set(), known = null) {
    const t0 = performance.now(), p = pegs.slice(), way = []; let k = keyOf(p), left = p.filter(Boolean).length, nodes = 0, timeUp = false;
    const rec = () => { if (left === 1) return !!p[goal]; if (known && way.length && known.has(k)) return true; if (dead.has(k)) return false; if ((++nodes & 255) === 0 && performance.now() - t0 > ms) { timeUp = true; return false; }
      for (const m of moves) { const [f, o, t] = m; if (p[f] && p[o] && !p[t]) { p[f] = p[o] = false; p[t] = true; const k0 = k; k = k - P2[f] - P2[o] + P2[t]; left--; way.push(m);
        if (rec()) return true; way.pop(); left++; k = k0; p[f] = p[o] = true; p[t] = false; if (timeUp) return false; } }
      dead.add(k); return false; };
    return rec() ? way : timeUp ? 'slow' : null;
  }
  // the first jump of such a way (or 'slow' / null)
  function firstJump(pegs, goal, ms = 1500, moves = MOVES, dead) { const w = findWay(pegs, goal, ms, moves, dead); return Array.isArray(w) ? w[0] : w; }
  const G = {
    title: "The Hermit's Pegs",
    howTo: { lines: [
      'A stone jumps over a stone right beside it (up, down, left or right, never diagonally) into the empty hole just behind; the stone it jumped over leaves the board.',
      'Keep jumping until only one stone is left, and it must end in the hole with the gold ring.',
      'Click a stone to pick it up: the holes it can jump to glow. Then click a glowing hole. Click the stone again to put it down.',
      'U (↶ Undo) takes back a jump, R (⟲ or Restart) starts the board again.',
      'H (Hint) lifts a stone whose jump still leads to a win, but costs the +10 for a board cleared without hints. On the big boards it may ask you to undo a jump or two first.',
      'Boards 9 and 10 are the French board: four more holes, in the corners between the arms.',
      'Tip: keep the stones together and clear the far arms early. A stone left far from the others can only leave once another stone comes beside it.'],
      img: 'howto/pegs.png', caption: 'A stone picked: its two holes glow. The jump left over its neighbour (red ring: it leaves the board) still ends with one stone in the gold hole; the jump down does not.' },
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const LV = def.levels || LEVELS, KEY = 'rebelAntsPegsProgress:' + (def.id || 'pegs');
      let solvedUpTo = 0; try { solvedUpTo = Math.max(0, Math.min(LV.length, Number(localStorage.getItem(KEY)) || 0)); } catch (e) {}
      const mat = (k, c, em, o = {}) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(...(o.spec || [.08, .08, .08])); if (o.power) m.specularPower = o.power; if (em) m.emissiveColor = new B.Color3(...em); if (o.alpha != null) m.alpha = o.alpha; return m; });
      const rockM = mat('rock', [.34, .38, .4], [.07, .08, .09]), holeM = mat('hole', [.08, .09, .1], [.01, .01, .02]), goalM = mat('goal', [.85, .68, .25], [.45, .33, .08]);
      const stoneM = mat('stone', [.42, .7, .95], [.12, .32, .55], { spec: [.6, .7, .8], power: 50 }), pickM = mat('picked', [.8, .95, 1], [.5, .75, 1]), glowM = mat('glow', [.45, .85, 1], [.3, .7, 1], { alpha: .55 });
      const nodes = [], keep = n => { n.parent = n.parent || ctx.frame; ctx.add(n); nodes.push(n); if (n.isPickable !== undefined) n.isPickable = false; return n; };
      let S = shapeOf(ROWS); // the board in play: its holes and jumps
      const SP = .42, TY = .55, pos = i => { const [x, y] = S.HOLES[i]; return new V3((x - 3) * SP, TY + .02, (3 - y) * SP); };
      // the board: a weathered round stone with 33 holes (37 on the French board); the stones are polished blue spirit pebbles
      { const slab = keep(B.MeshBuilder.CreateCylinder('pgSlab', { height: TY, diameterTop: 3.45, diameterBottom: 3.8, tessellation: 40 }, scene)); slab.material = rockM; slab.position.y = TY / 2; }
      let holes = [];
      function makeHoles() { holes.forEach(h => h.dispose()); holes = S.HOLES.map((_, i) => { const h = B.MeshBuilder.CreateDisc('pgHole', { radius: .12, tessellation: 18 }, scene); h.parent = ctx.frame; ctx.add(h); h.material = holeM; h.rotation.x = Math.PI / 2; h.position.copyFrom(pos(i)); h.position.y = TY + .004; h.isPickable = true; h.metadata = { pgHole: i }; return h; }); }
      makeHoles();
      const goalRing = keep(B.MeshBuilder.CreateTorus('pgGoal', { diameter: .3, thickness: .035, tessellation: 24 }, scene)); goalRing.material = goalM;
      const glowSrc = keep(B.MeshBuilder.CreateCylinder('pgGlow', { height: .02, diameter: .27, tessellation: 18 }, scene)); glowSrc.material = glowM; glowSrc.isVisible = false;
      let glows = [];
      const stoneSrc = keep(B.MeshBuilder.CreateSphere('pgStoneSrc', { diameterX: .27, diameterY: .17, diameterZ: .27, segments: 10 }, scene)); stoneSrc.material = stoneM; stoneSrc.isVisible = false;
      let bd = null; // { k, pegs[] bools, stones[] mesh|null, goal, sel, hist[], hints, dead (Set), wayAt (Map: position -> next jump) }
      const st = { phase: 'pick', t: 0, anim: null };
      function build(k) {
        if (bd) bd.stones.forEach(s => s && s.dispose());
        const L = LV[k], S2 = shapeOf(L.rows); if (S2 !== S) { S = S2; makeHoles(); }
        const pegs = S.HOLES.map(() => false), mem = bd && bd.k === k ? { dead: bd.dead, wayAt: bd.wayAt } : { dead: new Set(), wayAt: new Map() }; // R keeps what H has learnt
        if (L.pegs === 'full') { pegs.fill(true); pegs[S.IDX.get(L.empty.join(','))] = false; } else L.pegs.forEach(([x, y]) => { pegs[S.IDX.get(x + ',' + y)] = true; });
        bd = { k, pegs, goal: S.IDX.get(L.goal.join(',')), sel: -1, hist: [], hints: 0, stones: S.HOLES.map(() => null), ...mem };
        if (L.way && !bd.wayAt.size) learn(L.way.split(' ').map(g => { const [a, b, c, d] = [...g].map(Number); return S.MOVES.find(m => m[0] === S.IDX.get(a + ',' + b) && m[2] === S.IDX.get(c + ',' + d)); }));
        const onWay = new Set(bd.wayAt.values()); bd.order = S.MOVES.filter(m => onWay.has(m)).concat(S.MOVES.filter(m => !onWay.has(m))); // the way's own jumps tried first
        pegs.forEach((p, i) => { if (p) bd.stones[i] = makeStone(i); });
        goalRing.position.copyFrom(pos(bd.goal)); goalRing.position.y = TY + .01; ctx.player.place(0, 2.5, Math.PI); select(-1); info();
      }
      function makeStone(i) { const s = stoneSrc.createInstance('pgStone'); s.parent = ctx.frame; ctx.add(s); s.position.copyFrom(pos(i)); s.position.y = TY + .07; s.isPickable = true; s.metadata = { pgStone: i }; return s; }
      const left = () => bd.pegs.filter(Boolean).length;
      const info = () => H.info(bd ? `Board ${bd.k + 1} / ${LV.length} · ${LV[bd.k].name} · stones left ${left()}${bd.hints ? ` · hints ${bd.hints}` : ''}` : 'Pick a board');
      const jumpsFrom = i => S.MOVES.filter(([f, o, t]) => f === i && bd.pegs[o] && !bd.pegs[t]);
      // a way to the goal from the board as it stands (the level's own, or one H found): each position on it -> its next jump
      function learn(way) { const p = bd.pegs.slice(); for (const m of way) { if (!m || !p[m[0]] || !p[m[1]] || p[m[2]]) break; bd.wayAt.set(keyOf(p), m); p[m[0]] = p[m[1]] = false; p[m[2]] = true; } }
      // how many jumps back (U) the board was on a known way, 0 if never
      function stepsBack() { const p = bd.pegs.slice(); for (let j = bd.hist.length - 1, n = 1; j >= 0; j--, n++) { const { f, o, t } = bd.hist[j]; p[f] = p[o] = true; p[t] = false; if (bd.wayAt.has(keyOf(p))) return n; } return 0; }
      function select(i) { glows.forEach(g => g.dispose()); glows = []; if (bd && bd.sel >= 0 && bd.stones[bd.sel]) bd.stones[bd.sel].position.y = TY + .07;
        if (!bd) return; bd.sel = i; if (i < 0) return; const js = jumpsFrom(i); js.forEach(([, , t]) => { const g = glowSrc.createInstance('pgGlowI'); g.parent = ctx.frame; ctx.add(g); g.position.copyFrom(pos(t)); g.position.y = TY + .015; glows.push(g); }); }
      function jump(f, o, t) {
        if (st.phase !== 'play' || st.anim || !bd.pegs[f] || !bd.pegs[o] || bd.pegs[t] || !S.MOVES.some(m => m[0] === f && m[1] === o && m[2] === t)) return false;
        bd.hist.push({ f, o, t }); bd.pegs[f] = false; bd.pegs[o] = false; bd.pegs[t] = true; const s = bd.stones[f], gone = bd.stones[o]; bd.stones[t] = s; bd.stones[f] = null; bd.stones[o] = null; s.metadata.pgStone = t;
        select(-1); st.anim = { s, gone, from: pos(f), to: pos(t), t: 0 }; ctx.note(520 + left() * 14, 'bell'); info(); return true;
      }
      function settle() {
        if (left() === 1) { const won = bd.pegs[bd.goal]; if (won) { st.phase = 'won'; st.wt = 0; ctx.sound('gamewin'); H.msg('One stone, in the gold hole', 1600); pads.style.display = 'none'; if (bd.k + 1 > solvedUpTo) { solvedUpTo = bd.k + 1; try { localStorage.setItem(KEY, String(solvedUpTo)); } catch (e) {} } }
          else H.msg('One stone, but not in the gold hole', 1800, 'U undoes, R starts again'); return; }
        if (!S.MOVES.some(([f, o, t]) => bd.pegs[f] && bd.pegs[o] && !bd.pegs[t])) H.msg('No jumps left', 1800, `${left()} stones: U undoes, R starts again`);
      }
      function undo() { if (st.phase !== 'play' || st.anim || !bd?.hist.length) return; const { f, o, t } = bd.hist.pop(); bd.pegs[f] = true; bd.pegs[o] = true; bd.pegs[t] = false; const s = bd.stones[t]; bd.stones[f] = s; bd.stones[t] = null; s.metadata.pgStone = f; s.position.copyFrom(pos(f)); s.position.y = TY + .07; bd.stones[o] = makeStone(o); select(-1); info(); }
      function restart() { if (st.phase !== 'play' || !bd) return; if (st.anim) { st.anim.gone?.dispose(); st.anim = null; } build(bd.k); H.msg('Again', 600); } // a jump in the air is dropped (its taken stone is no longer on the board's list)
      function hint() { if (st.phase !== 'play' || st.anim) return;
        let r = bd.wayAt.get(keyOf(bd.pegs)); // on a known way: at once
        if (!r) { const w = findWay(bd.pegs, bd.goal, 1500, bd.order, bd.dead, bd.wayAt); if (Array.isArray(w)) { learn(w); r = w[0]; } else r = w; } // back onto a known way, or to the end
        if (!r || r === 'slow') { const n = stepsBack(); H.msg(r ? 'Too many paths to see from here' : 'No way to one stone from here', 1700, n ? `undo ${n} jump${n > 1 ? 's' : ''} and H knows the way again` : r ? 'undo a little, or try again' : 'U undoes, R starts again'); return; }
        bd.hints++; info(); select(r[0]); if (bd.stones[r[0]]) bd.stones[r[0]].position.y = TY + .2; H.msg('This stone', 1100, 'over its neighbour into the glowing hole'); bd.hintTo = r[2]; }
      function clickAt(i, isStone) {
        if (st.phase !== 'play' || st.anim || !bd) return;
        if (isStone || bd.pegs[i]) { if (bd.sel === i) { select(-1); return; } if (!jumpsFrom(i).length) { select(-1); H.msg('That stone cannot jump', 700); return; } select(i); bd.stones[i].position.y = TY + .2; ctx.note(700, 'lantern'); return; }
        if (bd.sel >= 0) { const m = S.MOVES.find(([f, , t]) => f === bd.sel && t === i); if (m && jump(...m)) return; H.msg('Not a jump', 600); }
      }
      const hud = document.getElementById('gameHud');
      const pick = document.createElement('div');
      pick.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(' + (LV.length > 6 && innerWidth >= 600 ? 560 : 400) + 'px,92vw);background:rgba(8,18,22,.95);border:1px solid rgba(110,200,240,.6);border-radius:14px;padding:16px;text-align:center;pointer-events:auto;font:15px/1.4 system-ui,sans-serif;color:#eee';
      const drawPick = () => { pick.innerHTML = `<div style="font:800 13px/1.2 system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#8fd8ff;margin-bottom:10px">The Hermit's Pegs</div><div style="margin-bottom:12px;color:#bbb">Jump stones until one is left, in the gold hole.</div>`
        + `<div style="display:grid;grid-template-columns:repeat(${LV.length > 6 && innerWidth >= 600 ? 5 : 4},1fr);gap:8px">${LV.map((L, k) => { const open = k <= solvedUpTo, ok = k < solvedUpTo, n = L.pegs === 'full' ? shapeOf(L.rows).HOLES.length - 1 : L.pegs.length; return `<button type="button" data-k="${k}" ${open ? '' : 'disabled'} style="padding:8px 2px;border-radius:9px;border:1px solid ${open ? '#8fd8ff' : '#444'};background:${ok ? 'rgba(143,216,255,.22)' : 'rgba(255,255,255,.04)'};color:${open ? '#fff' : '#666'};font:700 15px system-ui,sans-serif;cursor:${open ? 'pointer' : 'default'}">${open ? `${k + 1}<div style="font:11px system-ui;opacity:.75">${n} stones</div>` : '🔒'}${ok ? ' ✓' : ''}</button>`; }).join('')}</div>`;
        pick.querySelectorAll('button[data-k]').forEach(b => b.onclick = (e) => { e.stopPropagation(); b.blur(); choose(+b.dataset.k); }); };
      const pads = document.createElement('div');
      pads.style.cssText = 'position:absolute;bottom:62px;right:14px;display:none;gap:6px;pointer-events:auto';
      const padBtn = (t, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.style.cssText = 'min-width:52px;height:40px;padding:0 10px;border-radius:9px;border:1px solid #6fb8dc;background:rgba(8,18,24,.88);color:#e6f7ff;font:700 15px system-ui;cursor:pointer'; b.onclick = (e) => { e.stopPropagation(); b.blur(); fn(); }; pads.appendChild(b); return b; };
      padBtn('↶ Undo', undo); padBtn('Hint', hint); padBtn('⟲', restart);
      function choose(k) { if (st.phase !== 'pick' || k > solvedUpTo || k >= LV.length) return; pick.remove(); st.phase = 'play'; build(k); pads.style.display = 'flex'; H.msg(LV[k].name, 1200, LV[k].note || (k >= 5 ? 'the old hermit\'s own board' : '')); }
      hud.append(pick, pads); drawPick();
      const cam = [0, TY + 4.3, -3.5], at = [0, TY, .25];
      ctx.player.place(0, 2.5, Math.PI); ctx.look(cam, at, def.fov || .8);
      H.title(def.title || "The Hermit's Pegs"); H.score(''); info();
      H.hint('Click a stone, then a glowing hole: it jumps over its neighbour, which leaves the board. <kbd>U</kbd> undo, <kbd>R</kbd> start again, <kbd>H</kbd> hint.');
      return {
        update(dt) {
          ctx.look(cam, at); st.t += dt; if (!bd) return;
          glows.forEach((g, k) => { g.scaling.setAll(1 + Math.sin(st.t * 6 + k) * .08); });
          goalRing.rotation.y += dt * .6;
          const a = st.anim; if (a) { a.t += dt / .32; const u = Math.min(1, a.t); a.s.position.copyFrom(V3.Lerp(a.from, a.to, u)); a.s.position.y = TY + .07 + Math.sin(Math.PI * u) * .35; if (a.gone) a.gone.scaling.setAll(Math.max(.01, 1 - u));
            if (u >= 1) { if (a.gone) a.gone.dispose(); st.anim = null; settle(); } }
          if (st.phase === 'won' && (st.wt += dt) > 1.8) { st.phase = 'done'; H.hint(''); const k = bd.k;
            ctx.finish({ score: (k + 1) * 20 + (bd.hints ? 0 : 10), label: 'points', solved: true, extra: `${LV[k].name}: one stone left in the gold hole${bd.hints ? ` (${bd.hints} hint${bd.hints > 1 ? 's' : ''})` : ''}.${k + 1 < LV.length ? ` Board ${k + 2} is open.` : ' Every board cleared.'}` }); }
        },
        key(e, down) {
          if (!down || e.repeat) return; const k = e.key.toLowerCase();
          if (st.phase === 'pick') { const n = k === '0' ? 10 : parseInt(k, 10); if (n >= 1 && n <= LV.length) choose(n - 1); return; } // 1-9, 0 = the tenth
          if (k === 'u' || k === 'z' || k === 'backspace') undo(); else if (k === 'r') restart(); else if (k === 'h') hint();
        },
        pointer(evt) {
          if (evt.type !== B.PointerEventTypes.POINTERDOWN || st.phase !== 'play') return;
          const hit = scene.pickWithRay(ctx.ray(), m => m.metadata?.pgStone != null || m.metadata?.pgHole != null); if (!hit?.pickedMesh) { select(-1); return; }
          const md = hit.pickedMesh.metadata; if (md.pgStone != null) clickAt(md.pgStone, true); else clickAt(md.pgHole, false);
        },
        restart, // the HUD's Restart: the board as it was picked (no undo or hints)
        _test: { st, choose, jump, undo, restart, hint, clickAt, firstJump: (p, g, ms) => firstJump(p, g, ms, S.MOVES), findWay: (p, g, ms) => findWay(p, g, ms, S.MOVES), keyOf, get MOVES() { return S.MOVES; }, get HOLES() { return S.HOLES; }, get bd() { return bd; }, LV },
        dispose() { pick.remove(); pads.remove(); glows.forEach(g => { try { g.dispose(); } catch (e) {} }); holes.forEach(h => { try { h.dispose(); } catch (e) {} }); if (bd) bd.stones.forEach(s => { try { s?.dispose(); } catch (e) {} }); nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); }
      };
    }
  };
  window.RebelGames.register('pegs', G);
})();
