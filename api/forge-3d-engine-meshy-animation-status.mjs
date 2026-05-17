const MESHY_ANIMATION_URL_BASE = 'https://api.meshy.ai/openapi/v1/animations';

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

async function readMeshyResponseBody(response) {
  const text = await response.text();

  if (!text) {
    return {
      raw: '',
      parsed: null
    };
  }

  try {
    return {
      raw: text,
      parsed: JSON.parse(text)
    };
  } catch(e) {
    return {
      raw: text,
      parsed: null
    };
  }
}

function getMeshyErrorMessage(meshyBody, status) {
  const parsed = meshyBody?.parsed;

  return (
    parsed?.message ||
    parsed?.error ||
    parsed?.detail ||
    parsed?.details ||
    meshyBody?.raw ||
    `Meshy animation status failed with status ${status}`
  );
}

function normalizeAnimationStatus(status) {
  const normalized = String(status || '').toUpperCase();

  if (normalized === 'SUCCEEDED' || normalized === 'SUCCESS') {
    return 'succeeded';
  }

  if (normalized === 'FAILED' || normalized === 'ERROR') {
    return 'failed';
  }

  if (normalized === 'PENDING') {
    return 'pending';
  }

  if (normalized === 'IN_PROGRESS' || normalized === 'PROCESSING' || normalized === 'RUNNING') {
    return 'processing';
  }

  return status || 'unknown';
}

function extractAnimationGlbUrl(meshyData) {
  return (
    meshyData?.result?.animation_glb_url ||
    meshyData?.animation_glb_url ||
    meshyData?.output?.animation_glb_url ||
    meshyData?.result?.model_urls?.glb ||
    meshyData?.model_urls?.glb ||
    null
  );
}

async function updateBuildRecordWithAnimationStatus({
  recordKey,
  buildRecord,
  animationKey,
  animationTaskId,
  meshyData
}) {
  const now = new Date().toISOString();
  const rawStatus = meshyData?.status || meshyData?.task_status || meshyData?.state || 'unknown';
  const animationStatus = normalizeAnimationStatus(rawStatus);
  const animationGlbUrl = extractAnimationGlbUrl(meshyData);
  const previousRigging = buildRecord.rigging || {};
  const previousAnimationTasks = previousRigging.animationTasks || {};
  const previousOutput = buildRecord.output || {};
  const previousMeshyAnimations = previousOutput.meshyAnimations || {};
  const previousAnimationOutput = previousMeshyAnimations[animationKey] || {};

  const updatedRecord = {
    ...buildRecord,
    updatedAt: now,
    rigging: {
      ...previousRigging,
      animationTasks: {
        ...previousAnimationTasks,
        [animationKey]: {
          ...(previousAnimationTasks[animationKey] || {}),
          taskId: animationTaskId,
          status: animationStatus,
          rawStatus,
          response: meshyData,
          lastCheckedAt: now
        }
      }
    },
    output: {
      ...previousOutput,
      meshyAnimations: {
        ...previousMeshyAnimations,
        [animationKey]: {
          ...previousAnimationOutput,
          animationGlbUrl: animationGlbUrl || previousAnimationOutput.animationGlbUrl || null,
          source: animationGlbUrl ? 'meshy_animation_api' : previousAnimationOutput.source || null,
          status: animationStatus,
          taskId: animationTaskId,
          lastCheckedAt: now
        }
      }
    },
    nextStep: animationGlbUrl
      ? `store_meshy_${animationKey}_animation_glb`
      : `poll_meshy_${animationKey}_animation_status`
  };

  await redisPipeline([
    ['SET', recordKey, JSON.stringify(updatedRecord)]
  ]);

  return {
    updatedRecord,
    animationStatus,
    rawStatus,
    animationGlbUrl
  };
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

    const { buildId, animationKey } = req.body || {};
    const normalizedAnimationKey = String(animationKey || '').trim();

    if (!buildId) {
      return res.status(400).json({ ok: false, error: 'Missing buildId' });
    }

    if (!normalizedAnimationKey) {
      return res.status(400).json({ ok: false, error: 'Missing animationKey' });
    }

    const { recordKey, buildRecord } = await loadBuildRecord(buildId);
    const animationTask = buildRecord.rigging?.animationTasks?.[normalizedAnimationKey] || null;
    const animationTaskId = animationTask?.taskId || null;

    if (!animationTaskId) {
      return res.status(400).json({ ok: false, error: `Missing Meshy ${normalizedAnimationKey} animation task ID` });
    }

    const meshyResponse = await fetch(`${MESHY_ANIMATION_URL_BASE}/${encodeURIComponent(animationTaskId)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json'
      }
    });

    const meshyBody = await readMeshyResponseBody(meshyResponse);
    const meshyData = meshyBody.parsed || {};

    if (!meshyResponse.ok) {
      const meshyError = {
        status: meshyResponse.status,
        statusText: meshyResponse.statusText,
        responseBody: meshyBody.parsed || meshyBody.raw,
        responseText: meshyBody.raw,
        message: getMeshyErrorMessage(meshyBody, meshyResponse.status),
        requestPayload: {
          buildId,
          animationKey: normalizedAnimationKey,
          animationTaskId
        }
      };

      console.error('Meshy animation status error:', meshyError);

      return res.status(meshyResponse.status).json({
        ok: false,
        error: 'Meshy animation status request failed',
        detail: meshyError.message,
        meshyError
      });
    }

    const {
      updatedRecord,
      animationStatus,
      rawStatus,
      animationGlbUrl
    } = await updateBuildRecordWithAnimationStatus({
      recordKey,
      buildRecord,
      animationKey: normalizedAnimationKey,
      animationTaskId,
      meshyData
    });

    return res.status(200).json({
      ok: true,
      provider: 'meshy',
      buildId,
      animationKey: normalizedAnimationKey,
      animationTaskId,
      status: animationStatus,
      rawStatus,
      animationGlbUrl,
      meshyAnimationResponse: meshyData,
      buildRecord: updatedRecord,
      message: animationGlbUrl
        ? `Meshy ${normalizedAnimationKey} animation GLB is ready.`
        : `Meshy ${normalizedAnimationKey} animation is still processing.`
    });
  } catch (err) {
    console.error('forge-3d-engine-meshy-animation-status error:', err);

    return res.status(500).json({
      ok: false,
      error: 'Could not check Meshy animation status',
      detail: err && err.message ? err.message : 'Unknown error'
    });
  }
}
