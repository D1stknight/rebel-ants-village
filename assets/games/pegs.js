// The Hermit's Pegs (Oct 15, Yamabushi): spirit stones on the hermit's cross-shaped board. A stone jumps over a
// stone beside it (up, down, left or right) into an empty hole two away, and the stone it jumps leaves the board.
// Clear the board until one stone is left, in the gold hole. Click a stone, then a glowing hole; U undoes, R starts
// again, H finds a good jump (no clean bonus then). Seven boards, from six stones to the full 32-stone solitaire
// (each checked by a solver). Score: the board x 20, +10 without a hint.
// Oct 17: How to play (the rules in a few lines); the HUD's Restart is R (now also mid-jump: the jump is dropped).
// def: { levels: [{ name, pegs: [[x, y], ...] | 'full', empty?: [x, y], goal: [x, y] }], pass, points }
(function () {
  const ROWS = ['..ooo..', '..ooo..', 'ooooooo', 'ooooooo', 'ooooooo', '..ooo..', '..ooo..'];
  const LEVELS = [
    { name: 'The Cross', pegs: [[3, 1], [2, 2], [3, 2], [4, 2], [3, 3], [3, 4]], goal: [3, 3] },
    { name: 'The Plus', pegs: [[3, 1], [3, 2], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [3, 4], [3, 5]], goal: [3, 3] },
    { name: 'The Lantern', pegs: [[3, 0], [2, 1], [3, 1], [4, 1], [3, 3], [4, 3], [1, 4], [3, 4], [4, 4], [2, 5], [4, 5], [2, 6], [3, 6]], goal: [3, 3] },
    { name: 'The Falls', pegs: [[2, 0], [3, 0], [3, 1], [0, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [2, 3], [4, 3], [5, 3], [6, 3], [1, 4], [2, 4], [3, 4], [4, 4], [2, 6]], goal: [3, 3] },
    { name: 'The Mountain', pegs: [[2, 0], [3, 0], [2, 1], [3, 1], [0, 2], [1, 2], [3, 2], [4, 2], [5, 2], [0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [0, 4], [2, 4], [4, 4], [5, 4], [2, 5], [3, 5], [2, 6], [3, 6]], goal: [3, 3] },
    { name: "The Hermit's Board", pegs: 'full', empty: [3, 3], goal: [3, 3] },
    { name: 'The Last Stone', pegs: 'full', empty: [3, 1], goal: [3, 4] }
  ];
  const HOLES = []; ROWS.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === 'o') HOLES.push([x, y]); }));
  const IDX = new Map(HOLES.map(([x, y], i) => [x + ',' + y, i]));
  const MOVES = []; HOLES.forEach(([x, y], i) => { for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const o = IDX.get((x + dx) + ',' + (y + dy)), t = IDX.get((x + 2 * dx) + ',' + (y + 2 * dy)); if (o != null && t != null) MOVES.push([i, o, t]); } });
  // depth-first search with dead positions remembered: the first jump of a way to one stone on the goal (or null)
  function firstJump(pegs, goal, ms = 1500) {
    const t0 = performance.now(), dead = new Set(), key = p => p.map(v => v ? 1 : 0).join(''); let first = null, timeUp = false;
    const rec = (p, left) => { if (left === 1) return p[goal]; const k = key(p); if (dead.has(k)) return false; if (performance.now() - t0 > ms) { timeUp = true; return false; }
      for (const [f, o, t] of MOVES) if (p[f] && p[o] && !p[t]) { p[f] = p[o] = false; p[t] = true; const ok = rec(p, left - 1); p[f] = p[o] = true; p[t] = false; if (ok) { if (left === p.filter(Boolean).length) first = [f, o, t]; return true; } }
      dead.add(k); return false; };
    const n = pegs.filter(Boolean).length, ok = rec(pegs.slice(), n); return ok ? first : timeUp ? 'slow' : null;
  }
  const G = {
    title: "The Hermit's Pegs",
    howTo: { lines: [
      'A stone jumps over a stone right beside it (up, down, left or right, never diagonally) into the empty hole just behind; the stone it jumped over leaves the board.',
      'Keep jumping until only one stone is left, and it must end in the hole with the gold ring.',
      'Click a stone to pick it up: the holes it can jump to glow. Then click a glowing hole.',
      'U undoes a jump, R starts the board again, H shows a jump that still leads to a win (no bonus then).',
      'Tip: keep the stones together. A stone left on its own, with no neighbour, can never be jumped away.'] },
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const LV = def.levels || LEVELS, KEY = 'rebelAntsPegsProgress:' + (def.id || 'pegs');
      let solvedUpTo = 0; try { solvedUpTo = Math.max(0, Math.min(LV.length, Number(localStorage.getItem(KEY)) || 0)); } catch (e) {}
      const mat = (k, c, em, o = {}) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(...(o.spec || [.08, .08, .08])); if (o.power) m.specularPower = o.power; if (em) m.emissiveColor = new B.Color3(...em); if (o.alpha != null) m.alpha = o.alpha; return m; });
      const rockM = mat('rock', [.34, .38, .4], [.07, .08, .09]), holeM = mat('hole', [.08, .09, .1], [.01, .01, .02]), goalM = mat('goal', [.85, .68, .25], [.45, .33, .08]);
      const stoneM = mat('stone', [.42, .7, .95], [.12, .32, .55], { spec: [.6, .7, .8], power: 50 }), pickM = mat('picked', [.8, .95, 1], [.5, .75, 1]), glowM = mat('glow', [.45, .85, 1], [.3, .7, 1], { alpha: .55 });
      const nodes = [], keep = n => { n.parent = n.parent || ctx.frame; ctx.add(n); nodes.push(n); if (n.isPickable !== undefined) n.isPickable = false; return n; };
      const SP = .42, TY = .55, pos = i => { const [x, y] = HOLES[i]; return new V3((x - 3) * SP, TY + .02, (3 - y) * SP); };
      // the board: a weathered round stone with 33 holes; the stones are polished blue spirit pebbles
      { const slab = keep(B.MeshBuilder.CreateCylinder('pgSlab', { height: TY, diameterTop: 3.45, diameterBottom: 3.8, tessellation: 40 }, scene)); slab.material = rockM; slab.position.y = TY / 2; }
      const holes = HOLES.map((_, i) => { const h = keep(B.MeshBuilder.CreateDisc('pgHole', { radius: .12, tessellation: 18 }, scene)); h.material = holeM; h.rotation.x = Math.PI / 2; h.position.copyFrom(pos(i)); h.position.y = TY + .004; h.isPickable = true; h.metadata = { pgHole: i }; return h; });
      const goalRing = keep(B.MeshBuilder.CreateTorus('pgGoal', { diameter: .3, thickness: .035, tessellation: 24 }, scene)); goalRing.material = goalM;
      const glowSrc = keep(B.MeshBuilder.CreateCylinder('pgGlow', { height: .02, diameter: .27, tessellation: 18 }, scene)); glowSrc.material = glowM; glowSrc.isVisible = false;
      let glows = [];
      const stoneSrc = keep(B.MeshBuilder.CreateSphere('pgStoneSrc', { diameterX: .27, diameterY: .17, diameterZ: .27, segments: 10 }, scene)); stoneSrc.material = stoneM; stoneSrc.isVisible = false;
      let bd = null; // { k, pegs[] bools, stones[] mesh|null, goal, sel, hist[], hints }
      const st = { phase: 'pick', t: 0, anim: null };
      function build(k) {
        if (bd) bd.stones.forEach(s => s && s.dispose());
        const L = LV[k], pegs = HOLES.map(() => false);
        if (L.pegs === 'full') { pegs.fill(true); pegs[IDX.get(L.empty.join(','))] = false; } else L.pegs.forEach(([x, y]) => { pegs[IDX.get(x + ',' + y)] = true; });
        bd = { k, pegs, goal: IDX.get(L.goal.join(',')), sel: -1, hist: [], hints: 0, stones: HOLES.map(() => null) };
        pegs.forEach((p, i) => { if (p) bd.stones[i] = makeStone(i); });
        goalRing.position.copyFrom(pos(bd.goal)); goalRing.position.y = TY + .01; ctx.player.place(0, 2.5, Math.PI); select(-1); info();
      }
      function makeStone(i) { const s = stoneSrc.createInstance('pgStone'); s.parent = ctx.frame; ctx.add(s); s.position.copyFrom(pos(i)); s.position.y = TY + .07; s.isPickable = true; s.metadata = { pgStone: i }; return s; }
      const left = () => bd.pegs.filter(Boolean).length;
      const info = () => H.info(bd ? `Board ${bd.k + 1} / ${LV.length} · ${LV[bd.k].name} · stones left ${left()}${bd.hints ? ` · hints ${bd.hints}` : ''}` : 'Pick a board');
      const jumpsFrom = i => MOVES.filter(([f, o, t]) => f === i && bd.pegs[o] && !bd.pegs[t]);
      function select(i) { glows.forEach(g => g.dispose()); glows = []; if (bd && bd.sel >= 0 && bd.stones[bd.sel]) bd.stones[bd.sel].position.y = TY + .07;
        if (!bd) return; bd.sel = i; if (i < 0) return; const js = jumpsFrom(i); js.forEach(([, , t]) => { const g = glowSrc.createInstance('pgGlowI'); g.parent = ctx.frame; ctx.add(g); g.position.copyFrom(pos(t)); g.position.y = TY + .015; glows.push(g); }); }
      function jump(f, o, t) {
        if (st.phase !== 'play' || st.anim || !bd.pegs[f] || !bd.pegs[o] || bd.pegs[t] || !MOVES.some(m => m[0] === f && m[1] === o && m[2] === t)) return false;
        bd.hist.push({ f, o, t }); bd.pegs[f] = false; bd.pegs[o] = false; bd.pegs[t] = true; const s = bd.stones[f], gone = bd.stones[o]; bd.stones[t] = s; bd.stones[f] = null; bd.stones[o] = null; s.metadata.pgStone = t;
        select(-1); st.anim = { s, gone, from: pos(f), to: pos(t), t: 0 }; ctx.note(520 + left() * 14, 'bell'); info(); return true;
      }
      function settle() {
        if (left() === 1) { const won = bd.pegs[bd.goal]; if (won) { st.phase = 'won'; st.wt = 0; ctx.sound('gamewin'); H.msg('One stone, in the gold hole', 1600); pads.style.display = 'none'; if (bd.k + 1 > solvedUpTo) { solvedUpTo = bd.k + 1; try { localStorage.setItem(KEY, String(solvedUpTo)); } catch (e) {} } }
          else H.msg('One stone, but not in the gold hole', 1800, 'U undoes, R starts again'); return; }
        if (!MOVES.some(([f, o, t]) => bd.pegs[f] && bd.pegs[o] && !bd.pegs[t])) H.msg('No jumps left', 1800, `${left()} stones: U undoes, R starts again`);
      }
      function undo() { if (st.phase !== 'play' || st.anim || !bd?.hist.length) return; const { f, o, t } = bd.hist.pop(); bd.pegs[f] = true; bd.pegs[o] = true; bd.pegs[t] = false; const s = bd.stones[t]; bd.stones[f] = s; bd.stones[t] = null; s.metadata.pgStone = f; s.position.copyFrom(pos(f)); s.position.y = TY + .07; bd.stones[o] = makeStone(o); select(-1); info(); }
      function restart() { if (st.phase !== 'play' || !bd) return; if (st.anim) { st.anim.gone?.dispose(); st.anim = null; } build(bd.k); H.msg('Again', 600); } // a jump in the air is dropped (its taken stone is no longer on the board's list)
      function hint() { if (st.phase !== 'play' || st.anim) return; const r = firstJump(bd.pegs, bd.goal);
        if (r === 'slow') { H.msg('Too many paths to see from here', 1500, 'undo a little, or try again'); return; }
        if (!r) { H.msg('No way to one stone from here', 1600, 'U undoes, R starts again'); return; }
        bd.hints++; info(); select(r[0]); if (bd.stones[r[0]]) bd.stones[r[0]].position.y = TY + .2; H.msg('This stone', 1100, 'over its neighbour into the glowing hole'); bd.hintTo = r[2]; }
      function clickAt(i, isStone) {
        if (st.phase !== 'play' || st.anim || !bd) return;
        if (isStone || bd.pegs[i]) { if (bd.sel === i) { select(-1); return; } if (!jumpsFrom(i).length) { select(-1); H.msg('That stone cannot jump', 700); return; } select(i); bd.stones[i].position.y = TY + .2; ctx.note(700, 'lantern'); return; }
        if (bd.sel >= 0) { const m = MOVES.find(([f, , t]) => f === bd.sel && t === i); if (m && jump(...m)) return; H.msg('Not a jump', 600); }
      }
      const hud = document.getElementById('gameHud');
      const pick = document.createElement('div');
      pick.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(400px,90vw);background:rgba(8,18,22,.95);border:1px solid rgba(110,200,240,.6);border-radius:14px;padding:16px;text-align:center;pointer-events:auto;font:15px/1.4 system-ui,sans-serif;color:#eee';
      const drawPick = () => { pick.innerHTML = `<div style="font:800 13px/1.2 system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#8fd8ff;margin-bottom:10px">The Hermit's Pegs</div><div style="margin-bottom:12px;color:#bbb">Jump stones until one is left, in the gold hole.</div>`
        + `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">${LV.map((L, k) => { const open = k <= solvedUpTo, ok = k < solvedUpTo, n = L.pegs === 'full' ? 32 : L.pegs.length; return `<button type="button" data-k="${k}" ${open ? '' : 'disabled'} style="padding:8px 2px;border-radius:9px;border:1px solid ${open ? '#8fd8ff' : '#444'};background:${ok ? 'rgba(143,216,255,.22)' : 'rgba(255,255,255,.04)'};color:${open ? '#fff' : '#666'};font:700 15px system-ui,sans-serif;cursor:${open ? 'pointer' : 'default'}">${open ? `${k + 1}<div style="font:11px system-ui;opacity:.75">${n} stones</div>` : '🔒'}${ok ? ' ✓' : ''}</button>`; }).join('')}</div>`;
        pick.querySelectorAll('button[data-k]').forEach(b => b.onclick = (e) => { e.stopPropagation(); b.blur(); choose(+b.dataset.k); }); };
      const pads = document.createElement('div');
      pads.style.cssText = 'position:absolute;bottom:62px;right:14px;display:none;gap:6px;pointer-events:auto';
      const padBtn = (t, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.style.cssText = 'min-width:52px;height:40px;padding:0 10px;border-radius:9px;border:1px solid #6fb8dc;background:rgba(8,18,24,.88);color:#e6f7ff;font:700 15px system-ui;cursor:pointer'; b.onclick = (e) => { e.stopPropagation(); b.blur(); fn(); }; pads.appendChild(b); return b; };
      padBtn('↶ Undo', undo); padBtn('Hint', hint); padBtn('⟲', restart);
      function choose(k) { if (st.phase !== 'pick' || k > solvedUpTo || k >= LV.length) return; pick.remove(); st.phase = 'play'; build(k); pads.style.display = 'flex'; H.msg(LV[k].name, 1200, k >= 5 ? 'the old hermit\'s own board' : ''); }
      hud.append(pick, pads); drawPick();
      const cam = [0, TY + 4.3, -3.5], at = [0, TY, .25];
      ctx.player.place(0, 2.5, Math.PI); ctx.look(cam, at, def.fov || .8);
      H.title(def.title || "The Hermit's Pegs"); H.score(''); info();
      H.hint('Click a stone, then a glowing hole: it jumps over its neighbour, which leaves the board. <kbd>U</kbd> undo, <kbd>R</kbd> start again, <kbd>H</kbd> hint.');
      return {
        update(dt) {
          ctx.look(cam, at); st.t += dt; if (!bd) return;
          glows.forEach((g, k) => { g.scaling.setAll(1 + Math.sin(st.t * 6 + k) * .08); });
          goalRing.rotation.y += dt * .6;
          const a = st.anim; if (a) { a.t += dt / .32; const u = Math.min(1, a.t); a.s.position.copyFrom(V3.Lerp(a.from, a.to, u)); a.s.position.y = TY + .07 + Math.sin(Math.PI * u) * .35; if (a.gone) a.gone.scaling.setAll(Math.max(.01, 1 - u));
            if (u >= 1) { if (a.gone) a.gone.dispose(); st.anim = null; settle(); } }
          if (st.phase === 'won' && (st.wt += dt) > 1.8) { st.phase = 'done'; H.hint(''); const k = bd.k;
            ctx.finish({ score: (k + 1) * 20 + (bd.hints ? 0 : 10), label: 'points', solved: true, extra: `${LV[k].name}: one stone left in the gold hole${bd.hints ? ` (${bd.hints} hint${bd.hints > 1 ? 's' : ''})` : ''}.${k + 1 < LV.length ? ` Board ${k + 2} is open.` : ' Every board cleared.'}` }); }
        },
        key(e, down) {
          if (!down || e.repeat) return; const k = e.key.toLowerCase();
          if (st.phase === 'pick') { const n = k === '0' ? 10 : parseInt(k, 10); if (n >= 1 && n <= LV.length) choose(n - 1); return; } // 1-9, 0 = the tenth
          if (k === 'u' || k === 'z' || k === 'backspace') undo(); else if (k === 'r') restart(); else if (k === 'h') hint();
        },
        pointer(evt) {
          if (evt.type !== B.PointerEventTypes.POINTERDOWN || st.phase !== 'play') return;
          const hit = scene.pickWithRay(ctx.ray(), m => m.metadata?.pgStone != null || m.metadata?.pgHole != null); if (!hit?.pickedMesh) { select(-1); return; }
          const md = hit.pickedMesh.metadata; if (md.pgStone != null) clickAt(md.pgStone, true); else clickAt(md.pgHole, false);
        },
        restart, // the HUD's Restart: the board as it was picked (no undo or hints)
        _test: { st, choose, jump, undo, restart, hint, clickAt, firstJump, MOVES, HOLES, get bd() { return bd; }, LV },
        dispose() { pick.remove(); pads.remove(); glows.forEach(g => { try { g.dispose(); } catch (e) {} }); if (bd) bd.stones.forEach(s => { try { s?.dispose(); } catch (e) {} }); nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); }
      };
    }
  };
  window.RebelGames.register('pegs', G);
})();
