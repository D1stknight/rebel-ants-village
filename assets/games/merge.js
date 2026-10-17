// Banana Merge (Oct 15, Chumpz): slide every crate on the dock board one way (arrows / WASD, a swipe, or the arrow
// buttons); two crates with the same number that bump together merge into one with their sum, and a new 2 (or 4)
// crate lands after each move. Merges score their new number. The game ends when no slide changes the board; reach
// the 2048 Golden Banana if you can. Three boards: 4 x 4 (classic), 5 x 5 (roomy), 3 x 3 (the hard one, to 256).
// Crates are small meshes sharing one material per number (made when first needed), so a slide moves meshes and
// never redraws a texture. def: { levels: [{ n | rows + cols, goal, name, rocks, slides, note }], pass (score), points }
// Oct 17: How to play (the rules + one slide worked through, howto/merge.png) and Restart (a new game on the same
// board: two fresh crates, score and slides at 0; the board's best score stays as it was). Ten boards: oblong ones,
// pilings (fixed posts: a run of squares ends at one) and a slide limit; each board's goal reached is kept
// (rebelAntsMergeGoal, a ✓ on the list) and offers the next board, while the score still clears the game.
(function () {
  // Oct 17: ten boards, the first three as they were, then seven from easier to harder: { n (square) or rows + cols,
  // goal, name, rocks: [[r, c]] pilings, slides: a slide limit, note: what the picker says about it }. The share of
  // runs an expectimax bot gets to the goal (scratchpad agents/lvD/merge/sim.mjs, its own slide rules: shares.txt)
  const LEVELS = [{ n: 4, goal: 2048, name: 'The Dock' }, { n: 5, goal: 4096, name: 'The Big Dock' }, { n: 3, goal: 256, name: 'The Rowboat' },
    { rows: 3, cols: 4, goal: 512, name: 'The Jetty' }, { rows: 2, cols: 6, goal: 256, name: 'The Long Pier' },
    { n: 4, goal: 1024, rocks: [[3, 3]], name: 'The Bait Shop', note: 'a corner piling' },
    { n: 4, goal: 1024, rocks: [[0, 0], [3, 3]], name: 'The Boathouse', note: 'two corner pilings' },
    { n: 4, goal: 1024, rocks: [[1, 1]], name: 'The Mooring', note: 'a piling inside' },
    { n: 4, goal: 512, slides: 256, name: 'The Fish Market', note: 'in 256 slides' },
    { n: 3, goal: 512, name: 'The Lifeboat' }];
  const TILE = { 2: '#f3e3b0', 4: '#f1d68a', 8: '#f2b05c', 16: '#ef8f45', 32: '#ea6c3c', 64: '#e2462e', 128: '#ead061', 256: '#e8c94c', 512: '#e4c03a', 1024: '#e2b827', 2048: '#ffd21a', 4096: '#9be35a', 8192: '#4ad0c8' };
  const NAMES = { 2: 'banana', 4: 'bunch', 8: 'hand', 16: 'crate', 32: 'barrel', 64: 'cart', 128: 'boat', 256: 'ship', 512: 'fleet', 1024: 'island', 2048: 'Golden Banana' };
  const SLIDE = .13;
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r); g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath(); }
  const G = {
    title: 'Banana Merge',
    howTo: { lines: [
      'Merge crates into bigger ones until you make the board\'s goal crate (2048 on The Dock). Every merge adds the new crate\'s number to your score.',
      'A slide moves every crate on the board as far as it can go one way: up, down, left or right.',
      'Two crates with the same number that bump together merge into one with their sum. A crate merges once per slide: four 2s in a row make two 4s, not an 8.',
      'After every slide a new crate lands on a free square: a 2, now and then a 4.',
      'Ten boards of different shapes. Some have pilings, round posts that never move: crates stop against them and never merge across them. The Fish Market closes after 256 slides.',
      'The run ends when no slide can change the board (or the slides run out). Bank it ends it at any time and keeps your score; a ✓ on the board list marks a goal reached.',
      'Slide with the arrows or W A S D, a swipe, or the arrow buttons. Restart begins the same board again with two fresh crates.',
      'Tip: keep your biggest crate in one corner and slide mostly two ways (say down and left), so it never has to leave its corner.'],
      img: 'howto/merge.png', caption: 'Slide right: the two 8 crates merge into a 16 (+16 points), the left 2 stops against the piling (no merging across it), and a new 2 lands.' },
    start(ctx) {
      const B = ctx.B, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const LV = def.levels || LEVELS;
      const mat = (k, c, em) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(.05, .05, .05); if (em) m.emissiveColor = new B.Color3(...em); return m; });
      const woodM = mat('dock', [.45, .3, .18], [.1, .07, .04]);
      const nodes = [], keep = n => { n.parent = n.parent || ctx.frame; ctx.add(n); nodes.push(n); if (n.isPickable !== undefined) n.isPickable = false; return n; };
      const S = 3.6, TY = .9, MG = .12, GAPW = .07;
      { const t = keep(B.MeshBuilder.CreateBox('mgTable', { width: S + .5, height: .12, depth: S + .5 }, scene)); t.material = woodM; t.position.y = TY - .06;
        for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const l = keep(B.MeshBuilder.CreateBox('mgLeg', { width: .14, height: TY - .12, depth: .14 }, scene)); l.material = woodM; l.position.set(x * (S / 2), (TY - .12) / 2, z * (S / 2)); } }
      // the board picture (drawn once per board) and one material per crate number
      const TEX = 512, tex = new B.DynamicTexture('mgTex', { width: TEX, height: TEX }, scene, true); tex.hasAlpha = false;
      const boardM = new B.StandardMaterial('mgBoardMat', scene); boardM.diffuseTexture = tex; boardM.emissiveTexture = tex; boardM.emissiveColor = new B.Color3(.6, .6, .6); boardM.diffuseColor = new B.Color3(.55, .55, .55); boardM.specularColor = new B.Color3(0, 0, 0);
      const board = keep(B.MeshBuilder.CreateGround('mgBoard', { width: S, height: S }, scene)); board.material = boardM; board.position.y = TY + .005;
      const tileMats = {};
      function tileMat(v) { if (tileMats[v]) return tileMats[v]; const Z = 256, t = new B.DynamicTexture('mgTileTex' + v, { width: Z, height: Z }, scene, true); t.hasAlpha = true;
        const g = t.getContext(); g.clearRect(0, 0, Z, Z); rr(g, 6, 6, Z - 12, Z - 12, 34); g.fillStyle = TILE[v] || '#3cc'; g.fill(); g.lineWidth = 8; g.strokeStyle = 'rgba(70,40,10,.45)'; g.stroke();
        g.fillStyle = v <= 4 ? '#6a4a20' : '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `bold ${Math.round(Z * (v >= 1024 ? .3 : v >= 128 ? .36 : .44))}px Georgia, serif`; g.fillText(String(v), Z / 2, Z * .45);
        if (NAMES[v]) { g.font = `${Math.round(Z * .12)}px Georgia, serif`; g.fillStyle = v <= 4 ? 'rgba(90,60,20,.8)' : 'rgba(255,255,255,.9)'; g.fillText(NAMES[v], Z / 2, Z * .79); } t.update();
        const m = new B.StandardMaterial('mgTileMat' + v, scene); m.diffuseTexture = t; m.emissiveTexture = t; m.emissiveColor = new B.Color3(.7, .7, .7); m.diffuseColor = new B.Color3(.5, .5, .5); m.specularColor = new B.Color3(0, 0, 0);
        return (tileMats[v] = m); }
      let bd = null; // { k, R, C, P, rock, runs, posts, limit, tiles: [{ id, v, r, c, fr, fc, born, pop, merged, gone, mesh }], score, best, moves, won, top }
      const st = { phase: 'pick', t: 0, anim: 0, swipe: null, pendingSpawn: false };
      let nextId = 1;
      const bestKey = k => 'rebelAntsMergeBest:' + (def.id || 'merge') + ':' + k, goalKey = k => 'rebelAntsMergeGoal:' + (def.id || 'merge') + ':' + k;
      // squares from the board's middle (a board R rows deep and C wide; the longer side fills the table)
      const cellX = c => -(bd.C * bd.P + (bd.C - 1) * GAPW) / 2 + c * (bd.P + GAPW) + bd.P / 2, cellZ = r => (bd.R * bd.P + (bd.R - 1) * GAPW) / 2 - r * (bd.P + GAPW) - bd.P / 2;
      const pilingM = mat('piling', [.24, .15, .08], [.05, .03, .015]), ropeM = mat('rope', [.62, .5, .3], [.12, .1, .06]);
      function tileMesh(t) { const m = keep(B.MeshBuilder.CreatePlane('mgCrate', { size: bd.P }, scene)); m.rotation.x = Math.PI / 2; m.material = tileMat(t.v); m.position.set(cellX(t.c), TY + .02, cellZ(t.r)); return m; }
      const dropMesh = m => { const i = nodes.indexOf(m); if (i >= 0) nodes.splice(i, 1); m.dispose(); };
      function dropTile(t) { if (t.mesh) { dropMesh(t.mesh); t.mesh = null; } }
      function spawn() { const free = []; for (let r = 0; r < bd.R; r++) for (let c = 0; c < bd.C; c++) if (!bd.rock[r * bd.C + c] && !bd.tiles.some(t => t.r === r && t.c === c)) free.push([r, c]); if (!free.length) return false;
        const [r, c] = free[Math.floor(Math.random() * free.length)], t = { id: nextId++, v: Math.random() < .9 ? 2 : 4, r, c, fr: r, fc: c, born: 0, pop: 0 }; t.mesh = tileMesh(t); t.mesh.scaling.setAll(.4); bd.tiles.push(t); return true; }
      function drawBoard() { const g = tex.getContext(), k = TEX / S; g.fillStyle = '#7a5a3c'; g.fillRect(0, 0, TEX, TEX); g.fillStyle = 'rgba(0,0,0,.13)'; for (let i = 0; i < 9; i++) g.fillRect(0, i * TEX / 9, TEX, 2);
        for (let r = 0; r < bd.R; r++) for (let c = 0; c < bd.C; c++) { if (bd.rock[r * bd.C + c]) continue; const x = (cellX(c) + S / 2 - bd.P / 2) * k, y = (S / 2 - cellZ(r) - bd.P / 2) * k; g.fillStyle = 'rgba(40,24,12,.45)'; rr(g, x, y, bd.P * k, bd.P * k, 9); g.fill(); }
        tex.update(); }
      function clearTiles() { if (bd) { bd.tiles.forEach(dropTile); bd.posts.forEach(dropMesh); } }
      function build(k) { const L = LV[k], R = L.rows || L.n, C = L.cols || L.n, M = Math.max(R, C); let best = 0; try { best = Number(localStorage.getItem(bestKey(k))) || 0; } catch (e) {}
        clearTiles(); bd = { k, R, C, goal: L.goal, P: (S - 2 * MG - (M - 1) * GAPW) / M, rock: new Uint8Array(R * C), runs: [[], [], [], []], posts: [], limit: L.slides || 0, tiles: [], score: 0, best, moves: 0, won: false, top: 2 };
        for (const [r, c] of L.rocks || []) bd.rock[r * C + c] = 1;
        // the runs of squares a slide moves crates along (0 up, 1 right, 2 down, 3 left), each from the end the crates
        // slide to; a piling ends a run, so crates stop against it and never merge across it
        for (let d = 0; d < 4; d++) { const lines = d % 2 === 0 ? Array.from({ length: C }, (_, c) => Array.from({ length: R }, (_, j) => [d === 0 ? j : R - 1 - j, c])) : Array.from({ length: R }, (_, r) => Array.from({ length: C }, (_, j) => [r, d === 3 ? j : C - 1 - j]));
          for (const l of lines) { let run = []; for (const [r, c] of l) { if (bd.rock[r * C + c]) { if (run.length) bd.runs[d].push(run); run = []; } else run.push([r, c]); } if (run.length) bd.runs[d].push(run); } }
        for (const [r, c] of L.rocks || []) { // a piling: a wooden post with a rope round it
          const post = keep(B.MeshBuilder.CreateCylinder('mgPiling', { diameter: bd.P * .7, height: .3, tessellation: 20 }, scene)); post.material = pilingM; post.position.set(cellX(c), TY + .15, cellZ(r));
          const rope = keep(B.MeshBuilder.CreateTorus('mgRope', { diameter: bd.P * .72, thickness: .045, tessellation: 24 }, scene)); rope.material = ropeM; rope.position.set(cellX(c), TY + .2, cellZ(r)); bd.posts.push(post, rope); }
        drawBoard(); spawn(); spawn(); ctx.player.place(0, cam[2] - 1.6, 0); info(); }
      const info = () => H.info(bd ? `${LV[bd.k].name} · ${bd.C} × ${bd.R} · goal ${bd.goal} · best crate ${bd.top} · slides ${bd.limit ? `${bd.moves} of ${bd.limit}` : bd.moves} · best score ${bd.best}` : 'Pick a board');
      function canMove() { // a slide changes the board: a crate with a free square ahead in its run, or two equal crates that meet
        for (const runs of bd.runs) for (const L of runs) { let gap = false, prev = 0;
          for (const [r, c] of L) { const t = bd.tiles.find(x => x.r === r && x.c === c); if (!t) { gap = true; continue; } if (gap || t.v === prev) return true; prev = t.v; } }
        return false; }
      function move(dir) { // 0 up, 1 right, 2 down, 3 left
        if (st.phase !== 'play' || st.anim > 0) return false; let moved = false, gained = 0;
        bd.tiles.forEach(t => { t.fr = t.r; t.fc = t.c; t.merged = false; });
        for (const L of bd.runs[dir]) {
          const ts = L.map(([r, c]) => bd.tiles.find(t => t.r === r && t.c === c && !t.gone)).filter(Boolean); let w = 0, last = null;
          for (const t of ts) { if (last && last.v === t.v && !last.merged) { t.r = last.r; t.c = last.c; t.gone = true; last.v *= 2; last.merged = true; gained += last.v; moved = true; bd.top = Math.max(bd.top, last.v); continue; }
            const [r, c] = L[w++]; if (t.r !== r || t.c !== c) moved = true; t.r = r; t.c = c; last = t; } }
        if (!moved) return false;
        bd.score += gained; bd.moves++; if (gained) ctx.note(440 + Math.min(10, Math.log2(gained)) * 45, 'bell'); else ctx.note(330, 'lantern');
        st.anim = SLIDE; st.pendingSpawn = true; H.score(bd.score); info(); return true;
      }
      function settle() { // end of a slide: merged crates show their new number, the moved-in ones go, a new crate lands
        bd.tiles.filter(t => t.gone).forEach(dropTile); bd.tiles = bd.tiles.filter(t => !t.gone);
        bd.tiles.forEach(t => { t.fr = t.r; t.fc = t.c; if (t.merged) { t.pop = 1; t.mesh.material = tileMat(t.v); } t.merged = false; t.mesh.position.set(cellX(t.c), TY + .02, cellZ(t.r)); });
        if (st.pendingSpawn) { st.pendingSpawn = false; spawn(); }
        if (bd.top >= bd.goal && !bd.won) { bd.won = true; try { localStorage.setItem(goalKey(bd.k), '1'); } catch (e) {} ctx.sound('gamewin'); H.msg(NAMES[bd.goal] || String(bd.goal), 1600, 'you reached the goal: keep going or bank it'); }
        if (!canMove()) end('No more slides'); else if (bd.limit && bd.moves >= bd.limit) end('Out of slides'); }
      function end(reason) { if (st.phase !== 'play') return; st.phase = 'over'; st.wt = 0; pads.style.display = 'none'; if (bd.score > bd.best) { bd.best = bd.score; try { localStorage.setItem(bestKey(bd.k), String(bd.score)); } catch (e) {} } ctx.sound(bd.top >= bd.goal ? 'gamewin' : 'thock'); H.msg(reason, 1600, `${bd.score} points`); info(); }
      const hud = document.getElementById('gameHud');
      const pick = document.createElement('div');
      const wide = LV.length > 6 && innerWidth >= 600; // ten boards: five a row on wide screens
      pick.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(' + (wide ? 600 : 400) + 'px,92vw);background:rgba(26,16,6,.95);border:1px solid rgba(240,200,80,.6);border-radius:14px;padding:16px;text-align:center;pointer-events:auto;font:15px/1.4 system-ui,sans-serif;color:#eee';
      pick.innerHTML = `<div style="font:800 13px/1.2 system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#ffd35a;margin-bottom:10px">Banana Merge</div><div style="margin-bottom:12px;color:#bbb">Slide the crates; equal ones merge. Reach each board's goal crate.</div>`
        + `<div style="display:grid;grid-template-columns:repeat(${wide ? 5 : LV.length > 6 ? 2 : 3},1fr);gap:8px">${LV.map((L, k) => { let best = 0, done = false; try { best = Number(localStorage.getItem(bestKey(k))) || 0; done = !!localStorage.getItem(goalKey(k)); } catch (e) {} const n = (L.rocks || []).length;
          return `<button type="button" data-k="${k}" style="padding:8px 2px;border-radius:9px;border:1px solid #ffd35a;background:${done ? 'rgba(255,211,90,.18)' : 'rgba(255,255,255,.05)'};color:#fff;font:700 14px system-ui,sans-serif;cursor:pointer">${k + 1}. ${L.name}${done ? ' ✓' : ''}<div style="font:11px system-ui;opacity:.78">${L.cols || L.n}×${L.rows || L.n} · to ${L.goal}${L.note ? ` · ${L.note}` : n ? ` · ${n} piling${n > 1 ? 's' : ''}` : L.slides ? ` · in ${L.slides} slides` : ''}${best ? ` · best ${best}` : ''}</div></button>`; }).join('')}</div>`
        + `<div style="margin-top:10px;font-size:12px;color:#998">Keys ${LV.length > 9 ? '1-9 and 0' : '1-' + LV.length} pick a board · ✓ goal reached</div>`;
      pick.querySelectorAll('button[data-k]').forEach(b => b.onclick = (e) => { e.stopPropagation(); b.blur(); choose(+b.dataset.k); });
      const pads = document.createElement('div');
      pads.style.cssText = 'position:absolute;bottom:62px;right:16px;display:none;grid-template-columns:repeat(3,48px);grid-template-rows:repeat(2,42px);gap:5px;pointer-events:auto';
      const pad = (t, area, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.style.cssText = `grid-area:${area};border-radius:8px;border:1px solid #e6b84a;background:rgba(28,18,6,.85);color:#fff3cf;font:700 18px system-ui;cursor:pointer`; b.onclick = (e) => { e.stopPropagation(); b.blur(); fn(); }; pads.appendChild(b); return b; };
      pad('↑', '1 / 2', () => move(0)); pad('←', '2 / 1', () => move(3)); pad('↓', '2 / 2', () => move(2)); pad('→', '2 / 3', () => move(1));
      pad('Bank it', '1 / 3', () => end('Banked')).style.font = '700 12px system-ui';
      function choose(k) { if (st.phase !== 'pick') return; pick.remove(); st.phase = 'play'; build(k); pads.style.display = 'grid'; H.score(0); H.msg(LV[k].name, 1000, `merge up to ${LV[k].goal}${LV[k].slides ? ` in ${LV[k].slides} slides` : ''}`); }
      hud.append(pick, pads);
      const cam = [0, TY + 5.3, -3.0], at = [0, TY, -.28];
      ctx.player.place(0, cam[2] - 1.6, 0); ctx.look(cam, at, def.fov || .8); // the player waits behind the camera, out of the picture
      { const g = tex.getContext(); g.fillStyle = '#7a5a3c'; g.fillRect(0, 0, TEX, TEX); tex.update(); }
      H.title(def.title || 'Banana Merge'); H.score(''); info();
      H.hint('Arrows, <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or a swipe slide every crate; equal crates merge. "Bank it" ends the run with your score.');
      return {
        update(dt) {
          ctx.look(cam, at); st.t += dt; if (!bd) return;
          if (st.anim > 0) { st.anim -= dt; const u = Math.min(1, 1 - st.anim / SLIDE), e = u * u * (3 - 2 * u);
            for (const t of bd.tiles) { if (!t.mesh) continue; t.mesh.position.x = cellX(t.fc + (t.c - t.fc) * e); t.mesh.position.z = cellZ(t.fr + (t.r - t.fr) * e); t.mesh.position.y = TY + (t.gone ? .015 : .02); }
            if (st.anim <= 0) settle(); }
          for (const t of bd.tiles) { if (!t.mesh) continue; let s = 1; if (t.born < 1) { t.born = Math.min(1, t.born + dt / .12); s = .4 + .6 * t.born; } if (t.pop > 0) { t.pop = Math.max(0, t.pop - dt / .14); s = 1 + .1 * Math.sin(Math.PI * (1 - t.pop)); } if (t.mesh.scaling.x !== s) t.mesh.scaling.setAll(s); }
          if (st.phase === 'over' && (st.wt += dt) > 1.8) { st.phase = 'done'; H.hint(''); const passed = bd.score >= (def.pass || 0);
            // a board's goal reached below the pass mark: its own kicker and the next board (the score still clears)
            ctx.finish({ score: bd.score, label: 'points', passed, kicker: bd.won && !passed ? 'Goal reached' : undefined, next: bd.won && bd.k + 1 < LV.length ? bd.k + 1 : undefined,
              extra: `${LV[bd.k].name}: best crate ${bd.top}${NAMES[bd.top] ? ` (${NAMES[bd.top]})` : ''} after ${bd.moves} slide${bd.moves === 1 ? '' : 's'}${bd.won ? ', the goal reached' : `; the goal is ${bd.goal}`}. Best score here ${bd.best}.` }); }
        },
        key(e, down) {
          if (!down || e.repeat) return; const k = e.key.toLowerCase();
          if (st.phase === 'pick') { const n = k === '0' ? 10 : parseInt(k, 10); if (n >= 1 && n <= LV.length) choose(n - 1); return; } // 1-9, 0 = the tenth
          if (k === 'arrowup' || k === 'w') move(0); else if (k === 'arrowright' || k === 'd') move(1); else if (k === 'arrowdown' || k === 's') move(2); else if (k === 'arrowleft' || k === 'a') move(3);
        },
        pointer(evt) {
          const T = B.PointerEventTypes; if (st.phase !== 'play') return;
          if (evt.type === T.POINTERDOWN) st.swipe = { x: scene.pointerX, y: scene.pointerY };
          else if (evt.type === T.POINTERUP && st.swipe) { const dx = scene.pointerX - st.swipe.x, dy = scene.pointerY - st.swipe.y; st.swipe = null; if (Math.max(Math.abs(dx), Math.abs(dy)) < 30) return; if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : 3); else move(dy > 0 ? 2 : 0); }
        },
        // Restart: a new game on the same board (two fresh crates, score and slides at 0; a slide under way is dropped);
        // only while a run is on. The best score is not touched: an unbanked run never counts
        restart() { if (st.phase !== 'play' || !bd) return; st.anim = 0; st.pendingSpawn = false; st.swipe = null; build(bd.k); H.score(0); H.msg('Start again', 900); },
        _test: { st, choose, move, canMove, settle, tileMesh, get bd() { return bd; }, LV, end },
        dispose() { pick.remove(); pads.remove(); nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); try { boardM.dispose(); tex.dispose(); } catch (e) {} for (const v in tileMats) { try { tileMats[v].diffuseTexture.dispose(); tileMats[v].dispose(); } catch (e) {} } }
      };
    }
  };
  window.RebelGames.register('merge', G);
})();
