// build.js: puts a ship together from its recipe (src/ships/*.js) at one of three levels of detail, the "detail
// dial" in docs/ships.md: full (about 100,000 triangles, for the Captain's own ship and anything alongside),
// middle (about a fifth of that) and far (a few thousand, for ships small on screen). Every material's pieces are
// joined into one mesh, so a ship is about a dozen draw calls at any level.
import * as THREE from 'three';
import { Batch, clamp, triangles } from './kit.js';
import { makeHull, buildHull } from './hull.js';
import { commonShapes, brasswork, rails, guns, clusters, masts, fins, rudder, bow, lanterns, deckworks } from './parts.js';

export const LEVELS = {
  full: { stations: 150, rings: 32, deckAcross: 5, latheSeg: 16, tubeRad: 6, tubePer: 5, balusterStep: 1, railPath: 0.2, ropeRad: 4, sailDiv: 14, rivetStep: 1,
    ratlines: true, rivets: true, allCrystals: true, portGuns: true, portLids: true, cargo: true, lights: true },
  middle: { stations: 44, rings: 11, deckAcross: 2, latheSeg: 8, tubeRad: 4, tubePer: 2, balusterStep: 3, railPath: 0.5, ropeRad: 3, sailDiv: 4, rivetStep: 1,
    ratlines: false, rivets: false, allCrystals: true, portGuns: true, portLids: false, cargo: false, lights: false },
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

// Embers: sparks of sunstone light drifting up off every crystal, as on the Magpie
function emberPoints(embers, per) {
  const pos = [], seed = [], spread = [];
  embers.forEach((e, i) => { for (let k = 0; k < per; k++) { pos.push(e.p.x, e.p.y, e.p.z); seed.push(i * 13.7 + k * 1.618); spread.push(e.r, e.h); } });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('seed', new THREE.Float32BufferAttribute(seed, 1));
  geo.setAttribute('spread', new THREE.Float32BufferAttribute(spread, 2));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uScale: { value: 400 } },
    vertexShader: `attribute float seed; attribute vec2 spread; uniform float uTime; uniform float uScale; varying float vA; varying float vHot;
      float h1(float n) { return fract(sin(n) * 43758.5453); }
      void main() {
        float life = fract(uTime * (0.22 + 0.12 * h1(seed)) + h1(seed * 1.3));
        float a = h1(seed * 2.1) * 6.2831 + uTime * (0.6 + h1(seed) * 0.8);
        vec3 p = position + vec3(cos(a) * spread.x * (0.3 + life * 0.9), life * spread.y * 1.6, sin(a) * spread.x * (0.3 + life * 0.9));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vA = smoothstep(0.0, 0.12, life) * (1.0 - life); vHot = 1.0 - life;
        gl_PointSize = (0.05 + 0.06 * h1(seed * 3.3)) * spread.y * uScale / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `varying float vA; varying float vHot;
      void main() { float r = length(gl_PointCoord - 0.5) * 2.0; float a = pow(max(0.0, 1.0 - r), 1.5) * vA;
        if (a < 0.01) discard; gl_FragColor = vec4(mix(vec3(1.0, 0.45, 0.1), vec3(1.0, 0.9, 0.55), vHot) * a, a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false; pts.renderOrder = 3;
  return pts;
}

// The glows: one batch of soft points for every crystal, lantern and gun muzzle
function glowPoints(glows) {
  const pos = [], col = [], size = [], kind = [];
  const c = new THREE.Color();
  for (const g of glows) {
    pos.push(g.p.x, g.p.y, g.p.z); c.set(g.color); col.push(c.r, c.g, c.b); size.push(g.size);
    kind.push(g.pulse ? 1 : g.flicker ? 2 : 0);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('size', new THREE.Float32BufferAttribute(size, 1));
  geo.setAttribute('kind', new THREE.Float32BufferAttribute(kind, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uScale: { value: 400 } },
    vertexShader: `attribute float size; attribute float kind; varying vec3 vCol; varying float vA; uniform float uTime; uniform float uScale;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float ph = position.x * 3.1 + position.z * 1.7;
        float k = kind > 1.5 ? 0.88 + 0.08 * sin(uTime * 13.0 + ph) + 0.05 * sin(uTime * 7.3 + ph) : kind > 0.5 ? 0.86 + 0.14 * sin(uTime * 2.4 + ph) : 1.0;
        vCol = color; vA = k;
        gl_PointSize = min(size * k * uScale / -mv.z, 360.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `varying vec3 vCol; varying float vA;
      void main() { vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0; float a = pow(max(0.0, 1.0 - r), 2.2) * 0.85 * vA;
        if (a < 0.003) discard; gl_FragColor = vec4(vCol * a, a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false; pts.renderOrder = 2;
  return pts;
}

// How a ship rides the air: a slow sway, leaning into turns, nose up in a climb, and the rudder swinging
export function shipMotion(R, body, rudders) {
  let t = Math.random() * 10;
  return (dt, opts = {}) => {
    t += dt;
    const sway = opts.calm ? 0.4 : 1;
    body.position.y = (Math.sin(t * 0.9) * 0.12 + Math.sin(t * 0.47) * 0.08) * sway * R.railScale;
    body.rotation.z = Math.sin(t * 0.6) * 0.012 * sway + (opts.turn ?? 0) * 0.16; // a right turn (turn > 0) leans the ship to starboard
    body.rotation.x = Math.sin(t * 0.73) * 0.008 * sway - (opts.climb ?? 0) * 0.06;
    for (const r of rudders) r.rotation.y = opts.turn != null ? -opts.turn * 0.5 : Math.sin(t * 0.35) * 0.25;
    return t;
  };
}

export function buildShip(R, level, art) {
  const q = detailFor(level, R);
  const ts = R.tileScale ?? 1;
  R.tiles = { planks: [4.67 * ts, 0.81 * ts], plates: [9.6 * ts, 2.1 * ts], deck: [2.65 * ts, 0.72 * ts], band: [4.93 * Math.max(0.6, ts), 0.61] };
  R.railScale = clamp(R.length / 25, 0.55, 1.2);
  const S = { ...commonShapes(q), rects: art.rects };
  const hull = makeHull(R);
  const batch = new Batch(), glows = [], lights = [], embers = [];
  buildHull(hull, batch, q);
  brasswork(hull, batch, R, q, S);
  rails(hull, batch, R, q, S);
  guns(hull, batch, R, q, S, glows);
  clusters(hull, batch, R, q, S, glows, lights, embers);
  masts(hull, batch, R, q, S, glows);
  fins(hull, batch, R, q, S);
  bow(hull, batch, R, q, S, glows);
  lanterns(hull, batch, R, q, S, glows);
  deckworks(hull, batch, R, q, S);

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
  addMeshes(batch.build(), body);
  const rud = rudder(hull, R, q, S), rudderPivot = new THREE.Group();
  rudderPivot.matrixAutoUpdate = false; rudderPivot.matrix.copy(rud.pivot);
  const rudderTurn = new THREE.Group(); rudderTurn.name = 'rudder'; rudderPivot.add(rudderTurn); body.add(rudderPivot);
  addMeshes(rud.batch.build(), rudderTurn);
  const glow = glowPoints(glows); glow.name = 'glow'; body.add(glow); stats.drawCalls++;
  const sparks = level === 'far' ? null : emberPoints(embers, level === 'full' ? 14 : 5);
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
    for (const [i, pl] of lamps.entries()) pl.intensity = (0.88 + Math.sin(t * 2.4 + i) * 0.12) * lights[i].power * 6;
  }
  return { root, body, update, stats, bounds, glow, length: R.length, recipe: R, level, hull };
}
