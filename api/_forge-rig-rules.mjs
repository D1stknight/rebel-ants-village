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
    '- Keep a small gap between the hands and the robe/thighs; the hands must not touch the body or clothing.'
  ];
  if (mask) {
    if (view === 'back') {
      lines.push(`- The "${mask}" is a FACE MASK worn over the front of the face only. From behind, show the ant's own head (its natural head colour and shape, matching the neck and antennae base) with the mask's strap or cord across the back of the head. The mask pattern must NOT wrap around the back of the head.`);
    } else {
      lines.push(`- The "${mask}" is a separate FACE MASK strapped over the front of the ant's face. Draw it as a distinct object with a visible edge and a strap, and show a little of the ant's own head (its natural head colour) around the top and sides. It must not look like the whole head is made of the mask.`);
    }
  }
  return lines.join('\n');
}
