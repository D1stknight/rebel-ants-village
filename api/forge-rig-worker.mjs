// Admin: build and inspect the Forge Rigger worker image (a Vercel Sandbox snapshot).
//   POST {action:'pack-put', path:'mixamo/jab.npz', dataBase64}  upload one mocap source file to Blob
//   POST {action:'setup'}                                        start building the worker from the deployed commit
//   POST {action:'status'} / GET                                 progress; snapshots the sandbox when setup finished
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
  const sandbox = await Sandbox.create({ image: 'vercel/sandbox/ubuntu', resources: { vcpus: 2 }, timeout: 40 * 60 * 1000, tags: { purpose: 'forge-rig-worker-setup' }, ...creds() });
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
    if (cmd.exitCode === null || cmd.exitCode === undefined) {
      await setJson(WORKER_KEY, worker);
    } else if (cmd.exitCode === 0 && (await readText(sandbox, `${FW}/READY`))) {
      const snap = await sandbox.snapshot({ expiration: 0 });
      Object.assign(worker, { snapshotId: snap.snapshotId || snap.id, commit: s.commit, builtAt: new Date().toISOString() });
      s.status = 'done'; s.finishedAt = worker.builtAt;
      await setJson(WORKER_KEY, worker);
    } else {
      s.status = 'failed'; s.exitCode = cmd.exitCode; s.finishedAt = new Date().toISOString();
      await setJson(WORKER_KEY, worker);
      try { await sandbox.stop(); } catch (e) {}
    }
  }
  return { ok: true, worker, packFiles: Object.keys(pack).length };
}
