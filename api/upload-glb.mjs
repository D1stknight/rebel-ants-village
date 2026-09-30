import { isAdminRequest } from './_admin-auth.mjs';

const REPO = 'D1stknight/rebel-ants-village';
const BRANCH = 'dev';
const BUILDINGS_ROOT = 'assets/buildings';

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

function sanitizeFileName(fileName) {
  const original = String(fileName || '').trim();
  const baseName = original.split(/[\\/]/).pop() || '';
  const withoutTraversal = baseName.replace(/\.\.+/g, '.');
  const safe = withoutTraversal.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^[._-]+/, '');
  return safe || '';
}

function normalizeBase64(data) {
  return String(data || '').replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '');
}

function sendError(res, httpStatus, error, detail = '', status = httpStatus) {
  return res.status(httpStatus).json({
    ok: false,
    error,
    detail,
    status
  });
}

async function readGitHubResponseBody(response) {
  const text = await response.text().catch(() => '');
  if (!text) return '';
  try {
    const parsed = JSON.parse(text);
    return parsed.message || parsed.error || text;
  } catch {
    return text;
  }
}

async function readExistingGitHubFile(token, filePath) {
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
    const detail = await readGitHubResponseBody(response);
    const error = new Error('Could not check existing GLB on GitHub');
    error.status = response.status;
    error.detail = detail;
    throw error;
  }

  return response.json();
}

async function writeGitHubFile(token, filePath, fileName, content, sha) {
  const body = {
    message: 'upload: ' + fileName,
    content,
    branch: BRANCH
  };
  if (sha) body.sha = sha;

  const response = await fetch(
    `https://api.github.com/repos/${REPO}/contents/${filePath}`,
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

  const text = await response.text().catch(() => '');
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text };
  }

  if (!response.ok) {
    const error = new Error('GitHub GLB upload failed');
    error.status = response.status;
    error.detail = data.message || text || response.statusText || '';
    throw error;
  }

  return data;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendError(res, 405, 'Method not allowed', 'Only POST is supported');
  }

  if (!isAdminRequest(req)) {
    return sendError(res, 401, 'Admin authentication required');
  }

  try {
    const token = getGitHubToken();
    if (!token) return sendError(res, 500, 'Missing GITHUB_TOKEN environment variable');

    const { fileName, data } = req.body || {};
    if (!fileName || typeof fileName !== 'string') {
      return sendError(res, 400, 'Missing fileName');
    }

    const safeFileName = sanitizeFileName(fileName);
    if (!safeFileName || !/\.glb$/i.test(safeFileName)) {
      return sendError(res, 400, 'Only .glb files are allowed');
    }

    const base64 = normalizeBase64(data);
    if (!base64) return sendError(res, 400, 'Missing upload data');

    const buffer = Buffer.from(base64, 'base64');
    if (!buffer.length) return sendError(res, 400, 'Invalid upload data');

    const filePath = `${BUILDINGS_ROOT}/${safeFileName}`;
    const existing = await readExistingGitHubFile(token, filePath);
    const written = await writeGitHubFile(token, filePath, safeFileName, buffer.toString('base64'), existing?.sha);
    const rawUrl = written?.content?.download_url || `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${filePath}`;

    return res.status(200).json({
      ok: true,
      path: '/' + filePath,
      url: rawUrl,
      sizeBytes: buffer.length,
      githubContentSha: written?.content?.sha || null,
      githubCommitSha: written?.commit?.sha || null
    });
  } catch (err) {
    console.error('upload-glb error:', err);
    const githubStatus = err?.status || 500;
    const httpStatus = githubStatus >= 400 && githubStatus < 500 ? githubStatus : 502;
    return sendError(
      res,
      httpStatus,
      err?.message || 'GLB upload failed',
      err?.detail || '',
      githubStatus
    );
  }
}
