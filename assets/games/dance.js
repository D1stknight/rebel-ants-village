// Dance-off (Oct 15): each village has its own song (a little Web Audio band: drums, plucked strings, flute, brass, steel
// pan, organ ...) and three levels. Arrows run along the lane to the ring in time with the music: press the same arrow
// (arrow keys, W A S D or the pads) as each one reaches it. A good press makes your Rebel dance (cartwheels, flips,
// kicks, the village's own move set) and builds a combo. Land enough moves to clear the level; harder levels score more.
// def: { song: <id in SONGS>, moves: [left, up, right, down] clip names, floor: [r, g, b], pass, points,
// car: true | kit type (Saints Lowrider Hop: the moves bounce the lowrider on its hydraulics instead), carYaw,
//   camR / camY / camT [x, y, z] (the camera: distance, height, look-at), playerAt [x, z, yaw] }
(function () {
  const BEST_KEY = 'rebelAntsDanceBest:v1';
  const loadBest = () => { try { return JSON.parse(localStorage.getItem(BEST_KEY) || '{}') || {}; } catch (e) { return {}; } };
  const saveBest = (id, lv, n) => { try { const all = loadBest(); all[id] = { ...(all[id] || {}), [lv]: Math.max(n, all[id]?.[lv] || 0) }; localStorage.setItem(BEST_KEY, JSON.stringify(all)); } catch (e) {} };
  const LEVELS = [
    { key: 'easy', label: 'Easy', need: .67, window: .3, mult: 1 },
    { key: 'normal', label: 'Normal', need: .74, window: .22, mult: 1.5 },
    { key: 'hard', label: 'Hard', need: .78, window: .18, mult: 2 }];
  const ARROWS = ['←', '↑', '→', '↓'], KEYS = { arrowleft: 0, a: 0, arrowup: 1, w: 1, arrowright: 2, d: 2, arrowdown: 3, s: 3 };
  const COLORS = ['#ff6b8a', '#6bd0ff', '#ffd25e', '#8cff7a'];
  // note names: 'C4', 'F#3', 'A#5' -> Hz
  const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const hz = n => { const m = /^([A-G])(#|b)?(-?\d)$/.exec(n); if (!m) return 0; const s = SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (+m[3] + 1) * 12; return 440 * Math.pow(2, (s - 69) / 12); };

  // ── the band: each voice plays one note at time t on the audio clock into dest ──
  function voices(ac) {
    let noiseBuf = null;
    const noiseSrc = () => { if (!noiseBuf) { noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true; return s; };
    const env = (dest, t, g, a, dur) => { const e = ac.createGain(); e.connect(dest); e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(g, t + a); e.gain.exponentialRampToValueAtTime(.0005, t + dur); return e; };
    const osc = (type, f, t, dur, to) => { const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + Math.min(dur, .2)); o.start(t); o.stop(t + dur + .05); return o; };
    const noise = (dest, t, dur, g, type, f, q = .8) => { const s = noiseSrc(), fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; s.connect(fl).connect(env(dest, t, g, .003, dur)); s.start(t, Math.random() * .5); s.stop(t + dur + .05); };
    const partials = (dest, f, t, dur, g, list) => { for (const [k, pg, pd] of list) osc('sine', f * k, t, dur * pd).connect(env(dest, t, g * pg, .006, dur * pd)); };
    return {
      kick: (d, t, v) => { osc('sine', 150, t, .35, 42).connect(env(d, t, .95 * v, .004, .32)); noise(d, t, .03, .2 * v, 'lowpass', 900); },
      snare: (d, t, v) => { noise(d, t, .18, .42 * v, 'bandpass', 1900, .7); osc('triangle', 190, t, .1).connect(env(d, t, .25 * v, .003, .09)); },
      rim: (d, t, v) => { noise(d, t, .04, .35 * v, 'bandpass', 2600, 2); osc('square', 820, t, .03).connect(env(d, t, .08 * v, .002, .03)); },
      hat: (d, t, v) => noise(d, t, .045, .16 * v, 'highpass', 7200),
      shaker: (d, t, v) => noise(d, t, .035, .1 * v, 'highpass', 5200),
      clap: (d, t, v) => { for (const k of [0, .011, .022]) noise(d, t + k, .06, .3 * v, 'bandpass', 1500, 1.2); },
      taiko: (d, t, v) => { osc('sine', 98, t, .7, 52).connect(env(d, t, .95 * v, .004, .65)); noise(d, t, .16, .35 * v, 'lowpass', 320); },
      odaiko: (d, t, v) => { osc('sine', 72, t, 1.1, 40).connect(env(d, t, 1 * v, .006, 1.05)); noise(d, t, .3, .38 * v, 'lowpass', 220); },
      shime: (d, t, v) => { osc('sine', 360, t, .14, 280).connect(env(d, t, .5 * v, .002, .13)); noise(d, t, .05, .28 * v, 'bandpass', 2800, 1.4); },
      tom: (d, t, v) => { osc('sine', 150, t, .35, 95).connect(env(d, t, .8 * v, .003, .3)); noise(d, t, .07, .2 * v, 'lowpass', 600); },
      hand: (d, t, v) => { osc('sine', 210, t, .18, 160).connect(env(d, t, .55 * v, .002, .16)); noise(d, t, .05, .22 * v, 'bandpass', 1400, 1); },
      wood: (d, t, v) => { osc('sine', 920, t, .06).connect(env(d, t, .4 * v, .001, .06)); noise(d, t, .02, .2 * v, 'bandpass', 1900, 3); },
      stomp: (d, t, v) => { osc('sine', 62, t, .25, 44).connect(env(d, t, .9 * v, .004, .22)); noise(d, t, .09, .35 * v, 'lowpass', 400); },
      gong: (d, t, v) => partials(d, 110, t, 3.2, .3 * v, [[1, 1, 1], [1.48, .55, .8], [2.11, .35, .55], [2.74, .2, .4], [3.6, .1, .3]]),
      whoosh: (d, t, v) => { const s = noiseSrc(), fl = ac.createBiquadFilter(); fl.type = 'bandpass'; fl.Q.value = 1.4; fl.frequency.setValueAtTime(600, t); fl.frequency.exponentialRampToValueAtTime(3600, t + .28); s.connect(fl).connect(env(d, t, .22 * v, .08, .34)); s.start(t); s.stop(t + .4); },
      // pitched voices: f = Hz (or several for a chord), len = the note's length in seconds
      bass: (d, t, v, f, len) => { const l = Math.min(len, .5); osc('sine', f, t, l).connect(env(d, t, .55 * v, .006, l)); const sq = osc('square', f, t, l), lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; sq.connect(lp).connect(env(d, t, .12 * v, .006, l * .8)); },
      slap: (d, t, v, f, len) => { const l = Math.min(len, .32), sw = osc('sawtooth', f, t, l), lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(2600, t); lp.frequency.exponentialRampToValueAtTime(380, t + .12); sw.connect(lp).connect(env(d, t, .3 * v, .003, l)); osc('sine', f, t, l).connect(env(d, t, .35 * v, .003, l)); },
      pluck: (d, t, v, f, len) => { const l = Math.max(.5, Math.min(1.4, len * 2)); osc('triangle', f * 1.01, t, l, f).connect(env(d, t, .3 * v, .003, l)); osc('sine', f * 2, t, l * .5).connect(env(d, t, .08 * v, .003, l * .45)); },
      koto: (d, t, v, f, len) => { const l = Math.max(.7, Math.min(1.8, len * 2.5)); osc('triangle', f * 1.02, t, l, f).connect(env(d, t, .28 * v, .002, l)); osc('sine', f * 3, t, l * .3).connect(env(d, t, .06 * v, .002, l * .3)); noise(d, t, .02, .08 * v, 'bandpass', f * 4, 3); },
      flute: (d, t, v, f, len) => { const l = Math.max(.25, len * .95), o = ac.createOscillator(), lfo = ac.createOscillator(), lg = ac.createGain(); o.type = 'sine'; o.frequency.value = f; lfo.frequency.value = 5.2; lg.gain.value = f * .006;
        lfo.connect(lg).connect(o.frequency); const e = ac.createGain(); e.connect(d); e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(.22 * v, t + .06); e.gain.setValueAtTime(.2 * v, t + l * .7); e.gain.exponentialRampToValueAtTime(.0005, t + l + .12);
        o.connect(e); o.start(t); lfo.start(t); o.stop(t + l + .2); lfo.stop(t + l + .2); noise(d, t, Math.min(.18, l), .04 * v, 'bandpass', f * 2, 2); },
      pan: (d, t, v, f, len) => partials(d, f, t, Math.max(.6, Math.min(1.1, len * 2)), .2 * v, [[1, 1, 1], [2, .5, .55], [3.01, .22, .3], [4.2, .06, .15]]),
      bell: (d, t, v, f) => partials(d, f, t, 1.8, .2 * v, [[1, 1, 1], [2.76, .35, .55], [5.4, .15, .3]]),
      chime: (d, t, v, f) => partials(d, f, t, 2.4, .12 * v, [[1, 1, 1], [2.76, .25, .5], [5.4, .1, .3], [8.9, .04, .2]]),
      brass: (d, t, v, f, len) => { const l = Math.max(.2, len * .9), sw = osc('sawtooth', f, t, l), lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1.5; lp.frequency.setValueAtTime(500, t); lp.frequency.linearRampToValueAtTime(2400, t + .06); lp.frequency.exponentialRampToValueAtTime(900, t + l);
        sw.connect(lp).connect(env(d, t, .17 * v, .02, l + .05)); },
      accordion: (d, t, v, f, len) => { const l = Math.max(.2, len * .95); for (const k of [1, 1.004]) { const sq = osc('square', f * k, t, l), lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1700; sq.connect(lp).connect(env(d, t, .055 * v, .02, l + .05)); } },
      organ: (d, t, v, f, len) => { const l = Math.max(.3, len * .98); for (const [k, g] of [[1, .07], [2, .035], [3, .018]]) osc(k === 1 ? 'square' : 'sine', f * k, t, l).connect(env(d, t, g * v, .02, l + .08)); },
      theremin: (d, t, v, f, len) => { const l = Math.max(.3, len), o = ac.createOscillator(), lfo = ac.createOscillator(), lg = ac.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(f * .94, t); o.frequency.exponentialRampToValueAtTime(f, t + .12);
        lfo.frequency.value = 6.5; lg.gain.value = f * .012; lfo.connect(lg).connect(o.frequency); const e = env(d, t, .16 * v, .08, l + .2); o.connect(e); o.start(t); lfo.start(t); o.stop(t + l + .3); lfo.stop(t + l + .3); },
      pad: (d, t, v, f, len) => { const l = Math.max(.5, len); for (const k of [1, 1.006, .5]) { const sw = osc('sawtooth', f * k, t, l + .4), lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; const e = ac.createGain(); e.connect(d); e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(.035 * v, t + .35); e.gain.setValueAtTime(.035 * v, t + l); e.gain.linearRampToValueAtTime(0, t + l + .4); sw.connect(lp).connect(e); } },
      lead: (d, t, v, f, len) => { const l = Math.max(.15, len * .9), sq = osc('square', f, t, l), lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200; sq.connect(lp).connect(env(d, t, .07 * v, .01, l + .04)); }
    };
  }

  // ── the songs: 16 bars; drum parts are bars of 16 steps ('X' accent, 'x' hit), pitched parts bars of 8 eighths (a note,
  // '.' rest, '-' held, chords as 'A3+C4+E4'); each part's bars repeat in order. from / to: the bars it plays (0-based).
  // The first two bars are the count-in (drums only, no arrows); the arrows follow the beats of the rest. ──
  const SONGS = {
    hub: { title: 'Rebel Groove', bpm: 92, swing: .12, parts: [
      { i: 'kick', p: ['X.....x...X.....', 'X.....x...x..x..'] }, { i: 'snare', p: ['....X.......X...'], from: 1 }, { i: 'hat', p: ['x.x.x.x.x.x.x.x.'] },
      { i: 'bass', m: ['C2 - - C2 - - D#2 -', 'F2 - - F2 - D#2 - -'], from: 2 },
      { i: 'pluck', m: ['C5 . D#5 . G5 . F5 D#5', 'C5 . . . A#4 . C5 .', 'C5 . D#5 . G5 . A#5 G5', 'F5 . D#5 . C5 . . .'], from: 4 }] },
    ashigaru: { title: 'Rice Planting Song', bpm: 100, parts: [
      { i: 'taiko', p: ['X.......x.......', 'X.......x...x...'] }, { i: 'shime', p: ['..x...x...x...x.'] }, { i: 'clap', p: ['....x.......x...'], from: 2 },
      { i: 'flute', m: ['D5 - E5 G5 A5 - G5 E5', 'D5 - - - E5 - D5 B4', 'A4 - B4 D5 E5 - G5 A5', 'G5 E5 D5 - - - . .'], from: 2 }, { i: 'bass', m: ['D2 - - - A2 - - -', 'G2 - - - D2 - - -'], from: 2 }] },
    buke: { title: 'Trident March', bpm: 112, parts: [
      { i: 'kick', p: ['X.......X.......'] }, { i: 'snare', p: ['....X.......X..x', '....X.......X.xx', '....X.......X..x', '....X.......xxxx'] },
      { i: 'brass', m: ['C4 - - G3 C4 - E4 -', 'G4 - - E4 C4 - - -', 'F4 - - A4 G4 - E4 -', 'D4 - G3 - C4 - - -'], from: 2 },
      { i: 'bass', m: ['C2 - G2 - C2 - G2 -', 'C2 - G2 - C2 - G2 -', 'F2 - C3 - F2 - C3 -', 'G2 - D3 - G2 - B2 -'], from: 2 }, { i: 'bell', m: ['C6 . . . . . . .', '. . . . . . . .'], from: 4 }] },
    bushi: { title: 'War Fan Dance', bpm: 96, parts: [
      { i: 'taiko', p: ['X.....x.X.......', 'X.....x.X...x...'] }, { i: 'wood', p: ['..x...x...x...x.'] }, { i: 'whoosh', p: ['X...............', '........X.......'], from: 2 },
      { i: 'koto', m: ['E4 A4 B4 E5 B4 A4 F4 A4', 'E4 A4 C5 E5 C5 A4 F4 E4', 'B3 E4 F4 B4 A4 F4 E4 F4', 'E4 - - - B3 - - -'], from: 2 }, { i: 'bass', m: ['A1 - - - - - - -', 'F1 - - - E1 - - -'], from: 2 }] },
    chumpz: { title: 'Calypso Cove', bpm: 120, parts: [
      { i: 'kick', p: ['X...X...X...X...'] }, { i: 'shaker', p: ['xxxxxxxxxxxxxxxx'] }, { i: 'rim', p: ['....x.......x..x'], from: 2 },
      { i: 'pan', m: ['E5 . G5 E5 . C5 D5 E5', 'F5 . A5 F5 . D5 E5 F5', 'G5 G5 A5 G5 F5 E5 D5 C5', 'D5 . . B4 C5 . . .'], from: 2 },
      { i: 'bass', m: ['C3 . G2 . C3 . G2 .', 'F2 . C3 . F2 . C3 .', 'G2 . D3 . G2 . D3 .', 'G2 . . . C3 . . .'], from: 2 }] },
    'cute-creepy': { title: 'Monster Mash', bpm: 108, parts: [
      { i: 'kick', p: ['X.......X.......'] }, { i: 'snare', p: ['....X.......X...'], from: 1 }, { i: 'hat', p: ['..x...x...x...x.'] },
      { i: 'organ', m: ['A3+C4+E4 - - - - - - -', 'F3+A3+C4 - - - - - - -', 'D3+F3+A3 - - - - - - -', 'E3+G#3+B3 - - - - - - -'], from: 2 },
      { i: 'theremin', m: ['A4 - - C5 - B4 - A4', 'F4 - - - E4 - - -', 'D4 - F4 - A4 - G#4 -', 'E4 - - - - - - -'], from: 4 },
      { i: 'bass', m: ['A2 . A2 . E2 . E2 .', 'F2 . F2 . C3 . C3 .', 'D2 . D2 . A2 . A2 .', 'E2 . E2 . G#2 . B2 .'], from: 2 }] },
    kenshi: { title: 'Blade Kata', bpm: 84, parts: [
      { i: 'taiko', p: ['X...............', 'X.......x.......'] }, { i: 'wood', p: ['....x.......x...', '....x.......x.x.'] }, { i: 'whoosh', p: ['........X.......'], from: 4 },
      { i: 'flute', m: ['E4 - - - G4 - A4 -', 'B4 - - - A4 - - -', 'G4 - E4 - D4 - E4 -', '- - - - - - - -'], from: 2 }, { i: 'pad', m: ['E2+B2 - - - - - - -'], from: 2 }] },
    samurai: { title: 'Taiko Thunder', bpm: 120, parts: [
      { i: 'taiko', p: ['X..xX...X..xX...', 'X..xX...X.x.X.xx'] }, { i: 'shime', p: ['x.x.x.x.x.x.x.x.'], from: 1 }, { i: 'gong', p: ['X...............', '................', '................', '................'], from: 2 },
      { i: 'flute', m: ['D5 - - E5 G5 - E5 -', 'D5 - B4 - A4 - - -', 'D5 - - E5 G5 - A5 -', 'B5 - A5 G5 E5 - - -'], from: 4 }, { i: 'bass', m: ['D2 - - - - - A1 -', 'G1 - - - A1 - - -'], from: 2 }] },
    shogun: { title: 'Court Fan Dance', bpm: 90, parts: [
      { i: 'shime', p: ['x...x...x..xx...'] }, { i: 'gong', p: ['X...............', '................', '................', '................'] }, { i: 'taiko', p: ['X.........x.....'], from: 2 },
      { i: 'koto', m: ['D4 A4 D5 - F5 E5 D5 A4', 'C4 G4 C5 - E5 D5 C5 G4', 'A#3 F4 A#4 - D5 C5 A#4 F4', 'A3 E4 A4 - C#5 - - -'], from: 2 }, { i: 'bass', m: ['D2 - - - - - - -', 'C2 - - - - - - -', 'A#1 - - - - - - -', 'A1 - - - - - - -'], from: 2 }] },
    sohei: { title: 'Temple Drum', bpm: 100, parts: [
      { i: 'odaiko', p: ['X.......X...x...'] }, { i: 'shime', p: ['....x..x....x..x'], from: 1 }, { i: 'bell', m: ['G5 . . . . . . .', '. . . . . . . .'] },
      { i: 'flute', m: ['G4 - A4 - B4 - D5 -', 'B4 - A4 - G4 - - -', 'E4 - G4 - A4 - B4 -', 'A4 - - - G4 - - -'], from: 4 }, { i: 'pad', m: ['G2+D3 - - - - - - -'], from: 2 }] },
    warrior: { title: 'War Dance', bpm: 132, parts: [
      { i: 'kick', p: ['X...X...X...X...'] }, { i: 'tom', p: ['X.x.X.x.X.x.XxXx'], from: 1 }, { i: 'stomp', p: ['....X.......X...'], from: 2 },
      { i: 'brass', m: ['D3 - - - - - - -', 'F3 - - - E3 - - -', 'D3 - - - - - - -', 'A2 - - - C3 - D3 -'], from: 2 }, { i: 'bass', m: ['D2 . D2 . D2 . F2 .', 'D2 . D2 . C2 . A1 .'], from: 2 }] },
    wokou: { title: 'Sea Shanty', bpm: 110, parts: [
      { i: 'stomp', p: ['X.......X.......'] }, { i: 'clap', p: ['....X.......X...'], from: 1 },
      { i: 'accordion', m: ['D4 . F#4 A4 D5 . A4 F#4', 'G4 . B4 D5 G5 . D5 B4', 'A4 . C#5 E5 A5 . E5 C#5', 'D5 . . A4 D5 . . .'], from: 2 },
      { i: 'bass', m: ['D2 . A2 . D2 . A2 .', 'G2 . D3 . G2 . D3 .', 'A2 . E3 . A2 . E3 .', 'D2 . A2 . D2 . . .'], from: 2 }] },
    yamabushi: { title: 'Spirit Dance', bpm: 88, parts: [
      { i: 'hand', p: ['X..x..X...x..x..'] }, { i: 'chime', m: ['E6 . . . B5 . . .', 'G6 . . . E6 . . .', 'A5 . . . E6 . . .', 'B5 . . . . . . .'] },
      { i: 'flute', m: ['E5 - G5 - A5 - B5 -', 'D6 - B5 - A5 - - -', 'G5 - A5 - E5 - D5 -', 'E5 - - - - - - -'], from: 2 }, { i: 'pad', m: ['E2+B2 - - - - - - -'], from: 2 }] },
    'saints-la': { title: 'Lowrider Funk', bpm: 96, swing: .1, parts: [
      { i: 'kick', p: ['X.....x...X.....', 'X.....x...x..x..'] }, { i: 'snare', p: ['....X.......X...'], from: 1 }, { i: 'hat', p: ['x.xxx.xxx.xxx.xx'] },
      { i: 'slap', m: ['C2 . C3 . A#2 . G2 .', 'F2 . F2 C3 . D#2 . F2'], from: 2 },
      { i: 'brass', m: ['. . . E5 . . G5 .', '. . A5 . G5 . . .'], from: 4 }] }
  };

  // every note of a song on the clock: [{ t, i, f: [Hz..], len, v }]
  function score(song, t0) {
    const beat = 60 / song.bpm, step = beat / 4, bars = 16, evs = [], sw = song.swing || 0;
    const at = (bar, s16) => t0 + bar * 4 * beat + s16 * step + ((s16 % 2) ? sw * step : 0);
    for (const part of song.parts) {
      const from = part.from || 0, to = part.to ?? bars - 1;
      for (let bar = from; bar < Math.min(to + 1, bars - 1); bar++) {
        if (part.p) { const pat = part.p[(bar - from) % part.p.length]; for (let k = 0; k < 16; k++) if (pat[k] === 'X' || pat[k] === 'x') evs.push({ t: at(bar, k), i: part.i, v: pat[k] === 'X' ? 1 : .7 }); }
        else { const toks = part.m[(bar - from) % part.m.length].split(' ');
          for (let k = 0; k < 8; k++) { const tk = toks[k]; if (!tk || tk === '.' || tk === '-') continue; let n = 1; while (k + n < 8 && toks[k + n] === '-') n++;
            evs.push({ t: at(bar, k * 2), i: part.i, f: tk.split('+').map(hz), len: n * 2 * step, v: 1 }); } }
      }
    }
    // the last bar: one big hit on its first beat
    evs.push({ t: at(bars - 1, 0), i: song.parts.some(p => p.i === 'gong') ? 'gong' : song.parts.find(p => p.p)?.i || 'kick', v: 1 });
    return evs.sort((a, b) => a.t - b.t);
  }
  // the arrows for a level: easy on beats 1 and 3, normal on the beats (a rest on beat 4 of every other bar), hard on
  // the beats and on the off-beat eighths where the melody moves (at most five arrows a bar)
  function chart(song, lv, t0) {
    const beat = 60 / song.bpm, out = [], mel = song.parts.filter(p => p.m && !/pad|organ|bass|slap/.test(p.i)).slice(-1)[0];
    for (let bar = 2; bar < 15; bar++) for (let e = 0, inBar = 0; e < 8; e++) {
      const onBeat = e % 2 === 0, b = e / 2;
      let on = false;
      if (lv === 'easy') on = e === 0 || e === 4;
      else if (lv === 'normal') on = onBeat && !(b === 3 && bar % 2);
      else { on = onBeat; if (!onBeat && mel && bar >= (mel.from || 0) && inBar < 4) { const toks = mel.m[(bar - (mel.from || 0)) % mel.m.length].split(' '); on = toks[e] && toks[e] !== '.' && toks[e] !== '-' && (e !== 7 || bar % 2 === 0); } }
      if (on) inBar++;
      if (on) out.push(t0 + bar * 4 * beat + e * beat / 2 + ((e % 2) ? (song.swing || 0) * beat / 4 : 0));
    }
    out.push(t0 + 15 * 4 * beat); // the final hit
    return out;
  }

  const G = {
    title: 'Dance-off',
    start(ctx) {
      const B = ctx.B, H = ctx.HUD, scene = ctx.scene, def = ctx.def, song = SONGS[def.song] || SONGS.hub;
      const moves = def.moves || ['cartwheel', 'jump', 'front_flip', 'backflip'];
      const floorC = def.floor || [.95, .45, .7];
      const st = { phase: 'pick', lv: null, notes: [], ev: [], evi: 0, hits: 0, perfect: 0, combo: 0, maxCombo: 0, pts: 0, t0: 0, end: 0, judge: '', judgeAt: 0, beatAt: 0, car: null, carT: 0, carMove: -1 };
      const nodes = [], keep = n => { ctx.add(n); nodes.push(n); if (n.isPickable !== undefined) n.isPickable = false; return n; };
      // the dance floor: a glowing disc and a ring that pulses on the beat
      const glow = (k, c, a) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.disableLighting = true; m.emissiveColor = new B.Color3(...c); m.alpha = a; m.alphaMode = B.Engine.ALPHA_ADD; m.backFaceCulling = false; return m; });
      const disc = keep(B.MeshBuilder.CreateDisc('dnFloor', { radius: 2.7, tessellation: 40 }, scene)); disc.rotation.x = Math.PI / 2; disc.position.y = .06; disc.material = glow('floor' + floorC.join('_'), floorC.map(v => v * .55), .5);
      const ring = keep(B.MeshBuilder.CreateTorus('dnRing', { diameter: 5.4, thickness: .12, tessellation: 48 }, scene)); ring.position.y = .08; ring.material = glow('ring', [1, .85, .45], .7);
      const ring2 = keep(B.MeshBuilder.CreateTorus('dnRing2', { diameter: 3.4, thickness: .08, tessellation: 40 }, scene)); ring2.position.y = .08; ring2.material = ring.material;
      [disc, ring, ring2].forEach(m => { m.position.y += ctx.ground(ctx.toWorld(0, 0, 0).x, ctx.toWorld(0, 0, 0).z) - ctx.toWorld(0, 0, 0).y; });
      // the lowrider (Saints): the car on the floor bounces on its hydraulics
      if (def.car) { st.car = ctx.kit(def.car === true ? 'sl_car_purple' : def.car); st.car.position.set(0, 0, 0); st.car.rotation.y = def.carYaw ?? 0; st.carBase = st.car.position.y; } // broadside to the camera (end-on its 7.6 m filled the view)
      // the player: on the floor facing the camera (beside the car for the lowrider)
      const pAt = def.playerAt || (def.car ? [-5.3, 1, .6] : [0, 0, 0]); ctx.player.place(pAt[0], pAt[1], pAt[2] || 0); // the lowrider's dancer by its nose
      const camR = def.camR || (def.car ? 9.5 : 7), camY = def.camY || (def.car ? 3 : 2.4), camT = def.camT || (def.car ? [-1, 1.1, 0] : [0, .9, 0]);
      const look = t => { const a = Math.sin(t * .25) * .38; ctx.look([Math.sin(a) * camR, camY, Math.cos(a) * camR], camT, .8); };
      look(0);
      // the lane, the pads and the level choice in the game HUD
      const hud = document.getElementById('gameHud');
      const box = document.createElement('div');
      box.style.cssText = 'position:absolute;left:50%;bottom:58px;transform:translateX(-50%);width:min(600px,94vw);pointer-events:none;font:600 14px/1.3 system-ui,sans-serif;color:#f3e6c4;text-align:center';
      box.innerHTML = `<div class="dn-judge" style="font:800 26px/1 Georgia,serif;color:#ffd877;text-shadow:0 2px 0 #000,0 0 12px rgba(255,200,90,.6);height:30px"></div>`
        + `<div class="dn-lane" style="position:relative;height:74px;margin-top:6px;border-radius:14px;background:rgba(10,13,22,.82);border:1px solid rgba(216,179,92,.55);overflow:hidden">`
        + `<div style="position:absolute;left:9%;top:50%;width:58px;height:58px;margin:-29px 0 0 -29px;border-radius:50%;border:3px solid rgba(255,233,176,.9);box-shadow:0 0 14px rgba(255,210,120,.6)"></div><div class="dn-notes"></div></div>`
        + `<div class="dn-pads" style="display:flex;justify-content:center;gap:10px;margin-top:10px;pointer-events:auto">${ARROWS.map((a, i) => `<button type="button" data-d="${i}" style="width:54px;height:46px;border-radius:10px;border:1px solid ${COLORS[i]};background:rgba(10,13,22,.85);color:${COLORS[i]};font:800 22px system-ui;cursor:pointer;touch-action:manipulation">${a}</button>`).join('')}</div>`;
      const lane = box.querySelector('.dn-notes'), judgeEl = box.querySelector('.dn-judge');
      box.querySelectorAll('.dn-pads button').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); press(+b.dataset.d); }));
      const pick = document.createElement('div');
      pick.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(420px,92vw);background:rgba(16,12,6,.95);border:1px solid rgba(240,200,80,.6);border-radius:14px;padding:16px;text-align:center;pointer-events:auto;font:15px/1.4 system-ui,sans-serif;color:#eee';
      const best = loadBest()[def.id] || {};
      pick.innerHTML = `<div style="font:800 13px/1.2 system-ui;letter-spacing:.14em;text-transform:uppercase;color:#f3c84a;margin-bottom:6px">${def.title || 'Dance-off'}</div><div style="margin-bottom:12px;color:#bbb">${song.title} · ${song.bpm} beats a minute. Press each arrow as it reaches the ring.</div>`
        + LEVELS.map((L, k) => { const n = chart(song, L.key, 0).length; return `<button type="button" data-k="${k}" style="display:block;width:100%;margin:6px 0;padding:9px;border-radius:9px;border:1px solid #f3c84a;background:rgba(255,255,255,.05);color:#fff;font:700 15px system-ui;cursor:pointer">${k + 1} · ${L.label}<div style="font:500 12px system-ui;color:#d8c89a">${Math.ceil(n * L.need)} of ${n} moves${best[L.key] ? ` · best ${best[L.key]}` : ''}</div></button>`; }).join('')
        + `<div style="margin-top:8px;font-size:12px;color:#998">Keys 1-3 pick a level</div>`;
      pick.querySelectorAll('button[data-k]').forEach(b => b.onclick = e => { e.stopPropagation(); b.blur(); begin(+b.dataset.k); });
      hud.append(pick);
      H.title(def.title || 'Dance-off'); H.score(''); H.info(song.title); H.hint('');
      let mix = null, band = null;
      function begin(k) {
        if (st.phase !== 'pick') return; pick.remove();
        mix = ctx.audio(); band = mix && voices(mix.ctx);
        const now = mix ? mix.ctx.currentTime : performance.now() / 1000;
        st.lv = LEVELS[k]; st.t0 = now + .35; st.lat = mix?.latency || 0;
        st.ev = score(song, st.t0); st.evi = 0;
        st.notes = chart(song, st.lv.key, st.t0).map((t, i, a) => { let d = Math.floor(Math.random() * 4); if (i && d === a.lastD) d = (d + 1 + Math.floor(Math.random() * 3)) % 4; a.lastD = d;
          const el = document.createElement('div'); el.textContent = ARROWS[d]; el.style.cssText = `position:absolute;top:50%;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:10px;display:flex;align-items:center;justify-content:center;font:800 26px system-ui;color:#10131a;background:${COLORS[d]};box-shadow:0 0 10px ${COLORS[d]}`;
          lane.appendChild(el); return { t, d, el, judged: false }; });
        st.need = Math.ceil(st.notes.length * st.lv.need); st.end = st.notes[st.notes.length - 1].t + 1.2;
        st.phase = 'play'; hud.append(box);
        H.info(`${song.title} · ${st.lv.label}`); H.hint('Arrow keys, <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> or the pads · press as the arrow reaches the ring');
        upd();
      }
      const clock = () => (st.fakeNow != null ? st.fakeNow : mix ? mix.ctx.currentTime : performance.now() / 1000);
      function upd() { H.score(`${st.hits} / ${st.need}`); }
      function say(t, bad) { judgeEl.textContent = t; judgeEl.style.color = bad ? '#ff8a7a' : '#ffd877'; st.judgeAt = performance.now(); }
      function dance(d) {
        if (st.car) { st.carMove = d; st.carT = 0; return; }
        ctx.player.clip(moves[d]);
      }
      function press(d) {
        if (st.phase !== 'play') return;
        const now = clock() - st.lat, win = st.lv.window;
        let bestN = null; for (const n of st.notes) if (!n.judged && Math.abs(n.t - now) <= win && (!bestN || Math.abs(n.t - now) < Math.abs(bestN.t - now))) bestN = n;
        if (!bestN) { st.combo = 0; say('Off beat', true); return; }
        bestN.judged = true;
        if (bestN.d !== d) { bestN.el.style.opacity = '.25'; st.combo = 0; say('Wrong move', true); return; }
        const dt = Math.abs(bestN.t - now), perfect = dt <= win * .36;
        st.hits++; st.combo++; st.maxCombo = Math.max(st.maxCombo, st.combo); if (perfect) st.perfect++;
        st.pts += (perfect ? 3 : 2) * (1 + Math.min(.5, Math.floor(st.combo / 10) * .1));
        bestN.el.style.transform = 'scale(1.35)'; bestN.el.style.opacity = '0'; bestN.el.style.transition = 'transform .18s, opacity .25s';
        say(perfect ? 'Perfect!' : 'Good'); dance(d); upd();
      }
      function finish() {
        st.phase = 'done'; box.remove();
        const won = st.hits >= st.need, total = Math.round(st.pts * st.lv.mult);
        saveBest(def.id, st.lv.key, st.hits);
        ctx.sound(won ? 'gamewin' : 'thock');
        H.msg(won ? `${st.lv.label} cleared!` : 'So close', 1700, `${st.hits} of ${st.notes.length} moves`);
        setTimeout(() => ctx.finish({ score: total, passed: won, kicker: won ? `${st.lv.label} cleared` : 'Not this time',
          extra: `${st.hits} of ${st.notes.length} moves (${st.need} to clear), ${st.perfect} perfect, best combo ${st.maxCombo}.${won && st.lv.key !== 'hard' ? ' Try the next level for more points.' : ''}` }), 1300);
      }
      return {
        update(dt) {
          const t = performance.now() / 1000; look(t);
          if (st.phase !== 'play') return;
          const now = clock();
          // the band, a little ahead of the clock
          while (st.evi < st.ev.length && st.ev[st.evi].t < now + .3) { const e = st.ev[st.evi++]; if (band && e.t >= now - .05) { try { (e.f || [0]).forEach(f => band[e.i]?.(mix.out, Math.max(now, e.t), e.v, f, e.len || .3)); } catch (err) {} } }
          // the arrows along the lane (about 2.6 s ahead of the ring)
          const w = box.querySelector('.dn-lane').clientWidth || 560, ringX = w * .09, pxs = w * .34, heard = now - st.lat;
          for (const n of st.notes) {
            if (!n.judged) n.el.style.left = (ringX + (n.t - heard) * pxs) + 'px';
            if (!n.judged && heard - n.t > st.lv.window) { n.judged = true; n.el.style.opacity = '.2'; st.combo = 0; say('Miss', true); }
          }
          if (performance.now() - st.judgeAt > 700) judgeEl.textContent = st.combo >= 5 ? `Combo ${st.combo}` : '';
          // the floor pulses on the beat
          const beat = 60 / song.bpm, ph = ((heard - st.t0) / beat) % 1, pulse = ph < 0 ? 0 : Math.exp(-ph * 5);
          ring.scaling.setAll(1 + .08 * pulse); ring.material.alpha = .35 + .5 * pulse; disc.material.alpha = .32 + .25 * pulse; ring2.rotation.y += dt * .8;
          // the lowrider's hop: front up, a hop, the back up, a side tilt
          if (st.car) {
            st.carT += dt; const u = Math.min(1, st.carT / .45), k = Math.sin(u * Math.PI);
            const d = st.carMove; st.car.position.y = st.carBase + (d === 1 ? 1.1 * k : .15 * k); st.car.rotation.z = d === 0 ? .32 * k : d === 2 ? -.32 * k : 0; st.car.rotation.x = d === 3 ? -.28 * k : 0;
          }
          if (now > st.end) finish();
        },
        key(e, down) { if (!down || e.repeat) return; const k = e.key.toLowerCase();
          if (st.phase === 'pick') { const n = parseInt(k, 10); if (n >= 1 && n <= 3) begin(n - 1); return; }
          if (KEYS[k] !== undefined) press(KEYS[k]); },
        _test: { st, begin, press, now: v => { st.fakeNow = v; }, chart: lv => chart(song, lv, 0), score: () => score(song, 0), song },
        dispose() { pick.remove(); box.remove(); if (mix) { try { mix.out.gain.setTargetAtTime(0, mix.ctx.currentTime, .08); const o = mix.out; setTimeout(() => { try { o.disconnect(); } catch (e) {} }, 600); } catch (e) {} } nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); }
      };
    }
  };
  window.RebelGames.register('dance', G);
  // tests: every song's notes have a voice, and the arrows per level
  window.RebelGames.danceCheck = () => { const ac = new (window.AudioContext || window.webkitAudioContext)(), v = voices(ac), out = {};
    for (const [id, s] of Object.entries(SONGS)) { const ev = score(s, 0), bad = [...new Set(ev.filter(e => typeof v[e.i] !== 'function').map(e => e.i))];
      out[id] = { ev: ev.length, bad, len: +(16 * 4 * 60 / s.bpm).toFixed(1), arrows: LEVELS.map(L => chart(s, L.key, 0).length).join('/') }; }
    try { ac.close(); } catch (e) {} return out; };
})();
