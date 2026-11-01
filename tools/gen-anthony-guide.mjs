// node tools/gen-anthony-guide.mjs [--check]
// Writes docs/anthony-universe-guide.txt: what Ant-Thony knows about Rebel Universe (Nov 1, the Economy chat's ask: he
// roams Universe and answers players about the villages, the map, every game, chests, riddles, finds, the Forge,
// badges, the Comedy Club, the controls and common problems). The economy keeps it per app (POST
// /api/anthony/knowledge, at most 24,000 characters): Admin Hub > Ant-Thony > Send the guide sends this file.
// The game list comes from village.html (GAME_LIST, made by tools/gen-game-list.mjs); the rest is written here.
// Run it again whenever Universe changes (games, villages, controls), then send it from the Admin Hub.
// His rules: he never says what anything is worth and never uses casino words, so this file never does either
// (checked below). Points are loyalty points, not money.
import fs from 'node:fs';

const MAX = 24000;
const BANNED = /\b(bets?|betting|wagers?|odds|luck|lucky|payouts?|jackpots?|cash\s*out|casino|gambl\w*)\b|\$\s?\d/i;
const ROOT = new URL('..', import.meta.url).pathname;
const html = fs.readFileSync(ROOT + 'village.html', 'utf8');
const GAMES = JSON.parse(/const GAME_LIST = (\[.*?\]);\n/s.exec(html)[1]);

const VILLAGES = [
  ['hub', 'Hub Village'], ['ronin', 'Ronin'], ['samurai', 'Samurai'], ['shogun', 'Shogun'], ['bushi', 'Bushi'], ['buke', 'Buke'],
  ['ashigaru', 'Ashigaru'], ['kenshi', 'Kenshi'], ['yamabushi', 'Yamabushi'], ['sohei', 'Sohei'], ['wokou', 'Wokou'],
  ['warrior', 'Warrior'], ['cute-creepy', 'Cute & Creepy'], ['chumpz', 'Chumpz Cove'], ['saints-la', 'Saints of LA']];

// one short line per game type (how it plays)
const HOW = {
  akari: 'place lanterns so every square is lit, numbers say how many touch a wall',
  archery: 'hold to draw, let go to shoot the targets',
  bamboo: 'swipe or press Space in the band to cut',
  basins: 'fill, empty and pour basins to measure the asked amount',
  blocks: 'falling blocks, fill whole lines',
  bowl: 'walk the course carrying a full water bowl without spilling',
  bowling: 'aim, then roll; ten frames, real scoring',
  brew: 'answer the riddle to pick each ingredient',
  canals: 'shade water so every island has its number of squares',
  channels: 'join matching ends so every square has a channel',
  chase: 'catch the runner; it tires every few seconds',
  chop: 'chop each log when the mark is in the gold',
  claw: 'steer the claw, drop it, grab a prize',
  course: 'run through every gate as fast as you can',
  crane: 'move the crates one at a time, big never on small',
  crossing: 'cross the busy street and back, dodge the cars',
  dance: 'press the arrows on the beat, pick a song and level',
  debts: 'answer the riddles, then touch the right stone',
  dig: 'each dig tells how many steps to the nearest chest',
  drill: 'block the dummy on time, then strike',
  drums: 'hit the drums on the beat',
  ferry: 'carry everyone across without breaking a rule',
  fishing: 'cast, strike when it bites, keep the fish in the bar',
  fleet: 'find the hidden ships from the row and column counts',
  forge: 'heat in the band, strike on the ring, quench',
  four: 'drop pieces, four in a row wins',
  gather: 'collect everything on the map before time runs out',
  ghosts: 'catch the ghosts that pop from the graves',
  grants: 'split the board into rectangles, one number each',
  graves: 'find the hidden spirits from the numbers',
  guard: 'raise the shield left or right as arrows come',
  hashi: 'link the islands with bridges, numbers say how many',
  hidato: 'fill the path so every number touches the next',
  highlow: 'say higher or lower for the next die, five right in a row',
  hoops: 'jump and release at the top of the meter',
  iceslide: 'slide until something stops you, reach the seal',
  kenken: 'fill the grid, cages must make their sum or product',
  knight: 'visit every square once with knight moves',
  koi: 'toss food to the koi as they swim by',
  leaves: 'catch the falling leaves in the basket, dodge burrs',
  lock: 'guess the code, the marks say how close you are',
  lookout: 'spot the hidden scouts through the spyglass',
  loop: 'draw one loop, numbers say how many sides it uses',
  mahjong: 'match free pairs of tiles to clear the garden',
  mastermind: 'crack the code from the hints after each guess',
  memory: 'flip tiles to find matching emblem pairs',
  merge: 'slide crates, equal ones merge',
  mirrors: 'turn mirrors so the sunbeam reaches the target',
  moons: 'fill moons and suns, no three in a row, half each',
  mural: 'put the tiles back to finish the mural',
  nim: 'take stones in turns, take the last one to win',
  nonogram: 'paint the banner from the row and column numbers',
  pearls: 'draw one loop through every pearl by its rules',
  pegs: 'jump pegs to clear the board down to one',
  pipes: 'turn the stones so water reaches every one',
  plant: 'plant each seedling when the mark hits',
  pong: 'aim, then set the power, sink the cups',
  potion: 'pour until each bottle holds one colour',
  push: 'push the stones onto the marks',
  queens: 'place banners, one per row, column and colour',
  quickdraw: 'draw when the leaf lands, not before',
  rake: 'rake one unbroken line through every sand square',
  relay: 'run every village gate to gate, the clock runs per village',
  reversi: 'flip pieces by trapping them, most pieces wins',
  riddle: 'answer the giver\'s riddles, pick from the choices',
  roots: 'strike each root as it reaches the ring',
  scales: 'find the odd coin with the fewest weighings',
  sequence: 'watch the pattern, repeat it, one longer each round',
  shadows: 'shade squares so no number repeats in a line',
  shells: 'follow the cup hiding the mini ant',
  shuriken: 'throw stars at the targets, never at friends',
  siege: 'aim and power the trebuchet, mind the wind',
  silent: 'move when the guards look away, never into light',
  skip: 'set the angle and power, skip the stone far',
  sky: 'set tower heights so the edge counts are right',
  slide: 'slide the pieces to rebuild the seal',
  spar: 'block high, low or side, then counter',
  sprouts: 'water beds, each one flips its neighbours, make all bloom',
  stack: 'drop stones on the cairn, what hangs over falls off',
  stealth: 'sneak past the watchmen and their view cones',
  stones: 'watch the path glow, then walk it from memory',
  sudoku: 'fill the grid, each number once per row, column and box',
  surf: 'ride the waves through the rings, dodge rocks',
  tameshigiri: 'cut the mats on the closing ring, the right way',
  tend: 'keep every lantern lit as they burn down',
  tents: 'place a tent beside each tree, counts on the edges',
  tiles: 'turn tiles to rebuild the raked pattern',
  toss: 'set the aim, then the power, hit the target',
  treasure: 'follow the beeps and dig up the chests',
  trick: 'knock on every door before the moon sets',
  tug: 'pull as the ring swells, heaves count double',
  valet: 'slide the cars out of the way to free yours'
};
// game kinds every village has: explained once (KINDS), a short tag in the lists
const KIND_TAG = { riddle: 'riddle set', course: 'run', dance: 'dance-off', chase: 'chase', tend: 'keep-lit', gather: 'collect run',
  toss: 'throw', sequence: 'repeat the pattern', fishing: 'fishing', claw: 'claw machine', archery: 'archery' };
const KINDS = 'Kinds every village shares: riddle sets (a villager asks several riddles, pick the right answer each time, all right clears it); runs (a gate course against the clock, run with R, a ghost shows your best run); dance-offs (press the arrows on the beat, ten songs in three levels, your Rebel dances); chases (catch the runner, it sprints faster than you but tires every few seconds, cut it off); keep-lit (relight lanterns before they burn out); collect runs (gather every item in time); throws (aim, then power); repeat the pattern (watch, then play it back, one longer each round); fishing (cast, strike when it bites, keep the fish inside the bar while reeling).';
const missing = [...new Set(GAMES.map((g) => g[3]))].filter((t) => !HOW[t]);
if (missing.length) { console.error('no line for game types:', missing.join(', ')); process.exit(1); }
const titleOf = (t) => t.replace(/Lucky /g, '');   // (his rules: no casino words, in titles too)

const villagesText = `VILLAGES (15; walk into a village's glowing portal gate and pick where to go)
Hub Village: where everyone starts. The courtyard with the great cherry tree, torii gates and dojos. Rooms: the Rebel Arcade (cabinets that open the Rebel Ants Playground games, the Ant Claw), the Rebel Library (The Warning, Book One: press O at the lectern and the book opens; the free sample is on library.rebelants.io), the Gathering Hall, the Forest Dojo, the Video Theatre, the old tunnels (they open late in the story). Off the west road: Antthony's Comedy Club. The south-east dojo: Rebel Ants After Dark. People: the Hub Guide (the story), the Traveling Guide (the friend villages), the Archivist, the Lantern Keeper.
Ronin: the darkest village, always night. A moonlit fortress on a cliff, reached by a causeway, a giant bonsai in the plaza, the Shadow Dojo, the sealed Old Door. The Ronin Watcher keeps it.
Samurai: the flagship. Golden terraces, stone walls, red maples and cherry trees, waterfalls far to the north-west. The Great Dojo (its room holds the Samurai Code), the library, the forge, an archery range outside the gate. The Samurai Captain.
Shogun: a castle on a hill. The keep (climb to its top floor), the Throne Room, the Court of Records, a garden pond with an arched bridge, purple and gold banners. The Herald and the Castle Steward.
Bushi: a fortress on high ground with a raised sand yard, the great dojo, the strategy hall, sunrise light. The Strategist and the Foreman.
Buke: a canyon village with canals and footbridges, the great hall, the archive, tunnels in the cliffs and stairs up to the cliff top. The Engineer.
Ashigaru: a round mound inside a palisade and a moat, farms and rice paddies, a log lookout. The Runner and the Lantern Keeper.
Kenshi: bamboo groves, still water, a raked stone yard, the Duel Hall, a lake to the north. The Duelist.
Yamabushi: the highest village, on a cliff top with waterfalls and mist, a long bridge to a stone pillar with a shrine, the Descent Path (opens in the story). The Seer and the Herbalist.
Sohei: a temple mountain in autumn colours with a bell tower, a pond, a zen garden and the Rite Hall. The Bell Keeper.
Wokou: a harbour with piers, ships you can walk aboard, a boat shed, a cargo crane and the trade house. The Broker. Swim from the beaches.
Warrior: a stake fort on golden grassland with a dry ditch, the Fighting Ring inside the great dojo, the Stores and the Armory. The Drill Master and the Quartermaster.
Cute & Creepy: a Halloween hilltop, always night: the graveyard and crypt, the gothic manor, the witch's cottage, the game hall, the great tree, Nariko's stone circle, Ophira's glade with the Owl of Summoning. The Mystic Moons live here: Mamoru, Kokeshi Flower Moon, Ostara, Nariko and Mochi, with the Lunar Witches.
Chumpz Cove: a tropical cove: the Banana Bar, the dice hall, the bait shop, piers and boats, palms. Big Chain, Pengu, Peely, Banana Band, the Racer and Barnacle. Swim and surf here.
Saints of LA: a city block in Los Angeles: the Saints HQ (fire escapes up to the roof), the basketball court, the library, the game hall with bowling, the custom shop, apartments, cars driving round the block. The Greeter, the Mechanic, the Court Regular, the Librarian, the DJ and the Shopkeeper.`;

const gamesText = 'GAMES (' + GAMES.length + ', about ten in every village; press O at a game spot, a How to play card explains it; Esc twice quits, Restart tries again; many puzzles have 10 to 20 levels; the first clear of a game gives Rebel Points once; the Journal\'s Games tab lists your bests, and each game keeps a top 10)\n'
  + KINDS + '\n'
  + VILLAGES.map(([id, name]) => `${name}: ` + GAMES.filter((g) => g[2] === id).map((g) => `${titleOf(g[1])} (${KIND_TAG[g[3]] || HOW[g[3]]})`).join('; ') + '.').join('\n');

const text = `REBEL UNIVERSE GUIDE (for Ant-Thony)
Rebel Universe is the Rebel Ants' 3D world in the browser at rebeluniverse.io, on computers and phones. You walk your Rebel (your NFT turned into a 3D character in the Rebel Forge, a Free to play character, or Rebel #001, you) through 15 villages: quests, games, riddles, chests, secrets, rooms, other players, chat, voice and events. Rebel Points are loyalty points, not money: never say what anything is worth.

START AND SIGN IN
The lobby: pick a character card (your own forged Rebels, Chumpz or Saints, Free to play ones, #001), press Enter Village. Sign in with the account chip at the top left (Discord, or a name and PIN) to keep your Rebel Points, badges and story on your account on any device. Guests can play everything; their points are practice points kept on that device only. Phones: tap Enter Village once.

THE MAP AND GETTING AROUND
Every village has a glowing portal gate: walk into it and pick a village. Return to Hub takes you home (computers: under the mission line; phones: in the Rebel panel). The round map at the bottom right turns with your camera; tap or click it to zoom. The gold diamond on the map and the beam in the world show your current target; red dots are gates, teal dots are doors. Doors to rooms say "Press O to enter"; walk back into the exit to leave. You can swim from beaches and shores, and climb stairs, fire escapes and decks.

${villagesText}

TIME AND WEATHER
Day and night follow the player's own clock (Ronin and Cute & Creepy stay night). Weather changes by itself: rain, storms with lightning and thunder, fog, snow that settles on the ground and roofs, heat haze, cold breath. Footsteps sound like the ground underfoot. Some secrets and quest steps need night, dawn, dusk or a storm.

WHERE THINGS START
Book One and the Hub Journey: the Hub Guide in the courtyard. Friend villages: the Traveling Guide in the Hub (gifts and welcome signs), then Mamoru at the Cute & Creepy gate (Moon Tales), Big Chain at the Banana Bar (Chumpz Cove), the Greeter on the Saints block (Saints of LA). The Grand Relay starts in the Hub: run all 15 villages gate to gate, the clock counts each village.

QUESTS AND THE STORY
The mission line (top left; on phones the gold circle under the round button) always says what to do next, and the beam points the way. The Hub Journey teaches the basics, then Book One: 50 story quests from the Hub across the villages (tremors, a sealed chamber, the factions, the Awakening) plus 30 side quests from villagers. Friend villages have their own series: Moon Tales in Cute & Creepy (24 tales of the Mystic Moons, the Lunar Witches and the Owl of Summoning), Chumpz Cove (20, ending in Big Chain's Beach Party) and Saints of LA (20, ending in the DJ's Block Party). Some steps need night, dawn or a storm: the line says so. The Journal (round button, top left, or Tab) has the story, quests, tales, secrets, badges and games.

CHESTS, SECRETS, RIDDLES AND FINDS
Chests (102) sit around every village and in some rooms, from wood and iron up to gold, treasure and legend chests in hard places (cliff tops, ditches, the keep's top floor). Walk up close and press O. Each gives Rebel Points once per account. Secrets (100) hide in every village: look closely at odd spots, some only at night, dawn or in a storm; little mini ants whisper hints about the next one. Collectibles and 33 ancient relic fragments are spread out for the Relic Keeper. Riddles: villagers with riddle sets ask several questions (pick the right answer each time), and place riddles are read from a stone or a grave, then answered by going to the right place and pressing O; some lead across several villages (the Wanderer's Map starts by the Traveling Guide). Finds: in Treasure Dig on the Chumpz west beach a detector beeps faster near buried chests, with new finds every day.

THE REBEL FORGE
The Forge (Forge button on a card in the lobby) turns a Rebel Ants NFT into a rigged 3D character: the holder signs in with their wallet, the Forge paints the art, sculpts it, rigs it, then Awaken and Make this my Rebel. A forge uses Rebel Points and each Rebel can be forged a few times. Holders can fit their gloves (size, cuffs, colours) on an awakened Rebel. Chumpz and Saints holders forge their characters too. Forged Rebels get kicks, punches, flips, weapon moves and a games pack (fishing, digging, throws, dances and more).

BADGES
300 badges in 14 families: story, explorer, villages, secrets, collector, arcade, rivals and boards, riddles, community, forge, dedication and more, from common to mythic. They unlock as you play (the badge card pops up) and show in the Journal's Badges tab. Signed-in players' badges also go to their Badge Wall on the Rebel Economy.

ANTTHONY'S COMEDY CLUB
Your club, off the Hub's west road in the forest, about 50 m west of the courtyard wall: the marquee, the stage with your neon name and the mic, twelve tables, the wall of fame with your pictures (press O on one), the snack bar and the Roast Champion trophy. Events and shows happen on the Colony Stage: a LIVE NOW banner in the lobby and in Universe, Go there takes players to the event.

REBEL ANTS AFTER DARK
The night lounge in the Hub's south-east dojo: its stations open the After Dark site (Hold Em, Colony Clash, Rebel 21, Spinners, Wheel, Drop) where members play for loyalty points and bragging rights, plus the points shop and Discord.

PLAYING TOGETHER
Other players walk the same villages live (up to 50 in a village copy, more open another copy). Chat: Enter (computers) or the chat button (phones); channels Nearby, Village, Group and whispers; click a name to whisper, mute, block or report. Voice: hold X or the mic bubble (bottom left) to talk to players near you; both players must be signed in and allow the microphone. Emotes: E, then 1-5 (cheer and four dances). Groups of up to 8: invite from a name, the group shows on the map and Go to them travels there. Photos: P or the camera button, then Polaroid or Photo and share to X, Instagram, TikTok, Discord. Clips: Shift+P (phones: Clip in the ••• fan) records a vertical video with sound; it is only kept until the card closes, so save or share it first.

CONTROLS ON A COMPUTER
W A S D or the arrow keys walk the way the camera looks, R runs, Space jumps, drag with the mouse to look around. O: use (talk, open, enter, read, play). E emotes, P photo, Shift+P clip, Tab your Rebel (Journal, Sound, Gloves, Back to Lobby), Q draws a weapon. F kicks, G punches, T fight stance, C cartwheel, B backflip, V front flip. Enter chat, X voice. Esc closes a window; again stops walking. The circle at the top right opens the full controls guide.

CONTROLS ON A PHONE
The stick at the bottom left walks (push to the rim to run); drag elsewhere to look. Use names its action (Talk, Open, Play). The ••• button opens Jump, Hit, Talk, Emote, Photo and Clip. The round button at the top left: Journal, Sound, Gloves, Controls, Back to Lobby. The gold circle under it shows the mission. Chat is the button at the top right. Games with buttons show them on screen.

${gamesText}

COMMON PROBLEMS AND FIXES
Stuck on "Initializing" or "loading WebGL": the browser or a work network blocks 3D. Turn on hardware acceleration and WebGL in the browser settings, or try another network or browser; the page says what is missing.
iPhone shows "A problem repeatedly occurred": the phone ran out of memory. Close other tabs and apps and open Universe again; it runs lighter for a few days by itself.
No sound on a phone: tap the screen once, check the silent switch and the volume. Sound levels: the round button > Sound (music, effects, ambience, voices).
Voice not working: both players signed in, allow the microphone, stand within about 40 m in the same village, hold X or the mic. With AirPods, pick them as the input; the meter moves when the mic hears you.
Points or badges missing: sign in. Guests' points are practice points on that device. Each chest, first game clear and place riddle pays once per account.
Story progress lost: signed-in players' story is saved to their account; a guest's lives on that one browser, and iPhone Safari can clear it after a week without a visit.
A chest will not open: you already opened it with this account, or stand closer on the same floor.
Stuck in a room or a wall: walk back to the exit, press O, or use Return to Hub.
Can't find the next quest step: follow the gold diamond and the beam, read the mission line, talk to the giver again; some steps need night, dawn or a storm.
Can't see a friend: you may be in different villages or village copies; join a group and use Go to them.
A clip came out empty or too short: record a little longer, then stop.
A game is confusing: open How to play, Restart, or press Esc twice to leave.
`;

const out = text.replace(/[ \t]+\n/g, '\n').trim() + '\n';
const bad = BANNED.exec(out);
if (bad) { console.error('his rules: no casino words or values, found', JSON.stringify(bad[0]), 'near', JSON.stringify(out.slice(Math.max(0, bad.index - 60), bad.index + 60))); process.exit(1); }
if (out.length > MAX) { console.error(`too long: ${out.length} characters (max ${MAX})`); process.exit(1); }
const file = ROOT + 'docs/anthony-universe-guide.txt';
if (process.argv.includes('--check')) {
  const cur = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (cur !== out) { console.error('docs/anthony-universe-guide.txt is out of date: run node tools/gen-anthony-guide.mjs'); process.exit(1); }
  console.log('up to date', out.length, 'characters');
} else {
  fs.writeFileSync(file, out);
  console.log('docs/anthony-universe-guide.txt', out.length, 'characters,', GAMES.length, 'games');
}
