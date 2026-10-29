// node tools/make-light.mjs -> assets/character/lite/ant_light.glb, the starter ant's light copy for crowds: makeLight
// (api/_forge-light.mjs) on ant_idle_c.glb with the moves of ant_walk_c / ant_run_c / ant_jumping_c, in place (as the
// village plays the starter ant: no hip travel). Forge rigs get theirs from api/forge-light.mjs.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import draco3d from 'draco3dgltf';
import { makeLight, lightIO } from '../api/_forge-light.mjs';

const C = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'character');
const io = lightIO({ 'draco3d.decoder': await draco3d.createDecoderModule(), 'draco3d.encoder': await draco3d.createEncoderModule() });
const read = (f) => new Uint8Array(fs.readFileSync(path.join(C, f)));
const { glb, info } = await makeLight(read('ant_idle_c.glb'), {
  io, inPlace: true, error: 0.1, flags: ['Permissive', 'Prune'], rename: { 'mixamo.com': 'idle' },
  more: [['ant_walk_c.glb', 'walk'], ['ant_run_c.glb', 'run'], ['ant_jumping_c.glb', 'jump']].map(([f, n]) => ({ bytes: read(f), clips: { 'mixamo.com': n } }))
});
fs.mkdirSync(path.join(C, 'lite'), { recursive: true });
fs.writeFileSync(path.join(C, 'lite', 'ant_light.glb'), glb);
console.log(JSON.stringify(info));
