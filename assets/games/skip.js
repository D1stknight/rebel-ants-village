// Stone Skipping (Oct 15, Kenshi): five flat stones across the still lake. Stop the first mark for the angle (keep it
// low: the gold band) and the second for the power (hard: the gold band). A stone skips while it meets the water flat
// and fast; every skip slows it. Each throw scores its skips x 12 plus how far it went (m).
// Oct 17 (Miguel: "it needs the throwing animation and needs to be longer"): ten stones, a skip keeps more of the
// stone's speed (up to nine skips), and with the games pack the Rebel throws (game_throw): the stone rides the right
// hand through the wind-up and whips low off it onto the skipping line. Later on Oct 17 the low underhand throwing move
// (game_bowl) takes the overhand throw's place when the pack has it.
// def: { seaY (world height of the lake, -1.2), stones: 10, pass, points }
(function () {
  const G = {
    title: 'Stone Skipping', moves: true,
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, H = ctx.HUD, U = ctx.util, scene = ctx.scene, def = ctx.def;
      const STONES = def.stones || 10, frameY = ctx.frame.getAbsolutePosition().y, WY = (def.seaY ?? -1.2) - frameY + .02, HAND = .65;
      const mat = (k, c, em, o = {}) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(.2, .2, .2); if (em) m.emissiveColor = new B.Color3(...em); if (o.flat) m.disableLighting = true; if (o.alpha != null) m.alpha = o.alpha; return m; });
      const stoneM = mat('stone', [.5, .5, .52], [.09, .09, .1]), ringM = mat('ring', [.9, .96, 1], [.6, .7, .8], { flat: true, alpha: .7 }), markM = mat('mark', [1, .85, .35], [1, .78, .25], { flat: true, alpha: .8 });
      const nodes = [], keep = n => { n.parent = ctx.frame; ctx.add(n); nodes.push(n); if (n.isPickable !== undefined) n.isPickable = false; return n; };
      const stone = keep(B.MeshBuilder.CreateSphere('skipStone', { diameterX: .26, diameterY: .07, diameterZ: .2, segments: 8 }, scene)); stone.material = stoneM; stone.setEnabled(false);
      const best = keep(B.MeshBuilder.CreateTorus('skipBest', { diameter: .7, thickness: .05, tessellation: 20 }, scene)); best.material = markM; best.setEnabled(false);
      const rings = [], splash = (p, big) => { const r = keep(B.MeshBuilder.CreateTorus('skipRing', { diameter: .45, thickness: .04, tessellation: 24 }, scene)); r.material = ringM.clone('skipRingM' + rings.length); ctx.add(r.material); r.position.set(p.x, WY + .01, p.z); rings.push({ r, t: 0, big }); };
      const st = { phase: 'intro', wait: 1.2, t: 0, n: 0, a: 0, v: 0, log: [], score: 0, s: null, best: 0, follow: new V3(0, 0, 14) };
      ctx.player.place(0, 0, 0);
      const look = (dt) => { const tgt = st.s ? new V3(st.s.p.x * .6, WY + .5, Math.max(10, st.s.p.z * .75 + 4)) : new V3(0, WY + .5, 12); st.follow = V3.Lerp(st.follow, tgt, Math.min(1, dt * 2.5)); ctx.look([2.3, 3.2, -4.4], [st.follow.x, st.follow.y, st.follow.z], def.fov || .85); };
      look(1);
      H.title(def.title || 'Stone Skipping'); H.score(0);
      const info = () => H.info(`Stone ${Math.min(STONES, st.n + 1)} / ${STONES}${st.log.length ? ' · ' + st.log.map(l => l.skips).join(', ') + ' skips' : ''}`);
      info(); H.msg('Stone Skipping', 1200, `${STONES} stones`);
      const hint = p => H.hint(p === 'angle' ? '<kbd>Space</kbd> or click: stop the mark for the angle (low is good: the gold band)' : p === 'power' ? '<kbd>Space</kbd> or click again: the power (the gold band is a hard throw)' : '');
      function ready() { st.phase = 'angle'; st.t = Math.random() * 1.5; hint('angle'); }
      // with the games pack: the throwing move (game_bowl: the low underhand swing, Oct 17, Miguel: "we can also use this
      // for stone skipping") from .5 s lets go .53 s after the press, as the hand sweeps forward fastest; a pack without it
      // throws overhand (game_throw from .55 s, letting go .3 s after the press)
      const LOW = !!ctx.player.has?.('game_bowl'), PACK = LOW || !!ctx.player.has?.('game_throw'), REL = LOW ? .53 : .3, MOVE = LOW ? ['game_bowl', .5] : ['game_throw', .55];
      const inHand = () => { const h = ctx.player.bone('RightHand'); return h ? ctx.toLocal(h) : null; };
      function press() {
        if (st.phase === 'angle') { st.a = U.pingPong(st.t, .8); st.phase = 'power'; st.t = Math.random() * 1.5; hint('power'); return; }
        if (st.phase === 'power') { st.v = U.pingPong(st.t, 1.05); H.meter(null); hint('');
          if (PACK) { st.phase = 'windup'; st.wind = REL; ctx.player.clip(MOVE[0], { from: MOVE[1] }); const h = inHand(); if (h) { stone.position.copyFrom(h); stone.setEnabled(true); } }
          else throwIt(); }
      }
      function throwIt() {
        const ang = (-4 + 28 * st.a) * Math.PI / 180, spd = 9 + 15 * st.v, side = (Math.random() - .5) * .08, hand = PACK ? inHand() : null;
        // the flight is worked out from a low sidearm release (HAND high) whatever the hand's height: from the hand it
        // whips down onto that line in its first .14 s
        st.s = { p: new V3(.45, HAND, .5), v: new V3(Math.sin(side) * spd * Math.cos(ang), Math.sin(ang) * spd, Math.cos(side) * spd * Math.cos(ang)), skips: 0, t: 0, far: 0, from: hand };
        stone.position.copyFrom(hand || st.s.p); stone.setEnabled(true); st.phase = 'fly'; if (!PACK) ctx.player.clip('cross_punch'); ctx.sound('whoosh');
      }
      function endThrow() { // the distance only counts for a stone that skipped
        const s = st.s, d = s.skips ? Math.round(Math.max(0, s.far)) : 0, pts = s.skips * 12 + d; st.log.push({ skips: s.skips, d, pts }); st.score += pts; st.n++; H.score(st.score); info();
        H.msg(s.skips ? `${s.skips} skip${s.skips > 1 ? 's' : ''}` : 'Plunk', 1300, `${d} m · +${pts}`); ctx.sound(s.skips >= 6 ? 'gamewin' : 'splash');
        if (s.skips > st.best) { st.best = s.skips; best.position.set(s.p.x, WY + .02, s.p.z); best.setEnabled(true); }
        stone.setEnabled(false); st.phase = 'after'; st.wait = 1.6;
      }
      return {
        update(dt) {
          look(dt); st.t += dt;
          for (let k = rings.length - 1; k >= 0; k--) { const r = rings[k]; r.t += dt; const sc = 1 + r.t * (r.big ? 6 : 3.4); r.r.scaling.set(sc, 1, sc); r.r.material.alpha = Math.max(0, .7 - r.t * .7); if (r.t > 1) { r.r.dispose(); rings.splice(k, 1); } }
          if (st.phase === 'intro' && (st.wait -= dt) <= 0) ready();
          if (st.phase === 'angle') { const u = U.pingPong(st.t, .8); H.meter({ label: 'Angle', fill: u, value: u, zone: [.14, .43] }); }
          if (st.phase === 'power') { const u = U.pingPong(st.t, 1.05); H.meter({ label: 'Power', fill: u, value: u, zone: [.78, 1] }); }
          if (st.phase === 'windup') { const h = inHand(); if (h) stone.position.copyFrom(h); if ((st.wind -= dt) <= 0) throwIt(); }
          const s = st.s;
          if (s && st.phase === 'fly') {
            for (let k = 0; k < 4; k++) { const h = dt / 4; s.v.y -= 9.8 * h; s.p.addInPlace(s.v.scale(h)); s.t += h;
              if (s.p.y <= WY && s.v.y < 0) {
                const vh = Math.hypot(s.v.x, s.v.z), inc = Math.atan2(-s.v.y, vh) * 180 / Math.PI + (Math.random() - .5) * 3;
                if (inc < 18 && vh > 4) { s.skips++; s.p.y = WY; s.v.y = -s.v.y * .6; s.v.x *= .8; s.v.z *= .8; splash(s.p); ctx.note(700 + s.skips * 60, 'pluck'); s.far = Math.max(s.far, s.p.z); }
                else { s.p.y = WY; s.far = Math.max(s.far, s.p.z); splash(s.p, true); endThrow(); break; }
              }
              if (s.t > 12) { endThrow(); break; } }
            if (st.phase === 'fly') { const k = s.from ? Math.min(1, s.t / .14) : 1; stone.position.copyFrom(k < 1 ? V3.Lerp(s.from, s.p, k * k * (3 - 2 * k)) : s.p); stone.rotation.y += dt * 24; }
          }
          if (st.phase === 'after' && (st.wait -= dt) <= 0) {
            st.s = null;
            if (st.n >= STONES) { st.phase = 'done'; H.hint('');
              ctx.finish({ score: st.score, label: 'points', passed: st.score >= (def.pass || 0), extra: `Skips: ${st.log.map(l => l.skips).join(', ')} · best ${st.best}, farthest ${Math.max(...st.log.map(l => l.d))} m.` }); }
            else ready();
          }
        },
        key(e, down) { if (down && !e.repeat && (e.key === ' ' || e.key === 'Enter')) press(); },
        pointer(evt) { if (evt.type === B.PointerEventTypes.POINTERDOWN) press(); },
        _test: { st, press, throwWith: (a, v) => { st.a = a; st.v = v; H.meter(null); throwIt(); } },
        dispose() { nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); rings.forEach(r => { try { r.r.dispose(); } catch (e) {} }); }
      };
    }
  };
  window.RebelGames.register('skip', G);
})();
