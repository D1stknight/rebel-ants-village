// The Quick Draw (Oct 15, Kenshi Duel Hall): iaido against the hall's shadow duelist. A leaf drifts down between you;
// the instant it touches the floor, draw (Space, Enter or a click). Draw before it lands and you lose the round; draw
// after the shadow and you lose it too. Some leaves are caught by a draft just above the floor and fly off: hold.
// First to three rounds; the shadow gets quicker every round (0.42 s down to 0.24 s).
// The opponent (Oct 17, Miguel: "the opponent should look a lot better, maybe you should use an NPC as the opponent?"):
// the Kenshi villager from the NPC library steps in for the shadow once its model has loaded, a katana in its right hand;
// it strikes when it wins a round and bows when it is beaten. The shadow stays while it loads, or where none is approved.
// def: { at: [x, z] (the middle between the duelists, frame coordinates), gap: m, cam, look, pass, points,
//   opponentModel: NPC library keys (['kenshi_villager']), opponentYaw }
// Oct 17 (Miguel: "make sure its my character moving and not the NPC when i click the space bar, also make this game
// longer and give it 10 levels"): on the press the Rebel draws and dashes across the floor past the duelist in one cut
// (the duelist only moves after: it bows when beaten, strikes when it wins); ten levels: the duelist quicker on each
// (0.48 s on level 1 down to 0.26 s), matches first to three, then four (level 4), then five (level 7); more leaves blown
// away, and from level 6 cherry petals that land first and must be let be.
(function () {
  const LEVELS = 10;
  const LV = Array.from({ length: LEVELS }, (_, k) => { const u = k / (LEVELS - 1); return { reflex: .48 - .22 * u, to: k < 3 ? 3 : k < 6 ? 4 : 5, decoy: .3 + .35 * u, petal: k >= 5 ? .25 + .35 * u : 0 }; });
  const G = {
    title: 'The Quick Draw',
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const AT = def.at || [0, 0], GAP = def.gap || 6, FLOOR = def.floor ?? .15;
      const store = ctx.util.levelStore(def.id || 'quickdraw'); let L = LV[0];
      const mat = (k, c, em, spec = .1, a) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(spec, spec, spec); if (em) m.emissiveColor = new B.Color3(...em); if (a != null) m.alpha = a; return m; });
      const M = { shade: mat('shade', [.03, .04, .05], [.02, .05, .06], .2), eye: mat('eye', [.4, 1, .95], [.4, 1, .95]), steel: mat('steel', [.8, .85, .9], [.15, .18, .2], .9),
        leaf: mat('leaf', [.85, .35, .12], [.35, .12, .03]), petal: mat('petal', [1, .72, .82], [.4, .22, .28]), slash: mat('slash', [1, 1, 1], [1, 1, 1], 0, .9) };
      M.leaf.backFaceCulling = false; M.petal.backFaceCulling = false; M.slash.disableLighting = true;
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
      // the NPC duelist (see the top): its model under the shadow's node (it carries the place and the lunge)
      let duelist = null;
      ctx.npcModel?.(def.opponentModel || ['kenshi_villager']).then(n => {
        if (!n || st.phase === 'done') return;
        duelist = n; shadowMeshes.forEach(m => m.setEnabled(false));
        n.root.parent = sh; n.root.position.set(0, 0, 0); n.root.rotation.y = def.opponentYaw ?? 0;
        // the katana: blade, guard and grip in the right fist (the hand bone runs along the fingers; the blade along its z)
        const hand = n.bone('mixamorig_RightHand');
        if (hand) {
          const k = new B.TransformNode('qdNpcKatana', scene); k.parent = hand; ctx.add(k);
          const inv = 1 / Math.max(1e-4, hand.absoluteScaling?.x || 1); k.scaling.setAll(inv); k.position.set(0, .05 * inv, 0); k.rotation.set(Math.PI / 2, 0, 0);
          const kb = (nm, w, h, d, m, y) => { const b = B.MeshBuilder.CreateBox(nm, { width: w, height: h, depth: d }, scene); b.parent = k; b.position.y = y; b.material = m; b.isPickable = false; ctx.add(b); return b; };
          kb('qdNpcBlade', .035, 1.05, .08, M.steel, .62); kb('qdNpcGuard', .16, .025, .16, M.shade, .08); kb('qdNpcGrip', .05, .3, .05, M.shade, -.07);
        }
      });
      const leaf = keep(B.MeshBuilder.CreateDisc('qdLeaf', { radius: .09, tessellation: 7 }, scene)); leaf.material = M.leaf; leaf.isPickable = false; leaf.scaling.set(1.6, 1, 1);
      const petal = keep(B.MeshBuilder.CreateDisc('qdPetal', { radius: .07, tessellation: 5 }, scene)); petal.material = M.petal; petal.isPickable = false; petal.setEnabled(false);
      const slash = keep(B.MeshBuilder.CreatePlane('qdSlash', { width: 1.9, height: .05 }, scene)); slash.material = M.slash; slash.isPickable = false; slash.setEnabled(false);
      const hud = document.getElementById('gameHud'), flash = document.createElement('div');
      flash.style.cssText = 'position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .25s';
      hud.appendChild(flash);
      const doFlash = (col, a = .5) => { flash.style.transition = 'none'; flash.style.background = col; flash.style.opacity = String(a); void flash.offsetWidth; flash.style.transition = 'opacity .45s'; flash.style.opacity = '0'; };
      // the Rebel: across the floor, facing the shadow, the lent katana at the hip
      const HOME = [AT[0], AT[1] + GAP / 2], PAST = [AT[0] + 1.1, AT[1] - GAP / 2 - 1.2]; // the dash goes past the duelist's right
      ctx.player.place(HOME[0], HOME[1], Math.PI);
      const st = { phase: 'pick', round: 0, wins: 0, losses: 0, t: 0, best: null, times: [], sword: null, wait: 1.6, leaf: null, signalAt: 0, decoyDone: false, level: 0, dash: null };
      ctx.player.weapon('sword', def.sword || 'stormbringer_blade').then(w => { if (!w || st.phase === 'done') return; st.sword = w; ctx.player.clip('sword_idle', { loop: true }); });
      const cam = def.cam || [AT[0] + 7, 2.5, AT[1] + .4], look = def.look || [AT[0], 1.5, AT[1]];
      ctx.look(cam, look, def.fov || .78);
      H.title(def.title || 'The Quick Draw'); H.score('0 – 0');
      // ── the level picker ──
      let picker = null;
      const showPicker = () => { picker = H.levels({ title: def.title || 'The Quick Draw', sub: 'Draw the instant the maple leaf lands. Ten levels, the duelist quicker on each.', n: LEVELS, open: store.open(LEVELS), done: store.get(), label: k => `${Math.round(LV[k].reflex * 1000)} ms \u00b7 to ${LV[k].to}`, pick: begin }); };
      function begin(k) {
        if (st.phase !== 'pick') return; if (picker) { picker.remove(); picker = null; }
        L = LV[k]; Object.assign(st, { level: k, phase: 'ready', round: 0, wins: 0, losses: 0, best: null, times: [], wait: 1.4, dash: null }); score(); ctx.player.place(HOME[0], HOME[1], Math.PI);
        H.msg(`Level ${k + 1}`, 1300, `first to ${L.to} \u00b7 the duelist draws in ${Math.round(L.reflex * 1000)} ms`);
      }
      H.hint('Draw (<kbd>Space</kbd>, <kbd>Enter</kbd> or a click) the moment the maple leaf touches the floor. Not before; let the pink petals be.');
      showPicker();
      // a round: the leaf falls from 3.2 m on a swaying path; now and then a decoy is lifted away by a draft first
      function newRound() {
        st.round++; st.phase = 'wait'; st.signalAt = 0; st.drawn = false; st.reflex = Math.max(.18, L.reflex - Math.min(.03, st.round * .005) + (Math.random() - .5) * .04);
        st.decoy = st.round > 1 && Math.random() < L.decoy; st.leaf = { x: (Math.random() - .5) * 1.2, y: 3.4, vy: .55 + Math.random() * .35, sway: Math.random() * 6, decoy: st.decoy, lift: 0 };
        // a cherry petal (from level 6) drifts down too, quicker than the leaf: it lands first and means nothing
        st.petal = L.petal && Math.random() < L.petal ? { x: (Math.random() - .5) * 1.6, y: 3.6, vy: st.leaf.vy * (1.4 + Math.random() * .4), sway: Math.random() * 6, down: false } : null; petal.setEnabled(!!st.petal);
        ctx.player.place(HOME[0], HOME[1], Math.PI); st.dash = null;
        sh.position.set(AT[0], FLOOR, AT[1] - GAP / 2); blade.rotation.set(2.1, 0, -.35); shadowMeshes.forEach(m => m.visibility = 1); slash.setEnabled(false);
        duelist?.play('idle', { loop: true });
        H.info(`Level ${st.level + 1} \u00b7 round ${st.round} \u00b7 first to ${L.to}`); H.msg(`Round ${st.round}`, 900);
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
      // the draw is fast (Miguel, Oct 17: the moves were too slow for a duel decided in a quarter second): the Rebel cuts
      // and dashes past the duelist in 0.16 s, the blade's arc left in the air
      function playerCut() { if (st.sword) ctx.player.clip(Math.random() < .5 ? 'sword_power_slash' : 'sword_down_slash', { hold: true, speed: 2.2 }); else ctx.player.clip('jab', { speed: 1.8 }); ctx.sound('whoosh'); ctx.sound('thock'); st.dash = { t: 0 }; }
      function cutShadow() { slash.setEnabled(true); slash.position.set(AT[0], 1.9, AT[1] - GAP / 2 + .35); slash.rotation.set(0, 0, -.5); st.dissolve = 1; duelist?.play('bow', { speed: 1.3 }); }
      function shadowStrike() { st.lunge = 1; blade.rotation.set(1.57, 0, 0); ctx.sound('thock'); duelist?.play('pointing', { speed: 2.6 }); }
      const score = () => H.score(`${st.wins} – ${st.losses}`);
      return {
        update(dt) {
          ctx.look(cam, look); st.t += dt;
          if (st.phase === 'pick') return;
          // the dash: from home past the duelist's right in 0.16 s, the Rebel facing the way it runs, then still
          if (st.dash) { const d = st.dash; d.t += dt; const u = Math.min(1, d.t / .16), e = 1 - (1 - u) * (1 - u); ctx.player.place(HOME[0] + (PAST[0] - HOME[0]) * e, HOME[1] + (PAST[1] - HOME[1]) * e, Math.PI + .12); }
          const Lf = st.leaf;
          if (Lf && (st.phase === 'wait' || st.phase === 'signal')) {
            if (Lf.decoy && Lf.y < .55 && !Lf.lift) { Lf.lift = 1; }
            if (Lf.lift) { Lf.y += dt * 2.2; Lf.x += dt * 2.5; if (Lf.y > 3.6) { Lf.decoy = false; Lf.lift = 0; Lf.x = (Math.random() - .5) * 1.2; Lf.y = 3.4; Lf.vy = .5 + Math.random() * .4; } }
            else if (st.phase === 'wait') { Lf.y -= Lf.vy * dt; if (Lf.y <= FLOOR + .02) { Lf.y = FLOOR + .02; st.phase = 'signal'; st.signalAt = performance.now(); st.signalT = 0; ctx.note(660, 'bell'); } }
            leaf.position.set(AT[0] + Lf.x + Math.sin(st.t * 2.2 + Lf.sway) * (Lf.y > FLOOR + .1 ? .35 : 0), Lf.y, AT[1] + Math.cos(st.t * 1.7 + Lf.sway) * .2);
            leaf.rotation.set(Lf.y > FLOOR + .05 ? Math.sin(st.t * 3) * .8 : Math.PI / 2, st.t, 0);
          }
          const Pt = st.petal; // the petal lands without a sound; it lies there until the round ends
          if (Pt && (st.phase === 'wait' || st.phase === 'signal')) { if (!Pt.down) { Pt.y -= Pt.vy * dt; if (Pt.y <= FLOOR + .02) { Pt.y = FLOOR + .02; Pt.down = true; } }
            petal.position.set(AT[0] + Pt.x + Math.sin(st.t * 2.6 + Pt.sway) * (Pt.down ? 0 : .3), Pt.y, AT[1] + .4 + Math.cos(st.t * 2 + Pt.sway) * .15); petal.rotation.set(Pt.down ? Math.PI / 2 : Math.sin(st.t * 4) * .9, st.t * 1.3, 0); }
          if (st.phase === 'signal') { st.signalT += dt; if (st.signalT >= st.reflex && !st.drawn) { // the shadow is quicker
              st.drawn = true; st.losses++; st.phase = 'after'; st.wait = 2; H.msg('The shadow drew first', 1400); doFlash('rgba(150,20,20,.6)'); shadowStrike(); score(); } }
          if (st.lunge > 0) { st.lunge = Math.max(0, st.lunge - dt * 3); sh.position.z = AT[1] - GAP / 2 + (1 - st.lunge) * GAP * .55; }
          if (st.dissolve > 0) { st.dissolve = Math.max(0, st.dissolve - dt * 1.2); shadowMeshes.forEach(m => m.visibility = st.dissolve); slash.scaling.x = 1 + (1 - st.dissolve) * .6; if (!st.dissolve) slash.setEnabled(false); }
          if (st.phase === 'ready' && (st.wait -= dt) <= 0) newRound();
          if (st.phase === 'after' && (st.wait -= dt) <= 0) {
            if (st.wins >= L.to || st.losses >= L.to) { st.phase = 'done'; H.hint(''); petal.setEnabled(false);
              const won = st.wins >= L.to, pts = st.wins * 20 + (won && st.losses === 0 ? 20 : 0) + (st.best != null && st.best < .25 ? 20 : 0) + (won ? st.level * 10 : 0); if (won) store.set(st.level + 1);
              ctx.finish({ score: pts, label: 'points', passed: won && pts >= (def.pass || 0), kicker: won ? `Level ${st.level + 1} cleared` : `Level ${st.level + 1}`, solved: won, next: won && st.level + 1 < LEVELS ? st.level + 1 : null,
                extra: `${won ? 'You won' : 'The duelist won'} ${Math.max(st.wins, st.losses)} – ${Math.min(st.wins, st.losses)}.${st.best != null ? ` Your quickest draw: ${Math.round(st.best * 1000)} ms.` : ''}` });
            } else newRound();
          }
        },
        key(e, down) { if (!down || e.repeat) return; if (picker && picker.key(e)) return; if (e.key === ' ' || e.key === 'Enter') draw(); },
        pointer(evt) { if (evt.type === B.PointerEventTypes.POINTERDOWN) draw(); },
        restart() { if (st.phase === 'pick') return; st.phase = 'pick'; st.leaf = null; st.petal = null; petal.setEnabled(false); ctx.player.place(HOME[0], HOME[1], Math.PI); showPicker(); },
        _test: { st, draw, newRound, begin, LV, get L() { return L; }, get leafY() { return st.leaf?.y; }, get duelist() { return duelist; } },
        dispose() { if (picker) picker.remove(); flash.remove(); nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); }
      };
    }
  };
  window.RebelGames.register('quickdraw', G);
})();
