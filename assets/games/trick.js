// Trick or Treat Night (Oct 16, Cute & Creepy): a roam game. Knock on every door of the village before the moon sets
// (a jack-o'-lantern burns on each step; walk up and press Space). Most doors give treats (candy points; the manor's
// bowl and the witch's brew give more), some play tricks: a ghost bursts out and the moon slips lower, a trickster
// grabs a handful of candy and runs off, a spider drops and you freeze. Which door does what is new every night; the
// crypt always plays one. Knock on them all for a bonus of 50 and the seconds left.
// def: { doors: [[x, z, yaw, name, kind?], ...] (world: where to stand to knock and the way to face the door;
//   kind 'manor' | 'witch' | 'crypt'), seconds: 120, pass, text }
(function () {
  const G = {
    title: 'Trick or Treat Night', roam: true,
    start(ctx) {
      const B = ctx.B, H = ctx.HUD, scene = ctx.scene, def = ctx.def, V3 = B.Vector3;
      const DUR = def.seconds || 120, KNOCK = 2.6;
      const nodes = [], keep = n => { ctx.add(n); n.parent = null; nodes.push(n); if (n.isPickable !== undefined) n.isPickable = false; return n; };
      const std = (k, c, em, o = {}) => ctx.mat('tt_' + k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(.05, .05, .05); if (em) m.emissiveColor = new B.Color3(...em); if (o.alpha != null) m.alpha = o.alpha; if (o.add) { m.disableLighting = true; m.alphaMode = B.Engine.ALPHA_ADD; m.backFaceCulling = false; } return m; });
      const ringM = std('ring', [0, 0, 0], [1, .55, .12], { alpha: .55, add: true }), beamM = std('beam', [0, 0, 0], [1, .55, .15], { alpha: .22, add: true });
      const CANDY = [std('c1', [1, .3, .4], [.5, .1, .15]), std('c2', [.4, .9, .45], [.15, .4, .15]), std('c3', [1, .85, .2], [.5, .4, .05]), std('c4', [.6, .4, 1], [.25, .15, .5])];
      const web = std('web', [.06, .06, .07], [.02, .02, .02]), thread = std('thread', [.9, .9, .9], [.4, .4, .4]);
      // tonight's doors: who treats, who tricks (the crypt always tricks; about a third of the rest do)
      const doors = (def.doors || []).map((d, i) => ({ i, x: +d[0], z: +d[1], yaw: +d[2] || 0, name: d[3] || 'a door', kind: d[4] || '', done: false }));
      const others = doors.filter(d => d.kind !== 'crypt').sort(() => Math.random() - .5), nTrick = Math.round(others.length * .33);
      others.forEach((d, k) => { d.trick = k < nTrick && d.kind !== 'manor'; });
      doors.forEach(d => { if (d.kind === 'crypt') d.trick = true; d.y = ctx.ground(d.x, d.z); });
      const TRICKS = ['ghost', 'thief', 'spider'];
      // a jack-o'-lantern on each step (lit until knocked on), a soft ring where to stand
      for (const d of doors) {
        const fx = d.x + Math.sin(d.yaw) * .9 + Math.cos(d.yaw) * 1.1, fz = d.z + Math.cos(d.yaw) * .9 - Math.sin(d.yaw) * 1.1, gy = ctx.ground(fx, fz);
        d.jack = keep(ctx.kit('cc_jack_lit')); d.jack.position.set(fx, gy, fz); d.jack.rotation.y = d.yaw + Math.PI; d.jack.scaling.setAll(1.3);
        d.ring = keep(B.MeshBuilder.CreateTorus('ttRing', { diameter: 2.2, thickness: .1, tessellation: 36 }, scene)); d.ring.material = ringM; d.ring.position.set(d.x, d.y + .1, d.z);
      }
      const beam = keep(B.MeshBuilder.CreateCylinder('ttBeam', { height: 9, diameterTop: .3, diameterBottom: .9, tessellation: 14, cap: B.Mesh.NO_CAP }, scene)); beam.material = beamM;
      const st = { phase: 'count', t: 3.4, said: '', left: DUR, candy: 0, treats: 0, tricks: 0, knocked: 0, act: null, fx: [], frozen: 0 };
      const near = () => { const p = ctx.player.world(); let best = null, bd = Infinity; for (const d of doors) if (!d.done) { const dd = Math.hypot(d.x - p.x, d.z - p.z); if (dd < bd) { bd = dd; best = d; } } return { d: best, dist: bd }; };
      const hud = () => { H.score(String(st.candy)); H.info(`${st.knocked} / ${doors.length} doors · moon sets in ${Math.max(0, Math.ceil(st.left))} s`); H.meter({ label: 'Moon', value: Math.max(0, st.left / DUR), fill: Math.max(0, st.left / DUR) }); };
      const popAt = (x, y, z, text) => { const sp = ctx.screenOf(new V3(x, y, z)); if (!sp.behind) H.pop(sp.x, sp.y, text); };
      function knock() {
        if (st.phase !== 'run' || st.act || st.frozen > 0) return;
        const { d, dist } = near(); if (!d || dist > KNOCK) { H.msg('Find a door with a lit pumpkin', 900); return; }
        st.act = { d, t: 0, step: 0 }; ctx.player.hold(true); ctx.player.placeWorld(ctx.player.world().x, ctx.player.world().z, d.yaw);
        ctx.player.clip('jab'); ctx.sound('thock');
      }
      // what the door does
      function answer(d) {
        d.done = true; st.knocked++; d.ring.setEnabled(false);
        const j = d.jack; const dark = keep(ctx.kit('cc_jack_dark')); dark.position.copyFrom(j.position); dark.rotation.y = j.rotation.y; dark.scaling.copyFrom(j.scaling); j.setEnabled(false);
        const dx = Math.sin(d.yaw), dz = Math.cos(d.yaw), door = new V3(d.x + dx * 1.6, d.y + 1.6, d.z + dz * 1.6);
        if (!d.trick) {
          const n = d.kind === 'manor' ? 50 : d.kind === 'witch' ? 30 : 10 * (1 + Math.floor(Math.random() * 3));
          st.candy += n; st.treats++; ctx.sound('wish');
          H.msg(d.kind === 'manor' ? "The Coven's bowl!" : d.kind === 'witch' ? 'A bottled brew!' : 'Treat!', 900, `${d.name} · +${n}`);
          for (let k = 0; k < 7; k++) { const c = keep(B.MeshBuilder.CreateSphere('ttCandy', { diameter: .22, segments: 6 }, scene)); c.material = CANDY[k % 4]; c.position.copyFrom(door); c.scaling.x = 1.6;
            st.fx.push({ m: c, t: 0, life: .9, v: new V3((Math.random() - .5) * 3 - dx * 2.5, 4 + Math.random() * 2, (Math.random() - .5) * 3 - dz * 2.5), spin: 4 + Math.random() * 6 }); }
          popAt(door.x, door.y + 1, door.z, '+' + n);
        } else {
          st.tricks++;
          const kind = d.kind === 'crypt' ? 'skeleton' : TRICKS[Math.floor(Math.random() * TRICKS.length)];
          if (kind === 'ghost' || kind === 'skeleton') {
            st.left -= 6; ctx.sound(kind === 'ghost' ? 'whoosh' : 'boom');
            const g = keep(ctx.kit(kind === 'ghost' ? 'cc_ghost' : 'cc_skeleton')); g.position.copyFrom(door); g.position.y = d.y + (kind === 'ghost' ? 1 : 0); g.rotation.y = d.yaw + Math.PI;
            st.fx.push({ m: g, t: 0, life: 1.6, v: new V3(-dx * 3, kind === 'ghost' ? 3.2 : 0, -dz * 3), ghost: true, fade: kind === 'ghost' });
            H.msg(kind === 'ghost' ? 'BOO!' : 'The bones rattle!', 1100, 'the moon slips lower · −6 s'); popAt(door.x, door.y + 1, door.z, '−6 s');
          } else if (kind === 'thief') {
            const lost = Math.min(st.candy, 20); st.candy -= lost; ctx.sound('scratch');
            const tr = keep(ctx.kit('cc_trickster')); tr.position.copyFrom(door); tr.position.y = d.y + .4; tr.rotation.y = d.yaw;
            st.fx.push({ m: tr, t: 0, life: 1.8, v: new V3(dz * 7, .6, -dx * 7), ghost: true });
            H.msg('A trickster!', 1100, lost ? `it ran off with ${lost} candy` : 'nothing to steal… yet'); if (lost) popAt(door.x, door.y + 1, door.z, '−' + lost);
          } else {
            st.frozen = 2.2; ctx.sound('zap');
            const p = ctx.player.world(), sp = keep(new B.TransformNode('ttSpider', scene)); sp.position.set(p.x, p.y + 6, p.z);
            const body = B.MeshBuilder.CreateSphere('ttSpiderBody', { diameter: .5, segments: 8 }, scene); body.material = web; body.parent = sp; ctx.add(body); nodes.push(body);
            for (let k = 0; k < 8; k++) { const leg = B.MeshBuilder.CreateCylinder('ttLeg', { height: .6, diameter: .05, tessellation: 4 }, scene); leg.material = web; leg.parent = sp; leg.position.set((k < 4 ? -1 : 1) * .3, -.05, (k % 4 - 1.5) * .14); leg.rotation.z = (k < 4 ? 1 : -1) * 1.1; ctx.add(leg); nodes.push(leg); }
            const th = B.MeshBuilder.CreateCylinder('ttThread', { height: 6, diameter: .02, tessellation: 4 }, scene); th.material = thread; th.parent = sp; th.position.y = 3; ctx.add(th); nodes.push(th);
            st.fx.push({ m: sp, t: 0, life: 2.4, spider: p.y + 3.4 });
            H.msg('A spider!', 1200, 'frozen with fright');
          }
        }
        hud();
        if (st.knocked >= doors.length) finish(true);
      }
      function finish(all) {
        if (st.phase === 'done') return; st.phase = 'done'; ctx.player.hold(false); H.meter(null); beam.setEnabled(false);
        const bonus = all ? 50 + Math.max(0, Math.floor(st.left)) : 0, score = st.candy + bonus; hud();
        H.msg(all ? 'Every door!' : 'The moon has set', 1600, `${score} points`);
        ctx.finish({ score, label: 'points', passed: score >= (def.pass || 150), kicker: all ? 'Every door knocked' : 'The moon has set',
          extra: `${st.knocked} of ${doors.length} doors: ${st.treats} treat${st.treats === 1 ? '' : 's'}, ${st.tricks} trick${st.tricks === 1 ? '' : 's'}, ${st.candy} candy${bonus ? ` + ${bonus} for knocking on them all before moonset` : ''}.` });
      }
      ctx.player.hold(true);
      H.title(def.title || 'Trick or Treat Night'); hud();
      H.hint(`${def.text ? def.text + ' · ' : ''}Run to each lit pumpkin (hold <kbd>R</kbd>) and knock with <kbd>Space</kbd>. Treats give candy; tricks cost time or candy.`);
      return {
        update(dt) {
          const T = performance.now() / 1000;
          for (const d of doors) if (!d.done) { const k = 1 + .08 * Math.sin(T * 4 + d.i); d.ring.scaling.set(k, 1, k); }
          for (let k = st.fx.length - 1; k >= 0; k--) {
            const f = st.fx[k]; f.t += dt;
            if (f.spider != null) { const u = Math.min(1, f.t / .5), back = Math.max(0, (f.t - 1.8) / .6); f.m.position.y = f.spider + 3 * (1 - u) + 4 * back; f.m.rotation.y += dt * 2; }
            else if (f.ghost) { f.m.position.addInPlace(f.v.scale(dt)); if (f.fade) f.m.scaling.setAll(Math.max(.01, Math.min(1, (f.life - f.t) / .5))); } // shrinks away (kit pieces are instances)
            else { f.v.y -= 12 * dt; f.m.position.addInPlace(f.v.scale(dt)); f.m.rotation.x += f.spin * dt; f.m.scaling.setAll(Math.max(.01, 1 - f.t / f.life)); f.m.scaling.x *= 1.6; }
            if (f.t >= f.life) { f.m.setEnabled(false); st.fx.splice(k, 1); }
          }
          if (st.phase === 'count') {
            st.t -= dt; const n = st.t > 2.4 ? '3' : st.t > 1.4 ? '2' : st.t > .4 ? '1' : 'Trick or treat!';
            if (n !== st.said) { st.said = n; H.msg(n, n.length > 2 ? 900 : 800); ctx.note(n.length > 2 ? 880 : 440, 'bell'); }
            if (st.t <= .4) { st.phase = 'run'; ctx.player.hold(false); }
          } else if (st.phase === 'run') {
            st.left -= dt;
            if (st.act) { const a = st.act; a.t += dt; if (a.step === 0 && a.t > .35) { a.step = 1; ctx.sound('thock'); } if (a.t > .9) { st.act = null; ctx.player.hold(st.frozen > 0); answer(a.d); if (st.phase !== 'run') return; } }
            if (st.frozen > 0) { st.frozen -= dt; ctx.player.hold(true); if (st.frozen <= 0) { st.frozen = 0; if (!st.act) ctx.player.hold(false); } }
            if (st.left <= 0) { st.left = 0; finish(false); return; }
            hud();
          }
          const n = near().d; if (n && st.phase !== 'done') { beam.setEnabled(true); beam.position.set(n.x, n.y + 7, n.z); beam.material.alpha = .16 + .08 * Math.sin(T * 6); } else beam.setEnabled(false);
        },
        // Space knocks (the walk keeps every other key)
        key(e, down) { if (e.key === ' ') { if (down && !e.repeat) knock(); return true; } return false; },
        target() { const n = near().d; return n ? { x: n.x, z: n.z } : null; },
        _test: { st, doors, knock, answer, near, finish, go(i) { const d = doors[i]; ctx.player.placeWorld(d.x, d.z, d.yaw); } },
        dispose() { ctx.player.hold(false); H.meter(null); nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); }
      };
    }
  };
  window.RebelGames.register('trick', G);
})();
