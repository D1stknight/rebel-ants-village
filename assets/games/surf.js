// Surf the Cove (Oct 16, Chumpz): a summer drop. Paddle into a wave and ride it across the bay: ↑ / ↓ (W / S, or hold
// the mouse and move it up and down) climb and drop on the face. Low on the face is faster, high is slower; stay off
// the lip (you go over) and out of the trough (the wave leaves you behind). Ride through the gold rings (10, 20 dead
// centre), clear of the driftwood and rocks: hitting one is a wipeout and ends that wave. Four waves; a wave ridden to
// the end gives 20.
// def: { start: [x, z] (world: where each ride begins), dir (the ride's direction as a yaw, the open sea on its right;
//   crestLeft: on its left),
//   len: 150, seaY: -1.6, waves: 4, pass, points }
// The stance: game_surf (a Mixamo surf / board stance) once the Rebel's games pack has it, else the guard stance.
(function () {
  const G = {
    title: 'Surf the Cove', moves: true,
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const S0 = { x: +(def.start || [0, -95])[0], z: +(def.start || [0, -95])[1] }, DIR = def.dir ?? Math.PI / 2, LEN = def.len || 150, SEA = def.seaY ?? -1.6, WAVES = def.waves || 4;
      const FW = 5.2, HT = 2.5; // the face: 5.2 m from the line to the crest or the trough; the crest 2.5 m over the sea
      const SG = def.crestLeft ? -1 : 1, fx = Math.sin(DIR), fz = Math.cos(DIR), sx = SG * Math.cos(DIR), sz = -SG * Math.sin(DIR); // along the ride, toward the crest
      const faceY = u => SEA + HT * (1 + Math.sin(Math.max(-1, Math.min(1, u)) * Math.PI / 2)) / 2;
      const at = (s, u, up = 0) => new V3(S0.x + fx * s + sx * u * FW, faceY(u) + up, S0.z + fz * s + sz * u * FW);
      const nodes = [], keep = n => { ctx.add(n); n.parent = null; nodes.push(n); if (n.isPickable !== undefined) n.isPickable = false; return n; };
      const std = (k, c, em, o = {}) => ctx.mat('sf_' + k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(...(o.spec || [.1, .1, .1])); if (em) m.emissiveColor = new B.Color3(...em); if (o.alpha != null) m.alpha = o.alpha; if (o.vc) m.diffuseColor = new B.Color3(1, 1, 1); if (o.add) { m.disableLighting = true; m.alphaMode = B.Engine.ALPHA_ADD; m.backFaceCulling = false; } if (o.two) { m.backFaceCulling = false; m.twoSidedLighting = true; } return m; });
      // the wave: a ribbon that travels with you (in its own frame: x along the ride, z toward the crest), ends tapered
      // (turned DIR - pi/2: its +x runs along the ride and its -z to the ride's right: the crest's side times SG)
      const wave = keep(new B.TransformNode('sfWave', scene)); wave.rotation.y = DIR - Math.PI / 2;
      { const X0 = -40, X1 = 55, NX = 48, US = [-1.9, -1.4, -1, -.75, -.5, -.25, 0, .25, .5, .7, .85, .95, 1, 1.12, 1.35, 1.7, 2.3], pos = [], col = [], ind = [];
        const env = x => Math.min(1, Math.max(0, (x - X0) / 14), Math.max(0, (X1 - x) / 18));
        for (let i = 0; i <= NX; i++) { const x = X0 + (X1 - X0) * i / NX, e = env(x), k = e * e * (3 - 2 * e);
          for (const u of US) { const y = u <= 1 ? (faceY(u) - SEA) : Math.max(0, HT * (1 - (u - 1) / 1.3)) ; const lip = u > .9 && u < 1.15;
            pos.push(x, .02 + y * k, -u * FW * SG); const n = (Math.sin(x * 1.7 + u * 9) + Math.sin(x * .6 - u * 5)) * .025, c = u < -1 ? [.08, .48, .55] : lip ? [.92, .97, 1] : [.1 + .25 * (u + 1) / 2 + n, .55 + .3 * (u + 1) / 2 + n, .6 + .25 * (u + 1) / 2 + n]; col.push(c[0], c[1], c[2], 1); } }
        const W = US.length; for (let i = 0; i < NX; i++) for (let j = 0; j < W - 1; j++) { const a = i * W + j, b = a + W; ind.push(a, b, a + 1, a + 1, b, b + 1); }
        const m = new B.Mesh('sfWaveFace', scene), vd = new B.VertexData(); vd.positions = pos; vd.indices = ind; vd.colors = col; const nr = []; B.VertexData.ComputeNormals(pos, ind, nr); vd.normals = nr; vd.applyToMesh(m);
        m.material = std('wave', [1, 1, 1], [.18, .26, .28], { vc: true, spec: [.6, .6, .6], two: true }); m.useVertexColors = true; m.parent = wave; m.isPickable = false; ctx.add(m); nodes.push(m);
        // the curling lip: a white tube along the crest, a little ahead of it
        const path = []; for (let i = 0; i <= 30; i++) { const x = X0 + 6 + (X1 - X0 - 12) * i / 30, e = env(x); path.push(new V3(x, (HT + .1) * e, -FW * .93 * SG)); }
        const lip = B.MeshBuilder.CreateTube('sfLip', { path, radius: .32, tessellation: 10 }, scene); lip.material = std('lip', [1, 1, 1], [.55, .6, .62]); lip.parent = wave; lip.isPickable = false; ctx.add(lip); nodes.push(lip); }
      // the board under your feet (Oct 17, Miguel: "make the surf board look like a real surf board"): a shaped board, its
      // cross-sections lofted from a pointed nose (+z) to a squash tail with rocker, a painted deck (stringer, nose stripe,
      // tail pad), a pale bottom and a fin under the tail
      const board = keep((() => {
        const N = 26, M = 16, L = 2.3, paths = [];
        const half = t => t < .45 ? .18 + .12 * Math.sin(t / .45 * Math.PI / 2) : .3 * Math.pow(Math.cos((t - .45) / .55 * Math.PI / 2), .7); // squash tail, widest before the middle, pointed nose
        const thick = t => .022 + .04 * Math.pow(Math.sin(Math.PI * t), .7), rocker = t => .11 * Math.pow(Math.max(0, t - .7) / .3, 2.2) + .03 * Math.pow(Math.max(0, .15 - t) / .15, 2);
        for (let i = 0; i <= N; i++) { const t = i / N, w = Math.max(.012, half(t)), h = thick(t), y0 = rocker(t), z = -L / 2 + L * t, ring = [];
          for (let j = 0; j <= M; j++) { const a = j / M * Math.PI * 2; ring.push(new V3(Math.cos(a) * w, y0 + Math.sin(a) * h, z)); } paths.push(ring); }
        const m = B.MeshBuilder.CreateRibbon('sfBoard', { pathArray: paths, closePath: false, closeArray: false, sideOrientation: B.Mesh.DOUBLESIDE }, scene);
        const S = 256, tex = new B.DynamicTexture('sfBoardTex', { width: S, height: S }, scene, true), g = tex.getContext();
        // u runs round the board (0 to .5 the deck, .5 to 1 the bottom), v from the tail (0) to the nose (1)
        g.fillStyle = '#f2efe6'; g.fillRect(0, 0, S, S);
        g.fillStyle = '#f08a2c'; g.fillRect(0, 0, S / 2, S); g.fillStyle = '#1f8fa0'; g.fillRect(S * .2, 0, S * .1, S); // the deck, a teal band down it
        g.fillStyle = '#c86a20'; g.fillRect(S * .245, 0, S * .01, S);                                                    // the stringer
        g.fillStyle = '#1b1b1f'; g.fillRect(S * .08, S * .03, S * .34, S * .17);                                         // the tail pad
        g.strokeStyle = 'rgba(255,255,255,.25)'; for (let y = S * .04; y < S * .2; y += 6) { g.beginPath(); g.moveTo(S * .09, y); g.lineTo(S * .41, y); g.stroke(); }
        g.fillStyle = '#ffffff'; g.fillRect(0, S * .86, S / 2, S * .03); g.fillStyle = '#1f8fa0'; g.fillRect(0, S * .9, S / 2, S * .02); // the nose stripes
        g.fillStyle = '#d9d4c8'; g.fillRect(S / 2, 0, S * .01, S); g.fillRect(S - S * .01, 0, S * .01, S);               // the rail lines
        tex.update(); tex.wrapU = tex.wrapV = B.Texture.CLAMP_ADDRESSMODE;
        const mt = ctx.mat('board2', n => { const q = new B.StandardMaterial(n, scene); q.specularColor = new B.Color3(.7, .7, .7); q.specularPower = 64; q.emissiveColor = new B.Color3(.14, .12, .1); return q; });
        mt.diffuseTexture = tex; m.material = mt; m.isPickable = false;
        const fin = new B.Mesh('sfFin', scene), vd = new B.VertexData(); vd.positions = [0, 0, -.92, 0, -.24, -.98, 0, -.02, -.72]; vd.indices = [0, 1, 2]; vd.normals = [1, 0, 0, 1, 0, 0, 1, 0, 0]; vd.applyToMesh(fin);
        fin.material = std('fin', [.12, .12, .14], [.03, .03, .04]); fin.material.backFaceCulling = false; fin.parent = m; fin.isPickable = false; ctx.add(fin);
        return m;
      })());
      const ringM = std('ring', [1, .8, .3], [.9, .62, .18], { spec: [.8, .7, .4] }), woodM = std('drift', [.42, .3, .2], [.05, .04, .02]), rockM = std('rock', [.32, .33, .35], [.04, .04, .05]);
      const sprayM = std('spray', [0, 0, 0], [.9, .97, 1], { alpha: .55, add: true });
      const st = { phase: 'count', t: 2.6, said: '', wave: 0, s: 0, u: 0, du: 0, v: 9, score: 0, rings: 0, perfect: 0, finished: 0, wipes: 0, lip: 0, low: 0, items: [], spray: [], sprayT: 0, input: 0, ptr: null, cam: null, combo: 0 };
      const STANCE = ['game_surf', 'fight_idle'].find(c => ctx.player.has?.(c)) || null, PACK = !!STANCE;
      // a wave's rings and hazards (more hazards each wave)
      function lay(k) {
        st.items.forEach(it => it.m.dispose()); st.items = [];
        let u = 0;
        for (let s = 22; s < LEN - 10; s += 14 + Math.random() * 5) {
          u = Math.max(-.75, Math.min(.75, u + (Math.random() - .5) * 1.4));
          const m = keep(B.MeshBuilder.CreateTorus('sfRing', { diameter: 2.3, thickness: .14, tessellation: 28 }, scene)); m.material = ringM;
          const p = at(s, u, 1.2); m.position.copyFrom(p); m.rotation.set(Math.PI / 2, DIR, 0);
          st.items.push({ kind: 'ring', s, u, m, done: false });
        }
        const rings = st.items.slice();
        for (let n = 0; n < k + 1; n++) {
          const s = 30 + (n + .5) * (LEN - 50) / (k + 1) + (Math.random() - .5) * 6, nb = rings.reduce((b, r) => Math.abs(r.s - s) < Math.abs(b.s - s) ? r : b, rings[0]);
          const hu = Math.max(-.8, Math.min(.8, nb.u + (Math.random() < .5 ? -1 : 1) * (.55 + Math.random() * .3)));
          const rock = Math.random() < .5, m = rock ? B.MeshBuilder.CreateIcoSphere('sfRock', { radius: .9, subdivisions: 1 }, scene) : B.MeshBuilder.CreateCylinder('sfLog', { height: 2.6, diameter: .45, tessellation: 8 }, scene);
          keep(m); m.material = rock ? rockM : woodM; const p = at(s, hu, rock ? .1 : .15); m.position.copyFrom(p);
          if (rock) m.scaling.set(1.2, .7, 1); else m.rotation.set(Math.PI / 2, DIR + Math.PI / 2, 0);
          st.items.push({ kind: rock ? 'rock' : 'log', s, u: hu, m, done: false });
        }
      }
      function startWave() {
        st.wave++; st.s = 0; st.u = 0; st.du = 0; st.v = 9; st.lip = 0; st.low = 0; st.combo = 0;
        lay(st.wave - 1); st.phase = 'count'; st.t = 2.2; st.said = '';
        ctx.player.show(true); place(); info();
      }
      const info = () => { H.score(st.score); H.info(`Wave ${Math.min(st.wave, WAVES)} / ${WAVES} · rings ${st.rings} · wipeouts ${st.wipes}`); };
      // the Rebel stands sideways on the board, facing the beach (and the camera)
      function place() {
        const p = at(st.s, st.u), R = ctx.player.root; R.position.x = p.x; R.position.z = p.z; R.rotation.y = DIR - SG * Math.PI / 2; ctx.player.float(p.y + .09);
        board.position.set(p.x, p.y + .05, p.z); board.rotation.set(0, DIR, 0);
        const sl = Math.atan2(faceY(st.u + .05) - faceY(st.u - .05), .1 * FW);
        board.rotationQuaternion = B.Quaternion.RotationYawPitchRoll(DIR, 0, 0).multiply(B.Quaternion.RotationAxis(new V3(0, 0, 1), SG * (sl + st.du * .12))); // the crest-side edge up the face
      }
      function wipe(why) {
        if (st.phase !== 'ride') return; st.phase = 'wipe'; st.t = 1.4; st.wipes++; ctx.sound('splash'); st.combo = 0;
        H.msg('Wipeout!', 1100, why); ctx.player.show(false);
        for (let k = 0; k < 10; k++) { const p = at(st.s, st.u, .3), d = keep(B.MeshBuilder.CreateDisc('sfSplash', { radius: .5, tessellation: 12 }, scene)); d.material = sprayM; d.position.copyFrom(p); d.billboardMode = B.Mesh.BILLBOARDMODE_ALL; st.spray.push({ m: d, t: 0, life: .9, v: new V3((Math.random() - .5) * 5, 3 + Math.random() * 3, (Math.random() - .5) * 5) }); }
        info();
      }
      function endWave(done) {
        if (done) { st.finished++; st.score += 20; ctx.sound('wish'); H.msg('Rode it out!', 1000, '+20'); }
        st.phase = 'gap'; st.t = 1.4; info();
      }
      function finish() {
        st.phase = 'done'; H.hint(''); H.meter(null); ctx.player.show(true);
        ctx.finish({ score: st.score, label: 'points', passed: st.score >= (def.pass || 250),
          extra: `${st.rings} rings (${st.perfect} dead centre), ${st.finished} of ${WAVES} waves ridden out, ${st.wipes} wipeout${st.wipes === 1 ? '' : 's'}.` });
      }
      if (STANCE) ctx.player.clip(STANCE, { loop: true });
      H.title(def.title || 'Surf the Cove'); info();
      H.hint('<kbd>↑</kbd> <kbd>↓</kbd> (<kbd>W</kbd> <kbd>S</kbd>, or hold the mouse) climb and drop on the wave. Low is fast; keep off the lip. Through the rings, clear of the driftwood.');
      startWave();
      const look = (dt) => {
        const base = at(st.s - 1.5, -1, 0), cam = new V3(base.x - sx * 9.5, SEA + 4.4, base.z - sz * 9.5), tgt = at(st.s + 5, .1, .9);
        if (!st.cam || dt == null) st.cam = { p: cam, t: tgt }; else { const k = 1 - Math.exp(-6 * dt); st.cam.p = V3.Lerp(st.cam.p, cam, k); st.cam.t = V3.Lerp(st.cam.t, tgt, k); }
        const lp = ctx.toLocal(st.cam.p), lt = ctx.toLocal(st.cam.t); ctx.look([lp.x, lp.y, lp.z], [lt.x, lt.y, lt.z], def.fov || .95);
      };
      look();
      return {
        update(dt) {
          const T = performance.now() / 1000;
          // the wave and its lip travel with you; the rings turn slowly
          wave.position.set(S0.x + fx * st.s, SEA, S0.z + fz * st.s);
          for (const it of st.items) if (it.kind === 'ring' && !it.done) it.m.rotation.y = DIR + Math.sin(T * 2 + it.s) * .08;
          for (let k = st.spray.length - 1; k >= 0; k--) { const f = st.spray[k]; f.t += dt; if (f.v) { f.v.y -= 9 * dt; f.m.position.addInPlace(f.v.scale(dt)); } f.m.scaling.setAll(1 + f.t * 1.5); f.m.visibility = Math.max(0, 1 - f.t / f.life); if (f.t >= f.life) { f.m.dispose(); st.spray.splice(k, 1); } }
          if (st.phase === 'count') {
            st.t -= dt; const n = st.t > 1.5 ? `Wave ${st.wave}` : st.t > .6 ? 'Paddle…' : 'Up!';
            if (n !== st.said) { st.said = n; H.msg(n, 700); if (n === 'Up!') ctx.sound('whoosh'); }
            place(); look(dt);
            if (st.t <= 0) st.phase = 'ride';
            return;
          }
          if (st.phase === 'ride') {
            // input: the keys push you up or down the face; a held mouse sets where you want to be
            let want = st.input;
            if (st.ptr != null) { const tu = st.ptr; want = Math.max(-1, Math.min(1, (tu - st.u) * 3)); }
            st.du += (want * 1.25 - st.du) * Math.min(1, dt * 6); st.u = Math.max(-1.05, Math.min(1.05, st.u + st.du * dt));
            const vT = 9 - st.u * 2.6; st.v += (vT - st.v) * Math.min(1, dt * 2); const s0 = st.s; st.s += st.v * dt;
            // rings and hazards you pass
            for (const it of st.items) {
              if (it.done || s0 > it.s || st.s < it.s) continue; it.done = true; const d = Math.abs(st.u - it.u) * FW;
              if (it.kind === 'ring') { if (d < 1.15) { const pf = d < .4; const pts = pf ? 20 : 10; st.score += pts; st.rings++; if (pf) st.perfect++; st.combo++; it.m.setEnabled(false); ctx.note(620 + 50 * Math.min(8, st.combo), 'bell'); H.msg(pf ? 'Dead centre!' : 'Ring!', 500, '+' + pts);
                  const sp = ctx.screenOf(it.m.position); if (!sp.behind) H.pop(sp.x, sp.y, '+' + pts); } else st.combo = 0; }
              else if (d < (it.kind === 'rock' ? 1.3 : 1.15)) { wipe(it.kind === 'rock' ? 'into a rock' : 'over the driftwood'); break; }
            }
            if (st.phase !== 'ride') return;
            if (st.u > .9) { st.lip += dt; if (st.lip > .55) { wipe('over the lip'); return; } } else st.lip = 0;
            if (st.u < -.95) { st.low += dt; if (st.low > 1.1) { H.msg('The wave left you behind', 1000); endWave(false); return; } } else st.low = 0;
            if (st.s >= LEN) { endWave(true); return; }
            // spray off the board's tail
            if ((st.sprayT -= dt) <= 0) { st.sprayT = .07; const p = at(st.s - 1.1, st.u, .1), d = keep(B.MeshBuilder.CreateDisc('sfSpray', { radius: .35 + Math.abs(st.du) * .25, tessellation: 10 }, scene)); d.material = sprayM; d.position.copyFrom(p); d.billboardMode = B.Mesh.BILLBOARDMODE_ALL; st.spray.push({ m: d, t: 0, life: .7 });
              if (st.spray.length > 26) { const o = st.spray.shift(); o.m.dispose(); } }
            place(); look(dt); info();
            H.meter({ label: st.u > .7 ? 'Lip!' : 'Face', value: (st.u + 1) / 2, fill: (st.u + 1) / 2, zone: [.12, .82] });
            return;
          }
          look(dt);
          if (st.phase === 'wipe' && (st.t -= dt) <= 0) { st.phase = 'gap'; st.t = .4; }
          if (st.phase === 'gap' && (st.t -= dt) <= 0) { if (st.wave >= WAVES) finish(); else startWave(); }
        },
        key(e, down) {
          const k = e.key.toLowerCase(), up = k === 'arrowup' || k === 'w', dn = k === 'arrowdown' || k === 's';
          if (up || dn) { if (down) st.input = up ? 1 : -1; else if ((up && st.input > 0) || (dn && st.input < 0)) st.input = 0; }
        },
        pointer(evt) {
          const T = B.PointerEventTypes, h = ctx.engine.getRenderHeight() || 1;
          if (evt.type === T.POINTERDOWN || (evt.type === T.POINTERMOVE && st.ptr != null)) st.ptr = Math.max(-1, Math.min(1, 1 - 2 * (scene.pointerY / h) * 1.15 + .15));
          if (evt.type === T.POINTERUP) st.ptr = null;
        },
        _test: { st, wipe, endWave, at, place, startWave, LEN, FW, PACK, STANCE },
        dispose() { ctx.player.float(null); ctx.player.show(true); H.meter(null); st.items.forEach(it => { try { it.m.dispose(); } catch (e) {} }); st.spray.forEach(f => { try { f.m.dispose(); } catch (e) {} }); nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); }
      };
    }
  };
  window.RebelGames.register('surf', G);
})();
