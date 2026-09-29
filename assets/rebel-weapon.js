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
    return { pivot, meshes: wmeshes, info: { H, depth, len, hiltSign, ai }, dispose() { wmeshes.forEach((m) => m.dispose()); wroot.dispose(); inner.dispose(); pivot.dispose(); } };
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
  function fistCenter(bp, bone, S_) {
    const V3 = B().Vector3;
    const hb = bone(S_ + 'Hand'), ib = bone(S_ + 'HandIndex1'), pb = bone(S_ + 'HandPinky1'), mb = bone(S_ + 'HandMiddle1'), tb = bone(S_ + 'HandThumb1');
    if (!hb || !ib || !pb || !mb) return null;
    const Ph = bp(hb), A = bp(ib).subtract(bp(pb)).normalize();
    let F = bp(mb).subtract(Ph); F.subtractInPlace(A.scale(V3.Dot(F, A))); const hl = F.length(); F.normalize();
    let Np = V3.Cross(F, A).normalize(); if (tb) { const q = bp(tb).subtract(Ph); if (V3.Dot(q, Np) < 0) Np = Np.scale(-1); }
    return { G: Ph.add(F.scale(0.78 * hl)).add(Np.scale(0.42 * hl)), A, F, Np, hl, hb };
  }
  // side: the hand whose frame the line is stored in; pair: [min, max] fist distance (fractions of H) to count a frame.
  // Swords: right hand, fists 2-14 % of H apart (both on the hilt). Bow: left hand, fists > 25 % apart (string drawn):
  // the line is the arrow, so the bow stands across it with the string toward the drawing hand.
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
  async function hold({ scene, meshes, url, hand = 'right', kind = 'sword', H = 1.8, onMaterial, grip, axis: handAxis }) {
    const V3 = B().Vector3;
    const sm = meshes.find((m) => m.skeleton); if (!sm) return null;
    const skel = sm.skeleton; const bone = (n) => node(skel.bones, n);
    const S_ = hand === 'left' ? 'Left' : 'Right';
    const hb = bone(S_ + 'Hand'), ib = bone(S_ + 'HandIndex1'), pb = bone(S_ + 'HandPinky1'), mb = bone(S_ + 'HandMiddle1'), tb = bone(S_ + 'HandThumb1');
    if (!hb || !ib || !pb || !mb) return null;
    skel.prepare(true);
    const boneWorld = (b) => b.getFinalMatrix().multiply(sm.getWorldMatrix());
    const bp = (b) => V3.TransformCoordinates(V3.Zero(), boneWorld(b));
    const Ph = bp(hb), Pi = bp(ib), Pp = bp(pb), Pm = bp(mb);
    const A = Pi.subtract(Pp).normalize();                                  // across the knuckles, toward the index finger
    let F = Pm.subtract(Ph); F.subtractInPlace(A.scale(V3.Dot(F, A))); const hl = F.length(); F.normalize();   // along the hand
    let Np = V3.Cross(F, A).normalize();                                     // palm normal (sign from the thumb)
    if (tb) { const t = bp(tb).subtract(Ph); if (V3.Dot(t, Np) < 0) Np = Np.scale(-1); }
    const g = { along: 0.78, palm: 0.42, slide: 0, ...(grip || {}) };
    const G = Ph.add(F.scale(g.along * hl)).add(Np.scale(g.palm * hl)).add(A.scale(g.slide * hl));   // the middle of the closed fist

    const res = await B().SceneLoader.ImportMeshAsync(null, '', url, scene);
    const wroot = res.meshes[0]; const wmeshes = res.meshes.filter((m) => m.getTotalVertices && m.getTotalVertices() > 0);
    wroot.computeWorldMatrix(true);
    const wv = worldVerts(wmeshes, 20000);
    const lo = ['x', 'y', 'z'].map((k) => pct(wv.map((v) => v[k]), 0.005)), hi = ['x', 'y', 'z'].map((k) => pct(wv.map((v) => v[k]), 0.995));
    const c = new V3((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2);
    const ext = [0, 1, 2].map((i) => hi[i] - lo[i]); const ai = ext.indexOf(Math.max(...ext)); const len = ext[ai];
    const E = [new V3(1, 0, 0), new V3(0, 1, 0), new V3(0, 0, 1)]; const axis = E[ai];
    const ts = wv.map((v) => V3.Dot(v.subtract(c), axis) / len + 0.5);
    const rr = wv.map((v) => { const d = v.subtract(c); return d.subtract(axis.scale(V3.Dot(d, axis))).length(); });
    const rTop = pct(rr, 0.97), wideT = pct(ts.filter((t, i) => rr[i] >= rTop), 0.5);
    const hiltSign = (grip && grip.hiltEnd === 'min') ? -1 : (grip && grip.hiltEnd === 'max') ? 1 : (wideT < 0.5 ? -1 : 1);   // the guard is the widest slice
    const others = [0, 1, 2].filter((i) => i !== ai);
    const thinI = ext[others[0]] <= ext[others[1]] ? others[0] : others[1]; const wideI = others.find((i) => i !== thinI);
    const scale = ((grip && grip.length) || MOVESET[kind].length) * H / len;
    // where along the prop the fist closes: a sword on its handle (just behind the guard), a bow in its middle
    const gripT = kind === 'bow' ? 0 : ((grip && grip.at) || 0.28);        // 0 = middle, 0.5 = the hilt end
    const Pgrip = c.add(axis.scale(hiltSign * gripT * len));
    // target frame: the prop's long axis runs through the fist across the knuckles; the blade leaves on the index side
    let D = kind === 'bow' ? A : A.scale(-1);                                // world direction of the prop's hilt end
    if (handAxis && kind === 'sword' && hand === 'right') D = V3.TransformNormal(handAxis.local, boneWorld(hb)).normalize();   // learnt: toward the other fist
    let arrow = null;
    if (handAxis && kind === 'bow' && hand === 'left') { arrow = V3.TransformNormal(handAxis.local, boneWorld(hb)).normalize(); D = A.subtract(arrow.scale(V3.Dot(A, arrow))).normalize(); }
    let Wt = F.subtract(D.scale(V3.Dot(F, D))).normalize(), wSign = 1;      // a blade's edge runs along the hand
    if (kind === 'bow') {
      // the string faces the archer: the limb tips (the ends) sit on the string side of the bow's depth
      if (arrow) Wt = arrow.clone();                                        // learnt: the string faces the drawing hand
      else { const sp2 = bone('Spine2'); if (sp2) { Wt = bp(sp2).subtract(G); Wt.subtractInPlace(D.scale(V3.Dot(Wt, D))); Wt.normalize(); } }
      const wa = E[wideI]; const wc = (sel) => { const v = wv.filter((_, i) => sel(Math.abs(ts[i] - 0.5))).map((p) => V3.Dot(p.subtract(c), wa)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0; };
      wSign = wc((d) => d > 0.42) >= wc((d) => d < 0.06) ? 1 : -1;
    }
    let T = V3.Cross(D, Wt).normalize();
    const L = E[ai].scale(hiltSign), Wd = E[wideI].scale(wSign), Th = E[thinI];
    const Mw = B().Matrix.FromValues(L.x, L.y, L.z, 0, Wd.x, Wd.y, Wd.z, 0, Th.x, Th.y, Th.z, 0, 0, 0, 0, 1);
    let Mt = B().Matrix.FromValues(D.x, D.y, D.z, 0, Wt.x, Wt.y, Wt.z, 0, T.x, T.y, T.z, 0, 0, 0, 0, 1);
    let R = Mw.transpose().multiply(Mt);
    if (R.determinant() < 0) { T = T.scale(-1); Mt = B().Matrix.FromValues(D.x, D.y, D.z, 0, Wt.x, Wt.y, Wt.z, 0, T.x, T.y, T.z, 0, 0, 0, 0, 1); R = Mw.transpose().multiply(Mt); }
    const pivot = new (B().TransformNode)('rebelHeld_' + hand, scene);
    pivot.setPreTransformMatrix(B().Matrix.Translation(G.x, G.y, G.z).multiply(B().Matrix.Invert(boneWorld(hb))));
    pivot.attachToBone(hb, sm); pivot.scalingDeterminant = 1;
    const inner = new (B().TransformNode)('rebelHeldInner', scene); inner.parent = pivot; wroot.parent = inner;
    const innerLocal = B().Matrix.Translation(-Pgrip.x, -Pgrip.y, -Pgrip.z).multiply(R).multiply(B().Matrix.Scaling(scale, scale, scale));
    inner.rotationQuaternion = new (B().Quaternion)(); innerLocal.decompose(inner.scaling, inner.rotationQuaternion, inner.position);
    wmeshes.forEach((m) => { m.isPickable = false; m.alwaysSelectAsActiveMesh = true; if (m.material && onMaterial) onMaterial(m.material, m); });
    return { pivot, meshes: wmeshes, setEnabled(on) { pivot.setEnabled(on); }, dispose() { wmeshes.forEach((m) => m.dispose()); wroot.dispose(); inner.dispose(); pivot.dispose(); } };
  }
  // all the props a weapon puts in the hands when drawn: { right?: handle, left?: handle }, hidden until shown
  // alt: a sword worn with its hilt over the LEFT shoulder is drawn by the left hand (mirrored clip), so a second copy
  // sits in the left fist for the draw / sheathe and hands over to the right hand once both hands are on the hilt.
  async function holdAll({ scene, meshes, weapon, H, onMaterial, alt = false, groups }) {
    const kind = kindOf(weapon.id), out = {};
    // learn the two-handed handle line from the sword clips (stance, walk, slashes), with everything else paused
    let handAxis = null;
    if ((kind === 'sword' || kind === 'bow') && groups) {
      const playing = Object.values(groups).concat(scene.animationGroups).filter((g, i, a) => g && g.isPlaying && a.indexOf(g) === i);
      playing.forEach((g) => g.pause());
      try {
        handAxis = kind === 'bow'
          ? handleAxis({ meshes, H, side: 'Left', pair: [0.25, 0.8], groups: ['bow_aim_idle', 'bow_aim', 'bow_shoot'].map((k) => groups[k]).filter(Boolean) })
          : handleAxis({ meshes, H, groups: ['sword_idle', 'sword_walk', 'sword_combo', 'sword_power_slash', 'sword_down_slash', 'sword_combo2'].map((k) => groups[k]).filter(Boolean) });
      } catch (e) { console.warn('handle axis', e); }
      playing.forEach((g) => g.play(g.loopAnimation));
      console.log('RebelWeapon grip learnt from clips:', kind, handAxis ? handAxis.frames + ' frames' : 'no (default grip)');
    }
    const list = Object.entries(weapon.held || {});
    if (alt && kind === 'sword' && weapon.held?.right) list.push(['alt', weapon.held.right]);
    for (const [key, p] of list) {
      const hand = key === 'alt' ? 'left' : key;
      try { const h = await hold({ scene, meshes, url: p.glbUrl, hand, kind, H, onMaterial, grip: p.grip, axis: handAxis }); if (h) { h.setEnabled(false); h.axis = handAxis; out[key] = h; } } catch (e) { console.warn('held prop', e); }
    }
    return out;
  }
  // which props show: 'none' (on the back), 'main' (drawn), 'alt' (the left-hand copy while drawing / sheathing left)
  function showHeld(held, back, set, mode) {
    Object.entries(held || {}).forEach(([k, h]) => h.setEnabled(mode === 'alt' ? (k === 'alt' || !held.alt) : mode === 'main' ? k !== 'alt' : false));
    if (back && set && set.hideBack) back.pivot.setEnabled(mode === 'none');
  }

  window.RebelWeapon = { attach, resolve, fromTrait, catalog, MOVESET, MOVE_NAMES, kindOf, movesFor, loadMoves, hold, holdAll, showHeld };
})();
