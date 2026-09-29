// Forge allowance (Phase 2).
//   GET  ?tokenId=N[&collectionKey=]  -> { wallet, owner (live ownerOf), isOwner, used, limit, left, open }
//   POST {tokenId, collectionKey?}    -> owner only: uses one of the Rebel's forges and opens a 24 h forge window
//   POST {action:'reset', tokenId}    -> admin: gives the Rebel all of its forges back
import { isAdminRequest } from './_admin-auth.mjs';
import { enforceRateLimit } from './_guard.mjs';
import { walletOf, ownerOf, forgeStatus, openForge, resetForges, FORGE_LIMIT } from './_wallet.mjs';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const body = typeof req.body === 'string' ? (() => { try { return JSON.parse(req.body); } catch (e) { return {}; } })() : (req.body || {});
  const tokenId = String(req.query?.tokenId || body.tokenId || '');
  const col = String(req.query?.collectionKey || body.collectionKey || 'battle_for_colony');
  if (!/^\d{1,78}$/.test(tokenId) || !/^[a-z0-9_]{1,60}$/.test(col)) return res.status(400).json({ ok: false, error: 'Missing Rebel token' });
  const admin = isAdminRequest(req);
  const wallet = walletOf(req);
  try {
    if (req.method === 'GET') {
      const owner = await ownerOf(col, tokenId);
      const st = await forgeStatus(col, tokenId, owner);
      return res.status(200).json({ ok: true, wallet, owner, isOwner: !!(wallet && owner && wallet === owner), admin, ...st, open: st.open ? { mine: !!wallet && st.open.wallet === wallet, startedAt: st.open.startedAt, n: st.open.n } : null });
    }
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
    if (body.action === 'reset') {
      if (!admin) return res.status(401).json({ ok: false, error: 'Admin only' });
      await resetForges(col, tokenId, await ownerOf(col, tokenId));
      return res.status(200).json({ ok: true, used: 0, limit: FORGE_LIMIT, left: FORGE_LIMIT });
    }
    if (!(await enforceRateLimit(req, res, 'forge-start', 10, 86400, 'forge starts today'))) return;
    if (admin) return res.status(200).json({ ok: true, admin: true, used: 0, limit: FORGE_LIMIT, left: FORGE_LIMIT });   // admin forges never use a Rebel's allowance
    if (!wallet) return res.status(401).json({ ok: false, error: 'Sign in with your wallet to forge', code: 'wallet_required' });
    const owner = await ownerOf(col, tokenId);
    if (!owner) return res.status(502).json({ ok: false, error: 'Could not read the owner of this Rebel, try again', code: 'owner_unknown' });
    if (owner !== wallet) return res.status(403).json({ ok: false, error: 'Only the wallet that holds this Rebel can forge it', code: 'not_owner' });
    const r = await openForge(col, tokenId, wallet);
    if (!r.ok) {
      const error = r.reason === 'daily' ? 'This wallet has started enough forges for today. Come back tomorrow.'
        : r.reason === 'lifetime' ? 'This Rebel has been forged the most times it can be.'
        : `You have used all ${r.limit} of your forges for this Rebel`;
      return res.status(429).json({ ok: false, error, code: r.reason === 'daily' ? 'wallet_daily' : 'no_forges_left', used: r.used, limit: r.limit, left: r.left });
    }
    return res.status(200).json({ ok: true, used: r.used, limit: r.limit, left: r.left });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || 'Forge start failed' });
  }
}
