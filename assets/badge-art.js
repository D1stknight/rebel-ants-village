// Badge art (Oct 25): every badge a medal in the Universe's look (dark metal, glowing enamel, the faction emblems),
// drawn on a canvas. Used by the journal / badge card (village.html) and by tools/gen-badge-art.mjs, which writes the
// same pictures to assets/badges/medals/ for RAAP. Shape = what kind of badge, metal + stars = how rare, colours + emblem =
// which village or path, the icon = this badge.
(function () {
  const TAU = Math.PI * 2;

  // rarity: frame metal, glow / gem colour, stars, extra ornaments
  const RARITY = {
    Common:    { metal: 'bronze',   glow: '#d9a46c', stars: 1 },
    Uncommon:  { metal: 'silver',   glow: '#9fe0a8', stars: 2, rivets: true },
    Rare:      { metal: 'gold',     glow: '#7fb8ff', stars: 3, rivets: true, laurel: true },
    Epic:      { metal: 'gold',     glow: '#c89bff', stars: 4, rivets: true, laurel: true, aura: .45 },
    Legendary: { metal: 'royal',    glow: '#ffd36a', stars: 5, rivets: true, laurel: true, aura: .8, rays: true },
    Mythic:    { metal: 'obsidian', glow: '#ff7a2e', stars: 5, rivets: true, laurel: true, aura: 1, rays: true, flames: true }
  };
  // metal gradients: deep shadow, shadow, mid, highlight, mid, shadow (light from the top left)
  const METAL = {
    bronze:   ['#2a1609', '#6e3f1d', '#a86a3a', '#f2c08a', '#b97a45', '#4a2a12'],
    silver:   ['#1d2228', '#59636c', '#9aa6af', '#f4f8fa', '#aeb9c1', '#3c444b'],
    gold:     ['#2a1903', '#7d5410', '#c08b2a', '#fff0a8', '#d6a23e', '#5a3a08'],
    royal:    ['#2e1a02', '#94621a', '#e0aa3c', '#fffbe0', '#f0c24e', '#6a4508'],
    obsidian: ['#060405', '#22171a', '#4a2c26', '#ffb46a', '#7a3a22', '#140b0b']
  };
  // fields: [edge, centre] enamel colours, the emblem / icon colour, the pattern
  const VILLAGE_LOOK = {
    hub:         { field: ['#2a0c04', '#c2501a'], ink: 'gold', pattern: 'stars', icon: 'ninja', nebula: true },
    ronin:       { field: ['#09080a', '#3a0d14'], ink: '#ff4a4a', pattern: 'asanoha' },
    samurai:     { field: ['#3e0707', '#a81d1d'], ink: 'gold', pattern: 'seigaiha' },
    shogun:      { field: ['#140a2e', '#4d2486'], ink: 'gold', pattern: 'kikko' },
    bushi:       { field: ['#060f24', '#1e3a72'], ink: 'gold', pattern: 'seigaiha' },
    buke:        { field: ['#1d2510', '#56692e'], ink: '#eadcae', pattern: 'kikko' },
    ashigaru:    { field: ['#0b2213', '#2a6a3b'], ink: '#e6d29a', pattern: 'asanoha' },
    kenshi:      { field: ['#06292a', '#1b7c7c'], ink: '#dfe8ec', pattern: 'seigaiha' },
    yamabushi:   { field: ['#041c22', '#145566'], ink: '#9eeaff', pattern: 'spiral' },
    sohei:       { field: ['#5a2a04', '#e08a1c'], ink: '#fff1cf', pattern: 'asanoha' },
    wokou:       { field: ['#1e0d08', '#6a3220'], ink: '#ffd23e', pattern: 'seigaiha' },
    warrior:     { field: ['#3a1408', '#a8481e'], ink: '#f6cda0', pattern: 'kikko' },
    'cute-creepy': { field: ['#12061f', '#4b1f78'], ink: '#ff9a3c', pattern: 'stars', icon: 'pumpkin' },
    chumpz:      { field: ['#03343a', '#13a0a4'], ink: '#ffe14a', pattern: 'seigaiha', icon: 'banana' },
    'saints-la': { field: ['#2a0a3e', '#e2507e'], ink: '#ffd76a', pattern: 'rays', icon: 'halo' }
  };
  const CATEGORY_LOOK = {
    explorer:  { field: ['#06281c', '#1f7a56'], ink: '#c9f5dc', pattern: 'asanoha', shape: 'star8' },
    story:     { field: ['#1c0703', '#b4461a'], ink: 'gold', pattern: 'stars', shape: 'kiku', nebula: true },
    ronin:     { ...VILLAGE_LOOK.ronin, shape: 'circle' },
    samurai:   { ...VILLAGE_LOOK.samurai, shape: 'circle' },
    arcade:    { field: ['#12052a', '#5a1a9a'], ink: '#5ff4ff', pattern: 'grid', shape: 'oct' },
    community: { field: ['#061a40', '#1f5cc0'], ink: '#d6e8ff', pattern: 'seigaiha', shape: 'circle' },
    builder:   { field: ['#2a1806', '#9a6418'], ink: '#ffe0a0', pattern: 'kikko', shape: 'diamond' },
    villages:  { shape: 'shield' },
    secrets:   { field: ['#0c0620', '#3c1f78'], ink: '#dccbff', pattern: 'stars', shape: 'hex' },
    collector: { field: ['#04261c', '#137a58'], ink: 'gold', pattern: 'seigaiha', shape: 'coin' }
  };
  // story medals each in a colour of their own (a chapter, a friend village)
  const BADGE_LOOK = {
    'story-first-warning': { field: ['#210305', '#9a1a22'], pattern: 'asanoha' },
    'book1-echo-witness': { field: ['#03202a', '#178694'], pattern: 'seigaiha' },
    'book1-faction-envoy': { field: ['#0c0a30', '#3f3aa8'], pattern: 'kikko' },
    'book1-storm-watcher': { field: ['#070e1a', '#3b5578'], pattern: 'seigaiha', ink: '#dfeaff' },
    'saints-la-party': { ...VILLAGE_LOOK['saints-la'], nebula: false },
    'chumpz-cove-party': { ...VILLAGE_LOOK.chumpz, nebula: false },
    'moon-tales-coven': { ...VILLAGE_LOOK['cute-creepy'], ink: '#e9d4ff', nebula: false },
    'story-tunnel-witness': { field: ['#160c05', '#6e4626'], pattern: 'kikko' },
    'story-dust-reader': { field: ['#260805', '#ab3e26'], pattern: 'stars' },
    'story-old-roots': { field: ['#061609', '#2f6d36'], pattern: 'asanoha' },
    'secret-beneath-roots': { field: ['#040207', '#2c0f3e'], pattern: 'stars', ink: '#ffb066', nebula: true }
  };
  // the icon of each badge (village badges carry their emblem)
  const BADGE_ICON = {
    'explorer-sprout': 'sprout', 'explorer-forest-wanderer': 'pine', 'explorer-pathfinder': 'compass',
    'explorer-realm-traveler': 'portal', 'explorer-root-runner': 'root',
    'story-hub-initiate': 'ninja', 'story-first-warning': 'bell', 'book1-echo-witness': 'echo', 'book1-faction-envoy': 'scroll',
    'book1-storm-watcher': 'storm', 'saints-la-party': 'halo', 'chumpz-cove-party': 'banana', 'moon-tales-coven': 'moon',
    'book1-colony-awake': 'sunrise', 'story-tunnel-witness': 'tunnel', 'story-dust-reader': 'dust', 'story-old-roots': 'tree',
    'ronin-watcher': 'eye', 'ronin-shadow-walker': 'steps', 'ronin-unseen-hand': 'hand',
    'samurai-initiate': 'kabuto', 'samurai-honor-guard': 'shield',
    'arcade-initiate': 'joystick', 'arcade-combo-spark': 'spark', 'community-colony-caller': 'taiko', 'community-signal-carrier': 'signal',
    'builder-world-builder': 'hammer', 'builder-root-sculptor': 'chisel', 'secret-beneath-roots': 'abyss',
    'mini-ants-5': 'ant', 'mini-ants-15': 'ant', 'chest-first-coin': 'coin', 'chest-hunter': 'chest', 'chest-master': 'hoard',
    'games-all': 'trophy', 'collector-relic-keeper': 'shard'
  };
  const FACTIONS = ['ronin', 'samurai', 'shogun', 'bushi', 'buke', 'ashigaru', 'kenshi', 'yamabushi', 'sohei', 'wokou', 'warrior'];

  // what to draw for a badge: { shape, look, icon | emblem, number, village, ornament }
  function plan(badge) {
    const id = badge.badgeId || '', cat = badge.category || 'explorer';
    let village = null, kind = null, m;
    if ((m = id.match(/^(crest|secrets|games|legend-chest)-(.+)$/)) && VILLAGE_LOOK[m[2]]) { kind = m[1]; village = m[2]; }
    if (badge.emblem && !village) village = badge.emblem;
    const base = CATEGORY_LOOK[cat] || CATEGORY_LOOK.explorer;
    const look = { ...base, ...(village ? VILLAGE_LOOK[village] : {}), ...(BADGE_LOOK[id] || {}) };
    const p = { shape: base.shape || 'circle', look, village, kind, ornament: null, number: null };
    if (kind === 'crest') p.shape = 'shield';
    if (kind === 'secrets') { p.shape = 'hex'; p.ornament = 'eye'; }
    if (kind === 'games') { p.shape = 'oct'; p.ornament = 'crown'; }
    if (kind === 'legend-chest') { p.shape = 'coin'; p.icon = 'chest'; p.small = true; }
    if (village && !p.icon) { if (FACTIONS.includes(village)) p.emblem = village; else p.icon = VILLAGE_LOOK[village].icon; }
    if (!p.icon && !p.emblem) p.icon = BADGE_ICON[id] || ({ ronin: 'hand', samurai: 'kabuto' })[cat] || 'star';
    if (badge.requirementType === 'secretCount') { p.icon = 'keyhole'; p.number = badge.requirementValue; }
    if (id === 'mystery') { p.icon = 'question'; p.look = { field: ['#07060c', '#1c1830'], ink: '#8a83a8', pattern: 'stars' }; }
    if (badge.requirementType === 'miniAnts' || badge.requirementType === 'chestCount' && Number(badge.requirementValue) > 1) p.number = badge.requirementValue;
    if (kind === 'legend-chest' && FACTIONS.includes(village)) p.emblem = village; // the chest with the village's emblem over it
    return p;
  }

  // ---------- paths ----------
  function shapePath(g, shape, r) {
    g.beginPath();
    if (shape === 'circle') g.arc(0, 0, r, 0, TAU);
    else if (shape === 'coin') { const n = 72; for (let i = 0; i <= n * 2; i++) { const a = i / (n * 2) * TAU - Math.PI / 2, rr = i % 2 ? r * .965 : r; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } }
    else if (shape === 'hex') { for (let i = 0; i < 6; i++) { const a = i / 6 * TAU - Math.PI / 2; corner(g, i, Math.cos(a) * r, Math.sin(a) * r); } }
    else if (shape === 'oct') { for (let i = 0; i < 8; i++) { const a = (i + .5) / 8 * TAU - Math.PI / 2; corner(g, i, Math.cos(a) * r * 1.02, Math.sin(a) * r * 1.02); } }
    else if (shape === 'diamond') { const k = r * 1.16, q = .3; g.moveTo(0, -k); g.quadraticCurveTo(k * q, -k * q, k, 0); g.quadraticCurveTo(k * q, k * q, 0, k); g.quadraticCurveTo(-k * q, k * q, -k, 0); g.quadraticCurveTo(-k * q, -k * q, 0, -k); }
    else if (shape === 'star8') { for (let i = 0; i < 16; i++) { const a = i / 16 * TAU - Math.PI / 2, rr = i % 2 ? r * .8 : r * (i % 4 ? 1 : 1.07); g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } }
    else if (shape === 'kiku') { const n = 16; for (let i = 0; i < n; i++) { const a0 = i / n * TAU - Math.PI / 2, a1 = (i + 1) / n * TAU - Math.PI / 2, am = (a0 + a1) / 2; g.arc(Math.cos(am) * r * .9, Math.sin(am) * r * .9, r * .19, am - Math.PI * .62, am + Math.PI * .62); } }
    else if (shape === 'shield') {
      const w = r * .98, top = -r * 1.02;
      g.moveTo(-w, top + r * .1); g.quadraticCurveTo(-w * .55, top - r * .02, 0, top + r * .06); g.quadraticCurveTo(w * .55, top - r * .02, w, top + r * .1);
      g.lineTo(w * .97, r * .08); g.bezierCurveTo(w * .9, r * .62, w * .42, r * .9, 0, r * 1.1); g.bezierCurveTo(-w * .42, r * .9, -w * .9, r * .62, -w * .97, r * .08);
    }
    g.closePath();
  }
  function corner(g, i, x, y) { if (i === 0) g.moveTo(x, y); else g.lineTo(x, y); }

  function metalGrad(g, metal, r, flip) {
    const M = METAL[metal] || METAL.gold, gr = g.createLinearGradient(-r * (flip ? -1 : 1), -r, r * (flip ? -1 : 1), r);
    gr.addColorStop(0, M[1]); gr.addColorStop(.22, M[3]); gr.addColorStop(.42, M[2]); gr.addColorStop(.6, M[4]); gr.addColorStop(.8, M[1]); gr.addColorStop(1, M[0]);
    return gr;
  }
  function inkFill(g, ink, metal, r) {
    if (ink === 'gold') { const M = METAL[{ silver: 'gold', bronze: 'gold', obsidian: 'royal' }[metal] || metal] || METAL.gold, gr = g.createLinearGradient(0, -r, 0, r); gr.addColorStop(0, M[3]); gr.addColorStop(.45, M[2]); gr.addColorStop(.55, M[4]); gr.addColorStop(1, M[1]); return gr; }
    return ink;
  }

  // ---------- field patterns (Japanese motifs, faint in the enamel) ----------
  function pattern(g, kind, r, col) {
    g.save(); g.strokeStyle = col; g.fillStyle = col; g.lineWidth = Math.max(1, r * .012);
    if (kind === 'seigaiha') { const s = r * .2; for (let y = -r - s; y < r + s; y += s * .5) for (let x = -r - s; x < r + s; x += s) { const ox = (Math.round(y / (s * .5)) % 2) * s * .5; for (let k = 1; k <= 3; k++) { g.beginPath(); g.arc(x + ox, y, s * .5 * k / 3, Math.PI, TAU); g.stroke(); } } }
    else if (kind === 'asanoha') { const s = r * .26; for (let y = -r - s; y < r + s; y += s * .866) for (let x = -r - s; x < r + s; x += s) { const ox = (Math.round(y / (s * .866)) % 2) * s * .5; for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; g.beginPath(); g.moveTo(x + ox, y); g.lineTo(x + ox + Math.cos(a) * s * .5, y + Math.sin(a) * s * .5); g.stroke(); } } }
    else if (kind === 'kikko') { const s = r * .17; for (let y = -r - s; y < r + s; y += s * 1.5) for (let x = -r - s; x < r + s; x += s * 1.732) { const ox = (Math.round(y / (s * 1.5)) % 2) * s * .866; g.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + Math.PI / 6; corner(g, k, x + ox + Math.cos(a) * s * .9, y + Math.sin(a) * s * .9); } g.closePath(); g.stroke(); } }
    else if (kind === 'grid') { const s = r * .16; for (let v = -r; v <= r; v += s) { g.beginPath(); g.moveTo(v, -r); g.lineTo(v, r); g.moveTo(-r, v); g.lineTo(r, v); g.stroke(); } }
    else if (kind === 'spiral') { g.beginPath(); for (let t = 0; t < 30; t += .05) { const rr = t * r * .035; g.lineTo(Math.cos(t) * rr, Math.sin(t) * rr); } g.stroke(); }
    else if (kind === 'rays') { for (let k = 0; k < 24; k++) { const a = k / 24 * TAU; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, r * 1.2, a, a + TAU / 48); g.closePath(); g.fill(); } }
    else if (kind === 'stars') { let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647; for (let k = 0; k < 70; k++) { const x = (rnd() * 2 - 1) * r, y = (rnd() * 2 - 1) * r, q = rnd(); g.globalAlpha = .35 + q * .65; g.beginPath(); g.arc(x, y, r * (.004 + q * q * .014), 0, TAU); g.fill(); } }
    g.restore();
  }

  // ---------- icons: white shapes in a [-1, 1] box (the caller tints and embosses them) ----------
  const W = '#fff';
  function fillPoly(g, pts) { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill(); }
  function ell(g, x, y, rx, ry, rot = 0) { g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, TAU); g.fill(); }
  function stroke(g, w, f) { g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); f(); g.stroke(); }
  function cut(g, f) { g.save(); g.globalCompositeOperation = 'destination-out'; f(); g.restore(); }
  function star5(g, x, y, R, r = R * .45) { const p = []; for (let i = 0; i < 10; i++) { const a = i / 10 * TAU - Math.PI / 2, rr = i % 2 ? r : R; p.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); } fillPoly(g, p); }
  const ICONS = {
    star: g => star5(g, 0, .05, .9),
    question: g => { g.lineWidth = .24; g.lineCap = 'round'; g.beginPath(); g.arc(0, -.32, .4, Math.PI * 1.05, Math.PI * 2.35); g.quadraticCurveTo(0, .02, 0, .3); g.stroke(); ell(g, 0, .72, .15, .15); },
    sprout: g => {
      stroke(g, .16, () => { g.moveTo(0, .78); g.quadraticCurveTo(-.06, .25, .04, -.2); });
      g.save(); g.translate(.04, -.2); g.rotate(-.5); ell(g, -.42, -.05, .44, .2); g.restore();
      g.save(); g.translate(.04, -.2); g.rotate(.62); ell(g, .5, -.16, .56, .24); g.restore();
      ell(g, 0, .82, .6, .12);
    },
    pine: g => { fillPoly(g, [[0, -.98], [.42, -.42], [.2, -.42], [.62, .08], [.34, .08], [.8, .6], [-.8, .6], [-.34, .08], [-.62, .08], [-.2, -.42], [-.42, -.42]]); g.fillRect(-.11, .58, .22, .36); },
    compass: g => {
      stroke(g, .1, () => g.arc(0, 0, .86, 0, TAU));
      fillPoly(g, [[0, -1.02], [.17, -.17], [1.02, 0], [.17, .17], [0, 1.02], [-.17, .17], [-1.02, 0], [-.17, -.17]]);
      g.save(); g.rotate(Math.PI / 4); fillPoly(g, [[0, -.62], [.1, -.1], [.62, 0], [.1, .1], [0, .62], [-.1, .1], [-.62, 0], [-.1, -.1]]); g.restore();
      cut(g, () => ell(g, 0, 0, .09, .09));
    },
    torii: g => {
      g.beginPath(); g.moveTo(-1, -.72); g.quadraticCurveTo(0, -.52, 1, -.72); g.lineTo(.94, -.52); g.quadraticCurveTo(0, -.38, -.94, -.52); g.closePath(); g.fill();
      g.fillRect(-.82, -.36, 1.64, .13); g.fillRect(-.1, -.5, .2, .16);
      fillPoly(g, [[-.62, -.44], [-.45, -.44], [-.4, .92], [-.62, .92]]); fillPoly(g, [[.45, -.44], [.62, -.44], [.62, .92], [.4, .92]]);
    },
    portal: g => {
      ICONS.torii(g);
      g.lineWidth = .07; g.lineCap = 'round'; g.beginPath(); for (let t = 0; t < 14; t += .1) { const rr = .02 + t * .021; g.lineTo(Math.cos(t) * rr, .3 + Math.sin(t) * rr * 1.2); } g.stroke();
    },
    root: g => {
      stroke(g, .2, () => { g.moveTo(0, -.95); g.lineTo(0, -.3); });
      [[-.75, .85, -.1], [-.32, .95, .05], [.3, .92, -.05], [.8, .8, .1]].forEach(([x, y, c]) => stroke(g, .12, () => { g.moveTo(0, -.35); g.bezierCurveTo(x * .2, .0, x * .8 + c, y * .45, x, y); }));
      [[-.55, .45, -.85, .3], [.6, .4, .9, .25], [-.2, .6, -.35, .8]].forEach(([a, b, c, d]) => stroke(g, .06, () => { g.moveTo(a, b); g.lineTo(c, d); }));
    },
    ninja: g => {
      stroke(g, .07, () => { g.moveTo(-.28, -.42); g.bezierCurveTo(-.4, -.8, -.7, -.85, -.78, -.6); }); stroke(g, .07, () => { g.moveTo(.28, -.42); g.bezierCurveTo(.4, -.8, .7, -.85, .78, -.6); });
      ell(g, -.78, -.6, .1, .1); ell(g, .78, -.6, .1, .1);
      ell(g, 0, .12, .58, .62);
      cut(g, () => { g.beginPath(); g.moveTo(-.5, -.06); g.quadraticCurveTo(0, .1, .5, -.06); g.lineTo(.48, .1); g.quadraticCurveTo(0, .26, -.48, .1); g.closePath(); g.fill(); });
      ell(g, -.2, .07, .13, .05, .15); ell(g, .2, .07, .13, .05, -.15);
      fillPoly(g, [[.5, .02], [.95, -.18], [.92, -.06], [.52, .14]]);
    },
    bell: g => {
      ell(g, 0, -.82, .14, .12);
      g.beginPath(); g.moveTo(-.18, -.7); g.quadraticCurveTo(-.52, -.66, -.55, -.2); g.lineTo(-.62, .48); g.quadraticCurveTo(-.66, .62, -.8, .66); g.lineTo(.8, .66); g.quadraticCurveTo(.66, .62, .62, .48); g.lineTo(.55, -.2); g.quadraticCurveTo(.52, -.66, .18, -.7); g.closePath(); g.fill();
      cut(g, () => { g.fillRect(-.6, .2, 1.2, .05); g.fillRect(-.56, -.18, 1.12, .04); });
      ell(g, 0, .84, .14, .12);
    },
    echo: g => { ell(g, 0, 0, .14, .14); [.36, .6, .84].forEach((rr, i) => { stroke(g, .09 - i * .015, () => g.arc(0, 0, rr, -.75, .75)); stroke(g, .09 - i * .015, () => g.arc(0, 0, rr, Math.PI - .75, Math.PI + .75)); }); },
    scroll: g => {
      g.fillRect(-.62, -.42, 1.24, .84); ell(g, -.66, 0, .14, .5); ell(g, .66, 0, .14, .5);
      cut(g, () => { for (let k = 0; k < 4; k++) g.fillRect(-.45, -.25 + k * .15, .8 - (k % 2) * .25, .05); });
      fillPoly(g, [[.05, .38], [.22, .38], [.3, .82], [.14, .7], [-.02, .82]]);
    },
    storm: g => {
      ell(g, -.42, -.3, .34, .3); ell(g, .05, -.52, .42, .38); ell(g, .5, -.26, .34, .3); g.fillRect(-.6, -.36, 1.1, .3);
      fillPoly(g, [[.02, -.1], [.3, -.1], [.08, .28], [.3, .28], [-.18, .98], [-.04, .44], [-.26, .44]]);
    },
    sunrise: g => {
      g.beginPath(); g.arc(0, .25, .5, Math.PI, TAU); g.closePath(); g.fill();
      for (let k = 0; k < 9; k++) { const a = Math.PI + (k + .5) / 9 * Math.PI; fillPoly(g, [[Math.cos(a - .07) * .6, .25 + Math.sin(a - .07) * .6], [Math.cos(a) * .98, .25 + Math.sin(a) * .98], [Math.cos(a + .07) * .6, .25 + Math.sin(a + .07) * .6]]); }
      g.fillRect(-.95, .3, 1.9, .08); g.fillRect(-.6, .48, 1.2, .06); g.fillRect(-.32, .62, .64, .05);
    },
    tunnel: g => {
      g.beginPath(); g.moveTo(-.85, .9); g.lineTo(-.85, -.1); g.arc(0, -.1, .85, Math.PI, TAU); g.lineTo(.85, .9); g.closePath(); g.fill();
      cut(g, () => { g.beginPath(); g.moveTo(-.6, .92); g.lineTo(-.6, -.05); g.arc(0, -.05, .6, Math.PI, TAU); g.lineTo(.6, .92); g.closePath(); g.fill(); });
      stroke(g, .06, () => { g.moveTo(-.38, .92); g.lineTo(-.38, 0); g.arc(0, 0, .38, Math.PI, TAU); g.lineTo(.38, .92); });
      ell(g, 0, .2, .1, .1);
    },
    eye: g => {
      g.beginPath(); g.moveTo(-.98, 0); g.quadraticCurveTo(0, -.85, .98, 0); g.quadraticCurveTo(0, .85, -.98, 0); g.closePath(); g.fill();
      cut(g, () => ell(g, 0, 0, .4, .4)); ell(g, 0, 0, .3, .3); cut(g, () => ell(g, 0, 0, .1, .2)); ell(g, .1, -.1, .05, .05);
    },
    dust: g => { let s = 3; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647; for (let t = 0; t < 12.5; t += .32) { const rr = .08 + t * .07; ell(g, Math.cos(t) * rr, Math.sin(t) * rr * .9, .03 + rnd() * .07, .03 + rnd() * .07); } },
    tree: g => {
      ell(g, 0, -.45, .55, .42); ell(g, -.45, -.25, .34, .3); ell(g, .45, -.25, .34, .3);
      fillPoly(g, [[-.12, -.1], [.12, -.1], [.16, .45], [-.16, .45]]);
      [[-.8, .9], [-.4, .95], [.4, .95], [.8, .9]].forEach(([x, y]) => stroke(g, .08, () => { g.moveTo(0, .4); g.quadraticCurveTo(x * .4, .55, x, y); }));
    },
    steps: g => { [[-.45, .65, -.25], [.15, .25, .2], [-.2, -.2, -.2], [.42, -.62, .25]].forEach(([x, y, r]) => { g.save(); g.translate(x, y); g.rotate(r); ell(g, 0, 0, .15, .26); ell(g, 0, .34, .1, .1); g.restore(); }); },
    hand: g => {
      ell(g, 0, .25, .46, .5);
      [[-.36, -.32, .1, .34, -.25], [-.13, -.48, .1, .4, -.08], [.12, -.5, .1, .4, .06], [.34, -.38, .09, .34, .22]].forEach(([x, y, rx, ry, rot]) => ell(g, x, y, rx, ry, rot));
      ell(g, -.56, .16, .1, .3, -.9);
    },
    kabuto: g => {
      // bowl, the neck guard flaring down in three plates, the turned-back side flaps and the two horns with a crest
      g.beginPath(); g.arc(0, .06, .5, Math.PI, TAU); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(-.56, .1); g.lineTo(.56, .1); g.lineTo(.92, .7); g.quadraticCurveTo(0, .52, -.92, .7); g.closePath(); g.fill();
      cut(g, () => { g.lineWidth = .05; [.3, .5].forEach(y => { g.beginPath(); g.moveTo(-.62 - (y - .1) * .55, y); g.quadraticCurveTo(0, y - .14, .62 + (y - .1) * .55, y); g.stroke(); }); });
      fillPoly(g, [[-.56, .02], [-.86, -.2], [-.8, .12]]); fillPoly(g, [[.56, .02], [.86, -.2], [.8, .12]]);
      g.beginPath(); g.moveTo(-.08, -.36); g.quadraticCurveTo(-.5, -.5, -.62, -1); g.quadraticCurveTo(-.36, -.62, -.02, -.5); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(.08, -.36); g.quadraticCurveTo(.5, -.5, .62, -1); g.quadraticCurveTo(.36, -.62, .02, -.5); g.closePath(); g.fill();
      ell(g, 0, -.38, .14, .14); cut(g, () => ell(g, 0, -.38, .06, .06));
    },
    shield: g => {
      g.beginPath(); g.moveTo(-.72, -.82); g.lineTo(.72, -.82); g.lineTo(.7, .05); g.bezierCurveTo(.64, .5, .3, .78, 0, .96); g.bezierCurveTo(-.3, .78, -.64, .5, -.7, .05); g.closePath(); g.fill();
      cut(g, () => { g.fillRect(-.06, -.7, .12, 1.4); g.fillRect(-.6, -.3, 1.2, .12); });
    },
    joystick: g => { g.beginPath(); g.roundRect(-.8, .3, 1.6, .5, .14); g.fill(); g.fillRect(-.07, -.4, .14, .75); ell(g, 0, -.52, .26, .26); ell(g, .5, .22, .13, .07); ell(g, -.5, .22, .13, .07); },
    spark: g => { fillPoly(g, [[0, -1], [.16, -.16], [1, 0], [.16, .16], [0, 1], [-.16, .16], [-1, 0], [-.16, -.16]]); g.save(); g.translate(.62, -.6); g.scale(.32, .32); ICONS.spark4(g); g.restore(); g.save(); g.translate(-.6, .62); g.scale(.24, .24); ICONS.spark4(g); g.restore(); },
    spark4: g => fillPoly(g, [[0, -1], [.2, -.2], [1, 0], [.2, .2], [0, 1], [-.2, .2], [-1, 0], [-.2, -.2]]),
    taiko: g => {
      g.beginPath(); g.moveTo(-.62, -.28); g.bezierCurveTo(-.74, .05, -.74, .35, -.62, .62); g.lineTo(.62, .62); g.bezierCurveTo(.74, .35, .74, .05, .62, -.28); g.closePath(); g.fill();
      ell(g, 0, -.28, .62, .2); cut(g, () => ell(g, 0, -.3, .5, .13));
      cut(g, () => { for (let k = 0; k < 7; k++) { const x = -.54 + k * .18; g.beginPath(); g.arc(x, -.12 + Math.abs(x) * .05, .035, 0, TAU); g.fill(); g.beginPath(); g.arc(x, .48 - Math.abs(x) * .03, .035, 0, TAU); g.fill(); } });
      stroke(g, .09, () => { g.moveTo(-.95, -.95); g.lineTo(-.1, -.36); }); stroke(g, .09, () => { g.moveTo(.95, -.95); g.lineTo(.1, -.36); });
      ell(g, -.95, -.95, .1, .1); ell(g, .95, -.95, .1, .1);
    },
    signal: g => { ell(g, 0, .05, .14, .14); fillPoly(g, [[-.06, .1], [.06, .1], [.22, .96], [-.22, .96]]); [.36, .62].forEach(rr => { stroke(g, .09, () => g.arc(0, .05, rr, -Math.PI * .85, -Math.PI * .58)); stroke(g, .09, () => g.arc(0, .05, rr, -Math.PI * .42, -Math.PI * .15)); }); },
    hammer: g => { g.save(); g.rotate(-.7); g.fillRect(-.09, -.3, .18, 1.25); g.beginPath(); g.roundRect(-.55, -.62, 1.1, .36, .06); g.fill(); g.fillRect(-.66, -.56, .14, .24); g.restore(); },
    chisel: g => {
      g.save(); g.rotate(.62); g.beginPath(); g.roundRect(-.12, -.95, .24, .6, .05); g.fill(); fillPoly(g, [[-.09, -.32], [.09, -.32], [.07, .5], [0, .62], [-.07, .5]]); g.restore();
      stroke(g, .08, () => { g.moveTo(-.85, .9); g.bezierCurveTo(-.6, .5, -.4, .82, -.2, .55); g.bezierCurveTo(-.1, .4, .1, .5, .2, .7); });
    },
    keyhole: g => { ell(g, 0, -.22, .32, .32); fillPoly(g, [[-.16, -.1], [.16, -.1], [.3, .72], [-.3, .72]]); },
    ant: g => {
      ell(g, 0, -.58, .2, .18); ell(g, 0, -.18, .16, .22); ell(g, 0, .42, .3, .42);
      [[-.15, -.2, -.72, -.45], [-.15, -.1, -.78, .05], [-.12, 0, -.68, .55], [.15, -.2, .72, -.45], [.15, -.1, .78, .05], [.12, 0, .68, .55]].forEach(([a, b, c, d]) => stroke(g, .06, () => { g.moveTo(a, b); g.quadraticCurveTo((a + c) / 2, (b + d) / 2 - .18, c, d); }));
      stroke(g, .05, () => { g.moveTo(-.08, -.72); g.quadraticCurveTo(-.25, -1, -.45, -.95); }); stroke(g, .05, () => { g.moveTo(.08, -.72); g.quadraticCurveTo(.25, -1, .45, -.95); });
    },
    coin: g => { ell(g, 0, 0, .82, .82); cut(g, () => { g.lineWidth = .07; g.beginPath(); g.arc(0, 0, .66, 0, TAU); g.stroke(); star5(g, 0, .04, .44); }); },
    chest: g => {
      g.beginPath(); g.moveTo(-.85, -.12); g.lineTo(-.85, -.3); g.quadraticCurveTo(0, -.95, .85, -.3); g.lineTo(.85, -.12); g.closePath(); g.fill();
      g.fillRect(-.85, -.04, 1.7, .86);
      cut(g, () => { g.fillRect(-.85, -.12, 1.7, .08); g.fillRect(-.55, -.8, .1, .68); g.fillRect(.45, -.8, .1, .68); g.fillRect(-.55, 0, .1, .8); g.fillRect(.45, 0, .1, .8); });
      g.beginPath(); g.roundRect(-.14, -.2, .28, .34, .05); g.fill(); cut(g, () => ell(g, 0, -.06, .05, .07));
    },
    hoard: g => { g.save(); g.translate(0, .14); g.scale(.82, .82); ICONS.chest(g); g.restore(); [[-.62, -.62], [-.2, -.82], [.24, -.8], [.64, -.58], [0, -.58]].forEach(([x, y]) => { ell(g, x, y, .17, .17); cut(g, () => { g.lineWidth = .03; g.beginPath(); g.arc(x, y, .11, 0, TAU); g.stroke(); }); }); },
    trophy: g => {
      g.beginPath(); g.moveTo(-.55, -.85); g.lineTo(.55, -.85); g.lineTo(.5, -.25); g.quadraticCurveTo(.4, .15, 0, .22); g.quadraticCurveTo(-.4, .15, -.5, -.25); g.closePath(); g.fill();
      stroke(g, .1, () => { g.moveTo(-.52, -.68); g.bezierCurveTo(-.98, -.72, -.92, -.12, -.42, -.05); }); stroke(g, .1, () => { g.moveTo(.52, -.68); g.bezierCurveTo(.98, -.72, .92, -.12, .42, -.05); });
      g.fillRect(-.09, .2, .18, .36); g.beginPath(); g.roundRect(-.42, .56, .84, .16, .04); g.fill(); g.fillRect(-.55, .74, 1.1, .2);
      cut(g, () => star5(g, 0, -.42, .24));
    },
    shard: g => {
      fillPoly(g, [[0, -1], [.4, -.35], [.3, .55], [0, .98], [-.3, .55], [-.4, -.35]]);
      cut(g, () => { g.lineWidth = .05; g.beginPath(); g.moveTo(0, -1); g.lineTo(-.08, .2); g.lineTo(0, .98); g.moveTo(-.4, -.35); g.lineTo(-.08, .2); g.lineTo(.3, .55); g.stroke(); });
    },
    moon: g => { ell(g, -.1, 0, .72, .72); cut(g, () => ell(g, .24, -.18, .62, .62)); star5(g, .5, .3, .2); star5(g, .72, -.42, .12); star5(g, .2, .72, .1); },
    halo: g => {
      g.lineWidth = .13; g.beginPath(); g.ellipse(0, -.55, .5, .17, 0, 0, TAU); g.stroke();
      [-1, 1].forEach(s => { g.save(); g.scale(s, 1); g.beginPath(); g.moveTo(.08, .02); g.bezierCurveTo(.5, -.4, .95, -.2, .98, .05); g.bezierCurveTo(.8, .05, .85, .25, .62, .3); g.bezierCurveTo(.5, .45, .3, .55, .08, .55); g.closePath(); g.fill();
        cut(g, () => { g.lineWidth = .04; [[.35, .15, .8, .02], [.3, .32, .66, .28]].forEach(([a, b, c, d]) => { g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); }); }); g.restore(); });
      ell(g, 0, .48, .12, .42);
    },
    banana: g => {
      g.beginPath(); g.moveTo(-.85, -.35); g.bezierCurveTo(-.7, .75, .5, .95, .92, .1); g.bezierCurveTo(.6, .45, -.3, .4, -.62, -.42); g.closePath(); g.fill();
      fillPoly(g, [[-.86, -.36], [-.92, -.62], [-.7, -.6], [-.62, -.42]]);
      cut(g, () => { g.lineWidth = .04; g.beginPath(); g.moveTo(-.6, -.1); g.bezierCurveTo(-.4, .45, .3, .6, .7, .2); g.stroke(); });
    },
    pumpkin: g => {
      [[-.5, .38], [.5, .38], [-.22, .44], [.22, .44], [0, .46]].forEach(([x, rx]) => ell(g, x, .12, rx, .62));
      fillPoly(g, [[-.07, -.48], [.08, -.48], [.2, -.88], [.06, -.92]]);
      cut(g, () => { fillPoly(g, [[-.42, -.05], [-.18, -.05], [-.3, -.28]]); fillPoly(g, [[.18, -.05], [.42, -.05], [.3, -.28]]);
        g.beginPath(); g.moveTo(-.5, .22); g.lineTo(-.3, .34); g.lineTo(-.16, .22); g.lineTo(0, .36); g.lineTo(.16, .22); g.lineTo(.3, .34); g.lineTo(.5, .22); g.quadraticCurveTo(.3, .6, 0, .6); g.quadraticCurveTo(-.3, .6, -.5, .22); g.closePath(); g.fill(); });
    },
    abyss: g => {
      ICONS.eye(g);
      for (let k = 0; k < 10; k++) { const a = k / 10 * TAU; stroke(g, .06, () => { g.moveTo(Math.cos(a) * .86, Math.sin(a) * .62); g.quadraticCurveTo(Math.cos(a + .3) * 1.02, Math.sin(a + .3) * .9, Math.cos(a + .15) * .98, Math.sin(a + .15) * 1.0); }); }
    }
  };

  // canvases kept on the CPU (willReadFrequently): GPU canvases cost a read-back for every copy and every picture made
  function canvas2d(s, h = s) { const c = document.createElement('canvas'); c.width = s; c.height = h; return [c, c.getContext('2d', { willReadFrequently: true })]; }
  // an emblem picture copied once onto a CPU canvas (drawing a GPU-decoded image into a CPU canvas reads it back each time)
  const cpuCopies = new WeakMap();
  function cpuCopy(img) {
    let c = cpuCopies.get(img);
    if (!c) { const [cc, g] = canvas2d(img.naturalWidth, img.naturalHeight); g.drawImage(img, 0, 0); c = cc; cpuCopies.set(img, c); }
    return c;
  }
  // a white mask of the badge's icon / emblem at size s (px), centred
  function iconMask(p, s, assets) {
    const [c, g] = canvas2d(s);
    g.fillStyle = W; g.strokeStyle = W; g.translate(s / 2, s / 2);
    const img = p.emblem && assets.emblems?.[p.emblem];
    if (img && img.complete && img.naturalWidth) {
      const k = s * .96 / Math.max(img.naturalWidth, img.naturalHeight);
      g.drawImage(cpuCopy(img), -img.naturalWidth * k / 2, -img.naturalHeight * k / 2, img.naturalWidth * k, img.naturalHeight * k);
    } else { g.scale(s / 2.1, s / 2.1); (ICONS[p.icon] || ICONS.star)(g); }
    return c;
  }
  // the mask, tinted with ink, embossed: a dark drop shadow, a light top edge, then the colour
  function drawEmboss(g, mask, size, ink, metal, glow) {
    const s = mask.width, [t, tg] = canvas2d(s);
    const tint = (col) => { tg.globalCompositeOperation = 'source-over'; tg.clearRect(0, 0, s, s); tg.drawImage(mask, 0, 0); tg.globalCompositeOperation = 'source-in'; tg.fillStyle = col; tg.fillRect(0, 0, s, s); return t; };
    const x = -size / 2;
    g.save();
    if (glow) { g.shadowColor = glow; g.shadowBlur = size * .14; }
    g.drawImage(tint('rgba(0,0,0,.7)'), x + size * .018, x + size * .03, size, size); g.shadowBlur = 0; g.shadowColor = 'transparent';
    g.drawImage(tint('rgba(255,255,255,.55)'), x - size * .008, x - size * .012, size, size);
    tg.save(); tg.setTransform(1, 0, 0, 1, s / 2, s / 2); const fill = inkFill(tg, ink, metal, s / 2); tg.restore();
    tg.globalCompositeOperation = 'source-over'; tg.clearRect(0, 0, s, s); tg.drawImage(mask, 0, 0); tg.globalCompositeOperation = 'source-in';
    tg.save(); tg.translate(s / 2, s / 2); tg.fillStyle = fill; tg.fillRect(-s / 2, -s / 2, s, s); tg.restore();
    g.drawImage(t, x, x, size, size);
    g.restore();
  }

  function laurel(g, r, metal, n = 7) {
    g.save();
    [-1, 1].forEach(sd => {
      g.save(); g.scale(sd, 1);
      g.strokeStyle = metalGrad(g, metal, r); g.lineWidth = r * .03; g.beginPath(); g.arc(0, 0, r, Math.PI * .58, Math.PI * .97); g.stroke();
      for (let i = 0; i < n; i++) {
        const a = Math.PI * (.6 + i / (n - 1) * .36), x = Math.cos(a) * r, y = Math.sin(a) * r;
        g.save(); g.translate(x, y); g.rotate(a + Math.PI * .82); g.fillStyle = metalGrad(g, metal, r * .2);
        g.beginPath(); g.ellipse(0, -r * .07, r * .035, r * .08, 0, 0, TAU); g.fill(); g.restore();
      }
      g.restore();
    });
    g.restore();
  }
  function rays(g, r, col, n = 28) {
    g.save(); const gr = g.createRadialGradient(0, 0, r * .6, 0, 0, r * 1.45); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.globalAlpha = .55;
    for (let k = 0; k < n; k++) { const a = k / n * TAU; g.beginPath(); g.moveTo(Math.cos(a - .02) * r * .5, Math.sin(a - .02) * r * .5); g.lineTo(Math.cos(a - .05) * r * 1.45, Math.sin(a - .05) * r * 1.45); g.lineTo(Math.cos(a + .05) * r * 1.45, Math.sin(a + .05) * r * 1.45); g.lineTo(Math.cos(a + .02) * r * .5, Math.sin(a + .02) * r * .5); g.closePath(); g.fill(); }
    g.restore();
  }
  function flames(g, r, col) {
    g.save(); let s = 11; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < 26; k++) {
      const a = k / 26 * TAU + rnd() * .1, h = r * (.22 + rnd() * .26), x = Math.cos(a), y = Math.sin(a);
      const gr = g.createLinearGradient(x * r * .9, y * r * .9, x * (r + h), y * (r + h)); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(255,220,120,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(Math.cos(a - .14) * r * .92, Math.sin(a - .14) * r * .92);
      g.quadraticCurveTo(Math.cos(a - .05) * (r + h * .7), Math.sin(a - .05) * (r + h * .7), Math.cos(a + .06) * (r + h), Math.sin(a + .06) * (r + h));
      g.quadraticCurveTo(Math.cos(a + .1) * (r + h * .4), Math.sin(a + .1) * (r + h * .4), Math.cos(a + .14) * r * .92, Math.sin(a + .14) * r * .92); g.closePath(); g.fill();
    }
    g.restore();
  }
  function crown(g, y, w, metal) {
    g.save(); g.translate(0, y); g.fillStyle = metalGrad(g, metal, w);
    g.beginPath(); g.moveTo(-w, w * .35); g.lineTo(-w * 1.02, -w * .3); g.lineTo(-w * .5, w * .05); g.lineTo(0, -w * .5); g.lineTo(w * .5, w * .05); g.lineTo(w * 1.02, -w * .3); g.lineTo(w, w * .35); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = w * .05; g.stroke();
    [[-1.02, -.3], [0, -.5], [1.02, -.3]].forEach(([x, yy]) => { g.beginPath(); g.arc(x * w, yy * w, w * .11, 0, TAU); g.fill(); g.stroke(); });
    g.restore();
  }
  function starsRow(g, n, y, size, metal) {
    const gap = size * 1.25, x0 = -(n - 1) * gap / 2;
    for (let i = 0; i < n; i++) { g.save(); g.translate(x0 + i * gap, y); g.fillStyle = metalGrad(g, metal, size); g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = size * .14; const p = []; for (let k = 0; k < 10; k++) { const a = k / 10 * TAU - Math.PI / 2, rr = k % 2 ? size * .45 : size; p.push([Math.cos(a) * rr, Math.sin(a) * rr]); } g.beginPath(); p.forEach(([x, yy], j) => j ? g.lineTo(x, yy) : g.moveTo(x, yy)); g.closePath(); g.stroke(); g.fill(); g.restore(); }
  }
  function ribbon(g, y, w, h, metal, text, font) {
    g.save(); g.translate(0, y);
    const M = METAL[metal] || METAL.gold;
    // tails
    [-1, 1].forEach(sd => { g.save(); g.scale(sd, 1); g.fillStyle = M[1]; g.beginPath(); g.moveTo(w * .78, -h * .2); g.lineTo(w * 1.08, -h * .05); g.lineTo(w * .98, h * .5); g.lineTo(w * 1.1, h * 1.02); g.lineTo(w * .74, h * .82); g.closePath(); g.fill(); g.restore(); });
    const gr = g.createLinearGradient(0, -h / 2, 0, h / 2); gr.addColorStop(0, M[3]); gr.addColorStop(.5, M[2]); gr.addColorStop(1, M[1]);
    g.fillStyle = gr; g.beginPath(); g.moveTo(-w, -h / 2); g.quadraticCurveTo(0, -h * .9, w, -h / 2); g.lineTo(w, h / 2); g.quadraticCurveTo(0, h * .1, -w, h / 2); g.closePath(); g.fill();
    g.strokeStyle = M[0]; g.lineWidth = h * .06; g.stroke();
    if (text) {
      let fs = h * .48; g.font = `700 ${fs}px ${font}`; while (g.measureText(text).width > w * 1.78 && fs > 6) { fs *= .93; g.font = `700 ${fs}px ${font}`; }
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(0,0,0,.4)'; g.fillText(text, 1.2, -h * .16 + 1.6); g.fillStyle = M[0]; g.fillText(text, 0, -h * .16);
    }
    g.restore();
  }

  // draw a badge on ctx (square, size px); opts: { label: draw the name ribbon, assets: { emblems: { faction: Image } }, font }
  function draw(ctx, badge, size, opts = {}) {
    if (opts.mystery) badge = { badgeId: 'mystery', name: '???', category: 'secrets', rarity: 'Common' };
    const p = plan(badge), R = RARITY[badge.rarity] || RARITY.Common, metal = R.metal, look = p.look, font = opts.font || "'Cinzel Decorative', 'Cinzel', Georgia, serif";
    const g = ctx; g.save(); g.clearRect(0, 0, size, size);
    const label = !!opts.label, cy = label ? size * .45 : size * .5, r = size * (label ? .33 : .38) * (p.shape === 'shield' ? .9 : 1);
    g.translate(size / 2, cy);
    // aura, rays, flames behind
    if (R.aura) { const gr = g.createRadialGradient(0, 0, r * .5, 0, 0, r * 1.5); gr.addColorStop(0, R.glow); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.globalAlpha = R.aura * .55; g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r * 1.5, 0, TAU); g.fill(); g.globalAlpha = 1; }
    if (R.rays) rays(g, r, R.glow);
    if (R.flames) flames(g, r * 1.02, '#ff5a1a');
    if (p.shape === 'kiku' || badge.category === 'story') { // medal ribbon tails behind
      [[-1, '#7a1414'], [1, '#14365a']].forEach(([sd, col]) => { g.save(); g.scale(sd, 1); g.fillStyle = col; g.beginPath(); g.moveTo(r * .1, r * .5); g.lineTo(r * .5, r * .3); g.lineTo(r * .8, r * 1.32); g.lineTo(r * .6, r * 1.18); g.lineTo(r * .44, r * 1.4); g.closePath(); g.fill(); g.restore(); });
    }
    if (R.laurel) laurel(g, r * 1.12, metal);
    // frame: outer metal, a dark groove, an inner bevel
    g.save(); g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = r * .12; g.shadowOffsetY = r * .04;
    shapePath(g, p.shape, r); g.fillStyle = metalGrad(g, metal, r); g.fill(); g.restore();
    shapePath(g, p.shape, r); g.lineWidth = r * .025; g.strokeStyle = (METAL[metal] || METAL.gold)[0]; g.stroke();
    shapePath(g, p.shape, r * .9); g.fillStyle = (METAL[metal] || METAL.gold)[0]; g.fill();
    shapePath(g, p.shape, r * .875); g.fillStyle = metalGrad(g, metal, r * .875, true); g.fill();
    // enamel field
    g.save(); shapePath(g, p.shape, r * .8); g.clip();
    const fc = look.field || ['#101820', '#2a3a48'], fg = g.createRadialGradient(-r * .2, -r * .3, r * .05, 0, 0, r * 1.05); fg.addColorStop(0, fc[1]); fg.addColorStop(1, fc[0]);
    g.fillStyle = fg; g.fillRect(-r * 1.3, -r * 1.3, r * 2.6, r * 2.6);
    if (look.nebula) { [['rgba(255,150,60,.45)', -.3, -.2, .7], ['rgba(140,60,200,.28)', .4, .3, .6], ['rgba(255,220,150,.25)', .1, -.4, .35]].forEach(([c, x, y, rr]) => { const ng = g.createRadialGradient(x * r, y * r, 0, x * r, y * r, rr * r); ng.addColorStop(0, c); ng.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = ng; g.fillRect(-r * 1.3, -r * 1.3, r * 2.6, r * 2.6); }); }
    g.globalAlpha = .16; pattern(g, look.pattern, r * .8, '#ffffff'); g.globalAlpha = 1;
    // glass gloss
    const gl = g.createLinearGradient(0, -r * .8, 0, r * .1); gl.addColorStop(0, 'rgba(255,255,255,.24)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gl; g.beginPath(); g.ellipse(-r * .05, -r * .42, r * .62, r * .36, -.15, 0, TAU); g.fill();
    g.restore();
    shapePath(g, p.shape, r * .8); g.lineWidth = r * .02; g.strokeStyle = 'rgba(0,0,0,.6)'; g.stroke();
    // rivets / lights on the frame (the brand ring's lit windows)
    if (R.rivets && p.shape !== 'coin') { const n = p.shape === 'hex' ? 6 : p.shape === 'oct' ? 8 : 12; for (let i = 0; i < n; i++) { const a = (i + (p.shape === 'oct' ? .5 : 0)) / n * TAU - Math.PI / 2, rr = r * (p.shape === 'hex' ? .8 : .845); if (p.shape === 'shield' || p.shape === 'kiku' || p.shape === 'star8' || p.shape === 'diamond') continue; g.save(); g.translate(Math.cos(a) * rr, Math.sin(a) * rr); g.shadowColor = R.glow; g.shadowBlur = r * .08; g.fillStyle = R.glow; g.beginPath(); g.arc(0, 0, r * .026, 0, TAU); g.fill(); g.restore(); } }
    // ornament behind / around the icon
    if (p.ornament === 'eye') { g.save(); g.globalAlpha = .35; const m = iconMask({ icon: 'eye' }, 256, {}); drawEmboss(g, m, r * 1.35, look.ink === 'gold' ? 'gold' : look.ink, metal, null); g.restore(); }
    // icon / emblem
    const iconSize = r * (p.number != null ? 1.0 : 1.18) * (p.emblem ? 1.02 : 1);
    const ink = look.ink || 'gold';
    if (p.icon === 'chest' && p.small) {
      g.save(); g.translate(0, -r * .38); drawEmboss(g, p.emblem ? iconMask({ emblem: p.emblem }, 256, opts.assets || {}) : iconMask({ icon: look.icon || 'star' }, 256, {}), r * .5, ink, metal, R.aura ? R.glow : null); g.restore();
      g.save(); g.translate(0, r * .22); drawEmboss(g, iconMask({ icon: 'chest' }, 256, {}), r * .78, ink, metal, null); g.restore();
    } else {
      g.save(); if (p.number != null) g.translate(0, -r * .14);
      drawEmboss(g, iconMask(p, 256, opts.assets || {}), iconSize, ink, metal, R.aura ? R.glow : null);
      g.restore();
    }
    if (p.number != null) {
      g.save(); g.translate(0, r * .5); const txt = String(p.number); g.font = `900 ${r * .44}px ${font}`;
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = r * .07; g.strokeStyle = 'rgba(0,0,0,.75)'; g.strokeText(txt, 0, 0);
      g.fillStyle = metalGrad(g, metal === 'silver' || metal === 'bronze' || metal === 'obsidian' ? 'royal' : metal, r * .3); g.fillText(txt, 0, 0); g.restore();
    }
    // a crown over the champions
    if (p.ornament === 'crown') crown(g, -r * 1.02, r * .3, metal === 'silver' ? 'gold' : metal);
    // rarity stars
    starsRow(g, R.stars, p.shape === 'shield' ? -r * 1.2 : p.ornament === 'crown' ? -r * 1.36 : -r * 1.12, r * .1, metal === 'silver' || metal === 'bronze' ? metal : 'royal');
    if (label) ribbon(g, r * 1.12 + (p.shape === 'shield' ? r * .12 : 0), r * 1.1, r * .3, metal === 'obsidian' ? 'royal' : metal, badge.name.toUpperCase(), font);
    g.restore();
  }

  window.BadgeArtKit = { draw, plan, canvas2d, ICONS, RARITY, VILLAGE_LOOK, CATEGORY_LOOK };
})();
