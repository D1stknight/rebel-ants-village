// The Pilgrim's Path (Oct 15, Yamabushi): the pilgrim's steps are numbered from 1 to the last; each number touches
// the next one, side by side or corner to corner, and every open stone is stepped on once (rocks are not). Some
// steps are carved already. Click a number to take it up as the pen, then click a stone beside it to write the next
// step (or type a number into any stone). Seven trails from 5 x 5 to the 10 x 10 Summit, each with one answer
// (checked by a solver). U undo, H hint (no clean bonus). Score: the trail x 20, +10 without a hint.
// Oct 17: How to play (the rules + a solved 4 x 4 trail, howto/hidato.png) and Restart (only the carved steps again).
// Oct 17 (Miguel: "10 trails"): three more, 11 x 10, 12 x 11 and 12 x 12 with 104, 124 and 135 steps (the Summit has
// 94), from the Oct 15 generator (scratchpad lv/hidato/gen.mjs: carved steps taken away while its counting search still
// finds one answer), the fewest carved of ten each (29-32 %). A SAT model written apart from it proves one answer too
// (lv/hidato/sat.py; all ten pass). Trails 11 stones across and up are seen from higher up, so the far rows stay legible.
// def: { levels, pass, points }
(function () {
  const LEVELS = [
    { name: "The Foot of the Mountain", w: 5, h: 5, open: '1111111111111111111111111', sol: [9,10,12,13,14,8,11,18,17,15,7,1,19,20,16,2,6,21,24,25,3,4,5,22,23], given: [0,1,2,3,6,11,12,14,19,20,23,24] },
    { name: "The Shrine Steps", w: 6, h: 6, open: '111111111111111111111101011111111111', sol: [33,34,1,2,3,4,32,31,30,27,7,5,20,29,28,26,8,6,19,21,25,24,0,9,0,18,22,23,13,10,17,16,15,14,12,11], given: [1,2,6,8,10,11,13,16,19,20,25,26,27,34] },
    { name: "Misty Ridge", w: 7, h: 7, open: '1110111111111111111101111111111111111111110111111', sol: [2,3,4,0,12,13,14,1,5,9,11,17,16,15,6,8,10,18,19,20,0,7,27,26,25,24,23,21,28,30,31,38,39,40,22,29,32,35,37,45,46,41,0,33,34,36,44,43,42], given: [5,6,7,11,15,16,25,27,30,31,34,35,37,39,40,43] },
    { name: "The Waterfall Trail", w: 8, h: 8, open: '1011111111111111111111111111111111111111111111111111111001110111', sol: [17,0,19,20,21,22,23,24,16,18,38,37,36,28,27,25,15,39,41,46,47,35,29,26,14,40,42,45,48,49,34,30,12,13,43,44,50,51,33,31,11,10,9,1,54,53,52,32,6,7,8,2,55,56,58,0,0,5,4,3,0,57,60,59], given: [2,7,11,16,17,18,20,22,26,29,32,34,36,39,41,43,45,47,50,52,57,61,62] },
    { name: "The Hermit's Climb", w: 9, h: 8, open: '111111111111110111111111111111111111101111111111101111111111011111101111', sol: [30,31,33,35,36,37,38,39,40,29,32,34,65,64,0,44,43,41,14,28,27,66,67,63,57,45,42,13,15,25,26,62,61,58,56,46,12,0,16,24,23,60,59,55,47,10,11,1,17,0,22,54,53,48,8,9,5,2,18,21,0,52,49,7,6,4,3,0,19,20,51,50], given: [1,10,11,15,16,19,21,22,29,31,33,35,41,45,47,48,51,54,62,65,71] },
    { name: "The Spirit Peak", w: 10, h: 9, open: '111111111111111111111111111111111111001111101111101111111111011111111111011111111111111111', sol: [28,27,26,18,17,15,13,11,9,8,29,30,31,25,19,16,14,12,10,7,36,35,32,24,22,20,1,2,6,5,37,38,34,33,23,21,0,0,3,4,39,41,42,0,57,59,60,82,84,0,40,43,44,56,58,61,77,83,81,80,0,45,54,55,62,75,76,78,79,71,46,49,0,53,63,65,74,73,72,70,47,48,50,51,52,64,66,67,68,69], given: [1,8,10,12,15,16,17,18,24,26,29,30,34,41,42,44,48,51,55,57,62,66,67,69,75,76,81,82,87] },
    { name: "The Summit", w: 10, h: 10, open: '0111111111111111111101111111111111111011111111111111111111111111111111111110111111101111111101111111', sol: [0,5,4,3,2,1,26,27,28,29,6,7,8,9,10,25,36,35,31,30,0,13,12,11,24,75,74,37,34,32,14,16,17,23,77,76,73,0,38,33,15,18,22,80,79,78,72,52,40,39,19,21,84,82,81,71,66,53,51,41,20,86,85,83,70,67,65,54,50,42,87,92,93,69,68,0,64,55,49,43,88,94,91,0,62,63,58,56,48,44,89,90,0,61,60,59,57,47,46,45], given: [2,5,9,11,12,13,17,18,25,30,34,41,43,49,50,52,54,58,63,64,67,68,72,76,78,81,84,91,96,97] },
    // Oct 17: 104 / 124 / 135 steps (scratchpad lv/hidato)
    { name: "The Cloud Path", w: 11, h: 10, open: '11111111001111111111111111111111111111111111111011111110111111111111111111111111111111111110111111111110111111', sol: [65,64,52,51,39,38,30,29,0,0,25,66,67,63,53,50,40,37,31,28,26,24,71,70,68,62,54,49,41,36,32,27,23,72,74,69,61,59,55,48,42,35,33,22,73,75,76,0,60,58,56,47,43,34,21,0,77,89,102,103,100,57,46,44,20,19,78,88,90,104,101,99,96,45,17,18,1,79,87,91,92,98,97,95,16,15,8,2,80,86,85,0,93,94,13,14,9,7,3,81,82,83,84,0,12,11,10,6,5,4], given: [4,11,12,14,21,22,31,34,38,39,46,48,53,59,60,63,64,67,69,72,73,76,77,84,89,95,97,101,105,109] },
    { name: "The Wind Ridge", w: 12, h: 11, open: '111111101111101111011101111011111111111111111111111111110111111111111111111110111111111111111111111111111111111111111111111111111110', sol: [4,3,2,1,12,13,14,0,72,73,76,77,5,0,9,11,16,15,0,71,74,75,0,78,6,8,10,0,17,18,68,70,83,82,81,79,7,22,21,20,19,61,67,69,84,85,86,80,23,25,26,40,60,62,64,66,0,106,88,87,24,27,39,41,59,63,65,123,122,107,105,89,28,38,42,56,58,0,120,121,124,108,104,90,29,37,43,55,57,114,119,118,117,109,103,91,30,36,44,49,54,113,115,116,110,102,97,92,31,35,45,48,50,53,112,111,101,98,96,93,32,33,34,46,47,51,52,100,99,95,94,0], given: [1,3,17,20,21,26,28,31,33,41,42,43,44,46,48,50,51,53,54,59,67,70,73,75,80,82,85,87,90,91,97,99,101,104,108,111,112,116,118,130] },
    { name: "The Heavenly Stair", w: 12, h: 12, open: '111101111111111111101011111111111101111111111111111110111111111111111111111111111111111111111111111101111101111111011111111111110111111111111111', sol: [121,122,51,50,0,46,45,44,1,2,3,4,120,123,124,52,49,48,47,0,43,0,6,5,119,126,125,89,53,54,55,58,59,42,0,7,118,127,128,90,88,56,57,62,61,60,41,8,117,129,131,91,87,0,63,64,65,66,40,9,116,130,132,133,92,86,71,70,68,67,39,10,114,115,135,134,93,85,83,72,69,38,33,11,108,113,112,111,94,84,82,73,37,34,32,12,107,109,110,95,0,81,74,36,35,31,0,13,102,106,105,96,80,75,0,25,26,30,29,14,101,103,104,97,79,76,24,21,0,27,28,15,100,99,98,78,77,23,22,20,19,18,17,16], given: [1,5,8,11,14,16,18,22,26,29,30,37,39,42,44,50,55,58,63,64,69,71,72,74,77,78,80,81,84,86,87,90,93,105,108,118,122,129,134,135,137,139] }
  ];
  const G = {
    title: "The Pilgrim's Path",
    howTo: { lines: [
      'Number the stones of the trail from 1 to the last step: every open stone gets one number, the rocks get none.',
      'Each number touches the next one, side by side or corner to corner.',
      'The bold numbers are carved already; fill in the rest.',
      'Click a number to take it up as the pen, then click a stone touching it to write the next step. Or click any stone and type its number.',
      'Backspace rubs out, U undoes, H shows a wrong step or places the next one (no +10 clean bonus then).',
      'Tip: where two carved numbers are close, like 9 and 12, the steps between them have only a few ways to go.'],
      img: 'howto/hidato.png', caption: 'A solved trail: 1 to 15, each step touching the next (corners count), the rock left out.' },
    start(ctx) {
      const B = ctx.B, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const LV = def.levels || LEVELS, KEY = 'rebelAntsPilgrimProgress:' + (def.id || 'hidato');
      let solvedUpTo = 0; try { solvedUpTo = Math.max(0, Math.min(LV.length, Number(localStorage.getItem(KEY)) || 0)); } catch (e) {}
      const mat = (k, c, em) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(.05, .05, .05); if (em) m.emissiveColor = new B.Color3(...em); return m; });
      const rockM = mat('slab', [.26, .3, .3], [.05, .06, .06]);
      const nodes = [], keep = n => { n.parent = n.parent || ctx.frame; ctx.add(n); nodes.push(n); if (n.isPickable !== undefined) n.isPickable = false; return n; };
      const TEX = 1024, tex = new B.DynamicTexture('hdTex', { width: TEX, height: TEX }, scene, true); tex.hasAlpha = false;
      const boardM = new B.StandardMaterial('hdBoardMat', scene); boardM.diffuseTexture = tex; boardM.emissiveTexture = tex; boardM.emissiveColor = new B.Color3(.62, .62, .62); boardM.diffuseColor = new B.Color3(.55, .55, .55); boardM.specularColor = new B.Color3(0, 0, 0);
      const S = 4.4, TY = .3;
      { const d = keep(B.MeshBuilder.CreateBox('hdSlab', { width: S + .5, height: TY, depth: S + .5 }, scene)); d.material = rockM; d.position.y = TY / 2; }
      const board = keep(B.MeshBuilder.CreateGround('hdBoard', { width: S, height: S }, scene)); board.material = boardM; board.position.y = TY + .005; board.isPickable = true; board.metadata = { hdBoard: true };
      const M = 28, GS = TEX - 2 * M;
      let bd = null; // { k, L, w, h, N, val: Int16Array, giv: Uint8Array, pen, cur, undo, hints, time, typed, flash }
      const st = { phase: 'pick', t: 0 };
      const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
      const geom = () => { const C = GS / Math.max(bd.w, bd.h), ox = M + (GS - C * bd.w) / 2, oy = M + (GS - C * bd.h) / 2; return { C, ox, oy }; };
      const near = (a, b) => a !== b && Math.max(Math.abs(Math.floor(a / bd.w) - Math.floor(b / bd.w)), Math.abs(a % bd.w - b % bd.w)) <= 1;
      function build(k) { const L = LV[k]; const N = [...L.open].filter(x => x === '1').length;
        bd = { k, L, w: L.w, h: L.h, N, val: new Int16Array(L.w * L.h), giv: new Uint8Array(L.w * L.h), pen: -1, cur: -1, undo: [], hints: 0, time: 0, typed: '', flash: null };
        for (const i of L.given) { bd.val[i] = L.sol[i]; bd.giv[i] = 1; } bd.pen = bd.val.indexOf(1); bd.cur = bd.pen; view(Math.max(L.w, L.h)); ctx.player.place(0, -5.1, 0); draw(); info(); }
      const where = v => bd.val.indexOf(v);
      const placed = () => bd.val.reduce((a, v) => a + (v > 0 ? 1 : 0), 0);
      const info = () => H.info(bd ? `Trail ${bd.k + 1} / ${LV.length} · ${bd.L.name} · steps ${placed()} / ${bd.N} · pen ${bd.pen >= 0 ? bd.val[bd.pen] : '-'}${bd.typed ? ` · typing ${bd.typed}` : ''} · ${fmt(bd.time)}${bd.hints ? ` · hints ${bd.hints}` : ''}` : 'Pick a trail');
      function broken() { // numbers whose neighbour step (one less / one more) is placed but not beside them, or written twice
        const bad = new Set(), seen = new Map(); for (let i = 0; i < bd.val.length; i++) { const v = bd.val[i]; if (!v) continue; if (seen.has(v)) { bad.add(i); bad.add(seen.get(v)); } else seen.set(v, i); }
        for (let i = 0; i < bd.val.length; i++) { const v = bd.val[i]; if (!v) continue; for (const u of [v - 1, v + 1]) { const j = seen.get(u); if (j != null && !near(i, j)) { bad.add(i); bad.add(j); } } } return bad; }
      function draw() {
        const g = tex.getContext(), { C, ox, oy } = geom(), bad = broken(), pv = bd.pen >= 0 ? bd.val[bd.pen] : 0, big = Math.max(bd.w, bd.h) >= 11;
        g.fillStyle = '#20302e'; g.fillRect(0, 0, TEX, TEX);
        // the trail so far: lines between consecutive placed steps
        g.strokeStyle = 'rgba(120,220,230,.45)'; g.lineWidth = C * .12; g.lineCap = 'round'; g.beginPath();
        const ctr = i => [ox + (i % bd.w + .5) * C, oy + (Math.floor(i / bd.w) + .5) * C];
        for (let v = 1; v < bd.N; v++) { const a = where(v), b = where(v + 1); if (a >= 0 && b >= 0 && near(a, b)) { const [x1, y1] = ctr(a), [x2, y2] = ctr(b); g.moveTo(x1, y1); g.lineTo(x2, y2); } } g.stroke();
        for (let i = 0; i < bd.w * bd.h; i++) { const x = ox + (i % bd.w) * C, y = oy + Math.floor(i / bd.w) * C;
          if (bd.L.open[i] === '0') { g.fillStyle = '#3e4442'; g.beginPath(); g.ellipse(x + C / 2, y + C / 2, C * .44, C * .38, .3, 0, Math.PI * 2); g.fill(); g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(x + C * .56, y + C * .58, C * .3, C * .2, .3, 0, Math.PI * 2); g.fill(); continue; }
          const v = bd.val[i]; g.fillStyle = bd.giv[i] ? '#d4d8cc' : v ? '#c8d8d2' : '#a8b8b2'; g.globalAlpha = .92; g.beginPath(); g.arc(x + C / 2, y + C / 2, C * .43, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
          if (i === bd.pen) { g.strokeStyle = '#ffd24a'; g.lineWidth = Math.max(4, C * .08); g.stroke(); }
          else if (pv && !v && near(i, bd.pen)) { g.strokeStyle = 'rgba(255,210,74,.55)'; g.lineWidth = Math.max(2, C * .04); g.stroke(); }
          if (i === bd.cur && i !== bd.pen) { g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 3; g.strokeRect(x + 4, y + 4, C - 8, C - 8); }
          if (bd.flash && bd.flash.i === i) { g.strokeStyle = bd.flash.good ? '#3fe070' : '#ff3030'; g.lineWidth = 7; g.strokeRect(x + 3, y + 3, C - 6, C - 6); }
          if (v) { g.fillStyle = bad.has(i) ? '#c01818' : bd.giv[i] ? '#1c2422' : '#7a2e12'; g.font = `${bd.giv[i] ? 'bold ' : ''}${Math.round(C * (v >= 100 ? (big ? .38 : .34) : .42))}px Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(v), x + C / 2, y + C * .54); }
          else if (i === bd.cur && bd.typed) { g.fillStyle = 'rgba(122,46,18,.6)'; g.font = `${Math.round(C * .42)}px Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(bd.typed, x + C / 2, y + C * .54); } }
        tex.update(); }
      function write(i, v, rec) { if (bd.giv[i] || bd.L.open[i] === '0' || bd.val[i] === v) return false; rec.push([i, bd.val[i]]); bd.val[i] = v; return true; }
      function commit(rec, sound) { if (!rec.length) return; bd.undo.push(rec); if (bd.undo.length > 400) bd.undo.shift(); if (sound) ctx.note(440 + (bd.val[rec[rec.length - 1][0]] % 12) * 30, 'bell'); draw(); info(); check(); }
      function nextFree(v) { for (let u = v + 1; u <= bd.N; u++) if (where(u) < 0) return u; return 0; }
      function click(i) { // the pen at work
        if (st.phase !== 'play' || i < 0 || bd.L.open[i] === '0') return false; bd.typed = '';
        if (bd.val[i]) { bd.pen = i; bd.cur = i; draw(); info(); return true; }
        bd.cur = i;
        if (bd.pen >= 0 && near(i, bd.pen)) { const want = bd.val[bd.pen] + 1; if (want > bd.N) { draw(); return false; }
          if (where(want) >= 0) { H.msg(`${want} is already on the trail`, 1000); draw(); return false; }
          const rec = []; write(i, want, rec); bd.pen = i; commit(rec, true); return true; }
        draw(); info(); return false; }
      function type(d) { if (st.phase !== 'play' || bd.cur < 0 || bd.giv[bd.cur]) return; bd.typed = (bd.typed + d).slice(-3); const v = +bd.typed; info(); draw();
        const maxLen = String(bd.N).length; if (bd.typed.length >= maxLen || v * 10 > bd.N) { bd.typed = ''; if (v >= 1 && v <= bd.N) { const rec = []; write(bd.cur, v, rec); bd.pen = bd.cur; commit(rec, true); } } }
      function erase() { if (st.phase !== 'play' || bd.cur < 0) return; bd.typed = ''; const rec = []; if (write(bd.cur, 0, rec)) { if (bd.pen === bd.cur) bd.pen = -1; commit(rec, false); } }
      function undo() { if (st.phase !== 'play') return; const rec = bd.undo.pop(); if (!rec) return; for (let j = rec.length - 1; j >= 0; j--) bd.val[rec[j][0]] = rec[j][1]; ctx.note(330, 'lantern'); draw(); info(); }
      function hint() {
        if (st.phase !== 'play') return; const sol = bd.L.sol;
        const wrong = bd.val.findIndex((v, i) => v && !bd.giv[i] && v !== sol[i]); bd.hints++;
        if (wrong >= 0) { const rec = []; write(wrong, 0, rec); bd.undo.push(rec); bd.flash = { i: wrong, t: 0, good: false }; bd.cur = wrong; H.msg('This step is wrong', 1300); draw(); info(); return; }
        // the next step after the pen's number (or the first missing one)
        let v = bd.pen >= 0 ? nextFree(bd.val[bd.pen]) : 0; if (!v) for (let u = 1; u <= bd.N; u++) if (where(u) < 0) { v = u; break; } if (!v) return;
        const i = sol.indexOf(v); const rec = []; write(i, v, rec); bd.undo.push(rec); bd.pen = i; bd.cur = i; bd.flash = { i, t: 0, good: true }; H.msg(`Step ${v} is here`, 1300); draw(); info(); check(); }
      function check() { for (let i = 0; i < bd.val.length; i++) if (bd.L.open[i] === '1' && bd.val[i] !== bd.L.sol[i]) return false;
        st.phase = 'won'; st.wt = 0; bd.pen = -1; bd.cur = -1; draw(); pads.style.display = 'none'; ctx.sound('gamewin'); H.msg('The trail is walked', 1600, fmt(bd.time));
        if (bd.k + 1 > solvedUpTo) { solvedUpTo = bd.k + 1; try { localStorage.setItem(KEY, String(solvedUpTo)); } catch (e) {} } return true; }
      const hud = document.getElementById('gameHud');
      const pick = document.createElement('div');
      pick.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(' + (LV.length > 6 && innerWidth >= 600 ? 560 : 420) + 'px,92vw);background:rgba(8,18,18,.95);border:1px solid rgba(120,220,230,.55);border-radius:14px;padding:16px;text-align:center;pointer-events:auto;font:15px/1.4 system-ui,sans-serif;color:#eee';
      const drawPick = () => { pick.innerHTML = `<div style="font:800 13px/1.2 system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#8fe8f0;margin-bottom:10px">The Pilgrim's Path</div><div style="margin-bottom:12px;color:#bbb">Number the steps from 1: each touches the next, corners count.</div>`
        + `<div style="display:grid;grid-template-columns:repeat(${LV.length > 6 && innerWidth >= 600 ? 5 : 4},1fr);gap:8px">${LV.map((L, k) => { const open = k <= solvedUpTo, ok = k < solvedUpTo; return `<button type="button" data-k="${k}" ${open ? '' : 'disabled'} style="padding:8px 2px;border-radius:9px;border:1px solid ${open ? '#8fe8f0' : '#444'};background:${ok ? 'rgba(143,232,240,.18)' : 'rgba(255,255,255,.04)'};color:${open ? '#fff' : '#666'};font:700 15px system-ui,sans-serif;cursor:${open ? 'pointer' : 'default'}">${open ? `${k + 1}<div style="font:11px system-ui;opacity:.75">${L.w}×${L.h}</div>` : '🔒'}${ok ? ' ✓' : ''}</button>`; }).join('')}</div>`;
        pick.querySelectorAll('button[data-k]').forEach(b => b.onclick = (e) => { e.stopPropagation(); b.blur(); choose(+b.dataset.k); }); };
      const pads = document.createElement('div');
      pads.style.cssText = 'position:absolute;bottom:62px;right:14px;display:none;gap:6px;pointer-events:auto';
      const padBtn = (t, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.style.cssText = 'min-width:52px;height:40px;padding:0 10px;border-radius:9px;border:1px solid #6fc8d0;background:rgba(8,20,20,.88);color:#e8ffff;font:700 15px system-ui;cursor:pointer'; b.onclick = (e) => { e.stopPropagation(); b.blur(); fn(); }; pads.appendChild(b); return b; };
      padBtn('⌫', erase); padBtn('Undo', undo); padBtn('Hint', hint);
      function choose(k) { if (st.phase !== 'pick' || k > solvedUpTo || k >= LV.length) return; pick.remove(); st.phase = 'play'; build(k); pads.style.display = 'flex'; H.msg(`Trail ${k + 1}`, 900, `${LV[k].name}: ${bd.N} steps`); }
      // Restart (the button beside Quit): the same trail with only its carved steps, the clock, undo and hints from zero
      function restart() { if (st.phase !== 'play' || !bd) return; build(bd.k); H.msg('Start again', 900, 'only the carved steps stay'); }
      hud.append(pick, pads); drawPick();
      const cam = [0, TY + 6.3, -3.5], at = [0, TY, -.3];
      // the big trails (11 stones across and up, Oct 17) are seen from higher up and more from above, so the far rows
      // stay readable (three-figure steps a little larger); the player still waits where the camera stood for the others
      const view = n => { const big = n >= 11; cam[1] = TY + (big ? 7.5 : 6.3); cam[2] = big ? -1.8 : -3.5; at[2] = big ? -.08 : -.3; };
      ctx.player.place(0, cam[2] - 1.6, 0); ctx.look(cam, at, def.fov || .8); // the player waits behind the camera, out of the picture
      { const g = tex.getContext(); g.fillStyle = '#20302e'; g.fillRect(0, 0, TEX, TEX); tex.update(); }
      H.title(def.title || "The Pilgrim's Path"); H.score(''); info();
      H.hint('Click a number to take it as the pen, then a stone beside it for the next step. Or click a stone and type its number. <kbd>⌫</kbd> rub out, <kbd>U</kbd> undo, <kbd>H</kbd> hint.');
      const cellAt = () => { const hit = scene.pickWithRay(ctx.ray(), m => m.metadata?.hdBoard); if (!hit?.pickedPoint) return -1; const l = ctx.toLocal(hit.pickedPoint), { C, ox, oy } = geom();
        const px = (l.x + S / 2) / S * TEX, py = (S / 2 - l.z) / S * TEX, c = Math.floor((px - ox) / C), r = Math.floor((py - oy) / C); return c >= 0 && c < bd.w && r >= 0 && r < bd.h ? r * bd.w + c : -1; };
      return {
        update(dt) {
          ctx.look(cam, at); st.t += dt; if (!bd) return;
          if (st.phase === 'play') { const s = Math.floor(bd.time); bd.time += dt; if (Math.floor(bd.time) !== s) info(); }
          if (bd.flash && (bd.flash.t += dt) > 1.6) { bd.flash = null; draw(); }
          if (st.phase === 'won' && (st.wt += dt) > 2) { st.phase = 'done'; H.hint(''); const k = bd.k;
            ctx.finish({ score: (k + 1) * 20 + (bd.hints ? 0 : 10), label: 'points', solved: true, extra: `${bd.L.name} (trail ${k + 1}, ${bd.N} steps) walked in ${fmt(bd.time)}${bd.hints ? `, ${bd.hints} hint${bd.hints > 1 ? 's' : ''}` : ''}.${k + 1 < LV.length ? ` Trail ${k + 2} is open.` : ' The summit is reached.'}` }); }
        },
        key(e, down) {
          if (!down || e.repeat) return; const k = e.key.toLowerCase();
          if (st.phase === 'pick') { const n = k === '0' ? 10 : parseInt(k, 10); if (n >= 1 && n <= LV.length) choose(n - 1); return; } // 1-9, 0 = the tenth
          if (st.phase !== 'play') return; const x = bd.cur < 0 ? 0 : bd.cur % bd.w, y = bd.cur < 0 ? 0 : Math.floor(bd.cur / bd.w);
          const mv = (dx, dy) => { const nx = Math.max(0, Math.min(bd.w - 1, x + dx)), ny = Math.max(0, Math.min(bd.h - 1, y + dy)); bd.cur = ny * bd.w + nx; bd.typed = ''; if (bd.val[bd.cur]) bd.pen = bd.cur; draw(); info(); };
          if (k === 'arrowup' || k === 'w') mv(0, -1); else if (k === 'arrowdown' || k === 's') mv(0, 1); else if (k === 'arrowleft' || k === 'a') mv(-1, 0); else if (k === 'arrowright' || k === 'd') mv(1, 0);
          else if (/^[0-9]$/.test(k)) type(k); else if (k === ' ' || k === 'enter') click(bd.cur); else if (k === 'backspace' || k === 'delete') erase();
          else if (k === 'u' || (k === 'z' && (e.ctrlKey || e.metaKey))) undo(); else if (k === 'h') hint();
        },
        pointer(evt) { if (evt.type !== B.PointerEventTypes.POINTERDOWN || st.phase !== 'play' || !bd) return; click(cellAt()); },
        restart,
        _test: { st, choose, click, type, erase, undo, hint, broken, get bd() { return bd; }, LV, draw, unlock(k) { solvedUpTo = k; drawPick(); } },
        dispose() { pick.remove(); pads.remove(); nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); try { boardM.dispose(); tex.dispose(); } catch (e) {} }
      };
    }
  };
  window.RebelGames.register('hidato', G);
})();
