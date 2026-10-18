// The Ronin's Shadows (Oct 15, Ronin): cast shadows over some squares of the courtyard so that no number shows twice
// in any row or column. Shadows never touch side by side, and every square left in the light must stay joined to the
// others (side by side). Mark a square you are sure stays lit with a white stone. Seven courtyards from 5 x 5 to the
// 10 x 10 Ronin's Last Shadow, each with one answer (checked by a solver; the hard ones need "what if" steps).
// Click marks with the brush (Tab switches shadow / stone, right click the other one), drag paints, U undo, H hint
// (no clean bonus). Score: the courtyard x 20, +10 without a hint. def: { levels, pass, points }
// Oct 17: How to play (the rules + a solved 5 x 5 courtyard, howto/shadows.png) and Restart (every square lit again).
// Oct 17 (Miguel: "all board games need to be 10 or 15 [levels]"): three more courtyards, 10 x 10, 11 x 11 and 12 x 12,
// made by a new generator (scratchpad agents/lvB/shadows/gen.mjs: a Latin square, a legal shading, sly repeats under
// the shadows, a climb toward harder ones) and graded by the what-ifs a player needs on top of the usual shortcuts
// (pairs, a b a, cut squares): the Last Shadow 2; new 5, 7, 12 (the longest runs 13 squares before it breaks). Each
// has one answer (every legal shading counted, extra shadows too) by the generator's search and by a SAT model of the
// rules written apart from it (agents/lvB/shadows/check.py; all ten pass).
(function () {
  const LEVELS = [
    { name: "The First Shadow", n: 5, g: [1,2,1,1,3,2,5,1,3,4,1,2,5,5,2,5,4,3,2,4,3,1,3,5,3], sol: '1010100000010100000110100' },
    { name: "The Courtyard", n: 6, g: [1,1,5,2,5,3,2,6,6,1,4,5,1,2,4,1,1,6,6,6,2,4,3,2,4,3,1,5,5,2,1,1,1,3,2,2], sol: '010010001000100100010001000100101001' },
    { name: "The Moonlit Wall", n: 7, g: [4,2,2,3,1,7,3,5,2,3,3,1,6,4,1,7,7,6,2,1,5,7,4,7,1,1,2,3,5,6,4,5,7,1,5,2,7,7,4,4,5,1,4,5,1,1,4,3,4], sol: '0100101000100001000100010100100000100101001001001' },
    { name: "The Silent Garden", n: 8, g: [3,3,2,8,1,4,6,8,6,7,8,5,4,2,3,3,2,3,8,6,2,2,4,7,5,2,4,5,3,2,7,1,3,1,7,4,7,5,2,5,7,8,1,3,6,3,5,4,4,6,6,3,2,6,1,2,4,4,6,1,3,7,8,3], sol: '0101000000000101101010000001010010100001000100000010010110001000' },
    { name: "The Hall of Debts", n: 8, g: [5,5,6,7,2,1,2,3,3,2,8,8,5,7,1,7,7,6,3,1,6,2,2,4,2,3,8,5,4,5,6,1,6,7,5,3,2,4,7,8,5,4,2,8,1,6,5,2,8,2,2,6,1,4,4,5,7,6,4,7,3,5,6,7], sol: '1000100000010001010000100010010001000000001010100100010010010010' },
    { name: "Crimson Night", n: 9, g: [7,4,3,8,6,5,3,7,2,2,1,6,3,2,8,6,4,9,8,9,6,8,7,2,2,7,8,8,6,5,6,4,1,6,9,3,7,6,2,7,8,3,5,5,4,1,7,7,5,1,6,2,2,9,6,1,1,4,2,3,9,5,5,1,8,4,5,9,2,3,5,6,3,5,5,2,3,6,8,6,6], sol: '100000100001010001100101010010000100000100010101000100010001010000100000101001001' },
    { name: "The Ronin's Last Shadow", n: 10, g: [1,1,3,5,9,4,4,2,3,8,10,9,3,10,2,8,4,5,4,8,4,6,7,3,6,3,1,10,4,2,2,2,4,10,9,1,8,3,7,9,1,3,8,8,4,6,7,7,2,8,1,6,8,2,10,10,9,3,1,5,9,1,2,1,7,10,9,8,5,2,8,10,10,7,2,5,2,4,7,6,5,8,6,2,1,3,3,9,10,7,10,7,9,9,3,3,10,7,6,6], sol: '1010010000000100100101000100101000100100001000100110010100000100001001001010001000000100001010100101' },
    // Oct 17: 10 x 10, 11 x 11 and 12 x 12, 5 / 7 / 12 what-ifs (scratchpad agents/lvB/shadows)
    { name: "The Lantern Gate", n: 10, g: [2,9,3,1,1,10,4,8,6,4,5,6,8,9,2,1,10,2,5,3,6,2,4,6,8,3,9,10,7,5,4,3,10,8,10,4,2,9,1,1,10,3,6,4,4,2,6,9,3,7,9,5,2,3,7,8,4,1,9,3,1,10,8,5,9,6,7,2,4,1,1,10,8,2,7,5,3,4,9,1,8,1,10,5,4,6,7,4,2,6,9,4,6,10,3,1,6,7,2,2], sol: '0001001000101001010100010000000010010101010010100000010000101010001000010010000100010101001010000010' },
    { name: "The Red Hand", n: 11, g: [3,5,2,2,4,9,11,3,6,8,6,1,6,3,4,9,5,3,2,8,11,3,8,4,7,11,3,4,6,10,9,10,2,7,9,7,7,1,2,10,11,6,10,5,6,9,11,10,8,10,9,5,2,2,3,5,3,8,2,10,11,2,10,1,7,7,4,8,6,9,5,11,1,4,3,7,11,10,1,5,8,4,7,1,6,11,9,5,4,6,5,2,9,6,7,3,11,3,8,2,2,1,9,7,4,6,8,6,6,5,9,11,5,5,6,1,4,2,7,1,3], sol: '1001000010000101001001000001000101010001000001000100101000100010101000010000000101010101010000010001001001010100100100000' },
    { name: "A Thousand Shadows", n: 12, g: [12,9,11,2,1,8,3,3,1,5,6,2,12,1,7,11,9,3,6,11,5,10,2,8,5,5,11,6,1,12,2,1,4,4,11,1,2,4,12,11,3,7,4,10,6,8,1,11,12,6,12,9,12,10,8,11,3,5,4,7,6,10,3,4,8,8,5,7,4,10,9,2,11,7,1,12,4,2,1,4,10,3,5,7,3,11,9,11,5,6,11,2,7,6,8,4,3,11,11,10,4,1,4,5,6,6,7,10,1,3,2,7,6,12,10,2,12,11,4,5,7,2,4,8,1,4,11,6,11,12,12,7,10,8,6,3,11,5,7,8,3,2,10,1], sol: '101010100101000000010000101010001001000100100000101000001010000101000100001000010001100100100100010010001001000001010000001000100101100100010000' }
  ];
  const G = {
    title: "The Ronin's Shadows",
    howTo: { lines: [
      'Cast shadows over some squares of the courtyard until no number shows twice in any row or column among the squares left in the light.',
      'Two shadows never touch side by side (corner to corner is fine).',
      'All the lit squares must stay joined in one piece, side by side; a red bar under the board means the light is split.',
      'Click a square to shade it, again to clear it. Tab (or the Shadow / Stone button) turns the brush into a white stone, a note for a square you are sure stays lit; right click uses the other one, drag paints several.',
      'Keys: arrows or WASD move, Space or Enter marks with the brush, Q shades, E sets a stone, 0 or Backspace clears. Only the shadows count: the courtyard is done when every one is in place.',
      'A repeated lit number turns red and touching shadows get a red frame. U undoes; H shows a mistake or one right square (no +10 clean bonus then). Restart lights every square again.',
      'Tip: every square beside a shadow stays lit (give it a stone); a number between two of the same (3 1 3) stays lit; of two equal numbers side by side one is in shadow, so any third one in that line is too.'],
      img: 'howto/shadows.png', caption: 'A solved courtyard: no lit number twice in a line, no shadows side by side, the light in one piece.' },
    start(ctx) {
      const B = ctx.B, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const LV = def.levels || LEVELS, KEY = 'rebelAntsShadowsProgress:' + (def.id || 'shadows');
      let solvedUpTo = 0; try { solvedUpTo = Math.max(0, Math.min(LV.length, Number(localStorage.getItem(KEY)) || 0)); } catch (e) {}
      const mat = (k, c, em) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(.05, .05, .05); if (em) m.emissiveColor = new B.Color3(...em); return m; });
      const stoneM = mat('dais', [.16, .14, .15], [.04, .035, .035]), redM = mat('crimson', [.5, .08, .09], [.18, .02, .03]);
      const nodes = [], keep = n => { n.parent = n.parent || ctx.frame; ctx.add(n); nodes.push(n); if (n.isPickable !== undefined) n.isPickable = false; return n; };
      const TEX = 1024, tex = new B.DynamicTexture('shTex', { width: TEX, height: TEX }, scene, true); tex.hasAlpha = false;
      const boardM = new B.StandardMaterial('shBoardMat', scene); boardM.diffuseTexture = tex; boardM.emissiveTexture = tex; boardM.emissiveColor = new B.Color3(.7, .7, .7); boardM.diffuseColor = new B.Color3(.5, .5, .5); boardM.specularColor = new B.Color3(0, 0, 0);
      const S = 4.2, TY = .3;
      { const d = keep(B.MeshBuilder.CreateBox('shDais', { width: S + .5, height: TY, depth: S + .5 }, scene)); d.material = stoneM; d.position.y = TY / 2;
        for (const [x, z, w, dd] of [[0, S / 2 + .2, S + .5, .1], [0, -S / 2 - .2, S + .5, .1], [S / 2 + .2, 0, .1, S + .3], [-S / 2 - .2, 0, .1, S + .3]]) { const t = keep(B.MeshBuilder.CreateBox('shTrim', { width: w, height: .06, depth: dd }, scene)); t.material = redM; t.position.set(x, TY + .03, z); } }
      const board = keep(B.MeshBuilder.CreateGround('shBoard', { width: S, height: S }, scene)); board.material = boardM; board.position.y = TY + .005; board.isPickable = true; board.metadata = { shBoard: true };
      const M = 28, GS = TEX - 2 * M;
      let bd = null; // { k, n, L, mark: Int8Array (0 ?, 1 shadow, 2 stone), hints, time, cur, undo, flash }
      const st = { phase: 'pick', t: 0, mode: 1, drag: null };
      const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
      const nb = i => { const n = bd.n, r = Math.floor(i / n), c = i % n, o = []; if (r > 0) o.push(i - n); if (r < n - 1) o.push(i + n); if (c > 0) o.push(i - 1); if (c < n - 1) o.push(i + 1); return o; };
      function build(k) { const L = LV[k]; bd = { k, n: L.n, L, mark: new Int8Array(L.n * L.n), hints: 0, time: 0, cur: 0, undo: [], flash: null }; ctx.player.place(0, cam[2] - 1.6, 0); draw(); info(); }
      const info = () => H.info(bd ? `Courtyard ${bd.k + 1} / ${LV.length} · ${bd.L.name} · ${bd.n} × ${bd.n} · ${fmt(bd.time)} · brush ${st.mode === 1 ? 'shadow' : 'stone'}${bd.hints ? ` · hints ${bd.hints}` : ''}` : 'Pick a courtyard');
      function problems() { // repeated lit numbers, touching shadows, and a lit area split in two
        const n = bd.n, g = bd.L.g, m = bd.mark, dup = new Set(), touch = new Set();
        for (let a = 0; a < n; a++) for (const line of [[...Array(n).keys()].map(q => a * n + q), [...Array(n).keys()].map(q => q * n + a)]) { const seen = new Map(); for (const i of line) { if (m[i] === 1) continue; const v = g[i]; if (seen.has(v)) { dup.add(i); dup.add(seen.get(v)); } else seen.set(v, i); } }
        for (let i = 0; i < n * n; i++) if (m[i] === 1) for (const j of nb(i)) if (m[j] === 1) { touch.add(i); touch.add(j); }
        let split = false; const lit = []; for (let i = 0; i < n * n; i++) if (m[i] !== 1) lit.push(i);
        if (lit.length) { const seen = new Uint8Array(n * n), q = [lit[0]]; seen[lit[0]] = 1; let k = 1; while (q.length) { const x = q.pop(); for (const y of nb(x)) if (m[y] !== 1 && !seen[y]) { seen[y] = 1; k++; q.push(y); } } split = k !== lit.length; }
        return { dup, touch, split }; }
      function draw() {
        const g = tex.getContext(), n = bd.n, C = GS / n, m = bd.mark, pr = problems(), won = st.phase === 'won' || st.phase === 'done';
        g.fillStyle = '#120c0e'; g.fillRect(0, 0, TEX, TEX);
        for (let i = 0; i < n * n; i++) { const x = M + (i % n) * C, y = M + Math.floor(i / n) * C, v = m[i];
          if (v === 1) { g.fillStyle = '#060405'; g.fillRect(x + 2, y + 2, C - 4, C - 4); if (pr.touch.has(i)) { g.strokeStyle = '#e03030'; g.lineWidth = 6; g.strokeRect(x + 5, y + 5, C - 10, C - 10); } else { g.strokeStyle = 'rgba(160,30,36,.6)'; g.lineWidth = 3; g.strokeRect(x + 6, y + 6, C - 12, C - 12); } }
          else { g.fillStyle = (i + Math.floor(i / n)) % 2 ? '#d9cdb4' : '#e2d7bf'; g.fillRect(x + 2, y + 2, C - 4, C - 4);
            if (v === 2) { g.fillStyle = 'rgba(255,255,255,.9)'; g.strokeStyle = 'rgba(60,50,40,.6)'; g.lineWidth = 3; g.beginPath(); g.arc(x + C / 2, y + C / 2, C * .4, 0, Math.PI * 2); g.fill(); g.stroke(); } }
          if (v !== 1 || won) { g.fillStyle = v === 1 ? 'rgba(200,190,170,.35)' : pr.dup.has(i) ? '#c01818' : '#20161a'; g.font = `bold ${Math.round(C * .52)}px Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(bd.L.g[i]), x + C / 2, y + C * .54); }
          else { g.fillStyle = 'rgba(120,100,95,.55)'; g.font = `${Math.round(C * .36)}px Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(bd.L.g[i]), x + C / 2, y + C * .54); } }
        if (st.phase === 'play') { const x = M + (bd.cur % n) * C, y = M + Math.floor(bd.cur / n) * C; g.strokeStyle = 'rgba(255,190,60,.95)'; g.lineWidth = 5; g.strokeRect(x + 3, y + 3, C - 6, C - 6); }
        if (bd.flash) { const x = M + (bd.flash.i % n) * C, y = M + Math.floor(bd.flash.i / n) * C; g.strokeStyle = bd.flash.good ? '#3fe070' : '#ff3030'; g.lineWidth = 8; g.strokeRect(x + 4, y + 4, C - 8, C - 8); }
        if (pr.split && st.phase === 'play') { g.fillStyle = 'rgba(200,30,30,.85)'; g.fillRect(M, TEX - M + 2, GS, M - 6); }
        tex.update();
      }
      function setMark(i, v, rec) { if (bd.mark[i] === v) return false; if (rec) rec.push([i, bd.mark[i]]); bd.mark[i] = v; return true; }
      function commit(rec) { if (!rec.length) return; bd.undo.push(rec); if (bd.undo.length > 400) bd.undo.shift(); ctx.note(rec.some(([i]) => bd.mark[i] === 1) ? 300 : 660, 'lantern'); draw(); check(); }
      function press(i, v) { if (st.phase !== 'play') return false; const want = bd.mark[i] === v ? 0 : v, rec = []; setMark(i, want, rec); bd.cur = i; st.drag = { want, last: i, rec }; commit(rec); return true; }
      function dragTo(i) { if (!st.drag || i === st.drag.last) return; st.drag.last = i; bd.cur = i; const rec = st.drag.rec; if (setMark(i, st.drag.want, rec)) { if (!bd.undo.includes(rec)) bd.undo.push(rec); draw(); check(); } else draw(); }
      function undo() { if (st.phase !== 'play') return; const rec = bd.undo.pop(); if (!rec) return; for (let j = rec.length - 1; j >= 0; j--) bd.mark[rec[j][0]] = rec[j][1]; ctx.note(330, 'lantern'); draw(); }
      function hint() {
        if (st.phase !== 'play') return; const n = bd.n, sol = bd.L.sol;
        let i = -1; for (let j = 0; j < n * n; j++) { const shade = sol[j] === '1'; if ((bd.mark[j] === 1 && !shade) || (bd.mark[j] === 2 && shade)) { i = j; break; } }
        if (i >= 0) { const rec = []; setMark(i, 0, rec); bd.undo.push(rec); bd.hints++; bd.flash = { i, t: 0, good: false }; bd.cur = i; H.msg('This one is wrong', 1300); draw(); info(); return; }
        let best = -1; for (let j = 0; j < n * n; j++) if (!bd.mark[j] && sol[j] === '1') { best = j; break; } if (best < 0) for (let j = 0; j < n * n; j++) if (!bd.mark[j]) { best = j; break; } if (best < 0) return;
        const rec = []; setMark(best, sol[best] === '1' ? 1 : 2, rec); bd.undo.push(rec); bd.hints++; bd.flash = { i: best, t: 0, good: true }; bd.cur = best; H.msg(sol[best] === '1' ? 'A shadow falls here' : 'This one stays lit', 1300); draw(); info(); check(); }
      function check() { const n = bd.n, sol = bd.L.sol; for (let i = 0; i < n * n; i++) if ((bd.mark[i] === 1) !== (sol[i] === '1')) return false;
        st.phase = 'won'; st.wt = 0; st.drag = null; draw(); pads.style.display = 'none'; ctx.sound('gamewin'); H.msg('The courtyard lies in shadow', 1600, fmt(bd.time));
        if (bd.k + 1 > solvedUpTo) { solvedUpTo = bd.k + 1; try { localStorage.setItem(KEY, String(solvedUpTo)); } catch (e) {} } return true; }
      const hud = document.getElementById('gameHud');
      const pick = document.createElement('div');
      pick.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(' + (LV.length > 6 && innerWidth >= 600 ? 560 : 420) + 'px,92vw);background:rgba(16,8,10,.95);border:1px solid rgba(200,50,60,.6);border-radius:14px;padding:16px;text-align:center;pointer-events:auto;font:15px/1.4 system-ui,sans-serif;color:#eee';
      const drawPick = () => { pick.innerHTML = `<div style="font:800 13px/1.2 system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#ff7a80;margin-bottom:10px">The Ronin's Shadows</div><div style="margin-bottom:12px;color:#bbb">Shade squares until no lit number repeats in a line. Shadows never touch; the light stays one.</div>`
        + `<div style="display:grid;grid-template-columns:repeat(${LV.length > 6 && innerWidth >= 600 ? 5 : 4},1fr);gap:8px">${LV.map((L, k) => { const open = k <= solvedUpTo, ok = k < solvedUpTo; return `<button type="button" data-k="${k}" ${open ? '' : 'disabled'} style="padding:8px 2px;border-radius:9px;border:1px solid ${open ? '#ff7a80' : '#444'};background:${ok ? 'rgba(255,122,128,.18)' : 'rgba(255,255,255,.04)'};color:${open ? '#fff' : '#666'};font:700 15px system-ui,sans-serif;cursor:${open ? 'pointer' : 'default'}">${open ? `${k + 1}<div style="font:11px system-ui;opacity:.75">${L.n}×${L.n}</div>` : '🔒'}${ok ? ' ✓' : ''}</button>`; }).join('')}</div>`;
        pick.querySelectorAll('button[data-k]').forEach(b => b.onclick = (e) => { e.stopPropagation(); b.blur(); choose(+b.dataset.k); }); };
      const pads = document.createElement('div');
      pads.style.cssText = 'position:absolute;bottom:62px;right:14px;display:none;gap:6px;pointer-events:auto';
      const padBtn = (t, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.style.cssText = 'min-width:52px;height:40px;padding:0 10px;border-radius:9px;border:1px solid #c9505a;background:rgba(20,8,10,.88);color:#ffe8ea;font:700 15px system-ui;cursor:pointer'; b.onclick = (e) => { e.stopPropagation(); b.blur(); fn(); }; pads.appendChild(b); return b; };
      const modeBtn = padBtn('■ Shadow', () => toggleMode()); padBtn('Undo', undo); padBtn('Hint', hint);
      function toggleMode() { st.mode = st.mode === 1 ? 2 : 1; modeBtn.textContent = st.mode === 1 ? '■ Shadow' : '○ Stone'; if (bd) info(); }
      function choose(k) { if (st.phase !== 'pick' || k > solvedUpTo || k >= LV.length) return; pick.remove(); st.phase = 'play'; build(k); pads.style.display = 'flex'; H.msg(`Courtyard ${k + 1}`, 900, LV[k].name); }
      // Restart (the button beside Quit): the same courtyard all in the light, the clock, undo and hints from zero
      function restart() { if (st.phase !== 'play' || !bd) return; st.drag = null; build(bd.k); H.msg('Start again', 900, 'every square back in the light'); }
      hud.append(pick, pads); drawPick();
      const cam = [0, TY + 6.2, -3.5], at = [0, TY, -.3];
      ctx.player.place(0, cam[2] - 1.6, 0); ctx.look(cam, at, def.fov || .8); // the player waits behind the camera, out of the picture
      { const g = tex.getContext(); g.fillStyle = '#d9cdb4'; g.fillRect(0, 0, TEX, TEX); tex.update(); }
      H.title(def.title || "The Ronin's Shadows"); H.score(''); info();
      H.hint('Click to mark with the brush (<kbd>Tab</kbd> shadow / stone; right click the other), drag to paint. A red bar means the light is split. <kbd>U</kbd> undo, <kbd>H</kbd> hint.');
      const cellAt = () => { const hit = scene.pickWithRay(ctx.ray(), m => m.metadata?.shBoard); if (!hit?.pickedPoint) return -1; const l = ctx.toLocal(hit.pickedPoint), n = bd.n, C = GS / n;
        const px = (l.x + S / 2) / S * TEX, py = (S / 2 - l.z) / S * TEX, c = Math.floor((px - M) / C), r = Math.floor((py - M) / C); return c >= 0 && c < n && r >= 0 && r < n ? r * n + c : -1; };
      return {
        update(dt) {
          ctx.look(cam, at); st.t += dt; if (!bd) return;
          if (st.phase === 'play') { const s = Math.floor(bd.time); bd.time += dt; if (Math.floor(bd.time) !== s) info(); }
          if (bd.flash && (bd.flash.t += dt) > 1.6) { bd.flash = null; draw(); }
          if (st.phase === 'won' && (st.wt += dt) > 2) { st.phase = 'done'; H.hint(''); const k = bd.k;
            ctx.finish({ score: (k + 1) * 20 + (bd.hints ? 0 : 10), label: 'points', solved: true, extra: `${bd.L.name} (courtyard ${k + 1}, ${bd.n} × ${bd.n}) shaded in ${fmt(bd.time)}${bd.hints ? `, ${bd.hints} hint${bd.hints > 1 ? 's' : ''}` : ''}.${k + 1 < LV.length ? ` Courtyard ${k + 2} is open.` : ' The last shadow is cast.'}` }); }
        },
        key(e, down) {
          if (!down || e.repeat) return; const k = e.key.toLowerCase();
          if (st.phase === 'pick') { const n = k === '0' ? 10 : parseInt(k, 10); if (n >= 1 && n <= LV.length) choose(n - 1); return; } // 1-9, 0 = the tenth
          if (st.phase !== 'play') return; const n = bd.n, x = bd.cur % n, y = Math.floor(bd.cur / n);
          if (k === 'arrowup' || k === 'w') { bd.cur = ((y - 1 + n) % n) * n + x; draw(); } else if (k === 'arrowdown' || k === 's') { bd.cur = ((y + 1) % n) * n + x; draw(); }
          else if (k === 'arrowleft' || k === 'a') { bd.cur = y * n + (x - 1 + n) % n; draw(); } else if (k === 'arrowright' || k === 'd') { bd.cur = y * n + (x + 1) % n; draw(); }
          else if (k === ' ' || k === 'enter') { press(bd.cur, st.mode); st.drag = null; } else if (k === 'q' || k === 'x') { press(bd.cur, 1); st.drag = null; } else if (k === 'e' || k === 'o') { press(bd.cur, 2); st.drag = null; }
          else if (k === 'backspace' || k === 'delete' || k === '0') { const rec = []; if (setMark(bd.cur, 0, rec)) commit(rec); }
          else if (k === 'u' || (k === 'z' && (e.ctrlKey || e.metaKey))) undo(); else if (k === 'h') hint(); else if (k === 'tab') { e.preventDefault?.(); toggleMode(); }
        },
        pointer(evt) {
          const T = B.PointerEventTypes; if (st.phase !== 'play' || !bd) return;
          if (evt.type === T.POINTERDOWN) { const i = cellAt(); if (i < 0) return; const right = evt.event && evt.event.button === 2; press(i, right ? 3 - st.mode : st.mode); }
          else if (evt.type === T.POINTERMOVE && st.drag) { const i = cellAt(); if (i >= 0) dragTo(i); }
          else if (evt.type === T.POINTERUP) st.drag = null;
        },
        restart,
        _test: { st, choose, press, dragTo, undo, hint, toggleMode, problems, get bd() { return bd; }, LV, draw, end() { st.drag = null; }, unlock(k) { solvedUpTo = k; drawPick(); } },
        dispose() { pick.remove(); pads.remove(); nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); try { boardM.dispose(); tex.dispose(); } catch (e) {} }
      };
    }
  };
  window.RebelGames.register('shadows', G);
})();
