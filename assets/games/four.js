// Banana Drop (Oct 15, Chumpz): four in a row against the apes. Drop a banana into a column of the rack; it falls to
// the lowest free hole. Four bananas in a line (across, up or slanted) wins; the apes drop coconuts and try the same.
// Four opponents: Banana Band (plays for fun and misses things), Pengu (sees a move or two ahead), Peely (six moves
// ahead) and Big Chain (twelve or more, the cove's champion). Beat one to meet the next; you always drop first.
// Score: the opponent x 20 for a win (+10 winning with 12 bananas or fewer). def: { pass, points }
(function () {
  const OPP = [
    { name: 'Banana Band', depth: 0, see: .55, noise: 0, ms: 0, says: 'just here for the music' },
    { name: 'Pengu', depth: 2, see: 1, noise: 30, ms: 60, says: 'reads the water two moves out' },
    { name: 'Peely', depth: 6, see: 1, noise: 6, ms: 150, says: 'counts the holes six moves ahead' },
    { name: 'Big Chain', depth: 14, see: 1, noise: 0, ms: 260, says: 'the champion of the cove' }];
  const ORDER = [3, 2, 4, 1, 5, 0, 6];
  // the rack: Int8Array(42), cell r * 7 + c with r = 0 the bottom row; 1 the player's bananas, -1 the coconuts
  const LINES = []; for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    const cells = []; for (let k = 0; k < 4; k++) { const rr = r + dr * k, cc = c + dc * k; if (rr < 0 || rr >= 6 || cc < 0 || cc >= 7) break; cells.push(rr * 7 + cc); } if (cells.length === 4) LINES.push(cells); } // the 69 lines of four
  const LINES_AT = Array.from({ length: 42 }, (_, i) => LINES.filter(w => w.includes(i)));
  const winAt = (b, i, who) => { for (const w of LINES_AT[i]) if (b[w[0]] === who && b[w[1]] === who && b[w[2]] === who && b[w[3]] === who) return w; return null; };
  function evalBoard(b, who) { let s = 0; // open lines: one, two and three of a kind (theirs weigh more at three), the middle column
    for (const w of LINES) { let m = 0, t = 0; for (const j of w) { if (b[j] === who) m++; else if (b[j] === -who) t++; } if (m && t) continue; if (m) s += m === 3 ? 30 : m === 2 ? 5 : 1; else if (t) s -= t === 3 ? 40 : t === 2 ? 5 : 1; }
    for (let r = 0; r < 6; r++) { const v = b[r * 7 + 3]; if (v) s += v === who ? 4 : -4; } return s; }
  function search(b, h, who, depth, alpha, beta, ply, S) { // negamax with alpha-beta, from who's side
    if ((++S.nodes & 1023) === 0 && performance.now() > S.until) S.stop = true; if (S.stop) return 0;
    for (const c of ORDER) { if (h[c] >= 6) continue; const i = h[c] * 7 + c; b[i] = who; const w = winAt(b, i, who); b[i] = 0; if (w) return 10000 - ply; }
    if (depth <= 0) return evalBoard(b, who);
    let best = -1e9, any = false;
    for (const c of ORDER) { if (h[c] >= 6) continue; any = true; const i = h[c] * 7 + c; b[i] = who; h[c]++;
      const v = -search(b, h, -who, depth - 1, -beta, -alpha, ply + 1, S); h[c]--; b[i] = 0; if (S.stop) return 0;
      if (v > best) best = v; if (v > alpha) alpha = v; if (alpha >= beta) break; }
    return any ? best : 0; } // a full rack: a draw
  function chooseMove(b, h, who, opp) {
    const legal = ORDER.filter(c => h[c] < 6); if (!legal.length) return -1;
    const rnd = () => { const w = legal.map(c => 4 - Math.abs(3 - c)); let x = Math.random() * w.reduce((a, v) => a + v, 0); for (let k = 0; k < legal.length; k++) { x -= w[k]; if (x <= 0) return legal[k]; } return legal[0]; };
    for (const c of legal) { const i = h[c] * 7 + c; b[i] = who; const w = winAt(b, i, who); b[i] = 0; if (w && Math.random() < opp.see) return c; }
    for (const c of legal) { const i = h[c] * 7 + c; b[i] = -who; const w = winAt(b, i, -who); b[i] = 0; if (w && Math.random() < opp.see) return c; }
    if (!opp.depth) return rnd();
    const S = { nodes: 0, until: performance.now() + opp.ms, stop: false }; let best = legal[0];
    for (let d = 1; d <= opp.depth; d++) { let bd = -1, bv = -1e9, alpha = -1e9;
      for (const c of [best, ...legal.filter(x => x !== best)]) { const i = h[c] * 7 + c; b[i] = who; h[c]++; let v = -search(b, h, -who, d - 1, -1e9, -alpha, 1, S); h[c]--; b[i] = 0; if (S.stop) break;
        v += (Math.random() - .5) * opp.noise; if (v > bv) { bv = v; bd = c; } if (v > alpha) alpha = v; }
      if (S.stop || bd < 0) break; best = bd; if (bv > 9000) break; } // a forced win: no need to look further
    return best; }
  const G = {
    title: 'Banana Drop',
    start(ctx) {
      const B = ctx.B, H = ctx.HUD, scene = ctx.scene, def = ctx.def, KEY = 'rebelAntsDropProgress:' + (def.id || 'four');
      let beaten = 0; try { beaten = Math.max(0, Math.min(OPP.length, Number(localStorage.getItem(KEY)) || 0)); } catch (e) {}
      const mat = (k, c, em) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(.06, .06, .06); if (em) m.emissiveColor = new B.Color3(...em); return m; });
      const woodM = mat('tikiWood', [.36, .23, .12], [.08, .05, .025]);
      const nodes = [], keep = n => { n.parent = n.parent || ctx.frame; ctx.add(n); nodes.push(n); if (n.isPickable !== undefined) n.isPickable = false; return n; };
      const W = 3.6, Y0R = 1.0; // the rack: a W x W face standing on its stand, bottom at Y0R
      { const base = keep(B.MeshBuilder.CreateBox('bdBase', { width: W + .7, height: .2, depth: 1 }, scene)); base.material = woodM; base.position.y = Y0R - .1;
        for (const x of [-1, 1]) { const p = keep(B.MeshBuilder.CreateBox('bdPost', { width: .16, height: Y0R + W + .1, depth: .2 }, scene)); p.material = woodM; p.position.set(x * (W / 2 + .12), (Y0R + W + .1) / 2, 0); }
        const top = keep(B.MeshBuilder.CreateBox('bdTop', { width: W + .4, height: .12, depth: .2 }, scene)); top.material = woodM; top.position.y = Y0R + W + .06;
        const back = keep(B.MeshBuilder.CreateBox('bdBack', { width: W, height: W, depth: .04 }, scene)); back.material = woodM; back.position.set(0, Y0R + W / 2, .08); }
      const TEX = 1024, tex = new B.DynamicTexture('bdTex', { width: TEX, height: TEX }, scene, true); tex.hasAlpha = false;
      const rackM = new B.StandardMaterial('bdRackMat', scene); rackM.diffuseTexture = tex; rackM.emissiveTexture = tex; rackM.emissiveColor = new B.Color3(.66, .66, .66); rackM.diffuseColor = new B.Color3(.5, .5, .5); rackM.specularColor = new B.Color3(0, 0, 0);
      const rack = keep(B.MeshBuilder.CreatePlane('bdRack', { width: W, height: W }, scene)); rack.material = rackM; rack.position.set(0, Y0R + W / 2, 0); rack.isPickable = true; rack.metadata = { bdRack: true };
      const CS = 120, X0 = (TEX - 7 * CS) / 2, Y0 = TEX - 6 * CS - 70; // the holes: 7 x 6 cells of CS px, the top margin for the banana in hand
      let g = null; // { k, opp, b, h, turn, last, drop: { c, r, who, t }, win: [cells], moves, hover, cur, over }
      const st = { phase: 'pick', t: 0, think: 0, dirty: false };
      const draw = () => { st.dirty = true; };
      const hole = (c, r) => [X0 + (c + .5) * CS, Y0 + (5 - r + .5) * CS];
      function disc(x2, y, who, a = 1) { const x = x2, R = CS * .4; tex.getContext().globalAlpha = a; const gg = tex.getContext();
        if (who === 1) { const gr = gg.createRadialGradient(x - R * .3, y - R * .35, R * .1, x, y, R); gr.addColorStop(0, '#fff1a0'); gr.addColorStop(1, '#e6b414'); gg.fillStyle = gr; gg.beginPath(); gg.arc(x, y, R, 0, Math.PI * 2); gg.fill();
          gg.strokeStyle = '#8a6a08'; gg.lineWidth = 4; gg.stroke(); gg.strokeStyle = '#7a5a06'; gg.lineWidth = R * .16; gg.lineCap = 'round'; gg.beginPath(); gg.arc(x + R * .2, y - R * .25, R * .52, Math.PI * .55, Math.PI * 1.05); gg.stroke(); } // a banana on the disc
        else { const gr = gg.createRadialGradient(x - R * .3, y - R * .35, R * .1, x, y, R); gr.addColorStop(0, '#a8784a'); gr.addColorStop(1, '#4e2c12'); gg.fillStyle = gr; gg.beginPath(); gg.arc(x, y, R, 0, Math.PI * 2); gg.fill();
          gg.strokeStyle = '#2a1608'; gg.lineWidth = 4; gg.stroke(); gg.fillStyle = '#24140a'; for (const [dx, dy] of [[-.22, -.12], [.22, -.12], [0, .22]]) { gg.beginPath(); gg.arc(x + dx * R, y + dy * R, R * .1, 0, Math.PI * 2); gg.fill(); } } // the coconut's three eyes
        gg.globalAlpha = 1; }
      function paint() { const x = tex.getContext();
        x.fillStyle = '#2b1a10'; x.fillRect(0, 0, TEX, TEX); x.fillStyle = 'rgba(255,200,120,.06)'; for (let y = 0; y < TEX; y += 18) x.fillRect(0, y, TEX, 6); // the bar's back wall
        x.fillStyle = '#1d6f63'; x.beginPath(); x.roundRect?.(X0 - 26, Y0 - 26, 7 * CS + 52, 6 * CS + 52, 26); if (!x.roundRect) x.rect(X0 - 26, Y0 - 26, 7 * CS + 52, 6 * CS + 52); x.fill(); // the tiki rack
        x.strokeStyle = '#0f3d36'; x.lineWidth = 8; x.stroke();
        for (let c = 0; c < 7; c++) for (let r = 0; r < 6; r++) { const [hx, hy] = hole(c, r), v = g ? g.b[r * 7 + c] : 0, dropping = g?.drop && g.drop.c === c && g.drop.r === r;
          x.fillStyle = '#10201d'; x.beginPath(); x.arc(hx, hy, CS * .42, 0, Math.PI * 2); x.fill(); if (v && !dropping) disc(hx, hy, v); }
        if (g?.drop) { const d = g.drop, [hx, hy] = hole(d.c, d.r), y0 = Y0 - CS * .55, u = Math.min(1, d.t / d.dur), y = y0 + (hy - y0) * u * u; disc(hx, y, d.who); }
        if (g?.win) { x.strokeStyle = '#ffffff'; x.lineWidth = 10; x.lineCap = 'round'; const [a, b2] = [g.win[0], g.win[3]].map(i => hole(i % 7, Math.floor(i / 7))); x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b2[0], b2[1]); x.stroke();
          for (const i of g.win) { const [hx, hy] = hole(i % 7, Math.floor(i / 7)); x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = 6; x.beginPath(); x.arc(hx, hy, CS * .46, 0, Math.PI * 2); x.stroke(); } }
        if (g && st.phase === 'play' && g.turn === 1 && !g.drop) { const c = g.hover ?? g.cur; disc(X0 + (c + .5) * CS, Y0 - CS * .55, 1, .85); // the banana in hand over its column
          x.fillStyle = 'rgba(255,230,140,.12)'; x.fillRect(X0 + c * CS + 6, Y0 - 8, CS - 12, 6 * CS + 16); }
        if (g && g.last >= 0 && !g.drop && !g.win) { const [hx, hy] = hole(g.last % 7, Math.floor(g.last / 7)); x.strokeStyle = 'rgba(255,211,106,.95)'; x.lineWidth = 5; x.beginPath(); x.arc(hx, hy, CS * .46, 0, Math.PI * 2); x.stroke(); }
        tex.update(); }
      const count = () => { let n = 0; for (const v of g.b) if (v === 1) n++; return n; };
      const info = () => { if (!g) { H.info('Pick an opponent'); return; } H.info(`${g.opp.name} · bananas ${count()} · ${st.phase === 'play' ? (g.drop ? '…' : g.turn === 1 ? 'your drop' : `${g.opp.name} is thinking`) : 'game over'}`); };
      function build(k) { g = { k, opp: OPP[k], b: new Int8Array(42), h: new Int8Array(7), turn: 1, last: -1, drop: null, win: null, moves: 0, hover: null, cur: 3 }; draw(); info(); }
      function drop(c, who) { if (g.h[c] >= 6) return false; const r = g.h[c]; g.h[c]++; g.b[r * 7 + c] = who; g.drop = { c, r, who, t: 0, dur: .14 + (6 - r) * .045 }; g.last = r * 7 + c; if (who === 1) g.moves++; draw(); info(); return true; }
      function landed() { const d = g.drop; g.drop = null; ctx.sound('thock'); const i = d.r * 7 + d.c, w = winAt(g.b, i, d.who);
        if (w) { g.win = w; end(d.who); return; } if (g.h.every(v => v >= 6)) { end(0); return; }
        g.turn = -d.who; st.think = g.turn === -1 ? .55 : 0; draw(); info(); }
      function playerDrop(c) { if (st.phase !== 'play' || !g || g.turn !== 1 || g.drop) return false; if (c < 0 || c > 6 || g.h[c] >= 6) { ctx.note(220, 'lantern'); H.msg('That column is full', 800); return false; } g.cur = c; return drop(c, 1); }
      function end(who) { st.phase = 'over'; st.wt = 0; g.result = who; draw(); const won = who === 1;
        if (won && g.k + 1 > beaten) { beaten = g.k + 1; try { localStorage.setItem(KEY, String(beaten)); } catch (e) {} }
        ctx.sound(won ? 'gamewin' : 'thock'); H.msg(won ? 'Four bananas!' : who === 0 ? 'A full rack' : `${g.opp.name} wins`, 1700, won ? `${g.moves} bananas` : who === 0 ? 'a draw' : 'four coconuts in a row'); info(); }
      const hud = document.getElementById('gameHud');
      const pick = document.createElement('div');
      pick.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(420px,92vw);background:rgba(16,12,6,.95);border:1px solid rgba(240,200,80,.6);border-radius:14px;padding:16px;text-align:center;pointer-events:auto;font:15px/1.4 system-ui,sans-serif;color:#eee';
      const drawPick = () => { pick.innerHTML = `<div style="font:800 13px/1.2 system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#f3c84a;margin-bottom:10px">Banana Drop</div><div style="margin-bottom:12px;color:#bbb">Drop bananas into the rack. Four in a line wins: across, up or slanted. You drop first.</div>`
        + `<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px">${OPP.map((o, k) => { const open = k <= beaten, ok = k < beaten; return `<button type="button" data-k="${k}" ${open ? '' : 'disabled'} style="padding:9px 4px;border-radius:9px;border:1px solid ${open ? '#f3c84a' : '#444'};background:${ok ? 'rgba(243,200,74,.18)' : 'rgba(255,255,255,.04)'};color:${open ? '#fff' : '#666'};font:700 15px system-ui,sans-serif;cursor:${open ? 'pointer' : 'default'}">${k + 1}. ${o.name}${ok ? ' ✓' : ''}<div style="font:500 11px system-ui;color:${open ? '#d8c89a' : '#666'}">${open ? o.says : 'beat the one before'}</div></button>`; }).join('')}</div>`
          + `<div style="margin-top:10px;font-size:12px;color:#998">Keys 1-${OPP.length} pick an opponent</div>`;
        pick.querySelectorAll('button[data-k]').forEach(b => b.onclick = (e) => { e.stopPropagation(); b.blur(); choose(+b.dataset.k); }); };
      function choose(k) { if (st.phase !== 'pick' || k > beaten || k >= OPP.length) return; pick.remove(); st.phase = 'play'; build(k); H.msg(OPP[k].name, 1000, 'you drop first'); }
      hud.append(pick); drawPick();
      const cam = [0, Y0R + W / 2 + .5, -5.6], at = [0, Y0R + W / 2, 0];
      ctx.player.place(0, -7.4, 0); // behind the camera, out of the picture
      ctx.look(cam, at, def.fov || .8); paint();
      H.title(def.title || 'Banana Drop'); H.score(''); info();
      H.hint('Click a column to drop a banana. <kbd>←</kbd> <kbd>→</kbd> and <kbd>Space</kbd>, or keys <kbd>1</kbd>-<kbd>7</kbd>, work too.');
      const colAt = () => { const hit = scene.pickWithRay(ctx.ray(), m => m.metadata?.bdRack); if (!hit?.pickedPoint) return null; const l = ctx.toLocal(hit.pickedPoint), px = (l.x + W / 2) / W * TEX, c = Math.floor((px - X0) / CS); return c >= 0 && c < 7 ? c : null; };
      return {
        update(dt) {
          ctx.look(cam, at); st.t += dt; if (st.dirty) { st.dirty = false; paint(); } if (!g) return;
          if (g.drop) { g.drop.t += dt; draw(); if (g.drop.t >= g.drop.dur) landed(); }
          else if (st.phase === 'play' && g.turn === -1 && (st.think -= dt) <= 0) { const c = chooseMove(g.b, g.h, -1, g.opp); if (c >= 0) drop(c, -1); }
          if (st.phase === 'over' && (st.wt += dt) > 2.2) { st.phase = 'done'; H.hint(''); const won = g.result === 1;
            ctx.finish({ score: won ? (g.k + 1) * 20 + (g.moves <= 12 ? 10 : 0) : 0, label: 'points', passed: won && (g.k + 1) * 20 >= (def.pass || 0), solved: won,
              extra: won ? `You beat ${g.opp.name} with ${g.moves} bananas.${g.k + 1 < OPP.length ? ` ${OPP[g.k + 1].name} will play you next.` : ' Nobody in the cove drops better.'}` : g.result === 0 ? `A full rack against ${g.opp.name}: a draw.` : `${g.opp.name} got four coconuts in a row.` }); }
        },
        key(e, down) {
          if (!down || e.repeat) return; const k = e.key.toLowerCase();
          if (st.phase === 'pick') { const n = parseInt(k, 10); if (n >= 1 && n <= OPP.length) choose(n - 1); return; }
          if (st.phase !== 'play' || !g) return; const n = parseInt(k, 10);
          if (n >= 1 && n <= 7) { g.hover = null; playerDrop(n - 1); return; }
          if (k === 'arrowleft' || k === 'a') { g.hover = null; g.cur = (g.cur + 6) % 7; draw(); } else if (k === 'arrowright' || k === 'd') { g.hover = null; g.cur = (g.cur + 1) % 7; draw(); }
          else if (k === ' ' || k === 'enter' || k === 'arrowdown' || k === 's') playerDrop(g.hover ?? g.cur);
        },
        pointer(evt) {
          const T = B.PointerEventTypes; if (st.phase !== 'play' || !g) return;
          if (evt.type === T.POINTERMOVE) { const c = colAt(); if (c !== g.hover && c != null) { g.hover = c; draw(); } }
          else if (evt.type === T.POINTERDOWN) { const c = colAt(); if (c != null) { g.hover = c; playerDrop(c); } }
        },
        _test: { st, choose, playerDrop, chooseMove, winAt, evalBoard, get g() { return g; }, OPP, paint: () => { st.dirty = false; paint(); }, unlock(k) { beaten = k; drawPick(); } },
        dispose() { pick.remove(); nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); try { rackM.dispose(); tex.dispose(); } catch (e) {} }
      };
    }
  };
  window.RebelGames.register('four', G);
})();
