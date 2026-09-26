// NFT collections the Hidden Village knows about. Adding a collection = adding one entry here.
//   key       our id (used in URLs, Redis keys, Forge records)
//   chain     'ethereum' | 'base' | 'polygon' | 'arbitrum' | 'optimism'
//   contract  NFT contract address
//   openseaSlug  only used by the OpenSea fallback
//   forge     true = holders can forge 3D characters from it
export const COLLECTIONS = [
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
  optimism: 'opt-mainnet'
};

export function getCollection(key) {
  return COLLECTIONS.find((c) => c.key === key) || null;
}

export function collectionByContract(chain, contract) {
  const addr = String(contract || '').toLowerCase();
  return COLLECTIONS.find((c) => c.chain === chain && c.contract.toLowerCase() === addr) || null;
}
