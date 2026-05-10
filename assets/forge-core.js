const DEFAULT_BATTLE_FOR_COLONY_TRAIT_MAP = {
  bandana: 'Bandanas',
  bandanaTail: 'Bandana Tails',
  background: 'Color Backgrounds',
  dojo: 'Dojos',
  eyes: 'Eyes',
  foreheadBandana: 'Forehead Bandannas',
  fullFaceMask: 'Full Face Masks',
  colony: 'Gang Names',
  headAccessory: 'Head Accessories',
  head: 'Heads',
  outfit: 'Kimonos and Suits',
  mouthMask: 'Mouth Mask',
  mouth: 'Mouths',
  ninjaMask: 'Ninja Masks',
  rangerHelmet: 'Ranger Helmets',
  skullCap: 'Skull Caps',
  skullyFlap: 'Skully Flaps',
  weapon: 'Weapons'
};

const UNIVERSAL_FORGE_TRAIT_SLOTS = [
  'bandana',
  'bandanaTail',
  'background',
  'dojo',
  'eyes',
  'foreheadBandana',
  'fullFaceMask',
  'colony',
  'headAccessory',
  'head',
  'outfit',
  'mouthMask',
  'mouth',
  'ninjaMask',
  'rangerHelmet',
  'skullCap',
  'skullyFlap',
  'weapon'
];

function getForgeCollectionsConfig() {
  if (window._forgeCollectionsConfig) {
    return window._forgeCollectionsConfig;
  }

  try {
    const raw = localStorage.getItem('rebelAntsForgeCollections');
    return raw ? JSON.parse(raw) : null;
  } catch(e) {
    return null;
  }
}

function getCollectionTraitMap(collectionKey) {
  const config = getForgeCollectionsConfig();
  const savedCollection =
    config &&
    config.collections &&
    collectionKey &&
    config.collections[collectionKey]
      ? config.collections[collectionKey]
      : null;

  if (savedCollection && savedCollection.traitMap) {
    return savedCollection.traitMap;
  }

  if (collectionKey === 'battle_for_colony') {
    return DEFAULT_BATTLE_FOR_COLONY_TRAIT_MAP;
  }

  return {};
}

function buildTraitSlots(sourceTraits, collectionKey) {
  sourceTraits = sourceTraits || {};
  const traitMap = getCollectionTraitMap(collectionKey);

  return Object.fromEntries(
    UNIVERSAL_FORGE_TRAIT_SLOTS.map(slot => {
      const rawTraitName = traitMap[slot];
      return [slot, rawTraitName ? sourceTraits[rawTraitName] || null : null];
    })
  );
}

const COLONY_FORGE_PROFILES = {
  Samurai: {
    colonyId: 'samurai',
    displayName: 'Samurai',
    baseStyle: 'disciplined_swordsman',
    emblem: 'samurai',
    preferredBodyType: 'universal_ant_v1'
  },
  Ronin: {
    colonyId: 'ronin',
    displayName: 'Ronin',
    baseStyle: 'lone_swordsman',
    emblem: 'ronin',
    preferredBodyType: 'universal_ant_v1'
  },
  Bushi: {
    colonyId: 'bushi',
    displayName: 'Bushi',
    baseStyle: 'armored_warrior',
    emblem: 'bushi',
    preferredBodyType: 'universal_ant_v1'
  },
  Warrior: {
    colonyId: 'warrior',
    displayName: 'Warrior',
    baseStyle: 'battle_hardened_fighter',
    emblem: 'warrior',
    preferredBodyType: 'universal_ant_v1'
  },
  Shogun: {
    colonyId: 'shogun',
    displayName: 'Shogun',
    baseStyle: 'warlord_commander',
    emblem: 'shogun',
    preferredBodyType: 'universal_ant_v1'
  },
  Buke: {
    colonyId: 'buke',
    displayName: 'Buke',
    baseStyle: 'noble_guardian',
    emblem: 'buke',
    preferredBodyType: 'universal_ant_v1'
  },
  Kenshi: {
    colonyId: 'kenshi',
    displayName: 'Kenshi',
    baseStyle: 'master_bladesman',
    emblem: 'kenshi',
    preferredBodyType: 'universal_ant_v1'
  },
  Wokou: {
    colonyId: 'wokou',
    displayName: 'Wokou',
    baseStyle: 'raider_pirate',
    emblem: 'wokou',
    preferredBodyType: 'universal_ant_v1'
  },
  Ashigaru: {
    colonyId: 'ashigaru',
    displayName: 'Ashigaru',
    baseStyle: 'foot_soldier',
    emblem: 'ashigaru',
    preferredBodyType: 'universal_ant_v1'
  },
  Sohei: {
    colonyId: 'sohei',
    displayName: 'Sohei',
    baseStyle: 'monk_warrior',
    emblem: 'sohei',
    preferredBodyType: 'universal_ant_v1'
  },
  Yamabushi: {
    colonyId: 'yamabushi',
    displayName: 'Yamabushi',
    baseStyle: 'mountain_ascetic',
    emblem: 'yamabushi',
    preferredBodyType: 'universal_ant_v1'
  }
};

const WEAPON_FORGE_PROFILES = {
  'Celestial-Fang': {
    weaponId: 'celestial_fang',
    displayName: 'Celestial-Fang',
    family: 'blade'
  },
  'Celestial-Fang-2': {
    weaponId: 'celestial_fang_2',
    displayName: 'Celestial-Fang-2',
    family: 'blade'
  },
  "Dawn's-Light-Arrows": {
    weaponId: 'dawns_light_arrows',
    displayName: "Dawn's-Light-Arrows",
    family: 'ranged'
  },
  "Dawn's-Light-Arrows-2": {
    weaponId: 'dawns_light_arrows_2',
    displayName: "Dawn's-Light-Arrows-2",
    family: 'ranged'
  },
  'Eclipse-Edge': {
    weaponId: 'eclipse_edge',
    displayName: 'Eclipse-Edge',
    family: 'blade'
  },
  'Eclipse-Edge-2': {
    weaponId: 'eclipse_edge_2',
    displayName: 'Eclipse-Edge-2',
    family: 'blade'
  },
  'Soulrender': {
    weaponId: 'soulrender',
    displayName: 'Soulrender',
    family: 'blade'
  },
  'Stormbringer-Blade': {
    weaponId: 'stormbringer_blade',
    displayName: 'Stormbringer-Blade',
    family: 'blade'
  },
  'Stormbringer-Blade-2': {
    weaponId: 'stormbringer_blade_2',
    displayName: 'Stormbringer-Blade-2',
    family: 'blade'
  },
  'Whisper-of-Dawn': {
    weaponId: 'whisper_of_dawn',
    displayName: 'Whisper-of-Dawn',
    family: 'blade'
  },
  'Whisper-of-Dawn-2': {
    weaponId: 'whisper_of_dawn_2',
    displayName: 'Whisper-of-Dawn-2',
    family: 'blade'
  }
};

function resolveColonyForgeProfile(colonyName) {
  return colonyName && COLONY_FORGE_PROFILES[colonyName]
    ? COLONY_FORGE_PROFILES[colonyName]
    : null;
}

function resolveWeaponForgeProfile(weaponName) {
  return weaponName && WEAPON_FORGE_PROFILES[weaponName]
    ? WEAPON_FORGE_PROFILES[weaponName]
    : null;
}

function buildForgeLayers(traitSlots, colonyProfile, weaponProfile) {
  traitSlots = traitSlots || {};

  return {
    identity: {
      colony: traitSlots.colony || null,
      colonyProfile: colonyProfile || null
    },
    body: {
      head: traitSlots.head || null,
      mouth: traitSlots.mouth || null,
      eyes: traitSlots.eyes || null
    },
    outfit: {
      outfit: traitSlots.outfit || null
    },
    headwear: {
      skullCap: traitSlots.skullCap || null,
      skullyFlap: traitSlots.skullyFlap || null,
      rangerHelmet: traitSlots.rangerHelmet || null,
      foreheadBandana: traitSlots.foreheadBandana || null
    },
    facewear: {
      fullFaceMask: traitSlots.fullFaceMask || null,
      mouthMask: traitSlots.mouthMask || null,
      ninjaMask: traitSlots.ninjaMask || null
    },
    accessories: {
      bandana: traitSlots.bandana || null,
      bandanaTail: traitSlots.bandanaTail || null,
      headAccessory: traitSlots.headAccessory || null
    },
    weapon: {
      sourceWeapon: traitSlots.weapon || null,
      weaponProfile: weaponProfile || null
    },
    environment: {
      background: traitSlots.background || null,
      dojo: traitSlots.dojo || null
    }
  };
}

function buildCharacterBlueprint(rebel, character) {
  const sourceTraits = rebel.traits || {};
  const traitSlots = buildTraitSlots(sourceTraits, rebel.collectionKey || 'battle_for_colony');
  const colony = rebel.gangName || traitSlots.colony || null;
  const colonyProfile = resolveColonyForgeProfile(colony);
  const weaponProfile = resolveWeaponForgeProfile(traitSlots.weapon);
  const forgeLayers = buildForgeLayers(traitSlots, colonyProfile, weaponProfile);

  return {
    blueprintVersion: 'v1',
    rebelId: rebel.id || 'ant_1',
    tokenId: rebel.tokenId || null,
    collectionKey: rebel.collectionKey || 'battle_for_colony',
    name: rebel.name || 'Rebel #001',
    sourceImage: rebel.image || 'assets/lobby/ant_1.JPG',
    sourceType: rebel.tokenId ? 'nft' : 'default',
    sourceTraits,
    traitSlots,
    forgeLayers,
    colony,
    colonyProfile,
    weaponProfile,
    bodyType: colonyProfile?.preferredBodyType || 'universal_ant_v1',
    formType: character.formType || 'starter',
    formLabel: character.formLabel || 'Starter 3D Form',
    forgeStatus: character.hasGeneratedModel ? 'forged' : 'not_forged',
    bundleId: character.bundleId || 'starter_ant',
    hasGeneratedModel: character.hasGeneratedModel === true,
    parts: {
      helmet: null,
      mask: null,
      armor: null,
      cape: null,
      weaponLeft: null,
      weaponRight: null,
      emblem: colonyProfile?.emblem || null
    },
    colors: {
      body: null,
      armor: null,
      accent: null,
      eyes: null
    },
    confidence: {
      colony: colonyProfile ? 1 : null,
      weapon: weaponProfile ? 1 : null,
      parts: null,
      colors: null
    }
  };
}

function buildForgeGenerationInput(blueprint) {
  blueprint = blueprint || {};

  const collectionKey = blueprint.collectionKey || 'battle_for_colony';

  return {
    generationInputVersion: 'v1',
    blueprintVersion: blueprint.blueprintVersion || 'v1',
    rebelId: blueprint.rebelId || 'ant_1',
    tokenId: blueprint.tokenId || null,
    collectionKey,
    name: blueprint.name || 'Rebel #001',
    sourceType: blueprint.sourceType || 'default',
    sourceImage: blueprint.sourceImage || 'assets/lobby/ant_1.JPG',

    // Source art can be partial, but Forge output must become a playable full-body character.
    sourceFraming: collectionKey === 'battle_for_colony' ? 'chest_up' : 'unknown',
    targetOutput: 'full_body_3d_character',
    requiresFullBodyCompletion: true,

    bodyType: blueprint.bodyType || 'universal_ant_v1',
    forgeStatus: blueprint.forgeStatus || 'not_forged',
    sourceTraits: blueprint.sourceTraits || {},
    traitSlots: blueprint.traitSlots || {},
    forgeLayers: blueprint.forgeLayers || {},
    colony: blueprint.colony || null,
    colonyProfile: blueprint.colonyProfile || null,
    weaponProfile: blueprint.weaponProfile || null,
    parts: blueprint.parts || {},
    colors: blueprint.colors || {},
    confidence: blueprint.confidence || {}
  };
}

window.DEFAULT_BATTLE_FOR_COLONY_TRAIT_MAP = DEFAULT_BATTLE_FOR_COLONY_TRAIT_MAP;
window.UNIVERSAL_FORGE_TRAIT_SLOTS = UNIVERSAL_FORGE_TRAIT_SLOTS;
window.COLONY_FORGE_PROFILES = COLONY_FORGE_PROFILES;
window.WEAPON_FORGE_PROFILES = WEAPON_FORGE_PROFILES;
window.getForgeCollectionsConfig = getForgeCollectionsConfig;
window.getCollectionTraitMap = getCollectionTraitMap;
window.buildTraitSlots = buildTraitSlots;
window.resolveColonyForgeProfile = resolveColonyForgeProfile;
window.resolveWeaponForgeProfile = resolveWeaponForgeProfile;
window.buildForgeLayers = buildForgeLayers;
window.buildCharacterBlueprint = buildCharacterBlueprint;
window.buildForgeGenerationInput = buildForgeGenerationInput;
