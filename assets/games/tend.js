// Keep Them Lit (Oct 15): a roam game (you run with the normal walk, R to run, and the camera follows). Lanterns round
// a part of the village burn down; run to each before it goes out (come close to refill it). The wind gusts at one
// lantern at a time and burns it faster, the burn quickens as the game goes on, and when too many are dark at once the
// night wins and the game ends. Score: how much light you kept (100 = every lantern lit the whole time).
// def: { lamps: [[x, z], ...], seconds (60), dark (lanterns dark at once that end it, 3), style: 'paper' | 'stone' |
//   'brazier', burn: [first, last] seconds a full lantern lasts (from the round of them all when not given), medals:
//   [gold, silver, bronze] scores (95 / 85 / 70),
//   color [r, g, b] (paper / glow tint), name ('lantern'), text }
(function () {
  // how long a full lantern lasts when the layout gives none: from the round of them all (the closed nearest-neighbour
  // tour at run speed), 2.4 rounds at the start down to 1.5 at the end
  function burnFor(P) {
    if (P.length < 2) return [30, 18];
    const left = P.slice(1), path = [P[0]]; let len = 0;
    while (left.length) { const a = path[path.length - 1]; let bi = 0, bd = Infinity; left.forEach((b, i) => { const d = Math.hypot(b[0] - a[0], b[1] - a[1]); if (d < bd) { bd = d; bi = i; } }); len += bd; path.push(left.splice(bi, 1)[0]); }
    const T = (len + Math.hypot(path[path.length - 1][0] - P[0][0], path[path.length - 1][1] - P[0][1])) / 8.4;
    return [Math.round(T * 2.4 + 2), Math.round(T * 1.5 + 2)];
  }
  const G = {
    title: 'Keep Them Lit', roam: true,
    start(ctx) {
      const B = ctx.B, H = ctx.HUD, scene = ctx.scene, def = ctx.def, V3 = B.Vector3;
      const N = (def.lamps || []).length, secs = def.seconds || 60, darkMax = def.dark || 3, burn = def.burn || burnFor(def.lamps || []);
      const med = def.medals || [95, 85, 70], [gold, silver, bronze] = med, style = def.style || 'paper', name = def.name || 'lantern', REACH = 2.6, GUST = 2.2;
      const tint = def.color || [1, .72, .36];
      const st = { phase: 'count', t: 3.4, el: 0, said: '', lit: 0, gust: null, gustT: 5, darkT: 0 };
      const nodes = [], keep = n => { ctx.add(n); n.parent = null; nodes.push(n); if (n.isPickable !== undefined) n.isPickable = false; return n; };
      const std = (k, c, em, o = {}) => ctx.mat('tl_' + k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(.05, .05, .05); if (em) m.emissiveColor = new B.Color3(...em); if (o.alpha != null) m.alpha = o.alpha; if (o.add) { m.disableLighting = true; m.alphaMode = B.Engine.ALPHA_ADD; m.backFaceCulling = false; } return m; });
      const wood = std('wood', [.26, .17, .1], [.04, .03, .02]), stone = std('stone', [.5, .49, .46], [.06, .06, .06]), iron = std('iron', [.14, .13, .12], [.02, .02, .02]);
      const glowAdd = std('glow' + tint.join('_'), [0, 0, 0], tint.map(v => v * .8), { alpha: .55, add: true });
      const flameM = std('flame', [0, 0, 0], [1, .58, .16], { alpha: .9, add: true });
      const paperLit = std('paperLit' + tint.join('_'), tint.map(v => v * .9), tint), paperDark = std('paperDark', [.32, .27, .22], [.03, .025, .02]);
      const barBack = std('barBack', [0, 0, 0], [.08, .08, .1], { alpha: .7 }); barBack.disableLighting = true;
      const barM = (k, c) => { const m = std('bar' + k, [0, 0, 0], c); m.disableLighting = true; return m; };
      const barGood = barM('Good', [.45, .95, .4]), barMid = barM('Mid', [1, .8, .25]), barLow = barM('Low', [1, .3, .2]);
      const cyl = (n, h, d0, d1, m, x, y, z, par, tess = 12) => { const c = B.MeshBuilder.CreateCylinder(n, { height: h, diameterTop: d0, diameterBottom: d1, tessellation: tess }, scene); c.material = m; c.position.set(x, y, z); c.parent = par; c.isPickable = false; return c; };
      const box = (n, w, h, d, m, x, y, z, par) => { const b = B.MeshBuilder.CreateBox(n, { width: w, height: h, depth: d }, scene); b.material = m; b.position.set(x, y, z); b.parent = par; b.isPickable = false; return b; };
      // ── the lanterns ──
      const lamps = (def.lamps || []).map((p, i) => {
        const x = +p[0], z = +p[1], y = ctx.ground(x, z), root = keep(new B.TransformNode('tlLamp' + i, scene)); root.position.set(x, y, z);
        const L = { x, z, y, root, f: .7 + .3 * ((i * 7919) % 97) / 97, out: false, glow: null, flames: [], shade: null, top: 2.6 };
        if (style === 'brazier') {
          for (let k = 0; k < 3; k++) { const a = k * 2.094, leg = cyl('tlLeg', 1.9, .08, .1, iron, Math.sin(a) * .42, .9, Math.cos(a) * .42, root, 6); leg.rotation.set(Math.cos(a) * .22, 0, -Math.sin(a) * .22); }
          cyl('tlBowl', .5, 1.4, .7, iron, 0, 1.95, 0, root, 16);
          for (let k = 0; k < 3; k++) { const fl = cyl('tlFlame', 1.4 - k * .3, 0, .9 - k * .2, flameM, (k - 1) * .22, 2.7 - k * .1, (k % 2) * .18 - .09, root, 10); L.flames.push(fl); }
          L.top = 3.6;
        } else if (style === 'stone') {
          cyl('tlBase', .35, 1.1, 1.25, stone, 0, .18, 0, root, 8); cyl('tlShaft', 1.3, .42, .5, stone, 0, 1, 0, root, 8); box('tlDeck', .95, .18, .95, stone, 0, 1.72, 0, root);
          L.shade = box('tlBox', .7, .62, .7, paperDark, 0, 2.12, 0, root); const roof = cyl('tlRoof', .45, .2, 1.35, stone, 0, 2.66, 0, root, 4); roof.rotation.y = Math.PI / 4; cyl('tlKnob', .22, .06, .2, stone, 0, 3, 0, root, 8);
          L.top = 3.2;
        } else { // paper lantern on a post with an arm
          cyl('tlPost', 2.9, .16, .2, wood, 0, 1.45, 0, root, 8); box('tlArm', 1.1, .12, .12, wood, .45, 2.86, 0, root);
          cyl('tlCord', .3, .03, .03, iron, .88, 2.66, 0, root, 4);
          L.shade = cyl('tlShade', .78, .58, .58, paperDark, .88, 2.1, 0, root, 14); cyl('tlCapT', .08, .34, .42, iron, .88, 2.52, 0, root, 12); cyl('tlCapB', .08, .42, .34, iron, .88, 1.68, 0, root, 12);
          L.top = 3.4;
        }
        // the light on the ground, and the fuel bar over it
        L.glow = B.MeshBuilder.CreateDisc('tlGlow', { radius: 3.2, tessellation: 28 }, scene); L.glow.material = glowAdd; L.glow.rotation.x = Math.PI / 2; L.glow.parent = root; L.glow.position.y = .08; L.glow.isPickable = false;
        const bar = new B.TransformNode('tlBar' + i, scene); bar.parent = root; bar.position.y = L.top + .9; bar.billboardMode = B.TransformNode.BILLBOARDMODE_ALL;
        const back = B.MeshBuilder.CreatePlane('tlBarBack', { width: 1.5, height: .22 }, scene); back.material = barBack; back.parent = bar; back.isPickable = false;
        L.fill = B.MeshBuilder.CreatePlane('tlBarFill', { width: 1.4, height: .14 }, scene); L.fill.material = barGood; L.fill.parent = bar; L.fill.position.z = -.01; L.fill.isPickable = false;
        L.bar = bar;
        // sized for a Rebel (3.4 m tall)
        const S = def.lampScale || 1.35; root.scaling.setAll(S); L.top *= S;
        return L;
      });
      // the wind: a swirl of streaks round the lantern it is blowing at
      const wind = keep(new B.TransformNode('tlWind', scene)), windM = std('wind', [0, 0, 0], [.75, .85, 1], { alpha: .45, add: true }), streaks = [];
      for (let k = 0; k < 6; k++) { const s = B.MeshBuilder.CreateTorus('tlStreak', { diameter: 3.2 + k * .5, thickness: .05, tessellation: 24, arc: .3 }, scene); s.material = windM; s.parent = wind; s.position.y = .9 + k * .45; s.isPickable = false; streaks.push(s); }
      wind.setEnabled(false);
      const beam = keep(B.MeshBuilder.CreateCylinder('tlBeam', { height: 9, diameterTop: .3, diameterBottom: .9, tessellation: 14, cap: B.Mesh.NO_CAP }, scene)); beam.material = std('beam', [0, 0, 0], [1, .8, .32], { alpha: .26, add: true });
      const puff = keep(B.MeshBuilder.CreateTorus('tlPuff', { diameter: 2, thickness: .1, tessellation: 32 }, scene)); puff.material = std('puff', [0, 0, 0], [1, .85, .45], { alpha: .8, add: true }); puff.setEnabled(false);
      const lastFor = () => burn[0] + (burn[1] - burn[0]) * Math.min(1, st.el / secs);
      function relight(L) {
        const was = L.out; L.f = 1; L.out = false;
        ctx.sound(was ? 'crackle' : 'flag');
        puff.setEnabled(true); puff.position.set(L.x, L.y + (style === 'brazier' ? 2.2 : 2), L.z); puff.scaling.setAll(.5); st.puff = 0;
        if (was) { const sp = ctx.screenOf(new V3(L.x, L.y + L.top + .6, L.z)); if (!sp.behind) H.pop(sp.x, sp.y, 'Relit'); }
      }
      function paint(L, t) {
        const on = !L.out, k = Math.max(0, Math.min(1, L.f));
        if (L.shade) L.shade.material = on ? paperLit : paperDark;
        L.glow.setEnabled(on); if (on) L.glow.scaling.setAll(.55 + .45 * k);
        const fl = on ? (k < .28 ? (Math.sin(t * 31 + L.x) > -.2 ? 1 : .35) : 1) : 0; // a low lantern flickers
        if (L.shade && on) L.shade.visibility = .65 + .35 * fl;
        L.flames.forEach((f, j) => { f.setEnabled(on); if (on) f.scaling.set(1, (.45 + .55 * k) * (.85 + .2 * Math.sin(t * 13 + j * 2 + L.x)) * fl, 1); });
        L.fill.scaling.x = Math.max(.001, k); L.fill.position.x = -.7 * (1 - k); L.fill.material = k > .5 ? barGood : k > .25 ? barMid : barLow;
      }
      function finish(early) {
        if (st.phase === 'done') return; st.phase = 'done'; ctx.player.hold(false); beam.setEnabled(false); wind.setEnabled(false);
        const score = Math.round(100 * st.lit / Math.max(1e-6, N * secs)), medal = score >= gold ? 'Gold' : score >= silver ? 'Silver' : score >= bronze ? 'Bronze' : null;
        const lines = `Gold ${gold} · silver ${silver} · bronze ${bronze}.`;
        H.msg(early ? 'The night won' : medal ? medal + '!' : 'Dawn', 1700, `${score} light`);
        ctx.finish({ score, passed: !!medal, label: 'light', kicker: early ? 'Too many went dark' : medal ? medal + ' medal' : 'Dawn',
          extra: (early ? `${darkMax} ${name}s were dark at once. ` : '') + (medal === 'Gold' ? 'Not one flicker wasted. ' : `Go to the ${name} with the shortest bar first, and watch for the wind. `) + lines });
      }
      ctx.player.hold(true);
      H.title(def.title || 'Keep Them Lit'); H.score('—'); H.info(`${N} ${name}s · ${secs} s`);
      H.hint(`${def.text ? def.text + ' · ' : ''}Hold <kbd>R</kbd> to run · come close to a ${name} to fill it · the wind burns one fast`);
      lamps.forEach(L => paint(L, 0));
      // the one to go to next (the beam and the minimap): the least time to spare once you get there (a dark one has
      // none), full ones left alone; kept until you reach it, so the beam does not hop about
      function urgent() {
        const p = ctx.player.world(), T = st.tgt;
        if (T && (T.out || T.f < .97) && Math.hypot(T.x - p.x, T.z - p.z) >= REACH) return T;
        let best = null, bs = Infinity;
        for (const L of lamps) { const d = Math.hypot(L.x - p.x, L.z - p.z); if (d < REACH || (!L.out && L.f > .9)) continue;
          const s = (L.out ? 0 : L.f * lastFor() / (st.gust === L ? GUST : 1)) - d / 8.4; if (s < bs) { bs = s; best = L; } }
        if (!best) { let bd = Infinity; for (const L of lamps) { const d = Math.hypot(L.x - p.x, L.z - p.z); if (d >= REACH && L.f < .97 && d < bd) { bd = d; best = L; } } }
        return (st.tgt = best);
      }
      return {
        update(dt) {
          const t = performance.now() / 1000, p = ctx.player.world();
          if (st.phase === 'count') {
            st.t -= dt;
            const n = st.t > 2.4 ? '3' : st.t > 1.4 ? '2' : st.t > .4 ? '1' : 'Go!';
            if (n !== st.said) { st.said = n; H.msg(n, n === 'Go!' ? 700 : 900); ctx.note(n === 'Go!' ? 880 : 440, 'bell'); }
            if (st.t <= .4) { st.phase = 'run'; ctx.player.hold(false); }
            lamps.forEach(L => paint(L, t));
            return;
          }
          if (st.phase !== 'run') return;
          st.el += dt;
          // the wind: every few seconds it picks a lit lantern away from you and burns it three times as fast
          st.gustT -= dt;
          if (st.gustT <= 0) {
            if (st.gust) { st.gust = null; st.gustT = 3 + Math.random() * 3; wind.setEnabled(false); }
            else { const far = lamps.filter(L => !L.out && Math.hypot(L.x - p.x, L.z - p.z) > 12); if (far.length) { st.gust = far[Math.floor(Math.random() * far.length)]; st.gustT = 3; wind.setEnabled(true); ctx.sound('whistle'); } else st.gustT = 1; }
          }
          if (st.gust) { wind.position.set(st.gust.x, st.gust.y, st.gust.z); streaks.forEach((s, k) => { s.rotation.y = t * (3 + k * .4) + k; }); windM.alpha = .3 + .15 * Math.sin(t * 9); }
          let lit = 0, dark = 0;
          for (const L of lamps) {
            if (!L.out) { L.f -= dt / lastFor() * (st.gust === L ? GUST : 1); if (L.f <= 0) { L.f = 0; L.out = true; ctx.sound('thock'); if (st.gust === L) { st.gust = null; st.gustT = 2; wind.setEnabled(false); } } }
            if (Math.hypot(L.x - p.x, L.z - p.z) < REACH && Math.abs(p.y - L.y) < 2.5 && (L.out || L.f < .97)) relight(L);
            if (L.out) dark++; else lit++;
            paint(L, t);
          }
          st.lit += lit * dt;
          if (st.puff != null) { st.puff += dt; puff.scaling.setAll(.5 + st.puff * 5); puff.material.alpha = Math.max(0, .8 - st.puff * 1.6); if (st.puff > .5) { puff.setEnabled(false); st.puff = null; } }
          const u = urgent(); if (u) { beam.setEnabled(true); beam.position.set(u.x, u.y + u.top + 5.6, u.z); beam.material.alpha = .2 + .1 * Math.sin(t * 6); } else beam.setEnabled(false);
          const left = Math.max(0, secs - st.el);
          H.score(`${lit} / ${N} lit`); H.info(`${Math.ceil(left)} s left${dark ? ` · ${dark} dark` : ''}${st.gust ? ' · the wind is up' : ''}`);
          st.darkT = dark >= darkMax ? st.darkT + dt : 0;
          if (st.darkT > 2.5) { finish(true); return; }
          if (st.el >= secs) finish(false);
        },
        target() { const u = urgent(); return u ? { x: u.x, z: u.z } : null; },
        _test: { st, lamps, relight, finish, urgent },
        dispose() { ctx.player.hold(false); nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); }
      };
    }
  };
  window.RebelGames.register('tend', G);
})();
