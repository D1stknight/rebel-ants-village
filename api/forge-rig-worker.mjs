// Admin: build and inspect the Forge Rigger worker image (a Vercel Sandbox snapshot).
//   POST {action:'pack-put', path:'mixamo/jab.npz', dataBase64}  upload one mocap source file to Blob
//   POST {action:'setup'}                                        start building the worker from the deployed commit
//   POST {action:'status'} / GET                                 progress; snapshots the sandbox when setup finished
//   POST {action:'thumb', glbUrl, name}                          render a portrait JPEG of a rigged GLB into Blob
import { put } from '@vercel/blob';
import { isAdminRequest } from './_admin-auth.mjs';
import { Sandbox, creds, REPO, WORKER_KEY, PACK_KEY, FW, getJson, setJson, readText, body } from './_forge-rig.mjs';

const SETUP_LOG = '/vercel/sandbox/setup.log';
const MIN_PACK_FILES = 20;

export default async function handler(req, res) {
  if (!isAdminRequest(req)) return res.status(401).json({ ok: false, error: 'Admin authentication required' });
  const b = req.method === 'GET' ? { action: 'status' } : body(req);
  try {
    if (b.action === 'pack-put') return res.status(200).json(await packPut(b));
    if (b.action === 'setup') return res.status(200).json(await startSetup(b));
    if (b.action === 'status') return res.status(200).json(await status());
    if (b.action === 'thumb') return res.status(200).json(await renderThumb(b));
    return res.status(400).json({ ok: false, error: 'Unknown action' });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
}

async function packPut({ path, dataBase64 }) {
  if (!/^(mixamo|cmu)\/[a-z0-9_]+\.(npz|bvh)$/i.test(path || '')) throw new Error('Bad pack path');
  const buf = Buffer.from(String(dataBase64 || ''), 'base64');
  if (!buf.length) throw new Error('Empty file');
  const blob = await put(`forge/rig-worker/pack/${path}`, buf, { access: 'public', addRandomSuffix: true, contentType: 'application/octet-stream' });
  const pack = (await getJson(PACK_KEY)) || {};
  pack[path] = blob.url;
  await setJson(PACK_KEY, pack);
  return { ok: true, path, bytes: buf.length, files: Object.keys(pack).length };
}

async function startSetup({ commit }) {
  const pack = (await getJson(PACK_KEY)) || {};
  if (Object.keys(pack).length < MIN_PACK_FILES) throw new Error(`Mocap pack incomplete (${Object.keys(pack).length}/${MIN_PACK_FILES} files)`);
  const sha = commit || process.env.VERCEL_GIT_COMMIT_SHA || 'dev';
  const raw = `https://raw.githubusercontent.com/${REPO}/${sha}`;
  const sandbox = await Sandbox.create({ image: 'vercel/sandbox/ubuntu', persistent: false, resources: { vcpus: 2 }, timeout: 40 * 60 * 1000, tags: { purpose: 'forge-rig-worker-setup' }, ...creds() });
  const setupRes = await fetch(`${raw}/forge-worker/setup.sh`);
  if (!setupRes.ok) throw new Error(`Could not fetch setup.sh for ${sha} (${setupRes.status})`);
  await sandbox.writeFiles([
    { path: '/vercel/sandbox/pack.json', content: JSON.stringify(pack) },
    { path: '/vercel/sandbox/setup.sh', content: await setupRes.text(), mode: 0o755 }
  ]);
  const cmd = await sandbox.runCommand({
    cmd: 'bash',
    args: ['-c', `bash /vercel/sandbox/setup.sh "${raw}" /vercel/sandbox/pack.json > ${SETUP_LOG} 2>&1`],
    sudo: true,
    detached: true
  });
  const worker = (await getJson(WORKER_KEY)) || {};
  worker.setup = { sandboxName: sandbox.name, cmdId: cmd.cmdId, commit: sha, startedAt: new Date().toISOString(), status: 'running' };
  await setJson(WORKER_KEY, worker);
  return { ok: true, setup: worker.setup };
}

async function status() {
  const worker = (await getJson(WORKER_KEY)) || {};
  const pack = (await getJson(PACK_KEY)) || {};
  const s = worker.setup;
  if (s && s.status === 'running') {
    let sandbox;
    try { sandbox = await Sandbox.get({ name: s.sandboxName, ...creds() }); } catch (e) {
      s.status = 'failed'; s.error = 'Setup sandbox is gone: ' + (e?.message || e);
      await setJson(WORKER_KEY, worker);
      return { ok: true, worker, packFiles: Object.keys(pack).length };
    }
    const cmd = await sandbox.getCommand(s.cmdId);
    const log = (await readText(sandbox, SETUP_LOG)) || '';
    s.logTail = log.split('\n').slice(-12).join('\n');
    // READY is the last thing setup.sh writes; the command's exit status can lag behind (child processes), so READY wins.
    const ready = Boolean(await readText(sandbox, `${FW}/READY`));
    if (!ready && (cmd.exitCode === null || cmd.exitCode === undefined)) {
      await setJson(WORKER_KEY, worker);
    } else if (ready) {
      const snap = await sandbox.snapshot({ expiration: 0 });
      // Oct 16: what the image holds of the optional packs (setup.sh's self test), so a games run never starts on an
      // image built before its moves were uploaded
      Object.assign(worker, { snapshotId: snap.snapshotId || snap.id, commit: s.commit, builtAt: new Date().toISOString(), games: packCount(log, 'games'), npc: packCount(log, 'npc'),
        anthony: packCount(log, 'anthony'),   // v2.42 #001's own moves (Ant-Thony)
        version: await riggerVersion(s.commit) });
      s.status = 'done'; s.finishedAt = worker.builtAt;
      await setJson(WORKER_KEY, worker);
    } else {
      s.status = 'failed'; s.exitCode = cmd.exitCode; s.finishedAt = new Date().toISOString();
      await setJson(WORKER_KEY, worker);
      try { await sandbox.stop(); } catch (e) {}
    }
  }
  // an image built before the version was kept: read it once from the commit it was built from
  if (worker.snapshotId && worker.commit && !worker.version) {
    const v = await riggerVersion(worker.commit);
    if (v) { worker.version = v; await setJson(WORKER_KEY, worker); }
  }
  return { ok: true, worker, packFiles: Object.keys(pack).length, packPaths: Object.keys(pack).sort() };
}

// Oct 24 the rigger's version in the image (forge-worker/manifest.json at the commit setup.sh installed), for the NPC
// Forge's Rig worker box
async function riggerVersion(commit) {
  try {
    const r = await fetch(`https://raw.githubusercontent.com/${REPO}/${commit}/forge-worker/manifest.json`, { signal: AbortSignal.timeout(5000) });
    const v = r.ok ? (await r.json())?.version : null;
    return typeof v === 'string' && /^\d+\.\d+$/.test(v) ? v : null;
  } catch (e) { return null; }
}

// setup.sh prints "games clips 12 of 14 missing: mixamo/gm_x.npz, ..." / "npc clips 14 of 14 ok"
function packCount(log, kind) {
  const m = new RegExp(`^${kind} clips (\\d+) of (\\d+)(?: ok| missing: (.*))?\\s*$`, 'm').exec(log || '');
  return m ? { have: Number(m[1]), of: Number(m[2]), missing: m[3] ? m[3].split(',').map((x) => x.trim()).filter(Boolean) : [] } : null;
}

async function renderThumb({ glbUrl, name }) {
  if (!/^https:\/\//.test(glbUrl || '')) throw new Error('Missing glbUrl');
  const worker = (await getJson(WORKER_KEY)) || {};
  if (!worker.snapshotId) throw new Error('Rig worker is not built yet');
  const sandbox = await Sandbox.create({ source: { type: 'snapshot', snapshotId: worker.snapshotId }, persistent: false, resources: { vcpus: 2 }, timeout: 5 * 60 * 1000, tags: { purpose: 'forge-rig-thumb' }, ...creds() });
  try {
    await sandbox.runCommand({
      cmd: 'bash',
      args: ['-c', `(curl -fsSL "$GLB" -o /tmp/in.glb && ${FW}/venv/bin/python ${FW}/thumb.py -- /tmp/in.glb /tmp/thumb.jpg 640) > /tmp/thumb.log 2>&1; echo $? > /tmp/thumb.done`],
      env: { GLB: glbUrl },
      sudo: true,
      detached: true
    });
    // Poll a marker file (a detached command's exit status can lag behind the process).
    let done = null;
    for (let i = 0; i < 45 && !done; i++) { await new Promise((r) => setTimeout(r, 2000)); done = await readText(sandbox, '/tmp/thumb.done'); }
    const jpg = done && done.trim() === '0' ? await sandbox.readFileToBuffer({ path: '/tmp/thumb.jpg' }) : null;
    if (!jpg || !jpg.length) throw new Error('Thumbnail render failed: ' + ((await readText(sandbox, '/tmp/thumb.log')) || 'timed out').slice(-400));
    const safe = String(name || 'rig').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').slice(0, 60);
    const blob = await put(`forge/rig-thumbs/${safe}.jpg`, jpg, { access: 'public', addRandomSuffix: true, contentType: 'image/jpeg' });
    return { ok: true, url: blob.url, bytes: jpg.length };
  } finally {
    try { await sandbox.stop(); } catch (e) {}
  }
}
