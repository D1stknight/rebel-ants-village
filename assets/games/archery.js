// Archery (Oct 15): the Yabusame range outside the Samurai gate (a quest spot at the shooting line; local +z runs
// downrange). Ten arrows: the range's straw targets (layout pieces, or built here where there are none), from the
// fourth arrow a target sliding on a rail and some wind, from the eighth a small gold target high on a pole that counts
// double. Aim with the mouse; hold the button (or Space) to draw and let go to loose: a fuller draw flies faster and
// flatter, a draw held too long starts to shake. Arrows drop with distance and drift with the wind. Rings 10 / 7 / 5 / 3.
// A Forge Rebel holds a lent bow (Dawn's Light) and plays its own bow moves; others shoot from the shoulder.
(function () {
  const G = {
    title: 'Archery',
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, H = ctx.HUD, scene = ctx.scene, def = ctx.def, U = ctx.util;
      const SC = def.scale || 1.3, R = .62 * SC, GRAV = 9.8, ARROWS = def.arrows || 10;
      const rnd = (a, b) => a + Math.random() * (b - a);
      // ── targets: { node, centre(), normal(), r, mult, label } ──
      const targets = [];
      const faceOf = (node, r, mult, label, local = new V3(0, 1.25, -.1)) => ({ node, r, mult, label,
        centre: () => V3.TransformCoordinates(local, node.getWorldMatrix()),
        normal: () => V3.TransformNormal(new V3(0, 0, -1), node.getWorldMatrix()).normalize() });
      const layoutTargets = scene.transformNodes.filter(n => n.metadata?.type === 'ashi_target' || /^ashi_targetRootClone_/.test(n.name));
      for (const [x, z] of def.targets || [[-3.5, 16], [2.5, 24], [-1, 32]]) {
        const w = ctx.toWorld(x, 0, z);
        let node = layoutTargets.find(n => Math.hypot(n.getAbsolutePosition().x - w.x, n.getAbsolutePosition().z - w.z) < 1.6);
        if (!node) { node = ctx.kit('ashi_target'); node.position.set(x, 0, z); node.scaling.setAll(SC); }
        node.computeWorldMatrix(true);
        targets.push(faceOf(node, .62 * Math.abs(node.scaling.x), 1, 'straw'));
      }
      // the slider: a target on a sled along a rail
      const mv = { z: 21, amp: 5, speed: 2.4, ...(def.mover || {}) };
      const railMat = ctx.mat('rail', n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(.32, .2, .1); m.specularColor = new B.Color3(.05, .05, .05); return m; });
      const rail = B.MeshBuilder.CreateBox('archRail', { width: mv.amp * 2 + 2.4, height: .16, depth: .5 }, scene); rail.material = railMat; rail.position.set(0, .08, mv.z); rail.isPickable = false; ctx.add(rail);
      const slider = ctx.kit('ashi_target'); slider.position.set(0, .16, mv.z); slider.scaling.setAll(SC); slider.setEnabled(false);
      const sliderT = faceOf(slider, R, 1, 'moving'); sliderT.off = true; targets.push(sliderT);
      // the gold target: a small gold disc with a red heart on a tall pole
      const gd = { x: 3.5, z: 30, h: 4.4, ...(def.gold || {}) };
      const gold = new B.TransformNode('archGold', scene); ctx.add(gold); gold.position.set(gd.x, 0, gd.z);
      const goldMat = ctx.mat('gold', n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(.9, .68, .2); m.emissiveColor = new B.Color3(.35, .25, .06); m.specularColor = new B.Color3(1, .9, .5); m.backFaceCulling = false; return m; });
      const redMat = ctx.mat('red', n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(.75, .08, .06); m.emissiveColor = new B.Color3(.25, .02, .02); m.backFaceCulling = false; return m; });
      const pole = B.MeshBuilder.CreateCylinder('archPole', { height: gd.h, diameter: .14, tessellation: 8 }, scene); pole.material = railMat; pole.parent = gold; pole.position.y = gd.h / 2; pole.isPickable = false;
      const gdisc = B.MeshBuilder.CreateDisc('archGoldDisc', { radius: .42, tessellation: 24 }, scene); gdisc.material = goldMat; gdisc.parent = gold; gdisc.position.set(0, gd.h + .3, -.1); gdisc.isPickable = false;
      const gdot = B.MeshBuilder.CreateDisc('archGoldDot', { radius: .14, tessellation: 16 }, scene); gdot.material = redMat; gdot.parent = gold; gdot.position.set(0, gd.h + .3, -.12); gdot.isPickable = false;
      [pole, gdisc, gdot].forEach(m => ctx.add(m));
      gold.setEnabled(false);
      const goldT = faceOf(gold, .42, 2, 'gold', new V3(0, gd.h + .3, -.1)); goldT.off = true; targets.push(goldT);
      // ── arrows: one merged mesh (shaft, steel head, white fletching), copies fly and stick ──
      const arrowSrc = (() => {
        const L = 1.5;
        const shaft = B.MeshBuilder.CreateCylinder('aShaft', { height: L, diameter: .032, tessellation: 6 }, scene); shaft.rotation.x = Math.PI / 2; shaft.position.z = -L / 2;
        const head = B.MeshBuilder.CreateCylinder('aHead', { height: .16, diameterTop: 0, diameterBottom: .07, tessellation: 4 }, scene); head.rotation.x = Math.PI / 2; head.position.z = .08;
        const fl = [0, 1, 2].map(k => { const p = B.MeshBuilder.CreatePlane('aFl', { width: .07, height: .24 }, scene); p.rotation.set(Math.PI / 2, 0, k * Math.PI * 2 / 3); p.position.set(Math.sin(k * 2.094) * .035, Math.cos(k * 2.094) * .035, -L + .14); return p; });
        const wood = ctx.mat('shaft', n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(.42, .28, .14); m.specularColor = new B.Color3(.1, .1, .1); return m; });
        const steel = ctx.mat('head', n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(.62, .64, .7); m.specularColor = new B.Color3(.9, .9, .95); return m; });
        const feather = ctx.mat('feather', n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(.95, .93, .88); m.emissiveColor = new B.Color3(.25, .24, .22); m.backFaceCulling = false; return m; });
        shaft.material = wood; head.material = steel; fl.forEach(p => { p.material = feather; });
        const m = B.Mesh.MergeMeshes([shaft, head, ...fl], true, true, undefined, false, true); m.name = 'archArrow'; m.isPickable = false; m.isVisible = false; ctx.add(m); return m;
      })();
      // ── state ──
      const st = { n: 0, score: 0, hits: 0, phase: 'intro', t: 0, wait: 1.4, power: 0, holdT: 0, wind: 0, flying: [], stuck: [], aimX: null, aimY: null, wob: [0, 0], rings: [], bow: null, releaseAt: -1, shot: null };
      const canvas = ctx.engine.getRenderingCanvas();
      const camP = [.95, 3.55, -2.7], camT = [0, 2.2, 26];
      function hud() {
        H.score(st.score);
        const w = st.wind, wt = Math.abs(w) < .05 ? 'calm' : `${w < 0 ? '←' : '→'} ${Math.abs(w).toFixed(1)}`;
        H.info(`Arrow ${Math.min(st.n + 1, ARROWS)} / ${ARROWS} · wind ${wt}`);
      }
      function nextArrow() {
        if (st.n >= ARROWS) return finish();
        st.phase = 'ready'; st.power = 0; st.holdT = 0;
        st.wind = st.n >= 3 ? rnd(.6, 2.4) * (Math.random() < .5 ? -1 : 1) : 0;
        if (st.n === 3) { slider.setEnabled(true); sliderT.off = false; H.msg('A moving target', 1300, 'on the rail'); }
        if (st.n === 7) { gold.setEnabled(true); gold.position.y = -(gd.h + 1); goldT.off = false; H.msg('The gold target', 1400, 'double points'); }
        if (st.bow) ctx.player.clip('bow_idle', { loop: true }); else ctx.player.idle();
        hud();
        H.hint('Aim with the mouse · hold <kbd>Click</kbd> or <kbd>Space</kbd> to draw, let go to loose · aim a little high far away');
      }
      function startDraw() {
        if (st.phase !== 'ready') return;
        st.phase = 'draw'; st.power = 0; st.holdT = 0; st.drawT = 0;
        if (st.bow) { ctx.player.clip('bow_nock', { hold: true }); st.toAim = .45; }
      }
      // where the reticle points: the first target face the ray crosses, else the ground, else 70 m out
      function aimPoint() {
        const px = (st.aimX ?? canvas.clientWidth / 2) + st.wob[0], py = (st.aimY ?? canvas.clientHeight * .45) + st.wob[1];
        const ray = ctx.ray(px, py); let best = null, bt = Infinity;
        for (const tg of targets) { if (tg.off) continue; const C = tg.centre(), N = tg.normal(), dn = V3.Dot(ray.direction, N); if (Math.abs(dn) < 1e-4) continue;
          const t = V3.Dot(C.subtract(ray.origin), N) / dn; if (t > 0 && t < bt && V3.Distance(ray.origin.add(ray.direction.scale(t)), C) < tg.r * 1.6) { bt = t; best = ray.origin.add(ray.direction.scale(t)); } }
        if (best) return best;
        const o = ctx.toLocal(ray.origin), d = ctx.toLocal(ray.origin.add(ray.direction)).subtract(o);
        if (d.y < -1e-4) { const t = -o.y / d.y; if (t < 70) return ctx.toWorld(o.x + d.x * t, 0, o.z + d.z * t); }
        return ray.origin.add(ray.direction.scale(70));
      }
      function loose() {
        if (st.phase !== 'draw') return;
        if (st.power < .15) { st.phase = 'ready'; if (st.bow) ctx.player.clip('bow_idle', { loop: true }); return; }
        const P = aimPoint(), speed = 30 + 34 * st.power;
        st.shot = { P, speed }; st.phase = 'loose'; st.n++;
        if (st.bow) { ctx.player.clip('bow_shoot', { hold: true }); st.releaseAt = .4; } // the bow lets go on its own frame (onRelease)
        else fire(null);
        hud();
      }
      // the arrow leaves from the string (the lent bow's release point) or beside the shoulder, aimed at the aim point
      // raised by half the drop on the way (the rest is the archer's to judge)
      function fire(from) {
        const s = st.shot; if (!s) return; st.shot = null; st.releaseAt = -1;
        const o = from || ctx.toWorld(.55, 2.75, .9), d = V3.Distance(o, s.P), t = d / s.speed;
        const aim = s.P.add(new V3(0, .5 * .5 * GRAV * t * t, 0));
        const v = aim.subtract(o).normalize().scale(s.speed);
        const a = arrowSrc.createInstance('archArrowFly'); a.position.copyFrom(o); a.lookAt(o.add(v));
        st.flying.push({ a, v, t: 0 }); ctx.sound('whoosh');
        st.phase = 'flight'; st.t = 0;
      }
      function landed(hit) {
        st.phase = 'after'; st.wait = 1.1;
        if (st.bow) setTimeout(() => { if (st.phase === 'after' || st.phase === 'ready') ctx.player.clip('bow_idle', { loop: true }); }, 500);
        if (!hit) { H.msg('Miss', 700); return; }
        const q = hit.d / hit.tg.r, ring = q < .14 / .62 ? 10 : q < .3 / .62 ? 7 : q < .46 / .62 ? 5 : 3; // the painted rings
        const pts = ring * hit.tg.mult; st.score += pts; st.hits++; st.rings.push(ring);
        const sc = ctx.screenOf(hit.P); H.pop(sc.x, sc.y, `+${pts}`); ctx.sound('thock');
        if (ring === 10) { H.msg(hit.tg.mult > 1 ? 'Golden bullseye!' : 'Bullseye!', 1100); ctx.sound('gamewin'); }
        hud();
      }
      function finish() {
        st.phase = 'done'; H.hint('');
        const bulls = st.rings.filter(r => r === 10).length;
        setTimeout(() => ctx.finish({ score: st.score, label: 'points', extra: `${st.hits} of ${ARROWS} arrows on target${bulls ? `, ${bulls} bullseye${bulls > 1 ? 's' : ''}` : ''}.` }), 400);
      }
      // ── set up: the line, the lent bow (if this Rebel can hold one), the camera over the right shoulder ──
      ctx.player.place(0, 0, 0);
      H.title(def.title || 'Archery'); hud();
      H.msg(def.title || 'Archery', 1500, `${ARROWS} arrows`);
      canvas.style.cursor = 'none';
      ctx.player.weapon('bow').then(w => { if (!w || st.phase === 'done') return; st.bow = w; w.onRelease(p => { if (st.shot) fire(p); }); if (st.phase === 'ready' || st.phase === 'intro') ctx.player.clip('bow_idle', { loop: true }); });
      ctx.look(camP, camT, .85);
      const inst = {
        update(dt) {
          st.t += dt;
          // the camera: over the shoulder, closing in as the bow draws
          const fov = .85 - (st.phase === 'draw' ? .25 * st.power : 0);
          ctx.look(camP, camT, fov);
          if (st.phase === 'intro' && (st.wait -= dt) <= 0) nextArrow();
          if (st.phase === 'draw') {
            st.drawT += dt;
            if (st.bow && st.toAim > 0 && (st.toAim -= dt) <= 0) ctx.player.clip('bow_aim', { hold: true, speed: 1.6 });
            st.power = Math.min(1, st.power + dt / .9);
            if (st.power >= 1) st.holdT += dt;
            const k = Math.max(0, st.holdT - 1.8) * 9; st.wob = [Math.sin(st.t * 7.3) * k, Math.cos(st.t * 5.1) * k * .8];
            H.meter({ label: 'Draw', fill: st.power, value: st.power, zone: [.92, 1] });
          } else { st.wob = [0, 0]; if (st.phase !== 'draw') H.meter(null); }
          if (st.phase === 'loose' && st.releaseAt > 0 && (st.releaseAt -= dt) <= 0) fire(null); // the bow never let go: shoot anyway
          // the slider
          if (!sliderT.off) slider.position.x = Math.sin(st.t * mv.speed / mv.amp) * mv.amp;
          if (!goldT.off && gold.position.y < 0) gold.position.y = Math.min(0, gold.position.y + dt * 3);
          // arrows in the air: gravity, wind across the range, the first face or the ground they meet
          const side = ctx.toWorld(1, 0, 0).subtract(ctx.toWorld(0, 0, 0)).normalize();
          for (let i = st.flying.length - 1; i >= 0; i--) {
            const f = st.flying[i]; f.t += dt;
            const p0 = f.a.position.clone();
            f.v.y -= GRAV * dt; f.v.addInPlace(side.scale(st.wind * 1.6 * dt));
            const p1 = p0.add(f.v.scale(dt)); let hit = null;
            for (const tg of targets) {
              if (tg.off) continue; const C = tg.centre(), N = tg.normal(), seg = p1.subtract(p0), dn = V3.Dot(seg, N); if (Math.abs(dn) < 1e-6) continue;
              const u = V3.Dot(C.subtract(p0), N) / dn; if (u < 0 || u > 1) continue;
              const P = p0.add(seg.scale(u)), d = V3.Distance(P, C); if (d <= tg.r && (!hit || u < hit.u)) hit = { tg, P, d, u };
            }
            const l1 = ctx.toLocal(p1);
            if (hit) {
              f.a.position.copyFrom(hit.P.subtract(f.v.normalizeToNew().scale(.35))); f.a.lookAt(f.a.position.add(f.v));
              f.a.setParent(hit.tg.node); st.stuck.push(f.a); st.flying.splice(i, 1); landed(hit); continue;
            }
            if (l1.y <= .02 || f.t > 4) { if (l1.y <= .02) { f.a.position.copyFrom(p1); f.a.lookAt(p1.add(f.v)); st.stuck.push(f.a); } else f.a.dispose(); st.flying.splice(i, 1); landed(null); continue; }
            f.a.position.copyFrom(p1); f.a.lookAt(p1.add(f.v));
          }
          if (st.phase === 'after' && (st.wait -= dt) <= 0) nextArrow();
        },
        key(e, down) { const k = e.key.toLowerCase(); if (k === ' ' || k === 'o') { if (down && !e.repeat) startDraw(); else if (!down) loose(); } },
        pointer(evt) {
          const T = B.PointerEventTypes, ev = evt.event;
          if (ev && ev.clientX != null && st.phase !== 'done') H.reticle(ev.clientX, ev.clientY);
          st.aimX = scene.pointerX; st.aimY = scene.pointerY;
          if (evt.type === T.POINTERDOWN && (ev?.button ?? 0) === 0) startDraw();
          if (evt.type === T.POINTERUP) loose();
        },
        _test: { st, targets, startDraw, loose, fire, aimPoint },
        dispose() { canvas.style.cursor = ''; st.flying.forEach(f => f.a.dispose()); st.stuck.forEach(a => a.dispose()); }
      };
      return inst;
    }
  };
  window.RebelGames.register('archery', G);
})();
