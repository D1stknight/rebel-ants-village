// The Lookout (Oct 15, Ashigaru): from the top of the south-west watchtower, a spyglass over the grassland past the
// moat. Enemy scouts creep through the grass: spot each one (click it, or bring it into the ring and press Space)
// before time runs out. A scout keeps still, then stirs now and then: watch for the movement. Look round with the
// arrows / WASD or by dragging, zoom the spyglass with Z or the mouse wheel. A wrong call costs 3 seconds.
// Levels: 5 scouts in 60 s; 7 farther out in 60 s; 8 in 50 s that stir less. A level opens when the one before is won.
// def: { eye: lookout height (m), arc: half the view to the sides (deg), levels, pass, points }
(function () {
  const LEVELS = [{ n: 5, near: 32, far: 58, sec: 60, stir: [2.5, 5] }, { n: 7, near: 38, far: 80, sec: 60, stir: [3, 6] }, { n: 8, near: 42, far: 95, sec: 50, stir: [5, 9] }];
  const SCORE = [30, 50, 75];
  const G = {
    title: 'The Lookout',
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const LV = def.levels || LEVELS, EYE = def.eye || 11, ARC = (def.arc || 55) * Math.PI / 180;
      const KEY = 'rebelAntsLookoutProgress:' + (def.id || 'lookout');
      let solvedUpTo = 0; try { solvedUpTo = Math.max(0, Math.min(LV.length, Number(localStorage.getItem(KEY)) || 0)); } catch (e) {}
      const mat = (k, c, em) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(.04, .04, .04); if (em) m.emissiveColor = new B.Color3(...em); return m; });
      const M = { cloak: mat('cloak', [.36, .33, .2], [.06, .055, .03]), head: mat('head', [.24, .2, .14], [.04, .03, .02]), band: mat('band', [.55, .12, .1], [.15, .03, .02]), mark: mat('mark', [1, .25, .2], [1, .2, .15]) };
      M.mark.disableLighting = true;
      const frameY = ctx.frame.getAbsolutePosition().y;
      const groundAt = (x, z) => { const w = ctx.toWorld(x, 0, z), h = window._newTerrain?.heightAt?.(w.x, w.z); return Number.isFinite(h) ? h - frameY : 0; };
      // a scout: a crouched ant in a grass-brown cloak, a red headband, two antennae
      function scout() {
        const root = new B.TransformNode('lkScout', scene); root.parent = ctx.frame; ctx.add(root);
        const part = (m, mt, x, y, z, s) => { m.parent = root; m.position.set(x, y, z); if (s) m.scaling.set(...s); m.material = mt; m.isPickable = false; ctx.add(m); return m; };
        part(B.MeshBuilder.CreateSphere('lkBody', { diameter: 1, segments: 8 }, scene), M.cloak, 0, .55, 0, [1.1, .9, 1.5]);
        part(B.MeshBuilder.CreateSphere('lkHead', { diameter: .62, segments: 8 }, scene), M.head, 0, 1.0, .55);
        part(B.MeshBuilder.CreateCylinder('lkBand', { height: .12, diameter: .64, tessellation: 10 }, scene), M.band, 0, 1.08, .55);
        for (const s of [-1, 1]) { const a = part(B.MeshBuilder.CreateCylinder('lkAnt', { height: .7, diameter: .04, tessellation: 4 }, scene), M.head, s * .14, 1.5, .62); a.rotation.set(-.5, 0, s * .35); }
        return root;
      }
      let lv = null; // { k, L, scouts: [{ root, home, found, stir, move }], left, found, wrong }
      const st = { phase: 'pick', yaw: 0, pitch: -.12, zoom: false, fov: .8, drag: null, keys: {}, wait: 0, pops: [] };
      function build(k) {
        if (lv) lv.scouts.forEach(s => { try { s.root.dispose(); } catch (e) {} });
        const L = LV[k]; lv = { k, L, scouts: [], left: L.sec, found: 0, wrong: 0 };
        for (let i = 0; i < L.n; i++) {
          // spread over the view: one per slice of the arc, at a random range
          let x = 0, z = 0, y = 0;
          for (let t = 0; t < 12; t++) { const a = (-ARC * .85) + (i + .2 + Math.random() * .6) / L.n * ARC * 1.7, r = L.near + Math.random() * (L.far - L.near); x = Math.sin(a) * r; z = Math.cos(a) * r; y = groundAt(x, z); if (y > -6) break; }
          const root = scout(); root.position.set(x, y, z); root.rotation.y = Math.random() * Math.PI * 2;
          lv.scouts.push({ root, home: new V3(x, y, z), found: false, stir: L.stir[0] + Math.random() * (L.stir[1] - L.stir[0]), move: null });
        }
        info();
      }
      const info = () => { if (!lv || st.phase === 'pick') { H.info('Pick a level'); H.score(''); return; } H.info(`Scouts ${lv.found} / ${lv.L.n} · ${Math.ceil(lv.left)} s`); H.score(lv.found * 10); };
      // the camera: up on the tower, turned by yaw / pitch; the spyglass narrows the view
      function aim() { const cp = Math.cos(st.pitch), d = new V3(Math.sin(st.yaw) * cp, Math.sin(st.pitch), Math.cos(st.yaw) * cp); ctx.look([0, EYE, 0], [d.x * 10, EYE + d.y * 10, d.z * 10], st.fov); }
      // the ring and the spyglass edge (only zoomed)
      const hud = document.getElementById('gameHud'), glass = document.createElement('div');
      glass.style.cssText = 'position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .25s;background:radial-gradient(circle at 50% 50%,transparent 0,transparent 38vmin,rgba(0,0,0,.88) 41vmin)';
      const ring = document.createElement('div'); ring.style.cssText = 'position:absolute;left:50%;top:50%;width:46px;height:46px;margin:-23px 0 0 -23px;border:2px solid rgba(255,216,119,.85);border-radius:50%;pointer-events:none;box-shadow:0 0 0 1px rgba(0,0,0,.4)';
      hud.appendChild(glass); hud.appendChild(ring);
      // a call: the ray through the screen point; the nearest scout within reach of it (an angle that shrinks with the zoom)
      function call(px, py) {
        if (st.phase !== 'play') return;
        const ray = ctx.ray(px, py), o = ray.origin, d = ray.direction;
        let best = null, bestA = 1e9;
        for (const s of lv.scouts) { if (s.found) continue; const p = ctx.toWorld(s.root.position.x, s.root.position.y + .8, s.root.position.z), v = p.subtract(o), dist = v.length(), a = Math.acos(Math.max(-1, Math.min(1, V3.Dot(v.normalize(), d))));
          const reach = Math.max(1.6 / dist, st.zoom ? .006 : .014); if (a < reach && a < bestA) { best = s; bestA = a; } }
        if (best) { best.found = true; lv.found++; best.pop = .7; ctx.note(660 + lv.found * 60, 'bell'); H.msg('Spotted!', 600, `${lv.found} / ${lv.L.n}`);
          const mk = B.MeshBuilder.CreateCylinder('lkMark', { height: 1.6, diameterTop: .5, diameterBottom: 0, tessellation: 6 }, scene); mk.parent = ctx.frame; ctx.add(mk); mk.material = M.mark; mk.isPickable = false; mk.position.set(best.root.position.x, best.root.position.y + 3, best.root.position.z); st.pops.push({ m: mk, t: 1.2 });
          if (lv.found >= lv.L.n) { st.phase = 'won'; st.wait = 1.6; ctx.sound('gamewin'); H.msg('Every scout spotted!', 1500, `${Math.ceil(lv.left)} s to spare`);
            if (lv.k + 1 > solvedUpTo) { solvedUpTo = lv.k + 1; try { localStorage.setItem(KEY, String(solvedUpTo)); } catch (e) {} } } }
        else { lv.wrong++; lv.left = Math.max(0, lv.left - 3); ctx.sound('thock'); H.msg('Nothing there', 600, '-3 s'); }
        info();
      }
      const center = () => { const c = ctx.engine.getRenderingCanvas(), r = c.getBoundingClientRect(); return [r.width / 2, r.height / 2]; };
      // the picker
      const pick = document.createElement('div');
      pick.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(400px,90vw);background:rgba(12,16,30,.94);border:1px solid rgba(216,179,92,.7);border-radius:14px;padding:16px;text-align:center;pointer-events:auto;font:15px/1.4 Georgia,serif;color:#eee';
      const label = L => `${L.n} scouts · ${L.sec} s`;
      pick.innerHTML = `<div style="font:700 13px/1.2 Georgia,serif;letter-spacing:.14em;text-transform:uppercase;color:#d8b35c;margin-bottom:10px">The Lookout</div><div style="margin-bottom:12px;color:#bbb">Scouts creep in the grass past the moat. Spot them all before time runs out. Watch for movement.</div>`
        + `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${LV.map((L, k) => { const open = k <= solvedUpTo, done = k < solvedUpTo; return `<button type="button" data-k="${k}" ${open ? '' : 'disabled'} style="padding:10px 4px;border-radius:9px;border:1px solid ${open ? '#d8b35c' : '#444'};background:${done ? 'rgba(216,179,92,.22)' : 'rgba(255,255,255,.04)'};color:${open ? '#fff' : '#666'};font:700 15px Georgia,serif;cursor:${open ? 'pointer' : 'default'}">${open ? 'Level ' + (k + 1) : '🔒'}${done ? ' ✓' : ''}${open ? `<div style="font:12px Georgia,serif;color:#c9b88a">${label(L)}</div>` : ''}</button>`; }).join('')}</div>`;
      pick.querySelectorAll('button[data-k]').forEach(b => b.onclick = (e) => { e.stopPropagation(); b.blur(); choose(+b.dataset.k); });
      function choose(k) { if (st.phase !== 'pick' || k > solvedUpTo || k >= LV.length) return; pick.remove(); st.phase = 'play'; build(k); H.msg(`Level ${k + 1}`, 900, label(LV[k])); }
      hud.appendChild(pick);
      ctx.player.place(0, -1.2, 0);
      H.title(def.title || 'The Lookout'); H.score(''); info();
      H.hint('Look round: arrows / <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or drag. Spyglass: <kbd>Z</kbd> or the wheel. Spot a scout: click it, or ring it and press <kbd>Space</kbd>.');
      aim();
      return {
        update(dt) {
          // turning: held keys, slower through the spyglass
          const k = st.keys, sp = (st.zoom ? .35 : .9) * dt;
          if (k.left) st.yaw -= sp; if (k.right) st.yaw += sp; if (k.up) st.pitch += sp * .7; if (k.down) st.pitch -= sp * .7;
          st.yaw = Math.max(-ARC, Math.min(ARC, st.yaw)); st.pitch = Math.max(-.5, Math.min(.05, st.pitch));
          st.fov += ((st.zoom ? .3 : .8) - st.fov) * Math.min(1, dt * 10); glass.style.opacity = st.zoom ? '1' : '0';
          aim();
          if (st.phase === 'play') {
            lv.left = Math.max(0, lv.left - dt); info();
            for (const s of lv.scouts) {
              if (s.found) { if (s.pop > 0) { s.pop -= dt; const f = Math.max(0, s.pop) / .7; s.root.position.y = s.home.y + Math.sin((1 - f) * Math.PI) * 1.2; if (s.pop <= 0) s.root.setEnabled(false); } continue; }
              // a still scout stirs now and then: a short shuffle through the grass
              if (s.move) { s.move.t += dt / .7; const f = Math.min(1, s.move.t), e = f * f * (3 - 2 * f); s.root.position.x = s.move.a.x + (s.move.b.x - s.move.a.x) * e; s.root.position.z = s.move.a.z + (s.move.b.z - s.move.a.z) * e; s.root.position.y = groundAt(s.root.position.x, s.root.position.z) + Math.sin(f * Math.PI) * .25; if (f >= 1) s.move = null; }
              else if ((s.stir -= dt) <= 0) { const L = lv.L; s.stir = L.stir[0] + Math.random() * (L.stir[1] - L.stir[0]); const a = Math.random() * Math.PI * 2, r = .6 + Math.random() * .8;
                const b = new V3(s.home.x + Math.cos(a) * r, 0, s.home.z + Math.sin(a) * r); s.move = { a: s.root.position.clone(), b, t: 0 }; s.root.rotation.y = Math.atan2(b.x - s.root.position.x, b.z - s.root.position.z); }
            }
            if (lv.left <= 0) { st.phase = 'lost'; st.wait = 1.6; ctx.sound('thock'); H.msg('Time!', 1300, `${lv.found} of ${lv.L.n} spotted`); }
          }
          for (let i = st.pops.length - 1; i >= 0; i--) { const p = st.pops[i]; p.t -= dt; p.m.rotation.y += dt * 3; if (p.t <= 0) { p.m.dispose(); st.pops.splice(i, 1); } }
          if ((st.phase === 'won' || st.phase === 'lost') && (st.wait -= dt) <= 0) {
            const won = st.phase === 'won'; st.phase = 'done'; H.hint('');
            const k2 = lv.k, score = won ? (SCORE[k2] ?? 30) + Math.ceil(lv.left) : lv.found * 4;
            ctx.finish({ score, label: 'points', passed: won && score >= (def.pass || 0), extra: won ? `Level ${k2 + 1}: every scout spotted with ${Math.ceil(lv.left)} s to spare${lv.wrong ? `, ${lv.wrong} wrong call${lv.wrong === 1 ? '' : 's'}` : ''}.${k2 + 1 < LV.length ? ` Level ${k2 + 2} is open.` : ' Every level won.'}`
              : `${lv.found} of ${lv.L.n} scouts spotted.` });
          }
        },
        key(e, down) {
          const k = e.key.toLowerCase(), map = { arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right', arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down' };
          if (map[k]) { st.keys[map[k]] = down; return; }
          if (!down || e.repeat) return;
          if (st.phase === 'pick') { const n = parseInt(k, 10); if (n >= 1 && n <= LV.length) choose(n - 1); return; }
          if (k === 'z') st.zoom = !st.zoom;
          else if (k === ' ' || k === 'enter') { const [x, y] = center(); call(x, y); }
        },
        pointer(evt) {
          const T = B.PointerEventTypes, ev = evt.event;
          if (evt.type === T.POINTERWHEEL) { st.zoom = (ev?.deltaY || 0) < 0; return; }
          if (evt.type === T.POINTERDOWN) { st.drag = { x: ev?.clientX ?? scene.pointerX, y: ev?.clientY ?? scene.pointerY, moved: 0 }; return; }
          if (evt.type === T.POINTERMOVE && st.drag) { const x = ev?.clientX ?? scene.pointerX, y = ev?.clientY ?? scene.pointerY, dx = x - st.drag.x, dy = y - st.drag.y; st.drag.moved += Math.abs(dx) + Math.abs(dy); st.drag.x = x; st.drag.y = y;
            const k = (st.zoom ? .0012 : .0035); st.yaw = Math.max(-ARC, Math.min(ARC, st.yaw - dx * k)); st.pitch = Math.max(-.5, Math.min(.05, st.pitch + dy * k)); return; }
          if (evt.type === T.POINTERUP && st.drag) { const moved = st.drag.moved; st.drag = null; if (moved < 6) call(scene.pointerX, scene.pointerY); }
        },
        _test: { st, choose, call, aimAt(s) { const p = s.root.position, d = Math.hypot(p.x, p.z); st.yaw = Math.atan2(p.x, p.z); st.pitch = Math.atan2(p.y + .8 - EYE, d); aim(); }, get lv() { return lv; } },
        dispose() { pick.remove(); glass.remove(); ring.remove(); if (lv) lv.scouts.forEach(s => { try { s.root.dispose(); } catch (e) {} }); st.pops.forEach(p => { try { p.m.dispose(); } catch (e) {} }); }
      };
    }
  };
  window.RebelGames.register('lookout', G);
})();
