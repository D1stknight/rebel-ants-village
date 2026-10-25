// The Book in the Hub Library (Oct 25, Miguel: "it would be cool if in the library someone presses the book and it does a
// cool opening animation, with glow and sounds and it opens up to the library"). Not a game: a short show played through
// the games system (its camera, the walk held, Esc twice leaves) that is never scored, recorded or listed (a hotspot's
// book field starts it, not a game field). The room's own book (the uploaded book.glb) steps aside for one of ours at its
// place: it rises off the lectern glowing and turns to you, the cover swings open, the pages riffle, light and golden
// dust pour out of them, the light fills the view, and the Colony Library's card comes up with the free sample and the
// Library on library.rebelants.io (real links: a new tab, so no popup blocker). Close or Enter puts the book back.
// def (the hotspot's book field + its text): { url, sample, cover, title, sub, text }
(function () {
  const clamp01 = t => t < 0 ? 0 : t > 1 ? 1 : t;
  const smooth = t => { t = clamp01(t); return t * t * (3 - 2 * t); };
  const easeOut = t => 1 - Math.pow(1 - clamp01(t), 3);
  const easeInOut = t => { t = clamp01(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const lerp = (a, b, t) => a + (b - a) * t;
  // the show's clock (seconds): the rise, the cover, the pages, the light, the card
  const T = { rise: 1.25, cover0: 1.05, cover1: 2.05, pages0: 1.55, pageEvery: .075, pageDur: .5, pour: 1.3, white0: 3.05, white1: 3.65, card: 3.55 };
  const PAGES = 14;

  // canvas textures (made once, kept by the materials)
  function canvasTex(B, scene, name, w, h, draw) {
    const t = new B.DynamicTexture(name, { width: w, height: h }, scene, true);
    const c = t.getContext(); draw(c, w, h); t.update(); return t;
  }
  function leather(c, w, h) {
    c.fillStyle = '#3a1f12'; c.fillRect(0, 0, w, h);
    for (let k = 0; k < 2600; k++) { const x = Math.random() * w, y = Math.random() * h, r = Math.random() * 2.2; c.fillStyle = `rgba(${Math.random() < .5 ? '20,8,4' : '92,52,30'},${.08 + Math.random() * .12})`; c.fillRect(x, y, r, r); }
    c.strokeStyle = 'rgba(214,170,84,.75)'; c.lineWidth = 6; c.strokeRect(22, 22, w - 44, h - 44);
    c.strokeStyle = 'rgba(214,170,84,.4)'; c.lineWidth = 2; c.strokeRect(38, 38, w - 76, h - 76);
  }
  function paper(c, w, h, lines) {
    const g = c.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#d9c59a'); g.addColorStop(.12, '#f1e4c4'); g.addColorStop(1, '#ead9b2');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    for (let k = 0; k < 900; k++) { c.fillStyle = `rgba(120,90,40,${Math.random() * .05})`; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    if (lines) { c.fillStyle = 'rgba(70,52,30,.22)'; for (let y = h * .12; y < h * .9; y += h / 34) c.fillRect(w * .12, y, w * (.62 + Math.random() * .14), 3); }
  }
  function titlePage(c, w, h) {
    paper(c, w, h, false);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#7a1c14'; c.font = '700 30px "Cinzel Decorative", Georgia, serif'; c.fillText('REBEL ANTS', w / 2, h * .16);
    c.fillStyle = '#23170c'; c.font = '900 92px "Cinzel Decorative", Georgia, serif'; c.fillText('THE', w / 2, h * .33); c.fillText('WARNING', w / 2, h * .45, w * .9);
    c.strokeStyle = '#9a7432'; c.lineWidth = 3; c.beginPath(); c.moveTo(w * .22, h * .54); c.lineTo(w * .78, h * .54); c.stroke();
    c.fillStyle = '#3c2a16'; c.font = '700 30px "Cinzel Decorative", Georgia, serif'; c.fillText('VOLUME 1', w / 2, h * .6);
    // a small flame (the Flame of Life) between two roots
    c.save(); c.translate(w / 2, h * .74); const fg = c.createRadialGradient(0, 0, 4, 0, 0, 60); fg.addColorStop(0, 'rgba(255,214,120,.95)'); fg.addColorStop(1, 'rgba(255,170,60,0)');
    c.fillStyle = fg; c.beginPath(); c.arc(0, 0, 60, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#b8461c'; c.beginPath(); c.moveTo(0, -38); c.bezierCurveTo(22, -8, 18, 22, 0, 30); c.bezierCurveTo(-18, 22, -22, -8, 0, -38); c.fill();
    c.fillStyle = '#f2b648'; c.beginPath(); c.moveTo(0, -16); c.bezierCurveTo(10, 0, 8, 18, 0, 22); c.bezierCurveTo(-8, 18, -10, 0, 0, -16); c.fill(); c.restore();
    c.fillStyle = '#3c2a16'; c.font = '400 26px Georgia, serif'; c.fillText('Miguel Concepcion', w / 2, h * .9);
  }
  function endpaper(c, w, h) {
    c.fillStyle = '#16251c'; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(196,156,74,.35)'; c.lineWidth = 2;
    for (let y = -40; y < h + 40; y += 46) for (let x = -40; x < w + 40; x += 46) { c.beginPath(); c.arc(x + ((y / 46) % 2 ? 23 : 0), y, 22, Math.PI, 0); c.stroke(); }
  }
  function radial(c, w, h, stops) {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); for (const [o, col] of stops) g.addColorStop(o, col);
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  }

  const G = {
    title: 'The Warning',
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, scene = ctx.scene, def = ctx.def, H = ctx.HUD;
      const lite = !!window.LITE_GRAPHICS || matchMedia('(pointer:coarse)').matches;
      H.title(def.title || 'The Warning'); H.score(''); H.info(''); H.hint('');

      // the room's own book: hidden while ours plays, its box gives ours its place and size
      const glb = scene.transformNodes.find(n => n.metadata?.type === 'interior_uploaded_glb' && n.metadata.assetKey === 'book' && n.isEnabled());
      let c0 = new V3(0, 1.85, 0), size = [1.05, 1.25, .3];
      if (glb) {
        const { min, max } = glb.getHierarchyBoundingVectors(true);
        const lo = ctx.toLocal(min), hi = ctx.toLocal(max);
        c0 = lo.add(hi).scale(.5);
        const d = [Math.abs(hi.x - lo.x), Math.abs(hi.y - lo.y), Math.abs(hi.z - lo.z)].sort((a, b) => b - a);
        size = [Math.min(1.1, Math.max(.5, d[1])), Math.min(1.4, Math.max(.65, d[0])), Math.min(.3, Math.max(.12, d[2]))];
        glb.setEnabled(false);
      }
      const [W, HH, TH] = size, CV = .035, OV = .03;

      // materials (kept across plays: ctx.mat)
      const std = (key, make) => ctx.mat(key, n => { const m = new B.StandardMaterial(n, scene); make(m); return m; });
      const tex = (name, w, h, draw) => canvasTex(B, scene, 'bookShowTex_' + name, w, h, draw);
      const mLeather = std('leather', m => { m.diffuseTexture = tex('leather', 512, 512, leather); m.specularColor = new B.Color3(.18, .12, .08); m.specularPower = 22; m.emissiveColor = new B.Color3(.08, .045, .03); });
      const mGold = std('gold', m => { m.diffuseColor = new B.Color3(.85, .62, .24); m.specularColor = new B.Color3(1, .86, .5); m.specularPower = 48; m.emissiveColor = new B.Color3(.28, .18, .06); });
      const mPaper = std('paper', m => { m.diffuseTexture = tex('paper', 512, 512, (c, w, h) => paper(c, w, h, true)); m.specularColor = B.Color3.Black(); m.emissiveColor = new B.Color3(.22, .19, .14); m.backFaceCulling = false; });
      const mEdge = std('edge', m => { m.diffuseColor = new B.Color3(.93, .86, .7); m.specularColor = B.Color3.Black(); m.emissiveColor = new B.Color3(.2, .17, .12); });
      const mTitle = std('titlepage', m => { m.diffuseTexture = tex('title', 512, 768, titlePage); m.specularColor = B.Color3.Black(); m.emissiveColor = new B.Color3(.32, .28, .22); });
      const mEnd = std('endpaper', m => { m.diffuseTexture = tex('endpaper', 512, 512, endpaper); m.specularColor = B.Color3.Black(); m.emissiveColor = new B.Color3(.1, .1, .08); });
      const mArt = std('cover', m => { const t = new B.Texture(def.cover || 'assets/interiors/library/the-warning-cover.webp', scene, false, true); m.diffuseTexture = t; m.emissiveTexture = t; m.emissiveColor = new B.Color3(.42, .4, .36); m.specularColor = new B.Color3(.08, .08, .08); });
      const glowMat = (key, stops) => std(key, m => { const t = tex(key, 256, 256, (c, w, h) => radial(c, w, h, stops)); t.hasAlpha = true; m.diffuseTexture = t; m.emissiveTexture = t; m.opacityTexture = t;
        m.disableLighting = true; m.alphaMode = B.Engine.ALPHA_ADD; m.backFaceCulling = false; m.useAlphaFromDiffuseTexture = true; });
      const mAura = glowMat('aura', [[0, 'rgba(255,236,190,1)'], [.25, 'rgba(255,196,96,.55)'], [.6, 'rgba(255,150,40,.16)'], [1, 'rgba(255,140,30,0)']]);
      const mPour = glowMat('pour', [[0, 'rgba(255,252,236,1)'], [.35, 'rgba(255,226,150,.75)'], [1, 'rgba(255,190,80,0)']]);
      const mRay = std('ray', m => { const t = tex('ray', 64, 512, (c, w, h) => { const g = c.createLinearGradient(0, h, 0, 0); g.addColorStop(0, 'rgba(255,240,200,.95)'); g.addColorStop(.5, 'rgba(255,206,120,.35)'); g.addColorStop(1, 'rgba(255,180,80,0)');
        c.fillStyle = g; c.beginPath(); c.moveTo(w * .42, h); c.lineTo(w * .58, h); c.lineTo(w, 0); c.lineTo(0, 0); c.closePath(); c.fill(); }); t.hasAlpha = true;
        m.diffuseTexture = t; m.emissiveTexture = t; m.opacityTexture = t; m.disableLighting = true; m.alphaMode = B.Engine.ALPHA_ADD; m.backFaceCulling = false; });
      // per play: the glow pieces fade, so each has a material of its own on the shared textures (a clone() would copy
      // the canvas textures as blank ones that never get ready: nothing drew)
      const own = (m, key) => { const c = new B.StandardMaterial('bookShow_' + key, scene);
        for (const k of ['diffuseTexture', 'emissiveTexture', 'opacityTexture', 'disableLighting', 'alphaMode', 'backFaceCulling', 'useAlphaFromDiffuseTexture']) c[k] = m[k];
        c.alpha = 0; return c; };

      // the book: root at its middle; the cover faces local -z, its spine on local -x (the reader's left)
      const root = new B.TransformNode('bookShow', scene); root.parent = ctx.frame;   // ctx.add once it has its meshes (the room's lights)
      const box = (name, w, h, d, mat, parent, x = 0, y = 0, z = 0) => { const b = B.MeshBuilder.CreateBox('bookShow_' + name, { width: w, height: h, depth: d }, scene); b.material = mat; b.parent = parent; b.position.set(x, y, z); b.isPickable = false; return b; };
      const plane = (name, w, h, mat, parent, x = 0, y = 0, z = 0, ry = 0) => { const p = B.MeshBuilder.CreatePlane('bookShow_' + name, { width: w, height: h, sideOrientation: B.Mesh.DOUBLESIDE }, scene); p.material = mat; p.parent = parent; p.position.set(x, y, z); p.rotation.y = ry; p.isPickable = false; return p; };
      const meshes = [];
      const keep = m => { meshes.push(m); return m; };
      const bw = W + OV, bh = HH + 2 * OV;
      keep(box('back', bw, bh, CV, mLeather, root, OV / 2, 0, TH / 2 - CV / 2));
      keep(box('spine', CV * 1.4, bh, TH, mLeather, root, -W / 2 - CV * .5, 0, 0));
      keep(box('block', W - .01, HH, TH - 2 * CV, mEdge, root, .005, 0, 0));
      const tp = keep(plane('title', W - .05, HH - .05, mTitle, root, .02, 0, -TH / 2 + CV - .003));
      const hinge = new B.TransformNode('bookShow_hinge', scene); hinge.parent = root; hinge.position.set(-W / 2, 0, -TH / 2 + CV / 2);
      keep(box('cover', bw, bh, CV, mLeather, hinge, bw / 2, 0, 0));
      const artH = HH * .84, artW = Math.min(W * .84, artH * 400 / 638), artH2 = artW * 638 / 400;
      keep(plane('art', artW, artH2, mArt, hinge, bw / 2, 0, -CV / 2 - .003));
      for (const [w, h, x, y] of [[artW + .05, .022, 0, artH2 / 2 + .02], [artW + .05, .022, 0, -artH2 / 2 - .02], [.022, artH2 + .06, artW / 2 + .02, 0], [.022, artH2 + .06, -artW / 2 - .02, 0]])
        keep(box('trim', w, h, .012, mGold, hinge, bw / 2 + x, y, -CV / 2 - .004));
      keep(plane('endpaper', bw - .04, bh - .04, mEnd, hinge, bw / 2, 0, CV / 2 + .003, Math.PI));
      for (const [x, y] of [[bw - .03, bh / 2 - .03], [bw - .03, -bh / 2 + .03]]) keep(box('corner', .09, .09, CV + .01, mGold, hinge, x, y, 0));
      for (const y of [-bh / 2 + .03, bh / 2 - .03]) for (const z of [-TH / 2 + CV / 2, TH / 2 - CV / 2]) keep(box('band', CV * 1.6, .05, CV + .012, mGold, root, -W / 2 - CV * .5, y, z));
      // the pages that riffle: each on its own hinge at the spine, lying on the title page until it turns
      const pages = [];
      for (let k = 0; k < PAGES; k++) {
        const pv = new B.TransformNode('bookShow_pageHinge' + k, scene); pv.parent = root; pv.position.set(-W / 2 + .004, 0, -TH / 2 + CV - .006 - k * .0007);
        const p = keep(plane('page' + k, W - .03, HH - .04, mPaper, pv, (W - .03) / 2, 0, 0)); pages.push({ pv, p, t0: T.pages0 + k * T.pageEvery * (1 - k * .02), max: Math.PI * (.955 - k * .004) });
      }
      // the light: a glow behind the book, the light pouring from the pages, rays, golden dust, a lamp on the book itself
      const aura = plane('aura', 3.6, 3.6, own(mAura, 'aura'), root, 0, 0, TH / 2 + .06); aura.billboardMode = B.Mesh.BILLBOARDMODE_ALL;
      const pour = plane('pour', W * 1.5, HH * 1.4, own(mPour, 'pour'), root, .05, 0, -TH / 2 - .02);
      const rayRoot = new B.TransformNode('bookShow_rays', scene); rayRoot.parent = root; rayRoot.position.set(.05, 0, -TH / 2 - .03);
      const rays = [];
      for (let k = 0; k < 9; k++) { const r = plane('ray' + k, .32, 2.6, own(mRay, 'ray' + k), rayRoot, 0, 1.3, 0); const piv = new B.TransformNode('bookShow_rayPivot' + k, scene); piv.parent = rayRoot; r.parent = piv; piv.rotation.z = k / 9 * Math.PI * 2 + Math.random() * .3; piv.rotation.x = -.5; rays.push({ piv, r, sp: (Math.random() < .5 ? -1 : 1) * (.08 + Math.random() * .1) }); }
      const lamp = new B.PointLight('bookShow_lamp', new V3(0, 0, -.9), scene); lamp.parent = root; lamp.diffuse = new B.Color3(1, .78, .45); lamp.specular = new B.Color3(1, .86, .6); lamp.intensity = 0; lamp.range = 6;
      for (const m of [aura, pour, ...rays.map(r => r.r)]) m.metadata = { fitSkip: true }; // an upright phone frames the book, not its glow
      lamp.includedOnlyMeshes = meshes.slice(); ctx.add(lamp); ctx.add(root);
      const ps = new B.ParticleSystem('bookShow_dust', lite ? 260 : 700, scene);
      ps.particleTexture = new B.Texture('assets/vendor/babylon/flare.png', scene);
      const dustAt = new B.TransformNode('bookShow_dustAt', scene); dustAt.parent = root; dustAt.position.set(.05, 0, -TH / 2 - .05);
      ps.emitter = new V3(); ps.minEmitBox = new V3(-W * .4, -HH * .4, 0); ps.maxEmitBox = new V3(W * .4, HH * .4, 0);
      ps.color1 = new B.Color4(1, .86, .45, 1); ps.color2 = new B.Color4(1, .62, .2, 1); ps.colorDead = new B.Color4(1, .5, .1, 0);
      ps.minSize = .02; ps.maxSize = .07; ps.minLifeTime = 1.2; ps.maxLifeTime = 2.6; ps.emitRate = 0; ps.blendMode = B.ParticleSystem.BLENDMODE_ADD;
      ps.direction1 = new V3(-.55, .35, -.55); ps.direction2 = new V3(.55, 1, .55); ps.gravity = new V3(0, .25, 0); ps.minEmitPower = .25; ps.maxEmitPower = .9; ps.updateSpeed = .016; ps.minAngularSpeed = -2; ps.maxAngularSpeed = 2;
      ps.start();

      // where it floats: risen off the lectern, turned to the reader (the player's side), a little toward them
      const pl = ctx.player?.pos ? ctx.player.pos() : new V3(c0.x, 0, c0.z + 3.6);
      let dx = pl.x - c0.x, dz = pl.z - c0.z; const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
      const yaw = Math.atan2(-dx, -dz);                         // local -z (the cover) toward the reader
      const flat = B.Quaternion.FromEulerAngles(Math.PI / 2 - .32, yaw, 0), up = B.Quaternion.FromEulerAngles(.08, yaw, 0);
      const p1 = new V3(c0.x + dx * .35, c0.y + .72, c0.z + dz * .35);
      root.position.copyFrom(c0); root.rotationQuaternion = flat.clone();
      // the camera: from where the walk camera is to a close view of the floating book (frame coordinates)
      const cam = ctx.camera, camFrom = ctx.toLocal(cam.position.clone()), tgtFrom = ctx.toLocal(cam.getTarget ? cam.getTarget().clone() : c0.clone());
      const camTo = d => new V3(p1.x + dx * d, p1.y + .06, p1.z + dz * d);

      // the sound: a low swell and bells as it wakes, the cover's creak and whoosh, the pages riffling, a choir of light,
      // a bright bell when the light fills the view (Web Audio on the games' music bus)
      const A = ctx.audio && ctx.audio();
      function sounds() {
        if (!A) return;
        const ac = A.ctx, out = A.out, t0 = ac.currentTime + (A.latency || 0) + .02;
        const env = (g, t, a, peak, hold, rel) => { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.setValueAtTime(peak, t + a + hold); g.gain.exponentialRampToValueAtTime(.0001, t + a + hold + rel); };
        const osc = (f, t, a, peak, hold, rel, type = 'sine', to, glide) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + (glide || a + hold)); env(g, t, a, peak, hold, rel); o.connect(g); g.connect(out); o.start(t); o.stop(t + a + hold + rel + .05); return o; };
        let nb = null; const noiseBuf = () => { if (nb) return nb; const n = ac.sampleRate * 2; nb = ac.createBuffer(1, n, ac.sampleRate); const d = nb.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return nb; };
        const noise = (t, dur, peak, type, f, q = 1, to, a = .005) => { const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = noiseBuf(); fl.type = type; fl.frequency.setValueAtTime(f, t); if (to) fl.frequency.exponentialRampToValueAtTime(to, t + dur); fl.Q.value = q;
          g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + dur); s.connect(fl); fl.connect(g); g.connect(out); s.start(t, Math.random()); s.stop(t + dur + .05); };
        // the swell (A minor, low), the bells waking
        const pad = ac.createBiquadFilter(); pad.type = 'lowpass'; pad.frequency.value = 700; pad.connect(out);
        for (const f of [110, 164.8, 220, 261.6]) { const o = ac.createOscillator(), g = ac.createGain(); o.type = 'triangle'; o.frequency.value = f; o.detune.value = (Math.random() - .5) * 12; env(g, t0, 1.4, .045, 2.4, 1.6); o.connect(g); g.connect(pad); o.start(t0); o.stop(t0 + 5.6); }
        [1318.5, 1568, 1975.5, 2349.3, 2637, 3136].forEach((f, k) => osc(f * (1 + (Math.random() - .5) * .004), t0 + k * .07, .005, .03, 0, 1.4));
        // the cover: a creak of the old leather, the whoosh of the swing
        noise(t0 + T.cover0, .45, .05, 'bandpass', 420, 6, 1100, .06);
        noise(t0 + T.cover0 + .1, .75, .08, 'bandpass', 320, 1.2, 1900, .25);
        // the pages riffling
        for (let k = 0; k < PAGES; k++) { const t = t0 + T.pages0 + k * T.pageEvery * (1 - k * .02) + .18; noise(t, .05 + Math.random() * .03, .045 + Math.random() * .03, 'highpass', 1800 + Math.random() * 1400, .8); }
        // the light pouring out: a rising glide, a soft choir of three
        osc(440, t0 + T.pour, .9, .02, .8, 1.2, 'sine', 880, 1.6);
        for (const f of [440, 554.4, 659.3, 880]) { const o = osc(f, t0 + T.pour + .2, 1.2, .022, 1.4, 1.6, 'triangle'); const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 5 + Math.random(); lg.gain.value = 4; lfo.connect(lg); lg.connect(o.frequency); lfo.start(t0 + T.pour); lfo.stop(t0 + T.pour + 4.4); }
        // the light fills the view: a bright bell and a breath of air
        for (const [f, p] of [[1760, .05], [2637, .025], [4186, .012]]) osc(f, t0 + T.white0, .004, p, 0, 2.6);
        noise(t0 + T.white0 - .3, 1.8, .04, 'bandpass', 800, .7, 3200, .6);
      }
      sounds();

      // the screen's own light and the card (on top of the game view)
      const veil = document.createElement('div');
      veil.style.cssText = 'position:fixed;inset:0;z-index:70;pointer-events:none;opacity:0;background:radial-gradient(circle at 50% 46%,rgba(255,248,226,.96),rgba(255,214,140,.72) 38%,rgba(120,70,20,.35) 72%,rgba(10,6,4,.2))';
      document.body.append(veil);
      const card = document.createElement('div');
      card.className = 'bookShowCard';
      card.innerHTML = `<style>
        .bookShowCard{position:fixed;left:50%;top:50%;transform:translate(-50%,-46%) scale(.96);opacity:0;transition:opacity .45s,transform .45s;z-index:71;width:min(560px,calc(100vw - 28px));max-height:calc(100vh - 28px);overflow:auto;box-sizing:border-box;
          background:linear-gradient(160deg,rgba(26,18,10,.96),rgba(10,8,16,.97));border:1px solid rgba(232,197,106,.55);border-radius:14px;box-shadow:0 0 60px rgba(255,196,96,.35),0 20px 60px rgba(0,0,0,.6);padding:20px 22px;color:#eadfc8;font-family:'Noto Serif JP',Georgia,serif;pointer-events:auto}
        .bookShowCard.on{opacity:1;transform:translate(-50%,-50%) scale(1)}
        .bookShowCard .bk-top{display:flex;gap:18px;align-items:flex-start}
        .bookShowCard img{width:128px;height:auto;border-radius:4px;box-shadow:0 0 22px rgba(255,200,110,.45);flex:none}
        .bookShowCard .bk-kick{font-family:'Cinzel Decorative',serif;font-size:11px;letter-spacing:3px;color:#5ecfca;margin:2px 0 6px}
        .bookShowCard h2{font-family:'Cinzel Decorative',serif;font-weight:900;font-size:26px;color:#e8c56a;margin:0;letter-spacing:2px;text-shadow:0 0 18px rgba(232,197,106,.55)}
        .bookShowCard .bk-sub{font-size:12px;color:#cdbb95;margin:4px 0 10px;letter-spacing:1px}
        .bookShowCard .bk-text{font-size:13px;line-height:1.55;color:#e4d8be;white-space:pre-line;max-height:9.5em;overflow:auto}
        .bookShowCard .bk-note{font-size:11.5px;color:#a99a7c;margin:12px 0 0}
        .bookShowCard .bk-btns{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}
        .bookShowCard .bk-btns a,.bookShowCard .bk-btns button{flex:1 1 auto;min-height:42px;padding:10px 14px;border-radius:9px;font:700 13px 'Noto Serif JP',Georgia,serif;letter-spacing:.5px;cursor:pointer;text-align:center;text-decoration:none;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center}
        .bookShowCard .bk-read{background:linear-gradient(180deg,#f0d084,#c99a3e);color:#1d1408;border:1px solid #f6dea0}
        .bookShowCard .bk-lib{background:rgba(94,207,202,.12);color:#9ee8e4;border:1px solid rgba(94,207,202,.55)}
        .bookShowCard .bk-close{background:transparent;color:#cdbb95;border:1px solid rgba(205,187,149,.4);flex:0 1 auto}
        @media (max-width:520px){.bookShowCard{padding:16px}.bookShowCard img{width:86px}.bookShowCard h2{font-size:21px}.bookShowCard .bk-btns a,.bookShowCard .bk-btns button{flex:1 1 100%}}
        </style>
        <div class="bk-top"><img alt=""><div><div class="bk-kick">THE COLONY LIBRARY</div><h2></h2><div class="bk-sub"></div><div class="bk-text"></div></div></div>
        <div class="bk-note">The free sample has the narrated prologue and the opening pages. The digital edition is in the Library.</div>
        <div class="bk-btns"><a class="bk-read" target="_blank" rel="noopener">Read the free sample ↗</a><a class="bk-lib" target="_blank" rel="noopener">Visit the Colony Library ↗</a><button class="bk-close" type="button">Close</button></div>`;
      card.querySelector('img').src = def.cover || 'assets/interiors/library/the-warning-cover.webp';
      card.querySelector('h2').textContent = def.title || 'The Warning';
      card.querySelector('.bk-sub').textContent = def.sub || 'Volume 1 · by Miguel Concepcion';
      card.querySelector('.bk-text').textContent = def.text || '';
      card.querySelector('.bk-read').href = def.sample || 'https://library.rebelants.io/index.html?start=0';
      card.querySelector('.bk-lib').href = def.url || 'https://library.rebelants.io/';
      card.querySelector('.bk-close').onclick = e => { e.stopPropagation(); close(); };
      // a link opens a new tab; the book stays open for when the player comes back
      card.querySelectorAll('a').forEach(a => a.addEventListener('click', e => e.stopPropagation()));
      card.addEventListener('pointerdown', e => e.stopPropagation());
      card.hidden = true; document.body.append(card);

      const st = { t: 0, closing: -1, cardShown: false, hid: false };
      function close() { if (st.closing < 0) { st.closing = 0; card.classList.remove('on'); setTimeout(() => { card.hidden = true; }, 450); } }
      const q = new B.Quaternion();
      const inst = {
        update(dt) {
          dt = Math.min(dt, .1); st.t += dt;
          const t = st.t;
          // closing: the pages and the cover fall shut, the book settles back on the lectern, then the show ends
          let shut = 0;
          if (st.closing >= 0) { st.closing += dt; shut = smooth(st.closing / .8); if (st.closing > 1.05) { ctx.quit(); return; } }
          // the rise and turn
          const r = easeOut(t / T.rise) * (1 - shut);
          B.Quaternion.SlerpToRef(flat, up, r, q); root.rotationQuaternion.copyFrom(q);
          root.position.set(lerp(c0.x, p1.x, r), lerp(c0.y, p1.y, r) + Math.sin(t * 1.7) * .02 * r, lerp(c0.z, p1.z, r));
          // the cover, then the pages
          hinge.rotation.y = Math.PI * .97 * easeInOut((t - T.cover0) / (T.cover1 - T.cover0)) * (1 - shut);
          for (const pg of pages) pg.pv.rotation.y = pg.max * easeInOut((t - pg.t0) / T.pageDur) * (1 - shut);
          // the light
          const wake = .75 * (1 - smooth(t / 1.1)),     // a flash as the book wakes (and takes the room book's place)
             pourK = smooth((t - T.pour) / 1.1) * (1 - shut);
          aura.material.alpha = Math.min(1, wake + .5 * pourK + .25 * smooth(t / 1.2) * (1 - shut));
          pour.material.alpha = .55 * pourK * (.85 + .15 * Math.sin(t * 3.1));   // the title page still reads through it
          rays.forEach(({ piv, r: ray, sp }, k) => { piv.rotation.z += sp * dt; ray.material.alpha = .42 * pourK * (.6 + .4 * Math.sin(t * 2 + k)); ray.scaling.y = .6 + .4 * pourK; });
          lamp.intensity = 1.8 * Math.max(wake, pourK, .35 * smooth(t / 1.2) * (1 - shut));
          dustAt.computeWorldMatrix(true); ps.emitter.copyFrom(dustAt.getAbsolutePosition());
          ps.emitRate = st.closing >= 0 ? 0 : t < T.pour ? 20 * smooth(t) : t < T.pour + 1 ? 420 : 90;
          // the screen fills with the light, then clears behind the card
          const white = smooth((t - T.white0) / (T.white1 - T.white0)) * (1 - smooth((t - T.white1) / .9));
          veil.style.opacity = String(Math.max(0, white * .92 + (t > T.white1 ? .28 : 0) * (1 - shut)));
          if (!st.cardShown && t >= T.card) { st.cardShown = true; card.hidden = false; requestAnimationFrame(() => card.classList.add('on')); }
          // the camera (it passes through the Rebel on its way in: the Rebel steps out of sight for the show)
          if (!st.hid && t > .45 && st.closing < 0) { st.hid = true; ctx.player?.show?.(false); }
          if (st.hid && st.closing > .45) { st.hid = false; ctx.player?.show?.(true); }
          const k = smooth(t / 1.3), push = 3.05 - .25 * smooth((t - 1.3) / 2.4), open = smooth((t - T.cover0) / (T.cover1 - T.cover0)) * (1 - shut);
          hinge.computeWorldMatrix(true); const aim = V3.Lerp(root.position, ctx.toLocal(hinge.getAbsolutePosition()), open * .9);
          const cp = camTo(push).add(aim.subtract(root.position)), back = smooth(shut);
          const pos = V3.Lerp(V3.Lerp(camFrom, cp, k), camFrom, back), tg = V3.Lerp(V3.Lerp(tgtFrom, aim, k), tgtFrom, back);
          ctx.look([pos.x, pos.y, pos.z], [tg.x, tg.y, tg.z], .72);
        },
        key(e, down) {
          if (!down) return false;
          const k = e.key.toLowerCase();
          if ((k === 'enter' || k === ' ' || k === 'o') && st.cardShown) { close(); return true; }
          return false;
        },
        dispose() {
          try { ps.dispose(); } catch (e) {}
          veil.remove(); card.remove();
          [aura, pour, ...rays.map(r => r.r)].forEach(m => { try { m.material?.dispose(); } catch (e) {} });
          if (glb && !glb.isDisposed?.()) glb.setEnabled(true);
          if (st.hid) ctx.player?.show?.(true);
        }
      };
      inst._test = { st, root, hinge, pages, card, veil, close, size, c0, p1 };
      return inst;
    }
  };
  window.RebelGames.register('book', G);
})();
