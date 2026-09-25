// Server-side OpenSea proxy (Phase 0): the lobby used to ship the OpenSea API key in page code.
//   GET ?kind=wallet&address=0x...&next=...   Rebel Ants owned by a wallet (one page of 50)
//   GET ?kind=metadata&tokenId=123            token metadata + traits
import { enforceRateLimit } from './_guard.mjs';

const CONTRACT = '0x96C1469c1C76E3Bb0e37c23a830d0Eea6BCf9221';
const COLLECTION = 'rebel-ants-battle-for-the-colony';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  if (!(await enforceRateLimit(req, res, 'opensea', 300, 3600, 'lookups'))) return;
  const apiKey = process.env.OPENSEA_API_KEY;
  if (!apiKey) return res.status(500).json({ ok: false, error: 'Missing OPENSEA_API_KEY' });
  const q = req.query || {};
  let url;
  if (q.kind === 'wallet') {
    const address = String(q.address || '');
    const next = String(q.next || '');
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return res.status(400).json({ ok: false, error: 'Invalid wallet address' });
    if (next && !/^[A-Za-z0-9_=+/-]{1,512}$/.test(next)) return res.status(400).json({ ok: false, error: 'Invalid cursor' });
    url = `https://api.opensea.io/api/v2/chain/ethereum/account/${address}/nfts?collection=${COLLECTION}&limit=50${next ? '&next=' + encodeURIComponent(next) : ''}`;
  } else if (q.kind === 'metadata') {
    const tokenId = String(q.tokenId || '');
    if (!/^[0-9]{1,8}$/.test(tokenId)) return res.status(400).json({ ok: false, error: 'Invalid tokenId' });
    url = `https://api.opensea.io/api/v2/metadata/ethereum/${CONTRACT}/${tokenId}`;
  } else {
    return res.status(400).json({ ok: false, error: 'Unknown kind' });
  }
  try {
    const r = await fetch(url, { headers: { accept: 'application/json', 'x-api-key': apiKey } });
    const data = await r.json().catch(() => ({}));
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(r.status).json(data);
  } catch (e) {
    return res.status(502).json({ ok: false, error: 'OpenSea unavailable' });
  }
}
