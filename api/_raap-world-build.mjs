import crypto from 'node:crypto';

// The existing Forge database remains the source. These records add permitted
// World use for a completed version; they never buy or generate a character.
export const canonical = value => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype)
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  throw Error('Invalid saved build');
};
const hash = (domain, value) => '0x' + crypto.createHash('sha256').update(domain + '\0' + canonical(value)).digest('hex');
const digest = value => /^0x[0-9a-f]{64}$/.test(value || '');
export const admissionKey = (collection, build) => `raap:r7:world-build:v2:${collection}:${build}`;
export function worldConfiguration(env = process.env) {
  const qualificationCommitment = env.RAAP_WORLD_QUALIFICATION_COMMITMENT;
  const validUntil = Number(env.RAAP_WORLD_VALID_UNTIL);
  if (!qualificationCommitment && !env.RAAP_WORLD_VALID_UNTIL) return null;
  if (!digest(qualificationCommitment) || !Number.isSafeInteger(validUntil) || validUntil <= 0)
    throw Error('The World connection configuration needs review');
  return validUntil > Math.floor(Date.now()/1000) ? { qualificationCommitment, validUntil } : null;
}
function blobUrl(value, extension) {
  if (typeof value !== 'string') throw Error('The saved build has no stored model');
  const url = new URL(value);
  if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.public\.blob\.vercel-storage\.com$/.test(url.hostname) ||
      url.username || url.password || url.port || url.search || url.hash || !extension.test(url.pathname))
    throw Error('Use the completed model stored by Forge');
  return url.href;
}
export function savedWorldCharacter(build) {
  const tokenId = String(build.tokenId), collectionKey = build.collectionKey, buildId = build.buildId;
  if (!/^(0|[1-9][0-9]{0,77})$/.test(tokenId) || !/^[a-z0-9_]{1,64}$/.test(collectionKey) ||
      !/^[a-zA-Z0-9_-]{1,128}$/.test(buildId) ||
      !['completed', 'rigged_glb_stored_in_rebel_blob', 'completed_stored_in_rebel_blob'].includes(build.status))
    throw Error('Choose a completed saved build');
  const output = build.output || {};
  const forgeRig = output.forgeRigGlbUrl || build.forgeRig?.forgeRigGlbUrl;
  const activeGlbUrl = blobUrl(forgeRig || output.riggedRebelGlbUrl || output.riggedGlbUrl || build.rigging?.riggedRebelGlbUrl || build.rigging?.riggedGlbUrl, /\.glb$/i);
  let thumbnail = null;
  try { thumbnail = blobUrl(output.forgeRigThumbUrl || build.forgeRig?.thumbUrl || build.sourceImage?.imageUrl, /\.(png|jpe?g|webp)$/i); } catch {}
  const animationNames = { idle:'idle', walking:'walking', running:'running', jump:'jump', runJump:'runJump', highKick:'highKick', roundhouseKick:'roundhouseKick' };
  const animations = {}, fields = {}, urls = new Map([[activeGlbUrl, 'MODEL']]);
  // Forge Rigger embeds all clips in its one GLB. For other completed rigs,
  // accept only animations already copied into the application's Blob store.
  for (const [name, field] of Object.entries(animationNames)) {
    const value = forgeRig ? null : output[field + 'GlbUrl'] || output.storedAnimations?.[name]?.storedAnimationUrl || null;
    const url = value ? blobUrl(value, /\.glb$/i) : null;
    fields[field + 'GlbUrl'] = url;
    animations[name] = url ? { name, glbUrl:url, source:'rebel_blob' } : null;
    if (url && url !== activeGlbUrl) urls.set(url, 'ANIMATION');
  }
  if (urls.size > 8) throw Error('This saved build has too many separate assets');
  const common = { collectionKey, tokenId, rebelId:'rebel_' + tokenId, activeGlbUrl,
    staticGlbUrl:null, riggedGlbUrl:activeGlbUrl, forgeRigGlbUrl:forgeRig?activeGlbUrl:null,
    forgeRigThumbUrl:thumbnail };
  const character = { activeCharacterVersion:'v1', ...common, activeForgeBuildId:buildId,
    name:'Forge Playable #' + tokenId, previewThumbnail:thumbnail, sourceImage:thumbnail,
    ...fields, activeCharacterModelType:'rigged_forge_glb', activeCharacterSource:'forge_glb', status:'active_character_selected',
    characterBundle:{ bundleVersion:'v1', bundleType:'forge_character_bundle', ...common,
      sourceBuildId:buildId, modelType:'rigged_forge_glb', animations, armatureAnimations:{} } };
  return { character, urls };
}
function inspectGlb(bytes, kind) {
  if (bytes.length < 28 || bytes.length > 16777216 || bytes.readUInt32LE(0)!==0x46546c67 ||
      bytes.readUInt32LE(4)!==2 || bytes.readUInt32LE(8)!==bytes.length) throw Error('Invalid stored GLB');
  const size=bytes.readUInt32LE(12), end=20+size;
  if (size>2097152 || size%4 || end>bytes.length || bytes.readUInt32LE(16)!==0x4e4f534a) throw Error('Invalid GLB structure');
  const gltf=JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(bytes.subarray(20,end)).trim());
  if (gltf.asset?.version!=='2.0' || !gltf.nodes?.length || kind==='ANIMATION'&&!gltf.animations?.length ||
      kind==='MODEL'&&(!gltf.meshes?.length||!gltf.skins?.length)) throw Error('A playable model needs a rig and animations');
  const walk=(v,depth=0)=>{if(depth>32)throw Error('Invalid GLB nesting');if(v&&typeof v==='object')for(const [key,value]of Object.entries(v)){if(key==='uri'&&typeof value==='string')throw Error('GLB must contain its assets');walk(value,depth+1);}};
  walk(gltf);
  if(end<bytes.length&&(end+8>bytes.length||bytes.readUInt32LE(end+4)!==0x004e4942||bytes.readUInt32LE(end)%4||end+8+bytes.readUInt32LE(end)!==bytes.length))throw Error('Invalid GLB binary data');
  return gltf.animations?.length || 0;
}
export async function makeWorldAdmission(build, rights, config, transport=fetch) {
  if (!config || !digest(config.qualificationCommitment) || !Number.isSafeInteger(config.validUntil) || config.validUntil<=Math.floor(Date.now()/1000))throw Error('World permission expired');
  if (!['OWNER_BUILD','SHARED_SAMPLE'].includes(rights.kind) || !digest(rights.evidenceCommitment) ||
      (rights.kind==='OWNER_BUILD'?!/^0x[0-9a-f]{40}$/.test(rights.controller||''):rights.controller!==null))throw Error('Invalid World rights');
  const {character,urls}=savedWorldCharacter(build), resources=[], signal=AbortSignal.timeout(4000);let total=0, animationCount=0;
  for(const [url,kind]of urls){
    const response=await transport(url,{credentials:'omit',redirect:'error',cache:'no-store',signal});
    if(!response.ok||!response.body)throw Error('Could not read the stored model');
    const reader=response.body.getReader(),parts=[];let size=0;
    try{for(;;){const p=await reader.read();if(p.done)break;size+=p.value.length;total+=p.value.length;if(size>16777216||total>33554432)throw Error('Stored model exceeds the connection limit');parts.push(p.value);}}
    catch(e){await reader.cancel().catch(()=>{});throw e;}finally{reader.releaseLock();}
    const bytes=Buffer.concat(parts);animationCount+=inspectGlb(bytes,kind);
    resources.push({url,kind,byteLength:size,sha256:'0x'+crypto.createHash('sha256').update(bytes).digest('hex')});
  }
  signal.throwIfAborted();if(!animationCount)throw Error('The saved character has no stored animations');
  return {schema:'raap.r7.world-saved-build.v2',qualificationCommitment:config.qualificationCommitment,
    buildId:build.buildId,buildCommitment:hash('raap.r7.world-build-content.v2',build),
    source:{collectionKey:build.collectionKey,tokenId:String(build.tokenId)},
    rights:{kind:rights.kind,controller:rights.controller,use:'WORLD_APPEARANCE',evidenceCommitment:rights.evidenceCommitment,validUntil:config.validUntil},character,resources};
}
export const ownerRightsEvidence = (build, owner) => hash('raap.r7.world-owner-build.v2',{buildId:build.buildId,buildCommitment:hash('raap.r7.world-build-content.v2',build),owner});

// Compare all values before writing any of them. A changed build, concurrent
// human/RAAP choice or revoked writer/admission cannot be overwritten silently.
export const SAVE_CHARACTER_LUA = `
if (redis.call('GET',KEYS[1]) or '__R7_ABSENT__')~=ARGV[1] then return {'SOURCE_CHANGED'} end
if (redis.call('GET',KEYS[2]) or '__R7_ABSENT__')~=ARGV[2] then return {'SELECTION_CHANGED'} end
if (redis.call('GET',KEYS[3]) or '__R7_ABSENT__')~=ARGV[3] then return {'SELECTION_CHANGED'} end
if (redis.call('GET',KEYS[4]) or '__R7_ABSENT__')~=ARGV[4] then return {'WRITER_CHANGED'} end
if (redis.call('GET',KEYS[5]) or '__R7_ABSENT__')~=ARGV[5] then return {'ADMISSION_CHANGED'} end
local time=redis.call('TIME')
if tonumber(time[1])>=tonumber(ARGV[9]) then return {'EXPIRED'} end
if ARGV[7]~='' then redis.call('MSET',KEYS[2],ARGV[6],KEYS[3],ARGV[6],KEYS[4],ARGV[8],KEYS[5],ARGV[7])
elseif ARGV[10]=='1' then redis.call('MSET',KEYS[2],ARGV[6],KEYS[3],ARGV[6])
else redis.call('SET',KEYS[2],ARGV[6]) end
return {'SAVED'}
`;
