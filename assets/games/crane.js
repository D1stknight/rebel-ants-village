// The cargo crane (Oct 15, Wokou quay): move the stack of crates from the quay to the ship's deck, one crate at a time,
// with the crane's hook; a bigger crate never goes on a smaller one (the Tower of Hanoi). Click a stack or press 1 / 2 / 3
// to lift its top crate, then a stack to set it down. Fewer moves score more: the best is 2^n - 1.
// def: { crates: 4, stacks: [[x, z], [x, z], [x, z]] (frame coords: start, middle, goal), pass, points,
//        hide: [kit types] (the village's own crane steps aside while the game's stands there) }
// Oct 17 (Miguel: the puzzles need a how-to, every board a Restart): howTo (the rules in a few lines) and inst.restart
// (every crate back on the quay, the hook over it, the moves from 0).
(function () {
  const G = {
    title: 'Cargo Crane',
    howTo: {
      lines: ['Move the whole stack of crates from the quay (stack 1) onto the ship\'s hatch (stack 3).',
        'The hook carries one crate at a time: click a stack (or press 1, 2 or 3) to lift its top crate, then click another stack to set it down.',
        'A bigger crate may never sit on a smaller one. Use the middle pallet (2) to park crates on the way.',
        'Fewer moves score more: the fewest possible is on the info line (15 moves for 4 crates).',
        'Tip: the biggest crate can only move once every other crate is stacked on the spare pallet, so first move the smaller tower out of its way.']
    },
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const N = Math.max(3, Math.min(6, def.crates || 4)), S = def.stacks || [[-2.6, 4.2], [0, 5], [2.6, 4.2]], CH = .42;
      const mat = (k, c, em) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(.06, .06, .06); if (em) m.emissiveColor = new B.Color3(...em); return m; });
      // the bases: two quay pallets and the ship's hatch; each a pickable pad
      const pads = S.map(([x, z], i) => { const p = B.MeshBuilder.CreateBox('craneBase', { width: 1.9, height: .12, depth: 1.9 }, scene); p.position.set(x, .06, z); p.material = mat(i === 2 ? 'hatch' : 'pallet', i === 2 ? [.28, .18, .1] : [.52, .38, .2]); p.metadata = { craneStack: i }; ctx.add(p); return p; });
      // the crates: widths shrink with size, each its own colour band
      const COLS = [[.62, .36, .18], [.55, .42, .22], [.66, .5, .26], [.5, .3, .15], [.6, .45, .3], [.45, .33, .2]];
      const crates = [];
      for (let k = 0; k < N; k++) {
        const w = 1.6 - k * (1.0 / (N - 1)), b = B.MeshBuilder.CreateBox('craneCrate', { width: w, height: CH, depth: w * .9 }, scene);
        b.material = mat('crate' + k, COLS[k % COLS.length]); b.metadata = { craneCrate: k }; ctx.add(b);
        const band = B.MeshBuilder.CreateBox('craneBand', { width: w + .02, height: .06, depth: w * .9 + .02 }, scene); band.parent = b; band.material = mat('band', [.15, .12, .1]); band.isPickable = false;
        crates.push({ k, mesh: b, w });
      }
      // the crane: a mast, a jib, the rope and the hook that carries the lifted crate
      const mast = B.MeshBuilder.CreateBox('craneMast', { width: .3, height: 6.2, depth: .3 }, scene); mast.position.set(0, 3.1, 7.4); mast.material = mat('wood', [.36, .23, .12]); mast.isPickable = false; ctx.add(mast);
      const jib = B.MeshBuilder.CreateBox('craneJib', { width: 7, height: .24, depth: .24 }, scene); jib.position.set(0, 6.1, 5.2); jib.material = mat('wood', [.36, .23, .12]); jib.isPickable = false; ctx.add(jib);
      const rope = B.MeshBuilder.CreateCylinder('craneRope', { height: 1, diameter: .04, tessellation: 5 }, scene); rope.material = mat('rope', [.6, .5, .32]); rope.isPickable = false; ctx.add(rope);
      const hook = B.MeshBuilder.CreateTorus('craneHook', { diameter: .3, thickness: .06, tessellation: 12 }, scene); hook.material = mat('iron', [.2, .2, .22]); hook.isPickable = false; ctx.add(hook);
      const hidden = [];
      if (def.hide && def.hide.length) { const o = ctx.toWorld(0, 0, 6); for (const n of scene.transformNodes) {
        if (!n.isEnabled() || !(def.hide.includes(n.metadata && n.metadata.type) || def.hide.some(t => n.name.startsWith(t + 'RootClone_')))) continue;
        const a = n.getAbsolutePosition(); if (Math.hypot(a.x - o.x, a.z - o.z) < 9) { n.setEnabled(false); hidden.push(n); } } }
      // ── state: three stacks of crate indices, bottom first (0 = the biggest) ──
      const st = { stacks: [[...Array(N).keys()], [], []], held: null, moves: 0, phase: 'intro', wait: 1.2, hx: S[0][0], hz: S[0][1], hy: 4.5, tx: S[0][0], tz: S[0][1], ty: 4.5, anim: null, best: (1 << N) - 1 };
      const topY = i => .12 + st.stacks[i].length * CH;
      function layout() { st.stacks.forEach((s, i) => s.forEach((k, h) => { const c = crates[k]; if (st.held === k) return; c.mesh.position.set(S[i][0], .12 + CH / 2 + h * CH, S[i][1]); })); }
      const info = () => H.info(`Moves ${st.moves} · best ${st.best}`);
      function choose(i) {
        if (st.phase !== 'play' || st.anim || i < 0 || i > 2) return;
        if (st.held == null) {
          if (!st.stacks[i].length) { H.msg('Nothing to lift', 600); return; }
          const k = st.stacks[i][st.stacks[i].length - 1];
          st.anim = { to: i, lift: true, k }; st.from = i;
        } else {
          const s = st.stacks[i], top = s[s.length - 1];
          if (s.length && top > st.held) { H.msg('Too big for that stack', 800); ctx.sound('thock'); return; }
          st.anim = { to: i, lift: false, k: st.held };
        }
      }
      function restart() { // every crate back on the quay, the hook over it, nothing held
        if (st.phase !== 'play') return; // (in the intro nothing has moved yet)
        st.stacks = [[...Array(N).keys()], [], []]; st.held = null; st.anim = null; st.moves = 0;
        st.hx = st.tx = S[0][0]; st.hz = st.tz = S[0][1]; st.hy = st.ty = 4.5; layout(); info(); H.msg('Start again', 900);
      }
      function finish() {
        st.phase = 'done'; H.hint('');
        const score = Math.max(10, Math.round(100 * st.best / st.moves));
        if (score >= (def.pass || 0)) ctx.sound('gamewin');
        ctx.finish({ score, label: 'points', extra: `All ${N} crates aboard in ${st.moves} moves (the fewest is ${st.best}).` });
      }
      ctx.player.place(3.4, .8, -.6); // beside the crane's levers, out of the camera's way
      const cam = def.cam || [-.6, 5.6, -3.2], at = def.at || [0, 1, 4.6];
      ctx.look(cam, at, def.fov || .9);
      H.title(def.title || 'Cargo Crane'); H.score(0); info();
      H.hint('Lift the top crate of a stack, then set it on another: click the stacks or press <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd>. Never a bigger crate on a smaller one; all of them onto the ship (3).');
      H.msg(def.title || 'Cargo Crane', 1400, `${N} crates to the ship`);
      layout();
      const inst = {
        update(dt) {
          ctx.look(cam, at);
          if (st.phase === 'intro' && (st.wait -= dt) <= 0) st.phase = 'play';
          // the hook moves: over the stack, down to its top, up again; a held crate hangs under it
          const a = st.anim;
          if (a) {
            if (!a.stage) { a.stage = 'over'; st.tx = S[a.to][0]; st.tz = S[a.to][1]; st.ty = 4.5; }
            const sp = 9 * dt, d = Math.hypot(st.tx - st.hx, st.tz - st.hz, st.ty - st.hy);
            if (d > .02) { const k = Math.min(1, sp / d); st.hx += (st.tx - st.hx) * k; st.hz += (st.tz - st.hz) * k; st.hy += (st.ty - st.hy) * k; }
            else if (a.stage === 'over') { a.stage = 'down'; st.ty = a.lift ? topY(a.to) + .15 : topY(a.to) + CH + .15; }
            else if (a.stage === 'down') {
              if (a.lift) { st.stacks[a.to].pop(); st.held = a.k; ctx.sound('thock'); }
              else { st.stacks[a.to].push(a.k); st.held = null; st.moves++; info(); ctx.sound('thock'); layout(); if (st.stacks[2].length === N) { st.anim = null; st.phase = 'end'; st.wait = .9; H.msg('All aboard!', 1200); } }
              a.stage = 'up'; st.ty = 4.5;
            } else if (a.stage === 'up') st.anim = null;
          }
          hook.position.set(st.hx, st.hy, st.hz); rope.position.set(st.hx, (6.05 + st.hy) / 2, st.hz); rope.scaling.y = Math.max(.05, 6.05 - st.hy);
          if (st.held != null) crates[st.held].mesh.position.set(st.hx, st.hy - .15 - CH / 2, st.hz);
          if (st.phase === 'end' && (st.wait -= dt) <= 0) finish();
        },
        key(e, down) { if (!down || e.repeat) return; const n = parseInt(e.key, 10); if (n >= 1 && n <= 3) choose(n - 1); },
        pointer(evt) {
          if (evt.type !== B.PointerEventTypes.POINTERDOWN) return;
          const hit = scene.pickWithRay(ctx.ray(), m => !!m.metadata && (m.metadata.craneStack !== undefined || m.metadata.craneCrate !== undefined));
          if (!hit || !hit.hit) return;
          const md = hit.pickedMesh.metadata;
          if (md.craneStack !== undefined) choose(md.craneStack);
          else { const i = st.stacks.findIndex(s => s.includes(md.craneCrate)); if (i >= 0) choose(i); }
        },
        restart, // the HUD's Restart button
        _test: { st, choose, solve() { const out = []; const h = (n, a, b, c) => { if (!n) return; h(n - 1, a, c, b); out.push([a, b]); h(n - 1, c, b, a); }; h(N, 0, 2, 1); return out; } },
        dispose() { hidden.forEach(n => { if (!n.isDisposed()) n.setEnabled(true); }); }
      };
      return inst;
    }
  };
  window.RebelGames.register('crane', G);
})();
