import { walletOf, holderOf } from './_wallet.mjs';
import { enforceRateLimit, isAllowedModelRef, isCleanId, sanitizeDeep } from './_guard.mjs';
import { isAdminRequest } from './_admin-auth.mjs';
import { admissionKey, canonical, worldConfiguration, makeWorldAdmission, ownerRightsEvidence, SAVE_CHARACTER_LUA } from './_raap-world-build.mjs';
const ACTIVE_CHARACTER_VERSION = 'v1';

function getRedisConfig() {
  return {
    url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '',
    token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || ''
  };
}

function isRedisConfigured() {
  const { url, token } = getRedisConfig();
  return Boolean(url && token);
}

function getActiveCharacterKey({ walletAddress, collectionKey, tokenId, rebelId }) {
  const ownerKey = walletAddress || 'local_testing_wallet';
  const safeCollectionKey = collectionKey || 'battle_for_colony';
  const safeTokenId = tokenId || rebelId || 'unknown_token';

  return `forge:active-character:${ACTIVE_CHARACTER_VERSION}:${ownerKey}:${safeCollectionKey}:${safeTokenId}`;
}

function getActiveCharacterByWalletKey(walletAddress) {
  const ownerKey = walletAddress || 'local_testing_wallet';
  return `forge:active-character:${ACTIVE_CHARACTER_VERSION}:${ownerKey}:selected`;
}

async function redisPipeline(commands) {
  const { url, token } = getRedisConfig();

  if (!url || !token) {
    throw new Error('Redis is not configured');
  }

  const response = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(commands)
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || `Redis request failed with status ${response.status}`);
  }

  if (!Array.isArray(data) || data.length !== commands.length || data.some(row => !row || row.error || !Object.hasOwn(row, 'result'))) throw new Error('Redis did not confirm the operation');
  return data;
}

function sanitizeActiveCharacterPayload(payload) {
  const body = payload || {};
  const build = body.build || body.buildRecord || {};
  const walletAddress = body.walletAddress || body.wallet || null;

  const buildId = body.buildId || build.buildId || null;
  const tokenId = body.tokenId || build.tokenId || null;
  const rebelId = body.rebelId || build.rebelId || null;
  const collectionKey = body.collectionKey || build.collectionKey || 'battle_for_colony';

  const output = build.output || {};
  // Automated Forge Rigger result (one GLB, all clips + cloth bones); the village prefers it when present.
  const forgeRigGlbUrl = output.forgeRigGlbUrl || build.forgeRig?.forgeRigGlbUrl || null;
  const forgeRigThumbUrl = output.forgeRigThumbUrl || build.forgeRig?.thumbUrl || null;
  const storedAnimations = output.storedAnimations || build.rigging?.storedAnimations || {};
  const storedArmatureAnimations =
    output.storedArmatureAnimations ||
    build.rigging?.storedArmatureAnimations ||
    {};
  const meshyBasicAnimations = build.rigging?.response?.result?.basic_animations || {};
  const outputIdleGlbUrl = output.idleGlbUrl || null;
  const outputWalkingGlbUrl = output.walkingGlbUrl || null;
  const outputRunningGlbUrl = output.runningGlbUrl || null;
  const outputJumpGlbUrl = output.jumpGlbUrl || null;
  const outputRunJumpGlbUrl = output.runJumpGlbUrl || null;
  const outputHighKickGlbUrl = output.highKickGlbUrl || null;
  const outputRoundhouseKickGlbUrl = output.roundhouseKickGlbUrl || null;
  const previewThumbnail =
    build.sourceImage?.imageUrl ||
    build.productionReference?.imageUrl ||
    build.selectedConcept?.imageUrl ||
    build.concept?.imageUrl ||
    build.sourceImageUrl ||
    null;
  const characterName =
    build.title ||
    build.name ||
    build.productionReference?.title ||
    build.selectedConcept?.title ||
    build.concept?.title ||
    (tokenId ? `Forge Playable #${tokenId}` : 'Forge Playable');

  const riggedGlbUrl =
    output.riggedRebelGlbUrl ||
    output.riggedGlbUrl ||
    build.rigging?.riggedRebelGlbUrl ||
    build.rigging?.riggedGlbUrl ||
    build.rigging?.response?.result?.rigged_character_glb_url ||
    null;

  const staticGlbUrl =
    output.rebelGlbUrl ||
    output.glbUrl ||
    build.engine?.glbUrl ||
    null;

  const idleGlbUrl =
    output.idleGlbUrl ||
    storedAnimations.idle?.storedAnimationUrl ||
    output.meshyAnimations?.idle?.animationGlbUrl ||
    null;

  const walkingGlbUrl =
    output.walkingGlbUrl ||
    storedAnimations.walking?.storedAnimationUrl ||
    meshyBasicAnimations.walking_glb_url ||
    null;

  const runningGlbUrl =
    output.runningGlbUrl ||
    storedAnimations.running?.storedAnimationUrl ||
    meshyBasicAnimations.running_glb_url ||
    null;

  const jumpGlbUrl =
    output.jumpGlbUrl ||
    storedAnimations.jump?.storedAnimationUrl ||
    output.meshyAnimations?.jump?.animationGlbUrl ||
    null;

  const runJumpGlbUrl =
    output.runJumpGlbUrl ||
    storedAnimations.runJump?.storedAnimationUrl ||
    output.meshyAnimations?.runJump?.animationGlbUrl ||
    null;

  const highKickGlbUrl =
    output.highKickGlbUrl ||
    storedAnimations.highKick?.storedAnimationUrl ||
    output.meshyAnimations?.highKick?.animationGlbUrl ||
    null;

  const roundhouseKickGlbUrl =
    output.roundhouseKickGlbUrl ||
    storedAnimations.roundhouseKick?.storedAnimationUrl ||
    output.meshyAnimations?.roundhouseKick?.animationGlbUrl ||
    null;

  const walkingArmatureGlbUrl =
    output.walkingArmatureGlbUrl ||
    storedArmatureAnimations.walking_armature?.storedAnimationUrl ||
    meshyBasicAnimations.walking_armature_glb_url ||
    null;

  const runningArmatureGlbUrl =
    output.runningArmatureGlbUrl ||
    storedArmatureAnimations.running_armature?.storedAnimationUrl ||
    meshyBasicAnimations.running_armature_glb_url ||
    null;

  const activeGlbUrl =
    body.activeGlbUrl ||
    body.glbUrl ||
    output.activeGlbUrl ||
    riggedGlbUrl ||
    staticGlbUrl ||
    null;

  const glbBlobPath =
    body.glbBlobPath ||
    output.riggedGlbBlobPath ||
    output.glbBlobPath ||
    null;

  const activeCharacterModelType =
    body.activeCharacterModelType ||
    build.activeCharacterModelType ||
    output.activeCharacterModelType ||
    (riggedGlbUrl ? 'rigged_forge_glb' : 'static_forge_glb');

  if (!buildId) {
    throw new Error('Missing buildId');
  }

  if (!tokenId && !rebelId) {
    throw new Error('Missing tokenId or rebelId');
  }

  if (!activeGlbUrl) {
    throw new Error('Missing active GLB URL');
  }

  const now = new Date().toISOString();
  const animationUrlReport = {
    outputIdleGlbUrl,
    outputWalkingGlbUrl,
    outputRunningGlbUrl,
    outputJumpGlbUrl,
    outputRunJumpGlbUrl,
    outputHighKickGlbUrl,
    outputRoundhouseKickGlbUrl,
    savedIdleGlbUrl: idleGlbUrl,
    savedWalkingGlbUrl: walkingGlbUrl,
    savedRunningGlbUrl: runningGlbUrl,
    savedJumpGlbUrl: jumpGlbUrl,
    savedRunJumpGlbUrl: runJumpGlbUrl,
    savedHighKickGlbUrl: highKickGlbUrl,
    savedRoundhouseKickGlbUrl: roundhouseKickGlbUrl
  };

  const characterBundle = {
    bundleVersion: 'v1',
    bundleType: 'forge_character_bundle',
    collectionKey,
    tokenId,
    rebelId,
    sourceBuildId: buildId,
    modelType: activeCharacterModelType,
    activeGlbUrl,
    staticGlbUrl,
    riggedGlbUrl,
    forgeRigGlbUrl,
    forgeRigThumbUrl,
    glbBlobPath,
    storedAnimations,
    animations: {
      idle: idleGlbUrl
        ? {
            name: 'idle',
            glbUrl: idleGlbUrl,
            source: (storedAnimations.idle?.storedAnimationUrl || outputIdleGlbUrl) ? 'rebel_blob' : 'meshy'
          }
        : null,
      walking: walkingGlbUrl
        ? {
            name: 'walking',
            glbUrl: walkingGlbUrl,
            source: (storedAnimations.walking?.storedAnimationUrl || outputWalkingGlbUrl) ? 'rebel_blob' : 'meshy'
          }
        : null,
      running: runningGlbUrl
        ? {
            name: 'running',
            glbUrl: runningGlbUrl,
            source: (storedAnimations.running?.storedAnimationUrl || outputRunningGlbUrl) ? 'rebel_blob' : 'meshy'
          }
        : null,
      jump: jumpGlbUrl
        ? {
            name: 'jump',
            glbUrl: jumpGlbUrl,
            source: (storedAnimations.jump?.storedAnimationUrl || outputJumpGlbUrl) ? 'rebel_blob' : 'meshy'
          }
        : null,
      runJump: runJumpGlbUrl
        ? {
            name: 'runJump',
            glbUrl: runJumpGlbUrl,
            source: (storedAnimations.runJump?.storedAnimationUrl || outputRunJumpGlbUrl) ? 'rebel_blob' : 'meshy'
          }
        : null,
      highKick: highKickGlbUrl
        ? {
            name: 'highKick',
            glbUrl: highKickGlbUrl,
            source: (storedAnimations.highKick?.storedAnimationUrl || outputHighKickGlbUrl) ? 'rebel_blob' : 'meshy'
          }
        : null,
      roundhouseKick: roundhouseKickGlbUrl
        ? {
            name: 'roundhouseKick',
            glbUrl: roundhouseKickGlbUrl,
            source: (storedAnimations.roundhouseKick?.storedAnimationUrl || outputRoundhouseKickGlbUrl) ? 'rebel_blob' : 'meshy'
          }
        : null
    },
       armatureAnimations: {
      idle: null,

      walking: walkingArmatureGlbUrl
        ? {
            name: 'walking',
            glbUrl: walkingArmatureGlbUrl,
            source: (storedArmatureAnimations.walking_armature?.storedAnimationUrl || output.walkingArmatureGlbUrl) ? 'rebel_blob' : 'meshy',
            animationType: 'armature_only'
          }
        : null,

      running: runningArmatureGlbUrl
        ? {
            name: 'running',
            glbUrl: runningArmatureGlbUrl,
            source: (storedArmatureAnimations.running_armature?.storedAnimationUrl || output.runningArmatureGlbUrl) ? 'rebel_blob' : 'meshy',
            animationType: 'armature_only'
          }
        : null,

      jump: null,

      attack: null,

      kick: null
    }
  };

  return {
    activeCharacterVersion: ACTIVE_CHARACTER_VERSION,
    walletAddress,
    collectionKey,
    tokenId,
    rebelId,
    activeForgeBuildId: buildId,
    name: characterName,
    previewThumbnail,
    sourceImage: previewThumbnail,
    activeGlbUrl,
    staticGlbUrl,
    riggedGlbUrl,
    forgeRigGlbUrl,
    forgeRigThumbUrl,
    idleGlbUrl,
    walkingGlbUrl,
    runningGlbUrl,
    jumpGlbUrl,
    runJumpGlbUrl,
    highKickGlbUrl,
    roundhouseKickGlbUrl,
    walkingArmatureGlbUrl,
    runningArmatureGlbUrl,
    glbBlobPath,
    activeCharacterModelType,
    characterBundle,
    activeCharacterSource: 'forge_glb',
    status: 'active_character_selected',
    selectedAt: now,
    updatedAt: now,
    sourceBuildStatus: build.status || null,
    sourceConceptId: build.sourceConceptId || null,
    animationUrlReport,
    note: 'This record is the selected Forge character bundle for the landing page and future Village character handoff.'
  };
}

// Phase 0: every URL-like field must be a Forge/Blob/site asset (others are dropped); text is made HTML-inert.
function scrubActiveCharacter(value, key = '') {
  if (typeof value === 'string') {
    if (/(url|thumbnail|image)$/i.test(key)) return isAllowedModelRef(value) ? value : null;
    return sanitizeDeep(value);
  }
  if (Array.isArray(value)) return value.map((v) => scrubActiveCharacter(v, key));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = scrubActiveCharacter(v, k);
    return out;
  }
  return value;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    if (!(await enforceRateLimit(req, res, 'active-save', 60, 3600, 'saves'))) return;
    const payload = { ...(req.body || {}) }, admin=isAdminRequest(req);
    const buildId=String(payload.buildId || payload.build?.buildId || payload.buildRecord?.buildId || '');
    if (!isCleanId(buildId) || !/^[A-Za-z0-9_-]{1,128}$/.test(buildId)) return res.status(400).json({ok:false,error:'Missing or invalid buildId'});
    if (!isRedisConfigured()) return res.status(503).json({ok:false,error:'Character storage is unavailable'});
    const buildKey=`forge:3d-build:v1:${buildId}`;
    const [source]=await redisPipeline([['GET',buildKey]]), buildRaw=source.result;
    const stored=buildRaw?JSON.parse(buildRaw):null;
    if (!stored || stored.buildId!==buildId) return res.status(404).json({ok:false,error:'Saved build not found'});
    const tokenId=String(stored.tokenId), collectionKey=stored.collectionKey;
    if (!/^(0|[1-9][0-9]{0,77})$/.test(tokenId) || !/^[a-z0-9_]{1,64}$/.test(collectionKey)) throw Error('Invalid saved build identity');
    const requestedToken=payload.tokenId || payload.build?.tokenId || payload.buildRecord?.tokenId;
    if (requestedToken!==undefined && String(requestedToken)!==tokenId || payload.collectionKey && payload.collectionKey!==collectionKey)
      return res.status(400).json({ok:false,error:'Build belongs to a different Rebel'});
    const wallet=admin?((payload.walletAddress||payload.wallet||'').toLowerCase()||null):walletOf(req);
    if (wallet!==null && !/^0x[0-9a-f]{40}$/.test(wallet)) return res.status(400).json({ok:false,error:'Invalid signed wallet'});
    let holder=null;
    if (!admin) {
      if (!wallet) return res.status(401).json({ok:false,error:'Sign in with your wallet to make this your Rebel',code:'wallet_required'});
      holder=await holderOf(collectionKey,tokenId,wallet,{fresh:true});
      if (!holder.holder) return res.status(403).json({ok:false,error:'Only the holder or its delegate can set this character',code:'not_owner'});
    }
    // Never let a request body replace the signed wallet or saved model fields.
    let activeCharacter=scrubActiveCharacter(sanitizeActiveCharacterPayload({buildId,tokenId,rebelId:'rebel_'+tokenId,
      collectionKey,walletAddress:wallet,build:stored,activeGlbUrl:stored.output?.forgeRigGlbUrl||undefined}));
    if(!activeCharacter.activeGlbUrl)throw Error('The saved build has no usable stored model');
    const recordKey=getActiveCharacterKey(activeCharacter), selectedKey=getActiveCharacterByWalletKey(wallet);
    const fenceKey=`raap:r7:world-writer:v1:${wallet||'local_testing_wallet'}`, savedAdmissionKey=admissionKey(collectionKey,buildId);
    const [snapshot]=await redisPipeline([['MGET',recordKey,selectedKey,fenceKey,savedAdmissionKey]]);
    if(!Array.isArray(snapshot.result)||snapshot.result.length!==4)throw Error('Could not read current selection');
    const [oldCharacter,oldSelected,oldFence,oldAdmission]=snapshot.result;
    const config=worldConfiguration();let admission=null;
    if(config && holder && collectionKey==='battle_for_colony' && ['completed','rigged_glb_stored_in_rebel_blob','completed_stored_in_rebel_blob'].includes(stored.status) && (stored.output?.forgeRigGlbUrl || stored.forgeRig?.forgeRigGlbUrl || stored.output?.riggedRebelGlbUrl || stored.output?.riggedGlbUrl || stored.rigging?.riggedRebelGlbUrl || stored.rigging?.riggedGlbUrl)) {
      if(oldFence!==null&&oldFence!==config.qualificationCommitment)throw Error('The World writer changed; refresh before selecting');
      admission=await makeWorldAdmission(stored,{kind:'OWNER_BUILD',controller:holder.owner,evidenceCommitment:ownerRightsEvidence(stored,holder.owner)},config);
      const fresh=await holderOf(collectionKey,tokenId,wallet,{fresh:true});
      if(!fresh.holder||fresh.owner!==holder.owner)throw Error('Rebel ownership changed; review the character again');
      const at=new Date().toISOString();
      activeCharacter={...admission.character,walletAddress:wallet,selectedAt:at,updatedAt:at,
        appearanceSource:{schema:'raap.r7.world-appearance.v1',kind:'OWNER_BUILD',collectionKey,tokenId,buildId}};
    }
    const expiry=Math.min(Math.floor(Date.now()/1000)+120,admission?config.validUntil:Number.MAX_SAFE_INTEGER);
    const [save]=await redisPipeline([['EVAL',SAVE_CHARACTER_LUA,'5',buildKey,recordKey,selectedKey,fenceKey,savedAdmissionKey,
      buildRaw,oldCharacter??'__R7_ABSENT__',oldSelected??'__R7_ABSENT__',oldFence??'__R7_ABSENT__',oldAdmission??'__R7_ABSENT__',
      canonical(activeCharacter),admission?canonical(admission):'',admission?config.qualificationCommitment:'',String(expiry),collectionKey==='battle_for_colony'?'1':'0']]);
    if(save.result?.[0]!=='SAVED')return res.status(409).json({ok:false,error:'The saved build or selection changed. Reload before choosing again.'});
    const storageResult={saved:true,storage:'redis',recordKey,selectedKey:collectionKey==='battle_for_colony'?selectedKey:null,
      worldAdmission:admission?'saved':'not_requested'};

    return res.status(200).json({
      ok: true,
      activeCharacter,
      animationUrlReport: activeCharacter.animationUrlReport,
      storageResult,
      message: 'Forge GLB set as active character.'
    });
  } catch (err) {
    console.error('forge-active-character-save error:', err);

    return res.status(500).json({
      ok: false,
      error: 'Could not set Forge GLB as active character',
      detail: err && err.message ? err.message : 'Unknown error'
    });
  }
}

