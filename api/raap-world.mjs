import crypto from 'node:crypto';
import { SELECTION_LUA } from './_raap-world-protocol.mjs';
import { enforceRateLimit } from './_guard.mjs';
import { installWorldSample } from './_raap-world-install.mjs';
const digest = value => /^0x[0-9a-f]{64}$/.test(value || '');
const buildId = value => /^[A-Za-z0-9_-]{1,128}$/.test(value || '');
const equal = (a,b) => {const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));return x.length===y.length&&crypto.timingSafeEqual(x,y);};
function config(){
  const c=JSON.parse(process.env.RAAP_WORLD_CONNECTION||'null');
  if(!c||c.schema!=='raap.r7.world-connection.v1'||!/^0x[0-9a-f]{40}$/.test(c.wallet)||
    !/^[a-z0-9_]{1,64}$/.test(c.collectionKey)||!/^(0|[1-9][0-9]{0,77})$/.test(c.tokenId)||
    !digest(c.scope)||!digest(c.qualificationCommitment)||!Number.isSafeInteger(c.validUntil)||Math.floor(Date.now()/1000)>=c.validUntil)throw Error('Connection unavailable');
  return c;
}
export function admitCommand(input,c){
  if(!Array.isArray(input)||input.length!==1||!Array.isArray(input[0])||Buffer.byteLength(JSON.stringify(input))>1048576)throw Error('Invalid command');
  const a=input[0];if(a.some(x=>typeof x!=='string'))throw Error('Invalid command');
  const character=`forge:active-character:v1:${c.wallet}:${c.collectionKey}:${c.tokenId}`;
  const selected=`forge:active-character:v1:${c.wallet}:selected`,fence=`raap:r7:world-writer:v1:${c.wallet}`;
  const receipt=k=>k.startsWith(`raap:r7:world-selection:v1:${c.scope}:`)&&digest(k.slice(k.lastIndexOf(':')+1));
  const source=k=>k.startsWith('forge:3d-build:v1:')&&buildId(k.slice(18));
  const admission=k=>`raap:r7:world-build:v2:${c.collectionKey}:${k.slice(18)}`;
  if(a[0]==='GET'&&a.length===2&&receipt(a[1]))return {args:a,build:null};
  if(a[0]==='MGET'&&a.length===6&&source(a[1])&&a[2]===character&&a[3]===selected&&a[4]===fence&&a[5]===admission(a[1]))return {args:a,build:a[1]};
  if(a[0]==='EVAL'&&a.length===17&&a[1]===SELECTION_LUA&&a[2]==='6'&&source(a[3])&&a[4]===character&&a[5]===selected&&receipt(a[6])&&a[7]===fence&&a[8]===admission(a[3])&&
    /^[1-9][0-9]*$/.test(a[9])&&Number(a[9])<=c.validUntil&&Number(a[9])<=Math.floor(Date.now()/1000)+900&&a[15]===c.qualificationCommitment){
    const selectedValue=JSON.parse(a[13]),r=JSON.parse(a[14]);
    if(selectedValue.walletAddress!==c.wallet||selectedValue.collectionKey!==c.collectionKey||selectedValue.tokenId!==c.tokenId||selectedValue.activeForgeBuildId!==a[3].slice(18)||
      r.schema!=='raap.r7.world-character-receipt.v1'||!digest(r.requestCommitment)||!digest(r.contextCommitment)||!digest(r.characterCommitment)||!digest(r.buildDigest)||!digest(r.admissionEvidence))throw Error('Invalid selection');
    return {args:a,build:a[3]};
  }
  throw Error('Command outside this connection');
}
async function redis(args){
  const origin=process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL,token=process.env.UPSTASH_REDIS_REST_TOKEN||process.env.KV_REST_API_TOKEN;
  if(!origin||!token)throw Error('Storage unavailable');
  const r=await fetch(origin+'/pipeline',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify([args]),
    signal:AbortSignal.timeout(3500),redirect:'error',cache:'no-store'});
  const data=await r.json();if(!r.ok||data?.length!==1||!data[0]||data[0].error||!Object.hasOwn(data[0],'result')||Buffer.byteLength(JSON.stringify(data))>1048576)throw Error('Storage did not confirm this command');
  return data[0].result;
}
export default async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Method not allowed'});}
  try{
    const key=process.env.RAAP_WORLD_CONNECTION_KEY;
    if(!/^[0-9a-f]{64}$/.test(key||'')||!equal(req.headers.authorization,'Bearer '+key)||req.headers.origin)return res.status(403).json({error:'World connection unavailable'});
    const c=config();
    if(req.body?.operation==='INSTALL_SAMPLE')return res.status(200).json(await installWorldSample(req.body,c,redis));
    const {args,build}=admitCommand(req.body,c);
    if(!(await enforceRateLimit(req,res,'raap-world',120,60,'reads')))return;
    if(build){
      const raw=await redis(['GET',`raap:r7:world-build:v2:${c.collectionKey}:${build.slice(18)}`]);const b=raw?JSON.parse(raw):null;
      if(!b||b.schema!=='raap.r7.world-saved-build.v2'||b.qualificationCommitment!==c.qualificationCommitment||b.buildId!==build.slice(18)||
        b.source.collectionKey!==c.collectionKey||b.rights.use!=='WORLD_APPEARANCE'||Math.floor(Date.now()/1000)>=b.rights.validUntil||
        !(b.rights.kind==='SHARED_SAMPLE'&&b.rights.controller===null||b.rights.kind==='OWNER_BUILD'&&b.rights.controller===c.wallet&&b.source.tokenId===c.tokenId))
        return res.status(403).json({error:'This saved build is not available to this connection'});
      if(args[0]==='EVAL'&&raw!==args[16])return res.status(409).json({error:'Build permission changed; review again'});
    }
    return res.status(200).json([{result:await redis(args)}]);
  }catch{return res.status(400).json({error:'The World request could not be confirmed. Check its saved result before another selection.'});}
}
