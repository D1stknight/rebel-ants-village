import { isAdminRequest } from './_admin-auth.mjs';
import { forgeImageEdit, fetchImageAsDataUrl } from './_forge-image.mjs';

// Part references for part-by-part 3D generation (admin only, spends image credits).
// Generators fuse clothing and armour into one thin shell, which shows see-through gaps wherever layers overlap.
// Generating the base body and the armour as separate models avoids that: this endpoint redraws a production
// reference (front or back) as ONE part, with the same pose, framing and scale so the parts line up again in Blender.
//   part: 'body'  -> the character with every hard armour piece removed (cloth outfit stays)
//         'armor' -> only the hard armour pieces, floating where they are worn, nothing else
//         'custom'-> free-text `instructions`

const PARTS = {
  body: `Remove EVERY hard armour piece: shoulder plates (and any dragon or animal ornaments on them), chest and back plates,
harness and straps, arm guards and bracers, skirt plates / tassets, shin guards and any metal or lacquered plates.
Keep the soft outfit underneath exactly as it would look without the armour: the kimono / robe, the sash and belt,
trousers, arm wraps, gloves, socks and footwear. Where armour covered the cloth, continue the cloth naturally.
The head: a plain bare ant head in the base skin colour, no mask, no helmet, same antennae.`,
  armor: `Draw ONLY the hard armour pieces this character wears, exactly as they sit on the body, as if worn by an INVISIBLE body:
shoulder plates with their ornaments, chest and back plates, harness straps, arm guards / bracers, skirt plates / tassets,
shin guards. Every piece keeps its exact shape, size, colour and position from Image 1.
Do NOT draw the character, the head, antennae, skin, hands, the kimono, sash, trousers, footwear or any cloth.
Pieces that would be hidden behind the invisible body are not drawn. Plain light-grey background everywhere else.`
};

function buildPrompt({ view, part, instructions }) {
  const what = part === 'custom' ? String(instructions || '').trim() : PARTS[part];
  return `
Image 1 is the ${view === 'back' ? 'BACK view' : 'FRONT view'} production reference of a stylised Rebel Ant game character in a neutral A-pose, for a 3D modelling pipeline that builds the character from separate parts.
Redraw Image 1 as ONE part reference. Keep the SAME pose, SAME framing, SAME scale and position on the canvas, SAME plain light-grey background, SAME soft even lighting, SAME colours, materials and art style, so the part lines up exactly with Image 1.

${what}
${part !== 'custom' && instructions ? '\n' + String(instructions).trim() : ''}

Output: one single ${view === 'back' ? 'back' : 'front'} view. Not a collage, no text, no extra characters, no weapons.
`.trim();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false, error: 'Method not allowed' }); }
  if (!isAdminRequest(req)) return res.status(401).json({ ok: false, error: 'Admin authentication required' });
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ ok: false, error: 'Missing OPENAI_API_KEY' });
    const { imageUrl, view = 'front', part = 'body', instructions = '' } = req.body || {};
    if (!imageUrl || !/^https:\/\//.test(imageUrl)) return res.status(400).json({ ok: false, error: 'Missing imageUrl' });
    if (!['body', 'armor', 'custom'].includes(part)) return res.status(400).json({ ok: false, error: 'part must be body, armor or custom' });
    if (part === 'custom' && !String(instructions).trim()) return res.status(400).json({ ok: false, error: 'custom part needs instructions' });
    const prompt = buildPrompt({ view, part, instructions });
    const { imageBase64, imageModel, attempts } = await forgeImageEdit({ apiKey, prompt, images: [await fetchImageAsDataUrl(imageUrl)], size: '1024x1536' });
    return res.status(200).json({
      ok: true, view, part, imageModel, imageModelAttempts: attempts, promptUsed: prompt,
      image: { mimeType: 'image/png', base64: imageBase64, dataUrl: `data:image/png;base64,${imageBase64}` }
    });
  } catch (err) {
    console.error('forge-part-reference error:', err);
    return res.status(500).json({ ok: false, error: 'Could not make part reference', detail: err && err.message ? err.message : 'Unknown error' });
  }
}
