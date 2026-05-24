import { isAdminRequest } from './_admin-auth.mjs';

const REPO = 'D1stknight/rebel-ants-village';
const BRANCH = 'dev';
const HUB_LAYOUT_FILE_PATH = 'assets/world-layout.json';
const VILLAGE_LAYOUT_ROOT = 'assets/world-layouts';
const TESTED_BRANCH_ALIAS = 'rebel-ants-village-git-dev-miguel-concepcions-projects.vercel.app';
const VILLAGE_IDS = new Set([
  'hub',
  'ronin',
  'samurai',
  'bushi',
  'warrior',
  'shogun',
  'buke',
  'kenshi',
  'wokou',
  'ashigaru',
  'sohei',
  'yamabushi',
  'queens',
  'cute-creepy',
  'saints-la'
]);

function getGitHubToken() {
  return process.env.GITHUB_TOKEN || '';
}

function getGitHubTokenDebug(token) {
  return {
    envVarName: 'GITHUB_TOKEN',
    hasGithubToken: Boolean(token),
    tokenLength: token ? token.length : 0,
    tokenPrefix: token ? token.slice(0, 4) : '',
    tokenLengthAfterRedeploy: token ? token.length : 0
  };
}

function getVercelRuntimeDebug() {
  const vercelUrl = process.env.VERCEL_URL || '';

  return {
    VERCEL_ENV: process.env.VERCEL_ENV || '',
    VERCEL_GIT_COMMIT_REF: process.env.VERCEL_GIT_COMMIT_REF || '',
    VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA || '',
    VERCEL_URL: vercelUrl,
    testedBranchAlias: TESTED_BRANCH_ALIAS,
    isTestedBranchAliasRequest: vercelUrl === TESTED_BRANCH_ALIAS
  };
}

function getVillageId(req) {
  const rawVillage =
    typeof req.query?.village === 'string'
      ? req.query.village
      : Array.isArray(req.query?.village)
        ? req.query.village[0]
        : 'hub';
  const villageId = String(rawVillage || 'hub').trim().toLowerCase();

  if (!VILLAGE_IDS.has(villageId)) {
    const err = new Error('Unknown village id: ' + villageId);
    err.statusCode = 400;
    throw err;
  }

  return villageId;
}

function getWorldLayoutPath(villageId) {
  return villageId === 'hub'
    ? HUB_LAYOUT_FILE_PATH
    : `${VILLAGE_LAYOUT_ROOT}/${villageId}.json`;
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

async function readWorldLayout(token, filePath, options = {}) {
  const response = await fetch(
    `https://api.github.com/repos/${REPO}/contents/${filePath}?ref=${BRANCH}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json'
      }
    }
  );

  if (!response.ok) {
    if (response.status === 404 && options.emptyOnMissing) {
      return { sha: null, layout: [] };
    }
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

async function writeWorldLayout(token, layout, filePath) {
  let sha;

  try {
    const current = await readWorldLayout(token, filePath);
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

  if (response.status === 409) {
    const current = await readWorldLayout(token, filePath);
    body.sha = current.sha;

    response = await fetch(
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
    const villageId = getVillageId(req);
    const filePath = getWorldLayoutPath(villageId);

    if (req.method === 'POST' && !isAdminRequest(req)) {
      return res.status(401).json({ ok: false, error: 'Admin authentication required' });
    }

    const token = getGitHubToken();

    if (!token) {
      throw new Error('Missing GITHUB_TOKEN environment variable');
    }

    if (req.method === 'GET') {
      const { layout } = await readWorldLayout(token, filePath, { emptyOnMissing: villageId !== 'hub' });
      return res.status(200).json({ ok: true, villageId, filePath, layout });
    }

    const { layout } = req.body || {};

    if (!Array.isArray(layout)) {
      return res.status(400).json({ ok: false, error: 'Missing world layout array' });
    }

    await writeWorldLayout(token, layout, filePath);

    return res.status(200).json({ ok: true, saved: true, villageId, filePath });
  } catch (err) {
    console.error('world-layout error:', err);
    const token = getGitHubToken();

    return res.status(err?.statusCode || 500).json({
      ok: false,
      error: err?.message || 'Could not sync world layout',
      githubDebug: getGitHubTokenDebug(token),
      vercelDebug: getVercelRuntimeDebug()
    });
  }
}
