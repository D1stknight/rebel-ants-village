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
      // a request that never answers gives up after 20 checks a second apart (the loading card goes, the next O asks
      // again); checks, not the clock: a device too busy to run them on time gives the script the time it needs
      let ticks = 0;
      const fail = msg => { clearInterval(timer); delete loading[type]; s.remove(); rej(new Error('game ' + type + ' ' + msg)); };
      const timer = setInterval(() => { if (++ticks >= 20) fail('timed out'); }, 1000);
      s.onload = () => { clearInterval(timer); if (games[type]) res(games[type]); else fail('did not register'); };
      s.onerror = () => fail('failed to load');
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
#gameHud .gh-msg.long{white-space:normal;width:min(86vw,760px);font-size:clamp(18px,3.6vw,30px);line-height:1.25;letter-spacing:.02em}
#gameHud .gh-msg small{display:block;font-size:.34em;letter-spacing:.12em;color:#f3e6c4;margin-top:8px}
#gameHud .gh-meter{position:absolute;bottom:68px;left:50%;transform:translateX(-50%);width:min(380px,80vw);display:none;text-align:center}
#gameHud .gh-meter.on{display:block}
#gameHud .gh-meter b{display:block;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#d8b35c;margin-bottom:5px}
#gameHud .gh-meter .gm-track{position:relative;height:16px;border-radius:8px;background:linear-gradient(90deg,#1d2633,#2a3546);border:1px solid rgba(216,179,92,.5);overflow:hidden}
#gameHud .gh-meter .gm-zone{position:absolute;top:0;bottom:0;background:linear-gradient(90deg,#b77b22,#ffd877,#b77b22);opacity:.85}
#gameHud .gh-meter .gm-fill{position:absolute;top:0;bottom:0;left:0;background:linear-gradient(90deg,#3a8f7a,#5ecfca);opacity:.85}
#gameHud .gh-meter .gm-mark{position:absolute;top:-3px;bottom:-3px;width:4px;margin-left:-2px;background:#fff;box-shadow:0 0 8px #fff;border-radius:2px}
#gameHud .gh-tools{position:absolute;top:14px;right:16px;display:flex;gap:8px;pointer-events:auto}
#gameHud .gh-tools button{font:600 12px Georgia,serif;letter-spacing:.08em;padding:6px 12px;border-radius:6px;border:1px solid #8a6a2a;background:rgba(42,29,16,.9);color:#ffe9b0;cursor:pointer}
#gameHud .gh-tools button[hidden]{display:none}
#gameHud .gh-tools .gh-help{border-color:#3a8f7a;color:#bff3ea}
#gameHowTo{position:fixed;inset:0;z-index:74;display:none;align-items:center;justify-content:center;background:rgba(2,6,14,.6);padding:16px}
#gameHowTo.on{display:flex}
#gameHowTo .ht-card{width:min(560px,94vw);max-height:calc(100vh - 32px);overflow:auto;background:radial-gradient(circle at 50% 0%,rgba(94,207,202,.14),rgba(8,12,24,.97) 62%);border:1px solid rgba(232,197,106,.72);border-radius:14px;padding:18px 20px;font:15px/1.45 Georgia,serif;color:#f3e6c4}
#gameHowTo .ht-kicker{font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#5ecfca}
#gameHowTo .ht-title{font-size:22px;color:#ffe9b0;margin:4px 0 10px}
#gameHowTo ol{margin:0 0 10px;padding-left:22px}
#gameHowTo li{margin:4px 0}
#gameHowTo img{display:block;width:100%;height:auto;border-radius:8px;border:1px solid rgba(216,179,92,.4);margin:8px 0 4px;background:#141a24}
#gameHowTo .ht-cap{font-size:13px;color:#cfd8e6;font-style:italic}
#gameHowTo .ht-cap:empty{display:none}
#gameHowTo .ht-btns{text-align:center;margin-top:14px}
#gameHowTo button{font:600 14px Georgia,serif;letter-spacing:.06em;padding:9px 22px;border-radius:7px;border:1px solid #d8b35c;background:#d8b35c;color:#2a1d10;cursor:pointer}
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
#gameResult .gr-card{width:min(420px,92vw);max-height:calc(100vh - 36px);overflow:auto;background:radial-gradient(circle at 50% 0%,rgba(232,197,106,.16),rgba(8,12,24,.97) 60%);border:1px solid rgba(232,197,106,.72);border-radius:14px;padding:20px 22px;text-align:center;color:#f3e6c4;font:600 14px/1.4 Georgia,serif;box-shadow:0 14px 40px rgba(0,0,0,.6)}
#gameResult .gr-kicker{font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#5ecfca}
#gameResult .gr-title{font-size:24px;color:#ffe9b0;margin:6px 0 10px}
#gameResult .gr-score{font-size:46px;color:#ffd877;font-variant-numeric:tabular-nums;line-height:1}
#gameResult .gr-label{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#cfd8e6;margin-top:4px}
#gameResult .gr-best{margin-top:12px;font-size:14px;color:#cfd8e6}
#gameResult .gr-best b{color:#ffe9b0}
#gameResult .gr-new{display:inline-block;margin-top:8px;padding:3px 10px;border-radius:999px;background:#ffd877;color:#2a1d10;font-size:12px;letter-spacing:.1em;text-transform:uppercase}
#gameResult .gr-extra{margin-top:10px;font-size:13px;color:#e9dcbc}
#gameResult .gr-extra:empty{display:none}
#gameResult .gr-board{margin-top:16px;text-align:left}
#gameResult .gr-board:empty{display:none}
@media (min-width:760px){#gameResult .gr-card:has(.gr-board:not(:empty)){width:min(780px,94vw);display:flex;align-items:center;gap:26px}#gameResult .gr-card:has(.gr-board:not(:empty))>*{flex:1 1 0;min-width:0}#gameResult .gr-card:has(.gr-board:not(:empty))>.gr-board{margin-top:0}}
#gameResult .gr-btns{display:flex;justify-content:center;gap:10px;margin-top:16px}
#gameResult .gr-btns button{font:600 14px Georgia,serif;letter-spacing:.06em;padding:9px 18px;border-radius:7px;border:1px solid #8a6a2a;background:#2a1d10;color:#ffe9b0;cursor:pointer}
#gameResult .gr-btns button.primary{background:#d8b35c;color:#2a1d10;border-color:#d8b35c}
#gameResult .gr-btns button[hidden]{display:none}
@media (max-width:520px){#gameHud .gh-top{gap:8px;padding:6px 10px}#gameHud .gh-score{font-size:17px}#gameHud .gh-tools{top:auto;bottom:14px;right:12px}}
/* phones (Oct 24): the title bar wraps a long info line instead of cutting it off, the help line goes up under it, clear of
   the on-screen pads at the bottom (back down when a game's own card uses that spot), and the HUD buttons are big enough
   for a thumb */
@media (max-width:520px){#gameHud .gh-top{flex-wrap:wrap;justify-content:center;row-gap:2px;white-space:normal;width:max-content;max-width:94vw;box-sizing:border-box}#gameHud .gh-title{font-size:11px;letter-spacing:.1em}#gameHud .gh-info{font-size:12px;text-align:center}#gameHud .gh-hint{bottom:auto;top:90px;font-size:12px;padding:5px 10px;max-width:94vw}#gameHud .gh-card:not(:empty)~.gh-hint{top:auto;bottom:22px}}
@media (pointer:coarse){#gameHud .gh-tools button{padding:10px 14px;font-size:13px;min-height:40px}#gameHud .gh-tools kbd{display:none}}
`;
  let els = null;
  function ensure() {
    if (els) return els;
    const st = document.createElement('style'); st.id = 'rebelGamesCss'; st.textContent = CSS; document.head.appendChild(st);
    const hud = document.createElement('div'); hud.id = 'gameHud';
    hud.innerHTML = '<div class="gh-top"><span class="gh-title"></span><span class="gh-score"></span><span class="gh-info"></span></div><div class="gh-card"></div>'
      + '<div class="gh-meter"><b></b><div class="gm-track"><div class="gm-zone"></div><div class="gm-fill"></div><div class="gm-mark"></div></div></div>'
      + '<div class="gh-msg"></div><div class="gh-hint"></div><div class="gh-tools"><button class="gh-help" type="button" hidden>How to play</button>'
      + '<button class="gh-restart" type="button" hidden>&#x21BB; Restart</button><button class="gh-quit" type="button">Quit <kbd>Esc</kbd></button></div>';
    const ret = document.createElement('div'); ret.id = 'gameReticle';
    const ld = document.createElement('div'); ld.id = 'gameLoading'; ld.textContent = 'Getting the game ready…';
    const res = document.createElement('div'); res.id = 'gameResult';
    // how to play: the rules in a few lines and a worked example (a picture), over the game until it is closed
    const how = document.createElement('div'); how.id = 'gameHowTo';
    how.innerHTML = '<div class="ht-card"><div class="ht-kicker">How to play</div><div class="ht-title"></div><ol></ol><img alt=""><div class="ht-cap"></div><div class="ht-btns"><button type="button">Got it</button></div></div>';
    // the shared top 10 (.gr-board) sits beside the result on wide screens, under the buttons on narrow ones
    res.innerHTML = '<div class="gr-card"><div class="gr-main"><div class="gr-kicker"></div><div class="gr-title"></div><div class="gr-score"></div><div class="gr-label"></div><div class="gr-best"></div><div class="gr-extra"></div>'
      + '<div class="gr-btns"><button type="button" class="gr-again">Play again</button><button type="button" class="gr-done primary">Done</button><button type="button" class="gr-next primary" hidden></button></div></div><div class="gr-board"></div></div>';
    document.body.append(hud, ret, ld, res, how);
    els = { hud, ret, ld, res, how, q: (s) => hud.querySelector(s) };
    return els;
  }
  let msgTimer = 0, howDone = null;
  const HUD = {
    show(on) { const e = ensure(); e.hud.classList.toggle('on', !!on); document.body.classList.toggle('in-game', !!on); if (!on) { HUD.reticle(null); HUD.meter(null); HUD.card(''); HUD.msg(''); HUD.tools({}); HUD.closeHowTo(); } },
    // the buttons beside Quit (Oct 17, Miguel: "add a restart to the board ... do this to all the board games", and every
    // puzzle needs a better explanation with an example): { help: fn, restart: fn }, each shown only when given
    tools(o = {}) {
      for (const [k, fn] of [['help', o.help], ['restart', o.restart]]) {
        const b = ensure().q('.gh-' + k); b.hidden = !fn; b.onclick = fn ? (e) => { e.stopPropagation(); e.currentTarget.blur(); fn(); } : null;
      }
    },
    // the how-to card: { title, lines: [..], img (a URL), caption }; resolves when it is closed (button, Enter, Space, Esc)
    howTo(o) {
      const e = ensure(), c = e.how; HUD.closeHowTo();
      c.querySelector('.ht-title').textContent = o.title || '';
      const ol = c.querySelector('ol'); ol.innerHTML = ''; for (const l of o.lines || []) { const li = document.createElement('li'); li.textContent = l; ol.append(li); }
      const img = c.querySelector('img'); img.style.display = o.img ? '' : 'none'; if (o.img) img.src = o.img; else img.removeAttribute('src');
      c.querySelector('.ht-cap').textContent = o.caption || '';
      c.classList.add('on');
      return new Promise(res => { howDone = () => { howDone = null; c.classList.remove('on'); res(); }; c.querySelector('button').onclick = (ev) => { ev.currentTarget.blur(); howDone && howDone(); }; });
    },
    closeHowTo() { if (howDone) howDone(); },
    // a level picker (Oct 17, Miguel: twenty levels in the action games): { title, sub, n, open (the last playable
    // level), done (how many are cleared), label(k) (a small line under a number), pick(k), color }. The digit keys pick
    // levels 1-10 (panel.key(e) from the game's key handler); the game removes the panel when a level starts
    levels(o) {
      const p = document.createElement('div'), wide = o.n > 6 && innerWidth >= 600, col = o.color || '#d8b35c';
      p.className = 'gh-levels';
      p.style.cssText = `position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(${wide ? 560 : 390}px,92vw);max-height:86vh;overflow:auto;background:rgba(16,12,8,.94);border:1px solid ${col};border-radius:14px;padding:16px;text-align:center;pointer-events:auto;color:#f3e6c4;font:14px/1.4 system-ui,sans-serif`;
      const btn = k => { const open = k <= o.open, ok = k < o.done, sub = open && o.label ? o.label(k) : '';
        return `<button type="button" data-k="${k}" ${open ? '' : 'disabled'} style="padding:8px 2px;border-radius:9px;border:1px solid ${open ? col : '#444'};background:${ok ? 'rgba(216,179,92,.22)' : 'rgba(255,255,255,.04)'};color:${open ? '#fff' : '#666'};font:700 15px system-ui,sans-serif;cursor:${open ? 'pointer' : 'default'}">${open ? k + 1 : '\u{1F512}'}${ok ? ' \u2713' : ''}${sub ? `<div style="font:11px system-ui;opacity:.75">${sub}</div>` : ''}</button>`; };
      p.innerHTML = `<div style="font:800 13px/1.2 system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:${col};margin-bottom:8px">${o.title || 'Levels'}</div>`
        + (o.sub ? `<div style="margin-bottom:12px;color:#bbb">${o.sub}</div>` : '')
        + `<div style="display:grid;grid-template-columns:repeat(${wide ? 5 : 4},1fr);gap:8px">${Array.from({ length: o.n }, (_, k) => btn(k)).join('')}</div>`;
      p.querySelectorAll('button[data-k]').forEach(b => b.onclick = (e) => { e.stopPropagation(); b.blur(); o.pick(+b.dataset.k); });
      p.key = (e) => { if (!p.isConnected) return false; const d = '1234567890'.indexOf(e.key); if (d < 0 || d >= o.n) return false; const b = p.querySelector(`button[data-k="${d}"]:not([disabled])`); if (b) b.click(); return !!b; };
      ensure().hud.appendChild(p); return p;
    },
    howToOpen: () => !!els && els.how.classList.contains('on'),
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
      // a sentence (not a word or two) wraps in a smaller font and stays long enough to read (Miguel: the Garden Bridges
      // line ran off the screen and was gone before he could read it)
      const long = String(t).length > 22; m.classList.toggle('long', long);
      if (long && ms) ms = Math.max(ms, 1200 + 60 * String(t).length);
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
  // the result card: { kicker, title, score, label, best, newBest, extra, onAgain, onDone, onNext, nextLabel } (onNext: a
  // game with levels goes straight on to the next one; Done is then the plain button)
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
    c.querySelector('.gr-board').innerHTML = '';                 // the shared top 10 fills in after (village.html GameBoard)
    const again = c.querySelector('.gr-again'), done = c.querySelector('.gr-done'), next = c.querySelector('.gr-next');
    again.onclick = () => { again.blur(); hideResult(); o.onAgain && o.onAgain(); };
    done.onclick = () => { done.blur(); hideResult(); o.onDone && o.onDone(); };
    next.hidden = !o.onNext; done.classList.toggle('primary', !o.onNext); next.textContent = (o.nextLabel || 'Next level') + ' \u2192';
    next.onclick = o.onNext ? () => { next.blur(); hideResult(); o.onNext(); } : null;
    c.classList.add('on');
  }
  function hideResult() { ensure().res.classList.remove('on'); }
  const resultBoard = () => ensure().res.querySelector('.gr-board');
  const resultOpen = () => !!els && els.res.classList.contains('on');

  // ── small shared helpers for games ──
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // a value sweeping 0..1..0 (a ping-pong meter) at speed sweeps per second, from phase t
  const pingPong = (t, speed) => { const u = (t * speed) % 2; return u < 1 ? u : 2 - u; };
  // how many levels of a game this player has cleared (in order), kept on the device; ?levels=open (previews) opens all
  const levelsOpen = () => /[?&]levels=open\b/.test(location.search);
  const levelStore = (id) => { const k = 'rebelAntsLevels:v1:' + id; return {
    get() { let n = 0; try { n = Math.max(0, Number(localStorage.getItem(k)) || 0); } catch (e) {} return n; },
    open(max) { return levelsOpen() ? max - 1 : Math.min(max - 1, this.get()); },
    set(n) { try { if (n > this.get()) localStorage.setItem(k, String(n)); } catch (e) {} } }; };
  // Phones held upright (Oct 24): a game's camera is framed for a 16:9 screen (v = its vertical field of view there); an
  // upright phone shows at most that screen's width (the field of view fixed across, more above and below) and closes in
  // on the game's own things near what the camera looks at when they need less: never closer than the game's own view
  // on this screen. fit(cam, frame, v) = the share of the 16:9 width to show (1 = all of it); apply(cam, v, k).
  const upright = {
    is(cam) { const e = cam.getEngine(); return e.getRenderWidth() < e.getRenderHeight(); },
    apply(cam, v, k = 1) {
      const B = window.BABYLON, up = upright.is(cam);
      cam.fovMode = up ? B.Camera.FOVMODE_HORIZONTAL_FIXED : B.Camera.FOVMODE_VERTICAL_FIXED;
      cam.fov = up ? 2 * Math.atan(Math.tan(v / 2) * 16 / 9 * k) : v;
    },
    fit(cam, frame, v) {
      const B = window.BABYLON, e = cam.getEngine(), aspect = e.getRenderWidth() / e.getRenderHeight();
      const t16 = Math.tan(v / 2) * 16 / 9, tMin = Math.tan(v / 2) * aspect;
      if (!frame || !(t16 > 0)) return 1;
      cam.computeWorldMatrix(true);
      const view = cam.getViewMatrix(true), tgt = cam.getTarget ? cam.getTarget() : null;
      const R = tgt ? B.Vector3.Distance(cam.position, tgt) * 2.5 + 2 : 1e9;
      let need = 0, n = 0;
      for (const m of frame.getChildMeshes(false)) {
        if (!m.isEnabled() || !m.isVisible || m.visibility <= .01 || !m.getTotalVertices?.()) continue;
        if (m.hasThinInstances && m.thinInstanceCount > 0) m.thinInstanceRefreshBoundingInfo(false);
        const bb = m.getBoundingInfo().boundingBox;
        if (tgt && (B.Vector3.Distance(bb.centerWorld, tgt) > R || bb.extendSizeWorld.length() > R)) continue; // far things, ground planes, backdrops
        for (const p of bb.vectorsWorld) {
          const c = B.Vector3.TransformCoordinates(p, view); if (c.z <= .05) continue;
          // across: within ~91 % of the width; up and down: within the middle ~62 % (the title, help line and buttons)
          need = Math.max(need, Math.abs(c.x) / c.z * 1.1, Math.abs(c.y) / c.z * aspect * 1.6); n++;
        }
      }
      return n ? clamp(need / t16, Math.min(1, tMin / t16), 1) : 1;
    }
  };
  window.RebelGames = { register, load, games, HUD, showResult, hideResult, resultOpen, resultBoard, util: { clamp, pingPong, levelStore, upright } };
})();
