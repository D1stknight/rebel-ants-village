// The Silent Path (Oct 15, Ronin): a stealth puzzle on a dark stone board. Reach the scroll without being seen. The
// watchmen carry lanterns: a walking watchman steps along its beat each turn and looks the way it is going (at the end
// of the beat it turns back), a turning watchman stands still and turns every turn (the small arrow shows where it looks
// next), a still one watches one way. A lantern lights the squares in front of it (walls stop the light). Each step of
// the Rebel is one turn (Space waits a turn); after it the watchmen move. Stepping into light, or a watchman walking
// into you, and you are seen (the step is taken back). Step onto a watchman from behind or the side to take it out.
// U undoes a turn, R starts the level again. Seven levels, each opens when the one before is solved (kept on this
// device); every level was checked by a solver for its fewest turns. Score: the level x 20, +10 close to the fewest turns.
// Oct 17: How to play (the rules in a few lines) and Restart beside Quit; Restart and R now start the level as it was
// picked (the seen count too, which R used to carry over).
// Oct 17 (Miguel: "make it 10"): ten levels; 8-10 are 9 x 9 with six watchmen and 10 x 10 with seven (scratchpad
// lv/silent/gen10.mjs: random boards, then a hill climb on walls, the start / scroll and the watchmen while the fewest
// turns by the BFS grows to a target; past it, boards that need a takedown and a wait, with more states to get lost in,
// at least 13 % walls): fewest 28, 32 and 39 turns (level 7: 23); none can be done without a takedown in fewer than
// 33 turns; each checked again by a BFS on this file's own rules (lv/silent/verify.mjs), the way replayed turn by turn.
// def: { at: [x, z] (frame coords of the board's middle), cell: 1.2, levels, pass, points }
(function () {
  const LEVELS = [
    { rows: ['##S##', '##.##', '.....', '##.##', '##.##', '##@##'], guards: [{ p: [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2]], r: 1 }], best: 5 },
    { rows: ['S....', '.....', '...#.', '.##.#', '...#.', '.@##.'], guards: [{ p: [[0, 4], [0, 3], [0, 2], [0, 1]], r: 1 }], best: 11 },
    { rows: ['.....S', '......', '......', '.....#', '..#..#', '.#..@.'], guards: [{ p: [[1, 2], [1, 3], [1, 4]], r: 2 }, { at: [5, 2], f: 'W', r: 3 }], best: 13 },
    { rows: ['..#..S#', '.......', '##..#.#', '#..#...', '.......', '.......', '##...@#'], guards: [{ at: [3, 1], f: 'NESW', r: 3 }, { at: [5, 4], f: 'EW', r: 2 }, { at: [6, 4], f: 'WN', r: 3 }], best: 12 },
    { rows: ['#S......', '#..##..#', '.......#', '#..#....', '....#..#', '#...##..', '..#..#..', '..#@..#.'], guards: [{ at: [1, 3], f: 'NESW', r: 2 }, { p: [[5, 4], [6, 4]], r: 2 }, { at: [1, 1], f: 'ES', r: 2 }, { p: [[2, 2], [1, 2], [0, 2]], r: 2 }], best: 18 },
    { rows: ['.#...S..#', '....#....', '.#.#...##', '#..#...#.', '.#..#.#..', '.........', '..#....#.', '#......#.', '.....@#..'], guards: [{ p: [[4, 3], [4, 2]], r: 2 }, { at: [6, 3], f: 'WN', r: 2 }, { p: [[5, 5], [6, 5], [7, 5], [8, 5], [8, 6]], r: 2 }, { p: [[0, 6], [0, 5], [0, 4]], r: 2 }, { p: [[3, 8], [2, 8], [1, 8], [0, 8]], r: 1 }, { p: [[2, 4], [2, 3], [2, 2], [2, 1], [2, 0], [3, 0], [4, 0]], r: 2 }], best: 18 },
    { rows: ['S........', '...##..#.', '..#...#..', '##.......', '.#...#...', '..#...##.', '.........', '.#.......', '......@.#'], guards: [{ at: [6, 1], f: 'W', r: 4 }, { p: [[2, 4], [3, 4], [4, 4], [4, 5]], r: 1 }, { p: [[2, 0], [2, 1]], r: 2 }, { at: [8, 3], f: 'ES', r: 2 }, { p: [[8, 6], [8, 5], [8, 4]], r: 1 }], best: 23 },
    { rows: ['.S#......', '..#......', '.#..#....', '.#.....#.', '....#..#.', '....#.#..', '.....#.#.', '.........', '.......@.'], guards: [{ p: [[6, 2], [6, 3], [6, 4]], r: 2 }, { p: [[6, 7], [7, 7], [8, 7], [8, 8]], r: 1 }, { at: [4, 6], f: 'NS', r: 3 }, { at: [5, 4], f: 'EW', r: 3 }, { p: [[3, 5], [3, 4], [3, 3], [3, 2], [2, 2]], r: 2 }, { at: [7, 5], f: 'NWSE', r: 3 }], best: 28 },
    { rows: ['....#....S', '...#.###..', '.....#....', '.#.#.#....', '.#...#....', '..#...#...', '..#.#.....', '#.........', '..........', '..@.......'], guards: [{ p: [[1, 1], [2, 1]], r: 1 }, { p: [[8, 4], [8, 5], [8, 6], [8, 7], [7, 7]], r: 1 }, { p: [[1, 2], [0, 2]], r: 1 }, { at: [3, 6], f: 'S', r: 3 }, { at: [2, 2], f: 'NESW', r: 2 }, { at: [0, 6], f: 'S', r: 1 }, { p: [[4, 8], [4, 7], [3, 7], [2, 7]], r: 2 }], best: 32 },
    { rows: ['....#S.#..', '..........', '..........', '....#.....', '....#..#..', '........#.', '...##..#..', '....#...#.', '....#...#.', '@..#......'], guards: [{ p: [[6, 5], [5, 5], [4, 5], [3, 5], [3, 4]], r: 1 }, { at: [7, 1], f: 'SW', r: 2 }, { p: [[3, 1], [3, 0]], r: 1 }, { p: [[6, 2], [7, 2], [7, 3]], r: 2 }, { at: [1, 7], f: 'S', r: 1 }, { p: [[2, 5], [2, 4], [2, 3], [2, 2], [2, 1], [1, 1], [0, 1]], r: 1 }, { p: [[2, 7], [2, 6]], r: 1 }], best: 39 }
  ];
  // the rules (the same as the level checker's)
  const DIRS = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }, YAW = { N: 0, E: Math.PI / 2, S: Math.PI, W: -Math.PI / 2 };
  function parse(L) {
    const rows = L.rows, H = rows.length, W = Math.max(...rows.map(r => r.length)), wall = []; let start = 0, goal = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = rows[y][x] || '#'; wall[y * W + x] = c === '#'; if (c === '@') start = y * W + x; if (c === 'S') goal = y * W + x; }
    const guards = L.guards.map(g => {
      if (g.p && g.p.length > 1) return { seq: g.loop ? g.p.slice() : g.p.concat(g.p.slice(1, -1).reverse()), r: g.r ?? 2, kind: 'walk' };
      const fs = (g.f || 'S').split(''); return { at: g.at || g.p[0], fs, r: g.r ?? 2, kind: fs.length > 1 ? 'turn' : 'still' };
    });
    return { W, H, wall, start, goal, guards };
  }
  function guardAt(g, t) {
    if (g.kind === 'walk') { const n = g.seq.length, a = g.seq[t % n], b = g.seq[(t + 1) % n], dx = Math.sign(b[0] - a[0]), dy = Math.sign(b[1] - a[1]); return { x: a[0], y: a[1], f: dx > 0 ? 'E' : dx < 0 ? 'W' : dy > 0 ? 'S' : 'N' }; }
    return { x: g.at[0], y: g.at[1], f: g.fs[t % g.fs.length] };
  }
  function litCells(B, t, alive) {
    const s = new Set();
    B.guards.forEach((g, k) => { if (!(alive >> k & 1)) return; const a = guardAt(g, t), [dx, dy] = DIRS[a.f];
      for (let i = 1; i <= g.r; i++) { const x = a.x + dx * i, y = a.y + dy * i; if (x < 0 || y < 0 || x >= B.W || y >= B.H || B.wall[y * B.W + x]) break; s.add(y * B.W + x); } });
    return s;
  }
  function turn(B, p, t, alive, mv) {
    const x = p % B.W + mv[0], y = Math.floor(p / B.W) + mv[1];
    if (x < 0 || y < 0 || x >= B.W || y >= B.H || B.wall[y * B.W + x]) return null;
    const q = y * B.W + x; let took = -1;
    B.guards.forEach((g, k) => { if (alive >> k & 1) { const a = guardAt(g, t); if (a.y * B.W + a.x === q && (mv[0] || mv[1])) took = k; } });
    if (took >= 0) alive &= ~(1 << took);
    if (litCells(B, t, alive).has(q)) return { p: q, alive, seen: true, took, by: 'light' };
    if (q === B.goal) return { p: q, alive, won: true, took };
    for (let k = 0; k < B.guards.length; k++) if (alive >> k & 1) { const a = guardAt(B.guards[k], t + 1); if (a.y * B.W + a.x === q) return { p: q, alive, seen: true, took, by: 'walk' }; }
    if (litCells(B, t + 1, alive).has(q)) return { p: q, alive, seen: true, took, by: 'light' };
    return { p: q, alive, took };
  }
  const G = {
    title: 'The Silent Path',
    howTo: { lines: [
      'Reach the scroll without being seen.',
      'Every step you take is one turn; Space (or the · pad) waits a turn. After each turn the watchmen move: a walker steps along its beat and back, a turner turns on the spot (the small arrow shows where it looks next), a still one keeps watching one way.',
      'Each lantern lights the squares in front of its watchman (walls stop the light). Step into a lit square, stand in one after the watchmen move, or let a watchman walk into you, and you are seen: the step is taken back.',
      'Step onto a watchman from behind or from the side to take him out: his lantern goes out with him.',
      'Move with the arrows / W A S D or the pads. U (or ↶) undoes a turn, R (or ⟲, or Restart) starts the level again.',
      'The fewest turns is shown at the top: reach the scroll within a quarter more for 10 more points.',
      'Tip: watch a beat go round once before you move; waiting a turn is often the way through.'],
      img: 'howto/silent.png', caption: 'The fewest way, numbered: turn 1 takes the walker from behind. At turn 5 the turner faces the scroll, as he does now, so the Rebel waits, and takes it at 6.' },
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const LV = def.levels || LEVELS, CELL = def.cell || 1.2, AT = def.at || [0, 0];
      const KEY = 'rebelAntsSilentProgress:' + (def.id || 'silent');
      let solvedUpTo = 0; try { solvedUpTo = Math.max(0, Math.min(LV.length, Number(localStorage.getItem(KEY)) || 0)); } catch (e) {}
      const mat = (k, c, em, o = {}) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(.06, .06, .06); if (em) m.emissiveColor = new B.Color3(...em); if (o.flat) m.disableLighting = true; if (o.alpha != null) m.alpha = o.alpha; return m; });
      const floorM = mat('floor', [.2, .19, .21], [.07, .065, .075]), wallM = mat('wall', [.1, .09, .11], [.035, .03, .04]), litM = mat('lit', [1, .62, .22], [1, .55, .16], { flat: true, alpha: .42 });
      const robeM = mat('robe', [.1, .07, .08], [.035, .02, .025]), headM = mat('head', [.13, .11, .11], [.03, .025, .025]), hatM = mat('hat', [.3, .24, .14], [.07, .05, .03]);
      const visorM = mat('visor', [.9, .12, .1], [.95, .14, .1], { flat: true }), lampM = mat('lamp', [1, .7, .3], [1, .62, .25], { flat: true }), nextM = mat('next', [1, .65, .3], [.8, .45, .15], { flat: true, alpha: .55 });
      const scrollM = mat('scroll', [.92, .86, .7], [.32, .29, .22]), tieM = mat('tie', [.75, .1, .1], [.45, .05, .05]), seenM = mat('seenLit', [1, .15, .1], [1, .12, .08], { flat: true, alpha: .55 });
      const src = (m, mt) => { m.material = mt; m.isPickable = false; m.isVisible = false; ctx.add(m); return m; };
      const sFloor = src(B.MeshBuilder.CreateBox('silFloor', { width: CELL * .97, height: .12, depth: CELL * .97 }, scene), floorM);
      const sWall = src(B.MeshBuilder.CreateBox('silWall', { width: CELL, height: .9, depth: CELL }, scene), wallM);
      const sLit = src(B.MeshBuilder.CreateGround('silLit', { width: CELL * .92, height: CELL * .92 }, scene), litM);
      const sSeen = src(B.MeshBuilder.CreateGround('silSeen', { width: CELL * .92, height: CELL * .92 }, scene), seenM);
      const sNext = src(B.MeshBuilder.CreateDisc('silNext', { radius: CELL * .16, tessellation: 3 }, scene), nextM);
      // a watchman: robe, head, red visor, straw hat and a lantern held out in front (one set of parts, instanced)
      const parts = [
        [B.MeshBuilder.CreateCylinder('silRobe', { height: 1.7, diameterTop: .42, diameterBottom: .86, tessellation: 10 }, scene), robeM, [0, .85, 0]],
        [B.MeshBuilder.CreateSphere('silHead', { diameter: .52, segments: 8 }, scene), headM, [0, 1.95, 0]],
        [B.MeshBuilder.CreateBox('silVisor', { width: .4, height: .08, depth: .08 }, scene), visorM, [0, 1.98, .22]],
        [B.MeshBuilder.CreateCylinder('silHat', { height: .3, diameterTop: 0, diameterBottom: .82, tessellation: 12 }, scene), hatM, [0, 2.3, 0]],
        [B.MeshBuilder.CreateSphere('silLamp', { diameter: .3, segments: 8 }, scene), lampM, [0, 1.15, .62]],
        [B.MeshBuilder.CreateBox('silPole', { width: .04, height: .04, depth: .5 }, scene), robeM, [0, 1.35, .38]]
      ].map(([m, mt, p]) => { src(m, mt); return { m, p }; });
      const makeGuard = () => { const n = new B.TransformNode('silGuard', scene); n.parent = ctx.frame; ctx.add(n); parts.forEach(({ m, p }) => { const i = m.createInstance('silGuardPart'); i.parent = n; i.position.set(...p); }); n.scaling.setAll(1.05); return n; };
      // the scroll on a low stand
      const scrollNode = new B.TransformNode('silScroll', scene); scrollNode.parent = ctx.frame; ctx.add(scrollNode);
      { const st = B.MeshBuilder.CreateBox('silStand', { width: .7, height: .4, depth: .5 }, scene); st.material = wallM; st.parent = scrollNode; st.position.y = .2; st.isPickable = false;
        const sc = B.MeshBuilder.CreateCylinder('silScrollBody', { height: .72, diameter: .22, tessellation: 12 }, scene); sc.material = scrollM; sc.rotation.z = Math.PI / 2; sc.parent = scrollNode; sc.position.y = .52; sc.isPickable = false;
        const tie = B.MeshBuilder.CreateCylinder('silScrollTie', { height: .07, diameter: .24, tessellation: 12 }, scene); tie.material = tieM; tie.rotation.z = Math.PI / 2; tie.parent = scrollNode; tie.position.y = .52; tie.isPickable = false; }
      let board = null; // { k, B, W, H, nodes[], guards: [{ n, alive }], lit[], p, t, alive, moves, hist[], seen }
      const st = { phase: 'pick', anim: null, wait: 0 };
      const cellPos = (i) => { const x = i % board.W, y = Math.floor(i / board.W); return new V3(AT[0] + (x - (board.W - 1) / 2) * CELL, 0, AT[1] + ((board.H - 1) / 2 - y) * CELL); };
      const xyPos = (x, y) => cellPos(y * board.W + x);
      function build(k) {
        if (board) { board.nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); board.lit.forEach(n => n.dispose()); }
        const Bd = parse(LV[k]), W = Bd.W, Hh = Bd.H;
        board = { k, B: Bd, W, H: Hh, nodes: [], guards: [], lit: [], p: Bd.start, t: 0, alive: (1 << Bd.guards.length) - 1, moves: 0, hist: [], seen: 0 };
        const put = (s, i, y) => { const m = s.createInstance('silPart'); m.parent = ctx.frame; ctx.add(m); const p = cellPos(i); m.position.set(p.x, y, p.z); board.nodes.push(m); return m; };
        for (let i = 0; i < W * Hh; i++) { if (Bd.wall[i]) put(sWall, i, .45); else put(sFloor, i, .06); }
        // a low wall round the board so its edge reads at night
        for (let x = -1; x <= W; x++) for (const y of [-1, Hh]) { const m = sWall.createInstance('silRim'); m.parent = ctx.frame; ctx.add(m); const p = xyPos(0, 0); m.position.set(AT[0] + (x - (W - 1) / 2) * CELL, .2, AT[1] + ((Hh - 1) / 2 - y) * CELL); m.scaling.y = .45; board.nodes.push(m); }
        for (let y = 0; y < Hh; y++) for (const x of [-1, W]) { const m = sWall.createInstance('silRim'); m.parent = ctx.frame; ctx.add(m); m.position.set(AT[0] + (x - (W - 1) / 2) * CELL, .2, AT[1] + ((Hh - 1) / 2 - y) * CELL); m.scaling.y = .45; board.nodes.push(m); }
        Bd.guards.forEach((g, gi) => { const n = makeGuard(); board.nodes.push(n); const a = guardAt(g, 0), p = xyPos(a.x, a.y); n.position.set(p.x, .12, p.z); n.rotation.y = YAW[a.f];
          const nx = sNext.createInstance('silNextI'); nx.parent = ctx.frame; ctx.add(nx); nx.rotation.x = Math.PI / 2; nx.isVisible = g.kind === 'turn'; board.nodes.push(nx); board.guards.push({ n, nx, g, gi }); });
        const gp = cellPos(Bd.goal); scrollNode.position.set(gp.x, .12, gp.z); scrollNode.rotation.y = 0;
        const pp = cellPos(Bd.start); ctx.player.place(pp.x, pp.z, 0);
        const span = Math.max(W, Hh) * CELL;
        st.cam = [AT[0], span * 1.35 + 4.2, AT[1] - span * .64 - 2.2]; st.at = [AT[0], 0, AT[1] - span * .09]; // Oct 17: back, up and aimed nearer: the near row sat under the hint bar
        relight(); info();
      }
      function relight(seenAt) {
        board.lit.forEach(n => n.dispose()); board.lit = [];
        for (const i of litCells(board.B, board.t, board.alive)) { const m = (i === seenAt ? sSeen : sLit).createInstance('silLitI'); m.parent = ctx.frame; ctx.add(m); const p = cellPos(i); m.position.set(p.x, .135, p.z); board.lit.push(m); }
        if (seenAt != null && !board.lit.some(m => m.sourceMesh === sSeen)) { const m = sSeen.createInstance('silLitI'); m.parent = ctx.frame; ctx.add(m); const p = cellPos(seenAt); m.position.set(p.x, .135, p.z); board.lit.push(m); }
        board.guards.forEach(({ n, nx, g, gi }) => { const on = !!(board.alive >> gi & 1); n.setEnabled(on); nx.setEnabled(on && g.kind === 'turn');
          if (on && g.kind === 'turn') { const f = guardAt(g, board.t + 1).f, [dx, dy] = DIRS[f]; nx.position.set(n.position.x + dx * CELL * .42, .15, n.position.z - dy * CELL * .42); nx.rotation.y = YAW[f] - Math.PI / 2; } });
      }
      const info = () => H.info(board ? `Level ${board.k + 1} / ${LV.length} · turns ${board.moves} · fewest ${LV[board.k].best ?? '?'}${board.seen ? ` · seen ${board.seen}` : ''}` : 'Pick a level');
      function step(dx, dy) {
        if (st.phase !== 'play' || st.anim) return;
        const b = board, r = turn(b.B, b.p, b.t, b.alive, [dx, dy]);
        if (!r) { if (dx || dy) ctx.player.face(dx > 0 ? Math.PI / 2 : dx < 0 ? -Math.PI / 2 : dy < 0 ? 0 : Math.PI); return; }
        b.hist.push({ p: b.p, t: b.t, alive: b.alive, moves: b.moves });
        const yaw = dx > 0 ? Math.PI / 2 : dx < 0 ? -Math.PI / 2 : dy < 0 ? 0 : dy > 0 ? Math.PI : null;
        const g0 = b.guards.map(({ g }) => guardAt(g, b.t)), g1 = b.guards.map(({ g }) => guardAt(g, b.t + 1));
        st.anim = { t: 0, from: cellPos(b.p), to: cellPos(r.p), yaw, g0, g1, r, took: r.took, prevAlive: b.alive };
        b.moves++; b.p = r.p; b.alive = r.alive; if (!r.seen && !r.won) b.t++;
        if (r.took >= 0) { ctx.player.clip('cross_punch'); ctx.sound('thock'); } else if (dx || dy) ctx.player.clip('walk', { loop: true });
        info();
      }
      function finishTurn(a) {
        const b = board, r = a.r;
        if (r.seen) {
          b.seen++; ctx.sound('splash'); ctx.note(196, 'bell'); H.msg('Seen!', 900, r.by === 'walk' ? 'a watchman walked into you' : 'you stepped into the light');
          b.t = a.r.won ? b.t : b.hist[b.hist.length - 1].t + 1; relight(r.p); st.phase = 'seen'; st.wait = .9; return;
        }
        relight();
        if (r.won) { st.phase = 'solved'; st.wait = 1.4; ctx.sound('gamewin'); H.msg('The scroll is yours', 1300, `${b.moves} turns`);
          if (b.k + 1 > solvedUpTo) { solvedUpTo = b.k + 1; try { localStorage.setItem(KEY, String(solvedUpTo)); } catch (e) {} } pads.style.display = 'none'; }
      }
      function undo(silent) {
        if (!board || !board.hist.length || (st.phase !== 'play' && st.phase !== 'seen') || (st.anim && !silent)) return;
        const h = board.hist.pop(); board.p = h.p; board.t = h.t; board.alive = h.alive; board.moves = h.moves;
        const pp = cellPos(board.p); ctx.player.place(pp.x, pp.z); ctx.player.idle();
        board.guards.forEach(({ n, g }) => { const a = guardAt(g, board.t), p = xyPos(a.x, a.y); n.position.set(p.x, .12, p.z); n.rotation.y = YAW[a.f]; n.scaling.setAll(1.05); });
        relight(); info(); st.phase = 'play';
      }
      // R, the pads' ⟲ and Restart beside Quit: the level as it was picked (turns, undo and the seen count); not mid-turn
      function restart() { if (st.phase !== 'play' || st.anim) return; build(board.k); H.msg('Again', 600); }
      // the level picker (and the pads for phones)
      const hud = document.getElementById('gameHud');
      const pick = document.createElement('div');
      pick.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(' + (LV.length > 6 && innerWidth >= 600 ? 560 : 380) + 'px,92vw);background:rgba(10,9,13,.94);border:1px solid rgba(224,120,50,.6);border-radius:14px;padding:16px;text-align:center;pointer-events:auto;font:15px/1.4 Georgia,serif;color:#eee';
      const drawPick = () => { pick.innerHTML = `<div style="font:700 13px/1.2 Georgia,serif;letter-spacing:.14em;text-transform:uppercase;color:#e08a3a;margin-bottom:10px">The Silent Path</div><div style="margin-bottom:12px;color:#bbb">Reach the scroll without stepping into a lantern's light.</div>`
        + `<div style="display:grid;grid-template-columns:repeat(${LV.length > 6 && innerWidth >= 600 ? 5 : 4},1fr);gap:8px">${LV.map((_, k) => { const open = k <= solvedUpTo, done = k < solvedUpTo; return `<button type="button" data-k="${k}" ${open ? '' : 'disabled'} style="padding:10px 4px;border-radius:9px;border:1px solid ${open ? '#e08a3a' : '#444'};background:${done ? 'rgba(224,138,58,.25)' : 'rgba(255,255,255,.04)'};color:${open ? '#fff' : '#666'};font:700 16px Georgia,serif;cursor:${open ? 'pointer' : 'default'}">${open ? k + 1 : '🔒'}${done ? ' ✓' : ''}</button>`; }).join('')}</div>`;
        pick.querySelectorAll('button[data-k]').forEach(b => b.onclick = (e) => { e.stopPropagation(); b.blur(); choose(+b.dataset.k); }); };
      function choose(k) { if (st.phase !== 'pick' || k > solvedUpTo || k >= LV.length) return; pick.remove(); st.phase = 'play'; build(k); pads.style.display = 'grid'; H.msg(`Level ${k + 1}`, 900, k >= 4 ? 'a hard one' : k === 1 ? 'take the watchman from behind' : ''); }
      const pads = document.createElement('div');
      pads.style.cssText = 'position:absolute;bottom:62px;right:16px;display:none;grid-template-columns:repeat(3,46px);grid-template-rows:repeat(3,40px);gap:5px;pointer-events:auto';
      const pad = (t, area, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.style.cssText = `grid-area:${area};border-radius:8px;border:1px solid #c9773f;background:rgba(20,14,10,.82);color:#ffe6d0;font:700 16px Georgia,serif;cursor:pointer`; b.onclick = (e) => { e.stopPropagation(); b.blur(); fn(); }; pads.appendChild(b); };
      pad('↑', '1 / 2', () => step(0, -1)); pad('←', '2 / 1', () => step(-1, 0)); pad('→', '2 / 3', () => step(1, 0)); pad('↓', '3 / 2', () => step(0, 1)); pad('·', '2 / 2', () => step(0, 0)); pad('↶', '1 / 1', () => undo()); pad('⟲', '1 / 3', restart);
      hud.append(pick, pads);
      drawPick();
      st.cam = [AT[0], 12, AT[1] - 10.5]; st.at = [AT[0], 0, AT[1]];
      ctx.look(st.cam, st.at, def.fov || .8);
      H.title(def.title || 'The Silent Path'); H.score(''); info();
      H.hint('Step with the arrows / <kbd>WASD</kbd>, <kbd>Space</kbd> waits a turn. Keep out of the lantern light; step onto a watchman from behind to take it out. <kbd>U</kbd> undo, <kbd>R</kbd> start again.');
      const inst = {
        update(dt) {
          ctx.look(st.cam, st.at);
          const a = st.anim;
          if (a) {
            a.t += dt / .24; const u = Math.min(1, a.t), e = u * u * (3 - 2 * u);
            const p = V3.Lerp(a.from, a.to, e); ctx.player.place(p.x, p.z, a.yaw ?? undefined);
            const moveGuards = !a.r.seen || a.r.by === 'walk';
            board.guards.forEach(({ n }, k) => { const g0 = a.g0[k], g1 = a.g1[k];
              if (k === a.took) { n.scaling.setAll(1.05 * (1 - e)); return; }
              if (!moveGuards || a.r.won) return;
              const p0 = xyPos(g0.x, g0.y), p1 = xyPos(g1.x, g1.y); n.position.x = p0.x + (p1.x - p0.x) * e; n.position.z = p0.z + (p1.z - p0.z) * e;
              let d = YAW[g1.f] - YAW[g0.f]; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; n.rotation.y = YAW[g0.f] + d * e; });
            if (u >= 1) { st.anim = null; ctx.player.idle(); finishTurn(a); }
          }
          if (st.phase === 'seen' && (st.wait -= dt) <= 0) undo(true);
          if (st.phase === 'solved' && (st.wait -= dt) <= 0) {
            st.phase = 'done'; H.hint('');
            const k = board.k, best = LV[k].best || board.moves, score = (k + 1) * 20 + (board.moves <= Math.ceil(best * 1.25) ? 10 : 0);
            ctx.finish({ score, label: 'points', solved: true, extra: `Level ${k + 1} in ${board.moves} turns (the fewest is ${best})${board.seen ? `, seen ${board.seen} time${board.seen > 1 ? 's' : ''}` : ', never seen'}.${k + 1 < LV.length ? ` Level ${k + 2} is open.` : ' Every level solved.'}` });
          }
        },
        key(e, down) {
          if (!down || e.repeat) return; const k = e.key.toLowerCase();
          if (st.phase === 'pick') { const n = k === '0' ? 10 : parseInt(k, 10); if (n >= 1 && n <= LV.length) choose(n - 1); return; } // 1-9, 0 = the tenth
          if (k === 'arrowup' || k === 'w') step(0, -1); else if (k === 'arrowdown' || k === 's') step(0, 1); else if (k === 'arrowleft' || k === 'a') step(-1, 0); else if (k === 'arrowright' || k === 'd') step(1, 0);
          else if (k === ' ' || k === 'enter' || k === '.') step(0, 0); else if (k === 'u' || k === 'z' || k === 'backspace') undo(); else if (k === 'r') restart();
        },
        pointer() {},
        restart,
        _test: { st, step, undo, restart, choose, get board() { return board; }, LV, parse, turn, guardAt, litCells },
        dispose() { pick.remove(); pads.remove(); if (board) { board.nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); board.lit.forEach(n => { try { n.dispose(); } catch (e) {} }); } }
      };
      return inst;
    }
  };
  window.RebelGames.register('silent', G);
})();
