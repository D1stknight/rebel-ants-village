// Rice Planting (Oct 16, Ashigaru): a flooded paddy outside the fort. The Rebel kneels in the water at the end of a row
// and plants the seedlings one by one along the string line: the mark runs along the bar and you plant when it is in
// the gold (Space, a click or a tap). In the middle of the gold the seedling stands straight and tall (15), in the
// gold upright (10), outside it leans (4). Three rows of seven; each row the mark is quicker and the green narrower.
// With the Rebel's games pack (Forge rigs) the Rebel kneels and plants for real (game_plant); else it stands and stoops.
// def: { rows: 3, per: 7, pass, points }
(function () {
  const G = {
    title: 'Rice Planting', moves: true,
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const ROWS = def.rows || 3, PER = def.per || 7, GAP = .9, RZ = [2.6, 4.6, 6.6].slice(0, ROWS), X0 = -(PER - 1) * GAP / 2;
      const PACK = !!ctx.player.has?.('game_plant');
      const mat = (k, c, em, o = {}) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(...(o.spec || [.04, .04, .04])); if (em) m.emissiveColor = new B.Color3(...em); if (o.alpha != null) m.alpha = o.alpha; if (o.flat) m.disableLighting = true; return m; });
      const nodes = [], keep = n => { n.parent = n.parent || ctx.frame; ctx.add(n); nodes.push(n); n.isPickable = false; return n; };
      // the paddy: mud under a sheet of still water, low earth banks round it, stakes and a string line on each row
      const W = PER * GAP + 1.6, L0 = 1.4, L1 = RZ[RZ.length - 1] + 1.4, cz = (L0 + L1) / 2, D = L1 - L0;
      const mud = keep(B.MeshBuilder.CreateBox('paddyMud', { width: W, height: .1, depth: D }, scene)); mud.position.set(0, .02, cz); mud.material = mat('mud', [.27, .2, .12]);
      const water = keep(B.MeshBuilder.CreateGround('paddyWater', { width: W, height: D }, scene)); water.position.set(0, .14, cz); water.material = mat('water', [.38, .5, .48], [.05, .08, .08], { alpha: .62, spec: [.5, .5, .5] });
      const bankM = mat('bank', [.4, .32, .18]);
      [[0, L0 - .2, W + .8, .4], [0, L1 + .2, W + .8, .4], [-W / 2 - .2, cz, .4, D], [W / 2 + .2, cz, .4, D]].forEach(([x, z, w, d]) => { const b = keep(B.MeshBuilder.CreateBox('paddyBank', { width: w, height: .32, depth: d }, scene)); b.position.set(x, .16, z); b.material = bankM; });
      const stakeM = mat('stake', [.5, .38, .22]), lineM = mat('line', [.92, .9, .82], [.25, .25, .22]);
      RZ.forEach(z => {
        [-1, 1].forEach(sd => { const s = keep(B.MeshBuilder.CreateCylinder('paddyStake', { height: .9, diameter: .07, tessellation: 6 }, scene)); s.position.set(sd * (W / 2 - .3), .45, z + .35); s.material = stakeM; });
        const ln = keep(B.MeshBuilder.CreateBox('paddyLine', { width: W - .6, height: .015, depth: .015 }, scene)); ln.position.set(0, .5, z + .35); ln.material = lineM;
      });
      // seedling bundles waiting on the near bank; a ring on the water marks the next place
      const leafM = mat('leaf', [.36, .62, .2], [.04, .08, .02]), leafD = mat('leafDim', [.42, .52, .24], [.02, .03, .01]);
      const seedling = (parent, k = 1) => { const n = new B.TransformNode('riceSeedling', scene); n.parent = parent; ctx.add(n); nodes.push(n);
        for (let i = 0; i < 7; i++) { const b = B.MeshBuilder.CreateCylinder('riceBlade', { height: .72 * k, diameterTop: 0, diameterBottom: .055, tessellation: 4 }, scene); b.parent = n; b.position.y = .36 * k; b.rotation.z = (i - 3) * .13; b.rotation.y = i * .9; b.material = leafM; b.isPickable = false; ctx.add(b); }
        return n; };
      for (let i = 0; i < 4; i++) { const s = seedling(ctx.frame, .8); s.position.set(-W / 2 + .5 + i * .35, .3, L0 - .25); s.getChildren().forEach(b => b.material = leafD); }
      // the village's grass and flowers inside the paddy step aside while it is planted (thin instances, put back after)
      const unclear = (() => {
        const inv = B.Matrix.Invert(ctx.frame.getWorldMatrix()), saved = [], m0 = inv.m, mx = W / 2 + .9, z0 = L0 - .9, z1 = L1 + .9;
        for (const m of scene.meshes) {
          if (!/^terrain(Grass|Flower)/.test(m.name) || !m.thinInstanceCount) continue;
          const buf = m._thinInstanceDataStorage?.matrixData; if (!buf) continue;
          let orig = null;
          for (let i = 0; i < m.thinInstanceCount; i++) {
            const x = buf[i * 16 + 12], y = buf[i * 16 + 13], z = buf[i * 16 + 14];
            const lx = x * m0[0] + y * m0[4] + z * m0[8] + m0[12], lz = x * m0[2] + y * m0[6] + z * m0[10] + m0[14];
            if (Math.abs(lx) > mx || lz < z0 || lz > z1) continue;
            if (!orig) orig = buf.slice(); for (let k = 0; k < 12; k++) buf[i * 16 + k] = 0;
          }
          if (orig) { m.thinInstanceSetBuffer('matrix', buf, 16, true); saved.push({ m, orig }); }
        }
        return () => saved.forEach(({ m, orig }) => { try { if (!m.isDisposed()) m.thinInstanceSetBuffer('matrix', orig, 16, true); } catch (e) {} });
      })();
      const ring = keep(B.MeshBuilder.CreateTorus('paddyRing', { diameter: .5, thickness: .04, tessellation: 24 }, scene)); ring.material = mat('ring', [1, .95, .7], [.9, .8, .5], { flat: true, alpha: .8 });
      const st = { phase: 'intro', wait: 1.4, row: 0, i: 0, mark: 0, dir: 1, speed: .85, score: 0, perfect: 0, good: 0, planted: [], slide: null, cool: 0, bob: 0 };
      const spotOf = (r, i) => new V3(X0 + i * GAP, .14, RZ[r] + .35);
      const zone = () => { const w = Math.max(.11, .26 - st.row * .05 - st.i * .006); return [.5 - w / 2, .5 + w / 2]; };
      const info = () => H.info(`Row ${Math.min(st.row + 1, ROWS)} / ${ROWS} · seedling ${Math.min(st.i + 1, PER)} / ${PER}`);
      // the Rebel kneels behind the next place, facing it (local +z)
      const kneelAt = (r, i) => new V3(X0 + i * GAP + .25, 0, RZ[r] - .7);
      const placeKnee = (p) => ctx.player.place(p.x, p.z, 0);
      function plant() {
        if (st.phase !== 'play' || st.cool > 0 || st.slide) return;
        st.cool = .4;
        const z = zone(), m = st.mark, inZ = m >= z[0] && m <= z[1], perfect = Math.abs(m - .5) < (z[1] - z[0]) * .2;
        const pts = inZ ? (perfect ? 15 : 10) : 4; st.score += pts; if (perfect) st.perfect++; else if (inZ) st.good++;
        const s = seedling(ctx.frame, perfect ? 1.15 : 1), at = spotOf(st.row, st.i); s.position.copyFrom(at); s.position.y = .06;
        if (!inZ) { s.rotation.z = (Math.random() < .5 ? -1 : 1) * (.35 + Math.random() * .2); s.rotation.x = (Math.random() - .5) * .3; }
        st.planted.push(s); st.bob = 1;
        if (!PACK) ctx.player.clip('jab');
        const sp = ctx.screenOf(ctx.toWorld(at.x, .9, at.z)); H.pop(sp.x, sp.y, '+' + pts);
        H.msg(perfect ? 'Straight and tall!' : inZ ? 'Planted' : 'It leans…', 600); ctx.sound(perfect ? 'gamewin' : inZ ? 'thock' : 'splash');
        st.i++;
        if (st.i >= PER) { st.i = 0; st.row++; st.speed += .18; if (st.row >= ROWS) { st.phase = 'end'; st.wait = 1.2; ring.setEnabled(false); H.meter(null); H.score(st.score); return; } H.msg(`Row ${st.row + 1}`, 900, 'quicker now'); }
        st.slide = { from: ctx.player.pos(), to: kneelAt(st.row, st.i), t: 0 }; st.mark = 0; st.dir = 1;
        H.score(st.score); info();
      }
      placeKnee(kneelAt(0, 0));
      if (PACK) ctx.player.clip('game_plant', { loop: true });
      const cam = def.cam || [-5.2, 4.2, -2.6], at = def.at || [0, .4, RZ[Math.floor(RZ.length / 2)]];
      ctx.look(cam, at, def.fov || .85);
      H.title(def.title || 'Rice Planting'); H.score(0); info();
      H.hint('Plant when the mark is in the gold: <kbd>Space</kbd>, a click or a tap. In the middle it stands straight and tall.');
      H.msg(def.title || 'Rice Planting', 1400, `${ROWS} rows of ${PER}`);
      return {
        update(dt) {
          ctx.look(cam, at);
          if (st.cool > 0) st.cool -= dt;
          const sp = spotOf(Math.min(st.row, ROWS - 1), st.i); ring.position.set(sp.x, .16, sp.z); const pulse = 1 + Math.sin(performance.now() / 180) * .12; ring.scaling.set(pulse, 1, pulse);
          if (st.slide) { const S = st.slide; S.t += dt / .35; const u = Math.min(1, S.t), e = u * u * (3 - 2 * u); ctx.player.place(S.from.x + (S.to.x - S.from.x) * e, S.from.z + (S.to.z - S.from.z) * e, 0); if (u >= 1) st.slide = null; }
          if (st.phase === 'intro' && (st.wait -= dt) <= 0) st.phase = 'play';
          if (st.phase === 'play' && !st.slide) { st.mark += st.dir * st.speed * dt; if (st.mark > 1) { st.mark = 1; st.dir = -1; } if (st.mark < 0) { st.mark = 0; st.dir = 1; } H.meter({ label: 'Plant', value: st.mark, zone: zone() }); }
          if (st.bob > 0) { st.bob = Math.max(0, st.bob - dt * 3); const s = st.planted[st.planted.length - 1]; if (s) s.scaling.y = 1 + Math.sin(st.bob * Math.PI) * .25; }
          if (st.phase === 'end' && (st.wait -= dt) <= 0) {
            st.phase = 'done'; H.hint('');
            if (st.score >= (def.pass || 0)) ctx.sound('gamewin');
            ctx.finish({ score: st.score, label: 'points', extra: `${ROWS * PER} seedlings: ${st.perfect} straight and tall, ${st.good} upright, ${ROWS * PER - st.perfect - st.good} leaning.` });
          }
        },
        key(e, down) { if (down && !e.repeat && (e.key === ' ' || e.key === 'Enter' || e.key.toLowerCase() === 'o')) plant(); },
        pointer(evt) { if (evt.type === B.PointerEventTypes.POINTERDOWN) plant(); },
        _test: { st, plant, zone, PACK },
        dispose() { unclear(); nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); }
      };
    }
  };
  window.RebelGames.register('plant', G);
})();
