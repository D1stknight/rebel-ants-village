// The Spy's Code (Oct 15, Bushi): an enemy spy signals with a row of coloured flags. Guess the row: after each guess
// the tactician pins a black peg for every flag of the right colour in the right place, and a white peg for every
// other flag of a right colour in the wrong place (they do not say which). Click a colour (or press its number) to
// fill the next slot, Backspace takes one back, Enter sends the guess; H shows one flag (no clean bonus then).
// Six codes, from 3 flags of 4 colours to 5 flags of 8 colours with repeats; the par is what a careful tactician
// needs. Score: the code x 20, +10 within the par without a hint.
// def: { levels: [{ pegs, colours, tries, repeats, par }], pass, points }
// Oct 17 (Miguel: the puzzles need a how-to with an example, every board a Restart): howTo (the rules + a code broken
// in four guesses, howto/mastermind.png) and inst.restart (the same code level, tries back, a NEW secret code: the old
// one's pegs would give it away).
// Oct 17 (Miguel: "all board games need to be 10 or 15 [levels]"): ten codes. 7-8: six flags of 8 colours (10 tries,
// then 8); 9-10: six flags of 10 colours, two new flags (pink, teal) on keys 9 and 0 (10 tries, then 9). Each par is
// what a careful tactician needs: scratchpad agents/lvC/mastermind/sim.mjs plays 300-1000 codes per level by only
// ever sending a guess that fits every answer so far; it breaks every code within the tries (99.3 % on 8 and 10) and
// meets the par in 56-94 % of them (levels.out).
(function () {
  const LEVELS = [
    { pegs: 3, colours: 4, tries: 8, repeats: false, par: 4 },
    { pegs: 4, colours: 6, tries: 10, repeats: false, par: 6 },
    { pegs: 4, colours: 6, tries: 9, repeats: true, par: 6 },
    { pegs: 4, colours: 6, tries: 7, repeats: true, par: 5 },
    { pegs: 5, colours: 8, tries: 10, repeats: true, par: 7 },
    { pegs: 5, colours: 8, tries: 8, repeats: true, par: 6 },
    { pegs: 6, colours: 8, tries: 10, repeats: true, par: 7 },
    { pegs: 6, colours: 8, tries: 8, repeats: true, par: 6 },
    { pegs: 6, colours: 10, tries: 10, repeats: true, par: 8 },
    { pegs: 6, colours: 10, tries: 9, repeats: true, par: 7 }
  ];
  const FLAGS = [
    { c: '#d23b2f', g: '✚', n: 'red' }, { c: '#2f6fd2', g: '●', n: 'blue' }, { c: '#e8c22c', g: '★', n: 'gold' }, { c: '#3aa856', g: '☾', n: 'green' },
    { c: '#f2f2ea', g: '◆', n: 'white' }, { c: '#8a46c8', g: '▲', n: 'purple' }, { c: '#e9822a', g: '■', n: 'orange' }, { c: '#2a2a2e', g: '♥', n: 'black' },
    { c: '#ee7fb5', g: '✿', n: 'pink' }, { c: '#1ea89e', g: '♣', n: 'teal' }
  ];
  function score(code, guess) { let b = 0, w = 0; const cc = {}, gc = {}; code.forEach((c, i) => { if (c === guess[i]) b++; else { cc[c] = (cc[c] || 0) + 1; gc[guess[i]] = (gc[guess[i]] || 0) + 1; } }); for (const k in gc) w += Math.min(gc[k], cc[k] || 0); return [b, w]; }
  const G = {
    title: "The Spy's Code",
    howTo: {
      lines: ['Break the spy\'s secret code: a row of coloured flags, hidden at the top of the board. The info line says how many flags and colours the code has, and whether a colour may be used more than once.',
        'Fill the glowing guess row: click (or tap) a colour button, or press its number (1-9, 0 for the tenth colour), and it goes into the next flag. Click a flag of the row (or ← →) to change that one; Backspace takes one back. Enter or Signal sends the guess.',
        'Every guess gets pegs: a black peg for each flag of the right colour in the right place, a white peg for each other flag whose colour is in the code but somewhere else. The pegs never say which flag they mean.',
        'A colour earns pegs only as often as it is in the code: two red flags against one red in the code earn one peg, not two.',
        'Break the code before the tries run out (one row a try). Within the par and with no hint scores +10; H shows one flag of the code (no bonus then).',
        'Tip: change one or two flags at a time and watch how the pegs change. A guess with no pegs at all rules out every colour in it.'],
      img: 'howto/mastermind.png', caption: 'A 4-flag code broken on the fourth guess. Guess 2: blue is right (1 black); red and gold are in the code but elsewhere (2 white).'
    },
    start(ctx) {
      const B = ctx.B, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const LV = def.levels || LEVELS, KEY = 'rebelAntsCodeProgress:' + (def.id || 'mastermind');
      let solvedUpTo = 0; try { solvedUpTo = Math.max(0, Math.min(LV.length, Number(localStorage.getItem(KEY)) || 0)); } catch (e) {}
      const mat = (k, c, em) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(.05, .05, .05); if (em) m.emissiveColor = new B.Color3(...em); return m; });
      const woodM = mat('wood', [.28, .18, .11], [.07, .045, .03]), navyM = mat('navy', [.12, .16, .3], [.03, .04, .08]);
      const nodes = [], keep = n => { n.parent = n.parent || ctx.frame; ctx.add(n); nodes.push(n); if (n.isPickable !== undefined) n.isPickable = false; return n; };
      const TEX = 1024, tex = new B.DynamicTexture('mmTex', { width: TEX, height: TEX }, scene, true); tex.hasAlpha = false;
      const boardM = new B.StandardMaterial('mmBoardMat', scene); boardM.diffuseTexture = tex; boardM.emissiveTexture = tex; boardM.emissiveColor = new B.Color3(.55, .55, .55); boardM.diffuseColor = new B.Color3(.6, .6, .6); boardM.specularColor = new B.Color3(0, 0, 0);
      // a slanted map table with the code board on it
      const BW = 3.2, BH = 3.2, TY = 1.05;
      { const top = keep(B.MeshBuilder.CreateBox('mmTable', { width: BW + .7, height: .12, depth: BH * .55 + .8 }, scene)); top.material = woodM; top.position.set(0, TY - .06, .3);
        for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const l = keep(B.MeshBuilder.CreateBox('mmLeg', { width: .12, height: TY - .12, depth: .12 }, scene)); l.material = woodM; l.position.set(x * (BW / 2 + .2), (TY - .12) / 2, .3 + z * (BH * .27 + .25)); }
        const back = keep(B.MeshBuilder.CreateBox('mmStand', { width: BW + .3, height: .1, depth: BH + .3 }, scene)); back.material = navyM; back.rotation.x = -(Math.PI / 2 - .62); back.position.set(0, TY + BH / 2 * Math.sin(Math.PI / 2 - .62) - .02, .3 + .06); }
      const board = keep(B.MeshBuilder.CreatePlane('mmBoard', { width: BW, height: BH }, scene)); board.material = boardM; board.isPickable = true; board.metadata = { mmBoard: true };
      board.rotation.x = .62; board.position.set(0, TY + BH / 2 * Math.sin(Math.PI / 2 - .62) + .04, .3); // leans back from the camera like a lectern
      let bd = null; // { k, P, C, tries, rep, par, code[], rows: [{ g[], fb }], cur[], slot, hints, known: Set }
      const st = { phase: 'pick', t: 0 };
      function build(k) {
        const L = LV[k], code = []; const pool = [...Array(L.colours).keys()];
        for (let i = 0; i < L.pegs; i++) { if (L.repeats) code.push(Math.floor(Math.random() * L.colours)); else code.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]); }
        bd = { k, P: L.pegs, C: L.colours, tries: L.tries, rep: L.repeats, par: L.par, code, rows: [], cur: new Array(L.pegs).fill(-1), slot: 0, hints: 0, known: new Map() };
        ctx.player.place(BW / 2 + 1.4, 1.2, -Math.PI / 2 - .5); drawPalette(); draw(); info(); keysHint(L.colours);
      }
      const info = () => H.info(bd ? `Code ${bd.k + 1} / ${LV.length} · ${bd.P} flags of ${bd.C} colours${bd.rep ? ', repeats' : ''} · guess ${Math.min(bd.tries, bd.rows.length + 1)} / ${bd.tries} · par ${bd.par}${bd.hints ? ` · hints ${bd.hints}` : ''}` : 'Pick a code');
      // the board drawing: one row per try (oldest at the bottom), flags as little banners, the pegs on the right
      let geo = null;
      function draw() {
        const g = tex.getContext(), P = bd.P, N = bd.tries, M = 40, rowH = Math.min(92, (TEX - 2 * M - 120) / N), cell = Math.min(rowH * 1.4, 150), x0 = (TEX - (P * cell + 40 + 3 * 32)) / 2, pegX = x0 + P * cell + 40;
        geo = { rowH, cell, x0, M, top: M + 110 };
        g.fillStyle = '#e9dfc4'; g.fillRect(0, 0, TEX, TEX); g.strokeStyle = '#1e2a4a'; g.lineWidth = 14; g.strokeRect(7, 7, TEX - 14, TEX - 14);
        // the secret row at the top: hidden until the end (hinted flags show)
        const done = st.phase === 'won' || st.phase === 'lost' || st.phase === 'done';
        g.fillStyle = '#1e2a4a'; g.fillRect(x0 - 16, M, P * cell + 32, 92);
        for (let i = 0; i < P; i++) { const show = done || bd.known.has(i); flag(g, x0 + i * cell + cell / 2, M + 46, cell * .7, show ? bd.code[i] : -2); }
        for (let r = 0; r < N; r++) { const y = geo.top + (N - 1 - r) * rowH, row = bd.rows[r], isCur = r === bd.rows.length && !done;
          if (isCur) { g.fillStyle = 'rgba(214,160,40,.28)'; g.fillRect(x0 - 16, y + 2, P * cell + 32 + 40 + 3 * 32, rowH - 4); }
          g.fillStyle = '#6d6250'; g.font = `bold ${Math.round(rowH * .32)}px Georgia, serif`; g.textAlign = 'right'; g.textBaseline = 'middle'; g.fillText(String(r + 1), x0 - 24, y + rowH / 2);
          for (let i = 0; i < P; i++) { const c = row ? row.g[i] : isCur ? bd.cur[i] : -1, cx = x0 + i * cell + cell / 2, cy = y + rowH / 2;
            if (c >= 0) flag(g, cx, cy, Math.min(cell, rowH) * .78, c); else { g.strokeStyle = 'rgba(80,70,50,.45)'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, Math.min(cell, rowH) * .16, 0, Math.PI * 2); g.stroke(); }
            if (isCur && i === bd.slot) { g.strokeStyle = '#c47a10'; g.lineWidth = 6; g.strokeRect(cx - cell / 2 + 6, y + 6, cell - 12, rowH - 12); } }
          if (row) { const pegs = [...Array(row.fb[0]).fill(1), ...Array(row.fb[1]).fill(0)];
            for (let i = 0; i < P; i++) { const px = pegX + (i % 3) * 32 + 14, py = y + rowH / 2 + (Math.floor(i / 3) - (P > 3 ? .5 : 0)) * 28; g.beginPath(); g.arc(px, py, 12, 0, Math.PI * 2);
              if (i < pegs.length) { g.fillStyle = pegs[i] ? '#141414' : '#fbfbf5'; g.fill(); g.strokeStyle = '#444'; g.lineWidth = 2; g.stroke(); } else { g.strokeStyle = 'rgba(80,70,50,.35)'; g.lineWidth = 2; g.stroke(); } } } }
        tex.update();
      }
      function flag(g, cx, cy, s, c) { // a little banner on a pole (c -2 = hidden)
        g.fillStyle = '#4b3a28'; g.fillRect(cx - s * .42, cy - s * .48, s * .07, s * .96);
        if (c === -2) { g.fillStyle = '#3a466e'; g.fillRect(cx - s * .35, cy - s * .44, s * .75, s * .62); g.fillStyle = '#e9dfc4'; g.font = `bold ${Math.round(s * .4)}px Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', cx + s * .02, cy - s * .12); return; }
        const F = FLAGS[c]; g.fillStyle = F.c; g.beginPath(); g.moveTo(cx - s * .35, cy - s * .44); g.lineTo(cx + s * .42, cy - s * .44); g.lineTo(cx + s * .3, cy - s * .13); g.lineTo(cx + s * .42, cy + s * .18); g.lineTo(cx - s * .35, cy + s * .18); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2; g.stroke(); g.fillStyle = c === 7 ? '#eee' : c === 4 ? '#333' : 'rgba(20,14,8,.75)'; g.font = `${Math.round(s * .3)}px Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(F.g, cx + s * .02, cy - s * .12);
      }
      // a hinted flag stays put: picking a colour on it fills the next free slot instead
      function put(c) { if (st.phase !== 'play' || c < 0 || c >= bd.C) return; if (bd.known.has(bd.slot)) { const f = [...Array(bd.P).keys()].find(i => i > bd.slot && !bd.known.has(i)) ?? [...Array(bd.P).keys()].find(i => !bd.known.has(i)); if (f == null) return; bd.slot = f; } bd.cur[bd.slot] = c; ctx.note(500 + c * 60, 'lantern'); const next = bd.cur.findIndex((v, i) => v < 0 && i > bd.slot); bd.slot = next >= 0 ? next : Math.min(bd.P - 1, bd.slot + 1); draw(); }
      function back() { if (st.phase !== 'play') return; if (bd.cur[bd.slot] < 0 && bd.slot > 0) bd.slot--; if (!bd.known.has(bd.slot)) bd.cur[bd.slot] = -1; draw(); }
      function send() {
        if (st.phase !== 'play') return false; if (bd.cur.some(v => v < 0)) { H.msg('Fill every flag first', 900); return false; }
        if (!bd.rep && new Set(bd.cur).size < bd.P) { H.msg('No colour twice in this code', 1100); return false; }
        const fb = score(bd.code, bd.cur); bd.rows.push({ g: bd.cur.slice(), fb }); ctx.sound('thock');
        if (fb[0] === bd.P) { st.phase = 'won'; st.wt = 0; ctx.sound('gamewin'); H.msg('Code broken', 1500, `${bd.rows.length} guess${bd.rows.length > 1 ? 'es' : ''}`); pads.style.display = 'none'; if (bd.k + 1 > solvedUpTo) { solvedUpTo = bd.k + 1; try { localStorage.setItem(KEY, String(solvedUpTo)); } catch (e) {} } }
        else if (bd.rows.length >= bd.tries) { st.phase = 'lost'; st.wt = 0; H.msg('The spy got away', 1500); pads.style.display = 'none'; }
        else { H.msg(`${fb[0]} black, ${fb[1]} white`, 900); bd.cur = new Array(bd.P).fill(-1); bd.known.forEach((c, i) => { bd.cur[i] = c; }); bd.slot = Math.max(0, bd.cur.findIndex(v => v < 0)); }
        draw(); info(); return true;
      }
      function hint() { if (st.phase !== 'play') return; const free = [...Array(bd.P).keys()].filter(i => !bd.known.has(i)); if (free.length <= 1) { H.msg('No more hints for this code', 1000); return; }
        const i = free[Math.floor(Math.random() * free.length)]; bd.known.set(i, bd.code[i]); bd.cur[i] = bd.code[i]; bd.hints++; H.msg(`Flag ${i + 1} is ${FLAGS[bd.code[i]].n}`, 1300); draw(); info(); }
      function restart() { if (st.phase !== 'play' || !bd) return; build(bd.k); H.msg('A new code', 1200, 'the spy changed the signal'); }
      const hud = document.getElementById('gameHud');
      const pick = document.createElement('div');
      pick.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(' + (LV.length > 6 && innerWidth >= 600 ? 560 : 400) + 'px,90vw);background:rgba(10,14,28,.95);border:1px solid rgba(120,150,230,.6);border-radius:14px;padding:16px;text-align:center;pointer-events:auto;font:15px/1.4 system-ui,sans-serif;color:#eee';
      const drawPick = () => { pick.innerHTML = `<div style="font:800 13px/1.2 system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#9fb6ff;margin-bottom:10px">The Spy's Code</div><div style="margin-bottom:12px;color:#bbb">Black peg: right colour, right place. White: right colour, wrong place.</div>`
        + `<div style="display:grid;grid-template-columns:repeat(${LV.length > 6 && innerWidth >= 600 ? 5 : LV.length > 6 ? 4 : 3},1fr);gap:8px">${LV.map((L, k) => { const open = k <= solvedUpTo, ok = k < solvedUpTo; return `<button type="button" data-k="${k}" ${open ? '' : 'disabled'} style="padding:8px 2px;border-radius:9px;border:1px solid ${open ? '#9fb6ff' : '#444'};background:${ok ? 'rgba(159,182,255,.22)' : 'rgba(255,255,255,.04)'};color:${open ? '#fff' : '#666'};font:700 15px system-ui,sans-serif;cursor:${open ? 'pointer' : 'default'}">${open ? `${k + 1}<div style="font:11px system-ui;opacity:.75">${L.pegs} of ${L.colours}${L.repeats ? ' +rep' : ''} · ${L.tries} tries</div>` : '🔒'}${ok ? ' ✓' : ''}</button>`; }).join('')}</div>`;
        pick.querySelectorAll('button[data-k]').forEach(b => b.onclick = (e) => { e.stopPropagation(); b.blur(); choose(+b.dataset.k); }); };
      const pads = document.createElement('div');
      pads.style.cssText = 'position:absolute;bottom:62px;right:14px;display:none;flex-direction:column;gap:6px;pointer-events:auto;align-items:flex-end';
      const pal = document.createElement('div'); pal.style.cssText = 'display:grid;grid-template-columns:repeat(4,46px);gap:5px'; pads.appendChild(pal);
      const row2 = document.createElement('div'); row2.style.cssText = 'display:flex;gap:6px'; pads.appendChild(row2);
      const btn = (parent, html, fn, css = '') => { const b = document.createElement('button'); b.type = 'button'; b.innerHTML = html; b.style.cssText = `height:42px;min-width:46px;border-radius:9px;border:1px solid #8aa0e0;background:rgba(14,18,34,.88);color:#eef2ff;font:700 15px system-ui;cursor:pointer;${css}`; b.onclick = (e) => { e.stopPropagation(); b.blur(); fn(); }; parent.appendChild(b); return b; };
      function drawPalette() { pal.innerHTML = ''; pal.style.gridTemplateColumns = `repeat(${bd.C > 8 ? 5 : 4},46px)`; for (let c = 0; c < bd.C; c++) btn(pal, `<span style="display:inline-block;width:22px;height:22px;border-radius:50%;background:${FLAGS[c].c};border:2px solid rgba(255,255,255,.6);line-height:20px;font-size:12px;color:${c === 7 ? '#eee' : '#222'}">${FLAGS[c].g}</span>`, () => put(c)); }
      btn(row2, '⌫', back); btn(row2, 'Hint', hint); btn(row2, 'Signal ⏎', send, 'background:rgba(60,90,170,.9)');
      function choose(k) { if (st.phase !== 'pick' || k > solvedUpTo || k >= LV.length) return; pick.remove(); st.phase = 'play'; build(k); pads.style.display = 'flex'; const L = LV[k]; H.msg(`Code ${k + 1}`, 1100, `${L.pegs} flags, ${L.colours} colours${L.repeats ? ', colours may repeat' : ''}`); }
      hud.append(pick, pads); drawPick();
      const cam = [0, TY + 3.7, -3.7], at = [0, TY + 1.22, .3];
      ctx.player.place(BW / 2 + 1.4, 1.2, -Math.PI / 2 - .5); ctx.look(cam, at, def.fov || .85);
      { const g = tex.getContext(); g.fillStyle = '#e9dfc4'; g.fillRect(0, 0, TEX, TEX); g.strokeStyle = '#1e2a4a'; g.lineWidth = 14; g.strokeRect(7, 7, TEX - 14, TEX - 14); tex.update(); }
      H.title(def.title || "The Spy's Code"); H.score(''); info();
      const keysHint = C => H.hint(`Pick colours (click or <kbd>1</kbd>-<kbd>${C > 9 ? '9' : C}</kbd>${C > 9 ? ', <kbd>0</kbd>' : ''}), <kbd>Backspace</kbd> takes one back, <kbd>Enter</kbd> sends the guess, <kbd>H</kbd> hint.`);
      keysHint(8);
      return {
        update(dt) {
          ctx.look(cam, at); st.t += dt; if (!bd) return;
          if ((st.phase === 'won' || st.phase === 'lost') && (st.wt += dt) > 2) { const won = st.phase === 'won'; st.phase = 'done'; draw(); H.hint(''); const k = bd.k, n = bd.rows.length, bonus = won && n <= bd.par && !bd.hints;
            ctx.finish(won ? { score: (k + 1) * 20 + (bonus ? 10 : 0), label: 'points', solved: true, extra: `Code ${k + 1} broken in ${n} guess${n > 1 ? 'es' : ''} (par ${bd.par})${bd.hints ? `, ${bd.hints} hint${bd.hints > 1 ? 's' : ''}` : ''}.${k + 1 < LV.length ? ` Code ${k + 2} is open.` : ' Every code broken.'}` }
              : { score: 0, label: 'points', passed: false, solved: false, extra: `The code was ${bd.code.map(c => FLAGS[c].n).join(', ')}.` }); }
        },
        key(e, down) {
          if (!down || e.repeat) return; const k = e.key.toLowerCase();
          if (st.phase === 'pick') { const n = k === '0' ? 10 : parseInt(k, 10); if (n >= 1 && n <= LV.length) choose(n - 1); return; } // 1-9, 0 = the tenth
          if (st.phase !== 'play') return;
          if (/^[0-9]$/.test(k)) put(k === '0' ? 9 : +k - 1); else if (k === 'backspace' || k === 'delete') back(); else if (k === 'enter' || k === ' ') send(); else if (k === 'h') hint();
          else if (k === 'arrowleft' || k === 'a') { bd.slot = (bd.slot - 1 + bd.P) % bd.P; draw(); } else if (k === 'arrowright' || k === 'd') { bd.slot = (bd.slot + 1) % bd.P; draw(); }
        },
        pointer(evt) {
          if (evt.type !== B.PointerEventTypes.POINTERDOWN || st.phase !== 'play' || !geo) return;
          const hit = scene.pickWithRay(ctx.ray(), m => m.metadata?.mmBoard); if (!hit?.pickedPoint) return;
          const uv = hit.getTextureCoordinates(); if (!uv) return; const px = uv.x * TEX, py = (1 - uv.y) * TEX, r = bd.rows.length, y = geo.top + (bd.tries - 1 - r) * geo.rowH;
          if (py >= y && py <= y + geo.rowH) { const i = Math.floor((px - geo.x0) / geo.cell); if (i >= 0 && i < bd.P) { bd.slot = i; draw(); } }
        },
        restart, // the HUD's Restart button
        _test: { st, choose, put, back, send, hint, score, get bd() { return bd; }, LV, draw },
        dispose() { pick.remove(); pads.remove(); nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); try { boardM.dispose(); tex.dispose(); } catch (e) {} }
      };
    }
  };
  window.RebelGames.register('mastermind', G);
})();
