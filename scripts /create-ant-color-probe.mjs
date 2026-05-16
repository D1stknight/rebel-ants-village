import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const INPUT_GLB = 'assets/character/ant_idle_c.glb';
const OUTPUT_GLB = 'assets/character/ant_idle_c_rebel469_color_probe.glb';
const TARGET_MATERIAL_NAME = 'Material.001';
const REBEL_469_BASE_COLOR = [0.388, 0.176, 0.451, 1];

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

async function main() {
  const inputPath = path.join(process.cwd(), INPUT_GLB);
  const outputPath = path.join(process.cwd(), OUTPUT_GLB);
  const inputBuffer = await readFile(inputPath);
  const glb = parseGlb(inputBuffer);
  const jsonChunk = glb.chunks.find((chunk) => chunk.chunkType === 0x4e4f534a);

  if (!jsonChunk) {
    throw new Error('GLB JSON chunk not found.');
  }

  const jsonText = jsonChunk.chunkData.toString('utf8').replace(/\0+$/g, '').trimEnd();
  const gltf = JSON.parse(jsonText);
  const materials = gltf.materials || [];
  const material = materials.find((candidate) => candidate.name === TARGET_MATERIAL_NAME) || materials[0];

  if (!material) {
    throw new Error('No material found in playable GLB.');
  }

  material.name = material.name || TARGET_MATERIAL_NAME;
  material.doubleSided = true;
  material.pbrMetallicRoughness = material.pbrMetallicRoughness || {};
  material.pbrMetallicRoughness.baseColorFactor = REBEL_469_BASE_COLOR;

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

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, createGlb(glb.version, updatedChunks));

  console.log('Created Rebel 469 color probe:', OUTPUT_GLB);
  console.log('Changed material only:', {
    materialName: material.name,
    baseColorFactor: material.pbrMetallicRoughness.baseColorFactor,
    keptBaseColorTexture: Boolean(material.pbrMetallicRoughness.baseColorTexture),
    keptNormalTexture: Boolean(material.normalTexture),
    doubleSided: material.doubleSided
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
