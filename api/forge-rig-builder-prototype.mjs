import { Accessor, NodeIO } from '@gltf-transform/core';
import { put } from '@vercel/blob';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const MAX_GLB_BYTES = 120 * 1024 * 1024;
const PLAYABLE_TEMPLATE_JSON_PATH = 'assets/character/rebel_standard_ant_idle_c_template_v1.json';

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

async function loadPlayableTemplateBoneTranslations() {
  const templatePath = path.join(process.cwd(), PLAYABLE_TEMPLATE_JSON_PATH);
  const templateJson = JSON.parse(await readFile(templatePath, 'utf8'));
  const boneTranslations = {};

  Object.entries(templateJson.bones || {}).forEach(([boneName, boneData]) => {
    const translation = boneData?.translation || [0, 0, 0];

    boneTranslations[boneName] = [
      Number((translation[0] || 0).toFixed(5)),
      Number((translation[1] || 0).toFixed(5)),
      Number((translation[2] || 0).toFixed(5))
    ];
  });

  const rawTemplateSize =
    templateJson.bounds?.size ||
    templateJson.modelBounds?.size ||
    templateJson.size ||
    null;

  const templateSize = Array.isArray(rawTemplateSize) && rawTemplateSize.length >= 3
    ? rawTemplateSize
    : null;

  let templateBounds = null;

  if (templateSize) {
    templateBounds = {
      size: templateSize.map((value) => Number(value || 0))
    };
  } else {
    const translations = Object.values(boneTranslations);
    const min = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
    const max = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];

    translations.forEach((translation) => {
      for (let axis = 0; axis < 3; axis++) {
        min[axis] = Math.min(min[axis], translation[axis] || 0);
        max[axis] = Math.max(max[axis], translation[axis] || 0);
      }
    });

    templateBounds = translations.length
      ? {
          min,
          max,
          size: [
            max[0] - min[0],
            max[1] - min[1],
            max[2] - min[2]
          ]
        }
      : {
          min: [0, 0, 0],
          max: [0, 1, 0],
          size: [1, 1, 1]
        };
  }

  return {
    templatePath: PLAYABLE_TEMPLATE_JSON_PATH,
    sourceFile: templateJson.sourceFile || null,
    boneCount: Object.keys(boneTranslations).length,
    templateBounds,
    boneTranslations
  };
}

function createRebelStandardSkeleton(document, skin, nodesByName, modelBounds, playableTemplate = {}, rigLayout = null) {
  const created = [];
  const reused = [];
  const jointNames = [];
  const size = modelBounds?.size || [1, 1, 1];
  const center = modelBounds?.center || [0, 0.5, 0];
  const min = modelBounds?.min || [0, 0, 0];
  const height = Math.max(size[1] || 1, 0.001);
  const width = Math.max(size[0] || 1, 0.001);
   const depth = Math.max(size[2] || 1, 0.001);
  const templateBoneTranslations = playableTemplate.boneTranslations || {};
  const templateSize = playableTemplate.templateBounds?.size || [1, 1, 1];
  const templateHeight = Math.max(templateSize[1] || 1, 0.001);
  const templateScale = height / templateHeight;
  const rigLayoutMarkers = rigLayout?.markers && typeof rigLayout.markers === 'object'
    ? rigLayout.markers
    : {};
  const rigMarkerToBoneName = {
    hips: 'mixamorig_Hips',
    spine: 'mixamorig_Spine',
    chest: 'mixamorig_Spine2',
    neck: 'mixamorig_Neck',
    head: 'mixamorig_Head',
    'left shoulder': 'mixamorig_LeftShoulder',
    'left elbow': 'mixamorig_LeftForeArm',
    'left hand': 'mixamorig_LeftHand',
    'right shoulder': 'mixamorig_RightShoulder',
    'right elbow': 'mixamorig_RightForeArm',
    'right hand': 'mixamorig_RightHand',
    'left knee': 'mixamorig_LeftLeg',
    'left foot': 'mixamorig_LeftFoot',
    'right knee': 'mixamorig_RightLeg',
    'right foot': 'mixamorig_RightFoot'
  };
  const rigBoneToMarkerName = Object.fromEntries(
    Object.entries(rigMarkerToBoneName).map(([markerName, boneName]) => [boneName, markerName])
  );
  const rigLayoutMarkerCount = Object.keys(rigMarkerToBoneName).filter((markerName) => {
    return isRigMarkerPosition(rigLayoutMarkers[markerName]);
  }).length;

  function isRigMarkerPosition(position) {
    return Array.isArray(position) &&
      position.length >= 3 &&
      position.slice(0, 3).every((value) => Number.isFinite(Number(value)));
  }

  function normalizeRigMarkerPosition(position) {
    return [
      Number(position[0]),
      Number(position[1]),
      Number(position[2])
    ];
  }

  function midpoint(a, b) {
    return [
      (a[0] + b[0]) / 2,
      (a[1] + b[1]) / 2,
      (a[2] + b[2]) / 2
    ];
  }

  function getRigMarkerWorldPositionForBone(boneName) {
    const markerName = rigBoneToMarkerName[boneName];

    if (markerName && isRigMarkerPosition(rigLayoutMarkers[markerName])) {
      return normalizeRigMarkerPosition(rigLayoutMarkers[markerName]);
    }

    if (boneName === 'mixamorig_Spine1') {
      const spine = getRigMarkerWorldPositionForBone('mixamorig_Spine');
      const chest = getRigMarkerWorldPositionForBone('mixamorig_Spine2');
      return spine && chest ? midpoint(spine, chest) : null;
    }

    if (boneName === 'mixamorig_LeftArm') {
      const shoulder = getRigMarkerWorldPositionForBone('mixamorig_LeftShoulder');
      const elbow = getRigMarkerWorldPositionForBone('mixamorig_LeftForeArm');
      return shoulder && elbow ? midpoint(shoulder, elbow) : null;
    }

    if (boneName === 'mixamorig_RightArm') {
      const shoulder = getRigMarkerWorldPositionForBone('mixamorig_RightShoulder');
      const elbow = getRigMarkerWorldPositionForBone('mixamorig_RightForeArm');
      return shoulder && elbow ? midpoint(shoulder, elbow) : null;
    }

    if (boneName === 'mixamorig_LeftUpLeg') {
      const hips = getRigMarkerWorldPositionForBone('mixamorig_Hips');
      const knee = getRigMarkerWorldPositionForBone('mixamorig_LeftLeg');
      return hips && knee ? midpoint(hips, knee) : null;
    }

    if (boneName === 'mixamorig_RightUpLeg') {
      const hips = getRigMarkerWorldPositionForBone('mixamorig_Hips');
      const knee = getRigMarkerWorldPositionForBone('mixamorig_RightLeg');
      return hips && knee ? midpoint(hips, knee) : null;
    }

    return null;
  }

  function getRigMarkerLocalTranslationForBone(boneName) {
    const worldPosition = getRigMarkerWorldPositionForBone(boneName);

    if (!worldPosition) {
      return null;
    }

    const parentName = {
      mixamorig_Spine: 'mixamorig_Hips',
      mixamorig_Spine1: 'mixamorig_Spine',
      mixamorig_Spine2: 'mixamorig_Spine1',
      mixamorig_Neck: 'mixamorig_Spine2',
      mixamorig_Head: 'mixamorig_Neck',
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
      mixamorig_RightUpLeg: 'mixamorig_Hips',
      mixamorig_RightLeg: 'mixamorig_RightUpLeg',
      mixamorig_RightFoot: 'mixamorig_RightLeg'
    }[boneName] || null;
    const parentWorldPosition = parentName ? getRigMarkerWorldPositionForBone(parentName) : null;
    const translation = parentWorldPosition
      ? [
          worldPosition[0] - parentWorldPosition[0],
          worldPosition[1] - parentWorldPosition[1],
          worldPosition[2] - parentWorldPosition[2]
        ]
      : worldPosition;

    return translation.map((value) => Number(value.toFixed(5)));
  }

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
    const rigLayoutTranslation = getRigMarkerLocalTranslationForBone(boneName);

    if (rigLayoutTranslation) {
      return rigLayoutTranslation;
    }

    const templateTranslation = templateBoneTranslations[boneName];

    if (Array.isArray(templateTranslation) && templateTranslation.length === 3) {
      return [
        Number(((templateTranslation[0] || 0) * templateScale).toFixed(5)),
        Number(((templateTranslation[1] || 0) * templateScale).toFixed(5)),
        Number(((templateTranslation[2] || 0) * templateScale).toFixed(5))
      ];
    }

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
       templateBoneTranslationCount: Object.keys(templateBoneTranslations).length,
    rigLayoutUsed: rigLayoutMarkerCount > 0,
    rigLayoutMarkerCount,
    templateScale,
    templateHeight,
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

function multiplyMat4(a, b) {
  const out = new Array(16);

  const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
  const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
  const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
  const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

  let b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
  out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

  b0 = b[4]; b1 = b[5]; b2 = b[6]; b3 = b[7];
  out[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

  b0 = b[8]; b1 = b[9]; b2 = b[10]; b3 = b[11];
  out[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

  b0 = b[12]; b1 = b[13]; b2 = b[14]; b3 = b[15];
  out[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

  return out;
}

function invertMat4(a) {
  const out = new Array(16);
  const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
  const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
  const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
  const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

  const b00 = a00 * a11 - a01 * a10;
  const b01 = a00 * a12 - a02 * a10;
  const b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11;
  const b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30;
  const b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31;
  const b11 = a22 * a33 - a23 * a32;

  let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

  if (!det) return null;

  det = 1.0 / det;

  out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
  out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
  out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
  out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
  out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
  out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
  out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
  out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
  out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
  out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
  out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
  out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
  out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
  out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
  out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
  out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;

  return out;
}

function composeNodeLocalMatrix(node) {
  const translation = node.getTranslation?.() || [0, 0, 0];
  const rotation = node.getRotation?.() || [0, 0, 0, 1];
  const scale = node.getScale?.() || [1, 1, 1];

  const x = rotation[0], y = rotation[1], z = rotation[2], w = rotation[3];
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  const sx = scale[0], sy = scale[1], sz = scale[2];

  return [
    (1 - (yy + zz)) * sx,
    (xy + wz) * sx,
    (xz - wy) * sx,
    0,

    (xy - wz) * sy,
    (1 - (xx + zz)) * sy,
    (yz + wx) * sy,
    0,

    (xz + wy) * sz,
    (yz - wx) * sz,
    (1 - (xx + yy)) * sz,
    0,

    translation[0],
    translation[1],
    translation[2],
    1
  ];
}

function getNodeWorldMatrix(node) {
  const localMatrix = composeNodeLocalMatrix(node);
  const parent = node.getParent?.() || null;

  if (parent && typeof parent.getTranslation === 'function') {
    return multiplyMat4(getNodeWorldMatrix(parent), localMatrix);
  }

  return localMatrix;
}

function attachCalculatedInverseBindMatrices(document, skin) {
  if (!skin || typeof skin.setInverseBindMatrices !== 'function') {
    return {
      inverseBindMatrixCount: 0,
      jointCountAtTimeOfCreation: 0,
      warning: 'Skin does not support setInverseBindMatrices.'
    };
  }

  const joints = getSkinJoints(skin);

  if (!joints.length) {
    return {
      inverseBindMatrixCount: 0,
      jointCountAtTimeOfCreation: 0,
      warning: 'Skin has no joints for inverse bind matrices.'
    };
  }

  const inverseMatrices = new Float32Array(joints.length * 16);
  let nonInvertibleJointCount = 0;

  joints.forEach((joint, jointIndex) => {
    const offset = jointIndex * 16;
    const worldMatrix = getNodeWorldMatrix(joint);
    const inverseMatrix = invertMat4(worldMatrix);

    if (!inverseMatrix) {
      nonInvertibleJointCount++;
    }

    const matrix = inverseMatrix || [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ];

    for (let matrixIndex = 0; matrixIndex < 16; matrixIndex++) {
      inverseMatrices[offset + matrixIndex] = matrix[matrixIndex];
    }
  });

  const inverseBindMatrices = document
    .createAccessor('inverseBindMatrices')
    .setType(Accessor.Type.MAT4)
    .setArray(inverseMatrices);

  skin.setInverseBindMatrices(inverseBindMatrices);

  return {
    mode: 'calculated_inverse_world_matrices_v1',
    inverseBindMatrixCount: joints.length,
    jointCountAtTimeOfCreation: joints.length,
    nonInvertibleJointCount,
    accessorName: inverseBindMatrices.getName?.() || 'inverseBindMatrices'
  };
}

function bindMeshVerticesToBodyZones(document, skin, modelBounds, rigLayout = null, bodyZoneLayout = null) {
  if (!skin) {
    return {
      weightedVertexCount: 0,
      primitiveCount: 0,
      skippedPrimitiveCount: 0,
      countsByBoneName: {},
      warning: 'No skin available for vertex binding.'
    };
  }

  const joints = getSkinJoints(skin);
  const jointIndexByName = new Map(
    joints.map((joint, jointIndex) => [joint.getName?.() || `joint_${jointIndex}`, jointIndex])
  );

  if (!joints.length) {
    return {
      weightedVertexCount: 0,
      primitiveCount: 0,
      skippedPrimitiveCount: 0,
      countsByBoneName: {},
      warning: 'Skin has no joints available for vertex binding.'
    };
  }

  const min = modelBounds?.min || [0, 0, 0];
  const size = modelBounds?.size || [1, 1, 1];
  const center = modelBounds?.center || [0, 0.5, 0];
  const height = Math.max(size[1] || 1, 0.001);
  const width = Math.max(size[0] || 1, 0.001);
  const rigLayoutMarkers = rigLayout?.markers && typeof rigLayout.markers === 'object'
    ? rigLayout.markers
    : {};
  const rigMarkerToBoneName = {
    hips: 'mixamorig_Hips',
    spine: 'mixamorig_Spine',
    chest: 'mixamorig_Spine2',
    neck: 'mixamorig_Neck',
    head: 'mixamorig_Head',
    'left shoulder': 'mixamorig_LeftShoulder',
    'left elbow': 'mixamorig_LeftForeArm',
    'left hand': 'mixamorig_LeftHand',
    'right shoulder': 'mixamorig_RightShoulder',
    'right elbow': 'mixamorig_RightForeArm',
    'right hand': 'mixamorig_RightHand',
    'left knee': 'mixamorig_LeftLeg',
    'left foot': 'mixamorig_LeftFoot',
    'right knee': 'mixamorig_RightLeg',
    'right foot': 'mixamorig_RightFoot'
  };

  function isRigMarkerPosition(position) {
    return Array.isArray(position) &&
      position.length >= 3 &&
      position.slice(0, 3).every((value) => Number.isFinite(Number(value)));
  }

  const rigBindingMarkers = Object.entries(rigMarkerToBoneName)
    .filter(([markerName, boneName]) => {
      return isRigMarkerPosition(rigLayoutMarkers[markerName]) && jointIndexByName.has(boneName);
    })
    .map(([markerName, boneName]) => {
      const position = rigLayoutMarkers[markerName];

      return {
        markerName,
        boneName,
        jointIndex: jointIndexByName.get(boneName),
        position: [
          Number(position[0]),
          Number(position[1]),
          Number(position[2])
        ]
      };
    });
    const useRigLayoutBinding = rigBindingMarkers.length > 0;
  const bodyZoneBoneMap = {
    Head: ['mixamorig_Head'],
    Chest: ['mixamorig_Spine', 'mixamorig_Spine1', 'mixamorig_Spine2'],
    Hips: ['mixamorig_Hips'],
    'Left Arm': ['mixamorig_LeftShoulder', 'mixamorig_LeftForeArm', 'mixamorig_LeftHand'],
    'Right Arm': ['mixamorig_RightShoulder', 'mixamorig_RightForeArm', 'mixamorig_RightHand'],
    'Left Leg': ['mixamorig_LeftLeg', 'mixamorig_LeftFoot'],
    'Right Leg': ['mixamorig_RightLeg', 'mixamorig_RightFoot']
  };

  function isNumberVector3(value) {
    return Array.isArray(value) &&
      value.length >= 3 &&
      value.slice(0, 3).every((item) => Number.isFinite(Number(item)));
  }

  const bodyZones = Array.isArray(bodyZoneLayout?.zones)
    ? bodyZoneLayout.zones
        .filter((zone) => {
          return zone?.name &&
            bodyZoneBoneMap[zone.name] &&
            isNumberVector3(zone.position) &&
            isNumberVector3(zone.scale);
        })
        .map((zone) => {
          return {
            name: zone.name,
            position: [
              Number(zone.position[0]),
              Number(zone.position[1]),
              Number(zone.position[2])
            ],
            scale: [
              Math.abs(Number(zone.scale[0])),
              Math.abs(Number(zone.scale[1])),
              Math.abs(Number(zone.scale[2]))
            ],
            boneNames: bodyZoneBoneMap[zone.name].filter((boneName) => jointIndexByName.has(boneName))
          };
        })
        .filter((zone) => zone.boneNames.length > 0)
    : [];

  function pointIsInsideBodyZone(point, zone) {
    return Math.abs(point[0] - zone.position[0]) <= zone.scale[0] / 2 &&
      Math.abs(point[1] - zone.position[1]) <= zone.scale[1] / 2 &&
      Math.abs(point[2] - zone.position[2]) <= zone.scale[2] / 2;
  }

    function getZoneVolume(zone) {
    return Math.max(zone.scale[0] * zone.scale[1] * zone.scale[2], 0.000001);
  }

  function normalizeInfluences(influences) {
    const totalWeight = influences.reduce((total, influence) => total + influence.weight, 0) || 1;

    return influences.slice(0, 4).map((influence) => {
      return {
        ...influence,
        weight: influence.weight / totalWeight
      };
    });
  }

  function getBodyZoneInfluences(point) {
    const matchingZones = bodyZones
      .filter((candidate) => pointIsInsideBodyZone(point, candidate))
      .sort((a, b) => getZoneVolume(a) - getZoneVolume(b));

    if (!matchingZones.length) return [];

    const primaryZone = matchingZones[0];
    const primaryBoneNames = primaryZone.boneNames.slice(0, 3);
    const primaryWeight = 0.85 / primaryBoneNames.length;
    const influences = primaryBoneNames.map((boneName) => {
      return {
        boneName,
        jointIndex: jointIndexByName.get(boneName),
        weight: primaryWeight
      };
    });

    if (useRigLayoutBinding) {
      const fallbackInfluence = getRigMarkerInfluences(point)[0];

      if (fallbackInfluence && !primaryBoneNames.includes(fallbackInfluence.boneName)) {
        influences.push({
          boneName: fallbackInfluence.boneName,
          jointIndex: fallbackInfluence.jointIndex,
          weight: 0.15
        });
      } else if (fallbackInfluence) {
        influences[0].weight += 0.15;
      } else {
        influences[0].weight += 0.15;
      }
    } else {
      influences[0].weight += 0.15;
    }

    return normalizeInfluences(influences);
  }

  function chooseBodyZoneBoneName(point) {
    const normalizedY = (point[1] - min[1]) / height;
    const normalizedXFromCenter = (point[0] - center[0]) / width;
    const isLeftSide = normalizedXFromCenter > 0;
    const sidePrefix = isLeftSide ? 'Left' : 'Right';
    const absX = Math.abs(normalizedXFromCenter);

    if (normalizedY >= 0.82) return 'mixamorig_Head';

    if (normalizedY >= 0.56 && absX > 0.18) {
      if (normalizedY >= 0.68) return `mixamorig_${sidePrefix}Arm`;
      if (normalizedY >= 0.58) return `mixamorig_${sidePrefix}ForeArm`;
      return `mixamorig_${sidePrefix}Hand`;
    }

    if (normalizedY >= 0.68) return 'mixamorig_Spine2';
    if (normalizedY >= 0.54) return 'mixamorig_Spine1';
    if (normalizedY >= 0.42) return 'mixamorig_Spine';

    if (normalizedY < 0.42 && absX > 0.08) {
      if (normalizedY >= 0.28) return `mixamorig_${sidePrefix}UpLeg`;
      if (normalizedY >= 0.12) return `mixamorig_${sidePrefix}Leg`;
      return `mixamorig_${sidePrefix}Foot`;
    }

    return 'mixamorig_Hips';
  }

   function getRigRegionMarkerNames(point) {
    const normalizedY = (point[1] - min[1]) / height;
    const normalizedXFromCenter = (point[0] - center[0]) / width;
    const absX = Math.abs(normalizedXFromCenter);
    const side = normalizedXFromCenter > 0 ? 'left' : 'right';

    if (normalizedY >= 0.82) {
      return ['head', 'neck', 'chest', 'spine'];
    }

    if (normalizedY >= 0.42 && absX <= 0.18) {
      return ['hips', 'spine', 'chest'];
    }

    if (normalizedY >= 0.42) {
      return [
        `${side} shoulder`,
        `${side} elbow`,
        `${side} hand`,
        'chest',
        'spine',
        'neck',
        'head'
      ];
    }

    if (absX > 0.08) {
      return [
        `${side} knee`,
        `${side} foot`,
        'hips'
      ];
    }

    return ['hips', 'left knee', 'right knee', 'left foot', 'right foot'];
  }

  function getRigMarkerInfluences(point) {
    const regionMarkerNames = new Set(getRigRegionMarkerNames(point));
    const regionMarkers = rigBindingMarkers.filter((marker) => {
      return regionMarkerNames.has(marker.markerName);
    });
    const candidateMarkers = regionMarkers.length ? regionMarkers : rigBindingMarkers;
    const nearestMarkers = candidateMarkers
      .map((marker) => {
        const dx = point[0] - marker.position[0];
        const dy = point[1] - marker.position[1];
        const dz = point[2] - marker.position[2];
        const distanceSquared = dx * dx + dy * dy + dz * dz;

        return {
          ...marker,
          distanceSquared
        };
      })
      .sort((a, b) => a.distanceSquared - b.distanceSquared)
      .slice(0, 4);

    if (!nearestMarkers.length) return [];

    const exactMatch = nearestMarkers.find((marker) => marker.distanceSquared <= 0.00000001);

    if (exactMatch) {
      return [{
        boneName: exactMatch.boneName,
        jointIndex: exactMatch.jointIndex,
        weight: 1
      }];
    }

    const rawWeights = nearestMarkers.map((marker) => {
      return 1 / Math.max(marker.distanceSquared, 0.0001);
    });
    const totalWeight = rawWeights.reduce((total, weight) => total + weight, 0) || 1;

    return nearestMarkers.map((marker, index) => {
      return {
        boneName: marker.boneName,
        jointIndex: marker.jointIndex,
        weight: rawWeights[index] / totalWeight
      };
    });
  }

  function getJointIndexForBoneName(boneName) {
    if (jointIndexByName.has(boneName)) return jointIndexByName.get(boneName);
    if (jointIndexByName.has('mixamorig_Hips')) return jointIndexByName.get('mixamorig_Hips');
    return 0;
  }

    let weightedVertexCount = 0;
  let blendedVertexCount = 0;
  let totalInfluenceCount = 0;
  let bodyZoneHitVertexCount = 0;
  let primitiveCount = 0;
  let skippedPrimitiveCount = 0;
  const countsByBoneName = {};

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

        const offset = vertexIndex * 4;

               const bodyZoneInfluences = bodyZones.length ? getBodyZoneInfluences(point) : [];

        if (bodyZoneInfluences.length) {
          bodyZoneInfluences.forEach((influence, influenceIndex) => {
            jointsArray[offset + influenceIndex] = influence.jointIndex;
            weightsArray[offset + influenceIndex] = influence.weight;
            countsByBoneName[influence.boneName] = (countsByBoneName[influence.boneName] || 0) + influence.weight;
          });

          for (let influenceIndex = bodyZoneInfluences.length; influenceIndex < 4; influenceIndex++) {
            jointsArray[offset + influenceIndex] = 0;
            weightsArray[offset + influenceIndex] = 0;
          }

          bodyZoneHitVertexCount++;
          blendedVertexCount++;
          totalInfluenceCount += bodyZoneInfluences.length;
        } else if (useRigLayoutBinding) {
          const influences = getRigMarkerInfluences(point);

          influences.forEach((influence, influenceIndex) => {
            jointsArray[offset + influenceIndex] = influence.jointIndex;
            weightsArray[offset + influenceIndex] = influence.weight;
            countsByBoneName[influence.boneName] = (countsByBoneName[influence.boneName] || 0) + influence.weight;
          });

          for (let influenceIndex = influences.length; influenceIndex < 4; influenceIndex++) {
            jointsArray[offset + influenceIndex] = 0;
            weightsArray[offset + influenceIndex] = 0;
          }

          blendedVertexCount++;
          totalInfluenceCount += influences.length;
        } else {
          const boneName = chooseBodyZoneBoneName(point);
          const jointIndex = getJointIndexForBoneName(boneName);

          jointsArray[offset] = jointIndex;
          jointsArray[offset + 1] = 0;
          jointsArray[offset + 2] = 0;
          jointsArray[offset + 3] = 0;

          weightsArray[offset] = 1;
          weightsArray[offset + 1] = 0;
          weightsArray[offset + 2] = 0;
          weightsArray[offset + 3] = 0;

          countsByBoneName[boneName] = (countsByBoneName[boneName] || 0) + 1;
          totalInfluenceCount++;
        }

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
    blendedVertexCount,
    averageInfluencesPerVertex: weightedVertexCount
      ? Number((totalInfluenceCount / weightedVertexCount).toFixed(4))
      : 0,
    primitiveCount,
    skippedPrimitiveCount,
    jointCount: joints.length,
        countsByBoneName,
    rigLayoutMarkerCount: rigBindingMarkers.length,
    bodyZoneLayoutUsed: bodyZoneHitVertexCount > 0,
    bodyZoneCount: bodyZones.length,
    bodyZoneHitVertexCount,
               bindingMode: bodyZoneHitVertexCount > 0
      ? 'body_zone_primary_85_marker_fallback_15'
      : useRigLayoutBinding
        ? 'rig_layout_region_filtered_4_marker_blend'
        : 'body_zone_single_joint_weight_1'
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
    const rigLayout = body.rigLayout || (body.markers ? { markers: body.markers } : null);
    const bodyZoneLayout = body.bodyZoneLayout || body.bodyZones || null;
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
    const playableTemplate = await loadPlayableTemplateBoneTranslations();
    const io = new NodeIO();
    const document = await io.readBinary(sourceBuffer);
    const modelBounds = calculateModelBounds(document);
    const skinSetup = getOrCreatePrimarySkin(document);
    const skin = skinSetup.skin;

    const beforeCoverage = inspectRebelStandardCoverage(document);
    const renameReport = renameMappedBones(document);
    const nodesByName = listNodesByName(document);

    const rebelStandardSkeletonReport = createRebelStandardSkeleton(document, skin, nodesByName, modelBounds, playableTemplate, rigLayout);
    const leftFingerReport = createFingerChains(document, skin, nodesByName, 'Left');
    const rightFingerReport = createFingerChains(document, skin, nodesByName, 'Right');
    const toeReport = createToeEnds(document, skin, nodesByName);
    const inverseBindMatrixReport = attachCalculatedInverseBindMatrices(document, skin);
    const vertexBindingReport = bindMeshVerticesToBodyZones(document, skin, modelBounds, rigLayout, bodyZoneLayout);
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
                    playableTemplate: {
        templatePath: playableTemplate.templatePath,
        sourceFile: playableTemplate.sourceFile,
        boneCount: playableTemplate.boneCount,
        templateBounds: playableTemplate.templateBounds
      },
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
