// Moons and Suns (Oct 15, Cute & Creepy): the Mystic Moons' night board. Fill every square with a moon or a sun: no
// three alike in a row or a column, each row and column half moons and half suns, and no two rows (or two columns)
// the same. Seven boards from 6 x 6 to the 12 x 12 Eclipse, each with one answer (checked by two separate solvers;
// the big ones need "what if this were a moon?" reasoning). Click a square for a moon, again for a sun, again to clear
// (right click the other way), drag to paint; arrows move, M / S place, 0 clears. The numbers beside each line count
// the moons and suns still to place. H hint (no clean bonus). Score: the board x 20, +10 without a hint.
// Oct 17: How to play (the rules in a few lines) and Restart (the board as picked: the givens only, no undo, hints or time).
// def: { levels, pass, points }
(function () {
  const LEVELS = [
    { name: "First Night", n: 6, givens: 's.s.s....m...s....mm......ms...s..m.', sol: 'smsmsmmssmmsssmsmmmmsmsssmmssmmsmsms' },
    { name: "The Crooked Cottage", n: 6, givens: '...........m.......m...s...m.sm.s...', sol: 'msmsmssmsmsmmsmssmsmmsmssmsmmsmssmsm' },
    { name: "The Witch's Window", n: 8, givens: '..............m......s.m..mm...m..s..s.........s.mm..s...ms.m.ms', sol: 'msmssmsmsmmssmmsmssmmssmssmmsmsmmmssmsmsmssmsmmssmmsmssmsmsmmsms' },
    { name: "The Graveyard Gate", n: 8, givens: 'm....s.m..mm....m..........m..s.....s..........s...s..m.m..s....', sol: 'mssmmssmssmmsmmsmmssmsmssmsmsmsmmsmssmsmsmsmmsmssmmssmmsmsmsmssm' },
    { name: "The Harvest Moon", n: 10, givens: '...............s.......ss.....m.ss.....mm....s.m.m.......m...s...s......m....s.s.s.s............s..s', sol: 'ssmmsmmssmmssmmssmmssmmssmmsmsmmssmsmssmmssmmssmsmsmmssmsmmsmssmmsmssmsmmsmsmsmsmsmssmsmsmsmsmsmsmms' },
    { name: "The Manor Clock", n: 10, givens: 's.....m........m..sm........m.......s..s.m......m.m......m..m.s..mm....s......s.......m........m.m..', sol: 'smsmmsmsmsmsmssmsmsmsmssmsmsmmmsmmsmsmsssmmsmsmsmsmmssmssmsmmssmsmmsmsssmsmmsmsmmmsmssmssmssmmsmsmms' },
    { name: "The Eclipse", n: 12, givens: '...s.m.ss..s.....s.sm....mm.......s...m.....m......s...s.m...m..........s..s.mm..........m..s..s..s.............ss...s...mm.........s......s.m..', sol: 'msmssmmssmmsmssmmsmsmssmsmmsmssmsmsmssmmsmsmmsmsmmssmsmssmsmmmsmmssmssmsssmssmmsmsmmmsmmsmsmsmsssmssmssmmsmmmssmssmsmsmmsmmsmmsmsmsssmsmsmmsmmss' }
  ];
  const G = {
    title: 'Moons and Suns',
    howTo: { lines: [
      'Fill every square with a moon or a sun. The lighter squares with a gold edge are given and cannot change.',
      'Never three of the same side by side in a row or a column.',
      'Every row and every column holds as many moons as suns, and no two rows (or two columns) may be exactly alike.',
      'The numbers beside each row and under each column count the moons (silver) and suns (gold) still to place there.',
      'Click a square for a moon, again for a sun, again to clear (right click goes the other way); drag to paint. M / S place, 0 clears, U undoes, H gives a hint with its reason.',
      'Tip: two alike side by side need the other kind at both ends, and a square between two alike takes the other kind.'] },
    start(ctx) {
      const B = ctx.B, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const LV = def.levels || LEVELS, KEY = 'rebelAntsMoonsProgress:' + (def.id || 'moons');
      let solvedUpTo = 0; try { solvedUpTo = Math.max(0, Math.min(LV.length, Number(localStorage.getItem(KEY)) || 0)); } catch (e) {}
      const mat = (k, c, em) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(.05, .05, .05); if (em) m.emissiveColor = new B.Color3(...em); return m; });
      const woodM = mat('nightTable', [.2, .13, .22], [.06, .035, .07]), candleM = mat('candle', [.92, .88, .78], [.3, .27, .2]), flameM = mat('flame', [1, .75, .3], [1, .62, .2]);
      const nodes = [], keep = n => { n.parent = n.parent || ctx.frame; ctx.add(n); nodes.push(n); if (n.isPickable !== undefined) n.isPickable = false; return n; };
      const TEX = 1024, tex = new B.DynamicTexture('msTex', { width: TEX, height: TEX }, scene, true); tex.hasAlpha = false;
      const boardM = new B.StandardMaterial('msBoardMat', scene); boardM.diffuseTexture = tex; boardM.emissiveTexture = tex; boardM.emissiveColor = new B.Color3(.7, .7, .7); boardM.diffuseColor = new B.Color3(.5, .5, .5); boardM.specularColor = new B.Color3(0, 0, 0);
      const S = 4.4, TY = .95;
      { const t = keep(B.MeshBuilder.CreateBox('msTable', { width: S + .5, height: .14, depth: S + .5 }, scene)); t.material = woodM; t.position.y = TY - .07;
        for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const l = keep(B.MeshBuilder.CreateBox('msLeg', { width: .16, height: TY - .14, depth: .16 }, scene)); l.material = woodM; l.position.set(x * (S / 2), (TY - .14) / 2, z * (S / 2)); }
        for (const [x, z] of [[-1, 1], [1, 1]]) { const c = keep(B.MeshBuilder.CreateCylinder('msCandle', { diameter: .1, height: .26, tessellation: 10 }, scene)); c.material = candleM; c.position.set(x * (S / 2 - .02), TY + .13, z * (S / 2 - .02));
          const f = keep(B.MeshBuilder.CreateSphere('msFlame', { diameter: .07, segments: 6 }, scene)); f.material = flameM; f.scaling.y = 1.7; f.position.set(x * (S / 2 - .02), TY + .31, z * (S / 2 - .02)); } } // two candles at the far corners
      const board = keep(B.MeshBuilder.CreateGround('msBoard', { width: S, height: S }, scene)); board.material = boardM; board.position.y = TY + .005; board.isPickable = true; board.metadata = { msBoard: true };
      let bd = null; // { k, L, n, N, h, giv (-1 none, 0 moon, 1 sun), sol, g (-1 empty), hints, time, cur, undo: [], flash, X0, Y0, CS, moon, sun (sprites) }
      const st = { phase: 'pick', t: 0, drag: null, dirty: false, warned: '' };
      const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
      const LINES = n => { const out = []; for (let r = 0; r < n; r++) out.push([...Array(n).keys()].map(c => r * n + c)); for (let c = 0; c < n; c++) out.push([...Array(n).keys()].map(r => r * n + c)); return out; };
      function sprites(CS) { // a silver crescent and a gold sun, drawn once per board size
        const mk = draw => { const c = document.createElement('canvas'); c.width = c.height = Math.ceil(CS); const g = c.getContext('2d'); draw(g, CS / 2); return c; };
        const moon = mk((g, m) => { const r = CS * .33, gr = g.createRadialGradient(m - r * .3, m - r * .3, r * .1, m, m, r); gr.addColorStop(0, '#f4f8ff'); gr.addColorStop(1, '#9fb2d8'); g.fillStyle = gr; g.beginPath(); g.arc(m, m, r, 0, Math.PI * 2); g.fill();
          g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(m + r * .52, m - r * .28, r * .86, 0, Math.PI * 2); g.fill(); g.globalCompositeOperation = 'source-over'; });
        const sun = mk((g, m) => { const r = CS * .2, R2 = CS * .38; g.fillStyle = '#f2b43a'; g.beginPath(); for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8, rr = k % 2 ? r * 1.08 : R2; g.lineTo(m + Math.cos(a) * rr, m + Math.sin(a) * rr); } g.closePath(); g.fill();
          const gr = g.createRadialGradient(m - r * .3, m - r * .3, r * .1, m, m, r); gr.addColorStop(0, '#fff3b8'); gr.addColorStop(1, '#f0a020'); g.fillStyle = gr; g.beginPath(); g.arc(m, m, r, 0, Math.PI * 2); g.fill(); });
        return { moon, sun }; }
      function build(k) {
        const L = LV[k], n = L.n, N = n * n, CS = (TEX - 90) / (n + .9), X0 = (TEX - CS * (n + .9)) / 2, Y0 = (TEX - CS * (n + .9)) / 2;
        const giv = Int8Array.from(L.givens, ch => ch === 'm' ? 0 : ch === 's' ? 1 : -1);
        bd = { k, L, n, N, h: n / 2, lines: LINES(n), giv, sol: Int8Array.from(L.sol, ch => ch === 's' ? 1 : 0), g: Int8Array.from(giv), hints: 0, time: 0, cur: 0, undo: [], flash: null, X0, Y0, CS, ...sprites(CS) }; st.warned = '';
        draw(); info();
      }
      const filled = () => { let k = 0; for (const v of bd.g) if (v !== -1) k++; return k; };
      const info = () => H.info(bd ? `Board ${bd.k + 1} / ${LV.length} · ${bd.L.name} · ${bd.n} × ${bd.n} · filled ${filled()} / ${bd.N} · ${fmt(bd.time)}${bd.hints ? ` · hints ${bd.hints}` : ''}` : 'Pick a board');
      // what is broken now: three alike (cells), a line over its half (line ids), two full lines alike (line ids)
      function faults() {
        const { g, n, h, lines } = bd, bad = new Set(), over = new Set(), twins = new Set();
        lines.forEach((Ln, li) => { let c0 = 0, c1 = 0; for (const i of Ln) { if (g[i] === 0) c0++; else if (g[i] === 1) c1++; } if (c0 > h || c1 > h) over.add(li);
          for (let k = 0; k + 2 < n; k++) { const a = g[Ln[k]]; if (a !== -1 && a === g[Ln[k + 1]] && a === g[Ln[k + 2]]) { bad.add(Ln[k]); bad.add(Ln[k + 1]); bad.add(Ln[k + 2]); } } });
        for (const off of [0, n]) for (let x = off; x < off + n; x++) for (let y = x + 1; y < off + n; y++) { const A = lines[x], Bl = lines[y]; if (A.every((i, k) => g[i] !== -1 && g[i] === g[Bl[k]])) { twins.add(x); twins.add(y); } }
        return { bad, over, twins }; }
      const cellXY = i => [bd.X0 + (i % bd.n) * bd.CS, bd.Y0 + Math.floor(i / bd.n) * bd.CS];
      const rr = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
      const draw = () => { st.dirty = true; }; // changes are painted once per frame (one texture upload)
      function paint() {
        const g = tex.getContext(), { n, N, CS, X0, Y0, h } = bd, won = st.phase === 'won' || st.phase === 'done', F = faults();
        g.fillStyle = '#231a33'; g.fillRect(0, 0, TEX, TEX); // the night board
        let sd = 7; const sr = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; }; g.fillStyle = 'rgba(255,255,255,.35)'; for (let k = 0; k < 90; k++) { g.beginPath(); g.arc(sr() * TEX, sr() * TEX, sr() * 1.8 + .4, 0, Math.PI * 2); g.fill(); } // stars
        const grd = g.createRadialGradient(TEX / 2, TEX / 2, TEX * .2, TEX / 2, TEX / 2, TEX * .75); grd.addColorStop(0, 'rgba(120,80,170,.18)'); grd.addColorStop(1, 'rgba(0,0,0,.4)'); g.fillStyle = grd; g.fillRect(0, 0, TEX, TEX);
        for (let i = 0; i < N; i++) { const [x, y] = cellXY(i), v = bd.g[i], given = bd.giv[i] !== -1, p = CS * .05;
          g.fillStyle = given ? '#4b3b68' : '#30253f'; rr(g, x + p, y + p, CS - 2 * p, CS - 2 * p, CS * .14); g.fill();
          g.strokeStyle = F.bad.has(i) ? '#e0443a' : given ? 'rgba(226,190,110,.55)' : 'rgba(170,150,210,.25)'; g.lineWidth = F.bad.has(i) ? Math.max(3, CS * .06) : 2; g.stroke();
          if (v !== -1) g.drawImage(v ? bd.sun : bd.moon, x, y, CS, CS); }
        // twin lines outlined, the counts still to place (moons silver above, suns gold below / beside)
        g.strokeStyle = '#e0443a'; g.lineWidth = Math.max(3, CS * .05); for (const li of F.twins) { if (li < n) g.strokeRect(X0 + 1, Y0 + li * CS + 1, n * CS - 2, CS - 2); else g.strokeRect(X0 + (li - n) * CS + 1, Y0 + 1, CS - 2, n * CS - 2); }
        g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `bold ${Math.round(CS * .36)}px Georgia, serif`;
        bd.lines.forEach((Ln, li) => { let c0 = 0, c1 = 0; for (const i of Ln) { if (bd.g[i] === 0) c0++; else if (bd.g[i] === 1) c1++; } const m = h - c0, s = h - c1, red = F.over.has(li);
          const col = (left, base) => left < 0 || red ? '#ff6a5a' : left === 0 ? 'rgba(200,190,220,.3)' : base;
          if (li < n) { const x = X0 + n * CS + CS * .45, y = Y0 + (li + .5) * CS; g.fillStyle = col(m, '#c9d6f2'); g.fillText(String(m), x, y - CS * .19); g.fillStyle = col(s, '#f2b43a'); g.fillText(String(s), x, y + CS * .19); }
          else { const c = li - n, x = X0 + (c + .5) * CS, y = Y0 + n * CS + CS * .45; g.fillStyle = col(m, '#c9d6f2'); g.fillText(String(m), x - CS * .19, y); g.fillStyle = col(s, '#f2b43a'); g.fillText(String(s), x + CS * .19, y); } });
        if (won) { g.strokeStyle = '#f3cf62'; g.lineWidth = 6; g.strokeRect(X0 - 6, Y0 - 6, n * CS + 12, n * CS + 12); }
        if (st.phase === 'play') { const [x, y] = cellXY(bd.cur); g.strokeStyle = 'rgba(255,190,40,.95)'; g.lineWidth = 5; rr(g, x + 2, y + 2, CS - 4, CS - 4, CS * .14); g.stroke(); }
        if (bd.flash) { const [x, y] = cellXY(bd.flash.i); g.fillStyle = bd.flash.good ? 'rgba(47,208,96,.35)' : 'rgba(224,48,48,.4)'; rr(g, x + 2, y + 2, CS - 4, CS - 4, CS * .14); g.fill(); }
        tex.update();
      }
      function setCell(i, v, rec) { if (i == null || i < 0 || bd.giv[i] !== -1 || bd.g[i] === v) return false; if (rec) rec.push([i, bd.g[i]]); bd.g[i] = v; return true; }
      function commit(rec) { if (!rec.length) return; bd.undo.push(rec); if (bd.undo.length > 500) bd.undo.shift(); ctx.note(rec.some(([i]) => bd.g[i] === 1) ? 660 : rec.some(([i]) => bd.g[i] === 0) ? 520 : 400, 'lantern'); draw(); info(); check(); }
      const cycle = (v, back) => back ? (v === -1 ? 1 : v === 1 ? 0 : -1) : (v === -1 ? 0 : v === 0 ? 1 : -1);
      function tap(i, back) { if (st.phase !== 'play' || i == null) return false; bd.cur = i; if (bd.giv[i] !== -1) { H.msg('A given square', 700); draw(); return false; }
        const v = cycle(bd.g[i], back), rec = []; setCell(i, v, rec); st.drag = { v, rec, last: i }; commit(rec); return true; }
      function dragTo(i) { const d = st.drag; if (!d || i == null || i === d.last) return; d.last = i; bd.cur = i; if (setCell(i, d.v, d.rec)) { if (!bd.undo.includes(d.rec)) bd.undo.push(d.rec); ctx.note(d.v === 1 ? 660 : d.v === 0 ? 520 : 400, 'lantern'); info(); check(); } draw(); }
      function place(v) { if (st.phase !== 'play') return; const rec = []; if (bd.giv[bd.cur] !== -1) { H.msg('A given square', 700); return; } setCell(bd.cur, v, rec); commit(rec); }
      function undo() { if (st.phase !== 'play') return; const rec = bd.undo.pop(); if (!rec) return; for (let j = rec.length - 1; j >= 0; j--) bd.g[rec[j][0]] = rec[j][1]; ctx.note(330, 'lantern'); draw(); info(); }
      function restart() { if (st.phase !== 'play') return; const rec = []; for (let i = 0; i < bd.N; i++) setCell(i, -1, rec); commit(rec); }
      // the HUD's Restart: the board as it was picked (the givens only; no undo, hints or time either)
      function startOver() { if (st.phase !== 'play' || !bd) return; st.drag = null; build(bd.k); H.msg('Start again', 900); }
      // a square the line rules settle from what is on the board now (pairs, gaps, full counts), with the reason
      function ruleStep() { const { g, n, h, lines } = bd, nm = v => v ? 'suns' : 'moons', one = v => v ? 'sun' : 'moon';
        for (const Ln of lines) for (let k = 0; k + 1 < n; k++) { const a = g[Ln[k]]; if (a === -1 || a !== g[Ln[k + 1]]) continue;
          for (const j of [k - 1, k + 2]) if (j >= 0 && j < n && g[Ln[j]] === -1) return { i: Ln[j], v: 1 - a, why: `Two ${nm(a)} side by side: a ${one(1 - a)} at each end` }; }
        for (const Ln of lines) for (let k = 0; k + 2 < n; k++) { const a = g[Ln[k]]; if (a !== -1 && a === g[Ln[k + 2]] && g[Ln[k + 1]] === -1) return { i: Ln[k + 1], v: 1 - a, why: `Between two ${nm(a)} goes a ${one(1 - a)}` }; }
        for (const [li, Ln] of lines.entries()) { let c0 = 0, c1 = 0; for (const i of Ln) { if (g[i] === 0) c0++; else if (g[i] === 1) c1++; } const v = c0 === h ? 1 : c1 === h ? 0 : -1; if (v < 0) continue; const i = Ln.find(x => g[x] === -1); if (i != null) return { i, v, why: `This ${li < n ? 'row' : 'column'} has all its ${nm(1 - v)}: the rest are ${nm(v)}` }; }
        return null; }
      function hint() {
        if (st.phase !== 'play') return;
        const wrong = [...bd.g.keys()].find(i => bd.g[i] !== -1 && bd.g[i] !== bd.sol[i]);
        if (wrong != null) { const rec = []; setCell(wrong, -1, rec); bd.undo.push(rec); bd.hints++; bd.flash = { i: wrong, t: 0, good: false }; bd.cur = wrong; H.msg('This one is wrong', 1300); draw(); info(); return; }
        let step = ruleStep(); if (step && step.v !== bd.sol[step.i]) step = null; // (never: a rule on a right board gives the answer)
        if (!step) { let best = -1, bu = 99; for (const Ln of bd.lines) { const u = Ln.filter(i => bd.g[i] === -1); if (u.length && u.length < bu) { bu = u.length; best = u[0]; } } if (best < 0) return; step = { i: best, v: bd.sol[best], why: bd.sol[best] ? 'A sun goes here' : 'A moon goes here' }; }
        const rec = []; setCell(step.i, step.v, rec); bd.undo.push(rec); bd.hints++; bd.flash = { i: step.i, t: 0, good: true }; bd.cur = step.i; H.msg(step.why, 2200); draw(); info(); check(); }
      function check() { if (filled() < bd.N) return false; let same = true; for (let i = 0; i < bd.N; i++) if (bd.g[i] !== bd.sol[i]) { same = false; break; }
        if (!same) { const key = bd.g.join(''); if (key !== st.warned) { st.warned = key; H.msg('Every square is filled', 2000, 'but a rule is broken'); } return false; }
        st.phase = 'won'; st.wt = 0; st.drag = null; draw(); pads.style.display = 'none'; ctx.sound('gamewin'); H.msg('The night is balanced', 1600, fmt(bd.time));
        if (bd.k + 1 > solvedUpTo) { solvedUpTo = bd.k + 1; try { localStorage.setItem(KEY, String(solvedUpTo)); } catch (e) {} } return true; }
      const hud = document.getElementById('gameHud');
      const pick = document.createElement('div');
      pick.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(430px,92vw);background:rgba(22,14,32,.95);border:1px solid rgba(190,160,240,.6);border-radius:14px;padding:16px;text-align:center;pointer-events:auto;font:15px/1.4 system-ui,sans-serif;color:#eee';
      const drawPick = () => { pick.innerHTML = `<div style="font:800 13px/1.2 system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#cdb6f5;margin-bottom:10px">Moons and Suns</div><div style="margin-bottom:12px;color:#bbb">Fill every square with a moon or a sun. Never three alike in a line, half of each in every row and column, and no two rows or columns the same.</div>`
        + `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">${LV.map((L, k) => { const open = k <= solvedUpTo, ok = k < solvedUpTo; return `<button type="button" data-k="${k}" ${open ? '' : 'disabled'} style="padding:8px 2px;border-radius:9px;border:1px solid ${open ? '#cdb6f5' : '#444'};background:${ok ? 'rgba(205,182,245,.18)' : 'rgba(255,255,255,.04)'};color:${open ? '#fff' : '#666'};font:700 15px system-ui,sans-serif;cursor:${open ? 'pointer' : 'default'}">${open ? `${k + 1}${ok ? ' ✓' : ''}<div style="font:500 11px system-ui;color:#c4b5dd">${L.n} × ${L.n}</div>` : `${k + 1}<div style="font:500 11px system-ui">locked</div>`}</button>`; }).join('')}</div>`
          + `<div style="margin-top:10px;font-size:12px;color:#998">Keys 1-${LV.length} pick a board</div>`;
        pick.querySelectorAll('button[data-k]').forEach(b => b.onclick = (e) => { e.stopPropagation(); b.blur(); choose(+b.dataset.k); }); };
      const pads = document.createElement('div');
      pads.style.cssText = 'position:absolute;bottom:62px;right:14px;display:none;gap:6px;pointer-events:auto';
      const padBtn = (t, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.style.cssText = 'min-width:52px;height:40px;padding:0 10px;border-radius:9px;border:1px solid #cdb6f5;background:rgba(20,12,30,.88);color:#f6f0ff;font:700 15px system-ui;cursor:pointer'; b.onclick = (e) => { e.stopPropagation(); b.blur(); fn(); }; pads.appendChild(b); return b; };
      padBtn('☾ Moon', () => place(0)); padBtn('☀ Sun', () => place(1)); padBtn('Undo', undo); padBtn('Hint', hint);
      function choose(k) { if (st.phase !== 'pick' || k > solvedUpTo || k >= LV.length) return; pick.remove(); st.phase = 'play'; build(k); pads.style.display = 'flex'; H.msg(`Board ${k + 1}`, 900, `${LV[k].name}: ${LV[k].n} × ${LV[k].n}`); }
      hud.append(pick, pads); drawPick();
      const cam = [0, TY + 6.3, -3.4], at = [0, TY, -.3];
      ctx.player.place(0, -(S / 2 + 1.6), 0); // on the camera's side of the table, out of the picture
      ctx.look(cam, at, def.fov || .8);
      { const g = tex.getContext(); g.fillStyle = '#231a33'; g.fillRect(0, 0, TEX, TEX); tex.update(); }
      H.title(def.title || 'Moons and Suns'); H.score(''); info();
      H.hint('Click a square: moon, sun, empty (right click the other way), drag to paint. <kbd>M</kbd> / <kbd>S</kbd> place, <kbd>0</kbd> clears, <kbd>U</kbd> undo, <kbd>H</kbd> hint.');
      const at2 = () => { const hit = scene.pickWithRay(ctx.ray(), m => m.metadata?.msBoard); if (!hit?.pickedPoint) return null; const l = ctx.toLocal(hit.pickedPoint);
        const px = (l.x + S / 2) / S * TEX, py = (S / 2 - l.z) / S * TEX, c = Math.floor((px - bd.X0) / bd.CS), r = Math.floor((py - bd.Y0) / bd.CS);
        return c >= 0 && r >= 0 && c < bd.n && r < bd.n ? r * bd.n + c : null; };
      return {
        update(dt) {
          ctx.look(cam, at); st.t += dt; if (!bd) return; if (st.dirty) { st.dirty = false; paint(); }
          if (st.phase === 'play') { const s = Math.floor(bd.time); bd.time += dt; if (Math.floor(bd.time) !== s) info(); }
          if (bd.flash && (bd.flash.t += dt) > 1.6) { bd.flash = null; draw(); }
          if (st.phase === 'won' && (st.wt += dt) > 2) { st.phase = 'done'; H.hint(''); const k = bd.k;
            ctx.finish({ score: (k + 1) * 20 + (bd.hints ? 0 : 10), label: 'points', solved: true, extra: `${bd.L.name} (board ${k + 1}, ${bd.n} × ${bd.n}) balanced in ${fmt(bd.time)}${bd.hints ? `, ${bd.hints} hint${bd.hints > 1 ? 's' : ''}` : ''}.${k + 1 < LV.length ? ` Board ${k + 2} is open.` : ' Every night is balanced.'}` }); }
        },
        key(e, down) {
          if (!down || e.repeat) return; const k = e.key.toLowerCase();
          if (st.phase === 'pick') { const n = k === '0' ? 10 : parseInt(k, 10); if (n >= 1 && n <= LV.length) choose(n - 1); return; } // 1-9, 0 = the tenth
          if (st.phase !== 'play') return; const n = bd.n, r = Math.floor(bd.cur / n), c = bd.cur % n;
          const dirs = { arrowup: [-1, 0], arrowdown: [1, 0], arrowleft: [0, -1], arrowright: [0, 1] };
          if (k in dirs) { const [dr, dc] = dirs[k], nr = r + dr, nc = c + dc; if (nr >= 0 && nc >= 0 && nr < n && nc < n) { bd.cur = nr * n + nc; draw(); } }
          else if (k === 'm' || k === '1') place(0); else if (k === 's' || k === '2') place(1); else if (k === '0' || k === 'backspace' || k === 'delete') place(-1);
          else if (k === ' ') { if (bd.giv[bd.cur] === -1) place(cycle(bd.g[bd.cur], e.shiftKey)); }
          else if (k === 'u' || (k === 'z' && (e.ctrlKey || e.metaKey))) undo(); else if (k === 'h') hint();
        },
        pointer(evt) {
          const T = B.PointerEventTypes; if (st.phase !== 'play' || !bd) return;
          if (evt.type === T.POINTERDOWN) { const i = at2(); if (i == null) return; tap(i, evt.event && evt.event.button === 2); }
          else if (evt.type === T.POINTERMOVE && st.drag) { const i = at2(); if (i != null) dragTo(i); }
          else if (evt.type === T.POINTERUP) st.drag = null;
        },
        restart: startOver,
        _test: { st, choose, tap, dragTo, place, undo, hint, restart, startOver, faults, ruleStep, get bd() { return bd; }, LV, draw: () => { st.dirty = false; paint(); }, end() { st.drag = null; }, unlock(k) { solvedUpTo = k; drawPick(); } },
        dispose() { pick.remove(); pads.remove(); nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); try { boardM.dispose(); tex.dispose(); } catch (e) {} }
      };
    }
  };
  window.RebelGames.register('moons', G);
})();
