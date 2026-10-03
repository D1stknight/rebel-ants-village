# CLAUDE.md — Rebel Ants: The Hidden Village

Read this first. It is the hand-off from the Cowork sessions (Sept–Oct 2026) so a new Claude Code session can continue.


## How this repo is worked on
- Work on the `dev` branch; push with plain git. Production = `main`, updated only by merging dev via a PR when Miguel says so.
- Vercel builds every push to dev (preview URL `rebel-ants-village-git-dev-miguel-concepcions-projects.vercel.app`); check the deploy after pushing.
- More notes live in the claude.ai project "Rebel Ants Universe" (docs `claude/handoff.md`, `claude/village-terrains.md`); this file carries the essentials.

## Where things stand (Oct 3, late night)
- dev = 3f55912 (+ this CLAUDE.md commit). On dev: Samurai village, fixes (night lanterns, cherry trunk collision, Back key), Wokou harbour village + surf sound, faction emblems on banners, Yamabushi village (terrain + kit + layout). Miguel: NOT to main yet, keep building villages.
- This repo is now attached to Claude Code sessions: Claude commits and pushes to dev directly (plain git), then checks the Vercel deploy (Vercel MCP: project prj_CjuIvsLXKinzfIgUkmSkyWhKWqtc, team team_7tWG3HhBf0Ir5h0Hhz9ZAarq).
- If the chat has NO repo attached: Claude builds + tests, delivers files to Miguel's Downloads/<name>/, Miguel uploads on github.com (dev branch), Claude then verifies dev matches (git fetch + diff) and checks the Vercel deploy. Do NOT push via the admin page / upload token in the browser (blocked by a safety check).
- Production reads layouts from dev but lacks the Samurai + Wokou + Yamabushi kit/terrain → those live villages show red placeholders until dev → main merge.

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
