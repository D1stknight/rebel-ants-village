const MESHY_RIGGING_URL = 'https://api.meshy.ai/openapi/v1/rigging';

function getRedisConfig() {
  return {
    url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '',
    token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || ''
  };
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

function getRigSourceGlbUrl(buildRecord, overrideUrl) {
  return (
    overrideUrl ||
    buildRecord?.output?.rebelGlbUrl ||
    buildRecord?.output?.glbUrl ||
    buildRecord?.engine?.glbUrl ||
    null
  );
}

async function saveRigTaskToBuild({ recordKey, buildRecord, rigTaskId, meshyRigRequest, meshyRigResponse }) {
  const updatedRecord = {
    ...buildRecord,
    status: 'submitted_to_meshy_rigging',
    updatedAt: new Date().toISOString(),
    rigging: {
      provider: 'meshy',
      taskId: rigTaskId,
      status: 'submitted',
      request: meshyRigRequest,
      response: meshyRigResponse,
      submittedAt: new Date().toISOString()
    },
    nextStep: 'poll_meshy_rigging_status'
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
    const apiKey = process.env.MESHY_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ ok: false, error: 'Missing MESHY_API_KEY' });
    }

    const { buildId, glbUrl, heightMeters } = req.body || {};

    if (!buildId) {
      return res.status(400).json({ ok: false, error: 'Missing buildId' });
    }

    const { recordKey, buildRecord } = await loadBuildRecord(buildId);
    const modelUrl = getRigSourceGlbUrl(buildRecord, glbUrl);

    if (!modelUrl) {
      return res.status(400).json({ ok: false, error: 'Missing GLB URL for rigging' });
    }

    const meshyRigRequest = {
      model_url: modelUrl,
      height_meters: Number(heightMeters || 1.7)
    };

    const meshyResponse = await fetch(MESHY_RIGGING_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(meshyRigRequest)
    });

    const meshyData = await meshyResponse.json();

    if (!meshyResponse.ok) {
      console.error('Meshy rig create error:', meshyData);
      throw new Error(meshyData?.message || meshyData?.error || `Meshy rig create failed with status ${meshyResponse.status}`);
    }

    const rigTaskId = meshyData?.result || meshyData?.id || meshyData?.task_id || null;

    if (!rigTaskId) {
      throw new Error('Meshy did not return a rigging task ID');
    }

    const updatedBuildRecord = await saveRigTaskToBuild({
      recordKey,
      buildRecord,
      rigTaskId,
      meshyRigRequest,
      meshyRigResponse: meshyData
    });

    return res.status(200).json({
      ok: true,
      provider: 'meshy',
      buildId,
      rigTaskId,
      meshyRigRequest,
      meshyRigResponse: meshyData,
      buildRecord: updatedBuildRecord,
      message: 'Meshy rigging task started.'
    });
  } catch (err) {
    console.error('forge-3d-engine-meshy-rig-create error:', err);

    return res.status(500).json({
      ok: false,
      error: 'Could not start Meshy rigging task',
      detail: err && err.message ? err.message : 'Unknown error'
    });
  }
}
