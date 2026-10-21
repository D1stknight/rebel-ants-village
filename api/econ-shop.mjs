// GET /api/econ-shop?return=<a path on this site> -> the Rebel Economy's points shop, signed in.
// A signed-in player (ra_econ: Discord or name + PIN) gets a 2-minute ticket from the economy
// (/api/internal/shop-ticket, this app's service key: the key never reaches the browser) and lands on the
// shop signed in to the same account, with a Back link to the page they came from. Signed out, or an
// economy without the ticket route: the plain shop (its own sign-in), still with the Back link.
import { enforceRateLimit, clientIp } from './_guard.mjs';
import { econCall, econReady, econSessionOf, econShopUrl, publicOrigin, safeReturn } from './_econ.mjs';

const FALLBACK_SHOP = 'https://economy.rebelants.io/shop';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  const back = publicOrigin(req) + safeReturn(req.query?.return || '/index.html');
  const shop = econShopUrl() || FALLBACK_SHOP;
  const plain = `${shop}?return=${encodeURIComponent(back)}`;
  const s = econReady() ? econSessionOf(req) : null;
  if (s) {
    if (!(await enforceRateLimit(req, res, `econ-shop:${s.u}`, 120, 3600, 'shop visits'))) return;
    try {
      const { ok, data } = await econCall('/api/internal/shop-ticket', { userId: s.u, return: back });
      // only ever the economy's own shop entrance (never somewhere an answer names)
      if (ok && typeof data?.url === 'string' && data.url.startsWith(shop.replace(/\/shop$/, '/shop/enter?t='))) {
        res.setHeader('Referrer-Policy', 'no-referrer');
        res.setHeader('Location', data.url);
        return res.status(302).end();
      }
    } catch (e) {
      console.warn('[econ-shop] ticket', e.message);
    }
  } else if (!(await enforceRateLimit(req, res, `econ-shop-ip:${clientIp(req)}`, 240, 3600, 'shop visits'))) return;
  res.setHeader('Location', plain);
  return res.status(302).end();
}
