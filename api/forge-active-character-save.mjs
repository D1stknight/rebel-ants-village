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

  const output = build.output || {};
  const storedAnimations = output.storedAnimations || build.rigging?.storedAnimations || {};
  const storedArmatureAnimations =
    output.storedArmatureAnimations ||
    build.rigging?.storedArmatureAnimations ||
    {};

  const riggedGlbUrl =
    output.riggedRebelGlbUrl ||
    output.riggedGlbUrl ||
    build.rigging?.riggedRebelGlbUrl ||
    build.rigging?.riggedGlbUrl ||
    build.rigging?.response?.result?.rigged_character_glb_url ||
    null;

  const staticGlbUrl =
    output.rebelGlbUrl ||
    output.glbUrl ||
    build.engine?.glbUrl ||
    null;

  const walkingGlbUrl =
    output.walkingGlbUrl ||
    storedAnimations.walking?.storedAnimationUrl ||
    null;

  const runningGlbUrl =
    output.runningGlbUrl ||
    storedAnimations.running?.storedAnimationUrl ||
    null;

  const walkingArmatureGlbUrl =
    output.walkingArmatureGlbUrl ||
    storedArmatureAnimations.walking_armature?.storedAnimationUrl ||
    null;

  const runningArmatureGlbUrl =
    output.runningArmatureGlbUrl ||
    storedArmatureAnimations.running_armature?.storedAnimationUrl ||
    null;

  const activeGlbUrl =
    body.activeGlbUrl ||
    body.glbUrl ||
    output.activeGlbUrl ||
    riggedGlbUrl ||
    staticGlbUrl ||
    null;

  const glbBlobPath =
    body.glbBlobPath ||
    output.riggedGlbBlobPath ||
    output.glbBlobPath ||
    null;

  const activeCharacterModelType =
    body.activeCharacterModelType ||
    build.activeCharacterModelType ||
    output.activeCharacterModelType ||
    (riggedGlbUrl ? 'rigged_forge_glb' : 'static_forge_glb');

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

  const characterBundle = {
    bundleVersion: 'v1',
    bundleType: 'forge_character_bundle',
    collectionKey,
    tokenId,
    rebelId,
    sourceBuildId: buildId,
    modelType: activeCharacterModelType,
    activeGlbUrl,
    staticGlbUrl,
    riggedGlbUrl,
    glbBlobPath,
    animations: {
      walking: walkingGlbUrl
        ? {
            name: 'walking',
            glbUrl: walkingGlbUrl,
            source: 'rebel_blob'
          }
        : null,
      running: runningGlbUrl
        ? {
            name: 'running',
            glbUrl: runningGlbUrl,
            source: 'rebel_blob'
          }
        : null
    },
       armatureAnimations: {
      idle: null,

      walking: walkingArmatureGlbUrl
        ? {
            name: 'walking',
            glbUrl: walkingArmatureGlbUrl,
            source: 'rebel_blob',
            animationType: 'armature_only'
          }
        : null,

      running: runningArmatureGlbUrl
        ? {
            name: 'running',
            glbUrl: runningArmatureGlbUrl,
            source: 'rebel_blob',
            animationType: 'armature_only'
          }
        : null,

      jump: null,

      attack: null,

      kick: null
    }
  };

  return {
    activeCharacterVersion: ACTIVE_CHARACTER_VERSION,
    walletAddress,
    collectionKey,
    tokenId,
    rebelId,
    activeForgeBuildId: buildId,
    activeGlbUrl,
    staticGlbUrl,
    riggedGlbUrl,
    walkingGlbUrl,
    runningGlbUrl,
    walkingArmatureGlbUrl,
    runningArmatureGlbUrl,
    glbBlobPath,
    activeCharacterModelType,
    characterBundle,
    activeCharacterSource: 'forge_glb',
    status: 'active_character_selected',
    selectedAt: now,
    updatedAt: now,
    sourceBuildStatus: build.status || null,
    sourceConceptId: build.sourceConceptId || null,
    note: 'This record is the selected Forge character bundle for the landing page and future Village character handoff.'
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
