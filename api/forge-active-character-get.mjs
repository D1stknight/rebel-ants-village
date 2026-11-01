import {walletOf,holderOf} from './_wallet.mjs';
import {canonical,admissionKey} from './_raap-world-build.mjs';
import crypto from 'node:crypto';
const hash=(domain,value)=>'0x'+crypto.createHash('sha256').update(domain+'\0'+canonical(value)).digest('hex');
async function read(keys){
  const origin=process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL;
  const token=process.env.UPSTASH_REDIS_REST_TOKEN||process.env.KV_REST_API_TOKEN;
  if(!origin||!token)throw Error('Character storage is unavailable');
  const response=await fetch(origin+'/pipeline',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},
    body:JSON.stringify([['MGET',...keys]]),signal:AbortSignal.timeout(4000),cache:'no-store',redirect:'error'});
  const rows=await response.json();if(!response.ok||rows?.length!==1||rows[0].error||!Array.isArray(rows[0].result)||rows[0].result.length!==keys.length)throw Error('Character read failed');
  return rows[0].result;
}
const parse=raw=>raw?JSON.parse(raw):null;
const matches=(record,collection,token)=>record&&record.collectionKey===collection&&(!token||String(record.tokenId)===token);
async function usableAppearance(record,owner){
  const a=record.appearanceSource;if(!a)return true;
  if(a.schema!=='raap.r7.world-appearance.v1'||a.buildId!==record.activeForgeBuildId||a.collectionKey!==record.collectionKey)return false;
  const [saved,build,fence]=await read([admissionKey(a.collectionKey,a.buildId),'forge:3d-build:v1:'+a.buildId,'raap:r7:world-writer:v1:'+record.walletAddress]);
  const r=parse(saved),b=parse(build),now=Math.floor(Date.now()/1000);
  return !!(r&&b&&r.schema==='raap.r7.world-saved-build.v2'&&r.qualificationCommitment===fence&&
    r.buildId===a.buildId&&r.buildCommitment===hash('raap.r7.world-build-content.v2',b)&&r.source.collectionKey===a.collectionKey&&r.source.tokenId===a.tokenId&&
    r.rights.use==='WORLD_APPEARANCE'&&r.rights.validUntil>now&&r.rights.kind===a.kind&&
    (a.kind==='SHARED_SAMPLE'?r.rights.controller===null:a.kind==='OWNER_BUILD'&&r.rights.controller===owner&&a.tokenId===String(record.tokenId))&&
    r.character.activeGlbUrl===record.activeGlbUrl);
}
export default async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store');
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({ok:false,error:'Method not allowed'});}
  try{
    const q=req.query||{},collection=String(q.collectionKey||'battle_for_colony'),token=q.tokenId!==undefined?String(q.tokenId):q.rebelId?String(q.rebelId).replace(/^rebel_/,''):'';
    if(!/^[a-z0-9_]{1,64}$/.test(collection)||token&&!/^(0|[1-9][0-9]{0,77})$/.test(token))return res.status(400).json({ok:false,error:'Invalid character reference'});
    const wallet=walletOf(req),requested=q.walletAddress||q.wallet;
    if(requested&&String(requested).toLowerCase()!==wallet)return res.status(403).json({ok:false,error:'Read only your signed-in wallet selection'});
    const guest=q.guest==='1'||!wallet,ownerKey=guest?'local_testing_wallet':wallet;
    const keys=[`forge:active-character:v1:${ownerKey}:selected`];
    if(token)keys.push(`forge:active-character:v1:${ownerKey}:${collection}:${token}`);
    if(!guest&&token)keys.push(`forge:active-character:v1:local_testing_wallet:${collection}:${token}`);
    const rows=await read(keys),selected=parse(rows[0]),specific=token?parse(rows[1]):null;
    let character=matches(specific,collection,token)?specific:matches(selected,collection,token)?selected:null,unavailable=false;
    if(character&&character.walletAddress){
      if(guest||character.walletAddress!==wallet){character=null;unavailable=true;}
      else {const h=await holderOf(collection,String(character.tokenId),wallet,{fresh:true});
        if(!h.holder||!await usableAppearance(character,h.owner)){character=null;unavailable=true;}}
    }
    // Public showcase records remain public. They never become a wallet's NFT
    // identity or grant its private selection/RAAP permissions.
    if(!character&&!unavailable&&!guest&&token){const sample=parse(rows[2]);if(matches(sample,collection,token)&&!sample.walletAddress)character=sample;}
    // the badges (Universe's Hand-Fitted): the wallet's own character wears gloves forged in the Rebel Forge
    let gloves=false;
    if(character&&character.walletAddress&&character.activeForgeBuildId){try{const [b]=await read(['forge:3d-build:v1:'+character.activeForgeBuildId]);gloves=!!parse(b)?.forgeRig?.gloves?.doneAt;}catch{}}
    return res.status(200).json({ok:true,activeCharacter:character,hasActiveCharacter:!!character,selectionUnavailable:unavailable,gloves,
      storageResult:{storage:'redis',source:character?(character.walletAddress?'wallet_selection':'public_sample'):'none'}});
  }catch{ return res.status(503).json({ok:false,error:'Could not verify the saved character. Please reload before playing.'});}
}
