import { NodeIO } from '@gltf-transform/core';
import { textureCompress } from '@gltf-transform/functions';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import sharp from 'sharp';

// Allow up to 100MB body (Vercel Pro supports this)
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '100mb'
    }
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { data } = req.body;
  if (!data) {
    return res.status(400).json({ error: 'Missing data field' });
  }

  const inputBytes = Buffer.from(data, 'base64');
  const inputSize = inputBytes.length;

  try {
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
    const doc = await io.readBinary(new Uint8Array(inputBytes));

    await doc.transform(
      textureCompress({
        encoder: sharp,
        targetFormat: 'webp',
        quality: 80
      })
    );

    const outputBytes = await io.writeBinary(doc);
    const outputSize = outputBytes.length;
    const outputB64 = Buffer.from(outputBytes).toString('base64');

    return res.status(200).json({
      data: outputB64,
      inputSize,
      outputSize,
      savedBytes: inputSize - outputSize,
      savedPercent: Math.round((1 - outputSize / inputSize) * 100)
    });

  } catch (err) {
    console.error('compress-glb error:', err.message);
    // Return original untouched — upload still succeeds
    return res.status(200).json({
      data,
      inputSize,
      outputSize: inputSize,
      savedBytes: 0,
      savedPercent: 0,
      warning: err.message
    });
  }
}
