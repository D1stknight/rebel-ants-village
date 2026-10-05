import { chromium } from 'playwright';
import fs from 'fs';
const SP = new URL('.', import.meta.url).pathname; // outputs go to ./maps/
const REPO = '/home/user/rebel-ants-village';
const NM = process.env.NM || SP + 'node_modules/'; // babylonjs, babylonjs-loaders, babylonjs-materials, draco3dgltf
const cdnMap = { '/babylon.js': NM + 'babylonjs/babylon.js', '/loaders/babylonjs.loaders.min.js': NM + 'babylonjs-loaders/babylonjs.loaders.min.js', '/materialsLibrary/babylonjs.materials.min.js': NM + 'babylonjs-materials/babylonjs.materials.min.js', '/draco_wasm_wrapper_gltf.js': NM + 'draco3dgltf/draco_decoder_gltf_nodejs.js', '/draco_decoder_gltf.js': NM + 'draco3dgltf/draco_decoder_gltf_nodejs.js', '/draco_decoder_gltf.wasm': NM + 'draco3dgltf/draco_decoder_gltf.wasm' };
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 480, height: 270 }, timezoneId: process.env.TZID || 'America/New_York' });
const logs = [];
page.on('console', m => { if (m.type() === 'error' || /Blocked quest/.test(m.text())) logs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', e => logs.push('PAGEERROR: ' + e.message + ' ' + String(e.stack || '').split('\n').slice(0, 14).join(' <- ')));
await page.route('https://cdn.babylonjs.com/**', r => { const p0 = new URL(r.request().url()).pathname, p = cdnMap[p0] ? p0 : '/' + p0.split('/').pop(), f = cdnMap[p]; if (!f) return r.fulfill({ status: 404, body: '' }); r.fulfill({ status: 200, body: fs.readFileSync(f), contentType: p.endsWith('.wasm') ? 'application/wasm' : 'application/javascript' }); });
await page.route('**/api/**', r => { const u = new URL(r.request().url()); if (u.pathname === '/api/world-layout') { const v = u.searchParams.get('village') || 'hub'; const f = v === 'hub' ? REPO + '/assets/world-layout.json' : `${REPO}/assets/world-layouts/${v}.json`; return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, layout: JSON.parse(fs.readFileSync(f, 'utf8')), sha: 't' }) }); } if (u.pathname === '/api/admin-session') return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"authenticated":false}' }); r.fulfill({ status: 404, contentType: 'application/json', body: '{"ok":false}' }); });
await page.route(/^https:\/\/(?!cdn\.babylonjs\.com)/, r => { if (/vercel-storage\.com\/.*\.glb/.test(r.request().url())) return r.fulfill({ status: 200, body: fs.readFileSync(REPO + '/assets/character/ant_idle_c.glb'), contentType: 'model/gltf-binary' }); r.fulfill({ status: 404, body: '' }); });
const QK = 'rebelAntsTutorialQuestChain:v1';
await page.addInitScript(() => { localStorage.setItem('rebelAntsHubOnboardingSeen:v1', '1'); });
const seed = (q, st) => page.evaluate(([QK, q, st]) => { const s = JSON.parse(localStorage.getItem(QK) || '{}'); localStorage.setItem(QK, JSON.stringify({ completedQuestIds: [], objectiveProgress: {}, ...s, questId: q, step: st, completed: false })); }, [QK, q, st]);
const boot = async v => {
  await page.goto(`http://127.0.0.1:8765/village.html?village=${v}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  try { await page.waitForFunction(() => window._villageStartupInteractive, null, { timeout: 300000 }); } catch (e) { console.log('BOOT FAIL', v, logs.join('\n')); throw e; }
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.toggleWalk());
  await page.waitForTimeout(2500);
};
const Q = () => page.evaluate(k => { const s = JSON.parse(localStorage.getItem(k)); const g = BABYLON.Engine.LastCreatedScene.getTransformNodeByName('questTargetAutoGuide'); const tr = document.getElementById('questTrackerObjective')?.textContent || ''; return `${s.questId}:${s.step}${s.completed ? ' (done)' : ''} | guide=${g && g.isEnabled() ? g.metadata.label + '@' + g.position.x.toFixed(0) + ',' + g.position.z.toFixed(0) : '-'} | ${tr}`; }, QK);
const state = () => page.evaluate(() => ({ prompt: document.getElementById('interactionPrompt')?.classList.contains('on') ? document.getElementById('interactionPrompt').textContent : '', toast: document.getElementById('toast')?.classList.contains('on') ? document.getElementById('toast').textContent : '', dlg: document.getElementById('npcDialogueOverlay')?.classList.contains('on') }));
const until = async (pred, ms = 30000) => { const t0 = Date.now(); let st; while (Date.now() - t0 < ms) { await page.evaluate(() => { if (document.getElementById('questCelebration')?.classList.contains('on')) window.dismissQuestCelebration(); }); st = await state(); if (pred(st)) return st; await page.waitForTimeout(400); } return st; };
const tpTo = async (src, dz = 1.4) => page.evaluate(([src, dz]) => { const s = BABYLON.Engine.LastCreatedScene; const n = new Function('s', 'return ' + src)(s); if (!n) return 'missing'; const p = n.getAbsolutePosition(), r = s.getTransformNodeByName('playerRoot'); r.position.x = p.x; r.position.z = p.z - dz; return p.x.toFixed(1) + ',' + p.z.toFixed(1); }, [src, dz]);
const npcSrc = id => `s.transformNodes.find(n => n.metadata?.type === 'npc' && n.metadata.npcId === '${id}')`;
const spotSrc = id => `s.transformNodes.find(n => n.metadata?.type === 'quest_spot' && n.metadata.spotConfig.spotId === '${id}')`;
async function talk(id) {
  let opened = false;
  for (let tries = 0; tries < 8 && !opened; tries++) {
    const where = await tpTo(npcSrc(id)); if (tries === 0) console.log('  tp npc', id, where);
    const pr = await until(s => /Talk/.test(s.prompt), 6000);
    if (/Talk/.test(pr.prompt)) { await tpTo(npcSrc(id)); await page.keyboard.press('o'); opened = (await until(s => s.dlg, 8000)).dlg; }
  }
  if (!opened) { console.log('  no dialogue with', id); return; }
  const lines = [];
  for (let i = 0; i < 12; i++) { const open = await page.evaluate(() => document.getElementById('npcDialogueOverlay')?.classList.contains('on')); if (!open) break; lines.push(await page.evaluate(() => document.getElementById('npcDialogueText')?.textContent || '')); await page.evaluate(() => window.advanceNPCDialogue()); await page.waitForTimeout(300); }
  console.log('  said:', lines.map(l => l.slice(0, 60)).join(' / '));
  await page.waitForTimeout(1500);
}
async function use(id, holdMs = 0) {
  console.log('  tp spot', id, await tpTo(spotSrc(id), .6));
  const st = await until(s => /^Press O to /.test(s.prompt) && !/Talk|Open/.test(s.prompt)); if (!/^Press O to /.test(st.prompt) || /Talk/.test(st.prompt)) { console.log('  no spot prompt', JSON.stringify(st)); return; } await page.keyboard.press('o');
  if (holdMs) await page.waitForTimeout(holdMs);
  const after = await until(s => s.toast, 15000); console.log('  ', st.prompt, '->', after.toast.slice(0, 80));
  await page.waitForTimeout(1200);
}
const V = process.argv[2] || 'hub', R = Number(process.argv[3] || 330), STEP = 3;
await page.setViewportSize({ width: 1000, height: 1000 });
await boot(V);
await page.waitForTimeout(8000);
const data = await page.evaluate(([R, STEP]) => {
  const P = window._walkProbe; P.refresh();
  const s = BABYLON.Engine.LastCreatedScene, pr = s.getTransformNodeByName('playerRoot');
  const n = Math.floor(2 * R / STEP) + 1, walk = new Uint8Array(n * n), h = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const x = -R + i * STEP, z = -R + j * STEP; walk[j * n + i] = P.blocked(x, z) ? 0 : 1; h[j * n + i] = P.ground(x, z); }
  // reachable from the spawn over unblocked steps
  const reach = new Uint8Array(n * n), q = [];
  const si = Math.round((pr.position.x + R) / STEP), sj = Math.round((pr.position.z + R) / STEP);
  let start = sj * n + si; if (!walk[start]) { for (let d = 1; d < 6 && !walk[start]; d++) for (const [a, b] of [[d,0],[-d,0],[0,d],[0,-d]]) if (walk[(sj + b) * n + si + a]) { start = (sj + b) * n + si + a; break; } }
  reach[start] = 1; q.push(start);
  while (q.length) { const k = q.pop(), i = k % n, j = (k / n) | 0, x = -R + i * STEP, z = -R + j * STEP;
    for (const [a, b] of [[1,0],[-1,0],[0,1],[0,-1]]) { const i2 = i + a, j2 = j + b; if (i2 < 0 || j2 < 0 || i2 >= n || j2 >= n) continue; const k2 = j2 * n + i2; if (reach[k2] || !walk[k2]) continue; if (Math.abs(h[k2] - h[k]) > 2.4) continue; if (P.step(x, z, x + a * STEP, z + b * STEP)) continue; reach[k2] = 1; q.push(k2); } }
  const items = s.transformNodes.filter(t => t.metadata?.isClone && ['treasure_chest', 'collectible', 'quest_spot', 'npc', 'village_gate', 'quest_target_marker', 'interior_entrance'].includes(t.metadata.type)).map(t => ({ type: t.metadata.type, id: t.metadata.chestId || t.metadata.collectibleId || t.metadata.spotConfig?.spotId || t.metadata.npcId || t.metadata.targetMarkerId || t.name, tier: t.metadata.chestTier || t.metadata.collectibleType || (t.metadata.spotConfig?.secretId ? 'secret' : ''), x: +t.position.x.toFixed(1), z: +t.position.z.toFixed(1) }));
  return { R, STEP, n, spawn: [pr.position.x, pr.position.z], walk: Array.from(walk), reach: Array.from(reach), h: Array.from(h, v => +v.toFixed(2)), items };
}, [R, STEP]);
fs.writeFileSync(SP + `maps/${V}.json`, JSON.stringify(data));
const nr = data.reach.reduce((a, b) => a + b, 0);
console.log(V, 'grid', data.n, 'walkable', data.walk.reduce((a, b) => a + b, 0), 'reachable', nr, '(' + (nr * STEP * STEP / 1e4).toFixed(1) + ' ha)', 'items', data.items.length);
// aerial render: orthographic camera straight down
await page.evaluate(R => { const s = BABYLON.Engine.LastCreatedScene; document.querySelectorAll('body > *:not(canvas)').forEach(e => { if (!e.querySelector?.('canvas')) e.style.visibility = 'hidden'; });
  const cam = new BABYLON.FreeCamera('aerialCam', new BABYLON.Vector3(0, 700, 0), s); cam.setTarget(new BABYLON.Vector3(0, 0, 0.001)); cam.upVector = new BABYLON.Vector3(0, 0, 1); cam.rotation.set(Math.PI / 2, 0, 0); cam.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA; cam.orthoLeft = -R; cam.orthoRight = R; cam.orthoTop = R; cam.orthoBottom = -R; cam.maxZ = 3000; cam.minZ = 1; s.activeCamera = cam; s.fogEnabled = false; }, R);
await page.waitForTimeout(6000);
await page.screenshot({ path: SP + `maps/${V}-aerial.png`, timeout: 180000 });
console.log('errors', logs.filter(l => !/404/.test(l)).slice(0, 6).join('\n'));
await browser.close();
