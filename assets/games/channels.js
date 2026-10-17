// The Irrigation Channels (Oct 15, Ashigaru): every pair of sluice gates of one colour must be joined by a channel.
// Channels run square to square (no diagonals), never cross or share a square, and together they must water every
// field on the map. Drag from a gate to dig; drag back to fill in; digging through another channel cuts it there.
// Seven maps from 5 x 5 to the 10 x 10 Great Irrigation, each with exactly one answer (checked by a solver).
// H shows one channel whole (no clean bonus). Score: the map x 20, +10 without a hint. def: { levels, pass, points }
// Oct 17: How to play (the rules + a solved 5 x 5, howto/channels.png) and Restart (the map afresh: no channels, undo,
// hints or time; the Clear button still empties the map as one undoable step).
(function () {
  const LEVELS = [
    { name: "The First Paddy", n: 5, ends: [[9,18],[11,4],[21,12],[20,2],[22,19]], paths: [[9,14,13,18],[11,6,7,8,3,4],[21,16,17,12],[20,15,10,5,0,1,2],[22,23,24,19]] },
    { name: "Twin Terraces", n: 6, ends: [[5,7],[14,18],[17,10],[25,30],[28,31],[33,16]], paths: [[5,4,3,9,15,21,20,19,13,7],[14,8,2,1,0,6,12,18],[17,11,10],[25,24,30],[28,27,26,32,31],[33,34,35,29,23,22,16]] },
    { name: "The Millpond", n: 7, ends: [[18,22],[19,11],[20,29],[33,16],[38,48],[43,13],[44,36]], paths: [[18,17,10,9,8,15,22],[19,12,11],[20,27,34,41,40,39,32,31,30,29],[33,26,25,24,23,16],[38,45,46,47,48],[43,42,35,28,21,14,7,0,1,2,3,4,5,6,13],[44,37,36]] },
    { name: "The Long Fields", n: 8, ends: [[0,16],[21,48],[22,27],[32,2],[44,37],[46,51],[38,28],[49,56]], paths: [[0,8,16],[21,29,30,31,23,15,7,6,5,4,3,11,10,18,26,34,33,41,40,48],[22,14,13,12,20,19,27],[32,24,25,17,9,1,2],[44,45,37],[46,54,53,52,51],[38,39,47,55,63,62,61,60,59,58,50,42,43,35,36,28],[49,57,56]] },
    { name: "The Flooded Valley", n: 8, ends: [[14,41],[30,40],[27,17],[25,42],[38,29],[44,53],[45,54],[56,0]], paths: [[14,13,12,11,10,9,8,16,24,32,33,41],[30,22,21,20,28,36,35,43,51,50,49,48,40],[27,19,18,17],[25,26,34,42],[38,37,29],[44,52,53],[45,46,54],[56,57,58,59,60,61,62,63,55,47,39,31,23,15,7,6,5,4,3,2,1,0]] },
    { name: "The Lantern Keeper's Fields", n: 9, ends: [[9,1],[72,53],[62,48],[34,12],[38,31],[51,68],[65,32],[79,57],[80,60]], paths: [[9,0,1],[72,63,54,45,36,27,18,19,10,11,2,3,4,5,6,7,8,17,26,35,44,53],[62,61,52,43,42,33,24,23,22,21,20,29,28,37,46,47,48],[34,25,16,15,14,13,12],[38,39,30,31],[51,50,59,68],[65,66,67,58,49,40,41,32],[79,78,77,76,75,74,73,64,55,56,57],[80,71,70,69,60]] },
    { name: "The Great Irrigation", n: 10, ends: [[0,2],[9,37],[31,26],[28,45],[60,8],[54,77],[38,25],[43,88],[69,76],[73,52],[81,74]], paths: [[0,1,2],[9,19,18,17,27,37],[31,21,22,23,24,14,15,16,26],[28,29,39,49,59,58,57,56,55,45],[60,50,40,30,20,10,11,12,13,3,4,5,6,7,8],[54,44,34,33,32,42,41,51,61,71,70,80,90,91,92,93,94,95,96,97,98,99,89,79,78,77],[38,48,47,46,36,35,25],[43,53,63,64,65,75,85,86,87,88],[69,68,67,66,76],[73,72,62,52],[81,82,83,84,74]] }
  ];
  const COL = ['#e2463a', '#2f7fe0', '#f2c230', '#3fbf5a', '#e07a2a', '#9a5ad8', '#2cc4c4', '#e65aa6', '#8a6a3a', '#f0f0f0', '#23202e', '#a0c8ff'];
  const G = {
    title: 'The Irrigation Channels',
    howTo: { lines: [
      'Join each pair of sluice gates of the same colour with a channel.',
      'Channels run from square to square (up, down, left, right, never diagonally) and never cross or share a square.',
      'The map is done only when the channels together water every field: no square may stay dry.',
      'Drag from a gate to dig, and back over a channel to fill it in. Digging through another channel cuts it there. Keys: arrows move, Space picks up and drops.',
      'U undoes, Clear empties the map, H digs one channel for you.',
      'Tip: start with the gates in corners and along the edges: their channels have the fewest ways to go.'],
      img: 'howto/channels.png', caption: 'A solved 5 x 5 map: every pair joined, no channels crossing, every field watered.' },
    start(ctx) {
      const B = ctx.B, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const LV = def.levels || LEVELS, KEY = 'rebelAntsChannelsProgress:' + (def.id || 'channels');
      let solvedUpTo = 0; try { solvedUpTo = Math.max(0, Math.min(LV.length, Number(localStorage.getItem(KEY)) || 0)); } catch (e) {}
      const mat = (k, c, em) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(.05, .05, .05); if (em) m.emissiveColor = new B.Color3(...em); return m; });
      const earthM = mat('bund', [.36, .26, .16], [.08, .06, .035]);
      const nodes = [], keep = n => { n.parent = n.parent || ctx.frame; ctx.add(n); nodes.push(n); if (n.isPickable !== undefined) n.isPickable = false; return n; };
      const TEX = 1024, tex = new B.DynamicTexture('chTex', { width: TEX, height: TEX }, scene, true); tex.hasAlpha = false;
      const boardM = new B.StandardMaterial('chBoardMat', scene); boardM.diffuseTexture = tex; boardM.emissiveTexture = tex; boardM.emissiveColor = new B.Color3(.6, .6, .6); boardM.diffuseColor = new B.Color3(.55, .55, .55); boardM.specularColor = new B.Color3(0, 0, 0);
      const S = 4.2, TY = .35;
      { const k = keep(B.MeshBuilder.CreateBox('chBund', { width: S + .5, height: TY, depth: S + .5 }, scene)); k.material = earthM; k.position.y = TY / 2; }
      const board = keep(B.MeshBuilder.CreateGround('chBoard', { width: S, height: S }, scene)); board.material = boardM; board.position.y = TY + .005; board.isPickable = true; board.metadata = { chBoard: true };
      const M = 26, GS = TEX - 2 * M;
      let bd = null; // { k, n, L, endOf: Int8Array, paths: [[cells]], undo: [], hints, time, cur, sel }
      const st = { phase: 'pick', t: 0, drag: null };
      const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
      const adj = (a, b) => { const n = bd.n; return (Math.abs(a - b) === n) || (Math.abs(a - b) === 1 && Math.floor(a / n) === Math.floor(b / n)); };
      function build(k) { const L = LV[k], n = L.n; bd = { k, n, L, endOf: new Int8Array(n * n).fill(-1), paths: L.ends.map(() => []), undo: [], hints: 0, time: 0, cur: L.ends[0][0], sel: -1 };
        L.ends.forEach(([a, b], j) => { bd.endOf[a] = j; bd.endOf[b] = j; }); ctx.player.place(0, cam[2] - 1.6, 0); draw(); info(); }
      const ownerMap = () => { const o = new Int8Array(bd.n * bd.n).fill(-1); bd.paths.forEach((p, j) => p.forEach(c => o[c] = j)); bd.L.ends.forEach(([a, b], j) => { o[a] = j; o[b] = j; }); return o; };
      const joined = j => { const p = bd.paths[j], [a, b] = bd.L.ends[j]; return p.length >= 2 && ((p[0] === a && p[p.length - 1] === b) || (p[0] === b && p[p.length - 1] === a)); };
      const watered = () => { const o = ownerMap(); let w = 0; for (let i = 0; i < o.length; i++) if (o[i] >= 0) w++; return w; };
      const info = () => H.info(bd ? `Map ${bd.k + 1} / ${LV.length} · ${bd.L.name} · channels ${bd.paths.filter((p, j) => joined(j)).length} / ${bd.paths.length} · fields ${Math.round(watered() / (bd.n * bd.n) * 100)}% · ${fmt(bd.time)}${bd.hints ? ` · hints ${bd.hints}` : ''}` : 'Pick a map');
      function draw() {
        const g = tex.getContext(), n = bd.n, C = GS / n, o = ownerMap();
        g.fillStyle = '#3a2a18'; g.fillRect(0, 0, TEX, TEX);
        for (let i = 0; i < n * n; i++) { const x = M + (i % n) * C, y = M + Math.floor(i / n) * C; g.fillStyle = (i + Math.floor(i / n)) % 2 ? '#6f8a3e' : '#789446'; g.fillRect(x + 1, y + 1, C - 2, C - 2);
          if (o[i] >= 0) { g.fillStyle = COL[o[i] % COL.length]; g.globalAlpha = .22; g.fillRect(x + 1, y + 1, C - 2, C - 2); g.globalAlpha = 1; } }
        const ctr = i => [M + (i % n + .5) * C, M + (Math.floor(i / n) + .5) * C];
        g.lineCap = 'round'; g.lineJoin = 'round';
        bd.paths.forEach((p, j) => { if (p.length < 2) return; const done = joined(j);
          g.strokeStyle = COL[j % COL.length]; g.lineWidth = C * (done ? .42 : .34); g.beginPath(); p.forEach((c, q) => { const [x, y] = ctr(c); q ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
          g.strokeStyle = 'rgba(190,230,255,.55)'; g.lineWidth = C * .1; g.beginPath(); p.forEach((c, q) => { const [x, y] = ctr(c); q ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); });
        bd.L.ends.forEach(([a, b], j) => { for (const c of [a, b]) { const [x, y] = ctr(c), done = joined(j); g.fillStyle = COL[j % COL.length]; g.beginPath(); g.arc(x, y, C * .36, 0, Math.PI * 2); g.fill();
          g.lineWidth = Math.max(3, C * .07); g.strokeStyle = done ? '#fff7d0' : 'rgba(30,20,10,.75)'; g.stroke(); g.fillStyle = 'rgba(30,20,10,.55)'; g.fillRect(x - C * .18, y - C * .05, C * .36, C * .1); } });
        if (st.phase === 'play') { const x = M + (bd.cur % n) * C, y = M + Math.floor(bd.cur / n) * C; g.strokeStyle = 'rgba(255,230,120,.9)'; g.lineWidth = 5; g.strokeRect(x + 3, y + 3, C - 6, C - 6); }
        if (bd.flash) { g.strokeStyle = '#ffffff'; g.lineWidth = 8; for (const c of bd.flash.cells) { const x = M + (c % n) * C, y = M + Math.floor(c / n) * C; g.strokeRect(x + 4, y + 4, C - 8, C - 8); } }
        tex.update();
      }
      const snap = () => bd.paths.map(p => p.slice());
      // begin a stroke at square i: a gate starts its channel afresh, a channel square picks that channel up there
      function begin(i) { if (st.phase !== 'play') return false; const e = bd.endOf[i]; let j = -1;
        if (e >= 0) { j = e; st.drag = { j, before: snap() }; bd.paths[j] = [i]; }
        else { j = bd.paths.findIndex(p => p.includes(i)); if (j < 0) return false; st.drag = { j, before: snap() }; const p = bd.paths[j]; bd.paths[j] = p.slice(0, p.indexOf(i) + 1); }
        bd.cur = i; bd.sel = j; draw(); return true; }
      function step(i) { // grow the stroke's channel by one square next to its head
        const d = st.drag; if (!d) return false; const p = bd.paths[d.j], head = p[p.length - 1]; if (!adj(head, i)) return false;
        const at = p.indexOf(i); if (at >= 0) { bd.paths[d.j] = p.slice(0, at + 1); return true; }  // back over itself: fill in
        if (joined(d.j)) return false;                                                                       // finished: no further
        const e = bd.endOf[i]; if (e >= 0 && e !== d.j) return false;                                         // another colour's gate
        if (e === d.j && i === p[0]) return false;
        const other = bd.paths.findIndex((q, k) => k !== d.j && q.includes(i)); if (other >= 0) { const q = bd.paths[other]; bd.paths[other] = q.slice(0, q.indexOf(i)); if (bd.paths[other].length === 1 && bd.endOf[bd.paths[other][0]] < 0) bd.paths[other] = []; }
        p.push(i); if (e === d.j) ctx.note(560 + d.j * 30, 'bell'); return true; }
      function toward(i) { // follow the pointer square by square (a fast drag skips squares)
        const d = st.drag; if (!d) return; const n = bd.n; let guard = 0;
        while (guard++ < 40) { const p = bd.paths[d.j], head = p[p.length - 1]; if (head === i) break; const hr = Math.floor(head / n), hc = head % n, tr = Math.floor(i / n), tc = i % n;
          const nx = Math.abs(tr - hr) >= Math.abs(tc - hc) ? head + Math.sign(tr - hr) * n : head + Math.sign(tc - hc); if (!step(nx)) break; }
        bd.cur = i; draw(); info(); }
      function end() { const d = st.drag; if (!d) return; st.drag = null; if (JSON.stringify(d.before) !== JSON.stringify(bd.paths)) { bd.undo.push(d.before); if (bd.undo.length > 300) bd.undo.shift(); }
        // a lone gate square is no channel
        bd.paths = bd.paths.map(p => p.length === 1 ? [] : p); draw(); info(); check(); }
      function undo() { if (st.phase !== 'play') return; const s = bd.undo.pop(); if (!s) return; bd.paths = s; ctx.note(330, 'lantern'); draw(); info(); }
      function restart() { if (st.phase !== 'play') return; bd.undo.push(snap()); bd.paths = bd.paths.map(() => []); draw(); info(); }
      // the HUD's Restart: the map as it was picked (no undo, hints or time either)
      function startOver() { if (st.phase !== 'play' || !bd) return; st.drag = null; build(bd.k); H.msg('Start again', 900); }
      function hint() { if (st.phase !== 'play') return; const sol = bd.L.paths;
        // the first channel not dug as it should be: dug whole, cutting what lies in its way
        const same = (p, q) => p.length === q.length && (p.every((c, i) => c === q[i]) || p.every((c, i) => c === q[q.length - 1 - i]));
        const j = sol.findIndex((q, k) => !same(bd.paths[k], q)); if (j < 0) return;
        bd.undo.push(snap()); bd.hints++; const set = new Set(sol[j]);
        bd.paths = bd.paths.map((p, k) => { if (k === j) return sol[j].slice(); const cut = p.findIndex(c => set.has(c)); return cut < 0 ? p : cut < 2 ? [] : p.slice(0, cut); });
        bd.flash = { cells: sol[j], t: 0 }; H.msg('One channel, dug whole', 1200); draw(); info(); check(); }
      function check() { if (!bd.paths.every((p, j) => joined(j)) || watered() !== bd.n * bd.n) return false;
        st.phase = 'won'; st.wt = 0; st.drag = null; draw(); pads.style.display = 'none'; ctx.sound('gamewin'); H.msg('Every field is watered', 1600, fmt(bd.time));
        if (bd.k + 1 > solvedUpTo) { solvedUpTo = bd.k + 1; try { localStorage.setItem(KEY, String(solvedUpTo)); } catch (e) {} } return true; }
      const hud = document.getElementById('gameHud');
      const pick = document.createElement('div');
      pick.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(420px,92vw);background:rgba(14,20,8,.95);border:1px solid rgba(160,210,90,.6);border-radius:14px;padding:16px;text-align:center;pointer-events:auto;font:15px/1.4 system-ui,sans-serif;color:#eee';
      const drawPick = () => { pick.innerHTML = `<div style="font:800 13px/1.2 system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#b8e070;margin-bottom:10px">The Irrigation Channels</div><div style="margin-bottom:12px;color:#bbb">Join each pair of gates. Channels never cross, and every field gets water.</div>`
        + `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">${LV.map((L, k) => { const open = k <= solvedUpTo, ok = k < solvedUpTo; return `<button type="button" data-k="${k}" ${open ? '' : 'disabled'} style="padding:8px 2px;border-radius:9px;border:1px solid ${open ? '#b8e070' : '#444'};background:${ok ? 'rgba(184,224,112,.2)' : 'rgba(255,255,255,.04)'};color:${open ? '#fff' : '#666'};font:700 15px system-ui,sans-serif;cursor:${open ? 'pointer' : 'default'}">${open ? `${k + 1}<div style="font:11px system-ui;opacity:.75">${L.n}×${L.n} · ${L.ends.length} gates</div>` : '🔒'}${ok ? ' ✓' : ''}</button>`; }).join('')}</div>`;
        pick.querySelectorAll('button[data-k]').forEach(b => b.onclick = (e) => { e.stopPropagation(); b.blur(); choose(+b.dataset.k); }); };
      const pads = document.createElement('div');
      pads.style.cssText = 'position:absolute;bottom:62px;right:14px;display:none;gap:6px;pointer-events:auto';
      const padBtn = (t, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.style.cssText = 'min-width:52px;height:40px;padding:0 10px;border-radius:9px;border:1px solid #a8cc66;background:rgba(14,22,8,.88);color:#f0ffd8;font:700 15px system-ui;cursor:pointer'; b.onclick = (e) => { e.stopPropagation(); b.blur(); fn(); }; pads.appendChild(b); return b; };
      padBtn('Undo', undo); padBtn('Clear', restart); padBtn('Hint', hint);
      function choose(k) { if (st.phase !== 'pick' || k > solvedUpTo || k >= LV.length) return; pick.remove(); st.phase = 'play'; build(k); pads.style.display = 'flex'; H.msg(`Map ${k + 1}`, 900, `${LV[k].name}: ${LV[k].ends.length} pairs of gates`); }
      hud.append(pick, pads); drawPick();
      const cam = [0, TY + 6.2, -3.5], at = [0, TY, -.3];
      ctx.player.place(0, cam[2] - 1.6, 0); ctx.look(cam, at, def.fov || .8); // the player waits behind the camera, out of the picture
      { const g = tex.getContext(); g.fillStyle = '#6f8a3e'; g.fillRect(0, 0, TEX, TEX); tex.update(); }
      H.title(def.title || 'The Irrigation Channels'); H.score(''); info();
      H.hint('Drag from a gate to dig its channel, back over it to fill in. Keys: arrows move, <kbd>Space</kbd> picks up / drops. <kbd>U</kbd> undo, <kbd>H</kbd> hint.');
      const cellAt = () => { const hit = scene.pickWithRay(ctx.ray(), m => m.metadata?.chBoard); if (!hit?.pickedPoint) return -1; const l = ctx.toLocal(hit.pickedPoint), n = bd.n, C = GS / n;
        const px = (l.x + S / 2) / S * TEX, py = (S / 2 - l.z) / S * TEX, c = Math.floor((px - M) / C), r = Math.floor((py - M) / C); return c >= 0 && c < n && r >= 0 && r < n ? r * n + c : -1; };
      return {
        update(dt) {
          ctx.look(cam, at); st.t += dt; if (!bd) return;
          if (st.phase === 'play') { const s = Math.floor(bd.time); bd.time += dt; if (Math.floor(bd.time) !== s) info(); }
          if (bd.flash && (bd.flash.t += dt) > 1.4) { bd.flash = null; draw(); }
          if (st.phase === 'won' && (st.wt += dt) > 2) { st.phase = 'done'; H.hint(''); const k = bd.k;
            ctx.finish({ score: (k + 1) * 20 + (bd.hints ? 0 : 10), label: 'points', solved: true, extra: `${bd.L.name} (map ${k + 1}, ${bd.n} × ${bd.n}, ${bd.L.ends.length} channels) watered in ${fmt(bd.time)}${bd.hints ? `, ${bd.hints} hint${bd.hints > 1 ? 's' : ''}` : ''}.${k + 1 < LV.length ? ` Map ${k + 2} is open.` : ' Every field in the valley is watered.'}` }); }
        },
        key(e, down) {
          if (!down || e.repeat) return; const k = e.key.toLowerCase();
          if (st.phase === 'pick') { const n = k === '0' ? 10 : parseInt(k, 10); if (n >= 1 && n <= LV.length) choose(n - 1); return; } // 1-9, 0 = the tenth
          if (st.phase !== 'play') return; const n = bd.n, x = bd.cur % n, y = Math.floor(bd.cur / n); let nx = -1;
          if (k === 'arrowup' || k === 'w') nx = y > 0 ? bd.cur - n : -1; else if (k === 'arrowdown' || k === 's') nx = y < n - 1 ? bd.cur + n : -1;
          else if (k === 'arrowleft' || k === 'a') nx = x > 0 ? bd.cur - 1 : -1; else if (k === 'arrowright' || k === 'd') nx = x < n - 1 ? bd.cur + 1 : -1;
          if (nx >= 0) { if (st.drag) toward(nx); else { bd.cur = nx; draw(); } return; }
          if (k === ' ' || k === 'enter') { if (st.drag) end(); else begin(bd.cur); return; }
          if (k === 'u' || (k === 'z' && (e.ctrlKey || e.metaKey))) { if (st.drag) end(); undo(); } else if (k === 'h') { if (st.drag) end(); hint(); }
        },
        pointer(evt) {
          const T = B.PointerEventTypes; if (st.phase !== 'play' || !bd) return;
          if (evt.type === T.POINTERDOWN) { const i = cellAt(); if (i >= 0) begin(i); }
          else if (evt.type === T.POINTERMOVE && st.drag) { const i = cellAt(); if (i >= 0) toward(i); }
          else if (evt.type === T.POINTERUP && st.drag) end();
        },
        restart: startOver,
        _test: { st, choose, begin, step, toward, end, undo, hint, restart, startOver, joined, watered, get bd() { return bd; }, LV, draw, unlock(k) { solvedUpTo = k; drawPick(); } },
        dispose() { pick.remove(); pads.remove(); nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); try { boardM.dispose(); tex.dispose(); } catch (e) {} }
      };
    }
  };
  window.RebelGames.register('channels', G);
})();
