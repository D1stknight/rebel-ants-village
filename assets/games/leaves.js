// Maple Catch (Oct 15, Sohei): the autumn maples are letting go. Carry the temple basket left and right (A / D, the
// arrows, or move the mouse) and catch the falling leaves: red ones 1, gold ones 3, the rare silver ginkgo 5. Spiny
// chestnut burrs fall too: one in the basket spills half of what you caught in that run of catches and costs a heart
// (three hearts). Gusts of wind push everything sideways (the streamers show which way); it all falls faster as time
// runs on. 45 seconds.
// def: { width: 11 (the lane, m), seconds: 45, pass, points }
(function () {
  const G = {
    title: 'Maple Catch',
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const WID = def.width || 11, SEC = def.seconds || 45, TOPY = 9, BASKY = 1.25, LANEZ = 2.2;
      const mat = (k, c, em, o = {}) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(.04, .04, .04); if (em) m.emissiveColor = new B.Color3(...em); if (o.flat) m.disableLighting = true; if (o.alpha != null) m.alpha = o.alpha; m.backFaceCulling = false; return m; });
      const KINDS = [
        { k: 'red', pts: 1, w: 10, c: [.82, .2, .08], em: [.35, .07, .02], size: .42 },
        { k: 'orange', pts: 1, w: 8, c: [.9, .48, .1], em: [.38, .18, .03], size: .4 },
        { k: 'gold', pts: 3, w: 3, c: [1, .78, .2], em: [.6, .42, .08], size: .44 },
        { k: 'ginkgo', pts: 5, w: .8, c: [.86, .9, .95], em: [.55, .6, .68], size: .4 },
        { k: 'burr', pts: 0, w: 2.2, c: [.35, .25, .12], em: [.08, .05, .02], size: .5, bad: true }
      ];
      KINDS.forEach(K => { K.m = mat('leaf_' + K.k, K.c, K.em); });
      const nodes = [], keep = (n, parent) => { n.parent = parent || ctx.frame; ctx.add(n); nodes.push(n); if (n.isPickable !== undefined) n.isPickable = false; return n; };
      // the leaf shape: a flat diamond with a notch (a maple-ish card); burrs are spiky balls
      const leafSrc = KINDS.map(K => { let m; if (K.bad) { m = B.MeshBuilder.CreateIcoSphere('leafBurr', { radius: K.size * .5, subdivisions: 1 }, scene); }
        else { m = B.MeshBuilder.CreateDisc('leafCard', { radius: K.size * .5, tessellation: K.k === 'ginkgo' ? 7 : 5 }, scene); }
        m.material = K.m; m.isVisible = false; m.isPickable = false; ctx.add(m); nodes.push(m); return m; });
      const wickerM = mat('wicker', [.62, .46, .25], [.14, .1, .05]), bandM = mat('band', [.55, .12, .08], [.18, .04, .02]), streamM = mat('streamer', [.92, .62, .18], [.4, .25, .05], { alpha: .9 });
      // the basket, held out in front of the Rebel (who stands behind the falling leaves, facing the camera)
      const basket = keep(new B.TransformNode('leafBasket', scene));
      { const b = B.MeshBuilder.CreateCylinder('leafBasketBody', { height: .5, diameterTop: 1.25, diameterBottom: .9, tessellation: 16 }, scene); b.material = wickerM; b.parent = basket; b.isPickable = false; ctx.add(b);
        const r = B.MeshBuilder.CreateTorus('leafBasketRim', { diameter: 1.25, thickness: .07, tessellation: 24 }, scene); r.material = bandM; r.parent = basket; r.position.y = .25; r.isPickable = false; ctx.add(r); }
      basket.position.set(0, BASKY, LANEZ);
      // streamers on two poles at the lane's ends show the wind
      const streamers = [-1, 1].map(s => { const p = keep(B.MeshBuilder.CreateCylinder('leafPole', { height: 4, diameter: .1, tessellation: 6 }, scene)); p.material = bandM; p.position.set(s * (WID / 2 + 1.2), 2, LANEZ + 1.5);
        const f = keep(B.MeshBuilder.CreatePlane('leafStreamer', { width: 1.6, height: .22 }, scene)); f.material = streamM; f.position.set(s * (WID / 2 + 1.2) + .8, 3.8, LANEZ + 1.5); return f; });
      const st = { phase: 'intro', wait: 1.4, t: 0, left: SEC, x: 0, vx: 0, keys: { l: 0, r: 0 }, mouse: null, falls: [], spawn: .4, score: 0, run: 0, caught: 0, hearts: 3, wind: 0, windT: 0, windTarget: 0, burrs: 0, best: 0 };
      const place = () => ctx.player.place(st.x, LANEZ + .95, Math.PI); // behind the basket, facing the camera
      place();
      ctx.look([0, 4.6, LANEZ - 10.5], [0, 3.6, LANEZ + 2], def.fov || .85);
      H.title(def.title || 'Maple Catch'); H.score(0);
      const info = () => H.info(`${Math.ceil(st.left)} s · ${'♥'.repeat(st.hearts)}${'♡'.repeat(3 - st.hearts)}${st.run > 2 ? ` · run ${st.run}` : ''}`);
      info(); H.msg('Maple Catch', 1300, 'catch the leaves, not the burrs');
      H.hint('<kbd>A</kbd> <kbd>D</kbd> (or the arrows, or the mouse) carry the basket. Red 1, gold 3, silver ginkgo 5; spiny burrs spill your catch.');
      function spawn() {
        const total = KINDS.reduce((a, K) => a + K.w * (K.bad ? 1 + (SEC - st.left) / SEC : 1), 0); let r = Math.random() * total, K = KINDS[0];
        for (const k of KINDS) { r -= k.w * (k.bad ? 1 + (SEC - st.left) / SEC : 1); if (r <= 0) { K = k; break; } }
        const m = leafSrc[KINDS.indexOf(K)].createInstance('leafFall'); m.parent = ctx.frame; ctx.add(m);
        const x = (Math.random() - .5) * WID; m.position.set(x, TOPY + Math.random(), LANEZ + (Math.random() - .5) * .5);
        st.falls.push({ m, K, x, y: m.position.y, vy: -(1.3 + Math.random() * .6 + (SEC - st.left) / SEC * 1.1) * (K.bad ? 1.5 : 1), ph: Math.random() * 6, sw: K.bad ? 0 : .5 + Math.random() * .7, spin: (Math.random() - .5) * 4 });
      }
      function catchIt(f) {
        const K = f.K;
        if (K.bad) { st.hearts--; st.burrs++; const lost = Math.floor(st.run * .5); st.score = Math.max(0, st.score - lost); st.run = 0; ctx.sound('thock'); H.msg('A burr!', 700, lost ? `-${lost}` : ''); if (st.hearts <= 0) { st.left = 0; } }
        else { st.score += K.pts; st.run += K.pts; st.caught++; st.best = Math.max(st.best, st.run); ctx.note(K.pts >= 5 ? 1320 : K.pts >= 3 ? 1046 : 784 + Math.random() * 60, 'bell'); if (K.pts >= 3) H.msg(K.k === 'ginkgo' ? 'Silver ginkgo!' : 'Gold!', 450, `+${K.pts}`); }
        H.score(st.score); info();
      }
      return {
        update(dt) {
          st.t += dt;
          if (st.phase === 'intro') { if ((st.wait -= dt) <= 0) st.phase = 'play'; return; }
          if (st.phase === 'end') { if ((st.wait -= dt) <= 0) { st.phase = 'done'; H.hint(''); ctx.finish({ score: st.score, label: 'leaves', passed: st.score >= (def.pass || 0), extra: `${st.caught} caught, best run ${st.best}${st.burrs ? `, ${st.burrs} burr${st.burrs > 1 ? 's' : ''} in the basket` : ''}.` }); } return; }
          if (st.phase !== 'play') return;
          st.left -= dt; if (st.left <= 0) { st.left = 0; st.phase = 'end'; st.wait = 1.6; H.msg(st.hearts > 0 ? 'Time' : 'Too many burrs', 1300, `${st.score} leaves`); ctx.player.idle(); info(); return; }
          // wind: a new gust every few seconds, stronger later
          st.windT -= dt; if (st.windT <= 0) { st.windT = 2.5 + Math.random() * 3; const k = .4 + (SEC - st.left) / SEC * 1.6; st.windTarget = (Math.random() - .5) * 2 * k * (Math.random() < .3 ? 0 : 1); }
          st.wind += (st.windTarget - st.wind) * Math.min(1, dt * 1.5);
          streamers.forEach(s => { s.rotation.y = st.wind >= 0 ? 0 : Math.PI; s.scaling.x = .4 + Math.min(1.4, Math.abs(st.wind)); s.rotation.x = Math.sin(st.t * 8) * .15; });
          // the basket: keys accelerate, the mouse leads it directly
          const ax = (st.keys.r - st.keys.l) * 40, MAXV = 8;
          if (st.mouse != null) { st.vx = Math.max(-MAXV, Math.min(MAXV, (st.mouse - st.x) * 9)); } else { st.vx += ax * dt; st.vx *= Math.pow(.02, dt); st.vx = Math.max(-MAXV, Math.min(MAXV, st.vx)); }
          st.x = Math.max(-WID / 2, Math.min(WID / 2, st.x + st.vx * dt)); basket.position.x = st.x; place();
          if (Math.abs(st.vx) > .8) { if (!st.walking) { ctx.player.clip('walk', { loop: true }); st.walking = true; } } else if (st.walking) { ctx.player.idle(); st.walking = false; }
          st.spawn -= dt; if (st.spawn <= 0) { spawn(); st.spawn = Math.max(.18, .55 - (SEC - st.left) / SEC * .3) * (.7 + Math.random() * .6); }
          for (let k = st.falls.length - 1; k >= 0; k--) { const f = st.falls[k];
            f.y += f.vy * dt; f.x += (st.wind * (f.K.bad ? .35 : 1) + Math.sin(st.t * 2.2 + f.ph) * f.sw) * dt; f.m.position.set(f.x, f.y, f.m.position.z); f.m.rotation.y += f.spin * dt; f.m.rotation.x = Math.PI / 2 + Math.sin(st.t * 3 + f.ph) * .7;
            if (f.y <= BASKY + .3 && f.y > BASKY - .15 && Math.abs(f.x - st.x) < .62) { catchIt(f); f.m.dispose(); st.falls.splice(k, 1); continue; }
            if (f.y < 0) { f.m.dispose(); st.falls.splice(k, 1); } }
          if (Math.floor(st.left * 4) !== Math.floor((st.left + dt) * 4)) info();
        },
        key(e, down) { const k = e.key.toLowerCase(), v = down ? 1 : 0; if (k === 'a' || k === 'arrowleft') { st.keys.l = v; st.mouse = null; } else if (k === 'd' || k === 'arrowright') { st.keys.r = v; st.mouse = null; } },
        pointer(evt) {
          const T = B.PointerEventTypes; if (evt.type !== T.POINTERMOVE && evt.type !== T.POINTERDOWN) return;
          const ray = ctx.ray(), o = ctx.toLocal(ray.origin), d = ctx.toLocal(ray.origin.add(ray.direction)).subtract(o); if (Math.abs(d.z) < 1e-4) return;
          const s = (LANEZ - o.z) / d.z; if (s > 0) st.mouse = Math.max(-WID / 2, Math.min(WID / 2, o.x + d.x * s));
        },
        _test: { st, spawn, KINDS, setX: x => { st.x = x; st.mouse = null; st.vx = 0; } },
        dispose() { st.falls.forEach(f => { try { f.m.dispose(); } catch (e) {} }); nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); }
      };
    }
  };
  window.RebelGames.register('leaves', G);
})();
