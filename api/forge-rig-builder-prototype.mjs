import { NodeIO } from '@gltf-transform/core';
import { put } from '@vercel/blob';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const MAX_GLB_BYTES = 120 * 1024 * 1024;

const REBEL_STANDARD_BONE_NAMES = [
  'mixamorig_Hips',
  'mixamorig_Spine',
  'mixamorig_Spine1',
  'mixamorig_Spine2',
  'mixamorig_Neck',
  'mixamorig_Head',
  'mixamorig_HeadTop_End',
  'mixamorig_LeftShoulder',
  'mixamorig_LeftArm',
  'mixamorig_LeftForeArm',
  'mixamorig_LeftHand',
  'mixamorig_LeftHandThumb1',
  'mixamorig_LeftHandThumb2',
  'mixamorig_LeftHandThumb3',
  'mixamorig_LeftHandThumb4',
  'mixamorig_LeftHandIndex1',
  'mixamorig_LeftHandIndex2',
  'mixamorig_LeftHandIndex3',
  'mixamorig_LeftHandIndex4',
  'mixamorig_LeftHandMiddle1',
  'mixamorig_LeftHandMiddle2',
  'mixamorig_LeftHandMiddle3',
  'mixamorig_LeftHandMiddle4',
  'mixamorig_LeftHandRing1',
  'mixamorig_LeftHandRing2',
  'mixamorig_LeftHandRing3',
  'mixamorig_LeftHandRing4',
  'mixamorig_LeftHandPinky1',
  'mixamorig_LeftHandPinky2',
  'mixamorig_LeftHandPinky3',
  'mixamorig_LeftHandPinky4',
  'mixamorig_RightShoulder',
  'mixamorig_RightArm',
  'mixamorig_RightForeArm',
  'mixamorig_RightHand',
  'mixamorig_RightHandThumb1',
  'mixamorig_RightHandThumb2',
  'mixamorig_RightHandThumb3',
  'mixamorig_RightHandThumb4',
  'mixamorig_RightHandIndex1',
  'mixamorig_RightHandIndex2',
  'mixamorig_RightHandIndex3',
  'mixamorig_RightHandIndex4',
  'mixamorig_RightHandMiddle1',
  'mixamorig_RightHandMiddle2',
  'mixamorig_RightHandMiddle3',
  'mixamorig_RightHandMiddle4',
  'mixamorig_RightHandRing1',
  'mixamorig_RightHandRing2',
  'mixamorig_RightHandRing3',
  'mixamorig_RightHandRing4',
  'mixamorig_RightHandPinky1',
  'mixamorig_RightHandPinky2',
  'mixamorig_RightHandPinky3',
  'mixamorig_RightHandPinky4',
  'mixamorig_LeftUpLeg',
  'mixamorig_LeftLeg',
  'mixamorig_LeftFoot',
  'mixamorig_LeftToeBase',
  'mixamorig_LeftToe_End',
  'mixamorig_RightUpLeg',
  'mixamorig_RightLeg',
  'mixamorig_RightFoot',
  'mixamorig_RightToeBase',
  'mixamorig_RightToe_End'
];

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

const FINGER_TYPES = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'];

const FINGER_OFFSETS = {
  Thumb: [0.08, -0.02, 0.08],
  Index: [0.04, 0, 0.12],
  Middle: [0, 0, 0.14],
  Ring: [-0.04, 0, 0.12],
  Pinky: [-0.08, -0.01, 0.10]
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

function getSourceGlbUrl({ body, buildRecord }) {
  return (
    body.sourceGlbUrl ||
    body.glbUrl ||
    buildRecord?.output?.riggedGlbUrl ||
    buildRecord?.output?.riggedRebelGlbUrl ||
    buildRecord?.rigging?.riggedGlbUrl ||
    buildRecord?.rigging?.riggedRebelGlbUrl ||
    buildRecord?.rigging?.response?.result?.rigged_character_glb_url ||
    buildRecord?.output?.rebelGlbUrl ||
    buildRecord?.output?.glbUrl ||
    buildRecord?.engine?.glbUrl ||
    null
  );
}

async function fetchGlbAsBuffer(glbUrl) {
  const normalizedLocalPath =
    typeof glbUrl === 'string' && glbUrl.startsWith('/assets/')
      ? glbUrl.slice(1)
      : typeof glbUrl === 'string' && glbUrl.startsWith('assets/')
        ? glbUrl
        : null;

  if (normalizedLocalPath) {
    const localPath = path.join(process.cwd(), normalizedLocalPath);
    const buffer = await readFile(localPath);

    if (!buffer.length) {
      throw new Error('Local source GLB is empty');
    }

    if (buffer.length > MAX_GLB_BYTES) {
      throw new Error('Local source GLB is too large for prototype rig builder');
    }

    return buffer;
  }

  const response = await fetch(glbUrl, {
    headers: {
      Accept: 'model/gltf-binary,application/octet-stream,*/*'
    }
  });

  if (!response.ok) {
    throw new Error(`Could not fetch source GLB. Status: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (!buffer.length) {
    throw new Error('Downloaded source GLB is empty');
  }

  if (buffer.length > MAX_GLB_BYTES) {
    throw new Error('Source GLB is too large for prototype rig builder');
  }

  return buffer;
}

function listNodesByName(document) {
  return new Map(
    document.getRoot().listNodes().map((node) => [node.getName(), node])
  );
}

function listSkins(document) {
  return document.getRoot().listSkins ? document.getRoot().listSkins() : [];
}

function getPrimarySkin(document) {
  return listSkins(document)[0] || null;
}

function getSkinJoints(skin) {
  if (!skin || typeof skin.listJoints !== 'function') return [];
  return skin.listJoints();
}

function addJointToSkin(skin, node) {
  if (!skin || !node || typeof skin.addJoint !== 'function') return false;

  const existing = getSkinJoints(skin);

  if (existing.includes(node)) return false;

  skin.addJoint(node);
  return true;
}

function renameMappedBones(document) {
  const nodesByName = listNodesByName(document);
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

function getOrCreateNode(document, nodesByName, boneName, parentNode, translation) {
  const existing = nodesByName.get(boneName);

  if (existing) {
    return { node: existing, created: false };
  }

  const node = document.createNode(boneName);
  node.setTranslation(translation || [0, 0, 0]);

  if (parentNode && typeof parentNode.addChild === 'function') {
    parentNode.addChild(node);
  }

  nodesByName.set(boneName, node);

  return { node, created: true };
}

function createFingerChains(document, skin, nodesByName, side) {
  const created = [];
  const skipped = [];
  const handName = `mixamorig_${side}Hand`;
  const handNode = nodesByName.get(handName);
  const sideSign = side === 'Left' ? 1 : -1;

  if (!handNode) {
    return {
      created,
      skipped: [{ side, boneName: handName, reason: 'hand_anchor_not_found' }]
    };
  }

  FINGER_TYPES.forEach((fingerType) => {
    let parentNode = handNode;
    const baseOffset = FINGER_OFFSETS[fingerType] || [0, 0, 0.12];

    for (let index = 1; index <= 4; index++) {
      const boneName = `mixamorig_${side}Hand${fingerType}${index}`;
      const translation = [
        Number(((baseOffset[0] * sideSign) + (sideSign * 0.006 * (index - 1))).toFixed(5)),
        Number((baseOffset[1] - 0.004 * index).toFixed(5)),
        Number((baseOffset[2] + 0.045 * index).toFixed(5))
      ];

      const { node, created: wasCreated } = getOrCreateNode(document, nodesByName, boneName, parentNode, translation);
      addJointToSkin(skin, node);

      if (wasCreated) {
        created.push({ boneName, parentBoneName: parentNode.getName(), translation });
      } else {
        skipped.push({ boneName, reason: 'already_exists' });
      }

      parentNode = node;
    }
  });

  return { created, skipped };
}

function createToeEnds(document, skin, nodesByName) {
  const toeConfigs = [
    {
      sourceParent: 'mixamorig_LeftToeBase',
      boneName: 'mixamorig_LeftToe_End',
      translation: [0, 0, 0.14]
    },
    {
      sourceParent: 'mixamorig_RightToeBase',
      boneName: 'mixamorig_RightToe_End',
      translation: [0, 0, -0.14]
    }
  ];

  const created = [];
  const skipped = [];

  toeConfigs.forEach((config) => {
    const parentNode = nodesByName.get(config.sourceParent);

    if (!parentNode) {
      skipped.push({ boneName: config.boneName, reason: 'toe_anchor_not_found', sourceParent: config.sourceParent });
      return;
    }

    const { node, created: wasCreated } = getOrCreateNode(document, nodesByName, config.boneName, parentNode, config.translation);
    addJointToSkin(skin, node);

    if (wasCreated) {
      created.push({ boneName: config.boneName, parentBoneName: parentNode.getName(), translation: config.translation });
    } else {
      skipped.push({ boneName: config.boneName, reason: 'already_exists' });
    }
  });

  return { created, skipped };
}

function inspectRebelStandardCoverage(document) {
  const nodeNames = new Set(document.getRoot().listNodes().map((node) => node.getName()));
  const missingBones = REBEL_STANDARD_BONE_NAMES.filter((boneName) => !nodeNames.has(boneName));
  const foundRequiredCount = REBEL_STANDARD_BONE_NAMES.length - missingBones.length;

  return {
    requiredBoneCount: REBEL_STANDARD_BONE_NAMES.length,
    foundRequiredCount,
    missingBones,
    passed: missingBones.length === 0,
    message: missingBones.length === 0
      ? `PASS — ${foundRequiredCount}/${REBEL_STANDARD_BONE_NAMES.length} Rebel Standard node names found.`
      : `FAIL — ${foundRequiredCount}/${REBEL_STANDARD_BONE_NAMES.length} Rebel Standard node names found. Missing ${missingBones.length}.`
  };
}

function buildRiggedPrototypePath({ buildRecord, buildId }) {
  const collectionKey = sanitizePathPart(buildRecord?.collectionKey, 'battle-for-colony');
  const tokenId = sanitizePathPart(buildRecord?.tokenId || buildRecord?.rebelId, 'unknown-token');
  const safeBuildId = sanitizePathPart(buildId || buildRecord?.buildId, `build-${Date.now()}`);

  return `forge/3d-builds/${collectionKey}/${tokenId}/${safeBuildId}-rebel-standard-rig-prototype.glb`;
}

async function updateBuildRecordWithRigPrototype({ recordKey, buildRecord, prototypeUrl, prototypePath, report }) {
  const updatedRecord = {
    ...buildRecord,
    updatedAt: new Date().toISOString(),
    rigBuilder: {
      ...(buildRecord.rigBuilder || {}),
      rebelStandardPrototype: {
        version: 'v0_structural_nodes_only',
        prototypeUrl,
        prototypePath,
        report,
        createdAt: new Date().toISOString()
      }
    },
    output: {
      ...(buildRecord.output || {}),
      rebelStandardPrototypeGlbUrl: prototypeUrl,
      rebelStandardPrototypeGlbPath: prototypePath
    },
    nextStep: 'validate_rebel_standard_rig_prototype_in_village'
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

    const body = req.body || {};
    const { buildId } = body;

    if (!buildId && !body.sourceGlbUrl && !body.glbUrl) {
      return res.status(400).json({ ok: false, error: 'Missing buildId or sourceGlbUrl' });
    }

       let recordKey = null;
    let buildRecord = {};

    if (buildId) {
      try {
        const loaded = await loadBuildRecord(buildId);
        recordKey = loaded.recordKey;
        buildRecord = loaded.buildRecord;
      } catch (err) {
        if (!body.sourceGlbUrl && !body.glbUrl) {
          throw err;
        }

        buildRecord = {
          buildId,
          collectionKey: body.collectionKey || 'battle_for_colony',
          tokenId: body.tokenId || '469',
          rebelId: body.rebelId || '469',
          source: 'dev_static_source_test'
        };
      }
    }

    const sourceGlbUrl = getSourceGlbUrl({ body, buildRecord });

    if (!sourceGlbUrl) {
      return res.status(400).json({ ok: false, error: 'Missing source GLB URL' });
    }

    const sourceBuffer = await fetchGlbAsBuffer(sourceGlbUrl);
    const io = new NodeIO();
    const document = await io.readBinary(sourceBuffer);
    const skin = getPrimarySkin(document);

    const beforeCoverage = inspectRebelStandardCoverage(document);
    const renameReport = renameMappedBones(document);
    const nodesByName = listNodesByName(document);

    const leftFingerReport = createFingerChains(document, skin, nodesByName, 'Left');
    const rightFingerReport = createFingerChains(document, skin, nodesByName, 'Right');
    const toeReport = createToeEnds(document, skin, nodesByName);
    const afterCoverage = inspectRebelStandardCoverage(document);

    const outputBuffer = Buffer.from(await io.writeBinary(document));
    const prototypePath = buildRiggedPrototypePath({ buildRecord, buildId });

    const blob = await put(prototypePath, outputBuffer, {
      access: 'public',
      contentType: 'model/gltf-binary',
      addRandomSuffix: false
    });

    const report = {
      version: 'v0_structural_nodes_only',
      warning: 'Prototype only. This creates/renames skeleton nodes and adds missing Rebel Standard helper bones. It does not solve skin weights or final deformation quality yet.',
      sourceGlbUrl,
      beforeCoverage,
      afterCoverage,
      renameReport,
      generatedBones: {
        leftFingersCreated: leftFingerReport.created.length,
        rightFingersCreated: rightFingerReport.created.length,
        toeEndsCreated: toeReport.created.length,
        totalCreated: leftFingerReport.created.length + rightFingerReport.created.length + toeReport.created.length,
        leftFingerReport,
        rightFingerReport,
        toeReport
      },
      skin: {
        hadSkin: Boolean(skin),
        jointCountAfter: skin ? getSkinJoints(skin).length : 0
      }
    };

    let updatedBuildRecord = null;

    if (recordKey) {
      updatedBuildRecord = await updateBuildRecordWithRigPrototype({
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
      message: 'Rebel Standard rig prototype GLB created and stored.'
    });
  } catch (err) {
    console.error('forge-rig-builder-prototype error:', err);

    return res.status(500).json({
      ok: false,
      error: 'Could not create Rebel Standard rig prototype GLB',
      detail: err && err.message ? err.message : 'Unknown error'
    });
  }
}
