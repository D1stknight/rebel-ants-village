// Photo sharing (Nov 1): the photo camera's picture made ready for a social post.
// PhotoShare.compose(src, { caption }) draws the polaroid: the picture in the cream print the photo card shows, tilted,
// a strip of tape on it and the Rebel Ants Universe sticker on its corner, on a blurred, darkened copy of the same
// picture, with "Check me out in the Rebel Universe" under it. 1080 x 1350 (Instagram's portrait size; X and TikTok
// show it whole). The picture keeps its shape between 3:4 and 16:9: a wider one is cut at the sides, an upright phone's
// to 3:4 round its middle.
// -> { canvas, jpeg (Blob), png() (Promise<Blob>, made once on first ask: what a computer's clipboard takes) }
// Clips (Nov 1): PhotoShare.clipStage({ srcW, srcH, caption }) builds the same polaroid for a moving picture, 720 x 1280
// (9:16, what TikTok, Reels and Shorts show full screen): the parts that never move are drawn once (the shade and the
// print's paper under the picture; the gloss, caption, tape, sticker and the line over it) and stage.frame(g, canvas)
// draws one video frame: the blurred copy of the game's frame, those two layers and the frame in the print.
(function () {
  const W = 1080, H = 1350;
  const TEXT = 'Check me out in the Rebel Universe \u{1F41C} #RebelAnts #RebelUniverse';
  const LINK = 'https://rebeluniverse.io';
  const CREAM = '#f6f0e2', INK = '#3b2a14', GOLD = '#d8b35c';
  // the two formats: the picture's print as wide as maxW while its height stays within maxH, its middle at (cx, cy);
  // the line under it (three rows: y, size, room left for it, letter spacing; the middle row's glow)
  const PHOTO = { W, H, maxW: 900, maxH: 880, cx: W / 2 - 18, cy: 606, stickerMin: 230,
    tag: { y: [1150, 1236, 1296], size: [34, 78, 28], room: [120, 100, 120], ls: ['6px', '3px', '2px'], glow: 26 } };
  const CLIP = { W: 720, H: 1280, maxW: 640, maxH: 660, cx: 720 / 2 - 10, cy: 470, stickerMin: 150,
    tag: { size: [24, 54, 20], room: [80, 64, 80], ls: ['4px', '2px', '1.5px'], glow: 18 } };
  let logoP = null;

  function loadImage(src) {
    return new Promise((res, rej) => { const im = new Image(); im.decoding = 'async'; im.onload = () => res(im); im.onerror = () => rej(new Error('image did not load')); im.src = src; });
  }
  // the sticker (assets/brand/logo-sticker.webp: the lobby's Rebel Ants Universe badge at 400 px); none if it can't load
  function sticker() {
    if (!logoP) logoP = loadImage('assets/brand/logo-sticker.webp').catch(() => { logoP = null; return null; });
    return logoP;
  }
  // the page's own fonts (Cinzel Decorative comes with village.html); at most 1.5 s, then whatever the browser has
  function fonts() {
    const f = document.fonts;
    if (!f?.load) return Promise.resolve();
    const want = Promise.all(['900 76px "Cinzel Decorative"', '700 34px "Cinzel Decorative"'].map((s) => f.load(s).catch(() => null)));
    return Promise.race([want, new Promise((r) => setTimeout(r, 1500))]);
  }
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
  function roundRect(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r); g.lineTo(x + w, y + h - r);
    g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r);
    g.quadraticCurveTo(x, y, x + r, y); g.closePath();
  }
  // the largest font size (from `size` down) at which `text` fits in maxW
  function fit(g, text, weight, size, family, maxW) {
    let s = size;
    for (;;) { g.font = `${weight} ${s}px ${family}`; if (g.measureText(text).width <= maxW || s <= 12) return s; s -= 2; }
  }
  // a soft blur of the picture filling the frame: drawn small, then larger in steps (smooth in every browser, unlike
  // a canvas filter, which Safari has only lately); tiny / mid: the two small canvases (made here when not given)
  function blur(g, img, w, h, tiny, mid) {
    const iw0 = img.videoWidth || img.width, ih0 = img.videoHeight || img.height;
    const s = Math.max(w / iw0, h / ih0);
    tiny ||= canvas(w / 24, h / 24); const tg = tiny.getContext('2d');
    tg.imageSmoothingEnabled = true; tg.imageSmoothingQuality = 'high';
    const iw = iw0 * s / 24, ih = ih0 * s / 24;
    tg.drawImage(img, (tiny.width - iw) / 2, (tiny.height - ih) / 2, iw, ih);
    mid ||= canvas(w / 6, h / 6); const mg = mid.getContext('2d');
    mg.imageSmoothingEnabled = true; mg.imageSmoothingQuality = 'high';
    mg.drawImage(tiny, 0, 0, mid.width, mid.height);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(mid, 0, 0, w, h);
  }
  // darker, a vignette, the bottom darkest (where the line goes)
  function shade(g, w, h) {
    g.fillStyle = 'rgba(6,8,14,.42)'; g.fillRect(0, 0, w, h);
    const v = g.createRadialGradient(w / 2, h * 0.44, h * 0.18, w / 2, h * 0.5, h * 0.78);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.6)');
    g.fillStyle = v; g.fillRect(0, 0, w, h);
    const b = g.createLinearGradient(0, h * 0.7, 0, h);
    b.addColorStop(0, 'rgba(5,6,10,0)'); b.addColorStop(1, 'rgba(5,6,10,.82)');
    g.fillStyle = b; g.fillRect(0, 0, w, h);
  }
  function backdrop(g, img) { blur(g, img, W, H); shade(g, W, H); }
  // a strip of paper tape across the print's top edge (in the print's own frame), torn at both ends
  function tape(g, cx, cy, w, h, deg) {
    g.save(); g.translate(cx, cy); g.rotate(deg * Math.PI / 180);
    const teeth = 7, tw = h / teeth;
    g.beginPath(); g.moveTo(-w / 2, -h / 2);
    g.lineTo(w / 2, -h / 2);
    for (let i = 0; i < teeth; i++) g.lineTo(w / 2 + (i % 2 ? 0 : 5), -h / 2 + (i + 1) * tw);
    g.lineTo(-w / 2, h / 2);
    for (let i = teeth - 1; i >= 0; i--) g.lineTo(-w / 2 - (i % 2 ? 0 : 5), -h / 2 + i * tw);
    g.closePath();
    g.shadowColor = 'rgba(0,0,0,.18)'; g.shadowBlur = 6; g.shadowOffsetY = 2;
    g.fillStyle = 'rgba(232,206,140,.72)'; g.fill();
    g.shadowColor = 'transparent';
    g.clip();
    g.strokeStyle = 'rgba(255,255,255,.16)'; g.lineWidth = 6;
    for (let x = -w; x < w; x += 18) { g.beginPath(); g.moveTo(x, -h); g.lineTo(x + h * 2, h); g.stroke(); }
    g.restore();
  }

  // where things go for a picture of iw x ih in format F, the print tilted `tilt` degrees
  function layout(F, iw, ih, tilt) {
    const a = Math.min(16 / 9, Math.max(3 / 4, iw / ih));
    const cw = Math.min(F.maxW, F.maxH / (0.22 + 0.9 / a));
    const pad = cw * 0.05, pw = cw - 2 * pad, ph = pw / a, foot = cw * 0.17, ch = pad + ph + foot;
    return { F, a, cw, pad, pw, ph, foot, ch, cx: F.cx, cy: F.cy, rad: tilt * Math.PI / 180, px: -cw / 2 + pad, py: -ch / 2 + pad };
  }
  // the picture's crop: between 3:4 and 16:9 (L.a)
  function crop(L, iw, ih) {
    const a0 = iw / ih, a = L.a;
    let sx = 0, sy = 0, sw = iw, sh = ih;
    if (a0 > a) { sw = ih * a; sx = (iw - sw) / 2; }
    else if (a0 < a) { sh = iw / a; sy = Math.max(0, Math.min(ih - sh, ih * 0.52 - sh / 2)); }
    return [sx, sy, sw, sh];
  }
  // the print's paper (with its shadow), the picture on it, then what lies over the picture
  function paper(g, L) {
    const { cw, ch } = L;
    g.save(); g.translate(L.cx, L.cy); g.rotate(L.rad);
    g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 48; g.shadowOffsetX = 10; g.shadowOffsetY = 26;
    roundRect(g, -cw / 2, -ch / 2, cw, ch, 8); g.fillStyle = CREAM; g.fill();
    g.shadowColor = 'transparent';
    const p = g.createLinearGradient(-cw / 2, -ch / 2, cw / 2, ch / 2);
    p.addColorStop(0, 'rgba(255,255,255,.35)'); p.addColorStop(1, 'rgba(120,90,40,.12)');
    g.fillStyle = p; g.fill();
    g.restore();
  }
  function picture(g, L, img, c, q) {
    g.save(); g.translate(L.cx, L.cy); g.rotate(L.rad);
    g.imageSmoothingQuality = q || 'high';
    g.drawImage(img, c[0], c[1], c[2], c[3], L.px, L.py, L.pw, L.ph);
    g.restore();
  }
  function overPicture(g, L, caption) {
    const { cw, ch, px, py, pw, ph, foot } = L;
    g.save(); g.translate(L.cx, L.cy); g.rotate(L.rad);
    g.shadowOffsetX = 10; g.shadowOffsetY = 26; g.shadowBlur = 48; g.shadowColor = 'transparent'; // (the tape's shadow keeps the paper's x offset, as it always had)
    const gloss = g.createLinearGradient(px, py, px + pw, py + ph);
    gloss.addColorStop(0, 'rgba(255,255,255,.10)'); gloss.addColorStop(0.45, 'rgba(255,255,255,0)');
    g.fillStyle = gloss; g.fillRect(px, py, pw, ph);
    g.strokeStyle = 'rgba(40,25,10,.3)'; g.lineWidth = 2; g.strokeRect(px, py, pw, ph);
    if (caption) {
      g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle';
      fit(g, caption, 600, Math.round(cw * 0.04), 'Georgia, "Times New Roman", serif', pw * 0.94);
      g.fillText(caption, 0, py + ph + foot * 0.5);
    }
    tape(g, -cw * 0.24, -ch / 2, cw * 0.27, cw * 0.075, 8);
    g.restore();
  }
  // the sticker on the print's top right corner, turned the other way
  function stickerOn(g, L, logo) {
    if (!logo) return;
    const { cw, ch, cx, cy, rad, F } = L;
    const size = Math.max(F.stickerMin, cw * 0.31);
    const k = { x: cw / 2 - size * 0.05, y: -ch / 2 + size * 0.04 };
    let x = cx + k.x * Math.cos(rad) - k.y * Math.sin(rad), y = cy + k.x * Math.sin(rad) + k.y * Math.cos(rad);
    x = Math.min(F.W - size / 2 - 18, x); y = Math.max(size / 2 + 18, y);
    g.save(); g.translate(x, y); g.rotate(12 * Math.PI / 180);
    g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 28; g.shadowOffsetY = 12;
    g.drawImage(logo, -size / 2, -size / 2, size, size);
    g.restore();
  }
  // the line under it
  function tagline(g, F, ys) {
    const T = F.tag, w = F.W;
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    if ('letterSpacing' in g) g.letterSpacing = T.ls[0];
    g.fillStyle = GOLD;
    fit(g, 'CHECK ME OUT IN THE', 700, T.size[0], '"Cinzel Decorative", Georgia, serif', w - T.room[0]);
    g.fillText('CHECK ME OUT IN THE', w / 2, ys[0]);
    if ('letterSpacing' in g) g.letterSpacing = T.ls[1];
    g.save();
    g.shadowColor = 'rgba(255,160,60,.55)'; g.shadowBlur = T.glow;
    g.fillStyle = '#ffe9b0';
    const mark = 'REBEL\u2002UNIVERSE';
    fit(g, mark, 900, T.size[1], '"Cinzel Decorative", Georgia, serif', w - T.room[1]);
    g.fillText(mark, w / 2, ys[1]);
    g.restore();
    if ('letterSpacing' in g) g.letterSpacing = T.ls[2];
    g.fillStyle = 'rgba(233,220,192,.88)';
    const foot2 = 'rebeluniverse.io  \u00B7  #RebelAnts';
    fit(g, foot2, 600, T.size[2], 'Georgia, "Times New Roman", serif', w - T.room[2]);
    g.fillText(foot2, w / 2, ys[2]);
    if ('letterSpacing' in g) g.letterSpacing = '0px';
  }

  async function compose(src, opts = {}) {
    const [img, logo] = await Promise.all([loadImage(src), sticker(), fonts()]);
    const caption = String(opts.caption || '');
    const tilt = Number.isFinite(opts.tilt) ? opts.tilt : -6;
    const c = canvas(W, H), g = c.getContext('2d');
    backdrop(g, img);
    const L = layout(PHOTO, img.width, img.height, tilt);
    paper(g, L);
    picture(g, L, img, crop(L, img.width, img.height));
    overPicture(g, L, caption);
    stickerOn(g, L, logo);
    tagline(g, PHOTO, PHOTO.tag.y);
    const jpeg = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('no picture'))), 'image/jpeg', 0.92));
    let pngP = null;
    const png = () => (pngP ||= new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('no picture'))), 'image/png')));
    return { canvas: c, jpeg, png, width: W, height: H };
  }

  // the clip's stage: { W, H, frame(g, src) -> bool }. The line sits under the print with room to spare at the
  // bottom, where TikTok and Reels lay their own caption over the video.
  async function clipStage(opts = {}) {
    const [logo] = await Promise.all([sticker(), fonts()]);
    const F = CLIP, w = F.W, h = F.H;
    const L = layout(F, Math.max(1, opts.srcW || 16), Math.max(1, opts.srcH || 9), Number.isFinite(opts.tilt) ? opts.tilt : -6);
    const tall = L.ch * Math.cos(L.rad) + L.cw * Math.abs(Math.sin(L.rad));
    const y0 = Math.round(L.cy + tall / 2 + 58), ys = [y0, y0 + 64, y0 + 110];
    const under = canvas(w, h), ug = under.getContext('2d');
    shade(ug, w, h); paper(ug, L);
    const over = canvas(w, h), og = over.getContext('2d');
    overPicture(og, L, String(opts.caption || '')); stickerOn(og, L, logo); tagline(og, F, ys);
    // the moving backdrop: the frame drawn into a small canvas (mipmapped, blurred where the canvas has a filter) and
    // stretched over the clip; that canvas is big enough that browsers keep it on the graphics card (a smaller one
    // lives in memory, and drawing the game's frame into it reads the whole frame back every time)
    const back = canvas(w / 6, h / 6), bg = back.getContext('2d', { alpha: false });
    const soft = typeof CanvasRenderingContext2D !== 'undefined' && 'filter' in CanvasRenderingContext2D.prototype;
    function backdropOf(g, src, iw, ih) {
      const bw = back.width, bh = back.height, s = Math.max(bw / iw, bh / ih) * 1.08, dw = iw * s, dh = ih * s;
      bg.imageSmoothingEnabled = true; bg.imageSmoothingQuality = 'medium';
      if (soft) bg.filter = 'blur(3px)';
      bg.drawImage(src, (bw - dw) / 2, (bh - dh) / 2, dw, dh);
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'low';
      g.drawImage(back, 0, 0, w, h);
    }
    function frame(g, src) {
      const iw = src.videoWidth || src.width, ih = src.videoHeight || src.height;
      if (!iw || !ih) return false;
      backdropOf(g, src, iw, ih);
      g.drawImage(under, 0, 0);
      picture(g, L, src, crop(L, iw, ih), 'medium');
      g.drawImage(over, 0, 0);
      return true;
    }
    return { W: w, H: h, L, ys, frame };
  }

  window.PhotoShare = { compose, clipStage, TEXT, LINK, size: { W, H }, clipSize: { W: CLIP.W, H: CLIP.H } };
})();
