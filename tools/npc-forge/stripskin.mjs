// rigged GLB -> static GLB: the skinned mesh baked in its bind pose (as rendered), no skin, no joints, no animations, no Draco
import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions'; import { prune } from '@gltf-transform/functions'; import d3 from 'draco3dgltf';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await d3.createDecoderModule(), 'draco3d.encoder': await d3.createEncoderModule() });
const D = await io.read(process.argv[2]), R = D.getRoot();
const mul = (a, b) => { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c*4+r] += a[k*4+r] * b[c*4+k]; return o; };
const meshNodes = R.listNodes().filter(n => n.getMesh());
const scene = R.listScenes()[0];
for (const n of meshNodes) {
  const skin = n.getSkin(); let M;
  if (skin) { const j0 = skin.listJoints()[0], ibm = Array.from(skin.getInverseBindMatrices().getArray().slice(0, 16)); M = mul(j0.getWorldMatrix(), ibm); }
  else M = n.getWorldMatrix();
  const N3 = [M[0], M[1], M[2], M[4], M[5], M[6], M[8], M[9], M[10]];
  for (const p of n.getMesh().listPrimitives()) {
    const P = p.getAttribute('POSITION'), Nn = p.getAttribute('NORMAL'), v = [];
    for (let i = 0; i < P.getCount(); i++) { P.getElement(i, v); P.setElement(i, [M[0]*v[0]+M[4]*v[1]+M[8]*v[2]+M[12], M[1]*v[0]+M[5]*v[1]+M[9]*v[2]+M[13], M[2]*v[0]+M[6]*v[1]+M[10]*v[2]+M[14]]); }
    if (Nn) for (let i = 0; i < Nn.getCount(); i++) { Nn.getElement(i, v); const x = N3[0]*v[0]+N3[3]*v[1]+N3[6]*v[2], y = N3[1]*v[0]+N3[4]*v[1]+N3[7]*v[2], z = N3[2]*v[0]+N3[5]*v[1]+N3[8]*v[2], l = Math.hypot(x, y, z) || 1; Nn.setElement(i, [x/l, y/l, z/l]); }
    for (const s of ['JOINTS_0', 'WEIGHTS_0', 'JOINTS_1', 'WEIGHTS_1']) if (p.getAttribute(s)) p.setAttribute(s, null);
  }
  n.setSkin(null);
}
R.listAnimations().forEach(a => a.dispose()); R.listSkins().forEach(s => s.dispose());
const out = D.createNode('Body'); scene.addChild(out);
for (const n of meshNodes) { const m = n.getMesh(); const c = D.createNode(n.getName() || 'part').setMesh(m); out.addChild(c); }
for (const n of R.listNodes()) if (n !== out && !out.listChildren().includes(n)) n.dispose();
for (const e of R.listExtensionsUsed()) if (e.extensionName === 'KHR_draco_mesh_compression') e.dispose();
await D.transform(prune());
await io.write(process.argv[3], D);
const b = [Infinity, -Infinity]; for (const n of out.listChildren()) for (const p of n.getMesh().listPrimitives()) { const P = p.getAttribute('POSITION'); b[0] = Math.min(b[0], P.getMin([])[1]); b[1] = Math.max(b[1], P.getMax([])[1]); }
console.log('static', process.argv[3].split('/').pop(), 'meshes', out.listChildren().length, 'y', b.map(v => v.toFixed(2)).join('..'));
