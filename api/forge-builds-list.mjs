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

function getBuildListKey({ collectionKey, tokenId, rebelId }) {
  const safeCollectionKey = collectionKey || 'unknown_collection';
  const safeTokenId = tokenId || rebelId || 'unknown_token';
  return `forge:3d-builds:v1:${safeCollectionKey}:${safeTokenId}`;
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
        builds: [],
        storageResult: {
          storage: 'not_configured',
          message: 'Redis env vars are not configured yet.'
        }
      });
    }

    const listKey = getBuildListKey({ collectionKey, tokenId, rebelId });
    const listResult = await redisPipeline([
      ['LRANGE', listKey, 0, 24]
    ]);

    const buildIds = listResult?.[0]?.result || [];

    if (!buildIds.length) {
      return res.status(200).json({
        ok: true,
        builds: [],
        storageResult: {
          storage: 'redis',
          listKey,
          count: 0
        }
      });
    }

    const recordCommands = buildIds.map(buildId => ['GET', getBuildRecordKey(buildId)]);
    const recordResults = await redisPipeline(recordCommands);

    const builds = recordResults
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
      builds,
      storageResult: {
        storage: 'redis',
        listKey,
        count: builds.length
      }
    });
  } catch (err) {
    console.error('forge-builds-list error:', err);

    return res.status(500).json({
      ok: false,
      error: 'Could not list Forge 3D build requests',
      detail: err && err.message ? err.message : 'Unknown error'
    });
  }
}
