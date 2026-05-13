import { put } from '@vercel/blob';

const MAX_GLB_BYTES = 80 * 1024 * 1024;

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

function getSourceGlbUrl(buildRecord, overrideUrl) {
  return (
    overrideUrl ||
    buildRecord?.output?.glbUrl ||
    buildRecord?.engine?.glbUrl ||
    buildRecord?.engine?.modelUrls?.glb ||
    null
  );
}

function buildGlbBlobPath(buildRecord) {
  const collectionKey = sanitizePathPart(buildRecord.collectionKey, 'battle-for-colony');
  const tokenId = sanitizePathPart(buildRecord.tokenId || buildRecord.rebelId, 'unknown-token');
  const buildId = sanitizePathPart(buildRecord.buildId, `build-${Date.now()}`);

  return `forge/3d-builds/${collectionKey}/${tokenId}/${buildId}.glb`;
}

async function fetchGlbAsBuffer(glbUrl) {
  const response = await fetch(glbUrl, {
    headers: {
      Accept: 'model/gltf-binary,application/octet-stream,*/*'
    }
  });

  if (!response.ok) {
    throw new Error(`Could not fetch GLB. Status: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (!buffer.length) {
    throw new Error('Downloaded GLB is empty');
  }

  if (buffer.length > MAX_GLB_BYTES) {
    throw new Error('GLB is too large to store in Forge Blob');
  }

  return buffer;
}

async function updateBuildRecordWithStoredGlb({ recordKey, buildRecord, sourceGlbUrl, storedGlbUrl, glbBlobPath, sizeBytes }) {
  const updatedRecord = {
    ...buildRecord,
    status: 'completed_stored_in_rebel_blob',
    updatedAt: new Date().toISOString(),
    output: {
      ...(buildRecord.output || {}),
      source: 'rebel_blob',
      meshyGlbUrl: sourceGlbUrl,
      glbUrl: storedGlbUrl,
      rebelGlbUrl: storedGlbUrl,
      glbBlobPath,
      sizeBytes
    },
    engine: {
      ...(buildRecord.engine || {}),
      glbUrl: storedGlbUrl,
      meshyGlbUrl: sourceGlbUrl,
      storedInRebelBlob: true
    },
    nextStep: 'preview_or_use_glb_in_village'
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
      return res.status(500).json({
        ok: false,
        error: 'Missing BLOB_READ_WRITE_TOKEN'
      });
    }

    const { buildId, glbUrl } = req.body || {};

    if (!buildId) {
      return res.status(400).json({ ok: false, error: 'Missing buildId' });
    }

    const { recordKey, buildRecord } = await loadBuildRecord(buildId);
    const sourceGlbUrl = getSourceGlbUrl(buildRecord, glbUrl);

    if (!sourceGlbUrl) {
      return res.status(400).json({ ok: false, error: 'Missing source GLB URL' });
    }

    const buffer = await fetchGlbAsBuffer(sourceGlbUrl);
    const pathname = buildGlbBlobPath(buildRecord);

    const blob = await put(pathname, buffer, {
      access: 'public',
      contentType: 'model/gltf-binary',
      addRandomSuffix: false
    });

    const updatedBuildRecord = await updateBuildRecordWithStoredGlb({
      recordKey,
      buildRecord,
      sourceGlbUrl,
      storedGlbUrl: blob.url,
      glbBlobPath: pathname,
      sizeBytes: buffer.length
    });

    return res.status(200).json({
      ok: true,
      stored: true,
      buildId,
      glbUrl: blob.url,
      rebelGlbUrl: blob.url,
      glbBlobPath: pathname,
      sizeBytes: buffer.length,
      blob,
      buildRecord: updatedBuildRecord,
      message: 'GLB stored in Rebel Forge Blob.'
    });
  } catch (err) {
    console.error('forge-3d-store-glb error:', err);

    return res.status(500).json({
      ok: false,
      error: 'Could not store GLB in Rebel Forge Blob',
      detail: err && err.message ? err.message : 'Unknown error'
    });
  }
}
