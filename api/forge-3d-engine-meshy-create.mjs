import { enforceRateLimit, isAllowedAssetUrl } from './_guard.mjs';
import { isAdminRequest } from './_admin-auth.mjs';
const MESHY_CREATE_URL = 'https://api.meshy.ai/openapi/v1/image-to-3d';
// Front + back views -> Meshy multi-image-to-3d (no guessed back of the head)
const MESHY_MULTI_CREATE_URL = 'https://api.meshy.ai/openapi/v1/multi-image-to-3d';
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

  const backImageUrl =
    body.backImageUrl ||
    productionReference.backImageUrl ||
    buildRequest.sourceImage?.backImageUrl ||
    null;

  return {
    buildId,
    imageUrl,
    backImageUrl,
    productionReference,
    generationInput,
    requestedOptions: body.options || {}
  };
}

function buildMeshyRequest({ imageUrl, backImageUrl, requestedOptions }) {
  const options = requestedOptions || {};
  const views = backImageUrl ? { image_urls: [imageUrl, backImageUrl] } : { image_url: imageUrl };

  return {
    ...views,
    ai_model: options.ai_model || 'meshy-6',
    should_texture: options.should_texture !== false,
    enable_pbr: options.enable_pbr !== false,
    should_remesh: options.should_remesh !== false,
    topology: options.topology || 'quad',
    // 30k flattened armor relief into the normal map; ~90k keeps silhouette detail while staying village-friendly
    target_polycount: Number(options.target_polycount || process.env.FORGE_MESHY_POLYCOUNT || 90000),
    // 'none' keeps the reference image's own pose (Meshy's forced A-pose spread #4998's bulky arms far from the body)
    ...(options.pose_mode === 'none' ? {} : { pose_mode: options.pose_mode || 'a-pose' }),
    target_formats: Array.isArray(options.target_formats) && options.target_formats.length
      ? options.target_formats
      : ['glb']
  };
}

async function updateBuildWithMeshyTask({ buildId, meshyTaskId, meshyRequest, meshyResponse, meshyEndpoint = 'image-to-3d' }) {
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
      endpoint: meshyEndpoint,
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

    // Phase 0 cost guard: players can only start Meshy for an existing build that has no task yet,
    // with our reference images and the default model settings. Admins keep full control.
    const admin = isAdminRequest(req);
    if (!admin) {
      if (!(await enforceRateLimit(req, res, 'meshy-create', 6, 86400, '3D generations today'))) return;
      if (!isAllowedAssetUrl(createPayload.imageUrl) || (createPayload.backImageUrl && !isAllowedAssetUrl(createPayload.backImageUrl))) {
        return res.status(400).json({ ok: false, error: 'Reference images must come from the Forge' });
      }
      const existing = createPayload.buildId ? (await redisPipeline([['GET', getBuildRecordKey(createPayload.buildId)]]))?.[0]?.result : null;
      if (!existing) return res.status(404).json({ ok: false, error: 'Build not found' });
      let rec = {}; try { rec = JSON.parse(existing); } catch (e) {}
      if (rec?.engine?.taskId) return res.status(409).json({ ok: false, error: 'This build already has a 3D generation running or done' });
      const po = createPayload.requestedOptions || {};
      createPayload.requestedOptions = po.pose_mode === 'none' ? { pose_mode: 'none' } : {};
    }
    const meshyRequest = buildMeshyRequest(createPayload);

    const meshyEndpoint = meshyRequest.image_urls ? 'multi-image-to-3d' : 'image-to-3d';
    const meshyResponse = await fetch(meshyRequest.image_urls ? MESHY_MULTI_CREATE_URL : MESHY_CREATE_URL, {
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
      meshyResponse: meshyData,
      meshyEndpoint
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
