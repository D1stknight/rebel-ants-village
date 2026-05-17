const BUILD_VERSION = 'v0_queue_only';
const BUILD_STATUS = 'queued_for_future_3d_generation';

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

function getBuildListKey({ collectionKey, tokenId, rebelId }) {
  const safeCollectionKey = collectionKey || 'unknown_collection';
  const safeTokenId = tokenId || rebelId || 'unknown_token';
  return `forge:3d-builds:v1:${safeCollectionKey}:${safeTokenId}`;
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

function build3dRequestPayload(payload) {
  const body = payload || {};
  const selectedConcept = body.selectedConcept || {};
  const productionReference = body.productionReference || selectedConcept;
  const generationInput = body.generationInput || {};

  const sourceConceptId = productionReference.conceptId || productionReference.id || selectedConcept.conceptId || selectedConcept.id || null;
  const tokenId = productionReference.tokenId || selectedConcept.tokenId || generationInput.tokenId || null;
  const rebelId = productionReference.rebelId || selectedConcept.rebelId || generationInput.rebelId || null;
  const collectionKey = productionReference.collectionKey || selectedConcept.collectionKey || generationInput.collectionKey || 'battle_for_colony';
  const imageUrl = productionReference.imageUrl || selectedConcept.imageUrl || null;
  const imageBlobPath = productionReference.imageBlobPath || selectedConcept.imageBlobPath || null;

  if (!sourceConceptId) {
    throw new Error('Missing production reference concept ID');
  }

  if (!tokenId && !rebelId) {
    throw new Error('Missing tokenId or rebelId');
  }

  if (!imageUrl) {
    throw new Error('Missing production reference imageUrl');
  }

  const now = new Date().toISOString();
  const buildId = `build_${Date.now()}`;

  return {
    buildId,
    buildVersion: BUILD_VERSION,
    status: BUILD_STATUS,
    createdAt: now,
    updatedAt: now,
    sourceConceptId,
    sourceConceptType: productionReference.conceptType || productionReference.forgeMode || 'production_reference',
    rebelId,
    tokenId,
    collectionKey,
    colony: productionReference.colony || selectedConcept.colony || generationInput.colony || null,
    bodyType: productionReference.bodyType || selectedConcept.bodyType || generationInput.bodyType || 'universal_ant_v1',
    sourceImage: {
      imageStorage: productionReference.imageStorage || selectedConcept.imageStorage || 'vercel_blob',
      imageUrl,
      imageBlobPath
    },
    targetOutput: 'game_ready_3d_character_glb_later',
    productionRules: {
      useProductionReferenceImage: true,
      preserveHeadFaceEyesMouth: true,
      fullBodyRequired: true,
      noWeaponsAttached: true,
      weaponsGeneratedSeparately: true,
      preferredPose: 'front_facing_clean_a_pose_like_reference',
      futureOutputFormat: 'glb'
    },
    economyPlan: {
      economyVersion: 'v0_testing_free',
      economyMode: 'testing_free',
      charged: false,
      cost: 0,
      currency: 'REBEL_POINTS',
      futureRules: {
        build3dCharacterMayUseRebelPoints: true,
        premium3dBuildMayCostMoreThanConceptGeneration: true,
        holderOnlyAccess: true
      }
    },
    note: '3D build request saved. Actual model generation is not enabled yet.'
  };
}

async function saveBuildRequest(buildRequest) {
  if (!isRedisConfigured()) {
    return {
      saved: false,
      storage: 'not_configured',
      message: 'Redis env vars are not configured yet.'
    };
  }

  const recordKey = getBuildRecordKey(buildRequest.buildId);
  const listKey = getBuildListKey(buildRequest);

  await redisPipeline([
    ['SET', recordKey, JSON.stringify(buildRequest)],
    ['LPUSH', listKey, buildRequest.buildId],
    ['LTRIM', listKey, 0, 24]
  ]);

  return {
    saved: true,
    storage: 'redis',
    recordKey,
    listKey
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const buildRequest = build3dRequestPayload(req.body || {});
    const storageResult = await saveBuildRequest(buildRequest);

    return res.status(200).json({
      ok: true,
      accepted: true,
      buildRequest,
      storageResult,
      message: '3D build request queued for the future model generation step.'
    });
  } catch (err) {
    console.error('forge-build-3d-character error:', err);

    return res.status(500).json({
      ok: false,
      error: 'Could not queue 3D build request',
      detail: err && err.message ? err.message : 'Unknown error'
    });
  }
}
