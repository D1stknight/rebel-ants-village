// Admin uploads into the repo (Nov 2): custom room models / music (assets/interiors/custom/<folder>/) and room
// videos / posters (assets/video/interiors/<folder>/), committed to the dev branch on the server with GITHUB_TOKEN.
// The browser never sees the token (it used to fetch it from /api/github-upload-token and call GitHub itself).
// A Vercel request body tops out near 4.5 MB, so files come in pieces of 3 MB: each piece waits in the Blob store under
// an unguessable name, and the last call joins them, checks the file's own header and commits it with the git data API
// (a single git blob takes up to 100 MB). Admins only.
//   POST { op:'start', kind:'room'|'music'|'video'|'poster', fileName, size, folder } -> { ok, uploadId, path, chunks, chunkBytes }
//   POST { op:'chunk', uploadId, index, data (base64) }                              -> { ok, index }
//   POST { op:'finish', uploadId }                                                    -> { ok, path, commit }
//   POST { op:'delete', path }  (a custom room file only, as before)                  -> { ok, deleted }
import crypto from 'node:crypto';
import { put, del, list } from '@vercel/blob';
import { isAdminRequest } from './_admin-auth.mjs';
import { redis } from './_econ.mjs';

const REPO = 'D1stknight/rebel-ants-village', BRANCH = 'dev';
const CHUNK = 3 * 1024 * 1024;            // base64 of 3 MB = 4 MB: under the request limit
const MB = 1024 * 1024;
const KINDS = {
  room:   { dir: 'assets/interiors/custom', prefix: 'room',   exts: ['glb', 'gltf'], max: 60 * MB },
  music:  { dir: 'assets/interiors/custom', prefix: 'music',  exts: ['mp3'], max: 40 * MB },
  video:  { dir: 'assets/video/interiors',  prefix: 'video',  exts: ['mp4'], max: 95 * MB },
  poster: { dir: 'assets/video/interiors',  prefix: 'poster', exts: ['png', 'jpg', 'jpeg', 'webp'], max: 10 * MB }
};
const KEY = (id) => `admin-upload:v1:${id}`;
const PARTS = (id) => `admin-upload:v1:${id}:parts`;
const TTL = 3600;

export const config = { api: { bodyParser: { sizeLimit: '6mb' } } };

const slug = (v, fallback) => String(v || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || fallback;
const safeName = (v) => String(v || '').replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, '').slice(0, 80);

// the file's own first bytes must match its kind (a renamed file is refused)
function looksRight(ext, b) {
  const s = (i, n) => b.subarray(i, i + n).toString('latin1');
  if (ext === 'glb') return s(0, 4) === 'glTF';
  if (ext === 'gltf') return /^\s*\{/.test(s(0, 64));
  if (ext === 'mp3') return s(0, 3) === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0);
  if (ext === 'mp4') return s(4, 4) === 'ftyp';
  if (ext === 'png') return b[0] === 0x89 && s(1, 3) === 'PNG';
  if (ext === 'jpg' || ext === 'jpeg') return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (ext === 'webp') return s(0, 4) === 'RIFF' && s(8, 4) === 'WEBP';
  return false;
}

async function gh(token, path, opts = {}) {
  const r = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    method: opts.method || 'GET',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'rebel-ants-village', ...(opts.body || opts.raw ? { 'Content-Type': 'application/json' } : {}) },
    body: opts.raw || (opts.body ? JSON.stringify(opts.body) : undefined)
  });
  const d = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, d };
}

// one commit on dev that adds the file (dev moves often: on a race, read the branch again and retry)
async function commitFile(token, path, bytes, message) {
  // the JSON body built as bytes (base64 needs no escaping): one copy of the file's base64, not three
  const body = Buffer.concat([Buffer.from('{"encoding":"base64","content":"'), Buffer.from(bytes.toString('base64'), 'latin1'), Buffer.from('"}')]);
  const blob = await gh(token, '/git/blobs', { method: 'POST', raw: body });
  if (!blob.ok || !blob.d.sha) throw new Error('GitHub refused the file: ' + (blob.d.message || blob.status));
  for (let attempt = 0; attempt < 4; attempt++) {
    const ref = await gh(token, `/git/ref/heads/${BRANCH}`);
    if (!ref.ok) throw new Error('Could not read the dev branch: ' + (ref.d.message || ref.status));
    const head = ref.d.object.sha;
    const cur = await gh(token, `/git/commits/${head}`);
    if (!cur.ok) throw new Error('Could not read the latest commit: ' + (cur.d.message || cur.status));
    const tree = await gh(token, '/git/trees', { method: 'POST', body: { base_tree: cur.d.tree.sha, tree: [{ path, mode: '100644', type: 'blob', sha: blob.d.sha }] } });
    if (!tree.ok) throw new Error('Could not make the tree: ' + (tree.d.message || tree.status));
    const commit = await gh(token, '/git/commits', { method: 'POST', body: { message, tree: tree.d.sha, parents: [head] } });
    if (!commit.ok) throw new Error('Could not make the commit: ' + (commit.d.message || commit.status));
    const upd = await gh(token, `/git/refs/heads/${BRANCH}`, { method: 'PATCH', body: { sha: commit.d.sha, force: false } });
    if (upd.ok) return commit.d.sha;
    if (upd.status !== 422 && upd.status !== 409) throw new Error('Could not move dev: ' + (upd.d.message || upd.status));
  }
  throw new Error('dev kept changing while saving the file; try again');
}

// pieces of uploads that were never finished (the page closed): gone at the next start, after two hours
async function sweepOld() {
  const cut = Date.now() - 2 * 3600 * 1000, old = [];
  let cursor;
  for (let n = 0; n < 5; n++) {
    const r = await list({ prefix: 'admin-upload-tmp/', cursor, limit: 1000 });
    for (const b of r.blobs || []) if (new Date(b.uploadedAt).getTime() < cut) old.push(b.url);
    if (!r.hasMore) break;
    cursor = r.cursor;
  }
  if (old.length) await del(old);
}

// a custom room file (as the old delete allowed: anything under assets/interiors/custom/, no '..')
function deletablePath(v) {
  const path = String(v || '').trim().replace(/^\/+/, '');
  if (!path.startsWith('assets/interiors/custom/') || path.includes('\\')) return '';
  const segs = path.split('/');
  if (segs.length < 5 || segs.some(x => !x || x === '.' || x === '..' || !/^[A-Za-z0-9._-]+$/.test(x))) return '';
  return path;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false, error: 'POST only' }); }
  if (!isAdminRequest(req)) return res.status(401).json({ ok: false, error: 'Admin authentication required' });
  const token = process.env.GITHUB_TOKEN || '';
  if (!token) return res.status(500).json({ ok: false, error: 'The site has no GITHUB_TOKEN' });
  const b = typeof req.body === 'object' && req.body ? req.body : (() => { try { return JSON.parse(req.body || '{}'); } catch (e) { return {}; } })();
  try {
    if (b.op === 'start') {
      const K = KINDS[b.kind];
      if (!K) return res.status(400).json({ ok: false, error: 'kind must be room, music, video or poster' });
      const name = safeName(b.fileName), ext = (name.split('.').pop() || '').toLowerCase();
      if (!name || !K.exts.includes(ext)) return res.status(400).json({ ok: false, error: `This upload takes ${K.exts.join(' / ')} files` });
      const size = Math.floor(Number(b.size));
      if (!(size > 0)) return res.status(400).json({ ok: false, error: 'Empty file' });
      if (size > K.max) return res.status(400).json({ ok: false, error: `Too large: keep it under ${K.max / MB} MB` });
      const path = `${K.dir}/${slug(b.folder, 'shared')}/${K.prefix}-${Date.now()}-${name}`;
      await sweepOld().catch(() => {});
      const id = crypto.randomBytes(16).toString('hex'), chunks = Math.ceil(size / CHUNK);
      await redis([['SET', KEY(id), JSON.stringify({ path, size, ext, chunks, kind: b.kind, at: Date.now() }), 'EX', TTL]]);
      return res.status(200).json({ ok: true, uploadId: id, path: '/' + path, chunks, chunkBytes: CHUNK });
    }
    const id = String(b.uploadId || '');
    if (b.op === 'chunk' || b.op === 'finish') {
      if (!/^[a-f0-9]{32}$/.test(id)) return res.status(400).json({ ok: false, error: 'Bad upload id' });
      const [m] = await redis([['GET', KEY(id)]]);
      const meta = m?.result ? JSON.parse(m.result) : null;
      if (!meta) return res.status(404).json({ ok: false, error: 'This upload ran out of time: start again' });
      if (b.op === 'chunk') {
        const i = Math.floor(Number(b.index));
        if (!(i >= 0 && i < meta.chunks)) return res.status(400).json({ ok: false, error: 'Bad piece number' });
        const bytes = Buffer.from(String(b.data || ''), 'base64');
        const want = i < meta.chunks - 1 ? CHUNK : meta.size - CHUNK * (meta.chunks - 1);
        if (bytes.length !== want) return res.status(400).json({ ok: false, error: `Piece ${i + 1} is ${bytes.length} bytes, expected ${want}` });
        const out = await put(`admin-upload-tmp/${id}/${i}.part`, bytes, { access: 'public', addRandomSuffix: true, contentType: 'application/octet-stream', cacheControlMaxAge: 60 });
        const [old] = await redis([['HGET', PARTS(id), String(i)], ['HSET', PARTS(id), String(i), out.url], ['EXPIRE', PARTS(id), TTL]]);
        if (old?.result) await del(old.result).catch(() => {});
        return res.status(200).json({ ok: true, index: i });
      }
      // finish: join the pieces in order, check the whole, commit, clean up
      const [h] = await redis([['HGETALL', PARTS(id)]]);
      const flat = h?.result || [], parts = {};
      for (let k = 0; k + 1 < flat.length; k += 2) parts[flat[k]] = flat[k + 1];
      const urls = [];
      for (let i = 0; i < meta.chunks; i++) { if (!parts[i]) return res.status(400).json({ ok: false, error: `Piece ${i + 1} of ${meta.chunks} is missing` }); urls.push(parts[i]); }
      const bufs = [];
      for (let i = 0; i < urls.length; i += 4) {
        const got = await Promise.all(urls.slice(i, i + 4).map(async (u) => { const r = await fetch(u); if (!r.ok) throw new Error('A stored piece could not be read'); return Buffer.from(await r.arrayBuffer()); }));
        bufs.push(...got);
      }
      const file = Buffer.concat(bufs);
      const cleanup = async () => { await del(urls).catch(() => {}); await redis([['DEL', KEY(id), PARTS(id)]]).catch(() => {}); };
      if (file.length !== meta.size) { await cleanup(); return res.status(400).json({ ok: false, error: 'The joined file is not the size that was sent' }); }
      if (!looksRight(meta.ext, file)) { await cleanup(); return res.status(400).json({ ok: false, error: `This is not a real .${meta.ext} file` }); }
      let commit;
      try { commit = await commitFile(token, meta.path, file, `upload ${meta.kind}: ${meta.path.split('/').pop()}`); }
      finally { await cleanup(); }
      return res.status(200).json({ ok: true, path: '/' + meta.path, commit });
    }
    if (b.op === 'delete') {
      const path = deletablePath(b.path);
      if (!path) return res.status(400).json({ ok: false, error: 'Only a custom room upload can be deleted here' });
      const cur = await gh(token, `/contents/${path}?ref=${BRANCH}`);
      if (cur.status === 404) return res.status(200).json({ ok: true, deleted: false });
      if (!cur.ok || !cur.d.sha) throw new Error('Could not find the file on GitHub: ' + (cur.d.message || cur.status));
      const d = await gh(token, `/contents/${path}`, { method: 'DELETE', body: { message: 'delete interior upload: ' + path, sha: cur.d.sha, branch: BRANCH } });
      if (!d.ok) throw new Error('GitHub could not delete it: ' + (d.d.message || d.status));
      return res.status(200).json({ ok: true, deleted: true });
    }
    return res.status(400).json({ ok: false, error: 'op must be start, chunk, finish or delete' });
  } catch (e) {
    console.error('[admin-upload]', b.op, e?.message);
    return res.status(e?.status || 500).json({ ok: false, error: e?.message || 'Upload failed' });
  }
}
