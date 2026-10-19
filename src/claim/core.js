// ===================================================================== CORE
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
// the skies (src/sky/): voyages, the shipyard and the fleet's save, from the airship game
import { makeSky, SKIES, SHIPS, SITES, buildShipFar, buildShipAt } from './sky/voyage.js';
import { makeProgress } from './sky/progress.js';

const $ = s => document.querySelector(s);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const TAU = Math.PI * 2;
function mulberry(seed) { let a = seed >>> 0 || 1; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash2(x, y) { let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, y) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); return lerp(lerp(hash2(xi, yi), hash2(xi + 1, yi), u), lerp(hash2(xi, yi + 1), hash2(xi + 1, yi + 1), u), v); }
function fbm(x, y, o = 4) { let s = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < o; i++) { s += a * vnoise(x * f + i * 17.3, y * f - i * 9.1); n += a; a *= 0.5; f *= 2.03; } return s / n; }
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ----------------------------------------------------------------- renderer
const canvas = $('#view');
const QUALITY = { level: 'balanced' };
try { const q = localStorage.getItem('bv-quality'); if (q) QUALITY.level = q; else QUALITY.level = (matchMedia('(pointer:coarse)').matches || innerWidth < 760) ? 'balanced' : 'high'; } catch (e) { }
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 1600);
camera.position.set(42, 58, 92);
const pmrem = new THREE.PMREMGenerator(renderer);
const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environment = envTex;

let composer = null, bloom = null, renderPass = null, lensPass = null, gradePass = null;
// The HD-2D finish. The lens: a tilt-shift blur that keeps a band across the middle sharp and softens the far
// ground at the top and the near ground at the bottom, so the claim reads as a model on a table (stronger the closer
// you look). The grade, after tone mapping: plum in the shadows, warm cream in the lights, and a soft vignette.
const LENS_SHADER = {
  uniforms: { tDiffuse: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uFocus: { value: 0.47 }, uBand: { value: 0.16 }, uAmount: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uFocus, uBand, uAmount; varying vec2 vUv;
    void main() {
      float d = abs(vUv.y - uFocus);
      float blur = smoothstep(uBand, uBand + 0.32, d) * uAmount * (vUv.y > uFocus ? 1.15 : 0.8);
      vec4 c = texture2D(tDiffuse, vUv);
      if (blur < 0.02) { gl_FragColor = c; return; }
      float r = blur * 5.5 * uRes.y / 900.0;
      vec2 px = r / uRes;
      vec4 acc = c; float n = 1.0;
      for (int i = 0; i < 12; i++) {
        float a = float(i) * 2.39996 + 0.5, rr = sqrt((float(i) + 0.5) / 12.0);
        acc += texture2D(tDiffuse, vUv + vec2(cos(a), sin(a)) * px * rr); n += 1.0;
      }
      gl_FragColor = acc / n;
    }`,
};
const GRADE_SHADER = {
  uniforms: { tDiffuse: { value: null }, uVignette: { value: 0.32 }, uNight: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uVignette, uNight; varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      vec3 shade = vec3(0.075, 0.03, 0.09), light = vec3(1.0, 0.95, 0.84);
      c.rgb = mix(c.rgb, c.rgb * mix(vec3(0.94, 0.9, 1.04), light, smoothstep(0.25, 0.9, l)), 0.5);
      c.rgb += shade * (1.0 - smoothstep(0.0, 0.35, l)) * 0.35;
      c.rgb = mix(vec3(l), c.rgb, 1.06 - uNight * 0.12);
      vec2 q = vUv - 0.5; q.x *= 0.85;
      c.rgb *= 1.0 - uVignette * smoothstep(0.32, 0.78, length(q));
      gl_FragColor = c;
    }`,
};
// the Keep's interior is its own little diorama with its own camera
const KSCENE = new THREE.Scene();
const kcam = new THREE.PerspectiveCamera(36, 1, 0.5, 400);
function setupComposer() {
  const w = innerWidth, h = innerHeight;
  if (QUALITY.level === 'light') { composer = null; bloom = null; return; }
  const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: QUALITY.level === 'high' ? 4 : 2 });
  composer = new EffectComposer(renderer, rt);
  renderPass = new RenderPass(scene, camera); composer.addPass(renderPass);
  bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.6, 0.55, 0.82);
  composer.addPass(bloom);
  lensPass = new ShaderPass(LENS_SHADER); composer.addPass(lensPass);
  composer.addPass(new OutputPass());
  gradePass = new ShaderPass(GRADE_SHADER); composer.addPass(gradePass);
}
function applyQuality() {
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, QUALITY.level === 'high' ? 2 : QUALITY.level === 'balanced' ? 1.5 : 1));
  const ms = QUALITY.level === 'high' ? 2048 : QUALITY.level === 'balanced' ? 2048 : 1024;
  if (typeof sun !== 'undefined' && sun.shadow.mapSize.x !== ms) { sun.shadow.mapSize.set(ms, ms); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
  setupComposer(); resize();
}
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  kcam.aspect = w / h; kcam.updateProjectionMatrix();
  if (typeof KEEPV !== 'undefined' && VIEW.mode === 'keep') frameKeep(false);
  if (composer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); }
  if (lensPass) lensPass.uniforms.uRes.value.set(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
}

// ----------------------------------------------------------------- assets
const IMG = {};
function loadAssets() {
  return Promise.all(Object.entries(ASSETS).map(([k, src]) => new Promise(res => {
    const im = new Image(); im.onload = () => { IMG[k] = im; res(); }; im.onerror = () => res(); im.src = src;
  })));
}
const TEX = {};
function tex(key, { srgb = true, repeat = true } = {}) {
  if (TEX[key]) return TEX[key];
  const t = new THREE.Texture(IMG[key]); t.needsUpdate = true;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return TEX[key] = t;
}
// cut-out art: spread the colour of opaque pixels into the transparent ones so mipmaps don't go dark
function bleedTex(key) {
  if (TEX['bleed:' + key]) return TEX['bleed:' + key];
  const im = IMG[key], c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const g = c.getContext('2d'); g.drawImage(im, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height), a = d.data, W = c.width, H = c.height;
  let r = 0, gg = 0, b = 0, n = 0;
  for (let i = 0; i < a.length; i += 4) if (a[i + 3] > 128) { r += a[i]; gg += a[i + 1]; b += a[i + 2]; n++; }
  r /= n; gg /= n; b /= n;
  // a few passes of dilation, then the average for the rest
  const src = new Uint8ClampedArray(a);
  for (let pass = 0; pass < 6; pass++) {
    const cur = new Uint8ClampedArray(a);
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = (y * W + x) * 4; if (cur[i + 3] > 8 || src[i + 3] > 8) continue;
      let sr = 0, sg = 0, sb = 0, k = 0;
      for (const o of [-4, 4, -W * 4, W * 4]) { const j = i + o; if (cur[j + 3] > 8) { sr += cur[j]; sg += cur[j + 1]; sb += cur[j + 2]; k++; } }
      if (k) { a[i] = sr / k; a[i + 1] = sg / k; a[i + 2] = sb / k; a[i + 3] = 9; }
    }
  }
  for (let i = 0; i < a.length; i += 4) { if (src[i + 3] <= 8) { if (a[i + 3] !== 9) { a[i] = r; a[i + 1] = gg; a[i + 2] = b; } a[i + 3] = src[i + 3]; } }
  g.putImageData(d, 0, 0);
  return TEX['bleed:' + key] = canvasTex(c);
}
function canvasTex(cv, { srgb = true, repeat = false, nearest = false } = {}) {
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (nearest) { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; }
  else t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return t;
}

// ----------------------------------------------------------------- the plateau's outline
// Superellipse mesa, cut flat on the south (+z) side where the claim's quarry face is.
const WORLD = { a: 47, b: 40, faceZ: 36, X0: -48, WX: 96, Z0: -41, WZ: 78, gridX0: -48, gridZ0: -41, GX: 96, GZ: 78 };
function rimScale(ang) { return 1 + (fbm(Math.cos(ang) * 1.6 + 7, Math.sin(ang) * 1.6 + 3, 3) - 0.5) * 0.12; }
function buildOutline() {
  const N = 420, pts = [];
  for (let i = 0; i < N; i++) {
    const t = i / N * TAU, c = Math.cos(t), s = Math.sin(t), k = rimScale(t);
    pts.push([WORLD.a * Math.sign(c) * Math.pow(Math.abs(c), 0.5) * k, WORLD.b * Math.sign(s) * Math.pow(Math.abs(s), 0.5) * k]);
  }
  const inside = pts.map(p => p[1] < WORLD.faceZ);
  // the cut region straddles i ≈ N/4 (south). find its ends.
  let cs = Math.floor(N / 4), ce = cs;
  while (!inside[(cs - 1 + N) % N]) cs--;
  while (!inside[(ce + 1) % N]) ce++;
  const lerpZ = (p, q) => { const t = (WORLD.faceZ - p[1]) / (q[1] - p[1]); return [p[0] + (q[0] - p[0]) * t, WORLD.faceZ]; };
  const west = lerpZ(pts[(ce + 1) % N], pts[ce]), east = lerpZ(pts[(cs - 1 + N) % N], pts[cs]);
  const out = [west];
  for (let i = ce + 1; i < ce + 1 + N; i++) { const j = i % N; if (j === cs) break; out.push(pts[j]); }
  out.push(east);
  return out;   // west corner → north → east corner (clockwise seen from above, +z south)
}
const OUTLINE = buildOutline();
function pointInPoly(x, z, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if (((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / (zj - zi) + xi)) c = !c;
  }
  return c;
}
function distToOutline(x, z) {
  let d = 1e9;
  for (let i = 0; i < OUTLINE.length - 1; i++) {
    const [ax, az] = OUTLINE[i], [bx, bz] = OUTLINE[i + 1], vx = bx - ax, vz = bz - az, t = clamp(((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz), 0, 1);
    d = Math.min(d, Math.hypot(x - ax - vx * t, z - az - vz * t));
  }
  return Math.min(d, WORLD.faceZ - z);
}
const onPlateau = (x, z) => z < WORLD.faceZ && pointInPoly(x, z, OUTLINE);
// an inset loop for the wall: offset the outline inward
function insetOutline(d) {
  const P = OUTLINE, out = [];
  for (let i = 0; i < P.length; i++) {
    const a = P[Math.max(0, i - 2)], b = P[Math.min(P.length - 1, i + 2)];
    let tx = b[0] - a[0], tz = b[1] - a[1]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    // outline runs clockwise (seen from above), inward is to the right of travel → (−tz, tx)… check against centre
    let nx = -tz, nz = tx; if ((P[i][0] + nx) ** 2 + (P[i][1] + nz) ** 2 > P[i][0] ** 2 + P[i][1] ** 2) { nx = -nx; nz = -nz; }
    out.push([P[i][0] + nx * d, Math.min(P[i][1] + nz * d, WORLD.faceZ - d * 0.6)]);
  }
  return out;
}

// ----------------------------------------------------------------- mine openings in the face
const MINE = {
  depth: 4.6,
  shaft: { x0: 26.6, x1: 30.4 },
  g1: { x0: 5.5, x1: 30.4, y0: -9, y1: -4.9 },
  g2: { x0: -15, x1: 30.4, y0: -21, y1: -16.4 },
  shaftTop: -0.9,
  walkZ: WORLD.faceZ - 1.5,
};
// one simple polygon covering shaft + both galleries (x, y)
function minePolygon() {
  const { shaft: S, g1, g2, shaftTop } = MINE;
  return [[S.x0, shaftTop], [S.x1, shaftTop], [S.x1, g2.y0], [g2.x0, g2.y0], [g2.x0, g2.y1], [S.x0, g2.y1], [S.x0, g1.y0], [g1.x0, g1.y0], [g1.x0, g1.y1], [S.x0, g1.y1]];
}
