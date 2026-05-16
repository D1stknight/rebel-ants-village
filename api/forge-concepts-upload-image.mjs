import { put } from '@vercel/blob';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb'
    }
  }
};

function sanitizePathPart(value, fallback) {
  return String(value || fallback || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || fallback || 'unknown';
}

function parseImageDataUrl(imageDataUrl) {
  if (!imageDataUrl || typeof imageDataUrl !== 'string') {
    throw new Error('Missing imageDataUrl');
  }

  const match = imageDataUrl.match(/^data:(image\/(png|jpeg|webp));base64,(.+)$/);

  if (!match) {
    throw new Error('imageDataUrl must be a PNG, JPEG, or WEBP data URL');
  }

  const mimeType = match[1];
  const extension = match[2] === 'jpeg' ? 'jpg' : match[2];
  const base64 = match[3];
  const buffer = Buffer.from(base64, 'base64');

  if (!buffer.length) {
    throw new Error('Image data is empty');
  }

  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new Error('Image is too large for Forge Blob upload');
  }

  return {
    mimeType,
    extension,
    buffer,
    sizeBytes: buffer.length
  };
}

function buildBlobPath({ conceptId, rebelId, tokenId, collectionKey, extension }) {
  const safeCollection = sanitizePathPart(collectionKey, 'battle-for-colony');
  const safeToken = sanitizePathPart(tokenId || rebelId, 'unknown-token');
  const safeConcept = sanitizePathPart(conceptId, `concept-${Date.now()}`);

  return `forge/concepts/${safeCollection}/${safeToken}/${safeConcept}.${extension}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return res.status(500).json({
        ok: false,
        error: 'Missing BLOB_READ_WRITE_TOKEN'
      });
    }

    const {
      conceptId,
      rebelId,
      tokenId,
      collectionKey,
      imageDataUrl,
      originalSizeBytes,
      uploadSizeBytes,
      compressed
    } = req.body || {};

    if (!conceptId) {
      return res.status(400).json({ ok: false, error: 'Missing conceptId' });
    }

    if (!rebelId && !tokenId) {
      return res.status(400).json({ ok: false, error: 'Missing rebelId or tokenId' });
    }

    const parsedImage = parseImageDataUrl(imageDataUrl);
    const pathname = buildBlobPath({
      conceptId,
      rebelId,
      tokenId,
      collectionKey,
      extension: parsedImage.extension
    });

    const blob = await put(pathname, parsedImage.buffer, {
      access: 'public',
      contentType: parsedImage.mimeType,
      addRandomSuffix: false
    });

    return res.status(200).json({
      ok: true,
      imageStorage: 'vercel_blob',
      imageUrl: blob.url,
      imageBlobPath: pathname,
      blob,
      sizeBytes: parsedImage.sizeBytes,
      uploadReport: {
        originalSizeBytes: originalSizeBytes || null,
        uploadSizeBytes: uploadSizeBytes || parsedImage.sizeBytes,
        parsedSizeBytes: parsedImage.sizeBytes,
        compressed: compressed === true
      }
    });
  } catch (err) {
    console.error('forge-concepts-upload-image error:', {
      message: err && err.message ? err.message : 'Unknown error',
      stack: err && err.stack ? err.stack : null,
      hasBlobToken: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
      contentLength: req.headers?.['content-length'] || null,
      contentType: req.headers?.['content-type'] || null
    });

    return res.status(500).json({
      ok: false,
      error: 'Could not upload Forge concept image',
      detail: err && err.message ? err.message : 'Unknown error',
      debug: {
        hasBlobToken: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
        contentLength: req.headers?.['content-length'] || null,
        contentType: req.headers?.['content-type'] || null
      }
    });
  }
}
