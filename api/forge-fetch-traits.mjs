import { isAdminRequest } from './_admin-auth.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  if (!isAdminRequest(req)) {
    return res.status(401).json({ ok: false, error: 'Admin authentication required' });
  }

  try {
    const { openSeaSlug } = req.body || {};

    if (!openSeaSlug || typeof openSeaSlug !== 'string') {
      return res.status(400).json({ ok: false, error: 'Missing OpenSea slug' });
    }

    const apiKey = process.env.OPENSEA_API_KEY;

    if (!apiKey) {
      throw new Error('Missing OPENSEA_API_KEY environment variable');
    }

    const response = await fetch(
      `https://api.opensea.io/api/v2/traits/${encodeURIComponent(openSeaSlug)}`,
      {
        headers: {
          accept: 'application/json',
          'x-api-key': apiKey
        }
      }
    );

    if (!response.ok) {
      throw new Error('OpenSea traits fetch failed. Status: ' + response.status);
    }

    const data = await response.json();
    const counts = data.counts || {};

    const traitCategories = Object.keys(counts).sort();

    const traitValues = Object.fromEntries(
      Object.entries(counts).map(([traitName, values]) => [
        traitName,
        Object.keys(values || {}).sort()
      ])
    );

    return res.status(200).json({
      ok: true,
      openSeaSlug,
      traitCategories,
      traitValues
    });
  } catch (err) {
    console.error('forge-fetch-traits error:', err);

    return res.status(500).json({
      ok: false,
      error: 'Could not fetch collection traits'
    });
  }
}
