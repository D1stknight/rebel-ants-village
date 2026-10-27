// Weather drawn on the GPU (Oct 25): rain streaks, snow flakes and the splashes where the rain lands. Each is one mesh
// (one draw call) of small quads; every drop falls and wraps round the camera in the vertex shader, so the box of drops
// travels with the camera while each drop stays put in the world. The wind slants them, the fog fades them, and a
// top-down height map of what stands round the camera (roofs, trees, the ground, the water; drawn again now and then)
// stops them under roofs and puts the splashes on whatever the rain lands on.
// village.html calls VillageWeather.update(o) every frame (o: see update below) and VillageWeather.hide() in rooms.
(function () {
  const VW = window.VillageWeather = {};
  let scene = null, engine = null, lite = false, made = false;
  const V3 = (x, y, z) => new BABYLON.Vector3(x, y, z);

  const RAIN_VS = `
precision highp float;
attribute vec3 position;
attribute vec4 seed;
attribute vec2 corner;
uniform mat4 viewProjection;
uniform vec3 uCam, uBox, uBoxC, uOff, uVel;
uniform float uTime, uDensity, uPix, uSnow, uFogD, uLen, uWid;
#ifdef OCC
uniform sampler2D uOcc;
uniform vec4 uOccP;
#endif
varying vec2 vUV;
varying float vA;
void main() {
  vec4 s = seed;
  float show = step(s.w, uDensity);
  float jit = (17.0 + floor(fract(s.x * 91.7) * 7.0)) / 20.0;
  vec3 o = uBoxC - 0.5 * uBox;
  vec3 p = o + mod(s.xyz * uBox + uOff * jit - o, uBox);
  if (uSnow > 0.5) {
    float t = uTime * (0.55 + s.w * 0.6) + s.x * 40.0;
    p.x += sin(t) * 0.38 + sin(t * 2.3 + s.y * 9.0) * 0.12;
    p.z += cos(t * 0.8 + s.z * 7.0) * 0.38;
  }
#ifdef OCC
  vec2 ouv = (p.xz - uOccP.xy) * uOccP.z;
  if (ouv.x > 0.0 && ouv.x < 1.0 && ouv.y > 0.0 && ouv.y < 1.0) show *= step(uOccP.w - texture2D(uOcc, ouv).r, p.y);
#endif
  vec3 toC = p - uCam; float d = max(length(toC), 0.001); vec3 vd = toC / d;
  vUV = corner;
  vA = show * smoothstep(0.7, 2.4, d) * exp(-(d * uFogD) * (d * uFogD));
  if (vA < 0.002) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
  float w = max(uWid, d * uPix * 1.15);
  vA *= min(1.0, uWid / w * 1.8);
  vec3 q;
  if (uSnow > 0.5) {
    vec3 sd = normalize(cross(vec3(0.0, 1.0, 0.0), vd)), up = cross(vd, sd);
    float r = w * (0.7 + 0.6 * fract(s.y * 37.1));
    q = p + sd * corner.x * r + up * (corner.y * 2.0 - 1.0) * r;
  } else {
    vec3 v = uVel * jit, dir = normalize(v);
    vec3 sd = cross(dir, vd); float sl = length(sd);
    sd = sl > 0.05 ? sd / sl : normalize(cross(vec3(0.0, 1.0, 0.0), vd));
    q = p + sd * corner.x * w + dir * (corner.y - 0.5) * length(v) * uLen;
  }
  gl_Position = viewProjection * vec4(q, 1.0);
}`;

  const RAIN_FS = `
precision highp float;
varying vec2 vUV;
varying float vA;
uniform vec3 uColor;
uniform float uAlpha, uSnow;
void main() {
  float a;
  if (uSnow > 0.5) {
    float r = length(vec2(vUV.x, vUV.y * 2.0 - 1.0));
    a = smoothstep(1.0, 0.25, r);
  } else {
    float x = 1.0 - abs(vUV.x);
    a = x * x * smoothstep(0.0, 0.3, vUV.y) * smoothstep(1.0, 0.7, vUV.y);
  }
  a *= vA * uAlpha;
  if (a < 0.004) discard;
  gl_FragColor = vec4(uColor, a);
}`;

  // splashes: a small crown that jumps up where a drop lands, then a ring that spreads and fades; every slot lands
  // again at a new random place each time round (its own period), on the height map's surface
  const SPLASH_VS = `
precision highp float;
attribute vec3 position;
attribute vec4 seed;
attribute vec3 corner;
uniform mat4 viewProjection;
uniform vec3 uCam, uC;
uniform float uR, uTime, uDensity, uFogD, uRing;
uniform sampler2D uOcc;
uniform vec4 uOccP;
varying vec2 vUV;
varying float vA, vLife, vKind;
float h1(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  float P = 0.5 + 0.4 * seed.y;
  float tt = uTime / P + seed.z, cyc = floor(tt), life = fract(tt);
  float ang = h1(seed.xy + cyc * 0.731) * 6.2832, rad = sqrt(h1(seed.yx * 1.37 + cyc * 1.113)) * uR;
  vec2 xz = uC.xz + vec2(cos(ang), sin(ang)) * rad;
  vec2 ouv = (xz - uOccP.xy) * uOccP.z;
  float top = uOccP.w - texture2D(uOcc, ouv).r;
  float show = step(seed.w, uDensity) * step(0.001, ouv.x) * step(ouv.x, 0.999) * step(0.001, ouv.y) * step(ouv.y, 0.999) * step(uOccP.w - 400.0, top);
  vec3 p = vec3(xz.x, top + 0.03, xz.y);
  vec3 toC = p - uCam; float d = max(length(toC), 0.001); vec3 vd = toC / d;
  vUV = corner.xy; vLife = life; vKind = corner.z;
  vA = show * exp(-(d * uFogD) * (d * uFogD)) * smoothstep(1.0, 2.5, d);
  if (corner.z < 0.5) vA *= 1.0 - smoothstep(0.18, 0.3, life); else vA *= uRing;
  if (vA < 0.002) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
  vec3 q;
  if (corner.z < 0.5) {
    vec3 sd = normalize(cross(vec3(0.0, 1.0, 0.0), vd));
    float k = 0.55 + 2.2 * life;
    q = p + sd * corner.x * 0.09 * k + vec3(0.0, 1.0, 0.0) * (corner.y * 0.5 + 0.5) * 0.16 * k;
  } else {
    q = p + vec3(corner.x, 0.0, corner.y) * 0.4;
  }
  gl_Position = viewProjection * vec4(q, 1.0);
}`;

  const SPLASH_FS = `
precision highp float;
varying vec2 vUV;
varying float vA, vLife, vKind;
uniform vec3 uColor;
uniform float uAlpha;
void main() {
  float a;
  if (vKind < 0.5) {
    float x = abs(vUV.x), y = vUV.y * 0.5 + 0.5;
    // a crown: a few droplets thrown up and out, brightest at the base
    float fan = smoothstep(0.35, 0.0, abs(x - y * 0.55)) + smoothstep(0.22, 0.0, x) * (1.0 - y);
    a = clamp(fan, 0.0, 1.0) * (1.0 - y) * 0.9;
  } else {
    float r = length(vUV), R = 0.12 + 0.82 * vLife;
    a = smoothstep(0.09, 0.0, abs(r - R)) * (1.0 - vLife) * (1.0 - vLife) * step(r, 1.0);
  }
  a *= vA * uAlpha;
  if (a < 0.004) discard;
  gl_FragColor = vec4(uColor, a);
}`;

  function shader(name, vs, fs) {
    BABYLON.Effect.ShadersStore[name + 'VertexShader'] = vs;
    BABYLON.Effect.ShadersStore[name + 'FragmentShader'] = fs;
  }

  function quadMesh(name, n, perSlot, attrs) {
    const verts = n * perSlot * 4, seed = new Float32Array(verts * 4), cor = new Float32Array(verts * attrs), idx = new Uint32Array(n * perSlot * 6);
    const C = [-1, -1, 1, -1, 1, 1, -1, 1];
    for (let i = 0; i < n; i++) {
      const s = [Math.random(), Math.random(), Math.random(), (i + Math.random()) / n]; // .w spread evenly: a density d shows the first d of them
      for (let q = 0; q < perSlot; q++) for (let k = 0; k < 4; k++) {
        const v = (i * perSlot + q) * 4 + k;
        seed.set(s, v * 4);
        cor[v * attrs] = C[k * 2];
        cor[v * attrs + 1] = attrs === 2 ? (C[k * 2 + 1] + 1) / 2 : C[k * 2 + 1];
        if (attrs === 3) cor[v * attrs + 2] = q;
      }
      for (let q = 0; q < perSlot; q++) { const b = (i * perSlot + q) * 4; idx.set([b, b + 1, b + 2, b, b + 2, b + 3], (i * perSlot + q) * 6); }
    }
    const m = new BABYLON.Mesh(name, scene);
    m.setVerticesData('position', new Float32Array(verts * 3), false, 3);
    m.setVerticesData('seed', seed, false, 4);
    m.setVerticesData('corner', cor, false, attrs);
    m.setIndices(idx);
    m.alwaysSelectAsActiveMesh = true; m.isPickable = false; m.doNotSyncBoundingInfo = true; m.receiveShadows = false;
    m.metadata = { camSkip: true, weatherFx: true };
    m.setEnabled(false);
    return m;
  }

  function material(name, sh, uniforms, attrs, occ) {
    const m = new BABYLON.ShaderMaterial(name, scene, { vertex: sh, fragment: sh }, {
      attributes: ['position', 'seed', 'corner'],
      uniforms: ['viewProjection', ...uniforms],
      samplers: occ ? ['uOcc'] : [],
      defines: occ ? ['#define OCC'] : [],
      needAlphaBlending: true
    });
    m.backFaceCulling = false; m.disableDepthWrite = true; m.alphaMode = BABYLON.Engine.ALPHA_COMBINE;
    m.metadata = { perfKeepLive: true };
    return m;
  }

  // ── the height map: the top of whatever stands round the camera, from above ──
  const OCC = { map: null, on: false, at: 0, cx: 1e9, cz: 1e9, camY: 0, S: 128 };
  // (not 'rain' inside 'terrain': the ground's material is terrainMat)
  const OCC_SKIP = /sky|cloud|mist|fog|(?<!ter)rain|snow|splash|bird|ghost|glint|halo|beam|glow|flare|spark|smoke|flame|petal|footprint|sandprint|moondisc|moonhalo|starfield|quest|marker|proxy|pick|vortex|bolt|lightning/i;
  function under(m, test) { for (let n = m; n; n = n.parent) if (test(n)) return true; return false; }
  function makeOcc() {
    if (engine.webGLVersion < 2 || !BABYLON.DepthRenderer) return;
    const caps = engine.getCaps();
    const type = caps.textureFloatRender ? BABYLON.Constants.TEXTURETYPE_FLOAT : caps.textureHalfFloatRender ? BABYLON.Constants.TEXTURETYPE_HALF_FLOAT : 0;
    if (!type) return;
    const N = lite ? 256 : 512, S = OCC.S;
    const cam = new BABYLON.FreeCamera('weatherOccCam', V3(0, 200, 0), scene);
    cam.rotation = V3(Math.PI / 2, 0, 0); // straight down: +x right, +z up in the picture (as the minimap)
    cam.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA; cam.orthoLeft = -S / 2; cam.orthoRight = S / 2; cam.orthoTop = S / 2; cam.orthoBottom = -S / 2;
    cam.minZ = 0.5; cam.maxZ = 150;
    scene.removeCamera?.(cam); scene.cameras.push?.(cam); // (kept in the list: the depth renderer asks it for matrices)
    const fmt = engine._features?.supportExtendedTextureFormats ? BABYLON.Constants.TEXTUREFORMAT_R : BABYLON.Constants.TEXTUREFORMAT_RGBA;
    const rtt = new BABYLON.RenderTargetTexture('weatherOccRTT', N, scene, false, true, type, false, BABYLON.Texture.NEAREST_SAMPLINGMODE, true, false, false, fmt);
    const dr = new BABYLON.DepthRenderer(scene, type, cam, false, BABYLON.Texture.NEAREST_SAMPLINGMODE, true, 'weatherOcc', rtt);
    dr.clearColor = new BABYLON.Color4(1e4, 0, 0, 1); // nothing there: far below everything
    dr.forceDepthWriteTransparentMeshes = true; // the water (the only see-through meshes let in below): rain lands on it
    const pr = () => scene.getTransformNodeByName('playerRoot');
    rtt.renderList = null;
    rtt.renderListPredicate = m => {
      if (!m.isEnabled() || !m.isVisible || m.visibility < .05 || !m.getTotalVertices?.() || m.metadata?.weatherFx) return false;
      const water = m.metadata?.sea || m.metadata?.type === 'terrain_water';
      if (!water && (OCC_SKIP.test(m.name || '') || OCC_SKIP.test(m.material?.name || ''))) return false;
      if (!water && m.material?.needAlphaBlending?.()) return false;
      const p = pr(); if (p && under(m, n => n === p)) return false;
      if (under(m, n => (n.name || '').startsWith('npc_'))) return false;
      return true;
    };
    OCC.map = { cam, rtt, dr, N };
  }
  function renderOcc(cx, cy, cz) {
    const M = OCC.map; if (!M) return false;
    const sx = Math.round(cx / 4) * 4, sz = Math.round(cz / 4) * 4, sy = cy + 70;
    M.cam.position.set(sx, sy, sz);
    M.cam.getViewMatrix(true); M.cam.getProjectionMatrix(true);
    try { M.rtt.render(false); } catch (e) { console.warn('weather height map failed', e); OCC.map = null; return false; }
    OCC.cx = sx; OCC.cz = sz; OCC.camY = sy; OCC.on = true; OCC.at = performance.now();
    return true;
  }
  function occParams() { return new BABYLON.Vector4(OCC.cx - OCC.S / 2, OCC.cz - OCC.S / 2, 1 / OCC.S, OCC.camY); }

  // ── the effects ──
  const FX = {};
  function make() {
    made = true;
    shader('weatherRain', RAIN_VS, RAIN_FS);
    shader('weatherSplash', SPLASH_VS, SPLASH_FS);
    makeOcc();
    const occ = !!OCC.map;
    const U = ['uCam', 'uBox', 'uBoxC', 'uOff', 'uVel', 'uTime', 'uDensity', 'uPix', 'uSnow', 'uFogD', 'uLen', 'uWid', 'uColor', 'uAlpha', 'uOccP'];
    const layer = (name, n, box, ahead, lift, wid, len, alpha) => {
      const mesh = quadMesh(name, n, 1, 2), mat = material(name + 'Mat', 'weatherRain', U, 2, occ);
      if (occ) mat.setTexture('uOcc', OCC.map.rtt);
      mesh.material = mat;
      return { mesh, mat, box: V3(...box), ahead, lift, wid, len, alpha, off: V3(0, 0, 0) };
    };
    const k = lite ? .5 : 1;
    FX.rain = [
      layer('weatherRainNear', Math.round(3600 * k), [24, 16, 24], 7, 2, .008, .075, .72),
      layer('weatherRainFar', Math.round(5200 * k), [96, 44, 96], 34, 8, .012, .085, .46)
    ];
    // snow: the same drops as soft round flakes that sway as they fall (the shader's uSnow)
    FX.snow = [
      layer('weatherSnowNear', Math.round(2400 * k), [26, 14, 26], 6, 2, .034, 0, .95),
      layer('weatherSnowFar', Math.round(4200 * k), [90, 40, 90], 30, 8, .045, 0, .7)
    ];
    if (occ) {
      const mesh = quadMesh('weatherRainSplash', Math.round(900 * k), 2, 3);
      const mat = material('weatherRainSplashMat', 'weatherSplash', ['uCam', 'uC', 'uR', 'uTime', 'uDensity', 'uFogD', 'uRing', 'uColor', 'uAlpha', 'uOccP'], 3, true);
      mat.setTexture('uOcc', OCC.map.rtt);
      mesh.material = mat;
      FX.splash = { mesh, mat };
    }
  }

  VW.init = function (s, o = {}) { scene = s; engine = s.getEngine(); lite = !!o.lite; };

  // the wind: a slow drift of direction and gusts, the same for every effect
  const WIND = { ang: Math.random() * Math.PI * 2, x: 0, z: 0 };
  function wind(t, strength) {
    const a = WIND.ang + Math.sin(t * .021) * .6 + Math.sin(t * .0073) * 1.1;
    const g = strength * (.78 + .22 * Math.sin(t * .37) * Math.sin(t * .13 + 1.7));
    WIND.x = Math.cos(a) * g; WIND.z = Math.sin(a) * g;
    return WIND;
  }
  VW.wind = WIND;

  // o: { cam (camera), focus (Vector3: where the player is), dt (s), rain (0..1), fall (m/s), wind (m/s), fogDensity,
  //      light (Color3: the light the drops catch), flash (0..1), rooms (true: inside, nothing shows) }
  // o: { cam (camera), focus (Vector3: where the player is), dt (s), rain / snow (0..1), fall / snowFall (m/s), wind (m/s),
  //      fogDensity, light (Color3: the light the drops catch), flash (0..1), ring (0..1), rooms (true: inside, nothing shows) }
  VW.update = function (o) {
    if (!scene) return;
    const c01 = v => Math.max(0, Math.min(1, v || 0)), rain = c01(o.rain), snow = c01(o.snow);
    if ((!rain && !snow) || o.rooms || !o.cam) { hideRain(); return; }
    if (!made) make();
    const t = (performance.now() / 1000) % 3600, dt = Math.min(.1, Math.max(0, o.dt || 0));
    const cam = o.cam, cp = cam.globalPosition || cam.position, focus = o.focus || cp;
    const fwd = cam.getDirection ? cam.getDirection(BABYLON.Axis.Z) : V3(0, 0, 1), fl = Math.hypot(fwd.x, fwd.z) || 1, fx = fwd.x / fl, fz = fwd.z / fl;
    const w = wind(t, o.wind || 0);
    // the height map round the player: again every 1.5 s while it falls (meshes still loading come in), at once after a move
    if (OCC.map && (performance.now() - OCC.at > 1500 || Math.hypot(focus.x - OCC.cx, focus.z - OCC.cz) > 18)) renderOcc(focus.x, focus.y, focus.z);
    const occP = OCC.on ? occParams() : new BABYLON.Vector4(0, 0, 0, 0);
    const fov = cam.fov || .8, H = engine.getRenderHeight() || 720, pix = 2 * Math.tan(fov / 2) / H;
    const L = o.light || new BABYLON.Color3(.7, .74, .8), fl2 = o.flash || 0;
    const col = new BABYLON.Color3(Math.min(1.4, L.r + fl2 * .9), Math.min(1.4, L.g + fl2 * .95), Math.min(1.4, L.b + fl2));
    const fog = o.fogDensity || 0;
    const drive = (layers, amount, vel, isSnow, colr) => {
      for (const R of layers) {
        if (!amount) { R.mesh.setEnabled(false); R.lastDensity = 0; continue; }
        R.off.addInPlace(vel.scale(dt));
        const wrap = R.box.scale(20); // a whole number of boxes (see jit in the shader)
        R.off.x %= wrap.x; R.off.y %= wrap.y; R.off.z %= wrap.z;
        const m = R.mat;
        m.setVector3('uCam', cp);
        m.setVector3('uBox', R.box);
        m.setVector3('uBoxC', V3(cp.x + fx * R.ahead, cp.y + R.lift, cp.z + fz * R.ahead));
        m.setVector3('uOff', R.off);
        m.setVector3('uVel', vel);
        m.setFloat('uTime', t);
        R.lastDensity = R === layers[0] ? Math.min(1, amount * 1.15) : amount;
        m.setFloat('uDensity', R.lastDensity);
        m.setFloat('uPix', pix);
        m.setFloat('uSnow', isSnow ? 1 : 0);
        m.setFloat('uFogD', fog);
        m.setFloat('uLen', R.len);
        m.setFloat('uWid', R.wid);
        m.setColor3('uColor', colr);
        m.setFloat('uAlpha', R.alpha * (.75 + .25 * amount));
        m.setVector4('uOccP', occP);
        R.mesh.setEnabled(true);
      }
    };
    drive(FX.rain, rain, V3(w.x, -(o.fall || 8), w.z), false, col);
    drive(FX.snow, snow, V3(w.x * .8, -(o.snowFall || 1.15), w.z * .8), true, new BABYLON.Color3(Math.min(1.3, col.r * 1.08), Math.min(1.3, col.g * 1.08), Math.min(1.3, col.b * 1.08)));
    if (FX.splash) {
      const m = FX.splash.mat, on = OCC.on && rain > 0;
      FX.splash.mesh.setEnabled(on);
      if (on) {
        m.setVector3('uCam', cp);
        m.setVector3('uC', V3(focus.x + fx * 5, focus.y, focus.z + fz * 5));
        m.setFloat('uR', 15);
        m.setFloat('uTime', t);
        m.setFloat('uDensity', rain);
        m.setFloat('uFogD', fog);
        m.setFloat('uRing', o.ring ?? .55);
        m.setColor3('uColor', col);
        m.setFloat('uAlpha', .7);
        m.setVector4('uOccP', occP);
      }
    }
  };

  // ── the cloud deck: one big sheet high over the camera, fbm clouds drifting with the wind; thick parts dark, thin
  // edges catch the light, far away it melts into the fog; a lightning flash lights it up from inside round the strike ──
  const CLOUD_VS = `
precision highp float;
attribute vec3 position;
uniform mat4 viewProjection;
uniform vec3 uCam;
uniform float uY, uR;
varying vec3 vW;
void main() {
  vec3 p = vec3(uCam.x + position.x * uR, uY, uCam.z + position.z * uR);
  vW = p;
  gl_Position = viewProjection * vec4(p, 1.0);
}`;
  const CLOUD_FS = `
precision highp float;
varying vec3 vW;
uniform vec3 uCam, uBase, uLit, uFog, uFlashPos;
uniform vec2 uOff;
uniform float uCover, uFlash, uR, uFogD;
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h2(i), h2(i + vec2(1.0, 0.0)), f.x), mix(h2(i + vec2(0.0, 1.0)), h2(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * vn(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return s; }
void main() {
  vec2 q = (vW.xz + uOff) * 0.0022;
  float n = (fbm(q) + 0.35 * fbm(q * 3.1 + vec2(uOff.y, -uOff.x) * 0.0004)) / 1.3;
  float dens = smoothstep(1.0 - uCover - 0.12, 1.0 - uCover + 0.22, n);
  float d = length(vW.xz - uCam.xz);
  // the underside's own relief: rolls and darker cores even where the deck is closed (a storm)
  float relief = fbm(q * 1.9 + vec2(-uOff.y, uOff.x) * 0.0006 + 7.3);
  vec3 col = mix(uLit, uBase, clamp(smoothstep(0.2, 0.9, dens) * 0.55 + smoothstep(0.3, 0.75, relief) * 0.6, 0.0, 1.0));
  col += vec3(0.75, 0.82, 1.0) * uFlash * exp(-length(vW.xz - uFlashPos.xz) / 260.0) * (0.6 + 0.8 * dens);
  float fogK = 1.0 - exp(-pow(d * uFogD * 0.12, 2.0)); // (thinner than the ground fog: the deck is above the rain)
  col = mix(col, uFog, clamp(fogK, 0.0, 1.0) * 0.85);
  float a = dens * (1.0 - smoothstep(uR * 0.55, uR * 0.98, d)) * mix(0.75, 0.98, uCover);
  if (a < 0.003) discard;
  gl_FragColor = vec4(col, a);
}`;
  const CLOUD = { mesh: null, mat: null, off: new BABYLON.Vector2(0, 0) };
  function makeClouds() {
    shader('weatherCloud', CLOUD_VS, CLOUD_FS);
    const m = BABYLON.MeshBuilder.CreateGround('weatherCloudDeck', { width: 2, height: 2, subdivisions: 1 }, scene);
    m.alwaysSelectAsActiveMesh = true; m.isPickable = false; m.doNotSyncBoundingInfo = true; m.receiveShadows = false; m.alphaIndex = -100; // before the rain
    m.metadata = { camSkip: true, weatherFx: true };
    const mat = new BABYLON.ShaderMaterial('weatherCloudMat', scene, { vertex: 'weatherCloud', fragment: 'weatherCloud' }, {
      attributes: ['position'], uniforms: ['viewProjection', 'uCam', 'uY', 'uR', 'uBase', 'uLit', 'uFog', 'uFlashPos', 'uOff', 'uCover', 'uFlash', 'uFogD'], needAlphaBlending: true });
    mat.backFaceCulling = false; mat.disableDepthWrite = true; mat.alphaMode = BABYLON.Engine.ALPHA_COMBINE; mat.metadata = { perfKeepLive: true };
    m.material = mat; m.setEnabled(false);
    CLOUD.mesh = m; CLOUD.mat = mat;
  }
  // o: { cam, cover 0..1, base / lit / fog (Color3), fogDensity, flash 0..1, flashAt (Vector3), dt, rooms }
  VW.clouds = function (o) {
    if (!scene) return;
    const cover = Math.max(0, Math.min(1, o.cover || 0));
    if (!cover || o.rooms || !o.cam) { CLOUD.mesh?.setEnabled(false); return; }
    if (!CLOUD.mesh) makeClouds();
    const cp = o.cam.globalPosition || o.cam.position, m = CLOUD.mat, dt = Math.min(.1, Math.max(0, o.dt || 0));
    CLOUD.off.x += (WIND.x * 3 + 1.2) * dt; CLOUD.off.y += (WIND.z * 3 + .6) * dt; // high winds: they drift even on a still day
    m.setVector3('uCam', cp); m.setFloat('uY', cp.y + 170); m.setFloat('uR', 1500);
    m.setColor3('uBase', o.base); m.setColor3('uLit', o.lit); m.setColor3('uFog', o.fog);
    m.setVector3('uFlashPos', o.flashAt || cp); m.setFloat('uFlash', o.flash || 0);
    m.setVector2('uOff', CLOUD.off); m.setFloat('uCover', cover); m.setFloat('uFogD', o.fogDensity || 0);
    CLOUD.mesh.setEnabled(true);
  };

  // ── a lightning bolt from the cloud deck to the ground far away: a jagged main channel and forks, a hot core in a
  // blue glow, flickering two or three times (village.html times the flash and the thunder) ──
  const BOLT = { meshes: [], mat: null, glow: null };
  VW.bolt = function (to, fromY) {
    if (!scene) return null;
    if (!BOLT.mat) {
      const mk = (n, c, a) => { const m = new BABYLON.StandardMaterial(n, scene); m.disableLighting = true; m.diffuseColor = BABYLON.Color3.Black(); m.specularColor = BABYLON.Color3.Black();
        m.emissiveColor = new BABYLON.Color3(...c); m.alpha = a; m.alphaMode = BABYLON.Engine.ALPHA_ADD; m.disableDepthWrite = true; m.fogEnabled = false; m.backFaceCulling = false; m.metadata = { perfKeepLive: true }; return m; };
      BOLT.mat = mk('weatherBoltMat', [.9, .95, 1], 1); BOLT.glow = mk('weatherBoltGlow', [.3, .45, 1], .28);
    }
    BOLT.meshes.forEach(m => m.dispose()); BOLT.meshes = [];
    const V = BABYLON.Vector3, R = Math.random;
    const jag = (a, b, n, amp) => { const pts = []; for (let i = 0; i <= n; i++) { const u = i / n, q = V.Lerp(a, b, u); if (i && i < n) { const k = amp * Math.sin(Math.PI * u); q.x += (R() - .5) * k; q.z += (R() - .5) * k; q.y += (R() - .5) * k * .25; } pts.push(q); } return pts; };
    const top = new V(to.x + (R() - .5) * 60, fromY, to.z + (R() - .5) * 60), len = fromY - to.y;
    const main = jag(top, to, 22, len * .12), paths = [main];
    for (let f = 0; f < 2 + Math.floor(R() * 3); f++) {
      const i = 3 + Math.floor(R() * 12), a = main[i];
      paths.push(jag(a, a.add(new V((R() - .5) * len * .45, -len * (.12 + R() * .2), (R() - .5) * len * .45)), 8, len * .05));
    }
    const w = Math.max(.5, len / 140);
    paths.forEach((path, k) => {
      for (const [mat, r] of [[BOLT.mat, (k ? .35 : .6) * w], [BOLT.glow, (k ? 1.4 : 2.4) * w]]) {
        const m = BABYLON.MeshBuilder.CreateTube('weatherBolt_beam', { path, radius: r, tessellation: 5, cap: BABYLON.Mesh.NO_CAP }, scene);
        m.material = mat; m.isPickable = false; m.applyFog = false; m.alwaysSelectAsActiveMesh = true; m.metadata = { camSkip: true, weatherFx: true, _perfNeverFreeze: true };
        BOLT.meshes.push(m);
      }
    });
    const mine = BOLT.meshes, show = v => mine.forEach(m => { if (!m.isDisposed()) m.setEnabled(v); });
    setTimeout(() => show(false), 70); setTimeout(() => show(true), 120); // it strikes again down the same channel
    if (R() < .5) { setTimeout(() => show(false), 170); setTimeout(() => show(true), 230); }
    setTimeout(() => { mine.forEach(m => m.dispose()); if (BOLT.meshes === mine) BOLT.meshes = []; }, 320);
    return { top, to };
  };

  // a soft puff (fog banks, breath): a round blob with ragged edges
  let PUFF = null;
  function puffTex() {
    if (PUFF) return PUFF;
    const S = 128, t = new BABYLON.DynamicTexture('weatherPuffTex', { width: S, height: S }, scene, true), c = t.getContext(), img = c.createImageData(S, S);
    const h = (x, y) => { const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return v - Math.floor(v); };
    const vn = (x, y) => { const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j, a = h(i, j), b = h(i + 1, j), cc = h(i, j + 1), d = h(i + 1, j + 1), su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v); return a + (b - a) * su + (cc - a) * sv + (a - b - cc + d) * su * sv; };
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const u = x / S - .5, v = y / S - .5, r = Math.hypot(u, v) * 2, n = vn(x / 18, y / 18) * .5 + vn(x / 7, y / 7) * .25 - .375;
      const a = Math.max(0, Math.min(1, (1 - r) * 1.25 + n)) * Math.max(0, 1 - r) ** .8, k = (y * S + x) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = 255; img.data[k + 3] = Math.round(255 * a);
    }
    c.putImageData(img, 0, 0); t.update(); t.hasAlpha = true;
    return (PUFF = t);
  }

  // ── fog banks: soft billboards lying low round the player, drifting with the wind (the fog weather) ──
  const FOG = { ps: null, warm: false };
  VW.fogBanks = function (o) { // { focus (Vector3), amount 0..1, color (Color3), rooms }
    if (!scene) return;
    const a = Math.max(0, Math.min(1, o.amount || 0));
    if (!a || o.rooms || !o.focus) { if (FOG.ps) FOG.ps.emitRate = 0; if (o.rooms && FOG.ps) FOG.ps.reset(); return; }
    if (!FOG.ps) {
      const ps = FOG.ps = new BABYLON.ParticleSystem('weatherFogBanks', lite ? 160 : 320, scene);
      ps.particleTexture = puffTex(); ps.emitter = V3(0, 0, 0);
      ps.minEmitBox = V3(-55, .1, -55); ps.maxEmitBox = V3(55, 3.2, 55);
      ps.addColorGradient(0, new BABYLON.Color4(1, 1, 1, 0)); ps.addColorGradient(.25, new BABYLON.Color4(1, 1, 1, .2));
      ps.addColorGradient(.75, new BABYLON.Color4(1, 1, 1, .2)); ps.addColorGradient(1, new BABYLON.Color4(1, 1, 1, 0));
      ps.minSize = 9; ps.maxSize = 20; ps.minLifeTime = 28; ps.maxLifeTime = 46;
      ps.minEmitPower = .15; ps.maxEmitPower = .5; ps.minAngularSpeed = -.04; ps.maxAngularSpeed = .04; ps.minInitialRotation = 0; ps.maxInitialRotation = 6.28;
      ps.gravity = V3(0, 0, 0); ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD; ps.updateSpeed = .016;
      ps.preWarmCycles = 140; ps.preWarmStepOffset = 14; // fog from the first frame
      ps.start();
    }
    const ps = FOG.ps;
    ps.emitter.copyFrom(o.focus);
    ps.direction1 = V3(WIND.x * .2 - .3, 0, WIND.z * .2 - .2); ps.direction2 = V3(WIND.x * .2 + .3, .03, WIND.z * .2 + .2);
    ps.emitRate = (lite ? 4 : 8) * a;
    const col = o.color || new BABYLON.Color3(.7, .74, .78);
    ps.textureMask = new BABYLON.Color4(col.r, col.g, col.b, Math.min(1, .5 + .5 * a));
  };

  // ── heat shimmer: the picture wobbles a little where the ground meets the distance (the hot weather; not on phones) ──
  const HEAT_FS = `
precision highp float;
varying vec2 vUV;
uniform sampler2D textureSampler;
uniform float uTime, uAmt;
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h2(i), h2(i + vec2(1.0, 0.0)), f.x), mix(h2(i + vec2(0.0, 1.0)), h2(i + vec2(1.0, 1.0)), f.x), f.y); }
void main() {
  float band = smoothstep(0.28, 0.56, vUV.y) * (1.0 - smoothstep(0.64, 0.9, vUV.y));
  vec2 q = vUV * vec2(26.0, 70.0);
  vec2 o = vec2(vn(q + vec2(0.0, -uTime * 2.2)) - 0.5, vn(q * 1.3 + vec2(19.0, -uTime * 1.7)) - 0.5) * 0.0045 * uAmt * band;
  gl_FragColor = texture2D(textureSampler, vUV + o);
}`;
  const HEAT = { pp: null, cam: null, amt: 0 };
  VW.heat = function (o) { // { cam, amount 0..1, rooms }
    if (!scene) return;
    const a = Math.max(0, Math.min(1, o.amount || 0));
    if (!a || o.rooms || lite || !o.cam) { if (HEAT.pp && HEAT.cam) { try { HEAT.cam.detachPostProcess(HEAT.pp); } catch (e) {} HEAT.cam = null; } return; }
    if (!HEAT.pp) {
      BABYLON.Effect.ShadersStore.weatherHeatFragmentShader = HEAT_FS;
      HEAT.pp = new BABYLON.PostProcess('weatherHeat', 'weatherHeat', ['uTime', 'uAmt'], null, 1, null, BABYLON.Texture.BILINEAR_SAMPLINGMODE, engine);
      HEAT.pp.onApply = e => { e.setFloat('uTime', (performance.now() / 1000) % 1000); e.setFloat('uAmt', HEAT.amt); };
    }
    if (HEAT.cam !== o.cam) { if (HEAT.cam) try { HEAT.cam.detachPostProcess(HEAT.pp); } catch (e) {} o.cam.attachPostProcess(HEAT.pp); HEAT.cam = o.cam; }
    HEAT.amt = a;
  };

  // ── breath: a small puff in front of the Rebel's face every few seconds (cold and snow) ──
  const BREATH = { ps: null, next: 0 };
  VW.breath = function (o) { // { head (Vector3: the mouth), fwd (Vector3), amount 0..1, light (Color3), rooms }
    if (!scene || !o.amount || o.rooms || !o.head) return;
    if (!BREATH.ps) {
      const ps = BREATH.ps = new BABYLON.ParticleSystem('weatherBreath', 60, scene);
      ps.particleTexture = puffTex(); ps.emitter = V3(0, 0, 0);
      ps.minEmitBox = V3(-.03, -.03, -.03); ps.maxEmitBox = V3(.03, .03, .03);
      ps.addColorGradient(0, new BABYLON.Color4(1, 1, 1, 0)); ps.addColorGradient(.12, new BABYLON.Color4(1, 1, 1, .34)); ps.addColorGradient(1, new BABYLON.Color4(1, 1, 1, 0));
      ps.addSizeGradient(0, .08); ps.addSizeGradient(1, .6);
      ps.minLifeTime = 1.1; ps.maxLifeTime = 1.7; ps.minEmitPower = .35; ps.maxEmitPower = .7; ps.gravity = V3(0, .12, 0);
      ps.minAngularSpeed = -.6; ps.maxAngularSpeed = .6; ps.emitRate = 0; ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD;
      ps.start();
    }
    const now = performance.now(), ps = BREATH.ps;
    if (now < BREATH.next) return;
    BREATH.next = now + 2600 + Math.random() * 1500;
    const f = o.fwd || V3(0, 0, 1);
    ps.emitter.copyFrom(o.head);
    ps.direction1 = V3(f.x - .15, .05, f.z - .15); ps.direction2 = V3(f.x + .15, .25, f.z + .15);
    const L = o.light || new BABYLON.Color3(.9, .92, .95);
    ps.textureMask = new BABYLON.Color4(Math.min(1, L.r), Math.min(1, L.g), Math.min(1, L.b), Math.min(1, o.amount));
    ps.manualEmitCount = 10;
  };

  // ── snow on roofs and buildings (Oct 27): a cap over every surface of a piece that faces up with nothing of the piece
  // over it (a height grid of the piece seen from above), 4 cm off it, in one snow material whose patches grow with the
  // snow cover like the ground's drifts; spots the roof map shows sheltered (under another roof, a tree) stay clear.
  // Kit pieces: one cap per kit type, an instance under each placed piece (window.SamuraiKit.placed()); model buildings
  // and stairs: one cap per copy. Made the first time snow lies, a few milliseconds of work a frame. ──
  const CAPS = { made: false, mat: null, U: null, occP: null, park: null, type: new Map(), seen: new Set(), list: [], queue: [], job: null, shown: false, scanAt: 0, budget: 0, ms: 0 };
  const CAP_LIFT = .04, CAP_UP = .42; // metres off the surface; |normal y| it takes (about 65 degrees from flat)
  const CAP_SKIP = /glow|flame|fire|water|sea|pool|banner|noren|sail|flag|cloth|rope|net|leaf|leaves|blossom|petal|grass|flower|glass|window|shoji|paper|neon|light|lamp|candle|ember|orb|ghost|smoke|mist/i;
  const capSkipMat = mt => !mt || mt.metadata?.kitGlow || mt.disableLighting || (mt.alpha ?? 1) < .99 || mt.alphaMode === BABYLON.Engine.ALPHA_ADD || mt.needAlphaBlending?.() || CAP_SKIP.test(mt.name || '');
  // the cap of one piece from its triangles (parts: [{ p positions, n normals or null, i indices }] in one space, y up)
  function* capGeometry(parts, out) {
    let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
    for (const P of parts) for (let k = 0; k < P.p.length; k += 3) { const x = P.p[k], z = P.p[k + 2]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; }
    if (!(x1 > x0) || !(z1 > z0)) return;
    const cell = Math.min(.35, Math.max(.05, Math.max(x1 - x0, z1 - z0) / 220));
    const GW = Math.ceil((x1 - x0) / cell) + 1, GD = Math.ceil((z1 - z0) / cell) + 1, top = new Float32Array(GW * GD).fill(-1e9);
    let work = 0;
    // 1: the highest point of the piece over each cell (cell centres inside each triangle seen from above)
    for (const P of parts) {
      const p = P.p, I = P.i;
      for (let k = 0; k < I.length; k += 3) {
        const a = I[k] * 3, b = I[k + 1] * 3, c = I[k + 2] * 3;
        const ax = p[a], ay = p[a + 1], az = p[a + 2], bx = p[b], by = p[b + 1], bz = p[b + 2], cx = p[c], cy = p[c + 1], cz = p[c + 2];
        const den = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
        if (Math.abs(den) < 1e-10) continue; // edge-on from above (a wall)
        const i0 = Math.max(0, Math.ceil((Math.min(ax, bx, cx) - x0) / cell - .5)), i1 = Math.min(GW - 1, Math.floor((Math.max(ax, bx, cx) - x0) / cell - .5));
        const j0 = Math.max(0, Math.ceil((Math.min(az, bz, cz) - z0) / cell - .5)), j1 = Math.min(GD - 1, Math.floor((Math.max(az, bz, cz) - z0) / cell - .5));
        for (let j = j0; j <= j1; j++) {
          const z = z0 + (j + .5) * cell;
          for (let i = i0; i <= i1; i++) {
            const x = x0 + (i + .5) * cell;
            const u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / den, v = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / den, w = 1 - u - v;
            if (u < -1e-4 || v < -1e-4 || w < -1e-4) continue;
            const y = u * ay + v * by + w * cy, q = j * GW + i;
            if (y > top[q]) top[q] = y;
          }
        }
        if (++work % 3000 === 0) yield;
      }
    }
    // 2: the surfaces that face up (either winding) and are the top of the piece at their points
    const hAt = (x, z) => { const i = Math.floor((x - x0) / cell), j = Math.floor((z - z0) / cell); return i < 0 || j < 0 || i >= GW || j >= GD ? -1e9 : top[j * GW + i]; };
    for (const P of parts) {
      const p = P.p, N = P.n, I = P.i;
      for (let k = 0; k < I.length; k += 3) {
        if (++work % 3000 === 0) yield;
        let ia = I[k], ib = I[k + 1], ic = I[k + 2];
        const a = ia * 3, b = ib * 3, c = ic * 3;
        const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2], vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const nl = Math.hypot(nx, ny, nz);
        if (nl < 1e-12 || Math.abs(ny) / nl < CAP_UP) continue;
        const s = ny < 0 ? -1 : 1; nx *= s / nl; ny *= s / nl; nz *= s / nl;
        // the plane's height over a point; four points of the triangle checked against the grid
        const ph = (x, z) => p[a + 1] - (nx * (x - p[a]) + nz * (z - p[a + 2])) / ny;
        const gx = (p[a] + p[b] + p[c]) / 3, gz = (p[a + 2] + p[b + 2] + p[c + 2]) / 3;
        let ok = 0;
        for (const [x, z] of [[gx, gz], [gx * .7 + p[a] * .3, gz * .7 + p[a + 2] * .3], [gx * .7 + p[b] * .3, gz * .7 + p[b + 2] * .3], [gx * .7 + p[c] * .3, gz * .7 + p[c + 2] * .3]]) {
          const cx = x0 + (Math.floor((x - x0) / cell) + .5) * cell, cz = z0 + (Math.floor((z - z0) / cell) + .5) * cell; // (compared at the cell's centre, where the grid was measured)
          if (ph(cx, cz) >= hAt(x, z) - .08) ok++;
        }
        if (ok < 2) continue;
        const base = out.p.length / 3;
        for (const v of [a, b, c]) {
          let mx = nx, my = ny, mz = nz;
          if (N) { const qx = N[v], qy = N[v + 1], qz = N[v + 2], d = qx * nx + qy * ny + qz * nz, l = Math.hypot(qx, qy, qz) || 1; if (Math.abs(d) / l > .5) { const f = (d < 0 ? -1 : 1) / l; mx = qx * f; my = qy * f; mz = qz * f; } } // the smooth normal, turned up with the face
          my += 1; const ml = Math.hypot(mx, my, mz); // (bent toward the sky: snow fills the roof's strips in, so it lights evenly)
          out.p.push(p[v] + nx * CAP_LIFT, p[v + 1] + ny * CAP_LIFT, p[v + 2] + nz * CAP_LIFT); out.n.push(mx / ml, my / ml, mz / ml);
        }
        out.i.push(base, base + 1, base + 2);
      }
    }
  }
  function* capJob(item, out) {
    const VB = BABYLON.VertexBuffer, parts = [];
    if (item.kind === 'kit') {
      for (const m of window.SamuraiKit?.templateMeshes?.(scene, item.type) || []) {
        if (capSkipMat(m.material)) continue;
        const p = m.getVerticesData(VB.PositionKind), n = m.getVerticesData(VB.NormalKind), i = m.getIndices();
        if (p && i) parts.push({ p, n, i });
      }
    } else { // a model copy or a staircase: its meshes in world space
      for (const m of item.root.getChildMeshes(false)) {
        if (!m.getTotalVertices?.() || m.metadata?.snowCap || m.skeleton || capSkipMat(m.material) || !m.isEnabled()) continue;
        const p = m.getVerticesData(VB.PositionKind), n = m.getVerticesData(VB.NormalKind), i = m.getIndices();
        if (!p || !i) continue;
        const W = m.computeWorldMatrix(true), wp = new Float32Array(p.length), wn = n ? new Float32Array(n.length) : null, t = new BABYLON.Vector3();
        for (let k = 0; k < p.length; k += 3) { BABYLON.Vector3.TransformCoordinatesFromFloatsToRef(p[k], p[k + 1], p[k + 2], W, t); wp[k] = t.x; wp[k + 1] = t.y; wp[k + 2] = t.z; }
        if (n) for (let k = 0; k < n.length; k += 3) { BABYLON.Vector3.TransformNormalFromFloatsToRef(n[k], n[k + 1], n[k + 2], W, t); wn[k] = t.x; wn[k + 1] = t.y; wn[k + 2] = t.z; }
        parts.push({ p: wp, n: wn, i });
        yield;
      }
    }
    yield* capGeometry(parts, out);
  }
  function makeCaps() {
    CAPS.made = true;
    if (!BABYLON.CustomMaterial) return;
    if (!OCC.map) makeOcc();
    CAPS.U = new BABYLON.Vector4(0, 0, 0, 0); CAPS.occP = new BABYLON.Vector4(0, 0, 0, 0);
    const m = CAPS.mat = new BABYLON.CustomMaterial('snowCapMat', scene);
    m.metadata = { perfKeepLive: true };
    m.diffuseColor = new BABYLON.Color3(.86, .88, .91); m.specularColor = new BABYLON.Color3(.03, .03, .035); m.specularPower = 8;
    m.emissiveColor = new BABYLON.Color3(.12, .125, .14); // (snow is bright in shade too: less blue there)
    m.backFaceCulling = false; m.zOffset = -2; m.maxSimultaneousLights = 4; // (a cap's triangles keep their piece's winding: either side up)
    m.AddUniform('uSnowC', 'vec4', CAPS.U); m.AddUniform('uSnowOccP', 'vec4', CAPS.occP);
    const occ = !!OCC.map;
    if (occ) m.AddUniform('uSnowOcc', 'sampler2D', OCC.map.rtt);
    m.Fragment_Definitions(`
      float sc_h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float sc_n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(sc_h(i),sc_h(i+vec2(1.,0.)),f.x), mix(sc_h(i+vec2(0.,1.)),sc_h(i+vec2(1.,1.)),f.x), f.y); }
      float sc_f(vec2 p){ float a=.5, s=0.; for(int i=0;i<4;i++){ s+=a*sc_n(p); p*=2.03; a*=.5; } return s; }
    `);
    m.Fragment_Before_Lights(`
      {
        // more on what lies flat; patches that grow and join as the cover builds (the ground's drifts, finer)
        float upK = smoothstep(${CAP_UP.toFixed(2)}, 0.8, normalW.y);
        float pat = sc_f(vPositionW.xz * 0.55 + vec2(5.3, 1.7)) * 0.78 + sc_n(vPositionW.xz * 3.7) * 0.22;
        if (pat > (uSnowC.x * (0.55 + 0.45 * upK) - 0.18) * 1.6) discard;
        diffuseColor *= 0.93 + 0.07 * sc_n(vPositionW.xz * 1.3 + vec2(2.1, 8.4)); // a little grain
        ${occ ? `if (uSnowC.y > 0.5) { // under another roof or a tree (the roof map round the player): no snow
          vec2 ouv = (vPositionW.xz - uSnowOccP.xy) * uSnowOccP.z;
          if (ouv.x > 0.0 && ouv.x < 1.0 && ouv.y > 0.0 && ouv.y < 1.0 && vPositionW.y < uSnowOccP.w - texture2D(uSnowOcc, ouv).r - 0.45) discard;
        }` : ''}
      }
    `);
    CAPS.park = new BABYLON.TransformNode('snowCapTemplates', scene); CAPS.park.position.set(0, -10000, 0);
  }
  function addCapInstance(t, node) {
    const ci = t.createInstance(node.name + '_snowCap');
    ci.parent = node; ci.isPickable = false; ci.metadata = { snowCap: true, weatherFx: true, camSkip: true };
    ci.setEnabled(CAPS.shown); CAPS.list.push(ci);
  }
  function finishCap(item, out) {
    if (!out.p.length) { if (item.kind === 'kit') CAPS.type.set(item.type, null); return; }
    const m = new BABYLON.Mesh(item.kind === 'kit' ? 'snowCap_' + item.type : 'snowCap_' + item.root.name, scene), vd = new BABYLON.VertexData();
    if (item.kind !== 'kit') { // world space -> the copy's own
      const inv = item.root.computeWorldMatrix(true).clone().invert(), t = new BABYLON.Vector3();
      for (let k = 0; k < out.p.length; k += 3) {
        BABYLON.Vector3.TransformCoordinatesFromFloatsToRef(out.p[k], out.p[k + 1], out.p[k + 2], inv, t); out.p[k] = t.x; out.p[k + 1] = t.y; out.p[k + 2] = t.z;
        BABYLON.Vector3.TransformNormalFromFloatsToRef(out.n[k], out.n[k + 1], out.n[k + 2], inv, t); const l = t.length() || 1; out.n[k] = t.x / l; out.n[k + 1] = t.y / l; out.n[k + 2] = t.z / l;
      }
    }
    vd.positions = out.p; vd.normals = out.n; vd.indices = out.i; vd.applyToMesh(m);
    m.material = CAPS.mat; m.isPickable = false; m.receiveShadows = true; m.metadata = { snowCap: true, weatherFx: true, camSkip: true };
    m.freezeNormals();
    if (item.kind === 'kit') { m.parent = CAPS.park; CAPS.type.set(item.type, m); CAPS.scanAt = 0; } // (its pieces get their instances on the next scan)
    else { m.parent = item.root; m.setEnabled(CAPS.shown); CAPS.list.push(m); }
  }
  function scanCaps(models) {
    const K = window.SamuraiKit;
    for (const e of K?.placed?.() || []) {
      const node = e.root;
      if (!node || node.isDisposed() || CAPS.seen.has(node.uniqueId)) continue;
      if (e.stairs) { CAPS.seen.add(node.uniqueId); CAPS.queue.push({ kind: 'model', root: node }); continue; }
      const t = CAPS.type.get(e.type);
      if (t === undefined) { CAPS.type.set(e.type, 'pending'); CAPS.queue.push({ kind: 'kit', type: e.type }); continue; }
      if (t === 'pending') continue;
      CAPS.seen.add(node.uniqueId);
      if (t && !t.isDisposed()) addCapInstance(t, node);
    }
    for (const r of models?.() || []) if (r && !r.isDisposed() && !CAPS.seen.has(r.uniqueId) && r.getChildMeshes(false).some(m => m.getTotalVertices?.() > 0)) { CAPS.seen.add(r.uniqueId); CAPS.queue.push({ kind: 'model', root: r }); }
  }
  VW.snowCaps = function (o) { // every frame: { cover 0..1, rooms, focus (Vector3), models () => [roots of model buildings] }
    if (!scene) return;
    const cover = Math.max(0, Math.min(1, o.cover || 0)), want = cover > .02 && !o.rooms;
    if (!CAPS.made) { if (!want) return; makeCaps(); }
    if (!CAPS.mat) return;
    CAPS.U.x = cover;
    if (want !== CAPS.shown) { CAPS.shown = want; for (const m of CAPS.list) if (!m.isDisposed()) m.setEnabled(want); }
    if (!want) return;
    const now = performance.now(), f = o.focus;
    // the roof map round the player stays fresh while snow lies (falling snow redraws it every 1.5 s too)
    if (OCC.map && f && (now - OCC.at > 4000 || Math.hypot(f.x - OCC.cx, f.z - OCC.cz) > 18)) renderOcc(f.x, f.y, f.z);
    if (OCC.on) { CAPS.U.y = 1; CAPS.occP.copyFrom(occParams()); }
    if (now - CAPS.scanAt > 2000) { CAPS.scanAt = now; scanCaps(o.models); }
    const end = now + (CAPS.budget || (lite ? 2 : 3)); // (milliseconds of cap making a frame)
    while (performance.now() < end && (CAPS.job || CAPS.queue.length)) {
      if (!CAPS.job) { const item = CAPS.queue.shift(); if (item.kind === 'model' && item.root.isDisposed()) continue; const out = { p: [], n: [], i: [] }; CAPS.job = { item, out, it: capJob(item, out) }; }
      if (CAPS.job.it.next().done) { const { item, out } = CAPS.job; CAPS.job = null; finishCap(item, out); }
    }
    CAPS.ms += Math.max(0, performance.now() - now);
  };
  VW._caps = CAPS; // (tests)

  function hideRain() { for (const R of [...(FX.rain || []), ...(FX.snow || [])]) R.mesh.setEnabled(false); FX.splash?.mesh.setEnabled(false); }
  VW.hide = function () {
    hideRain();
    CLOUD.mesh?.setEnabled(false);
    if (FOG.ps) { FOG.ps.emitRate = 0; FOG.ps.reset(); }
    if (HEAT.pp && HEAT.cam) { try { HEAT.cam.detachPostProcess(HEAT.pp); } catch (e) {} HEAT.cam = null; }
    BOLT.meshes.forEach(m => m.setEnabled(false));
  };

  // how many drops show (the admin's weather readout)
  VW.count = function () {
    let n = 0;
    for (const R of [...(FX.rain || []), ...(FX.snow || [])]) if (R.mesh.isEnabled()) n += Math.round(R.mesh.getTotalVertices() / 4 * (R.lastDensity ?? 1));
    return n;
  };
  VW._fx = FX; VW._occ = OCC; VW._renderOcc = renderOcc; VW._cloud = CLOUD; VW._bolt = BOLT; VW._fog = FOG; VW._heat = HEAT; VW._breath = BREATH; // (tests)
})();
