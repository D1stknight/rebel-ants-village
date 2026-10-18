// The Canal Islands (Oct 15, Buke): the engineer's map of the inner colony. Dig the canals so that every numbered
// island keeps exactly that many squares of land (one number per island), the canals all join into one waterway, and
// no 2 x 2 block is all canal (no standing pools). Islands never touch side to side. Seven maps from 5 x 5 to the
// 9 x 9 Grand Canal, each with one answer (checked by a solver). Click marks with the brush (Tab switches canal /
// land, right click the other), drag paints. A pool is outlined red, an island too big or holding two numbers turns
// its number red. H hint (no clean bonus). Score: the map x 20, +10 without a hint. def: { levels, pass, points }
// Oct 17: How to play (the rules + a solved 5 x 5, howto/canals.png) and Restart (the map as picked: only the
// numbered land, no marks, undo, hints or time).
// Oct 17 (Miguel: "all board games need to be 10 or 15 [levels]"): three more maps, all 10 x 10, made by a new
// generator (scratchpad agents/lvB/canals/gen.mjs: a carved answer, numbers repaired toward one answer, then moved
// inside their islands toward harder maps in harden.mjs) and graded by what a player needs on top of the usual rules:
// single what-ifs, then a what-if inside a what-if where those stall (the Grand Canal 25 + 4; new 18 + 6, 31 + 10,
// 24 + 12). Each has one answer by the generator's search and by a SAT model of the rules written apart from it
// (agents/lvB/canals/check.py; all ten pass).
(function () {
  const LEVELS = [
    { name: "The Reed Bed", r: 5, c: 5, clues: [[12,2],[19,3],[3,3],[1,5]], sol: '0010001110010110101011100' },
    { name: "The Lily Pond", r: 6, c: 6, clues: [[10,3],[35,2],[0,3],[32,2],[25,5]], sol: '000111111101100101100101101110110010' },
    { name: "The Gate Moat", r: 7, c: 7, clues: [[23,5],[0,5],[28,3],[48,2],[10,3],[27,2],[43,3]], sol: '0001111001000111111110100010001001011111111000100' },
    { name: "The Rice Terraces", r: 7, c: 7, clues: [[29,5],[44,3],[42,2],[16,5],[7,5],[34,2]], sol: '0000111011110111000011011111100001001111100100011' },
    { name: "The Engineer's Locks", r: 8, c: 8, clues: [[7,3],[56,4],[12,4],[46,3],[0,8],[23,5],[62,5],[41,2]], sol: '0011100000100111001011000010100011111111100100010111111000010000' },
    { name: "The Inner Colony", r: 8, c: 8, clues: [[56,4],[15,6],[0,3],[16,6],[43,5],[4,2],[37,2],[60,3],[39,3]], sol: '0001010011110100001011000010011100101010111010100011111000100011' },
    { name: "The Grand Canal", r: 9, c: 9, clues: [[74,8],[30,5],[79,6],[3,3],[32,6],[15,2],[77,5],[13,2],[9,5]], sol: '010011111010101001011101111010010001010010001111011111001110100000100100000100100' },
    // Oct 17: three 10 x 10s, 6 / 10 / 12 deep what-ifs (scratchpad agents/lvB/canals)
    { name: "The Floodgates", r: 10, c: 10, clues: [[31,5],[71,3],[48,2],[60,1],[93,4],[69,2],[52,3],[97,1],[15,8],[86,2],[18,7],[56,8],[99,2]], sol: '0111110000010000100001100111110010010101111111010110001001100111100010100011101111111001100000111010' },
    { name: "The Archive Moat", r: 10, c: 10, clues: [[41,5],[38,8],[70,3],[50,1],[24,4],[87,5],[45,3],[89,3],[92,2],[10,4],[13,2],[84,2],[64,5],[8,1]], sol: '0010111101001010011111110011001001110100100010010001111111001100000111011111101001010100100101010010' },
    { name: "The Trident Delta", r: 10, c: 10, clues: [[92,7],[58,5],[99,2],[1,6],[47,1],[75,2],[5,4],[25,3],[61,5],[63,5],[8,3],[23,3],[38,4]], sol: '0010001000001101111101101001000100101100111111101100100011010010011001011110101111001010100000011110' }
  ];
  const G = {
    title: 'The Canal Islands',
    howTo: { lines: [
      'Dig canals to split the map into islands. Every island holds exactly one number, and that number is its size in squares; every square of land belongs to a numbered island.',
      'All the canal squares join into one waterway (side to side), and no 2 x 2 block may be all canal: a standing pool is outlined red.',
      'Islands never touch each other side to side (corner to corner is fine). The numbered squares are always land; a number turns red when its island is too big or holds two numbers, and fades once its island is closed at the right size.',
      'Click a square to mark it with the brush, again to clear it: Tab (or the Canal / Land button) switches canal / land, right click marks the other, drag paints. A dot marks land you are sure of.',
      'Keys: arrows or WASD move, Space or Enter marks with the brush, Q digs, E marks land, 0 or Backspace clears. The map is done when every canal square is dug: squares left unmarked count as land.',
      'U undoes; H fixes one square (no +10 clean bonus then). Restart takes the map back to its numbers.',
      'Tip: a square between two numbers is always canal, since two numbers never share an island; a 1 is ringed with canal; and a square no island can reach is canal.'],
      img: 'howto/canals.png', caption: 'A solved 5 x 5 map: one joined waterway, no pools, and every island the size of its number.' },
    start(ctx) {
      const B = ctx.B, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const LV = def.levels || LEVELS, KEY = 'rebelAntsCanalsProgress:' + (def.id || 'canals');
      let solvedUpTo = 0; try { solvedUpTo = Math.max(0, Math.min(LV.length, Number(localStorage.getItem(KEY)) || 0)); } catch (e) {}
      const mat = (k, c, em) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(.05, .05, .05); if (em) m.emissiveColor = new B.Color3(...em); return m; });
      const woodM = mat('table', [.3, .16, .12], [.07, .04, .03]), brassM = mat('brass', [.75, .58, .25], [.2, .15, .05]);
      const nodes = [], keep = n => { n.parent = n.parent || ctx.frame; ctx.add(n); nodes.push(n); if (n.isPickable !== undefined) n.isPickable = false; return n; };
      const TEX = 1024, tex = new B.DynamicTexture('ciTex', { width: TEX, height: TEX }, scene, true); tex.hasAlpha = false;
      const boardM = new B.StandardMaterial('ciBoardMat', scene); boardM.diffuseTexture = tex; boardM.emissiveTexture = tex; boardM.emissiveColor = new B.Color3(.62, .62, .62); boardM.diffuseColor = new B.Color3(.55, .55, .55); boardM.specularColor = new B.Color3(0, 0, 0);
      const S = 4.4, TY = .95;
      { const t = keep(B.MeshBuilder.CreateBox('ciTable', { width: S + .5, height: .14, depth: S + .5 }, scene)); t.material = woodM; t.position.y = TY - .07;
        for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const l = keep(B.MeshBuilder.CreateBox('ciLeg', { width: .16, height: TY - .14, depth: .16 }, scene)); l.material = woodM; l.position.set(x * (S / 2), (TY - .14) / 2, z * (S / 2)); }
        for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const w = keep(B.MeshBuilder.CreateCylinder('ciWeight', { diameter: .16, height: .1, tessellation: 12 }, scene)); w.material = brassM; w.position.set(x * (S / 2 - .05), TY + .05, z * (S / 2 - .05)); } }
      const board = keep(B.MeshBuilder.CreateGround('ciBoard', { width: S, height: S }, scene)); board.material = boardM; board.position.y = TY + .005; board.isPickable = true; board.metadata = { ciBoard: true };
      let bd = null; // { k, L, R, C, N, num: Int8Array (0 none), sol (1 canal), mark: Int8Array (0 ?, 1 canal, 2 land), hints, time, cur, undo: [], flash, X0, Y0, CS }
      const st = { phase: 'pick', t: 0, mode: 1, drag: null, dirty: false };
      const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
      function build(k) {
        const L = LV[k], R = L.r, C = L.c, N = R * C, num = new Int8Array(N); for (const [i, n] of L.clues) num[i] = n;
        const CS = Math.min((TEX - 96) / C, (TEX - 96) / R), X0 = (TEX - CS * C) / 2, Y0 = (TEX - CS * R) / 2;
        bd = { k, L, R, C, N, num, sol: Uint8Array.from(L.sol, ch => ch === '1' ? 1 : 0), mark: new Int8Array(N), hints: 0, time: 0, cur: 0, undo: [], flash: null, X0, Y0, CS };
        for (let i = 0; i < N; i++) if (num[i]) bd.mark[i] = 2; // numbered squares are land
        ctx.player.place(0, cam[2] - 1.6, 0); draw(); info();
      }
      const nb = i => { const { R, C } = bd, r = Math.floor(i / C), c = i % C, o = []; if (r > 0) o.push(i - C); if (r < R - 1) o.push(i + C); if (c > 0) o.push(i - 1); if (c < C - 1) o.push(i + 1); return o; };
      function pools() { const { R, C } = bd, out = new Set(); for (let r = 0; r < R - 1; r++) for (let c = 0; c < C - 1; c++) { const i = r * C + c, q = [i, i + 1, i + C, i + C + 1]; if (q.every(j => bd.mark[j] === 1)) q.forEach(j => out.add(j)); } return out; }
      function islands() { // land regions (marked land): their numbers and sizes; a region is closed when no unknown square touches it
        const seen = new Int32Array(bd.N).fill(-1), out = [];
        for (let i = 0; i < bd.N; i++) { if (bd.mark[i] !== 2 || seen[i] >= 0) continue; const id = out.length, cells = [], q = [i]; seen[i] = id; let nums = [], open = false;
          while (q.length) { const x = q.pop(); cells.push(x); if (bd.num[x]) nums.push(x); for (const y of nb(x)) { if (bd.mark[y] === 2 && seen[y] < 0) { seen[y] = id; q.push(y); } else if (!bd.mark[y]) open = true; } }
          out.push({ cells, nums, open }); }
        return out; }
      const info = () => H.info(bd ? `Map ${bd.k + 1} / ${LV.length} · ${bd.L.name} · ${bd.R} × ${bd.C} · ${fmt(bd.time)} · brush ${st.mode === 1 ? 'canal' : 'land'}${bd.hints ? ` · hints ${bd.hints}` : ''}` : 'Pick a map');
      const draw = () => { st.dirty = true; }; // changes are painted once per frame (one texture upload)
      function paint() {
        const g = tex.getContext(), { R, C, CS, X0, Y0, N } = bd, won = st.phase === 'won' || st.phase === 'done', pl = pools(), isl = islands(), badNum = new Set(), doneNum = new Set();
        for (const s of isl) { const n = s.nums.length ? bd.num[s.nums[0]] : 0; if (s.nums.length > 1 || (s.nums.length === 1 && s.cells.length > n)) s.nums.forEach(x => badNum.add(x)); else if (s.nums.length === 1 && !s.open && s.cells.length === n) doneNum.add(s.nums[0]); }
        g.fillStyle = '#d9cfae'; g.fillRect(0, 0, TEX, TEX);
        const grd = g.createRadialGradient(TEX / 2, TEX / 2, TEX * .25, TEX / 2, TEX / 2, TEX * .75); grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(70,50,30,.32)'); g.fillStyle = grd; g.fillRect(0, 0, TEX, TEX);
        for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) { const i = r * C + c, x = X0 + c * CS, y = Y0 + r * CS, v = won ? (bd.sol[i] ? 1 : 2) : bd.mark[i];
          if (v === 1) { g.fillStyle = pl.has(i) && !won ? '#3b6f99' : '#4a87b4'; g.fillRect(x, y, CS, CS); g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = Math.max(2, CS * .04);
            for (const yy of [.38, .64]) { g.beginPath(); for (let t = 0; t <= 1.001; t += .125) { const px = x + CS * (.18 + .64 * t), py = y + CS * yy + Math.sin(t * Math.PI * 2) * CS * .05; t ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke(); } }
          else if (v === 2) { g.fillStyle = '#b9c98a'; g.fillRect(x, y, CS, CS); if (!bd.num[i]) { g.fillStyle = 'rgba(80,100,40,.6)'; g.beginPath(); g.arc(x + CS / 2, y + CS / 2, CS * .07, 0, Math.PI * 2); g.fill(); } }
          else { g.fillStyle = (r + c) % 2 ? '#e2d8b8' : '#ddd2b0'; g.fillRect(x, y, CS, CS); }
          if (bd.num[i]) { g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `bold ${Math.round(CS * .52)}px Georgia, serif`; g.fillStyle = badNum.has(i) ? '#c0392b' : doneNum.has(i) || won ? 'rgba(40,50,20,.45)' : '#2a2a18'; g.fillText(String(bd.num[i]), x + CS / 2, y + CS / 2 + CS * .03); } }
        g.strokeStyle = 'rgba(60,50,30,.45)'; g.lineWidth = 2; for (let a = 0; a <= C; a++) { g.beginPath(); g.moveTo(X0 + a * CS, Y0); g.lineTo(X0 + a * CS, Y0 + R * CS); g.stroke(); } for (let a = 0; a <= R; a++) { g.beginPath(); g.moveTo(X0, Y0 + a * CS); g.lineTo(X0 + C * CS, Y0 + a * CS); g.stroke(); }
        g.lineWidth = 5; g.strokeStyle = 'rgba(60,40,20,.7)'; g.strokeRect(X0, Y0, C * CS, R * CS);
        if (!won) { g.strokeStyle = '#e03030'; g.lineWidth = 5; for (const i of pl) { const x = X0 + (i % C) * CS, y = Y0 + Math.floor(i / C) * CS; g.strokeRect(x + 3, y + 3, CS - 6, CS - 6); } }
        if (st.phase === 'play') { const x = X0 + (bd.cur % C) * CS, y = Y0 + Math.floor(bd.cur / C) * CS; g.strokeStyle = 'rgba(255,190,40,.95)'; g.lineWidth = 6; g.strokeRect(x + 3, y + 3, CS - 6, CS - 6); }
        if (bd.flash) { const x = X0 + (bd.flash.i % C) * CS, y = Y0 + Math.floor(bd.flash.i / C) * CS; g.strokeStyle = bd.flash.good ? '#2fd060' : '#e03030'; g.lineWidth = 8; g.strokeRect(x + 4, y + 4, CS - 8, CS - 8); }
        tex.update();
      }
      function setMark(i, v, rec) { if (bd.num[i] || bd.mark[i] === v) return false; if (rec) rec.push([i, bd.mark[i]]); bd.mark[i] = v; return true; }
      function commit(rec) { if (!rec.length) return; bd.undo.push(rec); if (bd.undo.length > 400) bd.undo.shift(); ctx.note(rec.some(([i]) => bd.mark[i] === 1) ? 520 : 700, 'lantern'); draw(); info(); check(); }
      function press(i, v) { // v: the brush; a square already in that state clears
        if (st.phase !== 'play' || bd.num[i]) { if (st.phase === 'play' && bd) { bd.cur = i; draw(); } return false; }
        const want = bd.mark[i] === v ? 0 : v, rec = []; setMark(i, want, rec); bd.cur = i; st.drag = { want, last: i, rec }; commit(rec); return true; }
      function dragTo(i) { if (!st.drag || i === st.drag.last) return; st.drag.last = i; bd.cur = i; const rec = st.drag.rec; if (setMark(i, st.drag.want, rec)) { if (!bd.undo.includes(rec)) bd.undo.push(rec); draw(); info(); check(); } else draw(); }
      function undo() { if (st.phase !== 'play') return; const rec = bd.undo.pop(); if (!rec) return; for (let j = rec.length - 1; j >= 0; j--) bd.mark[rec[j][0]] = rec[j][1]; ctx.note(330, 'lantern'); draw(); info(); }
      // Restart (the button beside Quit): the map as it was picked (only the numbered land; no marks, undo, hints or
      // time), kept in the same board object (the tests hold it); only while it is being played
      function restart() { if (st.phase !== 'play' || !bd) return; const b = bd; build(b.k); bd = Object.assign(b, bd); st.drag = null; H.msg('Start again', 900); }
      function hint() {
        if (st.phase !== 'play') return;
        let i = -1; for (let j = 0; j < bd.N; j++) if (bd.mark[j] && !bd.num[j] && (bd.mark[j] === 1) !== !!bd.sol[j]) { i = j; break; }
        if (i >= 0) { const rec = []; setMark(i, 0, rec); bd.undo.push(rec); bd.hints++; bd.flash = { i, t: 0, good: false }; bd.cur = i; H.msg('This one is wrong', 1300); draw(); info(); return; }
        // a canal square beside the canal already dug (it reads on from there), else any canal, else land
        let best = -1; for (let j = 0; j < bd.N && best < 0; j++) if (!bd.mark[j] && bd.sol[j] && nb(j).some(q => bd.mark[q] === 1)) best = j;
        for (let j = 0; j < bd.N && best < 0; j++) if (!bd.mark[j] && bd.sol[j]) best = j; for (let j = 0; j < bd.N && best < 0; j++) if (!bd.mark[j]) best = j; if (best < 0) return;
        const rec = []; setMark(best, bd.sol[best] ? 1 : 2, rec); bd.undo.push(rec); bd.hints++; bd.flash = { i: best, t: 0, good: true }; bd.cur = best; H.msg(bd.sol[best] ? 'A canal runs here' : 'Land here', 1300); draw(); info(); check(); }
      function check() { for (let i = 0; i < bd.N; i++) { const canal = bd.mark[i] === 1; if (bd.num[i]) continue; if (bd.sol[i] ? !canal : canal) { if (bd.sol[i] || bd.mark[i] === 1) return false; } }
        // every canal square dug and nothing else: the unmarked squares left are all land
        for (let i = 0; i < bd.N; i++) if (bd.sol[i] && bd.mark[i] !== 1) return false;
        st.phase = 'won'; st.wt = 0; st.drag = null; draw(); pads.style.display = 'none'; ctx.sound('gamewin'); H.msg('The canals are dug', 1600, fmt(bd.time));
        if (bd.k + 1 > solvedUpTo) { solvedUpTo = bd.k + 1; try { localStorage.setItem(KEY, String(solvedUpTo)); } catch (e) {} } return true; }
      const hud = document.getElementById('gameHud');
      const pick = document.createElement('div');
      pick.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(' + (LV.length > 6 && innerWidth >= 600 ? 560 : 420) + 'px,92vw);background:rgba(16,14,10,.95);border:1px solid rgba(216,179,92,.6);border-radius:14px;padding:16px;text-align:center;pointer-events:auto;font:15px/1.4 system-ui,sans-serif;color:#eee';
      const drawPick = () => { pick.innerHTML = `<div style="font:800 13px/1.2 system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#d8b35c;margin-bottom:10px">The Canal Islands</div><div style="margin-bottom:12px;color:#bbb">Dig one joined waterway. Each number keeps an island of that many squares; no 2 × 2 pools.</div>`
        + `<div style="display:grid;grid-template-columns:repeat(${LV.length > 6 && innerWidth >= 600 ? 5 : 4},1fr);gap:8px">${LV.map((L, k) => { const open = k <= solvedUpTo, ok = k < solvedUpTo; return `<button type="button" data-k="${k}" ${open ? '' : 'disabled'} style="padding:8px 2px;border-radius:9px;border:1px solid ${open ? '#d8b35c' : '#444'};background:${ok ? 'rgba(216,179,92,.2)' : 'rgba(255,255,255,.04)'};color:${open ? '#fff' : '#666'};font:700 15px system-ui,sans-serif;cursor:${open ? 'pointer' : 'default'}">${open ? `${k + 1}${ok ? ' ✓' : ''}<div style="font:500 11px system-ui;color:#c9b88f">${L.r} × ${L.c}</div>` : `${k + 1}<div style="font:500 11px system-ui">locked</div>`}</button>`; }).join('')}</div>`
          + `<div style="margin-top:10px;font-size:12px;color:#998">Keys ${LV.length > 9 ? '1-9 and 0' : '1-' + LV.length} pick a map</div>`;
        pick.querySelectorAll('button[data-k]').forEach(b => b.onclick = (e) => { e.stopPropagation(); b.blur(); choose(+b.dataset.k); }); };
      const pads = document.createElement('div');
      pads.style.cssText = 'position:absolute;bottom:62px;right:14px;display:none;gap:6px;pointer-events:auto';
      const padBtn = (t, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.style.cssText = 'min-width:52px;height:40px;padding:0 10px;border-radius:9px;border:1px solid #d8b35c;background:rgba(20,16,10,.88);color:#fff1d2;font:700 15px system-ui;cursor:pointer'; b.onclick = (e) => { e.stopPropagation(); b.blur(); fn(); }; pads.appendChild(b); return b; };
      const modeBtn = padBtn('〰 Canal', () => toggleMode()); padBtn('Undo', undo); padBtn('Hint', hint);
      function toggleMode() { st.mode = st.mode === 1 ? 2 : 1; modeBtn.textContent = st.mode === 1 ? '〰 Canal' : '• Land'; if (bd) info(); }
      function choose(k) { if (st.phase !== 'pick' || k > solvedUpTo || k >= LV.length) return; pick.remove(); st.phase = 'play'; build(k); pads.style.display = 'flex'; H.msg(`Map ${k + 1}`, 900, `${LV[k].name}: ${LV[k].clues.length} islands`); }
      hud.append(pick, pads); drawPick();
      const cam = [0, TY + 6.3, -3.4], at = [0, TY, -.3];
      ctx.player.place(0, cam[2] - 1.6, 0); ctx.look(cam, at, def.fov || .8); // the player waits behind the camera, out of the picture
      { const g = tex.getContext(); g.fillStyle = '#d9cfae'; g.fillRect(0, 0, TEX, TEX); tex.update(); }
      H.title(def.title || 'The Canal Islands'); H.score(''); info();
      H.hint('Click to mark with the brush (<kbd>Tab</kbd> canal / land; right click the other), drag to paint. <kbd>U</kbd> undo, <kbd>H</kbd> hint.');
      const cellAt = () => { const hit = scene.pickWithRay(ctx.ray(), m => m.metadata?.ciBoard); if (!hit?.pickedPoint) return null; const l = ctx.toLocal(hit.pickedPoint);
        const px = (l.x + S / 2) / S * TEX, py = (S / 2 - l.z) / S * TEX, c = Math.floor((px - bd.X0) / bd.CS), r = Math.floor((py - bd.Y0) / bd.CS);
        return c >= 0 && c < bd.C && r >= 0 && r < bd.R ? r * bd.C + c : null; };
      return {
        update(dt) {
          ctx.look(cam, at); st.t += dt; if (!bd) return; if (st.dirty) { st.dirty = false; paint(); }
          if (st.phase === 'play') { const s = Math.floor(bd.time); bd.time += dt; if (Math.floor(bd.time) !== s) info(); }
          if (bd.flash && (bd.flash.t += dt) > 1.6) { bd.flash = null; draw(); }
          if (st.phase === 'won' && (st.wt += dt) > 2) { st.phase = 'done'; H.hint(''); const k = bd.k;
            ctx.finish({ score: (k + 1) * 20 + (bd.hints ? 0 : 10), label: 'points', solved: true, extra: `${bd.L.name} (map ${k + 1}, ${bd.R} × ${bd.C}, ${bd.L.clues.length} islands) dug in ${fmt(bd.time)}${bd.hints ? `, ${bd.hints} hint${bd.hints > 1 ? 's' : ''}` : ''}.${k + 1 < LV.length ? ` Map ${k + 2} is open.` : ' Every map is dug.'}` }); }
        },
        key(e, down) {
          if (!down || e.repeat) return; const k = e.key.toLowerCase();
          if (st.phase === 'pick') { const n = k === '0' ? 10 : parseInt(k, 10); if (n >= 1 && n <= LV.length) choose(n - 1); return; } // 1-9, 0 = the tenth
          if (st.phase !== 'play') return; const { R, C } = bd, x = bd.cur % C, y = Math.floor(bd.cur / C);
          if (k === 'arrowup' || k === 'w') { bd.cur = ((y - 1 + R) % R) * C + x; draw(); } else if (k === 'arrowdown' || k === 's') { bd.cur = ((y + 1) % R) * C + x; draw(); }
          else if (k === 'arrowleft' || k === 'a') { bd.cur = y * C + (x - 1 + C) % C; draw(); } else if (k === 'arrowright' || k === 'd') { bd.cur = y * C + (x + 1) % C; draw(); }
          else if (k === ' ' || k === 'enter') { press(bd.cur, st.mode); st.drag = null; } else if (k === 'q') { press(bd.cur, 1); st.drag = null; } else if (k === 'e') { press(bd.cur, 2); st.drag = null; }
          else if (k === 'backspace' || k === 'delete' || k === '0') { const rec = []; if (setMark(bd.cur, 0, rec)) commit(rec); }
          else if (k === 'u' || (k === 'z' && (e.ctrlKey || e.metaKey))) undo(); else if (k === 'h') hint(); else if (k === 'tab') { e.preventDefault?.(); toggleMode(); }
        },
        pointer(evt) {
          const T = B.PointerEventTypes; if (st.phase !== 'play' || !bd) return;
          if (evt.type === T.POINTERDOWN) { const i = cellAt(); if (i == null) return; const right = evt.event && evt.event.button === 2; press(i, right ? 3 - st.mode : st.mode); }
          else if (evt.type === T.POINTERMOVE && st.drag) { const i = cellAt(); if (i != null) dragTo(i); }
          else if (evt.type === T.POINTERUP) st.drag = null;
        },
        restart,
        _test: { st, choose, press, dragTo, undo, hint, restart, toggleMode, pools, islands, get bd() { return bd; }, LV, draw: () => { st.dirty = false; paint(); }, end() { st.drag = null; }, unlock(k) { solvedUpTo = k; drawPick(); } },
        dispose() { pick.remove(); pads.remove(); nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); try { boardM.dispose(); tex.dispose(); } catch (e) {} }
      };
    }
  };
  window.RebelGames.register('canals', G);
})();
