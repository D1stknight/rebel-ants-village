#!/usr/bin/env node
// The site's own copy of Babylon (Oct 22): the village, Rebel Forge, NPC Forge and the terrain lab load the 3D engine from
// assets/vendor/babylon/<version>/ instead of cdn.babylonjs.com, locked to one version (the CDN always served Babylon's newest
// release, the same day it came out). Babylon's own extra downloads (the Draco decoder, ...) come from the same folder
// (BABYLON.Tools.ScriptBaseUrl in each page). The Admin Hub's "Check for updates" (api/babylon-check.mjs) says when a newer one is out.
//
// Usage: node tools/babylon-upgrade.mjs <version> [--keep-old]
//   1. npm pack babylonjs / babylonjs-loaders / babylonjs-materials at <version> into a temp folder
//   2. copy babylon.js, babylonjs.loaders.min.js, babylonjs.materials.min.js into assets/vendor/babylon/<version>/
//   3. the Draco glTF decoder (not in Babylon's npm packages): copied from the folder in use, else from three's npm package
//      (examples/jsm/libs/draco/gltf, Google's decoder build) under Babylon's file names
//   4. point the pages at the new folder (every "assets/vendor/babylon/<x.y.z>/" path) and write current.json
//   5. remove the old folder, unless --keep-old (flare.png beside the folders is Babylon's playground glow texture: it stays)
// Then boot all 15 villages, the Forge and the NPC Forge before pushing (CLAUDE.md: "Babylon on our own site").
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const VENDOR = path.join(ROOT, 'assets/vendor/babylon');
const PAGES = ['village.html', 'forge-v2.html', 'npc-forge.html', 'terrain-lab.html'];
const THREE_FOR_DRACO = 'three@0.186.1';
const DRACO = { 'draco_wasm_wrapper_gltf.js': 'draco_wasm_wrapper.js', 'draco_decoder_gltf.wasm': 'draco_decoder.wasm', 'draco_decoder_gltf.js': 'draco_decoder.js' };
const BABYLON_FILES = [['babylonjs', 'babylon.js'], ['babylonjs-loaders', 'babylonjs.loaders.min.js'], ['babylonjs-materials', 'babylonjs.materials.min.js']];

const version = process.argv[2];
const keepOld = process.argv.includes('--keep-old');
if (!/^\d+\.\d+\.\d+$/.test(version || '')) { console.error('Usage: node tools/babylon-upgrade.mjs <version, e.g. 9.32.0> [--keep-old]'); process.exit(1); }

const current = (() => { try { return JSON.parse(fs.readFileSync(path.join(VENDOR, 'current.json'), 'utf8')); } catch (e) { return null; } })();
const oldVersion = current?.version || null;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'babylon-upgrade-'));
const unpack = (spec) => {
  const tgz = execFileSync('npm', ['pack', spec, '--silent', '--pack-destination', tmp], { encoding: 'utf8' }).trim().split('\n').pop();
  const dir = path.join(tmp, tgz.replace(/\.tgz$/, ''));
  fs.mkdirSync(dir, { recursive: true });
  execFileSync('tar', ['-xzf', path.join(tmp, tgz), '-C', dir]);
  return path.join(dir, 'package');
};

const out = path.join(VENDOR, version);
fs.mkdirSync(out, { recursive: true });
for (const [pkg, file] of BABYLON_FILES) {
  const dir = unpack(`${pkg}@${version}`);
  const pj = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  if (pj.version !== version) throw new Error(`${pkg}: npm gave ${pj.version}, not ${version}`);
  fs.copyFileSync(path.join(dir, file), path.join(out, file));
  if (pkg === 'babylonjs') {
    // Apache License 2.0 (Babylon and Google's Draco decoder alike): the licence text and the notices go with the files
    fs.copyFileSync(path.join(dir, 'license.md'), path.join(VENDOR, 'LICENSE-babylon.md'));
    const notice = fs.existsSync(path.join(dir, 'NOTICE.md')) ? fs.readFileSync(path.join(dir, 'NOTICE.md'), 'utf8').trim() : 'Babylon.js';
    fs.writeFileSync(path.join(VENDOR, 'NOTICE.md'), `${notice}\n\nflare.png (the village's particle glow): the Babylon.js playground texture (packages/tools/playground/public/textures).\n\nDraco glTF decoder (draco_*_gltf.*): Copyright Google LLC, https://github.com/google/draco\n\nAll of it is under the Apache License 2.0 (LICENSE-babylon.md).\n`);
  }
}
const oldDir = oldVersion && oldVersion !== version ? path.join(VENDOR, oldVersion) : null;
let dracoFrom;
if (oldDir && Object.keys(DRACO).every((f) => fs.existsSync(path.join(oldDir, f)))) {
  for (const f of Object.keys(DRACO)) fs.copyFileSync(path.join(oldDir, f), path.join(out, f));
  dracoFrom = current.dracoFrom;
} else if (!Object.keys(DRACO).every((f) => fs.existsSync(path.join(out, f)))) {
  const three = unpack(THREE_FOR_DRACO);
  for (const [f, src] of Object.entries(DRACO)) fs.copyFileSync(path.join(three, 'examples/jsm/libs/draco/gltf', src), path.join(out, f));
  dracoFrom = `${THREE_FOR_DRACO} examples/jsm/libs/draco/gltf (Google's Draco glTF decoder)`;
} else dracoFrom = current?.dracoFrom || null;

let pagesChanged = 0;
for (const page of PAGES) {
  const p = path.join(ROOT, page), s = fs.readFileSync(p, 'utf8');
  const t = s.replace(/assets\/vendor\/babylon\/\d+\.\d+\.\d+\//g, `assets/vendor/babylon/${version}/`);
  if (t !== s) { fs.writeFileSync(p, t); pagesChanged++; }
}
const files = fs.readdirSync(out).sort();
fs.writeFileSync(path.join(VENDOR, 'current.json'), JSON.stringify({
  version, since: new Date().toISOString().slice(0, 10), previous: oldVersion && oldVersion !== version ? oldVersion : (current?.previous || null),
  folder: `/assets/vendor/babylon/${version}/`, files, dracoFrom, pages: PAGES
}, null, 2) + '\n');
if (oldDir && !keepOld && fs.existsSync(oldDir)) fs.rmSync(oldDir, { recursive: true, force: true });
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`Babylon ${version} in ${path.relative(ROOT, out)} (${files.length} files)${oldDir ? `, was ${oldVersion}${keepOld ? ' (kept)' : ' (removed)'}` : ''}; pages pointed at it: ${pagesChanged}`);
