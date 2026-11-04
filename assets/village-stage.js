// Universe multiplayer, the Colony Stage (step 6): events. The page asks /api/mp-events now and then (every minute): an
// event on now shows a LIVE banner (Go there: to its village, then a gold mark on the minimap at its room's door). At the
// event's place (its room, or its village outside) the page opens the event's hall (/v1/stage?id=, realtime/src/stage.js):
// the stage bar (LIVE · title · how many are here; Raise hand; hosts: the raised hands, Start / Stop the show), the Event
// channel in the chat (village-chat.js), the hosts' voices (village-voice.js, scope 'stage'), and the show: its audio, or
// for each line a babbling voice with the words as captions, started at the same second on every page; in Antthony's
// Comedy Club the performer stands at the mic (Rebel #001's rig: its jaw moves with the voice).
// The show's audio (Nov 4) is fetched and decoded as the page joins the hall and played from that buffer in the stage's
// own Web Audio: an <audio> made when the show starts never plays on an iPhone (WebKit starts a media element only
// inside a tap, a click or a key, and a show starts on the server's clock), while the stage's sound starts on any finger
// lift (assets/audio-unlock.js). A page whose sound was stopped (a call, the background) picks it up where the show is.
// The performer is loaded as the page joins the hall too, and shows when the show starts.
// A dropped connection to the hall (Nov 4: a phone's network, a screen that slept; he vanished near the end and came
// back) no longer stops the show: it plays on from the page's own copy while the page knocks again (GRACE_MS), and a
// phone's screen is kept on while a show plays (the Screen Wake Lock), so watching without touching doesn't lock it.
// Captions (Nov 4, Miguel's iPhone: "the caption is in the way of seeing him"): at most two lines at a time (a long
// line is shown in parts, each for its share of the time), and placed clear of the performer: phones at the top in the
// logo's place (the stick and the buttons fill the bottom), computers at the bottom; the other side when he is there.
// window.VillageStage.start(host) from village.html, host = { scene, village, villageName(id), player() -> { x, z, interior }
//   | null, signedIn(), ticket() -> Promise<{ ticket, url }|null>, travel(villageId), doorOf(roomId) -> { x, z } | null,
//   roomHolder() -> the shown room's node | null, enterRoom(roomId) -> bool (through its door), sound(name), viaSite(url),
//   toast(msg), canAct() }
(function () {
  'use strict';
  const PROTOCOL = 'rebel-universe.v1', POLL_MS = 60000, GOTO_KEY = 'rebelAntsStageGoTo:v1', SET_KEY = 'rebelAntsStageSet:v1';
  // where a performer stands in a room (room coordinates: x, floor height, z, facing): the Comedy Club's mic (Nov 4: in
  // front of its stand, now that he holds his own mic: behind it, the stand's mic hid his face and the mic in his hand)
  const STAGE_SPOTS = { hub_comedy_club: [0, 1.1, -7.65, 0] };
  const PERFORMER = { col: 'battle_for_colony', tok: '1', scale: 1.9 }; // (Rebel #001, the master: his public character's rig)
  const log = (...a) => { if (window._mpDebug) console.log('[stage]', ...a); };
  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v && typeof v === 'object' ? { ...d, ...v } : { ...d }; } catch (e) { return { ...d }; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const settings = load(SET_KEY, { show: true, captions: true });
  let H = null, B = null, ws = null, connecting = false, retryAt = 0, stopped = null, hall = null, pollAt = 0, offset = 0, listeners = new Set();
  // (a hall whose connection dropped: the event and its show stay on this page until it is back in, or this passes)
  const GRACE_MS = 60000; let graceUntil = 0, graceTries = 0;
  const inHall = () => !!(S.ev && (hall || graceUntil > performance.now()));
  let wanted = new URLSearchParams(location.search).get('event'), wantedEv = null; // (the lobby's LIVE NOW: village.html?village=..&event=<id>)
  const S = { live: [], next: [], ev: null, host: false, you: null, speakers: [], hands: [], hand: false, show: null, n: 0, cfg: { chat: true, slow: 5, voice: false }, mute: 0, goal: null };
  const emit = (kind, d) => { for (const f of listeners) try { f(kind, d); } catch (e) {} };
  try { const g = JSON.parse(localStorage.getItem(GOTO_KEY) || 'null'); if (g && g.id && g.until > Date.now()) S.goal = g; } catch (e) {}
  const setGoal = g => { S.goal = g; try { if (g) localStorage.setItem(GOTO_KEY, JSON.stringify(g)); else localStorage.removeItem(GOTO_KEY); } catch (e) {} };
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---- which events are on (the public list, every minute) ----
  async function poll(force) {
    const now = Date.now(); if (!force && now < pollAt) return; pollAt = now + POLL_MS;
    try {
      const r = await fetch('/api/mp-events', { cache: 'no-store' }); if (!r.ok) return;
      const d = await r.json(); if (!d?.ok) return;
      S.live = Array.isArray(d.live) ? d.live : []; S.next = Array.isArray(d.next) ? d.next : [];
      if (S.goal && !S.live.some(e => e.id === S.goal.id)) setGoal(null);
      if (wanted) { const ev = S.live.find(e => e.id === wanted); if (ev) { wanted = null; wantedEv = ev; } else if (Date.now() - startedAt > 15000) wanted = null; }
      paint();
    } catch (e) { log('poll', e); }
  }
  const me = () => H.player?.() || null;
  const atPlace = ev => { const p = ev?.place, m = me(); return !!(p && m && p.village === H.village && (p.room || null) === (m.interior || null)); };
  const placeName = ev => ev?.place?.label || (H.villageName?.(ev?.place?.village) || ev?.place?.village || '');

  // ---- the hall: the socket while at the event's place ----
  async function connect(id) {
    if (ws || connecting || stopped) return;
    connecting = true;
    try {
      const t = await H.ticket().catch(() => null);
      if (!t || !t.ticket || !t.url) { retryAt = performance.now() + 8000; return; }
      if (ws || stopped) return;
      let s; try { s = new WebSocket(t.url + '/v1/stage?id=' + encodeURIComponent(id), [PROTOCOL, 't.' + t.ticket]); } catch (e) { retryAt = performance.now() + 8000; return; }
      ws = s; hall = id;
      s.onmessage = e => { if (ws !== s) return; let m; try { m = JSON.parse(e.data); } catch (err) { return; } try { onMessage(m); } catch (err) { log('bad message', err); } };
      s.onclose = e => {
        if (ws !== s) return;
        ws = null; const was = hall; hall = null;
        log('closed', e.code, e.reason);
        // dropped after it was in (the network, a phone that slept): the show plays on while the page knocks again
        if (S.ev && e.code !== 4001 && e.code !== 4003 && e.code !== 4004) {
          if (!graceUntil) { graceUntil = performance.now() + GRACE_MS; graceTries = 0; }
          voiceReset(); paint();
          retryAt = performance.now() + Math.min(8000, 800 * 2 ** graceTries++) + Math.random() * 800; return;
        }
        graceUntil = 0; leaveHall();
        if (e.code === 4001) { stopped = 'dup'; return; }
        if (e.code === 4003) { stopped = 'kick'; return; }
        if (e.code === 4004 || e.code === 1006) { S.live = S.live.filter(x => x.id !== was); paint(); pollAt = 0; }
        retryAt = performance.now() + 4000 + Math.random() * 4000;
      };
      s.onerror = () => {};
    } finally { connecting = false; }
  }
  const send = o => { if (ws && ws.readyState === 1) { ws.send(JSON.stringify(o)); return true; } return false; };
  function close() { const s = ws; ws = null; hall = null; graceUntil = 0; try { s?.close(1000, 'left'); } catch (e) {} leaveHall(); }
  function leaveHall() {
    S.ev = null; S.host = false; S.speakers = []; S.hands = []; S.hand = false; S.show = null; S.n = 0;
    stopShow(); voiceReset(); paint(); emit('left', {});
  }
  const voice = m => { try { window.VillageVoice?.stage?.(m); } catch (e) { log('voice', e); } };
  const voiceReset = () => { try { window.VillageVoice?.reset?.('stage'); } catch (e) {} };
  function onMessage(m) {
    const t = m.t;
    if (t === 'shi') {
      graceUntil = 0; graceTries = 0; S.ev = m.ev; S.host = !!m.host; S.you = m.you; S.speakers = m.speakers || []; S.hands = m.hands || []; S.hand = !!m.hand; S.n = m.n || 1;
      S.cfg = m.cfg || S.cfg; S.mute = m.mute || 0; S.show = m.show || null; offset = (+m.now || Date.now()) - Date.now();
      if (S.goal && S.goal.id === m.ev?.id) setGoal(null);
      try { if (m.ev?.id) { window.badgeStat?.('events', String(m.ev.id)); if (S.host) window.badgeStat?.('hosted', String(m.ev.id)); } } catch (e) {} // (the badges)
      voice({ t: 'vcfg', on: !!S.cfg.voice }); emit('hello', m); paint(); return;
    }
    if (t === 'sc' || t === 'scx' || t === 'scd' || t === 'scc' || t === 'rpok') { emit(t === 'sc' ? 'msg' : t, t === 'sc' ? m.m : m); return; }
    if (t === 'shands') { S.hands = m.hands || []; paint(); return; }
    if (t === 'shand') { S.hand = !!m.on; paint(); return; }
    if (t === 'sspk') {
      const was = S.speakers.some(s => s.u === S.you); S.speakers = m.speakers || []; const now = S.speakers.some(s => s.u === S.you);
      if (now && !was) { try { window.badgeStat?.('stage'); } catch (e) {} S.hand = false; H.toast?.(S.cfg.voice ? "You're on stage: hold X (the Talk button) to talk to everyone here." : "You're on stage."); }
      if (was && !now) H.toast?.("You're back in the audience.");
      voice({ t: 'vo', key: '', on: true }); paint(); return;
    }
    if (t === 'sshow') { S.show = m.show || null; offset = (+m.now || Date.now()) - Date.now(); stopShow(); paint(); return; }
    if (t === 'sev') {
      S.ev = m.ev;
      if ('show' in m) { const was = S.show; S.show = m.show || null; if (m.now) offset = +m.now - Date.now(); if (!S.show || !was || was.startAt !== S.show.startAt || was.audio !== S.show.audio || was.len !== S.show.len) stopShow(); }
      paint(); return;
    }
    if (t === 'shost') { S.host = !!m.host; if (m.hands) S.hands = m.hands; paint(); return; }
    if (t === 'sn') { S.n = m.n || S.n; paint(); return; }
    if (t === 'scfg') { S.cfg = { chat: m.chat !== false, slow: m.slow || 5, voice: !!m.voice }; voice({ t: 'vcfg', on: !!m.voice }); paint(); return; }
    if (t === 'scm') { S.mute = m.until || 0; voice({ t: 'vmute', until: m.until }); return; }
    // (sent away or over: this page closes the socket itself too; the server's own close can come late, or not at all)
    if (t === 'kick') { stopped = 'kick'; close(); return; }
    if (t === 'sdup') { stopped = 'dup'; close(); return; }
    if (t === 'send') { const was = S.ev?.id; H.toast?.('The event is over. Thanks for coming!'); close(); S.live = S.live.filter(x => x.id !== was); pollAt = 0; paint(); return; }
    if (t === 'vo' || t === 'vp' || t === 'vs') return voice(m);
  }

  // ---- what the page shows: the LIVE banner (away), the stage bar (here), the hosts' panel, captions ----
  let el = null;
  const css = `
#vsLive,#vsBar{position:fixed;left:50%;top:52px;transform:translateX(-50%);z-index:19;display:none;align-items:center;gap:10px;max-width:calc(100vw - 32px);padding:7px 8px 7px 12px;
  background:rgba(14,6,22,.9);border:1px solid rgba(232,197,106,.55);box-shadow:0 8px 24px rgba(0,0,0,.45);color:#f6ecd2;font:600 12.5px/1.25 -apple-system,'Segoe UI',Arial,sans-serif;backdrop-filter:blur(8px)}
#vsLive.on,#vsBar.on{display:flex}
#vsLive .dot,#vsBar .dot{flex:none;width:9px;height:9px;border-radius:50%;background:#ff4d5e;box-shadow:0 0 0 0 rgba(255,77,94,.7);animation:vsp 1.4s infinite}
@keyframes vsp{0%{box-shadow:0 0 0 0 rgba(255,77,94,.7)}70%{box-shadow:0 0 0 8px rgba(255,77,94,0)}100%{box-shadow:0 0 0 0 rgba(255,77,94,0)}}
#vsLive .tx,#vsBar .tx{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#vsLive b,#vsBar b{color:#ffe29a;font-weight:800;letter-spacing:.3px}
#vsLive small,#vsBar small{color:#cbbfa5;font-weight:600}
#vsLive button,#vsBar button,#vsHost button{flex:none;font:800 10px/1 'Cinzel Decorative',serif;letter-spacing:1.2px;padding:8px 11px;min-height:32px;background:rgba(232,197,106,.16);border:1px solid rgba(232,197,106,.7);color:#fff3cf;cursor:pointer;text-transform:uppercase}
#vsLive button.x{background:transparent;border-color:rgba(255,255,255,.22);color:#cfd6e6;padding:8px 9px}
#vsBar button.on{background:rgba(255,224,138,.5);color:#1a1206}
#vsHost{position:fixed;left:50%;top:100px;transform:translateX(-50%);z-index:21;display:none;width:min(340px,calc(100vw - 32px));max-height:min(60vh,420px);overflow:auto;padding:10px 12px;
  background:rgba(14,6,22,.96);border:1px solid rgba(232,197,106,.55);color:#f6ecd2;font:13px/1.35 -apple-system,'Segoe UI',Arial,sans-serif}
#vsHost.on{display:block}
#vsHost .h{font:700 9px/1 'Cinzel Decorative',serif;letter-spacing:2px;color:#e8c56a;text-transform:uppercase;margin:6px 0 6px}
#vsHost .r{display:flex;align-items:center;gap:8px;padding:5px 0;border-top:1px solid rgba(255,255,255,.07)}
#vsHost .r span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#vsHost .dim{color:#a99f8a;font-size:12px}
#vsCap{position:fixed;left:50%;bottom:max(118px,17vh);transform:translateX(-50%);z-index:18;display:none;max-width:min(680px,calc(100vw - 32px));padding:9px 16px;text-align:center;
  background:rgba(6,4,12,.78);color:#fff;font:600 17px/1.35 -apple-system,'Segoe UI',Arial,sans-serif;border-left:3px solid #e8c56a;text-wrap:balance}
#vsCap.on{display:block}
#vsCap b{display:block;font:700 9px/1 'Cinzel Decorative',serif;letter-spacing:2px;color:#e8c56a;margin-bottom:5px;text-transform:uppercase}
html.vt-touch #vsLive,html.vt-touch #vsBar{top:calc(max(12px,env(safe-area-inset-top,0px)) + 194px);font-size:12px}
html.vt-touch #vsHost{top:calc(max(12px,env(safe-area-inset-top,0px)) + 242px)}
html.vt-touch body:has(#vsLive.on,#vsBar.on) #interactionPrompt{top:262px}
html.vt-touch #vsCap{bottom:calc(max(18px,env(safe-area-inset-bottom,0px)) + 236px);font-size:15px}
#vsCap.top{top:104px;bottom:auto}
@media (max-width:900px){html:not(.vt-touch) #vsCap.top{top:200px}}
html.vt-touch #vsCap.top{top:calc(max(12px,env(safe-area-inset-top,0px)) + 2px);bottom:auto;left:max(12px,env(safe-area-inset-left,0px));right:calc(max(12px,env(safe-area-inset-right,0px)) + 52px);transform:none;max-width:none;padding:7px 12px;font-size:15px}
html.vt-touch #vsCap.top b{display:none}
html.vt-touch body.vs-cap-top #logo,html.vt-touch body.vs-cap-top #td{opacity:0;transition:opacity .3s}
body.in-game #vsLive,body.in-game #vsBar,body.in-game #vsHost{display:none!important}
@media (min-width:901px) and (max-width:1459px){html:not(.vt-touch) #vsLive,html:not(.vt-touch) #vsBar,html:not(.vt-touch) #vsHost{left:446px;transform:none}html:not(.vt-touch) #vsLive,html:not(.vt-touch) #vsBar{max-width:calc(100vw - 600px)}}
@media (max-width:900px){html:not(.vt-touch) #vsLive,html:not(.vt-touch) #vsBar{top:152px}html:not(.vt-touch) #vsHost{top:200px}}`; // (desktop: clear of Exit Walk (left 340, top 82) and the quest line)
  function build() {
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    const mk = (id) => { const d = document.createElement('div'); d.id = id; document.body.appendChild(d); for (const t of ['pointerdown', 'keydown']) d.addEventListener(t, e => e.stopPropagation()); return d; };
    el = { live: mk('vsLive'), bar: mk('vsBar'), host: mk('vsHost'), cap: mk('vsCap') };
    el.cap.removeEventListener?.('pointerdown', () => {});
  }
  const btn = (label, fn, cls) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; if (cls) b.className = cls; b.onclick = e => { e.stopPropagation(); fn(); }; return b; };
  let hostOpen = false, dismissed = '';
  function paint() {
    if (!el) return;
    const here = S.ev && inHall(), back = !hall; // (back: the connection dropped, the page is knocking again)
    // away: the first event on now that this page is not at
    const away = !here && S.live.find(ev => !atPlace(ev) && ev.id !== dismissed);
    el.live.classList.toggle('on', !!away && !!H.canAct?.());
    const kLive = away ? [away.id, away.title, placeName(away), S.goal?.id === away.id].join('|') : '';
    if (away && el.live.dataset.k !== kLive) {
      el.live.dataset.k = kLive;
      el.live.innerHTML = `<span class="dot"></span><span class="tx"><b>LIVE</b> · ${esc(away.title)} <small>· ${esc(placeName(away))}</small></span>`;
      el.live.append(btn(S.goal?.id === away.id ? '✓ Going' : 'Go there', () => goTo(away)), btn('✕', () => { dismissed = away.id; paint(); }, 'x'));
    }
    if (!away) el.live.dataset.k = '';
    el.bar.classList.toggle('on', !!here);
    const speakingNow = here && S.speakers.some(s => s.u === S.you), showOn = !!(S.show && showTime() >= 0 && showTime() < S.show.len);
    const deaf = !!(showOn && actx && actx.state !== 'running' && settings.show); // (an iPhone's sound waits for a tap)
    const gold = here ? GOLD.of(S.ev.id) : null;
    const kBar = here ? [S.ev.id, S.ev.title, S.n, showOn, deaf, back, S.host, S.hands.length, hostOpen, speakingNow, S.hand, H.signedIn(), gold ? gold.mine + ':' + gold.left : ''].join('|') : '';
    if (!here) el.bar.dataset.k = '';
    if (here && el.bar.dataset.k !== kBar) {
      el.bar.dataset.k = kBar;
      el.bar.innerHTML = `<span class="dot"></span><span class="tx"><b>LIVE</b> · ${esc(S.ev.title)} <small>· ${S.n} here${showOn ? (deaf ? ' · 🔇 tap the screen to hear the show' : ' · the show is on') : ''}${back ? ' · reconnecting…' : ''}</small></span>`;
      const speaking = S.speakers.some(s => s.u === S.you);
      if (S.host) el.bar.append(btn('Host · ' + S.hands.length + ' ✋', () => { hostOpen = !hostOpen; paint(); }, hostOpen ? 'on' : ''));
      else if (speaking) el.bar.append(btn('On stage', () => send({ t: 'hand', on: false }), 'on'));
      else if (H.signedIn()) el.bar.append(btn(S.hand ? '✋ Lower' : '✋ Raise hand', () => send({ t: 'hand', on: !S.hand }), S.hand ? 'on' : ''));
      // golden tickets (the front row): what this player holds, or the card to get one
      if (gold && window.GoldenTicket) { const holds = gold.mine === 'bought' || gold.mine === 'won';
        el.bar.append(btn(holds ? '✦ Front row' : '✦ Ticket', () => window.GoldenTicket.open({ event: S.ev.id, title: S.ev.title, signIn: H.signIn, onChange: (g) => { GOLD.set(S.ev.id, g); paint(); } }), holds ? 'on' : '')); }
    }
    el.host.classList.toggle('on', !!(here && S.host && hostOpen));
    const kHost = here && S.host && hostOpen ? JSON.stringify([S.hands.map(x => [x.u, x.n]), S.speakers.map(x => [x.u, x.n]), S.ev.show?.title || '', S.ev.show ? !!(S.show && showTime() < S.show.len) : 0]) : '';
    if (!kHost) el.host.dataset.k = '';
    if (kHost && el.host.dataset.k !== kHost) {
      el.host.dataset.k = kHost;
      el.host.innerHTML = '';
      const h = (t) => { const d = document.createElement('div'); d.className = 'h'; d.textContent = t; el.host.appendChild(d); };
      const row = (text, ...buttons) => { const r = document.createElement('div'); r.className = 'r'; const s = document.createElement('span'); s.textContent = text; r.append(s, ...buttons); el.host.appendChild(r); };
      h('Raised hands');
      if (!S.hands.length) { const d = document.createElement('div'); d.className = 'dim'; d.textContent = 'No hands up.'; el.host.appendChild(d); }
      for (const x of S.hands) row(x.n, btn('Bring up', () => send({ t: 'up', u: x.u })), btn('✕', () => send({ t: 'down', u: x.u }), 'x'));
      h('On stage');
      const sp = S.speakers; if (!sp.length) { const d = document.createElement('div'); d.className = 'dim'; d.textContent = 'Only the hosts.'; el.host.appendChild(d); }
      for (const x of sp) row(x.n, btn('Send down', () => send({ t: 'down', u: x.u })));
      if (S.ev.show) {
        h('The show · ' + S.ev.show.title);
        const on = S.show && showTime() < S.show.len;
        row(on ? 'Playing' : Math.round(S.ev.show.len / 60) + ' min', btn(on ? 'Stop the show' : 'Start the show', () => send({ t: 'show', go: on ? 0 : 1 })));
      }
    }
  }
  // Go there: another village = travel (the page there walks on); here = a gold mark at the door (or the spot)
  function goTo(ev) {
    if (ev.place.village !== H.village) { setGoal({ id: ev.id, until: Date.now() + 10 * 60000 }); H.toast?.('Off to ' + (H.villageName?.(ev.place.village) || ev.place.village) + ' for ' + ev.title + '…'); H.travel?.(ev.place.village); return; }
    const m = me();
    if (ev.place.room && m?.interior && m.interior !== ev.place.room) { H.toast?.('Leave this room first: ' + ev.title + ' is in ' + placeName(ev) + '.'); return; }
    setGoal({ id: ev.id, until: Date.now() + 10 * 60000 }); paint();
    H.toast?.(ev.place.room ? 'Follow the gold mark on the map to the door of ' + placeName(ev) + '.' : ev.title + ' is here: look around!');
  }
  // the minimap's mark: the door of the event being gone to
  function dots() {
    const g = S.goal; if (!g) return null;
    const ev = S.live.find(e => e.id === g.id); if (!ev || ev.place.village !== H.village || !ev.place.room || atPlace(ev)) return null;
    const d = H.doorOf?.(ev.place.room); return d ? [{ x: d.x, z: d.z, n: ev.title, goal: true, door: true, color: '#e8c56a' }] : null;
  }

  // ---- the show: the same second on every page ----
  const showTime = () => (S.show ? (Date.now() + offset - S.show.startAt) / 1000 : -1);
  let SH = null; // { key, src, srcAt, an, buf, cues, next, cap, capUntil, level, syl, plan }
  let actx = null, master = null;
  function audioCtx() {
    if (actx) { if (actx.state === 'suspended') actx.resume().catch(() => {}); return actx; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    // (24 kHz: the sets are voiced at 24 kHz, and a decoded minute of them takes half the memory it would at 48)
    try { actx = new AC({ sampleRate: 24000 }); } catch (e) { actx = new AC(); }
    master = actx.createGain(); master.gain.value = 1; master.connect(actx.destination); return actx;
  }
  // the show's audio file: fetched and decoded once (by the hall's page, before the show starts), kept while there
  const AUD = { url: '', buf: null, loading: false, failed: '' };
  function showAudio(url) {
    if (!url) return null;
    if (AUD.url !== url) { AUD.url = url; AUD.buf = null; AUD.loading = false; AUD.failed = ''; }
    if (AUD.buf || AUD.failed || AUD.loading) return AUD.buf;
    const ac = audioCtx(); if (!ac) { AUD.failed = 'no Web Audio'; return null; }
    AUD.loading = true;
    (async () => {
      try {
        const r = await fetch(H.viaSite ? H.viaSite(url) : url); if (!r.ok) throw new Error('HTTP ' + r.status);
        const data = await r.arrayBuffer(); if (AUD.url !== url) return;
        const buf = await new Promise((res, rej) => { const p = ac.decodeAudioData(data, res, rej); if (p && p.then) p.then(res, rej); });
        if (AUD.url === url) { AUD.buf = buf; log('show audio', url.split('/').pop(), buf.duration.toFixed(1) + ' s'); }
      } catch (e) { if (AUD.url === url) { AUD.failed = String(e?.message || e || 'failed'); log('show audio failed', AUD.failed); } }
      finally { if (AUD.url === url) AUD.loading = false; }
    })();
    return null;
  }
  const dropAudio = () => { AUD.url = ''; AUD.buf = null; AUD.loading = false; AUD.failed = ''; };
  function stopSrc() { const s = SH?.src; if (!s) return; SH.src = null; try { s.onended = null; s.stop(); } catch (e) {} try { s.disconnect(); } catch (e) {} }
  // keep the buffer playing at the show's own second: started when it is ready and the sound is on (a page that joins
  // late starts in the middle), started again where the show is when it drifted half a second (a stopped sound came back)
  function audioTick(t) {
    const ac = actx, buf = SH.audioUrl && AUD.url === SH.audioUrl ? AUD.buf : null;
    if (!buf || !ac || ac.state !== 'running') return;
    if (t >= buf.duration - .05) { stopSrc(); return; }
    if (SH.src) { if (Math.abs(ac.currentTime - SH.srcAt - t) <= .5) return; stopSrc(); }
    if (t < -3) return;
    const s = ac.createBufferSource(); s.buffer = buf; s.connect(SH.an);
    const when = ac.currentTime + (t < 0 ? -t : .04), off = t < 0 ? 0 : t + .04;
    s.start(when, off); SH.src = s; SH.srcAt = when - off;
    s.onended = () => { if (SH && SH.src === s) SH.src = null; };
    log('show audio from', off.toFixed(2));
  }
  function startShow() {
    stopShow();
    const sh = S.show; if (!sh) return;
    SH = { key: sh.startAt, cues: sh.cues || [], next: 0, sfxNext: 0, cap: '', capUntil: 0, level: 0, syl: [], src: null, srcAt: 0, audioUrl: sh.audio || '' };
    const ac = audioCtx();
    if (ac) { const an = ac.createAnalyser(); an.fftSize = 512; an.connect(master); SH.an = an; SH.buf = new Float32Array(an.fftSize); }
    if (sh.audio) showAudio(sh.audio);
    // skip what is already over (a late arrival comes in mid-show)
    const t = showTime(); while (SH.next < SH.cues.length && SH.cues[SH.next].t < t - .25) SH.next++;
    loadPerformer(); wakeOn();
    log('show', sh.title, t.toFixed(1));
  }
  // a phone's screen kept on while a show plays (asked again when the page comes back, and on a tap when refused)
  const WAKE = { lock: null, want: false, asking: false, at: 0 };
  async function wakeOn() {
    WAKE.want = true;
    if (WAKE.lock || WAKE.asking || !navigator.wakeLock || document.visibilityState !== 'visible' || performance.now() - WAKE.at < 3000) return;
    WAKE.asking = true; WAKE.at = performance.now();
    try {
      const l = await navigator.wakeLock.request('screen');
      if (!WAKE.want) { l.release().catch(() => {}); return; }
      WAKE.lock = l; l.addEventListener('release', () => { if (WAKE.lock === l) WAKE.lock = null; }); log('screen kept on');
    } catch (e) { log('wake lock', e?.name || e); } finally { WAKE.asking = false; }
  }
  function wakeOff() { WAKE.want = false; const l = WAKE.lock; WAKE.lock = null; if (l) l.release().catch(() => {}); }
  function stopShow() {
    if (!SH) return;
    wakeOff(); stopSrc(); try { SH.an?.disconnect(); } catch (e) {}
    for (const o of SH.syl) try { o.stop(); } catch (e) {}
    SH = null; if (el) { el.cap.classList.remove('on'); document.body.classList.remove('vs-cap-top'); } performerIdle(); jaw(0);
    if (PF) PF.holder.setEnabled(false);
  }
  // a line with no audio: a babbling voice (an animal-crossing murmur through two vowel formants), a syllable every ~0.14 s
  function babble(text, at) {
    const ac = audioCtx(); if (!ac || !SH) return [];
    const plan = [], words = String(text).split(/\s+/).filter(Boolean);
    let t = Math.max(ac.currentTime + .02, at);
    const VOW = [[730, 1090], [530, 1840], [270, 2290], [570, 840], [300, 870], [660, 1720]];
    for (const w of words) {
      const n = Math.max(1, Math.min(4, Math.round(w.replace(/[^a-z0-9]/gi, '').length / 3)));
      for (let k = 0; k < n; k++) {
        const d = .09 + Math.random() * .06, f0 = 135 + Math.random() * 40 + (/[!?]$/.test(w) && k === n - 1 ? 45 : 0), [f1, f2] = VOW[(Math.random() * VOW.length) | 0];
        const o = ac.createOscillator(), g = ac.createGain(), b1 = ac.createBiquadFilter(), b2 = ac.createBiquadFilter(), mix = ac.createGain();
        o.type = 'sawtooth'; o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f0 * (.92 + Math.random() * .16), t + d);
        b1.type = 'bandpass'; b1.frequency.value = f1; b1.Q.value = 7; b2.type = 'bandpass'; b2.frequency.value = f2; b2.Q.value = 9;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.32, t + .015); g.gain.setValueAtTime(.32, t + d * .6); g.gain.linearRampToValueAtTime(0, t + d);
        o.connect(b1); o.connect(b2); b1.connect(mix); b2.connect(mix); mix.gain.value = 1.6; mix.connect(g); g.connect(master);
        o.start(t); o.stop(t + d + .02);
        plan.push({ a: t, b: t + d }); SH.syl.push(o);
        t += d + .025 + Math.random() * .02;
      }
      t += /[,.;:!?]$/.test(w) ? .22 : .06;
    }
    SH.syl = SH.syl.slice(-400);
    return plan;
  }
  const CAP_MIN = 2.6;
  const isTouch = () => document.documentElement.classList.contains('vt-touch');
  // a caption's most characters: two lines of its box (phones: the box at the top, 15 px; computers: up to 680 px, 17 px)
  function capMax() {
    const vw = window.innerWidth || 800, w = isTouch() ? vw - 24 - 52 - 24 : Math.min(680, vw - 32) - 32;
    return Math.max(44, 2 * Math.floor(w / (isTouch() ? 7.4 : 8.4)));
  }
  // a line in parts of at most max characters: whole sentences, else at a comma, else between words
  function capParts(text, max) {
    const s = String(text || '').replace(/\s+/g, ' ').trim(); if (s.length <= max) return [s];
    const sen = s.match(/[^.!?…]+(?:[.!?…]+["')\]]*|$)\s*/g)?.map(x => x.trim()).filter(Boolean) || [s], bits = [];
    for (const x of sen) {
      if (x.length <= max) { bits.push(x); continue; }
      for (const y of x.match(/[^,;:]+(?:[,;:]+|$)\s*/g)?.map(z => z.trim()).filter(Boolean) || [x]) {
        if (y.length <= max) { bits.push(y); continue; }
        let line = ''; for (const w of y.split(' ')) { if (line && (line + ' ' + w).length > max) { bits.push(line); line = w; } else line = line ? line + ' ' + w : w; }
        if (line) bits.push(line);
      }
    }
    const out = []; for (const b of bits) { if (out.length && (out[out.length - 1] + ' ' + b).length <= max) out[out.length - 1] += ' ' + b; else out.push(b); }
    return out;
  }
  // where the performer is on the screen (CSS px): a box round him, 3.9 m tall and a metre either side of his spot
  function performerRect() {
    if (!PF || !PF.holder.isEnabled(false)) return null;
    const sc = H.scene, cam = sc.activeCamera, eng = sc.getEngine(); if (!cam) return null;
    const cv = eng.getRenderingCanvas(), cr = cv.getBoundingClientRect(), W = eng.getRenderWidth(), Hh = eng.getRenderHeight();
    const vp = cam.viewport.toGlobal(W, Hh), tm = sc.getTransformMatrix(), id = B.Matrix.Identity(), p = PF.holder.getAbsolutePosition();
    let l = 1e9, r = -1e9, t = 1e9, b = -1e9, n = 0;
    for (const dx of [-1.1, 1.1]) for (const dz of [-1.1, 1.1]) for (const dy of [0, 3.9]) {
      const v = B.Vector3.Project(new B.Vector3(p.x + dx, p.y + dy, p.z + dz), id, tm, vp); if (!(v.z > 0 && v.z < 1)) continue;
      const x = cr.left + v.x * cr.width / W, y = cr.top + v.y * cr.height / Hh; n++;
      l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); b = Math.max(b, y);
    }
    return n ? { l, r, t, b } : null;
  }
  // the caption's side: phones at the top, computers at the bottom, the other side when he is under it (less of him hidden)
  let capAt = 0;
  function placeCap() {
    const now = performance.now(); if (!el || now - capAt < 250) return; capAt = now;
    const pref = isTouch() ? 'top' : 'bottom', other = pref === 'top' ? 'bottom' : 'top', pr = performerRect();
    const set = k => el.cap.classList.toggle('top', k === 'top');
    let slot = pref;
    if (pr && el.cap.classList.contains('on')) {
      const over = k => { set(k); const r = el.cap.getBoundingClientRect(); return Math.max(0, Math.min(r.right, pr.r) - Math.max(r.left, pr.l)) * Math.max(0, Math.min(r.bottom, pr.b) - Math.max(r.top, pr.t)); };
      const a = over(pref); if (a > 0 && over(other) < a) slot = other;
    }
    set(slot); document.body.classList.toggle('vs-cap-top', !!SH && slot === 'top' && isTouch() && settings.captions);
  }
  function runShow() {
    const sh = S.show, inPlace = S.ev && inHall() && atPlace(S.ev);
    const t = showTime();
    if (!sh || !inPlace || !settings.show || t < -.5 || t >= sh.len + 1) { if (SH) stopShow(); return; }
    if (!SH || SH.key !== sh.startAt) startShow();
    if (!SH) return;
    if (PF && !PF.holder.isEnabled(false)) PF.holder.setEnabled(true);
    // the badges: a show watched to its end (here for at least half of it, or its last minute)
    if (SH.seenFrom == null) SH.seenFrom = Math.max(0, t);
    if (!SH.seen && t >= sh.len - .5 && sh.len - SH.seenFrom >= Math.min(sh.len * .5, 60)) { SH.seen = true; try { window.badgeStat?.('shows'); } catch (e) {} }
    const ac = audioCtx();
    // the audio at the show's own second (the player's Sound effects level, like the laughs and the rimshots)
    if (master) { const v = Math.max(0, Math.min(1.5, +(window.PlayerSound?.get?.('effects') ?? 1))); if (Math.abs(master.gain.value - v) > .001) master.gain.value = v; }
    if (SH.audioUrl) audioTick(t);
    const voiced = !!(SH.audioUrl && !AUD.failed); // (a file that could not be read: the lines babble)
    // the cues that are due: a line (caption, babble when there is no audio), a move, a sound
    while (SH.next < SH.cues.length && SH.cues[SH.next].t <= t) {
      const c = SH.cues[SH.next++], late = t - c.t;
      if (late > 1.5 && !c.say) continue;
      if (c.say) {
        const until = (SH.cues.slice(SH.next).find(x => x.say)?.t ?? sh.len) - c.t;
        const dur = 1000 * Math.max(CAP_MIN, Math.min(until, 2 + c.say.length * .07)), parts = capParts(c.say, capMax());
        const total = parts.reduce((n, x) => n + x.length, 0) || 1; let at = performance.now() - late * 1000;
        SH.capQ = parts.map(x => { const q = { a: at, b: at + dur * x.length / total, x }; at = q.b; return q; });
        SH.cap = c.say; SH.capUntil = at;
        if (!voiced && ac) SH.plan = (SH.plan || []).concat(babble(c.say, ac.currentTime - Math.min(late, 0)));
      }
      if (c.clip) performerMove(c.clip);
      if (c.sfx) { try { H.sound?.(c.sfx); } catch (e) {} }
    }
    // the show's first second: from standing at the mic into his stand-up loop
    if (PF && t >= 0 && PF.groups.game_standup && (PF.cur === PF.groups.idle || PF.cur === PF.groups.fight_idle || !PF.cur)) performerIdle();
    // captions
    if (el) {
      const now = performance.now(), part = settings.captions && SH.cap && now < SH.capUntil ? SH.capQ?.find(q => now >= q.a && now < q.b)?.x || '' : '';
      el.cap.classList.toggle('on', !!part);
      if (part && el.cap.dataset.t !== part) { el.cap.dataset.t = part; el.cap.innerHTML = '<b>' + esc(S.ev?.show?.title || 'The show') + '</b>' + esc(part); }
      placeCap();
    }
    // the voice's level: the audio's loudness, or the babble's syllables
    let lv = 0;
    if (voiced && SH.an) { SH.an.getFloatTimeDomainData(SH.buf); let e = 0; for (let i = 0; i < SH.buf.length; i++) e += SH.buf[i] * SH.buf[i]; lv = Math.min(1, Math.sqrt(e / SH.buf.length) * 7); }
    else if (SH.plan && ac) { const now = ac.currentTime; SH.plan = SH.plan.filter(p => p.b > now - .05); const s = SH.plan.find(p => p.a <= now && now <= p.b); if (s) { const u = (now - s.a) / (s.b - s.a); lv = Math.sin(Math.PI * Math.min(1, u * 1.2)); } }
    SH.level += (lv - SH.level) * .45;
    jaw(SH.level);
    if (PF?.mic) PF.mic.hold();
  }

  // ---- the performer at the mic (the Comedy Club): Rebel #001's rig, its jaw opening with the voice ----
  let PF = null, pfLoading = false, pfUrl = null;
  async function performerUrl() {
    if (pfUrl) return pfUrl;
    try {
      const r = await fetch(`/api/forge-active-character-get?collectionKey=${PERFORMER.col}&tokenId=${PERFORMER.tok}`); const d = await r.json();
      const c = d?.activeCharacter; pfUrl = c?.forgeRigGlbUrl || c?.characterBundle?.forgeRigGlbUrl || null;
    } catch (e) {}
    return pfUrl;
  }
  // (wanted while this page is in the hall of an event with a show at a stage: loaded ahead, shown while the show runs)
  const pfWanted = () => !!(S.ev && inHall() && S.ev.show && STAGE_SPOTS[S.ev.place?.room || ''] && atPlace(S.ev));
  async function loadPerformer() {
    const spot = STAGE_SPOTS[S.ev?.place?.room || ''], parent = H.roomHolder?.();
    if (!spot || !parent || PF || pfLoading || !pfWanted()) return;
    pfLoading = true;
    try {
      const url = await performerUrl(); if (!url || !pfWanted()) return;
      const c = await B.SceneLoader.LoadAssetContainerAsync('', H.viaSite ? H.viaSite(url) : url, H.scene);
      if (!pfWanted() || H.roomHolder?.() !== parent) { c.dispose(); return; }
      const holder = new B.TransformNode('stagePerformer', H.scene); holder.parent = parent; holder.setEnabled(!!SH);
      holder.position.set(spot[0], spot[1], spot[2]); holder.rotation.y = spot[3]; holder.scaling.setAll(PERFORMER.scale);
      const inst = c.instantiateModelsToScene(n => 'stagePf_' + n, false, { doNotInstantiate: true }), meshes = [], groups = {}, joints = new Map();
      for (const r of inst.rootNodes) { if (r instanceof B.AbstractMesh) meshes.push(r); meshes.push(...r.getChildMeshes(false)); }
      meshes.forEach(m => { m.parent = holder; if (m.rotationQuaternion) m.rotationQuaternion = null; m.isPickable = false; m.metadata = { ...(m.metadata || {}), camSkip: true, interiorRuntime: true }; fixMaterial(m.material); m.alwaysSelectAsActiveMesh = true; });
      for (const r of inst.rootNodes) if (!(r instanceof B.AbstractMesh) && !r.parent) r.parent = holder;
      for (const r of inst.rootNodes) for (const n of [r, ...r.getDescendants(false)]) if (!(n instanceof B.AbstractMesh)) joints.set(n.name.replace(/^stagePf_/, ''), n);
      inst.animationGroups.forEach(g => { g.stop(); g.enableBlending = true; g.blendingSpeed = .1; groups[g.name.replace(/^stagePf_/, '')] = g; });
      (parent.parent?.metadata?.interiorLights || []).forEach(l => { if (l.includedOnlyMeshes?.length) l.includedOnlyMeshes.push(...meshes); }); // (the room's spotlights light him too)
      const jw = joints.get('mixamorig_Jaw');
      PF = { holder, inst, c, meshes, groups, joints, extra: [], log: [], jaw: jw || null, rest: jw ? (jw.rotationQuaternion || B.Quaternion.FromEulerVector(jw.rotation)).clone() : null, cur: null };
      if (jw && !jw.rotationQuaternion) jw.rotationQuaternion = PF.rest.clone();
      try { PF.mic = performerMic(PF); } catch (e) { log('mic failed', e?.message); }
      (parent.parent?.metadata?.interiorLights || []).forEach(l => { if (l.includedOnlyMeshes?.length && PF.mic) l.includedOnlyMeshes.push(...PF.mic.meshes); });
      performerIdle();
      log('performer', url.split('/').pop(), !!jw, PF.mic ? 'mic r ' + PF.mic.r.toFixed(3) : 'no mic');
      performerPack(url).catch(e => log('pack failed', e?.message));
    } catch (e) { log('performer failed', e?.message); }
    finally { pfLoading = false; }
  }
  // his stand-up moves from #001's games pack (the Mixamo stand-up bits: his loop while the show runs), mapped by joint name
  const PACK_MOVES = ['game_standup', 'game_cheer', 'dance_wave', 'wave'];
  async function performerPack(url) {
    const pack = await window.RebelWeapon?.gamesFor?.(url), p = PF; if (!pack || !p) return;
    const c = await B.SceneLoader.LoadAssetContainerAsync('', H.viaSite ? H.viaSite(pack) : pack, H.scene, null, '.glb');
    if (PF !== p) { c.animationGroups.forEach(g => g.dispose()); c.dispose(); return; }
    for (const src of c.animationGroups) {
      if (!PACK_MOVES.includes(src.name) || p.groups[src.name]) continue;
      const g = src.clone('stagePf_' + src.name, t => (/^cloth_/.test(t?.name || '') ? null : p.joints.get(t?.name) || null));
      for (let j = g.targetedAnimations.length - 1; j >= 0; j--) if (!g.targetedAnimations[j].target) g.targetedAnimations.splice(j, 1);
      g.stop(); g.enableBlending = true; g.blendingSpeed = .1; p.groups[src.name] = g; p.extra.push(g);
    }
    c.animationGroups.forEach(g => g.dispose()); c.dispose();
    try { if (p.mic && p.groups.game_standup) { p.mic.aim(p.groups.game_standup); p.cur = null; } } catch (e) { log('mic aim', e?.message); }
    log('performer pack', PACK_MOVES.filter(n => p.groups[n]).join(','), p.mic ? 'mic tilt ' + p.mic.tilt : '');
    performerIdle();
  }
  // ---- his handheld mic (Nov 4, Miguel: "a microphone in his hands"): made here (no file to load), closed in the hand the
  // stand-up move keeps at his mouth (the rig's RightHand: the actor held a mic there), its fingers closed round the
  // handle as his fist closes in the fight stance (the rig's own fight_idle), put on through the hand's own finger joints
  // (assets/rebel-weapon.js's fist), so it fits him whatever his rig. Shown with him while the show runs.
  const MIC_FINGERS = /^mixamorig_RightHand(Thumb|Index|Middle|Ring|Pinky)[123]$/;
  function performerMic(p) {
    const BB = window.BABYLON, V3 = BB.Vector3, sc = p.holder.getScene(), sm = p.meshes.find(m => m.skeleton), fist = window.RebelWeapon?._fist;
    const fight = p.groups.fight_idle; if (!sm || !fist || !fight) return null;
    // the fist: the first key of each right finger joint in the fight stance
    const grip = [];
    for (const ta of fight.targetedAnimations) {
      const n = ta.target; if (!n || !MIC_FINGERS.test(String(n.name).replace(/^stagePf_/, '')) || ta.animation.targetProperty !== 'rotationQuaternion') continue;
      const k = ta.animation.getKeys()[0]; if (k?.value) grip.push({ n, q: k.value.clone() });
    }
    if (grip.length < 10) return null;
    const skel = sm.skeleton, bone = n => skel.bones.find(b => b.name && (b.name === n || b.name.endsWith('_' + n) || b.name.endsWith(':' + n))) || null; // ('RightHand' -> mixamorig_RightHand)
    const saved = grip.map(g => g.n.rotationQuaternion ? g.n.rotationQuaternion.clone() : null);
    const settle = () => { p.holder.computeWorldMatrix(true); p.holder.getDescendants(false).forEach(x => x.computeWorldMatrix && x.computeWorldMatrix(true)); skel.prepare(true); };
    grip.forEach(g => { if (!g.n.rotationQuaternion) g.n.rotationQuaternion = g.q.clone(); else g.n.rotationQuaternion.copyFrom(g.q); });
    settle();
    const BW = b => b.getFinalMatrix().multiply(sm.getWorldMatrix()), bp = b => V3.TransformCoordinates(V3.Zero(), BW(b));
    const fc = fist(bp, bone, 'Right');
    grip.forEach((g, i) => { if (saved[i]) g.n.rotationQuaternion.copyFrom(saved[i]); }); settle();
    if (!fc || !fc.fromJoints) return null;
    // its size from the fist (a stage mic: the grip a fifth of the fist's width, the grille half as wide again, the
    // handle out past both ends of the fist)
    const r = Math.max(.022, Math.min(.05, Math.max(fc.hole, .2 * fc.span))), L = Math.max(7.2 * r, 2.5 * fc.span);
    const mat = (k, d, spec, sp, em) => { const m = new BB.StandardMaterial('stagePfMic_' + k, sc); m.diffuseColor = BB.Color3.FromHexString(d); m.specularColor = new BB.Color3(spec, spec, spec); m.specularPower = sp; if (em) m.emissiveColor = BB.Color3.FromHexString(em); m.maxSimultaneousLights = 4; return m; };
    const black = mat('body', '#141217', .35, 48, '#050407'), chrome = mat('chrome', '#c9ccd4', .9, 96, '#1c1d22'), gold = mat('band', '#d8b35c', .7, 64, '#3a2a0a');
    // the grille: a fine mesh pattern on a canvas (one per page)
    const tex = new BB.DynamicTexture('stagePfMicGrille', { width: 128, height: 128 }, sc, true), cx = tex.getContext();
    cx.fillStyle = '#d4d7de'; cx.fillRect(0, 0, 128, 128); cx.strokeStyle = 'rgba(40,42,50,.75)'; cx.lineWidth = 1.6;
    for (let i = -128; i < 256; i += 8) { cx.beginPath(); cx.moveTo(i, 0); cx.lineTo(i + 128, 128); cx.stroke(); cx.beginPath(); cx.moveTo(i, 128); cx.lineTo(i + 128, 0); cx.stroke(); }
    tex.update(); tex.uScale = 3; tex.vScale = 2; tex.wrapU = tex.wrapV = BB.Texture.WRAP_ADDRESSMODE;
    const grille = mat('grille', '#ffffff', .8, 80, '#151518'); grille.diffuseTexture = tex;
    // along +y: the handle (the fist round its middle, at y 0), the gold band, the chrome collar, the ball grille
    const parts = [], at = (m, y) => { m.position.y = y; parts.push(m); return m; };
    const y0 = -.45 * L;
    at(BB.MeshBuilder.CreateCylinder('stagePfMicHandle', { height: L, diameterBottom: 1.7 * r, diameterTop: 2.3 * r, tessellation: 18 }, sc), y0 + L / 2).material = black;
    at(BB.MeshBuilder.CreateCylinder('stagePfMicBand', { height: .35 * r, diameter: 2.36 * r, tessellation: 18 }, sc), y0 + L - .9 * r).material = gold;
    at(BB.MeshBuilder.CreateCylinder('stagePfMicCollar', { height: .7 * r, diameterBottom: 2.4 * r, diameterTop: 2.9 * r, tessellation: 18 }, sc), y0 + L + .3 * r).material = chrome;
    const ball = at(BB.MeshBuilder.CreateSphere('stagePfMicBall', { diameter: 3.1 * r, segments: 12 }, sc), y0 + L + 1.75 * r); ball.scaling.y = 1.08; ball.material = grille;
    at(BB.MeshBuilder.CreateCylinder('stagePfMicEnd', { height: .25 * r, diameter: 1.5 * r, tessellation: 12 }, sc), y0 - .1 * r).material = chrome;
    // held at the hole's centre, along the fist (the ball on the thumb side), riding the hand's drawn bone
    const pivot = new BB.TransformNode('stagePfMic', sc);
    pivot.setPreTransformMatrix(BB.Matrix.Translation(fc.G.x, fc.G.y, fc.G.z).multiply(BB.Matrix.Invert(BW(fc.hb))));
    pivot.attachToBone(fc.hb, sm); pivot.scalingDeterminant = 1;
    const inner = new BB.TransformNode('stagePfMicInner', sc); inner.parent = pivot;
    // its axis: across the fist, the grille on the thumb side (tilted toward his mouth once his stand-up move is in: aim)
    const BW0 = BW(fc.hb).clone(), inv0 = BB.Matrix.Invert(BW0), G0 = V3.TransformCoordinates(fc.G, inv0);
    const A0 = V3.TransformNormal(fc.A, inv0).normalize(), F0 = V3.TransformNormal(fc.F, inv0).normalize();
    const setAxis = (upL) => { // (an axis in the hand's own frame -> the mic's frame at the reference pose)
      const up = V3.TransformNormal(upL, BW0).normalize(), Fw = V3.TransformNormal(F0, BW0);
      const fw = Fw.subtract(up.scale(V3.Dot(Fw, up))).normalize(), side = V3.Cross(up, fw).normalize();
      inner.setPreTransformMatrix(BB.Matrix.FromValues(side.x, side.y, side.z, 0, up.x, up.y, up.z, 0, fw.x, fw.y, fw.z, 0, 0, 0, 0, 1));
    };
    setAxis(A0);
    parts.forEach(m => { m.parent = inner; m.isPickable = false; m.alwaysSelectAsActiveMesh = true; m.metadata = { camSkip: true, interiorRuntime: true }; });
    return { pivot, inner, meshes: parts, grip, r, L, span: fc.span, mats: [black, chrome, gold, grille], tex, tilt: 0,
      // the grille toward his mouth through his stand-up move: the mean way from the fist to his jaw in the hand's frame,
      // over the move, at most 50 degrees off the fist's own line (sampled once the move is in; his pose put back)
      aim(g) {
        const jawB = bone('Jaw') || bone('Head'), hb = fc.hb; if (!g || !jawB) return;
        const sum = V3.Zero(); let n = 0, blend = g.enableBlending;
        g.enableBlending = false; g.start(false, 1, g.from, g.to, false); g.pause(); // (blending would hold the pose it started in)
        for (let i = 0; i < 12; i++) {
          g.goToFrame(g.from + (g.to - g.from) * (i + .5) / 12); this.hold(); settle();
          const inv = BB.Matrix.Invert(BW(hb)), J = V3.TransformCoordinates(bp(jawB), inv);
          sum.addInPlace(J.subtract(G0).normalize()); n++;
        }
        g.stop(); g.enableBlending = blend;
        if (!n) return;
        let d = sum.scale(1 / n).normalize(); const cos = V3.Dot(d, A0), ang = Math.acos(Math.max(-1, Math.min(1, cos)));
        if (ang > 50 / 57.3) { const k = Math.sin(50 / 57.3) / Math.max(1e-6, Math.sin(ang)); d = A0.scale(Math.cos(50 / 57.3) - cos * k).add(d.scale(k)).normalize(); }
        setAxis(d); this.tilt = Math.round(Math.min(ang, 50 / 57.3) * 57.3);
      },
      hold() { for (const g of grip) { if (!g.n.rotationQuaternion) g.n.rotationQuaternion = g.q.clone(); else g.n.rotationQuaternion.copyFrom(g.q); } },
      dispose() { try { parts.forEach(m => m.dispose(false, false)); inner.dispose(); pivot.dispose(); this.mats.forEach(m => m.dispose()); tex.dispose(); } catch (e) {} } };
  }
  function fixMaterial(mat) { // (as the village does for its own player: at most 4 lights, no emissive, both faces)
    if (!mat || mat._stFixed) return; mat._stFixed = true;
    if (mat.maxSimultaneousLights !== undefined) { mat.maxSimultaneousLights = 4; mat.backFaceCulling = false; }
    if (mat.getClassName?.() === 'PBRMaterial') { mat.emissiveColor = new B.Color3(0, 0, 0); mat.emissiveIntensity = 0; }
  }
  function play(name, loop) {
    const g = PF?.groups[name]; if (!g) return false;
    if (PF.cur && PF.cur !== g) PF.cur.stop();
    PF.cur = g; g.start(loop, 1, g.from, g.to, false); PF.log.push(name); if (PF.log.length > 12) PF.log.shift();
    if (!loop) g.onAnimationGroupEndObservable.addOnce(() => { if (PF && PF.cur === g) performerIdle(); });
    return true;
  }
  // between moves: his stand-up loop while the show runs (from its first second), else he stands at the mic
  const onShow = () => !!SH && showTime() >= 0;
  const performerIdle = () => {
    if (!PF) return;
    const want = onShow() && PF.groups.game_standup ? PF.groups.game_standup : PF.groups.idle || PF.groups.fight_idle;
    if (want && PF.cur !== want) play(want === PF.groups.game_standup ? 'game_standup' : want === PF.groups.idle ? 'idle' : 'fight_idle', true);
  };
  const performerMove = name => { if (PF && !play(name, false)) log('no move', name); };
  function jaw(level) {
    if (!PF?.jaw || !PF.rest) return;
    PF.jaw.rotationQuaternion.copyFrom(PF.rest.multiply(B.Quaternion.RotationAxis(B.Axis.X, (level || 0) * 18 * Math.PI / 180)));
  }
  function dropPerformer() {
    if (!PF) return; const p = PF; PF = null;
    try { p.mic?.dispose(); p.extra.forEach(g => g.dispose()); p.inst.animationGroups.forEach(g => g.dispose()); p.inst.skeletons?.forEach(s => s.dispose()); p.meshes.forEach(m => m.dispose(false, false)); p.holder.dispose(false, false); p.c.dispose(); } catch (e) {}
  }

  // ---- golden tickets (Nov 2): the event at hand's (api/golden-ticket.mjs, read every minute while there) ----
  const GOLD = { m: new Map(), at: new Map(),
    of(id) { return this.m.get(id) || null; },
    set(id, g) { this.m.set(id, g || null); this.at.set(id, Date.now()); },
    want(id) { if (!id || !window.GoldenTicket || Date.now() - (this.at.get(id) || 0) < 60000) return; this.at.set(id, Date.now()); window.GoldenTicket.state(id, true).then(g => { this.m.set(id, g); paint(); }); } };
  // ---- twice a second: the list now and then, the hall at the event's place, the performer only in its room ----
  function tick() {
    if (!H) return;
    poll();
    if (S.ev && hall) GOLD.want(S.ev.id);
    const ev = S.live.find(atPlace) || null;
    // a dropped hall that did not come back in time, or a player who walked off meanwhile: out of it
    if (!ws && graceUntil && (performance.now() > graceUntil || !ev || ev.id !== S.ev?.id)) { graceUntil = 0; leaveHall(); }
    if (ev && !ws && !connecting && !stopped && performance.now() >= retryAt) connect(ev.id);
    if (ws && hall && (!ev || ev.id !== hall)) close(); // (left the place, or the event is no longer on)
    try { runShow(); } catch (e) { log('show', e); } // (also here: a page drawing slowly still gets its cues on time)
    // a show on in this village: the stage's sound is made now, so the taps that bring a player to it start it (an
    // iPhone starts a page's sound only inside a tap; one made after the last tap would wait for the next)
    if (!actx && S.live.some(ev => ev.show && ev.place?.village === H.village)) audioCtx();
    // in the hall: the show's audio and its performer ready before it starts (he shows only while it runs)
    const want = pfWanted();
    if (want) { const au = S.show?.audio || S.ev.show?.audio; if (au) showAudio(au); loadPerformer(); }
    else if (!S.ev && AUD.url) dropAudio();
    if (PF && (!want || H.roomHolder?.() !== PF.holder.parent)) dropPerformer();
    if (PF && PF.holder.isEnabled(false) !== !!SH) PF.holder.setEnabled(!!SH);
    // a page that travelled to the event's village: on with the mark (or into the hall)
    if (S.goal && S.goal.until < Date.now()) setGoal(null);
    // came from the lobby's Join: once walking, straight through the event's door (or the mark, when that can't be done)
    if (wantedEv && me()) { const e2 = wantedEv; wantedEv = null; if (!atPlace(e2) && !(e2.place.village === H.village && e2.place.room && !me().interior && H.enterRoom?.(e2.place.room))) goTo(e2); }
    paint();
  }
  let startedAt = 0;
  function start(host) {
    if (H || !host) return;
    H = host; B = window.BABYLON; build(); startedAt = Date.now();
    H.scene.onBeforeRenderObservable.add(() => { try { runShow(); } catch (e) { log('show', e); } });
    setInterval(tick, 500);
    poll(true);
    document.addEventListener('pointerdown', () => { if (actx) audioCtx(); }, true);
    // (the screen's wake lock: asked again as the page comes back into view, and on a tap when it was refused)
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && WAKE.want && !WAKE.lock) { WAKE.at = 0; wakeOn(); } });
    document.addEventListener('pointerup', () => { if (WAKE.want && !WAKE.lock) wakeOn(); }, true);
  }
  window.VillageStage = {
    start, tick, poll, dots, goTo, close,
    // golden tickets at the event the page is at: { holds: front-row seat theirs, active: the event's front row is reserved }
    golden: () => { const ev = S.ev && inHall() ? S.ev : null, g = ev ? GOLD.of(ev.id) : null; return g ? { active: (g.buy || 0) + (g.raffle || 0) > 0, holds: g.mine === 'bought' || g.mine === 'won', room: ev.place?.room || null } : null; },
    // a live event with a show at the Comedy Club: Ant-Thony is there (the roaming one steps off his rounds meanwhile)
    antOnStage: () => S.live.some(e => e.place?.village === 'hub' && e.place?.room === 'hub_comedy_club' && !!e.show),
    say: x => send({ t: 'sc', x: String(x || '') }), report: (i, why) => send({ t: 'rp', i: +i, why: why || 'other' }),
    hand: on => send({ t: 'hand', on: !!on }), up: u => send({ t: 'up', u }), down: u => send({ t: 'down', u }), showGo: go => send({ t: 'show', go: go ? 1 : 0 }),
    voice: { send: o => send(o), open: () => !!ws && ws.readyState === 1 && !!S.ev && !!S.cfg.voice, you: () => S.you },
    canTalk: () => !!(S.ev && (S.host || S.speakers.some(s => s.u === S.you))),
    speakers: () => { const ev = S.ev; if (!ev) return []; return [...(ev.hosts || []).map(h => h.u), ...S.speakers.map(s => s.u)].filter(u => u && u !== S.you); },
    nameOf: u => (S.ev?.hosts || []).find(h => h.u === u)?.n || S.speakers.find(s => s.u === u)?.n || 'Speaker',
    in: () => !!(ws && ws.readyState === 1 && S.ev),
    on: f => { listeners.add(f); return () => listeners.delete(f); },
    settings, set: (k, v) => { settings[k] = v; save(SET_KEY, settings); if (k === 'show' && !v) stopShow(); },
    _mic: performerMic, // (tests)
    _capRects: () => { const r = el?.cap?.getBoundingClientRect(); return { cap: r && el.cap.classList.contains('on') ? { l: r.left, r: r.right, t: r.top, b: r.bottom } : null, pf: performerRect(), top: !!el?.cap?.classList.contains('top'), text: el?.cap?.classList.contains('on') ? el.cap.dataset.t : '', max: capMax() }; }, // (tests)
    get state() { return { live: S.live.slice(), next: S.next.slice(), ev: S.ev, host: S.host, you: S.you, speakers: S.speakers.slice(), hands: S.hands.slice(), hand: S.hand, show: S.show, n: S.n, cfg: S.cfg, open: !!ws && ws.readyState === 1, hall, grace: graceUntil > performance.now(), wake: !!WAKE.lock, goal: S.goal, stopped, t: showTime(), playing: !!SH, cap: SH?.cap || '', level: SH?.level || 0, performer: !!PF, shown: !!PF?.holder?.isEnabled(false), jaw: !!PF?.jaw, pfMove: PF?.cur?.name || null, pfMoves: PF ? PF.log.slice() : [],
      mic: PF?.mic ? { r: +PF.mic.r.toFixed(3), tilt: PF.mic.tilt } : null,
      audio: { url: AUD.url, ready: !!AUD.buf, len: AUD.buf ? +AUD.buf.duration.toFixed(2) : 0, loading: AUD.loading, failed: AUD.failed, ctx: actx?.state || null, rate: actx?.sampleRate || 0, on: !!SH?.src, pos: SH?.src && actx ? +(actx.currentTime - SH.srcAt).toFixed(2) : null } }; }
  };
})();
