// Latest version of a rig GLB (Sept 29): upgrades made after a rig went live (rigger 2.12 head-cloth chains) are stored
// as new Blob files, since Blob URLs are cached for a month. Saved characters keep the URL they were made with; the
// village and the Forge ask here first. GET ?url=<rig url> -> { url } (the same url when there is no upgrade).
import { redis } from './_forge-rig.mjs';

const BLOB = /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\//;
export default async function handler(req, res) {
  const url = String(req.query?.url || '');
  if (!BLOB.test(url)) return res.status(400).json({ ok: false, error: 'Not a rig URL' });
  try {
    let cur = url;
    for (let i = 0; i < 4; i++) {
      const [r] = await redis([['GET', `forge:rig-latest:v1:${cur}`]]);
      if (!r?.result || !BLOB.test(r.result) || r.result === cur) break;
      cur = r.result;
    }
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60');
    return res.status(200).json({ ok: true, url: cur, upgraded: cur !== url });
  } catch (e) {
    return res.status(200).json({ ok: true, url, upgraded: false });
  }
}
