// The lobby's walkthrough (Nov 2, Miguel: "dont we need something in the lobby that explain how everything works? wallet
// connect, sign in name or discord, forge, the universe itself, antthony, etc..? maybe like a walk though with bubbles and a
// page that explains it?"). A first visit gets a short tour: a bubble by each part of the lobby (the cards, Connect Wallet,
// the sign-in circle, the Forge, Enter Village, LIVE NOW when an event is on), the rest of the page dimmed round it; the last
// bubble links the full guide (how-it-works.html). The ? button at the top left starts it again.
//   LobbyTour.auto()   from the lobby once its UI shows: the tour, the first time on this device
//   LobbyTour.start()  the tour now (the ? button)
(() => {
  if (window.LobbyTour) return;
  const KEY = 'rebelAntsLobbyTour:v1';
  const seen = () => { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } };
  const markSeen = () => { try { localStorage.setItem(KEY, '1'); } catch (e) {} };
  const visible = (el) => { if (!el) return false; const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 4 && r.height > 4 && cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > .05; };
  // the steps: a target (a selector, or none for a bubble in the middle), a title and the words
  const STEPS = [
    { title: 'Welcome to Rebel Universe', text: "The Rebel Ants' 3D world: fifteen villages, the colony's story, over 150 games and puzzles, live shows and other players. Here's the lobby in {n} quick steps." },
    { el: '#char-row', title: 'Pick who you play', text: 'Your own Rebels, Chumpz and Saints show up here once your wallet is connected. No NFT? Pick a card marked Free: anyone can play those.' },
    { el: '#btn-wallet', title: 'Connect your wallet', text: 'A browser wallet or WalletConnect on your phone. It only reads which NFTs you hold: playing never asks you to send anything.' },
    { el: '#econChip', title: 'Sign in', text: 'Discord, or a name and PIN. Your Rebel Points, badges and story are saved to your account and follow you to any device. Guests can play too, with practice points.' },
    { el: '#btn-forge', title: 'Forge your character', text: 'The Forge turns your NFT into a 3D character that walks, fights, dances and sits in Universe. A forge costs 20,000 Rebel Points.' },
    { el: '#liveNow', title: 'Live events', text: 'When a show or a meetup is on, it shows up here. Join takes you straight to it.', only: () => visible(document.getElementById('liveNow')) },
    { el: '#btn-enter', title: 'Enter Universe', text: "You start in the Hub. Walk up to anything glowing and press O. Ant-Thony, Rebel #001, roams the villages: find the gold dot on your map and ask him anything." },
    { title: 'That’s the lobby', text: 'The full guide explains points, the Forge, the villages, Ant-Thony, playing together and the controls. The ? at the top left shows this tour again.', guide: true }
  ];
  let css = false, S = null;
  function style() {
    if (css) return; css = true;
    const s = document.createElement('style');
    s.textContent = `#ltWrap{position:fixed;inset:0;z-index:2147482000;pointer-events:auto}
#ltShade{position:fixed;inset:0;background:rgba(3,3,9,.62);transition:opacity .25s}
#ltRing{position:fixed;border-radius:14px;box-shadow:0 0 0 9999px rgba(3,3,9,.62),0 0 0 2px #e8c56a,0 0 26px 4px rgba(232,197,106,.55);transition:left .3s ease,top .3s ease,width .3s ease,height .3s ease,opacity .2s;pointer-events:none}
#ltWrap.ring #ltShade{opacity:0}
#ltBub{position:fixed;width:min(340px,calc(100vw - 32px));padding:16px 16px 14px;border-radius:16px;background:linear-gradient(180deg,#1c1726,#100d18);border:1px solid rgba(232,197,106,.6);
  box-shadow:0 18px 50px rgba(0,0,0,.6),0 0 30px rgba(232,197,106,.14);color:#ece6d6;font:400 14.5px/1.5 system-ui,-apple-system,'Segoe UI',sans-serif;transition:left .3s ease,top .3s ease}
#ltBub .lk{font:700 10px/1 'Cinzel',Georgia,serif;letter-spacing:.24em;text-transform:uppercase;color:#5ecfca}
#ltBub h3{margin:7px 0 6px;font:700 17px/1.25 'Cinzel',Georgia,serif;letter-spacing:.04em;color:#fff1c8}
#ltBub p{margin:0;color:#cfc6b4}
#ltBub .la{display:flex;align-items:center;gap:8px;margin-top:14px}
#ltBub .la .dots{display:flex;gap:5px;margin-right:auto}
#ltBub .la .dots i{width:6px;height:6px;border-radius:50%;background:rgba(232,197,106,.25)}
#ltBub .la .dots i.on{background:#e8c56a}
#ltBub button,#ltBub a.g{min-height:38px;padding:0 14px;border-radius:999px;border:1px solid rgba(232,197,106,.5);background:transparent;color:#e8c56a;font:700 11px/1 'Cinzel',Georgia,serif;letter-spacing:.12em;text-transform:uppercase;cursor:pointer;display:inline-flex;align-items:center;text-decoration:none}
#ltBub button.p,#ltBub a.g{background:linear-gradient(135deg,#c8922a,#8a5e1a);border-color:#e0b25a;color:#fff}
#ltBub button.x{position:absolute;right:8px;top:8px;width:30px;min-height:30px;padding:0;justify-content:center;border:0;color:#8d8676;font:400 16px/1 system-ui,sans-serif;letter-spacing:0}
#ltBub .arw{position:absolute;width:14px;height:14px;background:#17131f;border:1px solid rgba(232,197,106,.6);transform:rotate(45deg)}
#ltBub .arw.up{top:-8px;border-right:0;border-bottom:0}
#ltBub .arw.down{bottom:-8px;border-left:0;border-top:0;background:#100d18}
#lobbyHelp{position:fixed;left:max(16px,env(safe-area-inset-left,0px));z-index:61;width:40px;height:40px;border-radius:50%;border:1px solid rgba(232,197,106,.55);background:rgba(12,10,20,.72);color:#e8c56a;
  font:700 18px/1 'Cinzel',Georgia,serif;cursor:pointer;display:grid;place-items:center;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);transition:transform .15s,border-color .15s}
#lobbyHelp:hover{transform:translateY(-1px);border-color:#e8c56a}`;
    document.head.appendChild(s);
  }
  function steps() { return STEPS.filter((st) => (st.only ? st.only() : true) && (!st.el || visible(document.querySelector(st.el)))); }
  function close(done) {
    if (!S) return; document.removeEventListener('keydown', S.key, true); window.removeEventListener('resize', S.paint); window.removeEventListener('scroll', S.paint, true);
    S.wrap.remove(); S = null; if (done !== false) markSeen();
  }
  function start() {
    style(); close(false);
    const wrap = document.createElement('div'); wrap.id = 'ltWrap'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true'); wrap.setAttribute('aria-label', 'How the lobby works');
    wrap.innerHTML = '<div id="ltShade"></div><div id="ltRing"></div><div id="ltBub"><button class="x" type="button" aria-label="Close the tour">✕</button><div class="lk"></div><h3></h3><p></p><div class="la"></div><div class="arw"></div></div>';
    document.body.appendChild(wrap);
    S = { wrap, list: steps(), i: 0, ring: wrap.querySelector('#ltRing'), bub: wrap.querySelector('#ltBub') };
    S.bub.querySelector('.x').onclick = () => close();
    // the page behind does nothing while the tour is up: a click on the dim area goes on to the next bubble
    wrap.addEventListener('click', (e) => { if (!S.bub.contains(e.target)) go(1); });
    S.key = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
      else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); go(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); go(-1); }
    };
    document.addEventListener('keydown', S.key, true);
    S.paint = () => S && paint(); window.addEventListener('resize', S.paint); window.addEventListener('scroll', S.paint, true);
    paint();
    setTimeout(() => S?.bub.querySelector('.la button.p, .la a.g')?.focus({ preventScroll: true }), 60);
  }
  function go(d) {
    if (!S) return; const n = S.i + d;
    if (n >= S.list.length) return close();
    if (n < 0) return;
    S.i = n; paint();
  }
  function paint() {
    const st = S.list[S.i], last = S.i === S.list.length - 1, el = st.el ? document.querySelector(st.el) : null;
    S.bub.querySelector('.lk').textContent = S.i ? `Step ${S.i} of ${S.list.length - 1}` : 'First time here?';
    S.bub.querySelector('h3').textContent = st.title; S.bub.querySelector('p').textContent = st.text.replace('{n}', ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'][S.list.length - 2] || String(S.list.length - 1));
    const la = S.bub.querySelector('.la'); la.innerHTML = '<span class="dots">' + S.list.map((_, k) => `<i class="${k === S.i ? 'on' : ''}"></i>`).join('') + '</span>';
    const btn = (label, cls, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; if (cls) b.className = cls; b.onclick = (e) => { e.stopPropagation(); fn(); }; la.appendChild(b); };
    if (!S.i) { btn('Skip', '', () => close()); btn('Show me', 'p', () => go(1)); }
    else if (st.guide) { btn('Done', '', () => close()); const a = document.createElement('a'); a.className = 'g'; a.href = '/how-it-works.html'; a.textContent = 'Full guide'; a.onclick = () => markSeen(); la.appendChild(a); }
    else { btn('Back', '', () => go(-1)); btn(last ? 'Done' : 'Next', 'p', () => go(1)); }
    // the ring round the target, the bubble under it (or over it when there is no room), the arrow at the target
    const W = innerWidth, H = innerHeight, bw = S.bub.offsetWidth, bh = S.bub.offsetHeight, arw = S.bub.querySelector('.arw');
    if (!el) {
      S.wrap.classList.remove('ring'); S.ring.style.opacity = '0'; arw.style.display = 'none';
      S.bub.style.left = Math.round((W - bw) / 2) + 'px'; S.bub.style.top = Math.round((H - bh) / 2) + 'px'; return;
    }
    const r = el.getBoundingClientRect(), pad = 8, x = Math.max(4, r.left - pad), y = Math.max(4, r.top - pad), w = Math.min(W - 8, r.width + pad * 2), h = Math.min(H - 8, r.height + pad * 2);
    S.wrap.classList.add('ring'); S.ring.style.opacity = '1';
    Object.assign(S.ring.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
    const below = y + h + 14 + bh <= H - 8 || y < H / 2, top = below ? Math.min(H - bh - 8, y + h + 14) : Math.max(8, y - 14 - bh);
    const left = Math.min(W - bw - 16, Math.max(16, r.left + r.width / 2 - bw / 2));
    S.bub.style.left = Math.round(left) + 'px'; S.bub.style.top = Math.round(top) + 'px';
    arw.style.display = ''; arw.className = 'arw ' + (below ? 'up' : 'down'); arw.style.left = Math.round(Math.min(bw - 26, Math.max(12, r.left + r.width / 2 - left - 7))) + 'px';
  }
  // the ? button, under the sign-in circle at the top left
  function button() {
    if (document.getElementById('lobbyHelp')) return; style();
    const b = document.createElement('button'); b.id = 'lobbyHelp'; b.type = 'button'; b.textContent = '?'; b.title = 'How it works'; b.setAttribute('aria-label', 'How it works: the lobby tour');
    b.onclick = () => start(); document.body.appendChild(b); place();
    window.addEventListener('resize', place);
    setInterval(place, 1500); // (the sign-in circle changes size when the account loads)
  }
  function place() {
    const b = document.getElementById('lobbyHelp'); if (!b) return;
    const chip = document.getElementById('econChip'), r = chip && visible(chip) ? chip.getBoundingClientRect() : null;
    const label = r && chip.classList.contains('off') && innerWidth <= 829 ? 16 : 0; // (the "Sign in" under the circle on narrow screens)
    b.style.top = Math.round(r ? r.bottom + 10 + label : 16) + 'px';
  }
  function auto() {
    button();
    if (seen() || /[?&](tour=0|ref=)/.test(location.search)) return;
    setTimeout(() => { if (!S && !document.querySelector('#wallet-modal-backdrop.open, #admin-modal-backdrop.open')) start(); }, 1600);
  }
  window.LobbyTour = { start, auto, close, get open() { return !!S; } };
})();
