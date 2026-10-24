import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
  'cute-creepy',
  'saints-la',
  'chumpz'
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
  const ref = options.ref || BRANCH;
  const url = new URL(`https://api.github.com/repos/${REPO}/contents/${filePath}`);

  url.searchParams.set('ref', ref);

  // Prevent stale GitHub/Vercel/serverless reads.
  if (options.noCache !== false) {
    url.searchParams.set('_', String(Date.now()));
  }

  const response = await fetch(url.toString(), {
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache'
    }
  });

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

  let json = '';

  if (file.content && file.encoding === 'base64') {
    json = Buffer
      .from(String(file.content || '').replace(/\n/g, ''), 'base64')
      .toString('utf8')
      .trim();
  }

  // GitHub /contents can return empty content for larger files.
  // If that happens, fetch the blob directly using the file SHA.
  if (!json && file.sha) {
    const blobResponse = await fetch(
      `https://api.github.com/repos/${REPO}/git/blobs/${file.sha}`,
      {
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache'
        }
      }
    );

    if (!blobResponse.ok) {
      const detail = await getGitHubErrorMessage(blobResponse);
      throw new Error(
        'Could not read world layout blob from GitHub. Status: ' +
        blobResponse.status +
        (detail ? '. ' + detail : '')
      );
    }

    const blob = await blobResponse.json();

    if (blob.content && blob.encoding === 'base64') {
      json = Buffer
        .from(String(blob.content || '').replace(/\n/g, ''), 'base64')
        .toString('utf8')
        .trim();
    }
  }

  if (!json) {
    console.warn('World layout file is empty or unreadable. Treating as blank layout:', {
      filePath,
      fileSha: file.sha,
      encoding: file.encoding,
      size: file.size
    });

    return {
      sha: file.sha,
      layout: []
    };
  }

  try {
    const layout = JSON.parse(json);

    if (!Array.isArray(layout)) {
      console.warn('World layout file is not an array. Treating as blank layout:', filePath);
      return {
        sha: file.sha,
        layout: []
      };
    }

    return {
      sha: file.sha,
      layout
    };
  } catch (err) {
    console.warn('World layout file contains invalid JSON. Treating as blank layout:', {
      filePath,
      error: err?.message || err
    });

    return {
      sha: file.sha,
      layout: []
    };
  }
}

// Oct 24: players get the layout that shipped with this deploy (vercel.json includeFiles puts the layout files in this
// function): no GitHub call per village load, and production shows the layouts merged into main, not dev's. A signed-in
// admin still reads the dev branch, the layout a Hard Save writes onto (editing an older copy would save over dev's).
const siteBodies = new Map();

async function readSiteLayoutBytes(filePath) {
  const places = [path.join(process.cwd(), filePath)];
  try { places.push(fileURLToPath(new URL('../' + filePath, import.meta.url))); } catch (e) {}
  for (const at of places) {
    try {
      return await readFile(at);
    } catch (err) {
      if (err?.code !== 'ENOENT') console.warn('world-layout: site copy unreadable', at, err?.message || err);
    }
  }
  return null;
}

// the players' answer, made once per warm instance (a deploy's files never change)
async function siteLayoutBody(villageId, filePath) {
  if (siteBodies.has(filePath)) return siteBodies.get(filePath);
  const bytes = await readSiteLayoutBytes(filePath);
  if (!bytes) return null;
  const layout = JSON.parse(bytes.toString('utf8'));
  if (!Array.isArray(layout)) throw new Error('Site layout is not an array: ' + filePath);
  // git's id for these bytes: the sha GitHub gives the same content, so the page's layout version checks read alike
  const sha = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  const body = JSON.stringify({ ok: true, villageId, filePath, sha, layout, source: 'site' });
  siteBodies.set(filePath, body);
  return body;
}

async function writeWorldLayout(token, layout, filePath) {
  let sha;

  try {
    const current = await readWorldLayout(token, filePath, { noCache: true });
    sha = current.sha;
  } catch (err) {
    if (!String(err?.message || '').includes('Status: 404')) {
      throw err;
    }
  }

  const expectedCount = Array.isArray(layout) ? layout.length : 0;
  const content = Buffer.from(JSON.stringify(layout, null, 2) + '\n', 'utf8').toString('base64');

  const body = {
    message: `save: world layout (${expectedCount} objects)`,
    content,
    branch: BRANCH
  };

  if (sha) body.sha = sha;

  let response = await fetch(
    `https://api.github.com/repos/${REPO}/contents/${filePath}`,
    {
      method: 'PUT',
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache'
      },
      body: JSON.stringify(body)
    }
  );

  if (response.status === 409) {
    const current = await readWorldLayout(token, filePath, { noCache: true });
    body.sha = current.sha;

    response = await fetch(
      `https://api.github.com/repos/${REPO}/contents/${filePath}`,
      {
        method: 'PUT',
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache'
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

  const savedResponse = await response.json().catch(() => null);
  const commitSha = savedResponse?.commit?.sha || null;
  const contentSha = savedResponse?.content?.sha || null;

  if (commitSha) {
    const verified = await readWorldLayout(token, filePath, {
      ref: commitSha,
      noCache: true
    });

    const verifiedCount = Array.isArray(verified.layout) ? verified.layout.length : 0;

    if (verifiedCount !== expectedCount) {
      throw new Error(
        `GitHub verification failed after save. Expected ${expectedCount} objects, but verified ${verifiedCount}.`
      );
    }

    return {
      savedCount: expectedCount,
      verifiedCount,
      githubCommitSha: commitSha,
      githubContentSha: contentSha
    };
  }

  return {
    savedCount: expectedCount,
    verifiedCount: null,
    githubCommitSha: null,
    githubContentSha: contentSha
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

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

    const deployBranch = process.env.VERCEL_GIT_COMMIT_REF || null;
    let admin = true;
    if (req.method === 'GET') {
      try { admin = isAdminRequest(req); } catch (err) { admin = false; }
    }

    if (req.method === 'GET' && !admin) {
      try {
        const body = await siteLayoutBody(villageId, filePath);
        if (body) {
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          return res.status(200).send(body);
        }
        console.warn('world-layout: no site copy of', filePath, '- reading the deployed commit from GitHub');
      } catch (err) {
        console.warn('world-layout: site copy failed', filePath, err?.message || err);
      }
    }

    const token = getGitHubToken();

    if (!token) {
      throw new Error('Missing GITHUB_TOKEN environment variable');
    }

    if (req.method === 'GET') {
      // a player only gets here when this deploy has no copy of the file: the same content, from the deployed commit
      const ref = admin ? BRANCH : (process.env.VERCEL_GIT_COMMIT_SHA || BRANCH);
      const { layout, sha } = await readWorldLayout(token, filePath, { ref, emptyOnMissing: villageId !== 'hub' });
      return res.status(200).json({ ok: true, villageId, filePath, sha: sha || null, layout, source: admin ? 'dev' : 'deploy', deployBranch });
    }

    const { layout } = req.body || {};

if (!Array.isArray(layout)) {
  return res.status(400).json({ ok: false, error: 'Missing world layout array' });
}

if (villageId === 'hub' && layout.length < 10) {
  return res.status(400).json({
    ok: false,
    error: `Refusing to save Hub Village with only ${layout.length} objects. This would likely overwrite the real village.`,
    villageId,
    filePath,
    receivedCount: layout.length
  });
}

const saveResult = await writeWorldLayout(token, layout, filePath);

return res.status(200).json({
  ok: true,
  saved: true,
  villageId,
  filePath,
  receivedCount: layout.length,
  deployBranch,
  ...saveResult
});
  } catch (err) {
    // Token and deploy details stay in the server log; they are never sent to the browser.
    console.error('world-layout error:', err, {
      githubDebug: getGitHubTokenDebug(getGitHubToken()),
      vercelDebug: getVercelRuntimeDebug()
    });

    return res.status(err?.statusCode || 500).json({
      ok: false,
      error: err?.message || 'Could not sync world layout'
    });
  }
}
