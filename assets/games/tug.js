// Tug of War (Oct 15, Warrior fort): a rope, a red ribbon and two chalk lines. The ring on the screen swells and
// shrinks: pull (Space, Enter or a click) as it swells to full and the ribbon comes your way; pull at the wrong moment
// and it barely moves. Your opponent leans back steadily, and every few seconds heaves (a red warning first): pull
// well through a heave and it counts double. Drag the ribbon over your chalk line to win; 40 seconds, then whoever
// has the ribbon on their side wins.
// def: { opponent: npcId, gap: m between the pullers, seconds, cycle: s per swell, drift, heave, cam, look, pass, points }
(function () {
  const G = {
    title: 'Tug of War',
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const GAP = def.gap || 5.2, SEC = def.seconds || 40, CYCLE = def.cycle || .72, LINE = 1.25;
      const mat = (k, c, em, spec = .1) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(spec, spec, spec); if (em) m.emissiveColor = new B.Color3(...em); return m; });
      const M = { rope: mat('rope', [.72, .6, .38], [.1, .08, .05]), ribbon: mat('ribbon', [.9, .12, .1], [.4, .04, .03]), chalk: mat('chalk', [.95, .95, .92], [.45, .45, .42]) };
      const nodes = [], keep = n => { if (!n.parent) n.parent = ctx.frame; ctx.add(n); nodes.push(n); return n; };
      for (const s of [-1, 1]) { const c = keep(B.MeshBuilder.CreateGround('tgChalk', { width: 2.4, height: .14 }, scene)); c.position.set(0, .03, s * LINE); c.material = M.chalk; c.isPickable = false; }
      const mid = keep(B.MeshBuilder.CreateGround('tgMid', { width: 1, height: .08 }, scene)); mid.position.set(0, .03, 0); mid.material = M.chalk; mid.isPickable = false;
      const ribbon = keep(B.MeshBuilder.CreateBox('tgRibbon', { width: .08, height: .45, depth: .1 }, scene)); ribbon.material = M.ribbon; ribbon.isPickable = false;
      let rope = null;
      const npc = def.opponent ? ctx.npc(def.opponent) : null, npcWas = npc ? { p: npc.position.clone(), ry: npc.rotation.y, rx: npc.rotation.x, open: npc.metadata?.dialogueOpen, m: { home: npc.metadata?.home, wo: npc.metadata?.wanderOrigin, target: npc.metadata?.target } } : null;
      const pr = ctx.player.root, prWas = pr ? pr.rotation.x : 0;
      const st = { phase: 'intro', intro: 2, t: 0, left: SEC, b: 0, good: 0, weak: 0, combo: 0, heave: 0, warn: 0, nextHeave: 3.5 + Math.random() * 1.5, flash: 0, best: 0 };
      // the ring: swells to full once a cycle; a pull near the top counts
      const hud = document.getElementById('gameHud'), ringBox = document.createElement('div');
      ringBox.style.cssText = 'position:absolute;right:28px;top:50%;width:120px;height:120px;margin-top:-60px;pointer-events:none';
      ringBox.innerHTML = '<div style="position:absolute;inset:0;border-radius:50%;border:3px solid rgba(255,216,119,.85)"></div><div class="tg-ring" style="position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle,rgba(255,216,119,.55),rgba(255,140,60,.25));transform:scale(.4)"></div><div class="tg-word" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:700 15px Georgia,serif;color:#fff;text-shadow:0 1px 3px #000">PULL</div>';
      hud.appendChild(ringBox); const ringEl = ringBox.querySelector('.tg-ring'), wordEl = ringBox.querySelector('.tg-word');
      const flash = document.createElement('div'); flash.style.cssText = 'position:absolute;inset:0;pointer-events:none;opacity:0;background:rgba(170,20,20,.35);transition:opacity .3s'; hud.appendChild(flash);
      const cyc = () => (st.t % CYCLE) / CYCLE, swell = () => Math.sin(Math.PI * cyc()); // 0 .. 1 .. 0
      const place = () => { // the pullers slide with the ribbon and lean back
        const shift = st.b * LINE, lean = .1 + Math.abs(st.b) * .08; // the ribbon reaches a chalk line at b = ±1
        ctx.player.place(0, -GAP / 2 - shift, 0); if (pr) pr.rotation.x = -lean;
        if (npc) { const w = ctx.toWorld(0, 0, GAP / 2 - shift); npc.position.x = w.x; npc.position.z = w.z; const f = ctx.toWorld(0, 0, -GAP); npc.rotation.y = Math.atan2(f.x - w.x, f.z - w.z); npc.rotation.x = -lean;
          if (npc.metadata) { npc.metadata.target = null; npc.metadata.home = npc.position.clone(); npc.metadata.wanderOrigin = npc.position.clone(); npc.metadata.dialogueOpen = true; } }
        // the rope from hand to hand, sagging a little; the ribbon at its middle
        const a = new V3(0, 1.45, -GAP / 2 - shift + .55), c = new V3(0, 1.45, GAP / 2 - shift - .55), pts = [];
        for (let i = 0; i <= 10; i++) { const f = i / 10, p = V3.Lerp(a, c, f); p.y -= Math.sin(Math.PI * f) * .12; pts.push(p); }
        rope = B.MeshBuilder.CreateTube('tgRope', { path: pts, radius: .045, tessellation: 6, updatable: true, instance: rope || undefined }, scene);
        if (!rope.material) { rope.material = M.rope; rope.isPickable = false; keep(rope); }
        ribbon.position.set(0, 1.2, -shift);
      };
      place();
      const cam = def.cam || [3.6, 2.6, -1.4], look = def.look || [0, 1.3, 0];
      ctx.look(cam, look, def.fov || .8);
      H.title(def.title || 'Tug of War'); H.score(''); H.info(`${SEC} s`);
      H.hint('Pull (<kbd>Space</kbd>, <kbd>Enter</kbd> or a click) as the ring swells full. Hold on through his heaves: a good pull then counts double.');
      H.msg('Tug of War', 1600, npc ? 'take the rope' : '');
      // a pull may carry the ribbon past the line (b up to 1.3): the next frame calls the win, whatever the drift
      function pull() {
        if (st.phase !== 'bout') return;
        const s = swell();
        if (s > .88) { st.combo++; st.good++; st.best = Math.max(st.best, st.combo); const gain = .085 * (1 + Math.min(5, st.combo) * .08) * (st.heave > 0 ? 2 : 1); st.b = Math.min(1.3, st.b + gain); ctx.note(392 + Math.min(8, st.combo) * 40, 'bell'); wordEl.textContent = 'GOOD'; }
        else { st.combo = 0; st.weak++; st.b = Math.min(1.3, st.b + .012); ctx.sound('thock'); wordEl.textContent = 'slip'; }
        st.wordT = .35;
      }
      return {
        update(dt) {
          ctx.look(cam, look);
          if (st.phase === 'intro' && (st.intro -= dt) <= 0) { st.phase = 'bout'; H.msg('Pull!', 700); }
          if (st.phase === 'bout') {
            st.t += dt; st.left = Math.max(0, st.left - dt); H.info(`${Math.ceil(st.left)} s`);
            const drift = (def.drift || .04) * (1 + (1 - st.left / SEC) * .6); st.b -= drift * dt;
            if (st.warn > 0 && (st.warn -= dt) <= 0) { st.heave = .75; }
            if (st.heave > 0) { st.heave -= dt; st.b -= (def.heave || .38) * dt; }
            if ((st.nextHeave -= dt) <= 0) { st.warn = .6; st.nextHeave = 3 + Math.random() * 2.2; H.msg('He heaves!', 700); flash.style.transition = 'none'; flash.style.opacity = '1'; void flash.offsetWidth; flash.style.transition = 'opacity .6s'; flash.style.opacity = '0'; }
            if (st.wordT > 0 && (st.wordT -= dt) <= 0) wordEl.textContent = 'PULL';
            ringEl.style.transform = `scale(${(.4 + .6 * swell()).toFixed(3)})`;
            H.score(`${st.b >= 0 ? '◀' : '▶'} ${Math.round(Math.abs(st.b) * 100)}%`);
            const end = st.b >= 1 ? 'won' : st.b <= -1 ? 'lost' : st.left <= 0 ? (st.b > 0 ? 'won' : 'lost') : null;
            if (end) { st.phase = end; st.wait = 1.8; ctx.sound(end === 'won' ? 'gamewin' : 'thock'); H.msg(end === 'won' ? 'Over the line!' : 'Pulled over…', 1500); }
          }
          place();
          if ((st.phase === 'won' || st.phase === 'lost') && (st.wait -= dt) <= 0) {
            const won = st.phase === 'won'; st.phase = 'done'; H.hint('');
            const pts = won ? 60 + Math.round(st.left) + st.best * 2 : st.good * 2;
            ctx.finish({ score: pts, label: 'points', passed: won && pts >= (def.pass || 0), extra: `${won ? 'You won the rope' : 'The rope went to your opponent'}: ${st.good} good pulls, best run ${st.best}.` });
          }
        },
        key(e, down) { if (!down || e.repeat) return; if (e.key === ' ' || e.key === 'Enter') pull(); },
        pointer(evt) { if (evt.type === B.PointerEventTypes.POINTERDOWN) pull(); },
        _test: { st, pull, swell, CYCLE },
        dispose() { ringBox.remove(); flash.remove(); if (pr) pr.rotation.x = prWas; nodes.forEach(n => { try { n.dispose(); } catch (e) {} });
          if (npc && npcWas) { npc.position.copyFrom(npcWas.p); npc.rotation.y = npcWas.ry; npc.rotation.x = npcWas.rx || 0; if (npc.metadata) { npc.metadata.home = npcWas.m.home; npc.metadata.wanderOrigin = npcWas.m.wo; npc.metadata.target = npcWas.m.target; npc.metadata.dialogueOpen = !!npcWas.open; } } }
      };
    }
  };
  window.RebelGames.register('tug', G);
})();
