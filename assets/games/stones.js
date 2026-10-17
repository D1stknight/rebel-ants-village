// The Misty Stones (Oct 15, Yamabushi): a field of stepping stones in the mist, and only some of them hold. The safe
// path glows for a moment (stone by stone), then the mist closes in: walk it from memory (W / ↑ ahead, A D / ← → aside,
// S / ↓ back, or click the next stone). A wrong stone sinks you back to the start and the path shows once more; three
// falls and the mist wins. Three levels, longer paths and fewer looks; a level opens when the one before is crossed.
// Oct 17: How to play (the rules) and Restart (back on the ledge, the same path shown again, no falls).
// Oct 17: a step off the field's side (A on the left column, D on the right) or S on the first stone is a bump: it
// used to hop onto a stone that is not there, and the fall after it stopped the game ("The game hit a snag").
// def: { at: [x, z] (the field's near middle, frame coordinates; rows run along +z), pitch: m between stones, levels, cam, look, pass, points }
(function () {
  // Oct 17 (Miguel: "make it 10 levels"): wider and longer fields, the path shown quicker and twisting more
  const LEVELS = [{ cols: 5, rows: 6, show: 1.1, twists: 2 }, { cols: 5, rows: 8, show: .85, twists: 4 }, { cols: 6, rows: 9, show: .6, twists: 6 },
    { cols: 6, rows: 10, show: .55, twists: 7 }, { cols: 6, rows: 10, show: .48, twists: 8 }, { cols: 7, rows: 11, show: .45, twists: 9 },
    { cols: 7, rows: 11, show: .4, twists: 10 }, { cols: 7, rows: 12, show: .38, twists: 11 }, { cols: 8, rows: 12, show: .34, twists: 12 },
    { cols: 8, rows: 12, show: .3, twists: 14 }];
  const SCORE = [30, 60, 100, 120, 140, 160, 185, 210, 240, 270];
  const G = {
    title: 'The Misty Stones',
    howTo: { lines: [
      'Only some stepping stones hold. The safe path glows for a moment, stone by stone, from the near ledge to the far one.',
      'Then the mist closes in: walk it from memory. W or ↑ steps ahead, A D or ← → step aside, S or ↓ steps back, or click the next stone.',
      'The path goes one stone at a time, ahead or to the side, never on a slant.',
      'A wrong stone sinks you back to the start and the path shows once more; three falls and the mist wins.',
      'Tip: say the path to yourself as it glows, like "ahead, ahead, left, ahead".'] },
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const LV = def.levels || LEVELS, AT = def.at || [0, 1.5], P = def.pitch || 1.5;
      const KEY = 'rebelAntsStonesProgress:' + (def.id || 'stones');
      let solvedUpTo = 0; try { solvedUpTo = Math.max(0, Math.min(LV.length, Number(localStorage.getItem(KEY)) || 0)); } catch (e) {}
      const mat = (k, c, em, spec = .1, a) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(spec, spec, spec); if (em) m.emissiveColor = new B.Color3(...em); if (a != null) m.alpha = a; return m; });
      const M = { stone: mat('stone', [.36, .4, .42], [.04, .05, .06]), glow: mat('glow', [.5, .85, 1], [.35, .75, 1], .3), walked: mat('walked', [.45, .7, .8], [.12, .3, .4], .2), sunk: mat('sunk', [.25, .2, .22], [.05, .02, .03]),
        mist: mat('mist', [.75, .85, .95], [.35, .45, .55], 0, .35), start: mat('startStone', [.62, .55, .4], [.12, .1, .06]) };
      M.mist.backFaceCulling = false;
      let lv = null; // { k, cols, rows, path: [[c, r]], stones[r][c] = mesh, pos: index on path (-1 = the start ledge), falls, shows }
      const st = { phase: 'pick', wait: 0, showT: 0, hop: 0, from: null };
      const stonePos = (c, r) => new V3(AT[0] + (c - (lv.cols - 1) / 2) * P, 0, AT[1] + (r + 1) * P);
      const keep = n => { n.parent = ctx.frame; ctx.add(n); lv.nodes.push(n); return n; };
      // a path from the near row to the far row: mostly ahead, with twists aside (never back onto itself)
      function makePath(L) {
        for (let tries = 0; tries < 200; tries++) {
          let c = Math.floor(Math.random() * L.cols), r = 0; const p = [[c, 0]], used = new Set([c + ',0']); let twists = 0;
          while (r < L.rows - 1) {
            const side = twists < L.twists && Math.random() < .55 ? (Math.random() < .5 ? -1 : 1) : 0;
            if (side && c + side >= 0 && c + side < L.cols && !used.has((c + side) + ',' + r)) { c += side; twists++; }
            else r++;
            p.push([c, r]); used.add(c + ',' + r);
          }
          if (twists >= L.twists - 1) return p;
        }
        return Array.from({ length: L.rows }, (_, r) => [Math.floor(L.cols / 2), r]);
      }
      function build(k, path) { // path: the level's own path again (Restart), else a new one
        if (lv) lv.nodes.forEach(n => { try { n.dispose(); } catch (e) {} });
        const L = LV[k]; lv = { k, cols: L.cols, rows: L.rows, path: path || makePath(L), stones: [], pos: -1, falls: 0, shows: 0, nodes: [], show: L.show };
        const ledge = keep(B.MeshBuilder.CreateBox('stLedge', { width: L.cols * P + .6, height: .3, depth: 1.4 }, scene)); ledge.position.set(AT[0], .15, AT[1] - .2); ledge.material = M.start; ledge.isPickable = false;
        const far = keep(B.MeshBuilder.CreateBox('stFar', { width: L.cols * P + .6, height: .3, depth: 1.4 }, scene)); far.position.set(AT[0], .15, AT[1] + (L.rows + 1) * P + .2); far.material = M.start; far.isPickable = false;
        for (let r = 0; r < L.rows; r++) { lv.stones.push([]); for (let c = 0; c < L.cols; c++) {
          const s = keep(B.MeshBuilder.CreateCylinder('stStone', { height: .32, diameterTop: P * .62, diameterBottom: P * .72, tessellation: 9 }, scene)); const p = stonePos(c, r);
          s.position.set(p.x, .16, p.z); s.rotation.y = (r * 7 + c * 3) % 5; s.material = M.stone; s.isPickable = true; s.metadata = { stStone: [c, r] }; lv.stones[r].push(s); } }
        for (let i = 0; i < 3; i++) { const m = keep(B.MeshBuilder.CreateGround('stMist', { width: L.cols * P + 3, height: L.rows * P + 2 }, scene)); m.position.set(AT[0], .22 + i * .18, AT[1] + (L.rows + 1) * P / 2); m.material = M.mist; m.isPickable = false; m.metadata = { drift: i }; }
        ctx.player.place(AT[0], AT[1] - .2, 0); st.at = [AT[0], AT[1] - .2];
        flashPath(); info();
      }
      const onPath = (c, r) => lv.path.findIndex(p => p[0] === c && p[1] === r);
      function flashPath() { st.phase = 'show'; st.showT = 0; lv.shows++; H.msg(lv.shows === 1 ? 'Watch the stones' : 'Once more…', 900); }
      const info = () => H.info(lv ? `Level ${lv.k + 1} / ${LV.length} · falls ${lv.falls} / 3` : 'Pick a level');
      function stepTo(c, r) {
        if (st.phase !== 'play' || st.hop > 0) return;
        const cur = lv.pos < 0 ? null : lv.path[lv.pos];
        const adj = cur ? Math.abs(cur[0] - c) + Math.abs(cur[1] - r) === 1 : r === 0;
        if (!adj || !lv.stones[r]?.[c]) { ctx.sound('thock'); return; } // off the field's side, or back off the first stone: no stone there
        if (cur && lv.pos > 0 && lv.path[lv.pos - 1][0] === c && lv.path[lv.pos - 1][1] === r) { hopTo(stonePos(c, r)); lv.pos--; return; } // back along the path
        const p = stonePos(c, r); hopTo(p);
        if (lv.path[lv.pos + 1] && lv.path[lv.pos + 1][0] === c && lv.path[lv.pos + 1][1] === r) { lv.pos++; lv.stones[r][c].material = M.walked; ctx.note(523 + lv.pos * 25, 'bell');
          if (lv.pos === lv.path.length - 1) { st.finishIn = .5; } }
        else { st.fallIn = .32; st.fallStone = lv.stones[r][c]; }
      }
      function hopTo(p) { st.from = [st.at[0], st.at[1]]; st.at = [p.x, p.z]; st.hop = .28; ctx.player.face(Math.atan2(p.x - st.from[0], p.z - st.from[1])); if (ctx.player.hop) ctx.player.hop(.28); else ctx.player.clip('jump'); }
      function move(dc, dr) { if (!lv) return; const cur = lv.pos < 0 ? null : lv.path[lv.pos]; if (!cur) { if (dr > 0) { /* from the ledge: the stone ahead of where the Rebel stands */ const c = Math.max(0, Math.min(lv.cols - 1, Math.round((st.at[0] - AT[0]) / P + (lv.cols - 1) / 2) + dc)); stepTo(c, 0); } else if (dc) { st.at = [Math.max(AT[0] - (lv.cols - 1) / 2 * P, Math.min(AT[0] + (lv.cols - 1) / 2 * P, st.at[0] + dc * P)), st.at[1]]; ctx.player.place(st.at[0], st.at[1], 0); } return; }
        stepTo(cur[0] + dc, cur[1] + dr); }
      // the picker
      const hud = document.getElementById('gameHud'), pick = document.createElement('div');
      pick.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(380px,90vw);background:rgba(10,22,28,.94);border:1px solid rgba(140,210,255,.6);border-radius:14px;padding:16px;text-align:center;pointer-events:auto;font:15px/1.4 Georgia,serif;color:#eee';
      pick.innerHTML = `<div style="font:700 13px/1.2 Georgia,serif;letter-spacing:.14em;text-transform:uppercase;color:#9fd8ff;margin-bottom:10px">The Misty Stones</div><div style="margin-bottom:12px;color:#bbb">Only some stones hold. Watch the path glow, then cross it from memory.</div>`
        + `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${LV.map((L, k) => { const open = k <= solvedUpTo, done = k < solvedUpTo; return `<button type="button" data-k="${k}" ${open ? '' : 'disabled'} style="padding:10px 4px;border-radius:9px;border:1px solid ${open ? '#9fd8ff' : '#444'};background:${done ? 'rgba(140,210,255,.2)' : 'rgba(255,255,255,.04)'};color:${open ? '#fff' : '#666'};font:700 15px Georgia,serif;cursor:${open ? 'pointer' : 'default'}">${open ? 'Level ' + (k + 1) : '🔒'}${done ? ' ✓' : ''}</button>`; }).join('')}</div>`;
      pick.querySelectorAll('button[data-k]').forEach(b => b.onclick = (e) => { e.stopPropagation(); b.blur(); choose(+b.dataset.k); });
      function choose(k) { if (st.phase !== 'pick' || k > solvedUpTo || k >= LV.length) return; pick.remove(); build(k); }
      // Restart (the button beside Quit): back on the ledge, the same path shown again from its first stone, no falls yet
      function restart() { if (!lv || (st.phase !== 'show' && st.phase !== 'play')) return; st.hop = 0; st.fallIn = 0; st.finishIn = 0; st.fallStone = null; build(lv.k, lv.path); H.msg('Start again', 1000, 'watch the stones'); }
      hud.appendChild(pick);
      ctx.player.place(AT[0], AT[1] - .2, 0);
      // the camera backs off and looks further out for the longer fields (past 9 rows)
      const far = () => lv ? Math.max(0, (lv.rows - 9) * P) : 0;
      let cam = def.cam || [AT[0] + 1.2, 9.5, AT[1] - 6.5], look = def.look || [AT[0], 0, AT[1] + 6];
      const frameCam = () => { if (def.cam) return; const f = far(); cam = [AT[0] + 1.2, 9.5 + f * .6, AT[1] - 6.5 - f * .35]; look = [AT[0], 0, AT[1] + 6 + f * .5]; };
      ctx.look(cam, look, def.fov || .85);
      H.title(def.title || 'The Misty Stones'); H.score(''); info();
      H.hint('Watch the path, then cross: <kbd>W</kbd>/<kbd>↑</kbd> ahead, <kbd>A</kbd><kbd>D</kbd>/<kbd>←</kbd><kbd>→</kbd> aside, <kbd>S</kbd>/<kbd>↓</kbd> back, or click the next stone.');
      return {
        update(dt) {
          frameCam(); ctx.look(cam, look);
          if (!lv) return;
          lv.nodes.forEach(n => { if (n.metadata?.drift != null) { n.position.x = AT[0] + Math.sin(performance.now() / (2600 + n.metadata.drift * 700) + n.metadata.drift) * .6; } });
          if (st.phase === 'show') { // the path lights stone by stone, then goes dark (walked stones stay lit)
            st.showT += dt; const n = Math.floor(st.showT / (lv.show * .45));
            lv.path.forEach(([c, r], i) => { if (i > lv.pos) lv.stones[r][c].material = i <= n && st.showT < lv.path.length * lv.show * .45 + lv.show ? M.glow : M.stone; });
            if (st.showT >= lv.path.length * lv.show * .45 + lv.show) { lv.path.forEach(([c, r], i) => { if (i > lv.pos) lv.stones[r][c].material = M.stone; }); st.phase = 'play'; }
          }
          if (st.hop > 0) { st.hop = Math.max(0, st.hop - dt); const f = 1 - st.hop / .28, w = ctx.toWorld(st.from[0] + (st.at[0] - st.from[0]) * f, 0, st.from[1] + (st.at[1] - st.from[1]) * f), pr = ctx.player.root; pr.position.x = w.x; pr.position.z = w.z; }
          if (st.fallIn > 0 && (st.fallIn -= dt) <= 0) { // the stone gives way: back to the ledge
            st.fallStone.material = M.sunk; st.fallStone.position.y = -.2; lv.falls++; ctx.sound('splash'); H.msg('The stone sinks!', 1100); info();
            setTimeout(() => { if (st.fallStone) { st.fallStone.position.y = .16; st.fallStone.material = M.stone; } }, 900);
            lv.pos = -1; lv.path.forEach(([c, r]) => { lv.stones[r][c].material = M.stone; }); st.at = [AT[0], AT[1] - .2]; ctx.player.place(st.at[0], st.at[1], 0);
            if (lv.falls >= 3) { st.phase = 'fail'; st.wait = 1.4; } else flashPath(); }
          if (st.finishIn > 0 && (st.finishIn -= dt) <= 0) { hopTo(new V3(AT[0], 0, AT[1] + (lv.rows + 1) * P + .2)); st.phase = 'won'; st.wait = 1.6; ctx.sound('gamewin'); H.msg('Across the mist!', 1400);
            if (lv.k + 1 > solvedUpTo) { solvedUpTo = lv.k + 1; try { localStorage.setItem(KEY, String(solvedUpTo)); } catch (e) {} } }
          if ((st.phase === 'won' || st.phase === 'fail') && (st.wait -= dt) <= 0) {
            const won = st.phase === 'won'; st.phase = 'done'; H.hint('');
            const k = lv.k, score = won ? (SCORE[k] ?? 30 * (k + 1)) + (3 - lv.falls) * 5 : 0;
            ctx.finish({ score, label: 'points', passed: won && score >= (def.pass || 0), solved: won, extra: won ? `Level ${k + 1} crossed with ${lv.falls} fall${lv.falls === 1 ? '' : 's'}.${k + 1 < LV.length ? ` Level ${k + 2} is open.` : ' Every path crossed.'}` : `The mist won on level ${k + 1}.` });
          }
        },
        key(e, down) {
          if (!down || e.repeat) return; const k = e.key.toLowerCase();
          if (st.phase === 'pick') { const n = k === '0' ? 10 : parseInt(k, 10); if (n >= 1 && n <= LV.length) choose(n - 1); return; } // 1-9, 0 = the tenth
          if (st.phase !== 'play') return;
          // the camera looks along +z: left on screen is -x
          if (k === 'w' || k === 'arrowup') move(0, 1); else if (k === 's' || k === 'arrowdown') move(0, -1); else if (k === 'a' || k === 'arrowleft') move(-1, 0); else if (k === 'd' || k === 'arrowright') move(1, 0);
        },
        pointer(evt) {
          if (evt.type !== B.PointerEventTypes.POINTERDOWN || st.phase !== 'play') return;
          const hit = scene.pickWithRay(ctx.ray(), m => !!m.metadata?.stStone); if (hit?.hit) stepTo(...hit.pickedMesh.metadata.stStone);
        },
        restart,
        _test: { st, choose, stepTo, move, get lv() { return lv; } },
        dispose() { pick.remove(); if (lv) lv.nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); }
      };
    }
  };
  window.RebelGames.register('stones', G);
})();
