// Village Run (Oct 15): a time trial through the village, a roam game (you run with the normal walk, R to run, and the
// camera follows). Gates stand along a route; run through each in order to the finish. A countdown holds you on the
// line, then the clock runs; a gold light marks the next gate and passed gates sink away. Bronze, silver and gold times;
// your best run comes back as a ghost (a soft light running your best line) and each gate shows your time against it.
// def: { gates: [[x, z], ...] world points in order (the last is the finish), start: [x, z, yaw], radius (3 m),
// medals: [gold, silver, bronze] seconds, limit (seconds, default bronze x 2.2), style: 'gate' | 'brazier',
// cloth: [r, g, b] (the gate cloth), text (a line before the start), mist: { delay, speed } (Before the Mist: the mist
// follows the route behind you; caught = the run ends) }
(function () {
  const GHOST_KEY = 'rebelAntsCourseGhosts:v1';
  const loadGhosts = () => { try { return JSON.parse(localStorage.getItem(GHOST_KEY) || '{}') || {}; } catch (e) { return {}; } };
  const saveGhost = (id, g) => { try { const all = loadGhosts(); all[id] = g; localStorage.setItem(GHOST_KEY, JSON.stringify(all)); } catch (e) {} };
  const fmt = t => { const m = Math.floor(t / 60), s = t - m * 60; return m ? `${m}:${s.toFixed(1).padStart(4, '0')}` : s.toFixed(1); };
  const SAMPLE = .2; // the ghost: a point every 0.2 s
  const G = {
    title: 'Village Run', roam: true,
    start(ctx) {
      const B = ctx.B, H = ctx.HUD, scene = ctx.scene, def = ctx.def, V3 = B.Vector3;
      const gates = (def.gates || []).map(p => ({ x: +p[0], z: +p[1], y: 0, parts: [], passed: false }));
      const R = def.radius || 3, med = def.medals || [30, 40, 55], [gold, silver, bronze] = med, limit = def.limit || Math.round(bronze * 2.2);
      const st = { phase: 'count', t: 3.4, el: 0, next: 0, said: '', sampleT: 0, track: [], splits: [], caught: false };
      const start = def.start || [gates[0].x, gates[0].z - 6, 0];
      const ghost = loadGhosts()[def.id] || null;
      const nodes = [], keep = n => { ctx.add(n); n.parent = null; nodes.push(n); if (n.isPickable !== undefined) n.isPickable = false; return n; };
      const mat = (k, make) => ctx.mat(k, make);
      const std = (k, c, em, alpha) => mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(.05, .05, .05); if (em) m.emissiveColor = new B.Color3(...em); if (alpha != null) { m.alpha = alpha; } return m; });
      const cloth = def.cloth || [.62, .1, .1];
      const woodM = std('post', [.3, .2, .12], [.05, .035, .02]);
      const clothM = std('cloth' + cloth.join('_'), cloth, cloth.map(v => v * .35));
      const glowM = mat('glow', n => { const m = new B.StandardMaterial(n, scene); m.disableLighting = true; m.emissiveColor = new B.Color3(1, .8, .32); m.alpha = .5; m.alphaMode = B.Engine.ALPHA_ADD; m.backFaceCulling = false; return m; });
      const flameM = mat('flame', n => { const m = new B.StandardMaterial(n, scene); m.disableLighting = true; m.emissiveColor = new B.Color3(1, .55, .14); m.alpha = .85; m.alphaMode = B.Engine.ALPHA_ADD; m.backFaceCulling = false; return m; });
      // the route: the start, then each gate (for facing the gates along the way); the mist follows def.path (the walkable
      // line between the gates) when there is one
      gates.forEach(g => { g.y = ctx.ground(g.x, g.z); });
      const pts = [{ x: start[0], z: start[1] }, ...gates];
      const way = def.path?.length ? [{ x: start[0], z: start[1] }, ...def.path.map(p => ({ x: +p[0], z: +p[1] }))] : pts, cum = [0];
      for (let i = 1; i < way.length; i++) cum.push(cum[i - 1] + Math.hypot(way[i].x - way[i - 1].x, way[i].z - way[i - 1].z));
      // the parts, one hidden source each; every gate is a set of copies
      const src = {};
      const source = (k, make, m) => { if (src[k]) return src[k]; const s = keep(make()); s.material = m; s.isVisible = false; return (src[k] = s); };
      const brazier = def.style === 'brazier';
      gates.forEach((g, i) => {
        const a = pts[i], b = pts[Math.min(pts.length - 1, i + 2)] || g, dx = b.x - a.x, dz = b.z - a.z;
        g.yaw = Math.atan2(dx, dz) || 0;
        const root = keep(new B.TransformNode('crGate' + i, scene)); root.position.set(g.x, g.y, g.z); root.rotation.y = g.yaw; g.root = root;
        const add = (k, make, m, x, y, z, ry = 0) => { const inst = source(k, make, m).createInstance('crGate' + i + k); inst.parent = root; inst.position.set(x, y, z); inst.rotation.y = ry; inst.isPickable = false; g.parts.push(inst); return inst; };
        if (brazier) {
          add('stand', () => B.MeshBuilder.CreateCylinder('crStand', { height: 1.6, diameterTop: .28, diameterBottom: .6, tessellation: 10 }, scene), woodM, 0, .8, 0);
          add('bowl', () => B.MeshBuilder.CreateCylinder('crBowl', { height: .5, diameterTop: 1.5, diameterBottom: .8, tessellation: 16 }, scene), std('iron', [.16, .15, .14], [.02, .02, .02]), 0, 1.85, 0);
          g.flame = add('flame', () => B.MeshBuilder.CreateCylinder('crFlame', { height: 1.6, diameterTop: 0, diameterBottom: 1.1, tessellation: 12 }, scene), flameM, 0, 2.85, 0);
          g.flame.setEnabled(false);
        } else {
          const w = R - .35, last = i === gates.length - 1;
          for (const s of [-1, 1]) add('post', () => B.MeshBuilder.CreateCylinder('crPost', { height: 4.8, diameter: .36, tessellation: 10 }, scene), woodM, s * w, 2.4, 0);
          add('beam', () => B.MeshBuilder.CreateBox('crBeam', { width: 1, height: .3, depth: .42 }, scene), woodM, 0, 4.72, 0).scaling.x = 2 * w + 1.1;
          add('tie', () => B.MeshBuilder.CreateBox('crTie', { width: 1, height: .18, depth: .26 }, scene), woodM, 0, 4.15, 0).scaling.x = 2 * w;
          // the cloth hangs under the tie, over the runner's head (a Rebel is 3.4 m tall)
          const c = add(last ? 'flag' : 'cloth', () => B.MeshBuilder.CreatePlane('crCloth', { width: 1, height: .7, sideOrientation: B.Mesh.DOUBLESIDE }, scene), last ? finishMat() : clothM, 0, 3.72, 0);
          c.scaling.x = 2 * w - .5;
        }
      });
      function finishMat() { return mat('finish', n => { const m = new B.StandardMaterial(n, scene); const t = new B.DynamicTexture(n + 'Tex', { width: 128, height: 32 }, scene, false); const x = t.getContext();
        for (let i = 0; i < 16; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? '#111' : '#f5f0e0'; x.fillRect(i * 8, j * 8, 8, 8); } t.update(); m.diffuseTexture = t; m.emissiveColor = new B.Color3(.35, .35, .35); m.specularColor = new B.Color3(0, 0, 0); return m; }); }
      // the next gate: a gold ring in its opening and a beam of light
      const ring = keep(B.MeshBuilder.CreateTorus('crRing', { diameter: brazier ? 2.6 : 2 * R - 1.2, thickness: .16, tessellation: 40 }, scene)); ring.material = glowM;
      const beam = keep(B.MeshBuilder.CreateCylinder('crBeam2', { height: 8, diameterTop: .5, diameterBottom: 1.6, tessellation: 18, cap: B.Mesh.NO_CAP }, scene)); beam.material = glowM;
      // the ghost: a soft light running your best line
      let ghostNode = null;
      if (ghost?.p?.length >= 4) {
        ghostNode = keep(B.MeshBuilder.CreateSphere('crGhost', { diameter: .8, segments: 10 }, scene));
        ghostNode.material = mat('ghost', n => { const m = new B.StandardMaterial(n, scene); m.disableLighting = true; m.emissiveColor = new B.Color3(.55, .9, 1); m.alpha = .55; m.alphaMode = B.Engine.ALPHA_ADD; return m; });
        const halo = keep(B.MeshBuilder.CreateSphere('crGhostHalo', { diameter: 1.7, segments: 8 }, scene)); halo.parent = ghostNode; halo.material = mat('ghostHalo', n => { const m = new B.StandardMaterial(n, scene); m.disableLighting = true; m.emissiveColor = new B.Color3(.25, .5, .7); m.alpha = .22; m.alphaMode = B.Engine.ALPHA_ADD; return m; });
        ghostNode.setEnabled(false);
      }
      // the mist (Before the Mist): soft walls of fog that follow the route behind you
      let mist = null;
      if (def.mist) {
        const tex = new B.DynamicTexture('crMistTex', { width: 128, height: 128 }, scene, false); const x = tex.getContext(), gr = x.createRadialGradient(64, 64, 4, 64, 64, 62);
        gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(.5, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128); tex.update(); tex.hasAlpha = true;
        const mm = new B.StandardMaterial('crMistMat', scene); mm.disableLighting = true; mm.emissiveColor = new B.Color3(.72, .82, .95); mm.opacityTexture = tex; mm.backFaceCulling = false; mm.alpha = .85;
        const base = keep(B.MeshBuilder.CreatePlane('crMist', { size: 1 }, scene)); base.material = mm; base.isVisible = false; base.billboardMode = B.Mesh.BILLBOARDMODE_ALL;
        mist = { tex, mm, puffs: [] };
        for (let k = 0; k < 18; k++) { const p = base.createInstance('crMist' + k); p.parent = null; p.billboardMode = B.Mesh.BILLBOARDMODE_ALL; nodes.push(p); ctx.add(p); p.parent = null; p.setEnabled(false);
          mist.puffs.push({ m: p, back: (k % 6) * 4.2 + Math.random() * 2, side: (Math.random() - .5) * 13, h: 1.6 + Math.random() * 3.2, s: 7 + Math.random() * 7, ph: Math.random() * 6 }); }
      }
      // a point at route distance s (and the way the route runs there)
      function routeAt(s) {
        s = Math.max(0, Math.min(cum[cum.length - 1], s));
        let i = 1; while (i < cum.length - 1 && cum[i] < s) i++;
        const a = way[i - 1], b = way[i], L = (cum[i] - cum[i - 1]) || 1, u = (s - cum[i - 1]) / L;
        return { x: a.x + (b.x - a.x) * u, z: a.z + (b.z - a.z) * u, dx: (b.x - a.x) / L, dz: (b.z - a.z) / L };
      }
      // how far along the route the player is: the nearest point of the legs from a little behind the last reading to 60 m
      // on (so a route that doubles back is read in order)
      function progress(p) {
        let best = st.sp || 0, bd = Infinity;
        for (let i = 1; i < way.length; i++) {
          if (cum[i] < (st.sp || 0) - 12 || cum[i - 1] > (st.sp || 0) + 60) continue;
          const a = way[i - 1], b = way[i], vx = b.x - a.x, vz = b.z - a.z, L2 = vx * vx + vz * vz || 1;
          const u = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.z - a.z) * vz) / L2)), qx = a.x + vx * u, qz = a.z + vz * u, d = Math.hypot(p.x - qx, p.z - qz);
          if (d < bd) { bd = d; best = cum[i - 1] + Math.sqrt(L2) * u; }
        }
        return (st.sp = Math.max(st.sp || 0, best));
      }
      function showNext() {
        const g = gates[st.next];
        if (!g) { ring.setEnabled(false); beam.setEnabled(false); return; }
        ring.setEnabled(true); beam.setEnabled(true);
        ring.position.set(g.x, g.y + (brazier ? 2.2 : 2.3), g.z); ring.rotation.set(Math.PI / 2, g.yaw, 0);
        beam.position.set(g.x, g.y + 4, g.z);
      }
      function passGate() {
        const g = gates[st.next], k = st.next; g.passed = true; g.sink = 0;
        st.splits.push(+st.el.toFixed(2));
        ctx.sound(k === gates.length - 1 ? 'gamewin' : 'flag');
        if (g.flame) { g.flame.setEnabled(true); g.sink = null; }
        const gs = ghost?.splits?.[k];
        if (gs != null) { const d = st.el - gs, sp = ctx.screenOf(new V3(g.x, g.y + 3, g.z)); if (!sp.behind) H.pop(sp.x, sp.y, (d <= 0 ? '−' : '+') + Math.abs(d).toFixed(1) + ' s', d > 0); }
        st.next++;
        if (st.next >= gates.length) finish(true); else showNext();
      }
      function medalOf(t) { return t <= gold ? 'Gold' : t <= silver ? 'Silver' : t <= bronze ? 'Bronze' : null; }
      function finish(done) {
        if (st.phase === 'done') return; st.phase = 'done'; ctx.player.hold(false);
        ring.setEnabled(false); beam.setEnabled(false);
        const t = st.el, medal = done ? medalOf(t) : null, lines = `Gold ${gold} s · silver ${silver} s · bronze ${bronze} s.`;
        if (done) {
          const prev = ctx.best(), better = !prev || t < prev;
          if (better && st.track.length >= 4) saveGhost(def.id, { p: st.track, splits: st.splits, time: +t.toFixed(2) });
          H.msg(medal ? medal + '!' : 'Finished', 1600, fmt(t) + ' s');
          ctx.finish({ time: t, finished: true, passed: !!medal, kicker: medal ? medal + ' medal' : 'Finished', extra: (medal === 'Gold' ? 'The fastest line. ' : medal ? `${medal === 'Silver' ? 'Gold' : 'Silver'} is ${(medal === 'Silver' ? gold : silver)} s. ` : `Bronze is ${bronze} s: hold R to run. `) + lines });
        } else {
          H.msg(st.caught ? 'The mist closed in' : 'Out of time', 1800);
          ctx.finish({ time: t, finished: false, passed: false, kicker: st.caught ? 'Caught by the mist' : 'Out of time', extra: (st.caught ? 'Keep running: the mist does not stop. ' : 'Hold R to run all the way. ') + lines });
        }
      }
      // the start: on the line facing the first gate, held for the countdown
      const g0 = gates[0], yaw0 = start[2] != null ? start[2] : Math.atan2(g0.x - start[0], g0.z - start[1]);
      ctx.player.placeWorld(start[0], start[1], yaw0);
      ctx.player.hold(true);
      H.title(def.title || 'Village Run'); H.score('0.0'); H.info(`${gates.length} gates · gold ${gold} s`);
      H.hint(`${def.text ? def.text + ' · ' : ''}Hold <kbd>R</kbd> to run · <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> steer · the gold light marks the next gate`);
      showNext();
      return {
        update(dt) {
          const t = performance.now() / 1000;
          // passed gates sink away; lit braziers flicker
          for (const g of gates) {
            if (g.passed && g.sink != null && g.sink < 1) { g.sink = Math.min(1, g.sink + dt * 2.2); g.root.position.y = g.y - g.sink * 5.2; if (g.sink >= 1) g.root.setEnabled(false); }
            if (g.flame?.isEnabled()) g.flame.scaling.set(1, .8 + .25 * Math.sin(t * 13 + g.x), 1);
          }
          if (ring.isEnabled()) { const k = 1 + .08 * Math.sin(t * 6); ring.scaling.set(k, k, k); glowM.alpha = .38 + .16 * Math.sin(t * 6); }
          if (st.phase === 'count') {
            st.t -= dt;
            const n = st.t > 2.4 ? '3' : st.t > 1.4 ? '2' : st.t > .4 ? '1' : 'Go!';
            if (n !== st.said) { st.said = n; H.msg(n, n === 'Go!' ? 700 : 900); ctx.note(n === 'Go!' ? 880 : 440, 'bell'); }
            if (st.t <= .4) { st.phase = 'run'; ctx.player.hold(false); if (ghostNode) ghostNode.setEnabled(true); }
            return;
          }
          if (st.phase !== 'run') return;
          st.el += dt; H.score(fmt(st.el));
          const p = ctx.player.world();
          // the ghost of your best run
          if (ghostNode) {
            const n = ghost.p.length / 2, f = st.el / SAMPLE, i = Math.floor(f);
            if (i >= n - 1) ghostNode.setEnabled(false);
            else { const u = f - i, x = (ghost.p[i * 2] + (ghost.p[i * 2 + 2] - ghost.p[i * 2]) * u) / 10, z = (ghost.p[i * 2 + 1] + (ghost.p[i * 2 + 3] - ghost.p[i * 2 + 1]) * u) / 10;
              ghostNode.position.set(x, ctx.ground(x, z) + 1.7 + .12 * Math.sin(t * 5), z); }
          }
          // your line, for next time's ghost
          if ((st.sampleT -= dt) <= 0) { st.sampleT += SAMPLE; st.track.push(Math.round(p.x * 10), Math.round(p.z * 10)); }
          const g = gates[st.next];
          if (g && Math.hypot(p.x - g.x, p.z - g.z) < R && Math.abs(p.y - g.y) < 5) passGate();
          if (st.phase !== 'run') return;
          let info = `Gate ${Math.min(st.next + 1, gates.length)} / ${gates.length}`;
          if (mist) {
            const sp = progress(p), sm = Math.max(0, (st.el - (def.mist.delay ?? 3)) * (def.mist.speed || 5.5));
            const front = routeAt(sm), nx = -front.dz, nz = front.dx;
            for (const q of mist.puffs) { const b = routeAt(sm - q.back), on = sm > 0;
              q.m.setEnabled(on); if (!on) continue;
              q.m.position.set(b.x + nx * q.side + Math.sin(t * .7 + q.ph) * .8, ctx.ground(b.x, b.z) + q.h, b.z + nz * q.side); q.m.scaling.setAll(q.s * (1 + .08 * Math.sin(t * .9 + q.ph))); }
            const gap = sp - sm; info += sm > 0 ? ` · mist ${Math.max(0, gap).toFixed(0)} m behind` : ' · the mist is coming';
            if (sm > 0 && gap < .5) { st.caught = true; finish(false); return; }
          }
          H.info(info);
          if (st.el > limit) finish(false);
        },
        // the minimap's diamond: the next gate
        target() { const g = gates[st.next]; return g ? { x: g.x, z: g.z } : null; },
        _test: { st, gates, pass: () => passGate(), finish },
        dispose() { ctx.player.hold(false); if (mist) { try { mist.mm.dispose(); mist.tex.dispose(); } catch (e) {} } nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); }
      };
    }
  };
  window.RebelGames.register('course', G);
})();
