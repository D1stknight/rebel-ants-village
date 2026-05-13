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

(function setupForgeSelectedConceptPanelExtension() {
  function isForgePage() {
    return Boolean(
      document.getElementById('forge-concepts-section') &&
      document.getElementById('forge-concepts-gallery')
    );
  }

  function ensureSelectedConceptStyles() {
    if (document.getElementById('forge-selected-concept-styles')) return;

    const style = document.createElement('style');
    style.id = 'forge-selected-concept-styles';
    style.textContent = `
      #forge-selected-concept-panel {
        margin-top: 18px;
        padding: 14px;
        border: 1px solid rgba(94,207,202,.22);
        background: rgba(94,207,202,.055);
        border-radius: 18px;
      }

      .forge-selected-empty {
        color: rgba(243,230,191,.72);
        font-size: 12px;
        line-height: 1.8;
        border: 1px dashed rgba(255,255,255,.14);
        border-radius: 14px;
        padding: 14px;
        margin-top: 12px;
      }

      .forge-selected-card {
        display: grid;
        grid-template-columns: minmax(110px,150px) 1fr;
        gap: 14px;
        align-items: center;
        margin-top: 12px;
      }

      .forge-selected-card img {
        width: 100%;
        aspect-ratio: 1 / 1.25;
        object-fit: cover;
        object-position: top center;
        border-radius: 14px;
        border: 1px solid rgba(94,207,202,.28);
        background: rgba(0,0,0,.24);
      }

      .forge-selected-kicker {
        color: #5ecfca;
        font-size: 10px;
        letter-spacing: 3px;
        text-transform: uppercase;
        font-weight: 800;
      }

      .forge-selected-meta {
        color: rgba(243,230,191,.76);
        font-size: 11px;
        line-height: 1.8;
        margin-top: 8px;
      }

      .forge-disabled-build-btn {
        margin-top: 12px;
        padding: 11px 14px;
        border: 1px solid rgba(200,146,42,.28);
        background: rgba(200,146,42,.08);
        color: rgba(243,230,191,.58);
        font-family: 'Cinzel', serif;
        font-size: 10px;
        letter-spacing: 2px;
        text-transform: uppercase;
        cursor: not-allowed;
      }

      @media (max-width: 700px) {
        .forge-selected-card {
          grid-template-columns: 1fr;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function ensureSelectedConceptPanel() {
    if (!isForgePage()) return null;

    let panel = document.getElementById('forge-selected-concept-panel');
    if (panel) return panel;

    const conceptsSection = document.getElementById('forge-concepts-section');
    if (!conceptsSection || !conceptsSection.parentNode) return null;

    panel = document.createElement('div');
    panel.id = 'forge-selected-concept-panel';
    panel.innerHTML = `
      <div class="section-title">Selected Concept</div>
      <div id="forge-selected-concept-content" class="forge-selected-empty">
        No concept selected yet. Select a saved concept to choose the version that will move forward into the 3D character step.
      </div>
    `;

    conceptsSection.parentNode.insertBefore(panel, conceptsSection);
    return panel;
  }

  async function renderSelectedConceptPanel() {
    ensureSelectedConceptStyles();

    const panel = ensureSelectedConceptPanel();
    const content = document.getElementById('forge-selected-concept-content');
    if (!panel || !content) return;

    if (
      typeof window.getSelectedForgeConceptStorageKey !== 'function' ||
      typeof window.loadForgeConcepts !== 'function'
    ) {
      return;
    }

    const selectedConceptId = localStorage.getItem(window.getSelectedForgeConceptStorageKey());
    const concepts = window.loadForgeConcepts();
    const concept = concepts.find((item) => (item.id || item.conceptId) === selectedConceptId);

    if (!selectedConceptId || !concept) {
      content.className = 'forge-selected-empty';
      content.innerHTML = 'No concept selected yet. Select a saved concept to choose the version that will move forward into the 3D character step.';
      return;
    }

    let imageUrl = '';

    try {
      if (typeof window.loadForgeConceptImageForDisplay === 'function') {
        imageUrl = await window.loadForgeConceptImageForDisplay(concept);
      } else if (typeof window.loadForgeConceptImage === 'function') {
        imageUrl = await window.loadForgeConceptImage(concept.id || concept.conceptId);
      }
    } catch(e) {
      console.warn('Could not load selected Forge concept image:', e);
    }

    const id = concept.id || concept.conceptId;
    const tokenText = concept.tokenId || concept.rebelId || '—';
    const colonyText = concept.colony || 'Unknown Colony';
    const isProductionReference =
      concept.forgeMode === 'production_reference' ||
      concept.conceptType === 'production_reference' ||
      concept.variantIntent === 'clean_3d_production_reference';

    const safeId = String(id).replace(/'/g, "\\'");
    const imgHtml = imageUrl
      ? `<img src="${imageUrl}" alt="Selected Forge concept">`
      : '<div class="forge-selected-empty">Selected image missing.</div>';

    const actionButtonHtml = isProductionReference
      ? `<button class="forge-disabled-build-btn forge-start-3d-build-btn" type="button" onclick="window.startForge3dBuild('${safeId}')">Start 3D Build</button>`
      : `<button class="forge-disabled-build-btn forge-build-production-btn" type="button" onclick="window.generateForgeProductionReference('${safeId}')">Create 3D Production Reference</button>`;

    const helperText = isProductionReference
      ? 'This production reference is ready to be queued for the future GLB character step.'
      : 'Create a cleaner production reference before starting the 3D build step.';

    content.className = 'forge-selected-card';
    content.innerHTML = `
      ${imgHtml}
      <div>
        <div class="forge-selected-kicker">Selected for Future 3D Build</div>
        <div class="forge-selected-meta">
          Colony: ${colonyText}<br>
          Token ID: ${tokenText}<br>
          ${helperText}
        </div>
        ${actionButtonHtml}
      </div>
    `;
  }

  async function generateForgeProductionReference(conceptId) {
    if (
      typeof window.loadForgeConcepts !== 'function' ||
      !window.forgeGenerationInput
    ) {
      return;
    }

    const concepts = window.loadForgeConcepts();
    const concept = concepts.find((item) => (item.id || item.conceptId) === conceptId);

    if (!concept) {
      if (typeof window.setForgeStatus === 'function') {
        window.setForgeStatus('Select a saved concept before creating a 3D production reference.', 'error');
      }
      return;
    }

    const activeButton =
      document.activeElement &&
      document.activeElement.tagName === 'BUTTON'
        ? document.activeElement
        : null;

    if (typeof window.setForgeGeneratingButton === 'function') {
      window.setForgeGeneratingButton(activeButton, true);
    }

    if (typeof window.setForgeStatusHtml === 'function') {
      window.setForgeStatusHtml('<span class="forge-loading-pulse">Creating 3D production reference... this can take a moment.</span>', '');
    }

    try {
      let selectedConceptImageDataUrl = '';
      let selectedConceptImageUrl = concept.imageUrl || '';

      if (typeof window.loadForgeConceptImage === 'function') {
        selectedConceptImageDataUrl = await window.loadForgeConceptImage(concept.id || concept.conceptId);
      }

      const response = await fetch('/api/forge-generate-production-reference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          generationInput: window.forgeGenerationInput,
          selectedConcept: concept,
          selectedConceptImageUrl,
          selectedConceptImageDataUrl
        })
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || data.detail || 'Production reference request failed');
      }

      window.lastForgeProductionReferenceResponse = data;

      if (data.productionImage?.dataUrl) {
        const previewWrap = document.getElementById('fullbody-preview-wrap');
        const previewImage = document.getElementById('fullbody-preview-image');
        const previewActions = document.getElementById('forge-preview-actions');

        const productionConcept = {
          id: `production_${Date.now()}`,
          conceptId: `production_${Date.now()}`,
          createdAt: new Date().toISOString(),
          imageDataUrl: data.productionImage.dataUrl,
          tokenId: concept.tokenId || window.forgeGenerationInput?.tokenId || null,
          rebelId: concept.rebelId || window.forgeGenerationInput?.rebelId || null,
          collectionKey: concept.collectionKey || window.forgeGenerationInput?.collectionKey || null,
          colony: concept.colony || window.forgeGenerationInput?.colony || null,
          bodyType: concept.bodyType || window.forgeGenerationInput?.bodyType || null,
          forgeMode: 'production_reference',
          variantIntent: 'clean_3d_production_reference',
          sourceConceptId: concept.id || concept.conceptId
        };

        window.currentForgeConcept = productionConcept;

        if (previewImage) {
          previewImage.src = data.productionImage.dataUrl;
        }

        if (previewWrap) {
          previewWrap.style.display = 'block';
          previewWrap.classList.add('open');
        }

        if (previewActions) {
          previewActions.style.display = 'flex';
        }
      }

      if (typeof window.setForgeStatus === 'function') {
        window.setForgeStatus('3D production reference generated. Click Save This Version to keep it.', 'success');
      }
    } catch(e) {
      console.warn('Forge production reference request failed:', e);

      if (typeof window.setForgeStatus === 'function') {
        window.setForgeStatus('Could not create 3D production reference.', 'error');
      }
    } finally {
      if (typeof window.setForgeGeneratingButton === 'function') {
        window.setForgeGeneratingButton(activeButton, false);
      }
    }
  }

  async function startForge3dBuild(conceptId) {
    if (
      typeof window.loadForgeConcepts !== 'function' ||
      !window.forgeGenerationInput
    ) {
      return;
    }

    const concepts = window.loadForgeConcepts();
    const concept = concepts.find((item) => (item.id || item.conceptId) === conceptId);

    if (!concept) {
      if (typeof window.setForgeStatus === 'function') {
        window.setForgeStatus('Select a saved production reference before starting a 3D build.', 'error');
      }
      return;
    }

    if (!concept.imageUrl) {
      if (typeof window.setForgeStatus === 'function') {
        window.setForgeStatus('Save this production reference to the server before starting a 3D build.', 'error');
      }
      return;
    }

    const activeButton =
      document.activeElement &&
      document.activeElement.tagName === 'BUTTON'
        ? document.activeElement
        : null;

    const originalButtonText = activeButton ? activeButton.textContent : 'Start 3D Build';

    if (activeButton) {
      activeButton.textContent = 'Queuing 3D Build...';
    }

    if (typeof window.setForgeGeneratingButton === 'function') {
      window.setForgeGeneratingButton(activeButton, true);
    }

    if (typeof window.setForgeStatusHtml === 'function') {
      window.setForgeStatusHtml('<span class="forge-loading-pulse">Queuing 3D build request...</span>', '');
    }

    try {
      const response = await fetch('/api/forge-build-3d-character', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          generationInput: window.forgeGenerationInput,
          selectedConcept: concept,
          productionReference: concept
        })
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || data.detail || '3D build request failed');
      }

      window.lastForge3dBuildResponse = data;

      const buildRequest = data.buildRequest || null;
      const buildId = buildRequest?.buildId || null;

      if (activeButton) {
        activeButton.textContent = 'Starting Meshy...';
      }

      if (typeof window.setForgeStatusHtml === 'function') {
        window.setForgeStatusHtml('<span class="forge-loading-pulse">3D build queued. Starting Meshy generation...</span>', '');
      }

      const meshyResponse = await fetch('/api/forge-3d-engine-meshy-create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          buildId,
          buildRequest,
          generationInput: window.forgeGenerationInput,
          productionReference: concept,
          selectedConcept: concept
        })
      });

      const meshyData = await meshyResponse.json();

      if (!meshyResponse.ok || !meshyData.ok) {
        throw new Error(meshyData.error || meshyData.detail || 'Meshy task start failed');
      }

      window.lastForgeMeshyCreateResponse = meshyData;

      if (activeButton) {
        activeButton.textContent = 'Meshy Started ✓';
      }

      if (typeof window.setForgeStatus === 'function') {
        window.setForgeStatus('3D build queued and Meshy generation started. The status panel will track the model build.', 'success');
      }

      if (typeof window.renderForge3dBuildStatusPanel === 'function') {
        window.renderForge3dBuildStatusPanel();
      }

      setTimeout(() => {
        if (activeButton) {
          activeButton.textContent = originalButtonText || 'Start 3D Build';
        }
      }, 2400);
    } catch(e) {
      console.warn('Forge 3D build or Meshy start failed:', e);

      if (activeButton) {
        activeButton.textContent = 'Start Failed';
      }

      if (typeof window.setForgeStatus === 'function') {
        window.setForgeStatus('Could not start the 3D build. Please try again.', 'error');
      }

      setTimeout(() => {
        if (activeButton) {
          activeButton.textContent = originalButtonText || 'Start 3D Build';
        }
      }, 2600);
    } finally {
      if (typeof window.setForgeGeneratingButton === 'function') {
        window.setForgeGeneratingButton(activeButton, false);
      }
    }
  }
  
  
  function wrapForgeConceptFunction(name) {
    const original = window[name];
    if (typeof original !== 'function' || original.__selectedConceptWrapped) return;

    const wrapped = function(...args) {
      const result = original.apply(this, args);
      Promise.resolve(result).finally(() => {
        renderSelectedConceptPanel();
      });
      return result;
    };

    wrapped.__selectedConceptWrapped = true;
    window[name] = wrapped;
  }

  function bootSelectedConceptPanel() {
    if (!isForgePage()) return;

    ensureSelectedConceptStyles();
    ensureSelectedConceptPanel();

    [
      'selectForgeConcept',
      'saveCurrentForgeConcept',
      'setCurrentForgeConceptSelected',
      'deleteForgeConcept',
      'renderForgeConceptGallery'
    ].forEach(wrapForgeConceptFunction);

    renderSelectedConceptPanel();
  }

  window.addEventListener('DOMContentLoaded', () => {
    setTimeout(bootSelectedConceptPanel, 0);
  });

    window.renderForgeSelectedConceptPanel = renderSelectedConceptPanel;
  window.generateForgeProductionReference = generateForgeProductionReference;
  window.startForge3dBuild = startForge3dBuild;
})();

(function setupForgeConceptModeSelectorExtension() {
  function isForgePage() {
    return Boolean(
      document.getElementById('forge-actions') &&
      document.getElementById('generate-btn')
    );
  }

  function getForgeModeStorageKey() {
    const collectionKey = window.forgeGenerationInput?.collectionKey || 'unknown_collection';
    const tokenId = window.forgeGenerationInput?.tokenId || window.forgeGenerationInput?.rebelId || 'unknown_token';
    return `rebelForgeMode:v1:${collectionKey}:${tokenId}`;
  }

  function getForgeMode() {
    return localStorage.getItem(getForgeModeStorageKey()) || 'full_body_concept';
  }

  function setForgeMode(mode) {
    localStorage.setItem(getForgeModeStorageKey(), mode);
    window.currentForgeMode = mode;

    if (window.forgeGenerationInput) {
      window.forgeGenerationInput.forgeMode = mode;
    }

    renderForgeModeSelector();
  }

  function ensureForgeModeStyles() {
    if (document.getElementById('forge-mode-selector-styles')) return;

    const style = document.createElement('style');
    style.id = 'forge-mode-selector-styles';
    style.textContent = `
      #forge-mode-selector {
        padding: 14px;
        border: 1px solid rgba(255,255,255,.10);
        background: rgba(255,255,255,.035);
        border-radius: 18px;
      }

      .forge-mode-title {
        color: #c8922a;
        font-family: 'Cinzel Decorative', serif;
        font-size: 14px;
        letter-spacing: 2px;
        margin-bottom: 8px;
      }

      .forge-mode-copy {
        color: rgba(243,230,191,.72);
        font-size: 11px;
        line-height: 1.7;
        margin-bottom: 12px;
      }

      .forge-mode-options {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
      }

      .forge-mode-option {
        text-align: left;
        padding: 11px;
        border: 1px solid rgba(255,255,255,.12);
        background: rgba(0,0,0,.22);
        color: rgba(243,230,191,.72);
        border-radius: 14px;
        cursor: pointer;
        font-family: 'Cinzel', serif;
      }

      .forge-mode-option.active {
        border-color: rgba(94,207,202,.65);
        background: rgba(94,207,202,.10);
        color: #f3e6bf;
        box-shadow: 0 0 20px rgba(94,207,202,.12);
      }

      .forge-mode-option.disabled {
        opacity: .48;
        cursor: not-allowed;
      }

      .forge-mode-name {
        font-size: 10px;
        letter-spacing: 2px;
        text-transform: uppercase;
        font-weight: 800;
      }

      .forge-mode-status {
        margin-top: 6px;
        font-size: 10px;
        color: rgba(243,230,191,.55);
      }

      @media (max-width: 900px) {
        .forge-mode-options {
          grid-template-columns: 1fr;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function ensureForgeModeSelector() {
    if (!isForgePage()) return null;

    let selector = document.getElementById('forge-mode-selector');
    if (selector) return selector;

    const actions = document.getElementById('forge-actions');
    if (!actions || !actions.parentNode) return null;

    selector = document.createElement('div');
    selector.id = 'forge-mode-selector';

    actions.parentNode.insertBefore(selector, actions);
    return selector;
  }

  function renderForgeModeSelector() {
    ensureForgeModeStyles();

    const selector = ensureForgeModeSelector();
    if (!selector) return;

    const currentMode = getForgeMode();
    window.currentForgeMode = currentMode;

    if (window.forgeGenerationInput) {
      window.forgeGenerationInput.forgeMode = currentMode;
    }

    selector.innerHTML = `
      <div class="forge-mode-title">Concept Mode</div>
      <div class="forge-mode-copy">
        Start with full-body concept art. Production A-pose and separate weapon generation will come later for the real 3D character pipeline.
      </div>

      <div class="forge-mode-options">
        <button
          class="forge-mode-option ${currentMode === 'full_body_concept' ? 'active' : ''}"
          type="button"
          onclick="window.setForgeMode('full_body_concept')"
        >
          <div class="forge-mode-name">Full-Body Concept</div>
          <div class="forge-mode-status">Available now</div>
        </button>

        <button
          class="forge-mode-option disabled"
          type="button"
          onclick="window.setForgeModeComingSoon('Production A-Pose')"
        >
          <div class="forge-mode-name">Production A-Pose</div>
          <div class="forge-mode-status">Coming soon</div>
        </button>

        <button
          class="forge-mode-option disabled"
          type="button"
          onclick="window.setForgeModeComingSoon('Weapon Separate')"
        >
          <div class="forge-mode-name">Weapon Separate</div>
          <div class="forge-mode-status">Coming soon</div>
        </button>
      </div>
    `;
  }

  function setForgeModeComingSoon(label) {
    if (typeof window.setForgeStatus === 'function') {
      window.setForgeStatus(`${label} mode is coming soon. Full-Body Concept mode is available now.`, 'error');
    }
  }

  function bootForgeModeSelector() {
    if (!isForgePage()) return;

    renderForgeModeSelector();
  }

  window.setForgeMode = setForgeMode;
  window.setForgeModeComingSoon = setForgeModeComingSoon;
  window.renderForgeModeSelector = renderForgeModeSelector;

  window.addEventListener('DOMContentLoaded', () => {
    setTimeout(bootForgeModeSelector, 0);
  });
})();

(function setupForgeVariantIntentExtension() {
  function isForgePage() {
    return Boolean(
      document.getElementById('fullbody-preview-wrap') &&
      document.getElementById('forge-preview-actions')
    );
  }

  function ensureForgeVariantStyles() {
    if (document.getElementById('forge-variant-intent-styles')) return;

    const style = document.createElement('style');
    style.id = 'forge-variant-intent-styles';
    style.textContent = `
      #forge-variant-intent-panel {
        margin-top: 14px;
        padding: 14px;
        border: 1px solid rgba(255,255,255,.10);
        background: rgba(255,255,255,.035);
        border-radius: 18px;
      }

      .forge-variant-title {
        color: #c8922a;
        font-family: 'Cinzel Decorative', serif;
        font-size: 14px;
        letter-spacing: 2px;
        margin-bottom: 8px;
      }

      .forge-variant-copy {
        color: rgba(243,230,191,.72);
        font-size: 11px;
        line-height: 1.7;
        margin-bottom: 12px;
      }

      .forge-variant-options {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
      }

      .forge-variant-option {
        text-align: left;
        padding: 11px;
        border: 1px solid rgba(255,255,255,.12);
        background: rgba(0,0,0,.22);
        color: rgba(243,230,191,.72);
        border-radius: 14px;
        cursor: pointer;
        font-family: 'Cinzel', serif;
      }

      .forge-variant-option.available:hover {
        border-color: rgba(94,207,202,.65);
        background: rgba(94,207,202,.10);
        color: #f3e6bf;
      }

      .forge-variant-option.disabled {
        opacity: .48;
        cursor: not-allowed;
      }

      .forge-variant-name {
        font-size: 10px;
        letter-spacing: 2px;
        text-transform: uppercase;
        font-weight: 800;
      }

      .forge-variant-status {
        margin-top: 6px;
        font-size: 10px;
        color: rgba(243,230,191,.55);
      }

      @media (max-width: 900px) {
        .forge-variant-options {
          grid-template-columns: 1fr;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function ensureForgeVariantPanel() {
    if (!isForgePage()) return null;

    let panel = document.getElementById('forge-variant-intent-panel');
    if (panel) return panel;

    const previewActions = document.getElementById('forge-preview-actions');
    if (!previewActions || !previewActions.parentNode) return null;

    panel = document.createElement('div');
    panel.id = 'forge-variant-intent-panel';

    previewActions.parentNode.insertBefore(panel, previewActions.nextSibling);
    return panel;
  }

   function renderForgeVariantPanel() {
    ensureForgeVariantStyles();

    const panel = ensureForgeVariantPanel();
    if (!panel) return;

    panel.innerHTML = `
      <div class="forge-variant-title">Generate Variant</div>
      <div class="forge-variant-copy">
        Refine the next version without needing to understand prompts. Pick the direction that best fixes the current render.
      </div>

      <div class="forge-variant-options">
        <button
          class="forge-variant-option available"
          type="button"
          onclick="window.generateForgeVariant('more_faithful_face')"
        >
          <div class="forge-variant-name">More Faithful Face</div>
          <div class="forge-variant-status">Available now</div>
        </button>

        <button
          class="forge-variant-option available"
          type="button"
          onclick="window.generateForgeVariant('stronger_warrior_body')"
        >
          <div class="forge-variant-name">Stronger Warrior Body</div>
          <div class="forge-variant-status">Available now</div>
        </button>

        <button
          class="forge-variant-option available"
          type="button"
          onclick="window.generateForgeVariant('cleaner_3d_reference')"
        >
          <div class="forge-variant-name">Cleaner 3D Reference</div>
          <div class="forge-variant-status">Available now</div>
        </button>
      </div>
    `;
  }

  async function generateForgeVariant(intent) {
    if (!window.forgeGenerationInput || typeof window.generatePreviewStub !== 'function') return;

    const activeButton =
      document.activeElement &&
      document.activeElement.tagName === 'BUTTON'
        ? document.activeElement
        : null;

    window.currentForgeTriggerButton = activeButton;
    window.currentForgeVariantIntent = intent;
    window.forgeGenerationInput.variantIntent = intent;

    try {
      await window.generatePreviewStub();
    } finally {
      window.currentForgeVariantIntent = 'default';
      window.forgeGenerationInput.variantIntent = 'default';
      window.currentForgeTriggerButton = null;
    }
  }

  function setForgeVariantComingSoon(label) {
    if (typeof window.setForgeStatus === 'function') {
      window.setForgeStatus(`${label} variant is coming soon. More Faithful Face is available now.`, 'error');
    }
  }

  function bootForgeVariantPanel() {
    if (!isForgePage()) return;

    renderForgeVariantPanel();
  }

  window.generateForgeVariant = generateForgeVariant;
  window.setForgeVariantComingSoon = setForgeVariantComingSoon;
  window.renderForgeVariantPanel = renderForgeVariantPanel;

  window.addEventListener('DOMContentLoaded', () => {
    setTimeout(bootForgeVariantPanel, 0);
  });
})();

(function setupForge3dBuildStatusPanelExtension() {
  function isForgePage() {
    return Boolean(
      document.getElementById('forge-selected-concept-panel') ||
      document.getElementById('forge-concepts-section')
    );
  }

  function ensure3dBuildStatusStyles() {
    if (document.getElementById('forge-3d-build-status-styles')) return;

    const style = document.createElement('style');
    style.id = 'forge-3d-build-status-styles';
    style.textContent = `
      #forge-3d-build-status-panel {
        margin-top: 18px;
        padding: 14px;
        border: 1px solid rgba(200,146,42,.24);
        background: rgba(200,146,42,.055);
        border-radius: 18px;
      }

      .forge-3d-build-empty {
        color: rgba(243,230,191,.72);
        font-size: 12px;
        line-height: 1.8;
        border: 1px dashed rgba(255,255,255,.14);
        border-radius: 14px;
        padding: 14px;
        margin-top: 12px;
      }

      .forge-3d-build-list {
        display: grid;
        gap: 10px;
        margin-top: 12px;
      }

      .forge-3d-build-row {
        border: 1px solid rgba(255,255,255,.12);
        background: rgba(0,0,0,.22);
        border-radius: 14px;
        padding: 12px;
      }

      .forge-3d-build-status {
        color: #5ecfca;
        font-size: 10px;
        letter-spacing: 2px;
        text-transform: uppercase;
        font-weight: 800;
      }

      .forge-3d-build-meta {
        color: rgba(243,230,191,.74);
        font-size: 11px;
        line-height: 1.7;
        margin-top: 6px;
      }

      .forge-3d-build-refresh-btn {
        margin-top: 12px;
        padding: 10px 12px;
        border: 1px solid rgba(94,207,202,.28);
        background: rgba(94,207,202,.08);
        color: #f3e6bf;
        font-family: 'Cinzel', serif;
        font-size: 10px;
        letter-spacing: 2px;
        text-transform: uppercase;
        cursor: pointer;
      }
    `;

    document.head.appendChild(style);
  }

  function ensure3dBuildStatusPanel() {
    if (!isForgePage()) return null;

    let panel = document.getElementById('forge-3d-build-status-panel');
    if (panel) return panel;

    const selectedPanel = document.getElementById('forge-selected-concept-panel');
    const conceptsSection = document.getElementById('forge-concepts-section');
    const anchor = selectedPanel || conceptsSection;

    if (!anchor || !anchor.parentNode) return null;

    panel = document.createElement('div');
    panel.id = 'forge-3d-build-status-panel';
    panel.innerHTML = `
      <div class="section-title">3D Build Status</div>
      <div id="forge-3d-build-status-content" class="forge-3d-build-empty">
        No 3D build requests yet. Select a saved production reference, then click Start 3D Build.
      </div>
      <button class="forge-3d-build-refresh-btn" type="button" onclick="window.renderForge3dBuildStatusPanel()">Refresh Build Status</button>
    `;

    anchor.parentNode.insertBefore(panel, anchor.nextSibling);
    return panel;
  }

  async function fetchForge3dBuildsFromServer() {
    const collectionKey = window.forgeGenerationInput?.collectionKey || 'battle_for_colony';
    const tokenId = window.forgeGenerationInput?.tokenId || '';
    const rebelId = window.forgeGenerationInput?.rebelId || '';

    const params = new URLSearchParams({ collectionKey });

    if (tokenId) {
      params.set('tokenId', tokenId);
    } else if (rebelId) {
      params.set('rebelId', rebelId);
    }

    const response = await fetch(`/api/forge-builds-list?${params.toString()}`);
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || data.detail || 'Could not load 3D build status');
    }

    return Array.isArray(data.builds) ? data.builds : [];
  }

  function formatBuildStatus(status) {
    if (status === 'queued_for_future_3d_generation') {
      return 'Queued for Future 3D Generation';
    }

    if (status === 'in_progress') {
      return 'In Progress';
    }

    if (status === 'completed') {
      return 'Completed';
    }

    if (status === 'failed') {
      return 'Failed';
    }

    return status || 'Unknown';
  }

  async function renderForge3dBuildStatusPanel() {
    ensure3dBuildStatusStyles();

    const panel = ensure3dBuildStatusPanel();
    const content = document.getElementById('forge-3d-build-status-content');

    if (!panel || !content) return;

    content.className = 'forge-3d-build-empty';
    content.innerHTML = 'Loading 3D build status...';

    try {
      const builds = await fetchForge3dBuildsFromServer();
      window.lastForge3dBuildListResponse = {
        ok: true,
        builds
      };

      if (!builds.length) {
        content.className = 'forge-3d-build-empty';
        content.innerHTML = 'No 3D build requests yet. Select a saved production reference, then click Start 3D Build.';
        return;
      }

      content.className = 'forge-3d-build-list';
      content.innerHTML = builds.slice(0, 5).map((build, index) => {
        const statusText = formatBuildStatus(build.status);
        const created = build.createdAt ? new Date(build.createdAt).toLocaleString() : 'Unknown time';
        const sourceConceptId = build.sourceConceptId || '—';

        return `
          <div class="forge-3d-build-row">
            <div class="forge-3d-build-status">${index === 0 ? 'Latest Build — ' : ''}${statusText}</div>
            <div class="forge-3d-build-meta">
              Source: ${sourceConceptId}<br>
              Created: ${created}<br>
              Output: Future GLB Character
            </div>
          </div>
        `;
      }).join('');
    } catch(e) {
      console.warn('Could not render Forge 3D build status:', e);

      window.lastForge3dBuildListResponse = {
        ok: false,
        error: e && e.message ? e.message : 'Unknown build status error'
      };

      content.className = 'forge-3d-build-empty';
      content.innerHTML = 'Could not load 3D build status yet.';
    }
  }

  function wrapStartForge3dBuild() {
    const original = window.startForge3dBuild;

    if (typeof original !== 'function' || original.__buildStatusWrapped) return;

    const wrapped = async function(...args) {
      const result = await original.apply(this, args);
      await renderForge3dBuildStatusPanel();
      return result;
    };

    wrapped.__buildStatusWrapped = true;
    window.startForge3dBuild = wrapped;
  }

  function boot3dBuildStatusPanel() {
    if (!isForgePage()) return;

    ensure3dBuildStatusStyles();
    ensure3dBuildStatusPanel();
    wrapStartForge3dBuild();
    renderForge3dBuildStatusPanel();
  }

  window.renderForge3dBuildStatusPanel = renderForge3dBuildStatusPanel;

  window.addEventListener('DOMContentLoaded', () => {
    setTimeout(boot3dBuildStatusPanel, 200);
  });
})();
