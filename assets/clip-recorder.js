// assets/clip-recorder.js -- short videos of the game for social posts (Nov 1).
// Miguel: TikTok takes videos, "record a 10 second video but delete it right away if the user doesn't download it",
// longer helps promotion, nothing kept in the game, no cost to performance. Nothing runs until a player starts a clip:
// then each frame the game draws (at most 30 a second) is copied into a 720 x 1280 polaroid (PhotoShare.clipStage: the
// frame in the tilted print on a blurred copy of itself, the sticker, "Check me out in the Rebel Universe") and the
// browser's own video encoder (MediaRecorder: H.264 in an MP4 where the browser has it, else WebM) records that canvas
// with the game's sound. Only the 3D view goes in, never the page's buttons, chat or other players' voices. The clip is
// a Blob in this page's memory: nothing is uploaded or stored; the page drops it when the card closes.
//   ClipRecorder.start({ canvas, onFrame(fn) -> off, caption, maxSec, light, bitrate, elements() -> [audio], onAuto(why) })
//     -> { ok, reason }; ClipRecorder.stop() -> { blob, url, type, ext, ms, bytes, w, h } | null
// Sound: assets/audio-unlock.js taps every AudioContext's way to the speakers (the voices' context stays out); this
// mixes those taps, plus the page's <audio> elements that play outside Web Audio (computers: the music and ambience;
// HTMLMediaElement.captureStream, at the volume the element plays at), into one track. Browsers without either record
// what they can (Safari on a Mac: the Web Audio sounds; no music).
(function () {
  // H.264 + AAC where the browser has them (what X, Instagram and TikTok take), then H.264 + Opus, plain MP4 only in
  // Safari (its recorder writes H.264; Chromium's plain 'video/mp4' can mean VP9), else WebM (VP8 / Opus)
  const WEBKIT = /AppleWebKit/.test(navigator.userAgent) && !/Chrome\/|Chromium|Edg\/|OPR\//.test(navigator.userAgent);
  const H264 = ['avc1.42E028', 'avc1.42E01F', 'avc1'];
  const AV = [...H264.map((v) => `video/mp4;codecs=${v},mp4a.40.2`), ...H264.map((v) => `video/mp4;codecs=${v},opus`), ...(WEBKIT ? ['video/mp4'] : []), 'video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9,opus', 'video/webm'];
  const V = [...H264.map((v) => `video/mp4;codecs=${v}`), ...(WEBKIT ? ['video/mp4'] : []), 'video/webm;codecs=vp8', 'video/webm;codecs=vp9', 'video/webm'];
  const can = (t) => { try { return MediaRecorder.isTypeSupported(t); } catch (e) { return false; } };
  const pick = (audio) => (audio ? AV : V).find(can) || '';
  function supported() {
    return typeof window.MediaRecorder === 'function' && typeof HTMLCanvasElement !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function' && !!pick(false) && !!window.PhotoShare?.clipStage;
  }
  let R = null; // the recording
  const LIFT = 4; // (+12 dB into the limiter)

  // ── the sound: every tapped AudioContext and the elements outside Web Audio, mixed in a context of our own ──
  function openMix(elements) {
    const U = window._audioUnlock, AC = window.AudioContext || window.webkitAudioContext;
    if (!AC || !U?.tap || !U?.list) return null;
    let mix = null, dest = null, bus = null;
    try {
      mix = new AC(); mix.__noTap = true; dest = mix.createMediaStreamDestination();
      // the game's mix plays well under full scale (music at a fifth, room for the voices); social apps play their
      // videos loud, so the clip's sound is lifted and held under full scale by a limiter (the game itself is unchanged)
      bus = mix.createGain(); bus.gain.value = LIFT;
      const lim = mix.createDynamicsCompressor();
      lim.threshold.value = -16; lim.knee.value = 4; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.25;
      bus.connect(lim); lim.connect(dest);
    } catch (e) { try { mix?.close(); } catch (x) {} return null; }
    const links = new Map(), els = new Map();
    function addCtx(ctx) {
      if (!ctx || ctx === mix || ctx.__noTap || ctx.state === 'closed' || links.has(ctx)) return;
      const tap = U.tap(ctx); if (!tap) return;
      try { const d = ctx.createMediaStreamDestination(); tap.connect(d); const s = mix.createMediaStreamSource(d.stream); s.connect(bus); links.set(ctx, { tap, d, s }); } catch (e) {}
    }
    const vol = (el) => (el.muted || el.paused ? 0 : Math.max(0, Math.min(1, Number(el.volume) || 0)));
    function addEl(el) {
      // (an element routed through Web Audio is in a tap already; Safari has no captureStream on media elements, and
      // Firefox's own version silences the element)
      if (!el || els.has(el) || el._gain || typeof el.captureStream !== 'function' || 'mozCaptureStream' in el) return;
      let st; try { st = el.captureStream(); } catch (e) { return; }
      const e = { st, s: null, g: null }; els.set(el, e);
      const hook = () => {
        if (e.s || !st.getAudioTracks().length) return;
        try { e.s = mix.createMediaStreamSource(st); e.g = mix.createGain(); e.g.gain.value = vol(el); e.s.connect(e.g); e.g.connect(bus); } catch (x) {}
      };
      hook(); if (!e.s) st.addEventListener('addtrack', hook);
    }
    for (const c of U.list()) addCtx(c);
    U.onContext = addCtx; // (a context made while recording: the first footstep, a tale's sound)
    try { (elements?.() || []).forEach(addEl); } catch (e) {}
    return {
      track: dest.stream.getAudioTracks()[0] || null, addEl,
      update() { for (const [el, e] of els) if (e.g) e.g.gain.value = vol(el); },
      // (when the player stops: the clip's sound fades out in 60 ms, so the moments the encoder takes to finish add a
      // quiet end, not more of the game's sound over the last picture)
      hush() { try { const t = mix.currentTime; bus.gain.cancelScheduledValues(t); bus.gain.setValueAtTime(bus.gain.value, t); bus.gain.linearRampToValueAtTime(0, t + 0.06); } catch (e) {} },
      close() {
        if (U.onContext === addCtx) U.onContext = null;
        for (const l of links.values()) { try { l.tap.disconnect(l.d); } catch (e) {} try { l.s.disconnect(); } catch (e) {} }
        for (const e of els.values()) { try { e.s?.disconnect(); } catch (x) {} try { e.st.getTracks().forEach((t) => t.stop()); } catch (x) {} }
        links.clear(); els.clear();
        try { mix.close(); } catch (e) {}
      }
    };
  }

  async function start(o = {}) {
    if (R) return { ok: false, reason: 'busy' };
    if (!supported()) return { ok: false, reason: 'unsupported' };
    const src = o.canvas; if (!src || !src.width) return { ok: false, reason: 'nocanvas' };
    const rec = R = { stopping: false, chunks: [], t0: 0, last: 0, frames: 0 };
    // the sound's mix first, while the press that started the clip is still on (iPhones start a page's sound only then)
    const mix = o.audio === false ? null : openMix(o.elements);
    rec.mix = mix;
    try {
      const stage = await window.PhotoShare.clipStage({ srcW: src.width, srcH: src.height, caption: o.caption || '' });
      if (R !== rec) { mix?.close(); return { ok: false, reason: 'stopped' }; }
      const k = o.light ? 0.75 : 1; // (a phone that ran out of memory: 540 x 960)
      const out = document.createElement('canvas'); out.width = Math.round(stage.W * k); out.height = Math.round(stage.H * k);
      const g = out.getContext('2d', { alpha: false }); if (k !== 1) g.setTransform(k, 0, 0, k, 0, 0);
      // the first frame is drawn before the video starts, so the clip never opens on a blank picture (a video's first
      // frame is its cover in most apps); the game's picture can only be copied right after the game has drawn it
      const first = await new Promise((res) => {
        let off = null, done = false;
        const end = (v) => { if (done) return; done = true; clearTimeout(t); try { off?.(); } catch (e) {} res(v); };
        const t = setTimeout(() => end(false), 8000);
        off = o.onFrame(() => { try { if (stage.frame(g, src)) end(true); } catch (e) { end(false); } });
      });
      if (R !== rec) { mix?.close(); return { ok: false, reason: 'stopped' }; }
      if (!first) throw new Error('no frame from the game');
      rec.t0 = rec.last = performance.now(); rec.frames = 1;
      let vstream = out.captureStream(0), vtrack = vstream.getVideoTracks()[0];
      const manual = typeof vtrack?.requestFrame === 'function';
      if (!manual) { vtrack?.stop(); vstream = out.captureStream(30); vtrack = vstream.getVideoTracks()[0]; }
      if (!vtrack) throw new Error('no video track');
      const tracks = [vtrack]; if (mix?.track) tracks.push(mix.track); else if (mix) { mix.close(); rec.mix = null; }
      let type = pick(tracks.length > 1), mr = null;
      const opts = (t) => Object.assign({ videoBitsPerSecond: o.bitrate || 2500000, audioBitsPerSecond: 128000 }, t ? { mimeType: t } : {});
      try { mr = new MediaRecorder(new MediaStream(tracks), opts(type)); }
      catch (e) { // (a browser that won't take the sound with this video: the picture alone)
        if (tracks.length < 2) throw e;
        mix?.close(); rec.mix = null; tracks.pop(); type = pick(false); mr = new MediaRecorder(new MediaStream(tracks), opts(type));
      }
      Object.assign(rec, { stage, out, g, vtrack, manual, mix: tracks.length > 1 ? mix : null, mr, type, src, onAuto: o.onAuto, max: Math.max(3, o.maxSec || 60) * 1000 });
      mr.ondataavailable = (e) => { if (e.data && e.data.size) rec.chunks.push(e.data); };
      // the first frame (drawn above) is sent now and again when the recorder says it has started: a busy page's
      // recorder can take seconds to start, and a frame sent before that is lost. The browser takes a requested frame
      // only from a canvas drawn since the last screen frame, so one clear pixel marks it drawn. Without these the
      // first frame never went in, and a clip whose game drew no new frame after the start (a short one, a busy or
      // paused page) came out as an empty file
      const firstAgain = () => {
        if (R !== rec) return; // (over and cleaned up; a clip being stopped still takes it: the stop can come first)
        if (manual) { try { vtrack.requestFrame(); } catch (e) {} }
        g.fillStyle = 'rgba(0,0,0,0)'; g.fillRect(0, 0, 1, 1);
      };
      mr.addEventListener('start', firstAgain, { once: true });
      mr.start(); // (one piece at the end: Safari's MP4 pieces don't always join into a playable file)
      firstAgain();
      const gap = 1000 / Math.min(30, o.fps || 30) - 4;
      rec.off = o.onFrame(() => {
        if (rec.stopping) return;
        const now = performance.now();
        if (now - rec.last < gap) return;
        rec.last = now;
        try { if (!stage.frame(g, src)) return; } catch (e) { return; }
        if (!rec.t0) rec.t0 = now;
        rec.frames++;
        rec.mix?.update();
        if (manual) { try { vtrack.requestFrame(); } catch (e) {} }
        if (now - rec.t0 >= rec.max) auto('max');
      });
      rec.timer = setInterval(() => { if (rec.t0 && performance.now() - rec.t0 >= rec.max) auto('max'); }, 500);
      rec.vis = () => { if (document.hidden) auto('hidden'); };
      document.addEventListener('visibilitychange', rec.vis);
      return { ok: true, type };
    } catch (e) {
      console.warn('clip failed to start', e);
      cleanup(rec); if (R === rec) R = null;
      return { ok: false, reason: 'error', error: String(e?.message || e) };
    }
  }
  function auto(why) { const rec = R; if (!rec || rec.stopping || rec.autoSent) return; rec.autoSent = true; try { rec.onAuto?.(why); } catch (e) {} }
  function cleanup(rec) {
    try { rec.off?.(); } catch (e) {}
    clearInterval(rec.timer);
    if (rec.vis) document.removeEventListener('visibilitychange', rec.vis);
    try { rec.vtrack?.stop(); } catch (e) {}
    try { rec.mix?.close(); } catch (e) {}
  }
  // o.quick: no waiting for the encoder (a clip the page drops anyway: too short)
  async function stop(o = {}) {
    const rec = R; if (!rec || rec.stopping) return null;
    rec.stopping = true;
    if (!rec.mr) { cleanup(rec); if (R === rec) R = null; return null; } // (still starting)
    try { rec.off?.(); } catch (e) {} rec.off = null;
    rec.mix?.hush();
    const ms = rec.t0 ? performance.now() - rec.t0 : 0;
    // the video encoder finishes the frames it was given first: a slow one (software, a busy computer) can be seconds
    // behind, and the browser drops what it hasn't finished when the recording stops. Until a slice of the recording
    // comes back with little more than the sound in it, twice (at most 5 s). Nothing back at all yet = the encoder
    // hasn't written its first picture (the file waits for it, the sound too): that is not caught up, so up to 12 s for
    // it, then 3 s more. Safari: a fixed half second (its MP4 pieces don't always join, and its encoders are the
    // hardware's)
    const t1 = performance.now();
    if (!o.quick && !WEBKIT && typeof rec.mr.requestData === 'function') {
      let small = 0, got = 0, end = t1 + 12000;
      while (small < 2 && performance.now() < end && rec.mr.state === 'recording') {
        const slice = new Promise((res) => {
          const h = (e) => { rec.mr.removeEventListener('dataavailable', h); res(e.data ? e.data.size : 0); };
          rec.mr.addEventListener('dataavailable', h);
          setTimeout(() => { rec.mr.removeEventListener('dataavailable', h); res(-1); }, 1500);
        });
        try { rec.mr.requestData(); } catch (e) { break; }
        const size = await slice;
        if (size > 0 && !got) end = Math.min(end, Math.max(t1 + 5000, performance.now() + 3000));
        if (size > 0) got += size;
        small = got && size >= 0 && size < 12000 ? small + 1 : 0;
        if (small < 2) await new Promise((res) => setTimeout(res, 300));
      }
    } else if (!o.quick) await new Promise((res) => setTimeout(res, 500));
    await new Promise((res) => {
      const t = setTimeout(res, 4000); // (onstop never came)
      try { rec.mr.onstop = () => { clearTimeout(t); res(); }; if (rec.mr.state !== 'inactive') rec.mr.stop(); else { clearTimeout(t); res(); } }
      catch (e) { clearTimeout(t); res(); }
    });
    cleanup(rec); if (R === rec) R = null;
    const type = (rec.mr.mimeType || rec.type || 'video/webm').split(';')[0];
    if (!rec.chunks.length) return null;
    const blob = new Blob(rec.chunks, { type }); rec.chunks = [];
    // (a file with no picture in it, only the container's own bits: a 720 x 1280 frame is tens of KB)
    if (blob.size < 4096) return null;
    return { blob, url: URL.createObjectURL(blob), type, ext: /mp4/.test(type) ? 'mp4' : 'webm', ms, bytes: blob.size, w: rec.out.width, h: rec.out.height, frames: rec.frames };
  }

  window.ClipRecorder = {
    supported, start, stop, pick,
    get recording() { return !!R && !R.stopping; },
    get seconds() { return R?.t0 ? (performance.now() - R.t0) / 1000 : 0; },
    addElement(el) { try { R?.mix?.addEl(el); } catch (e) {} }
  };
})();
