const MESHY_RIGGING_URL_BASE = 'https://api.meshy.ai/openapi/v1/rigging';

function getRedisConfig() {
  return {
    url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '',
    token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || ''
  };
}

function getBuildRecordKey(buildId) {
  return `forge:3d-build:v1:${buildId}`;
}

async function redisPipeline(commands) {
  const { url, token } = getRedisConfig();

  if (!url || !token) {
    throw new Error('Redis is not configured');
  }

  const response = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(commands)
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || `Redis request failed with status ${response.status}`);
  }

  return Array.isArray(data) ? data : [];
}

async function loadBuildRecord(buildId) {
  const recordKey = getBuildRecordKey(buildId);
  const recordResult = await redisPipeline([
    ['GET', recordKey]
  ]);

  const rawRecord = recordResult?.[0]?.result || null;

  if (!rawRecord) {
    throw new Error('Build record not found');
  }

  return {
    recordKey,
    buildRecord: JSON.parse(rawRecord)
  };
}

function normalizeRigStatus(status) {
  const normalized = String(status || '').toUpperCase();

  if (normalized === 'SUCCEEDED' || normalized === 'SUCCESS') {
    return 'meshy_rigging_completed';
  }

  if (normalized === 'FAILED' || normalized === 'ERROR') {
    return 'meshy_rigging_failed';
  }

  if (normalized === 'PENDING') {
    return 'meshy_rigging_pending';
  }

  if (normalized === 'IN_PROGRESS' || normalized === 'PROCESSING') {
    return 'meshy_rigging_in_progress';
  }

  return 'submitted_to_meshy_rigging';
}

function extractRiggedModelUrl(meshyData) {
  return (
    meshyData?.result?.rigged_character_glb_url ||
    meshyData?.rigged_character_glb_url ||
    meshyData?.rigged_model_url ||
    meshyData?.model_url ||
    meshyData?.model_urls?.glb ||
    meshyData?.model_urls?.GLB ||
    meshyData?.result?.rigged_model_url ||
    meshyData?.result?.model_url ||
    meshyData?.result?.model_urls?.glb ||
    meshyData?.output?.rigged_character_glb_url ||
    meshyData?.output?.rigged_model_url ||
    meshyData?.output?.model_url ||
    meshyData?.output?.model_urls?.glb ||
    null
  );
}

async function updateBuildRecordWithRigStatus({ recordKey, buildRecord, rigTaskId, meshyData }) {
  const meshyStatus = meshyData?.status || meshyData?.task_status || meshyData?.state || 'unknown';
  const nextStatus = normalizeRigStatus(meshyStatus);
  const riggedGlbUrl = extractRiggedModelUrl(meshyData);

  const updatedRecord = {
    ...buildRecord,
    status: riggedGlbUrl ? 'meshy_rigging_completed' : nextStatus,
    updatedAt: new Date().toISOString(),
    rigging: {
      ...(buildRecord.rigging || {}),
      provider: 'meshy',
      taskId: rigTaskId,
      status: meshyStatus,
      buildStatus: riggedGlbUrl ? 'meshy_rigging_completed' : nextStatus,
      lastCheckedAt: new Date().toISOString(),
      response: meshyData,
      riggedGlbUrl: riggedGlbUrl || buildRecord.rigging?.riggedGlbUrl || null
    },
    output: {
      ...(buildRecord.output || {}),
      riggedGlbUrl: riggedGlbUrl || buildRecord.output?.riggedGlbUrl || null,
      riggedSource: riggedGlbUrl ? 'meshy_rigging' : buildRecord.output?.riggedSource || null
    },
    nextStep: riggedGlbUrl ? 'inspect_rigged_glb_in_village' : 'poll_meshy_rigging_status'
  };

  await redisPipeline([
    ['SET', recordKey, JSON.stringify(updatedRecord)]
  ]);

  return updatedRecord;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const apiKey = process.env.MESHY_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ ok: false, error: 'Missing MESHY_API_KEY' });
    }

    const { buildId, rigTaskId } = req.body || {};

    if (!buildId) {
      return res.status(400).json({ ok: false, error: 'Missing buildId' });
    }

    const { recordKey, buildRecord } = await loadBuildRecord(buildId);
    const taskId = rigTaskId || buildRecord.rigging?.taskId || null;

    if (!taskId) {
      return res.status(400).json({ ok: false, error: 'Missing Meshy rigging task ID' });
    }

    const meshyResponse = await fetch(`${MESHY_RIGGING_URL_BASE}/${encodeURIComponent(taskId)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json'
      }
    });

    const meshyData = await meshyResponse.json();

    if (!meshyResponse.ok) {
      console.error('Meshy rig status error:', meshyData);
      throw new Error(meshyData?.message || meshyData?.error || `Meshy rig status failed with status ${meshyResponse.status}`);
    }

    const updatedBuildRecord = await updateBuildRecordWithRigStatus({
      recordKey,
      buildRecord,
      rigTaskId: taskId,
      meshyData
    });

    return res.status(200).json({
      ok: true,
      provider: 'meshy',
      buildId,
      rigTaskId: taskId,
      meshyStatus: meshyData?.status || meshyData?.task_status || meshyData?.state || 'unknown',
      buildStatus: updatedBuildRecord.status,
      riggedGlbUrl: updatedBuildRecord.output?.riggedGlbUrl || null,
      meshyResponse: meshyData,
      buildRecord: updatedBuildRecord,
      message: updatedBuildRecord.output?.riggedGlbUrl
        ? 'Meshy rigging is complete. Rigged GLB URL is ready.'
        : 'Meshy rigging is still processing.'
    });
  } catch (err) {
    console.error('forge-3d-engine-meshy-rig-status error:', err);

    return res.status(500).json({
      ok: false,
      error: 'Could not check Meshy rigging status',
      detail: err && err.message ? err.message : 'Unknown error'
    });
  }
}
