// The Broker's Strongbox (Oct 15, the Wokou trade house): a code lock of four seals, each one of six sea marks, no mark
// twice. Set the four dials and try them: every gold bead is a right mark in the right place, every silver bead a right
// mark in the wrong place (they never say which). Eight tries. A logic puzzle: the fewer tries, the more it pays.
// def: { box: [x, y, z] (frame coords of the box's foot), size: [w, h, d], face: yaw (the way its front faces), tries: 8,
// playerAt: [x, z], cam, at, pass, points }
// Oct 17 (Miguel: the puzzles need a how-to, every board a Restart): howTo (the rules in a few lines) and inst.restart
// (the dials and tries back, a NEW code on the lock: the old one's beads would give it away).
(function () {
  const MARKS = [{ s: '⚓︎', n: 'anchor', c: '#9fb8d8' }, { s: '☠︎', n: 'skull', c: '#e8e2d0' }, { s: '✦︎', n: 'star', c: '#ffd45e' },
    { s: '⚔︎', n: 'swords', c: '#d8d8e8' }, { s: '♒︎', n: 'waves', c: '#6fd0d8' }, { s: '☸︎', n: 'wheel', c: '#e0a060' }];
  const G = {
    title: "The Broker's Strongbox",
    howTo: {
      lines: ['Open the strongbox. Its code is four seals, each one of six sea marks, and no mark is used twice.',
        'Set the four dials, then press Try the lock (or Enter). Click a dial to pick it and click it again to turn it; or ← → pick a dial and ↑ ↓ turn it (1-4 turn that dial).',
        'After each try: a gold bead for every mark in the right place, a silver bead for every right mark in the wrong place. The beads never say which mark is which.',
        'You have eight tries, and the fewer you need, the more it pays.',
        'Tip: between tries, change only one or two dials and watch how the beads change.']
    },
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const BOX = def.box || [0, 0, 2], FACE = def.face ?? 0, TRIES = def.tries || 8, [SW, SH, SD] = def.size || [1.5, .7, .9];
      const code = [], deal = () => { const pool = [0, 1, 2, 3, 4, 5]; code.length = 0; for (let k = 0; k < 4; k++) code.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]); }; deal();
      const mat = (k, c, em, spec = .2) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(spec, spec, spec); if (em) m.emissiveColor = new B.Color3(...em); return m; });
      // the strongbox: dark wood, iron bands, four brass dials on the front, a hinged lid with gold inside
      const root = new B.TransformNode('lockBox', scene); ctx.add(root); root.position.set(BOX[0], BOX[1], BOX[2]); root.rotation.y = FACE;
      const wood = mat('wood', [.22, .13, .07], [.03, .02, .01]), iron = mat('iron', [.18, .18, .2], [.02, .02, .03], .5), brass = mat('brass', [.78, .6, .26], [.2, .14, .04], .8), gold = mat('gold', [1, .8, .3], [.6, .42, .1], .9);
      const part = (m, mt, x, y, z) => { m.material = mt; m.parent = root; m.position.set(x, y, z); m.isPickable = false; ctx.add(m); return m; };
      part(B.MeshBuilder.CreateBox('lockBody', { width: SW, height: SH, depth: SD }, scene), wood, 0, SH / 2, 0);
      for (const x of [-SW * .37, SW * .37]) part(B.MeshBuilder.CreateBox('lockBand', { width: .08, height: SH + .02, depth: SD + .02 }, scene), iron, x, SH / 2, 0);
      part(B.MeshBuilder.CreateBox('lockGold', { width: SW - .2, height: .05, depth: SD - .2 }, scene), gold, 0, SH + .01, 0);
      const hinge = new B.TransformNode('lockHinge', scene); hinge.parent = root; hinge.position.set(0, SH, -SD / 2); ctx.add(hinge);
      const lid = B.MeshBuilder.CreateBox('lockLid', { width: SW + .02, height: .14, depth: SD + .02 }, scene); lid.material = wood; lid.parent = hinge; lid.position.set(0, .07, SD / 2); lid.isPickable = false; ctx.add(lid);
      const lidBand = B.MeshBuilder.CreateBox('lockLidBand', { width: SW + .04, height: .05, depth: .1 }, scene); lidBand.material = iron; lidBand.parent = hinge; lidBand.position.set(0, .1, SD - .02); lidBand.isPickable = false; ctx.add(lidBand);
      const dialTex = (k) => { const t = new B.DynamicTexture('lockDialT' + k, { width: 256, height: 64 }, scene, true), g = t.getContext(); g.fillStyle = '#b8903e'; g.fillRect(0, 0, 256, 64); g.fillStyle = '#2a1a08'; g.font = 'bold 34px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; MARKS.forEach((m, i) => g.fillText(m.s, (i + .5) * 256 / 6, 34)); t.update(); return t; };
      const dials = [0, 1, 2, 3].map(k => { const d = B.MeshBuilder.CreateCylinder('lockDial', { height: .16, diameter: .22, tessellation: 18 }, scene); const m = new B.StandardMaterial('lockDialM' + k + '_' + Date.now(), scene); m.diffuseTexture = dialTex(k); m.specularColor = new B.Color3(.5, .45, .3); m.emissiveColor = new B.Color3(.18, .14, .06); d.material = m; d.rotation.z = Math.PI / 2; d.parent = root; d.position.set((-1.5 + k) * Math.min(.3, SW / 5), SH * .52, SD / 2 + .02); d.isPickable = false; ctx.add(d); return d; });
      // ── the panel: four dials, Try, the tries so far ──
      const hud = document.getElementById('gameHud'), box = document.createElement('div');
      box.style.cssText = 'position:absolute;right:14px;top:70px;width:min(300px,calc(100vw - 28px));background:rgba(14,12,10,.93);border:1px solid rgba(216,179,92,.7);border-radius:12px;padding:12px;pointer-events:auto;font:14px/1.3 Georgia,serif;color:#eadfc6';
      hud.appendChild(box);
      const st = { set: [0, 1, 2, 3], sel: 0, tries: [], phase: 'intro', wait: 1.2, open: 0 };
      const feedback = (g) => { let gold = 0, silver = 0; g.forEach((v, i) => { if (code[i] === v) gold++; else if (code.includes(v)) silver++; }); return { gold, silver }; };
      const beads = (f) => '<span style="letter-spacing:2px">' + '<span style="color:#ffd45e">●</span>'.repeat(f.gold) + '<span style="color:#c8ccd6">●</span>'.repeat(f.silver) + '<span style="color:#3a352c">●</span>'.repeat(4 - f.gold - f.silver) + '</span>';
      function draw() {
        const sym = (v, i) => `<button type="button" data-d="${i}" style="width:54px;height:58px;border-radius:9px;border:2px solid ${i === st.sel ? '#ffd45e' : 'rgba(216,179,92,.45)'};background:rgba(255,255,255,.05);color:${MARKS[v].c};font:30px/1 serif;cursor:pointer">${MARKS[v].s}</button>`;
        box.innerHTML = `<div style="font:700 11.5px/1.2 Georgia,serif;letter-spacing:.14em;text-transform:uppercase;color:#d8b35c;margin-bottom:8px">The Broker's Strongbox</div>`
          + `<div style="display:flex;gap:6px;justify-content:center">${st.set.map(sym).join('')}</div>`
          + `<div style="display:flex;gap:6px;margin:8px 0 10px"><button type="button" data-a="try" style="flex:1;padding:8px;border-radius:8px;border:1px solid #d8b35c;background:rgba(255,216,119,.12);color:#ffe9b0;font:700 14px Georgia,serif;cursor:pointer">Try the lock (Enter)</button></div>`
          + `<div style="font-size:12px;color:#b9ab8c;margin-bottom:4px">Tries ${st.tries.length} / ${TRIES} · gold: right place · silver: wrong place</div>`
          + st.tries.map((t, i) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 4px;border-top:1px solid rgba(216,179,92,.15)"><span style="color:#8d826a;width:18px">${i + 1}</span><span style="font:20px/1 serif;letter-spacing:6px">${t.g.map(v => `<span style="color:${MARKS[v].c}">${MARKS[v].s}</span>`).join('')}</span>${beads(t.f)}</div>`).join('');
        box.querySelectorAll('button[data-d]').forEach(b => b.onclick = (e) => { e.stopPropagation(); b.blur(); const i = +b.dataset.d; if (st.sel === i) cycle(1); else { st.sel = i; draw(); } });
        box.querySelector('button[data-a="try"]').onclick = (e) => { e.stopPropagation(); e.currentTarget.blur(); tryLock(); };
      }
      function cycle(d) { if (st.phase !== 'play') return; st.set[st.sel] = (st.set[st.sel] + d + 6) % 6; ctx.note(440 + st.set[st.sel] * 40, 'bell'); draw(); }
      function tryLock() {
        if (st.phase !== 'play') return;
        if (new Set(st.set).size < 4) { H.msg('Each mark only once', 900); return; }
        const g = st.set.slice(), f = feedback(g); st.tries.push({ g, f }); ctx.sound('thock');
        if (f.gold === 4) { st.phase = 'open'; st.wait = 2.2; ctx.sound('gamewin'); H.msg('Click. It opens!', 1500); }
        else if (st.tries.length >= TRIES) { st.phase = 'fail'; st.wait = 1.8; H.msg('The lock holds', 1400, 'the code was ' + code.map(v => MARKS[v].s).join(' ')); }
        else H.msg(`${f.gold} gold · ${f.silver} silver`, 1000);
        draw(); H.info(`Try ${Math.min(st.tries.length + 1, TRIES)} / ${TRIES}`);
      }
      function restart() { if (st.phase !== 'play') return; deal(); st.set = [0, 1, 2, 3]; st.sel = 0; st.tries = []; draw(); H.info(`Try 1 / ${TRIES}`); H.msg('A new code', 1200, 'the Broker reset the lock'); }
      const PA = def.playerAt || [BOX[0] + Math.sin(FACE) * 2.2, BOX[2] + Math.cos(FACE) * 2.2];
      ctx.player.place(PA[0], PA[1], FACE + Math.PI);
      const cam = def.cam || [BOX[0] + Math.sin(FACE) * 3.4 - Math.cos(FACE) * 1.2, BOX[1] + 2.6, BOX[2] + Math.cos(FACE) * 3.4 + Math.sin(FACE) * 1.2], at = def.at || [BOX[0], BOX[1] + SH * .6, BOX[2]];
      ctx.look(cam, at, def.fov || .8);
      H.title(def.title || "The Broker's Strongbox"); H.score(''); H.info(`Try 1 / ${TRIES}`);
      H.hint('Pick a dial and turn it (click it, or <kbd>←</kbd> <kbd>→</kbd> to pick and <kbd>↑</kbd> <kbd>↓</kbd> to turn), then try the lock. No mark twice.');
      H.msg(def.title || "The Broker's Strongbox", 1500, `${TRIES} tries`);
      draw();
      const inst = {
        update(dt) {
          ctx.look(cam, at);
          if (st.phase === 'intro' && (st.wait -= dt) <= 0) st.phase = 'play';
          dials.forEach((d, k) => { const want = st.set[k] * Math.PI / 3; d.rotation.y += (want - d.rotation.y) * Math.min(1, dt * 10); });
          if (st.phase === 'open') { st.open = Math.min(1, st.open + dt * .9); hinge.rotation.x = -1.9 * st.open * st.open * (3 - 2 * st.open); }
          if ((st.phase === 'open' || st.phase === 'fail') && (st.wait -= dt) <= 0) {
            const won = st.phase === 'open'; st.phase = 'done'; H.hint(''); box.remove();
            const n = st.tries.length, score = won ? Math.max(30, 100 - (n - 1) * 10) : 0;
            ctx.finish({ score, label: 'points', passed: won && score >= (def.pass || 0), extra: won ? `Opened in ${n} ${n === 1 ? 'try' : 'tries'}.` : `The code was ${code.map(v => MARKS[v].n).join(', ')}.` });
          }
        },
        key(e, down) {
          if (!down || e.repeat) return; const k = e.key.toLowerCase();
          if (k === 'arrowleft' || k === 'a') { st.sel = (st.sel + 3) % 4; draw(); }
          else if (k === 'arrowright' || k === 'd') { st.sel = (st.sel + 1) % 4; draw(); }
          else if (k === 'arrowup' || k === 'w') cycle(1); else if (k === 'arrowdown' || k === 's') cycle(-1);
          else if (k === 'enter' || k === ' ') tryLock();
          else { const n = parseInt(k, 10); if (n >= 1 && n <= 4) { st.sel = n - 1; cycle(1); } }
        },
        pointer() {},
        restart, // the HUD's Restart button
        _test: { st, code, tryLock, setDials(v) { st.set = v.slice(); draw(); }, feedback },
        dispose() { box.remove(); dials.forEach(d => { try { d.material.diffuseTexture?.dispose(); d.material.dispose(); } catch (e) {} }); }
      };
      return inst;
    }
  };
  window.RebelGames.register('lock', G);
})();
