import { isAdminRequest, passwordSignInAllowed, rebelConsoleUrl } from './_admin-auth.mjs';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const authenticated = isAdminRequest(req);

    // passwordSignIn: whether the lobby's admin gate takes the password here (Oct 29: not on production);
    // consoleUrl: the Rebel Console's door into this Admin Hub (production only: the console opens rebeluniverse.io)
    return res.status(200).json({
      ok: true,
      authenticated,
      passwordSignIn: passwordSignInAllowed(),
      consoleUrl: process.env.VERCEL_ENV === 'production' ? rebelConsoleUrl('/admin/open/universe') : null
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
