// The Siege Engine (Oct 15, Warrior): a trebuchet outside the gate and five straw siege towers out on the plain.
// A / D (or the arrows) turn it, W / S raise or lower the throw, hold Space to wind the counterweight and let go to
// throw (the power swings back down if you hold too long). The wind pushes every stone (the sock shows where it
// blows; it turns when a tower falls). The last stone's flight stays drawn in the air to aim the next. Ten stones;
// a tower is worth more the farther it stands, and stones left over count once all five are down.
// def: { stones: 10, towers: [[x, z]...] (frame coords, +z ahead), pass, points }
(function () {
  const G = {
    title: 'The Siege Engine',
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, H = ctx.HUD, U = ctx.util, scene = ctx.scene, def = ctx.def;
      const STONES = def.stones || 10, TOWERS = def.towers || [[-14, 46], [11, 60], [-24, 78], [18, 94], [-2, 116]];
      const frameY = ctx.frame.getAbsolutePosition().y;
      const groundAt = (x, z) => { const w = ctx.toWorld(x, 0, z), h = window._newTerrain?.heightAt?.(w.x, w.z); return Number.isFinite(h) ? h - frameY : 0; };
      const mat = (k, c, em, o = {}) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(.05, .05, .05); if (em) m.emissiveColor = new B.Color3(...em); if (o.flat) m.disableLighting = true; if (o.alpha != null) m.alpha = o.alpha; return m; });
      const woodM = mat('wood', [.42, .29, .16], [.07, .045, .025]), darkM = mat('woodDark', [.25, .17, .1], [.04, .03, .015]), ironM = mat('iron', [.25, .25, .27], [.04, .04, .045]);
      const strawM = mat('straw', [.82, .68, .36], [.16, .13, .06]), redM = mat('banner', [.72, .14, .1], [.25, .04, .03]), stoneM = mat('stone', [.55, .53, .5], [.1, .1, .09]);
      const traceM = mat('trace', [1, .85, .4], [1, .8, .3], { flat: true, alpha: .55 }), aimM = mat('aim', [1, .85, .35], [1, .8, .3], { flat: true, alpha: .35 }), sockM = mat('sock', [.95, .4, .15], [.4, .14, .05]);
      const nodes = [], keep = (n, parent) => { n.parent = parent || ctx.frame; ctx.add(n); nodes.push(n); if (n.isPickable !== undefined) n.isPickable = false; return n; };
      const box = (name, w, h, d, m, parent, x, y, z) => { const b = keep(B.MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene), parent); b.material = m; b.position.set(x, y, z); return b; };
      // the trebuchet: a base frame, two A-frames to the axle (4 m up), the throwing arm with its counterweight
      const tre = keep(new B.TransformNode('siegeTrebuchet', scene));
      box('siegeBeam', .32, .32, 5.4, woodM, tre, -1.05, .16, 0); box('siegeBeam', .32, .32, 5.4, woodM, tre, 1.05, .16, 0);
      box('siegeCross', 2.4, .3, .3, woodM, tre, 0, .16, 2.4); box('siegeCross', 2.4, .3, .3, woodM, tre, 0, .16, -2.4);
      for (const sx of [-1.05, 1.05]) for (const sz of [-1, 1]) { const u = box('siegeUpright', .24, 4.4, .24, woodM, tre, sx, 2.1, sz * .95); u.rotation.x = -sz * .24; }
      box('siegeAxle', 2.5, .18, .18, ironM, tre, 0, 4.05, 0);
      const arm = keep(new B.TransformNode('siegeArm', scene), tre); arm.position.set(0, 4.05, 0);
      box('siegeArmBeam', .26, .26, 8.4, darkM, arm, 0, 0, -1.9);
      box('siegeWeight', 1.3, 1.2, 1.1, ironM, arm, 0, -.55, 2.25);
      const REST = -.62, TOP = 2.15; arm.rotation.x = REST;
      const tipLocal = new V3(0, 0, -6.1);
      // a windsock on a pole beside it
      const pole = box('siegePole', .1, 5, .1, darkM, null, -3.2, 2.5, -1.2); const sock = keep(B.MeshBuilder.CreateCylinder('siegeSock', { height: 1.4, diameterTop: .18, diameterBottom: .5, tessellation: 10 }, scene)); sock.material = sockM; sock.position.set(-3.2, 4.8, -1.2);
      // the towers: straw over a frame, with a red banner, on a pivot at the base to fall over
      const towers = TOWERS.map(([x, z], k) => { const piv = keep(new B.TransformNode('siegeTower', scene)); const gy = groundAt(x, z); piv.position.set(x, gy, z);
        box('siegeStraw', 2.2, 6, 2.2, strawM, piv, 0, 3, 0); for (const cx of [-1.1, 1.1]) for (const cz of [-1.1, 1.1]) box('siegePost', .22, 6.6, .22, woodM, piv, cx, 3.3, cz);
        box('siegeTop', 2.6, .25, 2.6, woodM, piv, 0, 6.5, 0); const bn = box('siegeBanner', .05, 1.4, .9, redM, piv, -1.2, 5.1, 0);
        return { piv, x, z, gy, up: true, fall: null, dist: Math.hypot(x, z), pts: 20 + Math.round(Math.hypot(x, z) / 2) }; });
      const st = { phase: 'aim', yaw: 0, elev: 45, power: 0, charge: 0, held: { l: 0, r: 0, u: 0, d: 0 }, fire: false, stones: STONES, score: 0, down: 0, swing: null, stone: null, trace: [], traceN: [], wind: new V3(0, 0, 0), cam: 0, after: 0, follow: new V3(0, 6, 40), log: [] };
      const newWind = (mag) => { const a = Math.random() * Math.PI * 2, m = mag ?? (1 + Math.random() * 3.5); st.wind.set(Math.sin(a) * m, 0, Math.cos(a) * m); sock.rotation.set(Math.PI / 2, Math.atan2(st.wind.x, st.wind.z), 0); };
      newWind(1.5);
      const aimLine = keep(B.MeshBuilder.CreateGround('siegeAim', { width: .25, height: 18 }, scene)); aimLine.material = aimM;
      const stoneMesh = keep(B.MeshBuilder.CreateSphere('siegeStone', { diameter: .7, segments: 8 }, scene)); stoneMesh.material = stoneM; stoneMesh.setEnabled(false);
      const sTrace = keep(B.MeshBuilder.CreateSphere('siegeTraceDot', { diameter: .28, segments: 4 }, scene)); sTrace.material = traceM; sTrace.isVisible = false;
      ctx.player.place(2.8, -1.6, -.2);
      const windText = () => { const fwd = new V3(Math.sin(st.yaw * Math.PI / 180), 0, Math.cos(st.yaw * Math.PI / 180)), side = new V3(fwd.z, 0, -fwd.x); const head = V3.Dot(st.wind, fwd), cross = V3.Dot(st.wind, side);
        return `${Math.abs(cross) > .3 ? (cross > 0 ? '→' : '←') + ' ' + Math.abs(cross).toFixed(1) : ''}${Math.abs(head) > .3 ? ' ' + (head > 0 ? 'behind' : 'against') + ' ' + Math.abs(head).toFixed(1) : ''} m/s`.trim(); };
      const info = () => H.info(`Stones ${st.stones} · towers ${st.down} / ${towers.length} · angle ${Math.round(st.elev)}° · turn ${Math.round(Math.abs(st.yaw))}°${st.yaw > .5 ? ' right' : st.yaw < -.5 ? ' left' : ''} · wind ${windText() || 'still'}`);
      H.title(def.title || 'The Siege Engine'); H.score(0); info();
      H.hint('<kbd>A</kbd> <kbd>D</kbd> turn · <kbd>W</kbd> <kbd>S</kbd> angle · hold <kbd>Space</kbd> to wind, let go to throw. Watch the windsock.');
      H.msg('The Siege Engine', 1300, `${towers.length} towers, ${STONES} stones`);
      const look = (dt) => { const sp = st.stone && (st.phase === 'flight' || st.phase === 'after') ? st.stone.p : null; const f = sp ? new V3(sp.x, Math.min(9, sp.y * .35 + 1), sp.z) : new V3(Math.sin(st.yaw * Math.PI / 180) * 40, 4, Math.cos(st.yaw * Math.PI / 180) * 40 + 8);
        st.follow = V3.Lerp(st.follow, f, Math.min(1, dt * 3)); ctx.look([-Math.sin(st.yaw * Math.PI / 180) * 12 + 1.2, 10.5, -Math.cos(st.yaw * Math.PI / 180) * 12 - 2], [st.follow.x, st.follow.y, st.follow.z], def.fov || .9); };
      function release() {
        const p = U.pingPong(st.charge, .55); st.power = p; st.charge = 0; H.meter(null);
        st.phase = 'swing'; st.swing = { t: 0, released: false }; ctx.sound('thock'); st.stones--; info();
      }
      function launch() {
        const w = arm.getWorldMatrix(), tipW = V3.TransformCoordinates(tipLocal, w), tip = ctx.toLocal(tipW);
        const v0 = 20 + st.power * 22, e = st.elev * Math.PI / 180, y = st.yaw * Math.PI / 180;
        const v = new V3(Math.sin(y) * Math.cos(e) * v0, Math.sin(e) * v0, Math.cos(y) * Math.cos(e) * v0);
        st.stone = { p: tip, v, t: 0, last: 0 }; stoneMesh.position.copyFrom(tip); stoneMesh.setEnabled(true);
        st.traceN.forEach(n => n.dispose()); st.traceN = []; st.trace = [tip.clone()]; st.phase = 'flight';
      }
      function hitTower(t, from) { t.up = false; st.down++; st.score += t.pts; H.score(st.score); ctx.sound('splash'); ctx.note(330 + st.down * 60, 'bell');
        const d = new V3(t.x - from.x, 0, t.z - from.z).normalize(); t.fall = { t: 0, ax: d.z, az: -d.x }; H.msg('Down!', 900, `+${t.pts}`); st.log.push(Math.round(t.dist)); newWind(); }
      function land(p) {
        stoneMesh.setEnabled(false);
        st.trace.forEach((q, k) => { if (k % 2) return; const n = sTrace.createInstance('siegeTraceI'); n.parent = ctx.frame; ctx.add(n); n.position.copyFrom(q); st.traceN.push(n); });
        for (const t of towers) if (t.up && Math.hypot(p.x - t.x, p.z - t.z) < 3.8) { hitTower(t, new V3(0, 0, 0)); }
        ctx.sound('thock');
        st.phase = 'after'; st.after = 1.3;
      }
      function finishGame() {
        st.phase = 'done'; H.hint(''); H.meter(null);
        const all = st.down === towers.length, bonus = all ? st.stones * 15 : 0; st.score += bonus; H.score(st.score);
        ctx.finish({ score: st.score, label: 'points', passed: st.score >= (def.pass || 0), extra: `${st.down} of ${towers.length} towers down${all && st.stones ? `, ${st.stones} stone${st.stones > 1 ? 's' : ''} to spare (+${bonus})` : ''}.` });
      }
      return {
        update(dt) {
          look(dt);
          const hd = st.held;
          if (st.phase === 'aim' || st.phase === 'charge') {
            st.yaw = Math.max(-28, Math.min(28, st.yaw + (hd.r - hd.l) * 22 * dt)); st.elev = Math.max(22, Math.min(68, st.elev + (hd.u - hd.d) * 18 * dt));
            if (hd.r || hd.l || hd.u || hd.d) info();
            tre.rotation.y = st.yaw * Math.PI / 180; aimLine.rotation.y = tre.rotation.y; const y = tre.rotation.y; aimLine.position.set(Math.sin(y) * 12, .12 + groundAt(Math.sin(y) * 12, Math.cos(y) * 12), Math.cos(y) * 12);
          }
          if (st.phase === 'charge') { st.charge += dt; const p = U.pingPong(st.charge, .55); H.meter({ label: 'Power', fill: p, value: p }); arm.rotation.x = REST - p * .35; }
          if (st.phase === 'swing') { const s = st.swing; s.t += dt / .5; const u = Math.min(1, s.t); arm.rotation.x = REST - st.power * .35 + (TOP - REST + st.power * .35) * u * u;
            if (u >= .78 && !s.released) { s.released = true; launch(); } if (u >= 1 && st.phase === 'swing') st.phase = 'flight'; }
          if (st.phase !== 'swing' && st.phase !== 'charge' && arm.rotation.x !== REST) { arm.rotation.x += (REST - arm.rotation.x) * Math.min(1, dt * 2.2); if (Math.abs(arm.rotation.x - REST) < .01) arm.rotation.x = REST; }
          const s = st.stone;
          if (s && st.phase === 'flight') {
            for (let k = 0; k < 4; k++) { const h = dt / 4; s.v.y -= 9.8 * h; s.v.x += (st.wind.x - s.v.x) * .055 * h; s.v.z += (st.wind.z - s.v.z) * .055 * h; s.p.addInPlace(s.v.scale(h)); s.t += h;
              for (const t of towers) if (t.up && Math.hypot(s.p.x - t.x, s.p.z - t.z) < 1.9 && s.p.y > t.gy - .5 && s.p.y < t.gy + 6.8) { hitTower(t, s.p.subtract(s.v.normalizeToNew())); }
              const gy = groundAt(s.p.x, s.p.z); if (s.p.y <= gy || s.t > 14) { s.p.y = Math.max(gy, s.p.y); land(s.p); break; } }
            if (st.phase === 'flight') { stoneMesh.position.copyFrom(s.p); if (s.t - s.last > .06) { s.last = s.t; st.trace.push(s.p.clone()); } }
          }
          for (const t of towers) if (t.fall && t.fall.t < 1) { t.fall.t = Math.min(1, t.fall.t + dt / .9); const e = t.fall.t * t.fall.t; t.piv.rotation.x = t.fall.ax * e * 1.45; t.piv.rotation.z = t.fall.az * e * 1.45; }
          if (st.phase === 'after' && (st.after -= dt) <= 0) {
            if (st.down === towers.length || st.stones <= 0) finishGame(); else { st.phase = 'aim'; info(); }
          }
        },
        key(e, down) {
          const k = e.key.toLowerCase(), v = down ? 1 : 0;
          if (k === 'a' || k === 'arrowleft') st.held.l = v; else if (k === 'd' || k === 'arrowright') st.held.r = v; else if (k === 'w' || k === 'arrowup') st.held.u = v; else if (k === 's' || k === 'arrowdown') st.held.d = v;
          else if (k === ' ' || k === 'enter') { if (down && !e.repeat && st.phase === 'aim') { st.phase = 'charge'; st.charge = 0; } else if (!down && st.phase === 'charge') release(); }
        },
        pointer(evt) { const T = B.PointerEventTypes; if (evt.type === T.POINTERDOWN && st.phase === 'aim') { st.phase = 'charge'; st.charge = 0; } else if (evt.type === T.POINTERUP && st.phase === 'charge') release(); },
        _test: { st, towers, release, launch, groundAt, aimAt: (yaw, elev) => { st.yaw = yaw; st.elev = elev; tre.rotation.y = yaw * Math.PI / 180; }, charge: () => { st.phase = 'charge'; st.charge = 0; }, setCharge: c => { st.charge = c; }, newWind },
        dispose() { nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); st.traceN.forEach(n => { try { n.dispose(); } catch (e) {} }); }
      };
    }
  };
  window.RebelGames.register('siege', G);
})();
