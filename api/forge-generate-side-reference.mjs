import { requireForgeStep } from './_wallet.mjs';
import { enforceRateLimit } from './_guard.mjs';
import { forgeImageEdit, fetchImageAsDataUrl, forgeVisionAsk } from './_forge-image.mjs';
import { buildRigFriendlyRules } from './_forge-rig-rules.mjs';

// Side views of a Forge production reference, for 4-view Meshy multi-image-to-3D (front, back, left, right).
// With front + back only, Meshy still guesses the sides of the head and body (a mask wrapped around the head,
// armour sheets between layers); the two profiles remove the guess. #4998 only came out clean with all four.

function buildSidePrompt(generationInput = {}, side = 'left', hasBack = false) {
  const colony = generationInput.colony || 'Rebel Ant';
  const S = side === 'right' ? 'RIGHT' : 'LEFT';
  // v7 (9/28): "the character's LEFT/RIGHT side" alone was ambiguous: the image model drew both profiles facing the
  // left edge (#1555, #469), so Meshy got two left views. Name the facing direction on the canvas as well.
  const FACE = side === 'right' ? 'RIGHT' : 'LEFT';
  // v7b: one-sided details came out mirrored (#1555's patch, #469's red eye): the model read "the character's left" as the
  // viewer's left. Say which HALF OF IMAGE 1 is nearest to us instead.
  const HALF = side === 'right' ? 'LEFT' : 'RIGHT';
  const OTHER = side === 'right' ? 'RIGHT' : 'LEFT';
  return `
Image 1 is the FRONT view of a stylised Rebel Ant game character in a neutral A-pose.${hasBack ? ' Image 2 is the same character seen from BEHIND.' : ''}
Draw the SAME character turned 90 degrees so we see the character's ${S} side in exact profile: an orthographic side view for a 3D modelling turnaround.
FACING DIRECTION (critical): the character faces the ${FACE} EDGE of the image. The face, chest and toes point to the ${FACE.toLowerCase()} side of the canvas; the back of the head and the heels point the other way.
WHICH SIDE IS NEAREST (critical): the half of the character that appears on the ${HALF} half of Image 1 is the half nearest to us in this view. Everything that is on the ${HALF} half of Image 1 (for example the eye, eye patch, shoulder plate, arm guard or pouch on the ${HALF} of Image 1) is visible and in front; everything on the ${OTHER} half of Image 1 is hidden behind the head and body. Check the eyes: the eye shown here must be the one on the ${HALF} of Image 1, with the same look (patch or compound eye).

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
  // Phase 2: paid steps only run inside a forge the Rebel's owner started (admins pass)
  { const gi = (req.body || {}).generationInput || {}; if (!(await requireForgeStep(req, res, { collectionKey: gi.collectionKey, tokenId: gi.tokenId, step: 'side' }))) return; }
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ ok: false, error: 'Missing OPENAI_API_KEY' });
    const { generationInput, productionImageUrl, backImageUrl, side = 'left' } = req.body || {};
    if (!['left', 'right'].includes(side)) return res.status(400).json({ ok: false, error: 'side must be left or right' });
    if (typeof productionImageUrl !== 'string' || !/^https:\/\//.test(productionImageUrl)) return res.status(400).json({ ok: false, error: 'Missing production reference image' });
    const images = [await fetchImageAsDataUrl(productionImageUrl)];
    if (typeof backImageUrl === 'string' && /^https:\/\//.test(backImageUrl)) images.push(await fetchImageAsDataUrl(backImageUrl));
    const prompt = buildSidePrompt(generationInput || {}, side, images.length > 1);
    // Check the facing direction and redraw once if it is wrong. A wrong profile is worse than none for the 3D step,
    // so after two misses the view is returned with wrongSide:true and the Forge leaves it out.
    let out = null, facing = null, tries = 0;
    for (; tries < 2; tries++) {
      out = await forgeImageEdit({ apiKey, prompt, images, size: '1024x1536' });
      try {
        const a = await forgeVisionAsk({ apiKey, images: [`data:image/png;base64,${out.imageBase64}`],
          prompt: 'This is a side (profile) view of a cartoon character. Which edge of the image does the character face (where the face, chest and toes point)? Answer with exactly one word: LEFT or RIGHT.' });
        facing = /right/i.test(a) && !/left/i.test(a) ? 'right' : /left/i.test(a) && !/right/i.test(a) ? 'left' : null;
      } catch (e) { console.warn('side facing check failed', e.message); facing = null; }
      if (facing === null || facing === side) break;
      console.warn(`side ${side}: drawn facing ${facing}, redrawing`);
    }
    const wrongSide = facing !== null && facing !== side;
    const { imageBase64, imageModel, attempts } = out;
    return res.status(200).json({
      ok: true, mode: 'side_reference', side, facing, wrongSide, tries: tries + (wrongSide ? 0 : 1), imageModel, imageModelAttempts: attempts,
      sideImage: { mimeType: 'image/png', base64: imageBase64, dataUrl: `data:image/png;base64,${imageBase64}` }
    });
  } catch (err) {
    console.error('forge-generate-side-reference error:', err);
    return res.status(500).json({ ok: false, error: 'Could not generate side reference', detail: err && err.message ? err.message : 'Unknown error' });
  }
}
