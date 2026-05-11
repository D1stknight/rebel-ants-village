const RESPONSES_MODEL = 'gpt-5.5';
const DEFAULT_SIZE = '1024x1536';

async function fetchSourceImageAsDataUrl(imageUrl) {
  const response = await fetch(imageUrl, {
    headers: {
      Accept: 'image/png,image/jpeg,image/webp,image/gif'
    }
  });

  if (!response.ok) {
    throw new Error('Could not fetch source image. Status: ' + response.status);
  }

  const contentType = response.headers.get('content-type') || '';

  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(contentType)) {
    throw new Error('Unsupported source image type: ' + (contentType || 'unknown'));
  }

  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');

  return `data:${contentType};base64,${base64}`;
}

async function fetchBodyReferenceDataUrls() {
  const bodyReferenceUrls = [
    'https://raw.githubusercontent.com/D1stknight/rebel-ants-village/dev/assets/forge-references/body/orange-shinobi-layered.png'
  ];

  const results = [];

  for (const bodyReferenceUrl of bodyReferenceUrls) {
    const dataUrl = await fetchSourceImageAsDataUrl(bodyReferenceUrl);
    results.push(dataUrl);
  }

  return results;
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

  return '';
}

function buildFullBodyPreviewPrompt(generationInput) {
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

Reference priority:
- Image 1 is the PRIMARY identity reference. It is the actual Rebel Ant NFT and must control the character identity.
- Any images after Image 1 are BODY-ONLY style references. Use them only to guide the missing lower body, outfit continuation, wraps, shin guards, footwear, sash structure, silhouette, and ninja-warrior body design.
- Do not copy the face, eyes, mouth, head, antennae, headwear, or upper-body identity from the body reference images.
- If there is any conflict between the references, Image 1 always wins.

Create a clean full-body Rebel Ant character reference image based on Image 1.
The source NFT may be chest-up only, so you must extend the character downward into a full-body result.

${variantIntentRules ? `${variantIntentRules}\n\n` : ''}NON-NEGOTIABLE IDENTITY LOCK:
- The head, face, eyes, eye covering, mouth, teeth, facial expression, antennae, headwear, skull cap, skully flap, mask pieces, and upper clothing wrap must remain as close to Image 1 as possible.
- Do not improve, beautify, humanize, mature, simplify, or reinterpret the face.
- Do not make the mouth calmer, angrier, larger, smaller, straighter, or more detailed than the source.
- Do not change the eye shapes, eye colors, eyepatch/eye covering, grid pattern, visor shape, or visible facial proportions.
- Do not change the head silhouette or antenna placement.
- Do not change the visible upper-body colors or garment layout.
- Treat Image 1 like a locked character sheet for the upper half.
- Think of the task as: keep the original top half, then invent only the missing lower half.

Face and upper-body preservation checklist:
- Same head shape as Image 1.
- Same antennae placement and antenna style as Image 1.
- Same eyes / eye covering / visor / patch shape as Image 1.
- Same mouth and teeth shape as Image 1.
- Same facial expression as Image 1.
- Same headwear and head wraps as Image 1.
- Same upper robe / chest wrap / shoulder layout as Image 1.
- Same stylized cartoon ant linework as Image 1.
- Same level of cartoon stylization as Image 1. Do not push the face toward realism.

Allowed creative area:
- Creative invention should happen mainly below the chest.
- Complete the torso, waist, legs, boots, wraps, lower robe, belt/sash, shin guards, and lower-body silhouette.
- You may slightly extend the existing upper outfit downward, but do not redesign the upper identity.

Body-reference rules:
- Use the body reference images only to improve the lower-body structure and ninja-warrior styling.
- Borrow body language from those references: waist sash structure, robe continuation, layered shinobi / samurai lower-body design, wrapped lower legs, shin guards, footwear, and stronger warrior silhouette.
- Do not borrow their face, head, colors, expression, eyes, mouth, antennae, or upper-body identity.

Important requirements:
- Output must be a full-body character from head to feet.
- Do not crop the legs or feet.
- Keep the character centered and clearly readable.
- Show a strong, game-ready character silhouette.
- Use a clean neutral front-facing or slightly heroic pose that makes the body easy to understand for later 3D conversion.
- The final image should be a polished full-body character concept suitable as the next step before 3D generation.
- Keep the visual tone consistent with Rebel Ants: stylized warrior ant, Japanese-inspired, ninja-warrior, heroic, sharp, detailed, high-quality concept art.
- The completed lower body should feel more like a stealthy ninja warrior / Japanese fighter than a plain robe character.
- Prefer a simple clean backdrop or subtle neutral studio-style background so the character remains the focus.

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
- Background trait: ${background}

Generation rules:
- If the source image is chest-up, continue the visible upper-body design downward into a believable full-body design.
- Preserve the upper body styling and colors, then complete the torso, waist, legs, feet, and outfit continuation.
- Use the body reference images to improve the lower-body structure and ninja-warrior styling.
- Keep the weapon visible only if it already feels naturally connected to the source identity.
- Do not let a weapon cover the face, eyes, mouth, torso details, or body silhouette.
- Maintain the character’s outfit logic and faction identity.
- This is a single full-body character reference image, not a collage and not a turnaround sheet.
`.trim();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

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

    const prompt = buildFullBodyPreviewPrompt(generationInput);
    const sourceImageDataUrl = await fetchSourceImageAsDataUrl(generationInput.sourceImage);
    const bodyReferenceDataUrls = await fetchBodyReferenceDataUrls();

    const openaiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: RESPONSES_MODEL,
        input: [
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: prompt
              },
              {
                type: 'input_image',
                image_url: sourceImageDataUrl
              },
              ...bodyReferenceDataUrls.map(imageUrl => ({
                type: 'input_image',
                image_url: imageUrl
              }))
            ]
          }
        ],
        tools: [
          {
            type: 'image_generation',
            action: 'edit',
            size: DEFAULT_SIZE
          }
        ]
      })
    });

    const openaiData = await openaiResponse.json();

    if (!openaiResponse.ok) {
      console.error('OpenAI fullbody preview error:', openaiData);

      throw new Error(
        openaiData?.error?.message ||
        ('OpenAI response request failed. Status: ' + openaiResponse.status)
      );
    }

    const imageGenerationCall = (openaiData.output || []).find(
      item => item.type === 'image_generation_call' && item.result
    );

    const imageBase64 = imageGenerationCall?.result || null;

    if (!imageBase64) {
      throw new Error('OpenAI did not return image data');
    }

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
      size: DEFAULT_SIZE,
      nextStep: 'fullbody_preview_generated'
    };

    return res.status(200).json({
      ok: true,
      generated: true,
      mode: 'fullbody_preview',
      message: 'Full-body Forge preview generated.',
      promptUsed: prompt,
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
