// Catch Me (Oct 15): a chase, a roam game (you run with the normal walk, R to run, and the camera follows). A critter (a
// thief, a chicken, a mini ant, a spirit...) runs a loop through part of the village; run into it to tag it, as many
// times as the game asks, before the clock runs out. It sprints when you come near, tires after a while, doubles back
// when you cut it off and side-steps a lunge; each tag makes the next one faster. A gold beam marks it from afar and the
// minimap points at it. Bronze, silver and gold times.
// def: { loop: [[x, z], ...] a closed walkable loop (the route tool's taut line, 1 m clear either side), look: 'thief' |
//   'chicken' | 'ant' | 'wisp' | 'kit:<type>', count (critters out at once, 1), catches (tags to make, 3), limit (s),
//   medals: [gold, silver, bronze] s, speed: [first, last] sprint speeds in m/s (the player runs 8.4: you close in while it
//   rests), alert (m, 18), color / trim [r, g, b],
//   carry: 'scroll' | 'lantern' | 'banana' | 'gold' | 'sword' | null (what it holds; carryAt [x, y, z] on a kit critter),
//   yawOff (a kit critter's turn: a crab runs sideways), height (m, for the beam), scale, name ('the thief'), text,
//   erratic (0-1: random turns, chickens), npcModel (keys, a thief's), antModel / antSize (the mini ant's), modelYaw }
// The real look (Oct 17, Miguel: the thief and the spy "need to look way better", the Hub ant "more realistic" with
// better animations): a thief or spy is that village's forged villager (the NPC library's <village>_villager), the mini
// ant the village's own small-ant model; each takes over from the stand-in once loaded and runs on its own clips.
(function () {
  const fmt = t => { const m = Math.floor(t / 60), s = t - m * 60; return m ? `${m}:${s.toFixed(1).padStart(4, '0')}` : s.toFixed(1); };
  const G = {
    title: 'Catch Me', roam: true,
    start(ctx) {
      const B = ctx.B, H = ctx.HUD, scene = ctx.scene, def = ctx.def, V3 = B.Vector3;
      const loop = (def.loop || []).map(p => ({ x: +p[0], z: +p[1] }));
      if (loop.length < 3) throw new Error('chase: no loop');
      if (Math.hypot(loop[0].x - loop[loop.length - 1].x, loop[0].z - loop[loop.length - 1].z) < .5) loop.pop();
      const cum = [0]; for (let i = 1; i <= loop.length; i++) { const a = loop[i - 1], b = loop[i % loop.length]; cum.push(cum[i - 1] + Math.hypot(b.x - a.x, b.z - a.z)); }
      const L = cum[loop.length];
      const med = def.medals || [45, 60, 80], [gold, silver, bronze] = med, limit = def.limit || Math.max(90, Math.round(bronze * 1.5));
      const catches = def.catches || 3, count = Math.min(def.count || 1, catches), speed = def.speed || [8.8, 9.6], lane = def.lane ?? .8, ALERT = def.alert || 18;
      const name = def.name || 'it', CATCH = 1.9;
      const st = { phase: 'count', t: 3.4, el: 0, said: '', caught: 0, out: 0, pause: 0 };
      const nodes = [], keep = n => { ctx.add(n); n.parent = null; nodes.push(n); if (n.isPickable !== undefined) n.isPickable = false; return n; };
      const std = (k, c, em, o = {}) => ctx.mat('ch_' + k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(o.spec ?? .06, o.spec ?? .06, o.spec ?? .06); if (em) m.emissiveColor = new B.Color3(...em); if (o.alpha != null) m.alpha = o.alpha; if (o.add) { m.disableLighting = true; m.alphaMode = B.Engine.ALPHA_ADD; m.backFaceCulling = false; } return m; });
      const glowM = std('glow', [0, 0, 0], [1, .8, .32], { alpha: .3, add: true });
      // a point at loop distance s (wrapping) and the way the loop runs there
      function at(s) {
        s = ((s % L) + L) % L;
        let lo = 0, hi = loop.length; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
        const a = loop[lo], b = loop[(lo + 1) % loop.length], l = (cum[lo + 1] - cum[lo]) || 1, u = (s - cum[lo]) / l;
        return { x: a.x + (b.x - a.x) * u, z: a.z + (b.z - a.z) * u, dx: (b.x - a.x) / l, dz: (b.z - a.z) / l };
      }
      // the loop distance nearest a point
      function nearestS(p) {
        let best = 0, bd = Infinity;
        for (let i = 0; i < loop.length; i++) { const a = loop[i], b = loop[(i + 1) % loop.length], vx = b.x - a.x, vz = b.z - a.z, l2 = vx * vx + vz * vz || 1;
          const u = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.z - a.z) * vz) / l2)), d = Math.hypot(p.x - a.x - vx * u, p.z - a.z - vz * u);
          if (d < bd) { bd = d; best = cum[i] + Math.sqrt(l2) * u; } }
        return best;
      }
      // ── the critters (built facing +z; legs / wings / arms on pivots) ──
      const look = def.look || 'thief', col = def.color, trim = def.trim;
      const sph = (n, d, m, x, y, z, sx = 1, sy = 1, sz = 1, par) => { const s = B.MeshBuilder.CreateSphere(n, { diameter: d, segments: 10 }, scene); s.material = m; s.position.set(x, y, z); s.scaling.set(sx, sy, sz); s.parent = par; s.isPickable = false; return s; };
      const cyl = (n, h, d0, d1, m, x, y, z, par, rx = 0, rz = 0) => { const c = B.MeshBuilder.CreateCylinder(n, { height: h, diameterTop: d0, diameterBottom: d1, tessellation: 10 }, scene); c.material = m; c.position.set(x, y, z); c.rotation.set(rx, 0, rz); c.parent = par; c.isPickable = false; return c; };
      const pivot = (n, par, x, y, z) => { const t = new B.TransformNode(n, scene); t.parent = par; t.position.set(x, y, z); return t; };
      function carryItem(par, kind) {
        if (kind === 'scroll') { const s = cyl('chScroll', .62, .13, .13, std('paper', [.93, .87, .7], [.18, .16, .12]), 0, 0, 0, par, 0, Math.PI / 2); for (const e of [-1, 1]) cyl('chScrollEnd', .07, .17, .17, std('lacquer', [.55, .08, .06], [.1, .01, .01]), e * .33, 0, 0, par, 0, Math.PI / 2); return s; }
        if (kind === 'lantern') { const m = std('lamp', [1, .7, .3], [1, .55, .18]); const b = B.MeshBuilder.CreateBox('chLamp', { width: .26, height: .34, depth: .26 }, scene); b.material = m; b.parent = par; b.position.y = -.2; cyl('chLampTop', .06, .3, .3, std('ironD', [.12, .11, .1]), 0, -.01, 0, par); return b; }
        if (kind === 'banana') { const path = []; for (let i = 0; i <= 8; i++) { const a = -.9 + i * .225; path.push(new V3(Math.sin(a) * .3, Math.cos(a) * .3 - .3, 0)); }
          const t = B.MeshBuilder.CreateTube('chBanana', { path, radiusFunction: (i, d) => .035 + .055 * Math.sin(Math.PI * i / 8), tessellation: 8 }, scene); t.material = std('banana', [.98, .82, .18], [.25, .2, .03]); t.parent = par; return t; }
        if (kind === 'sword') { const g = new B.TransformNode('chSword', scene); g.parent = par; g.rotation.x = -.5;
          const bl = B.MeshBuilder.CreateBox('chBlade', { width: .05, height: 1.15, depth: .1 }, scene); bl.material = std('steel', [.78, .8, .84], [.12, .12, .14], { spec: .9 }); bl.parent = g; bl.position.y = .72;
          cyl('chHilt', .34, .07, .07, std('wrap', [.08, .06, .08]), 0, 0, 0, g); const gd = B.MeshBuilder.CreateBox('chGuard', { width: .18, height: .03, depth: .18 }, scene); gd.material = std('goldBar', [1, .8, .3], [.45, .32, .08], { spec: .6 }); gd.parent = g; gd.position.y = .17; return g; }
        if (kind === 'gold') { const g = B.MeshBuilder.CreateBox('chGold', { width: .4, height: .2, depth: .24 }, scene); g.material = std('goldBar', [1, .8, .3], [.45, .32, .08], { spec: .6 }); g.parent = par; return g; }
        return null;
      }
      function makeCritter(i) {
        const root = keep(new B.TransformNode('chCritter' + i, scene)), body = pivot('chBody' + i, root, 0, 0, 0), c = { root, body, legs: [], wings: [], arms: [], trail: [], k: look };
        const sc = def.scale || 1;
        if (look === 'ant') {
          const m = std('ant' + (col || [.45, .12, .08]).join('_'), col || [.45, .12, .08], (col || [.45, .12, .08]).map(v => v * .18), { spec: .35 }), eyeM = std('antEye' + (trim || [0, 0, 0]).join('_'), [.02, .02, .02], trim || [0, 0, 0], { spec: .8 });
          sph('chAbd', .9, m, 0, .78, -.78, 1, .82, 1.3, body); sph('chTho', .5, m, 0, .76, 0, 1, .9, 1.15, body); const head = pivot('chHead', body, 0, .9, .5); sph('chHd', .62, m, 0, 0, 0, 1, .92, 1, head);
          for (const s of [-1, 1]) { sph('chEye', .16, eyeM, s * .2, .07, .22, 1, 1, 1, head); const an = cyl('chAnt', .7, .03, .04, m, s * .14, .45, .2, head, -.55, -s * .35); sph('chAntTip', .08, m, 0, .36, 0, 1, 1, 1, an); }
          for (let k = 0; k < 6; k++) { const s = k < 3 ? -1 : 1, row = k % 3, p = pivot('chLeg' + k, body, s * .16, .7, .16 - row * .18);
            cyl('chLegU', .56, .05, .06, m, s * .24, .1, 0, p, 0, s * 1.1); cyl('chLegL', .7, .03, .05, m, s * .5, -.32, 0, p, 0, s * .25); p.phase = (row % 2 === 0) === (s < 0) ? 0 : Math.PI; c.legs.push(p); }
          c.height = 1.2;
        } else if (look === 'chicken') {
          const feathers = col || [.95, .93, .88], fM = std('hen' + feathers.join('_'), feathers, feathers.map(v => v * .2)), red = std('comb', [.85, .12, .1], [.2, .02, .02]), yel = std('beak', [.98, .7, .15], [.2, .12, .02]), eye = std('henEye', [.02, .02, .02]);
          sph('chHen', 1.1, fM, 0, .95, 0, .82, .82, 1.1, body); sph('chTail', .6, fM, 0, 1.25, -.52, .45, 1, .6, body);
          const head = pivot('chHead', body, 0, 1.45, .45); sph('chHd', .48, fM, 0, 0, 0, 1, 1, 1, head);
          for (let k = 0; k < 3; k++) sph('chComb', .16, red, 0, .26 + (k === 1 ? .04 : 0), -.08 + k * .09, .6, 1, 1, head);
          sph('chWattle', .14, red, 0, -.2, .2, .7, 1.2, .8, head); cyl('chBeak', .2, 0, .14, yel, 0, -.03, .3, head, Math.PI / 2, 0);
          for (const s of [-1, 1]) { sph('chEye', .07, eye, s * .17, .06, .14, 1, 1, 1, head); const w = pivot('chWing', body, s * .42, 1.05, 0); sph('chWingM', .62, fM, s * .04, -.05, 0, .25, .7, 1, w); w.side = s; c.wings.push(w);
            const lg = pivot('chLeg', body, s * .18, .55, 0); cyl('chShin', .55, .06, .07, yel, 0, -.27, 0, lg); cyl('chFoot', .26, .03, .05, yel, 0, -.55, .1, lg, Math.PI / 2, 0); lg.phase = s < 0 ? 0 : Math.PI; c.legs.push(lg); }
          c.height = 1.6; c.head = head;
        } else if (look === 'wisp') {
          const core = std('wispCore', [0, 0, 0], col || [.62, .88, 1], { alpha: .95, add: true }), halo = std('wispHalo', [0, 0, 0], (col || [.62, .88, 1]).map(v => v * .4), { alpha: .22, add: true });
          sph('chWisp', .55, core, 0, 1.6, 0, 1, 1, 1, body); sph('chWispHalo', 1.25, halo, 0, 1.6, 0, 1, 1, 1, body); sph('chWispHalo2', .85, halo, 0, 1.6, 0, 1, 1, 1, body);
          for (let k = 0; k < 5; k++) { const t = sph('chTrail', .36 - k * .06, k < 2 ? core : halo, 0, 0, 0); keep(t); c.trail.push(t); }
          c.height = 2;
        } else if (look.startsWith('kit:')) {
          const n = ctx.kit(look.slice(4)); n.parent = body; n.position.set(0, 0, 0); n.rotation.y = Math.PI + (def.yawOff || 0); c.kit = n; c.height = def.height || 3;
          if (def.carry) { const ca = def.carryAt || [.55, 1.6, .55], hand = pivot('chHand', body, ca[0], ca[1], ca[2]); c.item = carryItem(hand, def.carry); }
        } else { // the thief: a hooded runner
          const cloth = col || [.12, .12, .16], dark = std('thief' + cloth.join('_'), cloth, cloth.map(v => v * .15)), skin = std('mask', [.05, .05, .06]), band = std('band' + (trim || [.6, .1, .1]).join('_'), trim || [.6, .1, .1], (trim || [.6, .1, .1]).map(v => v * .3)), eyeM = std('thiefEye', [.9, .9, .85], [.6, .6, .55]);
          cyl('chTorso', 1.1, .72, .62, dark, 0, 1.95, 0, body); cyl('chBelt', .14, .66, .66, band, 0, 1.45, 0, body);
          const head = pivot('chHead', body, 0, 2.78, .02); sph('chHood', .78, dark, 0, 0, 0, 1, 1.05, 1.05, head); sph('chFace', .56, skin, 0, -.02, .16, 1, .9, .9, head);
          for (const s of [-1, 1]) { const e = B.MeshBuilder.CreateBox('chEye', { width: .13, height: .05, depth: .04 }, scene); e.material = eyeM; e.parent = head; e.position.set(s * .11, .04, .42); }
          const scarf = B.MeshBuilder.CreatePlane('chScarf', { width: .3, height: 1, sideOrientation: B.Mesh.DOUBLESIDE }, scene); scarf.material = band; const sp = pivot('chScarfP', body, 0, 2.48, -.3); scarf.parent = sp; scarf.position.y = -.5; c.scarf = sp;
          for (const s of [-1, 1]) {
            const lg = pivot('chLeg', body, s * .2, 1.42, 0); cyl('chThigh', .72, .26, .22, dark, 0, -.36, 0, lg); const kn = pivot('chKnee', lg, 0, -.72, 0); cyl('chShin', .7, .2, .16, dark, 0, -.35, 0, kn); cyl('chBoot', .2, .2, .24, skin, 0, -.7, .06, kn);
            lg.phase = s < 0 ? 0 : Math.PI; lg.knee = kn; c.legs.push(lg);
            const ar = pivot('chArm', body, s * .44, 2.38, 0); cyl('chUpper', .62, .18, .15, dark, 0, -.3, 0, ar); const hand = pivot('chHand', ar, 0, -.66, .06); sph('chFist', .2, skin, 0, 0, 0, 1, 1, 1, hand);
            ar.phase = s < 0 ? Math.PI : 0; c.arms.push(ar);
            if (s > 0 && def.carry) c.item = carryItem(hand, def.carry);
          }
          c.height = 3.1; c.head = head;
        }
        root.scaling.setAll(sc); c.height *= sc;
        return c;
      }
      // the beam over the one you chase, and the burst when you tag it
      const beam = keep(B.MeshBuilder.CreateCylinder('chBeam', { height: 9, diameterTop: .3, diameterBottom: .9, tessellation: 16, cap: B.Mesh.NO_CAP }, scene)); beam.material = glowM;
      const burst = keep(B.MeshBuilder.CreateTorus('chBurst', { diameter: 2, thickness: .12, tessellation: 40 }, scene)); burst.material = std('burst', [0, 0, 0], [1, .9, .5], { alpha: .8, add: true }); burst.setEnabled(false);
      const crit = [];
      function far() { // a loop point about 40 m from the player (or as far as the loop goes), away from the others
        const p = ctx.player.world(); let best = 0, bd = -Infinity;
        for (let k = 0; k < 48; k++) { const s = k * L / 48, q = at(s), d = Math.hypot(q.x - p.x, q.z - p.z); let score = -Math.abs(Math.min(d, 60) - 40) + Math.random() * 3;
          for (const c of crit) if (c.on) score -= Math.max(0, 14 - Math.hypot(q.x - c.x, q.z - c.z)) * 2;
          if (score > bd) { bd = score; best = s; } }
        return best;
      }
      function spawn(c, s) {
        c.s = s; c.dir = Math.random() < .5 ? 1 : -1; c.on = true; c.v = 0; c.lat = 0; c.latT = 0; c.stam = 1; c.tired = 0; c.juke = 0; c.jukeCd = 0; c.swCd = 0; c.flip = 2 + Math.random() * 2; c.gait = 0; c.pop = 0; c.hop = 0;
        const q = at(s); c.x = q.x; c.z = q.z; c.yaw = Math.atan2(q.dx * c.dir, q.dz * c.dir); c.root.setEnabled(true); c.root.scaling.setAll(.01); c.pop = 1e-3;
        c.trail.forEach(t => t.setEnabled(true));
      }
      for (let i = 0; i < count; i++) { const c = makeCritter(i); crit.push(c); c.root.setEnabled(false); }
      // the real look (see the top), loaded one after another
      const modelOf = look === 'thief' ? () => ctx.npcModel?.(def.npcModel || [ctx.village + '_villager'])
        : look === 'ant' ? () => ctx.model?.(def.antModel || 'assets/village-life/small-ant/small-village-ant.glb', { size: def.antSize || 2.2, name: 'ant' }) : null;
      if (modelOf) (async () => { for (const c of crit) { const m = await modelOf(); if (!m || st.phase === 'done') return; attachModel(c, m); } })();
      function attachModel(c, m) {
        c.model = m; m.root.parent = c.root; m.root.position.set(0, 0, 0); m.root.rotation.y = def.modelYaw ?? 0;
        const item = c.item; c.body.getChildMeshes(false).forEach(x => { if (!item || (x !== item && !x.isDescendantOf(item))) x.setEnabled(false); });
        const hand = item && m.bone('mixamorig_RightHand');
        if (hand) { // the loot in its right fist, at the critter's own scale
          c.root.computeWorldMatrix(true); hand.computeWorldMatrix(true);
          const hold = new B.TransformNode('chItemHold', scene); hold.parent = hand; ctx.add(hold); hold.scaling.setAll((c.root.scaling.x || 1) / Math.max(1e-4, hand.absoluteScaling.x));
          item.parent = hold; item.position.set(0, .1, .05);
        }
      }
      // the first ones: ahead of you along the loop, spread round it
      { const s0 = nearestS(ctx.player.world()); crit.forEach((c, i) => spawn(c, s0 + 14 + i * L / Math.max(2, count + 1))); st.out = count; }
      const roundSpeed = () => speed[0] + (speed[1] - speed[0]) * (catches > 1 ? Math.min(1, st.caught / (catches - 1)) : 0);
      function tag(c) {
        c.on = false; c.gone = 0; st.caught++; st.out--;
        const sp = ctx.screenOf(new V3(c.x, c.y + c.height + .4, c.z));
        if (!sp.behind) H.pop(sp.x, sp.y, `Tagged ${st.caught} / ${catches}`);
        burst.setEnabled(true); burst.position.set(c.x, c.y + .3, c.z); burst.scaling.setAll(.4); burst.material.alpha = .9; st.burst = 0;
        ctx.sound(st.caught >= catches ? 'gamewin' : 'flag');
        if (st.caught >= catches) { finish(true); return; }
        if (st.caught + st.out < catches) { c.respawn = 1.1; }
      }
      function medalOf(t) { return t <= gold ? 'Gold' : t <= silver ? 'Silver' : t <= bronze ? 'Bronze' : null; }
      function finish(done) {
        if (st.phase === 'done') return; st.phase = 'done'; ctx.player.hold(false); beam.setEnabled(false); H.info(`Tagged ${st.caught} / ${catches}`);
        const t = st.el, medal = done ? medalOf(t) : null, lines = `Gold ${gold} s · silver ${silver} s · bronze ${bronze} s.`;
        if (done) { H.msg(medal ? medal + '!' : 'Got ' + (catches > 1 ? 'them all' : name), 1600, fmt(t) + ' s');
          ctx.finish({ time: t, finished: true, passed: !!medal, kicker: medal ? medal + ' medal' : 'Caught', extra: (medal === 'Gold' ? 'Nothing gets away from you. ' : medal ? `${medal === 'Silver' ? 'Gold' : 'Silver'} is ${medal === 'Silver' ? gold : silver} s. ` : 'Run (hold R) and cut across the loop when it turns. ') + lines }); }
        else { H.msg('Out of time', 1800, `${st.caught} of ${catches}`);
          ctx.finish({ time: t, finished: false, passed: false, kicker: 'Out of time', extra: `${st.caught} of ${catches} tagged. It tires after a sprint: that is when to close in. ` + lines }); }
      }
      ctx.player.hold(true);
      H.title(def.title || 'Catch Me'); H.score('0.0'); H.info(`Tag ${catches > 1 ? catches + (count > 1 ? '' : ' times') : 'it'} · gold ${gold} s`);
      H.hint(`${def.text ? def.text + ' · ' : ''}Hold <kbd>R</kbd> to run · run into ${name} to tag ${count > 1 ? 'each one' : 'it'} · the gold beam marks it`);
      // ── each frame ──
      function move(c, dt, t, p) {
        const dP = Math.hypot(p.x - c.x, p.z - c.z), chased = st.phase === 'run' && dP < ALERT;
        // which way along the loop: away from you (probe both ways); doubling back when you cut it off, not too often
        c.swCd -= dt; c.jukeCd -= dt; c.flip -= dt;
        if (chased) {
          const a = at(c.s + 5 * c.dir), b = at(c.s - 5 * c.dir), da = Math.hypot(a.x - p.x, a.z - p.z), db = Math.hypot(b.x - p.x, b.z - p.z);
          if (db > da + 1.2 && c.swCd <= 0) { c.dir = -c.dir; c.swCd = 1.1; c.v *= .35; }
          if (def.erratic && c.flip <= 0) { c.flip = 1.6 + Math.random() * 2.4; if (Math.random() < def.erratic && dP > 5) { c.dir = -c.dir; c.swCd = .8; c.v *= .3; c.hop = .5; } }
        }
        // speed: amble when far, sprint when chased until tired, then a short rest; a dart to the side when you lunge
        let want = 1.3;
        if (chased) {
          const k = catches > 1 ? Math.min(1, st.caught / (catches - 1)) : 0;
          if (c.tired > 0) { c.tired -= dt; want = roundSpeed() * .4; }
          else { want = roundSpeed(); c.stam -= dt / 3.4; if (c.stam <= 0) { c.tired = 1.4 - .3 * k; c.stam = 1; c.puff = .6; } }
          if (dP < 3.2 && c.jukeCd <= 0 && c.tired <= 0) { c.jukeCd = 2.3; c.juke = .45; c.latT = Math.sign(((p.x - c.x) * -at(c.s).dz + (p.z - c.z) * at(c.s).dx) || 1) * -lane; c.hop = .35; }
        } else c.stam = Math.min(1, c.stam + dt / 2);
        if (c.juke > 0) { c.juke -= dt; want = Math.max(want, roundSpeed() * 1.55); }
        if (st.phase !== 'run') want = 0;
        c.v += (want - c.v) * Math.min(1, dt * (want > c.v ? 3.2 : 5));
        c.s += c.dir * c.v * dt;
        c.lat += (c.latT - c.lat) * Math.min(1, dt * 6); if (c.juke <= 0) c.latT *= Math.max(0, 1 - dt * .8);
        const q = at(c.s), nx = -q.dz, nz = q.dx, x = q.x + nx * c.lat, z = q.z + nz * c.lat;
        const mv = Math.hypot(x - c.x, z - c.z);
        if (mv > .01) { const yaw = Math.atan2(x - c.x, z - c.z); let dy = yaw - c.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); c.yaw += dy * Math.min(1, dt * 10); }
        else if (!chased) { const yaw = Math.atan2(p.x - c.x, p.z - c.z); let dy = yaw - c.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); c.yaw += dy * Math.min(1, dt * 3); }
        c.x = x; c.z = z; c.y = ctx.ground(x, z);
        // the body: hops, a gait from the speed
        c.hop = Math.max(0, c.hop - dt); const hopY = c.hop > 0 ? Math.sin(Math.PI * c.hop / .5) * (look === 'chicken' ? .55 : .4) : 0;
        const sp = c.v, A = Math.min(1, sp / 3), sc = c.root.scaling.y;
        c.gait += dt * sp / (look === 'ant' ? .9 : look === 'chicken' ? .7 : 2.6) * Math.PI * 2 / Math.max(.4, sc);
        const g = c.gait, bob = Math.abs(Math.sin(g)) * .09 * A;
        if (look === 'wisp') { c.body.position.y = .25 * Math.sin(t * 2.4 + c.s) + hopY; c.body.rotation.y = t * 2; }
        else if (!c.kit) { c.body.position.y = bob + hopY; c.body.rotation.x = .12 * A + (look === 'thief' ? .18 * Math.min(1, sp / 7) : 0);
          if (look === 'chicken') c.body.rotation.z = .16 * A * Math.sin(g); } // a hen waddles side to side
        else { // a kit critter (the crab) scuttles: a quick bounce and rock on every step
          c.body.position.y = hopY + Math.abs(Math.sin(g * 1.6)) * .12 * A; c.body.rotation.z = .14 * A * Math.sin(g * 1.6); c.body.rotation.x = .06 * A * Math.sin(g * 3.2); }
        c.root.position.set(c.x, c.y, c.z); c.root.rotation.y = c.yaw;
        if (c.model) { // its own clips: idle, walk, run (the ant: Idle / Walk, sped up with the chase)
          const ant = look === 'ant', want = sp < .3 ? (ant ? 'Idle' : 'idle') : ant ? 'Walk' : sp > 3.2 ? 'run' : 'walk';
          c.model.play(want, { loop: true, speed: ant ? Math.max(.8, Math.min(3.5, sp / 1.6)) : want === 'run' ? Math.max(.8, Math.min(1.9, sp / 5.5)) : Math.max(.7, Math.min(1.6, sp / 1.4)) });
          c.model.root.position.y = hopY;
        }
        for (const l of c.legs) {
          if (look === 'ant') { const s = Math.sin(g + l.phase); l.rotation.y = .45 * A * s; l.rotation.z = .2 * A * Math.max(0, Math.cos(g + l.phase)) * Math.sign(l.position.x); }
          else if (look === 'chicken') l.rotation.x = .8 * A * Math.sin(g + l.phase);
          else { const s = Math.sin(g + l.phase); l.rotation.x = -(.55 + .25 * Math.min(1, sp / 7)) * A * s; l.knee.rotation.x = A * (.25 + 1.1 * Math.max(0, -Math.cos(g + l.phase))); }
        }
        for (const a of c.arms) a.rotation.x = .7 * A * Math.sin(g + a.phase) - .15 * A;
        // a hen flaps hard when chased (and a little as it runs), its head jerking forward and back on every step
        for (const w of c.wings) w.rotation.z = w.side * (chased && sp > 2 ? .35 + .75 * Math.abs(Math.sin(t * 24)) : .05 + .18 * A * Math.abs(Math.sin(g)));
        if (c.head && look === 'chicken') { const jerk = Math.sin(g * 2); c.head.position.z = .45 + .16 * A * (jerk > 0 ? Math.sqrt(jerk) : -.5 * Math.sqrt(-jerk)); c.head.position.y = 1.45 + .05 * A * Math.abs(jerk); c.head.rotation.x = -.25 * A * jerk; }
        if (c.scarf) c.scarf.rotation.x = -.25 - 1.0 * Math.min(1, sp / 7) + .12 * Math.sin(t * 9);
        if (c.item && look.startsWith('kit:')) c.item.rotation.z = .3 * Math.sin(g);
        if (c.trail.length) { c.hist = c.hist || []; c.hist.unshift([c.x, c.y + 1.6 + c.body.position.y, c.z]); if (c.hist.length > 30) c.hist.pop();
          c.trail.forEach((m, k) => { const h = c.hist[Math.min(c.hist.length - 1, (k + 1) * 5)]; m.position.set(h[0], h[1], h[2]); }); }
        if (c.pop) { c.pop = Math.min(1, c.pop + dt * 4); c.root.scaling.setAll((def.scale || 1) * (.01 + .99 * c.pop)); if (c.pop >= 1) c.pop = 0; }
        return dP;
      }
      return {
        update(dt) {
          const t = performance.now() / 1000, p = ctx.player.world();
          if (st.phase === 'count') {
            st.t -= dt;
            const n = st.t > 2.4 ? '3' : st.t > 1.4 ? '2' : st.t > .4 ? '1' : 'Go!';
            if (n !== st.said) { st.said = n; H.msg(n, n === 'Go!' ? 700 : 900); ctx.note(n === 'Go!' ? 880 : 440, 'bell'); }
            if (st.t <= .4) { st.phase = 'run'; ctx.player.hold(false); ctx.sound('whistle'); }
          }
          if (st.phase === 'run') { st.el += dt; H.score(fmt(st.el)); }
          let near = null, nd = Infinity;
          for (const c of crit) {
            if (!c.on) {
              if (c.gone != null && c.gone < 1) { c.gone = Math.min(1, c.gone + dt * 5); c.root.scaling.setAll((def.scale || 1) * Math.max(.01, 1 - c.gone)); if (c.gone >= 1) { c.root.setEnabled(false); c.trail.forEach(m => m.setEnabled(false)); } }
              if (c.respawn != null && st.phase === 'run') { c.respawn -= dt; if (c.respawn <= 0) { c.respawn = null; spawn(c, far()); st.out++; ctx.sound('whistle'); } }
              continue;
            }
            const d = move(c, dt, t, p);
            if (st.phase === 'run' && d < CATCH && Math.abs(p.y - c.y) < 2.4) { tag(c); if (st.phase !== 'run') return; continue; }
            if (d < nd) { nd = d; near = c; }
          }
          if (near) { beam.setEnabled(true); beam.position.set(near.x, near.y + near.height + 6.5, near.z); glowM.alpha = .22 + .1 * Math.sin(t * 6); }
          else beam.setEnabled(false);
          if (st.burst != null) { st.burst += dt; burst.scaling.setAll(.4 + st.burst * 6); burst.material.alpha = Math.max(0, .9 - st.burst * 1.8); if (st.burst > .5) { burst.setEnabled(false); st.burst = null; } }
          if (st.phase === 'run') {
            H.info(`Tagged ${st.caught} / ${catches}${near ? ` · ${Math.round(nd)} m` : ''}`);
            if (st.el > limit) finish(false);
          }
        },
        // the minimap's diamond: the nearest one still out
        target() { const p = ctx.player.world(); let best = null, bd = Infinity; for (const c of crit) if (c.on) { const d = Math.hypot(c.x - p.x, c.z - p.z); if (d < bd) { bd = d; best = { x: c.x, z: c.z }; } } return best; },
        _test: { st, crit, L, at, nearestS, tag, finish },
        dispose() { ctx.player.hold(false); nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); }
      };
    }
  };
  window.RebelGames.register('chase', G);
})();
