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

      .forge-active-build-btn {
  margin-top: 12px;
  padding: 11px 14px;
  border: 1px solid rgba(94,207,202,.35);
  background: rgba(94,207,202,.12);
  color: #f3e6bf;
  font-family: 'Cinzel', serif;
  font-size: 10px;
  letter-spacing: 2px;
  text-transform: uppercase;
  cursor: pointer;
}

.forge-active-build-btn:hover {
  border-color: rgba(94,207,202,.7);
  background: rgba(94,207,202,.18);
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
  <div class="section-title">3D Build Status</div>
  <div id="forge-3d-build-status-content" class="forge-3d-build-empty">
    No 3D build requests yet. Select a saved production reference, then click Start 3D Build.
  </div>
  <button class="forge-3d-build-refresh-btn" type="button" onclick="window.renderForge3dBuildStatusPanel()">Refresh Build Status</button>
  <button class="forge-3d-build-refresh-btn" type="button" onclick="window.inspectStaticSourceGlb()">Inspect Static Source GLB</button>
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
      ? `<button class="forge-active-build-btn forge-start-3d-build-btn" type="button" onclick="window.startForge3dBuild('${safeId}')">Start 3D Build</button>`
      : `<button class="forge-active-build-btn forge-build-production-btn" type="button" onclick="window.generateForgeProductionReference('${safeId}')">Create 3D Production Reference</button>`;

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
      <div class="forge-variant-title">Generate Another Version</div>
      <div class="forge-variant-copy">
        Create a new version or refine the latest render before saving the one you like best.
      </div>

      <div class="forge-variant-options">
        <button
          class="forge-variant-option available"
          type="button"
          onclick="window.generatePreviewStub()"
        >
          <div class="forge-variant-name">Generate Another Version</div>
          <div class="forge-variant-status">Fresh render</div>
        </button>

        <button
          class="forge-variant-option available"
          type="button"
          onclick="window.generateForgeVariant('more_faithful_face')"
        >
          <div class="forge-variant-name">Generate with a More Faithful Face</div>
          <div class="forge-variant-status">Face accuracy</div>
        </button>

        <button
          class="forge-variant-option available"
          type="button"
          onclick="window.generateForgeVariant('stronger_warrior_body')"
        >
          <div class="forge-variant-name">Generate with a Stronger Warrior Body</div>
          <div class="forge-variant-status">Body strength</div>
        </button>

        <button
          class="forge-variant-option available"
          type="button"
          onclick="window.generateForgeVariant('cleaner_3d_reference')"
        >
          <div class="forge-variant-name">Generate for a Cleaner 3D Reference</div>
          <div class="forge-variant-status">3D prep</div>
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

      .forge-active-confirmed {
        border-color: rgba(88, 255, 166, .7) !important;
        background: rgba(88, 255, 166, .16) !important;
        color: #9dffc7 !important;
        cursor: default !important;
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

  function shouldPollMeshyBuild(build) {
    return Boolean(
      build &&
      build.engine?.provider === 'meshy' &&
      build.engine?.taskId &&
      [
        'submitted_to_meshy',
        'meshy_pending',
        'meshy_in_progress'
      ].includes(build.status)
    );
  }

  async function refreshMeshyBuildStatus(build) {
    const response = await fetch('/api/forge-3d-engine-meshy-status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        buildId: build.buildId,
        meshyTaskId: build.engine?.taskId
      })
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || data.detail || 'Could not refresh Meshy build status');
    }

    return data.buildRecord || build;
  }

   function shouldPollMeshyRigBuild(build) {
    const riggedGlbUrl =
      build?.output?.riggedGlbUrl ||
      build?.rigging?.riggedGlbUrl ||
      build?.rigging?.response?.result?.rigged_character_glb_url ||
      '';

    return Boolean(
      build &&
      build.rigging?.provider === 'meshy' &&
      build.rigging?.taskId &&
      (
        [
          'submitted_to_meshy_rigging',
          'meshy_rigging_pending',
          'meshy_rigging_in_progress'
        ].includes(build.status) ||
        (build.status === 'meshy_rigging_completed' && !riggedGlbUrl)
      )
    );
  }

  async function refreshMeshyRigStatus(build) {
    const response = await fetch('/api/forge-3d-engine-meshy-rig-status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        buildId: build.buildId,
        rigTaskId: build.rigging?.taskId
      })
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || data.detail || 'Could not refresh Meshy rigging status');
    }

    return data.buildRecord || build;
  }

  
   async function fetchForge3dBuildsWithMeshyRefresh() {
    const builds = await fetchForge3dBuildsFromServer();
    const refreshedBuilds = [];

    for (const build of builds) {
      let nextBuild = build;

      if (shouldPollMeshyBuild(nextBuild)) {
        try {
          nextBuild = await refreshMeshyBuildStatus(nextBuild);
        } catch(e) {
          console.warn('Could not refresh Meshy build:', e);
        }
      }

      if (shouldPollMeshyRigBuild(nextBuild)) {
        try {
          nextBuild = await refreshMeshyRigStatus(nextBuild);
        } catch(e) {
          console.warn('Could not refresh Meshy rigging build:', e);
        }
      }

      refreshedBuilds.push(nextBuild);
    }

    return refreshedBuilds;
  }

     function formatBuildStatus(status, build = null) {
    if (status === 'queued_for_future_3d_generation') {
      return 'Queued for Future 3D Generation';
    }

    if (status === 'submitted_to_meshy') {
      return 'Submitted to Meshy';
    }

    if (status === 'meshy_pending') {
      return 'Meshy Pending';
    }

    if (status === 'meshy_in_progress') {
      return 'Meshy In Progress';
    }

    if (status === 'submitted_to_meshy_rigging') {
      return 'Submitted to Meshy Rigging';
    }

    if (status === 'meshy_rigging_pending') {
      return 'Meshy Rigging Pending';
    }

    if (status === 'meshy_rigging_in_progress') {
      return 'Meshy Rigging In Progress';
    }

    if (status === 'meshy_rigging_completed') {
      return build?.output?.riggedGlbUrl ? 'Rigged GLB Ready' : 'Meshy Rigging Completed';
    }

    if (status === 'meshy_rigging_failed') {
      return 'Meshy Rigging Failed';
    }

    if (status === 'completed_stored_in_rebel_blob') {
      return 'Completed — Stored in Rebel Forge';
    }

    if (status === 'in_progress') {
      return 'In Progress';
    }

    if (status === 'completed') {
      return build?.output?.glbUrl ? 'Completed — GLB Ready' : 'Completed';
    }

    if (status === 'failed') {
      return 'Failed';
    }

    return status || 'Unknown';
  }

  async function storeForgeGlbInRebelBlob(buildId) {
    if (!buildId) return;

    const activeButton =
      document.activeElement &&
      document.activeElement.tagName === 'BUTTON'
        ? document.activeElement
        : null;

    const originalButtonText = activeButton ? activeButton.textContent : 'Store GLB in Rebel Forge';

    if (activeButton) {
      activeButton.textContent = 'Storing GLB...';
      activeButton.disabled = true;
    }

    try {
      const response = await fetch('/api/forge-3d-store-glb', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          buildId
        })
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || data.detail || 'Could not store GLB in Rebel Forge');
      }

      window.lastForgeStoreGlbResponse = data;

      if (activeButton) {
        activeButton.textContent = 'Stored ✓';
      }

      if (typeof window.setForgeStatus === 'function') {
        window.setForgeStatus('GLB stored in Rebel Forge Blob. This model is now saved under Rebel-controlled storage.', 'success');
      }

      await renderForge3dBuildStatusPanel();

      setTimeout(() => {
        if (activeButton) {
          activeButton.textContent = originalButtonText || 'Store GLB in Rebel Forge';
          activeButton.disabled = false;
        }
      }, 1800);
     } catch(e) {
      console.warn('Could not store Forge GLB:', e);

      if (activeButton) {
        activeButton.textContent = 'Store Failed';
      }

      if (typeof window.setForgeStatus === 'function') {
        window.setForgeStatus('Could not store this GLB in Rebel Forge yet.', 'error');
      }

      setTimeout(() => {
        if (activeButton) {
          activeButton.textContent = originalButtonText || 'Store GLB in Rebel Forge';
          activeButton.disabled = false;
        }
      }, 2200);
    }
  }

  async function storeForgeRiggedGlbInRebelBlob(buildId) {
    if (!buildId) return;

    const builds = window.lastForge3dBuildListResponse?.builds || [];
    const build = builds.find((item) => item.buildId === buildId);

    if (!build) {
      if (typeof window.setForgeStatus === 'function') {
        window.setForgeStatus('Could not find this 3D build to store the rigged GLB.', 'error');
      }
      return;
    }

    const riggedGlbUrl =
      build.output?.riggedRebelGlbUrl ||
      build.output?.riggedGlbUrl ||
      build.rigging?.riggedRebelGlbUrl ||
      build.rigging?.riggedGlbUrl ||
      build.rigging?.response?.result?.rigged_character_glb_url ||
      '';

    if (!riggedGlbUrl) {
      if (typeof window.setForgeStatus === 'function') {
        window.setForgeStatus('This build does not have a rigged GLB ready to store yet.', 'error');
      }
      return;
    }

    const activeButton =
      document.activeElement &&
      document.activeElement.tagName === 'BUTTON'
        ? document.activeElement
        : null;

    const originalButtonText = activeButton ? activeButton.textContent : 'Store Rigged GLB in Rebel Forge';

    if (activeButton) {
      activeButton.textContent = 'Storing Rigged GLB...';
      activeButton.disabled = true;
    }

    try {
      const response = await fetch('/api/forge-3d-store-rigged-glb', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          buildId,
          riggedGlbUrl
        })
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || data.detail || 'Could not store rigged GLB in Rebel Forge');
      }

      window.lastForgeStoreRiggedGlbResponse = data;

      if (activeButton) {
        activeButton.textContent = 'Rigged GLB Stored ✓';
      }

      if (typeof window.setForgeStatus === 'function') {
        window.setForgeStatus('Rigged GLB stored in Rebel Forge Blob. Set it as active again before entering the Village.', 'success');
      }

      await renderForge3dBuildStatusPanel();

      setTimeout(() => {
        if (activeButton) {
          activeButton.textContent = originalButtonText || 'Store Rigged GLB in Rebel Forge';
          activeButton.disabled = false;
        }
      }, 2200);
    } catch(e) {
      console.warn('Could not store rigged Forge GLB:', e);

      if (activeButton) {
        activeButton.textContent = 'Store Rigged Failed';
      }

      if (typeof window.setForgeStatus === 'function') {
        window.setForgeStatus('Could not store the rigged GLB in Rebel Forge yet.', 'error');
      }

      setTimeout(() => {
        if (activeButton) {
          activeButton.textContent = originalButtonText || 'Store Rigged GLB in Rebel Forge';
          activeButton.disabled = false;
        }
      }, 2400);
    }
  }

  async function storeForgeWalkingGlbInRebelBlob(buildId) {
    if (!buildId) return;

    const builds = window.lastForge3dBuildListResponse?.builds || [];
    const build = builds.find((item) => item.buildId === buildId);

    if (!build) {
      if (typeof window.setForgeStatus === 'function') {
        window.setForgeStatus('Could not find this 3D build to store the walking animation.', 'error');
      }
      return;
    }

    const walkingGlbUrl =
      build.output?.walkingGlbUrl ||
      build.output?.storedAnimations?.walking?.storedAnimationUrl ||
      build.rigging?.storedAnimations?.walking?.storedAnimationUrl ||
      build.rigging?.response?.result?.basic_animations?.walking_glb_url ||
      '';

    if (!walkingGlbUrl) {
      if (typeof window.setForgeStatus === 'function') {
        window.setForgeStatus('This build does not have a walking animation ready to store yet.', 'error');
      }
      return;
    }

    const activeButton =
      document.activeElement &&
      document.activeElement.tagName === 'BUTTON'
        ? document.activeElement
        : null;

    const originalButtonText = activeButton ? activeButton.textContent : 'Store Walking Animation';

    if (activeButton) {
      activeButton.textContent = 'Storing Walking...';
      activeButton.disabled = true;
    }

    try {
      const response = await fetch('/api/forge-3d-store-walking-glb', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          buildId,
          walkingGlbUrl
        })
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || data.detail || 'Could not store walking animation');
      }

      window.lastForgeStoreWalkingGlbResponse = data;

      if (activeButton) {
        activeButton.textContent = 'Walking Stored ✓';
        activeButton.disabled = true;
        activeButton.classList.add('forge-active-confirmed');
      }

      if (typeof window.setForgeStatus === 'function') {
        window.setForgeStatus('Walking animation stored in Rebel Forge Blob. Next we can test it inside the Village.', 'success');
      }

      await renderForge3dBuildStatusPanel();
    } catch(e) {
      console.warn('Could not store Forge walking animation:', e);

      if (activeButton) {
        activeButton.textContent = 'Walking Store Failed';
      }

      if (typeof window.setForgeStatus === 'function') {
        window.setForgeStatus('Could not store the walking animation in Rebel Forge yet.', 'error');
      }

      setTimeout(() => {
        if (activeButton) {
          activeButton.textContent = originalButtonText || 'Store Walking Animation';
          activeButton.disabled = false;
        }
      }, 2400);
    }
  }

  async function storeForgeRunningGlbInRebelBlob(buildId) {
    if (!buildId) return;

    const builds = window.lastForge3dBuildListResponse?.builds || [];
    const build = builds.find((item) => item.buildId === buildId);

    if (!build) {
      if (typeof window.setForgeStatus === 'function') {
        window.setForgeStatus('Could not find this 3D build to store the running animation.', 'error');
      }
      return;
    }

    const runningGlbUrl =
      build.output?.runningGlbUrl ||
      build.output?.storedAnimations?.running?.storedAnimationUrl ||
      build.rigging?.storedAnimations?.running?.storedAnimationUrl ||
      build.rigging?.response?.result?.basic_animations?.running_glb_url ||
      '';

    if (!runningGlbUrl) {
      if (typeof window.setForgeStatus === 'function') {
        window.setForgeStatus('This build does not have a running animation ready to store yet.', 'error');
      }
      return;
    }

    const activeButton =
      document.activeElement &&
      document.activeElement.tagName === 'BUTTON'
        ? document.activeElement
        : null;

    const originalButtonText = activeButton ? activeButton.textContent : 'Store Running Animation';

    if (activeButton) {
      activeButton.textContent = 'Storing Running...';
      activeButton.disabled = true;
    }

    try {
      const response = await fetch('/api/forge-3d-store-running-glb', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          buildId,
          runningGlbUrl
        })
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || data.detail || 'Could not store running animation');
      }

      window.lastForgeStoreRunningGlbResponse = data;

      if (activeButton) {
        activeButton.textContent = 'Running Stored ✓';
        activeButton.disabled = true;
        activeButton.classList.add('forge-active-confirmed');
      }

      if (typeof window.setForgeStatus === 'function') {
        window.setForgeStatus('Running animation stored in Rebel Forge Blob. Next we can test it inside the Village.', 'success');
      }

      await renderForge3dBuildStatusPanel();
    } catch(e) {
      console.warn('Could not store Forge running animation:', e);

      if (activeButton) {
        activeButton.textContent = 'Running Store Failed';
      }

      if (typeof window.setForgeStatus === 'function') {
        window.setForgeStatus('Could not store the running animation in Rebel Forge yet.', 'error');
      }

      setTimeout(() => {
        if (activeButton) {
          activeButton.textContent = originalButtonText || 'Store Running Animation';
          activeButton.disabled = false;
        }
      }, 2400);
    }
  }

  
     async function setForgeBuildAsActiveCharacter(buildId) {
    if (!buildId) return;

    const builds = window.lastForge3dBuildListResponse?.builds || [];
    const build = builds.find((item) => item.buildId === buildId);

    if (!build) {
      if (typeof window.setForgeStatus === 'function') {
        window.setForgeStatus('Could not find this 3D build to set as active.', 'error');
      }
      return;
    }

    const riggedGlbUrl =
      build.output?.riggedGlbUrl ||
      build.rigging?.riggedGlbUrl ||
      build.rigging?.response?.result?.rigged_character_glb_url ||
      '';

    const staticGlbUrl =
      build.output?.rebelGlbUrl ||
      build.output?.glbUrl ||
      build.engine?.glbUrl ||
      '';

    const activeGlbUrl = riggedGlbUrl || staticGlbUrl;
    const activeCharacterModelType = riggedGlbUrl ? 'rigged_forge_glb' : 'static_forge_glb';

    if (!activeGlbUrl) {
      if (typeof window.setForgeStatus === 'function') {
        window.setForgeStatus('This 3D build does not have a GLB ready yet.', 'error');
      }
      return;
    }

    const activeButton =
      document.activeElement &&
      document.activeElement.tagName === 'BUTTON'
        ? document.activeElement
        : null;

    const originalButtonText = activeButton ? activeButton.textContent : 'Set as Active Character';

    if (activeButton) {
      activeButton.textContent = 'Setting Active...';
      activeButton.disabled = true;
    }

    try {
      const response = await fetch('/api/forge-active-character-save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          build: {
            ...build,
            activeCharacterModelType,
            activeGlbUrl,
            output: {
              ...(build.output || {}),
              activeGlbUrl,
              activeCharacterModelType
            }
          },
          buildId: build.buildId,
          tokenId: build.tokenId || null,
          rebelId: build.rebelId || null,
          collectionKey: build.collectionKey || 'battle_for_colony',
          activeGlbUrl,
          glbBlobPath: build.output?.glbBlobPath || null
        })
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || data.detail || 'Could not set active character');
      }

      window.lastForgeActiveCharacterSaveResponse = data;

           if (activeButton) {
        activeButton.textContent = riggedGlbUrl ? 'Rigged Character Active ✓' : 'Active Character ✓';
        activeButton.disabled = true;
        activeButton.classList.add('forge-active-confirmed');
      }

      if (typeof window.setForgeStatus === 'function') {
        window.setForgeStatus(
          riggedGlbUrl
            ? 'The rigged Forge GLB is now set as the active character for the landing page and Village handoff.'
            : 'This Forge GLB is now set as the active character for the future landing page and Village handoff.',
          'success'
        );
      }
    } catch(e) {
      console.warn('Could not set Forge build as active character:', e);

      if (activeButton) {
        activeButton.textContent = 'Set Active Failed';
      }

      if (typeof window.setForgeStatus === 'function') {
        window.setForgeStatus('Could not set this GLB as the active character yet.', 'error');
      }

      setTimeout(() => {
        if (activeButton) {
          activeButton.textContent = originalButtonText || 'Set as Active Character';
          activeButton.disabled = false;
        }
      }, 2400);
    }
  }

  async function startMeshyRigTestForBuild(buildId) {
    if (!buildId) return;

    const builds = window.lastForge3dBuildListResponse?.builds || [];
    const build = builds.find((item) => item.buildId === buildId);

    if (!build) {
      if (typeof window.setForgeStatus === 'function') {
        window.setForgeStatus('Could not find this 3D build for rigging.', 'error');
      }
      return;
    }

    const glbUrl =
      build.output?.rebelGlbUrl ||
      build.output?.glbUrl ||
      build.engine?.glbUrl ||
      '';

    if (!glbUrl) {
      if (typeof window.setForgeStatus === 'function') {
        window.setForgeStatus('This build does not have a GLB ready for rigging yet.', 'error');
      }
      return;
    }

    const activeButton =
      document.activeElement &&
      document.activeElement.tagName === 'BUTTON'
        ? document.activeElement
        : null;

    const originalButtonText = activeButton ? activeButton.textContent : 'Start Meshy Rig Test';

    if (activeButton) {
      activeButton.textContent = 'Starting Rig Test...';
      activeButton.disabled = true;
    }

    try {
      const response = await fetch('/api/forge-3d-engine-meshy-rig-create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          buildId: build.buildId,
          glbUrl,
          heightMeters: 1.7
        })
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || data.detail || 'Could not start Meshy rig test');
      }

      window.lastForgeMeshyRigCreateResponse = data;

      if (activeButton) {
        activeButton.textContent = 'Rig Test Started ✓';
      }

      if (typeof window.setForgeStatus === 'function') {
        window.setForgeStatus('Meshy rigging test started. Next we will add a status check to see if it succeeds.', 'success');
      }

      if (typeof window.renderForge3dBuildStatusPanel === 'function') {
        await window.renderForge3dBuildStatusPanel();
      }

      setTimeout(() => {
        if (activeButton) {
          activeButton.textContent = originalButtonText || 'Start Meshy Rig Test';
          activeButton.disabled = false;
        }
      }, 2200);
    } catch(e) {
      console.warn('Could not start Meshy rig test:', e);

      if (activeButton) {
        activeButton.textContent = 'Rig Test Failed';
      }

      if (typeof window.setForgeStatus === 'function') {
        window.setForgeStatus('Could not start Meshy rigging test.', 'error');
      }

      setTimeout(() => {
        if (activeButton) {
          activeButton.textContent = originalButtonText || 'Start Meshy Rig Test';
          activeButton.disabled = false;
        }
      }, 2400);
    }
  }

   async function renderForge3dBuildStatusPanel() {
    ensure3dBuildStatusStyles();

    const panel = ensure3dBuildStatusPanel();
    const content = document.getElementById('forge-3d-build-status-content');

    if (!panel || !content) return;

    content.className = 'forge-3d-build-empty';
    content.innerHTML = 'Checking 3D build status...';

    try {
      const builds = await fetchForge3dBuildsWithMeshyRefresh();
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
        const statusText = formatBuildStatus(build.status, build);
        const created = build.createdAt ? new Date(build.createdAt).toLocaleString() : 'Unknown time';
        const sourceConceptId = build.sourceConceptId || '—';
        const glbUrl = build.output?.glbUrl || build.engine?.glbUrl || '';
        const rebelGlbUrl = build.output?.rebelGlbUrl || '';
        const activeGlbUrl = rebelGlbUrl || glbUrl;
               const rigTaskId = build.rigging?.taskId || '';

        const riggedMeshyGlbUrl =
          build.output?.riggedMeshyGlbUrl ||
          build.rigging?.response?.result?.rigged_character_glb_url ||
          '';

        const riggedRebelGlbUrl =
          build.output?.riggedRebelGlbUrl ||
          build.rigging?.riggedRebelGlbUrl ||
          '';

        const riggedGlbUrl =
          riggedRebelGlbUrl ||
          build.output?.riggedGlbUrl ||
          build.rigging?.riggedGlbUrl ||
          riggedMeshyGlbUrl ||
          '';

        const isRiggedStoredInRebelBlob =
          build.status === 'rigged_glb_stored_in_rebel_blob' ||
          build.output?.riggedSource === 'rebel_blob' ||
          Boolean(riggedRebelGlbUrl);
        const isStoredInRebelBlob =
          build.status === 'completed_stored_in_rebel_blob' ||
          build.output?.source === 'rebel_blob' ||
          Boolean(rebelGlbUrl);

        const openGlbHtml = activeGlbUrl
          ? `<br><a href="${activeGlbUrl}" target="_blank" rel="noopener" style="color:#5ecfca;">Open GLB</a>`
          : '';

        const downloadGlbHtml = activeGlbUrl
          ? ` · <a href="${activeGlbUrl}" download style="color:#5ecfca;">Download GLB</a>`
          : '';

        const storeGlbHtml = glbUrl && !isStoredInRebelBlob
          ? `<br><button class="forge-3d-build-refresh-btn" type="button" onclick="window.storeForgeGlbInRebelBlob('${build.buildId}')">Store GLB in Rebel Forge</button>`
          : '';

        const setActiveHtml = activeGlbUrl
          ? `<br><button class="forge-3d-build-refresh-btn" type="button" onclick="window.setForgeBuildAsActiveCharacter('${build.buildId}')">Set as Active Character</button>`
          : '';

        const rigTestHtml = activeGlbUrl && !rigTaskId
          ? `<br><button class="forge-3d-build-refresh-btn" type="button" onclick="window.startMeshyRigTestForBuild('${build.buildId}')">Start Meshy Rig Test</button>`
          : '';

        const rigStatusHtml = rigTaskId
          ? `<br>Rigging: ${formatBuildStatus(build.status, build)} ✓`
          : '';

                    const riggedGlbHtml = riggedGlbUrl
          ? `<br><a href="${riggedGlbUrl}" target="_blank" rel="noopener" style="color:#5ecfca;">Open Rigged GLB</a> · <a href="${riggedGlbUrl}" download style="color:#5ecfca;">Download Rigged GLB</a>`
          : '';

        const storeRiggedGlbHtml = riggedMeshyGlbUrl && !isRiggedStoredInRebelBlob
          ? `<br><button class="forge-3d-build-refresh-btn" type="button" onclick="window.storeForgeRiggedGlbInRebelBlob('${build.buildId}')">Store Rigged GLB in Rebel Forge</button>`
          : '';

               const walkingMeshyGlbUrl =
          build.rigging?.response?.result?.basic_animations?.walking_glb_url ||
          '';

        const walkingRebelGlbUrl =
          build.output?.walkingGlbUrl ||
          build.output?.storedAnimations?.walking?.storedAnimationUrl ||
          build.rigging?.storedAnimations?.walking?.storedAnimationUrl ||
          '';

        const walkingGlbUrl = walkingRebelGlbUrl || walkingMeshyGlbUrl;

        const walkingGlbHtml = walkingGlbUrl
          ? `<br><a href="${walkingGlbUrl}" target="_blank" rel="noopener" style="color:#5ecfca;">Open Walking GLB</a> · <a href="${walkingGlbUrl}" download style="color:#5ecfca;">Download Walking GLB</a>`
          : '';

        const storeWalkingGlbHtml = walkingMeshyGlbUrl && !walkingRebelGlbUrl
          ? `<br><button class="forge-3d-build-refresh-btn" type="button" onclick="window.storeForgeWalkingGlbInRebelBlob('${build.buildId}')">Store Walking Animation</button>`
          : '';

        const walkingStoredHtml = walkingRebelGlbUrl
          ? '<br>Walking Animation: Rebel Forge Blob ✓'
          : '';

        const runningMeshyGlbUrl =
          build.rigging?.response?.result?.basic_animations?.running_glb_url ||
          '';

        const runningRebelGlbUrl =
          build.output?.runningGlbUrl ||
          build.output?.storedAnimations?.running?.storedAnimationUrl ||
          build.rigging?.storedAnimations?.running?.storedAnimationUrl ||
          '';

        const runningGlbUrl = runningRebelGlbUrl || runningMeshyGlbUrl;

        const runningGlbHtml = runningGlbUrl
          ? `<br><a href="${runningGlbUrl}" target="_blank" rel="noopener" style="color:#5ecfca;">Open Running GLB</a> · <a href="${runningGlbUrl}" download style="color:#5ecfca;">Download Running GLB</a>`
          : '';

        const storeRunningGlbHtml = runningMeshyGlbUrl && !runningRebelGlbUrl
          ? `<br><button class="forge-3d-build-refresh-btn" type="button" onclick="window.storeForgeRunningGlbInRebelBlob('${build.buildId}')">Store Running Animation</button>`
          : '';

        const runningStoredHtml = runningRebelGlbUrl
          ? '<br>Running Animation: Rebel Forge Blob ✓'
          : '';
        const storedHtml = isStoredInRebelBlob
          ? '<br>Storage: Rebel Forge Blob ✓'
          : '';

        const riggedStoredHtml = isRiggedStoredInRebelBlob
          ? '<br>Rigged Storage: Rebel Forge Blob ✓'
          : '';
        return `
          <div class="forge-3d-build-row">
            <div class="forge-3d-build-status">${index === 0 ? 'Latest Build — ' : ''}${statusText}</div>
            <div class="forge-3d-build-meta">
              Source: ${sourceConceptId}<br>
              Created: ${created}<br>
              Output: ${activeGlbUrl ? 'GLB Ready' : 'Future GLB Character'}
              ${openGlbHtml}${downloadGlbHtml}
              ${storeGlbHtml}
              ${setActiveHtml}
              ${rigTestHtml}
                                      ${storedHtml}
              ${rigStatusHtml}
              ${riggedGlbHtml}
              ${storeRiggedGlbHtml}
              ${riggedStoredHtml}
                         ${walkingGlbHtml}
              ${storeWalkingGlbHtml}
              ${walkingStoredHtml}
              ${runningGlbHtml}
              ${storeRunningGlbHtml}
              ${runningStoredHtml}
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
  window.storeForgeGlbInRebelBlob = storeForgeGlbInRebelBlob;
  window.storeForgeRiggedGlbInRebelBlob = storeForgeRiggedGlbInRebelBlob;
  window.storeForgeWalkingGlbInRebelBlob = storeForgeWalkingGlbInRebelBlob;
  window.storeForgeRunningGlbInRebelBlob = storeForgeRunningGlbInRebelBlob;
  window.setForgeBuildAsActiveCharacter = setForgeBuildAsActiveCharacter;
  window.startMeshyRigTestForBuild = startMeshyRigTestForBuild;

  window.addEventListener('DOMContentLoaded', () => {
    setTimeout(boot3dBuildStatusPanel, 200);
  });
})();

(function setupForge3dPreviewPanelExtension() {

  let forge3dPreviewState = {
    renderer: null,
    scene: null,
    camera: null,
    controls: null,
    model: null,
    animationId: null,
    currentGlbUrl: ''
  };

  window.forge3dPreviewState = forge3dPreviewState;

  function isForgePage() {
    return Boolean(
      document.getElementById('forge-3d-build-status-panel') ||
      document.getElementById('forge-concepts-section')
    );
  }

  function ensure3dPreviewStyles() {
    if (document.getElementById('forge-3d-preview-styles')) return;

    const style = document.createElement('style');
    style.id = 'forge-3d-preview-styles';
    style.textContent = `
      #forge-3d-preview-panel {
        margin-top: 18px;
        padding: 14px;
        border: 1px solid rgba(94,207,202,.24);
        background: rgba(94,207,202,.055);
        border-radius: 18px;
      }

      .forge-3d-preview-empty {
        color: rgba(243,230,191,.72);
        font-size: 12px;
        line-height: 1.8;
        border: 1px dashed rgba(255,255,255,.14);
        border-radius: 14px;
        padding: 14px;
        margin-top: 12px;
      }

      #forge-3d-preview-stage {
        position: relative;
        width: 100%;
        height: 420px;
        margin-top: 12px;
        border: 1px solid rgba(255,255,255,.12);
        border-radius: 18px;
        overflow: hidden;
        background:
          radial-gradient(circle at top center, rgba(94,207,202,.11), transparent 42%),
          radial-gradient(circle at bottom center, rgba(200,146,42,.08), transparent 48%),
          rgba(0,0,0,.34);
      }

      #forge-3d-preview-stage canvas {
        display: block;
        width: 100%;
        height: 100%;
      }

      .forge-3d-preview-actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        margin-top: 12px;
      }

      .forge-3d-preview-btn {
        padding: 10px 12px;
        border: 1px solid rgba(94,207,202,.28);
        background: rgba(94,207,202,.08);
        color: #f3e6bf;
        font-family: 'Cinzel', serif;
        font-size: 10px;
        letter-spacing: 2px;
        text-transform: uppercase;
        cursor: pointer;
        text-decoration: none;
      }

      .forge-3d-preview-btn:hover {
        border-color: rgba(94,207,202,.7);
        background: rgba(94,207,202,.16);
      }

      .forge-3d-preview-note {
        color: rgba(243,230,191,.62);
        font-size: 11px;
        line-height: 1.7;
        margin-top: 10px;
      }
    `;

    document.head.appendChild(style);
  }

  function ensure3dPreviewPanel() {
    if (!isForgePage()) return null;

    let panel = document.getElementById('forge-3d-preview-panel');
    if (panel) return panel;

    const buildStatusPanel = document.getElementById('forge-3d-build-status-panel');
    const conceptsSection = document.getElementById('forge-concepts-section');
    const anchor = buildStatusPanel || conceptsSection;

    if (!anchor || !anchor.parentNode) return null;

    panel = document.createElement('div');
    panel.id = 'forge-3d-preview-panel';
    panel.innerHTML = `
      <div class="section-title">3D Preview</div>
      <div id="forge-3d-preview-content" class="forge-3d-preview-empty">
        No GLB is ready yet. Start a 3D Build, then refresh the build status until the GLB is ready.
      </div>
    `;

    anchor.parentNode.insertBefore(panel, anchor.nextSibling);
    return panel;
  }

    function getLatestGlbBuild() {
    const builds = window.lastForge3dBuildListResponse?.builds || [];

    const latestBuild = builds.find((build) => {
      return Boolean(build?.output?.glbUrl || build?.engine?.glbUrl);
    }) || null;

    if (latestBuild) {
      return latestBuild;
    }

    return {
      output: {
        glbUrl: 'assets/forge/sources/rebel_469_static_source_a_pose_v1.glb'
      },
      source: 'local_static_source_test'
    };
  }

  function stopForge3dPreviewLoop() {
    if (forge3dPreviewState.animationId) {
      cancelAnimationFrame(forge3dPreviewState.animationId);
      forge3dPreviewState.animationId = null;
    }
  }

  function clearForge3dPreview() {
    stopForge3dPreviewLoop();

    if (forge3dPreviewState.renderer) {
      forge3dPreviewState.renderer.dispose();
    }

    forge3dPreviewState = {
      renderer: null,
      scene: null,
      camera: null,
      controls: null,
      model: null,
      animationId: null,
      currentGlbUrl: ''
    };

    window.forge3dPreviewState = forge3dPreviewState;
  }

    async function loadThreeModules() {
    const threeModule = await import('https://esm.sh/three@0.160.0');
    const loaderModule = await import('https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js?deps=three@0.160.0');
    const controlsModule = await import('https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js?deps=three@0.160.0');

    return {
      THREE: threeModule,
      GLTFLoader: loaderModule.GLTFLoader,
      OrbitControls: controlsModule.OrbitControls
    };
  }

  function fitCameraToObject(THREE, camera, object, controls) {
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    const maxSize = Math.max(size.x, size.y, size.z) || 1;
    const fitHeightDistance = maxSize / (2 * Math.atan((Math.PI * camera.fov) / 360));
    const fitWidthDistance = fitHeightDistance / camera.aspect;
    const distance = 1.45 * Math.max(fitHeightDistance, fitWidthDistance);

    camera.position.set(center.x, center.y + maxSize * 0.15, center.z + distance);
    camera.near = distance / 100;
    camera.far = distance * 100;
    camera.updateProjectionMatrix();

    if (controls) {
      controls.target.copy(center);
      controls.update();
    }
  }

  async function renderThreeGlbPreview(glbUrl) {
    const stage = document.getElementById('forge-3d-preview-stage');
    if (!stage || !glbUrl) return;

    clearForge3dPreview();

    const { THREE, GLTFLoader, OrbitControls } = await loadThreeModules();

    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(
      45,
      stage.clientWidth / Math.max(stage.clientHeight, 1),
      0.01,
      1000
    );

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(stage.clientWidth, stage.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    stage.innerHTML = '';
    stage.appendChild(renderer.domElement);

    const ambient = new THREE.HemisphereLight(0xffffff, 0x1b2433, 2.4);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(3, 5, 4);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x5ecfca, 1.4);
    rimLight.position.set(-4, 3, -4);
    scene.add(rimLight);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = true;
    controls.enableZoom = true;

    const loader = new GLTFLoader();
    loader.setCrossOrigin('anonymous');

    const gltf = await new Promise((resolve, reject) => {
      loader.load(glbUrl, resolve, undefined, reject);
    });

    const model = gltf.scene;
    scene.add(model);

    fitCameraToObject(THREE, camera, model, controls);

    forge3dPreviewState = {
      renderer,
      scene,
      camera,
      controls,
      model,
      animationId: null,
      currentGlbUrl: glbUrl
    };

    window.forge3dPreviewState = forge3dPreviewState;

    function animate() {
      forge3dPreviewState.animationId = requestAnimationFrame(animate);

      if (forge3dPreviewState.controls) {
        forge3dPreviewState.controls.update();
      }

      if (forge3dPreviewState.renderer && forge3dPreviewState.scene && forge3dPreviewState.camera) {
        forge3dPreviewState.renderer.render(forge3dPreviewState.scene, forge3dPreviewState.camera);
      }
    }

    animate();

    window.addEventListener('resize', () => {
      if (!forge3dPreviewState.renderer || !forge3dPreviewState.camera || !stage) return;

      forge3dPreviewState.camera.aspect = stage.clientWidth / Math.max(stage.clientHeight, 1);
      forge3dPreviewState.camera.updateProjectionMatrix();
      forge3dPreviewState.renderer.setSize(stage.clientWidth, stage.clientHeight);
    }, { passive: true });
  }

  async function renderForge3dPreviewPanel() {
    ensure3dPreviewStyles();

    const panel = ensure3dPreviewPanel();
    const content = document.getElementById('forge-3d-preview-content');

    if (!panel || !content) return;

    const latestGlbBuild = getLatestGlbBuild();
   const glbUrl = 'assets/forge/sources/rebel_469_static_source_a_pose_v1.glb';

    if (!glbUrl) {
      clearForge3dPreview();
      content.className = 'forge-3d-preview-empty';
      content.innerHTML = 'No GLB is ready yet. Start a 3D Build, then refresh the build status until the GLB is ready.';
      return;
    }

    content.className = '';
    content.innerHTML = `
      <div id="forge-3d-preview-stage">
        <div class="forge-3d-preview-empty">Loading 3D preview...</div>
      </div>

      <div class="forge-3d-preview-actions">
        <a class="forge-3d-preview-btn" href="${glbUrl}" target="_blank" rel="noopener">Open GLB</a>
        <a class="forge-3d-preview-btn" href="${glbUrl}" download>Download GLB</a>
        <button class="forge-3d-preview-btn" type="button" onclick="window.startForgeRigPlacementMode()">Start Rig Placement</button>
      </div>

      <div class="forge-3d-preview-note">
        This is a live Three.js preview of the generated GLB. Use this to inspect the model before we store it permanently and connect it to the Village.
      </div>
    `;

    try {
      await renderThreeGlbPreview(glbUrl);
    } catch(e) {
      console.warn('Could not render Forge 3D GLB preview:', e);
      content.innerHTML = `
        <div class="forge-3d-preview-empty">
          GLB is ready, but the in-page 3D preview could not load. You can still open or download the GLB below.
        </div>

        <div class="forge-3d-preview-actions">
          <a class="forge-3d-preview-btn" href="${glbUrl}" target="_blank" rel="noopener">Open GLB</a>
          <a class="forge-3d-preview-btn" href="${glbUrl}" download>Download GLB</a>
        </div>
      `;
    }
  }

  function wrapBuildStatusRenderer() {
    const original = window.renderForge3dBuildStatusPanel;

    if (typeof original !== 'function' || original.__forge3dPreviewWrapped) return;

    const wrapped = async function(...args) {
      const result = await original.apply(this, args);
      await renderForge3dPreviewPanel();
      return result;
    };

    wrapped.__forge3dPreviewWrapped = true;
    window.renderForge3dBuildStatusPanel = wrapped;
  }

  function boot3dPreviewPanel() {
    if (!isForgePage()) return;

    ensure3dPreviewStyles();
    ensure3dPreviewPanel();
    wrapBuildStatusRenderer();

    setTimeout(() => {
      renderForge3dPreviewPanel();
    }, 400);
  }

  window.renderForge3dPreviewPanel = renderForge3dPreviewPanel;

  window.startForgeRigPlacementMode = async function() {
    const previewState = window.forge3dPreviewState;

    if (!previewState?.scene || !previewState?.model) {
      alert('Load a 3D preview before starting Rig Placement Mode.');
      return;
    }

    const { THREE } = await loadThreeModules();

    if (window.forgeRigPlacementState?.markers?.length) {
      window.forgeRigPlacementState.markers.forEach((marker) => {
        marker.parent?.remove(marker);
        marker.geometry?.dispose?.();
        marker.material?.dispose?.();
      });
    }

    if (window.forgeRigPlacementState?.lines?.length) {
      window.forgeRigPlacementState.lines.forEach((line) => {
        line.parent?.remove(line);
        line.geometry?.dispose?.();
        line.material?.dispose?.();
      });
    }

    const box = new THREE.Box3().setFromObject(previewState.model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const markerRadius = Math.max(size.x, size.y, size.z) * 0.025 || 0.05;

    const markerMaterial = new THREE.MeshBasicMaterial({
      color: 0x5ecfca,
      depthTest: false
    });

    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0xf3e6bf,
      depthTest: false,
      transparent: true,
      opacity: 0.8
    });

    const markerPositions = {
      hips: [center.x, box.min.y + size.y * 0.5, center.z],
      spine: [center.x, box.min.y + size.y * 0.62, center.z],
      chest: [center.x, box.min.y + size.y * 0.74, center.z],
      neck: [center.x, box.min.y + size.y * 0.84, center.z],
      head: [center.x, box.min.y + size.y * 0.92, center.z],

      'left shoulder': [center.x - size.x * 0.22, box.min.y + size.y * 0.74, center.z],
      'left elbow': [center.x - size.x * 0.38, box.min.y + size.y * 0.62, center.z],
      'left hand': [center.x - size.x * 0.5, box.min.y + size.y * 0.52, center.z],

      'right shoulder': [center.x + size.x * 0.22, box.min.y + size.y * 0.74, center.z],
      'right elbow': [center.x + size.x * 0.38, box.min.y + size.y * 0.62, center.z],
      'right hand': [center.x + size.x * 0.5, box.min.y + size.y * 0.52, center.z],

      'left knee': [center.x - size.x * 0.16, box.min.y + size.y * 0.28, center.z],
      'left foot': [center.x - size.x * 0.16, box.min.y + size.y * 0.06, center.z],

      'right knee': [center.x + size.x * 0.16, box.min.y + size.y * 0.28, center.z],
      'right foot': [center.x + size.x * 0.16, box.min.y + size.y * 0.06, center.z]
    };

    const markersByName = {};
    const markers = Object.entries(markerPositions).map(([name, position]) => {
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(markerRadius, 16, 16),
        markerMaterial.clone()
      );

      marker.name = `forge-rig-marker-${name}`;
      marker.renderOrder = 999;
      marker.position.set(position[0], position[1], position[2]);
      marker.userData.forgeRigMarkerName = name;

      previewState.scene.add(marker);
      markersByName[name] = marker;

      return marker;
    });

    const connectionPairs = [
      ['hips', 'spine'],
      ['spine', 'chest'],
      ['chest', 'neck'],
      ['neck', 'head'],

      ['chest', 'left shoulder'],
      ['left shoulder', 'left elbow'],
      ['left elbow', 'left hand'],

      ['chest', 'right shoulder'],
      ['right shoulder', 'right elbow'],
      ['right elbow', 'right hand'],

      ['hips', 'left knee'],
      ['left knee', 'left foot'],

      ['hips', 'right knee'],
      ['right knee', 'right foot']
    ];

    const lines = connectionPairs.map(([fromName, toName]) => {
      const fromMarker = markersByName[fromName];
      const toMarker = markersByName[toName];
      const geometry = new THREE.BufferGeometry().setFromPoints([
        fromMarker.position,
        toMarker.position
      ]);
      const line = new THREE.Line(geometry, lineMaterial.clone());

      line.name = `forge-rig-line-${fromName}-to-${toName}`;
      line.renderOrder = 998;
      line.userData.forgeRigLine = {
        from: fromName,
        to: toName
      };

      previewState.scene.add(line);
      return line;
    });

    window.forgeRigPlacementState = {
      markers,
      lines
    };

    console.log('Rig Placement Mode started', window.forge3dPreviewState, window.forgeRigPlacementState);
    alert('Rig Placement Mode started. Next step: skeleton handles.');
  };

  window.addEventListener('DOMContentLoaded', () => {
    setTimeout(boot3dPreviewPanel, 500);
  });
})();
