import { put } from '@vercel/blob';

const MAX_GLB_BYTES = 120 * 1024 * 1024;

const SUPPORTED_ARMATURE_KEYS = {
  walking_armature_glb_url: {
    animationName: 'walking_armature',
    sourcePath: ['rigging', 'response', 'result', 'basic_animations', 'walking_armature_glb_url']
  },
  running_armature_glb_url: {
    animationName: 'running_armature',
    sourcePath: ['rigging', 'response', 'result', 'basic_animations', 'running_armature_glb_url']
  }
};

function getRedisConfig() {
  return {
    url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '',
    token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || ''
  };
}

function getBuildRecordKey(buildId) {
  return `forge:3d-build:v1:${buildId}`;
}

function sanitizePathPart(value, fallback) {
  return String(value || fallback || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || fallback || 'unknown';
}

function readNestedValue(source, path) {
  return path.reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : null;
  }, source);
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

async function loadBuildRecord(buildId) {
  const recordKey = getBuildRecordKey(buildId);
  const recordResult = await redisPipeline([
    ['GET', recordKey]
  ]);

  const rawRecord = recordResult?.[0]?.result || null;

  if (!rawRecord) {
    throw new Error('Build record not found');
  }

  return {
    recordKey,
    buildRecord: JSON.parse(rawRecord)
  };
}

function getSourceArmatureGlbUrl(buildRecord, animationKey, overrideUrl) {
  if (overrideUrl) return overrideUrl;

  const config = SUPPORTED_ARMATURE_KEYS[animationKey];

  if (!config) {
    return null;
  }

  return readNestedValue(buildRecord, config.sourcePath);
}

function buildArmatureBlobPath(buildRecord, animationKey) {
  const config = SUPPORTED_ARMATURE_KEYS[animationKey];
  const animationName = config?.animationName || 'armature_animation';

  const collectionKey = sanitizePathPart(buildRecord.collectionKey, 'battle-for-colony');
  const tokenId = sanitizePathPart(buildRecord.tokenId || buildRecord.rebelId, 'unknown-token');
  const buildId = sanitizePathPart(buildRecord.buildId, `build-${Date.now()}`);

  return `forge/3d-builds/${collectionKey}/${tokenId}/${buildId}-${animationName}.glb`;
}

async function fetchGlbAsBuffer(glbUrl) {
  const response = await fetch(glbUrl, {
    headers: {
      Accept: 'model/gltf-binary,application/octet-stream,*/*'
    }
  });

  if (!response.ok) {
    throw new Error(`Could not fetch armature animation GLB. Status: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (!buffer.length) {
    throw new Error('Downloaded armature animation GLB is empty');
  }

  if (buffer.length > MAX_GLB_BYTES) {
    throw new Error('Armature animation GLB is too large to store in Forge Blob');
  }

  return buffer;
}

async function updateBuildRecordWithArmatureAnimation({
  recordKey,
  buildRecord,
  animationKey,
  sourceArmatureGlbUrl,
  storedArmatureGlbUrl,
  armatureBlobPath,
  sizeBytes
}) {
  const config = SUPPORTED_ARMATURE_KEYS[animationKey];
  const animationName = config.animationName;

  const storedArmatureAnimations = {
    ...(buildRecord.output?.storedArmatureAnimations || buildRecord.rigging?.storedArmatureAnimations || {})
  };

  storedArmatureAnimations[animationName] = {
    animationKey,
    sourceAnimationUrl: sourceArmatureGlbUrl,
    storedAnimationUrl: storedArmatureGlbUrl,
    animationBlobPath: armatureBlobPath,
    sizeBytes,
    storedAt: new Date().toISOString()
  };

  const updatedRecord = {
    ...buildRecord,
    updatedAt: new Date().toISOString(),
    rigging: {
      ...(buildRecord.rigging || {}),
      storedArmatureAnimations
    },
    output: {
      ...(buildRecord.output || {}),
      storedArmatureAnimations,
      armatureAnimationSource: 'rebel_blob'
    },
    nextStep: 'inspect_armature_animation_glb_in_village'
  };

  await redisPipeline([
    ['SET', recordKey, JSON.stringify(updatedRecord)]
  ]);

  return updatedRecord;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return res.status(500).json({ ok: false, error: 'Missing BLOB_READ_WRITE_TOKEN' });
    }

    const { buildId, animationKey, armatureGlbUrl } = req.body || {};

    if (!buildId) {
      return res.status(400).json({ ok: false, error: 'Missing buildId' });
    }

    if (!animationKey || !SUPPORTED_ARMATURE_KEYS[animationKey]) {
      return res.status(400).json({
        ok: false,
        error: 'Missing or unsupported animationKey',
        supportedAnimationKeys: Object.keys(SUPPORTED_ARMATURE_KEYS)
      });
    }

    const { recordKey, buildRecord } = await loadBuildRecord(buildId);
    const sourceArmatureGlbUrl = getSourceArmatureGlbUrl(buildRecord, animationKey, armatureGlbUrl);

    if (!sourceArmatureGlbUrl) {
      return res.status(400).json({ ok: false, error: 'Missing armature animation GLB URL' });
    }

    const buffer = await fetchGlbAsBuffer(sourceArmatureGlbUrl);
    const pathname = buildArmatureBlobPath(buildRecord, animationKey);

    const blob = await put(pathname, buffer, {
      access: 'public',
      contentType: 'model/gltf-binary',
      addRandomSuffix: false
    });

    const updatedBuildRecord = await updateBuildRecordWithArmatureAnimation({
      recordKey,
      buildRecord,
      animationKey,
      sourceArmatureGlbUrl,
      storedArmatureGlbUrl: blob.url,
      armatureBlobPath: pathname,
      sizeBytes: buffer.length
    });

    return res.status(200).json({
      ok: true,
      stored: true,
      buildId,
      animationKey,
      animationName: SUPPORTED_ARMATURE_KEYS[animationKey].animationName,
      armatureGlbUrl: blob.url,
      armatureBlobPath: pathname,
      sizeBytes: buffer.length,
      blob,
      buildRecord: updatedBuildRecord,
      message: `${SUPPORTED_ARMATURE_KEYS[animationKey].animationName} GLB stored in Rebel Forge Blob.`
    });
  } catch (err) {
    console.error('forge-3d-store-armature-animation-glb error:', err);

    return res.status(500).json({
      ok: false,
      error: 'Could not store armature animation GLB in Rebel Forge Blob',
      detail: err && err.message ? err.message : 'Unknown error'
    });
  }
}
