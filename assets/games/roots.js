// Root Seal (Oct 15, Hub): the old seal in the ground holds, but roots creep at it from four sides. When a root's glowing
// tip comes into the gold ring, strike that way (arrow keys, WASD or the pads; up is away from the camera) and it
// withers back. Strike too early, too late or the wrong way and it keeps coming; a root that reaches the seal cracks it,
// and three cracks break it. Roots come faster and in pairs; the thorned gold ones take two strikes. Score: roots cut,
// more for a cut close to the seal.
// def: { seconds (75), cracks (3), pass, points }
(function () {
  const DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0]], ARROW = ['↑', '→', '↓', '←'], KEYS = { arrowup: 0, w: 0, arrowright: 1, d: 1, arrowdown: 2, s: 2, arrowleft: 3, a: 3 };
  const G = {
    title: 'Root Seal',
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const SECS = def.seconds || 75, CRACKS = def.cracks || 3, SEAL = 1.9, RING = [2.4, 5.2], START = 11.5;
      const st = { phase: 'intro', wait: 1.4, el: 0, score: 0, cut: 0, cracks: 0, combo: 0, best: 0, next: 1, roots: [], turn: 0 };
      const nodes = [], keep = n => { ctx.add(n); nodes.push(n); if (n.isPickable !== undefined) n.isPickable = false; return n; };
      const mat = (k, c, em, o = {}) => ctx.mat('rs_' + k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(.06, .06, .06); if (em) m.emissiveColor = new B.Color3(...em); if (o.alpha != null) m.alpha = o.alpha; if (o.add) { m.disableLighting = true; m.alphaMode = B.Engine.ALPHA_ADD; m.backFaceCulling = false; } return m; });
      const rootM = mat('root', [.28, .17, .1], [.05, .03, .02]), goldM = mat('rootGold', [.8, .6, .22], [.32, .22, .05]), tipM = mat('tip', [0, 0, 0], [.75, 1, .55], { alpha: .9, add: true });
      // the seal: a stone disc with its rune drawn on, a gold strike ring round it, four lane marks
      const tex = new B.DynamicTexture('rsSealTex', { width: 512, height: 512 }, scene, true), x = tex.getContext();
      const drawSeal = cracks => {
        x.clearRect(0, 0, 512, 512); x.fillStyle = '#4a4440'; x.beginPath(); x.arc(256, 256, 250, 0, 7); x.fill();
        x.strokeStyle = '#d8b35c'; x.lineWidth = 10; x.beginPath(); x.arc(256, 256, 226, 0, 7); x.stroke(); x.lineWidth = 5; x.beginPath(); x.arc(256, 256, 150, 0, 7); x.stroke();
        for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; x.beginPath(); x.moveTo(256 + Math.cos(a) * 150, 256 + Math.sin(a) * 150); x.lineTo(256 + Math.cos(a) * 226, 256 + Math.sin(a) * 226); x.stroke(); }
        x.fillStyle = '#e8c870'; x.font = 'bold 150px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('封', 256, 262);
        x.strokeStyle = '#120c08'; x.lineWidth = 7;
        for (let c = 0; c < cracks; c++) { let px = 256, py = 256; x.beginPath(); x.moveTo(px, py); const a0 = c * 2.1 + .4; for (let s = 0; s < 6; s++) { px += Math.cos(a0 + Math.sin(s * 3 + c) * .6) * 42; py += Math.sin(a0 + Math.sin(s * 3 + c) * .6) * 42; x.lineTo(px, py); } x.stroke(); }
        tex.update();
      };
      drawSeal(0);
      const sealM = new B.StandardMaterial('rsSealMat', scene); sealM.diffuseTexture = tex; sealM.emissiveColor = new B.Color3(.35, .3, .25); sealM.specularColor = new B.Color3(.05, .05, .05);
      const seal = keep(B.MeshBuilder.CreateDisc('rsSeal', { radius: SEAL, tessellation: 48 }, scene)); seal.rotation.x = Math.PI / 2; seal.position.y = .06; seal.material = sealM;
      const ring = keep(B.MeshBuilder.CreateTorus('rsRing', { diameter: RING[1] * 2, thickness: .1, tessellation: 64 }, scene)); ring.position.y = .08; ring.material = mat('ring', [0, 0, 0], [1, .8, .35], { alpha: .55, add: true });
      const ring2 = keep(B.MeshBuilder.CreateTorus('rsRing2', { diameter: RING[0] * 2, thickness: .06, tessellation: 56 }, scene)); ring2.position.y = .08; ring2.material = ring.material;
      const laneM = mat('lane', [0, 0, 0], [.5, .42, .25], { alpha: .22, add: true });
      DIRS.forEach(([dx, dz], d) => { const l = keep(B.MeshBuilder.CreatePlane('rsLane' + d, { width: 1.4, height: START - SEAL }, scene)); l.rotation.set(Math.PI / 2, Math.atan2(dx, dz), 0); l.position.set(dx * (SEAL + START) / 2, .05, dz * (SEAL + START) / 2); l.material = laneM; });
      // a root: a chain of knobbly segments from its lane's far end to the tip, the tip a green glow
      function makeRoot(d, gold) {
        const root = keep(new B.TransformNode('rsRoot', scene)), [dx, dz] = DIRS[d], segs = [];
        for (let i = 0; i < 14; i++) { const s = B.MeshBuilder.CreateCylinder('rsSeg', { height: .9, diameterTop: .32, diameterBottom: .4, tessellation: 7 }, scene); s.material = gold ? goldM : rootM; s.parent = root; s.rotation.set(Math.PI / 2, Math.atan2(dx, dz), 0); s.isPickable = false; s.setEnabled(false); segs.push(s); }
        const tip = B.MeshBuilder.CreateSphere('rsTip', { diameter: .62, segments: 8 }, scene); tip.material = tipM; tip.parent = root; tip.isPickable = false;
        if (gold) for (let i = 0; i < 4; i++) { const t = B.MeshBuilder.CreateCylinder('rsThorn', { height: .4, diameterTop: 0, diameterBottom: .14, tessellation: 5 }, scene); t.material = goldM; t.parent = tip; t.rotation.z = i * Math.PI / 2; t.position.set(Math.cos(i * Math.PI / 2) * .32, Math.sin(i * Math.PI / 2) * .32, 0); t.isPickable = false; }
        return { root, segs, tip, d, gold, hp: gold ? 2 : 1, r: START, v: 0, back: 0, wob: Math.random() * 6 };
      }
      function layRoot(R, t) {
        const [dx, dz] = DIRS[R.d], nx = -dz, nz = dx, len = START - R.r, n = Math.min(R.segs.length, Math.ceil(len / .8));
        R.segs.forEach((s, i) => { const on = i < n; s.setEnabled(on); if (!on) return; const u = R.r + (i + .5) * .8, w = Math.sin(u * 1.3 + R.wob) * .35; s.position.set(dx * u + nx * w, .25, dz * u + nz * w); });
        const w = Math.sin(R.r * 1.3 + R.wob) * .35; R.tip.position.set(dx * R.r + nx * w, .3 + .08 * Math.sin(t * 8 + R.wob), dz * R.r + nz * w);
      }
      const camP = [0, 23, -11.5], camT = [0, 0, .6];
      ctx.look(camP, camT, .82);
      ctx.player.place(0, 0, 0);
      // the pads under the view (touch)
      const hud = document.getElementById('gameHud'), pads = document.createElement('div');
      pads.style.cssText = 'position:absolute;right:18px;bottom:70px;display:grid;grid-template-columns:52px 52px 52px;grid-template-rows:44px 44px;gap:6px;pointer-events:auto';
      pads.innerHTML = [[0, 2, 1], [3, 1, 2], [1, 2, 2], [2, 2, 3]].map(([d, c, r]) => `<button type="button" data-d="${d}" style="grid-column:${c};grid-row:${r};border-radius:10px;border:1px solid #d8b35c;background:rgba(14,12,8,.85);color:#f3d27a;font:800 22px system-ui;touch-action:manipulation">${ARROW[d]}</button>`).join('');
      pads.querySelectorAll('button').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); strike(+b.dataset.d); }));
      hud.append(pads);
      H.title(def.title || 'Root Seal'); H.score(0); H.info(`Seal ${'◆'.repeat(CRACKS)} · ${SECS} s`);
      H.hint('Strike a root when its tip is inside the gold ring: <kbd>↑</kbd> <kbd>→</kbd> <kbd>↓</kbd> <kbd>←</kbd> (or WASD) · gold roots take two');
      const lvl = () => Math.min(1, st.el / SECS);
      function spawn() {
        const pair = st.el > 12 && Math.random() < .2 + .4 * lvl(), ds = [0, 1, 2, 3].filter(d => !st.roots.some(R => R.d === d && R.r > RING[1] + 2));
        if (!ds.length) return;
        const n = Math.min(ds.length, pair ? 2 : 1);
        for (let i = 0; i < n; i++) { const d = ds.splice(Math.floor(Math.random() * ds.length), 1)[0], R = makeRoot(d, st.el > 20 && Math.random() < .14 + .12 * lvl()); R.v = (2.0 + 2.3 * lvl()) * (.85 + Math.random() * .3) * (R.gold ? .8 : 1); st.roots.push(R); layRoot(R, 0); }
      }
      function hud2() { H.score(st.score); H.info(`Seal ${'◆'.repeat(CRACKS - st.cracks)}${'◇'.repeat(st.cracks)} · ${Math.max(0, Math.ceil(SECS - st.el))} s${st.combo >= 4 ? ` · combo ${st.combo}` : ''}`); }
      function strike(d) {
        if (st.phase !== 'play') return;
        // the Rebel turns that way and kicks
        st.turn = d; ctx.player.face(Math.atan2(DIRS[d][0], DIRS[d][1])); ctx.player.clip(['front_kick', 'roundhouse_kick', 'side_kick', 'crescent_kick'][Math.floor(Math.random() * 4)]);
        const R = st.roots.filter(q => q.d === d && q.back <= 0 && q.r >= RING[0] - .3 && q.r <= RING[1] + .3).sort((a, b) => a.r - b.r)[0];
        if (!R) { st.combo = 0; ctx.sound('whoosh'); H.msg('Too soon', 500); hud2(); return; }
        R.hp--;
        const close = R.r < (RING[0] + RING[1]) / 2;
        if (R.hp > 0) { R.r += 1.4; ctx.sound('clang'); H.msg('Again!', 500); return; }
        R.back = .01; st.cut++; st.combo++; st.best = Math.max(st.best, st.combo);
        const pts = (R.gold ? 3 : 1) + (close ? 1 : 0) + (st.combo >= 8 ? 1 : 0); st.score += pts;
        ctx.sound('thock');
        const sp = ctx.screenOf(ctx.toWorld(R.tip.position.x, .6, R.tip.position.z)); if (!sp.behind) H.pop(sp.x, sp.y, `+${pts}${close ? ' close!' : ''}`);
        hud2();
      }
      function end() {
        if (st.phase === 'done') return; st.phase = 'done'; pads.remove();
        const passed = st.score >= (def.pass || 0), broke = st.cracks >= CRACKS;
        H.msg(broke ? 'The seal broke' : 'The seal holds', 1500, `${st.cut} ${st.cut === 1 ? 'root' : 'roots'} cut`);
        if (passed) ctx.sound('gamewin');
        setTimeout(() => ctx.finish({ score: st.score, passed, kicker: broke ? 'Seal broken' : passed ? 'The seal holds' : 'Time', extra: `${st.cut} ${st.cut === 1 ? 'root' : 'roots'} cut, best run ${st.best}${broke ? '; three roots reached the seal' : ''}. Strike when the tip is in the ring: closer to the seal scores more.` }), 1000);
      }
      return {
        update(dt) {
          const t = performance.now() / 1000;
          ring.material.alpha = .4 + .15 * Math.sin(t * 4);
          for (let i = st.roots.length - 1; i >= 0; i--) {
            const R = st.roots[i];
            if (R.back > 0) { R.back += dt; R.r += dt * 16; R.root.getChildMeshes().forEach(m => { m.visibility = Math.max(0, 1 - R.back * 1.4); }); layRoot(R, t); if (R.back > .7) { R.root.dispose(); st.roots.splice(i, 1); } continue; }
            if (st.phase === 'play') R.r -= R.v * dt;
            if (R.r <= SEAL) { // it reaches the seal
              st.cracks++; st.combo = 0; drawSeal(st.cracks); ctx.sound('clang'); H.msg('The seal cracks!', 900); R.back = .01; hud2();
              if (st.cracks >= CRACKS) { end(); }
              continue;
            }
            layRoot(R, t);
            const inRing = R.r >= RING[0] && R.r <= RING[1]; R.tip.scaling.setAll(inRing ? 1.25 + .12 * Math.sin(t * 14) : 1);
          }
          if (st.phase === 'intro') { if ((st.wait -= dt) <= 0) { st.phase = 'play'; H.msg('Hold the seal!', 900); } return; }
          if (st.phase !== 'play') return;
          st.el += dt;
          if ((st.next -= dt) <= 0) { spawn(); st.next = (1.9 - 1.05 * lvl()) * (.75 + Math.random() * .5); }
          hud2();
          if (st.el >= SECS) end();
        },
        key(e, down) { if (!down || e.repeat) return; const d = KEYS[e.key.toLowerCase()]; if (d != null) strike(d); },
        _test: { st, strike, spawn, end, RING, SEAL },
        dispose() { pads.remove(); nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); try { sealM.dispose(); tex.dispose(); } catch (e) {} }
      };
    }
  };
  window.RebelGames.register('roots', G);
})();
