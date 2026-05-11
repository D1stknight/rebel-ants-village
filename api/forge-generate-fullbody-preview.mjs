const RESPONSES_MODEL = 'gpt-5.5';
const DEFAULT_SIZE = '1024x1536';

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

Important requirements:
- Preserve the character’s identity from the source image.
- Output must be a full-body character from head to feet.
- Do not crop the legs or feet.
- Keep the character centered and clearly readable.
- Show a strong, game-ready character silhouette.
- The final image should be a polished full-body character concept suitable as the next step before 3D generation.
- Use a clean neutral character pose that makes the body easy to understand for later 3D conversion.
- Keep the visual tone consistent with Rebel Ants: stylized warrior ant, Japanese-inspired, heroic, sharp, detailed, high-quality concept art.
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
- If the source image is chest-up, infer and design the missing torso, waist, legs, feet, and full outfit continuation in a way that matches the visible upper body.
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
                image_url: generationInput.sourceImage
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
