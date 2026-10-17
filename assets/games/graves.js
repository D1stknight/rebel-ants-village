// The Restless Graves (Oct 15, Cute & Creepy): some plots hide restless spirits. Dig a plot (click) to see how many
// spirits lie in the plots around it (the eight around); set a candle on a plot you are sure of (Tab switches to
// candles, or press F). Clicking a number whose candles are all set digs the rest around it. Dig every quiet plot to
// win; dig a spirit and it rises. The first dig is always safe, and every graveyard can be cleared by reasoning
// alone (each is checked by a solver before you play, no guessing needed). Seven graveyards from 6 x 6 to 16 x 16.
// H shows one plot you can be sure of (no clean bonus then). Score: the graveyard x 20, +10 without a hint.
// Oct 17: How to play (the rules + a graveyard read part way, howto/graves.png) and Restart (a fresh graveyard of
// the same size: the spirits are laid again after the first dig, so that dig is safe again).
// def: { levels: [{ n, spirits }], pass, points }
(function () {
  const LEVELS = [{ n: 6, spirits: 5 }, { n: 8, spirits: 10 }, { n: 9, spirits: 14 }, { n: 10, spirits: 20 }, { n: 12, spirits: 30 }, { n: 14, spirits: 42 }, { n: 16, spirits: 56 }];
  const NUMC = ['', '#3b6fd8', '#2f8a3a', '#c8352c', '#2a2f8a', '#7a2a1a', '#2a8a8a', '#222', '#777'];
  // a logic-only solver: from the opened plots, apply "all mines found / all left are mines" and the subset rule
  // until stuck. Returns the set of plots it could open (safe) and mark (mines).
  function deduce(n, mines, open0) {
    const N = n * n, nb = i => { const x = i % n, y = Math.floor(i / n), o = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < n && Y < n) o.push(Y * n + X); } return o; };
    const cnt = i => nb(i).filter(j => mines.has(j)).length, open = new Set(), flag = new Set();
    const reveal = i => { const st = [i]; while (st.length) { const c = st.pop(); if (open.has(c) || mines.has(c)) continue; open.add(c); if (!cnt(c)) nb(c).forEach(j => { if (!open.has(j)) st.push(j); }); } };
    open0.forEach(reveal);
    for (let guard = 0; guard < 400; guard++) { let did = false; const front = [...open].filter(i => cnt(i) && nb(i).some(j => !open.has(j) && !flag.has(j)));
      const info = front.map(i => { const u = nb(i).filter(j => !open.has(j) && !flag.has(j)); return { u, k: cnt(i) - nb(i).filter(j => flag.has(j)).length }; });
      for (const { u, k } of info) { if (!u.length) continue; if (k === 0) { u.forEach(reveal); did = true; } else if (k === u.length) { u.forEach(j => flag.add(j)); did = true; } }
      if (!did) for (let a = 0; a < info.length && !did; a++) for (let b = 0; b < info.length && !did; b++) { if (a === b) continue; const A = info[a], Bf = info[b]; if (!A.u.length || A.u.length >= Bf.u.length || !A.u.every(j => Bf.u.includes(j))) continue;
        const rest = Bf.u.filter(j => !A.u.includes(j)), dk = Bf.k - A.k; if (dk === 0) { rest.forEach(reveal); did = true; } else if (dk === rest.length) { rest.forEach(j => flag.add(j)); did = true; } }
      if (!did) break; }
    return { open, flag, solved: open.size === N - mines.size };
  }
  const G = {
    title: 'The Restless Graves',
    howTo: { lines: [
      'Some plots hide restless spirits. Dig every quiet plot without waking one.',
      'Click a plot to dig it. A dug plot shows how many spirits lie in the eight plots around it; a blank one has none, and the plots around it open by themselves.',
      'When you are sure a plot hides a spirit, set a candle on it: Tab (or the button) switches between digging and candles, F sets one on the plot in the gold frame.',
      'Click a number whose candles are all set to dig every other plot around it at once.',
      'The first dig is always safe, and no graveyard ever needs a guess. H shows one quiet plot (no clean bonus then).',
      'Tip: a number with exactly that many hidden plots beside it has a spirit in every one of them.'],
      img: 'howto/graves.png', caption: 'Part way through: the 1 touches one hidden plot, so that plot holds a spirit; a candle marks it.' },
    start(ctx) {
      const B = ctx.B, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const LV = def.levels || LEVELS, KEY = 'rebelAntsGravesProgress:' + (def.id || 'graves');
      let solvedUpTo = 0; try { solvedUpTo = Math.max(0, Math.min(LV.length, Number(localStorage.getItem(KEY)) || 0)); } catch (e) {}
      const mat = (k, c, em) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(.05, .05, .05); if (em) m.emissiveColor = new B.Color3(...em); return m; });
      const stoneM = mat('kerb', [.3, .28, .32], [.06, .055, .07]);
      const nodes = [], keep = n => { n.parent = n.parent || ctx.frame; ctx.add(n); nodes.push(n); if (n.isPickable !== undefined) n.isPickable = false; return n; };
      const TEX = 1024, tex = new B.DynamicTexture('grTex', { width: TEX, height: TEX }, scene, true); tex.hasAlpha = false;
      const boardM = new B.StandardMaterial('grBoardMat', scene); boardM.diffuseTexture = tex; boardM.emissiveTexture = tex; boardM.emissiveColor = new B.Color3(.62, .62, .62); boardM.diffuseColor = new B.Color3(.55, .55, .55); boardM.specularColor = new B.Color3(0, 0, 0);
      const S = 4.4, TY = .25;
      { const k = keep(B.MeshBuilder.CreateBox('grKerb', { width: S + .5, height: TY, depth: S + .5 }, scene)); k.material = stoneM; k.position.y = TY / 2; }
      const board = keep(B.MeshBuilder.CreateGround('grBoard', { width: S, height: S }, scene)); board.material = boardM; board.position.y = TY + .005; board.isPickable = true; board.metadata = { grBoard: true };
      let bd = null; // { k, n, mines: Set|null, open: Set, flags: Set, hints, lost, hit, cur, time }
      const st = { phase: 'pick', t: 0, mode: 1 };
      const nbr = i => { const n = bd.n, x = i % n, y = Math.floor(i / n), o = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < n && Y < n) o.push(Y * n + X); } return o; };
      const count = i => nbr(i).filter(j => bd.mines.has(j)).length;
      function build(k) {
        const L = LV[k]; bd = { k, n: L.n, total: L.spirits, mines: null, open: new Set(), flags: new Set(), hints: 0, hit: -1, cur: Math.floor(L.n / 2) * L.n + Math.floor(L.n / 2), time: 0, ghost: null };
        ctx.player.place(0, cam[2] - 1.6, 0); draw(); info();
      }
      // the spirits are laid only after the first dig: none on or around it, and only a graveyard reasoning can clear
      function lay(first) {
        const n = bd.n, N = n * n, keepOut = new Set([first, ...nbr(first)]); let best = null;
        for (let t = 0; t < 600; t++) { const pool = [...Array(N).keys()].filter(i => !keepOut.has(i)); for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
          const mines = new Set(pool.slice(0, bd.total)); const r = deduce(n, mines, [first]); if (r.solved) { best = mines; break; } if (!best || r.open.size > best._open) { best = mines; best._open = r.open.size; } }
        bd.mines = best; bd.fair = deduce(n, best, [first]).solved;
      }
      const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
      const info = () => H.info(bd ? `Graveyard ${bd.k + 1} / ${LV.length} · ${bd.n} × ${bd.n} · spirits ${bd.total - bd.flags.size} · ${fmt(bd.time)} · ${st.mode === 1 ? 'digging' : 'candles'}${bd.hints ? ` · hints ${bd.hints}` : ''}` : 'Pick a graveyard');
      function draw() {
        const g = tex.getContext(), n = bd.n, C = TEX / n, over = st.phase === 'lost' || st.phase === 'done' && bd.hit >= 0;
        g.fillStyle = '#141018'; g.fillRect(0, 0, TEX, TEX);
        for (let i = 0; i < n * n; i++) { const x = (i % n) * C, y = Math.floor(i / n) * C, isOpen = bd.open.has(i);
          if (isOpen) { g.fillStyle = (i + Math.floor(i / n)) % 2 ? '#5b4a3a' : '#634f3e'; g.fillRect(x + 1, y + 1, C - 2, C - 2); const c = count(i); if (c) { g.fillStyle = NUMC[c]; g.font = `bold ${Math.round(C * .6)}px Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(c), x + C / 2, y + C * .54); } }
          else { g.fillStyle = (i + Math.floor(i / n)) % 2 ? '#2d4a2e' : '#335235'; g.fillRect(x + 1, y + 1, C - 2, C - 2); g.fillStyle = 'rgba(190,200,190,.25)'; g.fillRect(x + C * .46, y + C * .25, C * .08, C * .42); g.fillRect(x + C * .34, y + C * .35, C * .32, C * .07); }
          if (bd.flags.has(i) && !isOpen) { g.fillStyle = '#f2ead2'; g.fillRect(x + C * .42, y + C * .42, C * .16, C * .34); g.fillStyle = '#ffb030'; g.beginPath(); g.ellipse(x + C / 2, y + C * .34, C * .07, C * .11, 0, 0, Math.PI * 2); g.fill(); if (over && !bd.mines?.has(i)) { g.strokeStyle = '#e03030'; g.lineWidth = 4; g.beginPath(); g.moveTo(x + C * .2, y + C * .2); g.lineTo(x + C * .8, y + C * .8); g.stroke(); } }
          if (over && bd.mines?.has(i) && !bd.flags.has(i)) { g.fillStyle = i === bd.hit ? '#a82020' : 'rgba(0,0,0,0)'; g.fillRect(x + 1, y + 1, C - 2, C - 2); g.fillStyle = '#d8f2ff'; g.beginPath(); g.arc(x + C / 2, y + C * .45, C * .22, Math.PI, 0); g.lineTo(x + C * .72, y + C * .74); g.lineTo(x + C * .6, y + C * .66); g.lineTo(x + C * .5, y + C * .76); g.lineTo(x + C * .4, y + C * .66); g.lineTo(x + C * .28, y + C * .74); g.closePath(); g.fill(); g.fillStyle = '#222'; g.fillRect(x + C * .41, y + C * .4, C * .05, C * .07); g.fillRect(x + C * .54, y + C * .4, C * .05, C * .07); }
          if (bd.flash && bd.flash.i === i) { g.strokeStyle = '#40e070'; g.lineWidth = 6; g.strokeRect(x + 3, y + 3, C - 6, C - 6); } }
        if (st.phase === 'play') { const x = (bd.cur % n) * C, y = Math.floor(bd.cur / n) * C; g.strokeStyle = 'rgba(255,200,80,.85)'; g.lineWidth = 4; g.strokeRect(x + 2, y + 2, C - 4, C - 4); }
        tex.update();
      }
      function reveal(i) { const stack = [i]; while (stack.length) { const c = stack.pop(); if (bd.open.has(c) || bd.flags.has(c) || bd.mines.has(c)) continue; bd.open.add(c); if (!count(c)) nbr(c).forEach(j => { if (!bd.open.has(j)) stack.push(j); }); } }
      function dig(i) {
        if (st.phase !== 'play' || bd.flags.has(i)) return false;
        if (!bd.mines) lay(i);
        if (bd.open.has(i)) { const c = count(i), f = nbr(i).filter(j => bd.flags.has(j)).length; if (c && c === f) { const todo = nbr(i).filter(j => !bd.open.has(j) && !bd.flags.has(j)); if (todo.some(j => bd.mines.has(j))) { lose(todo.find(j => bd.mines.has(j))); return true; } todo.forEach(reveal); ctx.note(560, 'lantern'); draw(); check(); return true; } return false; }
        if (bd.mines.has(i)) { lose(i); return true; }
        reveal(i); ctx.note(480 + Math.min(8, count(i)) * 40, 'lantern'); draw(); info(); check(); return true;
      }
      function flag(i) { if (st.phase !== 'play' || bd.open.has(i)) return; if (bd.flags.has(i)) bd.flags.delete(i); else bd.flags.add(i); ctx.note(880, 'bell'); draw(); info(); }
      function lose(i) { bd.hit = i; st.phase = 'lost'; st.wt = 0; ctx.sound('thock'); H.msg('A spirit rises', 1600, 'the graveyard is restless'); pads.style.display = 'none'; draw();
        try { const gh = ctx.kit('cc_ghost'); const n = bd.n, c = S / n; gh.position.set(-S / 2 + (i % n + .5) * c, TY, S / 2 - (Math.floor(i / n) + .5) * c); gh.scaling.setAll(.55); bd.ghost = gh; } catch (e) {} }
      function check() { if (bd.open.size !== bd.n * bd.n - bd.total) return; st.phase = 'won'; st.wt = 0; bd.mines.forEach(i => bd.flags.add(i)); draw(); pads.style.display = 'none'; ctx.sound('gamewin'); H.msg('The graveyard sleeps', 1600, fmt(bd.time));
        if (bd.k + 1 > solvedUpTo) { solvedUpTo = bd.k + 1; try { localStorage.setItem(KEY, String(solvedUpTo)); } catch (e) {} } }
      function hint() {
        if (st.phase !== 'play') return; if (!bd.mines) { H.msg('Dig anywhere first: the first dig is always safe', 1500); return; }
        // a plot the reasoning can prove safe from what is open (else any quiet plot)
        const r = deduce(bd.n, bd.mines, [...bd.open]); let i = [...r.open].find(j => !bd.open.has(j)); if (i == null) i = [...Array(bd.n * bd.n).keys()].find(j => !bd.open.has(j) && !bd.mines.has(j)); if (i == null) return;
        bd.hints++; bd.flash = { i, t: 0 }; bd.cur = i; draw(); info(); H.msg('That plot is quiet', 1200);
      }
      const hud = document.getElementById('gameHud');
      const pick = document.createElement('div');
      pick.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(400px,90vw);background:rgba(14,10,20,.95);border:1px solid rgba(150,230,170,.55);border-radius:14px;padding:16px;text-align:center;pointer-events:auto;font:15px/1.4 system-ui,sans-serif;color:#eee';
      const drawPick = () => { pick.innerHTML = `<div style="font:800 13px/1.2 system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#a8f0bc;margin-bottom:10px">The Restless Graves</div><div style="margin-bottom:12px;color:#bbb">A dug plot counts the spirits around it. Never a guess needed.</div>`
        + `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">${LV.map((L, k) => { const open = k <= solvedUpTo, ok = k < solvedUpTo; return `<button type="button" data-k="${k}" ${open ? '' : 'disabled'} style="padding:8px 2px;border-radius:9px;border:1px solid ${open ? '#a8f0bc' : '#444'};background:${ok ? 'rgba(168,240,188,.2)' : 'rgba(255,255,255,.04)'};color:${open ? '#fff' : '#666'};font:700 15px system-ui,sans-serif;cursor:${open ? 'pointer' : 'default'}">${open ? `${k + 1}<div style="font:11px system-ui;opacity:.75">${L.n}×${L.n} · ${L.spirits} 👻</div>` : '🔒'}${ok ? ' ✓' : ''}</button>`; }).join('')}</div>`;
        pick.querySelectorAll('button[data-k]').forEach(b => b.onclick = (e) => { e.stopPropagation(); b.blur(); choose(+b.dataset.k); }); };
      const pads = document.createElement('div');
      pads.style.cssText = 'position:absolute;bottom:62px;right:14px;display:none;gap:6px;pointer-events:auto';
      const padBtn = (t, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.style.cssText = 'min-width:52px;height:40px;padding:0 10px;border-radius:9px;border:1px solid #86c99a;background:rgba(10,18,12,.88);color:#eaffef;font:700 15px system-ui;cursor:pointer'; b.onclick = (e) => { e.stopPropagation(); b.blur(); fn(); }; pads.appendChild(b); return b; };
      const modeBtn = padBtn('⛏ Dig', () => toggleMode()); padBtn('Hint', hint);
      function toggleMode() { st.mode = st.mode === 1 ? 2 : 1; modeBtn.textContent = st.mode === 1 ? '⛏ Dig' : '🕯 Candle'; if (bd) info(); }
      function choose(k) { if (st.phase !== 'pick' || k > solvedUpTo || k >= LV.length) return; pick.remove(); st.phase = 'play'; build(k); pads.style.display = 'flex'; H.msg(`Graveyard ${k + 1}`, 900, `${LV[k].spirits} restless spirits`); }
      hud.append(pick, pads); drawPick();
      const cam = [0, TY + 6.4, -3.3], at = [0, TY, .1];
      ctx.player.place(0, cam[2] - 1.6, 0); ctx.look(cam, at, def.fov || .8); // the player waits behind the camera, out of the picture
      { const g = tex.getContext(); g.fillStyle = '#2d4a2e'; g.fillRect(0, 0, TEX, TEX); tex.update(); }
      H.title(def.title || 'The Restless Graves'); H.score(''); info();
      H.hint('Click a plot to dig; <kbd>Tab</kbd> (or the button) switches to candles for spirits; <kbd>F</kbd> sets one on the square you are on. <kbd>H</kbd> hint.');
      const act = i => { if (st.mode === 2) flag(i); else dig(i); };
      return {
        update(dt) {
          ctx.look(cam, at); st.t += dt; if (!bd) return;
          if (st.phase === 'play' && bd.mines) { const s = Math.floor(bd.time); bd.time += dt; if (Math.floor(bd.time) !== s) info(); }
          if (bd.flash && (bd.flash.t += dt) > 1.6) { bd.flash = null; draw(); }
          if (bd.ghost) { bd.ghost.position.y = Math.min(TY + 1.4, bd.ghost.position.y + dt * .9); }
          if ((st.phase === 'won' || st.phase === 'lost') && (st.wt += dt) > 2) { const won = st.phase === 'won'; st.phase = 'done'; H.hint(''); const k = bd.k;
            ctx.finish(won ? { score: (k + 1) * 20 + (bd.hints ? 0 : 10), label: 'points', solved: true, extra: `Graveyard ${k + 1} (${bd.n} × ${bd.n}, ${bd.total} spirits) cleared in ${fmt(bd.time)}${bd.hints ? `, ${bd.hints} hint${bd.hints > 1 ? 's' : ''}` : ''}.${k + 1 < LV.length ? ` Graveyard ${k + 2} is open.` : ' Every graveyard sleeps.'}` }
              : { score: 0, label: 'points', passed: false, solved: false, extra: `A spirit woke in graveyard ${k + 1}: ${bd.open.size} of ${bd.n * bd.n - bd.total} quiet plots dug.` }); }
        },
        key(e, down) {
          if (!down || e.repeat) return; const k = e.key.toLowerCase();
          if (st.phase === 'pick') { const n = k === '0' ? 10 : parseInt(k, 10); if (n >= 1 && n <= LV.length) choose(n - 1); return; } // 1-9, 0 = the tenth
          if (st.phase !== 'play') return; const n = bd.n, x = bd.cur % n, y = Math.floor(bd.cur / n);
          if (k === 'arrowup' || k === 'w') { bd.cur = ((y - 1 + n) % n) * n + x; draw(); } else if (k === 'arrowdown' || k === 's') { bd.cur = ((y + 1) % n) * n + x; draw(); }
          else if (k === 'arrowleft' || k === 'a') { bd.cur = y * n + (x - 1 + n) % n; draw(); } else if (k === 'arrowright' || k === 'd') { bd.cur = y * n + (x + 1) % n; draw(); }
          else if (k === ' ' || k === 'enter') dig(bd.cur); else if (k === 'f' || k === 'x') flag(bd.cur); else if (k === 'h') hint(); else if (k === 'tab') { e.preventDefault?.(); toggleMode(); }
        },
        pointer(evt) {
          if (evt.type !== B.PointerEventTypes.POINTERDOWN || st.phase !== 'play' || !bd) return;
          const hit = scene.pickWithRay(ctx.ray(), m => m.metadata?.grBoard); if (!hit?.pickedPoint) return;
          const l = ctx.toLocal(hit.pickedPoint), n = bd.n, c = Math.floor((l.x + S / 2) / S * n), r = Math.floor((S / 2 - l.z) / S * n);
          if (c >= 0 && c < n && r >= 0 && r < n) { bd.cur = r * n + c; act(bd.cur); }
        },
        // Restart: a fresh graveyard of the same size (no plots dug, no candles, hints or time); the spirits are laid
        // again after the first dig, so that dig is safe again; only while it is being played
        restart() { if (st.phase !== 'play' || !bd) return; build(bd.k); H.msg('Start again', 900); },
        _test: { st, choose, dig, flag, hint, toggleMode, deduce, get bd() { return bd; }, LV, count },
        dispose() { pick.remove(); pads.remove(); nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); try { boardM.dispose(); tex.dispose(); } catch (e) {} }
      };
    }
  };
  window.RebelGames.register('graves', G);
})();
