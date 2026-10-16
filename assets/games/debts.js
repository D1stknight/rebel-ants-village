// The Debt Marker (Oct 16, Ronin): five debt stones stand before the Hall of Debts, each cut with the debt it keeps:
// the Blade, the Bridge, Silence, the Lantern and the Name. A riddle is cut into the door; touch the stone it speaks
// of (click it or press 1-5). Six riddles from the door's twelve; a wrong stone cracks and the door gives the reason.
// 20 points a riddle; two wrong stones are forgiven, a third ends it.
// def: { ask: 6, pass: 100, riddles: [{ q, stone: 0-4, why }] (else the door's own), cam, at }
(function () {
  const STONES = [
    { name: 'The Blade', icon: 'blade' }, { name: 'The Bridge', icon: 'bridge' }, { name: 'Silence', icon: 'silence' },
    { name: 'The Lantern', icon: 'lantern' }, { name: 'The Name', icon: 'name' }];
  const RIDDLES = [
    { q: 'I was given before I could be earned. I am paid back only in the way I am used.', stone: 0, why: 'A sword is given by a master before the student deserves it; it is repaid in how it is drawn.' },
    { q: 'Another forged me; I hang at your side. Each time you draw me, you owe again.', stone: 0, why: 'The blade: every cut is made with a gift.' },
    { q: 'When the river took your feet, someone\'s back became the road.', stone: 1, why: 'The Bridge: the one who carried you across.' },
    { q: 'Owed not for a road over land, but for the way over water, and the one who held you up.', stone: 1, why: 'A bridge is a debt to whoever was the bridge.' },
    { q: 'It was never spoken, and that is why it is owed.', stone: 2, why: 'Silence: a secret kept for you.' },
    { q: 'A word not said kept a life. This debt makes no sound.', stone: 2, why: 'Silence is the debt that is paid by keeping it.' },
    { q: 'In the storm a small light went ahead of you. The one who walks in front pays for the dark.', stone: 3, why: 'The Lantern: the one who lit the way home.' },
    { q: 'Its oil burned out long ago, but the way it showed you is still yours.', stone: 3, why: 'A lantern\'s light is gone; the road it found is not.' },
    { q: 'You came with nothing, not even something to be called. They gave you this.', stone: 4, why: 'The Name: the clan that took you in.' },
    { q: 'When you had no house, a house gave you its own word for you.', stone: 4, why: 'A name given by a house is a debt to that house.' },
    { q: 'It cannot be repaid to the one who gave it, only to the next who has none.', stone: 4, why: 'A name is passed on: the Ronin repay it by naming the nameless.' },
    { q: 'The first debt of the Ronin: it sleeps in a scabbard and wakes in judgment.', stone: 0, why: 'The blade sleeps in its scabbard: the first debt.' }];
  const G = {
    title: 'The Debt Marker',
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const mix = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const k = Math.floor(Math.random() * (i + 1)); [a[i], a[k]] = [a[k], a[i]]; } return a; };
      const ALL = (def.riddles && def.riddles.length ? def.riddles : RIDDLES), ASK = Math.min(def.ask || 6, ALL.length);
      // six riddles, no stone asked three times running out of turn: shuffled, then spread
      const asked = mix(ALL).slice(0, ASK);
      const mat = (k, c, em) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(.06, .06, .06); if (em) m.emissiveColor = new B.Color3(...em); return m; });
      const nodes = [], keep = n => { n.parent = n.parent || ctx.frame; ctx.add(n); nodes.push(n); return n; };
      const granite = mat('granite', [.16, .16, .17], [.02, .02, .02]), base = mat('base', [.1, .1, .1]);
      // a carved face: the kanji in red over the debt's name, on a dark slab (one texture per stone)
      const faceTex = (s) => {
        const t = new B.DynamicTexture('debtFace_' + s.icon, { width: 256, height: 512 }, scene, true), c = t.getContext();
        c.fillStyle = '#26262a'; c.fillRect(0, 0, 256, 512); c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 6; c.strokeRect(14, 14, 228, 484);
        // the debt's mark, cut in red (drawn, so no font is needed)
        c.strokeStyle = c.fillStyle = '#b3161f'; c.lineWidth = 14; c.lineCap = c.lineJoin = 'round'; c.beginPath();
        if (s.icon === 'blade') { c.moveTo(70, 320); c.lineTo(190, 90); c.stroke(); c.beginPath(); c.moveTo(70, 250); c.lineTo(132, 282); c.stroke(); c.beginPath(); c.arc(84, 300, 9, 0, 7); c.fill(); }
        else if (s.icon === 'bridge') { c.arc(128, 300, 92, Math.PI * 1.05, Math.PI * 1.95); c.stroke(); c.beginPath(); c.moveTo(30, 228); c.lineTo(226, 228); c.stroke(); [52, 90, 128, 166, 204].forEach(x => { c.beginPath(); c.moveTo(x, 228); c.lineTo(x, 205); c.stroke(); }); c.beginPath(); c.moveTo(30, 318); c.lineTo(226, 318); c.lineWidth = 6; c.stroke(); }
        else if (s.icon === 'silence') { c.arc(128, 200, 86, 0, 7); c.stroke(); c.beginPath(); c.moveTo(82, 228); c.lineTo(174, 228); c.stroke(); c.beginPath(); c.arc(98, 176, 9, 0, 7); c.fill(); c.beginPath(); c.arc(158, 176, 9, 0, 7); c.fill(); }
        else if (s.icon === 'lantern') { c.moveTo(108, 92); c.lineTo(148, 92); c.stroke(); c.beginPath(); c.ellipse(128, 200, 58, 92, 0, 0, 7); c.stroke(); c.lineWidth = 7; [-30, 0, 30].forEach(dy => { c.beginPath(); c.moveTo(78, 200 + dy); c.lineTo(178, 200 + dy); c.stroke(); }); c.lineWidth = 14; c.beginPath(); c.moveTo(108, 304); c.lineTo(148, 304); c.stroke(); }
        else { c.strokeRect(62, 120, 132, 160); c.lineWidth = 9; c.beginPath(); c.moveTo(128, 136); c.lineTo(128, 264); c.moveTo(80, 170); c.lineTo(176, 170); c.moveTo(80, 230); c.lineTo(176, 230); c.stroke(); }
        c.fillStyle = '#d9cfb4'; c.font = 'bold 30px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s.name.toUpperCase(), 128, 410); t.update(); return t;
      };
      const stones = STONES.map((s, i) => {
        const x = (i - 2) * 1.35, root = keep(new B.TransformNode('debtStone', scene)); root.position.set(x, 0, 3.4);
        const slab = B.MeshBuilder.CreateBox('debtSlab', { width: .9, height: 1.9, depth: .32 }, scene); slab.parent = root; slab.position.y = 1.05; slab.material = granite; ctx.add(slab); nodes.push(slab);
        const plinth = B.MeshBuilder.CreateBox('debtPlinth', { width: 1.1, height: .2, depth: .5 }, scene); plinth.parent = root; plinth.position.y = .1; plinth.material = base; plinth.isPickable = false; ctx.add(plinth); nodes.push(plinth);
        const fm = new B.StandardMaterial('debtFaceM' + i + '_' + Date.now(), scene); fm.diffuseTexture = faceTex(s); fm.emissiveColor = new B.Color3(.18, .16, .14); fm.specularColor = new B.Color3(0, 0, 0);
        const face = B.MeshBuilder.CreatePlane('debtFace', { width: .8, height: 1.6 }, scene); face.parent = root; face.position.set(0, 1.05, -.165); face.material = fm; ctx.add(face); nodes.push(face);
        slab.metadata = face.metadata = { debtStone: i }; slab.isPickable = face.isPickable = true;
        return { i, root, slab, face, fm, glow: 0, crack: 0 };
      });
      const st = { phase: 'intro', wait: 1.2, k: 0, right: 0, wrong: 0, score: 0, lock: 0 };
      // the door's card on a dark panel (it sits over the hall's bright front)
      const panel = html => `<div style="background:rgba(12,8,14,.84);border:1px solid rgba(216,179,92,.45);border-radius:12px;padding:10px 18px 12px;max-width:min(680px,92vw);text-align:center">${html}</div>`;
      const card = () => {
        const r = asked[st.k]; if (!r) { H.card(''); return; }
        H.card(panel(`<div style="font:600 13px/1.3 Georgia,serif;letter-spacing:.12em;color:#d8b35c;text-transform:uppercase">Cut into the door · ${st.k + 1} of ${asked.length}</div>
          <div style="font:500 19px/1.45 Georgia,serif;margin:8px 0 10px;color:#f4ecd8">${r.q}</div>
          <div style="font:12px/1.4 system-ui;color:#c9c0aa">${STONES.map((s, i) => `<b style="color:#f3c84a">${i + 1}</b> ${s.name}`).join(' · ')}</div>`));
      };
      const info = () => H.info(`Riddle ${Math.min(st.k + 1, asked.length)} / ${asked.length} · ${st.wrong === 0 ? 'two wrong stones forgiven' : st.wrong === 1 ? 'one more wrong stone forgiven' : 'the next wrong stone closes the door'}`);
      function choose(i) {
        if (st.phase !== 'play' || st.lock > 0 || !stones[i]) return;
        const r = asked[st.k]; st.lock = 1.1;
        const ok = i === r.stone;
        if (ok) { st.right++; st.score += 20; stones[i].glow = 1.4; ctx.sound('gamewin'); H.msg('Named', 800); }
        else { st.wrong++; stones[i].crack = 1; ctx.sound('thock'); stones[r.stone].glow = 1.4; H.msg(`Not ${STONES[i].name}`, 1100); st.lock = 2.2; }
        // the reason stays in the door's card until the next riddle
        H.card(panel(`<div style="font:600 13px/1.3 Georgia,serif;letter-spacing:.12em;color:${ok ? '#9be38f' : '#ff9a8a'};text-transform:uppercase">${ok ? 'The debt is named' : 'The stone cracks'}</div>
          <div style="font:500 18px/1.45 Georgia,serif;margin:8px 0 4px;color:#f4ecd8"><b style="color:#f3c84a">${STONES[r.stone].name}.</b> ${r.why || ''}</div>`));
        H.score(st.score); st.k++;
        if (st.wrong > 2 || st.k >= asked.length) { st.phase = 'end'; st.wait = st.lock + .3; H.card(''); }
        else { st.next = st.lock; }
        info();
      }
      ctx.player.place(-3.9, 2.2, Math.PI / 2); // at the end of the row, looking along the stones (clear of the camera's view)
      const cam = def.cam || [2.2, 2.6, -2.6], at = def.at || [0, 1.25, 3.4];
      ctx.look(cam, at, def.fov || .9);
      H.title(def.title || 'The Debt Marker'); H.score(0); info();
      H.hint('Touch the stone the riddle speaks of: click it or press <kbd>1</kbd>-<kbd>5</kbd>.');
      H.msg(def.title || 'The Debt Marker', 1400, 'Five debts. Name the one cut into the door.');
      return {
        update(dt) {
          ctx.look(cam, at);
          if (st.lock > 0) st.lock -= dt;
          if (st.phase === 'intro' && (st.wait -= dt) <= 0) { st.phase = 'play'; card(); }
          if (st.phase === 'play' && st.next != null && st.lock <= 0) { st.next = null; card(); }
          for (const s of stones) {
            if (s.glow > 0) { s.glow = Math.max(0, s.glow - dt); const g = Math.min(1, s.glow); s.fm.emissiveColor.set(.18 + .7 * g, .16 + .45 * g, .14 + .1 * g); }
            if (s.crack > 0) { s.crack = Math.max(0, s.crack - dt * 1.6); s.root.position.x = (s.i - 2) * 1.35 + Math.sin(s.crack * 40) * .04 * s.crack; }
          }
          if (st.phase === 'end' && (st.wait -= dt) <= 0) {
            st.phase = 'done'; H.hint('');
            const passed = st.score >= (def.pass || 100);
            ctx.finish({ score: st.score, label: 'points', passed, extra: `${st.right} of ${st.k} debts named${st.wrong > 2 ? '; the third wrong stone closed the door' : ''}.` });
          }
        },
        key(e, down) { if (!down || e.repeat) return; const n = +e.key; if (n >= 1 && n <= 5) choose(n - 1); },
        pointer(evt) {
          if (evt.type !== B.PointerEventTypes.POINTERDOWN) return;
          const hit = scene.pickWithRay(ctx.ray(), m => m.metadata?.debtStone != null);
          if (hit?.hit) choose(hit.pickedMesh.metadata.debtStone);
        },
        _test: { st, choose, asked, STONES },
        dispose() { H.card(''); stones.forEach(s => { try { s.fm.diffuseTexture?.dispose(); s.fm.dispose(); } catch (e) {} }); nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); }
      };
    }
  };
  window.RebelGames.register('debts', G);
})();
