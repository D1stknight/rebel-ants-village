// The War Drums (Oct 15, Warrior): beat the fort's war drums in time. Notes roll down four lanes toward the drums;
// strike a drum (D F J K, or the arrow keys, or the pads) as its note reaches the line. Perfect (within 0.06 s) and
// good (within 0.12 s) hits build a combo that multiplies the score (x2 from 10, x3 from 30, x4 from 60); a note that
// passes unstruck breaks it. Ten songs (Oct 17, Miguel: "make it 10 songs") from the slow Fort Gate March to Will to
// Fight's 184 beats a minute (Smoke on the Ridge rolls in triplets); a C (70 %) opens the next song, and a B (80 %) on
// the third song or later clears the drums.
// Notes are thin instances of one mesh (one draw call); the beat is the game's own sound. def: { pass, points }
(function () {
  const SONGS = [
    { name: 'Fort Gate March', bpm: 92, bars: 16, lanes: [1, 2], sub: 1, density: .8, seed: 11 },
    { name: 'Changing of the Guard', bpm: 104, bars: 20, lanes: [0, 1, 2], sub: 2, density: .5, seed: 23 },
    { name: 'The Charge', bpm: 120, bars: 24, lanes: [0, 1, 2, 3], sub: 2, density: .62, seed: 37 },
    { name: 'Night Siege', bpm: 136, bars: 24, lanes: [0, 1, 2, 3], sub: 2, density: .7, chords: .18, sync: .25, seed: 41 },
    { name: 'The Cracked Circle', bpm: 152, bars: 28, lanes: [0, 1, 2, 3], sub: 4, density: .42, chords: .14, bursts: .3, seed: 53 },
    { name: 'War Master', bpm: 168, bars: 32, lanes: [0, 1, 2, 3], sub: 4, density: .5, chords: .2, bursts: .4, sync: .3, seed: 67 },
    { name: 'Smoke on the Ridge', bpm: 160, bars: 30, lanes: [0, 1, 2, 3], sub: 3, density: .62, chords: .2, bursts: .3, sync: .25, seed: 71 },
    { name: 'Iron Rain', bpm: 168, bars: 32, lanes: [0, 1, 2, 3], sub: 4, density: .54, chords: .24, bursts: .4, sync: .3, seed: 83 },
    { name: 'The Broken Wall', bpm: 176, bars: 34, lanes: [0, 1, 2, 3], sub: 4, density: .56, chords: .26, bursts: .45, sync: .33, seed: 97 },
    { name: 'Will to Fight', bpm: 184, bars: 36, lanes: [0, 1, 2, 3], sub: 4, density: .58, chords: .28, bursts: .5, sync: .35, seed: 101 }];
  const LANE_X = [-1.2, -.4, .4, 1.2], LANE_COL = [[1, .35, .25], [1, .8, .25], [.35, .85, .45], [.35, .6, 1]], PITCH = [98, 131, 165, 220];
  const KEYS = { d: 0, arrowleft: 0, f: 1, arrowdown: 1, j: 2, arrowup: 2, k: 3, arrowright: 3 };
  const PERFECT = .06, GOOD = .12, LATE = .18, SPEED = 7.5, LEAD = 2; // m/s along the lanes, bars of count-in
  function chart(song) { // the notes of a song: [{ t, lane }] from a seeded pattern
    let s = song.seed; const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    const beat = 60 / song.bpm, out = [], L = song.lanes; let last = L[0], burst = 0;
    for (let bar = 0; bar < song.bars; bar++) for (let b = 0; b < 4; b++) for (let q = 0; q < song.sub; q++) {
      const t = (LEAD * 4 + bar * 4 + b + q / song.sub) * beat, onBeat = q === 0, strong = onBeat && (b === 0 || b === 2);
      let p = onBeat ? song.density + .25 : song.density * .55; if (strong) p += .2; if (song.sync && !onBeat && rnd() < song.sync) p += .3;
      if (burst > 0) { p = 1; burst--; } else if (song.bursts && onBeat && rnd() < song.bursts * .25) burst = song.sub - 1;
      if (bar === song.bars - 1 && b === 3) p = q === 0 ? 1 : 0; // the closing beat
      if (rnd() >= p) continue;
      let lane = L[Math.floor(rnd() * L.length)]; if (L.length > 2 && lane === last && rnd() < .6) lane = L[(L.indexOf(lane) + 1 + Math.floor(rnd() * (L.length - 1))) % L.length];
      out.push({ t, lane }); last = lane;
      if (song.chords && strong && rnd() < song.chords) { const other = L.filter(x => x !== lane)[Math.floor(rnd() * (L.length - 1))]; out.push({ t, lane: other }); } }
    return out.sort((a, b) => a.t - b.t); }
  const G = {
    title: 'The War Drums',
    start(ctx) {
      const B = ctx.B, H = ctx.HUD, scene = ctx.scene, def = ctx.def, KEY = 'rebelAntsDrumsProgress:' + (def.id || 'drums'), BEST = 'rebelAntsDrumsBest:' + (def.id || 'drums') + ':';
      let open = 1; try { open = Math.max(1, Math.min(SONGS.length, Number(localStorage.getItem(KEY)) || 1)); } catch (e) {}
      const mat = (k, c, em) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(.08, .08, .08); if (em) m.emissiveColor = new B.Color3(...em); return m; });
      const woodM = mat('runway', [.32, .2, .11], [.07, .045, .025]), rimM = mat('rim', [.2, .12, .08], [.04, .025, .015]), lineM = mat('line', [.95, .85, .6], [.6, .5, .3]);
      const nodes = [], keep = n => { n.parent = n.parent || ctx.frame; ctx.add(n); nodes.push(n); if (n.isPickable !== undefined) n.isPickable = false; return n; };
      // the runway the notes roll down, the hit line, four drums whose heads light when struck
      { const r = keep(B.MeshBuilder.CreateBox('drRunway', { width: 3.4, height: .1, depth: 15 }, scene)); r.material = woodM; r.position.set(0, .05, 6.6);
        for (const x of [-.8, 0, .8]) { const l = keep(B.MeshBuilder.CreateBox('drLane', { width: .03, height: .02, depth: 15 }, scene)); l.material = rimM; l.position.set(x, .11, 6.6); }
        const hl = keep(B.MeshBuilder.CreateBox('drHitLine', { width: 3.4, height: .03, depth: .06 }, scene)); hl.material = lineM; hl.position.set(0, .12, 0); }
      const drums = LANE_X.map((x, i) => { const body = keep(B.MeshBuilder.CreateCylinder('drDrum' + i, { diameter: .62, height: .5, tessellation: 20 }, scene)); body.material = rimM; body.position.set(x, -.12, -.55);
        const headM = new B.StandardMaterial('drHeadMat' + i, scene); headM.diffuseColor = new B.Color3(.92, .86, .72); headM.emissiveColor = new B.Color3(...LANE_COL[i]).scale(.25); headM.specularColor = new B.Color3(.1, .1, .1);
        const head = keep(B.MeshBuilder.CreateCylinder('drHead' + i, { diameter: .56, height: .03, tessellation: 20 }, scene)); head.material = headM; head.position.set(x, .14, -.55);
        return { head, headM, flash: 0 }; });
      const noteM = new B.StandardMaterial('drNoteMat', scene); noteM.disableLighting = true; noteM.emissiveColor = new B.Color3(1, 1, 1); // unlit: emissive x the instance colour = the lane colour in any light
      const note = keep(B.MeshBuilder.CreateCylinder('drNote', { diameter: .5, height: .1, tessellation: 18 }, scene)); note.material = noteM; note.alwaysSelectAsActiveMesh = true; note.isVisible = false; // hidden until it has notes: its shader must first build with the instances (and their colours) in place
      const MAXN = 64, mBuf = new Float32Array(16 * MAXN), cBuf = new Float32Array(4 * MAXN), tmp = new B.Matrix();
      note.thinInstanceSetBuffer('matrix', mBuf, 16, false); note.thinInstanceSetBuffer('color', cBuf, 4, false); note.thinInstanceCount = 0; // one buffer, rewritten in place
      const st = { phase: 'pick', t: 0, wall: 0, k: 0, notes: [], next: 0, score: 0, combo: 0, best: 0, hits: { perfect: 0, good: 0, miss: 0 }, beat: -1, msgT: 0 };
      const songBest = k => { try { return Number(localStorage.getItem(BEST + k)) || 0; } catch (e) { return 0; } };
      const mult = () => st.combo >= 60 ? 4 : st.combo >= 30 ? 3 : st.combo >= 10 ? 2 : 1;
      const acc = () => { const n = st.notes.length || 1; return (st.hits.perfect + st.hits.good * .5) / n; };
      const grade = a => a >= .95 ? 'S' : a >= .9 ? 'A' : a >= .8 ? 'B' : a >= .7 ? 'C' : 'D';
      const info = () => H.info(st.phase === 'pick' ? 'Pick a song' : `${SONGS[st.k].name} · ${SONGS[st.k].bpm} bpm · combo ${st.combo} (x${mult()}) · perfect ${st.hits.perfect} · good ${st.hits.good} · miss ${st.hits.miss}`);
      function begin(k) { st.k = k; st.notes = chart(SONGS[k]).map(n => ({ ...n, hit: 0 })); st.t = -.5; st.next = 0; st.score = 0; st.combo = 0; st.best = 0; st.hits = { perfect: 0, good: 0, miss: 0 }; st.beat = -1; st.phase = 'play'; st.end = st.notes[st.notes.length - 1].t + 1.6; H.score(0); info(); }
      function judge(lane, tHit) { // the nearest unstruck note in that lane within reach
        if (st.phase !== 'play') return null; drums[lane].flash = 1; const now = performance.now(); if (now - (st.lastSound || 0) > 60) { st.lastSound = now; ctx.note(PITCH[lane], 'fire'); } // fast runs: one drum sound per 60 ms
        let best = null, bd = 1e9; for (let i = st.next; i < st.notes.length; i++) { const n = st.notes[i]; if (n.t - tHit > LATE) break; if (n.hit || n.lane !== lane) continue; const d = Math.abs(n.t - tHit); if (d < bd) { bd = d; best = n; } }
        if (!best || bd > GOOD) return 'none';
        const perfect = bd <= PERFECT; best.hit = perfect ? 2 : 1; st.hits[perfect ? 'perfect' : 'good']++; st.combo++; st.best = Math.max(st.best, st.combo);
        st.score += (perfect ? 100 : 50) * mult(); H.score(st.score); if (st.combo === 10 || st.combo === 30 || st.combo === 60) H.msg(`x${mult()}`, 600, `${st.combo} in a row`); info(); return perfect ? 'perfect' : 'good'; }
      function strike(lane) { // a key or pad press: the song time now, between frames
        const now = st.t + Math.min(.05, (performance.now() - st.wall) / 1000); return judge(lane, now); }
      function render() { let k = 0;
        for (let i = st.next; i < st.notes.length && k < MAXN; i++) { const n = st.notes[i], z = (n.t - st.t) * SPEED; if (z > 14.5) break; if (n.hit || z < -1.2) continue;
          B.Matrix.TranslationToRef(LANE_X[n.lane], .16, z, tmp); tmp.copyToArray(mBuf, k * 16); const c = LANE_COL[n.lane]; cBuf.set([c[0], c[1], c[2], 1], k * 4); k++; }
        note.thinInstanceBufferUpdated('matrix'); note.thinInstanceBufferUpdated('color'); note.thinInstanceCount = k; note.isVisible = k > 0; }
      function end() { st.phase = 'over'; st.wt = 0; pads.style.display = 'none'; const a = acc(), gr = grade(a);
        if (a >= .7 && st.k + 2 > open && st.k + 1 < SONGS.length) { open = st.k + 2; try { localStorage.setItem(KEY, String(open)); } catch (e) {} }
        if (st.score > songBest(st.k)) { try { localStorage.setItem(BEST + st.k, String(st.score)); } catch (e) {} }
        ctx.sound(a >= .8 ? 'gamewin' : 'thock'); H.msg(`Grade ${gr}`, 1700, `${Math.round(a * 100)} % · best combo ${st.best}`); info(); }
      const hud = document.getElementById('gameHud');
      const pick = document.createElement('div');
      pick.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(420px,92vw);background:rgba(24,12,6,.95);border:1px solid rgba(230,120,70,.6);border-radius:14px;padding:16px;text-align:center;pointer-events:auto;font:15px/1.4 system-ui,sans-serif;color:#eee';
      const drawPick = () => { pick.innerHTML = `<div style="font:800 13px/1.2 system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#ff9a6a;margin-bottom:10px">The War Drums</div><div style="margin-bottom:12px;color:#bbb">Strike each drum as its note reaches the line: <b>D F J K</b> or the arrows.</div>`
        + `<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px">${SONGS.map((s, k) => { const ok = k < open, b = songBest(k); return `<button type="button" data-k="${k}" ${ok ? '' : 'disabled'} style="padding:8px 4px;border-radius:9px;border:1px solid ${ok ? '#ff9a6a' : '#444'};background:rgba(255,255,255,.04);color:${ok ? '#fff' : '#666'};font:700 14px system-ui,sans-serif;cursor:${ok ? 'pointer' : 'default'}">${ok ? s.name : '🔒'}<div style="font:11px system-ui;opacity:.75">${s.bpm} bpm${b ? ` · best ${b}` : ''}</div></button>`; }).join('')}</div>`;
        pick.querySelectorAll('button[data-k]').forEach(b => b.onclick = (e) => { e.stopPropagation(); b.blur(); choose(+b.dataset.k); }); };
      const pads = document.createElement('div');
      pads.style.cssText = 'position:absolute;bottom:62px;left:50%;transform:translateX(-50%);display:none;grid-template-columns:repeat(4,64px);gap:8px;pointer-events:auto';
      LANE_X.forEach((x, i) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = 'DFJK'[i]; const c = LANE_COL[i].map(v => Math.round(v * 255)).join(','); b.style.cssText = `height:56px;border-radius:50%;border:2px solid rgb(${c});background:rgba(${c},.25);color:#fff;font:800 18px system-ui;cursor:pointer;touch-action:none`;
        b.onpointerdown = (e) => { e.stopPropagation(); e.preventDefault(); strike(i); }; pads.appendChild(b); });
      function choose(k) { if (st.phase !== 'pick' || k >= open) return; pick.remove(); pads.style.display = 'grid'; begin(k); H.msg(SONGS[k].name, 1200, 'count in: two bars'); }
      hud.append(pick, pads); drawPick();
      const cam = [0, 3.2, -4.2], at = [0, .1, 1.0];
      ctx.player.place(-1.6, -4.8, 0); // just behind the camera: out of the picture ctx.look(cam, at, def.fov || .85); render();
      H.title(def.title || 'The War Drums'); H.score(''); info();
      H.hint('<kbd>D</kbd> <kbd>F</kbd> <kbd>J</kbd> <kbd>K</kbd> (or the arrows, or the pads) strike the four drums as the notes cross the line.');
      return {
        update(dt) {
          ctx.look(cam, at); st.wall = performance.now();
          for (const d of drums) if (d.flash > 0) { d.flash = Math.max(0, d.flash - dt * 5); d.headM.emissiveColor.copyFrom(new B.Color3(...LANE_COL[drums.indexOf(d)]).scale(.25 + .9 * d.flash)); d.head.scaling.y = 1 + d.flash; }
          if (st.phase === 'play') { st.t += dt;
            const beat = 60 / SONGS[st.k].bpm, bi = Math.floor(st.t / beat); if (bi !== st.beat && st.t >= 0) { st.beat = bi; if (bi < LEAD * 4) ctx.note(bi % 4 ? 330 : 440, 'lantern'); else if (bi % 2 === 0) ctx.note(65, 'fire'); }
            while (st.next < st.notes.length && (st.notes[st.next].hit || st.notes[st.next].t < st.t - LATE)) { const n = st.notes[st.next]; if (!n.hit) { st.hits.miss++; if (st.combo >= 10) H.msg('Combo broken', 600); st.combo = 0; info(); } st.next++; }
            render(); if (st.t > st.end) end(); }
          if (st.phase === 'over' && (st.wt += dt) > 1.8) { st.phase = 'done'; H.hint(''); const a = acc(), gr = grade(a);
            ctx.finish({ score: st.score, label: 'points', passed: a >= .8 && st.k >= 2, solved: a >= .8 && st.k >= 2,
              extra: `${SONGS[st.k].name}: grade ${gr} (${Math.round(a * 100)} %), ${st.hits.perfect} perfect, ${st.hits.good} good, ${st.hits.miss} missed, best combo ${st.best}.${a >= .7 && st.k + 1 < SONGS.length ? ` ${SONGS[st.k + 1].name} is open.` : ''}${a >= .8 && st.k >= 2 ? '' : ' A B (80 %) or better on The Charge or a later song clears the drums.'}` }); }
        },
        key(e, down) {
          if (!down || e.repeat) return; const k = e.key.toLowerCase();
          if (st.phase === 'pick') { const n = k === '0' ? 10 : parseInt(k, 10); if (n >= 1 && n <= SONGS.length) choose(n - 1); return; } // 1-9, 0 = the tenth
          if (k in KEYS) strike(KEYS[k]);
        },
        pointer() {},
        _test: { st, choose, judge, strike, chart, SONGS, acc, grade, end, unlock(n) { open = n; drawPick(); } },
        dispose() { pick.remove(); pads.remove(); nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); try { noteM.dispose(); drums.forEach(d => d.headM.dispose()); } catch (e) {} }
      };
    }
  };
  window.RebelGames.register('drums', G);
})();
