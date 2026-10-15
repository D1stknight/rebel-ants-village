// Riddles (Oct 15): a riddle-giver's questions one at a time, three or four answers each (click one or press its
// number). A right answer gets its reason and the next riddle; a wrong one shows the right answer and its reason. The
// score is the riddles answered right (Bushi Strategist's Question, Sohei Monk's Koan, Warrior Cracked Circle).
// def: { riddles: [{ q, a: [answers], right: index, why }], pass (right answers to clear it), giver: npcId (the camera
//        looks at them), cam, at (frame coordinates), bell: Hz (a right answer rings a bell of that pitch) }
(function () {
  const G = {
    title: 'Riddles',
    start(ctx) {
      const B = ctx.B, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      // the answers come in a new order every time (def.keepOrder keeps them as written)
      const mix = n => { const a = [...Array(n).keys()]; for (let i = n - 1; i > 0; i--) { const k = Math.floor(Math.random() * (i + 1)); [a[i], a[k]] = [a[k], a[i]]; } return a; };
      const R = (def.riddles || []).filter(r => r && r.q && Array.isArray(r.a) && r.a.length >= 2)
        .map(r => { if (def.keepOrder) return r; const o = mix(r.a.length); return { ...r, a: o.map(i => r.a[i]), right: o.indexOf(r.right) }; });
      // the camera over the shoulder, on the riddle-giver when there is one
      const giver = def.giver && ctx.npc ? ctx.npc(def.giver) : null;
      let at = def.at || [0, 2, 5];
      // the Rebel a step to the left, the camera over the right shoulder, aimed low at the giver so their head and
      // shoulders show above the panel
      ctx.player.place(-1.5, -.4, 0);
      const cam = def.cam || [1.2, 3.1, -2.4];
      if (giver) {
        const p = ctx.toLocal(giver.getAbsolutePosition()); let h = 3.3; // the giver's height (placeholder ants are smaller than forged NPCs)
        try { const bb = giver.getHierarchyBoundingVectors(true), y0 = giver.getAbsolutePosition().y; if (Number.isFinite(bb.max.y)) h = Math.max(1, Math.min(4.2, bb.max.y - y0)); } catch (e) {}
        // aim below the head so the head sits a third of the way down the screen, clear of the panel
        const d = Math.max(2, Math.hypot(p.x - cam[0], p.z - cam[2])), aTop = Math.atan2(p.y + h - cam[1], d);
        at = [p.x, cam[1] + d * Math.tan(aTop - .26), p.z]; ctx.player.face(Math.atan2(p.x + 1.5, p.z + .4));
      }
      // the giver stops (patrols too) and talks while asking, as in a conversation
      const held = giver?.metadata && !giver.metadata.dialogueOpen; if (held) giver.metadata.dialogueOpen = true;
      ctx.look(cam, at, def.fov || .85);
      // the panel: the riddle, the answers as buttons
      const hud = document.getElementById('gameHud'), box = document.createElement('div');
      box.style.cssText = 'position:absolute;left:50%;top:auto;bottom:70px;transform:translateX(-50%);width:min(520px,92vw);background:rgba(10,13,22,.92);border:1px solid rgba(216,179,92,.7);border-radius:14px;padding:16px 18px;text-align:center;pointer-events:auto;box-shadow:0 10px 30px rgba(0,0,0,.5)';
      hud.appendChild(box);
      const st = { k: 0, right: 0, phase: 'ask', wait: 0, picked: -1 };
      const info = () => H.info(`Riddle ${Math.min(st.k + 1, R.length)} / ${R.length}`);
      function render() {
        const r = R[st.k]; if (!r) { box.innerHTML = ''; return; }
        const done = st.phase === 'answered';
        box.innerHTML = `<div style="font:italic 600 17px/1.45 Georgia,serif;color:#ffe9b0;margin-bottom:12px">${esc(r.q)}</div>` +
          r.a.map((t, i) => { const ok = done && i === r.right, bad = done && i === st.picked && i !== r.right;
            return `<button type="button" data-i="${i}" style="display:block;width:100%;margin:6px 0;padding:9px 12px;border-radius:9px;border:1px solid ${ok ? '#7fe0a8' : bad ? '#e07f7f' : 'rgba(216,179,92,.7)'};background:${ok ? 'rgba(60,140,90,.45)' : bad ? 'rgba(140,50,50,.45)' : 'rgba(255,216,119,.07)'};color:#f3e6c4;font:600 14px Georgia,serif;text-align:left;cursor:${done ? 'default' : 'pointer'}"><b style="color:#d8b35c">${i + 1}</b> &nbsp;${esc(t)}</button>`; }).join('') +
          (done ? `<div style="margin-top:10px;font:13px/1.45 Georgia,serif;color:#cfd8e6">${esc(r.why || '')}</div><div style="margin-top:8px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#d8b35c">${st.k + 1 < R.length ? 'Next riddle' : 'Last one'} · click or Enter</div>` : '');
        box.querySelectorAll('button[data-i]').forEach(b => { b.onclick = (e) => { e.stopPropagation(); b.blur(); answer(+b.dataset.i); }; });
        if (done) box.onclick = () => next(); else box.onclick = null;
      }
      function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
      function answer(i) {
        if (st.phase !== 'ask') return;
        const r = R[st.k]; if (!r || i < 0 || i >= r.a.length) return;
        st.picked = i; st.phase = 'answered'; st.wait = .6;
        if (i === r.right) { st.right++; H.score(st.right); H.msg('Right!', 800); if (def.bell) ctx.note(def.bell, 'bell'); else ctx.sound('gamewin'); }
        else { H.msg('Not quite', 900); ctx.sound('thock'); }
        render();
      }
      function next() {
        if (st.phase !== 'answered' || st.wait > 0) return;
        st.k++; st.picked = -1;
        if (st.k >= R.length) { st.phase = 'done'; box.remove(); H.hint('');
          ctx.finish({ score: st.right, label: st.right === 1 ? 'riddle' : 'riddles', extra: `${st.right} of ${R.length} answered right.` }); return; }
        st.phase = 'ask'; info(); render();
      }
      H.title(def.title || 'Riddles'); H.score(0); info();
      H.hint(R.length ? 'Pick an answer: click it or press <kbd>1</kbd>-<kbd>' + Math.max(...R.map(r => r.a.length)) + '</kbd>' : '');
      if (!R.length) { st.phase = 'done'; ctx.finish({ score: 0, label: 'riddles', extra: 'No riddles here yet.' }); }
      else render();
      return {
        update(dt) { ctx.look(cam, at); if (st.wait > 0) st.wait -= dt; },
        key(e, down) {
          if (!down || e.repeat) return;
          if (st.phase === 'answered' && (e.key === 'Enter' || e.key === ' ')) { next(); return; }
          const n = parseInt(e.key, 10); if (n >= 1) answer(n - 1);
        },
        pointer() {},
        _test: { st, answer, next, R },
        dispose() { box.remove(); if (held && giver.metadata) giver.metadata.dialogueOpen = false; }
      };
    }
  };
  window.RebelGames.register('riddle', G);
})();
