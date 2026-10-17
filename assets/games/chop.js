// Log split (Oct 15, Ashigaru): a log stands on the block; the mark runs along the bar and the Rebel chops when you
// press (Space, a click or a tap): in the gold the log splits clean (the middle of the gold splits it perfectly), outside
// it only cracks and needs a second chop.
// def: { block: [x, z] (frame coords of the chopping block), pass, points }
// Oct 17 (Miguel: "we need the animations ... i gave you", "the game was too fast"): the mark runs slower and the gold is
// wider.
// Oct 17 (Miguel: "hes not holding the axe in its hands he has it attached to the arm, also make this 20 levels"): the
// haft goes through the Rebel's fist (ctx.player.grip, from the finger bones), the edge forward, and with the games pack
// the Rebel chops overhead: the axe raised while the mark runs, the downward strike on the press (game_hammer_up /
// game_hammer), the log splitting as the blade comes down to it. Twenty levels: more logs and less time for each, a
// quicker mark and a narrower gold, knotty logs (a smaller gold) from level 6, the gold in a new place for every log from
// level 11, oak logs that take two clean chops from level 15. A level is cleared when every log is split in time.
// Oct 17 (the axe went on through the log and past it: the strike swings on down beside the Rebel): the move stops where
// the edge bites into the log's top (ctx.player.pose, the moment searched between two frames), holds there while the log
// splits or cracks, then the axe comes up again; the Rebel stands back so the edge lands on the log's middle.
(function () {
  const LEVELS = 20;
  const LV = Array.from({ length: LEVELS }, (_, k) => { const u = k / (LEVELS - 1), logs = 10 + Math.round(10 * u);
    return { logs, seconds: Math.round(logs * (4.4 - 1.1 * u)), speed: .6 + .5 * u, step: .03 + .02 * u, gold: .28 - .12 * u, knot: k >= 5 ? .15 + .25 * u : 0, shift: k >= 10, oak: k >= 14 ? .15 + .2 * u : 0 }; });
  const G = {
    title: 'Log Split', moves: true,
    howTo: { lines: [
      'A log stands on the chopping block and a mark runs along the bar.',
      'Chop (Space, a click or a tap) while the mark is in the gold: the log splits clean. The bright middle of the gold splits it perfectly.',
      'Outside the gold the log only cracks: chop it again.',
      'Knotty logs (dark rings) have a smaller gold. Oak logs (red heartwood) take two clean chops.',
      'Split every log before the time runs out to clear the level; twenty levels, each quicker than the last.'] },
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const BK = def.block || [0, 1.5], TOP = def.top || 1, LH = 1, LD = .76; // Rebel scale: the stump waist high
      const store = ctx.util.levelStore(def.id || 'chop');
      const mat = (k, c, em) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(.04, .04, .04); if (em) m.emissiveColor = new B.Color3(...em); return m; });
      const block = B.MeshBuilder.CreateCylinder('chopBlock', { height: TOP, diameter: 1.35, tessellation: 18 }, scene); block.position.set(BK[0], TOP / 2, BK[1]); block.material = mat('stump', [.42, .28, .15]); block.isPickable = false; ctx.add(block);
      const bark = mat('bark', [.36, .24, .13]), wood = mat('wood', [.82, .66, .42], [.08, .06, .03]), oakBark = mat('oakBark', [.3, .2, .12]), oakWood = mat('oakWood', [.62, .3, .2], [.07, .03, .02]), knotM = mat('knot', [.22, .14, .07]);
      // a log = two half cylinders, so it can fall apart; split halves fly to the sides and lie there a moment
      function makeLog(kind) {
        const node = new B.TransformNode('chopLog', scene); ctx.add(node); node.position.set(BK[0], TOP, BK[1]); node.rotation.y = Math.PI / 2; // splits to the left and right
        const halves = [-1, 1].map(sd => {
          // half a cylinder (z >= 0 in its own frame), the other half turned round; a pale face on the cut
          const h = B.MeshBuilder.CreateCylinder('chopHalf', { height: LH, diameter: LD, tessellation: 14, arc: .5, enclose: true }, scene);
          h.material = kind === 'oak' ? oakBark : bark; h.parent = node; h.position.y = LH / 2; h.rotation.y = sd > 0 ? 0 : Math.PI; h.isPickable = false;
          const face = B.MeshBuilder.CreateBox('chopFace', { width: LD - .03, height: LH - .02, depth: .012 }, scene); face.material = kind === 'oak' ? oakWood : wood; face.parent = h; face.position.z = .007; face.isPickable = false;
          if (kind === 'knot') for (const y of [-.22, .18]) { const kn = B.MeshBuilder.CreateTorus('chopKnot', { diameter: .16, thickness: .05, tessellation: 10 }, scene); kn.material = knotM; kn.parent = h; kn.rotation.x = Math.PI / 2; kn.position.set((y > 0 ? .12 : -.1), y, LD / 2 - .02); kn.isPickable = false; }
          return h;
        });
        return { node, halves, cracks: 0, t: 0, split: false, v: [0, 0], kind, clean: 0 };
      }
      const st = { phase: 'pick', k: 0, score: 0, clean: 0, left: 0, mark: 0, dir: 1, speed: .6, wait: 1.4, log: null, gone: [], cool: 0, center: .5, level: 0, blow: null, pin: null };
      let L = LV[0];
      const zone = () => { const c = st.center, w = Math.max(.08, (L.gold - st.k * .004) * (st.log?.kind === 'knot' ? .65 : 1)); return [c - w / 2, c + w / 2]; };
      // the axe: the haft through the fist toward the thumb, the edge the way the knuckles face; the head's tip is HEAD
      const PACK = !!ctx.player.has?.('game_hammer') && !!ctx.player.has?.('game_hammer_up'), OLD = !PACK && !!ctx.player.has?.('game_chop');
      const axe = new B.TransformNode('chopAxe', scene); ctx.add(axe); axe.setEnabled(PACK || OLD);
      const steel = mat('axeSteel', [.55, .56, .6], [.06, .06, .07]), HEAD = new V3(0, .8, .3);
      { const h = B.MeshBuilder.CreateCylinder('chopHaft', { height: 1.15, diameter: .075, tessellation: 8 }, scene); h.material = mat('haft', [.45, .3, .16]); h.parent = axe; h.position.y = .27; h.isPickable = false;
        const eye = B.MeshBuilder.CreateBox('chopEye', { width: .1, height: .16, depth: .14 }, scene); eye.material = steel; eye.parent = axe; eye.position.set(0, .78, .02); eye.isPickable = false;
        const bl = B.MeshBuilder.CreateBox('chopBlade', { width: .045, height: .34, depth: .24 }, scene); bl.material = steel; bl.parent = axe; bl.position.set(0, .77, .18); bl.isPickable = false; }
      const axeInHand = () => { const g = ctx.player.grip?.('Right'); if (!g) return false;
        axe.position.copyFrom(g.p); axe.rotationQuaternion = B.Quaternion.FromLookDirectionLH(g.edge, g.up);
        st.head = g.p.add(g.up.scale(HEAD.y)).add(g.edge.scale(HEAD.z)); // where the swing alone puts the edge
        // a cracked log holds the blade a moment (the edge stays in the wood until the hand pulls it out)
        if (st.pin) { const d = st.pin.subtract(st.head); if (d.length() > .5 || (st.pin.t -= 1 / 60) <= 0) st.pin = null; else axe.position.addInPlace(d); }
        return true; };
      // the Rebel stands where the strike's edge comes down onto the log's top (measured on the move, frame by frame)
      const REACH = def.reach ?? 2.3, SIDE = def.side ?? .3, LOGTOP = TOP + LH, BITE = .06; // the edge sinks BITE into the wood
      const info = () => H.info(`Level ${st.level + 1} · log ${Math.min(st.k + 1, L.logs)} / ${L.logs} · ${Math.ceil(st.left)} s`);
      const raise = () => { if (PACK) ctx.player.clip('game_hammer_up', { hold: true }); };
      function chop() {
        if (st.phase !== 'play' || !st.log || st.cool > 0) return;
        st.cool = PACK ? .65 : .35;
        const z = zone(), m = st.mark, inZ = m >= z[0] && m <= z[1], perfect = Math.abs(m - st.center) < (z[1] - z[0]) * .18;
        if (PACK) { ctx.player.clip('game_hammer', { hold: true }); st.blow = { t: 0, inZ, perfect, up: false, pt: null }; st.back = 0; return; } // lands as the edge meets the log
        if (OLD) { ctx.player.clip('game_chop', { from: .75, hold: true }); st.swing = .55; st.hitIn = .25; st.hitRes = { inZ, perfect }; return; }
        ctx.player.clip(Math.random() < .5 ? 'cross_punch' : 'elbow_punch'); land(inZ, perfect);
      }
      function land(inZ, perfect) {
        const Lg = st.log; if (!Lg) return;
        ctx.sound('thock');
        if (inZ && Lg.kind === 'oak' && Lg.clean < 1) { Lg.clean++; H.msg('Oak: once more!', 650); Lg.halves.forEach((h, i) => { h.position.z = (i ? 1 : -1) * .035; }); if (st.head && OLD) { st.pin = st.head.clone(); st.pin.t = .35; } nextMark(); return; }
        if (inZ || Lg.cracks >= 1) {
          const pts = inZ ? (perfect ? 15 : 10) : 5; st.score += pts; if (inZ) st.clean++;
          Lg.split = true; Lg.t = 0; Lg.v = [perfect ? 2.6 : 1.8, perfect ? 2.6 : 1.8];
          const p = ctx.screenOf(ctx.toWorld(BK[0], TOP + LH + .3, BK[1])); H.pop(p.x, p.y, '+' + pts);
          H.msg(perfect ? 'Perfect split!' : inZ ? 'Clean!' : 'Split', 650); if (perfect) ctx.sound('clang');
          st.gone.push(Lg); st.log = null; st.k++; st.wait = .45; st.speed = L.speed + st.k * L.step;
          H.score(st.score); info();
          if (st.k >= L.logs) { st.phase = 'end'; st.wait = 1.1; st.won = true; }
        } else { Lg.cracks++; H.msg('Cracked: again!', 600); Lg.halves.forEach((h, i) => { h.position.z = (i ? 1 : -1) * .025; }); if (st.head && OLD) { st.pin = st.head.clone(); st.pin.t = .35; } nextMark(); }
      }
      function nextMark() { if (L.shift) st.center = .3 + Math.random() * .4; }
      // the strike: once the edge has been up high, the frame it comes below the log's top (less the bite) the move is set
      // back to the moment between the two frames when it reached it (halving the gap six times) and held there for HOLD s
      const HOLD = .32;
      function strike(dt) {
        const b = st.blow; b.t += dt; const ct = ctx.player.clipTime('game_hammer'), y = st.head ? st.head.y : null;
        if (y != null && y > LOGTOP + .9) b.up = true;
        if (b.up && b.pt != null && ct != null && y <= LOGTOP - BITE) {
          let lo = b.pt, hi = ct;
          for (let i = 0; i < 6; i++) { const m = (lo + hi) / 2; ctx.player.pose('game_hammer', m); axeInHand(); if (st.head.y > LOGTOP - BITE) lo = m; else hi = m; }
          ctx.player.pose('game_hammer', hi); axeInHand(); st.blow = null; st.back = HOLD; st.bit = hi; land(b.inZ, b.perfect); return;
        }
        if (ct != null) b.pt = ct;
        if (b.t > .9) { st.blow = null; st.back = .2; land(b.inZ, b.perfect); } // never met the log (a short arm): it still counts
      }
      // ── the level picker ──
      let picker = null;
      const showPicker = () => { picker = H.levels({ title: def.title || 'Log Split', sub: 'Split every log before the time runs out. Twenty levels, each quicker than the last.', n: LEVELS, open: store.open(LEVELS), done: store.get(), label: k => `${LV[k].logs} logs · ${LV[k].seconds} s`, pick: begin }); };
      function begin(k) {
        if (st.phase !== 'pick') return; if (picker) { picker.remove(); picker = null; }
        L = LV[k]; Object.assign(st, { level: k, k: 0, score: 0, clean: 0, left: L.seconds, speed: L.speed, phase: 'intro', wait: 1.2, center: .5, won: false }); H.score(0); info();
        H.msg(`Level ${k + 1}`, 1300, `${L.logs} logs · ${L.seconds} s${L.oak ? ' · oak' : L.knot ? ' · knots' : ''}`); raise();
      }
      if (PACK) ctx.player.place(BK[0] + SIDE, BK[1] - REACH, 0); else ctx.player.place(0, 0, 0);
      const cam = def.cam || [-3.5, 3.4, -2.3], at = def.at || [BK[0], TOP + .4, BK[1]];
      ctx.look(cam, at, def.fov || .85);
      H.title(def.title || 'Log Split'); H.score(0); info();
      H.hint('Chop when the mark is in the gold: <kbd>Space</kbd>, a click or a tap. The middle of the gold splits it perfectly.');
      showPicker();
      const inst = {
        update(dt) {
          ctx.look(cam, at);
          if (st.cool > 0) st.cool -= dt;
          if (PACK || OLD) axeInHand();
          if (OLD) { if (st.swing > 0 && (st.swing -= dt) <= 0) ctx.player.idle(); if (st.hitRes && (st.hitIn -= dt) <= 0) { const r = st.hitRes; st.hitRes = null; land(r.inZ, r.perfect); } }
          if (st.blow) strike(dt);
          if (st.back > 0 && (st.back -= dt) <= 0 && st.phase !== 'done') raise();
          if (st.phase === 'intro' && (st.wait -= dt) <= 0) st.phase = 'play';
          if (st.phase === 'play') {
            st.left -= dt; if (st.left <= 0) { st.left = 0; st.phase = 'end'; st.wait = .8; H.msg("Time's up", 900); }
            if (!st.log && (st.wait -= dt) <= 0 && st.k < L.logs) { const r = Math.random(); st.log = makeLog(L.oak && r < L.oak ? 'oak' : L.knot && r < L.oak + L.knot ? 'knot' : 'pine'); st.mark = 0; st.dir = 1; nextMark(); }
            if (st.log) { st.mark += st.dir * st.speed * dt; if (st.mark > 1) { st.mark = 1; st.dir = -1; } if (st.mark < 0) { st.mark = 0; st.dir = 1; } H.meter({ label: st.log.kind === 'oak' ? 'Chop · oak' : st.log.kind === 'knot' ? 'Chop · knotty' : 'Chop', value: st.mark, zone: zone() }); }
            info();
          }
          for (let i = st.gone.length - 1; i >= 0; i--) { // the halves fall away to both sides
            const Lg = st.gone[i]; Lg.t += dt;
            Lg.halves.forEach((h, j) => { const sd = j ? 1 : -1; h.position.z += sd * Lg.v[j] * dt * (Lg.t < .5 ? 1 : .2); h.rotation.x = sd * Math.min(Math.PI / 2, Lg.t * 4.5); h.position.y = Math.max(-TOP + LD / 4, LH / 2 - 4.9 * Math.max(0, Lg.t - .12) ** 2); });
            if (Lg.t > 1.4) { Lg.node.dispose(); st.gone.splice(i, 1); }
          }
          if (st.phase === 'end' && (st.wait -= dt) <= 0) {
            st.phase = 'done'; H.meter(null); H.hint('');
            const ok = !!st.won, bonus = ok ? Math.round(st.left) * 2 : 0; st.score += bonus; H.score(st.score);
            if (ok) { store.set(st.level + 1); ctx.sound('gamewin'); }
            ctx.finish({ score: st.score, label: 'points', kicker: ok ? `Level ${st.level + 1} cleared` : `Level ${st.level + 1}`, solved: ok, next: ok && st.level + 1 < LEVELS ? st.level + 1 : null,
              extra: `${st.k} of ${L.logs} logs split, ${st.clean} clean${bonus ? `, +${bonus} for the time left` : ''}.` });
          }
        },
        key(e, down) { if (!down || e.repeat) return; if (picker && picker.key(e)) return; if (e.key === ' ' || e.key === 'Enter' || e.key.toLowerCase() === 'o') chop(); },
        pointer(evt) { if (evt.type === B.PointerEventTypes.POINTERDOWN) chop(); },
        restart() { if (st.phase === 'pick') return; if (st.log) { st.log.node.dispose(); st.log = null; } st.blow = null; st.phase = 'pick'; H.meter(null); showPicker(); },
        _test: { st, chop, zone, begin, LV, get L() { return L; }, axe, PACK, LOGTOP, BITE },
        dispose() { if (picker) picker.remove(); st.gone.forEach(Lg => { try { Lg.node.dispose(); } catch (e) {} }); if (st.log) st.log.node.dispose(); }
      };
      return inst;
    }
  };
  window.RebelGames.register('chop', G);
})();
