// Village HUD: the Rebel panel folds into a round Rebel button (top left) with a one-line quest tracker beside it, and a
// round minimap sits bottom right. The map turns with the camera (up = where the camera looks), the player's arrow sits
// in the middle, the quest target shows as a gold diamond (held on the rim when it is off the map), village gates and
// room doors as small marks, the player's group members as green dots (the one being gone to ringed and held on the
// rim), N on the rim. The map picture is one top-down render of the village, made once it is
// loaded; each frame only draws that picture and the marks (2D canvas). village.html calls init / buildMap / update.
(function () {
  const HUD = window.VillageHud = {};
  const GOLD = '#e8c56a', TEAL = '#5ecfca', GREEN = '#7be38a';
  let scene = null, opts = {}, cv = null, ctx = null, map = null, zoomR = 60, frame = 0, dpr = 1, built = false, dot = false, lastQuest = '';

  const css = `
#rebelHudBtn{position:fixed;top:82px;left:28px;width:60px;height:60px;border-radius:50%;padding:0;border:none;cursor:pointer;z-index:13;
  background:rgba(5,10,28,.88);box-shadow:0 0 14px rgba(0,0,0,.45)}
#rebelHudBtn img{position:absolute;left:7px;top:7px;width:46px;height:46px;border-radius:50%;object-fit:cover;background:var(--selected-rebel-image-bg,rgba(255,255,255,.92));
  border:2px solid ${GOLD};box-sizing:border-box}
#rebelHudBtn svg{position:absolute;left:0;top:0;width:60px;height:60px;transform:rotate(-90deg)}
#rebelHudBtn .dot{position:absolute;right:1px;top:1px;width:13px;height:13px;border-radius:50%;background:#f0503c;border:2px solid #0a0d16;display:none}
#rebelHudBtn.has-news .dot{display:block}
#rebelHudBtn:hover img{filter:brightness(1.12)}
#rebelHudBtn .econ{position:absolute;right:-3px;bottom:-3px;width:23px;height:23px;border-radius:50%;background:#5865f2;border:2px solid #5865f2;
  box-shadow:0 0 0 2px rgba(5,10,28,.92);overflow:hidden;display:none}
#rebelHudBtn .econ img{position:static;width:100%;height:100%;border:none;border-radius:50%;object-fit:cover;background:#5865f2}
#questLine{position:fixed;top:90px;left:100px;max-width:212px;padding:6px 11px 7px;background:rgba(5,10,28,.72);border:1px solid rgba(232,197,106,.28);
  border-radius:8px;z-index:12;pointer-events:none;font-family:'Cinzel',serif;display:none}
#questLine b{display:block;color:${GOLD};font-size:10px;letter-spacing:.6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#questLine span{display:block;color:#dce6e6;font-size:9.5px;line-height:1.35;margin-top:2px;max-height:2.7em;overflow:hidden}
body:not(.rebel-panel-open) #selectedRebelPanel{display:none}
body.rebel-panel-open #selectedRebelPanel{top:152px}
body.rebel-panel-open #questLine{display:none!important}
#miniMap{position:fixed;right:22px;bottom:22px;width:170px;height:170px;border-radius:50%;z-index:12;cursor:pointer;display:none;
  box-shadow:0 0 0 3px rgba(232,197,106,.85),0 0 18px rgba(0,0,0,.55);background:rgba(5,10,28,.6)}
@media (max-width:480px){#miniMap{width:124px;height:124px;right:14px;bottom:62px}}
`;

  HUD.init = function (s, o = {}) {
    scene = s; opts = o;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    // the Rebel button: portrait in a gold ring, a thin ring for the next badge, a red dot for news (a new objective)
    const b = document.createElement('button'); b.id = 'rebelHudBtn'; b.type = 'button'; b.title = 'Your Rebel (Tab)';
    b.innerHTML = '<svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="27.5" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="4"/>' +
      '<circle id="rebelHudRing" cx="30" cy="30" r="27.5" fill="none" stroke="' + TEAL + '" stroke-width="4" stroke-linecap="round" stroke-dasharray="0 999"/></svg><img alt=""><span class="dot"></span>' +
      '<span class="econ"><img alt=""></span>';
    document.body.appendChild(b);
    b.addEventListener('click', e => { e.stopPropagation(); HUD.togglePanel(); b.blur(); });
    const q = document.createElement('div'); q.id = 'questLine'; q.innerHTML = '<b></b><span></span>'; document.body.appendChild(q);
    let open = false; try { open = localStorage.getItem('rebelAntsHudPanelOpen') === '1'; } catch (e) {}
    // touch screens start with it folded: while it is open the stick and buttons step aside (village.html)
    if (window.VillageTouch?.on) open = false;
    document.body.classList.toggle('rebel-panel-open', open);
    window.addEventListener('keydown', e => {
      if (e.key !== 'Tab' || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      e.preventDefault(); HUD.togglePanel();
    });
    cv = document.createElement('canvas'); cv.id = 'miniMap'; cv.title = 'Map (click to zoom)'; document.body.appendChild(cv);
    cv.addEventListener('click', e => { e.stopPropagation(); zoomR = zoomR === 60 ? 140 : 60; });
    ctx = cv.getContext('2d');
    syncButton(); setInterval(syncButton, 700);
  };

  HUD.togglePanel = function (force) {
    const open = typeof force === 'boolean' ? force : !document.body.classList.contains('rebel-panel-open');
    document.body.classList.toggle('rebel-panel-open', open);
    try { localStorage.setItem('rebelAntsHudPanelOpen', open ? '1' : '0'); } catch (e) {}
    if (open) { dot = false; document.getElementById('rebelHudBtn')?.classList.remove('has-news'); }
  };

  // keep the button and the quest line in step with the panel (portrait, badge progress, active quest)
  function syncButton() {
    const b = document.getElementById('rebelHudBtn'); if (!b) return;
    const src = document.getElementById('selectedRebelImage')?.getAttribute('src'), img = b.querySelector(':scope > img');
    if (src && img.getAttribute('src') !== src) img.setAttribute('src', src);
    // signed in with Discord (the panel's Discord circle): the Discord picture on the button's lower right
    const eb = document.getElementById('econBadge'), signed = !!eb?.classList.contains('on'), ei = signed ? eb.querySelector('img') : null, m = b.querySelector('.econ');
    if (m) {
      const es = ei?.getAttribute('src') || '';
      m.style.display = es ? 'block' : 'none';
      if (es && m.firstChild.getAttribute('src') !== es) m.firstChild.setAttribute('src', es);
      b.title = signed ? 'Your Rebel (Tab) · ' + eb.title : 'Your Rebel (Tab)';
    }
    const fill = parseFloat(document.getElementById('hudProgressFill')?.style.width) || 0, C = 2 * Math.PI * 27.5;
    document.getElementById('rebelHudRing')?.setAttribute('stroke-dasharray', `${(C * Math.max(0, Math.min(100, fill)) / 100).toFixed(1)} ${C.toFixed(1)}`);
    const tr = document.getElementById('questTrackerObjective'), on = document.getElementById('questTracker');
    const text = (tr?.textContent || '').trim(), q = document.getElementById('questLine');
    const shown = text && (!on || getComputedStyle(on).display !== 'none') && opts.isWalking?.();
    if (q) {
      q.style.display = shown ? 'block' : 'none';
      if (shown) { const i = text.indexOf(':'); q.querySelector('b').textContent = '◆ ' + (i > 0 ? text.slice(0, i) : 'Quest'); q.querySelector('span').textContent = i > 0 ? text.slice(i + 1).trim() : text; }
    }
    if (text && text !== lastQuest) { if (lastQuest && !document.body.classList.contains('rebel-panel-open')) { dot = true; b.classList.add('has-news'); } lastQuest = text; }
  }

  // one top-down picture of the village (looking straight down from far above, fog off), read back into a canvas.
  // The camera is a perspective one with a narrow view from 8 km up, not an orthographic one: every material keeps the
  // shader versions it draws the game with (an orthographic camera needs its own version of each, CAMERA_ORTHOGRAPHIC:
  // about 60 programs compiled at once as walking starts, the iPhone's crash on Enter Village). From that height
  // something 10 m up lands half a metre off at the map's rim. Its projection is set here (square, the render target's
  // shape: a camera works its aspect out from the canvas). The picture is taken once the render target reports every
  // mesh ready (else it comes out as the bare sky colour). Fog is zeroed by its strength, not its mode, so no fog shader
  // versions are needed on top.
  HUD.buildMap = function (R = 320, size = 1024, tries = 3) {
    if (!scene) return Promise.resolve(false);
    const H = 8000, e = scene.getEngine(), rev = !!e.useReverseDepthBuffer;
    const cam = new BABYLON.FreeCamera('miniMapCam', new BABYLON.Vector3(0, H, 0), scene);
    cam.rotation = new BABYLON.Vector3(Math.PI / 2, 0, 0); // looking straight down, +z (north) up, +x right
    cam.fov = 2 * Math.atan(R / H); cam.minZ = H - 800; cam.maxZ = H + 300; // the ground from 300 m down to 800 m up
    const P = scene.useRightHandedSystem ? BABYLON.Matrix.PerspectiveFovRH : BABYLON.Matrix.PerspectiveFovLH;
    cam.freezeProjectionMatrix(P(cam.fov, 1, rev ? cam.maxZ : cam.minZ, rev ? cam.minZ : cam.maxZ, e.isNDCHalfZRange, 0, rev));
    const rtt = new BABYLON.RenderTargetTexture('miniMapRTT', size, scene, false, true);
    rtt.activeCamera = cam;
    const skip = /sky|cloud|mist|fog|rain|snow|bird|player|npc|ghost|questTarget|glint|shadow|halo|beam|ray|saintsTraffic/i; // (moving cars would stay painted where they were)
    const pr = scene.getTransformNodeByName('playerRoot');
    rtt.renderList = null; // a predicate, as the main render picks meshes (instanced copies draw through their source)
    rtt.renderListPredicate = m => m.isEnabled() && !skip.test(m.name || '') && !inside(m, pr);
    const noFog = fn => { const f = [scene.fogDensity, scene.fogStart, scene.fogEnd]; scene.fogDensity = 0; scene.fogStart = 1e7; scene.fogEnd = 2e7; try { return fn(); } finally { [scene.fogDensity, scene.fogStart, scene.fogEnd] = f; } };
    const t0 = performance.now();
    const ready = () => new Promise(res => {
      const tick = () => {
        let ok = false; try { ok = noFog(() => rtt.isReadyForRendering()); } catch (e) { ok = true; }
        if (ok || performance.now() - t0 > 20000) res(ok); else setTimeout(tick, 150);
      };
      tick();
    });
    let shot = null;
    return ready().then(ok => {
      // in the light the page gives the picture (noon, whatever the hour: a night picture is too dark to read and
      // an almost black one counts as not drawn yet)
      const draw = () => noFog(() => rtt.render(false));
      try { if (opts.mapLight) opts.mapLight(draw); else draw(); } catch (e) { console.warn('minimap render failed', e); }
      return rtt.readPixels();
    }).then(px => {
      if (!px) return false;
      const src = new Uint8Array(px.buffer || px), n = size * size;
      // an empty picture (nothing drawn yet) is one colour: keep the old one and try again a little later
      let differ = 0; for (let i = 0; i < n; i += 37) { const j = i * 4; if (Math.abs(src[j] - src[0]) + Math.abs(src[j + 1] - src[1]) + Math.abs(src[j + 2] - src[2]) > 24) differ++; }
      if (differ < n / 37 * .03) { shot = 'empty'; return false; }
      const c = document.createElement('canvas'); c.width = c.height = size;
      const g = c.getContext('2d'), im = g.createImageData(size, size);
      for (let y = 0; y < size; y++) im.data.set(src.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4); // GL rows run bottom up
      for (let i = 3; i < im.data.length; i += 4) im.data[i] = 255;
      g.putImageData(im, 0, 0);
      map = { img: c, x0: -R, z1: R, mpp: 2 * R / size };
      built = true;
      try { opts.onMapBuilt?.(c, R); } catch (e) {}
      return true;
    }).catch(e => { console.warn('minimap read failed', e); return false; }).finally(() => {
      rtt.dispose(); cam.dispose();
      if (shot === 'empty' && tries > 1) setTimeout(() => HUD.buildMap(R, size, tries - 1), 5000);
    });
  };
  // a picture kept from an earlier visit shows at once; the live render replaces it when ready
  HUD.setMapImage = function (img, R = 320) { const size = img?.width || img?.naturalWidth; if (!size || built) return false; map = { img, x0: -R, z1: R, mpp: 2 * R / size }; return true; };
  HUD.isBuilt = () => built;
  HUD._mapImage = () => map?.img || null; // the picture itself (tests)

  function inside(m, root) { if (!root) return false; for (let n = m; n; n = n.parent) if (n === root) return true; return false; }

  HUD.update = function () {
    if (!cv) return;
    const walking = !!opts.isWalking?.(), show = walking && !opts.inInterior?.();
    if (cv.style.display !== (show ? 'block' : 'none')) cv.style.display = show ? 'block' : 'none';
    if (!show || (++frame % 2)) return;
    const pr = scene.getTransformNodeByName('playerRoot'); if (!pr) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.round(cv.clientWidth * dpr); if (!W) return;
    if (cv.width !== W) { cv.width = cv.height = W; }
    const yaw = window._walkCamera ? window._walkCamera.yaw : pr.rotation.y + Math.PI;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = fz, rz = -fx; // the camera's forward and right on the ground
    const c = W / 2, s = c / zoomR, px = pr.position.x, pz = pr.position.z;
    const P = (x, z) => { const vx = x - px, vz = z - pz; return [c + (vx * rx + vz * rz) * s, c - (vx * fx + vz * fz) * s]; };
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, W);
    ctx.save(); ctx.beginPath(); ctx.arc(c, c, c, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#1c2a20'; ctx.fillRect(0, 0, W, W);
    if (map) {
      const m = map.mpp;
      ctx.setTransform(m * rx * s, -m * fx * s, -m * rz * s, m * fz * s, ((map.x0 - px) * rx + (map.z1 - pz) * rz) * s + c, -((map.x0 - px) * fx + (map.z1 - pz) * fz) * s + c);
      const night = (window._walkLightK ?? 0) > .5;
      ctx.filter = night ? 'brightness(1.9) saturate(1.15)' : 'saturate(1.1)';
      ctx.drawImage(map.img, 0, 0);
      ctx.filter = 'none'; ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    // view cone, then the marks, then the player's arrow on top
    ctx.fillStyle = 'rgba(255,255,255,.13)'; ctx.beginPath(); ctx.moveTo(c, c); ctx.arc(c, c, c * .62, -Math.PI / 2 - .55, -Math.PI / 2 + .55); ctx.closePath(); ctx.fill();
    for (const n of scene.transformNodes) {
      const t = n.metadata?.type;
      if (t !== 'village_gate' && t !== 'interior_entrance') continue;
      if (!n.isEnabled?.() || n.metadata?.isClone === false) continue;
      const [x, y] = P(n.position.x, n.position.z); if ((x - c) ** 2 + (y - c) ** 2 > c * c) continue;
      if (t === 'village_gate') { ctx.fillStyle = '#ff7a5a'; ctx.strokeStyle = '#3a0d05'; ctx.lineWidth = dpr; ctx.beginPath(); ctx.arc(x, y, 4.5 * dpr, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      else { ctx.fillStyle = TEAL; ctx.strokeStyle = '#06302e'; ctx.lineWidth = dpr; ctx.fillRect(x - 3 * dpr, y - 4 * dpr, 6 * dpr, 8 * dpr); ctx.strokeRect(x - 3 * dpr, y - 4 * dpr, 6 * dpr, 8 * dpr); }
    }
    const q = opts.questTarget?.();
    if (q) {
      let [x, y] = P(q.x, q.z); const dx = x - c, dy = y - c, d = Math.hypot(dx, dy), rim = c - 9 * dpr;
      if (d > rim) { x = c + dx / d * rim; y = c + dy / d * rim; }
      ctx.fillStyle = GOLD; ctx.strokeStyle = '#3c2800'; ctx.lineWidth = 1.5 * dpr; const k = 6 * dpr;
      ctx.beginPath(); ctx.moveTo(x, y - k * 1.3); ctx.lineTo(x + k, y); ctx.lineTo(x, y + k * 1.3); ctx.lineTo(x - k, y); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    // the group (village-groups.js): its members here as green dots; past the rim only the one being gone to (and a small
    // dot for the others, so their way shows); a member in a room: a square on its door. An event being gone to
    // (village-stage.js): a gold square on its room's door (f.color)
    const fr = opts.friends?.();
    if (fr && fr.length) for (const f of fr) {
      let [x, y] = P(f.x, f.z); const dx = x - c, dy = y - c, d = Math.hypot(dx, dy), rim = c - 8 * dpr, out = d > rim;
      if (out) { x = c + dx / d * rim; y = c + dy / d * rim; }
      const r = (f.goal ? 5.5 : out ? 2.6 : 4) * dpr;
      if (f.goal) { ctx.strokeStyle = f.color ? 'rgba(232,197,106,.7)' : 'rgba(123,227,138,.6)'; ctx.lineWidth = 2 * dpr; ctx.beginPath(); ctx.arc(x, y, r + (4 + Math.sin(performance.now() / 180) * 1.5) * dpr, 0, Math.PI * 2); ctx.stroke(); }
      ctx.globalAlpha = out && !f.goal ? .75 : 1;
      ctx.fillStyle = f.color || GREEN; ctx.strokeStyle = f.color ? '#3c2800' : '#0b2e12'; ctx.lineWidth = 1.5 * dpr; ctx.beginPath();
      if (f.door) ctx.rect(x - r, y - r, 2 * r, 2 * r); else ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke(); ctx.globalAlpha = 1;
    }
    const a = pr.rotation.y, ax = Math.sin(a) * rx + Math.cos(a) * rz, ay = -(Math.sin(a) * fx + Math.cos(a) * fz), L = 9 * dpr;
    const nx = -ay, ny = ax; // across the arrow
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5 * dpr; ctx.beginPath();
    ctx.moveTo(c + ax * L, c + ay * L); ctx.lineTo(c - ax * L * .7 + nx * L * .7, c - ay * L * .7 + ny * L * .7); ctx.lineTo(c - ax * L * .3, c - ay * L * .3); ctx.lineTo(c - ax * L * .7 - nx * L * .7, c - ay * L * .7 - ny * L * .7); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    // N on the rim, where world north (+z) lies on the turned map
    const nA = Math.atan2(-fz, rz), nR = c - 10 * dpr, Nx = c + Math.cos(nA) * nR, Ny = c + Math.sin(nA) * nR;
    ctx.fillStyle = 'rgba(10,13,22,.92)'; ctx.strokeStyle = GOLD; ctx.lineWidth = 1.5 * dpr; ctx.beginPath(); ctx.arc(Nx, Ny, 8 * dpr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = GOLD; ctx.font = `bold ${10 * dpr}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('N', Nx, Ny + .5 * dpr);
  };
})();
