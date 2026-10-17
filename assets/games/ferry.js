// The Canal Ferry (Oct 15, Buke): get everyone across the canal in the little ferry. Click a piece on the ferry's
// bank to put it aboard (click it again to let it off), then Cross (Space). The rules of each crossing are on the
// card: the fox eats the hen when the ferryman is away, the ronin must never outnumber the samurai on a bank, and on
// the night crossings the lamp only lasts so long (each trip takes as long as the slowest aboard). A broken rule
// sends the ferry back. U undoes a crossing, H shows the next good one (no clean bonus then). Seven crossings, the
// fewest trips found by a solver. Score: the crossing x 20, +10 in the fewest trips without a hint or a slip.
// Oct 17: How to play (the rules) and Restart beside Quit (its own restart: the pad's ⟲ and R).
// Oct 17 (Miguel: "make it 10 crossings"): three more, made only of the rules the ferry already has (scratchpad
// lv/ferry/search.mjs + search2.mjs tried ~5,000 designs, SP/ferry/solve.mjs = these rules, BFS fewest trips): The Darkest
// Night (six on the lamp: 9 trips in 36 minutes, the least time there is (35 has no way); its slowest pair wants the
// two-quick-ones trick, the middle pair does not), Five and Four (cap 2, 15 trips) and The Ferryman's Dog (the dog rows
// too but chases the cat and the fox when the ferryman is away: 17 trips). lv/ferry/hintcheck.mjs replays the game's own
// H hint from the start of every crossing: the fewest trips each time, inside the lamp. The rule card now puts three or
// more 'eats' rules on one line and sits higher (on the market crossings it hid the left bank's pieces).
// def: { levels: [{ name, units[], cap, rowers?, eats?, guard?, outnumber?, lamp?, best }], pass, points }
(function () {
  const LEVELS = [
    { name: 'Fox, Hen and Rice', units: ['ferryman', 'fox', 'hen', 'rice'], cap: 2, rowers: ['ferryman'], eats: [['fox', 'hen'], ['hen', 'rice']], guard: 'ferryman', best: 7 },
    { name: 'The Night Crossing', units: ['t1', 't2', 't5', 't10'], cap: 2, lamp: 17, best: 5 },
    { name: 'Samurai and Ronin', units: ['samurai', 'samurai', 'samurai', 'ronin', 'ronin', 'ronin'], cap: 2, outnumber: ['ronin', 'samurai'], best: 11 },
    { name: 'The Ferry Market', units: ['ferryman', 'fox', 'hen', 'rice', 'cat', 'mouse'], cap: 3, rowers: ['ferryman'], eats: [['fox', 'hen'], ['hen', 'rice'], ['cat', 'mouse'], ['mouse', 'rice'], ['cat', 'hen']], guard: 'ferryman', best: 7 },
    { name: 'Four and Four', units: ['samurai', 'samurai', 'samurai', 'samurai', 'ronin', 'ronin', 'ronin', 'ronin'], cap: 3, outnumber: ['ronin', 'samurai'], best: 9 },
    { name: 'Five and Five', units: ['samurai', 'samurai', 'samurai', 'samurai', 'samurai', 'ronin', 'ronin', 'ronin', 'ronin', 'ronin'], cap: 3, outnumber: ['ronin', 'samurai'], best: 11 },
    { name: 'The Long Night', units: ['t1', 't3', 't6', 't8', 't12'], cap: 2, lamp: 29, best: 7 },
    { name: 'The Darkest Night', units: ['t1', 't3', 't4', 't7', 't9', 't13'], cap: 2, lamp: 36, best: 9 },
    { name: 'Five and Four', units: ['samurai', 'samurai', 'samurai', 'samurai', 'samurai', 'ronin', 'ronin', 'ronin', 'ronin'], cap: 2, outnumber: ['ronin', 'samurai'], best: 15 },
    { name: "The Ferryman's Dog", units: ['ferryman', 'fox', 'hen', 'rice', 'cat', 'mouse', 'dog'], cap: 2, rowers: ['ferryman', 'dog'], eats: [['fox', 'hen'], ['hen', 'rice'], ['cat', 'mouse'], ['dog', 'cat'], ['dog', 'fox']], guard: 'ferryman', best: 17 }
  ];
  const LOOK = { ferryman: '#3f6db5', fox: '#e0742a', hen: '#f4f1e6', rice: '#d9b56a', cat: '#8b8f98', mouse: '#b9b4ad', samurai: '#b3262b', ronin: '#26262b', dog: '#a8703f' };
  const NAMES = { ferryman: 'the ferryman', fox: 'the fox', hen: 'the hen', rice: 'the rice', cat: 'the cat', mouse: 'the mouse', samurai: 'samurai', ronin: 'ronin', dog: 'the dog' };
  const VERBS = { dog: ['chases', 'chased off'] }, verb = a => VERBS[a] || ['eats', 'ate']; // the rule card's word and the slip's
  const mins = u => /^t(\d+)$/.test(u) ? +u.slice(1) : 0;
  function bankBad(L, names) {
    if (L.eats && !(L.guard && names.includes(L.guard))) for (const [a, b] of L.eats) if (names.includes(a) && names.includes(b)) return `${NAMES[a][0].toUpperCase() + NAMES[a].slice(1)} ${verb(a)[1]} ${NAMES[b]}`;
    if (L.outnumber) { const [x, y] = L.outnumber, nx = names.filter(n => n === x).length, ny = names.filter(n => n === y).length; if (ny > 0 && nx > ny) return `The ${x} outnumbered the ${y}`; }
    return null;
  }
  // the next group of a shortest way across from (mask: right-bank bits, boat side, lamp minutes used), or null
  function nextGroup(L, m0, b0, t0) {
    const n = L.units.length, all = (1 << n) - 1, key = (m, b, t) => `${m},${b}` + (L.lamp ? `,${t}` : ''); const seen = new Set([key(m0, b0, t0)]); let fr = [{ m: m0, b: b0, t: t0, first: null }];
    while (fr.length) { const nx = [];
      for (const s of fr) { const here = [...Array(n).keys()].filter(i => ((s.m >> i) & 1) === s.b);
        for (let sub = 1; sub < (1 << here.length); sub++) { const g = here.filter((_, k) => (sub >> k) & 1); if (g.length > L.cap) continue; if (L.rowers && !g.some(i => L.rowers.includes(L.units[i]))) continue;
          let m = s.m; g.forEach(i => { m ^= 1 << i; }); const t = s.t + (L.lamp ? Math.max(...g.map(i => mins(L.units[i]))) : 0); if (L.lamp && t > L.lamp) continue;
          const side = v => [...Array(n).keys()].filter(i => ((m >> i) & 1) === v).map(i => L.units[i]); if (bankBad(L, side(0)) || bankBad(L, side(1))) continue;
          const k = key(m, 1 - s.b, t); if (seen.has(k)) continue; seen.add(k); const first = s.first || g; if (m === all) return first; nx.push({ m, b: 1 - s.b, t, first }); } }
      fr = nx; }
    return null;
  }
  const G = {
    title: 'The Canal Ferry',
    howTo: { lines: [
      "Get everyone across the canal in the little ferry; the card on the left lists this crossing's rules.",
      "Click a piece on the ferry's bank to put it aboard (click it again to let it off), then press Space or ⛵ Cross.",
      'Someone must row (on some crossings only the ferryman can) and the ferry holds only so many; a rule broken on either bank sends the ferry back.',
      'On the night crossings a trip takes as long as the slowest one aboard, and the lamp lasts only so long.',
      'U undoes a crossing, H puts a good next group aboard (no +10 then); the fewest trips earn +10.',
      'Tip: sometimes the way forward is to bring someone back.'] },
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const LV = def.levels || LEVELS, KEY = 'rebelAntsFerryProgress:' + (def.id || 'ferry');
      let solvedUpTo = 0; try { solvedUpTo = Math.max(0, Math.min(LV.length, Number(localStorage.getItem(KEY)) || 0)); } catch (e) {}
      const mat = (k, c, em, o = {}) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = B.Color3.FromHexString ? (typeof c === 'string' ? B.Color3.FromHexString(c) : new B.Color3(...c)) : new B.Color3(...c); m.specularColor = new B.Color3(.05, .05, .05); if (em) m.emissiveColor = new B.Color3(...em); if (o.alpha != null) m.alpha = o.alpha; return m; });
      const woodM = mat('wood', [.32, .2, .12], [.08, .05, .03]), grassM = mat('bank', [.36, .5, .26], [.08, .11, .05]), stoneM = mat('quay', [.55, .53, .5], [.12, .12, .11]), hullM = mat('hull', [.45, .28, .15], [.11, .07, .03]);
      const nodes = [], keep = n => { n.parent = n.parent || ctx.frame; ctx.add(n); nodes.push(n); if (n.isPickable !== undefined) n.isPickable = false; return n; };
      const TY = 1.0, RIVER = .95, BANKX = 2.05, DOCK = .3;
      // the diorama: a table, two grassy banks with stone quays, the canal between (moving ripples), the ferry
      const waterT = new B.DynamicTexture('ferryWaterT', { width: 128, height: 256 }, scene, true); { const g = waterT.getContext(); g.fillStyle = '#2d6f8f'; g.fillRect(0, 0, 128, 256); g.strokeStyle = 'rgba(200,235,255,.35)'; g.lineWidth = 3; for (let y = 8; y < 256; y += 22) { g.beginPath(); g.moveTo(10 + (y * 7) % 40, y); g.quadraticCurveTo(60, y - 7, 110 - (y * 3) % 30, y); g.stroke(); } waterT.wrapV = 1; waterT.update(); }
      const waterM = new B.StandardMaterial('ferryWaterMat', scene); waterM.diffuseTexture = waterT; waterM.emissiveColor = new B.Color3(.18, .26, .32); waterM.specularColor = new B.Color3(.3, .3, .3);
      { const top = keep(B.MeshBuilder.CreateBox('ferryTable', { width: BANKX * 2 + .5, height: .1, depth: 2.7 }, scene)); top.material = woodM; top.position.set(0, TY - .05, 0);
        for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const l = keep(B.MeshBuilder.CreateBox('ferryLeg', { width: .12, height: TY - .1, depth: .12 }, scene)); l.material = woodM; l.position.set(x * (BANKX + .1), (TY - .1) / 2, z * 1.2); }
        for (const s of [-1, 1]) { const bank = keep(B.MeshBuilder.CreateBox('ferryBank', { width: BANKX - RIVER / 2, height: .12, depth: 2.6 }, scene)); bank.material = grassM; bank.position.set(s * (RIVER / 2 + (BANKX - RIVER / 2) / 2), TY + .06, 0);
          const quay = keep(B.MeshBuilder.CreateBox('ferryQuay', { width: .1, height: .14, depth: 2.6 }, scene)); quay.material = stoneM; quay.position.set(s * (RIVER / 2 + .05), TY + .07, 0); }
        const w = keep(B.MeshBuilder.CreateGround('ferryWater', { width: RIVER, height: 2.6 }, scene)); w.material = waterM; w.position.set(0, TY + .02, 0); }
      const boat = keep(new B.TransformNode('ferryBoat', scene));
      { const hull = B.MeshBuilder.CreateBox('ferryHull', { width: .5, height: .1, depth: 1.05 }, scene); hull.material = hullM; hull.parent = boat; hull.position.y = .05; hull.isPickable = false; ctx.add(hull);
        for (const s of [-1, 1]) { const r = B.MeshBuilder.CreateBox('ferryRail', { width: .05, height: .1, depth: 1.05 }, scene); r.material = hullM; r.parent = boat; r.position.set(s * .25, .12, 0); r.isPickable = false; ctx.add(r); }
        const lamp = B.MeshBuilder.CreateSphere('ferryLamp', { diameter: .1, segments: 8 }, scene); lamp.material = mat('lamp', [1, .85, .45], [1, .7, .3]); lamp.parent = boat; lamp.position.set(0, .35, .48); lamp.isPickable = false; ctx.add(lamp);
        const pole = B.MeshBuilder.CreateCylinder('ferryLampPole', { height: .32, diameter: .02 }, scene); pole.material = hullM; pole.parent = boat; pole.position.set(0, .17, .48); pole.isPickable = false; ctx.add(pole); }
      // piece icons (a disc over each pawn): drawn once per kind
      const iconMat = kind => ctx.mat('icon_' + kind, nm => { const t = new B.DynamicTexture(nm + 'T', { width: 128, height: 128 }, scene, true), g = t.getContext(); g.clearRect(0, 0, 128, 128);
        const circ = (x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };
        circ(64, 64, 60, '#f5efe0'); g.strokeStyle = '#3a2a18'; g.lineWidth = 6; g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.stroke();
        const m = mins(kind);
        if (m) { circ(64, 64, 48, '#f2c14e'); g.fillStyle = '#2a1a08'; g.font = `bold ${m > 9 ? 54 : 64}px Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(m), 64, 68); }
        else if (kind === 'fox') { g.fillStyle = '#e0742a'; g.beginPath(); g.moveTo(24, 30); g.lineTo(46, 46); g.lineTo(82, 46); g.lineTo(104, 30); g.lineTo(96, 70); g.lineTo(64, 104); g.lineTo(32, 70); g.closePath(); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(44, 76); g.lineTo(64, 104); g.lineTo(84, 76); g.closePath(); g.fill(); circ(50, 62, 5, '#222'); circ(78, 62, 5, '#222'); }
        else if (kind === 'hen') { circ(64, 70, 32, '#ffffff'); g.fillStyle = '#d4312a'; g.beginPath(); g.arc(56, 36, 9, 0, Math.PI * 2); g.arc(68, 33, 9, 0, Math.PI * 2); g.fill(); g.fillStyle = '#f0b22a'; g.beginPath(); g.moveTo(92, 66); g.lineTo(108, 72); g.lineTo(92, 78); g.closePath(); g.fill(); circ(76, 62, 5, '#222'); }
        else if (kind === 'rice') { g.fillStyle = '#d9b56a'; g.beginPath(); g.moveTo(40, 42); g.lineTo(88, 42); g.lineTo(98, 100); g.lineTo(30, 100); g.closePath(); g.fill(); g.fillStyle = '#8a5a2a'; g.fillRect(44, 40, 40, 8); g.fillStyle = '#fff6dc'; for (let i = 0; i < 6; i++) circ(48 + i * 7, 32 - (i % 2) * 4, 4, '#fff6dc'); }
        else if (kind === 'cat') { g.fillStyle = '#8b8f98'; g.beginPath(); g.moveTo(30, 36); g.lineTo(50, 50); g.lineTo(78, 50); g.lineTo(98, 36); g.lineTo(98, 80); g.arc(64, 80, 34, 0, Math.PI); g.lineTo(30, 36); g.fill(); circ(52, 70, 6, '#cfe85a'); circ(76, 70, 6, '#cfe85a'); g.strokeStyle = '#333'; g.lineWidth = 2; for (const s of [-1, 1]) for (const d of [-6, 2]) { g.beginPath(); g.moveTo(64 + s * 8, 86); g.lineTo(64 + s * 34, 86 + d); g.stroke(); } }
        else if (kind === 'dog') { g.fillStyle = '#6b4226'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(64 + s * 30, 60, 13, 27, -s * .35, 0, Math.PI * 2); g.fill(); } circ(64, 64, 32, '#a8703f'); circ(64, 84, 17, '#ecd5ae'); circ(64, 76, 7, '#222'); circ(52, 58, 5, '#222'); circ(76, 58, 5, '#222'); g.fillStyle = '#e06a6a'; g.fillRect(60, 90, 8, 10); }
        else if (kind === 'mouse') { circ(40, 44, 18, '#b9b4ad'); circ(88, 44, 18, '#b9b4ad'); circ(40, 44, 9, '#f2b8b8'); circ(88, 44, 9, '#f2b8b8'); circ(64, 74, 30, '#b9b4ad'); circ(56, 70, 4, '#222'); circ(72, 70, 4, '#222'); circ(64, 86, 5, '#e88'); }
        else if (kind === 'samurai') { circ(64, 70, 34, '#b3262b'); g.fillStyle = '#e3b04b'; g.beginPath(); g.moveTo(36, 26); g.lineTo(64, 52); g.lineTo(92, 26); g.lineTo(86, 22); g.lineTo(64, 42); g.lineTo(42, 22); g.closePath(); g.fill(); g.fillStyle = '#2a1414'; g.fillRect(44, 66, 40, 8); }
        else if (kind === 'ronin') { circ(64, 68, 36, '#26262b'); g.fillStyle = '#c4242a'; g.beginPath(); g.ellipse(64, 72, 10, 13, 0, 0, Math.PI * 2); g.fill(); for (let i = 0; i < 4; i++) { g.fillRect(53 + i * 6.5, 50, 4.5, 16); } }
        else if (kind === 'ferryman') { circ(64, 76, 26, '#e8c9a0'); g.fillStyle = '#c9a25a'; g.beginPath(); g.moveTo(14, 64); g.lineTo(64, 22); g.lineTo(114, 64); g.closePath(); g.fill(); circ(56, 80, 4, '#222'); circ(72, 80, 4, '#222'); }
        t.hasAlpha = true; t.update(); const mm = new B.StandardMaterial(nm, scene); mm.diffuseTexture = t; mm.useAlphaFromDiffuseTexture = true; mm.emissiveColor = new B.Color3(.45, .45, .45); mm.specularColor = new B.Color3(0, 0, 0); mm.backFaceCulling = false; return mm; });
      let bd = null; // { k, L, n, side[] (0 left, 1 right, 2 aboard), boatSide, aboard[], time, trips, hist[], hints, slips }
      const st = { phase: 'pick', t: 0, anim: [], cross: null, wait: 0 };
      const slot = (i, side) => { const col = i % 3, row = Math.floor(i / 3), x = (RIVER / 2 + .3 + col * .42) * (side ? 1 : -1), z = (row - 1.5) * .55; return new V3(x, TY + .12, z); };
      const seatPos = (k, cap) => new V3(0, .1, (k - (cap - 1) / 2) * (cap > 2 ? .3 : .38));
      function pawn(kind, i) {
        const root = keep(new B.TransformNode('ferryPawn', scene)); const col = LOOK[kind] || '#c9a24a';
        const body = B.MeshBuilder.CreateCylinder('ferryPawnBody', { height: .26, diameterTop: .12, diameterBottom: .2, tessellation: 12 }, scene); body.material = mat('pawn_' + kind, col, null); body.parent = root; body.position.y = .13; body.isPickable = true; body.metadata = { ferryUnit: i }; ctx.add(body);
        const icon = B.MeshBuilder.CreateDisc('ferryPawnIcon', { radius: .14, tessellation: 20 }, scene); icon.material = iconMat(kind); icon.parent = root; icon.position.y = .45; icon.billboardMode = B.Mesh.BILLBOARDMODE_ALL; icon.isPickable = true; icon.metadata = { ferryUnit: i }; icon.scaling.y = -1; ctx.add(icon);
        return root;
      }
      function build(k) {
        if (bd) bd.pawns.forEach(p => { try { p.dispose(); } catch (e) {} });
        const L = LV[k]; bd = { k, L, n: L.units.length, side: L.units.map(() => 0), boatSide: 0, aboard: [], time: 0, trips: 0, hist: [], hints: 0, slips: 0, pawns: [] };
        bd.pawns = L.units.map((u, i) => { const p = pawn(u, i); p.position.copyFrom(slot(i, 0)); return p; });
        boat.position.set(-DOCK, TY + .02, 0); rulesCard(); info(); ctx.player.place(0, 2.1, Math.PI);
      }
      const info = () => { H.info(bd ? `Crossing ${bd.k + 1} / ${LV.length} · trips ${bd.trips} · fewest ${bd.L.best}${bd.hints ? ` · hints ${bd.hints}` : ''}` : 'Pick a crossing'); lampGauge(); };
      // the night crossings: a lamp gauge (Miguel: he ran out of lamp and could not tell why every trip slipped) with the
      // minutes left and what the trip on the ferry now would cost
      function lampGauge() {
        const L = bd?.L; if (!L?.lamp || st.phase === 'pick') { H.meter(null); return; }
        const left = L.lamp - bd.time, trip = bd.aboard.length ? Math.max(...bd.aboard.map(i => mins(L.units[i]))) : 0;
        H.meter({ label: `Lamp: ${left} of ${L.lamp} min left${trip ? ` · this trip ${trip} min${trip > left ? ' (too long!)' : ''}` : ''}`, fill: left / L.lamp, value: trip ? Math.max(0, left - trip) / L.lamp : null });
      }
      function moveTo(i, target) { st.anim.push({ p: bd.pawns[i], from: bd.pawns[i].position.clone(), to: target, t: 0 }); }
      function relayout() { // aboard pawns ride the boat; the rest stand in their places on their bank
        bd.aboard.forEach((i, k) => { const p = bd.pawns[i]; const s = seatPos(k, bd.L.cap); moveTo(i, new V3(boat.position.x + s.x, boat.position.y + s.y, s.z)); });
        bd.side.forEach((s, i) => { if (s !== 2) moveTo(i, slot(i, s)); });
      }
      function click(i) {
        if (st.phase !== 'play' || st.cross || !bd) return;
        if (bd.side[i] === 2) { bd.aboard = bd.aboard.filter(x => x !== i); bd.side[i] = bd.boatSide; relayout(); ctx.note(500, 'lantern'); lampGauge(); return; }
        if (bd.side[i] !== bd.boatSide) { H.msg('The ferry is on the other bank', 900); return; }
        if (bd.aboard.length >= bd.L.cap) { H.msg(`The ferry holds ${bd.L.cap}`, 900); return; }
        bd.aboard.push(i); bd.side[i] = 2; relayout(); ctx.note(700, 'lantern'); lampGauge();
      }
      function cross() {
        if (st.phase !== 'play' || st.cross || !bd) return false; const L = bd.L, names = bd.aboard.map(i => L.units[i]);
        if (!bd.aboard.length) { H.msg('Nobody aboard to row', 900); return false; }
        if (L.rowers && !names.some(n => L.rowers.includes(n))) { H.msg(`Only ${L.rowers.map(r => NAMES[r]).join(' or ')} can row`, 1200); return false; }
        bd.hist.push({ side: bd.side.slice(), boatSide: bd.boatSide, aboard: bd.aboard.slice(), time: bd.time, trips: bd.trips });
        const dt = L.lamp ? Math.max(...names.map(mins)) : 0; st.cross = { t: 0, from: boat.position.x, to: bd.boatSide ? -DOCK : DOCK, dt }; ctx.sound('splash'); return true;
      }
      function arrive() {
        const L = bd.L; bd.boatSide = 1 - bd.boatSide; bd.time += st.cross.dt; bd.trips++; st.cross = null;
        const onBank = s => bd.side.map((v, i) => v === s || (v === 2 && bd.boatSide === s) ? L.units[i] : null).filter(Boolean);
        const bad = bankBad(L, onBank(0)) || bankBad(L, onBank(1)) || (L.lamp && bd.time > L.lamp ? 'The lamp burnt out' : null);
        info();
        if (bad) { bd.slips++; st.phase = 'slip'; st.wait = 1.7; H.msg(bad, 1600, 'the ferry goes back'); ctx.sound('thock'); return; }
        if (L.lamp && !bd.side.every((v, i) => v === 1 || (v === 2 && bd.boatSide === 1))) {
          let m = 0; bd.side.forEach((v, i) => { if ((v === 2 ? bd.boatSide : v) === 1) m |= 1 << i; });
          if (!nextGroup(L, m, bd.boatSide, bd.time)) H.msg('Not enough lamp left to get everyone over', 2600, 'U undoes a crossing · R starts again');
        }
        if (bd.side.every((v, i) => v === 1 || (v === 2 && bd.boatSide === 1))) { st.phase = 'won'; st.wt = 0; ctx.sound('gamewin'); H.msg('Everyone is across', 1500, `${bd.trips} trips`); pads.style.display = 'none';
          if (bd.k + 1 > solvedUpTo) { solvedUpTo = bd.k + 1; try { localStorage.setItem(KEY, String(solvedUpTo)); } catch (e) {} } }
      }
      function undo(silent) { if (!bd?.hist.length || st.cross || (st.phase !== 'play' && st.phase !== 'slip')) return; const h = bd.hist.pop(); bd.side = h.side; bd.boatSide = h.boatSide; bd.aboard = h.aboard; bd.time = h.time; bd.trips = h.trips; boat.position.x = bd.boatSide ? DOCK : -DOCK; relayout(); info(); if (!silent) ctx.note(400, 'lantern'); }
      function hint() {
        if (st.phase !== 'play' || st.cross || !bd) return; let m = 0; bd.side.forEach((v, i) => { const r = v === 2 ? bd.boatSide : v; if (r) m |= 1 << i; });
        const g = nextGroup(bd.L, m, bd.boatSide, bd.time); if (!g) { H.msg('No way across from here', 1500, 'U undoes a crossing'); return; }
        bd.hints++; bd.aboard.forEach(i => { bd.side[i] = bd.boatSide; }); bd.aboard = g.slice(); g.forEach(i => { bd.side[i] = 2; }); relayout(); info(); H.msg('Send these', 1200);
      }
      const hud = document.getElementById('gameHud');
      const card = document.createElement('div');
      card.style.cssText = 'position:absolute;left:14px;top:66px;width:min(260px,46vw);display:none;background:rgba(14,18,12,.85);border:1px solid rgba(150,190,110,.55);border-radius:10px;padding:8px 10px;font:13px/1.45 system-ui,sans-serif;color:#eef6e4;pointer-events:none';
      function rulesCard() { const L = bd.L, r = [];
        if (L.eats && L.guard && L.eats.length > 2) { // many rules: one line, each eater named once (a line per rule hid the bank's pieces)
          const by = []; L.eats.forEach(([a, b]) => { const g = by.find(x => x.a === a); if (g) g.bs.push(NAMES[b]); else by.push({ a, bs: [NAMES[b]] }); });
          r.push(`When ${NAMES[L.guard]} is not there, ${by.map(g => `${NAMES[g.a]} ${verb(g.a)[0]} ${g.bs.join(' and ')}`).join(', ')}.`); }
        else if (L.eats) r.push(...L.eats.map(([a, b]) => `${NAMES[a][0].toUpperCase() + NAMES[a].slice(1)} ${verb(a)[0]} ${NAMES[b]}${L.guard ? ` unless ${NAMES[L.guard]} is there` : ''}.`));
        if (L.outnumber) r.push(`The ${L.outnumber[0]} must never outnumber the ${L.outnumber[1]} on a bank (the ferry counts with the bank it is at).`);
        if (L.lamp) r.push(`The lamp lasts ${L.lamp} minutes; a trip takes as long as the slowest aboard (the number is minutes).`);
        if (L.rowers) r.push(`Only ${L.rowers.map(x => NAMES[x]).join(' or ')} can row.`);
        r.push(`The ferry holds ${L.cap}.`);
        card.style.display = 'block'; card.innerHTML = `<div style="font:800 11px system-ui;letter-spacing:.12em;text-transform:uppercase;color:#b9e08a;margin-bottom:4px">${L.name}</div>` + r.map(x => `<div>• ${x}</div>`).join(''); }
      const pick = document.createElement('div');
      pick.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(' + (LV.length > 6 && innerWidth >= 600 ? 560 : 400) + 'px,92vw);background:rgba(12,18,10,.95);border:1px solid rgba(150,190,110,.6);border-radius:14px;padding:16px;text-align:center;pointer-events:auto;font:15px/1.4 system-ui,sans-serif;color:#eee';
      const drawPick = () => { pick.innerHTML = `<div style="font:800 13px/1.2 system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#b9e08a;margin-bottom:10px">The Canal Ferry</div><div style="margin-bottom:12px;color:#bbb">Get everyone across without breaking a rule.</div>`
        + `<div style="display:grid;grid-template-columns:repeat(${LV.length > 6 && innerWidth >= 600 ? 5 : 4},1fr);gap:8px">${LV.map((L, k) => { const open = k <= solvedUpTo, ok = k < solvedUpTo; return `<button type="button" data-k="${k}" ${open ? '' : 'disabled'} style="padding:8px 2px;border-radius:9px;border:1px solid ${open ? '#b9e08a' : '#444'};background:${ok ? 'rgba(185,224,138,.22)' : 'rgba(255,255,255,.04)'};color:${open ? '#fff' : '#666'};font:700 15px system-ui,sans-serif;cursor:${open ? 'pointer' : 'default'}">${open ? `${k + 1}<div style="font:11px system-ui;opacity:.75">${L.name}</div>` : '🔒'}${ok ? ' ✓' : ''}</button>`; }).join('')}</div>`;
        pick.querySelectorAll('button[data-k]').forEach(b => b.onclick = (e) => { e.stopPropagation(); b.blur(); choose(+b.dataset.k); }); };
      const pads = document.createElement('div');
      pads.style.cssText = 'position:absolute;bottom:62px;right:14px;display:none;gap:6px;pointer-events:auto';
      const padBtn = (t, fn, css = '') => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.style.cssText = `min-width:54px;height:42px;padding:0 12px;border-radius:9px;border:1px solid #8fbf6a;background:rgba(14,20,10,.88);color:#f0ffe4;font:700 15px system-ui;cursor:pointer;${css}`; b.onclick = (e) => { e.stopPropagation(); b.blur(); fn(); }; pads.appendChild(b); return b; };
      function restart() { if (!bd || st.cross || (st.phase !== 'play' && st.phase !== 'slip')) return; st.phase = 'play'; st.anim.length = 0; build(bd.k); H.msg('Start again', 900); }
      padBtn('⟲ Restart', restart); padBtn('↶ Undo', () => undo()); padBtn('Hint', hint); padBtn('⛵ Cross', cross, 'background:rgba(50,100,40,.9)');
      function choose(k) { if (st.phase !== 'pick' || k > solvedUpTo || k >= LV.length) return; pick.remove(); st.phase = 'play'; build(k); pads.style.display = 'flex'; H.msg(LV[k].name, 1200, `the fewest trips: ${LV[k].best}`); }
      hud.append(pick, pads, card); drawPick();
      const cam = [0, TY + 2.9, -3.3], at = [0, TY + .2, .15];
      ctx.player.place(0, 2.1, Math.PI); ctx.look(cam, at, def.fov || .8);
      H.title(def.title || 'The Canal Ferry'); H.score(''); info();
      H.hint('Click pieces on the ferry\'s bank to put them aboard (again to let them off). <kbd>Space</kbd> crosses, <kbd>U</kbd> undoes, <kbd>R</kbd> starts again, <kbd>H</kbd> hint.');
      const ease = u => u * u * (3 - 2 * u);
      return {
        update(dt) {
          ctx.look(cam, at); st.t += dt; waterT.vOffset = (waterT.vOffset + dt * .05) % 1; if (!bd) return;
          for (let k = st.anim.length - 1; k >= 0; k--) { const a = st.anim[k]; a.t += dt / .28; const u = Math.min(1, a.t), e = ease(u); a.p.position.copyFrom(V3.Lerp(a.from, a.to, e)); a.p.position.y += Math.sin(Math.PI * u) * .12; if (u >= 1) st.anim.splice(k, 1); }
          if (st.cross) { const c = st.cross; c.t += dt / 1.1; const u = Math.min(1, c.t), e = ease(u); boat.position.x = c.from + (c.to - c.from) * e; boat.rotation.z = Math.sin(st.t * 6) * .03;
            bd.aboard.forEach((i, k) => { const s = seatPos(k, bd.L.cap); bd.pawns[i].position.set(boat.position.x + s.x, boat.position.y + s.y, s.z); });
            if (u >= 1) { boat.rotation.z = 0; arrive(); } }
          if (st.phase === 'slip' && (st.wait -= dt) <= 0) { st.phase = 'play'; undo(true); }
          if (st.phase === 'won' && (st.wt += dt) > 1.8) { st.phase = 'done'; H.hint(''); const k = bd.k, bonus = bd.trips <= bd.L.best && !bd.hints && !bd.slips;
            ctx.finish({ score: (k + 1) * 20 + (bonus ? 10 : 0), label: 'points', solved: true, extra: `${bd.L.name}: across in ${bd.trips} trips (the fewest is ${bd.L.best})${bd.slips ? `, ${bd.slips} slip${bd.slips > 1 ? 's' : ''}` : ''}${bd.hints ? `, ${bd.hints} hint${bd.hints > 1 ? 's' : ''}` : ''}.${k + 1 < LV.length ? ` Crossing ${k + 2} is open.` : ' Every crossing made.'}` }); }
        },
        key(e, down) {
          if (!down || e.repeat) return; const k = e.key.toLowerCase();
          if (st.phase === 'pick') { const n = k === '0' ? 10 : parseInt(k, 10); if (n >= 1 && n <= LV.length) choose(n - 1); return; } // 1-9, 0 = the tenth
          if (k === ' ' || k === 'enter' || k === 'c') cross(); else if (k === 'u' || k === 'z' || k === 'backspace') undo(); else if (k === 'h') hint(); else if (k === 'r') restart();
          else if (/^[1-9]$/.test(k) && bd && +k <= bd.n) click(+k - 1);
        },
        pointer(evt) {
          if (evt.type !== B.PointerEventTypes.POINTERDOWN || st.phase !== 'play') return;
          const hit = scene.pickWithRay(ctx.ray(), m => m.metadata?.ferryUnit != null); if (hit?.pickedMesh) click(hit.pickedMesh.metadata.ferryUnit);
        },
        restart,
        _test: { st, choose, click, cross, undo, hint, restart, nextGroup, get bd() { return bd; }, LV, boat },
        dispose() { H.meter(null); pick.remove(); pads.remove(); card.remove(); if (bd) bd.pawns.forEach(p => { try { p.dispose(); } catch (e) {} }); nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); try { waterM.dispose(); waterT.dispose(); } catch (e) {} }
      };
    }
  };
  window.RebelGames.register('ferry', G);
})();
