import { isAdminRequest } from './_admin-auth.mjs';

const REPO = 'D1stknight/rebel-ants-village';
const BRANCH = 'dev';
const FILE_PATH = 'assets/forge-collections.json';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  if (!isAdminRequest(req)) {
    return res.status(401).json({ ok: false, error: 'Admin authentication required' });
  }

  try {
    const { config } = req.body || {};

    if (!config || typeof config !== 'object') {
      return res.status(400).json({ ok: false, error: 'Missing config' });
    }

    if (!config.version || !Array.isArray(config.universalSlots) || !config.collections) {
      return res.status(400).json({ ok: false, error: 'Invalid Forge collections config shape' });
    }

    const token = process.env.GITHUB_TOKEN;

    if (!token) {
      throw new Error('Missing GITHUB_TOKEN environment variable');
    }

    let sha;
    const readResponse = await fetch(
      `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json'
        }
      }
    );

    if (readResponse.ok) {
      const currentFile = await readResponse.json();
      sha = currentFile.sha;
    } else if (readResponse.status !== 404) {
      throw new Error('Could not read current Forge collections file. Status: ' + readResponse.status);
    }

    const json = JSON.stringify(config, null, 2) + '\n';
    const content = Buffer.from(json, 'utf8').toString('base64');

    const body = {
      message: 'save: forge collections config',
      content,
      branch: BRANCH
    };

    if (sha) body.sha = sha;

    const writeResponse = await fetch(
      `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      }
    );

    if (!writeResponse.ok) {
      throw new Error('GitHub save failed. Status: ' + writeResponse.status);
    }

    return res.status(200).json({
      ok: true,
      saved: true
    });
  } catch (err) {
    console.error('forge-save-collections error:', err);

    return res.status(500).json({
      ok: false,
      error: 'Could not save Forge collections config'
    });
  }
}
