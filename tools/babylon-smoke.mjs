#!/usr/bin/env node
// The Babylon smoke test (Oct 22). Boots every village, the Rebel Forge, the NPC Forge and the terrain lab in a headless
// browser on the Babylon copy the pages point at (assets/vendor/babylon/<version>/), plus a rig check (the starter ant:
// Draco, skin, its moves), and writes down what each page did. tools/babylon-robot.mjs runs it on the Babylon in use and on
// a newer one and compares the two (.github/workflows/babylon-check.yml, every Tuesday).
//
// node tools/babylon-smoke.mjs --out <dir> [--root <repo>] [--only hub,ronin,forge,npcforge,terrainlab,rig] [--shard k/n] [--list] [--trace] [--port 8790] [--wait 240]
//   PLAYWRIGHT_DIR = a folder whose node_modules (or itself) holds playwright, when it isn't installed beside the repo
//   SMOKE_CACHE = a folder for the outside files the pages fetch (Rebel rig, fonts, gsap), so both runs see the same bytes
// Writes <dir>/smoke.json and a picture per page (<dir>/<id>.jpg).
// Every /api/ call is answered here (layouts from the repo files, no sign-in), cdn.babylonjs.com and the other Babylon sites
// are refused and listed (nothing should need them), other outside hosts get a 404 unless listed in OUTSIDE.
import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { createRequire } from 'module';

const argv = process.argv.slice(2), arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const ROOT = path.resolve(arg('root', path.join(path.dirname(new URL(import.meta.url).pathname), '..')));
const OUT = path.resolve(arg('out', 'babylon-smoke'));
const PORT = +arg('port', 8790), WAIT = +arg('wait', 240) * 1000, HOST = `127.0.0.1:${PORT}`;
const CACHE = path.resolve(process.env.SMOKE_CACHE || path.join(os.tmpdir(), 'babylon-smoke-cache'));
const OUTSIDE = /^(fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net|[a-z0-9]+\.public\.blob\.vercel-storage\.com)$/;
const BABYLON_SITES = /(^|\.)babylonjs\.com$/;
const RIG = '609';   // a showcase Forge rig built into the village (CHARACTER_REGISTRY forged_rig_609, in Blob)
fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(CACHE, { recursive: true });

const pw = process.env.PLAYWRIGHT_DIR ? createRequire(path.join(path.resolve(process.env.PLAYWRIGHT_DIR), 'x.js'))('playwright') : await import('playwright');
const { chromium } = pw;

const VILLAGES = ['hub', ...fs.readdirSync(path.join(ROOT, 'assets/world-layouts')).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort()];
const PAGES = [
  ...VILLAGES.map((v) => ({ id: v, kind: 'village', url: `/village.html?village=${encodeURIComponent(v)}&rig=${RIG}` })),
  { id: 'forge', kind: 'forge', url: '/forge-v2.html?col=battle_for_colony&token=262' },
  { id: 'npcforge', kind: 'npcforge', url: '/npc-forge.html', admin: true },
  { id: 'terrainlab', kind: 'terrainlab', url: '/terrain-lab.html' },
  { id: 'rig', kind: 'rig', url: '/__smoke-rig.html' }
];
const only = arg('only', '') ? new Set(arg('only').split(',')) : null;
const TRACE = argv.includes('--trace');
// --shard k/n: every n-th page from the k-th (the robot runs n parts at once on GitHub)
const shard = (arg('shard', '').match(/^(\d+)\/(\d+)$/) || []).slice(1).map(Number);
const RUN = PAGES.filter((pg, i) => (!only || only.has(pg.id)) && (!shard.length || i % shard[1] === shard[0] - 1));
if (argv.includes('--list')) { console.log(RUN.map((pg) => pg.id).join(' ')); process.exit(0); }

// the Babylon files the village loads, read from the page itself (the rig page loads the same ones)
const villageHtml = fs.readFileSync(path.join(ROOT, 'village.html'), 'utf8');
const babylonTags = [...villageHtml.matchAll(/<script src="(assets\/vendor\/babylon\/[^"]+)"><\/script>/g)].map((m) => m[1]);
const babylonFolder = (babylonTags[0] || '').replace(/[^/]+$/, '');
const version = (babylonFolder.match(/(\d+\.\d+\.\d+)\/$/) || [])[1] || null;
const inline = (villageHtml.match(/<script>if \(window\.BABYLON\)[^\n]*<\/script>/) || [''])[0];

const RIG_PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;height:100%;background:#1d2230}canvas{width:100%;height:100%;display:block}</style>
${babylonTags.map((s) => `<script src="/${s}"></script>`).join('\n')}
${inline}</head><body><canvas id="c"></canvas><script>
(async () => {
  const engine = new BABYLON.Engine(document.getElementById('c'), true, { preserveDrawingBuffer: true });
  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(.11, .13, .19, 1);
  new BABYLON.HemisphericLight('h', new BABYLON.Vector3(0, 1, 0), scene);
  const cam = new BABYLON.ArcRotateCamera('cam', -Math.PI / 2, 1.25, 7, new BABYLON.Vector3(0, 1.7, 0), scene);
  const out = { files: [] };
  for (const file of ['ant_idle_c.glb', 'ant_walk_c.glb', 'ant_flip_kick_c.glb']) {
    const r = await BABYLON.SceneLoader.ImportMeshAsync('', '/assets/character/', file, scene);
    const sk = r.skeletons[0], f = { file, meshes: r.meshes.length, verts: r.meshes.reduce((a, m) => a + (m.getTotalVertices ? m.getTotalVertices() : 0), 0),
      bones: sk ? sk.bones.length : 0, groups: [] };
    for (const g of r.animationGroups) {
      r.animationGroups.forEach((x) => x.stop());
      g.start(false, 1, g.from, g.to); g.goToFrame(g.from + (g.to - g.from) * .37); g.pause();
      scene.render(); if (sk) sk.prepare(true);
      const pose = []; if (sk) for (const b of sk.bones) { const m = b.getFinalMatrix().m; for (let i = 12; i < 15; i++) pose.push(Math.round(m[i] * 1e4)); }
      f.groups.push({ name: g.name, from: +g.from.toFixed(3), to: +g.to.toFixed(3), targets: g.targetedAnimations.length, pose });
      g.stop();
    }
    if (file !== 'ant_idle_c.glb') r.meshes.forEach((m) => m.setEnabled(false));
    out.files.push(f);
  }
  window.__rig = out;
  engine.runRenderLoop(() => scene.render());
})().catch((e) => { window.__rig = { error: String(e && (e.stack || e.message) || e).slice(0, 400) }; });
</script></body></html>`;

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.wasm': 'application/wasm',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.css': 'text/css', '.txt': 'text/plain',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.mp4': 'video/mp4', '.webm': 'video/webm', '.env': 'application/octet-stream', '.ktx2': 'image/ktx2' };
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/__smoke-rig.html') { res.writeHead(200, { 'content-type': MIME['.html'] }); return res.end(RIG_PAGE); }
  let p = path.join(ROOT, decodeURIComponent(u.pathname));
  if (!p.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  fs.readFile(p, (err, buf) => {
    if (err) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': MIME[path.extname(p).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(buf);
  });
});
await new Promise((ok) => server.listen(PORT, '127.0.0.1', ok));

function apiAnswer(u, admin) {
  const json = (status, body) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });
  if (u.pathname === '/api/world-layout') {
    const v = u.searchParams.get('village') || 'hub';
    const f = v === 'hub' ? path.join(ROOT, 'assets/world-layout.json') : path.join(ROOT, 'assets/world-layouts', v.replace(/[^a-z-]/g, '') + '.json');
    if (!fs.existsSync(f)) return json(404, { ok: false });
    return json(200, { ok: true, layout: JSON.parse(fs.readFileSync(f, 'utf8')), sha: 'smoke' });
  }
  if (u.pathname === '/api/admin-session') return json(200, { ok: true, authenticated: !!admin });
  return json(404, { ok: false, error: 'not in the smoke test' });
}
async function outside(route, rec) {
  const url = route.request().url(), file = path.join(CACHE, crypto.createHash('sha1').update(url).digest('hex'));
  try {
    if (!fs.existsSync(file)) {
      const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 babylon-smoke' } });
      if (!r.ok) { rec.outsideFailed.push(new URL(url).hostname + ' ' + r.status); return route.fulfill({ status: r.status, body: '' }); }
      fs.writeFileSync(file + '.type', r.headers.get('content-type') || 'application/octet-stream');
      fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
    }
    return route.fulfill({ status: 200, headers: { 'content-type': fs.readFileSync(file + '.type', 'utf8'), 'access-control-allow-origin': '*' }, body: fs.readFileSync(file) });
  } catch (e) { rec.outsideFailed.push(new URL(url).hostname + ' ' + String(e.message || e).slice(0, 80)); return route.abort('failed'); }
}
// messages differ in times, counts and blob ids between runs: keep their words
const norm = (t) => String(t).replace(/BJS - \[\d\d:\d\d:\d\d\]: /g, 'BJS: ').replace(/blob:\S+/g, 'blob:').replace(/\?\S*/g, '').replace(/\b\d{3,}\b/g, 'N').replace(/\s+/g, ' ').trim().slice(0, 300);
const uniq = (a) => [...new Set(a)];

// the villages draw their sky and light from the clock: noon wherever the test runs
const h = new Date().getUTCHours(), off = ((12 - h + 36) % 24) - 12, timezoneId = off === 0 ? 'UTC' : `Etc/GMT${off > 0 ? '-' : '+'}${Math.abs(off)}`;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const result = { babylon: version, folder: babylonFolder, at: new Date().toISOString(), timezoneId, rig: RIG, planned: RUN.map((pg) => pg.id), pages: {} };

for (const pg of RUN) {
  const rec = { id: pg.id, kind: pg.kind, url: pg.url, ok: false, ms: 0, errors: [], bjs: [], console: [], warnings: [], missing: [], babylonSites: [], outsideFailed: [] };
  const t0 = Date.now();
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, timezoneId, serviceWorkers: 'block' });
  await ctx.addInitScript(() => {
    try { localStorage.setItem('rebelAntsHubOnboardingSeen:v1', '1'); } catch (e) {}
    // badge cards would cover the pictures
    document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = '#badgeUnlockPopup{display:none!important}'; document.head.appendChild(st); });
  });
  await ctx.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (u.host === HOST) return u.pathname.startsWith('/api/') ? route.fulfill(apiAnswer(u, pg.admin)) : route.continue();
    if (u.protocol === 'data:' || u.protocol === 'blob:') return route.continue();
    if (BABYLON_SITES.test(u.hostname)) { rec.babylonSites.push(u.hostname + u.pathname); return route.abort('blockedbyclient'); }
    if (OUTSIDE.test(u.hostname)) return outside(route, rec);
    return route.fulfill({ status: 404, body: '' });
  });
  const page = await ctx.newPage();
  // downloads (not /api/ calls: some pages ask those again and again) decide when a page has settled
  const open = new Map(); let netAt = Date.now();
  const isFile = (r) => { try { return !new URL(r.url()).pathname.startsWith('/api/'); } catch (e) { return false; } };
  page.on('request', (r) => { if (isFile(r)) { open.set(r, Date.now()); netAt = Date.now(); } });
  for (const ev of ['requestfinished', 'requestfailed']) page.on(ev, (r) => { if (open.delete(r)) netAt = Date.now(); });
  page.on('pageerror', (e) => rec.errors.push(norm(e.message)));
  page.on('console', (m) => {
    const t = m.text(), type = m.type();
    if (type === 'error') (/BJS|compile|shader|WebGL|GL_INVALID|glsl|effect/i.test(t) ? rec.bjs : rec.console).push(norm(t));
    else if (type === 'warning' && /BJS/.test(t)) rec.warnings.push(norm(t));
  });
  page.on('response', (r) => { try { const u = new URL(r.url()); if (u.host === HOST && !u.pathname.startsWith('/api/') && r.status() >= 400) rec.missing.push(u.pathname); } catch (e) {} });
  try {
    await page.goto('http://' + HOST + pg.url, { waitUntil: 'domcontentloaded', timeout: 120000 });
    if (pg.kind === 'village') {
      await page.waitForFunction(() => window._villageStartupInteractive === true, null, { timeout: WAIT, polling: 1000 });
      rec.readyMs = Date.now() - t0;
      await page.waitForFunction(() => { const s = window.BABYLON?.EngineStore?.LastCreatedScene, pr = s?.getTransformNodeByName('playerRoot'); return !!pr && pr.getChildMeshes().length > 0; },
        null, { timeout: Math.max(30000, WAIT - (Date.now() - t0)), polling: 1000 }).catch(() => {});
      await page.evaluate(() => { try { window.setWeatherMode?.('clear', true); } catch (e) {} });
    } else if (pg.kind === 'terrainlab') {
      await page.waitForFunction(() => { const b = document.getElementById('busy'); return window.BABYLON?.EngineStore?.LastCreatedScene && b && getComputedStyle(b).display === 'none'; }, null, { timeout: WAIT, polling: 1000 });
    } else if (pg.kind === 'rig') {
      await page.waitForFunction(() => !!window.__rig, null, { timeout: WAIT, polling: 500 });
      rec.rigCheck = await page.evaluate(() => window.__rig);
      if (rec.rigCheck?.error) rec.errors.push(norm(rec.rigCheck.error));
    } else {
      await page.waitForFunction(() => !!window.BABYLON?.EngineStore?.LastCreatedScene, null, { timeout: WAIT, polling: 1000 });
    }
    // villages keep adding pieces long after they say ready (late downloads, the games pack 15 s after the Rebel, decor): count once
    // no download is open and neither the scene nor the network has changed for QUIET (villages 20 s), at most CAP;
    // --trace writes down what came and went meanwhile (rec.trace: seconds, pieces, the names that changed, digits folded)
    const QUIET = pg.kind === 'village' ? 20000 : 6000, CAP = pg.kind === 'village' ? 300000 : 60000, t1 = Date.now();
    let n0 = null, at = t1, names0 = null;
    if (TRACE) rec.trace = [];
    for (;;) {
      const s1 = await page.evaluate((trace) => {
        const s = window.BABYLON?.EngineStore?.LastCreatedScene; if (!s) return { n: -1 };
        const out = { n: s.meshes.length + s.materials.length };
        if (trace) { out.names = {}; for (const m of s.meshes) { const k = String(m.name).replace(/\d+/g, '#').slice(0, 48); out.names[k] = (out.names[k] || 0) + 1; } }
        return out;
      }, TRACE).catch(() => ({ n: -1 }));
      const now = Date.now(), busy = [...open.values()].some((t) => now - t < 30000);
      if (s1.n !== n0) {
        if (TRACE && names0 && rec.trace.length < 300) {
          const d = {}; for (const k of new Set([...Object.keys(names0), ...Object.keys(s1.names || {})])) { const v = (s1.names?.[k] || 0) - (names0[k] || 0); if (v) d[k] = v; }
          rec.trace.push({ s: Math.round((now - t1) / 1000), n: s1.n, d: Object.fromEntries(Object.entries(d).slice(0, 12)) });
        }
        n0 = s1.n; at = now;
      }
      if (TRACE && s1.names) names0 = s1.names;
      if (!busy && now - Math.max(at, netAt) >= QUIET) break;
      if (now - t1 >= CAP) { rec.unsettled = true; break; }
      await new Promise((r) => setTimeout(r, 1000));
    }
    rec.settleMs = Date.now() - t1;
    Object.assign(rec, await page.evaluate(() => new Promise((done) => {
      const B = window.BABYLON, e = B?.EngineStore?.LastCreatedEngine, s = B?.EngineStore?.LastCreatedScene;
      if (!s) return done({ scene: false });
      // the pieces drawn are counted right after the next frame picks them (later in the frame the list is empty again)
      const count = () => {
        const pr = s.getTransformNodeByName('playerRoot'), active = s.getActiveMeshes();
        let notReady = 0; const notReadyNames = [];
        for (let i = 0; i < active.length; i++) { const m = active.data[i]; let ok = true; try { ok = m.isReady(true); } catch (er) { ok = false; } if (!ok) { notReady++; if (notReadyNames.length < 8) notReadyNames.push(m.name); } }
        done({ scene: true, version: B.Engine.Version, gpu: window._gpuMode || (e?.isWebGPU ? 'webgpu' : 'webgl'), meshes: s.meshes.length, active: active.length, materials: s.materials.length,
          textures: s.textures.length, lights: s.lights.length, notReady, notReadyNames, player: pr ? pr.getChildMeshes().length : null, frames: s.getFrameId(), fps: Math.round(e?.getFps?.() || 0) });
      };
      const o = s.onAfterActiveMeshesEvaluationObservable.addOnce(count);
      setTimeout(() => { s.onAfterActiveMeshesEvaluationObservable.remove(o); count(); }, 20000);
    })));
    await page.screenshot({ path: path.join(OUT, pg.id + '.jpg'), type: 'jpeg', quality: 70, timeout: 180000 }).catch((e) => rec.console.push('screenshot: ' + norm(e.message)));
    rec.ok = !!rec.scene && rec.errors.length === 0 && (pg.kind !== 'village' || rec.player > 0) && (pg.kind !== 'rig' || !!rec.rigCheck?.files?.length);
  } catch (e) {
    rec.failed = norm(e.message);
    await page.screenshot({ path: path.join(OUT, pg.id + '.jpg'), type: 'jpeg', quality: 70, timeout: 60000 }).catch(() => {});
  }
  for (const k of ['errors', 'bjs', 'console', 'warnings', 'missing', 'babylonSites', 'outsideFailed']) rec[k] = uniq(rec[k]).slice(0, 40);
  rec.ms = Date.now() - t0;
  result.pages[pg.id] = rec;
  console.log(`${rec.ok ? 'ok  ' : 'FAIL'} ${pg.id.padEnd(12)} ${String(Math.round(rec.ms / 1000)).padStart(4)} s  settle ${Math.round((rec.settleMs || 0) / 1000)} s${rec.unsettled ? '!' : ''}  meshes ${rec.meshes ?? '-'}  active ${rec.active ?? '-'}  notReady ${rec.notReady ?? '-'}  player ${rec.player ?? '-'}  errors ${rec.errors.length}  bjs ${rec.bjs.length}${rec.failed ? '  ' + rec.failed : ''}`);
  await ctx.close();
}
await browser.close();
server.close();
fs.writeFileSync(path.join(OUT, 'smoke.json'), JSON.stringify(result, null, 2) + '\n');
const bad = Object.values(result.pages).filter((p) => !p.ok).map((p) => p.id);
console.log(`Babylon ${version}: ${Object.keys(result.pages).length - bad.length} of ${Object.keys(result.pages).length} pages ok${bad.length ? ' (not ok: ' + bad.join(', ') + ')' : ''}`);
