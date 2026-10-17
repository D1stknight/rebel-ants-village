// Water Bowl (Oct 15, Sohei): a roam game (you walk with the normal walk and the camera follows). Carry a full bowl of
// water from the well up to the bell. The bowl tips when you start, stop, turn hard, run or take a step up; hold it
// level with Q and E (or the pads) as it leans. Water past the rim is lost. Arrive in time with as much as you can.
// Score: the water you bring (100 = not a drop lost), with a little for time to spare.
// def: { goal: [x, z], seconds (90), medals: [gold, silver, bronze] scores, text, goalName ('the bell') }
(function () {
  const G = {
    title: 'Water Bowl', roam: true,
    start(ctx) {
      const B = ctx.B, H = ctx.HUD, scene = ctx.scene, def = ctx.def, V3 = B.Vector3;
      const goal = { x: +(def.goal?.[0] ?? 0), z: +(def.goal?.[1] ?? 30) }, SECS = def.seconds || 90, med = def.medals || [85, 70, 50], [gold, silver, bronze] = med;
      const goalName = def.goalName || 'the bell', RIM = .34;
      const st = { phase: 'count', t: 3.4, said: '', el: 0, water: 100, th: 0, w: 0, inQ: 0, inE: 0, last: null, lastYaw: null, lastV: 0, spill: 0, ph: Math.random() * 6 };
      goal.y = ctx.ground(goal.x, goal.z);
      const nodes = [], keep = n => { ctx.add(n); n.parent = null; nodes.push(n); if (n.isPickable !== undefined) n.isPickable = false; return n; };
      const ringM = ctx.mat('wbRing', n => { const m = new B.StandardMaterial(n, scene); m.disableLighting = true; m.emissiveColor = new B.Color3(.55, .85, 1); m.alpha = .7; m.alphaMode = B.Engine.ALPHA_ADD; m.backFaceCulling = false; return m; });
      const ring = keep(B.MeshBuilder.CreateTorus('wbGoal', { diameter: 4.4, thickness: .14, tessellation: 48 }, scene)); ring.material = ringM; ring.position.set(goal.x, goal.y + .12, goal.z);
      const beam = keep(B.MeshBuilder.CreateCylinder('wbBeam', { height: 9, diameterTop: .3, diameterBottom: .9, tessellation: 14, cap: B.Mesh.NO_CAP }, scene)); beam.material = ringM; beam.position.set(goal.x, goal.y + 4.5, goal.z);
      // the bowl over the view: it leans with the water inside; drops fly off the rim when it spills
      const hud = document.getElementById('gameHud'), box = document.createElement('div');
      box.style.cssText = 'position:absolute;left:50%;bottom:76px;transform:translateX(-50%);width:230px;text-align:center;pointer-events:none';
      // the bowl (Oct 17, Miguel: "we need to make the water bowl look more realistic"): a red-lacquered temple bowl with a
      // gold lip and foot, a dark inside, the water deep blue at the bottom and pale at the top with a wave and a glint
      box.innerHTML = `<svg viewBox="-120 -70 240 137" width="230" height="131" style="overflow:visible"><defs>`
        + `<linearGradient id="wbLac" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2c0906"/><stop offset=".3" stop-color="#7c1f12"/><stop offset=".52" stop-color="#b8402a"/><stop offset=".78" stop-color="#6a170c"/><stop offset="1" stop-color="#220704"/></linearGradient>`
        + `<linearGradient id="wbIn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#160806"/><stop offset="1" stop-color="#3b140c"/></linearGradient>`
        + `<linearGradient id="wbWater" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a6e4ff"/><stop offset=".18" stop-color="#4caede"/><stop offset="1" stop-color="#16507e"/></linearGradient>`
        + `<linearGradient id="wbGold" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8a6420"/><stop offset=".5" stop-color="#f2cf73"/><stop offset="1" stop-color="#8a6420"/></linearGradient>`
        + `<radialGradient id="wbDrop" cx=".35" cy=".35" r=".7"><stop offset="0" stop-color="#f2fbff"/><stop offset=".5" stop-color="#7cc8f0"/><stop offset="1" stop-color="#2a78b0"/></radialGradient>`
        + `<clipPath id="wbClip"><path d="M-92 -18 Q-88 44 0 48 Q88 44 92 -18 Z"/></clipPath></defs><g class="wb-tilt">`
        + `<path d="M-92 -18 Q-88 44 0 48 Q88 44 92 -18 Z" fill="url(#wbIn)"/>`
        + `<g clip-path="url(#wbClip)"><g class="wb-water"><rect x="-140" y="-18" width="280" height="90" fill="url(#wbWater)" opacity=".93"/>`
        + `<path class="wb-wave" d="" fill="#d6f3ff" opacity=".8"/><ellipse class="wb-glint" cx="-28" cy="-11" rx="30" ry="2" fill="#fff" opacity=".5"/></g></g>`
        + `<path d="M-104 -22 Q-100 58 0 62 Q100 58 104 -22 L92 -18 Q88 44 0 48 Q-88 44 -92 -18 Z" fill="url(#wbLac)"/>`
        + `<path d="M-84 6 Q-72 40 -26 52" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".16"/>`
        + `<path d="M-34 58 L-30 65 L30 65 L34 58 Z" fill="url(#wbGold)"/><path d="M-104 -22 L-92 -18 M104 -22 L92 -18" stroke="url(#wbGold)" stroke-width="7" stroke-linecap="round"/>`
        + `<path d="M-103 -14 Q-99 52 0 56 Q99 52 103 -14" fill="none" stroke="#e9c46a" stroke-width="1.4" opacity=".55"/></g>`
        + `<g class="wb-drops"></g></svg><div class="wb-meter" style="margin:2px auto 0;width:200px;height:10px;border-radius:5px;background:rgba(10,12,20,.75);border:1px solid rgba(160,210,255,.5);overflow:hidden"><div class="wb-fill" style="height:100%;width:100%;background:linear-gradient(90deg,#3d9ad6,#9ad8ff)"></div></div>`
        + `<div style="display:flex;justify-content:center;gap:120px;margin-top:6px;pointer-events:auto"><button type="button" data-k="q" style="width:56px;height:42px;border-radius:10px;border:1px solid #9ad8ff;background:rgba(10,14,22,.85);color:#bfe6ff;font:800 18px system-ui;touch-action:manipulation">Q ⟲</button><button type="button" data-k="e" style="width:56px;height:42px;border-radius:10px;border:1px solid #9ad8ff;background:rgba(10,14,22,.85);color:#bfe6ff;font:800 18px system-ui;touch-action:manipulation">⟳ E</button></div>`;
      hud.append(box);
      const tiltG = box.querySelector('.wb-tilt'), waterG = box.querySelector('.wb-water'), dropsG = box.querySelector('.wb-drops'), fill = box.querySelector('.wb-fill');
      box.querySelectorAll('button').forEach(b => { const k = b.dataset.k; b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); st['in' + k.toUpperCase()] = 1; }); b.addEventListener('pointerup', () => { st['in' + k.toUpperCase()] = 0; }); b.addEventListener('pointerleave', () => { st['in' + k.toUpperCase()] = 0; }); });
      const drops = [];
      const wave = box.querySelector('.wb-wave'), glint = box.querySelector('.wb-glint');
      function drawBowl() {
        const deg = st.th * 57.3; tiltG.setAttribute('transform', `rotate(${deg.toFixed(1)})`);
        // the surface: a wave that runs with the slosh, the glint sliding on it
        const tt = performance.now() / 1000, A = 1.6 + Math.min(5, Math.abs(st.w) * 6); let d = 'M-140 -14';
        for (let x = -140; x <= 140; x += 14) d += ` L${x} ${(-18 + A * Math.sin(x / 26 + tt * 3.1 + st.th * 4) + .6 * Math.sin(x / 9 - tt * 5)).toFixed(1)}`;
        wave.setAttribute('d', d + ' L140 -12 L-140 -12 Z'); glint.setAttribute('cx', (-28 + 18 * Math.sin(tt * .9)).toFixed(1));
        // the water stays level (counter-rotated) and sinks as it is lost
        waterG.setAttribute('transform', `rotate(${(-deg).toFixed(1)}) translate(0 ${(70 * (1 - st.water / 100)).toFixed(1)})`);
        fill.style.width = st.water.toFixed(1) + '%';
      }
      function drip(side) { const d = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); d.setAttribute('r', 5.5); d.setAttribute('fill', 'url(#wbDrop)'); dropsG.appendChild(d); drops.push({ el: d, x: side * 98, y: -20, vx: side * (40 + Math.random() * 50), vy: -40 - Math.random() * 30, t: 0 }); }
      function finish(arrived) {
        if (st.phase === 'done') return; st.phase = 'done'; ctx.player.hold(false); beam.setEnabled(false);
        const left = Math.max(0, SECS - st.el), score = arrived ? Math.round(Math.min(100, st.water + left / SECS * 6)) : 0;
        const medal = score >= gold ? 'Gold' : score >= silver ? 'Silver' : score >= bronze ? 'Bronze' : null, lines = `Gold ${gold} · silver ${silver} · bronze ${bronze}.`;
        H.msg(arrived ? (medal ? medal + '!' : 'Arrived') : st.water <= 15 ? 'The bowl is empty' : 'Out of time', 1700, arrived ? `${Math.round(st.water)}% of the water` : '');
        ctx.finish({ score, passed: !!medal, label: 'water', kicker: arrived ? (medal ? medal + ' medal' : 'Arrived') : st.water <= 15 ? 'Spilled' : 'Out of time',
          extra: arrived ? `${Math.round(st.water)}% of the water reached ${goalName}${left > 1 ? `, ${Math.round(left)} s to spare` : ''}. ${medal === 'Gold' ? 'A steady hand. ' : 'Ease into a walk and lean against each turn. '}${lines}` : `Walk, do not run, and hold the bowl level with Q and E. ${lines}` });
      }
      ctx.player.hold(true);
      H.title(def.title || 'Water Bowl'); H.score('100%'); H.info(`To ${goalName} · ${SECS} s`);
      H.hint(`${def.text ? def.text + ' · ' : ''}Walk to ${goalName} · <kbd>Q</kbd> <kbd>E</kbd> keep the bowl level · running and steps make it slop`);
      drawBowl();
      return {
        update(dt) {
          const t = performance.now() / 1000, p = ctx.player.world();
          if (dt > 0) for (let i = drops.length - 1; i >= 0; i--) { const d = drops[i]; d.t += dt; d.vy += 300 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.el.setAttribute('cx', d.x.toFixed(1)); d.el.setAttribute('cy', d.y.toFixed(1)); d.el.setAttribute('opacity', Math.max(0, 1 - d.t * 1.5).toFixed(2)); if (d.t > .7) { d.el.remove(); drops.splice(i, 1); } }
          ring.scaling.setAll(1 + .05 * Math.sin(t * 4)); ringM.alpha = .55 + .15 * Math.sin(t * 4);
          if (st.phase === 'count') {
            st.t -= dt;
            const n = st.t > 2.4 ? '3' : st.t > 1.4 ? '2' : st.t > .4 ? '1' : 'Go!';
            if (n !== st.said) { st.said = n; H.msg(n, n === 'Go!' ? 700 : 900); ctx.note(n === 'Go!' ? 880 : 440, 'bell'); }
            if (st.t <= .4) { st.phase = 'run'; ctx.player.hold(false); st.last = { x: p.x, y: p.y, z: p.z }; st.lastYaw = null; }
            return;
          }
          if (st.phase !== 'run' || dt <= 0) return;
          st.el += dt;
          // what the walk does to the bowl: speeding up / slowing down tips it forward / back (shown as a side lean), a
          // hard turn throws it outward, a step up or down jolts it, running shakes it
          const L = st.last, vx = (p.x - L.x) / dt, vz = (p.z - L.z) / dt, v = Math.min(14, Math.hypot(vx, vz)), dv = (v - st.lastV) / dt, dyv = (p.y - L.y);
          const yaw = v > .4 ? Math.atan2(vx, vz) : st.lastYaw, turn = yaw != null && st.lastYaw != null ? Math.atan2(Math.sin(yaw - st.lastYaw), Math.cos(yaw - st.lastYaw)) / dt : 0;
          st.last = { x: p.x, y: p.y, z: p.z }; st.lastV = v; if (yaw != null) st.lastYaw = yaw;
          const run = ctx.player.running?.() || v > 5.5;
          let push = Math.max(-6, Math.min(6, dv)) * .045 + Math.max(-4, Math.min(4, turn)) * v * .05 + (Math.abs(dyv) > .06 ? Math.sign(Math.sin(st.el * 7)) * Math.min(1.6, Math.abs(dyv) * 9) : 0);
          const T = st.el; // game time: the slosh does not depend on the frame rate
          push += (run ? 2 : .35) * Math.min(1, v / 4) * Math.sin(T * (run ? 15 : 9) + Math.sin(T * 3.1) * 2);
          // the slosh: a slow wander that grows with speed (sines, so it is the same at any frame rate)
          push += (Math.sin(T * 5.3 + st.ph) * .5 + Math.sin(T * 8.7 + st.ph * 2) * .3 + Math.sin(T * 13.1 + st.ph * 3) * .2) * 2 * v / 4.2;
          // the bowl is a little top-heavy (left alone it tips over); Q / E push back (tuned in a sim: walking with
          // steady hands keeps ~80 %, running ~65 %, no hands spills it)
          const input = (st.inE ? 1 : 0) - (st.inQ ? 1 : 0);
          st.w += (push * 3 + st.th * .8 - st.w * 2 + input * 2) * dt;
          st.th += st.w * dt; st.th = Math.max(-.9, Math.min(.9, st.th));
          // past the rim it spills, faster the further it leans
          const over = Math.abs(st.th) - RIM;
          if (over > 0 && st.water > 0) { st.water = Math.max(0, st.water - over * 30 * dt); st.spill += dt; if (st.spill > .08) { st.spill = 0; drip(Math.sign(st.th)); } }
          drawBowl();
          H.score(Math.round(st.water) + '%');
          const dGoal = Math.hypot(goal.x - p.x, goal.z - p.z);
          H.info(`${Math.round(dGoal)} m to ${goalName} · ${Math.max(0, Math.ceil(SECS - st.el))} s${over > -.06 ? ' · careful!' : ''}`);
          if (dGoal < 2.2 && Math.abs(p.y - goal.y) < 2.5) { ctx.sound('chime'); finish(true); return; }
          if (st.water <= 15) { ctx.sound('splash'); finish(false); return; }
          if (st.el > SECS) finish(false);
        },
        key(e, down) { const k = e.key.toLowerCase(); if (k === 'q') { st.inQ = down ? 1 : 0; return true; } if (k === 'e') { st.inE = down ? 1 : 0; return true; } return false; },
        target() { return { x: goal.x, z: goal.z }; },
        _test: { st, goal, finish },
        dispose() { ctx.player.hold(false); box.remove(); nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); }
      };
    }
  };
  window.RebelGames.register('bowl', G);
})();
