// Tameshigiri (Oct 15): straw-mat cutting at the Samurai training ground (a quest spot; local +z ahead of the Rebel).
// Twenty mats rise one after another in front of the Rebel, each with its cut drawn on it (← → ↓ ↑). A ring closes in
// round the mat: press the matching direction (arrow keys, WASD or the pads) as it meets the mat. On time is Perfect
// (10), a little off is Good (6), the wrong way or too late leaves the mat standing; five clean cuts in a row and the
// points count half again. The mats come quicker as it goes. A Forge Rebel cuts with a lent katana and its own sword
// moves; every cut leaves a flash of the blade.
(function () {
  const DIRS = ['left', 'up', 'right', 'down'], GLYPH = { left: '←', up: '↑', right: '→', down: '↓' };
  const KEYS = { arrowleft: 'left', a: 'left', arrowup: 'up', w: 'up', arrowright: 'right', d: 'right', arrowdown: 'down', s: 'down' };
  const ANGLE = { left: 0, right: 0, down: -.6, up: .6 }; // the cut across the mat (radians from level)
  const MOVES = ['sword_power_slash', 'sword_combo', 'sword_down_slash', 'sword_combo2', 'sword_spin_attack'];
  // the moves' lengths (s at speed 1; the same in every Rebel's moves pack): back to the sword stance after each
  const MOVE_S = { sword_power_slash: 1.8, sword_combo: 3.53, sword_down_slash: 1.27, sword_combo2: 3.27, sword_spin_attack: 1.87 }, SPEED = 1.7;
  const G = {
    title: 'Tameshigiri',
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const N = def.mats || 20, MZ = def.z || 2.7, CUT_Y = 1.55, TOP_Y = 2.35;
      // ── props: straw (instances of one cylinder), the post, the cut line, the blade's flash ──
      const mat = (key, col, em, alpha) => ctx.mat(key, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...col); m.specularColor = new B.Color3(.05, .05, .05); if (em) m.emissiveColor = new B.Color3(...em); if (alpha != null) { m.alpha = alpha; m.disableLighting = true; m.backFaceCulling = false; } return m; });
      const strawM = mat('straw', [.78, .66, .38], [.18, .15, .08]), postM = mat('post', [.28, .17, .08]), lineM = mat('line', [1, .4, .3], [1, .35, .25], .95), flashM = mat('flash', [1, 1, 1], [1, .95, .85], 0);
      const src = (m) => { m.isPickable = false; m.isVisible = false; ctx.add(m); return m; };
      const straw = src(B.MeshBuilder.CreateCylinder('tgStraw', { height: 1, diameter: .36, tessellation: 14 }, scene)); straw.material = strawM;
      const post = src(B.MeshBuilder.CreateCylinder('tgPost', { height: .72, diameter: .1, tessellation: 8 }, scene)); post.material = postM;
      const flash = B.MeshBuilder.CreatePlane('tgFlash', { width: 2.6, height: .14 }, scene); flash.material = flashM; flash.isPickable = false; ctx.add(flash); flash.setEnabled(false);
      // the ring and the glyph over the mat (screen space)
      const hud = document.getElementById('gameHud');
      const ringEl = document.createElement('div'); ringEl.style.cssText = 'position:absolute;border:3px solid rgba(255,216,119,.95);border-radius:50%;transform:translate(-50%,-50%);pointer-events:none;box-shadow:0 0 12px rgba(255,190,80,.6);display:none';
      const coreEl = document.createElement('div'); coreEl.style.cssText = 'position:absolute;width:64px;height:64px;border:2px solid rgba(255,255,255,.75);border-radius:50%;transform:translate(-50%,-50%);pointer-events:none;display:none;font:700 38px/60px Georgia,serif;color:#fff;text-align:center;text-shadow:0 0 8px #000,0 2px 0 #000';
      const pads = document.createElement('div'); pads.style.cssText = 'position:absolute;bottom:62px;left:50%;transform:translateX(-50%);display:flex;gap:10px;pointer-events:auto';
      for (const d of DIRS) { const b = document.createElement('button'); b.type = 'button'; b.textContent = GLYPH[d]; b.style.cssText = 'width:52px;height:46px;border-radius:10px;border:1px solid #d8b35c;background:rgba(20,16,10,.8);color:#ffe9b0;font:700 22px/44px sans-serif;cursor:pointer'; b.onpointerdown = (e) => { e.stopPropagation(); e.preventDefault(); cut(d); }; pads.append(b); }
      hud.append(ringEl, coreEl, pads);
      // ── state ──
      const st = { k: 0, score: 0, combo: 0, best: 0, perfect: 0, good: 0, missed: 0, cur: null, gap: 1.6, flashT: 0, falling: [], phase: 'intro', wait: 1.6, sword: null, move: 0 };
      const info = () => H.info(`Mat ${Math.min(st.k + 1, N)} / ${N}${st.combo >= 2 ? ' · combo ' + st.combo : ''}`);
      function spawn() {
        const lvl = st.k / Math.max(1, N - 1), dir = DIRS[Math.floor(Math.random() * 4)], x = (Math.random() - .5) * .9;
        const node = new B.TransformNode('tgMat', scene); ctx.add(node); node.position.set(x, -2.6, MZ);
        const p = post.createInstance('tgP'); p.parent = node; p.position.y = .36;
        const lo = straw.createInstance('tgLo'); lo.parent = node; lo.scaling.y = CUT_Y - .72; lo.position.y = (.72 + CUT_Y) / 2;
        const hi = straw.createInstance('tgHi'); hi.parent = node; hi.scaling.y = TOP_Y - CUT_Y; hi.position.y = (CUT_Y + TOP_Y) / 2;
        const line = B.MeshBuilder.CreateBox('tgLine', { width: .03, height: .035, depth: .62 }, scene); line.material = lineM; line.parent = node; line.position.set(-.185, CUT_Y, 0); line.rotation.x = ANGLE[dir] * (dir === 'up' ? -1 : 1); line.isPickable = false;
        const close = 1.25 - .5 * lvl;
        st.cur = { node, hi, line, dir, t: 0, rise: .25, close, judged: false };
        st.gap = 1.15 - .45 * lvl;
        info();
      }
      function placeGlyph() {
        const c = st.cur; if (!c || c.judged) { ringEl.style.display = coreEl.style.display = 'none'; return; }
        const p = ctx.screenOf(ctx.toWorld(c.node.position.x, CUT_Y + .1, c.node.position.z)); if (p.behind) return;
        const u = Math.max(0, Math.min(1.2, (c.t - c.rise) / c.close)), size = 64 * (1 + 2.6 * Math.max(0, 1 - u));
        ringEl.style.display = coreEl.style.display = 'block';
        ringEl.style.left = coreEl.style.left = p.x + 'px'; ringEl.style.top = coreEl.style.top = p.y + 'px';
        ringEl.style.width = ringEl.style.height = size + 'px'; coreEl.textContent = GLYPH[c.dir];
        ringEl.style.borderColor = u > 1 ? 'rgba(255,120,100,.95)' : 'rgba(255,216,119,.95)';
      }
      function judge(kind, dir) {
        const c = st.cur; if (!c || c.judged) return; c.judged = true;
        if (kind === 'miss') {
          st.combo = 0; st.missed++; H.msg(dir ? 'Wrong cut' : 'Too slow', 650); ctx.sound('thock');
          st.falling.push({ node: c.node, v: new V3(0, 0, 0), spin: 0, t: 0, whole: true });
        } else {
          st.combo++; st.best = Math.max(st.best, st.combo);
          const pts = Math.round((kind === 'perfect' ? 10 : 6) * (st.combo >= 5 ? 1.5 : 1)); st.score += pts;
          if (kind === 'perfect') st.perfect++; else st.good++;
          const sc = ctx.screenOf(ctx.toWorld(c.node.position.x, TOP_Y, c.node.position.z)); H.pop(sc.x, sc.y, `+${pts}`); H.msg(kind === 'perfect' ? 'Perfect!' : 'Good', 600);
          // the top of the mat slides off along the cut and falls; the line goes
          c.line.dispose();
          const along = c.dir === 'right' ? -1 : 1;
          st.falling.push({ node: c.hi, base: c.node, v: new V3(0, 1.3, along * (1.6 + Math.random())), spin: along * (3 + Math.random() * 2), t: 0 });
          st.falling.push({ node: c.node, v: null, t: 0, stay: true });
          // the blade: a flash across the cut, the Rebel's swing, the sound
          flash.setEnabled(true); flash.position.set(c.node.position.x - .3, CUT_Y, c.node.position.z); flash.rotation.set(ANGLE[c.dir] * (c.dir === 'up' ? -1 : 1), Math.PI / 2, 0); st.flashT = .2; flashM.alpha = 1;
          if (!st.sword) ctx.sound('whoosh'); // a lent katana sounds its own swings
        }
        if (st.sword) { const mv = MOVES[st.move++ % MOVES.length]; ctx.player.clip(mv, { hold: true, speed: SPEED }); st.stanceIn = Math.min(1.6, (MOVE_S[mv] || 1.4) / SPEED); }
        else ctx.player.clip('jab');
        H.score(st.score); info();
        st.cur = null; st.wait = st.gap; st.k++;
        if (st.k >= N) { st.phase = 'end'; st.wait = 1.2; }
      }
      function cut(dir) {
        const c = st.cur; if (st.phase !== 'play' || !c || c.judged || c.t < c.rise) return;
        const off = Math.abs((c.t - c.rise) - c.close);
        if (dir !== c.dir) return judge('miss', dir);
        judge(off <= .1 ? 'perfect' : off <= .24 ? 'good' : 'miss', null);
      }
      // ── set up: the Rebel at the stand, a lent katana, the camera from the side ──
      ctx.player.place(0, 0, 0);
      const camP = [-5.4, 2.9, 1.4], camT = [0, 1.8, 1.35];
      ctx.look(camP, camT, .9);
      H.title(def.title || 'Tameshigiri'); H.score(0); info();
      H.hint('Cut the way the arrow shows, as the ring closes: <kbd>←</kbd> <kbd>↑</kbd> <kbd>→</kbd> <kbd>↓</kbd> (or <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>, or the pads)');
      H.msg(def.title || 'Tameshigiri', 1500, `${N} mats`);
      ctx.player.weapon('sword', def.sword || 'stormbringer_blade').then(w => { if (!w || st.phase === 'done') return; st.sword = w; ctx.player.clip('sword_idle', { loop: true }); });
      const inst = {
        update(dt) {
          ctx.look(camP, camT);
          if (st.stanceIn > 0 && (st.stanceIn -= dt) <= 0 && st.sword) ctx.player.clip('sword_idle', { loop: true });
          if (st.phase === 'intro') { if ((st.wait -= dt) <= 0) { st.phase = 'play'; st.wait = 0; } }
          if (st.phase === 'play') {
            if (!st.cur && (st.wait -= dt) <= 0 && st.k < N) spawn();
            const c = st.cur;
            if (c) {
              c.t += dt;
              const r = Math.min(1, c.t / c.rise); c.node.position.y = -2.6 * (1 - r * r * (3 - 2 * r));
              if (!c.judged && c.t - c.rise > c.close + .3) judge('miss', null);
            }
          }
          if (st.phase === 'end' && (st.wait -= dt) <= 0) {
            st.phase = 'done'; H.hint(''); pads.remove(); ringEl.remove(); coreEl.remove();
            if (st.score >= (def.pass || 0)) ctx.sound('gamewin');
            ctx.finish({ score: st.score, label: 'points', extra: `${st.perfect} perfect, ${st.good} good, ${st.missed} left standing · best run ${st.best}.` });
          }
          // the cut tops fall; the stands sink away; a mat left standing tips over
          for (let i = st.falling.length - 1; i >= 0; i--) {
            const f = st.falling[i]; f.t += dt;
            if (f.stay) { if (f.t > .9) f.node.position.y -= dt * 3.2; if (f.t > 1.8) { f.node.dispose(); st.falling.splice(i, 1); } continue; }
            if (f.whole) { f.node.rotation.z = -Math.min(1.4, f.t * f.t * 3); if (f.t > 1.4) { f.node.dispose(); st.falling.splice(i, 1); } continue; }
            f.v.y -= 9.8 * dt; f.node.position.addInPlace(f.v.scale(dt)); f.node.rotation.x += f.spin * dt;
            if (f.node.position.y < .2) { f.v.scaleInPlace(0); }
            if (f.t > 1.6) st.falling.splice(i, 1);
          }
          if (st.flashT > 0) { st.flashT -= dt; flashM.alpha = Math.max(0, st.flashT / .2); if (st.flashT <= 0) flash.setEnabled(false); }
          placeGlyph();
        },
        key(e, down) { if (!down || e.repeat) return; const d = KEYS[e.key.toLowerCase()]; if (d) cut(d); },
        pointer() {},
        _test: { st, cut },
        dispose() { pads.remove(); ringEl.remove(); coreEl.remove(); st.falling.forEach(f => { try { f.node.dispose(); } catch (e) {} }); if (st.cur) st.cur.node.dispose(); }
      };
      return inst;
    }
  };
  window.RebelGames.register('tameshigiri', G);
})();
