// Skyline View (Oct 15, Saints of LA): plan the block's skyline. Every row and every column gets one tower of each
// height, 1 to N storeys; a number at the end of a line says how many towers you see looking along it from there (a
// taller tower hides the shorter ones behind it). Seven blocks from 4 x 4 to two 7 x 7s, each with one answer (checked by
// a solver). Click a square (or move with the arrows) and type its height; N writes pencil notes, 0 / Backspace rubs
// out, U undoes, H shows a mistake or one tower (no clean bonus). When the block is right the towers rise.
// Score: the block x 20, +10 without a hint. def: { levels, pass, points }
(function () {
  const LEVELS = [
    { name: "Main Street", n: 4, top: [0,0,0,0], bottom: [4,3,0,0], left: [0,0,0,0], right: [0,2,0,0], given: '0000000000000000', sol: '4123341223411234' },
    { name: "The Corner Lot", n: 5, top: [0,0,0,5,0], bottom: [0,0,0,0,3], left: [0,0,3,0,0], right: [0,2,2,0,0], given: '0000000000000000000000000', sol: '2431545123125345324131452' },
    { name: "The Arena Block", n: 5, top: [3,0,0,0,0], bottom: [0,3,0,1,5], left: [3,0,0,0,0], right: [0,0,2,3,0], given: '0000000000000000000000000', sol: '2431515234415235314232451' },
    { name: "Garage Row", n: 6, top: [0,0,0,3,0,0], bottom: [4,0,0,0,3,4], left: [4,0,4,0,0,4], right: [0,2,0,3,0,0], given: '000000000000000000000000000000000000', sol: '312456624135231564563241456312145623' },
    { name: "Downtown", n: 6, top: [2,0,0,5,0,0], bottom: [0,4,3,0,2,0], left: [0,4,0,0,0,2], right: [2,0,4,0,4,2], given: '000000000000000000000000000000000000', sol: '562134143256456321214563635412321645' },
    { name: "The Hills", n: 7, top: [2,3,6,0,0,0,1], bottom: [4,0,0,2,0,4,3], left: [3,0,0,0,3,2,0], right: [0,0,3,4,4,3,0], given: '0000000000000000000000000000000000000000000000000', sol: '4216357352417674352616753412216754353716241642735' },
    { name: "Skyline of the Saints", n: 7, top: [0,5,2,4,2,2,0], bottom: [1,0,0,0,5,0,4], left: [2,3,4,4,0,0,0], right: [0,0,0,0,4,0,5], given: '0000000000000000000000000000000000000000000000000', sol: '6152347432571624165731237654567342137412657564132' }
  ];
  const seenFrom = line => { let m = 0, c = 0; for (const v of line) { if (!v) return -1; if (v > m) { m = v; c++; } } return c; };
  const seenSoFar = line => { let m = 0, c = 0; for (const v of line) { if (!v) break; if (v > m) { m = v; c++; } } return c; };
  const G = {
    title: 'Skyline View',
    start(ctx) {
      const B = ctx.B, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const LV = def.levels || LEVELS, KEY = 'rebelAntsSkylineProgress:' + (def.id || 'sky');
      let solvedUpTo = 0; try { solvedUpTo = Math.max(0, Math.min(LV.length, Number(localStorage.getItem(KEY)) || 0)); } catch (e) {}
      const mat = (k, c, em) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(.05, .05, .05); if (em) m.emissiveColor = new B.Color3(...em); return m; });
      const deskM = mat('desk', [.18, .18, .22], [.04, .04, .05]), metalM = mat('metal', [.55, .55, .6], [.12, .12, .14]);
      const nodes = [], keep = n => { n.parent = n.parent || ctx.frame; ctx.add(n); nodes.push(n); if (n.isPickable !== undefined) n.isPickable = false; return n; };
      const TEX = 1024, tex = new B.DynamicTexture('skTex', { width: TEX, height: TEX }, scene, true); tex.hasAlpha = false;
      const boardM = new B.StandardMaterial('skBoardMat', scene); boardM.diffuseTexture = tex; boardM.emissiveTexture = tex; boardM.emissiveColor = new B.Color3(.62, .62, .62); boardM.diffuseColor = new B.Color3(.55, .55, .55); boardM.specularColor = new B.Color3(0, 0, 0);
      const S = 4.4, TY = .95;
      { const t = keep(B.MeshBuilder.CreateBox('skDesk', { width: S + .5, height: .14, depth: S + .5 }, scene)); t.material = deskM; t.position.y = TY - .07;
        for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const l = keep(B.MeshBuilder.CreateBox('skLeg', { width: .12, height: TY - .14, depth: .12 }, scene)); l.material = metalM; l.position.set(x * (S / 2), (TY - .14) / 2, z * (S / 2)); } }
      const board = keep(B.MeshBuilder.CreateGround('skBoard', { width: S, height: S }, scene)); board.material = boardM; board.position.y = TY + .005; board.isPickable = true; board.metadata = { skBoard: true };
      // the towers that rise when the block is right: one box, thin instances (buffers set when they rise)
      const towerM = new B.StandardMaterial('skTowerMat', scene); towerM.diffuseColor = new B.Color3(1, 1, 1); towerM.specularColor = new B.Color3(.2, .2, .25); towerM.emissiveColor = new B.Color3(.18, .18, .2);
      const tower = keep(B.MeshBuilder.CreateBox('skTower', { size: 1 }, scene)); tower.material = towerM; tower.isVisible = false; tower.alwaysSelectAsActiveMesh = true;
      let bd = null; // { k, L, N, sol, val, given, notes, sel, notesOn, hist, hints, time, flash, X0, Y0, CS, rise }
      const st = { phase: 'pick', t: 0, dirty: false };
      const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
      function build(k) {
        const L = LV[k], N = L.n, CS = (TEX - 80) / (N + 2), X0 = (TEX - CS * N) / 2, Y0 = (TEX - CS * N) / 2;
        bd = { k, L, N, sol: [...L.sol].map(Number), given: [...L.given].map(Number), notes: new Array(N * N).fill(0), sel: 0, notesOn: false, hist: [], hints: 0, time: 0, flash: null, X0, Y0, CS, rise: 0 };
        bd.val = bd.given.slice(); bd.sel = bd.val.findIndex(v => !v); if (bd.sel < 0) bd.sel = 0;
        tower.isVisible = false; ctx.player.place(0, cam[2] - 1.6, 0); draw(); info();
      }
      const row = r => bd.val.slice(r * bd.N, r * bd.N + bd.N), col = c => bd.val.filter((_, i) => i % bd.N === c);
      function lines() { // each clue: [kind, index, value, line from its end]
        const out = [], N = bd.N, L = bd.L; for (let i = 0; i < N; i++) { out.push(['top', i, L.top[i], col(i)]); out.push(['bottom', i, L.bottom[i], col(i).reverse()]); out.push(['left', i, L.left[i], row(i)]); out.push(['right', i, L.right[i], row(i).reverse()]); } return out; }
      function clueState(v, line) { if (!v) return 0; const full = seenFrom(line); if (full >= 0) return full === v ? 1 : -1; // 1 met, -1 broken, 0 open
        const so = seenSoFar(line), left = line.filter(x => !x).length; if (so > v) return -1; return 0; }
      function dupes() { const N = bd.N, out = new Set(); for (let a = 0; a < N; a++) for (const idx of [[...Array(N).keys()].map(q => a * N + q), [...Array(N).keys()].map(q => q * N + a)]) { const by = {}; for (const i of idx) if (bd.val[i]) (by[bd.val[i]] = by[bd.val[i]] || []).push(i); for (const k in by) if (by[k].length > 1) by[k].forEach(i => out.add(i)); } return out; }
      const info = () => H.info(bd ? `Block ${bd.k + 1} / ${LV.length} · ${bd.L.name} · ${bd.N} × ${bd.N} · ${fmt(bd.time)}${bd.notesOn ? ' · notes on' : ''}${bd.hints ? ` · hints ${bd.hints}` : ''}` : 'Pick a block');
      const draw = () => { st.dirty = true; }; // painted once per frame at most
      const HC = ['#7f8fa6', '#5aa7c7', '#57b894', '#e2b04a', '#e07a4f', '#c45b8f', '#8f6bd1']; // a colour per height
      function building(g, x, y, C, v, N) { // a little tower icon: v storeys of windows
        const w = C * .34, h = C * (.2 + .55 * v / N), bx = x + C * .08, by = y + C * .9 - h; g.fillStyle = HC[(v - 1) % HC.length]; g.fillRect(bx, by, w, h);
        g.fillStyle = 'rgba(255,240,180,.8)'; const fl = v, fh = h / (fl + .5); for (let f = 0; f < fl; f++) for (const wx of [.22, .62]) g.fillRect(bx + w * wx, by + fh * (f + .35), w * .18, fh * .45); }
      function paint() {
        const g = tex.getContext(), { N, CS, X0, Y0 } = bd, won = st.phase === 'won' || st.phase === 'done', du = dupes();
        g.fillStyle = '#20232c'; g.fillRect(0, 0, TEX, TEX);
        g.strokeStyle = 'rgba(120,140,170,.15)'; g.lineWidth = 2; for (let a = 0; a < TEX; a += 32) { g.beginPath(); g.moveTo(a, 0); g.lineTo(a, TEX); g.stroke(); g.beginPath(); g.moveTo(0, a); g.lineTo(TEX, a); g.stroke(); } // blueprint paper
        for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { const i = r * N + c, x = X0 + c * CS, y = Y0 + r * CS, v = bd.val[i];
          g.fillStyle = (r + c) % 2 ? '#2b3140' : '#283040'; g.fillRect(x, y, CS, CS);
          if (v) { building(g, x, y, CS, v, N); g.fillStyle = du.has(i) ? '#ff6b5b' : bd.given[i] ? '#f2e6c8' : '#9fd6ff'; g.font = `bold ${Math.round(CS * .5)}px Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(v), x + CS * .68, y + CS * .52); }
          else if (bd.notes[i]) { const cols = N <= 4 ? 2 : 3, rows = Math.ceil(N / cols); g.fillStyle = 'rgba(180,200,230,.85)'; g.font = `${Math.round(CS * .22)}px Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
            for (let d = 1; d <= N; d++) if (bd.notes[i] & (1 << d)) { const q = d - 1; g.fillText(String(d), x + CS * ((q % cols) + .5) / cols, y + CS * (Math.floor(q / cols) + .55) / rows); } } }
        g.strokeStyle = 'rgba(150,170,200,.55)'; g.lineWidth = 2; for (let a = 0; a <= N; a++) { g.beginPath(); g.moveTo(X0 + a * CS, Y0); g.lineTo(X0 + a * CS, Y0 + N * CS); g.stroke(); g.beginPath(); g.moveTo(X0, Y0 + a * CS); g.lineTo(X0 + N * CS, Y0 + a * CS); g.stroke(); }
        g.lineWidth = 5; g.strokeStyle = 'rgba(200,215,240,.75)'; g.strokeRect(X0, Y0, N * CS, N * CS);
        // the clues round the edge: met fades, broken turns red
        g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `bold ${Math.round(CS * .5)}px Georgia, serif`;
        for (const [kind, i, v, line] of lines()) { if (!v) continue; const s = won ? 1 : clueState(v, line);
          const x = kind === 'left' ? X0 - CS * .55 : kind === 'right' ? X0 + N * CS + CS * .55 : X0 + (i + .5) * CS, y = kind === 'top' ? Y0 - CS * .55 : kind === 'bottom' ? Y0 + N * CS + CS * .55 : Y0 + (i + .5) * CS;
          g.fillStyle = s < 0 ? '#ff6b5b' : s > 0 ? 'rgba(242,230,200,.35)' : '#f2e6c8'; g.fillText(String(v), x, y); }
        if (st.phase === 'play' && bd.sel >= 0) { const x = X0 + (bd.sel % N) * CS, y = Y0 + Math.floor(bd.sel / N) * CS; g.strokeStyle = bd.notesOn ? 'rgba(160,210,255,.95)' : 'rgba(255,190,40,.95)'; g.lineWidth = 6; g.strokeRect(x + 3, y + 3, CS - 6, CS - 6); }
        if (bd.flash) { const x = X0 + (bd.flash.i % N) * CS, y = Y0 + Math.floor(bd.flash.i / N) * CS; g.strokeStyle = bd.flash.good ? '#2fd060' : '#e03030'; g.lineWidth = 8; g.strokeRect(x + 4, y + 4, CS - 8, CS - 8); }
        tex.update();
      }
      function setCell(i, v, asNote) { if (st.phase !== 'play' || bd.given[i]) return false;
        if (asNote) { if (bd.val[i] || !v) return false; bd.hist.push({ i, v: bd.val[i], n: bd.notes[i] }); bd.notes[i] ^= (1 << v); draw(); return true; }
        if (bd.val[i] === v) return false; const N = bd.N, r = Math.floor(i / N), c = i % N, peers = []; for (let q = 0; q < N; q++) { peers.push(r * N + q, q * N + c); }
        bd.hist.push({ i, v: bd.val[i], n: bd.notes[i], peers: v ? peers.map(j => [j, bd.notes[j]]) : null }); bd.val[i] = v; bd.notes[i] = 0; if (v) for (const j of peers) bd.notes[j] &= ~(1 << v);
        ctx.note(300 + v * 60, 'lantern'); draw(); check(); return true; }
      function write(v) { if (!bd || bd.sel < 0) return; setCell(bd.sel, v, bd.notesOn && v > 0); }
      function undo() { if (st.phase !== 'play' || !bd?.hist.length) return; const h = bd.hist.pop(); bd.val[h.i] = h.v; bd.notes[h.i] = h.n; if (h.peers) h.peers.forEach(([j, n]) => { bd.notes[j] = n; }); ctx.note(330, 'lantern'); draw(); }
      function hint() { if (st.phase !== 'play') return; const N = bd.N;
        let i = bd.val.findIndex((v, j) => v && !bd.given[j] && v !== bd.sol[j]);
        if (i >= 0) { bd.hist.push({ i, v: bd.val[i], n: bd.notes[i] }); bd.val[i] = 0; bd.hints++; bd.flash = { i, t: 0, good: false }; bd.sel = i; H.msg('This tower is wrong', 1300); draw(); info(); return; }
        // the empty square with the fewest heights left by its row and column
        let best = -1, bc = 99; for (let j = 0; j < N * N; j++) { if (bd.val[j]) continue; const r = Math.floor(j / N), c = j % N, used = new Set([...row(r), ...col(c)]); const n = N - [...used].filter(Boolean).length; if (n < bc) { bc = n; best = j; } }
        if (best < 0) return; bd.hist.push({ i: best, v: 0, n: bd.notes[best] }); bd.val[best] = bd.sol[best]; bd.notes[best] = 0; bd.hints++; bd.flash = { i: best, t: 0, good: true }; bd.sel = best; H.msg(`A ${bd.sol[best]}-storey tower`, 1300); draw(); info(); check(); }
      function check() { if (bd.val.some((v, i) => v !== bd.sol[i])) return false;
        st.phase = 'won'; st.wt = 0; pads.style.display = 'none'; ctx.sound('gamewin'); H.msg('The skyline is right', 1600, fmt(bd.time));
        if (bd.k + 1 > solvedUpTo) { solvedUpTo = bd.k + 1; try { localStorage.setItem(KEY, String(solvedUpTo)); } catch (e) {} }
        raise(); draw(); return true; }
      function raise() { // the towers rise out of the plan: buffers set now (with colours) and grown in update()
        const N = bd.N, n = N * N, mBuf = new Float32Array(16 * n), cBuf = new Float32Array(4 * n); bd.rise = .001; bd.tBuf = mBuf;
        for (let i = 0; i < n; i++) { const c = B.Color3.FromHexString(HC[(bd.sol[i] - 1) % HC.length]); cBuf.set([c.r, c.g, c.b, 1], i * 4); }
        towerMatrices(mBuf, .001); tower.thinInstanceSetBuffer('matrix', mBuf, 16, false); tower.thinInstanceSetBuffer('color', cBuf, 4, true); tower.isVisible = true; }
      function towerMatrices(buf, k) { const N = bd.N, cell = S * bd.CS / TEX, tmp = new B.Matrix();
        for (let i = 0; i < N * N; i++) { const r = Math.floor(i / N), c = i % N, h = bd.sol[i] * .16 * k, px = -S / 2 + (bd.X0 + (c + .5) * bd.CS) / TEX * S, pz = S / 2 - (bd.Y0 + (r + .5) * bd.CS) / TEX * S;
          B.Matrix.ComposeToRef(new B.Vector3(cell * .7, Math.max(.001, h), cell * .7), B.Quaternion.Identity(), new B.Vector3(px, TY + .01 + h / 2, pz), tmp); tmp.copyToArray(buf, i * 16); } }
      const hud = document.getElementById('gameHud');
      const pick = document.createElement('div');
      pick.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(420px,92vw);background:rgba(14,16,24,.95);border:1px solid rgba(160,200,255,.55);border-radius:14px;padding:16px;text-align:center;pointer-events:auto;font:15px/1.4 system-ui,sans-serif;color:#eee';
      const drawPick = () => { pick.innerHTML = `<div style="font:800 13px/1.2 system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#9fd6ff;margin-bottom:10px">Skyline View</div><div style="margin-bottom:12px;color:#bbb">One tower of each height in every row and column. The edge numbers count the towers you can see.</div>`
        + `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">${LV.map((L, k) => { const open = k <= solvedUpTo, ok = k < solvedUpTo; return `<button type="button" data-k="${k}" ${open ? '' : 'disabled'} style="padding:8px 2px;border-radius:9px;border:1px solid ${open ? '#9fd6ff' : '#444'};background:${ok ? 'rgba(159,214,255,.18)' : 'rgba(255,255,255,.04)'};color:${open ? '#fff' : '#666'};font:700 15px system-ui,sans-serif;cursor:${open ? 'pointer' : 'default'}">${open ? `${k + 1}${ok ? ' ✓' : ''}<div style="font:500 11px system-ui;color:#a9bcd6">${L.n} × ${L.n}</div>` : `${k + 1}<div style="font:500 11px system-ui">locked</div>`}</button>`; }).join('')}</div>`
          + `<div style="margin-top:10px;font-size:12px;color:#889">Keys 1-${LV.length} pick a block</div>`;
        pick.querySelectorAll('button[data-k]').forEach(b => b.onclick = (e) => { e.stopPropagation(); b.blur(); choose(+b.dataset.k); }); };
      const pads = document.createElement('div');
      pads.style.cssText = 'position:absolute;bottom:62px;right:14px;display:none;grid-template-columns:repeat(4,44px);gap:5px;pointer-events:auto';
      const padBtn = (t, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.style.cssText = 'height:40px;border-radius:8px;border:1px solid #9fd6ff;background:rgba(14,16,24,.88);color:#eef6ff;font:700 16px system-ui;cursor:pointer'; b.onclick = (e) => { e.stopPropagation(); b.blur(); fn(); }; pads.appendChild(b); return b; };
      let notesBtn = null;
      const drawPads = N => { pads.innerHTML = ''; for (let d = 1; d <= N; d++) padBtn(String(d), () => write(d)); notesBtn = padBtn('✎', () => toggleNotes()); padBtn('⌫', () => write(0)); padBtn('↶', undo); padBtn('?', hint); };
      function toggleNotes() { if (!bd) return; bd.notesOn = !bd.notesOn; if (notesBtn) notesBtn.style.background = bd.notesOn ? 'rgba(90,140,200,.75)' : 'rgba(14,16,24,.88)'; info(); draw(); }
      function choose(k) { if (st.phase !== 'pick' || k > solvedUpTo || k >= LV.length) return; pick.remove(); st.phase = 'play'; build(k); drawPads(bd.N); pads.style.display = 'grid'; H.msg(`Block ${k + 1}`, 900, `${LV[k].name}: ${LV[k].n} × ${LV[k].n}`); }
      hud.append(pick, pads); drawPick();
      const cam = [0, TY + 6.3, -3.4], at = [0, TY, -.3];
      ctx.player.place(0, cam[2] - 1.6, 0); ctx.look(cam, at, def.fov || .8); // the player waits behind the camera, out of the picture
      { const g = tex.getContext(); g.fillStyle = '#20232c'; g.fillRect(0, 0, TEX, TEX); tex.update(); }
      H.title(def.title || 'Skyline View'); H.score(''); info();
      H.hint('Click a square and type its height (<kbd>N</kbd> notes, <kbd>0</kbd> rub out). <kbd>U</kbd> undo, <kbd>H</kbd> hint.');
      const cellAt = () => { const hit = scene.pickWithRay(ctx.ray(), m => m.metadata?.skBoard); if (!hit?.pickedPoint) return null; const l = ctx.toLocal(hit.pickedPoint);
        const px = (l.x + S / 2) / S * TEX, py = (S / 2 - l.z) / S * TEX, c = Math.floor((px - bd.X0) / bd.CS), r = Math.floor((py - bd.Y0) / bd.CS); return c >= 0 && c < bd.N && r >= 0 && r < bd.N ? r * bd.N + c : null; };
      return {
        update(dt) {
          ctx.look(cam, at); st.t += dt; if (!bd) return; if (st.dirty) { st.dirty = false; paint(); }
          if (st.phase === 'play') { const s = Math.floor(bd.time); bd.time += dt; if (Math.floor(bd.time) !== s) info(); }
          if (bd.flash && (bd.flash.t += dt) > 1.6) { bd.flash = null; draw(); }
          if (bd.rise && bd.rise < 1) { bd.rise = Math.min(1, bd.rise + dt * .8); towerMatrices(bd.tBuf, 1 - Math.pow(1 - bd.rise, 3)); tower.thinInstanceBufferUpdated('matrix'); tower.thinInstanceRefreshBoundingInfo(false); }
          if (st.phase === 'won' && (st.wt += dt) > 2.4) { st.phase = 'done'; H.hint(''); const k = bd.k;
            ctx.finish({ score: (k + 1) * 20 + (bd.hints ? 0 : 10), label: 'points', solved: true, extra: `${bd.L.name} (block ${k + 1}, ${bd.N} × ${bd.N}) planned in ${fmt(bd.time)}${bd.hints ? `, ${bd.hints} hint${bd.hints > 1 ? 's' : ''}` : ''}.${k + 1 < LV.length ? ` Block ${k + 2} is open.` : ' Every block is built.'}` }); }
        },
        key(e, down) {
          if (!down || e.repeat) return; const k = e.key.toLowerCase();
          if (st.phase === 'pick') { const n = parseInt(k, 10); if (n >= 1 && n <= LV.length) choose(n - 1); return; }
          if (st.phase !== 'play') return; const N = bd.N, x = bd.sel % N, y = Math.floor(bd.sel / N);
          if (k === 'arrowup' || k === 'w') { bd.sel = ((y - 1 + N) % N) * N + x; draw(); } else if (k === 'arrowdown' || k === 's') { bd.sel = ((y + 1) % N) * N + x; draw(); }
          else if (k === 'arrowleft' || k === 'a') { bd.sel = y * N + (x - 1 + N) % N; draw(); } else if (k === 'arrowright' || k === 'd') { bd.sel = y * N + (x + 1) % N; draw(); }
          else if (/^[0-9]$/.test(k)) { const v = +k; if (v <= N) write(v); } else if (k === 'backspace' || k === 'delete') write(0);
          else if (k === 'n') toggleNotes(); else if (k === 'u' || (k === 'z' && (e.ctrlKey || e.metaKey))) undo(); else if (k === 'h') hint();
        },
        pointer(evt) { const T = B.PointerEventTypes; if (st.phase !== 'play' || !bd) return; if (evt.type === T.POINTERDOWN) { const i = cellAt(); if (i != null) { bd.sel = i; draw(); } } },
        _test: { st, choose, setCell, write, undo, hint, toggleNotes, dupes, lines, clueState, get bd() { return bd; }, LV, draw: () => { st.dirty = false; paint(); }, unlock(k) { solvedUpTo = k; drawPick(); } },
        dispose() { pick.remove(); pads.remove(); nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); try { boardM.dispose(); tex.dispose(); towerM.dispose(); } catch (e) {} }
      };
    }
  };
  window.RebelGames.register('sky', G);
})();
