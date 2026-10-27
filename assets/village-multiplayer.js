// Universe multiplayer, step 2 (see each other): the other players in this village, from the room server (realtime/).
// window.VillageMP.start(host) once the village is up, then VillageMP.tick(dt) every frame. host (village.html):
//   { scene, village, lite, shadows(), player() -> { x, y, z, yaw, anim, interior } | null, canSend(), character() -> { col, tok },
//     viaSite(url), toast(msg) }
// The page asks Universe for a ticket (api/mp-ticket.mjs: who the player is and what they look like, signed), opens the
// village's room with it and sends its own state (when it changes, at most every 150 ms; a last one when it stops; one every
// 12 s otherwise); the room relays everyone else's. Others are drawn as their own Rebel (Forge rig, the starter ant or a
// kit ape) for the nearest few in the same place, a plain stand-in for the rest and while a model downloads, a name tag
// over each. Players in a room are seen only by players in that room. ?mp=0 turns it off; ?mp=ws://127.0.0.1:<port>
// (tests) uses a local room server.
(function () {
  'use strict';
  const PROTOCOL = 'rebel-universe.v1', FULL_R = 80, TAG_R = 45, SEND_MS = 150, BEAT_MS = 12000, PING_MS = 25000;
  const RIG_SCALE = 1.9, STARTER_SCALE = .018, TAG_Y = 3.95;
  const STARTER = { base: '/assets/character/', idle: 'ant_idle_c.glb', clips: { walk: 'ant_walk_c.glb', run: 'ant_run_c.glb', kick: 'ant_flip_kick_c.glb', jump: 'ant_jumping_c.glb' } };
  const STORE = /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\//;
  // moves that play once (the rest loop); a move the other's model lacks: a kick for these, else idle
  const ONCE = new Set(['jump', 'kick', 'flip_kick', 'front_kick', 'roundhouse_kick', 'side_kick', 'punch_combo', 'cartwheel', 'jump_run', 'backflip', 'front_flip', 'hurricane_kick', 'spin_flip_kick', 'crescent_kick', 'jab', 'cross_punch', 'hook_punch', 'elbow_punch', 'hit_reaction', 'knockdown', 'get_up']);
  let H = null, B = null, root = null, ws = null, connecting = false, you = 0, room = null, closedFor = null, retry = 0, retryAt = 0, maxFull = 8;
  const peers = new Map(), containers = new Map();
  let last = null, lastSent = 0, lastBeat = 0, moving = false, stillSince = 0, enabled = true, capsuleSrc = null;
  const log = (...a) => { if (window._mpDebug) console.log('[mp]', ...a); };
  const q = new URLSearchParams(location.search), override = q.get('mp');
  if (override === '0') enabled = false;
  const localServer = override && /^ws:\/\/(127\.0\.0\.1|localhost):\d+$/.test(override) ? override : null;

  // ---- the connection ----
  async function connect() {
    if (!enabled || ws || connecting) return;
    connecting = true;
    try {
      const ch = H.character() || {};
      let t;
      for (let tries = 0; ; tries++) {
        const asked = performance.now();
        try {
          const r = await fetch(`/api/mp-ticket?village=${encodeURIComponent(H.village)}&col=${encodeURIComponent(ch.col || '')}&tok=${encodeURIComponent(ch.tok || '')}`, { credentials: 'same-origin', cache: 'no-store' });
          t = await r.json().catch(() => ({}));
          if (!r.ok || !t.ok) { log('no ticket', r.status, t.error); if (r.status === 503 || r.status === 404) enabled = false; else backoff(); return; } // 503: the rooms are off
        } catch (e) { backoff(); return; }
        // a ticket lasts 120 s from when the server made it (after `asked`): one this page took over 90 s to read (a long
        // frozen frame) would be turned away at the door (401), so it asks again
        if (performance.now() - asked < 90000 || tries >= 2) break;
        log('ticket too old, again');
      }
      if (!enabled) return;
      let s;
      try { s = new WebSocket((localServer || t.url) + '/v1/room?village=' + encodeURIComponent(H.village), [PROTOCOL, 't.' + t.ticket]); } catch (e) { backoff(); return; }
      ws = s; you = 0;
      s.onmessage = e => { if (ws === s) { try { onMessage(JSON.parse(e.data)); } catch (err) { log('bad message', err); } } };
      s.onclose = e => {
        if (ws !== s) return; // an older socket (a reconnect) going
        ws = null; dropAll(); log('closed', e.code);
        if (e.code === 4001) { closedFor = 'dup'; H.toast?.('Universe is open in another tab: other players show there.'); return; }
        backoff();
      };
      s.onerror = () => {};
    } finally { connecting = false; }
  }
  function backoff() { retry = Math.min(retry + 1, 6); retryAt = performance.now() + Math.min(30000, 1000 * 2 ** retry) * (.75 + Math.random() * .5); }
  const send = o => { if (ws && ws.readyState === 1) { ws.send(typeof o === 'string' ? o : JSON.stringify(o)); return true; } return false; };
  function onMessage(m) {
    if (m.t === 'hi') { you = m.you; room = m.room; retry = 0; for (const p of m.peers || []) addPeer(p); last = null; return; }
    if (m.t === 'j') return addPeer(m);
    if (m.t === 'l') return removePeer(m.id);
    if (m.t === 'u') { const p = peers.get(m.id); if (p) setState(p, m.s); return; }
    if (m.t === 'e') { const p = peers.get(m.id); if (p) playOnce(p, m.e === 'cheer' ? 'jump' : m.e); return; }
  }
  function reconnect() {
    closedFor = null; retry = 0; retryAt = 0;
    const s = ws; ws = null; dropAll();
    if (s) { try { s.close(1000, 'new ticket'); } catch (e) {} }
  }

  // ---- the others ----
  function addPeer(d) {
    if (!d || d.id === you) return;
    removePeer(d.id);
    const holder = new B.TransformNode('mpPlayer_' + d.id, H.scene); holder.parent = root;
    const p = { id: d.id, n: String(d.n || 'Rebel'), k: d.k, look: d.look || { t: 'starter' }, holder, pos: null, yaw: 0, s: null, model: null, loading: false, capsule: null, tag: null, anim: '', cur: null, hold: null, d: 0 };
    peers.set(p.id, p);
    makeTag(p);
    if (d.s) setState(p, d.s);
    log('peer', p.id, p.n, p.look.t);
  }
  function removePeer(id) {
    const p = peers.get(id); if (!p) return;
    peers.delete(id); disposeModel(p);
    try { p.tag?.material?.diffuseTexture?.dispose(); p.tag?.material?.dispose(); } catch (e) {}
    try { p.holder.dispose(false, false); } catch (e) {}
  }
  function dropAll() { for (const id of [...peers.keys()]) removePeer(id); }
  function setState(p, s) {
    if (!Array.isArray(s) || s.length < 6) return;
    if (ONCE.has(s[4]) && s[4] !== p.s?.[4]) p.once = s[4]; // a jump / kick plays even when it is over before our next frame
    p.s = s;
    if (!p.pos) { p.pos = new B.Vector3(s[0], s[1], s[2]); p.yaw = s[3]; }
  }
  const label = look => {
    const c = look?.col, t = look?.tok;
    if (!c || !t) return '';
    return c === 'battle_for_colony' ? 'Rebel #' + t : c === 'chumpz' ? 'Chumpz #' + t : c === 'saints' ? 'Saint #' + t : '#' + t;
  };
  function makeTag(p) {
    const W = 512, Ht = 128, dt = new B.DynamicTexture('mpTagTex_' + p.id, { width: W, height: Ht }, H.scene, true), c = dt.getContext();
    const name = p.n.slice(0, 22), sub = label(p.look) || (p.k === 'guest' ? 'Visitor' : '');
    c.clearRect(0, 0, W, Ht);
    c.font = '800 46px Arial, sans-serif'; const w1 = c.measureText(name).width;
    c.font = '600 27px Arial, sans-serif'; const w2 = c.measureText(sub).width;
    const w = Math.min(W - 8, 64 + Math.max(w1, w2));
    c.fillStyle = 'rgba(8,6,16,.62)'; roundRect(c, (W - w) / 2, 8, w, Ht - 16, 24); c.fill();
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = '800 46px Arial, sans-serif'; c.fillStyle = p.k === 'guest' ? '#d6d1e2' : p.k === 'name' ? '#ffd36a' : '#a9bbff'; c.fillText(name, W / 2, sub ? 48 : 64, W - 30);
    if (sub) { c.font = '600 27px Arial, sans-serif'; c.fillStyle = 'rgba(255,255,255,.8)'; c.fillText(sub, W / 2, 94, W - 40); }
    dt.hasAlpha = true; dt.update();
    const m = new B.StandardMaterial('mpTagMat_' + p.id, H.scene);
    m.diffuseTexture = dt; m.emissiveTexture = dt; m.useAlphaFromDiffuseTexture = true; m.disableLighting = true; m.backFaceCulling = false; m.specularColor = B.Color3.Black();
    const tag = B.MeshBuilder.CreatePlane('mpPlayerTag_' + p.id, { width: 2.8, height: .7 }, H.scene);
    tag.material = m; tag.parent = p.holder; tag.position.y = TAG_Y; tag.billboardMode = B.Mesh.BILLBOARDMODE_ALL; tag.isPickable = false;
    tag.metadata = { camSkip: true, mpPeer: true }; tag.applyFog = false;
    p.tag = tag;
  }
  function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  // the stand-in while a model downloads and for players further off than the nearest few
  function capsuleOf(p) {
    if (p.capsule) return p.capsule;
    if (!capsuleSrc) {
      capsuleSrc = B.MeshBuilder.CreateCapsule('mpPlayerCapsuleSrc', { height: 3.2, radius: .55, tessellation: 12, subdivisions: 2 }, H.scene);
      const m = new B.StandardMaterial('mpPlayerCapsuleMat', H.scene); m.diffuseColor = new B.Color3(.32, .3, .42); m.emissiveColor = new B.Color3(.08, .07, .12); m.alpha = .55; m.specularColor = B.Color3.Black();
      capsuleSrc.material = m; capsuleSrc.isPickable = false; capsuleSrc.parent = root; capsuleSrc.setEnabled(false); capsuleSrc.metadata = { camSkip: true, mpPeer: true };
    }
    const c = capsuleSrc.clone('mpPlayerCapsule_' + p.id, p.holder); // shares the shape
    c.position.set(0, 1.6 / p.holder.scaling.y, 0); c.scaling.setAll(1 / p.holder.scaling.x); c.isPickable = false; c.metadata = { camSkip: true, mpPeer: true }; c.setEnabled(true);
    return (p.capsule = c);
  }

  // ---- their models: a downloaded file is kept and each player gets its own copy of it ----
  function container(url) {
    if (!containers.has(url)) containers.set(url, B.SceneLoader.LoadAssetContainerAsync('', H.viaSite(url), H.scene).catch(e => { containers.delete(url); throw e; }));
    return containers.get(url);
  }
  // as the village does for its own player: the rig's PBR materials take at most 4 lights (the village's 16 overflow the
  // skinned shader: the model went invisible), no emissive, both faces
  function fixMaterial(mat) {
    if (!mat || mat._mpFixed) return;
    mat._mpFixed = true;
    if (mat.maxSimultaneousLights !== undefined) {
      let pr = Object.getPrototypeOf(mat), d = null; while (pr && !(d = Object.getOwnPropertyDescriptor(pr, 'maxSimultaneousLights'))) pr = Object.getPrototypeOf(pr);
      if (d && d.set) Object.defineProperty(mat, 'maxSimultaneousLights', { configurable: true, get() { return d.get.call(this); }, set(v) { d.set.call(this, Math.min(v, 4)); } });
      mat.maxSimultaneousLights = 4; mat.backFaceCulling = false;
    }
    if (mat.getClassName?.() === 'PBRMaterial') { mat.emissiveColor = new B.Color3(0, 0, 0); mat.emissiveIntensity = 0; }
  }
  const markPeer = m => { m.isPickable = false; m.metadata = { ...(m.metadata || {}), camSkip: true, mpPeer: true }; };
  async function loadModel(p) {
    if (p.loading || p.model) return;
    p.loading = true;
    const look = p.look || {}, prefix = 'mpPlayer_' + p.id + '_';
    try {
      if (look.t === 'kit' && window.SamuraiKit?.types?.includes(look.type)) {
        const kit = new B.TransformNode(prefix + 'kit', H.scene); kit.parent = p.holder; kit.rotation.y = Math.PI; // kit fronts face -z, players +z
        window.SamuraiKit.build(kit, look.type, H.scene, H.shadows?.() || null, false);
        const meshes = kit.getChildMeshes(false);
        meshes.forEach(m => { markPeer(m); delete m._editRoot; if (!/player/i.test(m.name)) m.name = prefix + m.name; }); // (the minimap leaves players out by name)
        p.model = { kind: 'kit', node: kit, groups: {}, meshes, extra: [] };
      } else {
        const rig = look.t === 'rig' && typeof look.url === 'string' && STORE.test(look.url);
        const c = await container(rig ? look.url : STARTER.base + STARTER.idle);
        if (!peers.has(p.id)) return;
        const inst = c.instantiateModelsToScene(n => prefix + n, false, { doNotInstantiate: true });
        const meshes = [], groups = {}, extra = [];
        for (const r of inst.rootNodes) { if (r instanceof B.AbstractMesh) meshes.push(r); meshes.push(...r.getChildMeshes(false)); }
        // the same set-up as the village's own player: the meshes straight under the root, their rotation dropped
        meshes.forEach(m => { m.parent = p.holder; if (m.rotationQuaternion) m.rotationQuaternion = null; if (!rig) m.position.y -= 8; markPeer(m); fixMaterial(m.material); });
        for (const r of inst.rootNodes) if (!(r instanceof B.AbstractMesh) && !r.parent) r.parent = p.holder;
        // blending for the rigs only, as the village's own player: the starter ant's joints have no rotationQuaternion to
        // blend from (Babylon's animate() throws on it every frame, which stops the whole page)
        inst.animationGroups.forEach(g => { g.stop(); if (rig) { g.enableBlending = true; g.blendingSpeed = .12; } groups[g.name.startsWith(prefix) ? g.name.slice(prefix.length) : g.name] = g; });
        if (!rig) {
          // the starter ant: its joints lose their rest turn as the village's own do, idle in its file without the hips'
          // travel, the other moves from their own files
          const nodes = new Map();
          for (const r of inst.rootNodes) for (const n of r.getDescendants(false)) if (!(n instanceof B.AbstractMesh)) { if (n.rotationQuaternion) n.rotationQuaternion = null; nodes.set(n.name.startsWith(prefix) ? n.name.slice(prefix.length) : n.name, n); }
          const noHipTravel = g => { for (let j = g.targetedAnimations.length - 1; j >= 0; j--) { const ta = g.targetedAnimations[j]; if (!ta.target || (ta.animation.targetProperty === 'position' && /mixamorig_Hips$/.test(ta.target.name || ''))) g.targetedAnimations.splice(j, 1); } };
          if (inst.animationGroups[0]) { groups.idle = inst.animationGroups[0]; noHipTravel(groups.idle); }
          await Promise.all(Object.entries(STARTER.clips).map(async ([name, file]) => {
            try {
              const cc = await container(STARTER.base + file), src = cc.animationGroups[0]; if (!src || !peers.has(p.id)) return;
              const g = src.clone(prefix + name, t => nodes.get(t.name) || null);
              noHipTravel(g); g.stop(); groups[name] = g; extra.push(g);
            } catch (e) {}
          }));
        }
        if (!peers.has(p.id)) { inst.dispose(); extra.forEach(g => g.dispose()); return; }
        p.holder.scaling.setAll(rig ? RIG_SCALE : STARTER_SCALE);
        const sh = H.shadows?.(); if (sh) meshes.forEach(m => { try { sh.addShadowCaster(m); } catch (e) {} });
        p.model = { kind: rig ? 'rig' : 'starter', inst, groups, meshes, extra };
      }
      placeTag(p);
      p.anim = ''; p.cur = null; log('model', p.id, p.model.kind);
    } catch (e) { log('model failed', p.id, e?.message); p.look = { t: 'capsule' }; }
    finally { p.loading = false; }
  }
  // the name over the model's head (its bind pose; the starter ant's sits about 1.6 m under its feet, as the village's own)
  function placeTag(p) {
    const k = p.holder.scaling.x;
    let top = TAG_Y - .45;
    if (p.model) {
      p.holder.computeWorldMatrix(true);
      let max = -Infinity;
      for (const m of p.model.meshes) { if (!m.getTotalVertices?.()) continue; m.computeWorldMatrix(true); m.refreshBoundingInfo(); max = Math.max(max, m.getBoundingInfo().boundingBox.maximumWorld.y); }
      if (Number.isFinite(max)) top = max - p.holder.position.y + (p.model.kind === 'starter' ? 1.65 : 0);
    }
    if (p.tag) { p.tag.scaling.setAll(1 / k); p.tag.position.y = Math.min(6, Math.max(1.6, top + .45)) / k; }
    if (p.capsule) { p.capsule.scaling.setAll(1 / k); p.capsule.position.y = 1.6 / k; }
  }
  function disposeModel(p) {
    const m = p.model; if (!m) return; p.model = null; p.cur = null; p.anim = '';
    const sh = H.shadows?.();
    try { if (sh) m.meshes.forEach(x => sh.removeShadowCaster(x)); } catch (e) {}
    try { m.extra.forEach(g => g.dispose()); } catch (e) {}
    try { if (m.inst) m.inst.dispose(); else m.node?.dispose(false, false); } catch (e) {}
    p.holder.scaling.setAll(1); placeTag(p);
  }
  function groupFor(p, a) {
    const g = p.model?.groups || {};
    if (a === 'swim') a = 'walk';
    return g[a] || (a === 'kick' ? g.flip_kick : a === 'flip_kick' ? g.kick : null)
      || (ONCE.has(a) ? g.flip_kick || g.kick : a === 'run' ? g.walk : a === 'fight_idle' ? g.idle : null) || g.idle || null;
  }
  function playAnim(p, a) {
    if (!p.model) return;
    if (p.model.kind === 'kit') { // a kit ape walks / runs by itself from how fast it moves: only its jump and kick are played
      if (a !== p.anim && ONCE.has(a)) window.SamuraiKit?.actorAction?.(p.model.node, a === 'jump' ? 'jump' : 'kick', 1);
      p.anim = a; return;
    }
    const g = groupFor(p, a), again = a !== p.anim;
    p.anim = a;
    if (!g || (g === p.cur && !(again && ONCE.has(a)))) return;
    try { if (p.cur && p.cur !== g) p.cur.stop(); } catch (e) {}
    p.cur = g; g.start(!ONCE.has(a), 1, g.from, g.to);
  }
  function playOnce(p, a, over) { // over: it plays to its end even if they walk on meanwhile (an emote stops when they move)
    if (!p.model) return;
    const g = groupFor(p, a);
    p.hold = { a, over: !!over, until: performance.now() + (g ? Math.max(.4, (g.to - g.from) / 60) * 1000 : 900) }; p.anim = '';
    playAnim(p, a);
  }

  // ---- every frame (a fault here must never stop the village's frame) ----
  let warned = false;
  function tick(dt) {
    if (!H || !enabled) return;
    try { step(dt); } catch (e) { if (!warned) { warned = true; console.warn('Multiplayer:', e); } }
  }
  function step(dt) {
    const now = performance.now(), me = H.player(), cam = H.scene.activeCamera?.globalPosition;
    if (!ws && !connecting && closedFor !== 'dup' && now >= retryAt && me) { retryAt = now + 2000; connect(); }
    if (ws && ws.readyState === 1 && me && H.canSend()) {
      const ch = !last || Math.hypot(me.x - last.x, me.z - last.z) > .05 || Math.abs(me.y - last.y) > .05 || Math.abs(angle(me.yaw - last.yaw)) > .05 || me.anim !== last.anim || me.interior !== last.interior;
      if (ch) { moving = true; stillSince = now; }
      if (ch && now - lastSent >= SEND_MS) sendState(me, 0, now);
      else if (!ch && moving && now - stillSince > 300) { moving = false; sendState(me, 1, now); }
      else if (now - lastBeat > BEAT_MS) sendState(me, 0, now);
    }
    // the others: eased toward their last state; the nearest few in the same place as their own model
    const k = 1 - Math.exp(-dt * 10), here = me ? me.interior || null : null, list = [];
    for (const p of peers.values()) {
      if (!p.s || !p.pos) { p.holder.setEnabled(false); p.once = null; continue; }
      const same = (p.s[5] || null) === here;
      p.holder.setEnabled(same);
      if (!same) { p.once = null; continue; }
      const tx = p.s[0], ty = p.s[1], tz = p.s[2];
      if (Math.hypot(tx - p.pos.x, tz - p.pos.z) > 10 || Math.abs(ty - p.pos.y) > 6) p.pos.set(tx, ty, tz); // a teleport (a door, a gate jump)
      else { p.pos.x += (tx - p.pos.x) * k; p.pos.y += (ty - p.pos.y) * k; p.pos.z += (tz - p.pos.z) * k; }
      p.yaw += angle(p.s[3] - p.yaw) * k;
      p.holder.position.copyFrom(p.pos); p.holder.rotation.y = p.yaw;
      p.d = me ? Math.hypot(p.pos.x - me.x, p.pos.z - me.z) : 0;
      list.push(p);
      if (p.tag) {
        p.tag.setEnabled(p.d < TAG_R); p.tag.visibility = p.d < TAG_R - 10 ? 1 : Math.max(0, (TAG_R - p.d) / 10);
        const dc = cam ? B.Vector3.Distance(cam, p.pos) : p.d; // the same size on screen past 14 m, so far names stay readable
        p.tag.scaling.setAll(Math.min(3, Math.max(1, dc / 14)) / p.holder.scaling.x);
      }
    }
    list.sort((a, b) => a.d - b.d);
    list.forEach((p, i) => {
      const full = i < maxFull && p.d < FULL_R && p.look?.t !== 'capsule';
      if (full && !p.model && !p.loading) loadModel(p);
      if (!full && p.model) disposeModel(p);
      if (!p.model) capsuleOf(p).setEnabled(true); else if (p.capsule) p.capsule.setEnabled(false);
      if (p.model) {
        if (p.once) playOnce(p, p.once, true);
        const a = p.s[4] || 'idle', held = p.hold && now < p.hold.until && (a === 'idle' || (p.hold.over && !ONCE.has(a)));
        playAnim(p, held ? p.hold.a : a);
        if (p.hold && now >= p.hold.until) p.hold = null;
      }
      p.once = null;
    });
  }
  const angle = a => Math.atan2(Math.sin(a), Math.cos(a));
  const round = v => Math.round(v * 100) / 100;
  function sendState(me, final, now) {
    if (send({ t: 's', p: [round(me.x), round(me.y), round(me.z)], r: Math.round(me.yaw * 1000) / 1000, a: me.anim || 'idle', i: me.interior || null, ...(final ? { f: 1 } : {}) })) { last = { ...me }; lastSent = now; lastBeat = now; }
  }

  function start(host) {
    if (H || !host || !window.BABYLON) return;
    H = host; B = window.BABYLON; maxFull = H.lite ? 4 : 8;
    root = new B.TransformNode('mpPlayersRoot', H.scene); root.metadata = { keepInInteriors: true }; // rooms hide the village, not the players (each is shown in its own place)
    setInterval(() => send('{"t":"ping"}'), PING_MS); // (timers, not frames: a hidden tab draws nothing)
    document.addEventListener('visibilitychange', () => { const me = H.player(); if (document.hidden && me && H.canSend()) sendState(me, 1, performance.now()); });
    log('start', H.village, localServer || '');
  }
  function emote(name) { return send({ t: 'e', e: String(name || '') }); }
  window.VillageMP = { start, tick, reconnect, emote, peers, get state() { return { enabled, open: !!ws && ws.readyState === 1, you, room, peers: peers.size, closedFor }; }, stop() { enabled = false; const s = ws; ws = null; try { s?.close(1000); } catch (e) {} dropAll(); } };
})();
