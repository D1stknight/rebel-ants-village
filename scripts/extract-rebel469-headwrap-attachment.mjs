import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const SOURCE_GLB = path.join(repoRoot, 'assets/forge/sources/rebel_469_static_source_a_pose_v1.glb');
const OUTPUT_GLB = path.join(repoRoot, 'assets/forge/attachments/headwrap_test.glb');
const MIN_AVERAGE_Y = 0.70;
const MIN_AVERAGE_Z = 0.00;

const COMPONENT_SIZE = {
  5121: 1,
  5123: 2,
  5125: 4,
  5126: 4
};

const TYPE_SIZE = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4
};

function align4(value) {
  return (value + 3) & ~3;
}

function parseGlb(buffer) {
  if (buffer.toString('utf8', 0, 4) !== 'glTF') {
    throw new Error('Input is not a GLB file.');
  }

  const version = buffer.readUInt32LE(4);
  if (version !== 2) {
    throw new Error(`Unsupported GLB version: ${version}`);
  }

  const length = buffer.readUInt32LE(8);
  let offset = 12;
  let json = null;
  let bin = null;

  while (offset < length) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.toString('utf8', offset + 4, offset + 8);
    offset += 8;

    if (chunkType === 'JSON') {
      json = JSON.parse(buffer.toString('utf8', offset, offset + chunkLength).replace(/\u0000+$/, ''));
    } else if (chunkType === 'BIN\u0000') {
      bin = buffer.subarray(offset, offset + chunkLength);
    }

    offset += chunkLength;
  }

  if (!json || !bin) {
    throw new Error('GLB must contain JSON and BIN chunks.');
  }

  return { json, bin };
}

function readAccessor(json, bin, accessorIndex) {
  const accessor = json.accessors[accessorIndex];
  const bufferView = json.bufferViews[accessor.bufferView];
  const componentSize = COMPONENT_SIZE[accessor.componentType];
  const componentCount = TYPE_SIZE[accessor.type];
  const byteStride = bufferView.byteStride || componentSize * componentCount;
  const byteOffset = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
  const values = [];

  for (let i = 0; i < accessor.count; i += 1) {
    const item = [];

    for (let j = 0; j < componentCount; j += 1) {
      const position = byteOffset + i * byteStride + j * componentSize;
      let value;

      if (accessor.componentType === 5126) value = bin.readFloatLE(position);
      else if (accessor.componentType === 5125) value = bin.readUInt32LE(position);
      else if (accessor.componentType === 5123) value = bin.readUInt16LE(position);
      else if (accessor.componentType === 5121) value = bin.readUInt8(position);
      else throw new Error(`Unsupported accessor component type: ${accessor.componentType}`);

      item.push(value);
    }

    values.push(componentCount === 1 ? item[0] : item);
  }

  return values;
}

function calculateBounds(positions) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];

  positions.forEach((position) => {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], position[axis]);
      max[axis] = Math.max(max[axis], position[axis]);
    }
  });

  return { min, max };
}

function writeFloatArray(values, components) {
  const buffer = Buffer.alloc(values.length * components * 4);
  let offset = 0;

  values.forEach((value) => {
    for (let i = 0; i < components; i += 1) {
      buffer.writeFloatLE(value[i], offset);
      offset += 4;
    }
  });

  return buffer;
}

function writeIndexArray(indices, componentType) {
  const componentSize = componentType === 5125 ? 4 : 2;
  const buffer = Buffer.alloc(indices.length * componentSize);

  indices.forEach((index, i) => {
    if (componentType === 5125) buffer.writeUInt32LE(index, i * componentSize);
    else buffer.writeUInt16LE(index, i * componentSize);
  });

  return buffer;
}

function pushAligned(chunks, buffer) {
  const byteOffset = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const paddingLength = align4(byteOffset) - byteOffset;

  if (paddingLength) {
    chunks.push(Buffer.alloc(paddingLength));
  }

  const alignedOffset = chunks.reduce((total, chunk) => total + chunk.length, 0);
  chunks.push(buffer);

  const afterOffset = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const endPaddingLength = align4(afterOffset) - afterOffset;

  if (endPaddingLength) {
    chunks.push(Buffer.alloc(endPaddingLength));
  }

  return {
    byteOffset: alignedOffset,
    byteLength: buffer.length
  };
}

function writeGlb(json, bin) {
  const jsonBufferRaw = Buffer.from(JSON.stringify(json));
  const jsonPaddingLength = align4(jsonBufferRaw.length) - jsonBufferRaw.length;
  const jsonBuffer = jsonPaddingLength
    ? Buffer.concat([jsonBufferRaw, Buffer.alloc(jsonPaddingLength, 0x20)])
    : jsonBufferRaw;
  const binPaddingLength = align4(bin.length) - bin.length;
  const binBuffer = binPaddingLength ? Buffer.concat([bin, Buffer.alloc(binPaddingLength)]) : bin;
  const totalLength = 12 + 8 + jsonBuffer.length + 8 + binBuffer.length;
  const header = Buffer.alloc(12);
  const jsonHeader = Buffer.alloc(8);
  const binHeader = Buffer.alloc(8);

  header.write('glTF', 0, 4, 'utf8');
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);

  jsonHeader.writeUInt32LE(jsonBuffer.length, 0);
  jsonHeader.write('JSON', 4, 4, 'utf8');

  binHeader.writeUInt32LE(binBuffer.length, 0);
  binHeader.write('BIN\u0000', 4, 4, 'utf8');

  return Buffer.concat([header, jsonHeader, jsonBuffer, binHeader, binBuffer]);
}

function main() {
  const sourceBuffer = fs.readFileSync(SOURCE_GLB);
  const { json: sourceJson, bin: sourceBin } = parseGlb(sourceBuffer);
  const primitive = sourceJson.meshes?.[0]?.primitives?.[0];

  if (!primitive) {
    throw new Error('Source GLB does not contain a mesh primitive.');
  }

  const positions = readAccessor(sourceJson, sourceBin, primitive.attributes.POSITION);
  const normals = primitive.attributes.NORMAL !== undefined
    ? readAccessor(sourceJson, sourceBin, primitive.attributes.NORMAL)
    : null;
  const uvs = primitive.attributes.TEXCOORD_0 !== undefined
    ? readAccessor(sourceJson, sourceBin, primitive.attributes.TEXCOORD_0)
    : null;
  const indices = primitive.indices !== undefined
    ? readAccessor(sourceJson, sourceBin, primitive.indices)
    : positions.map((_, index) => index);

  const selectedPositions = [];
  const selectedNormals = [];
  const selectedUvs = [];
  const selectedIndices = [];
  const vertexMap = new Map();

  function includeVertex(sourceIndex) {
    if (vertexMap.has(sourceIndex)) {
      return vertexMap.get(sourceIndex);
    }

    const targetIndex = selectedPositions.length;

    vertexMap.set(sourceIndex, targetIndex);
    selectedPositions.push(positions[sourceIndex].slice());

    if (normals) selectedNormals.push(normals[sourceIndex].slice());
    if (uvs) selectedUvs.push(uvs[sourceIndex].slice());

    return targetIndex;
  }

  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i];
    const b = indices[i + 1];
    const c = indices[i + 2];
    const averageY = (positions[a][1] + positions[b][1] + positions[c][1]) / 3;
    const averageZ = (positions[a][2] + positions[b][2] + positions[c][2]) / 3;

    if (averageY >= MIN_AVERAGE_Y && averageZ >= MIN_AVERAGE_Z) {
      selectedIndices.push(includeVertex(a), includeVertex(b), includeVertex(c));
    }
  }

  if (!selectedIndices.length) {
    throw new Error('No triangles matched the head/front extraction filter.');
  }

  const sourceBounds = calculateBounds(selectedPositions);
  const center = [
    (sourceBounds.min[0] + sourceBounds.max[0]) / 2,
    (sourceBounds.min[1] + sourceBounds.max[1]) / 2,
    (sourceBounds.min[2] + sourceBounds.max[2]) / 2
  ];

  selectedPositions.forEach((position) => {
    position[0] -= center[0];
    position[1] -= center[1];
    position[2] -= center[2];
  });

  const outputBounds = calculateBounds(selectedPositions);
  const chunks = [];
  const bufferViews = [];
  const accessors = [];
  const positionBuffer = writeFloatArray(selectedPositions, 3);
  const normalBuffer = normals ? writeFloatArray(selectedNormals, 3) : null;
  const uvBuffer = uvs ? writeFloatArray(selectedUvs, 2) : null;
  const indexComponentType = selectedPositions.length > 65535 ? 5125 : 5123;
  const indexBuffer = writeIndexArray(selectedIndices, indexComponentType);

  const positionView = pushAligned(chunks, positionBuffer);
  bufferViews.push({ buffer: 0, byteOffset: positionView.byteOffset, byteLength: positionView.byteLength, target: 34962 });
  accessors.push({
    bufferView: 0,
    componentType: 5126,
    count: selectedPositions.length,
    min: outputBounds.min,
    max: outputBounds.max,
    type: 'VEC3'
  });

  let normalAccessorIndex = null;
  if (normalBuffer) {
    const normalView = pushAligned(chunks, normalBuffer);
    normalAccessorIndex = accessors.length;
    bufferViews.push({ buffer: 0, byteOffset: normalView.byteOffset, byteLength: normalView.byteLength, target: 34962 });
    accessors.push({
      bufferView: bufferViews.length - 1,
      componentType: 5126,
      count: selectedNormals.length,
      type: 'VEC3'
    });
  }

  let uvAccessorIndex = null;
  if (uvBuffer) {
    const uvView = pushAligned(chunks, uvBuffer);
    uvAccessorIndex = accessors.length;
    bufferViews.push({ buffer: 0, byteOffset: uvView.byteOffset, byteLength: uvView.byteLength, target: 34962 });
    accessors.push({
      bufferView: bufferViews.length - 1,
      componentType: 5126,
      count: selectedUvs.length,
      type: 'VEC2'
    });
  }

  const indexView = pushAligned(chunks, indexBuffer);
  const indexAccessorIndex = accessors.length;
  bufferViews.push({ buffer: 0, byteOffset: indexView.byteOffset, byteLength: indexView.byteLength, target: 34963 });
  accessors.push({
    bufferView: bufferViews.length - 1,
    componentType: indexComponentType,
    count: selectedIndices.length,
    type: 'SCALAR'
  });

  const images = (sourceJson.images || []).map((image) => {
    const sourceView = sourceJson.bufferViews[image.bufferView];
    const imageBuffer = sourceBin.subarray(sourceView.byteOffset || 0, (sourceView.byteOffset || 0) + sourceView.byteLength);
    const imageView = pushAligned(chunks, imageBuffer);

    bufferViews.push({
      buffer: 0,
      byteOffset: imageView.byteOffset,
      byteLength: imageView.byteLength
    });

    return {
      name: image.name,
      mimeType: image.mimeType,
      bufferView: bufferViews.length - 1
    };
  });

  const attributes = { POSITION: 0 };
  if (normalAccessorIndex !== null) attributes.NORMAL = normalAccessorIndex;
  if (uvAccessorIndex !== null) attributes.TEXCOORD_0 = uvAccessorIndex;

  const outputJson = {
    asset: {
      generator: 'Rebel Ants Forge source-derived attachment extractor',
      version: '2.0'
    },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name: 'rebel_469_headwrap_attachment', mesh: 0 }],
    meshes: [{
      name: 'rebel_469_headwrap_attachment',
      primitives: [{
        attributes,
        indices: indexAccessorIndex,
        material: primitive.material || 0
      }]
    }],
    accessors,
    bufferViews,
    buffers: [{ byteLength: chunks.reduce((total, chunk) => total + chunk.length, 0) }],
    materials: JSON.parse(JSON.stringify(sourceJson.materials || [])),
    textures: JSON.parse(JSON.stringify(sourceJson.textures || [])),
    images,
    samplers: JSON.parse(JSON.stringify(sourceJson.samplers || []))
  };

  const outputBin = Buffer.concat(chunks);
  outputJson.buffers[0].byteLength = outputBin.length;

  fs.mkdirSync(path.dirname(OUTPUT_GLB), { recursive: true });
  fs.writeFileSync(OUTPUT_GLB, writeGlb(outputJson, outputBin));

  console.log('Extracted Rebel 469 headwrap attachment:', {
    source: path.relative(repoRoot, SOURCE_GLB),
    output: path.relative(repoRoot, OUTPUT_GLB),
    sourceTriangleCount: indices.length / 3,
    selectedTriangleCount: selectedIndices.length / 3,
    selectedVertexCount: selectedPositions.length,
    filter: {
      minAverageY: MIN_AVERAGE_Y,
      minAverageZ: MIN_AVERAGE_Z
    },
    sourceBounds,
    outputBounds
  });
}

main();
