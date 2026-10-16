// Games packs for the Rebels in play (admin, Oct 16): every Rebel's active Forge build (the forge:active-character
// records the lobby and the village load), its live rig and whether that rig has a games pack yet
// (forge:games:v1:<rig>, made by /api/forge-rig-moves on a worker built with the games moves). The Rig worker box in
// the NPC Forge lists them and runs the missing ones.
//   GET -> { ok, rebels: [{ buildId, collectionKey, tokenId, name, rigUrl, games, moves, job }] }
import { isAdminRequest } from './_admin-auth.mjs';
import { redis, buildKey } from './_forge-rig.mjs';

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

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!isAdminRequest(req)) return res.status(401).json({ ok: false, error: 'Admin only' });
  try {
    const keys = await scan('forge:active-character:v1:*');
    const recs = await getMany(keys);
    const byBuild = new Map();
    recs.forEach((a) => { if (a && typeof a === 'object' && a.activeForgeBuildId && !byBuild.has(a.activeForgeBuildId)) byBuild.set(a.activeForgeBuildId, a); });
    const ids = [...byBuild.keys()];
    const builds = await getMany(ids.map(buildKey));
    const rebels = ids.map((id, i) => {
      const b = builds[i] && typeof builds[i] === 'object' ? builds[i] : {}, a = byBuild.get(id);
      const rigUrl = b.output?.forgeRigGlbUrl || b.forgeRig?.forgeRigGlbUrl || a.forgeRigGlbUrl || null;
      return { buildId: id, collectionKey: b.collectionKey || a.collectionKey || '', tokenId: String(b.tokenId || a.tokenId || ''), name: a.name || b.name || '', rigUrl: BLOB.test(rigUrl || '') ? rigUrl : null };
    }).filter((r) => r.rigUrl);
    const st = await redis(rebels.flatMap((r) => [['GET', `forge:games:v1:${r.rigUrl}`], ['GET', `forge:moves:v1:${r.rigUrl}`], ['GET', `forge:moves-job:v1:${r.buildId}`]]));
    rebels.forEach((r, i) => {
      r.games = st[i * 3]?.result || null; r.moves = st[i * 3 + 1]?.result || null;
      let j = null; try { j = st[i * 3 + 2]?.result ? JSON.parse(st[i * 3 + 2].result) : null; } catch (e) {}
      r.job = j ? { status: j.status, gamesOnly: !!j.gamesOnly, startedAt: j.startedAt || null, finishedAt: j.finishedAt || null, error: j.error || null, games: j.games || null,
        gamesMissing: j.gamesMissing || null, gamesError: j.gamesError || null } : null;
    });
    rebels.sort((p, q) => (p.collectionKey + p.tokenId.padStart(8, '0')).localeCompare(q.collectionKey + q.tokenId.padStart(8, '0')));
    return res.status(200).json({ ok: true, rebels });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
}
