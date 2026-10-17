// The Pearl Route (Oct 15, Wokou): draw one closed smugglers' route through the middle of the squares of a harbour
// chart, passing every pearl. On a black pearl the route turns, and runs straight on through the next square both
// ways; on a white pearl it runs straight through, and turns in the square just before or just after it (or both).
// Seven charts from 6 x 6 to the 9 x 9 Black Pearl Passage, each with one answer (checked by two separate solvers; the
// big ones need "what if the route ran here?" reasoning). Click between two squares to lay the route, right click to
// cross it out (Tab swaps), drag across the squares to lay a run; arrows move the cursor, Shift + arrow lays route from
// it. H hint (no clean bonus). Score: the chart x 20, +10 without a hint. def: { levels, pass, points }
// Oct 17: How to play (the rules + a solved 6 x 6, howto/pearls.png) and Restart (the chart as picked: no route,
// crosses, undo, hints or time).
(function () {
  const LEVELS = [
    { name: "The Oyster Bed", r: 6, c: 6, pearls: 'b...w....b.......w.b.......w........', loop: '111110110010000011010011001000100001110101000101010010011000' },
    { name: "The Shallow Reef", r: 6, c: 6, pearls: '........ww.......www..w.......b....b', loop: '001000000110000000000101011111001100001111111111111111100001' },
    { name: "The Smugglers' Cove", r: 7, c: 7, pearls: '.w....b........www.......b...w...w....b.....w.b..', loop: '111111101010000001100011110011011000011100100000101111110111100101100100011000100100' },
    { name: "Pearl Divers' Bay", r: 7, c: 7, pearls: '........w.b.b..w......w.b..w........w..w...ww....', loop: '111111110110110000111010001101110110111000100000100110111001011000010100100101001000' },
    { name: "The Night Run", r: 8, c: 8, pearls: '..b..w..w..b.....w...................b....w...w.w..b.w....b..w..', loop: '1011110000111000001000101000010101100001110001110101111011100010111100001111110010000100111110011111000011100010' },
    { name: "The Storm Channel", r: 8, c: 8, pearls: '.w..ww.......w............w.ww........b....w...www..........b...', loop: '1101110001011001010010001110001011000000000010001101100010110010100010001111001111100001110110111101101111101000' },
    { name: "The Black Pearl Passage", r: 9, c: 9, pearls: '...........b...w.w.w...........w.ww...w.w.ww.....w....bw..w.....w...w.w....w...w.', loop: '000000011011011000010101000110000001100001011101110110111101001111110111000000011111011001111100110111001110111100110100000001001101100100011001' }
  ];
  const G = {
    title: 'The Pearl Route',
    howTo: { lines: [
      'Draw one closed route (a loop) through the middle of the squares that passes every pearl. It never branches or crosses itself, and it need not visit every square.',
      'On a black pearl the route turns, and on both sides it runs straight on through the next square.',
      'On a white pearl the route runs straight through, and turns in the square just before or just after it (or both).',
      'Click between two squares to lay a piece of route, right click to cross that border out (Tab swaps them); drag across squares to lay a run. Arrows move the cursor, Shift + arrow lays route from it.',
      'U undoes, H fixes one piece (no clean bonus then). A pearl whose rule is broken gets a red ring.',
      'Tip: a black pearl on the edge, or one square in from it, must head away from that edge.'],
      img: 'howto/pearls.png', caption: 'A solved 6 x 6 chart: one loop, turning on each black pearl, straight through each white one.' },
    start(ctx) {
      const B = ctx.B, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const LV = def.levels || LEVELS, KEY = 'rebelAntsPearlsProgress:' + (def.id || 'pearls');
      let solvedUpTo = 0; try { solvedUpTo = Math.max(0, Math.min(LV.length, Number(localStorage.getItem(KEY)) || 0)); } catch (e) {}
      const mat = (k, c, em) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(.05, .05, .05); if (em) m.emissiveColor = new B.Color3(...em); return m; });
      const woodM = mat('table', [.3, .22, .15], [.07, .05, .035]), brassM = mat('brass', [.62, .48, .2], [.13, .1, .04]);
      const nodes = [], keep = n => { n.parent = n.parent || ctx.frame; ctx.add(n); nodes.push(n); if (n.isPickable !== undefined) n.isPickable = false; return n; };
      const TEX = 1024, tex = new B.DynamicTexture('prTex', { width: TEX, height: TEX }, scene, true); tex.hasAlpha = false;
      const boardM = new B.StandardMaterial('prBoardMat', scene); boardM.diffuseTexture = tex; boardM.emissiveTexture = tex; boardM.emissiveColor = new B.Color3(.62, .62, .62); boardM.diffuseColor = new B.Color3(.55, .55, .55); boardM.specularColor = new B.Color3(0, 0, 0);
      const S = 4.4, TY = .95;
      { const t = keep(B.MeshBuilder.CreateBox('prTable', { width: S + .5, height: .14, depth: S + .5 }, scene)); t.material = woodM; t.position.y = TY - .07;
        for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const l = keep(B.MeshBuilder.CreateBox('prLeg', { width: .16, height: TY - .14, depth: .16 }, scene)); l.material = woodM; l.position.set(x * (S / 2), (TY - .14) / 2, z * (S / 2)); }
        for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const w = keep(B.MeshBuilder.CreateCylinder('prWeight', { diameter: .2, height: .07, tessellation: 12 }, scene)); w.material = brassM; w.position.set(x * (S / 2 - .06), TY + .035, z * (S / 2 - .06)); } } // chart weights
      const board = keep(B.MeshBuilder.CreateGround('prBoard', { width: S, height: S }, scene)); board.material = boardM; board.position.y = TY + .005; board.isPickable = true; board.metadata = { prBoard: true };
      let bd = null; // { k, L, R, C, HN, EN, s: Int8Array (0 ?, 1 route, 2 cross), sol, pearl, cellE (L R U D, -1 at the edge), edgeC, hints, time, cur (square), undo: [], flash, X0, Y0, CS }
      const st = { phase: 'pick', t: 0, mode: 1, drag: null, warned: '' };
      const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
      function build(k) {
        const L = LV[k], R = L.r, C = L.c, HN = R * (C - 1), EN = HN + (R - 1) * C;
        const hE = (r, c) => r * (C - 1) + c, vE = (r, c) => HN + r * C + c; // hE joins (r, c)-(r, c + 1), vE joins (r, c)-(r + 1, c)
        const cellE = [], edgeC = new Array(EN);
        for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) cellE.push([c > 0 ? hE(r, c - 1) : -1, c < C - 1 ? hE(r, c) : -1, r > 0 ? vE(r - 1, c) : -1, r < R - 1 ? vE(r, c) : -1]);
        for (let r = 0; r < R; r++) for (let c = 0; c < C - 1; c++) edgeC[hE(r, c)] = [r * C + c, r * C + c + 1];
        for (let r = 0; r < R - 1; r++) for (let c = 0; c < C; c++) edgeC[vE(r, c)] = [r * C + c, (r + 1) * C + c];
        const CS = Math.min((TEX - 110) / C, (TEX - 110) / R), X0 = (TEX - CS * C) / 2, Y0 = (TEX - CS * R) / 2;
        bd = { k, L, R, C, HN, EN, hE, vE, s: new Int8Array(EN), sol: Uint8Array.from(L.loop, ch => ch === '1' ? 1 : 0), pearl: Int8Array.from(L.pearls, ch => ch === 'w' ? 1 : ch === 'b' ? 2 : 0),
          cellE, edgeC, hints: 0, time: 0, cur: Math.floor(R / 2) * C + Math.floor(C / 2), undo: [], flash: null, X0, Y0, CS }; st.warned = '';
        draw(); info();
      }
      const routeCount = () => { let n = 0; for (const v of bd.s) if (v === 1) n++; return n; };
      const deg = i => { let d = 0; for (const e of bd.cellE[i]) if (e >= 0 && bd.s[e] === 1) d++; return d; };
      const info = () => H.info(bd ? `Chart ${bd.k + 1} / ${LV.length} · ${bd.L.name} · ${bd.R} × ${bd.C} · route ${routeCount()} · ${fmt(bd.time)} · brush ${st.mode === 1 ? 'route' : 'cross'}${bd.hints ? ` · hints ${bd.hints}` : ''}` : 'Pick a chart');
      const cxy = i => [bd.X0 + (i % bd.C + .5) * bd.CS, bd.Y0 + (Math.floor(i / bd.C) + .5) * bd.CS];
      const nbr = (i, d) => { const r = Math.floor(i / bd.C) + [0, 0, -1, 1][d], c = i % bd.C + [-1, 1, 0, 0][d]; return r >= 0 && c >= 0 && r < bd.R && c < bd.C ? r * bd.C + c : -1; };
      const ev = e => (e < 0 ? 2 : bd.s[e]); // the chart's edge counts as crossed out
      const onE = e => ev(e) === 1, offE = e => ev(e) === 2;
      const turnsAt = i => { const E = bd.cellE[i]; return (onE(E[0]) || onE(E[1])) && (onE(E[2]) || onE(E[3])); };
      // a pearl: 'bad' when what is drawn already breaks its rule, 'ok' when it is met, '' while it is open
      function pearlState(i) {
        const p = bd.pearl[i]; if (!p) return ''; const E = bd.cellE[i]; let n1 = 0, nu = 0; for (const e of E) { if (onE(e)) n1++; else if (ev(e) === 0) nu++; }
        if (n1 > 2 || n1 + nu < 2) return 'bad';
        if (p === 2) { // black: turns, and each way runs straight on through the next square
          if ((onE(E[0]) && onE(E[1])) || (onE(E[2]) && onE(E[3]))) return 'bad'; let met = n1 === 2;
          for (let d = 0; d < 4; d++) { if (!onE(E[d])) continue; const j = nbr(i, d), cont = bd.cellE[j][d]; if (offE(cont)) return 'bad'; if (!onE(cont)) met = false; }
          return met ? 'ok' : ''; }
        if (turnsAt(i)) return 'bad'; // white: straight through, and a turn just before or after
        for (const [a, b] of [[0, 1], [2, 3]]) { if ((onE(E[a]) && offE(E[b])) || (onE(E[b]) && offE(E[a]))) return 'bad';
          if (onE(E[a]) && onE(E[b])) { const ja = nbr(i, a), jb = nbr(i, b); if (onE(bd.cellE[ja][a]) && onE(bd.cellE[jb][b])) return 'bad'; return turnsAt(ja) || turnsAt(jb) ? 'ok' : ''; } }
        return ''; }
      const draw = () => { st.dirty = true; }; // changes are painted once per frame (one texture upload)
      function paint() {
        const g = tex.getContext(), { R, C, CS, X0, Y0 } = bd, won = st.phase === 'won' || st.phase === 'done';
        g.fillStyle = '#e6d6ad'; g.fillRect(0, 0, TEX, TEX); // the chart's paper
        g.strokeStyle = 'rgba(60,110,130,.16)'; g.lineWidth = 3; for (let y = 18; y < TEX; y += 26) { g.beginPath(); for (let x = 0; x <= TEX; x += 24) { const yy = y + Math.sin(x * .035 + y * .7) * 4; if (x) g.lineTo(x, yy); else g.moveTo(x, yy); } g.stroke(); } // the sea's waves
        const grd = g.createRadialGradient(TEX / 2, TEX / 2, TEX * .25, TEX / 2, TEX / 2, TEX * .75); grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(90,60,25,.32)'); g.fillStyle = grd; g.fillRect(0, 0, TEX, TEX);
        g.strokeStyle = 'rgba(70,50,25,.8)'; g.lineWidth = 4; g.strokeRect(X0 - 14, Y0 - 14, CS * C + 28, CS * R + 28); g.lineWidth = 1.5; g.strokeRect(X0 - 22, Y0 - 22, CS * C + 44, CS * R + 44); // the chart's frame
        g.strokeStyle = 'rgba(70,50,25,.32)'; g.lineWidth = 2; g.beginPath(); for (let c = 0; c <= C; c++) { g.moveTo(X0 + c * CS, Y0); g.lineTo(X0 + c * CS, Y0 + R * CS); } for (let r = 0; r <= R; r++) { g.moveTo(X0, Y0 + r * CS); g.lineTo(X0 + C * CS, Y0 + r * CS); } g.stroke();
        for (let i = 0; i < R * C; i++) if (!bd.pearl[i]) { const [x, y] = cxy(i); g.fillStyle = 'rgba(70,50,25,.22)'; g.beginPath(); g.arc(x, y, CS * .045, 0, Math.PI * 2); g.fill(); } // where the route can pass
        // the route: rust red rope (gold when it is right), crosses at the borders it cannot pass
        g.lineCap = 'round'; g.lineJoin = 'round';
        for (let pass = 0; pass < 2; pass++) for (let e = 0; e < bd.EN; e++) { if (bd.s[e] !== 1) continue; const [a, b] = bd.edgeC[e], [x1, y1] = cxy(a), [x2, y2] = cxy(b);
          g.strokeStyle = pass ? (won ? '#f3cf62' : '#b44a2c') : 'rgba(60,25,10,.85)'; g.lineWidth = CS * (pass ? .13 : .19); g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }
        for (let e = 0; e < bd.EN; e++) { if (bd.s[e] !== 2) continue; const [a, b] = bd.edgeC[e], [x1, y1] = cxy(a), [x2, y2] = cxy(b), mx = (x1 + x2) / 2, my = (y1 + y2) / 2, q = CS * .09;
          g.strokeStyle = 'rgba(60,45,30,.85)'; g.lineWidth = Math.max(2, CS * .035); g.beginPath(); g.moveTo(mx - q, my - q); g.lineTo(mx + q, my + q); g.moveTo(mx + q, my - q); g.lineTo(mx - q, my + q); g.stroke(); }
        // the pearls: faded once met, a red ring when broken; a red dot where three or four ways meet
        for (let i = 0; i < R * C; i++) { const [x, y] = cxy(i), p = bd.pearl[i];
          if (!p) { if (deg(i) > 2) { g.fillStyle = '#d03a2a'; g.beginPath(); g.arc(x, y, CS * .12, 0, Math.PI * 2); g.fill(); } continue; }
          const ps = pearlState(i), rad = CS * .27; g.globalAlpha = ps === 'ok' && !won ? .55 : 1;
          const pg = g.createRadialGradient(x - rad * .35, y - rad * .4, rad * .1, x, y, rad);
          if (p === 1) { pg.addColorStop(0, '#ffffff'); pg.addColorStop(.7, '#ece7dc'); pg.addColorStop(1, '#bdb6a8'); } else { pg.addColorStop(0, '#8a8aa0'); pg.addColorStop(.45, '#2a2a36'); pg.addColorStop(1, '#0b0b10'); }
          g.fillStyle = pg; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill(); g.strokeStyle = p === 1 ? 'rgba(70,60,45,.9)' : '#000'; g.lineWidth = Math.max(2, CS * .03); g.stroke();
          g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.arc(x - rad * .35, y - rad * .38, rad * .16, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
          if (ps === 'bad') { g.strokeStyle = '#d0302a'; g.lineWidth = Math.max(3, CS * .05); g.beginPath(); g.arc(x, y, rad + CS * .07, 0, Math.PI * 2); g.stroke(); } }
        if (st.phase === 'play') { const [x, y] = cxy(bd.cur); g.strokeStyle = 'rgba(255,190,40,.95)'; g.lineWidth = 5; g.strokeRect(x - CS * .44, y - CS * .44, CS * .88, CS * .88); }
        if (bd.flash) { const [a, b] = bd.edgeC[bd.flash.e], [x1, y1] = cxy(a), [x2, y2] = cxy(b); g.strokeStyle = bd.flash.good ? 'rgba(47,208,96,.85)' : 'rgba(224,48,48,.85)'; g.lineWidth = CS * .1; g.lineCap = 'round'; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }
        tex.update();
      }
      function setEdge(e, v, rec) { if (e == null || e < 0 || bd.s[e] === v) return false; if (rec) rec.push([e, bd.s[e]]); bd.s[e] = v; return true; }
      function commit(rec) { if (!rec.length) return; bd.undo.push(rec); if (bd.undo.length > 400) bd.undo.shift(); ctx.note(rec.some(([e]) => bd.s[e] === 1) ? 520 : 700, 'lantern'); draw(); info(); check(); }
      function press(e, v) { // v: the brush; a border already in that state clears
        if (st.phase !== 'play' || e == null) return false; const want = bd.s[e] === v ? 0 : v, rec = []; setEdge(e, want, rec); st.drag = { want, rec, lastC: null }; commit(rec); return true; }
      const edgeBetween = (a, b) => { for (let d = 0; d < 4; d++) if (nbr(a, d) === b) return bd.cellE[a][d]; return null; };
      function dragToCell(i) { if (!st.drag || i == null) return; const d = st.drag; if (d.lastC == null) { d.lastC = i; bd.cur = i; draw(); return; } if (i === d.lastC) return;
        // a fast drag can skip squares: fill the run along a row or column
        const C = bd.C, a = d.lastC, ra = Math.floor(a / C), ca = a % C, rb = Math.floor(i / C), cb = i % C, path = [];
        if (ra === rb) { const step = cb > ca ? 1 : -1; for (let c = ca; c !== cb; c += step) path.push(edgeBetween(ra * C + c, ra * C + c + step)); }
        else if (ca === cb) { const step = rb > ra ? 1 : -1; for (let r = ra; r !== rb; r += step) path.push(edgeBetween(r * C + ca, (r + step) * C + ca)); }
        d.lastC = i; bd.cur = i; let ch = false; for (const e of path) if (setEdge(e, d.want, d.rec)) ch = true;
        if (ch) { if (!bd.undo.includes(d.rec)) bd.undo.push(d.rec); ctx.note(d.want === 1 ? 520 : 700, 'lantern'); info(); check(); } draw(); }
      function undo() { if (st.phase !== 'play') return; const rec = bd.undo.pop(); if (!rec) return; for (let j = rec.length - 1; j >= 0; j--) bd.s[rec[j][0]] = rec[j][1]; ctx.note(330, 'lantern'); draw(); info(); }
      // Restart (the button beside Quit): the chart as it was picked (no route or crosses; no undo, hints or time), kept
      // in the same board object (the tests hold it); only while it is being played
      function restart() { if (st.phase !== 'play' || !bd) return; const b = bd; build(b.k); bd = Object.assign(b, bd); st.drag = null; H.msg('Start again', 900); }
      function hint() {
        if (st.phase !== 'play') return;
        let e = -1; for (let x = 0; x < bd.EN; x++) if (bd.s[x] && (bd.s[x] === 1) !== !!bd.sol[x]) { e = x; break; }
        if (e >= 0) { const rec = []; setEdge(e, 0, rec); bd.undo.push(rec); bd.hints++; bd.flash = { e, t: 0, good: false }; H.msg('This part is wrong', 1300); draw(); info(); return; }
        // the route on from a loose end, else at a pearl, else anywhere, else a cross
        let best = -1; for (let x = 0; x < bd.EN && best < 0; x++) if (!bd.s[x] && bd.sol[x] && bd.edgeC[x].some(i => deg(i) === 1)) best = x;
        for (let x = 0; x < bd.EN && best < 0; x++) if (!bd.s[x] && bd.sol[x] && bd.edgeC[x].some(i => bd.pearl[i])) best = x;
        for (let x = 0; x < bd.EN && best < 0; x++) if (!bd.s[x] && bd.sol[x]) best = x; for (let x = 0; x < bd.EN && best < 0; x++) if (!bd.s[x]) best = x; if (best < 0) return;
        const rec = []; setEdge(best, bd.sol[best] ? 1 : 2, rec); bd.undo.push(rec); bd.hints++; bd.flash = { e: best, t: 0, good: true }; bd.cur = bd.edgeC[best][0]; H.msg(bd.sol[best] ? 'The route runs here' : 'No route here', 1300); draw(); info(); check(); }
      function closedRoute() { // what is drawn is one closed route (every square 0 or 2 ways, one piece)
        const N = bd.R * bd.C, par = new Int32Array(N).map((_, i) => i), f = x => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; }; let any = false;
        for (let i = 0; i < N; i++) { const d = deg(i); if (d !== 0 && d !== 2) return false; }
        for (let e = 0; e < bd.EN; e++) if (bd.s[e] === 1) { any = true; const [a, b] = bd.edgeC[e]; par[f(a)] = f(b); }
        const roots = new Set(); for (let e = 0; e < bd.EN; e++) if (bd.s[e] === 1) roots.add(f(bd.edgeC[e][0])); return any && roots.size === 1; }
      function check() { let same = true; for (let e = 0; e < bd.EN; e++) if ((bd.s[e] === 1) !== !!bd.sol[e]) { same = false; break; }
        if (!same) { if (closedRoute()) { const key = [...bd.s].map(v => v === 1 ? 1 : 0).join(''); if (key !== st.warned) { st.warned = key; H.msg('The route is closed', 2000, 'but not every pearl is met'); } } return false; }
        st.phase = 'won'; st.wt = 0; st.drag = null; draw(); pads.style.display = 'none'; ctx.sound('gamewin'); H.msg('The route is sailed', 1600, fmt(bd.time));
        if (bd.k + 1 > solvedUpTo) { solvedUpTo = bd.k + 1; try { localStorage.setItem(KEY, String(solvedUpTo)); } catch (e) {} } return true; }
      const hud = document.getElementById('gameHud');
      const pick = document.createElement('div');
      pick.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(430px,92vw);background:rgba(12,18,26,.95);border:1px solid rgba(214,178,96,.6);border-radius:14px;padding:16px;text-align:center;pointer-events:auto;font:15px/1.4 system-ui,sans-serif;color:#eee';
      const drawPick = () => { pick.innerHTML = `<div style="font:800 13px/1.2 system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#e2c27a;margin-bottom:10px">The Pearl Route</div><div style="margin-bottom:12px;color:#bbb">Draw one closed route through the squares that passes every pearl. Black: the route turns on it, then runs straight on both ways. White: straight through, turning just before or after.</div>`
        + `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">${LV.map((L, k) => { const open = k <= solvedUpTo, ok = k < solvedUpTo; return `<button type="button" data-k="${k}" ${open ? '' : 'disabled'} style="padding:8px 2px;border-radius:9px;border:1px solid ${open ? '#e2c27a' : '#444'};background:${ok ? 'rgba(226,194,122,.18)' : 'rgba(255,255,255,.04)'};color:${open ? '#fff' : '#666'};font:700 15px system-ui,sans-serif;cursor:${open ? 'pointer' : 'default'}">${open ? `${k + 1}${ok ? ' ✓' : ''}<div style="font:500 11px system-ui;color:#cdbf9a">${L.r} × ${L.c}</div>` : `${k + 1}<div style="font:500 11px system-ui">locked</div>`}</button>`; }).join('')}</div>`
          + `<div style="margin-top:10px;font-size:12px;color:#998">Keys 1-${LV.length} pick a chart</div>`;
        pick.querySelectorAll('button[data-k]').forEach(b => b.onclick = (e) => { e.stopPropagation(); b.blur(); choose(+b.dataset.k); }); };
      const pads = document.createElement('div');
      pads.style.cssText = 'position:absolute;bottom:62px;right:14px;display:none;gap:6px;pointer-events:auto';
      const padBtn = (t, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.style.cssText = 'min-width:52px;height:40px;padding:0 10px;border-radius:9px;border:1px solid #e2c27a;background:rgba(18,16,10,.88);color:#fff6e0;font:700 15px system-ui;cursor:pointer'; b.onclick = (e) => { e.stopPropagation(); b.blur(); fn(); }; pads.appendChild(b); return b; };
      const modeBtn = padBtn('〰 Route', () => toggleMode()); padBtn('Undo', undo); padBtn('Hint', hint);
      function toggleMode() { st.mode = st.mode === 1 ? 2 : 1; modeBtn.textContent = st.mode === 1 ? '〰 Route' : '✕ Cross'; if (bd) info(); }
      function choose(k) { if (st.phase !== 'pick' || k > solvedUpTo || k >= LV.length) return; pick.remove(); st.phase = 'play'; build(k); pads.style.display = 'flex'; H.msg(`Chart ${k + 1}`, 900, `${LV[k].name}: ${LV[k].r} × ${LV[k].c}`); }
      hud.append(pick, pads); drawPick();
      const cam = [0, TY + 6.3, -3.4], at = [0, TY, -.3];
      ctx.player.place(0, -(S / 2 + 1.6), 0); // on the camera's side of the table, out of the picture
      ctx.look(cam, at, def.fov || .8);
      { const g = tex.getContext(); g.fillStyle = '#e6d6ad'; g.fillRect(0, 0, TEX, TEX); tex.update(); }
      H.title(def.title || 'The Pearl Route'); H.score(''); info();
      H.hint('Click between two squares to lay the route (<kbd>Tab</kbd> route / cross; right click the other), drag across squares to lay a run. <kbd>U</kbd> undo, <kbd>H</kbd> hint.');
      const at2 = () => { const hit = scene.pickWithRay(ctx.ray(), m => m.metadata?.prBoard); if (!hit?.pickedPoint) return null; const l = ctx.toLocal(hit.pickedPoint);
        const px = (l.x + S / 2) / S * TEX, py = (S / 2 - l.z) / S * TEX, gx = (px - bd.X0) / bd.CS, gy = (py - bd.Y0) / bd.CS, { R, C } = bd;
        const cr = Math.floor(gy), cc = Math.floor(gx), cell = cr >= 0 && cr < R && cc >= 0 && cc < C ? cr * C + cc : null;
        // the nearest border between two squares, by its middle: (c + 1, r + .5) joins (r, c)-(r, c + 1), (c + .5, r + 1) joins (r, c)-(r + 1, c)
        let e = null, dist = 9;
        { const c = Math.round(gx) - 1, r = Math.floor(gy); if (c >= 0 && c < C - 1 && r >= 0 && r < R) { const d = Math.hypot(gx - (c + 1), gy - (r + .5)); if (d < dist) { dist = d; e = bd.hE(r, c); } } }
        { const r = Math.round(gy) - 1, c = Math.floor(gx); if (r >= 0 && r < R - 1 && c >= 0 && c < C) { const d = Math.hypot(gx - (c + .5), gy - (r + 1)); if (d < dist) { dist = d; e = bd.vE(r, c); } } }
        return { e: dist < .34 ? e : null, cell }; };
      return {
        update(dt) {
          ctx.look(cam, at); st.t += dt; if (!bd) return; if (st.dirty) { st.dirty = false; paint(); }
          if (st.phase === 'play') { const s = Math.floor(bd.time); bd.time += dt; if (Math.floor(bd.time) !== s) info(); }
          if (bd.flash && (bd.flash.t += dt) > 1.6) { bd.flash = null; draw(); }
          if (st.phase === 'won' && (st.wt += dt) > 2) { st.phase = 'done'; H.hint(''); const k = bd.k;
            ctx.finish({ score: (k + 1) * 20 + (bd.hints ? 0 : 10), label: 'points', solved: true, extra: `${bd.L.name} (chart ${k + 1}, ${bd.R} × ${bd.C}) sailed in ${fmt(bd.time)}${bd.hints ? `, ${bd.hints} hint${bd.hints > 1 ? 's' : ''}` : ''}.${k + 1 < LV.length ? ` Chart ${k + 2} is open.` : ' Every route is sailed.'}` }); }
        },
        key(e, down) {
          if (!down || e.repeat) return; const k = e.key.toLowerCase();
          if (st.phase === 'pick') { const n = k === '0' ? 10 : parseInt(k, 10); if (n >= 1 && n <= LV.length) choose(n - 1); return; } // 1-9, 0 = the tenth
          if (st.phase !== 'play') return; const C = bd.C, r = Math.floor(bd.cur / C), c = bd.cur % C;
          const dirs = { arrowup: [-1, 0], w: [-1, 0], arrowdown: [1, 0], s: [1, 0], arrowleft: [0, -1], a: [0, -1], arrowright: [0, 1], d: [0, 1] };
          if (k in dirs) { const [dr, dc] = dirs[k], nr = r + dr, nc = c + dc; if (nr < 0 || nc < 0 || nr >= bd.R || nc >= C) return; const ni = nr * C + nc;
            if (e.shiftKey || e.altKey) { const ed = edgeBetween(bd.cur, ni), want = e.altKey ? 2 : 1, rec = []; setEdge(ed, bd.s[ed] === want ? 0 : want, rec); bd.cur = ni; commit(rec); if (!rec.length) draw(); }
            else { bd.cur = ni; draw(); } }
          else if (k === 'u' || (k === 'z' && (e.ctrlKey || e.metaKey))) undo(); else if (k === 'h') hint(); else if (k === 'tab') { e.preventDefault?.(); toggleMode(); }
        },
        pointer(evt) {
          const T = B.PointerEventTypes; if (st.phase !== 'play' || !bd) return;
          if (evt.type === T.POINTERDOWN) { const hit = at2(); if (!hit) return; const right = evt.event && evt.event.button === 2;
            if (hit.e != null) { press(hit.e, right ? 3 - st.mode : st.mode); st.drag.lastC = hit.cell; }
            else if (hit.cell != null) { bd.cur = hit.cell; st.drag = { want: right ? 3 - st.mode : st.mode, rec: [], lastC: hit.cell }; draw(); } }
          else if (evt.type === T.POINTERMOVE && st.drag) { const hit = at2(); if (hit && hit.cell != null) dragToCell(hit.cell); }
          else if (evt.type === T.POINTERUP) st.drag = null;
        },
        restart,
        _test: { st, choose, press, dragToCell, undo, hint, restart, toggleMode, closedRoute, edgeBetween, pearlState, get bd() { return bd; }, LV, draw: () => { st.dirty = false; paint(); }, end() { st.drag = null; }, unlock(k) { solvedUpTo = k; drawPick(); } },
        dispose() { pick.remove(); pads.remove(); nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); try { boardM.dispose(); tex.dispose(); } catch (e) {} }
      };
    }
  };
  window.RebelGames.register('pearls', G);
})();
