import { isAdminRequest } from './_admin-auth.mjs';

const REPO = 'D1stknight/rebel-ants-village';
const BRANCH = 'dev';
const BADGE_IMAGE_ROOT = 'assets/badges';
const MAX_IMAGE_BYTES = 1024 * 1024;
const ALLOWED_MIME_TYPES = new Map([
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/jpeg', 'jpg']
]);

function getGitHubToken() {
  return process.env.GITHUB_TOKEN || '';
}

function getSafeSlug(value, fallback = 'badge-image') {
  const slug = String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || fallback;
}

function getSafeBadgePath(path) {
  const clean = String(path || '').trim().replace(/^\/+/, '');
  if (!clean.startsWith(`${BADGE_IMAGE_ROOT}/`)) return null;
  if (clean.includes('..') || clean.includes('\\')) return null;
  const ext = clean.split('.').pop()?.toLowerCase();
  if (!['png', 'webp', 'jpg', 'jpeg'].includes(ext)) return null;
  return clean;
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
    throw new Error('Could not read badge image from GitHub. Status: ' + response.status + (detail ? '. ' + detail : ''));
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

async function uploadBadgeImage(req, res, token) {
  const { badgeId, fileName, mimeType, data } = req.body || {};
  const ext = ALLOWED_MIME_TYPES.get(String(mimeType || '').toLowerCase());
  if (!ext) return res.status(400).json({ ok: false, error: 'Badge image must be PNG, WebP, or JPG/JPEG' });

  const base64 = String(data || '').replace(/^data:[^;]+;base64,/, '');
  if (!base64) return res.status(400).json({ ok: false, error: 'Missing image data' });

  const imageBuffer = Buffer.from(base64, 'base64');
  if (!imageBuffer.length) return res.status(400).json({ ok: false, error: 'Invalid image data' });
  if (imageBuffer.length > MAX_IMAGE_BYTES) {
    return res.status(400).json({ ok: false, error: 'Badge image is too large. Keep it at or below 1MB for upload.' });
  }

  const sourceName = fileName ? String(fileName).replace(/\.[^.]+$/, '') : badgeId;
  const slug = getSafeSlug(badgeId || sourceName || 'badge-image');
  const basePath = `${BADGE_IMAGE_ROOT}/${slug}.${ext}`;
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
        message: 'upload: badge image ' + filePath,
        content: imageBuffer.toString('base64'),
        branch: BRANCH
      })
    }
  );

  if (!response.ok) {
    const detail = await getGitHubErrorMessage(response);
    throw new Error('GitHub badge image upload failed. Status: ' + response.status + (detail ? '. ' + detail : ''));
  }

  return res.status(200).json({ ok: true, uploaded: true, path: '/' + filePath });
}

async function deleteBadgeImage(req, res, token) {
  const filePath = getSafeBadgePath(req.body?.path);
  if (!filePath) {
    return res.status(400).json({ ok: false, error: 'Can only delete images inside /assets/badges/' });
  }

  const current = await readGitHubFile(token, filePath);
  if (!current?.sha) return res.status(404).json({ ok: false, error: 'Badge image not found in GitHub' });

  const response = await fetch(
    `https://api.github.com/repos/${REPO}/contents/${filePath}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'delete: badge image ' + filePath,
        sha: current.sha,
        branch: BRANCH
      })
    }
  );

  if (!response.ok) {
    const detail = await getGitHubErrorMessage(response);
    throw new Error('GitHub badge image delete failed. Status: ' + response.status + (detail ? '. ' + detail : ''));
  }

  return res.status(200).json({ ok: true, deleted: true, path: '/' + filePath });
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

    const action = String(req.body?.action || '').toLowerCase();
    if (action === 'upload') return uploadBadgeImage(req, res, token);
    if (action === 'delete') return deleteBadgeImage(req, res, token);

    return res.status(400).json({ ok: false, error: 'Unknown badge image action' });
  } catch (err) {
    console.error('badge-image error:', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Badge image request failed' });
  }
}
