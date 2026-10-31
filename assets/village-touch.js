// assets/village-touch.js — touch controls for phones and tablets (Oct 23).
// A stick walks (pushed to its rim it runs). Beside the minimap: Use (O: use / talk / open) and ••• (Oct 28, Miguel's
// mockup: claude.ai/artifact/2Vzhty2c8p8VmNrPtffqdE), which fans out Jump (Space), Hit (F), Talk (hold X, while voice is
// on), Emote (E: a row of five opens, tapped to play) and Photo (P) onto the spots he drew, and folds them away again.
// They press the same keys the keyboard does (KeyboardEvents on document), so every rule of the walk still applies:
// walking is camera-relative, prompts, doors, chests. Dragging a finger anywhere else turns the camera, as before.
// Shown on touch screens only (?touch=1 / ?touch=0 force it), while walking. The village calls
// window.VillageTouch.update({ walking }) a few times a second (village.html).
(function () {
  const q = new URLSearchParams(location.search).get('touch');
  let touchOnly = false;
  try { touchOnly = matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches; } catch (e) {}
  const ON = q === '1' ? true : q === '0' ? false : touchOnly;
  const VT = { on: ON, update() {}, release() {} };
  window.VillageTouch = VT;
  if (!ON) return;

  const css = `
#vtouch{position:fixed;inset:0;pointer-events:none;z-index:60;display:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
#vtouch.on{display:block}
#vtStick{position:absolute;left:max(18px,env(safe-area-inset-left,0px));bottom:calc(max(18px,env(safe-area-inset-bottom,0px)) + 64px);width:132px;height:132px;border-radius:50%;
  background:radial-gradient(circle,rgba(10,16,32,.28) 0 55%,rgba(10,16,32,.42) 56%);border:2px solid rgba(232,197,106,.45);pointer-events:auto;touch-action:none}
#vtKnob{position:absolute;left:50%;top:50%;width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:50%;background:rgba(232,197,106,.55);border:2px solid rgba(255,240,200,.8);box-shadow:0 2px 10px rgba(0,0,0,.4)}
#vtStick.run #vtKnob{background:rgba(255,140,60,.75)}
#vtBtns{position:absolute;left:0;top:0;width:0;height:0;pointer-events:none}
.vtBtn{position:absolute;left:0;top:0;width:50px;height:50px;box-sizing:border-box;padding:0;pointer-events:auto;touch-action:none;border-radius:50%;
  border:2px solid rgba(232,197,106,.65);background:rgba(10,16,32,.62);color:#f3e3b5;font:800 10px/1 system-ui,sans-serif;-webkit-tap-highlight-color:transparent;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;box-shadow:0 2px 10px rgba(0,0,0,.35)}
.vtBtn svg{flex:none;width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
.vtBtn.down{background:rgba(232,197,106,.5);border-color:#ffe08a;color:#1a1206}
.vtBtn.use{border-color:rgba(232,197,106,.6);background:rgba(10,16,32,.55);font-size:13px;line-height:1.1;gap:3px}
.vtBtn.use svg{width:26px;height:26px;stroke:#ffd36e;stroke-width:1.8}
.vtBtn.use.down svg{stroke:#1a1206}
.vtBtn.more svg{width:22px;height:22px;fill:currentColor;stroke:none}
.vtBtn.more .x{display:none;width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2.6}
.vtBtn.more.open{background:rgba(232,197,106,.3);border-color:#ffe08a}
.vtBtn.more.open .dots{display:none}
.vtBtn.more.open .x{display:block}
.vtBtn.jump svg{stroke-width:2.4}
.vtBtn.emote svg{width:21px;height:21px;stroke-width:3.4}
.vtBtn.photo svg{stroke-width:2.1}
.vtBtn.fan{transform:translate(var(--cx,0px),var(--cy,0px)) scale(.2);opacity:0;visibility:hidden;pointer-events:none;
  transition:transform .24s cubic-bezier(.2,.9,.3,1.3) var(--dc,0ms),opacity .16s ease var(--dc,0ms),visibility 0s linear var(--dv,240ms),background .08s,border-color .08s}
#vtBtns.open .vtBtn.fan{transform:none;opacity:1;visibility:visible;pointer-events:auto;
  transition:transform .24s cubic-bezier(.2,.9,.3,1.3) var(--do,0ms),opacity .16s ease var(--do,0ms),visibility 0s,background .08s,border-color .08s}
.vtBtn.talk{display:none}
#vtouch.voice .vtBtn.talk{display:flex}
.vtBtn.talk.down{background:rgba(224,90,107,.62);border-color:#ff9aa6;color:#fff}
.vtBtn.use.ready{border-color:#ffe08a;color:#fff3cf;animation:vtReady 1.6s ease-in-out infinite}
@keyframes vtReady{0%,100%{box-shadow:0 0 0 2px rgba(232,197,106,.35),0 0 12px rgba(232,197,106,.45)}50%{box-shadow:0 0 0 5px rgba(232,197,106,.16),0 0 22px rgba(232,197,106,.75)}}
body.game-hide-touch-btns #vtBtns{display:none}
html.vt-touch #ctrlBtn{display:none}
html.vt-touch #photoBtn{display:none!important}
`;
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
  const root = document.createElement('div'); root.id = 'vtouch';
  const ico = (body, vb = '0 0 24 24', cls = '') => `<svg viewBox="${vb}"${cls ? ` class="${cls}"` : ''} aria-hidden="true">${body}</svg>`;
  root.innerHTML = '<div id="vtStick"><div id="vtKnob"></div></div><div id="vtBtns">' +
    '<button type="button" class="vtBtn fan jump" data-key=" " aria-label="Jump">' + ico('<path d="M12 19V6"/><path d="M6.5 11.5 12 6l5.5 5.5"/><path d="M6 21.5h12"/>') + 'Jump</button>' +
    '<button type="button" class="vtBtn fan hit" data-key="f" aria-label="Attack">' + ico('<path d="M5 4l10 10"/><path d="M13 16l3-3"/><path d="M15.5 15.5 19 19"/><path d="M19 4 9 14"/><path d="M8 13l3 3"/><path d="M8.5 15.5 5 19"/>') + 'Hit</button>' +
    '<button type="button" class="vtBtn fan talk" data-key="x" aria-label="Hold to talk">' + ico('<rect x="8.5" y="3" width="7" height="11" rx="3.5"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0"/><path d="M12 17.5V21"/>') + '<span>Talk</span></button>' +
    '<button type="button" class="vtBtn fan emote" data-key="e" aria-label="Emotes">' + ico('<circle cx="20" cy="8.5" r="4.2"/><path d="M20 13.5v11M20 16.5 13 7.5M20 16.5l7-9M20 24.5l-5 9M20 24.5l5 9"/>', '0 0 40 40') + 'Emote</button>' +
    '<button type="button" class="vtBtn fan photo" data-key="p" aria-label="Take a picture">' + ico('<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M8.5 7l1.4-2.6h4.2L15.5 7"/><circle cx="12" cy="13.5" r="3.6"/>') + 'Photo</button>' +
    '<button type="button" class="vtBtn more" aria-label="More buttons" aria-expanded="false">' + ico('<circle cx="5" cy="12" r="2.3"/><circle cx="12" cy="12" r="2.3"/><circle cx="19" cy="12" r="2.3"/>', '0 0 24 24', 'dots') +
      ico('<path d="M6 6l12 12M18 6 6 18"/>', '0 0 24 24', 'x') + '<span>More</span></button>' +
    '<button type="button" class="vtBtn use" data-key="o" aria-label="Use or talk">' + ico('<path d="M8 12.5V6a1.4 1.4 0 0 1 2.8 0v5"/><path d="M10.8 10.5V4.4a1.4 1.4 0 0 1 2.8 0v6"/><path d="M13.6 10.5V5.4a1.4 1.4 0 0 1 2.8 0v6.4"/><path d="M16.4 11.6V8.6a1.4 1.4 0 0 1 2.8 0v5.2A7.2 7.2 0 0 1 12 21h-.4a6.8 6.8 0 0 1-5.7-3.1l-2.6-4a1.5 1.5 0 0 1 2.4-1.8L8 14.4"/>') + '<span>Use</span></button></div>';
  // the corner list of keys (W A S D, mouse, Esc) and the welcome card's controls are for keyboards: on a touch screen the
  // list goes and the card names the touch controls
  document.documentElement.classList.add('vt-touch');
  const TOUCH_HELP = [['Move', 'The stick, bottom left'], ['Run', 'Push the stick to its rim'], ['Look', 'Drag anywhere else'], ['Use / talk', 'Use button'],
    ['More', 'The ••• button: Jump, Hit, Emote, Photo'], ['Talk', 'Hold Talk, under ••• (signed in)'], ['Mission', 'The gold ◆ under your Rebel'], ['Journal', 'Journal button'], ['Chat', 'Chat button, top right']];
  const touchHelp = () => { const list = document.getElementById('playerStartupList'); if (list) list.innerHTML = TOUCH_HELP.map(([b, t]) => `<div class="startup-control"><b>${b}</b>${t}</div>`).join(''); };
  const mount = () => { document.body.appendChild(root); touchHelp(); };
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
  root.addEventListener('contextmenu', (e) => e.preventDefault());

  const press = (key, down) => document.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { key, bubbles: true, cancelable: true }));

  // ── the stick: its direction holds W / A / S / D (two of them on a diagonal), its rim holds R as well ──
  const stick = root.querySelector('#vtStick'), knob = root.querySelector('#vtKnob');
  let held = new Set(), stickId = null, shown = false;
  function hold(next) {
    // run goes last on the way down and first on the way up (R without a walking key would run on the spot)
    const order = (k) => (k === 'r' ? 1 : 0);
    [...held].filter((k) => !next.has(k)).sort((a, b) => order(b) - order(a)).forEach((k) => press(k, false));
    [...next].filter((k) => !held.has(k)).sort((a, b) => order(a) - order(b)).forEach((k) => press(k, true));
    held = next;
  }
  function stickAt(clientX, clientY) {
    const r = stick.getBoundingClientRect(), R = r.width / 2;
    let dx = clientX - (r.left + R), dy = clientY - (r.top + R);
    const d = Math.hypot(dx, dy), max = R * 0.72;
    if (d > max) { dx *= max / d; dy *= max / d; }
    knob.style.transform = `translate(${dx}px,${dy}px)`;
    const next = new Set();
    if (d > R * 0.2) {
      const a = Math.atan2(dx, -dy); // 0 = up (away from the camera), clockwise
      const sector = Math.round(a / (Math.PI / 4));
      const keys = { 0: 'w', 1: 'wd', 2: 'd', 3: 'sd', 4: 's', '-4': 's', '-3': 'sa', '-2': 'a', '-1': 'wa' }[sector] || '';
      for (const k of keys) next.add(k);
      if (d > R * 0.82) next.add('r');
    }
    stick.classList.toggle('run', next.has('r'));
    hold(next);
  }
  function stickEnd() {
    stickId = null; knob.style.transform = ''; stick.classList.remove('run'); hold(new Set());
  }
  stick.addEventListener('pointerdown', (e) => { e.preventDefault(); stickId = e.pointerId; try { stick.setPointerCapture(e.pointerId); } catch (_) {} stickAt(e.clientX, e.clientY); });
  stick.addEventListener('pointermove', (e) => { if (e.pointerId === stickId) { e.preventDefault(); stickAt(e.clientX, e.clientY); } });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => stick.addEventListener(t, (e) => { if (e.pointerId === stickId) stickEnd(); }));

  // ── the buttons: pressed while the finger is on them ──
  const fanUps = [];
  root.querySelectorAll('.vtBtn[data-key]').forEach((b) => {
    const key = b.dataset.key, word = b.classList.contains('talk') ? b.querySelector('span') : null; let id = null;
    const up = () => { if (id === null) return; id = null; b.classList.remove('down'); if (word) word.textContent = 'Talk'; press(key, false); };
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); if (id !== null) return; id = e.pointerId; try { b.setPointerCapture(e.pointerId); } catch (_) {} b.classList.add('down'); if (word) word.textContent = 'Talking'; press(key, true); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => b.addEventListener(t, (e) => { if (e.pointerId === id) up(); }));
    if (b.classList.contains('fan')) fanUps.push(up);
  });

  // ── ••• opens and folds the five (the state is kept on the device; a game played on the walk opens them for its
  // length: Treasure Dig digs and Trick or Treat knocks with Jump) ──
  const FAN_KEY = 'rebelAntsTouchFan:v1', box = root.querySelector('#vtBtns'), more = root.querySelector('.vtBtn.more');
  let fanOpen = false, roamOpen = false;
  try { fanOpen = localStorage.getItem(FAN_KEY) === '1'; } catch (e) {}
  function paintFan() {
    const open = fanOpen || roamOpen;
    box.classList.toggle('open', open); more.classList.toggle('open', open);
    more.setAttribute('aria-expanded', String(open)); more.querySelector('span').textContent = open ? 'Close' : 'More';
    if (!open) fanUps.forEach((up) => up()); // (a finger still on Talk lets go)
  }
  more.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (fanOpen || roamOpen) { fanOpen = roamOpen = false; } else fanOpen = true;
    try { localStorage.setItem(FAN_KEY, fanOpen ? '1' : '0'); } catch (_) {}
    paintFan();
  });
  VT.roam = (on) => { roamOpen = !!on; paintFan(); };
  paintFan();

  // ── where they go: Miguel's spots, as centres from the minimap's centre on an upright phone, whose map ring is 65 px
  // round. On another screen each keeps its gap to the ring along the same direction (a sideways phone's or a tablet's
  // map is 170 px), and when they would meet the stick or the top of the screen they all shrink toward the map ──
  const SPOTS = { use: [25, -103, 72], more: [-58, -84, 52], jump: [23, -175.5, 50], hit: [-35.5, -137, 50], talk: [-92.5, -146, 50], emote: [-121, -86, 50], photo: [-92, -29, 50] };
  const FAN = ['jump', 'hit', 'talk', 'emote', 'photo'], RING0 = 65;
  function mapRing() {
    const m = document.getElementById('miniMap'), cs = m && getComputedStyle(m); // (its CSS place, also while a room hides it)
    const w = cs ? parseFloat(cs.width) : NaN, r = cs ? parseFloat(cs.right) : NaN, b = cs ? parseFloat(cs.bottom) : NaN;
    if (!(w > 0) || !isFinite(r) || !isFinite(b)) return { x: innerWidth - 76, y: innerHeight - 124, R: RING0 };
    return { x: innerWidth - r - w / 2, y: innerHeight - b - w / 2, R: w / 2 + 3 };
  }
  let laidOut = '';
  function layout() {
    const m = mapRing(), sr = stick.getBoundingClientRect(), S = sr.width ? { x: sr.left + sr.width / 2, y: sr.top + sr.height / 2, r: sr.width / 2 } : null;
    const sig = [innerWidth, innerHeight, m.x, m.y, m.R, S && S.x, S && S.y].map(Math.round).join();
    if (sig === laidOut) return;
    let k = 1, at = null;
    for (; k > 0.66; k -= 0.1) {
      at = {}; let fits = true;
      for (const id in SPOTS) {
        const [dx, dy, size] = SPOTS[id], d = Math.hypot(dx, dy), out = m.R + k * (d - RING0), r = size * k / 2;
        const c = { x: m.x + dx / d * out, y: m.y + dy / d * out, r };
        at[id] = c;
        if (c.x - r < 4 || c.y - r < 64 || (S && Math.hypot(c.x - S.x, c.y - S.y) < S.r + r + 8)) fits = false;
      }
      if (fits) break;
    }
    laidOut = sig;
    const M = at.more;
    for (const id in at) {
      const b = root.querySelector('.vtBtn.' + id), c = at[id], size = Math.round(c.r * 2);
      Object.assign(b.style, { left: Math.round(c.x - c.r) + 'px', top: Math.round(c.y - c.r) + 'px', width: size + 'px', height: size + 'px' });
      const i = FAN.indexOf(id);
      if (i >= 0) {
        b.style.setProperty('--cx', Math.round(M.x - c.x) + 'px'); b.style.setProperty('--cy', Math.round(M.y - c.y) + 'px');
        b.style.setProperty('--do', i * 30 + 'ms'); b.style.setProperty('--dc', (4 - i) * 20 + 'ms'); b.style.setProperty('--dv', 240 + (4 - i) * 20 + 'ms');
      }
    }
  }
  addEventListener('resize', () => { if (shown) requestAnimationFrame(layout); });
  VT.layout = () => { laidOut = ''; layout(); };

  // ── the Use button names what it does ("Talk", "Open", "Play" ...) and glows while the walk prompt offers something
  // (village.html setInteractionPrompt calls VT.useHint). Once it has been pressed on such an offer the player knows it,
  // and the "Tap Use to ..." line up top stays away from then on (VT.learned; Miguel, Oct 24: it covered the view)
  const LEARNED_KEY = 'rebelAntsTouchUseLearned:v1';
  try { VT.learned = localStorage.getItem(LEARNED_KEY) === '1'; } catch (e) { VT.learned = false; }
  const useBtn = root.querySelector('.vtBtn.use'), useWord = useBtn.querySelector('span');
  let hint = null;
  VT.useHint = (label) => {
    label = label || null;
    if (label === hint) return;
    hint = label; useWord.textContent = label || 'Use'; useBtn.classList.toggle('ready', !!label);
  };
  // capture: before the press itself, whose talk / door / game can clear the hint at once
  useBtn.addEventListener('pointerdown', () => {
    if (!hint || VT.learned) return;
    VT.learned = true;
    try { localStorage.setItem(LEARNED_KEY, '1'); } catch (e) {}
  }, true);

  // the Talk button shows while voice is on for this player (village-voice.js asks twice a second)
  VT.talkOn = (on) => { on = !!on; if (on !== root.classList.contains('voice')) root.classList.toggle('voice', on); };
  VT.release = () => { if (stickId !== null) stickEnd(); else hold(new Set()); };
  VT.update = (s) => {
    const want = !!(s && s.walking);
    if (want === shown) { if (shown) layout(); return; }
    shown = want; root.classList.toggle('on', want);
    if (want) layout(); else VT.release();
  };
  // a page that loses focus never sees the finger lift: let go of everything
  document.addEventListener('visibilitychange', () => { if (document.visibilityState !== 'visible') VT.release(); });
})();
