// Universe multiplayer, voice: push to talk (hold X, or the Talk button on phones), the voices of the players around you
// (positional: louder near, from their side) and your group's voices from any village. Signed-in players only (guests
// neither talk nor hear). The voices go through Cloudflare Realtime SFU, but this page never talks to it: its offers and
// answers go through the room (nearby) or the group socket (realtime/src/voice.js), which decide whom it may hear.
// Per scope (the room, the group) one producer connection (the microphone, published once, silent unless the talk key is
// held: Opus DTX keeps the silence to a trickle) and one consumer connection (the voices heard), as Cloudflare's own
// video-room example does. You talk where you type: the chat's Group channel picked = the group hears you; a host or a
// speaker at an event (village-stage.js) talks to everyone at it; else the players near you hear you.
// window.VillageVoice.start(host) from village.html, host = { scene, mp, group, stage, signedIn(), canTalk(),
// channel() -> chat channel, listener() -> { pos, fwd, up } (the camera), place() -> my interior | null, toast(msg) }.
(function () {
  'use strict';
  const SETTINGS = 'rebelAntsMpVoice:v1', MUTED = 'rebelAntsMpVoiceMuted:v1', NEAR_R = 36, NEAR_MAX = 10;
  const ICE = [{ urls: 'stun:stun.cloudflare.com:3478' }];
  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v && typeof v === 'object' ? { ...d, ...v } : { ...d }; } catch (e) { return { ...d }; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const settings = load(SETTINGS, { hear: true, volume: 1 }), vmuted = load(MUTED, {});
  const log = (...a) => { if (window._mpDebug) console.log('[voice]', ...a); };
  let H = null, B = null, ctx = null, master = null, mic = null, micAsk = null, talking = null, hint = false, badge = null, heardAt = -1e9, frameAt = 0, frameGap = 0;

  // ---- a scope: 'room' (nearby, positional) or 'group' (the group, plain) ----
  function scope(name) { return { name, prod: null, cons: null, track: null, pub: false, pubWait: null, subs: new Map(), byMid: new Map(), want: '', syncing: false, syncAt: 0, failAt: -1e9, chain: Promise.resolve(), gen: 0 }; }
  const S = { room: scope('room'), group: scope('group'), stage: scope('stage') };
  const link = sc => sc.name === 'room' ? H.mp?.voice : sc.name === 'group' ? H.group?.voice : H.stage?.voice; // { send(o), open() }
  const sendTo = (sc, o) => !!link(sc)?.send(o);

  function audio() {
    if (ctx) { if (ctx.state !== 'running' && ctx.state !== 'closed') ctx.resume().catch(() => {}); return ctx; } // ('suspended', or Safari's 'interrupted')
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    ctx = new AC(); ctx.__noTap = true; master = ctx.createGain(); master.gain.value = settings.volume; master.connect(ctx.destination); // (__noTap: other players' voices never go into a clip)
    return ctx;
  }
  // iPhones start a page's audio only inside a finger lifting (touchend, pointerup), a click or a key: never on a finger
  // going down (Safari: a touchstart can be the start of a scroll). The Talk button presses on the way down, so on an
  // iPhone the voices' audio made there stayed suspended and nothing was heard (Oct 28, Miguel and a friend on two
  // iPhones). It starts, or starts again, on every such event once voice is on here; the badge asks for a tap meanwhile
  const ACTIVATE = ['pointerup', 'touchend', 'click', 'keydown', 'mousedown', 'pointerdown'];
  function wake() { if (ctx) audio(); else if (H && (available() || S.stage.subs.size)) audio(); }
  const waitingTap = () => !!ctx && ctx.state !== 'running' && [S.room, S.group, S.stage].some(sc => [...sc.subs.values()].some(s => s.node));
  // the microphone once (asks the first time); each scope talks through its own copy of the track. A microphone that
  // stopped (AirPods connected, or taken by the phone; a headset unplugged) or a change of the computer's inputs is taken
  // again on the next press, or at once while talking, and each scope swaps its copy without a new connection
  // (replaceTrack). Before, the page kept the dead microphone for the visit: "Talking" showed and nobody heard anything
  // (Oct 31, Miguel: "i have my airpods connected ... he cant hear me")
  let micStale = false;
  async function micTrack() {
    if (mic && (micStale || mic.readyState !== 'live')) { try { mic.stop(); } catch (e) {} mic = null; }
    micStale = false;
    if (mic) return mic;
    if (micAsk) return micAsk;
    micAsk = (async () => {
      try { if (navigator.audioSession) navigator.audioSession.type = 'play-and-record'; } catch (e) {} // (iOS: keep the voices on the speaker)
      const st = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      const m = st.getAudioTracks()[0]; m.enabled = false;
      m.addEventListener('ended', () => { if (mic !== m) return; micStale = true; report('mic-ended'); if (talking) refreshMic(); });
      return (mic = m);
    })().finally(() => { micAsk = null; });
    return micAsk;
  }
  // this scope's copy of the microphone, from the microphone in use (a new copy when it was taken again)
  async function freshTrack(sc) {
    const m = await micTrack();
    if (sc.track && sc.trackOf === m && sc.track.readyState === 'live') return sc.track;
    const t = m.clone(); t.enabled = false;
    const snd = sc.prod?.getSenders?.().find(x => !x.track || x.track.kind === 'audio');
    if (snd) await snd.replaceTrack(t);
    const old = sc.track; sc.track = t; sc.trackOf = m; if (old && old !== t) { try { old.stop(); } catch (e) {} }
    return t;
  }
  async function refreshMic() {
    const tk = talking; if (!tk) return; const sc = S[tk.where];
    try { await freshTrack(sc); if (talking === tk && tk.ready && sc.track) { sc.track.enabled = true; meter(sc.track); } report('mic-refreshed'); }
    catch (e) { report('mic-refresh-fail:' + (e?.name || '')); }
  }
  try { navigator.mediaDevices?.addEventListener?.('devicechange', () => { if (!mic) return; micStale = true; report('devicechange'); if (talking?.ready) refreshMic(); }); } catch (e) {}
  // how loud the microphone is while talking: a meter on the badge and the voice bubble (village-chat.js reads --vl), and
  // a hint when it hears nothing at all (a wrong or dead input) after a few seconds of talking
  const MIC = { an: null, src: null, of: null, buf: null, timer: 0, level: 0, peak: 0, since: 0, hinted: false };
  function meter(track) {
    const ac = audio(); if (!ac || !track) return;
    if (MIC.of !== track) {
      try { MIC.src?.disconnect(); } catch (e) {}
      try {
        if (!MIC.an) { MIC.an = ac.createAnalyser(); MIC.an.fftSize = 1024; MIC.buf = new Float32Array(MIC.an.fftSize); const z = ac.createGain(); z.gain.value = 0; MIC.an.connect(z); z.connect(ac.destination); } // (silent: only to keep the analyser running)
        MIC.src = ac.createMediaStreamSource(new MediaStream([track])); MIC.src.connect(MIC.an); MIC.of = track;
      } catch (e) { MIC.src = null; MIC.of = null; }
    }
    MIC.peak = 0; MIC.since = performance.now();
    if (!MIC.timer) MIC.timer = setInterval(meterTick, 80);
  }
  function meterTick() {
    if (!talking?.ready || !MIC.an) { clearInterval(MIC.timer); MIC.timer = 0; MIC.level = 0; paintMeter(); return; }
    MIC.an.getFloatTimeDomainData(MIC.buf); let s = 0; for (let i = 0; i < MIC.buf.length; i++) s += MIC.buf[i] * MIC.buf[i];
    const rms = Math.sqrt(s / MIC.buf.length); MIC.peak = Math.max(MIC.peak, rms);
    MIC.level = Math.max(rms > MIC.level ? rms : MIC.level * .82, 0); paintMeter();
    const tk = S[talking.where]?.track;
    if (!MIC.hinted && performance.now() - MIC.since > 5000 && (MIC.peak < .002 || tk?.muted)) {
      MIC.hinted = true; report('mic-silent:' + MIC.peak.toFixed(5) + (tk?.muted ? ':muted' : ''));
      H.toast?.("Your microphone isn't picking up any sound. Check the input in your computer's sound settings (AirPods: pick them as the input), or let go and press again.");
    }
  }
  function paintMeter() {
    const k = Math.min(1, Math.sqrt(MIC.level) * 3.2); // (speech sits around 0.02-0.1 rms)
    const i = badge?.querySelector('.lvl i'); if (i) i.style.width = Math.round(k * 100) + '%';
    document.getElementById('vcVoice')?.style.setProperty('--vl', k.toFixed(2));
  }
  const dtx = sdp => sdp.replace(/a=fmtp:(\d+) ([^\r\n]*)/g, (l, pt, p) => (new RegExp('a=rtpmap:' + pt + ' opus/', 'i').test(sdp) && !/usedtx/.test(p) ? `a=fmtp:${pt} ${p};usedtx=1` : l)); // (Opus DTX: silence costs next to nothing)
  const pc = () => new RTCPeerConnection({ bundlePolicy: 'max-bundle', iceServers: ICE });

  // ---- talking ----
  async function publish(sc) {
    if (sc.pub) return true;
    if (sc.pubWait) return sc.pubWait;
    sc.pubWait = (async () => {
      const m = await micTrack();
      if (sc.prod) { try { sc.prod.close(); } catch (e) {} }
      sc.track = m.clone(); sc.track.enabled = false; sc.trackOf = m;
      sc.prod = pc();
      const tx = sc.prod.addTransceiver(sc.track, { direction: 'sendonly' });
      const offer = await sc.prod.createOffer(); offer.sdp = dtx(offer.sdp);
      await sc.prod.setLocalDescription(offer);
      const reply = await ask(sc, { t: 'vp', sdp: sc.prod.localDescription.sdp, mid: tx.mid }, 'vp');
      if (!reply || reply.no) { sc.prod.close(); sc.prod = null; throw Object.assign(new Error('refused'), { why: reply?.no || 'timeout' }); }
      await sc.prod.setRemoteDescription({ type: 'answer', sdp: reply.sdp });
      sc.pub = true; return true;
    })().finally(() => { sc.pubWait = null; });
    return sc.pubWait;
  }
  // the reply to one of this page's own requests (the room / group answers in order)
  const waits = { room: [], group: [], stage: [] };
  function ask(sc, o, t) { return new Promise(res => { const w = { t, res }; waits[sc.name].push(w); if (!sendTo(sc, o)) { waits[sc.name].splice(waits[sc.name].indexOf(w), 1); res(null); return; } setTimeout(() => { const i = waits[sc.name].indexOf(w); if (i >= 0) { waits[sc.name].splice(i, 1); res(null); } }, 15000); }); }
  const WHY = { guest: 'Sign in to talk (Discord, or a name and PIN).', muted: 'An admin muted you.', off: 'Voice is off right now.', sfu: "Voice couldn't connect. Try again in a moment.", timeout: "Voice couldn't connect. Try again in a moment.", bad: "Voice couldn't connect." };
  async function talk(on) {
    if (on) {
      if (talking) return;
      if (!H.signedIn()) { H.toast?.(WHY.guest); return; }
      if (!H.canTalk()) return;
      audio();
      if (!available()) { if (!hint) { hint = true; H.toast?.('Voice is off right now.'); } return; } // (once a visit: X pressed by accident)
      const where = H.channel?.() === 'g' && H.group?.voice?.open?.() ? 'group' : H.stage?.canTalk?.() && H.stage?.voice?.open?.() ? 'stage' : 'room', sc = S[where];
      if (!link(sc)?.open()) { H.toast?.(where === 'group' ? 'Not connected to your group yet.' : 'Voice is only for your group here: pick Group in the chat.'); return; }
      talking = { where, at: performance.now(), ready: false };
      paintBadge();
      try { await publish(sc); await freshTrack(sc); }
      catch (e) { const why = e?.why || (e?.name === 'NotAllowedError' ? 'mic' : 'mic-none'); talking = null; paintBadge(); report('talk-fail:' + why + (e?.name ? ':' + e.name : '')); H.toast?.(why === 'mic' ? 'Universe needs your microphone to talk: allow it in the browser (the icon by the address).' : why === 'mic-none' ? 'No microphone found.' : WHY[why] || WHY.sfu); return; }
      if (!talking || talking.where !== where) return; // (let go meanwhile)
      sc.track.enabled = true; talking.ready = true; talking.on = performance.now(); paintBadge(); meter(sc.track); report('talk-on');
    } else {
      if (!talking) return;
      const sc = S[talking.where]; if (sc.track) sc.track.enabled = false;
      if (talking.on) try { window.badgeStat?.('voiceS', Math.min(600, (performance.now() - talking.on) / 1000)); } catch (e) {} // (the badges: seconds talked)
      talking = null; paintBadge(); report('talk-off');
    }
  }

  // ---- hearing ----
  // who this page wants to hear in a scope: nearby speakers (the same place, nearest first), or the group's
  function wanted(sc) {
    if (!settings.hear || sc.name !== 'stage' && !H.signedIn()) return [];
    if (sc.name === 'room') {
      return (H.mp?.chat?.peers?.() || []).filter(p => p.vo && p.d != null && p.d < NEAR_R && !vmuted[p.u] && !window.VillageChat?.isBlocked?.(p.u))
        .sort((a, b) => a.d - b.d).slice(0, NEAR_MAX).map(p => String(p.id));
    }
    if (sc.name === 'stage') return (H.stage?.speakers?.() || []).filter(u => !vmuted[u] && !window.VillageChat?.isBlocked?.(u)).slice(0, NEAR_MAX); // (the hosts and speakers: everyone at the event hears them, guests too)
    const st = H.group?.state; if (!st?.id) return [];
    return st.members.filter(x => x.u !== st.you && x.on && x.vo && !vmuted[x.u] && !window.VillageChat?.isBlocked?.(x.u)).map(x => x.u);
  }
  async function sync(sc) {
    if (sc.syncing || !link(sc)?.open()) return;
    const want = wanted(sc), key = want.slice().sort().join(',');
    const have = [...sc.subs.keys()].sort().join(',');
    if (key === have && key === sc.want) return;
    const now = performance.now(); if (now - sc.syncAt < 1200 || now - sc.failAt < 5000) return;
    sc.syncing = true; sc.syncAt = now; sc.want = key;
    try { if (!await ask(sc, { t: 'vs', want }, 'vs')) sc.failAt = performance.now(); } // (the answer itself: applySubs)
    finally { sc.syncing = false; }
  }
  // what the room / group says this page hears now (its answer to a 'vs', late or not, or a push: it decides): the voices
  // it no longer lists go, new ones come, and an offer for the new ones is answered; one at a time, in the order they come
  async function applySubs(sc, r, g) {
    try {
      if (r.no) sc.failAt = performance.now();
      if (r.push) sc.want = ''; // (look again: the room closed what this page may no longer hear)
      const next = new Map((r.subs || []).map(s => [String(s.key), s.mid]));
      for (const [k, sub] of [...sc.subs]) if (next.get(k) !== sub.mid) { unhear(sub); sc.subs.delete(k); }
      for (const [k, mid] of next) if (!sc.subs.has(k)) sc.subs.set(k, { key: k, mid, sc: sc.name });
      sc.byMid = new Map([...sc.subs.values()].map(s => [s.mid, s]));
      if (r.sdp) {
        if (!sc.cons) { sc.cons = pc(); sc.cons.ontrack = e => hear(sc, e.transceiver?.mid, e.track); }
        await sc.cons.setRemoteDescription({ type: 'offer', sdp: r.sdp });
        const a = await sc.cons.createAnswer(); await sc.cons.setLocalDescription(a);
        if (g !== sc.gen) return;
        sendTo(sc, { t: 'va', sdp: sc.cons.localDescription.sdp });
        for (const tx of sc.cons.getTransceivers()) if (tx.receiver?.track && sc.byMid.get(tx.mid) && !sc.byMid.get(tx.mid).node) hear(sc, tx.mid, tx.receiver.track);
        report('subs:' + sc.name);
      }
    } catch (e) { log('subs', sc.name, e); sc.failAt = performance.now(); }
  }
  // a voice coming in: through a muted <audio> (Chrome feeds remote WebRTC audio to Web Audio only then), a level meter,
  // a panner (nearby) or not (the group), its own gain
  function hear(sc, mid, track) {
    const sub = sc.byMid.get(mid); if (!sub || !track || sub.node) return;
    const ac = audio(); if (!ac) return;
    const stream = new MediaStream([track]), el = new Audio(); el.muted = true; el.srcObject = stream; el.play().catch(() => {});
    const src = ac.createMediaStreamSource(stream), meter = ac.createAnalyser(), gain = ac.createGain();
    meter.fftSize = 256; src.connect(meter);
    let tail = meter;
    if (sc.name === 'room') { const pan = ac.createPanner(); pan.panningModel = 'equalpower'; pan.distanceModel = 'inverse'; pan.refDistance = 3; pan.maxDistance = NEAR_R + 4; pan.rolloffFactor = 1.1; meter.connect(pan); tail = pan; sub.pan = pan; }
    tail.connect(gain); gain.connect(master);
    sub.node = { el, src, meter, gain, buf: new Float32Array(meter.fftSize) }; sub.level = 0; sub.speakAt = 0;
    log('hearing', sc.name, sub.key);
  }
  function unhear(sub) { const n = sub.node; if (!n) return; try { n.src.disconnect(); n.meter.disconnect(); n.gain.disconnect(); sub.pan?.disconnect(); n.el.srcObject = null; } catch (e) {} sub.node = null; setSpeaking(sub, false); }
  function setSpeaking(sub, on) {
    if (!!sub.speaking === on) return; sub.speaking = on;
    if (sub.sc === 'room') H.mp?.speaking?.(+sub.key, on); else paintBadge();
  }

  // ---- every frame: the listener and the panners, who is speaking, the subscriptions now and then ----
  // twice a second, whatever the frame rate: who this page hears (asked of the room / group), letting go of the talk key
  // when talking is no longer allowed here, the Talk button
  function upkeep() {
    if (!H) return;
    sync(S.room); sync(S.group); sync(S.stage); if (talking && (!H.canTalk() || talking.where === 'stage' && !H.stage?.canTalk?.())) talk(false); window.VillageTouch?.talkOn?.(available());
    const w = waitingTap(); if (w !== upkeep.waiting) { upkeep.waiting = w; paintBadge(); } // (voices come in while their audio waits on a tap)
    if (ctx && ctx.state !== upkeep.ctxState) { upkeep.ctxState = ctx.state; report('ctx:' + ctx.state); } else report();
  }
  function frame() {
    if (!H) return;
    const now = performance.now(); frameGap = frameAt ? now - frameAt : 0; frameAt = now;
    if (ctx && master) {
      // (Babylon is left-handed, Web Audio right-handed: every z flips)
      const L = H.listener?.(), al = ctx.listener;
      if (L) {
        if (al.positionX) { al.positionX.value = L.pos.x; al.positionY.value = L.pos.y; al.positionZ.value = -L.pos.z; al.forwardX.value = L.fwd.x; al.forwardY.value = L.fwd.y; al.forwardZ.value = -L.fwd.z; al.upX.value = L.up.x; al.upY.value = L.up.y; al.upZ.value = -L.up.z; }
        else { al.setPosition(L.pos.x, L.pos.y, -L.pos.z); al.setOrientation(L.fwd.x, L.fwd.y, -L.fwd.z, L.up.x, L.up.y, -L.up.z); }
      }
      for (const sub of S.room.subs.values()) {
        if (!sub.pan) continue;
        const p = H.mp?.chat?.peer?.(+sub.key); if (!p?.holder) continue;
        const q = p.holder.position;
        if (sub.pan.positionX) { sub.pan.positionX.value = q.x; sub.pan.positionY.value = q.y + 1.7; sub.pan.positionZ.value = -q.z; } else sub.pan.setPosition(q.x, q.y + 1.7, -q.z);
      }
      for (const sc of [S.room, S.group, S.stage]) for (const sub of sc.subs.values()) {
        const n = sub.node; if (!n) continue;
        n.meter.getFloatTimeDomainData(n.buf); let e = 0; for (let i = 0; i < n.buf.length; i++) e += n.buf[i] * n.buf[i];
        const rms = Math.sqrt(e / n.buf.length); if (rms > .012) sub.speakAt = heardAt = now;
        if (rms > (sub.peak || 0)) sub.peak = rms; // (the loudest since the last report)
        setSpeaking(sub, now - sub.speakAt < 350);
      }
    }
  }

  // ---- the room's and the group's news ----
  const myKey = name => String((name === 'room' ? H.mp : name === 'group' ? H.group : H.stage)?.voice?.you?.() || '');
  function onScope(name, m) {
    const sc = S[name];
    if (m.t === 'vs') { // (applied in order; the sync waiting for an answer goes on once it is: m.push = not an answer)
      const i = m.push ? -1 : waits[name].findIndex(x => x.t === 'vs'), w = i >= 0 ? waits[name].splice(i, 1)[0] : null;
      const g = sc.gen; sc.chain = sc.chain.then(() => g === sc.gen && applySubs(sc, m, g)).then(() => w?.res(m)); return; // (gen: a socket gone meanwhile = its news is stale)
    }
    if (m.t === 'vp') { const w = waits[name].findIndex(x => x.t === m.t); if (w >= 0) { const x = waits[name].splice(w, 1)[0]; x.res(m); } return; }
    if (m.t === 'vo') { // (someone's voice on / off: look again soon; my own off = my microphone's track is gone there)
      sc.syncAt = 0;
      if (!m.on && String(m.key) === myKey(name)) { if (talking && talking.where === name) { talking = null; paintBadge(); } sc.pub = false; try { sc.prod?.close(); } catch (e) {} sc.prod = null; if (sc.track) { try { sc.track.stop(); } catch (e) {} sc.track = null; } }
      return;
    }
    if (m.t === 'vcfg') { if (!m.on) reset(name); else sc.syncAt = 0; return; } // (voice switched on / off for this socket)
    if (m.t === 'vmute') { if (m.until > Date.now() && talking && talking.where === name) talk(false); return; } // (an admin muted you)
  }
  // the room or group socket went: its connections go too (a new socket = new sessions)
  function reset(name) {
    const sc = S[name]; sc.gen++;
    for (const sub of sc.subs.values()) unhear(sub);
    sc.subs.clear(); sc.byMid.clear(); sc.want = '';
    try { sc.prod?.close(); } catch (e) {} try { sc.cons?.close(); } catch (e) {}
    sc.prod = sc.cons = null; sc.pub = false; if (sc.track) { try { sc.track.stop(); } catch (e) {} sc.track = null; }
    for (const w of waits[name].splice(0)) w.res(null);
    if (talking && talking.where === name) { talking = null; paintBadge(); }
  }

  // ---- what shows: who you talk to while the key is held, the group's speakers ----
  const css = `
#vvBadge{position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:20;display:none;align-items:center;gap:8px;padding:7px 12px;background:rgba(5,10,28,.86);border:1px solid rgba(94,207,202,.45);color:#e9fffd;font:600 12px -apple-system,'Segoe UI',Arial,sans-serif;pointer-events:none;backdrop-filter:blur(8px)}
#vvBadge.on{display:flex}
#vvBadge .mic{width:10px;height:10px;border-radius:50%;background:#e05a6b;box-shadow:0 0 0 0 rgba(224,90,107,.7);animation:vvp 1s infinite}
#vvBadge .wait{background:#e8c56a;animation:none}
#vvBadge .spk{color:#7be38a}
#vvBadge .tap{color:#ffe08a}
#vvBadge .lvl{width:46px;height:6px;border-radius:3px;background:rgba(255,255,255,.14);overflow:hidden}
#vvBadge .lvl i{display:block;height:100%;width:0;background:linear-gradient(90deg,#5ecfca,#7be38a);transition:width .08s linear}
@keyframes vvp{0%{box-shadow:0 0 0 0 rgba(224,90,107,.7)}70%{box-shadow:0 0 0 9px rgba(224,90,107,0)}100%{box-shadow:0 0 0 0 rgba(224,90,107,0)}}
html.vt-touch #vvBadge{top:calc(max(12px,env(safe-area-inset-top,0px)) + 64px)}
body.in-game #vvBadge{display:none!important}`;
  function paintBadge() {
    if (!badge) return;
    const parts = [];
    if (talking) parts.push(`<span class="mic${talking.ready ? '' : ' wait'}"></span><span>${talking.ready ? 'Talking' : 'Connecting voice…'} · ${talking.where === 'group' ? 'Group' : talking.where === 'stage' ? 'Stage' : 'Nearby'}</span>${talking.ready ? '<span class="lvl" title="Your microphone"><i></i></span>' : ''}`);
    const g = [...[...S.group.subs.values()].filter(s => s.speaking).map(s => H.group?.member?.(s.key)?.n), ...[...S.stage.subs.values()].filter(s => s.speaking).map(s => H.stage?.nameOf?.(s.key))].filter(Boolean);
    if (g.length) parts.push(`<span class="spk">🔊 ${g.map(n => n.replace(/[<>&"]/g, '')).join(', ')}</span>`);
    if (waitingTap()) parts.push('<span class="tap">🔇 Tap the screen to hear voices</span>');
    badge.innerHTML = parts.join('<span>·</span>'); badge.classList.toggle('on', parts.length > 0);
  }

  // ---- the dev preview's voice report (Oct 28): every 5 s while voice is on, and at each step (talk on / off / failed,
  // new voices, the audio's state), the page's audio and voice state goes to /api/voice-diag (one line in the runtime
  // logs; no names or account ids, a random id per page), so a test on real iPhones says what the phones did: the
  // audio contexts and session, the microphone, the connections, packets and audio levels in and out (WebRTC stats) ----
  const REPORT = /-git-/.test(location.hostname) || window._voiceDiag === true, PID = Math.random().toString(36).slice(2, 10);
  let reportAt = -1e9, reportN = 0, lastWhy = '';
  async function rtc(pc) {
    if (!pc) return null;
    const o = { st: pc.connectionState, ice: pc.iceConnectionState };
    try {
      (await pc.getStats()).forEach(s => {
        if (s.kind !== 'audio') return;
        if (s.type === 'outbound-rtp') { o.txB = s.bytesSent; o.txP = s.packetsSent; }
        else if (s.type === 'media-source') o.micLvl = s.audioLevel == null ? null : +s.audioLevel.toFixed(3);
        else if (s.type === 'inbound-rtp') (o.rx = o.rx || []).push([s.mid ?? '', s.bytesReceived, s.packetsReceived, s.packetsLost, s.audioLevel == null ? null : +s.audioLevel.toFixed(3)]);
      });
    } catch (e) { o.err = String(e?.name || e).slice(0, 40); }
    return o;
  }
  async function report(why) {
    if (!REPORT || !H) return;
    const now = performance.now();
    if (why) { if (now - reportAt < 400) return; lastWhy = why; }
    else if (now - reportAt < 5000 || !available() && !talking && ![S.room, S.group, S.stage].some(sc => sc.subs.size)) return;
    reportAt = now; reportN++;
    try {
      const W = window._weather?.manager, m = W?.musicTrack, D = window._voiceDuck;
      const subs = sc => [...sc.subs.values()].map(s => { const r = [s.key, s.node ? 1 : 0, s.speaking ? 1 : 0, +(s.peak || 0).toFixed(3)]; s.peak = 0; return r; });
      const d = {
        v: 1, pid: PID, n: reportN, why: why || '', last: lastWhy, t: Date.now(), vis: document.visibilityState, ua: reportN === 1 ? navigator.userAgent.slice(0, 180) : undefined,
        ctx: ctx ? [ctx.state, ctx.sampleRate, +ctx.currentTime.toFixed(1)] : null, all: window._audioUnlock?.contexts,
        session: navigator.audioSession ? [navigator.audioSession.type, navigator.audioSession.state] : null,
        el: window._elementAudio?.state, duck: D ? [+D.k.toFixed(2), D.on, D.phone] : null,
        music: m ? [m.paused, m.muted, +(m._level || 0).toFixed(3), +(+m.volume || 0).toFixed(3)] : null,
        avail: available(), talk: talking ? [talking.where, talking.ready] : null, mic: mic ? [mic.readyState, mic.enabled, mic.muted] : null, vol: settings.volume, hear: settings.hear,
        room: { pub: S.room.pub, subs: subs(S.room), prod: await rtc(S.room.prod), cons: await rtc(S.room.cons) },
        group: S.group.subs.size || S.group.prod ? { pub: S.group.pub, subs: subs(S.group), prod: await rtc(S.group.prod), cons: await rtc(S.group.cons) } : undefined
      };
      navigator.sendBeacon?.('/api/voice-diag', JSON.stringify(d));
    } catch (e) { log('report', e); }
  }

  // voice can be used here now: signed in, and the room or the group has it switched on (the rooms' app is set up)
  const available = () => !!(H && H.signedIn() && (H.mp?.voice?.open?.() || H.group?.voice?.open?.() || (H.stage?.canTalk?.() && H.stage?.voice?.open?.())));
  function start(host) {
    if (H || !host || !window.RTCPeerConnection) return;
    H = host; B = window.BABYLON;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    badge = document.createElement('div'); badge.id = 'vvBadge'; document.body.appendChild(badge);
    // hold X to talk (not while typing); a tap, a click or a key anywhere wakes the audio
    window.addEventListener('keydown', e => {
      const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if ((e.key === 'x' || e.key === 'X') && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) talk(true);
    }, true);
    window.addEventListener('keyup', e => { if (e.key === 'x' || e.key === 'X') talk(false); }, true);
    window.addEventListener('blur', () => talk(false));
    document.addEventListener('visibilitychange', () => { if (document.hidden) talk(false); });
    ACTIVATE.forEach(t => window.addEventListener(t, wake, { capture: true, passive: true }));
    H.scene.onBeforeRenderObservable.add(() => { try { frame(); } catch (e) { log('frame', e); } });
    setInterval(() => { try { upkeep(); if (document.hidden) frame(); } catch (e) { log('upkeep', e); } }, 500); // (a hidden tab draws no frames: still answer the room)
  }
  window.VillageVoice = {
    start, talk, room: m => onScope('room', m), group: m => onScope('group', m), stage: m => onScope('stage', m), reset, available: () => available(),
    busy: () => !!talking || (settings.volume > 0 && performance.now() - heardAt < Math.max(1200, 2.5 * frameGap)), // (you hold Talk, or a voice you hear spoke in the last 1.2 s (or two frames): village.html lowers the music)
    isMuted: u => !!(u && vmuted[u]),
    mute: (u, n, on) => { if (!u) return; if (on) vmuted[u] = { n: n || 'Rebel', at: Date.now() }; else delete vmuted[u]; save(MUTED, vmuted); S.room.syncAt = S.group.syncAt = 0; },
    muted: () => ({ ...vmuted }),
    get settings() { return settings; },
    _dbg: { mic: () => mic, scope: n => S[n], meter: () => ({ level: MIC.level, peak: MIC.peak, on: !!MIC.timer }) }, // (tests)
    set: (k, v) => { settings[k] = v; save(SETTINGS, settings); if (k === 'volume' && master) master.gain.value = v; if (k === 'hear') { S.room.syncAt = S.group.syncAt = 0; } },
    get state() { const sub = sc => [...sc.subs.values()].map(s => ({ key: s.key, mid: s.mid, on: !!s.node, speaking: !!s.speaking })); return { talking: talking ? { ...talking } : null, ctx: ctx?.state || null, mic: !!mic, room: { pub: S.room.pub, subs: sub(S.room), prod: S.room.prod?.connectionState || null, cons: S.room.cons?.connectionState || null }, group: { pub: S.group.pub, subs: sub(S.group), prod: S.group.prod?.connectionState || null, cons: S.group.cons?.connectionState || null }, stage: { pub: S.stage.pub, subs: sub(S.stage), prod: S.stage.prod?.connectionState || null, cons: S.stage.cons?.connectionState || null } }; }
  };
})();
