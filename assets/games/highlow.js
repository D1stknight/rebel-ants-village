// High-Low (Oct 15): the dealer rolls a die; call whether the next roll is higher or lower (the buttons, the arrow keys or
// W / S). A tie is a push. Five right calls in a row wins the pot; twelve calls in all.
// def: { calls: 12, streak: 5, giver: npcId (the camera looks at them), pass (a streak to clear it), points }
(function () {
  const PIPS = { 1: [[.5, .5]], 2: [[.27, .27], [.73, .73]], 3: [[.27, .27], [.5, .5], [.73, .73]], 4: [[.27, .27], [.73, .27], [.27, .73], [.73, .73]],
    5: [[.27, .27], [.73, .27], [.5, .5], [.27, .73], [.73, .73]], 6: [[.27, .25], [.73, .25], [.27, .5], [.73, .5], [.27, .75], [.73, .75]] };
  const G = {
    title: 'High-Low',
    start(ctx) {
      const H = ctx.HUD, def = ctx.def, CALLS = def.calls || 12, WIN = def.streak || 5;
      const giver = def.giver && ctx.npc ? ctx.npc(def.giver) : null;
      let at = def.at || [0, 2, 5];
      // the Rebel a step to the left, the camera over the right shoulder on the giver's face (seen above the panel)
      ctx.player.place(-1.5, -.4, 0);
      if (giver) { const p = ctx.toLocal(giver.getAbsolutePosition()); at = [p.x, p.y + 2.6, p.z]; ctx.player.face(Math.atan2(p.x + 1.5, p.z + .4)); }
      const cam = def.cam || [1.2, 3.1, -2.4];
      ctx.look(cam, at, def.fov || .85);
      // the panel: the die, the calls, the streak
      const hud = document.getElementById('gameHud'), box = document.createElement('div');
      box.style.cssText = 'position:absolute;left:50%;top:auto;bottom:70px;transform:translateX(-50%);width:min(380px,90vw);background:rgba(10,13,22,.92);border:1px solid rgba(216,179,92,.7);border-radius:14px;padding:14px 16px;text-align:center;pointer-events:auto;box-shadow:0 10px 30px rgba(0,0,0,.5)';
      const cv = document.createElement('canvas'); cv.width = cv.height = 120; cv.style.cssText = 'width:96px;height:96px;display:block;margin:2px auto 10px';
      const line = document.createElement('div'); line.style.cssText = 'font:600 14px/1.4 Georgia,serif;color:#e9dcbc;margin-bottom:10px;min-height:20px';
      const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:10px;justify-content:center';
      const btn = (t) => { const b = document.createElement('button'); b.type = 'button'; b.innerHTML = t; b.style.cssText = 'flex:1;padding:10px 8px;border-radius:9px;border:1px solid #d8b35c;background:rgba(255,216,119,.08);color:#ffe9b0;font:700 15px Georgia,serif;cursor:pointer'; return b; };
      const hi = btn('Higher &uarr;'), lo = btn('Lower &darr;');
      row.append(hi, lo); box.append(cv, line, row); hud.appendChild(box);
      const st = { die: 1 + Math.floor(Math.random() * 6), calls: 0, streak: 0, best: 0, right: 0, phase: 'call', t: 0, call: null, next: 0 };
      function draw(n, glow) {
        const g = cv.getContext('2d'); g.clearRect(0, 0, 120, 120);
        g.fillStyle = '#f6efe0'; g.strokeStyle = glow || '#d8b35c'; g.lineWidth = 5;
        g.beginPath(); g.roundRect ? g.roundRect(8, 8, 104, 104, 18) : g.rect(8, 8, 104, 104); g.fill(); g.stroke();
        g.fillStyle = '#1e1a16'; for (const [x, y] of PIPS[n]) { g.beginPath(); g.arc(8 + x * 104, 8 + y * 104, 9.5, 0, Math.PI * 2); g.fill(); }
      }
      const info = () => H.info(`Call ${Math.min(st.calls + 1, CALLS)} / ${CALLS} · streak ${st.streak}`);
      function call(dir) {
        if (st.phase !== 'call') return;
        st.call = dir; st.phase = 'roll'; st.t = 0;
        let n = 1 + Math.floor(Math.random() * 6); st.next = n;
        ctx.sound('dice'); line.textContent = dir > 0 ? 'Higher…' : 'Lower…';
      }
      function settle() {
        const n = st.next, was = st.die; st.die = n; st.calls++;
        let txt, glow;
        if (n === was) { txt = `A ${n} again: a push.`; glow = '#cfd8e6'; }
        else if ((n > was) === (st.call > 0)) { st.streak++; st.right++; st.best = Math.max(st.best, st.streak); txt = `${n}! Right · streak ${st.streak}`; glow = '#7fe0a8'; H.score(st.best); ctx.sound(st.streak >= WIN ? 'gamewin' : 'thock'); }
        else { txt = `${n}. Wrong: the streak starts over.`; glow = '#e07f7f'; st.streak = 0; ctx.sound('thock'); }
        draw(n, glow); line.textContent = txt; info();
        if (st.streak >= WIN || st.calls >= CALLS) {
          st.phase = 'done';
          setTimeout(() => { box.remove(); H.hint(''); ctx.finish({ score: st.best, label: st.best === 1 ? 'in a row' : 'in a row', extra: st.streak >= WIN ? `${WIN} right in a row: the pot is yours.` : `${st.right} right calls of ${st.calls}.` }); }, 1200);
        } else st.phase = 'call';
      }
      hi.onclick = (e) => { e.stopPropagation(); hi.blur(); call(1); };
      lo.onclick = (e) => { e.stopPropagation(); lo.blur(); call(-1); };
      draw(st.die); line.textContent = `The die shows ${st.die}. Higher or lower?`;
      H.title(def.title || 'High-Low'); H.score(0); info();
      H.hint('Call the next roll: <kbd>&uarr;</kbd> / <kbd>W</kbd> higher, <kbd>&darr;</kbd> / <kbd>S</kbd> lower. A tie is a push.');
      return {
        update(dt) {
          ctx.look(cam, at);
          if (st.phase === 'roll') { st.t += dt; if (Math.floor(st.t * 14) !== Math.floor((st.t - dt) * 14)) draw(1 + Math.floor(Math.random() * 6)); if (st.t > .75) settle(); }
        },
        key(e, down) {
          if (!down || e.repeat) return; const k = e.key.toLowerCase();
          if (k === 'arrowup' || k === 'w' || k === '1') call(1); else if (k === 'arrowdown' || k === 's' || k === '2') call(-1);
        },
        pointer() {},
        _test: { st, call, settle },
        dispose() { box.remove(); }
      };
    }
  };
  window.RebelGames.register('highlow', G);
})();
