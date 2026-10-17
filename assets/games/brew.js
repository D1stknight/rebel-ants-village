// The Witch's Brew (Oct 15, the Cute & Creepy witch's cottage): the Lunar Witch's recipe is a page of riddles, one line
// per ingredient. Eight jars float on a shelf by the cauldron; pour them in the recipe's order (click a jar, or press its
// number). A wrong jar makes the brew hiss and costs one of three tries; the third spoils it. Each brew is a new recipe
// (five of the eight ingredients on the shelf, each with one of its riddles); the shelf holds eight of the witch's
// sixteen ingredients, a new eight every brew.
// Oct 17: How to play (the rules) and Restart (the same recipe from its first line, three tries again).
// def: { cauldron: [x, z] (frame coords), rim: brew height, shelf: [x, y, z] (its middle), playerAt: [x, z], cam, at, pass, points }
(function () {
  // the witch's stores: sixteen ingredients, six riddles each; a brew puts eight of them on the shelf (Oct 17, Miguel: "give
  // it a lot of riddles its such a great game, it make me want to play it a lot of times")
  const POOL = [
    { id: 'bat', name: 'Bat Wing', c: [.42, .2, .62], lines: ['Torn from one who flies by night but is no bird.', 'The sail of a night flyer who sees with its ears.', 'It hangs upside down all day and folds its cloak at dawn.', 'Leather that learned to fly.', 'A small umbrella that squeaks.', "The cave's cloak, borrowed for a night."] },
    { id: 'moon', name: 'Moonwater', c: [.62, .8, 1], lines: ['What the moon weeps into the old well.', 'The silver drink the Harvest Moon pours.', 'A bowl of water that held the full moon until morning.', 'Rain that fell through moonbeams and kept their shine.', 'The silver in it is not metal but moonlight.', "The well's water on the night the sky's lamp was full."] },
    { id: 'toad', name: 'Toadstool', c: [.9, .18, .14], lines: ['A red roof that grows in the dark, dotted white.', 'A little house no one lives in, under the dead tree.', 'An umbrella for a frog, spotted and poisonous.', 'It grows in a ring where the fairies dance.', 'A stool no one should sit on and no one should eat.', 'Born after rain in the shade, it never flowers.'] },
    { id: 'silk', name: 'Spider Silk', c: [.92, .92, .9], lines: ['The thread that catches whatever flies.', 'A net spun without hands, between the graves.', 'Eight legs wove it; the morning dew strings it with pearls.', 'Finer than hair, stronger than it looks, sticky as a promise.', 'A rope a spinner lets herself down from the ceiling on.', "The lace on the crypt's door that no tailor made."] },
    { id: 'seed', name: 'Pumpkin Seeds', c: [1, .55, .12], lines: ['The heart of every lantern on the hill.', 'What the grinning lantern keeps inside.', 'Scooped out so that a face can be carved.', 'Plant one in spring and a lantern grows by autumn.', 'Flat and pale, from the belly of the orange giant.', "Jack's insides, roasted."] },
    { id: 'raven', name: 'Raven Feather', c: [.12, .12, .18], lines: ['The black pen the sky lends the night.', 'Dropped by the one who croaks "nevermore".', 'A quill from the bird that sits on the gallows.', "The darkest plume of the wisest bird.", 'It fell from a black wing over the graveyard and does not shine.', "The old gods' messenger left it on the gate."] },
    { id: 'pepper', name: 'Ghost Pepper', c: [1, .32, .1], lines: ['Hot enough to scare a ghost away.', 'A little fire that grows on a stem.', 'One bite and smoke comes out of your ears.', 'Red, wrinkled and wicked: it burns twice.', 'The spirit that haunts your tongue.', 'Grown in the garden, it bites back.'] },
    { id: 'star', name: 'Star Dust', c: [1, .86, .4], lines: ['What falls when a wish is made.', 'Light that came down from the sky to sleep in a jar.', 'Swept from the tail of a shooting star.', 'Glitter the night sky shed.', "The sky's sugar, sprinkled on dreams.", 'A pinch of heaven that twinkles in the dark.'] },
    { id: 'moss', name: 'Graveyard Moss', c: [.32, .52, .22], lines: ['The green blanket the old stones wear.', 'It grows over the names nobody reads anymore.', 'Soft and damp, it creeps over the tombs.', 'A carpet the dead never walk on.', 'Scraped from the north side of a headstone.', 'It needs no seed, only shade, rain and silence.'] },
    { id: 'howl', name: 'Wolf Howl', c: [.55, .62, .76], lines: ['A song sung to the full moon from the hilltop, corked tight.', 'What echoes through the woods on the round-moon nights.', 'Caught in a bottle before it could reach the valley.', 'The sound that makes the villagers lock their doors.', "The grey hunter's call, kept for later.", 'A long, lonely note from a furry throat.'] },
    { id: 'whisker', name: 'Black Cat Whisker', c: [.3, .28, .34], lines: ['It measures the gap before the night hunter slips through.', 'Lost from the face of the one whose crossing brings bad luck.', 'A stiff hair from a purring shadow.', "The witch's companion shed it on her broom.", 'From the cheek of one with nine lives.', 'It tickles your hand when the mouser comes to say hello.'] },
    { id: 'wax', name: 'Candle Wax', c: [.95, .9, .74], lines: ['The tears a flame cries as it burns.', 'It melts while it works and hardens when it rests.', 'It drips from every window on Halloween night.', 'What is left on the altar by morning when the light has gone out.', 'Bees made it first; the chandler gave it a wick.', "Soft and pale, it seals the witch's letters."] },
    { id: 'blood', name: "Dragon's Blood", c: [.55, .04, .06], lines: ['A red resin that bleeds from a tree, named for a beast that breathes fire.', "Red as a beast's wound, but it came from bark.", 'The tree that bleeds when you cut it gives this.', 'Not from a scaly beast at all, though its name says so.', 'Burned for strength in old spells: crimson and smoky.', "The fire-breather's namesake, dried in a jar."] },
    { id: 'hazel', name: 'Witch Hazel', c: [.85, .82, .25], lines: ['A shrub that flowers in winter, with a witch in its name.', 'Its forked twig finds water when you walk with it.', 'A yellow bloom on bare branches, while everything else sleeps.', "The cottage owner's namesake, soothing for scrapes.", 'Bark and leaves steeped clear, cool on a bruise.', "A dowser's fork is cut from it."] },
    { id: 'slime', name: 'Snail Slime', c: [.55, .85, .7], lines: ['The silver road a slow traveller leaves behind.', 'It glistens on the garden path after rain: a trail with no footprints.', 'Carried by one who wears its house on its back.', 'The slowest one in the garden leaves it everywhere it goes.', 'Slippery, shiny and kind to the skin, they say.', "The shell-bearer's shine."] },
    { id: 'shadow', name: 'Shadow Ink', c: [.1, .04, .16], lines: ['Wrung from the dark under the bed.', 'Spill it and the floor forgets the lamp.', 'The darkest blot, squeezed from the corner no lamp reaches.', 'What a shadow bleeds when you step on it.', 'It pools where the light cannot follow.', 'Darkness thick enough to pour.'] }
  ];
  const G = {
    title: "The Witch's Brew",
    howTo: { lines: [
      "The Lunar Witch's recipe is a page of riddles: each line describes one ingredient.",
      'Read the line on the page, then pour that jar: click it or press its number (on the tag under each jar).',
      "Pour them in the recipe's order. A wrong jar hisses and costs one of your three tries (the stars); the third spoils the brew.",
      'Every brew is a new recipe: eight of the witch\'s sixteen ingredients on the shelf and nearly a hundred riddles. Fewer wrong jars score more.',
      'Tip: each riddle points at one jar by what it is or where it comes from: match it to the names on the tags.'] },
    start(ctx) {
      const B = ctx.B, V3 = B.Vector3, H = ctx.HUD, scene = ctx.scene, def = ctx.def;
      const ING = POOL.slice().sort(() => Math.random() - .5).slice(0, 8); // this brew's shelf
      const CA = def.cauldron || [0, -3.6], RIM = def.rim || 1.45, SH = def.shelf || [-2.7, 2.15, -3.1], STEPS = Math.min(6, def.steps || 5), TRIES = def.tries || 3;
      const mat = (k, c, em, alpha) => ctx.mat(k, n => { const m = new B.StandardMaterial(n, scene); m.diffuseColor = new B.Color3(...c); m.specularColor = new B.Color3(.3, .3, .3); if (em) m.emissiveColor = new B.Color3(...em); if (alpha != null) { m.alpha = alpha; m.backFaceCulling = false; } return m; });
      const glass = mat('glass', [.7, .8, .85], [.08, .1, .12], .38), cork = mat('cork', [.5, .34, .18]), plank = mat('plank', [.25, .16, .1], [.05, .02, .08]);
      const glowPlank = mat('glowEdge', [.5, .35, .9], [.42, .26, .78]);
      // the shelf: a plank floating by the cauldron, a violet glow along its edge
      const shelf = B.MeshBuilder.CreateBox('brewShelf', { width: 3.9, height: .08, depth: .5 }, scene); shelf.position.set(SH[0], SH[1] - .2, SH[2]); shelf.material = plank; shelf.isPickable = false; ctx.add(shelf);
      const edge = B.MeshBuilder.CreateBox('brewShelfGlow', { width: 3.94, height: .03, depth: .04 }, scene); edge.position.set(SH[0], SH[1] - .17, SH[2] + .26); edge.material = glowPlank; edge.isPickable = false; ctx.add(edge);
      // eight jars: glass, the stuff inside (its colour), a cork
      const jars = ING.map((g, k) => {
        const root = new B.TransformNode('brewJar', scene); ctx.add(root);
        const home = new V3(SH[0] - 1.68 + k * .48, SH[1], SH[2]);
        root.position.copyFrom(home);
        const body = B.MeshBuilder.CreateCylinder('brewJarGlass', { height: .38, diameterTop: .2, diameterBottom: .27, tessellation: 12 }, scene); body.parent = root; body.position.y = .02; body.material = glass; body.metadata = { brewJar: k };
        const fill = B.MeshBuilder.CreateCylinder('brewJarFill', { height: .26, diameterTop: .19, diameterBottom: .24, tessellation: 10 }, scene); fill.parent = root; fill.position.y = -.03; fill.material = mat('fill_' + g.id, g.c, g.c.map(v => v * .45)); fill.metadata = { brewJar: k };
        const top = B.MeshBuilder.CreateCylinder('brewJarCork', { height: .09, diameter: .14, tessellation: 8 }, scene); top.parent = root; top.position.y = .25; top.material = cork; top.isPickable = false;
        [body, fill, top].forEach(m => ctx.add(m));
        return { g, k, root, home, fill, pour: null, bob: k * .8 };
      });
      // the brew's surface (its colour follows the recipe) and what rises from it
      const surf = B.MeshBuilder.CreateDisc('brewSurface', { radius: .62, tessellation: 24 }, scene); surf.rotation.x = Math.PI / 2; surf.position.set(CA[0], RIM + .02, CA[1]); surf.isPickable = false;
      const surfMat = new B.StandardMaterial('brewSurfaceMat_' + Date.now(), scene); surfMat.specularColor = new B.Color3(.2, .2, .2); surf.material = surfMat; ctx.add(surf);
      const dropSrcs = {}, dropSrc = (j) => dropSrcs[j.k] || (dropSrcs[j.k] = (() => { const d = B.MeshBuilder.CreateSphere('brewDrop', { diameter: .07, segments: 4 }, scene); d.isVisible = false; d.isPickable = false; d.material = j.fill.material; ctx.add(d); return d; })());
      const puffSrc = B.MeshBuilder.CreateSphere('brewPuff', { diameter: .34, segments: 5 }, scene); puffSrc.isVisible = false; puffSrc.isPickable = false; puffSrc.material = mat('puff', [.55, .62, .5], [.12, .16, .1], .55); ctx.add(puffSrc);
      const sparkSrc = B.MeshBuilder.CreateSphere('brewSpark', { diameter: .08, segments: 4 }, scene); sparkSrc.isVisible = false; sparkSrc.isPickable = false; sparkSrc.material = mat('spark', [1, .9, 1], [1, .8, 1]); ctx.add(sparkSrc);
      const BASE = [.32, .78, .3];
      let col = BASE.slice(), want = BASE.slice();
      const paint = () => { surfMat.diffuseColor = new B.Color3(...col); surfMat.emissiveColor = new B.Color3(col[0] * .7, col[1] * .7, col[2] * .7); };
      paint();
      // the room's cauldron light takes the brew's colour while the game is on
      const lights = (ctx.inRoom && ctx.frame.parent) ? scene.lights.filter(l => l.position && l.isEnabled() && V3.Distance(l.getAbsolutePosition ? l.getAbsolutePosition() : l.position, ctx.toWorld(CA[0], 1.8, CA[1])) < 1.2) : [];
      const lightWas = lights.map(l => l.diffuse.clone());
      // the recipe: five ingredients (one of each one's riddles), in order
      const pick = ING.map((g, k) => k).sort(() => Math.random() - .5).slice(0, STEPS);
      const recipe = pick.map(k => ({ k, line: ING[k].lines[Math.floor(Math.random() * ING[k].lines.length)] }));
      // the page (the recipe) and the jars' tags
      const hud = document.getElementById('gameHud');
      const page = document.createElement('div');
      page.style.cssText = 'position:absolute;left:50%;top:66px;transform:translateX(-50%);width:min(560px,calc(100vw - 28px));background:linear-gradient(#efe2c4,#dcc9a0);color:#2b1d14;border-radius:8px;padding:9px 14px 8px;box-shadow:0 10px 26px rgba(0,0,0,.55);font:15px/1.35 Georgia,serif;text-align:center;pointer-events:none';
      hud.appendChild(page);
      // the tags in two staggered rows, so neighbouring names never overlap
      const tags = jars.map((j, i) => { const t = document.createElement('div'); t.style.cssText = 'position:absolute;transform:translate(-50%,0);padding:2px 6px;border-radius:6px;background:rgba(18,10,26,.78);border:1px solid rgba(190,150,255,.55);color:#f2e8ff;font:600 11.5px/1.25 Georgia,serif;white-space:nowrap;pointer-events:none;text-align:center'; t.innerHTML = `<b style="color:#ffd877">${j.k + 1}</b> ${j.g.name}`; t.style.marginTop = (i % 2 ? 24 : 0) + 'px'; hud.appendChild(t); return t; });
      const st = { step: 0, tries: TRIES, mistakes: 0, phase: 'intro', wait: 1.2, busy: null, drops: [], puffs: [], sparks: [], t: 0 };
      function drawPage() { // the line to answer now, the ingredients poured so far, the tries left
        const cur = recipe[Math.min(st.step, STEPS - 1)];
        page.innerHTML = `<div style="font:700 11.5px/1.2 Georgia,serif;letter-spacing:.14em;text-transform:uppercase;color:#6d2a6a">The Lunar Witch's Brew · ${st.step >= STEPS ? 'done' : `line ${st.step + 1} of ${STEPS}`}</div>`
          + `<div style="font:italic 17px/1.35 Georgia,serif;margin:4px 0 6px">${st.step >= STEPS ? 'The brew is ready.' : cur.line}</div>`
          + `<div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;font:600 12px/1.3 Georgia,serif">${recipe.map((r, i) => `<span style="padding:1px 7px;border-radius:9px;border:1px solid rgba(80,50,30,.35);background:${i < st.step ? 'rgba(120,70,160,.18)' : i === st.step ? 'rgba(255,216,119,.7)' : 'transparent'}">${i < st.step ? ING[r.k].name : i + 1}</span>`).join('')}<span style="margin-left:6px;color:#6d2a6a">${'✦'.repeat(st.tries)}<span style="opacity:.3">${'✦'.repeat(TRIES - st.tries)}</span></span></div>`;
      }
      const info = () => H.info(`Line ${Math.min(st.step + 1, STEPS)} / ${STEPS}`);
      function pour(k) {
        if (st.phase !== 'play' || st.busy) return;
        const j = jars[k]; if (!j) return;
        const right = recipe[st.step].k === k;
        st.busy = { j, t: 0, right };
        ctx.sound('splash');
      }
      function settle(b) { // the jar has poured: the brew answers
        if (b.right) {
          want = ING[b.j.k].c.map((v, i) => v * .55 + col[i] * .45); st.step++;
          H.msg(st.step >= STEPS ? 'The brew is ready!' : 'The brew takes it', 900);
          ctx.note(523 + st.step * 66, 'bell');
          for (let n = 0; n < 6; n++) spark(.6);
          if (st.step >= STEPS) { st.phase = 'end'; st.wait = 2.2; want = [.72, .38, 1]; ctx.sound('gamewin'); for (let n = 0; n < 26; n++) spark(1.4); }
        } else {
          st.tries--; st.mistakes++; ctx.sound('thock');
          for (let n = 0; n < 8; n++) puff();
          if (st.tries <= 0) { st.phase = 'end'; st.wait = 1.8; want = [.3, .32, .26]; H.msg('The brew spoils!', 1400); }
          else H.msg(`It hisses: not ${b.j.g.name}`, 1100);
        }
        drawPage(); info();
      }
      // Restart (the button beside Quit): the same recipe from its first line, three tries again; a jar in the air goes home
      function restart() { if (st.phase !== 'play') return; if (st.busy) { st.busy.j.root.rotation.z = 0; st.busy = null; } st.step = 0; st.tries = TRIES; st.mistakes = 0; want = BASE.slice(); drawPage(); info(); H.msg('A fresh brew', 1000, 'the same recipe, from the first line'); }
      function spark(up) { const s = sparkSrc.createInstance('brewS'); s.parent = ctx.frame; ctx.add(s); const a = Math.random() * 6.28, r = Math.random() * .5; s.position.set(CA[0] + Math.cos(a) * r, RIM + .1, CA[1] + Math.sin(a) * r); st.sparks.push({ s, v: new V3((Math.random() - .5) * .5, 1 + Math.random() * up, (Math.random() - .5) * .5), t: 0 }); }
      function puff() { const p = puffSrc.createInstance('brewP'); p.parent = ctx.frame; ctx.add(p); const a = Math.random() * 6.28; p.position.set(CA[0] + Math.cos(a) * .3, RIM + .2, CA[1] + Math.sin(a) * .3); st.puffs.push({ p, v: new V3(Math.cos(a) * .4, .8 + Math.random() * .6, Math.sin(a) * .4), t: 0 }); }
      const PA = def.playerAt || [1.9, CA[1] + 1.1];
      ctx.player.place(PA[0], PA[1], Math.atan2(CA[0] - PA[0], CA[1] - PA[1]));
      const cam = def.cam || [-.7, 3.35, CA[1] + 5.6], at = def.at || [-1.1, 1.75, CA[1] + .2];
      ctx.look(cam, at, def.fov || .9);
      H.title(def.title || "The Witch's Brew"); H.score(''); info(); drawPage();
      H.hint('Read the recipe, then pour each line\'s ingredient: click its jar or press its number. Three tries.');
      H.msg(def.title || "The Witch's Brew", 1500, 'follow the recipe');
      const inst = {
        update(dt) {
          ctx.look(cam, at); st.t += dt;
          if (st.phase === 'intro' && (st.wait -= dt) <= 0) st.phase = 'play';
          for (let i = 0; i < 3; i++) col[i] += (want[i] - col[i]) * Math.min(1, dt * 2.5); paint();
          lights.forEach(l => { l.diffuse.set(col[0] * 1.2, col[1] * 1.2, col[2] * 1.2); });
          // the jars bob; the pouring one flies to the cauldron, tips, and comes home
          for (const j of jars) { if (st.busy?.j === j) continue; j.root.position.set(j.home.x, j.home.y + .04 * Math.sin(st.t * 2 + j.bob), j.home.z); j.root.rotation.z *= .85; }
          const b = st.busy;
          if (b) {
            b.t += dt; const j = b.j, over = new V3(CA[0] + .25, RIM + .95, CA[1]);
            if (b.t < .45) { const u = b.t / .45, e = u * u * (3 - 2 * u); j.root.position = V3.Lerp(j.home, over, e); j.root.position.y += Math.sin(e * Math.PI) * .45; }
            else if (b.t < 1.05) { j.root.position.copyFrom(over); j.root.rotation.z = Math.min(2.1, (b.t - .45) * 7); if (Math.random() < .6) { const d = dropSrc(j).createInstance('brewD'); d.parent = ctx.frame; ctx.add(d); d.position.set(over.x - .2, over.y - .05, over.z); st.drops.push({ d, v: new V3(-.2, -.4, 0), t: 0 }); } if (!b.done && b.t > .8) { b.done = true; settle(b); } }
            else if (b.t < 1.5) { const u = (b.t - 1.05) / .45; j.root.rotation.z = 2.1 * (1 - u); j.root.position = V3.Lerp(over, j.home, u * u * (3 - 2 * u)); }
            else st.busy = null;
          }
          for (let i = st.drops.length - 1; i >= 0; i--) { const d = st.drops[i]; d.t += dt; d.v.y -= 9.8 * dt; d.d.position.addInPlace(d.v.scale(dt)); if (d.d.position.y < RIM || d.t > 1) { d.d.dispose(); st.drops.splice(i, 1); } }
          for (let i = st.puffs.length - 1; i >= 0; i--) { const p = st.puffs[i]; p.t += dt; p.p.position.addInPlace(p.v.scale(dt)); p.p.scaling.setAll(1 + p.t * 1.6); if (p.t > 1.3) { p.p.dispose(); st.puffs.splice(i, 1); } }
          for (let i = st.sparks.length - 1; i >= 0; i--) { const s = st.sparks[i]; s.t += dt; s.s.position.addInPlace(s.v.scale(dt)); s.s.scaling.setAll(Math.max(.05, 1 - s.t / 1.6)); if (s.t > 1.6) { s.s.dispose(); st.sparks.splice(i, 1); } }
          jars.forEach((j, i) => { const p = ctx.screenOf(ctx.toWorld(j.root.position.x, j.root.position.y - .36, j.root.position.z)); const t = tags[i]; t.style.left = p.x + 'px'; t.style.top = p.y + 'px'; t.style.display = st.busy?.j === j || p.behind ? 'none' : 'block'; });
          if (st.phase === 'end' && !st.busy && (st.wait -= dt) <= 0) {
            st.phase = 'done'; H.hint('');
            const done = st.step >= STEPS, score = done ? Math.max(25, 100 - 15 * st.mistakes) : 12 * st.step;
            ctx.finish({ score, label: 'points', extra: done ? `The brew is ready${st.mistakes ? ` (${st.mistakes} wrong jar${st.mistakes > 1 ? 's' : ''})` : ', not a drop wasted'}.` : `The brew spoiled at line ${st.step + 1}.` });
          }
        },
        key(e, down) { if (!down || e.repeat) return; const n = parseInt(e.key, 10); if (n >= 1 && n <= jars.length) pour(n - 1); },
        pointer(evt) {
          if (evt.type !== B.PointerEventTypes.POINTERDOWN) return;
          const hit = scene.pickWithRay(ctx.ray(), m => m.metadata?.brewJar !== undefined);
          if (hit && hit.hit) pour(hit.pickedMesh.metadata.brewJar);
        },
        restart,
        _test: { st, recipe, pour, jars },
        dispose() {
          page.remove(); tags.forEach(t => t.remove()); lights.forEach((l, i) => l.diffuse.copyFrom(lightWas[i]));
          [...st.drops.map(d => d.d), ...st.puffs.map(p => p.p), ...st.sparks.map(s => s.s)].forEach(m => { try { m.dispose(); } catch (e) {} });
          try { surfMat.dispose(); } catch (e) {}
        }
      };
      return inst;
    }
  };
  window.RebelGames.register('brew', G);
})();
