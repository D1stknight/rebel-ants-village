// The Garden Bridges (Oct 15, Shogun): stepping stones in the lord's pond. Join them with plank bridges: each stone's
// number is how many bridges touch it; bridges run straight across the water (never on a slant), at most two between
// the same two stones, and never across another bridge; in the end every stone must be joined to every other. Click
// a stone, then a stone in line with it: one plank, two, none. U undoes, H lays one right bridge (no clean bonus
// then). Seven ponds from 5 stones to 28, each with one answer (checked by a solver). Score: the pond x 20, +10
// without a hint.
// def: { levels: [{ n (grid), isl: [[x, y, number]], sol: [[a, b, planks]] }], pass, points }
// Oct 17 (Miguel: the puzzles need a how-to with an example, every board a Restart): howTo (the rules + a bridged
// 8-stone pond, howto/hashi.png) and inst.restart (the same pond with no planks; hints still count: they cost the bonus).
(function () {
  const LEVELS = [
    { n: 5, isl: [[2,2,3],[0,2,5],[2,4,1],[0,4,1],[0,0,2]], sol: [[0,2,1],[1,0,2],[1,3,1],[4,1,2]] },
    { n: 7, isl: [[3,3,4],[5,3,4],[5,0,4],[3,6,4],[2,0,3],[1,6,1],[0,3,1],[2,2,1],[6,6,2]], sol: [[0,1,2],[0,3,1],[2,1,2],[3,8,2],[4,2,2],[4,7,1],[5,3,1],[6,0,1]] },
    { n: 7, isl: [[3,3,5],[3,1,6],[5,3,4],[5,1,2],[5,5,2],[3,6,5],[0,6,3],[0,3,1],[0,1,2],[6,6,3],[6,4,1]], sol: [[0,2,2],[0,5,1],[1,3,2],[1,0,2],[2,4,2],[5,9,2],[6,5,2],[7,6,1],[8,1,2],[10,9,1]] },
    { n: 9, isl: [[4,4,6],[8,4,5],[4,2,4],[0,2,3],[0,4,2],[0,0,3],[0,6,2],[7,2,2],[8,0,1],[3,0,2],[6,0,1],[4,7,2],[2,6,1],[8,7,2]], sol: [[0,1,2],[0,11,2],[1,13,2],[2,7,2],[2,0,1],[3,2,1],[4,0,1],[4,6,1],[5,9,1],[5,3,2],[6,12,1],[8,1,1],[9,10,1]] },
    { n: 9, isl: [[4,4,6],[4,2,4],[7,4,2],[7,2,1],[1,2,1],[4,6,5],[4,0,4],[1,6,2],[2,4,3],[8,0,1],[2,0,2],[0,4,2],[7,7,2],[2,7,1],[0,8,2],[5,8,1],[6,6,1]], sol: [[0,2,1],[0,5,2],[1,3,1],[1,0,1],[2,12,1],[4,1,1],[5,16,1],[6,9,1],[6,1,1],[7,5,2],[8,0,2],[10,6,2],[11,8,1],[11,14,1],[13,12,1],[14,15,1]] },
    { n: 11, isl: [[5,5,8],[3,5,6],[8,5,4],[3,3,2],[5,7,4],[5,2,4],[8,0,1],[3,8,8],[1,2,4],[3,10,5],[1,0,3],[8,8,2],[8,10,1],[6,0,4],[6,4,2],[1,4,1],[10,5,2],[0,10,2],[7,7,2],[0,8,2],[10,9,1]], sol: [[0,2,2],[0,4,2],[1,0,2],[1,7,2],[2,16,1],[3,1,2],[4,18,2],[5,0,2],[6,2,1],[7,11,2],[7,9,2],[8,5,2],[8,15,1],[9,12,1],[10,13,2],[10,8,1],[13,14,2],[16,20,1],[17,9,2],[19,7,2]] },
    { n: 13, isl: [[6,6,5],[6,8,5],[2,8,2],[0,6,3],[0,0,2],[6,3,7],[4,3,3],[12,6,2],[0,8,2],[1,3,2],[4,0,1],[6,0,3],[12,4,3],[12,8,3],[2,11,2],[12,2,2],[6,11,4],[10,0,4],[9,3,1],[10,2,1],[12,0,2],[11,11,2],[1,5,2],[12,10,4],[4,11,1],[0,12,1],[7,10,2],[3,5,1]], sol: [[0,7,1],[0,1,1],[1,13,1],[1,16,2],[2,1,1],[2,14,1],[3,0,1],[3,8,1],[4,10,1],[4,3,1],[5,18,1],[5,0,2],[6,5,2],[8,25,1],[9,6,1],[9,22,1],[11,17,1],[11,5,2],[12,7,1],[13,23,2],[14,24,1],[15,12,2],[16,21,2],[17,20,2],[17,19,1],[22,27,1],[26,23,2]] }
  ];
  function edgesOf(isl) { // pairs of stones that see each other along a row or column, and which pairs cross
    const E = [], at = new Map(isl.map((p, i) => [p[0] + ',' + p[1], i]));
    isl.forEach((p, i) => { for (const [dx, dy] of [[1, 0], [0, 1]]) { let x = p[0] + dx, y = p[1] + dy; while (x <= 40 && y <= 40) { const j = at.get(x + ',' + y); if (j != null) { E.push({ a: i, b: j, h: dy === 0 }); break; } x += dx; y += dy; } } });
    E.forEach(e => { e.cross = []; });
    E.forEach((e, i) => E.forEach((f, j) => { if (i >= j || e.h === f.h) return; const H = e.h ? e : f, V = e.h ? f : e, hy = isl[H.a][1], hx0 = Math.min(isl[H.a][0], isl[H.b][0]), hx1 = Math.max(isl[H.a][0], isl[H.b][0]), vx = isl[V.a][0], vy0 = Math.min(isl[V.a][1], isl[V.b][1]), vy1 = Math.max(isl[V.a][1], isl[V.b][1]);
      if (vx > hx0 && vx < hx1 && hy > vy0 && hy < vy1) { e.cross.push(j); f.cross.push(i); } }));
    return E;
  }
  const G = {
    title: 'The Garden Bridges',
    howTo: {
      lines: ['Join all the stepping stones with plank bridges. The number on a stone is how many planks touch it.',
        'Planks run straight along a row or column to the next stone: never on a slant, and never across another plank. Two stones can share one plank or two.',
        'In the end every stone must be linked into one network, so you could walk from any stone to any other.',
        'Click a stone, then a stone in line with it, to lay a plank; do it again for a second plank, and once more to take them away. A stone turns grey when its number is met, red when it has too many.',
        'U undoes; H lays one right bridge, but costs the clean bonus. Tip: start where a stone has few neighbours: a 4 that sees only two stones needs two planks to each.'],
      img: 'howto/hashi.png', caption: 'A bridged pond: every number met, no crossings, all the stones joined.'
    },
    start(ctx) {
      const B = ctx.B, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const LV = def.levels || LEVELS, KEY = 'rebelAntsBridgesProgress:' + (def.id || 'hashi');
      let solvedUpTo = 0; try { solvedUpTo = Math.max(0, Math.min(LV.length, Number(localStorage.getItem(KEY)) || 0)); } catch (e) {}
      const mat = (k, c, em) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(.05, .05, .05); if (em) m.emissiveColor = new B.Color3(...em); return m; });
      const rimM = mat('rim', [.42, .38, .36], [.09, .08, .08]);
      const nodes = [], keep = n => { n.parent = n.parent || ctx.frame; ctx.add(n); nodes.push(n); if (n.isPickable !== undefined) n.isPickable = false; return n; };
      const TEX = 1024, tex = new B.DynamicTexture('hsTex', { width: TEX, height: TEX }, scene, true); tex.hasAlpha = false;
      const boardM = new B.StandardMaterial('hsBoardMat', scene); boardM.diffuseTexture = tex; boardM.emissiveTexture = tex; boardM.emissiveColor = new B.Color3(.6, .6, .6); boardM.diffuseColor = new B.Color3(.55, .55, .55); boardM.specularColor = new B.Color3(0, 0, 0);
      const S = 4.4, TY = .32;
      { const rim = keep(B.MeshBuilder.CreateBox('hsRim', { width: S + .5, height: TY, depth: S + .5 }, scene)); rim.material = rimM; rim.position.y = TY / 2; }
      const board = keep(B.MeshBuilder.CreateGround('hsBoard', { width: S, height: S }, scene)); board.material = boardM; board.position.y = TY + .005; board.isPickable = true; board.metadata = { hsBoard: true };
      let bd = null; // { k, n, isl, E[], v[] planks per edge, sol Map, sel, hist[], hints, flash }
      const st = { phase: 'pick', t: 0 };
      function build(k) {
        const L = LV[k]; bd = { k, n: L.n, isl: L.isl, E: edgesOf(L.isl), sel: -1, hist: [], hints: 0, flash: null };
        bd.v = bd.E.map(() => 0); bd.sol = new Map(L.sol.map(([a, b, w]) => [Math.min(a, b) + ',' + Math.max(a, b), w]));
        ctx.player.place(0, cam[2] - 1.6, 0); draw(); info();
      }
      const info = () => H.info(bd ? `Pond ${bd.k + 1} / ${LV.length} · ${bd.isl.length} stones · ${bd.v.reduce((s, x) => s + x, 0)} planks${bd.hints ? ` · hints ${bd.hints}` : ''}` : 'Pick a pond');
      const geo = () => { const C = TEX / (bd.n + 1); return { C, px: x => (x + 1) * C, py: y => (y + 1) * C }; };
      const deg = i => bd.E.reduce((s, e, k) => s + ((e.a === i || e.b === i) ? bd.v[k] : 0), 0);
      function connected() { const n = bd.isl.length, par = [...Array(n).keys()], f = x => par[x] === x ? x : (par[x] = f(par[x])); bd.E.forEach((e, k) => { if (bd.v[k] > 0) par[f(e.a)] = f(e.b); }); const r = f(0); return bd.isl.every((_, i) => f(i) === r); }
      function draw() {
        const g = tex.getContext(), { C, px, py } = geo(), won = st.phase === 'won' || st.phase === 'done';
        const grd = g.createLinearGradient(0, 0, TEX, TEX); grd.addColorStop(0, '#2f5f73'); grd.addColorStop(1, '#244b5c'); g.fillStyle = grd; g.fillRect(0, 0, TEX, TEX);
        g.strokeStyle = 'rgba(200,235,250,.12)'; g.lineWidth = 3; for (let i = 0; i < 14; i++) { const y = (i * 151) % TEX; g.beginPath(); g.moveTo((i * 97) % 300, y); g.quadraticCurveTo(TEX / 2, y - 22, TEX - (i * 61) % 300, y); g.stroke(); }
        g.fillStyle = 'rgba(255,255,255,.08)'; for (let y = 0; y < bd.n; y++) for (let x = 0; x < bd.n; x++) { g.beginPath(); g.arc(px(x), py(y), 3, 0, Math.PI * 2); g.fill(); }
        // planks
        bd.E.forEach((e, k) => { const w = bd.v[k]; if (!w) return; const A = bd.isl[e.a], Bi = bd.isl[e.b], x0 = px(A[0]), y0 = py(A[1]), x1 = px(Bi[0]), y1 = py(Bi[1]), off = w === 2 ? C * .11 : 0;
          const clash = e.cross.some(j => bd.v[j] > 0);
          for (const s of w === 2 ? [-1, 1] : [0]) { const ox = e.h ? 0 : s * off, oy = e.h ? s * off : 0; g.strokeStyle = clash ? '#e04a3a' : won ? '#e9c46a' : '#c99a5b'; g.lineWidth = Math.max(5, C * .1); g.beginPath(); g.moveTo(x0 + ox, y0 + oy); g.lineTo(x1 + ox, y1 + oy); g.stroke();
            g.strokeStyle = 'rgba(60,35,15,.55)'; g.lineWidth = 2; for (let t = .15; t < .9; t += .1) { const mx = x0 + (x1 - x0) * t + ox, my = y0 + (y1 - y0) * t + oy; g.beginPath(); if (e.h) { g.moveTo(mx, my - C * .05); g.lineTo(mx, my + C * .05); } else { g.moveTo(mx - C * .05, my); g.lineTo(mx + C * .05, my); } g.stroke(); } } });
        // stones
        bd.isl.forEach((p, i) => { const x = px(p[0]), y = py(p[1]), r = C * .36, d = deg(i), over = d > p[2], done = d === p[2];
          g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.arc(x + 4, y + 6, r, 0, Math.PI * 2); g.fill();
          g.fillStyle = won ? '#f2e2b0' : done ? '#9aa2a4' : '#e8e2d4'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
          g.strokeStyle = i === bd.sel ? '#ffb020' : over ? '#e04a3a' : '#4b4640'; g.lineWidth = i === bd.sel ? 8 : 4; g.stroke();
          if (bd.flash && (bd.flash.a === i || bd.flash.b === i)) { g.strokeStyle = bd.flash.good ? '#40c060' : '#e04a3a'; g.lineWidth = 8; g.stroke(); }
          g.fillStyle = over ? '#c02a1a' : done ? '#4c5254' : '#231d16'; g.font = `bold ${Math.round(r * 1.15)}px Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(p[2]), x, y + r * .08); });
        tex.update();
      }
      function check() { if (bd.isl.some((p, i) => deg(i) !== p[2])) return; if (bd.E.some((e, k) => bd.v[k] > 0 && e.cross.some(j => bd.v[j] > 0))) return; if (!connected()) { H.msg('Every number is met, but not every stone is joined', 1800); return; }
        st.phase = 'won'; st.wt = 0; bd.sel = -1; draw(); pads.style.display = 'none'; ctx.sound('gamewin'); H.msg('The pond is bridged', 1600);
        if (bd.k + 1 > solvedUpTo) { solvedUpTo = bd.k + 1; try { localStorage.setItem(KEY, String(solvedUpTo)); } catch (e) {} } }
      function link(a, b, to) {
        if (st.phase !== 'play') return false; const k = bd.E.findIndex(e => (e.a === a && e.b === b) || (e.a === b && e.b === a));
        if (k < 0) { H.msg('Bridges only run straight to the next stone in a row or column', 1500); return false; }
        const next = to != null ? to : (bd.v[k] + 1) % 3; if (next > 0 && bd.E[k].cross.some(j => bd.v[j] > 0)) { H.msg('Bridges may not cross', 1100); return false; }
        bd.hist.push({ k, v: bd.v[k] }); bd.v[k] = next; ctx.note(next ? 520 + next * 120 : 330, 'lantern'); draw(); info(); check(); return true;
      }
      function tapStone(i) { if (st.phase !== 'play') return; if (bd.sel < 0) { bd.sel = i; draw(); return; } if (bd.sel === i) { bd.sel = -1; draw(); return; } const a = bd.sel; bd.sel = -1; if (!link(a, i)) { bd.sel = i; } draw(); }
      function restart() { if (st.phase !== 'play' || !bd) return; const h = bd.hints; build(bd.k); bd.hints = h; info(); H.msg('Start again', 900); }
      function undo() { if (st.phase !== 'play' || !bd?.hist.length) return; const h = bd.hist.pop(); bd.v[h.k] = h.v; draw(); info(); }
      function hint() {
        if (st.phase !== 'play') return; bd.hints++; info(); const key = e => Math.min(e.a, e.b) + ',' + Math.max(e.a, e.b);
        const wrong = bd.E.findIndex((e, k) => bd.v[k] > (bd.sol.get(key(e)) || 0)); if (wrong >= 0) { const e = bd.E[wrong]; bd.flash = { a: e.a, b: e.b, t: 0, good: false }; link(e.a, e.b, bd.sol.get(key(e)) || 0); H.msg('Too many planks there', 1300); return; }
        const miss = bd.E.findIndex((e, k) => bd.v[k] < (bd.sol.get(key(e)) || 0)); if (miss < 0) return; const e = bd.E[miss]; bd.flash = { a: e.a, b: e.b, t: 0, good: true }; link(e.a, e.b, bd.sol.get(key(e))); H.msg('A right bridge', 1100);
      }
      const hud = document.getElementById('gameHud');
      const pick = document.createElement('div');
      pick.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(400px,90vw);background:rgba(16,10,22,.95);border:1px solid rgba(190,140,230,.6);border-radius:14px;padding:16px;text-align:center;pointer-events:auto;font:15px/1.4 system-ui,sans-serif;color:#eee';
      const drawPick = () => { pick.innerHTML = `<div style="font:800 13px/1.2 system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#d2a8f0;margin-bottom:10px">The Garden Bridges</div><div style="margin-bottom:12px;color:#bbb">Each number is the planks touching that stone; join every stone, no crossings.</div>`
        + `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">${LV.map((L, k) => { const open = k <= solvedUpTo, ok = k < solvedUpTo; return `<button type="button" data-k="${k}" ${open ? '' : 'disabled'} style="padding:8px 2px;border-radius:9px;border:1px solid ${open ? '#d2a8f0' : '#444'};background:${ok ? 'rgba(210,168,240,.22)' : 'rgba(255,255,255,.04)'};color:${open ? '#fff' : '#666'};font:700 15px system-ui,sans-serif;cursor:${open ? 'pointer' : 'default'}">${open ? `${k + 1}<div style="font:11px system-ui;opacity:.75">${L.isl.length} stones</div>` : '🔒'}${ok ? ' ✓' : ''}</button>`; }).join('')}</div>`;
        pick.querySelectorAll('button[data-k]').forEach(b => b.onclick = (e) => { e.stopPropagation(); b.blur(); choose(+b.dataset.k); }); };
      const pads = document.createElement('div');
      pads.style.cssText = 'position:absolute;bottom:62px;right:14px;display:none;gap:6px;pointer-events:auto';
      const padBtn = (t, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.style.cssText = 'min-width:52px;height:40px;padding:0 10px;border-radius:9px;border:1px solid #b48ad6;background:rgba(18,10,26,.88);color:#f6ecff;font:700 15px system-ui;cursor:pointer'; b.onclick = (e) => { e.stopPropagation(); b.blur(); fn(); }; pads.appendChild(b); return b; };
      padBtn('↶ Undo', undo); padBtn('Hint', hint);
      function choose(k) { if (st.phase !== 'pick' || k > solvedUpTo || k >= LV.length) return; pick.remove(); st.phase = 'play'; build(k); pads.style.display = 'flex'; H.msg(`Pond ${k + 1}`, 900, `${LV[k].isl.length} stones`); }
      hud.append(pick, pads); drawPick();
      const cam = [0, TY + 6.6, -3.3], at = [0, TY, .05];
      ctx.player.place(0, cam[2] - 1.6, 0); ctx.look(cam, at, def.fov || .8); // the player waits behind the camera, out of the picture
      { const g = tex.getContext(); g.fillStyle = '#2f5f73'; g.fillRect(0, 0, TEX, TEX); tex.update(); }
      H.title(def.title || 'The Garden Bridges'); H.score(''); info();
      H.hint('Click a stone, then a stone in line with it: one plank, two, none. <kbd>U</kbd> undo, <kbd>H</kbd> hint.');
      return {
        update(dt) {
          ctx.look(cam, at); st.t += dt; if (!bd) return;
          if (bd.flash && (bd.flash.t += dt) > 1.1) { bd.flash = null; draw(); }
          if (st.phase === 'won' && (st.wt += dt) > 1.8) { st.phase = 'done'; H.hint(''); const k = bd.k;
            ctx.finish({ score: (k + 1) * 20 + (bd.hints ? 0 : 10), label: 'points', solved: true, extra: `Pond ${k + 1}: ${bd.isl.length} stones joined with ${bd.v.reduce((s, x) => s + x, 0)} planks${bd.hints ? `, ${bd.hints} hint${bd.hints > 1 ? 's' : ''}` : ''}.${k + 1 < LV.length ? ` Pond ${k + 2} is open.` : ' Every pond bridged.'}` }); }
        },
        key(e, down) {
          if (!down || e.repeat) return; const k = e.key.toLowerCase();
          if (st.phase === 'pick') { const n = k === '0' ? 10 : parseInt(k, 10); if (n >= 1 && n <= LV.length) choose(n - 1); return; } // 1-9, 0 = the tenth
          if (k === 'u' || k === 'z' || k === 'backspace') undo(); else if (k === 'h') hint(); else if (k === 'escape') { bd.sel = -1; draw(); }
        },
        pointer(evt) {
          if (evt.type !== B.PointerEventTypes.POINTERDOWN || st.phase !== 'play' || !bd) return;
          const hit = scene.pickWithRay(ctx.ray(), m => m.metadata?.hsBoard); if (!hit?.pickedPoint) return;
          const l = ctx.toLocal(hit.pickedPoint), u = (l.x / S + .5) * TEX, v = (.5 - l.z / S) * TEX, { C, px, py } = geo();
          let best = -1, bdist = C * .55; bd.isl.forEach((p, i) => { const d = Math.hypot(px(p[0]) - u, py(p[1]) - v); if (d < bdist) { bdist = d; best = i; } });
          if (best >= 0) tapStone(best); else { bd.sel = -1; draw(); }
        },
        restart, // the HUD's Restart button
        _test: { st, choose, link, tapStone, undo, hint, get bd() { return bd; }, LV, edgesOf },
        dispose() { pick.remove(); pads.remove(); nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); try { boardM.dispose(); tex.dispose(); } catch (e) {} }
      };
    }
  };
  window.RebelGames.register('hashi', G);
})();
