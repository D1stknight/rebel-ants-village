// The Potion Shelf (Oct 15, Cute & Creepy): the storm knocked the Lunar Witch's shelf over and her potions ran
// together. Pour them back until every vial holds one potion. Click a vial (or press its number), then the vial to
// pour into: the top layer, with every layer of the same potion under it, flows across while there is room, and only
// onto the same potion or into an empty vial. U undoes, H shows a good pour (no fewest-pours bonus then), R starts
// again. Seven shelves from 11 to 26 pours (the fewest found by a solver); the ones with a single empty vial are the
// hardest. Score: the shelf x 20, +10 in the fewest pours without a hint.
// Oct 17: How to play (the rules in a few lines); the HUD's Restart is R (now also mid-pour: the pour is dropped).
// def: { levels: [{ v: [[bottom..top colour ids], ...], best }], pass, points }
(function () {
  const LEVELS = [
    { best: 11, v: [[1, 0, 2, 0], [0, 2, 1, 0], [1, 2, 1, 2], [], []] },
    { best: 14, v: [[1, 0, 2, 3], [3, 1, 3, 1], [1, 2, 0, 2], [3, 0, 2, 0], [], []] },
    { best: 17, v: [[3, 1, 4, 1], [1, 4, 3, 2], [0, 1, 0, 2], [0, 4, 2, 3], [0, 3, 4, 2], [], []] },
    { best: 14, v: [[0, 3, 2, 1], [2, 3, 1, 0], [3, 0, 1, 0], [2, 3, 2, 1], []] },
    { best: 20, v: [[3, 4, 2, 5], [3, 2, 3, 2], [1, 0, 1, 5], [2, 1, 5, 0], [1, 5, 4, 0], [4, 3, 0, 4], [], []] },
    { best: 18, v: [[0, 4, 3, 1], [2, 0, 1, 2], [3, 4, 2, 4], [3, 0, 1, 3], [0, 2, 1, 4], []] },
    { best: 26, v: [[1, 4, 6, 4], [7, 1, 6, 3], [2, 1, 7, 5], [3, 5, 0, 3], [6, 6, 5, 3], [7, 5, 2, 0], [4, 7, 2, 0], [1, 0, 2, 4], [], []] }
  ];
  const CAP = 4;
  // the potions: colour, glow, and a rune drawn on each layer (so no two need telling apart by colour alone)
  const POTIONS = [
    { c: [.35, .95, .42], em: [.12, .5, .16], g: '☾' }, { c: [.62, .36, 1], em: [.3, .14, .6], g: '★' },
    { c: [1, .56, .16], em: [.58, .26, .04], g: '▲' }, { c: [1, .42, .74], em: [.58, .16, .38], g: '♥' },
    { c: [.3, .6, 1], em: [.1, .28, .62], g: '●' }, { c: [1, .93, .32], em: [.58, .5, .1], g: '✦' },
    { c: [.92, .18, .18], em: [.5, .05, .05], g: '✚' }, { c: [.28, .95, .86], em: [.08, .48, .44], g: '◆' }
  ];
  // one pour on a state (vials bottom..top): the new state, or null when it is not a pour
  function pour(v, a, b) {
    if (a === b || !v[a].length || v[b].length >= CAP) return null; const top = v[a][v[a].length - 1]; if (v[b].length && v[b][v[b].length - 1] !== top) return null;
    let run = 0; for (let i = v[a].length - 1; i >= 0 && v[a][i] === top; i--) run++;
    if (!v[b].length && run === v[a].length) return null; // a vial of one potion poured whole into an empty one changes nothing
    const n = Math.min(run, CAP - v[b].length), w = v.map(x => x.slice()); for (let i = 0; i < n; i++) w[b].push(w[a].pop()); return { w, n, top };
  }
  const sorted = v => v.every(x => !x.length || (x.length === CAP && x.every(c => c === x[0])));
  const full = x => x.length === CAP && x.every(c => c === x[0]);
  const keyOf = v => v.map(x => x.join('')).sort().join('|');
  // the first pour of a shortest way to sort it from here (breadth-first), or null (none / too far)
  function hintFrom(v, cap = 90000) {
    if (sorted(v)) return null; const seen = new Set([keyOf(v)]); let fr = [{ v, first: null }];
    while (fr.length && seen.size < cap) { const nx = [];
      for (const s of fr) for (let a = 0; a < s.v.length; a++) for (let b = 0; b < s.v.length; b++) { const r = pour(s.v, a, b); if (!r) continue; const k = keyOf(r.w); if (seen.has(k)) continue; seen.add(k);
        const first = s.first || [a, b]; if (sorted(r.w)) return first; nx.push({ v: r.w, first }); }
      fr = nx; }
    return fr.length ? 'far' : null;
  }
  const anyPour = v => { for (let a = 0; a < v.length; a++) for (let b = 0; b < v.length; b++) if (pour(v, a, b)) return true; return false; };
  const G = {
    title: 'The Potion Shelf',
    howTo: { lines: [
      'Pour the potions until every vial holds only one kind: a vial full of one potion gets its cork. Each potion has its own colour and rune.',
      'Click a vial (or press its number), then the vial to pour into. The top potion pours across, with every layer of the same potion under it, while there is room.',
      'You may pour only onto the same potion or into an empty vial, and a vial holds four layers.',
      'U undoes, R starts the shelf again, H shows a good pour (no fewest-pours bonus then).',
      'Tip: keep an empty vial free as long as you can: it is the way out when you are stuck.'] },
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, H = ctx.HUD, scene = ctx.scene, def = ctx.def, engine = ctx.engine || scene.getEngine();
      const LV = def.levels || LEVELS, KEY = 'rebelAntsPotionProgress:' + (def.id || 'potion');
      let solvedUpTo = 0; try { solvedUpTo = Math.max(0, Math.min(LV.length, Number(localStorage.getItem(KEY)) || 0)); } catch (e) {}
      const TY = 1.55, VH = 1.0, VD = .4, LD = .32, LH = .2, L0 = -VH / 2 + .07, SP = .84, RISE = .44, ROWZ = [-.12, .5];
      const mat = (k, c, em, o = {}) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(...(o.spec || [.08, .08, .08])); if (o.power) m.specularPower = o.power; if (em) m.emissiveColor = new B.Color3(...em); if (o.flat) m.disableLighting = true; if (o.alpha != null) m.alpha = o.alpha; return m; });
      const woodM = mat('wood', [.26, .17, .12], [.05, .03, .02]), clothM = mat('cloth', [.3, .12, .38], [.08, .03, .1]), glassM = mat('glass', [.72, .84, .95], [.08, .1, .14], { alpha: .26, spec: [1, 1, 1], power: 90 });
      const rimM = mat('rim', [.55, .5, .62], [.12, .1, .16]), corkM = mat('cork', [.62, .44, .26], [.14, .1, .05]), haloM = mat('halo', [1, .85, .4], [1, .75, .3], { flat: true, alpha: .8 });
      const waxM = mat('wax', [.92, .88, .78], [.3, .28, .22]), flameM = mat('flame', [1, .7, .3], [1, .62, .22], { flat: true });
      const nodes = [], keep = n => { n.parent = n.parent || ctx.frame; ctx.add(n); nodes.push(n); if (n.isPickable !== undefined) n.isPickable = false; return n; };
      // potion layer sources (one per potion, instanced into the vials) with their runes in front
      const runeMat = P => ctx.mat('rune_' + P.g.codePointAt(0), n => { const t = new B.DynamicTexture(n + 'T', { width: 128, height: 128 }, scene, true); const g = t.getContext(); g.clearRect(0, 0, 128, 128);
        g.font = 'bold 92px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(28,10,36,.78)'; g.fillText(P.g, 64, 70); t.hasAlpha = true; t.update();
        const m = new B.StandardMaterial(n, scene); m.diffuseTexture = t; m.useAlphaFromDiffuseTexture = true; m.disableLighting = true; m.emissiveColor = new B.Color3(.08, .04, .1); m.backFaceCulling = true; return m; });
      const src = POTIONS.map((P, k) => { const m = keep(B.MeshBuilder.CreateCylinder('potionLayer', { height: LH, diameter: LD, tessellation: 18 }, scene)); m.material = mat('potion' + k, P.c, P.em, { spec: [.5, .5, .5], power: 40 }); m.isVisible = false;
        const r = keep(B.MeshBuilder.CreatePlane('potionRune', { size: LH * .82 }, scene)); r.material = runeMat(P); r.isVisible = false; return { m, r }; });
      const glassSrc = keep(B.MeshBuilder.CreateCylinder('potionGlass', { height: VH, diameter: VD, tessellation: 20 }, scene)); glassSrc.material = glassM; glassSrc.isVisible = false;
      const rimSrc = keep(B.MeshBuilder.CreateTorus('potionRim', { diameter: VD * .92, thickness: .05, tessellation: 20 }, scene)); rimSrc.material = rimM; rimSrc.isVisible = false;
      const corkSrc = keep(B.MeshBuilder.CreateCylinder('potionCork', { height: .14, diameterTop: VD * .62, diameterBottom: VD * .72, tessellation: 12 }, scene)); corkSrc.material = corkM; corkSrc.isVisible = false;
      const halo = keep(B.MeshBuilder.CreateTorus('potionHalo', { diameter: VD * 1.5, thickness: .06, tessellation: 24 }, scene)); halo.material = haloM; halo.setEnabled(false);
      const stream = keep(B.MeshBuilder.CreateCylinder('potionStream', { height: 1, diameter: .07, tessellation: 8 }, scene)); stream.setEnabled(false);
      // the table: a dark top on four legs, a cloth runner, the riser for the back row, two candles
      const table = { top: null, riser: null, legs: [], candles: [] };
      const buildTable = (w) => {
        [table.top, table.cloth, table.riser, ...table.legs, ...table.candles.flatMap(c => [c.w, c.f])].forEach(n => { if (n) n.dispose(); }); table.legs = []; table.candles = [];
        table.top = keep(B.MeshBuilder.CreateBox('potionTable', { width: w, height: .09, depth: 1.5 }, scene)); table.top.material = woodM; table.top.position.set(0, TY - .045, .2);
        table.cloth = keep(B.MeshBuilder.CreateBox('potionCloth', { width: w * .5, height: .012, depth: 1.52 }, scene)); table.cloth.material = clothM; table.cloth.position.set(0, TY + .006, .2);
        table.riser = keep(B.MeshBuilder.CreateBox('potionRiser', { width: w - .3, height: RISE, depth: .62 }, scene)); table.riser.material = woodM; table.riser.position.set(0, TY + RISE / 2, ROWZ[1]);
        for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const l = keep(B.MeshBuilder.CreateBox('potionLeg', { width: .12, height: TY - .09, depth: .12 }, scene)); l.material = woodM; l.position.set(x * (w / 2 - .14), (TY - .09) / 2, .2 + z * .6); table.legs.push(l); }
        for (const s of [-1, 1]) { const c = keep(B.MeshBuilder.CreateCylinder('potionCandle', { height: .34, diameter: .1, tessellation: 10 }, scene)); c.material = waxM; c.position.set(s * (w / 2 - .22), TY + .17, -.32);
          const f = keep(B.MeshBuilder.CreateSphere('potionFlame', { diameterX: .07, diameterY: .14, diameterZ: .07, segments: 6 }, scene)); f.material = flameM; f.position.set(c.position.x, TY + .41, -.32); table.candles.push({ w: c, f, ph: Math.random() * 6 }); }
      };
      let board = null; // { k, v, vials: [{ node, home, glass, rim, cork, slots[4] }], sel, moves, hist[], hints }
      const st = { phase: 'pick', anim: null, t: 0, cam: [0, TY + 1.1, -4], at: [0, TY + .45, .2], shake: null };
      function layout(n) {
        const aspect = engine.getRenderWidth() / Math.max(1, engine.getRenderHeight()), rows = n > 6 || (aspect < 1.1 && n > 3) ? 2 : 1, per = Math.ceil(n / rows);
        // two rows: the back one (vials 1..per) on the riser; rows of the same length sit staggered so every vial shows
        const shift = rows === 2 && per === n - per ? SP / 4 : 0, out = [];
        for (let i = 0; i < n; i++) { const r = rows === 2 ? (i < per ? 1 : 0) : 0, j = rows === 2 ? (i < per ? i : i - per) : i, cnt = rows === 2 ? (r === 1 ? per : n - per) : n;
          out.push(new V3((j - (cnt - 1) / 2) * SP + (r === 1 ? shift : -shift), TY + (r === 1 && rows === 2 ? RISE : 0) + VH / 2, rows === 2 ? ROWZ[r === 1 ? 1 : 0] : ROWZ[0] + .1)); }
        const halfW = (per - 1) / 2 * SP + SP / 4 + .75, tanH = Math.tan((def.fov || .8) / 2), d = Math.max(halfW / (tanH * aspect), (rows === 2 ? 1.05 : .8) / tanH) + .35;
        st.cam = [0, TY + .55 + d * .32, ROWZ[0] - d]; st.at = [0, TY + (rows === 2 ? .62 : .45), .15];
        return { pos: out, width: Math.max(2.6, per * SP + .9) };
      }
      function setSlot(vi, j, colour) {
        const s = board.vials[vi].slots[j];
        if (s.c === colour) { if (s.m) { s.m.scaling.y = 1; s.m.position.y = L0 + LH * (j + .5); } return; }
        if (s.m) { s.m.dispose(); s.m = null; } s.c = colour; if (colour == null) return;
        const m = src[colour].m.createInstance('potionL'); m.parent = board.vials[vi].node; m.position.set(0, L0 + LH * (j + .5), 0); m.isPickable = false; ctx.add(m);
        const r = src[colour].r.createInstance('potionR'); r.parent = m; r.position.set(0, 0, -LD / 2 - .012); r.isPickable = false; ctx.add(r); s.m = m;
      }
      function paint(vi) { const x = board.v[vi], V = board.vials[vi]; for (let j = 0; j < CAP; j++) setSlot(vi, j, j < x.length ? x[j] : null); V.cork.setEnabled(full(x)); }
      function build(k) {
        if (board) board.vials.forEach(V => { V.slots.forEach(s => { if (s.m) s.m.dispose(); }); [V.glass, V.rim, V.cork, V.node].forEach(n => { try { n.dispose(); } catch (e) {} }); });
        const v = LV[k].v.map(x => x.slice()), L = layout(v.length); buildTable(L.width);
        board = { k, v, vials: [], sel: -1, moves: 0, hist: [], hints: 0, start: v.map(x => x.slice()) };
        L.pos.forEach((p, i) => { const node = keep(new B.TransformNode('potionVial', scene)); node.position.copyFrom(p);
          const glass = glassSrc.createInstance('potionG'); glass.parent = node; glass.isPickable = true; glass.metadata = { potionVial: i }; ctx.add(glass);
          const rim = rimSrc.createInstance('potionRimI'); rim.parent = node; rim.position.y = VH / 2; ctx.add(rim);
          const cork = corkSrc.createInstance('potionCorkI'); cork.parent = node; cork.position.y = VH / 2 + .02; ctx.add(cork);
          board.vials.push({ node, home: p.clone(), glass, rim, cork, slots: [0, 1, 2, 3].map(() => ({ c: null, m: null })) }); paint(i); });
        ctx.player.place(0, 1.55, Math.PI); select(-1); info();
      }
      const info = () => H.info(board ? `Shelf ${board.k + 1} / ${LV.length} · pours ${board.moves} · fewest ${LV[board.k].best}${board.hints ? ` · hints ${board.hints}` : ''}` : 'Pick a shelf');
      function select(i) { if (!board) return; board.sel = i; halo.setEnabled(i >= 0); }
      function tryPour(a, b, fromHint) {
        if (st.phase !== 'play' || st.anim || !board) return false; const r = pour(board.v, a, b);
        if (!r) { st.shake = { i: b, t: 0 }; ctx.sound('thock'); const why = !board.v[a].length ? 'That vial is empty' : board.v[b].length >= CAP ? 'That vial is full' : 'Only onto the same potion or an empty vial'; H.msg(why, 900); return false; }
        board.hist.push({ v: board.v.map(x => x.slice()), moves: board.moves }); board.moves++;
        const A = board.vials[a], Bv = board.vials[b], dir = Bv.home.x > A.home.x + .01 ? 1 : Bv.home.x < A.home.x - .01 ? -1 : 1, tilt = 1.92;
        const at = new V3(Bv.home.x - dir * (VH / 2) * Math.sin(tilt), Bv.home.y + VH / 2 + .14 - (VH / 2) * Math.cos(tilt), Bv.home.z);
        st.anim = { a, b, n: r.n, top: r.top, w: r.w, from: A.home.clone(), at, rot: -dir * tilt, t: 0, lenA: board.v[a].length, lenB: board.v[b].length, painted: false };
        select(-1); ctx.note(520 + r.top * 40, 'bell'); info(); return true;
      }
      function choose(k) { if (st.phase !== 'pick' || k > solvedUpTo || k >= LV.length) return; pick.remove(); st.phase = 'play'; build(k); pads.style.display = 'flex'; H.msg(`Shelf ${k + 1}`, 900, LV[k].v.filter(x => !x.length).length === 1 ? 'one empty vial: a hard one' : k >= 4 ? 'a hard one' : ''); }
      function clickVial(i) {
        if (st.phase !== 'play' || st.anim || !board || i < 0 || i >= board.v.length) return;
        if (board.sel < 0) { if (!board.v[i].length) { H.msg('That vial is empty', 700); return; } if (full(board.v[i])) { H.msg('That potion is done', 700); return; } select(i); ctx.note(660, 'lantern'); return; }
        if (board.sel === i) { select(-1); return; }
        tryPour(board.sel, i);
      }
      function undo() { if (st.phase !== 'play' || st.anim || !board?.hist.length) return; const h = board.hist.pop(); board.v = h.v; board.moves = h.moves; board.vials.forEach((V, i) => { V.node.position.copyFrom(V.home); V.node.rotation.z = 0; paint(i); }); select(-1); info(); }
      function restart() { if (st.phase !== 'play' || !board) return; if (st.anim) { st.anim = null; stream.setEnabled(false); } st.hintTo = null; st.shake = null; const k = board.k; build(k); H.msg('Again', 600); } // a pour in the air is dropped
      function hint() {
        if (st.phase !== 'play' || st.anim || !board) return; const h = hintFrom(board.v);
        if (h === 'far') { H.msg('Too tangled to see from here', 1500, 'undo a few pours'); return; }
        if (!h) { H.msg('This shelf cannot be sorted from here', 1800, 'U undoes, R starts again'); return; }
        board.hints++; select(h[0]); st.hintTo = { i: h[1], t: 0 }; H.msg(`Pour ${h[0] + 1} into ${h[1] + 1}`, 1300); info();
      }
      const hud = document.getElementById('gameHud');
      const pick = document.createElement('div');
      pick.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(390px,90vw);background:rgba(16,8,22,.94);border:1px solid rgba(150,240,160,.55);border-radius:14px;padding:16px;text-align:center;pointer-events:auto;font:15px/1.4 system-ui,sans-serif;color:#eee';
      const drawPick = () => { pick.innerHTML = `<div style="font:800 13px/1.2 system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#9cf0a8;margin-bottom:10px">The Potion Shelf</div><div style="margin-bottom:12px;color:#bbb">Pour the potions until every vial holds just one.</div>`
        + `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">${LV.map((L, k) => { const open = k <= solvedUpTo, ok = k < solvedUpTo; return `<button type="button" data-k="${k}" ${open ? '' : 'disabled'} style="padding:8px 2px;border-radius:9px;border:1px solid ${open ? '#9cf0a8' : '#444'};background:${ok ? 'rgba(156,240,168,.22)' : 'rgba(255,255,255,.04)'};color:${open ? '#fff' : '#666'};font:700 15px system-ui,sans-serif;cursor:${open ? 'pointer' : 'default'}">${open ? `${k + 1}<div style="font:11px system-ui;opacity:.75">${L.best} pours</div>` : '🔒'}${ok ? ' ✓' : ''}</button>`; }).join('')}</div>`;
        pick.querySelectorAll('button[data-k]').forEach(b => b.onclick = (e) => { e.stopPropagation(); b.blur(); choose(+b.dataset.k); }); };
      const pads = document.createElement('div');
      pads.style.cssText = 'position:absolute;bottom:62px;right:16px;display:none;gap:6px;pointer-events:auto';
      const pad = (t, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.style.cssText = 'min-width:52px;height:40px;padding:0 10px;border-radius:9px;border:1px solid #7fd08c;background:rgba(14,22,16,.85);color:#e8ffe9;font:700 15px system-ui;cursor:pointer'; b.onclick = (e) => { e.stopPropagation(); b.blur(); fn(); }; pads.appendChild(b); };
      pad('↶ Undo', undo); pad('Hint', hint); pad('⟲', restart);
      hud.append(pick, pads); drawPick();
      buildTable(4.2); st.cam = [0, TY + 1.4, -4.6]; st.at = [0, TY + .5, .2]; ctx.player.place(0, 1.55, Math.PI);
      ctx.look(st.cam, st.at, def.fov || .8);
      H.title(def.title || 'The Potion Shelf'); H.score(''); info();
      H.hint('Click a vial (or press its number), then the one to pour into: onto the same potion or into an empty vial. <kbd>U</kbd> undo, <kbd>H</kbd> hint, <kbd>R</kbd> start again.');
      const ease = u => u * u * (3 - 2 * u);
      const apply = a => { if (a.applied) return; a.applied = true; stream.setEnabled(false); board.v = a.w; paint(a.a); paint(a.b); }; // the pour lands (once, even when a slow frame skips the middle)
      return {
        update(dt) {
          ctx.look(st.cam, st.at); st.t += dt;
          table.candles.forEach(c => { const s = 1 + Math.sin(st.t * 13 + c.ph) * .12 + Math.sin(st.t * 7.3 + c.ph * 2) * .08; c.f.scaling.set(1, s, 1); });
          if (!board) return;
          // the selected vial floats up and glows; a hinted target's rim blinks
          board.vials.forEach((V, i) => { if (st.anim && (i === st.anim.a)) return; const up = i === board.sel ? .32 + Math.sin(st.t * 5) * .03 : 0; V.node.position.y += (V.home.y + up - V.node.position.y) * Math.min(1, dt * 14);
            let sx = 0; if (st.shake && st.shake.i === i) sx = Math.sin(st.shake.t * 50) * .05 * Math.max(0, 1 - st.shake.t / .35); V.node.position.x = V.home.x + sx; });
          if (st.shake && (st.shake.t += dt) > .35) st.shake = null;
          if (board.sel >= 0) { const V = board.vials[board.sel]; halo.position.set(V.node.position.x, V.node.position.y - VH / 2 + .08, V.home.z); halo.scaling.setAll(1 + Math.sin(st.t * 6) * .05); } // a gold ring round the floating vial
          if (st.hintTo) { st.hintTo.t += dt; const V = board.vials[st.hintTo.i]; V.rim.scaling.setAll(1 + Math.max(0, Math.sin(st.hintTo.t * 12)) * .35); if (st.hintTo.t > 2 || board.sel < 0) { V.rim.scaling.setAll(1); st.hintTo = null; } }
          const a = st.anim;
          if (a) { a.t += dt; const A = board.vials[a.a], Bv = board.vials[a.b], T1 = .26, T2 = .62, T3 = .9;
            if (a.t < T1) { const u = ease(a.t / T1); A.node.position.copyFrom(V3.Lerp(a.from, a.at, u)); A.node.position.y += Math.sin(Math.PI * u) * .35; A.node.rotation.z = a.rot * u; }
            else if (a.t < T2) { A.node.position.copyFrom(a.at); A.node.rotation.z = a.rot; const u = (a.t - T1) / (T2 - T1);
              if (!a.painted) { a.painted = true; for (let j = 0; j < a.n; j++) setSlot(a.b, a.lenB + j, a.top); stream.material = src[a.top].m.material; stream.setEnabled(true); }
              const out = a.n * LH * (1 - u), inn = a.n * LH * u;
              for (let j = 0; j < a.n; j++) { const sa = A.slots[a.lenA - a.n + j]; if (sa.m) { const s = Math.max(0, Math.min(1, (out - j * LH) / LH)); sa.m.scaling.y = Math.max(.001, s); sa.m.position.y = L0 + LH * (a.lenA - a.n + j) + LH * s / 2; }
                const sb = Bv.slots[a.lenB + j]; if (sb.m) { const s = Math.max(0, Math.min(1, (inn - j * LH) / LH)); sb.m.scaling.y = Math.max(.001, s); sb.m.position.y = L0 + LH * (a.lenB + j) + LH * s / 2; } }
              const top = Bv.home.y + VH / 2 + .1, low = Bv.home.y - VH / 2 + .07 + LH * a.lenB + inn; stream.position.set(Bv.home.x, (top + low) / 2, Bv.home.z); stream.scaling.y = Math.max(.01, top - low); }
            else if (a.t < T3) { apply(a); const u = ease((a.t - T2) / (T3 - T2)); A.node.position.copyFrom(V3.Lerp(a.at, a.from, u)); A.node.position.y += Math.sin(Math.PI * u) * .25; A.node.rotation.z = a.rot * (1 - u); }
            else { A.node.position.copyFrom(a.from); A.node.rotation.z = 0; st.anim = null; apply(a);
              if (full(board.v[a.b])) { ctx.note(1046, 'bell'); H.msg('Corked!', 600); }
              if (sorted(board.v)) { st.phase = 'won'; st.wt = 0; ctx.sound('gamewin'); pads.style.display = 'none'; H.msg('Every potion sorted', 1500, `${board.moves} pours`);
                if (board.k + 1 > solvedUpTo) { solvedUpTo = board.k + 1; try { localStorage.setItem(KEY, String(solvedUpTo)); } catch (e) {} } }
              else if (!anyPour(board.v)) H.msg('No pours left', 1800, 'U undoes, R starts again'); } }
          if (st.phase === 'won') { st.wt += dt; board.vials.forEach((V, i) => { V.node.position.y = V.home.y + Math.max(0, Math.sin(st.wt * 6 - i * .6)) * .18; });
            if (st.wt > 1.8) { st.phase = 'done'; H.hint(''); const k = board.k, best = LV[k].best, bonus = board.moves <= best && !board.hints, score = (k + 1) * 20 + (bonus ? 10 : 0);
              ctx.finish({ score, label: 'points', solved: true, extra: `Shelf ${k + 1} sorted in ${board.moves} pours (the fewest is ${best})${board.hints ? `, ${board.hints} hint${board.hints > 1 ? 's' : ''}` : ''}.${k + 1 < LV.length ? ` Shelf ${k + 2} is open.` : ' Every shelf sorted.'}` }); } }
        },
        key(e, down) {
          if (!down || e.repeat) return; const k = e.key.toLowerCase();
          if (st.phase === 'pick') { const n = k === '0' ? 10 : parseInt(k, 10); if (n >= 1 && n <= LV.length) choose(n - 1); return; } // 1-9, 0 = the tenth
          if (/^[0-9]$/.test(k)) { const i = k === '0' ? 9 : +k - 1; clickVial(i); return; }
          if (k === 'u' || k === 'z' || k === 'backspace') undo(); else if (k === 'r') restart(); else if (k === 'h') hint(); else if (k === ' ') select(-1);
        },
        pointer(evt) {
          if (evt.type !== B.PointerEventTypes.POINTERDOWN || st.phase !== 'play' || st.anim) return;
          const hit = scene.pickWithRay(ctx.ray(), m => m.metadata?.potionVial != null); if (!hit?.pickedMesh) { select(-1); return; }
          clickVial(hit.pickedMesh.metadata.potionVial);
        },
        restart, // the HUD's Restart: the shelf as it was picked (no pours, undo or hints)
        _test: { st, choose, clickVial, tryPour, undo, restart, hint, get board() { return board; }, LV, pour, hintFrom },
        dispose() { pick.remove(); pads.remove(); if (board) board.vials.forEach(V => V.slots.forEach(s => { try { s.m?.dispose(); } catch (e) {} })); [table.top, table.cloth, table.riser, ...table.legs].forEach(n => { try { n?.dispose(); } catch (e) {} }); nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); }
      };
    }
  };
  window.RebelGames.register('potion', G);
})();
