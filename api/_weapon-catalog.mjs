// The collection's six weapons (Sept 29) and the NFT trait -> weapon rule, shared by the Forge weapon studio
// (forge-weapon.mjs) and the RAAP connection (raap-universe.mjs) without the studio's image libraries.
export const WEAPONS = {
  celestial_fang: { name: 'Celestial Fang', trait: 'Celestial-Fang', hilt: 'R', look: 'a PAIR of short swords (twin ninjato) in dark scabbards, hilts wrapped in green cord, carried crossed together' },
  dawns_light_arrows: { name: "Dawn's Light Arrows", trait: "Dawn's-Light-Arrows", hilt: 'R', look: 'a quiver full of black-fletched arrows' },
  eclipse_edge: { name: 'Eclipse Edge', trait: 'Eclipse-Edge', hilt: 'R', look: 'a single katana in a black scabbard, black wrapped hilt with a dark round guard' },
  soulrender: { name: 'Soulrender', trait: 'Soulrender', hilt: 'L', look: 'a single sword in a dark red-brown scabbard' },
  stormbringer_blade: { name: 'Stormbringer Blade', trait: 'Stormbringer-Blade', hilt: 'L', look: 'a katana in a dark red scabbard with a grey wrapped hilt' },
  whisper_of_dawn: { name: 'Whisper of Dawn', trait: 'Whisper-of-Dawn', hilt: 'L', look: 'a katana in a blue scabbard with a dark wrapped hilt' }
};

// NFT trait value -> { weaponId, side of the hilt (the character's own left / right shoulder) }
export function weaponForTrait(value) {
  const v = String(value || '');
  const base = v.replace(/-2$/, '');
  const id = Object.keys(WEAPONS).find((k) => WEAPONS[k].trait === base);
  if (!id) return null;
  const hilt = WEAPONS[id].hilt;
  return { weaponId: id, hilt: /-2$/.test(v) ? (hilt === 'R' ? 'L' : 'R') : hilt };
}
