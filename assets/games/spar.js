// Fighting Ring (Oct 15, Warrior): spar with the iron training dummy. Its arms wind up (they glow) and swing: block the
// way it comes, ← left, → right, ↓ for the low sweep (arrow keys, A D S or the pads). A good block opens it up: strike
// with Space while it reels. Three rounds, each quicker, the last with feints that stop short (do not block a feint).
// Five hits and you are down. Score: blocks, counters and the run of clean blocks.
// def: { rounds (3), hearts (5), pass, points }
(function () {
  const SIDES = ['left', 'right', 'low'], ICON = { left: '←', right: '→', low: '↓' }, KEYS = { arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right', arrowdown: 'low', s: 'low' };
  const G = {
    title: 'Fighting Ring',
    start(ctx) {
      const B = ctx.B, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const ROUNDS = def.rounds || 3, HEARTS = def.hearts || 5, RT = 22;
      const st = { phase: 'intro', wait: 1.3, round: 1, rt: 0, score: 0, blocks: 0, counters: 0, combo: 0, best: 0, hearts: HEARTS, att: null, next: 1.2, open: 0, shake: 0, feints: 0 };
      const nodes = [], keep = n => { ctx.add(n); nodes.push(n); if (n.isPickable !== undefined) n.isPickable = false; return n; };
      const mat = (k, c, em, o = {}) => ctx.mat('sp_' + k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(...(o.spec || [.2, .2, .2])); if (em) m.emissiveColor = new B.Color3(...em); if (o.alpha != null) m.alpha = o.alpha; if (o.add) { m.disableLighting = true; m.alphaMode = B.Engine.ALPHA_ADD; m.backFaceCulling = false; } return m; });
      const wood = mat('wood', [.42, .27, .14], [.06, .04, .02]), iron = mat('iron', [.24, .24, .26], [.03, .03, .03], { spec: [.7, .7, .75] }), warn = mat('warn', [1, .45, .2], [1, .38, .1]), base = mat('base', [.3, .29, .27], [.04, .04, .04]);
      // the dummy, 3 m in front of the Rebel: a post on a base, a head, two arms on pivots at the shoulders, a low leg
      const D = keep(new B.TransformNode('spDummy', scene)); D.position.set(0, 0, 3.1); D.rotation.y = Math.PI;
      const part = (n, mesh, m, x, y, z, par = D) => { mesh.material = m; mesh.parent = par; mesh.position.set(x, y, z); mesh.isPickable = false; return mesh; };
      part('base', B.MeshBuilder.CreateCylinder('spBase', { height: .3, diameterTop: 1.1, diameterBottom: 1.3, tessellation: 16 }, scene), base, 0, .15, 0);
      const post = part('post', B.MeshBuilder.CreateCylinder('spPost', { height: 3, diameter: .5, tessellation: 14 }, scene), wood, 0, 1.8, 0);
      part('band', B.MeshBuilder.CreateTorus('spBand', { diameter: .52, thickness: .06, tessellation: 16 }, scene), iron, 0, 2.3, 0); part('band2', B.MeshBuilder.CreateTorus('spBand2', { diameter: .52, thickness: .06, tessellation: 16 }, scene), iron, 0, 1.2, 0);
      part('head', B.MeshBuilder.CreateSphere('spHead', { diameter: .62, segments: 10 }, scene), wood, 0, 3.55, 0);
      const arms = {};
      const arm = (side, x, y, len, low) => {
        const pv = new B.TransformNode('spArm_' + side, scene); pv.parent = D; pv.position.set(x, y, 0); nodes.push(pv);
        const a = B.MeshBuilder.CreateCylinder('spArmM', { height: len, diameter: .18, tessellation: 10 }, scene); a.rotation.z = Math.PI / 2; a.material = wood; a.parent = pv; a.position.x = Math.sign(x || 1) * len / 2; a.isPickable = false;
        const tip = B.MeshBuilder.CreateSphere('spTip', { diameter: .26, segments: 8 }, scene); tip.material = iron; tip.parent = pv; tip.position.x = Math.sign(x || 1) * len; tip.isPickable = false;
        if (low) { pv.rotation.y = 0; }
        arms[side] = { pv, a, tip, rest: 0 };
      };
      // the dummy faces the Rebel (turned PI), so its own +x arm is on the left of the view: arms are named as you see them
      arm('left', .26, 2.7, 1.3); arm('right', -.26, 2.7, 1.3); arm('low', .26, .7, 1.25, true);
      const spark = keep(B.MeshBuilder.CreateSphere('spSpark', { diameter: 1, segments: 8 }, scene)); spark.material = mat('spark', [0, 0, 0], [1, .85, .45], { alpha: .85, add: true }); spark.setEnabled(false);
      const camP = [2.9, 3.3, -4.2], camT = [0, 2.1, 2.2];
      ctx.look(camP, camT, .85);
      ctx.player.place(0, 0, 0); ctx.player.clip('fight_idle', { loop: true });
      // the pads (touch)
      const hud = document.getElementById('gameHud'), pads = document.createElement('div');
      pads.style.cssText = 'position:absolute;left:50%;bottom:66px;transform:translateX(-50%);display:flex;gap:10px;pointer-events:auto';
      pads.innerHTML = ['left', 'low', 'right'].map(s => `<button type="button" data-s="${s}" style="width:58px;height:46px;border-radius:10px;border:1px solid #d8b35c;background:rgba(14,12,8,.85);color:#f3d27a;font:800 22px system-ui;touch-action:manipulation">${ICON[s]}</button>`).join('')
        + `<button type="button" data-s="strike" style="width:92px;height:46px;border-radius:10px;border:1px solid #ff9a6a;background:rgba(40,12,8,.85);color:#ffc8a8;font:800 15px system-ui;touch-action:manipulation">Strike</button>`;
      pads.querySelectorAll('button').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); const s = b.dataset.s; if (s === 'strike') strike(); else block(s); }));
      hud.append(pads);
      const hearts = () => '♥'.repeat(st.hearts) + '♡'.repeat(HEARTS - st.hearts);
      function hud2() { H.score(st.score); H.info(`Round ${st.round} / ${ROUNDS} · ${hearts()}${st.combo >= 3 ? ` · ${st.combo} clean` : ''}`); }
      H.title(def.title || 'Fighting Ring'); hud2();
      H.hint('Block the swing: <kbd>←</kbd> <kbd>→</kbd> <kbd>↓</kbd> (or A D S) · <kbd>Space</kbd> strikes while it reels · a feint stops short: let it be');
      // an attack: wind (the arm glows and draws back), then the swing; a feint winds and stops
      const speed = () => [1, 1.3, 1.6][Math.min(2, st.round - 1)];
      function attack() {
        const side = SIDES[Math.floor(Math.random() * 3)], feint = st.round >= 3 && Math.random() < .22;
        const wind = (.85 - .12 * st.round) * (.85 + Math.random() * .3), swing = .32 / speed();
        st.att = { side, feint, t: 0, wind, swing, blocked: false, done: false };
        arms[side].a.material = warn; arms[side].tip.material = warn;
      }
      function resolve(hit) {
        const a = st.att; if (!a || a.done) return; a.done = true;
        arms[a.side].a.material = wood; arms[a.side].tip.material = iron;
        if (hit) { st.hearts--; st.combo = 0; st.shake = .35; ctx.sound('strike'); ctx.player.clip('hit_reaction'); H.msg('Hit!', 600); hud2(); if (st.hearts <= 0) { ctx.player.clip('knockdown', { hold: true }); end(); } }
      }
      function block(side) {
        if (st.phase !== 'play') return;
        const a = st.att;
        if (!a || a.done || a.blocked) { st.combo = 0; H.msg('Nothing there', 450); hud2(); return; }
        if (a.feint) { st.combo = 0; st.feints++; H.msg('A feint!', 600); a.feintBit = true; hud2(); return; }
        // the block counts in the late wind-up and the swing itself
        const late = a.t >= a.wind * .55;
        if (side !== a.side || !late) { st.combo = 0; H.msg(side !== a.side ? 'Wrong side' : 'Too early', 500); hud2(); return; }
        a.blocked = true; st.blocks++; st.combo++; st.best = Math.max(st.best, st.combo);
        const perfect = a.t >= a.wind; const pts = perfect ? 3 : 2; st.score += pts + (st.combo >= 5 ? 1 : 0);
        ctx.sound('clang'); spark.setEnabled(true); spark.position.copyFrom(arms[a.side].tip.getAbsolutePosition()); spark.scaling.setAll(.3); st.spark = 0;
        ctx.player.clip(a.side === 'low' ? 'jump' : 'cross_punch');
        H.msg(perfect ? 'Perfect block!' : 'Block', 500); st.open = .75; resolve(false); hud2();
      }
      function strike() {
        if (st.phase !== 'play') return;
        if (st.open <= 0) { st.combo = 0; ctx.player.clip('jab'); H.msg('Guard up!', 450); hud2(); return; }
        st.open = 0; st.counters++; st.score += 4; ctx.sound('thock'); ctx.player.clip(['punch_combo', 'roundhouse_kick', 'side_kick', 'hook_punch'][st.counters % 4]);
        st.wobble = 1; H.msg('Counter!', 500); hud2();
      }
      function end() {
        if (st.phase === 'done') return; st.phase = 'done'; pads.remove();
        const passed = st.score >= (def.pass || 0), down = st.hearts <= 0;
        H.msg(down ? 'Down!' : 'Well fought', 1500, `${st.blocks} blocks · ${st.counters} counters`);
        if (passed) ctx.sound('gamewin');
        setTimeout(() => ctx.finish({ score: st.score, passed, kicker: down ? 'Knocked down' : passed ? 'Well fought' : 'Rounds over', extra: `${st.blocks} blocks, ${st.counters} counters, best run ${st.best}${st.feints ? `, ${st.feints} feints bitten` : ''}. Block late, as the arm swings, then strike.` }), 1100);
      }
      return {
        update(dt) {
          const t = performance.now() / 1000;
          // arms at rest sway; the attacking one winds back then swings through
          for (const s of SIDES) { const A = arms[s]; if (st.att && st.att.side === s && !st.att.done) continue; A.pv.rotation.y += ((s === 'low' ? 0 : s === 'left' ? -.15 : .15) + .06 * Math.sin(t * 2 + s.length) - A.pv.rotation.y) * Math.min(1, dt * 6); }
          if (st.att && !st.att.done) {
            const a = st.att, A = arms[a.side], dir = a.side === 'right' ? -1 : 1; // winds back away from you, swings in
            a.t += dt;
            if (a.t < a.wind) { const u = a.t / a.wind; A.pv.rotation.y = dir * (.15 + .9 * u); A.tip.scaling.setAll(1 + .3 * Math.sin(t * 20)); }
            else if (a.feint) { A.pv.rotation.y = dir * (1.05 - (a.t - a.wind) * 3); if (a.t > a.wind + .35) { if (!a.feintBit) { st.score += 1; } a.done = true; A.a.material = wood; A.tip.material = iron; hud2(); } }
            else { const u = Math.min(1, (a.t - a.wind) / a.swing); A.pv.rotation.y = dir * (1.05 - 2.2 * u); if (u >= 1) resolve(true); }
          }
          if (st.spark != null) { st.spark += dt; spark.scaling.setAll(.3 + st.spark * 4); spark.material.alpha = Math.max(0, .85 - st.spark * 2.2); if (st.spark > .4) { spark.setEnabled(false); st.spark = null; } }
          if (st.wobble > 0) { st.wobble = Math.max(0, st.wobble - dt * 2); post.rotation.x = -.18 * st.wobble * Math.sin(t * 30); }
          if (st.shake > 0) { st.shake = Math.max(0, st.shake - dt); const k = st.shake * .25; ctx.look([camP[0] + Math.sin(t * 60) * k, camP[1] + Math.cos(t * 53) * k, camP[2]], camT, .85); }
          if (st.open > 0) st.open -= dt;
          if (st.phase === 'intro') { if ((st.wait -= dt) <= 0) { st.phase = 'play'; H.msg('Round 1', 900); } return; }
          if (st.phase !== 'play') return;
          st.rt += dt;
          if ((!st.att || st.att.done) && (st.next -= dt) <= 0) { attack(); st.next = (1.25 - .25 * st.round) * (.75 + Math.random() * .5); }
          if (st.rt >= RT && (!st.att || st.att.done)) {
            if (st.round >= ROUNDS) { end(); return; }
            st.round++; st.rt = 0; st.next = 1.6; H.msg(`Round ${st.round}${st.round === ROUNDS ? ': watch for feints' : ''}`, 1200); ctx.sound('whistle'); hud2();
          }
        },
        key(e, down) { if (!down || e.repeat) return; const k = e.key.toLowerCase(); if (k === ' ') { strike(); return; } const s = KEYS[k]; if (s) block(s); },
        _test: { st, block, strike, attack, end },
        dispose() { pads.remove(); nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); }
      };
    }
  };
  window.RebelGames.register('spar', G);
})();
