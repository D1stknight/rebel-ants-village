// Raked stones (Oct 15, Kenshi): raked tiles on the ground make one pattern round the stones, but they are turned out
// of place. Clicking a tile (or, on the nine-tile garden, its number, 1-9 like a phone pad from the top left) turns it a
// quarter round, and the tiles beside it turn too. Put the whole pattern back; fewer turns score more.
// Oct 17: How to play (the rules) and Restart (the tiles turned back to how this game dealt them: the same puzzle).
// Oct 17 (Miguel: "give it a few levels maybe 5 and make the board bigger with more pieces as it goes"): five gardens,
// 3 x 3 up to 6 x 6, more stones (each with its own raked rings) on the bigger ones; the fewest turns found exactly by
// chasing row by row (the first row tried every way, each next row then forced).
// def: { at: [x, z] (frame coords of the grid's centre), size: 1.25 (a tile), levels, pass, points }
(function () {
  const LEVELS = [{ n: 3, scr: 4, fewest: [6, 8] }, { n: 3, scr: 7, fewest: [12, 16] }, { n: 4, scr: 9, fewest: [15, 19] }, { n: 5, scr: 12, fewest: [24, 32] }, { n: 6, scr: 22, fewest: [40, 52] }]; // fewest = the band of fewest turns a deal must need
  const SCORE = [100, 120, 150, 180, 220];
  // where the stones lie in each garden (fractions of its width): one in the middle, more on the bigger ones
  const STONES = { 3: [[.5, .5]], 4: [[.3, .32], [.7, .66]], 5: [[.5, .5], [.21, .24], [.78, .8]], 6: [[.27, .3], [.73, .26], [.5, .72], [.12, .84]] };
  const G = {
    title: 'Raked Stones',
    howTo: { lines: [
      'Raked tiles make one picture, rings of raked sand round the stones, but they have been turned out of place.',
      'Click a tile to turn it a quarter round (on the nine-tile garden also 1-9, counted like a phone pad from the top left); the tiles touching its sides turn with it.',
      'Turn them until the whole pattern is back; the fewer turns, the higher the score. Five gardens, from 3 x 3 up to 6 x 6.',
      'Tip: the order of your turns does not matter, only how often each tile is clicked, and four clicks on one tile change nothing.'] },
    start(ctx) {
      const B = ctx.B, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const LV = def.levels || LEVELS, AT = def.at || [0, 4.2], SZ0 = def.size || 1.25;
      const KEY = 'rebelAntsTilesProgress:' + (def.id || 'tiles');
      let solvedUpTo = 0; try { solvedUpTo = Math.max(0, Math.min(LV.length, Number(localStorage.getItem(KEY)) || 0)); } catch (e) {}
      const rockM = ctx.mat('rock', n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(.36, .35, .33); m.specularColor = new B.Color3(.05, .05, .05); return m; });
      let bd = null; // { k, n, sz, tiles: [{ r, c, rot, mesh, mat, tex, spin }], dealt, optimal, moves }
      const st = { phase: 'pick', wait: 0 };
      // the garden's picture: raked rings round the nearest stone (the rake lines where the distance to it crosses every
      // 15 px), the stones' shadows, the tile borders; S = n x 128 px
      function picture(n) {
        const S = n * 128, cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d'), stones = STONES[n].map(([u, v]) => [u * S, v * S]);
        if (n === 3) { // the first garden as it always was: rings round the middle stone, straight rakes in the corners
          g.fillStyle = '#d9cfb8'; g.fillRect(0, 0, S, S); g.strokeStyle = 'rgba(120,104,80,.75)'; g.lineWidth = 4;
          for (let r = 34; r < 190; r += 15) { g.beginPath(); g.arc(192, 192, r, 0, Math.PI * 2); g.stroke(); }
          g.save(); g.beginPath(); g.rect(0, 0, S, S); g.arc(192, 192, 188, 0, Math.PI * 2, true); g.clip();
          for (let k = -S; k < S; k += 15) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + S, S); g.stroke(); }
          g.restore();
        } else {
          const im = g.createImageData(S, S), d = im.data;
          for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
            let m = 1e9; for (const [sx, sy] of stones) m = Math.min(m, Math.hypot(x - sx, y - sy));
            const line = m > 30 && ((m - 34) % 15 + 15) % 15 < 4, o = (y * S + x) * 4;
            d[o] = line ? 160 : 217; d[o + 1] = line ? 142 : 207; d[o + 2] = line ? 112 : 184; d[o + 3] = 255;
          }
          g.putImageData(im, 0, 0);
        }
        g.fillStyle = 'rgba(70,64,58,.55)'; for (const [sx, sy] of stones) { g.beginPath(); g.ellipse(sx + 6, sy + 8, 30, 22, .4, 0, Math.PI * 2); g.fill(); } // the stones' shadows
        g.strokeStyle = 'rgba(80,70,55,.5)'; g.lineWidth = 3; for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * 128, 0); g.lineTo(i * 128, S); g.stroke(); g.beginPath(); g.moveTo(0, i * 128); g.lineTo(S, i * 128); g.stroke(); }
        return { cv, stones };
      }
      const neighbours = (n, i) => { const r = Math.floor(i / n), c = i % n; return [[r, c], [r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < n && b < n).map(([a, b]) => a * n + b); };
      // the fewest turns that put it back: every way to turn the first row (4^n), then each next row is forced (the
      // tile above it can only still be put right by the one below), the last row must come out right
      function solve(n, rot) {
        const need = rot.map(v => (4 - v) % 4); let best = null;
        for (let code = 0; code < 4 ** n; code++) {
          const p = new Array(n * n).fill(0), got = new Array(n * n).fill(0); let c0 = code;
          for (let c = 0; c < n; c++) { p[c] = c0 % 4; c0 = Math.floor(c0 / 4); }
          const apply = i => { for (const q of neighbours(n, i)) got[q] += p[i]; };
          for (let c = 0; c < n; c++) apply(c);
          for (let r = 1; r < n; r++) for (let c = 0; c < n; c++) { const above = (r - 1) * n + c; p[r * n + c] = ((need[above] - got[above]) % 4 + 4) % 4; apply(r * n + c); }
          let ok = true; for (let i = (n - 1) * n; i < n * n && ok; i++) if (((got[i] - need[i]) % 4 + 4) % 4) ok = false;
          if (!ok) continue; const sum = p.reduce((a, b) => a + b, 0); if (!best || sum < best.n) best = { n: sum, p };
        }
        return best;
      }
      function build(k, dealt) {
        if (bd) bd.tiles.forEach(t => { try { t.mesh.dispose(); t.mat.dispose(); t.tex.dispose(); } catch (e) {} });
        const L = LV[k], n = L.n, sz = Math.min(SZ0, 5.6 / n), { cv, stones } = picture(n), tiles = [];
        for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
          const tex = new B.DynamicTexture('tileTex', { width: 128, height: 128 }, scene, true); tex.getContext().drawImage(cv, c * 128, r * 128, 128, 128, 0, 0, 128, 128); tex.update();
          const m = new B.StandardMaterial('tileMat', scene); m.diffuseTexture = tex; m.specularColor = new B.Color3(0, 0, 0); m.emissiveColor = new B.Color3(.18, .16, .13);
          const t = B.MeshBuilder.CreateBox('tileStone', { width: sz * .96, height: .1, depth: sz * .96, faceUV: [0, 1, 2, 3, 4, 5].map(i => i === 4 ? new B.Vector4(0, 0, 1, 1) : new B.Vector4(0, 0, .01, .01)) }, scene);
          t.material = m; t.position.set(AT[0] + (c - (n - 1) / 2) * sz, .05, AT[1] + ((n - 1) / 2 - r) * sz); t.metadata = { tile: r * n + c }; ctx.add(t);
          tiles.push({ r, c, rot: 0, mesh: t, mat: m, tex, spin: 0 });
        }
        // each stone sits on its tile (and turns with it)
        for (const [sx, sy] of stones) { const c = Math.min(n - 1, Math.floor(sx / 128)), r = Math.min(n - 1, Math.floor(sy / 128)), t = tiles[r * n + c];
          const s = B.MeshBuilder.CreateSphere('tileRock', { diameterX: .5 * sz / 1.25, diameterY: .32 * sz / 1.25, diameterZ: .4 * sz / 1.25, segments: 8 }, scene); s.parent = t.mesh; s.isPickable = false; s.material = rockM;
          s.position.set(((sx - c * 128) / 128 - .5) * sz, .16, (.5 - (sy - r * 128) / 128) * sz); }
        bd = { k, n, sz, tiles, moves: 0 };
        // scramble with the player's own moves (so it can always be solved); never left solved
        if (dealt) tiles.forEach((t, i) => { t.rot = dealt[i]; });
        else for (let tries = 0; tries < 200; tries++) { // deal until the fewest turns lands in the garden's band
          do { tiles.forEach(t => { t.rot = 0; }); for (let q = 0; q < L.scr; q++) turn(Math.floor(Math.random() * n * n)); } while (tiles.every(t => t.rot === 0));
          const f = solve(n, tiles.map(t => t.rot)).n; if (!L.fewest || (f >= L.fewest[0] && f <= L.fewest[1])) break;
        }
        tiles.forEach(t => { t.spin = 0; t.mesh.rotation.y = t.rot * Math.PI / 2; });
        bd.dealt = tiles.map(t => t.rot); bd.optimal = solve(n, bd.dealt).n;
        st.phase = 'intro'; st.wait = 1; info();
        H.msg(`Garden ${k + 1}`, 1100, `${n} x ${n} · ${stones.length} stone${stones.length > 1 ? 's' : ''}`);
        H.hint(`Turn the tiles until the raked pattern is whole: click a tile${n === 3 ? ' (or <kbd>1</kbd>-<kbd>9</kbd> from the top left)' : ''}. The tiles beside it turn too.`);
      }
      const turn = (i, k = 1) => { for (const j of neighbours(bd.n, i)) { bd.tiles[j].rot = (bd.tiles[j].rot + k) % 4; bd.tiles[j].spin += k; } };
      const solved = () => bd.tiles.every(t => t.rot === 0);
      const info = () => H.info(bd ? `Garden ${bd.k + 1} / ${LV.length} · turns ${bd.moves} · fewest ${bd.optimal}` : 'Pick a garden');
      function press(i) {
        if (st.phase !== 'play' || !bd || i < 0 || i >= bd.n * bd.n) return;
        turn(i); bd.moves++; info(); ctx.sound('thock');
        if (solved()) { st.phase = 'end'; st.wait = 1.4; H.msg('The garden is whole', 1400); ctx.sound('gamewin');
          if (bd.k + 1 > solvedUpTo) { solvedUpTo = bd.k + 1; try { localStorage.setItem(KEY, String(solvedUpTo)); } catch (e) {} } }
      }
      // Restart (the button beside Quit): the tiles turn back to how they were dealt, the turns count from zero
      function restart() { if (st.phase !== 'play' || !bd) return; build(bd.k, bd.dealt); st.phase = 'play'; ctx.sound('thock'); H.msg('Start again', 900, 'the same garden'); }
      // the garden picker (a garden opens when the one before is whole)
      const hud = document.getElementById('gameHud'), pick = document.createElement('div');
      pick.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(400px,90vw);background:rgba(12,16,30,.94);border:1px solid rgba(216,179,92,.7);border-radius:14px;padding:16px;text-align:center;pointer-events:auto;font:15px/1.4 Georgia,serif;color:#eee';
      pick.innerHTML = `<div style="font:700 13px/1.2 Georgia,serif;letter-spacing:.14em;text-transform:uppercase;color:#d8b35c;margin-bottom:10px">Raked Stones</div><div style="margin-bottom:12px;color:#bbb">Turn the raked tiles until the garden's pattern is whole.</div>`
        + `<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:7px">${LV.map((L, k) => { const open = k <= solvedUpTo, done = k < solvedUpTo; return `<button type="button" data-k="${k}" ${open ? '' : 'disabled'} style="padding:9px 2px;border-radius:9px;border:1px solid ${open ? '#d8b35c' : '#444'};background:${done ? 'rgba(216,179,92,.22)' : 'rgba(255,255,255,.04)'};color:${open ? '#fff' : '#666'};font:700 14px Georgia,serif;cursor:${open ? 'pointer' : 'default'}">${open ? k + 1 : '🔒'}${done ? ' ✓' : ''}${open ? `<div style="font:11px Georgia,serif;color:#c9b88a">${L.n} x ${L.n}</div>` : ''}</button>`; }).join('')}</div>`;
      pick.querySelectorAll('button[data-k]').forEach(b => b.onclick = (e) => { e.stopPropagation(); b.blur(); choose(+b.dataset.k); });
      function choose(k) { if (st.phase !== 'pick' || k > solvedUpTo || k >= LV.length) return; pick.remove(); build(k); }
      hud.appendChild(pick);
      // the camera backs off for the bigger gardens
      const width = () => bd ? bd.n * bd.sz : 3 * SZ0, far = () => Math.max(1, width() / 3.75 * 1.04), camAt = () => def.cam || [-.4 * width() / 3.75, 5.6 * far(), AT[1] - 3.4 * far()];
      let cam = camAt(); const at = def.at2 || [AT[0], 0, AT[1]];
      ctx.player.place(2.9, AT[1] - 2.2, Math.atan2(AT[0] - 2.9, 2.2));
      ctx.look(cam, at, def.fov || .85);
      H.title(def.title || 'Raked Stones'); H.score(''); info();
      H.hint('Pick a garden: click it or press its number.');
      return {
        update(dt) {
          cam = camAt(); ctx.look(cam, at);
          if (!bd) return;
          if (!bd.placed) { bd.placed = 1; const px = Math.max(2.9, width() / 2 + 1.2); ctx.player.place(px, AT[1] - 2.2, Math.atan2(AT[0] - px, 2.2)); } // beside the bigger gardens too
          if (st.phase === 'intro' && (st.wait -= dt) <= 0) { st.phase = 'play'; }
          for (const t of bd.tiles) { const want = t.rot * Math.PI / 2; let cur = t.mesh.rotation.y; let d = ((want - cur) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI; t.mesh.rotation.y = cur + d * Math.min(1, dt * 12); }
          if (st.phase === 'end' && (st.wait -= dt) <= 0) {
            st.phase = 'done'; H.hint('');
            const score = Math.max(20, Math.round((SCORE[bd.k] ?? 100) * bd.optimal / Math.max(bd.optimal, bd.moves)));
            ctx.finish({ score, label: 'points', solved: true, extra: `Garden ${bd.k + 1} (${bd.n} x ${bd.n}) is whole in ${bd.moves} turns (the fewest was ${bd.optimal}).${bd.k + 1 < LV.length ? ' The next garden is open.' : ' Every garden is whole.'}` });
          }
        },
        key(e, down) {
          if (!down || e.repeat) return; const n = parseInt(e.key, 10);
          if (st.phase === 'pick') { const q = e.key === '0' ? 10 : n; if (q >= 1 && q <= LV.length) choose(q - 1); return; }
          if (bd && bd.n === 3 && n >= 1 && n <= 9) press(n - 1);
        },
        pointer(evt) {
          if (evt.type !== B.PointerEventTypes.POINTERDOWN) return;
          const hit = scene.pickWithRay(ctx.ray(), m => !!m.metadata && m.metadata.tile !== undefined);
          if (hit && hit.hit) press(hit.pickedMesh.metadata.tile);
        },
        restart,
        _test: { st, press, choose, get bd() { return bd; }, solve: () => bd && solve(bd.n, bd.tiles.map(t => t.rot)).p, LEVELS: LV },
        dispose() { pick.remove(); if (bd) bd.tiles.forEach(t => { try { t.mat.dispose(); t.tex.dispose(); } catch (e) {} }); }
      };
    }
  };
  window.RebelGames.register('tiles', G);
})();
