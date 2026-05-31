import { isAdminRequest } from './_admin-auth.mjs';

const MAX_LIMIT = 100;

function clean(value = '') {
  return String(value || '').trim();
}

function getOpenSeaApiKey() {
  return process.env.OPENSEA_API_KEY || '';
}

function normalizeChain(value = '') {
  const chain = clean(value).toLowerCase();
  if (!chain) return 'ethereum';
  if (chain === 'eth' || chain === 'mainnet') return 'ethereum';
  return chain.replace(/[^a-z0-9_-]/g, '');
}

function normalizeContract(value = '') {
  return clean(value).toLowerCase();
}

function normalizeLimit(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 50;
  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(n)));
}

function getNftImage(nft = {}) {
  return nft.image_url || nft.display_image_url || nft.image_preview_url || nft.metadata?.image || '';
}

function getNftTitle(nft = {}) {
  return nft.name || nft.identifier ? (nft.name || `Token #${nft.identifier}`) : 'NFT';
}

async function fetchOpenSeaContractNfts({ chain, contract, limit }) {
  const url = new URL(`https://api.opensea.io/api/v2/chain/${encodeURIComponent(chain)}/contract/${encodeURIComponent(contract)}/nfts`);
  url.searchParams.set('limit', String(limit));

  const headers = {
    Accept: 'application/json'
  };
  const apiKey = getOpenSeaApiKey();
  if (apiKey) headers['X-API-KEY'] = apiKey;

  const response = await fetch(url, { headers });
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }

  if (!response.ok) {
    throw new Error(data.detail || data.message || `OpenSea request failed. Status: ${response.status}`);
  }

  const nfts = Array.isArray(data.nfts) ? data.nfts : [];
  return nfts.map(nft => ({
    tokenId: String(nft.identifier || nft.token_id || ''),
    title: getNftTitle(nft),
    imageUrl: getNftImage(nft),
    collection: nft.collection || '',
    openseaUrl: nft.opensea_url || nft.permalink || ''
  })).filter(item => item.imageUrl || item.tokenId || item.title);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok:false, error:'Method not allowed' });
  }

  if (!isAdminRequest(req)) {
    return res.status(401).json({ ok:false, error:'Admin authentication required' });
  }

  try {
    const chain = normalizeChain(req.query?.chain);
    const contract = normalizeContract(req.query?.contract);
    const limit = normalizeLimit(req.query?.limit);

    if (!/^0x[a-f0-9]{40}$/.test(contract)) {
      return res.status(400).json({ ok:false, error:'Valid collection contract address required' });
    }

    const items = await fetchOpenSeaContractNfts({ chain, contract, limit });
    return res.status(200).json({
      ok:true,
      chain,
      contract,
      limit,
      source:'opensea',
      hasOpenSeaApiKey:Boolean(getOpenSeaApiKey()),
      items
    });
  } catch (err) {
    console.error('nft-collection error:', err);
    return res.status(500).json({ ok:false, error:err?.message || 'NFT collection fetch failed' });
  }
}
