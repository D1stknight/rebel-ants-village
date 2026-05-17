import { buildClearAdminSessionCookie } from './_admin-auth.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    res.setHeader('Set-Cookie', buildClearAdminSessionCookie());

    return res.status(200).json({
      ok: true,
      authenticated: false
    });
  } catch (err) {
    console.error('admin-logout error:', err);
    return res.status(500).json({
      ok: false,
      error: 'Admin logout unavailable'
    });
  }
}
