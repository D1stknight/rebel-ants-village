import { isAdminRequest } from './_admin-auth.mjs';
import { forgeImageEdit, fetchImageAsDataUrl } from './_forge-image.mjs';
import { buildRigFriendlyRules } from './_forge-rig-rules.mjs';
import { getToken } from './_nft.mjs';

// Targeted touch-up of an existing Forge production (front) or back reference.
// Keeps the character, outfit, pose and framing identical and only applies the corrections:
// the rig-friendly rules (hands in relaxed fists, bare head in base skin colour, face masks as a hockey-style shell)
// plus optional free-text notes. The original NFT can be passed as a head/face reference.
// Admin only (it spends image credits).

function buildFixPrompt({ view, notes, generationInput, hasNft }) {
  return `
Image 1 is the current ${view === 'back' ? 'BACK view' : 'FRONT view'} production reference of a stylised Rebel Ant game character in a neutral A-pose, for a 3D modelling pipeline.
${hasNft ? "Image 2 is the ORIGINAL NFT artwork of this character. Use it only as the reference for the head, face covering, eyes, antennae and skin colours. Do not copy its background, framing or clothing crop." : ''}

Redraw Image 1 with the SAME character, SAME outfit, SAME colours and materials, SAME A-pose, SAME framing and scale, SAME plain light-grey background and SAME art style.
Change ONLY what the corrections below require.

Corrections:
${buildRigFriendlyRules(generationInput || {}, { view })}
${notes ? '- ' + String(notes).trim().split('\n').join('\n- ') : ''}

Output: one single full-body ${view === 'back' ? 'back' : 'front'} view. Not a collage, no text, no extra characters, no cropped limbs, no weapons.
`.trim();
}

// NPC Forge "Redraw renders" (Oct 20, human NPCs: the Saints): the same person and outfit, redrawn so the sculpt and the
// rig come out human: natural skin, real eyes, clothes that fit, arms clear of the body. The back view takes the redrawn
// front as Image 2 so both match.
function buildMakeoverPrompt({ view, notes, hasFront }) {
  const back = view === 'back';
  return `
Image 1 is the current ${back ? 'BACK view' : 'FRONT view'} render of a game character (a realistic 3D-rendered human from Los Angeles) standing in an A-pose, for a 3D modelling pipeline.
${hasFront ? 'Image 2 is the corrected FRONT view of the same character. Match it exactly: the same skin tone, clothes, fit, pose, proportions and render style, seen from directly behind.' : ''}

Redraw Image 1 as the SAME person in the SAME outfit: the same ${back ? 'hair or headwear, build' : 'face, hair or headwear, facial hair, glasses, jewellery, tattoos, build'}, the same garments with the same colours, patterns, logos and printed text, the same shoes. Same realistic 3D-render style, same plain light-grey background, full body from head to feet, same framing and scale.

Change ONLY these:
- Skin: natural, healthy human skin with a believable skin tone and natural shading on the ${back ? 'neck, arms and hands' : 'face, neck, arms and hands'}. Never grey, red, ash-white or any colour a real person's skin can't be.
${back ? '' : '- Eyes: real human eyes with irises and pupils, looking straight ahead; never blank, white or glowing. Glasses or sunglasses the character wears stay.\n'}- Clothes fit the body: shoulder seams on the shoulders, sleeves ending at the wrists, tops sized to the torso with no ballooning sleeves or extra bulk, trousers falling straight to the shoes.
- Pose: a clean A-pose. Both arms are held about 40 degrees out from the body with the elbows almost straight, and the plain background shows between each arm and the torso all the way from the armpit down to the hand. Hands open and relaxed, fingers together, palms facing the thighs, touching nothing.
- Feet point straight forward, hip-width apart.
${notes ? '- ' + String(notes).trim().split('\n').join('\n- ') + '\n' : ''}
Output: one single full-body ${back ? 'back' : 'front'} view. Not a collage, no added text, no extra characters, no cropped limbs, nothing in the hands.
`.trim();
}

async function lookupNftImageUrl(tokenId) {
  // Alchemy first (OpenSea fallback) via the shared NFT layer.
  const t = await getToken('battle_for_colony', String(tokenId));
  return (t.sourceImages || [])[0] || null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  if (!isAdminRequest(req)) return res.status(401).json({ ok: false, error: 'Admin authentication required' });
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ ok: false, error: 'Missing OPENAI_API_KEY' });
    const { imageUrl, view = 'front', notes = '', generationInput = {}, nftTokenId, makeover, frontImageUrl } = req.body || {};
    let { nftImageUrl } = req.body || {};
    if (!imageUrl || !/^https:\/\//.test(imageUrl)) return res.status(400).json({ ok: false, error: 'Missing imageUrl' });
    if (makeover) nftImageUrl = null; else if (!nftImageUrl && nftTokenId) nftImageUrl = await lookupNftImageUrl(nftTokenId);
    const images = [await fetchImageAsDataUrl(imageUrl)];
    const second = makeover ? (view === 'back' ? frontImageUrl : null) : nftImageUrl;
    if (second && /^https:\/\//.test(second)) images.push(await fetchImageAsDataUrl(second));
    const prompt = makeover ? buildMakeoverPrompt({ view, notes, hasFront: images.length > 1 }) : buildFixPrompt({ view, notes, generationInput, hasNft: images.length > 1 });
    const { imageBase64, imageModel, attempts } = await forgeImageEdit({ apiKey, prompt, images, size: '1024x1536' });
    return res.status(200).json({
      ok: true, view, imageModel, nftImageUsed: Boolean(nftImageUrl), imageModelAttempts: attempts, promptUsed: prompt,
      image: { mimeType: 'image/png', base64: imageBase64, dataUrl: `data:image/png;base64,${imageBase64}` }
    });
  } catch (err) {
    console.error('forge-fix-reference error:', err);
    return res.status(500).json({ ok: false, error: 'Could not fix reference', detail: err && err.message ? err.message : 'Unknown error' });
  }
}
