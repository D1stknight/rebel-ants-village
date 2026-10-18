// The Ancestor's Grid (Oct 15, Samurai): number grids carved by the clan's ancestors. Fill every square so each row,
// each column and each box holds every number once. Click a square (or move with the arrows), type its number;
// N writes small pencil notes instead, 0 / Backspace rubs out, U undoes, H shows a mistake or one square (no clean
// bonus then). Ten grids: a 4 x 4, two 6 x 6, seven 9 x 9; the last ones need pairs and pointing, not just singles
// (each has one answer, checked by a solver). Score: the grid x 20, +10 without a hint.
// Oct 17: How to play (the rules in a few lines) and Restart (the grid as picked: only the carved numbers, no notes,
// undo, hints or time).
// Oct 17 (Miguel: "move it up to 10"): grids 8-10 (Master, Grandmaster, Ancestor), 9 x 9 with 26, 28 and 25 givens
// (symmetric about the centre). Made by scratchpad lv/sudoku/pool3.mjs: givens taken out in pairs, each time the pair
// that leaves one answer (countSolutions) and the most work for the grader of scratchpad sudoku/gen.mjs while it still
// gets through with singles, hidden singles, pairs and pointing (level 3, no guessing). They need pairs / pointing 7, 8
// and 10 times (lv/sudoku/grade2.mjs; grids 5-7: 2, 3, 1). The picker takes 5 columns on wide screens.
// def: { levels: [{ g: 'givens, 0 = empty', s: 'solution' }], pass, points }
(function () {
  const LEVELS = [
    { g: '0000023443200000', s: '3412123443212143', name: 'Easy' },
    { g: '010300000250001023320500043000005030', s: '512346634251451623326514243165165432', name: 'Easy' },
    { g: '000003304002000020010000200604500000', s: '125463364512453126612345231654546231', name: 'Medium' },
    { g: '009120700010007020002600509103080060000070000060090805206005900080700050001062300', s: '549123786618957423732648519193584267825376194467291835276835941384719652951462378', name: 'Medium' },
    { g: '058000000740860000100009000063100005400070009900004130000200008000016074000000360', s: '358742691749861253126359487263198745415673829987524136674235918832916574591487362', name: 'Hard' },
    { g: '800000430075000000600090008084300000050060090000008310400050002000000760036000001', s: '829176435175834629643295178784319256351762894962548317417653982598421763236987541', name: 'Hard' },
    { g: '080400006007000800500700004700008090010000020060500007400007003009000100600003050', s: '183492576247635819596781234735268491814379625962514387458127963379856142621943758', name: 'Master' },
    { g: '000000859003000004020400100001086000008304700000970300007001030100000900862000000', s: '416237859783159624529468173371586492298314765645972318957841236134625987862793541', name: 'Master' },
    { g: '100000000870105000003942000700609020400000001090204007000591600000706054000000002', s: '129378546874165239653942718781639425462857391395214867247591683938726154516483972', name: 'Grandmaster' },
    { g: '700400000090010240603000005000804000006050300000902000300000902085020010000009008', s: '712495863598316247643278195159834726426157389837962451364581972985723614271649538', name: 'Ancestor' }
  ];
  const BOX = { 4: [2, 2], 6: [2, 3], 9: [3, 3] };
  const G = {
    title: "The Ancestor's Grid",
    howTo: { lines: [
      'Fill every empty square so that each row, each column and each box (inside the thick lines) holds every number once: 1 to 4, 1 to 6 or 1 to 9, as big as the grid.',
      'Click (or tap) a square, or move the gold square with the arrows / W A S D, then type its number or press its button. The dark carved numbers never change.',
      'The gold square\'s row, column and box are shaded, and squares with its number turn blue. A clash (the same number twice in a row, column or box) turns red.',
      'N (or the ✎ button) switches pencil notes on and off: a number typed then goes in small, for what the square might still hold. A number written in a square rubs that note out of its row, column and box.',
      '0, Backspace or ⌫ rubs a square out; U (or ↶) undoes. Restart lays the grid out again as it was carved.',
      'H (or Hint) points out a mistake, or fills one square for you; a grid solved with no hint pays 10 more points.',
      'Tip: find a square where only one number is left, or a number that fits in only one square of its row, column or box.'],
      img: 'howto/sudoku.png', caption: 'A 4 x 4 grid part way through: the gold square can only be 3 (its row holds 1 and 2, its column 4 and 2). The noted square might still be 1 or 4.' },
    start(ctx) {
      const B = ctx.B, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const LV = def.levels || LEVELS, KEY = 'rebelAntsGridProgress:' + (def.id || 'sudoku');
      let solvedUpTo = 0; try { solvedUpTo = Math.max(0, Math.min(LV.length, Number(localStorage.getItem(KEY)) || 0)); } catch (e) {}
      const mat = (k, c, em, o = {}) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(.05, .05, .05); if (em) m.emissiveColor = new B.Color3(...em); return m; });
      const stoneM = mat('slab', [.36, .33, .3], [.08, .07, .06]), woodM = mat('frame', [.42, .16, .1], [.1, .04, .03]);
      const nodes = [], keep = n => { n.parent = n.parent || ctx.frame; ctx.add(n); nodes.push(n); if (n.isPickable !== undefined) n.isPickable = false; return n; };
      const TEX = 1024, tex = new B.DynamicTexture('sudokuTex', { width: TEX, height: TEX }, scene, true); tex.hasAlpha = false;
      // the board's own material (not a kept one: its texture lives only as long as this game)
      const boardM = new B.StandardMaterial('sudokuBoardMat', scene); boardM.diffuseTexture = tex; boardM.emissiveTexture = tex; boardM.emissiveColor = new B.Color3(.55, .55, .55); boardM.diffuseColor = new B.Color3(.6, .6, .6); boardM.specularColor = new B.Color3(0, 0, 0);
      let board = null; // { k, N, S, giv[], val[], notes[], sol[], sel, notesOn, hist[], hints, time, mesh, slab[], flash }
      const st = { phase: 'pick', t: 0, cam: [0, 7, -4.5], at: [0, .4, .2] };
      let built = [];
      function unitsOf(N) { const [br, bc] = BOX[N], peers = [];
        for (let i = 0; i < N * N; i++) { const r = Math.floor(i / N), c = i % N, R = Math.floor(r / br) * br, C = Math.floor(c / bc) * bc, p = new Set();
          for (let k = 0; k < N; k++) { p.add(r * N + k); p.add(k * N + c); } for (let y = R; y < R + br; y++) for (let x = C; x < C + bc; x++) p.add(y * N + x); p.delete(i); peers.push([...p]); }
        return peers; }
      function build(k) {
        built.forEach(n => { try { n.dispose(); } catch (e) {} }); built = [];
        const L = LV[k], N = Math.round(Math.sqrt(L.g.length)), S = N === 9 ? 4.6 : N === 6 ? 3.7 : 2.9;
        board = { k, N, S, giv: [...L.g].map(Number), sol: [...L.s].map(Number), sel: -1, notesOn: false, hist: [], hints: 0, time: 0, flash: null, peers: unitsOf(N) };
        board.val = board.giv.slice(); board.notes = new Array(N * N).fill(0);
        const slab = keep(B.MeshBuilder.CreateBox('sudokuSlab', { width: S + .7, height: .42, depth: S + .7 }, scene)); slab.material = stoneM; slab.position.set(0, .21, 0); built.push(slab);
        for (const [x, z, w, d] of [[0, S / 2 + .2, S + .5, .14], [0, -S / 2 - .2, S + .5, .14], [S / 2 + .2, 0, .14, S + .26], [-S / 2 - .2, 0, .14, S + .26]]) { const f = keep(B.MeshBuilder.CreateBox('sudokuFrame', { width: w, height: .1, depth: d }, scene)); f.material = woodM; f.position.set(x, .47, z); built.push(f); }
        const m = keep(B.MeshBuilder.CreateGround('sudokuBoard', { width: S, height: S }, scene)); m.material = boardM; m.position.y = .425; m.isPickable = true; m.metadata = { sudokuBoard: true }; built.push(m); board.mesh = m;
        st.cam = [0, S * 1.22 + 1.3, -S * .66 - .9]; st.at = [0, .42, S * .03];
        ctx.player.place(0, st.cam[2] - 1.6, 0); // the player waits behind the camera, out of the picture
        select(N === 9 ? 40 : N === 6 ? 14 : 5); draw(); info();
      }
      const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
      const info = () => H.info(board ? `Grid ${board.k + 1} / ${LV.length} · ${board.N} × ${board.N} · ${fmt(board.time)}${board.notesOn ? ' · notes on' : ''}${board.hints ? ` · hints ${board.hints}` : ''}` : 'Pick a grid');
      function conflicts() { const b = board, bad = new Set(); for (let i = 0; i < b.N * b.N; i++) if (b.val[i]) for (const j of b.peers[i]) if (b.val[j] === b.val[i]) { bad.add(i); bad.add(j); } return bad; }
      function draw() {
        const b = board, g = tex.getContext(), N = b.N, M = 26, C = (TEX - 2 * M) / N, [br, bc] = BOX[N], bad = conflicts(), sv = b.sel >= 0 ? b.val[b.sel] : 0;
        const grd = g.createRadialGradient(TEX / 2, TEX / 2, TEX * .2, TEX / 2, TEX / 2, TEX * .75); grd.addColorStop(0, '#efe3c6'); grd.addColorStop(1, '#d9c7a0'); g.fillStyle = grd; g.fillRect(0, 0, TEX, TEX);
        for (let i = 0; i < N * N; i++) { const r = Math.floor(i / N), c = i % N, x = M + c * C, y = M + r * C; let fill = null;
          if (b.sel >= 0) { const sr = Math.floor(b.sel / N), sc = b.sel % N, sameBox = Math.floor(r / br) === Math.floor(sr / br) && Math.floor(c / bc) === Math.floor(sc / bc);
            if (r === sr || c === sc || sameBox) fill = 'rgba(255,228,150,.32)'; if (sv && b.val[i] === sv) fill = 'rgba(120,165,255,.34)'; }
          if (bad.has(i)) fill = 'rgba(220,40,40,.32)'; if (i === b.sel) fill = 'rgba(255,190,50,.62)'; if (b.flash && b.flash.i === i) fill = b.flash.good ? 'rgba(80,200,110,.55)' : 'rgba(230,40,40,.6)';
          if (fill) { g.fillStyle = fill; g.fillRect(x, y, C, C); }
          const v = b.val[i];
          if (v) { const given = !!b.giv[i]; g.fillStyle = given ? '#1d140c' : bad.has(i) ? '#c01818' : '#9e1b1b'; g.font = `${given ? 'bold ' : ''}${Math.round(C * .62)}px Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(v), x + C / 2, y + C * .54); }
          else if (b.notes[i]) { const cols = N === 4 ? 2 : 3, rows = Math.ceil(N / cols); g.fillStyle = 'rgba(70,50,30,.85)'; g.font = `${Math.round(C * (N === 9 ? .25 : .27))}px Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
            for (let d = 1; d <= N; d++) if (b.notes[i] & (1 << d)) { const q = d - 1, cx = x + C * ((q % cols) + .5) / cols, cy = y + C * (Math.floor(q / cols) + .55) / rows; g.fillText(String(d), cx, cy); } } }
        g.strokeStyle = 'rgba(60,40,20,.55)'; g.lineWidth = 2; g.beginPath();
        for (let k = 0; k <= N; k++) { g.moveTo(M + k * C, M); g.lineTo(M + k * C, TEX - M); g.moveTo(M, M + k * C); g.lineTo(TEX - M, M + k * C); } g.stroke();
        g.strokeStyle = '#2b1d10'; g.lineWidth = 7; g.beginPath();
        for (let k = 0; k <= N; k += bc) { g.moveTo(M + k * C, M); g.lineTo(M + k * C, TEX - M); } for (let k = 0; k <= N; k += br) { g.moveTo(M, M + k * C); g.lineTo(TEX - M, M + k * C); } g.stroke();
        tex.update();
      }
      function select(i) { if (!board) return; board.sel = i; }
      function moveSel(dx, dy) { if (!board) return; const N = board.N; let i = board.sel < 0 ? 0 : board.sel; const r = (Math.floor(i / N) + dy + N) % N, c = (i % N + dx + N) % N; select(r * N + c); draw(); }
      function setCell(i, v, asNote) {
        const b = board; if (st.phase !== 'play' || i < 0 || b.giv[i]) return false;
        if (asNote) { if (b.val[i]) return false; b.hist.push({ i, v: b.val[i], n: b.notes[i] }); b.notes[i] ^= (1 << v); draw(); return true; }
        if (b.val[i] === v) return false;
        b.hist.push({ i, v: b.val[i], n: b.notes[i], peers: v ? b.peers[i].map(j => [j, b.notes[j]]) : null });
        b.val[i] = v; b.notes[i] = 0; if (v) for (const j of b.peers[i]) b.notes[j] &= ~(1 << v); // a number placed rubs that note out of its row, column and box
        ctx.note(v ? 600 + v * 45 : 300, 'lantern'); draw(); check(); return true;
      }
      function write(v) { if (!board || board.sel < 0) return; setCell(board.sel, v, board.notesOn && v > 0); }
      function undo() { if (st.phase !== 'play' || !board?.hist.length) return; const h = board.hist.pop(); board.val[h.i] = h.v; board.notes[h.i] = h.n; if (h.peers) h.peers.forEach(([j, n]) => { board.notes[j] = n; }); select(h.i); draw(); }
      function hint() {
        if (st.phase !== 'play' || !board) return; const b = board, N = b.N;
        const wrong = b.val.findIndex((v, i) => v && !b.giv[i] && v !== b.sol[i]);
        board.hints++; info();
        if (wrong >= 0) { select(wrong); b.flash = { i: wrong, t: 0, good: false }; H.msg('This one is wrong', 1300); draw(); return; }
        const cands = i => { let n = 0; for (let d = 1; d <= N; d++) if (!b.peers[i].some(j => b.val[j] === d)) n++; return n; };
        let best = -1, bn = 99; if (b.sel >= 0 && !b.val[b.sel]) { best = b.sel; bn = cands(b.sel); }
        if (bn > 1) for (let i = 0; i < N * N; i++) if (!b.val[i]) { const n = cands(i); if (n < bn) { bn = n; best = i; } }
        if (best < 0) return; select(best); b.flash = { i: best, t: 0, good: true }; H.msg(`This one is ${b.sol[best]}`, 1300); setCell(best, b.sol[best], false);
      }
      function check() {
        const b = board; if (!b.val.every((v, i) => v === b.sol[i])) return;
        st.phase = 'won'; st.wt = 0; b.sel = -1; draw(); pads.style.display = 'none'; ctx.sound('gamewin'); H.msg('The grid is whole', 1600, fmt(b.time));
        if (b.k + 1 > solvedUpTo) { solvedUpTo = b.k + 1; try { localStorage.setItem(KEY, String(solvedUpTo)); } catch (e) {} }
      }
      const hud = document.getElementById('gameHud');
      const pick = document.createElement('div');
      pick.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(' + (LV.length > 6 && innerWidth >= 600 ? 560 : 390) + 'px,90vw);background:rgba(22,10,8,.94);border:1px solid rgba(220,90,70,.6);border-radius:14px;padding:16px;text-align:center;pointer-events:auto;font:15px/1.4 system-ui,sans-serif;color:#eee';
      const drawPick = () => { pick.innerHTML = `<div style="font:800 13px/1.2 system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#f0a090;margin-bottom:10px">The Ancestor's Grid</div><div style="margin-bottom:12px;color:#bbb">Every row, column and box holds each number once.</div>`
        + `<div style="display:grid;grid-template-columns:repeat(${LV.length > 6 && innerWidth >= 600 ? 5 : 4},1fr);gap:8px">${LV.map((L, k) => { const open = k <= solvedUpTo, ok = k < solvedUpTo, n = Math.round(Math.sqrt(L.g.length)); return `<button type="button" data-k="${k}" ${open ? '' : 'disabled'} style="padding:8px 2px;border-radius:9px;border:1px solid ${open ? '#f0a090' : '#444'};background:${ok ? 'rgba(240,160,144,.22)' : 'rgba(255,255,255,.04)'};color:${open ? '#fff' : '#666'};font:700 15px system-ui,sans-serif;cursor:${open ? 'pointer' : 'default'}">${open ? `${k + 1}<div style="font:11px system-ui;opacity:.75">${n}×${n} ${L.name || ''}</div>` : '🔒'}${ok ? ' ✓' : ''}</button>`; }).join('')}</div>`;
        pick.querySelectorAll('button[data-k]').forEach(b => b.onclick = (e) => { e.stopPropagation(); b.blur(); choose(+b.dataset.k); }); };
      const pads = document.createElement('div');
      pads.style.cssText = 'position:absolute;bottom:62px;right:14px;display:none;grid-template-columns:repeat(3,44px);gap:5px;pointer-events:auto';
      const padBtn = (t, fn, wide) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.style.cssText = `height:40px;${wide ? 'grid-column:span 3;' : ''}border-radius:8px;border:1px solid #c9705e;background:rgba(28,12,10,.85);color:#ffe9e2;font:700 16px Georgia,serif;cursor:pointer`; b.onclick = (e) => { e.stopPropagation(); b.blur(); fn(); }; pads.appendChild(b); return b; };
      let notesBtn = null;
      const drawPads = N => { pads.innerHTML = ''; for (let d = 1; d <= N; d++) padBtn(String(d), () => write(d)); notesBtn = padBtn('✎', () => toggleNotes()); padBtn('⌫', () => write(0)); padBtn('↶', undo); padBtn('Hint', hint, true); };
      function toggleNotes() { if (!board) return; board.notesOn = !board.notesOn; if (notesBtn) notesBtn.style.background = board.notesOn ? 'rgba(200,110,90,.75)' : 'rgba(28,12,10,.85)'; info(); }
      function choose(k) { if (st.phase !== 'pick' || k > solvedUpTo || k >= LV.length) return; pick.remove(); st.phase = 'play'; build(k); drawPads(board.N); pads.style.display = 'grid'; H.msg(`Grid ${k + 1}`, 900, LV[k].name || ''); }
      hud.append(pick, pads); drawPick();
      ctx.look(st.cam, st.at, def.fov || .8);
      H.title(def.title || "The Ancestor's Grid"); H.score(''); info();
      H.hint('Click a square, type its number. <kbd>N</kbd> pencil notes, <kbd>0</kbd> rub out, <kbd>U</kbd> undo, <kbd>H</kbd> hint.');
      return {
        update(dt) {
          ctx.look(st.cam, st.at); st.t += dt; if (!board) return;
          if (st.phase === 'play') { const before = Math.floor(board.time); board.time += dt; if (Math.floor(board.time) !== before) info(); }
          if (board.flash && (board.flash.t += dt) > 1.2) { board.flash = null; draw(); }
          if (st.phase === 'won' && (st.wt += dt) > 1.8) { st.phase = 'done'; H.hint(''); const k = board.k, score = (k + 1) * 20 + (board.hints ? 0 : 10);
            ctx.finish({ score, label: 'points', solved: true, extra: `Grid ${k + 1} (${board.N} × ${board.N}) filled in ${fmt(board.time)}${board.hints ? `, ${board.hints} hint${board.hints > 1 ? 's' : ''}` : ''}.${k + 1 < LV.length ? ` Grid ${k + 2} is open.` : ' Every grid filled.'}` }); }
        },
        key(e, down) {
          if (!down || e.repeat) return; const k = e.key.toLowerCase();
          if (st.phase === 'pick') { const n = k === '0' ? 10 : parseInt(k, 10); if (n >= 1 && n <= LV.length) choose(n - 1); return; } // 1-9, 0 = the tenth
          if (st.phase !== 'play') return;
          if (/^[1-9]$/.test(k) && +k <= board.N) write(+k);
          else if (k === '0' || k === 'backspace' || k === 'delete') write(0);
          else if (k === 'arrowup' || k === 'w') moveSel(0, -1); else if (k === 'arrowdown' || k === 's') moveSel(0, 1); else if (k === 'arrowleft' || k === 'a') moveSel(-1, 0); else if (k === 'arrowright' || k === 'd') moveSel(1, 0);
          else if (k === 'n' || k === 'p') toggleNotes(); else if (k === 'u' || k === 'z') undo(); else if (k === 'h') hint();
        },
        pointer(evt) {
          if (evt.type !== B.PointerEventTypes.POINTERDOWN || st.phase !== 'play' || !board) return;
          const hit = scene.pickWithRay(ctx.ray(), m => m.metadata?.sudokuBoard); if (!hit?.pickedPoint) return;
          const l = ctx.toLocal(hit.pickedPoint), N = board.N, S = board.S, c = Math.floor((l.x + S / 2) / S * N), r = Math.floor((S / 2 - l.z) / S * N);
          if (c >= 0 && c < N && r >= 0 && r < N) { select(r * N + c); draw(); }
        },
        // Restart: the grid as it was picked (only the carved numbers; no notes, undo, hints or time, notes off); only
        // while it is being played
        restart() { if (st.phase !== 'play' || !board) return; build(board.k); drawPads(board.N); H.msg('Start again', 900); },
        _test: { st, choose, setCell, write, undo, hint, select, moveSel, toggleNotes, conflicts, get board() { return board; }, LV },
        dispose() { pick.remove(); pads.remove(); built.forEach(n => { try { n.dispose(); } catch (e) {} }); nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); try { boardM.dispose(); tex.dispose(); } catch (e) {} }
      };
    }
  };
  window.RebelGames.register('sudoku', G);
})();
