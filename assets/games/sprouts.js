// Sprout Field (Oct 15, Ashigaru): a field of rice-sprout beds. Watering a bed stands its sprouts up (or knocks them
// down if they stand) and does the same to the four beds beside it. Stand every sprout up. Levels: 3 x 3, 4 x 4, 5 x 5,
// 5 x 5 with most of the field down, 6 x 6; a level opens when the one before is won, and the result tells the fewest
// waterings it takes. Click a bed (or move the ring with the arrows and press Space); H shows one bed to water (each
// hint costs 10 points); R lays the level out again.
// Oct 17: How to play (the rules in a few lines) and Restart beside Quit (R's "the field as it was").
// def: { at: [x, z] (the field's middle, frame coordinates), size: field width (m), player: [x, z, yaw], cam, look, levels, pass, points }
(function () {
  // from scratchpad sprouts/gen.mjs: the beds that start down, and the fewest waterings that stand them all up
  const LEVELS = [
    { n: 3, down: [1, 3, 4, 7, 8], min: 4 },
    { n: 4, down: [1, 5, 7, 12, 15], min: 6 },
    { n: 5, down: [0, 3, 5, 6, 9, 10, 11, 12, 13, 14, 15, 20, 21, 23, 24], min: 9 },
    { n: 5, down: [0, 6, 8, 10, 13, 17, 18, 19, 20, 21, 22, 24], min: 13 },
    { n: 6, down: [2, 3, 5, 8, 9, 10, 11, 13, 15, 16, 18, 20, 21, 22, 23, 24, 28, 31, 32, 34], min: 16 },
    // Oct 17 (Miguel: "make it 10 levels"): sprouts/gen10.mjs, 6 x 6 to 8 x 8 (one answer each: these fields have no
    // waterings that cancel out)
    { n: 6, down: [2, 5, 6, 7, 8, 9, 11, 12, 13, 15, 16, 17, 20, 22, 23, 24, 26, 30, 31], min: 19 },
    { n: 7, down: [0, 2, 3, 4, 7, 8, 9, 11, 12, 14, 15, 16, 22, 23, 24, 25, 26, 27, 28, 30, 34, 35, 36, 39, 40, 42, 43, 44, 45, 46, 48], min: 20 },
    { n: 7, down: [3, 8, 10, 11, 12, 13, 14, 15, 17, 21, 23, 25, 27, 30, 31, 32, 35, 36, 37, 39, 41, 44, 45, 48], min: 25 },
    { n: 8, down: [0, 2, 9, 14, 16, 17, 18, 21, 23, 24, 25, 26, 27, 31, 32, 33, 36, 38, 39, 40, 42, 43, 47, 48, 52, 55, 58, 62, 63], min: 28 },
    { n: 8, down: [1, 4, 5, 6, 7, 13, 15, 16, 17, 19, 20, 22, 24, 25, 29, 30, 31, 32, 39, 42, 44, 45, 46, 48, 51, 52, 57, 58, 59, 62, 63], min: 34 }
  ];
  const SCORE = [20, 35, 55, 75, 95, 110, 125, 145, 165, 190];
  const NB = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
  // the fewest beds to water from this field (GF(2) elimination; the free choices tried for the lightest answer)
  function solve(n, down) {
    const N = n * n, A = [];
    for (let r = 0; r < N; r++) { const row = new Uint8Array(N + 1), y = Math.floor(r / n), x = r % n;
      for (const [dy, dx] of NB) { const yy = y + dy, xx = x + dx; if (yy >= 0 && yy < n && xx >= 0 && xx < n) row[yy * n + xx] = 1; }
      row[N] = down.has(r) ? 1 : 0; A.push(row); }
    const where = new Array(N).fill(-1); let row = 0;
    for (let col = 0; col < N && row < N; col++) {
      let p = -1; for (let r = row; r < N; r++) if (A[r][col]) { p = r; break; }
      if (p < 0) continue;
      [A[p], A[row]] = [A[row], A[p]]; where[col] = row;
      for (let r = 0; r < N; r++) if (r !== row && A[r][col]) for (let c = col; c <= N; c++) A[r][c] ^= A[row][c];
      row++;
    }
    for (let r = row; r < N; r++) if (A[r][N]) return null;
    const free = []; for (let c = 0; c < N; c++) if (where[c] < 0) free.push(c);
    let best = null;
    for (let mask = 0; mask < (1 << free.length); mask++) {
      const x = new Uint8Array(N); free.forEach((c, k) => { x[c] = (mask >> k) & 1; });
      for (let c = 0; c < N; c++) if (where[c] >= 0) { const r = where[c]; let v = A[r][N]; for (const f of free) if (A[r][f] && x[f]) v ^= 1; x[c] = v; }
      const w = x.reduce((a, b) => a + b, 0); if (!best || w < best.w) best = { w, x };
    }
    return [...best.x].map((v, i) => v ? i : -1).filter(i => i >= 0);
  }
  const G = {
    title: 'Sprout Field',
    howTo: { lines: [
      'Stand every rice sprout up.',
      'Watering a bed flips it: fallen sprouts stand up, standing ones are knocked flat. The four beds beside it (above, below, left and right) flip too; a bed on the edge has fewer, a corner only two.',
      'Click (or tap) a bed to water it, or move the gold ring with the arrows / W A S D and press Space.',
      'There is no undo: watering the same bed again flips the same beds back. R (or Restart) lays the field out as it was.',
      'H rings one bed worth watering; each hint costs 10 points.',
      'The result tells the fewest waterings: manage that with no hint for 15 more points.',
      'Tip: the order never matters, only which beds you water, and watering a bed twice undoes it.'],
      img: 'howto/sprouts.png', caption: 'A 3 x 3 field in its fewest waterings: the middle bed (five beds flip), then the top right corner (three flip), and every sprout stands.' },
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const LV = def.levels || LEVELS, AT = def.at || [0, 0], W = def.size || 7.6;
      const KEY = 'rebelAntsSproutProgress:' + (def.id || 'sprouts');
      let solvedUpTo = 0; try { solvedUpTo = Math.max(0, Math.min(LV.length, Number(localStorage.getItem(KEY)) || 0)); } catch (e) {}
      const mat = (k, c, em, spec = .08) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(spec, spec, spec); if (em) m.emissiveColor = new B.Color3(...em); return m; });
      const M = { up: mat('up', [.42, .74, .25], [.1, .2, .05]), down: mat('down', [.62, .5, .22], [.12, .09, .03]), rim: mat('rim', [.38, .26, .15], [.05, .035, .02]),
        cursor: mat('cursor', [1, .85, .35], [.9, .7, .2]), hint: mat('hint', [1, .78, .25], [1, .62, .12], .5),
        splash: mat('splash', [.6, .82, 1], [.45, .68, 1]) };
      M.splash.alpha = .55; M.splash.backFaceCulling = false; M.cursor.disableLighting = true; M.hint.disableLighting = true;
      const nodes = [], keep = n => { n.parent = ctx.frame; ctx.add(n); nodes.push(n); return n; };
      // one tuft of blades: standing (green) or knocked flat (straw), as two meshes with a thin instance per tuft
      function tuft(name, lie, m) {
        const parts = [];
        for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 + .4, b = B.MeshBuilder.CreateCylinder(name + 'B', { height: .55, diameterTop: 0, diameterBottom: .06, tessellation: 3 }, scene);
          b.position.y = .27; b.bakeCurrentTransformIntoVertices();
          b.rotation.set(Math.cos(a) * (lie ? 1.25 : .22), 0, Math.sin(a) * (lie ? 1.25 : .22)); b.position.set(Math.sin(a) * .05, 0, Math.cos(a) * .05); parts.push(b); }
        const t = B.Mesh.MergeMeshes(parts, true, true); t.name = name; t.material = m; t.isPickable = false; t.alwaysSelectAsActiveMesh = true; return keep(t);
      }
      const upT = tuft('spUp', false, M.up), downT = tuft('spDown', true, M.down);
      let bd = null; // { k, n, C, down: Set, moves, hints, grow: Map(cell -> t) }
      const st = { phase: 'pick', cr: 0, cc: 0, wait: 0, hint: -1, splash: [] };
      const cellPos = (i) => { const n = bd.n, r = Math.floor(i / n), c = i % n; return new V3(AT[0] + (c - (n - 1) / 2) * bd.C, 0, AT[1] + ((n - 1) / 2 - r) * bd.C); };
      // four tufts a bed; the matrices are rebuilt when a bed changes or grows
      const OFF = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
      const tm = new B.Matrix(), q = new B.Quaternion(), sv = new V3(), tv = new V3();
      function setTuft(mesh, idx, p, yaw, s) { B.Quaternion.FromEulerAnglesToRef(0, yaw, 0, q); sv.set(s, s, s); tv.copyFrom(p); B.Matrix.ComposeToRef(sv, q, tv, tm); mesh.thinInstanceSetMatrixAt(idx, tm, false); }
      function drawBed(i) {
        const p = cellPos(i), base = Math.min(1.5, bd.C * .7), d = bd.C * .22, up = !bd.down.has(i), g = bd.grow.get(i) ?? 1;
        OFF.forEach(([ox, oz], k) => { const yaw = (i * 7 + k * 3) % 6, q0 = new V3(p.x + ox * d, .02, p.z + oz * d);
          setTuft(upT, i * 4 + k, q0, yaw, up ? base * (.25 + .75 * g) : 0); setTuft(downT, i * 4 + k, q0, yaw, up ? 0 : base * .9); });
      }
      function flush() { upT.thinInstanceBufferUpdated('matrix'); downT.thinInstanceBufferUpdated('matrix'); upT.thinInstanceRefreshBoundingInfo(false); downT.thinInstanceRefreshBoundingInfo(false); }
      function fieldTexture(n) {
        const S = 1024, t = new B.DynamicTexture('spFieldTex', { width: S, height: S }, scene, true), g = t.getContext(), c = S / n;
        g.fillStyle = '#4a6f86'; g.fillRect(0, 0, S, S); // water in the channels
        for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) { const x = k * c + c * .07, y = r * c + c * .07, w = c * .86;
          g.fillStyle = '#4b3826'; g.fillRect(x, y, w, w); g.fillStyle = 'rgba(255,255,255,.05)'; for (let s = 0; s < 6; s++) g.fillRect(x, y + w * (s + .5) / 6, w, 3); }
        t.update(); return t;
      }
      function build(k) {
        if (bd) bd.nodes.forEach(n => { try { n.dispose(); } catch (e) {} });
        const L = LV[k], n = L.n, C = W / n;
        bd = { k, n, C, down: new Set(L.down), moves: 0, hints: 0, grow: new Map(), nodes: [], min: L.min ?? (solve(n, new Set(L.down)) || []).length };
        const field = B.MeshBuilder.CreateGround('spField', { width: W, height: W }, scene); field.parent = ctx.frame; ctx.add(field); bd.nodes.push(field);
        const fm = new B.StandardMaterial('spFieldMat_' + k, scene); fm.diffuseTexture = fieldTexture(n); fm.specularColor = new B.Color3(.15, .15, .17); fm.emissiveColor = new B.Color3(.1, .09, .08); field.material = fm;
        field.position.set(AT[0], .04, AT[1]); field.isPickable = true; field.metadata = { spField: true }; bd.nodes.push({ dispose() { fm.diffuseTexture?.dispose(); fm.dispose(); } });
        for (const [w, d, x, z] of [[W + .5, .25, 0, W / 2 + .12], [W + .5, .25, 0, -W / 2 - .12], [.25, W, W / 2 + .12, 0], [.25, W, -W / 2 - .12, 0]]) {
          const b = B.MeshBuilder.CreateBox('spRim', { width: w, height: .22, depth: d }, scene); b.parent = ctx.frame; ctx.add(b); bd.nodes.push(b); b.material = M.rim; b.position.set(AT[0] + x, .1, AT[1] + z); b.isPickable = false; }
        const N = n * n, z = new Float32Array(N * 4 * 16);
        upT.thinInstanceSetBuffer('matrix', z.slice(), 16, false); downT.thinInstanceSetBuffer('matrix', z, 16, false);
        for (let i = 0; i < N; i++) drawBed(i); flush();
        if (!st.cursor) { st.cursor = keep(B.MeshBuilder.CreateTorus('spCursor', { diameter: 1, thickness: .05, tessellation: 28 }, scene)); st.cursor.material = M.cursor; st.cursor.isPickable = false;
          st.hintRing = keep(B.MeshBuilder.CreateTorus('spHint', { diameter: 1, thickness: .09, tessellation: 28 }, scene)); st.hintRing.material = M.hint; st.hintRing.isPickable = false;
          for (let s = 0; s < 5; s++) { const d = keep(B.MeshBuilder.CreateDisc('spSplash', { radius: .5, tessellation: 20 }, scene)); d.rotation.x = Math.PI / 2; d.material = M.splash; d.isPickable = false; d.setEnabled(false); st.splash.push({ d, t: 0 }); } }
        st.cursor.scaling.setAll(C * .9); st.hintRing.scaling.setAll(C * .95); st.hintRing.setEnabled(false); st.hint = -1;
        st.cr = Math.floor(n / 2); st.cc = Math.floor(n / 2);
        info();
      }
      const standing = () => bd.n * bd.n - bd.down.size;
      const info = () => { H.info(bd ? `Level ${bd.k + 1} / ${LV.length} · standing ${standing()} / ${bd.n * bd.n}` : 'Pick a level'); H.score(bd ? `${bd.moves} waterings` : ''); };
      function water(r, c) {
        if (st.phase !== 'play') return;
        st.cr = r; st.cc = c; const n = bd.n; let s = 0;
        for (const [dy, dx] of NB) { const yy = r + dy, xx = c + dx; if (yy < 0 || yy >= n || xx < 0 || xx >= n) continue; const i = yy * n + xx;
          if (bd.down.has(i)) { bd.down.delete(i); bd.grow.set(i, 0); } else bd.down.add(i);
          drawBed(i); const sp = st.splash[s++]; if (sp) { const p = cellPos(i); sp.d.position.set(p.x, .09, p.z); sp.t = .45; sp.d.setEnabled(true); } }
        flush(); bd.moves++;
        if (st.hint === r * n + c) { st.hint = -1; st.hintRing.setEnabled(false); }
        ctx.sound('splash'); ctx.note(392 + standing() * 12, 'bell'); info();
        if (!bd.down.size) { st.phase = 'solved'; st.wait = 1.7; ctx.sound('gamewin'); H.msg('Every sprout stands!', 1600, `${bd.moves} waterings`);
          if (bd.k + 1 > solvedUpTo) { solvedUpTo = bd.k + 1; try { localStorage.setItem(KEY, String(solvedUpTo)); } catch (e) {} } }
      }
      function hint() {
        if (st.phase !== 'play') return;
        const s = solve(bd.n, new Set(bd.down)); if (!s || !s.length) return;
        // the bed nearest the ring among the fewest waterings from here
        const cur = st.cr * bd.n + st.cc, d = i => Math.abs(Math.floor(i / bd.n) - st.cr) + Math.abs(i % bd.n - st.cc);
        st.hint = s.includes(cur) ? cur : s.slice().sort((a, b) => d(a) - d(b))[0]; bd.hints++;
        const p = cellPos(st.hint); st.hintRing.position.set(p.x, .16, p.z); st.hintRing.setEnabled(true);
        H.msg('Water the bed in the gold ring', 1300, `${s.length} more waterings from here · hints cost 10 points`);
      }
      // R and Restart beside Quit: the field as it was picked (waterings and hints at 0)
      function relay() { if (st.phase !== 'play') return; const k = bd.k; build(k); H.msg('The field as it was', 800); }
      // the level picker
      const hud = document.getElementById('gameHud'), pick = document.createElement('div');
      pick.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(' + (LV.length > 6 && innerWidth >= 600 ? 560 : 400) + 'px,92vw);background:rgba(12,16,30,.94);border:1px solid rgba(216,179,92,.7);border-radius:14px;padding:16px;text-align:center;pointer-events:auto;font:15px/1.4 Georgia,serif;color:#eee';
      const label = L => `${L.n} × ${L.n} · ${L.down.length} down`;
      pick.innerHTML = `<div style="font:700 13px/1.2 Georgia,serif;letter-spacing:.14em;text-transform:uppercase;color:#d8b35c;margin-bottom:10px">Sprout Field</div><div style="margin-bottom:12px;color:#bbb">Watering a bed stands it up, or knocks it down, with the four beds beside it. Stand every sprout up.</div>`
        + `<div style="display:grid;grid-template-columns:repeat(${LV.length > 6 && innerWidth >= 600 ? 5 : 2},1fr);gap:8px">${LV.map((L, k) => { const open = k <= solvedUpTo, done = k < solvedUpTo; return `<button type="button" data-k="${k}" ${open ? '' : 'disabled'} style="padding:10px 4px;border-radius:9px;border:1px solid ${open ? '#d8b35c' : '#444'};background:${done ? 'rgba(216,179,92,.22)' : 'rgba(255,255,255,.04)'};color:${open ? '#fff' : '#666'};font:700 15px Georgia,serif;cursor:${open ? 'pointer' : 'default'}">${open ? 'Level ' + (k + 1) : '🔒'}${done ? ' ✓' : ''}${open ? `<div style="font:12px Georgia,serif;color:#c9b88a">${label(L)}</div>` : ''}</button>`; }).join('')}</div>`;
      pick.querySelectorAll('button[data-k]').forEach(b => b.onclick = (e) => { e.stopPropagation(); b.blur(); choose(+b.dataset.k); });
      function choose(k) { if (st.phase !== 'pick' || k > solvedUpTo || k >= LV.length) return; pick.remove(); st.phase = 'play'; build(k); H.msg(`Level ${k + 1}`, 900, k >= 3 ? 'a hard one' : label(LV[k])); }
      hud.appendChild(pick);
      // a hint button for phones (Oct 24): the same as H
      const hintBtn = document.createElement('button'); hintBtn.type = 'button'; hintBtn.textContent = 'Hint';
      hintBtn.style.cssText = 'position:absolute;bottom:62px;left:16px;display:none;min-width:84px;height:46px;padding:0 14px;border-radius:10px;border:1px solid #8fd46a;background:rgba(12,24,10,.88);color:#fff;font:700 15px system-ui,sans-serif;cursor:pointer;pointer-events:auto';
      hintBtn.onclick = (e) => { e.stopPropagation(); hintBtn.blur(); hint(); };
      hud.appendChild(hintBtn);
      let hintShown = false;
      const P = def.player || [AT[0] - W / 2 - 1.6, AT[1] - W / 2 - .6, Math.PI / 4]; ctx.player.place(P[0], P[1], P[2]);
      const cam = def.cam || [AT[0] + .6, 5.4 + W * .3, AT[1] - W / 2 - 3.4], at = def.look || [AT[0], 0, AT[1] + .4];
      ctx.look(cam, at, def.fov || .85);
      H.title(def.title || 'Sprout Field'); H.score(''); info();
      H.hint('Click a bed to water it (or move the ring with the arrows and press <kbd>Space</kbd>). <kbd>H</kbd> a hint, <kbd>R</kbd> start the level again.');
      return {
        update(dt) {
          const hs = st.phase === 'play'; if (hs !== hintShown) { hintShown = hs; hintBtn.style.display = hs ? 'block' : 'none'; }
          ctx.look(cam, at);
          if (bd && st.cursor) { const p = cellPos(st.cr * bd.n + st.cc); st.cursor.position.set(p.x, .12, p.z); st.cursor.setEnabled(st.phase === 'play'); }
          if (st.hintRing?.isEnabled()) st.hintRing.position.y = .16 + Math.abs(Math.sin(performance.now() / 260)) * .25;
          if (bd && bd.grow.size) { for (const [i, g] of bd.grow) { const v = Math.min(1, g + dt / .35); if (v >= 1) bd.grow.delete(i); else bd.grow.set(i, v); drawBed(i); } flush(); }
          for (const sp of st.splash) if (sp.t > 0) { sp.t = Math.max(0, sp.t - dt); const f = 1 - sp.t / .45, s = (bd ? bd.C : 1) * (.25 + .7 * f); sp.d.scaling.set(s, s, s); sp.d.visibility = 1 - f; if (!sp.t) sp.d.setEnabled(false); }
          if (st.phase === 'solved' && (st.wait -= dt) <= 0) {
            st.phase = 'done'; H.hint('');
            const k = bd.k, base = SCORE[k] ?? 20 * (k + 1), fewest = bd.moves <= bd.min, score = Math.max(5, base - bd.hints * 10 + (fewest && !bd.hints ? 15 : 0));
            ctx.finish({ score, label: 'points', solved: true, passed: score >= (def.pass || 0), extra: `Level ${k + 1} (${label(LV[k])}): ${bd.moves} waterings, the fewest is ${bd.min}${fewest && !bd.hints ? ' (+15)' : ''}${bd.hints ? `, ${bd.hints} hint${bd.hints === 1 ? '' : 's'}` : ''}.${k + 1 < LV.length ? ` Level ${k + 2} is open.` : ' Every level won.'}` });
          }
        },
        key(e, down) {
          if (!down || e.repeat) return; const k = e.key.toLowerCase();
          if (st.phase === 'pick') { const n = k === '0' ? 10 : parseInt(k, 10); if (n >= 1 && n <= LV.length) choose(n - 1); return; } // 1-9, 0 = the tenth
          if (st.phase !== 'play') return;
          if (k === 'arrowup' || k === 'w') st.cr = Math.max(0, st.cr - 1); else if (k === 'arrowdown' || k === 's') st.cr = Math.min(bd.n - 1, st.cr + 1);
          else if (k === 'arrowleft' || k === 'a') st.cc = Math.max(0, st.cc - 1); else if (k === 'arrowright' || k === 'd') st.cc = Math.min(bd.n - 1, st.cc + 1);
          else if (k === ' ' || k === 'enter') water(st.cr, st.cc); else if (k === 'h') hint(); else if (k === 'r') relay();
        },
        pointer(evt) {
          if (evt.type !== B.PointerEventTypes.POINTERDOWN || st.phase !== 'play') return;
          const hit = scene.pickWithRay(ctx.ray(), m => !!m.metadata?.spField); if (!hit?.hit) return;
          const p = ctx.toLocal(hit.pickedPoint), c = Math.round((p.x - AT[0]) / bd.C + (bd.n - 1) / 2), r = Math.round((bd.n - 1) / 2 - (p.z - AT[1]) / bd.C);
          if (r >= 0 && c >= 0 && r < bd.n && c < bd.n) water(r, c);
        },
        restart: relay,
        _test: { st, choose, water, hint, relay, solve, cellPos: i => cellPos(i), get bd() { return bd; } },
        dispose() { pick.remove(); hintBtn.remove(); if (bd) bd.nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); }
      };
    }
  };
  window.RebelGames.register('sprouts', G);
})();
