// The War Camp (Oct 15, Bushi): the quartermaster's map of the army's camp. Every tree has its own tent pitched beside
// it (up, down, left or right); tents never touch each other, not even at a corner; the numbers beside each row and
// under each column count its tents. Seven camps from 6 x 6 to the 12 x 12 General's Camp, each with one answer
// (checked by a solver; the big ones need "what if a tent stood here?" reasoning). Squares beside no tree are grass
// from the start. Click marks with the brush (Tab switches tent / grass, right click the other), drag paints, a click
// on a line's number fills it when it is sure. H hint (no clean bonus). Score: the camp x 20, +10 without a hint.
// Oct 17: How to play (the rules in a few lines) and Restart (the camp as picked: no marks, undo, hints or time).
// def: { levels, pass, points }
(function () {
  const LEVELS = [
    { name: "The Scout Camp", n: 6, trees: [8,10,14,19,24,28], tents: [4,7,15,18,30,34], rows: [1,1,1,1,0,2], cols: [2,1,0,1,2,0] },
    { name: "The Ridge Camp", n: 7, trees: [7,8,10,20,24,29,32,35,37], tents: [1,3,14,23,27,28,39,42,44], rows: [2,0,1,2,1,1,2], cols: [3,1,2,1,1,0,1] },
    { name: "The River Camp", n: 8, trees: [6,9,13,14,16,19,27,38,44,48,50,61], tents: [1,7,12,18,22,24,28,39,45,56,58,62], rows: [2,1,2,2,1,1,0,3], cols: [2,1,2,0,2,1,2,2] },
    { name: "The Strategist's Camp", n: 9, trees: [1,4,6,17,22,27,34,39,44,45,52,60,64,65,78,79], tents: [3,5,8,10,21,28,33,35,40,53,54,56,59,73,77,80], rows: [3,1,1,3,1,1,3,0,3], cols: [1,3,1,2,1,3,1,0,4] },
    { name: "The Siege Camp", n: 10, trees: [1,7,8,14,24,30,33,37,38,46,48,51,55,63,69,75,80,82,89,96], tents: [4,6,9,11,23,25,28,31,45,47,49,50,62,65,68,81,83,85,97,99], rows: [3,1,3,1,3,1,3,0,3,2], cols: [1,3,1,2,1,4,1,2,2,3] },
    { name: "The Grand Army", n: 12, trees: [0,10,15,17,20,27,28,34,38,41,56,61,79,84,86,88,89,91,92,95,99,104,114,118,125,128,133,142], tents: [1,3,5,8,11,29,37,39,44,46,53,60,74,76,78,80,83,96,98,101,103,105,119,121,124,126,140,143], rows: [5,0,1,4,1,1,5,0,5,1,3,2], cols: [2,3,2,2,2,4,2,1,4,1,1,4] },
    { name: "The General's Camp", n: 12, trees: [1,3,7,9,18,24,26,41,44,47,57,61,62,64,68,71,72,76,87,90,95,96,110,115,116,124,129,133,143], tents: [0,2,8,10,17,25,27,32,42,46,50,52,56,60,75,80,83,84,89,99,104,107,108,114,122,131,132,136,141], rows: [4,1,3,2,3,1,3,2,3,2,2,3], cols: [5,1,3,3,2,2,2,0,5,1,2,3] }
  ];
  const G = {
    title: 'The War Camp',
    howTo: { lines: [
      'Every tree needs its own tent, pitched right beside it: above, below, left or right of it.',
      'Tents never touch each other, not even at a corner (touching tents are outlined red). The numbers beside each row and under each column count its tents.',
      'Squares beside no tree can never hold a tent: they are grass from the start (the paler ones).',
      'Click a square to mark it with the brush: Tab (or the button) switches tent / grass, right click marks the other, drag paints. Click a line\'s number to fill the rest of it once it is sure.',
      'U undoes, H fixes one square (no clean bonus then).',
      'Tip: a line whose count is already met is all grass, and so is every square around a tent, corners too.'] },
    start(ctx) {
      const B = ctx.B, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const LV = def.levels || LEVELS, KEY = 'rebelAntsCampProgress:' + (def.id || 'tents');
      let solvedUpTo = 0; try { solvedUpTo = Math.max(0, Math.min(LV.length, Number(localStorage.getItem(KEY)) || 0)); } catch (e) {}
      const mat = (k, c, em) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(.05, .05, .05); if (em) m.emissiveColor = new B.Color3(...em); return m; });
      const woodM = mat('table', [.36, .22, .12], [.08, .05, .03]), brassM = mat('brass', [.75, .58, .25], [.2, .15, .05]);
      const nodes = [], keep = n => { n.parent = n.parent || ctx.frame; ctx.add(n); nodes.push(n); if (n.isPickable !== undefined) n.isPickable = false; return n; };
      const TEX = 1024, tex = new B.DynamicTexture('tcTex', { width: TEX, height: TEX }, scene, true); tex.hasAlpha = false;
      const boardM = new B.StandardMaterial('tcBoardMat', scene); boardM.diffuseTexture = tex; boardM.emissiveTexture = tex; boardM.emissiveColor = new B.Color3(.62, .62, .62); boardM.diffuseColor = new B.Color3(.55, .55, .55); boardM.specularColor = new B.Color3(0, 0, 0);
      const S = 4.6, TY = .95;
      { const t = keep(B.MeshBuilder.CreateBox('tcTable', { width: S + .5, height: .14, depth: S + .5 }, scene)); t.material = woodM; t.position.y = TY - .07;
        for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const l = keep(B.MeshBuilder.CreateBox('tcLeg', { width: .16, height: TY - .14, depth: .16 }, scene)); l.material = woodM; l.position.set(x * (S / 2), (TY - .14) / 2, z * (S / 2)); }
        for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const w = keep(B.MeshBuilder.CreateCylinder('tcWeight', { diameter: .16, height: .1, tessellation: 12 }, scene)); w.material = brassM; w.position.set(x * (S / 2 - .05), TY + .05, z * (S / 2 - .05)); } }
      const board = keep(B.MeshBuilder.CreateGround('tcBoard', { width: S, height: S }, scene)); board.material = boardM; board.position.y = TY + .005; board.isPickable = true; board.metadata = { tcBoard: true };
      // texture layout: grid from (M, M), GS square; row numbers on the right, column numbers below
      const M = 36, CW = 96, GAP = 12, GS = TEX - M - CW - GAP;
      let bd = null; // { k, n, L, tree, sol, open (may hold a tent), mark: Int8Array (0 ?, 1 grass, 2 tent), hints, time, cur, undo: [], flash }
      const st = { phase: 'pick', t: 0, mode: 2, drag: null, warned: '' };
      const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
      const orth = i => { const n = bd.n, r = Math.floor(i / n), c = i % n, o = []; if (r > 0) o.push(i - n); if (r < n - 1) o.push(i + n); if (c > 0) o.push(i - 1); if (c < n - 1) o.push(i + 1); return o; };
      const king = i => { const n = bd.n, r = Math.floor(i / n), c = i % n, o = []; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { if (!dr && !dc) continue; const a = r + dr, b = c + dc; if (a >= 0 && b >= 0 && a < n && b < n) o.push(a * n + b); } return o; };
      function build(k) {
        const L = LV[k], n = L.n, N2 = n * n; bd = { k, n, L, tree: new Uint8Array(N2), sol: new Uint8Array(N2), open: new Uint8Array(N2), mark: new Int8Array(N2), hints: 0, time: 0, cur: 0, undo: [], flash: null };
        for (const i of L.trees) bd.tree[i] = 1; for (const i of L.tents) bd.sol[i] = 1;
        for (let i = 0; i < N2; i++) bd.open[i] = !bd.tree[i] && orth(i).some(j => bd.tree[j]) ? 1 : 0;
        bd.cur = Math.max(0, bd.open.indexOf(1)); st.warned = '';
        ctx.player.place(0, cam[2] - 1.6, 0); draw(); info();
      }
      const lineCount = (kind, a) => { const n = bd.n; let s = 0, u = 0; for (let b = 0; b < n; b++) { const i = kind ? b * n + a : a * n + b; if (bd.mark[i] === 2) s++; else if (bd.open[i] && !bd.mark[i]) u++; } return { s, u, need: kind ? bd.L.cols[a] : bd.L.rows[a] }; };
      const tentCount = () => { let s = 0; for (const v of bd.mark) if (v === 2) s++; return s; };
      function touching() { const out = new Set(); for (let i = 0; i < bd.mark.length; i++) if (bd.mark[i] === 2) for (const j of king(i)) if (bd.mark[j] === 2) { out.add(i); out.add(j); } return out; }
      const info = () => H.info(bd ? `Camp ${bd.k + 1} / ${LV.length} · ${bd.L.name} · ${bd.n} × ${bd.n} · tents ${tentCount()} / ${bd.L.trees.length} · ${fmt(bd.time)} · brush ${st.mode === 2 ? 'tent' : 'grass'}${bd.hints ? ` · hints ${bd.hints}` : ''}` : 'Pick a camp');
      function tuft(g, x, y, C) { g.strokeStyle = 'rgba(90,120,50,.75)'; g.lineWidth = Math.max(2, C * .04);
        for (const [u, v] of [[.32, .62], [.62, .42], [.55, .74]]) { const px = x + C * u, py = y + C * v; g.beginPath(); g.moveTo(px - C * .06, py - C * .1); g.lineTo(px, py); g.lineTo(px + C * .06, py - C * .1); g.moveTo(px, py); g.lineTo(px, py - C * .13); g.stroke(); } }
      function pine(g, x, y, C) { g.fillStyle = '#5a3a1e'; g.fillRect(x + C * .45, y + C * .68, C * .1, C * .2);
        for (const [w, top, bot, col] of [[.64, .36, .74, '#2c5427'], [.5, .22, .56, '#356630'], [.36, .1, .38, '#3f7838']]) { g.fillStyle = col; g.beginPath(); g.moveTo(x + C * .5, y + C * top); g.lineTo(x + C * (.5 + w / 2), y + C * bot); g.lineTo(x + C * (.5 - w / 2), y + C * bot); g.closePath(); g.fill(); } }
      function tent(g, x, y, C, bad) { g.fillStyle = bad ? '#c0392b' : '#8e2b22'; g.beginPath(); g.moveTo(x + C * .5, y + C * .16); g.lineTo(x + C * .86, y + C * .8); g.lineTo(x + C * .14, y + C * .8); g.closePath(); g.fill();
        g.strokeStyle = '#d8b35c'; g.lineWidth = Math.max(2, C * .05); g.stroke();
        g.fillStyle = '#3a120e'; g.beginPath(); g.moveTo(x + C * .5, y + C * .46); g.lineTo(x + C * .62, y + C * .8); g.lineTo(x + C * .38, y + C * .8); g.closePath(); g.fill();
        g.strokeStyle = '#d8b35c'; g.lineWidth = Math.max(1.5, C * .03); g.beginPath(); g.moveTo(x + C * .5, y + C * .16); g.lineTo(x + C * .5, y + C * .06); g.stroke(); g.fillStyle = '#d8b35c'; g.fillRect(x + C * .5, y + C * .06, C * .12, C * .06); }
      const draw = () => { st.dirty = true; }; // changes are painted once per frame (one texture upload)
      function paint() {
        const g = tex.getContext(), n = bd.n, C = GS / n, m = bd.mark, won = st.phase === 'won' || st.phase === 'done', bad = touching();
        g.fillStyle = '#e6d6aa'; g.fillRect(0, 0, TEX, TEX);
        const grd = g.createRadialGradient(TEX / 2, TEX / 2, TEX * .2, TEX / 2, TEX / 2, TEX * .75); grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(90,60,20,.35)'); g.fillStyle = grd; g.fillRect(0, 0, TEX, TEX);
        for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) { const i = r * n + c, x = M + c * C, y = M + r * C;
          if (bd.tree[i]) { g.fillStyle = '#a9c47e'; g.fillRect(x, y, C, C); pine(g, x, y, C); continue; }
          if (m[i] === 2) { g.fillStyle = '#b9cf8e'; g.fillRect(x, y, C, C); tent(g, x, y, C, bad.has(i)); continue; }
          if (!bd.open[i]) { g.fillStyle = '#cfdfab'; g.fillRect(x, y, C, C); continue; } // beside no tree: grass from the start
          if (m[i] === 1 || won) { g.fillStyle = '#c2d696'; g.fillRect(x, y, C, C); tuft(g, x, y, C); continue; }
          g.fillStyle = (r + c) % 2 ? '#9cbc68' : '#95b561'; g.fillRect(x, y, C, C); }
        g.strokeStyle = 'rgba(50,60,25,.5)'; g.lineWidth = 2; for (let a = 0; a <= n; a++) { g.beginPath(); g.moveTo(M + a * C, M); g.lineTo(M + a * C, M + GS); g.stroke(); g.beginPath(); g.moveTo(M, M + a * C); g.lineTo(M + GS, M + a * C); g.stroke(); }
        g.lineWidth = 5; g.strokeStyle = 'rgba(60,40,20,.7)'; g.strokeRect(M, M, GS, GS);
        for (const i of bad) { const x = M + (i % n) * C, y = M + Math.floor(i / n) * C; g.strokeStyle = '#e03030'; g.lineWidth = 5; g.strokeRect(x + 3, y + 3, C - 6, C - 6); }
        g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `bold ${Math.round(Math.min(C * .6, 64))}px Georgia, serif`;
        for (let a = 0; a < n; a++) for (const kind of [0, 1]) { const { s, need } = lineCount(kind, a); g.fillStyle = s > need ? '#c0392b' : s === need ? 'rgba(60,40,20,.38)' : '#2b2418';
          const px = kind ? M + (a + .5) * C : M + GS + GAP + CW / 2, py = kind ? M + GS + GAP + CW / 2 : M + (a + .5) * C; g.fillText(String(need), px, py); }
        if (st.phase === 'play') { const x = M + (bd.cur % n) * C, y = M + Math.floor(bd.cur / n) * C; g.strokeStyle = 'rgba(255,190,40,.95)'; g.lineWidth = 6; g.strokeRect(x + 3, y + 3, C - 6, C - 6); }
        if (bd.flash) { const x = M + (bd.flash.i % n) * C, y = M + Math.floor(bd.flash.i / n) * C; g.strokeStyle = bd.flash.good ? '#2fd060' : '#e03030'; g.lineWidth = 8; g.strokeRect(x + 4, y + 4, C - 8, C - 8); }
        tex.update();
      }
      function setMark(i, v, rec) { if (!bd.open[i] || bd.mark[i] === v) return false; if (rec) rec.push([i, bd.mark[i]]); bd.mark[i] = v; return true; }
      function commit(rec) { if (!rec.length) return; bd.undo.push(rec); if (bd.undo.length > 400) bd.undo.shift(); ctx.note(rec.some(([i]) => bd.mark[i] === 2) ? 520 : 700, 'lantern'); draw(); info(); check(); }
      function press(i, v) { // v: the brush's state; a square already in that state clears
        if (st.phase !== 'play' || !bd.open[i]) { if (st.phase === 'play' && bd) { bd.cur = i; draw(); } return false; }
        const want = bd.mark[i] === v ? 0 : v, rec = []; setMark(i, want, rec); bd.cur = i; st.drag = { want, last: i, rec }; commit(rec); return true;
      }
      function dragTo(i) { if (!st.drag || i === st.drag.last) return; st.drag.last = i; bd.cur = i; const rec = st.drag.rec; if (setMark(i, st.drag.want, rec)) { if (!bd.undo.includes(rec)) bd.undo.push(rec); draw(); info(); check(); } else draw(); }
      function fillLine(kind, a) { if (st.phase !== 'play') return false; const n = bd.n, { s, u, need } = lineCount(kind, a); if (!u) return false; const rec = [];
        const v = s === need ? 1 : s + u === need ? 2 : 0; if (!v) { H.msg('Not sure yet', 900, `${need - s} more tent${need - s === 1 ? '' : 's'} among ${u} squares`); return false; }
        for (let b = 0; b < n; b++) { const i = kind ? b * n + a : a * n + b; if (bd.open[i] && !bd.mark[i]) setMark(i, v, rec); } commit(rec); return true; }
      function undo() { if (st.phase !== 'play') return; const rec = bd.undo.pop(); if (!rec) return; for (let j = rec.length - 1; j >= 0; j--) bd.mark[rec[j][0]] = rec[j][1]; ctx.note(330, 'lantern'); draw(); info(); }
      // Restart (the button beside Quit): the camp as it was picked (no marks, undo, hints or time), kept in the same
      // board object (the tests hold it); only while it is being played
      function restart() { if (st.phase !== 'play' || !bd) return; const b = bd; build(b.k); bd = Object.assign(b, bd); st.drag = null; H.msg('Start again', 900); }
      function hint() {
        if (st.phase !== 'play') return; const N2 = bd.n * bd.n;
        let i = -1; for (let j = 0; j < N2; j++) if (bd.mark[j] && (bd.mark[j] === 2) !== !!bd.sol[j]) { i = j; break; }
        if (i >= 0) { const rec = []; setMark(i, 0, rec); bd.undo.push(rec); bd.hints++; bd.flash = { i, t: 0, good: false }; bd.cur = i; H.msg('This one is wrong', 1300); draw(); info(); return; }
        let best = -1; for (let j = 0; j < N2; j++) if (bd.open[j] && !bd.mark[j] && bd.sol[j]) { best = j; break; } if (best < 0) for (let j = 0; j < N2; j++) if (bd.open[j] && !bd.mark[j]) { best = j; break; } if (best < 0) return;
        const rec = []; setMark(best, bd.sol[best] ? 2 : 1, rec); bd.undo.push(rec); bd.hints++; bd.flash = { i: best, t: 0, good: true }; bd.cur = best; H.msg(bd.sol[best] ? 'A tent stands here' : 'Grass here', 1300); draw(); info(); check();
      }
      function check() { const N2 = bd.n * bd.n; let same = true; for (let i = 0; i < N2; i++) if ((bd.mark[i] === 2) !== !!bd.sol[i]) { same = false; break; }
        if (!same) { // every count right and no tents touching, yet not the camp: some tree has no tent of its own
          let full = !touching().size; for (let a = 0; a < bd.n && full; a++) for (const kind of [0, 1]) { const { s, need } = lineCount(kind, a); if (s !== need) { full = false; break; } }
          const key = full ? [...bd.mark].join('') : ''; if (full && key !== st.warned) { st.warned = key; H.msg('Every count is right', 2000, 'but a tree is left without a tent of its own'); } return false; }
        st.phase = 'won'; st.wt = 0; st.drag = null; draw(); pads.style.display = 'none'; ctx.sound('gamewin'); H.msg('The camp is pitched', 1600, fmt(bd.time));
        if (bd.k + 1 > solvedUpTo) { solvedUpTo = bd.k + 1; try { localStorage.setItem(KEY, String(solvedUpTo)); } catch (e) {} } return true; }
      const hud = document.getElementById('gameHud');
      const pick = document.createElement('div');
      pick.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(420px,92vw);background:rgba(20,10,8,.95);border:1px solid rgba(216,179,92,.6);border-radius:14px;padding:16px;text-align:center;pointer-events:auto;font:15px/1.4 system-ui,sans-serif;color:#eee';
      const drawPick = () => { pick.innerHTML = `<div style="font:800 13px/1.2 system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#d8b35c;margin-bottom:10px">The War Camp</div><div style="margin-bottom:12px;color:#bbb">Every tree has its own tent beside it. Tents never touch, not even at a corner. The numbers count the tents in each line.</div>`
        + `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">${LV.map((L, k) => { const open = k <= solvedUpTo, ok = k < solvedUpTo; return `<button type="button" data-k="${k}" ${open ? '' : 'disabled'} style="padding:8px 2px;border-radius:9px;border:1px solid ${open ? '#d8b35c' : '#444'};background:${ok ? 'rgba(216,179,92,.2)' : 'rgba(255,255,255,.04)'};color:${open ? '#fff' : '#666'};font:700 15px system-ui,sans-serif;cursor:${open ? 'pointer' : 'default'}">${open ? `${k + 1}${ok ? ' ✓' : ''}<div style="font:500 11px system-ui;color:#c9b88f">${L.n} × ${L.n}</div>` : `${k + 1}<div style="font:500 11px system-ui">locked</div>`}</button>`; }).join('')}</div>`
          + `<div style="margin-top:10px;font-size:12px;color:#998">Keys 1-${LV.length} pick a camp</div>`;
        pick.querySelectorAll('button[data-k]').forEach(b => b.onclick = (e) => { e.stopPropagation(); b.blur(); choose(+b.dataset.k); }); };
      const pads = document.createElement('div');
      pads.style.cssText = 'position:absolute;bottom:62px;right:14px;display:none;gap:6px;pointer-events:auto';
      const padBtn = (t, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.style.cssText = 'min-width:52px;height:40px;padding:0 10px;border-radius:9px;border:1px solid #d8b35c;background:rgba(24,12,8,.88);color:#fff1d2;font:700 15px system-ui;cursor:pointer'; b.onclick = (e) => { e.stopPropagation(); b.blur(); fn(); }; pads.appendChild(b); return b; };
      const modeBtn = padBtn('▲ Tent', () => toggleMode()); padBtn('Undo', undo); padBtn('Hint', hint);
      function toggleMode() { st.mode = st.mode === 2 ? 1 : 2; modeBtn.textContent = st.mode === 2 ? '▲ Tent' : '♣ Grass'; if (bd) info(); }
      function choose(k) { if (st.phase !== 'pick' || k > solvedUpTo || k >= LV.length) return; pick.remove(); st.phase = 'play'; build(k); pads.style.display = 'flex'; H.msg(`Camp ${k + 1}`, 900, `${LV[k].name}: ${LV[k].trees.length} tents to pitch`); }
      hud.append(pick, pads); drawPick();
      const cam = [0, TY + 6.5, -3.5], at = [0, TY, -.3];
      ctx.player.place(0, cam[2] - 1.6, 0); ctx.look(cam, at, def.fov || .8); // the player waits behind the camera, out of the picture
      { const g = tex.getContext(); g.fillStyle = '#e6d6aa'; g.fillRect(0, 0, TEX, TEX); tex.update(); }
      H.title(def.title || 'The War Camp'); H.score(''); info();
      H.hint('Click to mark with the brush (<kbd>Tab</kbd> tent / grass; right click the other), drag to paint, click a number to fill its line. <kbd>U</kbd> undo, <kbd>H</kbd> hint.');
      const cellAt = () => { const hit = scene.pickWithRay(ctx.ray(), m => m.metadata?.tcBoard); if (!hit?.pickedPoint) return null; const l = ctx.toLocal(hit.pickedPoint), n = bd.n, C = GS / n;
        const px = (l.x + S / 2) / S * TEX, py = (S / 2 - l.z) / S * TEX, c = Math.floor((px - M) / C), r = Math.floor((py - M) / C);
        if (c >= 0 && c < n && r >= 0 && r < n) return { i: r * n + c };
        if (px > M + GS + GAP / 2 && r >= 0 && r < n) return { line: [0, r] }; if (py > M + GS + GAP / 2 && c >= 0 && c < n) return { line: [1, c] }; return null; };
      return {
        update(dt) {
          ctx.look(cam, at); st.t += dt; if (!bd) return; if (st.dirty) { st.dirty = false; paint(); }
          if (st.phase === 'play') { const s = Math.floor(bd.time); bd.time += dt; if (Math.floor(bd.time) !== s) info(); }
          if (bd.flash && (bd.flash.t += dt) > 1.6) { bd.flash = null; draw(); }
          if (st.phase === 'won' && (st.wt += dt) > 2) { st.phase = 'done'; H.hint(''); const k = bd.k;
            ctx.finish({ score: (k + 1) * 20 + (bd.hints ? 0 : 10), label: 'points', solved: true, extra: `${bd.L.name} (camp ${k + 1}, ${bd.n} × ${bd.n}, ${bd.L.trees.length} tents) pitched in ${fmt(bd.time)}${bd.hints ? `, ${bd.hints} hint${bd.hints > 1 ? 's' : ''}` : ''}.${k + 1 < LV.length ? ` Camp ${k + 2} is open.` : ' Every camp is pitched.'}` }); }
        },
        key(e, down) {
          if (!down || e.repeat) return; const k = e.key.toLowerCase();
          if (st.phase === 'pick') { const n = k === '0' ? 10 : parseInt(k, 10); if (n >= 1 && n <= LV.length) choose(n - 1); return; } // 1-9, 0 = the tenth
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
        restart,
        _test: { st, choose, press, dragTo, fillLine, undo, hint, restart, toggleMode, touching, get bd() { return bd; }, LV, draw: () => { st.dirty = false; paint(); }, end() { st.drag = null; }, unlock(k) { solvedUpTo = k; drawPick(); } },
        dispose() { pick.remove(); pads.remove(); nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); try { boardM.dispose(); tex.dispose(); } catch (e) {} }
      };
    }
  };
  window.RebelGames.register('tents', G);
})();
