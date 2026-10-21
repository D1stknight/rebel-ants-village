// Oct 21 (Miguel: "i cant remember which saint i forged ... it does not tell me in the lobby"): which of a wallet's
// tokens have a forged character (a build with a finished rig), for the lobby's Forged badge. A token forged in the
// Rebel Forge but never made the holder's character has no active character, so its card looked unforged.
// GET ?c=<collection>&t=<id>,<id>,... (up to 120) -> { ok, forged: { <id>: { buildId, thumb } } }: each token's newest
// build with a rig. Public and read-only, like forge-builds-list (which hands out the whole build records).
import { enforceRateLimit } from './_guard.mjs';

const MAX_TOKENS = 120, BUILDS_PER_TOKEN = 8;

async function redis(commands) {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '';
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';
  if (!url || !token) throw new Error('Redis is not configured');
  const r = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
    signal: AbortSignal.timeout(6000)
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error || `Redis request failed with status ${r.status}`);
  return Array.isArray(data) ? data : [];
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ ok: false, error: 'Method not allowed' }); }
  const col = String(req.query?.c || 'battle_for_colony');
  const toks = [...new Set(String(req.query?.t || '').split(',').map((s) => s.trim()).filter(Boolean))];
  if (!/^[a-z0-9_]{1,64}$/.test(col) || col === 'npc') return res.status(400).json({ ok: false, error: 'Invalid collection' });
  if (!toks.length || toks.length > MAX_TOKENS || toks.some((t) => !/^(0|[1-9][0-9]{0,77})$/.test(t))) return res.status(400).json({ ok: false, error: `1 to ${MAX_TOKENS} token ids` });
  if (!(await enforceRateLimit(req, res, 'forge-forged', 240, 600, 'Forge lookups'))) return;
  try {
    const lists = await redis(toks.map((t) => ['LRANGE', `forge:3d-builds:v1:${col}:${t}`, 0, BUILDS_PER_TOKEN - 1]));
    const want = [];
    toks.forEach((t, i) => { for (const id of lists[i]?.result || []) want.push([t, id]); });
    const forged = {};
    if (want.length) {
      const rows = await redis(want.map(([, id]) => ['GET', `forge:3d-build:v1:${id}`]));
      rows.forEach((row, i) => {
        let b = null; try { b = row?.result ? JSON.parse(row.result) : null; } catch (e) {}
        const t = want[i][0];
        if (!b?.output?.forgeRigGlbUrl || (b.collectionKey && b.collectionKey !== col) || (b.tokenId != null && String(b.tokenId) !== t)) return;
        const at = Date.parse(b.createdAt || '') || 0, cur = forged[t];
        if (!cur || at > cur.at) forged[t] = { buildId: b.buildId || want[i][1], thumb: b.output.forgeRigThumbUrl || null, at };
      });
    }
    for (const t of Object.keys(forged)) delete forged[t].at;
    return res.status(200).json({ ok: true, forged });
  } catch (err) {
    return res.status(503).json({ ok: false, error: 'Could not read the Forge right now' });
  }
}
