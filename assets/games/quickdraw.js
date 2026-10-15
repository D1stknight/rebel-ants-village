// The Quick Draw (Oct 15, Kenshi Duel Hall): iaido against the hall's shadow duelist. A leaf drifts down between you;
// the instant it touches the floor, draw (Space, Enter or a click). Draw before it lands and you lose the round; draw
// after the shadow and you lose it too. Some leaves are caught by a draft just above the floor and fly off: hold.
// First to three rounds; the shadow gets quicker every round (0.42 s down to 0.24 s).
// def: { at: [x, z] (the middle between the duelists, frame coordinates), gap: m, cam, look, reflex: [s per round], pass, points }
(function () {
  const REFLEX = [.42, .36, .31, .27, .24];
  const G = {
    title: 'The Quick Draw',
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const AT = def.at || [0, 0], GAP = def.gap || 6, RF = def.reflex || REFLEX, FLOOR = def.floor ?? .15;
      const mat = (k, c, em, spec = .1, a) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(spec, spec, spec); if (em) m.emissiveColor = new B.Color3(...em); if (a != null) m.alpha = a; return m; });
      const M = { shade: mat('shade', [.03, .04, .05], [.02, .05, .06], .2), eye: mat('eye', [.4, 1, .95], [.4, 1, .95]), steel: mat('steel', [.8, .85, .9], [.15, .18, .2], .9),
        leaf: mat('leaf', [.85, .35, .12], [.35, .12, .03]), slash: mat('slash', [1, 1, 1], [1, 1, 1], 0, .9) };
      M.leaf.backFaceCulling = false; M.slash.disableLighting = true;
      const nodes = [], keep = n => { n.parent = ctx.frame; ctx.add(n); nodes.push(n); return n; };
      // the shadow duelist: a dark figure with glowing eyes and a blade at its hip
      const sh = keep(new B.TransformNode('qdShadow', scene)); sh.position.set(AT[0], FLOOR, AT[1] - GAP / 2);
      const part = (m, mt, x, y, z) => { m.parent = sh; m.position.set(x, y, z); m.material = mt; m.isPickable = false; ctx.add(m); return m; };
      part(B.MeshBuilder.CreateCylinder('qdHakama', { height: 1.3, diameterTop: .62, diameterBottom: 1.05, tessellation: 14 }, scene), M.shade, 0, .65, 0);
      part(B.MeshBuilder.CreateCapsule('qdBody', { height: 1.6, radius: .3, tessellation: 10 }, scene), M.shade, 0, 1.75, 0);
      part(B.MeshBuilder.CreateSphere('qdHead', { diameter: .52, segments: 10 }, scene), M.shade, 0, 2.75, 0);
      for (const s of [-1, 1]) part(B.MeshBuilder.CreateSphere('qdEye', { diameter: .07, segments: 6 }, scene), M.eye, s * .1, 2.8, .22);
      const blade = keep(new B.TransformNode('qdBladeRoot', scene)); blade.parent = sh; blade.position.set(.32, 1.25, .05); blade.rotation.set(2.1, 0, -.35);
      const bm = B.MeshBuilder.CreateBox('qdBlade', { width: .04, height: 1.05, depth: .09 }, scene); bm.parent = blade; bm.position.y = .55; bm.material = M.steel; bm.isPickable = false; ctx.add(bm);
      const hilt = B.MeshBuilder.CreateBox('qdHilt', { width: .06, height: .3, depth: .06 }, scene); hilt.parent = blade; hilt.position.y = -.12; hilt.material = M.shade; hilt.isPickable = false; ctx.add(hilt);
      sh.rotation.y = 0; // faces +z, toward the Rebel
      const shadowMeshes = sh.getChildMeshes(false);
      const leaf = keep(B.MeshBuilder.CreateDisc('qdLeaf', { radius: .09, tessellation: 7 }, scene)); leaf.material = M.leaf; leaf.isPickable = false; leaf.scaling.set(1.6, 1, 1);
      const slash = keep(B.MeshBuilder.CreatePlane('qdSlash', { width: 1.9, height: .05 }, scene)); slash.material = M.slash; slash.isPickable = false; slash.setEnabled(false);
      const hud = document.getElementById('gameHud'), flash = document.createElement('div');
      flash.style.cssText = 'position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .25s';
      hud.appendChild(flash);
      const doFlash = (col, a = .5) => { flash.style.transition = 'none'; flash.style.background = col; flash.style.opacity = String(a); void flash.offsetWidth; flash.style.transition = 'opacity .45s'; flash.style.opacity = '0'; };
      // the Rebel: across the floor, facing the shadow, the lent katana at the hip
      ctx.player.place(AT[0], AT[1] + GAP / 2, Math.PI);
      const st = { phase: 'ready', round: 0, wins: 0, losses: 0, t: 0, best: null, times: [], sword: null, wait: 1.6, leaf: null, signalAt: 0, decoyDone: false };
      ctx.player.weapon('sword', def.sword || 'stormbringer_blade').then(w => { if (!w || st.phase === 'done') return; st.sword = w; ctx.player.clip('sword_idle', { loop: true }); });
      const cam = def.cam || [AT[0] + 7, 2.5, AT[1] + .4], look = def.look || [AT[0], 1.5, AT[1]];
      ctx.look(cam, look, def.fov || .78);
      H.title(def.title || 'The Quick Draw'); H.score('0 – 0'); H.info('First to three');
      H.hint('Draw (<kbd>Space</kbd>, <kbd>Enter</kbd> or a click) the moment the leaf touches the floor. Not before.');
      // a round: the leaf falls from 3.2 m on a swaying path; now and then a decoy is lifted away by a draft first
      function newRound() {
        st.round++; st.phase = 'wait'; st.signalAt = 0; st.drawn = false; st.reflex = Math.max(.18, (RF[Math.min(st.round - 1, RF.length - 1)] || .25) + (Math.random() - .5) * .04);
        st.decoy = st.round > 1 && Math.random() < .55; st.leaf = { x: (Math.random() - .5) * 1.2, y: 3.4, vy: .55 + Math.random() * .35, sway: Math.random() * 6, decoy: st.decoy, lift: 0 };
        sh.position.set(AT[0], FLOOR, AT[1] - GAP / 2); blade.rotation.set(2.1, 0, -.35); shadowMeshes.forEach(m => m.visibility = 1); slash.setEnabled(false);
        H.info(`Round ${st.round} · first to three`); H.msg(`Round ${st.round}`, 900);
        if (st.sword) ctx.player.clip('sword_idle', { loop: true });
      }
      function draw() {
        if (st.phase === 'wait') { // too soon
          st.phase = 'after'; st.losses++; st.wait = 1.8; H.msg('Too soon!', 1300, 'the leaf had not landed'); ctx.sound('thock'); doFlash('rgba(150,20,20,.6)'); shadowStrike(); score(); return; }
        if (st.phase !== 'signal') return;
        const rt = (performance.now() - st.signalAt) / 1000; st.times.push(rt); st.best = st.best == null ? rt : Math.min(st.best, rt);
        playerCut();
        if (rt < st.reflex) { st.wins++; H.msg(`${Math.round(rt * 1000)} ms`, 1500, `the shadow drew at ${Math.round(st.reflex * 1000)} ms`); ctx.note(880, 'bell'); doFlash('rgba(255,255,255,.55)', .6); cutShadow(); }
        else { st.losses++; H.msg(`${Math.round(rt * 1000)} ms`, 1500, `too slow: the shadow drew at ${Math.round(st.reflex * 1000)} ms`); doFlash('rgba(150,20,20,.6)'); shadowStrike(); }
        st.phase = 'after'; st.wait = 2; score();
      }
      function playerCut() { if (st.sword) ctx.player.clip(Math.random() < .5 ? 'sword_power_slash' : 'sword_down_slash', { hold: true }); else ctx.player.clip('jab'); ctx.sound('thock'); }
      function cutShadow() { slash.setEnabled(true); slash.position.set(AT[0], 1.9, AT[1] - GAP / 2 + .35); slash.rotation.set(0, 0, -.5); st.dissolve = 1; }
      function shadowStrike() { st.lunge = 1; blade.rotation.set(1.57, 0, 0); ctx.sound('thock'); }
      const score = () => H.score(`${st.wins} – ${st.losses}`);
      return {
        update(dt) {
          ctx.look(cam, look); st.t += dt;
          const L = st.leaf;
          if (L && (st.phase === 'wait' || st.phase === 'signal')) {
            if (L.decoy && L.y < .55 && !L.lift) { L.lift = 1; }
            if (L.lift) { L.y += dt * 2.2; L.x += dt * 2.5; if (L.y > 3.6) { L.decoy = false; L.lift = 0; L.x = (Math.random() - .5) * 1.2; L.y = 3.4; L.vy = .5 + Math.random() * .4; } }
            else if (st.phase === 'wait') { L.y -= L.vy * dt; if (L.y <= FLOOR + .02) { L.y = FLOOR + .02; st.phase = 'signal'; st.signalAt = performance.now(); st.signalT = 0; ctx.note(660, 'bell'); } }
            leaf.position.set(AT[0] + L.x + Math.sin(st.t * 2.2 + L.sway) * (L.y > FLOOR + .1 ? .35 : 0), L.y, AT[1] + Math.cos(st.t * 1.7 + L.sway) * .2);
            leaf.rotation.set(L.y > FLOOR + .05 ? Math.sin(st.t * 3) * .8 : Math.PI / 2, st.t, 0);
          }
          if (st.phase === 'signal') { st.signalT += dt; if (st.signalT >= st.reflex && !st.drawn) { // the shadow is quicker
              st.drawn = true; st.losses++; st.phase = 'after'; st.wait = 2; H.msg('The shadow drew first', 1400); doFlash('rgba(150,20,20,.6)'); shadowStrike(); score(); } }
          if (st.lunge > 0) { st.lunge = Math.max(0, st.lunge - dt * 3); sh.position.z = AT[1] - GAP / 2 + (1 - st.lunge) * GAP * .55; }
          if (st.dissolve > 0) { st.dissolve = Math.max(0, st.dissolve - dt * 1.2); shadowMeshes.forEach(m => m.visibility = st.dissolve); slash.scaling.x = 1 + (1 - st.dissolve) * .6; if (!st.dissolve) slash.setEnabled(false); }
          if (st.phase === 'ready' && (st.wait -= dt) <= 0) newRound();
          if (st.phase === 'after' && (st.wait -= dt) <= 0) {
            if (st.wins >= 3 || st.losses >= 3) { st.phase = 'done'; H.hint('');
              const won = st.wins >= 3, pts = st.wins * 20 + (won && st.losses === 0 ? 20 : 0) + (st.best != null && st.best < .25 ? 20 : 0);
              ctx.finish({ score: pts, label: 'points', passed: won && pts >= (def.pass || 0), extra: `${won ? 'You won' : 'The shadow won'} ${Math.max(st.wins, st.losses)} – ${Math.min(st.wins, st.losses)}.${st.best != null ? ` Your quickest draw: ${Math.round(st.best * 1000)} ms.` : ''}` });
            } else newRound();
          }
        },
        key(e, down) { if (!down || e.repeat) return; if (e.key === ' ' || e.key === 'Enter') draw(); },
        pointer(evt) { if (evt.type === B.PointerEventTypes.POINTERDOWN) draw(); },
        _test: { st, draw, newRound, get leafY() { return st.leaf?.y; } },
        dispose() { flash.remove(); nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); }
      };
    }
  };
  window.RebelGames.register('quickdraw', G);
})();
