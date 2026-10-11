# Rooms registry (61)

Every room behind a village door, what it looks like, and its build state. Use this when building a room so that no two look
alike. The visual tracker (thumbnails) is the claude.ai artifact "Rooms Tracker"; this file is the source of truth.

Rules
- Each room has one **signature**: a centrepiece no other room uses. Don't repeat one.
- Palette = the faction's colours (CLAUDE.md faction table; banners from FACTION_BANNERS). Shapes vary: hall, long gallery,
  round chamber, vertical atrium, cave, tunnels, shaft, ship hull, low vault, cottage.
- Built as kit rooms (`SamuraiKit.rooms`, `room_<village>_<name>` in assets/samurai-kit.js); door = an `interior_entrance`
  at the building's doorway with `interiorDefinition.kit`; NFT frames + hotspots in the village layout's
  `interior_room_configs`. Faction rooms hang 6-8 NFTs of their own gang (trait "Gang Names").
- The door building must let the player reach the door without being buried (decks / collision proxies, see the Samurai
  dojo in 2026-10 notes).
- Status: built / planned. Sizes in metres (width x depth, height).

| # | Village | Room | Kind | Door | Size | Signature | Palette · light | Status |
|---|---|---|---|---|---|---|---|---|
| 1 | Hub | Rebel Library | lore | dojo_6 (82,74) (76,81) | 36x44, 11 | book-lined hall, The Warning screen between red curtains, the Book on a lit lectern dais | dark wood, plaster, red, gold · amber lamps, cool screen | built (room_hub_library) |
| 2 | Hub | Rebel Arcade | games | dojo_6 (-76,81) (-83,75) | 44x40, 12 | 16 neon cabinets (4 games), big screen in a red torii, emblem in a neon ring | indigo, black lacquer, neon pink / cyan / purple / gold | built (room_hub_arcade) |
| 3 | Hub | Gathering Hall | gathering | south dojo_7, front, up its ramp (0,-86) | 48x40, 13 | festival canopy of paper lanterns over the whole hall + the 15 village banners round the walls; raised hearth, music stage, event board | honey cedar, red lacquer, gold · warm lantern light | built (room_hub_gathering) |
| 4 | Hub | Video Theatre | video | south dojo_7, back (0,-101) | 32x44, 12 | tiered cushion seating rising to a projector booth (beam), kabuki proscenium with a striped curtain round the screen | black, persimmon, deep green, gold · dark, stage light | built (room_hub_theatre) |
| 5 | Hub | Ancient Hub Tunnels | lore / quest (M49, First Seal) | sealed chamber, old scout path (0,-147) · sealed until book1-main-48 | tunnels + 30 m round chamber | root tunnels through earth to the Great Root Chamber: the round carved First Seal and the Thing Below | dark earth, roots · teal fungi glow, amber crystals | built (room_hub_tunnels) |
| 6 | Hub | Forest Dojo | training | a forest dojo_9 (-101,-267) | 34x30, 10 + roof well | a living tree grows through the floor and out of the roof, light shafts, training dummies in a ring round it | moss green, natural wood · dappled sun | built (room_hub_forest_dojo) |
| 7 | Ronin | Shadow Dojo | training | ronin_great_dojo (0,59) | 36x30, 9 | black mirror floor crossed by bars of moonlight from roof slits; giant handprint on the far wall | black, crimson, moon blue · very dark | built (room_ronin_shadow_dojo) |
| 8 | Ronin | Strategy Room | lore | ronin_strategy_hall (42,12) | 18x14, 6 | wall of targets joined by red strings; one candle on a low map table; a half-open hidden weapon wall | dark wood, black, crimson thread · candle | built (room_ronin_strategy) |
| 9 | Ronin | Hall of Debts | lore | ronin_library (-41,12) | 10x44, 10 | long gallery of thousands of hanging debt tablets on red cords; black stone altar with the red handprint and one flame | grey stone, pale tablets, crimson · flame, low mist | built (room_ronin_debts) |
| 10 | Ronin | The Old Door | quest (M29, M45) | rock door, rock-garden passage (-9,71) · sealed until book1-main-44 | 30x36, 16 rock-cut | colossal granite double door carved with every faction emblem, two ant guardian statues, moonlight through a ceiling crack | dark granite, crimson rope · moonlight | built (room_ronin_old_door) |
| 11 | Samurai | Great Dojo | training | sam_great_dojo (0,55) | 40x32, 9 | tatami square, columns + raised nave, dais with the banner on a gold-leaf screen, armours | wood, plaster, crimson, gold · golden daylight | built (room_sam_dojo) |
| 12 | Samurai | Library | lore | sam_library (-37,41) | 26x22, 8 | honeycomb walls of scroll cubbies, low calligraphy desks, round moon window onto an indoor maple garden | warm wood, crimson, paper, gold · golden light | built (room_sam_library) |
| 13 | Samurai | Forge | craft | sam_forge (-39,68) | 24x20, 9 | the great charcoal hearth (glowing coals, flicker light) under a smoke hood, box bellows, anvils, blades in stages | charcoal, iron · orange fire | built (room_sam_forge) |
| 14 | Samurai | Ancestor Hall | video | a sam_burrow (-79,40) | 24x30, 7 earthen vault | tiered altar of ~200 gold ancestor tablets with candles up the back wall; film on a painted scroll | dark earth, gold, red · candlelight, incense | built (room_sam_ancestors) |
| 15 | Shogun | Throne Room | quest (M36) | shogun_great_dojo (0,51) | 50x34, 12 | The Shogun Table: 26 m table with 12 seats and faction banners; throne under a gold canopy with wisteria | purple, gold, black lacquer · gold-lit | built (room_shogun_throne) |
| 16 | Shogun | Court of Records | lore | shogun_library (-39,38) | 30x26, 11 | magistrate's three-tier bench over a white-sand court square; drawer walls with rolling ladders; seal press | purple, gold, white sand, dark wood | built (room_shogun_records) |
| 17 | Shogun | Keep Interior | lore / treasure | shogun_keep (0,69) | 22x22, 24 vertical | atrium stair climbing three floors to a lookout gallery with valley windows | dark timber, white plaster, purple · window light | built (room_shogun_keep) |
| 18 | Shogun | War Council | video | shogun_strategy_hall (40,39) | round 28, dome 14 | round chamber, round lacquer table inlaid with a gold colony map, gold constellations on a purple dome | deep purple, gold, indigo | built (room_shogun_council) |
| 19 | Bushi | War Room | lore | bushi_strategy_hall (34,4) | 30x24, 9 | sand-table relief of the colony with unit markers and flags; great round east window glowing with sunrise | navy, blue-grey stone, gold · sunrise orange | built (room_bushi_war) |
| 20 | Bushi | Strategy Hall | games / lore | bushi_library (-32,4) | 28x24, 8 | giant go board inlaid in the floor (stone cushions), rows of go and shogi tables mid-game | pale wood, navy, black / white | built (room_bushi_strategy) |
| 21 | Bushi | Dojo | training | bushi_great_dojo (0,26) | 38x30, 10 | rising sun + crossed swords mural across the back wall; formation lines painted on a blue stone floor; officers' gallery | navy, gold, red sun | built (room_bushi_dojo) |
| 22 | Buke | Archive Vault | lore / secret | buke_archive (-38,23) | 24x30, 8 | stone barrel vaults on squat pillars, iron drawer cabinets in every bay (the locked drawer), round vault door standing open | moss stone, iron, olive · lamps | built (room_buke_vault) |
| 23 | Buke | Great Hall | gathering | buke_great_hall (0,63) | 44x28, 12 | a canal runs through the hall under two footbridges; wall of trident shields; high timber truss | olive, khaki, maroon, gold | built (room_buke_great_hall) |
| 24 | Buke | Cliff Tunnels | explore | buke_tunnel_door in the gorge wall (10,-90) | 6 m tunnel, ~80 m | engineered rock tunnels with timber shoring every 3 m, cart rails, window openings onto the canyon, pulley lift | tan rock, timber · lamps + daylight shafts | built (room_buke_tunnels) |
| 25 | Buke | Engineer Workshop | training (S15) | buke_strategy_hall (38,23) | 28x22, 10 | waterwheel turning through the wall drives a shaft of big wooden gears overhead; bridge models on a stress rig; drafting tables | olive, wood, brass, blueprint blue | built (room_buke_workshop) |
| 26 | Ashigaru | Workshop | craft | ashi_workshop (28,34) | 26x20, 8 | carpentry: log cradles with a two-man saw, sawhorses, a pile of sharpened palisade stakes, spear shafts drying | raw wood, forest green, tan · daylight | built (room_ashi_workshop) |
| 27 | Ashigaru | Archive | lore | ashi_archive (-34,10) | 20x18, 8 thatch | the seed archive: walls of seed drawers with sprouts in clay pots, a rice-planting calendar wheel, rice sheaves hung from the thatch | straw gold, deep green, earth | built (room_ashi_archive) |
| 28 | Ashigaru | Dojo | training | ashi_great_dojo (0,41) | 36x28, 9 earth floor | obstacle course: log beams, climbing ropes from the rafters, crawl net, mud pit, straw targets | earth brown, green, rope | built (room_ashi_dojo) |
| 29 | Kenshi | Duel Hall | training | kenshi_great_dojo (0,63) | 30x30, 10 | one circle of raked white sand under a round skylight beam; still reflecting pool with a single stone | teal, steel grey, white sand | built (room_kenshi_duel) |
| 30 | Kenshi | Library (Library of Forms) | lore | kenshi_library (-48,23) | 24x24, 8 | Library of Forms: wall-sized kata scrolls, wooden mannequins frozen in sword forms, an indoor koi pond with a stone bridge | teal, bamboo green, ink | built (room_kenshi_library) |
| 31 | Kenshi | Forge (Polishing Studio) | craft | kenshi_forge (50,66) | 20x18, 7 | the polishing studio: water-stone benches over a running channel, blade cases in teal glass, a straw-mat test line | steel, teal, slate · cool, quiet | built (room_kenshi_forge) |
| 32 | Kenshi | Meditation Room | video | kenshi_hall (48,23) | 26x26, 9 | indoor zen garden: raked gravel waves round a moss island with one maple; film as shadow-play on a big shoji | grey gravel, moss · teal dusk | built (room_kenshi_meditation) |
| 33 | Yamabushi | Falls Cave | explore | a yam_burrow_arch (40,23) | 30x26, 10 cave | looking out through a curtain of falling water; wet rock, pools, glowing blue moss, hermit's ledge shrine | wet rock, moss · icy blue glow, mist | built (room_yam_falls) |
| 34 | Yamabushi | Library | lore | yam_library (-40,57) | 22x22, 14, two floors | hanging spiral sculpture in a two-floor atrium; herb jars, star charts, telescope at a high window | dark teal, wood · icy blue | built (room_yam_library) |
| 35 | Yamabushi | Spirit Shrine | lore | yam_great_dojo (0,59) | 30x30, 12 | sacred boulder bound with shimenawa on white pebbles, blue spirit flames, paper charms drifting in the air | dark teal, white · icy blue flames | built (room_yam_shrine) |
| 36 | Yamabushi | Descent Path | quest (M42) | a yam_burrow_arch (-24,23) · sealed until book1-main-41 | shaft 30x30, ~40 deep | stair spiralling down round a deep misty shaft with rope bridges, blue glow far below | rock, moss · blue mist | built (room_yam_descent) |
| 37 | Sohei | Bell Temple | lore | sohei_bell_tower (-42,69) | 24x24, 16 | giant bronze bell in a massive timber frame, striking log on ropes; candle racks, wooden fish drum | bronze, saffron, brown | built (room_sohei_bell) |
| 38 | Sohei | Great Dojo | training | sohei_great_dojo (0,53) | 38x30, 11 | goma fire altar at the head (live flames); staff / naginata ring on a stone floor; prayer ribbons on pillars | saffron, brown · firelight | built (room_sohei_dojo) |
| 39 | Sohei | Library | lore | sohei_library (-44,7) | 24x24, 10 | revolving octagonal sutra repository (it turns) in the centre; low reading desks, sutra boxes | red-brown wood, saffron, gold | built (room_sohei_library) |
| 40 | Sohei | Rite Hall | video (M38) | sohei_hall (44,7) | 30x26, 10 | shallow pool floor with floating lanterns, walkway through it; film on hanging silk banners | gold, saffron, dark water · golden haze | built (room_sohei_rite) |
| 41 | Wokou | Ship Hold | explore | hatch on a wok_boat deck (32,-55) | 10x28, 5 low | curved hull ribs, lashed crates + barrels, hammocks, swinging lanterns, bilge water | dark brown, rust · lamp light | built (room_wok_hold) |
| 42 | Wokou | Trade House | lore | wok_trade_house (41,49) | 26x20, 8 | merchant's counting hall: scales, hanging silks and spice sacks, porcelain cases, trade-routes map wall | maroon, leather brown, gold | built (room_wok_trade) |
| 43 | Wokou | Boat Shed | craft | wok_boathouse (-40,-13) | 30x20, 11 | a boat being built on a slipway (ribs on a cradle), sea door open onto water in the floor, sail-sewing table | wet wood, rope, sea blue | built (room_wok_shed) |
| 44 | Wokou | Great Dojo | training | wok_great_dojo (0,73) | 36x30, 10 | wave-pattern tiled floor round a pool with stepping posts; chains + grappling hooks from the beams; round sea window | navy, gold, rust | built (room_wok_dojo) |
| 45 | Warrior | Armory | craft | war_forge (-40,49) | 28x22, 9 | walls packed with battle-dented weapons and armour, grinding wheel, repair benches, cracked-circle standard | rust red-brown, iron, burnt sienna | built (room_war_armory) |
| 46 | Warrior | Great Dojo (Fighting Ring) | training | war_great_dojo (0,39) | 36x36, 10 | sunken sand fighting ring with stepped wooden seats round it, heavy bags, battle drums | sand, rust, green + gold | built (room_war_dojo) |
| 47 | Warrior | Stores | quest (M33) | war_storehouse (36,43) | 30x24, 9 | warehouse aisles stacked to the roof (rice bags, arrow bundles, barrels, crates), quartermaster's desk | tan, wood, rope | built (room_war_stores) |
| 48 | Warrior | Veterans Hall | video | war_hall (35,-4) | 30x24, 11 | tattered battle banners from every rafter, long battle mural, worn chairs round a fire pit, broken stone ring | smoke, rust, faded green + gold | built (room_war_veterans) |
| 49 | Cute & Creepy | Gothic Manor | lore | cc_manor (0,48) | 30x30, 14 | grand foyer: double staircase, candle chandelier, portrait gallery, purple stained glass, checker floor | purple, black, candle gold | built (room_cc_manor) |
| 50 | Cute & Creepy | Crypt | quest (Crypt Key) | cc_crypt (-52,58) | 16x30, 6 vaulted | rows of sarcophagi, cute skull niches, green candle glow, the Crypt Key coffin at the end | grey stone, toxic green, bone | built (room_cc_crypt) |
| 51 | Cute & Creepy | Witch's Cottage | lore | cc_witch_hut (48,47) | 14x12, 5 | bubbling green cauldron, shelves of bright potions, hanging herbs and cute bats, broom, black cat, spell book | purple, green glow, warm wood | built (room_cc_witch) |
| 52 | Cute & Creepy | Game Hall | games | cc_game_hall (37,-8) | 28x24, 9 | spooky fair: giant dice table, pumpkin bowling lane, fortune-teller booth with crystal ball, plushie claw machine | orange, purple, black | built (room_cc_game) |
| 53 | Chumpz | Bar (Tiki Lounge) | gathering | chz_bar (-10,39) | 26x20, 7 | tiki bar: bamboo counter + stools, big aquarium behind the bar, banana-leaf thatch, jukebox + dance floor | bamboo, turquoise, banana yellow | built (room_chz_lounge) |
| 54 | Chumpz | Dice Hall (Jungle Casino) | games | chz_dice_hall (22,-13) | 26x22, 8 | jungle casino: green felt dice tables, giant spinning banana wheel, palm columns, gold banana chandeliers | green felt, gold, wood | built (room_chz_casino) |
| 55 | Chumpz | Bait Shop | shop | chz_bait_shop (-27,-12) | 14x12, 5 | fishing clutter: rod racks, bait tanks with glowing lures, trophy fish wall, nets, frosted cooler door | sea blue, buoy orange, wood | built (room_chz_bait) |
| 56 | Chumpz | Ship Cabin | quest (map piece) | hatch on the chz_sailboat (16,-57) | 12x10, 4 | captain's cabin: curved stern windows over turquoise sea, chart table with the treasure map, hammock | warm wood · turquoise sea light | built (room_chz_cabin) |
| 57 | Saints | HQ | quest (briefing) | sl_hq (0,49) | 34x26, 9 | modern loft: glass wall onto the LA skyline, giant wings mural, halo neon, briefing table + screen | concrete, white, gold halo, sky blue | built (room_sl_hq) |
| 58 | Saints | Arena | games | sl_arena (40,45) | 40x30, 14 | full basketball court with hoops, bleachers, hanging scoreboard, spotlights | maple court, purple + gold | built (room_sl_arena) |
| 59 | Saints | Garage (Custom Shop) | craft | sl_garage (-38,-26) | 26x20, 8 | lowrider up on a hydraulic lift, tool walls, tyre stacks, paint booth, neon OPEN sign | oil black, chrome, candy colours | built (room_sl_garage) |
| 60 | Saints | Library | lore | sl_library (-38,3) | 26x26, 12 | Art Deco rotunda: painted dome over a round reading room, green banker's lamps, card catalogue, LA murals | cream, deco gold, green | built (room_sl_library) |
| 61 | Saints | Game Hall (Block Party) | games | sl_game_hall (38,3) | 30x24, 8 | 4-lane bowling alley + pool tables + DJ booth with speakers (Block Party) | retro teal + orange, neon | built (room_sl_game) |

Shared room pieces (built, see CLAUDE.md "Rooms" notes)
- Decks: raised floors, stairs and ramps (`decks`, the stair visuals from stairsK / flightK match the treads), walk zones
  (`walk`), blockers with minY / maxY (rails that hold only at their own level), spawn heights (spawn[3]).
- Animated parts (`parts` with spin / spinX / spinZ / bob / sway / swing), flickering lights, scrolling textures (`flows`).
- Door pieces where a building had none: buke_tunnel_door, wok_hatch (ship), wok_shed_wall, war_armory_door,
  war_cellar_door, cc_hall_door, chz_lounge_door / chz_casino_door / chz_store_door, chz_cabin_hatch (moored sailboat),
  sl_shop_door. Sealed doors: interiorDefinition.requiresQuestId (?rooms=open lets a reviewer in).
