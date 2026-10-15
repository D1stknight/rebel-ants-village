// Koi Feeding (Oct 15, Shogun): the garden pond's koi are hungry. Click the water to toss a pellet; the koi nearest it
// swim over and the first to reach it eats. A hungry koi (a red ring over it) is worth points; a full one (grey) eats
// your pellet for nothing. Feed every koi full before the pellets or the minute run out; the golden koi comes up late
// and is worth the most. Score: points for the koi you fed, a bonus for every one full and pellets to spare.
// def: { pond: [x, z, r] (world centre and radius), water (world height), koi (8), pellets (26), seconds (60), pass, points }
(function () {
  const COLS = [[.95, .45, .12], [.98, .96, .92], [.9, .2, .1], [.15, .13, .13], [.98, .7, .2], [.95, .95, .9], [.85, .35, .1], [.2, .18, .2]];
  const G = {
    title: 'Koi Feeding',
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const [px, pz, pr] = def.pond || [0, 6, 7], frameY = ctx.toWorld(0, 0, 0).y, WY = (def.water ?? frameY) - frameY;
      const P = ctx.toLocal ? ctx.toLocal(new V3(px, def.water ?? frameY, pz)) : new V3(px, 0, pz); // the pond centre in frame coordinates
      const R = pr - .9, NK = def.koi || 8, PELLETS = def.pellets || 26, SECS = def.seconds || 60;
      const st = { phase: 'intro', wait: 1.1, el: 0, score: 0, left: PELLETS, fed: 0, food: [], ripples: [], gold: null };
      const nodes = [], keep = n => { ctx.add(n); nodes.push(n); if (n.isPickable !== undefined) n.isPickable = false; return n; };
      const mat = (k, c, em, o = {}) => ctx.mat('kf_' + k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(...(o.spec || [.35, .35, .35])); if (em) m.emissiveColor = new B.Color3(...em); if (o.alpha != null) m.alpha = o.alpha; if (o.add) { m.disableLighting = true; m.alphaMode = B.Engine.ALPHA_ADD; m.backFaceCulling = false; } return m; });
      // a koi: a long body, a tail fin that sweeps, two side fins; patched colours (two materials)
      function makeKoi(i, gold) {
        const root = keep(new B.TransformNode('kfKoi' + i, scene)), c1 = gold ? [1, .78, .25] : COLS[i % COLS.length], c2 = gold ? [1, .9, .5] : COLS[(i * 3 + 1) % COLS.length];
        const m1 = mat('koi' + c1.join('_'), c1, c1.map(v => v * (gold ? .5 : .18)), { spec: gold ? [1, .9, .5] : [.4, .4, .4] }), m2 = mat('koi' + c2.join('_'), c2, c2.map(v => v * .18));
        const body = B.MeshBuilder.CreateSphere('kfBody', { diameter: .5, segments: 10 }, scene); body.scaling.set(.62, .42, 2.1); body.material = m1; body.parent = root; body.isPickable = false;
        const patch = B.MeshBuilder.CreateSphere('kfPatch', { diameter: .36, segments: 8 }, scene); patch.scaling.set(.66, .36, 1.3); patch.position.set(0, .07, .12); patch.material = m2; patch.parent = root; patch.isPickable = false;
        const tail = new B.TransformNode('kfTail', scene); tail.parent = root; tail.position.z = -.5;
        const fin = B.MeshBuilder.CreateDisc('kfFin', { radius: .26, tessellation: 3, sideOrientation: B.Mesh.DOUBLESIDE }, scene); fin.rotation.set(Math.PI / 2, 0, Math.PI / 2); fin.scaling.set(1, 1.3, 1); fin.position.z = -.18; fin.material = m2; fin.parent = tail; fin.isPickable = false;
        for (const s of [-1, 1]) { const f = B.MeshBuilder.CreateDisc('kfSide', { radius: .1, tessellation: 3, sideOrientation: B.Mesh.DOUBLESIDE }, scene); f.rotation.set(Math.PI / 2, s * .9, 0); f.position.set(s * .16, -.04, .18); f.material = m1; f.parent = root; f.isPickable = false; }
        const ring = B.MeshBuilder.CreateTorus('kfHunger', { diameter: .9, thickness: .05, tessellation: 24 }, scene); ring.parent = root; ring.position.y = .32; ring.isPickable = false;
        const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * R * .8;
        root.scaling.setAll(gold ? 1.5 : 1.2 + Math.random() * .5);
        return { root, tail, ring, gold, x: P.x + Math.cos(a) * r, z: P.z + Math.sin(a) * r, yaw: Math.random() * 6.28, v: .6, hunger: gold ? 3 : 2 + Math.floor(Math.random() * 2), full: false, wt: Math.random() * 6, ph: Math.random() * 6, target: null };
      }
      const hungryM = mat('hungry', [0, 0, 0], [1, .25, .15], { alpha: .75, add: true }), fullM = mat('full', [0, 0, 0], [.4, .42, .45], { alpha: .35, add: true });
      const koi = Array.from({ length: NK }, (_, i) => makeKoi(i, false));
      const pelletM = mat('pellet', [.55, .35, .15], [.12, .07, .03]), rippleM = mat('ripple', [0, 0, 0], [.85, .95, 1], { alpha: .6, add: true });
      const pelletSrc = keep(B.MeshBuilder.CreateSphere('kfPelletSrc', { diameter: .14, segments: 6 }, scene)); pelletSrc.material = pelletM; pelletSrc.isVisible = false;
      const rippleSrc = keep(B.MeshBuilder.CreateTorus('kfRippleSrc', { diameter: 1, thickness: .03, tessellation: 28 }, scene)); rippleSrc.material = rippleM; rippleSrc.isVisible = false;
      // where a click lands on the water (a plane at the water height in frame coordinates)
      const waterW = ctx.toWorld(0, WY, 0).y;
      function waterAt(x, y) {
        const ray = ctx.ray(x, y); if (Math.abs(ray.direction.y) < 1e-4) return null;
        const t = (waterW - ray.origin.y) / ray.direction.y; if (t < 0) return null;
        const w = ray.origin.add(ray.direction.scale(t)), l = ctx.toLocal(w);
        return Math.hypot(l.x - P.x, l.z - P.z) <= pr - .3 ? l : null;
      }
      function ripple(x, z, big) { const m = rippleSrc.createInstance('kfRipple'); m.isPickable = false; keep(m); m.position.set(x, WY + .03, z); st.ripples.push({ m, t: 0, big }); }
      function toss(l) {
        if (st.phase !== 'play' || st.left <= 0) return;
        st.left--; const m = pelletSrc.createInstance('kfPellet'); m.isPickable = false; keep(m); m.position.set(l.x, WY + .04, l.z);
        st.food.push({ m, x: l.x, z: l.z, t: 0 }); ripple(l.x, l.z); ctx.sound('splash');
        hud();
      }
      // the camera on the bank, looking down over the pond; the Rebel at the water's edge
      const camP = def.camP || [P.x, WY + 8.5, P.z - 9.5], camT = def.camT || [P.x, WY, P.z + 1.5]; // the bank, above the near edge
      ctx.look(camP, camT, .9);
      ctx.player.place(def.playerAt?.[0] ?? -2.6, def.playerAt?.[1] ?? -1.4, Math.atan2(P.x + 2.6, P.z + 1.4));
      function hud() { H.score(st.score); H.info(`${st.fed} / ${koi.length} full · ${st.left} ${st.left === 1 ? 'pellet' : 'pellets'} · ${Math.max(0, Math.ceil(SECS - st.el))} s`); }
      H.title(def.title || 'Koi Feeding'); hud();
      H.hint('Click the water to toss a pellet near a hungry koi (red ring) · full koi (grey) eat for nothing');
      function eat(k, f) {
        f.m.dispose(); st.food.splice(st.food.indexOf(f), 1); ripple(f.x, f.z, true);
        if (k.full) { ctx.sound('thock'); return; }
        k.hunger--; const pts = k.gold ? 12 : 4; st.score += pts;
        const sp = ctx.screenOf(ctx.toWorld(k.x, WY + .4, k.z)); if (!sp.behind) H.pop(sp.x, sp.y, `+${pts}`);
        ctx.sound('water');
        if (k.hunger <= 0) { k.full = true; st.fed++; st.score += k.gold ? 25 : 6; ctx.sound('chime'); if (!sp.behind) H.pop(sp.x, sp.y - 24, k.gold ? 'The golden koi is full!' : 'Full'); }
        hud();
        if (koi.every(q => q.full) && (!st.goldDue || st.gold)) end();
      }
      function end() {
        if (st.phase === 'done') return; st.phase = 'done';
        const all = koi.every(q => q.full), bonus = all ? 20 + st.left * 3 : 0; st.score += bonus;
        const passed = st.score >= (def.pass || 0);
        H.msg(all ? 'Every koi is full' : 'The koi are still hungry', 1500, bonus ? `+${bonus} bonus` : '');
        if (passed) ctx.sound('gamewin');
        setTimeout(() => ctx.finish({ score: st.score, passed, extra: `${st.fed} of ${koi.length} koi fed full${st.gold ? (st.gold.full ? ', the golden koi too' : '; the golden koi went hungry') : ''}${all ? `, ${st.left} ${st.left === 1 ? 'pellet' : 'pellets'} left` : ''}. Toss near a hungry one, away from the full ones.` }), 1000);
      }
      st.goldDue = true;
      return {
        update(dt) {
          const t = performance.now() / 1000;
          if (st.phase === 'intro') { if ((st.wait -= dt) <= 0) { st.phase = 'play'; H.msg('Feed them!', 700); } }
          else if (st.phase === 'play') {
            st.el += dt;
            if (!st.gold && st.el > SECS * .45) { const g = makeKoi(99, true); g.x = P.x; g.z = P.z; koi.push(g); st.gold = g; ripple(g.x, g.z, true); ctx.sound('wish'); H.msg('The golden koi!', 1100); hud(); }
            if (st.el >= SECS || (st.left <= 0 && !st.food.length)) { end(); }
            else if (Math.floor(st.el * 4) !== Math.floor((st.el - dt) * 4)) hud();
          }
          // pellets sink slowly and go soft after 9 s
          for (let i = st.food.length - 1; i >= 0; i--) { const f = st.food[i]; f.t += dt; f.m.position.y = WY + .04 - Math.min(.25, f.t * .03); if (f.t > 9) { f.m.dispose(); st.food.splice(i, 1); } }
          for (let i = st.ripples.length - 1; i >= 0; i--) { const r = st.ripples[i]; r.t += dt; r.m.scaling.setAll(.3 + r.t * (r.big ? 2.6 : 1.8)); r.m.visibility = Math.max(0, 1 - r.t * 1.4); if (r.t > .75) { r.m.dispose(); st.ripples.splice(i, 1); } }
          // the koi: wander round the pond; the hungry ones within 5 m of a pellet swim to it (full ones only half as keen)
          for (const k of koi) {
            let tx, tz, sp = .7 + .3 * Math.sin(t * .3 + k.ph);
            let best = null, bd = Infinity; for (const f of st.food) { const d = Math.hypot(f.x - k.x, f.z - k.z); if (d < (k.full ? 3 : 5.5) && d < bd) { bd = d; best = f; } }
            if (best) { tx = best.x; tz = best.z; sp = (k.full ? 1.4 : 2.3) * (k.gold ? .85 : 1); if (bd < .35) { eat(k, best); continue; } }
            else { k.wt -= dt; if (!k.target || k.wt <= 0 || Math.hypot(k.target[0] - k.x, k.target[1] - k.z) < .6) { const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * R; k.target = [P.x + Math.cos(a) * r, P.z + Math.sin(a) * r]; k.wt = 3 + Math.random() * 4; } tx = k.target[0]; tz = k.target[1]; }
            const want = Math.atan2(tx - k.x, tz - k.z); let dy = want - k.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); k.yaw += Math.max(-2.6 * dt, Math.min(2.6 * dt, dy)) * (best ? 1.6 : 1);
            k.v += (sp - k.v) * Math.min(1, dt * 2);
            k.x += Math.sin(k.yaw) * k.v * dt; k.z += Math.cos(k.yaw) * k.v * dt;
            const dc = Math.hypot(k.x - P.x, k.z - P.z); if (dc > R) { k.x = P.x + (k.x - P.x) / dc * R; k.z = P.z + (k.z - P.z) / dc * R; k.yaw += Math.PI * .5 * dt * 4; }
            k.root.position.set(k.x, WY - (k.full ? .32 : .14) + .03 * Math.sin(t * 2 + k.ph), k.z); k.root.rotation.y = k.yaw;
            k.tail.rotation.y = .45 * Math.sin(t * (4 + k.v * 4) + k.ph);
            k.ring.material = k.full ? fullM : hungryM; k.ring.scaling.setAll(k.full ? 1 : 1 + .12 * Math.sin(t * 6 + k.ph));
          }
        },
        pointer(evt) { if (evt.type !== B.PointerEventTypes.POINTERDOWN) return; const l = waterAt(scene.pointerX, scene.pointerY); if (l) toss(l); },
        key(e, down) { if (!down || e.repeat) return; if (e.key === ' ') { const k = koi.filter(q => !q.full).sort((a, b) => a.hunger - b.hunger)[0]; if (k) toss({ x: k.x + Math.sin(k.yaw) * 1.2, z: k.z + Math.cos(k.yaw) * 1.2 }); } },
        _test: { st, koi, toss, waterAt, end, P, WY },
        dispose() { nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); }
      };
    }
  };
  window.RebelGames.register('koi', G);
})();
