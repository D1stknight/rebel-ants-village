// The cargo crane (Oct 15, Wokou quay): move the stack of crates from the quay to the ship's deck, one crate at a time,
// with the crane's hook; a bigger crate never goes on a smaller one (the Tower of Hanoi). Click a stack or press 1 / 2 / 3
// to lift its top crate, then a stack to set it down. Fewer moves score more: the best is 2^n - 1.
// def: { crates: 4, stacks: [[x, z], [x, z], [x, z]] (frame coords: start, middle, goal), pass, points,
//        hide: [kit types] (the village's own crane steps aside while the game's stands there) }
// Oct 17 (Miguel: the puzzles need a how-to, every board a Restart): howTo (the rules in a few lines) and inst.restart
// (every crate back on the quay, the hook over it, the moves from 0).
// Oct 17 (Miguel: "#104 ... Cargo crane did not load for me"; ten levels like the other boards): ten loads, 3 to 7
// crates: the full stack, loads already spread over the stacks (the fewest moves found by a search over every way the
// crates can stand), and from level 6 a fourth stack (a second spare pallet: far fewer moves, harder to see). Each
// level is cleared when every crate is aboard; the score is 100 x the fewest moves / your moves.
(function () {
  // a level: N crates on P stacks (the last one is the ship's hatch), start = the stack each crate starts on (crate 0 is
  // the biggest), or the whole stack on the quay
  const LV = [
    { n: 3, p: 3 }, { n: 4, p: 3 }, { n: 4, p: 3, start: [0, 0, 2, 1] }, { n: 5, p: 3 }, { n: 5, p: 3, start: [0, 0, 2, 1, 0] },
    { n: 5, p: 4 }, { n: 6, p: 4, start: [2, 2, 1, 3, 3, 1] }, { n: 7, p: 4 }, { n: 6, p: 3, start: [1, 2, 1, 2, 0, 0] }, { n: 6, p: 3 }];
  // the fewest moves from a start to the ship: breadth first from the goal over every assignment of crates to stacks
  // (at most 4^7 = 16384)
  function fewest(N, P, start) {
    const enc = a => a.reduce((s, v, i) => s + v * P ** i, 0), M = P ** N, dist = new Int16Array(M).fill(-1), goal = enc(Array(N).fill(P - 1));
    const q = [goal]; dist[goal] = 0; const want = enc(start);
    for (let h = 0; h < q.length && dist[want] < 0; h++) { const c = q[h], a = []; let x = c; for (let i = 0; i < N; i++) { a.push(x % P); x = Math.floor(x / P); }
      const top = Array(P).fill(-1); a.forEach((st, k) => { if (k > top[st]) top[st] = k; });
      for (let i = 0; i < P; i++) { const k = top[i]; if (k < 0) continue; for (let j = 0; j < P; j++) { if (j === i || top[j] > k) continue; const b2 = a.slice(); b2[k] = j; const e = enc(b2); if (dist[e] < 0) { dist[e] = dist[c] + 1; q.push(e); } } } }
    return dist[want];
  }
  const startOf = L => L.start || Array(L.n).fill(0);
  LV.forEach(L => { L.best = fewest(L.n, L.p, startOf(L)); });
  const G = {
    title: 'Cargo Crane',
    howTo: {
      lines: ['Move every crate onto the ship\'s hatch: the last stack, on the right.',
        'The hook carries one crate at a time: click a stack (or press its number) to lift its top crate, then click another stack to set it down.',
        'A bigger crate may never sit on a smaller one. Park crates on the pallets in between on the way.',
        'Fewer moves score more: the fewest possible is on the info line (7 moves for 3 crates, 15 for 4).',
        'Tip: the biggest crate can only move once every other crate is out of its way on a spare pallet. From level 6 there are two spare pallets: far fewer moves, if you find them.'],
      img: 'howto/crane.png', caption: 'Three crates in seven moves: the small one goes first to the ship, then every other move.'
    },
    start(ctx) {
      const B = ctx.B, H = ctx.HUD, scene = ctx.scene, def = ctx.def, CH = .42;
      const store = ctx.util.levelStore(def.id || 'crane');
      const mat = (k, c, em) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(.06, .06, .06); if (em) m.emissiveColor = new B.Color3(...em); return m; });
      const SP3 = def.stacks || [[-2.6, 4.2], [0, 5], [2.6, 4.2]], SP4 = [[-3.9, 4.2], [-1.3, 5], [1.3, 5], [3.9, 4.2]];
      const COLS = [[.62, .36, .18], [.55, .42, .22], [.66, .5, .26], [.5, .3, .15], [.6, .45, .3], [.45, .33, .2], [.58, .4, .24]];
      // the crane: a mast, a jib over every stack, the rope and the hook that carries the lifted crate
      const mast = B.MeshBuilder.CreateBox('craneMast', { width: .3, height: 6.2, depth: .3 }, scene); mast.position.set(0, 3.1, 7.4); mast.material = mat('wood', [.36, .23, .12]); mast.isPickable = false; ctx.add(mast);
      const jib = B.MeshBuilder.CreateBox('craneJib', { width: 1, height: .24, depth: .24 }, scene); jib.position.set(0, 6.1, 5.2); jib.material = mat('wood', [.36, .23, .12]); jib.isPickable = false; ctx.add(jib);
      const rope = B.MeshBuilder.CreateCylinder('craneRope', { height: 1, diameter: .04, tessellation: 5 }, scene); rope.material = mat('rope', [.6, .5, .32]); rope.isPickable = false; ctx.add(rope);
      const hook = B.MeshBuilder.CreateTorus('craneHook', { diameter: .3, thickness: .06, tessellation: 12 }, scene); hook.material = mat('iron', [.2, .2, .22]); hook.isPickable = false; ctx.add(hook);
      const hidden = [];
      if (def.hide && def.hide.length) { const o = ctx.toWorld(0, 0, 6); for (const n of scene.transformNodes) {
        if (!n.isEnabled() || !(def.hide.includes(n.metadata && n.metadata.type) || def.hide.some(t => n.name.startsWith(t + 'RootClone_')))) continue;
        const a = n.getAbsolutePosition(); if (Math.hypot(a.x - o.x, a.z - o.z) < 9) { n.setEnabled(false); hidden.push(n); } } }
      // ── state: P stacks of crate indices, bottom first (0 = the biggest) ──
      const st = { level: 0, stacks: [], held: null, moves: 0, phase: 'pick', wait: 0, hx: 0, hz: 4.5, hy: 4.5, tx: 0, tz: 4.5, ty: 4.5, anim: null, best: 0 };
      let L = LV[0], S = SP3, N = 3, P = 3, pads = [], crates = [];
      const topY = i => .12 + st.stacks[i].length * CH;
      function layout() { st.stacks.forEach((s, i) => s.forEach((k, h) => { const c = crates[k]; if (st.held === k) return; c.mesh.position.set(S[i][0], .12 + CH / 2 + h * CH, S[i][1]); })); }
      const info = () => H.info(`Level ${st.level + 1} · moves ${st.moves} · fewest ${st.best}`);
      const keys = () => Array.from({ length: P }, (_, i) => `<kbd>${i + 1}</kbd>`).join(' ');
      function build() { // the bases (quay pallets and the ship's hatch, each a pickable pad) and the crates of this level
        pads.forEach(m => m.dispose()); crates.forEach(c => c.mesh.dispose()); pads = []; crates = [];
        pads = S.map(([x, z], i) => { const p = B.MeshBuilder.CreateBox('craneBase', { width: 1.9, height: .12, depth: 1.9 }, scene); p.position.set(x, .06, z); p.material = mat(i === P - 1 ? 'hatch' : 'pallet', i === P - 1 ? [.28, .18, .1] : [.52, .38, .2]); p.metadata = { craneStack: i }; ctx.add(p); return p; });
        for (let k = 0; k < N; k++) { // widths shrink with size, each its own colour band
          const w = 1.6 - k * (1.0 / (N - 1)), b = B.MeshBuilder.CreateBox('craneCrate', { width: w, height: CH, depth: w * .9 }, scene);
          b.material = mat('crate' + k, COLS[k % COLS.length]); b.metadata = { craneCrate: k }; ctx.add(b);
          const band = B.MeshBuilder.CreateBox('craneBand', { width: w + .02, height: .06, depth: w * .9 + .02 }, scene); band.parent = b; band.material = mat('band', [.15, .12, .1]); band.isPickable = false;
          crates.push({ k, mesh: b, w });
        }
        const span = S[S.length - 1][0] - S[0][0]; jib.scaling.x = span + 1.9;
      }
      function setStart() { const a = startOf(L); st.stacks = Array.from({ length: P }, (_, i) => a.map((v, k) => v === i ? k : -1).filter(k => k >= 0));
        st.held = null; st.anim = null; st.moves = 0; const s0 = st.stacks.findIndex(x => x.length); st.hx = st.tx = S[s0][0]; st.hz = st.tz = S[s0][1]; st.hy = st.ty = 4.5; layout(); info(); }
      function choose(i) {
        if (st.phase !== 'play' || st.anim || i < 0 || i >= P) return;
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
      // ── the level picker ──
      let picker = null;
      const showPicker = () => { picker = H.levels({ title: def.title || 'Cargo Crane', sub: 'Every crate onto the ship, never a bigger one on a smaller. Ten loads; from level 6 a second spare pallet.', n: LV.length, open: store.open(LV.length), done: store.get(),
        label: k => `${LV[k].n} crates${LV[k].p > 3 ? ' · 4 stacks' : ''}${LV[k].start ? ' · spread' : ''}`, pick: begin }); };
      function begin(k) {
        if (st.phase !== 'pick') return; if (picker) { picker.remove(); picker = null; }
        L = LV[k]; N = L.n; P = L.p; S = P === 4 ? SP4 : SP3; st.level = k; st.best = L.best; build(); setStart();
        st.phase = 'intro'; st.wait = 1.2; H.score(0);
        H.hint(`Lift the top crate of a stack, then set it on another: click the stacks or press ${keys()}. Never a bigger crate on a smaller one; all of them onto the ship (${P}).`);
        H.msg(`Level ${k + 1}`, 1400, `${N} crates to the ship · fewest ${L.best} moves`);
      }
      function restart() { // the level's crates back where they started, the hook over them, the moves from 0
        if (st.phase !== 'play') return; // (in the intro nothing has moved yet)
        setStart(); H.msg('Start again', 900);
      }
      function finish() {
        st.phase = 'done'; H.hint('');
        const score = Math.max(10, Math.round(100 * st.best / st.moves)), perfect = st.moves === st.best;
        store.set(st.level + 1); ctx.sound('gamewin');
        ctx.finish({ score, label: 'points', kicker: perfect ? `Level ${st.level + 1}: the fewest moves!` : `Level ${st.level + 1} cleared`, solved: true, next: st.level + 1 < LV.length ? st.level + 1 : null,
          extra: `All ${N} crates aboard in ${st.moves} moves (the fewest is ${st.best}).` });
      }
      ctx.player.place(4.6, .6, -.6); // beside the crane's levers, out of the camera's way
      const cam = def.cam || [-.6, 6.2, -4], at = def.at || [0, 1.1, 4.6];
      ctx.look(cam, at, def.fov || .9);
      H.title(def.title || 'Cargo Crane'); H.score(0); H.info('');
      showPicker();
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
              else { st.stacks[a.to].push(a.k); st.held = null; st.moves++; info(); ctx.sound('thock'); layout(); if (st.stacks[P - 1].length === N) { st.anim = null; st.phase = 'end'; st.wait = .9; H.msg('All aboard!', 1200); } }
              a.stage = 'up'; st.ty = 4.5;
            } else if (a.stage === 'up') st.anim = null;
          }
          hook.position.set(st.hx, st.hy, st.hz); rope.position.set(st.hx, (6.05 + st.hy) / 2, st.hz); rope.scaling.y = Math.max(.05, 6.05 - st.hy);
          if (st.held != null && crates[st.held]) crates[st.held].mesh.position.set(st.hx, st.hy - .15 - CH / 2, st.hz);
          if (st.phase === 'end' && (st.wait -= dt) <= 0) finish();
        },
        key(e, down) { if (!down || e.repeat) return; if (picker && picker.key(e)) return; const n = parseInt(e.key, 10); if (n >= 1 && n <= P) choose(n - 1); },
        pointer(evt) {
          if (evt.type !== B.PointerEventTypes.POINTERDOWN) return;
          const hit = scene.pickWithRay(ctx.ray(), m => !!m.metadata && (m.metadata.craneStack !== undefined || m.metadata.craneCrate !== undefined));
          if (!hit || !hit.hit) return;
          const md = hit.pickedMesh.metadata;
          if (md.craneStack !== undefined) choose(md.craneStack);
          else { const i = st.stacks.findIndex(s => s.includes(md.craneCrate)); if (i >= 0) choose(i); }
        },
        restart, // the HUD's Restart button
        _test: { st, choose, begin, LV, fewest, get P() { return P; }, get N() { return N; },
          // the fewest moves from where the crates stand now (a search like the one for st.best, with the moves)
          solve() { const enc = a => a.reduce((s, v, i) => s + v * P ** i, 0), cur = Array(N).fill(0); st.stacks.forEach((s, i) => s.forEach(k => { cur[k] = i; }));
            const goal = enc(Array(N).fill(P - 1)), prev = new Map([[enc(cur), null]]), q = [cur];
            for (let h = 0; h < q.length; h++) { const a = q[h]; if (enc(a) === goal) break; const top = Array(P).fill(-1); a.forEach((s, k) => { if (k > top[s]) top[s] = k; });
              for (let i = 0; i < P; i++) { const k = top[i]; if (k < 0) continue; for (let j = 0; j < P; j++) { if (j === i || top[j] > k) continue; const b2 = a.slice(); b2[k] = j; const e = enc(b2); if (!prev.has(e)) { prev.set(e, [enc(a), i, j]); q.push(b2); } } } }
            const out = []; for (let e = goal; prev.get(e); e = prev.get(e)[0]) out.unshift([prev.get(e)[1], prev.get(e)[2]]); return out; } },
        dispose() { if (picker) picker.remove(); hidden.forEach(n => { if (!n.isDisposed()) n.setEnabled(true); }); }
      };
      return inst;
    }
  };
  window.RebelGames.register('crane', G);
})();
