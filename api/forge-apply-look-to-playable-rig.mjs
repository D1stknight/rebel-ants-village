import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { Accessor, NodeIO } from '@gltf-transform/core';
import { KHRDracoMeshCompression } from '@gltf-transform/extensions';
import { put } from '@vercel/blob';

const INPUT_GLB = 'assets/character/ant_idle_c.glb';
const ZONE_PROBE_GLB = 'assets/character/ant_idle_c_zone_materials_probe.glb';
const FALLBACK_OUTPUT_GLB = 'assets/character/ant_idle_c_rebel469_color_probe.glb';
const TARGET_MATERIAL_NAME = 'Material.001';
const FALLBACK_BASE_COLOR = [0.388, 0.176, 0.451, 1];

const ZONE_ORDER = [
  'head',
  'body',
  'leftArm',
  'rightArm',
  'leftLeg',
  'rightLeg'
];

const FALLBACK_ZONE_COLORS = {
  head: FALLBACK_BASE_COLOR,
  body: FALLBACK_BASE_COLOR,
  leftArm: FALLBACK_BASE_COLOR,
  rightArm: FALLBACK_BASE_COLOR,
  leftLeg: FALLBACK_BASE_COLOR,
  rightLeg: FALLBACK_BASE_COLOR
};

const ZONE_MATERIAL_NAME_BY_ZONE = {
  head: 'Zone_head',
  body: 'Zone_body',
  leftArm: 'Zone_leftArm',
  rightArm: 'Zone_rightArm',
  leftLeg: 'Zone_leftLeg',
  rightLeg: 'Zone_rightLeg'
};

function align4(value) {
  return (value + 3) & ~3;
}

function parseGlb(buffer) {
  if (buffer.toString('utf8', 0, 4) !== 'glTF') {
    throw new Error('Input is not a GLB file.');
  }

  const version = buffer.readUInt32LE(4);
  const chunks = [];
  let offset = 12;

  while (offset < buffer.length) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.readUInt32LE(offset + 4);
    const chunkData = buffer.subarray(offset + 8, offset + 8 + chunkLength);

    chunks.push({
      chunkLength,
      chunkType,
      chunkData
    });

    offset += 8 + chunkLength;
  }

  return { version, chunks };
}

function createGlb(version, chunks) {
  const totalLength = 12 + chunks.reduce((total, chunk) => {
    return total + 8 + chunk.chunkData.length;
  }, 0);
  const output = Buffer.alloc(totalLength);

  output.write('glTF', 0, 4, 'utf8');
  output.writeUInt32LE(version, 4);
  output.writeUInt32LE(totalLength, 8);

  let offset = 12;

  chunks.forEach((chunk) => {
    output.writeUInt32LE(chunk.chunkData.length, offset);
    output.writeUInt32LE(chunk.chunkType, offset + 4);
    chunk.chunkData.copy(output, offset + 8);
    offset += 8 + chunk.chunkData.length;
  });

  return output;
}

function getGlbJsonAndBinary(inputBuffer) {
  const glb = parseGlb(inputBuffer);
  const jsonChunk = glb.chunks.find((chunk) => chunk.chunkType === 0x4e4f534a);
  const binaryChunk = glb.chunks.find((chunk) => chunk.chunkType === 0x004e4942);

  if (!jsonChunk) {
    throw new Error('GLB JSON chunk not found.');
  }

  const jsonText = jsonChunk.chunkData.toString('utf8').replace(/\0+$/g, '').trimEnd();
  const gltf = JSON.parse(jsonText);

  return { glb, gltf, jsonChunk, binaryChunk };
}

async function fetchGlbAsBuffer(glbUrl) {
  if (!glbUrl) {
    throw new Error('Missing sourceGlbUrl.');
  }

  let resolvedGlbUrl = glbUrl;

  if (glbUrl.startsWith('/assets/') || glbUrl.startsWith('assets/')) {
    const normalizedLocalPath = glbUrl.replace(/^\/+/, '');
    resolvedGlbUrl = `https://raw.githubusercontent.com/D1stknight/rebel-ants-village/dev/${normalizedLocalPath}`;
  }

  const response = await fetch(resolvedGlbUrl);

  if (!response.ok) {
    throw new Error(`Could not fetch source GLB: ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

function getImageBufferFromGltf(gltf, binaryChunk, image) {
  if (!image) return null;

  if (typeof image.uri === 'string' && image.uri.startsWith('data:')) {
    const match = image.uri.match(/^data:[^;]+;base64,(.+)$/);
    if (!match) return null;
    return Buffer.from(match[1], 'base64');
  }

  if (typeof image.bufferView === 'number') {
    const bufferView = gltf.bufferViews?.[image.bufferView];

    if (!bufferView || !binaryChunk) return null;

    const byteOffset = bufferView.byteOffset || 0;
    const byteLength = bufferView.byteLength || 0;

    return Buffer.from(binaryChunk.chunkData.subarray(byteOffset, byteOffset + byteLength));
  }

  return null;
}

function normalizeColor(values) {
  return [
    Number((values[0] / 255).toFixed(4)),
    Number((values[1] / 255).toFixed(4)),
    Number((values[2] / 255).toFixed(4)),
    1
  ];
}

function buildZoneColorsFromPalette(palette) {
  const colors = palette.length ? palette : [FALLBACK_BASE_COLOR];

  return {
    head: colors[1] || colors[0] || FALLBACK_BASE_COLOR,
    body: colors[0] || FALLBACK_BASE_COLOR,
    leftArm: colors[2] || colors[0] || FALLBACK_BASE_COLOR,
    rightArm: colors[3] || colors[2] || colors[0] || FALLBACK_BASE_COLOR,
    leftLeg: colors[4] || colors[0] || FALLBACK_BASE_COLOR,
    rightLeg: colors[5] || colors[4] || colors[0] || FALLBACK_BASE_COLOR
  };
}

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
      throw new Error(`Draco decoder is required for ${INPUT_GLB}. Original error: ${firstError.message}`);
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

function createZoneMaterials(document, sourceMaterial, zoneColors = FALLBACK_ZONE_COLORS) {
  const materials = {};

  ZONE_ORDER.forEach((zone) => {
    const material = document.createMaterial(`Zone_${zone}`);

    material.setBaseColorFactor(zoneColors[zone] || FALLBACK_ZONE_COLORS[zone] || FALLBACK_BASE_COLOR);
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

function splitPrimitiveByDominantJointZone(document, mesh, primitive, skin, zoneColors = FALLBACK_ZONE_COLORS) {
  const jointsAccessor = primitive.getAttribute('JOINTS_0');
  const weightsAccessor = primitive.getAttribute('WEIGHTS_0');
  const indicesAccessor = primitive.getIndices();
  const positionAccessor = primitive.getAttribute('POSITION');
  const sourceMaterial = primitive.getMaterial();
  const skinJoints = skin.listJoints();
  const zoneMaterials = createZoneMaterials(document, sourceMaterial, zoneColors);
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

async function applyPlayableZoneLook(inputBuffer, zoneColors) {
  const dracoDependencies = await loadDracoDependency();
  const io = new NodeIO()
    .registerExtensions([KHRDracoMeshCompression])
    .registerDependencies(dracoDependencies);
  const document = await io.readBinary(inputBuffer);

  document.getRoot()
    .listExtensionsUsed()
    .find((extension) => extension.extensionName === KHRDracoMeshCompression.EXTENSION_NAME)
    ?.dispose();

  const root = document.getRoot();
  const mesh = root.listMeshes()[0];
  const skin = root.listSkins()[0];
  const sourceMaterial = root.listMaterials().find((material) => material.getName() === TARGET_MATERIAL_NAME);

  if (!mesh) throw new Error('No mesh found in playable GLB.');
  if (!skin) throw new Error('No skin found in playable GLB.');
  if (mesh.listPrimitives().length !== 1) {
    throw new Error(`Expected one primitive, found ${mesh.listPrimitives().length}.`);
  }
  if (!sourceMaterial) {
    throw new Error(`Material ${TARGET_MATERIAL_NAME} not found.`);
  }

  const primitiveCountsByZone = splitPrimitiveByDominantJointZone(
    document,
    mesh,
    mesh.listPrimitives()[0],
    skin,
    zoneColors
  );
  const outputBuffer = Buffer.from(await io.writeBinary(document));

  return {
    outputBuffer,
    primitiveCountsByZone
  };
}

function applyZoneColorsToZoneProbe(inputBuffer, zoneColors) {
  const { glb, gltf } = getGlbJsonAndBinary(inputBuffer);
  const materials = gltf.materials || [];
  const materialReport = {};

  ZONE_ORDER.forEach((zone) => {
    const materialName = ZONE_MATERIAL_NAME_BY_ZONE[zone];
    const material = materials.find((candidate) => candidate.name === materialName);

    if (!material) {
      materialReport[zone] = {
        materialName,
        found: false
      };
      return;
    }

    material.doubleSided = true;
    material.emissiveFactor = [0, 0, 0];
    delete material.emissiveTexture;
    material.pbrMetallicRoughness = material.pbrMetallicRoughness || {};
    material.pbrMetallicRoughness.baseColorFactor = zoneColors[zone] || FALLBACK_ZONE_COLORS[zone] || FALLBACK_BASE_COLOR;
    material.pbrMetallicRoughness.metallicFactor = 0;
    material.pbrMetallicRoughness.roughnessFactor = 0.65;

    materialReport[zone] = {
      materialName,
      found: true,
      baseColorFactor: material.pbrMetallicRoughness.baseColorFactor
    };
  });

  const updatedJsonBuffer = Buffer.from(JSON.stringify(gltf), 'utf8');
  const paddedJsonLength = align4(updatedJsonBuffer.length);
  const paddedJsonBuffer = Buffer.alloc(paddedJsonLength, 0x20);

  updatedJsonBuffer.copy(paddedJsonBuffer);

  const updatedChunks = glb.chunks.map((chunk) => {
    if (chunk.chunkType !== 0x4e4f534a) return chunk;

    return {
      chunkType: chunk.chunkType,
      chunkData: paddedJsonBuffer
    };
  });

  return {
    outputBuffer: createGlb(glb.version, updatedChunks),
    materialReport
  };
}

async function extractDominantColorsFromSourceGlb(sourceGlbUrl) {
  if (!sourceGlbUrl) {
    return {
      extractedColor: FALLBACK_BASE_COLOR,
      extractedPalette: [FALLBACK_BASE_COLOR],
      zoneColors: FALLBACK_ZONE_COLORS,
      extractedColorSource: 'fallback_missing_source_glb_url',
      materialName: null
    };
  }

  try {
    const sourceBuffer = await fetchGlbAsBuffer(sourceGlbUrl);
    const { gltf, binaryChunk } = getGlbJsonAndBinary(sourceBuffer);
    const materials = gltf.materials || [];
    const material = materials.find((candidate) => {
      return candidate?.pbrMetallicRoughness?.baseColorTexture;
    }) || materials[0];
    const textureIndex = material?.pbrMetallicRoughness?.baseColorTexture?.index;
    const texture = typeof textureIndex === 'number' ? gltf.textures?.[textureIndex] : null;
    const image = texture && typeof texture.source === 'number' ? gltf.images?.[texture.source] : null;
    const imageBuffer = getImageBufferFromGltf(gltf, binaryChunk, image);

    if (!imageBuffer) {
      throw new Error('Source GLB baseColorTexture image not found.');
    }

    const { data } = await sharp(imageBuffer)
      .resize(96, 96, { fit: 'inside' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const buckets = new Map();
    const bucketSize = 24;

    for (let i = 0; i < data.length; i += 3) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const brightness = (r + g + b) / 3;

      if (brightness < 8 || brightness > 248) continue;

      const key = [
        Math.round(r / bucketSize),
        Math.round(g / bucketSize),
        Math.round(b / bucketSize)
      ].join(':');
      const bucket = buckets.get(key) || { count: 0, r: 0, g: 0, b: 0 };

      bucket.count += 1;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      buckets.set(key, bucket);
    }

    const extractedPalette = [...buckets.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
      .map((bucket) => normalizeColor([
        bucket.r / bucket.count,
        bucket.g / bucket.count,
        bucket.b / bucket.count
      ]));

    while (extractedPalette.length < 6) {
      extractedPalette.push(extractedPalette[0] || FALLBACK_BASE_COLOR);
    }

    const zoneColors = buildZoneColorsFromPalette(extractedPalette);

    return {
      extractedColor: zoneColors.body,
      extractedPalette,
      zoneColors,
      extractedColorSource: 'source_glb_base_color_texture_dominant_palette',
      materialName: material?.name || null
    };
   } catch (error) {
    console.warn('Could not extract source GLB color, using fallback:', error);

    return {
      extractedColor: FALLBACK_BASE_COLOR,
      extractedPalette: [FALLBACK_BASE_COLOR],
      zoneColors: FALLBACK_ZONE_COLORS,
      extractedColorSource: 'fallback_rebel_469',
      materialName: null,
      extractionError: error.message
    };
  }
}

function applyPlayableLook(inputBuffer, baseColorFactor) {
  const { glb, gltf } = getGlbJsonAndBinary(inputBuffer);
  const materials = gltf.materials || [];
  const material = materials.find((candidate) => candidate.name === TARGET_MATERIAL_NAME) || materials[0];

  if (!material) {
    throw new Error('No material found in playable GLB.');
  }

  material.name = material.name || TARGET_MATERIAL_NAME;
  material.doubleSided = true;
  material.emissiveFactor = [0, 0, 0];
  delete material.emissiveTexture;
  material.pbrMetallicRoughness = material.pbrMetallicRoughness || {};
  material.pbrMetallicRoughness.baseColorFactor = baseColorFactor;
  material.pbrMetallicRoughness.metallicFactor = 0;
  material.pbrMetallicRoughness.roughnessFactor = 0.65;
  const updatedJsonBuffer = Buffer.from(JSON.stringify(gltf), 'utf8');
  const paddedJsonLength = align4(updatedJsonBuffer.length);
  const paddedJsonBuffer = Buffer.alloc(paddedJsonLength, 0x20);

  updatedJsonBuffer.copy(paddedJsonBuffer);

  const updatedChunks = glb.chunks.map((chunk) => {
    if (chunk.chunkType !== 0x4e4f534a) return chunk;

    return {
      chunkType: chunk.chunkType,
      chunkData: paddedJsonBuffer
    };
  });

  return createGlb(glb.version, updatedChunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const body = req.body || {};
    const sourceGlbUrl = body.sourceGlbUrl || body.glbUrl || '';
        const colorReport = await extractDominantColorsFromSourceGlb(sourceGlbUrl);
           let outputBuffer;
    let primitiveCountsByZone = null;
    let zoneMaterialReport = null;
    let playableLookMode = 'zone_materials_from_zone_probe';
    let zoneGenerationError = null;

    try {
      const zoneProbeBuffer = await fetchGlbAsBuffer(ZONE_PROBE_GLB);
      const zoneLook = applyZoneColorsToZoneProbe(zoneProbeBuffer, colorReport.zoneColors || FALLBACK_ZONE_COLORS);
      outputBuffer = zoneLook.outputBuffer;
      zoneMaterialReport = zoneLook.materialReport;
    } catch (zoneError) {
      console.warn('Could not apply zone colors to zone probe GLB, using single-color fallback:', zoneError);
      zoneGenerationError = zoneError.message || String(zoneError);
      const inputPath = path.join(process.cwd(), INPUT_GLB);
      const inputBuffer = await readFile(inputPath);
      outputBuffer = applyPlayableLook(inputBuffer, colorReport.extractedColor);
      playableLookMode = 'single_color_fallback';
    }

    const playableGlbPath = FALLBACK_OUTPUT_GLB;
    let playableGlbUrl = `/${FALLBACK_OUTPUT_GLB}`;

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const blobPath = `forge/playable-rigs/rebel_469_playable_look_${Date.now()}.glb`;
      const blob = await put(blobPath, outputBuffer, {
        access: 'public',
        contentType: 'model/gltf-binary'
      });

      playableGlbUrl = blob.url;
    }

      return res.status(200).json({
      ok: true,
      playableGlbUrl,
      playableGlbPath,
      sourceGlbUrl,
            extractedColor: colorReport.extractedColor,
            extractedPalette: colorReport.extractedPalette || [],
           zoneColors: colorReport.zoneColors || FALLBACK_ZONE_COLORS,
      primitiveCountsByZone,
      zoneMaterialReport,
      playableLookMode,
      zoneGenerationError,
      extractedColorSource: colorReport.extractedColorSource,
      materialName: colorReport.materialName,
      extractionError: colorReport.extractionError || null
    });
  } catch (error) {
    console.error('forge-apply-look-to-playable-rig error:', error);

    return res.status(500).json({
      ok: false,
      error: 'Could not apply look to playable rig',
      detail: error.message
    });
  }
}
