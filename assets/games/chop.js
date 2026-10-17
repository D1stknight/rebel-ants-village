// Log split (Oct 15, Ashigaru): a log stands on the block; the mark runs along the bar and the Rebel chops when you
// press (Space, a click or a tap): in the gold the log splits clean (the middle of the gold splits it perfectly), outside
// it only cracks and needs a second chop. Ten logs in 40 seconds; the mark speeds up log by log.
// def: { logs: 10, seconds: 40, block: [x, z] (frame coords of the chopping block), pass, points }
// Oct 17 (Miguel: "we need the animations ... i gave you", "the game was too fast"): with the games pack the Rebel
// swings an axe (game_chop: the swing from the wind-up's top, the blade into the log a quarter second after the press,
// back to the stance before the combo's second swing); the mark runs slower (.6, +.06 a log) and the gold is wider.
(function () {
  const G = {
    title: 'Log Split', moves: true,
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const LOGS = def.logs || 10, DUR = def.seconds || 40, BK = def.block || [0, 1.5], TOP = def.top || 1, LH = 1, LD = .76; // Rebel scale: the stump waist high
      const mat = (k, c, em) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(.04, .04, .04); if (em) m.emissiveColor = new B.Color3(...em); return m; });
      const block = B.MeshBuilder.CreateCylinder('chopBlock', { height: TOP, diameter: 1.35, tessellation: 18 }, scene); block.position.set(BK[0], TOP / 2, BK[1]); block.material = mat('stump', [.42, .28, .15]); block.isPickable = false; ctx.add(block);
      const bark = mat('bark', [.36, .24, .13]), wood = mat('wood', [.82, .66, .42], [.08, .06, .03]);
      // a log = two half cylinders, so it can fall apart; split halves fly to the sides and lie there a moment
      function makeLog() {
        const node = new B.TransformNode('chopLog', scene); ctx.add(node); node.position.set(BK[0], TOP, BK[1]); node.rotation.y = Math.PI / 2; // splits to the left and right
        const halves = [-1, 1].map(sd => {
          // half a cylinder (z >= 0 in its own frame), the other half turned round; a pale face on the cut
          const h = B.MeshBuilder.CreateCylinder('chopHalf', { height: LH, diameter: LD, tessellation: 14, arc: .5, enclose: true }, scene);
          h.material = bark; h.parent = node; h.position.y = LH / 2; h.rotation.y = sd > 0 ? 0 : Math.PI; h.isPickable = false;
          const face = B.MeshBuilder.CreateBox('chopFace', { width: LD - .03, height: LH - .02, depth: .012 }, scene); face.material = wood; face.parent = h; face.position.z = .007; face.isPickable = false;
          return h;
        });
        return { node, halves, cracks: 0, t: 0, split: false, v: [0, 0] };
      }
      const st = { k: 0, score: 0, clean: 0, left: DUR, mark: 0, dir: 1, speed: .6, phase: 'intro', wait: 1.4, log: null, gone: [], cool: 0, swing: 0 };
      const zone = () => { const w = Math.max(.12, .26 - st.k * .012); return [.5 - w / 2, .5 + w / 2]; };
      // the axe (games pack): the haft runs on from the right forearm through the fist, the blade across its end
      const PACK = !!ctx.player.has?.('game_chop'), axe = new B.TransformNode('chopAxe', scene); ctx.add(axe); axe.setEnabled(PACK);
      const steel = mat('axeSteel', [.55, .56, .6], [.06, .06, .07]);
      { const h = B.MeshBuilder.CreateBox('chopHaft', { width: .07, height: .07, depth: 1.1 }, scene); h.material = mat('haft', [.45, .3, .16]); h.parent = axe; h.position.z = .45; h.isPickable = false;
        const bl = B.MeshBuilder.CreateBox('chopBlade', { width: .05, height: .34, depth: .26 }, scene); bl.material = steel; bl.parent = axe; bl.position.set(0, .12, .92); bl.isPickable = false; }
      const axeInHand = () => { const h = ctx.player.bone('RightHand'), f = ctx.player.bone('RightForeArm'); if (!h || !f) return;
        const lh = ctx.toLocal(h), d = lh.subtract(ctx.toLocal(f)).normalize(); axe.position.copyFrom(lh.subtract(d.scale(.12)));
        axe.rotation.y = Math.atan2(d.x, d.z); axe.rotation.x = -Math.asin(Math.max(-1, Math.min(1, d.y))); };
      const info = () => H.info(`Log ${Math.min(st.k + 1, LOGS)} / ${LOGS} · ${Math.ceil(st.left)} s`);
      function chop() {
        if (st.phase !== 'play' || !st.log || st.cool > 0) return;
        st.cool = PACK ? .55 : .35;
        if (PACK) { ctx.player.clip('game_chop', { from: .75, hold: true }); st.swing = .55; } else ctx.player.clip(Math.random() < .5 ? 'cross_punch' : 'elbow_punch');
        const z = zone(), m = st.mark, inZ = m >= z[0] && m <= z[1], perfect = Math.abs(m - .5) < (z[1] - z[0]) * .18;
        if (PACK) { st.hitIn = .25; st.hitRes = { inZ, perfect }; return; } // the blade lands a moment after the press
        land(inZ, perfect);
      }
      function land(inZ, perfect) {
        const L = st.log; if (!L) return;
        if (inZ || L.cracks >= 1) {
          const pts = inZ ? (perfect ? 15 : 10) : 5; st.score += pts; if (inZ) st.clean++;
          L.split = true; L.t = 0; L.v = [perfect ? 2.6 : 1.8, perfect ? 2.6 : 1.8];
          const p = ctx.screenOf(ctx.toWorld(BK[0], TOP + LH + .3, BK[1])); H.pop(p.x, p.y, '+' + pts);
          H.msg(perfect ? 'Perfect split!' : inZ ? 'Clean!' : 'Split', 650); ctx.sound(perfect ? 'gamewin' : 'thock');
          st.gone.push(L); st.log = null; st.k++; st.wait = .45; st.speed = .6 + st.k * .06;
          H.score(st.score); info();
          if (st.k >= LOGS) { st.phase = 'end'; st.wait = 1.1; }
        } else { L.cracks++; H.msg('Cracked: again!', 600); ctx.sound('thock'); L.halves.forEach((h, i) => { h.position.z = (i ? 1 : -1) * .025; }); }
      }
      ctx.player.place(0, 0, 0);
      const cam = def.cam || [-3.5, 3.4, -2.3], at = def.at || [BK[0], TOP + .4, BK[1]];
      ctx.look(cam, at, def.fov || .85);
      H.title(def.title || 'Log Split'); H.score(0); info();
      H.hint('Chop when the mark is in the gold: <kbd>Space</kbd>, a click or a tap. The middle of the gold splits it perfectly.');
      H.msg(def.title || 'Log Split', 1400, `${LOGS} logs · ${DUR} s`);
      const inst = {
        update(dt) {
          ctx.look(cam, at);
          if (st.cool > 0) st.cool -= dt;
          if (PACK) { axeInHand(); if (st.swing > 0 && (st.swing -= dt) <= 0) ctx.player.idle(); if (st.hitRes && (st.hitIn -= dt) <= 0) { const r = st.hitRes; st.hitRes = null; land(r.inZ, r.perfect); } }
          if (st.phase === 'intro' && (st.wait -= dt) <= 0) st.phase = 'play';
          if (st.phase === 'play') {
            st.left -= dt; if (st.left <= 0) { st.left = 0; st.phase = 'end'; st.wait = .8; H.msg("Time's up", 900); }
            if (!st.log && (st.wait -= dt) <= 0 && st.k < LOGS) { st.log = makeLog(); st.mark = 0; st.dir = 1; }
            if (st.log) { st.mark += st.dir * st.speed * dt; if (st.mark > 1) { st.mark = 1; st.dir = -1; } if (st.mark < 0) { st.mark = 0; st.dir = 1; } H.meter({ label: 'Chop', value: st.mark, zone: zone() }); }
            info();
          }
          for (let i = st.gone.length - 1; i >= 0; i--) { // the halves fall away to both sides
            const L = st.gone[i]; L.t += dt;
            L.halves.forEach((h, j) => { const sd = j ? 1 : -1; h.position.z += sd * L.v[j] * dt * (L.t < .5 ? 1 : .2); h.rotation.x = sd * Math.min(Math.PI / 2, L.t * 4.5); h.position.y = Math.max(-TOP + LD / 4, LH / 2 - 4.9 * Math.max(0, L.t - .12) ** 2); });
            if (L.t > 1.4) { L.node.dispose(); st.gone.splice(i, 1); }
          }
          if (st.phase === 'end' && (st.wait -= dt) <= 0) {
            st.phase = 'done'; H.meter(null); H.hint('');
            if (st.score >= (def.pass || 0)) ctx.sound('gamewin');
            ctx.finish({ score: st.score, label: 'points', extra: `${st.k} of ${LOGS} logs split, ${st.clean} clean.` });
          }
        },
        key(e, down) { if (down && !e.repeat && (e.key === ' ' || e.key === 'Enter' || e.key.toLowerCase() === 'o')) chop(); },
        pointer(evt) { if (evt.type === B.PointerEventTypes.POINTERDOWN) chop(); },
        _test: { st, chop, zone },
        dispose() { st.gone.forEach(L => { try { L.node.dispose(); } catch (e) {} }); if (st.log) st.log.node.dispose(); }
      };
      return inst;
    }
  };
  window.RebelGames.register('chop', G);
})();
