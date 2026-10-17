// Beer pong (Oct 15, the Chumpz Banana Bar, against Big Chain): six cups each end of the bar's pong table. Your turn is
// two balls: a ring sweeps across his rack (press: Space, a click or a tap to stop it), then along it (press again) and
// the ball arcs there. Inside a cup it sinks; on the rim it may roll in or bounce off. Sink both and the balls come back.
// Then Big Chain throws two at your cups. Clear his rack first to win.
// def: { table: [x, z] (world centre of the table), len: 4.8, top: 1.45 (over the deck), opponent: npcId, skill: .38, pass, points }
// Oct 17 (Miguel: "we need an animation of him throwing the ball"): with the games pack the Rebel throws for real
// (game_throw): the ball leaves the right hand on the throw's release, a third of a second after the press.
(function () {
  const G = {
    title: 'Beer Pong', moves: true,
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      // the frame: the spot at the near end, local +z down the table; the table's middle and top from the deck the Rebel stands on
      const deck = ctx.player.pos().y;
      const TW = def.table ? ctx.toLocal(new V3(def.table[0], 0, def.table[1])) : new V3(0, 0, 3.35);
      const TOP = deck + (def.top || 1.45), MID = TW.z, LEN = def.len || 4.8;
      const CUP = { r: .09, rb: .066, h: .22 }, BALL = .04, SKILL = def.skill ?? .38;
      const rack = (sd) => { const out = []; for (const [r, c] of [[0, -1], [0, 0], [0, 1], [1, -.5], [1, .5], [2, 0]]) out.push({ x: TW.x + c * .19, z: MID + sd * (LEN / 2 - .375 - r * .165) }); return out; };
      const mat = (k, c, em, spec = .1, a) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(spec, spec, spec); if (em) m.emissiveColor = new B.Color3(...em); if (a != null) m.alpha = a; return m; });
      const red = mat('cup', [.85, .1, .1], [.22, .02, .02], .3), inner = mat('cupIn', [.95, .95, .92], [.3, .3, .28]), beer = mat('beer', [.95, .66, .18], [.35, .22, .04], .5), white = mat('ball', [1, 1, .97], [.5, .5, .48], .4);
      const src = (m, mt) => { m.material = mt; m.isPickable = false; m.isVisible = false; ctx.add(m); return m; };
      const sCup = src(B.MeshBuilder.CreateCylinder('pongCup', { height: CUP.h, diameterTop: CUP.r * 2, diameterBottom: CUP.rb * 2, tessellation: 16, cap: B.Mesh.CAP_START }, scene), red);
      const sRim = src(B.MeshBuilder.CreateTorus('pongRim', { diameter: CUP.r * 2, thickness: .012, tessellation: 18 }, scene), inner);
      const sBeer = src(B.MeshBuilder.CreateDisc('pongBeer', { radius: CUP.r * .9, tessellation: 16 }, scene), beer);
      function makeCup(p, mine) {
        const n = new B.TransformNode('pongCupNode', scene); ctx.add(n); n.position.set(p.x, TOP, p.z);
        const c = sCup.createInstance('pc'); c.parent = n; c.position.y = CUP.h / 2;
        const r = sRim.createInstance('pr'); r.parent = n; r.position.y = CUP.h;
        const b = sBeer.createInstance('pb'); b.parent = n; b.position.y = CUP.h - .04; b.rotation.x = Math.PI / 2;
        [c, r, b].forEach(m => ctx.add(m));
        return { ...p, n, mine, up: true, t: 0 };
      }
      const mine = rack(-1).map(p => makeCup(p, true)), his = rack(1).map(p => makeCup(p, false));
      const ball = B.MeshBuilder.CreateSphere('pongBall', { diameter: BALL * 2, segments: 10 }, scene); ball.material = white; ball.isPickable = false; ctx.add(ball); ball.setEnabled(false);
      // the aiming ring on the table
      const ring = B.MeshBuilder.CreateTorus('pongAim', { diameter: .2, thickness: .018, tessellation: 24 }, scene); ring.isPickable = false; ctx.add(ring);
      ring.material = ctx.mat('aim', n => { const m = new B.StandardMaterial(n, scene); m.disableLighting = true; m.emissiveColor = new B.Color3(1, .85, .35); return m; });
      ring.setEnabled(false);
      // Big Chain at the far end (put back after)
      const npc = def.opponent ? ctx.npc(def.opponent) : null, npcWas = npc ? { p: npc.position.clone(), ry: npc.rotation.y, m: { spawn: npc.metadata?.spawn, home: npc.metadata?.home, wo: npc.metadata?.wanderOrigin, target: npc.metadata?.target } } : null;
      const oppAt = ctx.toWorld(TW.x, 0, MID + LEN / 2 + 1.1);
      const holdNpc = () => { if (!npc) return; npc.position.x = oppAt.x; npc.position.z = oppAt.z; const w = ctx.toWorld(TW.x, 0, MID); npc.rotation.y = Math.atan2(w.x - oppAt.x, w.z - oppAt.z); if (npc.metadata) { npc.metadata.target = null; npc.metadata.wanderOrigin = npc.position.clone(); npc.metadata.home = npc.position.clone(); } };
      const cheer = (k) => { const km = npc?.metadata?.kitModel; if (km) try { window.SamuraiKit?.actorAction?.(km, k); } catch (e) {} };
      // ── state ──
      const XR = .42, Z0 = MID + LEN / 2 - .375 - 2 * .165 - .2, Z1 = MID + LEN / 2 - .375 + .2;
      const st = { phase: 'intro', wait: 1.6, turn: 'me', balls: 2, hits: 0, sunk: 0, lost: 0, ax: 0, az: 0, u: 0, v: 1, f: null, opp: null, log: [] };
      const left = (arr) => arr.filter(c => c.up).length;
      const info = () => H.info(`Your cups ${left(mine)} · Big Chain's ${left(his)}${st.turn === 'me' && st.phase !== 'intro' ? ' · ball ' + (3 - st.balls) + ' / 2' : ''}`);
      function startMyTurn() { st.turn = 'me'; st.balls = 2; st.hits = 0; aim(); }
      function aim() { st.phase = 'aimX'; st.u = 0; st.v = 1; ring.setEnabled(true); info(); }
      function press() {
        if (st.phase === 'aimX') { st.ax = (st.u * 2 - 1) * XR; st.phase = 'aimZ'; st.u = 0; st.v = 1; return; }
        if (st.phase === 'aimZ') { st.az = Z0 + (Z1 - Z0) * st.u; throwBall(new V3(TW.x + st.ax, 0, st.az), true); }
      }
      // a ball from a hand to (x, z) on the cups' rim plane: a lob that peaks a little over a metre above the hand
      const PACK = !!ctx.player.has?.('game_throw'), REL = .3; // game_throw from .55 s: the ball leaves the hand .3 s on
      function throwBall(to, me) {
        if (me && PACK && !st.wound) { st.wound = true; ctx.player.clip('game_throw', { from: .55 }); st.phase = 'windup'; st.wind = REL; st.windTo = to; return; }
        st.wound = false;
        const hand = me && PACK ? ctx.player.bone('RightHand') : null, from = hand ? ctx.toLocal(hand) : me ? new V3(TW.x + .35, deck + 2.55, MID - LEN / 2 - .6) : new V3(TW.x - .3, deck + 2.6, MID + LEN / 2 + .7);
        const sc = me ? .028 : .02; to = to.add(new V3((Math.random() - .5) * 2 * sc, 0, (Math.random() - .5) * 2 * sc)); to.y = TOP + CUP.h;
        const g = 9.8, apex = Math.max(from.y, to.y) + 1.1, vy = Math.sqrt(2 * g * (apex - from.y)), tUp = vy / g, tDown = Math.sqrt(2 * (apex - to.y) / g), T = tUp + tDown;
        st.f = { p: from.clone(), v: new V3((to.x - from.x) / T, vy, (to.z - from.z) / T), me, done: false, t: 0, bounced: 0 };
        ball.position.copyFrom(from); ball.setEnabled(true); ring.setEnabled(false);
        if (me) { if (!PACK) ctx.player.clip('jab'); ctx.sound('whoosh'); } else cheer('kick');
        st.phase = 'flight';
      }
      function sink(c, me) {
        c.up = false; c.t = 0; ctx.sound('splash');
        const p = ctx.screenOf(ctx.toWorld(c.x, TOP + .5, c.z));
        if (me) { st.sunk++; st.hits++; H.pop(p.x, p.y, '+15'); H.msg(left(his) ? 'Sunk it!' : 'Rack cleared!', 800); H.score(score()); }
        else { st.lost++; H.msg('Big Chain sinks one', 900); cheer('jump'); }
        info();
      }
      const score = () => st.sunk * 15 + (left(his) === 0 ? 40 + 5 * left(mine) : 0);
      function step(dt) {
        const f = st.f; if (!f || f.done) return;
        const p0 = f.p.clone(); f.v.y -= 9.8 * dt; f.p.addInPlace(f.v.scale(dt)); f.t += dt; ball.position.copyFrom(f.p);
        const rimY = TOP + CUP.h, targets = f.me ? his : mine;
        if (f.v.y < 0 && p0.y >= rimY && f.p.y < rimY) { // crossing the rim plane: in a cup, on its rim, or past them to the table
          const k = (p0.y - rimY) / (p0.y - f.p.y), x = p0.x + (f.p.x - p0.x) * k, z = p0.z + (f.p.z - p0.z) * k;
          let best = null, bd = 9; for (const c of targets) if (c.up) { const d = Math.hypot(x - c.x, z - c.z); if (d < bd) { bd = d; best = c; } }
          if (best && bd <= CUP.r - BALL * .6) { f.done = true; sink(best, f.me); return end(true); }
          if (best && bd <= CUP.r + BALL && f.bounced < 2) { // the rim: it rolls in now and then, else it pops off sideways
            if (Math.random() < .35) { f.done = true; ctx.sound('thock'); sink(best, f.me); return end(true); }
            f.bounced++; ctx.sound('thock'); const out = new V3(x - best.x, 0, z - best.z).normalize(); f.p.y = rimY + .01; f.v.y = Math.abs(f.v.y) * .35; f.v.x = f.v.x * .3 + out.x * (.6 + Math.random() * .5); f.v.z = f.v.z * .3 + out.z * (.6 + Math.random() * .5);
          }
        }
        const onTable = Math.abs(f.p.x - TW.x) < .66 && Math.abs(f.p.z - MID) < LEN / 2;
        if (onTable && f.p.y < TOP + BALL && f.v.y < 0) { f.p.y = TOP + BALL; f.v.y = Math.abs(f.v.y) * .55; f.v.x *= .8; f.v.z *= .8; f.bounced++; ctx.sound('thock'); if (f.bounced > 3) { f.done = true; return end(false); } }
        if (f.p.y < deck - .2 || f.t > 4) { f.done = true; return end(false); }
      }
      function end(hit) {
        const f = st.f; st.phase = 'after'; st.wait = hit ? 1 : .8;
        if (!hit) H.msg(f.me ? (f.bounced ? 'Off the rim' : 'Miss') : 'Big Chain misses', 650);
        if (f.me) st.balls--;
      }
      function next() {
        ball.setEnabled(false);
        if (!left(his) || !left(mine)) { st.phase = 'end'; st.wait = 1.4; if (!left(his)) { ctx.sound('gamewin'); H.msg('You win!', 1600); } else { H.msg('Big Chain wins', 1600); cheer('jump'); } return; }
        if (st.turn === 'me') {
          if (st.balls > 0) return aim();
          if (st.hits >= 2) { H.msg('Balls back!', 1000); return startMyTurn(); }
          st.turn = 'him'; st.opp = 2; st.phase = 'oppWait'; st.wait = .9; ring.setEnabled(false); info(); return;
        }
        if (st.opp > 0) { st.phase = 'oppWait'; st.wait = .7; return; }
        startMyTurn();
      }
      function oppThrow() { // Big Chain picks a cup; good aim most of the time, a sink now and then
        st.opp--;
        const up = mine.filter(c => c.up), c = up[Math.floor(Math.random() * up.length)];
        const good = Math.random() < SKILL, a = Math.random() * Math.PI * 2, miss = good ? 0 : .1 + Math.random() * .16;
        throwBall(new V3(c.x + Math.cos(a) * miss, 0, c.z + Math.sin(a) * miss), false);
      }
      ctx.player.place(TW.x, MID - LEN / 2 - .95, 0); holdNpc();
      const cam = def.cam || [TW.x - 1.1, deck + 3.9, MID - LEN / 2 - 3.3], at = def.at || [TW.x, TOP, MID + .9];
      ctx.look(cam, at, def.fov || .8);
      H.title(def.title || 'Beer Pong'); H.score(0); info();
      H.hint('Press <kbd>Space</kbd> (or click / tap) to stop the ring across his rack, then again along it. Sink both balls and they come back.');
      H.msg(def.title || 'Beer Pong', 1600, 'against Big Chain');
      const inst = {
        update(dt) {
          ctx.look(cam, at); holdNpc();
          if (st.phase === 'intro' && (st.wait -= dt) <= 0) startMyTurn();
          else if (st.phase === 'aimX' || st.phase === 'aimZ') {
            st.u += st.v * dt * (st.phase === 'aimX' ? .75 : .6); if (st.u > 1) { st.u = 1; st.v = -1; } if (st.u < 0) { st.u = 0; st.v = 1; }
            const x = st.phase === 'aimX' ? (st.u * 2 - 1) * XR : st.ax, z = st.phase === 'aimX' ? (Z0 + Z1) / 2 : Z0 + (Z1 - Z0) * st.u;
            ring.position.set(TW.x + x, TOP + CUP.h + .01, z); ring.scaling.setAll(st.phase === 'aimX' ? 1.25 : 1);
          } else if (st.phase === 'windup') { if ((st.wind -= dt) <= 0) throwBall(st.windTo, true); }
          else if (st.phase === 'flight') { for (let i = 0; i < 4 && st.phase === 'flight'; i++) step(dt / 4); }
          else if (st.phase === 'after' && (st.wait -= dt) <= 0) next();
          else if (st.phase === 'oppWait' && (st.wait -= dt) <= 0) oppThrow();
          for (const c of [...mine, ...his]) if (!c.up && c.n.isEnabled()) { c.t += dt; c.n.position.y = TOP - c.t * .6; c.n.scaling.setAll(Math.max(.05, 1 - c.t * 1.6)); if (c.t > .6) c.n.setEnabled(false); }
          if (st.phase === 'end' && (st.wait -= dt) <= 0) {
            st.phase = 'done'; H.hint(''); ring.setEnabled(false);
            const won = !left(his);
            ctx.finish({ score: score(), label: 'points', passed: won && score() >= (def.pass || 0), extra: won ? `You beat Big Chain with ${left(mine)} of your cups standing.` : `Big Chain won. You sank ${st.sunk} of his six cups.` });
          }
        },
        key(e, down) { if (down && !e.repeat && (e.key === ' ' || e.key === 'Enter' || e.key.toLowerCase() === 'o')) press(); },
        pointer(evt) { if (evt.type === B.PointerEventTypes.POINTERDOWN) press(); },
        _test: { st, mine, his, press, throwAt: (c, err = 0) => throwBall(new V3(c.x + err, 0, c.z), true), TOP, MID },
        dispose() {
          if (npc && npcWas) { npc.position.copyFrom(npcWas.p); npc.rotation.y = npcWas.ry; if (npc.metadata) { npc.metadata.spawn = npcWas.m.spawn; npc.metadata.home = npcWas.m.home; npc.metadata.wanderOrigin = npcWas.m.wo; npc.metadata.target = npcWas.m.target; } }
        }
      };
      return inst;
    }
  };
  window.RebelGames.register('pong', G);
})();
