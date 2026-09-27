// Shared "this will be rigged and animated" rules for every Forge image prompt (not a route).
// Learned from play-testing: splayed oversized feet, rope ends sticking out of elbows,
// and full-face masks that Meshy wraps around the whole head.

function pretty(v) {
  return v ? String(v).replace(/-/g, ' ').replace(/\s+\d+$/, '').trim() : null;
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
