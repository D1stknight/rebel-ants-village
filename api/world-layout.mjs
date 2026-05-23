import { isAdminRequest } from './_admin-auth.mjs';

const REPO = 'D1stknight/rebel-ants-village';
const BRANCH = 'dev';
const FILE_PATH = 'assets/world-layout.json';

function getGitHubToken() {
  return process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
}

async function getGitHubErrorMessage(response) {
  const text = await response.text().catch(() => '');

  if (!text) return '';

  try {
    const data = JSON.parse(text);
    return data.message || text;
  } catch {
    return text;
  }
}

async function readWorldLayout(token) {
  const response = await fetch(
    `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json'
      }
    }
  );

  if (!response.ok) {
    const detail = await getGitHubErrorMessage(response);
    throw new Error(
      'Could not read current world layout from GitHub. Status: ' +
      response.status +
      (detail ? '. ' + detail : '')
    );
  }

  const file = await response.json();
  const json = Buffer.from(String(file.content || '').replace(/\n/g, ''), 'base64').toString('utf8');

  return {
    sha: file.sha,
    layout: JSON.parse(json)
  };
}

async function writeWorldLayout(token, layout) {
  let sha;

  try {
    const current = await readWorldLayout(token);
    sha = current.sha;
  } catch (err) {
    if (!String(err?.message || '').includes('Status: 404')) {
      throw err;
    }
  }

  const content = Buffer.from(JSON.stringify(layout, null, 2) + '\n', 'utf8').toString('base64');
  const body = {
    message: 'save: world layout',
    content,
    branch: BRANCH
  };

  if (sha) body.sha = sha;

  let response = await fetch(
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

  if (response.status === 409) {
    const current = await readWorldLayout(token);
    body.sha = current.sha;

    response = await fetch(
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
  }

  if (!response.ok) {
    const detail = await getGitHubErrorMessage(response);
    throw new Error(
      'GitHub layout save failed. Status: ' +
      response.status +
      (detail ? '. ' + detail : '')
    );
  }
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    if (req.method === 'POST' && !isAdminRequest(req)) {
      return res.status(401).json({ ok: false, error: 'Admin authentication required' });
    }

    const token = getGitHubToken();

    if (!token) {
      throw new Error('Missing GITHUB_TOKEN or GH_TOKEN environment variable');
    }

    if (req.method === 'GET') {
      const { layout } = await readWorldLayout(token);
      return res.status(200).json({ ok: true, layout });
    }

    const { layout } = req.body || {};

    if (!Array.isArray(layout)) {
      return res.status(400).json({ ok: false, error: 'Missing world layout array' });
    }

    await writeWorldLayout(token, layout);

    return res.status(200).json({ ok: true, saved: true });
  } catch (err) {
    console.error('world-layout error:', err);

    return res.status(500).json({
      ok: false,
      error: err?.message || 'Could not sync world layout'
    });
  }
}
