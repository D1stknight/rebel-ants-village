// Bowling (Oct 15): the Saints Game Hall, its lane by the DJ booth (room coordinates: the pins and the purple ball are
// room parts on that lane, room_sl_pin / room_sl_ball). Ten frames scored the real way (strikes, spares, the tenth).
// Each roll: A / D (or the arrows) move along the line while the arrow on the lane swings; Space, O, Enter or a click
// sets the aim, then the power, then the spin. The pins are circles on the lane, no physics engine: a ball or pin that
// hits a standing pin hard enough tips it over, a fallen pin slides on and keeps knocking, pins off the deck are gone.
(function () {
  const SP = .28, ROW = .485, PIN_R = .15, BALL_R = .22, FALL_V = 1.2, BALL_M = 4.5, PIN_M = 1;
  // the pin deck, front pin first: rows of 1, 2, 3, 4 (lane-local x, z; the lane runs toward -z)
  function rack(L) { const out = []; for (let b = 0; b < 4; b++) for (let a = -b; a <= b; a += 2) out.push({ x: L.x + a * SP, z: L.head - b * ROW }); return out; }
  function makeSim(L, rnd = Math.random) {
    const pins = rack(L).map((r, i) => ({ i, rx: r.x, rz: r.z, x: r.x, z: r.z, vx: 0, vz: 0, st: 'up', fx: 0, fz: 1, ft: 0 }));
    const ball = { x: L.x, z: L.foul, vx: 0, vz: 0, spin: 0, st: 'held', y: BALL_R + L.top, rot: 0 };
    const sim = { pins, ball, hits: 0, firstHit: false, upAtRoll: 10,
      rack() { for (const p of pins) Object.assign(p, { x: p.rx + (rnd() - .5) * .02, z: p.rz + (rnd() - .5) * .02, vx: 0, vz: 0, st: 'up', ft: 0 }); },
      sweep() { for (const p of pins) { if (p.st !== 'up') p.st = 'gone'; p.vx = p.vz = 0; } },
      roll(x, angle, speed, spin) { Object.assign(ball, { x, z: L.foul - .3, vx: Math.sin(angle) * speed, vz: -Math.cos(angle) * speed, spin, st: 'rolling', y: BALL_R + L.top }); sim.hits = 0; sim.firstHit = false; sim.upAtRoll = sim.standing(); },
      standing() { return pins.filter(p => p.st === 'up').length; },
      knocked() { return sim.upAtRoll - sim.standing(); },
      moving() { return ball.st === 'rolling' || ball.st === 'gutter' || pins.some(p => p.st !== 'gone' && (p.st === 'falling' || Math.hypot(p.vx, p.vz) > .03)); },
      step(dt) {
        if (ball.st === 'rolling' || ball.st === 'gutter') {
          const sp = Math.hypot(ball.vx, ball.vz);
          // the spin bends the line past the first 45 % of the lane, less as the ball slows
          if (ball.st === 'rolling' && ball.z < L.foul - .45 * (L.foul - L.head) && sp > 1) ball.vx += ball.spin * 2.1 * dt * Math.min(1, sp / 8);
          const k = Math.max(0, 1 - .03 * dt); ball.vx *= k; ball.vz *= k;
          ball.x += ball.vx * dt; ball.z += ball.vz * dt; ball.rot += sp * dt / BALL_R;
          if (ball.st === 'rolling' && Math.abs(ball.x - L.x) > L.half - .02) { ball.st = 'gutter'; ball.x = L.x + Math.sign(ball.x - L.x) * (L.half + .14); ball.vx = 0; ball.y = L.top + BALL_R - .16; }
          if (ball.z < L.pit - .25) ball.st = 'gone';
        }
        for (const p of pins) {
          if (p.st === 'gone') continue;
          const sp = Math.hypot(p.vx, p.vz);
          if (sp > 0) { const k = Math.max(0, sp - (p.st === 'up' ? 9 : 2.4) * dt) / sp; p.vx *= k; p.vz *= k; }
          p.x += p.vx * dt; p.z += p.vz * dt;
          if (p.st === 'falling') { p.ft = Math.min(1, p.ft + dt / .3); if (p.ft >= 1) p.st = 'down'; }
          if (p.z < L.pit + .05 || Math.abs(p.x - L.x) > L.half + .05) p.st = 'gone';
        }
        // contacts: the ball, a standing pin (one circle), a tipping or fallen pin (its base and its head end)
        const bodies = [];
        if (ball.st === 'rolling') bodies.push({ o: ball, m: BALL_M, c: [[0, 0, BALL_R]], ball: true });
        for (const p of pins) if (p.st !== 'gone') bodies.push({ o: p, m: PIN_M, c: p.st === 'up' ? [[0, 0, PIN_R]] : [[0, 0, .12], [p.fx * .5 * p.ft, p.fz * .5 * p.ft, .1]] });
        for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
          const A = bodies[i], Bd = bodies[j];
          for (const ca of A.c) for (const cb of Bd.c) {
            const dx = (Bd.o.x + cb[0]) - (A.o.x + ca[0]), dz = (Bd.o.z + cb[1]) - (A.o.z + ca[1]), d = Math.hypot(dx, dz), r = ca[2] + cb[2];
            if (d >= r || d < 1e-6) continue;
            const nx = dx / d, nz = dz / d, ia = 1 / A.m, ib = 1 / Bd.m, sum = ia + ib, pen = r - d;
            A.o.x -= nx * pen * ia / sum; A.o.z -= nz * pen * ia / sum; Bd.o.x += nx * pen * ib / sum; Bd.o.z += nz * pen * ib / sum;
            const rv = (Bd.o.vx - A.o.vx) * nx + (Bd.o.vz - A.o.vz) * nz;
            if (rv < 0) {
              const e = (A.ball || Bd.ball ? .45 : .3) + (rnd() - .5) * .12, jn = -(1 + e) * rv / sum;
              A.o.vx -= jn * ia * nx; A.o.vz -= jn * ia * nz; Bd.o.vx += jn * ib * nx; Bd.o.vz += jn * ib * nz;
              sim.hits++; if (A.ball || Bd.ball) sim.firstHit = true;
            }
          }
        }
        for (const p of pins) if (p.st === 'up') { const sp = Math.hypot(p.vx, p.vz); if (sp > FALL_V) { p.st = 'falling'; p.fx = p.vx / sp; p.fz = p.vz / sp; p.ft = 0; } }
      }
    };
    sim.rack();
    return sim;
  }

  // the score of a list of rolls: per frame { marks: ['X'] | ['7', '/'] | ..., total (running) or null while open }
  const mk = n => (n === 0 ? '-' : String(n));
  function scoreFrames(rolls) {
    const out = []; let i = 0, run = 0;
    for (let f = 0; f < 10; f++) {
      const r = rolls.slice(i);
      if (!r.length) { out.push({ marks: [], total: null }); continue; }
      let marks, val = null, used;
      if (f < 9) {
        if (r[0] === 10) { marks = ['X']; used = 1; if (r.length >= 3) val = 10 + r[1] + r[2]; }
        else if (r.length < 2) { marks = [mk(r[0])]; used = 1; }
        else if (r[0] + r[1] === 10) { marks = [mk(r[0]), '/']; used = 2; if (r.length >= 3) val = 10 + r[2]; }
        else { marks = [mk(r[0]), mk(r[1])]; used = 2; val = r[0] + r[1]; }
      } else {
        marks = [r[0] === 10 ? 'X' : mk(r[0])]; used = r.length;
        if (r.length > 1) marks.push(r[0] === 10 ? (r[1] === 10 ? 'X' : mk(r[1])) : (r[0] + r[1] === 10 ? '/' : mk(r[1])));
        if (r.length > 2) marks.push(r[0] === 10 && r[1] !== 10 ? (r[1] + r[2] === 10 ? '/' : mk(r[2])) : (r[2] === 10 ? 'X' : mk(r[2])));
        const done = r.length >= 3 || (r.length === 2 && r[0] + r[1] < 10);
        if (done) val = r.slice(0, 3).reduce((a, b) => a + b, 0);
      }
      i += used;
      if (val != null && (out.length === 0 || out[out.length - 1].total != null)) { run += val; out.push({ marks, total: run }); } else out.push({ marks, total: null });
    }
    return out;
  }
  function cardHtml(frames, cur) {
    const cell = (f, i) => `<td class="${i === cur ? 'cur' : ''}"><div class="m">${f.marks.map(m => `<span>${m}</span>`).join('') || '&nbsp;'}</div><div class="t">${f.total ?? ''}</div></td>`;
    return `<style>#gameHud .bw-card{border-collapse:collapse;background:rgba(10,13,22,.86);border:1px solid rgba(216,179,92,.55);border-radius:8px;overflow:hidden;font:600 13px Georgia,serif}
#gameHud .bw-card th{font:600 10px ui-monospace,monospace;color:#d8b35c;padding:3px 0 1px;border-right:1px solid rgba(216,179,92,.25);min-width:34px}
#gameHud .bw-card td{border-right:1px solid rgba(216,179,92,.25);border-top:1px solid rgba(216,179,92,.25);padding:2px 3px;text-align:center;min-width:34px;vertical-align:top}
#gameHud .bw-card td.cur{background:rgba(216,179,92,.16)}
#gameHud .bw-card .m{display:flex;justify-content:flex-end;gap:3px;min-height:15px;color:#ffe9b0;font-size:12px}
#gameHud .bw-card .t{font-size:14px;color:#fff;min-height:17px;font-variant-numeric:tabular-nums}</style>
<table class="bw-card"><tr>${frames.map((_, i) => `<th>${i + 1}</th>`).join('')}</tr><tr>${frames.map(cell).join('')}</tr></table>`;
  }

  const G = {
    title: 'Bowling',
    makeSim, scoreFrames, // tests
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, def = ctx.def, H = ctx.HUD, U = ctx.util;
      const L = { x: -5.675, foul: 3.6, head: -9.6, half: .975, pit: -11.6, top: .05, ...(def.lane || {}) };
      const sim = makeSim(L);
      // the room's own pins and ball on this lane (moved by the game, put back after); a lane without them gets its own
      const holder = ctx.frame.parent;
      const near = (n, x, z) => Math.hypot(n.position.x - x, n.position.z - z) < .3;
      const parts = holder ? holder.getChildren(n => /_room_sl_pin$/.test(n.name), false) : [];
      const pinNodes = sim.pins.map(p => {
        const own = parts.find(n => near(n, p.rx, p.rz));
        const n = own ? ctx.movable(own) : ctx.kit('room_sl_pin');
        return { n, own: !!own, rest: own ? { p: own.position.clone(), r: own.rotation.clone() } : null };
      });
      const ballPart = holder ? holder.getChildren(n => /_room_sl_ball$/.test(n.name), false)[0] : null;
      const ballNode = ballPart ? ctx.movable(ballPart) : ctx.kit('room_sl_ball');
      const ballRest = ballPart ? { p: ballPart.position.clone(), r: ballPart.rotation.clone(), q: ballPart.rotationQuaternion?.clone() } : null;
      ballNode.rotationQuaternion = B.Quaternion.Identity();
      // the aim arrow on the lane (flat, glowing)
      const arrowMat = ctx.mat('arrow', n => { const m = new B.StandardMaterial(n, ctx.scene); m.disableLighting = true; m.emissiveColor = new B.Color3(1, .82, .35); m.alpha = .75; m.backFaceCulling = false; return m; });
      const arrow = new B.TransformNode('bowlAim', ctx.scene); ctx.add(arrow);
      const shaft = B.MeshBuilder.CreatePlane('bowlAimShaft', { width: .09, height: 2.2 }, ctx.scene); shaft.rotation.x = Math.PI / 2; shaft.position.set(0, 0, -1.1); shaft.parent = arrow; shaft.material = arrowMat; shaft.isPickable = false;
      const head = B.MeshBuilder.CreateDisc('bowlAimHead', { radius: .22, tessellation: 3 }, ctx.scene); head.rotation.set(Math.PI / 2, 0, Math.PI / 2); head.position.set(0, 0, -2.3); head.parent = arrow; head.material = arrowMat; head.isPickable = false;
      ctx.add(shaft); ctx.add(head);
      const state = { relPos: null, phase: 'intro', t: 0, off: 0, ang: 0, power: 0, spin: 0, rolls: [], frame: 0, k: 0, wait: 0, keys: {}, camP: null, camT: null, release: 0, gutterShown: false, frameRolls: [], crashIn: 0 };
      const Y = new V3(0, 1, 0), qTmp = new B.Quaternion();
      function syncPins() {
        for (let i = 0; i < sim.pins.length; i++) {
          const p = sim.pins[i], pn = pinNodes[i].n;
          if (p.st === 'gone') { pn.setEnabled(false); continue; }
          pn.setEnabled(true);
          const a = p.st === 'up' ? 0 : (Math.PI / 2) * (p.st === 'down' ? 1 : p.ft * p.ft);
          pn.position.set(p.x, L.top + .12 * Math.sin(a), p.z);
          const up = new V3(Math.sin(a) * p.fx, Math.cos(a), Math.sin(a) * p.fz);
          B.Quaternion.FromUnitVectorsToRef(Y, up, qTmp); pn.rotationQuaternion = (pn.rotationQuaternion || new B.Quaternion()).copyFrom(qTmp);
        }
      }
      function syncBall(dtRot) {
        const b = sim.ball;
        if (state.phase === 'aim' || state.phase === 'power' || state.phase === 'spin' || state.phase === 'throw') {
          // held at the right hand (a rig), else beside the Rebel at hip height
          const hand = ctx.player.bone('RightHand');
          const w = hand ? hand.add(new V3(0, -.28, 0)) : null;
          const loc = w ? ctx.toLocal(w) : new V3(L.x + state.off + .75, 1.2, L.foul + 1.2);
          ballNode.position.copyFrom(loc);
          return;
        }
        ballNode.setEnabled(b.st !== 'gone');
        ballNode.position.set(b.x, b.y, b.z);
        if (state.relPos) { const u = state.phase === 'roll' ? Math.min(1, state.t / .18) : 1; if (u >= 1) state.relPos = null; else ballNode.position = V3.Lerp(state.relPos, ballNode.position, u * u * (3 - 2 * u)); }
        const sp = Math.hypot(b.vx, b.vz);
        if (sp > .01 && dtRot > 0) { const axis = V3.Cross(Y, new V3(b.vx, 0, b.vz)).normalize(); const dq = B.Quaternion.RotationAxis(axis, sp * dtRot / BALL_R); ballNode.rotationQuaternion = dq.multiply(ballNode.rotationQuaternion); }
      }
      function camTo(p, t, dt, k = 5) {
        if (!state.camP || !dt) { state.camP = new V3(...p); state.camT = new V3(...t); }
        else { const f = 1 - Math.exp(-k * dt); state.camP = V3.Lerp(state.camP, new V3(...p), f); state.camT = V3.Lerp(state.camT, new V3(...t), f); }
        ctx.look([state.camP.x, state.camP.y, state.camP.z], [state.camT.x, state.camT.y, state.camT.z], .82);
      }
      function setStand() { ctx.player.place(L.x + state.off, L.foul + 1.25, Math.PI); }
      function refreshCard() {
        const frames = scoreFrames(state.rolls); H.card(cardHtml(frames, state.frame));
        const last = [...frames].reverse().find(f => f.total != null); H.score(last ? last.total : 0);
        H.info(state.frame < 10 ? `Frame ${state.frame + 1} · ball ${state.k + 1}` : 'Final');
      }
      // step buttons for phones (Oct 24): held like A / D to move along the foul line while aiming (a tap anywhere else
      // sets the aim, the power and the spin, as before)
      const pads = document.createElement('div');
      pads.style.cssText = 'position:absolute;bottom:62px;left:16px;display:none;gap:8px;pointer-events:auto;touch-action:none';
      [['\u2190', 'a'], ['\u2192', 'd']].forEach(([t, k]) => {
        const b = document.createElement('button'); b.type = 'button'; b.textContent = t;
        b.style.cssText = 'width:56px;height:48px;border-radius:10px;border:1px solid #b08cff;background:rgba(22,12,40,.86);color:#f1e8ff;font:700 20px system-ui,sans-serif;cursor:pointer;touch-action:none';
        const on = (v) => (e) => { e.preventDefault(); e.stopPropagation(); state.keys[k] = v; };
        b.onpointerdown = on(true); b.onpointerup = b.onpointerleave = b.onpointercancel = on(false); pads.appendChild(b);
      });
      document.getElementById('gameHud').append(pads);
      let padsOn = false;
      const showPads = (on) => { if (on === padsOn) return; padsOn = on; pads.style.display = on ? 'flex' : 'none'; if (!on) state.keys.a = state.keys.d = false; };
      function beginAim() {
        state.phase = 'aim'; state.t = 0; arrow.setEnabled(true); ballNode.setEnabled(true); setStand(); ctx.player.idle();
        if (state.hidden) { state.hidden = false; ctx.player.show(true); }
        H.hint('<kbd>A</kbd> <kbd>D</kbd> move along the line · <kbd>Space</kbd>, <kbd>O</kbd> or click: set the aim'); H.meter(null); refreshCard();
      }
      function lock() {
        if (state.phase === 'aim') { state.phase = 'power'; state.t = 0; H.hint('<kbd>Space</kbd> or click: set the power'); }
        else if (state.phase === 'power') { state.phase = 'spin'; state.t = 0; H.hint('<kbd>Space</kbd> or click: set the spin (the middle rolls straight)'); }
        else if (state.phase === 'spin') {
          state.phase = 'throw'; state.t = 0; H.meter(null); H.hint(''); arrow.setEnabled(false);
          // the games pack's throwing move (Oct 17, Miguel: "throwing which is the same motion as bowling") is the
          // delivery: a step, the backswing and the low swing forward, the ball leaving the hand 1.03 s in as it sweeps
          // forward fastest (measured on the clip); a pack without it reaches low (the pick-up, the hand by the floor at
          // 0.66 s); without a pack a punch stands in
          if (ctx.player.has?.('game_bowl')) { ctx.player.clip('game_bowl', { hold: true }); state.release = 1.03; }
          else if (ctx.player.has?.('game_pick_up')) { ctx.player.clip('game_pick_up', { hold: true }); state.release = .66; }
          else { ctx.player.clip('cross_punch'); state.release = .32; }
        }
      }
      function afterRoll() {
        const n = sim.knocked(); state.rolls.push(n); state.frameRolls.push(n);
        const f = state.frame, fr = state.frameRolls;
        let msg = '', sub = '', next = 'same';
        const strike = fr.length === 1 ? n === 10 : (f === 9 && ((fr.length === 2 && fr[0] === 10 && fr[1] === 10) || (fr.length === 3 && fr[2] === 10 && (fr[1] === 10 || fr[0] + fr[1] === 10))));
        const spare = !strike && fr.length >= 2 && ((f < 9 && fr[0] + fr[1] === 10) || (f === 9 && ((fr.length === 2 && fr[0] !== 10 && fr[0] + fr[1] === 10) || (fr.length === 3 && fr[0] === 10 && fr[1] !== 10 && fr[1] + fr[2] === 10))));
        if (strike) { msg = 'STRIKE!'; sub = 'X'; ctx.event('strike'); ctx.sound('gamewin'); }
        else if (spare) { msg = 'SPARE!'; sub = '/'; ctx.event('spare'); }
        else if (n === 0) msg = sim.ball.st === 'gutter' || state.gutterShown ? 'Gutter ball' : 'Missed';
        else msg = n === 1 ? '1 pin' : `${n} pins`;
        if (f < 9) next = (fr.length === 1 && n === 10) || fr.length === 2 ? 'frame' : 'sweep';
        else {
          const [a, b] = fr;
          if (fr.length === 1) next = a === 10 ? 'rack' : 'sweep';
          else if (fr.length === 2) next = a === 10 ? (b === 10 ? 'rack' : 'sweep') : (a + b === 10 ? 'rack' : 'end');
          else next = 'end';
        }
        H.msg(msg, 1500, sub);
        state.phase = 'show'; state.wait = 1.6; state.next = next;
        refreshCard();
      }
      function advance() {
        const nx = state.next;
        if (nx === 'frame') { state.frame++; state.k = 0; state.frameRolls = []; if (state.frame >= 10) return finish(); sim.rack(); }
        else if (nx === 'sweep') { state.k++; sim.sweep(); }
        else if (nx === 'rack') { state.k++; sim.rack(); }
        else if (nx === 'end') { state.frame = 10; return finish(); }
        state.gutterShown = false;
        syncPins(); beginAim();
      }
      function finish() {
        state.phase = 'done'; refreshCard(); H.hint('');
        const frames = scoreFrames(state.rolls), total = frames[9]?.total ?? 0;
        const strikes = state.rolls.filter((r, i) => r === 10).length;
        ctx.finish({ score: total, label: 'pins', extra: strikes ? `${strikes} strike${strikes > 1 ? 's' : ''}.` : '' });
      }
      // the start: a look down the lane, then the first ball
      H.title(def.title || 'Bowling');
      sim.rack(); syncPins(); refreshCard();
      state.phase = 'intro'; state.wait = 1.2; setStand(); arrow.setEnabled(false);
      H.msg('Bowling', 1200, 'Ten frames');
      const inst = {
        update(dt) {
          state.t += dt;
          const ph = state.phase;
          showPads(ph === 'aim');
          if (ph === 'intro') { camTo([L.x + 1.2, 3.2, L.foul + 4.6], [L.x, .4, L.head], dt, 2.5); if ((state.wait -= dt) <= 0) beginAim(); }
          if (ph === 'aim' || ph === 'power' || ph === 'spin') {
            if (ph === 'aim') {
              const dir = (state.keys.d || state.keys.arrowright ? 1 : 0) - (state.keys.a || state.keys.arrowleft ? 1 : 0);
              if (dir) { state.off = U.clamp(state.off + dir * 1.1 * dt, -.7, .7); setStand(); }
              state.ang = Math.sin(state.t * 2 * Math.PI / 2.4) * 5 * Math.PI / 180;
            }
            if (ph === 'power') { state.power = U.pingPong(state.t, .85); H.meter({ label: 'Power', fill: state.power, value: state.power }); }
            if (ph === 'spin') { state.spin = U.pingPong(state.t, .7) * 2 - 1; H.meter({ label: 'Spin', value: (state.spin + 1) / 2, zone: [.44, .56] }); }
            arrow.position.set(L.x + state.off, L.top + .015, L.foul - .25); arrow.rotation.y = state.ang;
            camTo([L.x + state.off + 1.9, 5.6, L.foul + 7.4], [L.x + state.off * .3, 0, L.head + 2.5], dt);
          }
          if (ph === 'throw') {
            camTo([L.x + state.off + 1.9, 5.6, L.foul + 7.4], [L.x + state.off * .3, 0, L.head + 2.5], dt);
            if ((state.release -= dt) <= 0) {
              const speed = 6.5 + 6 * state.power, spin = Math.abs(state.spin) < .12 ? 0 : state.spin;
              state.relPos = ballNode.position.clone(); // where the hand lets go: the ball drops from there onto the lane
              sim.roll(L.x + state.off, state.ang, speed, spin); state.phase = 'roll'; state.t = 0; ctx.sound('bowlroll');
            }
          }
          if (ph === 'roll') {
            const steps = Math.max(1, Math.round(dt * 240)), h = dt / steps;
            const hadHit = sim.firstHit;
            for (let s = 0; s < steps; s++) sim.step(h);
            // the crash a moment after the ball meets the pins: big when most of them are going down
            if (!hadHit && sim.firstHit) state.crashIn = .2;
            if (state.crashIn > 0 && (state.crashIn -= dt) <= 0) ctx.sound(sim.knocked() >= 5 ? 'pins' : 'pinsfew');
            if (sim.ball.st === 'gutter' && !state.gutterShown) { state.gutterShown = true; ctx.sound('gutter'); }
            const b = sim.ball;
            // the camera follows the ball down the lane, through where the Rebel stands: the Rebel steps out of the picture
            if (state.t > .25 && !state.hidden) { state.hidden = true; ctx.player.show(false); }
            if (b.z > L.head + 5.2 && b.st !== 'gone') camTo([b.x * .5 + L.x * .5 + .8, 1.7, b.z + 4.4], [b.x, .4, b.z - 5], dt, 6);
            else camTo([L.x + .6, 2.7, L.head + 5.4], [L.x, .3, L.head - .8], dt, 3);
            if ((b.st === 'gone' || state.t > 7) && !sim.moving()) { state.wait = (state.wait || 0) + dt; if (state.wait > .7 || state.t > 9) { state.wait = 0; afterRoll(); } }
            else state.wait = 0;
          }
          if (ph === 'show') { camTo([L.x + .6, 2.7, L.head + 5.4], [L.x, .3, L.head - .8], dt, 3); if ((state.wait -= dt) <= 0) advance(); }
          syncPins(); syncBall(ph === 'roll' ? dt : 0);
        },
        key(e, down) {
          const k = e.key.toLowerCase(); state.keys[k] = down;
          if (down && !e.repeat && (k === ' ' || k === 'o' || k === 'enter')) lock();
        },
        pointer(evt) { if (evt.type === B.PointerEventTypes.POINTERDOWN) lock(); },
        _test: { state, sim, lock, ballNode }, // headless tests drive the rolls
        dispose() {
          pads.remove();
          pinNodes.forEach(({ n, own, rest }) => { if (!own) return; n.setEnabled(true); n.position.copyFrom(rest.p); n.rotationQuaternion = null; n.rotation.copyFrom(rest.r); });
          if (ballPart && ballRest) { ballPart.setEnabled(true); ballPart.position.copyFrom(ballRest.p); ballPart.rotationQuaternion = ballRest.q || null; if (!ballRest.q) ballPart.rotation.copyFrom(ballRest.r); }
        }
      };
      return inst;
    }
  };
  if (window.RebelGames) window.RebelGames.register('bowling', G);
  else if (typeof module !== 'undefined') module.exports = G;
})();
