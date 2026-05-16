import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Accessor, NodeIO } from '@gltf-transform/core';
import { KHRDracoMeshCompression } from '@gltf-transform/extensions';

const INPUT_GLB = 'assets/character/ant_idle_c.glb';
const OUTPUT_GLB = 'assets/character/ant_idle_c_zone_materials_probe.glb';
const SOURCE_MATERIAL_NAME = 'Material.001';

const ZONE_ORDER = [
  'head',
  'body',
  'leftArm',
  'rightArm',
  'leftLeg',
  'rightLeg'
];

const ZONE_COLORS = {
  head: [0.95, 0.15, 0.35, 1],
  body: [0.388, 0.176, 0.451, 1],
  leftArm: [0.1, 0.65, 0.95, 1],
  rightArm: [0.95, 0.72, 0.12, 1],
  leftLeg: [0.22, 0.85, 0.35, 1],
  rightLeg: [0.95, 0.38, 0.12, 1]
};

async function loadDracoDependency() {
  try {
    const draco3d = await import('draco3dgltf');

    return {
      'draco3d.decoder': await draco3d.default.createDecoderModule(),
      'draco3d.encoder': await draco3d.default.createEncoderModule()
    };
  } catch (firstError) {
    try {
      const draco3d = await import('draco3d');

      return {
        'draco3d.decoder': await draco3d.default.createDecoderModule(),
        'draco3d.encoder': await draco3d.default.createEncoderModule()
      };
    } catch {
      throw new Error(`Draco decoder is required for ${INPUT_GLB}. Install draco3dgltf or draco3d before running this script. Original error: ${firstError.message}`);
    }
  }
}

function getAccessorElement(accessor, index) {
  const array = accessor.getArray();
  const size = accessor.getElementSize();
  const values = [];

  for (let i = 0; i < size; i += 1) {
    values.push(array[index * size + i] || 0);
  }

  return values;
}

function getDominantJointName(vertexIndex, jointsAccessor, weightsAccessor, skinJoints) {
  const jointIndices = getAccessorElement(jointsAccessor, vertexIndex);
  const weights = getAccessorElement(weightsAccessor, vertexIndex);
  let bestInfluenceIndex = 0;
  let bestWeight = -1;

  for (let i = 0; i < weights.length; i += 1) {
    if (weights[i] > bestWeight) {
      bestInfluenceIndex = i;
      bestWeight = weights[i];
    }
  }

  const skinJointIndex = jointIndices[bestInfluenceIndex] || 0;
  return skinJoints[skinJointIndex]?.getName?.() || '';
}

function zoneFromJointName(jointName) {
  if (/Head|Neck/i.test(jointName)) return 'head';
  if (/Left(Shoulder|Arm|ForeArm|Hand)/i.test(jointName)) return 'leftArm';
  if (/Right(Shoulder|Arm|ForeArm|Hand)/i.test(jointName)) return 'rightArm';
  if (/Left(UpLeg|Leg|Foot|Toe)/i.test(jointName)) return 'leftLeg';
  if (/Right(UpLeg|Leg|Foot|Toe)/i.test(jointName)) return 'rightLeg';
  return 'body';
}

function chooseTriangleZone(vertexZones) {
  const counts = new Map();

  vertexZones.forEach((zone) => {
    counts.set(zone, (counts.get(zone) || 0) + 1);
  });

  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'body';
}

function createZoneMaterials(document, sourceMaterial, zoneColors = ZONE_COLORS) {
  const materials = {};

  ZONE_ORDER.forEach((zone) => {
    const material = document.createMaterial(`Zone_${zone}`);

    material.setBaseColorFactor(zoneColors[zone] || ZONE_COLORS[zone]);
    material.setMetallicFactor(sourceMaterial?.getMetallicFactor?.() ?? 0);
    material.setRoughnessFactor(sourceMaterial?.getRoughnessFactor?.() ?? 0.65);
    material.setDoubleSided(true);
    material.setEmissiveFactor([0, 0, 0]);
    const baseColorTexture = sourceMaterial?.getBaseColorTexture?.();
    const normalTexture = sourceMaterial?.getNormalTexture?.();

    if (baseColorTexture) material.setBaseColorTexture(baseColorTexture);
    if (normalTexture) material.setNormalTexture(normalTexture);

    materials[zone] = material;
  });

  return materials;
}

function copyPrimitiveAttributes(sourcePrimitive, targetPrimitive) {
  sourcePrimitive.listSemantics().forEach((semantic) => {
    targetPrimitive.setAttribute(semantic, sourcePrimitive.getAttribute(semantic));
  });
}

function splitPrimitiveByDominantJointZone(document, mesh, primitive, skin) {
  const jointsAccessor = primitive.getAttribute('JOINTS_0');
  const weightsAccessor = primitive.getAttribute('WEIGHTS_0');
  const indicesAccessor = primitive.getIndices();
  const positionAccessor = primitive.getAttribute('POSITION');
  const sourceMaterial = primitive.getMaterial();
  const skinJoints = skin.listJoints();
  const zoneMaterials = createZoneMaterials(document, sourceMaterial);
  const indicesArray = indicesAccessor?.getArray();
  const vertexCount = positionAccessor.getCount();
  const zoneIndices = Object.fromEntries(ZONE_ORDER.map((zone) => [zone, []]));

  if (!jointsAccessor || !weightsAccessor || !positionAccessor) {
    throw new Error('Playable primitive is missing POSITION, JOINTS_0, or WEIGHTS_0.');
  }

  const triangleIndexCount = indicesArray ? indicesArray.length : vertexCount;

  for (let i = 0; i < triangleIndexCount; i += 3) {
    const a = indicesArray ? indicesArray[i] : i;
    const b = indicesArray ? indicesArray[i + 1] : i + 1;
    const c = indicesArray ? indicesArray[i + 2] : i + 2;
    const vertexZones = [a, b, c].map((vertexIndex) => {
      return zoneFromJointName(getDominantJointName(vertexIndex, jointsAccessor, weightsAccessor, skinJoints));
    });
    const zone = chooseTriangleZone(vertexZones);

    zoneIndices[zone].push(a, b, c);
  }

  mesh.removePrimitive(primitive);

  ZONE_ORDER.forEach((zone) => {
    const indices = zoneIndices[zone];

    if (!indices.length) return;

    const indexArray = vertexCount > 65535
      ? Uint32Array.from(indices)
      : Uint16Array.from(indices);
    const indexAccessor = document.createAccessor(`Zone_${zone}_indices`)
      .setType(Accessor.Type.SCALAR)
      .setArray(indexArray);
    const zonePrimitive = document.createPrimitive()
      .setMode(primitive.getMode())
      .setMaterial(zoneMaterials[zone])
      .setIndices(indexAccessor);

    copyPrimitiveAttributes(primitive, zonePrimitive);
    mesh.addPrimitive(zonePrimitive);
  });

  return Object.fromEntries(
    ZONE_ORDER.map((zone) => [zone, zoneIndices[zone].length / 3])
  );
}

async function main() {
  const inputPath = path.join(process.cwd(), INPUT_GLB);
  const outputPath = path.join(process.cwd(), OUTPUT_GLB);
  const dracoDependencies = await loadDracoDependency();
  const io = new NodeIO()
    .registerExtensions([KHRDracoMeshCompression])
    .registerDependencies(dracoDependencies);
  const document = await io.read(inputPath);

    document.getRoot()
    .listExtensionsUsed()
    .find((extension) => extension.extensionName === KHRDracoMeshCompression.EXTENSION_NAME)
    ?.dispose();

  const root = document.getRoot();
  const mesh = root.listMeshes()[0];
  const skin = root.listSkins()[0];
  const sourceMaterial = root.listMaterials().find((material) => material.getName() === SOURCE_MATERIAL_NAME);

  if (!mesh) throw new Error('No mesh found in playable GLB.');
  if (!skin) throw new Error('No skin found in playable GLB.');
  if (mesh.listPrimitives().length !== 1) {
    throw new Error(`Expected one primitive, found ${mesh.listPrimitives().length}.`);
  }
  if (!sourceMaterial) {
    throw new Error(`Material ${SOURCE_MATERIAL_NAME} not found.`);
  }

  const primitiveCountsByZone = splitPrimitiveByDominantJointZone(
    document,
    mesh,
    mesh.listPrimitives()[0],
    skin
  );

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, Buffer.from(await io.writeBinary(document)));

  console.log('Created ant zone materials probe:', OUTPUT_GLB);
  console.log('Kept skeleton, weights, animations, node hierarchy, and vertex positions unchanged.');
  console.log('Primitive counts by zone:', primitiveCountsByZone);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
