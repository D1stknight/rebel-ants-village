// Crosswalk Rush (Oct 15, Saints of LA): four lanes of traffic, and the block party is on the other side. Hop across
// one lane at a time (W / ↑ across, S / ↓ back toward the camera, A D / ← → a step aside), then back again: every crossing scores and
// the traffic speeds up. A car that catches you sends you back to the curb and costs a life. 60 seconds, three lives.
// def: { col: x of the crossing, rows: [z of the start curb, lane 1..4, the far curb], lanes: [{ dir, speed, cars }],
//        span: [x0, x1] where cars drive, side: max step aside (m), seconds, cam, look, pass, points }
// Oct 17 (Miguel: "make the view bigger and space out the cars a little more, give it like 20 levels ... make the spacing
// fair as you go, i noticed I was able to cross twice but them in the 3rd time the cars where too close"): twenty levels,
// each a number of crossings against the clock; one car a lane (a second car came in after the second crossing and the
// gaps closed up), so every lane always has a gap of at least (road - two car lengths) / speed (2.8 s on level 1, still
// 1 s on level 20); the cars quicken a little with each crossing (3 %, was 12 %); the camera higher and farther out.
(function () {
  const CARS = ['sl_car_red', 'sl_car_blue', 'sl_car_gold', 'sl_car_white', 'sl_car_purple', 'sl_car_black'];
  const G = {
    title: 'Crosswalk Rush',
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const COL = def.col ?? 0, ROWS = def.rows || [0, 3.25, 6.75, 10.25, 13.75, 17], SPAN = def.span || [COL - 11, COL + 8], SIDE = def.side || 4;
      const LEVELS = 20, store = ctx.util.levelStore(def.id || 'crossing');
      const LV = Array.from({ length: LEVELS }, (_, k) => { const u = k / (LEVELS - 1), n = 2 + Math.floor(k / 3); return { crossings: n, seconds: 25 + n * 7, speedK: 1 + .75 * u }; });
      let L = LV[0];
      const LANES = def.lanes || [{ dir: 1, speed: 4.6, cars: 1 }, { dir: 1, speed: 6.2, cars: 1 }, { dir: -1, speed: 5.4, cars: 1 }, { dir: -1, speed: 7.2, cars: 1 }];
      const nodes = [], keep = n => { if (!n.parent) n.parent = ctx.frame; ctx.add(n); nodes.push(n); return n; };
      const HOP = .3, INTRO = 1.6, len = SPAN[1] - SPAN[0], wrap = x => SPAN[0] + (((x - SPAN[0]) % len) + len) % len;
      // the cars: kit lowriders and sedans, one a lane, each at least 7 m up the road from the crossing when play starts
      // (they run through the intro)
      const cars = [];
      LANES.forEach((ln, li) => { for (let k = 0; k < (ln.cars || 1); k++) {
        const root = ctx.kit(CARS[(li * 2 + k) % CARS.length]); nodes.push(root); root.setEnabled(false);
        cars.push({ root, lane: li + 1, x: 0, dir: ln.dir, base: ln.speed, k, n: ln.cars || 1, on: false });
      } });
      const setCars = () => cars.forEach((c, i) => { const v = c.base * L.speedK; c.x = wrap(COL - c.dir * (7 + (c.lane - 1) * 2.5 + c.k * len / c.n + Math.random() * 3) - c.dir * v * INTRO); c.root.position.set(c.x, 0, ROWS[c.lane]); c.root.rotation.y = c.dir > 0 ? 0 : Math.PI; c.on = true; c.root.setEnabled(true); });
      // the zebra stripes and a gold line at the far curb (where the next crossing ends)
      const mat = (k, c, em) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(.05, .05, .05); if (em) m.emissiveColor = new B.Color3(...em); return m; });
      const zebra = mat('zebra', [.95, .95, .92], [.35, .35, .33]), goalM = mat('goal', [1, .8, .3], [.8, .55, .12]);
      for (let z = ROWS[1] - 1.6; z <= ROWS[4] + 1.6; z += 1.1) { const s = keep(B.MeshBuilder.CreateGround('crZebra', { width: 3.4, height: .55 }, scene)); s.position.set(COL, .025, z); s.material = zebra; s.isPickable = false; }
      const goal = keep(B.MeshBuilder.CreateGround('crGoal', { width: 3.6, height: .5 }, scene)); goal.material = goalM; goal.isPickable = false;
      const st = { phase: 'pick', intro: INTRO, left: 0, lives: 3, crossings: 0, row: 0, x: COL, to: ROWS.length - 1, hop: 0, from: null, speedK: 1, score: 0, hits: 0, level: 0 };
      const placeGoal = () => goal.position.set(COL, .03, st.to === 0 ? ROWS[0] + .9 : ROWS[ROWS.length - 1] - .9);
      placeGoal();
      const P = () => ctx.player;
      P().place(COL, ROWS[0], st.to > 0 ? 0 : Math.PI);
      const cam = def.cam || [COL - 1.5, 15, ROWS[0] - 12], look = def.look || [COL - 2, 0, (ROWS[0] + ROWS[ROWS.length - 1]) / 2 + 1];
      ctx.look(cam, look, def.fov || .95);
      // def.hide: layout pieces of these types past the far end of the crossing step aside while it plays (Saints: a
      // streetlight stood right behind the crossing, a pole down the middle of the view from the higher camera)
      const hidden = [];
      if (def.hide && def.hide.length) { const o = ctx.toWorld(COL, 0, ROWS[ROWS.length - 1] + 4); for (const n of scene.transformNodes) {
        if (!n.isEnabled() || !(def.hide.includes(n.metadata && n.metadata.type) || def.hide.some(t => n.name.startsWith(t + 'RootClone_')))) continue;
        const a = n.getAbsolutePosition(); if (Math.hypot(a.x - o.x, a.z - o.z) < 7) { n.setEnabled(false); hidden.push(n); } } }
      H.title(def.title || 'Crosswalk Rush'); H.score(0);
      H.hint('Hop: <kbd>W</kbd>/<kbd>↑</kbd> across, <kbd>S</kbd>/<kbd>↓</kbd> back toward you, <kbd>A</kbd><kbd>D</kbd>/<kbd>←</kbd><kbd>→</kbd> a step aside. Reach the gold line, then cross back to the next one.');
      const info = () => H.info(`Level ${st.level + 1} \u00b7 ${st.crossings} / ${L.crossings} \u00b7 ${Math.ceil(st.left)} s \u00b7 ${'❤'.repeat(st.lives)}${'♡'.repeat(3 - st.lives)}`);
      // ── the level picker ──
      let picker = null;
      const showPicker = () => { picker = H.levels({ title: def.title || 'Crosswalk Rush', sub: 'Make the crossings before the clock runs out. Twenty levels, the traffic quicker on each.', n: LEVELS, open: store.open(LEVELS), done: store.get(), label: k => `${LV[k].crossings} \u00d7 \u00b7 ${LV[k].seconds} s`, pick: begin }); };
      function begin(k) {
        if (st.phase !== 'pick') return; if (picker) { picker.remove(); picker = null; }
        L = LV[k]; Object.assign(st, { level: k, phase: 'intro', intro: INTRO, left: L.seconds, lives: 3, crossings: 0, row: 0, x: COL, to: ROWS.length - 1, hop: 0, speedK: L.speedK, score: 0, hits: 0 });
        setCars(); placeGoal(); P().place(COL, ROWS[0], 0); H.score(0); info(); H.msg(`Level ${k + 1}`, 1400, `${L.crossings} crossings in ${L.seconds} s`);
      }
      showPicker();
      function hop(dr, dx) {
        if (st.phase !== 'play' || st.hop > 0) return;
        const row = Math.max(0, Math.min(ROWS.length - 1, st.row + dr)), x = Math.max(COL - SIDE, Math.min(COL + SIDE, st.x + dx));
        if (row === st.row && x === st.x) return;
        st.from = [st.x, ROWS[st.row]]; st.row = row; st.x = x; st.hop = HOP;
        P().face(dr > 0 ? 0 : dr < 0 ? Math.PI : dx > 0 ? Math.PI / 2 : -Math.PI / 2); P().hop ? P().hop(HOP) : P().clip('jump');
      }
      function hit(c) {
        st.hits++; st.lives--; ctx.sound('thock'); H.msg('Honk!', 900, st.lives ? 'back to the curb' : 'out of lives'); info();
        const back = st.to > 0 ? 0 : ROWS.length - 1; st.row = back; st.x = COL; st.hop = 0; P().place(COL, ROWS[back], st.to > 0 ? 0 : Math.PI); st.safe = 1;
        if (st.lives <= 0) { st.phase = 'end'; st.wait = 1.6; }
      }
      return {
        update(dt) {
          ctx.look(cam, look);
          if (st.phase === 'pick') return;
          if (st.phase === 'intro' && (st.intro -= dt) <= 0) st.phase = 'play';
          // traffic (also during the intro), wrapping at the ends of the span; cars scale in and out at the ends
          for (const c of cars) { c.x += c.dir * c.base * st.speedK * dt; if (c.x > SPAN[1]) c.x -= len; if (c.x < SPAN[0]) c.x += len;
            const edge = Math.min(c.x - SPAN[0], SPAN[1] - c.x), s = Math.max(.01, Math.min(1, edge / 1.6)); c.root.position.x = c.x; c.root.scaling.set(s, s, s); }
          if (st.phase !== 'play') { if (st.phase === 'end' && (st.wait -= dt) <= 0) { st.phase = 'done'; H.hint('');
            const ok = st.crossings >= L.crossings, pts = st.crossings * 20 + st.lives * 10 * (st.crossings ? 1 : 0) + (ok ? Math.round(st.left) * 2 : 0); if (ok) store.set(st.level + 1);
            ctx.finish({ score: pts, label: 'points', passed: pts >= (def.pass || 0), kicker: ok ? `Level ${st.level + 1} cleared` : `Level ${st.level + 1}`, solved: ok, next: ok && st.level + 1 < LEVELS ? st.level + 1 : null, extra: `${st.crossings} of ${L.crossings} crossings, ${st.hits} honk${st.hits === 1 ? '' : 's'}.` }); }
            return; }
          st.left = Math.max(0, st.left - dt); info();
          if (st.safe > 0) st.safe -= dt;
          // the hop: from the last square to the new one in an arc
          const pr = P().root;
          if (st.hop > 0) { st.hop = Math.max(0, st.hop - dt); const f = 1 - st.hop / HOP, w = ctx.toWorld(st.from[0] + (st.x - st.from[0]) * f, 0, st.from[1] + (ROWS[st.row] - st.from[1]) * f); pr.position.x = w.x; pr.position.z = w.z;
            if (!st.hop) { if (st.row === st.to) { st.crossings++; st.speedK *= 1.03; ctx.sound('gamewin'); H.score(st.crossings * 20); info();
              if (st.crossings >= L.crossings) { st.phase = 'end'; st.wait = 1.2; H.msg('Made it!', 1200); } else { H.msg(`Crossing ${st.crossings}!`, 900, 'now back again'); st.to = st.to > 0 ? 0 : ROWS.length - 1; placeGoal(); } } } }
          // a car on the Rebel's lane within reach (the body is ~1 m wide, a car ~4.6 m long)
          if (st.row > 0 && st.row < ROWS.length - 1 && !(st.safe > 0)) { const px = st.hop > 0 ? st.from[0] + (st.x - st.from[0]) * (1 - st.hop / HOP) : st.x;
            for (const c of cars) if (c.on && c.lane === st.row && Math.abs(c.x - px) < 2.75) { hit(c); break; } }
          if (st.left <= 0) { st.phase = 'end'; st.wait = 1.4; H.msg('Time!', 1200); }
        },
        key(e, down) { if (!down || e.repeat) return; if (picker && picker.key(e)) return; const k = e.key.toLowerCase();
          if (k === 'w' || k === 'arrowup') hop(1, 0); else if (k === 's' || k === 'arrowdown') hop(-1, 0); // up the screen = across, away from the camera
          else if (k === 'a' || k === 'arrowleft') hop(0, -1.5); else if (k === 'd' || k === 'arrowright') hop(0, 1.5); },
        pointer() {},
        restart() { if (st.phase === 'pick') return; st.phase = 'pick'; cars.forEach(c => c.root.setEnabled(false)); showPicker(); },
        _test: { st, cars, hop, ROWS, begin, LV, get L() { return L; }, SPAN },
        dispose() { if (picker) picker.remove(); nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); hidden.forEach(n => { if (!n.isDisposed()) n.setEnabled(true); }); }
      };
    }
  };
  window.RebelGames.register('crossing', G);
})();
