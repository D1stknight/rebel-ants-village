// The War Banner (Oct 15, Warrior): paint the banner from its numbers. The numbers beside a row (or over a column)
// are the runs of inked squares in it, in order, with at least one bare square between runs. Click (or drag) to ink,
// switch to marks (X) to note the squares that stay bare; a row's numbers grey out when the row matches them. U undoes,
// H fixes one square (no clean bonus then). Eight banners, 5 x 5 to 13 x 13, the big ones are the clans' emblems;
// each has one answer that the numbers alone lead to (checked by a solver). Score: the banner x 20, +10 without a hint.
// def: { levels: [{ name, rows: ['#..#', ...] }], pass, points }
(function () {
  const LEVELS = [
    { name: 'Arrowhead', rows: ['..#..', '.###.', '#####', '..#..', '..#..'] },
    { name: 'Kabuto', rows: ['#......#', '##....##', '.##..##.', '..####..', '.######.', '########', '#.####.#', '#......#'] },
    { name: 'The Gate', rows: ['##########', '.########.', '..#....#..', '##########', '..#....#..', '..#....#..', '..#....#..', '..#....#..', '.###..###.', '.###..###.'] },
    { name: 'The Cracked Circle', rows: ['...####...', '.###..###.', '.#..#...#.', '#...##...#', '#....#...#', '#...##...#', '#...#....#', '.#..##..#.', '.###.####.', '...####...'] },
    { name: "The Shogun's Crown", rows: ['....#....', '....#....', '##.###.##', '##.###.##', '.#######.', '.#######.', '..#####..', '.#######.', '.#######.', '.#######.', '.#######.', '.#######.', '..#####..'] },
    { name: 'The Sprout', rows: ['.....#.....', '....###....', '....###....', '....###....', '....###....', '.##..#.###.', '.#########.', '...#####...', '.....#.....', '###########', '.#########.', '..#######..', '...#####...'] },
    { name: 'The Spiral', rows: ['...#######...', '..##..#..##..', '.#..#####..#.', '#...###....##', '#...###..#..#', '#.#.##.####.#', '#.#.##.####.#', '#.#########.#', '#.#####..##.#', '##.####.##.##', '.#.....##..#.', '..##.....##..', '...#######...'] },
    { name: 'The Blade in the Circle', rows: ['...#######...', '..##.....##..', '.##...###.##.', '##...###...##', '#...###....##', '#...###.....#', '#...###.....#', '#...####....#', '##.#######.##', '##...##....##', '.##..##...##.', '..#########..', '...#######...'] }
  ];
  const runs = line => { const out = []; let k = 0; for (const v of line) { if (v === 1) k++; else if (k) { out.push(k); k = 0; } } if (k) out.push(k); return out; };
  const G = {
    title: 'The War Banner',
    start(ctx) {
      const B = ctx.B, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const LV = def.levels || LEVELS, KEY = 'rebelAntsBannerProgress:' + (def.id || 'nonogram');
      let solvedUpTo = 0; try { solvedUpTo = Math.max(0, Math.min(LV.length, Number(localStorage.getItem(KEY)) || 0)); } catch (e) {}
      const mat = (k, c, em) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(.05, .05, .05); if (em) m.emissiveColor = new B.Color3(...em); return m; });
      const woodM = mat('post', [.36, .22, .12], [.08, .05, .03]), ropeM = mat('rope', [.78, .66, .4], [.2, .16, .08]);
      const nodes = [], keep = n => { n.parent = n.parent || ctx.frame; ctx.add(n); nodes.push(n); if (n.isPickable !== undefined) n.isPickable = false; return n; };
      const TEX = 1024, tex = new B.DynamicTexture('nonoTex', { width: TEX, height: TEX }, scene, true); tex.hasAlpha = false;
      const clothM = new B.StandardMaterial('nonoClothMat', scene); clothM.diffuseTexture = tex; clothM.emissiveTexture = tex; clothM.emissiveColor = new B.Color3(.5, .5, .5); clothM.diffuseColor = new B.Color3(.62, .62, .62); clothM.specularColor = new B.Color3(0, 0, 0); clothM.backFaceCulling = false;
      // the banner: a cloth square between two posts, hung from a crossbar
      const W = 3.8, CY = 2.75;
      const cloth = keep(B.MeshBuilder.CreatePlane('nonoCloth', { size: W }, scene)); cloth.material = clothM; cloth.position.set(0, CY, 0); cloth.isPickable = true; cloth.metadata = { nonoCloth: true };
      for (const s of [-1, 1]) { const p = keep(B.MeshBuilder.CreateCylinder('nonoPost', { height: CY + W / 2 + .5, diameter: .2, tessellation: 10 }, scene)); p.material = woodM; p.position.set(s * (W / 2 + .2), (CY + W / 2 + .5) / 2, .05); }
      { const bar = keep(B.MeshBuilder.CreateCylinder('nonoBar', { height: W + .9, diameter: .16, tessellation: 10 }, scene)); bar.material = woodM; bar.rotation.z = Math.PI / 2; bar.position.set(0, CY + W / 2 + .12, .02);
        const tie = keep(B.MeshBuilder.CreateBox('nonoTie', { width: W + .1, height: .06, depth: .06 }, scene)); tie.material = ropeM; tie.position.set(0, CY + W / 2 + .02, -.02); }
      let bd = null; // { k, R, C, sol[], cells[] (0 bare, 1 ink, 2 mark), rowC[], colC[], hist[], hints, cur: [r, c], mode, time, won }
      const st = { phase: 'pick', t: 0, drag: null, wt: 0 };
      let geo = null; // drawing geometry of the current banner
      function build(k) {
        const L = LV[k], R = L.rows.length, C = L.rows[0].length, sol = L.rows.map(r => [...r].map(ch => ch === '#' ? 1 : 0));
        bd = { k, R, C, sol, cells: sol.map(r => r.map(() => 0)), rowC: sol.map(runs), colC: [...Array(C).keys()].map(c => runs(sol.map(r => r[c]))), hist: [], hints: 0, cur: [0, 0], mode: 1, time: 0, flash: null };
        const ka = Math.max(...bd.rowC.map(x => Math.max(1, x.length))), kb = Math.max(...bd.colC.map(x => Math.max(1, x.length))), M = 34;
        const cs = Math.floor((TEX - 2 * M) / Math.max(C + ka * .62, R + kb * .66)), left = Math.round((TEX - (C + ka * .62) * cs) / 2 + ka * .62 * cs), top = Math.round((TEX - (R + kb * .66) * cs) / 2 + kb * .66 * cs);
        geo = { cs, left, top }; ctx.player.place(W / 2 + 1.5, -.9, -Math.PI / 2 + .35); draw(); info();
      }
      const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
      const info = () => H.info(bd ? `Banner ${bd.k + 1} / ${LV.length} · ${LV[bd.k].name} · ${bd.C} × ${bd.R} · ${fmt(bd.time)} · ${bd.mode === 1 ? 'ink' : 'marks'}${bd.hints ? ` · hints ${bd.hints}` : ''}` : 'Pick a banner');
      const lineOk = (cells, clue) => { const r = runs(cells); return r.length === clue.length && r.every((v, i) => v === clue[i]); };
      function draw() {
        const g = tex.getContext(), { cs, left, top } = geo, won = st.phase === 'won' || st.phase === 'done';
        g.fillStyle = '#ece2c9'; g.fillRect(0, 0, TEX, TEX);
        g.fillStyle = 'rgba(120,90,50,.08)'; for (let i = 0; i < 90; i++) g.fillRect((i * 337) % TEX, (i * 613) % TEX, 3, 40); // a little weave
        // clues
        g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `bold ${Math.round(cs * .5)}px Georgia, serif`;
        bd.rowC.forEach((clue, r) => { const ok = lineOk(bd.cells[r].map(v => v === 1 ? 1 : 0), clue); g.fillStyle = ok ? '#a99f8a' : '#2a2016'; const cl = clue.length ? clue : [0];
          cl.forEach((n, i) => g.fillText(String(n), left - (cl.length - i - .5) * cs * .62, top + (r + .55) * cs)); if (bd.cur[0] === r && !won) { g.fillStyle = 'rgba(214,160,40,.25)'; g.fillRect(left - cl.length * cs * .62 - 6, top + r * cs, cl.length * cs * .62 + 4, cs); } });
        bd.colC.forEach((clue, c) => { const ok = lineOk(bd.cells.map(row => row[c] === 1 ? 1 : 0), clue); g.fillStyle = ok ? '#a99f8a' : '#2a2016'; const cl = clue.length ? clue : [0];
          cl.forEach((n, i) => g.fillText(String(n), left + (c + .5) * cs, top - (cl.length - i - .45) * cs * .66)); if (bd.cur[1] === c && !won) { g.fillStyle = 'rgba(214,160,40,.25)'; g.fillRect(left + c * cs, top - cl.length * cs * .66 - 6, cs, cl.length * cs * .66 + 4); } });
        // squares
        for (let r = 0; r < bd.R; r++) for (let c = 0; c < bd.C; c++) { const x = left + c * cs, y = top + r * cs, v = bd.cells[r][c];
          g.fillStyle = v === 1 ? (won ? '#34502e' : '#1f1a14') : '#f6efdd'; g.fillRect(x, y, cs, cs);
          if (v === 1 && won) { g.fillStyle = 'rgba(216,180,80,.35)'; g.fillRect(x + cs * .12, y + cs * .12, cs * .76, cs * .2); }
          if (v === 2 && !won) { g.strokeStyle = '#8a7c66'; g.lineWidth = Math.max(2, cs * .07); g.beginPath(); g.moveTo(x + cs * .3, y + cs * .3); g.lineTo(x + cs * .7, y + cs * .7); g.moveTo(x + cs * .7, y + cs * .3); g.lineTo(x + cs * .3, y + cs * .7); g.stroke(); }
          if (bd.flash && bd.flash.r === r && bd.flash.c === c) { g.fillStyle = bd.flash.good ? 'rgba(80,200,110,.55)' : 'rgba(230,40,40,.6)'; g.fillRect(x, y, cs, cs); } }
        g.strokeStyle = 'rgba(80,64,40,.55)'; g.lineWidth = 2; g.beginPath();
        for (let c = 0; c <= bd.C; c++) { g.moveTo(left + c * cs, top); g.lineTo(left + c * cs, top + bd.R * cs); } for (let r = 0; r <= bd.R; r++) { g.moveTo(left, top + r * cs); g.lineTo(left + bd.C * cs, top + r * cs); } g.stroke();
        g.strokeStyle = '#3a2e1c'; g.lineWidth = 5; g.beginPath();
        for (let c = 0; c <= bd.C; c += 5) { g.moveTo(left + c * cs, top); g.lineTo(left + c * cs, top + bd.R * cs); } for (let r = 0; r <= bd.R; r += 5) { g.moveTo(left, top + r * cs); g.lineTo(left + bd.C * cs, top + r * cs); }
        g.moveTo(left + bd.C * cs, top); g.lineTo(left + bd.C * cs, top + bd.R * cs); g.moveTo(left, top + bd.R * cs); g.lineTo(left + bd.C * cs, top + bd.R * cs); g.stroke();
        if (!won) { const [r, c] = bd.cur; g.strokeStyle = '#d6a028'; g.lineWidth = 6; g.strokeRect(left + c * cs + 3, top + r * cs + 3, cs - 6, cs - 6); }
        tex.update();
      }
      function setCell(r, c, v, quiet) {
        if (st.phase !== 'play' || r < 0 || c < 0 || r >= bd.R || c >= bd.C || bd.cells[r][c] === v) return false;
        bd.hist.push({ r, c, v: bd.cells[r][c], group: st.drag?.group }); bd.cells[r][c] = v; if (!quiet) { ctx.note(v === 1 ? 420 + (r + c) * 12 : 300, 'lantern'); draw(); check(); } return true;
      }
      function press(r, c) { if (st.phase !== 'play') return; bd.cur = [r, c]; const v = bd.cells[r][c], want = v === bd.mode ? 0 : bd.mode; st.drag = { want, group: (st.group = (st.group || 0) + 1), last: null }; setCell(r, c, want); st.drag.last = r * 64 + c; draw(); }
      function undo() { if (st.phase !== 'play' || !bd.hist.length) return; const g = bd.hist[bd.hist.length - 1].group; do { const h = bd.hist.pop(); bd.cells[h.r][h.c] = h.v; } while (g != null && bd.hist.length && bd.hist[bd.hist.length - 1].group === g); draw(); }
      function hint() {
        if (st.phase !== 'play') return; st.drag = null; bd.hints++; info();
        for (let r = 0; r < bd.R; r++) for (let c = 0; c < bd.C; c++) if (bd.cells[r][c] === 1 && !bd.sol[r][c]) { bd.cur = [r, c]; bd.flash = { r, c, t: 0, good: false }; setCell(r, c, 2); H.msg('That square stays bare', 1300); return; }
        // the line with the fewest unknowns left: ink its next missing square
        let best = null; for (let r = 0; r < bd.R; r++) for (let c = 0; c < bd.C; c++) if (bd.sol[r][c] && bd.cells[r][c] !== 1) { const left = bd.cells[r].filter((v, i) => bd.sol[r][i] && v !== 1).length; if (!best || left < best.left) best = { r, c, left }; }
        if (!best) return; bd.cur = [best.r, best.c]; bd.flash = { r: best.r, c: best.c, t: 0, good: true }; setCell(best.r, best.c, 1); H.msg('Ink this one', 1100);
      }
      function check() {
        for (let r = 0; r < bd.R; r++) for (let c = 0; c < bd.C; c++) if ((bd.cells[r][c] === 1) !== !!bd.sol[r][c]) return;
        st.phase = 'won'; st.wt = 0; pads.style.display = 'none'; draw(); ctx.sound('gamewin'); H.msg(LV[bd.k].name, 1700, 'the banner is painted');
        if (bd.k + 1 > solvedUpTo) { solvedUpTo = bd.k + 1; try { localStorage.setItem(KEY, String(solvedUpTo)); } catch (e) {} }
      }
      function cellAt() { const hit = scene.pickWithRay(ctx.ray(), m => m.metadata?.nonoCloth); if (!hit?.pickedPoint) return null;
        const l = ctx.toLocal(hit.pickedPoint), px = (l.x / W + .5) * TEX, py = (1 - ((l.y - CY) / W + .5)) * TEX, c = Math.floor((px - geo.left) / geo.cs), r = Math.floor((py - geo.top) / geo.cs);
        return r >= 0 && c >= 0 && r < bd.R && c < bd.C ? [r, c] : null; }
      const hud = document.getElementById('gameHud');
      const pick = document.createElement('div');
      pick.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(400px,90vw);background:rgba(14,18,10,.94);border:1px solid rgba(216,180,80,.6);border-radius:14px;padding:16px;text-align:center;pointer-events:auto;font:15px/1.4 system-ui,sans-serif;color:#eee';
      const drawPick = () => { pick.innerHTML = `<div style="font:800 13px/1.2 system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#e3c46a;margin-bottom:10px">The War Banner</div><div style="margin-bottom:12px;color:#bbb">The numbers are the runs of ink in each row and column.</div>`
        + `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">${LV.map((L, k) => { const open = k <= solvedUpTo, ok = k < solvedUpTo; return `<button type="button" data-k="${k}" ${open ? '' : 'disabled'} style="padding:8px 2px;border-radius:9px;border:1px solid ${open ? '#e3c46a' : '#444'};background:${ok ? 'rgba(227,196,106,.22)' : 'rgba(255,255,255,.04)'};color:${open ? '#fff' : '#666'};font:700 15px system-ui,sans-serif;cursor:${open ? 'pointer' : 'default'}">${open ? `${k + 1}<div style="font:11px system-ui;opacity:.75">${L.rows[0].length}×${L.rows.length}</div>` : '🔒'}${ok ? ' ✓' : ''}</button>`; }).join('')}</div>`;
        pick.querySelectorAll('button[data-k]').forEach(b => b.onclick = (e) => { e.stopPropagation(); b.blur(); choose(+b.dataset.k); }); };
      const pads = document.createElement('div');
      pads.style.cssText = 'position:absolute;bottom:62px;right:14px;display:none;gap:6px;pointer-events:auto';
      const padBtn = (t, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.style.cssText = 'min-width:52px;height:40px;padding:0 10px;border-radius:9px;border:1px solid #c9a24a;background:rgba(20,16,8,.85);color:#fff3d6;font:700 15px system-ui;cursor:pointer'; b.onclick = (e) => { e.stopPropagation(); b.blur(); fn(); }; pads.appendChild(b); return b; };
      const modeBtn = padBtn('■ Ink', () => toggleMode()); padBtn('↶ Undo', undo); padBtn('Hint', hint);
      function toggleMode() { if (!bd) return; bd.mode = bd.mode === 1 ? 2 : 1; modeBtn.textContent = bd.mode === 1 ? '■ Ink' : '✕ Marks'; info(); }
      function choose(k) { if (st.phase !== 'pick' || k > solvedUpTo || k >= LV.length) return; pick.remove(); st.phase = 'play'; build(k); pads.style.display = 'flex'; H.msg(`Banner ${k + 1}`, 900, LV[k].name); }
      hud.append(pick, pads); drawPick();
      const cam = [0, CY + .35, -6.1], at = [0, CY, 0];
      ctx.player.place(W / 2 + 1.5, -.9, -Math.PI / 2 + .35); ctx.look(cam, at, def.fov || .8);
      { const g = tex.getContext(); g.fillStyle = '#ece2c9'; g.fillRect(0, 0, TEX, TEX); g.fillStyle = '#34502e'; g.font = 'bold 120px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('⚔', TEX / 2, TEX / 2); tex.update(); }
      H.title(def.title || 'The War Banner'); H.score(''); info();
      H.hint('Click or drag to ink; <kbd>Tab</kbd> (or the Ink button) switches to marks for bare squares. Arrows, <kbd>Space</kbd> ink, <kbd>X</kbd> mark, <kbd>U</kbd> undo, <kbd>H</kbd> hint.');
      return {
        update(dt) {
          ctx.look(cam, at); st.t += dt; if (!bd) return;
          if (st.phase === 'play') { const s = Math.floor(bd.time); bd.time += dt; if (Math.floor(bd.time) !== s) info(); }
          if (bd.flash && (bd.flash.t += dt) > 1.1) { bd.flash = null; draw(); }
          if (st.phase === 'won' && (st.wt += dt) > 2) { st.phase = 'done'; H.hint(''); const k = bd.k, score = (k + 1) * 20 + (bd.hints ? 0 : 10);
            ctx.finish({ score, label: 'points', solved: true, extra: `${LV[k].name}: banner ${k + 1} painted in ${fmt(bd.time)}${bd.hints ? `, ${bd.hints} hint${bd.hints > 1 ? 's' : ''}` : ''}.${k + 1 < LV.length ? ` Banner ${k + 2} is open.` : ' Every banner painted.'}` }); }
        },
        key(e, down) {
          if (!down || e.repeat) return; const k = e.key.toLowerCase();
          if (st.phase === 'pick') { const n = parseInt(k, 10); if (n >= 1 && n <= LV.length) choose(n - 1); return; }
          if (st.phase !== 'play') return; const [r, c] = bd.cur;
          if (k === 'arrowup' || k === 'w') { bd.cur = [(r - 1 + bd.R) % bd.R, c]; draw(); } else if (k === 'arrowdown' || k === 's') { bd.cur = [(r + 1) % bd.R, c]; draw(); }
          else if (k === 'arrowleft' || k === 'a') { bd.cur = [r, (c - 1 + bd.C) % bd.C]; draw(); } else if (k === 'arrowright' || k === 'd') { bd.cur = [r, (c + 1) % bd.C]; draw(); }
          else if (k === ' ' || k === 'enter') { st.drag = null; setCell(r, c, bd.cells[r][c] === 1 ? 0 : 1); } else if (k === 'x' || k === 'm') { if (e.shiftKey) toggleMode(); else { st.drag = null; setCell(r, c, bd.cells[r][c] === 2 ? 0 : 2); } }
          else if (k === 'u' || k === 'z' || k === 'backspace') undo(); else if (k === 'h') hint(); else if (k === 'tab') { e.preventDefault?.(); toggleMode(); }
        },
        pointer(evt) {
          const T = B.PointerEventTypes; if (st.phase !== 'play' || !bd) return;
          if (evt.type === T.POINTERDOWN) { const rc = cellAt(); if (rc) press(rc[0], rc[1]); }
          else if (evt.type === T.POINTERMOVE && st.drag) { const rc = cellAt(); if (rc && rc[0] * 64 + rc[1] !== st.drag.last) { st.drag.last = rc[0] * 64 + rc[1]; bd.cur = rc; if (!setCell(rc[0], rc[1], st.drag.want)) draw(); } }
          else if (evt.type === T.POINTERUP) st.drag = null;
        },
        _test: { st, choose, setCell, press, undo, hint, toggleMode, get bd() { return bd; }, LV, draw },
        dispose() { pick.remove(); pads.remove(); nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); try { clothM.dispose(); tex.dispose(); } catch (e) {} }
      };
    }
  };
  window.RebelGames.register('nonogram', G);
})();
