// Silent Steps (Oct 15, Ronin): a roam game (you walk with the normal walk and the camera follows). Cross the fortress
// at night to the goal without being seen. Watchmen walk their beats with lanterns; the light on the ground in front of
// each is what they see. Step into it and you are sent back to the last lantern post you reached. Walking is silent;
// running near a watchman makes him turn to look. Time from the start to the goal; bronze, silver and gold.
// def: { goal: [x, z], checkpoints: [[x, z], ...], guards: [{ path: [[x, z], ...], speed (m/s), wait (s at each end),
//   loop (a closed beat), look: [yaw, sweep] (a watchman who stands and turns) }], view (m, 8), fov (deg, 64),
//   medals: [gold, silver, bronze] s, limit (s), color [r, g, b] (their robes), text, guardModel: NPC library keys }
// The watchmen (Oct 17, Miguel: "we need to make the watchmen look better"): each takes the forged Ronin villager's model
// (the NPC library's ronin_villager) once it has loaded, in place of the robe-and-hat figure: it walks its beat with the
// walk clip, looks round when it stands, and its lantern pole runs from its right hand to the lamp ahead of it.
// Oct 17 (Miguel: "im giving you ... sneak walk animations for it"): with the games pack the Rebel walks with the sneak
// walk (game_sneak) while the game runs; running is still the run.
(function () {
  const fmt = t => { const m = Math.floor(t / 60), s = t - m * 60; return m ? `${m}:${s.toFixed(1).padStart(4, '0')}` : s.toFixed(1); };
  const G = {
    title: 'Silent Steps', roam: true, moves: true,
    start(ctx) {
      const B = ctx.B, H = ctx.HUD, scene = ctx.scene, def = ctx.def, V3 = B.Vector3;
      const VIEW = def.view || 8, HALF = (def.fov || 64) / 2 * Math.PI / 180, med = def.medals || [40, 60, 90], [gold, silver, bronze] = med, limit = def.limit || Math.max(150, bronze * 2);
      const goal = { x: +def.goal[0], z: +def.goal[1] }; goal.y = ctx.ground(goal.x, goal.z);
      const cps = (def.checkpoints || []).map(([x, z]) => ({ x: +x, z: +z, y: ctx.ground(+x, +z), got: false }));
      const st = { phase: 'count', t: 3.4, said: '', el: 0, caught: 0, seenT: 0, back: null, safe: null };
      const nodes = [], keep = n => { ctx.add(n); n.parent = null; nodes.push(n); if (n.isPickable !== undefined) n.isPickable = false; return n; };
      const mat = (k, c, em, o = {}) => ctx.mat('ss_' + k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(.05, .05, .05); if (em) m.emissiveColor = new B.Color3(...em); if (o.alpha != null) m.alpha = o.alpha; if (o.add) { m.disableLighting = true; m.alphaMode = B.Engine.ALPHA_ADD; m.backFaceCulling = false; } return m; });
      const robe = def.color || [.36, .08, .08], robeM = mat('robe' + robe.join('_'), robe, robe.map(v => v * .2)), dark = mat('dark', [.06, .05, .05]), straw = mat('straw', [.62, .5, .3], [.08, .06, .03]);
      const lampM = mat('lamp', [1, .7, .35], [1, .6, .25]), coneM = mat('cone', [0, 0, 0], [1, .7, .32], { alpha: .36, add: true }), seenM = mat('seen', [0, 0, 0], [1, .2, .12], { alpha: .45, add: true });
      const edgeM = mat('edge', [0, 0, 0], [1, .88, .55], { alpha: .8, add: true }), seenEdgeM = mat('seenEdge', [0, 0, 0], [1, .3, .2], { alpha: .9, add: true });
      // the light a watchman sees by: a fan on the ground
      function fan(n) {
        const pos = [0, 0, 0], idx = [], S = 18;
        for (let i = 0; i <= S; i++) { const a = -HALF + 2 * HALF * i / S; pos.push(Math.sin(a) * VIEW, 0, Math.cos(a) * VIEW); if (i) idx.push(0, i, i + 1); }
        const m = new B.Mesh(n, scene), vd = new B.VertexData(); vd.positions = pos; vd.indices = idx; vd.normals = []; B.VertexData.ComputeNormals(pos, idx, vd.normals); vd.applyToMesh(m); m.material = coneM; m.isPickable = false; return m;
      }
      // its rim: a bright band along the arc and both sides, so the edge of the light reads at night
      function fanEdge(n) {
        const pos = [], idx = [], S = 18, W = .16, quad = (a, b, c, d) => { const k = pos.length / 3; pos.push(...a, ...b, ...c, ...d); idx.push(k, k + 1, k + 2, k, k + 2, k + 3); };
        for (let i = 0; i < S; i++) { const a0 = -HALF + 2 * HALF * i / S, a1 = -HALF + 2 * HALF * (i + 1) / S, r0 = VIEW - W, r1 = VIEW;
          quad([Math.sin(a0) * r0, 0, Math.cos(a0) * r0], [Math.sin(a0) * r1, 0, Math.cos(a0) * r1], [Math.sin(a1) * r1, 0, Math.cos(a1) * r1], [Math.sin(a1) * r0, 0, Math.cos(a1) * r0]); }
        for (const a of [-HALF, HALF]) { const dx = Math.sin(a), dz = Math.cos(a), nx = dz * W / 2, nz = -dx * W / 2;
          quad([nx, 0, nz], [dx * VIEW + nx, 0, dz * VIEW + nz], [dx * VIEW - nx, 0, dz * VIEW - nz], [-nx, 0, -nz]); }
        const m = new B.Mesh(n, scene), vd = new B.VertexData(); vd.positions = pos; vd.indices = idx; vd.normals = []; B.VertexData.ComputeNormals(pos, idx, vd.normals); vd.applyToMesh(m); m.material = edgeM; m.isPickable = false; return m;
      }
      const cyl = (n, h, d0, d1, m, x, y, z, par) => { const c = B.MeshBuilder.CreateCylinder(n, { height: h, diameterTop: d0, diameterBottom: d1, tessellation: 12 }, scene); c.material = m; c.parent = par; c.position.set(x, y, z); c.isPickable = false; return c; };
      const guards = (def.guards || []).map((g, i) => {
        const root = keep(new B.TransformNode('ssGuard' + i, scene)), body = new B.TransformNode('ssBody' + i, scene); body.parent = root;
        cyl('ssRobe', 1.9, .75, 1.1, robeM, 0, .95, 0, body); cyl('ssChest', .8, .62, .78, robeM, 0, 2.2, 0, body);
        const head = B.MeshBuilder.CreateSphere('ssHead', { diameter: .56, segments: 10 }, scene); head.material = dark; head.parent = body; head.position.y = 2.85; head.isPickable = false;
        cyl('ssHat', .32, 0, 1.5, straw, 0, 3.22, 0, body);
        const pole = cyl('ssPole', 1.3, .05, .05, dark, .42, 2.3, .55, body); pole.rotation.x = -.7;
        const lamp = cyl('ssLamp', .42, .3, .3, lampM, .42, 2.6, 1.05, body);
        const cone = fan('ssCone' + i); cone.parent = root; cone.position.y = .07;
        const edge = fanEdge('ssEdge' + i); edge.parent = root; edge.position.y = .08;
        const path = (g.path || [[0, 0]]).map(([x, z]) => ({ x: +x, z: +z }));
        const G = { root, body, cone, edge, lamp, pole, path, speed: g.speed || 2, wait: g.wait ?? 1.2, loop: !!g.loop, look: g.look || null, seg: 0, dir: 1, u: 0, pause: 0, x: path[0].x, z: path[0].z, yaw: g.look ? g.look[0] : 0, alert: 0, ph: i * 1.7 };
        if (path.length > 1) G.yaw = Math.atan2(path[1].x - path[0].x, path[1].z - path[0].z);
        return G;
      });
      // the forged watchmen (see the top), loaded one after another (the browser fetches the model once)
      (async () => {
        for (const G of guards) {
          const n = await ctx.npcModel?.(def.guardModel || ['ronin_villager']); if (!n || st.phase === 'done') return;
          G.npc = n; G.hand = n.bone('mixamorig_RightHand'); n.root.parent = G.root; n.root.position.set(0, 0, 0);
          G.body.getChildMeshes(false).forEach(m => { if (m !== G.lamp && m !== G.pole) m.setEnabled(false); });
          G.pole.parent = null; G.pole.rotationQuaternion = new B.Quaternion(); G.anim = '';
        }
      })();
      const UP = V3.Up(), LAMP = new V3(.42, 2.45, 1.05);
      // a forged watchman's clip for what it is doing, and the pole from its hand to the lamp
      function npcPose(g, moving) {
        const want = g.alert > 0 ? 'look_around' : moving ? 'walk' : g.look ? 'look_around' : 'idle';
        if (want !== g.anim) { g.anim = want; g.npc.play(want, { loop: true, speed: want === 'walk' ? Math.max(.6, Math.min(1.8, g.speed / 1.35)) : want === 'look_around' && g.alert > 0 ? 1.6 : 1 }); }
        if (!g.hand) return;
        const h = g.hand.getAbsolutePosition(), l = V3.TransformCoordinates(LAMP, g.root.getWorldMatrix()), d = l.subtract(h), len = d.length() || 1;
        g.pole.position.copyFrom(h.add(l).scale(.5)); g.pole.scaling.y = len / 1.3;
        B.Quaternion.FromUnitVectorsToRef(UP, d.scale(1 / len), g.pole.rotationQuaternion);
      }
      // the lantern posts (checkpoints) and the goal: a ring and a beam each, the goal in gold
      const postM = mat('post', [0, 0, 0], [.55, .85, 1], { alpha: .6, add: true }), goalM = mat('goal', [0, 0, 0], [1, .8, .35], { alpha: .65, add: true });
      cps.forEach((c, i) => { c.ring = keep(B.MeshBuilder.CreateTorus('ssCp' + i, { diameter: 3.2, thickness: .1, tessellation: 40 }, scene)); c.ring.material = postM; c.ring.position.set(c.x, c.y + .1, c.z); });
      const goalRing = keep(B.MeshBuilder.CreateTorus('ssGoal', { diameter: 4, thickness: .14, tessellation: 48 }, scene)); goalRing.material = goalM; goalRing.position.set(goal.x, goal.y + .12, goal.z);
      const beam = keep(B.MeshBuilder.CreateCylinder('ssBeam', { height: 9, diameterTop: .3, diameterBottom: .9, tessellation: 14, cap: B.Mesh.NO_CAP }, scene)); beam.material = goalM;
      const startW = ctx.player.world(); st.safe = { x: startW.x, z: startW.z, yaw: ctx.player.yaw?.() ?? 0 };
      function next() { const c = cps.find(q => !q.got); return c || goal; }
      function seen(g) {
        st.caught++; st.seenT = 1.1; g.cone.material = seenM; g.edge.material = seenEdgeM; g.alert = 1.6; ctx.sound('clang'); H.msg('Seen!', 900, 'back to the last post');
        st.back = .55; ctx.player.hold(true);
      }
      function finish(done) {
        if (st.phase === 'done') return; st.phase = 'done'; ctx.player.hold(false); beam.setEnabled(false);
        const t = st.el, medal = done ? (t <= gold ? 'Gold' : t <= silver ? 'Silver' : t <= bronze ? 'Bronze' : null) : null, lines = `Gold ${gold} s · silver ${silver} s · bronze ${bronze} s.`;
        if (done) { H.msg(medal ? medal + '!' : 'Through', 1600, fmt(t) + ' s'); ctx.sound('gamewin');
          ctx.finish({ time: t, finished: true, passed: !!medal, kicker: medal ? medal + ' medal' : 'Through unseen', extra: `${st.caught ? `Seen ${st.caught} time${st.caught > 1 ? 's' : ''}. ` : 'Never seen. '}${medal === 'Gold' ? 'A shadow among shadows. ' : 'Wait for a lantern to turn away, then go behind it. '}${lines}` }); }
        else { H.msg('Out of time', 1800); ctx.finish({ time: t, finished: false, passed: false, kicker: 'Out of time', extra: `Seen ${st.caught} ${st.caught === 1 ? 'time' : 'times'}. Watch the light on the ground: it is all they can see. ${lines}` }); }
      }
      ctx.player.hold(true); ctx.walkLight?.(def.walkLight ?? .3); // the Rebel's own glow would read as lantern light
      ctx.player.walkAs?.('game_sneak'); // the sneak walk (games pack), else the Rebel's own walk
      H.title(def.title || 'Silent Steps'); H.score('0.0'); H.info(`${guards.length} watchmen · gold ${gold} s`);
      H.hint(`${def.text ? def.text + ' · ' : ''}Keep out of the lantern light · walk (running makes them look) · blue rings are posts`);
      return {
        update(dt) {
          const t = performance.now() / 1000, p = ctx.player.world();
          goalRing.scaling.setAll(1 + .05 * Math.sin(t * 4));
          const n = next(); beam.setEnabled(st.phase !== 'done'); beam.position.set(n.x, (n.y ?? 0) + 4.6, n.z); beam.material = n === goal ? goalM : postM;
          // the watchmen walk their beats (a pause and a look round at each end) or stand and sweep
          for (const g of guards) {
            if (st.phase === 'run' || st.phase === 'count') {
              if (g.alert > 0) { g.alert -= dt; const want = Math.atan2(p.x - g.x, p.z - g.z); let d = want - g.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); g.yaw += Math.max(-3 * dt, Math.min(3 * dt, d)); }
              else if (g.look) g.yaw = g.look[0] + Math.sin(t * .55 + g.ph) * (g.look[1] || .9);
              else if (g.path.length > 1 && st.phase === 'run') {
                if (g.pause > 0) { g.pause -= dt; g.yaw += Math.sin(t * 2.2 + g.ph) * dt * 1.2; }
                else {
                  const a = g.path[g.seg], bI = g.loop ? (g.seg + 1) % g.path.length : g.seg + g.dir, b = g.path[bI];
                  const L = Math.hypot(b.x - a.x, b.z - a.z) || 1; g.u += g.speed * dt / L;
                  if (g.u >= 1) { g.u = 0; g.seg = bI; if (!g.loop && (g.seg === 0 || g.seg === g.path.length - 1)) { g.dir = -g.dir; g.pause = g.wait; } }
                  const A = g.path[g.seg], Bn = g.path[g.loop ? (g.seg + 1) % g.path.length : g.seg + g.dir] || A;
                  g.x = A.x + (Bn.x - A.x) * g.u; g.z = A.z + (Bn.z - A.z) * g.u;
                  const want = Math.atan2(Bn.x - A.x, Bn.z - A.z); let d = want - g.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); g.yaw += Math.max(-4 * dt, Math.min(4 * dt, d));
                }
              }
            }
            g.y = ctx.ground(g.x, g.z); g.root.position.set(g.x, g.y, g.z); g.root.rotation.y = g.yaw;
            g.body.position.y = g.npc || g.pause > 0 || g.look ? 0 : Math.abs(Math.sin(t * 5 + g.ph)) * .06;
            if (g.npc) { g.root.computeWorldMatrix(true); npcPose(g, st.phase === 'run' && g.path.length > 1 && !g.look && g.pause <= 0 && g.alert <= 0); }
            g.lamp.scaling.y = 1 + .06 * Math.sin(t * 11 + g.ph);
            if (st.seenT <= 0 && g.cone.material !== coneM) { g.cone.material = coneM; g.edge.material = edgeM; }
          }
          if (st.seenT > 0) st.seenT -= dt;
          if (st.back != null) { st.back -= dt; if (st.back <= 0) { st.back = null; ctx.player.placeWorld(st.safe.x, st.safe.z, st.safe.yaw); ctx.player.hold(false); } }
          if (st.phase === 'count') {
            st.t -= dt;
            const c = st.t > 2.4 ? '3' : st.t > 1.4 ? '2' : st.t > .4 ? '1' : 'Go';
            if (c !== st.said) { st.said = c; H.msg(c, 800); ctx.note(c === 'Go' ? 660 : 330, 'bell'); }
            if (st.t <= .4) { st.phase = 'run'; ctx.player.hold(false); }
            return;
          }
          if (st.phase !== 'run') return;
          st.el += dt; H.score(fmt(st.el));
          if (st.back == null) {
            const run = ctx.player.running?.();
            for (const g of guards) {
              const dx = p.x - g.x, dz = p.z - g.z, d = Math.hypot(dx, dz);
              if (Math.abs(p.y - g.y) > 1.8) continue;
              if (run && d < 9 && g.alert <= 0) { g.alert = 1.4; ctx.sound('whistle'); }
              let a = Math.atan2(dx, dz) - g.yaw; a = Math.atan2(Math.sin(a), Math.cos(a));
              if (d < 1.7 || (d < VIEW && Math.abs(a) < HALF)) { seen(g); break; }
            }
          }
          // the posts and the goal
          for (const c of cps) if (!c.got && Math.hypot(p.x - c.x, p.z - c.z) < 1.8 && Math.abs(p.y - c.y) < 2.5) { c.got = true; c.ring.setEnabled(false); st.safe = { x: c.x, z: c.z, yaw: Math.atan2(goal.x - c.x, goal.z - c.z) }; ctx.sound('chime'); H.msg('Post reached', 700); }
          if (Math.hypot(p.x - goal.x, p.z - goal.z) < 2 && Math.abs(p.y - goal.y) < 2.5) { finish(true); return; }
          H.info(`Seen ${st.caught} · ${cps.filter(c => c.got).length} / ${cps.length} posts`);
          if (st.el > limit) finish(false);
        },
        target() { const n = next(); return { x: n.x, z: n.z }; },
        _test: { st, guards, cps, goal, finish, seen },
        dispose() { ctx.player.hold(false); nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); }
      };
    }
  };
  window.RebelGames.register('stealth', G);
})();
