// assets/site-files.js — our stored files (Rebel models, games packs, renders, pictures) through this site's own address
// (Oct 24). They live in Vercel Blob (vg8yazzy1wnobiup.public.blob.vercel-storage.com); some networks (school and work
// filters) block that host, and then the Rebel, the lobby's pictures and the Forge's models were missing. The browser now
// asks for /blob/<path> on this site instead, and vercel.json passes that to the store (cached on Vercel's CDN).
// Saved records keep the store's own URLs (servers and the Forge's partners use them); only the browser's requests
// change: fetch(), Babylon's file and image loads (its PreprocessUrl hook), an <img>'s src set from script, and the
// pages' <img> templates (viaSite()). ?blob=direct goes straight to the store (tests, or if the site's copy ever fails).
(function () {
  const STORE = /^https:\/\/vg8yazzy1wnobiup\.public\.blob\.vercel-storage\.com\//i;
  let direct = false;
  try { direct = new URLSearchParams(location.search).get('blob') === 'direct'; } catch (e) {}
  function viaSite(u) {
    if (direct || typeof u !== 'string' || !STORE.test(u)) return u;
    return u.replace(STORE, '/blob/');
  }
  window.viaSite = viaSite;
  if (direct) return;

  // fetch(): a GET or HEAD of a stored file goes to /blob/
  const fetch0 = window.fetch;
  if (typeof fetch0 === 'function') {
    window.fetch = function (input, init) {
      try {
        const method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
        if (method === 'GET' || method === 'HEAD') {
          if (typeof input === 'string') input = viaSite(input);
          else if (input instanceof URL) input = viaSite(input.href);
          else if (typeof Request !== 'undefined' && input instanceof Request && STORE.test(input.url)) input = new Request(viaSite(input.url), input);
        }
      } catch (e) {}
      return fetch0.call(this, input, init);
    };
  }

  // <img>: src set from script (img.src = url, new Image())
  try {
    const d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    if (d && d.set && d.get) Object.defineProperty(HTMLImageElement.prototype, 'src', { configurable: true, enumerable: d.enumerable, get: d.get, set(v) { d.set.call(this, viaSite(typeof v === 'string' ? v : String(v))); } });
  } catch (e) {}

  // Babylon: every model, texture and file it loads by URL. The pages load Babylon's scripts just before this one; the
  // two events catch a page that loads them later.
  function hookBabylon() {
    const T = window.BABYLON && window.BABYLON.Tools;
    if (!T || T.__viaSite) return;
    const prev = T.PreprocessUrl;
    T.PreprocessUrl = (u) => viaSite(typeof prev === 'function' ? prev(u) : u);
    T.__viaSite = true;
  }
  hookBabylon();
  document.addEventListener('DOMContentLoaded', hookBabylon);
  window.addEventListener('load', hookBabylon);
})();
