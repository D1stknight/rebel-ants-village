// The Lacquer Floor (Oct 15, Shogun): the Shogun's polished floor, where no one stops where they mean to. Each move
// slides the Rebel until a pillar or the edge stops it; a tatami mat stops it on the mat. Reach the purple seal; from
// level 5 the gold leaf on the floor must all be gathered first (a slide picks up what it passes). U undoes a move, R
// starts the level again. Seven levels, each opens when the one before is solved (kept on this device); the fewest
// moves were found by a solver. Score: the level x 20, +10 in the fewest moves.
// def: { at: [x, z] (frame coords of the floor's middle), cell: 1.1, levels, pass, points }
(function () {
  const LEVELS = [
    { rows: ['......', '......', '.E....', '..##.#', '.....#', '...@#.'], best: 5 },
    { rows: ['#....#', '......', '..#...', '..E.#.', '...#..', '..#.@.'], best: 11 },
    { rows: ['.#..#.E', '#...#..', '...#..#', '#......', '......#', '.....#.', '.#....@'], best: 11 },
    { rows: ['#.#.#...', '...#.E..', '....#...', '#.......', '.......m', '.....#..', '..#.#.#.', '#.m@..#.'], best: 11 },
    { rows: ['.....E##', '#.......', '....#...', '........', 'g.......', '.#.#....', '#m.....#', 'g.#..@#.'], best: 16 },
    { rows: ['#....#..m', '..g....E.', '.....#..#', '#.......#', '.#..m....', 'g........', '#.......#', '....g....', '......@..'], best: 21 },
    { rows: ['..#.......', '......m..#', '...#..#...', '...m...#..', 'E...#....g', '....g....#', '##........', '.g.#......', 'g.........', '....#@#m..'], best: 27 }
  ];
  function parse(rows) {
    const H = rows.length, W = Math.max(...rows.map(r => r.length)), cell = [], gold = []; let start = 0, exit = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = rows[y][x] || '#', i = y * W + x; cell[i] = c === '#' ? '#' : c === 'm' ? 'm' : c === 'E' ? 'E' : '.'; if (c === '@') start = i; if (c === 'E') exit = i; if (c === 'g') gold.push(i); }
    return { W, H, cell, start, exit, gold };
  }
  function slide(B, p, dx, dy) {
    let x = p % B.W, y = Math.floor(p / B.W); const passed = [];
    for (;;) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= B.W || ny >= B.H || B.cell[ny * B.W + nx] === '#') break; x = nx; y = ny; const i = y * B.W + x; passed.push(i); if (B.cell[i] === 'm' || B.cell[i] === 'E') break; }
    return { p: y * B.W + x, passed };
  }
  const G = {
    title: 'The Lacquer Floor',
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const LV = def.levels || LEVELS, CELL = def.cell || 1.1, AT = def.at || [0, 0];
      const KEY = 'rebelAntsLacquerProgress:' + (def.id || 'iceslide');
      let solvedUpTo = 0; try { solvedUpTo = Math.max(0, Math.min(LV.length, Number(localStorage.getItem(KEY)) || 0)); } catch (e) {}
      const mat = (k, c, em, o = {}) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(...(o.spec || [.08, .08, .08])); if (o.power) m.specularPower = o.power; if (em) m.emissiveColor = new B.Color3(...em); if (o.flat) m.disableLighting = true; if (o.alpha != null) m.alpha = o.alpha; return m; });
      const floorM = mat('lacquer', [.42, .07, .07], [.1, .015, .015], { spec: [.6, .5, .45], power: 140 }), rimM = mat('rim', [.08, .06, .07], [.02, .015, .02], { spec: [.5, .45, .4], power: 60 });
      const pillarM = mat('pillar', [.06, .05, .06], [.015, .012, .015], { spec: [.7, .65, .6], power: 70 }), capM = mat('cap', [.85, .66, .26], [.3, .22, .06], { spec: [1, .9, .6], power: 40 });
      const matM = mat('tatami', [.62, .6, .38], [.12, .12, .07]), edgeM = mat('tatamiEdge', [.12, .2, .12], [.03, .05, .03]), goldM = mat('leaf', [1, .78, .25], [.7, .5, .12], { spec: [1, 1, .7], power: 30 });
      const sealM = ctx.mat('seal', n => { const m = new B.StandardMaterial(n, scene); const t = new B.DynamicTexture(n + 'T', { width: 256, height: 256 }, scene, true); const g = t.getContext();
        const paint = (img) => { g.clearRect(0, 0, 256, 256); g.fillStyle = '#4a1236'; g.beginPath(); g.arc(128, 128, 124, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#e2b450'; g.lineWidth = 10; g.beginPath(); g.arc(128, 128, 112, 0, Math.PI * 2); g.stroke();
          if (img) { const c = document.createElement('canvas'); c.width = c.height = 150; const cg = c.getContext('2d'); cg.drawImage(img, 0, 0, 150, 150); cg.globalCompositeOperation = 'source-in'; cg.fillStyle = '#f0c860'; cg.fillRect(0, 0, 150, 150); g.drawImage(c, 53, 53); } t.update(); };
        paint(null); const img = new Image(); img.crossOrigin = 'anonymous'; img.onload = () => paint(img); img.src = 'assets/brand/factions/shogun.png';
        t.hasAlpha = true; m.diffuseTexture = t; m.emissiveTexture = t; m.useAlphaFromDiffuseTexture = true; m.specularColor = new B.Color3(.2, .2, .2); return m; });
      const src = (m, mt) => { m.material = mt; m.isPickable = false; m.isVisible = false; ctx.add(m); return m; };
      const sFloor = src(B.MeshBuilder.CreateBox('iceFloor', { width: CELL * .985, height: .1, depth: CELL * .985 }, scene), floorM);
      const sRim = src(B.MeshBuilder.CreateBox('iceRim', { width: CELL, height: .35, depth: CELL }, scene), rimM);
      const sPillar = src(B.MeshBuilder.CreateCylinder('icePillar', { height: 1.6, diameter: CELL * .62, tessellation: 12 }, scene), pillarM);
      const sCap = src(B.MeshBuilder.CreateCylinder('iceCap', { height: .14, diameter: CELL * .74, tessellation: 12 }, scene), capM);
      const sMat = src(B.MeshBuilder.CreateBox('iceMat', { width: CELL * .9, height: .06, depth: CELL * .9 }, scene), matM);
      const sMatEdge = src(B.MeshBuilder.CreateBox('iceMatEdge', { width: CELL * .96, height: .05, depth: CELL * .96 }, scene), edgeM);
      const sGold = src(B.MeshBuilder.CreateBox('iceGold', { width: CELL * .34, height: .03, depth: CELL * .34 }, scene), goldM);
      const seal = B.MeshBuilder.CreateDisc('iceSeal', { radius: CELL * .46, tessellation: 32 }, scene); seal.material = sealM; seal.rotation.x = Math.PI / 2; seal.parent = ctx.frame; seal.isPickable = false; ctx.add(seal); seal.setEnabled(false);
      let board = null; // { k, B, W, H, nodes[], gold: Map(i -> mesh), got: Set, p, moves, hist[] }
      const st = { phase: 'pick', anim: null, wait: 0, spin: 0 };
      const cellPos = (i) => { const x = i % board.W, y = Math.floor(i / board.W); return new V3(AT[0] + (x - (board.W - 1) / 2) * CELL, 0, AT[1] + ((board.H - 1) / 2 - y) * CELL); };
      const at = (x, y) => new V3(AT[0] + (x - (board.W - 1) / 2) * CELL, 0, AT[1] + ((board.H - 1) / 2 - y) * CELL);
      function build(k) {
        if (board) board.nodes.forEach(n => { try { n.dispose(); } catch (e) {} });
        const Bd = parse(LV[k].rows), W = Bd.W, Hh = Bd.H;
        board = { k, B: Bd, W, H: Hh, nodes: [], gold: new Map(), got: new Set(), p: Bd.start, moves: 0, hist: [] };
        const put = (s, p, y) => { const m = s.createInstance('icePart'); m.parent = ctx.frame; ctx.add(m); m.position.set(p.x, y, p.z); board.nodes.push(m); return m; };
        for (let i = 0; i < W * Hh; i++) { const p = cellPos(i); put(sFloor, p, .05);
          if (Bd.cell[i] === '#') { put(sPillar, p, .9); put(sCap, p, 1.75); }
          if (Bd.cell[i] === 'm') { put(sMatEdge, p, .125); put(sMat, p, .14); } }
        for (let x = -1; x <= W; x++) for (const y of [-1, Hh]) put(sRim, at(x, y), .175);
        for (let y = 0; y < Hh; y++) for (const x of [-1, W]) put(sRim, at(x, y), .175);
        Bd.gold.forEach(i => { const m = put(sGold, cellPos(i), .5); board.gold.set(i, m); });
        const sp = cellPos(Bd.exit); seal.position.set(sp.x, .112, sp.z); seal.setEnabled(true);
        const pp = cellPos(Bd.start); ctx.player.place(pp.x, pp.z, 0);
        const span = Math.max(W, Hh) * CELL;
        st.cam = [AT[0], span * 1.15 + 3.5, AT[1] - span * .55 - 1.8]; st.at = [AT[0], 0, AT[1] + .3];
        info();
      }
      const info = () => H.info(board ? `Level ${board.k + 1} / ${LV.length} · moves ${board.moves} · fewest ${LV[board.k].best ?? '?'}${board.B.gold.length ? ` · gold ${board.got.size} / ${board.B.gold.length}` : ''}` : 'Pick a level');
      function move(dx, dy) {
        if (st.phase !== 'play' || st.anim) return;
        const b = board, r = slide(b.B, b.p, dx, dy), yaw = dx > 0 ? Math.PI / 2 : dx < 0 ? -Math.PI / 2 : dy < 0 ? 0 : Math.PI;
        if (r.p === b.p) { ctx.player.face(yaw); return; }
        b.hist.push({ p: b.p, got: new Set(b.got), moves: b.moves });
        b.moves++; info();
        st.anim = { t: 0, dur: Math.max(.16, r.passed.length * .085), from: cellPos(b.p), to: cellPos(r.p), yaw, passed: r.passed, n: 0, end: r.p };
        b.p = r.p; ctx.player.face(yaw);
      }
      function arrive(a) {
        const b = board, wall = b.B.cell[a.end] === '.' ? 'thock' : null; if (wall) ctx.sound('thock');
        if (a.end === b.B.exit) {
          if (b.got.size === b.B.gold.length) { st.phase = 'solved'; st.wait = 1.3; ctx.sound('gamewin'); H.msg('The seal opens', 1300, `${b.moves} moves`); pads.style.display = 'none';
            if (b.k + 1 > solvedUpTo) { solvedUpTo = b.k + 1; try { localStorage.setItem(KEY, String(solvedUpTo)); } catch (e) {} } }
          else H.msg('Not yet', 1100, `gather the gold leaf first (${b.B.gold.length - b.got.size} left)`);
        }
      }
      function undo() {
        if (!board || st.phase !== 'play' || st.anim || !board.hist.length) return;
        const h = board.hist.pop(); board.p = h.p; board.got = h.got; board.moves = h.moves;
        board.gold.forEach((m, i) => m.setEnabled(!board.got.has(i)));
        const pp = cellPos(board.p); ctx.player.place(pp.x, pp.z); info();
      }
      function restart() { if (st.phase !== 'play' || st.anim) return; build(board.k); H.msg('Again', 600); }
      const hud = document.getElementById('gameHud');
      const pick = document.createElement('div');
      pick.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(380px,90vw);background:rgba(18,8,16,.94);border:1px solid rgba(226,180,80,.6);border-radius:14px;padding:16px;text-align:center;pointer-events:auto;font:15px/1.4 Georgia,serif;color:#eee';
      const drawPick = () => { pick.innerHTML = `<div style="font:700 13px/1.2 Georgia,serif;letter-spacing:.14em;text-transform:uppercase;color:#e2b450;margin-bottom:10px">The Lacquer Floor</div><div style="margin-bottom:12px;color:#bbb">Slide to the purple seal. Only pillars, the edge and the mats stop you.</div>`
        + `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">${LV.map((_, k) => { const open = k <= solvedUpTo, done = k < solvedUpTo; return `<button type="button" data-k="${k}" ${open ? '' : 'disabled'} style="padding:10px 4px;border-radius:9px;border:1px solid ${open ? '#e2b450' : '#444'};background:${done ? 'rgba(226,180,80,.25)' : 'rgba(255,255,255,.04)'};color:${open ? '#fff' : '#666'};font:700 16px Georgia,serif;cursor:${open ? 'pointer' : 'default'}">${open ? k + 1 : '🔒'}${done ? ' ✓' : ''}</button>`; }).join('')}</div>`;
        pick.querySelectorAll('button[data-k]').forEach(b => b.onclick = (e) => { e.stopPropagation(); b.blur(); choose(+b.dataset.k); }); };
      function choose(k) { if (st.phase !== 'pick' || k > solvedUpTo || k >= LV.length) return; pick.remove(); st.phase = 'play'; build(k); pads.style.display = 'grid'; H.msg(`Level ${k + 1}`, 900, LV[k].rows.join('').includes('g') ? 'gather the gold leaf first' : k >= 3 ? 'a hard one' : ''); }
      const pads = document.createElement('div');
      pads.style.cssText = 'position:absolute;bottom:62px;right:16px;display:none;grid-template-columns:repeat(3,46px);grid-template-rows:repeat(3,40px);gap:5px;pointer-events:auto';
      const pad = (t, area, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.style.cssText = `grid-area:${area};border-radius:8px;border:1px solid #b8913f;background:rgba(24,10,18,.82);color:#ffe9c0;font:700 16px Georgia,serif;cursor:pointer`; b.onclick = (e) => { e.stopPropagation(); b.blur(); fn(); }; pads.appendChild(b); };
      pad('↑', '1 / 2', () => move(0, -1)); pad('←', '2 / 1', () => move(-1, 0)); pad('→', '2 / 3', () => move(1, 0)); pad('↓', '3 / 2', () => move(0, 1)); pad('↶', '1 / 1', undo); pad('⟲', '1 / 3', restart);
      hud.append(pick, pads);
      drawPick();
      st.cam = [AT[0], 12, AT[1] - 9]; st.at = [AT[0], 0, AT[1]];
      ctx.look(st.cam, st.at, def.fov || .8);
      H.title(def.title || 'The Lacquer Floor'); H.score(''); info();
      H.hint('Slide with the arrows / <kbd>WASD</kbd>: you stop only at a pillar, the edge or a mat. <kbd>U</kbd> undo, <kbd>R</kbd> start again.');
      const inst = {
        update(dt) {
          ctx.look(st.cam, st.at);
          st.spin += dt; if (board) board.gold.forEach(m => { m.rotation.y = st.spin * 1.6; m.position.y = .5 + Math.sin(st.spin * 2.4 + m.position.x) * .06; });
          const a = st.anim;
          if (a) {
            a.t += dt; const u = Math.min(1, a.t / a.dur), e = u < 1 ? 1 - (1 - u) * (1 - u) * .35 - .65 * (1 - u) : 1;
            const p = V3.Lerp(a.from, a.to, Math.min(1, e)); ctx.player.place(p.x, p.z, a.yaw);
            const reached = Math.floor(Math.min(1, e) * a.passed.length + 1e-6);
            for (; a.n < reached; a.n++) { const i = a.passed[a.n]; if (board.gold.has(i) && !board.got.has(i)) { board.got.add(i); board.gold.get(i).setEnabled(false); ctx.note(880 + board.got.size * 110, 'bell'); info(); } }
            if (u >= 1) { st.anim = null; arrive(a); }
          }
          if (st.phase === 'solved' && (st.wait -= dt) <= 0) {
            st.phase = 'done'; H.hint('');
            const k = board.k, best = LV[k].best || board.moves, score = (k + 1) * 20 + (board.moves <= best ? 10 : 0);
            ctx.finish({ score, label: 'points', solved: true, extra: `Level ${k + 1} in ${board.moves} moves (the fewest is ${best}).${k + 1 < LV.length ? ` Level ${k + 2} is open.` : ' Every level solved.'}` });
          }
        },
        key(e, down) {
          if (!down || e.repeat) return; const k = e.key.toLowerCase();
          if (st.phase === 'pick') { const n = parseInt(k, 10); if (n >= 1 && n <= LV.length) choose(n - 1); return; }
          if (k === 'arrowup' || k === 'w') move(0, -1); else if (k === 'arrowdown' || k === 's') move(0, 1); else if (k === 'arrowleft' || k === 'a') move(-1, 0); else if (k === 'arrowright' || k === 'd') move(1, 0);
          else if (k === 'u' || k === 'z' || k === 'backspace') undo(); else if (k === 'r') restart();
        },
        pointer() {},
        _test: { st, move, undo, choose, get board() { return board; }, LV, parse, slide },
        dispose() { pick.remove(); pads.remove(); if (board) board.nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); }
      };
      return inst;
    }
  };
  window.RebelGames.register('iceslide', G);
})();
