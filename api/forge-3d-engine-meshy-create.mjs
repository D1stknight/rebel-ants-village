const MESHY_CREATE_URL = 'https://api.meshy.ai/openapi/v1/image-to-3d';
const MESHY_ENGINE_VERSION = 'meshy_v1_create';

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

function readMeshyCreatePayload(payload) {
  const body = payload || {};
  const buildRequest = body.buildRequest || {};
  const productionReference = body.productionReference || body.selectedConcept || buildRequest.productionReference || {};
  const generationInput = body.generationInput || {};

  const buildId = body.buildId || buildRequest.buildId || null;
  const imageUrl =
    body.imageUrl ||
    productionReference.imageUrl ||
    buildRequest.sourceImage?.imageUrl ||
    buildRequest.sourceImageUrl ||
    null;

  if (!buildId) {
    throw new Error('Missing buildId');
  }

  if (!imageUrl) {
    throw new Error('Missing production reference imageUrl');
  }

  return {
    buildId,
    imageUrl,
    productionReference,
    generationInput,
    requestedOptions: body.options || {}
  };
}

function buildMeshyRequest({ imageUrl, requestedOptions }) {
  const options = requestedOptions || {};

  return {
    image_url: imageUrl,
    ai_model: options.ai_model || 'meshy-6',
    should_texture: options.should_texture !== false,
    enable_pbr: options.enable_pbr !== false,
    should_remesh: options.should_remesh !== false,
    topology: options.topology || 'quad',
    target_polycount: Number(options.target_polycount || 30000),
    pose_mode: options.pose_mode || 'a-pose',
    target_formats: Array.isArray(options.target_formats) && options.target_formats.length
      ? options.target_formats
      : ['glb']
  };
}

async function updateBuildWithMeshyTask({ buildId, meshyTaskId, meshyRequest, meshyResponse }) {
  if (!isRedisConfigured()) {
    return {
      saved: false,
      storage: 'not_configured',
      message: 'Redis env vars are not configured yet.'
    };
  }

  const recordKey = getBuildRecordKey(buildId);
  const recordResult = await redisPipeline([
    ['GET', recordKey]
  ]);

  const rawRecord = recordResult?.[0]?.result || null;

  if (!rawRecord) {
    return {
      saved: false,
      storage: 'redis',
      recordKey,
      message: 'Build record was not found. Meshy task still started.'
    };
  }

  let buildRecord;
  try {
    buildRecord = JSON.parse(rawRecord);
  } catch(e) {
    throw new Error('Build record could not be parsed');
  }

  const updatedRecord = {
    ...buildRecord,
    status: 'submitted_to_meshy',
    updatedAt: new Date().toISOString(),
    engine: {
      provider: 'meshy',
      engineVersion: MESHY_ENGINE_VERSION,
      taskId: meshyTaskId,
      status: 'submitted',
      request: meshyRequest,
      response: meshyResponse
    },
    nextStep: 'poll_meshy_status'
  };

  await redisPipeline([
    ['SET', recordKey, JSON.stringify(updatedRecord)]
  ]);

  return {
    saved: true,
    storage: 'redis',
    recordKey,
    buildRecord: updatedRecord
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
      return res.status(500).json({
        ok: false,
        error: 'Missing MESHY_API_KEY'
      });
    }

    const createPayload = readMeshyCreatePayload(req.body || {});
    const meshyRequest = buildMeshyRequest(createPayload);

    const meshyResponse = await fetch(MESHY_CREATE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(meshyRequest)
    });

    const meshyData = await meshyResponse.json();

    if (!meshyResponse.ok) {
      console.error('Meshy create error:', meshyData);
      throw new Error(meshyData?.message || meshyData?.error || `Meshy create failed with status ${meshyResponse.status}`);
    }

    const meshyTaskId = meshyData?.result || meshyData?.id || meshyData?.task_id || null;

    if (!meshyTaskId) {
      throw new Error('Meshy did not return a task ID');
    }

    const storageResult = await updateBuildWithMeshyTask({
      buildId: createPayload.buildId,
      meshyTaskId,
      meshyRequest,
      meshyResponse: meshyData
    });

    return res.status(200).json({
      ok: true,
      provider: 'meshy',
      submitted: true,
      buildId: createPayload.buildId,
      meshyTaskId,
      meshyRequest,
      meshyResponse: meshyData,
      storageResult,
      message: 'Meshy 3D generation task started.'
    });
  } catch (err) {
    console.error('forge-3d-engine-meshy-create error:', err);

    return res.status(500).json({
      ok: false,
      error: 'Could not start Meshy 3D generation task',
      detail: err && err.message ? err.message : 'Unknown error'
    });
  }
}
