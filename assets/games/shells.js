// The shell game (Oct 15): a mini ant hides under one of three cups, the cups shuffle (faster and longer each round),
// pick the cup (click it or press 1-3). Six rounds; a wrong pick shows where it was and costs a life.
// def: { rounds: 20, lives: 3, table: [x, y, z] (frame coords of the table top's centre), pass, points }
// Oct 17 (Miguel: "give it 20 rounds"): twenty rounds, the shuffle a swap longer and quicker each round; from round 8 some
// passes are feints (two cups cross and go back), from round 13 all three cups turn at once now and then; three lives, one
// back at round 11.
(function () {
  const G = {
    title: 'Shell Game',
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const ROUNDS = def.rounds || 20, T = def.table || [0, 1.25, 2.4], GAP = .8;
      const mat = (k, c, em, spec = .1) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(spec, spec, spec); if (em) m.emissiveColor = new B.Color3(...em); return m; });
      // the table: a round top on a post; three cups (open at the bottom); the mini ant
      const top = B.MeshBuilder.CreateCylinder('shellTable', { height: .08, diameter: 3.2, tessellation: 28 }, scene); top.position.set(T[0], T[1] - .04, T[2]); top.material = mat('table', [.4, .24, .12]); top.isPickable = false; ctx.add(top);
      const post = B.MeshBuilder.CreateCylinder('shellPost', { height: T[1] - .08, diameter: .3, tessellation: 10 }, scene); post.position.set(T[0], (T[1] - .08) / 2, T[2]); post.material = mat('table', [.4, .24, .12]); post.isPickable = false; ctx.add(post);
      const cloth = B.MeshBuilder.CreateCylinder('shellCloth', { height: .01, diameter: 2.9, tessellation: 28 }, scene); cloth.position.set(T[0], T[1] + .005, T[2]); cloth.material = mat('cloth', [.62, .1, .12], [.2, .03, .04]); cloth.isPickable = false; ctx.add(cloth);
      const cups = [0, 1, 2].map(i => {
        const c = B.MeshBuilder.CreateCylinder('shellCup', { height: .46, diameterTop: .22, diameterBottom: .5, tessellation: 18, cap: B.Mesh.CAP_START }, scene);
        c.material = mat('cup', [.95, .78, .42], [.32, .25, .12], .45); c.metadata = { shellCup: i }; ctx.add(c);
        return { mesh: c, slot: i, x: (i - 1) * GAP, lift: 0 };
      });
      const ant = new B.TransformNode('shellAnt', scene); ctx.add(ant);
      const antM = mat('ant', [.55, .08, .06], [.12, .02, .01], .4);
      [[0, .07, -.11, .1], [0, .08, 0, .075], [0, .09, .1, .085]].forEach(([x, y, z, r]) => { const s = B.MeshBuilder.CreateSphere('shellAntPart', { diameter: r * 2, segments: 8 }, scene); s.position.set(x, y, z); s.material = antM; s.parent = ant; s.isPickable = false; });
      for (const sd of [-1, 1]) { const a = B.MeshBuilder.CreateCylinder('shellAntenna', { height: .14, diameter: .012, tessellation: 4 }, scene); a.position.set(sd * .035, .2, .13); a.rotation.set(-.5, 0, sd * .4); a.material = antM; a.parent = ant; a.isPickable = false; }
      // ── state ──
      const st = { round: 0, score: 0, lives: def.lives || 3, phase: 'intro', wait: 1.4, under: 1, swaps: [], sw: null, t: 0, picked: -1, right: 0 };
      const info = () => H.info(`Round ${Math.min(st.round + 1, ROUNDS)} / ${ROUNDS} · ${'♥'.repeat(st.lives)}`);
      const place = () => { for (const c of cups) c.mesh.position.set(T[0] + c.x, T[1] + .23 + c.lift, T[2]); const u = cups[st.under]; ant.position.set(T[0] + u.x, T[1], T[2]); };
      function newRound() {
        st.under = Math.floor(Math.random() * 3); st.phase = 'show'; st.t = 0; info();
        const r = st.round, n = 3 + r, dur = Math.max(.17, .62 - r * .024);
        st.swaps = []; for (let k = 0; k < n; k++) { const a = Math.floor(Math.random() * 3); let b = Math.floor(Math.random() * 2); if (b >= a) b++;
          const q = Math.random(), kind = r >= 12 && q < .22 ? 'turn' : r >= 7 && q < .4 ? 'feint' : 'swap'; st.swaps.push({ a, b, dur: kind === 'swap' ? dur : dur * 1.25, kind }); }
        if (r === 10 && st.lives < (def.lives || 3)) { st.lives++; H.msg('Watch the ant', 1100, 'a life back'); } else H.msg('Watch the ant', 900);
      }
      function pick(i) {
        if (st.phase !== 'pick' || i < 0 || i > 2) return;
        const c = cups.find(c => Math.round(c.x / GAP) + 1 === i); if (!c) return;
        st.picked = cups.indexOf(c); st.phase = 'reveal'; st.t = 0;
        const ok = st.picked === st.under;
        if (ok) { st.right++; const pts = 10 + st.round * 2; st.score += pts; H.score(st.score); H.msg('Found it!', 900); ctx.sound('gamewin'); const p = ctx.screenOf(ctx.toWorld(T[0] + c.x, T[1] + .8, T[2])); H.pop(p.x, p.y, '+' + pts); }
        else { st.lives--; H.msg('Not there', 900); ctx.sound('thock'); }
        info();
      }
      // the Rebel at the table's side, the camera over the table
      ctx.player.place(1.7, T[2] - 1.5, Math.atan2(T[0] - 1.7, 1.5));
      const cam = def.cam || [-.6, 4.2, T[2] - 3.6], at = def.at || [T[0], T[1], T[2] + .2];
      ctx.look(cam, at, def.fov || .75);
      H.title(def.title || 'Shell Game'); H.score(0); info();
      H.hint('Keep your eye on the mini ant, then pick its cup: click it or press <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd>');
      H.msg(def.title || 'Shell Game', 1400, 'find the mini ant');
      place();
      const inst = {
        update(dt) {
          ctx.look(cam, at);
          st.t += dt;
          if (st.phase === 'intro' && (st.wait -= dt) <= 0) newRound();
          else if (st.phase === 'show') { // the cup over the ant lifts, then comes down
            const u = cups[st.under]; u.lift = Math.max(0, Math.sin(Math.min(1, st.t / 1.2) * Math.PI)) * .45;
            ant.setEnabled(true);
            if (st.t > 1.3) { u.lift = 0; st.phase = 'shuffle'; st.t = 0; st.sw = null; }
          } else if (st.phase === 'shuffle') {
            if (!st.sw) { st.sw = st.swaps.shift(); st.t = 0; if (st.sw) { st.sw.x0 = cups.map(c => c.x); } }
            if (!st.sw) { st.phase = 'pick'; H.msg('Which cup?', 800); }
            else {
              const sw = st.sw, k = Math.min(1, st.t / sw.dur), e = k * k * (3 - 2 * k), A = cups[sw.a], Bc = cups[sw.b], ax = sw.x0[sw.a], bx = sw.x0[sw.b];
              if (sw.kind === 'turn') { // all three round the table's middle a third of a turn: each cup to the next place
                cups.forEach((c, i) => { const from = sw.x0[i], to = sw.x0[i] >= GAP * .5 ? -GAP : from + GAP, ang = e * Math.PI; c.x = from + (to - from) * e; c.mesh.position.z = T[2] + Math.sin(ang) * .3 * (from > 0 ? -1 : 1); });
              } else {
                const f = sw.kind === 'feint' ? Math.sin(e * Math.PI) * .55 : e; // a feint goes most of the way and comes back
                A.x = ax + (bx - ax) * f; Bc.x = bx + (ax - bx) * f;
                A.mesh.position.z = T[2] + Math.sin(e * Math.PI) * .32; Bc.mesh.position.z = T[2] - Math.sin(e * Math.PI) * .32;
              }
              if (k >= 1) { if (sw.kind === 'turn') cups.forEach((c, i) => { const from = sw.x0[i]; c.x = from >= GAP * .5 ? -GAP : from + GAP; }); else if (sw.kind === 'feint') { A.x = ax; Bc.x = bx; } else { A.x = bx; Bc.x = ax; } st.sw = null; }
            }
            ant.setEnabled(false);
          } else if (st.phase === 'reveal') {
            const c = cups[st.picked], u = cups[st.under]; c.lift = Math.min(.45, st.t * 1.6); if (st.picked !== st.under && st.t > .5) u.lift = Math.min(.45, (st.t - .5) * 1.6);
            ant.setEnabled(true);
            if (st.t > 1.6) { cups.forEach(c => { c.lift = 0; }); st.round++;
              if (st.round >= ROUNDS || st.lives <= 0) { st.phase = 'done'; H.hint(''); if (st.score >= (def.pass || 0)) ctx.sound('gamewin');
                ctx.finish({ score: st.score, label: 'points', extra: `Found the mini ant ${st.right} of ${st.round} times.` }); }
              else { st.phase = 'pause'; st.wait = .5; } }
          } else if (st.phase === 'pause' && (st.wait -= dt) <= 0) newRound();
          if (st.phase !== 'shuffle') for (const c of cups) c.mesh.position.z = T[2];
          for (const c of cups) { c.mesh.position.x = T[0] + c.x; c.mesh.position.y = T[1] + .23 + c.lift; }
          const u = cups[st.under]; ant.position.set(T[0] + u.x, T[1], T[2]);
        },
        key(e, down) { if (!down || e.repeat) return; const n = parseInt(e.key, 10); if (n >= 1 && n <= 3) pick(n - 1); },
        pointer(evt) {
          if (evt.type !== B.PointerEventTypes.POINTERDOWN || st.phase !== 'pick') return;
          const hit = scene.pickWithRay(ctx.ray(), m => !!m.metadata && m.metadata.shellCup !== undefined);
          if (hit && hit.hit) { const c = cups[hit.pickedMesh.metadata.shellCup]; pick(Math.round(c.x / GAP) + 1); }
        },
        _test: { st, pick, cups, slotOfAnt: () => Math.round(cups[st.under].x / GAP) + 1 },
        dispose() {}
      };
      return inst;
    }
  };
  window.RebelGames.register('shells', G);
})();
