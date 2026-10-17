// Crosswalk Rush (Oct 15, Saints of LA): four lanes of traffic, and the block party is on the other side. Hop across
// one lane at a time (W / ↑ across, S / ↓ back toward the camera, A D / ← → a step aside), then back again: every crossing scores and
// the traffic speeds up. A car that catches you sends you back to the curb and costs a life. 60 seconds, three lives.
// def: { col: x of the crossing, rows: [z of the start curb, lane 1..4, the far curb], lanes: [{ dir, speed, cars }],
//        span: [x0, x1] where cars drive, side: max step aside (m), seconds, cam, look, pass, points }
(function () {
  const CARS = ['sl_car_red', 'sl_car_blue', 'sl_car_gold', 'sl_car_white', 'sl_car_purple', 'sl_car_black'];
  const G = {
    title: 'Crosswalk Rush',
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const COL = def.col ?? 0, ROWS = def.rows || [0, 3.25, 6.75, 10.25, 13.75, 17], SPAN = def.span || [COL - 11, COL + 8], SIDE = def.side || 4, SEC = def.seconds || 60;
      const LANES = def.lanes || [{ dir: 1, speed: 5.2, cars: 2 }, { dir: 1, speed: 7.4, cars: 2 }, { dir: -1, speed: 6.2, cars: 2 }, { dir: -1, speed: 8.6, cars: 2 }];
      const nodes = [], keep = n => { if (!n.parent) n.parent = ctx.frame; ctx.add(n); nodes.push(n); return n; };
      const HOP = .3, INTRO = 1.6, len = SPAN[1] - SPAN[0], wrap = x => SPAN[0] + (((x - SPAN[0]) % len) + len) % len;
      // the cars: kit lowriders and sedans, one a lane to begin with, each at least 7 m up the road from the crossing when
      // play starts (they run through the intro); a lane's second car joins from the far end after the second crossing
      const cars = [];
      LANES.forEach((L, li) => { for (let k = 0; k < L.cars; k++) {
        const root = ctx.kit(CARS[(li * 2 + k) % CARS.length]); nodes.push(root);
        const x = wrap(COL - L.dir * (7 + li * 2.5 + k * len / L.cars + Math.random() * 2) - L.dir * L.speed * INTRO);
        root.position.set(x, 0, ROWS[li + 1]); root.rotation.y = L.dir > 0 ? 0 : Math.PI;
        const on = k === 0; root.setEnabled(on);
        cars.push({ root, lane: li + 1, x, dir: L.dir, base: L.speed, on, joinAt: k ? 2 : 0 });
      } });
      // the zebra stripes and a gold line at the far curb (where the next crossing ends)
      const mat = (k, c, em) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(.05, .05, .05); if (em) m.emissiveColor = new B.Color3(...em); return m; });
      const zebra = mat('zebra', [.95, .95, .92], [.35, .35, .33]), goalM = mat('goal', [1, .8, .3], [.8, .55, .12]);
      for (let z = ROWS[1] - 1.6; z <= ROWS[4] + 1.6; z += 1.1) { const s = keep(B.MeshBuilder.CreateGround('crZebra', { width: 3.4, height: .55 }, scene)); s.position.set(COL, .025, z); s.material = zebra; s.isPickable = false; }
      const goal = keep(B.MeshBuilder.CreateGround('crGoal', { width: 3.6, height: .5 }, scene)); goal.material = goalM; goal.isPickable = false;
      const st = { phase: 'intro', intro: INTRO, left: SEC, lives: 3, crossings: 0, row: 0, x: COL, to: ROWS.length - 1, hop: 0, from: null, speedK: 1, score: 0, hits: 0 };
      const placeGoal = () => goal.position.set(COL, .03, st.to === 0 ? ROWS[0] + .9 : ROWS[ROWS.length - 1] - .9);
      placeGoal();
      const P = () => ctx.player;
      P().place(COL, ROWS[0], st.to > 0 ? 0 : Math.PI);
      const cam = def.cam || [COL - 1.5, 10.5, ROWS[0] - 8.5], look = def.look || [COL, 0, (ROWS[0] + ROWS[ROWS.length - 1]) / 2 + 1];
      ctx.look(cam, look, def.fov || .85);
      H.title(def.title || 'Crosswalk Rush'); H.score(0); H.info(`${SEC} s · ❤❤❤`);
      H.hint('Hop: <kbd>W</kbd>/<kbd>↑</kbd> across, <kbd>S</kbd>/<kbd>↓</kbd> back toward you, <kbd>A</kbd><kbd>D</kbd>/<kbd>←</kbd><kbd>→</kbd> a step aside. Reach the gold line, then cross back to the next one.');
      H.msg('Crosswalk Rush', 1400, 'mind the traffic');
      const info = () => H.info(`${Math.ceil(st.left)} s · ${'❤'.repeat(st.lives)}${'♡'.repeat(3 - st.lives)}`);
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
          if (st.phase === 'intro' && (st.intro -= dt) <= 0) st.phase = 'play';
          // traffic (also during the intro), wrapping at the ends of the span; cars scale in and out at the ends
          for (const c of cars) { c.x += c.dir * c.base * st.speedK * dt; let wrapped = false; if (c.x > SPAN[1]) { c.x -= len; wrapped = true; } if (c.x < SPAN[0]) { c.x += len; wrapped = true; }
            if (!c.on && wrapped && st.crossings >= c.joinAt) { c.on = true; c.root.setEnabled(true); } // joins from the end of the road
            const edge = Math.min(c.x - SPAN[0], SPAN[1] - c.x), s = Math.max(.01, Math.min(1, edge / 1.6)); c.root.position.x = c.x; c.root.scaling.set(s, s, s); }
          if (st.phase !== 'play') { if (st.phase === 'end' && (st.wait -= dt) <= 0) { st.phase = 'done'; H.hint('');
            const pts = st.crossings * 20 + st.lives * 10 * (st.crossings ? 1 : 0); ctx.finish({ score: pts, label: 'points', passed: pts >= (def.pass || 0), extra: `${st.crossings} crossing${st.crossings === 1 ? '' : 's'}, ${st.hits} honk${st.hits === 1 ? '' : 's'}.` }); }
            return; }
          st.left = Math.max(0, st.left - dt); info();
          if (st.safe > 0) st.safe -= dt;
          // the hop: from the last square to the new one in an arc
          const pr = P().root;
          if (st.hop > 0) { st.hop = Math.max(0, st.hop - dt); const f = 1 - st.hop / HOP, w = ctx.toWorld(st.from[0] + (st.x - st.from[0]) * f, 0, st.from[1] + (ROWS[st.row] - st.from[1]) * f); pr.position.x = w.x; pr.position.z = w.z;
            if (!st.hop) { if (st.row === st.to) { st.crossings++; st.speedK *= 1.12; ctx.sound('gamewin'); H.score(st.crossings * 20); H.msg(`Crossing ${st.crossings}!`, 900, 'now back again');
              st.to = st.to > 0 ? 0 : ROWS.length - 1; placeGoal(); } } }
          // a car on the Rebel's lane within reach (the body is ~1 m wide, a car ~4.6 m long)
          if (st.row > 0 && st.row < ROWS.length - 1 && !(st.safe > 0)) { const px = st.hop > 0 ? st.from[0] + (st.x - st.from[0]) * (1 - st.hop / HOP) : st.x;
            for (const c of cars) if (c.on && c.lane === st.row && Math.abs(c.x - px) < 2.75) { hit(c); break; } }
          if (st.left <= 0) { st.phase = 'end'; st.wait = 1.4; H.msg('Time!', 1200); }
        },
        key(e, down) { if (!down || e.repeat) return; const k = e.key.toLowerCase();
          if (k === 'w' || k === 'arrowup') hop(1, 0); else if (k === 's' || k === 'arrowdown') hop(-1, 0); // up the screen = across, away from the camera
          else if (k === 'a' || k === 'arrowleft') hop(0, -1.5); else if (k === 'd' || k === 'arrowright') hop(0, 1.5); },
        pointer() {},
        _test: { st, cars, hop, ROWS },
        dispose() { nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); }
      };
    }
  };
  window.RebelGames.register('crossing', G);
})();
