// Games packs for the Rebels in play (admin, Oct 16): every Rebel's active Forge build (the forge:active-character
// records the lobby and the village load), its live rig and whether that rig has a games pack yet
// (forge:games:v1:<rig>, made by /api/forge-rig-moves on a worker built with the games moves). The Rig worker box in
// the NPC Forge lists them and runs the missing ones.
//   GET -> { ok, rebels: [{ buildId, collectionKey, tokenId, name, rigUrl, games, gamesClips, moves, job, publicRig }] }
// v2.30 gamesClips = the moves that pack holds (null: made before 2.30, the first 16)
// Nov 3 (rigger 2.44) rigWorker / rigAt / rigStatus / rigError and rigger = the rigger version that made the live rig
// (forge-worker/manifest.json at its job's worker commit; commits never change, so it is kept), so the NPC Forge can
// re-rig the characters made on an older rigger; mended = the neck / head snaps mended in its live rig (forge-rig-headsnap)
// Oct 20 publicRig = the Rebel has a public forged character with a rig (what guests load), so it can be on the Free to
// play roster (api/free-roster.mjs)
import { isAdminRequest } from './_admin-auth.mjs';
import { redis, buildKey, REPO } from './_forge-rig.mjs';

const BLOB = /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\//;
async function scan(match) {
  const keys = []; let cursor = '0', n = 0;
  do {
    const [r] = await redis([['SCAN', cursor, 'MATCH', match, 'COUNT', '500']]);
    const [c, ks] = r?.result || ['0', []]; cursor = String(c); keys.push(...(ks || []));
  } while (cursor !== '0' && ++n < 400);
  return keys;
}
async function getMany(keys) {
  const out = [];
  for (let i = 0; i < keys.length; i += 100) out.push(...(await redis(keys.slice(i, i + 100).map((k) => ['GET', k]))));
  return out.map((r) => { try { return r?.result ? JSON.parse(r.result) : null; } catch (e) { return r?.result || null; } });
}

async function riggerVersions(commits) {
  const out = {}; if (!commits.length) return out;
  const kept = await redis(commits.map((c) => ['GET', `forge:rigger-version:v1:${c}`]));
  await Promise.all(commits.map(async (c, i) => {
    let v = kept[i]?.result || null;
    if (!v) {
      try {
        const r = await fetch(`https://raw.githubusercontent.com/${REPO}/${c}/forge-worker/manifest.json`, { signal: AbortSignal.timeout(4000) });
        const m = r.ok ? (await r.json())?.version : null; v = typeof m === 'string' && /^\d+\.\d+$/.test(m) ? m : null;
      } catch (e) { v = null; }
      if (v) { try { await redis([['SET', `forge:rigger-version:v1:${c}`, v]]); } catch (e) {} }
    }
    out[c] = v;
  }));
  return out;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!isAdminRequest(req)) return res.status(401).json({ ok: false, error: 'Admin only' });
  try {
    const keys = await scan('forge:active-character:v1:*');
    const recs = await getMany(keys);
    const PUB = 'forge:active-character:v1:local_testing_wallet:';
    const pub = new Set(keys.map((k, i) => (k.startsWith(PUB) && recs[i] && typeof recs[i] === 'object' && !recs[i].walletAddress && (recs[i].forgeRigGlbUrl || recs[i].characterBundle?.forgeRigGlbUrl)
      ? `${recs[i].collectionKey}:${recs[i].tokenId}` : null)).filter(Boolean));
    const byBuild = new Map();
    recs.forEach((a) => { if (a && typeof a === 'object' && a.activeForgeBuildId && !byBuild.has(a.activeForgeBuildId)) byBuild.set(a.activeForgeBuildId, a); });
    const ids = [...byBuild.keys()];
    const builds = await getMany(ids.map(buildKey));
    const rebels = ids.map((id, i) => {
      const b = builds[i] && typeof builds[i] === 'object' ? builds[i] : {}, a = byBuild.get(id);
      const rigUrl = b.output?.forgeRigGlbUrl || b.forgeRig?.forgeRigGlbUrl || a.forgeRigGlbUrl || null;
      const collectionKey = b.collectionKey || a.collectionKey || '', tokenId = String(b.tokenId || a.tokenId || '');
      const fr = b.forgeRig || {}, wc = /^[0-9a-f]{7,40}$/.test(fr.workerCommit || '') ? fr.workerCommit : null;
      return { buildId: id, collectionKey, tokenId, name: a.name || b.name || '', rigUrl: BLOB.test(rigUrl || '') ? rigUrl : null, publicRig: pub.has(`${collectionKey}:${tokenId}`),
        rigWorker: wc, rigAt: fr.finishedAt || null, rigStatus: fr.status || null, rigError: fr.status === 'failed' ? String(fr.error || '').slice(0, 160) : null,
        mended: fr.headsnap ? { at: fr.headsnap.at || null, keys: fr.headsnap.keys || 0 } : null };   // (api/forge-rig-headsnap.mjs)
    }).filter((r) => r.rigUrl);
    const vers = await riggerVersions([...new Set(rebels.map((r) => r.rigWorker).filter(Boolean))]);
    rebels.forEach((r) => { r.rigger = r.rigWorker ? vers[r.rigWorker] || null : null; });
    const st = await redis(rebels.flatMap((r) => [['GET', `forge:games:v1:${r.rigUrl}`], ['GET', `forge:moves:v1:${r.rigUrl}`], ['GET', `forge:moves-job:v1:${r.buildId}`], ['GET', `forge:games-clips:v1:${r.rigUrl}`]]));
    rebels.forEach((r, i) => {
      r.games = st[i * 4]?.result || null; r.moves = st[i * 4 + 1]?.result || null;
      try { r.gamesClips = st[i * 4 + 3]?.result ? JSON.parse(st[i * 4 + 3].result) : null; } catch (e) { r.gamesClips = null; }
      let j = null; try { j = st[i * 4 + 2]?.result ? JSON.parse(st[i * 4 + 2].result) : null; } catch (e) {}
      r.job = j ? { status: j.status, gamesOnly: !!j.gamesOnly, startedAt: j.startedAt || null, finishedAt: j.finishedAt || null, error: j.error || null, games: j.games || null,
        gamesMissing: j.gamesMissing || null, gamesError: j.gamesError || null } : null;
    });
    rebels.sort((p, q) => (p.collectionKey + p.tokenId.padStart(8, '0')).localeCompare(q.collectionKey + q.tokenId.padStart(8, '0')));
    return res.status(200).json({ ok: true, rebels });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
}
