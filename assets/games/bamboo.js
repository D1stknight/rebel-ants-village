// Bamboo Cut (Oct 15, Kenshi): bamboo is tossed up in front of the Rebel; slice it in the air. Swipe the mouse (or a
// finger) across the pieces, or press Space for a level cut through the gold band. Several in one stroke count extra;
// a gold piece is worth five. Do not cut the paper lanterns, and do not let bamboo fall back uncut: three of either and
// the round is over. It gets quicker and busier for a minute. A Forge Rebel swings a lent katana with its own moves.
// def: { seconds (60), lives (3), pass, points, sword }
(function () {
  const G = {
    title: 'Bamboo Cut',
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const SECS = def.seconds || 60, LIVES = def.lives || 3, GRAV = 9.8, BAND = [2.3, 4.1];
      const st = { phase: 'intro', t: 0, wait: 1.2, el: 0, score: 0, cuts: 0, lives: LIVES, best: 0, next: .6, pieces: [], halves: [], swipe: [], lastSpace: -1, sword: null, stanceIn: 0, move: 0 };
      const nodes = [], keep = n => { ctx.add(n); nodes.push(n); if (n.isPickable !== undefined) n.isPickable = false; return n; };
      const mat = (k, c, em, o = {}) => ctx.mat('bc_' + k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(...(o.spec || [.12, .12, .12])); if (em) m.emissiveColor = new B.Color3(...em); if (o.alpha != null) m.alpha = o.alpha; if (o.add) { m.disableLighting = true; m.alphaMode = B.Engine.ALPHA_ADD; m.backFaceCulling = false; } return m; });
      const green = mat('green', [.38, .6, .22], [.07, .11, .03]), node = mat('node', [.3, .45, .16], [.05, .08, .02]), cutM = mat('cut', [.92, .9, .7], [.3, .28, .18]);
      const goldM = mat('gold', [1, .8, .3], [.5, .36, .08], { spec: [.9, .8, .5] }), paperM = mat('paper', [1, .5, .3], [.75, .3, .12]), capM = mat('cap', [.12, .1, .09]);
      // one hidden source per kind, copies fly
      const src = {};
      function source(kind) {
        if (src[kind]) return src[kind];
        let m;
        if (kind === 'lantern') {
          const b = B.MeshBuilder.CreateCylinder('bcLamp', { height: .62, diameter: .5, tessellation: 14 }, scene); b.material = paperM;
          const t = B.MeshBuilder.CreateCylinder('bcLampT', { height: .08, diameter: .34, tessellation: 12 }, scene); t.position.y = .34; t.material = capM;
          const u = t.clone('bcLampU'); u.position.y = -.34;
          m = B.Mesh.MergeMeshes([b, t, u], true, true, undefined, false, true);
        } else {
          const len = kind === 'half' ? .55 : 1.1, M = kind === 'gold' ? goldM : green;
          const c = B.MeshBuilder.CreateCylinder('bcStalk', { height: len, diameter: .26, tessellation: 12 }, scene); c.material = M;
          const parts = [c];
          for (const y of kind === 'half' ? [len / 2 - .04] : [-len / 2 + .05, len / 2 - .05]) { const r = B.MeshBuilder.CreateTorus('bcNode', { diameter: .27, thickness: .045, tessellation: 14 }, scene); r.position.y = y; r.material = kind === 'gold' ? goldM : node; parts.push(r); }
          if (kind === 'half') { const f = B.MeshBuilder.CreateDisc('bcFace', { radius: .12, tessellation: 12 }, scene); f.rotation.x = Math.PI / 2; f.position.y = -len / 2 - .002; f.material = cutM; parts.push(f); }
          m = B.Mesh.MergeMeshes(parts, true, true, undefined, false, true);
        }
        m.name = 'bcSrc_' + kind; m.isVisible = false; keep(m); return (src[kind] = m);
      }
      ['stalk', 'gold', 'lantern', 'half'].forEach(source);
      const halfGold = (() => { const m = source('half').clone('bcSrc_halfGold'); m.material = goldM; m.isVisible = false; keep(m); return m; })();
      // the gold band for Space cuts: a soft strip across the throw
      const band = keep(B.MeshBuilder.CreatePlane('bcBand', { width: 12, height: BAND[1] - BAND[0] }, scene)); band.position.set(0, (BAND[0] + BAND[1]) / 2, 6.2); band.material = mat('band', [0, 0, 0], [1, .82, .4], { alpha: .1, add: true });
      // the slash trail over the view
      const hud = document.getElementById('gameHud'), cv = document.createElement('canvas');
      cv.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none';
      hud.prepend(cv); const g2 = cv.getContext('2d');
      // the camera low and to the right of the Rebel, who stands at the left edge of the view
      const camP = [1.6, 2.6, -5.2], camT = [.2, 3.7, 6];
      ctx.look(camP, camT, .9);
      ctx.player.place(-3.6, .6, .35);
      ctx.player.weapon('sword', def.sword || 'eclipse_edge').then(w => { if (!w || st.phase === 'done') return; st.sword = w; ctx.player.clip('sword_idle', { loop: true }); });
      const MOVES = ['sword_power_slash', 'sword_down_slash', 'sword_spin_attack'], MOVE_S = { sword_power_slash: 1.8, sword_down_slash: 1.27, sword_spin_attack: 1.87 };
      H.title(def.title || 'Bamboo Cut'); H.score(0); H.info(`${'♥'.repeat(st.lives)} · ${SECS} s`);
      H.hint('Swipe across the bamboo · or <kbd>Space</kbd> to cut through the gold band · never the lanterns');
      // how hard it is now (0..1 over the minute)
      const k = () => Math.min(1, st.el / SECS);
      function toss() {
        const n = Math.random() < .25 + .45 * k() ? (Math.random() < .35 * k() ? 3 : 2) : 1;
        for (let i = 0; i < n; i++) {
          const r = Math.random(), kind = st.el > 6 && r < .1 + .1 * k() ? 'lantern' : r > .93 ? 'gold' : 'stalk';
          const x0 = (Math.random() * 2 - 1) * 4.6, z0 = 5.6 + Math.random() * 1.4, apex = 4.3 + Math.random() * 2.4 + 1.2 * k(), vy = Math.sqrt(2 * GRAV * apex);
          const tx = (Math.random() * 2 - 1) * 2.2, air = 2 * vy / GRAV, vx = (tx - x0) / air * .9;
          const m = src[kind].createInstance('bcPiece'); m.isPickable = false; keep(m);
          const p = { m, kind, x: x0, y: -.4, z: z0, vx, vy, vz: (Math.random() - .5) * .4, rx: Math.random() * 6, rz: Math.random() * 6, wx: (Math.random() - .5) * 7, wz: (Math.random() - .5) * 7, r: kind === 'lantern' ? .4 : .6, born: st.el };
          st.pieces.push(p); place(p);
        }
        ctx.sound('whoosh');
      }
      function place(p) { p.m.position.set(p.x, p.y, p.z); p.m.rotation.set(p.rx, 0, p.rz); } // frame coordinates
      function cut(list, dirX, dirY) {
        if (!list.length) return;
        let pts = 0, bad = 0;
        for (const p of list) {
          st.pieces.splice(st.pieces.indexOf(p), 1);
          if (p.kind === 'lantern') { bad++; p.m.dispose(); continue; }
          pts += p.kind === 'gold' ? 5 : 1; st.cuts++;
          // two halves fly apart across the stroke
          for (const s of [-1, 1]) { const h = (p.kind === 'gold' ? halfGold : src.half).createInstance('bcHalf'); h.isPickable = false; keep(h);
            st.halves.push({ m: h, x: p.x, y: p.y, z: p.z, vx: p.vx * .5 - dirY * s * 2.6, vy: p.vy * .4 + dirX * s * 2.6 + 1.2, vz: (Math.random() - .5) * 1.5, rx: p.rx, rz: p.rz + (s > 0 ? 0 : Math.PI), wx: p.wx * 1.5 + s * 4, wz: p.wz * 1.5, t: 0 }); }
          p.m.dispose();
        }
        if (pts) {
          const n = list.length - bad, combo = n >= 3 ? n * 2 : n === 2 ? 1 : 0; st.score += pts + combo; st.best = Math.max(st.best, n);
          ctx.sound('thock'); if (combo) { const c = list[0], sp = ctx.screenOf(ctx.toWorld(c.x, c.y, c.z)); if (!sp.behind) H.pop(sp.x, sp.y, `${n} in one · +${combo}`); }
        }
        if (bad) { st.lives = Math.max(0, st.lives - bad); ctx.sound('clang'); H.msg('Not the lanterns!', 900); }
        H.score(st.score); H.info(`${'♥'.repeat(st.lives)}${'♡'.repeat(LIVES - st.lives)} · ${Math.max(0, Math.ceil(SECS - st.el))} s`);
        swing();
        if (st.lives <= 0) end();
      }
      function swing() {
        if (st.sword && st.stanceIn <= .35) { const mv = MOVES[st.move++ % MOVES.length]; ctx.player.clip(mv, { hold: true, speed: 2 }); st.stanceIn = Math.min(1.2, (MOVE_S[mv] || 1.4) / 2); }
        else if (!st.sword) ctx.player.clip('jab');
      }
      // the stroke: the newest bit of the swipe, against each piece's place on the screen
      function strokeHits(a, b) {
        const out = [];
        for (const p of st.pieces) {
          const w = ctx.toWorld(p.x, p.y, p.z), s = ctx.screenOf(w); if (s.behind) continue;
          const e = ctx.screenOf(ctx.toWorld(p.x + p.r, p.y, p.z)), rad = Math.max(14, Math.hypot(e.x - s.x, e.y - s.y));
          const vx = b.x - a.x, vy = b.y - a.y, L2 = vx * vx + vy * vy || 1, u = Math.max(0, Math.min(1, ((s.x - a.x) * vx + (s.y - a.y) * vy) / L2));
          if (Math.hypot(s.x - a.x - vx * u, s.y - a.y - vy * u) < rad) out.push(p);
        }
        return out;
      }
      function spaceCut() {
        if (st.phase !== 'play' || st.el - st.lastSpace < .28) return; st.lastSpace = st.el;
        const hit = st.pieces.filter(p => p.y > BAND[0] && p.y < BAND[1]);
        band.material.alpha = .3;
        if (hit.length) cut(hit, 1, 0); else { ctx.sound('whoosh'); swing(); }
      }
      function end() {
        if (st.phase === 'done') return; st.phase = 'done';
        const passed = st.score >= (def.pass || 0);
        H.msg(st.lives > 0 ? 'Time!' : 'Round over', 1400, `${st.cuts} cut`);
        if (passed) ctx.sound('gamewin');
        setTimeout(() => ctx.finish({ score: st.score, passed, extra: `${st.cuts} pieces cut, best stroke ${st.best}${st.lives <= 0 ? ', three misses' : ''}.` }), 900);
      }
      const DPR = () => (cv.width / Math.max(1, cv.clientWidth)) || 1;
      return {
        update(dt) {
          if (cv.width !== cv.clientWidth || cv.height !== cv.clientHeight) { cv.width = cv.clientWidth; cv.height = cv.clientHeight; }
          if (st.stanceIn > 0 && (st.stanceIn -= dt) <= 0 && st.sword) ctx.player.clip('sword_idle', { loop: true });
          if (st.phase === 'intro') { if ((st.wait -= dt) <= 0) { st.phase = 'play'; H.msg('Cut!', 700); } }
          // the swipe trail fades
          g2.clearRect(0, 0, cv.width, cv.height);
          const now = performance.now(); st.swipe = st.swipe.filter(q => now - q.t < 140);
          if (st.swipe.length > 1) { g2.lineCap = 'round'; for (let i = 1; i < st.swipe.length; i++) { const a = st.swipe[i - 1], b = st.swipe[i], f = 1 - (now - b.t) / 140; g2.strokeStyle = `rgba(255,240,200,${.85 * f})`; g2.lineWidth = 2 + 7 * f; g2.beginPath(); g2.moveTo(a.x * DPR(), a.y * DPR()); g2.lineTo(b.x * DPR(), b.y * DPR()); g2.stroke(); } }
          band.material.alpha = Math.max(.1, band.material.alpha - dt * 1.2);
          for (let i = st.halves.length - 1; i >= 0; i--) { const h = st.halves[i]; h.t += dt; h.vy -= GRAV * dt; h.x += h.vx * dt; h.y += h.vy * dt; h.z += h.vz * dt; h.rx += h.wx * dt; h.rz += h.wz * dt; h.m.position.set(h.x, h.y, h.z); h.m.rotation.set(h.rx, 0, h.rz); if (h.y < -1.5 || h.t > 3) { h.m.dispose(); st.halves.splice(i, 1); } }
          if (st.phase !== 'play') return;
          st.el += dt;
          if ((st.next -= dt) <= 0) { toss(); st.next = (1.25 - .65 * k()) * (.7 + Math.random() * .6); }
          for (let i = st.pieces.length - 1; i >= 0; i--) {
            const p = st.pieces[i]; p.vy -= GRAV * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.rx += p.wx * dt; p.rz += p.wz * dt; place(p);
            if (p.y < -.8 && p.vy < 0) { st.pieces.splice(i, 1); p.m.dispose(); if (p.kind !== 'lantern') { st.lives--; ctx.sound('thock'); H.msg('Dropped one', 700); H.info(`${'♥'.repeat(Math.max(0, st.lives))}${'♡'.repeat(LIVES - Math.max(0, st.lives))} · ${Math.max(0, Math.ceil(SECS - st.el))} s`); if (st.lives <= 0) { end(); return; } } }
          }
          H.info(`${'♥'.repeat(st.lives)}${'♡'.repeat(LIVES - st.lives)} · ${Math.max(0, Math.ceil(SECS - st.el))} s`);
          if (st.el >= SECS) end();
        },
        key(e, down) { if (!down || e.repeat) return; if (e.key === ' ' || e.code === 'Space') spaceCut(); },
        pointer(evt) {
          const T = B.PointerEventTypes;
          if (evt.type === T.POINTERDOWN) { st.down = true; st.swipe = [{ x: scene.pointerX, y: scene.pointerY, t: performance.now() }]; }
          else if (evt.type === T.POINTERUP) st.down = false;
          else if (evt.type === T.POINTERMOVE && st.down) {
            const q = { x: scene.pointerX, y: scene.pointerY, t: performance.now() }, a = st.swipe[st.swipe.length - 1]; st.swipe.push(q);
            if (!a || st.phase !== 'play') return;
            const dtm = Math.max(1, q.t - a.t), sp = Math.hypot(q.x - a.x, q.y - a.y) / dtm * 1000; if (sp < 500) return; // a slow drag is not a cut
            const hit = strokeHits(a, q); if (hit.length) { const L = Math.hypot(q.x - a.x, q.y - a.y) || 1; cut(hit, (q.x - a.x) / L, -(q.y - a.y) / L); }
          }
        },
        _test: { st, toss, cut, spaceCut, strokeHits, end, BAND },
        dispose() { cv.remove(); nodes.forEach(n => { try { n.dispose(); } catch (e) {} }); }
      };
    }
  };
  window.RebelGames.register('bamboo', G);
})();
