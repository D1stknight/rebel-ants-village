// The Tactician's Banners (Oct 15, Bushi Strategy Hall): plant one banner for every row of the board so that no two
// banners share a row, a column or a diagonal (each would see the other). Levels: 5 x 5, 6 x 6, 8 x 8, 8 x 8 with two
// banners already planted (one way left), 8 x 8 with rocks where no banner may stand (one way left). A level opens when
// the one before is won. Click a square (or move the ring with the arrows and press Space); R clears the board.
// Oct 17: How to play (the rules + a solved 4 x 4 board, howto/queens.png) and Restart (the level as it was picked).
// def: { at: [x, z] (the board's middle, frame coordinates), size: board width (m), player: [x, z, yaw], cam, look, levels, pass, points }
(function () {
  const LEVELS = [
    { n: 5 }, { n: 6 }, { n: 8 },
    { n: 8, fixed: [[2, 3], [6, 4]] },
    { n: 8, rocks: [[0, 4], [1, 5], [2, 6], [3, 7], [4, 0], [5, 1], [7, 3], [7, 5]] },
    // Oct 17 (Miguel: "make it more levels 10"): scratchpad queens/gen10.mjs, 9 x 9 to 11 x 11, one answer each (planted
    // banners, rocks, or both)
    { n: 9, fixed: [[4, 5], [6, 4]] },
    { n: 9, rocks: [[1, 1], [1, 4], [1, 6], [1, 7], [4, 0], [4, 1], [4, 4], [4, 6], [4, 7], [4, 8], [6, 4], [7, 4], [8, 4]] },
    { n: 10, fixed: [[2, 7], [5, 1]] },
    { n: 10, rocks: [[0, 3], [0, 4], [0, 6], [1, 1], [1, 3], [1, 4], [1, 5], [1, 7], [1, 9], [2, 4], [4, 4], [5, 4], [6, 4], [7, 4], [8, 4], [9, 4]] },
    { n: 11, fixed: [[6, 1]], rocks: [[0, 3], [0, 4], [0, 5], [2, 3], [7, 8], [9, 2], [9, 3], [9, 5], [10, 2], [10, 3], [10, 4]] }
  ];
  const SCORE = [20, 40, 50, 70, 90, 105, 120, 140, 160, 185];
  const G = {
    title: "The Tactician's Banners",
    howTo: { lines: [
      'Plant one banner in every row of the board.',
      'No two banners may share a row, a column or a diagonal: however far apart, they would see each other.',
      'Click a square to plant a banner or lift it again (or move the gold ring with the arrows and press Space); R clears the board.',
      'Red lines join banners that see each other. Gold banners were planted by the Strategist and stay, and no banner stands on a rock.',
      'Tip: banners in neighbouring rows always stand at least two columns apart.'],
      img: 'howto/queens.png', caption: 'A solved 4 x 4 board: one banner in each row and column, no two on a diagonal.' },
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const LV = def.levels || LEVELS, AT = def.at || [0, 0], W = def.size || 10.4;
      const KEY = 'rebelAntsBannerProgress:' + (def.id || 'queens');
      let solvedUpTo = 0; try { solvedUpTo = Math.max(0, Math.min(LV.length, Number(localStorage.getItem(KEY)) || 0)); } catch (e) {}
      const mat = (k, c, em, spec = .1) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(spec, spec, spec); if (em) m.emissiveColor = new B.Color3(...em); return m; });
      const M = { pole: mat('pole', [.36, .25, .16], [.04, .03, .02]), flag: mat('flag', [.62, .16, .13], [.16, .03, .02]), bad: mat('flagBad', [1, .2, .15], [.75, .08, .05]),
        gold: mat('gold', [.95, .74, .3], [.3, .2, .06], .5), fixed: mat('flagFixed', [.85, .66, .24], [.26, .17, .04], .3), rock: mat('rock', [.36, .36, .38], [.04, .04, .05]),
        line: mat('line', [1, .25, .2], [.9, .15, .1]), cursor: mat('cursor', [1, .85, .35], [.9, .7, .2]) };
      M.line.disableLighting = true;
      let bd = null; // { k, n, C, banners: Map(key -> { r, c, fixed, node }), rocks: Set, nodes[], toggles }
      const st = { phase: 'pick', cr: 0, cc: 0, lines: [], wait: 0 };
      const keyOf = (r, c) => r * 16 + c;
      const cellPos = (r, c) => new V3(AT[0] + (c - (bd.n - 1) / 2) * bd.C, 0, AT[1] + (r - (bd.n - 1) / 2) * bd.C);
      const keep = n => { n.parent = ctx.frame; ctx.add(n); bd.nodes.push(n); return n; };
      function boardTexture(n, rocks) {
        const S = 1024, t = new B.DynamicTexture('qBoardTex', { width: S, height: S }, scene, true), g = t.getContext(), c = S / n;
        for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) { g.fillStyle = (r + k) % 2 ? '#8f7a55' : '#d9c79c'; g.fillRect(k * c, r * c, c, c); }
        g.strokeStyle = 'rgba(40,28,14,.85)'; g.lineWidth = 6; for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * c, 0); g.lineTo(i * c, S); g.stroke(); g.beginPath(); g.moveTo(0, i * c); g.lineTo(S, i * c); g.stroke(); }
        g.strokeStyle = '#2b3a5c'; g.lineWidth = 22; g.strokeRect(11, 11, S - 22, S - 22);
        t.update(); return t;
      }
      function build(k) {
        if (bd) [...bd.nodes, ...st.lines].forEach(n => { try { n.dispose(); } catch (e) {} });
        st.lines = [];
        const L = LV[k], n = L.n, C = W / n;
        bd = { k, n, C, banners: new Map(), rocks: new Set((L.rocks || []).map(([r, c]) => keyOf(r, c))), nodes: [], toggles: 0 };
        const board = keep(B.MeshBuilder.CreateGround('qBoard', { width: W, height: W }, scene));
        const bm = new B.StandardMaterial('qBoardMat_' + k, scene); bm.diffuseTexture = boardTexture(n); bm.specularColor = new B.Color3(.05, .05, .05); bm.emissiveColor = new B.Color3(.12, .1, .08); board.material = bm;
        board.position.set(AT[0], .04, AT[1]); board.isPickable = true; board.metadata = { qBoard: true }; bd.nodes.push({ dispose() { bm.diffuseTexture?.dispose(); bm.dispose(); } });
        const rim = keep(B.MeshBuilder.CreateBox('qRim', { width: W + .5, height: .1, depth: W + .5 }, scene)); rim.material = M.pole; rim.position.set(AT[0], -.04, AT[1]); rim.isPickable = false; // its top (.01) under the board (.04): the squares show
        for (const rk of bd.rocks) { const r = Math.floor(rk / 16), c = rk % 16, p = cellPos(r, c);
          const s = keep(B.MeshBuilder.CreatePolyhedron('qRock', { type: 2, size: C * .3 }, scene)); s.material = M.rock; s.position.set(p.x, C * .24, p.z); s.rotation.set(r * .7, c * 1.3, .4); s.scaling.y = .7; s.isPickable = false; }
        for (const [r, c] of L.fixed || []) plant(r, c, true);
        st.cursor = keep(B.MeshBuilder.CreateTorus('qCursor', { diameter: C * .82, thickness: .06, tessellation: 28 }, scene)); st.cursor.material = M.cursor; st.cursor.isPickable = false;
        st.cr = Math.floor(n / 2); st.cc = Math.floor(n / 2);
        check(); info();
      }
      function plant(r, c, fixed = false) {
        const p = cellPos(r, c), root = new B.TransformNode('qBanner', scene); keep(root); root.position.copyFrom(p);
        const pole = B.MeshBuilder.CreateCylinder('qPole', { height: 2.3, diameter: .09, tessellation: 8 }, scene); pole.parent = root; pole.position.y = 1.15; pole.material = M.pole; pole.isPickable = false; ctx.add(pole);
        const flag = B.MeshBuilder.CreateBox('qFlag', { width: .62, height: .9, depth: .04 }, scene); flag.parent = root; flag.position.set(.34, 1.75, 0); flag.material = fixed ? M.fixed : M.flag; flag.isPickable = false; ctx.add(flag);
        const cap = B.MeshBuilder.CreateSphere('qCap', { diameter: .16, segments: 8 }, scene); cap.parent = root; cap.position.y = 2.36; cap.material = M.gold; cap.isPickable = false; ctx.add(cap);
        if (fixed) { const base = B.MeshBuilder.CreateCylinder('qBase', { height: .16, diameter: bd.C * .62, tessellation: 16 }, scene); base.parent = root; base.position.y = .1; base.material = M.gold; base.isPickable = false; ctx.add(base); }
        root.rotation.y = -Math.PI / 6;
        bd.banners.set(keyOf(r, c), { r, c, fixed, node: root, flag });
      }
      const sees = (a, b) => a.r === b.r || a.c === b.c || Math.abs(a.r - b.r) === Math.abs(a.c - b.c);
      function check() {
        st.lines.forEach(n => n.dispose()); st.lines = [];
        const list = [...bd.banners.values()], bad = new Set();
        for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) { const a = list[i], b = list[j]; if (!sees(a, b)) continue; bad.add(a); bad.add(b);
          const pa = cellPos(a.r, a.c), pb = cellPos(b.r, b.c), L = V3.Distance(pa, pb);
          const seg = B.MeshBuilder.CreateBox('qLine', { width: .07, height: .07, depth: L }, scene); seg.material = M.line; seg.isPickable = false; seg.parent = ctx.frame; ctx.add(seg);
          seg.position.set((pa.x + pb.x) / 2, 1.45, (pa.z + pb.z) / 2); seg.rotation.y = Math.atan2(pb.x - pa.x, pb.z - pa.z); st.lines.push(seg); }
        list.forEach(b => { b.flag.material = bad.has(b) ? M.bad : b.fixed ? M.fixed : M.flag; });
        return { count: list.length, bad: bad.size };
      }
      const info = () => H.info(bd ? `Level ${bd.k + 1} / ${LV.length} · banners ${bd.banners.size} / ${bd.n}` : 'Pick a level');
      function toggle(r, c) {
        if (st.phase !== 'play') return;
        st.cr = r; st.cc = c; const k = keyOf(r, c), b = bd.banners.get(k);
        if (bd.rocks.has(k)) { ctx.sound('thock'); H.msg('No banner stands on a rock', 900); return; }
        if (b?.fixed) { ctx.sound('thock'); H.msg('That banner was planted by the Strategist', 900); return; }
        if (b) { b.node.dispose(); bd.banners.delete(k); ctx.note(392, 'bell'); }
        else { if (bd.banners.size >= bd.n) { ctx.sound('thock'); H.msg(`Only ${bd.n} banners: lift one first`, 1000); return; } plant(r, c); ctx.note(523 + c * 22, 'bell'); }
        bd.toggles++;
        const s = check(); info();
        if (s.count === bd.n && !s.bad) { st.phase = 'solved'; st.wait = 1.6; ctx.sound('gamewin'); H.msg('No banner sees another!', 1500);
          if (bd.k + 1 > solvedUpTo) { solvedUpTo = bd.k + 1; try { localStorage.setItem(KEY, String(solvedUpTo)); } catch (e) {} } }
        else if (s.bad && !b) H.msg('Two banners see each other', 700);
      }
      function clearBoard() { if (st.phase !== 'play') return; for (const [k, b] of [...bd.banners]) if (!b.fixed) { b.node.dispose(); bd.banners.delete(k); } check(); info(); H.msg('Cleared', 600); }
      // the picker
      const hud = document.getElementById('gameHud'), pick = document.createElement('div');
      pick.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(' + (LV.length > 6 && innerWidth >= 600 ? 560 : 380) + 'px,92vw);background:rgba(12,16,30,.94);border:1px solid rgba(216,179,92,.7);border-radius:14px;padding:16px;text-align:center;pointer-events:auto;font:15px/1.4 Georgia,serif;color:#eee';
      const label = L => `${L.n} × ${L.n}${L.fixed ? ` · ${['one', 'two', 'three'][L.fixed.length - 1] || L.fixed.length} planted` : ''}${L.rocks ? ' · rocks' : ''}`;
      pick.innerHTML = `<div style="font:700 13px/1.2 Georgia,serif;letter-spacing:.14em;text-transform:uppercase;color:#d8b35c;margin-bottom:10px">The Tactician's Banners</div><div style="margin-bottom:12px;color:#bbb">One banner for every row. No two banners may share a row, a column or a diagonal.</div>`
        + `<div style="display:grid;grid-template-columns:repeat(${LV.length > 6 && innerWidth >= 600 ? 5 : 2},1fr);gap:8px">${LV.map((L, k) => { const open = k <= solvedUpTo, done = k < solvedUpTo; return `<button type="button" data-k="${k}" ${open ? '' : 'disabled'} style="padding:10px 4px;border-radius:9px;border:1px solid ${open ? '#d8b35c' : '#444'};background:${done ? 'rgba(216,179,92,.22)' : 'rgba(255,255,255,.04)'};color:${open ? '#fff' : '#666'};font:700 15px Georgia,serif;cursor:${open ? 'pointer' : 'default'}">${open ? 'Level ' + (k + 1) : '🔒'}${done ? ' ✓' : ''}${open ? `<div style="font:12px Georgia,serif;color:#c9b88a">${label(L)}</div>` : ''}</button>`; }).join('')}</div>`;
      pick.querySelectorAll('button[data-k]').forEach(b => b.onclick = (e) => { e.stopPropagation(); b.blur(); choose(+b.dataset.k); });
      function choose(k) { if (st.phase !== 'pick' || k > solvedUpTo || k >= LV.length) return; pick.remove(); st.phase = 'play'; build(k); H.msg(`Level ${k + 1}`, 900, label(LV[k])); }
      // Restart (the button beside Quit): the level built again as it was picked (only the Strategist's banners, no moves)
      function restart() { if (st.phase !== 'play' || !bd) return; build(bd.k); H.msg('Start again', 900, label(LV[bd.k])); }
      hud.appendChild(pick);
      const P = def.player || [AT[0] - W / 2 - 2.2, AT[1], Math.PI / 2]; ctx.player.place(P[0], P[1], P[2]);
      const cam = def.cam || [AT[0], 7.2, AT[1] + W * .8 + 1.6], at = def.look || [AT[0], 0, AT[1] - .4];
      ctx.look(cam, at, def.fov || .95);
      H.title(def.title || "The Tactician's Banners"); H.score(''); info();
      H.hint('Click a square to plant or lift a banner (or move the ring with the arrows and press <kbd>Space</kbd>). Red lines: banners that see each other. <kbd>R</kbd> clears.');
      return {
        update(dt) {
          ctx.look(cam, at);
          if (bd && st.cursor) { const p = cellPos(st.cr, st.cc); st.cursor.position.set(p.x, .1, p.z); st.cursor.setEnabled(st.phase === 'play'); }
          if (bd) for (const b of bd.banners.values()) b.flag.rotation.y = Math.sin(performance.now() / 700 + b.r + b.c) * .12;
          if (st.phase === 'solved' && (st.wait -= dt) <= 0) {
            st.phase = 'done'; H.hint('');
            const k = bd.k, score = SCORE[k] ?? 20 * (k + 1);
            ctx.finish({ score, label: 'points', solved: true, passed: score >= (def.pass || 0), extra: `Level ${k + 1} won (${label(LV[k])}) with ${bd.toggles} moves.${k + 1 < LV.length ? ` Level ${k + 2} is open.` : ' Every level won.'}` });
          }
        },
        key(e, down) {
          if (!down || e.repeat) return; const k = e.key.toLowerCase();
          if (st.phase === 'pick') { const n = k === '0' ? 10 : parseInt(k, 10); if (n >= 1 && n <= LV.length) choose(n - 1); return; } // 1-9, 0 = the tenth
          if (st.phase !== 'play') return;
          if (k === 'arrowup' || k === 'w') st.cr = Math.max(0, st.cr - 1); else if (k === 'arrowdown' || k === 's') st.cr = Math.min(bd.n - 1, st.cr + 1);
          else if (k === 'arrowleft' || k === 'a') st.cc = Math.max(0, st.cc - 1); else if (k === 'arrowright' || k === 'd') st.cc = Math.min(bd.n - 1, st.cc + 1);
          else if (k === ' ' || k === 'enter') toggle(st.cr, st.cc); else if (k === 'r') clearBoard();
        },
        pointer(evt) {
          if (evt.type !== B.PointerEventTypes.POINTERDOWN || st.phase !== 'play') return;
          const hit = scene.pickWithRay(ctx.ray(), m => !!m.metadata?.qBoard); if (!hit?.hit) return;
          const p = ctx.toLocal(hit.pickedPoint), c = Math.round((p.x - AT[0]) / bd.C + (bd.n - 1) / 2), r = Math.round((p.z - AT[1]) / bd.C + (bd.n - 1) / 2);
          if (r >= 0 && c >= 0 && r < bd.n && c < bd.n) toggle(r, c);
        },
        restart,
        _test: { st, choose, toggle, clearBoard, cellPos: (r, c) => cellPos(r, c), get bd() { return bd; } },
        dispose() { pick.remove(); st.lines.forEach(n => { try { n.dispose(); } catch (e) {} }); if (bd) bd.nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); }
      };
    }
  };
  window.RebelGames.register('queens', G);
})();
