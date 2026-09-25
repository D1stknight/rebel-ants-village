// Shared OpenAI image-edit helper for Forge (not a route: files starting with "_" are ignored by Vercel).
// Uses the Responses API image_generation tool and pins the image model to GPT Image 2.5.
// Tries the best model first, then falls back so a model/param rejection never breaks Forge.

export const FORGE_RESPONSES_MODEL = process.env.FORGE_RESPONSES_MODEL || 'gpt-5.5';

const PRIMARY_IMAGE_MODEL = process.env.FORGE_IMAGE_MODEL || 'gpt-image-2.5-sunburst';

export const FORGE_IMAGE_MODEL_CHAIN = [...new Set([
  PRIMARY_IMAGE_MODEL,
  'gpt-image-2.5-flare',
  'gpt-image-2'
])];

const REPO_RAW = 'https://raw.githubusercontent.com/D1stknight/rebel-ants-village/dev';

export const FORGE_REFERENCE_URLS = {
  // Outfit / lower-body design references (BODY-ONLY)
  body: {
    armored: `${REPO_RAW}/assets/forge-references/body/navy-wave-kimono.png`,
    gi: `${REPO_RAW}/assets/forge-references/body/orange-shinobi-layered.png`,
    tactical: `${REPO_RAW}/assets/forge-references/body/pale-pink-tactical-kimono.png`,
    robe: `${REPO_RAW}/assets/forge-references/body/red-kimono-clean.png`
  },
  // Grey clay render of the main playable character: PROPORTIONS ONLY
  proportions: `${REPO_RAW}/assets/forge-references/proportions-master-clay.png`
};

// Phase 0 SSRF guard: public https hosts only (no localhost / IP literals / internal names).
function assertPublicImageUrl(imageUrl) {
  let u;
  try { u = new URL(imageUrl); } catch (e) { throw new Error('Invalid image URL'); }
  const h = u.hostname.toLowerCase();
  if (u.protocol !== 'https:' || !h.includes('.') || h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') ||
      /^[0-9.]+$/.test(h) || h.includes(':') || h.startsWith('[')) {
    throw new Error('Image URL must be a public https address');
  }
}

export async function fetchImageAsDataUrl(imageUrl) {
  assertPublicImageUrl(imageUrl);
  const response = await fetch(imageUrl, {
    headers: { Accept: 'image/png,image/jpeg,image/webp,image/gif' }
  });

  if (!response.ok) {
    throw new Error('Could not fetch image. Status: ' + response.status + ' (' + imageUrl + ')');
  }

  const contentType = (response.headers.get('content-type') || '').split(';')[0].trim();

  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(contentType)) {
    throw new Error('Unsupported image type: ' + (contentType || 'unknown'));
  }

  const arrayBuffer = await response.arrayBuffer();
  return `data:${contentType};base64,${Buffer.from(arrayBuffer).toString('base64')}`;
}

function buildAttempts() {
  const attempts = [];
  for (const model of FORGE_IMAGE_MODEL_CHAIN) {
    attempts.push({ model, quality: 'high', input_fidelity: 'high' });
    attempts.push({ model, quality: 'high' });
  }
  attempts.push({}); // last resort: previous behaviour (tool picks its default model)
  return attempts;
}

// images: array of data URLs, in the order the prompt refers to them (Image 1, Image 2, ...)
export async function forgeImageEdit({ apiKey, prompt, images, size = '1024x1536' }) {
  const tried = [];

  for (const extra of buildAttempts()) {
    const tool = { type: 'image_generation', action: 'edit', size, ...extra };

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: FORGE_RESPONSES_MODEL,
        input: [
          {
            role: 'user',
            content: [
              { type: 'input_text', text: prompt },
              ...images.map(imageUrl => ({ type: 'input_image', image_url: imageUrl }))
            ]
          }
        ],
        tools: [tool]
      })
    });

    let data = null;
    try { data = await response.json(); } catch (e) { data = null; }

    const label = extra.model ? `${extra.model}${extra.input_fidelity ? '+fidelity' : ''}` : 'default';

    if (!response.ok) {
      const message = data?.error?.message || ('status ' + response.status);
      tried.push(`${label}: ${message}`);
      // 4xx = this model/param combo was rejected -> try the next one. 5xx/429 = real failure.
      if (response.status >= 400 && response.status < 500 && response.status !== 429) continue;
      throw new Error(`OpenAI image edit failed (${label}): ${message}`);
    }

    const call = (data?.output || []).find(item => item.type === 'image_generation_call' && item.result);
    if (!call) {
      // The request was accepted but no image came back (refusal or text-only reply). Don't burn more calls.
      throw new Error(`OpenAI returned no image (${label})` + (tried.length ? ' after: ' + tried.join(' | ') : ''));
    }

    return {
      imageBase64: call.result,
      imageModel: extra.model || 'responses-default',
      revisedPrompt: call.revised_prompt || null,
      attempts: tried
    };
  }

  throw new Error('All image model attempts failed: ' + tried.join(' | '));
}
