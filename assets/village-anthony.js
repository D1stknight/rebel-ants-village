// Ant-Thony roams Universe (Nov 1). Rebel #001 (his public Forge character: the rig with the jaw) walks the villages on
// a timetable every page works out the same from the clock (10 minutes a village, the Hub every third stop), so every
// player in a village sees him in the same place without a server. He appears in a flash near the village's spawn, walks
// a loop round it, stops now and then (idle, a stand-up bit, a wave), and leaves in a flash when his time is up.
// Walk up and he waves and says hello (once a day per player: /api/anthony-talk greet); press O (Use on a phone) to open
// his talk box and ask anything about Universe (/api/anthony-talk ask: the Rebel Economy's brain, which knows Universe from
// the guide this site sends it). His answers show in a bubble and the box, and he says them (/api/anthony-voice: only lines
// his brain gave), his jaw moving with the voice. A signed-in player may get a tip: the economy pays it, the page shows it.
// window.VillageAnthony.start(host) from village.html, host = { scene, village, player() -> { x, z, yaw } | null,
//   ground(x, z), free(x, z), clear(ax, az, bx, bz), canAct(), signedIn(), signIn(), points(), volume(), sound(name),
//   viaSite(url), shadows(), toast(msg), light (the after-crash level: 2 = no model) }
(function () {
  'use strict';
  const ROT = ['hub', 'samurai', 'chumpz', 'hub', 'ronin', 'saints-la', 'hub', 'kenshi', 'cute-creepy', 'hub', 'wokou', 'shogun', 'hub', 'bushi', 'yamabushi', 'hub', 'sohei', 'buke', 'hub', 'ashigaru', 'warrior'];
  const NAMES = { hub: 'the Hub', ronin: 'Ronin', samurai: 'Samurai', shogun: 'Shogun', bushi: 'Bushi', buke: 'Buke', ashigaru: 'Ashigaru', kenshi: 'Kenshi', yamabushi: 'Yamabushi', sohei: 'Sohei', wokou: 'Wokou', warrior: 'Warrior', 'cute-creepy': 'Cute & Creepy', chumpz: 'Chumpz Cove', 'saints-la': 'Saints of LA' };
  const SLOT = 10 * 60e3, SPEED = 2.2, WALK_NATIVE = 4.2, SCALE = 1.9, TAG_Y = 3.95;
  const NEAR = 3.6, GREET_R = 7, SHOW_R = 150, AWAY = 9, ARRIVE = 2.2, LEAVE = 5;
  const ME = { col: 'battle_for_colony', tok: '1' };
  const GK_KEY = 'rebelAntsAnthonyGuest:v1', GREET_KEY = 'rebelAntsAnthonyGreet:v1';
  const log = (...a) => { if (window._antDebug) console.log('[ant-thony]', ...a); };
  const day = () => new Date().toISOString().slice(0, 10);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let H = null, B = null, started = false;

  // ---- the timetable: where he is at a time (every page the same) ----
  // (?ant=here: he is in the village you are in, his loop and moves as usual: for testing and showing him off)
  const HERE = (() => { try { return new URLSearchParams(location.search).get('ant') === 'here'; } catch (e) { return false; } })();
  function where(t = Date.now()) {
    const n = Math.floor(t / SLOT), village = HERE && H ? H.village : ROT[((n % ROT.length) + ROT.length) % ROT.length];
    return { village, name: NAMES[village] || village, n, start: n * SLOT, end: (n + 1) * SLOT };
  }
  // the next time he is in a village (for "He's in Kenshi now - next here in 25 min")
  function nextIn(village, t = Date.now()) {
    for (let k = 0; k < ROT.length * 2; k++) { const w = where(t + k * SLOT); if (w.village === village) return k ? w.start : t; }
    return null;
  }
  // a small seeded random (the same for every page): mulberry32
  const rnd = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let x = Math.imul(seed ^ (seed >>> 15), 1 | seed); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };

  // ---- his loop round the spawn: points the village's own walk rules leave free, with clear legs between them ----
  let ROUTE = null, routeTries = 0;
  // his loop: round a centre near the spawn, points the walk rules leave free, legs clear with no step over .5 m (no
  // jumping off a deck). The centre is the spawn's (0, 18), or the open ground nearby that gives the best loop (Chumpz
  // spawns on the bar porch: from there only two points joined): every page tries the same centres in the same order
  function loopAround(c) {
    const h0 = H.ground(c.x, c.z); if (!Number.isFinite(h0) || !H.free(c.x, c.z)) return null;
    const pts = [];
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4 + .35;
      for (const r of [11, 8, 14, 6, 17]) {
        const x = c.x + Math.sin(a) * r, z = c.z + Math.cos(a) * r, h = H.ground(x, z);
        if (!Number.isFinite(h) || Math.abs(h - h0) > 2.5 || !H.free(x, z)) continue;
        pts.push({ x, z }); break;
      }
    }
    // the longest run of points joined by clear legs (round the loop: start anywhere)
    let best = [];
    for (let s = 0; s < pts.length; s++) {
      const run = [pts[s]];
      for (let k = 1; k < pts.length; k++) { const p = pts[(s + k) % pts.length]; if (!legOk(run[run.length - 1], p)) break; run.push(p); }
      if (run.length > best.length) best = run;
    }
    const loop = best.length > 2 && legOk(best[best.length - 1], best[0]);
    return { c, best, loop, score: best.length + (loop ? 1.5 : 0) };
  }
  function legOk(a, b) {
    if (!H.clear(a.x, a.z, b.x, b.z)) return false;
    const n = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / .5)); let prev = H.ground(a.x, a.z);
    for (let k = 1; k <= n; k++) { const h = H.ground(a.x + (b.x - a.x) * k / n, a.z + (b.z - a.z) * k / n); if (!Number.isFinite(h) || Math.abs(h - prev) > .5) return false; prev = h; }
    return true;
  }
  function buildRoute() {
    const home = { x: 0, z: 18 }, tries = [home];
    for (const r of [14, 26]) for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; tries.push({ x: home.x + Math.sin(a) * r, z: home.z + Math.cos(a) * r }); }
    let pick = null;
    for (const c of tries) {
      const L = loopAround(c); if (!L) continue;
      if (!pick || L.score > pick.score + .01) pick = L;   // (ties keep the earlier: the spawn's own first)
      if (c === home && L.loop && L.best.length >= 6) break; // (a good loop at the spawn: no need to look further)
    }
    if (!pick) { log('route: nowhere free near the spawn'); return null; }
    const { best, loop, c } = pick;
    const path = best.length < 2 ? (best.length ? [best[0]] : [c]) : loop ? best.concat([best[0]]) : best.concat(best.slice(0, -1).reverse());
    log('route', 'centre', c.x.toFixed(0), c.z.toFixed(0), best.length, 'points', loop ? 'loop' : 'there and back');
    return path;
  }
  // what he does at a time in his slot: a list of steps (walk a leg, then stop: idle / a stand-up bit / a wave)
  function planOf(slot) {
    if (!ROUTE) return null;
    const r = rnd(slot.n * 7919 + 17), steps = []; let t = ARRIVE, i = 0;
    const end = (slot.end - slot.start) / 1000 - LEAVE;
    if (ROUTE.length === 1) { steps.push({ t0: 0, t1: end, at: ROUTE[0], pose: 'idle' }); return { steps, end }; }
    while (t < end) {
      const a = ROUTE[i % ROUTE.length], b = ROUTE[(i + 1) % ROUTE.length], d = Math.hypot(b.x - a.x, b.z - a.z), wt = d / SPEED;
      if (d > .2) { steps.push({ t0: t, t1: Math.min(end, t + wt), a, b }); t += wt; }
      const kind = r() < .28 ? 'game_standup' : r() < .2 ? 'wave' : 'idle', stay = kind === 'game_standup' ? 14 + r() * 8 : kind === 'wave' ? 4 : 6 + r() * 7;
      if (t < end) { steps.push({ t0: t, t1: Math.min(end, t + stay), at: b, pose: kind }); t += stay; }
      i++;
    }
    return { steps, end };
  }
  // where he is and what he does now
  function scheduled(now = Date.now()) {
    const w = where(now); if (w.village !== H.village) return null;
    if (!ROUTE) { if (routeTries < 6) { routeTries++; ROUTE = buildRoute(); } if (!ROUTE) return null; }
    if (!S.plan || S.plan.n !== w.n) S.plan = { n: w.n, ...planOf(w) };
    const s = (now - w.start) / 1000, P = S.plan;
    if (s >= P.end + LEAVE - .2) return null;
    const first = P.steps[0], at0 = first.at || first.a;
    if (s < ARRIVE) return { x: at0.x, z: at0.z, yaw: S.yaw, pose: 'arrive', slot: w };
    if (s >= P.end) { const last = P.steps[P.steps.length - 1], p = last.at || last.b; return { x: p.x, z: p.z, yaw: S.yaw, pose: 'leave', slot: w }; }
    for (const st of P.steps) {
      if (s < st.t0 || s >= st.t1) continue;
      if (st.a) { const k = (s - st.t0) / Math.max(.001, (Math.hypot(st.b.x - st.a.x, st.b.z - st.a.z) / SPEED)); return { x: st.a.x + (st.b.x - st.a.x) * k, z: st.a.z + (st.b.z - st.a.z) * k, yaw: Math.atan2(st.b.x - st.a.x, st.b.z - st.a.z), pose: 'walk', slot: w }; }
      return { x: st.at.x, z: st.at.z, yaw: S.yaw, pose: st.pose, slot: w };
    }
    const last = P.steps[P.steps.length - 1], p = last.at || last.b; return { x: p.x, z: p.z, yaw: S.yaw, pose: 'idle', slot: w };
  }

  // ---- his 3D model: #001's public rig (the jaw), his moves from its games pack (stand-up, wave) ----
  const S = { node: null, model: null, loading: false, x: 0, z: 0, y: 0, yaw: 0, shown: false, pose: '', talking: false, greeted: false, plan: null, flash: null, jawK: 0, speak: null, bubble: null, tag: null, here: false, said: 0 };
  async function rigUrl() {
    const r = await fetch(`/api/forge-active-character-get?collectionKey=${ME.col}&tokenId=${ME.tok}`); const d = await r.json();
    const c = d?.activeCharacter; return c?.forgeRigGlbUrl || c?.characterBundle?.forgeRigGlbUrl || null;
  }
  async function loadModel() {
    if (S.model || S.loading) return; S.loading = true;
    try {
      const url = await rigUrl(); if (!url) { log('no rig'); return; }
      const c = await B.SceneLoader.LoadAssetContainerAsync('', H.viaSite ? H.viaSite(url) : url, H.scene);
      const node = new B.TransformNode('antThony', H.scene); node.scaling.setAll(SCALE); node.metadata = { antThony: true };
      const pre = 'antThony_', inst = c.instantiateModelsToScene((n) => pre + n, false, { doNotInstantiate: true }), meshes = [], groups = {}, joints = new Map();
      for (const r of inst.rootNodes) { if (r instanceof B.AbstractMesh) meshes.push(r); meshes.push(...r.getChildMeshes(false)); }
      meshes.forEach((m) => { m.parent = node; if (m.rotationQuaternion) m.rotationQuaternion = null; m.isPickable = false; m.metadata = { ...(m.metadata || {}), camSkip: true, antThony: true }; fixMaterial(m.material); });
      for (const r of inst.rootNodes) if (!(r instanceof B.AbstractMesh) && !r.parent) r.parent = node;
      for (const r of inst.rootNodes) for (const n of [r, ...r.getDescendants(false)]) if (!(n instanceof B.AbstractMesh)) { const k = n.name.replace(pre, ''); if (!joints.has(k)) joints.set(k, n); }
      inst.animationGroups.forEach((g) => { g.stop(); g.enableBlending = true; g.blendingSpeed = .1; groups[g.name.replace(pre, '')] = g; });
      const sh = H.shadows?.(); if (sh) meshes.forEach((m) => { try { sh.addShadowCaster(m); } catch (e) {} });
      const jw = joints.get('mixamorig_Jaw');
      S.model = { c, inst, meshes, groups, joints, jaw: jw || null, rest: jw ? (jw.rotationQuaternion || B.Quaternion.FromEulerVector(jw.rotation)).clone() : null, cur: null, extra: [] };
      if (jw && !jw.rotationQuaternion) jw.rotationQuaternion = S.model.rest.clone();
      S.node = node; node.setEnabled(false);
      S.tag = tagPlane(); S.tag.parent = node; S.tag.position.y = TAG_Y / SCALE;
      play('idle', true);
      log('model', url.split('/').pop(), 'jaw', !!jw);
      loadPack(url).catch(() => {});
    } catch (e) { log('model failed', e?.message); }
    finally { S.loading = false; }
  }
  async function loadPack(url) {
    const pack = await window.RebelWeapon?.gamesFor?.(url); if (!pack || !S.model) return;
    const c = await B.SceneLoader.LoadAssetContainerAsync('', H.viaSite ? H.viaSite(pack) : pack, H.scene, null, '.glb');
    const m = S.model; if (!m) { c.dispose(); return; }
    for (const src of c.animationGroups) {
      if (!['wave', 'game_standup', 'game_cheer', 'dance_wave'].includes(src.name) || m.groups[src.name]) continue;
      const g = src.clone('antThony_' + src.name, (t) => (/^cloth_/.test(t?.name || '') ? null : m.joints.get(t?.name) || null));
      for (let j = g.targetedAnimations.length - 1; j >= 0; j--) if (!g.targetedAnimations[j].target) g.targetedAnimations.splice(j, 1);
      g.stop(); g.enableBlending = true; g.blendingSpeed = .1; m.groups[src.name] = g; m.extra.push(g);
    }
    c.animationGroups.forEach((g) => g.dispose()); c.dispose();
    log('pack', Object.keys(m.groups).join(','));
  }
  function fixMaterial(mat) { // (as the village does for its own player: at most 4 lights, no emissive, both faces)
    if (!mat || mat._antFixed) return; mat._antFixed = true;
    if (mat.maxSimultaneousLights !== undefined) { mat.maxSimultaneousLights = 4; mat.backFaceCulling = false; }
    if (mat.getClassName?.() === 'PBRMaterial') { mat.emissiveColor = new B.Color3(0, 0, 0); mat.emissiveIntensity = 0; }
  }
  // a move by name: the rig's own (idle, walk), else the pack's; one-shots go back to idle
  function play(name, loop, speed = 1) {
    const m = S.model; if (!m) return false;
    const g = m.groups[name] || (name === 'wave' ? m.groups.dance_wave : null) || (name === 'game_standup' ? m.groups.fight_idle : null) || m.groups.idle; if (!g) return false;
    if (m.cur === g) { g.speedRatio = speed; return true; }
    if (m.cur) m.cur.stop();
    m.cur = g; g.start(loop, speed, g.from, g.to, false);
    if (!loop) g.onAnimationGroupEndObservable.addOnce(() => { if (S.model?.cur === g) { S.model.cur = null; play('idle', true); } });
    return true;
  }
  function jaw(level) {
    const m = S.model; if (!m?.jaw || !m.rest) return;
    m.jaw.rotationQuaternion.copyFrom(m.rest.multiply(B.Quaternion.RotationAxis(B.Axis.X, Math.max(0, Math.min(1, level || 0)) * 15 * Math.PI / 180)));
  }

  // ---- his name over his head, his words in a bubble ----
  function tagPlane() {
    const tex = new B.DynamicTexture('antThonyTagTex', { width: 512, height: 128 }, H.scene, true); tex.hasAlpha = true;
    const g = tex.getContext(); g.clearRect(0, 0, 512, 128);
    g.font = "700 54px 'Cinzel Decorative', Georgia, serif"; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 10; g.strokeStyle = 'rgba(10,8,2,.85)'; g.strokeText('ANT-THONY', 256, 52); g.fillStyle = '#e8c56a'; g.fillText('ANT-THONY', 256, 52);
    g.font = "700 26px system-ui, sans-serif"; g.lineWidth = 6; g.strokeText('REBEL #001 \u00b7 ASK ME', 256, 104); g.fillStyle = '#f6efd9'; g.fillText('REBEL #001 \u00b7 ASK ME', 256, 104);
    tex.update();
    const mat = new B.StandardMaterial('antThonyTagMat', H.scene); mat.diffuseTexture = tex; mat.opacityTexture = tex; mat.emissiveColor = new B.Color3(1, 1, 1); mat.disableLighting = true; mat.backFaceCulling = false; mat.fogEnabled = false;
    const p = B.MeshBuilder.CreatePlane('antThonyTag', { width: 2.2 / SCALE, height: .55 / SCALE }, H.scene); p.material = mat; p.billboardMode = B.Mesh.BILLBOARDMODE_ALL; p.isPickable = false; p.metadata = { camSkip: true, antThony: true };
    return p;
  }
  function showBubble(text, ms) {
    if (!S.node) return;
    if (!S.bubble) {
      const tex = new B.DynamicTexture('antThonyBubbleTex', { width: 768, height: 384 }, H.scene, true); tex.hasAlpha = true;
      const mat = new B.StandardMaterial('antThonyBubbleMat', H.scene); mat.diffuseTexture = tex; mat.opacityTexture = tex; mat.emissiveColor = new B.Color3(1, 1, 1); mat.disableLighting = true; mat.backFaceCulling = false; mat.fogEnabled = false;
      const p = B.MeshBuilder.CreatePlane('antThonyBubble', { width: 3.6 / SCALE, height: 1.8 / SCALE }, H.scene); p.material = mat; p.billboardMode = B.Mesh.BILLBOARDMODE_ALL; p.isPickable = false; p.parent = S.node; p.position.y = (TAG_Y + 1.25) / SCALE; p.metadata = { camSkip: true, antThony: true };
      S.bubble = { p, tex, until: 0 };
    }
    const b = S.bubble, g = b.tex.getContext(); g.clearRect(0, 0, 768, 384);
    g.font = "600 34px system-ui, sans-serif"; const words = String(text).split(/\s+/), lines = []; let line = '';
    for (const w of words) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > 680 && line) { lines.push(line); line = w; } else line = t; }
    if (line) lines.push(line);
    const shown = lines.slice(0, 6); if (lines.length > 6) shown[5] = shown[5].replace(/\s*\S*$/, '') + '\u2026';
    const hgt = 40 + shown.length * 42, top = 384 - hgt - 34;
    g.fillStyle = 'rgba(8,12,26,.9)'; g.strokeStyle = 'rgba(232,197,106,.95)'; g.lineWidth = 5;
    const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
    rr(20, top, 728, hgt, 26); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(364, top + hgt); g.lineTo(384, top + hgt + 28); g.lineTo(404, top + hgt); g.closePath(); g.fill();
    g.fillStyle = '#f6efd9'; g.textAlign = 'center'; g.textBaseline = 'top';
    shown.forEach((l, i) => g.fillText(l, 384, top + 22 + i * 42));
    b.tex.update(); b.p.setEnabled(true); b.until = performance.now() + (ms || Math.min(14000, 4500 + text.length * 55));
  }

  // ---- his voice: the economy's WAV through Web Audio, the jaw from its loudness ----
  let actx = null;
  function audio() {
    if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (actx.state !== 'running') actx.resume?.().catch(() => {});
    return actx;
  }
  async function say(text, token) {
    if (!token || !text) return;
    try {
      const ctx = audio(); if (!ctx) return;
      const r = await fetch('/api/anthony-voice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, token, guestKey: guestKey() }) });
      if (!r.ok) { log('voice', r.status); return; }
      const buf = await ctx.decodeAudioData(await r.arrayBuffer());
      stopVoice();
      const src = ctx.createBufferSource(); src.buffer = buf;
      const an = ctx.createAnalyser(); an.fftSize = 1024; const gain = ctx.createGain(); gain.gain.value = Math.max(0, H.volume?.() ?? 1);
      src.connect(an); an.connect(gain); gain.connect(ctx.destination);
      S.speak = { src, an, gain, data: new Float32Array(an.fftSize) };
      src.onended = () => { if (S.speak?.src === src) { S.speak = null; } };
      src.start();
    } catch (e) { log('voice failed', e?.message); }
  }
  function stopVoice() { const s = S.speak; S.speak = null; if (s) { try { s.src.onended = null; s.src.stop(); } catch (e) {} } }
  function speakLevel() {
    const s = S.speak; if (!s) return 0;
    s.gain.gain.value = Math.max(0, H.volume?.() ?? 1);
    s.an.getFloatTimeDomainData(s.data); let e = 0; for (let i = 0; i < s.data.length; i++) e += s.data[i] * s.data[i];
    const rms = Math.sqrt(e / s.data.length); return Math.max(0, Math.min(1, (rms - .012) / .11));
  }

  // ---- talking to him ----
  function guestKey() {
    try { let k = localStorage.getItem(GK_KEY); if (!/^[A-Za-z0-9_-]{22,64}$/.test(k || '')) { const a = new Uint8Array(16); crypto.getRandomValues(a); k = btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); localStorage.setItem(GK_KEY, k); } return k; }
    catch (e) { return (guestKey.mem ||= 'g' + Math.random().toString(36).slice(2).padEnd(23, 'x')); }
  }
  const greetedToday = () => { try { return localStorage.getItem(GREET_KEY) === day(); } catch (e) { return !!S.greeted; } };
  const markGreeted = () => { S.greeted = true; try { localStorage.setItem(GREET_KEY, day()); } catch (e) {} };
  async function talkApi(body) {
    const r = await fetch('/api/anthony-talk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, village: H.village, guestKey: guestKey() }) });
    const d = await r.json().catch(() => ({})); return { ok: r.ok && d.ok, status: r.status, d };
  }
  async function greet() {
    if (S.greeting || greetedToday()) return; S.greeting = true;
    try {
      const { ok, d } = await talkApi({ kind: 'greet' });
      if (!ok || d.skip || !d.reply) { if (ok) markGreeted(); return; }
      markGreeted(); S.faceUntil = performance.now() + 8000;
      play('wave', false); showBubble(d.reply); addLine('him', d.reply); say(d.reply, d.voiceToken);
    } catch (e) { log('greet', e?.message); } finally { S.greeting = false; }
  }
  // the box
  const T = { el: null, open: false, lines: [], busy: false };
  function build() {
    if (T.el) return T.el;
    const css = document.createElement('style');
    css.textContent = `#antTalk{position:fixed;left:50%;bottom:24px;transform:translate(-50%,12px);width:min(560px,calc(100vw - 32px));z-index:64;display:flex;flex-direction:column;border-radius:18px;background:rgba(6,10,24,.92);border:1px solid rgba(232,197,106,.55);box-shadow:0 14px 40px rgba(0,0,0,.55);backdrop-filter:blur(8px);color:#f3e9cf;font:14px/1.45 system-ui,sans-serif;opacity:0;pointer-events:none;transition:opacity .16s,transform .16s}
#antTalk.on{opacity:1;pointer-events:auto;transform:translate(-50%,0)}
#antTalk .ah{display:flex;align-items:center;gap:10px;padding:12px 14px 8px}
#antTalk .ah img{width:42px;height:42px;border-radius:50%;border:2px solid rgba(232,197,106,.75);background:#1a1240;object-fit:cover;box-shadow:0 0 12px rgba(120,90,255,.35)}
#antTalk .ah b{font:700 15px 'Cinzel Decorative',Georgia,serif;letter-spacing:1px;color:#e8c56a}
#antTalk .ah small{display:block;font-size:11px;color:#b9ad8b;letter-spacing:.06em;text-transform:uppercase}
#antTalk .ah button{margin-left:auto;width:32px;height:32px;border-radius:50%;border:1px solid rgba(232,197,106,.35);background:transparent;color:#e8c56a;font-size:16px;cursor:pointer}
#antTalk .al{max-height:min(38vh,300px);overflow-y:auto;padding:4px 14px 8px;display:flex;flex-direction:column;gap:8px}
#antTalk .ln{max-width:88%;padding:8px 11px;border-radius:12px;white-space:pre-wrap;word-wrap:break-word}
#antTalk .ln.him{align-self:flex-start;background:rgba(232,197,106,.1);border:1px solid rgba(232,197,106,.25)}
#antTalk .ln.me{align-self:flex-end;background:rgba(120,170,255,.12);border:1px solid rgba(120,170,255,.25)}
#antTalk .ln.sys{align-self:center;font-size:12px;color:#b9ad8b;background:none;padding:2px}
#antTalk .ln.tip{align-self:center;font-weight:700;color:#7be38a;background:rgba(123,227,138,.08);border:1px solid rgba(123,227,138,.35)}
#antTalk form{display:flex;gap:8px;padding:8px 12px 12px;border-top:1px solid rgba(232,197,106,.18)}
#antTalk input{flex:1;min-width:0;padding:10px 12px;border-radius:10px;border:1px solid rgba(232,197,106,.35);background:rgba(255,255,255,.05);color:#fff;font:15px system-ui,sans-serif;outline:none}
#antTalk input:focus{border-color:#e8c56a}
#antTalk form button{padding:0 16px;border-radius:10px;border:0;background:#e8c56a;color:#1a1204;font:800 13px system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;cursor:pointer}
#antTalk form button:disabled{opacity:.45;cursor:default}
#antTalk .dots::after{content:'\u2026';animation:antDots 1s steps(3) infinite;display:inline-block;width:1.2em;overflow:hidden;vertical-align:bottom}
@keyframes antDots{0%{width:.2em}100%{width:1.2em}}
html.vt-touch #antTalk{bottom:auto;top:max(12px,env(safe-area-inset-top,0px));transform:translate(-50%,-8px)}
html.vt-touch #antTalk.on{transform:translate(-50%,0)}
html.vt-touch #antTalk input{font-size:16px}`;
    document.head.appendChild(css);
    const el = document.createElement('div'); el.id = 'antTalk'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Talk to Ant-Thony');
    el.innerHTML = `<div class="ah"><img src="/assets/npcs/anthony-portrait.webp" alt=""><div><b>Ant-Thony</b><small>Rebel #001 \u00b7 your guide to Universe</small></div><button type="button" aria-label="Close" title="Close (Esc)">\u2715</button></div>
<div class="al" aria-live="polite"></div>
<form><input type="text" maxlength="300" autocomplete="off" enterkeyhint="send" placeholder="Ask about a game, a place, a quest..." aria-label="Your question"><button type="submit">Ask</button></form>`;
    document.body.appendChild(el);
    T.el = el; T.log = el.querySelector('.al'); T.input = el.querySelector('input'); T.send = el.querySelector('form button');
    el.querySelector('.ah button').onclick = () => close();
    el.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); ask(); });
    T.input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); close(); } });
    T.input.addEventListener('keyup', (e) => e.stopPropagation());
    el.addEventListener('pointerdown', () => audio()); // (his voice can start inside the press)
    // Esc with the box open (the line put down) closes it, before the game hears the key
    window.addEventListener('keydown', (e) => { if (T.open && e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); } }, true);
    return el;
  }
  function addLine(who, text) {
    T.lines.push({ who, text }); if (T.lines.length > 30) T.lines.shift();
    drawLine(who, text);
  }
  function drawLine(who, text) { // (the box shows what was said; a line said before it was built is drawn when it opens)
    if (!T.el) return;
    const d = document.createElement('div'); d.className = 'ln ' + who; d.textContent = text; T.log.appendChild(d);
    while (T.log.children.length > 30) T.log.firstChild.remove();
    T.log.scrollTop = T.log.scrollHeight;
  }
  function open() {
    build(); audio();
    if (!T.open) {
      T.open = true; T.el.classList.add('on'); S.talking = true; S.faceUntil = Infinity;
      if (!T.log.children.length) {
        for (const l of T.lines) drawLine(l.who, l.text);
        if (!T.lines.length) addLine('him', "Yo! I'm Ant-Thony. Ask me anything about Universe: games, quests, where things are, or what to do when you're stuck.");
        if (!H.signedIn()) addLine('sys', 'Signed-in players can get a little something from Ant-Thony now and then.');
      }
      play('idle', true);
    }
    if (!window.VillageTouch?.on) setTimeout(() => { try { T.input.focus(); } catch (e) {} }, 30);
    return true;
  }
  function close() {
    if (!T.open) return; T.open = false; T.el.classList.remove('on'); S.talking = false; S.faceUntil = performance.now() + 2500;
    try { T.input.blur(); } catch (e) {}
  }
  async function ask() {
    const q = T.input.value.trim(); if (q.length < 2 || T.busy) return;
    T.busy = true; T.send.disabled = true; T.input.value = '';
    addLine('me', q);
    const wait = document.createElement('div'); wait.className = 'ln him dots'; wait.textContent = 'Thinking'; T.log.appendChild(wait); T.log.scrollTop = T.log.scrollHeight;
    try {
      const transcript = T.lines.filter((l) => l.who === 'me' || l.who === 'him').slice(-11, -1).map((l) => ({ who: l.who, text: l.text }));
      const { ok, d } = await talkApi({ kind: 'ask', question: q, transcript });
      wait.remove();
      if (!ok) { addLine('sys', d.error || 'Ant-Thony did not answer: try again.'); return; }
      addLine('him', d.reply); showBubble(d.reply); say(d.reply, d.voiceToken);
      if (d.tipped > 0) { addLine('tip', `+${d.tipped} $REBEL from Ant-Thony`); H.toast?.(`+${d.tipped} $REBEL from Ant-Thony`); H.points?.(); }
    } catch (e) { wait.remove(); addLine('sys', 'Ant-Thony did not answer: try again.'); }
    finally { T.busy = false; T.send.disabled = false; if (!window.VillageTouch?.on && T.open) try { T.input.focus(); } catch (e) {} }
  }

  // ---- each frame ----
  let lastT = 0, flashMesh = null;
  function flash() {
    if (!S.node) return;
    if (!flashMesh) {
      const mat = new B.StandardMaterial('antThonyFlashMat', H.scene); mat.emissiveColor = new B.Color3(1, .82, .4); mat.disableLighting = true; mat.alpha = .8; mat.alphaMode = B.Engine.ALPHA_ADD; mat.backFaceCulling = false;
      flashMesh = B.MeshBuilder.CreateCylinder('antThonyFlash', { height: 4.4, diameterTop: 1.4, diameterBottom: 2.6, tessellation: 24, cap: B.Mesh.NO_CAP }, H.scene); flashMesh.material = mat; flashMesh.isPickable = false; flashMesh.metadata = { camSkip: true, antThony: true };
    }
    flashMesh.position.set(S.x, S.y + 2.2, S.z); flashMesh.setEnabled(true); S.flash = performance.now();
    H.sound?.('wish');
  }
  function tick() {
    const now = performance.now(), dt = Math.min(.1, lastT ? (now - lastT) / 1000 : 0); lastT = now;
    if (S.flash && flashMesh) { const k = (now - S.flash) / 700; if (k >= 1) { flashMesh.setEnabled(false); S.flash = null; } else { flashMesh.scaling.set(1 + k * .6, 1 - k * .3, 1 + k * .6); flashMesh.material.alpha = .8 * (1 - k); } }
    const me = H.player(), sch = scheduled(), canSee = !!sch && !!me && H.canAct();
    S.here = !!sch;
    if (!sch) { if (S.shown) hide(true); if (T.open) close(); return; }
    // (a phone in the lightest after-crash mode skips his model: he stays on the timetable and in the Rebel panel)
    if (!S.model) { if ((H.light || 0) < 2 && me && Math.hypot(me.x - sch.x, me.z - sch.z) < SHOW_R * 1.5) loadModel(); return; }
    if (!canSee) { if (S.shown) hide(false); return; }
    const dPlayer = Math.hypot(me.x - S.x, me.z - S.z);
    if (!S.shown) { S.x = sch.x; S.z = sch.z; S.y = H.ground(S.x, S.z) || 0; S.yaw = sch.yaw; S.node.setEnabled(true); S.shown = true; if (sch.pose === 'arrive') flash(); }
    // talking (or just greeted): he stands and faces the player; else he follows the timetable, catching up if he stopped
    const facing = S.talking || now < (S.faceUntil || 0);
    let tx = sch.x, tz = sch.z, pose = sch.pose;
    if (facing) { tx = S.x; tz = S.z; }
    const dx = tx - S.x, dz = tz - S.z, dist = Math.hypot(dx, dz);
    if (dist > 25) { S.x = tx; S.z = tz; }
    else if (dist > .05) { const step = Math.min(dist, (SPEED * (dist > 1.5 ? 1.6 : 1)) * dt); S.x += dx / dist * step; S.z += dz / dist * step; }
    const moving = !facing && dist > .15;
    const gy = H.ground(S.x, S.z); if (Number.isFinite(gy)) S.y += (gy - S.y) * Math.min(1, dt * 10);
    let wantYaw = moving ? Math.atan2(dx, dz) : facing ? Math.atan2(me.x - S.x, me.z - S.z) : (pose === 'walk' ? sch.yaw : S.yaw);
    let dy = wantYaw - S.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
    S.yaw += dy * Math.min(1, dt * 6);
    S.node.position.set(S.x, S.y, S.z); S.node.rotation.y = S.yaw;
    // the move
    const m = S.model;
    if (moving || pose === 'walk') { if (!facing) play('walk', true, Math.max(.45, Math.min(1.2, (dist > 1.5 ? SPEED * 1.6 : SPEED) / WALK_NATIVE))); else play('idle', true); }
    else if (pose === 'arrive' || pose === 'leave') { if (m.cur !== m.groups.wave) play('wave', false); }
    else if (pose === 'game_standup' && !facing) { if (m.groups.game_standup) play('game_standup', true); else play('idle', true); }
    else if (pose === 'wave' && !facing && m.cur !== m.groups.wave && S.lastWave !== sch.slot.n + ':' + Math.floor((Date.now() - sch.slot.start) / 4000)) { S.lastWave = sch.slot.n + ':' + Math.floor((Date.now() - sch.slot.start) / 4000); play('wave', false); }
    else if (!m.cur || (m.cur === m.groups.walk) || (m.cur === m.groups.game_standup && pose !== 'game_standup')) play('idle', true);
    if (pose === 'leave' && !S.left && (Date.now() - sch.slot.start) / 1000 > (S.plan.end + LEAVE - 1.2)) { S.left = sch.slot.n; flash(); }
    // the jaw follows his voice
    const lvl = speakLevel(); S.jawK += (lvl - S.jawK) * Math.min(1, dt * (lvl > S.jawK ? 22 : 12)); jaw(S.jawK);
    if (S.bubble && S.bubble.p.isEnabled() && now > S.bubble.until && !S.speak) S.bubble.p.setEnabled(false);
    // walking up to him: a hello once a day; walking away closes the box
    if (dPlayer < GREET_R && !facing && !greetedToday() && !T.open && H.canAct()) greet();
    if (T.open && dPlayer > AWAY) close();
  }
  function hide(gone) {
    S.shown = false; S.node?.setEnabled(false); if (S.bubble) S.bubble.p.setEnabled(false);
    if (gone) { stopVoice(); S.plan = null; }
  }

  // ---- the page asks ----
  const near = () => !!(S.shown && S.node?.isEnabled() && (() => { const me = H.player(); return me && Math.hypot(me.x - S.x, me.z - S.z) < NEAR; })());
  function talk() { if (!near() || !H.canAct()) return false; if (T.open) { if (!window.VillageTouch?.on) try { T.input.focus(); } catch (e) {} return true; } return open(); }
  function dots() { return S.shown ? [{ x: S.x, z: S.z, color: '#e8c56a' }] : []; }

  // a tap or a click on him (within 10 m) opens his box: where his body is on the screen (feet to head, a body wide),
  // a press that did not drag (the camera turns on a drag)
  function tapToTalk() {
    const cv = H.scene.getEngine().getRenderingCanvas(); if (!cv) return;
    let down = null;
    cv.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; }, true);
    cv.addEventListener('pointerup', (e) => {
      const d = down; down = null;
      if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 12 || performance.now() - d.t > 600 || !S.shown || T.open || !H.canAct()) return;
      const me = H.player(); if (!me || Math.hypot(me.x - S.x, me.z - S.z) > 10) return;
      const cam = H.scene.activeCamera; if (!cam) return;
      const eng = H.scene.getEngine(), vp = cam.viewport.toGlobal(eng.getRenderWidth(), eng.getRenderHeight()), M = H.scene.getTransformMatrix(), k = cv.clientWidth / eng.getRenderWidth();
      const at = (y) => B.Vector3.Project(new B.Vector3(S.x, S.y + y, S.z), B.Matrix.IdentityReadOnly, M, vp);
      const feet = at(0), head = at(3.3), r = cv.getBoundingClientRect();
      if (feet.z > 1 || head.z > 1) return;
      const x = (e.clientX - r.left) / k, y = (e.clientY - r.top) / k, w = Math.max(18, Math.abs(feet.y - head.y) * .28);
      if (y < head.y - 10 || y > feet.y + 10 || Math.abs(x - (feet.x + head.x) / 2) > w) return;
      e.stopPropagation(); open();
    }, true);
  }

  // the Rebel panel's line: here now, or where he is and when he is next here
  function paintWhere() {
    const el = document.getElementById('hudAntWhere'); if (!el || !H) return;
    const w = where(); let t;
    if (w.village === H.village) t = 'Here now';
    else { const nx = nextIn(H.village), min = nx ? Math.max(1, Math.round((nx - Date.now()) / 60000)) : null; t = `${w.name}${min ? ` \u00b7 here in ${min} min` : ''}`; }
    if (el.textContent !== t) el.textContent = t;
  }

  function start(host) {
    if (started) return; started = true; H = host; B = window.BABYLON;
    paintWhere(); setInterval(paintWhere, 15000);
    H.scene.onBeforeRenderObservable.add(() => { try { tick(); } catch (e) { log('tick', e?.message); } });
    try { tapToTalk(); } catch (e) {}
    const w = where(); log('now in', w.village, 'here', w.village === H.village);
    if (w.village === H.village) setTimeout(() => H.toast?.('Ant-Thony is in this village right now: look for the gold dot on your map and ask him anything.'), 6000);
  }
  window.VillageAnthony = {
    start, where, nextIn, talk, near, dots, open: () => T.open, close,
    get speaking() { return !!S.speak; },
    get state() { const me = H?.player?.(); return { here: S.here, shown: S.shown, loaded: !!S.model, x: S.x, z: S.z, y: S.y, yaw: S.yaw, pose: S.model?.cur?.name?.replace('antThony_', '') || null, talking: S.talking, open: T.open, lines: T.lines.slice(), speaking: !!S.speak, jaw: S.jawK, route: ROUTE ? ROUTE.length : 0, greeted: greetedToday(), dist: me ? Math.hypot(me.x - S.x, me.z - S.z) : null, moves: S.model ? Object.keys(S.model.groups) : [] }; },
    _test: { scheduled, buildRoute: () => (ROUTE = buildRoute()), planOf, setRoute: (r) => { ROUTE = r; S.plan = null; }, greet, say, flash, tick, level: () => speakLevel(),
      jawDeg: () => { const m = S.model; if (!m?.jaw || !m.rest) return null; const q = B.Quaternion.Inverse(m.rest).multiply(m.jaw.rotationQuaternion); return 2 * Math.acos(Math.min(1, Math.abs(q.w))) * 180 / Math.PI; } }
  };
})();
