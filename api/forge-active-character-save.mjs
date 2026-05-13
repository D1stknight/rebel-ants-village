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

function sanitizeActiveCharacterPayload(payload) {
  const body = payload || {};
  const build = body.build || body.buildRecord || {};
  const walletAddress = body.walletAddress || body.wallet || null;

  const buildId = body.buildId || build.buildId || null;
  const tokenId = body.tokenId || build.tokenId || null;
  const rebelId = body.rebelId || build.rebelId || null;
  const collectionKey = body.collectionKey || build.collectionKey || 'battle_for_colony';

  const activeGlbUrl =
    body.activeGlbUrl ||
    body.glbUrl ||
    build.output?.rebelGlbUrl ||
    build.output?.glbUrl ||
    build.engine?.glbUrl ||
    null;

  const glbBlobPath = body.glbBlobPath || build.output?.glbBlobPath || null;

  if (!buildId) {
    throw new Error('Missing buildId');
  }

  if (!tokenId && !rebelId) {
    throw new Error('Missing tokenId or rebelId');
  }

  if (!activeGlbUrl) {
    throw new Error('Missing active GLB URL');
  }

  const now = new Date().toISOString();

  return {
    activeCharacterVersion: ACTIVE_CHARACTER_VERSION,
    walletAddress,
    collectionKey,
    tokenId,
    rebelId,
    activeForgeBuildId: buildId,
    activeGlbUrl,
    glbBlobPath,
    activeCharacterSource: 'forge_glb',
    status: 'active_character_selected',
    selectedAt: now,
    updatedAt: now,
    sourceBuildStatus: build.status || null,
    sourceConceptId: build.sourceConceptId || null,
    note: 'This record is the selected Forge GLB for the landing page and future Village character handoff.'
  };
}

async function saveActiveCharacter(activeCharacter) {
  if (!isRedisConfigured()) {
    return {
      saved: false,
      storage: 'not_configured',
      message: 'Redis env vars are not configured yet.'
    };
  }

  const recordKey = getActiveCharacterKey(activeCharacter);
  const selectedKey = getActiveCharacterByWalletKey(activeCharacter.walletAddress);
  const value = JSON.stringify(activeCharacter);

  await redisPipeline([
    ['SET', recordKey, value],
    ['SET', selectedKey, value]
  ]);

  return {
    saved: true,
    storage: 'redis',
    recordKey,
    selectedKey
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const activeCharacter = sanitizeActiveCharacterPayload(req.body || {});
    const storageResult = await saveActiveCharacter(activeCharacter);

    return res.status(200).json({
      ok: true,
      activeCharacter,
      storageResult,
      message: 'Forge GLB set as active character.'
    });
  } catch (err) {
    console.error('forge-active-character-save error:', err);

    return res.status(500).json({
      ok: false,
      error: 'Could not set Forge GLB as active character',
      detail: err && err.message ? err.message : 'Unknown error'
    });
  }
}
