// Sequence puzzles (Oct 15): bells, spirit lanterns or signal fires play a tune; play it back in the same order, one note
// longer each round (Sohei Bell Song, Yamabushi Spirit Lanterns, Bushi Signal Fires). Click an item or press its number.
// A wrong one costs a life and the tune plays again; the score is the longest tune played back.
// def: { style: 'bell' | 'lantern' | 'fire', items: [[x, z, y?], ...] in the spot's frame (local +z ahead of the Rebel),
//        notes: [Hz, ...] (one per item; defaults per style), start: 3 (first tune), max: 10, lives: 3,
//        cam: [x, y, z], at: [x, y, z] (frame coordinates), fov, pass (tune length to clear it), points,
//        hide: [kit types] (layout pieces of these types standing at the items' places are the village's dressing:
//        hidden while the game's own items stand there) }
(function () {
  const STYLE = {
    bell: { notes: [261.63, 293.66, 329.63, 392, 440, 523.25], word: 'bell', listen: 'The monks ring the tune...' },
    lantern: { notes: [659.25, 783.99, 880, 1046.5, 1174.66, 1318.5], word: 'lantern', listen: 'The lanterns hum the tune...' },
    fire: { notes: [130.81, 146.83, 164.81, 196, 220, 261.63], word: 'fire', listen: 'Watch the towers...' }
  };
  const G = {
    title: 'Sequence',
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const S = STYLE[def.style] || STYLE.bell, style = STYLE[def.style] ? def.style : 'bell';
      const pts = (def.items && def.items.length >= 3 ? def.items : [[-2.4, 5], [-.8, 5.4], [.8, 5.4], [2.4, 5]]).slice(0, 6);
      const notes = def.notes || S.notes, START = def.start || 3, MAX = def.max || 10;
      // ── the items: each with its own material, so one lights without the others ──
      const dark = (n, c) => ctx.mat(n, k => { const m = new B.StandardMaterial(k, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(.08, .08, .08); return m; });
      const wood = dark('wood', [.3, .19, .1]), stone = dark('stone', [.42, .4, .38]), iron = dark('iron', [.13, .12, .12]);
      const glowCol = { bell: [1, .78, .35], lantern: [.45, .8, 1], fire: [1, .55, .18] }[style];
      const items = pts.map((p, i) => {
        const root = new B.TransformNode('seqItem' + i, scene); ctx.add(root);
        root.position.set(p[0], p[2] || 0, p[1]);
        const m = new B.StandardMaterial('seqGlow' + i, scene); m.specularColor = new B.Color3(.3, .3, .3);
        const mesh = [];
        const add = (x) => { x.parent = root; x.isPickable = true; x.metadata = { seqItem: i }; mesh.push(x); return x; };
        let hang = null, flame = null;
        if (style === 'bell') {
          m.diffuseColor = new B.Color3(.55, .38, .16); m.specularPower = 40;
          for (const sx of [-.62, .62]) { const post = add(B.MeshBuilder.CreateBox('seqPost', { width: .12, height: 2.6, depth: .12 }, scene)); post.position.set(sx, 1.3, 0); post.material = wood; }
          const bar = add(B.MeshBuilder.CreateBox('seqBar', { width: 1.5, height: .14, depth: .14 }, scene)); bar.position.y = 2.6; bar.material = wood;
          hang = new B.TransformNode('seqHang', scene); hang.parent = root; hang.position.y = 2.53;
          const shape = [[.02, 0], [.12, -.04], [.18, -.18], [.21, -.42], [.27, -.58], [.31, -.64], [.0, -.64]].map(([x, y]) => new V3(x, y, 0));
          const bell = add(B.MeshBuilder.CreateLathe('seqBell', { shape, tessellation: 20, cap: B.Mesh.NO_CAP, sideOrientation: B.Mesh.DOUBLESIDE }, scene)); bell.parent = hang; bell.material = m;
          const clap = add(B.MeshBuilder.CreateSphere('seqClapper', { diameter: .1, segments: 6 }, scene)); clap.parent = hang; clap.position.y = -.58; clap.material = iron;
        } else if (style === 'lantern') {
          m.diffuseColor = new B.Color3(.2, .35, .45); m.alpha = .92;
          const post = add(B.MeshBuilder.CreateCylinder('seqPost', { height: 1.5, diameter: .12, tessellation: 8 }, scene)); post.position.y = .75; post.material = wood;
          const cap = add(B.MeshBuilder.CreateCylinder('seqCap', { height: .16, diameterTop: .12, diameterBottom: .62, tessellation: 12 }, scene)); cap.position.y = 2.22; cap.material = iron;
          const body = add(B.MeshBuilder.CreateCylinder('seqLamp', { height: .6, diameter: .46, tessellation: 12 }, scene)); body.position.y = 1.85; body.material = m;
          const foot = add(B.MeshBuilder.CreateCylinder('seqFoot', { height: .1, diameter: .54, tessellation: 12 }, scene)); foot.position.y = 1.52; foot.material = iron;
        } else {
          m.diffuseColor = new B.Color3(.4, .16, .05);
          const bowl = add(B.MeshBuilder.CreateCylinder('seqBowl', { height: .4, diameterTop: 1.1, diameterBottom: .6, tessellation: 14 }, scene)); bowl.position.y = 1.2; bowl.material = iron;
          const leg = add(B.MeshBuilder.CreateCylinder('seqLeg', { height: 1, diameter: .26, tessellation: 8 }, scene)); leg.position.y = .5; leg.material = stone;
          flame = add(B.MeshBuilder.CreateCylinder('seqFlame', { height: 1, diameterTop: 0, diameterBottom: .8, tessellation: 10 }, scene)); flame.position.y = 1.4 + .5; flame.material = m;
          flame.scaling.set(.45, .25, .45); flame.position.y = 1.4 + .125;
        }
        return { root, m, mesh, hang, flame, lit: 0, swing: 0, note: notes[i % notes.length] };
      });
      // the village's own pieces at the items' places step aside for the game
      const hidden = [];
      if (def.hide && def.hide.length) for (const n of scene.transformNodes) {
        if (!n.isEnabled() || !(def.hide.includes(n.metadata && n.metadata.type) || def.hide.some(t => n.name.startsWith(t + 'RootClone_')))) continue;
        const a = n.getAbsolutePosition();
        if (items.some(it => { const w = ctx.toWorld(it.root.position.x, 0, it.root.position.z); return Math.hypot(a.x - w.x, a.z - w.z) < 1.6; })) { n.setEnabled(false); hidden.push(n); }
      }
      // the numbers over the items (the keys 1..N)
      const hud = document.getElementById('gameHud'), tags = items.map((it, i) => {
        const e = document.createElement('div'); e.textContent = String(i + 1);
        e.style.cssText = 'position:absolute;transform:translate(-50%,-50%);width:26px;height:26px;border-radius:50%;border:1px solid #d8b35c;background:rgba(10,13,22,.78);color:#ffe9b0;font:700 14px/26px Georgia,serif;text-align:center;pointer-events:none';
        hud.appendChild(e); return e;
      });
      const tagY = style === 'bell' ? 3.05 : style === 'lantern' ? 2.6 : 2.3;
      // ── state ──
      const st = { phase: 'intro', wait: 1.6, seq: [], at: 0, t: 0, lives: def.lives || 3, best: 0, gap: .62, played: [] };
      const grow = () => { st.seq.push(Math.floor(Math.random() * items.length)); if (st.seq.length > 1 && st.seq[st.seq.length - 1] === st.seq[st.seq.length - 2] && Math.random() < .6) st.seq[st.seq.length - 1] = (st.seq[st.seq.length - 1] + 1 + Math.floor(Math.random() * (items.length - 1))) % items.length; };
      for (let k = 0; k < START; k++) grow();
      const info = () => H.info(`Tune ${st.seq.length} · ${'♥'.repeat(st.lives)}${'♡'.repeat(Math.max(0, (def.lives || 3) - st.lives))}`);
      function sound(it) { ctx.note ? ctx.note(it.note, style) : ctx.sound('thock'); }
      function strike(i) { const it = items[i]; it.lit = 1; it.swing = 1; sound(it); }
      function show() { st.phase = 'show'; st.at = 0; st.t = -.5; st.gap = Math.max(.34, .64 - .035 * (st.seq.length - START)); H.msg(S.listen, 900); info(); }
      function press(i) {
        if (st.phase !== 'input' || i < 0 || i >= items.length) return;
        strike(i);
        if (st.seq[st.at] !== i) {
          st.lives--; ctx.sound('thock'); info();
          if (st.lives <= 0) { st.phase = 'end'; st.wait = 1.2; H.msg('Out of tries', 1100); return; }
          H.msg(`Not that ${S.word}: listen again`, 1100); st.phase = 'pause'; st.wait = 1.3; st.next = 'show'; return;
        }
        st.at++;
        if (st.at >= st.seq.length) {
          st.best = st.seq.length; H.score(st.best);
          if (st.seq.length >= MAX) { st.phase = 'end'; st.wait = 1.2; H.msg('Every note!', 1200); return; }
          H.msg('Right!', 700); grow(); st.phase = 'pause'; st.wait = 1.1; st.next = 'show';
        }
      }
      // the Rebel stands to one side, so the camera sees every item
      const PA = def.playerAt || [2.8, 1.2]; ctx.player.place(PA[0], PA[1], Math.atan2(-PA[0], 5.2 - PA[1]));
      const cam = def.cam || [-.8, 3.8, -3.2], at = def.at || [0, 1.9, 5.2];
      ctx.look(cam, at, def.fov || .9);
      H.title(def.title || 'Sequence'); H.score(0); info();
      H.hint(`Listen, then play it back: click the ${S.word}s or press <kbd>1</kbd>-<kbd>${items.length}</kbd>`);
      H.msg(def.title || 'Sequence', 1500, `${START} notes to start`);
      const inst = {
        update(dt) {
          ctx.look(cam, at);
          if (st.phase === 'intro' && (st.wait -= dt) <= 0) show();
          else if (st.phase === 'show') {
            st.t += dt;
            if (st.t >= 0 && st.at < st.seq.length && st.t >= st.at * st.gap) { strike(st.seq[st.at]); st.at++; }
            if (st.at >= st.seq.length && st.t > st.seq.length * st.gap + .1) { st.phase = 'input'; st.at = 0; H.msg('Your turn', 700); }
          } else if (st.phase === 'pause' && (st.wait -= dt) <= 0) { if (st.next === 'show') show(); }
          else if (st.phase === 'end' && (st.wait -= dt) <= 0) {
            st.phase = 'done'; H.hint(''); tags.forEach(e => e.remove());
            if (st.best >= (def.pass || 0)) ctx.sound('gamewin');
            ctx.finish({ score: st.best, label: 'notes', extra: st.best ? `The longest tune you played back: ${st.best} notes.` : 'Not one tune this time.' });
          }
          for (let i = 0; i < items.length; i++) {
            const it = items[i];
            it.lit = Math.max(0, it.lit - dt * 2.2); it.swing = Math.max(0, it.swing - dt * 1.4);
            const k = it.lit, base = style === 'lantern' ? .18 : style === 'fire' ? .25 : 0;
            it.m.emissiveColor.copyFromFloats(glowCol[0] * (base + k), glowCol[1] * (base + k), glowCol[2] * (base + k));
            if (it.hang) it.hang.rotation.z = Math.sin(performance.now() / 120) * .22 * it.swing;
            if (it.flame) { const s = .25 + .9 * k + .05 * Math.sin(performance.now() / 90 + i); it.flame.scaling.set(.45 + .3 * k, s, .45 + .3 * k); it.flame.position.y = 1.4 + .5 * s; }
            const p = ctx.screenOf(ctx.toWorld(it.root.position.x, it.root.position.y + tagY, it.root.position.z));
            tags[i].style.display = p.behind || st.phase === 'done' ? 'none' : 'block';
            tags[i].style.left = p.x + 'px'; tags[i].style.top = p.y + 'px';
            tags[i].style.borderColor = k > .3 ? '#fff' : '#d8b35c';
          }
        },
        key(e, down) { if (!down || e.repeat) return; const n = parseInt(e.key, 10); if (n >= 1 && n <= items.length) press(n - 1); },
        pointer(evt) {
          if (evt.type !== B.PointerEventTypes.POINTERDOWN) return;
          const hit = scene.pickWithRay(ctx.ray(), m => m.isEnabled() && !!m.metadata && m.metadata.seqItem !== undefined);
          if (hit && hit.hit) press(hit.pickedMesh.metadata.seqItem);
        },
        _test: { st, press, items },
        dispose() { tags.forEach(e => e.remove()); items.forEach(it => it.m.dispose()); hidden.forEach(n => { if (!n.isDisposed()) n.setEnabled(true); }); }
      };
      return inst;
    }
  };
  window.RebelGames.register('sequence', G);
})();
