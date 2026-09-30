// Sign-in with Ethereum (Phase 2).
//   GET  ?action=nonce    -> { nonce }                 (one-time, 10 min)
//   POST {action:'verify', message, signature}        -> sets the ra_wallet cookie, { address }
//   GET  ?action=session  -> { address | null }
//   POST {action:'logout'}                            -> clears the cookie
import { enforceRateLimit } from './_guard.mjs';
import { newNonce, verifySignIn, walletOf, walletSessionCookie, clearWalletCookie } from './_wallet.mjs';

function hostOf(req) { return String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim(); }

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const body = typeof req.body === 'string' ? (() => { try { return JSON.parse(req.body); } catch (e) { return {}; } })() : (req.body || {});
  const action = String(req.query?.action || body.action || '');
  try {
    if (req.method === 'GET' && action === 'session') return res.status(200).json({ ok: true, address: walletOf(req) });
    if (req.method === 'GET' && action === 'nonce') {
      if (!(await enforceRateLimit(req, res, 'wallet-nonce', 60, 3600, 'sign-in attempts'))) return;
      return res.status(200).json({ ok: true, nonce: await newNonce() });
    }
    if (req.method === 'POST' && action === 'verify') {
      if (!(await enforceRateLimit(req, res, 'wallet-verify', 30, 3600, 'sign-in attempts'))) return;
      const message = String(body.message || '').slice(0, 2000), signature = String(body.signature || '');
      if (!/^0x[0-9a-fA-F]+$/.test(signature) || signature.length > 20000) return res.status(400).json({ ok: false, error: 'Missing signature' });
      const address = await verifySignIn({ message, signature, host: hostOf(req) });
      res.setHeader('Set-Cookie', walletSessionCookie(address));
      return res.status(200).json({ ok: true, address });
    }
    if (req.method === 'POST' && action === 'logout') {
      res.setHeader('Set-Cookie', clearWalletCookie());
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ ok: false, error: 'Unknown action' });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, error: e.message || 'Sign-in failed' });
  }
}
