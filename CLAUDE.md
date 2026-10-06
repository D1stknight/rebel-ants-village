# CLAUDE.md — Rebel Ants: The Hidden Village

Read this first. It is the hand-off from the Cowork sessions (Sept–Oct 2026) so a new Claude Code session can continue.


## How this repo is worked on
- Work on the `dev` branch; push with plain git. Production = `main`, updated only by merging dev via a PR when Miguel says so.
- Vercel builds every push to dev (preview URL `rebel-ants-village-git-dev-miguel-concepcions-projects.vercel.app`); check the deploy after pushing.
- More notes live in the claude.ai project "Rebel Ants Universe" (docs `claude/handoff.md`, `claude/village-terrains.md`); this file carries the essentials.

## Where things stand (Oct 4)
- On dev: Samurai village, fixes (night lanterns, cherry trunk collision, Back key), Wokou harbour village + surf sound, faction emblems on banners, Yamabushi, Buke, Kenshi, Sohei, Ashigaru, Bushi villages (terrain + kit + layout each), Ronin rebuilt (moonlit fortress + giant bonsai), birds in every village, walking light in every village, lighter cherry tree, layout cache survives full browser storage. Miguel: NOT to main yet, keep building villages.
- This repo is now attached to Claude Code sessions: Claude commits and pushes to dev directly (plain git), then checks the Vercel deploy (Vercel MCP: project prj_CjuIvsLXKinzfIgUkmSkyWhKWqtc, team team_7tWG3HhBf0Ir5h0Hhz9ZAarq).
- If the chat has NO repo attached: Claude builds + tests, delivers files to Miguel's Downloads/<name>/, Miguel uploads on github.com (dev branch), Claude then verifies dev matches (git fetch + diff) and checks the Vercel deploy. Do NOT push via the admin page / upload token in the browser (blocked by a safety check).
- Oct 4: dev merged to main (PR #17, merge 005748b; production deploy READY) — all villages above are live. Production still reads layouts from dev, so a new village's kit/terrain must reach main before its layout shows properly there. Next: the 6 remaining villages on dev.

## Standing rules (from Miguel)
- 001 is the master and needs no fixing; don't change Forge characters/rigs that are "perfect".
- One change at a time, each its own commit, verified (headless render + checks) before reporting.
- Never enter passwords/credentials; Miguel sets secrets and rotates the OpenSea key himself; purchases need an explicit yes.
- #893 stays out of the lobby until reforged.
- Minimal narrative, visual outputs (screenshots/side-by-sides).
- Launch single player; Zelda-like vision.

## Next up (one at a time)
1. Miguel playtests Yamabushi (cliffs, mist, bridge, FPS) and Wokou (surf level).
2. Next faction village, same recipe: terrain → kit → layout (Miguel sends 3 images per village). Banners: use banner_<faction> / noren with the emblem.
3. Later: plan the dev → main merge (Samurai + Wokou + Yamabushi on prod).
3b. Friend villages: Cute & Creepy (Halloween), Chumps (barn life, drinking + fishing; not in VILLAGE_REGISTRY yet), Saints (Los Angeles city life).
4. Other faction terrains (table below).
5. Bake terrains to files; pre-launch layout cache; pin Babylon version.
6. Older: domain DNS (Kev), #893 reforge, production wallet tests.



## Repo map (the parts touched most)
- `village.html` — the whole village runtime (Babylon.js, one big module script): assets (`ASSETS`), admin panel, layout save/load (`/api/world-layout`), collision (`rebuildVillageCollisionBlockers`, `villagePointBlocked`), player movement (render loop, `walkMode`).
- `assets/village-terrain.js` — per-village terrain recipes (`TERRAIN_RECIPES`: hub, ronin, samurai, wokou): heightmap + erosion, courtyard village shape (`makeVillageShape`), coast + sea (`makeCoastCap`, `buildSea`), decor scatter.
- `assets/samurai-kit.js` — procedural building kit (`window.SamuraiKit`): `sam_*` (Samurai) and `wok_*` (Wokou) pieces, built once into hidden templates, placed as instances; lantern glow follows `setLightFactor`.
- `assets/world-layouts/<village>.json` — saved layouts (hub is `assets/world-layout.json`). Heights are stored in OLD-terrain heights and shifted on load/save (`newTerrainLayoutFromSaved` / `newTerrainShiftLayout`).
- `api/` — Vercel functions (layout save/load reads the `dev` branch, also for production).

## Testing
- Headless Playwright + swiftshader against a local `python3 -m http.server`, mocking `/api/world-layout` and admin session; render screenshots and check layout round trips (save → load exact). The character GLB needs the Draco decoder from cdn.babylonjs.com (may be blocked in sandboxes) — use a stand-in box for movement tests.
- If cdn.babylonjs.com is blocked but registry.npmjs.org works: `npm i babylonjs babylonjs-loaders babylonjs-materials draco3dgltf` in a scratch dir and `page.route` the CDN to those files by basename (Babylon 9 asks for `/v9.x/draco_decoder_gltf.wasm`; `draco3dgltf/draco_decoder_gltf_nodejs.js` works as the wrapper). Route vercel-storage GLBs to `assets/character/ant_idle_c.glb`.
- Swiftshader frames starve timers (setInterval ~1/s): stop the render loop (`BABYLON.EngineStore.LastCreatedEngine.stopRenderLoop()`) before probing audio gains or timer-driven logic.
- Verify other villages are unchanged after any terrain/kit change (hub, ronin, samurai).

## Faction terrain direction (from Miguel's FACTIONS PDF)
| Faction | Role · traits · symbol | Armour palette | Terrain direction |
|---|---|---|---|
| Ronin | Elite silent assassins; act only when the colony's fate hangs by a thread. Red handprint = judgment, sacrifice, power in silence | Matte black, crimson visor glow, faint red aura | Darkest village: black-green pines, dead trees, deep ravines, heavy low mist, near-black soil and rock, crimson accents (maples / lanterns), moonlit, very quiet |
| Samurai | Disciplined core soldiers. Ant silhouette on red = loyalty, structure, ancestral pride | Crimson, muted gold, charcoal | Orderly terraces, clean stone walls, red maples, warm golden light; the flagship village |
| Shogun | Commanders and rulers. Crown = power through wisdom | Midnight indigo/purple, rich gold | High plateau / fortress hill above a valley, purple dusk sky, gold-lit, wisteria |
| Bushi | Tactical officers and advisors. Crossed swords under rising sun = the mind behind the blade | Navy/midnight blue, muted gold | Strategic high ground: overlook ridges, cool blue-grey stone, orderly pines, sunrise light |
| Buke | Noble defenders of the inner colonies. Trident mark = steadfast unity and defence | Olive / moss green, khaki, tan | Fortified, grounded lowland: moss, earthworks, palisades, olive-khaki grass |
| Ashigaru | Foot soldiers / labour force. Sprouting plant = growth through endurance | Deep forest green, olive, tan | "Foot soldier of the forest": dense green forest, farm fields, rice paddies, muddy trails |
| Kenshi | Swordmasters. Curved blade = focus, skill, deadly grace | Cool teal, steel grey | Calm and precise: bamboo groves, still ponds, raked-stone clearings, cool teal haze |
| Yamabushi | Mountain mystics and spiritual guides. Spiral = flow of energy through nature | Dark teal, icy-blue flame accents | Highest mountains: cliffs, waterfalls, mossy boulders, mystic blue mist and glow |
| Sohei | Monastic warriors. Cross and sun = enlightenment through conflict | Saffron orange, tan, brown | Warm temple mountain: stone steps, autumn orange foliage, golden haze |
| Wokou | Sea raiders and explorers. Wave and dagger = power of tides and rebellion | Dark brown leather, rust maroon, yellow lenses | Coastline: sea cliffs, sand, driftwood, rocks, sea fog, stormy sky |
| Warrior | Battle-tested frontline veterans. Cracked circle = will to fight against all odds | Rusted red-brown, burnt sienna | Battlefield: scarred red-brown earth, burnt trees, rocky canyons, smoky dusty air |

Friend villages (Queens, Cute & Creepy, Saints LA; Chumps not in registry yet): waiting on Miguel's descriptions.

## Village notes (newest last)
## Samurai terrain (dev 5eaef36, Oct 3)
- From Miguel's 3 inspiration images (golden hour, terraced stone, bamboo, cherry trees, karst pillars with waterfalls, cobblestone, crimson ant banners, dojo/library/forge/market buildings, palisade, burrow tunnels).
- Recipe `samurai`: terraces (3.2 m steps, 118–260 m), karst stone pillars (two scales via shape.spires), 32 m NW waterfall → pool → stream → pond, bamboo groves (170, clumped, culled >260 m), 14 cherry_blossom GLBs (45k tris each, culled >230 m), 6,500 pink flowers, 170 pines, rocks only beyond 245 m, golden sun tint, warm haze, cobblestone courtyard.
- Samurai layout is empty: buildings/banners/palisade/gate are placement work next (in admin), not terrain.

## Samurai building kit (dev 9a43c6d, Oct 3)
- 13 buildings designed in Blender (work/sam/models.py) from Miguel's Samurai art, rebuilt in-browser by `assets/samurai-kit.js` (no model downloads; one hidden template per type, placed copies are instances): Great Dojo, Library, Forge, Market Stall, House, Gatehouse, Palisade Wall, Watchtower, Well, Ant Burrow, Banner Pole, Training Post, Weapon Rack.
- Admin section "Samurai Buildings"; ASSETS `sam_*` (procedural, kit 'samurai'); move/rotate/scale/duplicate/delete/save/load verified headless. Doorways are lit recesses: place a Door (admin > Doors) in front to link a room. Fronts face −Z.
- Big ones get flat yards on new terrain (NEW_TERRAIN_PAD_TYPES / FOOTPRINTS); panel-spawned objects start on the ground.
- Miguel uploaded the files to dev via github.com (3c1b7e8 kit, 9a43c6d village.html); deploy READY. Future pushes: start tasks with the repo selected as a source (Claude GitHub app now has access); the browser/admin-token push route is no longer used.

## Samurai village built (dev a193f22 via Miguel uploads 8e233f1..a193f22, Oct 3; deploy READY)
- Terrain: recipe `samurai.village` (makeVillageShape in village-terrain.js): rect [-66,-62,66,92]; terraces dojo 4.6 m [-30,38,30,88], west 2.8 m (library+forge) [-60,26,-27,88], east 2.2 m (guest house) [26,30,60,88]; cobbled ramps (riser lines in shader); pave list = road, plaza, lanes, terrace paths (mask B channel → cobble in terrain shader); grey stone walls; walls blocked via decorBlocksPoint (slope > 1.1); 0.8 m 'paVillageGround' mesh (~63k tris), main ground sunk to −2 under it; heightAt analytic inside rect; pads inside rect don't flatten; 18k grass + 1.8k flowers in beds. village.html hides ct/pl/pa meshes only when villageGround exists; isVillageGroundPickMesh skips it (no per-frame rays).
- Kit: + sam_stone_lantern (emissive, no light). Layout samurai.json 222 objects incl. 55 collision boxes; portal moved outside gate (0,-66); guard + villager NPCs moved. Reload round trip exact. Hub/Ronin unchanged.
- Files for Miguel in Downloads/samurai-village/. PROD CAVEAT: prod (main) reads layouts from dev and lacks sam_* + village terrain → uploading samurai.json shows red placeholders / floating objects in prod Samurai until dev→main merge.

## Fixes (on dev d08d312 via Miguel uploads, Oct 3)
- Kit light follows getFakeLightStateFactor via window.SamuraiKit.setLightFactor (called in applyFakeLightState): emissive ×(.6+.7k); stone lantern ground glow decal (additive, alpha .7 at night, 0 by day). Kit emissive materials no longer frozen.
- Cherry trunk collision: TREE_TRUNK_TYPES {'cherry_blossom'} → circle blockers from the model's own vertices (bands 0–5% and 5–14% of height) per pitch/roll, then yaw+scale per tree (hub tree 1 has roll≈π). Terrain extras: trunkFromMesh. Samurai layout: 3 pivot proxies on cherries removed (219 objects).
- Back key: turns 180° at 9 rad/s then walks forward (tested with stand-in player).
- Miguel FPS on Samurai: 50–60.

## Wokou harbour village (dev 1afcc09 via Miguel uploads, Oct 3; deploy READY)
- From Miguel's 3 Wokou images (bay harbour, piers, junk with ant sail, boat shed, crane, terraced dojo with training yard, navy+gold ant banners, rocky pine slopes).
- Terrain: recipe.coast (makeCoastCap: shore z≈-32 in the bay, headlands to -104, beach .16 / cliff 1.4 slopes, sea bed to -26, islets past 110 m) + recipe.sea {y:-3, deck:0}. flatHalf 86 (hills closer). Village shape now applies on any base: terraces abs (quay 0, dojo 4.2, hall 2.6, trade 2.2), digs (harbour dredged to -7.5 right at the quay), dirt yards (G channel). Pre-village ground hm.Hb feeds the fine mesh.
- Sea: buildSea — 3200 m grid, CustomMaterial: depth texture (from H) → colour/alpha, shore foam, fresnel sky tint, 7 procedural wave normals, small vertex waves. Terrain shader: sand at shore/underwater, darker with depth. Decor kept above sea.
- Kit: kit remap (M.remap) for navy/gold variants; new builders wok_pier (deck walk surface via SamuraiKit.decks), wok_boat, wok_boathouse, wok_crane, wok_cargo, wok_fence + wok_great_dojo/hall/house/house_thatch/trade_house/watchtower/banner_pole. ASSETS water:'deck'|'float' (applyWaterLevel, absolute y in layout shift, noGroundSnap).
- village.html: sea blocks walking unless on a kit deck (villageOnKitDeck also skips wall/decor blocks on decks); ground below 0 skips courtyard floor constants when the recipe has a sea.
- Layout wokou.json 185 objects (60 collision boxes); portal on the quay (0,-23). Reload round trip exact; Samurai unchanged (dojo 4.6 / library 2.8).
- PROD CAVEAT: same as Samurai — prod lacks wok_* → hold wokou.json until dev→main merge or accept placeholders.
- Not done yet: sea surf sound; the X post's "clearwater" repo wasn't reachable (link cut off) — our sea is our own shader.

## Wokou sea surf sound (dev cb0614a, Oct 3)
- `startNewTerrainSurfSound(NT)` in village.html (next to the waterfall sound; started when `NT.sea`): Web Audio, no file. 9 s stereo pink-noise loop → body (lowpass 320) + wash (highpass 160 → swept lowpass, panned per wave) + fizz (highpass 2600). Each wave: rise → break (t+2.2 s) → wash back; 7–12 s apart, random size/side; storm ×1.3, heavy rain ×1.15.
- Loudness: `NT.surfSoundAt(x,z)` (village-terrain.js): shoreline distance field on a 4 m grid (chamfer, built lazily ~20 ms) → (1 − (d−6)/170)^1.2. Quay .99, dojo .29, hall .38, trade .44, 0 past ~175 m inland. Gain = level × 1.1 × master × ambience; 0 when Mute Ambience, indoors or tab hidden.
- Measured (default sliders, quay): −29 LUFS, peak −13.7 dBFS (Samurai courtyard bed ≈ −29, Ronin wind ≈ −25 in-game). Hub/Ronin/Samurai: no surf (checked headless).
- Known, not changed: the waterfall/stream sound ignores Mute Ambience and interiors (surf respects both).

## Faction emblems on banners (dev 3dd4f02, Oct 3)
- Miguel's Factions_Symbols.zip → assets/brand/factions/<faction>.png: white masks (text cut off; medallion logos keep mark + outer ring; Bushi from the jpg).
- Kit: bannerTex icon 'logo:<faction>' draws the mask tinted (async on image load). FACTION_BANNERS in samurai-kit.js = cloth/emblem colours per faction; material banner_<faction> is made on first use. banner_red = Samurai, banner_wokou + sail = Wokou. Wide variant (bannerTex(..., wide)) for noren curtains.
- Ronin banners (village.html buildRoninBanner): emblem plane (getRoninEmblemMaterial) replaces the torus sigil.
- Wokou lamps at night checked (yes: windows, doorways, hanging + stone lanterns with ground glow).

## Yamabushi village (dev 023e12c terrain, 279bab9 kit, 3f55912 layout, Oct 3)
- From Miguel's 3 Yamabushi images (cliff-top village, plaza + well + houses, retaining wall with burrow arches, stairs to the dojo terrace and training yard, two-storey library, thatched house, bridge to a pillar, waterfalls, green + gold banners).
- Terrain recipe `yamabushi`: recipe.mesa (makeMesa: pieces = main mesa [-64,-62,64,88] r16, landing [-13,-86,13,-56], pillar c(100,54,13); 52 m cliff drop with varying slope/ledges/bulges, fades by the peaks; T.mesaBlocks = off the edge not walkable). Village levels: landing 0, plaza +4, dojo terrace +10.5 (also the pillar). recipe.falls (buildFalls: auto-picked cliff waterfalls, ribbons + spray; waterSoundAt follows them; water sound starts when NT.falls). recipe.mist (buildMist: 3 drifting layers at -42/-33/-24). roads:false. Granite shading for mesa cliffs (MESA flag in terrain shader). extras.village: rim pines off the paving.
- Kit yam_*: great_dojo, library (2 floors), house, house_thatch, gate (noren), banner_pole, bridge (32 m, deck in SamuraiKit.decks; ASSETS absY → absolute height), burrow_arch, spirit_lantern (blue), shrine, bench, stone_weights. village.html: kit decks walkable in any village (onDeck no longer needs a sea).
- Layout yamabushi.json 227 objects / 55 proxies, generated by a Node script that uses the real terrain module (saved y = live y − (max(new, flatNew) − max(old, flatOld))); round trip exact; walk tests: bridge crosses, fences/deck sides/cliffs block.
- PROD CAVEAT: same as Samurai/Wokou (prod lacks yam_* + terrain).

## Buke village (dev 6a9564e terrain, 8f20660 kit, 2324845 layout, Oct 3)
- From Miguel's 3 Buke images (fortified canyon village: gate between stone bastions + stake palisades, canals with footbridges, well plaza, archive with stone base, strategy hall with map banner, training yard, great hall, tunnels in the cliffs, maroon + gold banners).
- Terrain `buke`: mesa with negative drop (-42) = basin with rising cliffs (pieces: main [-72,-80,72,96] r22 + gorge [-15,-112,15,-78]); mesa.rockAbove 11.5 (granite above, dressed stone below); levels gate yard 0, plaza 2.5, archive terrace 6, great hall 10; village.digs canals + village.pools water (buildPools), water sound near canals.
- Kit buke_*: great_hall, archive, strategy_hall, house, gate (bastions, braziers), banner_pole, footbridge (deck, absY), canal_spout (absY), post_lantern. FACTION_BANNERS.buke = maroon #5e1a20 + gold #d8b35c (art colours; trident emblem).
- Layout buke.json 210 / 50 proxies from the generator (scratch script pattern as Yamabushi; NPC live y = max(ground, flatNew) so the round trip is exact). Walk: footbridges cross, gate passable.

## Stairs + boardable ships (dev 9f58abc, 406a54d, Oct 4)
- Kit decks can be ramps: { x, z, halfX, halfZ, y0, y1 } (y0 at the deck's -z end) → walkable kind 'ramp' surfaces (type 'kit_deck', so walls/cliffs they cross don't block on them). addKitDeckSurfaces follows non-uniform scale (x width, y rise, z run).
- Pieces (admin > Stairs, any village): kit_stairs_stone, kit_stairs_wood (4 m rise, 6.4 m run + top landing), kit_stairs_cliff (12 m, two flights + landing). Bottom faces -Z.
- mesaBlocks: canyon basins (drop < 0, Buke) block only steep cliff faces (slope > 1.1), so ground above is walkable after climbing; ravines (Yamabushi) still block.
- Wokou: wok_boat deck walkable (y 1.05 local, ±1.7 x ±3); wok_gangplank (pier 0 → -2, water:'deck'); pier decks halfZ 4.5. Layout: gangplanks to both ships, ship 2 moved to (-31,-56) broadside to its pier.
- Headless walk tests need fixed 60 fps steps (engine.getDeltaTime = () => 16.7), short camera.maxZ and hidden decor, else one swiftshader frame jumps metres and skips step-down tolerances.
- Miguel saw the Wokou piers blocked: on dev they are walkable (tested); the live site lacks the harbour kit until dev→main.

## Oct 4 fixes + Kenshi (dev 8f80ea3..a0dcaf9)
- HUD: updateVillageChrome now runs at once (DOMContentLoaded had already fired) → panel/logo show the current village. Exit Walk button moved beside the rebel panel (left 340 px; bottom-right under 480 px).
- Stairs: STAIRS spec in samurai-kit.js; each placed staircase builds its own meshes at its real size (root scale undone), ~0.3 m steps (stairsSteps), rebuilt on rescale (refreshStairs from addKitDeckSurfaces); walk surface stepped per tread (villageRampHeightAt), step-up from 62% of a tread. Miguel's Buke cliff stairs (x3.84/3.47/6.37, 41.6 m to the cliff top) climbs in 0.3 m steps; its first ~9 m are buried in the 6 m terrace (base height comes from its centre).
- Miguel saves layouts with Hard Save (P) → commits on dev ("save: world layout"); pull before editing that village's json.
- Kenshi terrain `kenshi`: compound terrace 3.2 m (wall .6, res .8), yard 4.8, dojo terrace 6; lake north via coast.north (+ sea.surf false), flatHalf 80, bamboo/cherry/pines extras. Kit kenshi_* (dojo, library, hall, house, gate, forge, banner_pole, well_pavilion, watchtower, wall_fence); FACTION_BANNERS.kenshi teal #1f5753 + gold #d8b450. Layout kenshi.json 193 / 37 proxies (gen script pattern; ground outside the rect = hBil(hm.H)).
- Shared terrain fixes: wall mask in ground mask alpha → terrace walls fully stone; big terrain pushed only just under the village edge within one cell (dark groove gone) + skirt; no grass/flowers on dirt yards; village shape applied over the whole rect even past flatHalf+4 (Wokou dojo cobble past z 90 and Yamabushi pillar paving now painted).

## Kenshi lake sound, birds, Sohei (dev 6adb534..8e1e1a2, Oct 4)
- Lake sound: sea.surf 'calm' → startNewTerrainSurfSound lap() (soft slaps 2-4 s apart), level 1.6 × near^2.4; Kenshi shore −35 LUFS. sea.surf false = no surf sound.
- Birds (buildBirds in village-terrain.js, all new-terrain villages): 3 flocks × 8, one thin-instanced mesh (V wings flapped by squashing the instance matrix), 1 draw call, 72 tris, ~0.03 ms/frame; hidden at night (fake light factor ≥ .6) and in storm/heavy rain (applyFakeLightState). recipe.birds { flocks, perFlock, color } or false.
- Sohei terrain `sohei`: compound 3 m, middle 4.5 (library/hall/yard), back 6.5 (dojo, shop, pond, zen garden), bell platform 8.5; village.digs { depth } digs a pond into a terrace; autumn maples = cherry_blossom extras with tint [1.35,.62,.22]; hills .8. Kit sohei_* (great_dojo, library, hall, house, shop, gate, banner_pole, wall, bell_tower; material bronze); FACTION_BANNERS.sohei gold #c38d2a + cream. Layout sohei.json 186 / 38 proxies.
- Performance notes for Miguel's next adds (chests, NPCs, challenges): kit pieces are instances (cheap); costs come from unique meshes, real lights, big GLBs (cherry_blossom 45k tris each) and shadows.

## Layout cache vs browser storage (dev c95af98, Oct 4)
- Bug: Sohei loaded empty for Miguel. All village layouts are cached in localStorage (~3.5 MB + Hub mirror + backups); past the ~5 MB quota, storeRemoteLayoutInCache threw QuotaExceededError → loadWorldLayout found nothing.
- Fix: layout writes go through layoutStorageSet (evicts other villages' clean copies, backups, the old 'rebelAntsWorldLayout' Hub mirror; retries; else keeps it in memory with a toast). Reads use getLayoutCacheRaw (memory first). Headless repro: preset storage full → 186 objects (was 0).

## Walking light, cherry tree, Ashigaru (dev 2583069..., Oct 4)
- Walking light (followLight) never reached the new terrain: 'visual_backdrop' meshes (terrainFar, edge skirt) share terrainMat, so optimizeStaticRenderRoot froze it with 2 lights. Materials with metadata.perfKeepLive are skipped (terrainMat sets it). On new terrain the light scales with the fake-light factor (window._walkLightK: x0.18 by day -> full 2.8 at night); Hub unchanged.
- cherry_blossom.glb rebuilt (gltf-transform + meshoptimizer, scripts in the session scratchpad gt/opt.mjs + rehier.mjs): 12 meshes -> 2, bark 30k -> 5.4k tris, blossom cards untouched; 45.2k -> 20.6k tris, 2.5 -> 1.4 MB. Node hierarchy (Sketchfab_model rotation -> group -> meshes) must stay, else placed trees lie on their side. Same-camera renders: pixel diff < .35/255.
- Ashigaru terrain `ashigaru`: dry grassland, round mound (terrace c: [0,0,70], h 2.4, edge 3.6), V moat (dig ring [0,0,72,85], depth 3.6, edge 5.6) with a stream (pool c + ring), dirt plaza/paths. makeVillageShape now takes c (disc) / ring shapes and per-terrace edge; pools can be discs.
- Kit ashi_*: great_dojo, archive, strategy_hall, house / house_tile / house_brown (roof_brown tex), gate (two towers), watchtower, banner_pole, palisade(+_banner) 8 m, bridge (20 m ramp deck y0 0 -> y1 2.4, absY; layout scales y/z to fit), workshop, barricade, stake_fence, target, log_pile. FACTION_BANNERS.ashigaru = crimson #8c1c1c + gold (art).
- Layout ashigaru.json 399 items / 194 proxies (gen script pattern; palisade = 50 rotated segments at r 66, ry = -theta - pi/2; outer rail fence on the front arc; rocks on the moat banks). Round trip exact.
- Headless walk tests: HIDEKIT=1 in run.mjs walktest hides layout meshes (~0.14 m/s walking at fixed 60 fps steps).

## Hub book, Ronin rebuilt (dev fc2ae16..., Oct 4)
- Hub: the two 'book' items in the courtyard layout removed (one by the cherry tree, one leaked from the library room). The real book lives in interior_room_configs > rebel_library. Edit layout JSON with Node (JSON.stringify(_, null, 2)) so number formatting stays identical.
- Ronin terrain `ronin` (replaces the old dark-hills recipe): mesa fortress (pieces main [-66,-56,66,74] r18 + causeway [-11,-92,11,-50]; drop 48), falls 7, blue mist; terraces fortress 2.6, library/strategy 5.4, yard 5, dojo 8; ramps must start ~1 m inside the lower terrace (its edge falloff makes a dip otherwise -> wall-blocked).
- recipe.hour (villageClockHour: sky + fake-light factor) = Ronin always 21:30; recipe.moon { sun, hemi, color } = brighter blue moonlight at night.
- Kit: organic helpers in samurai-kit.js (vnoise, smoothGrid, spline, curveTube, blob; exposed as SamuraiKit._org for debugging). Blob normals: smoothGrid's grid normals point "inward" by its winding convention; explicit normals must use the same sense or they render black.
- ronin_bonsai (~56k tris, plaza centrepiece), ronin_great_dojo (U of halls round the emblem floor; walkable platform deck + steps), ronin_library, ronin_strategy_hall, ronin_house(_large), ronin_gate, ronin_wall(_banner), ronin_lantern_pillar, ronin_rail, ronin_well, ronin_dummy, ronin_banner_pole, ronin_brazier, ronin_shrub, ronin_rock_garden. FACTION_BANNERS.ronin = art crimson #6a1a1d + cream; emblem = Ronin handprint logo (the art shows the ant).
- Layout ronin.json 341 / 165 proxies (gen script pattern); keeps npcId ronin-guard-01 (Ronin Watcher, dialogue ronin-first-warning, quest first-warning) and ronin-wanderer-01. Old 74 pieces (ronin_banner/mist/dead trees/altars/glows, 2 chests, signs) removed.

## Bug fixes before the first big main merge (dev f4f23ed..23859b3, Oct 4)
- Ronin started in daylight for ~30 s: villageRecipe() reads the recipe from NEW_TERRAIN_MODULE (loaded at startup) for hour / light / moon; updateSky runs again once window._newTerrain exists.
- Stairs blocked (Sohei dojo terrace): makeVillageShape ramps hold their start height for a wall-width before lo (the lower terrace's edge falloff made a dip -> isWall). Garden extras (village: true) skip pools, digs and dirt/sand yards (villageWet + dirt).
- Shops/trade houses: board banner moved off the door (left wall, 2.1 m) + faction noren (new noren_wokou); house banners off the front window (x -3.05).
- Footprints: SandPrints in village.html (thin instances, 72 prints, per-print alpha, window._sandPrints.full/fade seconds) on villageShape.dirt > .5 or beach sand (sea villages).

## Sand tone, Bushi (dev af11432..., Oct 4)
- Yard sand: terrain shader uses palette.yard (default: palette.dirt x .6, desaturated 20%) inside the village rect with grain; village.rake: [{ ring: [x,z,r] } | { r: [..], axis: 'x'|'z' }] draws raked rings / lines (Sohei lines, Kenshi rings + lines, Bushi rings + lines). Pave rects must not cover a dirt yard (pave wins).
- Bushi terrain `bushi`: dry tan grass, pale granite rocks, fortress platform 1.2, raised sand yard 2.0 with steps, dojo terrace 4.4 with great stairs; gate steps from 0.
- Kit bushi_*: great_dojo (front A-gable + crest), library / strategy_hall / gate (Ronin builders via M.remap2, an outer remap layer), forge, storehouse, house(_thatch), wall (5 m), tower, banner_frame, banner_pole. FACTION_BANNERS.bushi = art crimson #7d2b22 + gold, crossed-swords emblem.
- Layout bushi.json 336 / 144 proxies (gen script; halls x1.35, dojo x1.2, houses x1.2 to match the art's proportions); kenshi_well_pavilion reused for the well.

## Warrior (dev dc1bc98 terrain, f14f3af kit, layout next, Oct 4)
- From Miguel's 4 Warrior images (square stake fort on golden grassland, dry ditch, gate tower, corner watchtowers, house rows with gardens, covered well, fenced sand yard with chalk lines, great dojo on a stone base, forge, thatched storehouse, two-storey house, hall with gold wheel banners; green + gold banners, torches).
- Terrain `warrior`: fort ground .5 m, dry ditch = dig { rr: [x0,z0,x1,z1,w], depth, edge } (new square-ring shape; also for terraces), causeway ramp 0 -> .5, all dirt inside; village.chalk [[x0,z0,x1,z1,width]] paints lines on the yard. wallStart must stay < 352 (else the edge mountain wall covers the whole map).
- Kit war_*: great_dojo (walkable deck + stairs in SamuraiKit.decks; walls() open: true = bay without the lit recess), hall, house_large, forge, storehouse, house(_thatch), well, gate, watchtower, palisade(+_banner), torch, spear_rack, sawhorse, target, fence, banner_pole, garden, tree, bush (leafy, blob crowns). FACTION_BANNERS.warrior = art green #34502e + gold (cracked-circle emblem).
- Layout warrior.json 439 / 222 proxies (gen script; palisade 8 m segments at x ±62, z -62 / 66; dojo walls proxied, its floor walkable). Walk: causeway + gate pass, dojo stairs up (y 2.2), walls / palisade / yard fence / ditch bank stop.

## Shogun (dev e0ba57e terrain, 043bed3 kit, layout next, Oct 4)
- From Miguel's 4 Shogun images (hilltop castle: battered stone walls + white parapets, corner turrets, gatehouse up stairs; lower court with houses, covered well, garden pond + arched bridge; walled middle terrace with raked yard, great dojo, library, strategy hall; top terrace with the keep, shrine, storehouse; purple + gold banners).
- Terrain `shogun`: mesa hilltop (drop 30) + approach; terraces court 3, middle 7.5, top 12.5; central + side stairs; pond dig c + pool; garden pines + red maples (cherry tint) as village extras.
- Kit shogun_*: keep, turret, wall, gate (Ronin gate via remap2), inner_gate, great_dojo (Warrior dojo + gable/crest, hangings, screen, cushions; deck = war_great_dojo's), library, strategy_hall, shrine, storehouse, house(_large), bridge (arched: two ramp decks, absY), rail, banner_pole. Helpers batter() (battered stone) and shogunGable(). FACTION_BANNERS.shogun = art purple #5f1d45 + gold.
- Layout shogun.json 444 / 225 proxies (gen script; wall segments sit at the lower end where they cross a terrace step). Round trip exact; walk: gate stairs, central / side / top stairs, dojo stairs, bridge climb; walls and the terrace edge stop.

## Warrior + Shogun done (dev 22a632c Warrior, a5ebbf9 Shogun, Oct 4). Rebel Ants faction villages complete; friend villages next.

## Cute & Creepy (dev b2cf90f terrain, 2698c00 kit, layout next, Oct 4)
- From Miguel's 4 images (haunted hilltop: iron gate with pumpkin pillars + skeletons up wooden steps, cobbled lanes, giant dead tree with hanging lanterns, well, witch's cottage + green cauldron, library with book sign, game hall with dice sign, crooked cottages, graveyard + crypt, gothic manor with turrets + spider banners, scarecrow yard, ghosts, fog, purple moon).
- Terrain `cute-creepy` (village id has a hyphen): hour 22.5 + moon light, recipe.moonDisc { pos, size, color, halo } (updateSky moves / recolours the sky moon, unfogged), mesa drop 34 + spires, mist layers incl. a thin one at 2.4 in the lanes, purple fog .0034. Terraces court 1.2, graveyard 2.2 (back left), manor 3.6, witch 2.6.
- Kit cc_*: manor, library, game_hall, witch_hut, cauldron, cottage(_b), crypt, graves, great_tree, dead_tree, gate, fence, lamp, pumpkin(s), well, scarecrow, ghost, candles, bench, banner_pole. Helpers steepRoof, gwin (gothic window), archPts, dormer, ironCrest, ccPumpkin, ccSkeleton... Materials: MAT tint (textured, tinted) and alpha (ghost). Ghosts float: SamuraiKit.animate (scene observer added on the first ghost) bobs the instances, not the root.
- Layout cute-creepy.json 425 / 109 proxies (gen script; iron fence runs share one blocker per run). Round trip exact; walk: gate steps, graveyard ramp, manor stairs climb; fences and the manor stop.

## Cute & Creepy fixes + the gang (dev 92fb5f2..., Oct 4)
- Black line round every village = villageGroundSkirt with cancelled normals (two-sided, normals computed over both faces); normals now point up.
- recipe.groundFog { area, y, count, size, color, alpha }: buildGroundFog particle system of soft fog billboards (pre-warmed). Cute & Creepy 420 banks.
- Ghosts loop 3-5 m (SamuraiKit.animate); cc_ghost is in PERF_DYNAMIC_TYPES (the optimizer froze world matrices -> ghosts jumped once per pass). Anything animated must be a dynamic perf type.
- The gang from Miguel's NFTs (uploads were AVIF: Pillow 12 opens them; attachments in chat failed, files under /root/.claude/uploads work): cc_flower_moon, cc_nariko, cc_ostara (kokeshi), cc_mamoru, cc_mochi (lucky cats). Kit: CHAR (rock/bob body node) + SUBPARTS (paws wave, flame flickers, orb pulses) on pivots; faceSphere / lathe / hairBob helpers; face/kimono/coat canvas textures.
- NPCs: fallbackType 'kit:<type>' -> createPlaceholderAntNPC builds the kit character (holder rotated PI). Layout: Mamoru gate guard (patrol), Flower Moon by the great tree, Mochi at the game hall, Ostara at the library, Nariko in the graveyard, each with customDialogue (ant NPCs replaced).

## Admin NPCs + Chumpz (dev bd7b09c..., Oct 4)
- Admin > NPCs: 'Mystic Moons' row (NPC_LIBRARY mystic_moons_*: the five Cute & Creepy characters, any village) + a Model select on the selected NPC (Ant or a kit character; swaps on Apply). window.createNPCFromLibrary exposed (tests).
- Chumpz registered (VILLAGE_REGISTRY chumpz, FACTION_VILLAGES, api/world-layout.mjs VILLAGE_IDS). Apes: Miguel will send 5 NFTs for NPCs (same pattern as the Mystic Moons).
- Terrain `chumpz`: coast + calm turquoise sea (y -1.6, deck .8), village ground abs .8, quay dig to -3.4 along the boardwalk, sand shapes, jungle hills. Terrain scatter takes spec.kit (SamuraiKit.protoMeshes): palms (pines slot) + banana plants.
- Kit chz_*: bar (walkable deck, giant banana sign), bait_shop, dice_hall (walkable floors), shack(_red), hut, smokehouse (smoke puffs, alpha), fish_rack, banana_well, dock / pier (water 'deck'), rowboat / sailboat (lofted hulls chzHull, water 'float'), barrels, crates, bottles, table, lantern_post, net_line, lilypads, palm, banana. steepRoof scales tin_roof UVs x.25 (2 m patches).
- Layout chumpz.json 327 / 160 proxies (gen script; water pieces absolute y). Placeholder ant NPCs: Bartender, Old Fisher, Dice Dealer, villager (swap to apes later). Walk: boardwalk + pier walkable to their ends, bar steps up, bar counter / quay wall stop.

## Chumpz apes + playable ape (dev 3c0938b kit, a39ca0e NPCs, next playable, Oct 4)
- Miguel's 5 Chumpz NFTs (AVIF with alpha; Pillow) -> kit chz_ape_{racer,band,chain,peel,peng} (APE_LOOK in samurai-kit.js: colours, outfit, hat, glasses). ~3.3 m tall (rebel ~3.4), ~9.5k tris each.
- Rig: APE_J joints / APE_TREE; each joint is a part type `<type>__<joint>` authored in rest pose and offset by Kit.o (poly + smoothGrid subtract it). buildApe makes the pivots; animateApe drives idle / walk / run from the root's measured speed (stride 2.6 + .25 v m), keeps the lower foot on the ground (body drop from leg reach), one-shots via SamuraiKit.actorAction(root, 'jump'|'kick') (t0 set on the next animate tick). Head pivot scaled 1.2 (APE_HEAD_K).
- NPCs: chumpz.json bartender = Big Chain, fisher = Pengu, dealer = Peely (x 27, faces the door), villager = Banana Band (wander). NPC_LIBRARY chumpz_* + admin 'Chumpz Apes' row + Model picker. getNPCGroundHeightAt = ground or kit deck; NPCs re-check once a second (refreshVillageCollisionBlockersIfNeeded first: walk surfaces only exist after a rebuild).
- Playable: index.html FRIEND_PLAYABLES (card chumpz_racer, image assets/lobby/chumpz_racer.jpg, playerModel 'kit:chz_ape_racer', badge Ready; guest: after #001; wallet: after the ready Rebels, never the default). selectAnt stores it without Forge lookups. village.html resolveCharacterConfig returns a procedural config for playerModel 'kit:*'; the loader builds the kit character under playerRoot (holder rotated PI, scale 1, shadows), animGroups 0-4 are stand-ins (F/Space play kick/jump); groundPlayableVisualToTerrain puts the root's y on the ground (no bounds, no starter -1.65 offset) so the jump lift shows.
- Oct 5: Miguel wants the playable Racer to look like the Forge Rebels (sent a realistic full-body render). Forge reference mode (forge-v2.html ?col&token&ref&species&name, admin): render = clean reference, then back/sides (species prompts), Meshy, rig. Racer = chumpz #900001 (rebelId chumpz_900001), render assets/forge/sources/chumpz_racer_production_ref_v1.png. Lobby friend cards fetch their active Forge character (attachActiveForgeCharacter); with a forgeRigGlbUrl the village plays the rig (forged_rig_auto), else the kit ape. Friend collections get no Rebel weapon. Link for Miguel: /forge-v2.html?col=chumpz&token=900001&ref=/assets/forge/sources/chumpz_racer_production_ref_v1.png&species=ape&name=Chumpz%20Racer -> forge, pick a version, "Make this my Rebel".

## Fixes + Saints of LA (dev, Oct 5)
- Forge rigs: the kit-player change broke GLB player loading (basePath '' + '/assets/character/' prefix) -> fixed e87c19a. Friend-collection rigs keep their own untextured colours (loader palette fill was for the starter ant).
- Spawn feet sunk in floors: walk surfaces only existed after the first move and decks > 0.85 m above ground were never taken. getVillagePlayerGroundHeightAt: on spawn / teleport (> 3 m jump) and when new kit decks appear, for 2 s a kit deck under the player wins (_playerDeckSnapUntil, var-declared: rebuild can run early).
- Queens village removed (registry, gate list, NPC maps, api VILLAGE_IDS).
- Saints LA terrain 'saints-la': recipe.city { gx 132, gz 144, cx -66, cz -52, w 14, sw 4, extent 246 } = street grid in the terrain shader (asphalt, yellow lines, dashes, crosswalks, sidewalks, red corner curbs); city pave = concrete slabs. Block = village rect [-59,-45,59,85]; court plaza 2.0, HQ terrace 4.6, ramps = steps. Soft dry hills (wallStart 296).
- Scatter spec.at [[x, z, yaw, scale, y?]] = explicit placements (+ blockBox [hx, hz] circle blockers); saintsCity() in village-terrain.js places lots (sl_lot_a-d) on the other blocks, towers on the hills back left, the hills sign (150, 322), palms / lights / poles along sidewalks, parked cars.
- Kit sl_*: hq, arena, library, game_hall, garage, apartments, market, court, cars (blue/gold/purple lowriders, red/black/white), palm_tall, streetlight, util_pole, planter, bench, lot_a-d, tower_a-c, hills_sign. Facade textures tile per storey (TILE + wrapV; canvas textures only wrap U by default). Hills sign text 'HOLLYWOOD' (trademarked landmark: swap the word in sl_hills_sign if needed).
- Layout saints-la.json 143 / 76 proxies (gen_sl.mjs pattern). Portal (0,-37) on the street in front of the steps (walk tests must not start inside it: the gate menu freezes walking). Placeholder ant NPCs: greeter, mechanic, court regular.

## Quest template: Hub + Ronin (dev d2360dd..5d40cf6, Oct 5)
- Plan (approved by Miguel): 260 challenges = Hub Journey 20 + Book One main 50 + side 30 + friend-village quests 60 (20 each) + 100 secrets (Hub 10, Rebel villages 6, friend 8); 100 chests (5x1000, 10x500, 15x100, 20x50, 25x25, 25x10 = 13,375 Rebel points); 72 badges; 3-5 rooms per village later. Artifact: claude.ai/artifact/2GcDkWox6yz3PMTitmCNXj. The Canva book is the very last step.
- Quest Spots (type quest_spot, metadata.spotConfig; Admin > Quest Spots): press O to inspect/read/listen/light/ring/hold N s, or reach; requires time (night/dawn/day/dusk) / weather / minY with a hint; secretId; glint quest/always/none; countBy 'weather'; absY; miniAnt. Spots ground themselves once _newTerrain exists.
- Quest runner: multi-step + counted steps (advanceConfiguredQuestObjective). BOOK1_WIRING.main[n] = steps { id, objective, objectiveType, targetNpcId / targetObjectId (spot id prefix, collectible id) / targetVillageId, count, villageId, say[] }. The main chain continues while the next quest is wired (now through main 10). Talk-step NPCs say step.say and beat the gate/door next to them. Auto guide marker (questTargetAutoGuide, runtime only) follows the target or the village gate ("To Hub Village").
- Side quests: BOOK1_WIRING.side[n] = { giver, offer[], steps }; SideQuestState in localStorage rebelAntsSideQuests:v1; advanceHubTutorialObjective = side + main (NPC events pass _sideDone). Wired S1-S6 (Hub + Ronin).
- Secrets: SECRET_DEFINITIONS (+ miniAnt flag), SECRET_TOTAL 100, journal Secrets tab per village. Hub 7/10 placed (First Seal, Hidden Shelf, Dark Cabinet wait for rooms), Ronin 6/6.
- Chests: CHEST_TIERS wood/iron/gold/silver/treasure/legend (10..1000), Admin > Chests sets the tier; looted per player (ProgressionState.chestsOpened), never saved as opened; coin burst + #rebelPointsPop; ProgressionState.rebelPoints + rebelPointsLog (synced:false) and event rebelAntsRebelPoints wait for the Rebel economy link. Hub 9/10 (legend in the tunnels room later), Ronin 6.
- Badges: 72 (46 generated after DEFAULT_BADGE_DEFINITIONS), checkAutoBadges on every progression event; medallion art drawn in the browser (faction emblem) unless admin uploaded art.
- Mini ants: spot with miniAnt -> small-village-ant.glb copy only within 30 m; whispers the next unfound secret's hint.
- Headless quest tests: dismiss #questCelebration (it pauses play), re-teleport to moving NPCs before O, wait for the exact prompt text; never run two browsers at once against python http.server; never `pkill -f` a pattern that matches your own shell.

## NPC animations (dev 97292e2..27d79f4, Oct 6)
- Miguel's Mixamo NPC pack (scratchpad mixamo/, FBX -> FBX2glTF) retargeted by tools/retarget-mixamo.mjs onto Kenshi (Mixamo rig, FEET=-94) and the 6 Meshy villagers (FEET=0; Spine02/01/Spine/neck = Mixamo Spine/Spine1/Spine2/Neck). Clips: Talking, Talking2, Waving, WaveShort, Bow, Pointing, PickUp, NodYes, ShakeNo, Clapping, Rallying, Yelling, LookAround, IdleLooking. Then resample(3e-3) + Draco (meshopt dropped the skin). Each GLB 0.7-0.9 MB.
- playNPCGesture (village.html): talk opens -> WaveShort, finished -> Bow, or NodYes when the talk moved a quest on (NPC_GESTURE_CLIPS); NPCs without the clips skip it.
- Oct 6 v2 (c7cc637): all 11 faction villagers replaced by Miguel's Forge-rigged set (65-bone mixamorig_ + 5-finger glove hands + cloth/antenna bones, 17 clips baked in; Idle = hands behind the back). Resampled 2 -> 0.64 MB. NPC_LIBRARY <faction>_villager for all 11 (new: buke, sohei, wokou, yamabushi), clip map Idle / Walking / Running / Talking; modelScale = 3.35 m / model height. retarget-mixamo.mjs is no longer needed for these.
- Oct 6 v2 fix: the Forge set's arms swung behind the back (clips copied from T-pose sources onto A-pose models). All 17 clips rebuilt with tools/retarget-mixamo.mjs ALIGN=1 (first poses the model into the source's rest bone directions, then applies the motion) + FINGERS (keeps the Forge relaxed glove pose, from tools/npc-strip-clips.mjs). Sources: Rebel ant idle/walk/run + Miguel's Mixamo pack (scratchpad mixamo/glb). 0.63-0.68 MB each.
- Oct 6 v3 (posture): the Rebel ant's idle/walk/run are hunched (body leaning, head down, splayed stance, bent wrists). Villager Idle/Walking/Running now built with SKIP='^(Left|Right)Hand$' (wrists straight), STRAIGHTEN on Spine..Head (+ legs/feet for Idle) = the clip's average offset from the model's rest removed, motion kept. Retarget samples at an even 30 fps. Recipe per villager: npc-strip-clips -> retarget Idle (ant_idle_c) -> Walking/Running (ant_walk_c/ant_run_c) -> 14 gesture clips (ALIGN only) -> animslim 3e-3. The old Meshy Idle_11/Walking/Running are not usable as sources (labels/timing off).
