// The Land Grants (Oct 15, Shogun): the Shogun's map of fields must be shared out in rectangular grants. Every grant
// holds exactly one seal, and the seal's number is the grant's size in fields; every field belongs to one grant.
// Drag from corner to corner to draw a grant (a click on a grant takes it back); grants that fit glow in their
// family colour, ones that break the rule show red. Seven maps from 5 x 5 to the 14 x 14 Shogun's Domain, each with
// one answer (checked by a solver; the big ones need "what if this grant lay here?" reasoning). H hint (no clean
// bonus). Score: the map x 20, +10 without a hint. def: { levels, pass, points }
// Oct 17 (Miguel: the puzzles need a how-to, every board a Restart): howTo (the rules in a few lines) and inst.restart
// (the same map with no grants, the clock from 0; hints still count: they cost the bonus).
// Oct 17 (Miguel: "take it to 10 maps"): three more, 15 x 15, 16 x 16 and 17 x 17, from the Oct 15 generator (scratchpad
// lv/grants: gen.mjs with a Math.imul LCG, gen17.mjs grading with the seals in the order kept here). Each has one answer
// by its counting search and by a SAT model written apart from it (lv/grants/sat.py; all ten pass); the logic solver
// needs 4, 5 and 7 what-ifs (the Shogun's Domain 3). Maps of 15 x 15 and up are seen from higher up, their seals larger.
(function () {
  const LEVELS = [
    { name: "The Paddy", n: 5, clues: [[1,5],[7,6],[13,6],[15,5],[23,3]], sol: [[0,0,5,1],[0,1,5,1],[0,2,2,3],[2,2,2,3],[4,2,1,3]] },
    { name: "The Orchard", n: 6, clues: [[2,5],[6,6],[10,8],[14,2],[20,3],[25,4],[29,6],[33,2]], sol: [[0,0,1,5],[0,5,6,1],[1,0,3,2],[1,2,2,1],[1,3,4,2],[3,2,3,1],[4,0,2,2],[5,3,1,2]] },
    { name: "The Village Fields", n: 7, clues: [[3,9],[7,4],[13,3],[23,8],[32,4],[35,8],[41,4],[42,2],[47,7]], sol: [[0,0,2,2],[0,2,3,3],[0,5,7,1],[0,6,3,1],[2,0,4,2],[3,2,4,2],[3,4,4,1],[3,6,4,1],[6,0,1,2]] },
    { name: "The River Valley", n: 8, clues: [[12,8],[17,10],[19,6],[22,4],[31,6],[37,6],[42,2],[46,3],[50,3],[55,2],[56,8],[58,3],[61,3]], sol: [[0,0,8,1],[0,1,5,2],[0,3,6,1],[0,4,4,2],[0,6,4,1],[0,7,6,1],[4,4,3,2],[4,6,3,1],[5,1,1,2],[6,1,1,3],[6,7,2,1],[7,1,1,3],[7,4,1,3]] },
    { name: "The Lord's Estate", n: 10, clues: [[5,7],[8,8],[11,12],[44,4],[45,8],[51,5],[57,4],[60,9],[69,9],[73,10],[76,6],[77,4],[78,3],[82,3],[92,4],[95,2],[99,2]], sol: [[0,0,1,7],[0,7,4,2],[0,9,9,1],[1,0,9,1],[1,1,2,6],[3,1,5,1],[3,2,5,2],[3,4,4,1],[3,5,4,2],[4,7,2,2],[6,7,4,1],[6,8,3,1],[7,4,2,3],[8,1,1,3],[9,1,1,4],[9,5,1,2],[9,8,1,2]] },
    { name: "The Province", n: 12, clues: [[15,8],[20,10],[23,9],[29,12],[32,6],[39,8],[54,9],[75,14],[94,10],[100,3],[115,8],[116,4],[119,8],[121,14],[125,3],[129,4],[130,3],[136,7],[140,2],[142,2]], sol: [[0,0,2,4],[0,4,2,5],[0,9,3,3],[2,0,2,4],[2,4,6,2],[2,6,2,3],[3,9,5,2],[3,11,8,1],[4,0,7,2],[4,2,7,2],[4,6,3,3],[7,6,4,2],[7,8,4,1],[8,4,3,1],[8,5,3,1],[8,9,4,1],[8,10,3,1],[11,0,1,7],[11,7,1,2],[11,10,1,2]] },
    { name: "The Shogun's Domain", n: 14, clues: [[8,11],[15,11],[20,16],[26,12],[50,16],[67,12],[70,12],[89,8],[105,8],[115,10],[122,10],[137,10],[142,11],[143,8],[145,8],[162,4],[167,12],[168,2],[183,3],[184,2],[187,4],[191,4],[195,2]], sol: [[0,0,12,1],[0,1,11,1],[0,2,1,11],[0,13,12,1],[1,2,11,1],[1,3,4,4],[1,7,2,6],[3,7,4,4],[3,11,6,2],[5,3,5,2],[5,5,4,2],[7,7,4,2],[7,9,5,2],[9,5,4,2],[9,11,5,2],[10,3,4,2],[11,1,3,1],[11,7,2,2],[12,0,2,1],[12,2,2,1],[12,9,2,2],[12,13,2,1],[13,5,1,4]] },
    // Oct 17: 15 x 15 to 17 x 17 (scratchpad lv/grants)
    { name: "The Daimyo's Lands", n: 15, clues: [[5,13],[28,4],[30,8],[32,16],[40,9],[51,15],[70,8],[71,9],[78,8],[82,2],[91,10],[102,8],[104,9],[113,16],[133,7],[139,9],[150,3],[160,14],[164,8],[167,12],[171,8],[192,3],[195,4],[200,2],[201,2],[206,2],[208,2],[209,2],[212,2],[213,3],[219,4],[221,3]], sol: [[0,0,8,1],[0,1,4,4],[0,5,13,1],[0,6,5,3],[0,9,3,3],[0,12,2,2],[0,14,9,1],[2,12,8,1],[2,13,7,1],[3,9,4,2],[3,11,9,1],[4,1,10,1],[4,2,4,2],[4,4,9,1],[5,6,8,1],[5,7,1,2],[6,7,8,2],[7,9,7,2],[8,0,3,1],[8,2,6,2],[9,13,4,2],[10,12,3,1],[11,0,4,1],[12,11,2,1],[13,4,1,2],[13,6,2,1],[13,12,1,2],[13,14,2,1],[14,1,1,2],[14,3,1,3],[14,7,1,4],[14,11,1,3]] },
    { name: "The Eastern Provinces", n: 16, clues: [[16,16],[41,12],[61,10],[69,10],[72,9],[73,9],[82,4],[87,18],[115,9],[138,20],[143,20],[146,6],[160,18],[180,20],[201,8],[209,3],[214,6],[220,20],[227,3],[235,12],[239,12],[240,3],[242,2],[245,4],[253,2]], sol: [[0,0,4,4],[0,4,5,2],[0,6,3,4],[0,10,10,2],[0,12,5,2],[0,14,10,2],[3,6,9,2],[3,8,9,1],[3,9,9,1],[4,0,9,2],[4,2,4,1],[4,3,9,1],[5,4,10,2],[5,12,10,2],[8,2,6,1],[10,10,6,2],[10,14,6,2],[12,6,3,2],[12,8,4,2],[13,0,3,1],[13,1,3,1],[13,3,3,1],[14,2,2,1],[15,4,1,4],[15,12,1,2]] },
    { name: "The Realm Under Heaven", n: 17, clues: [[1,8],[9,6],[10,8],[25,6],[37,10],[41,14],[64,15],[74,20],[79,10],[99,18],[103,18],[106,12],[152,17],[163,18],[173,20],[201,16],[213,18],[216,13],[239,8],[244,12],[259,4],[262,2],[264,6],[272,4],[281,4],[284,2]], sol: [[0,0,2,4],[0,4,1,6],[0,10,2,4],[0,14,9,2],[0,16,17,1],[1,4,12,1],[1,5,10,2],[1,7,14,1],[1,8,3,2],[2,0,9,2],[2,2,5,2],[2,10,5,2],[2,12,13,1],[2,13,15,1],[4,8,9,2],[7,2,10,2],[7,10,9,2],[9,14,8,2],[11,0,4,2],[11,5,6,2],[13,4,4,1],[13,8,3,2],[15,0,2,2],[15,7,2,1],[15,12,2,1],[16,8,1,4]] }
  ];
  const FAM = ['#9b6fc8', '#d9a83a', '#4fa3a0', '#c8607a', '#6f8fd0', '#8fb04a', '#d07a3c', '#b07ab8', '#5f9f70', '#c99a6a'];
  const G = {
    title: 'The Land Grants',
    howTo: {
      lines: ['Share the whole map out in rectangles called grants. Every grant must hold exactly one seal, and the seal\'s number is the grant\'s size in fields.',
        'So a 6 can be 1 x 6, 2 x 3, 3 x 2 or 6 x 1 fields. Every field must end up in exactly one grant.',
        'Drag from one corner of a grant to the opposite corner to draw it; click a grant to take it back. Keys: arrows move, Space at each corner, Del removes.',
        'A grant that keeps the rule glows in colour; one that breaks it shows red. U undoes, Clear empties the map, H lays one right grant (no clean bonus then).',
        'Tip: start with the seals that can only fit one way, like a big number pressed against the edge or between other seals.']
    },
    start(ctx) {
      const B = ctx.B, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const LV = def.levels || LEVELS, KEY = 'rebelAntsGrantsProgress:' + (def.id || 'grants');
      let solvedUpTo = 0; try { solvedUpTo = Math.max(0, Math.min(LV.length, Number(localStorage.getItem(KEY)) || 0)); } catch (e) {}
      const mat = (k, c, em) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(.05, .05, .05); if (em) m.emissiveColor = new B.Color3(...em); return m; });
      const lacqM = mat('lacquer', [.18, .08, .16], [.05, .02, .045]), goldM = mat('gold', [.8, .62, .25], [.22, .16, .05]);
      const nodes = [], keep = n => { n.parent = n.parent || ctx.frame; ctx.add(n); nodes.push(n); if (n.isPickable !== undefined) n.isPickable = false; return n; };
      const TEX = 1024, tex = new B.DynamicTexture('gtTex', { width: TEX, height: TEX }, scene, true); tex.hasAlpha = false;
      const boardM = new B.StandardMaterial('gtBoardMat', scene); boardM.diffuseTexture = tex; boardM.emissiveTexture = tex; boardM.emissiveColor = new B.Color3(.62, .62, .62); boardM.diffuseColor = new B.Color3(.55, .55, .55); boardM.specularColor = new B.Color3(0, 0, 0);
      const S = 4.4, TY = .8;
      { const t = keep(B.MeshBuilder.CreateBox('gtTable', { width: S + .44, height: .16, depth: S + .44 }, scene)); t.material = lacqM; t.position.y = TY - .08;
        for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const l = keep(B.MeshBuilder.CreateBox('gtLeg', { width: .2, height: TY - .16, depth: .2 }, scene)); l.material = lacqM; l.position.set(x * (S / 2 - .05), (TY - .16) / 2, z * (S / 2 - .05));
          const c = keep(B.MeshBuilder.CreateBox('gtCorner', { width: .26, height: .05, depth: .26 }, scene)); c.material = goldM; c.position.set(x * (S / 2 + .1), TY + .02, z * (S / 2 + .1)); } }
      const board = keep(B.MeshBuilder.CreateGround('gtBoard', { width: S, height: S }, scene)); board.material = boardM; board.position.y = TY + .005; board.isPickable = true; board.metadata = { gtBoard: true };
      const M = 28, GS = TEX - 2 * M;
      let bd = null; // { k, n, L, clueAt: Int16Array (-1 / clue index), rects: [{ r0, c0, r1, c1, id }], undo: [], hints, time, cur, anchor, flash }
      const st = { phase: 'pick', t: 0, drag: null };
      const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
      let rid = 1;
      function build(k) { const L = LV[k], n = L.n; bd = { k, n, L, clueAt: new Int16Array(n * n).fill(-1), rects: [], undo: [], hints: 0, time: 0, cur: Math.floor(n / 2) * n + Math.floor(n / 2), anchor: -1, flash: null };
        L.clues.forEach(([i], j) => bd.clueAt[i] = j); view(n); ctx.player.place(0, -5.1, 0); draw(); info(); }
      const area = R => (R.r1 - R.r0 + 1) * (R.c1 - R.c0 + 1);
      const inR = (R, r, c) => r >= R.r0 && r <= R.r1 && c >= R.c0 && c <= R.c1;
      const overlap = (A, Bq) => !(A.r1 < Bq.r0 || Bq.r1 < A.r0 || A.c1 < Bq.c0 || Bq.c1 < A.c0);
      function cluesIn(R) { const out = []; for (let r = R.r0; r <= R.r1; r++) for (let c = R.c0; c <= R.c1; c++) { const j = bd.clueAt[r * bd.n + c]; if (j >= 0) out.push(j); } return out; }
      const valid = R => { const q = cluesIn(R); return q.length === 1 && bd.L.clues[q[0]][1] === area(R); };
      const rectAt = (r, c) => bd.rects.find(R => inR(R, r, c));
      const covered = () => { let s = 0; for (const R of bd.rects) s += area(R); return s; };
      const info = () => H.info(bd ? `Map ${bd.k + 1} / ${LV.length} · ${bd.L.name} · ${bd.n} × ${bd.n} · ${bd.rects.filter(valid).length} / ${bd.L.clues.length} grants · ${fmt(bd.time)}${bd.hints ? ` · hints ${bd.hints}` : ''}` : 'Pick a map');
      const famOf = R => { const q = cluesIn(R); return FAM[(q.length ? q[0] : R.id) % FAM.length]; };
      function draw() {
        const g = tex.getContext(), n = bd.n, C = GS / n, won = st.phase === 'won' || st.phase === 'done', big = n >= 15;
        g.fillStyle = '#2a1a2a'; g.fillRect(0, 0, TEX, TEX);
        for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) { const x = M + c * C, y = M + r * C; g.fillStyle = (r + c) % 2 ? '#7c9a52' : '#86a45a'; g.fillRect(x, y, C, C);
          g.strokeStyle = 'rgba(40,60,20,.35)'; g.lineWidth = 1; for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(x + 3, y + k * C / 4); g.lineTo(x + C - 3, y + k * C / 4); g.stroke(); } }
        g.strokeStyle = 'rgba(30,20,10,.5)'; g.lineWidth = 2; for (let a = 0; a <= n; a++) { g.beginPath(); g.moveTo(M + a * C, M); g.lineTo(M + a * C, M + GS); g.stroke(); g.beginPath(); g.moveTo(M, M + a * C); g.lineTo(M + GS, M + a * C); g.stroke(); }
        const rects = bd.rects.slice(); if (st.drag && st.drag.prev) rects.push(st.drag.prev);
        for (const R of rects) { const ok = valid(R), pv = R === st.drag?.prev, x = M + R.c0 * C, y = M + R.r0 * C, w = (R.c1 - R.c0 + 1) * C, h = (R.r1 - R.r0 + 1) * C;
          g.save(); g.globalAlpha = pv ? .45 : ok ? .62 : .4; g.fillStyle = pv ? '#fff2c8' : ok ? famOf(R) : '#d8b0a8'; g.fillRect(x + 4, y + 4, w - 8, h - 8); g.restore();
          g.lineWidth = Math.max(4, C * .07); g.strokeStyle = pv ? '#fff2c8' : ok ? (won ? '#ffe9a0' : '#f3dc9a') : '#e0453a'; if (!ok && !pv) g.setLineDash([C * .18, C * .12]); g.strokeRect(x + 5, y + 5, w - 10, h - 10); g.setLineDash([]);
          if (pv) { g.fillStyle = '#1a1010'; g.font = `bold ${Math.round(Math.min(C * .42, 46))}px Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(`${R.r1 - R.r0 + 1}×${R.c1 - R.c0 + 1}=${area(R)}`, x + w / 2, y + h - Math.min(C * .3, 30)); } }
        g.textAlign = 'center'; g.textBaseline = 'middle';
        bd.L.clues.forEach(([i, a]) => { const r = Math.floor(i / n), c = i % n, x = M + (c + .5) * C, y = M + (r + .5) * C, R = rectAt(r, c), ok = R && valid(R);
          g.fillStyle = ok ? '#f6e7bf' : '#efe2c0'; g.beginPath(); g.arc(x, y, C * (big ? .43 : .36), 0, Math.PI * 2); g.fill(); g.lineWidth = Math.max(3, C * .05); g.strokeStyle = ok ? '#7a5a1a' : '#8a2a22'; g.stroke();
          g.fillStyle = ok ? '#4a3410' : '#7a1d18'; g.font = `bold ${Math.round(C * (a >= 10 ? (big ? .5 : .38) : (big ? .6 : .46)))}px Georgia, serif`; g.fillText(String(a), x, y + C * .02); });
        if (st.phase === 'play') { const x = M + (bd.cur % n) * C, y = M + Math.floor(bd.cur / n) * C; g.strokeStyle = 'rgba(255,215,90,.95)'; g.lineWidth = 5; g.strokeRect(x + 2, y + 2, C - 4, C - 4);
          if (bd.anchor >= 0) { const ax = M + (bd.anchor % n) * C, ay = M + Math.floor(bd.anchor / n) * C; g.fillStyle = 'rgba(255,215,90,.5)'; g.fillRect(ax + C * .3, ay + C * .3, C * .4, C * .4); } }
        if (bd.flash) { const R = bd.flash.R, x = M + R.c0 * C, y = M + R.r0 * C; g.strokeStyle = bd.flash.good ? '#40f070' : '#ff4040'; g.lineWidth = 9; g.strokeRect(x + 2, y + 2, (R.c1 - R.c0 + 1) * C - 4, (R.r1 - R.r0 + 1) * C - 4); }
        tex.update();
      }
      const snap = () => bd.rects.map(R => ({ ...R }));
      function place(R) { // a new grant pushes out every grant it overlaps
        if (st.phase !== 'play') return false; bd.undo.push(snap()); if (bd.undo.length > 300) bd.undo.shift();
        bd.rects = bd.rects.filter(Q => !overlap(Q, R)); bd.rects.push({ ...R, id: rid++ }); ctx.note(valid(R) ? 660 + Math.min(12, area(R)) * 20 : 330, valid(R) ? 'bell' : 'lantern'); draw(); info(); check(); return true; }
      function remove(r, c) { if (st.phase !== 'play') return false; const R = rectAt(r, c); if (!R) return false; bd.undo.push(snap()); bd.rects = bd.rects.filter(Q => Q !== R); ctx.note(300, 'lantern'); draw(); info(); return true; }
      function rectOf(a, b) { const n = bd.n, r0 = Math.min(Math.floor(a / n), Math.floor(b / n)), r1 = Math.max(Math.floor(a / n), Math.floor(b / n)), c0 = Math.min(a % n, b % n), c1 = Math.max(a % n, b % n); return { r0, c0, r1, c1 }; }
      function release(a, b) { // a click (same cell) on a grant takes it back; on open ground it makes a 1 x 1 grant
        const n = bd.n; if (a === b) { if (rectAt(Math.floor(a / n), a % n)) return remove(Math.floor(a / n), a % n); return place(rectOf(a, a)); } return place(rectOf(a, b)); }
      function undo() { if (st.phase !== 'play') return; const s = bd.undo.pop(); if (!s) return; bd.rects = s; ctx.note(330, 'lantern'); draw(); info(); }
      function restart() { if (st.phase !== 'play' || !bd) return; const h = bd.hints; st.drag = null; build(bd.k); bd.hints = h; info(); H.msg('Start again', 900); }
      function clearAll() { if (st.phase !== 'play' || !bd.rects.length) return; bd.undo.push(snap()); bd.rects = []; draw(); info(); }
      function cands(j) { // every grant of clue j's size holding it and no other seal (for the hint)
        const n = bd.n, [i, a] = bd.L.clues[j], r = Math.floor(i / n), c = i % n, out = [];
        for (let h = 1; h <= a; h++) { if (a % h) continue; const w = a / h; for (let r0 = r - h + 1; r0 <= r; r0++) for (let c0 = c - w + 1; c0 <= c; c0++) { const R = { r0, c0, r1: r0 + h - 1, c1: c0 + w - 1 }; if (r0 < 0 || c0 < 0 || R.r1 >= n || R.c1 >= n) continue; if (cluesIn(R).length === 1) out.push(R); } }
        return out; }
      function hint() {
        if (st.phase !== 'play') return; const sol = bd.L.sol.map(([r, c, h, w]) => ({ r0: r, c0: c, r1: r + h - 1, c1: c + w - 1 }));
        const same = (A, Bq) => A.r0 === Bq.r0 && A.c0 === Bq.c0 && A.r1 === Bq.r1 && A.c1 === Bq.c1;
        const wrong = bd.rects.find(R => !sol.some(Q => same(Q, R)));
        if (wrong) { bd.undo.push(snap()); bd.rects = bd.rects.filter(Q => Q !== wrong); bd.hints++; bd.flash = { R: wrong, t: 0, good: false }; H.msg('That grant is not right', 1300); draw(); info(); return; }
        // the missing grant whose seal has the fewest ways to lie
        let best = null, bc = 1e9; for (const Q of sol) { if (bd.rects.some(R => same(R, Q))) continue; const j = cluesIn(Q)[0], k = cands(j).filter(R => !bd.rects.some(P => overlap(P, R))).length || 99; if (k < bc) { bc = k; best = Q; } }
        if (!best) return; bd.hints++; bd.flash = { R: best, t: 0, good: true }; H.msg('A grant lies here', 1300); place(best);
      }
      function check() { if (covered() !== bd.n * bd.n || !bd.rects.every(valid)) return false;
        st.phase = 'won'; st.wt = 0; st.drag = null; bd.anchor = -1; draw(); pads.style.display = 'none'; ctx.sound('gamewin'); H.msg('Every field is granted', 1600, fmt(bd.time));
        if (bd.k + 1 > solvedUpTo) { solvedUpTo = bd.k + 1; try { localStorage.setItem(KEY, String(solvedUpTo)); } catch (e) {} } return true; }
      const hud = document.getElementById('gameHud');
      const pick = document.createElement('div');
      pick.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(' + (LV.length > 6 && innerWidth >= 600 ? 560 : 420) + 'px,92vw);background:rgba(22,10,20,.95);border:1px solid rgba(220,180,90,.6);border-radius:14px;padding:16px;text-align:center;pointer-events:auto;font:15px/1.4 system-ui,sans-serif;color:#eee';
      const drawPick = () => { pick.innerHTML = `<div style="font:800 13px/1.2 system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#e8c46a;margin-bottom:10px">The Land Grants</div><div style="margin-bottom:12px;color:#bbb">Share the fields in rectangles: one seal each, sized by its number.</div>`
        + `<div style="display:grid;grid-template-columns:repeat(${LV.length > 6 && innerWidth >= 600 ? 5 : 4},1fr);gap:8px">${LV.map((L, k) => { const open = k <= solvedUpTo, ok = k < solvedUpTo; return `<button type="button" data-k="${k}" ${open ? '' : 'disabled'} style="padding:8px 2px;border-radius:9px;border:1px solid ${open ? '#e8c46a' : '#444'};background:${ok ? 'rgba(232,196,106,.2)' : 'rgba(255,255,255,.04)'};color:${open ? '#fff' : '#666'};font:700 15px system-ui,sans-serif;cursor:${open ? 'pointer' : 'default'}">${open ? `${k + 1}<div style="font:11px system-ui;opacity:.75">${L.n}×${L.n} · ${L.clues.length} seals</div>` : '🔒'}${ok ? ' ✓' : ''}</button>`; }).join('')}</div>`;
        pick.querySelectorAll('button[data-k]').forEach(b => b.onclick = (e) => { e.stopPropagation(); b.blur(); choose(+b.dataset.k); }); };
      const pads = document.createElement('div');
      pads.style.cssText = 'position:absolute;bottom:62px;right:14px;display:none;gap:6px;pointer-events:auto';
      const padBtn = (t, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.style.cssText = 'min-width:52px;height:40px;padding:0 10px;border-radius:9px;border:1px solid #d6b060;background:rgba(26,10,22,.88);color:#fff0d0;font:700 15px system-ui;cursor:pointer'; b.onclick = (e) => { e.stopPropagation(); b.blur(); fn(); }; pads.appendChild(b); return b; };
      padBtn('Undo', undo); padBtn('Clear', clearAll); padBtn('Hint', hint);
      function choose(k) { if (st.phase !== 'pick' || k > solvedUpTo || k >= LV.length) return; pick.remove(); st.phase = 'play'; build(k); pads.style.display = 'flex'; H.msg(`Map ${k + 1}`, 900, `${LV[k].name}: ${LV[k].clues.length} seals`); }
      hud.append(pick, pads); drawPick();
      const cam = [0, TY + 6.5, -3.5], at = [0, TY, -.32];
      // the big maps (15 x 15 and up, Oct 17) are seen from higher up and more from above, so the far rows stay readable
      // (their seals are drawn larger too); the player still waits where the camera stood for the others
      const view = n => { const big = n >= 15; cam[1] = TY + (big ? 7.5 : 6.5); cam[2] = big ? -1.8 : -3.5; at[2] = big ? -.08 : -.32; };
      ctx.player.place(0, cam[2] - 1.6, 0); ctx.look(cam, at, def.fov || .8); // the player waits behind the camera, out of the picture
      { const g = tex.getContext(); g.fillStyle = '#7c9a52'; g.fillRect(0, 0, TEX, TEX); tex.update(); }
      H.title(def.title || 'The Land Grants'); H.score(''); info();
      H.hint('Drag from corner to corner to grant a rectangle; click a grant to take it back. Keys: arrows, <kbd>Space</kbd> twice for the corners, <kbd>Del</kbd>, <kbd>U</kbd> undo, <kbd>H</kbd> hint.');
      const cellAt = () => { const hit = scene.pickWithRay(ctx.ray(), m => m.metadata?.gtBoard); if (!hit?.pickedPoint) return -1; const l = ctx.toLocal(hit.pickedPoint), n = bd.n, C = GS / n;
        const px = (l.x + S / 2) / S * TEX, py = (S / 2 - l.z) / S * TEX, c = Math.floor((px - M) / C), r = Math.floor((py - M) / C); return c >= 0 && c < n && r >= 0 && r < n ? r * n + c : -1; };
      return {
        update(dt) {
          ctx.look(cam, at); st.t += dt; if (!bd) return;
          if (st.phase === 'play') { const s = Math.floor(bd.time); bd.time += dt; if (Math.floor(bd.time) !== s) info(); }
          if (bd.flash && (bd.flash.t += dt) > 1.6) { bd.flash = null; draw(); }
          if (st.phase === 'won' && (st.wt += dt) > 2) { st.phase = 'done'; H.hint(''); const k = bd.k;
            ctx.finish({ score: (k + 1) * 20 + (bd.hints ? 0 : 10), label: 'points', solved: true, extra: `${bd.L.name} (map ${k + 1}, ${bd.n} × ${bd.n}, ${bd.L.clues.length} grants) shared out in ${fmt(bd.time)}${bd.hints ? `, ${bd.hints} hint${bd.hints > 1 ? 's' : ''}` : ''}.${k + 1 < LV.length ? ` Map ${k + 2} is open.` : ' The whole domain is granted.'}` }); }
        },
        key(e, down) {
          if (!down || e.repeat) return; const k = e.key.toLowerCase();
          if (st.phase === 'pick') { const n = k === '0' ? 10 : parseInt(k, 10); if (n >= 1 && n <= LV.length) choose(n - 1); return; } // 1-9, 0 = the tenth
          if (st.phase !== 'play') return; const n = bd.n, x = bd.cur % n, y = Math.floor(bd.cur / n);
          if (k === 'arrowup' || k === 'w') { bd.cur = ((y - 1 + n) % n) * n + x; draw(); } else if (k === 'arrowdown' || k === 's') { bd.cur = ((y + 1) % n) * n + x; draw(); }
          else if (k === 'arrowleft' || k === 'a') { bd.cur = y * n + (x - 1 + n) % n; draw(); } else if (k === 'arrowright' || k === 'd') { bd.cur = y * n + (x + 1) % n; draw(); }
          else if (k === ' ' || k === 'enter') { if (bd.anchor < 0) { bd.anchor = bd.cur; draw(); } else { const a = bd.anchor; bd.anchor = -1; release(a, bd.cur); } }
          else if (k === 'escape') { if (bd.anchor >= 0) { bd.anchor = -1; draw(); } }
          else if (k === 'backspace' || k === 'delete' || k === 'x') remove(y, x); else if (k === 'u' || (k === 'z' && (e.ctrlKey || e.metaKey))) undo(); else if (k === 'h') hint();
        },
        pointer(evt) {
          const T = B.PointerEventTypes; if (st.phase !== 'play' || !bd) return;
          if (evt.type === T.POINTERDOWN) { const i = cellAt(); if (i < 0) return; bd.cur = i; st.drag = { a: i, b: i, prev: null }; }
          else if (evt.type === T.POINTERMOVE && st.drag) { const i = cellAt(); if (i < 0 || i === st.drag.b) return; st.drag.b = i; bd.cur = i; st.drag.prev = st.drag.a === i ? null : { ...rectOf(st.drag.a, i), id: 0 }; draw(); }
          else if (evt.type === T.POINTERUP && st.drag) { const { a, b } = st.drag; st.drag = null; release(a, b); }
        },
        restart, // the HUD's Restart button
        _test: { st, choose, release, remove, undo, hint, clearAll, valid, cands, get bd() { return bd; }, LV, draw, unlock(k) { solvedUpTo = k; drawPick(); } },
        dispose() { pick.remove(); pads.remove(); nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); try { boardM.dispose(); tex.dispose(); } catch (e) {} }
      };
    }
  };
  window.RebelGames.register('grants', G);
})();
