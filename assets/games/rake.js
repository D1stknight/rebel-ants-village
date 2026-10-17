// The Raking Path (Oct 15, Sohei training yard): the old monk's test. Rake every square of sand in one unbroken line,
// starting where the rake stands, never crossing a raked square and never touching the rocks. Move with the arrows /
// WASD or click the next square; step back onto the last square (or press U) to lift the rake, R starts again.
// Levels 5 x 5 to 9 x 9, the later ones with only one to six ways through. A level opens when the one before is done.
// Oct 17: How to play (the rules in a few lines) and Restart beside Quit; Restart and R now start the level as it was
// picked (the steps-back count too, which R used to keep adding to).
// def: { at: [x, z] (board middle, frame coordinates), size: board width (m), player: [x, z, yaw], cam, look, levels, pass, points }
(function () {
  const LEVELS = [
    { rows: ['.#...', '..S..', '..#..', '.#...', '.....'] },
    { rows: ['..S.#.', '..#...', '......', '......', '....#.', '#.....'] },
    { rows: ['#......', '.......', '..S.##.', '.......', '.......', '..##...', '...#...'] },
    { rows: ['.......', '.......', '##....#', '...#...', '..S....', '#...#..', '.......'] },
    { rows: ['..S..#..', '.#......', '......#.', '.#......', '.......#', '#.##....', '........', '........'] },
    // levels 6-10 (scratchpad rake/gen10.mjs, ways counted exactly by rake/verify10.mjs), ordered by how long a solver searches
    { rows: ['........', '....#...', '.....#..', '........', '#...#.#.', '#..#....', '..S#....', '....#...'], ways: 3 },
    { rows: ['........', '......#.', '#.#.....', '........', '....##..', '........', '.#...S##', '........'], ways: 1 },
    { rows: ['S.......', '..##....', '........', '..###...', '........', '.......#', '##......', '........'], ways: 6 },
    { rows: ['#..#...#', '.....#..', '#.......', '...S....', '......#.', '........', '.....#..', '..#.....'], ways: 3 },
    { rows: ['....#....', '..##.....', '.......#.', '.#..#....', '....#....', '.........', '......#..', '..S.#..#.', '.........'], ways: 4 }
  ];
  const WAYS = [1, 1, 2, 2, 2]; // ways through levels 1-5
  const SCORE = [20, 40, 70, 100, 130, 160, 190, 220, 260, 300];
  const D = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const G = {
    title: 'The Raking Path',
    howTo: { lines: [
      'Rake every square of sand in one unbroken line, starting where the rake stands (the small stone ring).',
      'The line moves one square at a time (up, down, left or right). It may never cross a square already raked, and never touch a rock.',
      'Move with the arrows / W A S D, or click the next square. Stepping back the way you came (or U) takes back the last square.',
      'R (or Restart) smooths the sand and starts again.',
      'Tip: a square with only one free neighbour is a dead end, so the line has to finish there. Plan the route to end on it.'] },
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const LV = def.levels || LEVELS, AT = def.at || [0, 0], W = def.size || 7.2;
      const KEY = 'rebelAntsRakeProgress:' + (def.id || 'rake');
      let solvedUpTo = 0; try { solvedUpTo = Math.max(0, Math.min(LV.length, Number(localStorage.getItem(KEY)) || 0)); } catch (e) {}
      const mat = (k, c, em, spec = .1) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(spec, spec, spec); if (em) m.emissiveColor = new B.Color3(...em); return m; });
      const M = { rock: mat('rock', [.34, .34, .33], [.04, .04, .04]), moss: mat('moss', [.28, .4, .2], [.03, .05, .02]), wood: mat('wood', [.5, .36, .22], [.07, .05, .03]), rim: mat('rim', [.3, .24, .18], [.04, .03, .02]),
        bamboo: mat('bamboo', [.78, .72, .42], [.12, .11, .06]), node: mat('bambooNode', [.55, .5, .26], [.07, .06, .03]), rope: mat('rope', [.82, .74, .56], [.12, .1, .07]) };
      // the sand: a speckled base painted once, the raked line drawn over it after every move
      const base = document.createElement('canvas'); base.width = base.height = 1024;
      { const g = base.getContext('2d'); g.fillStyle = '#e4d6b4'; g.fillRect(0, 0, 1024, 1024); for (let i = 0; i < 9000; i++) { const v = 180 + Math.random() * 60 | 0; g.fillStyle = `rgba(${v},${v - 14},${v - 40},.35)`; g.fillRect(Math.random() * 1024, Math.random() * 1024, 2, 2); } }
      let bd = null; // { k, n, C, cells[y][x], path: [[x, y]], rocks, total, tex, nodes, undos, rakeNode }
      const st = { phase: 'pick', wait: 0, stuckShown: false };
      // the camera looks along +z: column x = 0 on the left (-x), row y = 0 at the far edge (+z)
      const posOf = (x, y) => new V3(AT[0] + (x - (bd.n - 1) / 2) * bd.C, 0, AT[1] + ((bd.n - 1) / 2 - y) * bd.C);
      const keep = n => { n.parent = ctx.frame; ctx.add(n); bd.nodes.push(n); return n; };
      function paint() {
        const S = 1024, c = S / bd.n, g = bd.tex.getContext(); g.drawImage(base, 0, 0);
        // rings round the rocks, faint square lines
        for (let y = 0; y < bd.n; y++) for (let x = 0; x < bd.n; x++) if (bd.cells[y][x] === '#') for (let r = 1; r <= 2; r++) { g.strokeStyle = 'rgba(120,100,70,.45)'; g.lineWidth = 4; g.beginPath(); g.arc((x + .5) * c, (y + .5) * c, c * (.28 + r * .1), 0, Math.PI * 2); g.stroke(); }
        g.strokeStyle = 'rgba(140,118,84,.28)'; g.lineWidth = 2; for (let i = 1; i < bd.n; i++) { g.beginPath(); g.moveTo(i * c, 0); g.lineTo(i * c, S); g.stroke(); g.beginPath(); g.moveTo(0, i * c); g.lineTo(S, i * c); g.stroke(); }
        // the grooves: five lines through each raked square, curved at the turns
        const P = bd.path, side = (a, b) => [b[0] - a[0], b[1] - a[1]];
        const groove = (draw) => { for (const [col, w, off] of [['rgba(118,96,62,.7)', 5, 1.5], ['rgba(255,248,228,.75)', 2.5, -1.5]]) { g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; draw(off); } };
        P.forEach((p, i) => {
          const cx = (p[0] + .5) * c, cy = (p[1] + .5) * c, a = i > 0 ? side(p, P[i - 1]) : null, b = i < P.length - 1 ? side(p, P[i + 1]) : null;
          const ends = [a, b].filter(Boolean);
          for (let k = -2; k <= 2; k++) {
            const o = k * c * .15;
            groove(off => {
              g.beginPath();
              if (ends.length === 2 && ends[0][0] === -ends[1][0] && ends[0][1] === -ends[1][1]) { // straight through
                const [dx, dy] = ends[0], nx = -dy, ny = dx; g.moveTo(cx + dx * c / 2 + nx * (o + off), cy + dy * c / 2 + ny * (o + off)); g.lineTo(cx - dx * c / 2 + nx * (o + off), cy - dy * c / 2 + ny * (o + off));
              } else if (ends.length === 2) { // a turn: quarter circles round the inner corner
                const [d1, d2] = ends, kx = cx + (d1[0] + d2[0]) * c / 2, ky = cy + (d1[1] + d2[1]) * c / 2, r = c / 2 + o + off, a1 = Math.atan2(cy + d1[1] * c / 2 - ky, cx + d1[0] * c / 2 - kx);
                const a2 = Math.atan2(cy + d2[1] * c / 2 - ky, cx + d2[0] * c / 2 - kx); let da = a2 - a1; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
                if (r > 1) g.arc(kx, ky, r, a1, a1 + da, da < 0);
              } else if (ends.length === 1) { // the start or the rake's square: from the edge to the middle
                const [dx, dy] = ends[0], nx = -dy, ny = dx; g.moveTo(cx + dx * c / 2 + nx * (o + off), cy + dy * c / 2 + ny * (o + off)); g.lineTo(cx + nx * (o + off) - dx * c * .12, cy + ny * (o + off) - dy * c * .12);
              }
              g.stroke();
            });
          }
        });
        // the start: a small stone circle
        const s0 = P[0]; g.strokeStyle = 'rgba(90,70,40,.8)'; g.lineWidth = 6; g.beginPath(); g.arc((s0[0] + .5) * c, (s0[1] + .5) * c, c * .14, 0, Math.PI * 2); g.stroke();
        bd.tex.update();
      }
      function build(k) {
        if (bd) bd.nodes.forEach(n => { try { n.dispose(); } catch (e) {} });
        const rows = LV[k].rows, n = rows.length, C = W / n, cells = rows.map(r => r.split(''));
        let sx = 0, sy = 0, total = 0; cells.forEach((r, y) => r.forEach((ch, x) => { if (ch === 'S') { sx = x; sy = y; } if (ch !== '#') total++; }));
        bd = { k, n, C, cells, path: [[sx, sy]], total, nodes: [], undos: 0, steps: 0 };
        bd.tex = new B.DynamicTexture('rkSandTex', { width: 1024, height: 1024 }, scene, true);
        const sm = new B.StandardMaterial('rkSandMat_' + k, scene); sm.diffuseTexture = bd.tex; sm.specularColor = new B.Color3(.04, .04, .04); sm.emissiveColor = new B.Color3(.16, .14, .1);
        bd.nodes.push({ dispose() { sm.diffuseTexture?.dispose(); sm.dispose(); } });
        const sand = keep(B.MeshBuilder.CreateGround('rkSand', { width: W, height: W }, scene)); sand.material = sm; sand.position.set(AT[0], .06, AT[1]); sand.isPickable = true; sand.metadata = { rkSand: true };
        for (const s of [-1, 1]) for (const ax of [0, 1]) { const b = keep(B.MeshBuilder.CreateBox('rkRim', { width: ax ? .18 : W + .36, height: .14, depth: ax ? W + .36 : .18 }, scene)); b.material = M.rim; b.position.set(AT[0] + (ax ? s * (W / 2 + .09) : 0), .07, AT[1] + (ax ? 0 : s * (W / 2 + .09))); b.isPickable = false; }
        cells.forEach((r, y) => r.forEach((ch, x) => { if (ch !== '#') return; const p = posOf(x, y);
          const rk = keep(B.MeshBuilder.CreatePolyhedron('rkRock', { type: 3, size: C * .28 }, scene)); rk.material = M.rock; rk.position.set(p.x, C * .16, p.z); rk.scaling.set(1.1, .62, .9); rk.rotation.set(x * .9, y * 1.7, .3); rk.isPickable = false;
          const ms = keep(B.MeshBuilder.CreateSphere('rkMoss', { diameter: C * .34, segments: 6 }, scene)); ms.material = M.moss; ms.position.set(p.x + C * .08, C * .3, p.z - C * .05); ms.scaling.y = .35; ms.isPickable = false; }));
        // the rake (Oct 17, Miguel: "make the rake look better"): a zen-garden rake, a capped wooden head with eight tapered
        // pegs, a bamboo handle with its nodes, two braces and a rope lashing at the joint
        const rake = new B.TransformNode('rkRake', scene); keep(rake); bd.rake = rake;
        const RW = C * .78, part = (m, mt, x, y, z, rx = 0, rz = 0, par = rake) => { m.material = mt; m.parent = par; m.position.set(x, y, z); m.rotation.set(rx, 0, rz); m.isPickable = false; ctx.add(m); return m; };
        part(B.MeshBuilder.CreateBox('rkHead', { width: RW, height: .07, depth: .085 }, scene), M.wood, 0, 0, 0);
        part(B.MeshBuilder.CreateBox('rkHeadCap', { width: RW * .97, height: .022, depth: .06 }, scene), M.rim, 0, .046, 0);
        for (let t = 0; t < 8; t++) part(B.MeshBuilder.CreateCylinder('rkTooth', { height: .15, diameterTop: .032, diameterBottom: .012, tessellation: 6 }, scene), M.wood, (t - 3.5) * RW / 8, -.105, 0);
        const shaft = new B.TransformNode('rkShaft', scene); shaft.parent = rake; shaft.position.set(0, .03, -.02); shaft.rotation.x = -1.05; ctx.add(shaft); // leaning up and back
        part(B.MeshBuilder.CreateCylinder('rkPole', { height: 1.9, diameter: .055, tessellation: 10 }, scene), M.bamboo, 0, .95, 0, 0, 0, shaft);
        for (let k = 1; k <= 4; k++) part(B.MeshBuilder.CreateTorus('rkNode', { diameter: .062, thickness: .014, tessellation: 12 }, scene), M.node, 0, k * .4, 0, 0, 0, shaft);
        part(B.MeshBuilder.CreateTorus('rkRope', { diameter: .09, thickness: .024, tessellation: 14 }, scene), M.rope, 0, .12, 0, 0, 0, shaft);
        for (const sd of [-1, 1]) part(B.MeshBuilder.CreateCylinder('rkBrace', { height: .46, diameter: .022, tessellation: 6 }, scene), M.bamboo, sd * RW * .2, .17, -.13, -.95, sd * .72);
        const p0 = posOf(sx, sy); rake.position.set(p0.x, .2, p0.z); bd.rakeYaw = 0;
        paint(); info(); st.stuckShown = false;
      }
      const raked = (x, y) => bd.path.some(p => p[0] === x && p[1] === y);
      const free = (x, y) => x >= 0 && y >= 0 && x < bd.n && y < bd.n && bd.cells[y][x] !== '#' && !raked(x, y);
      const info = () => H.info(bd ? `Level ${bd.k + 1} / ${LV.length} · raked ${bd.path.length} / ${bd.total}` : 'Pick a level');
      function step(dx, dy) {
        if (st.phase !== 'play') return false;
        const [hx, hy] = bd.path[bd.path.length - 1], nx = hx + dx, ny = hy + dy, prev = bd.path[bd.path.length - 2];
        if (prev && prev[0] === nx && prev[1] === ny) return undo();
        if (!free(nx, ny)) { ctx.sound('thock'); return false; }
        bd.path.push([nx, ny]); bd.steps++; bd.rakeYaw = Math.atan2(dx, -dy); ctx.note(392 + (bd.path.length % 8) * 33, 'bell');
        paint(); info();
        if (bd.path.length === bd.total) { st.phase = 'solved'; st.wait = 1.8; ctx.sound('gamewin'); H.msg('The garden is raked!', 1500);
          if (bd.k + 1 > solvedUpTo) { solvedUpTo = bd.k + 1; try { localStorage.setItem(KEY, String(solvedUpTo)); } catch (e) {} } }
        else if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => free(nx + a, ny + b))) { H.msg('No way on: step back (U) or start again (R)', 1800); st.stuckShown = true; }
        return true;
      }
      function undo() { if (st.phase !== 'play' || bd.path.length < 2) return false; bd.path.pop(); bd.undos++; const a = bd.path[bd.path.length - 1], b = bd.path[bd.path.length - 2]; if (b) bd.rakeYaw = Math.atan2(a[0] - b[0], -(a[1] - b[1])); ctx.note(262, 'bell'); paint(); info(); return true; }
      // R and Restart beside Quit: the level as it was picked (smooth sand, the rake at the start, no steps back)
      function restart() { if (st.phase !== 'play' || !bd) return; build(bd.k); H.msg('Smooth sand again', 700); }
      // the picker
      const hud = document.getElementById('gameHud'), pick = document.createElement('div');
      pick.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(' + (LV.length > 6 && innerWidth >= 600 ? 560 : 380) + 'px,92vw);background:rgba(30,22,12,.94);border:1px solid rgba(216,179,92,.7);border-radius:14px;padding:16px;text-align:center;pointer-events:auto;font:15px/1.4 Georgia,serif;color:#eee';
      pick.innerHTML = `<div style="font:700 13px/1.2 Georgia,serif;letter-spacing:.14em;text-transform:uppercase;color:#d8b35c;margin-bottom:10px">The Raking Path</div><div style="margin-bottom:12px;color:#bbb">Rake every square of sand in one unbroken line. Never cross your own line; never touch a rock.</div>`
        + `<div style="display:grid;grid-template-columns:repeat(${LV.length > 6 && innerWidth >= 600 ? 5 : 2},1fr);gap:8px">${LV.map((L, k) => { const open = k <= solvedUpTo, done = k < solvedUpTo, n = L.rows.length; return `<button type="button" data-k="${k}" ${open ? '' : 'disabled'} style="padding:10px 4px;border-radius:9px;border:1px solid ${open ? '#d8b35c' : '#444'};background:${done ? 'rgba(216,179,92,.22)' : 'rgba(255,255,255,.04)'};color:${open ? '#fff' : '#666'};font:700 15px Georgia,serif;cursor:${open ? 'pointer' : 'default'}">${open ? `Level ${k + 1}<div style="font:12px Georgia,serif;color:#c9b88a">${n} × ${n}</div>` : '🔒'}${done ? ' ✓' : ''}</button>`; }).join('')}</div>`;
      pick.querySelectorAll('button[data-k]').forEach(b => b.onclick = (e) => { e.stopPropagation(); b.blur(); choose(+b.dataset.k); });
      function choose(k) { if (st.phase !== 'pick' || k > solvedUpTo || k >= LV.length) return; pick.remove(); st.phase = 'play'; build(k); const w = LV[k].ways ?? WAYS[k]; H.msg(`Level ${k + 1}`, 900, k >= 2 && w ? (w === 1 ? 'only one way through' : `only ${w} ways through`) : ''); }
      hud.appendChild(pick);
      const P0 = def.player || [AT[0] - W / 2 - 1.5, AT[1] - 1.5, Math.PI / 2]; ctx.player.place(P0[0], P0[1], P0[2]);
      const cam = def.cam || [AT[0], 7.6, AT[1] - W * .62 - 2.4], look = def.look || [AT[0], 0, AT[1] + .1];
      ctx.look(cam, look, def.fov || .85);
      H.title(def.title || 'The Raking Path'); H.score(''); info();
      H.hint('Move the rake with the arrows / <kbd>WASD</kbd> or click the next square. <kbd>U</kbd> steps back, <kbd>R</kbd> starts again.');
      return {
        update(dt) {
          ctx.look(cam, look);
          if (bd && bd.rake) { const [hx, hy] = bd.path[bd.path.length - 1], p = posOf(hx, hy), r = bd.rake; r.position.x += (p.x - r.position.x) * Math.min(1, dt * 12); r.position.z += (p.z - r.position.z) * Math.min(1, dt * 12);
            let d = bd.rakeYaw - r.rotation.y; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; r.rotation.y += d * Math.min(1, dt * 10); }
          if (st.phase === 'solved' && (st.wait -= dt) <= 0) {
            st.phase = 'done'; H.hint('');
            const k = bd.k, score = SCORE[k] ?? 30 * (k + 1);
            ctx.finish({ score, label: 'points', solved: true, passed: score >= (def.pass || 0), extra: `Level ${k + 1} raked in one line (${bd.undos} step${bd.undos === 1 ? '' : 's'} back).${k + 1 < LV.length ? ` Level ${k + 2} is open.` : ' Every garden raked.'}` });
          }
        },
        key(e, down) {
          if (!down || e.repeat) return; const k = e.key.toLowerCase();
          if (st.phase === 'pick') { const n = k === '0' ? 10 : parseInt(k, 10); if (n >= 1 && n <= LV.length) choose(n - 1); return; } // 1-9, 0 = the tenth
          if (st.phase !== 'play') return;
          const dir = { arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right' }[k];
          if (dir) step(...D[dir]); else if (k === 'u' || k === 'backspace') undo(); else if (k === 'r') restart();
        },
        pointer(evt) {
          if (evt.type !== B.PointerEventTypes.POINTERDOWN || st.phase !== 'play') return;
          const hit = scene.pickWithRay(ctx.ray(), m => !!m.metadata?.rkSand); if (!hit?.hit) return;
          const p = ctx.toLocal(hit.pickedPoint), x = Math.round((p.x - AT[0]) / bd.C + (bd.n - 1) / 2), y = Math.round((bd.n - 1) / 2 - (p.z - AT[1]) / bd.C);
          const [hx, hy] = bd.path[bd.path.length - 1]; if (Math.abs(x - hx) + Math.abs(y - hy) === 1) step(x - hx, y - hy);
        },
        restart,
        _test: { st, choose, step, undo, restart, posOf: (x, y) => posOf(x, y), get bd() { return bd; } },
        dispose() { pick.remove(); if (bd) bd.nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); }
      };
    }
  };
  window.RebelGames.register('rake', G);
})();
