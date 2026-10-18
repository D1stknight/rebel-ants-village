// Skyline Blocks (Oct 15, Saints of LA): the falling-block cabinet on the block. Pieces of four squares fall into a
// 10 x 20 well; move them (left / right, A / D), turn them (up, W or X; Z the other way), drop them (down = soft,
// Space = hard). A full row clears; clear several at once for more. Every 10 rows the level rises and pieces fall
// faster. The well filling to the top ends the run. Pieces come in shuffled bags of seven; the next one shows on the
// right; a faint ghost shows where the piece will land. Clear 25 rows in one run to clear the cabinet.
// Every square is a thin instance of one box (one draw call for the well, one for the ghost), so a move only rewrites
// a small buffer. def: { lines (rows to clear, default 25), points }
// Oct 17: How to play (the rules) and Restart (a new run: an empty well, level 1, 0 points; the best stays).
// Oct 17 (Miguel: every board game needs an image example and fuller rules): howTo with howto/blocks.png (a stack of real
// pieces, a long piece, its ghost and a Skyline; scratchpad agents/htC/blocks/draw.py + check.py).
(function () {
  const W = 10, Hh = 20, CS = .12;
  const SHAPES = { I: [[0, 1], [1, 1], [2, 1], [3, 1]], O: [[1, 0], [2, 0], [1, 1], [2, 1]], T: [[1, 0], [0, 1], [1, 1], [2, 1]], S: [[1, 0], [2, 0], [0, 1], [1, 1]], Z: [[0, 0], [1, 0], [1, 1], [2, 1]], J: [[0, 0], [0, 1], [1, 1], [2, 1]], L: [[2, 0], [0, 1], [1, 1], [2, 1]] };
  const COL = { I: [.25, .9, 1], O: [1, .85, .2], T: [.75, .35, 1], S: [.35, .95, .45], Z: [1, .3, .35], J: [.3, .5, 1], L: [1, .6, .2] };
  const SPEED = [.8, .72, .63, .55, .47, .38, .3, .22, .15, .1, .08, .07, .06, .05, .04];
  const LINE_PTS = [0, 100, 300, 500, 800];
  function rot(cells, n, k) { let c = cells; for (let i = 0; i < ((k % 4) + 4) % 4; i++) c = c.map(([x, y]) => [n - 1 - y, x]); return c; }
  const G = {
    title: 'Skyline Blocks',
    howTo: { lines: [
      'Clear 25 rows in one run to clear the cabinet (then keep going for points). Press Start (or Enter): pieces of four squares fall one at a time into the well, ten squares wide and twenty high.',
      'A row filled from wall to wall clears, and everything above it drops down a row.',
      '← → (A D) move the piece, ↑ (W or X) turns it and Z (Q) turns it the other way; ↓ (S) drops it faster and Space drops it straight down. Held keys repeat; on a touch screen use the buttons at the bottom right.',
      'A piece that lands can still slide or turn for half a second before it locks in place.',
      'Points: 100 for one row, 300 for two, 500 for three and 800 for four at once (a Skyline), times the level; a soft drop pays 1 a square, a hard drop 2.',
      'Every 10 rows the level rises and the pieces fall faster. The run ends when a new piece has no room at the top. Restart starts a new run (your best stays).',
      'Tip: the next piece shows in the box at the top right, and a faint ghost shows where this one will land. Every seven pieces bring one of each shape, so keep one column open for the long piece.'],
      img: 'howto/blocks.png', caption: 'A long piece drops into the one open column: the ghost shows where it lands, and four full rows clear at once, a Skyline.' },
    start(ctx) {
      const B = ctx.B, H = ctx.HUD, scene = ctx.scene, def = ctx.def, GOAL = def.lines || 25, BEST = 'rebelAntsBlocksBest:' + (def.id || 'blocks');
      const mat = (k, c, em) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(.1, .1, .1); if (em) m.emissiveColor = new B.Color3(...em); return m; });
      const cabM = mat('cabinet', [.12, .08, .2], [.04, .02, .07]), trimM = mat('trim', [.85, .65, .15], [.35, .25, .05]), wellM = mat('well', [.02, .02, .05], [.01, .01, .03]);
      const nodes = [], keep = n => { n.parent = n.parent || ctx.frame; ctx.add(n); nodes.push(n); if (n.isPickable !== undefined) n.isPickable = false; return n; };
      const WW = W * CS, WH = Hh * CS, BY = .75; // well size and the height of its floor
      { const cab = keep(B.MeshBuilder.CreateBox('bkCab', { width: WW + 1.25, height: WH + 1.1, depth: .6 }, scene)); cab.material = cabM; cab.position.set(.28, BY + WH / 2 - .1, .32);
        const back = keep(B.MeshBuilder.CreatePlane('bkWell', { width: WW, height: WH }, scene)); back.material = wellM; back.position.set(0, BY + WH / 2, .015);
        for (const [x, y, w, h] of [[-WW / 2 - .03, BY + WH / 2, .06, WH + .12], [WW / 2 + .03, BY + WH / 2, .06, WH + .12], [0, BY - .03, WW + .12, .06], [0, BY + WH + .03, WW + .12, .06]]) { const t = keep(B.MeshBuilder.CreateBox('bkTrim', { width: w, height: h, depth: .08 }, scene)); t.material = trimM; t.position.set(x, y, 0); }
        const nb = keep(B.MeshBuilder.CreatePlane('bkNextBox', { width: 5 * CS, height: 4 * CS }, scene)); nb.material = wellM; nb.position.set(WW / 2 + .42, BY + WH - .35, .015); }
      // the squares: one box, thin instances (matrix + colour); a second box with see-through colour for the ghost
      const cellM = new B.StandardMaterial('bkCellMat', scene); cellM.specularColor = new B.Color3(.2, .2, .2); cellM.emissiveColor = new B.Color3(.35, .35, .35);
      const cell = keep(B.MeshBuilder.CreateBox('bkCell', { size: CS * .92, depth: CS * .5 }, scene)); cell.material = cellM; cell.isVisible = true; cell.alwaysSelectAsActiveMesh = true;
      const ghostM = new B.StandardMaterial('bkGhostMat', scene); ghostM.alpha = .32; ghostM.emissiveColor = new B.Color3(.85, .85, .95); ghostM.disableLighting = true;
      const ghost = keep(B.MeshBuilder.CreateBox('bkGhost', { size: CS * .9, depth: CS * .2 }, scene)); ghost.material = ghostM; ghost.alwaysSelectAsActiveMesh = true;
      const cellPos = (x, y) => [-WW / 2 + (x + .5) * CS, BY + (Hh - 1 - y + .5) * CS]; // y 0 = top row
      const st = { phase: 'ready', t: 0, fall: 0, lock: 0, held: {}, rep: {}, flash: null, wt: 0 };
      let grid, cur, bag, nextT, score, lines, level, drops, startT;
      function newBag() { const b = Object.keys(SHAPES); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
      function take() { if (!bag.length) bag = newBag(); return bag.pop(); }
      const cellsOf = p => rot(SHAPES[p.t], p.t === 'I' ? 4 : p.t === 'O' ? 4 : 3, p.t === 'O' ? 0 : p.r).map(([x, y]) => [x + p.x, y + p.y]);
      const fits = p => cellsOf(p).every(([x, y]) => x >= 0 && x < W && y < Hh && (y < 0 || !grid[y * W + x]));
      function spawn() { const t = nextT; nextT = take(); cur = { t, r: 0, x: t === 'O' ? 3 : 3, y: t === 'I' ? -1 : 0 }; st.lock = 0; st.fall = 0;
        if (!fits(cur)) { cur.y -= 1; if (!fits(cur)) { over(); return false; } } render(); return true; }
      function reset() { grid = new Array(W * Hh).fill(null); bag = newBag(); nextT = take(); score = 0; lines = 0; level = 1; drops = 0; startT = 0; st.flash = null; spawn(); info(); }
      let best = 0; try { best = Number(localStorage.getItem(BEST)) || 0; } catch (e) {}
      const info = () => { H.score(score); H.info(`Level ${level} · rows ${lines} / ${GOAL} · next ${nextT || '-'} · best ${best}`); };
      // thin instance buffers: filled squares + the falling piece + the next piece; the ghost separately
      const mBuf = new Float32Array(16 * (W * Hh + 8)), cBuf = new Float32Array(4 * (W * Hh + 8)), gBuf = new Float32Array(16 * 4);
      const M = B.Matrix, tmp = new M();
      function put(buf, k, x, y, z) { M.TranslationToRef(x, y, z, tmp); tmp.copyToArray(buf, k * 16); }
      function render() {
        let k = 0; const flashRows = st.flash ? st.flash.rows : null, blink = st.flash ? Math.floor(st.flash.t * 16) % 2 : 0;
        for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) { const t = grid[y * W + x]; if (!t) continue; const [px, py] = cellPos(x, y); put(mBuf, k, px, py, -.03);
          const c = flashRows && flashRows.includes(y) && blink ? [1, 1, 1] : COL[t]; cBuf.set([c[0], c[1], c[2], 1], k * 4); k++; }
        if (cur && st.phase === 'play' && !st.flash) { for (const [x, y] of cellsOf(cur)) { if (y < 0) continue; const [px, py] = cellPos(x, y); put(mBuf, k, px, py, -.03); const c = COL[cur.t]; cBuf.set([c[0], c[1], c[2], 1], k * 4); k++; } }
        if (nextT) { const nc = rot(SHAPES[nextT], 4, 0), ox = WW / 2 + .42 - (nextT === 'I' ? 2 : nextT === 'O' ? 2 : 1.5) * CS, oy = BY + WH - .35 + CS * (nextT === 'I' ? 0 : .5);
          for (const [x, y] of nc) { put(mBuf, k, ox + (x + .5) * CS, oy - (y - .5) * CS, -.03); const c = COL[nextT]; cBuf.set([c[0], c[1], c[2], 1], k * 4); k++; } }
        cell.thinInstanceSetBuffer('matrix', mBuf.subarray(0, k * 16), 16, false); cell.thinInstanceSetBuffer('color', cBuf.subarray(0, k * 4), 4, false); cell.thinInstanceCount = k;
        let gk = 0; if (cur && st.phase === 'play' && !st.flash) { const gp = { ...cur }; while (fits({ ...gp, y: gp.y + 1 })) gp.y++; if (gp.y !== cur.y) for (const [x, y] of cellsOf(gp)) { if (y < 0) continue; const [px, py] = cellPos(x, y); put(gBuf, gk++, px, py, -.02); } }
        ghost.thinInstanceSetBuffer('matrix', gBuf.subarray(0, Math.max(1, gk) * 16), 16, false); ghost.thinInstanceCount = gk; ghost.isVisible = gk > 0;
      }
      function move(dx) { if (st.phase !== 'play' || st.flash) return false; const p = { ...cur, x: cur.x + dx }; if (!fits(p)) return false; cur = p; st.lock = Math.min(st.lock, .25); render(); return true; }
      function turn(d) { if (st.phase !== 'play' || st.flash || cur.t === 'O') return false; for (const kx of [0, -1, 1, -2, 2]) for (const ky of [0, -1]) { const p = { ...cur, r: cur.r + d, x: cur.x + kx, y: cur.y + ky }; if (fits(p)) { cur = p; st.lock = Math.min(st.lock, .25); ctx.note(700, 'lantern'); render(); return true; } } return false; }
      function soft() { if (st.phase !== 'play' || st.flash) return false; const p = { ...cur, y: cur.y + 1 }; if (!fits(p)) return false; cur = p; score++; st.fall = 0; render(); info(); return true; }
      function hard() { if (st.phase !== 'play' || st.flash) return; let n = 0; while (fits({ ...cur, y: cur.y + 1 })) { cur.y++; n++; } score += 2 * n; lockPiece(); }
      function lockPiece() { for (const [x, y] of cellsOf(cur)) { if (y < 0) { over(); return; } grid[y * W + x] = cur.t; } drops++; ctx.note(260, 'lantern');
        const full = []; for (let y = 0; y < Hh; y++) { let ok = true; for (let x = 0; x < W; x++) if (!grid[y * W + x]) { ok = false; break; } if (ok) full.push(y); }
        if (full.length) { st.flash = { rows: full, t: 0 }; score += LINE_PTS[full.length] * level; ctx.note(500 + full.length * 120, 'bell'); if (full.length === 4) H.msg('Skyline!', 900, 'four rows at once'); render(); info(); return; }
        cur = null; spawn(); info(); }
      function collapse() { const rows = st.flash.rows; st.flash = null; const keepRows = []; for (let y = 0; y < Hh; y++) if (!rows.includes(y)) keepRows.push(grid.slice(y * W, y * W + W));
        grid = [...Array(rows.length).fill(0).flatMap(() => new Array(W).fill(null)), ...keepRows.flat()]; lines += rows.length;
        const nl = 1 + Math.floor(lines / 10); if (nl > level) { level = nl; H.msg(`Level ${level}`, 900, 'faster now'); }
        if (lines >= GOAL && !st.goal) { st.goal = true; ctx.sound('gamewin'); H.msg(`${GOAL} rows`, 1400, 'the cabinet is cleared: keep going for points'); }
        spawn(); info(); }
      function over() { if (st.phase !== 'play') return; st.phase = 'over'; st.wt = 0; cur = null; pads.style.display = 'none'; if (score > best) { best = score; try { localStorage.setItem(BEST, String(score)); } catch (e) {} } ctx.sound(lines >= GOAL ? 'gamewin' : 'thock'); H.msg('Topped out', 1500, `${lines} rows · ${score} points`); render(); info(); }
      const hud = document.getElementById('gameHud');
      const pads = document.createElement('div');
      pads.style.cssText = 'position:absolute;bottom:62px;right:14px;display:none;grid-template-columns:repeat(3,52px);grid-template-rows:repeat(2,44px);gap:5px;pointer-events:auto';
      const pad = (t, area, down, up) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.style.cssText = `grid-area:${area};border-radius:9px;border:1px solid #c79bff;background:rgba(24,10,40,.88);color:#f3e6ff;font:700 18px system-ui;cursor:pointer;touch-action:none`;
        b.onpointerdown = (e) => { e.stopPropagation(); e.preventDefault(); down(); }; if (up) { b.onpointerup = b.onpointerleave = (e) => { e.stopPropagation(); up(); }; } pads.appendChild(b); return b; };
      const holdPad = k => [() => press(k, true), () => press(k, false)];
      pad('↻', '1 / 2', () => turn(1)); pad('⤓', '1 / 3', () => hard()); pad('←', '2 / 1', ...holdPad('left')); pad('↓', '2 / 2', ...holdPad('down')); pad('→', '2 / 3', ...holdPad('right'));
      const startBtn = document.createElement('button'); startBtn.type = 'button'; startBtn.textContent = 'Start'; startBtn.style.cssText = 'position:absolute;left:50%;top:58%;transform:translate(-50%,-50%);padding:12px 28px;border-radius:12px;border:1px solid #c79bff;background:rgba(40,14,70,.92);color:#fff;font:800 18px system-ui;letter-spacing:.08em;cursor:pointer;pointer-events:auto';
      startBtn.onclick = (e) => { e.stopPropagation(); startBtn.blur(); begin(); };
      function begin() { if (st.phase !== 'ready') return; startBtn.remove(); st.phase = 'play'; pads.style.display = 'grid'; reset(); H.msg('Go', 700, `clear ${GOAL} rows`); }
      // Restart (the button beside Quit): a new run (the best stays as it was); before Start or once topped out it waits
      function restart() { if (st.phase !== 'play') return; st.held = {}; st.rep = {}; st.goal = false; reset(); H.msg('Go', 700, `a new run: clear ${GOAL} rows`); }
      hud.append(pads, startBtn);
      // held keys repeat on their own (left / right / down), after a short wait
      function press(k, down) { if (down) { if (st.held[k]) return; st.held[k] = true; st.rep[k] = .17; if (k === 'left') move(-1); else if (k === 'right') move(1); else if (k === 'down') soft(); } else st.held[k] = false; }
      const cam = [.12, BY + WH / 2 + .15, -4.3], at = [.12, BY + WH / 2 - .02, 0];
      ctx.player.place(-1.3, -1.4, 0); ctx.look(cam, at, def.fov || .8);
      grid = new Array(W * Hh).fill(null); cur = null; nextT = null; render();
      H.title(def.title || 'Skyline Blocks'); H.score(''); H.info(`Clear ${GOAL} rows in one run · best ${best}`);
      H.hint('<kbd>←</kbd><kbd>→</kbd> move, <kbd>↑</kbd> / <kbd>X</kbd> turn (<kbd>Z</kbd> back), <kbd>↓</kbd> drop faster, <kbd>Space</kbd> drop. Press <kbd>Enter</kbd> or Start.');
      return {
        update(dt) {
          ctx.look(cam, at); st.t += dt;
          if (st.phase === 'play') {
            if (st.flash) { st.flash.t += dt; render(); if (st.flash.t > .3) collapse(); }
            else {
              for (const k of ['left', 'right', 'down']) if (st.held[k]) { st.rep[k] -= dt; while (st.rep[k] <= 0) { st.rep[k] += k === 'down' ? .035 : .05; if (k === 'left') move(-1); else if (k === 'right') move(1); else soft(); } }
              if (cur) { const grounded = !fits({ ...cur, y: cur.y + 1 });
                if (grounded) { st.lock += dt; if (st.lock > .5) lockPiece(); }
                else { st.fall += dt; const sp = SPEED[Math.min(SPEED.length - 1, level - 1)]; while (st.fall >= sp && cur && fits({ ...cur, y: cur.y + 1 })) { st.fall -= sp; cur.y++; render(); } } }
            }
          }
          if (st.phase === 'over' && (st.wt += dt) > 1.8) { st.phase = 'done'; H.hint('');
            ctx.finish({ score, label: 'points', passed: lines >= GOAL, solved: lines >= GOAL, extra: `${lines} rows, level ${level}, ${drops} pieces. Best here ${best}.${lines >= GOAL ? '' : ` Clear ${GOAL} rows in one run to clear the cabinet.`}` }); }
        },
        key(e, down) {
          const k = e.key.toLowerCase();
          if (st.phase === 'ready') { if (down && (k === 'enter' || k === ' ')) begin(); return; }
          if (st.phase !== 'play') return;
          if (k === 'arrowleft' || k === 'a') press('left', down); else if (k === 'arrowright' || k === 'd') press('right', down); else if (k === 'arrowdown' || k === 's') press('down', down);
          else if (down && !e.repeat) { if (k === 'arrowup' || k === 'w' || k === 'x') turn(1); else if (k === 'z' || k === 'q') turn(-1); else if (k === ' ') hard(); }
        },
        pointer() {},
        restart,
        _test: { st, begin, move, turn, soft, hard, press, fits, cellsOf, get grid() { return grid; }, set grid(g) { grid = g; render(); }, get cur() { return cur; }, setCur(p) { cur = p; render(); }, get lines() { return lines; }, get score() { return score; }, get level() { return level; }, over, render, W, Hh },
        dispose() { pads.remove(); startBtn.remove(); nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); try { cellM.dispose(); ghostM.dispose(); } catch (e) {} }
      };
    }
  };
  window.RebelGames.register('blocks', G);
})();
