// The Fleet Chart (Oct 15, Wokou): an enemy fleet hides on the sea chart. The numbers beside each row and under each
// column say how many squares of ship lie in that line; ships are straight, and no two touch, not even at a corner.
// Some squares are given (a ship's bow, stern, middle, a lone boat, or open water). Mark water and ship until the whole
// fleet is found. Seven charts from 6 x 6 to the 10 x 10 Admiral's Chart, each with one answer and no guess needed
// (checked by a solver; the hard ones need "what if this were a ship?" reasoning). Click marks with the brush (Tab
// switches water / ship, right click the other one), drag paints, a click on a line's number fills it when it is sure.
// H hint (no clean bonus). Score: the chart x 20, +10 without a hint.
// def: { levels, pass, points }
(function () {
  const LEVELS = [
    { name: "The Cove", n: 6, fleet: [3,2,2,1,1,1], rows: [0,4,1,1,1,3], cols: [1,2,2,1,3,1], sol: '000000010111010000000010001000101010', hints: [[7,'t'],[26,'t']] },
    { name: "Shoals", n: 6, fleet: [3,2,2,1,1,1], rows: [1,2,1,2,3,1], cols: [0,3,0,4,1,2], sol: '010000000110010000000101010101000100', hints: [] },
    { name: "The Strait", n: 7, fleet: [4,3,2,2,1,1], rows: [2,0,2,3,2,4,0], cols: [0,3,0,5,0,3,2], sol: '0001001000000000010100101010010100001010110000000', hints: [[31,'m']] },
    { name: "The Bay", n: 8, fleet: [4,3,3,2,2,1,1,1], rows: [4,3,3,1,1,2,3,0], cols: [0,5,0,2,3,2,2,3], sol: '0101010101010001010001010100000000001000000010100100101000000000', hints: [[11,'b'],[17,'m']] },
    { name: "Open Water", n: 8, fleet: [4,3,3,2,2,1,1,1], rows: [0,4,1,4,1,3,2,2], cols: [1,4,1,5,1,0,4,1], sol: '0000000010110010000000100101101001000000010100100101000000010001', hints: [[63,'o']] },
    { name: "The Armada", n: 10, fleet: [4,3,3,2,2,2,1,1,1,1], rows: [2,1,4,2,3,0,3,2,3,0], cols: [3,4,0,1,2,4,3,0,1,2], sol: '1000010000000001000001010100010100010000010000001100000000001000101000000010100011000010000000000000', hints: [[23,'o'],[48,'l'],[64,'t']] },
    { name: "The Admiral's Chart", n: 10, fleet: [4,3,3,2,2,2,1,1,1,1], rows: [1,4,0,2,1,4,3,2,3,0], cols: [1,5,1,1,2,1,2,3,3,1], sol: '0100000000010001110000000000000000101000000000001011110000000000000111010010000001000001100000000000', hints: [[15,'l'],[34,'o'],[48,'o']] }
  ];
  const G = {
    title: 'The Fleet Chart',
    start(ctx) {
      const B = ctx.B, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const LV = def.levels || LEVELS, KEY = 'rebelAntsFleetProgress:' + (def.id || 'fleet');
      let solvedUpTo = 0; try { solvedUpTo = Math.max(0, Math.min(LV.length, Number(localStorage.getItem(KEY)) || 0)); } catch (e) {}
      const mat = (k, c, em) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(.05, .05, .05); if (em) m.emissiveColor = new B.Color3(...em); return m; });
      const woodM = mat('table', [.36, .22, .12], [.08, .05, .03]), brassM = mat('brass', [.75, .58, .25], [.2, .15, .05]);
      const nodes = [], keep = n => { n.parent = n.parent || ctx.frame; ctx.add(n); nodes.push(n); if (n.isPickable !== undefined) n.isPickable = false; return n; };
      const TEX = 1024, tex = new B.DynamicTexture('flTex', { width: TEX, height: TEX }, scene, true); tex.hasAlpha = false;
      const boardM = new B.StandardMaterial('flBoardMat', scene); boardM.diffuseTexture = tex; boardM.emissiveTexture = tex; boardM.emissiveColor = new B.Color3(.62, .62, .62); boardM.diffuseColor = new B.Color3(.55, .55, .55); boardM.specularColor = new B.Color3(0, 0, 0);
      const S = 4.4, TY = .95;
      { const t = keep(B.MeshBuilder.CreateBox('flTable', { width: S + .5, height: .14, depth: S + .5 }, scene)); t.material = woodM; t.position.y = TY - .07;
        for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const l = keep(B.MeshBuilder.CreateBox('flLeg', { width: .16, height: TY - .14, depth: .16 }, scene)); l.material = woodM; l.position.set(x * (S / 2), (TY - .14) / 2, z * (S / 2)); }
        for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const w = keep(B.MeshBuilder.CreateCylinder('flWeight', { diameter: .16, height: .1, tessellation: 12 }, scene)); w.material = brassM; w.position.set(x * (S / 2 - .05), TY + .05, z * (S / 2 - .05)); } }
      const board = keep(B.MeshBuilder.CreateGround('flBoard', { width: S, height: S }, scene)); board.material = boardM; board.position.y = TY + .005; board.isPickable = true; board.metadata = { flBoard: true };
      // texture layout: grid from (M, M), GS square; row numbers on the right, column numbers below
      const M = 36, CW = 96, GAP = 12, GS = TEX - M - CW - GAP;
      let bd = null; // { k, n, L, mark: Int8Array (0 ?, 1 water, 2 ship), given: [], hints, time, cur, undo: [], flash }
      const st = { phase: 'pick', t: 0, mode: 1, drag: null };
      const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
      function build(k) {
        const L = LV[k], n = L.n; bd = { k, n, L, mark: new Int8Array(n * n), given: new Array(n * n).fill(null), hints: 0, time: 0, cur: 0, undo: [], flash: null };
        for (const [i, t] of L.hints) { bd.given[i] = t; bd.mark[i] = t === 'w' ? 1 : 2; }
        ctx.player.place(0, cam[2] - 1.6, 0); draw(); info(); fleetPanel();
      }
      const lineCount = (kind, a) => { const n = bd.n; let s = 0, u = 0; for (let b = 0; b < n; b++) { const v = bd.mark[kind ? b * n + a : a * n + b]; if (v === 2) s++; else if (!v) u++; } return { s, u, need: kind ? bd.L.cols[a] : bd.L.rows[a] }; };
      // finished ships in the marks: straight runs closed by water or the edge (a lone square closed on all four sides)
      function finished() { const n = bd.n, m = bd.mark, at = (r, c) => (r < 0 || c < 0 || r >= n || c >= n) ? 1 : m[r * n + c], out = {};
        for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) { if (at(r, c) !== 2) continue;
          if (at(r, c - 1) !== 2 && at(r, c + 1) !== 2 && at(r - 1, c) !== 2 && at(r + 1, c) !== 2) { if (at(r, c - 1) === 1 && at(r, c + 1) === 1 && at(r - 1, c) === 1 && at(r + 1, c) === 1) out[1] = (out[1] || 0) + 1; continue; }
          if (at(r, c - 1) !== 2 && at(r, c + 1) === 2) { let e = c; while (at(r, e + 1) === 2) e++; if (at(r, c - 1) === 1 && at(r, e + 1) === 1) out[e - c + 1] = (out[e - c + 1] || 0) + 1; }
          if (at(r - 1, c) !== 2 && at(r + 1, c) === 2) { let e = r; while (at(e + 1, c) === 2) e++; if (at(r - 1, c) === 1 && at(e + 1, c) === 1) out[e - r + 1] = (out[e - r + 1] || 0) + 1; } }
        return out; }
      const info = () => H.info(bd ? `Chart ${bd.k + 1} / ${LV.length} · ${bd.L.name} · ${bd.n} × ${bd.n} · ${fmt(bd.time)} · brush ${st.mode === 1 ? 'water' : 'ship'}${bd.hints ? ` · hints ${bd.hints}` : ''}` : 'Pick a chart');
      function draw() {
        const g = tex.getContext(), n = bd.n, C = GS / n, m = bd.mark, won = st.phase === 'won' || st.phase === 'done';
        g.fillStyle = '#e6d6aa'; g.fillRect(0, 0, TEX, TEX);
        const grd = g.createRadialGradient(TEX / 2, TEX / 2, TEX * .2, TEX / 2, TEX / 2, TEX * .75); grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(90,60,20,.35)'); g.fillStyle = grd; g.fillRect(0, 0, TEX, TEX);
        const at = (r, c) => (r < 0 || c < 0 || r >= n || c >= n) ? 1 : (won && !m[r * n + c] ? 1 : m[r * n + c]);
        for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) { const i = r * n + c, x = M + c * C, y = M + r * C, v = at(r, c), gv = bd.given[i];
          if (v === 0) { g.fillStyle = (r + c) % 2 ? '#dccb9c' : '#d6c494'; g.fillRect(x, y, C, C); continue; }
          g.fillStyle = gv ? '#5d93b5' : '#79afd0'; g.fillRect(x, y, C, C);
          if (v === 1) { g.strokeStyle = gv ? 'rgba(255,255,255,.75)' : 'rgba(255,255,255,.55)'; g.lineWidth = Math.max(2, C * .045); for (const yy of [.38, .62]) { g.beginPath(); for (let t = 0; t <= 1.001; t += .125) { const px = x + C * (.2 + .6 * t), py = y + C * yy + Math.sin(t * Math.PI * 2) * C * .05; t ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke(); } continue; }
          // a ship square: joined toward ship neighbours, rounded toward water or the edge, square toward the unknown
          let L = at(r, c - 1), R = at(r, c + 1), T = at(r - 1, c), Bt = at(r + 1, c);
          if (gv && gv !== 'w') { L = gv === 'r' || (gv === 'm' && (at(r, c - 1) === 2 || at(r, c + 1) === 2 || at(r - 1, c) === 1)) ? 2 : (gv === 'm' ? 1 : 1); R = gv === 'l' || (gv === 'm' && L === 2) ? 2 : 1; T = gv === 'b' || (gv === 'm' && L !== 2) ? 2 : 1; Bt = gv === 't' || (gv === 'm' && L !== 2) ? 2 : 1;
            if (gv === 'l' || gv === 'r') { T = 1; Bt = 1; } if (gv === 't' || gv === 'b') { L = 1; R = 1; } if (gv === 'o') { L = R = T = Bt = 1; } }
          const p = C * .14, x0 = L === 2 ? x : x + p, x1 = R === 2 ? x + C : x + C - p, y0 = T === 2 ? y : y + p, y1 = Bt === 2 ? y + C : y + C - p;
          const rad = C * .36, rl = L === 1, rr = R === 1, rt = T === 1, rb = Bt === 1;
          g.fillStyle = gv ? '#3b2412' : '#5a3a20'; g.beginPath();
          const tl = rl && rt ? rad : 0, tr = rr && rt ? rad : 0, br = rr && rb ? rad : 0, bl = rl && rb ? rad : 0;
          g.moveTo(x0 + tl, y0); g.lineTo(x1 - tr, y0); tr ? g.quadraticCurveTo(x1, y0, x1, y0 + tr) : 0; g.lineTo(x1, y1 - br); br ? g.quadraticCurveTo(x1, y1, x1 - br, y1) : 0; g.lineTo(x0 + bl, y1); bl ? g.quadraticCurveTo(x0, y1, x0, y1 - bl) : 0; g.lineTo(x0, y0 + tl); tl ? g.quadraticCurveTo(x0, y0, x0 + tl, y0) : 0; g.closePath(); g.fill();
          g.fillStyle = gv ? 'rgba(240,200,100,.55)' : 'rgba(255,230,180,.22)'; g.fillRect(x + C * .44, y + C * .44, C * .12, C * .12); }
        g.strokeStyle = 'rgba(60,40,20,.55)'; g.lineWidth = 2; for (let a = 0; a <= n; a++) { g.beginPath(); g.moveTo(M + a * C, M); g.lineTo(M + a * C, M + GS); g.stroke(); g.beginPath(); g.moveTo(M, M + a * C); g.lineTo(M + GS, M + a * C); g.stroke(); }
        g.lineWidth = 5; g.strokeRect(M, M, GS, GS);
        g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `bold ${Math.round(Math.min(C * .6, 64))}px Georgia, serif`;
        for (let a = 0; a < n; a++) for (const kind of [0, 1]) { const { s, need } = lineCount(kind, a); g.fillStyle = s > need ? '#c0392b' : s === need ? 'rgba(60,40,20,.38)' : '#2b2418';
          const px = kind ? M + (a + .5) * C : M + GS + GAP + CW / 2, py = kind ? M + GS + GAP + CW / 2 : M + (a + .5) * C; g.fillText(String(need), px, py); }
        if (st.phase === 'play') { const x = M + (bd.cur % n) * C, y = M + Math.floor(bd.cur / n) * C; g.strokeStyle = 'rgba(255,190,40,.95)'; g.lineWidth = 6; g.strokeRect(x + 3, y + 3, C - 6, C - 6); }
        if (bd.flash) { const x = M + (bd.flash.i % n) * C, y = M + Math.floor(bd.flash.i / n) * C; g.strokeStyle = bd.flash.good ? '#2fd060' : '#e03030'; g.lineWidth = 8; g.strokeRect(x + 4, y + 4, C - 8, C - 8); }
        tex.update();
      }
      // HTML fleet list: each ship size, how many are finished in the marks
      const fleetEl = document.createElement('div');
      fleetEl.style.cssText = 'position:absolute;left:14px;bottom:62px;display:none;padding:8px 10px;border-radius:10px;background:rgba(20,14,8,.84);border:1px solid rgba(230,190,110,.55);color:#f4e6c4;font:13px/1.5 system-ui,sans-serif;pointer-events:none';
      function fleetPanel() { if (!bd) return; const f = finished(), sizes = [...new Set(bd.L.fleet)].sort((a, b) => b - a), need = {}; bd.L.fleet.forEach(s => need[s] = (need[s] || 0) + 1);
        fleetEl.innerHTML = `<div style="font:800 11px system-ui;letter-spacing:.12em;text-transform:uppercase;color:#e6c27a;margin-bottom:2px">Fleet</div>` + sizes.map(s => { const got = f[s] || 0, col = got > need[s] ? '#ff7a6a' : got === need[s] ? '#8fe0a0' : '#f4e6c4';
          return `<div style="color:${col}"><span style="letter-spacing:-1px">${'▰'.repeat(s)}</span> ${got} / ${need[s]}</div>`; }).join(''); }
      function setMark(i, v, rec) { if (bd.given[i] != null || bd.mark[i] === v) return false; if (rec) rec.push([i, bd.mark[i]]); bd.mark[i] = v; return true; }
      function commit(rec) { if (!rec.length) return; bd.undo.push(rec); if (bd.undo.length > 400) bd.undo.shift(); ctx.note(rec.some(([i]) => bd.mark[i] === 2) ? 520 : 700, 'lantern'); draw(); fleetPanel(); check(); }
      function press(i, v) { // v: the brush's state; a square already in that state clears
        if (st.phase !== 'play' || bd.given[i] != null) return false; const want = bd.mark[i] === v ? 0 : v, rec = [];
        setMark(i, want, rec); bd.cur = i; st.drag = { want, last: i, rec }; commit(rec); return true;
      }
      function dragTo(i) { if (!st.drag || i === st.drag.last) return; st.drag.last = i; bd.cur = i; const rec = st.drag.rec; if (setMark(i, st.drag.want, rec)) { if (!bd.undo.includes(rec)) bd.undo.push(rec); draw(); fleetPanel(); check(); } else draw(); }
      function fillLine(kind, a) { if (st.phase !== 'play') return false; const n = bd.n, { s, u, need } = lineCount(kind, a); if (!u) return false; const rec = [];
        const v = s === need ? 1 : s + u === need ? 2 : 0; if (!v) { H.msg('Not sure yet', 900, `${need - s} more ship square${need - s === 1 ? '' : 's'} among ${u}`); return false; }
        for (let b = 0; b < n; b++) { const i = kind ? b * n + a : a * n + b; if (!bd.mark[i]) setMark(i, v, rec); } commit(rec); return true; }
      function undo() { if (st.phase !== 'play') return; const rec = bd.undo.pop(); if (!rec) return; for (let j = rec.length - 1; j >= 0; j--) bd.mark[rec[j][0]] = rec[j][1]; ctx.note(330, 'lantern'); draw(); fleetPanel(); }
      function restart() { if (st.phase !== 'play') return; const rec = []; for (let i = 0; i < bd.n * bd.n; i++) if (bd.given[i] == null && bd.mark[i]) setMark(i, 0, rec); commit(rec); }
      function hint() {
        if (st.phase !== 'play') return; const n = bd.n, sol = bd.L.sol;
        let i = -1; for (let j = 0; j < n * n; j++) { const want = sol[j] === '1' ? 2 : 1; if (bd.mark[j] && bd.mark[j] !== want) { i = j; break; } }
        if (i >= 0) { const rec = []; setMark(i, 0, rec); bd.undo.push(rec); bd.hints++; bd.flash = { i, t: 0, good: false }; bd.cur = i; H.msg('This one is wrong', 1300); draw(); fleetPanel(); info(); return; }
        // an unmarked ship square first (they say the most), else water
        let best = -1; for (let j = 0; j < n * n; j++) if (!bd.mark[j] && sol[j] === '1') { best = j; break; } if (best < 0) for (let j = 0; j < n * n; j++) if (!bd.mark[j]) { best = j; break; } if (best < 0) return;
        const rec = []; setMark(best, sol[best] === '1' ? 2 : 1, rec); bd.undo.push(rec); bd.hints++; bd.flash = { i: best, t: 0, good: true }; bd.cur = best; H.msg(sol[best] === '1' ? 'A ship lies here' : 'Open water here', 1300); draw(); fleetPanel(); info(); check();
      }
      function check() { const n = bd.n, sol = bd.L.sol; for (let i = 0; i < n * n; i++) if ((bd.mark[i] === 2) !== (sol[i] === '1')) return false;
        st.phase = 'won'; st.wt = 0; st.drag = null; draw(); fleetPanel(); pads.style.display = 'none'; ctx.sound('gamewin'); H.msg('The fleet is found', 1600, fmt(bd.time));
        if (bd.k + 1 > solvedUpTo) { solvedUpTo = bd.k + 1; try { localStorage.setItem(KEY, String(solvedUpTo)); } catch (e) {} } return true; }
      const hud = document.getElementById('gameHud');
      const pick = document.createElement('div');
      pick.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(420px,92vw);background:rgba(18,12,6,.95);border:1px solid rgba(230,190,110,.6);border-radius:14px;padding:16px;text-align:center;pointer-events:auto;font:15px/1.4 system-ui,sans-serif;color:#eee';
      const drawPick = () => { pick.innerHTML = `<div style="font:800 13px/1.2 system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#e6c27a;margin-bottom:10px">The Fleet Chart</div><div style="margin-bottom:12px;color:#bbb">The numbers count ship squares in each line. Ships never touch.</div>`
        + `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">${LV.map((L, k) => { const open = k <= solvedUpTo, ok = k < solvedUpTo; return `<button type="button" data-k="${k}" ${open ? '' : 'disabled'} style="padding:8px 2px;border-radius:9px;border:1px solid ${open ? '#e6c27a' : '#444'};background:${ok ? 'rgba(230,194,122,.2)' : 'rgba(255,255,255,.04)'};color:${open ? '#fff' : '#666'};font:700 15px system-ui,sans-serif;cursor:${open ? 'pointer' : 'default'}">${open ? `${k + 1}<div style="font:11px system-ui;opacity:.75">${L.n}×${L.n} · ${L.fleet.length} ships</div>` : '🔒'}${ok ? ' ✓' : ''}</button>`; }).join('')}</div>`;
        pick.querySelectorAll('button[data-k]').forEach(b => b.onclick = (e) => { e.stopPropagation(); b.blur(); choose(+b.dataset.k); }); };
      const pads = document.createElement('div');
      pads.style.cssText = 'position:absolute;bottom:62px;right:14px;display:none;gap:6px;pointer-events:auto';
      const padBtn = (t, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.style.cssText = 'min-width:52px;height:40px;padding:0 10px;border-radius:9px;border:1px solid #d9b26a;background:rgba(24,16,6,.88);color:#fff1d2;font:700 15px system-ui;cursor:pointer'; b.onclick = (e) => { e.stopPropagation(); b.blur(); fn(); }; pads.appendChild(b); return b; };
      const modeBtn = padBtn('〰 Water', () => toggleMode()); padBtn('Undo', undo); padBtn('Hint', hint);
      function toggleMode() { st.mode = st.mode === 1 ? 2 : 1; modeBtn.textContent = st.mode === 1 ? '〰 Water' : '▰ Ship'; if (bd) info(); }
      function choose(k) { if (st.phase !== 'pick' || k > solvedUpTo || k >= LV.length) return; pick.remove(); st.phase = 'play'; build(k); pads.style.display = 'flex'; fleetEl.style.display = 'block'; H.msg(`Chart ${k + 1}`, 900, `${LV[k].name}: ${LV[k].fleet.length} ships`); }
      hud.append(pick, pads, fleetEl); drawPick();
      const cam = [0, TY + 6.3, -3.4], at = [0, TY, -.3];
      ctx.player.place(0, cam[2] - 1.6, 0); ctx.look(cam, at, def.fov || .8); // the player waits behind the camera, out of the picture
      { const g = tex.getContext(); g.fillStyle = '#e6d6aa'; g.fillRect(0, 0, TEX, TEX); tex.update(); }
      H.title(def.title || 'The Fleet Chart'); H.score(''); info();
      H.hint('Click to mark with the brush (<kbd>Tab</kbd> water / ship; right click the other), drag to paint, click a number to fill its line. <kbd>U</kbd> undo, <kbd>H</kbd> hint.');
      const cellAt = () => { const hit = scene.pickWithRay(ctx.ray(), m => m.metadata?.flBoard); if (!hit?.pickedPoint) return null; const l = ctx.toLocal(hit.pickedPoint), n = bd.n, C = GS / n;
        const px = (l.x + S / 2) / S * TEX, py = (S / 2 - l.z) / S * TEX, c = Math.floor((px - M) / C), r = Math.floor((py - M) / C);
        if (c >= 0 && c < n && r >= 0 && r < n) return { i: r * n + c };
        if (px > M + GS + GAP / 2 && r >= 0 && r < n) return { line: [0, r] }; if (py > M + GS + GAP / 2 && c >= 0 && c < n) return { line: [1, c] }; return null; };
      return {
        update(dt) {
          ctx.look(cam, at); st.t += dt; if (!bd) return;
          if (st.phase === 'play') { const s = Math.floor(bd.time); bd.time += dt; if (Math.floor(bd.time) !== s) info(); }
          if (bd.flash && (bd.flash.t += dt) > 1.6) { bd.flash = null; draw(); }
          if (st.phase === 'won' && (st.wt += dt) > 2) { st.phase = 'done'; H.hint(''); const k = bd.k;
            ctx.finish({ score: (k + 1) * 20 + (bd.hints ? 0 : 10), label: 'points', solved: true, extra: `${bd.L.name} (chart ${k + 1}, ${bd.n} × ${bd.n}, ${bd.L.fleet.length} ships) found in ${fmt(bd.time)}${bd.hints ? `, ${bd.hints} hint${bd.hints > 1 ? 's' : ''}` : ''}.${k + 1 < LV.length ? ` Chart ${k + 2} is open.` : ' Every chart is read.'}` }); }
        },
        key(e, down) {
          if (!down || e.repeat) return; const k = e.key.toLowerCase();
          if (st.phase === 'pick') { const n = parseInt(k, 10); if (n >= 1 && n <= LV.length) choose(n - 1); return; }
          if (st.phase !== 'play') return; const n = bd.n, x = bd.cur % n, y = Math.floor(bd.cur / n);
          if (k === 'arrowup' || k === 'w') { bd.cur = ((y - 1 + n) % n) * n + x; draw(); } else if (k === 'arrowdown' || k === 's') { bd.cur = ((y + 1) % n) * n + x; draw(); }
          else if (k === 'arrowleft' || k === 'a') { bd.cur = y * n + (x - 1 + n) % n; draw(); } else if (k === 'arrowright' || k === 'd') { bd.cur = y * n + (x + 1) % n; draw(); }
          else if (k === ' ' || k === 'enter') { press(bd.cur, st.mode); st.drag = null; } else if (k === 'q') { press(bd.cur, 1); st.drag = null; } else if (k === 'e') { press(bd.cur, 2); st.drag = null; }
          else if (k === 'backspace' || k === 'delete' || k === '0') { const rec = []; if (setMark(bd.cur, 0, rec)) commit(rec); }
          else if (k === 'f') { const a = fillLine(0, y), b = fillLine(1, x); if (!a && !b) draw(); }
          else if (k === 'u' || (k === 'z' && (e.ctrlKey || e.metaKey))) undo(); else if (k === 'h') hint(); else if (k === 'tab') { e.preventDefault?.(); toggleMode(); }
        },
        pointer(evt) {
          const T = B.PointerEventTypes; if (st.phase !== 'play' || !bd) return;
          if (evt.type === T.POINTERDOWN) { const hit = cellAt(); if (!hit) return; if (hit.line) { fillLine(hit.line[0], hit.line[1]); return; }
            const right = evt.event && evt.event.button === 2; press(hit.i, right ? 3 - st.mode : st.mode); }
          else if (evt.type === T.POINTERMOVE && st.drag) { const hit = cellAt(); if (hit && hit.i != null) dragTo(hit.i); }
          else if (evt.type === T.POINTERUP) st.drag = null;
        },
        _test: { st, choose, press, dragTo, fillLine, undo, hint, restart, toggleMode, finished, get bd() { return bd; }, LV, draw, end() { st.drag = null; }, unlock(k) { solvedUpTo = k; drawPick(); } },
        dispose() { pick.remove(); pads.remove(); fleetEl.remove(); nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); try { boardM.dispose(); tex.dispose(); } catch (e) {} }
      };
    }
  };
  window.RebelGames.register('fleet', G);
})();
