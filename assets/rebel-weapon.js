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
  // Tuned on #4 against the NFT art: the hilt rises beside the head over one shoulder.
  const MOUNT = { length: 0.52, angle: 24, out: 0.012, up: 0.07, hiltEnd: 'auto' };
  const KIND = { dawns_light_arrows: { length: 0.4, angle: 20, up: 0.09 }, celestial_fang: { length: 0.46, up: 0.08 } };

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
    // only this Rebel's own bones (the village has other rigged characters)
    const base = root || meshes[0];
    const nodes = base ? [base, ...base.getDescendants(false)] : scene.transformNodes.concat(scene.meshes);
    const tn = (n) => node(nodes, n);
    const hips = tn('Hips'), neck = tn('Neck'), sp = tn(parentBone) || tn('Spine1'), ls = tn('LeftShoulder') || tn('LeftArm'), rs = tn('RightShoulder') || tn('RightArm');
    const foot = tn('LeftFoot'), toe = tn('LeftToeBase');
    if (!hips || !neck || !sp || !ls || !rs) { playing.forEach((g) => g.play(g.loopAnimation)); return null; }
    [hips, neck, sp, ls, rs, foot, toe].forEach((n) => n && n.computeWorldMatrix(true));
    const P = sp.getAbsolutePosition();
    const up = neck.getAbsolutePosition().subtract(hips.getAbsolutePosition()).normalize();
    const right = rs.getAbsolutePosition().subtract(ls.getAbsolutePosition()); right.subtractInPlace(up.scale(V3.Dot(right, up))); right.normalize();
    let fwd = V3.Cross(right, up).normalize();                      // left-handed Babylon: right x up = forward
    if (foot && toe) { const f = toe.getAbsolutePosition().subtract(foot.getAbsolutePosition()); if (V3.Dot(f, fwd) < 0) fwd = fwd.scale(-1); }
    const back = fwd.scale(-1);
    const verts = worldVerts(meshes.filter((m) => m.getTotalVertices && m.getTotalVertices() > 500));
    const ys = verts.map((v) => V3.Dot(v, up));
    const H = pct(ys, 0.999) - pct(ys, 0.001);
    // the back surface behind Spine2 (a slice of the torso, not the arms)
    const halfW = V3.Distance(ls.getAbsolutePosition(), rs.getAbsolutePosition()) * 0.45;
    const depth = pct(verts.filter((v) => { const d = v.subtract(P); return Math.abs(V3.Dot(d, up)) < 0.08 * H && Math.abs(V3.Dot(d, right)) < halfW; }).map((v) => V3.Dot(v.subtract(P), back)), 0.97) || 0.08 * H;

    // 2. the weapon, normalised: long axis, hilt end, flat face
    const res = await B().SceneLoader.ImportMeshAsync(null, '', weapon.glbUrl, scene);
    const wroot = res.meshes[0];
    const wmeshes = res.meshes.filter((m) => m.getTotalVertices && m.getTotalVertices() > 0);
    wroot.computeWorldMatrix(true);
    const wv = worldVerts(wmeshes, 20000);
    const c = wv.reduce((a, v) => a.addInPlace(v), V3.Zero()).scale(1 / Math.max(1, wv.length));
    const ext = ['x', 'y', 'z'].map((k) => pct(wv.map((v) => v[k]), 0.995) - pct(wv.map((v) => v[k]), 0.005));
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
    const pivot = new (B().TransformNode)('rebelWeapon_' + weapon.id, scene);
    const inner = new (B().TransformNode)('rebelWeaponInner', scene);
    inner.parent = pivot;
    // the file's root keeps its own import transform (handedness); inner centres, turns and sizes it
    wroot.parent = inner;
    const innerLocal = B().Matrix.Translation(-c.x, -c.y, -c.z).multiply(R).multiply(B().Matrix.Scaling(scale, scale, scale));
    inner.rotationQuaternion = new (B().Quaternion)();
    innerLocal.decompose(inner.scaling, inner.rotationQuaternion, inner.position);
    pivot.position.copyFrom(center);
    pivot.computeWorldMatrix(true);
    // 4. ride the spine
    pivot.setParent(sp);
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
  window.RebelWeapon = { attach, resolve, fromTrait, catalog };
})();
