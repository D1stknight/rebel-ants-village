// The Swordsmith's Forge (Oct 15, Samurai): fold a blade six times. Heat: hold Space to work the bellows and let go
// when the steel glows orange-yellow (the gold band of the gauge); too cold and it cracks, too hot and it burns.
// Strike: a ring closes on the steel three times; press Space (or click) as it meets the gold circle. Each fold
// narrows the band and quickens the hammer. Last, the quench: stop the sweep in the narrow moonlight band. The blade's
// quality is the score.
// def: { folds: 6, pass, points }
// Oct 17 (Miguel: "it just needs the animation of him swinging the hammer down"): with the games pack the hammer is in
// the Rebel's right hand and each strike is an overhand swing down onto the anvil (game_throw from its wind-up's top).
(function () {
  const G = {
    title: "The Swordsmith's Forge", moves: true,
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, H = ctx.HUD, U = ctx.util, scene = ctx.scene, def = ctx.def;
      const FOLDS = def.folds || 6;
      const mat = (k, c, em, o = {}) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(...(o.spec || [.08, .08, .08])); if (em) m.emissiveColor = new B.Color3(...em); if (o.flat) m.disableLighting = true; if (o.alpha != null) m.alpha = o.alpha; return m; });
      const stoneM = mat('hearth', [.42, .4, .38], [.07, .07, .065]), ironM = mat('anvil', [.2, .2, .22], [.03, .03, .035], { spec: [.5, .5, .5] }), woodM = mat('wood', [.4, .27, .15], [.07, .045, .025]);
      const coalM = mat('coals', [.3, .05, .02], [1, .32, .06], { flat: true }), waterM = mat('water', [.2, .35, .45], [.05, .1, .14], { alpha: .85, spec: [.6, .6, .6] }), leatherM = mat('leather', [.35, .2, .12], [.06, .035, .02]);
      const steelM = ctx.mat('steel', n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(.3, .3, .32); m.specularColor = new B.Color3(.6, .6, .6); return m; });
      const ringM = mat('ring', [1, .85, .4], [1, .8, .3], { flat: true, alpha: .9 }), goalM = mat('goal', [1, .78, .25], [1, .7, .2], { flat: true, alpha: .55 });
      const nodes = [], keep = (n, parent) => { n.parent = parent || ctx.frame; ctx.add(n); nodes.push(n); if (n.isPickable !== undefined) n.isPickable = false; return n; };
      const box = (name, w, h, d, m, x, y, z, parent) => { const b = keep(B.MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene), parent); b.material = m; b.position.set(x, y, z); return b; };
      // the smithy: a stone hearth with coals and bellows (left), the anvil on a stump (ahead), the quench trough (right);
      // the Rebel works from behind the anvil, facing the camera, with the hammer in its right hand
      box('forgeHearth', 1.6, .9, 1.3, stoneM, -2, .45, 2.4); const coals = box('forgeCoals', 1.2, .12, .9, coalM, -2, .93, 2.4);
      const bellows = box('forgeBellows', .7, .32, .9, leatherM, -3.1, .75, 2.4); box('forgeBellowsHandle', .08, .5, .08, woodM, -3.1, 1.15, 1.95);
      box('forgeStump', .8, .7, .8, woodM, 0, .35, 2); box('forgeAnvil', .55, .35, 1.1, ironM, 0, .88, 2); box('forgeAnvilTop', .7, .1, 1.3, ironM, 0, 1.1, 2);
      box('forgeTrough', 1.5, .5, .7, woodM, 2.1, .25, 2.2); box('forgeWater', 1.36, .04, .56, waterM, 2.1, .52, 2.2); for (const [w, d, x, z] of [[1.5, .07, 2.1, 1.885], [1.5, .07, 2.1, 2.515], [.07, .7, 1.385, 2.2], [.07, .7, 2.815, 2.2]]) box('forgeTroughSide', w, .16, d, woodM, x, .58, z);
      const steel = box('forgeSteel', .16, .07, .7, steelM, -2, 1.02, 2.4);
      const hammerPiv = keep(new B.TransformNode('forgeHammer', scene)); hammerPiv.position.set(-.55, 1.5, 2.95);
      box('forgeHammerHandle', .07, .07, 1, woodM, 0, 0, .5, hammerPiv); box('forgeHammerHead', .22, .22, .36, ironM, 0, 0, 1.0, hammerPiv);
      hammerPiv.rotation.y = Math.atan2(.55, -.95); hammerPiv.rotation.x = -.9;
      // with the games pack the hammer rides the right hand: the handle runs on from the forearm through the fist
      const PACK = !!ctx.player.has?.('game_throw');
      const inHand = () => { const h = ctx.player.bone('RightHand'), f = ctx.player.bone('RightForeArm'); if (!h || !f) return false;
        const lh = ctx.toLocal(h), d = lh.subtract(ctx.toLocal(f)).normalize(); hammerPiv.position.copyFrom(lh.subtract(d.scale(.12)));
        hammerPiv.rotation.y = Math.atan2(d.x, d.z); hammerPiv.rotation.x = -Math.asin(Math.max(-1, Math.min(1, d.y))); return true; };
      const ring = keep(B.MeshBuilder.CreateTorus('forgeRing', { diameter: 1, thickness: .035, tessellation: 32 }, scene)); ring.material = ringM; ring.position.set(0, 1.18, 2); ring.setEnabled(false);
      const goal = keep(B.MeshBuilder.CreateTorus('forgeGoal', { diameter: .36, thickness: .05, tessellation: 32 }, scene)); goal.material = goalM; goal.position.set(0, 1.17, 2); goal.setEnabled(false);
      const sparks = []; const sSpark = keep(B.MeshBuilder.CreateBox('forgeSpark', { size: .04 }, scene)); sSpark.material = coalM; sSpark.isVisible = false;
      const spark = (n) => { for (let k = 0; k < n; k++) { const s = sSpark.createInstance('forgeSparkI'); s.parent = ctx.frame; ctx.add(s); s.position.set(0, 1.2, 2); const a = Math.random() * Math.PI * 2; sparks.push({ s, v: new V3(Math.cos(a) * (1 + Math.random() * 2), 2 + Math.random() * 3, Math.sin(a) * (1 + Math.random() * 2)), t: 0 }); } };
      // the glow of hot steel: 0 cold grey .. 1 white
      const glow = (h) => { const c = h < .3 ? [.3 + h * 1.5, .3 - h * .5, .32 - h * .9] : h < .55 ? [.75 + (h - .3), .15 + (h - .3) * 1.2, .05] : h < .8 ? [1, .45 + (h - .55) * 1.6, .1 + (h - .55) * .4] : [1, .85 + (h - .8) * .7, .2 + (h - .8) * 3.5];
        steelM.diffuseColor.set(...c.map(v => Math.min(1, v * .6))); steelM.emissiveColor.set(...c.map(v => Math.min(1, v) * Math.min(1, h * 1.6))); };
      const st = { phase: 'intro', wait: 1.3, fold: 0, heat: 0, quality: 0, log: [], strikes: 0, ring: null, hit: [], quench: 0, held: false, msgT: 0, hammer: 0 };
      const band = () => { const w = .2 - st.fold * .02; return [.66 - w / 2, .66 + w / 2]; };
      ctx.player.place(.2, 3.35, Math.PI);
      const look = () => ctx.look([.9, 2.9, -2.4], [-.2, 1.1, 2.3], def.fov || .85);
      look();
      H.title(def.title || "The Swordsmith's Forge"); H.score(0);
      const info = () => H.info(`Fold ${Math.min(FOLDS, st.fold + 1)} / ${FOLDS}${st.log.length ? ' · ' + st.log.map(l => l.q).join(' + ') : ''}`);
      info(); H.msg("The Swordsmith's Forge", 1300, `fold the steel ${FOLDS} times`);
      function startHeat() { st.phase = 'heat'; st.heat = Math.max(.08, st.heat * .5); steel.position.set(-2, 1.02, 2.4); steel.rotation.y = 0; ring.setEnabled(false); goal.setEnabled(false);
        H.hint('Hold <kbd>Space</kbd> to work the bellows; let go when the steel glows in the gold band.'); }
      function toAnvil() {
        const [a, b] = band(), h = st.heat; let q = 0, note = '';
        if (h < a) { q = Math.max(0, 10 - (a - h) * 60); note = h < a - .12 ? 'cold: it cracks' : 'a little cold'; } else if (h > b) { q = Math.max(0, 10 - (h - b) * 60); note = h > b + .12 ? 'too hot: it burns' : 'a little hot'; } else { q = 10; note = 'just right'; }
        st.cur = { heat: Math.round(q), strikes: [] }; H.meter(null); H.msg(note, 800);
        st.phase = 'move'; st.t = 0; H.hint('');
      }
      function nextStrike() { st.phase = 'strike'; const sp = 1.15 + st.fold * .12; st.ring = { t: 0, dur: 1 / sp, size: 1.2 }; ring.setEnabled(true); goal.setEnabled(true); H.hint('Strike (<kbd>Space</kbd> or click) as the ring meets the gold circle.'); }
      function strike() {
        if (st.phase !== 'strike' || !st.ring) return;
        const r = st.ring, s = 1.2 - (1.2 - .36) * (r.t / r.dur), err = Math.abs(s - .36) / (1.2 - .36) * r.dur; // seconds off the gold circle
        const q = err < .06 ? 10 : err < .14 ? 6 : err < .24 ? 3 : 0; st.cur.strikes.push(q); st.hammer = .22; if (PACK) ctx.player.clip('game_throw', { from: .72 }); else ctx.player.clip('cross_punch');
        ctx.sound('thock'); spark(q >= 6 ? 14 : 6); H.msg(q === 10 ? 'Perfect' : q === 6 ? 'Good' : q ? 'Rough' : 'Miss', 450);
        steel.scaling.z = 1 + st.cur.strikes.length * .12; st.heat = Math.max(0, st.heat - .07);
        ring.setEnabled(false); goal.setEnabled(false); st.ring = null;
        if (st.cur.strikes.length >= 3) { st.phase = 'fold'; st.t = 0; } else { st.phase = 'gap'; st.t = 0; }
      }
      function endFold() {
        const q = st.cur.heat + st.cur.strikes.reduce((a, b) => a + b, 0); st.log.push({ q }); st.quality += q; H.score(st.quality); st.fold++; info();
        if (st.fold >= FOLDS) { st.phase = 'quench'; st.t = 0; steel.position.set(1.4, 1.2, 2.2); H.hint('The quench: stop the sweep (<kbd>Space</kbd>) in the narrow moonlight band.'); }
        else startHeat();
      }
      function quench() {
        if (st.phase !== 'quench') return;
        const p = U.pingPong(st.t, .62), d = Math.abs(p - .5), k = d < .035 ? 1.3 : d < .08 ? 1.1 : d < .16 ? .9 : .7;
        st.quench = k; H.meter(null); steel.position.set(2.1, .5, 2.2); ctx.sound('splash'); glow(.05);
        const total = Math.round(st.quality * k); H.score(total); H.msg(k >= 1.3 ? 'A perfect quench' : k >= 1.1 ? 'A good quench' : k >= .9 ? 'It will hold' : 'Warped a little', 1500, `x${k}`);
        st.phase = 'end'; st.wait = 1.8; st.final = total;
      }
      return {
        update(dt) {
          look(); st.t = (st.t || 0) + dt;
          for (let k = sparks.length - 1; k >= 0; k--) { const s = sparks[k]; s.t += dt; s.v.y -= 9.8 * dt; s.s.position.addInPlace(s.v.scale(dt)); if (s.t > .7) { s.s.dispose(); sparks.splice(k, 1); } }
          coals.material.emissiveColor.set(1, .3 + (st.held && st.phase === 'heat' ? .25 : 0) + Math.sin(st.t * 7) * .04, .06);
          if (PACK && inHand()) st.hammer = 0;
          else if (st.hammer > 0) { st.hammer = Math.max(0, st.hammer - dt); const u = st.hammer > .11 ? 1 - (st.hammer - .11) / .11 : st.hammer / .11; hammerPiv.rotation.x = -.9 + 1.15 * u; } else hammerPiv.rotation.x = -.9 + Math.sin(st.t * 2) * .03;
          if (st.phase === 'intro' && (st.wait -= dt) <= 0) startHeat();
          if (st.phase === 'heat') { st.heat = Math.max(0, Math.min(1, st.heat + (st.held ? .32 + st.fold * .03 : -.05) * dt)); bellows.scaling.y = st.held ? .7 + Math.abs(Math.sin(st.t * 9)) * .5 : 1; glow(st.heat); H.meter({ label: 'Heat', fill: st.heat, value: st.heat, zone: band() }); }
          if (st.phase === 'move') { const u = Math.min(1, st.t / .45); steel.position.set(-2 + 2 * u, 1.02 + .12 + Math.sin(u * Math.PI) * .4, 2.4 - .4 * u); st.heat = Math.max(0, st.heat - .04 * dt); glow(st.heat); if (u >= 1) { steel.position.set(0, 1.2, 2); nextStrike(); } }
          if (st.phase === 'strike' && st.ring) { const r = st.ring; r.t += dt; const s = Math.max(.05, 1.2 - (1.2 - .36) * (r.t / r.dur)); ring.scaling.set(s, 1, s); if (r.t > r.dur * 1.35) { st.cur.strikes.push(0); ring.setEnabled(false); goal.setEnabled(false); st.ring = null; H.msg('Miss', 450); st.phase = st.cur.strikes.length >= 3 ? 'fold' : 'gap'; st.t = 0; } st.heat = Math.max(0, st.heat - .05 * dt); glow(st.heat); }
          if (st.phase === 'gap' && st.t > .35) nextStrike();
          if (st.phase === 'fold') { const u = Math.min(1, st.t / .5); steel.rotation.y = u * Math.PI; steel.scaling.z = 1.36 - .36 * u; if (u >= 1) { steel.scaling.z = 1; endFold(); } }
          if (st.phase === 'quench') { const p = U.pingPong(st.t, .62); H.meter({ label: 'Quench', fill: p, value: p, zone: [.465, .535] }); }
          if (st.phase === 'end' && (st.wait -= dt) <= 0) {
            st.phase = 'done'; H.hint('');
            ctx.finish({ score: st.final, label: 'points', passed: st.final >= (def.pass || 0), extra: `${FOLDS} folds (${st.log.map(l => l.q).join(', ')} of 40), quench x${st.quench}.` });
          }
        },
        key(e, down) {
          if (e.key !== ' ' && e.key !== 'Enter') return;
          const was = st.held; st.held = !!down;
          if (st.phase === 'heat' && was && !down) toAnvil();
          if (down && !e.repeat) { if (st.phase === 'strike') strike(); else if (st.phase === 'quench') quench(); }
        },
        pointer(evt) {
          const T = B.PointerEventTypes;
          if (evt.type === T.POINTERDOWN) { st.held = true; if (st.phase === 'strike') strike(); else if (st.phase === 'quench') quench(); }
          else if (evt.type === T.POINTERUP) { const was = st.held; st.held = false; if (st.phase === 'heat' && was) toAnvil(); }
        },
        _test: { st, band, toAnvil, strike, quench, setHeat: h => { st.heat = h; }, toGoal: () => st.ring ? st.ring.dur - st.ring.t : null },
        dispose() { nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); sparks.forEach(s => { try { s.s.dispose(); } catch (e) {} }); }
      };
    }
  };
  window.RebelGames.register('forge', G);
})();
