// The Sacred Rope (Oct 15, Kenshi): tie one closed rope (a shimenawa) along the lines between the stones. Each number
// says how many sides of its square the rope runs along; squares without a number can have any. The rope never crosses
// or touches itself and has no loose ends. Seven boards from 5 x 5 to the 10 x 10 Master's Rope, each with one answer
// (checked by a solver; the hard ones need "what if the rope ran here?" reasoning). Click a line to lay rope, right
// click to cross it out (Tab swaps), drag from dot to dot to lay a run, click inside a square to settle its sides when
// they are sure; arrows move the dot cursor, Shift + arrow lays rope from it. H hint (no clean bonus).
// Score: the board x 20, +10 without a hint. def: { levels, pass, points }
// Oct 17 (Miguel: the puzzles need a how-to, every board a Restart): howTo (the rules in a few lines) and inst.restart
// (the same board bare again, the undo list empty, the clock from 0; hints still count: they cost the bonus).
(function () {
  const LEVELS = [
    { name: "The First Knot", r: 5, c: 5, clues: '0..0.1...00....2.002.....', loop: '000000110001010010011000011111000000010100001010010001100001' },
    { name: "The Pond Edge", r: 6, c: 6, clues: '.1..12.0.0.2..........0.101..00.....', loop: '111111000000000011010100101000000000000000100000110000011000100111100000000000000000' },
    { name: "The Bamboo Grove", r: 7, c: 7, clues: '...21.2...1..1...1........0..022.....0...1..0.1.2', loop: '0001111000000000000000010000001000000011000000000000001100010001000100010001000100100001000100010000010100000101' },
    { name: "The Still Water", r: 7, c: 7, clues: '..02.2......1.0.1...1..1.......20.10.1..0...3..1.', loop: '0000100000101100000000000000000000000010000011000001111100001100000100010001000100010001000100010000100100100001' },
    { name: "The Raked Garden", r: 8, c: 8, clues: '..0....1...0.01...11....0..2..1..11...0.....00..02....01...1.1..', loop: '000000000000000100000000001101100000100000000000000000000100000001111111000000000000000011000000011001011001001000001001000001001000001010000001' },
    { name: "The Duelist's Ring", r: 10, c: 10, clues: '......011..0.0.0........00..11.0...0.....011...002....0...0...3.0...0...3.........3..00.01....1.1...', loop: '0000000000000000011000000000000001000000000010100100000100000010000000001000000000100000000010000000000111111100000000000000000010100000000101000011001010000101100010001000000100100000001000100000010010000000100010000001' },
    { name: "The Master's Rope", r: 10, c: 10, clues: '.1..00...02.3.....0.1.0.2210.......1.....0.0.1131.....3.....1.0.12..0010......0...13.2.3...11.3..10.', loop: '1000000000001000000001011000000000011000000000010000001111000000110000000000100000011101000001101100111110000011000000000111100000001000010000010000001000100000001001000100000010000010000100000010001001001010010000100000' }
  ];
  const G = {
    title: 'The Sacred Rope',
    howTo: {
      lines: ['Lay one closed rope along the lines between the dots: a single loop with no loose ends that never crosses or touches itself.',
        'A number says how many of the four sides of its square the rope runs along. Squares without a number can have any.',
        'Click a line to lay rope, right click to cross it out (Tab swaps the two); drag from dot to dot to lay a long run.',
        'Click inside a numbered square to fill in its last sides once they are sure. A number turns red when it can no longer be right; a dot turns red where three ropes meet.',
        'U undoes; H shows one right line, but costs the clean bonus. Tip: start with the 0s: cross out all four of their sides, then look at the 3s.']
    },
    start(ctx) {
      const B = ctx.B, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const LV = def.levels || LEVELS, KEY = 'rebelAntsRopeProgress:' + (def.id || 'loop');
      let solvedUpTo = 0; try { solvedUpTo = Math.max(0, Math.min(LV.length, Number(localStorage.getItem(KEY)) || 0)); } catch (e) {}
      const mat = (k, c, em) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(.05, .05, .05); if (em) m.emissiveColor = new B.Color3(...em); return m; });
      const woodM = mat('table', [.3, .22, .15], [.07, .05, .035]), stoneM = mat('stone', [.42, .44, .43], [.08, .085, .08]);
      const nodes = [], keep = n => { n.parent = n.parent || ctx.frame; ctx.add(n); nodes.push(n); if (n.isPickable !== undefined) n.isPickable = false; return n; };
      const TEX = 1024, tex = new B.DynamicTexture('srTex', { width: TEX, height: TEX }, scene, true); tex.hasAlpha = false;
      const boardM = new B.StandardMaterial('srBoardMat', scene); boardM.diffuseTexture = tex; boardM.emissiveTexture = tex; boardM.emissiveColor = new B.Color3(.62, .62, .62); boardM.diffuseColor = new B.Color3(.55, .55, .55); boardM.specularColor = new B.Color3(0, 0, 0);
      const S = 4.4, TY = .95;
      { const t = keep(B.MeshBuilder.CreateBox('srTable', { width: S + .5, height: .14, depth: S + .5 }, scene)); t.material = woodM; t.position.y = TY - .07;
        for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const l = keep(B.MeshBuilder.CreateBox('srLeg', { width: .16, height: TY - .14, depth: .16 }, scene)); l.material = woodM; l.position.set(x * (S / 2), (TY - .14) / 2, z * (S / 2)); }
        for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const w = keep(B.MeshBuilder.CreateSphere('srStone', { diameter: .2, segments: 6 }, scene)); w.material = stoneM; w.scaling.y = .55; w.position.set(x * (S / 2 - .06), TY + .04, z * (S / 2 - .06)); } }
      const board = keep(B.MeshBuilder.CreateGround('srBoard', { width: S, height: S }, scene)); board.material = boardM; board.position.y = TY + .005; board.isPickable = true; board.metadata = { srBoard: true };
      let bd = null; // { k, L, R, C, HN, EN, VX, s: Int8Array (0 ?, 1 rope, 2 cross), sol, clues, cellE, edgeV, vertE, hints, time, cur (vertex), undo: [], flash, X0, Y0, CS }
      const st = { phase: 'pick', t: 0, mode: 1, drag: null, warned: '' };
      const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
      function build(k) {
        const L = LV[k], R = L.r, C = L.c, HN = (R + 1) * C, EN = HN + R * (C + 1), VX = (R + 1) * (C + 1);
        const hE = (r, c) => r * C + c, vE = (r, c) => HN + r * (C + 1) + c;
        const cellE = [], edgeV = new Array(EN), vertE = Array.from({ length: VX }, () => []);
        for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) cellE.push([hE(r, c), hE(r + 1, c), vE(r, c), vE(r, c + 1)]);
        for (let r = 0; r <= R; r++) for (let c = 0; c < C; c++) edgeV[hE(r, c)] = [r * (C + 1) + c, r * (C + 1) + c + 1];
        for (let r = 0; r < R; r++) for (let c = 0; c <= C; c++) edgeV[vE(r, c)] = [r * (C + 1) + c, (r + 1) * (C + 1) + c];
        for (let e = 0; e < EN; e++) for (const v of edgeV[e]) vertE[v].push(e);
        const CS = Math.min((TEX - 120) / C, (TEX - 120) / R), X0 = (TEX - CS * C) / 2, Y0 = (TEX - CS * R) / 2;
        bd = { k, L, R, C, HN, EN, VX, hE, vE, s: new Int8Array(EN), sol: Uint8Array.from(L.loop, ch => ch === '1' ? 1 : 0), clues: Int8Array.from(L.clues, ch => ch === '.' ? -1 : +ch),
          cellE, edgeV, vertE, hints: 0, time: 0, cur: 0, undo: [], flash: null, X0, Y0, CS }; st.warned = '';
        ctx.player.place(0, cam[2] - 1.6, 0); draw(); info();
      }
      const ropeCount = () => { let n = 0; for (const v of bd.s) if (v === 1) n++; return n; };
      const deg = v => { let d = 0; for (const e of bd.vertE[v]) if (bd.s[e] === 1) d++; return d; };
      const info = () => H.info(bd ? `Board ${bd.k + 1} / ${LV.length} · ${bd.L.name} · ${bd.R} × ${bd.C} · rope ${ropeCount()} · ${fmt(bd.time)} · brush ${st.mode === 1 ? 'rope' : 'cross'}${bd.hints ? ` · hints ${bd.hints}` : ''}` : 'Pick a board');
      const vxy = v => { const c = v % (bd.C + 1), r = Math.floor(v / (bd.C + 1)); return [bd.X0 + c * bd.CS, bd.Y0 + r * bd.CS]; };
      const draw = () => { st.dirty = true; }; // changes are painted once per frame (one texture upload)
      function paint() {
        const g = tex.getContext(), { R, C, CS, X0, Y0 } = bd, won = st.phase === 'won' || st.phase === 'done';
        g.fillStyle = '#e4dcc6'; g.fillRect(0, 0, TEX, TEX);
        g.strokeStyle = 'rgba(150,135,100,.18)'; g.lineWidth = 3; for (let y = 14; y < TEX; y += 22) { g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= TEX; x += 32) g.lineTo(x, y + Math.sin(x * .02 + y * .05) * 3); g.stroke(); } // raked sand
        const grd = g.createRadialGradient(TEX / 2, TEX / 2, TEX * .25, TEX / 2, TEX / 2, TEX * .75); grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(70,60,40,.3)'); g.fillStyle = grd; g.fillRect(0, 0, TEX, TEX);
        // the numbers: faded when met, red when the rope runs along too many sides
        g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `bold ${Math.round(CS * .5)}px Georgia, serif`;
        for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) { const i = r * C + c, k = bd.clues[i]; if (k < 0) continue; let on = 0, x = 0; for (const e of bd.cellE[i]) { if (bd.s[e] === 1) on++; else if (bd.s[e] === 2) x++; }
          g.fillStyle = on > k || 4 - x < k ? '#c0392b' : on === k && (k > 0 || x === 4) ? 'rgba(40,40,40,.35)' : '#2a2620'; /* a 0 fades once its sides are crossed */ g.fillText(String(k), X0 + (c + .5) * CS, Y0 + (r + .5) * CS + CS * .03); }
        // the lines: rope, crosses, faint unknown
        for (let e = 0; e < bd.EN; e++) { const [a, b] = bd.edgeV[e], [x1, y1] = vxy(a), [x2, y2] = vxy(b), v = bd.s[e];
          if (v === 1) { g.lineCap = 'round'; g.strokeStyle = won ? '#f2cf6a' : '#c9a24a'; g.lineWidth = CS * .16; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
            g.strokeStyle = 'rgba(110,80,25,.75)'; g.lineWidth = Math.max(2, CS * .035); const n = 4; for (let q = 1; q < n; q++) { const t = q / n, px = x1 + (x2 - x1) * t, py = y1 + (y2 - y1) * t, dx = (y2 - y1) / CS * CS * .06, dy = -(x2 - x1) / CS * CS * .06; g.beginPath(); g.moveTo(px - dx - (x2 - x1) * .04, py - dy - (y2 - y1) * .04); g.lineTo(px + dx + (x2 - x1) * .04, py + dy + (y2 - y1) * .04); g.stroke(); } }
          else if (v === 2) { const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, q = CS * .09; g.strokeStyle = 'rgba(90,85,75,.8)'; g.lineWidth = Math.max(2, CS * .035); g.beginPath(); g.moveTo(mx - q, my - q); g.lineTo(mx + q, my + q); g.moveTo(mx + q, my - q); g.lineTo(mx - q, my + q); g.stroke(); }
          else { g.strokeStyle = 'rgba(80,75,60,.22)'; g.lineWidth = Math.max(1.5, CS * .02); g.setLineDash([CS * .06, CS * .08]); g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); g.setLineDash([]); } }
        // the stones at the dots: red where three or four ropes meet, gold at a loose end while the rope is being laid
        for (let v = 0; v < bd.VX; v++) { const [x, y] = vxy(v), d = deg(v); g.fillStyle = d > 2 ? '#d03a2a' : '#4a4a46'; g.beginPath(); g.arc(x, y, CS * (d > 2 ? .11 : .07), 0, Math.PI * 2); g.fill(); }
        if (st.phase === 'play') { const [x, y] = vxy(bd.cur); g.strokeStyle = 'rgba(255,190,40,.95)'; g.lineWidth = 5; g.beginPath(); g.arc(x, y, CS * .2, 0, Math.PI * 2); g.stroke(); }
        if (bd.flash) { const [a, b] = bd.edgeV[bd.flash.e], [x1, y1] = vxy(a), [x2, y2] = vxy(b); g.strokeStyle = bd.flash.good ? 'rgba(47,208,96,.85)' : 'rgba(224,48,48,.85)'; g.lineWidth = CS * .1; g.lineCap = 'round'; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }
        tex.update();
      }
      function setEdge(e, v, rec) { if (e == null || bd.s[e] === v) return false; if (rec) rec.push([e, bd.s[e]]); bd.s[e] = v; return true; }
      function commit(rec) { if (!rec.length) return; bd.undo.push(rec); if (bd.undo.length > 400) bd.undo.shift(); ctx.note(rec.some(([e]) => bd.s[e] === 1) ? 520 : 700, 'lantern'); draw(); info(); check(); }
      function press(e, v) { // v: the brush; a line already in that state clears
        if (st.phase !== 'play' || e == null) return false; const want = bd.s[e] === v ? 0 : v, rec = []; setEdge(e, want, rec); bd.cur = bd.edgeV[e][0]; st.drag = { want, rec, lastV: null }; commit(rec); return true; }
      const edgeBetween = (a, b) => bd.vertE[a].find(e => bd.edgeV[e].includes(b));
      function dragToV(v) { if (!st.drag || v == null) return; const d = st.drag; if (d.lastV == null) { d.lastV = v; return; } if (v === d.lastV) return;
        const e = edgeBetween(d.lastV, v); d.lastV = v; bd.cur = v; if (e == null) return; if (setEdge(e, d.want === 0 ? 0 : d.want, d.rec)) { if (!bd.undo.includes(d.rec)) bd.undo.push(d.rec); draw(); info(); check(); } }
      function settle(i) { // a numbered square: cross the rest when the rope is all there, lay the rest when only that many lines are left
        if (st.phase !== 'play') return false; const k = bd.clues[i]; if (k < 0) { H.msg('No number here', 800); return false; }
        let on = 0, u = 0; for (const e of bd.cellE[i]) { if (bd.s[e] === 1) on++; else if (!bd.s[e]) u++; } if (!u) return false;
        const v = on === k ? 2 : on + u === k ? 1 : 0; if (!v) { H.msg('Not sure yet', 900, `${k - on} more side${k - on === 1 ? '' : 's'} among ${u}`); return false; }
        const rec = []; for (const e of bd.cellE[i]) if (!bd.s[e]) setEdge(e, v, rec); commit(rec); return true; }
      function undo() { if (st.phase !== 'play') return; const rec = bd.undo.pop(); if (!rec) return; for (let j = rec.length - 1; j >= 0; j--) bd.s[rec[j][0]] = rec[j][1]; ctx.note(330, 'lantern'); draw(); info(); }
      function restart() { if (st.phase !== 'play') return; bd.s.fill(0); bd.undo.length = 0; bd.time = 0; bd.cur = 0; bd.flash = null; st.drag = null; st.warned = ''; draw(); info(); H.msg('Start again', 900); }
      function hint() {
        if (st.phase !== 'play') return;
        let e = -1; for (let x = 0; x < bd.EN; x++) if (bd.s[x] && (bd.s[x] === 1) !== !!bd.sol[x]) { e = x; break; }
        if (e >= 0) { const rec = []; setEdge(e, 0, rec); bd.undo.push(rec); bd.hints++; bd.flash = { e, t: 0, good: false }; H.msg('This line is wrong', 1300); draw(); info(); return; }
        // a rope line next to the rope already laid (it reads on from there), else any rope line, else a cross
        let best = -1; for (let x = 0; x < bd.EN && best < 0; x++) if (!bd.s[x] && bd.sol[x] && bd.edgeV[x].some(v => deg(v) === 1)) best = x;
        for (let x = 0; x < bd.EN && best < 0; x++) if (!bd.s[x] && bd.sol[x]) best = x; for (let x = 0; x < bd.EN && best < 0; x++) if (!bd.s[x]) best = x; if (best < 0) return;
        const rec = []; setEdge(best, bd.sol[best] ? 1 : 2, rec); bd.undo.push(rec); bd.hints++; bd.flash = { e: best, t: 0, good: true }; bd.cur = bd.edgeV[best][0]; H.msg(bd.sol[best] ? 'The rope runs here' : 'No rope here', 1300); draw(); info(); check(); }
      function closedRing() { // the rope laid so far is one closed ring (every dot 0 or 2 ropes, one piece)
        const par = new Int32Array(bd.VX).map((_, i) => i), f = x => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; }; let any = false;
        for (let v = 0; v < bd.VX; v++) { const d = deg(v); if (d !== 0 && d !== 2) return false; }
        for (let e = 0; e < bd.EN; e++) if (bd.s[e] === 1) { any = true; const [a, b] = bd.edgeV[e]; par[f(a)] = f(b); }
        const roots = new Set(); for (let e = 0; e < bd.EN; e++) if (bd.s[e] === 1) roots.add(f(bd.edgeV[e][0])); return any && roots.size === 1; }
      function check() { let same = true; for (let e = 0; e < bd.EN; e++) if ((bd.s[e] === 1) !== !!bd.sol[e]) { same = false; break; }
        if (!same) { if (closedRing()) { const key = [...bd.s].map(v => v === 1 ? 1 : 0).join(''); if (key !== st.warned) { st.warned = key; H.msg('The ring is closed', 2000, 'but not every number is met'); } } return false; }
        st.phase = 'won'; st.wt = 0; st.drag = null; draw(); pads.style.display = 'none'; ctx.sound('gamewin'); H.msg('The rope is tied', 1600, fmt(bd.time));
        if (bd.k + 1 > solvedUpTo) { solvedUpTo = bd.k + 1; try { localStorage.setItem(KEY, String(solvedUpTo)); } catch (e) {} } return true; }
      const hud = document.getElementById('gameHud');
      const pick = document.createElement('div');
      pick.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(420px,92vw);background:rgba(10,20,20,.95);border:1px solid rgba(120,200,190,.6);border-radius:14px;padding:16px;text-align:center;pointer-events:auto;font:15px/1.4 system-ui,sans-serif;color:#eee';
      const drawPick = () => { pick.innerHTML = `<div style="font:800 13px/1.2 system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#8fd8cc;margin-bottom:10px">The Sacred Rope</div><div style="margin-bottom:12px;color:#bbb">Tie one closed rope along the lines. Each number counts the sides of its square the rope runs along.</div>`
        + `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">${LV.map((L, k) => { const open = k <= solvedUpTo, ok = k < solvedUpTo; return `<button type="button" data-k="${k}" ${open ? '' : 'disabled'} style="padding:8px 2px;border-radius:9px;border:1px solid ${open ? '#8fd8cc' : '#444'};background:${ok ? 'rgba(143,216,204,.18)' : 'rgba(255,255,255,.04)'};color:${open ? '#fff' : '#666'};font:700 15px system-ui,sans-serif;cursor:${open ? 'pointer' : 'default'}">${open ? `${k + 1}${ok ? ' ✓' : ''}<div style="font:500 11px system-ui;color:#a8c9c2">${L.r} × ${L.c}</div>` : `${k + 1}<div style="font:500 11px system-ui">locked</div>`}</button>`; }).join('')}</div>`
          + `<div style="margin-top:10px;font-size:12px;color:#899">Keys 1-${LV.length} pick a board</div>`;
        pick.querySelectorAll('button[data-k]').forEach(b => b.onclick = (e) => { e.stopPropagation(); b.blur(); choose(+b.dataset.k); }); };
      const pads = document.createElement('div');
      pads.style.cssText = 'position:absolute;bottom:62px;right:14px;display:none;gap:6px;pointer-events:auto';
      const padBtn = (t, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.style.cssText = 'min-width:52px;height:40px;padding:0 10px;border-radius:9px;border:1px solid #8fd8cc;background:rgba(8,22,22,.88);color:#e8fffb;font:700 15px system-ui;cursor:pointer'; b.onclick = (e) => { e.stopPropagation(); b.blur(); fn(); }; pads.appendChild(b); return b; };
      const modeBtn = padBtn('〰 Rope', () => toggleMode()); padBtn('Undo', undo); padBtn('Hint', hint);
      function toggleMode() { st.mode = st.mode === 1 ? 2 : 1; modeBtn.textContent = st.mode === 1 ? '〰 Rope' : '✕ Cross'; if (bd) info(); }
      function choose(k) { if (st.phase !== 'pick' || k > solvedUpTo || k >= LV.length) return; pick.remove(); st.phase = 'play'; build(k); pads.style.display = 'flex'; H.msg(`Board ${k + 1}`, 900, `${LV[k].name}: ${LV[k].r} × ${LV[k].c}`); }
      hud.append(pick, pads); drawPick();
      const cam = [0, TY + 6.3, -3.4], at = [0, TY, -.3];
      ctx.player.place(0, cam[2] - 1.6, 0); ctx.look(cam, at, def.fov || .8); // the player waits behind the camera, out of the picture
      { const g = tex.getContext(); g.fillStyle = '#e4dcc6'; g.fillRect(0, 0, TEX, TEX); tex.update(); }
      H.title(def.title || 'The Sacred Rope'); H.score(''); info();
      H.hint('Click a line to lay rope (<kbd>Tab</kbd> rope / cross; right click the other), drag dot to dot, click a number to settle its sides. <kbd>U</kbd> undo, <kbd>H</kbd> hint.');
      const at2 = () => { const hit = scene.pickWithRay(ctx.ray(), m => m.metadata?.srBoard); if (!hit?.pickedPoint) return null; const l = ctx.toLocal(hit.pickedPoint);
        const px = (l.x + S / 2) / S * TEX, py = (S / 2 - l.z) / S * TEX, gx = (px - bd.X0) / bd.CS, gy = (py - bd.Y0) / bd.CS, { R, C } = bd;
        const vr = Math.round(gy), vc = Math.round(gx), v = vr >= 0 && vr <= R && vc >= 0 && vc <= C && Math.hypot(gy - vr, gx - vc) < .38 ? vr * (C + 1) + vc : null;
        let e = null, dist = 9; const hr = Math.round(gy), hc = Math.floor(gx); if (hr >= 0 && hr <= R && hc >= 0 && hc < C) { const d = Math.abs(gy - hr); if (d < dist) { dist = d; e = bd.hE(hr, hc); } }
        const vc2 = Math.round(gx), vr2 = Math.floor(gy); if (vc2 >= 0 && vc2 <= C && vr2 >= 0 && vr2 < R) { const d = Math.abs(gx - vc2); if (d < dist) { dist = d; e = bd.vE(vr2, vc2); } }
        const cr = Math.floor(gy), cc = Math.floor(gx), cell = dist > .28 && cr >= 0 && cr < R && cc >= 0 && cc < C ? cr * C + cc : null;
        return { e: dist <= .28 ? e : null, v, cell }; };
      return {
        update(dt) {
          ctx.look(cam, at); st.t += dt; if (!bd) return; if (st.dirty) { st.dirty = false; paint(); }
          if (st.phase === 'play') { const s = Math.floor(bd.time); bd.time += dt; if (Math.floor(bd.time) !== s) info(); }
          if (bd.flash && (bd.flash.t += dt) > 1.6) { bd.flash = null; draw(); }
          if (st.phase === 'won' && (st.wt += dt) > 2) { st.phase = 'done'; H.hint(''); const k = bd.k;
            ctx.finish({ score: (k + 1) * 20 + (bd.hints ? 0 : 10), label: 'points', solved: true, extra: `${bd.L.name} (board ${k + 1}, ${bd.R} × ${bd.C}) tied in ${fmt(bd.time)}${bd.hints ? `, ${bd.hints} hint${bd.hints > 1 ? 's' : ''}` : ''}.${k + 1 < LV.length ? ` Board ${k + 2} is open.` : ' Every rope is tied.'}` }); }
        },
        key(e, down) {
          if (!down || e.repeat) return; const k = e.key.toLowerCase();
          if (st.phase === 'pick') { const n = k === '0' ? 10 : parseInt(k, 10); if (n >= 1 && n <= LV.length) choose(n - 1); return; } // 1-9, 0 = the tenth
          if (st.phase !== 'play') return; const C1 = bd.C + 1, r = Math.floor(bd.cur / C1), c = bd.cur % C1;
          const dirs = { arrowup: [-1, 0], w: [-1, 0], arrowdown: [1, 0], s: [1, 0], arrowleft: [0, -1], a: [0, -1], arrowright: [0, 1], d: [0, 1] };
          if (k in dirs) { const [dr, dc] = dirs[k], nr = r + dr, nc = c + dc; if (nr < 0 || nc < 0 || nr > bd.R || nc > bd.C) return; const nv = nr * C1 + nc;
            if (e.shiftKey || e.altKey) { const ed = edgeBetween(bd.cur, nv), want = e.altKey ? 2 : 1, rec = []; setEdge(ed, bd.s[ed] === want ? 0 : want, rec); bd.cur = nv; commit(rec); if (!rec.length) draw(); }
            else { bd.cur = nv; draw(); } }
          else if (k === 'u' || (k === 'z' && (e.ctrlKey || e.metaKey))) undo(); else if (k === 'h') hint(); else if (k === 'tab') { e.preventDefault?.(); toggleMode(); }
        },
        pointer(evt) {
          const T = B.PointerEventTypes; if (st.phase !== 'play' || !bd) return;
          if (evt.type === T.POINTERDOWN) { const hit = at2(); if (!hit) return; const right = evt.event && evt.event.button === 2;
            if (hit.e != null) { press(hit.e, right ? 3 - st.mode : st.mode); st.drag.lastV = hit.v; } else if (hit.cell != null) settle(hit.cell);
            else if (hit.v != null) { bd.cur = hit.v; st.drag = { want: right ? 3 - st.mode : st.mode, rec: [], lastV: hit.v }; draw(); } }
          else if (evt.type === T.POINTERMOVE && st.drag) { const hit = at2(); if (hit && hit.v != null) dragToV(hit.v); }
          else if (evt.type === T.POINTERUP) st.drag = null;
        },
        restart, // the HUD's Restart button
        _test: { st, choose, press, dragToV, settle, undo, hint, restart, toggleMode, closedRing, edgeBetween, get bd() { return bd; }, LV, draw: () => { st.dirty = false; paint(); }, end() { st.drag = null; }, unlock(k) { solvedUpTo = k; drawPick(); } },
        dispose() { pick.remove(); pads.remove(); nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); try { boardM.dispose(); tex.dispose(); } catch (e) {} }
      };
    }
  };
  window.RebelGames.register('loop', G);
})();
