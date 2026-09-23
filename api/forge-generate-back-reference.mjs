import { forgeImageEdit, fetchImageAsDataUrl } from './_forge-image.mjs';

// Back view of a Forge production reference, for Meshy multi-image-to-3D.
// A single front image makes Meshy guess the back, which puts faces, eye patches and visors on the back of the head.
// Front + back removes the guess.

const DEFAULT_SIZE = '1024x1536';

function buildBackViewPrompt(generationInput = {}) {
  const colony = generationInput.colony || 'Rebel Ant';
  return `
Image 1 is the FRONT view of a stylised Rebel Ant game character in a neutral A-pose.
Draw the SAME character seen from DIRECTLY BEHIND (a 180-degree turn), for a 3D modelling turnaround.

Match Image 1 exactly:
- Same pose (A-pose, arms out at the same angle), same height, same scale, same framing, head-to-feet in frame.
- Same outfit, same colours, same materials, same art style and line-work, same plain light-grey background, same soft even lighting.
- Mirror left and right correctly: the character's right side is now on the image's right.

The back of the head (very important):
- The face is ONLY on the front. From behind there are NO eyes, NO visor, NO eye patch, NO goggles lenses, NO mouth or teeth and NO face mask front.
- Show what would really be on the back of this head: the back of the skull, the head-wrap or bandana knot and its tails, hair, the back of the helmet or skull cap, and mask straps.
- Antennae: the same two antennae, attached at the same place on top of the head, the same length, seen from behind. Do not bend them sideways and do not add a bar or frame between them.

The back of the body:
- Continue the outfit logically: the back of the robe, vest or armour, the knot of the sash or belt, back plates, and the backs of the sleeves, legs and footwear.
- Keep anything worn on the back (quiver, scabbard strap, cape) only if Image 1 clearly implies it. No weapons in the hands.
- Colony: ${colony}.

Output: one single full-body back view. Not a collage, not a turnaround sheet, no text, no extra characters, no cropped limbs.
`.trim();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ ok: false, error: 'Missing OPENAI_API_KEY' });

    const { generationInput, productionImageDataUrl, productionImageUrl } = req.body || {};

    let frontImage = null;
    if (typeof productionImageDataUrl === 'string' && productionImageDataUrl.startsWith('data:image/')) {
      frontImage = productionImageDataUrl;
    } else if (typeof productionImageUrl === 'string' && /^https:\/\//.test(productionImageUrl)) {
      frontImage = await fetchImageAsDataUrl(productionImageUrl);
    }
    if (!frontImage) return res.status(400).json({ ok: false, error: 'Missing production reference image' });

    const prompt = buildBackViewPrompt(generationInput || {});
    const { imageBase64, imageModel, attempts } = await forgeImageEdit({
      apiKey,
      prompt,
      images: [frontImage],
      size: DEFAULT_SIZE
    });

    return res.status(200).json({
      ok: true,
      generated: true,
      mode: 'back_reference',
      backPlan: {
        view: 'back',
        size: DEFAULT_SIZE,
        imageModel,
        imageModelAttempts: attempts,
        tokenId: generationInput?.tokenId || null,
        colony: generationInput?.colony || null,
        nextStep: 'upload_back_reference_then_meshy_multi_image'
      },
      backImage: {
        mimeType: 'image/png',
        base64: imageBase64,
        dataUrl: `data:image/png;base64,${imageBase64}`
      }
    });
  } catch (err) {
    console.error('forge-generate-back-reference error:', err);
    return res.status(500).json({
      ok: false,
      error: 'Could not generate back view',
      detail: err && err.message ? err.message : 'Unknown error'
    });
  }
}
