import { blobPathOf, enforceRateLimit } from './_guard.mjs';
import { del } from '@vercel/blob';

function isSafeForgeBlobPath(pathname) {
  return (
    typeof pathname === 'string' &&
    pathname.startsWith('forge/concepts/') &&
    !pathname.includes('..') &&
    !pathname.startsWith('/')
  );
}

function readDeleteImagePayload(reqBody) {
  const body = reqBody || {};
  const imageBlobPath = body.imageBlobPath || body.pathname || null;
  const imageUrl = body.imageUrl || body.url || null;

  if (!imageBlobPath && !imageUrl) {
    throw new Error('Missing imageBlobPath or imageUrl');
  }

  if (imageBlobPath && !isSafeForgeBlobPath(imageBlobPath)) {
    throw new Error('Invalid Forge Blob path');
  }

  // Phase 0: a URL is only accepted if it points at our Blob store under forge/concepts/ (it used to delete any file).
  if (imageUrl) {
    const path = blobPathOf(imageUrl);
    if (!path || !isSafeForgeBlobPath(path)) throw new Error('Invalid Forge image URL');
  }

  return {
    imageBlobPath,
    imageUrl
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    res.setHeader('Allow', 'POST, DELETE');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  if (!(await enforceRateLimit(req, res, 'concept-img-del', 60, 3600, 'deletes'))) return;

  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return res.status(500).json({
        ok: false,
        error: 'Missing BLOB_READ_WRITE_TOKEN'
      });
    }

    const deleteRequest = readDeleteImagePayload(req.body || {});
    const target = deleteRequest.imageUrl || deleteRequest.imageBlobPath;

    await del(target);

    return res.status(200).json({
      ok: true,
      deleted: true,
      imageBlobPath: deleteRequest.imageBlobPath,
      imageUrl: deleteRequest.imageUrl,
      storageResult: {
        storage: 'vercel_blob',
        target
      }
    });
  } catch (err) {
    console.error('forge-concepts-delete-image error:', err);

    return res.status(500).json({
      ok: false,
      error: 'Could not delete Forge concept image from Blob',
      detail: err && err.message ? err.message : 'Unknown error'
    });
  }
}
