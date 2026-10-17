// Dance-off (Oct 15; ten songs a village, Oct 17): every village has ten songs of its own, from normal to hard, each a
// real groove (boom bap, jazz hop, lo-fi, G-funk, funk, dembow, moombahton, afrobeats, amapiano, soca, calypso, house,
// deep / piano / tech / afro house, nu-disco) played by a little Web Audio band with the village's own sound on top
// (koto, shamisen, shakuhachi, flute and taiko in the Japanese villages, steel pan in Chumpz Cove, the G-funk whine and
// slap bass in Saints, organ, theremin and music box in Cute & Creepy, accordion and fiddle in Wokou, the Rebel Groove
// theme in the Hub). Arrows run along the lane to the ring in time with the music, each on a hit you can hear (a kick,
// a snare or clap, a drum, a note of the hook, the riff or the bass): press the same arrow (arrow keys, W A S D or the
// pads) as each one reaches it. A good press makes your Rebel dance (cartwheels, flips, kicks, the village's own move
// set) and builds a combo. Land enough moves to clear the song; a cleared song opens the next, harder songs score more.
// def: { song: <village id in SONGS>, moves: [left, up, right, down] clip names, floor: [r, g, b], pass, points,
// car: true | kit type (Saints Lowrider Hop: the moves bounce the lowrider on its hydraulics instead), carYaw,
//   camR / camY / camT [x, y, z] (the camera: distance, height, look-at), playerAt [x, z, yaw] }
(function () {
  const BEST_KEY = 'rebelAntsDanceBest:v1';
  const loadBest = () => { try { return JSON.parse(localStorage.getItem(BEST_KEY) || '{}') || {}; } catch (e) { return {}; } };
  const saveBest = (id, lv, n) => { try { const all = loadBest(); all[id] = { ...(all[id] || {}), [lv]: Math.max(n, all[id]?.[lv] || 0) }; localStorage.setItem(BEST_KEY, JSON.stringify(all)); } catch (e) {} };
  // the ten songs ramp from normal to hard: the timing window narrows (±0.24 s on song 1 to ±0.15 s on song 10, a
  // perfect is its inner 36 %), more moves must land (65 % to 78 %), the score counts more (x1 to x2); per: the arrows
  // a bar may carry by its place in its 4-bar phrase; e8: off-beat eighths carry arrows; s16: sixteenth-step arrows per
  // 4 bars (songs 9 and 10 only); sync: how strongly off-beats win over weak beats
  const TIERS = Array.from({ length: 10 }, (_, k) => ({ key: 's' + (k + 1), label: `Song ${k + 1}`, window: +(.24 - .01 * k).toFixed(2), need: +(.65 + .13 * k / 9).toFixed(3), mult: +(1 + k / 9).toFixed(2),
    per: [[4, 3, 4, 3], [4, 4, 4, 3], [5, 4, 5, 3], [5, 4, 5, 4], [5, 5, 5, 4], [6, 5, 6, 4], [6, 5, 6, 5], [6, 6, 6, 5], [7, 6, 7, 5], [7, 6, 7, 6]][k],
    e8: k >= 2, s16: k === 8 ? 1 : k === 9 ? 2 : 0, sync: [0, 0, 0, 1, 1, 2, 2, 3, 3, 3][k] }));
  const ARROWS = ['←', '↑', '→', '↓'], KEYS = { arrowleft: 0, a: 0, arrowup: 1, w: 1, arrowright: 2, d: 2, arrowdown: 3, s: 3 };
  const COLORS = ['#ff6b8a', '#6bd0ff', '#ffd25e', '#8cff7a'];

  // ── the band: each voice plays one note at time t on the audio clock into dest (v velocity, f Hz, len seconds; e the
  // score event: e.gl = the pitch a sliding voice glides in from) ──
  function voices(ac) {
    let noiseBuf = null, open = null;
    const noiseSrc = () => { if (!noiseBuf) { noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true; return s; };
    // a hit: 0 -> g in a seconds, then an exponential fall to silence at t + dur
    const env = (dest, t, g, a, dur) => { const e = ac.createGain(); e.connect(dest); e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(g, t + a); e.gain.exponentialRampToValueAtTime(.0005, t + Math.max(dur, a + .01)); return e; };
    // a held note: 0 -> g in a, falls to s x g over dec, holds to the note's end (t + len), then dies away in r
    const hold = (dest, t, g, a, dec, s, len, r) => { const e = ac.createGain(), p = e.gain, end = t + Math.max(len, a + .02), lo = Math.max(g * s, .0006); e.connect(dest);
      p.setValueAtTime(0, t); p.linearRampToValueAtTime(g, t + a); p.exponentialRampToValueAtTime(lo, Math.min(end, t + a + dec)); p.setValueAtTime(lo, end); p.exponentialRampToValueAtTime(.0005, end + r); return e; };
    const osc = (type, f, t, dur, to, tt) => { const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + (tt || Math.min(dur, .2))); o.start(t); o.stop(t + dur + .05); return o; };
    const noise = (dest, t, dur, g, type, f, q = .8, a = .003) => { const s = noiseSrc(), fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; s.connect(fl).connect(env(dest, t, g, a, dur)); s.start(t, Math.random() * .5); s.stop(t + dur + .05); };
    const bq = (type, f, q = .7) => { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
    const partials = (dest, f, t, dur, g, list) => { for (const [k, pg, pd] of list) osc('sine', f * k, t, dur * pd).connect(env(dest, t, g * pg, .004, dur * pd)); };
    // a sung pitch: glides in from e.gl (portamento) and, given a depth, gets a vibrato that fades in
    const sing = (type, f, t, l, e, gt, rate, depth) => { const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(e?.gl || f, t); if (e?.gl) o.frequency.exponentialRampToValueAtTime(f, t + gt);
      if (depth) { const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = rate; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * depth, t + Math.min(.4, l * .8)); lfo.connect(lg).connect(o.frequency); lfo.start(t); lfo.stop(t + l + .3); }
      o.start(t); o.stop(t + l + .3); return o; };
    const kick = (d, t, v, f0, f1, dec, g, click) => { const o = ac.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + .055); o.frequency.exponentialRampToValueAtTime(f1 * .82, t + dec);
      o.connect(env(d, t, g * v, .002, dec)); o.start(t); o.stop(t + dec + .05); noise(d, t, .014, click * v, 'lowpass', 3800, .5, .001); };
    return {
      // drums
      kick: (d, t, v) => kick(d, t, v, 165, 54, .42, 1, .32),           // round and long (hip hop)
      kickh: (d, t, v) => kick(d, t, v, 150, 50, .3, 1, .4),            // tight with a click (four on the floor)
      kickl: (d, t, v) => kick(d, t, v, 118, 50, .36, .85, .1),         // soft (lo-fi)
      snare: (d, t, v) => { noise(d, t, .19, .4 * v, 'highpass', 1500, .7); noise(d, t, .07, .26 * v, 'bandpass', 4200, .8); osc('triangle', 196, t, .12, 165).connect(env(d, t, .4 * v, .002, .11)); osc('sine', 340, t, .05).connect(env(d, t, .13 * v, .001, .05)); },
      snareb: (d, t, v) => { noise(d, t, .26, .4 * v, 'bandpass', 2300, .5); noise(d, t, .09, .22 * v, 'highpass', 5200, .7); osc('triangle', 178, t, .15, 148).connect(env(d, t, .5 * v, .002, .14)); },   // boom bap: fat, a dark tail
      snarel: (d, t, v) => { noise(d, t, .16, .3 * v, 'bandpass', 1700, .6); osc('triangle', 168, t, .1, 150).connect(env(d, t, .34 * v, .002, .09)); },  // lo-fi: soft and dull
      clap: (d, t, v) => { for (const k of [0, .009, .018]) noise(d, t + k, .028, .34 * v, 'bandpass', 1350, 1.1, .001); noise(d, t + .027, .2, .3 * v, 'bandpass', 1250, .9, .001); },
      snap: (d, t, v) => { noise(d, t, .05, .38 * v, 'bandpass', 2600, 2.2, .001); osc('sine', 1850, t, .02).connect(env(d, t, .08 * v, .001, .02)); },
      rim: (d, t, v) => { noise(d, t, .04, .35 * v, 'bandpass', 2600, 2); osc('square', 820, t, .03).connect(env(d, t, .08 * v, .002, .03)); },
      // a closed hat chokes the open hat ringing before it
      hat: (d, t, v) => { if (open && t > open.t) { open.g.gain.setTargetAtTime(0, t, .012); open = null; } noise(d, t, .045, .17 * v, 'highpass', 7600, .7, .001); },
      ohat: (d, t, v) => { const c = ac.createGain(); c.connect(d); open = { g: c, t }; noise(c, t, .32, .15 * v, 'highpass', 6200, .6, .002); },
      shaker: (d, t, v) => noise(d, t, .055, .11 * v, 'bandpass', 6800, .8, .008),
      tamb: (d, t, v) => { noise(d, t, .09, .13 * v, 'highpass', 7000, .9, .002); noise(d, t, .05, .09 * v, 'bandpass', 10000, 2, .001); },
      ride: (d, t, v) => { partials(d, 3100, t, .9, .04 * v, [[1, 1, 1], [1.43, .6, .7], [2.02, .4, .5]]); noise(d, t, .25, .05 * v, 'highpass', 8000, .6); },
      crash: (d, t, v) => { noise(d, t, 1.8, .2 * v, 'highpass', 4800, .5, .002); noise(d, t, .4, .13 * v, 'bandpass', 7800, 1.2, .001); },
      conga: (d, t, v) => { osc('sine', 340, t, .22, 305, .04).connect(env(d, t, .5 * v, .002, .2)); noise(d, t, .03, .17 * v, 'bandpass', 2200, 1.2, .001); },
      congalo: (d, t, v) => { osc('sine', 228, t, .28, 205, .05).connect(env(d, t, .55 * v, .002, .26)); noise(d, t, .03, .13 * v, 'bandpass', 1500, 1.2, .001); },
      bongo: (d, t, v) => { osc('sine', 520, t, .12, 482, .03).connect(env(d, t, .38 * v, .001, .11)); noise(d, t, .02, .12 * v, 'bandpass', 3000, 1.5, .001); },
      cowbell: (d, t, v) => { const b = bq('bandpass', 2400, 1.1); b.connect(env(d, t, .26 * v, .001, .22)); osc('square', 562, t, .22).connect(b); osc('square', 845, t, .22).connect(b); },
      iron: (d, t, v) => { partials(d, 1900, t, .25, .07 * v, [[1, 1, 1], [1.53, .7, .6], [2.31, .5, .4]]); noise(d, t, .04, .08 * v, 'bandpass', 5500, 2, .001); },   // soca's brake drum
      timbale: (d, t, v) => { osc('sine', 720, t, .2, 680, .03).connect(env(d, t, .3 * v, .001, .18)); noise(d, t, .12, .12 * v, 'bandpass', 3400, 2.2, .001); },
      kane: (d, t, v) => partials(d, 1240, t, .5, .09 * v, [[1, 1, 1], [2.63, .55, .5], [4.1, .3, .3]]),   // the festival's hand gong
      tom: (d, t, v) => { osc('sine', 150, t, .35, 95).connect(env(d, t, .8 * v, .003, .3)); noise(d, t, .07, .2 * v, 'lowpass', 600); },
      tomh: (d, t, v) => { osc('sine', 230, t, .3, 152, .12).connect(env(d, t, .72 * v, .002, .26)); noise(d, t, .05, .2 * v, 'lowpass', 1300); },
      tomm: (d, t, v) => { osc('sine', 175, t, .34, 118, .14).connect(env(d, t, .76 * v, .002, .3)); noise(d, t, .05, .2 * v, 'lowpass', 1000); },
      toml: (d, t, v) => { osc('sine', 128, t, .4, 86, .16).connect(env(d, t, .8 * v, .002, .36)); noise(d, t, .06, .2 * v, 'lowpass', 800); },
      taiko: (d, t, v) => { osc('sine', 98, t, .7, 52).connect(env(d, t, .95 * v, .004, .65)); noise(d, t, .16, .35 * v, 'lowpass', 320); noise(d, t, .03, .18 * v, 'bandpass', 900, 1, .001); },
      odaiko: (d, t, v) => { osc('sine', 72, t, 1.1, 40).connect(env(d, t, 1 * v, .006, 1.05)); noise(d, t, .3, .38 * v, 'lowpass', 220); },
      shime: (d, t, v) => { osc('sine', 360, t, .14, 280).connect(env(d, t, .5 * v, .002, .13)); noise(d, t, .05, .28 * v, 'bandpass', 2800, 1.4); },
      hand: (d, t, v) => { osc('sine', 210, t, .18, 160).connect(env(d, t, .55 * v, .002, .16)); noise(d, t, .05, .22 * v, 'bandpass', 1400, 1); },
      wood: (d, t, v) => { osc('sine', 920, t, .06).connect(env(d, t, .4 * v, .001, .06)); noise(d, t, .02, .2 * v, 'bandpass', 1900, 3); },
      stomp: (d, t, v) => { osc('sine', 62, t, .25, 44).connect(env(d, t, .9 * v, .004, .22)); noise(d, t, .09, .35 * v, 'lowpass', 400); },
      gong: (d, t, v) => partials(d, 110, t, 3.2, .3 * v, [[1, 1, 1], [1.48, .55, .8], [2.11, .35, .55], [2.74, .2, .4], [3.6, .1, .3]]),
      whoosh: (d, t, v) => { const s = noiseSrc(), fl = bq('bandpass', 600, 1.4); fl.frequency.setValueAtTime(600, t); fl.frequency.exponentialRampToValueAtTime(3600, t + .28); s.connect(fl).connect(env(d, t, .22 * v, .08, .34)); s.start(t); s.stop(t + .4); },
      riser: (d, t, v, f, len) => { const s = noiseSrc(), fl = bq('bandpass', 500, 2.5), e = ac.createGain(), L = Math.max(.5, len); fl.frequency.setValueAtTime(420, t); fl.frequency.exponentialRampToValueAtTime(7200, t + L);
        e.gain.setValueAtTime(.0001, t); e.gain.exponentialRampToValueAtTime(.22 * v, t + L); e.gain.linearRampToValueAtTime(0, t + L + .03); s.connect(fl).connect(e).connect(d); s.start(t); s.stop(t + L + .06); },
      impact: (d, t, v) => { osc('sine', 82, t, 1.3, 30, 1.1).connect(env(d, t, .75 * v, .003, 1.2)); noise(d, t, .6, .2 * v, 'lowpass', 300); },
      // basses
      b808: (d, t, v, f, len, e) => { const l = Math.max(.12, len); sing('sine', f, t, l, e, .07).connect(hold(d, t, .82 * v, .004, .5, .7, l, .14)); sing('triangle', f * 2, t, l, e?.gl ? { gl: e.gl * 2 } : null, .07).connect(hold(d, t, .1 * v, .004, .3, .6, l, .1)); noise(d, t, .012, .12 * v, 'lowpass', 2600, .5, .001); },
      sub: (d, t, v, f, len) => { const l = Math.max(.1, len * .92); osc('sine', f, t, l + .1).connect(hold(d, t, .72 * v, .006, .3, .85, l, .06)); osc('triangle', f * 2, t, l + .1).connect(hold(d, t, .06 * v, .006, .3, .7, l, .05)); },
      bass: (d, t, v, f, len) => { const l = Math.min(len, .5); osc('sine', f, t, l).connect(env(d, t, .55 * v, .006, l)); const sq = osc('square', f, t, l), lp = bq('lowpass', 420); sq.connect(lp).connect(env(d, t, .12 * v, .006, l * .8)); },
      ubass: (d, t, v, f, len) => { const l = Math.min(Math.max(.2, len), 1.2), lp = bq('lowpass', 900, .8); lp.frequency.setValueAtTime(1400, t); lp.frequency.exponentialRampToValueAtTime(420, t + .25); lp.connect(hold(d, t, .5 * v, .004, .5, .45, l, .12)); osc('triangle', f, t, l + .15).connect(lp); osc('sine', f, t, l + .15).connect(lp); },
      synbass: (d, t, v, f, len, e) => { const l = Math.max(.1, len * .95), lp = bq('lowpass', 320, 5), lp2 = bq('lowpass', 1500, .7); lp.frequency.setValueAtTime(2200, t); lp.frequency.exponentialRampToValueAtTime(330, t + .16); lp.connect(lp2).connect(hold(d, t, .4 * v, .003, .2, .7, l, .06)); sing('sawtooth', f, t, l, e, .06).connect(lp); sing('sine', f, t, l, e, .06).connect(lp); },
      hbass: (d, t, v, f, len) => { const l = Math.min(Math.max(.1, len * .9), .4), lp = bq('lowpass', 500, 2); lp.frequency.setValueAtTime(1600, t); lp.frequency.exponentialRampToValueAtTime(380, t + .12); lp.connect(env(d, t, .42 * v, .003, l + .08)); osc('sawtooth', f, t, l + .1).connect(lp); osc('sine', f, t, l + .1).connect(env(d, t, .4 * v, .003, l + .06)); },
      slap: (d, t, v, f, len) => { const l = Math.min(len, .32), sw = osc('sawtooth', f, t, l), lp = bq('lowpass', 2600); lp.frequency.setValueAtTime(2600, t); lp.frequency.exponentialRampToValueAtTime(380, t + .12); sw.connect(lp).connect(env(d, t, .3 * v, .003, l)); osc('sine', f, t, l).connect(env(d, t, .35 * v, .003, l)); },
      log: (d, t, v, f, len) => { const l = Math.min(.45, Math.max(.2, len)); osc('sine', f * 1.9, t, l, f, .035).connect(env(d, t, .75 * v, .002, l)); osc('triangle', f * 3, t, .08, f * 2, .03).connect(env(d, t, .12 * v, .001, .07)); noise(d, t, .015, .12 * v, 'bandpass', 1200, 1.4, .001); },   // amapiano's log drum
      // chords
      epiano: (d, t, v, f, len) => { const l = Math.max(.25, len), c = ac.createOscillator(), m = ac.createOscillator(), mg = ac.createGain(); c.type = 'sine'; m.type = 'sine'; c.frequency.value = f; m.frequency.value = f;
        mg.gain.setValueAtTime(f * 1.4, t); mg.gain.exponentialRampToValueAtTime(f * .16, t + .6); m.connect(mg).connect(c.frequency); c.connect(hold(d, t, .15 * v, .003, 1, .3, l, .3)); c.start(t); m.start(t); c.stop(t + l + .4); m.stop(t + l + .4);
        osc('sine', f * 2, t, .25).connect(env(d, t, .03 * v, .002, .22)); },   // a sine bent by a sine (FM): the electric piano's bark fades to a round tone
      piano: (d, t, v, f, len) => { const l = Math.max(.3, Math.min(len, 1.6)), lp = bq('lowpass', 1600, .5); lp.frequency.setValueAtTime(5200, t); lp.frequency.exponentialRampToValueAtTime(1300, t + .35); lp.connect(hold(d, t, .1 * v, .002, .5, .3, l, .25)); osc('sawtooth', f, t, l + .3).connect(lp); osc('triangle', f, t, l + .3).connect(lp); osc('sine', f * 2, t, .4).connect(env(d, t, .04 * v, .002, .35)); },
      stab: (d, t, v, f, len) => { const l = Math.min(Math.max(.12, len), .5), lp = bq('lowpass', 800, 2.5); lp.frequency.setValueAtTime(3400, t); lp.frequency.exponentialRampToValueAtTime(600, t + .18); lp.connect(env(d, t, .085 * v, .003, l + .1)); for (const k of [.994, 1.006]) osc('sawtooth', f * k, t, l + .12).connect(lp); },
      organ: (d, t, v, f, len) => { const l = Math.max(.25, len * .98); for (const [k, g] of [[1, .055], [2, .035], [3, .022], [4, .01]]) osc('sine', f * k, t, l + .1).connect(hold(d, t, g * v, .012, .2, .9, l, .06)); osc('sine', f * 3, t, .2).connect(env(d, t, .025 * v, .002, .18)); },
      pad: (d, t, v, f, len) => { const l = Math.max(.5, len); for (const k of [1, 1.006, .5]) { const sw = osc('sawtooth', f * k, t, l + .4), lp = bq('lowpass', 700); const e = ac.createGain(); e.connect(d); e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(.035 * v, t + .35); e.gain.setValueAtTime(.035 * v, t + l); e.gain.linearRampToValueAtTime(0, t + l + .4); sw.connect(lp).connect(e); } },
      strings: (d, t, v, f, len) => { const l = Math.max(.4, len), lp = bq('lowpass', 2200, .6); lp.connect(hold(d, t, .045 * v, .18, .4, .85, l, .45)); for (const k of [.996, 1.004]) osc('sawtooth', f * k, t, l + .55).connect(lp); },
      choir: (d, t, v, f, len) => { const l = Math.max(.5, len), out = hold(d, t, .07 * v, .25, .5, .9, l, .5), f1 = bq('bandpass', 720, 4), f2 = bq('bandpass', 1180, 5); f1.connect(out); f2.connect(out); for (const k of [.997, 1.003]) { const o = osc('sawtooth', f * k, t, l + .6); o.connect(f1); o.connect(f2); } },
      sho: (d, t, v, f, len) => { const l = Math.max(.5, len); osc('sine', f, t, l + .5).connect(hold(d, t, .05 * v, .35, .5, .9, l, .4)); osc('triangle', f * 2.002, t, l + .5).connect(hold(d, t, .02 * v, .4, .5, .9, l, .4)); },   // the court's mouth organ
      guitar: (d, t, v, f, len) => { const l = Math.min(.35, Math.max(.12, len)), bp = bq('bandpass', f * 3, .8); bp.connect(env(d, t, .3 * v, .002, l)); osc('sawtooth', f, t, l).connect(bp); osc('triangle', f, t, l).connect(env(d, t, .08 * v, .002, l * .8)); },
      clav: (d, t, v, f, len) => { const l = Math.min(.3, Math.max(.08, len * .8)), hp = bq('highpass', 400, .7), pk = bq('peaking', f * 4, 2); pk.gain.value = 8; hp.connect(pk).connect(env(d, t, .14 * v, .001, l)); osc('square', f, t, l).connect(hp); osc('sawtooth', f * 2.003, t, l * .6).connect(hp); },
      // leads
      pluck: (d, t, v, f, len) => { const l = Math.max(.5, Math.min(1.4, len * 2)); osc('triangle', f * 1.01, t, l, f).connect(env(d, t, .3 * v, .003, l)); osc('sine', f * 2, t, l * .5).connect(env(d, t, .08 * v, .003, l * .45)); },
      synpluck: (d, t, v, f, len) => { const l = Math.min(.6, Math.max(.2, len)), lp = bq('lowpass', 900, 3); lp.frequency.setValueAtTime(4800, t); lp.frequency.exponentialRampToValueAtTime(700, t + .14); lp.connect(env(d, t, .13 * v, .002, l + .15)); for (const k of [.996, 1.004]) osc('sawtooth', f * k, t, l + .2).connect(lp); },
      marimba: (d, t, v, f) => { osc('sine', f, t, .5).connect(env(d, t, .28 * v, .002, .45)); osc('sine', f * 4, t, .08).connect(env(d, t, .08 * v, .001, .06)); osc('sine', f * 10, t, .03).connect(env(d, t, .025 * v, .001, .02)); },
      kalimba: (d, t, v, f) => { osc('sine', f, t, .8).connect(env(d, t, .25 * v, .002, .75)); osc('sine', f * 5.95, t, .12).connect(env(d, t, .05 * v, .001, .1)); noise(d, t, .01, .05 * v, 'bandpass', f * 4, 3, .001); },
      musicbox: (d, t, v, f) => { osc('sine', f, t, 1.4).connect(env(d, t, .2 * v, .001, 1.35)); osc('sine', f * 2, t, .7).connect(env(d, t, .05 * v, .001, .6)); osc('sine', f * 4.98, t, .25).connect(env(d, t, .03 * v, .001, .2)); },
      vibes: (d, t, v, f) => { osc('sine', f, t, 1.3).connect(env(d, t, .17 * v, .002, 1.25)); osc('sine', f * 4, t, .3).connect(env(d, t, .03 * v, .001, .25)); },
      koto: (d, t, v, f, len) => { const l = Math.max(.7, Math.min(1.8, len * 2.5)); osc('triangle', f * 1.02, t, l, f).connect(env(d, t, .28 * v, .002, l)); osc('sine', f * 3, t, l * .3).connect(env(d, t, .06 * v, .002, l * .3)); noise(d, t, .02, .08 * v, 'bandpass', f * 4, 3); },
      shamisen: (d, t, v, f, len) => { const l = Math.min(.5, Math.max(.22, len)), bp = bq('bandpass', f * 2.6, 1.1), hp = bq('highpass', 1500, .7); bp.connect(env(d, t, .35 * v, .001, l)); osc('sawtooth', f * 1.012, t, l, f, .04).connect(bp);
        hp.connect(env(d, t, .1 * v, .001, .1)); osc('sawtooth', f * 1.003, t, .12).connect(hp); noise(d, t, .018, .16 * v, 'bandpass', 3200, 1.6, .001); },   // a bright buzzing pluck and the plectrum's click
      shakuhachi: (d, t, v, f, len, e) => { const l = Math.max(.2, len), sc = { gl: e?.gl || f * .965 }; sing('sine', f, t, l, sc, .09, 4.8, .009).connect(hold(d, t, .2 * v, .06, .3, .8, l, .14)); sing('triangle', f, t, l, sc, .09).connect(hold(d, t, .05 * v, .06, .3, .8, l, .12)); noise(d, t, Math.min(.25, l * .6), .05 * v, 'bandpass', f * 1.6, 1.2, .03); },   // scoops into each note, breathy
      flute: (d, t, v, f, len) => { const l = Math.max(.25, len * .95), o = ac.createOscillator(), lfo = ac.createOscillator(), lg = ac.createGain(); o.type = 'sine'; o.frequency.value = f; lfo.frequency.value = 5.2; lg.gain.value = f * .006;
        lfo.connect(lg).connect(o.frequency); const e = ac.createGain(); e.connect(d); e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(.22 * v, t + .06); e.gain.setValueAtTime(.2 * v, t + l * .7); e.gain.exponentialRampToValueAtTime(.0005, t + l + .12);
        o.connect(e); o.start(t); lfo.start(t); o.stop(t + l + .2); lfo.stop(t + l + .2); noise(d, t, Math.min(.18, l), .04 * v, 'bandpass', f * 2, 2); },
      whistle: (d, t, v, f, len, e) => { const l = Math.max(.12, len * .95); sing('sine', f, t, l, e, .055, 5.6, .007).connect(hold(d, t, .17 * v, .015, .2, .85, l, .07)); sing('triangle', f, t, l, e, .055).connect(hold(d, t, .025 * v, .015, .2, .8, l, .06)); },
      whine: (d, t, v, f, len, e) => { const l = Math.max(.12, len * .95), lp = bq('lowpass', 2400, .7); sing('sine', f, t, l, e, .09, 4.6, .011).connect(hold(d, t, .14 * v, .03, .3, .9, l, .12)); sing('sawtooth', f, t, l, e, .09, 4.6, .011).connect(lp).connect(hold(d, t, .03 * v, .03, .3, .9, l, .12)); },   // the G-funk synth lead: slides and wobbles
      supersaw: (d, t, v, f, len) => { const l = Math.max(.12, len * .92), lp = bq('lowpass', 3600, .6); lp.connect(hold(d, t, .05 * v, .004, .2, .65, l, .1)); for (const k of [.991, 1, 1.009]) osc('sawtooth', f * k, t, l + .15).connect(lp); },
      lead: (d, t, v, f, len) => { const l = Math.max(.15, len * .9), sq = osc('square', f, t, l), lp = bq('lowpass', 2200); sq.connect(lp).connect(env(d, t, .07 * v, .01, l + .04)); },
      pan: (d, t, v, f, len) => partials(d, f, t, Math.max(.6, Math.min(1.1, len * 2)), .2 * v, [[1, 1, 1], [2, .5, .55], [3.01, .22, .3], [4.2, .06, .15]]),
      bell: (d, t, v, f) => partials(d, f, t, 1.8, .2 * v, [[1, 1, 1], [2.76, .35, .55], [5.4, .15, .3]]),
      chime: (d, t, v, f) => partials(d, f, t, 2.4, .12 * v, [[1, 1, 1], [2.76, .25, .5], [5.4, .1, .3], [8.9, .04, .2]]),
      brass: (d, t, v, f, len) => { const l = Math.max(.2, len * .9), lp = bq('lowpass', 500, 1.5); lp.frequency.setValueAtTime(500, t); lp.frequency.linearRampToValueAtTime(2400, t + .06); lp.frequency.exponentialRampToValueAtTime(900, t + l);
        lp.connect(env(d, t, .14 * v, .02, l + .05)); for (const k of [.996, 1.004]) osc('sawtooth', f * k, t, l).connect(lp); },
      horn: (d, t, v, f, len) => { const l = Math.min(Math.max(.12, len * .85), .9), lp = bq('lowpass', 700, 1.2); lp.frequency.setValueAtTime(700, t); lp.frequency.linearRampToValueAtTime(2800, t + .04); lp.frequency.exponentialRampToValueAtTime(1100, t + l); lp.connect(hold(d, t, .1 * v, .02, .2, .7, l, .08)); for (const k of [.995, 1.005]) osc('sawtooth', f * k, t, l + .12).connect(lp); },
      accordion: (d, t, v, f, len) => { const l = Math.max(.2, len * .95); for (const k of [1, 1.004, .9965]) { const sq = osc('square', f * k, t, l), lp = bq('lowpass', 1700); sq.connect(lp).connect(env(d, t, .04 * v, .02, l + .05)); } },
      fiddle: (d, t, v, f, len) => { const l = Math.max(.15, len * .95), pk = bq('peaking', 900, 1), lp = bq('lowpass', 3200, .7); pk.gain.value = 5; sing('sawtooth', f, t, l, null, 0, 5.8, .006).connect(pk).connect(lp).connect(hold(d, t, .07 * v, .04, .2, .85, l, .08)); },
      theremin: (d, t, v, f, len) => { const l = Math.max(.3, len), o = ac.createOscillator(), lfo = ac.createOscillator(), lg = ac.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(f * .94, t); o.frequency.exponentialRampToValueAtTime(f, t + .12);
        lfo.frequency.value = 6.5; lg.gain.value = f * .012; lfo.connect(lg).connect(o.frequency); const e = env(d, t, .16 * v, .08, l + .2); o.connect(e); o.start(t); lfo.start(t); o.stop(t + l + .3); lfo.stop(t + l + .3); }
    };
  }

  // ── the mixing desk: every voice on a channel of its own ([level, pan, send to a small room]; the levels set each
  // voice's hit or note to a common loudness: drums by their peak, notes by their first 400 ms, so the hook sits over the
  // chords and the bass under the kick); stacked chord notes play at .3 each and spread left and right, a riff at .6
  // under the hook; a glue compressor and a limiter on the bus and a soft clip at its end, so the band never peaks past
  // 0.9; a house groove ducks its chords under each kick (the pump) ──
  const MIX = { kick: [0.89, 0, 0], kickh: [0.88, 0, 0], kickl: [1.1, 0, 0], snare: [1.07, .04, .16], snareb: [1.03, .04, .18], snarel: [1.6, .04, .2], clap: [3, -.06, .2], snap: [4.7, .1, .2], rim: [3.4, .12, .12],
    hat: [3.7, .24, .02], ohat: [2.33, .24, .05], shaker: [2.51, -.3, .04], tamb: [2.48, -.25, .05], ride: [2.47, .3, .08], crash: [1.2, -.15, .12],
    conga: [0.66, -.22, .08], congalo: [0.62, -.3, .08], bongo: [0.78, .28, .08], cowbell: [0.45, .2, .06], iron: [1.43, .18, .06], timbale: [0.97, .25, .1], kane: [1, .3, .12],
    tom: [0.7, 0, .1], tomh: [0.68, .2, .1], tomm: [0.69, 0, .1], toml: [0.72, -.2, .1], taiko: [0.4, -.05, .12], odaiko: [0.6, 0, .15], shime: [0.4, .18, .1], hand: [0.57, -.15, .1], wood: [0.72, .2, .1], stomp: [0.63, 0, .1],
    gong: [0.45, 0, .2], whoosh: [2.83, 0, .1], riser: [4.01, 0, .15], impact: [0.55, 0, .1],
    b808: [0.37, 0, 0], sub: [0.52, 0, 0], bass: [1.24, 0, 0], ubass: [0.4, 0, .02], synbass: [0.53, 0, .02], hbass: [1.45, 0, .02], slap: [1.82, 0, .04], log: [1.05, 0, .05],
    epiano: [1.93, 0, .18], piano: [1.81, 0, .16], stab: [6.3, 0, .14], organ: [2.61, 0, .14], pad: [5.45, 0, .25], strings: [4.31, 0, .25], choir: [7.26, 0, .3], sho: [3.8, 0, .3], guitar: [3.6, .2, .1], clav: [1.8, -.2, .08],
    pluck: [1.52, 0, .15], synpluck: [2.9, .1, .15], marimba: [2.2, -.1, .12], kalimba: [1.73, .12, .15], musicbox: [1.58, .15, .2], vibes: [1.94, -.1, .2], koto: [1.85, -.12, .15], shamisen: [3, .12, .12],
    shakuhachi: [0.84, 0, .25], flute: [0.88, 0, .22], whistle: [1.02, 0, .2], whine: [1.18, 0, .18], supersaw: [3.8, 0, .15], lead: [5.58, 0, .12], pan: [2.15, 0, .15], bell: [1.37, .2, .25], chime: [2.03, -.2, .3],
    brass: [2.9, 0, .12], horn: [2.8, 0, .12], accordion: [3.61, 0, .12], fiddle: [3.08, 0, .15], theremin: [2.37, 0, .25], _: [.6, 0, .1] };
  const LOUD = .85;                                       // the desk's output level (the songs as loud as the old ones)
  const IRS = typeof WeakMap === 'function' ? new WeakMap() : null;
  const roomIR = ac => { if (IRS?.has(ac)) return IRS.get(ac); const n = Math.floor(ac.sampleRate * 1.1), b = ac.createBuffer(2, n, ac.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); let y = 0; for (let i = 0; i < n; i++) { y += .4 * ((Math.random() * 2 - 1) - y); d[i] = y * Math.exp(-i / (ac.sampleRate * .28)); } }
    IRS?.set(ac, b); return b; };
  function desk(ac, out, song) {
    const V = voices(ac), bus = ac.createGain(), glue = ac.createDynamicsCompressor(), lim = ac.createDynamicsCompressor(), master = ac.createGain(), clip = ac.createWaveShaper(), room = ac.createConvolver(), wet = ac.createGain();
    glue.threshold.value = -16; glue.knee.value = 10; glue.ratio.value = 3; glue.attack.value = .012; glue.release.value = .2;
    lim.threshold.value = -6; lim.knee.value = 2; lim.ratio.value = 16; lim.attack.value = .002; lim.release.value = .1;
    bus.gain.value = .64; master.gain.value = LOUD;
    const n = 2048, cv = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1, a = Math.abs(x); cv[i] = Math.sign(x) * (a < .6 ? a : .6 + .28 * Math.tanh((a - .6) / .28)); } clip.curve = cv;
    room.buffer = roomIR(ac); wet.gain.value = .55; room.connect(wet).connect(bus);
    bus.connect(glue).connect(lim).connect(master).connect(clip).connect(out);
    const chans = {}, ducks = [], beat = 60 / song.bpm;
    const chan = (i, side) => { const id = i + side; if (chans[id]) return chans[id];
      const [lv, pan, send] = MIX[i] || MIX._, g = ac.createGain(), p = ac.createStereoPanner(); g.gain.value = lv; p.pan.value = Math.max(-1, Math.min(1, pan + (side === 'L' ? -.22 : side === 'R' ? .22 : 0)));
      let head = g; if (song.pump && song.duck.has(i)) { const dk = ac.createGain(); dk.connect(g); head = dk; ducks.push(dk.gain); }
      g.connect(p).connect(bus); if (send) { const s = ac.createGain(); s.gain.value = send; p.connect(s).connect(room); }
      return chans[id] = head; };
    return {
      play(e, t) {
        const fn = V[e.i]; if (!fn) return;
        if (song.pump && e.r === 'K') for (const p of ducks) { p.setValueAtTime(1, t); p.linearRampToValueAtTime(.55, t + .012); p.linearRampToValueAtTime(1, t + Math.min(.24, beat * .55)); }
        const f = e.f || [0], many = f.length > 1, v = e.v * (many ? .3 : 1) * (e.r === 'R' ? .6 : 1);
        f.forEach((hz, j) => fn(chan(e.i, many ? (j % 2 ? 'R' : 'L') : ''), t, v, hz, e.len || .3, e));
      },
      out: clip
    };
  }

  // ── music theory: note names ('E5', a MIDI number), chords ('Am7', 'F/A'), scales, a seeded random ──
  const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const pcOf = s => (SEMI[s[0]] + (s[1] === '#' ? 1 : s[1] === 'b' ? -1 : 0) + 12) % 12;
  const midi = n => { const m = /^([A-G])(#|b)?(-?\d)$/.exec(n); return m ? SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (+m[3] + 1) * 12 : null; };
  const fq = m => 440 * Math.pow(2, (m - 69) / 12);
  const QUAL = { '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], 9: [0, 4, 7, 10, 14], m9: [0, 3, 7, 10, 14], maj9: [0, 4, 7, 11, 14],
    add9: [0, 4, 7, 14], madd9: [0, 3, 7, 14], 6: [0, 4, 7, 9], m6: [0, 3, 7, 9], sus2: [0, 2, 7], sus4: [0, 5, 7], '7sus4': [0, 5, 7, 10], dim: [0, 3, 6], m7b5: [0, 3, 6, 10],
    dim7: [0, 3, 6, 9], aug: [0, 4, 8], 5: [0, 7], m11: [0, 3, 7, 10, 14, 17], 13: [0, 4, 7, 10, 14, 21], '7b9': [0, 4, 7, 10, 13], mmaj7: [0, 3, 7, 11] };
  const CHD = {};
  const chord = s => CHD[s] || (CHD[s] = (() => { const m = /^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/.exec(s), iv = m && QUAL[m[2]]; if (!iv) throw new Error('chord ' + s);
    const r = pcOf(m[1]); return { s, r, iv, pcs: iv.map(i => (r + i) % 12), bass: m[3] ? pcOf(m[3]) : r, minor: iv[1] === 3 }; })());
  const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], mixo: [0, 2, 4, 5, 7, 9, 10], phryg: [0, 1, 3, 5, 7, 8, 10], harm: [0, 2, 3, 5, 7, 8, 11],
    minp: [0, 3, 5, 7, 10], majp: [0, 2, 4, 7, 9], yo: [0, 2, 5, 7, 9], in: [0, 1, 5, 7, 8], hira: [0, 2, 3, 7, 8], kumoi: [0, 2, 3, 7, 9] };
  // a progression: a chord a bar, two (or four) in a bar joined by '_' ('Am7 F_G' = Am7 for a bar, then F and G)
  const prog = s => s.trim().split(/\s+/).map(t => { const cs = t.split('_').map(chord); return cs.map((c, i) => ({ s: i * 16 / cs.length, c })); });
  const chordAt = (bar, s) => { let c = bar[0].c; for (const x of bar) if (x.s <= s) c = x.c; return c; };
  const lcg = seed => { let s = seed >>> 0 || 1; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; };
  const hash = str => { let h = 2166136261; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return h >>> 0; };
  // a melody note: a note name ('E5'), or a degree of the chord under it (1 root, 3 third, 5 fifth, 7 seventh; 2 / 9, 4,
  // 6: the scale's tone that far above the root; 8: the root above), placed nearest the note before ('^' above it, 'v'
  // below, "'" an octave up, ',' an octave down); u / d: a step up / down the song's pentatonic (uu, dd: two)
  const degPc = (n, c, S) => {
    if (n === 1 || n === 8) return c.r;
    if (n === 3) return (c.r + (c.iv.find(i => i >= 2 && i <= 5) ?? 4)) % 12;
    if (n === 5) return (c.r + (c.iv.find(i => i >= 6 && i <= 8) ?? 7)) % 12;
    if (n === 7 && c.iv.some(i => i >= 9 && i <= 11)) return (c.r + c.iv.find(i => i >= 9 && i <= 11)) % 12;
    const at = S.scale.indexOf(c.r), up = { 2: 1, 9: 1, 4: 3, 6: 5, 7: 6 }[n];
    return at >= 0 ? S.scale[(at + up) % 7] : (c.r + { 2: 2, 9: 2, 4: 5, 6: c.minor ? 8 : 9, 7: c.minor ? 10 : 11 }[n]) % 12;
  };
  const place = (p, prev, mark, mid) => { const b = prev - (((prev - p) % 12) + 12) % 12;
    if (mark === '^') return b + 12; if (mark === 'v') return b === prev ? b - 12 : b;
    const up = b + 12; return (prev - b < up - prev || (prev - b === up - prev && Math.abs(b - mid) <= Math.abs(up - mid))) ? b : up; };
  const stepFrom = (p, dir, ps) => { let m = p; do m += dir; while (!ps.includes(((m % 12) + 12) % 12)); return m; };
  function note(tok, c, prev, S, lo, hi) {
    const ab = midi(tok); if (ab != null) return ab;
    const m = /^([1-9]|u{1,3}|d{1,3})([\^v]?)([',]*)$/.exec(tok); if (!m) throw new Error('note ' + tok);
    let p;
    if (m[1][0] === 'u' || m[1][0] === 'd') { p = prev; for (let i = 0; i < m[1].length; i++) p = stepFrom(p, m[1][0] === 'u' ? 1 : -1, S.ps); }
    else p = place(degPc(+m[1], c, S), prev, m[1] === '8' && !m[2] ? '^' : m[2], (lo + hi) / 2);
    for (const ch of m[3]) p += ch === "'" ? 12 : -12;
    while (p < lo) p += 12; while (p > hi) p -= 12;
    return p;
  }
  // where each instrument plays a melody, and its chords
  const RANGE = { pluck: [60, 86], synpluck: [57, 84], whistle: [72, 93], whine: [72, 96], flute: [60, 93], shakuhachi: [60, 86], koto: [52, 88], shamisen: [52, 84], pan: [60, 88], marimba: [55, 91], kalimba: [62, 88],
    musicbox: [72, 98], vibes: [60, 86], theremin: [62, 88], organ: [55, 84], brass: [55, 86], horn: [55, 86], accordion: [57, 86], fiddle: [55, 91], supersaw: [57, 84], lead: [60, 86], piano: [55, 86],
    epiano: [52, 84], bell: [72, 96], chime: [74, 100], guitar: [52, 79], clav: [52, 79], stab: [55, 82], strings: [55, 86], choir: [55, 79], sho: [62, 86], pad: [48, 79] };
  const KREG = { epiano: [52, 74], piano: [52, 76], stab: [55, 76], organ: [52, 74], pad: [50, 70], strings: [55, 79], choir: [55, 74], sho: [62, 84], guitar: [52, 72], clav: [52, 72], koto: [55, 76],
    pan: [60, 79], horn: [55, 76], brass: [55, 76], accordion: [55, 76], synpluck: [55, 76], vibes: [57, 79], marimba: [55, 76], _: [52, 74] };
  const SUSTAIN = new Set(['pad', 'strings', 'choir', 'sho']);        // slow chords: held, never carry arrows
  const SLIDE = new Set(['whine', 'whistle', 'shakuhachi']);          // melodies that slide from note to note when tied
  const ROLE = { kick: 'K', kickh: 'K', kickl: 'K', stomp: 'K', snare: 'S', snareb: 'S', snarel: 'S', clap: 'S', snap: 'S', rim: 'S', hat: 'H', ohat: 'H', shaker: 'H', tamb: 'H', ride: 'H',
    crash: 'F', gong: 'F', whoosh: 'F', riser: 'F', impact: 'F' };    // other drums: T (a drum hit an arrow may take)
  const ONSET = new Set(['K', 'S', 'T', 'B', 'C', 'M', 'R']), QUIET = new Set(['sub']);   // a sub bass is felt, not heard on a phone

  // ── the grooves: drums are bars of 16 steps ('X' accent, 'x' hit, 'o' ghost; a list plays bar after bar); sw: the odd
  // sixteenths late by that share of a step, sw8: the off-beat eighths late by that share of an eighth; fam: the
  // family (hop, funk, latin, house) sets the break and the build; sn / kk: the backbeat and kick voices; bass: a
  // template a bar (R root, 5, 8 octave, 3, 7, 4, 6, A a step into the next chord's root, '-' held, '.' rest) or 'kick'
  // (a note on every kick, degrees bdeg); comp: the chords' rhythm; riff: the verse's counter-melody (see note()) ──
  const GROOVES = {
    bap: { name: 'Boom bap', fam: 'hop', sw: .16, sw8: .08, sn: 'snareb', kk: 'kick', fill: 'hop', keys: 'epiano', bass: 'bass', bt: 'kick', bdeg: 'R R 5 R', comp: ['X-------x-------', 'X-------x-----x-'],
      kits: [
        { kick: ['X.........X.....', 'X.....x...X..x..'], snareb: ['....X.......X...'], hat: ['x.x.x.x.x.x.x.x.'], ohat: ['................', '..............x.'] },
        { kick: ['X......x..X.....', 'X......x.xX.....'], snareb: ['....X.......X...'], hat: ['x.xox.x.x.xox.x.'], rim: ['..........o.....'] },
        { kick: ['X.....x...X.....', 'X.....x...x..x..'], snareb: ['....X.......X...'], hat: ['x.x.x.x.x.x.x.x.'], ohat: ['..............x.'] }],
      riff: '. . 5 . . 3 . . | . 1 . . 5^ . 3 .' },
    jazz: { name: 'Jazz hop', fam: 'hop', sw: 0, sw8: .2, sn: 'snarel', kk: 'kick', fill: 'hop', keys: 'epiano', bass: 'ubass', bt: ['R---5---8---A---', 'R---3---5---A---'], comp: ['X-----------x---'],
      kits: [{ kick: ['X.......X.x.....', 'X......xX.......'], snarel: ['....X.......X...'], ride: ['X...x.x.X...x.x.'], rim: ['..............o.'] }],
      riff: '5 . . 3 . . 1 . | . . 9 . 7 . . .' },
    lofi: { name: 'Lo-fi', fam: 'hop', sw: .08, sw8: .18, sn: 'snarel', kk: 'kickl', fill: 'hop', keys: 'epiano', bass: 'bass', bt: 'kick', bdeg: 'R 5 R', comp: ['X---------------'],
      kits: [{ kickl: ['X.....x...x.....', 'X.......x.x.....'], snarel: ['....X.......X...'], hat: ['x.x.x.x.x.x.x.x.'], shaker: ['..x...x...x...x.'] }],
      riff: '3 . 5^ . 7^ . 5 . | 9 . 7 . 5 . . .' },
    gfunk: { name: 'G-funk', fam: 'hop', sw: .16, sn: 'snare', kk: 'kick', fill: 'hop', keys: 'epiano', bass: 'synbass', bt: ['R-----R-R-----.5', 'R-----R-R---5-A-'], comp: ['X-------........', 'X-------....x---'],
      kits: [
        { kick: ['X.....x.X.......', 'X.....x.X.x..x..'], snare: ['....X.......X...'], clap: ['....X.......X...'], hat: ['xoxoxoxoxoxoxoxo'], ohat: ['......x.......x.'] },
        { kick: ['X.......X.x.....', 'X..x....X.x.....'], snare: ['....X.......X...'], clap: ['....X.......X...'], hat: ['x.xxx.xxx.xxx.xx'] }],
      riff: '5 . . . 3 . 1 . | . . . . 7 . 5 .' },
    funk: { name: 'Funk', fam: 'funk', sw: .08, sn: 'snare', kk: 'kick', fill: 'funk', keys: 'clav', bass: 'slap', bt: ['R..8.R..R.8.5.A.', 'R..8.R..R.8.7.5.'], comp: ['.x.x..x..x.x..x.'],
      kits: [{ kick: ['X..x......X..x..', 'X..x....x.X.....'], snare: ['....X..o.o..X..o'], hat: ['XoxoXoxoXoxoXoxo'], ohat: ['..............x.'] }],
      riff: '1 . 3^ 5^ . 3 . 1 | . 7 . 5 . 3 . .' },
    march: { name: 'Hip hop march', fam: 'hop', sw: .1, sn: 'snare', kk: 'kick', fill: 'march', keys: 'horn', bass: 'bass', bt: 'kick', bdeg: 'R 5 R 5', comp: ['X-------X-------'],
      kits: [{ kick: ['X.......X.......', 'X.......X..x....'], snare: ['....X..o....X.oo', '....X..o....X.xx'], hat: ['x.x.x.x.x.x.x.x.'] }],
      riff: '1 . . 5^ . . 3 . | 1 . 5^ . 8 . . .' },
    dembow: { name: 'Dembow', fam: 'latin', sw: 0, sn: 'snare', kk: 'kick', fill: 'latin', keys: 'stab', bass: 'b808', bt: ['R--R--R-R--R--R-', 'R--R--R-R--5--A-'], comp: ['X--x----X--x----'],
      kits: [{ kick: ['X...X...X...X...'], snare: ['...x..x....x..x.'], hat: ['x.x.x.x.x.x.x.x.'], shaker: ['.x.x.x.x.x.x.x.x'] }],
      riff: '5 . . 3 . . 1 . 5^ . . 3 . . 8 .' },
    moomba: { name: 'Moombahton', fam: 'latin', sw: 0, sn: 'snare', kk: 'kick', fill: 'latin', keys: 'stab', bass: 'b808', bt: ['R--R--8-R--R--5-'], comp: ['X..x..x.........', '........X..x..x.'],
      kits: [{ kick: ['X...X...X...X...'], snare: ['...x..x....x..x.'], clap: ['....X.......X...'], tomh: ['..........x.....'], toml: ['............x...'], shaker: ['x.xxx.xxx.xxx.xx'], ohat: ['..x...x...x...x.'] }],
      riff: '1 . . 5^ . . 8 . 7 . . 5 . . 3 .' },
    afro: { name: 'Afrobeats', fam: 'latin', sw: .1, sn: 'clap', kk: 'kick', fill: 'latin', keys: 'guitar', bass: 'b808', bt: 'kick', bdeg: 'R R 5 R', comp: ['x.x..x.x..x.x...'],
      kits: [
        { kick: ['X.....x...X.....', 'X..x..x...X.....'], clap: ['....X.......X...'], rim: ['x..x..x...x..x..'], shaker: ['xXxxxXxxxXxxxXxx'], conga: ['......x.x.....x.'] },
        { kick: ['X..x....X.......', 'X..x....X..x....'], clap: ['....X.......X...'], rim: ['..x..x....x..x..'], shaker: ['x.xXx.xXx.xXx.xX'], congalo: ['x.......x.x.....'] }],
      riff: '1 . 3^ . 5^ 3 . 1 | . 5^ . 3 . 1 . .' },
    amapiano: { name: 'Amapiano', fam: 'latin', sw: .14, sn: 'snap', kk: 'kickh', fill: 'latin', keys: 'epiano', bass: 'log', bt: ['R..R..R.....R...', 'R..R..R...5...A.'], comp: ['X-----x---------'],
      kits: [{ kickh: ['X...X...X...X...'], snap: ['....x.......x...'], shaker: ['x.xxx.xxx.xxx.xx'], ohat: ['..x...x...x...x.'], wood: ['...x......x...x.'] }],
      riff: '5 . 3 . 1 . 3^ 5^ | . 7 . 5 . 3 . .' },
    soca: { name: 'Soca', fam: 'latin', sw: 0, sn: 'snare', kk: 'kickh', fill: 'latin', keys: 'horn', bass: 'synbass', bt: ['R..R..5.R..R..5.', 'R..R..5.R..8..A.'], comp: ['..x...x...x...x.'],
      kits: [{ kickh: ['X...X...X...X...'], snare: ['....X..x....X...', '....X..x....X..x'], iron: ['x.X.x.X.x.X.x.X.'], ohat: ['..x...x...x...x.'] }],
      riff: '1 . 3^ . 5^ . 3 . | 8 . 5 . 3 . 5^ .' },
    calypso: { name: 'Calypso', fam: 'latin', sw: .1, sn: 'rim', kk: 'kick', fill: 'latin', keys: 'guitar', bass: 'bass', bt: ['R...5...R...5...', 'R...5...R..5..A.'], comp: ['..x...x...x...x.'],
      kits: [{ kick: ['X..x....X..x....'], rim: ['....X.......X..x'], shaker: ['xoxoxoxoxoxoxoxo'], bongo: ['..x.x...x.x.x...'] }],
      riff: '1 . 3^ 5^ . 3 . 1 | . 5^ . 3 . 1 . .' },
    matsuri: { name: 'Matsuri', fam: 'latin', sw: 0, sw8: .12, sn: 'clap', kk: 'kick', fill: 'taiko', keys: 'koto', bass: 'bass', bt: 'kick', bdeg: 'R 5 R 8', comp: ['X...x.x.X...x.x.'],
      kits: [{ kick: ['X.....x.X.......'], clap: ['....X.......X...'], taiko: ['X..x..x.X...x...'], shime: ['x.xxx.xxx.xxx.xx'], kane: ['..x...x...x...x.'] }],
      riff: '1 . 3^ . 5^ . 3 . | 5^ . 8 . 5 . 3 .' },
    house: { name: 'House', fam: 'house', sw: .04, sn: 'clap', kk: 'kickh', fill: 'house', keys: 'piano', arr: 'D', bass: 'hbass', bt: ['..R...R...R...R.', '..R...R...R...8.'], comp: ['..x..x....x..x..', 'x..x..x...x.....'],
      kits: [{ kickh: ['X...X...X...X...'], clap: ['....X.......X...'], ohat: ['..x...x...x...x.'], hat: ['o.o.o.o.o.o.o.o.'], shaker: ['xoxoxoxoxoxoxoxo'] }],
      riff: '1 . 5^ . 8 . 5 . | 3 . 5^ . 8 . 5 .' },
    deep: { name: 'Deep house', fam: 'house', sw: .06, sn: 'clap', kk: 'kickh', fill: 'house', keys: 'epiano', arr: 'D', bass: 'hbass', bt: ['R..R..R...R..R..', 'R..R..R...R..8..'], comp: ['X-----x---------'],
      kits: [{ kickh: ['X...X...X...X...'], clap: ['....X.......X...'], rim: ['......x.......x.'], ohat: ['..x...x...x...x.'], shaker: ['x.xxx.xxx.xxx.xx'] }],
      riff: '5 . . 3 . . 1 . | . . 7 . 5 . . .' },
    piano: { name: 'Piano house', fam: 'house', sw: .04, sn: 'clap', kk: 'kickh', fill: 'house', keys: 'piano', arr: 'D', bass: 'hbass', bt: ['..R...R...R...R.', '..R...8...R...5.'], comp: ['x..x..x...x..x..'],
      kits: [{ kickh: ['X...X...X...X...'], clap: ['....X.......X...'], ohat: ['..x...x...x...x.'], hat: ['o.o.o.o.o.o.o.o.'], tamb: ['....x.......x...'] }],
      riff: '8 . 5 . 3 . 5 . | 8 . 5 . 3 . 1 .' },
    tech: { name: 'Tech house', fam: 'house', sw: .06, sn: 'clap', kk: 'kickh', fill: 'house', keys: 'stab', arr: 'D', bass: 'hbass', bt: ['..RR..RR..RR..RR', '..RR..RR..R8..RR'], comp: ['...x......x.....'],
      kits: [{ kickh: ['X...X...X...X...'], clap: ['....X.......X...'], ohat: ['..x...x...x...x.'], hat: ['xoxoxoxoxoxoxoxo'], rim: ['..x..x...x..x...'] }],
      riff: '1 . . 1 . . 5 . | . . 3 . . 1 . .' },
    afroh: { name: 'Afro house', fam: 'house', sw: .08, sn: 'clap', kk: 'kickh', fill: 'latin', keys: 'pad', arr: 'D', bass: 'sub', bt: ['R.....R...R.....', 'R.....R...R..5..'], comp: ['X---------------'],
      kits: [{ kickh: ['X...X...X...X...'], clap: ['....X.......X...'], conga: ['x..x..x...x.x...'], congalo: ['...........x...x'], tomh: ['......x.......x.'], shaker: ['x.xxx.xxx.xxx.xx'], ohat: ['..x...x...x...x.'] }],
      riff: '1 . 3^ 5^ . 3 8 . | 7 . 5 3 . 5^ . .' },
    disco: { name: 'Nu-disco', fam: 'house', sw: 0, sn: 'clap', kk: 'kickh', fill: 'house', keys: 'strings', arr: 'D', bass: 'slap', bt: ['R.8.R.8.R.8.R.8.', 'R.8.R.8.5.8.A.8.'], comp: ['X-------X-------'],
      kits: [{ kickh: ['X...X...X...X...'], clap: ['....X.......X...'], ohat: ['..x...x...x...x.'], hat: ['xoxoxoxoxoxoxoxo'], tamb: ['....x.......x...'] }],
      riff: '1 . 5^ . 3 . 5 . | 8 . 7 . 5 . 3 .' } };
  // fills: the parts they replace in the last bar of a phrase (S = the groove's backbeat voice, K its kick); the last bar
  // of a 4-bar phrase inside a section gets only the fill's last beat, a section's last bar the whole fill
  const FILLS = {
    hop: [{ S: '....X.......X.xx' }, { K: 'X.........x.....', S: '....X.......X...', tomh: '............x...', tomm: '.............x..', toml: '..............x.' }],
    funk: [{ S: '....X..o.o..XxXx' }],
    latin: [{ timbale: '........x.x.xxxx' }, { tomh: '........x.x.....', toml: '............x.x.' }],
    house: [{ S: '....X.......x.xx' }],
    taiko: [{ taiko: 'X..x..x.X.x.xxxx' }],
    march: [{ S: 'x.x.x.x.xxxxXXXX' }] };
  // the arrangements ([section, bars]; 30 bars under 92 beats a minute, else 32): a 2-bar count-in (drums only, no
  // arrows), an intro, verse and hook, a break, the hook again, a 2-bar outro ending on one big hit; B opens on the hook;
  // D (house) builds into each hook (a riser and a snare roll, then the drop)
  const ARR = {
    A: { 30: [['count', 2], ['intro', 2], ['verse', 8], ['hook', 8], ['break', 4], ['hook', 4], ['outro', 2]], 32: [['count', 2], ['intro', 4], ['verse', 8], ['hook', 8], ['break', 4], ['hook', 4], ['outro', 2]] },
    B: { 30: [['count', 2], ['hook', 4], ['verse', 8], ['hook', 8], ['break', 2], ['hook', 4], ['outro', 2]], 32: [['count', 2], ['intro', 2], ['hook', 4], ['verse', 8], ['hook', 8], ['break', 2], ['hook', 4], ['outro', 2]] },
    D: { 30: [['count', 2], ['intro', 2], ['verse', 6], ['build', 2], ['hook', 8], ['break', 2], ['build', 2], ['hook', 4], ['outro', 2]], 32: [['count', 2], ['intro', 2], ['verse', 8], ['build', 2], ['hook', 8], ['break', 2], ['build', 2], ['hook', 4], ['outro', 2]] } };

  // ── each village's sound: the scale and pentatonic of its minor and major songs, the lead (hook), riff (verse) and
  // lift (doubles the last hooks) instruments, the chords' instrument (by groove or family, _ for all), the count-in
  // click, drums it layers on the groove per section, and a gong or a whoosh into each hook ──
  const PAL = {
    hub: { min: ['minor', 'minp'], maj: ['major', 'majp'], lead: 'pluck', riff: 'vibes', lift: 'synpluck', count: 'rim', keys: {} },
    ashigaru: { min: ['minor', 'hira'], maj: ['major', 'yo'], lead: 'flute', riff: 'koto', lift: 'koto', count: 'wood', keys: { hop: 'koto' },
      layers: { verse: { taiko: ['X...............'] }, hook: { taiko: ['X.......x.......'], shime: ['..x...x...x...x.'] } } },
    buke: { min: ['minor', 'minp'], maj: ['mixo', 'majp'], lead: 'brass', riff: 'bell', lift: 'horn', count: 'rim', keys: { hop: 'horn' },
      layers: { hook: { snarel: ['.o.o..o..o.o..o.'] } } },
    bushi: { min: ['minor', 'hira'], maj: ['major', 'yo'], lead: 'koto', riff: 'shamisen', lift: 'shakuhachi', count: 'wood', keys: { hop: 'koto' }, whoosh: 1,
      layers: { verse: { wood: ['..x...x...x...x.'] }, hook: { taiko: ['X.....x.X.......'], wood: ['..x...x...x...x.'] } } },
    chumpz: { min: ['minor', 'minp'], maj: ['major', 'majp'], lead: 'pan', riff: 'marimba', lift: 'marimba', count: 'cowbell', keys: { hop: 'pan', latin: 'guitar' },
      layers: { verse: { bongo: ['..x.x...x.x.x...'] }, hook: { conga: ['......x.x.....x.'], congalo: ['x.......x.......'] } } },
    'cute-creepy': { min: ['harm', 'harm'], maj: ['major', 'majp'], lead: 'theremin', riff: 'musicbox', lift: 'musicbox', count: 'wood', keys: { _: 'organ' }, keys2: 'epiano',
      layers: { hook: { tomm: ['..............x.'], toml: ['...............x'] } } },
    kenshi: { min: ['dorian', 'kumoi'], maj: ['major', 'yo'], lead: 'shakuhachi', riff: 'koto', lift: 'kalimba', count: 'wood', keys: { hop: 'epiano' }, whoosh: 1,
      layers: { verse: { wood: ['....x.......x...'] }, hook: { taiko: ['X...............'], wood: ['....x.......x...'] } } },
    samurai: { min: ['phryg', 'in'], maj: ['major', 'yo'], lead: 'shamisen', riff: 'koto', lift: 'shakuhachi', count: 'shime', keys: { hop: 'epiano', latin: 'koto' }, gong: 1,
      layers: { verse: { taiko: ['X.......x.......'] }, hook: { taiko: ['X..xX...X..xX...'], shime: ['x.x.x.x.x.x.x.x.'] } } },
    shogun: { min: ['dorian', 'kumoi'], maj: ['major', 'yo'], lead: 'koto', riff: 'koto', lift: 'flute', count: 'shime', keys: { _: 'sho' }, gong: 1,
      layers: { verse: { shime: ['x...x...x..xx...'] }, hook: { taiko: ['X.........x.....'], shime: ['x...x...x..xx...'] } } },
    sohei: { min: ['minor', 'minp'], maj: ['major', 'yo'], lead: 'shakuhachi', riff: 'bell', lift: 'choir', count: 'shime', keys: { _: 'choir' }, gong: 1,
      layers: { verse: { odaiko: ['X...............'] }, hook: { odaiko: ['X.......X...x...'], shime: ['....x..x....x..x'] } } },
    warrior: { min: ['phryg', 'in'], maj: ['major', 'majp'], lead: 'horn', riff: 'brass', lift: 'brass', count: 'rim', keys: { hop: 'horn' },
      layers: { verse: { stomp: ['....X.......X...'] }, hook: { tomm: ['x.x.....x.x.....'], toml: ['....x.......x...'], stomp: ['....X.......X...'] } } },
    wokou: { min: ['dorian', 'minp'], maj: ['mixo', 'majp'], lead: 'accordion', riff: 'fiddle', lift: 'whistle', count: 'stomp', keys: { _: 'accordion' }, keys2: 'guitar',
      layers: { verse: { stomp: ['X.......X.......'] }, hook: { stomp: ['X.......X.......'], clap: ['....X.......X...'] } } },
    yamabushi: { min: ['dorian', 'kumoi'], maj: ['major', 'yo'], lead: 'shakuhachi', riff: 'kalimba', lift: 'chime', count: 'hand', keys: { hop: 'pad', latin: 'kalimba', house: 'epiano' }, gong: 1,
      layers: { verse: { hand: ['X..x..X...x..x..'] }, hook: { hand: ['X..x..X...x..x..'], taiko: ['X...............'] } } },
    'saints-la': { min: ['dorian', 'minp'], maj: ['mixo', 'majp'], lead: 'whine', riff: 'vibes', lift: 'whistle', count: 'rim', keys: { hop: 'epiano', funk: 'epiano' },
      layers: { hook: { clap: ['....X.......X...'] } } } };

  // ── the songs: [title, groove, beats a minute, the hook's chords, the hook (bars split by '|', each 8 eighths or 16
  // sixteenths of notes (see note()), '.' rest, '-' held), options: v verse chords, lead / ri (riff) / lift / keys / bass
  // instruments, r the verse riff, dv the groove's drum kit, arr the arrangement, key + sc + ps the key, scale and
  // pentatonic, o the note a degree hook starts near, sw swing] ──
  const SONGS = {
    hub: [
      ['Rebel Groove', 'bap', 88, 'Cm7 Fm7', 'C5 . D#5 . G5 . F5 D#5 | C5 . . . A#4 . C5 . | C5 . D#5 . G5 . A#5 G5 | F5 . D#5 . C5 . . .', { dv: 2, r: '. . 5 . . 3 . . | . 7 . . 5 . . .' }],
      ['Colony Steps', 'jazz', 90, 'Bbm9 Eb9 Abmaj7 Fm9', 'F6 - . Db6 - . Bb5 C6 | Db6 - . Bb5 - . G5 . | C6 - . Eb6 G6 - Eb6 . | F6 - - - C6 - . .', { lead: 'whistle', key: 'Ab', sc: 'major', ps: 'majp' }],
      ['Tunnel Rider', 'gfunk', 94, 'Fm7 Bb9', 'C6 - - - - - Ab5 F5 | D6 - - - C6 - Bb5 - | C6 - - - Eb6 - C6 - | D6 - C6 - Ab5 - - -', { lead: 'whine', sc: 'dorian', dv: 1 }],
      ['Antenna Funk', 'funk', 100, 'Em7 A7', 'E5 . G5 . B5 A5 . D5 | C#5 - E5 . G5 - E5 . | B5 . A5 G5 . E5 . D5 | E5 - - . . . . .', { lead: 'brass', sc: 'dorian', arr: 'B' }],
      ['Hub Dembow', 'dembow', 100, 'Am F C G', 'A4 . . C5 . . E5 . E5 . . D5 . . C5 . | A4 . . C5 . . F5 . F5 . . E5 . . C5 . | G4 . . C5 . . E5 . E5 . . D5 . . C5 . | B4 . . D5 . . G5 . G5 . . F5 . . D5 .', { lead: 'synpluck' }],
      ['Crown Tunnels', 'moomba', 106, 'Dm Bb F C', 'D5 . F5 . A5 - G5 F5 | D5 - - . F5 . D5 . | C5 . F5 . A5 - G5 F5 | E5 - - . G5 . E5 .', { lead: 'horn' }],
      ['Golden Sap', 'afro', 108, 'F Am Dm Bb', 'A5 . C6 . A5 G5 . F5 | E5 . A5 . C6 . A5 . | D6 . C6 A5 . F5 . D5 | F5 - - . G5 . A5 .', { lead: 'marimba', dv: 1 }],
      ['Burrow Carnival', 'soca', 116, 'Bb Eb F Bb', 'F5 . D5 . F5 G5 . F5 | G5 . Eb5 . G5 Bb5 . G5 | A5 . F5 . A5 C6 . A5 | Bb5 - - . F5 . D5 .', { lead: 'horn', lift: 'pan' }],
      ['Lantern House', 'house', 122, 'Cm9 Abmaj7 Fm9 G7', 'G5 . . G5 . . Eb5 . | . . C5 . Eb5 . G5 . | F5 . . F5 . . Ab5 . | G5 - - . . . . .', { lead: 'supersaw' }],
      ['Rebel Anthem', 'piano', 126, 'Cm Ab Eb Bb', 'C5 . D#5 . G5 . F5 D#5 | C5 . . . A#4 . C5 . | D#5 . G5 . A#5 . C6 A#5 | F5 . D5 . A#4 . . .', { lead: 'supersaw', lift: 'pluck' }]],
    ashigaru: [
      ['Rice Planting Song', 'bap', 88, 'D G D A7sus4', 'D5 - E5 G5 A5 - G5 E5 | D5 - - - E5 - D5 B4 | A4 - B4 D5 E5 - G5 A5 | G5 E5 D5 - - - . .', { sc: 'mixo' }],
      ['Paddy Steps', 'lofi', 90, 'Em7 Cmaj7 G D', 'B4 - - D5 E5 - D5 B4 | E5 - - D5 B4 - A4 G4 | B4 - - - A4 - G4 E4 | A4 - - - - - . .', { lead: 'shakuhachi' }],
      ['Harvest Stomp', 'gfunk', 94, 'Am7 D9', 'A4 . C5 . E5 . G5 E5 | F#5 - E5 . D5 . C5 . | A4 . C5 . E5 . A5 G5 | F#5 - - . D5 - - .', { lead: 'shamisen', sc: 'dorian', arr: 'B' }],
      ['Planting Festival', 'matsuri', 98, 'D Bm G A', 'F#5 . A5 . D6 - B5 A5 | F#5 - D5 . B4 . D5 . | G5 . B5 . D6 - B5 G5 | A5 - - E5 . . . .', {}],
      ['Mud Trail', 'dembow', 100, 'Em C G D', 'E5 . . G5 . . B5 . E6 . . B5 . . G5 . | E5 . . G5 . . C6 . G5 . . E5 . . C5 . | D5 . . G5 . . B5 . D6 . . B5 . . G5 . | A5 . . F#5 . . D5 . A5 . . D6 . . A5 .', { lead: 'koto' }],
      ['Bamboo Bridge', 'moomba', 106, 'Bm G D A', 'B5 - - A5 - - F#5 - | G5 - - B5 - - D6 - | A5 - - F#5 - - D5 - | E5 - - A5 - - C#6 -', {}],
      ['Seed Song', 'afro', 108, 'G Em C D', 'B4 . D5 . G5 . D5 . | E5 . G5 B5 . G5 . E5 | E5 . G5 . C6 . G5 . | F#5 . A5 . D6 - - .', { lead: 'kalimba' }],
      ['Rain Dance', 'soca', 116, 'D A Bm G', 'F#5 . A5 . F#5 E5 . D5 | E5 . A5 . C#6 . A5 . | D6 . B5 . F#5 . D5 . | D5 . G5 . B5 - - .', {}],
      ['Field Lanterns', 'deep', 120, 'Em9 Cmaj7 Am7 B7', 'B5 - - - - - A5 G5 | E5 - - - - - . . | E5 - - G5 A5 - - . | F#5 - - - A5 - - .', { lead: 'shakuhachi', sc: 'harm' }],
      ['Ashigaru Rising', 'tech', 126, 'Am F G Em', 'A4 . . C5 . . E5 . C5 . A4 . E4 . G4 . | F4 . . A4 . . C5 . A4 . F4 . C4 . E4 . | G4 . . B4 . . D5 . B4 . G4 . D4 . F#4 . | E4 . . G4 . . B4 . G4 . E4 . B3 . D4 .', { lead: 'shamisen' }]],
    buke: [
      ['Trident March', 'march', 88, 'C C F G_C', 'C5 - - G4 C5 - E5 - | G5 - - E5 C5 - - - | F5 - - A5 G5 - E5 - | D5 - G4 - C5 - - -', {}],
      ['Gate Bastion', 'bap', 90, 'Am Em F G', 'A4 - - C5 E5 - - D5 | B4 - - G4 E4 - - . | A4 - - C5 F5 - E5 D5 | D5 - - B4 G4 - - .', { lead: 'horn', dv: 1 }],
      ['Archive Funk', 'gfunk', 94, 'Dm7 G7', 'A5 - - F5 - D5 - C5 | B4 - - D5 F5 - - . | A5 - - C6 - A5 - F5 | G5 - F5 - D5 - - .', { lead: 'horn', lift: 'whistle', sc: 'dorian' }],
      ['Canal Strut', 'funk', 98, 'C7 F7', 'G5 . E5 . G5 A5 . G5 | A5 . F5 . Eb5 . C5 . | G5 . E5 . G5 Bb5 . G5 | A5 - F5 - C5 - - .', { lead: 'horn', sc: 'mixo', arr: 'B' }],
      ['Shield Dembow', 'dembow', 100, 'Cm Ab Bb Gm', 'G5 . . Eb5 . . C5 . G5 . . Eb5 . . C5 . | Ab5 . . Eb5 . . C5 . Ab5 . . Eb5 . . C5 . | F5 . . D5 . . Bb4 . F5 . . D5 . . Bb4 . | G5 . . D5 . . Bb4 . D5 . . F5 . . G5 .', { lead: 'pluck', lift: 'bell' }],
      ['Moat Moombah', 'moomba', 106, 'Fm Db Ab Eb', 'C5 - - Ab4 - - F4 - | Db5 - - Ab4 - - F4 - | C5 - - Eb5 - - Ab5 - | G5 - - Eb5 - - Bb4 -', { lead: 'horn' }],
      ['Earthworks', 'afro', 108, 'G D Em C', 'D5 . G5 . B5 . G5 . | A5 . F#5 . D5 . A4 . | B4 . E5 . G5 . E5 . | C5 . E5 . G5 - - .', { lead: 'marimba' }],
      ['Bastion Soca', 'soca', 116, 'C F G C', 'E5 . G5 . C6 . G5 . | F5 . A5 . C6 . A5 . | G5 . B5 . D6 . B5 . | C6 - - . G5 . E5 .', { lift: 'bell' }],
      ['Strategy Hall', 'house', 122, 'Am7 Dm7 G Cmaj7', 'E5 . . E5 . . G5 . | F5 . . F5 . . A5 . | D5 . . D5 . . G5 . | E5 - - . . . . .', {}],
      ['Steadfast', 'tech', 128, 'Dm Bb C Am', 'D5 . F5 A5 . G5 . F5 | . D5 . F5 . D5 C5 Bb4 | E5 . G5 C6 . D6 . C6 | . C6 . A5 . E5 G5 A5', { lead: 'horn' }]],
    bushi: [
      ['War Fan Dance', 'bap', 88, 'Am F_E Am E', 'E4 A4 B4 E5 B4 A4 F4 A4 | E4 A4 C5 E5 C5 A4 F4 E4 | B3 E4 F4 B4 A4 F4 E4 F4 | E4 - - - B3 - - -', { dv: 1 }],
      ['Folding Fans', 'lofi', 90, 'Fmaj7 E7 Am7 Am7', 'C5 - - - A4 - E5 - | B4 - - - D5 - - - | C5 - - E5 A5 - G5 E5 | A4 - - - - - . .', { lead: 'shakuhachi', key: 'A', sc: 'minor', ps: 'hira' }],
      ['Crossed Swords', 'gfunk', 94, 'Am7 Bm7', 'E5 - - - C5 - A4 - | F#5 - - - D5 - B4 - | E5 - - - G5 - E5 - | D5 - B4 - A4 - - -', { lead: 'shakuhachi', sc: 'dorian' }],
      ['Strategist Step', 'matsuri', 98, 'Am G F E', 'A4 . C5 . E5 . C5 . | B4 . D5 . G5 . D5 . | A4 . C5 . F5 . C5 . | B4 . E5 . B4 . E5 .', {}],
      ['Signal Fires', 'dembow', 100, 'Dm Am Bb A', 'D5 . . F5 . . A5 . A5 . . G5 . . F5 . | C5 . . E5 . . A5 . A5 . . G5 . . E5 . | D5 . . F5 . . Bb5 . Bb5 . . A5 . . F5 . | C#5 . . E5 . . A5 . A5 . . E5 . . C#5 .', { lead: 'shamisen', sc: 'harm', arr: 'B' }],
      ['Night Maneuver', 'moomba', 106, 'Em C Am B7', 'E5 - - G5 - - B5 - | C6 - - B5 - - G5 - | A5 - - E5 - - C5 - | B4 - - D#5 - - F#5 -', { sc: 'harm' }],
      ['Rising Sun', 'amapiano', 112, 'Fmaj7 Em7 Dm7 Cmaj7', 'A5 - - - G5 - E5 - | G5 - - - E5 - D5 - | F5 - - - E5 - C5 - | E5 - - - - - . .', { lead: 'shakuhachi', key: 'C', sc: 'major', ps: 'yo' }],
      ['Tactician', 'afroh', 118, 'Am Am F G', 'E5 . . A5 . . C6 . | A5 - - G5 - - E5 - | F5 . . A5 . . C6 . | B5 - - G5 - - D5 -', { lead: 'shakuhachi' }],
      ['Blue Banner', 'house', 122, 'Dm9 Bbmaj7 Gm9 A7', 'F5 . . A5 . . D6 . | . . D6 . C6 . A5 . | D5 . . F5 . . Bb5 . | A5 - - . E5 . C#5 .', { sc: 'harm' }],
      ['Blade Mind', 'tech', 128, 'Am Fmaj7 Dm E', 'A4 . C5 E5 . D5 . C5 | . A4 . C5 . E5 . C5 | F5 . E5 D5 . A4 . D5 | . G#4 . B4 . E5 D5 B4', { lead: 'shamisen', sc: 'harm' }]],
    chumpz: [
      ['Calypso Cove', 'calypso', 90, 'C F G G_C', 'E5 . G5 E5 . C5 D5 E5 | F5 . A5 F5 . D5 E5 F5 | G5 G5 A5 G5 F5 E5 D5 C5 | D5 . . B4 C5 . . .', {}],
      ['Banana Bap', 'bap', 92, 'F Dm Gm C', 'A5 . C6 . A5 . F5 . | F5 . A5 . D6 - - . | G5 . Bb5 . D6 . Bb5 . | C6 - - . G5 . E5 .', { lead: 'marimba', dv: 2 }],
      ['Island Whine', 'gfunk', 94, 'Am7 D9', 'E6 - - - - - D6 C6 | F#6 - - - E6 - D6 - | E6 - - - G6 - E6 - | D6 - C6 - A5 - - -', { lead: 'whistle', sc: 'dorian' }],
      ['Barnacle Funk', 'funk', 98, 'G7 C7', 'D5 . F5 . G5 . B4 . | E5 . G5 . Bb5 . G5 . | D5 . F5 . G5 . B4 . | E5 - - . C5 . . .', { lead: 'horn', sc: 'mixo', arr: 'B' }],
      ['Sunset Dembow', 'dembow', 100, 'Am G F E', 'E5 . . A5 . . C6 . C6 . . B5 . . A5 . | D5 . . G5 . . B5 . B5 . . A5 . . G5 . | C5 . . F5 . . A5 . A5 . . G5 . . F5 . | B4 . . E5 . . G#5 . B5 . . G#5 . . E5 .', { sc: 'harm' }],
      ['Mango Moombah', 'moomba', 106, 'Gm Eb Bb F', 'D5 - - G5 - - Bb5 - | G5 - - Eb5 - - Bb4 - | D5 - - F5 - - Bb5 - | A5 - - F5 - - C5 -', { lead: 'horn' }],
      ['Island Afro', 'afro', 108, 'C G Am F', 'E5 . G5 . C6 . G5 E5 | D5 . G5 . B5 . G5 . | C5 . E5 . A5 . E5 C5 | A4 . C5 . F5 - - .', { lead: 'marimba', lift: 'pan' }],
      ['Carnival Road', 'soca', 118, 'F C Dm Bb', 'A5 . C6 . A5 . F5 A5 | G5 . C6 . E5 . G5 . | F5 . A5 . D6 . A5 . | D6 - C6 - Bb5 - - .', { lift: 'horn' }],
      ['Beach Party', 'afroh', 120, 'Am Dm G C', 'C6 . . A5 . . E5 . | D6 . . A5 . . F5 . | B5 . . G5 . . D5 . | C6 - - . . . . .', {}],
      ['Big Chain Bounce', 'house', 126, 'Bb F Gm Eb', 'F5 . D5 F5 . Bb5 . A5 | . A5 . C6 . A5 F5 . | G5 . Bb5 D6 . C6 . Bb5 | . G5 . Bb5 . G5 Eb5 F5', {}]],
    'cute-creepy': [
      ['Monster Mash', 'bap', 88, 'Am F Dm E', 'A4 - - C5 - B4 - A4 | F4 - - - E4 - - - | D4 - F4 - A4 - G#4 - | E4 - - - - - - -', {}],
      ['Graveyard Shuffle', 'lofi', 90, 'Dm Bb Gm A7', 'A6 . F6 . D6 . F6 . | D6 . Bb5 . F6 . D6 . | Bb5 . D6 . G6 . F6 . | E6 . C#6 . A5 - - .', { lead: 'musicbox' }],
      ['Haunted Ride', 'gfunk', 94, 'Am7 Dm7 E7 Am7', 'E5 - - - C5 - A4 - | F5 - - - D5 - A4 - | G#5 - - - E5 - B4 - | A4 - - - - - . .', {}],
      ['Mad Lab Funk', 'funk', 98, 'Am7 E7', 'A4 . C5 . E5 . C5 . | G#4 . B4 . D5 . B4 . | A4 . C5 . E5 . G5 . | G#4 - - . E4 - - .', { lead: 'organ', arr: 'B' }],
      ['Zombie Dembow', 'dembow', 100, 'Am F G E', 'A5 . . C6 . . E6 . E6 . . D6 . . C6 . | A5 . . C6 . . F6 . F6 . . E6 . . C6 . | B5 . . D6 . . G6 . G6 . . F6 . . D6 . | B5 . . E6 . . G#6 . G#6 . . E6 . . B5 .', { lead: 'musicbox' }],
      ['Spider Moombah', 'moomba', 106, 'Dm Gm A Dm', 'D5 - - F5 - - A5 - | Bb5 - - G5 - - D5 - | C#5 - - E5 - - A5 - | D5 - - - - - . .', {}],
      ['Pumpkin Patch', 'afro', 108, 'Am Em F G', 'E5 . A5 . C6 . A5 . | B5 . G5 . E5 . B4 . | A5 . F5 . C6 . A5 . | B5 . D6 . G5 - - .', { lead: 'kalimba' }],
      ['Witching Hour', 'disco', 118, 'Am Dm E7 Am', 'E5 - - A5 - - C6 - | D6 - - A5 - - F5 - | E5 - - G#5 - - B5 - | A5 - - - - - . .', {}],
      ['Moonlit Manor', 'house', 122, 'Am F C E', 'A5 - - - C6 - B5 - | A5 - - - F5 - - - | G5 - - - E5 - G5 - | G#5 - - - - - . .', {}],
      ['Coven Rave', 'tech', 128, 'Am G F E', 'E5 . A5 . . C6 B5 A5 | . G5 . B5 . D6 . B5 | C5 . F5 . . A5 G5 A5 | . B4 . E5 . G#5 . B5', { lead: 'lead' }]],
    kenshi: [
      ['Blade Kata', 'lofi', 86, 'Em7 Em7 Cmaj7 D', 'E4 - - - G4 - A4 - | B4 - - - A4 - - - | G4 - E4 - D4 - E4 - | D4 - - - F#4 - A4 -', {}],
      ['Still Pond', 'jazz', 88, 'Am9 D9 Gmaj7 Cmaj7', 'E5 . C5 . B4 . A4 . | F#5 . E5 . D5 . C5 . | B4 . D5 . F#5 . A5 . | G5 - - - E5 - - .', { lead: 'koto', key: 'G', sc: 'major', ps: 'yo' }],
      ['Raked Stone', 'bap', 92, 'Em7 Am7 D G', 'B4 - - D5 E5 - - . | C5 - - E5 A5 - G5 . | F#5 - - - A5 - D5 - | B4 - - - G4 - - .', { dv: 1, arr: 'B' }],
      ['Steel Whisper', 'gfunk', 96, 'Bm7 E9', 'F#5 - - - D5 - B4 - | G#5 - - - E5 - D5 - | F#5 - - - A5 - F#5 - | E5 - D5 - B4 - - -', {}],
      ['Bamboo Dembow', 'dembow', 100, 'Em D C B7', 'E5 . . G5 . . B5 . B5 . . A5 . . G5 . | D5 . . F#5 . . A5 . A5 . . G5 . . F#5 . | C5 . . E5 . . G5 . G5 . . E5 . . C5 . | B4 . . D#5 . . F#5 . A5 . . F#5 . . D#5 .', { lead: 'koto', sc: 'harm' }],
      ['Duel at Dusk', 'moomba', 104, 'C#m A E B', 'G#5 - - E5 - - C#5 - | A5 - - E5 - - C#5 - | B5 - - G#5 - - E5 - | F#5 - - D#5 - - B4 -', { lead: 'flute', sc: 'minor' }],
      ['Swordsmith', 'amapiano', 112, 'Fmaj7 Em7 Dm7 Em7', 'C6 . A5 . E5 . A5 . | B5 . G5 . E5 . G5 . | A5 . F5 . D5 . F5 . | G5 . E5 . B4 . D5 .', { lead: 'kalimba', key: 'A', sc: 'minor', ps: 'hira' }],
      ['Calm Precision', 'afroh', 118, 'Am Am Fmaj7 G', 'E5 - - - A5 - - . | C6 - - B5 - - A5 - | A5 - - - C6 - - . | B5 - - G5 - - D5 -', { sc: 'minor' }],
      ['Teal Haze', 'deep', 120, 'Cmaj9 Bm7 Am9 D9', 'E5 . . G5 . . B5 . | D5 . . F#5 . . A5 . | C5 . . E5 . . G5 . | F#5 - - . E5 . D5 .', { lead: 'koto', key: 'G', sc: 'major', ps: 'yo' }],
      ['One Cut', 'house', 126, 'Em C D Bm', 'B4 . E5 G5 . B5 . A5 | . G5 . E5 . C5 . E5 | F#5 . A5 D6 . A5 . F#5 | . D5 . F#5 . B5 A5 F#5', { lead: 'koto', sc: 'minor' }]],
    samurai: [
      ['Taiko Thunder', 'bap', 88, 'D5 G5_A5 D5 G5_A5', 'D5 - - E5 G5 - E5 - | D5 - B4 - A4 - - - | D5 - - E5 G5 - A5 - | B5 - A5 G5 E5 - - -', { lead: 'flute', key: 'D', sc: 'major', ps: 'yo' }],
      ['Cherry Terrace', 'jazz', 90, 'Dm7 Bbmaj7 Gm7 A7', 'D5 . F5 . A5 . F5 D5 | D5 . F5 . A5 - - . | Bb4 . D5 . G5 . F5 D5 | E5 . C#5 . A4 - - .', { dv: 1, sc: 'harm' }],
      ['Ronin Road', 'gfunk', 94, 'Cm7 F9', 'G5 - - - Eb5 - C5 - | A5 - - - G5 - F5 - | G5 - - - Bb5 - G5 - | F5 - Eb5 - C5 - - -', { lead: 'shakuhachi', sc: 'dorian' }],
      ['Lantern Festival', 'matsuri', 98, 'G Em C D', 'B5 . D6 . B5 . G5 . | G5 . B5 . E6 - - . | E6 . C6 . G5 . E5 . | F#5 . A5 . D6 - - .', { lead: 'flute' }],
      ['Katana Dembow', 'dembow', 100, 'Dm Bb Gm A', 'A4 . . D5 . . F5 . F5 . . E5 . . D5 . | Bb4 . . D5 . . F5 . F5 . . D5 . . Bb4 . | Bb4 . . D5 . . G5 . G5 . . F5 . . D5 . | C#5 . . E5 . . A5 . A5 . . E5 . . C#5 .', { sc: 'harm', arr: 'B' }],
      ['Crimson Moombah', 'moomba', 106, 'Fm Db Eb C', 'C5 - - F5 - - Ab5 - | Ab5 - - F5 - - Db5 - | Bb4 - - Eb5 - - G5 - | G5 - - E5 - - C5 -', { lead: 'shakuhachi', sc: 'harm' }],
      ['Dojo Afro', 'afro', 108, 'D Bm Em A', 'F#5 . A5 . D6 . A5 . | F#5 . B5 . D6 . B5 . | G5 . B5 . E6 - - . | E5 . A5 . C#6 . A5 .', { lead: 'koto' }],
      ['Thunder Soca', 'soca', 118, 'D G A D', 'A5 . F#5 . A5 B5 . A5 | B5 . G5 . B5 D6 . B5 | C#6 . A5 . E5 . A5 . | D6 - - . A5 . F#5 .', { lead: 'flute' }],
      ['Golden Hour', 'house', 122, 'Gm Eb Bb F', 'G5 . . Bb5 . . D6 . | G5 - - . Bb5 . G5 . | F5 . . Bb5 . . D6 . | C6 - - . A5 . F5 .', { lead: 'koto', sc: 'minor' }],
      ['Way of the Blade', 'tech', 128, 'Dm Dm Bb C', 'D5 . A4 D5 . F5 E5 D5 | . A4 . C5 . D5 . F5 | D5 . Bb4 D5 . F5 . D5 | . E5 . G5 . C5 . E5', { sc: 'minor' }]],
    shogun: [
      ['Court Fan Dance', 'bap', 88, 'Dm C Bb A', 'D4 A4 D5 - F5 E5 D5 A4 | C4 G4 C5 - E5 D5 C5 G4 | A#3 F4 A#4 - D5 C5 A#4 F4 | A3 E4 A4 - C#5 - - -', { sc: 'harm' }],
      ['Wisteria Steps', 'jazz', 90, 'Gm9 C9 Fmaj7 Dm7', 'D6 - . Bb5 - . A5 G5 | E5 - . G5 - . Bb5 . | A5 - . C6 E6 - C6 . | D6 - - - A5 - . .', { lead: 'flute', key: 'F', sc: 'major', ps: 'yo' }],
      ['Dusk Throne', 'gfunk', 94, 'Bbmaj7 Am7', 'F5 - - - D5 - Bb4 - | E5 - - - C5 - A4 - | F5 - - - A5 - F5 - | G5 - E5 - C5 - - -', { lead: 'flute', key: 'D', sc: 'minor', ps: 'kumoi' }],
      ['Gold Leaf Funk', 'funk', 98, 'Fm7 Bb7', 'C5 . Eb5 . F5 . Ab5 . | D5 . F5 . Ab5 . F5 . | C5 . Eb5 . F5 . C6 . | Bb5 - Ab5 - F5 - - .', { lead: 'brass', sc: 'dorian', arr: 'B' }],
      ['Castle Dembow', 'dembow', 100, 'Em C Am B', 'B4 . . E5 . . G5 . G5 . . F#5 . . E5 . | C5 . . E5 . . G5 . G5 . . E5 . . C5 . | C5 . . E5 . . A5 . A5 . . G5 . . E5 . | B4 . . D#5 . . F#5 . F#5 . . D#5 . . B4 .', { sc: 'harm' }],
      ['Purple Dusk', 'moomba', 104, 'Cm Ab Fm G', 'G5 - - Eb5 - - C5 - | C6 - - Ab5 - - Eb5 - | C6 - - Ab5 - - F5 - | B5 - - G5 - - D5 -', { lead: 'flute', sc: 'harm' }],
      ['Hilltop Afro', 'afro', 108, 'Bb F Gm Eb', 'D5 . F5 . Bb5 . F5 . | C5 . F5 . A5 . F5 . | D5 . G5 . Bb5 . G5 . | Eb5 . G5 . Bb5 - - .', { dv: 1 }],
      ['Wisdom Crown', 'afroh', 118, 'Dm Bb C Am', 'A5 - - - D6 - - . | F5 - - - D5 - - . | E5 - - - G5 - C6 - | A5 - - - - - . .', { lead: 'flute', sc: 'minor' }],
      ['Indigo Court', 'deep', 120, 'Abmaj7 Gm7 Fm9 Bb13', 'C6 . . Eb6 . . G5 . | D6 . . Bb5 . . G5 . | C6 . . Ab5 . . F5 . | D6 - - . Bb5 . Ab5 .', { key: 'Eb', sc: 'major', ps: 'yo' }],
      ["Shogun's Command", 'piano', 126, 'Gm Eb F Dm', 'G5 . D5 G5 . Bb5 . A5 | . G5 . Eb5 . Bb4 . Eb5 | F5 . C5 F5 . A5 . G5 | . F5 . D5 . A4 . D5', { sc: 'minor' }]],
    sohei: [
      ['Temple Drum', 'bap', 88, 'G G C D_G', 'G4 - A4 - B4 - D5 - | B4 - A4 - G4 - - - | E4 - G4 - A4 - B4 - | A4 - - - G4 - - -', { lead: 'flute' }],
      ['Saffron Steps', 'lofi', 90, 'Gm7 Ebmaj7 Cm7 D7', 'D5 - - - Bb4 - G4 - | G4 - - - Bb4 - D5 - | C5 - - Eb5 G5 - F5 Eb5 | D5 - - - C5 - A4 -', { sc: 'harm' }],
      ['Bell Tower', 'gfunk', 94, 'Bbmaj7 Am7 Gm7 Am7', 'D5 - - - F5 - A5 - | E5 - - - C5 - A4 - | D5 - - - Bb4 - G4 - | A4 - - - C5 - E5 -', { key: 'G', sc: 'dorian', ps: 'minp', arr: 'B' }],
      ["Monks' March", 'matsuri', 98, 'Gm F Eb D', 'G5 . Bb5 . D6 . Bb5 . | F5 . A5 . C6 . A5 . | Eb5 . G5 . Bb5 . G5 . | D5 . F#5 . A5 - - .', { lead: 'flute', sc: 'harm' }],
      ['Prayer Wheel', 'dembow', 100, 'Gm Eb Cm D', 'G4 . . Bb4 . . D5 . D5 . . C5 . . Bb4 . | G4 . . Bb4 . . Eb5 . Eb5 . . D5 . . Bb4 . | G4 . . C5 . . Eb5 . Eb5 . . D5 . . C5 . | F#4 . . A4 . . D5 . D5 . . C5 . . A4 .', { lead: 'pluck', lift: 'bell', sc: 'harm' }],
      ['Saffron Moombah', 'moomba', 106, 'Cm Bb Ab G', 'C6 - - G5 - - Eb5 - | D6 - - Bb5 - - F5 - | C6 - - Ab5 - - Eb5 - | B5 - - G5 - - D5 -', { lead: 'flute', sc: 'harm' }],
      ['Golden Haze', 'amapiano', 112, 'Ebmaj7 Dm7 Cm7 Bbmaj7', 'G5 - - - Bb5 - D6 - | F5 - - - A5 - C6 - | Eb5 - - - G5 - Bb5 - | D5 - - - F5 - - .', { key: 'Bb', sc: 'major', ps: 'majp' }],
      ['Temple Fire', 'afroh', 118, 'Gm Gm Eb F', 'D6 - - - Bb5 - - . | G5 - - A5 - - Bb5 - | Bb5 - - - G5 - - . | A5 - - F5 - - C6 -', { lead: 'flute' }],
      ['Enlightenment', 'deep', 120, 'Cm9 Fm9 Bbm9 Eb9', 'Eb6 . . D6 . . Bb5 . | C6 . . Ab5 . . Eb5 . | Db6 . . Bb5 . . F5 . | G5 - - . Bb5 . Db6 .', { lead: 'bell', key: 'C', sc: 'minor', ps: 'minp' }],
      ['Warrior Monks', 'tech', 126, 'Gm Gm Eb D', 'G5 . Bb5 D6 . C6 . Bb5 | . A5 . G5 . D5 . G5 | G5 . Bb5 . G5 . Eb5 G5 | . F#5 . A5 . D6 . C6', { sc: 'harm' }]],
    warrior: [
      ['War Dance', 'march', 88, 'Dm Dm Dm Am', 'D5 - - - A4 - - - | F5 - - - E5 - - - | D5 - - - A4 - - - | A4 - - - C5 - D5 -', { lead: 'brass', sc: 'minor' }],
      ['Frontline', 'bap', 90, 'Fm Fm Db C', 'C5 - - Ab4 F4 - - . | C5 - - Eb5 F5 - Eb5 C5 | Db5 - - F5 Ab5 - - . | C5 - - E5 G5 - - .', { sc: 'harm', dv: 2 }],
      ['Scorched Earth', 'gfunk', 94, 'Em7 Am7', 'B5 - - - G5 - E5 - | C6 - - - A5 - G5 - | B5 - - - D6 - B5 - | A5 - G5 - E5 - - -', { lead: 'whistle', sc: 'dorian' }],
      ['Iron Will', 'funk', 98, 'Cm7 F7', 'C5 . Eb5 . G5 . Bb5 . | A5 . G5 . F5 . Eb5 . | C5 . Eb5 . G5 . C6 . | A5 - - . F5 - - .', { sc: 'dorian', arr: 'B' }],
      ['Battle Dembow', 'dembow', 100, 'Em Em C D', 'E4 . . G4 . . B4 . B4 . . A4 . . G4 . | E4 . . G4 . . B4 . E5 . . D5 . . B4 . | C5 . . E5 . . G5 . G5 . . E5 . . C5 . | D5 . . F#5 . . A5 . A5 . . F#5 . . D5 .', { sc: 'minor' }],
      ['Charge', 'moomba', 106, 'Bm G Em F#', 'B4 - - D5 - - F#5 - | G5 - - D5 - - B4 - | E5 - - G5 - - B5 - | A#5 - - F#5 - - C#5 -', { sc: 'harm' }],
      ['War Drum Afro', 'afro', 108, 'Am G F G', 'E5 . A5 . C6 . A5 . | D5 . G5 . B5 . G5 . | C5 . F5 . A5 . F5 . | D5 . G5 . B5 - - .', { dv: 1, sc: 'minor' }],
      ['Victory Soca', 'soca', 118, 'E A B E', 'G#4 . B4 . E5 . B4 . | A4 . C#5 . E5 . C#5 . | B4 . D#5 . F#5 . D#5 . | E5 - - . B4 . G#4 .', { lead: 'brass' }],
      ['Burnt Sienna', 'house', 122, 'Fm Fm Db Eb', 'C5 . . C5 . . Ab4 . | . . F4 . Ab4 . C5 . | Db5 . . Db5 . . F5 . | Eb5 - - . G5 . Bb5 .', { sc: 'minor' }],
      ['Against All Odds', 'tech', 128, 'Em Am C B7', 'E5 . G5 B5 . A5 . G5 | . A5 . C6 . B5 . A5 | G5 . E5 G5 . C6 . B5 | . D#5 . F#5 . B5 . A5', { sc: 'harm' }]],
    wokou: [
      ['Sea Shanty', 'bap', 88, 'D G A D', 'D4 . F#4 A4 D5 . A4 F#4 | G4 . B4 D5 G5 . D5 B4 | A4 . C#5 E5 A5 . E5 C#5 | D5 . . A4 D5 . . .', {}],
      ['Harbour Lights', 'jazz', 90, 'Dm9 G13 Cmaj7 A7', 'A5 - . F5 - . D5 E5 | F5 - . D5 - . B4 . | E5 - . G5 B5 - G5 . | C#6 - - - A5 - . .', { lead: 'fiddle', key: 'D', sc: 'dorian', ps: 'minp' }],
      ['Rum Runner', 'gfunk', 94, 'Dm7 C', 'A5 - - - F5 - D5 - | E5 - - - G5 - C6 - | A5 - - - D6 - A5 - | G5 - E5 - C5 - - -', { lead: 'whistle', sc: 'dorian' }],
      ['Pirate Funk', 'funk', 98, 'D7 G7', 'F#5 . A5 . C6 . A5 . | B5 . A5 . F5 . D5 . | F#5 . A5 . C6 . D6 . | B5 - - . G5 - - .', { sc: 'mixo', arr: 'B' }],
      ['Tidal Dembow', 'dembow', 100, 'Dm C Bb A', 'A4 . . D5 . . F5 . F5 . . E5 . . D5 . | G4 . . C5 . . E5 . E5 . . D5 . . C5 . | F4 . . Bb4 . . D5 . D5 . . C5 . . Bb4 . | E4 . . A4 . . C#5 . C#5 . . B4 . . A4 .', { lead: 'pluck', sc: 'harm' }],
      ['Storm Surf', 'moomba', 106, 'Dm Am Bb C', 'D5 - - F5 - - A5 - | C5 - - E5 - - A5 - | D5 - - F5 - - Bb5 - | C6 - - G5 - - E5 -', { lead: 'fiddle', sc: 'minor' }],
      ['Junk Sail', 'afro', 108, 'G D C D', 'B5 . D6 . G6 . D6 . | A5 . D6 . F#6 . D6 . | G5 . C6 . E6 . C6 . | F#5 . A5 . D6 - - .', { lead: 'whistle' }],
      ["Raiders' Soca", 'soca', 116, 'A E F#m D', 'C#5 . E5 . A5 . E5 . | B4 . E5 . G#5 . E5 . | C#5 . F#5 . A5 . F#5 . | D5 . F#5 . A5 - - .', { sc: 'major' }],
      ['Lighthouse', 'disco', 120, 'Dm Gm C F', 'A5 - - D6 - - F6 - | G5 - - Bb5 - - D6 - | G5 - - C6 - - E6 - | F6 - - - C6 - A5 -', { lead: 'fiddle', sc: 'minor' }],
      ['High Tide', 'house', 126, 'Dm F C G', 'A4 . D5 . F5 E5 . D5 | . C5 . F5 . A5 . F5 | G4 . C5 E5 . D5 . C5 | . B4 . D5 . G5 F5 D5', {}]],
    yamabushi: [
      ['Spirit Dance', 'lofi', 88, 'Em7 Bm7 Am7 Em7', 'E5 - G5 - A5 - B5 - | D6 - B5 - A5 - - - | G5 - A5 - E5 - D5 - | E5 - - - - - - -', { lead: 'flute' }],
      ['Misty Peaks', 'bap', 90, 'Bm7 Gmaj7 Em7 F#7', 'F#5 - - - D5 - B4 - | B4 - - - D5 - F#5 - | G5 - - - E5 - B4 - | A#4 - - - C#5 - E5 -', { sc: 'harm' }],
      ['Waterfall', 'jazz', 92, 'Em9 A13 Dmaj7 Bm7', 'F#5 - . B5 - . G5 . | G5 - . E5 - . C#5 . | F#5 - . A5 C#6 - A5 . | B5 - - - F#5 - . .', { lead: 'flute', key: 'D', sc: 'major', ps: 'yo', arr: 'B' }],
      ['Cliff Walk', 'gfunk', 96, 'Am7 Em7', 'E5 - - - G5 - A5 - | B5 - - - G5 - E5 - | C6 - - - A5 - E5 - | D5 - B4 - G4 - - -', { sc: 'minor' }],
      ['Mountain Dembow', 'dembow', 100, 'Bm A G F#m', 'F#5 . . B5 . . D6 . D6 . . C#6 . . B5 . | E5 . . A5 . . C#6 . C#6 . . B5 . . A5 . | D5 . . G5 . . B5 . B5 . . A5 . . G5 . | C#5 . . F#5 . . A5 . A5 . . G#5 . . F#5 .', { lead: 'kalimba', sc: 'minor' }],
      ['Spirit Moombah', 'moomba', 104, 'Em Cmaj7 G D', 'B5 - - G5 - - E5 - | E6 - - B5 - - G5 - | D6 - - B5 - - G5 - | F#5 - - A5 - - D6 -', { lead: 'flute', sc: 'minor' }],
      ['Mystic Amapiano', 'amapiano', 112, 'Am9 Fmaj7 Dm9 E7', 'C6 - - B5 - - A5 - | A5 - - G5 - - E5 - | F5 - - E5 - - D5 - | E5 - - - G#5 - - .', { sc: 'harm' }],
      ['Blue Flame', 'afroh', 118, 'Em Em C D', 'B5 - - - E6 - - . | G5 - - A5 - - B5 - | C6 - - - G5 - - . | A5 - - F#5 - - D5 -', { lead: 'flute', sc: 'minor' }],
      ['Above the Clouds', 'deep', 120, 'Gmaj7 F#m7 Em9 A13', 'B4 . . D5 . . F#5 . | A4 . . C#5 . . E5 . | G4 . . B4 . . D5 . | C#5 - - . E5 . G5 .', { lead: 'kalimba', key: 'D', sc: 'major', ps: 'yo' }],
      ['Spiral Energy', 'house', 126, 'Bm G A F#m', 'F#5 . B5 . . D6 C#6 B5 | . B5 . G5 . D5 . G5 | E5 . A5 . . C#6 B5 A5 | . C#5 . F#5 . A5 G#5 F#5', { sc: 'minor' }]],
    'saints-la': [
      ['Lowrider Funk', 'gfunk', 88, 'C7 F7', '. . . E5 . . G5 . | . . A5 . G5 . . . | . . . E5 . . G5 Bb5 | A5 - - . G5 . F5 .', { lead: 'brass', sc: 'mixo' }],
      ['Boulevard', 'bap', 90, 'Fm9 Bb9 Ebmaj7 Cm7', 'C6 - . Ab5 - . F5 G5 | Ab5 - . F5 - . D5 . | G5 - . Bb5 D6 - Bb5 . | C6 - - - G5 - . .', { lead: 'whistle', key: 'Eb', sc: 'major', ps: 'majp', dv: 1 }],
      ['Westside Whine', 'jazz', 94, 'Gm7 C9', 'D6 - - - Bb5 - G5 - | E6 - - - C6 - Bb5 - | D6 - - - F6 - D6 - | C6 - Bb5 - G5 - - -', { sc: 'dorian', dv: 1 }],
      ['Sunset Strip', 'funk', 100, 'D9 G9', 'F#5 . A5 . C6 . A5 . | B5 . A5 . F5 . D5 . | F#5 . A5 . D6 . C6 . | B5 - - . G5 - - .', { lead: 'brass', sc: 'mixo', arr: 'B' }],
      ['Saints Dembow', 'dembow', 100, 'Am Dm G C', 'C5 . . E5 . . A5 . A5 . . G5 . . E5 . | D5 . . F5 . . A5 . A5 . . F5 . . D5 . | D5 . . G5 . . B5 . B5 . . A5 . . G5 . | E5 . . G5 . . C6 . C6 . . G5 . . E5 .', { lead: 'synpluck', sc: 'minor' }],
      ['Halo Moombah', 'moomba', 106, 'Fm Eb Db C', 'C5 - - F5 - - Ab5 - | Bb5 - - G5 - - Eb5 - | Ab5 - - F5 - - Db5 - | C5 - - E5 - - G5 -', { lead: 'brass', sc: 'harm' }],
      ['Venice Afro', 'afro', 108, 'Eb Cm Ab Bb', 'G5 . Bb5 . Eb6 . Bb5 . | G5 . C6 . Eb6 . C6 . | Ab5 . C6 . Eb6 . C6 . | F5 . Bb5 . D6 - - .', { lead: 'marimba', dv: 1, sc: 'major' }],
      ['Block Party', 'disco', 118, 'Dm7 G7 Cmaj7 A7', 'A5 - - F5 - - D5 - | B5 - - G5 - - F5 - | E5 - - G5 - - B5 - | C#6 - - A5 - - E5 -', { lead: 'brass', key: 'C', sc: 'major', ps: 'majp' }],
      ['City Lights', 'house', 122, 'Fmaj7 Em7 Am7 Am7', 'A5 . . C6 . . E6 . | G5 . . B5 . . E6 . | E6 . . C6 . . A5 . | . . G5 . A5 . . .', { lead: 'whistle', key: 'A', sc: 'minor', ps: 'minp' }],
      ['Saint of the Block', 'piano', 126, 'Gm Eb Bb F', 'D6 . Bb5 G5 . Bb5 . D6 | . Eb6 . D6 . Bb5 . G5 | F5 . Bb5 D6 . C6 . Bb5 | . A5 . C6 . F6 C6 A5', { sc: 'minor' }]] };

  // ── the composer: a song's every note, in bars of 16 steps: { b, s, i (voice), v, m (MIDI notes), l (steps), r (role: K
  // kick, S snare / clap, T drum, H hat, F effect, B bass, C chord stab, P held chord, M hook, R riff), g (glides from) } ──
  const SONG_CACHE = {};
  const pat = (list, i) => Array.isArray(list) ? list[i % list.length] : list;
  function compose(vid, k) {
    const id = vid + ':' + k; if (SONG_CACHE[id]) return SONG_CACHE[id];
    const P = PAL[vid], [title, gid, bpm, hc, hook, o = {}] = SONGS[vid][k], G = GROOVES[gid], kit = G.kits[(o.dv || 0) % G.kits.length], fam = G.fam, house = fam === 'house';
    const hp = prog(hc), vp = o.v ? prog(o.v) : hp, c0 = hp[0][0].c, key = o.key ? pcOf(o.key) : c0.r, mode = P[c0.minor ? 'min' : 'maj'];
    const S = { scale: SCALES[o.sc || mode[0]].map(i => (key + i) % 12), ps: SCALES[o.ps || mode[1]].map(i => (key + i) % 12) };
    const nb = bpm < 92 ? 30 : 32, plan = ARR[o.arr || G.arr || 'A'][nb];
    const sec = [], si = [], sl = [], sn = []; { let b = 0; const seen = {}; for (const [name, n] of plan) { seen[name] = (seen[name] || 0) + 1; for (let i = 0; i < n; i++, b++) { sec[b] = name; si[b] = i; sl[b] = n; sn[b] = seen[name]; } } }
    const ev = [], rnd = lcg(hash(id)), SN = G.sn, KK = G.kk;
    const lead = o.lead || P.lead, riffI = o.ri || P.riff, bassI = o.bass || G.bass, k0 = o.keys || P.keys[gid] || P.keys[fam] || P.keys._ || G.keys, keys = k0 === lead ? P.keys2 || 'pad' : k0;   // chords never on the lead's own instrument
    const add = (b, s, i, v, m, l, r, g) => ev.push({ b, s, i, v, m, l, r: r || ROLE[i] || 'T', g });
    // the chords under a bar (the hook's chords in the hook and outro, the verse's elsewhere; the outro rests on the tonic)
    const barCh = b => sec[b] === 'outro' ? hp[0] : (sec[b] === 'hook' ? hp : vp)[si[b] % (sec[b] === 'hook' ? hp : vp).length];
    // drums, bar by bar
    const parts = [];
    for (let b = 0; b < nb; b++) {
      const name = sec[b], i = si[b], d = {};
      const main = () => { for (const [p, l] of Object.entries(kit)) d[p] = pat(l, i); };
      if (name === 'count') { if (i === 0) { const h = Object.keys(kit).find(p => ROLE[p] === 'H') || 'hat'; d[KK] = 'X.......X.......'; d[h] = pat(kit[h] || ['x.x.x.x.x.x.x.x.'], 0); } else main(); d[P.count || 'rim'] = i ? 'X...x...x...xxxx' : 'X...x...x...x...'; }
      else if (name === 'build') { d[KK] = i < sl[b] - 1 ? 'X...X...X...X...' : 'X...X...........'; d[SN] = i < sl[b] - 1 ? 'x...x...x...x...' : 'x.x.x.x.xxxxxxxx'; if (kit.shaker) d.shaker = pat(kit.shaker, i); }
      else if (name === 'outro' && i === sl[b] - 1) { /* the final hit, below */ }
      else { main(); const L = P.layers?.[name]; if (L) for (const [p, l] of Object.entries(L)) if (!(p in d)) d[p] = pat(l, i);   // a village's drums join the groove's (never replace them)
        if (name === 'intro' && house) delete d[SN];
        if (name === 'break' && house) delete d[KK];
        if (name === 'break' && fam === 'latin') { delete d[KK]; delete d[SN]; } }
      // a fill closes each section (the whole bar) and each 4-bar phrase inside one (its last beat)
      if ((name === 'intro' || name === 'verse' || name === 'hook' || name === 'break') && sl[b] >= 2) {
        const end = i === sl[b] - 1, phrase = i % 4 === 3 && !end;
        if ((end && sec[b + 1] !== 'build') || phrase) { const F = FILLS[G.fill], f = F[(sn[b] + (b >> 2)) % F.length];
          for (let [p, l] of Object.entries(f)) { p = p === 'S' ? SN : p === 'K' ? KK : p; if ((name === 'break' && p === KK && house) || (name === 'break' && fam === 'latin' && (p === KK || p === SN))) continue; d[p] = end ? l : (d[p] || '................').slice(0, 12) + l.slice(12); } } }
      parts[b] = d;
      for (const [p, l] of Object.entries(d)) for (let s = 0; s < 16; s++) { const ch = l[s]; if (ch !== 'X' && ch !== 'x' && ch !== 'o') continue;
        let v = ch === 'X' ? 1 : ch === 'x' ? .75 : .42; if (name === 'build' && p === SN) v = .45 + .55 * (i * 16 + s) / (sl[b] * 16); if (ROLE[p] === 'H') v *= .88 + rnd() * .24; add(b, s, p, Math.min(1, v), null, 1); }
    }
    // crashes, gongs, risers and the drop
    for (let b = 2; b < nb; b++) { if (si[b]) continue; const name = sec[b];
      if (name === 'intro' || name === 'verse' || name === 'hook' || (name === 'outro' && sl[b] > 1)) add(b, 0, 'crash', 1, null, 16);
      if (name === 'hook' && P.gong) add(b, 0, 'gong', .8, null, 16);
      if (name === 'hook' && P.whoosh && b > 2) add(b - 1, 12, 'whoosh', 1, null, 4);
      if (name === 'build') add(b, 0, 'riser', 1, null, sl[b] * 16);
      if (sec[b - 1] === 'build') add(b, 0, 'impact', 1, null, 16); }
    // the bass: a template bar, or a note on each kick held to the next (an 808 slides on the long jumps)
    const BLO = { b808: 31, sub: 31, log: 40 }, blo = BLO[bassI] || 33, reg = p => blo + ((p - blo) % 12 + 12) % 12;
    const bdeg = (c, ch, next) => { const r = reg(c.r);
      switch (ch) { case 'R': return reg(c.bass); case '5': return r + (c.iv.find(i => i >= 6 && i <= 8) ?? 7); case '8': return r + 12; case '3': return r + (c.iv.find(i => i >= 2 && i <= 5) ?? 4);
        case '7': return r + (c.iv.find(i => i >= 9 && i <= 11) ?? 10); case '4': return r + 5; case '6': return r + 9; case 'A': { const n = reg(next.r); return n === r ? r + 7 : n > r ? n - 1 : n + 1; } } return r; };
    for (let b = 0; b < nb; b++) {
      const name = sec[b]; if (name === 'count' || name === 'build' || (name === 'break' && (house || fam === 'latin')) || (name === 'intro' && house) || (name === 'outro' && si[b] === sl[b] - 1)) continue;
      const bar = barCh(b), next = b + 1 < nb && sec[b + 1] !== 'count' ? barCh(b + 1)[0].c : bar[0].c;
      let t = pat(o.bt || G.bt, si[b]);
      if (t === 'kick') { const kp = parts[b][KK] || 'X.......X.......', at = [...kp].map((ch, s) => ch === 'X' || ch === 'x' ? s : -1).filter(s => s >= 0), ds = (G.bdeg || 'R').split(' ');
        t = [...Array(16)].map((_, s) => at.includes(s) ? ds[at.indexOf(s) % ds.length] : at.some(a => a < s) ? '-' : '.').join('');
        if (next.r !== chordAt(bar, 15).r && !at.some(a => a >= 12)) t = t.slice(0, 14) + 'A-'; }
      let last = null;
      for (let s = 0; s < 16; s++) { const ch = t[s]; if (ch === '.' || ch === '-') continue; let n = 1; while (s + n < 16 && t[s + n] === '-') n++;
        const m = bdeg(chordAt(bar, s), ch, next), g = bassI === 'b808' && last && last.end >= s && Math.abs(last.m - m) >= 7 ? last.m : 0;
        add(b, s, bassI, 1, [m], n, 'B', g); last = { m, end: s + n }; }
    }
    // the chords: voiced near the last chord, in the comp's rhythm (a held chord re-strikes where the harmony moves)
    const [klo, khi] = KREG[keys] || KREG._; let voiced = null;
    const voicing = c => { let pcs = c.pcs.slice(); if (pcs.length >= 5) pcs = pcs.filter((p, j) => j !== 2); if (pcs.length > 4) pcs = pcs.slice(0, 4);
      let best = null, bs = 1e9;
      for (let rot = 0; rot < pcs.length; rot++) { let base = klo; while (base % 12 !== pcs[rot]) base++; const v = [base];
        for (let j = 1; j < pcs.length; j++) { const p = pcs[(rot + j) % pcs.length]; let m = v[j - 1] + 1; while (m % 12 !== p) m++; v.push(m); }
        if (v[v.length - 1] > khi) continue;
        const sc = voiced ? v.reduce((a, m, j) => a + Math.abs(m - (voiced[j] ?? voiced[voiced.length - 1])), 0) : Math.abs((v[0] + v[v.length - 1]) / 2 - (klo + khi) / 2); if (sc < bs) { bs = sc; best = v; } }
      return voiced = best || pcs.map(p => klo + ((p - klo) % 12 + 12) % 12).sort((a, b) => a - b); };
    const sustain = SUSTAIN.has(keys);
    for (let b = 0; b < nb; b++) {
      const name = sec[b]; if (name === 'count' || (name === 'outro' && si[b] === sl[b] - 1) || (name === 'break' && !house && fam !== 'latin')) continue;
      const bar = barCh(b), cuts = bar.map(x => x.s), r = name === 'build' || sustain ? (house && !sustain && name !== 'build' ? 'X-------X-------' : 'X---------------') : pat(o.comp || G.comp, si[b]);
      for (let s = 0; s < 16; s++) { const ch = r[s]; if (ch !== 'X' && ch !== 'x') continue; let n = 1; while (s + n < 16 && r[s + n] === '-' && !cuts.includes(s + n)) n++;
        add(b, s, keys, ch === 'X' ? 1 : .8, voicing(chordAt(bar, s)), n, sustain ? 'P' : 'C');
        if (s + n < 16 && r[s + n] === '-') { let m = 1; while (s + n + m < 16 && r[s + n + m] === '-' && !cuts.includes(s + n + m)) m++; add(b, s + n, keys, .8, voicing(chordAt(bar, s + n)), m, sustain ? 'P' : 'C'); } }
    }
    // melodies: the hook in each hook section, the riff in the verse (and a latin or house break); a line's bars repeat
    // from the section's first bar, each repeat starting again near its anchor note
    const line = (b0, n, text, inst, role, anchor, perBar) => {
      const L = text.split('|').map(x => x.trim().split(/\s+/)), [lo, hi] = RANGE[inst] || [55, 84], a0 = midi(anchor || '') ?? Math.round((lo + hi) / 2);
      for (let r = 0; r < n; r += L.length) {
        let prev = a0, last = null; const toks = [];
        for (let j = 0; j < L.length && r + j < n; j++) { const row = L[j], st = row.length > 8 ? 1 : 2; row.forEach((tk, q) => toks.push([j * 16 + q * st, tk])); }
        const span = Math.min(L.length, n - r) * 16;
        for (let q = 0; q < toks.length; q++) { const [s0, tk] = toks[q]; if (tk === '.' || tk === '-') continue; let e = q + 1; while (e < toks.length && toks[e][1] === '-') e++;
          if (perBar && (s0 & 15) === 0) prev = a0;
          const end = e < toks.length ? toks[e][0] : span, b = b0 + r + (s0 >> 4), s = s0 & 15, c = chordAt(barCh(b), s);
          const ms = tk.split('+').map(t => (prev = note(t, c, prev, S, lo, hi)));
          add(b, s, inst, 1, ms, end - s0, role, last && last.end >= s0 && SLIDE.has(inst) ? last.m : 0); last = { m: ms[ms.length - 1], end }; }
      }
    };
    for (let b = 0; b < nb; b++) { if (si[b]) continue; const name = sec[b];
      if (name === 'hook') line(b, sl[b], hook, lead, 'M', o.o);
      const riff = o.r || G.riff;
      if (riff && (name === 'verse' || (name === 'break' && (house || fam === 'latin')))) line(b, sl[b], riff, riffI, 'R', o.ro, true); }
    // the lift: the hooks after the first are doubled by another instrument, an octave off where its range needs it
    const hookEv = ev.filter(e => e.r === 'M'), lift = o.lift || P.lift;
    if (lift && lift !== lead) { const ms = hookEv.map(e => e.m[0]).sort((a, b) => a - b), med = ms[ms.length >> 1] || 72, [llo, lhi] = RANGE[lift] || [55, 84];
      const sh = 12 * Math.round(((llo + lhi) / 2 - med) / 12);
      const fit = m => { while (m < llo) m += 12; while (m > lhi) m -= 12; return m; };
      for (const e of hookEv) if (sn[e.b] > 1) add(e.b, e.s, lift, .7, e.m.map(m => fit(m + sh)), e.l, 'M'); }
    // the final hit: a crash (and the gong), the kick, the tonic in the bass, the chords and the lead
    const fb = nb - 1, fc = hp[0][0].c, fm = hookEv.map(e => e.m[0]).sort((a, b) => a - b), med = fm[fm.length >> 1] || 72;
    add(fb, 0, 'crash', 1, null, 16); if (P.gong) add(fb, 0, 'gong', 1, null, 16); add(fb, 0, KK, 1, null, 1, 'K');
    add(fb, 0, bassI, 1, [reg(fc.r)], 12, 'B'); add(fb, 0, keys, 1, voicing(fc), 16, sustain ? 'P' : 'C');
    add(fb, 0, lead, 1, [place(fc.r, med, '', med)], 8, 'M');
    ev.sort((x, y) => x.b - y.b || x.s - y.s);
    // where an arrow may land: per bar, per step, the onsets there (an arrow needs a hit you can hear: no hats, pads,
    // effects or ghost notes) and the pitch it follows (the hook's, else the riff's, bass or chord)
    const cand = Array.from({ length: nb }, () => []);
    for (const e of ev) { if (!ONSET.has(e.r) || e.v < .6 || QUIET.has(e.i)) continue; const c = cand[e.b][e.s] || (cand[e.b][e.s] = { r: new Set(), p: null, pr: 9, v: 0 });
      c.r.add(e.r); c.v = Math.max(c.v, e.v); const rank = 'MRBC'.indexOf(e.r); if (e.m && rank >= 0 && rank < c.pr) { c.pr = rank; c.p = e.m[e.m.length - 1]; } }
    return SONG_CACHE[id] = { vid, k, title, groove: G.name, gid, bpm, swing: o.sw ?? G.sw ?? 0, sw8: o.sw8 ?? G.sw8 ?? 0, bars: nb, sec, si, sl, ev, cand, mid: med, pump: house, duck: new Set([keys]) };
  }

  // when step s of bar b sounds, seconds after the count-in's first beat: bars of 16 steps (sixteenths); a swung song
  // stretches each beat's first eighth (sw8) and pushes its odd sixteenths late (sw); the beats stay on the grid
  const clockOf = song => { const beat = 60 / song.bpm, half = beat / 2, step = beat / 4, w = song.sw8 || 0, sw = song.swing || 0;
    return (b, s) => { const p = s % 4; return (b * 4 + (s - p) / 4) * beat + (p < 2 ? p / 2 * (1 + w) * half : (1 + w) * half + (p - 2) / 2 * (1 - w) * half) + (s % 2 ? sw * step : 0); }; };
  // every note of a song on the audio clock (t0 = the count-in's first beat): [{ t, i, f: [Hz..], len, v, r, gl }]
  function score(song, t0) {
    const step = 15 / song.bpm, at = clockOf(song);
    return song.ev.map(e => ({ t: t0 + at(e.b, e.s), i: e.i, f: e.m ? e.m.map(fq) : null, len: e.l * step, v: e.v, r: e.r, gl: e.g ? fq(e.g) : 0 })).sort((a, b) => a.t - b.t);
  }
  // the arrows of song k: [{ t, d }]. Each bar takes its strongest onsets up to its share (quarters on the first songs,
  // then off-beat eighths, a few sixteenth steps on songs 9 and 10; more in the hook, fewer in the intro and break, the
  // build on its beats), so a repeated bar gets the same arrows; never more than 5 in a second or 9 in two. Directions follow the
  // music: in each 2-bar phrase the notes (hook, riff, bass, chords) from its lowest to its highest pitch run down, left,
  // right, up; a kick is down (left in the 2nd / 4th bar of a phrase), a snare up (right); never the same arrow twice
  // within an eighth, nor four in a row
  const RS = { hook: { M: 5, S: 3, K: 3, T: 2, B: 1, C: 1, R: 0 }, verse: { S: 3, K: 3, R: 2, B: 2, T: 2, C: 1, M: 1 }, _: { K: 3, S: 3, C: 2, T: 2, B: 1, R: 1, M: 1 } };
  const ORDER = { hook: 'MSKTBCR', verse: 'SKRBTCM', _: 'KSCTBRM' };
  function chart(song, k, t0) {
    const T = TIERS[k], beat = 60 / song.bpm, clock = clockOf(song), at = (b, s) => t0 + clock(b, s);
    const chosen = new Map(), odd = {};
    for (let b = 2; b < song.bars - 1; b++) {
      const name = song.sec[b], ph = song.si[b] % 4, slots = song.cand[b], rs = RS[name] || RS._;
      const n = T.per[ph] + (name === 'hook' ? (k >= 4 ? 1 : 0) : name === 'verse' ? 0 : -1); if (n <= 0) continue;
      const opts = [];
      for (let s = 0; s < 16; s++) { const c = slots[s]; if (!c) continue; const g = s % 4 === 0 ? 4 : s % 2 === 0 ? 2 : 1;
        if ((g === 2 && !T.e8) || (g === 1 && !T.s16) || (g < 4 && name === 'build')) continue;   // a build's snare roll: arrows on its beats
        opts.push({ b, s, c, pr: (g === 4 ? 10 + (s === 0 ? 2 : 0) : g === 2 ? 5 + T.sync : 1.5 + T.sync) + Math.max(...[...c.r].map(r => rs[r] ?? 0)) + c.v }); }
      opts.sort((x, y) => y.pr - x.pr || x.s - y.s);
      let got = 0;
      for (const op of opts) { if (got >= n) break; const gi = b * 16 + op.s, w = gi >> 6, l = chosen.has(gi - 1), r = chosen.has(gi + 1);
        if (l && r) continue;                                                       // no three a sixteenth apart
        if (l || r) { const other = l ? gi - 1 : gi + 1; if (chosen.has(other + (l ? -1 : 1))) continue; }
        if (op.s % 2 && (odd[w] || 0) >= T.s16) continue;
        if ((l || r) && !T.s16) continue;
        if (op.s % 2) odd[w] = (odd[w] || 0) + 1;
        chosen.set(gi, op); got++; }
    }
    const list = [...chosen.values()].sort((x, y) => x.b - y.b || x.s - y.s); list.forEach(a => { a.t = at(a.b, a.s); });
    for (let guard = 0; guard < 2000; guard++) { let bad = null;
      for (const [win, max] of [[1, 5], [2, 9]]) { for (let i = 0, j = 0; i < list.length && !bad; i++) { while (list[i].t - list[j].t > win + 1e-6) j++; if (i - j + 1 > max) bad = [j, i]; } if (bad) break; }
      if (!bad) break; let w = bad[0]; for (let x = bad[0]; x <= bad[1]; x++) if (list[x].pr < list[w].pr) w = x; list.splice(w, 1); }
    const fb = song.bars - 1; list.push({ b: fb, s: 0, c: song.cand[fb][0], t: at(fb, 0), fin: true });
    const out = [], e8 = beat / 2, roleOf = a => { const c = a.c || { r: new Set(['K']) }, ord = ORDER[song.sec[a.b]] || ORDER._; return [...ord].find(r => c.r.has(r)) || 'K'; };
    const tune = a => 'MRBC'.includes(roleOf(a)) && a.c?.p != null, phrase = a => a.b - song.si[a.b] % 2, pitches = new Map();
    for (const a of list) if (!a.fin && tune(a)) { const g = phrase(a); if (!pitches.has(g)) pitches.set(g, new Set()); pitches.get(g).add(a.c.p); }
    for (const [g, set] of pitches) pitches.set(g, [...set].sort((x, y) => x - y));
    let pd = -1, pt = -9, run = 0, last = null;                               // last: the previous note's { g phrase, p pitch, bi band }
    for (const a of list) {
      const role = roleOf(a), ph = song.si[a.b] % 4;
      let d;
      if (a.fin) d = 1;
      else if (tune(a)) { const g = phrase(a), ps = pitches.get(g), f = ps.length > 1 ? ps.indexOf(a.c.p) / (ps.length - 1) : .5; let bi = f < .25 ? 0 : f < .5 ? 1 : f < .75 ? 2 : 3;
        if (last && last.g === g && last.bi === bi && a.c.p !== last.p) bi = Math.max(0, Math.min(3, bi + (a.c.p > last.p ? 1 : -1)));   // a step up or down still moves the arrow
        last = { g, p: a.c.p, bi }; d = [3, 0, 2, 1][bi]; }
      else if (role === 'K') d = ph % 2 ? 0 : 3;
      else if (role === 'S') d = ph % 2 ? 2 : 1;
      else d = (a.s >> 1) % 2 ? 2 : 0;
      if (d === pd && a.t - pt < e8 - 1e-3) d = (d + 1) % 4;
      run = d === pd ? run + 1 : 0; if (run >= 3) { d = (d + 2) % 4; run = 0; }
      pd = d; pt = a.t; out.push({ t: a.t, d });
    }
    return out;
  }

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const HEAT = k => `hsl(${170 - 18 * k},72%,${56 - k}%)`;               // the difficulty meter: teal (song 1) to red (song 10)
  const G = {
    title: 'Dance-off', moves: true,
    start(ctx) {
      const B = ctx.B, H = ctx.HUD, scene = ctx.scene, def = ctx.def, vid = SONGS[def.song] ? def.song : 'hub', list = SONGS[vid].map((_, k) => compose(vid, k));
      let song = list[0];
      const store = (ctx.util || window.RebelGames.util).levelStore(def.id || 'dance-' + vid);
      // def.packMoves: real dances from the Rebel's games pack (dance_wave / tut / house / gangnam) when it has them;
      // they loop and an arrow switches to its dance (the same one keeps going). Else def.moves, one move per arrow.
      const DANCES = !!(def.packMoves && def.packMoves.every(m => ctx.player.has?.(m)));
      const moves = DANCES ? def.packMoves : def.moves || ['cartwheel', 'jump', 'front_flip', 'backflip'];
      let dancing = null;
      const floorC = def.floor || [.95, .45, .7];
      const st = { phase: 'pick', k: 0, song: null, lv: null, notes: [], ev: [], evi: 0, hits: 0, perfect: 0, combo: 0, maxCombo: 0, pts: 0, t0: 0, end: 0, judge: '', judgeAt: 0, beatAt: 0, car: null, carT: 0, carMove: -1, pxs: 190 };
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
      // the lane, the pads and the song choice in the game HUD
      const hud = document.getElementById('gameHud');
      const box = document.createElement('div');
      box.style.cssText = 'position:absolute;left:50%;bottom:58px;transform:translateX(-50%);width:min(600px,94vw);pointer-events:none;font:600 14px/1.3 system-ui,sans-serif;color:#f3e6c4;text-align:center';
      box.innerHTML = `<div class="dn-judge" style="font:800 26px/1 Georgia,serif;color:#ffd877;text-shadow:0 2px 0 #000,0 0 12px rgba(255,200,90,.6);height:30px"></div>`
        + `<div class="dn-lane" style="position:relative;height:74px;margin-top:6px;border-radius:14px;background:rgba(10,13,22,.82);border:1px solid rgba(216,179,92,.55);overflow:hidden">`
        + `<div style="position:absolute;left:9%;top:50%;width:58px;height:58px;margin:-29px 0 0 -29px;border-radius:50%;border:3px solid rgba(255,233,176,.9);box-shadow:0 0 14px rgba(255,210,120,.6)"></div><div class="dn-notes"></div></div>`
        + `<div class="dn-pads" style="display:flex;justify-content:center;gap:10px;margin-top:10px;pointer-events:auto">${ARROWS.map((a, i) => `<button type="button" data-d="${i}" style="width:54px;height:46px;border-radius:10px;border:1px solid ${COLORS[i]};background:rgba(10,13,22,.85);color:${COLORS[i]};font:800 22px system-ui;cursor:pointer;touch-action:manipulation">${a}</button>`).join('')}</div>`;
      const lane = box.querySelector('.dn-notes'), judgeEl = box.querySelector('.dn-judge');
      box.querySelectorAll('.dn-pads button').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); press(+b.dataset.d); }));
      // the picker: the village's ten songs (title, tempo, groove, a difficulty meter, the best moves landed), each opened
      // by clearing the one before it (?levels=open opens them all); keys 1-9 and 0 pick one
      const pick = document.createElement('div'); let counts = null;
      function showPick() {
        const open = store.open(list.length), cleared = store.get(), best = loadBest()[def.id] || {}, wide = innerWidth >= 600;
        if (!counts) counts = list.map((s, k) => chart(s, k, 0).length);
        pick.style.cssText = `position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(${wide ? 680 : 420}px,94vw);max-height:88vh;overflow:auto;background:rgba(16,12,6,.95);border:1px solid rgba(240,200,80,.6);border-radius:14px;padding:14px;text-align:center;pointer-events:auto;font:14px/1.35 system-ui,sans-serif;color:#eee`;
        const btn = (s, k) => { const on = k <= open, ok = k < cleared, b = best['s' + (k + 1)];
          const meter = `<span style="display:inline-flex;gap:2px;vertical-align:middle">${Array.from({ length: 10 }, (_, i) => `<i style="display:block;width:4px;height:9px;border-radius:1px;background:${i <= k ? HEAT(k) : 'rgba(255,255,255,.14)'}"></i>`).join('')}</span>`;
          return `<button type="button" data-k="${k}" ${on ? '' : 'disabled'} style="text-align:left;padding:7px 8px;border-radius:10px;border:1px solid ${on ? '#f3c84a' : '#444'};background:${ok ? 'rgba(216,179,92,.2)' : 'rgba(255,255,255,.04)'};color:${on ? '#fff' : '#777'};cursor:${on ? 'pointer' : 'default'};font:600 12px/1.25 system-ui,sans-serif;min-width:0">`
            + `<div style="display:flex;justify-content:space-between;align-items:center;gap:4px"><b style="font-size:15px">${on ? k + 1 : '\u{1F512}'}${ok ? ' ✓' : ''}</b>${meter}</div>`
            + `<div style="margin-top:4px;font-weight:700;color:${on ? '#ffe9b0' : '#888'};min-height:${wide ? 30 : 15}px">${esc(s.title)}</div>`
            + `<div style="font-weight:500;color:${on ? '#d8c89a' : '#666'}">${esc(s.groove)}</div>`
            + `<div style="font-weight:500;color:${on ? '#d8c89a' : '#666'}">${s.bpm} BPM</div>`
            + `<div style="font-weight:500;color:#9fd8c8">${b ? `best ${b} / ${counts[k]}` : `${counts[k]} moves`}</div></button>`; };
        pick.innerHTML = `<div style="font:800 13px/1.2 system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#f3c84a;margin-bottom:5px">${esc(def.title || 'Dance-off')}</div>`
          + `<div style="margin-bottom:10px;color:#bbb;font-size:13px">Ten songs from normal to hard: clear one to open the next. Press each arrow as it reaches the ring.</div>`
          + `<div style="display:grid;grid-template-columns:repeat(${wide ? 5 : 2},minmax(0,1fr));gap:7px">${list.map(btn).join('')}</div>`
          + `<div style="margin-top:9px;font-size:12px;color:#998">Keys 1-9 and 0 pick a song</div>`;
        pick.querySelectorAll('button[data-k]').forEach(b => b.onclick = e => { e.stopPropagation(); b.blur(); begin(+b.dataset.k); });
        hud.append(pick);
      }
      showPick();
      H.title(def.title || 'Dance-off'); H.score(''); H.info(`${list.length} songs`); H.hint('');
      let mix = null, band = null, finT = 0;
      function begin(k) {
        if (st.phase !== 'pick' || !list[k]) return; pick.remove();
        song = list[k]; st.k = k; st.song = song; st.lv = TIERS[k];
        mix = ctx.audio(); band = mix && desk(mix.ctx, mix.out, song);
        const now = mix ? mix.ctx.currentTime : performance.now() / 1000;
        st.t0 = now + .35; st.lat = mix?.latency || 0; const at = clockOf(song); st.at = (b, s) => st.t0 + at(b, s);   // st.at(bar, step): when a step sounds
        st.ev = score(song, st.t0); st.evi = 0;
        hud.append(box);
        // the lane: arrows at least an eighth note's width apart (they run faster on fast songs); a sixteenth pair sits
        // a little above and below the line so both show
        const w = box.querySelector('.dn-lane').clientWidth || 560, sz = Math.max(34, Math.min(46, Math.round(w / 12.5))), e8 = 30 / song.bpm;
        st.pxs = Math.max(w * .34, (sz + 8) / e8);
        const arrows = chart(song, k, st.t0), dy = arrows.map(() => 0);
        for (let i = 1; i < arrows.length; i++) if (arrows[i].t - arrows[i - 1].t < e8 * .75) { const o = Math.round(sz * .24); dy[i - 1] = -o; dy[i] = o; }
        st.notes = arrows.map(({ t, d }, i) => { const el = document.createElement('div'); el.textContent = ARROWS[d];
          el.style.cssText = `position:absolute;top:calc(50% + ${dy[i]}px);width:${sz}px;height:${sz}px;margin:${-sz / 2}px 0 0 ${-sz / 2}px;border-radius:10px;display:flex;align-items:center;justify-content:center;font:800 ${Math.round(sz * .56)}px system-ui;color:#10131a;background:${COLORS[d]};box-shadow:0 0 10px ${COLORS[d]}`;
          lane.appendChild(el); return { t, d, el, judged: false }; });
        st.need = Math.ceil(st.notes.length * st.lv.need); st.end = st.notes[st.notes.length - 1].t + 1.2;
        st.phase = 'play';
        H.info(`${song.title} · ${song.bpm} BPM`); H.hint(innerWidth < 600 ? 'Tap the pads in time' : 'Arrow keys, <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> or the pads · press as the arrow reaches the ring');
        upd();
      }
      const clock = () => (st.fakeNow != null ? st.fakeNow : mix ? mix.ctx.currentTime : performance.now() / 1000);
      function upd() { H.score(`${st.hits} / ${st.need}`); }
      function say(t, bad) { judgeEl.textContent = t; judgeEl.style.color = bad ? '#ff8a7a' : '#ffd877'; st.judgeAt = performance.now(); }
      function dance(d) {
        if (st.car) { st.carMove = d; st.carT = 0; return; }
        if (DANCES) { if (dancing !== moves[d]) { dancing = moves[d]; ctx.player.clip(moves[d], { loop: true }); } return; }
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
      // the band fades out and lets go of its bus (a new song gets a new one)
      function stopBand(fade = .08) { if (!mix) return; const m = mix; mix = null; band = null; try { m.out.gain.setTargetAtTime(0, m.ctx.currentTime, fade); } catch (e) {} setTimeout(() => { try { m.out.disconnect(); } catch (e) {} }, 600); }
      function finish() {
        st.phase = 'done'; box.remove();
        const k = st.k, won = st.hits >= st.need, total = Math.round(st.pts * st.lv.mult), next = won && k + 1 < list.length ? k + 1 : null;
        saveBest(def.id, st.lv.key, st.hits); if (won) store.set(k + 1);
        ctx.sound(won ? 'gamewin' : 'thock');
        H.msg(won ? 'Song cleared!' : 'So close', 1700, `${st.hits} of ${st.notes.length} moves`);
        finT = setTimeout(() => ctx.finish({ score: total, passed: won, solved: won, kicker: won ? `Song ${k + 1} cleared` : `Song ${k + 1}`, next, nextLabel: 'Next song',
          extra: `${song.title}: ${st.hits} of ${st.notes.length} moves (${st.need} to clear), ${st.perfect} perfect, best combo ${st.maxCombo}.${next != null ? ` ${list[next].title} is open.` : ''}` }), 1300);
      }
      const inst = {
        update(dt) {
          const t = performance.now() / 1000; look(t);
          if (st.phase !== 'play') return;
          const now = clock();
          // the band, a little ahead of the clock
          while (st.evi < st.ev.length && st.ev[st.evi].t < now + .3) { const e = st.ev[st.evi++]; if (band && e.t >= now - .05) { try { band.play(e, Math.max(now, e.t)); } catch (err) {} } }
          // the arrows along the lane (they reach the ring as their beat sounds)
          const w = box.querySelector('.dn-lane').clientWidth || 560, ringX = w * .09, heard = now - st.lat;
          for (const n of st.notes) {
            if (!n.judged) n.el.style.left = (ringX + (n.t - heard) * st.pxs) + 'px';
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
          if (st.phase === 'pick') { const n = '1234567890'.indexOf(k); if (n >= 0 && n < list.length && n <= store.open(list.length)) begin(n); return; }
          if (KEYS[k] !== undefined) press(KEYS[k]); },
        // back to the song list (the song stops)
        restart() { if (st.phase === 'pick') return; clearTimeout(finT); stopBand(); lane.innerHTML = ''; box.remove();
          Object.assign(st, { phase: 'pick', notes: [], ev: [], evi: 0, hits: 0, perfect: 0, combo: 0, maxCombo: 0, pts: 0, end: 0, fakeNow: null }); judgeEl.textContent = '';
          dancing = null; ctx.player.idle?.(); H.score(''); H.info(`${list.length} songs`); H.hint(''); H.msg(''); showPick(); },
        _test: { st, begin, press, now: v => { st.fakeNow = v; }, chart: k => chart(list[k ?? st.k], k ?? st.k, 0), score: k => score(list[k ?? st.k], 0), get song() { return song; }, list, TIERS },
        dispose() { clearTimeout(finT); pick.remove(); box.remove(); stopBand(); nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); }
      };
      return inst;
    }
  };
  window.RebelGames.register('dance', G);
  // tests: every note of every song has a voice; per song its bars, length, tempo, arrows, window and moves to clear
  window.RebelGames.danceCheck = () => { const ac = new (window.AudioContext || window.webkitAudioContext)(), v = voices(ac), out = {};
    for (const vid of Object.keys(SONGS)) out[vid] = SONGS[vid].map((_, k) => { const s = compose(vid, k), ev = score(s, 0), ch = chart(s, k, 0);
      return { k: k + 1, title: s.title, groove: s.groove, bpm: s.bpm, bars: s.bars, len: +(s.bars * 240 / s.bpm).toFixed(1), ev: ev.length, bad: [...new Set(ev.filter(e => typeof v[e.i] !== 'function').map(e => e.i))], arrows: ch.length, window: TIERS[k].window, need: Math.ceil(ch.length * TIERS[k].need) }; });
    try { ac.close(); } catch (e) {} return out; };
  // tests: a song rendered offline through the same band and desk: { peak, rms (dBFS), loud (the loudest 3 s, dBFS),
  // nan, sources started / stopped }; o.bars [from, to] renders those bars only, o.only the roles listed (a stem)
  window.RebelGames.danceRender = async (vid, k, o = {}) => {
    const s = compose(vid, k), sr = o.rate || 44100, [b0, b1] = o.bars || [0, s.bars], span = (b1 - b0) * 240 / s.bpm, off = b0 * 240 / s.bpm, len = span + 3, ac = new OfflineAudioContext(2, Math.ceil(len * sr), sr);
    let started = 0, stopped = 0; for (const m of ['createOscillator', 'createBufferSource']) { const make = ac[m].bind(ac); ac[m] = () => { const n = make(), st0 = n.start.bind(n), sp0 = n.stop.bind(n); n.start = (...a) => { started++; return st0(...a); }; n.stop = (...a) => { stopped++; return sp0(...a); }; return n; }; }
    const d = desk(ac, ac.destination, s); for (const e of score(s, .1 - off)) if (e.t > .1 - 1e-6 && e.t < .1 + span - 1e-6 && (!o.only || o.only.includes(e.r))) d.play(e, e.t);
    const buf = await ac.startRendering(), L = buf.getChannelData(0), R = buf.getChannelData(1); let peak = 0, sum = 0, nan = 0, over = 0;
    for (let i = 0; i < L.length; i++) { const a = L[i], b = R[i]; if (a !== a || b !== b) { nan++; continue; } peak = Math.max(peak, Math.abs(a), Math.abs(b)); sum += a * a + b * b; if (Math.abs(a) > .6 || Math.abs(b) > .6) over++; }
    const win = sr * 3; let loud = 0; for (let i = 0; i + win <= L.length; i += sr) { let q = 0; for (let j = i; j < i + win; j++) q += L[j] * L[j] + R[j] * R[j]; loud = Math.max(loud, q / (2 * win)); }
    const res = { peak: +peak.toFixed(3), rms: +(10 * Math.log10(sum / (2 * L.length) + 1e-12)).toFixed(1), loud: +(10 * Math.log10(loud + 1e-12)).toFixed(1), nan, over: +(over / L.length).toFixed(4), started, stopped, sec: +len.toFixed(1) };
    if (o.wav) { const step = Math.round(sr / 22050), n = Math.floor(L.length / step), pcm = new Int16Array(n); for (let i = 0; i < n; i++) pcm[i] = Math.max(-32767, Math.min(32767, Math.round((L[i * step] + R[i * step]) * 16383))); res.pcm = pcm; }
    return res;
  };
  // tests (Node and the page): the composer, the score and the chart
  window.RebelGames.danceData = { SONGS, PAL, GROOVES, TIERS, RANGE, MIX, compose, score, chart, clockOf, voices, chord, prog };
})();
