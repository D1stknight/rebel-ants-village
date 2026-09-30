// Shared helpers for the automated Forge Rigger (Vercel Sandbox worker).
// The worker image is a sandbox snapshot built by forge-worker/setup.sh; each rig job starts a fresh sandbox from it.
import { Sandbox } from '@vercel/sandbox';

export const REPO = 'D1stknight/rebel-ants-village';
export const WORKER_KEY = 'forge:rig-worker:v1';          // { snapshotId, commit, builtAt, setup: {...} }
export const PACK_KEY = 'forge:rig-worker:pack:v1';       // { "mixamo/jab.npz": url, ... }
export const FW = '/vercel/sandbox/fw';
export const JOB_DIR = '/vercel/sandbox/job';
export const JOB_TIMEOUT_MS = 20 * 60 * 1000;

function redisConfig() {
  return {
    url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '',
    token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || ''
  };
}

export async function redis(commands) {
  const { url, token } = redisConfig();
  if (!url || !token) throw new Error('Redis is not configured');
  const r = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands)
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error || `Redis request failed with status ${r.status}`);
  return Array.isArray(data) ? data : [];
}

export async function getJson(key) {
  const [res] = await redis([['GET', key]]);
  return res?.result ? JSON.parse(res.result) : null;
}

export async function setJson(key, value) {
  await redis([['SET', key, JSON.stringify(value)]]);
}

export const buildKey = (buildId) => `forge:3d-build:v1:${buildId}`;

export async function loadBuild(buildId) {
  const rec = await getJson(buildKey(buildId));
  if (!rec) throw new Error('Build record not found');
  return rec;
}

// Merge a rigging update into the build record (re-reads first so parallel writers are not clobbered).
export async function updateRigging(buildId, patch, outputPatch) {
  const rec = await loadBuild(buildId);
  const next = {
    ...rec,
    updatedAt: new Date().toISOString(),
    forgeRig: { ...(rec.forgeRig || {}), ...patch },
    output: outputPatch ? { ...(rec.output || {}), ...outputPatch } : rec.output
  };
  await setJson(buildKey(buildId), next);
  return next;
}

export function sanitize(value, fallback) {
  return String(value || fallback || 'unknown').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || fallback || 'unknown';
}

export function sourceGlbUrl(rec) {
  return rec?.output?.rebelGlbUrl || rec?.output?.glbUrl || null;
}

// Credentials: Vercel OIDC inside the deployment (default). If OIDC is off for the project, set
// FORGE_SANDBOX_TOKEN (a Vercel access token) and the team/project ids are filled in from the system env.
export function creds() {
  const token = process.env.FORGE_SANDBOX_TOKEN;
  if (!token) return {};
  return { token, teamId: process.env.FORGE_SANDBOX_TEAM_ID || 'team_7tWG3HhBf0Ir5h0Hhz9ZAarq', projectId: process.env.VERCEL_PROJECT_ID || 'prj_CjuIvsLXKinzfIgUkmSkyWhKWqtc' };
}

export async function getSandbox(name) {
  return Sandbox.get({ name, ...creds() });
}

export async function readText(sandbox, path) {
  try {
    const buf = await sandbox.readFileToBuffer({ path });
    return buf ? buf.toString('utf8') : null;
  } catch (e) {
    return null;
  }
}

export function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch (e) { return {}; }
}

export { Sandbox };
