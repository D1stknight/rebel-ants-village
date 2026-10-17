// Cairn Stack (Oct 15, Yamabushi): build a cairn of flat stones on the cliff top. Each stone swings in over the cairn,
// along one way then the other; drop it (Space, Enter or a click) and whatever hangs over the stone below breaks off
// and falls. The cairn grows only as wide as your drops are true: a perfect drop keeps the whole stone, and four in a
// row grow it back a little. How high can it go before a stone misses entirely?
// Oct 17 (Miguel: "i hope we can get really really high lol"): no top to it, as before, and now the height in metres, a
// cheer at 10, 20, 30, 50, 75 and 100 stones, the best cairn on this device to beat (a "new record" the moment it is
// passed), and the camera stepping back as the cairn grows so the whole tower stays in view.
// def: { at: [x, z] (the cairn's foot, frame coordinates), size: first stone (m), cam, pass, points }
(function () {
  const G = {
    title: 'Cairn Stack',
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const AT = def.at || [0, 2.5], S0 = def.size || 1.5, TH = .32, SWING = 2, PERFECT = .045;
      const nodes = [], keep = n => { n.parent = ctx.frame; ctx.add(n); nodes.push(n); return n; };
      // stone tints in turn: granite greys with a little moss and rust
      const TINTS = [[.56, .56, .54], [.44, .46, .45], [.6, .57, .5], [.4, .44, .38], [.52, .5, .47], [.62, .58, .52]];
      const mats = TINTS.map((c, i) => ctx.mat('stone' + i, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(.08, .08, .08); m.emissiveColor = new B.Color3(c[0] * .18, c[1] * .18, c[2] * .18); return m; }));
      const glow = ctx.mat('perfect', n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(.6, .85, 1); m.emissiveColor = new B.Color3(.45, .75, 1); m.disableLighting = true; m.alpha = .7; return m; });
      const slab = (w, d, k) => { const b = keep(B.MeshBuilder.CreateBox('stkStone', { width: 1, height: TH, depth: 1 }, scene)); b.scaling.set(w, 1, d); b.material = mats[k % mats.length]; b.isPickable = false; return b; };
      // the base: a broad flat rock the cairn stands on
      const base = keep(B.MeshBuilder.CreateCylinder('stkBase', { height: .4, diameterTop: S0 * 1.6, diameterBottom: S0 * 1.9, tessellation: 9 }, scene)); base.material = mats[1]; base.position.set(AT[0], .2, AT[1]); base.isPickable = false;
      const st = { phase: 'intro', wait: 1.2, n: 0, top: { x: AT[0], z: AT[1], w: S0, d: S0, y: .4 }, mov: null, t: 0, streak: 0, best: 0, falls: [], camY: 0, camK: 1, flash: null, perfects: 0 };
      // the best cairn on this device (stones), and the cheers on the way up
      const BEST_KEY = 'rebelAntsCairnBest:' + (def.id || 'stack'); let record = 0; try { record = Number(localStorage.getItem(BEST_KEY)) || 0; } catch (e) {}
      const MILESTONES = { 10: 'taller than you', 20: 'taller than the dojo door', 30: 'the mist is below you', 50: 'the eagles are watching', 75: 'a cairn for the ages', 100: 'one hundred stones!' };
      const meters = () => Math.max(0, st.top.y - .4).toFixed(1);
      function next() {
        const k = st.n + 1, axis = k % 2 ? 'x' : 'z', top = st.top, speed = 1 + Math.min(1.4, st.n * .04);
        const m = slab(top.w, top.d, k); m.position.set(top.x, top.y + TH / 2, top.z);
        st.mov = { m, axis, speed, t: Math.random() < .5 ? -Math.PI / 2 : Math.PI / 2, w: top.w, d: top.d, y: top.y + TH / 2 }; // it comes in from one end
        st.phase = 'swing';
      }
      function drop() {
        if (st.phase !== 'swing') return;
        const mv = st.mov, top = st.top, m = mv.m, ax = mv.axis;
        const pos = ax === 'x' ? m.position.x : m.position.z, under = ax === 'x' ? top.x : top.z, size = ax === 'x' ? mv.w : mv.d;
        let off = pos - under;
        if (Math.abs(off) <= PERFECT) { off = 0; if (ax === 'x') m.position.x = under; else m.position.z = under; }
        const keepW = size - Math.abs(off);
        if (keepW <= .02) { // a clean miss: the whole stone falls, the cairn is done
          st.falls.push({ m, v: new V3(ax === 'x' ? Math.sign(off) * 1.2 : 0, 0, ax === 'z' ? Math.sign(off) * 1.2 : 0), r: new V3(ax === 'z' ? Math.sign(off) * 2 : 0, 0, ax === 'x' ? -Math.sign(off) * 2 : 0), t: 0 });
          st.mov = null; st.phase = 'end'; st.wait = 2; ctx.sound('thock'); H.msg('It fell…', 1500, `${st.n} stones high`); return;
        }
        const perfect = off === 0;
        // the kept part over the stone below, the rest breaks off and falls
        const c = under + off / 2;
        if (ax === 'x') { m.scaling.x = keepW; m.position.x = c; } else { m.scaling.z = keepW; m.position.z = c; }
        if (!perfect) {
          const cutW = Math.abs(off), cc = c + Math.sign(off) * (keepW + cutW) / 2;
          const piece = slab(ax === 'x' ? cutW : mv.w, ax === 'z' ? cutW : mv.d, st.n + 1); piece.material = m.material;
          piece.position.set(ax === 'x' ? cc : m.position.x, m.position.y, ax === 'z' ? cc : m.position.z);
          st.falls.push({ m: piece, v: new V3(ax === 'x' ? Math.sign(off) * .8 : 0, 0, ax === 'z' ? Math.sign(off) * .8 : 0), r: new V3(ax === 'z' ? Math.sign(off) * 2.4 : 0, 0, ax === 'x' ? -Math.sign(off) * 2.4 : 0), t: 0 });
          st.streak = 0; ctx.sound('thock');
        } else {
          st.streak++; st.perfects++; ctx.note(523 + Math.min(10, st.streak) * 45, 'bell');
          // four true drops in a row: the stone grows back a little (up to the first stone's size)
          if (st.streak >= 4) { const g = .08; if (ax === 'x') { m.scaling.x = Math.min(S0, m.scaling.x + g); } else { m.scaling.z = Math.min(S0, m.scaling.z + g); } H.msg('Perfect!', 600, 'the stone grows'); }
          else H.msg('Perfect', 450);
          const f = keep(B.MeshBuilder.CreateBox('stkFlash', { width: 1, height: .04, depth: 1 }, scene)); f.material = glow; f.isPickable = false; f.position.set(m.position.x, m.position.y + TH / 2 + .02, m.position.z); f.scaling.set(m.scaling.x + .12, 1, m.scaling.z + .12); st.flash = { f, t: .35 };
        }
        st.top = { x: m.position.x, z: m.position.z, w: m.scaling.x, d: m.scaling.z, y: mv.y + TH / 2 };
        st.n++; st.mov = null; H.score(st.n);
        if (MILESTONES[st.n]) { H.msg(`${st.n} stones!`, 1500, MILESTONES[st.n]); [523, 659, 784].forEach((f, i) => setTimeout(() => ctx.note(f, 'bell'), i * 110)); }
        else if (record > 0 && st.n === record + 1) { H.msg('New record!', 1300, `higher than your best, ${record} stones`); ctx.note(880, 'bell'); }
        info(); next();
      }
      const info = () => H.info(`${meters()} m high · ` + (st.streak >= 2 ? `${st.streak} perfect in a row` : `${Math.round((st.top.w * st.top.d) / (S0 * S0) * 100)}% of the stone left`) + (record ? ` · best ${Math.max(record, st.n)}` : ''));
      const cam = def.cam || [AT[0] + 4.6, 3.2, AT[1] - 5.4];
      // the camera rises with the top and steps back as the cairn grows (up to twice as far), so the tower stays in view
      const look = () => { const y = Math.max(0, st.top.y - 1.4); st.camY += (y - st.camY) * .08; st.camK += (1 + Math.min(1, st.n / 60) - st.camK) * .05;
        const k = st.camK, cx = AT[0] + (cam[0] - AT[0]) * k, cz = AT[1] + (cam[2] - AT[1]) * k;
        ctx.look([cx, cam[1] * k + st.camY, cz], [AT[0], 1.1 + st.camY - (k - 1) * 1.6, AT[1]], def.fov || .8); };
      ctx.player.place(AT[0] - 2.6, AT[1] - 1.4, Math.PI / 3);
      H.title(def.title || 'Cairn Stack'); H.score(0); info();
      H.hint('Drop each stone (<kbd>Space</kbd>, <kbd>Enter</kbd> or a click) right over the one below. What hangs over breaks off.');
      H.msg('Cairn Stack', 1200, 'build it high');
      look();
      return {
        update(dt) {
          look();
          if (st.phase === 'intro' && (st.wait -= dt) <= 0) next();
          if (st.phase === 'swing' && st.mov) { const mv = st.mov; mv.t += dt * mv.speed; const s = Math.sin(mv.t) * SWING;
            if (mv.axis === 'x') mv.m.position.x = st.top.x + s; else mv.m.position.z = st.top.z + s; }
          for (let k = st.falls.length - 1; k >= 0; k--) { const f = st.falls[k]; f.t += dt; f.v.y -= 9.8 * dt; f.m.position.addInPlace(f.v.scale(dt)); f.m.rotation.addInPlace(f.r.scale(dt));
            if (f.t > 2.2) { f.m.setEnabled(false); st.falls.splice(k, 1); } }
          if (st.flash && (st.flash.t -= dt) <= 0) { st.flash.f.dispose(); st.flash = null; }
          if (st.phase === 'end' && (st.wait -= dt) <= 0) {
            st.phase = 'done'; H.hint('');
            const score = st.n * 2 + st.perfects, newRecord = st.n > record;
            if (newRecord) try { localStorage.setItem(BEST_KEY, String(st.n)); } catch (e) {}
            ctx.finish({ score, label: 'points', passed: score >= (def.pass || 0), extra: `${st.n} stones, ${meters()} m high, ${st.perfects} perfect drops.${newRecord && record ? ' A new record!' : record ? ` Your best: ${record} stones.` : ''}` });
          }
        },
        key(e, down) { if (!down || e.repeat) return; if (e.key === ' ' || e.key === 'Enter') drop(); },
        pointer(evt) { if (evt.type === B.PointerEventTypes.POINTERDOWN) drop(); },
        _test: { st, drop, PERFECT },
        dispose() { nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); }
      };
    }
  };
  window.RebelGames.register('stack', G);
})();
