// The Engineer's Basins (Oct 15, Buke Great Hall): measure water with basins that carry no marks but their size.
// Click a basin (or press its number) to pick it up, then click another basin to pour into it (until one is empty or
// the other is full), or the canal to empty it; click the canal first (or press C) and then a basin to fill it from the
// canal. Levels without the canal start with one basin full. A level opens when the one before is done.
// def: { at: [x, z] (the middle basin, frame coordinates), canal: [x0, z0, x1, z1] (the clickable strip), player, cam, look, pass, points }
// Oct 17 (Miguel: the puzzles need a how-to, every board a Restart): howTo (the rules + measuring 1 with a 5 and a 3
// worked through, howto/basins.png; not level 1's way) and inst.restart = R.
(function () {
  const LEVELS = [
    { caps: [3, 5], start: [0, 0], canal: true, goal: { any: 4 }, best: 6 },
    { caps: [8, 5, 3], start: [8, 0, 0], goal: { split: [4, 4] }, best: 7 },
    { caps: [7, 11], start: [0, 0], canal: true, goal: { any: 6 }, best: 10 },
    { caps: [12, 7, 5], start: [12, 0, 0], goal: { split: [6, 6] }, best: 11 },
    { caps: [16, 11, 6], start: [16, 0, 0], goal: { split: [8, 8] }, best: 14 },
    // Oct 17 (Miguel: "make it 10 levels"): scratchpad basins/gen10.mjs, the fewest moves by BFS (15 up to 26)
    { caps: [13, 9, 4], start: [0, 0, 0], canal: true, goal: { split: [6, 6] }, best: 15 },
    { caps: [19, 12, 7], start: [0, 0, 0], canal: true, goal: { any: 13 }, best: 17 },
    { caps: [15, 11, 4], start: [0, 0, 0], canal: true, goal: { split: [6, 6] }, best: 19 },
    { caps: [17, 7], start: [0, 0], canal: true, goal: { any: 12 }, best: 22 },
    { caps: [17, 16], start: [0, 0], canal: true, goal: { any: 7 }, best: 26 }
  ];
  const SCORE = [20, 30, 50, 70, 100, 115, 130, 150, 175, 200];
  const G = {
    title: "The Engineer's Basins",
    howTo: {
      lines: ['Measure the water exactly. The goal is on the info line: "Measure exactly 4" (any basin holding 4) or "Split the water 4 and 4" (two basins with 4 each, any other basin empty).',
        'The tag over each basin shows its water / its size. A pour cannot be stopped by eye: the water runs until the first basin is empty or the second is full.',
        'Click a basin (or press its number) to pick it up: its rim glows gold. Then click another basin to pour into it. Click the picked basin again (or press X) to put it down.',
        'Where there is a canal: click it (or press C), then a basin, to fill that basin to the top; or pick a basin up and click the canal to empty it.',
        'Levels without a canal start with one basin full, and that water is all there is.',
        'R (or Restart) starts the level again. Measuring in the fewest moves earns +10; the result card shows the fewest.',
        'Tip: a full basin poured into a smaller empty one leaves the difference behind: a full 5 into an empty 3 leaves 2.'],
      img: 'howto/basins.png', caption: 'A 5 and a 3 by the canal: fill the 3, pour it into the 5, fill it again, pour again. The 5 fills up and 1 stays in the 3.'
    },
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const LV = def.levels || LEVELS, AT = def.at || [0, 0], CN = def.canal || [AT[0] - 5, AT[1] - 3.4, AT[0] + 5, AT[1] - 2];
      const KEY = 'rebelAntsBasinProgress:' + (def.id || 'basins');
      let solvedUpTo = 0; try { solvedUpTo = Math.max(0, Math.min(LV.length, Number(localStorage.getItem(KEY)) || 0)); } catch (e) {}
      const mat = (k, c, em, spec = .1, a) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(spec, spec, spec); if (em) m.emissiveColor = new B.Color3(...em); if (a != null) m.alpha = a; return m; });
      const M = { water: mat('water', [.25, .55, .8], [.05, .2, .35], .6, .82), rim: mat('rim', [.62, .46, .22], [.12, .08, .03], .5), sel: mat('rimSel', [1, .85, .35], [.85, .62, .18], .5),
        canal: mat('canal', [.3, .65, .95], [.15, .4, .7], .2, .32), canalSel: mat('canalSel', [.5, .85, 1], [.4, .7, 1], .2, .55), stream: mat('stream', [.4, .7, .95], [.2, .45, .7], .4, .75), base: mat('base', [.3, .27, .22], [.04, .035, .03]) };
      M.water.backFaceCulling = false;
      let lv = null; // { k, caps, vol, basins[{ root, wall, water, rim, h, x }], unit, moves, canal }
      const st = { phase: 'pick', sel: null, busy: 0, wait: 0, stream: null };
      const keep = n => { n.parent = ctx.frame; ctx.add(n); lv.nodes.push(n); return n; };
      // a basin's wall: stone with a mark at every unit (the only measure an engineer gets)
      function wallMat(k, i, cap) {
        const t = new B.DynamicTexture('bsWallTex', { width: 256, height: 512 }, scene, true), g = t.getContext();
        g.fillStyle = '#8a7f6c'; g.fillRect(0, 0, 256, 512); for (let n = 0; n < 900; n++) { const v = 110 + Math.random() * 60 | 0; g.fillStyle = `rgba(${v},${v - 6},${v - 18},.4)`; g.fillRect(Math.random() * 256, Math.random() * 512, 3, 3); }
        g.strokeStyle = 'rgba(40,30,20,.75)'; g.lineWidth = 3; for (let u = 1; u < cap; u++) { const y = 512 - u / cap * 512; g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
        t.update(); const m = new B.StandardMaterial('bsWall_' + k + '_' + i, scene); m.diffuseTexture = t; m.specularColor = new B.Color3(.05, .05, .05); m.emissiveColor = new B.Color3(.12, .11, .1); m.backFaceCulling = false;
        lv.nodes.push({ dispose() { t.dispose(); m.dispose(); } }); return m;
      }
      // labels over the basins (page text, placed on screen every frame)
      const hud = document.getElementById('gameHud'), tags = [];
      function build(k) {
        if (lv) lv.nodes.forEach(n => { try { n.dispose(); } catch (e) {} });
        tags.splice(0).forEach(t => t.remove());
        const L = LV[k], n = L.caps.length, maxCap = Math.max(...L.caps), unit = 1.7 / maxCap, D = 1.25, gap = 2.3;
        lv = { k, caps: L.caps.slice(), vol: L.start.slice(), basins: [], unit, moves: 0, canal: !!L.canal, nodes: [], best: L.best };
        L.caps.forEach((cap, i) => {
          const x = AT[0] + (i - (n - 1) / 2) * gap, h = cap * unit, root = new B.TransformNode('bsBasin', scene); keep(root); root.position.set(x, 0, AT[1]);
          const plinth = B.MeshBuilder.CreateCylinder('bsPlinth', { height: .16, diameter: D + .3, tessellation: 24 }, scene); plinth.parent = root; plinth.position.y = .08; plinth.material = M.base; ctx.add(plinth);
          const wall = B.MeshBuilder.CreateCylinder('bsWall', { height: h, diameter: D, tessellation: 28, cap: B.Mesh.CAP_START }, scene); wall.parent = root; wall.position.y = .16 + h / 2; wall.material = wallMat(k, i, cap); ctx.add(wall);
          const rim = B.MeshBuilder.CreateTorus('bsRim', { diameter: D, thickness: .08, tessellation: 28 }, scene); rim.parent = root; rim.position.y = .16 + h; rim.material = M.rim; ctx.add(rim);
          const water = B.MeshBuilder.CreateCylinder('bsWater', { height: 1, diameter: D * .9, tessellation: 24 }, scene); water.parent = root; water.material = M.water; ctx.add(water);
          [plinth, wall, rim, water].forEach(m => { m.isPickable = true; m.metadata = { bsBasin: i }; });
          lv.basins.push({ root, wall, rim, water, h, x, shown: lv.vol[i] });
          const tag = document.createElement('div'); tag.style.cssText = 'position:absolute;transform:translate(-50%,-100%);padding:3px 8px;border-radius:8px;background:rgba(12,14,10,.82);border:1px solid rgba(216,179,92,.6);color:#f3e6c4;font:700 14px Georgia,serif;white-space:nowrap;pointer-events:none';
          hud.appendChild(tag); tags.push(tag);
        });
        const cw = CN[2] - CN[0], cd = CN[3] - CN[1];
        lv.canalMesh = keep(B.MeshBuilder.CreateGround('bsCanal', { width: cw, height: cd }, scene)); lv.canalMesh.position.set((CN[0] + CN[2]) / 2, def.canalY ?? -.12, (CN[1] + CN[3]) / 2);
        lv.canalMesh.material = M.canal; lv.canalMesh.isPickable = true; lv.canalMesh.metadata = { bsCanal: true }; lv.canalMesh.setEnabled(lv.canal);
        st.sel = null; refresh(true); info();
      }
      const goalText = L => L.goal.any != null ? `Measure exactly ${L.goal.any}` : `Split the water ${L.goal.split.join(' and ')}`;
      const done = () => { const g = LV[lv.k].goal; if (g.any != null) return lv.vol.includes(g.any); const want = [...g.split, ...Array(lv.vol.length - g.split.length).fill(0)].sort((a, b) => a - b).join(','); return [...lv.vol].sort((a, b) => a - b).join(',') === want; };
      const info = () => H.info(lv ? `Level ${lv.k + 1} / ${LV.length} · ${goalText(LV[lv.k])} · moves ${lv.moves}` : 'Pick a level');
      function refresh(now) {
        lv.basins.forEach((b, i) => { b.rim.material = st.sel === i ? M.sel : M.rim; tags[i].textContent = `${lv.vol[i]} / ${lv.caps[i]}`; if (now) b.shown = lv.vol[i]; });
        lv.canalMesh.material = st.sel === 'canal' ? M.canalSel : M.canal;
        H.hint(st.sel === 'canal' ? 'Fill: click the basin to fill from the canal.' : st.sel != null ? `Basin ${st.sel + 1}: click a basin to pour into${lv.canal ? ', or the canal to empty it' : ''}.` : `Click a basin (<kbd>1</kbd>-<kbd>${lv.caps.length}</kbd>) to pick it up${lv.canal ? ', or the canal (<kbd>C</kbd>) to fill one' : ''}. <kbd>R</kbd> starts again.`);
      }
      function act(i, j, kind) { // kind: 'pour' | 'fill' | 'empty'
        const v = lv.vol, c = lv.caps;
        if (kind === 'fill') { if (v[j] === c[j]) { H.msg('Already full', 700); return; } v[j] = c[j]; streamFrom(null, j); ctx.sound('water'); }
        else if (kind === 'empty') { if (!v[i]) { H.msg('Already empty', 700); return; } v[i] = 0; streamFrom(i, null); ctx.sound('splash'); }
        else { const a = Math.min(v[i], c[j] - v[j]); if (!a) { H.msg(v[i] ? 'That basin is full' : 'Nothing to pour', 800); return; } v[i] -= a; v[j] += a; streamFrom(i, j); ctx.sound('water'); }
        lv.moves++; st.busy = .55; st.sel = null; refresh(); info();
        if (done()) { st.phase = 'solved'; st.wait = 1.8; ctx.sound('gamewin'); H.msg('Measured true!', 1500, `${lv.moves} moves`);
          if (lv.k + 1 > solvedUpTo) { solvedUpTo = lv.k + 1; try { localStorage.setItem(KEY, String(solvedUpTo)); } catch (e) {} } }
      }
      function streamFrom(i, j) { // a short arc of water from basin i (or the canal) to basin j (or the canal)
        if (st.stream) st.stream.dispose();
        const top = b => new V3(lv.basins[b].x, .16 + lv.basins[b].h + .1, AT[1]), canalPt = b => new V3(lv.basins[b].x, -.1, (CN[1] + CN[3]) / 2);
        const a = i == null ? canalPt(j) : top(i), z = j == null ? canalPt(i) : top(j), mid = V3.Center(a, z).add(new V3(0, 1.1, 0));
        const pts = []; for (let t = 0; t <= 1.001; t += .1) pts.push(V3.Lerp(V3.Lerp(a, mid, t), V3.Lerp(mid, z, t), t));
        const s = B.MeshBuilder.CreateTube('bsStream', { path: pts, radius: .07, tessellation: 8 }, scene); s.material = M.stream; s.isPickable = false; s.parent = ctx.frame; ctx.add(s); st.stream = s; st.streamT = .55;
      }
      function click(target) { // a basin index or 'canal'
        if (st.phase !== 'play' || st.busy > 0) return;
        if (target === 'canal' && !lv.canal) return;
        if (st.sel == null) { st.sel = target; ctx.note(target === 'canal' ? 330 : 440 + target * 60, 'bell'); refresh(); return; }
        if (st.sel === target) { st.sel = null; refresh(); return; }
        if (st.sel === 'canal') act(null, target, 'fill'); else if (target === 'canal') act(st.sel, null, 'empty'); else act(st.sel, target, 'pour');
      }
      function restart() { if (st.phase !== 'play') return; lv.vol = LV[lv.k].start.slice(); lv.moves = 0; st.sel = null; refresh(); info(); H.msg('Back to the start', 700); }
      // the picker
      const pick = document.createElement('div');
      pick.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(' + (LV.length > 6 && innerWidth >= 600 ? 560 : 400) + 'px,92vw);background:rgba(18,22,14,.94);border:1px solid rgba(216,179,92,.7);border-radius:14px;padding:16px;text-align:center;pointer-events:auto;font:15px/1.4 Georgia,serif;color:#eee';
      pick.innerHTML = `<div style="font:700 13px/1.2 Georgia,serif;letter-spacing:.14em;text-transform:uppercase;color:#d8b35c;margin-bottom:10px">The Engineer's Basins</div><div style="margin-bottom:12px;color:#bbb">The basins carry no marks but their size. Pour, fill and empty until the water is measured true.</div>`
        + `<div style="display:grid;grid-template-columns:repeat(${LV.length > 6 && innerWidth >= 600 ? 5 : 2},1fr);gap:8px">${LV.map((L, k) => { const open = k <= solvedUpTo, ok = k < solvedUpTo; return `<button type="button" data-k="${k}" ${open ? '' : 'disabled'} style="padding:9px 4px;border-radius:9px;border:1px solid ${open ? '#d8b35c' : '#444'};background:${ok ? 'rgba(216,179,92,.22)' : 'rgba(255,255,255,.04)'};color:${open ? '#fff' : '#666'};font:700 15px Georgia,serif;cursor:${open ? 'pointer' : 'default'}">${open ? `Level ${k + 1}<div style="font:12px Georgia,serif;color:#c9b88a">${L.caps.join(' · ')}${L.canal ? ' · canal' : ''}</div>` : '🔒'}${ok ? ' ✓' : ''}</button>`; }).join('')}</div>`;
      pick.querySelectorAll('button[data-k]').forEach(b => b.onclick = (e) => { e.stopPropagation(); b.blur(); choose(+b.dataset.k); });
      function choose(k) { if (st.phase !== 'pick' || k > solvedUpTo || k >= LV.length) return; pick.remove(); st.phase = 'play'; build(k); H.msg(`Level ${k + 1}`, 1100, goalText(LV[k])); }
      hud.appendChild(pick);
      const P = def.player || [AT[0] + 4.6, AT[1] + 1.8, -Math.PI / 2]; ctx.player.place(P[0], P[1], P[2]);
      const cam = def.cam || [AT[0], 5.4, AT[1] + 7.2], look = def.look || [AT[0], .6, AT[1] - 1];
      ctx.look(cam, look, def.fov || .8);
      H.title(def.title || "The Engineer's Basins"); H.score('');
      H.info('Pick a level'); H.hint('');
      return {
        update(dt) {
          ctx.look(cam, look);
          if (!lv) return;
          if (st.busy > 0) st.busy -= dt;
          if (st.stream && (st.streamT -= dt) <= 0) { st.stream.dispose(); st.stream = null; }
          lv.basins.forEach((b, i) => { b.shown += (lv.vol[i] - b.shown) * Math.min(1, dt * 5); const h = Math.max(.001, b.shown * lv.unit); b.water.scaling.y = h; b.water.position.y = .17 + h / 2; b.water.setEnabled(b.shown > .02);
            const p = ctx.screenOf(ctx.toWorld(b.x, .16 + b.h + .45, AT[1])); tags[i].style.left = p.x + 'px'; tags[i].style.top = p.y + 'px'; tags[i].style.display = p.behind ? 'none' : 'block'; });
          if (st.phase === 'solved' && (st.wait -= dt) <= 0) {
            st.phase = 'done'; H.hint(''); tags.forEach(t => t.remove());
            const k = lv.k, score = (SCORE[k] ?? 20 * (k + 1)) + (lv.moves <= lv.best ? 10 : 0);
            ctx.finish({ score, label: 'points', solved: true, passed: score >= (def.pass || 0), extra: `Level ${k + 1} measured in ${lv.moves} moves (the fewest is ${lv.best}).${k + 1 < LV.length ? ` Level ${k + 2} is open.` : ' Every level measured.'}` });
          }
        },
        key(e, down) {
          if (!down || e.repeat) return; const k = e.key.toLowerCase();
          if (st.phase === 'pick') { const n = k === '0' ? 10 : parseInt(k, 10); if (n >= 1 && n <= LV.length) choose(n - 1); return; } // 1-9, 0 = the tenth
          if (st.phase !== 'play') return;
          const n = parseInt(k, 10); if (n >= 1 && n <= lv.caps.length) click(n - 1); else if (k === 'c') click('canal'); else if (k === 'r') restart(); else if (k === 'x' || k === 'backspace') { st.sel = null; refresh(); }
        },
        pointer(evt) {
          if (evt.type !== B.PointerEventTypes.POINTERDOWN || st.phase !== 'play') return;
          const hit = scene.pickWithRay(ctx.ray(), m => m.metadata?.bsBasin !== undefined || (!!m.metadata?.bsCanal && m.isEnabled())); if (!hit?.hit) return;
          click(hit.pickedMesh.metadata.bsCanal ? 'canal' : hit.pickedMesh.metadata.bsBasin);
        },
        restart, // the HUD's Restart button (as R)
        _test: { st, choose, click, restart, done: () => lv && done(), get lv() { return lv; } },
        dispose() { pick.remove(); tags.forEach(t => t.remove()); if (st.stream) st.stream.dispose(); if (lv) lv.nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); }
      };
    }
  };
  window.RebelGames.register('basins', G);
})();
