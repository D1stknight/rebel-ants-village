// Ghost Catch (Oct 15, Cute & Creepy lawn): nine graves, and the ghosts will not stay down. Catch each ghost as it rises
// (click it, or press its grave's key: 7 8 9 the far row, 4 5 6, 1 2 3 the near row). Gold ghosts are worth three;
// the lucky cat only came to watch: leave it be. Forty seconds; the ghosts get quicker.
// def: { at: [x, z] (the middle grave, frame coordinates), seconds, cam, look, player, pass, points }
(function () {
  const G = {
    title: 'Ghost Catch',
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const AT = def.at || [0, 0], SEC = def.seconds || 40, SP = def.spacing || 2.2;
      const mat = (k, c, em, spec = .1, a) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(spec, spec, spec); if (em) m.emissiveColor = new B.Color3(...em); if (a != null) m.alpha = a; return m; });
      const M = { stone: mat('stone', [.42, .4, .46], [.06, .05, .08]), dirt: mat('dirt', [.2, .14, .1], [.03, .02, .02]), ghost: mat('ghost', [.9, .95, 1], [.55, .62, .7], .2, .88), gold: mat('goldGhost', [1, .85, .4], [.75, .55, .15], .5, .92),
        eye: mat('eye', [.03, .03, .05]), cat: mat('cat', [.98, .62, .24], [.3, .16, .05]), catW: mat('catW', [1, .97, .92], [.3, .28, .26]) };
      const nodes = [], keep = n => { n.parent = ctx.frame; ctx.add(n); nodes.push(n); return n; };
      // graves: index 0..8, row 0 the far row (+z), column 0 on the left (-x, the camera looks along +z)
      const graves = [];
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
        const x = AT[0] + (c - 1) * SP, z = AT[1] + (1 - r) * SP, root = keep(new B.TransformNode('ghGrave', scene)); root.position.set(x, 0, z);
        const mound = B.MeshBuilder.CreateSphere('ghMound', { diameter: 1.5, segments: 8 }, scene); mound.parent = root; mound.scaling.set(1, .18, 1.25); mound.position.z = -.25; mound.material = M.dirt; mound.isPickable = false; ctx.add(mound);
        const slab = B.MeshBuilder.CreateBox('ghStone', { width: .9, height: .9, depth: .2 }, scene); slab.parent = root; slab.position.set(0, .45, .45); slab.rotation.x = -.08; slab.material = M.stone; slab.isPickable = false; ctx.add(slab);
        const top = B.MeshBuilder.CreateCylinder('ghStoneTop', { height: .2, diameter: .9, tessellation: 14, arc: .5 }, scene); top.parent = root; top.position.set(0, .9, .45); top.rotation.set(Math.PI / 2 - .08, 0, Math.PI / 2); top.material = M.stone; top.isPickable = false; ctx.add(top);
        graves.push({ i: r * 3 + c, x, z, key: String([7, 8, 9, 4, 5, 6, 1, 2, 3][r * 3 + c]), who: null });
      }
      // the risers: three ghosts and the lucky cat, reused
      function ghost() { const root = keep(new B.TransformNode('ghGhost', scene)), parts = [];
        const head = B.MeshBuilder.CreateSphere('ghHead', { diameter: .72, segments: 12 }, scene); head.parent = root; head.position.y = .95; parts.push(head);
        const body = B.MeshBuilder.CreateCylinder('ghBody', { height: .9, diameterTop: .72, diameterBottom: .95, tessellation: 14 }, scene); body.parent = root; body.position.y = .5; parts.push(body);
        parts.forEach(p => { p.material = M.ghost; p.isPickable = true; p.metadata = { ghRiser: root }; ctx.add(p); });
        for (const s of [-1, 1]) { const e = B.MeshBuilder.CreateSphere('ghEye', { diameter: .12, segments: 6 }, scene); e.parent = root; e.position.set(s * .14, 1.02, -.3); e.material = M.eye; e.isPickable = true; e.metadata = { ghRiser: root }; ctx.add(e); }
        const mouth = B.MeshBuilder.CreateSphere('ghMouth', { diameter: .14, segments: 6 }, scene); mouth.parent = root; mouth.scaling.set(1, 1.3, .5); mouth.position.set(0, .82, -.33); mouth.material = M.eye; mouth.isPickable = true; mouth.metadata = { ghRiser: root }; ctx.add(mouth);
        root.metadata = { kind: 'ghost', parts }; root.setEnabled(false); return root; }
      function cat() { const root = keep(new B.TransformNode('ghCat', scene)), parts = [];
        const body = B.MeshBuilder.CreateSphere('ghCatBody', { diameter: .8, segments: 12 }, scene); body.parent = root; body.position.y = .45; body.scaling.y = .9; body.material = M.catW; parts.push(body);
        const head = B.MeshBuilder.CreateSphere('ghCatHead', { diameter: .62, segments: 12 }, scene); head.parent = root; head.position.y = 1.02; head.material = M.cat; parts.push(head);
        for (const s of [-1, 1]) { const ear = B.MeshBuilder.CreateCylinder('ghCatEar', { height: .22, diameterTop: 0, diameterBottom: .2, tessellation: 4 }, scene); ear.parent = root; ear.position.set(s * .18, 1.32, 0); ear.rotation.z = -s * .3; ear.material = M.cat; parts.push(ear);
          const e = B.MeshBuilder.CreateSphere('ghCatEye', { diameter: .08, segments: 6 }, scene); e.parent = root; e.position.set(s * .12, 1.06, -.27); e.material = M.eye; parts.push(e); }
        const paw = B.MeshBuilder.CreateSphere('ghCatPaw', { diameter: .2, segments: 6 }, scene); paw.parent = root; paw.position.set(.32, .95, -.15); paw.material = M.catW; parts.push(paw);
        parts.forEach(p => { p.isPickable = true; p.metadata = { ghRiser: root }; ctx.add(p); }); root.metadata = { kind: 'cat', parts, paw }; root.setEnabled(false); return root; }
      const pool = [ghost(), ghost(), ghost()], kitty = cat();
      const st = { phase: 'intro', t: 0, left: SEC, score: 0, caught: 0, missed: 0, streak: 0, best: 0, next: 1.2, cats: 0, intro: 2 };
      const risers = []; // { root, g (grave), kind, age, life }
      function spawn() {
        const free = graves.filter(g => !g.who); if (!free.length) return;
        const g = free[Math.floor(Math.random() * free.length)], f = 1 - st.left / SEC, roll = Math.random();
        let kind = roll < .16 ? 'cat' : roll < .25 ? 'gold' : 'ghost', root;
        if (kind === 'cat') { if (kitty.isEnabled()) kind = 'ghost'; else root = kitty; }
        if (!root) { root = pool.find(p => !p.isEnabled()); if (!root) return; root.metadata.parts.forEach(p => p.material = kind === 'gold' ? M.gold : M.ghost); }
        const life = (kind === 'gold' ? .75 : 1.35) - f * .55;
        root.position.set(g.x, -1.3, g.z); root.rotation.y = 0; root.setEnabled(true); g.who = { root, kind, age: 0, life, g }; risers.push(g.who);
      }
      function hit(r) {
        if (!r || r.out) return; r.out = true; r.age = Math.max(r.age, r.life); // sinks straight away
        if (r.kind === 'cat') { st.score = Math.max(0, st.score - 15); st.streak = 0; st.cats++; H.msg('Not the lucky cat!', 900); const p = ctx.screenOf(r.root.getAbsolutePosition().add(new V3(0, 1.5, 0))); H.pop(p.x, p.y, '-15', true); ctx.sound('thock'); }
        else { const pts = (r.kind === 'gold' ? 30 : 10) + (st.streak >= 4 ? 5 : 0); st.score += pts; st.caught++; st.streak++; st.best = Math.max(st.best, st.streak); ctx.note(r.kind === 'gold' ? 1047 : 660 + st.streak * 30, 'bell');
          const p = ctx.screenOf(r.root.getAbsolutePosition().add(new V3(0, 1.5, 0))); H.pop(p.x, p.y, `+${pts}`); }
        H.score(st.score);
      }
      function press(g) { if (st.phase !== 'play') return; if (g.who && !g.who.out) hit(g.who); else { st.streak = 0; ctx.sound('thock'); } }
      ctx.player.place(AT[0] - SP * 1.5 - 1.4, AT[1] - SP * 1.2, .6);
      const cam = def.cam || [AT[0], 6.2, AT[1] - SP * 3.4], look = def.look || [AT[0], .5, AT[1] + .2];
      ctx.look(cam, look, def.fov || .8);
      H.title(def.title || 'Ghost Catch'); H.score(0); H.info(`${SEC} s`);
      H.hint('Catch the ghosts as they rise: click them, or press the grave\'s key (<kbd>7</kbd><kbd>8</kbd><kbd>9</kbd> far row … <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> near row). Leave the lucky cat alone.');
      H.msg('Ghost Catch', 1600, 'they are waking up…');
      return {
        update(dt) {
          ctx.look(cam, look); st.t += dt;
          if (st.phase === 'intro' && (st.intro -= dt) <= 0) st.phase = 'play';
          if (st.phase === 'play') {
            st.left = Math.max(0, st.left - dt); H.info(`${Math.ceil(st.left)} s`);
            if ((st.next -= dt) <= 0) { spawn(); if (Math.random() < (1 - st.left / SEC) * .45) spawn(); st.next = .95 - (1 - st.left / SEC) * .5 + Math.random() * .25; }
            if (st.left <= 0) { st.phase = 'end'; st.wait = 1.6; H.msg('The graves are quiet', 1400); }
          }
          for (let k = risers.length - 1; k >= 0; k--) { const r = risers[k]; r.age += dt;
            const up = Math.min(1, r.age / .18), down = Math.max(0, (r.age - r.life) / .18), y = -1.3 + 1.3 * up - 1.3 * Math.min(1, down);
            r.root.position.y = y; r.root.rotation.y = Math.sin(st.t * 5 + r.g.i) * .25;
            if (r.kind === 'cat') r.root.metadata.paw.position.y = .95 + Math.sin(st.t * 10) * .1; // the lucky cat waves
            if (down >= 1) { if (!r.out && r.kind !== 'cat') { st.missed++; st.streak = 0; } r.root.setEnabled(false); r.g.who = null; risers.splice(k, 1); } }
          if (st.phase === 'end' && (st.wait -= dt) <= 0) { st.phase = 'done'; H.hint('');
            ctx.finish({ score: st.score, label: 'points', passed: st.score >= (def.pass || 0), extra: `${st.caught} ghosts caught, ${st.missed} got away${st.cats ? `, the lucky cat bopped ${st.cats} time${st.cats > 1 ? 's' : ''}` : ''}. Best run: ${st.best}.` }); }
        },
        key(e, down) { if (!down || e.repeat) return; const g = graves.find(g => g.key === e.key); if (g) press(g); },
        pointer(evt) {
          if (evt.type !== B.PointerEventTypes.POINTERDOWN || st.phase !== 'play') return;
          const hitInfo = scene.pickWithRay(ctx.ray(), m => !!m.metadata?.ghRiser && m.isEnabled()); const root = hitInfo?.hit && hitInfo.pickedMesh.metadata.ghRiser;
          const r = root && risers.find(r => r.root === root); if (r) hit(r); else st.streak = 0;
        },
        _test: { st, graves, risers, spawn, press, hit },
        dispose() { nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); }
      };
    }
  };
  window.RebelGames.register('ghosts', G);
})();
