// Forge allowance (Phase 2) and price (Oct 20: a forge costs FORGE_PRICE Rebel Points, api/_forge-charge.mjs).
//   GET  ?tokenId=N[&collectionKey=][&quote=1] -> { wallet, owner (live ownerOf), isOwner, used, limit, left, open, price,
//                                        econ: { configured, signedIn }, lastCharge, chargeId (quote=1: holder + signed in) }
//   POST {tokenId, collectionKey?, chargeId} -> holder only (owner, or its delegate.xyz delegate), signed in to the Rebel
//                                        Economy: takes the price, then uses one of the Rebel's forges (counted on the
//                                        owner) and opens a 24 h forge window; a retried chargeId never charges twice
//   POST {action:'reset', tokenId}    -> admin: gives the Rebel all of its forges back
// Admin forges are free and never use a Rebel's allowance. FORGE_PRICE_POINTS=0 = free forges (the old flow).
import { isAdminRequest } from './_admin-auth.mjs';
import { enforceRateLimit } from './_guard.mjs';
import { walletOf, ownerOf, holderOf, forgeStatus, openForge, resetForges, FORGE_LIMIT } from './_wallet.mjs';
import { econReady, econSessionOf } from './_econ.mjs';
import { FORGE_PRICE, newQuote, lastCharge, startPaidForge, settleDue } from './_forge-charge.mjs';

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
      const h = await holderOf(col, tokenId, wallet, { fresh: true }); const owner = h.owner;
      // a paid forge whose window ended without a character gives its points (and the forge) back here too
      if (FORGE_PRICE > 0) { try { await settleDue({ col, tok: tokenId }); } catch (e) { console.warn('[forge-start] settle', e.message); } }
      const st = await forgeStatus(col, tokenId, owner);
      const s = econSessionOf(req), pay = { price: FORGE_PRICE, econ: { configured: econReady(), signedIn: !!s } };
      if (FORGE_PRICE > 0 && wallet) pay.lastCharge = await lastCharge(col, tokenId, wallet).catch(() => null);
      if (FORGE_PRICE > 0 && req.query?.quote === '1' && h.holder && s && econReady() && !admin) Object.assign(pay, await newQuote({ wallet, u: s.u, col, tok: tokenId }));
      return res.status(200).json({ ok: true, wallet, owner, isOwner: h.holder, delegate: h.via === 'delegate', admin, ...st, open: st.open ? { mine: !!wallet && st.open.wallet === wallet, startedAt: st.open.startedAt, n: st.open.n } : null, ...pay });
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
    const s = FORGE_PRICE > 0 ? econSessionOf(req) : null;
    if (FORGE_PRICE > 0 && !econReady()) return res.status(503).json({ ok: false, error: 'Forging opens once the Rebel Economy link is set up', code: 'econ_unavailable', price: FORGE_PRICE });
    if (FORGE_PRICE > 0 && !s) return res.status(401).json({ ok: false, error: `A forge takes ${FORGE_PRICE.toLocaleString('en-US')} Rebel Points: sign in to your Rebel Ants account (Discord, or a name and PIN) first`, code: 'econ_required', price: FORGE_PRICE });
    const h = await holderOf(col, tokenId, wallet, { fresh: true }); const owner = h.owner;
    if (!owner) return res.status(502).json({ ok: false, error: 'Could not read the owner of this Rebel, try again', code: 'owner_unknown' });
    if (!h.holder) return res.status(403).json({ ok: false, error: 'Only the wallet that holds this Rebel (or its delegate.xyz delegate) can forge it', code: 'not_owner' });
    if (FORGE_PRICE > 0) {
      const p = await startPaidForge({ chargeId: body.chargeId, wallet, owner, u: s.u, col, tok: tokenId });
      return res.status(p.status).json(p.body);
    }
    const r = await openForge(col, tokenId, wallet, owner);
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
