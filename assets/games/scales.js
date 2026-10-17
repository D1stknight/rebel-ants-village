// The Temple Scales (Oct 15, Sohei): one coin in the offering is false. Put coins on the two pans (click a coin:
// table -> left pan -> right pan -> table; the pans must hold the same number), weigh (W), and when you know, name
// the false coin (N, then click it). The scales are honest but the coin is not: it is whichever coin your weighings
// have not yet ruled out, so only a sure answer wins. Seven offerings: a heavier coin among 3, 9, 8 and 27; then a
// coin that is heavier OR lighter among 4, 12 and 13, with two or three weighings. Score: the offering x 20 + 10.
// Oct 17: How to play (the rules + one weighing worked through, howto/scales.png) and Restart (the offering afresh:
// every coin back on the table, all weighings back).
// def: { levels: [{ n, w, mode: 'heavy' | 'either' }], pass, points }
(function () {
  const LEVELS = [
    { n: 3, w: 1, mode: 'heavy' }, { n: 9, w: 2, mode: 'heavy' }, { n: 8, w: 2, mode: 'heavy' }, { n: 27, w: 3, mode: 'heavy' },
    { n: 4, w: 2, mode: 'either' }, { n: 12, w: 3, mode: 'either' }, { n: 13, w: 3, mode: 'either' }
  ];
  const G = {
    title: 'The Temple Scales',
    howTo: { lines: [
      'One coin of the offering is false: heavier than the rest (from offering 5: heavier or lighter, you do not know which).',
      'Click a coin to move it: table, left pan, right pan, back to the table. Both pans must hold the same number of coins.',
      'Press W (or Weigh) to weigh: the heavier side sinks, and if the pans balance the false coin is not on them. You have only a few weighings.',
      'When only one coin can still be false, press N (or Name the coin) and click it.',
      'No lucky guesses: the false coin is always one your weighings have not ruled out, so name it only when you are sure.',
      'Tip: split the coins in three: left pan, right pan and table. Whatever the scales do, two of the three groups are ruled out.'],
      img: 'howto/scales.png', caption: 'Offering 2: 9 coins, one heavier, 2 weighings. Three against three, then one against one.' },
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const LV = def.levels || LEVELS, KEY = 'rebelAntsScalesProgress:' + (def.id || 'scales');
      let solvedUpTo = 0; try { solvedUpTo = Math.max(0, Math.min(LV.length, Number(localStorage.getItem(KEY)) || 0)); } catch (e) {}
      const mat = (k, c, em, o = {}) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(...(o.spec || [.1, .1, .1])); if (o.power) m.specularPower = o.power; if (em) m.emissiveColor = new B.Color3(...em); return m; });
      const woodM = mat('wood', [.3, .17, .1], [.07, .04, .02]), bronzeM = mat('bronze', [.62, .44, .2], [.16, .1, .04], { spec: [.6, .5, .3], power: 40 }), goldM = mat('gold', [.95, .74, .26], [.32, .22, .05], { spec: [.9, .8, .5], power: 60 });
      const selM = mat('picked', [1, .5, .3], [.6, .22, .1]), chainM = mat('chain', [.4, .32, .2], [.1, .08, .04]);
      const numMat = n => ctx.mat('num' + n, nm => { const m = new B.StandardMaterial(nm, scene); const t = new B.DynamicTexture(nm + 'T', { width: 128, height: 128 }, scene, true), g = t.getContext();
        g.clearRect(0, 0, 128, 128); g.save(); g.translate(0, 128); g.scale(1, -1); g.fillStyle = '#3a2208'; g.font = `bold ${n > 9 ? 70 : 84}px Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), 64, 66); g.restore(); t.hasAlpha = true; t.update(); // drawn upside down: a disc's texture runs top to bottom
        m.diffuseTexture = t; m.useAlphaFromDiffuseTexture = true; m.emissiveColor = new B.Color3(.25, .2, .1); m.specularColor = new B.Color3(0, 0, 0); return m; });
      const nodes = [], keep = n => { n.parent = n.parent || ctx.frame; ctx.add(n); nodes.push(n); if (n.isPickable !== undefined) n.isPickable = false; return n; };
      const TY = 1.0, BEAM_Y = TY + 1.7, ARM = 1.25, HANG = .95;
      // the table and the scales: a post, a beam that tips, two pans on chains
      { const top = keep(B.MeshBuilder.CreateBox('scTable', { width: 5.6, height: .1, depth: 2.5 }, scene)); top.material = woodM; top.position.set(0, TY - .05, .35);
        for (const [x, z] of [[-2.6, -.75], [2.6, -.75], [-2.6, 1.45], [2.6, 1.45]]) { const l = keep(B.MeshBuilder.CreateBox('scLeg', { width: .12, height: TY - .1, depth: .12 }, scene)); l.material = woodM; l.position.set(x, (TY - .1) / 2, z); }
        const post = keep(B.MeshBuilder.CreateCylinder('scPost', { height: 1.75, diameter: .12, tessellation: 12 }, scene)); post.material = bronzeM; post.position.set(0, TY + .875, .75);
        const foot = keep(B.MeshBuilder.CreateCylinder('scFoot', { height: .08, diameter: .6, tessellation: 18 }, scene)); foot.material = bronzeM; foot.position.set(0, TY + .04, .75); }
      const beam = keep(new B.TransformNode('scBeam', scene)); beam.position.set(0, BEAM_Y, .75);
      { const b = B.MeshBuilder.CreateBox('scBeamBar', { width: ARM * 2 + .2, height: .08, depth: .08 }, scene); b.material = bronzeM; b.parent = beam; b.isPickable = false; ctx.add(b);
        const n = B.MeshBuilder.CreateCylinder('scNeedle', { height: .45, diameterTop: .01, diameterBottom: .06, tessellation: 8 }, scene); n.material = bronzeM; n.parent = beam; n.position.y = .26; n.isPickable = false; ctx.add(n); }
      const pans = [-1, 1].map(s => { const p = keep(new B.TransformNode('scPan', scene)); const d = B.MeshBuilder.CreateCylinder('scPanDish', { height: .06, diameterTop: 1.05, diameterBottom: .8, tessellation: 24 }, scene); d.material = bronzeM; d.parent = p; d.isPickable = true; d.metadata = { scPan: s }; ctx.add(d);
        // three chains from the dish rim up to the beam end (fixed in the pan's frame: the pan always hangs straight)
        const chains = [0, 1, 2].map(k => { const c = B.MeshBuilder.CreateCylinder('scChain', { height: 1, diameter: .025, tessellation: 5 }, scene); c.material = chainM; c.parent = p; c.isPickable = false; ctx.add(c);
          const a = k * 2 * Math.PI / 3 + .5, ax = Math.cos(a) * .42, az = Math.sin(a) * .42, d = new V3(-ax, HANG, -az), len = d.length(); d.scaleInPlace(1 / len);
          c.rotationQuaternion = new B.Quaternion(); B.Quaternion.FromUnitVectorsToRef(V3.Up(), d, c.rotationQuaternion); c.scaling.y = len; c.position.set(ax / 2, HANG / 2, az / 2); return { c }; });
        return { s, p, chains }; });
      const st = { phase: 'pick', tilt: 0, tiltTo: 0, tv: 0, t: 0, naming: false };
      let bd = null; // { k, n, w, mode, coins: [{ i, node, where: 0 table | -1 left | 1 right }], hyp: [[coin, sign]], used, log[] }
      function placePans() {
        // tilt > 0: the left pan sinks (the beam turns about the post; each pan hangs below its end)
        pans.forEach(P => { const ex = P.s * ARM * Math.cos(st.tilt), ey = BEAM_Y + P.s * ARM * Math.sin(st.tilt); P.p.position.set(ex, ey - HANG, .75); });
        beam.rotation.z = st.tilt;
      }
      const tablePos = (i, n) => { const cols = n > 14 ? 9 : n > 6 ? Math.ceil(n / 2) : n, r = Math.floor(i / cols), c = i % cols, cnt = Math.min(cols, n - r * cols); return new V3((c - (cnt - 1) / 2) * .46, TY + .04, .02 - r * .4); };
      const panPos = (k, cnt) => { const cols = cnt > 9 ? 4 : cnt > 4 ? 3 : 2, r = Math.floor(k / cols), c = k % cols, rows = Math.ceil(cnt / cols), cr = Math.min(cols, cnt - r * cols); return new V3((c - (cr - 1) / 2) * .25, .07, (r - (rows - 1) / 2) * .25); };
      function layoutCoins() {
        const L = bd.coins.filter(c => c.where === -1), R = bd.coins.filter(c => c.where === 1);
        st.tiltTo = L.length > R.length ? .12 : R.length > L.length ? -.12 : 0; // until weighed, the pans only show which holds more coins
        bd.coins.forEach(c => { if (c.where === 0) { c.node.parent = ctx.frame; c.target = tablePos(c.i, bd.n); c.node.scaling.setAll(1); }
          else { const list = c.where === -1 ? L : R, k = list.indexOf(c); c.node.parent = pans[c.where === -1 ? 0 : 1].p; c.target = panPos(k, list.length); c.node.scaling.setAll(.86); }
          c.node.position.copyFrom(c.target); });
      }
      function build(k) {
        if (bd) bd.coins.forEach(c => { try { c.node.dispose(); } catch (e) {} });
        const L = LV[k]; st.tilt = 0; st.tiltTo = 0; st.tv = 0; st.naming = false; placePans();
        bd = { k, n: L.n, w: L.w, mode: L.mode, coins: [], used: 0, log: [], hyp: [] };
        for (let i = 0; i < L.n; i++) { bd.hyp.push([i, 1]); if (L.mode === 'either') bd.hyp.push([i, -1]); }
        for (let i = 0; i < L.n; i++) { const node = keep(new B.TransformNode('scCoin', scene)); const body = B.MeshBuilder.CreateCylinder('scCoinBody', { height: .07, diameter: .3, tessellation: 18 }, scene); body.material = goldM; body.parent = node; body.isPickable = true; body.metadata = { scCoin: i }; ctx.add(body);
          const face = B.MeshBuilder.CreateDisc('scCoinNum', { radius: .13, tessellation: 18 }, scene); face.material = numMat(i + 1); face.parent = node; face.rotation.x = Math.PI / 2; face.position.y = .037; face.isPickable = false; ctx.add(face);
          bd.coins.push({ i, node, body, where: 0 }); }
        layoutCoins(); ctx.player.place(0, 2.15, Math.PI); drawLog(); info();
      }
      const info = () => H.info(bd ? `Offering ${bd.k + 1} / ${LV.length} · ${bd.n} coins, one ${bd.mode === 'heavy' ? 'heavier' : 'heavier or lighter'} · weighings left ${bd.w - bd.used}${st.naming ? ' · name the coin' : ''}` : 'Pick an offering');
      function cycle(i) { if (st.phase !== 'play' || st.anim) return; const c = bd.coins[i]; if (st.naming) { name(i); return; } c.where = c.where === 0 ? -1 : c.where === -1 ? 1 : 0; layoutCoins(); ctx.note(c.where ? 880 : 520, 'bell'); }
      function clearPans() { if (st.phase !== 'play' || st.anim) return; bd.coins.forEach(c => { c.where = 0; }); layoutCoins(); st.tiltTo = 0; }
      function weigh() {
        if (st.phase !== 'play' || st.anim) return false; const L = bd.coins.filter(c => c.where === -1).map(c => c.i), R = bd.coins.filter(c => c.where === 1).map(c => c.i);
        if (bd.used >= bd.w) { H.msg('No weighings left', 1200, 'name the coin (N)'); return false; }
        if (!L.length || L.length !== R.length) { H.msg('Put the same number of coins on each pan', 1300); return false; }
        // the coin is whatever the weighings so far allow: the scales tip the way that leaves the most coins possible
        const out = h => { const [c, s] = h; return L.includes(c) ? (s > 0 ? 'left' : 'right') : R.includes(c) ? (s > 0 ? 'right' : 'left') : 'even'; };
        const groups = { left: [], right: [], even: [] }; bd.hyp.forEach(h => groups[out(h)].push(h));
        const coinsIn = g => new Set(g.map(h => h[0])).size, order = ['even', 'left', 'right'].sort(() => Math.random() - .5);
        let pickK = order[0]; for (const kk of order) if (groups[kk].length > groups[pickK].length || (groups[kk].length === groups[pickK].length && coinsIn(groups[kk]) > coinsIn(groups[pickK]))) pickK = kk;
        bd.hyp = groups[pickK]; bd.used++;
        bd.log.push({ L: L.map(i => i + 1), R: R.map(i => i + 1), r: pickK }); st.tiltTo = pickK === 'left' ? .26 : pickK === 'right' ? -.26 : 0; st.tv = 0; st.anim = { t: 0 };
        ctx.sound('thock'); H.msg(pickK === 'even' ? 'The pans balance' : pickK === 'left' ? 'The left pan sinks' : 'The right pan sinks', 1400); drawLog(); info(); return true;
      }
      function name(i) {
        if (st.phase !== 'play' || st.anim) return; st.naming = false; info();
        const coins = new Set(bd.hyp.map(h => h[0])), sure = coins.size === 1 && coins.has(i);
        let truth; if (sure) truth = bd.hyp[0]; else { const other = bd.hyp.filter(h => h[0] !== i); truth = other[Math.floor(Math.random() * other.length)] || bd.hyp[0]; }
        st.truth = truth; st.named = i; st.phase = 'reveal'; st.rt = 0; const c = bd.coins[truth[0]]; c.body.material = selM;
        if (sure) { ctx.sound('gamewin'); H.msg(`Coin ${i + 1} it is`, 1600, bd.mode === 'either' ? (truth[1] > 0 ? 'heavier' : 'lighter') : ''); if (bd.k + 1 > solvedUpTo) { solvedUpTo = bd.k + 1; try { localStorage.setItem(KEY, String(solvedUpTo)); } catch (e) {} } }
        else { ctx.sound('thock'); H.msg(`It was coin ${truth[0] + 1}`, 1800, coins.size > 1 ? `${coins.size} coins were still possible` : ''); }
        pads.style.display = 'none';
      }
      const hud = document.getElementById('gameHud');
      const logEl = document.createElement('div');
      logEl.style.cssText = 'position:absolute;left:14px;top:132px;width:min(250px,44vw);display:none;background:rgba(24,14,6,.82);border:1px solid rgba(210,150,60,.55);border-radius:10px;padding:8px 10px;font:13px/1.45 system-ui,sans-serif;color:#f6e7cf;pointer-events:none';
      function drawLog() { if (!bd) return; logEl.style.display = 'block'; logEl.innerHTML = `<div style="font:800 11px system-ui;letter-spacing:.12em;text-transform:uppercase;color:#e7b56a;margin-bottom:4px">Weighings</div>` + (bd.log.length ? bd.log.map((l, k) => `<div>${k + 1}. ${l.L.join(' ')} <b style="color:#e7b56a">${l.r === 'even' ? '=' : l.r === 'left' ? '&gt;' : '&lt;'}</b> ${l.R.join(' ')}</div>`).join('') : '<div style="opacity:.7">none yet</div>') + `<div style="opacity:.7;margin-top:4px">${bd.w - bd.used} left</div>`; }
      const pick = document.createElement('div');
      pick.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(400px,90vw);background:rgba(24,14,6,.95);border:1px solid rgba(210,150,60,.6);border-radius:14px;padding:16px;text-align:center;pointer-events:auto;font:15px/1.4 system-ui,sans-serif;color:#eee';
      const drawPick = () => { pick.innerHTML = `<div style="font:800 13px/1.2 system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#e7b56a;margin-bottom:10px">The Temple Scales</div><div style="margin-bottom:12px;color:#bbb">Find the false coin with the weighings you have.</div>`
        + `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">${LV.map((L, k) => { const open = k <= solvedUpTo, ok = k < solvedUpTo; return `<button type="button" data-k="${k}" ${open ? '' : 'disabled'} style="padding:8px 2px;border-radius:9px;border:1px solid ${open ? '#e7b56a' : '#444'};background:${ok ? 'rgba(231,181,106,.22)' : 'rgba(255,255,255,.04)'};color:${open ? '#fff' : '#666'};font:700 15px system-ui,sans-serif;cursor:${open ? 'pointer' : 'default'}">${open ? `${k + 1}<div style="font:11px system-ui;opacity:.75">${L.n} coins ${L.mode === 'heavy' ? '↓' : '↕'} · ${L.w}</div>` : '🔒'}${ok ? ' ✓' : ''}</button>`; }).join('')}</div><div style="margin-top:10px;font-size:12px;color:#aaa">↓ heavier · ↕ heavier or lighter · the last number is the weighings</div>`;
        pick.querySelectorAll('button[data-k]').forEach(b => b.onclick = (e) => { e.stopPropagation(); b.blur(); choose(+b.dataset.k); }); };
      const pads = document.createElement('div');
      pads.style.cssText = 'position:absolute;bottom:62px;right:14px;display:none;gap:6px;pointer-events:auto';
      const padBtn = (t, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.style.cssText = 'min-width:56px;height:40px;padding:0 10px;border-radius:9px;border:1px solid #c98f3e;background:rgba(26,16,6,.88);color:#fff1da;font:700 15px system-ui;cursor:pointer'; b.onclick = (e) => { e.stopPropagation(); b.blur(); fn(); }; pads.appendChild(b); return b; };
      padBtn('⚖ Weigh', weigh); padBtn('Clear pans', clearPans); const nameBtn = padBtn('Name the coin', () => toggleName());
      function toggleName() { if (st.phase !== 'play') return; st.naming = !st.naming; nameBtn.style.background = st.naming ? 'rgba(200,120,50,.8)' : 'rgba(26,16,6,.88)'; info(); if (st.naming) H.msg('Click the false coin', 1000); }
      function choose(k) { if (st.phase !== 'pick' || k > solvedUpTo || k >= LV.length) return; pick.remove(); st.phase = 'play'; build(k); pads.style.display = 'flex'; nameBtn.style.background = 'rgba(26,16,6,.88)'; const L = LV[k]; H.msg(`${L.n} coins`, 1300, `one is ${L.mode === 'heavy' ? 'heavier' : 'heavier or lighter'}: ${L.w} weighing${L.w > 1 ? 's' : ''}`); }
      hud.append(pick, pads, logEl); drawPick(); placePans();
      const cam = [0, TY + 2.75, -3.9], at = [0, TY + .55, .35];
      ctx.player.place(0, 2.15, Math.PI); ctx.look(cam, at, def.fov || .85);
      H.title(def.title || 'The Temple Scales'); H.score(''); info();
      H.hint('Click a coin to move it: table, left pan, right pan. <kbd>W</kbd> weigh, <kbd>C</kbd> clear the pans, <kbd>N</kbd> then a coin to name the false one.');
      return {
        update(dt) {
          ctx.look(cam, at); st.t += dt;
          // the beam swings to its new tilt like a real balance: a spring with damping
          const acc = (st.tiltTo - st.tilt) * 30 - st.tv * 5.5; st.tv += acc * dt; st.tilt += st.tv * dt; placePans();
          if (st.anim && (st.anim.t += dt) > 1.1) st.anim = null;
          if (st.phase === 'reveal') { st.rt += dt; const c = bd.coins[st.truth[0]]; c.node.position.y = c.target.y + Math.abs(Math.sin(st.rt * 5)) * .25;
            if (st.rt > 2.2) { st.phase = 'done'; H.hint(''); const won = st.named === st.truth[0], k = bd.k, coins = new Set(bd.hyp.map(h => h[0])).size;
              ctx.finish(won ? { score: (k + 1) * 20 + 10, label: 'points', solved: true, extra: `Offering ${k + 1}: coin ${st.named + 1} found${bd.mode === 'either' ? ` (${st.truth[1] > 0 ? 'heavier' : 'lighter'})` : ''} with ${bd.used} weighing${bd.used === 1 ? '' : 's'}.${k + 1 < LV.length ? ` Offering ${k + 2} is open.` : ' Every offering tested.'}` }
                : { score: 0, label: 'points', passed: false, solved: false, extra: `It was coin ${st.truth[0] + 1}${bd.mode === 'either' ? ` (${st.truth[1] > 0 ? 'heavier' : 'lighter'})` : ''}: ${coins > 1 ? `${coins} coins were still possible when you named one` : 'the weighings had found it'}.` }); } }
        },
        key(e, down) {
          if (!down || e.repeat) return; const k = e.key.toLowerCase();
          if (st.phase === 'pick') { const n = k === '0' ? 10 : parseInt(k, 10); if (n >= 1 && n <= LV.length) choose(n - 1); return; } // 1-9, 0 = the tenth
          if (k === 'w' || k === 'enter') weigh(); else if (k === 'c') clearPans(); else if (k === 'n') toggleName();
        },
        pointer(evt) {
          if (evt.type !== B.PointerEventTypes.POINTERDOWN || st.phase !== 'play') return;
          const hit = scene.pickWithRay(ctx.ray(), m => m.metadata?.scCoin != null); if (hit?.pickedMesh) cycle(hit.pickedMesh.metadata.scCoin);
        },
        // Restart: the same offering afresh (every coin on the table, no weighings used); not once a coin is named
        restart() { if (st.phase !== 'play' || !bd) return; st.anim = null; build(bd.k); nameBtn.style.background = 'rgba(26,16,6,.88)'; info(); H.msg('Start again', 900); },
        _test: { st, choose, cycle, weigh, name, clearPans, toggleName, get bd() { return bd; }, LV, setPans(L, R) { bd.coins.forEach(c => { c.where = L.includes(c.i) ? -1 : R.includes(c.i) ? 1 : 0; }); layoutCoins(); } },
        dispose() { pick.remove(); pads.remove(); logEl.remove(); if (bd) bd.coins.forEach(c => { try { c.node.dispose(); } catch (e) {} }); nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); }
      };
    }
  };
  window.RebelGames.register('scales', G);
})();
