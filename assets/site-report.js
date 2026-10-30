// What goes wrong on a player's screen, for the Admin Hub's dashboard (api/telemetry.mjs): script errors (each kind once a
// page, with how often it came), startup problems (window.SiteReport.problem(code): no WebGL, the Rebel's model blocked,
// the page died last time, the 3D lost to memory, a start that never finished), and how long the page took to be ready
// (SiteReport.ready(ms)). Page names, numbers and the error's own words only: no names, accounts or addresses' queries.
// Sent in one beacon a few seconds after something happens, and when the page is left. ?report=0 sends nothing.
(function () {
  'use strict';
  if (window.SiteReport) return;
  const path = location.pathname, q = new URLSearchParams(location.search);
  const PAGE = /village\.html$/.test(path) ? 'village' : /forge-v2\.html$/.test(path) ? 'forge' : /admin\.html$/.test(path) ? 'admin' : 'lobby';
  const VILLAGE = PAGE === 'village' ? (q.get('village') || 'hub').toLowerCase().replace(/[^a-z-]/g, '').slice(0, 20) : '';
  const off = q.get('report') === '0' || navigator.webdriver && !window._reportInTests;
  const UA = navigator.userAgent || '';
  const DEV = {
    d: matchMedia('(hover: none) and (pointer: coarse)').matches ? 'p' : 'd',
    o: /iPhone|iPad|iPod/.test(UA) || (/Macintosh/.test(UA) && navigator.maxTouchPoints > 1) ? 'ios' : /Android/.test(UA) ? 'android' : /CrOS/.test(UA) ? 'cros'
      : /Mac OS X|Macintosh/.test(UA) ? 'mac' : /Windows/.test(UA) ? 'win' : /Linux/.test(UA) ? 'linux' : 'other',
    b: /Edg(A|iOS)?\//.test(UA) ? 'edge' : /OPR\/|Opera/.test(UA) ? 'opera' : /Firefox|FxiOS/.test(UA) ? 'firefox' : /CriOS|Chrome\//.test(UA) ? 'chrome' : /Safari/.test(UA) ? 'safari' : 'other'
  };
  const queue = [], seen = new Map(), probs = new Set();
  let timer = 0, sentReady = false, errors = 0;
  const base = () => ({ p: PAGE, v: VILLAGE, d: DEV.d, o: DEV.o, b: DEV.b });
  function flush() {
    clearTimeout(timer); timer = 0;
    if (off || !queue.length) return;
    const l = +window._crashLight || 0; // (the lighter level a phone runs at after a crash: set by the village later on)
    // an error goes with how many times it came since it was last sent
    const body = JSON.stringify({ events: queue.splice(0, 12).map(e => { if (!e.rec) return { ...e, l }; const n = e.n - e.told; e.told = e.n; return { ...e.ev, n, l }; }) });
    try { if (!(navigator.sendBeacon && navigator.sendBeacon('/api/telemetry', body))) fetch('/api/telemetry', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(() => {}); } catch (e) {}
    if (queue.length) timer = setTimeout(flush, 1000);
  }
  const soon = (ms = 4000) => { if (!timer) timer = setTimeout(flush, ms); };
  // the file and line an error came from (no folders, no queries), and the first frames of its stack
  const short = s => String(s || '').replace(/[?#].*?(?=:\d+(:\d+)?$|$)/, '').replace(/^.*\//, '');
  function frames(stack) {
    return String(stack || '').split('\n').map(l => { const m = l.match(/(?:\(|@|at )?((?:https?:|blob:|webpack:)?[^\s()@]*?\/[^\s()@/]+?:\d+(?::\d+)?)\)?\s*$/); return m ? short(m[1]) : ''; })
      .filter(Boolean).slice(0, 5);
  }
  // noise that says nothing about Universe: browser extensions, the benign ResizeObserver note, a cross-site script
  const NOISE = /^(ResizeObserver loop|Script error\.?$)|extension:\/\/|^Non-Error promise rejection captured/;
  function error(msg, src, stack) {
    if (off) return;
    msg = String(msg || '').slice(0, 400); if (!msg || NOISE.test(msg) || /extension:\/\//.test(String(src || '') + String(stack || ''))) return;
    const key = msg + '|' + src, had = seen.get(key);
    if (had) { had.n++; return; } // (the same mistake again: counted, sent with the next beacon or on leaving)
    if (++errors > 15) return; // (a page throwing every frame: the first 15 kinds are enough)
    const rec = { rec: true, ev: { k: 'err', ...base(), m: msg, s: short(src), st: frames(stack) }, n: 1, told: 0 };
    seen.set(key, rec); queue.push(rec); soon();
  }
  addEventListener('error', ev => {
    if (ev.target && ev.target !== window) return; // (a missing picture or script: not a script error)
    const er = ev.error; error(er && er.message || ev.message, ev.filename ? `${ev.filename}:${ev.lineno}:${ev.colno}` : '', er && er.stack);
  });
  addEventListener('unhandledrejection', ev => {
    const r = ev.reason; if (r && (r.name === 'AbortError' || r.name === 'NotAllowedError')) return; // (a cancelled fetch, a sound before a tap)
    error('Promise: ' + (r && r.message || String(r)), '', r && r.stack);
  });
  // a start problem (once a page each): webgl, rig, crash, gl-lost, slow-start, layout ...
  function problem(code, note) {
    if (off || !/^[a-z0-9-]{2,24}$/.test(code) || probs.has(code)) return;
    probs.add(code); queue.push({ k: 'prob', ...base(), c: code, m: String(note || '').slice(0, 200) }); soon(1500);
  }
  // how long the page took to be ready (from the address being opened), once a page
  function ready(ms) {
    if (off || sentReady) return; sentReady = true;
    ms = Math.round(ms == null ? performance.now() : ms);
    queue.push({ k: 'ready', ...base(), ms }); soon(1500);
  }
  if (!off) queue.push({ k: 'load', ...base() }); // (every page opened: errors per hundred pages)
  // the repeats counted since an error's beacon go with the next one, or when the page is left (the server adds them up)
  const repeats = () => { for (const r of seen.values()) if (r.n > r.told && !queue.includes(r)) queue.push(r); };
  addEventListener('pagehide', () => { repeats(); flush(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { repeats(); flush(); } });
  // a 3D page that died on screen last time in this tab (its mark still 'on': a page left normally says 'off', one put in
  // the background 'hidden'); on a phone most likely out of memory, on a computer the browser's own crash
  if (PAGE === 'village' || PAGE === 'forge') try {
    const K = 'rebelAntsPageAlive:v1', was = sessionStorage.getItem(K) || '';
    let left = false;
    const set = v => { try { sessionStorage.setItem(K, v); } catch (e) {} };
    const mark = () => set(document.visibilityState === 'hidden' ? 'hidden' : 'on:' + PAGE + ':' + VILLAGE);
    if (was.startsWith('on:')) problem('crash', 'the last page here closed on screen: ' + was.slice(3).replace(':', ' '));
    mark();
    document.addEventListener('visibilitychange', () => { if (!left) mark(); });
    addEventListener('pagehide', () => { left = true; set('off'); });
    addEventListener('pageshow', e => { if (e.persisted) { left = false; mark(); } });
  } catch (e) {}
  window.SiteReport = { error, problem, ready, flush, repeats, get queued() { return queue.map(e => (e.rec ? { ...e.ev, n: e.n - e.told } : e)); }, dev: DEV, page: PAGE };
})();
