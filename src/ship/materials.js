// materials.js: the ships' materials, from the painted pieces cut out of Chris's Brig pictures (tools/ship-art.mjs).
// Each painting also gives a little relief (from its light and shade), and the parts sheet says where it is
// brass (shiny), wood (matte) or lamplight (glowing), so the painted brass catches the sunset.
import * as THREE from 'three';
import planksUrl from '../../assets/ships/planks.webp';
import platesUrl from '../../assets/ships/plates.webp';
import deckUrl from '../../assets/ships/deck.webp';
import bandUrl from '../../assets/ships/band.webp';
import partsUrl from '../../assets/ships/parts.webp';
import partsInfo from '../../assets/ships/parts.json';

const loadImage = (url) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = url; });

function pixels(img) {
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
  return g.getImageData(0, 0, c.width, c.height);
}
const toTexture = (data, w, h, srgb, repeat, aniso) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  c.getContext('2d').putImageData(new ImageData(data, w, h), 0, 0);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
};

// Relief from the painting's light and shade: brighter reads as raised
function normalFrom(id, strength, wrap) {
  const { data, width: w, height: h } = id, out = new Uint8ClampedArray(w * h * 4), L = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) L[i] = (data[i * 4] * 0.3 + data[i * 4 + 1] * 0.59 + data[i * 4 + 2] * 0.11) / 255 * (data[i * 4 + 3] / 255);
  const at = (x, y) => {
    if (wrap) { x = (x + w) % w; y = (y + h) % h; } else { x = Math.min(w - 1, Math.max(0, x)); y = Math.min(h - 1, Math.max(0, y)); }
    return L[y * w + x];
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (at(x - 1, y) - at(x + 1, y)) * strength, dy = (at(x, y + 1) - at(x, y - 1)) * strength, len = Math.hypot(dx, dy, 1), o = (y * w + x) * 4;
    out[o] = (dx / len * 0.5 + 0.5) * 255; out[o + 1] = (dy / len * 0.5 + 0.5) * 255; out[o + 2] = (1 / len * 0.5 + 0.5) * 255; out[o + 3] = 255;
  }
  return out;
}

// Where the painting is brass, wood or glowing: roughness in green, metalness in blue (three.js's packing),
// and a glow picture that keeps only the lamplight
function surfaceFrom(id) {
  const { data, width: w, height: h } = id, orm = new Uint8ClampedArray(w * h * 4), glow = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 4] / 255, g = data[i * 4 + 1] / 255, b = data[i * 4 + 2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx ? (mx - mn) / mx : 0;
    let hue = 0;
    if (mx > mn) hue = mx === r ? ((g - b) / (mx - mn)) * 60 : mx === g ? (2 + (b - r) / (mx - mn)) * 60 : (4 + (r - g) / (mx - mn)) * 60;
    if (hue < 0) hue += 360;
    const lit = mx > 0.88 && sat > 0.5 && hue > 18 && hue < 58 && g > 0.55;
    const brass = !lit && hue > 28 && hue < 58 && sat > 0.38 && mx > 0.34;
    const metal = brass ? Math.min(1, (sat - 0.3) * 3) * 0.95 : 0;
    orm[i * 4] = 255; orm[i * 4 + 1] = (brass ? 0.34 : lit ? 0.3 : 0.82) * 255; orm[i * 4 + 2] = metal * 255; orm[i * 4 + 3] = 255;
    const k = lit ? Math.min(1, (mx - 0.82) * 6) : 0;
    glow[i * 4] = data[i * 4] * k; glow[i * 4 + 1] = data[i * 4 + 1] * k; glow[i * 4 + 2] = data[i * 4 + 2] * k; glow[i * 4 + 3] = 255;
  }
  return { orm, glow };
}

export async function loadShipArt(renderer) {
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const [planks, deck, band, parts, plates] = await Promise.all([planksUrl, deckUrl, bandUrl, partsUrl, platesUrl].map(loadImage));
  const P = pixels(planks), D = pixels(deck), B = pixels(band), Q = pixels(parts), A = pixels(plates);
  const tex = (img, srgb = true, repeat = false) => { const t = new THREE.Texture(img); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.needsUpdate = true; return t; };
  const bandSurf = surfaceFrom(B), partSurf = surfaceFrom(Q);
  const T = {
    planks: tex(planks, true, true), planksN: toTexture(normalFrom(P, 4, true), P.width, P.height, false, true, aniso),
    plates: tex(plates, true, true), platesN: toTexture(normalFrom(A, 5, true), A.width, A.height, false, true, aniso),
    deck: tex(deck, true, true), deckN: toTexture(normalFrom(D, 3, true), D.width, D.height, false, true, aniso),
    band: tex(band, true, true), bandN: toTexture(normalFrom(B, 5, false), B.width, B.height, false, true, aniso),
    bandORM: toTexture(bandSurf.orm, B.width, B.height, false, true, aniso),
    parts: tex(parts), partsN: toTexture(normalFrom(Q, 3, false), Q.width, Q.height, false, false, aniso),
    partsORM: toTexture(partSurf.orm, Q.width, Q.height, false, false, aniso),
    partsGlow: toTexture(partSurf.glow, Q.width, Q.height, true, false, aniso),
  };
  const std = (o) => new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, ...o });
  const M = {
    hull: std({ map: T.planks, normalMap: T.planksN, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.8, emissive: 0xffffff, emissiveMap: T.planks, emissiveIntensity: 0.07 }),
    // the Man-o'-war's armour: dark iron plates, a little shiny
    plates: std({ map: T.plates, color: 0xc8c8cc, normalMap: T.platesN, normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.6, metalness: 0.25, emissive: 0xffffff, emissiveMap: T.plates, emissiveIntensity: 0.14 }),
    deck: std({ map: T.deck, normalMap: T.deckN, normalScale: new THREE.Vector2(0.7, 0.7), roughness: 0.82, emissive: 0xffffff, emissiveMap: T.deck, emissiveIntensity: 0.07 }),
    band: std({ map: T.band, normalMap: T.bandN, metalnessMap: T.bandORM, roughnessMap: T.bandORM, metalness: 1, roughness: 1, emissive: 0xffffff, emissiveMap: T.band, emissiveIntensity: 0.05 }),
    brass: std({ color: 0xd9a743, metalness: 0.92, roughness: 0.3 }),
    bronze: std({ color: 0xa06a2e, metalness: 0.82, roughness: 0.4 }),
    wood: std({ map: T.deck, color: 0xc49a74, normalMap: T.deckN, roughness: 0.78, emissive: 0xffffff, emissiveMap: T.deck, emissiveIntensity: 0.05 }),
    rope: std({ color: 0x5e432a, roughness: 0.95 }),
    dark: std({ color: 0x140b06, roughness: 1 }),
    canvas: std({ map: T.parts, roughness: 0.9, emissive: 0xfff2dc, emissiveMap: T.parts, emissiveIntensity: 0.16 }),
    parts: std({ map: T.parts, alphaTest: 0.45, normalMap: T.partsN, normalScale: new THREE.Vector2(0.6, 0.6), metalnessMap: T.partsORM, roughnessMap: T.partsORM, metalness: 1, roughness: 1,
      emissive: 0xffffff, emissiveMap: T.partsGlow, emissiveIntensity: 1.6 }),
    crystal: std({ color: 0xffa23a, vertexColors: true, emissive: 0xff6a00, emissiveIntensity: 1.1, roughness: 0.18, metalness: 0.05, flatShading: true }),
    // the sunstone crystals wear the painted crystal from the parts picture, lit from within
    gem: std({ map: T.parts, emissive: 0xffffff, emissiveMap: T.parts, emissiveIntensity: 0.55, roughness: 0.15, metalness: 0.0, flatShading: true }),
    // pennants: the Captain's plum with a gold hoist, streaming from every mast top
    flag: std({ vertexColors: true, roughness: 0.85, emissive: 0x2a0a20, emissiveIntensity: 0.4 }),
  };
  // the sails ripple a little in the wind
  M.canvas.userData.time = { value: 0 };
  M.canvas.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = M.canvas.userData.time;
    sh.vertexShader = 'attribute float billow;\nuniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\ntransformed += normal * billow * (sin(uTime * 2.3 + position.x * 0.9 + position.y * 0.6) * 0.05 + sin(uTime * 3.7 + position.z * 1.3) * 0.025);');
  };
  M.canvas.customProgramCacheKey = () => 'sail-ripple';
  M.flag.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = M.canvas.userData.time;
    sh.vertexShader = 'attribute float billow;\nuniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\ntransformed.x += billow * (sin(uTime * 5.5 - billow * 9.0) * 0.32 + sin(uTime * 3.1 - billow * 5.0) * 0.12);\ntransformed.y -= billow * billow * 0.35;');
  };
  M.flag.customProgramCacheKey = () => 'pennant';
  return { T, M, rects: partsInfo.rects };
}
