// The Forge's walkthrough (Nov 3, Miguel: "a bubble explainer like the lobby in forge 3D character page so people are not
// confused on where to press"). Each screen of the Forge shows a few bubbles the first time it comes up on this device:
// what the screen is and which button to press, the rest of the page dimmed round a ring (the lobby tour's way, in the
// Forge's colours). The ? in the header shows the tips for the screen you are on again.
// The screens are read off the page (the card's "STEP n / 5", the buttons on it), so the Forge's own code needs no hooks.
//   ForgeTour.start(id?)  the tips for that screen, or the one on show (the ? button)
//   ForgeTour.screen()    which screen is on show (tests)
(() => {
  if (window.ForgeTour) return;
  const KEY = 'rebelAntsForgeTour:v1';  // the screens whose tips this device has seen: { summon: 1, concept: 1, ... }
  const seenAll = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } };
  const seen = (id) => !!seenAll()[id];
  const markSeen = (id) => { try { const s = seenAll(); s[id] = 1; localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} };
  const col = new URLSearchParams(location.search).get('col');
  const NOUN = col === 'chumpz' ? 'Chumpz' : col === 'saints' ? 'Saint' : 'Rebel';
  const $ = (s) => document.querySelector(s);
  // on screen: drawn, not hidden, and inside the window (the moves dock and the version chooser wait below it)
  const shown = (el) => {
    if (!el) return null; const r = el.getBoundingClientRect(); if (r.width < 4 || r.height < 4) return null;
    if (r.bottom < 2 || r.top > innerHeight - 2 || r.right < 2 || r.left > innerWidth - 2) return null;
    for (let e = el; e && e !== document.body; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < .05) return null; }
    return el;
  };
  const vis = (sel) => shown($(sel));
  const first = (...sels) => { for (const s of sels) { const e = vis(s); if (e) return e; } return null; };
  const step = () => +((($('#card .eyebrow') || {}).textContent || '').match(/STEP (\d) \/ 5/) || [])[1] || 0;

  // the button at the bottom of the Summon card, and what it does
  const CTA = [
    ['#watchBtn', 'Your forge is running', 'Watch it here. Once the sculpting starts you can close this page: the forge keeps going.'],
    ['#summonBtn', 'Start here', `Summon reads your ${NOUN}'s traits. Nothing is paid yet.`],
    ['#signBtn', 'Sign in with your wallet', `Only the wallet that holds this ${NOUN} can forge it.`],
    ['#payInBtn', 'Sign in to pay', 'A forge is paid with Rebel Points: sign in with Discord, or a name and PIN.'],
    ['#getPtsBtn', 'Get Rebel Points', 'Not enough Rebel Points for a forge yet: this opens the shop. Come back here after.'],
    ['#beginBtn', 'Begin the forge', 'Press to start. A paid forge asks you to tap a second time before it takes any points.']
  ];
  const cta = () => CTA.find(([s]) => vis(s));
  const signedOut = () => (($('#ptsPill strong') || {}).textContent || '').trim() === 'Sign in';

  // the screens, in the order they are looked for; each: when it is on show, and its bubbles (el = what the ring goes round,
  // none = a bubble in the middle; a bubble whose target is not on screen is left out)
  const SCREENS = [
    { id: 'awakened', label: 'Step 5 · Awakened', when: () => step() === 5 && vis('#dock.show') && first('#enterV', '#makeMine'), steps: [
      { el: '#dock', title: 'Your moves', text: 'Tap a move to watch it. ‹ › step through them, KATA plays them all in a row.' },
      { title: 'Look around', text: `Drag to turn your ${NOUN}; scroll or pinch to zoom in.` },
      { el: '#wpnChips', title: 'Its weapon', text: `Pick the weapon your ${NOUN} carries on its back.` },
      { el: '#glBox', title: 'Fit the gloves', text: 'Size, cuffs and colours, with a live preview, then hold to forge them.' },
      { el: '#makeMine', title: 'Make it yours', text: 'This makes it the character you play in Universe.' },
      { el: '#enterV', title: 'Go play', text: 'Into Universe with it.' }
    ] },
    { id: 'awaken', label: 'Step 5 · Awaken', when: () => vis('#awakenBtn'), steps: [
      { el: '#awakenBtn', title: 'Hold to awaken', text: 'Press and hold the circle until its ring fills.' }
    ] },
    { id: 'pick', label: 'Step 4 · Forge', when: () => step() === 4 && first('#chooser.show', '#pickBtn'), steps: [
      { el: () => first('#chooser.show #chV', '#card .vers'), title: 'Three versions', text: 'Tap each version to see it turn in the hall.' },
      { el: () => first('#chooser.show #chGo', '#pickBtn'), title: 'Forge your favourite', text: 'Then press here: the forge gives it a skeleton and 24 moves.' }
    ] },
    { id: 'forged', label: 'Step 4 · Forge', when: () => step() === 4 && vis('#toAwaken'), steps: [
      { el: '#toAwaken', title: 'It’s forged', text: `Press Awaken to bring your ${NOUN} to life.` }
    ] },
    { id: 'forging', label: 'Step 4 · Forge', when: () => step() === 4 && vis('#card .stages'), steps: [
      { el: '#card .stages', title: 'The forge at work', text: `Each stage lights up when it’s done. It takes a while: once the sculpting has started you can close this page; your ${NOUN} keeps forging and is here when you come back.` }
    ] },
    { id: 'views', label: 'Step 3 · Blueprint', when: () => step() === 3 && vis('#viewsOk'), steps: [
      { el: () => first('#center .scroll', '#center'), title: 'All four sides', text: `Front, back and both sides of your ${NOUN}: they should show the same character, with a little space between the arms and the body.` },
      { el: '#viewsOk', title: 'Looks right? Sculpt it', text: 'The forge sculpts three versions from these drawings. You can close the page once it starts.' },
      { el: '#viewsAgain', title: 'Something off?', text: 'Draw the views again: a missing arm, a wrong colour or another face.' }
    ] },
    { id: 'concept', label: 'Step 2 · Ink', when: () => step() === 2 && vis('#acceptBtn'), steps: [
      { el: () => first('#center .inkframe', '#center'), title: `Your ${NOUN}, painted`, text: 'The 3D body is built from this painting: check the colours, the armour and the face.' },
      { el: '#acceptBtn', title: 'Like it? Accept', text: () => 'The forge then draws all four sides.' + (vis('#autoN') ? ' If you press nothing, it goes on by itself when the countdown ends.' : '') },
      { el: '#againBtn', title: 'Not quite right?', text: 'Paint again for a new painting. It uses one of today’s paintings.' },
      { el: '#card .kthumbs', title: 'Your paintings', text: 'Tap an earlier painting to use it instead.' }
    ] },
    { id: 'painting', label: 'Step 2 · Ink', when: () => step() === 2 && !vis('#acceptBtn') && !vis('#nextBtn') && !vis('#retryBtn'), steps: [
      { el: () => first('#center .inkframe', '#center'), title: 'The brush is painting', text: `Your ${NOUN} is being painted from its traits: a few minutes. Keep this page open until the painting shows; once the sculpting starts you can leave.` }
    ] },
    { id: 'summon', label: 'Step 1 · Summon', when: () => step() === 1 && !vis('#npForm') && (cta() || vis('#awakenOld')), steps: [
      { title: 'Welcome to the Rebel Forge', text: `It turns your ${NOUN}’s picture into a 3D character that walks, fights and dances in Universe. Here’s where to press, in {n} quick steps.` },
      { el: () => first('#trail .nodes', '#trail'), title: 'Five steps', text: 'Summon, Ink, Blueprint, Forge, Awaken. You can see how far your forge has got here, and tap a step it has reached to look at it again.' },
      { el: () => { const c = cta(); return c && $(c[0]); }, title: () => (cta() || [])[1], text: () => (cta() || [])[2] },
      { el: '#awakenOld', title: 'Already forged', text: `Awaken your forged ${NOUN} to watch its moves and make it your character.` },
      { el: '#ptsPill', title: () => (signedOut() ? 'Your account' : 'Your Rebel Points'), text: () => (signedOut() ? 'Sign in here with Discord, or a name and PIN: forges are paid with your Rebel Points.' : 'Forges are paid with them. Tap here to get more.') },
      { el: '#lobbyExit', title: 'Back to the lobby', text: 'Any time. Once the sculpting has started, your forge keeps going without you.' },
      { el: '#forgeHelp', title: 'Tips on every step', text: 'Each step shows its own tips the first time you reach it. The ? brings them back.' }
    ] }
  ];
  const byId = (id) => SCREENS.find((s) => s.id === id);
  function screen() {
    if ($('#loader') || vis('#npForm')) return null;
    for (const s of SCREENS) { try { if (s.when()) return s.id; } catch (e) {} }
    return null;
  }
  const target = (st) => (typeof st.el === 'function' ? st.el() : st.el ? vis(st.el) : null);
  const val = (v) => (typeof v === 'function' ? v() : v);

  let css = false, S = null;
  function style() {
    if (css) return; css = true;
    const s = document.createElement('style');
    s.textContent = `#ftWrap{position:fixed;inset:0;z-index:2147482000;pointer-events:auto}
#ftShade{position:fixed;inset:0;background:rgba(4,4,8,.6);transition:opacity .25s}
#ftRing{position:fixed;border-radius:16px;box-shadow:0 0 0 9999px rgba(4,4,8,.6),0 0 0 2px #FFB547,0 0 26px 4px rgba(255,181,71,.5);transition:left .3s ease,top .3s ease,width .3s ease,height .3s ease,opacity .2s;pointer-events:none}
#ftWrap.ring #ftShade{opacity:0}
#ftBub{position:fixed;width:min(340px,calc(100vw - 32px));padding:16px 16px 14px;border-radius:16px;background:linear-gradient(180deg,#1d1722,#110d16);border:1px solid rgba(255,181,71,.55);
  box-shadow:0 18px 50px rgba(0,0,0,.6),0 0 30px rgba(255,181,71,.12);color:#F4EEE2;font:400 14.5px/1.5 Inter,system-ui,-apple-system,'Segoe UI',sans-serif;transition:left .3s ease,top .3s ease}
#ftBub .lk{font:700 10px/1 Cinzel,Georgia,serif;letter-spacing:.24em;text-transform:uppercase;color:#4FB8FF}
#ftBub h3{margin:7px 0 6px;font:700 17px/1.25 Cinzel,Georgia,serif;letter-spacing:.04em;color:#FFF3D6}
#ftBub p{margin:0;color:#c9c0ae}
#ftBub .la{display:flex;align-items:center;gap:8px;margin-top:14px}
#ftBub .la .dots{display:flex;gap:5px;margin-right:auto}
#ftBub .la .dots i{width:6px;height:6px;border-radius:50%;background:rgba(255,181,71,.25)}
#ftBub .la .dots i.on{background:#FFB547}
#ftBub button{min-height:38px;padding:0 14px;border-radius:999px;border:1px solid rgba(255,181,71,.5);background:transparent;color:#FFB547;font:700 11px/1 Cinzel,Georgia,serif;letter-spacing:.12em;text-transform:uppercase;cursor:pointer;display:inline-flex;align-items:center}
#ftBub button.p{background:linear-gradient(135deg,#FF6A1F,#C8321E);border-color:#FF8A47;color:#fff}
#ftBub button.x{position:absolute;right:8px;top:8px;width:30px;min-height:30px;padding:0;justify-content:center;border:0;color:#8d8676;font:400 16px/1 system-ui,sans-serif;letter-spacing:0}
#ftBub .arw{position:absolute;width:14px;height:14px;background:#1b1520;border:1px solid rgba(255,181,71,.55);transform:rotate(45deg)}
#ftBub .arw.up{top:-8px;border-right:0;border-bottom:0}
#ftBub .arw.down{bottom:-8px;border-left:0;border-top:0;background:#110d16}
#forgeHelp{font:700 16px/1 Cinzel,Georgia,serif;color:var(--washi,#F4EEE2);cursor:pointer;padding:0}`;
    document.head.appendChild(s);
  }
  function close(mark = true) {
    if (!S) return; const id = S.id;
    document.removeEventListener('keydown', S.key, true); window.removeEventListener('resize', S.place); clearInterval(S.tick);
    S.wrap.remove(); S = null; if (mark) markSeen(id);
  }
  function start(id) {
    id = id || screen() || 'summon'; const sc = byId(id); if (!sc) return;
    style(); close(false);
    const list = sc.steps.filter((st) => !st.el || target(st));
    if (!list.length) return;
    const wrap = document.createElement('div'); wrap.id = 'ftWrap'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true'); wrap.setAttribute('aria-label', 'How the Forge works');
    wrap.innerHTML = '<div id="ftShade"></div><div id="ftRing"></div><div id="ftBub"><button class="x" type="button" aria-label="Close the tips">✕</button><div class="lk"></div><h3></h3><p></p><div class="la"></div><div class="arw"></div></div>';
    document.body.appendChild(wrap);
    S = { id, sc, wrap, list, i: 0, ring: wrap.querySelector('#ftRing'), bub: wrap.querySelector('#ftBub') };
    S.bub.querySelector('.x').onclick = () => close();
    // the Forge behind does nothing while the tips are up: a click on the dim area goes on to the next bubble
    wrap.addEventListener('click', (e) => { if (!S.bub.contains(e.target)) go(1); });
    wrap.addEventListener('pointerdown', (e) => e.stopPropagation());
    S.key = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
      else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); go(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); go(-1); }
      else if (e.key === ' ' || /^[lsk]$/i.test(e.key)) { e.stopPropagation(); }   // (the moves' keys wait for the tips)
    };
    document.addEventListener('keydown', S.key, true);
    S.place = () => S && place(); window.addEventListener('resize', S.place);
    // the card re-draws itself while the forge works (its buttons are new each time) and the screen can move on (the
    // concept goes on by itself after 30 s): the ring follows its target, and the tips close when their screen is gone
    S.tick = setInterval(() => { if (!S) return; const now = screen(); if (now && now !== S.id) return close(); place(); }, 400);
    fill(); place();
    setTimeout(() => S?.bub.querySelector('.la button.p')?.focus({ preventScroll: true }), 60);
  }
  function go(d) {
    if (!S) return; const n = S.i + d;
    if (n >= S.list.length) return close();
    if (n < 0) return;
    S.i = n; S.scrolled = false; fill(); place();
  }
  function fill() {
    const st = S.list[S.i], last = S.i === S.list.length - 1, intro = S.id === 'summon' && S.i === 0 && !st.el;
    S.bub.querySelector('.lk').textContent = intro ? 'First time here?' : S.list.length > 1 ? `${S.sc.label} · ${S.i + 1} of ${S.list.length}` : S.sc.label;
    S.bub.querySelector('h3').textContent = val(st.title) || '';
    S.bub.querySelector('p').textContent = (val(st.text) || '').replace('{n}', ['one', 'two', 'three', 'four', 'five', 'six', 'seven'][S.list.length - 2] || String(S.list.length - 1));
    const la = S.bub.querySelector('.la'); la.innerHTML = S.list.length > 1 ? '<span class="dots">' + S.list.map((_, k) => `<i class="${k === S.i ? 'on' : ''}"></i>`).join('') + '</span>' : '<span class="dots"></span>';
    const btn = (label, cls, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; if (cls) b.className = cls; b.onclick = (e) => { e.stopPropagation(); fn(); }; la.appendChild(b); };
    if (intro) { btn('Skip', '', () => close()); btn('Show me', 'p', () => go(1)); }
    else if (S.list.length === 1) btn('Got it', 'p', () => close());
    else { if (S.i) btn('Back', '', () => go(-1)); btn(last ? 'Done' : 'Next', 'p', () => go(1)); }
  }
  // the ring round the target, the bubble under it (or over it when there is no room), the arrow at the target
  function place() {
    const st = S.list[S.i], el = st.el ? target(st) : null, W = innerWidth, H = innerHeight, bw = S.bub.offsetWidth, bh = S.bub.offsetHeight, arw = S.bub.querySelector('.arw');
    if (!el) {
      S.wrap.classList.remove('ring'); S.ring.style.opacity = '0'; arw.style.display = 'none';
      S.bub.style.left = Math.round((W - bw) / 2) + 'px'; S.bub.style.top = Math.round((H - bh) / 2) + 'px'; return;
    }
    // a target down the card (it scrolls) comes into view first, once per bubble
    if (!S.scrolled) { S.scrolled = true; const c = el.closest('#card'); if (c) { const u = c.getBoundingClientRect(), q = el.getBoundingClientRect(); if (q.bottom > u.bottom - 8) c.scrollTop += q.bottom - (u.bottom - 8); else if (q.top < u.top + 8) c.scrollTop -= u.top + 8 - q.top; } }
    const r = el.getBoundingClientRect(), pad = 8, x = Math.max(4, r.left - pad), y = Math.max(4, r.top - pad), w = Math.min(W - 8 - x, r.width + pad * 2), h = Math.min(H - 8 - y, r.height + pad * 2);
    S.wrap.classList.add('ring'); S.ring.style.opacity = '1';
    Object.assign(S.ring.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
    const roomBelow = H - 8 - (y + h + 14), roomAbove = y - 14 - 8;
    let below = roomBelow >= bh || (roomBelow >= roomAbove && roomAbove < bh), top = below ? y + h + 14 : y - 14 - bh;
    if (top + bh > H - 8 || top < 8) { below = null; top = Math.max(8, Math.min(H - bh - 8, top)); }   // a big target: the bubble goes over it
    const left = Math.min(W - bw - 16, Math.max(16, r.left + r.width / 2 - bw / 2));
    S.bub.style.left = Math.round(left) + 'px'; S.bub.style.top = Math.round(top) + 'px';
    if (below === null) { arw.style.display = 'none'; return; }
    arw.style.display = ''; arw.className = 'arw ' + (below ? 'up' : 'down'); arw.style.left = Math.round(Math.min(bw - 26, Math.max(12, r.left + r.width / 2 - left - 7))) + 'px';
  }
  // the ? in the header, before the sound button
  function button() {
    if ($('#forgeHelp')) return; style();
    const snd = $('#sndBtn'); if (!snd) return;
    const b = document.createElement('button'); b.id = 'forgeHelp'; b.type = 'button'; b.className = 'iconbtn'; b.textContent = '?'; b.title = 'How the Forge works';
    b.setAttribute('aria-label', 'How the Forge works: tips for this step');
    b.onclick = () => start();
    snd.parentNode.insertBefore(b, snd);
  }
  // the tips come up by themselves the first time a screen settles on show (the same screen two looks running, 0.7 s apart)
  let last = null, since = 0;
  function watch() {
    if (S) return;
    const id = screen();
    if (id !== last) { last = id; since = Date.now(); return; }
    if (!id || seen(id) || Date.now() - since < 1200 || /[?&]tips=0/.test(location.search)) return;
    if (document.hidden) return;
    start(id);
  }
  function init() { button(); setInterval(watch, 700); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.ForgeTour = { start, close, screen, get open() { return S ? S.id : null; } };
})();
