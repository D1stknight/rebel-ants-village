// Shared "this will be rigged and animated" rules for every Forge image prompt (not a route).
// Learned from play-testing: splayed oversized feet, rope ends sticking out of elbows,
// and full-face masks that Meshy wraps around the whole head.

function pretty(v) {
  return v ? String(v).replace(/-/g, ' ').replace(/\s+\d+$/, '').trim() : null;
}

// v6 (9/27) head-gear glossary from the NFT's own traits. The image model read #1555's eye patch + mouth bandana as one
// big pale mask over the whole face, and #469's skull cap + flap as blond hair. Ant anatomy and every gear trait are
// spelled out so the drawing keeps the real eyes, bare face and headwear.
// What each Heads trait looks like (checked on the collection, 9/27; Miguel: some Rebels have hair, some came back
// from war with metal on the head and face). Heads not listed are a plain ant head in the base skin colour.
const HEAD_TYPES = {
  'Antler-Arthur-Head': 'a tuft of real HAIR on top of the head between the antennae (red / orange / brown as in the NFT). Keep it as hair, same colour and shape.',
  'Cranium-Casey-Head': 'a tuft of real HAIR on top of the head between the antennae (red / orange / brown as in the NFT). Keep it as hair, same colour and shape.',
  'Feelers-Finn-Head': 'a battle-worn head: the top of the head is a dark METAL plate (war damage), and part of the face below the eyes is metal too where it is not covered. Hard, slightly shiny riveted metal as in the NFT, not cloth, not a helmet, not a mask.',
  'Thorax-Theo-Head': 'MECHANICAL antennae: jointed metal rods with small round joints (as in the NFT), not organic stalks.'
};

export function headGearLines(ts = {}, view = 'front') {
  const has = (k) => ts[k] && String(ts[k]).toLowerCase() !== 'none';
  const P = (k) => pretty(ts[k]);
  const out = ['HEAD ANATOMY AND GEAR (read the NFT this way):',
    "- Copy exactly what is on and around the head in the NFT, keeping each material: real hair stays hair (only some Rebels have it), battle-worn metal plating stays hard metal, and caps, wraps and bandanas stay cloth with folds and a tied knot."];
  const headType = HEAD_TYPES[String(ts.head || '').trim()];
  if (headType) out.push(`- HEAD ("${P('head')}"): ${headType}`);
  const eyes = String(ts.eyes || '');
  if (/patch/i.test(eyes)) {
    out.push(`- EYES ("${P('eyes')}"): the ant has two big compound eyes (large ovals filled with a fine grid of tiny squares). ONE of them is covered by an EYE PATCH (a flat patch with a strap, as in the NFT); the OTHER is a normal big compound eye with its grid of small squares, fully visible. The rest of the upper face is exactly as in the NFT (bare skin, or metal on a battle-worn head), never a mask.`);
  } else if (eyes) {
    out.push(`- EYES ("${P('eyes')}"): two big compound eyes, large ovals filled with a fine grid of tiny squares, in the NFT's colours. They are the ant's real eyes (not goggles or a visor) and stay visible unless a ninja mask or full face mask in the NFT covers them.`);
  }
  if (has('bandana')) out.push(`- BANDANA ("${P('bandana')}"): a cloth bandana tied over the MOUTH and lower face ONLY, from just under the eyes down over the chin, knotted at the back of the head. The eyes and the upper face stay uncovered, exactly as in the NFT. It is NOT a full-face mask and never covers the eyes or the forehead.`);
  if (has('mouthMask')) out.push(`- MOUTH MASK ("${P('mouthMask')}"): a small mask over the mouth only; the eyes, cheeks above it and forehead stay bare.`);
  if (has('ninjaMask')) out.push(`- NINJA MASK ("${P('ninjaMask')}"): a cloth ninja wrap around the head and lower face, exactly as in the NFT, with the eyes showing through the opening.`);
  if (has('skullCap')) out.push(`- SKULL CAP ("${P('skullCap')}"): a fitted cloth cap / head wrap covering the top and back of the head, in the NFT's colours and pattern. It is cloth headwear, not hair.`);
  if (has('skullyFlap')) out.push(`- SKULLY FLAP ("${P('skullyFlap')}"): the tied knot and short cloth flap at the back of the skull cap / head wrap (it keeps the wrap from falling). Keep it short and lying close to the back of the head; it is part of the cap, not hair.`);
  if (has('foreheadBandana')) out.push(`- FOREHEAD BANDANNA ("${P('foreheadBandana')}"): a cloth band tied around the forehead ABOVE the eyes; the eyes and face stay visible.`);
  if (has('bandanaTail')) out.push(`- BANDANA TAILS ("${P('bandanaTail')}"): the knotted tails of the headband at the back of the head, short and lying close to the head.`);
  if (has('rangerHelmet')) out.push(`- RANGER HELMET ("${P('rangerHelmet')}"): the helmet exactly as in the NFT, sitting on the head; the face and eyes below it stay as in the NFT.`);
  if (has('headAccessory')) out.push(`- HEAD ACCESSORY ("${P('headAccessory')}"): worn on the head exactly as in the NFT, small and close to the head.`);
  if (view === 'back') out.push('- From behind: show the back of the head gear only (cap, knot, flap, straps and bandana knots); eyes and face are not visible.');
  return out;
}

export function buildRigFriendlyRules(generationInput = {}, { view = 'front' } = {}) {
  const mask = pretty(generationInput?.traitSlots?.fullFaceMask);
  const lines = [
    'Rig-friendly details (this character will be rigged and animated):',
    '- Feet point STRAIGHT FORWARD and parallel, about hip-width apart. Do not splay the toes outward.',
    '- Footwear is compact and close-fitting (snug sandals, tabi or slim boots), proportionate like the clay reference. No oversized, chunky or flared footwear.',
    '- No loose rope ends, tassels, ribbon tails, spikes or knots sticking out from the elbows, wrists, knees or ankles. Tie-offs are short and lie flat against the limb.',
    '- Keep a small gap between the hands and the robe/thighs; the hands must not touch the body or clothing.',
    '- HANDS: both hands are closed in relaxed fists (fingers curled into the palm, thumb resting over the index finger), in simple snug gloves if the outfit has gloves. No open palms, no spread or claw-like fingers.',
    // v5 (9/27): #893's first Forge run turned the dojo roof from the NFT's background into a hat. The head is the NFT.
    'HEAD = THE NFT (the owner must recognise their Rebel instantly):',
    "- The head is copied exactly from the NFT: same face, same head shape, same eyes / eye covering, same mouth or mouth mask, same antennae, and the SAME COLOURS on all of them. Never recolour, redesign or add detail to the head.",
    "- The only things on the head are what the ant itself wears in the NFT (its hat, helmet, bandana or mask traits). Buildings, roofs, pagodas, dojos, temples, gates, trees, clouds, suns, moons and anything else behind the ant are BACKGROUND SCENERY: never turn them into a hat, helmet, crown or headpiece. If the NFT ant wears no hat, the character wears no hat.",
    "- HEAD BASE: wherever headwear, masks, goggles or bandanas do not cover it, the ant's head and antennae are its plain BASE skin colour (the skin colour seen on the NFT's neck and face, usually a smooth warm tan). Mask or headwear colours, patterns, cracks and holes must NOT spread onto the bare parts of the head or the antennae.",
    // v5 (9/27): #4998 only came out clean in 3D once its design was simplified this way; #469/#1555 already were.
    'Clean 3D generation (an AI generator turns this drawing into ONE solid model; layers that float, overlap or hang away from the body come out broken, with holes and see-through gaps):',
    '- Armour and clothing sit TIGHT to the body: a fitted chest plate worn close over the robe, compact shoulder plates resting on top of the shoulders, short hip plates lying flat against the hips and thighs, fitted sleeves, arm and shin guards wrapped tightly.',
    '- No floating, hanging or overhanging parts: no open harness straps with gaps behind them, no long flaring panels, capes or cloth tails, no loose layered flaps.',
    '- Ornaments are FLAT: dragons, crests, horns and other decorations become low-relief embossed emblems on the plates, never sculpted pieces sticking out.',
    '- A clean, solid, readable silhouette. The warrior look comes from colour, trim, emblems and a strong stance, not from bulk.'
  ];
  lines.push(...headGearLines(generationInput?.traitSlots || {}, view));
  if (mask) {
    if (view === 'side') {
      lines.push(`- The "${mask}" is a FACE MASK on the front of the face only. In profile it is a smooth rounded shell following the curve of the round head, flush with it, with no protruding chin or jaw; behind it the head is the ant's plain base skin colour with only the thin strap.`);
    } else if (view === 'back') {
      lines.push(`- The "${mask}" is a FACE MASK worn over the front of the face only. From behind, show the ant's own head (its natural head colour and shape, matching the neck and antennae base) with the mask's strap or cord across the back of the head. The mask pattern must NOT wrap around the back of the head.`);
    } else {
      lines.push(`- The "${mask}" is a rigid FACE MASK like a hockey goalie mask (the Jason-style mask): one smooth rounded shell that covers only the front of the face and follows the round curve of the head, flush with it (no protruding chin or jaw, no gap under it), with its own colour, pattern, cracks and holes; eye lenses sit flush in the shell. It has a visible edge and a thin strap. The top, sides and back of the head and the antennae are the ant's plain base skin colour, not the mask pattern. It must not look like the whole head is made of the mask.`);
    }
  }
  return lines.join('\n');
}
