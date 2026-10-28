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
(function () {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC || AC.__unlockWrapped) return;
  const all = new Set();
  const Wrapped = new Proxy(AC, {
    construct(target, args, newTarget) { const c = Reflect.construct(target, args, newTarget === Wrapped ? target : newTarget); all.add(c); return c; },
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
  window._audioUnlock = { get contexts() { return [...all].map(c => c.state); }, wake }; // tests, diagnostics
})();
