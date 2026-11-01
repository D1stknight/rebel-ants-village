// Treasure Dig (Oct 16, Chumpz): Barnacle buried little chests on the west beach. A roam game: walk the sand with the
// detector (its bar fills and it beeps quicker the nearer the closest chest), stop and dig with Space. A chest within a
// stride of the hole comes up (50 points); else only sand. Four chests in 90 s; the seconds left count once all are up.
// With the Rebel's games pack (Forge rigs) the Rebel digs with a shovel (game_dig); else a quick stoop.
// Each chest also holds Rebel points (Oct 17, Miguel: "the chests should give you Rebel points"): 10 a chest, up to 40 a
// day (a full round), so a replay can't farm them.
// def: { spots: [[x, z]...] (world: where chests can lie), chests: 4, seconds: 90, pass, text, chestPoints: 10, chestCap: 40 }
(function () {
  const G = {
    title: 'Treasure Dig', roam: true, moves: true,
    start(ctx) {
      const B = ctx.B, H = ctx.HUD, scene = ctx.scene, def = ctx.def, V3 = B.Vector3;
      const N = def.chests || 4, DUR = def.seconds || 90, FIND = 1.9, PACK = !!ctx.player.has?.('game_dig');
      const nodes = [], keep = n => { ctx.add(n); n.parent = null; nodes.push(n); if (n.isPickable !== undefined) n.isPickable = false; return n; };
      const std = (k, c, em, o = {}) => ctx.mat('td_' + k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(...(o.spec || [.05, .05, .05])); if (em) m.emissiveColor = new B.Color3(...em); if (o.alpha != null) m.alpha = o.alpha; if (o.add) { m.disableLighting = true; m.alphaMode = B.Engine.ALPHA_ADD; } return m; });
      const holeM = std('hole', [.2, .15, .09]), moundM = std('mound', [.78, .66, .45]), woodM = std('wood', [.45, .28, .14], [.06, .04, .02]), goldM = std('gold', [1, .8, .3], [.5, .36, .08], { spec: [.8, .7, .4] }), ironM = std('iron', [.3, .3, .32], [.04, .04, .05]);
      // where the chests lie this time: N of the spots, apart from each other
      const pool = (def.spots || []).map(p => ({ x: +p[0], z: +p[1] })).sort(() => Math.random() - .5), chests = [];
      for (const p of pool) { if (chests.length >= N) break; if (chests.every(c => Math.hypot(c.x - p.x, c.z - p.z) >= 6)) chests.push({ ...p, found: false }); }
      const st = { phase: 'count', t: 3.2, left: DUR, score: 0, found: 0, dig: null, beep: 0, holes: [], ups: [] };
      // the shovel: only while digging, its handle through both hands, the blade below the lower one
      const shovel = keep(new B.TransformNode('tdShovel', scene)); shovel.setEnabled(false);
      { const h = B.MeshBuilder.CreateCylinder('tdHandle', { height: 1.7, diameter: .07, tessellation: 8 }, scene); h.material = woodM; h.parent = shovel; h.position.y = .25; h.isPickable = false; ctx.add(h);
        const bl = B.MeshBuilder.CreateBox('tdBlade', { width: .36, height: .44, depth: .04 }, scene); bl.material = ironM; bl.parent = shovel; bl.position.y = -.82; bl.isPickable = false; ctx.add(bl); }
      const UP = new V3(0, 1, 0);
      function poseShovel() {
        const r = ctx.player.bone('RightHand'), l = ctx.player.bone('LeftHand'); if (!r || !l) { shovel.setEnabled(false); return; }
        const hi = r.y > l.y ? r : l, lo = r.y > l.y ? l : r, d = hi.subtract(lo); if (d.length() < .05) return; d.normalize();
        shovel.position.copyFrom(lo.add(d.scale(-.1))); const ax = V3.Cross(UP, d), an = Math.acos(Math.max(-1, Math.min(1, V3.Dot(UP, d))));
        shovel.rotationQuaternion = ax.length() < 1e-6 ? B.Quaternion.Identity() : B.Quaternion.RotationAxis(ax.normalize(), an);
      }
      const near = () => { const p = ctx.player.world(); let best = null, bd = Infinity; for (const c of chests) if (!c.found) { const d = Math.hypot(c.x - p.x, c.z - p.z); if (d < bd) { bd = d; best = c; } } return { c: best, d: bd }; };
      const hud = () => { H.score(st.score); H.info(`${st.found} / ${chests.length} chests · ${Math.ceil(st.left)} s`); };
      function dig() {
        if (st.phase !== 'play' || st.dig) return;
        const p = ctx.player.world();
        st.dig = { t: 0, x: p.x, z: p.z, len: PACK ? 1.8 : .8 }; ctx.player.hold(true);
        if (PACK) { ctx.player.clip('game_dig', { from: .6, hold: true }); shovel.setEnabled(true); } else ctx.player.clip('jab');
      }
      function dug() {
        const D = st.dig; st.dig = null; shovel.setEnabled(false); ctx.player.hold(false); if (PACK) ctx.player.idle();
        // the hole, a little ahead of the Rebel's feet
        const yaw = ctx.player.root.rotation.y, hx = D.x + Math.sin(yaw) * .9, hz = D.z + Math.cos(yaw) * .9, gy = ctx.ground(hx, hz);
        const hole = keep(B.MeshBuilder.CreateDisc('tdHole', { radius: .55, tessellation: 18 }, scene)); hole.rotation.x = Math.PI / 2; hole.position.set(hx, gy + .03, hz); hole.material = holeM;
        const mound = keep(B.MeshBuilder.CreateTorus('tdMound', { diameter: 1.5, thickness: .32, tessellation: 20 }, scene)); mound.scaling.y = .45; mound.position.set(hx, gy + .04, hz); mound.material = moundM;
        st.holes.push(hole, mound); ctx.sound('splash');
        let hit = null; for (const c of chests) if (!c.found && Math.hypot(c.x - hx, c.z - hz) < FIND) { hit = c; break; }
        if (!hit) { H.msg('Only sand', 700); return; }
        hit.found = true; st.found++; ctx.count?.('digs'); st.score += 50; ctx.sound(st.found >= chests.length ? 'gamewin' : 'strike');
        // a little chest comes up out of the hole and opens on its gold
        const ch = keep(new B.TransformNode('tdChest', scene)); ch.position.set(hx, gy - .5, hz); ch.rotation.y = yaw + Math.PI;
        const box = (n, w, h, d, m, x, y, z, par) => { const b = B.MeshBuilder.CreateBox(n, { width: w, height: h, depth: d }, scene); b.material = m; b.parent = par; b.position.set(x, y, z); b.isPickable = false; ctx.add(b); return b; };
        box('tdBody', .9, .5, .6, woodM, 0, .25, 0, ch); box('tdBand', .94, .08, .64, ironM, 0, .4, 0, ch);
        const lid = new B.TransformNode('tdLid', scene); lid.parent = ch; lid.position.set(0, .5, -.3); ctx.add(lid); box('tdLidTop', .9, .14, .6, woodM, 0, .07, .3, lid);
        box('tdGold', .8, .1, .5, goldM, 0, .46, 0, ch);
        st.ups.push({ ch, lid, t: 0, y0: gy - .5 });
        const sp = ctx.screenOf(new V3(hx, gy + 1.6, hz)); if (!sp.behind) H.pop(sp.x, sp.y, '+50');
        ctx.rebelPoints?.(def.chestPoints ?? 10, def.chestCap ?? 40); // each chest holds Rebel points too (40 a day at most)
        H.msg(st.found >= chests.length ? 'All four!' : 'Treasure!', 900, `${st.found} / ${chests.length}`);
        hud(); if (st.found >= chests.length) finish(true);
      }
      function finish(all) {
        if (st.phase === 'done') return; st.phase = 'done'; ctx.player.hold(false); H.meter(null);
        const bonus = all ? Math.floor(st.left) : 0; st.score += bonus; hud();
        ctx.finish({ score: st.score, label: 'points', passed: st.score >= (def.pass || 150), kicker: all ? 'All dug up' : "Time's up",
          extra: `${st.found} of ${chests.length} chests${bonus ? `, ${bonus} seconds to spare (+${bonus})` : ''}.` });
      }
      ctx.player.hold(true);
      H.title(def.title || 'Treasure Dig'); hud();
      H.hint(`${def.text ? def.text + ' · ' : ''}Walk the beach with the detector, <kbd>Space</kbd> to dig. The fuller the bar, the nearer a chest.`);
      H.msg(def.title || 'Treasure Dig', 1400, `${chests.length} chests · ${DUR} s`);
      return {
        update(dt) {
          for (const u of st.ups) { u.t += dt; const e = Math.min(1, u.t / .7); u.ch.position.y = u.y0 + .62 * e * (2 - e); u.lid.rotation.x = -Math.min(1.9, Math.max(0, u.t - .5) * 4); }
          if (st.phase === 'count') { st.t -= dt; H.msg(st.t > .4 ? String(Math.ceil(st.t - .4)) : 'Dig!', 400); if (st.t <= 0) { st.phase = 'play'; ctx.player.hold(false); } return; }
          if (st.phase !== 'play') return;
          st.left -= dt; if (st.left <= 0) { st.left = 0; finish(false); return; }
          if (st.dig) { st.dig.t += dt; if (PACK) poseShovel(); if (st.dig.t >= st.dig.len) dug(); }
          const n = near(), c = n.c ? Math.max(0, Math.min(1, 1 - (n.d - 1) / 16)) : 0;
          H.meter({ label: 'Detector', value: c, fill: c });
          if (n.c && (st.beep -= dt) <= 0) { st.beep = .14 + (1 - c) * 1.1; ctx.note(520 + 560 * c, 'pluck'); }
          hud();
        },
        // Space digs (the walk keeps every other key)
        key(e, down) { if (e.key === ' ') { if (down && !e.repeat) dig(); return true; } return false; },
        target() { return null; },
        _test: { st, chests, dig, dug, near, PACK },
        dispose() { ctx.player.hold(false); nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); }
      };
    }
  };
  window.RebelGames.register('treasure', G);
})();
