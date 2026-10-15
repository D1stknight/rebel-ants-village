// The Archivist's Stones (Oct 15, Kenshi): rows of white stones on a low table between you and the Archivist. Turn by
// turn, each of you takes one or more stones from a single row: click a stone and it goes with every stone to its right
// (or move the ring with the arrows and press Space). Whoever takes the last stone wins; on the last level whoever has
// to take it loses. From level 2 the Archivist never misses a winning move, so each of your turns must leave him a
// position he cannot win from. After a loss he gives a hint, plainer each time.
// def: { opponent: npcId, at: [x, z] (the table's middle, frame coordinates), player: [x, z, yaw], cam, look, levels, pass, points }
(function () {
  const LEVELS = [
    { rows: [1, 3, 5], smart: .35 },
    { rows: [3, 4, 5], smart: 1 },
    { rows: [2, 5, 6, 7], smart: 1 },
    { rows: [3, 5, 7], smart: 1, misere: true }
  ];
  const SCORE = [25, 45, 65, 90];
  const HINTS = [
    '"Every row can be counted in fours, twos and ones."',
    '"Seven is a four, a two and a one; five is a four and a one. Leave me rows where every four, every two and every one has a partner in another row."',
    '"Count each row in fours, twos and ones. If an odd number of rows hold a four, or a two, or a one, change the one row that puts them all back to pairs."',
    '"When you must not take the last stone: play the pairs as before, until your take would leave only single stones. Then leave me an odd number of them."'
  ];
  // the side to move wins from these rows with best play (normal: taking the last stone wins; misère: it loses)
  const memo = { n: new Map(), m: new Map() };
  function wins(rows, misere) {
    const M = misere ? memo.m : memo.n, k = rows.join(','); if (M.has(k)) return M.get(k);
    let r = false;
    if (rows.every(n => !n)) r = !!misere; // the other side took the last stone
    else for (let i = 0; i < rows.length && !r; i++) for (let t = 1; t <= rows[i]; t++) { const n = rows.slice(); n[i] -= t; if (!wins(n, misere)) { r = true; break; } }
    M.set(k, r); return r;
  }
  function aiMove(rows, lv) {
    const moves = []; rows.forEach((n, i) => { for (let t = 1; t <= n; t++) moves.push([i, t]); });
    const good = moves.filter(([i, t]) => { const n = rows.slice(); n[i] -= t; return !wins(n, !!lv.misere); });
    if (good.length && Math.random() < lv.smart) return good[Math.floor(Math.random() * good.length)];
    if (lv.smart >= 1) { let i = 0; rows.forEach((n, k) => { if (n > rows[i]) i = k; }); return [i, 1]; } // nothing wins: one stone from the longest row, and wait for a slip
    return moves[Math.floor(Math.random() * moves.length)];
  }
  const G = {
    title: "The Archivist's Stones",
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const LV = def.levels || LEVELS, AT = def.at || [0, 0];
      const KEY = 'rebelAntsStonesProgress:' + (def.id || 'nim'), LOSS = 'rebelAntsStonesLosses:' + (def.id || 'nim');
      let solvedUpTo = 0, losses = 0; try { solvedUpTo = Math.max(0, Math.min(LV.length, Number(localStorage.getItem(KEY)) || 0)); losses = Number(localStorage.getItem(LOSS)) || 0; } catch (e) {}
      const mat = (k, c, em, spec = .1) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(spec, spec, spec); if (em) m.emissiveColor = new B.Color3(...em); return m; });
      const M = { table: mat('table', [.36, .24, .15], [.05, .035, .02]), top: mat('top', [.5, .36, .22], [.08, .055, .03]), stone: mat('stone', [.92, .92, .88], [.28, .28, .26], .35),
        take: mat('take', [1, .45, .35], [.6, .18, .12], .3), cursor: mat('cursor', [1, .85, .35], [.9, .7, .2]), mark: mat('mark', [.2, .16, .12], [.02, .02, .01]) };
      M.cursor.disableLighting = true;
      const nodes = [], keep = n => { if (!n.parent) n.parent = ctx.frame; ctx.add(n); nodes.push(n); return n; };
      const npc = def.opponent ? ctx.npc(def.opponent) : null, npcWas = npc ? { p: npc.position.clone(), ry: npc.rotation.y, open: npc.metadata?.dialogueOpen, m: { home: npc.metadata?.home, wo: npc.metadata?.wanderOrigin, target: npc.metadata?.target } } : null;
      let bd = null; // { k, lv, rows (counts), stones: [[{ mesh, gone }]], W, D, TOP, piles: { me, him } }
      const st = { phase: 'pick', ri: 0, si: 0, hover: null, wait: 0, fly: [] };
      const SP = .46, RG = .62;
      function build(k) {
        if (bd) bd.nodes.forEach(n => { try { n.dispose(); } catch (e) {} });
        const lv = LV[k], R = lv.rows.length, MX = Math.max(...lv.rows), W = MX * SP + 1.1, D = R * RG + .7, TOP = .55;
        bd = { k, lv, rows: lv.rows.slice(), stones: [], W, D, TOP, piles: { me: 0, him: 0 }, nodes: [], turns: 0 };
        const add = n => { n.parent = ctx.frame; ctx.add(n); bd.nodes.push(n); return n; };
        const top = add(B.MeshBuilder.CreateBox('nimTop', { width: W, height: .1, depth: D }, scene)); top.material = M.top; top.position.set(AT[0], TOP - .05, AT[1]); top.isPickable = false;
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const l = add(B.MeshBuilder.CreateBox('nimLeg', { width: .14, height: TOP - .1, depth: .14 }, scene)); l.material = M.table; l.position.set(AT[0] + sx * (W / 2 - .15), (TOP - .1) / 2, AT[1] + sz * (D / 2 - .15)); l.isPickable = false; }
        lv.rows.forEach((n, i) => {
          const z = AT[1] + ((R - 1) / 2 - i) * RG, row = [];
          const groove = add(B.MeshBuilder.CreateBox('nimGroove', { width: MX * SP + .2, height: .012, depth: .05 }, scene)); groove.material = M.mark; groove.position.set(AT[0], TOP + .006, z - .2); groove.isPickable = false;
          for (let j = 0; j < n; j++) { const s = add(B.MeshBuilder.CreateSphere('nimStone', { diameter: .32, segments: 10 }, scene)); s.scaling.y = .55; s.material = M.stone;
            s.position.set(AT[0] + (j - (MX - 1) / 2) * SP, TOP + .09, z); s.isPickable = true; s.metadata = { nim: [i, j] }; row.push({ mesh: s, gone: false }); }
          bd.stones.push(row);
        });
        st.cursor = add(B.MeshBuilder.CreateTorus('nimCursor', { diameter: .46, thickness: .035, tessellation: 24 }, scene)); st.cursor.material = M.cursor; st.cursor.isPickable = false;
        st.ri = 0; st.si = 0; fixSel(); paint(); info();
        // the opponent across the table, facing you
        if (npc) { const w = ctx.toWorld(AT[0], 0, AT[1] + D / 2 + 1.05), f = ctx.toWorld(AT[0], 0, AT[1] - 3); npc.position.x = w.x; npc.position.z = w.z; npc.rotation.y = Math.atan2(f.x - w.x, f.z - w.z);
          if (npc.metadata) { npc.metadata.target = null; npc.metadata.home = npc.position.clone(); npc.metadata.wanderOrigin = npc.position.clone(); npc.metadata.dialogueOpen = true; } }
      }
      const total = () => bd.rows.reduce((a, b) => a + b, 0);
      // the ring stays on a stone that is still there
      function fixSel() { if (!bd || !total()) return; if (!bd.rows[st.ri]) st.ri = bd.rows.findIndex(n => n > 0); st.si = Math.max(0, Math.min(bd.rows[st.ri] - 1, st.si)); }
      function paint() {
        if (!bd) return; const sel = st.hover || (st.phase === 'play' ? [st.ri, st.si] : null);
        bd.stones.forEach((row, i) => row.forEach((s, j) => { if (!s.gone) s.mesh.material = sel && sel[0] === i && j >= sel[1] ? M.take : M.stone; }));
        if (st.cursor) { const on = st.phase === 'play' && !st.hover && bd.rows[st.ri] > 0; st.cursor.setEnabled(on); if (on) { const p = bd.stones[st.ri][st.si].mesh.position; st.cursor.position.set(p.x, bd.TOP + .03, p.z); } }
      }
      const info = () => { if (!bd || st.phase === 'pick') { H.info('Pick a level'); H.score(''); return; } H.info(`Level ${bd.k + 1} / ${LV.length} · ${st.phase === 'ai' ? 'his turn' : st.phase === 'play' ? 'your turn' : ''}`); H.score(`${total()} stones`); };
      // take stones j.. of row i: they fly to the taker's corner of the table
      function take(i, j, who) {
        const row = bd.stones[i], n = bd.rows[i]; if (j < 0 || j >= n) return 0;
        for (let k = n - 1; k >= j; k--) { const s = row[k]; s.gone = true; s.mesh.isPickable = false; s.mesh.material = M.stone;
          const c = bd.piles[who]++, to = who === 'me' ? new V3(AT[0] + bd.W / 2 - .25 - (c % 3) * .3, bd.TOP + .09 + Math.floor(c / 9) * .12, AT[1] - bd.D / 2 + .22 + (Math.floor(c / 3) % 3) * .3)
            : new V3(AT[0] - bd.W / 2 + .25 + (c % 3) * .3, bd.TOP + .09 + Math.floor(c / 9) * .12, AT[1] + bd.D / 2 - .22 - (Math.floor(c / 3) % 3) * .3);
          st.fly.push({ m: s.mesh, from: s.mesh.position.clone(), to, t: 0, delay: (n - 1 - k) * .07 }); }
        bd.rows[i] = j; bd.turns++; ctx.sound('thock'); return n - j;
      }
      function end(won) {
        st.phase = won ? 'won' : 'lost'; st.wait = 1.8; st.hover = null; paint(); info();
        if (won) { ctx.sound('gamewin'); H.msg('You took the game', 1500, bd.lv.misere ? 'he had to take the last stone' : 'the last stone is yours');
          if (bd.k + 1 > solvedUpTo) { solvedUpTo = bd.k + 1; try { localStorage.setItem(KEY, String(solvedUpTo)); } catch (e) {} } }
        else { losses++; try { localStorage.setItem(LOSS, String(losses)); } catch (e) {} H.msg('The Archivist wins', 1500, bd.lv.misere ? 'you had to take the last stone' : 'he took the last stone'); }
      }
      // after a take: the game ends when the table is empty (normal: the taker wins; misère: the taker loses)
      function after(who) { if (total()) return false; end(bd.lv.misere ? who !== 'me' : who === 'me'); return true; }
      function myTake(i, j) {
        if (st.phase !== 'play' || !bd.rows[i] || j >= bd.rows[i]) return;
        const got = take(i, j, 'me'); st.hover = null; H.msg(`You take ${got}`, 600);
        if (after('me')) return;
        st.phase = 'ai'; st.wait = 1.1 + Math.random() * .5; fixSel(); paint(); info();
      }
      function hisTake() {
        const [i, t] = aiMove(bd.rows, bd.lv), j = bd.rows[i] - t; take(i, j, 'him'); H.msg(`He takes ${t} from row ${i + 1}`, 1000);
        if (after('him')) return;
        st.phase = 'play'; fixSel(); paint(); info();
      }
      // the level picker
      const hud = document.getElementById('gameHud'), pick = document.createElement('div');
      pick.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(400px,90vw);background:rgba(12,16,30,.94);border:1px solid rgba(216,179,92,.7);border-radius:14px;padding:16px;text-align:center;pointer-events:auto;font:15px/1.4 Georgia,serif;color:#eee';
      const label = L => `${L.rows.join(' · ')}${L.misere ? ' · last stone loses' : ''}`;
      pick.innerHTML = `<div style="font:700 13px/1.2 Georgia,serif;letter-spacing:.14em;text-transform:uppercase;color:#d8b35c;margin-bottom:10px">The Archivist's Stones</div><div style="margin-bottom:12px;color:#bbb">Take turns. On your turn take one or more stones from one row. Whoever takes the last stone wins. You go first.</div>`
        + `<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px">${LV.map((L, k) => { const open = k <= solvedUpTo, done = k < solvedUpTo; return `<button type="button" data-k="${k}" ${open ? '' : 'disabled'} style="padding:10px 4px;border-radius:9px;border:1px solid ${open ? '#d8b35c' : '#444'};background:${done ? 'rgba(216,179,92,.22)' : 'rgba(255,255,255,.04)'};color:${open ? '#fff' : '#666'};font:700 15px Georgia,serif;cursor:${open ? 'pointer' : 'default'}">${open ? 'Level ' + (k + 1) : '🔒'}${done ? ' ✓' : ''}${open ? `<div style="font:12px Georgia,serif;color:#c9b88a">${label(L)}</div>` : ''}</button>`; }).join('')}</div>`
        + (losses ? `<div style="margin-top:12px;font:italic 13px/1.4 Georgia,serif;color:#cfd8e6">The Archivist: ${HINTS[Math.min(HINTS.length - 1, losses - 1)]}</div>` : '');
      pick.querySelectorAll('button[data-k]').forEach(b => b.onclick = (e) => { e.stopPropagation(); b.blur(); choose(+b.dataset.k); });
      function choose(k) { if (st.phase !== 'pick' || k > solvedUpTo || k >= LV.length) return; pick.remove(); st.phase = 'play'; build(k);
        H.msg(`Level ${k + 1}`, 1100, LV[k].misere ? 'this time the last stone loses' : k ? 'he will not slip now' : 'you go first');
        H.hint(`Click a stone: it and every stone to its right are yours (or move the ring with the arrows, <kbd>Space</kbd> takes). ${LV[k].misere ? 'Whoever takes the last stone loses.' : 'Whoever takes the last stone wins.'}`); }
      hud.appendChild(pick);
      build(Math.min(solvedUpTo, LV.length - 1)); // the table behind the picker
      const WMAX = Math.max(...LV.map(L => Math.max(...L.rows))) * SP + 1.1, P = def.player || [AT[0] - WMAX / 2 - 1, AT[1] - .5, Math.PI / 2 - .3]; ctx.player.place(P[0], P[1], P[2]); // beside the table's left end
      const cam = def.cam || [AT[0] + 1.3, 5.8, AT[1] - 3.6], at = def.look || [AT[0] - .1, .3, AT[1] + .6];
      ctx.look(cam, at, def.fov || .82);
      H.title(def.title || "The Archivist's Stones"); H.score(''); info();
      H.hint('Pick a level: click it or press its number.');
      return {
        update(dt) {
          ctx.look(cam, at);
          for (let k = st.fly.length - 1; k >= 0; k--) { const f = st.fly[k]; if (f.delay > 0) { f.delay -= dt; continue; } f.t = Math.min(1, f.t + dt / .42);
            const p = V3.Lerp(f.from, f.to, f.t); p.y += Math.sin(Math.PI * f.t) * .45; f.m.position.copyFrom(p); if (f.t >= 1) st.fly.splice(k, 1); }
          if (st.phase === 'ai' && (st.wait -= dt) <= 0) hisTake();
          if ((st.phase === 'won' || st.phase === 'lost') && (st.wait -= dt) <= 0) {
            const won = st.phase === 'won'; st.phase = 'done'; H.hint('');
            const k = bd.k, score = won ? (SCORE[k] ?? 25 * (k + 1)) : 0;
            ctx.finish({ score, label: 'points', passed: won && score >= (def.pass || 0), extra: won ? `Level ${k + 1} (${label(LV[k])}) won in ${Math.ceil(bd.turns / 2)} turns.${k + 1 < LV.length ? ` Level ${k + 2} is open.` : ' Every level won.'}`
              : `The Archivist won level ${k + 1}. He says: ${HINTS[Math.min(HINTS.length - 1, losses - 1)]}` });
          }
        },
        key(e, down) {
          if (!down || e.repeat) return; const k = e.key.toLowerCase();
          if (st.phase === 'pick') { const n = parseInt(k, 10); if (n >= 1 && n <= LV.length) choose(n - 1); return; }
          if (st.phase !== 'play') return;
          st.hover = null;
          const rowsWith = bd.rows.map((n, i) => n ? i : -1).filter(i => i >= 0);
          if (k === 'arrowup' || k === 'w') { const p = rowsWith.filter(i => i < st.ri); if (p.length) st.ri = p[p.length - 1]; }
          else if (k === 'arrowdown' || k === 's') { const p = rowsWith.filter(i => i > st.ri); if (p.length) st.ri = p[0]; }
          else if (k === 'arrowleft' || k === 'a') st.si--; else if (k === 'arrowright' || k === 'd') st.si++;
          else if (k === ' ' || k === 'enter') { myTake(st.ri, st.si); return; }
          fixSel(); paint();
        },
        pointer(evt) {
          if (st.phase !== 'play') return;
          const hit = scene.pickWithRay(ctx.ray(), m => !!m.metadata?.nim && m.isPickable);
          const on = hit?.hit ? hit.pickedMesh.metadata.nim : null;
          if (evt.type === B.PointerEventTypes.POINTERMOVE) { const was = st.hover; st.hover = on; if (String(was) !== String(on)) paint(); }
          else if (evt.type === B.PointerEventTypes.POINTERDOWN && on) { st.ri = on[0]; st.si = on[1]; myTake(on[0], on[1]); }
        },
        _test: { st, choose, myTake, wins, aiMove, get bd() { return bd; } },
        dispose() { pick.remove(); if (bd) bd.nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); nodes.forEach(n => { try { n.dispose(); } catch (e) {} });
          if (npc && npcWas) { npc.position.copyFrom(npcWas.p); npc.rotation.y = npcWas.ry; if (npc.metadata) { npc.metadata.home = npcWas.m.home; npc.metadata.wanderOrigin = npcWas.m.wo; npc.metadata.target = npcWas.m.target; npc.metadata.dialogueOpen = !!npcWas.open; } } }
      };
    }
  };
  window.RebelGames.register('nim', G);
})();
