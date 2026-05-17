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

function getRunningGlbUrl(buildRecord, overrideUrl) {
  return (
    overrideUrl ||
    buildRecord?.rigging?.response?.result?.basic_animations?.running_glb_url ||
    null
  );
}

function buildRunningBlobPath(buildRecord) {
  const collectionKey = sanitizePathPart(buildRecord.collectionKey, 'battle-for-colony');
  const tokenId = sanitizePathPart(buildRecord.tokenId || buildRecord.rebelId, 'unknown-token');
  const buildId = sanitizePathPart(buildRecord.buildId, `build-${Date.now()}`);

  return `forge/3d-builds/${collectionKey}/${tokenId}/${buildId}-running.glb`;
}

async function fetchGlbAsBuffer(glbUrl) {
  const response = await fetch(glbUrl, {
    headers: {
      Accept: 'model/gltf-binary,application/octet-stream,*/*'
    }
  });

  if (!response.ok) {
    throw new Error(`Could not fetch running GLB. Status: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (!buffer.length) {
    throw new Error('Downloaded running GLB is empty');
  }

  if (buffer.length > MAX_GLB_BYTES) {
    throw new Error('Running GLB is too large to store in Forge Blob');
  }

  return buffer;
}

async function updateBuildRecordWithRunning({
  recordKey,
  buildRecord,
  sourceRunningGlbUrl,
  storedRunningGlbUrl,
  runningBlobPath,
  sizeBytes
}) {
  const storedAnimations = {
    ...(buildRecord.output?.storedAnimations || {}),
    running: {
      animationKey: 'running_glb_url',
      sourceAnimationUrl: sourceRunningGlbUrl,
      storedAnimationUrl: storedRunningGlbUrl,
      animationBlobPath: runningBlobPath,
      sizeBytes,
      storedAt: new Date().toISOString()
    }
  };

  const updatedRecord = {
    ...buildRecord,
    updatedAt: new Date().toISOString(),
    rigging: {
      ...(buildRecord.rigging || {}),
      storedAnimations
    },
    output: {
      ...(buildRecord.output || {}),
      storedAnimations,
      runningGlbUrl: storedRunningGlbUrl,
      runningGlbBlobPath: runningBlobPath,
      animationSource: 'rebel_blob'
    },
    nextStep: 'test_running_animation_in_village'
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

    const { buildId, runningGlbUrl } = req.body || {};

    if (!buildId) {
      return res.status(400).json({ ok: false, error: 'Missing buildId' });
    }

    const { recordKey, buildRecord } = await loadBuildRecord(buildId);
    const sourceRunningGlbUrl = getRunningGlbUrl(buildRecord, runningGlbUrl);

    if (!sourceRunningGlbUrl) {
      return res.status(400).json({ ok: false, error: 'Missing running GLB URL' });
    }

    const buffer = await fetchGlbAsBuffer(sourceRunningGlbUrl);
    const pathname = buildRunningBlobPath(buildRecord);

    const blob = await put(pathname, buffer, {
      access: 'public',
      contentType: 'model/gltf-binary',
      addRandomSuffix: false
    });

    const updatedBuildRecord = await updateBuildRecordWithRunning({
      recordKey,
      buildRecord,
      sourceRunningGlbUrl,
      storedRunningGlbUrl: blob.url,
      runningBlobPath: pathname,
      sizeBytes: buffer.length
    });

    return res.status(200).json({
      ok: true,
      stored: true,
      buildId,
      runningGlbUrl: blob.url,
      runningBlobPath: pathname,
      sizeBytes: buffer.length,
      blob,
      buildRecord: updatedBuildRecord,
      message: 'Running animation GLB stored in Rebel Forge Blob.'
    });
  } catch (err) {
    console.error('forge-3d-store-running-glb error:', err);

    return res.status(500).json({
      ok: false,
      error: 'Could not store running animation GLB in Rebel Forge Blob',
      detail: err && err.message ? err.message : 'Unknown error'
    });
  }
}
