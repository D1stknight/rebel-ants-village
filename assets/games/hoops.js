// 3-Point Contest (Oct 15, the Saints court): five racks round the arc, five balls each, the last ball of a rack is the
// money ball (2 points). Sixty seconds. Hold Space (or press and hold) to rise into the jump shot and let go at the top:
// the meter's gold band is a make, its bright middle a swish; a little early or late rattles the rim, more is a brick.
// The Rebel moves on to the next rack by itself.
// Oct 17 (Miguel: "we need a basketball animation shooting"; the games pack has no jump shot yet): the jump starts
// part-way through its crouch, so the Rebel is at the top of it when the meter is in the gold, and the ball rides over
// the Rebel's head from the rack (picked up on the press) and leaves from there.
// def: { court: 'sl_court' (the layout piece), hoop: [x, y, z] (its local rim centre), racks: [[x, z] x5] (its local
// floor spots), seconds: 60, pass, points }
(function () {
  const G = {
    title: '3-Point Contest',
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const DUR = def.seconds || 60, BR = .16, RIM = .32;
      // the court: the nearest piece of its type; everything below in frame coordinates
      const here = ctx.toWorld(0, 0, 0);
      let court = null, bd = 1e9; for (const n of scene.transformNodes) { if (!n.isEnabled() || !(n.metadata?.type === (def.court || 'sl_court') || n.name.startsWith((def.court || 'sl_court') + 'RootClone_'))) continue; const a = n.getAbsolutePosition(), d = Math.hypot(a.x - here.x, a.z - here.z); if (d < bd) { bd = d; court = n; } }
      const CW = court ? court.computeWorldMatrix(true) : null;
      const fromCourt = (x, y, z) => ctx.toLocal(CW ? V3.TransformCoordinates(new V3(x, y, z), CW) : new V3(x, y, z));
      const HL = def.hoop || [14.1, 4.025, 0], hoop = fromCourt(...HL), floorY = fromCourt(0, .04, 0).y;
      // the backboard behind the rim (bank shots): its middle, the way it faces (to the court), across, its half sizes
      const bbC = fromCourt(HL[0] + Math.sign(HL[0]) * .45, HL[1] + .5, HL[2]), bbN = fromCourt(HL[0] - Math.sign(HL[0]) * .55, HL[1] + .5, HL[2]).subtract(bbC).normalize(), bbS = new V3(bbN.z, 0, -bbN.x);
      const racks = (def.racks || [[12.2, -5.9], [9.86, -5.06], [7.15, 0], [9.86, 5.06], [12.2, 5.9]]).map(([x, z]) => {
        const p = fromCourt(x, .04, z), dir = new V3(hoop.x - p.x, 0, hoop.z - p.z).normalize(), side = new V3(dir.z, 0, -dir.x);
        return { p, dir, side, yaw: Math.atan2(dir.x, dir.z) };
      });
      // the balls: orange with seams; the money ball purple and gold
      const ballTex = (n, base, line, stripes) => { const t = new B.DynamicTexture(n, { width: 128, height: 64 }, scene, true), g = t.getContext(); g.fillStyle = base; g.fillRect(0, 0, 128, 64);
        if (stripes) { g.fillStyle = stripes; for (let k = 0; k < 4; k++) g.fillRect(k * 32 + 8, 0, 14, 64); }
        g.strokeStyle = line; g.lineWidth = 3; for (const x of [0, 32, 64, 96]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 64); g.stroke(); } g.beginPath(); g.moveTo(0, 32); g.lineTo(128, 32); g.stroke(); t.update(); return t; };
      const mat = (k, make) => ctx.mat(k, make);
      const orange = mat('ball', n => { const m = new B.StandardMaterial(n, scene); m.diffuseTexture = ballTex(n + 'T', '#d9661c', '#2a160c'); m.emissiveColor = new B.Color3(.18, .08, .02); m.specularColor = new B.Color3(.1, .1, .1); return m; });
      const money = mat('money', n => { const m = new B.StandardMaterial(n, scene); m.diffuseTexture = ballTex(n + 'T', '#5b2a86', '#1a0c22', '#e2b445'); m.emissiveColor = new B.Color3(.12, .07, .14); m.specularColor = new B.Color3(.2, .2, .2); return m; });
      const rackMat = mat('rack', n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(.12, .12, .14); m.specularColor = new B.Color3(.3, .3, .3); return m; });
      const sBall = B.MeshBuilder.CreateSphere('hoopBall', { diameter: BR * 2, segments: 12 }, scene); sBall.material = orange; sBall.isVisible = false; sBall.isPickable = false; ctx.add(sBall);
      const sMoney = B.MeshBuilder.CreateSphere('hoopMoney', { diameter: BR * 2, segments: 12 }, scene); sMoney.material = money; sMoney.isVisible = false; sMoney.isPickable = false; ctx.add(sMoney);
      // a rack beside each spot: a stand with its five balls
      racks.forEach(r => {
        const at = r.p.add(r.side.scale(-.95));
        const stand = B.MeshBuilder.CreateBox('hoopRack', { width: .5, height: .9, depth: 1.7 }, scene); stand.material = rackMat; stand.isPickable = false; ctx.add(stand);
        stand.position.set(at.x, floorY + .45, at.z); stand.rotation.y = r.yaw;
        r.balls = [0, 1, 2, 3, 4].map(k => { const b = (k === 4 ? sMoney : sBall).createInstance('hoopRackBall'); b.parent = ctx.frame; ctx.add(b); const q = at.add(r.dir.scale(-.62 + k * .31)); b.position.set(q.x, floorY + .9 + BR, q.z); return b; });
      });
      // the rim lit for the contest, so it reads at night too
      const rimM = mat('rimGlow', n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(1, .45, .12); m.emissiveColor = new B.Color3(1, .42, .1); m.disableLighting = true; return m; });
      const rimRing = B.MeshBuilder.CreateTorus('hoopRimGlow', { diameter: RIM * 2 + .04, thickness: .035, tessellation: 32 }, scene); rimRing.material = rimM; rimRing.isPickable = false; ctx.add(rimRing); rimRing.position.copyFrom(hoop);
      // ── state ──
      const st = { phase: 'intro', wait: 1.6, left: DUR, rack: 0, ball: 0, score: 0, made: 0, hold: false, hv: 0, cool: 0, move: null, flights: [], money: 0 };
      const info = () => H.info(`Rack ${Math.min(st.rack + 1, 5)} / 5 · ball ${Math.min(st.ball + 1, 5)}${st.ball === 4 ? ' (money)' : ''} · ${Math.ceil(st.left)} s`);
      const R = () => racks[Math.min(st.rack, racks.length - 1)];
      function stand(r, t = 1) { const pos = r.p; ctx.player.place(pos.x, pos.z, r.yaw); }
      const camFor = r => ({ c: r.p.add(r.dir.scale(-4.4)).add(r.side.scale(1.5)).add(new V3(0, 3.3, 0)), a: new V3(hoop.x, hoop.y - .5, hoop.z) });
      let cam = camFor(racks[0]);
      // the ball in the Rebel's hands while it rises: up over the head (the head bone rises with the jump; clear of the hood
      // and antennae from the camera behind), else a point that rises with the meter; the jump starts .3 s in, so its top
      // (about .75 s on) comes with the meter's gold (.66-.77 s)
      let held = null;
      function grab() {
        const r = R(); held?.dispose(); held = (st.ball === 4 ? sMoney : sBall).createInstance('hoopHeld'); held.parent = ctx.frame; ctx.add(held);
        r.balls[st.ball]?.setEnabled(false); ctx.player.clip('jump', { from: .3 }); placeHeld();
      }
      function placeHeld() {
        if (!held) return; const r = R(), hd = ctx.player.bone?.('Head');
        const p = hd ? ctx.toLocal(hd).add(r.dir.scale(.3)).add(new V3(0, .62, 0)) : r.p.add(r.dir.scale(.3)).add(new V3(0, 2.6 + Math.min(1, st.hv) * .85, 0));
        p.y = Math.max(p.y, floorY + 2.5); held.position.copyFrom(p);
      }
      function release() {
        if (!st.hold) return; st.hold = false;
        const v = st.hv, d = Math.abs(v - .84), r = R(), isMoney = st.ball === 4;
        const q = d <= .025 ? 'swish' : d <= .065 ? 'in' : d <= .13 ? 'rim' : 'miss';
        // where it is heading: the rim's centre, off by how far the timing was out (long when late, short when early)
        const late = v > .84 ? 1 : -1, off = q === 'swish' ? 0 : q === 'in' ? .1 : q === 'rim' ? .34 : .62 + Math.random() * .3, lat = (Math.random() - .5) * (q === 'miss' ? .5 : .16);
        const tgt = new V3(hoop.x, hoop.y, hoop.z).add(r.dir.scale(late * off)).add(r.side.scale(lat));
        const from = held ? held.position.clone() : r.p.add(r.dir.scale(.3)).add(new V3(0, 3.15, 0)); held?.dispose(); held = null;
        const g = 9.8, apex = Math.max(from.y, tgt.y) + 1.7, vy = Math.sqrt(2 * g * (apex - from.y)), T = vy / g + Math.sqrt(2 * (apex - tgt.y) / g);
        const m = (isMoney ? sMoney : sBall).createInstance('hoopShot'); m.parent = ctx.frame; ctx.add(m); m.position.copyFrom(from);
        st.flights.push({ m, p: from.clone(), v: new V3((tgt.x - from.x) / T, vy, (tgt.z - from.z) / T), q, money: isMoney, t: 0, state: 'air', rimTries: 0 });
        r.balls[st.ball]?.setEnabled(false);
        st.ball++; st.cool = .3; H.meter({ label: 'Shot', value: 0, zone: [.78, .9] });
        if (st.ball >= 5) { st.ball = 0; st.rack++; if (st.rack < racks.length) { st.move = { from: r, to: racks[st.rack], t: 0 }; st.phase = 'move'; } else { st.phase = 'last'; st.wait = 2.2; } }
        info();
      }
      function score(f, how) {
        const pts = f.money ? 2 : 1; st.score += pts; st.made++; if (f.money) st.money++; H.score(st.score);
        const s = ctx.screenOf(ctx.toWorld(hoop.x, hoop.y + .6, hoop.z)); H.pop(s.x, s.y, '+' + pts);
        if (how === 'swish') { ctx.sound('swish'); if (f.money) H.msg('Money!', 600); } else { ctx.sound('clang'); ctx.sound('swish'); }
      }
      function fly(f, dt) {
        const p0 = f.p.clone(); f.v.y -= 9.8 * dt; f.p.addInPlace(f.v.scale(dt)); f.t += dt;
        if (f.state === 'air' && f.v.y < 0 && p0.y >= hoop.y && f.p.y < hoop.y) {
          const k = (p0.y - hoop.y) / (p0.y - f.p.y), x = p0.x + (f.p.x - p0.x) * k, z = p0.z + (f.p.z - p0.z) * k, d = Math.hypot(x - hoop.x, z - hoop.z);
          if (d <= RIM - BR + .02) { f.state = 'net'; score(f, d < .09 ? 'swish' : 'in'); f.v.x *= .2; f.v.z *= .2; f.v.y = -1.5; }
          else if (d <= RIM + BR) { // the rim: it rattles in half the time, else it kicks out
            ctx.sound('clang'); const out = new V3(x - hoop.x, 0, z - hoop.z).normalize();
            if (Math.random() < .5) { f.state = 'net'; f.p.set(hoop.x, hoop.y - .05, hoop.z); f.v.set(0, -1.2, 0); score(f, 'rim'); }
            else { f.state = 'out'; f.p.y = hoop.y + .02; f.v.set(out.x * (1.2 + Math.random()), 1.8 + Math.random(), out.z * (1.2 + Math.random())); }
          } else f.state = 'out';
        }
        { const rel = f.p.subtract(bbC), dn = V3.Dot(rel, bbN), vn = V3.Dot(f.v, bbN); // off the backboard
          if (dn < BR && dn > -.3 && vn < 0 && Math.abs(V3.Dot(rel, bbS)) < .95 && Math.abs(rel.y) < .6) { f.v.subtractInPlace(bbN.scale(vn * 1.55)); f.p.addInPlace(bbN.scale(BR - dn)); ctx.sound('bounce'); } }
        if (f.p.y < floorY + BR) { f.p.y = floorY + BR; if (f.v.y < -1) { f.v.y = -f.v.y * .55; f.v.x *= .7; f.v.z *= .7; if (f.state !== 'gone') ctx.sound('bounce'); } else f.v.y = 0; }
        f.m.position.copyFrom(f.p); f.m.rotation.x += dt * 6;
        return f.t < 3.2;
      }
      stand(racks[0]);
      ctx.look([cam.c.x, cam.c.y, cam.c.z], [cam.a.x, cam.a.y, cam.a.z], def.fov || .85);
      H.title(def.title || '3-Point Contest'); H.score(0); info();
      H.hint('Hold <kbd>Space</kbd> (or press and hold) to rise, let go in the gold. Five racks, the last ball of each is the money ball.');
      H.msg(def.title || '3-Point Contest', 1600, `${DUR} seconds`);
      const inst = {
        update(dt) {
          ctx.look([cam.c.x, cam.c.y, cam.c.z], [cam.a.x, cam.a.y, cam.a.z]);
          if (st.phase === 'intro' && (st.wait -= dt) <= 0) { st.phase = 'shoot'; info(); }
          if (st.phase === 'shoot' || st.phase === 'move') {
            st.left -= dt; if (st.left <= 0) { st.left = 0; st.hold = false; st.phase = 'last'; st.wait = 2.2; H.msg('Time!', 1000); H.meter(null); }
            if (st.cool > 0) st.cool -= dt;
          }
          if (held && !st.hold) { held.dispose(); held = null; } else placeHeld();
          if (st.phase === 'shoot' && st.hold) { st.hv += dt / .85; H.meter({ label: st.ball === 4 ? 'Money ball' : 'Shot', value: Math.min(1, st.hv), zone: [.78, .9] }); if (st.hv >= 1.05) release(); }
          if (st.phase === 'move') { const m = st.move; m.t += dt / .6; const u = Math.min(1, m.t), e = u * u * (3 - 2 * u), p = V3.Lerp(m.from.p, m.to.p, e); ctx.player.place(p.x, p.z, m.to.yaw); const a = camFor(m.from), b = camFor(m.to); cam = { c: V3.Lerp(a.c, b.c, e), a: b.a }; if (u >= 1) { st.phase = 'shoot'; stand(m.to); info(); } }
          for (let i = st.flights.length - 1; i >= 0; i--) { const f = st.flights[i]; let alive = true; for (let s = 0; s < 3 && alive; s++) alive = fly(f, dt / 3); if (!alive) { f.m.dispose(); st.flights.splice(i, 1); } }
          if (st.phase === 'shoot' || st.phase === 'move') info();
          if (st.phase === 'last' && (st.wait -= dt) <= 0 && !st.flights.some(f => f.state === 'air')) {
            st.phase = 'done'; H.hint(''); H.meter(null); if (st.score >= (def.pass || 0)) ctx.sound('gamewin');
            ctx.finish({ score: st.score, label: 'points', extra: `${st.made} of 25 in, ${st.money} money ball${st.money === 1 ? '' : 's'}.` });
          }
        },
        key(e, down) {
          const k = e.key.toLowerCase(); if (!(k === ' ' || k === 'enter' || k === 'o')) return;
          if (down && !e.repeat && st.phase === 'shoot' && !st.hold && st.cool <= 0) { st.hold = true; st.hv = 0; grab(); }
          else if (!down) release();
        },
        pointer(evt) {
          if (evt.type === B.PointerEventTypes.POINTERDOWN && st.phase === 'shoot' && !st.hold && st.cool <= 0) { st.hold = true; st.hv = 0; grab(); }
          else if (evt.type === B.PointerEventTypes.POINTERUP) release();
        },
        _test: { st, racks, hoop, shoot(v) { if (st.phase !== 'shoot' || st.hold) return false; st.hold = true; st.hv = v; release(); return true; } },
        dispose() { held?.dispose(); st.flights.forEach(f => { try { f.m.dispose(); } catch (e) {} }); }
      };
      return inst;
    }
  };
  window.RebelGames.register('hoops', G);
})();
