// The Cavalry Ride (Oct 15, Bushi): a knight's tour. The Rebel rides like the cavalry piece on a strategy board: two
// squares one way and one to the side. Visit every square exactly once (rocks are never visited). The squares you can
// reach glow, numbered: click one (or press its number). U undoes a ride, R starts again, H shows a good next square
// (Warnsdorff's rule: ride to the square with the fewest ways on), which costs the clean-ride bonus. Seven boards from
// 3 x 4 to 7 x 7, each opens when the one before is done (kept on this device). Score: the board x 20, +10 without hints.
// def: { at: [x, z] (frame coords of the board's middle), cell: 1.4, levels, pass, points }
// Oct 17 (Miguel: the puzzles need a how-to with an example, every board a Restart): howTo (the rules + a finished
// 4 x 3 ride, howto/knight.png) and inst.restart = R (the board again, mid-ride too; hints still count: they cost the bonus).
// Oct 17 (Miguel: "go up to 10"): ten boards; the new three are 8 x 7 with two rocks, 8 x 8 with two and 8 x 8 with
// four (scratchpad lv/knight/search.mjs: rocks in mirrored pairs and a start, kept when a tour from square 1 exists
// (Warnsdorff-ordered DFS) and riding the H hint from square 1 covers every square; the hardest kept, by how often
// Warnsdorff's rule with random tie-breaks gets stuck: 59 %, 20 %, 13 % of rides complete; board 7 75 %).
(function () {
  const LEVELS = [
    ['K...', '....', '....'],
    ['K....', '.....', '.....', '.....'],
    ['K....', '.....', '.....', '.....', '.....'],
    ['.....', '.....', '..K..', '.....', '.....'],
    ['K.....', '......', '......', '......', '......', '......'],
    ['......', '.#....', '......', '......', '...#..', '..K...'],
    ['K......', '.......', '.......', '.......', '.......', '.......', '.......'],
    ['........', '........', '..K.....', '.#....#.', '........', '........', '........'],
    ['........', '........', '........', '........', '........', '........', '..#..#..', '.......K'],
    ['.......K', '..#..#..', '...##...', '........', '........', '........', '........', '........']
  ];
  const J = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
  const G = {
    title: 'The Cavalry Ride',
    howTo: {
      lines: ['Ride across the board like the knight in chess: every ride is an L, two squares one way and then one to the side.',
        'Visit every square exactly once (rocks are left out). You start on square 1, and each square you land on takes the next number.',
        'The squares you can ride to glow with a gold ring and a number: click one, or press that number.',
        'U takes back the last ride, R starts the board again. H rings a good next square in green, but a hint costs the clean-ride bonus.',
        'Tip: visit the corners and edges early, while you can still reach them; the open middle has the most ways in and out, so keep it for last.'],
      img: 'howto/knight.png', caption: 'A finished 4 x 3 ride: squares 1 to 12, every ride an L.'
    },
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const LV = def.levels || LEVELS, CELL = def.cell || 1.4, AT = def.at || [0, 0];
      const KEY = 'rebelAntsCavalryProgress:' + (def.id || 'knight');
      let solvedUpTo = 0; try { solvedUpTo = Math.max(0, Math.min(LV.length, Number(localStorage.getItem(KEY)) || 0)); } catch (e) {}
      const mat = (k, c, em, o = {}) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(.06, .06, .06); if (em) m.emissiveColor = new B.Color3(...em); if (o.flat) m.disableLighting = true; if (o.alpha != null) m.alpha = o.alpha; return m; });
      const lightM = mat('sqLight', [.78, .76, .7], [.16, .155, .14]), darkM = mat('sqDark', [.16, .2, .32], [.04, .05, .08]), rimM = mat('rim', [.35, .3, .24], [.06, .05, .04]);
      const rockM = mat('rock', [.5, .48, .44], [.08, .08, .07]), ringM = mat('ring', [1, .8, .3], [1, .72, .2], { flat: true }), hintM = mat('hint', [.5, 1, .6], [.4, 1, .5], { flat: true });
      const numMats = {}, numMat = (n, kind) => numMats[kind + n] || (numMats[kind + n] = ctx.mat('num' + kind + n, nm => { const m = new B.StandardMaterial(nm, scene); const t = new B.DynamicTexture(nm + 'T', { width: 128, height: 128 }, scene, true); const g = t.getContext();
        g.clearRect(0, 0, 128, 128); if (kind === 'v') { g.fillStyle = '#d8b35c'; g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.fill(); g.fillStyle = '#1b2440'; } else { g.fillStyle = 'rgba(20,16,8,.75)'; g.beginPath(); g.arc(64, 64, 40, 0, Math.PI * 2); g.fill(); g.fillStyle = '#ffd97a'; }
        g.font = `bold ${kind === 'v' ? (n > 9 ? 58 : 70) : 60}px Georgia`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), 64, 68); t.update(); t.hasAlpha = true;
        m.diffuseTexture = t; m.emissiveTexture = t; m.useAlphaFromDiffuseTexture = true; m.disableLighting = true; m.backFaceCulling = false; return m; }));
      const src = (m, mt) => { m.material = mt; m.isPickable = false; m.isVisible = false; ctx.add(m); return m; };
      const sLight = src(B.MeshBuilder.CreateBox('cavLight', { width: CELL * .98, height: .12, depth: CELL * .98 }, scene), lightM);
      const sDark = src(B.MeshBuilder.CreateBox('cavDark', { width: CELL * .98, height: .12, depth: CELL * .98 }, scene), darkM);
      const sRim = src(B.MeshBuilder.CreateBox('cavRim', { width: CELL, height: .3, depth: CELL }, scene), rimM);
      const sRock = src(B.MeshBuilder.CreateSphere('cavRock', { diameterX: CELL * .8, diameterY: CELL * .55, diameterZ: CELL * .75, segments: 8 }, scene), rockM);
      const sRing = src(B.MeshBuilder.CreateTorus('cavRing', { diameter: CELL * .72, thickness: .07, tessellation: 24 }, scene), ringM);
      const sHint = src(B.MeshBuilder.CreateTorus('cavHint', { diameter: CELL * .86, thickness: .1, tessellation: 24 }, scene), hintM);
      let board = null; // { k, W, H, open[], n, tiles[], path[], marks[], rings[], hints, nodes[] }
      const st = { phase: 'pick', anim: null, wait: 0 };
      const posOf = (i) => { const x = i % board.W, y = Math.floor(i / board.W); return new V3(AT[0] + (x - (board.W - 1) / 2) * CELL, 0, AT[1] + ((board.H - 1) / 2 - y) * CELL); };
      const nbrs = (i) => { const x = i % board.W, y = Math.floor(i / board.W), o = []; for (const [dx, dy] of J) { const a = x + dx, b = y + dy; if (a >= 0 && b >= 0 && a < board.W && b < board.H && board.open[b * board.W + a]) o.push(b * board.W + a); } return o; };
      const visited = () => new Set(board.path);
      const moves = () => { const v = visited(); return nbrs(board.path[board.path.length - 1]).filter(j => !v.has(j)); };
      function build(k) {
        if (board) [...board.nodes, ...board.rings].forEach(n => { try { n.dispose(); } catch (e) {} }); // the rings too (R left them on the board)
        const rows = LV[k], W = Math.max(...rows.map(r => r.length)), Hh = rows.length;
        board = { k, W, H: Hh, open: [], n: 0, tiles: [], path: [], marks: [], rings: [], hints: 0, nodes: [] };
        let s = 0; rows.forEach((r, y) => { for (let x = 0; x < W; x++) { const c = r[x] || '#', i = y * W + x; board.open[i] = c !== '#'; if (c !== '#') board.n++; if (c === 'K') s = i; } });
        const put = (sm, p, y, name) => { const m = sm.createInstance(name || 'cavPart'); m.parent = ctx.frame; ctx.add(m); m.position.set(p.x, y, p.z); board.nodes.push(m); return m; };
        for (let i = 0; i < W * Hh; i++) { const x = i % W, y = Math.floor(i / W), p = posOf(i); const t = put((x + y) % 2 ? sDark : sLight, p, .06, 'cavTile'); t.isPickable = true; t.metadata = { cavCell: i }; board.tiles[i] = t;
          if (!board.open[i]) put(sRock, p, .3); }
        const rimAt = (x, y) => new V3(AT[0] + (x - (W - 1) / 2) * CELL, 0, AT[1] + ((Hh - 1) / 2 - y) * CELL);
        for (let x = -1; x <= W; x++) for (const y of [-1, Hh]) put(sRim, rimAt(x, y), .15);
        for (let y = 0; y < Hh; y++) for (const x of [-1, W]) put(sRim, rimAt(x, y), .15);
        board.path = [s]; mark(s, 1);
        const p = posOf(s); ctx.player.place(p.x, p.z, 0);
        const span = Math.max(W, Hh) * CELL;
        st.cam = [AT[0], span * 1.25 + 4.6, AT[1] - span * .72 - 2.7]; st.at = [AT[0], 0, AT[1] - span * .08]; // Oct 17: back, up and aimed nearer: the near row sat under the hint bar
        rings(); info();
      }
      function mark(i, n) { const p = posOf(i), m = B.MeshBuilder.CreatePlane('cavMark', { size: CELL * .62 }, scene); m.material = numMat(n, 'v'); m.rotation.x = Math.PI / 2; m.parent = ctx.frame; ctx.add(m); m.position.set(p.x + CELL * .26, .14, p.z - CELL * .26); m.scaling.setAll(.62); m.isPickable = false; board.marks.push(m); board.nodes.push(m); }
      function rings(hintAt) {
        board.rings.forEach(r => r.dispose()); board.rings = [];
        if (st.phase !== 'play' && st.phase !== 'pick') return;
        moves().forEach((j, k) => { const p = posOf(j); const r = (j === hintAt ? sHint : sRing).createInstance('cavRingI'); r.parent = ctx.frame; ctx.add(r); r.position.set(p.x, .16, p.z); board.rings.push(r);
          const lab = B.MeshBuilder.CreatePlane('cavLabel', { size: CELL * .5 }, scene); lab.material = numMat(k + 1, 'k'); lab.rotation.x = Math.PI / 2; lab.parent = ctx.frame; ctx.add(lab); lab.position.set(p.x, .17, p.z); lab.isPickable = false; board.rings.push(lab); });
      }
      const info = () => H.info(board ? `Board ${board.k + 1} / ${LV.length} · ${board.path.length} / ${board.n} squares${board.hints ? ` · hints ${board.hints}` : ''}` : 'Pick a board');
      function ride(j) {
        if (st.phase !== 'play' || st.anim) return false;
        const opts = moves(); if (!opts.includes(j)) return false;
        const from = board.path[board.path.length - 1]; board.path.push(j);
        st.anim = { t: 0, from: posOf(from), to: posOf(j), yaw: Math.atan2(posOf(j).x - posOf(from).x, posOf(j).z - posOf(from).z) };
        ctx.player.clip('jump'); ctx.note(392 + board.path.length * 8, 'bell');
        board.rings.forEach(r => r.dispose()); board.rings = []; info(); return true;
      }
      function landed() {
        const j = board.path[board.path.length - 1]; mark(j, board.path.length);
        if (board.path.length === board.n) { st.phase = 'solved'; st.wait = 1.4; ctx.sound('gamewin'); H.msg('Every square ridden', 1300, board.hints ? `${board.hints} hint${board.hints > 1 ? 's' : ''}` : 'a clean ride'); pads.style.display = 'none';
          if (board.k + 1 > solvedUpTo) { solvedUpTo = board.k + 1; try { localStorage.setItem(KEY, String(solvedUpTo)); } catch (e) {} } return; }
        rings(); if (!moves().length) { ctx.sound('thock'); H.msg('No way on', 1400, 'U takes the last ride back'); }
      }
      function undo() {
        if (!board || st.phase !== 'play' || st.anim || board.path.length < 2) return;
        board.path.pop(); const m = board.marks.pop(); m.dispose();
        const p = posOf(board.path[board.path.length - 1]); ctx.player.place(p.x, p.z); rings(); info();
      }
      function hint() {
        if (st.phase !== 'play' || st.anim) return;
        const v = visited(), opts = moves(); if (!opts.length) return;
        const deg = (j) => nbrs(j).filter(x => !v.has(x) && x !== j).length;
        const best = opts.slice().sort((a, b) => deg(a) - deg(b))[0]; board.hints++; rings(best); info(); H.msg('Try the green ring', 900);
      }
      function restart() { if (st.phase !== 'play') return; if (st.anim) { st.anim = null; ctx.player.idle(); } const h = board.hints; build(board.k); board.hints = h; info(); H.msg('Again', 600); }
      const hud = document.getElementById('gameHud');
      const pick = document.createElement('div');
      pick.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(' + (LV.length > 6 && innerWidth >= 600 ? 560 : 380) + 'px,92vw);background:rgba(12,14,24,.94);border:1px solid rgba(216,179,92,.6);border-radius:14px;padding:16px;text-align:center;pointer-events:auto;font:15px/1.4 Georgia,serif;color:#eee';
      const drawPick = () => { pick.innerHTML = `<div style="font:700 13px/1.2 Georgia,serif;letter-spacing:.14em;text-transform:uppercase;color:#d8b35c;margin-bottom:10px">The Cavalry Ride</div><div style="margin-bottom:12px;color:#bbb">Ride like the cavalry piece and touch every square once.</div>`
        + `<div style="display:grid;grid-template-columns:repeat(${LV.length > 6 && innerWidth >= 600 ? 5 : 4},1fr);gap:8px">${LV.map((r, k) => { const open = k <= solvedUpTo, done = k < solvedUpTo; return `<button type="button" data-k="${k}" ${open ? '' : 'disabled'} style="padding:8px 4px;border-radius:9px;border:1px solid ${open ? '#d8b35c' : '#444'};background:${done ? 'rgba(216,179,92,.25)' : 'rgba(255,255,255,.04)'};color:${open ? '#fff' : '#666'};font:700 15px Georgia,serif;cursor:${open ? 'pointer' : 'default'}">${open ? `${k + 1}<div style="font:11px Georgia,serif;opacity:.75">${r[0].length} × ${r.length}</div>` : '🔒'}${done ? ' ✓' : ''}</button>`; }).join('')}</div>`;
        pick.querySelectorAll('button[data-k]').forEach(b => b.onclick = (e) => { e.stopPropagation(); b.blur(); choose(+b.dataset.k); }); };
      function choose(k) { if (st.phase !== 'pick' || k > solvedUpTo || k >= LV.length) return; pick.remove(); st.phase = 'play'; build(k); pads.style.display = 'flex'; H.msg(`Board ${k + 1}`, 900, k >= 4 ? 'a long ride' : ''); }
      const pads = document.createElement('div');
      pads.style.cssText = 'position:absolute;bottom:62px;right:16px;display:none;gap:6px;pointer-events:auto';
      const pad = (t, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.style.cssText = 'min-width:52px;height:40px;border-radius:8px;border:1px solid #b8964a;background:rgba(14,16,28,.82);color:#ffe9b0;font:700 14px Georgia,serif;cursor:pointer'; b.onclick = (e) => { e.stopPropagation(); b.blur(); fn(); }; pads.appendChild(b); };
      pad('↶ Undo', undo); pad('Hint', hint); pad('⟲', restart);
      hud.append(pick, pads);
      drawPick();
      st.cam = [AT[0], 12, AT[1] - 9.5]; st.at = [AT[0], 0, AT[1]];
      ctx.look(st.cam, st.at, def.fov || .8);
      H.title(def.title || 'The Cavalry Ride'); H.score(''); info();
      H.hint('Click a glowing square (or press its number) to ride there: two squares one way, one to the side. <kbd>U</kbd> undo, <kbd>H</kbd> hint, <kbd>R</kbd> start again.');
      const inst = {
        update(dt) {
          ctx.look(st.cam, st.at);
          const a = st.anim;
          if (a) { a.t += dt / .36; const u = Math.min(1, a.t), e = u * u * (3 - 2 * u); const p = V3.Lerp(a.from, a.to, e); ctx.player.place(p.x, p.z, a.yaw); if (u >= 1) { st.anim = null; ctx.player.idle(); landed(); } }
          if (st.phase === 'solved' && (st.wait -= dt) <= 0) {
            st.phase = 'done'; H.hint('');
            const k = board.k, score = (k + 1) * 20 + (board.hints ? 0 : 10);
            ctx.finish({ score, label: 'points', solved: true, extra: `Board ${k + 1} (${LV[k][0].length} × ${LV[k].length}) ridden${board.hints ? ` with ${board.hints} hint${board.hints > 1 ? 's' : ''}` : ' without a hint'}.${k + 1 < LV.length ? ` Board ${k + 2} is open.` : ' Every board ridden.'}` });
          }
        },
        key(e, down) {
          if (!down || e.repeat) return; const k = e.key.toLowerCase();
          if (st.phase === 'pick') { const n = k === '0' ? 10 : parseInt(k, 10); if (n >= 1 && n <= LV.length) choose(n - 1); return; } // 1-9, 0 = the tenth
          const n = parseInt(k, 10); if (n >= 1 && n <= 8) { const o = moves(); if (o[n - 1] != null) ride(o[n - 1]); return; }
          if (k === 'u' || k === 'z' || k === 'backspace') undo(); else if (k === 'h') hint(); else if (k === 'r') restart();
        },
        pointer(evt) {
          if (evt.type !== B.PointerEventTypes.POINTERDOWN || st.phase !== 'play') return;
          const hit = scene.pickWithRay(ctx.ray(), m => !!m.metadata?.cavCell || m.metadata?.cavCell === 0);
          const i = hit?.pickedMesh?.metadata?.cavCell; if (i != null) ride(i);
        },
        restart, // the HUD's Restart button (as R)
        _test: { st, ride, undo, hint, choose, moves, nbrs, get board() { return board; }, LV },
        dispose() { pick.remove(); pads.remove(); if (board) { board.nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); board.rings.forEach(n => { try { n.dispose(); } catch (e) {} }); } }
      };
      return inst;
    }
  };
  window.RebelGames.register('knight', G);
})();
