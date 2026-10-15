// The Temple Abacus (Oct 15, Sohei): fill the grid so every row and column holds each number once. Heavy lines mark
// cages; the small sign in a cage's corner is its sum (+), difference (−), product (×) or quotient (÷) of the numbers
// inside, in any order (a lone number is given). Seven tablets from 4 x 4 to the 7 x 7 Master's Abacus, each with one
// answer (checked by a solver; the last ones need "what if" reasoning). N pencil notes, U undo, H hint (no clean bonus).
// Score: the tablet x 20, +10 without a hint. def: { levels, pass, points }
(function () {
  const LEVELS = [
    { name: "The Novice's Beads", n: 4, s: '1342412332142431', cages: [[[15,14],'/',3],[[0,1,5],'+',5],[[11,10,9],'+',7],[[6,2],'*',8],[[4,8],'*',12],[[3,7],'*',6],[[13,12],'/',2]] },
    { name: "Morning Sums", n: 5, s: '3241514352215435312445231', cages: [[[0,1],'-',1],[[22,21],'*',10],[[24,19],'+',5],[[23,18,17,16],'+',9],[[7,8],'-',2],[[12,11],'/',5],[[6,5],'/',4],[[14,13,9,4],'*',120],[[3,2],'*',4],[[15,20,10],'*',40]] },
    { name: "The Prayer Count", n: 5, s: '1452352314231453145245231', cages: [[[12,11,6],'+',6],[[3,4],'+',5],[[22,17],'-',2],[[1,2,0],'*',20],[[8,7],'/',3],[[16,15],'/',3],[[20,21],'+',9],[[24,23,19],'*',6],[[5,10],'+',7],[[9,14],'+',9],[[13,18],'+',9]] },
    { name: "The Bell Tower", n: 6, s: '412536563421356214241365635142124653', cages: [[[0,1,7],'+',11],[[32,33,31],'+',12],[[12,13,6],'+',13],[[16,22],'/',6],[[20,19,18],'+',7],[[26,27],'-',4],[[11,17,10],'*',8],[[4,5],'*',18],[[30,24],'+',7],[[25],'=',3],[[15,21,14],'+',11],[[28,34],'+',9],[[3,2],'*',10],[[9,8],'-',1],[[35,29,23],'*',30]] },
    { name: "The Abbot's Tally", n: 6, s: '632451456123215364124635361542543216', cages: [[[23,22,29],'*',30],[[14,20],'+',9],[[1,0],'*',18],[[8,7,9,10],'+',14],[[13,19],'*',2],[[11,17,16],'+',13],[[25,26],'/',6],[[12,6],'/',2],[[30,31,32],'*',60],[[24,18],'-',2],[[35,34,28],'*',24],[[4,5],'/',5],[[33,27],'*',10],[[15,21],'-',3],[[3,2],'+',6]] },
    { name: "Evening Abacus", n: 6, s: '254163312654463512536421621345145236', cages: [[[34,33,35],'+',11],[[1,7,6],'+',9],[[2,8],'+',6],[[26,20,27],'*',18],[[21,22],'/',2],[[28,29,23],'+',10],[[15,16,10],'*',25],[[19,18],'-',2],[[0],'=',2],[[32,31],'-',1],[[17,11,5],'+',9],[[14,13,12],'+',13],[[3,4,9],'+',13],[[30,24,25],'+',9]] },
    { name: "The Master's Abacus", n: 7, s: '6325471754132621365475264713147326546571323712654', cages: [[[6,13,20],'+',14],[[25,32],'*',14],[[42,35],'+',7],[[37,44],'/',5],[[18,19,17],'+',15],[[1,2],'+',5],[[0,7],'+',13],[[43,36],'+',13],[[23,30],'+',13],[[33,34],'-',1],[[24,31],'+',7],[[47,48],'-',1],[[28,29],'/',4],[[45,46,38,39],'*',84],[[26,27],'/',3],[[11,10],'/',3],[[14,15,16],'*',6],[[40,41],'*',6],[[4,5,12,3],'+',18],[[9,8],'*',20],[[21,22],'-',3]] }
  ];
  const OPS = { '+': '+', '-': '−', '*': '×', '/': '÷', '=': '' };
  const G = {
    title: 'The Temple Abacus',
    start(ctx) {
      const B = ctx.B, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const LV = def.levels || LEVELS, KEY = 'rebelAntsAbacusProgress:' + (def.id || 'kenken');
      let solvedUpTo = 0; try { solvedUpTo = Math.max(0, Math.min(LV.length, Number(localStorage.getItem(KEY)) || 0)); } catch (e) {}
      const mat = (k, c, em) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(.05, .05, .05); if (em) m.emissiveColor = new B.Color3(...em); return m; });
      const woodM = mat('stand', [.42, .24, .1], [.1, .055, .02]), brassM = mat('beads', [.82, .5, .16], [.24, .13, .03]);
      const nodes = [], keep = n => { n.parent = n.parent || ctx.frame; ctx.add(n); nodes.push(n); if (n.isPickable !== undefined) n.isPickable = false; return n; };
      const TEX = 1024, tex = new B.DynamicTexture('kkTex', { width: TEX, height: TEX }, scene, true); tex.hasAlpha = false;
      const boardM = new B.StandardMaterial('kkBoardMat', scene); boardM.diffuseTexture = tex; boardM.emissiveTexture = tex; boardM.emissiveColor = new B.Color3(.58, .58, .58); boardM.diffuseColor = new B.Color3(.58, .58, .58); boardM.specularColor = new B.Color3(0, 0, 0);
      const S = 3.9, TY = .8;
      { const t = keep(B.MeshBuilder.CreateBox('kkStand', { width: S + .5, height: .14, depth: S + .5 }, scene)); t.material = woodM; t.position.y = TY - .07;
        for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const l = keep(B.MeshBuilder.CreateBox('kkLeg', { width: .18, height: TY - .14, depth: .18 }, scene)); l.material = woodM; l.position.set(x * (S / 2), (TY - .14) / 2, z * (S / 2)); }
        // an abacus rail with beads along the far edge
        const rail = keep(B.MeshBuilder.CreateBox('kkRail', { width: S + .3, height: .05, depth: .05 }, scene)); rail.material = woodM; rail.position.set(0, TY + .14, S / 2 + .12);
        const bead = keep(B.MeshBuilder.CreateSphere('kkBead', { diameter: .11, segments: 8 }, scene)); bead.material = brassM; bead.scaling.y = .7; bead.position.set(-S / 2 + .1, TY + .14, S / 2 + .12);
        for (let i = 1; i < 14; i++) { const b2 = bead.createInstance('kkBead' + i); keep(b2); b2.position.set(-S / 2 + .1 + i * .13 + (i > 6 ? .9 : 0), TY + .14, S / 2 + .12); } }
      const board = keep(B.MeshBuilder.CreateGround('kkBoard', { width: S, height: S }, scene)); board.material = boardM; board.position.y = TY + .005; board.isPickable = true; board.metadata = { kkBoard: true };
      let bd = null; // { k, N, L, sol[], val[], giv[], notes[], cageOf[], cages[], sel, notesOn, hist[], hints, time, flash }
      const st = { phase: 'pick', t: 0 };
      const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
      function build(k) {
        const L = LV[k], N = L.n; bd = { k, N, L, sol: [...L.s].map(Number), giv: new Array(N * N).fill(0), notes: new Array(N * N).fill(0), cageOf: new Int16Array(N * N), cages: L.cages.map(([cells, op, t]) => ({ cells, op, t, top: Math.min(...cells) })), sel: -1, notesOn: false, hist: [], hints: 0, time: 0, flash: null };
        bd.cages.forEach((cg, j) => { cg.cells.forEach(i => bd.cageOf[i] = j); if (cg.op === '=') bd.giv[cg.cells[0]] = cg.t; });
        bd.val = bd.giv.slice(); bd.sel = bd.val.findIndex(v => !v);
        ctx.player.place(0, S / 2 + 1.3, Math.PI); draw(); info(); }
      const info = () => H.info(bd ? `Tablet ${bd.k + 1} / ${LV.length} · ${bd.L.name} · ${bd.N} × ${bd.N} · ${fmt(bd.time)}${bd.notesOn ? ' · notes on' : ''}${bd.hints ? ` · hints ${bd.hints}` : ''}` : 'Pick a tablet');
      const peersOf = i => { const N = bd.N, r = Math.floor(i / N), c = i % N, p = []; for (let q = 0; q < N; q++) { if (q !== c) p.push(r * N + q); if (q !== r) p.push(q * N + c); } return p; };
      function cageOk(cg) { const v = cg.cells.map(i => bd.val[i]); if (v.some(x => !x)) return null;
        if (cg.op === '=') return v[0] === cg.t; if (cg.op === '+') return v.reduce((a, b) => a + b, 0) === cg.t; if (cg.op === '*') return v.reduce((a, b) => a * b, 1) === cg.t;
        if (cg.op === '-') return Math.abs(v[0] - v[1]) === cg.t; return Math.max(v[0], v[1]) / Math.min(v[0], v[1]) === cg.t; }
      function conflicts() { const bad = new Set(), N = bd.N; for (let i = 0; i < N * N; i++) if (bd.val[i]) for (const j of peersOf(i)) if (bd.val[j] === bd.val[i]) { bad.add(i); bad.add(j); }
        bd.cages.forEach(cg => { if (cageOk(cg) === false) cg.cells.forEach(i => bad.add(i)); }); return bad; }
      function draw() {
        const g = tex.getContext(), N = bd.N, M = 26, C = (TEX - 2 * M) / N, bad = conflicts(), sv = bd.sel >= 0 ? bd.val[bd.sel] : 0;
        const grd = g.createRadialGradient(TEX / 2, TEX / 2, TEX * .2, TEX / 2, TEX / 2, TEX * .75); grd.addColorStop(0, '#f3e1b8'); grd.addColorStop(1, '#ddbf86'); g.fillStyle = grd; g.fillRect(0, 0, TEX, TEX);
        for (let i = 0; i < N * N; i++) { const r = Math.floor(i / N), c = i % N, x = M + c * C, y = M + r * C; let fill = null;
          if (bd.sel >= 0) { const sr = Math.floor(bd.sel / N), sc = bd.sel % N; if (r === sr || c === sc) fill = 'rgba(255,200,110,.28)'; if (bd.cageOf[i] === bd.cageOf[bd.sel]) fill = 'rgba(240,160,60,.3)'; if (sv && bd.val[i] === sv) fill = 'rgba(120,165,255,.3)'; }
          if (bad.has(i)) fill = 'rgba(220,40,40,.3)'; if (i === bd.sel) fill = 'rgba(255,170,40,.6)'; if (bd.flash && bd.flash.i === i) fill = bd.flash.good ? 'rgba(80,200,110,.55)' : 'rgba(230,40,40,.6)';
          if (fill) { g.fillStyle = fill; g.fillRect(x, y, C, C); }
          const v = bd.val[i];
          if (v) { const given = !!bd.giv[i]; g.fillStyle = given ? '#2a1606' : bad.has(i) ? '#c01818' : '#8a3a06'; g.font = `${given ? 'bold ' : ''}${Math.round(C * .56)}px Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(v), x + C / 2, y + C * .6); }
          else if (bd.notes[i]) { const cols = N <= 4 ? 2 : N <= 6 ? 3 : 4, rows = Math.ceil(N / cols); g.fillStyle = 'rgba(80,45,15,.85)'; g.font = `${Math.round(C * .2)}px Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
            for (let d = 1; d <= N; d++) if (bd.notes[i] & (1 << d)) { const q = d - 1, cx = x + C * ((q % cols) + .5) / cols, cy = y + C * (.3 + .7 * (Math.floor(q / cols) + .5) / rows); g.fillText(String(d), cx, cy); } } }
        g.strokeStyle = 'rgba(90,55,20,.45)'; g.lineWidth = 2; g.beginPath(); for (let k = 0; k <= N; k++) { g.moveTo(M + k * C, M); g.lineTo(M + k * C, TEX - M); g.moveTo(M, M + k * C); g.lineTo(TEX - M, M + k * C); } g.stroke();
        // cage walls: wherever two neighbours sit in different cages, and round the board
        g.strokeStyle = '#3a1e08'; g.lineWidth = 7; g.lineCap = 'round'; g.beginPath();
        for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { const i = r * N + c, x = M + c * C, y = M + r * C;
          if (c + 1 < N && bd.cageOf[i] !== bd.cageOf[i + 1]) { g.moveTo(x + C, y); g.lineTo(x + C, y + C); } if (r + 1 < N && bd.cageOf[i] !== bd.cageOf[i + N]) { g.moveTo(x, y + C); g.lineTo(x + C, y + C); } }
        g.rect(M, M, TEX - 2 * M, TEX - 2 * M); g.stroke();
        g.textAlign = 'left'; g.textBaseline = 'top'; g.font = `bold ${Math.round(C * .2)}px system-ui, sans-serif`;
        bd.cages.forEach(cg => { if (cg.op === '=') return; const r = Math.floor(cg.top / N), c = cg.top % N, ok = cageOk(cg); g.fillStyle = ok === false ? '#c01818' : ok ? '#2f7a2a' : '#3a1e08'; g.fillText(`${cg.t}${OPS[cg.op]}`, M + c * C + C * .08, M + r * C + C * .06); });
        tex.update();
      }
      function select(i) { if (!bd) return; bd.sel = i; }
      function moveSel(dx, dy) { if (!bd) return; const N = bd.N; const i = bd.sel < 0 ? 0 : bd.sel, r = (Math.floor(i / N) + dy + N) % N, c = (i % N + dx + N) % N; select(r * N + c); draw(); }
      function setCell(i, v, asNote) {
        if (st.phase !== 'play' || i < 0 || bd.giv[i]) return false;
        if (asNote) { if (bd.val[i]) return false; bd.hist.push({ i, v: bd.val[i], n: bd.notes[i] }); bd.notes[i] ^= (1 << v); draw(); return true; }
        if (bd.val[i] === v) return false; const pe = peersOf(i);
        bd.hist.push({ i, v: bd.val[i], n: bd.notes[i], peers: v ? pe.map(j => [j, bd.notes[j]]) : null });
        bd.val[i] = v; bd.notes[i] = 0; if (v) for (const j of pe) bd.notes[j] &= ~(1 << v);
        ctx.note(v ? 560 + v * 50 : 300, 'bell'); draw(); check(); return true;
      }
      function write(v) { if (!bd || bd.sel < 0) return; setCell(bd.sel, v, bd.notesOn && v > 0); }
      function undo() { if (st.phase !== 'play' || !bd?.hist.length) return; const h = bd.hist.pop(); bd.val[h.i] = h.v; bd.notes[h.i] = h.n; if (h.peers) h.peers.forEach(([j, n]) => { bd.notes[j] = n; }); select(h.i); draw(); }
      function hint() {
        if (st.phase !== 'play' || !bd) return; const N = bd.N;
        const wrong = bd.val.findIndex((v, i) => v && !bd.giv[i] && v !== bd.sol[i]); bd.hints++; info();
        if (wrong >= 0) { select(wrong); bd.flash = { i: wrong, t: 0, good: false }; H.msg('This one is wrong', 1300); draw(); return; }
        const cands = i => { let n = 0; for (let d = 1; d <= N; d++) if (!peersOf(i).some(j => bd.val[j] === d)) n++; return n * 10 + bd.cages[bd.cageOf[i]].cells.length; };
        let best = -1, bn = 1e9; if (bd.sel >= 0 && !bd.val[bd.sel]) { best = bd.sel; bn = cands(bd.sel); }
        if (bn > 19) for (let i = 0; i < N * N; i++) if (!bd.val[i]) { const n = cands(i); if (n < bn) { bn = n; best = i; } }
        if (best < 0) return; select(best); bd.flash = { i: best, t: 0, good: true }; H.msg(`This one is ${bd.sol[best]}`, 1300); setCell(best, bd.sol[best], false);
      }
      function check() { if (!bd.val.every((v, i) => v === bd.sol[i])) return;
        st.phase = 'won'; st.wt = 0; bd.sel = -1; draw(); pads.style.display = 'none'; ctx.sound('gamewin'); H.msg('The abacus balances', 1600, fmt(bd.time));
        if (bd.k + 1 > solvedUpTo) { solvedUpTo = bd.k + 1; try { localStorage.setItem(KEY, String(solvedUpTo)); } catch (e) {} } }
      const hud = document.getElementById('gameHud');
      const pick = document.createElement('div');
      pick.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(400px,92vw);background:rgba(26,14,4,.95);border:1px solid rgba(240,170,70,.6);border-radius:14px;padding:16px;text-align:center;pointer-events:auto;font:15px/1.4 system-ui,sans-serif;color:#eee';
      const drawPick = () => { pick.innerHTML = `<div style="font:800 13px/1.2 system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#f3b45a;margin-bottom:10px">The Temple Abacus</div><div style="margin-bottom:12px;color:#bbb">Each number once per row and column; every cage makes its sign.</div>`
        + `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">${LV.map((L, k) => { const open = k <= solvedUpTo, ok = k < solvedUpTo; return `<button type="button" data-k="${k}" ${open ? '' : 'disabled'} style="padding:8px 2px;border-radius:9px;border:1px solid ${open ? '#f3b45a' : '#444'};background:${ok ? 'rgba(243,180,90,.2)' : 'rgba(255,255,255,.04)'};color:${open ? '#fff' : '#666'};font:700 15px system-ui,sans-serif;cursor:${open ? 'pointer' : 'default'}">${open ? `${k + 1}<div style="font:11px system-ui;opacity:.75">${L.n}×${L.n}</div>` : '🔒'}${ok ? ' ✓' : ''}</button>`; }).join('')}</div>`;
        pick.querySelectorAll('button[data-k]').forEach(b => b.onclick = (e) => { e.stopPropagation(); b.blur(); choose(+b.dataset.k); }); };
      const pads = document.createElement('div');
      pads.style.cssText = 'position:absolute;bottom:62px;right:14px;display:none;grid-template-columns:repeat(4,42px);gap:5px;pointer-events:auto';
      const padBtn = (t, fn, wide) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.style.cssText = `height:40px;${wide ? 'grid-column:span 2;' : ''}border-radius:8px;border:1px solid #d79a4a;background:rgba(30,16,4,.86);color:#fff0d8;font:700 16px Georgia,serif;cursor:pointer`; b.onclick = (e) => { e.stopPropagation(); b.blur(); fn(); }; pads.appendChild(b); return b; };
      let notesBtn = null;
      const drawPads = N => { pads.innerHTML = ''; for (let d = 1; d <= N; d++) padBtn(String(d), () => write(d)); notesBtn = padBtn('✎', () => toggleNotes()); padBtn('⌫', () => write(0)); padBtn('↶', undo); padBtn('Hint', hint, true); };
      function toggleNotes() { if (!bd) return; bd.notesOn = !bd.notesOn; if (notesBtn) notesBtn.style.background = bd.notesOn ? 'rgba(215,154,74,.75)' : 'rgba(30,16,4,.86)'; info(); }
      function choose(k) { if (st.phase !== 'pick' || k > solvedUpTo || k >= LV.length) return; pick.remove(); st.phase = 'play'; build(k); drawPads(bd.N); pads.style.display = 'grid'; H.msg(`Tablet ${k + 1}`, 900, LV[k].name); }
      hud.append(pick, pads); drawPick();
      const cam = [0, TY + 5.9, -3.35], at = [0, TY, -.3];
      ctx.player.place(0, S / 2 + 1.3, Math.PI); ctx.look(cam, at, def.fov || .8);
      { const g = tex.getContext(); g.fillStyle = '#ead3a2'; g.fillRect(0, 0, TEX, TEX); tex.update(); }
      H.title(def.title || 'The Temple Abacus'); H.score(''); info();
      H.hint('Click a square, type its number. <kbd>N</kbd> pencil notes, <kbd>0</kbd> rub out, <kbd>U</kbd> undo, <kbd>H</kbd> hint.');
      return {
        update(dt) {
          ctx.look(cam, at); st.t += dt; if (!bd) return;
          if (st.phase === 'play') { const s = Math.floor(bd.time); bd.time += dt; if (Math.floor(bd.time) !== s) info(); }
          if (bd.flash && (bd.flash.t += dt) > 1.2) { bd.flash = null; draw(); }
          if (st.phase === 'won' && (st.wt += dt) > 1.8) { st.phase = 'done'; H.hint(''); const k = bd.k;
            ctx.finish({ score: (k + 1) * 20 + (bd.hints ? 0 : 10), label: 'points', solved: true, extra: `${bd.L.name} (tablet ${k + 1}, ${bd.N} × ${bd.N}) balanced in ${fmt(bd.time)}${bd.hints ? `, ${bd.hints} hint${bd.hints > 1 ? 's' : ''}` : ''}.${k + 1 < LV.length ? ` Tablet ${k + 2} is open.` : ' Every tablet balances.'}` }); }
        },
        key(e, down) {
          if (!down || e.repeat) return; const k = e.key.toLowerCase();
          if (st.phase === 'pick') { const n = parseInt(k, 10); if (n >= 1 && n <= LV.length) choose(n - 1); return; }
          if (st.phase !== 'play') return;
          if (/^[1-9]$/.test(k) && +k <= bd.N) write(+k); else if (k === '0' || k === 'backspace' || k === 'delete') write(0);
          else if (k === 'arrowup' || k === 'w') moveSel(0, -1); else if (k === 'arrowdown' || k === 's') moveSel(0, 1); else if (k === 'arrowleft' || k === 'a') moveSel(-1, 0); else if (k === 'arrowright' || k === 'd') moveSel(1, 0);
          else if (k === 'n' || k === 'p') toggleNotes(); else if (k === 'u' || k === 'z') undo(); else if (k === 'h') hint();
        },
        pointer(evt) {
          if (evt.type !== B.PointerEventTypes.POINTERDOWN || st.phase !== 'play' || !bd) return;
          const hit = scene.pickWithRay(ctx.ray(), m => m.metadata?.kkBoard); if (!hit?.pickedPoint) return;
          const l = ctx.toLocal(hit.pickedPoint), N = bd.N, M = 26 / TEX * S, C = (S - 2 * M) / N, c = Math.floor((l.x + S / 2 - M) / C), r = Math.floor((S / 2 - M - l.z) / C);
          if (c >= 0 && c < N && r >= 0 && r < N) { select(r * N + c); draw(); }
        },
        _test: { st, choose, setCell, write, undo, hint, select, moveSel, toggleNotes, conflicts, cageOk, get bd() { return bd; }, LV, unlock(k) { solvedUpTo = k; drawPick(); } },
        dispose() { pick.remove(); pads.remove(); nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); try { boardM.dispose(); tex.dispose(); } catch (e) {} }
      };
    }
  };
  window.RebelGames.register('kenken', G);
})();
