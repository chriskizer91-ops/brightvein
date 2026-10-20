// build.js: puts a ship together from its recipe (src/ships/*.js) at one of three levels of detail, the "detail
// dial" in docs/ships.md: full (about 100,000 triangles, for the Captain's own ship and anything alongside),
// middle (about a fifth of that) and far (a few thousand, for ships small on screen). Every material's pieces are
// joined into one mesh, so a ship is about a dozen draw calls at any level.
// A raider captain's ship (opts.captain) flies a great banner and has red eyes at her bow; a treasure ship (opts.treasure)
// carries chests of gold on her deck and glints all over her gilded brass (src/ship/livery.js gives them their colours).
import * as THREE from 'three';
import { Batch, clamp, triangles } from './kit.js';
import { makeHull, buildHull } from './hull.js';
import { commonShapes, brasswork, rails, guns, clusters, masts, fins, rudder, bow, lanterns, deckworks } from './parts.js';
import { makeLook, dress, CLUSTERS, RIG_GLSL, rigUniforms } from './dress.js';

export const LEVELS = {
  full: { stations: 150, rings: 32, deckAcross: 5, latheSeg: 16, tubeRad: 6, tubePer: 5, balusterStep: 1, railPath: 0.2, ropeRad: 4, sailDiv: 14, rivetStep: 1,
    ratlines: true, rivets: true, allCrystals: true, portGuns: true, portLids: true, cargo: true, lights: true },
  middle: { stations: 44, rings: 11, deckAcross: 2, latheSeg: 8, tubeRad: 4, tubePer: 2, balusterStep: 3, railPath: 0.5, ropeRad: 3, sailDiv: 4, rivetStep: 1,
    ratlines: false, rivets: false, allCrystals: true, portGuns: true, portLids: 'board', cargo: false, lights: false },
  far: { stations: 14, rings: 5, deckAcross: 1, latheSeg: 5, tubeRad: 3, tubePer: 1, balusterStep: 0, railPath: 1.2, ropeRad: 0, sailDiv: 1, rivetStep: 1,
    ratlines: false, rivets: false, allCrystals: false, portGuns: false, portLids: false, cargo: false, lights: false },
};

// Small ships spend their triangles on finer detail and big ones spread theirs further, so every ship comes out
// near the same budget at full (tuned with the counts tools/check.mjs prints)
const FINE = { skiff: 2.0, cutter: 1.62, brig: 1.14, frigate: 0.74, galleon: 0.56, manowar: 0.31 };

function detailFor(level, R) {
  const q = { ...LEVELS[level], level };
  const f = FINE[R.id] ?? 1, r = Math.sqrt(f);
  if (level === 'full') {
    q.stations = Math.round(q.stations * r); q.rings = Math.round(q.rings * r);
    q.latheSeg = Math.round(q.latheSeg * r); q.tubeRad = Math.round(q.tubeRad * r); q.sailDiv = Math.round(q.sailDiv * r);
    q.balusterStep = 1 / f; q.rivetStep = 1 / f;
  }
  if (level === 'middle') q.balusterStep = 3 / Math.min(1.2, f);
  return q;
}

// Embers: sparks of sunstone light drifting up off every crystal, as on the Magpie. Each knows its cluster (group:
// its number + 1), and a dimmed cluster gives off fewer (the ship's looks, U: dress.js). Gold cooling to orange (uHot,
// uCool), or a raider captain's crimson
function emberPoints(embers, per, U) {
  const pos = [], seed = [], spread = [], group = [];
  embers.forEach((e, i) => { for (let k = 0; k < per; k++) { pos.push(e.p.x, e.p.y, e.p.z); seed.push(i * 13.7 + k * 1.618); spread.push(e.r, e.h); group.push(e.group ?? 0); } });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('seed', new THREE.Float32BufferAttribute(seed, 1));
  geo.setAttribute('spread', new THREE.Float32BufferAttribute(spread, 2));
  geo.setAttribute('group', new THREE.Float32BufferAttribute(group, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uScale: { value: 400 }, uCrys: U.uCrys, uSpark: U.uSpark, uCool: { value: new THREE.Color(1, 0.45, 0.1) }, uHot: { value: new THREE.Color(1, 0.9, 0.55) } },
    vertexShader: `attribute float seed; attribute vec2 spread; attribute float group; uniform float uTime; uniform float uScale; uniform float uCrys[${CLUSTERS}]; uniform float uSpark; varying float vA; varying float vHot;
      float h1(float n) { return fract(sin(n) * 43758.5453); }
      void main() {
        float on = group > 0.5 ? uCrys[clamp(int(group + 0.5) - 1, 0, ${CLUSTERS - 1})] * uSpark : 1.0;
        if (h1(seed * 7.7) >= on) { gl_PointSize = 0.0; gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vA = 0.0; vHot = 0.0; return; }
        float life = fract(uTime * (0.22 + 0.12 * h1(seed)) + h1(seed * 1.3));
        float a = h1(seed * 2.1) * 6.2831 + uTime * (0.6 + h1(seed) * 0.8);
        vec3 p = position + vec3(cos(a) * spread.x * (0.3 + life * 0.9), life * spread.y * 1.6, sin(a) * spread.x * (0.3 + life * 0.9));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vA = smoothstep(0.0, 0.12, life) * (1.0 - life); vHot = 1.0 - life;
        gl_PointSize = (0.05 + 0.06 * h1(seed * 3.3)) * spread.y * uScale / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `varying float vA; varying float vHot; uniform vec3 uCool; uniform vec3 uHot;
      void main() { float r = length(gl_PointCoord - 0.5) * 2.0; float a = pow(max(0.0, 1.0 - r), 1.5) * vA;
        if (a < 0.01) discard; gl_FragColor = vec4(mix(uCool, uHot, vHot) * a, a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false; pts.renderOrder = 3;
  return pts;
}

// The glows: one batch of soft points for every crystal, lantern and gun muzzle. uBoost flares the crystals' (the
// Captain's Surge: each built ship has its own, so it never touches another ship). A crystal's glow knows its cluster
// (group), and dims and sputters with it (the ship's looks, U: dress.js); a gun's muzzle glow moves with its gun (its
// rig), and hides as a broadside gun runs in. Kinds: 0 steady, 1 a crystal's slow pulse, 2 a lantern's flicker, 3 a
// treasure ship's glint (a four-pointed star that flashes now and then). A Man-o'-war's crystals beat like a heart
// (uBeat), and glow brighter while marked (uMark: dress.js)
function glowPoints(glows, U) {
  const pos = [], col = [], size = [], kind = [], group = [], rig = [];
  const c = new THREE.Color();
  for (const g of glows) {
    pos.push(g.p.x, g.p.y, g.p.z); c.set(g.color); col.push(c.r, c.g, c.b); size.push(g.size);
    kind.push(g.glint ? 3 : g.pulse ? 1 : g.flicker ? 2 : 0); group.push(g.group ?? 0); rig.push(...(g.rig ?? [0, 0, 0, 0]));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('size', new THREE.Float32BufferAttribute(size, 1));
  geo.setAttribute('kind', new THREE.Float32BufferAttribute(kind, 1));
  geo.setAttribute('group', new THREE.Float32BufferAttribute(group, 1));
  geo.setAttribute('rig', new THREE.Float32BufferAttribute(rig, 4));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uScale: { value: 400 }, uBoost: { value: 1 }, uCrys: U.uCrys, uSpark: U.uSpark, uMark: U.uMark, uBeat: { value: 0 }, ...rigUniforms(U) },
    vertexShader: `attribute float size; attribute float kind; attribute float group; varying vec3 vCol; varying float vA; varying float vKind; uniform float uTime; uniform float uScale; uniform float uBoost;
      uniform float uCrys[${CLUSTERS}]; uniform float uSpark; uniform float uMark; uniform float uBeat;
      ${RIG_GLSL}
      void main() {
        vec3 p = position, n = vec3(0.0);
        float hid = rigMove(p, n);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float ph = position.x * 3.1 + position.z * 1.7;
        float k = kind > 2.5 ? pow(max(0.0, sin(uTime * 0.8 + ph * 5.3)), 48.0) * 2.4
          : kind > 1.5 ? 0.88 + 0.08 * sin(uTime * 13.0 + ph) + 0.05 * sin(uTime * 7.3 + ph) : kind > 0.5 ? (0.86 + 0.14 * sin(uTime * 2.4 + ph)) * uBoost : 1.0;
        if (group > 0.5) {
          float h = fract(uTime * 0.8);
          k *= uCrys[clamp(int(group + 0.5) - 1, 0, ${CLUSTERS - 1})] * uSpark * (1.0 + 0.4 * uMark)
            * (1.0 + uBeat * (0.55 * (exp(-pow((h - 0.1) * 22.0, 2.0)) + 0.6 * exp(-pow((h - 0.3) * 22.0, 2.0))) - 0.12));
        }
        vCol = color; vA = k * (1.0 - hid); vKind = kind;
        gl_PointSize = min(size * k * uScale / -mv.z, 360.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `varying vec3 vCol; varying float vA; varying float vKind;
      void main() { vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0, a;
        if (vKind > 2.5) { vec2 e = abs(d) * 2.0; a = (max(exp(-26.0 * e.x) * (1.0 - e.y), exp(-26.0 * e.y) * (1.0 - e.x)) + pow(max(0.0, 1.0 - r), 6.0)) * vA; }
        else a = pow(max(0.0, 1.0 - r), 2.2) * 0.85 * vA;
        if (a < 0.003) discard; gl_FragColor = vec4(vCol * a, a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false; pts.renderOrder = 2;
  return pts;
}

// A treasure ship's glints: `n` points spread over her brass above the deck (her rails, her chests' gold, her castle),
// a fixed stride through them so they're the same every time. One on metal that moves (a spike at a yard's tip, a
// gun) carries its rig, so it moves with it: folding with her wing, say, never left twinkling in the air
function glints(built, hull, n, size) {
  const at = [], rigs = [];
  for (const key of ['brass', 'rigMetal']) {
    const g = built.get(key); if (!g) continue;
    const P = g.attributes.position, RG = g.attributes.rig;
    for (let i = 0; i < P.count; i += 3) {
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
      if (z > hull.zs && z < hull.zb && y > hull.deckY(z) + 0.3) { at.push(x, y, z); rigs.push(RG ? [RG.getX(i), RG.getY(i), RG.getZ(i), RG.getW(i)] : null); }
    }
  }
  const m = at.length / 3, out = [];
  for (let k = 0; k < Math.min(n, m); k++) { const i = Math.floor(((k * 0.618034) % 1) * m); out.push({ p: new THREE.Vector3(at[i * 3], at[i * 3 + 1], at[i * 3 + 2]), size, color: 0xfff1c0, glint: true, rig: rigs[i] }); }
  return out;
}

// How a ship rides the air: a slow sway, leaning into turns, nose up in a climb, heeling from her own broadsides
// (opts.heel, radians), listing towards the side that took the most hits as she fills with holes (opts.list, radians,
// + to starboard: src/game/looks.js), dipping at one end (opts.trim, radians, + bow down: a Man-o'-war whose crystal
// column there blew out), and the rudder swinging
export function shipMotion(R, body, rudders) {
  let t = Math.random() * 10;
  return (dt, opts = {}) => {
    t += dt;
    const sway = opts.calm ? 0.4 : 1;
    body.position.y = (Math.sin(t * 0.9) * 0.12 + Math.sin(t * 0.47) * 0.08) * sway * R.railScale;
    body.rotation.z = Math.sin(t * 0.6) * 0.012 * sway + (opts.turn ?? 0) * 0.16 + (opts.heel ?? 0) + (opts.list ?? 0); // a right turn (turn > 0) leans the ship to starboard
    body.rotation.x = Math.sin(t * 0.73) * 0.008 * sway - (opts.climb ?? 0) * 0.06 + (opts.trim ?? 0);
    for (const r of rudders) r.rotation.y = opts.turn != null ? -opts.turn * 0.5 : Math.sin(t * 0.35) * 0.25;
    return t;
  };
}

export function buildShip(R, level, art, opts = {}) {
  const q = detailFor(level, R);
  const ts = R.tileScale ?? 1;
  R.tiles = { planks: [4.67 * ts, 0.81 * ts], plates: [9.6 * ts, 2.1 * ts], deck: [2.65 * ts, 0.72 * ts], band: [4.93 * Math.max(0.6, ts), 0.61] };
  R.railScale = clamp(R.length / 25, 0.55, 1.2);
  const S = { ...commonShapes(q), rects: art.rects };
  const hull = makeHull(R);
  const batch = new Batch(), glows = [], lights = [], embers = [], wings = [];
  buildHull(hull, batch, q);
  brasswork(hull, batch, R, q, S);
  rails(hull, batch, R, q, S);
  guns(hull, batch, R, q, S, glows);
  clusters(hull, batch, R, q, S, glows, lights, embers);
  masts(hull, batch, R, q, S, glows, wings, opts);
  fins(hull, batch, R, q, S);
  bow(hull, batch, R, q, S, glows);
  lanterns(hull, batch, R, q, S, glows);
  deckworks(hull, batch, R, q, S, opts);
  // a raider captain's red eyes, either side of her bow, on her dark planks just under the brass band along her side:
  // a hot core in a red glare
  if (opts.captain) {
    const z = hull.zb - 0.08 * R.length, k = R.railScale, y = (R.bands?.sheer ? Math.min(...R.bands.sheer) : hull.rim(z) - 0.6) - 0.35 * k;
    for (const side of [1, -1]) {
      const p = new THREE.Vector3(side * (hull.half(z) + 0.3 * k), y, z);
      glows.push({ p, size: 3.2 * k, color: 0xff1a10, flicker: true }, { p, size: 1.3 * k, color: 0xffc090, flicker: true });
    }
  }

  // her own looks (her scars: dress.js), read by her own copies of the materials that show them, her glows and sparks
  const U = makeLook();
  const root = new THREE.Group(); root.name = R.name;
  const body = new THREE.Group(); root.add(body);
  const stats = { triangles: 0, parts: {}, drawCalls: 0 };
  const addMeshes = (map, parent) => {
    for (const [key, geo] of map) {
      const mesh = new THREE.Mesh(geo, art.M[key]);
      mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = key;
      parent.add(mesh);
      const n = triangles(geo); stats.triangles += n; stats.parts[key] = (stats.parts[key] ?? 0) + n; stats.drawCalls++;
    }
  };
  const meshes = batch.build();
  if (opts.treasure) glows.push(...glints(meshes, hull, 36, 1.1 * R.railScale));
  addMeshes(meshes, body);
  const rud = rudder(hull, R, q, S), rudderPivot = new THREE.Group();
  rudderPivot.matrixAutoUpdate = false; rudderPivot.matrix.copy(rud.pivot);
  const rudderTurn = new THREE.Group(); rudderTurn.name = 'rudder'; rudderPivot.add(rudderTurn); body.add(rudderPivot);
  addMeshes(rud.batch.build(), rudderTurn);
  dress(body, art.M, U);
  const glow = glowPoints(glows, U); glow.name = 'glow'; body.add(glow); stats.drawCalls++;
  const sparks = level === 'far' ? null : emberPoints(embers, level === 'full' ? 14 : 5, U);
  if (sparks) { sparks.name = 'embers'; body.add(sparks); stats.drawCalls++; }
  const lamps = [];
  if (q.lights) for (const L of lights) {
    const pl = new THREE.PointLight(0xffa64d, L.power * 6, 5 + R.length * 0.25, 2);
    pl.position.copy(L.p); body.add(pl); lamps.push(pl);
  }
  const bounds = new THREE.Box3().setFromObject(body);
  const move = shipMotion(R, body, [rudderTurn]);
  function update(dt, opts = {}) {
    const t = move(dt, opts);
    glow.material.uniforms.uTime.value = t;
    if (sparks) { sparks.material.uniforms.uTime.value = t; sparks.material.uniforms.uScale.value = glow.material.uniforms.uScale.value; }
    // (each cluster's lamp dims and sputters with it)
    for (let i = 0; i < lamps.length; i++) lamps[i].intensity = (0.88 + Math.sin(t * 2.4 + i) * 0.12) * lights[i].power * 6 * U.uCrys.value[i] * U.uSpark.value;
  }
  return { root, body, update, stats, bounds, glow, sparks, length: R.length, recipe: R, level, hull, U, wings, M: art.M, lamps, opts };
}
