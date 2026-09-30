// NFT data layer: Alchemy first, OpenSea as fallback, results cached in Redis.
// Works for every collection in _collections.mjs. Images are cached lazily (only tokens players actually use).
import { ALCHEMY_NETWORK, OPENSEA_CHAIN, loadCollections, getCollection } from './_collections.mjs';

const WALLET_TTL = 120;            // seconds
const META_TTL = 7 * 24 * 3600;    // token metadata is effectively immutable

function redisConfig() {
  return {
    url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '',
    token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || ''
  };
}

export async function redis(commands) {
  const { url, token } = redisConfig();
  if (!url || !token) return commands.map(() => ({ result: null }));
  try {
    const r = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(commands)
    });
    return await r.json();
  } catch (e) {
    return commands.map(() => ({ result: null }));
  }
}

async function cacheGet(key) {
  const [r] = await redis([['GET', key]]);
  try { return r?.result ? JSON.parse(r.result) : null; } catch (e) { return null; }
}

async function cacheSet(key, value, ttl) {
  await redis([ttl ? ['SET', key, JSON.stringify(value), 'EX', ttl] : ['SET', key, JSON.stringify(value)]]);
}

export function isAddress(v) {
  return /^0x[0-9a-fA-F]{40}$/.test(String(v || ''));
}

export function isTokenId(v) {
  return /^[0-9]{1,78}$/.test(String(v || ''));
}

export function ipfsToHttps(u) {
  if (!u) return '';
  const s = String(u);
  if (s.startsWith('ipfs://')) return 'https://ipfs.io/ipfs/' + s.slice(7).replace(/^ipfs\//, '');
  return s;
}

export function imageRoute(collectionKey, tokenId, size = 'full') {
  return `/api/nft-image?c=${encodeURIComponent(collectionKey)}&t=${encodeURIComponent(tokenId)}&s=${size}`;
}

function normalizeTraits(list) {
  return (Array.isArray(list) ? list : [])
    .filter((t) => t && (t.trait_type || t.traitType))
    .map((t) => ({ trait_type: String(t.trait_type || t.traitType), value: t.value == null ? null : t.value }));
}

function shape(col, tokenId, { name, description, traits, sourceImages }, source) {
  return {
    collectionKey: col.key,
    collectionName: col.name,
    chain: col.chain,
    contract: col.contract,
    tokenId: String(tokenId),
    name: name || `${col.name} #${tokenId}`,
    description: description || '',
    image: imageRoute(col.key, tokenId, 'full'),
    thumb: imageRoute(col.key, tokenId, 'thumb'),
    traits: normalizeTraits(traits),
    sourceImages: (sourceImages || []).filter(Boolean).map(ipfsToHttps),
    source
  };
}

function fromAlchemy(n, cols) {
  const addr = String(n.contract?.address || '').toLowerCase();
  const col = cols.find((c) => c.chain === n.__chain && c.contract.toLowerCase() === addr);
  if (!col) return null;
  const meta = n.raw?.metadata || {};
  return shape(col, n.tokenId, {
    name: n.name || meta.name,
    description: n.description || meta.description,
    traits: meta.attributes || meta.traits,
    sourceImages: [n.image?.cachedUrl, n.image?.pngUrl, n.image?.originalUrl, meta.image]
  }, 'alchemy');
}

function alchemyBase(chain) {
  const key = process.env.ALCHEMY_API_KEY;
  const net = ALCHEMY_NETWORK[chain];
  if (!key || !net) return null;
  return `https://${net}.g.alchemy.com/nft/v3/${key}`;
}

async function alchemyWallet(address, cols) {
  const byChain = {};
  for (const c of cols) (byChain[c.chain] = byChain[c.chain] || []).push(c);
  const out = [];
  for (const [chain, list] of Object.entries(byChain)) {
    const base = alchemyBase(chain);
    if (!base) throw new Error('Alchemy not configured');
    for (let i = 0; i < list.length; i += 45) {
      const chunk = list.slice(i, i + 45);
      let pageKey = '';
      let pages = 0;
      do {
        const p = new URLSearchParams({ owner: address, withMetadata: 'true', pageSize: '100' });
        chunk.forEach((c) => p.append('contractAddresses[]', c.contract));
        if (pageKey) p.set('pageKey', pageKey);
        const r = await fetch(`${base}/getNFTsForOwner?${p}`, { headers: { accept: 'application/json' } });
        if (!r.ok) throw new Error('Alchemy wallet ' + r.status);
        const j = await r.json();
        for (const n of j.ownedNfts || []) {
          const t = fromAlchemy({ ...n, __chain: chain }, chunk);
          if (t) out.push(t);
        }
        pageKey = j.pageKey || '';
        pages += 1;
      } while (pageKey && pages < 20);
    }
  }
  return out;
}

async function openseaWallet(address, cols) {
  const apiKey = process.env.OPENSEA_API_KEY;
  if (!apiKey) throw new Error('OpenSea not configured');
  const out = [];
  for (const col of cols) {
    if (!col.openseaSlug) continue;
    let next = '';
    let pages = 0;
    do {
      const chain = OPENSEA_CHAIN[col.chain] || col.chain;
      const url = `https://api.opensea.io/api/v2/chain/${chain}/account/${address}/nfts?collection=${col.openseaSlug}&limit=50${next ? '&next=' + encodeURIComponent(next) : ''}`;
      const r = await fetch(url, { headers: { accept: 'application/json', 'x-api-key': apiKey } });
      if (!r.ok) throw new Error('OpenSea wallet ' + r.status);
      const j = await r.json();
      for (const n of j.nfts || []) {
        out.push(shape(col, n.identifier, { name: n.name, description: n.description, traits: [], sourceImages: [n.image_url] }, 'opensea'));
      }
      next = j.next || '';
      pages += 1;
    } while (next && pages < 20);
  }
  return out;
}

// All NFTs from our collections held by a wallet. { tokens, source, cached }
export async function getWalletTokens(address, collectionKeys = null) {
  const all = await loadCollections();
  const cols = collectionKeys?.length ? all.filter((c) => collectionKeys.includes(c.key)) : all;
  if (!cols.length) return { tokens: [], source: 'none', cached: false };
  const addr = address.toLowerCase();
  const cacheKey = `nft:wallet:v1:${addr}:${cols.map((c) => c.key).sort().join(',')}`;
  const hit = await cacheGet(cacheKey);
  if (hit) return { ...hit, cached: true };
  let tokens;
  let source = 'alchemy';
  try {
    tokens = await alchemyWallet(addr, cols);
  } catch (e) {
    console.warn('Alchemy wallet failed, trying OpenSea:', e.message);
    tokens = await openseaWallet(addr, cols);
    source = 'opensea';
  }
  // Warm the per-token metadata cache so the lobby / Forge don't have to look each one up again.
  const cmds = tokens.filter((t) => t.traits.length).map((t) => ['SET', `nft:meta:v1:${t.collectionKey}:${t.tokenId}`, JSON.stringify(t), 'EX', META_TTL]);
  if (cmds.length) await redis(cmds);
  const result = { tokens, source };
  await cacheSet(cacheKey, result, WALLET_TTL);
  return { ...result, cached: false };
}

async function alchemyToken(col, tokenId) {
  const base = alchemyBase(col.chain);
  if (!base) throw new Error('Alchemy not configured');
  const p = new URLSearchParams({ contractAddress: col.contract, tokenId: String(tokenId), refreshCache: 'false' });
  const r = await fetch(`${base}/getNFTMetadata?${p}`, { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error('Alchemy token ' + r.status);
  const t = fromAlchemy({ ...(await r.json()), __chain: col.chain }, [col]);
  if (!t) throw new Error('Alchemy token not in collection');
  return t;
}

async function openseaToken(col, tokenId) {
  const apiKey = process.env.OPENSEA_API_KEY;
  if (!apiKey) throw new Error('OpenSea not configured');
  const r = await fetch(`https://api.opensea.io/api/v2/metadata/${OPENSEA_CHAIN[col.chain] || col.chain}/${col.contract}/${tokenId}`, {
    headers: { accept: 'application/json', 'x-api-key': apiKey }
  });
  if (!r.ok) throw new Error('OpenSea token ' + r.status);
  const j = await r.json();
  return shape(col, tokenId, { name: j.name, description: j.description, traits: j.traits || j.attributes, sourceImages: [j.image] }, 'opensea');
}

// One token's metadata + traits. Cached for a week.
export async function getToken(collectionKey, tokenId) {
  const col = await getCollection(collectionKey);
  if (!col) throw new Error('Unknown collection');
  const cacheKey = `nft:meta:v1:${col.key}:${tokenId}`;
  const hit = await cacheGet(cacheKey);
  if (hit && hit.traits?.length) return { ...hit, cached: true };
  let t;
  try {
    t = await alchemyToken(col, tokenId);
  } catch (e) {
    console.warn('Alchemy token failed, trying OpenSea:', e.message);
    t = await openseaToken(col, tokenId);
  }
  await cacheSet(cacheKey, t, META_TTL);
  return { ...t, cached: false };
}
