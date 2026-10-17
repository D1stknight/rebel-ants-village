// Toss (Oct 15): throwing games on two timing marks, phone friendly: the aim mark sweeps side to side (press: Space, a
// click or a tap), then the power mark sweeps (press again) and the throw flies on a real arc. Free throws on the Saints
// court (a hoop: through the rim scores, a clean one is a swish, the rim can bounce it in or out), coconut toss into
// barrels at three distances (Chumpz), spear throw at straw boards (Warrior: rings like archery), the swivel gun on the
// Wokou pier at barrels floating on the bay (they bob; a hit bursts one and another comes out; from the fifth shot one drifts).
// def: { item: 'ball' | 'coconut' | 'spear' | 'cannon', shots: 10, water (frame y of the sea; else the village's sea), angle: launch pitch (deg), release: [x, y, z] (frame coords),
//        targets: [{ x, y, z, r, kind: 'hoop' | 'barrel' | 'board', points, mult (boards: x the ring score), label,
//        build (the game builds an open barrel / a straw board / a floating barrel there), anchor { type, local }, drift: m/s across },
//        kind 'float': a barrel on the water], cam, at, fov, pass, points }
// Oct 17 (Miguel: "give free throws 20 levels ... 10 shots for the first 10, then 15, 20 and the final 3, 40, 60, 80 shots
// and make the bar go faster and smaller as it goes. same thing with coconut and spear toss ... keep it to 50"; the Swivel
// Gun "at least 20"): twenty levels, picked at the start; each level's bars sweep faster and their sweet spots narrow (the
// power bar spans a wider range of speeds, the aim bar a wider arc), drifting barrels drift faster, and a level is cleared
// by landing enough throws (half on the first, three in four on the last). With the games pack the free throw is a jump
// shot (game_shoot: the ball in both hands until they let go at the top) after a dribble (game_dribble: the ball bounces
// with the hand), and every throw leaves from where the hand is.
(function () {
  const G = {
    title: 'Toss', moves: true,
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const kindItem = ['ball', 'coconut', 'spear', 'cannon'].includes(def.item) ? def.item : 'coconut';
      // with the Rebel's games pack a coconut gets a real overhand throw and a spear the long throw: the move starts at its
      // wind-up (from, s) and the throw leaves the hand at its release (rel, s later)
      // (Oct 17, Miguel: "we need the animations that go with it": the free throw takes the same overhand throw, the ball
      // in the right hand until it leaves; no basketball shot in the pack yet)
      const PACK = { coconut: { clip: 'game_throw', from: .55, rel: .32, hand: 'RightHand' }, ball: { clip: 'game_throw', from: .55, rel: .32, hand: 'RightHand' }, spear: { clip: 'game_throw_far', from: .95, rel: .38 } }[kindItem], usePack = !!(PACK && ctx.player.has?.(PACK.clip));
      const ITEM = { ball: { r: .18, angle: 54, clip: 'jump', sound: 'thock' }, coconut: { r: .18, angle: 42, clip: 'cross_punch', sound: 'thock' }, spear: { r: .05, angle: 14, clip: 'jab', sound: 'whoosh' }, cannon: { r: .13, angle: 9, clip: null, sound: 'boom' } }[kindItem];
      const seaY = window._newTerrain?.seaY, WATER = def.water ?? (seaY != null ? seaY - ctx.toWorld(0, 0, 0).y : -3);
      const GR = 9.8, ANG = (def.angle || ITEM.angle) * Math.PI / 180;
      const LEVELS = 20, store = ctx.util.levelStore(def.id || 'toss-' + kindItem);
      const shotsOf = k => k < 10 ? 10 : k < 14 ? 15 : k < 17 ? 20 : (kindItem === 'ball' ? [40, 60, 80] : [30, 40, 50])[k - 17];
      const LV = Array.from({ length: LEVELS }, (_, k) => { const u = k / (LEVELS - 1), n = shotsOf(k); return { shots: n, need: Math.ceil(n * (.5 + .25 * u)), aimK: 1 + .65 * u, powK: 1 + .55 * u, span: .2 * (1 + .25 * u), margin: .16 * (1 + .5 * u), drift: 1 + 1.5 * u, snap: 1 - .6 * u }; });
      let L = LV[0], level = 0, SHOTS = L.shots;
      // the free throw with the games pack: a dribble while the bars run, then the jump shot
      const SHOT = kindItem === 'ball' && !!ctx.player.has?.('game_shoot'), DRIB = SHOT && !!ctx.player.has?.('game_dribble');
      const REL = def.release ? new V3(...def.release) : new V3(.35, 2.6, .6);
      const targets = (def.targets || []).map(t => ({ ...t, y: t.kind === 'float' ? WATER + .45 : (t.y ?? 0), r: t.r || .5, kind: t.kind || 'barrel', points: t.points || 10, x0: t.x, z0: t.z, ph: Math.random() * 6.28 }));
      // anchor: { type, local: [x, y, z] }: the target is that point of the nearest layout piece of the type (the court's
      // own hoop), so it sits exactly where the piece stands whatever the ground did
      for (const t of targets) {
        if (!t.anchor) continue;
        const want = ctx.toWorld(t.x, t.y, t.z);
        const nodes = scene.transformNodes.filter(n => n.isEnabled() && (n.metadata?.type === t.anchor.type || n.name.startsWith(t.anchor.type + 'RootClone_')));
        let best = null, bd = 12; for (const n of nodes) { const a = n.getAbsolutePosition(), d = Math.hypot(a.x - want.x, a.z - want.z); if (d < bd + 20) { const w = V3.TransformCoordinates(new V3(...t.anchor.local), n.computeWorldMatrix(true)), dw = V3.Distance(w, want); if (dw < bd) { bd = dw; best = w; } } }
        if (best) { const l = ctx.toLocal(best); t.x = l.x; t.y = l.y; t.z = l.z; }
      }
      // targets the game builds (build: true): an open barrel (its rim at y) or a straw board on a post facing the thrower
      for (const t of targets) {
        if (!t.build) continue;
        if (t.kind === 'barrel') {
          const b = B.MeshBuilder.CreateCylinder('tossBarrel', { height: t.y, diameterTop: t.r * 2.1, diameterBottom: t.r * 1.9, tessellation: 16 }, scene); b.position.set(t.x, t.y / 2, t.z); b.isPickable = false; ctx.add(b);
          b.material = ctx.mat('barrel', n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(.45, .27, .12); m.specularColor = new B.Color3(.05, .05, .05); return m; });
          const hole = B.MeshBuilder.CreateDisc('tossHole', { radius: t.r * .98, tessellation: 16 }, scene); hole.rotation.x = Math.PI / 2; hole.position.set(t.x, t.y + .005, t.z); hole.isPickable = false; ctx.add(hole);
          hole.material = ctx.mat('hole', n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(.06, .04, .03); m.specularColor = new B.Color3(0, 0, 0); return m; });
          for (const hy of [.25, .75]) { const hoop = B.MeshBuilder.CreateTorus('tossBand', { diameter: t.r * 2.06, thickness: .05, tessellation: 18 }, scene); hoop.position.set(t.x, t.y * hy, t.z); hoop.isPickable = false; hoop.material = ctx.mat('band', n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(.2, .2, .22); return m; }); ctx.add(hoop); }
        } else if (t.kind === 'float') { // a barrel on the water: rope bands, a red band (it bobs; a hit bursts it)
          const node = new B.TransformNode('tossFloat', scene); node.position.set(t.x, WATER, t.z); ctx.add(node); t.node = node;
          const b = B.MeshBuilder.CreateCylinder('tossFloatBody', { height: .95, diameterTop: t.r * 1.8, diameterBottom: t.r * 1.8, tessellation: 14 }, scene); b.parent = node; b.position.y = .3; b.isPickable = false;
          b.material = ctx.mat('barrel', n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(.45, .27, .12); m.specularColor = new B.Color3(.05, .05, .05); return m; });
          for (const [hy, red] of [[.05, 0], [.3, 1], [.55, 0]]) { const hoop = B.MeshBuilder.CreateTorus('tossFloatBand', { diameter: t.r * 1.86, thickness: red ? .09 : .05, tessellation: 16 }, scene); hoop.parent = node; hoop.position.y = hy; hoop.isPickable = false;
            hoop.material = red ? ctx.mat('redband', n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(.7, .12, .1); m.emissiveColor = new B.Color3(.25, .04, .03); return m; }) : ctx.mat('band', n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(.2, .2, .22); return m; }); }
          node.getChildMeshes(false).forEach(m => ctx.add(m));
        } else if (t.kind === 'board') {
          const node = new B.TransformNode('tossBoard', scene); node.position.set(t.x, 0, t.z); node.rotation.y = Math.atan2(REL.x - t.x, REL.z - t.z); ctx.add(node);
          const post = B.MeshBuilder.CreateCylinder('tossPost', { height: t.y, diameter: .14, tessellation: 8 }, scene); post.parent = node; post.position.y = t.y / 2; post.isPickable = false; post.material = ctx.mat('post', n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(.3, .19, .1); return m; });
          const face = B.MeshBuilder.CreateDisc('tossFace', { radius: t.r, tessellation: 28 }, scene); face.parent = node; face.position.set(0, t.y, .1); face.rotation.y = Math.PI; face.isPickable = false;
          face.material = ctx.mat('board', n => { const m = new B.StandardMaterial(n, scene); const tx = new B.DynamicTexture(n + 'T', { width: 256, height: 256 }, scene, true); const g = tx.getContext();
            g.fillStyle = '#d8c48a'; g.fillRect(0, 0, 256, 256); [[124, '#d8c48a'], [93, '#b5362a'], [62, '#efe4cc'], [31, '#b5362a']].forEach(([r, c]) => { g.fillStyle = c; g.beginPath(); g.arc(128, 128, r, 0, Math.PI * 2); g.fill(); }); tx.update();
            m.diffuseTexture = tx; m.emissiveColor = new B.Color3(.25, .22, .16); m.specularColor = new B.Color3(0, 0, 0); return m; });
        }
      }
      // ── the thrown thing (one mesh, re-used), the targets' own markers for barrels / boards if asked ──
      const mat = (k, c, em) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(.1, .1, .1); if (em) m.emissiveColor = new B.Color3(...em); return m; });
      let proj;
      if (kindItem === 'spear') {
        proj = new B.TransformNode('tossSpear', scene); ctx.add(proj);
        const sh = B.MeshBuilder.CreateCylinder('tossShaft', { height: 2.4, diameter: .06, tessellation: 6 }, scene); sh.material = mat('shaft', [.42, .28, .14]); sh.parent = proj; sh.rotation.x = Math.PI / 2; sh.isPickable = false;
        const tip = B.MeshBuilder.CreateCylinder('tossTip', { height: .3, diameterTop: 0, diameterBottom: .12, tessellation: 6 }, scene); tip.material = mat('steel', [.6, .62, .66], [.08, .08, .1]); tip.parent = proj; tip.rotation.x = Math.PI / 2; tip.position.z = 1.35; tip.isPickable = false;
      } else {
        proj = B.MeshBuilder.CreateSphere('tossBall', { diameter: ITEM.r * 2, segments: 12 }, scene); proj.isPickable = false; ctx.add(proj);
        proj.material = kindItem === 'ball' ? mat('ball', [.85, .38, .08], [.12, .05, 0]) : kindItem === 'cannon' ? mat('iron', [.12, .12, .13], [.02, .02, .02]) : mat('coconut', [.35, .22, .12]);
      }
      // the swivel gun on its post at the pier's edge: it turns with the aim and kicks back when it fires
      let gun = null;
      if (kindItem === 'cannon') {
        const iron = mat('gunIron', [.16, .16, .18], [.03, .03, .04]), wood = mat('gunWood', [.32, .2, .1]);
        const post = B.MeshBuilder.CreateCylinder('tossGunPost', { height: REL.y - .2, diameter: .26, tessellation: 10 }, scene); post.position.set(REL.x, (REL.y - .2) / 2, REL.z - .45); post.material = wood; post.isPickable = false; ctx.add(post);
        gun = new B.TransformNode('tossGun', scene); gun.position.set(REL.x, REL.y - .05, REL.z - .45); ctx.add(gun);
        const yoke = B.MeshBuilder.CreateBox('tossGunYoke', { width: .42, height: .2, depth: .14 }, scene); yoke.parent = gun; yoke.position.y = -.12; yoke.material = iron; yoke.isPickable = false; ctx.add(yoke);
        const barrel = B.MeshBuilder.CreateCylinder('tossGunBarrel', { height: 1.05, diameterTop: .17, diameterBottom: .26, tessellation: 12 }, scene); barrel.parent = gun; barrel.rotation.x = Math.PI / 2; barrel.position.z = .3; barrel.material = iron; barrel.isPickable = false; ctx.add(barrel);
        const ring = B.MeshBuilder.CreateTorus('tossGunMuzzle', { diameter: .2, thickness: .05, tessellation: 12 }, scene); ring.parent = gun; ring.rotation.x = Math.PI / 2; ring.position.z = .83; ring.material = iron; ring.isPickable = false; ctx.add(ring);
        gun.kick = 0;
      }
      const fx = []; // splashes and barrel staves
      const fxSrc = kindItem === 'cannon' ? { foam: (() => { const m = B.MeshBuilder.CreateSphere('tossFoam', { diameter: .3, segments: 5 }, scene); m.isVisible = false; m.isPickable = false; m.material = mat('foam', [.95, .97, 1], [.6, .65, .7]); ctx.add(m); return m; })(),
        stave: (() => { const m = B.MeshBuilder.CreateBox('tossStave', { width: .14, height: .6, depth: .05 }, scene); m.isVisible = false; m.isPickable = false; m.material = mat('stave', [.45, .27, .12]); ctx.add(m); return m; })() } : null;
      function burst(p, kind) { if (!fxSrc) return; const n = kind === 'stave' ? 8 : 10; for (let k = 0; k < n; k++) { const m = fxSrc[kind].createInstance('tossFx'); m.parent = ctx.frame; ctx.add(m); const a = k / n * 6.28 + Math.random() * .4, sp = kind === 'stave' ? 3 : 1.6; m.position.set(p.x, WATER + .2, p.z); m.rotation.set(Math.random() * 3, a, 0);
        fx.push({ m, v: new V3(Math.cos(a) * sp * (.5 + Math.random()), (kind === 'stave' ? 4 : 3) * (.6 + Math.random() * .6), Math.sin(a) * sp * (.5 + Math.random())), t: 0, spin: kind === 'stave' ? 8 : 0 }); } }
      proj.setEnabled(false);
      // the aim on the ground: a thin gold arrow from the Rebel the way the throw will go
      const aimLine = B.MeshBuilder.CreateGround('tossAim', { width: .12, height: 4.5 }, scene); aimLine.isPickable = false; ctx.add(aimLine);
      aimLine.material = ctx.mat('aim', n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(1, .82, .35); m.emissiveColor = new B.Color3(.9, .7, .25); m.alpha = .75; m.disableLighting = true; return m; });
      const setAim = (yaw) => { aimLine.position.set(REL.x + Math.sin(yaw) * 2.5, .06, REL.z + Math.cos(yaw) * 2.5); aimLine.rotation.y = yaw; };
      aimLine.setEnabled(false);
      // ── state ──
      const st = { n: 0, score: 0, made: 0, streak: 0, phase: 'intro', wait: 1.4, aim: 0, aimV: 1, pow: 0, powV: 1, flight: null, lockAim: .5 };
      const info = () => H.info(`${kindItem === 'ball' ? 'Shot' : kindItem === 'spear' ? 'Spear' : kindItem === 'cannon' ? 'Shot' : 'Coconut'} ${Math.min(st.n + 1, SHOTS)} / ${SHOTS}${st.streak >= 2 ? ' · streak ' + st.streak : ''}`);
      // the throw's yaw for an aim value (0..1): the sweep spans the targets' bearings plus a margin
      const bear = targets.map(t => Math.atan2(t.x - REL.x, t.z - REL.z));
      let yMin = Math.min(...bear, 0) - .16, yMax = Math.max(...bear, 0) + .16;
      const yawOf = a => yMin + (yMax - yMin) * a;
      const nearestT = yaw => targets.reduce((b, t, i) => Math.abs(bear[i] - yaw) < Math.abs(bear[b] - yaw) ? i : b, 0);
      // the speed that lands the throw on target t at the launch pitch (dy up from the release, d along the ground)
      const idealV = (t, o = REL) => { const d = Math.hypot(t.x - o.x, t.z - o.z), dy = t.y + (t.kind === 'board' ? 0 : .05) - o.y, c = Math.cos(ANG), q = d * Math.tan(ANG) - dy; return q > .01 ? Math.sqrt(GR * d * d / (2 * c * c * q)) : 12; };
      // the power mark runs from 80 % to 120 % of the speed the aimed-at target needs (wider on later levels): the middle is right
      const vIdeal = targets.map(t => idealV(t)), POW = [.8, 1.2];
      const powOf = () => .5;
      function aimPhase() { st.phase = 'aim'; st.aim = 0; st.aimV = 1; info(); H.msg('', 0); if (DRIB) { ctx.player.clip('game_dribble', { loop: true }); proj.setEnabled(true); } }
      // the dribble: the ball under the palm while the hand pushes down, then down to the floor and back up to the hand
      // (the clip's own timing: the hand is lowest at .25 s and .99 s, highest at .63 s and 1.33 s of its 1.4 s)
      function dribble() {
        const t = ctx.player.clipTime('game_dribble'), h = ctx.player.bone('RightHand'); if (t == null || !h) return;
        const hp = ctx.toLocal(h), tau = t % 1.4, free = tau >= .25 && tau < .63 ? [.25, .63] : tau >= .99 && tau < 1.33 ? [.99, 1.33] : null;
        const base = hp.subtract(new V3(0, ITEM.r + .1, 0)), fl = ITEM.r + .01;
        if (!free) { proj.position.copyFrom(base); st.bounce = false; return; }
        const u = (tau - free[0]) / (free[1] - free[0]), k = Math.abs(1 - 2 * u);
        proj.position.set(base.x, fl + (base.y - fl) * Math.pow(k, .75), base.z); if (u >= .5 && !st.bounce) { st.bounce = true; ctx.sound('bounce'); } if (u < .5) st.bounce = false;
      }
      // the throw leaves from where it is in the hand: its speed is worked out again from there (aim and power kept)
      function launchFrom(p) {
        const f = st.flight, sp = f.v.length(), ideal0 = idealV(targets[f.ti]), k = sp / ideal0;
        f.p = p.clone(); f.v = f.v.scale(1 / sp).scale(idealV(targets[f.ti], p) * k); proj.position.copyFrom(p);
      }
      // ── the level picker ──
      let picker = null;
      function pickLevel(k) {
        if (st.phase !== 'pick') return; if (picker) { picker.remove(); picker = null; }
        level = k; L = LV[k]; SHOTS = L.shots; POW[0] = 1 - L.span; POW[1] = 1 + L.span;
        yMin = Math.min(...bear, 0) - L.margin; yMax = Math.max(...bear, 0) + L.margin;
        Object.assign(st, { n: 0, score: 0, made: 0, streak: 0, phase: 'intro', wait: 1.2 }); H.score(0); info();
        H.msg(`Level ${k + 1}`, 1300, `${SHOTS} ${kindItem === 'ball' ? 'shots' : kindItem === 'spear' ? 'spears' : kindItem === 'cannon' ? 'shots' : 'coconuts'} \u00b7 ${L.need} to clear`);
      }
      const showPicker = () => { picker = H.levels({ title: def.title || 'Toss', sub: 'Twenty levels: the bars run faster and the sweet spots get smaller as you go.', n: LEVELS, open: store.open(LEVELS), done: store.get(), label: k => `${LV[k].shots} \u00b7 ${LV[k].need} in`, pick: pickLevel }); };
      function press() {
        if (st.phase === 'aim') { st.lockAim = st.aim; st.phase = 'power'; st.pow = 0; st.powV = 1; return; }
        if (st.phase === 'power') { throwIt(); }
      }
      function throwIt() {
        let yaw = yawOf(st.lockAim);
        if (def.snap) { // a little help on long shots: an aim this close to a target's bearing (now: they drift) goes straight at it (less help on later levels)
          const snap = def.snap * L.snap; let bd = snap; for (const t of targets) { if (t.gone) continue; const b = Math.atan2(t.x - REL.x, t.z - REL.z); if (Math.abs(b - yaw) < bd) { bd = Math.abs(b - yaw); st.snapTo = b; } }
          if (bd < snap) yaw = st.snapTo;
        }
        const ti = targets.reduce((b, t, i) => Math.abs(Math.atan2(t.x - REL.x, t.z - REL.z) - yaw) < Math.abs(Math.atan2(targets[b].x - REL.x, targets[b].z - REL.z) - yaw) ? i : b, 0);
        const v = idealV(targets[ti]) * (POW[0] + (POW[1] - POW[0]) * st.pow);
        const dir = new V3(Math.sin(yaw) * Math.cos(ANG), Math.sin(ANG), Math.cos(yaw) * Math.cos(ANG));
        st.flight = { p: gun ? REL.add(new V3(Math.sin(yaw) * .5, 0, Math.cos(yaw) * .5 - .45)) : REL.clone(), v: dir.scale(v), t: 0, done: false, bounced: 0, out: null, ti, yaw };
        proj.position.copyFrom(st.flight.p); H.meter(null); aimLine.setEnabled(false);
        if (SHOT) { ctx.player.face(yaw); ctx.player.clip('game_shoot', { hold: true }); st.phase = 'release'; st.relT = .9; return; } // the jump shot lets go at its top
        if (usePack) { ctx.player.face(yaw); ctx.player.clip(PACK.clip, { from: PACK.from }); st.phase = 'release'; st.relT = PACK.rel; proj.setEnabled(false); return; }
        proj.setEnabled(true);
        ctx.player.face(yaw); if (ITEM.clip) ctx.player.clip(ITEM.clip); if (gun) { gun.rotation.y = yaw; gun.kick = 1; }
        ctx.sound(ITEM.sound);
        st.phase = 'flight';
      }
      function result(kind, pts, txt) {
        const f = st.flight; f.done = true; f.out = kind;
        st.n++;
        if (pts > 0) {
          st.made++; st.streak++; const bonus = st.streak >= 3 ? 5 : 0; st.score += pts + bonus;
          const sc = ctx.screenOf(ctx.toWorld(f.p.x, f.p.y + .4, f.p.z)); H.pop(sc.x, sc.y, `+${pts + bonus}`);
          H.msg(txt || 'In!', 800); ctx.sound(kindItem === 'ball' ? 'pins' : 'thock');
        } else { st.streak = 0; H.msg(txt || 'Miss', 700); }
        H.score(st.score); info();
        st.phase = 'after'; st.wait = pts > 0 ? 1.1 : .9;
      }
      function step(dt) {
        const f = st.flight; if (!f || f.done) return;
        const p0 = f.p.clone(); f.v.y -= GR * dt; f.p.addInPlace(f.v.scale(dt)); f.t += dt;
        proj.position.copyFrom(f.p);
        if (kindItem === 'spear') { const d = f.v.normalizeToNew(); proj.rotation.y = Math.atan2(d.x, d.z); proj.rotation.x = -Math.asin(Math.max(-1, Math.min(1, d.y))); }
        else proj.rotation.x += dt * 8;
        for (const t of targets) {
          if (t.kind === 'float') { // the ball meets the barrel's body (it bobs with the water)
            if (t.gone) continue;
            const bx = t.node.position.x, bz = t.node.position.z, by = t.node.position.y;
            if (f.p.y < by + .85 && f.p.y > by - .3 && Math.hypot(f.p.x - bx, f.p.z - bz) < t.r + ITEM.r) {
              burst(t.node.position, 'stave'); burst(t.node.position, 'foam'); ctx.sound('splash'); t.node.setEnabled(false); t.gone = 2.2;
              return result('float', t.points, t.label ? `${t.label}!` : 'Hit!');
            }
            continue;
          }
          if (t.kind === 'board') { // a vertical disc facing the thrower: crossing its plane (its bearing) within r
            const n = new V3(REL.x - t.x, 0, REL.z - t.z).normalize(), s0 = V3.Dot(p0.subtract(new V3(t.x, t.y, t.z)), n), s1 = V3.Dot(f.p.subtract(new V3(t.x, t.y, t.z)), n);
            if (s0 > 0 && s1 <= 0) { const k = s0 / (s0 - s1), hit = V3.Lerp(p0, f.p, k), d = V3.Distance(hit, new V3(t.x, t.y, t.z));
              if (d <= t.r) { f.p.copyFrom(hit); proj.position.copyFrom(hit); const q = d / t.r, ring = q < .25 ? 10 : q < .5 ? 7 : q < .75 ? 5 : 3; return result('board', ring * (t.mult || 1), ring === 10 ? 'Bullseye!' : 'Hit'); } }
            continue;
          }
          const top = t.y; // a hoop rim or a barrel's open top: crossing it going down
          if (f.v.y < 0 && p0.y >= top && f.p.y < top) {
            const k = (p0.y - top) / (p0.y - f.p.y), x = p0.x + (f.p.x - p0.x) * k, z = p0.z + (f.p.z - p0.z) * k, d = Math.hypot(x - t.x, z - t.z);
            const inner = t.r - ITEM.r * .4;
            if (d <= inner) return result(t.kind, t.kind === 'hoop' ? (d < inner * .45 ? t.points + 1 : t.points) : t.points, t.kind === 'hoop' ? (d < inner * .45 ? 'Swish!' : 'Score!') : (t.label || 'In!'));
            if (d <= t.r + ITEM.r && f.bounced < 2) { // off the rim: up and away from the centre, now and then back in
              f.bounced++; const out = new V3(x - t.x, 0, z - t.z).normalize(), back = Math.random() < .3 ? -1 : 1; f.p.y = top + .01; f.v.y = Math.abs(f.v.y) * .45; f.v.x = f.v.x * .4 + out.x * (.6 + Math.random()) * back; f.v.z = f.v.z * .4 + out.z * (.6 + Math.random()) * back;
              ctx.sound('thock');
            }
          }
        }
        if (kindItem === 'cannon') { if (f.p.y < WATER || f.t > 6) { if (f.p.y < WATER + .5) { burst(f.p, 'foam'); ctx.sound('splash'); } result('miss', 0, 'Splash'); } }
        else if (f.p.y < .05 || f.t > 4) result('miss', 0, f.bounced ? 'Rimmed out' : 'Miss');
      }
      // ── set up ──
      ctx.player.place(0, 0, 0);
      const cam = def.cam || [-1.6, 3.4, -3.8], at = def.at || [0, 2.4, 6];
      ctx.look(cam, at, def.fov || .9);
      H.title(def.title || 'Toss'); H.score(0); info();
      H.hint('Press <kbd>Space</kbd> (or click / tap) to stop the <b>aim</b>, then again for the <b>power</b>');
      st.phase = 'pick'; showPicker();
      const inst = {
        update(dt) {
          ctx.look(cam, at);
          st.clock = (st.clock || 0) + dt;
          for (const t of targets) if (t.kind === 'float') {
            if (t.gone) { if ((t.gone -= dt) <= 0) { t.gone = 0; t.x = t.x0 + (Math.random() - .5) * 6; t.z = t.z0 + (Math.random() - .5) * 4; t.node.setEnabled(true); } else continue; }
            if (t.drift && st.n >= 4) { t.dx = t.dx || 1; t.x += t.drift * L.drift * t.dx * dt; if (Math.abs(t.x - t.x0) > (t.span || 5)) t.dx = -t.dx; }
            t.node.position.set(t.x, WATER - .05 + Math.sin(st.clock * 1.6 + t.ph) * .1, t.z); t.node.rotation.z = Math.sin(st.clock * 1.2 + t.ph) * .12; t.node.rotation.x = Math.cos(st.clock * 1.1 + t.ph) * .1;
          }
          if (gun) { if (st.phase === 'aim') gun.rotation.y = yawOf(st.aim); gun.kick = Math.max(0, gun.kick - dt * 3); gun.getChildren().forEach(c => { if (c.name === 'tossGunBarrel') c.position.z = .3 - .25 * gun.kick; }); }
          for (let i = fx.length - 1; i >= 0; i--) { const e = fx[i]; e.t += dt; e.v.y -= 9.8 * dt; e.m.position.addInPlace(e.v.scale(dt)); e.m.rotation.x += e.spin * dt; e.m.scaling.setAll(Math.max(.1, 1 - e.t / 1.2)); if (e.t > 1.2 || e.m.position.y < WATER - .5) { e.m.dispose(); fx.splice(i, 1); } }
          if (st.phase === 'intro' && (st.wait -= dt) <= 0) aimPhase();
          else if (st.phase === 'aim') {
            st.aim += st.aimV * dt * (def.aimSpeed || .9) * L.aimK; if (st.aim > 1) { st.aim = 1; st.aimV = -1; } if (st.aim < 0) { st.aim = 0; st.aimV = 1; }
            const zone = targets.length === 1 ? (() => { const a = (bear[0] - yMin) / (yMax - yMin), w = .07 * .16 / L.margin; return [a - w, a + w]; })() : null;
            if (DRIB) dribble();
            H.meter({ label: 'Aim', value: st.aim, zone });
            ctx.player.face(yawOf(st.aim)); aimLine.setEnabled(true); setAim(yawOf(st.aim));
          } else if (st.phase === 'power') {
            st.pow += st.powV * dt * (.75 + .03 * Math.min(10, st.n)) * L.powK; if (st.pow > 1) { st.pow = 1; st.powV = -1; } if (st.pow < 0) { st.pow = 0; st.powV = 1; }
            const ti = nearestT(yawOf(st.lockAim)), w = .05 * .2 / L.span;
            H.meter({ label: targets[ti].label ? `Power · ${targets[ti].label}` : 'Power', value: st.pow, fill: st.pow, zone: [.5 - w, .5 + w] });
            if (DRIB) dribble();
          } else if (st.phase === 'release') {
            if (SHOT) { // the ball between the two hands, a little in front of them, until they let go at the jump's top (.6 s)
              const l = ctx.player.bone('LeftHand'), r = ctx.player.bone('RightHand'), y = st.flight.yaw, t = ctx.player.clipTime('game_shoot');
              if (l && r) { proj.position.copyFrom(V3.Center(ctx.toLocal(l), ctx.toLocal(r)).add(new V3(Math.sin(y) * .14, .05, Math.cos(y) * .14))); proj.setEnabled(true); }
              if ((t != null && t >= .6) || (st.relT -= dt) <= 0) { if (l && r) launchFrom(proj.position); st.phase = 'flight'; proj.setEnabled(true); ctx.sound('swish'); }
            } else {
              // the coconut rides the throwing hand through the wind-up, then leaves from the hand
              const h = PACK.hand && ctx.player.bone(PACK.hand); if (h) { proj.position.copyFrom(ctx.toLocal(h)); proj.setEnabled(true); }
              if ((st.relT -= dt) <= 0) { st.phase = 'flight'; if (h) launchFrom(proj.position); else proj.position.copyFrom(st.flight.p); proj.setEnabled(true); ctx.sound(ITEM.sound); }
            } }
          else if (st.phase === 'flight') { const n = 4; for (let i = 0; i < n && st.phase === 'flight'; i++) step(dt / n); }
          else if (st.phase === 'after' && (st.wait -= dt) <= 0) {
            proj.setEnabled(false);
            if (st.n >= SHOTS) { st.phase = 'done'; H.hint(''); H.meter(null); const ok = st.made >= L.need; if (ok) { store.set(level + 1); ctx.sound('gamewin'); }
              ctx.finish({ score: st.score, label: 'points', kicker: ok ? `Level ${level + 1} cleared` : `Level ${level + 1}`, solved: ok, next: ok && level + 1 < LEVELS ? level + 1 : null,
                extra: `${st.made} of ${SHOTS} ${kindItem === 'cannon' ? 'barrels burst' : 'in'}${ok ? '' : ` (${L.need} clears level ${level + 1})`}.` }); }
            else aimPhase();
          }
        },
        key(e, down) { if (!down || e.repeat) return; if (picker && picker.key(e)) return; if (e.key === ' ' || e.key === 'Enter' || e.key.toLowerCase() === 'o') press(); },
        pointer(evt) { if (evt.type === B.PointerEventTypes.POINTERDOWN) press(); },
        restart() { if (st.phase === 'pick') return; st.phase = 'pick'; st.flight = null; proj.setEnabled(false); H.meter(null); aimLine.setEnabled(false); ctx.player.idle(); showPicker(); },
        _test: { st, press, targets, vIdeal, powOf, bear, LV, pickLevel, get L() { return L; }, get yMin() { return yMin; }, get yMax() { return yMax; }, throwAt(ti, aimErr = 0, powErr = 0) { st.lockAim = (bear[ti] - yMin) / (yMax - yMin) + aimErr; st.pow = .5 + powErr; throwIt(); } },
        dispose() { if (picker) picker.remove(); fx.forEach(e => { try { e.m.dispose(); } catch (er) {} }); }
      };
      return inst;
    }
  };
  window.RebelGames.register('toss', G);
})();
