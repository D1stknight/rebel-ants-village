const MESHY_ANIMATION_URL = 'https://api.meshy.ai/openapi/v1/animations';

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
    `Meshy animation create failed with status ${status}`
  );
}

function buildSafeMeshyAnimationRequestDebug(request) {
  return {
    rig_task_id: request?.rig_task_id || null,
    action_id: request?.action_id ?? null
  };
}

async function saveAnimationTaskToBuild({
  recordKey,
  buildRecord,
  animationKey,
  animationTaskId,
  meshyAnimationRequest,
  meshyAnimationResponse
}) {
  const now = new Date().toISOString();
  const previousRigging = buildRecord.rigging || {};
  const previousAnimationTasks = previousRigging.animationTasks || {};

  const updatedRecord = {
    ...buildRecord,
    status: buildRecord.status || 'meshy_animation_submitted',
    updatedAt: now,
    rigging: {
      ...previousRigging,
      animationTasks: {
        ...previousAnimationTasks,
        [animationKey]: {
          ...(previousAnimationTasks[animationKey] || {}),
          taskId: animationTaskId,
          status: 'submitted',
          request: meshyAnimationRequest,
          response: meshyAnimationResponse,
          submittedAt: now
        }
      }
    },
    nextStep: `poll_meshy_${animationKey}_animation_status`
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

    const { buildId, animationKey, actionId } = req.body || {};
    const normalizedAnimationKey = String(animationKey || '').trim();
    const normalizedActionId = Number(actionId);

    if (!buildId) {
      return res.status(400).json({ ok: false, error: 'Missing buildId' });
    }

    if (!normalizedAnimationKey) {
      return res.status(400).json({ ok: false, error: 'Missing animationKey' });
    }

    if (!Number.isFinite(normalizedActionId)) {
      return res.status(400).json({ ok: false, error: 'Missing or invalid actionId' });
    }

    const { recordKey, buildRecord } = await loadBuildRecord(buildId);
    const rigTaskId = buildRecord.rigging?.taskId || null;

    if (!rigTaskId) {
      return res.status(400).json({ ok: false, error: 'Missing Meshy rigging task ID for this build' });
    }

    const meshyAnimationRequest = {
      rig_task_id: rigTaskId,
      action_id: normalizedActionId
    };

    const meshyResponse = await fetch(MESHY_ANIMATION_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(meshyAnimationRequest)
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
        requestPayload: buildSafeMeshyAnimationRequestDebug(meshyAnimationRequest)
      };

      console.error('Meshy animation create error:', meshyError);

      return res.status(meshyResponse.status).json({
        ok: false,
        error: 'Meshy animation create request failed',
        detail: meshyError.message,
        meshyError
      });
    }

    const animationTaskId = meshyData?.result || meshyData?.id || meshyData?.task_id || null;

    if (!animationTaskId) {
      throw new Error('Meshy did not return an animation task ID');
    }

    const updatedBuildRecord = await saveAnimationTaskToBuild({
      recordKey,
      buildRecord,
      animationKey: normalizedAnimationKey,
      animationTaskId,
      meshyAnimationRequest,
      meshyAnimationResponse: meshyData
    });

    return res.status(200).json({
      ok: true,
      provider: 'meshy',
      buildId,
      animationKey: normalizedAnimationKey,
      actionId: normalizedActionId,
      rigTaskId,
      animationTaskId,
      status: 'submitted',
      meshyAnimationRequest,
      meshyAnimationResponse: meshyData,
      buildRecord: updatedBuildRecord,
      message: 'Meshy animation task started.'
    });
  } catch (err) {
    console.error('forge-3d-engine-meshy-animation-create error:', err);

    return res.status(500).json({
      ok: false,
      error: 'Could not start Meshy animation task',
      detail: err && err.message ? err.message : 'Unknown error'
    });
  }
}
