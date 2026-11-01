// Photo sharing (Nov 1): the photo camera's picture made ready for a social post.
// PhotoShare.compose(src, { caption }) draws the polaroid: the picture in the cream print the photo card shows, tilted,
// a strip of tape on it and the Rebel Ants Universe sticker on its corner, on a blurred, darkened copy of the same
// picture, with "Check me out in the Rebel Universe" under it. 1080 x 1350 (Instagram's portrait size; X and TikTok
// show it whole). The picture keeps its shape between 3:4 and 16:9: a wider one is cut at the sides, an upright phone's
// to 3:4 round its middle.
// -> { canvas, jpeg (Blob), png() (Promise<Blob>, made once on first ask: what a computer's clipboard takes) }
(function () {
  const W = 1080, H = 1350;
  const TEXT = 'Check me out in the Rebel Universe \u{1F41C} #RebelAnts #RebelUniverse';
  const LINK = 'https://rebeluniverse.io';
  const CREAM = '#f6f0e2', INK = '#3b2a14', GOLD = '#d8b35c';
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
  // a canvas filter, which Safari has only lately)
  function backdrop(g, img) {
    const s = Math.max(W / img.width, H / img.height);
    const tiny = canvas(W / 24, H / 24), tg = tiny.getContext('2d');
    tg.imageSmoothingEnabled = true; tg.imageSmoothingQuality = 'high';
    const iw = img.width * s / 24, ih = img.height * s / 24;
    tg.drawImage(img, (tiny.width - iw) / 2, (tiny.height - ih) / 2, iw, ih);
    const mid = canvas(W / 6, H / 6), mg = mid.getContext('2d');
    mg.imageSmoothingEnabled = true; mg.imageSmoothingQuality = 'high';
    mg.drawImage(tiny, 0, 0, mid.width, mid.height);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(mid, 0, 0, W, H);
    g.fillStyle = 'rgba(6,8,14,.42)'; g.fillRect(0, 0, W, H);
    const v = g.createRadialGradient(W / 2, H * 0.44, H * 0.18, W / 2, H * 0.5, H * 0.78);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.6)');
    g.fillStyle = v; g.fillRect(0, 0, W, H);
    const b = g.createLinearGradient(0, H * 0.7, 0, H);
    b.addColorStop(0, 'rgba(5,6,10,0)'); b.addColorStop(1, 'rgba(5,6,10,.82)');
    g.fillStyle = b; g.fillRect(0, 0, W, H);
  }
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

  async function compose(src, opts = {}) {
    const [img, logo] = await Promise.all([loadImage(src), sticker(), fonts()]);
    const caption = String(opts.caption || '');
    const tilt = Number.isFinite(opts.tilt) ? opts.tilt : -6;
    const c = canvas(W, H), g = c.getContext('2d');
    backdrop(g, img);

    // the picture's crop: between 3:4 and 16:9
    const a0 = img.width / img.height, a = Math.min(16 / 9, Math.max(3 / 4, a0));
    let sx = 0, sy = 0, sw = img.width, sh = img.height;
    if (a0 > a) { sw = img.height * a; sx = (img.width - sw) / 2; }
    else if (a0 < a) { sh = img.width / a; sy = Math.max(0, Math.min(img.height - sh, img.height * 0.52 - sh / 2)); }

    // the print: as wide as 900 px while its height stays within 880
    const cw = Math.min(900, 880 / (0.22 + 0.9 / a));
    const pad = cw * 0.05, pw = cw - 2 * pad, ph = pw / a, foot = cw * 0.17, ch = pad + ph + foot;
    const cx = W / 2 - 18, cy = 606, rad = tilt * Math.PI / 180;

    g.save(); g.translate(cx, cy); g.rotate(rad);
    g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 48; g.shadowOffsetX = 10; g.shadowOffsetY = 26;
    roundRect(g, -cw / 2, -ch / 2, cw, ch, 8); g.fillStyle = CREAM; g.fill();
    g.shadowColor = 'transparent';
    const paper = g.createLinearGradient(-cw / 2, -ch / 2, cw / 2, ch / 2);
    paper.addColorStop(0, 'rgba(255,255,255,.35)'); paper.addColorStop(1, 'rgba(120,90,40,.12)');
    g.fillStyle = paper; g.fill();
    const px = -cw / 2 + pad, py = -ch / 2 + pad;
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, sx, sy, sw, sh, px, py, pw, ph);
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

    // the sticker on the print's top right corner, turned the other way
    if (logo) {
      const size = Math.max(230, cw * 0.31);
      const k = { x: cw / 2 - size * 0.05, y: -ch / 2 + size * 0.04 };
      let x = cx + k.x * Math.cos(rad) - k.y * Math.sin(rad), y = cy + k.x * Math.sin(rad) + k.y * Math.cos(rad);
      x = Math.min(W - size / 2 - 18, x); y = Math.max(size / 2 + 18, y);
      g.save(); g.translate(x, y); g.rotate(12 * Math.PI / 180);
      g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 28; g.shadowOffsetY = 12;
      g.drawImage(logo, -size / 2, -size / 2, size, size);
      g.restore();
    }

    // the line under it
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    if ('letterSpacing' in g) g.letterSpacing = '6px';
    g.fillStyle = GOLD;
    fit(g, 'CHECK ME OUT IN THE', 700, 34, '"Cinzel Decorative", Georgia, serif', W - 120);
    g.fillText('CHECK ME OUT IN THE', W / 2, 1150);
    if ('letterSpacing' in g) g.letterSpacing = '3px';
    g.save();
    g.shadowColor = 'rgba(255,160,60,.55)'; g.shadowBlur = 26;
    g.fillStyle = '#ffe9b0';
    const mark = 'REBEL\u2002UNIVERSE';
    fit(g, mark, 900, 78, '"Cinzel Decorative", Georgia, serif', W - 100);
    g.fillText(mark, W / 2, 1236);
    g.restore();
    if ('letterSpacing' in g) g.letterSpacing = '2px';
    g.fillStyle = 'rgba(233,220,192,.88)';
    const foot2 = 'rebeluniverse.io  \u00B7  #RebelAnts';
    fit(g, foot2, 600, 28, 'Georgia, "Times New Roman", serif', W - 120);
    g.fillText(foot2, W / 2, 1296);
    if ('letterSpacing' in g) g.letterSpacing = '0px';

    const jpeg = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('no picture'))), 'image/jpeg', 0.92));
    let pngP = null;
    const png = () => (pngP ||= new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('no picture'))), 'image/png')));
    return { canvas: c, jpeg, png, width: W, height: H };
  }

  window.PhotoShare = { compose, TEXT, LINK, size: { W, H } };
})();
