import { isAdminRequest } from './_admin-auth.mjs';

const REPO = 'D1stknight/rebel-ants-village';
const BRANCH = 'dev';

function getGitHubToken() {
  return process.env.GITHUB_TOKEN || '';
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  if (!isAdminRequest(req)) {
    return res.status(401).json({ ok: false, error: 'Admin authentication required' });
  }

  try {
    const token = getGitHubToken();
    if (!token) throw new Error('Missing GITHUB_TOKEN environment variable');

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, token, repo: REPO, branch: BRANCH });
  } catch (err) {
    console.error('github-upload-token error:', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Could not prepare GitHub upload' });
  }
}
