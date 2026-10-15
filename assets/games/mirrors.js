// The Sun Mirrors (Oct 15, Shogun): a beam of sunlight from the lantern crosses a stone board; turn the mirrors (click
// one, or move the ring with the arrows / WASD and press Space) so it lights every crystal. The first two levels show the
// beam as you work; in the last two the sun is behind the clouds: strike the gong (G, or the button) to let it shine for
// a moment, three times at most, so the route has to be worked out first. A level opens when the one before is solved.
// def: { at: [x, z] (frame coords of the board's middle), cell: 1.45, levels: [{ rows, hidden, best }], pass, points }
(function () {
  const LEVELS = [
    { rows: ['......', 'R./...', '......', '.\\*...', '..*...', '../#..'], best: 1 },
    { rows: ['..\\..\\', '....\\*', 'R*\\..*', '../..\\', '..#..#', '......'], best: 2 },
    { rows: ['.\\#\\../', '...*..*', '.#..\\..', '....\\.\\', 'R..\\...', '....*..', '.../\\.#'], best: 5, hidden: true },
    { rows: ['./...##', './.\\\\..', '...\\../', '...*.#*', 'R./\\./*', '.......', '../..*/'], best: 4, hidden: true }
  ];
  const DIRS = { R: [1, 0], L: [-1, 0], U: [0, -1], D: [0, 1] };
  const G = {
    title: 'The Sun Mirrors',
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const LV = def.levels || LEVELS, C = def.cell || 1.45, AT = def.at || [0, 0], SHINES = def.shines || 3, Y = 1.25;
      const KEY = 'rebelAntsMirrorProgress:' + (def.id || 'mirrors');
      let solvedUpTo = 0; try { solvedUpTo = Math.max(0, Math.min(LV.length, Number(localStorage.getItem(KEY)) || 0)); } catch (e) {}
      const mat = (k, c, em, spec = .1, a) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(spec, spec, spec); if (em) m.emissiveColor = new B.Color3(...em); if (a != null) m.alpha = a; return m; });
      const M = { tile: mat('tile', [.42, .38, .33], [.05, .045, .04]), stone: mat('stone', [.2, .19, .2], [.02, .02, .02]), frame: mat('frame', [.36, .14, .3], [.06, .02, .05]), glass: mat('glass', [.85, .9, 1], [.35, .4, .5], 1),
        beam: mat('beam', [1, .9, .5], [1, .82, .35], 0, .85), dim: mat('crystalDim', [.45, .32, .62], [.12, .06, .2], .6), lit: mat('crystalLit', [1, .9, .55], [1, .78, .3], .9), sun: mat('sun', [1, .9, .5], [1, .8, .35]), cursor: mat('cursor', [1, .85, .35], [.9, .7, .2]) };
      M.beam.disableLighting = true;
      let lv = null; // { k, W, H, cells[y][x], mirrors: [{x, y, ch, m}], crystals: [{x, y, m}], nodes[], toggles, shines, source }
      const st = { phase: 'pick', cx: 0, cy: 0, shine: 0, beamNodes: [], wait: 0 };
      const pos = (x, y) => new V3(AT[0] + (x - (lv.W - 1) / 2) * C, 0, AT[1] + ((lv.H - 1) / 2 - y) * C);
      const keep = (m) => { m.parent = ctx.frame; ctx.add(m); lv.nodes.push(m); return m; };
      function build(k) {
        if (lv) [...lv.nodes, ...st.beamNodes].forEach(n => { try { n.dispose(); } catch (e) {} });
        st.beamNodes = [];
        const L = LV[k], rows = L.rows, Hh = rows.length, W = rows[0].length;
        lv = { k, W, H: Hh, cells: rows.map(r => r.split('')), mirrors: [], crystals: [], nodes: [], toggles: 0, shines: SHINES, hidden: !!L.hidden, best: L.best || 0, source: null };
        for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
          const c = lv.cells[y][x], p = pos(x, y);
          const t = keep(B.MeshBuilder.CreateBox('mirTile', { width: C * .96, height: .14, depth: C * .96 }, scene)); t.material = M.tile; t.position.set(p.x, .07, p.z); t.isPickable = true; t.metadata = { mirCell: [x, y] };
          if (c === '#') { const s = keep(B.MeshBuilder.CreateBox('mirStone', { width: C * .8, height: 1.5, depth: C * .8 }, scene)); s.material = M.stone; s.position.set(p.x, .75, p.z); s.isPickable = false; }
          else if (c === '*') { const o = keep(B.MeshBuilder.CreatePolyhedron('mirCrystal', { type: 1, size: .32 }, scene)); o.material = M.dim; o.position.set(p.x, Y, p.z); o.isPickable = false; lv.crystals.push({ x, y, m: o, lit: false }); }
          else if ('RLUD'.includes(c)) { lv.source = { x, y, d: DIRS[c] }; const post = keep(B.MeshBuilder.CreateCylinder('mirPost', { height: Y, diameter: .2, tessellation: 8 }, scene)); post.material = M.frame; post.position.set(p.x, Y / 2, p.z); post.isPickable = false; const sun = keep(B.MeshBuilder.CreateSphere('mirSun', { diameter: .5, segments: 10 }, scene)); sun.material = M.sun; sun.position.set(p.x, Y, p.z); sun.isPickable = false; }
          else if ('/\\AB'.includes(c)) {
            const root = new B.TransformNode('mirMirror', scene); keep(root); root.position.set(p.x, 0, p.z);
            const base = B.MeshBuilder.CreateCylinder('mirBase', { height: .16, diameter: .7, tessellation: 12 }, scene); base.material = M.frame; base.parent = root; base.position.y = .22; base.isPickable = true; base.metadata = { mirCell: [x, y] }; ctx.add(base);
            const pane = B.MeshBuilder.CreateBox('mirPane', { width: C * .8, height: 1.1, depth: .07 }, scene); pane.material = c === 'A' || c === 'B' ? M.stone : M.glass; pane.parent = root; pane.position.y = .3 + .55; pane.isPickable = true; pane.metadata = { mirCell: [x, y] }; ctx.add(pane);
            const turnable = c === '/' || c === '\\'; const ch = c === 'A' ? '/' : c === 'B' ? '\\' : c;
            lv.mirrors.push({ x, y, ch, root, turnable, rot: ch === '/' ? -Math.PI / 4 : Math.PI / 4 }); root.rotation.y = ch === '/' ? -Math.PI / 4 : Math.PI / 4;
          }
        }
        st.cursor && st.cursor.dispose(); st.cursor = keep(B.MeshBuilder.CreateTorus('mirCursor', { diameter: C * .9, thickness: .05, tessellation: 28 }, scene)); st.cursor.material = M.cursor; st.cursor.isPickable = false;
        const m0 = lv.mirrors.find(m => m.turnable); st.cx = m0 ? m0.x : 0; st.cy = m0 ? m0.y : 0;
        const span = Math.max(W, Hh) * C; st.cam = [AT[0], span * .9 + 3, AT[1] - span * .78 - 2]; st.at = [AT[0], .4, AT[1] + .2];
        ctx.player.place(AT[0] - span / 2 - 1.4, AT[1] - span / 2 + .6, Math.PI / 4);
        trace(); info();
      }
      // the beam from the lantern: through crystals, turned by mirrors, stopped by stones, the lantern or the edge
      function route() {
        const s = lv.source; let x = s.x, y = s.y, [dx, dy] = s.d; const pts = [[x, y]], lit = new Set(), seen = new Set(); let end = null;
        for (let n = 0; n < 300; n++) {
          x += dx; y += dy; if (x < 0 || y < 0 || x >= lv.W || y >= lv.H) { end = [x - dx * .5, y - dy * .5]; break; }
          const k = x + ',' + y + ',' + dx + ',' + dy; if (seen.has(k)) { end = [x, y]; break; } seen.add(k);
          const c = lv.cells[y][x];
          if (c === '#' || 'RLUD'.includes(c)) { end = [x - dx * .5, y - dy * .5]; break; }
          const m = lv.mirrors.find(m => m.x === x && m.y === y);
          if (m) { pts.push([x, y]); if (m.ch === '/') [dx, dy] = [-dy, -dx]; else [dx, dy] = [dy, dx]; continue; }
          if (c === '*') lit.add(x + ',' + y);
        }
        pts.push(end); return { pts, lit };
      }
      function trace() {
        st.beamNodes.forEach(n => n.dispose()); st.beamNodes = [];
        const r = route(), show = !lv.hidden || st.shine > 0;
        lv.crystals.forEach(c => { c.lit = r.lit.has(c.x + ',' + c.y); c.m.material = show && c.lit ? M.lit : M.dim; });
        if (show) for (let i = 1; i < r.pts.length; i++) {
          const a = pos(...r.pts[i - 1]), b = pos(...r.pts[i]), L = V3.Distance(a, b); if (L < .01) continue;
          const seg = B.MeshBuilder.CreateBox('mirBeam', { width: .09, height: .09, depth: L }, scene); seg.material = M.beam; seg.isPickable = false; seg.parent = ctx.frame; ctx.add(seg);
          seg.position.set((a.x + b.x) / 2, Y, (a.z + b.z) / 2); seg.rotation.y = Math.atan2(b.x - a.x, b.z - a.z); st.beamNodes.push(seg);
        }
        return r;
      }
      const allLit = () => lv.crystals.every(c => c.lit);
      const info = () => H.info(lv ? `Level ${lv.k + 1} / ${LV.length} · turns ${lv.toggles}${lv.hidden ? ` · sun ${lv.shines}` : ''}` : 'Pick a level');
      function turn(x, y) {
        if (st.phase !== 'play') return;
        if (lv.hidden && st.shine > 0) { H.msg('The mirrors are too hot while the sun shines', 900); return; }
        const m = lv.mirrors.find(m => m.x === x && m.y === y); st.cx = x; st.cy = y;
        if (!m || !m.turnable) { ctx.sound('thock'); return; }
        m.ch = m.ch === '/' ? '\\' : '/'; m.rot = m.ch === '/' ? -Math.PI / 4 : Math.PI / 4; lv.toggles++; ctx.note(520 + (x + y) * 30, 'bell');
        trace(); info(); check();
      }
      function check() { if ((!lv.hidden || st.shine > 0) && allLit()) { st.phase = 'solved'; st.wait = 1.6; ctx.sound('gamewin'); H.msg('Every crystal shines!', 1400);
        if (lv.k + 1 > solvedUpTo) { solvedUpTo = lv.k + 1; try { localStorage.setItem(KEY, String(solvedUpTo)); } catch (e) {} } } }
      function shine() {
        if (st.phase !== 'play' || !lv.hidden || st.shine > 0) return;
        if (lv.shines <= 0) { H.msg('The sun has set', 1200); return; }
        lv.shines--; st.shine = 2.6; ctx.sound('boom'); trace(); info(); check();
        if (st.phase === 'play' && lv.shines <= 0) { st.outIn = 2.7; }
      }
      // the picker, the gong button
      const hud = document.getElementById('gameHud');
      const pick = document.createElement('div');
      pick.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(360px,90vw);background:rgba(16,10,18,.94);border:1px solid rgba(216,179,92,.7);border-radius:14px;padding:16px;text-align:center;pointer-events:auto;font:15px/1.4 Georgia,serif;color:#eee';
      const drawPick = () => { pick.innerHTML = `<div style="font:700 13px/1.2 Georgia,serif;letter-spacing:.14em;text-transform:uppercase;color:#d8b35c;margin-bottom:10px">The Sun Mirrors</div><div style="margin-bottom:12px;color:#bbb">Turn the mirrors so the sunbeam lights every crystal.</div>`
        + `<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px">${LV.map((L, k) => { const open = k <= solvedUpTo, done = k < solvedUpTo; return `<button type="button" data-k="${k}" ${open ? '' : 'disabled'} style="padding:10px 4px;border-radius:9px;border:1px solid ${open ? '#d8b35c' : '#444'};background:${done ? 'rgba(216,179,92,.22)' : 'rgba(255,255,255,.04)'};color:${open ? '#fff' : '#666'};font:700 15px Georgia,serif;cursor:${open ? 'pointer' : 'default'}">${open ? 'Level ' + (k + 1) : '🔒'}${done ? ' ✓' : ''}${L.hidden && open ? '<div style="font:12px Georgia,serif;color:#c9b88a">sun behind clouds</div>' : ''}</button>`; }).join('')}</div>`;
        pick.querySelectorAll('button[data-k]').forEach(b => b.onclick = (e) => { e.stopPropagation(); b.blur(); choose(+b.dataset.k); }); };
      const gong = document.createElement('button'); gong.type = 'button'; gong.textContent = 'Strike the gong (G)';
      gong.style.cssText = 'position:absolute;bottom:62px;right:16px;display:none;padding:10px 14px;border-radius:10px;border:1px solid #d8b35c;background:rgba(30,20,10,.88);color:#ffe9b0;font:700 14px Georgia,serif;cursor:pointer;pointer-events:auto';
      gong.onclick = (e) => { e.stopPropagation(); gong.blur(); shine(); };
      function choose(k) { if (st.phase !== 'pick' || k > solvedUpTo || k >= LV.length) return; pick.remove(); st.phase = 'play'; build(k); gong.style.display = lv.hidden ? 'block' : 'none'; H.msg(`Level ${k + 1}`, 1000, lv.hidden ? 'the sun is behind the clouds' : ''); }
      hud.append(pick, gong); drawPick();
      st.cam = [AT[0], 10, AT[1] - 9]; st.at = [AT[0], 0, AT[1]];
      ctx.look(st.cam, st.at, def.fov || .8);
      H.title(def.title || 'The Sun Mirrors'); H.score(''); info();
      H.hint('Click a mirror to turn it (or move the ring with the arrows and press <kbd>Space</kbd>). Light every crystal. <kbd>G</kbd> strikes the gong when the sun hides.');
      const inst = {
        update(dt) {
          ctx.look(st.cam, st.at);
          if (lv) {
            for (const m of lv.mirrors) { const d = m.rot - m.root.rotation.y; m.root.rotation.y += d * Math.min(1, dt * 12); }
            if (st.cursor) { const p = pos(st.cx, st.cy); st.cursor.position.set(p.x, .16, p.z); st.cursor.setEnabled(st.phase === 'play'); }
            lv.crystals.forEach((c, i) => { c.m.rotation.y += dt * (c.lit ? 2.4 : .6); c.m.position.y = Y + Math.sin(performance.now() / 600 + i) * .06; });
          }
          if (st.shine > 0 && (st.shine -= dt) <= 0) { st.shine = 0; if (st.phase === 'play') trace(); }
          if (st.outIn > 0 && st.phase === 'play' && (st.outIn -= dt) <= 0) { st.phase = 'fail'; st.wait = 1.4; H.msg('The sun has set', 1400, 'try the level again'); }
          if ((st.phase === 'solved' || st.phase === 'fail') && (st.wait -= dt) <= 0) {
            const won = st.phase === 'solved'; st.phase = 'done'; H.hint(''); gong.remove();
            const k = lv.k, score = won ? (k + 1) * 25 + (lv.hidden ? lv.shines * 5 : (lv.toggles <= lv.best + 1 ? 10 : 0)) : 0;
            ctx.finish({ score, label: 'points', passed: won && score >= (def.pass || 0), extra: won ? `Level ${k + 1} lit with ${lv.toggles} turns (the fewest is ${lv.best})${lv.hidden ? `, ${lv.shines} of ${SHINES} gong strikes left` : ''}.${k + 1 < LV.length ? ` Level ${k + 2} is open.` : ' Every level lit.'}` : `Level ${k + 1}: the sun set first.` });
          }
        },
        key(e, down) {
          if (!down || e.repeat) return; const k = e.key.toLowerCase();
          if (st.phase === 'pick') { const n = parseInt(k, 10); if (n >= 1 && n <= LV.length) choose(n - 1); return; }
          if (st.phase !== 'play') return;
          if (k === 'arrowup' || k === 'w') st.cy = Math.max(0, st.cy - 1); else if (k === 'arrowdown' || k === 's') st.cy = Math.min(lv.H - 1, st.cy + 1);
          else if (k === 'arrowleft' || k === 'a') st.cx = Math.max(0, st.cx - 1); else if (k === 'arrowright' || k === 'd') st.cx = Math.min(lv.W - 1, st.cx + 1);
          else if (k === ' ' || k === 'enter') turn(st.cx, st.cy); else if (k === 'g') shine();
        },
        pointer(evt) {
          if (evt.type !== B.PointerEventTypes.POINTERDOWN || st.phase !== 'play') return;
          const hit = scene.pickWithRay(ctx.ray(), m => !!m.metadata?.mirCell);
          if (hit && hit.hit) turn(...hit.pickedMesh.metadata.mirCell);
        },
        _test: { st, choose, turn, shine, get lv() { return lv; }, route: () => route(), allLit: () => lv && allLit() },
        dispose() { pick.remove(); gong.remove(); st.beamNodes.forEach(n => { try { n.dispose(); } catch (e) {} }); }
      };
      return inst;
    }
  };
  window.RebelGames.register('mirrors', G);
})();
