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

function getConceptListKey({ collectionKey, tokenId, rebelId }) {
  const safeCollectionKey = collectionKey || 'unknown_collection';
  const safeTokenId = tokenId || rebelId || 'unknown_token';
  return `forge:concepts:v1:${safeCollectionKey}:${safeTokenId}`;
}

function getConceptRecordKey(conceptId) {
  return `forge:concept:v1:${conceptId}`;
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

function readDeletePayload(reqBody) {
  const body = reqBody || {};

  const conceptId = body.conceptId || body.id;
  const collectionKey = body.collectionKey || 'battle_for_colony';
  const tokenId = body.tokenId || null;
  const rebelId = body.rebelId || null;

  if (!conceptId) {
    throw new Error('Missing conceptId');
  }

  if (!tokenId && !rebelId) {
    throw new Error('Missing tokenId or rebelId');
  }

  return {
    conceptId: String(conceptId),
    collectionKey,
    tokenId,
    rebelId
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    res.setHeader('Allow', 'POST, DELETE');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const deleteRequest = readDeletePayload(req.body || {});

    if (!isRedisConfigured()) {
      return res.status(200).json({
        ok: true,
        deleted: false,
        storageResult: {
          storage: 'not_configured',
          message: 'Redis env vars are not configured. Local delete can still continue.'
        }
      });
    }

    const listKey = getConceptListKey(deleteRequest);
    const recordKey = getConceptRecordKey(deleteRequest.conceptId);

    const results = await redisPipeline([
      ['DEL', recordKey],
      ['LREM', listKey, 0, deleteRequest.conceptId]
    ]);

    return res.status(200).json({
      ok: true,
      deleted: true,
      conceptId: deleteRequest.conceptId,
      storageResult: {
        storage: 'redis',
        recordKey,
        listKey,
        delResult: results?.[0]?.result ?? null,
        lremResult: results?.[1]?.result ?? null
      },
      nextStep: 'wire_blob_delete_later'
    });
  } catch (err) {
    console.error('forge-concepts-delete error:', err);

    return res.status(500).json({
      ok: false,
      error: 'Could not delete Forge concept metadata',
      detail: err && err.message ? err.message : 'Unknown error'
    });
  }
}
