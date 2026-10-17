// The Watchman's Lanterns (Oct 15, Ronin): light the dark courtyard. Put paper lanterns on the open squares until
// every square is lit. A lantern lights its row and column until a wall stops it; no lantern may shine on another;
// a numbered wall has exactly that many lanterns right beside it (above, below, left, right). Click a square to set a
// lantern (or, in mark mode, a dot for "no lantern here"); U undoes, H fixes one square (no clean bonus then).
// Ten courtyards from 5 x 5 to 12 x 12, each with one answer (checked by a solver). Score: the courtyard x 20, +10
// without a hint.
// Oct 17: How to play (the rules + a solved 5 x 5, howto/akari.png) and Restart (the courtyard as picked, all clear).
// Oct 17 (Miguel: "make it 10 courtyards"): 8-10 are 11 x 11, 12 x 12, 12 x 12, made by make() of scratchpad
// akari/gen.mjs (symmetric walls, numbers stripped while the answer stays unique; one answer by countSol, run to 3) and
// chosen by a logic grader (scratchpad lv/akari/grade.mjs: the plain rules, then one-square "what ifs"): they need
// 11, 22 and 27 of those (courtyards 1-7: 0-4). The picker takes 5 columns on wide screens; the camera aims a little
// nearer (a 12 x 12's bottom row sat under the hint line).
// def: { levels: [{ g: 'grid row by row: . open, # wall, 0-4 numbered wall', sol: [lantern squares] }], pass, points }
(function () {
  const LEVELS = [
    { g: '##...##..3.....0..##...##', sol: [4, 8, 14, 17, 21] },
    { g: '.#..#.2..........#0..........#.#..3.', sol: [0, 5, 7, 14, 23, 28, 30, 33, 35] },
    { g: '1..0#..#.......#..0..#.....#..#..4.......#..1#..#', sol: [1, 13, 14, 16, 26, 28, 32, 34, 40, 43] },
    { g: '..........21....3..#..##.#2..2..#....#1..........', sol: [0, 9, 12, 15, 17, 27, 30, 33, 36, 39, 44] },
    { g: '#.....#....0...#0..#..3.##....#..2....##.#..1..##...#....#.....2', sol: [4, 7, 9, 14, 21, 23, 32, 34, 43, 49, 55, 56, 62] },
    { g: '.....3..1###.#.#.......#.....2...#...##...11...#...#.....3.......#.#.2##2..#.....', sol: [4, 6, 14, 17, 20, 25, 28, 31, 41, 48, 52, 56, 60, 63, 66, 73, 78] },
    { g: '#.....##...3.#...3.#1...#....1.....#..#....3...1....#...0....1..0.....#....#...##.1...2.#...00.....#', sol: [1, 9, 10, 12, 16, 18, 27, 33, 39, 41, 44, 48, 50, 53, 62, 67, 76, 81, 84, 89, 90, 96] },
    { g: '1#1....1......#1....0..#......#......1...2......##..1..#..2...#..0..2..#0......#...#......#......1..2....2#......1....###', sol: [3, 8, 11, 16, 28, 32, 36, 40, 42, 57, 60, 63, 69, 81, 87, 89, 95, 99, 104, 108, 112, 116] },
    { g: '..00...#...1##...1...2..#....##.....#.....2.#.0.....0.#.#..............11..............1.#.#.....2.0.#.....#.....#1....#..2...2...2##...1...##..', sol: [0, 6, 10, 16, 20, 27, 33, 41, 43, 59, 60, 85, 88, 95, 96, 102, 110, 118, 121, 125, 128, 135, 138, 142] },
    { g: '......1.#.#.#..0...##.#....#..#......2...##........#.......1.....#..02....21..#.....#.......2........##...#......2..2....1.02...#..1.#.1.#......', sol: [0, 7, 17, 25, 32, 36, 39, 47, 57, 62, 66, 70, 73, 76, 83, 91, 99, 104, 110, 114, 117, 120, 125, 130, 136, 140] }
  ];
  const G = {
    title: "The Watchman's Lanterns",
    howTo: { lines: [
      'Light every open square of the courtyard by setting paper lanterns on it.',
      'A lantern lights its whole row and column, until a wall stops the light.',
      'No lantern may shine on another: two lanterns in one row or column need a wall between them.',
      'A number on a wall is how many lanterns stand right beside it (above, below, left, right). A 0 means none.',
      'Click a square for a lantern, again to take it away. Tab (or the button) switches to dots for "no lantern here". U undoes, H fixes one square.',
      'Tip: start at the numbers. A 4, a 0, or a 3 against the edge settles its neighbours at once.'],
      img: 'howto/akari.png', caption: 'A solved 5 x 5 courtyard: every square lit, no lantern sees another, each number has its count.' },
    start(ctx) {
      const B = ctx.B, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const LV = def.levels || LEVELS, KEY = 'rebelAntsLanternsProgress:' + (def.id || 'akari');
      let solvedUpTo = 0; try { solvedUpTo = Math.max(0, Math.min(LV.length, Number(localStorage.getItem(KEY)) || 0)); } catch (e) {}
      const mat = (k, c, em) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(.05, .05, .05); if (em) m.emissiveColor = new B.Color3(...em); return m; });
      const slabM = mat('slab', [.2, .19, .2], [.04, .035, .04]), paperM = mat('paper', [1, .62, .3], [.95, .45, .15]), capM = mat('cap', [.12, .08, .06], [.03, .02, .01]);
      const nodes = [], keep = n => { n.parent = n.parent || ctx.frame; ctx.add(n); nodes.push(n); if (n.isPickable !== undefined) n.isPickable = false; return n; };
      const TEX = 1024, tex = new B.DynamicTexture('akTex', { width: TEX, height: TEX }, scene, true); tex.hasAlpha = false;
      const boardM = new B.StandardMaterial('akBoardMat', scene); boardM.diffuseTexture = tex; boardM.emissiveTexture = tex; boardM.emissiveColor = new B.Color3(.7, .7, .7); boardM.diffuseColor = new B.Color3(.5, .5, .5); boardM.specularColor = new B.Color3(0, 0, 0);
      const S = 4.2, TY = .3;
      { const slab = keep(B.MeshBuilder.CreateBox('akSlab', { width: S + .6, height: TY, depth: S + .6 }, scene)); slab.material = slabM; slab.position.y = TY / 2; }
      const board = keep(B.MeshBuilder.CreateGround('akBoard', { width: S, height: S }, scene)); board.material = boardM; board.position.y = TY + .005; board.isPickable = true; board.metadata = { akBoard: true };
      // the lantern: a paper body between two dark caps (instanced on every lantern square)
      const lantSrc = keep(new B.TransformNode('akLanternSrc', scene));
      const parts = [B.MeshBuilder.CreateCylinder('akLanternBody', { height: .3, diameter: .24, tessellation: 12 }, scene), B.MeshBuilder.CreateCylinder('akLanternCap', { height: .04, diameter: .17, tessellation: 10 }, scene), B.MeshBuilder.CreateCylinder('akLanternCap', { height: .04, diameter: .17, tessellation: 10 }, scene)];
      parts[0].material = paperM; parts[0].position.y = .19; parts[1].material = capM; parts[1].position.y = .36; parts[2].material = capM; parts[2].position.y = .02;
      parts.forEach(p => { p.isVisible = false; p.isPickable = false; keep(p); });
      let bd = null; // { k, N, g[], cell, lamps: Set, marks: Set, inst: Map(i -> [instances]), hist[], hints, flash }
      const st = { phase: 'pick', t: 0, mode: 1 };
      const nb = i => { const N = bd.N, x = i % N, y = Math.floor(i / N), o = []; if (x > 0) o.push(i - 1); if (x < N - 1) o.push(i + 1); if (y > 0) o.push(i - N); if (y < N - 1) o.push(i + N); return o; };
      function sees(i) { const N = bd.N, x = i % N, y = Math.floor(i / N), s = []; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { let cx = x + dx, cy = y + dy; while (cx >= 0 && cy >= 0 && cx < N && cy < N && bd.g[cy * N + cx] === '.') { s.push(cy * N + cx); cx += dx; cy += dy; } } return s; }
      function build(k) {
        if (bd) bd.inst.forEach(a => a.forEach(m => m.dispose()));
        const L = LV[k], N = Math.round(Math.sqrt(L.g.length));
        bd = { k, N, g: [...L.g], sol: new Set(L.sol), lamps: new Set(), marks: new Set(), inst: new Map(), hist: [], hints: 0, flash: null, seen: null };
        bd.seen = bd.g.map((c, i) => c === '.' ? sees(i) : null);
        ctx.player.place(0, cam[2] - 1.6, 0); draw(); info();
      }
      const cellPos = i => { const N = bd.N, c = S / N; return [-S / 2 + (i % N + .5) * c, S / 2 - (Math.floor(i / N) + .5) * c]; };
      const info = () => H.info(bd ? `Courtyard ${bd.k + 1} / ${LV.length} · ${bd.N} × ${bd.N} · lanterns ${bd.lamps.size} · ${st.mode === 1 ? 'lanterns' : 'marks'}${bd.hints ? ` · hints ${bd.hints}` : ''}` : 'Pick a courtyard');
      function state() { const lit = new Set(), clash = new Set(); bd.lamps.forEach(i => { lit.add(i); bd.seen[i].forEach(j => { lit.add(j); if (bd.lamps.has(j)) { clash.add(i); clash.add(j); } }); });
        const nums = new Map(); bd.g.forEach((c, i) => { if (/[0-4]/.test(c)) { const n = nb(i).filter(j => bd.lamps.has(j)).length; nums.set(i, n === +c ? 'ok' : n > +c ? 'over' : 'under'); } });
        return { lit, clash, nums }; }
      function draw() {
        const g = tex.getContext(), N = bd.N, C = TEX / N, s = state(), won = st.phase === 'won' || st.phase === 'done';
        for (let i = 0; i < N * N; i++) { const x = (i % N) * C, y = Math.floor(i / N) * C, c = bd.g[i];
          if (c === '.') { g.fillStyle = s.lit.has(i) ? (won ? '#ffd27a' : '#f0c06a') : '#2b2f3a'; g.fillRect(x, y, C, C);
            if (s.lit.has(i)) { const gr = g.createRadialGradient(x + C / 2, y + C / 2, 2, x + C / 2, y + C / 2, C * .7); gr.addColorStop(0, 'rgba(255,240,200,.35)'); gr.addColorStop(1, 'rgba(255,240,200,0)'); g.fillStyle = gr; g.fillRect(x, y, C, C); }
            if (bd.marks.has(i) && !bd.lamps.has(i)) { g.fillStyle = s.lit.has(i) ? '#8a6a3a' : '#9aa4b8'; g.beginPath(); g.arc(x + C / 2, y + C / 2, C * .08, 0, Math.PI * 2); g.fill(); }
            if (s.clash.has(i)) { g.fillStyle = 'rgba(220,30,30,.55)'; g.fillRect(x, y, C, C); }
            if (bd.flash && bd.flash.i === i) { g.fillStyle = bd.flash.good ? 'rgba(80,200,110,.55)' : 'rgba(230,40,40,.6)'; g.fillRect(x, y, C, C); } }
          else { g.fillStyle = '#0d0d10'; g.fillRect(x, y, C, C); g.fillStyle = '#1c1c22'; g.fillRect(x + 4, y + 4, C - 8, C - 8);
            if (/[0-4]/.test(c)) { const v = s.nums.get(i); g.fillStyle = v === 'ok' ? '#6c6c78' : v === 'over' ? '#ff5a4a' : '#f2f2f2'; g.font = `bold ${Math.round(C * .55)}px Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(c, x + C / 2, y + C * .54); } } }
        g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 3; g.beginPath(); for (let k = 0; k <= N; k++) { g.moveTo(k * C, 0); g.lineTo(k * C, TEX); g.moveTo(0, k * C); g.lineTo(TEX, k * C); } g.stroke();
        tex.update();
        // lanterns on their squares
        bd.inst.forEach((a, i) => { if (!bd.lamps.has(i)) { a.forEach(m => m.dispose()); bd.inst.delete(i); } });
        const sc = Math.min(1.3, 4.2 / N * 1.25);
        bd.lamps.forEach(i => { if (bd.inst.has(i)) return; const [x, z] = cellPos(i), a = parts.map(p => { const m = p.createInstance('akLantern'); m.parent = ctx.frame; ctx.add(m); m.position.set(x, TY + p.position.y * sc, z); m.scaling.setAll(sc); m.isPickable = false; return m; }); bd.inst.set(i, a); });
      }
      function check() { const s = state(); if (s.clash.size) return; for (const [, v] of s.nums) if (v !== 'ok') return; for (let i = 0; i < bd.g.length; i++) if (bd.g[i] === '.' && !s.lit.has(i)) return;
        st.phase = 'won'; st.wt = 0; draw(); pads.style.display = 'none'; ctx.sound('gamewin'); H.msg('The courtyard is lit', 1600);
        if (bd.k + 1 > solvedUpTo) { solvedUpTo = bd.k + 1; try { localStorage.setItem(KEY, String(solvedUpTo)); } catch (e) {} } }
      function set(i, what) { // what: 'lamp' | 'mark' | 'none'
        if (st.phase !== 'play' || bd.g[i] !== '.') return false; const before = bd.lamps.has(i) ? 'lamp' : bd.marks.has(i) ? 'mark' : 'none'; if (before === what) return false;
        bd.hist.push({ i, before }); bd.lamps.delete(i); bd.marks.delete(i); if (what === 'lamp') bd.lamps.add(i); if (what === 'mark') bd.marks.add(i);
        ctx.note(what === 'lamp' ? 660 : 420, 'lantern'); draw(); info(); check(); return true;
      }
      function tap(i) { if (st.phase !== 'play' || bd.g[i] !== '.') return; const cur = bd.lamps.has(i) ? 'lamp' : bd.marks.has(i) ? 'mark' : 'none'; const want = st.mode === 1 ? 'lamp' : 'mark'; set(i, cur === want ? 'none' : want); }
      function undo() { if (st.phase !== 'play' || !bd?.hist.length) return; const h = bd.hist.pop(); bd.lamps.delete(h.i); bd.marks.delete(h.i); if (h.before === 'lamp') bd.lamps.add(h.i); if (h.before === 'mark') bd.marks.add(h.i); draw(); info(); }
      function hint() {
        if (st.phase !== 'play') return; bd.hints++; info();
        const wrong = [...bd.lamps].find(i => !bd.sol.has(i)); if (wrong != null) { bd.flash = { i: wrong, t: 0, good: false }; set(wrong, 'mark'); H.msg('No lantern there', 1200); return; }
        const miss = [...bd.sol].find(i => !bd.lamps.has(i)); if (miss == null) return; bd.flash = { i: miss, t: 0, good: true }; set(miss, 'lamp'); H.msg('A lantern here', 1100);
      }
      const hud = document.getElementById('gameHud');
      const pick = document.createElement('div');
      pick.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(' + (LV.length > 6 && innerWidth >= 600 ? 560 : 400) + 'px,90vw);background:rgba(14,8,10,.95);border:1px solid rgba(230,110,90,.6);border-radius:14px;padding:16px;text-align:center;pointer-events:auto;font:15px/1.4 system-ui,sans-serif;color:#eee';
      const drawPick = () => { pick.innerHTML = `<div style="font:800 13px/1.2 system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#f29a86;margin-bottom:10px">The Watchman's Lanterns</div><div style="margin-bottom:12px;color:#bbb">Light every square. No lantern may shine on another; a number counts the lanterns beside its wall.</div>`
        + `<div style="display:grid;grid-template-columns:repeat(${LV.length > 6 && innerWidth >= 600 ? 5 : 4},1fr);gap:8px">${LV.map((L, k) => { const open = k <= solvedUpTo, ok = k < solvedUpTo, n = Math.round(Math.sqrt(L.g.length)); return `<button type="button" data-k="${k}" ${open ? '' : 'disabled'} style="padding:8px 2px;border-radius:9px;border:1px solid ${open ? '#f29a86' : '#444'};background:${ok ? 'rgba(242,154,134,.22)' : 'rgba(255,255,255,.04)'};color:${open ? '#fff' : '#666'};font:700 15px system-ui,sans-serif;cursor:${open ? 'pointer' : 'default'}">${open ? `${k + 1}<div style="font:11px system-ui;opacity:.75">${n}×${n}</div>` : '🔒'}${ok ? ' ✓' : ''}</button>`; }).join('')}</div>`;
        pick.querySelectorAll('button[data-k]').forEach(b => b.onclick = (e) => { e.stopPropagation(); b.blur(); choose(+b.dataset.k); }); };
      const pads = document.createElement('div');
      pads.style.cssText = 'position:absolute;bottom:62px;right:14px;display:none;gap:6px;pointer-events:auto';
      const padBtn = (t, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.style.cssText = 'min-width:52px;height:40px;padding:0 10px;border-radius:9px;border:1px solid #d77a66;background:rgba(20,10,10,.88);color:#ffe9e2;font:700 15px system-ui;cursor:pointer'; b.onclick = (e) => { e.stopPropagation(); b.blur(); fn(); }; pads.appendChild(b); return b; };
      const modeBtn = padBtn('🏮 Lantern', () => toggleMode()); padBtn('↶ Undo', undo); padBtn('Hint', hint);
      function toggleMode() { st.mode = st.mode === 1 ? 2 : 1; modeBtn.textContent = st.mode === 1 ? '🏮 Lantern' : '• Mark'; info(); }
      function choose(k) { if (st.phase !== 'pick' || k > solvedUpTo || k >= LV.length) return; pick.remove(); st.phase = 'play'; build(k); pads.style.display = 'flex'; H.msg(`Courtyard ${k + 1}`, 900); }
      hud.append(pick, pads); drawPick();
      const cam = [0, TY + 5.2, -3.9], at = [0, TY, -.25]; // (Oct 17: aimed nearer, so a 12 x 12's bottom row clears the hint line)
      ctx.player.place(0, cam[2] - 1.6, 0); ctx.look(cam, at, def.fov || .8); // the player waits behind the camera, out of the picture
      { const g = tex.getContext(); g.fillStyle = '#2b2f3a'; g.fillRect(0, 0, TEX, TEX); tex.update(); }
      H.title(def.title || "The Watchman's Lanterns"); H.score(''); info();
      H.hint('Click a square for a lantern (again to take it away). <kbd>Tab</kbd> or the button switches to dots for "no lantern". <kbd>U</kbd> undo, <kbd>H</kbd> hint.');
      return {
        update(dt) {
          ctx.look(cam, at); st.t += dt; if (!bd) return;
          if (bd.flash && (bd.flash.t += dt) > 1.1) { bd.flash = null; draw(); }
          if (st.phase === 'won' && (st.wt += dt) > 1.8) { st.phase = 'done'; H.hint(''); const k = bd.k;
            ctx.finish({ score: (k + 1) * 20 + (bd.hints ? 0 : 10), label: 'points', solved: true, extra: `Courtyard ${k + 1} (${bd.N} × ${bd.N}) lit with ${bd.lamps.size} lanterns${bd.hints ? `, ${bd.hints} hint${bd.hints > 1 ? 's' : ''}` : ''}.${k + 1 < LV.length ? ` Courtyard ${k + 2} is open.` : ' Every courtyard lit.'}` }); }
        },
        key(e, down) {
          if (!down || e.repeat) return; const k = e.key.toLowerCase();
          if (st.phase === 'pick') { const n = k === '0' ? 10 : parseInt(k, 10); if (n >= 1 && n <= LV.length) choose(n - 1); return; } // 1-9, 0 = the tenth
          if (k === 'u' || k === 'z' || k === 'backspace') undo(); else if (k === 'h') hint(); else if (k === 'tab' || k === 'm') { e.preventDefault?.(); toggleMode(); }
        },
        pointer(evt) {
          if (evt.type !== B.PointerEventTypes.POINTERDOWN || st.phase !== 'play' || !bd) return;
          const hit = scene.pickWithRay(ctx.ray(), m => m.metadata?.akBoard); if (!hit?.pickedPoint) return;
          const l = ctx.toLocal(hit.pickedPoint), N = bd.N, c = Math.floor((l.x + S / 2) / S * N), r = Math.floor((S / 2 - l.z) / S * N);
          if (c >= 0 && c < N && r >= 0 && r < N) tap(r * N + c);
        },
        // Restart: the same courtyard as it was picked (no lanterns, marks, undo or hints); only while it is being played
        restart() { if (st.phase !== 'play' || !bd) return; build(bd.k); H.msg('Start again', 900); },
        _test: { st, choose, set, tap, undo, hint, toggleMode, state, get bd() { return bd; }, LV },
        dispose() { pick.remove(); pads.remove(); if (bd) bd.inst.forEach(a => a.forEach(m => { try { m.dispose(); } catch (e) {} })); nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); try { boardM.dispose(); tex.dispose(); } catch (e) {} }
      };
    }
  };
  window.RebelGames.register('akari', G);
})();
