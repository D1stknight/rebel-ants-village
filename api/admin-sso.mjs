// The Rebel Console (the economy's admin, economy.rebelants.io/admin) opens Universe's Admin Hub already signed in.
// Apps → Rebel Universe makes a one-time admin ticket (2 minutes, one use, owners and admins only) and posts it here
// as a form (field ticket). The ticket is checked with the economy (/api/internal/admin-ticket, scope universe.admin,
// with this site's own app key: a ticket made for another app never opens Universe), then the browser gets the same
// admin session the password sign-in gives (ra_admin_session, 12 hours) and the Admin Hub opens.
//   POST ticket=rat_...  -> a page that opens /admin.html signed in, or says why not
import { createAdminSessionToken, buildAdminSessionCookie, rebelConsoleUrl } from './_admin-auth.mjs';
import { econCall } from './_econ.mjs';
import { rateLimit } from './_guard.mjs';

const TICKET = /^rat_[A-Za-z0-9_-]{20,96}$/;
const SCOPE = 'universe.admin';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const consoleUrl = () => rebelConsoleUrl('/admin');
function ticketOf(req) {
  const b = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : req.body;
  if (b && typeof b === 'object') return String(b.ticket || '');
  try { return String(new URLSearchParams(String(b || '')).get('ticket') || ''); } catch (e) { return ''; }
}

function page(res, status, { ok = false, title, text }) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  const link = ok ? '<a href="/admin.html">Open the Admin Hub</a>' : `<a href="${esc(consoleUrl())}">Back to the Rebel Console</a>`;
  res.end(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Rebel Universe</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0a0c11;color:#ece4cf;font:15px/1.5 system-ui,sans-serif}
.c{max-width:380px;margin:16px;padding:28px 24px;text-align:center;border:1px solid rgba(214,175,92,.35);border-radius:10px;background:rgba(255,255,255,.03)}
b{display:block;color:${ok ? '#d6af5c' : '#e06b5b'};letter-spacing:2px;text-transform:uppercase;font-size:12px;margin-bottom:8px}a{color:#5ecfca}</style></head>
<body><div class="c"><b>${esc(title)}</b><p>${esc(text)}</p><p>${link}</p></div>
${ok ? '<script>location.replace("/admin.html")</script>' : ''}</body></html>`);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return page(res, 405, { title: 'Open it from the Rebel Console', text: "Universe's Admin Hub opens from the Rebel Console: Apps → Rebel Universe." });
  }
  const rl = await rateLimit(req, 'admin-sso', 20, 900);
  if (!rl.ok) return page(res, 429, { title: 'Too many tries', text: 'Wait a few minutes, then open Universe again from the Rebel Console.' });
  const ticket = ticketOf(req);
  if (!TICKET.test(ticket)) return page(res, 400, { title: 'Not signed in', text: 'This is not a Rebel Console sign-in. Open Universe from the Rebel Console: Apps → Rebel Universe.' });
  let r;
  try { r = await econCall('/api/internal/admin-ticket', { ticket, scope: SCOPE }); }
  catch (e) {
    console.error('[admin-sso]', e.message);
    return page(res, 503, { title: 'Not signed in', text: 'The Rebel Economy did not answer. Try again in a minute.' });
  }
  const d = r.data || {};
  if (r.status >= 500) {
    console.error('[admin-sso] economy', r.status, d.error || '');
    return page(res, 503, { title: 'Not signed in', text: 'The Rebel Economy did not answer. Try again in a minute.' });
  }
  if (!r.ok || d.ok !== true || (d.role !== 'owner' && d.role !== 'admin')) {
    console.warn('[admin-sso] refused', r.status, d.error || '', d.role || '');
    const expired = r.status === 401 && d.error === 'invalid_ticket';
    return page(res, expired ? 401 : 403, { title: 'Not signed in', text: expired
      ? 'That sign-in link has expired or was used already (each one works once, for 2 minutes). Open Universe again from the Rebel Console.'
      : 'The Rebel Economy did not let this sign-in through. Open Universe again from the Rebel Console.' });
  }
  console.info('[admin-sso] signed in from the console', String(d.adminId || '').slice(0, 64), d.role);
  res.setHeader('Set-Cookie', buildAdminSessionCookie(createAdminSessionToken()));
  return page(res, 200, { ok: true, title: 'Signed in', text: 'Opening the Admin Hub…' });
}
