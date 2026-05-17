const MESHY_TASK_URL_BASE = 'https://api.meshy.ai/openapi/v1/image-to-3d';

function getRedisConfig() {
  return {
    url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '',
    token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || ''
  };
}

function isRedisConfigured() {
  const { url, token } = getRedisConfig();
  return Boolean(url && token);
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

function readStatusPayload(payload) {
  const body = payload || {};
  const buildId = body.buildId || body.buildRequest?.buildId || null;
  const meshyTaskId = body.meshyTaskId || body.taskId || body.buildRequest?.engine?.taskId || null;

  if (!buildId) {
    throw new Error('Missing buildId');
  }

  return {
    buildId,
    meshyTaskId
  };
}

async function loadBuildRecord(buildId) {
  if (!isRedisConfigured()) {
    throw new Error('Redis is not configured');
  }

  const recordKey = getBuildRecordKey(buildId);
  const recordResult = await redisPipeline([
    ['GET', recordKey]
  ]);

  const rawRecord = recordResult?.[0]?.result || null;

  if (!rawRecord) {
    throw new Error('Build record not found');
  }

  try {
    return {
      recordKey,
      buildRecord: JSON.parse(rawRecord)
    };
  } catch(e) {
    throw new Error('Build record could not be parsed');
  }
}

function normalizeMeshyStatus(status) {
  const normalized = String(status || '').toUpperCase();

  if (normalized === 'SUCCEEDED' || normalized === 'SUCCESS') {
    return 'completed';
  }

  if (normalized === 'FAILED' || normalized === 'ERROR') {
    return 'failed';
  }

  if (normalized === 'PENDING') {
    return 'meshy_pending';
  }

  if (normalized === 'IN_PROGRESS' || normalized === 'PROCESSING') {
    return 'meshy_in_progress';
  }

  return 'submitted_to_meshy';
}

function extractGlbUrl(meshyData) {
  return (
    meshyData?.model_urls?.glb ||
    meshyData?.model_urls?.GLB ||
    meshyData?.output?.model_urls?.glb ||
    meshyData?.result?.model_urls?.glb ||
    meshyData?.glb_url ||
    null
  );
}

async function updateBuildRecordWithMeshyStatus({ recordKey, buildRecord, meshyTaskId, meshyData }) {
  const meshyStatus = meshyData?.status || meshyData?.task_status || meshyData?.state || 'unknown';
  const nextStatus = normalizeMeshyStatus(meshyStatus);
  const glbUrl = extractGlbUrl(meshyData);

  const updatedRecord = {
    ...buildRecord,
    status: nextStatus,
    updatedAt: new Date().toISOString(),
    engine: {
      ...(buildRecord.engine || {}),
      provider: 'meshy',
      taskId: meshyTaskId,
      status: meshyStatus,
      lastCheckedAt: new Date().toISOString(),
      response: meshyData,
      modelUrls: meshyData?.model_urls || buildRecord.engine?.modelUrls || null,
      glbUrl: glbUrl || buildRecord.engine?.glbUrl || null
    },
    output: {
      ...(buildRecord.output || {}),
      glbUrl: glbUrl || buildRecord.output?.glbUrl || null,
      source: glbUrl ? 'meshy' : buildRecord.output?.source || null
    },
    nextStep: glbUrl ? 'download_or_store_glb' : 'poll_meshy_status'
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
      return res.status(500).json({
        ok: false,
        error: 'Missing MESHY_API_KEY'
      });
    }

    const statusPayload = readStatusPayload(req.body || {});
    const { recordKey, buildRecord } = await loadBuildRecord(statusPayload.buildId);
    const meshyTaskId = statusPayload.meshyTaskId || buildRecord.engine?.taskId || null;

    if (!meshyTaskId) {
      return res.status(400).json({
        ok: false,
        error: 'Missing Meshy task ID'
      });
    }

    const meshyResponse = await fetch(`${MESHY_TASK_URL_BASE}/${encodeURIComponent(meshyTaskId)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json'
      }
    });

    const meshyData = await meshyResponse.json();

    if (!meshyResponse.ok) {
      console.error('Meshy status error:', meshyData);
      throw new Error(meshyData?.message || meshyData?.error || `Meshy status failed with status ${meshyResponse.status}`);
    }

    const updatedBuildRecord = await updateBuildRecordWithMeshyStatus({
      recordKey,
      buildRecord,
      meshyTaskId,
      meshyData
    });

    return res.status(200).json({
      ok: true,
      provider: 'meshy',
      buildId: statusPayload.buildId,
      meshyTaskId,
      meshyStatus: meshyData?.status || meshyData?.task_status || meshyData?.state || 'unknown',
      buildStatus: updatedBuildRecord.status,
      glbUrl: updatedBuildRecord.output?.glbUrl || null,
      meshyResponse: meshyData,
      buildRecord: updatedBuildRecord,
      message: updatedBuildRecord.output?.glbUrl
        ? 'Meshy 3D model is complete. GLB URL is ready.'
        : 'Meshy 3D model is still processing.'
    });
  } catch (err) {
    console.error('forge-3d-engine-meshy-status error:', err);

    return res.status(500).json({
      ok: false,
      error: 'Could not check Meshy 3D generation status',
      detail: err && err.message ? err.message : 'Unknown error'
    });
  }
}
