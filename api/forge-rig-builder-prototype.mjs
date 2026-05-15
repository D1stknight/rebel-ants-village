import { Accessor, NodeIO } from '@gltf-transform/core';
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

function calculateModelBounds(document) {
  const min = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
  const max = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
  let vertexCount = 0;

  document.getRoot().listNodes().forEach((node) => {
    const mesh = typeof node.getMesh === 'function' ? node.getMesh() : null;
    if (!mesh || typeof mesh.listPrimitives !== 'function') return;

    mesh.listPrimitives().forEach((primitive) => {
      const position = primitive.getAttribute('POSITION');
      if (!position || typeof position.getCount !== 'function' || typeof position.getElement !== 'function') return;

      const point = [0, 0, 0];

      for (let index = 0; index < position.getCount(); index++) {
        position.getElement(index, point);
        vertexCount++;

        for (let axis = 0; axis < 3; axis++) {
          min[axis] = Math.min(min[axis], point[axis]);
          max[axis] = Math.max(max[axis], point[axis]);
        }
      }
    });
  });

  if (!vertexCount) {
    return {
      vertexCount: 0,
      min: [0, 0, 0],
      max: [0, 1, 0],
      center: [0, 0.5, 0],
      size: [1, 1, 1]
    };
  }

  const size = [
    max[0] - min[0],
    max[1] - min[1],
    max[2] - min[2]
  ];

  const center = [
    min[0] + size[0] / 2,
    min[1] + size[1] / 2,
    min[2] + size[2] / 2
  ];

  return {
    vertexCount,
    min,
    max,
    center,
    size
  };
}

function listSkins(document) {
  return document.getRoot().listSkins ? document.getRoot().listSkins() : [];
}

function getPrimarySkin(document) {
  return listSkins(document)[0] || null;
}

function getPrimaryMeshNode(document) {
  return document.getRoot().listNodes().find((node) => {
    return typeof node.getMesh === 'function' && node.getMesh();
  }) || null;
}

function getOrCreatePrimarySkin(document) {
  const existingSkin = getPrimarySkin(document);
  const meshNode = getPrimaryMeshNode(document);

  if (existingSkin) {
    if (meshNode && typeof meshNode.getSkin === 'function' && !meshNode.getSkin()) {
      meshNode.setSkin(existingSkin);
    }

    return {
      skin: existingSkin,
      created: false,
      meshNodeName: meshNode?.getName?.() || null
    };
  }

  if (!meshNode || typeof meshNode.setSkin !== 'function') {
    return {
      skin: null,
      created: false,
      meshNodeName: null,
      warning: 'No mesh node found to attach a new skin.'
    };
  }

  const skin = document.createSkin('Rebel Standard Skin');
  meshNode.setSkin(skin);

  return {
    skin,
    created: true,
    meshNodeName: meshNode.getName()
  };
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

function createRebelStandardSkeleton(document, skin, nodesByName, modelBounds) {
  const created = [];
  const reused = [];
  const jointNames = [];
  const size = modelBounds?.size || [1, 1, 1];
  const center = modelBounds?.center || [0, 0.5, 0];
  const min = modelBounds?.min || [0, 0, 0];
  const height = Math.max(size[1] || 1, 0.001);
  const width = Math.max(size[0] || 1, 0.001);
  const depth = Math.max(size[2] || 1, 0.001);

  function scaleX(value) {
    return Number((value * width).toFixed(5));
  }

  function scaleY(value) {
    return Number((value * height).toFixed(5));
  }

  function scaleZ(value) {
    return Number((value * depth).toFixed(5));
  }

  function getRebelBoneLocalTranslation(boneName) {
    const rootY = min[1] + height * 0.5;

    const translations = {
      mixamorig_Hips: [Number(center[0].toFixed(5)), Number(rootY.toFixed(5)), Number(center[2].toFixed(5))],

      mixamorig_Spine: [0, scaleY(0.12), 0],
      mixamorig_Spine1: [0, scaleY(0.12), 0],
      mixamorig_Spine2: [0, scaleY(0.12), 0],
      mixamorig_Neck: [0, scaleY(0.08), 0],
      mixamorig_Head: [0, scaleY(0.09), 0],
      mixamorig_HeadTop_End: [0, scaleY(0.12), 0],

      mixamorig_LeftShoulder: [scaleX(0.12), scaleY(0.02), 0],
      mixamorig_LeftArm: [scaleX(0.16), scaleY(-0.03), 0],
      mixamorig_LeftForeArm: [scaleX(0.18), scaleY(-0.02), 0],
      mixamorig_LeftHand: [scaleX(0.12), scaleY(-0.01), 0],

      mixamorig_RightShoulder: [scaleX(-0.12), scaleY(0.02), 0],
      mixamorig_RightArm: [scaleX(-0.16), scaleY(-0.03), 0],
      mixamorig_RightForeArm: [scaleX(-0.18), scaleY(-0.02), 0],
      mixamorig_RightHand: [scaleX(-0.12), scaleY(-0.01), 0],

      mixamorig_LeftUpLeg: [scaleX(0.08), scaleY(-0.08), 0],
      mixamorig_LeftLeg: [0, scaleY(-0.24), 0],
      mixamorig_LeftFoot: [0, scaleY(-0.22), scaleZ(0.05)],
      mixamorig_LeftToeBase: [0, scaleY(-0.03), scaleZ(0.10)],
      mixamorig_LeftToe_End: [0, 0, scaleZ(0.08)],

      mixamorig_RightUpLeg: [scaleX(-0.08), scaleY(-0.08), 0],
      mixamorig_RightLeg: [0, scaleY(-0.24), 0],
      mixamorig_RightFoot: [0, scaleY(-0.22), scaleZ(0.05)],
      mixamorig_RightToeBase: [0, scaleY(-0.03), scaleZ(0.10)],
      mixamorig_RightToe_End: [0, 0, scaleZ(0.08)]
    };

    ['Left', 'Right'].forEach((side) => {
      const sideSign = side === 'Left' ? 1 : -1;
      const fingerSpread = {
        Thumb: [0.030, -0.006, 0.030],
        Index: [0.015, 0.000, 0.045],
        Middle: [0.000, 0.000, 0.050],
        Ring: [-0.015, 0.000, 0.045],
        Pinky: [-0.030, -0.004, 0.036]
      };

      FINGER_TYPES.forEach((fingerType) => {
        const spread = fingerSpread[fingerType] || [0, 0, 0.04];

        for (let index = 1; index <= 4; index++) {
          const bone = `mixamorig_${side}Hand${fingerType}${index}`;
          translations[bone] = [
            scaleX(spread[0] * sideSign * (index === 1 ? 1 : 0.28)),
            scaleY(spread[1]),
            scaleZ(spread[2] * (index === 1 ? 1 : 0.65))
          ];
        }
      });
    });

    return translations[boneName] || [0, 0, 0];
  }

  const parentByBoneName = {
    mixamorig_Spine: 'mixamorig_Hips',
    mixamorig_Spine1: 'mixamorig_Spine',
    mixamorig_Spine2: 'mixamorig_Spine1',
    mixamorig_Neck: 'mixamorig_Spine2',
    mixamorig_Head: 'mixamorig_Neck',
    mixamorig_HeadTop_End: 'mixamorig_Head',

    mixamorig_LeftShoulder: 'mixamorig_Spine2',
    mixamorig_LeftArm: 'mixamorig_LeftShoulder',
    mixamorig_LeftForeArm: 'mixamorig_LeftArm',
    mixamorig_LeftHand: 'mixamorig_LeftForeArm',

    mixamorig_RightShoulder: 'mixamorig_Spine2',
    mixamorig_RightArm: 'mixamorig_RightShoulder',
    mixamorig_RightForeArm: 'mixamorig_RightArm',
    mixamorig_RightHand: 'mixamorig_RightForeArm',

    mixamorig_LeftUpLeg: 'mixamorig_Hips',
    mixamorig_LeftLeg: 'mixamorig_LeftUpLeg',
    mixamorig_LeftFoot: 'mixamorig_LeftLeg',
    mixamorig_LeftToeBase: 'mixamorig_LeftFoot',
    mixamorig_LeftToe_End: 'mixamorig_LeftToeBase',

    mixamorig_RightUpLeg: 'mixamorig_Hips',
    mixamorig_RightLeg: 'mixamorig_RightUpLeg',
    mixamorig_RightFoot: 'mixamorig_RightLeg',
    mixamorig_RightToeBase: 'mixamorig_RightFoot',
    mixamorig_RightToe_End: 'mixamorig_RightToeBase'
  };

  ['Left', 'Right'].forEach((side) => {
    FINGER_TYPES.forEach((fingerType) => {
      for (let index = 1; index <= 4; index++) {
        const boneName = `mixamorig_${side}Hand${fingerType}${index}`;
        parentByBoneName[boneName] =
          index === 1
            ? `mixamorig_${side}Hand`
            : `mixamorig_${side}Hand${fingerType}${index - 1}`;
      }
    });
  });

  REBEL_STANDARD_BONE_NAMES.forEach((boneName) => {
    const parentName = parentByBoneName[boneName] || null;
    const parentNode = parentName ? nodesByName.get(parentName) || null : null;
    const translation = getRebelBoneLocalTranslation(boneName);
    const { node, created: wasCreated } = getOrCreateNode(document, nodesByName, boneName, parentNode, translation);

    if (wasCreated) {
      created.push({
        boneName,
        parentBoneName: parentName
      });
    } else {
      reused.push({
        boneName,
        parentBoneName: parentName
      });
    }

    if (addJointToSkin(skin, node)) {
      jointNames.push(boneName);
    }
  });

  return {
    createdCount: created.length,
    reusedCount: reused.length,
    jointCount: skin ? getSkinJoints(skin).length : 0,
    jointsAddedCount: jointNames.length,
    created,
    reused,
    jointsAdded: jointNames
  };
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

function attachIdentityInverseBindMatrices(document, skin) {
  if (!skin || typeof skin.setInverseBindMatrices !== 'function') {
    return {
      inverseBindMatrixCount: 0,
      warning: 'Skin does not support setInverseBindMatrices.'
    };
  }

  const joints = getSkinJoints(skin);

  if (!joints.length) {
    return {
      inverseBindMatrixCount: 0,
      warning: 'Skin has no joints for inverse bind matrices.'
    };
  }

  const identityMatrices = new Float32Array(joints.length * 16);

  for (let jointIndex = 0; jointIndex < joints.length; jointIndex++) {
    const offset = jointIndex * 16;

    identityMatrices[offset] = 1;
    identityMatrices[offset + 1] = 0;
    identityMatrices[offset + 2] = 0;
    identityMatrices[offset + 3] = 0;

    identityMatrices[offset + 4] = 0;
    identityMatrices[offset + 5] = 1;
    identityMatrices[offset + 6] = 0;
    identityMatrices[offset + 7] = 0;

    identityMatrices[offset + 8] = 0;
    identityMatrices[offset + 9] = 0;
    identityMatrices[offset + 10] = 1;
    identityMatrices[offset + 11] = 0;

    identityMatrices[offset + 12] = 0;
    identityMatrices[offset + 13] = 0;
    identityMatrices[offset + 14] = 0;
    identityMatrices[offset + 15] = 1;
  }

  const inverseBindMatrices = document
    .createAccessor('inverseBindMatrices')
    .setType(Accessor.Type.MAT4)
    .setArray(identityMatrices);

  skin.setInverseBindMatrices(inverseBindMatrices);

  return {
    inverseBindMatrixCount: joints.length,
    accessorName: inverseBindMatrices.getName?.() || 'inverseBindMatrices',
    mode: 'identity_matrices_v1'
  };
}

function bindMeshVerticesToNearestRebelJoint(document, skin) {
  if (!skin) {
    return {
      weightedVertexCount: 0,
      primitiveCount: 0,
      skippedPrimitiveCount: 0,
      warning: 'No skin available for vertex binding.'
    };
  }

  const joints = getSkinJoints(skin);
  const jointPositions = joints.map((joint, jointIndex) => {
    const translation =
      typeof joint.getTranslation === 'function'
        ? joint.getTranslation()
        : [0, 0, 0];

    return {
      joint,
      jointIndex,
      name: joint.getName?.() || `joint_${jointIndex}`,
      position: translation || [0, 0, 0]
    };
  });

  if (!jointPositions.length) {
    return {
      weightedVertexCount: 0,
      primitiveCount: 0,
      skippedPrimitiveCount: 0,
      warning: 'Skin has no joints available for vertex binding.'
    };
  }

  let weightedVertexCount = 0;
  let primitiveCount = 0;
  let skippedPrimitiveCount = 0;

  document.getRoot().listNodes().forEach((node) => {
    const mesh = typeof node.getMesh === 'function' ? node.getMesh() : null;
    if (!mesh || typeof mesh.listPrimitives !== 'function') return;

    mesh.listPrimitives().forEach((primitive) => {
      primitiveCount++;

      const position = primitive.getAttribute('POSITION');
      if (!position || typeof position.getCount !== 'function' || typeof position.getElement !== 'function') {
        skippedPrimitiveCount++;
        return;
      }

      const vertexCount = position.getCount();
      const jointsArray = new Uint16Array(vertexCount * 4);
      const weightsArray = new Float32Array(vertexCount * 4);
      const point = [0, 0, 0];

      for (let vertexIndex = 0; vertexIndex < vertexCount; vertexIndex++) {
        position.getElement(vertexIndex, point);

        let nearestJointIndex = 0;
        let nearestDistance = Number.POSITIVE_INFINITY;

        jointPositions.forEach((jointInfo) => {
          const dx = point[0] - jointInfo.position[0];
          const dy = point[1] - jointInfo.position[1];
          const dz = point[2] - jointInfo.position[2];
          const distance = dx * dx + dy * dy + dz * dz;

          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestJointIndex = jointInfo.jointIndex;
          }
        });

        const offset = vertexIndex * 4;
        jointsArray[offset] = nearestJointIndex;
        jointsArray[offset + 1] = 0;
        jointsArray[offset + 2] = 0;
        jointsArray[offset + 3] = 0;

        weightsArray[offset] = 1;
        weightsArray[offset + 1] = 0;
        weightsArray[offset + 2] = 0;
        weightsArray[offset + 3] = 0;

        weightedVertexCount++;
      }

      const jointsAccessor = document
        .createAccessor('JOINTS_0')
        .setType(Accessor.Type.VEC4)
        .setArray(jointsArray);

      const weightsAccessor = document
        .createAccessor('WEIGHTS_0')
        .setType(Accessor.Type.VEC4)
        .setArray(weightsArray);

      primitive.setAttribute('JOINTS_0', jointsAccessor);
      primitive.setAttribute('WEIGHTS_0', weightsAccessor);
    });
  });

  return {
    weightedVertexCount,
    primitiveCount,
    skippedPrimitiveCount,
    jointCount: joints.length,
    bindingMode: 'nearest_single_joint_weight_1'
  };
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
    const modelBounds = calculateModelBounds(document);
    const skinSetup = getOrCreatePrimarySkin(document);
    const skin = skinSetup.skin;

    const beforeCoverage = inspectRebelStandardCoverage(document);
    const renameReport = renameMappedBones(document);
    const nodesByName = listNodesByName(document);

                             const rebelStandardSkeletonReport = createRebelStandardSkeleton(document, skin, nodesByName, modelBounds);
    const inverseBindMatrixReport = attachIdentityInverseBindMatrices(document, skin);
    const leftFingerReport = createFingerChains(document, skin, nodesByName, 'Left');
    const rightFingerReport = createFingerChains(document, skin, nodesByName, 'Right');
    const toeReport = createToeEnds(document, skin, nodesByName);
    const vertexBindingReport = bindMeshVerticesToNearestRebelJoint(document, skin);
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
           modelBounds,
      beforeCoverage,
      afterCoverage,
      renameReport,
            generatedBones: {
        rebelStandardSkeleton: rebelStandardSkeletonReport,
        leftFingersCreated: leftFingerReport.created.length,
        rightFingersCreated: rightFingerReport.created.length,
        toeEndsCreated: toeReport.created.length,
        totalCreated: rebelStandardSkeletonReport.createdCount + leftFingerReport.created.length + rightFingerReport.created.length + toeReport.created.length,
        leftFingerReport,
        rightFingerReport,
        toeReport
      },
                    inverseBindMatrices: inverseBindMatrixReport,
      vertexBinding: vertexBindingReport,
      skin: {
        hadSkin: !skinSetup.created && Boolean(skin),
        createdSkin: skinSetup.created,
        attachedMeshNodeName: skinSetup.meshNodeName,
        skinSetupWarning: skinSetup.warning || null,
        jointCountAfter: skin ? getSkinJoints(skin).length : 0,
        weightedVertexCount: vertexBindingReport.weightedVertexCount
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
