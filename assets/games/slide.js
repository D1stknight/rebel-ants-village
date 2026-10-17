// The Broken Seal (Oct 15, Shogun Court of Records): the Shogun's seal lies cut into slabs on the court sand with one
// slab missing; slide the slabs back into place. Click a slab in line with the gap (the slabs between move with it), or
// press an arrow to move the slab next to the gap that way. Levels 3 x 3, 4 x 4 and 5 x 5; a level opens when the one
// before is solved. Each slab carries its number in a corner.
// Oct 17: How to play (the rules in a few lines) and Restart (the same mixed seal as it was dealt, moves and time 0).
// def: { at: [x, z] (board middle, frame coordinates), size: board width (m), player: [x, z, yaw], cam, look, emblem, pass, points }
(function () {
  const LEVELS = [{ n: 3, mix: 60 }, { n: 4, mix: 160 }, { n: 5, mix: 320 }];
  const SCORE = [30, 70, 120];
  const G = {
    title: 'The Broken Seal',
    howTo: { lines: [
      'The Shogun\'s seal lies cut into slabs, with one slab missing. Slide the slabs back until the seal is whole.',
      'Whole means the numbers in the slabs\' corners run 1, 2, 3 ... row by row from the top left, with the gap at the bottom right.',
      'Click a slab in line with the gap (same row or column): it slides toward the gap, and the slabs between go with it.',
      'Or press an arrow (W A S D) to move the slab beside the gap that way. Restart lays the slabs out as they were dealt.',
      'Tip: finish the top row, then the left column; what is left is a smaller seal of the same kind.'] },
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const LV = def.levels || LEVELS, AT = def.at || [0, 0], W = def.size || 6.4;
      const KEY = 'rebelAntsSealProgress:' + (def.id || 'slide');
      let solvedUpTo = 0; try { solvedUpTo = Math.max(0, Math.min(LV.length, Number(localStorage.getItem(KEY)) || 0)); } catch (e) {}
      const mat = (k, c, em, spec = .1) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(spec, spec, spec); if (em) m.emissiveColor = new B.Color3(...em); return m; });
      const M = { body: mat('body', [.12, .06, .12], [.03, .01, .03], .3), frame: mat('frame', [.08, .05, .07], [.02, .01, .02], .4), gold: mat('gold', [.95, .74, .3], [.3, .2, .06], .5) };
      // the picture: the seal on purple, gold rings, the Shogun emblem, numbers in each slab's corner
      let emblem = null; const img = new Image(); img.crossOrigin = 'anonymous'; img.onload = () => { emblem = img; if (bd) paint(bd.tex, bd.n); }; img.src = def.emblem || '/assets/brand/factions/shogun.png';
      function paint(tex, n) {
        const S = 1024, g = tex.getContext(), c = S / n;
        const bg = g.createRadialGradient(S / 2, S / 2, 40, S / 2, S / 2, S * .72); bg.addColorStop(0, '#7a2a5c'); bg.addColorStop(1, '#2a0d2a'); g.fillStyle = bg; g.fillRect(0, 0, S, S);
        g.strokeStyle = '#d8b35c'; for (const [r, w] of [[S * .46, 18], [S * .41, 6], [S * .23, 8]]) { g.lineWidth = w; g.beginPath(); g.arc(S / 2, S / 2, r, 0, Math.PI * 2); g.stroke(); }
        for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; g.fillStyle = k % 2 ? '#c99a3e' : '#f0d27a'; g.beginPath(); g.arc(S / 2 + Math.cos(a) * S * .435, S / 2 + Math.sin(a) * S * .435, 14, 0, Math.PI * 2); g.fill(); }
        for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + .2; g.save(); g.translate(S / 2 + Math.cos(a) * S * .32, S / 2 + Math.sin(a) * S * .32); g.rotate(a); g.fillStyle = 'rgba(190,150,230,.85)'; for (let i = 0; i < 5; i++) { g.beginPath(); g.ellipse(0, i * 16 - 30, 11 - i, 8, 0, 0, Math.PI * 2); g.fill(); } g.restore(); }
        if (emblem) { const s = S * .36, off = document.createElement('canvas'); off.width = off.height = 512; const o = off.getContext('2d'); o.drawImage(emblem, 0, 0, 512, 512); o.globalCompositeOperation = 'source-in'; o.fillStyle = '#e9c66e'; o.fillRect(0, 0, 512, 512); g.drawImage(off, S / 2 - s / 2, S / 2 - s / 2, s, s); }
        else { g.fillStyle = '#e9c66e'; g.beginPath(); g.moveTo(S / 2, S * .33); g.lineTo(S * .63, S * .5); g.lineTo(S / 2, S * .67); g.lineTo(S * .37, S * .5); g.closePath(); g.fill(); }
        g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 5; for (let i = 1; i < n; i++) { g.beginPath(); g.moveTo(i * c, 0); g.lineTo(i * c, S); g.stroke(); g.beginPath(); g.moveTo(0, i * c); g.lineTo(S, i * c); g.stroke(); }
        g.font = `700 ${Math.round(c * .2)}px Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) { const i = r * n + k; if (i === n * n - 1) continue; const x = k * c + c * .17, y = r * c + c * .17;
          g.fillStyle = 'rgba(20,6,18,.82)'; g.beginPath(); g.arc(x, y, c * .13, 0, Math.PI * 2); g.fill(); g.fillStyle = '#f0d27a'; g.fillText(String(i + 1), x, y + 1); }
        tex.update();
      }
      let bd = null; // { k, n, S, tiles[i] = { i, r, c, node }, gap: [r, c], tex, nodes[], moves, t }
      const st = { phase: 'pick', wait: 0 };
      // column 0 is on the screen's left (the camera looks down the board's -z, so that is +x), row 0 at the far edge
      const posOf = (r, c) => new V3(AT[0] - (c - (bd.n - 1) / 2) * bd.S, 0, AT[1] + (r - (bd.n - 1) / 2) * bd.S);
      const keep = n => { n.parent = ctx.frame; ctx.add(n); bd.nodes.push(n); return n; };
      function build(k) {
        if (bd) bd.nodes.forEach(n => { try { n.dispose(); } catch (e) {} });
        const L = LV[k], n = L.n, S = W / n;
        bd = { k, n, S, tiles: [], gap: [n - 1, n - 1], nodes: [], moves: 0, t: 0 };
        const tex = bd.tex = new B.DynamicTexture('slSealTex', { width: 1024, height: 1024 }, scene, true); paint(tex, n);
        const tm = new B.StandardMaterial('slTopMat_' + k, scene); tm.diffuseTexture = tex; tm.emissiveColor = new B.Color3(.18, .14, .16); tm.specularColor = new B.Color3(.15, .15, .15);
        bd.nodes.push({ dispose() { tex.dispose(); tm.dispose(); } });
        const base = keep(B.MeshBuilder.CreateBox('slBase', { width: W + .5, height: .2, depth: W + .5 }, scene)); base.material = M.frame; base.position.set(AT[0], .1, AT[1]); base.isPickable = false;
        for (const s of [-1, 1]) { for (const ax of [0, 1]) { const b = keep(B.MeshBuilder.CreateBox('slRim', { width: ax ? .14 : W + .5, height: .12, depth: ax ? W + .5 : .14 }, scene)); b.material = M.gold; b.position.set(AT[0] + (ax ? s * (W / 2 + .2) : 0), .26, AT[1] + (ax ? 0 : s * (W / 2 + .2))); b.isPickable = false; } }
        for (let i = 0; i < n * n - 1; i++) {
          const r = Math.floor(i / n), c = i % n, root = new B.TransformNode('slTile', scene); keep(root);
          const body = B.MeshBuilder.CreateBox('slBody', { width: S * .96, height: .24, depth: S * .96 }, scene); body.parent = root; body.position.y = .12; body.material = M.body; body.isPickable = true; body.metadata = { slTile: i }; ctx.add(body);
          const top = B.MeshBuilder.CreateGround('slTop', { width: S * .94, height: S * .94 }, scene); top.parent = root; top.position.y = .245; top.material = tm; top.isPickable = true; top.metadata = { slTile: i }; ctx.add(top);
          const P = top.getVerticesData(B.VertexBuffer.PositionKind), uv = [];
          for (let v = 0; v < P.length; v += 3) { const fx = P[v] / (S * .94) + .5, fz = P[v + 2] / (S * .94) + .5; uv.push((c + .03 + .94 * (1 - fx)) / n, 1 - (r + .03 + .94 * fz) / n); }
          top.setVerticesData(B.VertexBuffer.UVKind, uv);
          bd.tiles.push({ i, r, c, node: root });
        }
        // mix by legal moves from the solved board (always solvable), never undoing the last one
        let last = null; const mixN = L.mix || n * n * 8;
        for (let m = 0, guard = 0; m < mixN && guard < mixN * 4; guard++) { const opts = neighbours().filter(t => !last || t !== last); const t = opts[Math.floor(Math.random() * opts.length)]; swap(t); last = t; m++; }
        if (solved()) { const t = neighbours()[0]; swap(t); }
        bd.tiles.forEach(t => t.node.position.copyFrom(posOf(t.r, t.c)));
        bd.start = { at: bd.tiles.map(t => [t.r, t.c]), gap: bd.gap.slice() }; // as dealt, for Restart
        bd.moves = 0; bd.t = 0; info();
      }
      const at = (r, c) => bd.tiles.find(t => t.r === r && t.c === c);
      const neighbours = () => { const [gr, gc] = bd.gap; return [[gr - 1, gc], [gr + 1, gc], [gr, gc - 1], [gr, gc + 1]].map(([r, c]) => at(r, c)).filter(Boolean); };
      function swap(t) { const [gr, gc] = bd.gap; bd.gap = [t.r, t.c]; t.r = gr; t.c = gc; }
      const solved = () => bd.tiles.every(t => t.r * bd.n + t.c === t.i);
      const info = () => H.info(bd ? `Level ${bd.k + 1} / ${LV.length} · ${bd.n} × ${bd.n} · moves ${bd.moves}` : 'Pick a level');
      // slide the slab t (and the slabs between it and the gap) one place toward the gap
      function play(t) {
        if (st.phase !== 'play' || !t) return false;
        const [gr, gc] = bd.gap; if (t.r !== gr && t.c !== gc) { ctx.sound('thock'); return false; }
        const dr = Math.sign(gr - t.r), dc = Math.sign(gc - t.c), line = [];
        for (let r = gr - dr, c = gc - dc; ; r -= dr, c -= dc) { const s = at(r, c); if (!s) break; line.push(s); if (s === t) break; }
        line.forEach(s => swap(s)); bd.moves += line.length; ctx.note(330 + 40 * (t.i % 7), 'bell'); info();
        if (solved()) { st.phase = 'solved'; st.wait = 1.8; ctx.sound('gamewin'); H.msg('The seal is whole!', 1600, `${bd.moves} moves`);
          if (bd.k + 1 > solvedUpTo) { solvedUpTo = bd.k + 1; try { localStorage.setItem(KEY, String(solvedUpTo)); } catch (e) {} } }
        return true;
      }
      // an arrow moves the slab beside the gap that way (screen directions: up = toward the far edge)
      function arrow(dir) { if (!bd) return; const [gr, gc] = bd.gap, d = { up: [1, 0], down: [-1, 0], left: [0, 1], right: [0, -1] }[dir]; play(at(gr + d[0], gc + d[1])); }
      // the picker
      const hud = document.getElementById('gameHud'), pick = document.createElement('div');
      pick.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(360px,90vw);background:rgba(26,10,26,.94);border:1px solid rgba(216,179,92,.7);border-radius:14px;padding:16px;text-align:center;pointer-events:auto;font:15px/1.4 Georgia,serif;color:#eee';
      pick.innerHTML = `<div style="font:700 13px/1.2 Georgia,serif;letter-spacing:.14em;text-transform:uppercase;color:#d8b35c;margin-bottom:10px">The Broken Seal</div><div style="margin-bottom:12px;color:#bbb">Slide the slabs until the Shogun's seal is whole and the numbers run in order.</div>`
        + `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${LV.map((L, k) => { const open = k <= solvedUpTo, done = k < solvedUpTo; return `<button type="button" data-k="${k}" ${open ? '' : 'disabled'} style="padding:10px 4px;border-radius:9px;border:1px solid ${open ? '#d8b35c' : '#444'};background:${done ? 'rgba(216,179,92,.22)' : 'rgba(255,255,255,.04)'};color:${open ? '#fff' : '#666'};font:700 15px Georgia,serif;cursor:${open ? 'pointer' : 'default'}">${open ? L.n + ' × ' + L.n : '🔒'}${done ? ' ✓' : ''}</button>`; }).join('')}</div>`;
      pick.querySelectorAll('button[data-k]').forEach(b => b.onclick = (e) => { e.stopPropagation(); b.blur(); choose(+b.dataset.k); });
      function choose(k) { if (st.phase !== 'pick' || k > solvedUpTo || k >= LV.length) return; pick.remove(); st.phase = 'play'; build(k); H.msg(`${LV[k].n} × ${LV[k].n}`, 900, k === 2 ? 'a hard one' : ''); }
      hud.appendChild(pick);
      const P = def.player || [AT[0] + W / 2 + 1.7, AT[1] + 1, -Math.PI / 2]; ctx.player.place(P[0], P[1], P[2]);
      const cam = def.cam || [AT[0], 7.5, AT[1] + 5.6], look = def.look || [AT[0], 0, AT[1] + .2];
      ctx.look(cam, look, def.fov || .75);
      H.title(def.title || 'The Broken Seal'); H.score(''); info();
      H.hint('Click a slab in line with the gap, or press an arrow to slide the slab beside the gap that way.');
      return {
        update(dt) {
          ctx.look(cam, look);
          if (!bd) return;
          if (st.phase === 'play') bd.t += dt;
          for (const t of bd.tiles) { const p = posOf(t.r, t.c); t.node.position.x += (p.x - t.node.position.x) * Math.min(1, dt * 14); t.node.position.z += (p.z - t.node.position.z) * Math.min(1, dt * 14); }
          if (st.phase === 'solved' && (st.wait -= dt) <= 0) {
            st.phase = 'done'; H.hint('');
            const k = bd.k, score = SCORE[k] ?? 30 * (k + 1);
            ctx.finish({ score, label: 'points', solved: true, passed: score >= (def.pass || 0), extra: `The ${bd.n} × ${bd.n} seal is whole in ${bd.moves} moves (${Math.round(bd.t)} s).${k + 1 < LV.length ? ` The ${LV[k + 1].n} × ${LV[k + 1].n} is open.` : ' Every seal is whole.'}` });
          }
        },
        key(e, down) {
          if (!down || e.repeat) return; const k = e.key.toLowerCase();
          if (st.phase === 'pick') { const n = k === '0' ? 10 : parseInt(k, 10); if (n >= 1 && n <= LV.length) choose(n - 1); return; } // 1-9, 0 = the tenth
          if (st.phase !== 'play') return;
          if (k === 'arrowup' || k === 'w') arrow('up'); else if (k === 'arrowdown' || k === 's') arrow('down'); else if (k === 'arrowleft' || k === 'a') arrow('left'); else if (k === 'arrowright' || k === 'd') arrow('right');
        },
        pointer(evt) {
          if (evt.type !== B.PointerEventTypes.POINTERDOWN || st.phase !== 'play') return;
          const hit = scene.pickWithRay(ctx.ray(), m => m.metadata?.slTile !== undefined); if (hit?.hit) play(bd.tiles[hit.pickedMesh.metadata.slTile]);
        },
        // Restart: the same mixed seal as it was dealt (every slab back where it lay, moves and time 0); only while it is played
        restart() { if (st.phase !== 'play' || !bd) return; bd.tiles.forEach((t, j) => { [t.r, t.c] = bd.start.at[j]; t.node.position.copyFrom(posOf(t.r, t.c)); }); bd.gap = bd.start.gap.slice(); bd.moves = 0; bd.t = 0; info(); H.msg('Start again', 900); },
        _test: { st, choose, play, arrow, solved: () => bd && solved(), at: (r, c) => bd && at(r, c), get bd() { return bd; },
          // finish the board straight away (tests): put every slab home, then make the last move
          nearlySolve() { bd.tiles.forEach(t => { t.r = Math.floor(t.i / bd.n); t.c = t.i % bd.n; }); bd.gap = [bd.n - 1, bd.n - 1]; const t = at(bd.n - 1, bd.n - 2); swap(t); return t; } },
        dispose() { pick.remove(); if (bd) bd.nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); }
      };
    }
  };
  window.RebelGames.register('slide', G);
})();
