// strip.mjs in.glb out.glb fingers.json : drop all animations, save the Forge relaxed finger pose (Idle, first key)
import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions'; import { prune } from '@gltf-transform/functions'; import d3 from 'draco3dgltf'; import fs from 'fs';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await d3.createDecoderModule(), 'draco3d.encoder': await d3.createEncoderModule() });
const [i, o, fj] = process.argv.slice(2); const D = await io.read(i), R = D.getRoot();
const idle = R.listAnimations().find(a => a.getName() === 'Idle'); const fingers = {};
for (const c of idle.listChannels()) { const n = c.getTargetNode().getName(); if (c.getTargetPath() === 'rotation' && /Hand(Thumb|Index|Middle|Ring|Pinky)/.test(n)) fingers[n] = Array.from(c.getSampler().getOutput().getArray().slice(0, 4)); }
R.listAnimations().forEach(a => a.dispose()); await D.transform(prune({ keepLeaves: true, keepAttributes: true }));
fs.writeFileSync(fj, JSON.stringify(fingers)); await io.write(o, D); console.log(i.split('/').pop(), 'fingers', Object.keys(fingers).length, 'joints', R.listSkins()[0].listJoints().length);
