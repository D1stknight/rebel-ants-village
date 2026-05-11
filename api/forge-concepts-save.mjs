const MAX_METADATA_BYTES = 64 * 1024;

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

function getConceptListKey(concept) {
  const collectionKey = concept.collectionKey || 'unknown_collection';
  const tokenId = concept.tokenId || concept.rebelId || 'unknown_token';
  return `forge:concepts:v1:${collectionKey}:${tokenId}`;
}

function getConceptRecordKey(conceptId) {
  return `forge:concept:v1:${conceptId}`;
}

async function redisCommand(command) {
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
    body: JSON.stringify([command])
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || `Redis request failed with status ${response.status}`);
  }

  const result = Array.isArray(data) ? data[0] : null;

  if (result?.error) {
    throw new Error(result.error);
  }

  return result?.result;
}

function sanitizeConceptPayload(payload) {
  const concept = payload?.concept || payload;

  if (!concept || typeof concept !== 'object') {
    throw new Error('Missing concept metadata');
  }

  if (!concept.conceptId && !concept.id) {
    throw new Error('Missing conceptId');
  }

  if (!concept.rebelId && !concept.tokenId) {
    throw new Error('Missing rebelId or tokenId');
  }

  const conceptId = String(concept.conceptId || concept.id);
  const now = new Date().toISOString();
  const imageStorage = concept.imageStorage || 'browser_indexeddb_now_server_later';
  const hasBlobImage = imageStorage === 'vercel_blob' && Boolean(concept.imageUrl);

  const sanitized = {
    conceptId,
    id: conceptId,
    createdAt: concept.createdAt || now,
    updatedAt: now,
    rebelId: concept.rebelId || null,
    tokenId: concept.tokenId || null,
    collectionKey: concept.collectionKey || 'battle_for_colony',
    colony: concept.colony || null,
    bodyType: concept.bodyType || null,
    forgeMode: concept.forgeMode || payload?.forgeMode || 'full_body_concept',
    variantIntent: concept.variantIntent || payload?.variantIntent || 'default',
    selected: concept.selected === true,
    imageStorage,
    imageUrl: concept.imageUrl || null,
    imageBlobPath: concept.imageBlobPath || null,
    economyPlan: concept.economyPlan || payload?.economyPlan || null,
    storageVersion: 'v1',
    serverStorageReady: true,
    note: hasBlobImage
      ? 'Metadata saved server-side. Image is stored in Vercel Blob.'
      : 'Metadata saved server-side. Image bytes remain browser-side until Blob storage wiring is enabled.'
  };

  const byteSize = Buffer.byteLength(JSON.stringify(sanitized), 'utf8');

  if (byteSize > MAX_METADATA_BYTES) {
    throw new Error('Concept metadata is too large');
  }

  return sanitized;
}

async function saveConceptMetadata(concept) {
  if (!isRedisConfigured()) {
    return {
      saved: false,
      storage: 'not_configured',
      message: 'Redis env vars are not configured yet. Local browser save can still continue.'
    };
  }

  const listKey = getConceptListKey(concept);
  const recordKey = getConceptRecordKey(concept.conceptId);
  const value = JSON.stringify(concept);

  await redisCommand(['SET', recordKey, value]);
  await redisCommand(['LPUSH', listKey, concept.conceptId]);
  await redisCommand(['LTRIM', listKey, 0, 49]);

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
    const concept = sanitizeConceptPayload(req.body || {});
    const storageResult = await saveConceptMetadata(concept);

    return res.status(200).json({
      ok: true,
      concept,
      storageResult,
      nextStep: concept.imageStorage === 'vercel_blob'
        ? 'server_concept_image_saved'
        : 'wire_blob_image_storage_later'
    });
  } catch (err) {
    console.error('forge-concepts-save error:', err);

    return res.status(500).json({
      ok: false,
      error: 'Could not save Forge concept metadata',
      detail: err && err.message ? err.message : 'Unknown error'
    });
  }
}
