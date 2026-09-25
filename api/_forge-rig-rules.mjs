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
    "- HEAD BASE: wherever headwear, masks, goggles or bandanas do not cover it, the ant's head and antennae are its plain BASE skin colour (the skin colour seen on the NFT's neck and face, usually a smooth warm tan). Mask or headwear colours, patterns, cracks and holes must NOT spread onto the bare parts of the head or the antennae."
  ];
  if (mask) {
    if (view === 'back') {
      lines.push(`- The "${mask}" is a FACE MASK worn over the front of the face only. From behind, show the ant's own head (its natural head colour and shape, matching the neck and antennae base) with the mask's strap or cord across the back of the head. The mask pattern must NOT wrap around the back of the head.`);
    } else {
      lines.push(`- The "${mask}" is a rigid FACE MASK like a hockey goalie mask (the Jason-style mask): one oval shell that covers only the front of the face, from the brow to the chin, with its own colour, pattern, cracks and holes. It has a visible edge and a thin strap. The top, sides and back of the head and the antennae are the ant's plain base skin colour, not the mask pattern. It must not look like the whole head is made of the mask.`);
    }
  }
  return lines.join('\n');
}
