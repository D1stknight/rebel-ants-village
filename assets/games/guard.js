// Shield wall (Oct 15, Buke gate): arrows come from the two bastions; a ring closes on the side the next one will hit.
// Guard that side as it lands (← / A for the left, → / D for the right, or the pads): on time is a clean block (15), a
// little off still blocks (10); the wrong side or too late is a hit. Twenty arrows, quicker as they come; three hits and
// the wall breaks. A Forge Rebel guards with a lent katana and its own block move.
// def: { arrows: 20, hits: 3, from: [[x, y, z], [x, y, z]] (frame coords of the left / right bastion), sword, pass, points }
// Oct 17 (Miguel: "the game was too fast ... a few more levels ... we need a shield for the character"): three waves
// (the first slow: an arrow takes 2 s, the last 1.2 s), a breath between them, the timing a little kinder; a round
// shield rides the Rebel's left forearm.
(function () {
  const G = {
    title: 'Shield Wall',
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const N = def.arrows || 24, MAXH = def.hits || 3, WAVES = def.waves || 3, PER = Math.ceil(N / WAVES);
      const FROM = (def.from || [[-14, 4.5, 7], [14, 4.5, 7]]).map(p => new V3(...p));
      const SIDE = [new V3(-.75, 2.2, .35), new V3(.75, 2.2, .35)];
      const mat = (k, c, em) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(.1, .1, .1); if (em) m.emissiveColor = new B.Color3(...em); return m; });
      // an arrow: shaft, head, fletching (instances of hidden sources)
      const src = (m) => { m.isPickable = false; m.isVisible = false; ctx.add(m); return m; };
      const shaft = src(B.MeshBuilder.CreateCylinder('guardShaft', { height: 1.3, diameter: .045, tessellation: 5 }, scene)); shaft.material = mat('shaft', [.42, .28, .14]);
      const head = src(B.MeshBuilder.CreateCylinder('guardHead', { height: .18, diameterTop: 0, diameterBottom: .09, tessellation: 4 }, scene)); head.material = mat('steel', [.55, .57, .62], [.06, .06, .08]);
      const fl = src(B.MeshBuilder.CreatePlane('guardFletch', { width: .1, height: .26 }, scene)); fl.material = mat('fletch', [.85, .82, .75]); fl.material.backFaceCulling = false;
      function arrowMesh() {
        const n = new B.TransformNode('guardArrow', scene); ctx.add(n);
        const a = shaft.createInstance('ga'); a.parent = n; a.rotation.x = Math.PI / 2;
        const h = head.createInstance('gh'); h.parent = n; h.rotation.x = Math.PI / 2; h.position.z = .72;
        for (let k = 0; k < 2; k++) { const f = fl.createInstance('gf'); f.parent = n; f.position.z = -.55; f.rotation.set(Math.PI / 2, 0, k * Math.PI / 2); }
        return n;
      }
      // the ring and the side glyph (screen space)
      const hud = document.getElementById('gameHud');
      const ringEl = document.createElement('div'); ringEl.style.cssText = 'position:absolute;border:3px solid rgba(255,216,119,.95);border-radius:50%;transform:translate(-50%,-50%);pointer-events:none;box-shadow:0 0 12px rgba(255,190,80,.6);display:none';
      const coreEl = document.createElement('div'); coreEl.style.cssText = 'position:absolute;width:58px;height:58px;border:2px solid rgba(255,255,255,.75);border-radius:50%;transform:translate(-50%,-50%);pointer-events:none;display:none;font:700 34px/58px Georgia,serif;color:#ffe9b0;text-align:center;text-shadow:0 2px 0 #000';
      const pads = document.createElement('div'); pads.style.cssText = 'position:absolute;bottom:62px;left:50%;transform:translateX(-50%);display:flex;gap:14px;pointer-events:auto';
      ['left', 'right'].forEach((d, i) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = i ? '→' : '←'; b.style.cssText = 'width:64px;height:48px;border-radius:10px;border:1px solid #d8b35c;background:rgba(20,16,10,.8);color:#ffe9b0;font:700 22px Georgia,serif;cursor:pointer'; b.onclick = (e) => { e.stopPropagation(); b.blur(); guard(i); }; pads.appendChild(b); });
      hud.append(ringEl, coreEl, pads);
      // ── state ──
      const st = { k: 0, score: 0, hits: 0, blocks: 0, clean: 0, combo: 0, phase: 'intro', wait: 1.6, cur: null, flying: [], sword: null };
      const info = () => H.info(`Wave ${Math.min(WAVES, Math.floor(st.k / PER) + 1)} / ${WAVES} · arrow ${Math.min(st.k + 1, N)} / ${N} · ${'♥'.repeat(Math.max(0, MAXH - st.hits))}`);
      // the shield: a round targe with a rim and a boss, on the left forearm, facing out from the body
      const shield = new B.TransformNode('guardShield', scene); ctx.add(shield);
      { const wood = mat('shieldWood', [.36, .2, .12]), rim = mat('shieldRim', [.55, .5, .42], [.05, .05, .04]);
        const disc = B.MeshBuilder.CreateCylinder('guardShieldDisc', { height: .06, diameter: .95, tessellation: 24 }, scene); disc.material = wood; disc.parent = shield; disc.rotation.x = Math.PI / 2; disc.isPickable = false;
        const ring = B.MeshBuilder.CreateTorus('guardShieldRim', { diameter: .95, thickness: .06, tessellation: 24 }, scene); ring.material = rim; ring.parent = shield; ring.rotation.x = Math.PI / 2; ring.isPickable = false;
        const boss = B.MeshBuilder.CreateSphere('guardShieldBoss', { diameter: .2, segments: 8 }, scene); boss.material = rim; boss.parent = shield; boss.position.z = .05; boss.scaling.z = .5; boss.isPickable = false; }
      const shieldOnArm = () => { const h = ctx.player.bone('LeftHand'), f = ctx.player.bone('LeftForeArm'), c = ctx.player.bone('Spine2') || ctx.player.bone('Spine1'); if (!h || !f) { shield.setEnabled(false); return; }
        shield.setEnabled(true); const lh = ctx.toLocal(h), lf = ctx.toLocal(f), mid = V3.Lerp(lf, lh, .6), body = c ? ctx.toLocal(c) : new V3(0, mid.y, 0);
        const out = mid.subtract(body); out.y = 0; if (out.lengthSquared() < 1e-4) out.set(-1, 0, 0); out.normalize();
        shield.position.copyFrom(mid.add(out.scale(.12))); shield.rotation.set(0, Math.atan2(out.x, out.z), 0); };
      function launch() {
        const wave = Math.floor(st.k / PER), lvl = Math.min(1, (st.k % PER) / Math.max(1, PER - 1) * .5 + wave / Math.max(1, WAVES - 1) * .5), side = Math.random() < .5 ? 0 : 1, T = 2 - .8 * lvl;
        st.cur = { side, t: 0, T, n: arrowMesh(), judged: false };
        info();
      }
      function judge(kind) {
        const c = st.cur; if (!c || c.judged) return; c.judged = true;
        if (kind === 'clean' || kind === 'block') {
          st.blocks++; st.combo++; if (kind === 'clean') st.clean++;
          const pts = (kind === 'clean' ? 15 : 10) + (st.combo >= 5 ? 5 : 0); st.score += pts; H.score(st.score);
          const p = ctx.screenOf(ctx.toWorld(SIDE[c.side].x, SIDE[c.side].y + .4, SIDE[c.side].z)); H.pop(p.x, p.y, '+' + pts);
          H.msg(kind === 'clean' ? 'Clean block!' : 'Blocked', 600); ctx.sound('thock');
          st.flying.push({ n: c.n, v: new V3(c.side ? 2.4 : -2.4, 3.2, -1.2), spin: 9, t: 0 }); // knocked away
        } else {
          st.hits++; st.combo = 0; H.msg(kind === 'wrong' ? 'Wrong side!' : 'Hit!', 700); ctx.sound('thock');
          ctx.player.clip('hit_reaction');
          c.n.dispose(); info();
        }
        if (st.sword && kind !== 'hit' && kind !== 'wrong') ctx.player.clip('sword_block', { hold: true, speed: 1.6 });
        st.stanceIn = kind === 'hit' || kind === 'wrong' ? 1.1 : .65; // then back to the guard
        st.cur = null; st.k++; st.wait = .45 + Math.random() * .4;
        if (st.k < N && st.k % PER === 0 && st.hits < MAXH) { st.wait = 2.2; H.msg(`Wave ${st.k / PER + 1}`, 1500, 'they shoot faster now'); }
        if (st.k >= N || st.hits >= MAXH) { st.phase = 'end'; st.wait = 1.1; }
      }
      function guard(side) {
        const c = st.cur; if (st.phase !== 'play' || !c || c.judged) return;
        const off = Math.abs(c.t - c.T);
        if (side !== c.side) return judge('wrong');
        if (off <= .09) judge('clean'); else if (off <= .24) judge('block'); else if (c.t < c.T) { H.msg('Too soon', 500); }
      }
      ctx.player.place(0, 0, 0);
      const cam = def.cam || [0, 3.4, -4.6], at = def.at || [0, 2.2, 3];
      ctx.look(cam, at, def.fov || 1.0);
      H.title(def.title || 'Shield Wall'); H.score(0); info();
      H.hint('Guard the side the ring shows as the arrow lands: <kbd>←</kbd> / <kbd>A</kbd> left, <kbd>→</kbd> / <kbd>D</kbd> right, or the pads');
      H.msg(def.title || 'Shield Wall', 1500, `${N} arrows`);
      ctx.player.weapon('sword', def.sword || 'eclipse_edge').then(w => { if (!w || st.phase === 'done') return; st.sword = w; ctx.player.clip('sword_idle', { loop: true }); });
      const inst = {
        update(dt) {
          ctx.look(cam, at); shieldOnArm();
          if (st.stanceIn > 0 && (st.stanceIn -= dt) <= 0 && st.sword) ctx.player.clip('sword_idle', { loop: true });
          if (st.phase === 'intro' && (st.wait -= dt) <= 0) st.phase = 'play';
          if (st.phase === 'play') {
            if (!st.cur && (st.wait -= dt) <= 0 && st.k < N) launch();
            const c = st.cur;
            if (c) {
              c.t += dt; const u = Math.min(1.15, c.t / c.T), a = FROM[c.side], b = SIDE[c.side];
              const p = V3.Lerp(a, b, u); p.y += Math.sin(Math.min(1, u) * Math.PI) * 1.2;
              c.n.position.copyFrom(p); const d = b.subtract(a).normalize(); c.n.rotation.y = Math.atan2(d.x, d.z); c.n.rotation.x = -Math.asin(Math.max(-1, Math.min(1, d.y))) + (u - .5) * .8;
              if (!c.judged && c.t > c.T + .26) judge('hit');
            }
          }
          for (let i = st.flying.length - 1; i >= 0; i--) { const f = st.flying[i]; f.t += dt; f.v.y -= 9.8 * dt; f.n.position.addInPlace(f.v.scale(dt)); f.n.rotation.z += f.spin * dt; if (f.t > 1.2) { f.n.dispose(); st.flying.splice(i, 1); } }
          // the ring on the side the arrow will hit
          const c = st.cur;
          if (c && !c.judged && st.phase === 'play') {
            const p = ctx.screenOf(ctx.toWorld(SIDE[c.side].x * 1.6, SIDE[c.side].y, SIDE[c.side].z)), u = Math.max(0, Math.min(1.2, c.t / c.T)), size = 58 * (1 + 2.6 * Math.max(0, 1 - u));
            ringEl.style.display = coreEl.style.display = 'block'; ringEl.style.left = coreEl.style.left = p.x + 'px'; ringEl.style.top = coreEl.style.top = p.y + 'px';
            ringEl.style.width = ringEl.style.height = size + 'px'; coreEl.textContent = c.side ? '→' : '←';
          } else ringEl.style.display = coreEl.style.display = 'none';
          if (st.phase === 'end' && (st.wait -= dt) <= 0) {
            st.phase = 'done'; H.hint(''); pads.remove(); ringEl.remove(); coreEl.remove();
            if (st.score >= (def.pass || 0)) ctx.sound('gamewin');
            ctx.finish({ score: st.score, label: 'points', extra: st.hits >= MAXH ? `The wall broke after ${st.k} arrows (${st.blocks} blocked).` : `${st.blocks} of ${N} arrows blocked, ${st.clean} clean.` });
          }
        },
        key(e, down) { if (!down || e.repeat) return; const k = e.key.toLowerCase(); if (k === 'arrowleft' || k === 'a') guard(0); else if (k === 'arrowright' || k === 'd') guard(1); },
        pointer() {},
        _test: { st, guard },
        dispose() { pads.remove(); ringEl.remove(); coreEl.remove(); st.flying.forEach(f => { try { f.n.dispose(); } catch (e) {} }); if (st.cur) st.cur.n.dispose(); }
      };
      return inst;
    }
  };
  window.RebelGames.register('guard', G);
})();
