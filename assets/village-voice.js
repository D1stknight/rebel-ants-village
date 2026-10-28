// Universe multiplayer, voice: push to talk (hold X, or the Talk button on phones), the voices of the players around you
// (positional: louder near, from their side) and your group's voices from any village. Signed-in players only (guests
// neither talk nor hear). The voices go through Cloudflare Realtime SFU, but this page never talks to it: its offers and
// answers go through the room (nearby) or the group socket (realtime/src/voice.js), which decide whom it may hear.
// Per scope (the room, the group) one producer connection (the microphone, published once, silent unless the talk key is
// held: Opus DTX keeps the silence to a trickle) and one consumer connection (the voices heard), as Cloudflare's own
// video-room example does. You talk where you type: the chat's Group channel picked = the group hears you, else the
// players near you. window.VillageVoice.start(host) from village.html, host = { scene, mp, group, signedIn(), canTalk(),
// channel() -> chat channel, listener() -> { pos, fwd, up } (the camera), place() -> my interior | null, toast(msg) }.
(function () {
  'use strict';
  const SETTINGS = 'rebelAntsMpVoice:v1', MUTED = 'rebelAntsMpVoiceMuted:v1', NEAR_R = 36, NEAR_MAX = 10;
  const ICE = [{ urls: 'stun:stun.cloudflare.com:3478' }];
  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v && typeof v === 'object' ? { ...d, ...v } : { ...d }; } catch (e) { return { ...d }; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const settings = load(SETTINGS, { hear: true, volume: 1 }), vmuted = load(MUTED, {});
  const log = (...a) => { if (window._mpDebug) console.log('[voice]', ...a); };
  let H = null, B = null, ctx = null, master = null, mic = null, micAsk = null, talking = null, hint = false, badge = null;

  // ---- a scope: 'room' (nearby, positional) or 'group' (the group, plain) ----
  function scope(name) { return { name, prod: null, cons: null, track: null, pub: false, pubWait: null, subs: new Map(), byMid: new Map(), want: '', syncing: false, syncAt: 0, failAt: -1e9, chain: Promise.resolve(), gen: 0 }; }
  const S = { room: scope('room'), group: scope('group') };
  const link = sc => sc.name === 'room' ? H.mp?.voice : H.group?.voice; // { send(o), open() }
  const sendTo = (sc, o) => !!link(sc)?.send(o);

  function audio() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return ctx; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = settings.volume; master.connect(ctx.destination);
    return ctx;
  }
  // the microphone once (asks the first time); each scope talks through its own copy of the track
  async function micTrack() {
    if (mic) return mic;
    if (micAsk) return micAsk;
    micAsk = (async () => {
      try { if (navigator.audioSession) navigator.audioSession.type = 'play-and-record'; } catch (e) {} // (iOS: keep the voices on the speaker)
      const st = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      mic = st.getAudioTracks()[0]; mic.enabled = false;
      return mic;
    })().catch(e => { micAsk = null; throw e; });
    return micAsk;
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
      sc.track = m.clone(); sc.track.enabled = false;
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
  const waits = { room: [], group: [] };
  function ask(sc, o, t) { return new Promise(res => { const w = { t, res }; waits[sc.name].push(w); if (!sendTo(sc, o)) { waits[sc.name].splice(waits[sc.name].indexOf(w), 1); res(null); return; } setTimeout(() => { const i = waits[sc.name].indexOf(w); if (i >= 0) { waits[sc.name].splice(i, 1); res(null); } }, 15000); }); }
  const WHY = { guest: 'Sign in to talk (Discord, or a name and PIN).', muted: 'An admin muted you.', off: 'Voice is off right now.', sfu: "Voice couldn't connect. Try again in a moment.", timeout: "Voice couldn't connect. Try again in a moment.", bad: "Voice couldn't connect." };
  async function talk(on) {
    if (on) {
      if (talking) return;
      if (!H.signedIn()) { H.toast?.(WHY.guest); return; }
      if (!H.canTalk()) return;
      audio();
      if (!available()) { if (!hint) { hint = true; H.toast?.('Voice is off right now.'); } return; } // (once a visit: X pressed by accident)
      const where = H.channel?.() === 'g' && H.group?.voice?.open?.() ? 'group' : 'room', sc = S[where];
      if (!link(sc)?.open()) { H.toast?.(where === 'group' ? 'Not connected to your group yet.' : 'Voice is only for your group here: pick Group in the chat.'); return; }
      talking = { where, at: performance.now(), ready: false };
      paintBadge();
      try { await publish(sc); }
      catch (e) { const why = e?.why || (e?.name === 'NotAllowedError' ? 'mic' : 'mic-none'); talking = null; paintBadge(); H.toast?.(why === 'mic' ? 'Universe needs your microphone to talk: allow it in the browser (the icon by the address).' : why === 'mic-none' ? 'No microphone found.' : WHY[why] || WHY.sfu); return; }
      if (!talking || talking.where !== where) return; // (let go meanwhile)
      sc.track.enabled = true; talking.ready = true; paintBadge();
    } else {
      if (!talking) return;
      const sc = S[talking.where]; if (sc.track) sc.track.enabled = false;
      talking = null; paintBadge();
    }
  }

  // ---- hearing ----
  // who this page wants to hear in a scope: nearby speakers (the same place, nearest first), or the group's
  function wanted(sc) {
    if (!settings.hear || !H.signedIn()) return [];
    if (sc.name === 'room') {
      return (H.mp?.chat?.peers?.() || []).filter(p => p.vo && p.d != null && p.d < NEAR_R && !vmuted[p.u] && !window.VillageChat?.isBlocked?.(p.u))
        .sort((a, b) => a.d - b.d).slice(0, NEAR_MAX).map(p => String(p.id));
    }
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
    sync(S.room); sync(S.group); if (talking && !H.canTalk()) talk(false); window.VillageTouch?.talkOn?.(available());
  }
  function frame() {
    if (!H) return;
    const now = performance.now();
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
      for (const sc of [S.room, S.group]) for (const sub of sc.subs.values()) {
        const n = sub.node; if (!n) continue;
        n.meter.getFloatTimeDomainData(n.buf); let e = 0; for (let i = 0; i < n.buf.length; i++) e += n.buf[i] * n.buf[i];
        const rms = Math.sqrt(e / n.buf.length); if (rms > .012) sub.speakAt = now;
        setSpeaking(sub, now - sub.speakAt < 350);
      }
    }
  }

  // ---- the room's and the group's news ----
  const myKey = name => String(name === 'room' ? H.mp?.voice?.you?.() || '' : H.group?.voice?.you?.() || '');
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
@keyframes vvp{0%{box-shadow:0 0 0 0 rgba(224,90,107,.7)}70%{box-shadow:0 0 0 9px rgba(224,90,107,0)}100%{box-shadow:0 0 0 0 rgba(224,90,107,0)}}
html.vt-touch #vvBadge{top:calc(max(12px,env(safe-area-inset-top,0px)) + 64px)}
body.in-game #vvBadge{display:none!important}`;
  function paintBadge() {
    if (!badge) return;
    const parts = [];
    if (talking) parts.push(`<span class="mic${talking.ready ? '' : ' wait'}"></span><span>${talking.ready ? 'Talking' : 'Connecting voice…'} · ${talking.where === 'group' ? 'Group' : 'Nearby'}</span>`);
    const g = [...S.group.subs.values()].filter(s => s.speaking).map(s => H.group?.member?.(s.key)?.n).filter(Boolean);
    if (g.length) parts.push(`<span class="spk">🔊 ${g.map(n => n.replace(/[<>&"]/g, '')).join(', ')}</span>`);
    badge.innerHTML = parts.join('<span>·</span>'); badge.classList.toggle('on', parts.length > 0);
  }

  // voice can be used here now: signed in, and the room or the group has it switched on (the rooms' app is set up)
  const available = () => !!(H && H.signedIn() && (H.mp?.voice?.open?.() || H.group?.voice?.open?.()));
  function start(host) {
    if (H || !host || !window.RTCPeerConnection) return;
    H = host; B = window.BABYLON;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    badge = document.createElement('div'); badge.id = 'vvBadge'; document.body.appendChild(badge);
    // hold X to talk (not while typing); a press anywhere wakes the audio
    window.addEventListener('keydown', e => {
      const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if ((e.key === 'x' || e.key === 'X') && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) talk(true);
    }, true);
    window.addEventListener('keyup', e => { if (e.key === 'x' || e.key === 'X') talk(false); }, true);
    window.addEventListener('blur', () => talk(false));
    document.addEventListener('visibilitychange', () => { if (document.hidden) talk(false); });
    document.addEventListener('pointerdown', () => { if (ctx) audio(); }, true);
    H.scene.onBeforeRenderObservable.add(() => { try { frame(); } catch (e) { log('frame', e); } });
    setInterval(() => { try { upkeep(); if (document.hidden) frame(); } catch (e) { log('upkeep', e); } }, 500); // (a hidden tab draws no frames: still answer the room)
  }
  window.VillageVoice = {
    start, talk, room: m => onScope('room', m), group: m => onScope('group', m), reset, available: () => available(),
    isMuted: u => !!(u && vmuted[u]),
    mute: (u, n, on) => { if (!u) return; if (on) vmuted[u] = { n: n || 'Rebel', at: Date.now() }; else delete vmuted[u]; save(MUTED, vmuted); S.room.syncAt = S.group.syncAt = 0; },
    muted: () => ({ ...vmuted }),
    get settings() { return settings; },
    set: (k, v) => { settings[k] = v; save(SETTINGS, settings); if (k === 'volume' && master) master.gain.value = v; if (k === 'hear') { S.room.syncAt = S.group.syncAt = 0; } },
    get state() { const sub = sc => [...sc.subs.values()].map(s => ({ key: s.key, mid: s.mid, on: !!s.node, speaking: !!s.speaking })); return { talking: talking ? { ...talking } : null, ctx: ctx?.state || null, mic: !!mic, room: { pub: S.room.pub, subs: sub(S.room), prod: S.room.prod?.connectionState || null, cons: S.room.cons?.connectionState || null }, group: { pub: S.group.pub, subs: sub(S.group), prod: S.group.prod?.connectionState || null, cons: S.group.cons?.connectionState || null } }; }
  };
})();
