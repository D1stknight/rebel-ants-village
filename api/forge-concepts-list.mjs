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

function getQueryValue(req, key) {
  return req.query?.[key] || null;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const collectionKey = getQueryValue(req, 'collectionKey') || 'battle_for_colony';
    const tokenId = getQueryValue(req, 'tokenId');
    const rebelId = getQueryValue(req, 'rebelId');

    if (!tokenId && !rebelId) {
      return res.status(400).json({
        ok: false,
        error: 'Missing tokenId or rebelId'
      });
    }

    if (!isRedisConfigured()) {
      return res.status(200).json({
        ok: true,
        concepts: [],
        storageResult: {
          storage: 'not_configured',
          message: 'Redis env vars are not configured yet. Local browser concepts can still be shown.'
        }
      });
    }

    const listKey = getConceptListKey({ collectionKey, tokenId, rebelId });
    const listResult = await redisPipeline([
      ['LRANGE', listKey, 0, 49]
    ]);

    const conceptIds = listResult?.[0]?.result || [];

    if (!conceptIds.length) {
      return res.status(200).json({
        ok: true,
        concepts: [],
        storageResult: {
          storage: 'redis',
          listKey
        }
      });
    }

    const recordCommands = conceptIds.map(conceptId => ['GET', getConceptRecordKey(conceptId)]);
    const recordResults = await redisPipeline(recordCommands);

    const concepts = recordResults
      .map(item => item?.result || null)
      .filter(Boolean)
      .map(raw => {
        try {
          return JSON.parse(raw);
        } catch(e) {
          return null;
        }
      })
      .filter(Boolean);

    return res.status(200).json({
      ok: true,
      concepts,
      storageResult: {
        storage: 'redis',
        listKey,
        count: concepts.length
      }
    });
  } catch (err) {
    console.error('forge-concepts-list error:', err);

    return res.status(500).json({
      ok: false,
      error: 'Could not list Forge concept metadata',
      detail: err && err.message ? err.message : 'Unknown error'
    });
  }
}
