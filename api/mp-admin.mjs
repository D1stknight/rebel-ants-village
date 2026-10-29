// POST /api/mp-admin  { cmd, args }   (the Admin Hub, signed in as admin)  -> what the rooms answer
// The Admin Hub's multiplayer tools reach the room server (realtime/) through here: online now, the chat log, the
// reports, mute / kick / ban by account, delete a message / clear a room's chat, the chat settings (on / off everywhere,
// slow mode, links, the word filter, the admins' own words, voice on / off) and the Colony Stage's events (made, live, ended,
// the show started or stopped, hosts). This route checks the admin session, signs the command with
// the site's admin key (api/mp-ticket.mjs adminKey: worked out from VILLAGE_SESSION_SECRET apart from the ticket key, so
// a player's ticket is never a command), and posts it to the rooms' /v1/admin, which check the signature (ADMIN_KEYS)
// and run each command once. Commands live a minute.
import crypto from 'node:crypto';
import { isAdminRequest } from './_admin-auth.mjs';
import { siteOf, adminKey, roomsUrl } from './mp-ticket.mjs';

const COMMANDS = new Set(['online', 'log', 'reports', 'report-state', 'mods', 'mute', 'unmute', 'ban', 'unban', 'kick', 'del', 'clear', 'cfg-get', 'cfg-set',
  'events', 'event-save', 'event-live', 'event-end', 'event-show', 'event-host', 'event-delete']); // (the Colony Stage's events: realtime/src/events.js)

export function signCommand(cmd, args, site = siteOf(), now = Date.now()) {
  const sec = Math.floor(now / 1000);
  const body = Buffer.from(JSON.stringify({ v: 1, typ: 'mp-admin', site, cmd, args, iat: sec, exp: sec + 60, nonce: crypto.randomBytes(16).toString('base64url') })).toString('base64url');
  return `${body}.${crypto.sign(null, Buffer.from(body), adminKey(site).priv).toString('base64url')}`;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false, error: 'Method not allowed' }); }
  let admin = false; try { admin = isAdminRequest(req); } catch (e) { admin = false; }
  if (!admin) return res.status(401).json({ ok: false, error: 'Admin login required' });
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } }
  const cmd = String(b?.cmd || ''), args = b?.args && typeof b.args === 'object' && !Array.isArray(b.args) ? b.args : {};
  if (!COMMANDS.has(cmd)) return res.status(400).json({ ok: false, error: 'Unknown command' });
  if (JSON.stringify(args).length > (cmd === 'event-save' ? 120000 : 8000)) return res.status(413).json({ ok: false, error: 'Too much' }); // (an event's show: up to 400 lines)
  try {
    const site = siteOf(), url = roomsUrl(site);
    if (!url) return res.status(503).json({ ok: false, error: 'The rooms are not switched on yet' });
    const r = await fetch(url.replace(/^ws/, 'http') + '/v1/admin', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: signCommand(cmd, args, site), signal: AbortSignal.timeout(15000) });
    const out = await r.json().catch(() => ({ ok: false, error: 'The rooms did not answer' }));
    if (r.status === 401) return res.status(502).json({ ok: false, error: 'The rooms do not know this site\'s admin key yet', site });
    return res.status(r.ok ? 200 : 502).json({ site, ...out });
  } catch (e) {
    return res.status(e.status || 502).json({ ok: false, error: e.status ? e.message : 'The rooms did not answer' });
  }
}
