// Emblem Match (Oct 15, Hub courtyard): stone tablets laid face down, two of each carved with the same faction
// emblem. Turn two at a time: a pair stays face up, two that differ turn back. Find every pair. Levels: 4 x 3, 4 x 4,
// 5 x 4, 6 x 5 (the same emblems in two colourings), 6 x 6 with at most 22 misses. Click a tablet (or move the ring
// with the arrows and press Space).
// def: { at: [x, z] (the board's middle, frame coordinates), gap: tablet spacing (m), player: [x, z, yaw], cam, look, levels, pass, points }
(function () {
  const LEVELS = [{ c: 4, r: 3 }, { c: 4, r: 4 }, { c: 5, r: 4 }, { c: 6, r: 5 }, { c: 6, r: 6, misses: 22 }];
  const SCORE = [20, 30, 45, 65, 90];
  // faction cloth / emblem colours (as the kit's banners)
  const F = { samurai: ['#961816', '#ecd6aa'], wokou: ['#1c2a4c', '#d9a743'], yamabushi: ['#25402d', '#d6a640'], ronin: ['#6a1a1d', '#e3cfa4'],
    shogun: ['#5f1d45', '#d8b04a'], bushi: ['#7d2b22', '#d9b35a'], buke: ['#5e1a20', '#d8b35c'], ashigaru: ['#8c1c1c', '#d8b45a'],
    kenshi: ['#1f5753', '#d8b450'], sohei: ['#c38d2a', '#f8edd2'], warrior: ['#34502e', '#dcb24e'] };
  const IDS = Object.keys(F);
  // kinds: 0-10 the emblem in its gold on the faction's cloth, 11-21 the same emblem in the cloth colour on cream
  const KINDS = [...IDS.map(id => ({ id, bg: F[id][0], fg: F[id][1] })), ...IDS.map(id => ({ id, bg: '#efe6cf', fg: F[id][0], ring: F[id][0] }))];
  const imgs = {};
  function emblem(id, cb) {
    let L = imgs[id];
    if (!L) { L = imgs[id] = { img: new Image(), ready: false, wait: [] }; L.img.onload = () => { L.ready = true; L.wait.splice(0).forEach(f => f(L.img)); }; L.img.src = 'assets/brand/factions/' + id + '.png'; }
    if (L.ready) cb(L.img); else L.wait.push(cb);
  }
  const G = {
    title: 'Emblem Match',
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const LV = def.levels || LEVELS, AT = def.at || [0, 0], GAP = def.gap || 1.05;
      const KEY = 'rebelAntsMatchProgress:' + (def.id || 'memory');
      let solvedUpTo = 0; try { solvedUpTo = Math.max(0, Math.min(LV.length, Number(localStorage.getItem(KEY)) || 0)); } catch (e) {}
      const mat = (k, c, em, spec = .1) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(spec, spec, spec); if (em) m.emissiveColor = new B.Color3(...em); return m; });
      const M = { stone: mat('stone', [.46, .45, .43], [.06, .06, .06], .15), base: mat('base', [.3, .21, .13], [.04, .03, .02]), cursor: mat('cursor', [1, .85, .35], [.9, .7, .2]), glow: mat('glow', [1, .85, .4], [.75, .55, .15]) };
      M.cursor.disableLighting = true;
      // the back of every tablet: a carved ring (one texture)
      const backTex = new B.DynamicTexture('emBackTex', { width: 128, height: 128 }, scene, true); { const g = backTex.getContext(); g.fillStyle = '#6c6a66'; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#4e4c49'; g.lineWidth = 7; g.beginPath(); g.arc(64, 64, 40, 0, Math.PI * 2); g.stroke(); g.lineWidth = 3; g.beginPath(); g.arc(64, 64, 22, 0, Math.PI * 2); g.stroke(); backTex.update(); }
      const backM = ctx.mat('back', n => { const m = new B.StandardMaterial(n, scene); m.diffuseTexture = backTex; m.specularColor = new B.Color3(.08, .08, .08); m.emissiveColor = new B.Color3(.12, .12, .12); return m; });
      const own = []; // textures / materials made per game
      function faceMat(k) {
        const K = KINDS[k], t = new B.DynamicTexture('emFaceTex' + k, { width: 256, height: 256 }, scene, true), g = t.getContext();
        const draw = img => { g.fillStyle = K.bg; g.fillRect(0, 0, 256, 256); g.strokeStyle = K.ring || K.fg; g.lineWidth = 12; g.strokeRect(10, 10, 236, 236);
          if (img) { const c = document.createElement('canvas'); c.width = c.height = 200; const x = c.getContext('2d'); x.drawImage(img, 0, 0, 200, 200); x.globalCompositeOperation = 'source-in'; x.fillStyle = K.fg; x.fillRect(0, 0, 200, 200); g.drawImage(c, 28, 28); }
          t.update(); };
        draw(null); emblem(K.id, draw);
        const m = new B.StandardMaterial('emFaceMat' + k + '_' + Math.random().toString(36).slice(2, 6), scene); m.diffuseTexture = t; m.specularColor = new B.Color3(.1, .1, .1); m.emissiveColor = new B.Color3(.32, .32, .32);
        own.push(t, m); return m;
      }
      let bd = null; // { k, c, r, cards: [{ root, kind, state: 'down'|'up'|'done', flip: { t, to } }], nodes, turns, misses, open: [] }
      const st = { phase: 'pick', cr: 0, cc: 0, wait: 0 };
      const cellPos = (r, c) => new V3(AT[0] + (c - (bd.c - 1) / 2) * GAP, 0, AT[1] + ((bd.r - 1) / 2 - r) * GAP);
      function build(k) {
        if (bd) bd.nodes.forEach(n => { try { n.dispose(); } catch (e) {} });
        const L = LV[k], n = L.c * L.r, pairs = n / 2;
        // the kinds: different factions first, both colourings past 11 pairs; dealt at random
        const kinds = []; for (let i = 0; i < pairs; i++) kinds.push(i < 11 ? i : 11 + (i - 11) * 2 % 11);
        const deck = []; kinds.forEach(q => deck.push(q, q)); for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
        bd = { k, c: L.c, r: L.r, cards: [], nodes: [], turns: 0, misses: 0, open: [], limit: L.misses || 0, mats: {} };
        const add = n => { n.parent = ctx.frame; ctx.add(n); bd.nodes.push(n); return n; };
        const base = add(B.MeshBuilder.CreateBox('emBase', { width: L.c * GAP + .5, height: .06, depth: L.r * GAP + .5 }, scene)); base.material = M.base; base.position.set(AT[0], .03, AT[1]); base.isPickable = false;
        let body0 = null, back0 = null; const front0 = {};
        deck.forEach((q, i) => {
          const r = Math.floor(i / L.c), c = i % L.c, root = add(new B.TransformNode('emCard', scene)); root.position.copyFrom(cellPos(r, c)); root.position.y = .11;
          const body = body0 ? body0.createInstance('emBodyI') : (body0 = B.MeshBuilder.CreateBox('emBody', { width: GAP * .84, height: .1, depth: GAP * .84 }, scene)); body.parent = root; if (body === body0) body.material = M.stone;
          body.isPickable = true; body.metadata = { emCard: i }; ctx.add(body);
          const back = back0 ? back0.createInstance('emBackI') : (back0 = B.MeshBuilder.CreatePlane('emBack', { size: GAP * .72 }, scene)); back.parent = root; back.position.y = .051; back.rotation.x = Math.PI / 2; if (back === back0) back.material = backM; back.isPickable = false; ctx.add(back);
          const front = front0[q] ? front0[q].createInstance('emFrontI') : (front0[q] = B.MeshBuilder.CreatePlane('emFront', { size: GAP * .72 }, scene)); front.parent = root; front.position.y = -.051; front.rotation.x = -Math.PI / 2;
          if (front === front0[q]) front.material = faceMat(q); front.isPickable = false; ctx.add(front);
          bd.cards.push({ root, kind: q, state: 'down', flip: null, i });
        });
        // the instance sources go last, so they are disposed after their instances
        bd.nodes.push(body0, back0, ...Object.values(front0));
        st.cursor = add(B.MeshBuilder.CreateTorus('emCursor', { diameter: GAP * .95, thickness: .04, tessellation: 28 }, scene)); st.cursor.material = M.cursor; st.cursor.isPickable = false;
        st.cr = 0; st.cc = 0; info();
      }
      const found = () => bd.cards.filter(c => c.state === 'done').length / 2;
      const info = () => { if (!bd || st.phase === 'pick') { H.info('Pick a level'); H.score(''); return; }
        H.info(`Level ${bd.k + 1} / ${LV.length} · pairs ${found()} / ${bd.cards.length / 2}`); H.score(bd.limit ? `misses ${bd.misses} / ${bd.limit}` : `${bd.misses} misses`); };
      const turn = (card, up) => { card.flip = { t: 0, from: card.root.rotation.z, to: up ? Math.PI : 0 }; };
      function flip(i) {
        if (st.phase !== 'play' || st.wait > 0) return;
        const card = bd.cards[i]; if (!card || card.state !== 'down') return;
        st.cr = Math.floor(i / bd.c); st.cc = i % bd.c;
        card.state = 'up'; turn(card, true); bd.open.push(card); ctx.note(440 + bd.open.length * 110, 'bell');
        if (bd.open.length < 2) return;
        bd.turns++;
        const [a, b] = bd.open;
        if (a.kind === b.kind) { st.wait = .45; st.match = true; } else { st.wait = .95; st.match = false; }
      }
      function settle() {
        const [a, b] = bd.open; bd.open = [];
        if (st.match) { a.state = b.state = 'done'; ctx.sound('wish');
          if (found() === bd.cards.length / 2) { st.phase = 'won'; st.wait2 = 1.6; ctx.sound('gamewin'); H.msg('Every pair found!', 1500, `${bd.misses} misses`);
            if (bd.k + 1 > solvedUpTo) { solvedUpTo = bd.k + 1; try { localStorage.setItem(KEY, String(solvedUpTo)); } catch (e) {} } } }
        else { a.state = b.state = 'down'; turn(a, false); turn(b, false); bd.misses++; ctx.sound('thock');
          if (bd.limit && bd.misses > bd.limit) { st.phase = 'lost'; st.wait2 = 1.6; H.msg('Too many misses', 1500, `the limit is ${bd.limit}`); } }
        info();
      }
      // the level picker
      const hud = document.getElementById('gameHud'), pick = document.createElement('div');
      pick.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(400px,90vw);background:rgba(12,16,30,.94);border:1px solid rgba(216,179,92,.7);border-radius:14px;padding:16px;text-align:center;pointer-events:auto;font:15px/1.4 Georgia,serif;color:#eee';
      const label = L => `${L.c} × ${L.r}${L.misses ? ` · ${L.misses} misses at most` : ''}`;
      pick.innerHTML = `<div style="font:700 13px/1.2 Georgia,serif;letter-spacing:.14em;text-transform:uppercase;color:#d8b35c;margin-bottom:10px">Emblem Match</div><div style="margin-bottom:12px;color:#bbb">Turn two tablets at a time. The same emblem twice stays face up. Find every pair.</div>`
        + `<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px">${LV.map((L, k) => { const open = k <= solvedUpTo, done = k < solvedUpTo; return `<button type="button" data-k="${k}" ${open ? '' : 'disabled'} style="padding:10px 4px;border-radius:9px;border:1px solid ${open ? '#d8b35c' : '#444'};background:${done ? 'rgba(216,179,92,.22)' : 'rgba(255,255,255,.04)'};color:${open ? '#fff' : '#666'};font:700 15px Georgia,serif;cursor:${open ? 'pointer' : 'default'}">${open ? 'Level ' + (k + 1) : '🔒'}${done ? ' ✓' : ''}${open ? `<div style="font:12px Georgia,serif;color:#c9b88a">${label(L)}</div>` : ''}</button>`; }).join('')}</div>`;
      pick.querySelectorAll('button[data-k]').forEach(b => b.onclick = (e) => { e.stopPropagation(); b.blur(); choose(+b.dataset.k); });
      function choose(k) { if (st.phase !== 'pick' || k > solvedUpTo || k >= LV.length) return; pick.remove(); st.phase = 'play'; build(k); H.msg(`Level ${k + 1}`, 900, label(LV[k])); }
      hud.appendChild(pick);
      const P = def.player || [AT[0] - 4.4, AT[1] - 3.2, Math.PI / 4]; ctx.player.place(P[0], P[1], P[2]);
      const cam = def.cam || [AT[0] + .4, 7.6, AT[1] - 5.6], at = def.look || [AT[0], 0, AT[1] + .3];
      ctx.look(cam, at, def.fov || .85);
      H.title(def.title || 'Emblem Match'); H.score(''); info();
      H.hint('Click a tablet to turn it (or move the ring with the arrows and press <kbd>Space</kbd>). Two alike stay up.');
      return {
        update(dt) {
          ctx.look(cam, at);
          if (bd) for (const c of bd.cards) if (c.flip) { const f = c.flip; f.t = Math.min(1, f.t + dt / .28); const e = f.t * f.t * (3 - 2 * f.t);
            c.root.rotation.z = f.from + (f.to - f.from) * e; c.root.position.y = .11 + Math.sin(Math.PI * f.t) * .35; if (f.t >= 1) c.flip = null; }
          if (bd && st.cursor) { const p = cellPos(st.cr, st.cc); st.cursor.position.set(p.x, .2, p.z); st.cursor.setEnabled(st.phase === 'play'); }
          if (st.phase === 'play' && st.wait > 0 && (st.wait -= dt) <= 0) { st.wait = 0; settle(); }
          if ((st.phase === 'won' || st.phase === 'lost') && (st.wait2 -= dt) <= 0) {
            const won = st.phase === 'won'; st.phase = 'done'; H.hint('');
            const k = bd.k, base = SCORE[k] ?? 20 * (k + 1), score = won ? Math.max(5, base - Math.max(0, bd.misses - bd.cards.length / 2)) : found() * 2;
            ctx.finish({ score, label: 'points', passed: won && score >= (def.pass || 0), extra: won ? `Level ${k + 1} (${label(LV[k])}): every pair in ${bd.turns} turns, ${bd.misses} misses.${k + 1 < LV.length ? ` Level ${k + 2} is open.` : ' Every level won.'}`
              : `${found()} of ${bd.cards.length / 2} pairs before the misses ran out.` });
          }
        },
        key(e, down) {
          if (!down || e.repeat) return; const k = e.key.toLowerCase();
          if (st.phase === 'pick') { const n = parseInt(k, 10); if (n >= 1 && n <= LV.length) choose(n - 1); return; }
          if (st.phase !== 'play') return;
          if (k === 'arrowup' || k === 'w') st.cr = Math.max(0, st.cr - 1); else if (k === 'arrowdown' || k === 's') st.cr = Math.min(bd.r - 1, st.cr + 1);
          else if (k === 'arrowleft' || k === 'a') st.cc = Math.max(0, st.cc - 1); else if (k === 'arrowright' || k === 'd') st.cc = Math.min(bd.c - 1, st.cc + 1);
          else if (k === ' ' || k === 'enter') flip(st.cr * bd.c + st.cc);
        },
        pointer(evt) {
          if (evt.type !== B.PointerEventTypes.POINTERDOWN || st.phase !== 'play') return;
          const hit = scene.pickWithRay(ctx.ray(), m => m.metadata?.emCard != null); if (hit?.hit) flip(hit.pickedMesh.metadata.emCard);
        },
        _test: { st, choose, flip, get bd() { return bd; } },
        dispose() { pick.remove(); if (bd) bd.nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); own.forEach(o => { try { o.dispose(); } catch (e) {} }); try { backTex.dispose(); } catch (e) {} }
      };
    }
  };
  window.RebelGames.register('memory', G);
})();
