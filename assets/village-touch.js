// assets/village-touch.js — touch controls for phones and tablets (Oct 23).
// A stick walks (pushed to its rim it runs) and three buttons press O (use / talk / open), Space (jump) and F (attack).
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
#vtBtns{position:absolute;right:max(16px,env(safe-area-inset-right,0px));bottom:calc(max(18px,env(safe-area-inset-bottom,0px)) + 196px);display:grid;grid-template-columns:repeat(2,64px);gap:12px;pointer-events:none}
.vtBtn{pointer-events:auto;touch-action:none;width:64px;height:64px;border-radius:50%;border:2px solid rgba(232,197,106,.6);background:rgba(10,16,32,.55);color:#f3e3b5;
  font:800 13px/1.1 system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;box-shadow:0 2px 10px rgba(0,0,0,.35)}
.vtBtn b{font-size:20px;line-height:1}
.vtBtn.down{background:rgba(232,197,106,.45);color:#1a1206}
.vtBtn.use{grid-column:2;grid-row:1 / span 2;align-self:center;width:72px;height:72px}
html.vt-touch #ctrl{display:none}
`;
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
  const root = document.createElement('div'); root.id = 'vtouch';
  root.innerHTML = '<div id="vtStick"><div id="vtKnob"></div></div><div id="vtBtns">' +
    '<button type="button" class="vtBtn" data-key=" " aria-label="Jump"><b>⤴</b>Jump</button>' +
    '<button type="button" class="vtBtn use" data-key="o" aria-label="Use or talk"><b>✋</b>Use</button>' +
    '<button type="button" class="vtBtn" data-key="f" aria-label="Attack"><b>⚔</b>Hit</button></div>';
  // the corner list of keys (W A S D, mouse, Esc) and the welcome card's controls are for keyboards: on a touch screen the
  // list goes and the card names the touch controls
  document.documentElement.classList.add('vt-touch');
  const TOUCH_HELP = [['Move', 'The stick, bottom left'], ['Run', 'Push the stick to its rim'], ['Look', 'Drag anywhere else'], ['Jump', 'Jump button'], ['Use / talk', 'Use button'], ['Journal', 'Journal button']];
  const touchHelp = () => { const list = document.getElementById('playerStartupList'); if (list) list.innerHTML = TOUCH_HELP.map(([b, t]) => `<div class="startup-control"><b>${b}</b>${t}</div>`).join(''); };
  const mount = () => { document.body.appendChild(root); touchHelp(); };
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
  root.addEventListener('contextmenu', (e) => e.preventDefault());

  const press = (key, down) => document.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { key, bubbles: true, cancelable: true }));

  // ── the stick: its direction holds W / A / S / D (two of them on a diagonal), its rim holds R as well ──
  const stick = root.querySelector('#vtStick'), knob = root.querySelector('#vtKnob');
  let held = new Set(), stickId = null;
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
  root.querySelectorAll('.vtBtn').forEach((b) => {
    const key = b.dataset.key; let id = null;
    const up = () => { if (id === null) return; id = null; b.classList.remove('down'); press(key, false); };
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); if (id !== null) return; id = e.pointerId; try { b.setPointerCapture(e.pointerId); } catch (_) {} b.classList.add('down'); press(key, true); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => b.addEventListener(t, (e) => { if (e.pointerId === id) up(); }));
  });

  let shown = false;
  VT.release = () => { if (stickId !== null) stickEnd(); else hold(new Set()); };
  VT.update = (s) => {
    const want = !!(s && s.walking);
    if (want === shown) return;
    shown = want; root.classList.toggle('on', want);
    if (!want) VT.release();
  };
  // a page that loses focus never sees the finger lift: let go of everything
  document.addEventListener('visibilitychange', () => { if (document.visibilityState !== 'visible') VT.release(); });
})();
