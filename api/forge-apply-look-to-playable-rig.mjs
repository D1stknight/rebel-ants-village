import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { put } from '@vercel/blob';

const INPUT_GLB = 'assets/character/ant_idle_c.glb';
const FALLBACK_OUTPUT_GLB = 'assets/character/ant_idle_c_rebel469_color_probe.glb';
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

function applyPlayableLook(inputBuffer) {
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
  material.emissiveFactor = [0, 0, 0];
  delete material.emissiveTexture;
  material.pbrMetallicRoughness = material.pbrMetallicRoughness || {};
  material.pbrMetallicRoughness.baseColorFactor = REBEL_469_BASE_COLOR;
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
    const inputPath = path.join(process.cwd(), INPUT_GLB);
    const inputBuffer = await readFile(inputPath);
    const outputBuffer = applyPlayableLook(inputBuffer);
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
      playableGlbPath
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
