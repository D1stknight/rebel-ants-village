// Dummy drill (Oct 15, Hub Forest Dojo): four straw dummies stand round the Rebel (ahead, left, right, behind). One lights
// up gold; strike it before the light goes out (W A S D, the arrow keys, or click / tap it): the Rebel turns and kicks or
// punches it. Quick strikes score more, five in a row double every strike. Later two light at once, and a red one is a
// feint: leave it alone. 30 seconds, the lights quicker as they come.
// def: { at: [x, z] (frame coords where the Rebel stands), face: yaw (the way it faces: 0 = +z), r: 1.9 (the dummies'
// distance), seconds: 30, pass, points }
(function () {
  const DIRS = [ // the dummy's place round the Rebel: the turn from its facing, the keys, the moves that reach it
    { name: 'front', turn: 0, keys: ['w', 'arrowup'], glyph: '↑', moves: ['front_kick', 'jab', 'cross_punch'] },
    { name: 'left', turn: -Math.PI / 2, keys: ['a', 'arrowleft'], glyph: '←', moves: ['side_kick', 'hook_punch', 'roundhouse_kick'] },
    { name: 'right', turn: Math.PI / 2, keys: ['d', 'arrowright'], glyph: '→', moves: ['side_kick', 'hook_punch', 'roundhouse_kick'] },
    { name: 'back', turn: Math.PI, keys: ['s', 'arrowdown'], glyph: '↓', moves: ['crescent_kick', 'elbow_punch'] }
  ];
  const G = {
    title: 'Dummy Drill',
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const AT = def.at || [0, 0], FACE = def.face || 0, R = def.r || 1.9, DUR = def.seconds || 30;
      const fwd = [Math.sin(FACE), Math.cos(FACE)], rt = [Math.cos(FACE), -Math.sin(FACE)];
      const mat = (k, c, em, spec = .05) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(spec, spec, spec); if (em) m.emissiveColor = new B.Color3(...em); return m; });
      const wood = mat('wood', [.34, .21, .1]), straw = mat('straw', [.6, .48, .28], [.06, .05, .02]), rope = mat('rope', [.45, .3, .16]);
      const lit = mat('lit', [1, .92, .55], [1, .82, .35]), feint = mat('feint', [1, .3, .24], [.95, .16, .1]);
      // hidden sources: each dummy's parts are their copies (the head and the floor ring are its own, they change colour)
      const src = (m, mt) => { m.material = mt; m.isPickable = false; m.isVisible = false; ctx.add(m); return m; };
      const sBase = src(B.MeshBuilder.CreateCylinder('drillBase', { height: .14, diameter: .95, tessellation: 14 }, scene), wood);
      const sPost = src(B.MeshBuilder.CreateCylinder('drillPost', { height: 2.9, diameter: .2, tessellation: 8 }, scene), wood);
      const sBody = src(B.MeshBuilder.CreateCylinder('drillBody', { height: 1.3, diameterTop: .56, diameterBottom: .66, tessellation: 12 }, scene), straw);
      const sBand = src(B.MeshBuilder.CreateCylinder('drillBand', { height: .07, diameter: .7, tessellation: 12 }, scene), rope);
      const sArm = src(B.MeshBuilder.CreateCylinder('drillArm', { height: 1.3, diameter: .13, tessellation: 6 }, scene), straw);
      const sBit = src(B.MeshBuilder.CreateBox('drillBit', { width: .05, height: .05, depth: .22 }, scene), straw);
      const dummies = DIRS.map((d, i) => {
        const dx = Math.sin(FACE + d.turn), dz = Math.cos(FACE + d.turn), x = AT[0] + dx * R, z = AT[1] + dz * R;
        const root = new B.TransformNode('drillDummy', scene); root.position.set(x, 0, z); root.rotation.y = FACE + d.turn; ctx.add(root);
        const tilt = new B.TransformNode('drillTilt', scene); tilt.parent = root; tilt.position.y = .1; // it rocks about its foot
        const put = (s, y, rx = 0, rz = 0) => { const m = s.createInstance('drillPart'); m.parent = tilt; m.position.y = y; m.rotation.x = rx; m.rotation.z = rz; m.isPickable = true; m.metadata = { drill: i }; return m; };
        const base = sBase.createInstance('drillFoot'); base.parent = root; base.position.y = .07; base.isPickable = false;
        put(sPost, 1.45); put(sBody, 1.9); for (const y of [1.35, 1.9, 2.45]) put(sBand, y); put(sArm, 2.25, 0, Math.PI / 2);
        const head = B.MeshBuilder.CreateSphere('drillHead', { diameter: .5, segments: 8 }, scene); head.parent = tilt; head.position.y = 3.05; head.material = straw; head.metadata = { drill: i }; ctx.add(head);
        const ring = B.MeshBuilder.CreateTorus('drillRing', { diameter: 1.7, thickness: .09, tessellation: 28 }, scene); ring.parent = root; ring.position.y = .06; ring.material = lit; ring.isPickable = false; ring.setEnabled(false); ctx.add(ring);
        return { d, i, x, z, root, tilt, head, ring, state: 'off', t: 0, w: 0, wob: 0, wobA: 0 };
      });
      // the key over a lit dummy (screen space)
      const hud = document.getElementById('gameHud');
      const glyphs = dummies.map(() => { const g = document.createElement('div'); g.style.cssText = 'position:absolute;transform:translate(-50%,-50%);width:46px;height:46px;border-radius:50%;border:2px solid rgba(255,233,176,.9);background:rgba(20,14,6,.72);color:#ffe9b0;font:700 26px/42px Georgia,serif;text-align:center;pointer-events:none;display:none;text-shadow:0 2px 0 #000'; hud.appendChild(g); return g; });
      // ── state ──
      const st = { phase: 'intro', wait: 1.6, left: DUR, score: 0, streak: 0, best: 0, hits: 0, misses: 0, feints: 0, next: .4, bits: [], move: 0 };
      const info = () => H.info(`${Math.ceil(st.left)} s${st.streak >= 5 ? ' · x2' : st.streak ? ' · combo ' + st.streak : ''}`);
      const lvl = () => Math.min(1, (DUR - st.left) / DUR);
      function light() {
        const L = lvl(), win = 1.5 - .9 * L, off = dummies.filter(m => m.state === 'off');
        if (!off.length) return;
        const pick = () => off.splice(Math.floor(Math.random() * off.length), 1)[0];
        if (L > .62 && Math.random() < .2) { const m = pick(); m.state = 'feint'; m.t = 0; m.w = .8; m.head.material = feint; m.ring.material = feint; m.ring.setEnabled(true); if (!off.length) return; }
        const n = L > .3 && Math.random() < .25 + .25 * L && off.length > 1 ? 2 : 1;
        for (let k = 0; k < n; k++) { const m = pick(); m.state = 'lit'; m.t = 0; m.w = win * (n > 1 ? 1.6 : 1); m.head.material = lit; m.ring.material = lit; m.ring.setEnabled(true); }
        ctx.note(n > 1 ? 660 : 587, 'bell');
      }
      const out = m => { m.state = 'off'; m.head.material = straw; m.ring.setEnabled(false); glyphs[m.i].style.display = 'none'; };
      function knock(m) { // the strike lands: the dummy rocks back, straw flies
        m.wob = 0; m.wobA = .32;
        for (let k = 0; k < 7; k++) { const b = sBit.createInstance('drillStraw'); b.parent = ctx.frame; ctx.add(b); const a = Math.random() * Math.PI * 2;
          b.position.set(m.x + Math.cos(a) * .3, 1.6 + Math.random() * 1.1, m.z + Math.sin(a) * .3); b.rotation.set(Math.random() * 3, Math.random() * 3, 0);
          st.bits.push({ b, v: new V3(Math.cos(a) * (1 + Math.random() * 1.6), 1.6 + Math.random() * 2, Math.sin(a) * (1 + Math.random() * 1.6)), t: 0 }); }
      }
      function strike(i) {
        if (st.phase !== 'play') return;
        const m = dummies[i]; if (!m) return;
        ctx.player.face(FACE + m.d.turn);
        ctx.player.clip(m.d.moves[st.move++ % m.d.moves.length]);
        st.land = { m, t: .22 };
        if (m.state === 'lit') {
          const quick = Math.max(0, 1 - m.t / m.w); st.streak++; st.best = Math.max(st.best, st.streak); st.hits++;
          const pts = (10 + Math.round(5 * quick)) * (st.streak >= 5 ? 2 : 1); st.score += pts; H.score(st.score);
          const p = ctx.screenOf(ctx.toWorld(m.x, 3.7, m.z)); H.pop(p.x, p.y, '+' + pts);
          if (st.streak === 5) H.msg('Combo x2!', 800);
          out(m);
        } else if (m.state === 'feint') {
          st.feints++; st.streak = 0; st.score = Math.max(0, st.score - 10); H.score(st.score); H.msg('A feint!', 700); out(m);
        } else { st.streak = 0; H.msg('Not that one', 600); }
        info();
      }
      ctx.player.place(AT[0], AT[1], FACE);
      const cam = def.cam || [AT[0] - fwd[0] * 5.4, 8.2, AT[1] - fwd[1] * 5.4], at = def.look || [AT[0] + fwd[0] * .6, .9, AT[1] + fwd[1] * .6];
      ctx.look(cam, at, def.fov || .85);
      H.title(def.title || 'Dummy Drill'); H.score(0); info();
      H.hint('Strike the lit dummy: <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> (or the arrows), or click it. Five in a row doubles every strike; leave the red ones.');
      H.msg(def.title || 'Dummy Drill', 1500, `${DUR} seconds`);
      const inst = {
        update(dt) {
          ctx.look(cam, at);
          if (st.phase === 'intro' && (st.wait -= dt) <= 0) { st.phase = 'play'; st.next = .2; }
          if (st.phase === 'play') {
            st.left -= dt; if (st.left <= 0) { st.left = 0; st.phase = 'end'; st.wait = 1.2; dummies.forEach(out); H.msg("Time's up", 1000); }
            for (const m of dummies) if (m.state !== 'off') { m.t += dt; if (m.t >= m.w) { if (m.state === 'lit') { st.streak = 0; st.misses++; H.msg('Too slow', 500); } out(m); info(); } }
            if (st.phase === 'play' && !dummies.some(m => m.state === 'lit') && (st.next -= dt) <= 0) { light(); st.next = .32 - .14 * lvl(); }
            info();
          }
          if (st.land && (st.land.t -= dt) <= 0) { knock(st.land.m); ctx.sound('thock'); st.land = null; }
          for (const m of dummies) { // the rocking: a damped swing away from the Rebel
            if (m.wobA > .002) { m.wob += dt; m.tilt.rotation.x = m.wobA * Math.exp(-4 * m.wob) * Math.sin(13 * m.wob); if (m.wob > 1.6) { m.wobA = 0; m.tilt.rotation.x = 0; } }
            const g = glyphs[m.i];
            if (m.state === 'lit') { const p = ctx.screenOf(ctx.toWorld(m.x, 3.75, m.z)); g.style.display = 'block'; g.style.left = p.x + 'px'; g.style.top = p.y + 'px'; g.textContent = m.d.glyph; g.style.opacity = String(.55 + .45 * Math.max(0, 1 - m.t / m.w)); }
            else g.style.display = 'none';
          }
          for (let k = st.bits.length - 1; k >= 0; k--) { const s = st.bits[k]; s.t += dt; s.v.y -= 9.8 * dt; s.b.position.addInPlace(s.v.scale(dt)); s.b.rotation.x += dt * 9; if (s.b.position.y < .03 || s.t > .9) { s.b.dispose(); st.bits.splice(k, 1); } }
          if (st.phase === 'end' && (st.wait -= dt) <= 0) {
            st.phase = 'done'; H.hint(''); glyphs.forEach(g => g.remove());
            if (st.score >= (def.pass || 0)) ctx.sound('gamewin');
            ctx.finish({ score: st.score, label: 'points', extra: `${st.hits} strikes, best combo ${st.best}${st.feints ? `, ${st.feints} feint${st.feints > 1 ? 's' : ''} hit` : ''}.` });
          }
        },
        key(e, down) { if (!down || e.repeat) return; const k = e.key.toLowerCase(); const i = DIRS.findIndex(d => d.keys.includes(k)); if (i >= 0) strike(i); },
        pointer(evt) {
          if (evt.type !== B.PointerEventTypes.POINTERDOWN) return;
          const hit = scene.pickWithRay(ctx.ray(), m => m.metadata?.drill !== undefined);
          if (hit && hit.hit) strike(hit.pickedMesh.metadata.drill);
        },
        _test: { st, strike, dummies },
        dispose() { glyphs.forEach(g => g.remove()); st.bits.forEach(s => { try { s.b.dispose(); } catch (e) {} }); }
      };
      return inst;
    }
  };
  window.RebelGames.register('drill', G);
})();
