// The Buried Chest (Oct 15, Wokou): the Broker's chests are buried somewhere on this stretch of beach. Dig a square
// (click it, or move the frame with the arrows and press Space): a stake shows how many squares away the nearest
// chest still buried lies (rows plus columns, no diagonals). Find every chest before the digs run out. Six beaches,
// one to three chests; the dig limits come from a solver (level 4 leaves no dig to waste). Score: the beach x 20, +5
// for every dig left.
// def: { at: [x, z] (frame coords of the beach's middle), cell: 1.2, levels: [{ n, chests, digs, rocks: [index] }], pass, points }
// Oct 17 (Miguel: the puzzles need a how-to with an example, every board a Restart): howTo (the rules + two stakes that
// pin a chest, howto/dig.png) and inst.restart (the same beach and digs, the chests buried again elsewhere: the old stakes
// would give them away).
(function () {
  const LEVELS = [
    { n: 6, chests: 1, digs: 6 },
    { n: 8, chests: 1, digs: 5 },
    { n: 8, chests: 2, digs: 9 },
    { n: 8, chests: 1, digs: 4 },
    { n: 10, chests: 2, digs: 8, rocks: [23, 24, 45, 66, 67, 74] },
    { n: 9, chests: 3, digs: 11, rocks: [12, 30, 41, 50, 68] }
  ];
  const G = {
    title: 'The Buried Chest',
    howTo: {
      lines: ['Chests are buried somewhere on this beach. Find all of them before your digs run out (the info line counts both).',
        'Click a square to dig it, or move the gold frame with the arrow keys and press Space.',
        'An empty dig leaves a stake with a number: how many squares away the nearest chest still buried is, counted across plus up and down (never on a slant).',
        'So a 1 means a chest lies right beside it, above or below it. Rocks can\'t be dug.',
        'Tip: read two or three stakes together: only a few squares fit all their numbers. Every dig you have left over is worth 5 points.'],
      img: 'howto/dig.png', caption: 'Two stakes say 3 and 4: only one square fits both, and the chest is there.'
    },
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const LV = def.levels || LEVELS, CELL = def.cell || 1.2, AT = def.at || [0, 0];
      const KEY = 'rebelAntsChestProgress:' + (def.id || 'dig');
      let solvedUpTo = 0; try { solvedUpTo = Math.max(0, Math.min(LV.length, Number(localStorage.getItem(KEY)) || 0)); } catch (e) {}
      const mat = (k, c, em, o = {}) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(.05, .05, .05); if (em) m.emissiveColor = new B.Color3(...em); if (o.flat) m.disableLighting = true; if (o.alpha != null) m.alpha = o.alpha; return m; });
      const sandA = mat('sandA', [.86, .76, .55], [.17, .15, .11]), sandB = mat('sandB', [.8, .7, .5], [.16, .14, .1]), holeM = mat('hole', [.42, .33, .22], [.07, .055, .035]);
      const rockM = mat('rock', [.45, .43, .4], [.07, .07, .065]), stakeM = mat('stake', [.45, .32, .18], [.08, .055, .03]), woodM = mat('chestWood', [.45, .25, .12], [.09, .05, .02]);
      const goldM = mat('chestGold', [1, .8, .3], [.55, .4, .1]), selM = mat('sel', [1, .85, .35], [1, .78, .25], { flat: true }), ropeM = mat('rope', [.6, .5, .3], [.1, .08, .05]);
      const numMats = {}, numMat = (n) => numMats[n] || (numMats[n] = ctx.mat('num' + n, nm => { const m = new B.StandardMaterial(nm, scene); const t = new B.DynamicTexture(nm + 'T', { width: 128, height: 128 }, scene, true); const g = t.getContext();
        g.fillStyle = '#efe2c2'; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#6b4a28'; g.lineWidth = 8; g.strokeRect(4, 4, 120, 120); g.fillStyle = '#3a2410'; g.font = `bold ${n > 9 ? 66 : 80}px Georgia`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), 64, 70); t.update();
        m.diffuseTexture = t; m.emissiveTexture = t; m.emissiveColor = new B.Color3(.35, .35, .35); m.specularColor = new B.Color3(0, 0, 0); m.backFaceCulling = false; return m; }));
      const src = (m, mt) => { m.material = mt; m.isPickable = false; m.isVisible = false; ctx.add(m); return m; };
      const sTileA = src(B.MeshBuilder.CreateBox('digTileA', { width: CELL * .99, height: .1, depth: CELL * .99 }, scene), sandA);
      const sTileB = src(B.MeshBuilder.CreateBox('digTileB', { width: CELL * .99, height: .1, depth: CELL * .99 }, scene), sandB);
      const sHole = src(B.MeshBuilder.CreateCylinder('digHole', { height: .04, diameter: CELL * .7, tessellation: 14 }, scene), holeM);
      const sMound = src(B.MeshBuilder.CreateSphere('digMound', { diameterX: CELL * .5, diameterY: .22, diameterZ: CELL * .4, segments: 6 }, scene), sandB);
      const sRock = src(B.MeshBuilder.CreateSphere('digRock', { diameterX: CELL * .85, diameterY: CELL * .6, diameterZ: CELL * .8, segments: 7 }, scene), rockM);
      const sStake = src(B.MeshBuilder.CreateBox('digStake', { width: .08, height: 1.0, depth: .08 }, scene), stakeM);
      const sRope = src(B.MeshBuilder.CreateBox('digRope', { width: CELL, height: .04, depth: .04 }, scene), ropeM);
      const sel = B.MeshBuilder.CreateTorus('digSel', { diameter: CELL * 1.18, thickness: .06, tessellation: 4 }, scene); sel.material = selM; sel.rotation.y = Math.PI / 4; sel.parent = ctx.frame; sel.isPickable = false; ctx.add(sel); sel.setEnabled(false);
      let board = null; // { k, n, rocks:Set, chests:[], found:Set, dug:Map(i -> number|'X'), digs, nodes[], sel }
      const st = { phase: 'pick', wait: 0, anim: null };
      const posOf = i => new V3(AT[0] + (i % board.n - (board.n - 1) / 2) * CELL, 0, AT[1] + ((board.n - 1) / 2 - Math.floor(i / board.n)) * CELL);
      const dist = (a, b) => Math.abs(a % board.n - b % board.n) + Math.abs(Math.floor(a / board.n) - Math.floor(b / board.n));
      function build(k) {
        if (board) board.nodes.forEach(n => { try { n.dispose(); } catch (e) {} });
        const L = LV[k], n = L.n, rocks = new Set(L.rocks || []);
        const free = [...Array(n * n).keys()].filter(i => !rocks.has(i)), chests = [];
        while (chests.length < L.chests) { const c = free[Math.floor(Math.random() * free.length)]; if (!chests.includes(c)) chests.push(c); }
        board = { k, n, rocks, chests, found: new Set(), dug: new Map(), digs: L.digs, nodes: [], sel: Math.floor(n / 2) * n + Math.floor(n / 2) };
        const put = (s, p, y, name) => { const m = s.createInstance(name || 'digPart'); m.parent = ctx.frame; ctx.add(m); m.position.set(p.x, y, p.z); board.nodes.push(m); return m; };
        for (let i = 0; i < n * n; i++) { const x = i % n, y = Math.floor(i / n), t = put((x + y) % 2 ? sTileB : sTileA, posOf(i), .05, 'digTile'); t.isPickable = true; t.metadata = { digCell: i }; if (rocks.has(i)) { const r = put(sRock, posOf(i), .28); r.rotation.y = i; } }
        // a rope fence on stakes round the beach
        for (let x = 0; x < n; x++) for (const yy of [-1, n]) { const p = new V3(AT[0] + (x - (n - 1) / 2) * CELL, 0, AT[1] + ((n - 1) / 2 - yy + (yy < 0 ? .5 : -.5)) * CELL); put(sRope, p, .55); }
        for (let y = 0; y < n; y++) for (const xx of [-1, n]) { const p = new V3(AT[0] + (xx - (n - 1) / 2 + (xx < 0 ? .5 : -.5)) * CELL, 0, AT[1] + ((n - 1) / 2 - y) * CELL); const r = put(sRope, p, .55); r.rotation.y = Math.PI / 2; }
        sel.setEnabled(true); moveSel(0, 0);
        const sp = posOf(board.sel); ctx.player.place(AT[0] - CELL * (n / 2 + 1.2), AT[1] - CELL * (n / 2 + .8), Math.PI / 4);
        const span = n * CELL; st.cam = [AT[0], span * 1.15 + 3.5, AT[1] - span * .62 - 1.8]; st.at = [AT[0], 0, AT[1] + .4];
        info();
      }
      const info = () => H.info(board ? `Beach ${board.k + 1} / ${LV.length} · chests ${board.found.size} / ${board.chests.length} · digs left ${board.digs}` : 'Pick a beach');
      function moveSel(dx, dy) { if (!board) return; const n = board.n, x = Math.max(0, Math.min(n - 1, board.sel % n + dx)), y = Math.max(0, Math.min(n - 1, Math.floor(board.sel / n) + dy)); board.sel = y * n + x; const p = posOf(board.sel); sel.position.set(p.x, .14, p.z); }
      function dig(i) {
        if (st.phase !== 'play' || st.anim || i == null || board.rocks.has(i) || board.dug.has(i) || board.digs <= 0) return false;
        board.sel = i; moveSel(0, 0); board.digs--;
        const p = posOf(i); ctx.player.place(p.x - CELL * .55, p.z - CELL * .55, Math.PI / 4); ctx.player.clip('cross_punch'); ctx.sound('thock');
        const put = (s, y, name) => { const m = s.createInstance(name || 'digPart'); m.parent = ctx.frame; ctx.add(m); m.position.set(p.x, y, p.z); board.nodes.push(m); return m; };
        put(sHole, .115); const md = put(sMound, .14); md.position.x += CELL * .32; md.position.z += CELL * .3;
        const left = board.chests.filter(c => !board.found.has(c));
        if (left.includes(i)) { board.found.add(i); board.dug.set(i, 'X'); chestAt(p); ctx.note(880, 'bell'); H.msg('A chest!', 900, `${board.found.size} of ${board.chests.length}`); }
        else { const d = Math.min(...left.map(c => dist(c, i))); board.dug.set(i, d); stakeAt(p, d); ctx.note(300 + Math.max(0, 12 - d) * 40, 'pluck'); }
        info();
        if (board.found.size === board.chests.length) { st.phase = 'solved'; st.wait = 1.5; ctx.sound('gamewin'); pads.style.display = 'none'; if (board.k + 1 > solvedUpTo) { solvedUpTo = board.k + 1; try { localStorage.setItem(KEY, String(solvedUpTo)); } catch (e) {} } }
        else if (board.digs <= 0) { st.phase = 'lost'; st.wait = 2.2; pads.style.display = 'none'; H.msg('Out of digs', 1600, 'the chests were here'); board.chests.filter(c => !board.found.has(c)).forEach(c => chestAt(posOf(c), true)); }
        return true;
      }
      function stakeAt(p, d) { const s = sStake.createInstance('digStakeI'); s.parent = ctx.frame; ctx.add(s); s.position.set(p.x - CELL * .25, .5, p.z + CELL * .22); board.nodes.push(s);
        const plate = B.MeshBuilder.CreatePlane('digPlate', { size: CELL * .62 }, scene); plate.material = numMat(d); plate.parent = ctx.frame; ctx.add(plate); plate.position.set(p.x - CELL * .25, 1.05, p.z + CELL * .17); plate.billboardMode = B.Mesh.BILLBOARDMODE_ALL; plate.isPickable = false; board.nodes.push(plate); }
      function chestAt(p, ghost) { const c = new B.TransformNode('digChest', scene); c.parent = ctx.frame; ctx.add(c); c.position.set(p.x, ghost ? .12 : .2, p.z); board.nodes.push(c);
        const body = B.MeshBuilder.CreateBox('digChestBody', { width: CELL * .62, height: .34, depth: CELL * .42 }, scene); body.material = woodM; body.parent = c; body.position.y = .17; body.isPickable = false; ctx.add(body);
        const lid = B.MeshBuilder.CreateCylinder('digChestLid', { height: CELL * .62, diameter: CELL * .42, tessellation: 12, arc: .5 }, scene); lid.material = goldM; lid.rotation.z = Math.PI / 2; lid.rotation.x = -Math.PI / 2; lid.parent = c; lid.position.y = .34; lid.isPickable = false; ctx.add(lid);
        if (ghost) { body.visibility = .55; lid.visibility = .55; } }
      function restart() { if (st.phase !== 'play') return; build(board.k); H.msg('A new beach', 700, 'the chests are buried elsewhere'); }
      const hud = document.getElementById('gameHud');
      const pick = document.createElement('div');
      pick.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(390px,90vw);background:rgba(16,12,8,.94);border:1px solid rgba(216,179,92,.6);border-radius:14px;padding:16px;text-align:center;pointer-events:auto;font:15px/1.4 Georgia,serif;color:#eee';
      const drawPick = () => { pick.innerHTML = `<div style="font:700 13px/1.2 Georgia,serif;letter-spacing:.14em;text-transform:uppercase;color:#d8b35c;margin-bottom:10px">The Buried Chest</div><div style="margin-bottom:12px;color:#bbb">Each dig tells how many squares away the nearest chest is (no diagonals).</div>`
        + `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${LV.map((L, k) => { const open = k <= solvedUpTo, done = k < solvedUpTo; return `<button type="button" data-k="${k}" ${open ? '' : 'disabled'} style="padding:8px 2px;border-radius:9px;border:1px solid ${open ? '#d8b35c' : '#444'};background:${done ? 'rgba(216,179,92,.25)' : 'rgba(255,255,255,.04)'};color:${open ? '#fff' : '#666'};font:700 15px Georgia,serif;cursor:${open ? 'pointer' : 'default'}">${open ? `${k + 1}<div style="font:11px Georgia,serif;opacity:.75">${L.chests} chest${L.chests > 1 ? 's' : ''} · ${L.digs} digs</div>` : '🔒'}${done ? ' ✓' : ''}</button>`; }).join('')}</div>`;
        pick.querySelectorAll('button[data-k]').forEach(b => b.onclick = (e) => { e.stopPropagation(); b.blur(); choose(+b.dataset.k); }); };
      function choose(k) { if (st.phase !== 'pick' || k > solvedUpTo || k >= LV.length) return; pick.remove(); st.phase = 'play'; build(k); pads.style.display = 'grid'; H.msg(`Beach ${k + 1}`, 900, k === 3 ? 'no dig to waste' : k >= 4 ? 'a hard one' : ''); }
      const pads = document.createElement('div');
      pads.style.cssText = 'position:absolute;bottom:62px;right:16px;display:none;grid-template-columns:repeat(3,46px);grid-template-rows:repeat(3,40px);gap:5px;pointer-events:auto';
      const pad = (t, area, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.style.cssText = `grid-area:${area};border-radius:8px;border:1px solid #b8964a;background:rgba(20,14,10,.82);color:#ffe9b0;font:700 16px Georgia,serif;cursor:pointer`; b.onclick = (e) => { e.stopPropagation(); b.blur(); fn(); }; pads.appendChild(b); };
      pad('↑', '1 / 2', () => moveSel(0, -1)); pad('←', '2 / 1', () => moveSel(-1, 0)); pad('→', '2 / 3', () => moveSel(1, 0)); pad('↓', '3 / 2', () => moveSel(0, 1)); pad('⛏', '2 / 2', () => dig(board.sel));
      hud.append(pick, pads);
      drawPick();
      st.cam = [AT[0], 12, AT[1] - 9]; st.at = [AT[0], 0, AT[1]];
      ctx.look(st.cam, st.at, def.fov || .8);
      H.title(def.title || 'The Buried Chest'); H.score(''); info();
      H.hint('Click a square to dig (or move the frame with the arrows and press <kbd>Space</kbd>). The stake shows how far the nearest chest still buried is.');
      return {
        update(dt) {
          ctx.look(st.cam, st.at);
          if ((st.phase === 'solved' || st.phase === 'lost') && (st.wait -= dt) <= 0) {
            const won = st.phase === 'solved', k = board.k; st.phase = 'done'; H.hint('');
            const score = won ? (k + 1) * 20 + board.digs * 5 : 0;
            ctx.finish({ score, label: 'points', solved: won, passed: won && score >= (def.pass || 0), extra: won ? `Beach ${k + 1}: every chest found with ${board.digs} dig${board.digs === 1 ? '' : 's'} to spare.${k + 1 < LV.length ? ` Beach ${k + 2} is open.` : ' Every beach dug.'}` : `Beach ${k + 1}: ${board.found.size} of ${board.chests.length} chests found.` });
          }
        },
        key(e, down) {
          if (!down || e.repeat) return; const k = e.key.toLowerCase();
          if (st.phase === 'pick') { const n = k === '0' ? 10 : parseInt(k, 10); if (n >= 1 && n <= LV.length) choose(n - 1); return; } // 1-9, 0 = the tenth
          if (k === 'arrowup' || k === 'w') moveSel(0, -1); else if (k === 'arrowdown' || k === 's') moveSel(0, 1); else if (k === 'arrowleft' || k === 'a') moveSel(-1, 0); else if (k === 'arrowright' || k === 'd') moveSel(1, 0);
          else if (k === ' ' || k === 'enter') dig(board.sel);
        },
        pointer(evt) {
          if (evt.type !== B.PointerEventTypes.POINTERDOWN || st.phase !== 'play') return;
          const hit = scene.pickWithRay(ctx.ray(), m => m.metadata?.digCell != null); const i = hit?.pickedMesh?.metadata?.digCell; if (i != null) dig(i);
        },
        restart, // the HUD's Restart button
        _test: { st, dig, choose, moveSel, dist, get board() { return board; }, LV },
        dispose() { pick.remove(); pads.remove(); sel.dispose(); if (board) board.nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); }
      };
    }
  };
  window.RebelGames.register('dig', G);
})();
