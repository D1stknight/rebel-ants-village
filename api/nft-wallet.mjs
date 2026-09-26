// GET /api/nft-wallet?address=0x...[&collections=key1,key2]
// NFTs from our collections held by a wallet (Alchemy first, OpenSea fallback). Cached 2 min.
import { enforceRateLimit } from './_guard.mjs';
import { getWalletTokens, isAddress } from './_nft.mjs';
import { getCollection } from './_collections.mjs';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  if (!(await enforceRateLimit(req, res, 'nft-wallet', 120, 3600, 'wallet lookups'))) return;
  const address = String(req.query?.address || '');
  if (!isAddress(address)) return res.status(400).json({ ok: false, error: 'Invalid wallet address' });
  const keys = String(req.query?.collections || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (keys.some((k) => !getCollection(k))) return res.status(400).json({ ok: false, error: 'Unknown collection' });
  try {
    const { tokens, source, cached } = await getWalletTokens(address, keys);
    res.setHeader('Cache-Control', 'private, max-age=30');
    return res.status(200).json({
      ok: true,
      source,
      cached,
      count: tokens.length,
      tokens: tokens.map(({ sourceImages, ...t }) => t)
    });
  } catch (e) {
    console.warn('nft-wallet failed:', e);
    return res.status(502).json({ ok: false, error: 'NFT lookup unavailable, try again shortly' });
  }
}
