// Universe multiplayer, the Colony Stage (step 6): events. The page asks /api/mp-events now and then (every minute): an
// event on now shows a LIVE banner (Go there: to its village, then a gold mark on the minimap at its room's door). At the
// event's place (its room, or its village outside) the page opens the event's hall (/v1/stage?id=, realtime/src/stage.js):
// the stage bar (LIVE · title · how many are here; Raise hand; hosts: the raised hands, Start / Stop the show), the Event
// channel in the chat (village-chat.js), the hosts' voices (village-voice.js, scope 'stage'), and the show: its audio, or
// for each line a babbling voice with the words as captions, started at the same second on every page; in Antthony's
// Comedy Club the performer stands at the mic (Rebel #001's rig: its jaw moves with the voice).
// window.VillageStage.start(host) from village.html, host = { scene, village, villageName(id), player() -> { x, z, interior }
//   | null, signedIn(), ticket() -> Promise<{ ticket, url }|null>, travel(villageId), doorOf(roomId) -> { x, z } | null,
//   roomHolder() -> the shown room's node | null, enterRoom(roomId) -> bool (through its door), sound(name), viaSite(url),
//   toast(msg), canAct() }
(function () {
  'use strict';
  const PROTOCOL = 'rebel-universe.v1', POLL_MS = 60000, GOTO_KEY = 'rebelAntsStageGoTo:v1', SET_KEY = 'rebelAntsStageSet:v1';
  // where a performer stands in a room (room coordinates: x, floor height, z, facing): the Comedy Club's mic
  const STAGE_SPOTS = { hub_comedy_club: [0, 1.1, -9.05, 0] };
  const PERFORMER = { col: 'battle_for_colony', tok: '1', scale: 1.9 }; // (Rebel #001, the master: his public character's rig)
  const log = (...a) => { if (window._mpDebug) console.log('[stage]', ...a); };
  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v && typeof v === 'object' ? { ...d, ...v } : { ...d }; } catch (e) { return { ...d }; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const settings = load(SET_KEY, { show: true, captions: true });
  let H = null, B = null, ws = null, connecting = false, retryAt = 0, stopped = null, hall = null, pollAt = 0, offset = 0, listeners = new Set();
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
        ws = null; const was = hall; hall = null; leaveHall();
        log('closed', e.code, e.reason);
        if (e.code === 4001) { stopped = 'dup'; return; }
        if (e.code === 4003) { stopped = 'kick'; return; }
        if (e.code === 4004 || e.code === 1006 && !S.ev) { S.live = S.live.filter(x => x.id !== was); paint(); pollAt = 0; }
        retryAt = performance.now() + 4000 + Math.random() * 4000;
      };
      s.onerror = () => {};
    } finally { connecting = false; }
  }
  const send = o => { if (ws && ws.readyState === 1) { ws.send(JSON.stringify(o)); return true; } return false; };
  function close() { const s = ws; ws = null; hall = null; try { s?.close(1000, 'left'); } catch (e) {} leaveHall(); }
  function leaveHall() {
    S.ev = null; S.host = false; S.speakers = []; S.hands = []; S.hand = false; S.show = null; S.n = 0;
    stopShow(); voiceReset(); paint(); emit('left', {});
  }
  const voice = m => { try { window.VillageVoice?.stage?.(m); } catch (e) { log('voice', e); } };
  const voiceReset = () => { try { window.VillageVoice?.reset?.('stage'); } catch (e) {} };
  function onMessage(m) {
    const t = m.t;
    if (t === 'shi') {
      S.ev = m.ev; S.host = !!m.host; S.you = m.you; S.speakers = m.speakers || []; S.hands = m.hands || []; S.hand = !!m.hand; S.n = m.n || 1;
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
    if (t === 'sev') { S.ev = m.ev; paint(); return; }
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
    const here = S.ev && hall;
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
    const kBar = here ? [S.ev.id, S.ev.title, S.n, showOn, S.host, S.hands.length, hostOpen, speakingNow, S.hand, H.signedIn()].join('|') : '';
    if (!here) el.bar.dataset.k = '';
    if (here && el.bar.dataset.k !== kBar) {
      el.bar.dataset.k = kBar;
      el.bar.innerHTML = `<span class="dot"></span><span class="tx"><b>LIVE</b> · ${esc(S.ev.title)} <small>· ${S.n} here${S.show && showTime() >= 0 && showTime() < S.show.len ? ' · the show is on' : ''}</small></span>`;
      const speaking = S.speakers.some(s => s.u === S.you);
      if (S.host) el.bar.append(btn('Host · ' + S.hands.length + ' ✋', () => { hostOpen = !hostOpen; paint(); }, hostOpen ? 'on' : ''));
      else if (speaking) el.bar.append(btn('On stage', () => send({ t: 'hand', on: false }), 'on'));
      else if (H.signedIn()) el.bar.append(btn(S.hand ? '✋ Lower' : '✋ Raise hand', () => send({ t: 'hand', on: !S.hand }), S.hand ? 'on' : ''));
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
  let SH = null; // { key, audio, src, an, buf, cues, next, babble: [{ at, len, env }], cap, capUntil, perf }
  let actx = null, master = null;
  function audioCtx() {
    if (actx) { if (actx.state === 'suspended') actx.resume().catch(() => {}); return actx; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    actx = new AC(); master = actx.createGain(); master.gain.value = 1; master.connect(actx.destination); return actx;
  }
  function startShow() {
    stopShow();
    const sh = S.show; if (!sh) return;
    SH = { key: sh.startAt, cues: sh.cues || [], next: 0, sfxNext: 0, cap: '', capUntil: 0, level: 0, syl: [] };
    const ac = audioCtx();
    if (sh.audio && ac) {
      const a = new Audio(); a.crossOrigin = 'anonymous'; a.preload = 'auto'; a.src = H.viaSite ? H.viaSite(sh.audio) : sh.audio;
      const src = ac.createMediaElementSource(a), an = ac.createAnalyser(); an.fftSize = 512; src.connect(an); an.connect(master);
      SH.audio = a; SH.an = an; SH.buf = new Float32Array(an.fftSize);
    }
    // skip what is already over (a late arrival comes in mid-show)
    const t = showTime(); while (SH.next < SH.cues.length && SH.cues[SH.next].t < t - .25) SH.next++;
    loadPerformer();
    log('show', sh.title, t.toFixed(1));
  }
  function stopShow() {
    if (!SH) return;
    try { SH.audio?.pause(); if (SH.audio) SH.audio.src = ''; } catch (e) {}
    for (const o of SH.syl) try { o.stop(); } catch (e) {}
    SH = null; el && el.cap.classList.remove('on'); performerIdle(); jaw(0);
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
  function runShow() {
    const sh = S.show, inPlace = S.ev && hall && atPlace(S.ev);
    const t = showTime();
    if (!sh || !inPlace || !settings.show || t < -.5 || t >= sh.len + 1) { if (SH) stopShow(); return; }
    if (!SH || SH.key !== sh.startAt) startShow();
    if (!SH) return;
    // the badges: a show watched to its end (here for at least half of it, or its last minute)
    if (SH.seenFrom == null) SH.seenFrom = Math.max(0, t);
    if (!SH.seen && t >= sh.len - .5 && sh.len - SH.seenFrom >= Math.min(sh.len * .5, 60)) { SH.seen = true; try { window.badgeStat?.('shows'); } catch (e) {} }
    const ac = audioCtx();
    // the audio, kept within a few tenths of a second of the show's time
    if (SH.audio) {
      if (t >= 0 && SH.audio.paused) { try { SH.audio.currentTime = Math.max(0, t); } catch (e) {} SH.audio.play().catch(() => {}); }
      else if (t >= 0 && Math.abs(SH.audio.currentTime - t) > .45) { try { SH.audio.currentTime = t; } catch (e) {} }
    }
    // the cues that are due: a line (caption, babble when there is no audio), a move, a sound
    while (SH.next < SH.cues.length && SH.cues[SH.next].t <= t) {
      const c = SH.cues[SH.next++], late = t - c.t;
      if (late > 1.5 && !c.say) continue;
      if (c.say) {
        const until = (SH.cues.slice(SH.next).find(x => x.say)?.t ?? sh.len) - c.t;
        SH.cap = c.say; SH.capUntil = performance.now() + 1000 * Math.max(CAP_MIN, Math.min(until, 2 + c.say.length * .07)) - late * 1000;
        if (!sh.audio && ac) SH.plan = (SH.plan || []).concat(babble(c.say, ac.currentTime - Math.min(late, 0)));
      }
      if (c.clip) performerMove(c.clip);
      if (c.sfx) { try { H.sound?.(c.sfx); } catch (e) {} }
    }
    // captions
    if (el) {
      const showCap = settings.captions && SH.cap && performance.now() < SH.capUntil;
      el.cap.classList.toggle('on', !!showCap);
      if (showCap && el.cap.dataset.t !== SH.cap) { el.cap.dataset.t = SH.cap; el.cap.innerHTML = '<b>' + esc(S.ev?.show?.title || 'The show') + '</b>' + esc(SH.cap); }
    }
    // the voice's level: the audio's loudness, or the babble's syllables
    let lv = 0;
    if (SH.an) { SH.an.getFloatTimeDomainData(SH.buf); let e = 0; for (let i = 0; i < SH.buf.length; i++) e += SH.buf[i] * SH.buf[i]; lv = Math.min(1, Math.sqrt(e / SH.buf.length) * 7); }
    else if (SH.plan && ac) { const now = ac.currentTime; SH.plan = SH.plan.filter(p => p.b > now - .05); const s = SH.plan.find(p => p.a <= now && now <= p.b); if (s) { const u = (now - s.a) / (s.b - s.a); lv = Math.sin(Math.PI * Math.min(1, u * 1.2)); } }
    SH.level += (lv - SH.level) * .45;
    jaw(SH.level);
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
  async function loadPerformer() {
    const spot = STAGE_SPOTS[S.ev?.place?.room || ''], parent = H.roomHolder?.();
    if (!spot || !parent || PF || pfLoading) return;
    pfLoading = true;
    try {
      const url = await performerUrl(); if (!url || !SH) return;
      const c = await B.SceneLoader.LoadAssetContainerAsync('', H.viaSite ? H.viaSite(url) : url, H.scene);
      if (!SH || H.roomHolder?.() !== parent) { c.dispose(); return; }
      const holder = new B.TransformNode('stagePerformer', H.scene); holder.parent = parent;
      holder.position.set(spot[0], spot[1], spot[2]); holder.rotation.y = spot[3]; holder.scaling.setAll(PERFORMER.scale);
      const inst = c.instantiateModelsToScene(n => 'stagePf_' + n, false, { doNotInstantiate: true }), meshes = [], groups = {}, joints = new Map();
      for (const r of inst.rootNodes) { if (r instanceof B.AbstractMesh) meshes.push(r); meshes.push(...r.getChildMeshes(false)); }
      meshes.forEach(m => { m.parent = holder; if (m.rotationQuaternion) m.rotationQuaternion = null; m.isPickable = false; m.metadata = { ...(m.metadata || {}), camSkip: true, interiorRuntime: true }; fixMaterial(m.material); m.alwaysSelectAsActiveMesh = true; });
      for (const r of inst.rootNodes) if (!(r instanceof B.AbstractMesh) && !r.parent) r.parent = holder;
      for (const r of inst.rootNodes) for (const n of [r, ...r.getDescendants(false)]) if (!(n instanceof B.AbstractMesh)) joints.set(n.name.replace(/^stagePf_/, ''), n);
      inst.animationGroups.forEach(g => { g.stop(); g.enableBlending = true; g.blendingSpeed = .1; groups[g.name.replace(/^stagePf_/, '')] = g; });
      (parent.parent?.metadata?.interiorLights || []).forEach(l => { if (l.includedOnlyMeshes?.length) l.includedOnlyMeshes.push(...meshes); }); // (the room's spotlights light him too)
      const jw = joints.get('mixamorig_Jaw');
      PF = { holder, inst, c, meshes, groups, log: [], jaw: jw || null, rest: jw ? (jw.rotationQuaternion || B.Quaternion.FromEulerVector(jw.rotation)).clone() : null, cur: null };
      if (jw && !jw.rotationQuaternion) jw.rotationQuaternion = PF.rest.clone();
      performerIdle();
      log('performer', url.split('/').pop(), !!jw);
    } catch (e) { log('performer failed', e?.message); }
    finally { pfLoading = false; }
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
  const performerIdle = () => { if (PF) play('idle', true) || play('fight_idle', true); };
  const performerMove = name => { if (PF && !play(name, false)) log('no move', name); };
  function jaw(level) {
    if (!PF?.jaw || !PF.rest) return;
    PF.jaw.rotationQuaternion.copyFrom(PF.rest.multiply(B.Quaternion.RotationAxis(B.Axis.X, (level || 0) * 18 * Math.PI / 180)));
  }
  function dropPerformer() {
    if (!PF) return; const p = PF; PF = null;
    try { p.inst.animationGroups.forEach(g => g.dispose()); p.inst.skeletons?.forEach(s => s.dispose()); p.meshes.forEach(m => m.dispose(false, false)); p.holder.dispose(false, false); p.c.dispose(); } catch (e) {}
  }

  // ---- twice a second: the list now and then, the hall at the event's place, the performer only in its room ----
  function tick() {
    if (!H) return;
    poll();
    const ev = S.live.find(atPlace) || null;
    if (ev && !ws && !connecting && !stopped && performance.now() >= retryAt) connect(ev.id);
    if (ws && hall && (!ev || ev.id !== hall)) close(); // (left the place, or the event is no longer on)
    try { runShow(); } catch (e) { log('show', e); } // (also here: a page drawing slowly still gets its cues on time)
    if (PF && (!SH || H.roomHolder?.() !== PF.holder.parent)) dropPerformer();
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
  }
  window.VillageStage = {
    start, tick, poll, dots, goTo, close,
    say: x => send({ t: 'sc', x: String(x || '') }), report: (i, why) => send({ t: 'rp', i: +i, why: why || 'other' }),
    hand: on => send({ t: 'hand', on: !!on }), up: u => send({ t: 'up', u }), down: u => send({ t: 'down', u }), showGo: go => send({ t: 'show', go: go ? 1 : 0 }),
    voice: { send: o => send(o), open: () => !!ws && ws.readyState === 1 && !!S.ev && !!S.cfg.voice, you: () => S.you },
    canTalk: () => !!(S.ev && (S.host || S.speakers.some(s => s.u === S.you))),
    speakers: () => { const ev = S.ev; if (!ev) return []; return [...(ev.hosts || []).map(h => h.u), ...S.speakers.map(s => s.u)].filter(u => u && u !== S.you); },
    nameOf: u => (S.ev?.hosts || []).find(h => h.u === u)?.n || S.speakers.find(s => s.u === u)?.n || 'Speaker',
    in: () => !!(ws && ws.readyState === 1 && S.ev),
    on: f => { listeners.add(f); return () => listeners.delete(f); },
    settings, set: (k, v) => { settings[k] = v; save(SET_KEY, settings); if (k === 'show' && !v) stopShow(); },
    get state() { return { live: S.live.slice(), next: S.next.slice(), ev: S.ev, host: S.host, you: S.you, speakers: S.speakers.slice(), hands: S.hands.slice(), hand: S.hand, show: S.show, n: S.n, cfg: S.cfg, open: !!ws && ws.readyState === 1, hall, goal: S.goal, stopped, t: showTime(), playing: !!SH, cap: SH?.cap || '', level: SH?.level || 0, performer: !!PF, jaw: !!PF?.jaw, pfMove: PF?.cur?.name || null, pfMoves: PF ? PF.log.slice() : [] }; }
  };
})();
