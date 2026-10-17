// Shuriken (Oct 15): the Ronin Shadow Dojo (room coordinates; the throwing line at the near edge of the sparring
// square). For 45 seconds paper targets marked with the red hand come out of the side walls, rise through the floor,
// drop from the roof on a rope or run along a line across the hall; click or tap one (or Space at the reticle) to throw
// a star. A hit is 10, near the middle 15, a moving or hanging target 5 more; hits in a row raise the multiplier
// (x2 from 3, x3 from 6). The blue targets with the Rebel emblem are friends: hitting one costs 15 and the streak.
// Oct 17 (Miguel: "we need an animation that throws the stars out"): with the games pack the Rebel throws each star
// (game_throw, its arm already whipping forward as the star leaves the hand: no wait on the throw); else punches.
(function () {
  const RS = { HX: 18, HY: 15, H: 9 };
  const T_R = .55;
  const G = {
    title: 'Shuriken', moves: true,
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const LINE = { x: 0, z: 6, ...(def.line || {}) }, DUR = def.seconds || 45;
      const rnd = (a, b) => a + Math.random() * (b - a);
      // ── the props: a paper target (the red hand, or the Rebel emblem for a friend) in a wooden ring; a steel star ──
      function paperTex(name, draw) {
        const t = new B.DynamicTexture(name, { width: 256, height: 256 }, scene, true); t.hasAlpha = true;
        const g = t.getContext(); g.clearRect(0, 0, 256, 256); draw(g, () => t.update()); t.update(); return t;
      }
      function emblem(g, src, tint, size, done) {
        const img = new Image(); img.crossOrigin = 'anonymous';
        img.onload = () => {
          const c = document.createElement('canvas'); c.width = c.height = size; const cg = c.getContext('2d');
          cg.drawImage(img, 0, 0, size, size);
          if (tint) { cg.globalCompositeOperation = 'source-in'; cg.fillStyle = tint; cg.fillRect(0, 0, size, size); }
          g.drawImage(c, 128 - size / 2, 128 - size / 2); done();
        };
        img.src = src;
      }
      const paper = (g, fill, ring) => { g.fillStyle = fill; g.beginPath(); g.arc(128, 128, 124, 0, Math.PI * 2); g.fill(); g.strokeStyle = ring; g.lineWidth = 7; for (const r of [118, 84, 48]) { g.beginPath(); g.arc(128, 128, r, 0, Math.PI * 2); g.stroke(); } };
      const foeMat = ctx.mat('foe', n => { const m = new B.StandardMaterial(n, scene); m.diffuseTexture = paperTex(n + 'Tex', (g, up) => { paper(g, '#efe4cc', 'rgba(60,30,20,.35)'); emblem(g, 'assets/brand/factions/ronin.png', '#a3161c', 150, up); }); m.useAlphaFromDiffuseTexture = true; m.emissiveColor = new B.Color3(.62, .55, .46); m.specularColor = new B.Color3(0, 0, 0); m.backFaceCulling = false; return m; });
      const friendMat = ctx.mat('friend', n => { const m = new B.StandardMaterial(n, scene); m.diffuseTexture = paperTex(n + 'Tex', (g, up) => { paper(g, '#cfe2f5', 'rgba(20,60,120,.45)'); emblem(g, 'assets/brand/icon-512.png', null, 150, up); }); m.useAlphaFromDiffuseTexture = true; m.emissiveColor = new B.Color3(.5, .56, .64); m.specularColor = new B.Color3(0, 0, 0); m.backFaceCulling = false; return m; });
      const woodMat = ctx.mat('wood', n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(.3, .18, .09); m.specularColor = new B.Color3(.05, .05, .05); return m; });
      const steelMat = ctx.mat('steel', n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(.55, .57, .62); m.specularColor = new B.Color3(.9, .9, .95); m.specularPower = 80; m.emissiveColor = new B.Color3(.12, .12, .14); m.backFaceCulling = false; return m; });
      const ropeMat = ctx.mat('rope', n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(.6, .5, .32); m.specularColor = new B.Color3(0, 0, 0); return m; });
      const base = (m) => { m.isPickable = false; m.isVisible = false; ctx.add(m); return m; }; // hidden sources: their copies draw together
      const discFoe = base(B.MeshBuilder.CreateDisc('shuriFoe', { radius: T_R, tessellation: 28 }, scene)); discFoe.material = foeMat;
      const discFriend = base(B.MeshBuilder.CreateDisc('shuriFriend', { radius: T_R, tessellation: 28 }, scene)); discFriend.material = friendMat;
      const ring = base(B.MeshBuilder.CreateTorus('shuriRing', { diameter: T_R * 2 + .06, thickness: .07, tessellation: 28 }, scene)); ring.rotation.x = Math.PI / 2; ring.bakeCurrentTransformIntoVertices(); ring.material = woodMat;
      const rope = base(B.MeshBuilder.CreateCylinder('shuriRope', { height: 1, diameter: .035, tessellation: 5 }, scene)); rope.material = ropeMat;
      const star = (() => {
        const pos = [0, 0, 0], idx = [];
        for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, r = k % 2 ? .055 : .17; pos.push(Math.cos(a) * r, Math.sin(a) * r, 0); }
        for (let k = 0; k < 8; k++) idx.push(0, 1 + k, 1 + (k + 1) % 8);
        const m = new B.Mesh('shuriStar', scene), vd = new B.VertexData(); vd.positions = pos; vd.indices = idx; const nrm = []; B.VertexData.ComputeNormals(pos, idx, nrm); vd.normals = nrm; vd.applyToMesh(m);
        m.material = steelMat; return base(m);
      })();
      // ── state ──
      const st = { t: 0, left: DUR, score: 0, streak: 0, hits: 0, throws: 0, friendsHit: 0, next: 1.2, targets: [], stars: [], flying: [], hand: 0, over: false, startIn: 2 };
      const mult = () => (st.streak >= 6 ? 3 : st.streak >= 3 ? 2 : 1);
      function hud() { H.score(st.score); H.info(`${Math.ceil(st.left)} s${mult() > 1 ? ' · x' + mult() : ''}`); }
      // a target: kind 'slide' (out of a side wall), 'rise' (through the floor), 'drop' (from the roof), 'run' (across)
      function spawn() {
        const lvl = Math.min(1, st.t / DUR), friend = Math.random() < (def.friends ?? .16);
        const kinds = ['slide', 'rise', 'rise', 'drop', ...(lvl > .35 ? ['run', 'slide'] : [])], kind = kinds[Math.floor(Math.random() * kinds.length)];
        const node = new B.TransformNode('shuriTarget', scene); ctx.add(node);
        const face = (friend ? discFriend : discFoe).createInstance('shuriFace'); face.parent = node; face.position.z = .01; face.rotation.y = Math.PI; // the paper faces the line (+z)
        const rim = ring.createInstance('shuriRim'); rim.parent = node;
        let a, b, y;
        if (kind === 'slide') { const s = Math.random() < .5 ? -1 : 1; y = rnd(1, 4.6); const z = rnd(-12.5, -2); a = new V3(s * (RS.HX - .7), y, z); b = new V3(s * rnd(9, 14), y, z); }
        else if (kind === 'rise') { const x = rnd(-11, 11), z = rnd(-12, -2.5); y = rnd(.9, 2.2); a = new V3(x, -T_R - .2, z); b = new V3(x, y, z); }
        else if (kind === 'drop') { const x = rnd(-12, 12), z = rnd(-12, -3.5); y = rnd(3, 5.6); a = new V3(x, RS.H + .8, z); b = new V3(x, y, z); }
        else { const s = Math.random() < .5 ? -1 : 1; y = rnd(2, 4.2); const z = rnd(-11, -4); a = new V3(s * 15, y, z); b = new V3(-s * 15, y, z); }
        let cord = null; if (kind === 'drop') { cord = rope.createInstance('shuriCord'); cord.parent = node; }
        const show = kind === 'run' ? 7 - 3 * lvl : rnd(1.6, 2.4) - .8 * lvl;
        const tg = { node, face, rim, cord, kind, friend, a, b, t: 0, show, inT: kind === 'run' ? 0 : .28, out: 0, hit: false, dead: false, moving: kind === 'run' || kind === 'drop' };
        node.position.copyFrom(a); st.targets.push(tg);
      }
      function placeTarget(tg, dt) {
        tg.t += dt;
        let p;
        if (tg.kind === 'run') { const u = Math.min(1, tg.t / tg.show); p = V3.Lerp(tg.a, tg.b, u); if (u >= 1) tg.dead = true; }
        else {
          const k = tg.hit ? 0 : tg.t < tg.inT ? tg.t / tg.inT : tg.t < tg.inT + tg.show ? 1 : Math.max(0, 1 - (tg.t - tg.inT - tg.show) / .25);
          const e = k * k * (3 - 2 * k); p = V3.Lerp(tg.a, tg.b, e);
          if (!tg.hit && tg.t > tg.inT + tg.show + .25) tg.dead = true;
          if (tg.kind === 'drop') p.x += Math.sin(tg.t * 2.2) * .25;
        }
        if (tg.hit) { tg.out += dt; tg.node.rotation.x = -Math.min(1, tg.out / .22) * Math.PI / 2; p = tg.node.position.clone(); p.y -= dt * 2.5 * tg.out; if (tg.out > .7) tg.dead = true; }
        tg.node.position.copyFrom(p);
        if (tg.cord) { const top = RS.H + .5, len = Math.max(.1, top - p.y - T_R); tg.cord.scaling.y = len; tg.cord.position.set(0, T_R + len / 2, 0); }
      }
      function removeTarget(tg) { tg.node.dispose(); }
      // the throw: from the hand that throws (the jab / cross moves alternate) to where the pointer points
      function throwAt(px, py) {
        if (st.over || st.startIn > 0) return;
        const ray = ctx.ray(px, py);
        // the first target the ray crosses (a disc facing the line), else the hall: far wall, floor, side walls, roof
        let best = null, bt = Infinity;
        const N = ctx.toWorld(0, 0, 1).subtract(ctx.toWorld(0, 0, 0)).normalize();
        for (const tg of st.targets) {
          if (tg.hit || tg.dead) continue;
          const C = tg.node.getAbsolutePosition(), dn = V3.Dot(ray.direction, N); if (Math.abs(dn) < 1e-4) continue;
          const t = V3.Dot(C.subtract(ray.origin), N) / dn; if (t <= 0 || t >= bt) continue;
          const P = ray.origin.add(ray.direction.scale(t)), d = V3.Distance(P, C);
          if (d <= T_R * 1.05) { best = { tg, P, d }; bt = t; }
        }
        let P = best ? best.P : null;
        if (!P) {
          const o = ctx.toLocal(ray.origin), dir = ctx.toLocal(ray.origin.add(ray.direction)).subtract(o);
          let tt = Infinity; const cand = [[-(RS.HY - .3), 'z'], [0.02, 'y'], [RS.H - .3, 'y'], [RS.HX - .3, 'x'], [-(RS.HX - .3), 'x']];
          for (const [v, ax] of cand) { const dv = dir[ax]; if (Math.abs(dv) < 1e-5) continue; const t = (v - o[ax]) / dv; if (t > .5 && t < tt) tt = t; }
          if (!Number.isFinite(tt)) tt = 20;
          P = ctx.toWorld(o.x + dir.x * tt, o.y + dir.y * tt, o.z + dir.z * tt);
        }
        st.hand ^= 1; st.throws++;
        const pack = !!ctx.player.has?.('game_throw'); if (pack) st.hand = 1; // the throw is right-handed
        if (pack) ctx.player.clip('game_throw', { from: .78, speed: 1.5 }); else ctx.player.clip(st.hand ? 'cross_punch' : 'jab', { speed: 1.6 });
        const from = ctx.player.bone(st.hand ? 'RightHand' : 'LeftHand') || ctx.toWorld(LINE.x + (st.hand ? .5 : -.5), 2.4, LINE.z - .6);
        const s = star.createInstance('shuriFly'); s.position.copyFrom(from);
        const dist = V3.Distance(from, P), dur = Math.max(.12, dist / 34);
        st.flying.push({ s, from, to: P, t: 0, dur, hit: best, spin: Math.random() * 6 });
        ctx.sound('whoosh');
      }
      function land(f) {
        const s = f.s, tg = f.hit && f.hit.tg;
        if (tg && !tg.hit && !tg.dead) {
          tg.hit = true; s.parent = tg.node; s.position.set((Math.random() - .5) * .3, (Math.random() - .5) * .3, .05);
          const sc = ctx.screenOf(f.to);
          if (tg.friend) { st.score = Math.max(0, st.score - 15); st.streak = 0; st.friendsHit++; H.pop(sc.x, sc.y, '-15', true); H.msg('A friend!', 900); ctx.sound('paper'); }
          else {
            const pts = (f.hit.d < T_R / 3 ? 15 : 10) + (tg.moving ? 5 : 0);
            st.streak++; st.hits++; const m = mult(); st.score += pts * m; H.pop(sc.x, sc.y, `+${pts * m}`); ctx.sound('thock');
            if (st.streak === 3 || st.streak === 6) H.msg(`x${mult()}`, 700, 'streak');
          }
        } else {
          // into the wood or the floor: it stays there a while
          st.streak = 0; st.stars.push(s); if (st.stars.length > 30) st.stars.shift().dispose(); ctx.sound('thock');
          return;
        }
        st.stars.push(s); if (st.stars.length > 30) st.stars.shift().dispose();
      }
      // the line, the camera over the right shoulder; the system cursor gives way to the reticle
      ctx.player.place(LINE.x, LINE.z, Math.PI);
      const canvas = ctx.engine.getRenderingCanvas(), cursor0 = canvas.style.cursor; canvas.style.cursor = 'none';
      const camP = [LINE.x + 1.25, 3.7, LINE.z + 3.4], camT = [LINE.x - .2, 2.6, -9];
      ctx.look(camP, camT, .9);
      H.title(def.title || 'Shuriken'); hud();
      H.hint('Aim with the mouse · <kbd>Click</kbd> or <kbd>Space</kbd> throws · red hands score, blue friends cost');
      H.msg('Shuriken', 1600, `${DUR} seconds`);
      let px = null, py = null;
      const inst = {
        update(dt) {
          ctx.look(camP, camT);
          if (st.startIn > 0) { st.startIn -= dt; if (st.startIn <= 0) { H.msg('Go!', 600); } return; }
          if (!st.over) {
            st.t += dt; st.left = Math.max(0, DUR - st.t);
            if ((st.next -= dt) <= 0) { spawn(); const lvl = Math.min(1, st.t / DUR); st.next = rnd(.75, 1.2) - .4 * lvl; }
            if (st.left <= 0) {
              st.over = true; H.reticle(null);
              setTimeout(() => {
                const acc = st.throws ? Math.round(100 * st.hits / st.throws) : 0;
                if (st.score >= (def.pass || 0)) ctx.sound('gamewin');
                ctx.finish({ score: st.score, label: 'points', extra: `${st.hits} hits from ${st.throws} stars (${acc} %)${st.friendsHit ? `, ${st.friendsHit} friend${st.friendsHit > 1 ? 's' : ''} hit` : ''}.` });
              }, 900);
            }
            hud();
          }
          for (const tg of st.targets) placeTarget(tg, dt);
          for (let i = st.targets.length - 1; i >= 0; i--) if (st.targets[i].dead) { removeTarget(st.targets[i]); st.targets.splice(i, 1); }
          for (let i = st.flying.length - 1; i >= 0; i--) {
            const f = st.flying[i]; f.t += dt; const u = Math.min(1, f.t / f.dur);
            const p = V3.Lerp(f.from, f.to, u); p.y += Math.sin(u * Math.PI) * .25 * f.dur; f.s.position.copyFrom(p);
            f.s.lookAt(f.to); f.spin += dt * 30; f.s.rotation.z = f.spin;
            if (u >= 1) { st.flying.splice(i, 1); land(f); }
          }
        },
        key(e, down) { if (down && !e.repeat && (e.key === ' ' || e.key.toLowerCase() === 'o')) throwAt(px ?? canvas.clientWidth / 2, py ?? canvas.clientHeight / 2); },
        pointer(evt) {
          const ev = evt.event;
          if (ev && ev.clientX != null && !st.over) H.reticle(ev.clientX, ev.clientY);
          px = ctx.scene.pointerX; py = ctx.scene.pointerY;
          if (evt.type === B.PointerEventTypes.POINTERDOWN) throwAt(px, py);
        },
        _test: { st, throwAt, spawn },
        dispose() { canvas.style.cursor = cursor0; st.targets.forEach(removeTarget); st.flying.forEach(f => f.s.dispose()); st.stars.forEach(s => s.dispose()); }
      };
      return inst;
    }
  };
  window.RebelGames.register('shuriken', G);
})();
