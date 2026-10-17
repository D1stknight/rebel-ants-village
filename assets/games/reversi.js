// Colony Corners (Oct 15, Hub): Reversi against the termites. Place a red Rebel stone so that it closes a line of
// termite stones between it and another red stone (in any of the eight directions); every stone closed in flips
// red. No move that flips nothing; a side with no move passes; the game ends when neither can move, most stones wins.
// Ten opponents (Oct 17), weakest first: the Worker and the Scout (pick almost at random), the Guard and the Captain
// (weigh each move as it lands), the Major and the General (look two and four moves ahead), then the Marshal, the
// Prince, the King and the Queen (look further still and count the last moves out exactly). Beat one to meet the
// next. Score: the termite's points for a win, 10 (the Worker) to 100 (the Queen), +10 winning by 16 or more; a pass
// of 60 is the General, the same player as on Oct 15. def: { pass, points }
// Oct 17: How to play (the rules + one capture before / after, howto/reversi.png) and Restart (a new game against the
// same opponent; a game already over goes to its result). The ladder was played out termite against termite
// (scratchpad agents/lvD/reversi/ladder.mjs): each beats the one before it from random openings, sides swapped.
// Thinking is capped by boards looked at (nodes: the same on any computer) and by time (280 ms, for slow ones).
(function () {
  // depth 0 picks by feel (wild: at random), depth 1 weighs each move as it lands, deeper ones look that many moves
  // ahead; noise: how loosely they weigh close moves; nodes: the most boards looked at for one move (the same on any
  // computer); ms: a time cap for slow computers; exact: with that many squares left, the end of the game is counted out
  // exactly (when it fits in the nodes); pts: the score for beating it
  const OPP = [
    { name: 'Termite Worker', depth: 0, wild: 1, pts: 10, says: 'digs anywhere' },
    { name: 'Termite Scout', depth: 0, noise: 1, pts: 20, says: 'plays loose' },
    { name: 'Termite Guard', depth: 1, noise: 2, pts: 30, says: 'likes a good square' },
    { name: 'Termite Captain', depth: 1, noise: .15, pts: 40, says: 'knows the corners' },
    { name: 'Termite Major', depth: 2, noise: 8, pts: 50, says: 'thinks two moves ahead' },
    { name: 'Termite General', depth: 4, pts: 60, says: 'thinks four moves ahead' },
    { name: 'Termite Marshal', depth: 5, nodes: 6000, exact: 8, pts: 70, says: 'thinks five moves ahead' },
    { name: 'Termite Prince', depth: 6, nodes: 12000, exact: 10, pts: 80, says: 'counts out the endgame' },
    { name: 'Termite King', depth: 7, nodes: 25000, exact: 12, pts: 90, says: 'thinks seven moves ahead' },
    { name: 'Termite Queen', depth: 9, nodes: 50000, exact: 14, pts: 100, says: 'thinks deepest of all' }];
  const W = [100, -22, 10, 6, 6, 10, -22, 100, -22, -45, -2, -2, -2, -2, -45, -22, 10, -2, 1, 1, 1, 1, -2, 10, 6, -2, 1, 0, 0, 1, -2, 6,
    6, -2, 1, 0, 0, 1, -2, 6, 10, -2, 1, 1, 1, 1, -2, 10, -22, -45, -2, -2, -2, -2, -45, -22, 100, -22, 10, 6, 6, 10, -22, 100];
  const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  // the engine: board = Int8Array(64) of 0 empty, 1 red (player), -1 termite
  function flipsOf(b, i, who) { if (b[i]) return null; const r = i >> 3, c = i & 7, out = [];
    for (const [dr, dc] of DIRS) { let rr = r + dr, cc = c + dc; const run = []; while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && b[rr * 8 + cc] === -who) { run.push(rr * 8 + cc); rr += dr; cc += dc; }
      if (run.length && rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && b[rr * 8 + cc] === who) out.push(...run); }
    return out.length ? out : null; }
  // the search's tables: RAY[(i * 8 + d) * 8 + k] = the k-th square from i in direction d (DIRS order), -1 past the edge
  const RAY = new Int8Array(64 * 64).fill(-1);
  for (let i = 0; i < 64; i++) DIRS.forEach(([dr, dc], d) => { for (let k = 1, rr = (i >> 3) + dr, cc = (i & 7) + dc; rr >= 0 && rr < 8 && cc >= 0 && cc < 8; k++, rr += dr, cc += dc) RAY[(i * 8 + d) * 8 + k - 1] = rr * 8 + cc; });
  function canPlay(b, i, who) { if (b[i]) return false; // flipsOf without the list (the search's quick test)
    for (let d = 0; d < 8; d++) { let k = (i * 8 + d) * 8, j = RAY[k]; if (j < 0 || b[j] !== -who) continue;
      for (j = RAY[++k]; j >= 0 && b[j] === -who; j = RAY[++k]); if (j >= 0 && b[j] === who) return true; }
    return false; }
  function movesOf(b, who) { const m = []; for (let i = 0; i < 64; i++) if (canPlay(b, i, who)) m.push(i); return m; }
  function mobility(b, who) { let n = 0; for (let i = 0; i < 64; i++) if (canPlay(b, i, who)) n++; return n; }
  // the search plays moves in place: a move's flips go on the FL stack from sp up (doMove returns the new top)
  const FL = new Int8Array(4096);
  function doMove(b, i, who, sp) { b[i] = who;
    for (let d = 0; d < 8; d++) { let k = (i * 8 + d) * 8, j = RAY[k]; if (j < 0 || b[j] !== -who) continue; const k0 = k;
      for (j = RAY[++k]; j >= 0 && b[j] === -who; j = RAY[++k]); if (j >= 0 && b[j] === who) for (let q = k0; q < k; q++) { b[RAY[q]] = who; FL[sp++] = RAY[q]; } }
    return sp; }
  function undoMove(b, i, who, sp, top) { b[i] = 0; for (let k = sp; k < top; k++) b[FL[k]] = -who; }
  const CORNERS = [[0, [1, 8, 9]], [7, [6, 15, 14]], [56, [57, 48, 49]], [63, [62, 55, 54]]];
  function evalBoard(b, who, mine) { // from who's side; mine: who's number of moves, when known
    let pos = 0, mc = 0, tc = 0, empty = 0; for (let i = 0; i < 64; i++) { const v = b[i]; if (!v) { empty++; continue; } pos += v * who * W[i]; if (v === who) mc++; else tc++; }
    // an owned corner makes its neighbours safe: undo their penalty
    for (const [k, nb] of CORNERS) if (b[k]) for (const j of nb) if (b[j]) pos -= b[j] * who * W[j];
    const mob = (mine ?? mobility(b, who)) - mobility(b, -who);
    return pos + mob * 8 + (empty < 14 ? (mc - tc) * (14 - empty) : 0); }
  function search(b, who, depth, alpha, beta, ctx, sp) { // negamax with alpha-beta; ctx: { nodes, max, until, stop, exact }
    if ((++ctx.nodes & 255) === 0 && (ctx.nodes > ctx.max || performance.now() > ctx.until)) ctx.stop = true; if (ctx.stop) return 0;
    const ms = movesOf(b, who);
    if (!ms.length) { if (!mobility(b, -who)) { let d = 0; for (let i = 0; i < 64; i++) d += b[i] * who; return d * 1000; } return -search(b, -who, depth, -beta, -alpha, ctx, sp); }
    if (depth <= 0 && !ctx.exact) return evalBoard(b, who, ms.length);
    ms.sort((x, y) => W[y] - W[x]); let best = -1e9;
    for (const i of ms) { const top = doMove(b, i, who, sp);
      const v = -search(b, -who, depth - 1, -beta, -alpha, ctx, top); undoMove(b, i, who, sp, top);
      if (ctx.stop) return 0; if (v > best) best = v; if (v > alpha) alpha = v; if (alpha >= beta) break; }
    return best; }
  function chooseMove(b, who, opp) {
    const ms = movesOf(b, who); if (!ms.length) return -1; if (ms.length === 1) return ms[0];
    if (opp.wild) return ms[Math.floor(Math.random() * ms.length)];
    if (opp.depth === 0) { const pick = ms.slice().sort((x, y) => (W[y] - W[x]) * (Math.random() < .3 ? 1 : 0) + (Math.random() - .5) * 40); return pick[0]; }
    if (opp.depth === 1) { let best = ms[0], bv = -1e9; for (const i of ms) { const f = flipsOf(b, i, who), t = b.slice(); t[i] = who; f.forEach(j => t[j] = who); const v = evalBoard(t, who) + (Math.random() - .5) * 60 * opp.noise; if (v > bv) { bv = v; best = i; } } return best; }
    let empty = 0; for (let i = 0; i < 64; i++) if (!b[i]) empty++;
    const ctx = { nodes: 0, max: opp.nodes || 1e9, until: performance.now() + (opp.ms || 280), stop: false, exact: false }, noise = opp.noise || 0;
    let best = ms.slice().sort((x, y) => W[y] - W[x])[0];
    const pass = d => { let bd = -1, bv = -1e9, alpha = -1e9; // one full search at depth d, best move first
      // (with noise, moves within noise of the best are searched to their true value, so the noise never picks a blunder)
      for (const i of [best, ...ms.filter(i => i !== best)]) { const top = doMove(b, i, who, 0); let v = -search(b, -who, d - 1, -1e9, -(alpha - noise), ctx, top); undoMove(b, i, who, 0, top); if (ctx.stop) return -1;
        v += (Math.random() - .5) * noise; if (v > bv) { bv = v; bd = i; } if (v > alpha) alpha = v; }
      return bd; };
    for (let d = 1; d <= opp.depth; d++) { const m = pass(d); if (m < 0) break; best = m; }
    // the last moves: search to the end of the game (the exact stone count) when it fits (fresh nodes, the same time cap)
    if (opp.exact && empty <= opp.exact) { ctx.exact = true; ctx.stop = false; ctx.nodes = 0; const m = pass(64); if (m >= 0) best = m; }
    return best; }
  const G = {
    title: 'Colony Corners',
    howTo: { lines: [
      'Finish with more stones than the termites. You play the red stones, they play the dark ones; you move first, then you take turns.',
      'Place a stone so that a straight line of termite stones (across, up and down, or diagonal) lies between it and another red stone: every stone in that line flips to red.',
      'One stone can close several lines at once, in different directions: every one of them flips.',
      'A move must flip at least one stone; the gold dots show where you can play. A side with no move passes, and when neither side can move (or the board is full) the game ends.',
      'Ten termites, weakest first, from the Worker to the Queen: beat one to meet the next. A win scores that termite\'s points, +10 when you win by 16 stones or more.',
      'Click (or tap) a square with a gold dot, or move the white frame with the arrows and press Space. Restart begins a new game against the same termite.',
      'Tip: a corner can never be flipped back, so take corners, and keep off the three squares next to an empty corner. Early on, leaving yourself more moves beats grabbing stones.'],
      img: 'howto/reversi.png', caption: 'One red stone closes two lines at once: the three termite stones between red stones all flip.' },
    start(ctx) {
      const B = ctx.B, H = ctx.HUD, scene = ctx.scene, def = ctx.def, KEY = 'rebelAntsCornersProgress:' + (def.id || 'reversi');
      let beaten = 0; try { beaten = Math.max(0, Math.min(OPP.length, Number(localStorage.getItem(KEY)) || 0)); } catch (e) {}
      const mat = (k, c, em) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(.08, .08, .08); if (em) m.emissiveColor = new B.Color3(...em); return m; });
      const woodM = mat('table', [.32, .2, .1], [.07, .045, .02]);
      const nodes = [], keep = n => { n.parent = n.parent || ctx.frame; ctx.add(n); nodes.push(n); if (n.isPickable !== undefined) n.isPickable = false; return n; };
      const S = 3.6, TY = .85, MG = .14, P = (S - 2 * MG) / 8;
      { const t = keep(B.MeshBuilder.CreateBox('rvTable', { width: S + .44, height: .14, depth: S + .44 }, scene)); t.material = woodM; t.position.y = TY - .07;
        for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const l = keep(B.MeshBuilder.CreateBox('rvLeg', { width: .16, height: TY - .14, depth: .16 }, scene)); l.material = woodM; l.position.set(x * (S / 2 - .04), (TY - .14) / 2, z * (S / 2 - .04)); } }
      const TEX = 512, tex = new B.DynamicTexture('rvTex', { width: TEX, height: TEX }, scene, true); tex.hasAlpha = false;
      const boardM = new B.StandardMaterial('rvBoardMat', scene); boardM.diffuseTexture = tex; boardM.emissiveTexture = tex; boardM.emissiveColor = new B.Color3(.6, .6, .6); boardM.diffuseColor = new B.Color3(.55, .55, .55); boardM.specularColor = new B.Color3(0, 0, 0);
      const board = keep(B.MeshBuilder.CreateGround('rvBoard', { width: S, height: S }, scene)); board.material = boardM; board.position.y = TY + .005; board.isPickable = true; board.metadata = { rvBoard: true };
      // one two-tone stone (red top, termite-dark bottom) shared by 64 instances: a flip is a half turn about x
      const stoneM = new B.StandardMaterial('rvStoneMat', scene); stoneM.specularColor = new B.Color3(.25, .25, .25); stoneM.emissiveColor = new B.Color3(.18, .18, .18);
      const stone = B.MeshBuilder.CreateCylinder('rvStone', { diameter: P * .84, height: .07, tessellation: 24, faceColors: [new B.Color4(.13, .1, .08, 1), new B.Color4(.5, .44, .36, 1), new B.Color4(.82, .14, .12, 1)] }, scene);
      stone.material = stoneM; stone.isVisible = false; keep(stone);
      const inst = []; for (let i = 0; i < 64; i++) { const s = stone.createInstance('rvStone' + i); keep(s); s.isVisible = false; s.position.set(-S / 2 + MG + ((i & 7) + .5) * P, TY + .04, S / 2 - MG - ((i >> 3) + .5) * P); inst.push(s); }
      let g = null; // { k, opp, b: Int8Array, turn: 1 | -1, last, flips: [{ i, t, to }], passes, over, cur }
      const st = { phase: 'pick', t: 0, think: 0 };
      const count = () => { let r = 0, t = 0; for (let i = 0; i < 64; i++) { if (g.b[i] === 1) r++; else if (g.b[i] === -1) t++; } return { r, t }; };
      const info = () => { if (!g) { H.info('Pick an opponent'); return; } const { r, t } = count(); H.info(`${g.opp.name} · Rebels ${r} · Termites ${t} · ${st.phase === 'play' ? (g.turn === 1 ? 'your move' : 'the termites think') : 'game over'}`); H.score(`${r} : ${t}`); };
      function show(i, flip) { const s = inst[i], v = g.b[i]; s.isVisible = !!v; if (!v) return; if (flip) g.flips.push({ i, t: 0, from: s.rotation.x, to: v === 1 ? 0 : Math.PI }); else { s.rotation.x = v === 1 ? 0 : Math.PI; s.position.y = TY + .04; } }
      function drawBoard() { const x = tex.getContext(), C = (TEX - 2 * MG / S * TEX) / 8, m = MG / S * TEX;
        x.fillStyle = '#2a4a22'; x.fillRect(0, 0, TEX, TEX); x.fillStyle = '#3f6e30'; x.fillRect(m, m, TEX - 2 * m, TEX - 2 * m);
        x.strokeStyle = 'rgba(10,25,8,.8)'; x.lineWidth = 2; for (let a = 0; a <= 8; a++) { x.beginPath(); x.moveTo(m + a * C, m); x.lineTo(m + a * C, TEX - m); x.stroke(); x.beginPath(); x.moveTo(m, m + a * C); x.lineTo(TEX - m, m + a * C); x.stroke(); }
        x.fillStyle = 'rgba(10,25,8,.9)'; for (const [a, b2] of [[2, 2], [2, 6], [6, 2], [6, 6]]) { x.beginPath(); x.arc(m + a * C, m + b2 * C, 4, 0, Math.PI * 2); x.fill(); }
        if (g && st.phase === 'play' && g.turn === 1) { x.fillStyle = 'rgba(255,220,120,.55)'; for (const i of movesOf(g.b, 1)) { x.beginPath(); x.arc(m + ((i & 7) + .5) * C, m + ((i >> 3) + .5) * C, C * .13, 0, Math.PI * 2); x.fill(); } }
        if (g && g.last >= 0) { x.strokeStyle = '#ffd36a'; x.lineWidth = 3; x.strokeRect(m + (g.last & 7) * C + 3, m + (g.last >> 3) * C + 3, C - 6, C - 6); }
        if (g && st.phase === 'play' && g.cur >= 0) { x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = 2; x.strokeRect(m + (g.cur & 7) * C + 6, m + (g.cur >> 3) * C + 6, C - 12, C - 12); }
        tex.update(); }
      function build(k) { const b = new Int8Array(64); b[27] = -1; b[36] = -1; b[28] = 1; b[35] = 1; g = { k, opp: OPP[k], b, turn: 1, last: -1, flips: [], passes: 0, cur: 19 };
        for (let i = 0; i < 64; i++) show(i, false); drawBoard(); info(); ctx.player.place(0, cam[2] - 1.6, 0); }
      function play(i, who) { const f = flipsOf(g.b, i, who); if (!f) return false; g.b[i] = who; show(i, false); inst[i].scaling.setAll(.3); g.grow = { i, t: 0 };
        f.forEach((j, n) => { g.b[j] = who; show(j, true); g.flips[g.flips.length - 1].t = -n * .05; }); g.last = i; ctx.note(who === 1 ? 520 + f.length * 30 : 300 + f.length * 20, who === 1 ? 'bell' : 'lantern'); return true; }
      function next() { // after a move: who plays now, passes, the end
        const { r, t } = count(), mine = movesOf(g.b, 1).length, theirs = movesOf(g.b, -1).length;
        if ((!mine && !theirs) || r + t === 64) { end(); return; }
        g.turn = -g.turn;
        if (g.turn === 1 && !mine) { H.msg('You have no move', 1300, 'the termites play again'); g.turn = -1; }
        else if (g.turn === -1 && !theirs) { H.msg('The termites pass', 1300); g.turn = 1; }
        st.think = g.turn === -1 ? .55 : 0; drawBoard(); info(); }
      function playerMove(i) { if (st.phase !== 'play' || g.turn !== 1 || g.flips.length) return false; if (!play(i, 1)) { ctx.note(220, 'lantern'); return false; } next(); return true; }
      function end() { st.phase = 'over'; st.wt = 0; drawBoard(); const { r, t } = count(), won = r > t;
        if (won && g.k + 1 > beaten) { beaten = g.k + 1; try { localStorage.setItem(KEY, String(beaten)); } catch (e) {} }
        ctx.sound(won ? 'gamewin' : 'thock'); H.msg(won ? 'The colony holds' : r === t ? 'A draw' : 'The termites win', 1700, `${r} : ${t}`); info(); }
      const hud = document.getElementById('gameHud');
      const pick = document.createElement('div');
      const wide = OPP.length > 6 && innerWidth >= 600; // ten termites: five a row on wide screens
      pick.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(' + (wide ? 600 : 400) + 'px,92vw);background:rgba(14,20,10,.95);border:1px solid rgba(220,90,70,.6);border-radius:14px;padding:16px;text-align:center;pointer-events:auto;font:15px/1.4 system-ui,sans-serif;color:#eee';
      const drawPick = () => { pick.innerHTML = `<div style="font:800 13px/1.2 system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#ff8a70;margin-bottom:10px">Colony Corners</div><div style="margin-bottom:12px;color:#bbb">Close termite lines between your stones to flip them red. Corners never flip.</div>`
        + `<div style="display:grid;grid-template-columns:repeat(${wide ? 5 : 2},1fr);gap:8px">${OPP.map((o, k) => { const open = k <= beaten, ok = k < beaten; return `<button type="button" data-k="${k}" ${open ? '' : 'disabled'} style="padding:8px 3px;border-radius:9px;border:1px solid ${open ? '#ff8a70' : '#444'};background:${ok ? 'rgba(255,138,112,.18)' : 'rgba(255,255,255,.04)'};color:${open ? '#fff' : '#666'};font:700 14px system-ui,sans-serif;cursor:${open ? 'pointer' : 'default'}">${k + 1}. ${open ? o.name.replace(/^Termite /, '') : '🔒'}${ok ? ' ✓' : ''}<div style="font:11px system-ui;opacity:.75">${open ? o.says : 'beat the one before'}</div></button>`; }).join('')}</div>`
          + `<div style="margin-top:10px;font-size:12px;color:#998">Keys ${OPP.length > 9 ? '1-9 and 0' : '1-' + OPP.length} pick an opponent</div>`;
        pick.querySelectorAll('button[data-k]').forEach(b => b.onclick = (e) => { e.stopPropagation(); b.blur(); choose(+b.dataset.k); }); };
      function choose(k) { if (st.phase !== 'pick' || k > beaten || k >= OPP.length) return; pick.remove(); st.phase = 'play'; build(k); H.msg(OPP[k].name, 1000, 'you play red, and you start'); }
      hud.append(pick); drawPick();
      const cam = [0, TY + 5.2, -3.0], at = [0, TY, -.28];
      ctx.player.place(0, cam[2] - 1.6, 0); ctx.look(cam, at, def.fov || .8); drawBoard(); // the player waits behind the camera, out of the picture
      H.title(def.title || 'Colony Corners'); H.score(''); info();
      H.hint('Click a square with a gold dot to place a red stone. Arrows + <kbd>Space</kbd> work too. Corners can never be flipped back.');
      return {
        update(dt) {
          ctx.look(cam, at); st.t += dt; if (!g) return;
          if (g.grow) { g.grow.t += dt; const s = inst[g.grow.i], u = Math.min(1, g.grow.t / .12); s.scaling.setAll(.3 + .7 * u); if (u >= 1) g.grow = null; }
          for (const f of g.flips) { f.t += dt; const u = Math.max(0, Math.min(1, f.t / .28)), s = inst[f.i]; s.rotation.x = f.from + (f.to - f.from) * u; s.position.y = TY + .04 + Math.sin(u * Math.PI) * .22; }
          if (g.flips.length && g.flips.every(f => f.t >= .28)) { g.flips.forEach(f => { inst[f.i].rotation.x = f.to; inst[f.i].position.y = TY + .04; }); g.flips = []; }
          if (st.phase === 'play' && g.turn === -1 && !g.flips.length && (st.think -= dt) <= 0) { const i = chooseMove(g.b, -1, g.opp); if (i >= 0) play(i, -1); next(); }
          if (st.phase === 'over' && !g.flips.length && (st.wt += dt) > 2) { st.phase = 'done'; H.hint(''); const { r, t } = count(), won = r > t;
            ctx.finish({ score: won ? g.opp.pts + (r - t >= 16 ? 10 : 0) : 0, label: 'points', passed: won && g.opp.pts >= (def.pass || 0), solved: won,
              extra: won ? `You beat the ${g.opp.name} ${r} to ${t}.${g.k + 1 < OPP.length ? ` The ${OPP[g.k + 1].name} will play you next.` : ' The whole termite court has fallen.'}` : `The ${g.opp.name} won ${t} to ${r}${r === t ? ' (a draw)' : ''}.` }); }
        },
        key(e, down) {
          if (!down || e.repeat) return; const k = e.key.toLowerCase();
          if (st.phase === 'pick') { const n = k === '0' ? 10 : parseInt(k, 10); if (n >= 1 && n <= OPP.length) choose(n - 1); return; } // 1-9, 0 = the tenth
          if (st.phase !== 'play') return; const x = g.cur & 7, y = g.cur >> 3;
          if (k === 'arrowup' || k === 'w') g.cur = ((y + 7) % 8) * 8 + x; else if (k === 'arrowdown' || k === 's') g.cur = ((y + 1) % 8) * 8 + x;
          else if (k === 'arrowleft' || k === 'a') g.cur = y * 8 + (x + 7) % 8; else if (k === 'arrowright' || k === 'd') g.cur = y * 8 + (x + 1) % 8;
          else if (k === ' ' || k === 'enter') { playerMove(g.cur); return; } else return; drawBoard();
        },
        pointer(evt) {
          if (evt.type !== B.PointerEventTypes.POINTERDOWN || st.phase !== 'play' || !g) return;
          const hit = scene.pickWithRay(ctx.ray(), m => m.metadata?.rvBoard); if (!hit?.pickedPoint) return; const l = ctx.toLocal(hit.pickedPoint);
          const c = Math.floor((l.x + S / 2 - MG) / P), r = Math.floor((S / 2 - MG - l.z) / P); if (c >= 0 && c < 8 && r >= 0 && r < 8) { g.cur = r * 8 + c; playerMove(g.cur); }
        },
        // Restart: a new game against the same opponent (the four middle stones, your move); not once a game is over
        restart() { if (st.phase !== 'play' || !g) return; st.think = 0; inst.forEach(s => s.scaling.setAll(1)); build(g.k); H.msg('A new game', 1000, 'you play red, and you start'); },
        _test: { st, choose, playerMove, movesOf, chooseMove, flipsOf, get g() { return g; }, OPP, count, unlock(k) { beaten = k; drawPick(); } },
        dispose() { pick.remove(); nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); try { boardM.dispose(); tex.dispose(); stoneM.dispose(); } catch (e) {} }
      };
    }
  };
  window.RebelGames.register('reversi', G);
})();
