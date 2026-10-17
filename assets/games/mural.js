// Street Art (Oct 16, Saints of LA): a mural on the garage's east wall has tiles missing. The loose tiles wait on the
// paint cart under the wall: click one to pick it up, click the gap it belongs in. From level 3 the tiles lie turned:
// click the held tile again (or R / a right click) to turn it a quarter. Level 5 has strays from another wall mixed in.
// A tile goes in only where its picture fits (tiles that look the same fit either gap); a wrong gap or turn is a
// mistake (-5). H flashes where the held tile goes (a mistake too). Ten murals (Oct 17, Miguel: "a button once you
// complete one that takes you to the next level ... 10 levels, 10 being very hard"), 4 x 2 up to 16 x 8: Saints Blvd,
// Venice Beach, Saints in Neon (patterns that repeat), Golden Dragon and Halo (gold on gold, its strays the closest
// look-alikes that fit no gap); a level opens when the one before is done (remembered on this device), and the result
// card's Next wall goes straight on.
// def: { wall: 8 (metres from the spot to the wall), pass, points, cam, at }
(function () {
  const LEVELS = [
    { c: 4, r: 2, miss: 3, turn: false, art: 'sunset' },
    { c: 6, r: 3, miss: 6, turn: false, art: 'wings' },
    { c: 8, r: 4, miss: 10, turn: true, art: 'lowrider' },
    { c: 10, r: 5, miss: 14, turn: true, art: 'court' },
    { c: 12, r: 6, miss: 18, turn: true, art: 'angels', strays: 4 },
    { c: 12, r: 6, miss: 22, turn: true, art: 'boulevard', strays: 4 },
    { c: 14, r: 7, miss: 28, turn: true, art: 'venice', strays: 6 },
    { c: 14, r: 7, miss: 34, turn: true, art: 'neon', strays: 8 },
    { c: 16, r: 8, miss: 40, turn: true, art: 'dragon', strays: 10 },
    { c: 16, r: 8, miss: 48, turn: true, art: 'halo', strays: 12, lookalike: true }];
  const BASE = [30, 50, 70, 100, 140, 170, 200, 240, 280, 340];
  const AW = 2048, AH = 1024;
  // ---------- the murals (drawn on a 2048 x 1024 canvas; rnd = a seeded random so a mural is the same every play) ----------
  const seeded = s => () => { s = (Math.imul(s, 1103515245) + 12345) | 0; return ((s >>> 8) & 0xffffff) / 0x1000000; };
  function palm(g, x, y, h, lean, col) {
    g.save(); g.strokeStyle = col; g.fillStyle = col; g.lineCap = 'round';
    const tx = x + lean * h * .35, ty = y - h;
    g.lineWidth = h * .055; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + lean * h * .05, y - h * .55, tx, ty); g.stroke();
    for (let k = 0; k < 7; k++) {
      const a = -Math.PI / 2 + (k - 3) * .5 + lean * .2, len = h * (.42 + (k % 2) * .08), ex = tx + Math.cos(a) * len, ey = ty + Math.sin(a) * len * .6 + len * .25;
      g.lineWidth = h * .028; g.beginPath(); g.moveTo(tx, ty); g.quadraticCurveTo(tx + Math.cos(a) * len * .55, ty + Math.sin(a) * len * .55 - len * .12, ex, ey); g.stroke();
      for (let i = 1; i < 7; i++) { const u = i / 7, px = tx + (ex - tx) * u, py = ty + (ey - ty) * u - Math.sin(u * Math.PI) * len * .12;
        g.beginPath(); g.ellipse(px, py + h * .02, h * .045 * (1 - u * .5), h * .012, a + .9, 0, Math.PI * 2); g.fill(); }
    }
    g.restore();
  }
  function tag(g, text, x, y, size, fill, line, o = {}) {
    g.save(); g.font = `900 ${size}px "Arial Black", Impact, system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (o.rot) { g.translate(x, y); g.rotate(o.rot); x = 0; y = 0; }
    if (o.glow) { g.shadowColor = o.glow; g.shadowBlur = size * .35; }
    g.lineJoin = 'round'; g.lineWidth = size * .16; g.strokeStyle = line; g.strokeText(text, x, y);
    g.shadowBlur = 0; g.fillStyle = fill; g.fillText(text, x, y);
    if (o.drips) { g.fillStyle = fill; const w = g.measureText(text).width, rnd = seeded(text.length * 97 + size); for (let k = 0; k < o.drips; k++) { const dx = x - w / 2 + rnd() * w, dl = size * (.2 + rnd() * .6); g.fillRect(dx, y + size * .3, size * .045, dl); g.beginPath(); g.arc(dx + size * .022, y + size * .3 + dl, size * .04, 0, Math.PI * 2); g.fill(); } }
    if (o.shine) { g.globalCompositeOperation = 'source-atop'; const gr = g.createLinearGradient(0, y - size / 2, 0, y + size / 2); gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(.45, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillText(text, x, y); }
    g.restore();
  }
  function spray(g, rnd, n, cols) { for (let k = 0; k < n; k++) { g.fillStyle = cols[k % cols.length]; g.globalAlpha = .25 + rnd() * .5; g.beginPath(); g.arc(rnd() * AW, rnd() * AH, 2 + rnd() * 7, 0, Math.PI * 2); g.fill(); } g.globalAlpha = 1; }
  function wings(g, cx, cy, s, gold, dark) {
    for (const sd of [-1, 1]) for (let row = 0; row < 3; row++) for (let k = 0; k < 7 - row; k++) {
      const len = s * (.95 - row * .22) * (1 - k * .08), a = (sd < 0 ? Math.PI : 0) + sd * (-.55 + k * .2 + row * .05);
      const x = cx + sd * s * (.32 + row * .06) + Math.cos(a) * len * .5, y = cy - s * .05 + row * s * .1 + Math.sin(a) * len * .5;
      g.fillStyle = row === 0 ? gold : row === 1 ? '#f6dc8a' : '#fff3c4'; g.strokeStyle = dark; g.lineWidth = s * .012;
      g.beginPath(); g.ellipse(x, y, len * .5, s * .055, a, 0, Math.PI * 2); g.fill(); g.stroke();
    }
  }
  function halo(g, cx, cy, rx, ry, w) { const gr = g.createLinearGradient(cx - rx, cy, cx + rx, cy); gr.addColorStop(0, '#b8862b'); gr.addColorStop(.5, '#ffe9a0'); gr.addColorStop(1, '#b8862b'); g.strokeStyle = gr; g.lineWidth = w; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.stroke(); g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = w * .2; g.beginPath(); g.ellipse(cx, cy - w * .15, rx, ry, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke(); }
  function skyline(g, rnd, base, col, lit, n = 26, hMax = 520) {
    let x = -20; while (x < AW + 20) { const w = 50 + rnd() * 110, h = 120 + rnd() * hMax; g.fillStyle = col; g.fillRect(x, base - h, w, h);
      if (rnd() < .3) g.fillRect(x + w * .4, base - h - 40 - rnd() * 60, w * .12, 70);
      if (lit) for (let yy = base - h + 18; yy < base - 20; yy += 26) for (let xx = x + 10; xx < x + w - 14; xx += 20) if (rnd() < lit) { g.fillStyle = rnd() < .8 ? '#ffd877' : '#9fe3ff'; g.fillRect(xx, yy, 9, 13); g.fillStyle = col; }
      x += w + rnd() * 14; }
  }
  const ART = {
    // Sunset Strip: the striped sun going down behind palms, the road out of town
    sunset(g) {
      const rnd = seeded(11), sky = g.createLinearGradient(0, 0, 0, 640); sky.addColorStop(0, '#2b1a63'); sky.addColorStop(.45, '#c2408f'); sky.addColorStop(.8, '#ff7a6b'); sky.addColorStop(1, '#ffc15a'); g.fillStyle = sky; g.fillRect(0, 0, AW, 640);
      for (let k = 0; k < 90; k++) { g.fillStyle = 'rgba(255,240,220,' + (.3 + rnd() * .6) + ')'; g.fillRect(rnd() * AW, rnd() * 300, 3, 3); }
      const sun = g.createLinearGradient(0, 330, 0, 640); sun.addColorStop(0, '#fff07a'); sun.addColorStop(1, '#ff4f8b'); g.fillStyle = sun; g.beginPath(); g.arc(1024, 600, 300, Math.PI, 0); g.fill();
      g.fillStyle = '#ff7a6b'; for (let k = 0; k < 7; k++) { const y = 470 + k * 20, hgt = 4 + k * 2.4; g.fillRect(700, y, 650, hgt); }
      for (const [col, amp, base, seed] of [['#5b2a7a', 70, 600, 3], ['#3a1a5a', 50, 640, 5]]) { const r = seeded(seed); g.fillStyle = col; g.beginPath(); g.moveTo(0, 700); for (let x = 0; x <= AW; x += 64) g.lineTo(x, base - amp * (.5 + .5 * Math.sin(x / 210 + seed)) - r() * 20); g.lineTo(AW, 700); g.fill(); }
      const road = g.createLinearGradient(0, 640, 0, AH); road.addColorStop(0, '#2a2140'); road.addColorStop(1, '#141020'); g.fillStyle = road; g.fillRect(0, 640, AW, AH - 640);
      g.fillStyle = '#3d3157'; g.beginPath(); g.moveTo(980, 640); g.lineTo(1068, 640); g.lineTo(1700, AH); g.lineTo(348, AH); g.fill();
      g.fillStyle = '#ffd34d'; for (let k = 0; k < 6; k++) { const t0 = Math.pow(k / 6, 1.6), t1 = Math.pow((k + .45) / 6, 1.6), y0 = 640 + t0 * 384, y1 = 640 + t1 * 384, w0 = 4 + t0 * 22, w1 = 4 + t1 * 22; g.beginPath(); g.moveTo(1024 - w0, y0); g.lineTo(1024 + w0, y0); g.lineTo(1024 + w1, y1); g.lineTo(1024 - w1, y1); g.fill(); }
      g.strokeStyle = 'rgba(255,120,180,.55)'; g.lineWidth = 3; for (let k = 1; k < 9; k++) { const y = 640 + Math.pow(k / 9, 2) * 384; g.beginPath(); g.moveTo(0, y); g.lineTo(AW, y); g.stroke(); }
      for (const [x, h, l] of [[170, 560, .25], [360, 430, -.15], [1650, 520, -.3], [1880, 640, .1], [560, 300, .2]]) palm(g, x, 700, h, l, '#1a0d24');
      tag(g, 'SUNSET STRIP', 1024, 150, 150, '#ffd34d', '#2b1a63', { drips: 9, shine: true });
      spray(g, rnd, 160, ['#ff4f8b', '#ffd34d', '#5ff0e0']);
    },
    // Wings of the Saints: the gold halo and wings over the city at night
    wings(g) {
      const rnd = seeded(23), bg = g.createRadialGradient(1024, 480, 80, 1024, 520, 1100); bg.addColorStop(0, '#2c3f8f'); bg.addColorStop(1, '#0b0f2a'); g.fillStyle = bg; g.fillRect(0, 0, AW, AH);
      for (let k = 0; k < 220; k++) { const s = rnd() * 3 + 1; g.fillStyle = `rgba(255,255,${200 + rnd() * 55},${.4 + rnd() * .6})`; g.fillRect(rnd() * AW, rnd() * 700, s, s); }
      skyline(g, rnd, AH, '#151a3a', .18, 26, 300);
      wings(g, 1024, 470, 560, '#e2b23f', '#5a3b0a');
      halo(g, 1024, 250, 230, 60, 34);
      g.fillStyle = '#ffe9a0'; g.beginPath(); g.arc(1024, 470, 110, 0, Math.PI * 2); g.fill(); g.fillStyle = '#e2b23f'; g.beginPath(); g.arc(1024, 470, 84, 0, Math.PI * 2); g.fill();
      tag(g, 'S', 1024, 474, 130, '#16205a', '#ffe9a0');
      tag(g, 'SAINTS OF LA', 1024, 820, 170, '#ffe9a0', '#16205a', { drips: 12, shine: true });
      spray(g, rnd, 140, ['#ffe9a0', '#7fb5ff', '#ffffff']);
    },
    // Lowrider: a purple lowrider mid-hop in front of the skyline, chrome and gold
    lowrider(g) {
      const rnd = seeded(37), sky = g.createLinearGradient(0, 0, 0, AH); sky.addColorStop(0, '#ff9a3c'); sky.addColorStop(.55, '#ff4f6d'); sky.addColorStop(1, '#5b1a6e'); g.fillStyle = sky; g.fillRect(0, 0, AW, AH);
      skyline(g, rnd, 760, '#3a1450', 0, 26, 420);
      g.fillStyle = '#26102f'; g.fillRect(0, 760, AW, AH - 760); g.fillStyle = '#ffd34d'; for (let x = 40; x < AW; x += 220) g.fillRect(x, 900, 120, 14);
      // the car (side view), lifted on its hydraulics
      const cx = 1024, by = 690, L = 1180;
      g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(cx, 845, L * .48, 26, 0, 0, Math.PI * 2); g.fill();
      const body = g.createLinearGradient(0, by - 160, 0, by + 60); body.addColorStop(0, '#c879ff'); body.addColorStop(.5, '#7a2bbf'); body.addColorStop(1, '#3c0f66'); g.fillStyle = body;
      g.beginPath(); g.moveTo(cx - L / 2, by + 30); g.lineTo(cx - L / 2 + 20, by - 70); g.lineTo(cx - 260, by - 90); g.quadraticCurveTo(cx - 170, by - 230, cx - 20, by - 236); g.lineTo(cx + 170, by - 232); g.quadraticCurveTo(cx + 290, by - 200, cx + 330, by - 92); g.lineTo(cx + L / 2 - 10, by - 70); g.lineTo(cx + L / 2, by + 30); g.closePath(); g.fill();
      g.fillStyle = '#1a2a4a'; g.beginPath(); g.moveTo(cx - 230, by - 96); g.quadraticCurveTo(cx - 150, by - 214, cx - 20, by - 218); g.lineTo(cx + 150, by - 214); g.quadraticCurveTo(cx + 250, by - 188, cx + 286, by - 96); g.closePath(); g.fill();
      g.strokeStyle = '#c879ff'; g.lineWidth = 14; g.beginPath(); g.moveTo(cx + 30, by - 216); g.lineTo(cx + 30, by - 96); g.stroke();
      g.strokeStyle = '#eef3ff'; g.lineWidth = 10; g.beginPath(); g.moveTo(cx - L / 2 + 30, by - 20); g.lineTo(cx + L / 2 - 30, by - 20); g.stroke();
      g.fillStyle = '#ffe9a0'; g.fillRect(cx + L / 2 - 40, by - 54, 36, 26); g.fillStyle = '#ff3b3b'; g.fillRect(cx - L / 2 + 6, by - 54, 28, 24);
      for (const wx of [cx - 360, cx + 380]) { g.fillStyle = '#0d0d12'; g.beginPath(); g.arc(wx, by + 50, 92, 0, Math.PI * 2); g.fill(); const rim = g.createRadialGradient(wx - 20, by + 30, 10, wx, by + 50, 64); rim.addColorStop(0, '#ffffff'); rim.addColorStop(1, '#8a93a8'); g.fillStyle = rim; g.beginPath(); g.arc(wx, by + 50, 60, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#d8b35c'; g.lineWidth = 4; for (let k = 0; k < 18; k++) { const a = k / 18 * Math.PI * 2; g.beginPath(); g.moveTo(wx, by + 50); g.lineTo(wx + Math.cos(a) * 58, by + 50 + Math.sin(a) * 58); g.stroke(); } g.fillStyle = '#d8b35c'; g.beginPath(); g.arc(wx, by + 50, 14, 0, Math.PI * 2); g.fill(); }
      g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 8; for (let k = 0; k < 4; k++) { const y = 820 + k * 22; g.beginPath(); g.moveTo(cx - 520 + k * 40, y); g.lineTo(cx - 420 + k * 40, y); g.stroke(); g.beginPath(); g.moveTo(cx + 300 - k * 40, y); g.lineTo(cx + 420 - k * 40, y); g.stroke(); }
      for (let k = 0; k < 40; k++) { const x = rnd() * AW, y = rnd() * 600, s = 8 + rnd() * 18; g.fillStyle = '#ffe9a0'; g.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, rr = i % 2 ? s * .3 : s; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.fill(); }
      tag(g, 'LOW & SLOW', 1024, 150, 170, '#ffe9a0', '#3c0f66', { drips: 10, shine: true, rot: -.04 });
    },
    // Court Kings: the hoop, the ball on its way, the court in perspective, crowns
    court(g) {
      const rnd = seeded(53), bg = g.createLinearGradient(0, 0, AW, AH); bg.addColorStop(0, '#0f5ea8'); bg.addColorStop(1, '#3a1a7a'); g.fillStyle = bg; g.fillRect(0, 0, AW, AH);
      g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 40; for (let k = -8; k < 16; k++) { g.beginPath(); g.moveTo(k * 200, 0); g.lineTo(k * 200 + 600, AH); g.stroke(); }
      const fl = g.createLinearGradient(0, 640, 0, AH); fl.addColorStop(0, '#d28a3c'); fl.addColorStop(1, '#8a4f1e'); g.fillStyle = fl; g.beginPath(); g.moveTo(300, 640); g.lineTo(1748, 640); g.lineTo(AW, AH); g.lineTo(0, AH); g.fill();
      g.strokeStyle = '#ffffff'; g.lineWidth = 8; g.beginPath(); g.moveTo(760, 640); g.lineTo(560, AH); g.moveTo(1288, 640); g.lineTo(1488, AH); g.stroke(); g.beginPath(); g.ellipse(1024, 790, 330, 90, 0, 0, Math.PI); g.stroke(); g.beginPath(); g.ellipse(1024, 640, 520, 140, 0, 0, Math.PI); g.stroke();
      g.fillStyle = '#f5f5f5'; g.fillRect(1380, 140, 380, 250); g.strokeStyle = '#d23a3a'; g.lineWidth = 10; g.strokeRect(1390, 150, 360, 230); g.strokeRect(1500, 250, 140, 100);
      g.fillStyle = '#5a5a66'; g.fillRect(1560, 390, 20, 250); g.strokeStyle = '#ff6a1a'; g.lineWidth = 12; g.beginPath(); g.ellipse(1570, 360, 90, 22, 0, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = '#ffffff'; g.lineWidth = 3; for (let k = 0; k <= 8; k++) { g.beginPath(); g.moveTo(1480 + k * 22.5, 362); g.lineTo(1505 + k * 16, 460); g.stroke(); }
      g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 6; g.setLineDash([22, 18]); g.beginPath(); g.moveTo(420, 600); g.quadraticCurveTo(900, -40, 1480, 300); g.stroke(); g.setLineDash([]);
      const bx = 1180, byy = 140, br = 120, ball = g.createRadialGradient(bx - 40, byy - 40, 10, bx, byy, br); ball.addColorStop(0, '#ffb066'); ball.addColorStop(1, '#c4520f'); g.fillStyle = ball; g.beginPath(); g.arc(bx, byy, br, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#3a1a08'; g.lineWidth = 7; g.beginPath(); g.arc(bx, byy, br, 0, Math.PI * 2); g.moveTo(bx - br, byy); g.lineTo(bx + br, byy); g.moveTo(bx, byy - br); g.lineTo(bx, byy + br); g.stroke(); g.beginPath(); g.ellipse(bx - 70, byy, 50, br, 0, -Math.PI / 2, Math.PI / 2); g.stroke(); g.beginPath(); g.ellipse(bx + 70, byy, 50, br, 0, Math.PI / 2, Math.PI * 1.5); g.stroke();
      for (const [x, y, s] of [[260, 220, 120], [700, 170, 80], [1880, 600, 100]]) { g.fillStyle = '#ffd34d'; g.strokeStyle = '#7a4a00'; g.lineWidth = s * .06; g.beginPath(); g.moveTo(x - s, y + s * .5); g.lineTo(x - s, y - s * .3); g.lineTo(x - s * .5, y + s * .1); g.lineTo(x, y - s * .55); g.lineTo(x + s * .5, y + s * .1); g.lineTo(x + s, y - s * .3); g.lineTo(x + s, y + s * .5); g.closePath(); g.fill(); g.stroke(); }
      tag(g, 'COURT KINGS', 760, 470, 180, '#ffffff', '#d23a3a', { drips: 11, shine: true, rot: -.05 });
      spray(g, rnd, 180, ['#ffffff', '#ffd34d', '#ff6a1a']);
    },
    // City of Angels: the skyline at night, searchlights, the moon, wings in neon (variant = another night for the strays)
    angels(g, variant = 0) {
      const rnd = seeded(71 + variant * 1009), sky = g.createLinearGradient(0, 0, 0, AH); sky.addColorStop(0, '#05060f'); sky.addColorStop(.6, '#1c1446'); sky.addColorStop(1, '#4a1a5e'); g.fillStyle = sky; g.fillRect(0, 0, AW, AH);
      for (let k = 0; k < 260; k++) { const s = rnd() * 2.6 + .8; g.fillStyle = `rgba(255,255,255,${.3 + rnd() * .7})`; g.fillRect(rnd() * AW, rnd() * 620, s, s); }
      const mx = 1580 + (variant ? -1180 : 0), mg = g.createRadialGradient(mx, 220, 20, mx, 220, 200); mg.addColorStop(0, '#fff8dc'); mg.addColorStop(.55, '#f3e2a8'); mg.addColorStop(.56, 'rgba(243,226,168,.25)'); mg.addColorStop(1, 'rgba(243,226,168,0)'); g.fillStyle = mg; g.beginPath(); g.arc(mx, 220, 200, 0, Math.PI * 2); g.fill();
      for (const [x, a] of [[420, -.35], [900, .18], [1300, -.12]]) { g.save(); g.translate(x, AH); g.rotate(a + (variant ? .25 : 0)); const sl = g.createLinearGradient(0, 0, 0, -AH); sl.addColorStop(0, 'rgba(180,220,255,.35)'); sl.addColorStop(1, 'rgba(180,220,255,0)'); g.fillStyle = sl; g.beginPath(); g.moveTo(-14, 0); g.lineTo(14, 0); g.lineTo(120, -AH * 1.2); g.lineTo(-120, -AH * 1.2); g.fill(); g.restore(); }
      skyline(g, rnd, AH, '#0d0b22', .32, 26, 560);
      for (const [x, h, l] of [[120, 420, .2], [1960, 460, -.2], [260, 330, -.1]]) palm(g, x, AH, h, l, '#05040c');
      g.save(); g.shadowColor = '#ff4fd8'; g.shadowBlur = 30; g.strokeStyle = '#ff7ae6'; g.lineWidth = 8;
      for (const sd of [-1, 1]) for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(1024 + sd * (150 + k * 40), 330 - k * 12, 190 - k * 26, 34, sd * (-.45 + k * .12), 0, Math.PI * 2); g.stroke(); }
      g.restore();
      tag(g, 'CITY OF ANGELS', 1024, 120, 140, '#9ff3ff', '#0d0b22', { glow: '#3fd7ff', shine: true });
      spray(g, rnd, 120, ['#ff7ae6', '#9ff3ff', '#ffd877']);
    },
    // Saints Boulevard: dusk down a palm-lined street, neon shop signs, tail lights streaking to the vanishing point
    // (variant = another night: other signs, the traffic the other way)
    boulevard(g, variant = 0) {
      const rnd = seeded(83 + variant * 1009), VX = 1024, VY = 520;
      const sky = g.createLinearGradient(0, 0, 0, VY); sky.addColorStop(0, variant ? '#0e1a3a' : '#1b1440'); sky.addColorStop(.55, variant ? '#3a2c7a' : '#6a2c7a'); sky.addColorStop(1, variant ? '#ff6a8a' : '#ff8a5c'); g.fillStyle = sky; g.fillRect(0, 0, AW, VY);
      for (let k = 0; k < 70; k++) { g.fillStyle = `rgba(255,240,220,${.3 + rnd() * .6})`; g.fillRect(rnd() * AW, rnd() * 260, 3, 3); }
      g.fillStyle = '#2a1840'; g.beginPath(); g.moveTo(0, VY); for (let x = 0; x <= AW; x += 48) g.lineTo(x, VY - 60 - 50 * Math.sin(x / 170 + variant * 2) - rnd() * 25); g.lineTo(AW, VY); g.fill();
      // the buildings either side, shrinking to the vanishing point, each with a neon sign
      const signs = variant ? ['RECORDS', 'MOTEL', 'BARBER', 'NOODLES', 'GARAGE', 'FLOWERS'] : ['TACOS', 'DONUTS', 'ARCADE', 'BOXING', 'TATTOO', 'BAKERY'], neon = ['#ff4fd8', '#5ff0e0', '#ffd34d', '#ff6a3d', '#9fffa0', '#7a9cff'];
      for (const sd of [-1, 1]) for (let k = 5; k >= 0; k--) {
        const s = 1 / (1 + k * .55), x0 = VX + sd * (140 + 900 * s), w = 520 * s, top = VY - 420 * s, bot = VY + 470 * s, x = sd < 0 ? x0 - w : x0;
        g.fillStyle = k % 2 ? '#2b2140' : '#3a2a52'; g.fillRect(x, top, w, bot - top);
        g.fillStyle = 'rgba(255,216,119,.55)'; for (let yy = top + 30 * s; yy < bot - 160 * s; yy += 60 * s) for (let xx = x + 24 * s; xx < x + w - 40 * s; xx += 70 * s) if (rnd() < .45) g.fillRect(xx, yy, 26 * s, 34 * s);
        const i = (k * 2 + (sd > 0 ? 1 : 0)) % signs.length; tag(g, signs[i], x + w / 2, top + 110 * s, Math.max(18, 80 * s), '#ffffff', neon[i], { glow: neon[i] });
      }
      // the road, its dashes, the sidewalks
      g.fillStyle = '#231a33'; g.beginPath(); g.moveTo(VX - 40, VY); g.lineTo(VX + 40, VY); g.lineTo(AW + 300, AH); g.lineTo(-300, AH); g.fill();
      g.fillStyle = '#4a3a5e'; for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(VX + sd * 40, VY); g.lineTo(VX + sd * 70, VY); g.lineTo(VX + sd * 1500, AH); g.lineTo(VX + sd * 1300, AH); g.fill(); }
      g.fillStyle = '#ffd34d'; for (let k = 0; k < 9; k++) { const t0 = Math.pow(k / 9, 1.7), t1 = Math.pow((k + .5) / 9, 1.7), y0 = VY + t0 * (AH - VY), y1 = VY + t1 * (AH - VY), w0 = 2 + t0 * 18, w1 = 2 + t1 * 18; g.beginPath(); g.moveTo(VX - w0, y0); g.lineTo(VX + w0, y0); g.lineTo(VX + w1, y1); g.lineTo(VX - w1, y1); g.fill(); }
      // the traffic: red tail lights one way, white headlights the other
      g.lineCap = 'round';
      for (let k = 0; k < 26; k++) { const sd = (k % 2 ? 1 : -1) * (variant ? -1 : 1), u = .15 + rnd() * .8, lane = .25 + rnd() * .5, x0 = VX + sd * lane * 70, x1 = VX + sd * lane * 1400 * u, y1 = VY + (AH - VY) * u;
        g.strokeStyle = sd > 0 ? 'rgba(255,60,60,.8)' : 'rgba(255,250,220,.85)'; g.lineWidth = 3 + u * 9; g.beginPath(); g.moveTo(VX + (x1 - VX) * .55, VY + (y1 - VY) * .55); g.lineTo(x1, y1); g.stroke(); }
      for (let k = 0; k < 7; k++) { const s = 1 / (1 + k * .55); for (const sd of [-1, 1]) palm(g, VX + sd * (110 + 760 * s), VY + 470 * s, 760 * s, -sd * .12, '#140a1c'); }
      tag(g, variant ? 'NIGHT SHIFT' : 'SAINTS BLVD', 1024, 120, 140, '#ff9ae6', '#1b1440', { glow: '#ff4fd8', drips: 8 });
      spray(g, rnd, 140, ['#ff4fd8', '#5ff0e0', '#ffd34d']);
    },
    // Venice Beach: the low sun on the water, the pier on its legs, the skate bowls and a lifeguard tower on the sand
    // (variant = the morning: the sun on the other side, other waves and bowls)
    venice(g, variant = 0) {
      const rnd = seeded(97 + variant * 1009), H0 = 430, SEA = 600;
      const sky = g.createLinearGradient(0, 0, 0, H0); sky.addColorStop(0, variant ? '#5aa8e0' : '#ff9a6a'); sky.addColorStop(1, variant ? '#ffe6b0' : '#ffd88a'); g.fillStyle = sky; g.fillRect(0, 0, AW, H0);
      const sx = variant ? 1650 : 380, sg = g.createRadialGradient(sx, H0 - 30, 10, sx, H0 - 30, 170); sg.addColorStop(0, '#fff6c8'); sg.addColorStop(.6, '#ffd060'); sg.addColorStop(1, 'rgba(255,200,90,0)'); g.fillStyle = sg; g.beginPath(); g.arc(sx, H0 - 30, 170, 0, Math.PI * 2); g.fill();
      for (let k = 0; k < 6; k++) { g.fillStyle = 'rgba(255,255,255,.55)'; const cx = rnd() * AW, cy = 60 + rnd() * 200; for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(cx + i * 46, cy + (i % 2) * 10, 60, 22, 0, 0, Math.PI * 2); g.fill(); } }
      const sea = g.createLinearGradient(0, H0, 0, SEA); sea.addColorStop(0, '#1f6fa8'); sea.addColorStop(1, '#3fb0c8'); g.fillStyle = sea; g.fillRect(0, H0, AW, SEA - H0);
      g.fillStyle = 'rgba(255,240,180,.45)'; for (let y = H0 + 8; y < SEA; y += 14) g.fillRect(sx - 90 + Math.sin(y) * 30, y, 180 - (y - H0) * .4, 4);
      g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 5; for (let r = 0; r < 7; r++) { const y = H0 + 20 + r * 24, ph = rnd() * 6; g.beginPath(); for (let x = 0; x <= AW; x += 24) g.lineTo(x, y + Math.sin(x / (60 + r * 9) + ph) * (3 + r)); g.stroke(); }
      // the pier: deck, legs, lamps, a wheel at its end
      const px0 = variant ? 120 : 1180, px1 = variant ? 860 : 1980, py = H0 + 40;
      g.fillStyle = '#4a3020'; for (let x = px0; x <= px1; x += 46) g.fillRect(x, py, 12, SEA - py + 30);
      g.fillStyle = '#6a4630'; g.fillRect(px0 - 20, py - 18, px1 - px0 + 40, 26);
      for (let x = px0; x <= px1; x += 92) { g.fillStyle = '#2a1a10'; g.fillRect(x, py - 70, 6, 52); g.fillStyle = '#ffe9a0'; g.beginPath(); g.arc(x + 3, py - 74, 9, 0, Math.PI * 2); g.fill(); }
      const wx = variant ? px0 + 120 : px1 - 140, wy = py - 170; g.strokeStyle = '#d23a3a'; g.lineWidth = 10; g.beginPath(); g.arc(wx, wy, 140, 0, Math.PI * 2); g.stroke(); g.lineWidth = 4;
      for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; g.beginPath(); g.moveTo(wx, wy); g.lineTo(wx + Math.cos(a) * 140, wy + Math.sin(a) * 140); g.stroke(); g.fillStyle = ['#ffd34d', '#5ff0e0', '#ff4fd8'][k % 3]; g.fillRect(wx + Math.cos(a) * 140 - 12, wy + Math.sin(a) * 140 - 8, 24, 22); }
      // the sand, the bowls, the tower, palms on the boardwalk, footprints
      const sand = g.createLinearGradient(0, SEA, 0, AH); sand.addColorStop(0, '#f2d49a'); sand.addColorStop(1, '#d9a861'); g.fillStyle = sand; g.fillRect(0, SEA, AW, AH - SEA);
      g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 6; g.beginPath(); for (let x = 0; x <= AW; x += 20) g.lineTo(x, SEA + 6 + Math.sin(x / 90 + variant) * 6); g.stroke();
      for (const [bx, bw] of variant ? [[1400, 300], [1800, 200]] : [[620, 300], [980, 220]]) { const bg = g.createRadialGradient(bx, 820, 10, bx, 820, bw); bg.addColorStop(0, '#9aa0aa'); bg.addColorStop(1, '#cfd3d8'); g.fillStyle = bg; g.beginPath(); g.ellipse(bx, 820, bw, bw * .32, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#5a5e66'; g.lineWidth = 8; g.stroke(); g.strokeStyle = '#ff4fd8'; g.lineWidth = 6; g.beginPath(); g.ellipse(bx - bw * .25, 815, bw * .22, bw * .06, .2, 0, Math.PI * 2); g.stroke(); }
      const tx = variant ? 560 : 1560; g.fillStyle = '#3a8fd8'; g.fillRect(tx - 90, 640, 180, 110); g.fillStyle = '#ffffff'; g.fillRect(tx - 70, 660, 140, 46); g.fillStyle = '#d23a3a'; g.font = '900 34px system-ui'; g.textAlign = 'center'; g.fillText('LIFEGUARD', tx, 738); g.fillStyle = '#5a4030'; for (const dx of [-80, 70]) g.fillRect(tx + dx, 750, 10, 130); g.beginPath(); g.moveTo(tx - 110, 640); g.lineTo(tx, 590); g.lineTo(tx + 110, 640); g.fill();
      for (const [x, h, l] of variant ? [[260, 520, .15], [1080, 420, -.1], [1960, 560, -.2]] : [[90, 560, .2], [330, 470, -.1], [1880, 520, -.25]]) palm(g, x, AH, h, l, '#2a1a14');
      g.fillStyle = 'rgba(150,100,50,.35)'; for (let k = 0; k < 60; k++) { const x = 200 + k * 28 + Math.sin(k) * 20, y = 900 - k * 2 + (k % 2) * 16; g.beginPath(); g.ellipse(x, y, 8, 5, .4, 0, Math.PI * 2); g.fill(); }
      tag(g, variant ? 'GOOD MORNING' : 'VENICE BEACH', 1024, 110, 150, '#5ff0e0', '#0d3a5a', { drips: 9, shine: true });
      spray(g, rnd, 150, ['#5ff0e0', '#ffd34d', '#ff7a6b']);
    },
    // Saints in Neon: a wall of neon tubes over brick: zigzags, rings and checks that shift colour across the wall,
    // the name in the middle (variant = the patterns shifted half a step, the colours turned)
    neon(g, variant = 0) {
      const rnd = seeded(113 + variant * 1009);
      g.fillStyle = '#16121e'; g.fillRect(0, 0, AW, AH);
      g.strokeStyle = 'rgba(80,60,90,.5)'; g.lineWidth = 3; for (let r = 0, y = 0; y < AH; r++, y += 34) { g.beginPath(); g.moveTo(0, y); g.lineTo(AW, y); g.stroke(); for (let x = (r % 2) * 40; x < AW; x += 80) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 34); g.stroke(); } }
      const hue = (x, y) => (x / AW * 300 + y / AH * 60 + variant * 140) % 360, glowLine = (col, w) => { g.strokeStyle = col; g.shadowColor = col; g.shadowBlur = 18; g.lineWidth = w; };
      const off = variant ? 64 : 0;
      // bands of patterns, each its own kind, every cell its own colour along the wall
      for (let row = 0; row < 8; row++) {
        const y = row * 128 + 64, kind = row % 4;
        for (let x = 64 + (kind === 1 ? off : 0); x < AW; x += 128) {
          const col = `hsl(${hue(x, y)},100%,62%)`; g.save(); glowLine(col, 7);
          if (kind === 0) { g.beginPath(); for (let i = 0; i <= 4; i++) g.lineTo(x - 52 + i * 26, y + (i % 2 ? -26 : 26)); g.stroke(); }
          else if (kind === 1) { g.beginPath(); g.arc(x, y, 38 - (x / 128 % 3) * 7, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(x, y, 12, 0, Math.PI * 2); g.stroke(); }
          else if (kind === 2) { const s = 30; for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) if ((i + j + (x / 128 | 0) + variant) % 2 === 0) g.strokeRect(x - s + i * s, y - s + j * s, s, s); }
          else { g.beginPath(); g.moveTo(x - 40, y + 30); g.lineTo(x, y - 34); g.lineTo(x + 40, y + 30); g.closePath(); g.stroke(); g.beginPath(); g.moveTo(x - 14, y + 30); g.lineTo(x + 6, y - 2); g.stroke(); }
          g.restore();
        }
      }
      // the name on a dark band, a halo over it, bolts either side
      g.fillStyle = 'rgba(10,8,16,.86)'; g.fillRect(260, 330, 1528, 360);
      g.save(); glowLine('#ffd877', 10); g.beginPath(); g.ellipse(1024, 360, 300, 46, 0, 0, Math.PI * 2); g.stroke(); g.restore();
      tag(g, variant ? 'SAINTS LIVE' : 'SAINTS', 1024, 530, 230, '#fff4fb', '#ff3fd0', { glow: '#ff3fd0' });
      for (const sd of [-1, 1]) { g.save(); glowLine('#5ff0e0', 12); g.beginPath(); const bx = 1024 + sd * 640; g.moveTo(bx - 30, 380); g.lineTo(bx + 20, 500); g.lineTo(bx - 14, 500); g.lineTo(bx + 34, 650); g.stroke(); g.restore(); }
      spray(g, rnd, 90, ['#ff3fd0', '#5ff0e0', '#ffd877']);
    },
    // Golden Dragon: the Chinatown gate, rows of red lanterns, the dragon's long golden body winding over the street
    // in a sea of clouds (variant = the dragon the other way round, other lanterns)
    dragon(g, variant = 0) {
      const rnd = seeded(127 + variant * 1009);
      const bg = g.createLinearGradient(0, 0, 0, AH); bg.addColorStop(0, '#2a0508'); bg.addColorStop(.6, '#6a0c12'); bg.addColorStop(1, '#2a0508'); g.fillStyle = bg; g.fillRect(0, 0, AW, AH);
      // clouds: rows of curls
      g.strokeStyle = 'rgba(255,190,90,.35)'; g.lineWidth = 6; for (let k = 0; k < 40; k++) { const x = rnd() * AW, y = rnd() * AH, r = 20 + rnd() * 30; g.beginPath(); g.arc(x, y, r, Math.PI * .2, Math.PI * 1.7); g.stroke(); g.beginPath(); g.arc(x + r * .9, y - r * .2, r * .55, Math.PI * .9, Math.PI * 2.3); g.stroke(); }
      // the gate
      const gx = 1024; g.fillStyle = '#9a1a1a'; for (const dx of [-300, -120, 120, 300]) g.fillRect(gx + dx - 22, 520, 44, 504);
      for (const [w, y, h] of [[760, 470, 40], [640, 420, 30], [820, 380, 26]]) { g.fillStyle = '#1e5a3a'; g.beginPath(); g.moveTo(gx - w / 2 - 40, y + h); g.quadraticCurveTo(gx, y - 30, gx + w / 2 + 40, y + h); g.lineTo(gx + w / 2, y + h + 18); g.lineTo(gx - w / 2, y + h + 18); g.fill(); g.fillStyle = '#d8b35c'; g.fillRect(gx - w / 2, y + h + 18, w, 10); }
      g.fillStyle = '#d8b35c'; g.fillRect(gx - 90, 560, 180, 70); g.fillStyle = '#9a1a1a'; g.font = '900 52px Georgia, serif'; g.textAlign = 'center'; g.fillText(variant ? '福' : '龍', gx, 614);
      // the lanterns on strings
      for (let row = 0; row < 3; row++) { const y0 = 130 + row * 150, sag = 40 + row * 10; g.strokeStyle = 'rgba(30,10,10,.8)'; g.lineWidth = 3; g.beginPath(); for (let x = 0; x <= AW; x += 32) g.lineTo(x, y0 + Math.sin(x / AW * Math.PI * 3 + row + variant) * sag); g.stroke();
        for (let x = 40 + row * 30 + variant * 50; x < AW; x += 150 + row * 20) { const y = y0 + Math.sin(x / AW * Math.PI * 3 + row + variant) * sag + 26, r = 26 - row * 4;
          const lg = g.createRadialGradient(x, y, 2, x, y, r * 1.4); lg.addColorStop(0, '#ffd877'); lg.addColorStop(.5, '#e8322a'); lg.addColorStop(1, '#7a0a0a'); g.fillStyle = lg; g.beginPath(); g.ellipse(x, y, r * 1.1, r, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#d8b35c'; g.fillRect(x - r * .4, y - r - 6, r * .8, 7); g.fillRect(x - r * .4, y + r - 1, r * .8, 7); } }
      // the dragon: a long body on a wave, scales along it, the head with whiskers at one end
      const dir = variant ? -1 : 1, P = t => [AW / 2 + dir * (t - .5) * AW * .78, 600 + Math.sin(t * Math.PI * 3.2) * 170 - t * 120];
      for (let i = 300; i >= 0; i--) { const t = i / 300, [x, y] = P(t), r = 46 * (1 - t * .55) + 10; g.fillStyle = i % 6 < 3 ? '#e2b23f' : '#c48a1f'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
        if (i % 4 === 0) { g.strokeStyle = 'rgba(90,50,0,.6)'; g.lineWidth = 3; g.beginPath(); g.arc(x, y + r * .1, r * .7, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
        if (i % 18 === 0) { g.fillStyle = '#e8322a'; g.beginPath(); g.moveTo(x - 10, y - r); g.lineTo(x, y - r - 30); g.lineTo(x + 10, y - r); g.fill(); } }
      const [hx, hy] = P(0); g.fillStyle = '#f0c64a'; g.beginPath(); g.ellipse(hx - dir * 40, hy, 110, 70, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(hx - dir * 70, hy - 24, 18, 0, Math.PI * 2); g.fill(); g.fillStyle = '#1a0a0a'; g.beginPath(); g.arc(hx - dir * 74, hy - 24, 9, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#ffe9a0'; g.lineWidth = 5; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(hx - dir * 130, hy + 10 * s); g.bezierCurveTo(hx - dir * 170, hy + 70 * s, hx - dir * 190, hy - 30 * s, hx - dir * 210, hy + 50 * s); g.stroke(); }
      g.fillStyle = '#e8322a'; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(hx + dir * (k * 40 - 20), hy - 60); g.lineTo(hx + dir * (k * 40), hy - 120 - k * 6); g.lineTo(hx + dir * (k * 40 + 20), hy - 60); g.fill(); }
      tag(g, variant ? 'LUCKY STREET' : 'GOLDEN DRAGON', 1024, 90, 120, '#ffd877', '#5a0808', { shine: true });
      spray(g, rnd, 110, ['#ffd877', '#e8322a', '#ffffff']);
    },
    // Halo (the hardest wall): gold on gold. A great halo and wings over rays and a gilded lattice, the name in gold
    // leaf: every square shines in the same few golds, told apart by the line work only (variant = the lattice and the
    // rays half a step round: its squares look like the wall's and fit none of them)
    halo(g, variant = 0) {
      const rnd = seeded(131 + variant * 1009), cx = 1024, cy = 470;
      const bg = g.createRadialGradient(cx, cy, 40, cx, cy, 1150); bg.addColorStop(0, '#ffe7a0'); bg.addColorStop(.45, '#d9a640'); bg.addColorStop(1, '#6a4310'); g.fillStyle = bg; g.fillRect(0, 0, AW, AH);
      // rays
      for (let k = 0; k < 48; k++) { const a = (k + (variant ? .5 : 0)) / 48 * Math.PI * 2; g.fillStyle = k % 2 ? 'rgba(255,240,190,.22)' : 'rgba(120,80,20,.16)'; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * 1500, cy + Math.sin(a) * 1500); g.lineTo(cx + Math.cos(a + .066) * 1500, cy + Math.sin(a + .066) * 1500); g.fill(); }
      // the lattice: curls in every cell of a 64 px grid, each turned by its place
      g.lineWidth = 4;
      for (let y = 32; y < AH; y += 64) for (let x = 32 + (variant ? 32 : 0); x < AW; x += 64) { const q = ((x * 7 + y * 13) / 64 | 0) % 4, a = q * Math.PI / 2 + (x + y) / 400;
        g.strokeStyle = (x + y) % 128 ? 'rgba(110,70,10,.55)' : 'rgba(255,245,200,.6)'; g.beginPath(); g.arc(x + Math.cos(a) * 8, y + Math.sin(a) * 8, 18, a, a + Math.PI * 1.4); g.stroke();
        g.beginPath(); g.arc(x - Math.cos(a) * 12, y - Math.sin(a) * 12, 8, a + Math.PI, a + Math.PI * 2.2); g.stroke(); }
      wings(g, cx, cy + 40, 620, '#f4c64a', '#7a4a0a');
      halo(g, cx, cy - 210, 260, 64, 40); halo(g, cx, cy - 210, 200, 46, 16);
      g.fillStyle = '#fff3c4'; g.beginPath(); g.arc(cx, cy + 40, 120, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#b8862b'; g.lineWidth = 10; g.stroke();
      for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; g.strokeStyle = '#c48a1f'; g.lineWidth = 6; g.beginPath(); g.moveTo(cx + Math.cos(a) * 60, cy + 40 + Math.sin(a) * 60); g.lineTo(cx + Math.cos(a) * 104, cy + 40 + Math.sin(a) * 104); g.stroke(); }
      tag(g, variant ? 'SAINTS FOREVER' : 'SAINTS ETERNAL', 1024, 900, 130, '#ffe08a', '#8a5a14', { shine: true });
      spray(g, rnd, 220, ['#fff3c4', '#b8862b', '#ffd877']);
    }
  };
  // the bare wall where a tile is gone: render bricks and a chalk outline
  function brick(g, x, y, w, h) {
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    g.fillStyle = '#8b8f97'; g.fillRect(x, y, w, h);
    const bh = Math.max(10, h / 6), bw = bh * 2.4; g.strokeStyle = '#6c7078'; g.lineWidth = Math.max(2, bh * .12);
    for (let r = 0, yy = y; yy < y + h; r++, yy += bh) { g.beginPath(); g.moveTo(x, yy); g.lineTo(x + w, yy); g.stroke(); for (let xx = x - (r % 2) * bw / 2; xx < x + w; xx += bw) { g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx, yy + bh); g.stroke(); } }
    g.restore();
    g.save(); g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = Math.max(3, w * .025); g.setLineDash([w * .08, w * .06]); g.strokeRect(x + w * .05, y + h * .05, w * .9, h * .9); g.restore();
  }
  const G = {
    title: 'Street Art', _art: ART, // the murals (tests draw them on their own)
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const D = def.wall || 8, MW = def.width || 8, MH = MW / 2, MY = def.y || 1.7; // the mural: MW x MH on the wall, its foot MY up
      const KEY = 'rebelAntsMuralProgress:' + (def.id || 'mural');
      let doneUpTo = 0; try { doneUpTo = Math.max(0, Math.min(LEVELS.length, Number(localStorage.getItem(KEY)) || 0)); } catch (e) {}
      const mat = (k, c, em, spec = .08) => ctx.mat('mu_' + k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(spec, spec, spec); if (em) m.emissiveColor = new B.Color3(...em); return m; });
      const M = { cart: mat('cart', [.42, .3, .2], [.05, .03, .02]), rim: mat('rim', [.2, .2, .22], [.03, .03, .03], .3), gold: mat('gold', [1, .8, .3], [.75, .55, .15], .4), cans: [mat('can1', [.9, .25, .5], [.2, .05, .1], .4), mat('can2', [.2, .8, .9], [.04, .15, .18], .4), mat('can3', [1, .8, .2], [.2, .15, .04], .4)] };
      let L = null; // the level: { k, c, r, cell, tiles[], holes Set, mistakes, t, nodes[], tex... }
      const st = { phase: 'pick', wait: 0, held: null };
      const keep = n => { n.parent = n.parent || ctx.frame; ctx.add(n); L.nodes.push(n); return n; };
      // the cart under the wall: a slanted board the loose tiles lie on
      const CART = { z: D - 1.5, y: .95, tilt: .3, w: MW + .6, h: 1.25 }; // h grows a row at a time past two rows of tiles
      function build(k) {
        if (L) L.nodes.forEach(n => { try { n.dispose(); } catch (e) {} });
        const lv = LEVELS[k], C = lv.c, R = lv.r, cell = MW / C;
        L = { k, lv, C, R, cell, tiles: [], holes: new Set(), filled: 0, mistakes: 0, t: 0, nodes: [] };
        // the art, the wall (art with the gaps bricked) and, on the last level, the strays' art
        const mk = (name) => { const t = new B.DynamicTexture(name, { width: AW, height: AH }, scene, true); t.wrapU = t.wrapV = B.Texture.CLAMP_ADDRESSMODE; return t; };
        const art = mk('muArt'), wallT = mk('muWall'), ag = art.getContext();
        ART[lv.art](ag); art.update();
        const px = ag.getImageData(0, 0, AW, AH).data;
        // a signature per square (8 x 8 colours), for "does this tile fit here"
        const SG = 8, sigOf = (data, c, r) => { const out = new Float32Array(SG * SG * 3), cw = AW / C, ch = AH / R; for (let j = 0; j < SG; j++) for (let i = 0; i < SG; i++) { const x = Math.floor(c * cw + (i + .5) * cw / SG), y = Math.floor(r * ch + (j + .5) * ch / SG), o = (y * AW + x) * 4; out.set([data[o], data[o + 1], data[o + 2]], (j * SG + i) * 3); } return out; };
        const sigs = []; for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) sigs.push(sigOf(px, c, r));
        L.sigs = sigs; L.sigOf = sigOf; L.art = art; L.ag = ag;
        // the gaps: spread over the wall (no more than two side by side early on)
        const all = [...Array(C * R).keys()].sort(() => Math.random() - .5), miss = [];
        for (const i of all) { if (miss.length >= lv.miss) break; const c = i % C, r = Math.floor(i / C); const nb = miss.filter(j => Math.abs(j % C - c) + Math.abs(Math.floor(j / C) - r) === 1).length; if (k < 3 && nb > 0) continue; miss.push(i); }
        for (const i of all) { if (miss.length >= lv.miss) break; if (!miss.includes(i)) miss.push(i); }
        miss.forEach(i => L.holes.add(i));
        const wg = wallT.getContext(); wg.drawImage(ag.canvas, 0, 0); const cw = AW / C, ch = AH / R; miss.forEach(i => brick(wg, (i % C) * cw, Math.floor(i / C) * ch, cw, ch)); wallT.update();
        L.wallT = wallT; L.wg = wg;
        const artM = new B.StandardMaterial('muArtM', scene); artM.diffuseTexture = art; artM.emissiveColor = new B.Color3(.32, .32, .32); artM.specularColor = new B.Color3(.05, .05, .05);
        const wallM = new B.StandardMaterial('muWallM', scene); wallM.diffuseTexture = wallT; wallM.emissiveColor = new B.Color3(.32, .32, .32); wallM.specularColor = new B.Color3(.05, .05, .05);
        L.nodes.push({ dispose() { art.dispose(); wallT.dispose(); artM.dispose(); wallM.dispose(); } });
        let strayM = null, strayPx = null;
        if (lv.strays) { const sT = mk('muStray'), sg = sT.getContext(); ART[lv.art](sg, 1); sT.update(); strayPx = sg.getImageData(0, 0, AW, AH).data; strayM = new B.StandardMaterial('muStrayM', scene); strayM.diffuseTexture = sT; strayM.emissiveColor = artM.emissiveColor.clone(); strayM.specularColor = artM.specularColor.clone(); L.nodes.push({ dispose() { sT.dispose(); strayM.dispose(); } }); }
        // the wall plane (faces the camera: CreatePlane's front is -z)
        const wall = keep(B.MeshBuilder.CreatePlane('muWall', { width: MW, height: MH }, scene)); wall.position.set(0, MY + MH / 2, D - .03); wall.material = wallM; wall.isPickable = true; wall.metadata = { muWall: true }; L.wall = wall;
        const frame = (w, h, x, y, z, m, d = .08) => { const b = keep(B.MeshBuilder.CreateBox('muFrame', { width: w, height: h, depth: d }, scene)); b.position.set(x, y, z); b.material = m; b.isPickable = false; return b; };
        for (const sd of [-1, 1]) { frame(MW + .3, .12, 0, MY + MH / 2 + sd * (MH / 2 + .06), D - .05, M.rim); frame(.12, MH + .3, sd * (MW / 2 + .06), MY + MH / 2, D - .05, M.rim); }
        // the cart: a slanted board on legs, spray cans along its back edge
        const cart = keep(new B.TransformNode('muCart', scene)); cart.position.set(0, CART.y, CART.z); cart.rotation.x = CART.tilt; L.cart = cart;
        const nLoose = lv.miss + (lv.strays || 0), rows = nLoose <= 12 ? 1 : nLoose <= 24 ? 2 : nLoose <= 40 ? 3 : 4, cartH = CART.h + Math.max(0, rows - 2) * .3;
        const board = B.MeshBuilder.CreateBox('muBoard', { width: CART.w, height: cartH, depth: .08 }, scene); board.parent = cart; board.position.z = .05; board.material = M.cart; board.isPickable = false; ctx.add(board); L.nodes.push(board);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const leg = keep(B.MeshBuilder.CreateCylinder('muLeg', { height: CART.y + .3, diameter: .07, tessellation: 6 }, scene)); leg.position.set(sx * (CART.w / 2 - .25), (CART.y + .3) / 2 - .1, CART.z + sz * .3); leg.material = M.rim; leg.isPickable = false; }
        for (let i = 0; i < 9; i++) { const can = keep(B.MeshBuilder.CreateCylinder('muCan', { height: .26, diameter: .085, tessellation: 10 }, scene)); can.position.set(-CART.w / 2 + .3 + i * .17, .14, CART.z + .55 + (i % 2) * .08); can.material = M.cans[i % 3]; can.isPickable = false; }
        // the loose tiles: the gaps' pictures (turned from level 3) and the strays, shuffled, in rows on the cart
        const loose = miss.map(i => ({ home: i, src: 'art', c: i % C, r: Math.floor(i / C) }));
        if (lv.strays) { // squares of the other night that fit no gap whichever way they are turned, the most different first
          // (lookalike: the closest ones first, so they could pass for the wall's own)
          const cand = [...Array(C * R).keys()].map(i => { const c = i % C, r = Math.floor(i / C), sig = sigOf(strayPx, c, r); let d = 0; for (let q = 0; q < sig.length; q++) d += Math.abs(sig[q] - sigs[i][q]); return { home: -1, src: 'stray', c, r, sig, d, turn: 0 }; }).sort((a, b) => lv.lookalike ? a.d - b.d : b.d - a.d);
          for (const t of cand) { if (loose.length >= miss.length + lv.strays) break; if (miss.some(i => [0, 1, 2, 3].some(q => { t.turn = q; return fits(t, i); }))) continue; t.turn = 0; loose.push(t); } }
        loose.sort(() => Math.random() - .5);
        const perRow = Math.ceil(loose.length / rows), ts = Math.min(cell, 1.05, (CART.w - .4) / perRow - .06, (cartH - .2) / rows - .06);
        loose.forEach((t, n) => {
          const m = keep(B.MeshBuilder.CreatePlane('muTile', { size: 1 }, scene)); m.material = t.src === 'art' ? artM : strayM; m.isPickable = true; m.metadata = { muTile: n };
          const P = m.getVerticesData(B.VertexBuffer.PositionKind), uv = [];
          for (let v = 0; v < P.length; v += 3) uv.push((t.c + P[v] + .5) / C, (R - t.r - 1 + P[v + 1] + .5) / R);
          m.setVerticesData(B.VertexBuffer.UVKind, uv);
          const row = Math.floor(n / perRow), col = n - row * perRow, nRow = Math.min(perRow, loose.length - row * perRow);
          t.slot = new V3((col - (nRow - 1) / 2) * (ts + .06), ((rows - 1) / 2 - row) * (ts + .06), -.02);
          t.turn = lv.turn ? 1 + Math.floor(Math.random() * 3) : 0; t.m = m; t.n = n; t.size = ts; t.placed = false; t.anim = null;
          m.parent = cart; m.position.copyFrom(t.slot); m.scaling.setAll(ts); m.rotation.z = -t.turn * Math.PI / 2;
          L.tiles.push(t);
        });
        // a gold edge behind the held tile
        const glow = B.MeshBuilder.CreatePlane('muGlow', { size: 1 }, scene); glow.material = M.gold; glow.isPickable = false; glow.parent = cart; glow.setEnabled(false); ctx.add(glow); L.nodes.push(glow); L.glow = glow;
        const flash = keep(B.MeshBuilder.CreatePlane('muFlash', { size: 1 }, scene)); flash.material = M.gold; flash.isPickable = false; flash.visibility = 0; L.flash = flash; L.flashT = 0;
        st.held = null; info();
      }
      const info = () => H.info(L ? `Level ${L.k + 1} / ${LEVELS.length} · ${L.C} × ${L.R} · ${L.holes.size} gap${L.holes.size === 1 ? '' : 's'} left · mistakes ${L.mistakes}` : 'Pick a wall');
      const cellCenter = (i) => new V3((i % L.C + .5) * L.cell - MW / 2, MY + MH - (Math.floor(i / L.C) + .5) * L.cell, D - .05);
      // does tile t, turned as it is, show what gap i showed (8 x 8 colours, turned the same way)
      function fits(t, i) {
        const want = L.sigs[i], have = t.src === 'art' ? L.sigs[t.r * L.C + t.c] : t.sig, SG = 8; let d = 0;
        for (let j = 0; j < SG; j++) for (let k = 0; k < SG; k++) {
          // the tile shows turned a quarter clockwise per turn (rotation.z -pi/2 each): the square seen at (k, j) holds the
          // tile's own (j, SG-1-k), once per turn
          let a = k, b = j; for (let q = 0; q < t.turn; q++) { const na = b, nb = SG - 1 - a; a = na; b = nb; }
          const o1 = (b * SG + a) * 3, o2 = (j * SG + k) * 3; d += Math.abs(have[o1] - want[o2]) + Math.abs(have[o1 + 1] - want[o2 + 1]) + Math.abs(have[o1 + 2] - want[o2 + 2]);
        }
        return d / (SG * SG * 3) < 7;
      }
      function hold(t) {
        if (st.held === t) { if (L.lv.turn) { t.turn = (t.turn + 1) % 4; t.spin = { from: t.m.rotation.z, to: -t.turn * Math.PI / 2, t: 0 }; ctx.note(520, 'pluck'); } return; }
        st.held = t; ctx.note(660, 'pluck');
      }
      function tryGap(i) {
        const t = st.held; if (!t || !L.holes.has(i)) return;
        if (fits(t, i)) {
          L.holes.delete(i); t.placed = true; st.held = null; L.filled++;
          // off the cart into the gap (in the game's own frame), upright, at the wall's square size
          t.anim = { from: ctx.toLocal(t.m.getAbsolutePosition()), to: cellCenter(i), t: 0, s0: t.size, s1: L.cell * .985, at: i };
          t.spin = null; t.m.parent = ctx.frame; t.m.position.copyFrom(t.anim.from); t.m.rotation.set(0, 0, -t.turn * Math.PI / 2); ctx.sound('polish');
          if (!L.holes.size) { st.phase = 'solved'; st.wait = 1.6; ctx.sound('gamewin'); H.msg('The wall is whole!', 1600, `${L.mistakes} mistake${L.mistakes === 1 ? '' : 's'}`);
            if (L.k + 1 > doneUpTo) { doneUpTo = L.k + 1; try { localStorage.setItem(KEY, String(doneUpTo)); } catch (e) {} } }
        } else {
          L.mistakes++; t.shake = .5; ctx.sound('thock');
          // the right gap but a wrong turn says so
          const own = t.src === 'art' && L.holes.has(i) && (() => { const keepT = t.turn; for (let q = 1; q < 4; q++) { t.turn = (keepT + q) % 4; if (fits(t, i)) { t.turn = keepT; return true; } } t.turn = keepT; return false; })();
          H.msg(own ? 'Right place, turn it' : t.src === 'stray' ? 'Not from this wall?' : 'Not there', 900);
        }
        info();
      }
      function hint() {
        const t = st.held; if (!t || st.phase !== 'play') return;
        const at = [...L.holes].find(i => { const keepT = t.turn; for (let q = 0; q < 4; q++) { t.turn = q; if (fits(t, i)) { t.turn = keepT; return true; } } t.turn = keepT; return false; });
        L.mistakes++; info();
        if (at == null) { H.msg('This one is from another wall', 1100); return; }
        const p = cellCenter(at); L.flash.position.set(p.x, p.y, D - .07); L.flash.scaling.setAll(L.cell * 1.08); L.flashT = 1.2;
      }
      // the level picker
      const hud = document.getElementById('gameHud'), pick = document.createElement('div');
      pick.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(380px,90vw);background:rgba(16,12,30,.94);border:1px solid rgba(255,122,230,.7);border-radius:14px;padding:16px;text-align:center;pointer-events:auto;font:15px/1.4 system-ui,sans-serif;color:#eee';
      pick.innerHTML = `<div style="font:800 13px/1.2 system-ui;letter-spacing:.14em;text-transform:uppercase;color:#ff7ae6;margin-bottom:10px">Street Art</div><div style="margin-bottom:12px;color:#bbb">Put the missing tiles back in the mural.</div>`
        + `<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:7px">${LEVELS.map((lv, k) => { const open = k <= doneUpTo, done = k < doneUpTo; return `<button type="button" data-k="${k}" ${open ? '' : 'disabled'} style="padding:9px 2px;border-radius:9px;border:1px solid ${open ? '#ff7ae6' : '#444'};background:${done ? 'rgba(255,122,230,.22)' : 'rgba(255,255,255,.04)'};color:${open ? '#fff' : '#666'};font:700 14px system-ui;cursor:${open ? 'pointer' : 'default'}">${open ? k + 1 : '🔒'}${done ? ' ✓' : ''}</button>`; }).join('')}</div>`;
      pick.querySelectorAll('button[data-k]').forEach(b => b.onclick = (e) => { e.stopPropagation(); b.blur(); choose(+b.dataset.k); });
      function choose(k) { if (st.phase !== 'pick' || k > doneUpTo || k >= LEVELS.length) return; pick.remove(); st.phase = 'play'; build(k); const lv = LEVELS[k]; H.msg(`${lv.c} × ${lv.r}`, 1000, lv.lookalike ? 'gold on gold: some tiles only look like they belong' : lv.strays ? 'some tiles are from another wall' : lv.turn ? 'the tiles lie turned' : ''); }
      hud.appendChild(pick);
      const P = def.player || [-MW / 2 - .3, D - 1.2, .5]; ctx.player.place(P[0], P[1], P[2]);
      const cam = def.cam || [0, 3.3, D - 9.2], look = def.at || [0, 2.5, D];
      ctx.look(cam, look, def.fov || .78);
      H.title(def.title || 'Street Art'); H.score(''); info();
      H.hint('Click a loose tile, then the gap it fits. Click the held tile again (or <kbd>R</kbd>) to turn it; <kbd>H</kbd> shows its gap (a mistake).');
      if (ctx.startLevel != null) choose(ctx.startLevel); // the result card's Next wall
      return {
        update(dt) {
          ctx.look(cam, look);
          if (!L) return;
          if (st.phase === 'play') L.t += dt;
          const T = performance.now() / 1000;
          for (const t of L.tiles) {
            if (t.anim) { const a = t.anim; a.t += dt / .35; const u = Math.min(1, a.t), e = u * u * (3 - 2 * u); t.m.position = V3.Lerp(a.from, a.to, e); t.m.position.y += Math.sin(u * Math.PI) * .4; t.m.scaling.setAll(a.s0 + (a.s1 - a.s0) * e);
              if (u >= 1) { t.anim = null; const cw = AW / L.C, ch = AH / L.R, x = (a.at % L.C) * cw, y = Math.floor(a.at / L.C) * ch; L.wg.drawImage(L.ag.canvas, x, y, cw, ch, x, y, cw, ch); L.wallT.update(); t.m.setEnabled(false); }
              continue; }
            if (t.placed) continue;
            if (t.spin) { t.spin.t += dt / .18; const u = Math.min(1, t.spin.t); t.m.rotation.z = t.spin.from + (t.spin.to - t.spin.from) * u; if (u >= 1) { t.spin = null; t.m.rotation.z = -t.turn * Math.PI / 2; } }
            const held = st.held === t, lift = held ? -.12 - Math.sin(T * 5) * .02 : 0;
            t.m.position.set(t.slot.x + (t.shake > 0 ? Math.sin(t.shake * 50) * .05 : 0), t.slot.y + (held ? .04 : 0), t.slot.z + lift);
            if (t.shake > 0) t.shake = Math.max(0, t.shake - dt);
          }
          if (st.held) { const t = st.held; L.glow.setEnabled(true); L.glow.position.set(t.m.position.x, t.m.position.y, t.m.position.z + .01); L.glow.scaling.setAll(t.size * 1.14); } else L.glow.setEnabled(false);
          if (L.flashT > 0) { L.flashT = Math.max(0, L.flashT - dt); L.flash.visibility = Math.min(.85, L.flashT) * (.6 + .4 * Math.sin(T * 14)); }
          if (st.phase === 'solved' && (st.wait -= dt) <= 0 && !L.tiles.some(t => t.anim)) {
            st.phase = 'done'; H.hint('');
            const k = L.k, score = Math.max(Math.round(BASE[k] / 2), BASE[k] - 5 * L.mistakes);
            ctx.finish({ score, label: 'points', solved: true, passed: score >= (def.pass || 0), next: k + 1 < LEVELS.length ? k + 1 : null, nextLabel: 'Next wall',
              extra: `The ${L.C} × ${L.R} wall is whole: ${L.lv.miss} tiles, ${L.mistakes} mistake${L.mistakes === 1 ? '' : 's'}, ${Math.round(L.t)} s.${k + 1 < LEVELS.length ? ' The next wall is open.' : ' Every wall is whole.'}` });
          }
        },
        key(e, down) {
          if (!down || e.repeat) return; const k = e.key.toLowerCase();
          if (st.phase === 'pick') { const n = k === '0' ? 10 : parseInt(k, 10); if (n >= 1 && n <= LEVELS.length) choose(n - 1); return; } // 1-9, 0 = the tenth
          if (st.phase !== 'play') return;
          if (k === 'r' && st.held) hold(st.held); else if (k === 'h') hint();
        },
        pointer(evt) {
          if (st.phase !== 'play' || evt.type !== B.PointerEventTypes.POINTERDOWN) return;
          const right = evt.event?.button === 2;
          const hit = scene.pickWithRay(ctx.ray(), m => m.metadata?.muTile !== undefined || m.metadata?.muWall);
          if (!hit?.hit) return;
          if (hit.pickedMesh.metadata.muTile !== undefined) { const t = L.tiles[hit.pickedMesh.metadata.muTile]; if (t.placed) return; if (right && st.held === t) hold(t); else if (right) { st.held = t; hold(t); } else hold(t); return; }
          const uv = hit.getTextureCoordinates(); if (!uv) return;
          const c = Math.min(L.C - 1, Math.floor(uv.x * L.C)), r = Math.min(L.R - 1, Math.floor((1 - uv.y) * L.R)); tryGap(r * L.C + c);
        },
        _test: { st, choose, hold, tryGap, hint, fits, get L() { return L; }, LEVELS, ART, unlock(k) { doneUpTo = Math.max(doneUpTo, k); },
          // put the held tile, turned right, into its own gap (tests)
          solveOne() { for (const t of L.tiles) { if (t.placed || t.home < 0) continue; const keepT = t.turn; t.turn = 0; const i = L.holes.has(t.home) && fits(t, t.home) ? t.home : [...L.holes].find(i => fits(t, i)); if (i != null) { st.held = t; tryGap(i); return true; } t.turn = keepT; } return false; } },
        dispose() { pick.remove(); if (L) L.nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); }
      };
    }
  };
  window.RebelGames.register('mural', G);
})();
