// GET /api/admin-stats?hours=24   (the Admin Hub's dashboard, admin only)
// Everything the dashboard shows in one answer:
//   health    the services Universe needs, checked now (the rooms, Redis, the Rebel Economy) with how long each took
//   online    players in the rooms right now, by village (the rooms' own count), signed in / guests
//   perf      how the game runs (the rooms' 'stats': fps on computers and phones, the share under 30 fps, ping, drops,
//             freezes, each village, device families), from the pages' minute reports
//   telemetry what went wrong on players' screens (api/_telemetry.mjs: errors, startup problems, how long villages took)
//   counters  the site's days (api/_site-stats.mjs: players a day, sign-ins, Rebel Points paid, forges, saves, badges)
//   alerts    what needs a look, worked out from the above (red: something is down; amber: worse than it should be)
// Each part answers on its own: one that fails says so (ok: false, error) and the rest still come.
import { isAdminRequest } from './_admin-auth.mjs';
import { siteOf, roomsUrl } from './mp-ticket.mjs';
import { signCommand } from './mp-admin.mjs';
import { summary } from './_telemetry.mjs';
import { daily } from './_site-stats.mjs';
import { econEnv, econCall } from './_econ.mjs';

const timed = async (fn) => { const t0 = Date.now(); try { const v = await fn(); return { v, ms: Date.now() - t0 }; } catch (e) { return { e, ms: Date.now() - t0 }; } };
async function rooms(cmd, args, site) {
  const url = roomsUrl(site);
  if (!url) throw new Error('The rooms are not switched on');
  const r = await fetch(url.replace(/^ws/, 'http') + '/v1/admin', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: signCommand(cmd, args, site), signal: AbortSignal.timeout(12000) });
  const out = await r.json().catch(() => null);
  if (r.status === 401) throw new Error('The rooms do not know this site\'s admin key');
  if (!r.ok || !out || !out.ok) throw new Error((out && out.error) || `The rooms answered ${r.status}`);
  return out;
}
async function redisPing() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '', token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';
  if (!url || !token) throw new Error('Redis is not configured');
  const r = await fetch(`${url}/pipeline`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '[["PING"]]', signal: AbortSignal.timeout(5000) });
  const d = await r.json().catch(() => null);
  if (!r.ok || d?.[0]?.result !== 'PONG') throw new Error(`Redis answered ${r.status}`);
  return true;
}

// Each alert says when it clears by itself (clears) and what to do (todo): the dashboard shows both under it (Nov 5,
// Miguel: "add the what clears it / what to do line under each alert"). The windows named are the ones its rule reads.
export function alertsOf({ health, perf, telemetry, online, counters }) {
  const out = [], add = (level, area, text, clears, todo) => out.push({ level, area, text, ...(clears ? { clears } : {}), ...(todo ? { todo } : {}) });
  const red = (area, text, clears, todo) => add('red', area, text, clears, todo), amber = (area, text, clears, todo) => add('amber', area, text, clears, todo);
  const ASK = 'If it stays, tell Claude.';
  const down = { rooms: 'Multiplayer is off for everyone while the rooms are down (Universe still plays alone). Tell Claude at once.', redis: "Saves, limits and the dashboard's numbers need it: look at Upstash's status page, then tell Claude if it lasts more than a few minutes.", economy: "Rebel Points and sign-ins need it: look at the Rebel Economy's own admin (the Rebel Console), then tell Claude." };
  for (const h of health) if (!h.ok) red(h.id, h.note || 'not answering', 'As soon as it answers again (the dashboard checks every 30 s).', down[h.id] || ASK);
  // a part the dashboard could not read (its service may still answer: rooms deployed before 'stats' answer 'Unknown command')
  const roomsUp = health.find(h => h.id === 'rooms')?.ok;
  if (perf && !perf.ok && roomsUp) {
    if (/unknown command/i.test(perf.error || '')) amber('rooms', "the rooms don't keep the game's numbers yet: they need their update (a rooms deploy)", 'Once the rooms run their update.', 'Ask Claude to deploy the live rooms.');
    else amber('rooms', `the game's numbers could not be read (${perf.error})`, 'The next time they can be read (every 30 s).', 'Usually passes by itself. ' + ASK);
  }
  if (online && !online.ok && roomsUp) amber('rooms', `who is online could not be read (${online.error})`, 'The next time it can be read (every 30 s).', 'Usually passes by itself. ' + ASK);
  for (const [part, name] of [[telemetry, "players' errors"], [counters, "the site's days"]]) if (part && !part.ok) amber('redis', `${name} could not be read (${part.error})`, 'The next time the database answers (every 30 s).', 'Usually passes by itself. ' + ASK);
  for (const h of health) if (h.ok && h.ms > 3000) amber(h.id, `slow to answer (${(h.ms / 1000).toFixed(1)} s)`, 'When it answers in under 3 s again.', 'Usually passes by itself. If it stays slow for an hour, tell Claude.');
  const now = perf?.ok ? perf.now : null;
  const BYWHERE = 'Performance → By village and By device show where and on what: send that page to Claude.';
  if (now && now.reports >= 3) {
    if (now.slowPct >= 40) amber('fps', `${now.slowPct}% of players ran under 30 fps in the last 5 minutes`, 'When fewer than 4 in 10 players run under 30 fps over the last 5 minutes.', BYWHERE);
    if (now.fpsP != null && now.fpsP < 25) amber('fps', `Phones average ${now.fpsP} fps right now`, 'When phones average 25 fps or more over the last 5 minutes.', 'Often a crowd or a heavy village on older phones. ' + BYWHERE);
    if (now.fpsD != null && now.fpsD < 30) amber('fps', `Computers average ${now.fpsD} fps right now`, 'When computers average 30 fps or more over the last 5 minutes.', 'Often older computers or laptops on battery. ' + BYWHERE);
    if (now.lagPct >= 25) amber('lag', `${now.lagPct}% of players have a ping of 200 ms or more`, 'When fewer than 1 in 4 players have a ping of 200 ms or more (the last 5 minutes).', "Usually the players' own connections (far away, mobile data). If everyone has it at once, tell Claude to check the rooms.");
  }
  if (perf?.ok && perf.series?.length) {
    const last = perf.series.slice(-4), joins = last.reduce((a, s) => a + s.joins, 0), drops = last.reduce((a, s) => a + s.drops, 0);
    const mins = (perf.step || 15) * 4, lately = mins >= 120 ? `the last ${Math.round(mins / 60)} hours` : mins >= 60 ? 'the last hour' : `the last ${mins} minutes`;
    if (joins >= 5 && drops / joins > .15) amber('drops', `${drops} dropped connections for ${joins} joins lately (${Math.round(drops / joins * 100)}%)`, `When ${lately} has 15% or fewer dropped connections (the time picked above changes "lately").`, 'Phones losing signal or going to sleep cause most of them; each page joins again by itself. If it stays with many players, send Performance → Dropped connections to Claude.');
    const fr = last.reduce((a, s) => a + s.freezes, 0), rep = last.reduce((a, s) => a + s.reports, 0);
    if (rep >= 5 && fr / rep > .5) amber('fps', `Freezes over a second: ${fr} in ${rep} player-minutes lately`, `When ${lately} has under one freeze every 2 player-minutes, or once those minutes pass with no more (the time picked above changes "lately").`, 'A few are normal while a village or another player\'s model loads, and one player on an old device is enough. ' + BYWHERE);
  }
  if (telemetry?.ok) {
    const t = telemetry, loads = t.totals.loads || 0, hours = t.hours;
    if (loads >= 20 && t.totals.err / loads > .05) amber('errors', `${t.totals.err} script errors for ${loads} pages opened (${Math.round(t.totals.err / loads * 100)} per 100) in ${hours} h`, `When the last ${hours} h have 5 errors or fewer per 100 pages opened: more clean visits, or the errors getting older than ${hours} h.`, 'Issues → Most common errors shows each one (the message, the file and line, the device): send a screenshot to Claude to fix.');
    const dayAgo = Date.now() - 86400000;
    for (const e of t.errors || []) if (e.first > dayAgo && e.n >= 5) amber('errors', `New error, ${e.n} times since ${new Date(e.first).toISOString().slice(11, 16)} UTC: ${String(e.m).slice(0, 90)}`, 'A day after it first showed up.', 'Send it to Claude: Issues → Most common errors has the file and line.');
    const P = t.problems || {}, say = { crash: 'pages that closed on screen (most likely out of memory)', 'gl-lost': 'times the 3D was lost (phones: memory)', 'slow-start': 'starts that took over 90 s', webgl: 'browsers without WebGL', rig: "Rebels' models that couldn't download" };
    const fix = {
      crash: 'Mostly phones running out of memory: that phone starts lighter for 3 days by itself. If there are many, send Issues to Claude.',
      'gl-lost': 'Phones running out of memory (the 3D reset under the page). If there are many, send Issues to Claude.',
      'slow-start': 'Slow connections or old devices. If one village shows up again and again, send Issues to Claude.',
      webgl: "Usually the player's browser: 3D switched off, an old or work computer, or a bot opening the page. They see a card telling them how to turn it on. Issues → Startup problems shows which devices.",
      rig: "A Rebel's model was blocked from downloading (a strict network): they play as the starter ant. If there are many, tell Claude."
    };
    for (const [c, txt] of Object.entries(say)) if ((P[c]?.n || 0) >= 3) amber('start', `${P[c].n} ${txt} in ${hours} h`, `When fewer than 3 are left in the last ${hours} h.`, fix[c]);
    const slow = (t.ready || []).filter(r => r.p === 'village' && r.n >= 3 && r.avgMs > (r.d === 'p' ? 45000 : 30000));
    for (const r of slow.slice(0, 3)) amber('start', `${r.v || 'a village'} takes ${(r.avgMs / 1000).toFixed(0)} s to be ready on ${r.d === 'p' ? 'phones' : 'computers'} (${r.n} starts)`, `When its average over the last ${hours} h drops under ${r.d === 'p' ? 45 : 30} s.`, 'Send Issues → How long villages take to be ready to Claude.');
  }
  if (online?.ok) for (const r of online.villages) if (r.copies > 1 && r.players >= 45 * r.copies) amber('rooms', `${r.v}: ${r.players} players in ${r.copies} copies (nearly full)`, 'When that village has fewer than 45 players a copy.', 'If every copy fills, raise Copies per village on the Limits page.');
  return out;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ ok: false, error: 'Method not allowed' }); }
  let admin = false; try { admin = isAdminRequest(req); } catch (e) { admin = false; }
  if (!admin) return res.status(401).json({ ok: false, error: 'Admin login required' });
  const site = siteOf(), hours = Math.max(1, Math.min(336, Math.round(+req.query?.hours || 24))), url = roomsUrl(site);
  const econOn = (() => { const e = econEnv(); return !!(e.REBEL_ECONOMY_URL && e.REBEL_ECONOMY_SERVICE_KEY); })();
  const [rh, rd, re, st, on, tl, ct] = await Promise.all([
    timed(async () => { if (!url) throw new Error('not switched on'); const r = await fetch(url.replace(/^ws/, 'http') + '/v1/health', { signal: AbortSignal.timeout(5000) }); if (!r.ok) throw new Error(`answered ${r.status}`); return r.json(); }),
    timed(redisPing),
    econOn ? timed(async () => { const r = await econCall(`/api/internal/user-by-wallet?address=0x${'0'.repeat(39)}1`, null, 'GET'); if (r.status === 401 || r.status === 403) throw new Error('our key is refused'); if (r.status >= 500) throw new Error(`answered ${r.status}`); return true; }) : Promise.resolve(null),
    timed(() => rooms('stats', { hours }, site)),
    timed(() => rooms('online', {}, site)),
    timed(() => summary({ hours })),
    timed(() => daily(14))
  ]);
  const health = [
    { id: 'rooms', label: 'Multiplayer rooms', ok: !rh.e, ms: rh.ms, note: rh.e ? rh.e.message : '' },
    { id: 'redis', label: 'Universe database (Redis)', ok: !rd.e, ms: rd.ms, note: rd.e ? rd.e.message : '' },
    ...(re ? [{ id: 'economy', label: 'Rebel Economy', ok: !re.e, ms: re.ms, note: re.e ? re.e.message : '' }] : [{ id: 'economy', label: 'Rebel Economy', ok: false, ms: 0, note: 'not set up on this deploy' }])
  ];
  const perf = st.e ? { ok: false, error: st.e.message } : st.v;
  let online = { ok: false, error: on.e?.message };
  if (!on.e) {
    const by = new Map();
    for (const r of on.v.rooms || []) {
      const v = by.get(r.village) || by.set(r.village, { v: r.village, players: 0, copies: 0, signed: 0, guests: 0 }).get(r.village);
      v.players += r.players.length; v.copies++; for (const p of r.players) p.k === 'guest' ? v.guests++ : v.signed++;
    }
    const villages = [...by.values()].sort((a, b) => b.players - a.players);
    online = { ok: true, total: on.v.total || 0, signed: villages.reduce((a, v) => a + v.signed, 0), guests: villages.reduce((a, v) => a + v.guests, 0), villages };
  }
  const telemetry = tl.e ? { ok: false, error: tl.e.message } : tl.v;
  const counters = ct.e ? { ok: false, error: ct.e.message } : { ok: true, ...ct.v };
  const alerts = alertsOf({ health, perf, telemetry, online, counters });
  return res.status(200).json({ ok: true, site, at: Date.now(), hours, deploy: { env: process.env.VERCEL_ENV || 'local', commit: String(process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7), branch: process.env.VERCEL_GIT_COMMIT_REF || '' },
    health, online, perf, telemetry, counters, alerts });
}
