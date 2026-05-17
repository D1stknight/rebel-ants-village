import { del } from '@vercel/blob';

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

function getBuildListKey({ collectionKey, tokenId, rebelId }) {
  const safeCollectionKey = collectionKey || 'unknown_collection';
  const safeTokenId = tokenId || rebelId || 'unknown_token';
  return `forge:3d-builds:v1:${safeCollectionKey}:${safeTokenId}`;
}

function getBuildRecordKey(buildId) {
  return `forge:3d-build:v1:${buildId}`;
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

function parseJson(raw) {
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch(e) {
    return null;
  }
}

function readDeletePayload(reqBody) {
  const body = reqBody || {};
  const buildId = body.buildId || body.id || null;
  const collectionKey = body.collectionKey || 'battle_for_colony';
  const tokenId = body.tokenId || null;
  const rebelId = body.rebelId || null;
  const walletAddress = body.walletAddress || body.wallet || null;

  if (!buildId) {
    throw new Error('Missing buildId');
  }

  return {
    buildId: String(buildId),
    collectionKey,
    tokenId,
    rebelId,
    walletAddress
  };
}

function isSafeBuildBlobPath(pathname) {
  return (
    typeof pathname === 'string' &&
    pathname.startsWith('forge/3d-builds/') &&
    !pathname.includes('..') &&
    !pathname.startsWith('/')
  );
}

function addBlobPath(targets, pathname) {
  if (isSafeBuildBlobPath(pathname)) {
    targets.add(pathname);
  }
}

function collectBuildBlobPaths(buildRecord) {
  const targets = new Set();
  const output = buildRecord?.output || {};
  const rigging = buildRecord?.rigging || {};
  const storedAnimations = {
    ...(rigging.storedAnimations || {}),
    ...(output.storedAnimations || {})
  };
  const storedArmatureAnimations = {
    ...(rigging.storedArmatureAnimations || {}),
    ...(output.storedArmatureAnimations || {})
  };

  addBlobPath(targets, output.glbBlobPath);
  addBlobPath(targets, output.riggedGlbBlobPath);
  addBlobPath(targets, output.walkingGlbBlobPath);
  addBlobPath(targets, output.runningGlbBlobPath);
  addBlobPath(targets, output.prototypeGlbBlobPath);
  addBlobPath(targets, output.riggedPrototypePath);
  addBlobPath(targets, rigging.riggedGlbBlobPath);

  Object.values(storedAnimations).forEach((animation) => {
    addBlobPath(targets, animation?.animationBlobPath);
  });

  Object.values(storedArmatureAnimations).forEach((animation) => {
    addBlobPath(targets, animation?.animationBlobPath);
  });

  return [...targets];
}

function activeCharacterUsesBuild(activeCharacter, buildId) {
  if (!activeCharacter || !buildId) return false;

  return (
    activeCharacter.activeForgeBuildId === buildId ||
    activeCharacter.characterBundle?.sourceBuildId === buildId
  );
}

async function loadActiveCharacters(deleteRequest, buildRecord) {
  const collectionKey = deleteRequest.collectionKey || buildRecord?.collectionKey || 'battle_for_colony';
  const tokenId = deleteRequest.tokenId || buildRecord?.tokenId || null;
  const rebelId = deleteRequest.rebelId || buildRecord?.rebelId || null;
  const walletAddress = deleteRequest.walletAddress || buildRecord?.walletAddress || null;

  const selectedKey = getActiveCharacterByWalletKey(walletAddress);
  const tokenKey = getActiveCharacterKey({
    walletAddress,
    collectionKey,
    tokenId,
    rebelId
  });

  const results = await redisPipeline([
    ['GET', selectedKey],
    ['GET', tokenKey]
  ]);

  return {
    selectedKey,
    tokenKey,
    selectedActiveCharacter: parseJson(results?.[0]?.result || null),
    tokenActiveCharacter: parseJson(results?.[1]?.result || null)
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
          message: 'Redis env vars are not configured.'
        }
      });
    }

    const recordKey = getBuildRecordKey(deleteRequest.buildId);
    const recordResult = await redisPipeline([
      ['GET', recordKey]
    ]);
    const buildRecord = parseJson(recordResult?.[0]?.result || null);

    if (!buildRecord) {
      return res.status(404).json({
        ok: false,
        error: 'Build record not found',
        buildId: deleteRequest.buildId
      });
    }

    const activeCharacters = await loadActiveCharacters(deleteRequest, buildRecord);
    const isActiveBuild =
      activeCharacterUsesBuild(activeCharacters.selectedActiveCharacter, deleteRequest.buildId) ||
      activeCharacterUsesBuild(activeCharacters.tokenActiveCharacter, deleteRequest.buildId);
    const blobPaths = collectBuildBlobPaths(buildRecord);
    const deletedBlobPaths = [];
    const blobDeleteErrors = [];

    if (!isActiveBuild && process.env.BLOB_READ_WRITE_TOKEN) {
      for (const blobPath of blobPaths) {
        try {
          await del(blobPath);
          deletedBlobPaths.push(blobPath);
        } catch(e) {
          blobDeleteErrors.push({
            blobPath,
            error: e && e.message ? e.message : 'Unknown Blob delete error'
          });
        }
      }
    }

    const listKey = getBuildListKey({
      collectionKey: buildRecord.collectionKey || deleteRequest.collectionKey,
      tokenId: buildRecord.tokenId || deleteRequest.tokenId,
      rebelId: buildRecord.rebelId || deleteRequest.rebelId
    });
    const deleteResults = await redisPipeline([
      ['DEL', recordKey],
      ['LREM', listKey, 0, deleteRequest.buildId]
    ]);

    return res.status(200).json({
      ok: true,
      deleted: true,
      buildId: deleteRequest.buildId,
      activeBuild: isActiveBuild,
      blobPaths,
      deletedBlobPaths,
      skippedBlobDeleteReason: isActiveBuild
        ? 'Build is currently active. Blob files were not deleted.'
        : !process.env.BLOB_READ_WRITE_TOKEN
          ? 'Missing BLOB_READ_WRITE_TOKEN. Build metadata was deleted, but Blob files were not deleted.'
          : null,
      blobDeleteErrors,
      skippedConceptImageDeleteReason: 'Source/concept images are shared with saved concepts and were not deleted by build cleanup.',
      storageResult: {
        storage: 'redis',
        recordKey,
        listKey,
        delResult: deleteResults?.[0]?.result ?? null,
        lremResult: deleteResults?.[1]?.result ?? null
      }
    });
  } catch (err) {
    console.error('forge-3d-build-delete error:', err);

    return res.status(500).json({
      ok: false,
      error: 'Could not delete Forge 3D build',
      detail: err && err.message ? err.message : 'Unknown error'
    });
  }
}
