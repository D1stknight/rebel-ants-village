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

  return `
Use the provided source NFT image as the identity reference.

Create a clean full-body Rebel Ant character reference image based on that source image.
The source NFT may be chest-up only, so you must complete the missing lower body and produce a full-body result.

Absolute highest priority:
- Treat the source image as the canonical design for everything visible in the upper body.
- Do not redesign the face.
- Do not reinterpret the eyes.
- Do not significantly change the mouth.
- Do not significantly change the head shape.
- Do not significantly change the headwear, skull cap, skully flap, eyepatch/eye covering, antenna placement, or visible upper clothing wrap.
- Do not change the main visible colors of the upper body.
- Preserve the upper-body identity as closely as possible.
- Think of this as extending the character downward, not redesigning the character.

Upper-body preservation rules:
- The area from the top of the head down through the chest should closely match the source image.
- Keep the same recognizable facial expression and upper-body styling.
- Keep the same line-language and stylized cartoon ant identity.
- Do not make the face more human or more realistic than the source.
- Do not replace or restyle the upper features unless absolutely necessary for image coherence.

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
- Creative changes should happen mainly below the chest.
- Preserve the upper body styling and colors, then complete the torso, waist, legs, feet, and outfit continuation.
- Extend the outfit into a more ninja-warrior full-body design: layered shinobi/samurai-inspired wraps, tied waist sash, fitted sleeves, stronger lower-body garment structure, shin guards or wrapped lower legs, and warrior-style sandals or footwear that matches the character.
- Keep the weapon visible if appropriate.
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
              }
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
