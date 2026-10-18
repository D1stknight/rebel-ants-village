// The Broker's Strongbox (Oct 15, the Wokou trade house): a code lock of four seals, each one of six sea marks, no mark
// twice. Set the four dials and try them: every gold bead is a right mark in the right place, every silver bead a right
// mark in the wrong place (they never say which). Eight tries. A logic puzzle: the fewer tries, the more it pays.
// def: { box: [x, y, z] (frame coords of the box's foot), size: [w, h, d], face: yaw (the way its front faces),
// playerAt: [x, z, yaw?], cam, at, levels (default LEVELS), pass, points } (def.tries, the old single lock's, is no longer
// read: every level has its own)
// Oct 17 (Miguel: the puzzles need a how-to, every board a Restart): howTo (the rules in a few lines) and inst.restart
// (the dials and tries back, a NEW code on the lock: the old one's beads would give it away).
// Oct 17 (Miguel: "it should mark at least 1 in the right place ... highlight them in a different color or lock them in,
// but just 1"): the first try with a gold bead locks one of its right marks in: that seal turns gold and stays.
// Oct 17 (Miguel: "all board games need to be 10 or 15 [levels] with the image example"): ten locks on the level picker
// (keys 1-9, 0), from 3 seals of 4 marks to 6 seals of 8 marks where a mark may be on more than one seal; lock 5 is the
// old lock (4 seals of 6 marks, no repeats, 8 tries). Two new marks (moon, trident) for the locks of 7 and 8; on a lock
// with repeats a mark earns beads only as often as it is in the code. Every lock's tries were checked over all of its
// codes by solvers written apart (scratchpad agents/htC/lock: solve.mjs -> levels.out, exact.mjs -> exact.out): a
// minimax player that follows every lock-in choice opens locks 1-10 within 4 4 5 5 5 5 6 6 7 8 tries (for locks 1-5 that
// is the fewest possible), the locks give 6 6 6 7 8 8 8 9 9 10, and a careful player who only ever tries a code that
// fits every answer so far opened every game within them. Score: 10 a lock + 5 a try left; opening a lock opens the
// next one (the result card's Next level), Restart puts a new code on this one. howTo + howto/lock.png. The brass dials
// on the box now turn round their own axis (they swung round the vertical), show their mark upright and run left to
// right like the panel's.
(function () {
  // the sea marks (a lock of M marks uses the first M; moon and trident came with the locks of 7 and 8)
  const MARKS = [{ s: '⚓︎', n: 'anchor', c: '#9fb8d8' }, { s: '☠︎', n: 'skull', c: '#e8e2d0' }, { s: '✦︎', n: 'star', c: '#ffd45e' },
    { s: '⚔︎', n: 'swords', c: '#d8d8e8' }, { s: '♒︎', n: 'waves', c: '#6fd0d8' }, { s: '☸︎', n: 'wheel', c: '#e0a060' },
    { s: '☾︎', n: 'moon', c: '#c6b8ff' }, { s: '♆︎', n: 'trident', c: '#7fdc9c' }];
  // ten locks, easy -> hard: more seals, more marks, repeats, fewer spare tries
  const LEVELS = [
    { seals: 3, marks: 4, repeats: false, tries: 6 },
    { seals: 3, marks: 5, repeats: false, tries: 6 },
    { seals: 3, marks: 6, repeats: false, tries: 6 },
    { seals: 4, marks: 5, repeats: false, tries: 7 },
    { seals: 4, marks: 6, repeats: false, tries: 8 }, // the old lock
    { seals: 4, marks: 6, repeats: true, tries: 8 },
    { seals: 5, marks: 7, repeats: false, tries: 8 },
    { seals: 5, marks: 7, repeats: true, tries: 9 },
    { seals: 5, marks: 8, repeats: true, tries: 9 },
    { seals: 6, marks: 8, repeats: true, tries: 10 }
  ];
  const G = {
    title: "The Broker's Strongbox",
    howTo: {
      lines: ["Open the Broker's strongbox: its code is a row of seals, each one sea mark. The picker and the info line say how many seals and marks a lock has, and whether a mark may be on more than one seal.",
        'Set the dials, then press Try the lock (or Enter / Space). Click a dial to pick it and click it again to turn it; or ← → (A D) pick a dial and ↑ ↓ (W S) turn it; the number keys turn that dial.',
        'After each try: a gold bead for every mark in the right place, a silver bead for every other mark that is in the code but on another seal. The beads never say which marks they mean.',
        'On most locks no mark is used twice. On a lock with repeats a mark can be on several seals, and it earns beads only as often as it is in the code: two anchors against one anchor in the code earn one bead, not two.',
        'The first try with a gold bead gives one seal away: that seal turns gold and locks in on its right mark (just one, picked at random).',
        'Open the lock before the tries run out: a harder lock pays more, and so does every try left. Opening a lock opens the next one; Restart puts a new code on this lock.',
        'Tip: a try with no beads at all rules out every mark in it. Between tries change only one or two dials and watch how the beads change.'],
      img: 'howto/lock.png', caption: 'A lock of 4 seals opened on the fourth try: try 2 earns the first gold bead, so the star seal locks in; after try 3 only one code fits all the beads.'
    },
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const LV = def.levels || LEVELS, store = ctx.util.levelStore(def.id || 'lock');
      const BOX = def.box || [0, 0, 2], FACE = def.face ?? 0, [SW, SH, SD] = def.size || [1.5, .7, .9];
      let L = LV[store.open(LV.length)], N = L.seals, M = L.marks, TRIES = L.tries;
      const code = [], deal = () => { const pool = [...Array(M).keys()]; code.length = 0; for (let k = 0; k < N; k++) code.push(L.repeats ? Math.floor(Math.random() * M) : pool.splice(Math.floor(Math.random() * pool.length), 1)[0]); };
      const mat = (k, c, em, spec = .2) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(spec, spec, spec); if (em) m.emissiveColor = new B.Color3(...em); return m; });
      // the strongbox: dark wood, iron bands, the brass dials on the front, a hinged lid with gold inside
      const root = new B.TransformNode('lockBox', scene); ctx.add(root); root.position.set(BOX[0], BOX[1], BOX[2]); root.rotation.y = FACE;
      const wood = mat('wood', [.22, .13, .07], [.03, .02, .01]), iron = mat('iron', [.18, .18, .2], [.02, .02, .03], .5), brass = mat('brass', [.78, .6, .26], [.2, .14, .04], .8), gold = mat('gold', [1, .8, .3], [.6, .42, .1], .9);
      const part = (m, mt, x, y, z) => { m.material = mt; m.parent = root; m.position.set(x, y, z); m.isPickable = false; ctx.add(m); return m; };
      part(B.MeshBuilder.CreateBox('lockBody', { width: SW, height: SH, depth: SD }, scene), wood, 0, SH / 2, 0);
      for (const x of [-SW * .37, SW * .37]) part(B.MeshBuilder.CreateBox('lockBand', { width: .08, height: SH + .02, depth: SD + .02 }, scene), iron, x, SH / 2, 0);
      part(B.MeshBuilder.CreateBox('lockGold', { width: SW - .2, height: .05, depth: SD - .2 }, scene), gold, 0, SH + .01, 0);
      const hinge = new B.TransformNode('lockHinge', scene); hinge.parent = root; hinge.position.set(0, SH, -SD / 2); ctx.add(hinge);
      const lid = B.MeshBuilder.CreateBox('lockLid', { width: SW + .02, height: .14, depth: SD + .02 }, scene); lid.material = wood; lid.parent = hinge; lid.position.set(0, .07, SD / 2); lid.isPickable = false; ctx.add(lid);
      const lidBand = B.MeshBuilder.CreateBox('lockLidBand', { width: SW + .04, height: .05, depth: .1 }, scene); lidBand.material = iron; lidBand.parent = hinge; lidBand.position.set(0, .1, SD - .02); lidBand.isPickable = false; ctx.add(lidBand);
      // the camera, and how far above the box front it looks from (the turned-to mark faces it)
      const cam = def.cam || [BOX[0] + Math.sin(FACE) * 3.4 - Math.cos(FACE) * 1.2, BOX[1] + 2.6, BOX[2] + Math.cos(FACE) * 3.4 + Math.sin(FACE) * 1.2], at = def.at || [BOX[0], BOX[1] + SH * .6, BOX[2]];
      const TILT = Math.max(0, Math.min(.8, Math.atan2(cam[1] - BOX[1] - SH * .52, Math.hypot(cam[0] - BOX[0], cam[2] - BOX[2]))));
      // a dial's ring: the cylinder's side runs u = 0..1 round its axis, its front (facing the box's front) at u = .75 + turn / M
      // and u growing upward (measured in the sandbox), so mark i stands at u = .75 + i / M, raised by the camera's tilt; the
      // side shows the canvas mirrored, so each mark is drawn a quarter turn round and flipped, to read upright and the right
      // way round
      const dialTex = (k) => { const t = new B.DynamicTexture('lockDialT' + k, { width: 512, height: 128 }, scene, true), g = t.getContext(); g.fillStyle = '#b8903e'; g.fillRect(0, 0, 512, 128); g.fillStyle = '#2a1a08'; g.font = `bold ${Math.round(Math.min(68, 410 / M))}px serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        MARKS.slice(0, M).forEach((m, i) => { const x = ((.75 + i / M + TILT / (2 * Math.PI)) % 1) * 512; for (const w of [-512, 0, 512]) { g.save(); g.translate(x + w, 64); g.rotate(Math.PI / 2); g.scale(-1, 1); g.fillText(m.s, 0, 0); g.restore(); } }); t.update(); return t; };
      // one brass dial a seal, between the iron bands, the first on the left seen from the front (the box's -x side is on the
      // right from there); rebuilt when a lock has another number of seals or marks
      let dials = [], built = '';
      function buildDials() {
        if (built === N + ':' + M) return; built = N + ':' + M;
        dials.forEach(d => { try { d.material.diffuseTexture?.dispose(); d.material.dispose(); d.dispose(); } catch (e) {} });
        const sp = Math.min(.3, (SW * .37 - .14) * 2 / Math.max(1, N - 1)), dw = Math.min(.16, sp * .84);
        dials = Array.from({ length: N }, (_, k) => { const d = B.MeshBuilder.CreateCylinder('lockDial', { height: dw, diameter: .22, tessellation: 18 }, scene); const m = new B.StandardMaterial('lockDialM' + k + '_' + Date.now(), scene); m.diffuseTexture = dialTex(k); m.specularColor = new B.Color3(.5, .45, .3); m.emissiveColor = new B.Color3(.18, .14, .06); d.material = m; d.rotation.z = Math.PI / 2; d.parent = root; d.position.set(((N - 1) / 2 - k) * sp, SH * .52, SD / 2 + .02); d.isPickable = false; ctx.add(d); return d; });
      }
      buildDials();
      // ── the panel: the dials, Try, the tries so far ──
      const hud = document.getElementById('gameHud'), box = document.createElement('div');
      box.style.cssText = 'position:absolute;right:14px;top:70px;width:min(300px,calc(100vw - 28px));background:rgba(14,12,10,.93);border:1px solid rgba(216,179,92,.7);border-radius:12px;padding:12px;pointer-events:auto;font:14px/1.3 Georgia,serif;color:#eadfc6;display:none';
      hud.appendChild(box);
      // turn: each dial's turn so far (in marks, never wrapped: a dial turned past the last mark goes on round, not back)
      const st = { set: [], turn: [], sel: 0, tries: [], phase: 'pick', wait: 1.2, open: 0, locked: -1, k: 0 };
      // the locked-in seal glows gold on the box
      const lockGlow = (k, on) => { const m = dials[k]?.material; if (m) m.emissiveColor = on ? new B.Color3(.62, .45, .08) : new B.Color3(.18, .14, .06); };
      // gold: right mark, right place; silver: the rest of the marks the try shares with the code (each as often as it is in both)
      const feedback = (g) => { let gold = 0, common = 0; const a = {}, b = {}; g.forEach((v, i) => { if (code[i] === v) gold++; a[v] = (a[v] || 0) + 1; b[code[i]] = (b[code[i]] || 0) + 1; }); for (const v in a) common += Math.min(a[v], b[v] || 0); return { gold, silver: common - gold }; };
      const beads = (f) => '<span style="letter-spacing:2px">' + '<span style="color:#ffd45e">●</span>'.repeat(f.gold) + '<span style="color:#c8ccd6">●</span>'.repeat(f.silver) + '<span style="color:#3a352c">●</span>'.repeat(N - f.gold - f.silver) + '</span>';
      function draw() {
        const bw = Math.min(54, Math.floor((276 - (N - 1) * 6) / N)), fs = Math.min(30, Math.round(bw * .56)), small = N > 4;
        const sym = (v, i) => i === st.locked
          ? `<button type="button" data-d="${i}" title="Locked in: the right mark" style="position:relative;width:${bw}px;height:58px;border-radius:9px;border:2px solid #ffd45e;background:linear-gradient(#a8801f,#5c430d);color:#fff3c4;font:${fs}px/1 serif;cursor:default;box-shadow:0 0 10px rgba(255,212,94,.55)">${MARKS[v].s}<span style="position:absolute;right:3px;top:2px;font:11px/1 sans-serif">🔒</span></button>`
          : `<button type="button" data-d="${i}" style="width:${bw}px;height:58px;border-radius:9px;border:2px solid ${i === st.sel ? '#ffd45e' : 'rgba(216,179,92,.45)'};background:rgba(255,255,255,.05);color:${MARKS[v].c};font:${fs}px/1 serif;cursor:pointer">${MARKS[v].s}</button>`;
        box.innerHTML = `<div style="font:700 11.5px/1.2 Georgia,serif;letter-spacing:.14em;text-transform:uppercase;color:#d8b35c;margin-bottom:8px">The Broker's Strongbox · lock ${st.k + 1}</div>`
          + `<div style="display:flex;gap:6px;justify-content:center">${st.set.map(sym).join('')}</div>`
          + `<div style="display:flex;gap:6px;margin:8px 0 10px"><button type="button" data-a="try" style="flex:1;padding:8px;border-radius:8px;border:1px solid #d8b35c;background:rgba(255,216,119,.12);color:#ffe9b0;font:700 14px Georgia,serif;cursor:pointer">Try the lock (Enter)</button></div>`
          + `<div style="font-size:12px;color:#b9ab8c;margin-bottom:4px">Tries ${st.tries.length} / ${TRIES} · ${M} marks${L.repeats ? ', repeats' : ''} · gold: right place · silver: wrong place${st.locked >= 0 ? ' · 🔒 locked in' : ''}</div>`
          + st.tries.map((t, i) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 4px;border-top:1px solid rgba(216,179,92,.15)"><span style="color:#8d826a;width:18px">${i + 1}</span><span style="font:${small ? 17 : 20}px/1 serif;letter-spacing:${small ? 4 : 6}px">${t.g.map(v => `<span style="color:${MARKS[v].c}">${MARKS[v].s}</span>`).join('')}</span>${beads(t.f)}</div>`).join('');
        box.querySelectorAll('button[data-d]').forEach(b => b.onclick = (e) => { e.stopPropagation(); b.blur(); const i = +b.dataset.d; if (i === st.locked) H.msg('That seal is locked in', 900, 'it is the right mark'); else if (st.sel === i) cycle(1); else { st.sel = i; draw(); } });
        box.querySelector('button[data-a="try"]').onclick = (e) => { e.stopPropagation(); e.currentTarget.blur(); tryLock(); };
      }
      const info = () => H.info(`Lock ${st.k + 1} / ${LV.length} · ${N} seals of ${M} marks${L.repeats ? ', repeats' : ''} · try ${Math.min(st.tries.length + 1, TRIES)} / ${TRIES}`);
      function cycle(d) { if (st.phase !== 'play') return; if (st.sel === st.locked) { H.msg('That seal is locked in', 900, 'it is the right mark'); return; } st.set[st.sel] = (st.set[st.sel] + d + M) % M; st.turn[st.sel] += d; ctx.note(440 + st.set[st.sel] * 40, 'bell'); draw(); }
      function tryLock() {
        if (st.phase !== 'play') return;
        if (!L.repeats && new Set(st.set).size < N) { H.msg('Each mark only once', 900, 'no mark is used twice on this lock'); return; }
        const g = st.set.slice(), f = feedback(g); st.tries.push({ g, f }); ctx.sound('thock');
        if (f.gold === N) { st.phase = 'open'; st.wait = 2.2; ctx.sound('gamewin'); H.msg('Click. It opens!', 1500); }
        else if (st.tries.length >= TRIES) { st.phase = 'fail'; st.wait = 1.8; H.msg('The lock holds', 1400, 'the code was ' + code.map(v => MARKS[v].s).join(' ')); }
        else if (f.gold && st.locked < 0) {
          // one of the right marks gives itself away (one only, picked at random among this try's)
          const right = g.map((v, i) => v === code[i] ? i : -1).filter(i => i >= 0), k = right[Math.floor(Math.random() * right.length)];
          st.locked = k; lockGlow(k, true); if (st.sel === k) st.sel = (k + 1) % N; ctx.note(880, 'bell');
          H.msg(`${f.gold} gold · ${f.silver} silver`, 2200, `the ${MARKS[code[k]].n} seal locks in`);
        }
        else H.msg(`${f.gold} gold · ${f.silver} silver`, 1000);
        draw(); info();
      }
      // the dials back on the first marks (each a different one), no try yet, nothing locked in, a new code
      function fresh() { deal(); if (st.locked >= 0) lockGlow(st.locked, false); st.locked = -1; st.set = Array.from({ length: N }, (_, i) => i % M); st.turn = st.set.slice(); st.sel = 0; st.tries = []; }
      // a lock from the picker (keys 1-9, 0)
      let picker = null;
      const showPicker = () => { picker = H.levels({ title: def.title || "The Broker's Strongbox", sub: 'A gold bead: a right mark in the right place. A silver bead: a right mark on another seal. Ten locks, each harder than the last.', n: LV.length, open: store.open(LV.length), done: store.get(),
        label: k => `${LV[k].seals} of ${LV[k].marks} marks<br>${LV[k].repeats ? 'repeats · ' : ''}${LV[k].tries} tries`, pick: begin }); };
      function begin(k) {
        if (st.phase !== 'pick' || !(k >= 0 && k < LV.length) || k > store.open(LV.length)) return;
        if (picker) { picker.remove(); picker = null; }
        L = LV[k]; N = L.seals; M = L.marks; TRIES = L.tries; st.k = k; buildDials(); fresh();
        st.phase = 'intro'; st.wait = 1.2; box.style.display = ''; draw(); info();
        H.hint(`Pick a dial and turn it (click it, or <kbd>←</kbd> <kbd>→</kbd> to pick and <kbd>↑</kbd> <kbd>↓</kbd> to turn, <kbd>1</kbd>-<kbd>${N}</kbd> turn that dial), then try the lock. ${L.repeats ? 'A mark may be on more than one seal.' : 'No mark twice.'}`);
        H.msg(`Lock ${k + 1}`, 1500, `${N} seals of ${M} marks${L.repeats ? ', marks may repeat' : ''} · ${TRIES} tries`);
      }
      function restart() { if (st.phase !== 'play') return; fresh(); draw(); info(); H.msg('A new code', 1200, 'the Broker reset the lock'); }
      const PA = def.playerAt || [BOX[0] + Math.sin(FACE) * 2.2, BOX[2] + Math.cos(FACE) * 2.2];
      ctx.player.place(PA[0], PA[1], PA[2] ?? FACE + Math.PI); // playerAt [x, z, yaw?]: beside the box, out of the camera's line
      ctx.look(cam, at, def.fov || .8);
      H.title(def.title || "The Broker's Strongbox"); H.score(''); H.info('Pick a lock');
      H.hint('Pick a lock: click it or press its number.');
      showPicker();
      const inst = {
        update(dt) {
          ctx.look(cam, at);
          if (st.phase === 'intro' && (st.wait -= dt) <= 0) st.phase = 'play';
          dials.forEach((d, k) => { const want = (st.turn[k] ?? 0) * 2 * Math.PI / M; d.rotation.x += (want - d.rotation.x) * Math.min(1, dt * 10); }); // round the dial's own axis
          if (st.phase === 'open') { st.open = Math.min(1, st.open + dt * .9); hinge.rotation.x = -1.9 * st.open * st.open * (3 - 2 * st.open); }
          if ((st.phase === 'open' || st.phase === 'fail') && (st.wait -= dt) <= 0) {
            const won = st.phase === 'open'; st.phase = 'done'; H.hint(''); box.remove();
            const n = st.tries.length, k = st.k, score = won ? 10 * (k + 1) + 5 * (TRIES - n) : 0;
            if (won) store.set(k + 1);
            ctx.finish({ score, label: 'points', passed: won && score >= (def.pass || 0), solved: won, solvedWord: 'Opened', next: won && k + 1 < LV.length ? k + 1 : null,
              extra: won ? `Lock ${k + 1} opened in ${n} ${n === 1 ? 'try' : 'tries'} of ${TRIES}.${k + 1 < LV.length ? ` Lock ${k + 2} is open.` : ' Every lock is open.'}` : `The code was ${code.map(v => MARKS[v].n).join(', ')}.` });
          }
        },
        key(e, down) {
          if (!down || e.repeat) return; if (picker && picker.key(e)) return; if (st.phase === 'pick') return;
          const k = e.key.toLowerCase();
          if (k === 'arrowleft' || k === 'a') { st.sel = (st.sel + N - 1) % N; if (st.sel === st.locked) st.sel = (st.sel + N - 1) % N; draw(); }
          else if (k === 'arrowright' || k === 'd') { st.sel = (st.sel + 1) % N; if (st.sel === st.locked) st.sel = (st.sel + 1) % N; draw(); }
          else if (k === 'arrowup' || k === 'w') cycle(1); else if (k === 'arrowdown' || k === 's') cycle(-1);
          else if (k === 'enter' || k === ' ') tryLock();
          else { const n = parseInt(k, 10); if (n >= 1 && n <= N) { st.sel = n - 1; cycle(1); } }
        },
        pointer() {},
        restart, // the HUD's Restart button
        _test: { st, code, tryLock, setDials(v) { st.set = v.slice(); st.turn = v.slice(); draw(); }, feedback, begin, LV, get L() { return L; }, get dials() { return dials; }, get picker() { return picker; } },
        dispose() { box.remove(); if (picker) picker.remove(); dials.forEach(d => { try { d.material.diffuseTexture?.dispose(); d.material.dispose(); } catch (e) {} }); }
      };
      return inst;
    }
  };
  window.RebelGames.register('lock', G);
})();
