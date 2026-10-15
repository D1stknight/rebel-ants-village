// The Stone Court (Oct 15, Ronin): block-push puzzles on a stone board. Walk the Rebel square by square (the arrows /
// WASD or the pads) and push the debt stones onto the red hands; a stone can only be pushed, never pulled, and two in a
// row will not move. U (or Z) undoes a step, R starts the level again. Six levels, from a five-step warm-up to seven
// stones; a level opens when the one before it is solved (remembered on this device). Score: the level x 20, plus 10
// when it is solved in close to the fewest steps.
// def: { at: [x, z] (frame coords of the board's middle), cell: 1.3, levels: [[rows...]...], best: [fewest steps per level], pass, points }
(function () {
  const LEVELS = [
    ['#######', '#     #', '# $ . #', '#  @  #', '#######'],
    ['########', '#   #  #', '# $  $ #', '#. ## .#', '#  @   #', '########'],
    ['  #####', '###   #', '#  $# #', '# #. .#', '# $ $ #', '#. @ ##', '######'],
    ['#########', '#  .#   #', '# $ $ # #', '#  #.@  #', '##   ## #', ' # $  . #', ' ########'],
    [' ######', ' #    #', '##$## #', '#  .  #', '# $#$ #', '#. @ .#', '#######'],
    ['  #####', '###   #', '#.@$  #', '### $.#', '#.##$ #', '# # . ##', '#$ *$$.#', '#   .  #', '########']
  ];
  const BEST = [5, 19, 25, 36, 35, 34];
  const G = {
    title: 'The Stone Court',
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const LV = def.levels || LEVELS, BS = def.best || BEST, CELL = def.cell || 1.3, AT = def.at || [0, 0];
      const KEY = 'rebelAntsPushProgress:' + (def.id || 'push');
      let solvedUpTo = 0; try { solvedUpTo = Math.max(0, Math.min(LV.length, Number(localStorage.getItem(KEY)) || 0)); } catch (e) {}
      const mat = (k, c, em, spec = .08) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(spec, spec, spec); if (em) m.emissiveColor = new B.Color3(...em); return m; });
      const floorM = mat('floor', [.32, .3, .3], [.05, .05, .05]), wallM = mat('wall', [.13, .12, .14], [.02, .02, .03]), stoneM = mat('stone', [.5, .48, .46], [.08, .08, .08], .15), litM = mat('stoneLit', [.75, .2, .18], [.55, .08, .06], .2);
      const handM = ctx.mat('hand', n => { const m = new B.StandardMaterial(n, scene); const t = new B.DynamicTexture(n + 'T', { width: 128, height: 128 }, scene, true); const g = t.getContext(); g.fillStyle = '#2a0f10'; g.fillRect(0, 0, 128, 128); t.update();
        const img = new Image(); img.crossOrigin = 'anonymous'; img.onload = () => { const c = document.createElement('canvas'); c.width = c.height = 100; const cg = c.getContext('2d'); cg.drawImage(img, 0, 0, 100, 100); cg.globalCompositeOperation = 'source-in'; cg.fillStyle = '#e0322a'; cg.fillRect(0, 0, 100, 100); g.drawImage(c, 14, 14); t.update(); }; img.src = 'assets/brand/factions/ronin.png';
        m.diffuseTexture = t; m.emissiveTexture = t; m.specularColor = new B.Color3(0, 0, 0); return m; });
      const src = (m, mt) => { m.material = mt; m.isPickable = false; m.isVisible = false; ctx.add(m); return m; };
      const sFloor = src(B.MeshBuilder.CreateBox('pushFloor', { width: CELL * .98, height: .12, depth: CELL * .98 }, scene), floorM);
      const sWall = src(B.MeshBuilder.CreateBox('pushWall', { width: CELL, height: 1.1, depth: CELL }, scene), wallM);
      const sHand = src(B.MeshBuilder.CreateGround('pushHand', { width: CELL * .82, height: CELL * .82 }, scene), handM);
      const sStone = src(B.MeshBuilder.CreateSphere('pushStone', { diameterX: CELL * .86, diameterY: CELL * .7, diameterZ: CELL * .86, segments: 10 }, scene), stoneM);
      const sLit = src(B.MeshBuilder.CreateSphere('pushStoneLit', { diameterX: CELL * .86, diameterY: CELL * .7, diameterZ: CELL * .86, segments: 10 }, scene), litM);
      let board = null; // { W, H, wall[], goal[], inside[], nodes[], stones: [{ i, m, lit }], p, moves, hist[] }
      const st = { phase: 'pick', level: 0, moving: null, solvedAt: 0 };
      const cellPos = (i) => { const x = i % board.W, y = Math.floor(i / board.W); return new V3(AT[0] + (x - (board.W - 1) / 2) * CELL, 0, AT[1] + ((board.H - 1) / 2 - y) * CELL); };
      function build(k) {
        if (board) board.nodes.forEach(n => { try { n.dispose(); } catch (e) {} });
        const rows = LV[k], W = Math.max(...rows.map(r => r.length)), Hh = rows.length;
        const b = { W, H: Hh, wall: [], goal: [], inside: [], nodes: [], stones: [], p: -1, moves: 0, hist: [], k };
        rows.forEach((r, y) => { for (let x = 0; x < W; x++) { const c = r[x] || ' ', i = y * W + x; b.wall[i] = c === '#'; b.goal[i] = '.*+'.includes(c); if ('$*'.includes(c)) b.stones.push({ i }); if ('@+'.includes(c)) b.p = i; } });
        // the floor: cells reached from the Rebel's square without crossing a wall
        const q = [b.p]; b.inside[b.p] = true; while (q.length) { const i = q.pop(); for (const d of [-W, W, -1, 1]) { const j = i + d; if (j < 0 || j >= W * Hh || b.wall[j] || b.inside[j] || (d === -1 && i % W === 0) || (d === 1 && i % W === W - 1)) continue; b.inside[j] = true; q.push(j); } }
        board = b;
        const put = (s, i, y) => { const m = s.createInstance('pushPart'); m.parent = ctx.frame; ctx.add(m); const p = cellPos(i); m.position.set(p.x, y, p.z); b.nodes.push(m); return m; };
        for (let i = 0; i < W * Hh; i++) {
          if (b.inside[i]) { put(sFloor, i, .06); if (b.goal[i]) put(sHand, i, .125); }
          else if (b.wall[i]) { const x = i % W, y = Math.floor(i / W); const nearInside = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]].some(([dx, dy]) => { const xx = x + dx, yy = y + dy; return xx >= 0 && yy >= 0 && xx < W && yy < Hh && b.inside[yy * W + xx]; }); if (nearInside) put(sWall, i, .55); }
        }
        b.stones.forEach(s => { s.m = put(b.goal[s.i] ? sLit : sStone, s.i, .12 + CELL * .35); s.lit = b.goal[s.i]; });
        const pp = cellPos(b.p); ctx.player.place(pp.x, pp.z, 0);
        const span = Math.max(W, Hh) * CELL;
        st.cam = [AT[0], span * .95 + 2.5, AT[1] - span * .72 - 1.5]; st.at = [AT[0], 0, AT[1] + .3];
        info();
      }
      const info = () => H.info(board ? `Level ${board.k + 1} / ${LV.length} · steps ${board.moves} · fewest ${BS[board.k] ?? '?'}` : 'Pick a level');
      const solved = () => board.stones.every(s => board.goal[s.i]);
      function relit(s) { const want = !!board.goal[s.i]; if (want === s.lit) return; const p = s.m.position.clone(); s.m.dispose(); s.m = (want ? sLit : sStone).createInstance('pushPart'); s.m.parent = ctx.frame; ctx.add(s.m); s.m.position.copyFrom(p); board.nodes.push(s.m); s.lit = want; }
      function step(dx, dy) {
        if (st.phase !== 'play' || st.moving) return;
        const b = board, x = b.p % b.W, y = Math.floor(b.p / b.W), nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= b.W || ny >= b.H) return;
        const t = ny * b.W + nx; if (b.wall[t] || !b.inside[t]) return bump(dx, dy);
        const s = b.stones.find(s => s.i === t); let pushed = null;
        if (s) { const tx = nx + dx, ty = ny + dy, t2 = ty * b.W + tx; if (tx < 0 || ty < 0 || tx >= b.W || ty >= b.H || b.wall[t2] || !b.inside[t2] || b.stones.some(o => o.i === t2)) return bump(dx, dy); pushed = { s, from: t, to: t2 }; }
        b.hist.push({ p: b.p, stones: b.stones.map(o => o.i) });
        const yaw = dx > 0 ? Math.PI / 2 : dx < 0 ? -Math.PI / 2 : dy < 0 ? 0 : Math.PI;
        st.moving = { from: cellPos(b.p), to: cellPos(t), t: 0, yaw, pushed, sFrom: pushed ? cellPos(pushed.from) : null, sTo: pushed ? cellPos(pushed.to) : null };
        b.p = t; if (pushed) { pushed.s.i = pushed.to; ctx.sound('thock'); }
        b.moves++; info();
        ctx.player.clip('walk', { loop: true });
      }
      function bump(dx, dy) { ctx.player.face(dx > 0 ? Math.PI / 2 : dx < 0 ? -Math.PI / 2 : dy < 0 ? 0 : Math.PI); }
      function undo() {
        if (st.phase !== 'play' || st.moving || !board.hist.length) return;
        const h = board.hist.pop(); board.p = h.p; board.stones.forEach((s, k) => { s.i = h.stones[k]; const p = cellPos(s.i); s.m.position.x = p.x; s.m.position.z = p.z; relit(s); });
        const pp = cellPos(board.p); ctx.player.place(pp.x, pp.z); board.moves = Math.max(0, board.moves - 1); info();
      }
      function restart() { if (st.phase !== 'play' || st.moving) return; build(board.k); H.msg('Again', 600); }
      // the level picker (and the pads for phones)
      const hud = document.getElementById('gameHud');
      const pick = document.createElement('div');
      pick.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(380px,90vw);background:rgba(12,10,14,.94);border:1px solid rgba(224,50,42,.6);border-radius:14px;padding:16px;text-align:center;pointer-events:auto;font:15px/1.4 Georgia,serif;color:#eee';
      const drawPick = () => { pick.innerHTML = `<div style="font:700 13px/1.2 Georgia,serif;letter-spacing:.14em;text-transform:uppercase;color:#e0322a;margin-bottom:10px">The Stone Court</div><div style="margin-bottom:12px;color:#bbb">Push every debt stone onto a red hand.</div>`
        + `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${LV.map((_, k) => { const open = k <= solvedUpTo, done = k < solvedUpTo; return `<button type="button" data-k="${k}" ${open ? '' : 'disabled'} style="padding:10px 4px;border-radius:9px;border:1px solid ${open ? '#e0322a' : '#444'};background:${done ? 'rgba(224,50,42,.25)' : 'rgba(255,255,255,.04)'};color:${open ? '#fff' : '#666'};font:700 16px Georgia,serif;cursor:${open ? 'pointer' : 'default'}">${open ? k + 1 : '🔒'}${done ? ' ✓' : ''}</button>`; }).join('')}</div>`;
        pick.querySelectorAll('button[data-k]').forEach(b => b.onclick = (e) => { e.stopPropagation(); b.blur(); choose(+b.dataset.k); }); };
      function choose(k) { if (st.phase !== 'pick' || k > solvedUpTo || k >= LV.length) return; pick.remove(); st.phase = 'play'; build(k); pads.style.display = 'grid'; H.msg(`Level ${k + 1}`, 900, k >= 4 ? 'a hard one' : ''); }
      const pads = document.createElement('div');
      pads.style.cssText = 'position:absolute;bottom:62px;right:16px;display:none;grid-template-columns:repeat(3,46px);grid-template-rows:repeat(3,40px);gap:5px;pointer-events:auto';
      const pad = (t, area, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.style.cssText = `grid-area:${area};border-radius:8px;border:1px solid #c9473f;background:rgba(20,10,12,.82);color:#ffe0dc;font:700 16px Georgia,serif;cursor:pointer`; b.onclick = (e) => { e.stopPropagation(); b.blur(); fn(); }; pads.appendChild(b); };
      pad('↑', '1 / 2', () => step(0, -1)); pad('←', '2 / 1', () => step(-1, 0)); pad('→', '2 / 3', () => step(1, 0)); pad('↓', '3 / 2', () => step(0, 1)); pad('↶', '1 / 1', undo); pad('⟲', '1 / 3', restart);
      hud.append(pick, pads);
      drawPick();
      // the camera before a level: over the middle of the court
      st.cam = [AT[0], 11, AT[1] - 9.5]; st.at = [AT[0], 0, AT[1]];
      ctx.look(st.cam, st.at, def.fov || .8);
      H.title(def.title || 'The Stone Court'); H.score(''); info();
      H.hint('Walk with the arrows / <kbd>WASD</kbd> and push the stones onto the red hands. <kbd>U</kbd> undo, <kbd>R</kbd> start again.');
      const inst = {
        update(dt) {
          ctx.look(st.cam, st.at);
          const m = st.moving;
          if (m) {
            m.t += dt / .17; const u = Math.min(1, m.t), e = u * u * (3 - 2 * u);
            const p = V3.Lerp(m.from, m.to, e); ctx.player.place(p.x, p.z, m.yaw);
            if (m.pushed) { const sp = V3.Lerp(m.sFrom, m.sTo, e); m.pushed.s.m.position.x = sp.x; m.pushed.s.m.position.z = sp.z; }
            if (u >= 1) { st.moving = null; if (m.pushed) relit(m.pushed.s); ctx.player.idle();
              if (solved()) { st.phase = 'solved'; st.solvedAt = 1.4; ctx.sound('gamewin'); H.msg('Solved!', 1300, `${board.moves} steps`); pads.style.display = 'none';
                if (board.k + 1 > solvedUpTo) { solvedUpTo = board.k + 1; try { localStorage.setItem(KEY, String(solvedUpTo)); } catch (e) {} } } }
          }
          if (st.phase === 'solved' && (st.solvedAt -= dt) <= 0) {
            st.phase = 'done'; H.hint('');
            const k = board.k, best = BS[k] || board.moves, score = (k + 1) * 20 + (board.moves <= Math.ceil(best * 1.2) ? 10 : 0);
            ctx.finish({ score, label: 'points', extra: `Level ${k + 1} solved in ${board.moves} steps (the fewest is ${best}).${k + 1 < LV.length ? ` Level ${k + 2} is open.` : ' Every level solved.'}` });
          }
        },
        key(e, down) {
          if (!down || e.repeat) return; const k = e.key.toLowerCase();
          if (st.phase === 'pick') { const n = parseInt(k, 10); if (n >= 1 && n <= LV.length) choose(n - 1); return; }
          if (k === 'arrowup' || k === 'w') step(0, -1); else if (k === 'arrowdown' || k === 's') step(0, 1); else if (k === 'arrowleft' || k === 'a') step(-1, 0); else if (k === 'arrowright' || k === 'd') step(1, 0);
          else if (k === 'u' || k === 'z' || k === 'backspace') undo(); else if (k === 'r') restart();
        },
        pointer() {},
        _test: { st, step, undo, choose, get board() { return board; }, solved: () => board && solved() },
        dispose() { pick.remove(); pads.remove(); if (board) board.nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); }
      };
      return inst;
    }
  };
  window.RebelGames.register('push', G);
})();
