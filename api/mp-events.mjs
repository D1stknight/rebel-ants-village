// GET /api/mp-events -> { ok, now, live: [event], next: [event] }   (public: the lobby's LIVE NOW, Universe's banner)
// The Colony Stage's events on now and next, as the rooms' control desk has them (realtime/src/events.js briefEvent:
// what, where, when, the hosts' names, the show's title). The rooms' answer is kept 15 s at the edge.
import { siteOf, roomsUrl } from './mp-ticket.mjs';

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ ok: false, error: 'Method not allowed' }); }
  const url = roomsUrl(siteOf());
  if (!url) { res.setHeader('Cache-Control', 'public, max-age=60'); return res.status(200).json({ ok: true, now: Date.now(), live: [], next: [], off: true }); }
  try {
    const r = await fetch(url.replace(/^ws/, 'http') + '/v1/events', { signal: AbortSignal.timeout(6000) });
    const d = await r.json().catch(() => null);
    if (!r.ok || !d?.ok) throw new Error('rooms ' + r.status);
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=15, stale-while-revalidate=30');
    return res.status(200).json({ ok: true, now: d.now || Date.now(), live: Array.isArray(d.live) ? d.live : [], next: Array.isArray(d.next) ? d.next : [] });
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({ ok: false, error: 'The rooms did not answer' });
  }
}
