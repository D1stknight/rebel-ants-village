const RESPONSES_MODEL = 'gpt-5.5';
const DEFAULT_SIZE = '1024x1536';

async function fetchImageUrlAsDataUrl(imageUrl) {
  const response = await fetch(imageUrl, {
    headers: {
      Accept: 'image/png,image/jpeg,image/webp,image/gif'
    }
  });

  if (!response.ok) {
    throw new Error('Could not fetch selected concept image. Status: ' + response.status);
  }

  const contentType = response.headers.get('content-type') || '';

  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(contentType)) {
    throw new Error('Unsupported selected concept image type: ' + (contentType || 'unknown'));
  }

  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');

  return `data:${contentType};base64,${base64}`;
}

function parseInputImage({ selectedConceptImageDataUrl }) {
  if (selectedConceptImageDataUrl && typeof selectedConceptImageDataUrl === 'string') {
    if (!selectedConceptImageDataUrl.startsWith('data:image/')) {
      throw new Error('selectedConceptImageDataUrl must be an image data URL');
    }

    return selectedConceptImageDataUrl;
  }

  return null;
}

function buildProductionReferencePrompt({ generationInput, selectedConcept }) {
  const tokenId = selectedConcept?.tokenId || generationInput?.tokenId || 'unknown';
  const rebelId = selectedConcept?.rebelId || generationInput?.rebelId || 'unknown';
  const collectionKey = selectedConcept?.collectionKey || generationInput?.collectionKey || 'battle_for_colony';
  const colony = selectedConcept?.colony || generationInput?.colony || 'Rebel Ant';
  const bodyType = selectedConcept?.bodyType || generationInput?.bodyType || 'universal_ant_v1';

  return `
You will receive one reference image.

Image 1 is the selected full-body Rebel Ant concept chosen by the user.
Create a cleaner 3D production reference from that selected concept.

Goal:
- Convert the selected concept into a cleaner front-facing production reference for a future 3D character pipeline.
- This is not the final 3D model.
- This is a clean image reference that will later help generate or build a game-ready 3D Rebel Ant character.

Identity lock:
- Preserve the selected concept's head, face, eyes, eye covering, mouth, teeth, facial expression, antennae, headwear, and upper-body identity.
- Do not redesign the face.
- Do not reinterpret the eyes.
- Do not change the mouth or teeth.
- Do not humanize the face.
- Keep the same Rebel Ant identity and colony feeling.

Production reference rules:
- Make the character mostly front-facing.
- Use a clean neutral stance, close to an A-pose or relaxed production pose.
- Keep both arms visible and separated from the torso where possible.
- Keep hands or claws visible and readable.
- Keep legs and feet visible from hip to foot.
- Keep the full body visible from head to feet.
- Use a simple neutral studio background.
- Reduce cinematic lighting, heavy shadows, motion, smoke, dramatic perspective, and background clutter.
- Keep the silhouette clean and readable.
- Keep outfit layers, sash, wraps, armor accents, robe structure, shin guards, and boots clear.
- Keep the art high quality, but make the pose and design cleaner for later 3D conversion.

Weapon rules:
- Do not attach weapons to the body.
- Do not place a weapon in the hands.
- Do not let any weapon cover the face, torso, arms, hands, legs, or feet.
- If the source concept includes a weapon, remove it from the character design. Weapons will be generated separately later.

Character metadata:
- Rebel ID: ${rebelId}
- Token ID: ${tokenId}
- Collection: ${collectionKey}
- Colony: ${colony}
- Body type: ${bodyType}
- Target output: clean_3d_production_reference
- Weapon handling: no_weapon_attached_generate_separately_later

Output requirements:
- Single full-body character only.
- Not a collage.
- Not a turnaround sheet.
- No text labels in the image.
- No cropped limbs.
- No extra characters.
- No weapons attached.
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

    const {
      generationInput,
      selectedConcept,
      selectedConceptImageUrl,
      selectedConceptImageDataUrl
    } = req.body || {};

    if (!generationInput || typeof generationInput !== 'object') {
      return res.status(400).json({
        ok: false,
        error: 'Missing generationInput'
      });
    }

    if (!selectedConcept || typeof selectedConcept !== 'object') {
      return res.status(400).json({
        ok: false,
        error: 'Missing selectedConcept'
      });
    }

    let selectedConceptImage = parseInputImage({ selectedConceptImageDataUrl });

    if (!selectedConceptImage && selectedConceptImageUrl) {
      selectedConceptImage = await fetchImageUrlAsDataUrl(selectedConceptImageUrl);
    }

    if (!selectedConceptImage) {
      return res.status(400).json({
        ok: false,
        error: 'Missing selected concept image'
      });
    }

    const prompt = buildProductionReferencePrompt({ generationInput, selectedConcept });

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
                image_url: selectedConceptImage
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
      console.error('OpenAI production reference error:', openaiData);

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
      throw new Error('OpenAI did not return production reference image data');
    }

    const productionPlan = {
      productionReferenceVersion: 'v1',
      requestAccepted: true,
      sourceConceptId: selectedConcept.conceptId || selectedConcept.id || null,
      rebelId: selectedConcept.rebelId || generationInput.rebelId || null,
      tokenId: selectedConcept.tokenId || generationInput.tokenId || null,
      collectionKey: selectedConcept.collectionKey || generationInput.collectionKey || null,
      colony: selectedConcept.colony || generationInput.colony || null,
      targetOutput: 'clean_3d_production_reference',
      poseGoal: 'front_facing_clean_a_pose_like_reference',
      weaponHandling: 'no_weapon_attached_generate_separately_later',
      sourceImageType: selectedConceptImageUrl ? 'blob_url' : 'data_url',
      size: DEFAULT_SIZE,
      nextStep: 'save_production_reference'
    };

    return res.status(200).json({
      ok: true,
      generated: true,
      mode: 'production_reference',
      message: '3D production reference generated.',
      promptUsed: prompt,
      productionPlan,
      productionImage: {
        mimeType: 'image/png',
        base64: imageBase64,
        dataUrl: `data:image/png;base64,${imageBase64}`
      }
    });
  } catch (err) {
    console.error('forge-generate-production-reference error:', err);

    return res.status(500).json({
      ok: false,
      error: 'Could not generate 3D production reference',
      detail: err && err.message ? err.message : 'Unknown error'
    });
  }
}
