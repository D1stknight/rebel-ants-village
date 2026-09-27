import { enforceRateLimit } from './_guard.mjs';
import { forgeImageEdit, fetchImageAsDataUrl } from './_forge-image.mjs';
import { buildRigFriendlyRules } from './_forge-rig-rules.mjs';

// Side views of a Forge production reference, for 4-view Meshy multi-image-to-3D (front, back, left, right).
// With front + back only, Meshy still guesses the sides of the head and body (a mask wrapped around the head,
// armour sheets between layers); the two profiles remove the guess. #4998 only came out clean with all four.

function buildSidePrompt(generationInput = {}, side = 'left', hasBack = false) {
  const colony = generationInput.colony || 'Rebel Ant';
  const S = side === 'right' ? 'RIGHT' : 'LEFT';
  return `
Image 1 is the FRONT view of a stylised Rebel Ant game character in a neutral A-pose.${hasBack ? ' Image 2 is the same character seen from BEHIND.' : ''}
Draw the SAME character turned 90 degrees so we see the character's ${S} side in exact profile: an orthographic side view for a 3D modelling turnaround.

Match Image 1 exactly:
- Same A-pose seen from the side (the ${S.toLowerCase()} arm hangs slightly away from the body), same height, same scale, same feet position on the canvas, head-to-feet in frame.
- Same outfit, colours, materials, armour, emblems, art style and line-work, same plain light-grey background, same soft even lighting.
- Only what is really on the side of this character: the profile of the head and antennae, the side of the chest plate, shoulder plate, sleeve, belt, hip plates, legs and footwear.
- Colony: ${colony}.

${buildRigFriendlyRules(generationInput, { view: 'side' })}

Output: one single full-body side view. Not a collage, not a turnaround sheet, no text, no extra characters, no cropped limbs, no weapons.
`.trim();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false, error: 'Method not allowed' }); }
  // Phase 0 cost guard (admins unlimited): two side views per 3D build.
  if (!(await enforceRateLimit(req, res, 'img-side', 30, 86400, 'image generations today'))) return;
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ ok: false, error: 'Missing OPENAI_API_KEY' });
    const { generationInput, productionImageUrl, backImageUrl, side = 'left' } = req.body || {};
    if (!['left', 'right'].includes(side)) return res.status(400).json({ ok: false, error: 'side must be left or right' });
    if (typeof productionImageUrl !== 'string' || !/^https:\/\//.test(productionImageUrl)) return res.status(400).json({ ok: false, error: 'Missing production reference image' });
    const images = [await fetchImageAsDataUrl(productionImageUrl)];
    if (typeof backImageUrl === 'string' && /^https:\/\//.test(backImageUrl)) images.push(await fetchImageAsDataUrl(backImageUrl));
    const prompt = buildSidePrompt(generationInput || {}, side, images.length > 1);
    const { imageBase64, imageModel, attempts } = await forgeImageEdit({ apiKey, prompt, images, size: '1024x1536' });
    return res.status(200).json({
      ok: true, mode: 'side_reference', side, imageModel, imageModelAttempts: attempts,
      sideImage: { mimeType: 'image/png', base64: imageBase64, dataUrl: `data:image/png;base64,${imageBase64}` }
    });
  } catch (err) {
    console.error('forge-generate-side-reference error:', err);
    return res.status(500).json({ ok: false, error: 'Could not generate side reference', detail: err && err.message ? err.message : 'Unknown error' });
  }
}
