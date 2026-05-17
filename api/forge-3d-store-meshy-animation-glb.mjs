import { put } from '@vercel/blob';

const MAX_GLB_BYTES = 120 * 1024 * 1024;

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

function getMeshyAnimationGlbUrl(buildRecord, animationKey) {
  return (
    buildRecord?.output?.meshyAnimations?.[animationKey]?.animationGlbUrl ||
    buildRecord?.rigging?.animationTasks?.[animationKey]?.response?.result?.animation_glb_url ||
    buildRecord?.rigging?.animationTasks?.[animationKey]?.response?.animation_glb_url ||
    null
  );
}

function buildAnimationBlobPath(buildRecord, animationKey) {
  const collectionKey = sanitizePathPart(buildRecord.collectionKey, 'battle-for-colony');
  const tokenId = sanitizePathPart(buildRecord.tokenId || buildRecord.rebelId, 'unknown-token');
  const buildId = sanitizePathPart(buildRecord.buildId, `build-${Date.now()}`);
  const safeAnimationKey = sanitizePathPart(animationKey, 'animation');

  return `forge/3d-builds/${collectionKey}/${tokenId}/${buildId}-${safeAnimationKey}.glb`;
}

async function fetchGlbAsBuffer(glbUrl, animationKey) {
  const response = await fetch(glbUrl, {
    headers: {
      Accept: 'model/gltf-binary,application/octet-stream,*/*'
    }
  });

  if (!response.ok) {
    throw new Error(`Could not fetch ${animationKey} Meshy animation GLB. Status: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (!buffer.length) {
    throw new Error(`Downloaded ${animationKey} Meshy animation GLB is empty`);
  }

  if (buffer.length > MAX_GLB_BYTES) {
    throw new Error(`${animationKey} Meshy animation GLB is too large to store in Forge Blob`);
  }

  return buffer;
}

function buildOutputGlbField(animationKey) {
  return `${animationKey}GlbUrl`;
}

function buildOutputBlobPathField(animationKey) {
  return `${animationKey}GlbBlobPath`;
}

async function updateBuildRecordWithStoredAnimation({
  recordKey,
  buildRecord,
  animationKey,
  sourceAnimationGlbUrl,
  storedAnimationGlbUrl,
  animationBlobPath,
  sizeBytes
}) {
  const now = new Date().toISOString();
  const storedAnimationRecord = {
    animationKey,
    sourceAnimationUrl: sourceAnimationGlbUrl,
    storedAnimationUrl: storedAnimationGlbUrl,
    animationBlobPath,
    sizeBytes,
    source: 'rebel_blob',
    storedAt: now
  };

  const storedAnimations = {
    ...(buildRecord.output?.storedAnimations || {}),
    [animationKey]: storedAnimationRecord
  };

  const riggingStoredAnimations = {
    ...(buildRecord.rigging?.storedAnimations || {}),
    [animationKey]: storedAnimationRecord
  };

  const updatedRecord = {
    ...buildRecord,
    updatedAt: now,
    rigging: {
      ...(buildRecord.rigging || {}),
      storedAnimations: riggingStoredAnimations
    },
    output: {
      ...(buildRecord.output || {}),
      storedAnimations,
      [buildOutputGlbField(animationKey)]: storedAnimationGlbUrl,
      [buildOutputBlobPathField(animationKey)]: animationBlobPath,
      animationSource: 'rebel_blob'
    },
    nextStep: `test_${animationKey}_animation_in_forge`
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

    const { buildId, animationKey } = req.body || {};
    const normalizedAnimationKey = String(animationKey || '').trim();

    if (!buildId) {
      return res.status(400).json({ ok: false, error: 'Missing buildId' });
    }

    if (!normalizedAnimationKey) {
      return res.status(400).json({ ok: false, error: 'Missing animationKey' });
    }

    const { recordKey, buildRecord } = await loadBuildRecord(buildId);
    const sourceAnimationGlbUrl = getMeshyAnimationGlbUrl(buildRecord, normalizedAnimationKey);

    if (!sourceAnimationGlbUrl) {
      return res.status(400).json({ ok: false, error: `Missing Meshy ${normalizedAnimationKey} animation GLB URL` });
    }

    const buffer = await fetchGlbAsBuffer(sourceAnimationGlbUrl, normalizedAnimationKey);
    const pathname = buildAnimationBlobPath(buildRecord, normalizedAnimationKey);

    const blob = await put(pathname, buffer, {
      access: 'public',
      contentType: 'model/gltf-binary',
      addRandomSuffix: false
    });

    const updatedBuildRecord = await updateBuildRecordWithStoredAnimation({
      recordKey,
      buildRecord,
      animationKey: normalizedAnimationKey,
      sourceAnimationGlbUrl,
      storedAnimationGlbUrl: blob.url,
      animationBlobPath: pathname,
      sizeBytes: buffer.length
    });

    return res.status(200).json({
      ok: true,
      stored: true,
      buildId,
      animationKey: normalizedAnimationKey,
      animationGlbUrl: blob.url,
      animationBlobPath: pathname,
      sizeBytes: buffer.length,
      blob,
      buildRecord: updatedBuildRecord,
      message: `Meshy ${normalizedAnimationKey} animation GLB stored in Rebel Forge Blob.`
    });
  } catch (err) {
    console.error('forge-3d-store-meshy-animation-glb error:', err);

    return res.status(500).json({
      ok: false,
      error: 'Could not store Meshy animation GLB in Rebel Forge Blob',
      detail: err && err.message ? err.message : 'Unknown error'
    });
  }
}
