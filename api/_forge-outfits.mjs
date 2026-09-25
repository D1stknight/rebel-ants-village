// Forge outfit design system (not a route: files starting with "_" are ignored by Vercel).
// Every Rebel shares the same body PROPORTIONS (clay reference image), but the OUTFIT comes from:
//   1. the colony brief (11 colonies, each a distinct silhouette),
//   2. the NFT's own outfit trait + visible colours (palette and pattern continue downward),
//   3. a small token-seeded variation (same token => same result, different tokens => different combos).

export const COLONY_OUTFIT_BRIEFS = {
  Samurai: 'Disciplined swordsman. Lacquered chest plate (do) over the kimono, a skirt of layered plates (kusazuri), armoured sleeves (kote) and shin guards (suneate). Orderly, polished, symmetrical.',
  Ronin: 'Lone wandering swordsman. Worn travel kimono and hakama with frayed hems and patches, bandaged forearms, straw sandals. Almost no armour, at most one weathered shoulder piece. Lean and dusty.',
  Bushi: 'Armoured field warrior. Practical lamellar cuirass, layered rectangular shoulder guards (sode), armoured sleeves and thigh guards (haidate). Rugged and functional, not ornate.',
  Warrior: 'Battle-hardened fighter. Mixed leather and cloth, crossing straps and buckles, bandages, mismatched scavenged armour pieces, scuffed and repaired.',
  Shogun: 'Warlord commander. Heavy ornate great armour (o-yoroi) with gold trim, broad layered shoulder plates, rich brocade underlayer, a commanding, wide-shouldered silhouette.',
  Buke: 'Noble guardian. Formal kamishimo (stiff winged-shoulder vest) over a patterned kimono, refined hakama, elegant crests, only light guard pieces. Dignified and clean.',
  Kenshi: 'Master bladesman. Sleek fitted duelist outfit: tight-sleeved top, hakama, a single arm guard on the sword arm, long sash. Minimal and precise.',
  Wokou: 'Sea raider. Open sleeveless jacket or vest, bare wrapped arms, wide knotted sash, rope and chain accents, rolled-up trousers, sea-worn fabric.',
  Ashigaru: 'Foot soldier. Simple standard-issue plate vest (okegawa-do), plain cloth underneath, wrapped shins, practical pouches and a water gourd. Humble and uniform-like.',
  Sohei: 'Warrior monk. Layered monk robes with a kesa draped over one shoulder, a large string of prayer beads, hakama, white shin wraps (kyahan), sandals. Flowing, spiritual, very little metal.',
  Yamabushi: 'Mountain ascetic. Suzukake robe with pom-pom (bonten) ornaments on the sash, animal-fur leggings, rope belt, a conch shell or small shrine box at the hip. Wild and earthy.'
};

const DEFAULT_BRIEF = 'Stylised Japanese warrior. A layered, detailed outfit that suits the NFT: robes or light armour, sash, arm and leg wraps, sandals or split-toe boots.';

const VARIATION_AXES = {
  sleeves: [
    'full sleeves tied back at the wrist',
    'sleeves tucked into forearm guards',
    'one shoulder bared, the sleeve tucked into the belt (kataginu style)',
    'short sleeves over wrapped forearms',
    'wide sleeves with coloured cuffs'
  ],
  legs: [
    'wide pleated hakama',
    'tapered trousers with wrapped shins',
    'knee-length hakama over leggings',
    'baggy trousers gathered at the ankle',
    'split front panel over fitted leggings'
  ],
  footwear: [
    'straw waraji sandals with tabi socks',
    'split-toe jika-tabi boots',
    'wooden geta-style sandals',
    'cloth-wrapped boots',
    'sandals with wrapped ankle straps'
  ],
  belt: [
    'wide obi with a side knot',
    'rope belt with tassels',
    'layered sash with a hip pouch',
    'cord belt with hanging charms',
    'double sash in two colours'
  ],
  accent: [
    'one asymmetric accent piece on the LEFT shoulder',
    'one asymmetric accent piece on the RIGHT shoulder',
    'a scroll case at the hip',
    'tight wrist wraps with flat tucked ends',
    'a small emblem plate on the chest'
  ],
  pattern: [
    'a subtle repeating crest pattern on the lower garment',
    'contrasting trim on every hem',
    'a wave pattern along the lower hem',
    'plain fabric with strong stitched seams',
    'a two-tone split between upper and lower garment'
  ]
};

// small deterministic hash (FNV-1a) so the same token always gets the same variation
function hash32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function pickOutfitVariation({ collectionKey, tokenId, rebelId, variationSeed }) {
  // variationSeed (optional) lets a holder re-roll; without it the same token always gets the same look
  const seedBase = `${collectionKey || 'rebel'}:${tokenId || rebelId || 'x'}:${variationSeed || ''}`;
  const out = {};
  Object.entries(VARIATION_AXES).forEach(([axis, options], i) => {
    const seed = hash32(`${seedBase}:${axis}:${i}`);
    out[axis] = options[seed % options.length];
  });
  return out;
}

function pretty(v) {
  return v ? String(v).replace(/-/g, ' ').replace(/\s+\d+$/, '').trim() : null;
}

export function buildOutfitDesignBlock(generationInput) {
  const colony = generationInput?.colony || generationInput?.traitSlots?.colony || null;
  const brief = (colony && COLONY_OUTFIT_BRIEFS[colony]) || DEFAULT_BRIEF;
  const outfitTrait = pretty(generationInput?.traitSlots?.outfit);
  const v = pickOutfitVariation(generationInput || {});

  return {
    colony,
    variation: v,
    text: `
OUTFIT DESIGN (this is what makes this Rebel unique, so follow it closely):
- Colony: ${colony || 'unknown'}. ${brief}
- The NFT's own outfit${outfitTrait ? ` ("${outfitTrait}")` : ''} is the starting point. Continue its exact colours, fabric pattern and garment layout downward. The palette comes from Image 1, not from any other image.
- This Rebel's signature details:
  - Sleeves: ${v.sleeves}
  - Legs: ${v.legs}
  - Footwear: ${v.footwear}
  - Belt: ${v.belt}
  - Accent: ${v.accent}
  - Fabric: ${v.pattern}
- If a signature detail clashes with the colony description, the colony description wins.
- Costume quality: rich, layered, game-hero level detail (seams, trims, straps, wraps). Never a plain gi or plain robe.
- Do NOT default to generic samurai armour unless the colony description asks for armour.
`.trim()
  };
}
