import { requireForgeStep } from './_wallet.mjs';
import { enforceRateLimit } from './_guard.mjs';
import { forgeImageEdit, fetchImageAsDataUrl, FORGE_REFERENCE_URLS } from './_forge-image.mjs';
import { buildOutfitDesignBlock } from './_forge-outfits.mjs';
import { buildRigFriendlyRules } from './_forge-rig-rules.mjs';
import { resolveForgeSourceImage } from './_forge-source-image.mjs';
import { getCollection } from './_collections.mjs';

const DEFAULT_SIZE = '1024x1536';
const FORGE_ECONOMY_VERSION = 'v0_testing_free';
const FORGE_ECONOMY_MODE = 'testing_free';
const FUTURE_REBEL_POINTS_CURRENCY = 'REBEL_POINTS';
// Optional outfit image reference. OFF by default: a fixed outfit image makes every Rebel wear the same costume.
// Outfit now comes from the colony brief + NFT palette + token-seeded variation (see _forge-outfits.mjs).
function pickBodyReferenceKey(generationInput) {
  const requested = generationInput?.bodyReference;
  return requested && FORGE_REFERENCE_URLS.body[requested] ? requested : null;
}

function buildForgeEconomyPlan(generationInput) {
  const variantIntent = generationInput.variantIntent || 'default';
  const forgeMode = generationInput.forgeMode || 'full_body_concept';

  return {
    economyVersion: FORGE_ECONOMY_VERSION,
    economyMode: FORGE_ECONOMY_MODE,
    charged: false,
    cost: 0,
    currency: FUTURE_REBEL_POINTS_CURRENCY,
    source: 'testing_free_preview',
    reason: 'Forge generations are free during testing. This object is reserved for the future Rebel-owned REBEL Points economy.',
    futureRules: {
      holderOnlyAccess: true,
      oneFreeGenerationPerEligibleNft: true,
      extraGenerationsMayUseRebelPoints: true,
      variantGenerationsMayUseRebelPoints: true,
      cleaner3dReferenceMayUseRebelPoints: true,
      build3dCharacterMayUseRebelPoints: true,
      villageUtilityMayUseRebelPointsLater: true
    },
    requestContext: {
      forgeMode,
      variantIntent,
      rebelId: generationInput.rebelId || null,
      tokenId: generationInput.tokenId || null,
      collectionKey: generationInput.collectionKey || null
    }
  };
}

function buildVariantIntentRules(variantIntent) {
  if (variantIntent === 'more_faithful_face') {
    return `
Variant intent: MORE FAITHFUL FACE.
- This generation should prioritize identity accuracy over body creativity.
- Face, eyes, eye covering, mouth, teeth, expression, antennae, headwear, and upper-body silhouette should stay even closer to Image 1 than in a standard generation.
- If there is a tradeoff between a cooler body design and a more faithful upper face, choose the more faithful upper face.
- Reduce reinterpretation. Reduce stylization drift. Reduce facial embellishment.
- Preserve the exact source facial feeling even if the lower body becomes simpler.
`.trim();
  }

  if (variantIntent === 'stronger_warrior_body') {
    return `
Variant intent: STRONGER WARRIOR BODY.
- Keep the original face, eyes, mouth, teeth, expression, antennae, headwear, and upper-body identity locked to Image 1.
- Improve only the body strength, outfit structure, warrior silhouette, and lower-body design.
- Make the body feel more heroic, game-ready, balanced, and battle-capable without making it bulky or monstrous.
- Improve the torso continuation, belt/sash, robe layers, armor accents, wrapped legs, shin guards, boots/feet, and stance.
- Do not let the stronger body alter the head, face, eyes, mouth, or upper identity.
- If there is a tradeoff between a stronger body and a faithful face, keep the faithful face.
`.trim();
  }

   if (variantIntent === 'cleaner_3d_reference') {
    return `
Variant intent: CLEAN STATIC 3D SOURCE MODEL.
- Create a clean full-body static character reference for future Rebel Standard rigging.
- No weapons.
- No cape.
- No floating accessories.
- No animation pose.
- No action pose.
- Use a neutral A-pose or T-pose.
- Keep the character front-facing and symmetrical.
- Show both arms clearly.
- Show both hands clearly.
- Show separated fingers if possible.
- Show both legs clearly.
- Show both feet/boots clearly.
- Do not crop the body.
- Keep the full body visible from head to feet.
- Use cleaner, more realistic playable-character proportions, closer to the main Rebel playable character.
- Keep clothing riggable (no capes or loose cloth hanging over joints), but keep the full armor and costume detail.
- Avoid cloth crossing over hands, feet, knees, elbows, or shoulders.
- Keep the background simple and neutral.
- Prioritize clean riggable geometry, readable limbs, clean shoulders, clean elbows, clean knees, clean hands, and clean feet over cinematic style.
`.trim();
  }
  return '';
}

function buildFullBodyPreviewPrompt(generationInput, { hasBodyRef = false, outfitBlock = '' } = {}) {
  const PROP = hasBodyRef ? 'Image 3' : 'Image 2';
  const colony = generationInput.colony || 'Rebel Ant';
  const colonyStyle = generationInput.colonyProfile?.baseStyle || 'warrior';
  const weaponName = generationInput.traitSlots?.weapon || 'none';
  const weaponFamily = generationInput.weaponProfile?.family || 'unknown';
  const outfit = generationInput.traitSlots?.outfit || 'none';
  const head = generationInput.traitSlots?.head || 'none';
  const mouth = generationInput.traitSlots?.mouth || 'none';
  const eyes = generationInput.traitSlots?.eyes || 'none';
  const skullCap = generationInput.traitSlots?.skullCap || 'none';
  const skullyFlap = generationInput.traitSlots?.skullyFlap || 'none';
  const background = generationInput.traitSlots?.background || 'none';
  const forgeMode = generationInput.forgeMode || 'full_body_concept';
  const variantIntent = generationInput.variantIntent || 'default';
  const variantIntentRules = buildVariantIntentRules(variantIntent);

  return `
You will receive multiple reference images.

Reference images (in order):
- Image 1 is the PRIMARY identity reference. It is the actual Rebel Ant NFT and must control the character identity AND the outfit palette.
${hasBodyRef ? '- Image 2 is an optional costume-detail reference. Borrow only its level of detail and construction, never its design, colours or silhouette.\n' : ''}- ${PROP} is a PROPORTIONS-ONLY reference: grey clay FRONT and SIDE views of the standard Rebel body (one character seen from two angles; you draw only ONE front view). Match its body proportions (head size relative to body, torso length, leg length, shoulder width, arm length, hand and foot size) and, from the side view, its upright posture. Do not copy its face, mask, outfit, armour, colours or props.
- If there is any conflict about identity or colours, Image 1 always wins. If there is any conflict about body proportions, ${PROP} wins.

Create a clean full-body Rebel Ant character reference image based on Image 1.
The source NFT may be chest-up only, so you must extend the character downward into a full-body result.

${variantIntentRules ? `${variantIntentRules}\n\n` : ''}NON-NEGOTIABLE IDENTITY LOCK:
- The head, face, eyes, eye covering, mouth, teeth, facial expression, antennae, headwear, skull cap, skully flap, mask pieces, and upper clothing wrap must remain as close to Image 1 as possible.
- Do not improve, beautify, humanize, mature, simplify, or reinterpret the face.
- Do not make the mouth calmer, angrier, larger, smaller, straighter, or more detailed than the source.
- Do not change the eye shapes, eye colors, eyepatch/eye covering, grid pattern, visor shape, or visible facial proportions.
- Do not change the head silhouette or antenna placement. You MAY scale the whole head uniformly so the full body matches ${PROP} proportions — change its size, never its design.
- Do not change the visible upper-body colors or garment layout.
- Treat Image 1 like a locked character sheet for the upper half.
- Think of the task as: keep the original head and upper outfit design, then build a full hero-proportioned body under it.

Face and upper-body preservation checklist:
- Same head shape as Image 1.
- Same antennae as Image 1: same count, placement, style and FULL LENGTH relative to the head. Never shorten, stub, drop or hide an antenna under headwear.
- Same eyes / eye covering / visor / patch shape as Image 1.
- Same mouth and teeth shape as Image 1.
- Same facial expression as Image 1.
- Same headwear and head wraps as Image 1.
- Same upper robe / chest wrap / shoulder layout as Image 1.
- Same stylized cartoon ant linework as Image 1.
- Same level of cartoon stylization as Image 1. Do not push the face toward realism.

Proportions (match ${PROP}):
- The head (without antennae) is about one quarter of the character's height. Do not keep the oversized chest-up NFT head scale.
- Legs are long: from crotch to floor is about 40-45% of the height (without antennae).
- Shoulders are no wider than about 1.1 head widths each side of the neck; slim, athletic torso.
- Hands and boots are readable and proportionate, not oversized.
- Slim build like the reference: narrow shoulders, slim arms and a slim chest. No bulky muscles; armour sits tight on the slim body.
- Arms are not long: with the arms down, the wrists are at about hip level and the hands end at the top of the thighs.
- Posture like the reference's side view: standing tall with a straight back, the head directly above the shoulders. No hunch, no head pushed forward, no rounded shoulders.

${buildRigFriendlyRules(generationInput, { view: 'front' })}

Materials and rendering (this image will be turned into a 3D model):
- Render all cloth, robes, wraps, headwear and bandanas as MATTE fabric. No glossy, chrome, metallic or wet highlights on cloth, even when it is gold or yellow.
- Only real armor plates or blades may look like metal, and even then keep highlights soft.
- Soft, even studio lighting. No dramatic rim light, no strong cast shadows, no painted specular highlights.
- Rich but not neon colors, with painted shading and clean dark line-work like Rebel Ants art.

Allowed creative area:
- Creative invention should happen mainly below the chest.
- Complete the torso, waist, legs, boots, wraps, lower robe, belt/sash, shin guards, and lower-body silhouette.
- You may slightly extend the existing upper outfit downward, but do not redesign the upper identity.

${outfitBlock}

Important requirements:
- Output must be a full-body character from head to feet.
- Do not crop the legs or feet.
- Keep the character centered and clearly readable.
- Show a strong, game-ready character silhouette.
- Use a clean neutral front-facing or slightly heroic pose that makes the body easy to understand for later 3D conversion.
- The final image should be a polished full-body character concept suitable as the next step before 3D generation.
- Keep the visual tone consistent with Rebel Ants: stylized warrior ant, Japanese-inspired, heroic, sharp, detailed, high-quality concept art. The colony decides the costume type.
- Background: plain, flat, light-grey studio backdrop. Do NOT reuse the NFT's background colour, scenery or pattern. No scenery, no props on the floor.

Character identity details:
- Name: ${generationInput.name || 'Rebel Ant'}
- Collection: ${generationInput.collectionKey || 'battle_for_colony'}
- Colony: ${colony}
- Colony style: ${colonyStyle}
- Body type: ${generationInput.bodyType || 'universal_ant_v1'}
- Forge mode: ${forgeMode}
- Variant intent: ${variantIntent}
- Weapon trait: ${weaponName}
- Weapon family: ${weaponFamily}
- Outfit trait: ${outfit}
- Head trait: ${head}
- Mouth trait: ${mouth}
- Eyes trait: ${eyes}
- Skull cap trait: ${skullCap}
- Skully flap trait: ${skullyFlap}
- Background trait: ${background} (scenery only: never worn, never on the head)
- Dojo trait: ${generationInput.traitSlots?.dojo || 'none'} (the building behind the ant in Image 1: scenery only, NEVER a hat or headpiece)

Generation rules:
- If the source image is chest-up, continue the visible upper-body design downward into a believable full-body design.
- Preserve the upper body styling and colors, then complete the torso, waist, legs, feet, and outfit continuation.
- Follow the OUTFIT DESIGN section for everything below the chest.
- Keep the weapon visible only if it already feels naturally connected to the source identity.
- Do not let a weapon cover the face, eyes, mouth, torso details, or body silhouette.
- Maintain the character’s outfit logic and faction identity.
- This is a single full-body character reference image, not a collage and not a turnaround sheet.
`.trim();
}

// Oct 20 friend collections (Chumpz apes, Saints of LA humans): the holder's NFT is a hand-drawn chest-up portrait.
// One step turns it into the clean full-body front view the sculptor needs (the Forge uses it as the production
// reference too): a realistic 3D render in an A-pose with the background showing between the arms and the body.
// Apes keep their NFT's fur and skin colours; humans get natural skin (the NFTs draw red, blue or grey skin) and real eyes.
const FRIEND_NAMES = { ape: 'a Chumpz ape', human: 'a Saints of LA character' };
function buildFriendFullBodyPrompt(gi, { hasStyleRef = false } = {}) {
  const ape = gi.species === 'ape';
  const who = `${FRIEND_NAMES[gi.species] || 'a ' + gi.species}${gi.name ? ` (${String(gi.name).slice(0, 60)})` : ''}`;
  const traits = (Array.isArray(gi.friendTraits) ? gi.friendTraits : [])
    .filter((t) => t && t.trait_type && t.value != null && !/^(none|no|null)$/i.test(String(t.value)) && !/background/i.test(String(t.trait_type)))
    .slice(0, 16).map((t) => `${String(t.trait_type).slice(0, 40)}: ${String(t.value).slice(0, 60)}`);
  return `
Image 1 is the owner's NFT: a hand-drawn, chest-up portrait of ${who}.
${hasStyleRef ? `Image 2 is a STYLE reference only: a finished full-body render of another ${ape ? 'Chumpz ape' : 'character'} in the target look. Copy only its realistic 3D render style, its lighting, its plain light-grey background and its body proportions. Never copy its face, ${ape ? 'fur colour' : 'skin, hair'}, clothes, cap, bandana, accessories or its pose.
` : ''}
Create ONE full-body FRONT view of THIS character from Image 1 as a realistic 3D-rendered game character. It is the reference a 3D sculptor builds the character from; then it is rigged and animated in a game, so the owner must recognise their NFT at a glance.

Identity (from Image 1, never changed):
- The same face: the eyes and their colour, the brow, the ${ape ? 'muzzle' : 'nose'}, the mouth and teeth or whatever covers the mouth, the ears, any facial hair, and the same ${ape ? 'skin and fur colours' : 'hair colour'}.
- The same ${ape ? 'fur colour and pattern' : 'hairstyle'}, headwear, glasses or sunglasses, jewellery, chains, tattoos and clothing, with the same colours, patterns, logos and printed text.
${traits.length ? `- Its traits: ${traits.join('; ')}.
` : ''}- Image 1 shows only the head and chest: continue the outfit down the body in the same style (trousers, shorts or skirt and shoes that suit it). The background colour of Image 1 is not part of the character.
${ape ? '' : `- Skin: natural human skin with believable shading. When Image 1 draws a stylised skin colour (red, blue, grey, green or white), use the natural human skin tone closest to it; never a colour real skin can't be.
- Eyes: real human eyes with irises and pupils, looking straight ahead; never blank, white or glowing. Glasses or sunglasses the character wears stay on.
`}
Render:
- Realistic 3D render: real ${ape ? 'fur and skin' : 'skin and hair'}, real fabric, real leather; not a drawing, not a cartoon, not line art, not cel shading.
- ${ape ? 'A strong, upright ape body with realistic proportions' : 'Realistic adult human proportions, about 7.5 heads tall'}; the head at its natural size for the body.
- Plain light-grey background, soft even studio light, the whole body from the top of the head to the soles of the shoes in frame and centred, nothing cropped.

Pose (very important, the character will be rigged):
- A clean A-pose facing the camera: both arms held about 40 degrees out from the body with the elbows almost straight, and the plain background shows between each arm and the torso all the way from the armpit down to the hand.
- Hands open and relaxed, fingers together, palms facing the thighs, touching nothing.
- Legs straight, feet hip-width apart and pointing straight forward.
- Clothes fit the body: shoulder seams on the shoulders, sleeves ending at the wrists, nothing loose hanging from the elbows, wrists, knees or ankles.

Output: one single full-body front view. Not a collage, not a turnaround sheet, no added text, no extra characters, nothing in the hands, no weapons.
`.trim();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  // Phase 0 cost guard: OpenAI image generations per visitor per day (admins unlimited).
  if (!(await enforceRateLimit(req, res, 'img-concept', 25, 86400, 'image generations today'))) return;
  // Phase 2: paid steps only run inside a forge the Rebel's owner started (admins pass)
  { const gi = (req.body || {}).generationInput || {}; if (!(await requireForgeStep(req, res, { collectionKey: gi.collectionKey, tokenId: gi.tokenId, step: 'concept' }))) return; }

  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        ok: false,
        error: 'Missing OPENAI_API_KEY'
      });
    }

    const { generationInput } = req.body || {};

    if (!generationInput || typeof generationInput !== 'object') {
      return res.status(400).json({
        ok: false,
        error: 'Missing generationInput'
      });
    }

    if (!generationInput.rebelId || !generationInput.collectionKey || !generationInput.sourceImage) {
      return res.status(400).json({
        ok: false,
        error: 'Missing required Forge generation fields'
      });
    }

    // friend collections: their species' prompt, the NFT + (apes) the style render; never the Rebels' clay or outfits
    const friend = (await getCollection(generationInput.collectionKey))?.friend ? generationInput.species : null;
    const bodyReferenceKey = friend ? null : pickBodyReferenceKey(generationInput);
    const outfit = friend ? { text: '', colony: null, variation: null } : buildOutfitDesignBlock(generationInput);
    const styleUrl = friend ? FORGE_REFERENCE_URLS.friendStyle?.[friend] || null : null;
    const prompt = friend ? buildFriendFullBodyPrompt({ ...generationInput, species: friend }, { hasStyleRef: !!styleUrl })
      : buildFullBodyPreviewPrompt(generationInput, { hasBodyRef: !!bodyReferenceKey, outfitBlock: outfit.text });
    // the last image: the Rebels' clay proportions, or a friend species' style render
    const [sourceImageDataUrl, proportionsReferenceDataUrl, bodyReferenceDataUrl] = await Promise.all([
      resolveForgeSourceImage(generationInput.sourceImage).then(fetchImageAsDataUrl),
      friend ? (styleUrl ? fetchImageAsDataUrl(styleUrl) : Promise.resolve(null)) : fetchImageAsDataUrl(FORGE_REFERENCE_URLS.proportions),
      bodyReferenceKey ? fetchImageAsDataUrl(FORGE_REFERENCE_URLS.body[bodyReferenceKey]) : Promise.resolve(null)
    ]);
    const economyPlan = buildForgeEconomyPlan(generationInput);

    const { imageBase64, imageModel, attempts } = await forgeImageEdit({
      apiKey,
      prompt,
      images: [sourceImageDataUrl, bodyReferenceDataUrl, proportionsReferenceDataUrl].filter(Boolean),
      size: DEFAULT_SIZE
    });

       const previewPlan = {
      previewVersion: 'v1',
      requestAccepted: true,
      rebelId: generationInput.rebelId || null,
      tokenId: generationInput.tokenId || null,
      collectionKey: generationInput.collectionKey || null,
      sourceFraming: generationInput.sourceFraming || 'unknown',
      targetOutput: generationInput.targetOutput || 'full_body_3d_character',
      requiresFullBodyCompletion: generationInput.requiresFullBodyCompletion === true,
      bodyType: generationInput.bodyType || 'universal_ant_v1',
      forgeMode: generationInput.forgeMode || 'full_body_concept',
      variantIntent: generationInput.variantIntent || 'default',
      colony: generationInput.colony || null,
      colonyStyle: generationInput.colonyProfile?.baseStyle || null,
      weaponFamily: generationInput.weaponProfile?.family || null,
      economyPlan,
      size: DEFAULT_SIZE,
      imageModel,
      imageModelAttempts: attempts,
      bodyReference: bodyReferenceKey,
      outfitColony: outfit.colony,
      outfitVariation: outfit.variation,
      nextStep: 'fullbody_preview_generated'
    };

        return res.status(200).json({
      ok: true,
      generated: true,
      mode: 'fullbody_preview',
      message: 'Full-body Forge preview generated.',
      promptUsed: prompt,
      economyPlan,
      previewPlan,
      previewImage: {
        mimeType: 'image/png',
        base64: imageBase64,
        dataUrl: `data:image/png;base64,${imageBase64}`
      }
    });
  } catch (err) {
    console.error('forge-generate-fullbody-preview error:', err);

    return res.status(500).json({
      ok: false,
      error: 'Could not generate full-body Forge preview',
      detail: err && err.message ? err.message : 'Unknown error'
    });
  }
}
