// The claw machine (Oct 15, the Cute & Creepy Game Hall): five tries to win the gang's plushies. Steer the claw over a
// plushie (the arrow keys / WASD, or the pads), then drop it (Space, Enter or DROP); it closes, lifts and carries what it
// holds to the chute. Dead centre holds best; a grip off to the side can slip on the way up. Fifteen seconds a try, then
// it drops by itself. The gold lucky cat is rare, slippery and worth the most.
// def: { box: [x0, z0, x1, z1] (the claw's reach, frame coords), floor: the pile's top, top: the claw's rest height,
// chute: [x, z], tries: 5, seconds: 15, prizes: 6, playerAt: [x, z], cam, at, pass, points }
(function () {
  const KINDS = [
    { id: 'ghost', name: 'Ghost', pts: 20, grip: 1 }, { id: 'pumpkin', name: 'Pumpkin', pts: 20, grip: 1 },
    { id: 'cat', name: 'Black Cat', pts: 20, grip: .95 }, { id: 'bat', name: 'Bat', pts: 25, grip: .85 },
    { id: 'lucky', name: 'Gold Lucky Cat', pts: 50, grip: .6 }
  ];
  const G = {
    title: 'Claw Machine',
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const BOX = def.box || [4.05, -10.05, 5.95, -8.15], FLOOR = def.floor || 1.72, TOP = def.top || 3.15, CH = def.chute || [4.35, -8.45];
      const TRIES = def.tries || 5, SECS = def.seconds || 15, R = .19;
      const mat = (k, c, em, spec = .1) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(spec, spec, spec); if (em) m.emissiveColor = new B.Color3(...em); return m; });
      const M = {
        iron: mat('iron', [.35, .36, .4], [.06, .06, .07], .6), dark: mat('dark', [.05, .04, .06]), white: mat('white', [.95, .95, 1], [.3, .3, .34]),
        orange: mat('orange', [1, .5, .1], [.3, .13, .02]), black: mat('black', [.08, .07, .1], [.02, .02, .03]), purple: mat('purple', [.45, .22, .62], [.1, .04, .14]),
        gold: mat('gold', [1, .8, .3], [.42, .3, .08], .8), red: mat('red', [.85, .12, .12], [.2, .02, .02]), eye: mat('eye', [.02, .02, .02]), yellow: mat('yellow', [1, .9, .2], [.7, .6, .1]),
        stem: mat('stem', [.3, .5, .15]), rim: mat('chuteRim', [1, .4, .8], [.9, .3, .7])
      };
      // the room's own claw (a part that bobs) steps aside while the game's works
      const holder = ctx.frame.parent;
      const ownClaw = holder ? holder.getChildren(n => /_room_cc_claw$/.test(n.name), false) : [];
      ownClaw.forEach(n => n.setEnabled(false));
      const sph = (name, d, m, parent, x, y, z, sx = 1, sy = 1, sz = 1) => { const s = B.MeshBuilder.CreateSphere(name, { diameter: d, segments: 8 }, scene); s.material = m; s.parent = parent; s.position.set(x, y, z); s.scaling.set(sx, sy, sz); s.isPickable = false; return s; };
      // a plushie (its look by kind) on the pile
      function plush(kind) {
        const n = new B.TransformNode('clawPrize', scene); ctx.add(n);
        const k = kind.id;
        if (k === 'ghost') { sph('cp', .4, M.white, n, 0, 0, 0, 1, 1.15, 1); sph('cp', .26, M.white, n, 0, -.14, 0, 1.5, .5, 1.5); for (const s of [-1, 1]) sph('cp', .06, M.eye, n, s * .07, .05, .17); }
        else if (k === 'pumpkin') { for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; sph('cp', .26, M.orange, n, Math.cos(a) * .08, 0, Math.sin(a) * .08, 1, .85, 1); } sph('cp', .08, M.stem, n, 0, .17, 0, .6, 1.4, .6); for (const s of [-1, 1]) sph('cp', .055, M.yellow, n, s * .07, .04, .17); }
        else if (k === 'cat' || k === 'lucky') { const fur = k === 'lucky' ? M.gold : M.black; sph('cp', .36, fur, n, 0, -.03, 0); sph('cp', .28, fur, n, 0, .2, .02); for (const s of [-1, 1]) { const e = B.MeshBuilder.CreateCylinder('cp', { height: .12, diameterTop: 0, diameterBottom: .1, tessellation: 4 }, scene); e.material = fur; e.parent = n; e.position.set(s * .08, .35, 0); e.rotation.z = -s * .3; e.isPickable = false; sph('cp', .05, k === 'lucky' ? M.eye : M.yellow, n, s * .06, .22, .14); }
          if (k === 'lucky') { const p = B.MeshBuilder.CreateCylinder('cp', { height: .02, diameter: .14, tessellation: 12 }, scene); p.material = M.red; p.parent = n; p.position.set(0, .08, .15); p.rotation.x = Math.PI / 2; p.isPickable = false; } }
        else if (k === 'bat') { sph('cp', .32, M.purple, n, 0, 0, 0); for (const s of [-1, 1]) { const w = B.MeshBuilder.CreateDisc('cp', { radius: .2, tessellation: 3 }, scene); w.material = M.purple; w.parent = n; w.position.set(s * .2, .04, 0); w.rotation.z = s * .4; w.isPickable = false; w.material.backFaceCulling = false; sph('cp', .05, M.yellow, n, s * .06, .05, .14); } }
        n.getChildMeshes(false).forEach(m => ctx.add(m));
        return n;
      }
      const prizes = [];
      const N = def.prizes || 6, kinds = [KINDS[4], ...Array.from({ length: N - 1 }, (_, i) => KINDS[i % 4])];
      for (const kind of kinds) { // spread on the pile, not too close to one another or the chute
        let x, z, tries = 0;
        do { x = BOX[0] + .3 + Math.random() * (BOX[2] - BOX[0] - .6); z = BOX[1] + .3 + Math.random() * (BOX[3] - BOX[1] - .6); tries++; }
        while (tries < 60 && (prizes.some(p => Math.hypot(p.x - x, p.z - z) < .46) || Math.hypot(x - CH[0], z - CH[1]) < .6));
        const n = plush(kind); n.position.set(x, FLOOR + R, z); n.rotation.y = (Math.random() - .5) * .8;
        prizes.push({ kind, n, x, z, y: FLOOR + R, st: 'pile', vy: 0 });
      }
      // the chute: a glowing frame in the front corner
      const chute = B.MeshBuilder.CreateTorus('clawChute', { diameter: .62, thickness: .05, tessellation: 4 }, scene); chute.rotation.y = Math.PI / 4; chute.position.set(CH[0], FLOOR - .1, CH[1]); chute.material = M.rim; chute.isPickable = false; ctx.add(chute);
      const hole = B.MeshBuilder.CreateDisc('clawHole', { radius: .3, tessellation: 4 }, scene); hole.rotation.set(Math.PI / 2, 0, Math.PI / 4); hole.position.set(CH[0], FLOOR - .09, CH[1]); hole.material = M.dark; hole.isPickable = false; ctx.add(hole);
      // the claw: a cable from the top, the hub, three prongs on pivots (open / closed)
      const head = new B.TransformNode('clawHead', scene); ctx.add(head);
      const cable = B.MeshBuilder.CreateCylinder('clawCable', { height: 1, diameter: .025, tessellation: 4 }, scene); cable.material = M.iron; cable.isPickable = false; ctx.add(cable);
      const hub = B.MeshBuilder.CreateCylinder('clawHub', { height: .16, diameter: .24, tessellation: 10 }, scene); hub.material = M.iron; hub.parent = head; hub.isPickable = false; ctx.add(hub);
      const prongs = [0, 1, 2].map(i => { const p = new B.TransformNode('clawPivot', scene); p.parent = head; p.rotation.y = i * Math.PI * 2 / 3; p.position.y = -.08;
        const arm = new B.TransformNode('clawArm', scene); arm.parent = p; arm.position.z = .1;
        const a = B.MeshBuilder.CreateBox('clawProng', { width: .035, height: .42, depth: .035 }, scene); a.material = M.iron; a.parent = arm; a.position.y = -.21; a.isPickable = false; ctx.add(a);
        const t = B.MeshBuilder.CreateBox('clawTip', { width: .035, height: .035, depth: .14 }, scene); t.material = M.iron; t.parent = arm; t.position.set(0, -.42, -.06); t.isPickable = false; ctx.add(t);
        return arm; });
      const setOpen = o => prongs.forEach(a => { a.rotation.x = .25 - .7 * o; }); // closed: the tips in under the hub; open: out
      // ── state ──
      const st = { phase: 'intro', wait: 1.3, tries: TRIES, t: SECS, x: (BOX[0] + BOX[2]) / 2, z: (BOX[1] + BOX[3]) / 2 + .3, y: TOP, open: 1, held: null, fate: null, won: [], score: 0, keys: {}, slipAt: 0, y0: 0 };
      const info = () => H.info(`Try ${Math.min(TRIES - st.tries + 1, TRIES)} / ${TRIES}${st.phase === 'aim' ? ' · ' + Math.ceil(st.t) + ' s' : ''}`);
      // the pads (phones): hold to steer, DROP
      const hud = document.getElementById('gameHud'), pads = document.createElement('div');
      pads.style.cssText = 'position:absolute;bottom:62px;left:50%;transform:translateX(-50%);display:grid;grid-template-columns:repeat(3,48px) 18px 86px;grid-template-rows:repeat(2,40px);gap:6px;pointer-events:auto';
      const mk = (txt, area, dir) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = txt; b.style.cssText = `grid-area:${area};border-radius:9px;border:1px solid #d8b35c;background:rgba(20,14,26,.82);color:#ffe9b0;font:700 18px Georgia,serif;cursor:pointer;touch-action:none`;
        if (dir) { const on = (v) => (e) => { e.preventDefault(); e.stopPropagation(); st.keys[dir] = v; }; b.onpointerdown = on(true); b.onpointerup = b.onpointerleave = b.onpointercancel = on(false); }
        else b.onclick = (e) => { e.stopPropagation(); b.blur(); drop(); };
        pads.appendChild(b); return b; };
      mk('↑', '1 / 2', 'up'); mk('←', '2 / 1', 'left'); mk('↓', '2 / 2', 'down'); mk('→', '2 / 3', 'right'); mk('DROP', '1 / 5 / 3 / 6');
      hud.appendChild(pads);
      function drop() { if (st.phase !== 'aim') return; st.phase = 'down'; ctx.sound('thock'); }
      function under() { let best = null, bd = 1e9; for (const p of prizes) { if (p.st !== 'pile') continue; const d = Math.hypot(p.x - st.x, p.z - st.z); if (d < bd) { bd = d; best = p; } } return best && bd < .26 ? { p: best, d: bd } : null; }
      const PA = def.playerAt || [6.75, BOX[3] + .75];
      ctx.player.place(PA[0], PA[1], Math.atan2((BOX[0] + BOX[2]) / 2 + .2 - PA[0], BOX[3] + .35 - PA[1]));
      const cam = def.cam || [(BOX[0] + BOX[2]) / 2, TOP + .8, BOX[3] + 2.7], at = def.at || [(BOX[0] + BOX[2]) / 2, FLOOR + .25, (BOX[1] + BOX[3]) / 2];
      ctx.look(cam, at, def.fov || .8);
      H.title(def.title || 'Claw Machine'); H.score(0); info();
      H.hint('Steer the claw: the arrows / <kbd>WASD</kbd> or the pads. <kbd>Space</kbd> or DROP to grab. Dead centre holds best.');
      H.msg(def.title || 'Claw Machine', 1400, `${TRIES} tries`);
      const place = () => { head.position.set(st.x, st.y, st.z); cable.scaling.y = Math.max(.05, TOP + .25 - st.y); cable.position.set(st.x, (TOP + .25 + st.y) / 2, st.z); setOpen(st.open); };
      place();
      const inst = {
        update(dt) {
          ctx.look(cam, at);
          if (st.phase === 'intro' && (st.wait -= dt) <= 0) { st.phase = 'aim'; st.t = SECS; }
          if (st.phase === 'aim') {
            const v = .9 * dt, K = st.keys;
            st.x = Math.max(BOX[0] + .1, Math.min(BOX[2] - .1, st.x + ((K.right ? 1 : 0) - (K.left ? 1 : 0)) * v));
            st.z = Math.max(BOX[1] + .1, Math.min(BOX[3] - .1, st.z + ((K.down ? 1 : 0) - (K.up ? 1 : 0)) * v));
            st.t -= dt; if (st.t <= 0) { H.msg('Time! It drops', 700); drop(); }
          } else if (st.phase === 'down') {
            const u = under(), stop = u ? u.p.y + .5 : FLOOR + .55;
            st.y -= 1.4 * dt; if (st.y <= stop) { st.y = stop; st.phase = 'close'; st.wait = .4; st.target = u; }
          } else if (st.phase === 'close') {
            st.open = Math.max(0, st.open - dt / .35);
            if ((st.wait -= dt) <= 0) {
              const u = st.target; st.held = null; st.fate = 'miss';
              if (u) { const c = Math.min(1, (1 - u.d / .26) * .8 + .3) * u.p.kind.grip, roll = Math.random(); st.fate = roll < c ? 'hold' : roll < c + .3 ? 'slip' : 'miss'; }
              if (st.fate !== 'miss') { st.held = u.p; u.p.st = 'held'; st.slipAt = TOP - (TOP - st.y) * (.25 + Math.random() * .5); }
              st.phase = 'up'; st.y0 = st.y;
            }
          } else if (st.phase === 'up') {
            st.y += 1.1 * dt;
            if (st.held && st.fate === 'slip' && st.y >= st.slipAt) { const p = st.held; p.st = 'fall'; p.vy = 0; p.x += (Math.random() - .5) * .2; p.z += (Math.random() - .5) * .2; st.held = null; H.msg('It slipped!', 800); ctx.sound('thock'); }
            if (st.y >= TOP) { st.y = TOP; st.phase = st.held ? 'carry' : 'reset'; st.wait = .6; if (!st.held) H.msg(st.fate === 'miss' ? 'Missed' : 'So close', 700); }
          } else if (st.phase === 'carry') {
            const dx = CH[0] - st.x, dz = CH[1] - st.z, d = Math.hypot(dx, dz), s = Math.min(d, .8 * dt);
            if (d > .01) { st.x += dx / d * s; st.z += dz / d * s; } else { st.phase = 'release'; st.wait = .7; const p = st.held; p.st = 'chute'; p.vy = 0; st.held = null; }
          } else if (st.phase === 'release') {
            st.open = Math.min(1, st.open + dt / .3);
            if ((st.wait -= dt) <= 0) st.phase = 'reset';
          } else if (st.phase === 'reset') {
            st.open = Math.min(1, st.open + dt / .3);
            const hx = (BOX[0] + BOX[2]) / 2, hz = (BOX[1] + BOX[3]) / 2 + .3, dx = hx - st.x, dz = hz - st.z, d = Math.hypot(dx, dz), s = Math.min(d, 1.2 * dt);
            if (d > .01) { st.x += dx / d * s; st.z += dz / d * s; }
            else { st.tries--; if (st.tries <= 0 || !prizes.some(p => p.st === 'pile')) { st.phase = 'end'; st.wait = 1.2; } else { st.phase = 'aim'; st.t = SECS; } info(); }
          }
          // what the claw holds hangs under it; a slipped one falls back; a released one drops down the chute
          for (const p of prizes) {
            if (p.st === 'held') { p.x = st.x; p.z = st.z; p.y = st.y - .5; }
            else if (p.st === 'fall') { p.vy -= 9.8 * dt; p.y += p.vy * dt; if (p.y <= FLOOR + R) { p.y = FLOOR + R; p.st = 'pile'; } }
            else if (p.st === 'chute') { p.vy -= 9.8 * dt; p.y += p.vy * dt; p.x += (CH[0] - p.x) * Math.min(1, dt * 8); p.z += (CH[1] - p.z) * Math.min(1, dt * 8);
              if (p.y < FLOOR - .9) { p.st = 'won'; p.n.setEnabled(false); st.won.push(p.kind.name); st.score += p.kind.pts; H.score(st.score); H.msg(`You won the ${p.kind.name}!`, 1300, `+${p.kind.pts}`); ctx.sound(p.kind.id === 'lucky' ? 'gamewin' : 'wish'); } }
            p.n.position.set(p.x, p.y, p.z);
          }
          place(); if (st.phase === 'aim') info();
          if (st.phase === 'end' && (st.wait -= dt) <= 0) {
            st.phase = 'done'; H.hint(''); pads.remove();
            if (st.score >= (def.pass || 0) && st.score > 0) ctx.sound('gamewin');
            ctx.finish({ score: st.score, label: 'points', extra: st.won.length ? `Won: ${st.won.join(', ')}.` : 'Nothing this time. The claw is always looser on the next go.' });
          }
        },
        key(e, down) {
          const k = e.key.toLowerCase(), map = { arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right', arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down' };
          if (map[k]) { st.keys[map[k]] = !!down; return; }
          if (down && !e.repeat && (k === ' ' || k === 'enter')) drop();
        },
        pointer() {},
        _test: { st, prizes, drop, under },
        dispose() { pads.remove(); ownClaw.forEach(n => n.setEnabled(true)); }
      };
      return inst;
    }
  };
  window.RebelGames.register('claw', G);
})();
