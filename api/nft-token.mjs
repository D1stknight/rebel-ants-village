// GET /api/nft-token?c=battle_for_colony&t=4998
// One token's name, traits and image routes (Alchemy first, OpenSea fallback). Cached a week.
import { enforceRateLimit } from './_guard.mjs';
import { getToken, isTokenId } from './_nft.mjs';
import { getCollection } from './_collections.mjs';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  if (!(await enforceRateLimit(req, res, 'nft-token', 600, 3600, 'token lookups'))) return;
  const c = String(req.query?.c || req.query?.collection || 'battle_for_colony');
  const t = String(req.query?.t || req.query?.tokenId || '');
  if (!getCollection(c)) return res.status(400).json({ ok: false, error: 'Unknown collection' });
  if (!isTokenId(t)) return res.status(400).json({ ok: false, error: 'Invalid tokenId' });
  try {
    const { sourceImages, ...token } = await getToken(c, t);
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json({ ok: true, ...token });
  } catch (e) {
    console.warn('nft-token failed:', e);
    return res.status(502).json({ ok: false, error: 'NFT lookup unavailable, try again shortly' });
  }
}
