// GET /api/nft-wallet?address=0x...[&collections=key1,key2][&delegates=1]
// NFTs from our collections held by a wallet (Alchemy first, OpenSea fallback). Cached 2 min.
// delegates=1: also the Rebels in vault wallets that delegated to this wallet on delegate.xyz (tagged `vault`).
// Delegations are per chain (each chain has its own registry): a vault's token counts only when the vault delegated
// to this wallet on that token's chain (Oct 20: ApeChain for Chumpz).
import { enforceRateLimit } from './_guard.mjs';
import { getWalletTokens, isAddress } from './_nft.mjs';
import { getCollection, loadCollections } from './_collections.mjs';
import { incomingDelegations } from './_wallet.mjs';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  if (!(await enforceRateLimit(req, res, 'nft-wallet', 120, 3600, 'wallet lookups'))) return;
  const address = String(req.query?.address || '');
  if (!isAddress(address)) return res.status(400).json({ ok: false, error: 'Invalid wallet address' });
  const keys = String(req.query?.collections || '').split(',').map((s) => s.trim()).filter(Boolean);
  if ((await Promise.all(keys.map((k) => getCollection(k)))).some((c) => !c)) return res.status(400).json({ ok: false, error: 'Unknown collection' });
  try {
    const { tokens, source, cached, partial } = await getWalletTokens(address, keys);
    if (req.query?.delegates === '1') {
      const have = new Set(tokens.map((t) => `${t.chain}:${t.contract.toLowerCase()}:${t.tokenId}`));
      const all = await loadCollections();
      const chains = [...new Set((keys.length ? all.filter((c) => keys.includes(c.key)) : all).map((c) => c.chain))];
      const ins = {};
      await Promise.all(chains.map(async (ch) => { ins[ch] = await incomingDelegations(address, ch).catch(() => []); }));
      const vaults = [...new Set(Object.values(ins).flat().map((d) => d.vault))].slice(0, 5);
      for (const vault of vaults) {
        const vt = await getWalletTokens(vault, keys).catch(() => ({ tokens: [] }));
        for (const t of vt.tokens) {
          const c = t.contract.toLowerCase(), id = `${t.chain}:${c}:${t.tokenId}`;
          const ds = (ins[t.chain] || []).filter((d) => d.vault === vault);
          const ok = ds.some((d) => d.scope === 'all' || (d.scope === 'contract' && d.contract === c) || (d.scope === 'token' && d.contract === c && d.tokenId === String(t.tokenId)));
          if (ok && !have.has(id)) { have.add(id); tokens.push({ ...t, vault }); }
        }
      }
    }
    res.setHeader('Cache-Control', 'private, max-age=30');
    return res.status(200).json({
      ok: true,
      source,
      cached,
      ...(partial ? { partial: true } : {}),
      count: tokens.length,
      tokens: tokens.map(({ sourceImages, ...t }) => t)
    });
  } catch (e) {
    console.warn('nft-wallet failed:', e);
    return res.status(502).json({ ok: false, error: 'NFT lookup unavailable, try again shortly' });
  }
}
