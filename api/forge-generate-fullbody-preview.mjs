const OPENAI_IMAGE_MODEL = 'gpt-image-1.5';
const DEFAULT_SIZE = '1024x1536';
const DEFAULT_QUALITY = 'medium';

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

async function fetchImageAsBlob(imageUrl) {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error('Could not fetch source image. Status: ' + response.status);
  }

  const contentType = response.headers.get('content-type') || 'image/png';
  const arrayBuffer = await response.arrayBuffer();
  return new Blob([arrayBuffer], { type: contentType });
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
    const sourceImageBlob = await fetchImageAsBlob(generationInput.sourceImage);

    const form = new FormData();
    form.append('model', OPENAI_IMAGE_MODEL);
    form.append('prompt', prompt);
    form.append('size', DEFAULT_SIZE);
    form.append('quality', DEFAULT_QUALITY);
    form.append('image', sourceImageBlob, 'source-reference.png');

    const openaiResponse = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`
      },
      body: form
    });

    const openaiData = await openaiResponse.json();

    if (!openaiResponse.ok) {
      console.error('OpenAI fullbody preview error:', openaiData);
      throw new Error(
        openaiData?.error?.message ||
        ('OpenAI image request failed. Status: ' + openaiResponse.status)
      );
    }

    const imageBase64 = openaiData?.data?.[0]?.b64_json;

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
      quality: DEFAULT_QUALITY,
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
