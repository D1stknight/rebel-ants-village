// NFT collections the Hidden Village knows about.
// Source of truth = the Forge Collection Manager (forge-collections.html), which saves
// assets/forge-collections.json on the dev branch, so a collection added in the Manager works in the lobby / Forge /
// image cache with no code change.
// Nov 5: read from the copy deployed with the site (like the layouts since Oct 24), not from GitHub while the site runs:
// with GitHub unreachable (Nov 5: the repository hidden) Chumpz and Saints dropped out ("Unknown collection").
// A Manager save reaches a site with its next deploy (the dev preview after the push, production after dev -> main).
// GitHub (dev) is read only when this deploy has no copy, BUILTIN only when neither answers.
// Friend collections (Oct 20: Chumpz on ApeChain, Saints on Ethereum) live in assets/friend-collections.json, a file of
// their own: the Manager saves forge-collections.json whole from the page it runs on, so a save from an older page
// can't drop them, and older deployments (which read only forge-collections.json) never see them. Each one carries
// friend: true and the Forge species (ape / human) of its characters.

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const RAW = 'https://raw.githubusercontent.com/D1stknight/rebel-ants-village/dev/assets/';
const CONFIG_URL = RAW + 'forge-collections.json';
const FRIEND_URL = RAW + 'friend-collections.json';
const TTL_MS = 60 * 1000;
// this deploy's own copies (literal paths: the bundler puts both files in every function that imports this module)
const SITE_CONFIG = new URL('../assets/forge-collections.json', import.meta.url);
const SITE_FRIENDS = new URL('../assets/friend-collections.json', import.meta.url);

const BUILTIN = [
  {
    key: 'battle_for_colony',
    name: 'Rebel Ants: Battle for the Colony',
    chain: 'ethereum',
    contract: '0x96C1469c1C76E3Bb0e37c23a830d0Eea6BCf9221',
    openseaSlug: 'rebel-ants-battle-for-the-colony',
    forge: true
  }
];

export const ALCHEMY_NETWORK = {
  ethereum: 'eth-mainnet',
  base: 'base-mainnet',
  polygon: 'polygon-mainnet',
  arbitrum: 'arb-mainnet',
  optimism: 'opt-mainnet',
  apechain: 'apechain-mainnet'
};

// OpenSea's chain names (fallback provider only).
export const OPENSEA_CHAIN = { ethereum: 'ethereum', base: 'base', polygon: 'matic', arbitrum: 'arbitrum', optimism: 'optimism', apechain: 'ape_chain' };
const SPECIES = new Set(['ape', 'human']);

let memo = { at: 0, list: null };

function fromManager(config, friend = false) {
  const out = [];
  for (const c of Object.values((friend ? config?.friendCollections : config?.collections) || {})) {
    const key = String(c?.collectionKey || '');
    const contract = String(c?.contractAddress || '');
    const chain = String(c?.chain || 'ethereum').toLowerCase();
    if (!/^[a-z0-9_]{1,60}$/.test(key) || !/^0x[0-9a-fA-F]{40}$/.test(contract) || !ALCHEMY_NETWORK[chain]) continue;
    if (c.enabled === false) continue;
    out.push({
      key,
      name: String(c.displayName || key),
      chain,
      contract,
      openseaSlug: c.openSeaSlug ? String(c.openSeaSlug) : '',
      forge: c.forgeEnabled !== false,
      ...(friend ? { friend: true, species: SPECIES.has(c.species) ? c.species : 'human', village: String(c.village || '') } : {})
    });
  }
  return out;
}

async function readJson(url) {
  const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error('config ' + r.status);
  return r.json();
}

async function readSiteJson(fileUrl) {
  const places = [fileUrl, path.join(process.cwd(), 'assets', path.basename(fileUrl.pathname))];
  let last;
  for (const at of places) {
    try { return JSON.parse(await readFile(at, 'utf8')); } catch (e) { last = e; }
  }
  throw last;
}

// the deploy's own files never change: read once per warm instance (and a missing copy is not looked for again)
let site = null, siteMissing = false;

async function siteCollections() {
  if (site) return site;
  const [main, friends] = await Promise.allSettled([readSiteJson(SITE_CONFIG), readSiteJson(SITE_FRIENDS)]);
  if (main.status !== 'fulfilled') throw main.reason;
  const list = fromManager(main.value);
  if (!list.length) throw new Error('site config has no usable collections');
  if (friends.status === 'fulfilled') {
    for (const c of fromManager(friends.value, true)) if (!list.some((x) => x.key === c.key)) list.push(c);
  } else console.warn('Friend collections: no site copy:', friends.reason?.message);
  site = list;
  return list;
}

export async function loadCollections() {
  if (site) return site;
  if (!siteMissing) {
    try {
      return await siteCollections();
    } catch (e) {
      siteMissing = true;
      console.warn('Collections: no site copy, reading GitHub:', e?.message || e);
    }
  }
  if (memo.list && Date.now() - memo.at < TTL_MS) return memo.list;
  const [main, friends] = await Promise.allSettled([readJson(CONFIG_URL), readJson(FRIEND_URL)]);
  try {
    if (main.status !== 'fulfilled') throw main.reason;
    const list = fromManager(main.value);
    if (!list.length) throw new Error('config has no usable collections');
    if (friends.status === 'fulfilled') {
      for (const c of fromManager(friends.value, true)) if (!list.some((x) => x.key === c.key)) list.push(c);
    } else console.warn('Friend collections unavailable:', friends.reason?.message);
    // a friend file that failed to load is read again in ~10 s, not after the whole minute
    memo = { at: friends.status === 'fulfilled' ? Date.now() : Date.now() - TTL_MS + 10000, list };
  } catch (e) {
    console.warn('Collections config unavailable, using built-in list:', e.message);
    memo = { at: Date.now() - TTL_MS + 10000, list: memo.list || BUILTIN }; // retry in ~10 s
  }
  return memo.list;
}

export async function getCollection(key) {
  return (await loadCollections()).find((c) => c.key === key) || null;
}

export async function collectionByContract(chain, contract) {
  const addr = String(contract || '').toLowerCase();
  return (await loadCollections()).find((c) => c.chain === chain && c.contract.toLowerCase() === addr) || null;
}
