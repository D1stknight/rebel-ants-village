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
  VW.update = function (o) {
    if (!scene) return;
    const rain = Math.max(0, Math.min(1, o.rain || 0));
    if (!rain || o.rooms || !o.cam) { VW.hide(); return; }
    if (!made) make();
    const t = (performance.now() / 1000) % 3600, dt = Math.min(.1, Math.max(0, o.dt || 0));
    const cam = o.cam, cp = cam.globalPosition || cam.position, focus = o.focus || cp;
    const fwd = cam.getDirection ? cam.getDirection(BABYLON.Axis.Z) : V3(0, 0, 1), fl = Math.hypot(fwd.x, fwd.z) || 1, fx = fwd.x / fl, fz = fwd.z / fl;
    const w = wind(t, o.wind || 0), fall = o.fall || 8;
    // the height map round the player: again every 1.5 s while it rains (meshes still loading come in), at once after a move
    if (OCC.map && (performance.now() - OCC.at > 1500 || Math.hypot(focus.x - OCC.cx, focus.z - OCC.cz) > 18)) renderOcc(focus.x, focus.y, focus.z);
    const occP = OCC.on ? occParams() : new BABYLON.Vector4(0, 0, 0, 0);
    const fov = cam.fov || .8, H = engine.getRenderHeight() || 720, pix = 2 * Math.tan(fov / 2) / H;
    const L = o.light || new BABYLON.Color3(.7, .74, .8), fl2 = o.flash || 0;
    const col = new BABYLON.Color3(Math.min(1.4, L.r + fl2 * .9), Math.min(1.4, L.g + fl2 * .95), Math.min(1.4, L.b + fl2));
    const vel = V3(w.x, -fall, w.z), fog = o.fogDensity || 0;
    for (const R of FX.rain) {
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
      R.lastDensity = R === FX.rain[0] ? Math.min(1, rain * 1.15) : rain;
      m.setFloat('uDensity', R.lastDensity);
      m.setFloat('uPix', pix);
      m.setFloat('uSnow', 0);
      m.setFloat('uFogD', fog);
      m.setFloat('uLen', R.len);
      m.setFloat('uWid', R.wid);
      m.setColor3('uColor', col);
      m.setFloat('uAlpha', R.alpha * (.75 + .25 * rain));
      m.setVector4('uOccP', occP);
      R.mesh.setEnabled(true);
    }
    if (FX.splash) {
      const m = FX.splash.mat, on = OCC.on;
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

  VW.hide = function () {
    for (const R of FX.rain || []) R.mesh.setEnabled(false);
    FX.splash?.mesh.setEnabled(false);
  };

  // how many drops show (the admin's weather readout)
  VW.count = function () {
    let n = 0;
    for (const R of FX.rain || []) if (R.mesh.isEnabled()) n += Math.round(R.mesh.getTotalVertices() / 4 * (R.lastDensity ?? 1));
    return n;
  };
  VW._fx = FX; VW._occ = OCC; VW._renderOcc = renderOcc; // (tests)
})();
