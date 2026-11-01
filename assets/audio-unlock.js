// assets/audio-unlock.js — every AudioContext this page makes starts on the next finger lift, click or key (Oct 28).
// iPhones let a page's sound start only inside a finger lifting (touchend, pointerup), a click or a key press: never on
// a finger going down (Safari: a touchstart can be the start of a scroll). A context made at any other moment stays
// suspended until resumed inside one of those, and WebKit leaves one 'interrupted' after a call, Siri or the
// background. Universe made its contexts on a finger going down or in the render loop (the voices, the footsteps, the
// tale sounds, the weapon swishes, the water and the surf), so on an iPhone they could stay silent the whole visit:
// Miguel and a friend could not hear each other's voices. Each context is noted as it is made (the constructor is
// wrapped; its callers see no difference) and every such event resumes the ones that are not running.
// Loaded before any script that makes one. Also on iPhones: the page's sound is media ('playback'), as its music
// already was, so the ring / silent switch doesn't mute the voices once the music is quiet (the voice module asks for
// 'play-and-record' when the microphone opens).
// Clips (Nov 1, assets/clip-recorder.js): each context's way to its speakers is copied into a gain of its own (a tap),
// so a clip records what the player hears. Every connect to a context's destination also connects to its tap, every
// disconnect from it also leaves the tap; a tap nothing listens to does no work (browsers only run what a speaker or a
// recorder pulls), so this costs nothing until a clip records. Contexts marked __noTap stay out (the voices: other
// players never go into a clip); offline contexts too.
(function () {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC || AC.__unlockWrapped) return;
  const all = new Set();
  const Wrapped = new Proxy(AC, {
    construct(target, args, newTarget) {
      const c = Reflect.construct(target, args, newTarget === Wrapped ? target : newTarget); all.add(c);
      queueMicrotask(() => { try { api.onContext?.(c); } catch (e) {} }); // (after its maker could mark it __noTap)
      return c;
    },
    get(target, key, receiver) { return key === '__unlockWrapped' ? true : Reflect.get(target, key, target); }
  });
  if (window.AudioContext) window.AudioContext = Wrapped;
  if (window.webkitAudioContext) window.webkitAudioContext = Wrapped;
  let session = false;
  function wake() {
    if (!session) {
      session = true;
      try { if (navigator.audioSession && navigator.audioSession.type === 'auto') navigator.audioSession.type = 'playback'; } catch (e) {}
    }
    for (const c of all) {
      if (c.state === 'closed') { all.delete(c); continue; }
      if (c.state !== 'running') c.resume().catch(() => {});
    }
  }
  ['touchend', 'pointerup', 'click', 'keydown', 'mousedown'].forEach(t => window.addEventListener(t, wake, { capture: true, passive: true }));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) for (const c of all) if (c.state !== 'running' && c.state !== 'closed') c.resume().catch(() => {}); });
  // the taps
  const taps = new WeakMap(), OAC = window.OfflineAudioContext;
  function tap(ctx) {
    if (!ctx || ctx.__noTap || ctx.state === 'closed' || (OAC && ctx instanceof OAC)) return null;
    let t = taps.get(ctx);
    if (!t) { try { t = ctx.createGain(); t.__tap = true; taps.set(ctx, t); } catch (e) { return null; } }
    return t;
  }
  const AN = window.AudioNode && window.AudioNode.prototype;
  if (AN && AN.connect && !AN.connect.__tap) {
    const connect = AN.connect, disconnect = AN.disconnect;
    const wrapped = function (dest, output, input) {
      const r = connect.apply(this, arguments);
      try {
        const c = this.context;
        if (dest && c && dest === c.destination && !this.__tap) { const t = tap(c); if (t) connect.call(this, t, output || 0); }
      } catch (e) {}
      return r;
    };
    wrapped.__tap = true;
    AN.connect = wrapped;
    AN.disconnect = function (dest, output) {
      const r = disconnect.apply(this, arguments);
      try {
        const c = this.context;
        if (dest && c && dest === c.destination) { const t = taps.get(c); if (t) { if (arguments.length > 1) disconnect.call(this, t, output); else disconnect.call(this, t); } }
      } catch (e) {}
      return r;
    };
  }
  const api = window._audioUnlock = {
    get contexts() { return [...all].map(c => c.state); }, wake, // tests, diagnostics
    list: () => [...all].filter(c => c.state !== 'closed'), tap, onContext: null // the clip recorder
  };
})();
