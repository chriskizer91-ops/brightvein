// world.js: Aethermoor to fly over. Chris's map (nine tiles, 5 m to a pixel, 23 km across) lies flat far below as the
// ground, the open sea runs on past its edges, a broken deck of cloud floats between, and big clouds drift at the
// ship's height. The sky is late afternoon with the sun low in the west. A wreck falling through the cloud deck tears
// a hole in it (tear), which closes again over a few seconds (update).
// The sky's look (its colours, the sun, how cloudy it is, the light) is a LOOK, kept in uniforms that every shader
// drawing it shares (setLook): the voyages keep DAY, the late afternoon exactly as it has always been; the title screen
// has a sunset of its own (title.js), with rays fanning out of the low sun. The weather (sky.js) is kept in the same
// shared uniforms: a storm showing dark on one side of the sky before it comes, a lightning flash, the mist inside a
// cloud, the ship's shadow on the cloud floor with the glory round it; and towering clouds stand round the horizon.
// The cloud pattern is also worked out in JavaScript (coverAt), exactly as it's baked, so the game knows where the
// cloud floor is thick enough to hide a ship; and makePuffs knows where its big clouds are (inside). How much of a
// point the clouds really hide as they're drawn, seen from the camera (the big clouds' pictures in front of it, the
// cloud floor between, the haze), is worked out too (veil), so a raider is lost in cloud only while she's hidden.
import * as THREE from 'three';
import tile1 from '../../assets/map/tile-1.avif';
import tile2 from '../../assets/map/tile-2.avif';
import tile3 from '../../assets/map/tile-3.avif';
import tile4 from '../../assets/map/tile-4.avif';
import tile5 from '../../assets/map/tile-5.avif';
import tile6 from '../../assets/map/tile-6.avif';
import tile7 from '../../assets/map/tile-7.avif';
import tile8 from '../../assets/map/tile-8.avif';
import tile9 from '../../assets/map/tile-9.avif';

export const MAP = { w: 23040, h: 15360, px: 5 }; // metres; x runs east, z runs south, the map's centre at the origin
export const SUN = new THREE.Vector3(-0.55, 0.52, 0.25).normalize(); // (where the sun is: set by the look, setLook)
export const CLOUD_Y = 430, THINNING = 2400;
// Brightvein on the map: a high plateau in the Ironspire Peaks, north-east of the Hearthsea
export const HOME = { x: 6900, z: -3100, name: 'Brightvein' };

// The regions, a 12 x 8 grid over the map read off Chris's painting (names from the Magpie page)
const GRID = ['sssswwsppppp', 'sssswwhppppp', 'swwwwhhppppp', 'swwwwhhppkks', 'sggwwhhkkkks', 'sggwwfhkkkks', 'sswfffkkkkss', 'ssssssssssss'];
const NAMES = { s: 'The Open Sea', w: 'The Verdant Wilds', g: 'The Gloamwood', f: 'The Gloomfen', h: 'The Hearthsea', p: 'The Ironspire Peaks', k: 'The Sunscorch Wastes' };
// each region's letter on the grid, by its name (the lands flown over, kept in the save: progress.js LANDS, deeds.js)
export const LAND_OF = Object.fromEntries(Object.entries(NAMES).map(([k, name]) => [name, k]));
// each region's name and the middle of its cells on the map (0 to 1 across and down), for the big map's labels
export const REGIONS = Object.entries(NAMES).filter(([k]) => k !== 's').map(([k, name]) => {
  let u = 0, v = 0, n = 0;
  GRID.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === k) { u += (c + 0.5) / 12; v += (r + 0.5) / 8; n++; } }));
  return { name, u: u / n, v: v / n };
});
export function regionAt(x, z) {
  const c = Math.floor((x / MAP.w + 0.5) * 12), r = Math.floor((z / MAP.h + 0.5) * 8);
  if (c < 0 || c > 11 || r < 0 || r > 7) return NAMES.s;
  return NAMES[GRID[r][c]];
}

// ---------- the look of the sky ----------
// A look: where the sun is; the sky's colours (overhead, halfway up, at the horizon, warm round the sun, the sun itself,
// and under the horizon); rays fanning out of the sun (0: none); the cloud deck's colours (lit, shaded, seen from
// under it) and the big clouds' (lit, shaded); how much cloud there is (0 as ever, more above 0); a tint on the ground
// (1: as Chris painted it); and the lights that go with it: the haze (its colour, where it starts and is thickest),
// the sun's light, the sky's (overhead and from the ground) and the sky's light on the brass. Lights and haze are
// written as colours are in CSS, and turned into the numbers the lights take once (look)
const lin = (hex) => new THREE.Color(hex).toArray();
const look = (o) => { for (const k of ['fog', 'light', 'hemiSky', 'hemiGround']) if (typeof o[k] === 'number') o[k] = lin(o[k]); return o; };
export const DAY = look({
  sun: [-0.55, 0.52, 0.25], zen: [0.13, 0.3, 0.66], mid: [0.36, 0.58, 0.88], hor: [0.84, 0.88, 0.93], warm: [1.0, 0.86, 0.66], sunCol: [1.0, 0.92, 0.75], below: [0.78, 0.84, 0.92], rays: 0,
  deckLit: [1.0, 0.97, 0.92], deckShade: [0.74, 0.77, 0.86], deckUnder: [0.62, 0.65, 0.72], puffLit: [1.06, 1.06, 1.06], puffShade: [0.82, 0.82, 0.82], cover: 0, ground: [1, 1, 1],
  fog: 0xc9d6e6, fogNear: 4000, fogFar: 34000, light: 0xfff0d6, lightI: 2.6, hemiSky: 0xc3dcff, hemiGround: 0x7c8a5c, hemiI: 0.75, env: 0.9,
});
// the title screen's sunset: the sun just over the horizon in the west-south-west, the sky burning orange into violet,
// the clouds peach and gold-edged, the ground in warm shadow
export const SUNSET = look({
  sun: [-0.69, 0.1, 0.32], zen: [0.1, 0.14, 0.34], mid: [0.55, 0.38, 0.5], hor: [1.0, 0.58, 0.32], warm: [1.0, 0.45, 0.18], sunCol: [1.0, 0.62, 0.32], below: [0.45, 0.32, 0.36], rays: 1,
  deckLit: [0.96, 0.52, 0.34], deckShade: [0.42, 0.27, 0.38], deckUnder: [0.3, 0.22, 0.3], puffLit: [1.08, 0.64, 0.46], puffShade: [0.42, 0.29, 0.4], cover: -0.06, ground: [0.72, 0.54, 0.5],
  fog: 0xb27a68, fogNear: 3000, fogFar: 30000, light: 0xffa060, lightI: 2.2, hemiSky: 0xffa888, hemiGround: 0x3a2a30, hemiI: 0.55, env: 0.6,
});
// and in the Maelstrom's skies: storm cloud rolling in over the sunset, darker and heavier
export const STORMY = look({
  sun: [-0.69, 0.1, 0.32], zen: [0.06, 0.06, 0.11], mid: [0.26, 0.2, 0.27], hor: [0.66, 0.36, 0.24], warm: [0.82, 0.32, 0.13], sunCol: [0.86, 0.42, 0.22], below: [0.26, 0.2, 0.24], rays: 0.45,
  deckLit: [0.17, 0.11, 0.11], deckShade: [0.045, 0.04, 0.06], deckUnder: [0.04, 0.035, 0.05], puffLit: [0.34, 0.21, 0.19], puffShade: [0.07, 0.06, 0.09], cover: 0.1, ground: [0.42, 0.35, 0.36],
  fog: 0x4a3440, fogNear: 2000, fogFar: 22000, light: 0xff7a44, lightI: 1.3, hemiSky: 0x8a6878, hemiGround: 0x201820, hemiI: 0.42, env: 0.35,
});
// a storm over the voyages (sky.js): thick slate cloud, the sun hidden behind it, the light dim and cold, the haze
// closing in. The late afternoon's sun stays where it is; only the storm darkens it
export const STORM = look({
  sun: DAY.sun, zen: [0.16, 0.18, 0.22], mid: [0.26, 0.28, 0.32], hor: [0.42, 0.44, 0.47], warm: [0.48, 0.47, 0.47], sunCol: [0.12, 0.12, 0.13], below: [0.3, 0.32, 0.35], rays: 0,
  deckLit: [0.25, 0.27, 0.31], deckShade: [0.1, 0.11, 0.13], deckUnder: [0.1, 0.11, 0.13], puffLit: [0.33, 0.35, 0.4], puffShade: [0.1, 0.11, 0.13], cover: 0.12, ground: [0.32, 0.35, 0.4],
  fog: 0x4a505a, fogNear: 1500, fogFar: 16000, light: 0xb0b8c8, lightI: 0.9, hemiSky: 0x707c8c, hemiGround: 0x282c28, hemiI: 0.55, env: 0.4,
});
// each region's air: what it changes of the afternoon (its haze's colour, how far off it starts and is thickest, the
// sun's light and how strong, the sky's light from above and below, the horizon and the sky overhead, the cloud), the
// motes in it (weather.js AIR: dust, snow or pale motes), and its line under the region's name. sky.js blends a little
// of it in (AIR_SHARE), over a few seconds, as you cross into the region
export const AIR_SHARE = 0.35;
export const REGION_AIR = {
  'The Sunscorch Wastes': { air: 'dust', line: 'Hot, dusty air', fog: 0xe6c9a0, near: 0.6, far: 0.6, light: 0xffe2b8, hor: [0.96, 0.86, 0.7], cover: -0.05, ground: [1.06, 0.98, 0.88] },
  'The Ironspire Peaks': { air: 'snow', line: 'Cold, clear air, and snow on the wind', fog: 0xc8dcfa, far: 1.2, light: 0xf0f4ff, hemiSky: 0xb8d4ff, hor: [0.8, 0.88, 0.98], zen: [0.08, 0.24, 0.66], ground: [0.94, 0.97, 1.04] },
  'The Gloomfen': { air: 'motes', line: 'Low, damp mist', fog: 0xa9b5a2, near: 0.45, far: 0.55, light: 0xe6efd8, hor: [0.74, 0.8, 0.74], cover: 0.08, ground: [0.9, 0.96, 0.9] },
  'The Gloamwood': { line: 'Dusky, violet air', fog: 0xb4a9c9, far: 0.8, lightK: 0.9, hemiSky: 0xc4b4e4, hor: [0.82, 0.78, 0.92], ground: [0.94, 0.9, 1.0] },
  'The Hearthsea': { line: 'Clear, bright air over the water', near: 1.2, far: 1.2, cover: -0.06, lightK: 1.05 },
  'The Verdant Wilds': { line: 'Soft, green air over the forest', hemiGround: 0x5c8c4c, hor: [0.84, 0.9, 0.88], ground: [0.96, 1.03, 0.96] },
  'The Open Sea': { line: 'Deep blue sky and a fresh wind', fog: 0xb5c9e6, zen: [0.09, 0.25, 0.66], mid: [0.3, 0.54, 0.88] },
};
// (each region's whole look: the afternoon with its air's changes, made once)
export const REGION_LOOK = Object.fromEntries(Object.entries(REGION_AIR).map(([name, A]) => {
  const L = JSON.parse(JSON.stringify(DAY));
  for (const k of ['fog', 'light', 'hemiSky', 'hemiGround']) if (A[k] !== undefined) L[k] = lin(A[k]);
  for (const k of ['hor', 'zen', 'mid', 'ground']) if (A[k]) L[k] = A[k];
  L.fogNear *= A.near ?? 1; L.fogFar *= A.far ?? 1; L.lightI *= A.lightK ?? 1; L.cover += A.cover ?? 0;
  return [name, L];
}));
// a look part way from a to b (k: 0 to 1), written into `out` (made once, and kept)
export function mixLook(a, b, k, out = {}) {
  for (const key in a) {
    const x = a[key], y = b[key];
    if (typeof x === 'number') out[key] = x + (y - x) * k;
    else { const o = (out[key] ??= [0, 0, 0]); for (let i = 0; i < 3; i++) o[i] = x[i] + (y[i] - x[i]) * k; }
  }
  return out;
}
// the look's uniforms, shared by the sky, the cloud deck, the big clouds and the ground's cloud shadows
const V = (a) => new THREE.Vector3(...a);
const MOOD = {
  uZen: { value: V(DAY.zen) }, uMid: { value: V(DAY.mid) }, uHor: { value: V(DAY.hor) }, uWarm: { value: V(DAY.warm) }, uSunCol: { value: V(DAY.sunCol) }, uBelow: { value: V(DAY.below) },
  uRays: { value: 0 }, uDeckLit: { value: V(DAY.deckLit) }, uDeckShade: { value: V(DAY.deckShade) }, uDeckUnder: { value: V(DAY.deckUnder) },
  uPuffLit: { value: V(DAY.puffLit) }, uPuffShade: { value: V(DAY.puffShade) }, uCover: { value: 0 }, uDrift: { value: new THREE.Vector2() },
  // the weather (sky.js): a storm on its way, dark on the side it comes from (uFront 0 to 1, uStormDir the way it comes
  // from, along the ground) in its slate colour; a lightning flash (uFlash, brightest towards uFlashDir); the mist inside
  // a cloud (uMist, in uMistCol); the ship's shadow on the cloud floor and the glory round it (uGlory; uShip where she
  // is, uShipH her height, heading and length); the sea glittering (uGlitter) and the towering clouds round the
  // horizon (uTowers), both turned off for the Settings card's Smooth picture
  uFront: { value: 0 }, uStormDir: { value: new THREE.Vector2(1, 0) }, uStormCol: { value: V([0.3, 0.32, 0.37]) },
  uFlash: { value: 0 }, uFlashDir: { value: new THREE.Vector2(1, 0) }, uMist: { value: 0 }, uMistCol: { value: V([0.86, 0.87, 0.9]) }, uMistSky: { value: V([0.93, 0.93, 0.95]) },
  uGlory: { value: 0 }, uShip: { value: new THREE.Vector3() }, uShipH: { value: new THREE.Vector3(0, 0, 30) }, uGlitter: { value: 1 }, uTowers: { value: 1 },
  uBillows: { value: new THREE.Vector2(11, 29) }, // (how many big and middling billows a storm's wall has round the sky: billowsFor)
};
// a storm's wall sized to the view (`across`: how wide the view is, in degrees): 11 big billows round the sky on a laptop
// or a phone held sideways, more on a narrower view (17 on a phone held upright), so a few always show across it
export function billowsFor(across) {
  const nb = Math.round(11 * Math.min(1.6, Math.max(1, Math.sqrt(80 / Math.max(1, across)))));
  MOOD.uBillows.value.set(nb, Math.round(nb * 2.6));
}
// each colour of a look and the uniform it goes to (paired once: setLook runs every frame while the title's skies blend)
const MOOD_KEYS = ['zen', 'mid', 'hor', 'warm', 'sunCol', 'below', 'deckLit', 'deckShade', 'deckUnder', 'puffLit', 'puffShade'].map((k) => [k, MOOD['u' + k[0].toUpperCase() + k.slice(1)]]);
// (a storm on its way darkens its side of the sky, most of all low down: uFront)
const SKY_GLSL = `
  uniform vec3 uZen; uniform vec3 uMid; uniform vec3 uHor; uniform vec3 uWarm; uniform float uFront; uniform vec2 uStormDir; uniform vec3 uStormCol;
  float stormSide(vec2 xz) { return uFront * smoothstep(0.0, 0.9, dot(xz, uStormDir) * inversesqrt(max(dot(xz, xz), 1e-6))); }
  vec3 skyColor(vec3 d, vec3 sun) {
    float h = d.y, s = max(dot(normalize(vec3(d.x, max(d.y, 0.0), d.z)), sun), 0.0);
    vec3 c = mix(uHor, uMid, smoothstep(0.0, 0.22, h));
    c = mix(c, uZen, smoothstep(0.2, 0.9, h));
    c = mix(c, uWarm, pow(s, 5.0) * 0.55 * (1.0 - smoothstep(0.0, 0.5, h)));
    c = mix(c, uStormCol, stormSide(d.xz) * (1.0 - 0.6 * smoothstep(0.05, 0.7, h)) * 0.85);
    return c;
  }`;
// the towering clouds standing round the horizon: their skyline (skyline(), made once) read with the direction round
// the sky, lit like the cloud floor on the sun's side and shaded away from it, darker at their feet, hazed into the
// sky a little; on a storm's side slate dark, behind the storm's own wall. (Only the bottom of the sky shows them)
// And a storm on its way (uFront, on its side of the sky): a wall of storm cloud over that horizon, billowing. Its top
// is heaped billows of four sizes (most about 9 degrees high, the tallest half as tall again, with smaller and smaller
// lumps riding on every crown, like a cauliflower's), each swelling and sinking slowly as the whole wall drifts along;
// a narrow view (a phone held upright) has more of the big ones round the sky (uBillows), so a single one never fills
// the screen like a hill. Each billow is lit on top and round its shoulder (warmer towards the sun) and falls into dark
// slate at its base, the creases between billows darker, with the cloud pattern churning upward in it and darker shafts
// of rain hanging from it, hazed a little into the sky at its foot. Towards the edges of the storm's side the billows
// drop out one by one (each by its own chance), so the wall ends in separate heaps, not a slope; and as the storm
// comes, they rise one by one. Its directions are measured round from the storm's own (so they start again only behind
// it, where it never shows: no seam), and worked out only on that side, low in the sky
const TOWERS_GLSL = `
  uniform float uTowers; uniform vec3 uDeckLit; uniform vec3 uDeckShade; uniform sampler2D uSkyline; uniform vec2 uBillows;
  // (a billow: a dome over cell floor(u) of n round the sky, as tall as its own chance says, swelling slowly; one towards
  // the storm's edge only there if its other chance is under how far into the storm's side its middle is)
  float billow(float u, float n, float drift, float t, float seed, float keep) {
    float c = floor(u), f = fract(u) * 2.0 - 1.0, h = fract(sin(mod(c, n) * 12.9898 + seed * 78.233) * 43758.5453);
    float g = 1.0;
    if (keep > 0.5) { float s = uFront * smoothstep(0.0, 0.9, cos(((c + 0.5) / n - drift) * 6.2832)), q = fract(h * 91.7 + 0.37) * 0.9; g = smoothstep(q, q + 0.08, smoothstep(0.0, 0.6, s)); }
    float f2 = f * f, f4 = f2 * f2; // (round-crowned, with a soft foot: no sheer drop at its edges)
    return pow(max(0.0, 1.0 - f2), 0.4) * (1.0 - f4 * f4) * (0.25 + 0.75 * h) * (0.8 + 0.2 * sin(t * 0.05 + h * 6.2832)) * g;
  }
  vec3 stormWall(vec3 d, vec3 c, vec3 sun, float t, float side) {
    float drift = t * 0.00028, A = atan(dot(d.xz, vec2(uStormDir.y, -uStormDir.x)), dot(d.xz, uStormDir)) * 0.159155 + drift, grow = smoothstep(0.0, 0.6, side);
    float nb = uBillows.x, nm = uBillows.y;
    float big = max(billow(A * nb, nb, drift, t, 1.0, 1.0), 0.8 * billow(A * nb + 0.5, nb, drift, t, 2.0, 1.0));
    float mid = max(billow(A * nm, nm, drift, t, 3.0, 1.0), 0.8 * billow(A * nm + 0.5, nm, drift, t, 4.0, 1.0));
    float edge = cloudAt(vec2(A * 3.0, 0.71));
    float top = 0.03 * grow + 0.16 * big + 0.045 * mid + 0.03 * (edge - 0.5) * grow;
    // (the lumps on every crown, finer and finer: on the wall only, not out in the sky)
    float on = smoothstep(0.01, 0.05, top);
    top += on * (0.02 * max(billow(A * 71.0, 71.0, 0.0, t, 5.0, 0.0), 0.8 * billow(A * 71.0 + 0.5, 71.0, 0.0, t, 6.0, 0.0))
      + 0.012 * max(billow(A * 163.0, 163.0, 0.0, t, 7.0, 0.0), 0.8 * billow(A * 163.0 + 0.5, 163.0, 0.0, t, 8.0, 0.0)));
    if (d.y > top + 0.01) return c;
    float k = clamp(d.y / max(top, 1e-3), 0.0, 1.0), y = d.y * 1.1 - t * 0.0006;
    // (the cloud pattern as heaped cloud: lit where it thins upward, shaded where it thickens)
    float n0 = cloudAt(vec2(A * 4.0, y)), n1 = cloudAt(vec2(A * 4.0, y + 0.01)), m = cloudAt(vec2(A * 11.0 + 0.4, y * 2.7));
    float heap = clamp(0.5 + (n0 - n1) * 7.0 + (m - 0.5) * 0.6, 0.0, 1.0);
    float lit = max(dot(normalize(d.xz), sun.xz) / max(length(sun.xz), 1e-3), 0.0);
    float rain = smoothstep(0.5, 0.78, cloudAt(vec2(A * 13.0, 0.31))) * (1.0 - smoothstep(0.05, 0.5, k));
    float shoulder = smoothstep(0.55, 0.97, k) * (0.55 + 0.45 * big);
    float shade = (0.05 + 0.6 * k * k + 0.4 * shoulder) * (0.4 + 0.95 * heap) * (0.6 + 0.4 * big) * (1.0 - 0.5 * rain);
    vec3 dark = uStormCol * 0.22, light = mix(uStormCol * 1.8, uDeckLit, 0.45 + 0.3 * lit);
    vec3 wc = mix(dark, light, clamp(shade, 0.0, 1.0));
    #ifdef SKY_SPACE
    wc = sqrt(wc);
    #endif
    wc = mix(wc, c, 0.15 * (1.0 - smoothstep(0.0, 0.25, k)));
    float inside = 1.0 - smoothstep(top - 0.005, top + 0.002, d.y + 0.008 * (m - 0.5));
    return mix(c, wc, inside * step(-0.03, d.y) * smoothstep(0.0, 0.3, side));
  }
  vec3 towers(vec3 d, vec3 c, vec3 sun, float t) {
    float side = stormSide(d.xz);
    vec2 sk = texture2D(uSkyline, vec2(atan(d.x, d.z) * 0.159155 + 0.5 + t * 0.0001, 0.5)).rg * 0.15;
    float top = 0.003 + sk.x;
    float k = (1.0 - smoothstep(top - 0.014, top + 0.002, d.y)) * step(-0.03, d.y) * uTowers;
    float lit = max(dot(d.xz, sun.xz), 0.0) / max(length(sun.xz), 1e-3);
    vec3 tc = mix(uDeckShade, uDeckLit, 0.25 + 0.75 * lit * lit) * (0.82 + 0.18 * smoothstep(-0.01, top, d.y));
    tc = mix(tc, uStormCol * 0.75, side);
    #ifdef SKY_SPACE
    tc = sqrt(tc); // (the cloud colours are light, as the cloud floor's; the sky is drawn as it's seen: near enough)
    #endif
    c = mix(c, mix(tc, c, 0.3), k);
    return side > 0.004 && d.y < 0.3 ? stormWall(d, c, sun, t, side) : c; // (its tallest billows reach 0.29 up)
  }`;
// the skyline, once round the sky (1,024 steps): each tower a dome, 36 round the sky, every other one set back and
// smaller, as tall as a blurred read of the cloud pattern says there, from low swells to towers 5 degrees high, with
// small domes riding on their shoulders. Red: how high they reach; green: the domes alone
function skyline() {
  const N = 1024, px = new Uint8Array(N * 4), blur = (u, v, w) => { let s = 0; for (let i = -3; i <= 3; i++) s += cloudPicture(u + (i * w) / 3, v); return s / 7; };
  const arch = (x) => { const c = (x - Math.floor(x)) * 2 - 1; return Math.sqrt(Math.max(0, 1 - c * c)); };
  const ss = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
  for (let i = 0; i < N; i++) {
    const u = (i / N) * 4 - 2, prof = ss(0.4, 0.62, blur(u * 0.5, 0.37, 0.03)), small = blur(u * 2, 0.61, 0.004);
    const D = Math.max(arch(u * 9), 0.7 * arch(u * 9 + 0.5)) * (0.012 + 0.075 * prof), E = 0.012 * arch(u * 31 + 0.2) * ss(0.35, 0.65, small) * prof;
    px[i * 4] = Math.round(Math.min(1, (D + E) / 0.15) * 255); px[i * 4 + 1] = Math.round(Math.min(1, D / 0.15) * 255); px[i * 4 + 3] = 255;
  }
  const t = new THREE.DataTexture(px, N, 1, THREE.RGBAFormat);
  t.wrapS = THREE.RepeatWrapping; t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
  return t;
}
export const HAZE = new THREE.Color(0xc9d6e6);

// the sky: its colours, the sun, the rays, the towering clouds round the horizon (they need the cloud picture and its
// clock), a lightning flash (brightest towards the strike, and up in the cloud), and the mist inside a cloud
function makeSky(uCloud, time) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uSun: { value: SUN }, uCloud, uTime: time, uSkyline: { value: skyline() }, ...MOOD },
    vertexShader: 'varying vec3 vDir; void main() { vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
    // (the rays: a fan of light and shade round the sun, lowest near the horizon; worked out only when there are any)
    fragmentShader: `varying vec3 vDir; uniform vec3 uSun; uniform vec3 uSunCol; uniform vec3 uBelow; uniform float uRays; uniform float uTime;
      uniform float uFlash; uniform vec2 uFlashDir; uniform float uMist; uniform vec3 uMistSky;
      #define SKY_SPACE
      ${SKY_GLSL} ${CLOUD_GLSL} ${TOWERS_GLSL}
      void main() { vec3 d = normalize(vDir);
        // (well under the horizon it's the colour under the horizon and no more, and the ground and the sea cover it
        // anyway: nothing more to work out there, most of the screen when looking down)
        if (d.y < -0.2) { gl_FragColor = vec4(mix(uBelow, uMistSky, uMist), 1.0); return; }
        float s = max(dot(d, uSun), 0.0);
        vec3 c = skyColor(d, uSun) + uSunCol * (pow(s, 120.0) * 0.9 + smoothstep(0.9993, 0.9996, s) * 4.0);
        if (uRays > 0.0) {
          vec3 t1 = normalize(cross(uSun, vec3(0.0, 1.0, 0.0))), t2 = cross(t1, uSun);
          float ang = atan(dot(d, t2), dot(d, t1));
          float fan = (0.5 + 0.5 * sin(ang * 17.0 + sin(ang * 5.0) * 2.0)) * (0.5 + 0.5 * sin(ang * 7.0 - 1.3));
          c += uSunCol * fan * pow(s, 5.0) * (1.0 - smoothstep(-0.05, 0.45, d.y)) * uRays * 0.45;
        }
        c = towers(d, c, uSun, uTime);
        c = mix(c, uBelow, smoothstep(0.0, -0.2, d.y));
        c += vec3(0.5, 0.52, 0.72) * uFlash * clamp(0.35 + d.y + 0.45 * dot(d.xz, uFlashDir), 0.0, 1.4);
        c = mix(c, uMistSky, uMist);
        gl_FragColor = vec4(c, 1.0); }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 20), mat);
  m.scale.setScalar(50000); m.frustumCulled = false; m.renderOrder = -10;
  return m;
}

// cloud shadows on the ground, and the deck of cloud itself, share one pattern so the shadows line up. The pattern
// (two layers of soft noise, each five octaves deep) is worked out once, on the graphics card, into a picture that
// repeats every 16 units (about 35 km), so each pixel of the ground and the deck reads it from the picture instead of
// working it out again: the deck and the ground used to work it out four times for every pixel, the biggest cost on a
// phone. The picture keeps 16 bits in two channels, so cloud edges stay smooth.
const CLOUD_P = 16, CLOUD_N = 1024, HOLES = 3;
// how the pattern lies on the world: its size (the pattern's units a metre) and how far it drifts each tick of the
// clouds' clock (shared by the shaders and coverAt, so the two can't drift apart)
export const COVER = { scale: 0.00045, dx: 0.0022, dz: 0.0009 };
const OCTAVES = Array.from({ length: 5 }, (_, k) => Math.round(CLOUD_P * Math.pow(2.07, k)));
// (uCover: more cloud above 0, the look's)
// (coverAt: with more cloud by `bias`; the JavaScript copy of it is coverAt below)
const CLOUD_GLSL = `
  uniform sampler2D uCloud; uniform float uCover;
  float cloudAt(vec2 uv) { return dot(texture2D(uCloud, uv).rg, vec2(255.0 * 256.0, 255.0) / 65535.0); }
  float coverAt(vec2 xz, float t, float bias) { vec2 p = xz * ${COVER.scale} + vec2(t * ${COVER.dx}, t * ${COVER.dz});
    return smoothstep(0.44 - bias, 0.64 - bias, cloudAt(p / ${CLOUD_P.toFixed(1)}) * 0.85 + cloudAt((p * 3.3 + 7.0) / ${CLOUD_P.toFixed(1)}) * 0.25); }
  float cover(vec2 xz, float t) { return coverAt(xz, t, uCover); }`;
// The same pattern in JavaScript, worked out exactly as the picture is baked (each step rounded to the graphics card's
// 32-bit numbers), so the game knows how thick the cloud floor is anywhere (sky.js): where a ship can hide in it.
// coverAt(x, z, t, bias) is the shaders' coverAt: 0 open sky, 1 thick cloud. About a microsecond each
const f32 = Math.fround, K1 = f32(0.1031), K2 = f32(33.33), K3 = f32(13.3);
const fr = (x) => f32(x - Math.floor(x));
function hash(x, y) {
  x = f32(x + 111); y = f32(y + 113);
  let qx = fr(f32(x * K1)), qy = fr(f32(y * K1)), qz = qx;
  const d = f32(f32(f32(qx * f32(qy + K2)) + f32(qy * f32(qz + K2))) + f32(qz * f32(qx + K2)));
  qx = f32(qx + d); qy = f32(qy + d); qz = f32(qz + d);
  return fr(f32(f32(qx + qy) * qz));
}
function lattice(qx, qy, n) {
  const ix = Math.floor(qx), iy = Math.floor(qy);
  let fx = f32(qx - ix), fy = f32(qy - iy);
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const ax = ((ix % n) + n) % n, ay = ((iy % n) + n) % n, bx = (ax + 1) % n, by = (ay + 1) % n;
  const a = hash(ax, ay), b = hash(bx, ay), c = hash(ax, by), d = hash(bx, by);
  return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy;
}
// the picture's value at (u, v), repeating every 1 each way
export function cloudPicture(u, v) {
  u -= Math.floor(u); v -= Math.floor(v);
  let s = 0, a = 0.5;
  for (let k = 0; k < 5; k++) { const n = OCTAVES[k]; s += a * lattice(f32(f32(u * n) + f32(K3 * k)), f32(f32(v * n) + f32(K3 * k)), n); a *= 0.5; }
  return Math.min(1, Math.max(0, s));
}
export function coverAt(x, z, t, bias = 0) {
  const px = x * COVER.scale + t * COVER.dx, pz = z * COVER.scale + t * COVER.dz;
  const v = cloudPicture(px / CLOUD_P, pz / CLOUD_P) * 0.85 + cloudPicture((px * 3.3 + 7) / CLOUD_P, (pz * 3.3 + 7) / CLOUD_P) * 0.25;
  const k = Math.min(1, Math.max(0, (v - (0.44 - bias)) / 0.2));
  return k * k * (3 - 2 * k);
}
// the pattern itself: value noise, octaves 2.07 times finer each, on lattices that wrap round so the picture tiles
function makeCloudBake(renderer) {
  const target = new THREE.WebGLRenderTarget(CLOUD_N, CLOUD_N, { format: THREE.RGFormat, type: THREE.UnsignedByteType, depthBuffer: false,
    wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping, magFilter: THREE.LinearFilter, minFilter: THREE.LinearMipmapLinearFilter, generateMipmaps: true });
  target.texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const cells = OCTAVES.map((n) => n.toFixed(1));
  const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `varying vec2 vUv;
      // (shifted to a part of the lattice whose values spread evenly, so the sky is exactly as cloudy as before)
      float h2(vec2 p) { p += vec2(111.0, 113.0); vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
      float n2(vec2 q, float n) { vec2 i = floor(q), f = fract(q); f = f * f * (3.0 - 2.0 * f);
        vec2 a = mod(i, n), b = mod(i + 1.0, n);
        return mix(mix(h2(a), h2(vec2(b.x, a.y)), f.x), mix(h2(vec2(a.x, b.y)), h2(b), f.x), f.y); }
      void main() {
        float N[5]; N[0] = ${cells[0]}; N[1] = ${cells[1]}; N[2] = ${cells[2]}; N[3] = ${cells[3]}; N[4] = ${cells[4]};
        float v = 0.0, a = 0.5;
        for (int k = 0; k < 5; k++) { v += a * n2(vUv * N[k] + 13.3 * float(k), N[k]); a *= 0.5; }
        float w = floor(clamp(v, 0.0, 1.0) * 65535.0 + 0.5), hi = floor(w / 256.0);
        gl_FragColor = vec4(hi / 255.0, (w - hi * 256.0) / 255.0, 0.0, 1.0);
      }`,
  }));
  quad.frustumCulled = false; scene.add(quad);
  // drawn at start-up, and again if the phone drops the drawing context (main.js)
  const bake = () => { const was = renderer.getRenderTarget(); renderer.setRenderTarget(target); renderer.render(scene, camera); renderer.setRenderTarget(was); };
  bake();
  return { target, texture: target.texture, bake };
}

function loadTexture(url, renderer) {
  return new Promise((res, rej) => new THREE.TextureLoader().load(url, (t) => {
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; res(t);
  }, undefined, rej));
}

export async function makeWorld(renderer) {
  const group = new THREE.Group();
  const time = { value: 0 };
  const clouds = makeCloudBake(renderer), uCloud = { value: clouds.texture };
  group.add(makeSky(uCloud, time));

  // the map: nine tiles, each 7.68 x 5.12 km, painted colours kept as Chris painted them, with cloud shadows passing over,
  // and the sun glittering on the water (where the painting is strongly blue: the land never does), a path of sparkles
  // where the sun's reflection would be, out of the clouds' shadows
  const urls = [tile1, tile2, tile3, tile4, tile5, tile6, tile7, tile8, tile9];
  const textures = await Promise.all(urls.map((u) => loadTexture(u, renderer)));
  const tw = MAP.w / 3, th = MAP.h / 3;
  // (the glitter: a soft path of light where the sun is mirrored, and in it soft round glints, one to a square 9 m
  // across, each set a little off its middle, swelling and fading at its own beat; they fade out where a square would
  // be under a few pixels across, so far off and looking down they never shimmer as a field of white specks)
  const GLITTER = `
    if (uGlitter > 0.0) {
      float px = length(fwidth(vWorld.xz)) / 9.0; // (how much ground a pixel spans, in glints: worked out here, where every pixel takes the same way, as some phones' graphics need it)
      float water = smoothstep(0.04, 0.16, diffuseColor.b - max(diffuseColor.r, diffuseColor.g * 0.85));
      if (water > 0.0) {
        vec3 v = normalize(vWorld - cameraPosition);
        float sp2 = pow(max(dot(reflect(v, vec3(0.0, 1.0, 0.0)), uSun), 0.0), 90.0);
        vec2 q = vWorld.xz / 9.0, cell = floor(q);
        float tw = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
        vec2 at = fract(q) - 0.5 - (vec2(fract(tw * 7.31), fract(tw * 3.17)) - 0.5) * 0.4;
        float beat = 0.5 + 0.5 * sin(uTime * (1.6 + 1.8 * tw) + tw * 40.0);
        float spark = smoothstep(0.55, 1.0, beat) * step(0.7, fract(tw * 13.7)) * (1.0 - smoothstep(0.08, 0.4, length(at))) * (1.0 - smoothstep(0.3, 0.65, px));
        diffuseColor.rgb += uSunCol * water * sp2 * (0.32 + 0.65 * spark) * (1.0 - cs) * uGlitter;
      }
    }`;
  const shade = (mat) => {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = time; sh.uniforms.uSun = { value: SUN }; sh.uniforms.uCloud = uCloud; sh.uniforms.uCover = MOOD.uCover; sh.uniforms.uSunCol = MOOD.uSunCol; sh.uniforms.uGlitter = MOOD.uGlitter;
      sh.vertexShader = 'varying vec3 vWorld;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = 'varying vec3 vWorld;\nuniform float uTime;\nuniform vec3 uSun;\nuniform vec3 uSunCol;\nuniform float uGlitter;\n' + CLOUD_GLSL + '\n' + sh.fragmentShader.replace('#include <map_fragment>',
        '#include <map_fragment>\nvec2 sp = vWorld.xz - uSun.xz / uSun.y * ' + CLOUD_Y.toFixed(1) + ';\nfloat cs = cover(sp, uTime);\ndiffuseColor.rgb *= 1.0 - 0.38 * cs;' + GLITTER);
    };
    mat.customProgramCacheKey = () => 'ground-cloud-shadow-5';
    return mat;
  };
  const ground = []; // (their materials, tinted by the look)
  textures.forEach((t, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(tw, th).rotateX(-Math.PI / 2), shade(new THREE.MeshBasicMaterial({ map: t, toneMapped: false })));
    m.position.set(-MAP.w / 2 + tw * (col + 0.5), 0, -MAP.h / 2 + th * (row + 0.5));
    group.add(m); ground.push(m.material);
  });
  // the open sea past the map's edges, the same deep blue as its painted sea. It's drawn first and the map over it:
  // laid just under the map instead, the two would flicker where the far ground is too far off to tell them apart
  const SEA = new THREE.Color(0x0a3b80);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(160000, 160000).rotateX(-Math.PI / 2), shade(new THREE.MeshBasicMaterial({ color: SEA, toneMapped: false, depthWrite: false })));
  sea.renderOrder = -5; group.add(sea);

  // the deck of cloud: white and gold-edged from above, grey from beneath, gaps where the ground shows through, and the
  // holes torn by wrecks falling through it (x, z, how wide, how open: 0 is closed, and then it costs nothing). A storm
  // on its way thickens it and turns it slate on that side, far off; a lightning flash lights it up. Seen from above,
  // the ship's shadow lies on it, cast along the sun (softer and wider the higher she flies), and round the point
  // straight away from the sun the glory shines on the cloud: rainbow rings 4 to 9 degrees across, with a faint white
  // cloud-bow 40 degrees out (uGlory: worked out only near that point). Inside a cloud, it fades into the mist
  const holes = Array.from({ length: HOLES }, () => new THREE.Vector4(0, 0, 1, 0)), torn = holes.map(() => ({ r: 1, age: 9 }));
  const deck = new THREE.Mesh(new THREE.PlaneGeometry(160000, 160000).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
    uniforms: { uTime: time, uSun: { value: SUN }, uCloud, uHoles: { value: holes }, ...MOOD },
    vertexShader: 'varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `varying vec3 vW; uniform float uTime; uniform vec3 uSun; uniform vec4 uHoles[${HOLES}]; uniform vec3 uDeckUnder;
      uniform float uFlash; uniform vec2 uFlashDir; uniform float uMist; uniform vec3 uMistCol; uniform float uGlory; uniform vec3 uShip; uniform vec3 uShipH; uniform vec3 uDeckLit; uniform vec3 uDeckShade;
      ${SKY_GLSL} ${CLOUD_GLSL}
      void main() {
        vec3 toCam = vW - cameraPosition; float d = length(toCam);
        float side = stormSide(toCam.xz) * smoothstep(1500.0, 9000.0, d);
        float c = coverAt(vW.xz, uTime, uCover + side * 0.14);
        for (int i = 0; i < ${HOLES}; i++) { vec4 h = uHoles[i]; if (h.w > 0.0) c *= 1.0 - h.w * (1.0 - smoothstep(h.z * 0.4, h.z, length(vW.xz - h.xy))); }
        vec3 col = uDeckUnder;
        if (cameraPosition.y > vW.y) {
          float lit = coverAt(vW.xz + uSun.xz * 160.0, uTime, uCover + side * 0.14);
          col = mix(mix(uDeckLit, uDeckShade, lit * 0.6), uStormCol, side * 0.8);
          if (uGlory > 0.0) {
            // her shadow: an oval along her heading, cast along the sun from her height
            float above = uShipH.x - vW.y;
            vec2 dv = vW.xz - (uShip.xz - uSun.xz / max(uSun.y, 0.08) * above);
            if (above > 0.0 && dot(dv, dv) < uShipH.z * uShipH.z * 0.5 + above * above * 0.0004) {
              vec2 fw = vec2(sin(uShipH.y), cos(uShipH.y));
              float al = dot(dv, fw) / (0.6 * uShipH.z), ac = dot(dv, vec2(fw.y, -fw.x)) / (0.2 * uShipH.z + above * 0.012);
              col *= 1.0 - 0.42 * uGlory * (1.0 - smoothstep(0.45, 1.2 + above * 0.002, al * al + ac * ac));
            }
            // (the angle from the point straight away from the sun, near enough: 57.3 x sqrt(2 (1 - cos)) degrees)
            float gd = 57.3 * sqrt(max(0.0, 2.0 - 2.0 * dot(toCam / d, -uSun)));
            vec3 ring = clamp(1.0 - abs(gd - vec3(6.2, 5.2, 4.3)), 0.0, 1.0) + vec3(0.4, 0.25, 0.45) * clamp(1.0 - abs(gd - 8.6), 0.0, 1.0) + vec3(0.6, 0.58, 0.54) * clamp(1.0 - gd / 3.2, 0.0, 1.0);
            col += (ring * 0.24 + clamp(1.0 - abs(gd - 40.0) * 0.25, 0.0, 1.0) * 0.06) * uGlory;
          }
        }
        col += vec3(0.75, 0.8, 1.0) * uFlash * clamp(0.4 + 0.6 * dot(toCam.xz, uFlashDir) / d, 0.0, 1.0) * 0.5;
        float fade = smoothstep(9000.0, 38000.0, d);
        if (fade > 0.0) col = mix(col, skyColor(normalize(vec3(toCam.x, 0.0, toCam.z)), uSun), fade); // (into the haze, the towering clouds rising out of it)
        float a = c * 0.94 * (1.0 - fade * 0.25);
        float m = uMist * smoothstep(10.0, 320.0, d); col = mix(col, uMistCol, m); a = mix(a, 1.0, m);
        gl_FragColor = vec4(col, a);
        #include <colorspace_fragment>
      }`,
  }));
  deck.position.y = CLOUD_Y; deck.renderOrder = 1; group.add(deck);

  // big drifting clouds at the ship's height, kept round the ship as it flies
  const puffs = makePuffs();
  group.add(puffs.mesh);

  // a hole torn in the deck at (x, z), `r` metres across at its widest: it opens in a moment, holds, and closes over
  // about five seconds (the oldest is reused for a fourth)
  function tear(x, z, r) {
    let k = 0;
    for (let i = 1; i < HOLES; i++) if (torn[i].age > torn[k].age) k = i;
    holes[k].set(x, z, r * 0.5, 0); torn[k].r = r; torn[k].age = 0;
  }
  function update(dt) {
    puffs.update(dt);
    for (let i = 0; i < HOLES; i++) {
      const t = (torn[i].age += dt), h = holes[i];
      h.w = t < 0.25 ? t / 0.25 : Math.min(1, Math.max(0, 1 - (t - 1.5) / 5));
      h.z = torn[i].r * (0.5 + 0.5 * Math.min(1, t / 0.8));
    }
  }
  // a fresh voyage (or back to port): every hole closed at once, so none is left open from the last fight
  function clear() { for (let i = 0; i < HOLES; i++) { holes[i].w = 0; torn[i].age = 9; } puffs.bank(null); puffs.update(9); }

  // the look (DAY, SUNSET or between): the sky, the clouds, the sun and the tint on the ground, and if they're given,
  // the lights and the haze (the sun's light, the sky's light, and the scene they're in)
  const tint = new THREE.Color(), now = mixLook(DAY, DAY, 0), back = {}; // (the look now, and one kept aside)
  let raysK = 1; // (the rays drawn: none on the Settings card's Smooth picture, quality)
  function setLook(L, lights) {
    if (L !== now) mixLook(L, L, 0, now);
    SUN.set(L.sun[0], L.sun[1], L.sun[2]).normalize();
    for (let i = 0; i < MOOD_KEYS.length; i++) { const m = MOOD_KEYS[i]; m[1].value.fromArray(L[m[0]]); }
    MOOD.uRays.value = L.rays * raysK; MOOD.uCover.value = L.cover;
    tint.fromArray(L.ground);
    for (const m of ground) m.color.copy(tint);
    sea.material.color.copy(SEA).multiply(tint);
    if (!lights) return;
    const { sun, hemi, scene } = lights;
    sun.color.fromArray(L.light); sun.intensity = L.lightI;
    hemi.color.fromArray(L.hemiSky); hemi.groundColor.fromArray(L.hemiGround); hemi.intensity = L.hemiI;
    scene.fog.color.fromArray(L.fog); scene.fog.near = L.fogNear; scene.fog.far = L.fogFar;
    scene.environmentIntensity = L.env;
  }
  // the sky's light on the brass in a look: a blurred picture of its sky (`size`: how fine), drawn once (and again if the
  // drawing context is lost). The sky is put back as it was
  const envScene = new THREE.Scene(); envScene.add(group.children[0].clone());
  function skyLight(L, size = 256) {
    mixLook(now, now, 0, back); setLook(L);
    const pmrem = new THREE.PMREMGenerator(renderer), t = pmrem.fromScene(envScene, 0.04, 1, 60000, { size }).texture;
    pmrem.dispose(); setLook(back);
    return t;
  }
  // the Settings card's picture: the sun's rays (the title's sunset), the sea's glitter and the towering clouds round
  // the horizon, each on or off (Smooth leaves them out)
  function quality({ rays = true, glitter = true, towers = true } = {}) {
    raysK = rays ? 1 : 0; MOOD.uRays.value = now.rays * raysK; MOOD.uGlitter.value = glitter ? 1 : 0; MOOD.uTowers.value = towers ? 1 : 0;
  }
  // (for the check: the cloud floor's thickness at these places, worked out by the graphics card from the baked picture
  // itself, at its finest, to hold coverAt to)
  let probe = null;
  function coverOnCard(points, t, bias = MOOD.uCover.value) {
    const n = points.length, side = Math.ceil(Math.sqrt(n));
    if (!probe || probe.side !== side) {
      probe?.target.dispose();
      const target = new THREE.WebGLRenderTarget(side, side, { depthBuffer: false });
      const mat = new THREE.ShaderMaterial({ depthTest: false, depthWrite: false,
        uniforms: { uCloud, uPts: { value: Array.from({ length: side * side }, () => new THREE.Vector2()) }, uT: { value: 0 }, uBias: { value: 0 } },
        vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: `uniform sampler2D uCloud; uniform vec2 uPts[${side * side}]; uniform float uT; uniform float uBias;
          float at0(vec2 uv) { return dot(textureLod(uCloud, uv, 0.0).rg, vec2(255.0 * 256.0, 255.0) / 65535.0); }
          void main() { int i = int(gl_FragCoord.y) * ${side} + int(gl_FragCoord.x); vec2 p = uPts[i] * ${COVER.scale} + vec2(uT * ${COVER.dx}, uT * ${COVER.dz});
            float c = smoothstep(0.44 - uBias, 0.64 - uBias, at0(p / ${CLOUD_P.toFixed(1)}) * 0.85 + at0((p * 3.3 + 7.0) / ${CLOUD_P.toFixed(1)}) * 0.25);
            gl_FragColor = vec4(c, c, c, 1.0); }` });
      const scene = new THREE.Scene(), quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); quad.frustumCulled = false; scene.add(quad);
      probe = { side, target, mat, scene, camera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1) };
    }
    points.forEach((p, i) => probe.mat.uniforms.uPts.value[i].set(p.x, p.z));
    probe.mat.uniforms.uT.value = t; probe.mat.uniforms.uBias.value = bias;
    const was = renderer.getRenderTarget(), px = new Uint8Array(side * side * 4);
    renderer.setRenderTarget(probe.target); renderer.render(probe.scene, probe.camera); renderer.setRenderTarget(was);
    renderer.readRenderTargetPixels(probe.target, 0, 0, side, side, px);
    return points.map((p, i) => px[i * 4] / 255);
  }
  // how much of point p the clouds hide as they're drawn, seen from `eye` (the camera's place) through `view` (a view
  // matrix looking from there; the camera's own, or one looking straight at p), and `fog` (the scene's haze): the cloud
  // floor if it lies between them (as thick as it's drawn there, holes torn in it and all, and the mist), the big
  // clouds in front of p (puffs.veil) and the haze. 0: nothing in the way, 1: wholly hidden
  const cross = new THREE.Vector3();
  function deckVeil(eye, p) {
    if ((eye.y - CLOUD_Y) * (p.y - CLOUD_Y) >= 0) return 0;
    cross.lerpVectors(eye, p, (CLOUD_Y - eye.y) / (p.y - eye.y));
    let c = coverAt(cross.x, cross.z, time.value, MOOD.uCover.value);
    for (let i = 0; i < HOLES; i++) { const h = holes[i]; if (h.w > 0) { const k = Math.min(1, Math.max(0, (Math.hypot(cross.x - h.x, cross.z - h.y) - h.z * 0.4) / (h.z * 0.6))); c *= 1 - h.w * (1 - k * k * (3 - 2 * k)); } }
    const d = cross.distanceTo(eye), m = MOOD.uMist.value * Math.min(1, Math.max(0, (d - 10) / 310));
    return c * 0.94 + (1 - c * 0.94) * m;
  }
  function veil(eye, p, view, fog) {
    const d = eye.distanceTo(p), h = fog ? Math.min(1, Math.max(0, (d - fog.near) / Math.max(1, fog.far - fog.near))) : 0, haze = h * h * (3 - 2 * h); // (as the haze is drawn: three.js Fog)
    return 1 - (1 - haze) * (1 - deckVeil(eye, p)) * (1 - puffs.veil(p, view));
  }
  // (coverAt: how thick the cloud floor is at (x, z) now, 0 to 1, with the look's cloud)
  return { group, time, puffs, deck, clouds, tear, update, clear, holes, setLook, skyLight, quality, mood: MOOD, ground, sea, uCloud, coverOnCard, veil, get look() { return now; }, get rays() { return raysK; },
    coverAt: (x, z, t = time.value, bias = MOOD.uCover.value) => coverAt(x, z, t, bias) };
}

// A soft cumulus picture drawn once, and instanced billboards of it
function cloudTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  let seed = 3; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 26; i++) {
    const x = 60 + rnd() * 136, y = 92 + rnd() * 90 - (i < 8 ? 30 : 0), r = 28 + rnd() * 44;
    const grd = g.createRadialGradient(x, y - r * 0.2, r * 0.1, x, y, r);
    const shade = 225 + Math.round(rnd() * 30);
    grd.addColorStop(0, `rgba(${shade},${shade},${Math.min(255, shade + 8)},0.85)`); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// The big clouds: 110 of them spread over a 14 km square kept round the ship (wrapping round as she flies), 520 to 2,020 m
// up, and before them a bank of six (BANK) that a wave of raiders can come out of, placed and faded in and out at run
// time (bank). Each is a billboard of the cumulus picture, fading out as the camera nears it (the mist takes over:
// sky.js), lit like the deck, flashing with the lightning, and hidden in the mist inside another cloud. inside(p) says
// how deep in one a point is: 0 outside, 1 at its heart (the same wrapping as the shader's, the cloud a squashed ball
// 0.7 of its size across and 0.38 up and down)
const BANK = 6;
function makePuffs() {
  const N = 110, SPAN = 14000, ALL = BANK + N;
  const offs = new Float32Array(ALL * 3), sizes = new Float32Array(ALL), bank = new Float32Array(ALL);
  let seed = 9; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = BANK; i < ALL; i++) { offs.set([rnd() * SPAN, 520 + rnd() * 1500, rnd() * SPAN], i * 3); sizes[i] = 260 + rnd() * 520; }
  bank.fill(1, 0, BANK);
  // (the plane's corners copied in, then each cloud's place, size and whether it's the bank's set on the drawn geometry
  // itself, the very arrays bank() writes into: copying a geometry copies its arrays too, and the bank would be placed
  // in arrays nobody draws)
  const ig = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(1, 1)); ig.instanceCount = ALL;
  const offA = new THREE.InstancedBufferAttribute(offs, 3), sizeA = new THREE.InstancedBufferAttribute(sizes, 1);
  ig.setAttribute('offset', offA); ig.setAttribute('size', sizeA); ig.setAttribute('bank', new THREE.InstancedBufferAttribute(bank, 1));
  const U = { uMap: { value: cloudTexture() }, uCenter: { value: new THREE.Vector3() }, uSpan: { value: SPAN }, uSun: { value: SUN }, uPuffLit: MOOD.uPuffLit, uPuffShade: MOOD.uPuffShade, uDrift: MOOD.uDrift,
    uBank: { value: 0 }, uFlash: MOOD.uFlash, uMist: MOOD.uMist };
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, uniforms: U,
    // (uDrift: how far the wind has carried them, on the title screen; uBank: the bank's share in sight, 0 to 1)
    vertexShader: `attribute vec3 offset; attribute float size; attribute float bank; uniform vec3 uCenter; uniform float uSpan; uniform vec2 uDrift; uniform float uBank; varying vec2 vUv; varying float vFade;
      void main() {
        vec3 p = offset; p.xz = uCenter.xz + mod(offset.xz + uDrift - uCenter.xz + uSpan * 0.5, uSpan) - uSpan * 0.5;
        vec4 mv = viewMatrix * vec4(p, 1.0);
        mv.xy += position.xy * vec2(size * 1.6, size);
        float d = length(p.xz - uCenter.xz);
        vFade = 1.0 - smoothstep(uSpan * 0.32, uSpan * 0.5, d);
        vFade *= smoothstep(60.0, 260.0, -mv.z) * mix(1.0, uBank, bank);
        vUv = uv; gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform sampler2D uMap; uniform vec3 uPuffLit; uniform vec3 uPuffShade; uniform float uFlash; uniform float uMist; varying vec2 vUv; varying float vFade;
      void main() { vec4 c = texture2D(uMap, vUv); c.rgb *= mix(uPuffShade, uPuffLit, vUv.y); c.rgb += vec3(0.45, 0.5, 0.65) * uFlash; c.a *= vFade * 0.9 * (1.0 - 0.9 * uMist); if (c.a < 0.01) discard; gl_FragColor = c;
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(ig, mat);
  mesh.frustumCulled = false; mesh.renderOrder = 2;
  let shown = N; // (how many of the 110 are drawn: fewer for the Settings card's Smooth or Balanced picture, count(n))
  const B = { on: false, k: 0 }; // the bank: wanted or not, and its share in sight
  // a bank of cloud across the way from `from` to `to` (two points), centred `at` metres along it, or none (null): it
  // fades in over two seconds (or out over four)
  function setBank(from, to, at = 650) {
    if (!from) { B.on = false; return; }
    const dx = to.x - from.x, dz = to.z - from.z, L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L, cx = from.x + ux * at, cz = from.z + uz * at;
    const y = (from.y + to.y) / 2 + 30;
    for (let i = 0; i < BANK; i++) {
      const across = (i - (BANK - 1) / 2) * 230 + (Math.random() - 0.5) * 60, along = (i % 2 ? 1 : -1) * (40 + Math.random() * 70);
      offs[i * 3] = cx - uz * across + ux * along; offs[i * 3 + 1] = y + (Math.random() - 0.5) * 120; offs[i * 3 + 2] = cz + ux * across + uz * along;
      sizes[i] = 480 + Math.random() * 220;
    }
    offA.needsUpdate = sizeA.needsUpdate = true; B.on = true; B.k = 0; U.uBank.value = 0;
  }
  function update(dt) {
    B.k = B.on ? Math.min(1, B.k + dt / 2) : Math.max(0, B.k - dt / 4);
    U.uBank.value = B.k;
  }
  const c = U.uCenter.value;
  function depth(i, p) {
    const s = sizes[i], dr = U.uDrift.value;
    const x = c.x + (((offs[i * 3] + dr.x - c.x + SPAN / 2) % SPAN) + SPAN) % SPAN - SPAN / 2, z = c.z + (((offs[i * 3 + 2] + dr.y - c.z + SPAN / 2) % SPAN) + SPAN) % SPAN - SPAN / 2;
    const dx = p.x - x, dy = p.y - offs[i * 3 + 1], dz = p.z - z, h = 0.7 * s, v = 0.38 * s;
    return 1 - (dx * dx + dz * dz) / (h * h) - (dy * dy) / (v * v);
  }
  function inside(p) {
    let best = 0;
    if (B.k > 0.02) for (let i = 0; i < BANK; i++) best = Math.max(best, depth(i, p) * B.k);
    for (let i = BANK; i < BANK + shown; i++) { const y = offs[i * 3 + 1]; if (Math.abs(p.y - y) < sizes[i] * 0.38) best = Math.max(best, depth(i, p)); }
    return best;
  }
  // how much of point p the big clouds hide as drawn, seen through `view` (a view matrix: the camera's, or one looking
  // straight at p from where it is): each cloud nearer than p, its picture (the very opacity drawn, read once from it:
  // ALPHA) where p is seen through it, faded as the shader fades it (near the eye and far off, the bank as it fades in,
  // the mist). A ship nearer than a cloud's middle is drawn in front of it, so that cloud hides nothing of her
  let alpha = null;
  const ALPHA = 64, pv = new THREE.Vector3(), cv = new THREE.Vector3();
  function readAlpha() {
    const img = U.uMap.value.image, n = img.width / ALPHA, px = img.getContext('2d').getImageData(0, 0, img.width, img.height).data;
    alpha = new Float32Array(ALPHA * ALPHA);
    for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) alpha[Math.floor(y / n) * ALPHA + Math.floor(x / n)] += px[(y * img.width + x) * 4 + 3] / 255 / (n * n);
  }
  const smooth = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
  function veil(p, view) {
    if (!alpha) readAlpha();
    pv.copy(p).applyMatrix4(view);
    if (pv.z > -1) return 0;
    const dr = U.uDrift.value, mist = 1 - 0.9 * U.uMist.value;
    let clear = 1;
    for (let i = B.k > 0.02 ? 0 : BANK; i < BANK + shown; i++) {
      const s = sizes[i], x = c.x + (((offs[i * 3] + dr.x - c.x + SPAN / 2) % SPAN) + SPAN) % SPAN - SPAN / 2, z = c.z + (((offs[i * 3 + 2] + dr.y - c.z + SPAN / 2) % SPAN) + SPAN) % SPAN - SPAN / 2;
      const far = 1 - smooth(SPAN * 0.32, SPAN * 0.5, Math.hypot(x - c.x, z - c.z));
      if (far <= 0) continue;
      cv.set(x, offs[i * 3 + 1], z).applyMatrix4(view);
      if (cv.z <= pv.z || cv.z > -60) continue; // (behind her, or too near the eye to be drawn)
      const k = cv.z / pv.z, u = (pv.x * k - cv.x) / (s * 1.6) + 0.5, v = (pv.y * k - cv.y) / s + 0.5;
      if (u <= 0 || u >= 1 || v <= 0 || v >= 1) continue;
      const a = alpha[Math.floor((1 - v) * ALPHA) * ALPHA + Math.floor(u * ALPHA)] * far * smooth(60, 260, -cv.z) * (i < BANK ? B.k : 1) * 0.9 * mist;
      if (a >= 0.01) clear *= 1 - a;
    }
    return 1 - clear;
  }
  // where cloud i is now (for tests: from 0, the bank's first)
  const positionOf = (i, out = new THREE.Vector3()) => {
    const dr = U.uDrift.value, w = (v, k) => c[k] + (((v + dr[k === 'x' ? 'x' : 'y'] - c[k] + SPAN / 2) % SPAN) + SPAN) % SPAN - SPAN / 2;
    return out.set(w(offs[i * 3], 'x'), offs[i * 3 + 1], w(offs[i * 3 + 2], 'z'));
  };
  return { mesh, N, BANK, follow: (p) => c.copy(p), count: (n) => { shown = Math.max(0, Math.min(N, n)); ig.instanceCount = BANK + shown; }, inside, veil, positionOf, sizeOf: (i) => sizes[i], bank: setBank, update, get banked() { return B.k; } };
}
