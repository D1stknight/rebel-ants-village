import { isAdminRequest } from './_admin-auth.mjs';

const REPO = 'D1stknight/rebel-ants-village';
const BRANCH = 'dev';
const INTERIOR_ROOT = 'assets/interiors/custom';
const MAX_BYTES = 40 * 1024 * 1024;
const ALLOWED_KINDS = new Map([
  ['room', new Set(['glb', 'gltf'])],
  ['music', new Set(['mp3'])]
]);

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '100mb'
    }
  }
};

function getGitHubToken() {
  return process.env.GITHUB_TOKEN || '';
}

function getSafeSlug(value, fallback = 'interior') {
  const slug = String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return slug || fallback;
}

function getSafeFileName(fileName, kind) {
  const safe = String(fileName || `${kind}.glb`).replace(/[^a-zA-Z0-9._-]/g, '_');
  return safe || `${kind}.glb`;
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

async function readGitHubFile(token, filePath) {
  const response = await fetch(
    `https://api.github.com/repos/${REPO}/contents/${filePath}?ref=${BRANCH}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json'
      }
    }
  );

  if (response.status === 404) return null;
  if (!response.ok) {
    const detail = await getGitHubErrorMessage(response);
    throw new Error('Could not check interior upload path. Status: ' + response.status + (detail ? '. ' + detail : ''));
  }

  return response.json();
}

async function getAvailablePath(token, basePath) {
  if (!(await readGitHubFile(token, basePath))) return basePath;
  const dot = basePath.lastIndexOf('.');
  const stem = dot >= 0 ? basePath.slice(0, dot) : basePath;
  const ext = dot >= 0 ? basePath.slice(dot) : '';
  return `${stem}-${Date.now()}${ext}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  if (!isAdminRequest(req)) {
    return res.status(401).json({ ok: false, error: 'Admin authentication required' });
  }

  try {
    const token = getGitHubToken();
    if (!token) throw new Error('Missing GITHUB_TOKEN environment variable');

    const kind = String(req.body?.kind || '').toLowerCase();
    const allowedExts = ALLOWED_KINDS.get(kind);
    if (!allowedExts) return res.status(400).json({ ok: false, error: 'Interior upload kind must be room or music' });

    const fileName = getSafeFileName(req.body?.fileName, kind);
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (!allowedExts.has(ext)) {
      return res.status(400).json({ ok: false, error: kind === 'music' ? 'Interior music must be MP3' : 'Interior room must be GLB or glTF' });
    }

    const base64 = String(req.body?.data || '').replace(/^data:[^;]+;base64,/, '');
    if (!base64) return res.status(400).json({ ok: false, error: 'Missing upload data' });

    const buffer = Buffer.from(base64, 'base64');
    if (!buffer.length) return res.status(400).json({ ok: false, error: 'Invalid upload data' });
    if (buffer.length > MAX_BYTES) return res.status(400).json({ ok: false, error: 'Interior upload is too large. Keep files under 40MB.' });

    const interiorId = getSafeSlug(req.body?.interiorId || fileName.replace(/\.[^.]+$/, ''));
    const basePath = `${INTERIOR_ROOT}/${interiorId}/${kind}-${Date.now()}-${fileName}`;
    const filePath = await getAvailablePath(token, basePath);

    const response = await fetch(
      `https://api.github.com/repos/${REPO}/contents/${filePath}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: 'upload interior ' + kind + ': ' + fileName,
          content: buffer.toString('base64'),
          branch: BRANCH
        })
      }
    );

    if (!response.ok) {
      const detail = await getGitHubErrorMessage(response);
      throw new Error('GitHub interior upload failed. Status: ' + response.status + (detail ? '. ' + detail : ''));
    }

    return res.status(200).json({ ok: true, uploaded: true, path: '/' + filePath });
  } catch (err) {
    console.error('interior-upload error:', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Interior upload failed' });
  }
}
