const ACTIVE_CHARACTER_VERSION = 'v1';

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

function getActiveCharacterKey({ walletAddress, collectionKey, tokenId, rebelId }) {
  const ownerKey = walletAddress || 'local_testing_wallet';
  const safeCollectionKey = collectionKey || 'battle_for_colony';
  const safeTokenId = tokenId || rebelId || 'unknown_token';

  return `forge:active-character:${ACTIVE_CHARACTER_VERSION}:${ownerKey}:${safeCollectionKey}:${safeTokenId}`;
}

function getActiveCharacterByWalletKey(walletAddress) {
  const ownerKey = walletAddress || 'local_testing_wallet';
  return `forge:active-character:${ACTIVE_CHARACTER_VERSION}:${ownerKey}:selected`;
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

function parseActiveCharacter(rawRecord) {
  if (!rawRecord) return null;

  try {
    return JSON.parse(rawRecord);
  } catch(e) {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const walletAddress = getQueryValue(req, 'walletAddress') || getQueryValue(req, 'wallet') || null;
    const collectionKey = getQueryValue(req, 'collectionKey') || 'battle_for_colony';
    const tokenId = getQueryValue(req, 'tokenId');
    const rebelId = getQueryValue(req, 'rebelId');

    if (!isRedisConfigured()) {
      return res.status(200).json({
        ok: true,
        activeCharacter: null,
        hasActiveCharacter: false,
        storageResult: {
          storage: 'not_configured',
          message: 'Redis env vars are not configured yet.'
        }
      });
    }

    const commands = [];
    const selectedKey = getActiveCharacterByWalletKey(walletAddress);
    commands.push(['GET', selectedKey]);

    let tokenSpecificKey = null;

    if (tokenId || rebelId) {
      tokenSpecificKey = getActiveCharacterKey({
        walletAddress,
        collectionKey,
        tokenId,
        rebelId
      });
      commands.push(['GET', tokenSpecificKey]);
    }

    const results = await redisPipeline(commands);
    const selectedCharacter = parseActiveCharacter(results?.[0]?.result || null);
    const tokenSpecificCharacter = parseActiveCharacter(results?.[1]?.result || null);
    const activeCharacter = tokenSpecificCharacter || selectedCharacter || null;

    return res.status(200).json({
      ok: true,
      activeCharacter,
      hasActiveCharacter: Boolean(activeCharacter),
      storageResult: {
        storage: 'redis',
        selectedKey,
        tokenSpecificKey,
        source: tokenSpecificCharacter ? 'token_specific' : selectedCharacter ? 'wallet_selected' : 'none'
      }
    });
  } catch (err) {
    console.error('forge-active-character-get error:', err);

    return res.status(500).json({
      ok: false,
      error: 'Could not load active Forge character',
      detail: err && err.message ? err.message : 'Unknown error'
    });
  }
}
