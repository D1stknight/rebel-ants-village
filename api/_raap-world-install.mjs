import crypto from 'node:crypto';
import {canonical,makeWorldAdmission,admissionKey} from './_raap-world-build.mjs';

// One bounded installation of the reviewed sample permission. The database key
// stays inside Universe. This operation cannot choose an appearance or overwrite
// an earlier installation/revocation, and is disabled after the release deadline.
export const INSTALL_SAMPLE_LUA=`
local old=redis.call('GET',KEYS[4])
if old then return {'ALREADY_INSTALLED',old} end
if redis.call('GET',KEYS[1])~=ARGV[1] then return {'SOURCE_CHANGED'} end
if redis.call('EXISTS',KEYS[2])~=0 or redis.call('EXISTS',KEYS[3])~=0 then return {'REVIEW_EXISTING_RECORDS'} end
local time=redis.call('TIME')
if tonumber(time[1])>=tonumber(ARGV[5]) then return {'EXPIRED'} end
redis.call('MSET',KEYS[2],ARGV[2],KEYS[3],ARGV[3],KEYS[4],ARGV[4])
return {'INSTALLED',ARGV[4]}
`;
export async function installWorldSample(body,c,redis,transport=fetch){
 if(!body||Object.keys(body).join()!=='operation'||body.operation!=='INSTALL_SAMPLE')throw Error('Invalid installation request');
 const now=Math.floor(Date.now()/1000),s=c.sharedSample;
 if(!s||!Number.isSafeInteger(c.installUntil)||now>=c.installUntil||c.installUntil>c.validUntil||
   !/^[A-Za-z0-9_-]{1,128}$/.test(s.buildId)||!/^(0|[1-9][0-9]{0,77})$/.test(s.tokenId)||
   !/^0x[0-9a-f]{64}$/.test(s.buildCommitment)||!/^0x[0-9a-f]{64}$/.test(s.rightsEvidence))throw Error('Installation unavailable');
 const key='forge:3d-build:v1:'+s.buildId,receiptKey='raap:r7:world-install:v1:'+c.scope;
 const expected=canonical({schema:'raap.r7.world-installation.v1',scope:c.scope,qualificationCommitment:c.qualificationCommitment,buildId:s.buildId,buildCommitment:s.buildCommitment,validUntil:c.validUntil});
 const previous=await redis(['GET',receiptKey]);
 if(previous!==null){if(previous!==expected)throw Error('Existing installation differs');return {status:'ALREADY_INSTALLED',receipt:JSON.parse(previous)};}
 const raw=await redis(['GET',key]);if(typeof raw!=='string'||Buffer.byteLength(raw)>262144)throw Error('Build unavailable');
 const build=JSON.parse(raw),commitment='0x'+crypto.createHash('sha256').update('raap.r7.world-build-content.v2\0'+canonical(build)).digest('hex');
 if(build.buildId!==s.buildId||build.collectionKey!==c.collectionKey||String(build.tokenId)!==s.tokenId||commitment!==s.buildCommitment)throw Error('Reviewed build changed');
 const admission=await makeWorldAdmission(build,{kind:'SHARED_SAMPLE',controller:null,evidenceCommitment:s.rightsEvidence},c,transport);
 const result=await redis(['EVAL',INSTALL_SAMPLE_LUA,'4',key,admissionKey(c.collectionKey,s.buildId),`raap:r7:world-writer:v1:${c.wallet}`,receiptKey,raw,canonical(admission),c.qualificationCommitment,expected,String(c.installUntil)]);
 if(!Array.isArray(result)||!['INSTALLED','ALREADY_INSTALLED'].includes(result[0])||result[1]!==expected)throw Error('Installation not confirmed; inspect existing records');
 return {status:result[0],receipt:JSON.parse(expected)};
}
