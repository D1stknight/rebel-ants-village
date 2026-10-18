// Tug of War (Oct 15, Warrior fort): a rope, a red ribbon and two chalk lines. The ring on the screen swells and
// shrinks: pull (Space, Enter or a click) as it swells to full and the ribbon comes your way; pull at the wrong moment
// and it barely moves. Your opponent leans back steadily, and every few seconds heaves (a red warning first): pull
// well through a heave and it counts double. Drag the ribbon over your chalk line to win; 40 seconds, then whoever
// has the ribbon on their side wins.
// def: { opponent: npcId, gap: m between the pullers, seconds, cycle: s per swell at the start (cycleEnd: at the end),
// drift, heave, cam, look, pass, points }
// Oct 17 (Miguel: "needs a pulling animation and the ring swelling needs to be better"): the swell is slower (1.05 s a
// swell, 0.8 s by the end) and shows its moment: the disc grows to the gold ring and both light up while a pull counts;
// the Rebel holds the rope in both hands (the games pack's push stance, leaning back; the rope runs from its hands) and
// heaves back on every good pull.
// Oct 17 (Miguel's Pulling A Rope, games pack v2.30): the Rebel pulls hand over hand side on, its left hand toward the
// opponent (the move leans away from the rope by itself); Rebels without it reach onto the rope from the push stance.
// Oct 18 (Miguel: "my character is not holding the rope, and the opponent is also not holding the rope but additionally he
// doesnt have the rope pulling animation"): the rope ran from the middle of the Rebel's two hands (in the air between them)
// to the middle of the opponent's, and the opponent was held by the chat's dialogueOpen, so it played its talk clip and
// kept turning toward you. Now the rope is drawn through each fist's grip point (the Rebel's two, then the opponent's two),
// with a tail behind each puller, and the opponent is held by gameHold (no talking, no turning).
// Oct 18, later (Miguel: "arent they supposed to face each other?"): the games pack's rope pull draws a rope sideways
// across the body, so with it both stood side on to the camera, hands on their far sides. Now both face each other down
// the middle and lean back from their feet (deeper as they draw the rope in, through his heaves and after your good
// pulls), fists closed (from each one's own flip kick fist) on one straight rope at belly height, the arms bent onto it
// every frame after the animations (two-bone reach, the fist turned along the rope): the front hand reaches out, the
// back one holds near the belly, and both draw in as the puller leans back. Models without arm joints (the starter ant,
// kit apes) keep a rope end in front of them.
(function () {
  const G = {
    title: 'Tug of War',
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const GAP = def.gap || 5.2, SEC = def.seconds || 40, CYCLE = def.cycle || 1.05, CYCLE_END = def.cycleEnd || .8, LINE = 1.25, WIN = .88;
      const mat = (k, c, em, spec = .1) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(spec, spec, spec); if (em) m.emissiveColor = new B.Color3(...em); return m; });
      const M = { rope: mat('rope', [.72, .6, .38], [.1, .08, .05]), ribbon: mat('ribbon', [.9, .12, .1], [.4, .04, .03]), chalk: mat('chalk', [.95, .95, .92], [.45, .45, .42]) };
      const nodes = [], keep = n => { if (!n.parent) n.parent = ctx.frame; ctx.add(n); nodes.push(n); return n; };
      for (const s of [-1, 1]) { const c = keep(B.MeshBuilder.CreateGround('tgChalk', { width: 2.4, height: .14 }, scene)); c.position.set(0, .03, s * LINE); c.material = M.chalk; c.isPickable = false; }
      const mid = keep(B.MeshBuilder.CreateGround('tgMid', { width: 1, height: .08 }, scene)); mid.position.set(0, .03, 0); mid.material = M.chalk; mid.isPickable = false;
      const ribbon = keep(B.MeshBuilder.CreateBox('tgRibbon', { width: .08, height: .45, depth: .1 }, scene)); ribbon.material = M.ribbon; ribbon.isPickable = false;
      let rope = null;
      const npc = def.opponent ? ctx.npc(def.opponent) : null, npcWas = npc ? { p: npc.position.clone(), ry: npc.rotation.y, rx: npc.rotation.x, m: { home: npc.metadata?.home, wo: npc.metadata?.wanderOrigin, target: npc.metadata?.target } } : null;
      const pr = ctx.player.root, prWas = pr ? pr.rotation.x : 0;
      const st = { phase: 'intro', intro: 2, t: 0, ph: 0, left: SEC, b: 0, good: 0, weak: 0, combo: 0, heave: 0, warn: 0, nextHeave: 3.5 + Math.random() * 1.5, flash: 0, best: 0, kick: 0, lit: null,
        pull: 0, s: 0, lean: 0 }; // the opponent's hand-over-hand cycle (pull 0..1 a draw), how far drawn in (s 0..1), its lean
      ctx.player.idle?.(); // its own stance, the arms set onto the rope every frame
      // def.hide: layout pieces of these types near the pullers step aside while the bout is on (Warrior: the yard's torch
      // stands between the camera and the rope)
      const hidden = [];
      if (def.hide && def.hide.length) { const o = ctx.toWorld(0, 0, 0); for (const n of scene.transformNodes) {
        if (!n.isEnabled() || !(def.hide.includes(n.metadata && n.metadata.type) || def.hide.some(t => n.name.startsWith(t + 'RootClone_')))) continue;
        const p = n.getAbsolutePosition(); if (Math.hypot(p.x - o.x, p.z - o.z) < 9) { n.setEnabled(false); hidden.push(n); } } }
      // the arms of a Forge rig (the Rebel's, a forged NPC's): joints by name; null for models without them. Each joint
      // knows where it is drawn: a forged NPC's joint nodes are where its skin is drawn, the Rebel's are not (the village
      // hangs the Rebel's skinned meshes straight under the player root, so the glTF root's turn and mirror above the
      // joints aren't in the drawn skin: a hand's node sat a metre from the drawn hand), so for the Rebel the skeleton's
      // bones give the drawn places (as ctx.player.bone) and a turn is worked out in the drawn parent's frame (a joint's
      // own local turn is the same either way)
      const rigOf = (root, viaBones) => {
        if (!root) return null;
        const all = root.getChildTransformNodes(false), sm = viaBones ? root.getChildMeshes(false).find(m => m.skeleton) : null, sk = sm?.skeleton || null;
        if (viaBones && !sk) return null;
        const named = (x, n) => x.name === 'mixamorig_' + n || x.name === 'mixamorig:' + n || x.name.endsWith('_' + n) || x.name.endsWith(':' + n);
        const by = n => { if (viaBones) { const b = sk.bones.find(x => named(x, n)), t = b?.getTransformNode?.(); return b && t ? { node: t, bone: b } : null; }
          const t = all.find(x => x.name === 'mixamorig_' + n) || all.find(x => named(x, n)); return t ? { node: t } : null; };
        const r = { root, sm, sk, bones: !!viaBones };
        for (const sd of ['Left', 'Right']) { const j = { arm: by(sd + 'Arm'), fore: by(sd + 'ForeArm'), hand: by(sd + 'Hand'), i1: by(sd + 'HandIndex1'), m1: by(sd + 'HandMiddle1'), p1: by(sd + 'HandPinky1') };
          if (!Object.values(j).every(Boolean)) return null; r[sd] = j; }
        const isFinger = n => /Hand(Thumb|Index|Middle|Ring|Pinky)\d$/.test(n);
        r.fingers = viaBones ? sk.bones.filter(b => isFinger(b.name)).map(b => b.getTransformNode()).filter(Boolean) : all.filter(t => isFinger(t.name));
        return r;
      };
      // a grip: the fingers closed three quarters of the way from the idle hand to the fist of the rig's own flip kick (a
      // forged NPC's idle hand is about 77 deg over the three finger joints, the flip kick 251)
      const fistOf = (fingers, fist, idle) => {
        if (!fist) return [];
        const key = (g, n) => { const a = g?.targetedAnimations.find(t => t.target === n && t.animation.targetProperty === 'rotationQuaternion'); return a?.animation.getKeys()[0]?.value || null; };
        return fingers.map(n => { const f = key(fist, n), i = key(idle, n) || n.rotationQuaternion; return f && i ? [n, B.Quaternion.Slerp(i, f, .75)] : null; }).filter(Boolean);
      };
      const rigs = { me: null, npc: null, fistMe: [], fistNpc: [], seek: 0 };
      // the ring: swells to full once a cycle; a pull near the top counts
      const hud = document.getElementById('gameHud'), ringBox = document.createElement('div');
      // high on the side away from the opponent (Oct 18: at mid right it covered him on most screens); see ringSide
      ringBox.style.cssText = 'position:absolute;right:max(16px,4vw);top:max(72px,12vh);width:150px;height:150px;pointer-events:none';
      const ringSide = () => { // projected with the game camera itself (0..1 across the view)
        const cam = scene.activeCamera; if (!cam) return;
        const o = npc ? npc.getAbsolutePosition() : ctx.toWorld(0, 1.5, GAP / 2), v = V3.Project(o, B.Matrix.Identity(), cam.getViewMatrix().multiply(cam.getProjectionMatrix()), new B.Viewport(0, 0, 1, 1));
        const left = v.z > 0 && v.z < 1 && v.x > .5; st.ringLeft = left;
        ringBox.style.left = left ? 'max(16px,4vw)' : ''; ringBox.style.right = left ? '' : 'max(16px,4vw)'; };
      ringBox.innerHTML = '<div class="tg-target" style="position:absolute;inset:0;border-radius:50%;border:5px solid rgba(255,216,119,.5);box-sizing:border-box"></div><div class="tg-ring" style="position:absolute;inset:6px;border-radius:50%;transform:scale(.2)"></div><div class="tg-word" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:700 20px Georgia,serif;color:#fff;text-shadow:0 1px 4px #000"></div>';
      hud.appendChild(ringBox); const ringEl = ringBox.querySelector('.tg-ring'), wordEl = ringBox.querySelector('.tg-word'), targetEl = ringBox.querySelector('.tg-target');
      const flash = document.createElement('div'); flash.style.cssText = 'position:absolute;inset:0;pointer-events:none;opacity:0;background:rgba(170,20,20,.35);transition:opacity .3s'; hud.appendChild(flash);
      // one swell a cycle, the cycle shortening through the bout; a pull counts near its top
      const cycleNow = () => CYCLE + (CYCLE_END - CYCLE) * Math.min(1, st.t / SEC), swell = () => Math.sin(Math.PI * (st.ph % 1)); // 0 .. 1 .. 0
      function drawRing() {
        const s = swell(), lit = st.phase === 'bout' && s > WIN;
        ringEl.style.transform = `scale(${(.18 + .82 * s).toFixed(3)})`;
        if (lit !== st.lit) { // only when it changes: the disc and the gold ring light up together while a pull counts
          st.lit = lit;
          ringEl.style.background = lit ? 'radial-gradient(circle,rgba(255,248,214,.97),rgba(255,204,96,.85))' : 'radial-gradient(circle,rgba(255,216,119,.42),rgba(255,140,60,.16))';
          targetEl.style.borderColor = lit ? '#fff3c4' : 'rgba(255,216,119,.5)'; targetEl.style.boxShadow = lit ? '0 0 26px 8px rgba(255,206,100,.8)' : 'none';
          if (!(st.wordT > 0)) wordEl.textContent = lit ? 'PULL!' : '';
        }
      }
      // both face the middle and lean back from their feet: deeper as they draw the rope in, through his heaves and after
      // each of your good pulls (the kick also steps you back)
      const place = () => {
        const shift = st.b * LINE; // the ribbon reaches a chalk line at b = ±1
        st.lean = .34 + Math.abs(st.b) * .05 + st.s * .08 + (st.heave > 0 ? .1 : 0);
        st.meS = Math.min(1, st.kick / .16); st.meLean = .34 + st.meS * .1 + Math.abs(st.b) * .04;
        ctx.player.place(0, -GAP / 2 - shift - st.kick * .5, 0); if (pr) pr.rotation.x = rigs.me ? -st.meLean : -(.12 + st.kick);
        if (npc) { const w = ctx.toWorld(0, 0, GAP / 2 - shift), f = ctx.toWorld(0, 0, -GAP); npc.position.x = w.x; npc.position.z = w.z; npc.rotation.y = Math.atan2(f.x - w.x, f.z - w.z);
          npc.rotation.x = rigs.npc ? -st.lean : -.12;
          if (npc.metadata) { npc.metadata.target = null; npc.metadata.home = npc.position.clone(); npc.metadata.wanderOrigin = npc.position.clone(); npc.metadata.gameHold = { clip: 'idle' }; } }
      };
      // world matrices from the top of a node's chain down (after the animations this frame: cached ones are a frame old)
      const chainUp = n => { const ch = []; for (let p = n; p; p = p.parent) ch.push(p); for (let i = ch.length - 1; i >= 0; i--) ch[i].computeWorldMatrix(true); };
      const below = n => { n.computeWorldMatrix(true); n.getChildTransformNodes(false).forEach(c => c.computeWorldMatrix(true)); };
      const freshRig = r => { if (r.bones) { chainUp(r.sm); r.sk.prepare(true); } else { chainUp(r.root); below(r.root); } };
      const W = (r, j) => r.bones ? V3.TransformCoordinates(V3.Zero(), j.bone.getFinalMatrix().multiply(r.sm.getWorldMatrix())) : j.node.getAbsolutePosition().clone();
      const parentM = (r, j) => { if (!r.bones) return j.node.parent.getWorldMatrix(); const p = j.bone.getParent(); return p ? p.getFinalMatrix().multiply(r.sm.getWorldMatrix()) : r.sm.getWorldMatrix(); };
      const moved = (r, j) => { if (r.bones) r.sk.prepare(true); else below(j.node); };
      const tm = new B.Matrix(), tq = new B.Quaternion();
      // turn a joint about its pivot (in its parent's drawn frame, so a mirrored parent is no matter) so a point moving with
      // it (world) goes toward a target, or (dir) a direction moving with it lines up with another
      const turn = (r, j, from, to, dir) => {
        const N = j.node; parentM(r, j).invertToRef(tm);
        const a = dir ? V3.TransformNormal(from, tm) : V3.TransformCoordinates(from, tm).subtractInPlace(N.position), c = dir ? V3.TransformNormal(to, tm) : V3.TransformCoordinates(to, tm).subtractInPlace(N.position);
        if (a.lengthSquared() < 1e-12 || c.lengthSquared() < 1e-12) return;
        B.Quaternion.FromUnitVectorsToRef(a.normalize(), c.normalize(), tq);
        N.rotationQuaternion = tq.multiply(N.rotationQuaternion || B.Quaternion.FromEulerVector(N.rotation)); moved(r, j);
      };
      // a fist's grip point (the middle of the hole through it) and the axis through it (index to pinky side): as the game
      // ctx's grip, from the finger joints
      const gripOf = (r, j, sd) => {
        const H = W(r, j.hand), I = W(r, j.i1), P = W(r, j.p1), M = W(r, j.m1), fing = M.subtract(H).normalize(), up = I.subtract(P).normalize();
        const palm = V3.Cross(fing, up).normalize().scale(sd === 'Left' ? -1 : 1), len = V3.Distance(H, M);
        return { p: V3.Center(I, P).add(fing.scale(len * .45)).add(palm.scale(len * .35)), up };
      };
      // one arm onto the rope: the elbow bent toward the pole (down, out, back), the hand's pivot placed so the fist's grip
      // point lands on the target (twice: the hand turns along the rope after each reach)
      const reach = (r, j, sd, T, pole, along) => {
        for (let k = 0; k < 2; k++) {
          const g0 = gripOf(r, j, sd), H0 = W(r, j.hand), aim = T.subtract(g0.p.subtract(H0)); // where the hand's pivot must go
          const A = W(r, j.arm), F = W(r, j.fore), a = V3.Distance(A, F), b = V3.Distance(F, H0), d0 = V3.Distance(A, aim), u = aim.subtract(A).scaleInPlace(1 / (d0 || 1));
          const d = Math.min(a + b - 1e-3, Math.max(Math.abs(a - b) + 1e-3, d0)), x = (a * a - b * b + d * d) / (2 * d), h = Math.sqrt(Math.max(0, a * a - x * x));
          let v = pole.subtract(A); v.subtractInPlace(u.scale(V3.Dot(v, u))); if (v.lengthSquared() < 1e-8) v = new V3(0, -1, 0); v.normalize();
          turn(r, j.arm, F, A.add(u.scale(x)).addInPlace(v.scale(h)));
          turn(r, j.fore, W(r, j.hand), A.add(u.scale(d)));
          const g1 = gripOf(r, j, sd); turn(r, j.hand, g1.up, V3.Dot(g1.up, along) >= 0 ? along : along.scale(-1), true); // the fist along the rope
        }
      };
      // both hands of a rig on a rope line near its body: base R0 (the rope beside the chest line), u = along it toward the
      // other puller; the hand on the rope's side holds it near the hip, the other reaches out in front; s = drawn in
      const holdOn = (r, R0, u, s) => {
        const L0 = W(r, r.Left.arm), R1 = W(r, r.Right.arm), right = R1.subtract(L0); right.y = 0; right.normalize();
        const C = V3.Center(L0, R1), ropeRight = V3.Dot(R0.subtract(C), right) >= 0, back = ropeRight ? 'Right' : 'Left', front = ropeRight ? 'Left' : 'Right';
        const L = V3.Distance(L0, W(r, r.Left.fore)) + V3.Distance(W(r, r.Left.fore), W(r, r.Left.hand));
        const out = { [front]: L * (.62 - .2 * s), [back]: L * (.2 - .1 * s) }, T = {};
        for (const sd of [back, front]) {
          const j = r[sd], A = W(r, j.arm), o = R0.subtract(A), k = V3.Dot(o, u), q = k * k - o.lengthSquared() + (.94 * L) ** 2;
          // no further along the rope than the arm reaches (nearly straight): leaning back takes the shoulders away
          T[sd] = R0.add(u.scale(q > 0 ? Math.min(out[sd], -k + Math.sqrt(q)) : out[sd]));
          const side = A.subtract(C); side.y = 0; side.normalize();
          reach(r, j, sd, T[sd], A.add(new V3(0, -L, 0)).addInPlace(side.scale(.45 * L)).addInPlace(u.scale(-.35 * L)), u);
        }
        return { front: gripOf(r, r[front], front).p, back: gripOf(r, r[back], back).p, T: [T[front], T[back]], L };
      };
      // each frame after the animations: the arms onto the rope and the rope through the fists (frame coordinates)
      const local = v => ctx.toLocal(v), world = v => ctx.toWorld(v.x, v.y, v.z);
      const armLen = r => V3.Distance(W(r, r.Left.arm), W(r, r.Left.fore)) + V3.Distance(W(r, r.Left.fore), W(r, r.Left.hand));
      // where a rig holds the rope: in front of its belly (down and forward from its shoulders along its own leaning body),
      // on the middle line (frame x 0) so both pullers share one straight rope
      // (the root's axes normalized: the Rebel's root is scaled, so its raw axes put the belly 0.8 m under the shoulders,
      // out of the arms' reach, and the fists stayed at the chest)
      const belly = (r, root) => { const A = V3.Center(W(r, r.Left.arm), W(r, r.Right.arm)), L = armLen(r);
        const p = local(A.add(root.getDirection(V3.Up()).normalize().scale(-.55 * L)).addInPlace(root.getDirection(V3.Forward()).normalize().scale(.18 * L))); p.x = 0; return p; };
      // fists closed, then both arms onto the rope from its belly toward the other puller's (s: drawn in 0..1)
      const hold = (r, fists, Rb, Ro, s) => {
        for (const [n, q] of fists) n.rotationQuaternion = q.clone();
        if (r.bones) r.sk.prepare(true); else { below(r.Left.hand.node); below(r.Right.hand.node); }
        const g = holdOn(r, world(Rb), world(Ro).subtract(world(Rb)).normalize(), s);
        (st.aims || (st.aims = {}))[r.bones ? 'me' : 'npc'] = g.T.map(local); // where its fists were sent (tests)
        return [local(g.front), local(g.back)];
      };
      const holdRope = () => {
        if ((rigs.seek -= 1) <= 0 && (!rigs.npc || !rigs.me)) { rigs.seek = 30; // models still loading: look again
          if (!rigs.npc && npc?.metadata?.modelLoaded) { rigs.npc = rigOf(npc, false);
            if (rigs.npc) { const gs = npc.metadata.animationGroups || []; rigs.fistNpc = fistOf(rigs.npc.fingers, gs.find(g => g.name === 'flip_kick'), gs.find(g => g.name === 'idle')); } }
          if (!rigs.me && pr && ctx.player.rig) { rigs.me = rigOf(pr, true);
            if (rigs.me) rigs.fistMe = fistOf(rigs.me.fingers, ctx.player.group?.('flip_kick'), ctx.player.group?.('idle')); } }
        const shift = st.b * LINE, meZ = -GAP / 2 - shift, npcZ = GAP / 2 - shift;
        if (rigs.me) freshRig(rigs.me); if (rigs.npc) freshRig(rigs.npc);
        const Bm = rigs.me ? belly(rigs.me, pr) : new V3(0, 1.45, meZ + .55), Bn = rigs.npc ? belly(rigs.npc, npc) : new V3(0, 1.45, npcZ - .55);
        let P1, P2, N1, N2; // each puller's front (toward the other) and back grip points
        if (rigs.me) [P1, P2] = hold(rigs.me, rigs.fistMe, Bm, Bn, st.meS);
        else { P1 = new V3(0, 1.45, meZ + .55); P2 = new V3(0, 1.4, meZ + .2); }
        if (rigs.npc) [N1, N2] = hold(rigs.npc, rigs.fistNpc, Bn, Bm, st.s);
        else { N1 = new V3(0, 1.45, npcZ - .55); N2 = new V3(0, 1.4, npcZ - .2); }
      // the rope: a tail behind each puller dropping to the ground, straight through each one's two fists, sagging between
        // (each tail runs along the rope, away from the other puller: the two fists can sit one above the other)
        const tail = (a, dz, n) => { const out = [];
          for (let i = n; i >= 1; i--) { const f = i / n, p = a.add(new V3(0, 0, dz * 1.5 * f)); p.y = .05 + (a.y - .05) * (1 - Math.pow(f, 1.6)); out.push(p); } return out; };
        const pts = [...tail(P2, -1, 4), P2, P1];
        for (let i = 1; i < 10; i++) { const f = i / 10, p = V3.Lerp(P1, N1, f); p.y -= Math.sin(Math.PI * f) * .12; pts.push(p); }
        pts.push(N1, N2, ...tail(N2, 1, 4).reverse());
        rope = B.MeshBuilder.CreateTube('tgRope', { path: pts, radius: .045, tessellation: 6, updatable: true, instance: rope || undefined }, scene);
        if (!rope.material) { rope.material = M.rope; rope.isPickable = false; keep(rope); }
        // the ribbon hangs from the rope at the middle mark (it slides with the bout)
        const f = Math.min(1, Math.max(0, (-shift - P1.z) / ((N1.z - P1.z) || 1))), m = V3.Lerp(P1, N1, f); m.y -= Math.sin(Math.PI * f) * .12;
        ribbon.position.set(m.x, m.y - .25, m.z);
        st.ropePts = pts; st.grips = { P1, P2, N1, N2 };
      };
      const obs = scene.onBeforeRenderObservable.add(() => { if (st.phase !== 'gone') try { holdRope(); } catch (e) { if (!st.ropeErr) { st.ropeErr = 1; console.warn('tug rope', e?.message || e); } } });
      place();
      // both pullers side by side in view, the Rebel nearer the left
      const camOf = () => def.cam || [6.6, 3.0, -1.0], look = def.look || [0, 1.5, -.4];
      ctx.look(camOf(), look, def.fov || .8);
      H.title(def.title || 'Tug of War'); H.score(''); H.info(`${SEC} s`);
      H.hint('Pull (<kbd>Space</kbd>, <kbd>Enter</kbd> or a click) as the ring swells full. Hold on through his heaves: a good pull then counts double.');
      H.msg('Tug of War', 1600, npc ? 'take the rope' : '');
      // a pull may carry the ribbon past the line (b up to 1.3): the next frame calls the win, whatever the drift
      function pull() {
        if (st.phase !== 'bout') return;
        const s = swell();
        if (s > WIN) { st.kick = .16; st.combo++; st.good++; st.best = Math.max(st.best, st.combo); const gain = .085 * (1 + Math.min(5, st.combo) * .08) * (st.heave > 0 ? 2 : 1); st.b = Math.min(1.3, st.b + gain); ctx.note(392 + Math.min(8, st.combo) * 40, 'bell'); wordEl.textContent = 'GOOD'; }
        else { st.combo = 0; st.weak++; st.b = Math.min(1.3, st.b + .012); ctx.sound('thock'); wordEl.textContent = 'slip'; }
        st.wordT = .35;
      }
      return {
        update(dt) {
          ctx.look(camOf(), look);
          if (st.phase === 'intro' && (st.intro -= dt) <= 0) { st.phase = 'bout'; H.msg('Pull!', 700); }
          if (st.phase === 'bout') {
            st.t += dt; st.ph += dt / cycleNow(); st.left = Math.max(0, st.left - dt); H.info(`${Math.ceil(st.left)} s`);
            const drift = (def.drift || .04) * (1 + (1 - st.left / SEC) * .6); st.b -= drift * dt;
            if (st.warn > 0 && (st.warn -= dt) <= 0) { st.heave = .75; }
            if (st.heave > 0) { st.heave -= dt; st.b -= (def.heave || .38) * dt; }
            if ((st.nextHeave -= dt) <= 0) { st.warn = .6; st.nextHeave = 3 + Math.random() * 2.2; H.msg('He heaves!', 700); flash.style.transition = 'none'; flash.style.opacity = '1'; void flash.offsetWidth; flash.style.transition = 'opacity .6s'; flash.style.opacity = '0'; }
            if (st.wordT > 0 && (st.wordT -= dt) <= 0) wordEl.textContent = st.lit ? 'PULL!' : '';
            H.score(`${st.b >= 0 ? '◀' : '▶'} ${Math.round(Math.abs(st.b) * 100)}%`);
            const end = st.b >= 1 ? 'won' : st.b <= -1 ? 'lost' : st.left <= 0 ? (st.b > 0 ? 'won' : 'lost') : null;
            if (end) { st.phase = end; st.wait = 1.8; ctx.sound(end === 'won' ? 'gamewin' : 'thock'); H.msg(end === 'won' ? 'Over the line!' : 'Pulled over…', 1500); }
          }
          if ((st.sideT = (st.sideT || 0) - dt) <= 0) { st.sideT = .5; ringSide(); }
          // the opponent pulls in rhythm: reach out along the rope, then draw it in leaning back (quicker in a heave)
          st.pull = (st.pull + dt / (st.heave > 0 ? .62 : 1.3)) % 1; st.s = .5 - .5 * Math.cos(Math.PI * 2 * st.pull);
          st.kick = Math.max(0, st.kick - dt * .6); drawRing(); place();
          if ((st.phase === 'won' || st.phase === 'lost') && (st.wait -= dt) <= 0) {
            const won = st.phase === 'won'; st.phase = 'done'; H.hint('');
            const pts = won ? 60 + Math.round(st.left) + st.best * 2 : st.good * 2;
            ctx.finish({ score: pts, label: 'points', passed: won && pts >= (def.pass || 0), extra: `${won ? 'You won the rope' : 'The rope went to your opponent'}: ${st.good} good pulls, best run ${st.best}.` });
          }
        },
        key(e, down) { if (!down || e.repeat) return; if (e.key === ' ' || e.key === 'Enter') pull(); },
        pointer(evt) { if (evt.type === B.PointerEventTypes.POINTERDOWN) pull(); },
        _test: { st, pull, swell, CYCLE, cycleNow, rigs, gripOf, W, holdOn, belly, armLen, freshRig },
        dispose() { st.phase = 'gone'; scene.onBeforeRenderObservable.remove(obs); hidden.forEach(n => { try { n.setEnabled(true); } catch (e) {} }); ringBox.remove(); flash.remove(); if (pr) pr.rotation.x = prWas; nodes.forEach(n => { try { n.dispose(); } catch (e) {} });
          if (npc && npcWas) { npc.position.copyFrom(npcWas.p); npc.rotation.y = npcWas.ry; npc.rotation.x = npcWas.rx || 0; if (npc.metadata) { npc.metadata.home = npcWas.m.home; npc.metadata.wanderOrigin = npcWas.m.wo; npc.metadata.target = npcWas.m.target; delete npc.metadata.gameHold; } } }
      };
    }
  };
  window.RebelGames.register('tug', G);
})();
