// Rebel weapons (Sept 29): a Rebel wears its weapon on its back, like the NFT art (hilt over one shoulder, the blade
// or quiver running down across the back). Shared by the Forge viewer and the village.
//
//   const w = await RebelWeapon.attach({ scene, meshes, skeletonRoot, animationGroups, weapon, hilt });
//   w.dispose();
//
// weapon = a catalog entry from /api/forge-weapon?action=catalog: { id, glbUrl, mount: { length, angle, out, up, hiltEnd } }
// hilt   = 'R' | 'L' (the character's own right / left shoulder; the NFT's "-2" trait is the other shoulder)
//
// The weapon is placed once with the Rebel in its rest pose (worked out from its own bones and body surface, so it
// fits every body), then parented to the Spine2 bone so it rides every move.
(function () {
  const B = () => window.BABYLON;
  // length / up / out: fractions of the Rebel's height; angle: degrees from the spine toward the hilt shoulder.
  // Tuned on #4 / #4998 / #1738: the hilt peeks over one shoulder at ear height, the blade crosses the back to the other hip.
  const MOUNT = { length: 0.5, angle: 28, out: 0.012, up: 0, hiltEnd: 'auto' };
  const KIND = { dawns_light_arrows: { length: 0.4, angle: 22, up: 0.01 }, celestial_fang: { length: 0.44 } };

  function node(nodes, suffix) {
    return nodes.find((n) => n.name && (n.name === 'mixamorig:' + suffix || n.name === 'mixamorig_' + suffix || n.name.endsWith(':' + suffix) || n.name.endsWith('_' + suffix) || n.name === suffix)) || null;
  }
  function worldVerts(meshes, cap = 60000) {
    const out = [];
    for (const m of meshes) {
      const p = m.getVerticesData && m.getVerticesData(B().VertexBuffer.PositionKind);
      if (!p) continue;
      m.computeWorldMatrix(true); const W = m.getWorldMatrix();
      const step = Math.max(1, Math.floor(p.length / 3 / cap));
      for (let i = 0; i < p.length; i += 3 * step) out.push(B().Vector3.TransformCoordinates(new (B().Vector3)(p[i], p[i + 1], p[i + 2]), W));
    }
    return out;
  }
  const pct = (arr, q) => { if (!arr.length) return 0; const a = arr.slice().sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(q * (a.length - 1)))]; };

  async function attach({ scene, root, meshes, animationGroups = [], weapon, hilt = 'R', parentBone = 'Spine2', onMaterial }) {
    const V3 = B().Vector3;
    if (!weapon || !weapon.glbUrl) return null;
    const mount = { ...MOUNT, ...(KIND[weapon.id] || {}), ...(weapon.mount || {}) };
    // 1. rest pose (the placement is worked out on the un-animated body)
    const playing = animationGroups.filter((g) => g.isPlaying);
    playing.forEach((g) => g.pause());
    const skeletons = [...new Set(meshes.map((m) => m.skeleton).filter(Boolean))];
    skeletons.forEach((s) => s.returnToRest());
    // Everything is measured where the body is DRAWN: skin bone x skinned mesh. (The village re-parents the skinned mesh
    // straight to its playerRoot, so the bone nodes' own world matrices sit mirrored front-to-back from the drawn body.)
    const sm = meshes.find((m) => m.skeleton);
    const skel = sm && sm.skeleton;
    const bone = (n) => (skel ? node(skel.bones, n) : null);
    const hips = bone('Hips'), neck = bone('Neck'), sp = bone(parentBone) || bone('Spine1'), ls = bone('LeftShoulder') || bone('LeftArm'), rs = bone('RightShoulder') || bone('RightArm');
    const foot = bone('LeftFoot'), toe = bone('LeftToeBase');
    if (!hips || !neck || !sp || !ls || !rs) { playing.forEach((g) => g.play(g.loopAnimation)); return null; }
    // fresh matrices top-down (a Rebel re-parented this frame still has stale cached ones)
    let top = root || sm; while (top.parent) top = top.parent;
    [top, ...top.getDescendants(false)].forEach((n) => n.computeWorldMatrix && n.computeWorldMatrix(true));
    skel.prepare(true);
    const boneWorld = (b) => b.getFinalMatrix().multiply(sm.getWorldMatrix());
    const bp = (b) => V3.TransformCoordinates(V3.Zero(), boneWorld(b));
    const P = bp(sp);
    const up = bp(neck).subtract(bp(hips)).normalize();
    const right = bp(rs).subtract(bp(ls)); right.subtractInPlace(up.scale(V3.Dot(right, up))); right.normalize();
    let fwd = V3.Cross(right, up).normalize();                      // left-handed Babylon: right x up = forward
    if (foot && toe) { const f = bp(toe).subtract(bp(foot)); if (V3.Dot(f, fwd) < 0) fwd = fwd.scale(-1); }
    const back = fwd.scale(-1);
    const verts = worldVerts(meshes.filter((m) => m.getTotalVertices && m.getTotalVertices() > 500));
    const ys = verts.map((v) => V3.Dot(v, up));
    const H = pct(ys, 0.999) - pct(ys, 0.001);
    // the back surface behind Spine2 (a slice of the torso, not the arms)
    const halfW = V3.Distance(bp(ls), bp(rs)) * 0.45;
    const depth = pct(verts.filter((v) => { const d = v.subtract(P); return Math.abs(V3.Dot(d, up)) < 0.08 * H && Math.abs(V3.Dot(d, right)) < halfW; }).map((v) => V3.Dot(v.subtract(P), back)), 0.97) || 0.08 * H;

    // 2. the weapon, normalised: long axis, hilt end, flat face
    const res = await B().SceneLoader.ImportMeshAsync(null, '', weapon.glbUrl, scene);
    const wroot = res.meshes[0];
    const wmeshes = res.meshes.filter((m) => m.getTotalVertices && m.getTotalVertices() > 0);
    wroot.computeWorldMatrix(true);
    const wv = worldVerts(wmeshes, 20000);
    // the middle of its extent (not the vertex mean: detailed hilts are dense and pulled the blade down the back)
    const lo = ['x', 'y', 'z'].map((k) => pct(wv.map((v) => v[k]), 0.005)), hi = ['x', 'y', 'z'].map((k) => pct(wv.map((v) => v[k]), 0.995));
    const c = new V3((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2);
    const ext = [0, 1, 2].map((i) => hi[i] - lo[i]);
    const ai = ext.indexOf(Math.max(...ext));                        // the long axis
    const axis = [new V3(1, 0, 0), new V3(0, 1, 0), new V3(0, 0, 1)][ai];
    const len = ext[ai];
    // hilt end: the guard / fletching is the widest slice and sits nearer the hilt end
    const ts = wv.map((v) => V3.Dot(v.subtract(c), axis) / len + 0.5);
    const rr = wv.map((v) => { const d = v.subtract(c); return d.subtract(axis.scale(V3.Dot(d, axis))).length(); });
    const rTop = pct(rr, 0.97), wideT = pct(ts.filter((t, i) => rr[i] >= rTop), 0.5);
    const hiltSign = mount.hiltEnd === 'min' ? -1 : mount.hiltEnd === 'max' ? 1 : (wideT < 0.5 ? -1 : 1);
    // flat face: of the two short axes, the thinner one faces out from the back
    const others = [0, 1, 2].filter((i) => i !== ai);
    const thinI = ext[others[0]] <= ext[others[1]] ? others[0] : others[1];
    const wideI = others.find((i) => i !== thinI);
    const E = [new V3(1, 0, 0), new V3(0, 1, 0), new V3(0, 0, 1)];

    // 3. where it goes: centred on the back, tilted so the hilt rises over the chosen shoulder
    const side = hilt === 'L' ? right.scale(-1) : right;
    const a = (mount.angle || 30) * Math.PI / 180;
    const D = up.scale(Math.cos(a)).add(side.scale(Math.sin(a))).normalize();         // tip -> hilt
    const N = back;                                                                        // flat face looks back
    let S = V3.Cross(D, N).normalize();
    const scale = (mount.length * H) / len;
    const center = P.add(back.scale(depth + (mount.out || 0) * H)).add(up.scale((mount.up || 0) * H));

    // local frame of the weapon file: long axis (toward hilt), wide axis, thin axis -> world D, S, N
    const L = E[ai].scale(hiltSign), Wd = E[wideI], Th = E[thinI];
    const Mw = B().Matrix.FromValues(L.x, L.y, L.z, 0, Wd.x, Wd.y, Wd.z, 0, Th.x, Th.y, Th.z, 0, 0, 0, 0, 1);   // rows = weapon axes
    let Mt = B().Matrix.FromValues(D.x, D.y, D.z, 0, S.x, S.y, S.z, 0, N.x, N.y, N.z, 0, 0, 0, 0, 1);         // rows = target axes
    let R = Mw.transpose().multiply(Mt);   // row vectors: v * R maps the weapon axes onto the target axes
    if (R.determinant() < 0) { S = S.scale(-1); Mt = B().Matrix.FromValues(D.x, D.y, D.z, 0, S.x, S.y, S.z, 0, N.x, N.y, N.z, 0, 0, 0, 0, 1); R = Mw.transpose().multiply(Mt); }
    // the pivot rides the drawn spine bone (attachToBone: world = local x bone x skinned mesh). Its local is a plain
    // matrix, since a mirrored rig can't be split into position / rotation / scale.
    const pivot = new (B().TransformNode)('rebelWeapon_' + weapon.id, scene);
    pivot.setPreTransformMatrix(B().Matrix.Translation(center.x, center.y, center.z).multiply(B().Matrix.Invert(boneWorld(sp))));
    pivot.attachToBone(sp, sm); pivot.scalingDeterminant = 1;
    const inner = new (B().TransformNode)('rebelWeaponInner', scene);
    inner.parent = pivot;
    // the file's root keeps its own import transform (handedness); inner centres, turns and sizes it
    wroot.parent = inner;
    const innerLocal = B().Matrix.Translation(-c.x, -c.y, -c.z).multiply(R).multiply(B().Matrix.Scaling(scale, scale, scale));
    inner.rotationQuaternion = new (B().Quaternion)();
    innerLocal.decompose(inner.scaling, inner.rotationQuaternion, inner.position);
    // 4. it rides the spine (pivot is parented to it)
    wmeshes.forEach((m) => { m.isPickable = false; m.alwaysSelectAsActiveMesh = true; if (m.material && onMaterial) onMaterial(m.material, m); });
    // 5. back to moving
    playing.forEach((g) => g.play(g.loopAnimation));
    pivot.computeWorldMatrix(true);
    const outLocal = V3.TransformNormal(D, B().Matrix.Invert(pivot.getWorldMatrix())).normalize();
    return { pivot, meshes: wmeshes, outDir: () => V3.TransformNormal(outLocal, pivot.getWorldMatrix()).normalize(), info: { H, depth, len, hiltSign, ai }, dispose() { wmeshes.forEach((m) => m.dispose()); wroot.dispose(); inner.dispose(); pivot.dispose(); } };
  }

  // the Rebel's weapon: the holder's pick, else its NFT trait ("-2" = other shoulder)
  const TRAIT = { 'Celestial-Fang': ['celestial_fang', 'R'], "Dawn's-Light-Arrows": ['dawns_light_arrows', 'R'], 'Eclipse-Edge': ['eclipse_edge', 'R'], 'Soulrender': ['soulrender', 'L'], 'Stormbringer-Blade': ['stormbringer_blade', 'L'], 'Whisper-of-Dawn': ['whisper_of_dawn', 'L'] };
  function fromTrait(value) {
    const v = String(value || ''), t = TRAIT[v.replace(/-2$/, '')];
    if (!t) return null;
    return { weaponId: t[0], hilt: /-2$/.test(v) ? (t[1] === 'R' ? 'L' : 'R') : t[1] };
  }
  let catalogP = null;
  function catalog() { return catalogP || (catalogP = fetch('/api/forge-weapon?action=catalog').then((r) => r.json()).then((j) => j.weapons || []).catch(() => [])); }
  async function resolve(tokenId, traitValue, collectionKey = 'battle_for_colony') {
    let choice = null;
    try { const j = await (await fetch(`/api/forge-weapon?action=choice&collectionKey=${collectionKey}&tokenId=${encodeURIComponent(tokenId)}`, { cache: 'no-store' })).json(); choice = j.choice || null; } catch (e) {}
    const pick = choice || fromTrait(traitValue);
    if (!pick || pick.weaponId === 'none') return null;
    const w = (await catalog()).find((x) => x.id === pick.weaponId);
    return w ? { weapon: w, hilt: pick.hilt || 'R', chosen: !!choice } : null;
  }
  // ---------------------------------------------------------------------------------------------------------------
  // Weapon moves (Sept 29): draw from the back, fight with it, put it away. The clips come in a per-Rebel moves pack
  // (skeleton + weapon clips, made by the Forge Rigger with the rig) and play on the Rebel's own bones.
  const MOVESET = {
    sword: { draw: 'sword_draw', drawL: 'sword_draw_l', sheathe: 'sword_sheathe', sheatheL: 'sword_sheathe_l', idle: 'sword_idle', walk: 'sword_walk', run: 'sword_run', hit: 'sword_hit', block: 'sword_block',
      attacks: ['sword_combo', 'sword_power_slash', 'sword_down_slash', 'sword_spin_attack', 'sword_jump_attack', 'sword_kick', 'sword_combo2'], grab: 0.38, stow: 0.4, hideBack: true, length: 0.5 },
    twin: { draw: 'sword_draw', drawL: 'sword_draw_l', sheathe: 'sword_sheathe', sheatheL: 'sword_sheathe_l', idle: 'sword_idle', walk: 'sword_walk', run: 'sword_run', hit: 'sword_hit', block: 'sword_block',
      attacks: ['twin_combo', 'sword_combo', 'sword_power_slash', 'sword_down_slash', 'sword_spin_attack', 'sword_kick'], grab: 0.38, stow: 0.4, hideBack: true, length: 0.34 },
    bow: { draw: 'bow_draw', sheathe: 'bow_sheathe', idle: 'bow_idle', walk: 'bow_walk', run: 'bow_run', hit: 'bow_hit', aimIdle: 'bow_aim_idle',
      attacks: ['bow_nock', 'bow_aim', 'bow_shoot', 'bow_kick'], grab: 0.3, stow: 0.42, hideBack: false, length: 0.62 }
  };
  const kindOf = (weaponId) => (weaponId === 'dawns_light_arrows' ? 'bow' : weaponId === 'celestial_fang' ? 'twin' : 'sword');
  const MOVE_NAMES = { sword_draw: 'Draw', sword_draw_l: 'Draw', sword_sheathe: 'Sheathe', sword_sheathe_l: 'Sheathe', sword_idle: 'Sword Stance', sword_walk: 'Sword Walk', sword_run: 'Sword Run',
    sword_combo: 'Combo Slash', sword_power_slash: 'Power Slash', sword_down_slash: 'Downward Slash', sword_spin_attack: 'Spin Attack', sword_jump_attack: 'Leap Strike', sword_kick: 'Spin Kick',
    sword_combo2: 'Two-Hand Combo', sword_hit: 'Take a Hit', sword_block: 'Guard', twin_combo: 'Twin Blade Combo',
    bow_draw: 'Ready Bow', bow_sheathe: 'Stow Bow', bow_idle: 'Bow Stance', bow_walk: 'Bow Walk', bow_run: 'Bow Run', bow_nock: 'Nock Arrow', bow_aim: 'Power Draw', bow_shoot: 'Loose',
    bow_aim_idle: 'Aim', bow_kick: 'Bow Kick', bow_hit: 'Take a Hit' };

  // moves pack made with this rig (null if the rig predates weapon moves)
  const movesCache = {};
  function movesFor(rigUrl) {
    if (!rigUrl) return Promise.resolve(null);
    return movesCache[rigUrl] || (movesCache[rigUrl] = fetch('/api/forge-weapon?action=moves&rig=' + encodeURIComponent(rigUrl)).then((r) => r.json()).then((j) => j.moves || null).catch(() => null));
  }
  // load the pack and re-target its clips onto this Rebel's bones (by name). Returns { name: AnimationGroup }.
  async function loadMoves({ scene, root, url, prefix = '' }) {
    const nodes = {}; [root, ...root.getDescendants(false)].forEach((n) => { if (n.name && !(n.name in nodes)) nodes[n.name] = n; });
    const c = await B().SceneLoader.LoadAssetContainerAsync('', url, scene, null, '.glb');
    const out = {};
    for (const g of c.animationGroups) {
      const ng = new (B().AnimationGroup)(prefix + g.name, scene);
      for (const ta of g.targetedAnimations) {
        if (!ta.target || /^cloth_/.test(ta.target.name || '')) continue;       // the cloth solver owns those bones
        const t = nodes[ta.target.name]; if (t) ng.addTargetedAnimation(ta.animation, t);
      }
      ng.normalize(g.from, g.to); out[g.name] = ng;
    }
    c.animationGroups.forEach((g) => g.dispose()); c.dispose();
    return out;
  }

  // a drawn prop (bare blade / bow) closed in one hand. Placed from the hand's own bones, so it fits every Rebel.
  // Two-handed swords: the handle axis in the right hand's own frame, learnt from the Rebel's sword clips (the line
  // from the right fist to the left fist, averaged over every frame where both hands are on the hilt). The mocap was
  // made for another body, so a fixed guess put the handle beside the other fist.
  // The hole of a closed fist: the curled fingers wrap round the handle, so their joints (bone heads, on each finger's
  // centre line) lie on a circle round the handle's axis. Centre = mean circumcentre of consecutive joint triples of
  // the index / middle / ring / pinky fingers; radius - half a finger = the handle radius the fist fits.
  function circum(a, b, c) {
    const V3 = B().Vector3;
    const ab = b.subtract(a), ac = c.subtract(a), n = V3.Cross(ab, ac), n2 = n.lengthSquared(); if (n2 < 1e-14) return null;
    const o = V3.Cross(n, ab).scale(ac.lengthSquared()).add(V3.Cross(ac, n).scale(ab.lengthSquared())).scale(1 / (2 * n2));
    return { c: a.add(o), r: o.length() };
  }
  function fistCenter(bp, bone, S_) {
    const V3 = B().Vector3;
    const hb = bone(S_ + 'Hand'), ib = bone(S_ + 'HandIndex1'), pb = bone(S_ + 'HandPinky1'), mb = bone(S_ + 'HandMiddle1'), tb = bone(S_ + 'HandThumb1');
    if (!hb || !ib || !pb || !mb) return null;
    const Ph = bp(hb), Pi = bp(ib), Pp = bp(pb), A = Pi.subtract(Pp).normalize();
    let F = bp(mb).subtract(Ph); F.subtractInPlace(A.scale(V3.Dot(F, A))); const hl = F.length(); F.normalize();
    let Np = V3.Cross(F, A).normalize(); if (tb) { const q = bp(tb).subtract(Ph); if (V3.Dot(q, Np) < 0) Np = Np.scale(-1); }
    const cs = [], rs = [], seg = [];
    for (const f of ['Index', 'Middle', 'Ring', 'Pinky']) {
      const P = [1, 2, 3, 4].map((i) => bone(S_ + 'Hand' + f + i)).filter(Boolean).map(bp);
      for (let i = 0; i + 1 < P.length; i++) seg.push(V3.Distance(P[i], P[i + 1]));
      for (let i = 0; i + 2 < P.length; i++) { const k = circum(P[i], P[i + 1], P[i + 2]); if (k && k.r < hl) { cs.push(k.c); rs.push(k.r); } }
    }
    let G = null, r = 0;
    if (cs.length >= 3) {
      G = cs.reduce((a, v) => a.addInPlace(v), V3.Zero()).scale(1 / cs.length); r = rs.reduce((a, v) => a + v, 0) / rs.length;
      // keep only the part across the palm (the knuckle line runs along the handle)
    }
    const fallback = Ph.add(F.scale(0.78 * hl)).add(Np.scale(0.42 * hl));
    if (!G) G = fallback;
    const fing = seg.length ? seg.reduce((a, v) => a + v, 0) / seg.length : 0.2 * hl;
    return { G, r, hole: Math.max(0.2 * fing, r - 0.5 * 0.45 * fing), A, F, Np, hl, hb, span: V3.Distance(Pi, Pp), fromJoints: cs.length >= 3 };
  }
  function handleAxis({ meshes, groups = [], H = 1.8, side = 'Right', pair = [0.02, 0.14] }) {
    const V3 = B().Vector3, M = B().Matrix;
    const sm = meshes.find((m) => m.skeleton); if (!sm || !groups.length) return null;
    const skel = sm.skeleton; const bone = (n) => node(skel.bones, n);
    const boneWorld = (b) => b.getFinalMatrix().multiply(sm.getWorldMatrix());
    const bp = (b) => V3.TransformCoordinates(V3.Zero(), boneWorld(b));
    let top = sm; while (top.parent) top = top.parent;
    const all = [top, ...top.getDescendants(false)];
    const sum = V3.Zero(); let n = 0;
    for (const g of groups) {
      if (!g) continue;
      g.play(false);
      for (let i = 0; i <= 24; i++) {
        g.goToFrame(g.from + (g.to - g.from) * i / 24);
        all.forEach((x) => x.computeWorldMatrix && x.computeWorldMatrix(true)); skel.prepare(true);
        const R = fistCenter(bp, bone, 'Right'), L = fistCenter(bp, bone, 'Left'); if (!R || !L) continue;
        const v = side === 'Right' ? L.G.subtract(R.G) : R.G.subtract(L.G); const d = v.length();
        if (d < pair[0] * H || d > pair[1] * H) continue;
        const inv = M.Invert(boneWorld((side === 'Right' ? R : L).hb)); const loc = V3.TransformNormal(v, inv).normalize();
        sum.addInPlace(loc); n++;
      }
      g.stop();
    }
    return n >= 6 ? { local: sum.normalize(), frames: n } : null;
  }
  // principal direction of a point set (power iteration on the covariance)
  function pca(pts) {
    const V3 = B().Vector3;
    const m = pts.reduce((a, v) => a.addInPlace(v), V3.Zero()).scale(1 / Math.max(1, pts.length));
    const C = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (const p of pts) { const d = [p.x - m.x, p.y - m.y, p.z - m.z]; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i * 3 + j] += d[i] * d[j]; }
    let v = [1, 0.3, 0.2];
    for (let k = 0; k < 40; k++) { const w = [0, 1, 2].map((i) => C[i * 3] * v[0] + C[i * 3 + 1] * v[1] + C[i * 3 + 2] * v[2]); const n = Math.hypot(...w) || 1; v = w.map((x) => x / n); }
    return { m, d: new V3(v[0], v[1], v[2]) };
  }
  // A drawn prop closed in one hand. The handle (sword: between the guard and the pommel; bow: its middle grip) is found
  // in the model itself, and its axis goes through the fist's hole; placement is recomputed from the hand's own
  // finger joints, so it fits every Rebel.
  async function hold({ scene, meshes, url, hand = 'right', kind = 'sword', H = 1.8, onMaterial, grip, axis: handAxis, knuckle = false }) {
    const V3 = B().Vector3;
    const sm = meshes.find((m) => m.skeleton); if (!sm) return null;
    const skel = sm.skeleton; const bone = (n) => node(skel.bones, n);
    const S_ = hand === 'left' ? 'Left' : 'Right';
    skel.prepare(true);
    const boneWorld = (b) => b.getFinalMatrix().multiply(sm.getWorldMatrix());
    const bp = (b) => V3.TransformCoordinates(V3.Zero(), boneWorld(b));
    const fc = fistCenter(bp, bone, S_); if (!fc) return null;
    const { G, A, F, hb } = fc;

    const res = await B().SceneLoader.ImportMeshAsync(null, '', url, scene);
    const wroot = res.meshes[0]; const wmeshes = res.meshes.filter((m) => m.getTotalVertices && m.getTotalVertices() > 0);
    wroot.computeWorldMatrix(true);
    const wv = worldVerts(wmeshes, 30000);
    const lo = ['x', 'y', 'z'].map((k) => pct(wv.map((v) => v[k]), 0.005)), hi = ['x', 'y', 'z'].map((k) => pct(wv.map((v) => v[k]), 0.995));
    const c = new V3((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2);
    const ext = [0, 1, 2].map((i) => hi[i] - lo[i]); const ai = ext.indexOf(Math.max(...ext)); const len = ext[ai];
    const E = [new V3(1, 0, 0), new V3(0, 1, 0), new V3(0, 0, 1)]; const axis = E[ai];
    const ts = wv.map((v) => V3.Dot(v.subtract(c), axis) / len + 0.5);
    const rr = wv.map((v) => { const d = v.subtract(c); return d.subtract(axis.scale(V3.Dot(d, axis))).length(); });
    const rTop = pct(rr, 0.97), wideT = pct(ts.filter((t, i) => rr[i] >= rTop), 0.5);
    const hiltSign = (grip && grip.hiltEnd === 'min') ? -1 : (grip && grip.hiltEnd === 'max') ? 1 : (wideT < 0.5 ? -1 : 1);
    const u = (t) => (hiltSign > 0 ? t : 1 - t);                            // 0 = tip end, 1 = hilt end
    const others = [0, 1, 2].filter((i) => i !== ai);
    const thinI = ext[others[0]] <= ext[others[1]] ? others[0] : others[1]; const wideI = others.find((i) => i !== thinI);
    const scale = ((grip && grip.length) || MOVESET[kind].length) * H / len;
    const slice = (a, b) => wv.filter((_, i) => { const x = kind === 'bow' ? Math.abs(ts[i] - 0.5) : u(ts[i]); return x >= a && x <= b; });

    // the handle in the model: its axis h (toward the hilt end / up the bow) and the point the fist closes on
    let h, Pgrip, info = {}, thin = 1; const uM = H / 1.8;   // metres -> this scene's units (the village player is scaled)
    if (kind === 'bow') {
      const g = pca(slice(0, 0.07)); h = g.d; if (V3.Dot(h, axis) * hiltSign < 0) h = h.scale(-1);
      Pgrip = g.m;
      const gs = slice(0, 0.05); const rad = gs.map((p) => { const d = p.subtract(g.m); return d.subtract(h.scale(V3.Dot(d, h))).length(); });
      info = { handleR: +(pct(rad, 0.8) * scale).toFixed(4) };
      // a Meshy bow comes out chunky: slim it across its length so the grip fits a closed fist (about 4 cm across)
      thin = Math.min(1, 0.02 * uM / Math.max(1e-6, info.handleR)); info.handleR = +(info.handleR * thin).toFixed(4); info.thin = +thin.toFixed(2);
    } else {
      const uG = u(wideT);                                                   // the guard
      const hp = slice(uG + 0.03, 0.985);                                    // handle, guard excluded
      const g = pca(hp.length > 30 ? hp : slice(0.8, 0.99)); h = g.d; if (V3.Dot(h, axis) * hiltSign < 0) h = h.scale(-1);
      const guardPts = slice(uG - 0.01, uG + 0.01); const gc = guardPts.length ? pca(guardPts).m : c.add(axis.scale(hiltSign * (uG - 0.5) * len));
      const sG = V3.Dot(gc.subtract(g.m), h);                                // guard position on the handle line
      const sEnd = pct(hp.map((p) => V3.Dot(p.subtract(g.m), h)), 0.99);
      // right hand just behind the guard (half a fist + a little gap); a single-hand blade in the middle of its handle
      const fistHalf = (0.5 * fc.span * 1.25 + 0.006 * uM) / scale;
      const sGrip = kind === 'twin' ? (sG + sEnd) / 2 : Math.min(sG + fistHalf + 0.004 * uM / scale, (sG + sEnd) / 2 + 0.25 * (sEnd - sG));
      Pgrip = g.m.add(h.scale(sGrip));
      const rad = hp.map((p) => { const d = p.subtract(g.m); return d.subtract(h.scale(V3.Dot(d, h))).length(); });
      info = { handleLen: +((sEnd - sG) * scale).toFixed(3), gripFromGuard: +((sGrip - sG) * scale).toFixed(3), handleR: +(pct(rad, 0.8) * scale).toFixed(4) };
    }
    // the model's second axis: the blade's edge side (convex side of a curved blade) / the bow's string side
    let w2 = E[wideI].subtract(h.scale(V3.Dot(E[wideI], h))).normalize();
    if (kind === 'bow') {
      const tip = pca(wv.filter((_, i) => Math.abs(ts[i] - 0.5) > 0.44)).m;   // limb tips sit on the string side
      if (V3.Dot(tip.subtract(Pgrip), w2) < 0) w2 = w2.scale(-1);
    } else {
      const mid = slice(0.35, 0.55), bl = mid.length ? pca(mid).m : c;       // the blade bulges toward its edge
      const off = bl.subtract(Pgrip); off.subtractInPlace(h.scale(V3.Dot(off, h)));
      if (off.length() > 0.004 * len && V3.Dot(off, w2) < 0) w2 = w2.scale(-1);
    }
    const w3 = V3.Cross(h, w2).normalize();
    let bowPts = null;
    if (kind === 'bow') {
      // the model's string: the straight run of points furthest out on the string side across the middle of the bow
      const mid = wv.filter((_, i) => ts[i] > 0.2 && ts[i] < 0.8);
      const dmax = Math.max(...mid.map((p) => V3.Dot(p.subtract(Pgrip), w2)));
      const sp = mid.filter((p) => V3.Dot(p.subtract(Pgrip), w2) > dmax - 0.012 * len);
      const sl = pca(sp); let su = sl.d; if (V3.Dot(su, axis) < 0) su = su.scale(-1);
      const at = (tt) => { const k = ((tt - 0.5) * len - V3.Dot(sl.m.subtract(c), axis)) / Math.max(1e-6, V3.Dot(su, axis)); return sl.m.add(su.scale(k)); };
      const tA = at(0.035), tB = at(0.965);
      const ch = tB.subtract(tA), cl = ch.length(), cu = ch.scale(1 / cl);
      let cut = 0;
      for (const m of wmeshes) {
        const pos = m.getVerticesData(B().VertexBuffer.PositionKind), idx = m.getIndices(); if (!pos || !idx) continue;
        m.computeWorldMatrix(true); const W = m.getWorldMatrix();
        const onString = new Uint8Array(pos.length / 3);
        for (let i = 0; i < pos.length / 3; i++) {
          const p = V3.TransformCoordinates(new V3(pos[3 * i], pos[3 * i + 1], pos[3 * i + 2]), W).subtract(tA);
          const u = V3.Dot(p, cu) / cl, d = p.subtract(cu.scale(u * cl)).length();
          onString[i] = u > 0.08 && u < 0.92 && d < 0.01 * len ? 1 : 0;
        }
        const keep = [];
        for (let k = 0; k < idx.length; k += 3) { if (onString[idx[k]] && onString[idx[k + 1]] && onString[idx[k + 2]]) { cut++; continue; } keep.push(idx[k], idx[k + 1], idx[k + 2]); }
        if (keep.length < idx.length) m.setIndices(keep);
      }
      bowPts = { tipA: tA, tipB: tB, grip: Pgrip.clone(), up: h.clone(), cut };
    }

    // world frame: the handle's axis through the fist
    let D = kind === 'bow' ? A : A.scale(-1);                                // sword: the pommel leaves on the little-finger side
    if (handAxis && kind === 'sword' && hand === 'right' && !knuckle) D = V3.TransformNormal(handAxis.local, boneWorld(hb)).normalize();   // learnt: toward the other fist
    let Wt = F.subtract(D.scale(V3.Dot(F, D))).normalize();                 // blade edge: the way the knuckles point
    if (kind === 'bow') {
      const arrow = handAxis && hand === 'left' ? V3.TransformNormal(handAxis.local, boneWorld(hb)).normalize() : null;
      if (arrow) { D = A.subtract(arrow.scale(V3.Dot(A, arrow))).normalize(); Wt = arrow.subtract(D.scale(V3.Dot(arrow, D))).normalize(); }
    }
    const Tt = V3.Cross(D, Wt).normalize();
    const Mw = B().Matrix.FromValues(h.x, h.y, h.z, 0, w2.x, w2.y, w2.z, 0, w3.x, w3.y, w3.z, 0, 0, 0, 0, 1);
    const Mt = B().Matrix.FromValues(D.x, D.y, D.z, 0, Wt.x, Wt.y, Wt.z, 0, Tt.x, Tt.y, Tt.z, 0, 0, 0, 0, 1);
    const R = Mw.transpose().multiply(Mt);
    const pivot = new (B().TransformNode)('rebelHeld_' + hand, scene);
    pivot.setPreTransformMatrix(B().Matrix.Translation(G.x, G.y, G.z).multiply(B().Matrix.Invert(boneWorld(hb))));
    pivot.attachToBone(hb, sm); pivot.scalingDeterminant = 1;
    const inner = new (B().TransformNode)('rebelHeldInner', scene); inner.parent = pivot; wroot.parent = inner;
    let Sw = B().Matrix.Identity();
    if (thin < 1) { const k = thin, hh = [h.x, h.y, h.z], m = []; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) m.push((i === j ? k : 0) + (1 - k) * hh[i] * hh[j]);
      Sw = B().Matrix.FromValues(m[0], m[1], m[2], 0, m[3], m[4], m[5], 0, m[6], m[7], m[8], 0, 0, 0, 0, 1); }
    const innerLocal = B().Matrix.Translation(-Pgrip.x, -Pgrip.y, -Pgrip.z).multiply(Sw).multiply(R).multiply(B().Matrix.Scaling(scale, scale, scale));
    inner.setPreTransformMatrix(innerLocal);
    wmeshes.forEach((m) => { m.isPickable = false; m.alwaysSelectAsActiveMesh = true; if (m.material && onMaterial) onMaterial(m.material, m); });
    // the handle in the hand's own (drawn) frame, for the two-hand grip at run time
    const invH = B().Matrix.Invert(boneWorld(hb));
    const grip2 = kind === 'sword' ? { G: V3.TransformCoordinates(G, invH), D: V3.TransformNormal(D, invH).normalize(), a: V3.TransformNormal(A, invH).normalize(),
      sMin: fc.span * 1.25 + 0.012 * uM, sMax: Math.max(fc.span * 1.3, (info.handleLen || 0.2) - (info.gripFromGuard || 0.05) - 0.5 * fc.span * 1.1) } : null;
    const BW0 = boneWorld(hb).clone();
    // move the prop onto a new hole centre given in the hand's own frame (after the fingers are opened to fit it)
    const refit = (Glocal) => {
      const Gw = V3.TransformCoordinates(Glocal, BW0);
      pivot.setPreTransformMatrix(B().Matrix.Translation(Gw.x, Gw.y, Gw.z).multiply(B().Matrix.Invert(BW0)));
      if (grip2) grip2.G = Glocal.clone();
    };
    return { pivot, meshes: wmeshes, grip2, refit, hand: S_, inner, bowPts, info: { ...info, hole: +fc.hole.toFixed(4), joints: fc.fromJoints }, setEnabled(on) { pivot.setEnabled(on); }, dispose() { wmeshes.forEach((m) => m.dispose()); wroot.dispose(); inner.dispose(); pivot.dispose(); } };
  }
  // all the props a weapon puts in the hands when drawn: { right?: handle, left?: handle }, hidden until shown
  // alt: a sword worn with its hilt over the LEFT shoulder is drawn by the left hand (mirrored clip), so a second copy
  // sits in the left fist for the draw / sheathe and hands over to the right hand once both hands are on the hilt.
  async function holdAll({ scene, meshes, weapon, H, onMaterial, alt = false, groups }) {
    const kind = kindOf(weapon.id), out = {};
    const sm = meshes.find((m) => m.skeleton);
    const playing = scene.animationGroups.filter((g, i, a) => g && g.isPlaying && a.indexOf(g) === i);
    playing.forEach((g) => g.pause());
    // learn the handle line from the Rebel's own clips (sword: both fists; bow: the drawn arrow)
    let handAxis = null;
    if ((kind === 'sword' || kind === 'bow') && groups) {
      try {
        handAxis = kind === 'bow'
          ? handleAxis({ meshes, H, side: 'Left', pair: [0.25, 0.8], groups: ['bow_aim_idle', 'bow_aim', 'bow_shoot'].map((k) => groups[k]).filter(Boolean) })
          : handleAxis({ meshes, H, groups: ['sword_idle', 'sword_walk', 'sword_combo', 'sword_power_slash', 'sword_down_slash', 'sword_combo2'].map((k) => groups[k]).filter(Boolean) });
      } catch (e) { console.warn('handle axis', e); }
      console.log('RebelWeapon grip learnt from clips:', kind, handAxis ? handAxis.frames + ' frames' : 'no (default grip)');
    }
    // build the props with the hands closed as they are in the weapon clips (the fist's hole comes from the fingers)
    const probe = groups && (groups[kind === 'bow' ? 'bow_idle' : 'sword_idle']);
    const pose = () => { if (!probe || !sm) return; probe.play(false); probe.goToFrame(probe.from); let top = sm; while (top.parent) top = top.parent; [top, ...top.getDescendants(false)].forEach((x) => x.computeWorldMatrix && x.computeWorldMatrix(true)); sm.skeleton.prepare(true); };
    const list = Object.entries(weapon.held || {});
    if (alt && kind === 'sword' && weapon.held?.right) list.push(['alt', weapon.held.right]);
    for (const [key, p] of list) {
      const hand = key === 'alt' ? 'left' : key;
      try { pose(); const h = await hold({ scene, meshes, url: p.glbUrl, hand, kind, H, onMaterial, grip: p.grip, axis: handAxis, knuckle: kind === 'sword' && key === 'right' && !!handAxis }); if (h) { h.setEnabled(false); h.axis = handAxis; out[key] = h; } } catch (e) { console.warn('held prop', e); }
    }
    // open the curled fingers just enough to close on this handle's thickness (the grip pose is one size for all)
    try {
      if (probe && sm) {
        pose();
        const hands = kind === 'bow' ? [['Left', out.left]] : kind === 'twin' ? [['Right', out.right], ['Left', out.left]] : [['Right', out.right], ['Left', out.right]];
        Object.defineProperty(out, '_open', { value: {}, writable: true, enumerable: false });
        for (const [S_, h] of hands) { if (h && h.info && h.info.handleR) out._open[S_] = fingerFit(sm, S_, h.info.handleR + 0.0015 * H / 1.8); }
        // the hole centre moves as the fingers open: re-seat each prop on it
        for (const h of Object.values(out)) {
          if (!h || !h.refit || !(h.hand in out._open)) continue;
          const g = holeWith(sm, h.hand, out._open[h.hand]); if (g) h.refit(g);
        }
        console.log('RebelWeapon finger fit (deg open):', JSON.stringify(out._open));
      }
    } catch (e) { console.warn('finger fit', e); }
    if (probe) probe.stop();
    playing.forEach((g) => g.play(g.loopAnimation));
    Object.defineProperty(out, '_kind', { value: kind, writable: true, enumerable: false });
    return out;
  }
  const FINGERS = ['Index', 'Middle', 'Ring', 'Pinky'];
  function fingerTNs(skel, S_) { const out = []; for (const f of FINGERS) for (const i of [1, 2, 3]) { const b = node(skel.bones, S_ + 'Hand' + f + i); if (b && b.getTransformNode()) out.push(b.getTransformNode()); } return out; }
  function openFingers(tns, deg) { const q = B().Quaternion.RotationAxis(new (B().Vector3)(1, 0, 0), deg / 57.3); tns.forEach((tn) => { if (tn.rotationQuaternion) tn.rotationQuaternion = tn.rotationQuaternion.multiply(q); }); }
  function holeWith(sm, S_, deg) {
    const skel = sm.skeleton, tns = fingerTNs(skel, S_), V3 = B().Vector3, bone = (n) => node(skel.bones, n);
    const BW = (b) => b.getFinalMatrix().multiply(sm.getWorldMatrix()); const bp = (b) => V3.TransformCoordinates(V3.Zero(), BW(b));
    const q0 = tns.map((tn) => tn.rotationQuaternion && tn.rotationQuaternion.clone());
    openFingers(tns, deg); let top = sm; while (top.parent) top = top.parent; [top, ...top.getDescendants(false)].forEach((x) => x.computeWorldMatrix && x.computeWorldMatrix(true)); skel.prepare(true);
    const f = fistCenter(bp, bone, S_); const g = f && f.fromJoints ? V3.TransformCoordinates(f.G, B().Matrix.Invert(BW(f.hb))) : null;
    tns.forEach((tn, i) => { if (q0[i]) tn.rotationQuaternion = q0[i]; }); [top, ...top.getDescendants(false)].forEach((x) => x.computeWorldMatrix && x.computeWorldMatrix(true)); skel.prepare(true);
    return g;
  }
  function fingerFit(sm, S_, wantR) {
    const skel = sm.skeleton, tns = fingerTNs(skel, S_), V3 = B().Vector3;
    const bp = (b) => V3.TransformCoordinates(V3.Zero(), b.getFinalMatrix().multiply(sm.getWorldMatrix()));
    const bone = (n) => node(skel.bones, n);
    const q0 = tns.map((tn) => tn.rotationQuaternion && tn.rotationQuaternion.clone());
    const hole = (deg) => { tns.forEach((tn, i) => { if (q0[i]) tn.rotationQuaternion = q0[i].clone(); }); openFingers(tns, deg); tns.forEach((tn) => tn.computeWorldMatrix(true)); let top = sm; while (top.parent) top = top.parent; [top, ...top.getDescendants(false)].forEach((x) => x.computeWorldMatrix && x.computeWorldMatrix(true)); skel.prepare(true); const f = fistCenter(bp, bone, S_); return f && f.fromJoints ? f.hole : null; };
    let best = 0, bestErr = 1e9;
    const h0 = hole(0), h1 = hole(6);
    const sgn = h0 != null && h1 != null && h1 < h0 ? -1 : 1;              // whichever way opens the fist
    for (let d = 0; d <= 14; d += 2) { const r = hole(sgn * d); if (r == null) continue; const e = Math.abs(r - wantR); if (e < bestErr) { bestErr = e; best = sgn * d; } if (r > wantR) break; }
    tns.forEach((tn, i) => { if (q0[i]) tn.rotationQuaternion = q0[i]; }); skel.prepare(true);
    return best;
  }
  // which props show: 'none' (on the back), 'main' (drawn), 'alt' (the left-hand copy while drawing / sheathing left)
  function showHeld(held, back, set, mode) {
    if (held) Object.defineProperty(held, '_mode', { value: mode, writable: true, configurable: true, enumerable: false });
    Object.entries(held || {}).forEach(([k, h]) => h.setEnabled(mode === 'alt' ? (k === 'alt' || !held.alt) : mode === 'main' ? k !== 'alt' : false));
    if (back && set && set.hideBack) back.pivot.setEnabled(mode === 'none');
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Two-handed sword grip at run time (after the clips are applied each frame):
  //  1. the right wrist turns so the knuckles run along the handle line the clips intend (learnt axis), and the sword
  //     (built along the knuckles) follows it;
  //  2. the left arm reaches the handle (two-bone IK) and the left fist turns onto it, whenever the clip has the left
  //     hand near the hilt; it lets go smoothly when the clip takes it away (one-handed swings).
  // Everything is measured where the body is drawn (bone x skinned mesh) and applied to the bones' transform nodes.
  function twoHand({ scene, meshes, held, H = 1.8 }) {
    const V3 = B().Vector3, M = B().Matrix, Q = B().Quaternion;
    if (!held) return null;
    const sm = meshes.find((m) => m.skeleton); if (!sm) return null;
    const skel = sm.skeleton; const bone = (n) => node(skel.bones, n);
    const R0 = held.right && held.right.grip2 && held.right.axis && held._kind === 'sword' ? held.right : null;
    const open = held._open || {};
    const fing = { Right: fingerTNs(skel, 'Right'), Left: fingerTNs(skel, 'Left') };
    const bs = { rh: bone('RightHand'), la: bone('LeftArm'), lf: bone('LeftForeArm'), lh: bone('LeftHand') }; const lcB = bone('LeftShoulder');
    if (Object.values(bs).some((b) => !b || !b.getTransformNode())) return null;
    if (lcB && lcB.getTransformNode()) bs.lc = lcB;
    const setFingers = (S_, deg) => { if (!deg) return; for (const tn of fing[S_]) { if (!touched.has(tn)) touched.set(tn, { q0: tn.rotationQuaternion.clone(), p0: tn.position.clone() }); } openFingers(fing[S_], deg); for (const tn of fing[S_]) touched.get(tn).q1 = tn.rotationQuaternion.clone(); };
    const drawnW = (b) => b.getFinalMatrix().multiply(sm.getWorldMatrix());
    const pos = (b) => V3.TransformCoordinates(V3.Zero(), drawnW(b));
    const refresh = (b) => { const tn = b.getTransformNode(); [tn, ...tn.getDescendants(false)].forEach((x) => x.computeWorldMatrix && x.computeWorldMatrix(true)); skel.prepare(true); };
    function rotBetween(a, b) { const c = V3.Cross(a, b), d = V3.Dot(a, b); if (c.length() < 1e-8) return d > 0 ? M.Identity() : null; return M.RotationAxis(c.normalize(), Math.acos(Math.max(-1, Math.min(1, d)))); }
    // rotate bone b's transform node by the drawn-space rotation Rm about drawn point p
    function turn(b, Rm, p) {
      const tn = b.getTransformNode(); const W = tn.getWorldMatrix().clone();
      const K = M.Invert(W).multiply(drawnW(b));                           // drawn = tnWorld * K (same K for the whole body)
      const Dm = M.Translation(-p.x, -p.y, -p.z).multiply(Rm).multiply(M.Translation(p.x, p.y, p.z));
      const Wn = W.multiply(K).multiply(Dm).multiply(M.Invert(K));
      const Pw = tn.parent ? tn.parent.getWorldMatrix() : M.Identity();
      const L = Wn.multiply(M.Invert(Pw)); const sc = new V3(), q = new Q(), tr = new V3(); L.decompose(sc, q, tr);
      if (!touched.has(tn)) touched.set(tn, { q0: (tn.rotationQuaternion || Q.FromEulerVector(tn.rotation)).clone(), p0: tn.position.clone() });
      tn.rotationQuaternion = q; tn.position.copyFrom(tr); touched.get(tn).q1 = q.clone(); refresh(b);
    }
    // a paused clip does not rewrite the bones: put back what the clip set, so the corrections never pile up
    const touched = new Map();
    function restore() {
      let any = false;
      for (const [tn, s] of touched) {
        const q = tn.rotationQuaternion;
        if (q && s.q1 && Math.abs(q.x - s.q1.x) + Math.abs(q.y - s.q1.y) + Math.abs(q.z - s.q1.z) + Math.abs(q.w - s.q1.w) < 1e-7) { tn.rotationQuaternion = s.q0.clone(); tn.position.copyFrom(s.p0); any = true; }
      }
      touched.clear();
      if (any) { [bs.lc || bs.la, bs.rh].forEach(refresh); }
    }
    const slerpM = (Rm, w) => { const q = new Q(); Rm.decompose(undefined, q); const q2 = Q.Slerp(Q.Identity(), q, w); const out = new M(); M.FromQuaternionToRef(q2, out); return out; };
    const cap = (a, b, deg) => { const ang = Math.acos(Math.max(-1, Math.min(1, V3.Dot(a, b)))); if (ang * 57.3 <= deg) return b; const ax = V3.Cross(a, b).normalize(); return V3.TransformNormal(a, M.RotationAxis(ax, deg / 57.3)).normalize(); };
    const bp = (b) => pos(b);
    let wR = 0, wL = 0, on = false;
    const obs = scene.onAfterAnimationsObservable.add(() => {
      restore();
      // fingers closed on the handle(s) actually in the hands
      const mode = held._mode;
      if (mode === 'main' || mode === 'alt') {
        const hands = mode === 'alt' ? ['Left'] : held._kind === 'bow' ? ['Left'] : ['Right', 'Left'];
        hands.forEach((S_) => setFingers(S_, open[S_] || 0)); if (hands.length) [bs.rh, bs.lh].forEach(refresh);
      }
      if (!R0) return;
      const want = mode === 'main';
      wR += ((want ? 1 : 0) - wR) * 0.25; if (!want && wR < 0.01) { wR = 0; wL = 0; return; }
      skel.prepare(true);
      // 1. right wrist onto the learnt line
      const HR = drawnW(bs.rh); const pR = pos(bs.rh);
      const ell = V3.TransformNormal(R0.axis.local, HR).normalize(), aR = V3.TransformNormal(R0.grip2.a, HR).normalize().scale(-1);
      const Rr = rotBetween(aR, cap(aR, ell, 40)); if (Rr) turn(bs.rh, slerpM(Rr, wR), pR);
      // the handle now: through the right fist's hole along the sword
      const HR2 = drawnW(bs.rh); const G = V3.TransformCoordinates(R0.grip2.G, HR2), D = V3.TransformNormal(R0.grip2.D, HR2).normalize();
      // 2. left hand onto the handle when the clip has it near
      const L0 = fistCenter(bp, bone, 'Left'); if (!L0) return;
      const v = L0.G.subtract(G); const along = V3.Dot(v, D), perp = v.subtract(D.scale(along)).length();
      // the great-sword clips are two-handed throughout; retargeting drifts the left fist up to ~20 cm off the hilt,
      // so it is pulled back whenever it is within reach of the hilt, and let go only when the clip takes it far away
      const dist = V3.Distance(L0.G, G.add(D.scale(Math.max(R0.grip2.sMin, Math.min(R0.grip2.sMax, along)))));
      const near = dist < 0.13 * H ? 1 : dist > 0.2 * H ? 0 : 1 - (dist - 0.13 * H) / (0.07 * H);
      wL += (near * wR - wL) * 0.3; dbg.before = perp; dbg.along = along; dbg.w = wL; dbg.after = null; if (wL < 0.01) return;
      let P = G.add(D.scale(Math.max(R0.grip2.sMin, Math.min(R0.grip2.sMax, along))));
      for (let it = 0; it < 3; it++) {
        // turn the fist onto the handle (index toward the blade)
        const L1 = fistCenter(bp, bone, 'Left'); const Rl = rotBetween(L1.A, D.scale(-1)); if (Rl) turn(bs.lh, slerpM(Rl, wL), pos(bs.lh));
        const L2 = fistCenter(bp, bone, 'Left'); const target = V3.Lerp(L2.G, P, wL).subtract(L2.G.subtract(pos(bs.lh)));   // wrist target
        // out of reach: the collarbone swings the shoulder toward the target (up to 25 deg), like a real reach
        if (bs.lc) {
          const S0 = pos(bs.la), armLen = V3.Distance(S0, pos(bs.lf)) + V3.Distance(pos(bs.lf), pos(bs.lh));
          const over = V3.Distance(S0, target) - armLen * 0.97;
          if (over > 0) { const C = pos(bs.lc), a0 = S0.subtract(C).normalize(), a1 = target.subtract(C).normalize(); const Rc = rotBetween(a0, cap(a0, a1, 25)); if (Rc) turn(bs.lc, slerpM(Rc, Math.min(1, over / (0.08 * H)) * wL), C); }
        }
        // two-bone IK: shoulder S, elbow E, wrist Wr
        const S = pos(bs.la), E = pos(bs.lf), Wr = pos(bs.lh);
        const a = V3.Distance(S, E), b2 = V3.Distance(E, Wr); let tv = target.subtract(S); const c = Math.max(1e-4, Math.min(a + b2 - 1e-4, tv.length())); const u = tv.normalize();
        let n = E.subtract(S); n.subtractInPlace(u.scale(V3.Dot(n, u))); if (n.length() < 1e-6) n = new V3(0, -1, 0); n.normalize();
        const x = (a * a - b2 * b2 + c * c) / (2 * c), y = Math.sqrt(Math.max(0, a * a - x * x));
        const E2 = S.add(u.scale(x)).add(n.scale(y));
        const R1 = rotBetween(E.subtract(S).normalize(), E2.subtract(S).normalize()); if (R1) turn(bs.la, R1, S);
        const E3 = pos(bs.lf), W3 = pos(bs.lh);
        const R2 = rotBetween(W3.subtract(E3).normalize(), S.add(u.scale(c)).subtract(E3).normalize()); if (R2) turn(bs.lf, R2, E3);
      }
      const L3 = fistCenter(bp, bone, 'Left'); const Rl = rotBetween(L3.A, D.scale(-1)); if (Rl) turn(bs.lh, slerpM(Rl, wL), pos(bs.lh));
      const L4 = fistCenter(bp, bone, 'Left'), v4 = L4.G.subtract(G); dbg.after = v4.subtract(D.scale(V3.Dot(v4, D))).length(); dbg.ang = Math.acos(Math.min(1, Math.abs(V3.Dot(L4.A, D)))) * 57.3;
    });
    const dbg = {};
    return { dispose() { scene.onAfterAnimationsObservable.remove(obs); restore(); }, dbg, settle(n = 12) { for (let i = 0; i < n; i++) scene.render(); } };
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Real arrows (Dawn's Light): a live bowstring (the model's own string is cut out) that the drawing hand pulls back,
  // an arrow taken from the quiver on Nock, laid on the string while drawing, and loosed on Loose: it flies with
  // gravity and sticks where it hits. clip() -> { name, frac } of the clip playing now.
  function archer({ scene, meshes, held, back, H = 1.8, clip, ignore = () => false, onRelease }) {
    const V3 = B().Vector3, M = B().Matrix, Q = B().Quaternion;
    const bow = held && held.left; if (!bow || !bow.bowPts) return null;
    const sm = meshes.find((m) => m.skeleton); if (!sm) return null;
    const skel = sm.skeleton; const bone = (n) => node(skel.bones, n);
    const BW = (b) => b.getFinalMatrix().multiply(sm.getWorldMatrix()); const bp = (b) => V3.TransformCoordinates(V3.Zero(), BW(b));
    const pinchB = ['RightHandIndex2', 'RightHandMiddle2'].map(bone).filter(Boolean);
    if (!pinchB.length) return null;
    const mat = (n, c, spec = 0.1) => { const m = new (B().StandardMaterial)(n, scene); m.diffuseColor = new (B().Color3)(...c); m.specularColor = new (B().Color3)(spec, spec, spec); m.maxSimultaneousLights = 4; return m; };
    // the string: two thin rods
    const sMat = mat('rebelBowString', [0.05, 0.04, 0.035]);
    const rods = [0, 1].map((i) => { const r = B().MeshBuilder.CreateCylinder('rebelBowString' + i, { height: 1, diameter: 0.0045 * H, tessellation: 5 }, scene); r.material = sMat; r.isPickable = false; r.setEnabled(false); return r; });
    const setRod = (r, a, b) => { const d = b.subtract(a), l = d.length(); r.position.copyFrom(a.add(b).scale(0.5)); r.scaling.set(1, Math.max(1e-4, l), 1); r.rotationQuaternion = quatY(d.scale(1 / Math.max(1e-6, l))); };
    function quatY(dir) { const y = new V3(0, 1, 0), c = V3.Cross(y, dir), d = V3.Dot(y, dir); if (c.length() < 1e-6) return d > 0 ? Q.Identity() : Q.RotationAxis(new V3(1, 0, 0), Math.PI); return Q.RotationAxis(c.normalize(), Math.acos(Math.max(-1, Math.min(1, d)))); }
    // the arrow: shaft, steel head, black fletching (like the quiver's), +Y from the nock to the tip
    const AL = 0.42 * H;
    const proto = new (B().TransformNode)('rebelArrowProto', scene);
    const shaft = B().MeshBuilder.CreateCylinder('rebelArrowShaft', { height: AL * 0.9, diameter: 0.009 * H, tessellation: 6 }, scene); shaft.position.y = AL * 0.45; shaft.material = mat('rebelArrowWood', [0.3, 0.2, 0.12]);
    const head = B().MeshBuilder.CreateCylinder('rebelArrowHead', { height: AL * 0.1, diameterTop: 0, diameterBottom: 0.026 * H, tessellation: 4 }, scene); head.position.y = AL * 0.95; head.material = mat('rebelArrowSteel', [0.62, 0.64, 0.68], 0.6);
    const fMat = mat('rebelArrowFeather', [0.06, 0.06, 0.07]); fMat.backFaceCulling = false;
    for (let i = 0; i < 3; i++) { const f = B().MeshBuilder.CreatePlane('rebelArrowFletch' + i, { width: 0.022 * H, height: AL * 0.14 }, scene); f.position.y = AL * 0.1; f.rotation.y = i * 2 * Math.PI / 3; f.position.x = Math.sin(i * 2 * Math.PI / 3) * 0.011 * H; f.position.z = Math.cos(i * 2 * Math.PI / 3) * 0.011 * H; f.rotation.y += Math.PI / 2; f.material = fMat; f.parent = proto; }
    [shaft, head].forEach((m) => { m.parent = proto; });
    proto.getChildMeshes().forEach((m) => { m.isPickable = false; m.alwaysSelectAsActiveMesh = true; });
    proto.setEnabled(false);
    const inHand = proto.instantiateHierarchy(null, { doNotInstantiate: true }, (s, c) => { c.name = 'rebelArrowNocked'; }); inHand.setEnabled(false);
    const place = (n, nock, dir) => { n.position.copyFrom(nock); n.rotationQuaternion = quatY(dir); };
    const flying = [];
    let state = 'none', hooked = false, lastClip = null, fired = false;
    const DRAW = new Set(['bow_aim', 'bow_aim_idle', 'bow_shoot', 'bow_nock']);
    const obs = scene.onAfterAnimationsObservable.add(() => {
      const dt = Math.min(0.05, scene.getEngine().getDeltaTime() / 1000 || 0.016);
      // flights
      for (let i = flying.length - 1; i >= 0; i--) {
        const f = flying[i]; f.t += dt;
        if (f.stuck) { if (f.t > 8) { f.n.dispose(); flying.splice(i, 1); } continue; }
        const p0 = f.n.position.clone(); f.v.y -= 5.4 * H * dt; const p1 = p0.add(f.v.scale(dt)); const dir = f.v.normalizeToNew();
        const tip0 = p0.add(dir.scale(AL)), step = p1.subtract(p0);
        const hit = scene.pickWithRay(new (B().Ray)(tip0, step.normalizeToNew(), step.length()), (m) => m.isPickable && m.isEnabled() && m.isVisible && !/^rebelArrow|^rebelBow/.test(m.name) && !ignore(m));
        if (hit && hit.hit) { f.n.position.copyFrom(hit.pickedPoint.subtract(dir.scale(AL * 0.88))); f.n.rotationQuaternion = quatY(dir); f.stuck = true; f.t = 0; continue; }
        f.n.position.copyFrom(p1); f.n.rotationQuaternion = quatY(dir);
        if (f.t > 3) { f.n.dispose(); flying.splice(i, 1); }
      }
      const shown = held._mode === 'main' && bow.pivot.isEnabled();
      if (!shown) { rods.forEach((r) => r.setEnabled(false)); inHand.setEnabled(false); state = 'none'; hooked = false; return; }
      // the bow in the world now
      const Wi = bow.inner.getWorldMatrix();
      const tA = V3.TransformCoordinates(bow.bowPts.tipA, Wi), tB = V3.TransformCoordinates(bow.bowPts.tipB, Wi);
      const grip = V3.TransformCoordinates(bow.bowPts.grip, Wi), upB = V3.TransformNormal(bow.bowPts.up, Wi).normalize();
      const restPt = grip.add(upB.scale(0.035 * H));                       // the arrow rests on top of the bow hand
      const cu = tB.subtract(tA).normalize(); const nock0 = tA.add(cu.scale(V3.Dot(restPt.subtract(tA), cu)));   // brace-height nock point
      const pinch = pinchB.map(bp).reduce((a, v) => a.addInPlace(v), V3.Zero()).scale(1 / pinchB.length);
      const c = clip() || {}; const name = c.name || '', frac = c.frac || 0;
      if (name !== lastClip) { fired = false; if (!DRAW.has(name)) { hooked = false; state = 'none'; } lastClip = name; }
      // the drawing hand takes the string when it comes to the nock point, and keeps it until the loose
      const backOff = V3.Dot(pinch.subtract(nock0), restPt.subtract(nock0).normalize());   // < 0 = pulled toward the archer
      // hooked: a drawing clip, the hand behind the string, near the bow's plane and within an arrow's length of the rest
      const aDir = restPt.subtract(nock0).normalize(), nPl = V3.Cross(cu, aDir).normalize();
      const canHook = backOff < 0.02 * H && Math.abs(V3.Dot(pinch.subtract(restPt), nPl)) < 0.14 * H && V3.Distance(pinch, restPt) < AL * 1.02;
      if (!hooked && !fired && canHook && ((name === 'bow_aim' || name === 'bow_aim_idle' || name === 'bow_shoot') || (name === 'bow_nock' && frac > 0.7))) hooked = true;
      if (!hooked && !fired && name === 'bow_shoot' && frac < 0.08) hooked = true;          // a loose starts at full draw
      if (hooked && (V3.Distance(pinch, restPt) > AL * 1.05 || backOff > 0.05 * H)) hooked = false;
      if (name === 'bow_nock' && frac > 0.3 && state === 'none') state = 'hand';
      if (hooked && state !== 'flying') state = 'nocked';
      // loose
      if (name === 'bow_shoot' && frac >= 0.08 && !fired && state === 'nocked') {
        fired = true; hooked = false; state = 'none';
        const dir = restPt.subtract(pinch).normalize(); const n = proto.instantiateHierarchy(null, { doNotInstantiate: true }, (s, cl) => { cl.name = 'rebelArrowFly'; });
        n.setEnabled(true); place(n, pinch, dir); flying.push({ n, v: dir.scale(25 * H), t: 0, stuck: false });
        if (flying.length > 10) { const o = flying.shift(); o.n.dispose(); }
        if (onRelease) onRelease();
      }
      const nock = hooked ? pinch : nock0;
      rods.forEach((r) => r.setEnabled(true)); setRod(rods[0], tA, nock); setRod(rods[1], nock, tB);
      if (state === 'nocked') { inHand.setEnabled(true); place(inHand, nock, restPt.subtract(nock).normalize()); }
      else if (state === 'hand') {
        const out = back && back.outDir ? back.outDir() : upB; const toBow = restPt.subtract(pinch).normalize();
        const k = Math.max(0, Math.min(1, Math.max(1 - V3.Distance(pinch, restPt) / (0.45 * H), name === 'bow_nock' ? (frac - 0.45) / 0.3 : 0)));
        inHand.setEnabled(true); place(inHand, pinch, V3.Lerp(out.scale(-1), toBow, k).normalize());   // out of the quiver, then onto the bow
      } else inHand.setEnabled(false);
    });
    return { dispose() { scene.onAfterAnimationsObservable.remove(obs); rods.forEach((r) => r.dispose()); inHand.dispose(); proto.dispose(); flying.forEach((f) => f.n.dispose()); }, flying, get state() { return state; } };
  }

  window.RebelWeapon = { attach, resolve, fromTrait, catalog, MOVESET, MOVE_NAMES, kindOf, movesFor, loadMoves, hold, holdAll, showHeld, twoHand, archer, _fist: fistCenter };
})();
