import { getToken, isTokenId, redis as nftRedis, ipfsToHttps } from './_nft.mjs';

// Forge v2 sends the NFT art as our own route (/api/nft-image?c=..&t=..). Resolve it server-side to the Blob copy that route
// cached (or the token's source image), so we never fetch our own (possibly password-protected) deployment.
export async function resolveForgeSourceImage(src) {
  const s = String(src || '');
  const m = /^(?:https?:\/\/[^/]+)?\/api\/nft-image\?(.*)$/.exec(s);
  if (!m) return s;
  const q = new URLSearchParams(m[1]);
  const c = String(q.get('c') || 'battle_for_colony').replace(/[^a-z0-9_]/gi, '');
  const t = String(q.get('t') || '');
  if (!isTokenId(t)) throw new Error('Invalid NFT image token');
  for (const size of ['full', 'thumb']) {
    try { const [hit] = await nftRedis([['GET', `nft:img:v1:${c}:${t}:${size}`]]); if (hit?.result) return hit.result; } catch (e) {}
  }
  const tok = await getToken(c, t);
  const first = (tok.sourceImages || []).map(ipfsToHttps).find(Boolean);
  if (!first) throw new Error('No source image for this NFT');
  return first;
}
