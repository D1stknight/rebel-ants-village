// Shield wall (Oct 15, Buke gate): spears come from the two bastions; a ring closes on the side the next one will hit.
// Guard that side as it lands (← / A for the left, → / D for the right, or the pads): on time is a clean block (15), a
// little off still blocks (10); the wrong side or too late is a hit; three hits and the wall breaks.
// def: { hits: 3, from: [[x, y, z], [x, y, z]] (frame coords of the left / right bastion), sword, pass, points, cam, at }
// Oct 17 (Miguel: "the game was too fast ... a few more levels ... we need a shield for the character"): a slow first
// wave, a breath between waves, a round shield on the Rebel's left forearm.
// Oct 17 (Miguel: "make it 20 waves, harder as it goes but also mirror the animation to the left ... i also think the
// spear should look better and really hit the shield when its blocked"): twenty waves (more spears, quicker, pairs and
// volleys, two in the air at once later on; a heart back every five waves), started from any wave reached before;
// yari spears (lacquered shaft, steel blade, red tassel); a block turns the Rebel toward the bastion the spear comes
// from (a left block goes left) and the spear flies on into the shield and sticks there (a clean block knocks it away
// in sparks), else it hits the Rebel. The press is on time a moment before the spear lands, as a shield goes up before
// the blow. With the games pack the Rebel holds the shield up with the sword-and-shield moves.
(function () {
  const WAVES = 20, WIN = .24, CLEAN = .09;
  // wave w (0-based): spears, flight seconds to the ring's moment, seconds between landings, chance of a pair / a volley
  const waveOf = (w) => { const u = w / (WAVES - 1); return { n: 4 + Math.floor((w + 2) / 4), T: 2 - 1.1 * u, gap: (2 - 1.1 * u) * (1.4 - .78 * u), pair: w >= 4 ? .15 + .3 * u : 0, volley: w >= 10 ? .1 + .2 * u : 0, close: Math.max(.3, .46 - .16 * u), jitter: w >= 8 ? .14 : 0 }; };
  const G = {
    title: 'Shield Wall', moves: true,
    howTo: { lines: [
      'Spears fly from the two bastions of the gate. A gold ring closes on the side the next one will hit.',
      'Guard that side as the ring meets the white circle: ← / A for the left, → / D for the right, or the pads.',
      'Right on time is a clean block (15): the spear is knocked away. A little early or late still blocks (10): it sticks in the shield.',
      'The wrong side, or no guard at all, is a hit. Three hits and the wall breaks; every fifth wave gives a heart back.',
      'Twenty waves, each faster than the last: pairs from both sides, then volleys, then two spears in the air at once.',
      'Five clean blocks in a row add 5 to every block. Start again from any wave you have reached.'] },
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const MAXH = def.hits || 3, FROM = (def.from || [[-14, 4.5, 7], [14, 4.5, 7]]).map(p => new V3(...p));
      const CHEST = [new V3(-.3, 2.1, .1), new V3(.3, 2.1, .1)], RING = [new V3(-1.2, 2.2, .35), new V3(1.2, 2.2, .35)];
      const store = ctx.util.levelStore(def.id || 'guard');
      const mat = (k, c, em, spec = .1) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(spec, spec, spec); if (em) m.emissiveColor = new B.Color3(...em); return m; });
      // a yari: a black lacquered shaft, a straight double-edged steel blade on a brass collar, a red tassel, an iron butt
      // cap (instances of hidden sources; the spear's tip is its local +z)
      const LEN = 2.6, src = (m, mt) => { m.material = mt; m.isPickable = false; m.isVisible = false; ctx.add(m); return m; };
      const sShaft = src(B.MeshBuilder.CreateCylinder('guardShaft', { height: LEN, diameter: .05, tessellation: 8 }, scene), mat('yariShaft', [.09, .06, .05], null, .5));
      const sBlade = src(B.MeshBuilder.CreateCylinder('guardBlade', { height: .42, diameterTop: 0, diameterBottom: .085, tessellation: 4 }, scene), mat('yariBlade', [.7, .72, .76], [.08, .08, .09], .9));
      const sCollar = src(B.MeshBuilder.CreateCylinder('guardCollar', { height: .09, diameter: .075, tessellation: 8 }, scene), mat('yariBrass', [.62, .48, .2], [.08, .06, .02], .7));
      const sTassel = src(B.MeshBuilder.CreateCylinder('guardTassel', { height: .26, diameterTop: .07, diameterBottom: .15, tessellation: 8 }, scene), mat('yariTassel', [.62, .06, .05], [.12, .01, .01]));
      const sCap = src(B.MeshBuilder.CreateCylinder('guardCap', { height: .12, diameterTop: .06, diameterBottom: .03, tessellation: 8 }, scene), mat('yariCap', [.2, .2, .22], null, .6));
      function spearMesh() {
        const n = new B.TransformNode('guardSpear', scene); ctx.add(n);
        const part = (s, z, flatK) => { const i = s.createInstance('gsp'); i.parent = n; i.rotation.x = Math.PI / 2; i.position.z = z; if (flatK) i.scaling.x = flatK; return i; };
        part(sShaft, -LEN / 2 + .02); part(sBlade, .21, .45); part(sCollar, -.04); part(sTassel, -.2); part(sCap, -LEN + .06);
        return n;
      }
      // the rings (one per spear in the air) and the side glyph, in screen space
      const hud = document.getElementById('gameHud');
      // the guard buttons fire as the finger touches (Oct 24: on click they waited for the finger to lift, late in a timing game)
      const pads = document.createElement('div'); pads.style.cssText = 'position:absolute;bottom:62px;left:50%;transform:translateX(-50%);display:none;gap:14px;pointer-events:auto';
      ['left', 'right'].forEach((d, i) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = i ? '→' : '←'; b.style.cssText = 'width:64px;height:48px;border-radius:10px;border:1px solid #d8b35c;background:rgba(20,16,10,.8);color:#ffe9b0;font:700 22px Georgia,serif;cursor:pointer;touch-action:none'; b.onpointerdown = (e) => { e.preventDefault(); e.stopPropagation(); guard(i); }; pads.appendChild(b); });
      hud.append(pads);
      const ringEl = (side) => { const r = document.createElement('div'); r.style.cssText = 'position:absolute;border:3px solid rgba(255,216,119,.95);border-radius:50%;transform:translate(-50%,-50%);pointer-events:none;box-shadow:0 0 12px rgba(255,190,80,.6)';
        const c = document.createElement('div'); c.style.cssText = 'position:absolute;width:58px;height:58px;border:2px solid rgba(255,255,255,.75);border-radius:50%;transform:translate(-50%,-50%);pointer-events:none;font:700 34px/58px Georgia,serif;color:#ffe9b0;text-align:center;text-shadow:0 2px 0 #000';
        c.textContent = side ? '→' : '←'; hud.append(r, c); return { r, c }; };
      // the shield: a round targe (wood, iron rim and boss, the Buke trident painted on) strapped to the left forearm
      const shield = new B.TransformNode('guardShield', scene); ctx.add(shield);
      { const tex = new B.DynamicTexture('guardShieldTex', { width: 256, height: 256 }, scene, true), g = tex.getContext();
        g.fillStyle = '#5c2a17'; g.fillRect(0, 0, 256, 256); g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 3; for (let x = 18; x < 256; x += 34) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 8, 256); g.stroke(); }
        g.strokeStyle = '#d8b35c'; g.fillStyle = '#d8b35c'; g.lineWidth = 12; g.lineCap = 'round'; g.beginPath(); g.moveTo(128, 214); g.lineTo(128, 52); g.moveTo(74, 66); g.quadraticCurveTo(80, 128, 128, 140); g.quadraticCurveTo(176, 128, 182, 66); g.stroke();
        for (const x of [74, 128, 182]) { g.beginPath(); g.moveTo(x - 13, x === 128 ? 60 : 74); g.lineTo(x, x === 128 ? 30 : 44); g.lineTo(x + 13, x === 128 ? 60 : 74); g.fill(); }
        tex.update(); ctx.add(tex);
        const face = ctx.mat('shieldFace', n => { const m = new B.StandardMaterial(n, scene); m.diffuseTexture = tex; m.specularColor = new B.Color3(.08, .08, .08); m.emissiveColor = new B.Color3(.06, .04, .03); return m; });
        const rim = mat('shieldRim', [.55, .5, .42], [.05, .05, .04], .5);
        const disc = B.MeshBuilder.CreateCylinder('guardShieldDisc', { height: .06, diameter: .95, tessellation: 28, faceUV: [new B.Vector4(0, 0, 0, 0), new B.Vector4(0, 0, 0, 0), new B.Vector4(0, 0, 1, 1)] }, scene); disc.material = face; disc.parent = shield; disc.rotation.x = -Math.PI / 2; disc.isPickable = false;
        const ring = B.MeshBuilder.CreateTorus('guardShieldRim', { diameter: .95, thickness: .06, tessellation: 28 }, scene); ring.material = rim; ring.parent = shield; ring.rotation.x = Math.PI / 2; ring.isPickable = false;
        const boss = B.MeshBuilder.CreateSphere('guardShieldBoss', { diameter: .2, segments: 8 }, scene); boss.material = rim; boss.parent = shield; boss.position.z = .05; boss.scaling.z = .5; boss.isPickable = false; }
      // the face points away from the body, square to the forearm it is strapped to
      const shieldOnArm = () => { const h = ctx.player.bone('LeftHand'), f = ctx.player.bone('LeftForeArm'), c = ctx.player.bone('Spine2') || ctx.player.bone('Spine1'); if (!h || !f) { shield.setEnabled(false); return false; }
        shield.setEnabled(true); const lh = ctx.toLocal(h), lf = ctx.toLocal(f), mid = V3.Lerp(lf, lh, .6), body = c ? ctx.toLocal(c) : new V3(0, mid.y, 0), arm = lh.subtract(lf).normalize();
        const out = mid.subtract(body); out.y *= .3; out.subtractInPlace(arm.scale(V3.Dot(out, arm))); if (out.lengthSquared() < 1e-4) out.set(-1, 0, 0); out.normalize();
        shield.position.copyFrom(mid.add(out.scale(.12))); shield.rotationQuaternion = B.Quaternion.FromLookDirectionLH(out, arm); return true; };
      const shieldOut = () => { const m = new B.Matrix(); (shield.rotationQuaternion || B.Quaternion.Identity()).toRotationMatrix(m); return V3.TransformNormal(V3.Forward(), m).normalize(); }; // in the frame
      // sparks (a clean block) and splinters
      const sSpark = src(B.MeshBuilder.CreateBox('guardSpark', { size: .045 }, scene), mat('guardSparkM', [1, .7, .3], [1, .62, .2]));
      const bits = [];
      const burst = (p, n, hot) => { for (let k = 0; k < n; k++) { const b = sSpark.createInstance('gsk'); ctx.add(b); b.position.copyFrom(p); if (!hot) b.scaling.set(.7, .7, 2.2); const a = Math.random() * Math.PI * 2; bits.push({ b, v: new V3(Math.cos(a) * (1 + Math.random() * 2.4), 1.2 + Math.random() * 2.6, Math.sin(a) * (1 + Math.random() * 2) - 1), t: 0, life: hot ? .45 : .7 }); } };
      // ── state ──
      const st = { phase: 'pick', wave: 0, from: 0, score: 0, hits: 0, blocks: 0, clean: 0, combo: 0, total: 0, wait: 0, live: [], plan: [], clock: 0, flying: [], down: [], yaw: 0, turn: null, turnT: 0, moveT: 0, sword: null, wavesDone: 0, hitInWave: false };
      const PACK = () => !!ctx.player.has?.('game_shield_idle');
      const stance = () => { if (PACK()) ctx.player.clip('game_shield_idle', { loop: true }); else if (st.sword) ctx.player.clip('sword_idle', { loop: true }); };
      const info = () => H.info(`Wave ${st.wave + 1} / ${WAVES} · ${'♥'.repeat(Math.max(0, MAXH - st.hits))}${'♡'.repeat(Math.min(MAXH, st.hits))}`);
      // a wave's spears: landings `gap` apart (pairs and volleys from both sides closer), each thrown its flight time before
      function plan(w) {
        const W = waveOf(w), out = []; let t = 1.0, k = 0;
        while (k < W.n) {
          const r = Math.random(), side = Math.random() < .5 ? 0 : 1, grp = W.volley && r < W.volley && W.n - k >= 3 ? 3 : W.pair && r < W.volley + W.pair && W.n - k >= 2 ? 2 : 1;
          for (let j = 0; j < grp; j++) { const T = W.T * (1 + (Math.random() * 2 - 1) * W.jitter); out.push({ land: t + j * W.close, side: (side + j) % 2, T }); k++; }
          t += (grp - 1) * W.close + W.gap * (1 + (Math.random() - .5) * .3);
        }
        out.forEach(s => { s.at = s.land - s.T; }); const lead = Math.min(0, ...out.map(s => s.at - .2)); out.forEach(s => { s.at -= lead; s.land -= lead; });
        return out.sort((a, b) => a.at - b.at);
      }
      function startWave(w) {
        st.wave = w; st.plan = plan(w); st.clock = 0; st.hitInWave = false; st.phase = 'play'; info();
        const W = waveOf(w); H.msg(`Wave ${w + 1}`, 1500, w === 0 ? `${W.n} spears` : W.volley ? 'volleys from both bastions' : W.pair ? 'they throw in pairs now' : 'they throw faster now');
      }
      function launch(p) { const s = { side: p.side, T: p.T, D: p.T + WIN, t: 0, n: spearMesh(), judged: null, ring: ringEl(p.side), prev: null }; s.n.position.copyFrom(FROM[p.side]); st.live.push(s); ctx.sound('whoosh'); }
      function dropRing(s) { if (s.ring) { s.ring.r.remove(); s.ring.c.remove(); s.ring = null; } }
      function judge(s, kind, side) {
        s.judged = kind; dropRing(s);
        if (kind === 'clean' || kind === 'block') {
          st.blocks++; st.combo++; if (kind === 'clean') st.clean++;
          const pts = (kind === 'clean' ? 15 : 10) + (st.combo >= 5 ? 5 : 0); st.score += pts; H.score(st.score);
          const p = ctx.screenOf(ctx.toWorld(RING[s.side].x, RING[s.side].y + .5, RING[s.side].z)); H.pop(p.x, p.y, '+' + pts);
          H.msg(kind === 'clean' ? 'Clean block!' : 'Blocked', 600);
        } else { st.combo = 0; if (kind === 'wrong') H.msg('Wrong side!', 700); }
        // the guard goes up on the side pressed (the wrong side too), turned toward that bastion
        if (side != null) { st.turn = side; st.turnT = .75; if (PACK()) { ctx.player.clip('game_shield_block', { hold: true, speed: 1.7 }); st.moveT = .9; } else if (st.sword) { ctx.player.clip('sword_block', { hold: true, speed: 1.6 }); st.moveT = .8; } }
      }
      function hitRebel(s) {
        st.hits++; st.combo = 0; st.hitInWave = true; if (s.judged !== 'wrong') H.msg('Hit!', 700); ctx.sound('thock');
        ctx.player.clip(PACK() ? 'game_shield_hit' : 'hit_reaction'); st.moveT = 1.1; info();
        st.down.push({ n: s.n, v: new V3((Math.random() - .5) * 1.2, .5, .5), spin: (Math.random() - .5) * 6, t: 0, rest: false });
      }
      function landed(s) {
        const at = s.n.position.clone();
        if (s.judged === 'clean') { // knocked away: off the shield's face, spinning, then on the ground
          ctx.sound('clang'); ctx.sound('thock'); burst(at, 14, true);
          const v = (s.vel || new V3(0, 0, -8)).scale(-.16).add(shieldOut().scale(2.2)); v.y = 2.6 + Math.random();
          st.down.push({ n: s.n, v, spin: (s.side ? 1 : -1) * (7 + Math.random() * 4), t: 0, rest: false });
        } else { // stuck in the shield: it rides the shield a moment, then the weight pulls it out
          ctx.sound('thock'); burst(at, 6, false);
          if (PACK()) { ctx.player.clip('game_shield_impact', { hold: true, speed: 1.3 }); st.moveT = .8; }
          s.n.computeWorldMatrix(true); shield.computeWorldMatrix(true); s.n.setParent(shield); // it rides the shield as it is
          st.flying.push({ n: s.n, t: 0 });
        }
      }
      function guard(side) {
        if (st.phase !== 'play') return;
        const live = st.live.filter(s => !s.judged);
        const mine = live.filter(s => s.side === side).sort((a, b) => (a.T - a.t) - (b.T - b.t))[0];
        if (mine && mine.t >= mine.T - WIN) return judge(mine, Math.abs(mine.t - mine.T) <= CLEAN ? 'clean' : 'block', side);
        const other = live.filter(s => s.side !== side && s.t >= s.T - WIN).sort((a, b) => (a.T - a.t) - (b.T - b.t))[0];
        if (other) return judge(other, 'wrong', side);
        if (mine) H.msg('Too soon', 500);
      }
      // ── the wave picker: start from any wave reached before ──
      let picker = null;
      const showPicker = () => { pads.style.display = 'none'; picker = H.levels({ title: def.title || 'Shield Wall', sub: 'Twenty waves, each faster than the last. Start from any wave you have reached.', n: WAVES, open: store.open(WAVES), done: store.get(), label: k => k === 0 ? `${waveOf(k).n} spears` : `${waveOf(k).n} · ${waveOf(k).T.toFixed(1)} s`, pick: begin }); };
      function begin(k) {
        if (st.phase !== 'pick') return; if (picker) { picker.remove(); picker = null; }
        Object.assign(st, { from: k, score: 0, hits: 0, blocks: 0, clean: 0, combo: 0, total: 0, wavesDone: 0 }); H.score(0);
        pads.style.display = 'flex'; startWave(k);
      }
      function endRun(broke) {
        st.phase = 'end'; st.wait = 1.4; st.broke = broke;
        store.set(Math.min(WAVES, st.wave + (broke ? 0 : 1))); // the furthest wave reached opens on the picker
      }
      ctx.player.place(0, 0, 0);
      const cam = def.cam || [-1.3, 3.9, -5.4], at = def.at || [.2, 2.1, 3.5];
      ctx.look(cam, at, def.fov || 1.0);
      H.title(def.title || 'Shield Wall'); H.score(0); info();
      H.hint('Guard the side the ring shows as it meets the circle: <kbd>←</kbd> / <kbd>A</kbd> left, <kbd>→</kbd> / <kbd>D</kbd> right, or the pads');
      showPicker();
      ctx.player.weapon('sword', def.sword || 'eclipse_edge').then(w => { if (!w || st.phase === 'done') return; st.sword = w; stance(); });
      if (PACK()) stance();
      const inst = {
        update(dt) {
          ctx.look(cam, at); const armed = shieldOnArm();
          // the turn: while the guard is up the Rebel turns so the shield lies on the line to that bastion, then back
          if (st.turn != null && (st.turnT -= dt) > 0) {
            const pl = ctx.player.pos(), src = FROM[st.turn];
            if (armed) { const sh = shield.position; let e = Math.atan2(src.x - pl.x, src.z - pl.z) - Math.atan2(sh.x - pl.x, sh.z - pl.z); e = Math.atan2(Math.sin(e), Math.cos(e)); st.yaw = Math.max(-.9, Math.min(.9, st.yaw + e * Math.min(1, dt * 14))); }
            else st.yaw += ((st.turn ? .45 : -.45) - st.yaw) * Math.min(1, dt * 14);
          } else { st.turn = null; st.yaw *= Math.max(0, 1 - dt * 6); }
          ctx.player.face(st.yaw);
          if (st.moveT > 0 && (st.moveT -= dt) <= 0) stance();
          if (st.phase === 'play') {
            st.clock += dt;
            while (st.plan.length && st.plan[0].at <= st.clock) launch(st.plan.shift());
            for (const s of st.live) {
              if (s.done) continue;
              s.t += dt; const u = Math.min(1, s.t / s.D), a = FROM[s.side];
              // the tip's line: to the chest, or once guarded into the shield (a clean block meets its face, else the
              // tip goes just through the wood, where it sticks); a low arc over the yard
              const guarded = s.judged === 'clean' || s.judged === 'block';
              if (guarded && armed && !s.off) s.off = new V3((Math.random() - .5) * .3, (Math.random() - .5) * .3, 0);
              const target = guarded ? (armed ? shield.position.add(shieldOut().scale(s.judged === 'clean' ? .05 : -.04)).add(s.off ? V3.TransformNormal(s.off, (() => { const m = new B.Matrix(); shield.rotationQuaternion.toRotationMatrix(m); return m; })()) : V3.Zero()) : RING[s.side]) : CHEST[s.side];
              s.tgt = s.tgt ? V3.Lerp(s.tgt, target, Math.min(1, dt * 14)) : target.clone(); // eased: no jump when the guard goes up
              const p = V3.Lerp(a, s.tgt, u); p.y += Math.sin(u * Math.PI) * .9 * s.D / 2.24;
              if (s.prev) { const d = p.subtract(s.prev); if (d.lengthSquared() > 1e-8) { s.vel = d.scale(1 / Math.max(dt, 1e-3)); s.dir = d.normalize(); s.n.rotationQuaternion = B.Quaternion.FromLookDirectionLH(s.dir, V3.Up()); } }
              s.prev = p.clone(); s.n.position.copyFrom(s.dir ? p.subtract(s.dir.scale(.42)) : p);
              if (s.ring) { const rp = ctx.screenOf(ctx.toWorld(RING[s.side].x, RING[s.side].y, RING[s.side].z)), k = Math.max(0, 1 - s.t / s.T), size = 58 * (1 + 2.6 * k);
                s.ring.r.style.left = s.ring.c.style.left = rp.x + 'px'; s.ring.r.style.top = s.ring.c.style.top = rp.y + 'px'; s.ring.r.style.width = s.ring.r.style.height = size + 'px'; }
              if (u >= 1) { s.done = true; dropRing(s); if (s.judged === 'clean' || s.judged === 'block') landed(s); else { if (!s.judged) s.judged = 'hit'; hitRebel(s); } }
            }
            st.live = st.live.filter(s => !s.done);
            if (st.hits >= MAXH) { st.live.forEach(s => { dropRing(s); s.n.dispose(); }); st.live = []; endRun(true); }
            else if (!st.plan.length && !st.live.length) { // the wave is held
              st.score += 10 * (st.wave + 1); H.score(st.score); st.wavesDone++;
              if (st.wave + 1 >= WAVES) { endRun(false); }
              else { st.phase = 'break'; st.wait = 2.2; store.set(st.wave + 1);
                if ((st.wave + 1) % 5 === 0 && st.hits > 0) { st.hits--; H.msg(`Wave ${st.wave + 1} held`, 1500, 'a heart back'); } else H.msg(`Wave ${st.wave + 1} held`, 1300, `+${10 * (st.wave + 1)}`); info(); }
            }
          }
          if (st.phase === 'break' && (st.wait -= dt) <= 0) startWave(st.wave + 1);
          // spears stuck in the shield pull out and fall; knocked or dropped ones fall, roll a little and lie on the yard
          for (let i = st.flying.length - 1; i >= 0; i--) { const f = st.flying[i]; if ((f.t += dt) > .7) { f.n.computeWorldMatrix(true); f.n.setParent(ctx.frame); st.down.push({ n: f.n, v: new V3(0, -.2, -.6), spin: (Math.random() - .5) * 3, t: 0, rest: false }); st.flying.splice(i, 1); } }
          for (let i = st.down.length - 1; i >= 0; i--) { const f = st.down[i]; f.t += dt;
            if (!f.rest) { f.v.y -= 9.8 * dt; f.n.position.addInPlace(f.v.scale(dt)); f.n.rotationQuaternion = (f.n.rotationQuaternion || B.Quaternion.Identity()).multiply(B.Quaternion.RotationAxis(V3.Right(), f.spin * dt));
              if (f.n.position.y <= .05) { f.n.position.y = .05; f.rest = true; const m = new B.Matrix(); f.n.rotationQuaternion.toRotationMatrix(m); const fw = V3.TransformNormal(V3.Forward(), m); fw.y = 0; if (fw.lengthSquared() < 1e-4) fw.set(0, 0, 1); f.n.rotationQuaternion = B.Quaternion.FromLookDirectionLH(fw.normalize(), V3.Up()); } }
            if (f.t > 3.2) { f.n.dispose(); st.down.splice(i, 1); } }
          for (let i = bits.length - 1; i >= 0; i--) { const b = bits[i]; b.t += dt; b.v.y -= 9.8 * dt; b.b.position.addInPlace(b.v.scale(dt)); if (b.t > b.life) { b.b.dispose(); bits.splice(i, 1); } }
          if (st.phase === 'end' && (st.wait -= dt) <= 0) {
            st.phase = 'done'; H.hint(''); pads.remove();
            if (st.score >= (def.pass || 0)) ctx.sound('gamewin');
            const reached = st.broke ? `The wall broke in wave ${st.wave + 1}` : 'All twenty waves held';
            ctx.finish({ score: st.score, label: 'points', next: null, extra: `${reached} (${st.blocks} spears blocked, ${st.clean} clean${st.from ? `, from wave ${st.from + 1}` : ''}).` });
          }
        },
        key(e, down) { if (!down || e.repeat) return; if (picker && picker.key(e)) return true; const k = e.key.toLowerCase(); if (k === 'arrowleft' || k === 'a') { guard(0); return true; } if (k === 'arrowright' || k === 'd') { guard(1); return true; } },
        pointer() {},
        restart() { if (st.phase === 'pick') return; st.live.forEach(s => { dropRing(s); s.n.dispose(); }); st.live = []; st.plan = []; st.phase = 'pick'; showPicker(); },
        _test: { st, guard, begin, waveOf, plan, shield, PACK, FROM },
        dispose() { pads.remove(); if (picker) picker.remove(); st.live.forEach(s => { dropRing(s); try { s.n.dispose(); } catch (e) {} }); st.flying.concat(st.down).forEach(f => { try { f.n.dispose(); } catch (e) {} }); bits.forEach(b => { try { b.b.dispose(); } catch (e) {} }); }
      };
      return inst;
    }
  };
  window.RebelGames.register('guard', G);
})();
