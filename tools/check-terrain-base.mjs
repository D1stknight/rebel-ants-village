// node tools/check-terrain-base.mjs [village ...]
// Checks api/terrain-base.mjs end to end for every village (or those named): its answer, unzipped and unpacked by the
// module's own unpackHeightmapBase, must give the same heightmap bit for bit as the page working it out itself; and it
// must refuse another module version, an unknown village and stray query keys. Run it after changing
// assets/village-terrain.js or api/terrain-base.mjs.
import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);
const T = await import('../assets/village-terrain.js');
const handler = (await import('../api/terrain-base.mjs')).default;
const code = crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'assets/village-terrain.js'))).digest('hex');
const call = (query) => new Promise((resolve) => {
  const res = { headers: {}, statusCode: 200, setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, status(c) { this.statusCode = c; return this; },
    send(b) { resolve({ status: this.statusCode, headers: this.headers, body: b }); }, json(o) { resolve({ status: this.statusCode, headers: this.headers, json: o }); } };
  Promise.resolve(handler({ method: 'GET', query }, res)).catch(e => resolve({ status: 'threw', error: String(e) }));
});
const same = (a, b) => ArrayBuffer.isView(a) && ArrayBuffer.isView(b) && a.length === b.length && Buffer.compare(Buffer.from(a.buffer, a.byteOffset, a.byteLength), Buffer.from(b.buffer, b.byteOffset, b.byteLength)) === 0;
function deep(a, b) {
  if (ArrayBuffer.isView(a) || ArrayBuffer.isView(b)) return same(a, b);
  if (typeof a === 'function' || typeof b === 'function') return typeof a === typeof b;
  if (a && b && typeof a === 'object') { const ka = Object.keys(a), kb = Object.keys(b); return ka.length === kb.length && ka.every(k => deep(a[k], b[k])); }
  return Object.is(a, b);
}
let bad = 0;
const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(T.TERRAIN_RECIPES);
for (const id of ids) {
  const t0 = performance.now(), r = await call({ village: id, v: code }), ms = performance.now() - t0;
  if (r.status !== 200) { bad++; console.log(id.padEnd(12), 'API answered', r.status, JSON.stringify(r.json || r.error)); continue; }
  const base = T.unpackHeightmapBase(new Uint8Array(zlib.gunzipSync(r.body)).buffer, code, id);
  const a = T.buildHeightmap(T.TERRAIN_RECIPES[id]), b = base && T.buildHeightmap(T.TERRAIN_RECIPES[id], base);
  let ok = !!base && deep(a, b);
  for (let x = -1600; ok && x <= 1600; x += 53) for (let z = -1600; z <= 1600; z += 59) if (!Object.is(a.baseHeight(x, z), b.baseHeight(x, z))) ok = false;
  if (!ok) bad++;
  console.log(id.padEnd(12), ok ? 'identical' : 'DIFFERENT', `${(r.body.length / 1048576).toFixed(2)} MB`, `${ms.toFixed(0)} ms`, r.headers['cache-control']);
}
// refusals: another version, unknown village, stray keys, bad hash
const refuse = [[{ village: 'hub', v: 'f'.repeat(64) }, 404], [{ village: 'atlantis', v: code }, 404], [{ village: 'hub', v: code, x: '1' }, 400], [{ village: 'hub', v: 'abc' }, 400]];
for (const [q, want] of refuse) { const r = await call(q); const ok = r.status === want; if (!ok) bad++; console.log('refuse', JSON.stringify(q).slice(0, 60), ok ? 'ok ' + r.status : 'GOT ' + r.status); }
process.exit(bad ? 1 : 0);
