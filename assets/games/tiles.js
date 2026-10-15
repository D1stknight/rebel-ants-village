// Raked stones (Oct 15, Kenshi): nine raked tiles on the ground make one pattern round a stone, but they are turned out
// of place. Clicking a tile (or its number, 1-9 like a phone pad from the top left) turns it a quarter round, and the
// tiles beside it turn too. Put the whole pattern back; fewer turns score more.
// def: { at: [x, z] (frame coords of the grid's centre), size: 1.25 (a tile), scramble: 4, pass, points }
(function () {
  const G = {
    title: 'Raked Stones',
    start(ctx) {
      const B = ctx.B, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const AT = def.at || [0, 4.2], SZ = def.size || 1.25, N = 3, SCR = Math.max(2, Math.min(7, def.scramble || 4));
      // the pattern: raked rings round a stone, with straight rakes in the corners, drawn once and cut into nine
      const big = document.createElement('canvas'); big.width = big.height = 384; const g = big.getContext('2d');
      g.fillStyle = '#d9cfb8'; g.fillRect(0, 0, 384, 384);
      g.strokeStyle = 'rgba(120,104,80,.75)'; g.lineWidth = 4;
      for (let r = 34; r < 190; r += 15) { g.beginPath(); g.arc(192, 192, r, 0, Math.PI * 2); g.stroke(); }
      g.save(); g.beginPath(); g.rect(0, 0, 384, 384); g.arc(192, 192, 188, 0, Math.PI * 2, true); g.clip();
      for (let k = -384; k < 384; k += 15) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 384, 384); g.stroke(); }
      g.restore();
      g.fillStyle = 'rgba(70,64,58,.55)'; g.beginPath(); g.ellipse(198, 200, 30, 22, .4, 0, Math.PI * 2); g.fill(); // the stone's shadow
      g.strokeStyle = 'rgba(80,70,55,.5)'; g.lineWidth = 3; for (let i = 0; i <= 3; i++) { g.beginPath(); g.moveTo(i * 128, 0); g.lineTo(i * 128, 384); g.stroke(); g.beginPath(); g.moveTo(0, i * 128); g.lineTo(384, i * 128); g.stroke(); }
      const tiles = [];
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const tex = new B.DynamicTexture('tileTex', { width: 128, height: 128 }, scene, true); tex.getContext().drawImage(big, c * 128, r * 128, 128, 128, 0, 0, 128, 128); tex.update();
        const m = new B.StandardMaterial('tileMat', scene); m.diffuseTexture = tex; m.specularColor = new B.Color3(0, 0, 0); m.emissiveColor = new B.Color3(.18, .16, .13);
        const t = B.MeshBuilder.CreateBox('tileStone', { width: SZ * .96, height: .1, depth: SZ * .96, faceUV: [0, 1, 2, 3, 4, 5].map(i => i === 4 ? new B.Vector4(0, 0, 1, 1) : new B.Vector4(0, 0, .01, .01)) }, scene);
        t.material = m; t.position.set(AT[0] + (c - 1) * SZ, .05, AT[1] + (1 - r) * SZ); t.metadata = { tile: r * N + c }; ctx.add(t);
        tiles.push({ r, c, rot: 0, mesh: t, mat: m, tex, spin: 0 });
      }
      // the stone in the middle tile (it turns with it)
      const stone = B.MeshBuilder.CreateSphere('tileRock', { diameterX: .5, diameterY: .32, diameterZ: .4, segments: 8 }, scene); stone.parent = tiles[4].mesh; stone.position.y = .16; stone.isPickable = false;
      stone.material = ctx.mat('rock', n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(.36, .35, .33); m.specularColor = new B.Color3(.05, .05, .05); return m; });
      const st = { moves: 0, phase: 'intro', wait: 1.2, solvedAt: 0 };
      const neighbours = i => { const r = Math.floor(i / N), c = i % N; return [[r, c], [r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < N && b < N).map(([a, b]) => a * N + b); };
      const turn = (i, k = 1) => { for (const j of neighbours(i)) { tiles[j].rot = (tiles[j].rot + k) % 4; tiles[j].spin += k; } };
      // scramble with the player's own moves (so it can always be solved); never left solved
      do { for (let k = 0; k < SCR; k++) turn(Math.floor(Math.random() * 9)); } while (tiles.every(t => t.rot === 0));
      tiles.forEach(t => { t.spin = 0; t.mesh.rotation.y = t.rot * Math.PI / 2; });
      const solved = () => tiles.every(t => t.rot === 0);
      // the fewest turns that put it back (a search over 0-3 presses a tile: 4^9, a few ms)
      function solve() {
        const need = tiles.map(t => (4 - t.rot) % 4), best = { n: 99, p: null }, p = new Array(9).fill(0), nb = tiles.map((t, i) => neighbours(i));
        const rec = (i, sum) => { if (sum >= best.n) return; if (i === 9) { const r = new Array(9).fill(0); for (let j = 0; j < 9; j++) if (p[j]) for (const q of nb[j]) r[q] += p[j]; for (let q = 0; q < 9; q++) if (r[q] % 4 !== need[q]) return; best.n = sum; best.p = p.slice(); return; } for (let k = 0; k < 4; k++) { p[i] = k; rec(i + 1, sum + k); } p[i] = 0; };
        rec(0, 0); return best;
      }
      const optimal = solve().n;
      const info = () => H.info(`Turns ${st.moves}`);
      function press(i) {
        if (st.phase !== 'play' || i < 0 || i > 8) return;
        turn(i); st.moves++; info(); ctx.sound('thock');
        if (solved()) { st.phase = 'end'; st.wait = 1.4; H.msg('The garden is whole', 1400); ctx.sound('gamewin'); }
      }
      ctx.player.place(2.9, AT[1] - 2.2, Math.atan2(AT[0] - 2.9, 2.2));
      const cam = def.cam || [-.4, 5.6, AT[1] - 3.4], at = def.at2 || [AT[0], 0, AT[1]];
      ctx.look(cam, at, def.fov || .85);
      H.title(def.title || 'Raked Stones'); H.score(0); info();
      H.hint('Turn the tiles until the raked pattern is whole: click a tile (or <kbd>1</kbd>-<kbd>9</kbd> from the top left). The tiles beside it turn too.');
      H.msg(def.title || 'Raked Stones', 1400, 'make the garden whole');
      return {
        update(dt) {
          ctx.look(cam, at);
          if (st.phase === 'intro' && (st.wait -= dt) <= 0) { st.phase = 'play'; }
          for (const t of tiles) { const want = t.rot * Math.PI / 2; let cur = t.mesh.rotation.y; let d = ((want - cur) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI; t.mesh.rotation.y = cur + d * Math.min(1, dt * 12); }
          if (st.phase === 'end' && (st.wait -= dt) <= 0) {
            st.phase = 'done'; H.hint('');
            const score = Math.max(20, Math.round(100 * optimal / Math.max(optimal, st.moves)));
            ctx.finish({ score, label: 'points', extra: `The pattern is whole in ${st.moves} turns (the fewest was ${optimal}).` });
          }
        },
        key(e, down) { if (!down || e.repeat) return; const n = parseInt(e.key, 10); if (n >= 1 && n <= 9) press(n - 1); },
        pointer(evt) {
          if (evt.type !== B.PointerEventTypes.POINTERDOWN) return;
          const hit = scene.pickWithRay(ctx.ray(), m => !!m.metadata && m.metadata.tile !== undefined);
          if (hit && hit.hit) press(hit.pickedMesh.metadata.tile);
        },
        _test: { st, press, tiles, optimal, solve: () => solve().p },
        dispose() { tiles.forEach(t => { t.mat.dispose(); t.tex.dispose(); }); }
      };
    }
  };
  window.RebelGames.register('tiles', G);
})();
