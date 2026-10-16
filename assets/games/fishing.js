// Pier Fishing (Oct 15, Chumpz): five casts off the end of a pier. Cast: press Space (or click) to stop the power
// mark; farther casts find bigger fish. Wait: the float bobs; small nibbles are only nibbles, and striking at one scares
// the fish off. When the float goes right under, strike (Space) quickly. Reel: hold Space (or the mouse) to lift the
// green catch zone, let go to drop it; keep the fish inside it until the line is reeled in. The golden snapper lives
// only far out and fights hardest. Score: the catch's points.
// def: { seaY (world height of the sea, -1.6), casts: 5, reach: [6, 22], pass, points, fish (another catch table: [{ name,
//   pts, fight, size, col, far, gold?, boot? }]) }
// With the Rebel's games pack (Forge rigs, v2.24) the Rebel fishes for real: holds the rod (game_fish_wait), winds up and
// casts (game_cast: the float leaves at the release), reels (game_reel) and cheers a catch (game_cheer); the rod rides
// the hands. Without it the rod stands beside the Rebel as before.
(function () {
  const FISH0 = [ // name, points, fight (0..1), size (m), colour, far (how much it favours long casts)
    { name: 'an old boot', pts: 2, fight: .05, size: .32, col: [.3, .22, .15], far: 0, boot: true },
    { name: 'a sardine', pts: 10, fight: .2, size: .28, col: [.62, .7, .78], far: 0 },
    { name: 'a mackerel', pts: 20, fight: .36, size: .42, col: [.3, .5, .55], far: .3 },
    { name: 'a red snapper', pts: 35, fight: .5, size: .56, col: [.85, .3, .28], far: .55 },
    { name: 'a barracuda', pts: 50, fight: .66, size: .8, col: [.55, .6, .62], far: .75 },
    { name: 'a tuna', pts: 70, fight: .78, size: .95, col: [.2, .28, .45], far: .9 },
    { name: 'the golden snapper', pts: 150, fight: .95, size: .7, col: [1, .78, .25], far: 1, gold: true }
  ];
  const CAST_RELEASE = 1.45, CAST_LEN = 2.7; // game_cast: the rod comes forward 1.45 s in, the clip is 2.7 s long
  const G = {
    title: 'Pier Fishing', moves: true,
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, H = ctx.HUD, U = ctx.util, scene = ctx.scene, def = ctx.def;
      const CASTS = def.casts || 5, REACH = def.reach || [6, 22], FISH = def.fish?.length ? def.fish : FISH0;
      const frameY = ctx.toWorld(0, 0, 0).y, WY = (def.seaY ?? -1.6) - frameY + .02;
      const mat = (k, c, em, o = {}) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(...(o.spec || [.15, .15, .15])); if (em) m.emissiveColor = new B.Color3(...em); if (o.flat) m.disableLighting = true; if (o.alpha != null) m.alpha = o.alpha; return m; });
      const rodM = mat('rod', [.42, .28, .14], [.06, .04, .02]), redM = mat('bobRed', [.9, .15, .12], [.35, .05, .04]), whiteM = mat('bobWhite', [.95, .95, .92], [.3, .3, .3]);
      const ringM = mat('ring', [.9, .95, 1], [.6, .7, .8], { flat: true, alpha: .7 }), lineM = new B.Color3(.95, .95, .9);
      const nodes = [], keep = n => { n.parent = n.parent || ctx.frame; ctx.add(n); nodes.push(n); n.isPickable = false; return n; };
      // the rod in the Rebel's right hand, out over the water
      const rod = keep(B.MeshBuilder.CreateCylinder('fishRod', { height: 3, diameterTop: .025, diameterBottom: .07, tessellation: 8 }, scene)); rod.material = rodM;
      const rodBase = new V3(.62, 1.55, .35), rodRest = .95;
      // the rod's pitch comes from the game (0 = straight up, rodRest = out over the water); with the games pack its butt
      // rides the hands (both on it while waiting, the left while the right cranks the reel, the right in a cheer) and in
      // the cast it swings through both hands
      const PACK = !!ctx.player.has?.('game_cast');
      let rodPitch = rodRest, swing = 0, swingTo = 0, move = '';
      const rodB = rodBase.clone(), rodD = new V3(0, 1, 0), UP = new V3(0, 1, 0);
      const handsAt = () => { const r = ctx.player.bone('RightHand'), l = ctx.player.bone('LeftHand'); return r && l ? [ctx.toLocal(r), ctx.toLocal(l)] : null; };
      const poseRod = () => {
        rodD.set(0, Math.cos(rodPitch), Math.sin(rodPitch));
        const h = PACK ? handsAt() : null;
        if (h) {
          const [r, l] = h;
          if (swing > 0) { const d = l.subtract(r); if (d.length() > .04) { d.normalize(); d.y = Math.max(d.y, -.3); d.normalize(); V3.LerpToRef(rodD, d, swing, rodD); rodD.normalize(); } }
          rodB.copyFrom(st.phase === 'reel' ? l : st.phase === 'after' || st.phase === 'windup' || st.phase === 'fly' ? r : V3.Lerp(r, l, .5));
        } else rodB.copyFrom(rodBase);
        rod.position.copyFrom(rodB.add(rodD.scale(1.5)));
        const ax = V3.Cross(UP, rodD), an = Math.acos(Math.max(-1, Math.min(1, V3.Dot(UP, rodD))));
        rod.rotationQuaternion = ax.length() < 1e-6 ? B.Quaternion.Identity() : B.Quaternion.RotationAxis(ax.normalize(), an);
      };
      const setRod = (pitch) => { rodPitch = pitch; };
      const tip = () => rodB.add(rodD.scale(3));
      const play = (name, o) => { if (!PACK || move === name) return; move = name; ctx.player.clip(name, o); };
      const bob = keep(new B.TransformNode('fishBob', scene)); bob.parent = ctx.frame;
      { const top = B.MeshBuilder.CreateSphere('fishBobTop', { diameter: .24, segments: 8, slice: .5 }, scene); top.material = redM; top.parent = bob; top.isPickable = false; ctx.add(top);
        const bot = B.MeshBuilder.CreateSphere('fishBobBot', { diameter: .24, segments: 8, slice: .5 }, scene); bot.material = whiteM; bot.rotation.x = Math.PI; bot.parent = bob; bot.isPickable = false; ctx.add(bot); }
      bob.setEnabled(false);
      let line = null; const drawLine = (a, b) => { const sag = V3.Lerp(a, b, .5); sag.y = Math.min(a.y, b.y) - .25 - V3.Distance(a, b) * .02; const pts = [a, V3.Lerp(a, sag, .5), sag, V3.Lerp(sag, b, .5), b];
        line = B.MeshBuilder.CreateLines('fishLine', { points: pts, updatable: true, instance: line || undefined }, scene); if (!line.parent) { line.parent = ctx.frame; line.color = lineM; line.isPickable = false; ctx.add(line); nodes.push(line); } line.setEnabled(true); };
      const rings = [];
      const splashAt = (p, big) => { const r = keep(B.MeshBuilder.CreateTorus('fishRing', { diameter: .5, thickness: .04, tessellation: 24 }, scene)); r.material = ringM; r.position.set(p.x, WY + .02, p.z); rings.push({ r, t: 0, big }); };
      const fishMats = FISH.map((f, k) => mat('fish' + k, f.col, f.gold ? [.7, .5, .12] : f.col.map(c => c * .2), { spec: [.6, .6, .6] }));
      const makeFish = (k) => { const f = FISH[k], n = keep(new B.TransformNode('fishCatch', scene)); n.parent = ctx.frame; const sz = f.size;
        if (f.boot) { const a = B.MeshBuilder.CreateBox('fishBoot', { width: sz * .5, height: sz * .9, depth: sz * .5 }, scene), b = B.MeshBuilder.CreateBox('fishBootToe', { width: sz * .5, height: sz * .35, depth: sz * .55 }, scene); [a, b].forEach(m => { m.material = fishMats[k]; m.parent = n; m.isPickable = false; ctx.add(m); }); b.position.set(0, -sz * .28, sz * .45); }
        else { const body = B.MeshBuilder.CreateSphere('fishBody', { diameterX: sz * .3, diameterY: sz * .42, diameterZ: sz, segments: 10 }, scene), tail = B.MeshBuilder.CreateDisc('fishTail', { radius: sz * .22, tessellation: 3 }, scene);
          [body, tail].forEach(m => { m.material = fishMats[k]; m.parent = n; m.isPickable = false; ctx.add(m); }); tail.rotation.y = Math.PI / 2; tail.position.z = -sz * .55; tail.rotation.z = Math.PI / 2; }
        return n; };
      // the reel bar (HTML, beside the water)
      const hud = document.getElementById('gameHud');
      const bar = document.createElement('div');
      bar.style.cssText = 'position:absolute;right:max(24px,6vw);top:50%;transform:translateY(-50%);width:54px;height:min(300px,52vh);display:none;pointer-events:none';
      bar.innerHTML = '<div style="position:absolute;left:0;top:0;bottom:0;width:30px;border-radius:15px;background:linear-gradient(#123,#0b1a2a);border:2px solid #d8b35c;overflow:hidden"><div class="fz" style="position:absolute;left:2px;right:2px;border-radius:12px;background:rgba(94,207,140,.6);border:1px solid #9fe8b8"></div><div class="ff" style="position:absolute;left:0;right:0;height:22px;margin-top:-11px;text-align:center;font-size:18px;line-height:22px">🐟</div></div><div style="position:absolute;left:38px;top:0;bottom:0;width:12px;border-radius:6px;background:#1b2230;border:1px solid #555;overflow:hidden"><div class="fp" style="position:absolute;left:0;right:0;bottom:0;background:linear-gradient(#ffd877,#3a8f7a)"></div></div>';
      hud.appendChild(bar);
      const fz = bar.querySelector('.fz'), ffi = bar.querySelector('.ff'), fp = bar.querySelector('.fp');
      const st = { phase: 'intro', t: 0, wait: 1, cast: 0, score: 0, log: [], hold: false, power: 0, land: null, fish: -1, bite: 0, nibbles: 0, reel: null, catchAnim: null, scare: 0, castT: -1 };
      ctx.player.place(0, 0, 0); play('game_fish_wait', { loop: true }); poseRod();
      const look = () => ctx.look([1.6, 4.2, -6], [0, -.5, 9], def.fov || .8);
      look();
      H.title(def.title || 'Pier Fishing'); H.score(0);
      const info = () => H.info(`Cast ${Math.min(CASTS, st.cast + 1)} / ${CASTS}${st.log.length ? ' · ' + st.log.map(l => l.pts).join(' + ') : ''}`);
      info(); H.msg('Pier Fishing', 1200, `${CASTS} casts`);
      const hint = (p) => H.hint(p === 'aim' ? '<kbd>Space</kbd> or click: stop the power mark and cast (farther = bigger fish)' : p === 'wait' ? 'Wait for the float to go right under, then strike: <kbd>Space</kbd>. Nibbles are only nibbles.' : p === 'reel' ? 'Hold <kbd>Space</kbd> (or the mouse) to lift the green zone; keep the fish inside it.' : '');
      function aim() { st.phase = 'aim'; st.t = Math.random() * 2; setRod(rodRest); bob.setEnabled(false); if (line) line.setEnabled(false); hint('aim'); play('game_fish_wait', { loop: true }); }
      function cast() {
        st.power = U.pingPong(st.t, .7); H.meter(null);
        const d = REACH[0] + (REACH[1] - REACH[0]) * st.power, x = (Math.random() - .5) * 2.4;
        st.land = new V3(x, WY, d); hint('');
        if (PACK) { st.phase = 'windup'; st.t = 0; st.castT = 0; swingTo = 1; play('game_cast', { hold: true }); return; } // the float goes at the release
        st.phase = 'fly'; st.t = 0; bob.setEnabled(true); ctx.player.clip('cross_punch');
      }
      function pickFish() {
        const far = st.power, w = FISH.map(f => { if (f.gold && far < .72) return 0; const near = 1 - Math.abs(far - f.far); return Math.max(.02, near * near) * (f.gold ? .45 : f.boot ? .5 : 1); });
        let r = Math.random() * w.reduce((a, b) => a + b, 0); for (let k = 0; k < FISH.length; k++) { r -= w[k]; if (r <= 0) return k; } return 1;
      }
      function strike() {
        if (st.phase === 'bite') {
          st.fish = pickFish(); const f = FISH[st.fish]; st.phase = 'reel'; st.t = 0; ctx.sound('reel');
          st.reel = { zone: .35, zv: 0, fishY: .5, target: .5, fv: 0, prog: .3, size: .3 - f.fight * .08, speed: .25 + f.fight * 1.1, dart: f.fight };
          bar.style.display = 'block'; hint('reel'); H.msg('Hooked!', 700); play('game_reel', { loop: true }); return;
        }
        if (st.phase === 'wait') { st.scare++; H.msg('Too soon', 800, 'the fish swam off'); splashAt(bob.position); st.waitT = 2.5 + Math.random() * 3; st.nibbleT = 1 + Math.random() * 1.5; }
      }
      function endCast(caught) {
        bar.style.display = 'none'; hint('');
        const f = caught ? FISH[st.fish] : null; st.log.push({ name: f ? f.name : 'nothing', pts: f ? f.pts : 0 }); st.score += f ? f.pts : 0; H.score(st.score);
        if (f && !f.boot) play('game_cheer'); else play('game_fish_wait', { loop: true });
        if (f) { ctx.sound('splash'); H.msg(f.gold ? 'The golden snapper!' : f.boot ? 'An old boot…' : 'Caught!', 1500, `${f.name} · ${f.pts} points`);
          const n = makeFish(st.fish); n.position.copyFrom(bob.position); st.catchAnim = { n, t: 0, from: bob.position.clone() }; }
        else { H.msg('It got away', 1200); }
        bob.setEnabled(false); if (line) line.setEnabled(false); st.cast++; info();
        st.phase = 'after'; st.wait = f ? 2.2 : 1.3;
      }
      return {
        update(dt) {
          look(); st.t += dt;
          // the cast move: the rod swings with the hands, the float leaves at the release, back to holding at its end
          if (st.castT >= 0) { st.castT += dt; if (st.castT >= CAST_LEN) { st.castT = -1; swingTo = 0; if (st.phase === 'wait' || st.phase === 'bite' || st.phase === 'fly') play('game_fish_wait', { loop: true }); } }
          if (st.phase === 'windup' && st.castT >= CAST_RELEASE) { st.phase = 'fly'; st.t = 0; bob.setEnabled(true); }
          swing += Math.max(-dt * 2.5, Math.min(dt * 4, swingTo - swing));
          for (let k = rings.length - 1; k >= 0; k--) { const r = rings[k]; r.t += dt; const s = 1 + r.t * (r.big ? 7 : 4); r.r.scaling.set(s, 1, s); r.r.material.alpha = Math.max(0, .7 - r.t * .8); if (r.t > .9) { r.r.dispose(); rings.splice(k, 1); } }
          if (st.catchAnim) { const c = st.catchAnim; c.t += dt; const u = Math.min(1, c.t / .8), e = u * u * (3 - 2 * u); const to = new V3(.2, 2.2, 1.6); c.n.position = V3.Lerp(c.from, to, e); c.n.position.y += Math.sin(u * Math.PI) * 1.2; c.n.rotation.z = Math.sin(c.t * 9) * .4 * (1 - u * .6); c.n.rotation.y = Math.PI / 2; if (c.t > 2.1) { c.n.dispose(); st.catchAnim = null; } }
          if (st.phase === 'intro' && (st.wait -= dt) <= 0) aim();
          if (st.phase === 'aim') { const p = U.pingPong(st.t, .7); H.meter({ label: 'Cast', fill: p, value: p }); setRod(rodRest - .3 * p); }
          poseRod();
          if (st.phase === 'fly') { const u = Math.min(1, st.t / (.6 + st.power * .5)), a = tip(); setRod(rodRest + .55 * Math.min(1, st.t * 4) - .55 * u * .5);
            const p = V3.Lerp(a, st.land, u); p.y += Math.sin(u * Math.PI) * (2 + st.power * 4) * (1 - u * .2); bob.position.copyFrom(p); drawLine(tip(), bob.position);
            if (u >= 1) { splashAt(st.land); ctx.sound('thock'); st.phase = 'wait'; st.t = 0; st.waitT = 2 + Math.random() * 4.5; st.nibbleT = .8 + Math.random() * 1.2; st.dip = 0; hint('wait'); } }
          if (st.phase === 'wait' || st.phase === 'bite') {
            st.dip = Math.max(0, (st.dip || 0) - dt * 2.5);
            if (st.phase === 'wait') { st.waitT -= dt; st.nibbleT -= dt; if (st.nibbleT <= 0) { st.dip = .45; st.nibbleT = .9 + Math.random() * 1.6; st.nibbles++; ctx.note(660, 'pluck'); }
              if (st.waitT <= 0) { st.phase = 'bite'; st.bite = .75; st.dip = 2; splashAt(bob.position, true); ctx.sound('splash'); } }
            else { st.dip = 2; if ((st.bite -= dt) <= 0) { H.msg('Too slow', 900); endCast(false); } }
            bob.position.set(st.land.x, WY + .06 + Math.sin(st.t * 3) * .04 - st.dip * .12, st.land.z); drawLine(tip(), bob.position); setRod(rodRest + .15 - (st.phase === 'bite' ? .1 : 0));
          }
          if (st.phase === 'reel') {
            const R = st.reel;
            R.zv += (st.hold ? 1.4 : -1.15) * dt; R.zv *= Math.pow(.3, dt); R.zone += R.zv * dt; if (R.zone < 0) { R.zone = 0; R.zv = Math.abs(R.zv) * .3; } if (R.zone > 1 - R.size) { R.zone = 1 - R.size; R.zv = -Math.abs(R.zv) * .3; }
            if (Math.random() < dt * (.8 + R.dart * 2.2)) R.target = Math.random();
            R.fv += ((R.target - R.fishY) * R.speed * 6 - R.fv * 2.6) * dt; R.fishY = Math.max(0, Math.min(1, R.fishY + R.fv * dt + (Math.random() - .5) * R.dart * .02));
            const inZ = R.fishY >= R.zone && R.fishY <= R.zone + R.size; R.prog = Math.max(0, Math.min(1, R.prog + (inZ ? .3 : -.22) * dt));
            fz.style.bottom = (R.zone * 100) + '%'; fz.style.height = (R.size * 100) + '%'; ffi.style.bottom = ''; ffi.style.top = ((1 - R.fishY) * 100) + '%'; fp.style.height = (R.prog * 100) + '%';
            fz.style.background = inZ ? 'rgba(94,207,140,.75)' : 'rgba(94,207,140,.35)';
            const pull = Math.sin(st.t * 14) * .08 * (inZ ? .5 : 1); bob.position.set(st.land.x + Math.sin(st.t * 3.1) * .5 * R.dart, WY - .05, st.land.z * (1 - R.prog * .85) + .6); drawLine(tip(), bob.position); setRod(rodRest - .25 + pull);
            if (R.prog >= 1) endCast(true); else if (R.prog <= 0) endCast(false);
          }
          if (st.phase === 'after' && (st.wait -= dt) <= 0) {
            if (st.cast >= CASTS) { st.phase = 'done'; H.hint(''); H.meter(null);
              const best = st.log.reduce((b, l) => l.pts > b.pts ? l : b, { pts: -1 });
              ctx.finish({ score: st.score, label: 'points', passed: st.score >= (def.pass || 0), extra: `${st.log.filter(l => l.pts).length} of ${CASTS} casts landed something; best: ${best.name}.` }); }
            else aim();
          }
        },
        key(e, down) {
          if (e.key !== ' ' && e.key !== 'Enter') return;
          if (down && !e.repeat) { if (st.phase === 'aim') cast(); else if (st.phase === 'wait' || st.phase === 'bite') strike(); }
          st.hold = !!down;
        },
        pointer(evt) {
          const T = B.PointerEventTypes;
          if (evt.type === T.POINTERDOWN) { st.hold = true; if (st.phase === 'aim') cast(); else if (st.phase === 'wait' || st.phase === 'bite') strike(); }
          else if (evt.type === T.POINTERUP) st.hold = false;
        },
        _test: { st, cast, strike, pickFish, FISH, setHold: v => { st.hold = v; } },
        dispose() { bar.remove(); nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); rings.forEach(r => { try { r.r.dispose(); } catch (e) {} }); }
      };
    }
  };
  window.RebelGames.register('fishing', G);
})();
