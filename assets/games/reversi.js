// Colony Corners (Oct 15, Hub): Reversi against the termites. Place a red Rebel stone so that it closes a line of
// termite stones between it and another red stone (in any of the eight directions); every stone closed in flips
// red. No move that flips nothing; a side with no move passes; the game ends when neither can move, most stones wins.
// Four opponents: the Termite Scout (picks almost at random), the Termite Captain (knows good squares), the Termite
// General (looks four moves ahead) and the Termite Queen (looks six or more ahead and plays the last moves perfectly).
// Beat one to meet the next. Score: the opponent x 20 for a win (+10 winning by 16 or more). def: { pass, points }
(function () {
  const OPP = [
    { name: 'Termite Scout', depth: 0, noise: 1, ms: 0 }, { name: 'Termite Captain', depth: 1, noise: .15, ms: 0 },
    { name: 'Termite General', depth: 4, noise: 0, ms: 70 }, { name: 'Termite Queen', depth: 8, noise: 0, ms: 140, exact: 10 }];
  const W = [100, -22, 10, 6, 6, 10, -22, 100, -22, -45, -2, -2, -2, -2, -45, -22, 10, -2, 1, 1, 1, 1, -2, 10, 6, -2, 1, 0, 0, 1, -2, 6,
    6, -2, 1, 0, 0, 1, -2, 6, 10, -2, 1, 1, 1, 1, -2, 10, -22, -45, -2, -2, -2, -2, -45, -22, 100, -22, 10, 6, 6, 10, -22, 100];
  const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  // the engine: board = Int8Array(64) of 0 empty, 1 red (player), -1 termite
  function flipsOf(b, i, who) { if (b[i]) return null; const r = i >> 3, c = i & 7, out = [];
    for (const [dr, dc] of DIRS) { let rr = r + dr, cc = c + dc; const run = []; while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && b[rr * 8 + cc] === -who) { run.push(rr * 8 + cc); rr += dr; cc += dc; }
      if (run.length && rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && b[rr * 8 + cc] === who) out.push(...run); }
    return out.length ? out : null; }
  function movesOf(b, who) { const m = []; for (let i = 0; i < 64; i++) if (!b[i] && flipsOf(b, i, who)) m.push(i); return m; }
  function evalBoard(b, who) { // from who's side
    let pos = 0, mine = 0, theirs = 0, empty = 0; for (let i = 0; i < 64; i++) { const v = b[i]; if (!v) { empty++; continue; } pos += v * who * W[i]; if (v === who) mine++; else theirs++; }
    // an owned corner makes its neighbours safe: undo their penalty
    for (const [k, nb] of [[0, [1, 8, 9]], [7, [6, 15, 14]], [56, [57, 48, 49]], [63, [62, 55, 54]]]) if (b[k]) for (const j of nb) if (b[j]) pos -= b[j] * who * W[j];
    const mob = movesOf(b, who).length - movesOf(b, -who).length;
    return pos + mob * 8 + (empty < 14 ? (mine - theirs) * (14 - empty) : 0); }
  function search(b, who, depth, alpha, beta, ctx) { // negamax with alpha-beta; ctx: { nodes, until, stop, exact }
    if ((++ctx.nodes & 255) === 0 && ctx.until && performance.now() > ctx.until) ctx.stop = true; if (ctx.stop) return 0;
    const ms = movesOf(b, who);
    if (!ms.length) { if (!movesOf(b, -who).length) { let d = 0; for (let i = 0; i < 64; i++) d += b[i] * who; return d * 1000; } return -search(b, -who, depth, -beta, -alpha, ctx); }
    if (depth <= 0 && !ctx.exact) return evalBoard(b, who);
    ms.sort((x, y) => W[y] - W[x]); let best = -1e9;
    for (const i of ms) { const f = flipsOf(b, i, who); b[i] = who; for (const j of f) b[j] = who;
      const v = -search(b, -who, depth - 1, -beta, -alpha, ctx); b[i] = 0; for (const j of f) b[j] = -who;
      if (ctx.stop) return 0; if (v > best) best = v; if (v > alpha) alpha = v; if (alpha >= beta) break; }
    return best; }
  function chooseMove(b, who, opp) {
    const ms = movesOf(b, who); if (!ms.length) return -1; if (ms.length === 1) return ms[0];
    if (opp.depth === 0) { const pick = ms.slice().sort((x, y) => (W[y] - W[x]) * (Math.random() < .3 ? 1 : 0) + (Math.random() - .5) * 40); return pick[0]; }
    if (opp.depth === 1) { let best = ms[0], bv = -1e9; for (const i of ms) { const f = flipsOf(b, i, who), t = b.slice(); t[i] = who; f.forEach(j => t[j] = who); const v = evalBoard(t, who) + (Math.random() - .5) * 60 * opp.noise; if (v > bv) { bv = v; best = i; } } return best; }
    let empty = 0; for (let i = 0; i < 64; i++) if (!b[i]) empty++;
    const ctx = { nodes: 0, until: performance.now() + opp.ms, stop: false, exact: false };
    let best = ms.slice().sort((x, y) => W[y] - W[x])[0];
    const pass = d => { let bd = -1, bv = -1e9, alpha = -1e9; // one full search at depth d, best move first
      for (const i of [best, ...ms.filter(i => i !== best)]) { const f = flipsOf(b, i, who); b[i] = who; for (const j of f) b[j] = who; const v = -search(b, -who, d - 1, -1e9, -alpha, ctx); b[i] = 0; for (const j of f) b[j] = -who; if (ctx.stop) return -1; if (v > bv) { bv = v; bd = i; } if (v > alpha) alpha = v; }
      return bd; };
    for (let d = 1; d <= opp.depth; d++) { const m = pass(d); if (m < 0) break; best = m; }
    // the last moves: search to the end of the game (exact stone count) when it fits in time
    if (opp.exact && empty <= opp.exact) { ctx.exact = true; ctx.stop = false; ctx.until = performance.now() + opp.ms * 2; const m = pass(64); if (m >= 0) best = m; }
    return best; }
  const G = {
    title: 'Colony Corners',
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
      pick.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(400px,92vw);background:rgba(14,20,10,.95);border:1px solid rgba(220,90,70,.6);border-radius:14px;padding:16px;text-align:center;pointer-events:auto;font:15px/1.4 system-ui,sans-serif;color:#eee';
      const drawPick = () => { pick.innerHTML = `<div style="font:800 13px/1.2 system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#ff8a70;margin-bottom:10px">Colony Corners</div><div style="margin-bottom:12px;color:#bbb">Close termite lines between your stones to flip them red. Corners never flip.</div>`
        + `<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px">${OPP.map((o, k) => { const open = k <= beaten, ok = k < beaten; return `<button type="button" data-k="${k}" ${open ? '' : 'disabled'} style="padding:9px 4px;border-radius:9px;border:1px solid ${open ? '#ff8a70' : '#444'};background:${ok ? 'rgba(255,138,112,.18)' : 'rgba(255,255,255,.04)'};color:${open ? '#fff' : '#666'};font:700 14px system-ui,sans-serif;cursor:${open ? 'pointer' : 'default'}">${open ? o.name : '🔒'}${ok ? ' ✓' : ''}<div style="font:11px system-ui;opacity:.75">${['plays loose', 'knows the corners', 'thinks 4 moves ahead', 'thinks 6+ ahead'][k]}</div></button>`; }).join('')}</div>`;
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
            ctx.finish({ score: won ? (g.k + 1) * 20 + (r - t >= 16 ? 10 : 0) : 0, label: 'points', passed: won && (g.k + 1) * 20 >= (def.pass || 0), solved: won,
              extra: won ? `You beat the ${g.opp.name} ${r} to ${t}.${g.k + 1 < OPP.length ? ` The ${OPP[g.k + 1].name} will play you next.` : ' The whole termite court has fallen.'}` : `The ${g.opp.name} won ${t} to ${r}${r === t ? ' (a draw)' : ''}.` }); }
        },
        key(e, down) {
          if (!down || e.repeat) return; const k = e.key.toLowerCase();
          if (st.phase === 'pick') { const n = parseInt(k, 10); if (n >= 1 && n <= OPP.length) choose(n - 1); return; }
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
        _test: { st, choose, playerMove, movesOf, chooseMove, flipsOf, get g() { return g; }, OPP, count, unlock(k) { beaten = k; drawPick(); } },
        dispose() { pick.remove(); nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); try { boardM.dispose(); tex.dispose(); stoneM.dispose(); } catch (e) {} }
      };
    }
  };
  window.RebelGames.register('reversi', G);
})();
