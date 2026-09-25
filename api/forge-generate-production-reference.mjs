import { enforceRateLimit } from './_guard.mjs';
import { forgeImageEdit, fetchImageAsDataUrl, FORGE_REFERENCE_URLS } from './_forge-image.mjs';
import { buildRigFriendlyRules } from './_forge-rig-rules.mjs';

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
You will receive two reference images.

Image 1 is the selected full-body Rebel Ant concept chosen by the user.
Image 2 is a PROPORTIONS-ONLY reference: a grey clay render of the main playable Rebel character. Use it only for body proportions. Do not copy its face, mask, outfit, colors or props.
Create a cleaner 3D production reference from that selected concept.

Goal:
- Convert the selected concept into a cleaner front-facing production reference for a future 3D character pipeline.
- This is not the final 3D model.
- This is a clean image reference that will later help generate or build a game-ready 3D Rebel Ant character.

Identity lock:
- Preserve the selected concept's head, face, eyes, eye covering, mouth, teeth, facial expression, antennae (full length, never shortened), headwear, and upper-body identity.
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
- Use a plain, flat, light-grey studio background. Never the NFT's background colour or scenery.
- Reduce cinematic lighting, heavy shadows, motion, smoke, dramatic perspective, and background clutter.
- Keep the silhouette clean and readable.
- Keep outfit layers, sash, wraps, armor accents, robe structure, shin guards, and boots clear.
- Keep the art high quality. Clean up the pose only — do NOT simplify the outfit. Keep every armor plate, strap, wrap, guard and trim from Image 1.

Proportions (match Image 2):
- Head (without antennae) about one quarter of the height; you may scale the head uniformly, never change its design.
- Legs from crotch to floor about 40-45% of the height; slim athletic torso; shoulders not wider than Image 2.
- Hands and boots proportionate and clearly readable.

${buildRigFriendlyRules(generationInput, { view: 'front' })}

Materials and lighting (this image goes straight into image-to-3D):
- All cloth, robes, wraps, headwear and bandanas are MATTE fabric. No glossy, chrome, metallic or wet-looking highlights on cloth, even gold or yellow cloth.
- Only real armor plates or blades may read as metal, with soft highlights.
- Flat, even, shadowless studio lighting. No rim light, no cast shadows, no painted specular highlights, no ambient occlusion baked into the colors beyond gentle shading.
- Rich but not neon colors, clean dark line-work, same art style as Image 1.

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

  // Phase 0 cost guard: OpenAI image generations per visitor per day (admins unlimited).
  if (!(await enforceRateLimit(req, res, 'img-production', 15, 86400, 'image generations today'))) return;

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

    const proportionsReferenceDataUrl = await fetchImageAsDataUrl(FORGE_REFERENCE_URLS.proportions);

    const { imageBase64, imageModel, attempts } = await forgeImageEdit({
      apiKey,
      prompt,
      images: [selectedConceptImage, proportionsReferenceDataUrl],
      size: DEFAULT_SIZE
    });

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
      imageModel,
      imageModelAttempts: attempts,
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
