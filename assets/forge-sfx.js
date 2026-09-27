/* Rebel Forge sound set — every sound is designed here and rendered in the browser (OfflineAudioContext), so there are
   no audio files to download and nothing third-party. Modal synthesis for steel, bells and gongs, a membrane model for
   taiko, Karplus-Strong for the koto plucks, filtered noise for fire, steam, brush, paper and air, and convolution reverb
   for the hall.
   Usage: ForgeSfx.render(name) -> Promise<AudioBuffer>   (cached; call ForgeSfx.names for the list) */
(function () {
  'use strict';
  const SR = 44100;
  const TAU = Math.PI * 2;
  let seed = 7;
  function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
  function gauss() { let u = 0, v = 0; while (u === 0) u = rnd(); v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); }
  const N = (d) => Math.max(1, Math.round(SR * d));
  const Z = (n) => new Float32Array(n);

  /* ---------- signals ---------- */
  function noise(d) { const n = N(d), o = Z(n); for (let i = 0; i < n; i++) o[i] = gauss(); return o; }
  function brown(d) { const n = N(d), o = Z(n); let x = 0, m = 0; for (let i = 0; i < n; i++) { x = x * 0.9995 + gauss(); o[i] = x; m = Math.max(m, Math.abs(x)); } return scale(o, 1 / (m || 1)); }
  function pink(d) { const n = N(d), o = Z(n); let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < n; i++) { const w = gauss(); b0 = .99886 * b0 + w * .0555179; b1 = .99332 * b1 + w * .0750759; b2 = .969 * b2 + w * .153852; b3 = .8665 * b3 + w * .3104856; b4 = .55 * b4 + w * .5329522; b5 = -.7616 * b5 - w * .016898; o[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * .5362) * 0.11; b6 = w * .115926; } return o; }
  const T = (i) => i / SR;
  function scale(x, k) { for (let i = 0; i < x.length; i++) x[i] *= k; return x; }
  function mul(x, f) { for (let i = 0; i < x.length; i++) x[i] *= f(T(i), i); return x; }
  function expDec(x, d) { return mul(x, (t) => Math.exp(-t / d)); }
  function hann(x) { const n = x.length; return mul(x, (t, i) => Math.sin(Math.PI * i / Math.max(1, n - 1)) ** 2); }
  function arch(x, p = 1) { const n = x.length; return mul(x, (t, i) => Math.abs(Math.sin(Math.PI * i / Math.max(1, n - 1))) ** p); }
  function mix(...parts) { let n = 0; parts.forEach((p) => { n = Math.max(n, p.length); }); const o = Z(n); parts.forEach((p) => { for (let i = 0; i < p.length; i++) o[i] += p[i]; }); return o; }
  function at(x, sec) { const s = N(sec); const o = Z(s + x.length); o.set(x, s); return o; }
  function sat(x, k = 1.5) { const d = Math.tanh(k); for (let i = 0; i < x.length; i++) x[i] = Math.tanh(k * x[i]) / d; return x; }

  /* ---------- filters (RBJ biquads) ---------- */
  function coef(type, f, q) {
    f = Math.min(Math.max(f, 10), SR * 0.45); const w = TAU * f / SR, c = Math.cos(w), a = Math.sin(w) / (2 * q);
    let b0, b1, b2; const a0 = 1 + a, a1 = -2 * c, a2 = 1 - a;
    if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; }
    else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; }
    else { b0 = a; b1 = 0; b2 = -a; }
    return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
  }
  function biquad(x, type, f, q = 0.7071) {
    const [b0, b1, b2, a1, a2] = coef(type, f, q); const o = Z(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < x.length; i++) { const y = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = y; o[i] = y; }
    return o;
  }
  const lp = (x, f, order = 2) => { let y = biquad(x, 'lp', f); if (order >= 4) y = biquad(y, 'lp', f); return y; };
  const hp = (x, f) => biquad(x, 'hp', f);
  const bp = (x, lo, hi) => lp(hp(x, lo), hi);
  function sweepBp(x, f0, f1, q = 1.2) {   // band-pass whose centre glides f0 -> f1 (log)
    const o = Z(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0, c = null;
    for (let i = 0; i < x.length; i++) {
      if (i % 64 === 0) c = coef('bp', f0 * (f1 / f0) ** (i / x.length), q);
      const y = c[0] * x[i] + c[1] * x1 + c[2] * x2 - c[3] * y1 - c[4] * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = y; o[i] = y;
    }
    return scale(o, 2.2);
  }

  /* ---------- instruments ---------- */
  function partials(d, list, f0, glide = 0) {
    const n = N(d), o = Z(n);
    list.forEach(([r, amp, dec, bloom]) => {
      let ph = rnd() * TAU; const det = 1 + 0.003 * gauss();
      for (let i = 0; i < n; i++) {
        const t = i / SR; const f = f0 * r * det * (1 + glide * Math.exp(-t * 6)); ph += TAU * f / SR;
        const e = bloom ? (1 - Math.exp(-t * bloom)) * Math.exp(-t / dec) : Math.exp(-t / dec);
        o[i] += amp * Math.sin(ph + (bloom ? 0.3 * Math.sin(TAU * (0.7 + r * 0.3) * t) : 0)) * e;
      }
    });
    return o;
  }
  function taiko(f = 62, d = 1.4, hit = 1) {
    const n = N(d), body = Z(n); let p1 = 0, p2 = 0;
    for (let i = 0; i < n; i++) { const t = i / SR; const pf = f * (1 + 0.55 * Math.exp(-t * 28)); p1 += TAU * pf / SR; p2 += TAU * pf * 1.58 / SR; body[i] = Math.sin(p1) * Math.exp(-t / 0.42) + 0.35 * Math.sin(p2) * Math.exp(-t / 0.2); }
    const skin = scale(expDec(lp(noise(0.08), 1800), 0.018), 0.9 * hit);
    const slap = scale(expDec(hp(noise(0.02), 2500), 0.004), 0.35 * hit);
    return sat(scale(mix(body, skin, slap), 1.2), 1.8);
  }
  function gong(f = 98, d = 7) {
    const list = [[1, 1, 3.2], [1.49, .7, 2.6], [2.03, .55, 2.2], [2.44, .5, 1.9], [2.99, .4, 1.6], [3.62, .35, 1.3], [4.35, .25, 1], [5.2, .2, .8], [6.1, .15, .6]].map(([r, a, dc]) => [r, a, dc, 3 + r]);
    return mix(scale(partials(d, list, f), 0.6), scale(expDec(lp(noise(0.05), 1200), 0.012), 0.8));
  }
  function bell(f = 660, d = 3, bright = 1) {
    const list = [[0.5, .5, 2.2], [1, 1, 1.8], [1.19, .45, 1.2], [1.5, .3, 1], [2, .35, .9], [2.51, .25 * bright, .6], [3, .15 * bright, .45], [4.07, .12 * bright, .3]];
    return mix(partials(d, list, f), scale(hp(noise(0.01), 3000), 0.2));
  }
  function anvil(f = 1150, d = 2.2) {
    const list = [[1, 1, .9], [2.32, .75, .6], [2.76, .55, .55], [4.13, .5, .35], [5.4, .38, .28], [6.93, .28, .2], [8.93, .22, .15], [11.3, .14, .1], [13.3, .1, .08]];
    return mix(scale(partials(d, list, f), 0.7), scale(expDec(hp(noise(0.006), 4000), 0.0012), 1.2), scale(taiko(140, 0.25), 0.5));
  }
  function whoosh(d = 0.7, f0 = 300, f1 = 2600, q = 1.1) { return arch(sweepBp(noise(d), f0, f1, q), 2.2); }
  function crackle(d, rate = 18, bright = 4200) {
    const n = N(d), o = Z(n); const k = Math.round(rate * d);
    for (let j = 0; j < k; j++) {
      const L = 60 + Math.floor(rnd() * 640), p = Math.floor(rnd() * Math.max(1, n - L)), a = rnd() ** 2;
      const g = bp(noise(L / SR), 800 + rnd() * 1500, bright);
      for (let i = 0; i < L && p + i < n; i++) o[p + i] += g[i] * Math.exp(-i / (L / 5)) * a;
    }
    return o;
  }
  function karplus(f, d, damp = 0.996, bright = 0.5) {
    const n = N(d), p = Math.max(2, Math.round(SR / f)); let buf = lp(noise(p / SR).map((v) => v * 0.5), 2000 + 6000 * bright);
    const o = Z(n); let i = 0;
    for (let k = 0; k < n; k++) { o[k] = buf[i]; const nx = buf[(i + 1) % p]; buf[i] = damp * 0.5 * (buf[i] + nx); i = (i + 1) % p; }
    return o;
  }
  function pluck(f, d = 1.6) { return mul(mix(karplus(f, d, 0.9965, 0.55), scale(karplus(f * 2.003, d, 0.994, 0.55), 0.25)), (t) => Math.min(1, t / 0.002) * Math.exp(-t / d)); }
  function shimmer(d = 2.5, count = 60, lo = 2200, hi = 7500) {
    const n = N(d), o = Z(n);
    for (let j = 0; j < count; j++) {
      const f = lo * (hi / lo) ** rnd(), L = N(0.15 + rnd() * 0.6), s = Math.floor(rnd() * Math.max(1, n - L)), a = 0.3 + rnd() * 0.7;
      for (let i = 0; i < L && s + i < n; i++) o[s + i] += Math.sin(TAU * f * i / SR) * Math.sin(Math.PI * i / L) ** 2 * a;
    }
    return arch(o, 0.3);
  }
  function paper(d, density = 40) {
    const n = N(d), o = Z(n);
    for (let j = 0; j < Math.round(density * d); j++) {
      const L = 200 + Math.floor(rnd() * 1400), p = Math.floor(rnd() * Math.max(1, n - L)); const g = hann(bp(noise(L / SR), 1500, 7000)); const a = rnd();
      for (let i = 0; i < L && p + i < n; i++) o[p + i] += g[i] * a;
    }
    return o;
  }
  function padChord(freqs, d, cutoff = 1800, vib = 5) {
    const n = N(d), o = Z(n);
    freqs.forEach((f) => [-0.006, 0, 0.007].forEach((det) => {
      let ph = 0; const vp = rnd() * TAU;
      for (let i = 0; i < n; i++) { const t = i / SR; ph += f * (1 + det) * (1 + 0.003 * Math.sin(TAU * vib * t + vp)) / SR; o[i] += (2 * (ph % 1) - 1) * 0.3; }
    }));
    const lo = lp(o, cutoff, 4);
    return arch(mix(scale(bp(lo, 500, 900), 1.2), bp(lo, 1000, 1400), scale(lp(lo, 400), 0.6)), 0.8);
  }
  const ramp = (d, f) => mul(Z(N(d)).fill(1), f);

  /* ---------- rooms: generated impulse responses ---------- */
  function impulse(ctx, dur, bright, pre = 0.012, early = 0.25) {
    const n = N(dur), b = ctx.createBuffer(2, n, SR);
    for (let ch = 0; ch < 2; ch++) {
      const tail = hp(lp(noise(dur), bright), 120); const d = b.getChannelData(ch);
      for (let i = 0; i < n; i++) d[i] = tail[i] * Math.exp(-(i / SR) / (dur / 6.9));
      for (let k = 0; k < 8; k++) { const p = N(pre + rnd() * 0.06); if (p < n) d[p] += early * (1 - k / 10) * (rnd() > 0.5 ? 1 : -1) * 3; }
    }
    return b;
  }
  const ROOMS = { hall: [3.2, 5500, 0.012, 0.25], room: [1.1, 7000, 0.006, 0.4], temple: [5.5, 4200, 0.02, 0.25] };

  /* ---------- the sound set: [dry signal, room, wet, pan, peak dB] ---------- */
  const DEF = {
    ui_hover: () => [mix(scale(expDec(bp(noise(0.03), 2500, 6000), 0.006), 0.4), partials(0.08, [[1, .3, .02]], 3200)), 'room', 0.12, 0, -14],
    ui_click: () => [mix(scale(taiko(420, 0.18), 0.6), expDec(bp(noise(0.02), 1800, 5000), 0.004)), 'room', 0.15, 0, -6],
    toast: () => [mix(scale(bell(1320, 1.4, .6), 0.5), at(scale(bell(1760, 1.2, .5), 0.35), 0.09)), 'hall', 0.3, 0, -9],
    error: () => [mix(scale(taiko(90, 0.8), 0.8), at(scale(taiko(80, 0.8), 0.6), 0.16)), 'room', 0.25, 0, -5],
    step: () => [taiko(58, 1.8), 'hall', 0.35, 0, -2],
    summon_appear: () => [mix(scale(whoosh(2.2, 120, 1400, 0.8), 0.8), scale(arch(lp(brown(2.2), 180)), 0.6), at(scale(shimmer(1.6, 30, 1800, 5000), 0.25), 0.7)), 'temple', 0.35, 0, -3],
    trait_fly: () => [mix(scale(whoosh(0.55, 700, 4200, 1.3), 0.7), at(scale(bell(1568, 1.2, 0.8), 0.45), 0.42)), 'hall', 0.3, 0, -5],
    summon_done: () => [mix(taiko(52, 2.2), at(scale(gong(110, 5.5), 0.9), 0.02), at(scale(shimmer(2.5, 70), 0.18), 0.1)), 'temple', 0.35, 0, -1],
    brush1: () => brushStroke(0.5), brush2: () => brushStroke(0.75), brush3: () => brushStroke(1.0),
    ink_reveal: () => [mix(scale(whoosh(2.6, 150, 1100, 0.7), 0.7), scale(arch(lp(brown(2.8), 140)), 0.5), at(scale(padChord([146.8, 220, 293.7], 2.4, 1400), 0.5), 0.3)), 'temple', 0.3, 0, -3],
    stamp: () => [mix(scale(taiko(110, 0.35), 0.9), expDec(lp(noise(0.05), 900), 0.01), at(scale(paper(0.2, 60), 0.3), 0.01)), 'room', 0.2, 0, -3],
    scroll_unroll: () => { const roll = mul(lp(brown(1.8), 220), (t) => (0.6 + 0.4 * Math.sin(TAU * 7 * t)) * Math.abs(Math.sin(Math.PI * t / 1.8)) ** 0.6); return [mix(scale(roll, 0.9), scale(paper(1.8, 70), 0.55), at(scale(taiko(160, 0.3), 0.4), 1.65)), 'room', 0.2, 0, -4]; },
    view_appear: () => [mix(scale(paper(0.35, 90), 0.6), scale(whoosh(0.4, 900, 3000), 0.3), at(scale(bell(1175, 1.4, .7), 0.4), 0.12)), 'hall', 0.28, 0, -6],
    seal: () => [mix(taiko(75, 1.0), at(scale(bell(587, 2.2, .9), 0.5), 0.05), at(scale(shimmer(1.4, 30), 0.15), 0.1)), 'hall', 0.35, 0, -2],
    forge_loop: () => { const d = 10; const roar = mix(mul(lp(brown(d), 160, 4), (t) => 0.8 + 0.2 * Math.sin(TAU * 0.21 * t)), scale(mul(lp(pink(d), 900), (t) => 0.7 + 0.3 * Math.sin(TAU * 0.37 * t + 1)), 0.12)); return [loopable(mix(roar, scale(crackle(d, 26), 0.9), scale(lp(noise(d), 60), 0.3))), null, 0, 0, -9]; },
    forge_start: () => [mix(scale(taiko(48, 2.4), 1.1), scale(whoosh(1.8, 90, 900, 0.7), 0.8), scale(arch(lp(brown(2.4), 120)), 0.8), at(scale(crackle(1.5, 60), 0.5), 0.2)), 'hall', 0.35, 0, -1],
    anvil1: () => [mix(anvil(1150), at(scale(crackle(0.5, 80, 6000), 0.25), 0.01)), 'hall', 0.32, -0.15, -2],
    anvil2: () => [mix(anvil(980), at(scale(crackle(0.5, 80, 6000), 0.25), 0.01)), 'hall', 0.32, 0.1, -2],
    anvil3: () => [mix(anvil(1320), at(scale(crackle(0.5, 80, 6000), 0.25), 0.01)), 'hall', 0.32, 0.2, -2],
    bellows: () => [mix(scale(arch(lp(noise(0.9), 500), 2), 0.8), arch(lp(brown(0.9), 90))), 'room', 0.2, 0, -6],
    sparks: () => [mix(scale(crackle(0.9, 120, 8000), 0.8), scale(expDec(hp(noise(0.9), 5000), 0.15), 0.25)), 'hall', 0.25, 0, -6],
    stage_done: () => [mix(scale(bell(784, 2.0, .8), 0.6), at(scale(bell(1175, 2.0, .8), 0.5), 0.11), scale(taiko(90, 0.5), 0.4)), 'hall', 0.35, 0, -4],
    pluck1: () => [pluck(392, 1.8), 'hall', 0.3, -0.3, -5], pluck2: () => [pluck(440, 1.8), 'hall', 0.3, -0.18, -5], pluck3: () => [pluck(523.3, 1.8), 'hall', 0.3, -0.06, -5],
    pluck4: () => [pluck(587.3, 1.8), 'hall', 0.3, 0.06, -5], pluck5: () => [pluck(659.3, 1.8), 'hall', 0.3, 0.18, -5], pluck6: () => [pluck(784, 1.8), 'hall', 0.3, 0.3, -5],
    quench: () => {
      const d = 3.2; const hiss = mul(hp(noise(d), 2500), (t) => Math.exp(-t * 1.1) * (1 - Math.exp(-t * 60))); const bub = Z(N(d));
      for (let j = 0; j < 90; j++) { const L = N(0.03), s = Math.floor(rnd() * N(2.4)), f = 400 + rnd() * 900; let ph = 0; for (let i = 0; i < L; i++) { ph += TAU * (f + f * 0.8 * i / L) / SR; bub[s + i] += Math.sin(ph) * Math.sin(Math.PI * i / L) ** 2 * 0.25 * Math.exp(-s / SR); } }
      return [mix(scale(hiss, 0.8), bub, scale(taiko(70, 0.8), 0.6), scale(mul(lp(brown(d), 200), (t) => Math.exp(-t * 1.4)), 0.6)), 'hall', 0.35, 0, -2];
    },
    versions_ready: () => [mix(scale(gong(147, 5.0), 0.8), at(scale(bell(1175, 2.5), 0.4), 0.25), at(scale(bell(1568, 2.5), 0.35), 0.45), at(scale(bell(1976, 2.5), 0.3), 0.65), at(scale(shimmer(2.5, 80), 0.2), 0.2)), 'temple', 0.35, 0, -1],
    select: () => [mix(scale(taiko(200, 0.3), 0.6), at(scale(bell(1397, 1.2, .8), 0.35), 0.02), scale(whoosh(0.3, 1200, 3500), 0.25)), 'hall', 0.25, 0, -5],
    forged: () => [mix(gong(82, 7.0), at(scale(padChord([130.8, 196, 261.6, 329.6], 5.0, 1600), 0.6), 0.3), at(scale(shimmer(4, 120), 0.2), 0.5)), 'temple', 0.35, 0, -1],
    charge: () => {
      const d = 1.8, n = N(d), o = Z(n); let p1 = 0, p2 = 0;
      for (let i = 0; i < n; i++) { const t = i / SR, f = 110 * 2 ** (t / d * 2.2); p1 += TAU * f / SR; p2 += TAU * f * 1.5 / SR; o[i] = 0.4 * Math.sin(p1) + 0.25 * Math.sin(p2); }
      return [mul(mix(o, scale(sweepBp(noise(d), 300, 6000, 1.5), 0.6)), (t) => (t / d) ** 1.6), 'hall', 0.3, 0, -3];
    },
    awaken: () => [mix(scale(taiko(44, 3.0), 1.2), scale(mul(lp(brown(3), 100), (t) => Math.exp(-t * 1.2)), 1.2), at(scale(gong(92, 6.5), 0.9), 0.05), at(scale(padChord([146.8, 220, 293.7, 370], 5.5, 2200), 0.7), 0.25), at(scale(shimmer(4.5, 160, 2500, 9000), 0.25), 0.15)), 'temple', 0.4, 0, -0.5],
    swish_light: () => [whoosh(0.28, 900, 4200, 1.6), 'room', 0.12, 0, -6],
    swish_heavy: () => [mix(whoosh(0.5, 250, 2600, 1.1), scale(arch(lp(noise(0.5), 300), 2), 0.4)), 'room', 0.15, 0, -4],
    swish_spin: () => [mix(...[0, 1, 2, 3].map((k) => at(scale(whoosh(0.3, 500, 3200, 1.3), 0.6 + 0.2 * k), 0.14 * k))), 'room', 0.15, 0, -4],
    impact: () => [mix(scale(taiko(95, 0.35), 0.9), scale(expDec(lp(noise(0.06), 1500), 0.01), 0.8), scale(expDec(hp(noise(0.02), 3000), 0.003), 0.3)), 'room', 0.15, 0, -3],
    impact_heavy: () => [mix(scale(taiko(60, 0.8), 1.1), expDec(lp(noise(0.12), 900), 0.02), at(scale(crackle(0.3, 40), 0.2), 0.01)), 'hall', 0.22, 0, -2],
    land: () => [mix(scale(taiko(75, 0.4), 0.8), scale(expDec(lp(noise(0.08), 600), 0.015), 0.6), at(scale(paper(0.15, 40), 0.1), 0.02)), 'room', 0.15, 0, -4],
    step_soft: () => [mix(expDec(lp(noise(0.05), 700), 0.01), scale(taiko(130, 0.12), 0.3)), 'room', 0.12, 0, -12]
  };
  function brushStroke(d) {
    const env = lp(noise(d), 40); let m = 0; env.forEach((v) => { m = Math.max(m, Math.abs(v)); });
    const bristles = mul(bp(noise(d), 1800, 7500), (t, i) => 0.55 + 0.45 * Math.abs(env[i]) / (m || 1));
    return [arch(mix(scale(bristles, 0.7), scale(lp(noise(d), 600), 0.35)), 1.5), 'room', 0.18, 0, -6];
  }
  function loopable(x) { const xf = N(1.5), n = x.length - xf; const o = x.slice(0, n); for (let i = 0; i < xf; i++) { const a = i / xf; o[i] = x[i] * a + x[n + i] * (1 - a); } return o; }

  /* ---------- render ---------- */
  const cache = {}; const irCache = {};
  function render(name) {
    if (cache[name]) return cache[name];
    const make = DEF[name]; if (!make) return Promise.resolve(null);
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext; if (!OAC) return Promise.resolve(null);
    cache[name] = new Promise((resolve) => setTimeout(resolve, 0)).then(() => {
      seed = [...name].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);          // same sound every time
      const [dry, room, wet, pan, peakDb] = make();
      const tail = room ? ROOMS[room][0] : 0; const len = dry.length + N(tail);
      const ctx = new OAC(2, len, SR);
      const src = ctx.createBufferSource(); const b = ctx.createBuffer(1, dry.length, SR); b.getChannelData(0).set(dry); src.buffer = b;
      const pn = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain(); if (pn.pan) pn.pan.value = pan || 0;
      src.connect(pn); pn.connect(ctx.destination);
      if (room) {
        const key = room; const cv = ctx.createConvolver(); cv.normalize = true;
        cv.buffer = irCache[key] ? copyBuf(ctx, irCache[key]) : (irCache[key] = impulse(ctx, ...ROOMS[room]));
        const g = ctx.createGain(); g.gain.value = wet * 1.6; src.connect(cv); cv.connect(g); g.connect(ctx.destination);
      }
      src.start(0);
      return ctx.startRendering().then((out) => {
        let m = 0; for (let c = 0; c < out.numberOfChannels; c++) { const d = out.getChannelData(c); for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i])); }
        const k = m ? 10 ** (peakDb / 20) / m : 1; let last = 0; const thr = 10 ** (-66 / 20);
        for (let c = 0; c < out.numberOfChannels; c++) { const d = out.getChannelData(c); for (let i = 0; i < d.length; i++) { d[i] *= k; if (Math.abs(d[i]) > thr) last = Math.max(last, i); } }
        if (name === 'forge_loop' || last >= out.length - 1) return out;
        const cut = new AudioBuffer({ numberOfChannels: 2, length: last + 1, sampleRate: SR });   // trim silent reverb tail
        for (let c = 0; c < 2; c++) cut.getChannelData(c).set(out.getChannelData(c).subarray(0, last + 1));
        return cut;
      });
    }).catch((e) => { console.warn('ForgeSfx', name, e); return null; });
    return cache[name];
  }
  function copyBuf(ctx, src) { const b = ctx.createBuffer(src.numberOfChannels, src.length, src.sampleRate); for (let c = 0; c < src.numberOfChannels; c++) b.getChannelData(c).set(src.getChannelData(c)); return b; }
  window.ForgeSfx = { render, names: Object.keys(DEF) };
})();
