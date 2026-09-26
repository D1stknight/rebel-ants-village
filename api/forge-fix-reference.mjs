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
    const { imageUrl, view = 'front', notes = '', generationInput = {}, nftTokenId } = req.body || {};
    let { nftImageUrl } = req.body || {};
    if (!nftImageUrl && nftTokenId) nftImageUrl = await lookupNftImageUrl(nftTokenId);
    if (!imageUrl || !/^https:\/\//.test(imageUrl)) return res.status(400).json({ ok: false, error: 'Missing imageUrl' });
    const images = [await fetchImageAsDataUrl(imageUrl)];
    if (nftImageUrl && /^https:\/\//.test(nftImageUrl)) images.push(await fetchImageAsDataUrl(nftImageUrl));
    const prompt = buildFixPrompt({ view, notes, generationInput, hasNft: images.length > 1 });
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
