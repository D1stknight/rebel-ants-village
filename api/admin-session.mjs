import { isAdminRequest } from './_admin-auth.mjs';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const authenticated = isAdminRequest(req);

    return res.status(200).json({
      ok: true,
      authenticated
    });
  } catch (err) {
    console.error('admin-session error:', err);
    return res.status(500).json({
      ok: false,
      authenticated: false,
      error: 'Admin session unavailable'
    });
  }
}
