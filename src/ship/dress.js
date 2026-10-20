// dress.js: a ship's scars and her life, worn on her own model, the same in the game and in the ships demo. Each ship
// has her own set of looks (makeLook: a few numbers her shaders read) and her own copies of the materials that show
// them (dress): her planks, deck, iron plates and brass bands; her sails; her crystals and their furnaces; her spars,
// rigging, guns and pennants. The copies share the shaders three.js builds for them (each kind keeps one name for its
// shader), so a second ship of a class, or a sixth, costs no new shaders: only her own numbers. It's all drawn from those
// numbers on the graphics card, at every level of detail alike: no new triangles, no new draw calls.
//   the hull     a hit leaves a black hole with a ring of splintered pale wood and soot round it, glowing with embers
//                for a few seconds and then smouldering; the whole hull gets sooty and streaked as she weakens. Patched
//                (between waves), a hole becomes a square of fresh planks and its soot fades
//   the sails    a ragged hole where a shot went through, its edge scorched brown; patched, a darker square of new
//                canvas sewn on with a stitched edge. Torn sails fray from their free edges and flap harder. A raider
//                captain's (and a treasure ship's) are edged with a stripe of their own colour
//   the crystals each cluster dims where it's hit and white cracks craze its crystals and darken its furnace windows;
//                failing, they all sputter together (and so do the ship's glows, sparks and lamps: build.js). Marked (a
//                Man-o'-war the Captain's guns are locked on to), their edges glow gold
// and what moves (each piece's rig, written as she's built: src/ship/kit.js), worked out from her numbers as she's drawn:
//   the wings    her wing sails, their yards, spikes and ropes fold back along the hull as her sails are taken in
//                (uFold), and spread wide again; a Surge snaps them right open with a shiver
//   the guns     her gun-port lids swing open bow first as she clears for action and each gun runs out once its lid is
//                up (uGun); a gun kicks back in at its own turn as its battery fires (uFire: the rippling broadside),
//                stays in while it's reloaded and runs out again just as it's loaded (uReady); her bow and stern guns
//                kick back along their barrels
//   the pennants stream out straight at speed and hang limp when she's slow (uWind)
// Where a shot struck is put on the model here too (hullPoint, wingPoint): on the planks, or on the canvas itself,
// wherever her wings are. The game keeps each ship's scars and life up to date as she flies, fights, is hit, patched and
// sinks (src/game/looks.js); the ships demo shows them New, Battered or Wrecked (wearPreset), and lets her sails and guns
// be worked by hand.
import * as THREE from 'three';
import { clamp } from './kit.js';

// the clock every dressed ship's shaders read (seconds): one for all of them, set once a frame by the page
export const WTIME = { value: 0 };
// how many scars on a hull and holes in the sails each ship keeps, and clusters (her shaders stop at the first empty
// place, so a ship pays only for the scars she has)
export const SCARS = 12, HOLES = 10, CLUSTERS = 8;

// One ship's looks: what her shaders read
//   uScar   her hull's scars: where (her own frame) and how big (metres); negative once patched, 0 for none
//   uHeat   how hot each scar still is (embers), 0 to 1
//   uHole   her sails' holes: where and how big; negative once patched. uHoleWing: which of her wings each is on (a
//           hole near the mast cuts its own wing only, not the one across the mast or the tier below)
//   uWear   x: soot and grime over the hull (0 to 1); y: how far her sails have frayed; z: how hard they flap (1 is a
//           sound sail); w: how far off she is, 0 close to 1 across a fight (src/game/looks.js): her open holes are
//           drawn bigger and their soot darker, so they read at that distance
//   uCrys   how bright each crystal cluster still is (1 whole, 0 dark); uCrack: how cracked (0 to 1)
//   uSpark  the sputter of failing crystals: 1 steady, lower as they gutter (the same for her glows and lamps)
//   uFold   x: how far her wings are folded back (0 spread, 1 folded; -0.1 snapped open in a Surge); y: their shiver
//   uGun    x, y: her port and starboard lids (0 shut; 1 the first open; 2 every lid open and every gun run out)
//   uFire   when each battery last fired (port, starboard, bow, stern: seconds on the shared clock); uReady: when each
//           will be loaded again
//   uWind   x: her speed, a share of her top speed (her pennants stream at 1, hang at 0); y: unused
//   uMark   how much her crystals' edges glow gold (a Man-o'-war the Captain's guns are locked on to)
export function makeLook() {
  return {
    uWTime: WTIME, uScar: { value: new Float32Array(SCARS * 4) }, uHeat: { value: new Float32Array(SCARS) }, uHole: { value: new Float32Array(HOLES * 4) }, uHoleWing: { value: new Float32Array(HOLES).fill(-1) },
    uWear: { value: new THREE.Vector4(0, 0, 1, 0) }, uCrys: { value: new Float32Array(CLUSTERS).fill(1) }, uCrack: { value: new Float32Array(CLUSTERS) }, uSpark: { value: 1 },
    uFold: { value: new THREE.Vector4(0, 0, 0, 0) }, uGun: { value: new THREE.Vector4(0, 0, 0, 0) }, uFire: { value: new THREE.Vector4(-1e4, -1e4, -1e4, -1e4) },
    uReady: { value: new THREE.Vector4(0, 0, 0, 0) }, uWind: { value: new THREE.Vector2(0.6, 0) }, uMark: { value: 0 },
  };
}

// ---------- what moves ----------
// how far her wings fold back at most (radians about the mast: 34 degrees, so the Frigate's fore wings stay clear of her
// mainmast's), how far their tips droop folded (a share of how far out they are), and their shiver in a Surge; how far a
// lid swings open (radians), the lids' ripple (seconds a lid takes to open), how far a broadside gun is thrown back by
// its kick (a share of its run), how long the kick takes, and the longest it takes to run out again (seconds)
export const RIG = { fold: 0.6, droop: 0.1, shiver: 0.012, lid: 2.25, lidTime: 0.35, kick: 0.8, kickTime: 0.06, runOut: 0.6 };
// the same in the shaders. rigMove moves a point p (her own frame) and its normal n by its rig (kit.js), and says how far
// a broadside gun has gone in (0 out, 1 all the way in: its muzzle's glow hides)
export const RIG_GLSL = `
attribute vec4 rig;
uniform vec4 uFold; uniform vec4 uGun; uniform vec4 uFire; uniform vec4 uReady; uniform float uWTime;
float rigKick(float b, float d) {
  vec4 s = vec4(equal(vec4(b), vec4(0.0, 1.0, 2.0, 3.0)));
  float f = dot(uFire, s), r = dot(uReady, s), u = uWTime - f - d;
  return u < 0.0 ? 0.0 : smoothstep(0.0, ${RIG.kickTime.toFixed(3)}, u) * (1.0 - smoothstep(r - min(${RIG.runOut.toFixed(3)}, 0.4 * max(r - f, 0.01)), r, uWTime));
}
float rigMove(inout vec3 p, inout vec3 n) {
  float k = rig.x, s = rig.y < 0.0 ? -1.0 : 1.0;
  if (k > 0.5 && k < 1.5) {
    float w = clamp(abs(rig.y) - 1.0, 0.0, 1.0), a = s * w * (${RIG.fold.toFixed(3)} * uFold.x + ${RIG.shiver.toFixed(3)} * sin(uWTime * 18.0) * uFold.y);
    float c = cos(a), sn = sin(a), x0 = p.x, dz = p.z - rig.z;
    p.x = x0 * c + dz * sn; p.z = rig.z - x0 * sn + dz * c; p.y -= ${RIG.droop.toFixed(3)} * max(uFold.x, 0.0) * abs(x0) * w;
    n = vec3(n.x * c + n.z * sn, n.y, -n.x * sn + n.z * c);
    return 0.0;
  }
  float o = s > 0.0 ? uGun.x : uGun.y;
  if (k > 1.5 && k < 2.5) {
    float a = s * ${RIG.lid.toFixed(3)} * smoothstep(rig.w, rig.w + ${RIG.lidTime.toFixed(3)}, o), c = cos(a), sn = sin(a);
    vec2 q = p.xy - rig.yz;
    p.xy = rig.yz + vec2(q.x * c - q.y * sn, q.x * sn + q.y * c);
    n.xy = vec2(n.x * c - n.y * sn, n.x * sn + n.y * c);
    return 0.0;
  }
  if (k > 2.5 && k < 3.5) {
    float back = max(1.0 - smoothstep(rig.w + 0.3, rig.w + 0.8, o), ${RIG.kick.toFixed(3)} * rigKick(s > 0.0 ? 0.0 : 1.0, rig.z));
    p.x -= rig.y * back;
    return back;
  }
  if (k > 3.5 && k < 4.5) {
    bool across = abs(rig.y) > 1.5;
    float back = rig.w * rigKick(across ? (s > 0.0 ? 0.0 : 1.0) : (s > 0.0 ? 2.0 : 3.0), rig.z);
    if (across) p.x -= s * back; else p.z -= s * back;
  }
  return 0.0;
}
`;
export const rigUniforms = (U) => ({ uFold: U.uFold, uGun: U.uGun, uFire: U.uFire, uReady: U.uReady, uWTime: U.uWTime });
// (in a ship's own shaders: the point and its normal moved before three.js uses them)
const RIG_NORMAL = 'vec3 rigP = position; float rigIn = rigMove(rigP, objectNormal);';

// The same on the CPU, so the game's hit boxes, wingtip trails and tests agree with what's drawn. A point on a wing
// (side +1 port, the mast's z), folded `fold`, into out; and back again
export function foldPoint(p, side, mz, fold, out = p, w = 1) {
  const a = side * w * RIG.fold * fold, c = Math.cos(a), s = Math.sin(a), x0 = p.x, dz = p.z - mz;
  return out.set(x0 * c + dz * s, p.y - RIG.droop * Math.max(fold, 0) * Math.abs(x0) * w, mz - x0 * s + dz * c);
}
export function unfoldPoint(p, side, mz, fold, out = p) {
  const a = -side * RIG.fold * fold, c = Math.cos(a), s = Math.sin(a), x1 = p.x, dz = p.z - mz, x0 = x1 * c + dz * s;
  return out.set(x0, p.y + RIG.droop * Math.max(fold, 0) * Math.abs(x0), mz - x1 * s + dz * c);
}
const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const BATTERIES = ['port', 'starboard', 'bow', 'stern'];
// how far a gun with its turn `delay` in battery b (0 to 3) has been kicked back at `time` (0 out to 1 in), as drawn
export function kickAt(U, b, delay, time) {
  const f = U.uFire.value.getComponent(b), r = U.uReady.value.getComponent(b), u = time - f - delay;
  return u < 0 ? 0 : smoothstep(0, RIG.kickTime, u) * (1 - smoothstep(r - Math.min(RIG.runOut, 0.4 * Math.max(r - f, 0.01)), r, time));
}
// how far in a broadside gun is (metres, from all the way out), with its rig [3, side x run, turn firing, turn opening]
export function gunIn(U, rig, time) {
  const side = rig[1] < 0 ? -1 : 1, o = side > 0 ? U.uGun.value.x : U.uGun.value.y;
  return Math.abs(rig[1]) * Math.max(1 - smoothstep(rig[3] + 0.3, rig[3] + 0.8, o), RIG.kick * kickAt(U, side > 0 ? 0 : 1, rig[2], time));
}

// ---------- the shaders: pieces added to three.js's own ----------
// a smooth noise in 3D (with a hash that needs no sine, so it holds up on a phone's graphics)
const NOISE = `
float wH(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float wN(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(wH(i), wH(i + vec3(1.0, 0.0, 0.0)), f.x), mix(wH(i + vec3(0.0, 1.0, 0.0)), wH(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
             mix(mix(wH(i + vec3(0.0, 0.0, 1.0)), wH(i + vec3(1.0, 0.0, 1.0)), f.x), mix(wH(i + vec3(0.0, 1.0, 1.0)), wH(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z); }
`;
// the hull, deck, plates and bands. Each scar: soot out to about twice its size, a black hole in its middle ringed with
// pale splintered wood, embers glowing round it while it's hot; far off (uWear.w) the hole is over half as big again,
// its soot reaching further and darker. Patched: fresh planks in a square where the hole was, with dark seams and nail
// heads round it, and the soot faded. Soot is matte (and dulls brass)
const HULL_FRAG = `
  float wSoot = 0.0, wHole = 0.0, wRim = 0.0, wEmber = 0.0, wFresh = 0.0, wSeam = 0.0, wn = 0.5;
  if (uScar[0].w != 0.0 || uWear.x > 0.0) {
    wn = wN(vLocal * 2.3) * 0.65 + wN(vLocal * 6.1) * 0.35;
    float wFar = uWear.w, wHr = 0.3 + 0.07 * wFar;
    for (int i = 0; i < ${SCARS}; i++) {
      vec4 s = uScar[i];
      if (s.w == 0.0) break;
      float r = abs(s.w) * (s.w > 0.0 ? 1.0 + 0.3 * wFar : 1.0), e = length(vLocal - s.xyz) / r, d = e + (wn - 0.5) * 0.9, h = e + (wn - 0.5) * 0.3;
      if (s.w > 0.0) {
        wSoot = max(wSoot, 1.0 - smoothstep(0.55, 2.1, d));
        wHole = max(wHole, 1.0 - smoothstep(wHr, wHr + 0.04, h));
        wRim = max(wRim, (1.0 - smoothstep(wHr + 0.06, wHr + 0.16, h)) * smoothstep(wHr, wHr + 0.04, h));
        wEmber = max(wEmber, uHeat[i] * sqrt(uHeat[i]) * (1.0 - smoothstep(0.3, 1.0, d)));
      } else {
        vec3 q = abs(vLocal - s.xyz) / r;
        float b = max(q.x, max(q.y, q.z));
        wSoot = max(wSoot, 0.4 * (1.0 - smoothstep(0.5, 1.6, d)));
        wFresh = max(wFresh, 1.0 - smoothstep(0.4, 0.43, b));
        wSeam = max(wSeam, (1.0 - smoothstep(0.43, 0.47, b)) * smoothstep(0.37, 0.4, b));
      }
    }
    wSoot = max(wSoot, uWear.x * smoothstep(0.45, 0.78, wn));
    diffuseColor.rgb *= mix(1.0, 0.15 - 0.08 * wFar, wSoot);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.4, 0.25, 0.11), wRim * 0.75);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.01, 0.007, 0.005), wHole);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.3, 0.16, 0.07) * (0.8 + 0.4 * wn) * (0.75 + 0.25 * step(0.1, fract(vLocal.y * 3.6 + vLocal.x * 3.6))), wFresh);
    diffuseColor.rgb *= 1.0 - 0.65 * wSeam;
  }`;
const HULL_ROUGH = `
  roughnessFactor = mix(roughnessFactor, 1.0, wSoot);
  metalnessFactor *= 1.0 - 0.85 * max(wSoot, wHole);`;
const HULL_GLOW = `
  totalEmissiveRadiance *= 1.0 - 0.9 * max(max(wSoot, wHole), wFresh);
  totalEmissiveRadiance += vec3(1.0, 0.22, 0.04) * wEmber * (0.65 + 0.35 * sin(uWTime * 9.0 + wn * 25.0)) * 1.4 * (1.0 - 0.6 * wHole);`;
// the sails: frayed from the free edge (vEdge 0 there) as they're torn, charred brown along the frays; each hole ragged
// and scorched round its edge, on its own wing (vWing: which one this is), and far off (uWear.w) bigger, with a wider
// scorch; each patch a darker square of new canvas, laid in the sail's own plane, its edge stitched. A sound sail
// (unless it's striped) skips all of it: next to no cost
const SAIL_FRAG = `
  float wChar = 0.0, wPatch = 0.0, wStitch = 0.0, wn = 0.5;
  if (uWear.y > 0.0 || uHole[0].w != 0.0 || uStripe.w > 0.0) wn = wN(vLocal * 3.1) * 0.6 + wN(vLocal * 9.0) * 0.4;
  if (uWear.y > 0.0) {
    float fe = vEdge - uWear.y * (0.35 + 0.9 * wn);
    if (fe < 0.0) discard;
    wChar = 0.75 * (1.0 - smoothstep(0.0, 0.07, fe));
  }
  if (uHole[0].w != 0.0) {
    vec3 N = normalize(vLocalN), ax = normalize(cross(N, vec3(0.0, 1.0, 0.0)) + vec3(0.0, 0.0, 1e-4)), ay = cross(N, ax);
    for (int i = 0; i < ${HOLES}; i++) {
      vec4 h = uHole[i];
      if (h.w == 0.0) break;
      if (uHoleWing[i] >= 0.0 && abs(uHoleWing[i] - vWing) > 0.5) continue;
      vec3 q = vLocal - h.xyz;
      if (h.w > 0.0) {
        float d = length(q) / h.w + (wn - 0.5) * 0.8, cut = 0.5 + 0.18 * uWear.w;
        if (d < cut) discard;
        wChar = max(wChar, 1.0 - smoothstep(cut, cut + 0.28 + 0.12 * uWear.w, d));
      } else {
        float r = -h.w, px = dot(q, ax) / r, py = dot(q, ay) / r, b = max(abs(px), abs(py)), e = abs(px) > abs(py) ? py : px;
        if (abs(dot(q, N)) < r * 1.2) {
          wPatch = max(wPatch, 1.0 - smoothstep(0.6, 0.62, b));
          wStitch = max(wStitch, (1.0 - smoothstep(0.55, 0.57, b)) * smoothstep(0.5, 0.52, b) * step(0.5, fract(e * 7.0)));
          wChar = max(wChar, 0.35 * smoothstep(0.62, 0.66, b) * (1.0 - smoothstep(0.66, 0.9, b)));
        }
      }
    }
  }
  float wStripe = uStripe.w > 0.0 ? 1.0 - smoothstep(uStripe.w * 0.85, uStripe.w, vEdge + (wn - 0.5) * 0.015) : 0.0;
  diffuseColor.rgb = mix(diffuseColor.rgb, uStripe.rgb, wStripe);
  diffuseColor.rgb *= mix(1.0, 0.1, wChar);
  diffuseColor.rgb *= mix(vec3(1.0), vec3(0.72, 0.62, 0.48), wPatch);
  diffuseColor.rgb *= 1.0 - 0.7 * wStitch;`;
const SAIL_GLOW = `
  totalEmissiveRadiance = mix(totalEmissiveRadiance, uStripe.rgb * 0.35, wStripe);
  totalEmissiveRadiance *= (1.0 - wChar) * (1.0 - 0.45 * wPatch);`;
// the crystals: each cluster's own brightness and cracks (read in the vertex shader by the cluster's number, so the
// pixels need no lookups), dull and grey as they die; the slow pulse they always had, and white-violet cracks that
// flash as they sputter (worked out only on a cluster that's cracked)
const GEM_FRAG = `
  float wLine = 0.0;
  if (vCrack > 0.0) wLine = (1.0 - smoothstep(0.0, 0.06, abs(wN(vLocal * 5.0) - 0.5))) * vCrack;
  diffuseColor.rgb = mix(vec3(dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11))) * vec3(0.3, 0.27, 0.38), diffuseColor.rgb, 0.2 + 0.8 * vCrys);
  diffuseColor.rgb *= 1.0 - 0.8 * wLine;
  totalEmissiveRadiance *= vCrys * uSpark * (1.0 - 0.85 * wLine) * (1.0 + 0.164 * sin(uWTime * 2.4));
  totalEmissiveRadiance += vec3(0.75, 0.55, 1.0) * wLine * (uSpark < 0.99 ? 1.8 : 0.7);
  totalEmissiveRadiance += vec3(1.0, 0.86, 0.5) * uMark * vCrys * pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 2.0) * (1.4 + 0.6 * sin(uWTime * 6.0));`;
// the furnace windows under a cluster go dark with it
const PARTS_GLOW = `
  totalEmissiveRadiance *= mix(1.0, vCrys * uSpark, vClu);`;
// a cluster's numbers, read in the vertex shader from its rig ([5, which cluster])
const CLUSTER_VERT = `
  int wCi = clamp(int(rig.y + 0.5), 0, ${CLUSTERS - 1});
  vClu = rig.x > 4.5 ? 1.0 : 0.0;
  vCrys = rig.x > 4.5 ? uCrys[wCi] : 1.0;
  vCrack = rig.x > 4.5 ? uCrack[wCi] : 0.0;`;

// a broadside gun's and a lid's metal: brass or bronze by its corners' colour (kit.js metal), in the ship's own colours
const METAL_FRAG = `
  diffuseColor.rgb = mix(uBronze, uBrass, vColor.r);`;
// the pennants: streaming straight out behind the mast at speed, flapping; hanging limp from the hoist when she's slow
const FLAG_VERT = `
  float wSlow = clamp(1.0 - uWind.x * 1.3, 0.0, 1.0), wD = max(0.0, rig.y - position.z), wA = wSlow * 1.15 * (0.3 + 0.7 * billow);
  transformed.z = rig.y - wD * cos(wA); transformed.y -= wD * sin(wA);
  transformed.x += billow * (sin(uWTime * 5.5 - billow * 9.0) * 0.32 + sin(uWTime * 3.1 - billow * 5.0) * 0.12) * (0.3 + 0.7 * (1.0 - wSlow));
  transformed.y -= billow * billow * 0.3 * (1.0 - wSlow);`;

const pre = (sh, vert, frag) => { sh.vertexShader = vert + sh.vertexShader; sh.fragmentShader = frag + sh.fragmentShader; };
const after = (src, chunk, add) => src.replace(`#include <${chunk}>`, `#include <${chunk}>\n${add}`);
const NO_STRIPE = [0, 0, 0, 0];
// each kind's shader edits: plain functions, each reading its own material's ship (this.userData.U), so every copy
// gets its ship's numbers while sharing one shader
const DRESS = {
  hull: { key: 'hull-wear', compile(sh) {
    const U = this.userData.U;
    Object.assign(sh.uniforms, { uScar: U.uScar, uHeat: U.uHeat, uWear: U.uWear, uWTime: U.uWTime });
    pre(sh, 'varying vec3 vLocal;\n', `varying vec3 vLocal;\nuniform vec4 uScar[${SCARS}];\nuniform float uHeat[${SCARS}];\nuniform vec4 uWear;\nuniform float uWTime;\n${NOISE}`);
    sh.vertexShader = after(sh.vertexShader, 'begin_vertex', 'vLocal = position;');
    sh.fragmentShader = after(after(after(sh.fragmentShader, 'map_fragment', HULL_FRAG), 'metalnessmap_fragment', HULL_ROUGH), 'emissivemap_fragment', HULL_GLOW);
  } },
  sail: { key: 'sail-wear', compile(sh) {
    const U = this.userData.U;
    Object.assign(sh.uniforms, { uHole: U.uHole, uHoleWing: U.uHoleWing, uWear: U.uWear, uStripe: { value: new THREE.Vector4().fromArray(this.userData.stripe ?? NO_STRIPE) } }, rigUniforms(U));
    pre(sh, `attribute float billow;\nuniform vec4 uWear;\nvarying vec3 vLocal;\nvarying vec3 vLocalN;\nvarying float vEdge;\nvarying float vWing;\n${RIG_GLSL}`,
      `varying vec3 vLocal;\nvarying vec3 vLocalN;\nvarying float vEdge;\nvarying float vWing;\nuniform vec4 uHole[${HOLES}];\nuniform float uHoleWing[${HOLES}];\nuniform vec4 uWear;\nuniform vec4 uStripe;\n${NOISE}`);
    // (folded with her wing; and the ripple in the wind, harder as the sails are torn. Her scars stay where they are on
    // the canvas, wherever the wing is: they're read from where the canvas was made. Which wing it is: from its rig,
    // [1, side x (2 + its number), ...])
    sh.vertexShader = after(after(sh.vertexShader, 'beginnormal_vertex', RIG_NORMAL), 'begin_vertex', `transformed = rigP; vLocal = position; vLocalN = normal; vEdge = rig.w; vWing = abs(rig.y) - 2.0;
      transformed += objectNormal * billow * uWear.z * (sin(uWTime * 2.3 + position.x * 0.9 + position.y * 0.6) * 0.05 + sin(uWTime * 3.7 + position.z * 1.3) * 0.025);`);
    sh.fragmentShader = after(after(sh.fragmentShader, 'map_fragment', SAIL_FRAG), 'emissivemap_fragment', SAIL_GLOW);
  } },
  gem: { key: 'gem-wear', compile(sh) {
    const U = this.userData.U;
    Object.assign(sh.uniforms, { uCrys: U.uCrys, uCrack: U.uCrack, uSpark: U.uSpark, uWTime: U.uWTime, uMark: U.uMark });
    pre(sh, `attribute vec4 rig;\nuniform float uCrys[${CLUSTERS}];\nuniform float uCrack[${CLUSTERS}];\nvarying vec3 vLocal;\nvarying float vCrys;\nvarying float vCrack;\nvarying float vClu;\n`,
      `varying vec3 vLocal;\nvarying float vCrys;\nvarying float vCrack;\nvarying float vClu;\nuniform float uSpark;\nuniform float uWTime;\nuniform float uMark;\n${NOISE}`);
    sh.vertexShader = after(sh.vertexShader, 'begin_vertex', 'vLocal = position;' + CLUSTER_VERT);
    sh.fragmentShader = after(sh.fragmentShader, 'emissivemap_fragment', GEM_FRAG);
  } },
  parts: { key: 'parts-wear', compile(sh) {
    const U = this.userData.U;
    Object.assign(sh.uniforms, { uCrys: U.uCrys, uCrack: U.uCrack, uSpark: U.uSpark });
    pre(sh, `attribute vec4 rig;\nuniform float uCrys[${CLUSTERS}];\nuniform float uCrack[${CLUSTERS}];\nvarying float vCrys;\nvarying float vCrack;\nvarying float vClu;\n`,
      'varying float vCrys;\nvarying float vCrack;\nvarying float vClu;\nuniform float uSpark;\n');
    sh.vertexShader = after(sh.vertexShader, 'begin_vertex', CLUSTER_VERT);
    sh.fragmentShader = after(sh.fragmentShader, 'emissivemap_fragment', PARTS_GLOW);
  } },
  // her spars, rigging and the guns' crystals: they only move
  move: { key: 'rig', compile(sh) {
    Object.assign(sh.uniforms, rigUniforms(this.userData.U));
    sh.vertexShader = RIG_GLSL + after(after(sh.vertexShader, 'beginnormal_vertex', RIG_NORMAL), 'begin_vertex', 'transformed = rigP;');
  } },
  // the metal that moves: brass or bronze in her own colours
  metal: { key: 'rig-metal', compile(sh) {
    const d = this.userData;
    Object.assign(sh.uniforms, rigUniforms(d.U), { uBrass: { value: new THREE.Color(d.brass ?? 0xd9a743) }, uBronze: { value: new THREE.Color(d.bronze ?? 0xa06a2e) } });
    sh.vertexShader = RIG_GLSL + after(after(sh.vertexShader, 'beginnormal_vertex', RIG_NORMAL), 'begin_vertex', 'transformed = rigP;');
    sh.fragmentShader = 'uniform vec3 uBrass;\nuniform vec3 uBronze;\n' + after(sh.fragmentShader, 'color_fragment', METAL_FRAG);
  } },
  flag: { key: 'flag-wind', compile(sh) {
    const U = this.userData.U;
    Object.assign(sh.uniforms, { uWind: U.uWind, uWTime: U.uWTime });
    sh.vertexShader = 'attribute float billow;\nattribute vec4 rig;\nuniform float uWTime;\nuniform vec2 uWind;\n' + after(sh.vertexShader, 'begin_vertex', FLAG_VERT);
  } },
};
// her shadow follows what moves: each moving piece casts it from where it's drawn (a depth material of her own)
function depthCompile(sh) {
  Object.assign(sh.uniforms, rigUniforms(this.userData.U));
  sh.vertexShader = RIG_GLSL + after(sh.vertexShader, 'begin_vertex', '{ vec3 rigN = vec3(0.0, 1.0, 0.0); rigMove(transformed, rigN); }');
}
const depthKey = () => 'rig-depth';
// which of a ship's materials (by her meshes' names) are dressed, and how
const KIND = { hull: 'hull', plates: 'hull', deck: 'hull', band: 'hull', canvas: 'sail', gem: 'gem', parts: 'parts', wood: 'move', rope: 'move', crystal: 'move', rigMetal: 'metal', flag: 'flag' };
const RIGGED = new Set(['sail', 'gem', 'parts', 'move', 'metal', 'flag']), MOVES = new Set(['sail', 'move', 'metal']);
const keys = {}; for (const k in DRESS) keys[k] = () => DRESS[k].key;

// Dress a ship's bodies (her middle and far models share one set) in her own copies of the materials M, reading her
// looks U. Each mesh is matched by its name (its material's); the rest keep the shared materials
export function dress(bodies, M, U) {
  const made = {}, depth = {};
  for (const body of [].concat(bodies)) body.traverse((o) => {
    const kind = o.isMesh && KIND[o.name];
    if (!kind || !M[o.name]) return;
    o.material = made[o.name] ??= wear(M[o.name], kind, U);
    // (a piece made without a rig, such as the rudder's painted board, reads it as all zeros: nothing in particular)
    if (RIGGED.has(kind) && !o.geometry.attributes.rig) o.geometry.setAttribute('rig', new THREE.Float32BufferAttribute(new Float32Array(o.geometry.attributes.position.count * 4), 4));
    if (MOVES.has(kind)) o.customDepthMaterial = depth[o.name] ??= depthOf(U);
  });
  return made;
}
function wear(base, kind, U) {
  const m = base.clone();
  m.userData.U = U; // (after the copy: a copy's userData goes through JSON)
  if (kind === 'gem') m.emissiveIntensity = 0.55; // (it pulses in the shader now)
  m.onBeforeCompile = DRESS[kind].compile; m.customProgramCacheKey = keys[kind];
  return m;
}
function depthOf(U) {
  const m = new THREE.MeshDepthMaterial();
  m.userData.U = U; m.onBeforeCompile = depthCompile; m.customProgramCacheKey = depthKey;
  return m;
}

// ---------- where a shot struck, on the model ----------
// how far out from the middle the hull is at height y, station z (the section's own curve, without its slight lean)
function sectionHalf(hull, z, y) {
  const w = hull.wale(z);
  if (y >= w) return hull.half(z);
  const s = clamp((w - y) / hull.bowlD(z), 0, 1), p = hull.R.hull.fullness ?? 0.75;
  return hull.half(z) * Math.cos(Math.asin(Math.pow(s, 1 / p)));
}
const inside = (hull, x, y, z) => z > hull.zs && z < hull.zb && y > hull.keel(z) && y < hull.deckY(z) && Math.abs(x) <= sectionHalf(hull, z, y);
const _a = new THREE.Vector3(), _b = new THREE.Vector3();
// A shot that struck the hull: from p (the ship's own frame: where it came into her hull's outline, which reaches a
// little past her planks, up to her rail), flying along d, on to her planks or her deck. The point into `out`, the way
// the surface faces into `n`
export function hullPoint(hull, p, d, out, n) {
  // (back along its path a little, then on through her, until it's inside her planks; then halved down to the surface)
  let prev = -1.2, hit = null;
  for (let s = -1.2; s <= 8; s += 0.1) {
    _a.copy(p).addScaledVector(d, s);
    if (inside(hull, _a.x, _a.y, _a.z)) { hit = s; break; }
    prev = s;
  }
  if (hit === null) {
    // it passed through her rail or ram without meeting her planks: put it on her deck edge, or leave it where it was
    const z = clamp(p.z, hull.zs + 0.05, hull.zb - 0.05);
    if (p.z > hull.zb || p.z < hull.zs) { out.copy(p); n.copy(d).negate(); return out; }
    const y = hull.deckY(z), x = Math.sign(p.x || 1) * Math.min(Math.abs(p.x), hull.deckHalf(z) * 0.98);
    out.set(x, y, z); n.set(0, 1, 0);
    return out;
  }
  let a = prev, b = hit;
  for (let i = 0; i < 6; i++) { const m = (a + b) / 2; _a.copy(p).addScaledVector(d, m); if (inside(hull, _a.x, _a.y, _a.z)) b = m; else a = m; }
  out.copy(p).addScaledVector(d, b);
  const z = out.z;
  if (out.y > hull.deckY(z) - 0.12 && d.y < 0) { out.y = hull.deckY(z); n.set(0, 1, 0); return out; } // (on the deck, from above)
  const side = out.x >= 0 ? 1 : -1, t = hull.tAt(z, clamp(out.y, hull.keel(z), hull.rim(z))), q = hull.at(z, t, side);
  out.set(q[0], q[1], z); n.copy(hull.normal(z, t, side));
  return out;
}
// A shot through the sails, from p along d (the ship's own frame), her wings folded `fold`: where it goes through the
// canvas, into `out`, as the canvas was made (spread: her scars are kept there, and fold with her wings; the canvas
// bellies, so it's put on the bellied sail where it crossed the flat one), or on the nearest wing if it only grazed the
// rigging. Returns that wing
const _p = new THREE.Vector3(), _d = new THREE.Vector3();
export function wingPoint(wings, p, d, out, fold = 0) {
  let best = null, bt = Infinity, bw = [0, 0, 0];
  for (const w of wings) {
    // (the shot as that wing sees it, spread)
    unfoldPoint(p, w.side, w.mz ?? 0, fold, _p); _d.copy(d).add(p); unfoldPoint(_d, w.side, w.mz ?? 0, fold, _d).sub(_p);
    const e1 = _a.copy(w.B).sub(w.A), e2 = _b.copy(w.C).sub(w.A);
    // (the line through the triangle: Moller and Trumbore's way, along it both ways a little)
    const px = _d.y * e2.z - _d.z * e2.y, py = _d.z * e2.x - _d.x * e2.z, pz = _d.x * e2.y - _d.y * e2.x, det = e1.x * px + e1.y * py + e1.z * pz;
    if (Math.abs(det) < 1e-9) continue;
    const tx = _p.x - w.A.x, ty = _p.y - w.A.y, tz = _p.z - w.A.z, u = (tx * px + ty * py + tz * pz) / det;
    if (u < 0 || u > 1) continue;
    const qx = ty * e1.z - tz * e1.y, qy = tz * e1.x - tx * e1.z, qz = tx * e1.y - ty * e1.x, v = (_d.x * qx + _d.y * qy + _d.z * qz) / det;
    if (v < 0 || u + v > 1) continue;
    const t = (e2.x * qx + e2.y * qy + e2.z * qz) / det;
    if (t > -3 && Math.abs(t) < bt) { bt = Math.abs(t); best = w; bw = [1 - u - v, u, v]; }
  }
  if (!best) {
    // the nearest wing, by its middle, and the nearest corner weights on it
    let bd = Infinity;
    for (const w of wings) {
      unfoldPoint(p, w.side, w.mz ?? 0, fold, _p);
      const c = _a.copy(w.A).add(w.B).add(w.C).divideScalar(3), dd = c.distanceToSquared(_p);
      if (dd < bd) { bd = dd; best = w; }
    }
    if (!best) return null;
    unfoldPoint(p, best.side, best.mz ?? 0, fold, _p);
    const tri = new THREE.Triangle(best.A, best.B, best.C), q = tri.closestPointToPoint(_p, _b), bc = tri.getBarycoord(q, _a);
    bw = [bc.x, bc.y, bc.z];
  }
  sailPoint(best, bw[0], bw[1], bw[2], out);
  return best;
}
// the point on a wing sail with corner weights a, b, c, bellied as parts.js bellies it
export function sailPoint(w, a, b, c, out) {
  const bw = Math.max(0, 27 * a * b * c);
  return out.set(0, 0, 0).addScaledVector(w.A, a).addScaledVector(w.B, b).addScaledVector(w.C, c).addScaledVector(w.n, w.belly * Math.pow(bw, 0.8));
}

// ---------- a ship's scars, kept ----------
// The scars, holes and cracked crystals behind a ship's looks, as plain numbers, written into her looks (write) for
// her shaders. The game (src/game/looks.js) adds to them as she's hit; the ships demo sets them all at once
export function makeWear(ship) {
  const S = () => ({ on: false, x: 0, y: 0, z: 0, nx: 0, ny: 1, nz: 0, r: 0, r0: 0, heat: 0, patched: false, cap: 3, burning: false, sewn: 0, wing: -1 });
  const L = ship.hull.zb - ship.hull.zs;
  // (which one goes when every place is taken: a patch before a wound, then the coolest and smallest)
  const gone = (x) => (x.patched ? -10 : 0) + x.heat + x.r * 0.3;
  const W = {
    U: ship.U, ship, scars: Array.from({ length: SCARS }, S), holes: Array.from({ length: HOLES }, S),
    clusters: ship.recipe.clusters.length, dmg: new Float32Array(CLUSTERS), crys: new Float32Array(CLUSTERS).fill(1), crack: new Float32Array(CLUSTERS),
    grime: 0, fray: 0, flap: 1, spark: 1, list: 0, read: 0,
    // (for the game: her flames this frame, the first one's place in the batch and their tips in the world; how hot her
    // hottest open scar is; her hull's share when the crew began patching her; her own beat for sputtering; her beam)
    fires: 0, firstFlame: 0, tips: new Float32Array(SCARS * 3), hot: 0, from: -1, mending: 0, seed: Math.random() * 100, half: ship.hull.half((ship.hull.zs + ship.hull.zb) / 2),
    // a scar on the hull at p (her own frame), facing n, `r` metres, `heat` 0 to 1. One close by (within 1.6 times its
    // size, or a fifteenth of her length on a big ship) grows instead, up to 3 m, and burns afresh (a patch hit again is
    // a wound again). With every place taken, the nearest within twice that grows; failing that, a patch goes, or else
    // the coolest, smallest wound: so her first hits keep their marks through a long fight
    scar(p, n, r, heat = 1) {
      const within = Math.max(1.6 * r, L / 15);
      let s = near(W.scars, p, within) ?? (full(W.scars) ? near(W.scars, p, 2 * within) : null);
      if (s) { s.r = s.r0 = Math.min(s.cap, Math.max(r, Math.hypot(s.r, r * 0.5))); s.heat = Math.max(s.heat, heat); s.patched = false; return s; }
      s = W.scars.find((x) => !x.on) ?? W.scars.reduce((a, b) => (gone(b) < gone(a) ? b : a));
      Object.assign(s, { on: true, x: p.x, y: p.y, z: p.z, nx: n.x, ny: n.y, nz: n.z, r, r0: r, heat, patched: false, cap: 3 });
      return s;
    },
    // a hole in a sail at p, `r` metres, on wing w (a hole grows to at most 0.4 of its yard). One close by on the same
    // wing grows instead; with every place taken, the nearest on that wing within three times its size grows, or else a
    // patch goes, or the smallest hole
    hole(p, r, w) {
      const cap = w ? 0.4 * w.B.distanceTo(w.C) : 3, wing = w?.i ?? -1;
      let h = near(W.holes, p, 1.2 * r, wing) ?? (full(W.holes) ? near(W.holes, p, 3 * r, wing) : null);
      if (h) { h.r = h.r0 = Math.min(h.cap, Math.hypot(h.r, r)); h.patched = false; h.sewn = 0; return h; }
      h = W.holes.find((x) => !x.on) ?? W.holes.reduce((a, b) => (gone(b) < gone(a) ? b : a));
      Object.assign(h, { on: true, x: p.x, y: p.y, z: p.z, r: Math.min(r, cap), r0: Math.min(r, cap), heat: 0, patched: false, cap, sewn: 0, wing });
      return h;
    },
    // which cluster a point (her own frame) belongs to: the nearest along her length
    cluster(p) {
      const C = ship.recipe.clusters;
      let best = 0;
      for (let i = 1; i < C.length; i++) if (Math.abs(C[i].z - p.z) < Math.abs(C[best].z - p.z)) best = i;
      return best;
    },
    // back to new
    reset() {
      for (const s of W.scars) { s.on = false; s.burning = false; }
      for (const h of W.holes) { h.on = false; h.sewn = 0; }
      W.dmg.fill(0); W.crys.fill(1); W.crack.fill(0); W.grime = 0; W.fray = 0; W.flap = 1; W.spark = 1; W.list = 0;
      W.write();
    },
    // into her looks: the scars and holes packed from the first (her shaders stop at the first empty one)
    write() {
      const U = W.U, sc = U.uScar.value, he = U.uHeat.value, ho = U.uHole.value, hw = U.uHoleWing.value;
      let k = 0;
      for (const s of W.scars) if (s.on && s.r > 0.01) { sc[k * 4] = s.x; sc[k * 4 + 1] = s.y; sc[k * 4 + 2] = s.z; sc[k * 4 + 3] = s.patched ? -s.r : s.r; he[k] = s.patched ? 0 : s.heat; k++; }
      for (; k < SCARS; k++) { sc[k * 4 + 3] = 0; he[k] = 0; }
      k = 0;
      for (const h of W.holes) if (h.on && h.r > 0.01) { ho[k * 4] = h.x; ho[k * 4 + 1] = h.y; ho[k * 4 + 2] = h.z; ho[k * 4 + 3] = h.patched ? -h.r : h.r; hw[k] = h.wing; k++; }
      for (; k < HOLES; k++) { ho[k * 4 + 3] = 0; hw[k] = -1; }
      U.uWear.value.set(W.grime, W.fray, W.flap, W.read);
      U.uCrys.value.set(W.crys); U.uCrack.value.set(W.crack); U.uSpark.value = W.spark;
    },
  };
  return W;
}
// whether every place for a scar (or a hole) is taken; the nearest one within `within` metres of p (on wing `wing`, for
// a sail's)
function full(list) { for (const s of list) if (!s.on) return false; return true; }
function near(list, p, within, wing = -1) {
  let best = null, bd = within * within;
  for (const s of list) { if (!s.on || s.wing !== wing) continue; const d = (s.x - p.x) ** 2 + (s.y - p.y) ** 2 + (s.z - p.z) ** 2; if (d < bd) { bd = d; best = s; } }
  return best;
}

// The sputter of failing crystals at time t (seconds): mostly bright, guttering low now and then, the same at any frame
// rate (a smooth noise, worked out here so her crystals, glows, sparks and lamps all gutter together)
const beat = (n) => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };
export function sputter(t) {
  const x = t * 11, i = Math.floor(x), f = x - i, k = f * f * (3 - 2 * f), a = beat(i);
  return a + (beat(i + 1) - a) * k > 0.35 ? 1 : 0.25;
}

// ---------- the ships demo's three looks ----------
// New, Battered (a few scorched holes along her sides, holes in her sails, one cluster dimmed and cracked, a little
// grime and fray) or Wrecked (holes all along her, still burning, rags for sails, every crystal dim, cracked and
// sputtering). The same every time, for pictures to compare. Returns the scars that burn (Wrecked: the worst three)
export function wearPreset(W, name) {
  W.reset();
  if (name === 'new') return 0;
  const ship = W.ship, hull = ship.hull, L = hull.zb - hull.zs, wrecked = name === 'wrecked', p = new THREE.Vector3(), n = new THREE.Vector3();
  // along her sides: just under her gun ports (where a broadside's shots land, and her ports and their lids don't hide
  // them), on her gun deck between two ports, or lower down her belly
  const spots = wrecked ? [[0.18, 'under', 1], [0.35, 0.62, -1], [0.5, 'between', 1], [0.64, 'under', -1], [0.78, 0.62, 1], [0.9, 'between', -1]]
    : [[0.22, 0.6, 1], [0.42, 'under', 1], [0.6, 'between', -1], [0.78, 'under', 1]]; // (battered on her port side most)
  const P = ship.recipe.ports, ports = P ? [...P.z].sort((a, b) => a - b) : [], gy = P ? [].concat(P.y)[0] : 0;
  const r = 1.9 * clamp(L / 25, 0.55, 1.3); // (a broadside's shot)
  for (const [f, at, side] of spots) {
    let z = hull.zs + L * f, t = typeof at === 'number' ? at : 0.3;
    if (at === 'under' && P) t = hull.tAt(z, gy - P.h * 0.85);
    else if (at === 'between' && ports.length > 1) {
      let i = 0;
      for (let k = 1; k < ports.length; k++) if (Math.abs(ports[k] - z) < Math.abs(ports[i] - z)) i = k;
      const j = i === ports.length - 1 || (i > 0 && z < ports[i]) ? i - 1 : i + 1;
      z = (ports[i] + ports[j]) / 2; t = hull.tAt(z, gy);
    }
    const q = hull.at(z, t, side);
    W.scar(p.set(q[0], q[1], z), n.copy(hull.normal(z, t, side)), r * (wrecked ? 1.2 : 1.1), wrecked ? 1 : 0.35);
  }
  const wings = ship.wings ?? [];
  const holes = wrecked ? [[0.3, 0.35, 0.35], [0.5, 0.3, 0.2], [0.25, 0.5, 0.25]] : [[0.33, 0.33, 0.34]];
  wings.forEach((w, i) => {
    if (!wrecked && i % 2) return;
    const [a, b, c] = holes[i % holes.length];
    W.hole(sailPoint(w, a, b, c, p), 1.2 * clamp(L / 25, 0.55, 1.3) * (wrecked ? 1.2 : 1), w);
  });
  W.grime = wrecked ? 0.85 : 0.5; W.fray = wrecked ? 0.5 : 0.15; W.flap = wrecked ? 3 : 1.4;
  for (let i = 0; i < W.clusters; i++) { W.crys[i] = wrecked ? 0.25 : i === 0 ? 0.55 : 1; W.crack[i] = wrecked ? 0.9 : i === 0 ? 0.6 : 0; }
  W.list = wrecked ? -0.05 : 0;
  W.write();
  return wrecked ? 3 : 0;
}
