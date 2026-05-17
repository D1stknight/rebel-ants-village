import { NodeIO } from '@gltf-transform/core';
import { put } from '@vercel/blob';

const MAX_GLB_BYTES = 120 * 1024 * 1024;

const SOURCE_TO_REBEL_BONE_MAP = {
  Hips: 'mixamorig_Hips',
  Spine: 'mixamorig_Spine',
  Spine01: 'mixamorig_Spine1',
  Spine02: 'mixamorig_Spine2',
  neck: 'mixamorig_Neck',
  Head: 'mixamorig_Head',
  head_end: 'mixamorig_HeadTop_End',
  LeftShoulder: 'mixamorig_LeftShoulder',
  LeftArm: 'mixamorig_LeftArm',
  LeftForeArm: 'mixamorig_LeftForeArm',
  LeftHand: 'mixamorig_LeftHand',
  RightShoulder: 'mixamorig_RightShoulder',
  RightArm: 'mixamorig_RightArm',
  RightForeArm: 'mixamorig_RightForeArm',
  RightHand: 'mixamorig_RightHand',
  LeftUpLeg: 'mixamorig_LeftUpLeg',
  LeftLeg: 'mixamorig_LeftLeg',
  LeftFoot: 'mixamorig_LeftFoot',
  LeftToeBase: 'mixamorig_LeftToeBase',
  RightUpLeg: 'mixamorig_RightUpLeg',
  RightLeg: 'mixamorig_RightLeg',
  RightFoot: 'mixamorig_RightFoot',
  RightToeBase: 'mixamorig_RightToeBase'
};

function getRedisConfig() {
  return {
    url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '',
    token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || ''
  };
}

function sanitizePathPart(value, fallback) {
  return String(value || fallback || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || fallback || 'unknown';
}

function getBuildRecordKey(buildId) {
  return `forge:3d-build:v1:${buildId}`;
}

async function redisPipeline(commands) {
  const { url, token } = getRedisConfig();

  if (!url || !token) throw new Error('Redis is not configured');

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
  const result = await redisPipeline([['GET', recordKey]]);
  const rawRecord = result?.[0]?.result || null;

  if (!rawRecord) throw new Error('Build record not found');

  return { recordKey, buildRecord: JSON.parse(rawRecord) };
}

function getSourceGlbUrl({ body, buildRecord }) {
  return (
    body.sourceGlbUrl ||
    body.glbUrl ||
    buildRecord?.output?.riggedGlbUrl ||
    buildRecord?.output?.riggedRebelGlbUrl ||
    buildRecord?.rigging?.riggedGlbUrl ||
    buildRecord?.rigging?.riggedRebelGlbUrl ||
    buildRecord?.rigging?.response?.result?.rigged_character_glb_url ||
    null
  );
}

async function fetchGlbAsBuffer(glbUrl) {
  const response = await fetch(glbUrl, {
    headers: { Accept: 'model/gltf-binary,application/octet-stream,*/*' }
  });

  if (!response.ok) throw new Error(`Could not fetch source GLB. Status: ${response.status}`);

  const buffer = Buffer.from(await response.arrayBuffer());

  if (!buffer.length) throw new Error('Downloaded source GLB is empty');
  if (buffer.length > MAX_GLB_BYTES) throw new Error('Source GLB is too large');

  return buffer;
}

function renameMappedNodes(document) {
  const nodes = document.getRoot().listNodes();
  const nodesByName = new Map(nodes.map((node) => [node.getName(), node]));
  const renamed = [];
  const skipped = [];

  Object.entries(SOURCE_TO_REBEL_BONE_MAP).forEach(([sourceName, rebelName]) => {
    const node = nodesByName.get(sourceName);

    if (!node) {
      skipped.push({ sourceName, rebelName, reason: 'source_node_not_found' });
      return;
    }

    node.setName(rebelName);
    renamed.push({ sourceName, rebelName });
  });

  return { renamed, skipped };
}

function countSkinJoints(document) {
  const skins = document.getRoot().listSkins ? document.getRoot().listSkins() : [];
  const skin = skins[0] || null;
  const joints = skin && typeof skin.listJoints === 'function' ? skin.listJoints() : [];

  return {
    skinCount: skins.length,
    hadSkin: Boolean(skin),
    jointCount: joints.length,
    jointNames: joints.map((joint) => joint.getName())
  };
}

function buildOutputPath({ buildRecord, buildId }) {
  const collectionKey = sanitizePathPart(buildRecord?.collectionKey, 'battle-for-colony');
  const tokenId = sanitizePathPart(buildRecord?.tokenId || buildRecord?.rebelId, 'unknown-token');
  const safeBuildId = sanitizePathPart(buildId || buildRecord?.buildId, `build-${Date.now()}`);

  return `forge/3d-builds/${collectionKey}/${tokenId}/${safeBuildId}-rebel-standard-rename-only-prototype.glb`;
}

async function updateBuildRecord({ recordKey, buildRecord, prototypeUrl, prototypePath, report }) {
  const updatedRecord = {
    ...buildRecord,
    updatedAt: new Date().toISOString(),
    rigBuilder: {
      ...(buildRecord.rigBuilder || {}),
      rebelStandardRenameOnlyPrototype: {
        version: 'v0_rename_only',
        prototypeUrl,
        prototypePath,
        report,
        createdAt: new Date().toISOString()
      }
    },
    output: {
      ...(buildRecord.output || {}),
      rebelStandardRenameOnlyPrototypeGlbUrl: prototypeUrl,
      rebelStandardRenameOnlyPrototypeGlbPath: prototypePath
    }
  };

  await redisPipeline([['SET', recordKey, JSON.stringify(updatedRecord)]]);

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

    const body = req.body || {};
    const buildId = body.buildId || null;

    if (!buildId && !body.sourceGlbUrl && !body.glbUrl) {
      return res.status(400).json({ ok: false, error: 'Missing buildId or sourceGlbUrl' });
    }

    let recordKey = null;
    let buildRecord = {};

    if (buildId) {
      const loaded = await loadBuildRecord(buildId);
      recordKey = loaded.recordKey;
      buildRecord = loaded.buildRecord;
    }

    const sourceGlbUrl = getSourceGlbUrl({ body, buildRecord });
    if (!sourceGlbUrl) return res.status(400).json({ ok: false, error: 'Missing source GLB URL' });

    const sourceBuffer = await fetchGlbAsBuffer(sourceGlbUrl);
    const io = new NodeIO();
    const document = await io.readBinary(sourceBuffer);

    const skinBefore = countSkinJoints(document);
    const renameReport = renameMappedNodes(document);
    const skinAfter = countSkinJoints(document);

    const outputBuffer = Buffer.from(await io.writeBinary(document));
    const prototypePath = buildOutputPath({ buildRecord, buildId });

    const blob = await put(prototypePath, outputBuffer, {
      access: 'public',
      contentType: 'model/gltf-binary',
      addRandomSuffix: false
    });

    const report = {
      version: 'v0_rename_only',
      warning: 'Prototype only. This renames existing Meshy skeleton nodes to Rebel/Mixamo-style names. It does not add missing finger/toe bones or change skin weights.',
      sourceGlbUrl,
      renamedCount: renameReport.renamed.length,
      skippedCount: renameReport.skipped.length,
      renameReport,
      skinBefore,
      skinAfter
    };

    let updatedBuildRecord = null;
    if (recordKey) {
      updatedBuildRecord = await updateBuildRecord({
        recordKey,
        buildRecord,
        prototypeUrl: blob.url,
        prototypePath,
        report
      });
    }

    return res.status(200).json({
      ok: true,
      buildId: buildId || buildRecord?.buildId || null,
      sourceGlbUrl,
      prototypeGlbUrl: blob.url,
      prototypeGlbPath: prototypePath,
      blob,
      report,
      buildRecord: updatedBuildRecord,
      message: 'Rename-only Rebel rig prototype GLB created and stored.'
    });
  } catch (err) {
    console.error('forge-rig-builder-rename-only-prototype error:', err);
    return res.status(500).json({
      ok: false,
      error: 'Could not create rename-only Rebel rig prototype GLB',
      detail: err && err.message ? err.message : 'Unknown error'
    });
  }
}
