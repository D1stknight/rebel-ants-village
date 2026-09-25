import { rateLimit } from './_guard.mjs';
import {
  isValidAdminPassword,
  createAdminSessionToken,
  buildAdminSessionCookie
} from './_admin-auth.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  // Phase 0: throttle password guessing (8 tries per 15 minutes per IP).
  const rl = await rateLimit(req, 'admin-login', 8, 900);
  if (!rl.ok) return res.status(429).json({ ok: false, error: 'Too many attempts. Try again in 15 minutes.' });

  try {
    const { password } = req.body || {};

    if (!password || !isValidAdminPassword(password)) {
      return res.status(401).json({ ok: false, error: 'Invalid password' });
    }

    const token = createAdminSessionToken();

    res.setHeader('Set-Cookie', buildAdminSessionCookie(token));

    return res.status(200).json({
      ok: true,
      authenticated: true
    });
  } catch (err) {
    console.error('admin-login error:', err);
    return res.status(500).json({
      ok: false,
      error: 'Admin login unavailable'
    });
  }
}
