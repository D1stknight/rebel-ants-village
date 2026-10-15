// Rebel games (Oct 15): mini-games started from a quest spot or a room hotspot (spotConfig.game / hotspot game:
// { type, id, title, pass, points, ... }). Each game is its own file, assets/games/<type>.js, loaded the first time it is
// played; it registers itself here with RebelGames.register(type, { start(ctx) -> { update(dt), key(e, down),
// pointer(evt), dispose() } }). The village (village.html, startMiniGame) builds ctx: the scene, the camera, the
// player, the stage frame, sounds and this HUD. Nothing of a game runs before it is started.
(function () {
  const games = {}, loading = {};
  function register(type, impl) { games[type] = impl; }
  function load(type) {
    if (games[type]) return Promise.resolve(games[type]);
    if (!/^[a-z0-9_-]+$/.test(type)) return Promise.reject(new Error('bad game type ' + type));
    return loading[type] || (loading[type] = new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = 'assets/games/' + type + '.js'; s.async = true;
      s.onload = () => (games[type] ? res(games[type]) : rej(new Error('game ' + type + ' did not register')));
      s.onerror = () => { delete loading[type]; rej(new Error('game ' + type + ' failed to load')); };
      document.head.appendChild(s);
    }));
  }

  // ── the HUD: a top bar (title, score, info), a hint line, a big centre message, a meter, a card slot (a scorecard),
  // a reticle that follows the aim, floating score pops, Quit; the result card; the walk HUD steps aside (body.in-game),
// except the minimap in a roam game (body.game-roam: runs and chases keep the walk) ──
  const CSS = `
body.in-game #hud,body.in-game #selectedRebelPanel,body.in-game #returnHubBtn,body.in-game #wb,body.in-game #backToLobbyBtn,body.in-game #rebelHudBtn,
body.in-game #questLine,body.in-game:not(.game-roam) #miniMap,body.in-game #photoBtn,body.in-game #interactionPrompt,body.in-game #xhair{display:none!important}
#gameHud{position:fixed;inset:0;pointer-events:none;z-index:70;display:none;font:600 14px/1.3 Georgia,serif;color:#f3e6c4;user-select:none}
#gameHud.on{display:block}
#gameHud .gh-top{position:absolute;top:14px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:14px;background:rgba(10,13,22,.86);border:1px solid rgba(216,179,92,.6);border-radius:12px;padding:8px 16px;white-space:nowrap;max-width:94vw}
#gameHud .gh-title{letter-spacing:.14em;text-transform:uppercase;font-size:12px;color:#d8b35c}
#gameHud .gh-score{font-size:20px;color:#ffe9b0;font-variant-numeric:tabular-nums}
#gameHud .gh-info{font-size:13px;color:#cfd8e6;font-variant-numeric:tabular-nums}
#gameHud .gh-card{position:absolute;top:66px;left:50%;transform:translateX(-50%);max-width:96vw;overflow-x:auto}
#gameHud .gh-hint{position:absolute;bottom:22px;left:50%;transform:translateX(-50%);background:rgba(10,13,22,.8);border-radius:10px;padding:7px 14px;font-size:13px;color:#e9dcbc;max-width:92vw;text-align:center}
#gameHud .gh-hint:empty{display:none}
#gameHud .gh-hint kbd{font:600 11px ui-monospace,monospace;border:1px solid rgba(216,179,92,.7);border-bottom-width:2px;border-radius:3px;padding:0 4px;color:#ffe9b0}
#gameHud .gh-msg{position:absolute;top:34%;left:50%;transform:translate(-50%,-50%) scale(.9);font:700 clamp(30px,7vw,64px)/1 Georgia,serif;letter-spacing:.06em;color:#ffd877;text-shadow:0 0 18px rgba(255,190,80,.6),0 3px 0 #5a3410;opacity:0;transition:opacity .18s,transform .18s;text-align:center;white-space:nowrap}
#gameHud .gh-msg.on{opacity:1;transform:translate(-50%,-50%) scale(1)}
#gameHud .gh-msg small{display:block;font-size:.34em;letter-spacing:.12em;color:#f3e6c4;margin-top:8px}
#gameHud .gh-meter{position:absolute;bottom:68px;left:50%;transform:translateX(-50%);width:min(380px,80vw);display:none;text-align:center}
#gameHud .gh-meter.on{display:block}
#gameHud .gh-meter b{display:block;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#d8b35c;margin-bottom:5px}
#gameHud .gh-meter .gm-track{position:relative;height:16px;border-radius:8px;background:linear-gradient(90deg,#1d2633,#2a3546);border:1px solid rgba(216,179,92,.5);overflow:hidden}
#gameHud .gh-meter .gm-zone{position:absolute;top:0;bottom:0;background:linear-gradient(90deg,#b77b22,#ffd877,#b77b22);opacity:.85}
#gameHud .gh-meter .gm-fill{position:absolute;top:0;bottom:0;left:0;background:linear-gradient(90deg,#3a8f7a,#5ecfca);opacity:.85}
#gameHud .gh-meter .gm-mark{position:absolute;top:-3px;bottom:-3px;width:4px;margin-left:-2px;background:#fff;box-shadow:0 0 8px #fff;border-radius:2px}
#gameHud .gh-quit{position:absolute;top:14px;right:16px;pointer-events:auto;font:600 12px Georgia,serif;letter-spacing:.08em;padding:6px 12px;border-radius:6px;border:1px solid #8a6a2a;background:rgba(42,29,16,.9);color:#ffe9b0;cursor:pointer}
#gameHud .gh-pop{position:absolute;transform:translate(-50%,-50%);font:700 18px Georgia,serif;color:#ffe9b0;text-shadow:0 2px 0 #000,0 0 10px rgba(255,200,90,.7);pointer-events:none;animation:ghPop .9s ease-out forwards}
#gameHud .gh-pop.bad{color:#ff8a7a}
@keyframes ghPop{0%{opacity:0;margin-top:6px}15%{opacity:1}100%{opacity:0;margin-top:-34px}}
#gameReticle{position:fixed;width:34px;height:34px;margin:-17px 0 0 -17px;border:2px solid rgba(255,233,176,.9);border-radius:50%;box-shadow:0 0 6px rgba(0,0,0,.6);pointer-events:none;z-index:71;display:none}
#gameReticle::after{content:"";position:absolute;left:50%;top:50%;width:4px;height:4px;margin:-2px 0 0 -2px;background:#ffd877;border-radius:50%}
#gameReticle.on{display:block}
#gameLoading{position:fixed;left:50%;top:45%;transform:translate(-50%,-50%);z-index:72;background:rgba(10,13,22,.9);border:1px solid rgba(216,179,92,.6);border-radius:12px;padding:14px 22px;font:600 15px Georgia,serif;color:#ffe9b0;letter-spacing:.06em;display:none}
#gameLoading.on{display:block}
#gameResult{position:fixed;inset:0;z-index:73;display:none;align-items:center;justify-content:center;background:rgba(2,6,14,.55);padding:18px}
#gameResult.on{display:flex}
#gameResult .gr-card{width:min(420px,92vw);background:radial-gradient(circle at 50% 0%,rgba(232,197,106,.16),rgba(8,12,24,.97) 60%);border:1px solid rgba(232,197,106,.72);border-radius:14px;padding:20px 22px;text-align:center;color:#f3e6c4;font:600 14px/1.4 Georgia,serif;box-shadow:0 14px 40px rgba(0,0,0,.6)}
#gameResult .gr-kicker{font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#5ecfca}
#gameResult .gr-title{font-size:24px;color:#ffe9b0;margin:6px 0 10px}
#gameResult .gr-score{font-size:46px;color:#ffd877;font-variant-numeric:tabular-nums;line-height:1}
#gameResult .gr-label{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#cfd8e6;margin-top:4px}
#gameResult .gr-best{margin-top:12px;font-size:14px;color:#cfd8e6}
#gameResult .gr-best b{color:#ffe9b0}
#gameResult .gr-new{display:inline-block;margin-top:8px;padding:3px 10px;border-radius:999px;background:#ffd877;color:#2a1d10;font-size:12px;letter-spacing:.1em;text-transform:uppercase}
#gameResult .gr-extra{margin-top:10px;font-size:13px;color:#e9dcbc}
#gameResult .gr-extra:empty{display:none}
#gameResult .gr-btns{display:flex;justify-content:center;gap:10px;margin-top:16px}
#gameResult .gr-btns button{font:600 14px Georgia,serif;letter-spacing:.06em;padding:9px 18px;border-radius:7px;border:1px solid #8a6a2a;background:#2a1d10;color:#ffe9b0;cursor:pointer}
#gameResult .gr-btns button.primary{background:#d8b35c;color:#2a1d10;border-color:#d8b35c}
@media (max-width:520px){#gameHud .gh-top{gap:8px;padding:6px 10px}#gameHud .gh-score{font-size:17px}#gameHud .gh-quit{top:auto;bottom:14px;right:12px}}
`;
  let els = null;
  function ensure() {
    if (els) return els;
    const st = document.createElement('style'); st.id = 'rebelGamesCss'; st.textContent = CSS; document.head.appendChild(st);
    const hud = document.createElement('div'); hud.id = 'gameHud';
    hud.innerHTML = '<div class="gh-top"><span class="gh-title"></span><span class="gh-score"></span><span class="gh-info"></span></div><div class="gh-card"></div>'
      + '<div class="gh-meter"><b></b><div class="gm-track"><div class="gm-zone"></div><div class="gm-fill"></div><div class="gm-mark"></div></div></div>'
      + '<div class="gh-msg"></div><div class="gh-hint"></div><button class="gh-quit" type="button">Quit <kbd>Esc</kbd></button>';
    const ret = document.createElement('div'); ret.id = 'gameReticle';
    const ld = document.createElement('div'); ld.id = 'gameLoading'; ld.textContent = 'Getting the game ready…';
    const res = document.createElement('div'); res.id = 'gameResult';
    res.innerHTML = '<div class="gr-card"><div class="gr-kicker"></div><div class="gr-title"></div><div class="gr-score"></div><div class="gr-label"></div><div class="gr-best"></div><div class="gr-extra"></div>'
      + '<div class="gr-btns"><button type="button" class="gr-again">Play again</button><button type="button" class="gr-done primary">Done</button></div></div>';
    document.body.append(hud, ret, ld, res);
    els = { hud, ret, ld, res, q: (s) => hud.querySelector(s) };
    return els;
  }
  let msgTimer = 0;
  const HUD = {
    show(on) { const e = ensure(); e.hud.classList.toggle('on', !!on); document.body.classList.toggle('in-game', !!on); if (!on) { HUD.reticle(null); HUD.meter(null); HUD.card(''); HUD.msg(''); } },
    title(t) { ensure().q('.gh-title').textContent = t || ''; },
    score(t) { ensure().q('.gh-score').textContent = t == null ? '' : String(t); },
    info(t) { ensure().q('.gh-info').textContent = t || ''; },
    hint(html) { ensure().q('.gh-hint').innerHTML = html || ''; },
    card(html) { ensure().q('.gh-card').innerHTML = html || ''; },
    // a big message in the middle (sub: a smaller line under it); ms = how long it stays (0 = until the next one)
    msg(t, ms = 1400, sub = '') {
      const m = ensure().q('.gh-msg'); clearTimeout(msgTimer);
      if (!t) { m.classList.remove('on'); return; }
      m.innerHTML = ''; m.append(t); if (sub) { const s = document.createElement('small'); s.textContent = sub; m.append(s); }
      m.classList.remove('on'); void m.offsetWidth; m.classList.add('on');
      if (ms) msgTimer = setTimeout(() => m.classList.remove('on'), ms);
    },
    // a meter: { label, value 0..1 (the marker), fill 0..1, zone: [a, b] } or null to hide it
    meter(o) {
      const m = ensure().q('.gh-meter');
      if (!o) { m.classList.remove('on'); return; }
      m.classList.add('on'); m.querySelector('b').textContent = o.label || '';
      const z = m.querySelector('.gm-zone'), f = m.querySelector('.gm-fill'), k = m.querySelector('.gm-mark');
      z.style.display = o.zone ? '' : 'none'; if (o.zone) { z.style.left = (o.zone[0] * 100) + '%'; z.style.width = ((o.zone[1] - o.zone[0]) * 100) + '%'; }
      f.style.display = o.fill == null ? 'none' : ''; if (o.fill != null) f.style.width = (Math.max(0, Math.min(1, o.fill)) * 100) + '%';
      k.style.display = o.value == null ? 'none' : ''; if (o.value != null) k.style.left = (Math.max(0, Math.min(1, o.value)) * 100) + '%';
    },
    reticle(x, y) { const r = ensure().ret; if (x == null) { r.classList.remove('on'); return; } r.classList.add('on'); r.style.left = x + 'px'; r.style.top = y + 'px'; },
    // a floating "+10" at a screen point (CSS pixels)
    pop(x, y, text, bad) {
      const p = document.createElement('div'); p.className = 'gh-pop' + (bad ? ' bad' : ''); p.textContent = text;
      p.style.left = x + 'px'; p.style.top = y + 'px'; ensure().hud.appendChild(p); setTimeout(() => p.remove(), 950);
    },
    loading(on) { ensure().ld.classList.toggle('on', !!on); },
    onQuit(fn) { ensure().q('.gh-quit').onclick = (e) => { e.stopPropagation(); e.currentTarget.blur(); fn(); }; }
  };
  // the result card: { kicker, title, score, label, best, newBest, extra, onAgain, onDone }
  function showResult(o) {
    const e = ensure(), c = e.res;
    c.querySelector('.gr-kicker').textContent = o.kicker || 'Game over';
    c.querySelector('.gr-title').textContent = o.title || '';
    c.querySelector('.gr-score').textContent = String(o.score ?? 0);
    c.querySelector('.gr-label').textContent = o.label || 'points';
    const best = c.querySelector('.gr-best'); best.innerHTML = '';
    if (o.newBest) { const n = document.createElement('span'); n.className = 'gr-new'; n.textContent = 'New best!'; best.append(n); }
    else if (o.best != null) { best.append('Your best: '); const b = document.createElement('b'); b.textContent = String(o.best); best.append(b); }
    c.querySelector('.gr-extra').textContent = o.extra || '';
    const again = c.querySelector('.gr-again'), done = c.querySelector('.gr-done');
    again.onclick = () => { again.blur(); hideResult(); o.onAgain && o.onAgain(); };
    done.onclick = () => { done.blur(); hideResult(); o.onDone && o.onDone(); };
    c.classList.add('on');
  }
  function hideResult() { ensure().res.classList.remove('on'); }
  const resultOpen = () => !!els && els.res.classList.contains('on');

  // ── small shared helpers for games ──
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // a value sweeping 0..1..0 (a ping-pong meter) at speed sweeps per second, from phase t
  const pingPong = (t, speed) => { const u = (t * speed) % 2; return u < 1 ? u : 2 - u; };
  window.RebelGames = { register, load, games, HUD, showResult, hideResult, resultOpen, util: { clamp, pingPong } };
})();
