// Gather (Oct 15): a roam game (you run with the normal walk, R to run, and the camera follows): collect things round
// the village against the clock. All of them out at once (pick them up in any order), or one at a time in a new order
// each play (the messenger), and with a drop place you carry a few at a time and bring them there. A gold beam marks
// the next one (the minimap points at it). Bronze, silver and gold times.
// def: { items: [[x, z], ...], look: 'sheaf' | 'scroll' | 'flag' | 'post', one (one at a time), drop: [x, z] (bring them
//   here), carry (how many you can hold, with a drop: 3), medals: [gold, silver, bronze] s, limit (s), name ('sheaf'),
//   dropName ('the cart'), dropLook ('cart' | 'line': what fills up at the drop), dropYaw, lineSpan, color [r, g, b], text }
(function () {
  const fmt = t => { const m = Math.floor(t / 60), s = t - m * 60; return m ? `${m}:${s.toFixed(1).padStart(4, '0')}` : s.toFixed(1); };
  const G = {
    title: 'Gather', roam: true,
    start(ctx) {
      const B = ctx.B, H = ctx.HUD, scene = ctx.scene, def = ctx.def, V3 = B.Vector3;
      const med = def.medals || [40, 55, 75], [gold, silver, bronze] = med, limit = def.limit || Math.max(90, Math.round(bronze * 1.6));
      const look = def.look || 'sheaf', name = def.name || look, names = def.names || name + 's', drop = def.drop ? { x: +def.drop[0], z: +def.drop[1] } : null, carryMax = drop ? (def.carry || 3) : Infinity, dropName = def.dropName || 'the drop';
      const PICK = 2.2, DROP = 3.4, col = def.color || [.85, .15, .12];
      const st = { phase: 'count', t: 3.4, el: 0, said: '', got: 0, carried: 0, done: 0, order: [], cur: -1, full: 0 };
      const nodes = [], keep = n => { ctx.add(n); n.parent = null; nodes.push(n); if (n.isPickable !== undefined) n.isPickable = false; return n; };
      const std = (k, c, em, o = {}) => ctx.mat('ga_' + k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(.05, .05, .05); if (em) m.emissiveColor = new B.Color3(...em); if (o.alpha != null) m.alpha = o.alpha; if (o.add) { m.disableLighting = true; m.alphaMode = B.Engine.ALPHA_ADD; m.backFaceCulling = false; } return m; });
      const cyl = (n, h, d0, d1, m, x, y, z, par, tess = 10) => { const c = B.MeshBuilder.CreateCylinder(n, { height: h, diameterTop: d0, diameterBottom: d1, tessellation: tess }, scene); c.material = m; c.position.set(x, y, z); c.parent = par; c.isPickable = false; return c; };
      const straw = std('straw', [.86, .7, .32], [.2, .15, .05]), tie = std('tie', [.45, .3, .14]), wood = std('wood', [.3, .2, .12], [.04, .03, .02]);
      const cloth = std('cloth' + col.join('_'), col, col.map(v => v * .35)), paper = std('paper', [.93, .87, .7], [.2, .18, .13]), lacquer = std('lacquer', [.55, .08, .06], [.1, .01, .01]);
      const FLAGC = [[.85, .2, .15], [.95, .85, .3], [.25, .55, .3], [.92, .92, .9], [.2, .35, .75]];
      function build(i, par) {
        if (look === 'sheaf') { for (let k = 0; k < 7; k++) { const a = k * .9, c = cyl('gaStalk', 1.5, .1, .16, straw, Math.sin(a) * .14, .75, Math.cos(a) * .14, par, 6); c.rotation.set(Math.cos(a) * .12, 0, -Math.sin(a) * .12); }
          cyl('gaTie', .1, .36, .36, tie, 0, .75, 0, par, 12); for (let k = 0; k < 9; k++) { const a = k * .7, h = cyl('gaHead', .5, .02, .1, straw, Math.sin(a) * .26, 1.62, Math.cos(a) * .26, par, 5); h.rotation.set(Math.cos(a) * .6, 0, -Math.sin(a) * .6); } }
        else if (look === 'scroll' || look === 'post') { cyl('gaPole', 2.5, .12, .15, wood, 0, 1.25, 0, par, 6); const s = cyl('gaScroll', .9, .26, .26, paper, 0, 2.62, 0, par, 12); s.rotation.z = Math.PI / 2; for (const e of [-1, 1]) { const c = cyl('gaEnd', .1, .33, .33, lacquer, e * .48, 2.62, 0, par, 12); c.rotation.z = Math.PI / 2; } }
        else { // a prayer flag on a bamboo pole
          cyl('gaPole', 2.6, .07, .09, std('bamboo', [.62, .66, .38], [.08, .09, .04]), 0, 1.3, 0, par, 6);
          const fc = FLAGC[i % FLAGC.length], f = B.MeshBuilder.CreatePlane('gaFlag', { width: .9, height: .62, sideOrientation: B.Mesh.DOUBLESIDE }, scene); f.material = std('flag' + (i % FLAGC.length), fc, fc.map(v => v * .4)); f.parent = par; f.position.set(.48, 2.25, 0); f.isPickable = false; par.flag = f; }
      }
      const items = (def.items || []).map((p, i) => {
        const x = +p[0], z = +p[1], y = ctx.ground(x, z), root = keep(new B.TransformNode('gaItem' + i, scene)); root.position.set(x, y, z); root.rotation.y = (i * 2.399) % 6.28;
        build(i, root); return { x, z, y, root, got: false, ph: i * 1.7 };
      });
      // the drop: a gold ring on the ground
      let dropRing = null;
      if (drop) { drop.y = ctx.ground(drop.x, drop.z); dropRing = keep(B.MeshBuilder.CreateTorus('gaDrop', { diameter: 2 * DROP - .6, thickness: .14, tessellation: 48 }, scene)); dropRing.material = std('dropRing', [0, 0, 0], [1, .82, .4], { alpha: .7, add: true }); dropRing.position.set(drop.x, drop.y + .12, drop.z); }
      const beam = keep(B.MeshBuilder.CreateCylinder('gaBeam', { height: 9, diameterTop: .3, diameterBottom: .9, tessellation: 14, cap: B.Mesh.NO_CAP }, scene)); beam.material = std('beam', [0, 0, 0], [1, .8, .32], { alpha: .26, add: true });
      const puff = keep(B.MeshBuilder.CreateTorus('gaPuff', { diameter: 2, thickness: .1, tessellation: 32 }, scene)); puff.material = std('puff', [0, 0, 0], [1, .9, .55], { alpha: .8, add: true }); puff.setEnabled(false);
      // one at a time: a new order each play, the first one away from you
      if (def.one) { st.order = items.map((_, i) => i).sort(() => Math.random() - .5); items.forEach(it => it.root.setEnabled(false)); st.cur = 0; items[st.order[0]].root.setEnabled(true); }
      const left = () => items.filter(it => !it.got);
      function next() { // where to go now
        const p = ctx.player.world();
        if (drop && (st.carried >= carryMax || (!left().length && st.carried))) return drop;
        if (def.one) { const it = items[st.order[st.cur]]; return it && !it.got ? it : (drop && st.carried ? drop : null); }
        let best = null, bd = Infinity; for (const it of left()) { const d = Math.hypot(it.x - p.x, it.z - p.z); if (d < bd) { bd = d; best = it; } }
        return best || (drop && st.carried ? drop : null);
      }
      const total = items.length;
      // what the drop shows (def.dropLook): 'cart' = a handcart whose bed fills with the sheaves brought in, 'line' = a
      // rope between two poles where each flag brought in is hung; it faces where the run starts (def.dropYaw turns it)
      const shown = [], dropLook = drop && def.dropLook;
      if (dropLook) {
        const w0 = ctx.player.world(), yaw = def.dropYaw ?? Math.atan2(w0.x - drop.x, w0.z - drop.z), cy = Math.cos(yaw), sy = Math.sin(yaw);
        const dr = keep(new B.TransformNode('gaDropLook', scene)); dr.position.set(drop.x, drop.y, drop.z); dr.rotation.y = yaw;
        const gy = (lx, lz) => ctx.ground(drop.x + lx * cy + lz * sy, drop.z - lx * sy + lz * cy) - drop.y; // ground under a local point
        const box = (n, w, h, d, m, x, y, z) => { const b = B.MeshBuilder.CreateBox(n, { width: w, height: h, depth: d }, scene); b.material = m; b.parent = dr; b.position.set(x, y, z); b.isPickable = false; return b; };
        if (dropLook === 'cart') {
          const plank = std('plank', [.52, .37, .22], [.07, .05, .03]);
          box('gaBed', 1.8, .12, 3, plank, 0, 1.05, 0);
          for (const s of [-1, 1]) { box('gaSide', .1, .6, 3, plank, s * .9, 1.4, 0); box('gaEndB', 1.8, .6, .1, plank, 0, 1.4, s * 1.5); }
          for (const s of [-1, 1]) {
            const wh = cyl('gaWheel', .16, 1.5, 1.5, wood, s * 1.04, .75, -.35, dr, 18); wh.rotation.z = Math.PI / 2;
            const hub = cyl('gaHub', .26, .34, .34, tie, s * 1.1, .75, -.35, dr, 10); hub.rotation.z = Math.PI / 2;
            const h = box('gaHandle', .12, .12, 2.1, wood, s * .62, 1.02, 2.5); h.rotation.x = .1;
            box('gaLeg', .12, 1, .12, wood, s * .75, .5, 1.3);
          }
          const ax = cyl('gaAxle', 2.3, .1, .1, wood, 0, .75, -.35, dr, 8); ax.rotation.z = Math.PI / 2;
          // the load: one merged sheaf per slot, layers of 4, 3, 2, 1 lying along the bed
          let L = 0, j = 0;
          for (let k = 0; k < total; k++) {
            const nL = Math.max(1, 4 - (L % 4)), parts = [];
            for (let q = 0; q < 7; q++) { const a = q * .9, c = cyl('gaStalk', 1.5, .1, .16, straw, Math.sin(a) * .14, .75, Math.cos(a) * .14, null, 6); c.rotation.set(Math.cos(a) * .12, 0, -Math.sin(a) * .12); parts.push(c); }
            for (let q = 0; q < 9; q++) { const a = q * .7, c = cyl('gaHead', .5, .02, .1, straw, Math.sin(a) * .26, 1.62, Math.cos(a) * .26, null, 5); c.rotation.set(Math.cos(a) * .6, 0, -Math.sin(a) * .6); parts.push(c); }
            const m = B.Mesh.MergeMeshes(parts, true, true); m.isPickable = false; m.parent = dr;
            cyl('gaTie', .1, .36, .36, tie, 0, .75, 0, m, 12);
            m.rotation.set(Math.PI / 2, 0, 0); m.position.set((j - (nL - 1) / 2) * .4, 1.32 + L * .34, -.95 + (L % 2 ? .22 : -.08));
            m.setEnabled(false); shown.push(m);
            if (++j >= nL) { j = 0; L++; }
          }
        } else {
          const span = def.lineSpan || 7, top = 5.2, sag = .7, bamboo = std('bamboo', [.62, .66, .38], [.08, .09, .04]);
          const at = u => top - sag * 4 * u * (1 - u);
          for (const s of [-1, 1]) { const g = gy(s * span / 2, 0); cyl('gaLinePole', top + .3 - g, .1, .13, bamboo, s * span / 2, g + (top + .3 - g) / 2, 0, dr, 8); }
          const path = []; for (let k = 0; k <= 16; k++) path.push(new V3((k / 16 - .5) * span, at(k / 16), 0));
          const rope = B.MeshBuilder.CreateTube('gaRope', { path, radius: .035, tessellation: 6 }, scene); rope.material = tie; rope.parent = dr; rope.isPickable = false;
          for (let k = 0; k < total; k++) {
            const u = (k + 1) / (total + 1), fc = FLAGC[k % FLAGC.length], hg = new B.TransformNode('gaHang', scene); hg.parent = dr; hg.position.set((u - .5) * span, at(u), 0);
            const f = B.MeshBuilder.CreatePlane('gaHung', { width: .62, height: .78, sideOrientation: B.Mesh.DOUBLESIDE }, scene);
            f.material = std('flag' + (k % FLAGC.length), fc, fc.map(v => v * .4)); f.parent = hg; f.position.y = -.4; f.isPickable = false;
            hg.setEnabled(false); hg.ph = k * 1.3; shown.push(hg);
          }
        }
      }
      function hud() {
        H.score(fmt(st.el));
        const got = drop ? st.done : st.got;
        H.info(drop ? `${st.done} / ${total} at ${dropName} · carrying ${st.carried}${carryMax < Infinity ? ' / ' + carryMax : ''}` : `${got} / ${total} ${names}`);
      }
      function pick(it) {
        it.got = true; st.got++; it.gone = 0;
        if (drop) st.carried++;
        ctx.sound(drop ? 'flag' : st.got >= total ? 'gamewin' : 'flag');
        puff.setEnabled(true); puff.position.set(it.x, it.y + 1.2, it.z); puff.scaling.setAll(.5); st.puff = 0;
        const sp = ctx.screenOf(new V3(it.x, it.y + 2.6, it.z)); if (!sp.behind) H.pop(sp.x, sp.y, drop ? `${st.carried}${carryMax < Infinity ? ' / ' + carryMax : ''}` : `${st.got} / ${total}`);
        if (def.one) { st.cur++; const n = items[st.order[st.cur]]; if (n) { n.root.setEnabled(true); n.root.scaling.setAll(.01); n.pop = 0; } }
        if (!drop && st.got >= total) finish(true);
      }
      function deliver() {
        for (let k = st.done; k < Math.min(shown.length, st.done + st.carried); k++) { shown[k].setEnabled(true); shown[k].scaling.setAll(.01); shown[k].pop = -(k - st.done) * .12; }
        st.done += st.carried; const n = st.carried; st.carried = 0;
        ctx.sound(st.done >= total ? 'gamewin' : 'strike');
        const sp = ctx.screenOf(new V3(drop.x, drop.y + 2.4, drop.z)); if (!sp.behind) H.pop(sp.x, sp.y, `+${n} · ${st.done} / ${total}`);
        if (st.done >= total) finish(true);
      }
      function medalOf(t) { return t <= gold ? 'Gold' : t <= silver ? 'Silver' : t <= bronze ? 'Bronze' : null; }
      function finish(done) {
        if (st.phase === 'done') return; st.phase = 'done'; ctx.player.hold(false); beam.setEnabled(false); hud();
        const t = st.el, medal = done ? medalOf(t) : null, lines = `Gold ${gold} s · silver ${silver} s · bronze ${bronze} s.`;
        if (done) { H.msg(medal ? medal + '!' : 'All in', 1600, fmt(t) + ' s');
          ctx.finish({ time: t, finished: true, passed: !!medal, kicker: medal ? medal + ' medal' : 'Done', extra: (medal === 'Gold' ? 'The quickest round there is. ' : medal ? `${medal === 'Silver' ? 'Gold' : 'Silver'} is ${medal === 'Silver' ? gold : silver} s. ` : 'Hold R to run, and plan the shortest way round. ') + lines }); }
        else { H.msg('Out of time', 1800, `${drop ? st.done : st.got} of ${total}`);
          ctx.finish({ time: t, finished: false, passed: false, kicker: 'Out of time', extra: `${drop ? st.done : st.got} of ${total} ${names}. ` + lines }); }
      }
      ctx.player.hold(true);
      H.title(def.title || 'Gather'); hud(); H.info(`${total} ${names} · gold ${gold} s`);
      H.hint(`${def.text ? def.text + ' · ' : ''}Hold <kbd>R</kbd> to run · run over ${def.one ? 'each one as it appears' : 'them to pick them up'}${drop ? ` · bring them to ${dropName} (${carryMax} at a time)` : ''}`);
      return {
        update(dt) {
          const t = performance.now() / 1000, p = ctx.player.world();
          for (const it of items) {
            if (it.got) { if (it.gone != null && it.gone < 1) { it.gone = Math.min(1, it.gone + dt * 5); it.root.scaling.setAll(Math.max(.01, 1 - it.gone)); it.root.position.y = it.y + it.gone * 1.4; if (it.gone >= 1) it.root.setEnabled(false); } continue; }
            if (it.pop != null) { it.pop = Math.min(1, it.pop + dt * 4); it.root.scaling.setAll(.01 + .99 * it.pop); if (it.pop >= 1) it.pop = null; }
            if (it.root.flag) it.root.flag.rotation.y = .25 * Math.sin(t * 3 + it.ph);
            it.root.position.y = it.y + (look === 'scroll' ? .12 * Math.sin(t * 2.2 + it.ph) : 0);
          }
          if (dropRing) { const k = 1 + .05 * Math.sin(t * 5); dropRing.scaling.set(k, 1, k); }
          for (const s of shown) { if (s.pop != null) { s.pop = Math.min(1, s.pop + dt * 4); s.scaling.setAll(.01 + .99 * Math.max(0, s.pop)); if (s.pop >= 1) s.pop = null; } if (s.ph != null) s.rotation.x = .22 * Math.sin(t * 2.4 + s.ph); }
          if (st.puff != null) { st.puff += dt; puff.scaling.setAll(.5 + st.puff * 5); puff.material.alpha = Math.max(0, .8 - st.puff * 1.6); if (st.puff > .5) { puff.setEnabled(false); st.puff = null; } }
          if (st.phase === 'count') {
            st.t -= dt;
            const n = st.t > 2.4 ? '3' : st.t > 1.4 ? '2' : st.t > .4 ? '1' : 'Go!';
            if (n !== st.said) { st.said = n; H.msg(n, n === 'Go!' ? 700 : 900); ctx.note(n === 'Go!' ? 880 : 440, 'bell'); }
            if (st.t <= .4) { st.phase = 'run'; ctx.player.hold(false); }
          } else if (st.phase === 'run') {
            st.el += dt;
            for (const it of items) {
              if (it.got || (def.one && it !== items[st.order[st.cur]])) continue;
              if (Math.hypot(it.x - p.x, it.z - p.z) < PICK && Math.abs(p.y - it.y) < 2.5) {
                if (st.carried >= carryMax) { if ((st.full -= dt) <= 0) { st.full = 2.5; H.msg(`Hands full: to ${dropName}`, 1200); } continue; }
                pick(it); if (st.phase !== 'run') return;
              }
            }
            if (drop && st.carried && Math.hypot(drop.x - p.x, drop.z - p.z) < DROP && Math.abs(p.y - drop.y) < 2.5) { deliver(); if (st.phase !== 'run') return; }
            hud();
            if (st.el > limit) { finish(false); return; }
          }
          const n = next(); if (n && st.phase !== 'done') { beam.setEnabled(true); beam.position.set(n.x, (n.y ?? 0) + 7, n.z); beam.material.alpha = .2 + .1 * Math.sin(t * 6); } else beam.setEnabled(false);
        },
        target() { const n = next(); return n ? { x: n.x, z: n.z } : null; },
        _test: { st, items, next, finish, drop, shown },
        dispose() { ctx.player.hold(false); nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); }
      };
    }
  };
  window.RebelGames.register('gather', G);
})();
