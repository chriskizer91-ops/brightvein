// sites.js: the places to raid, and how they look. Baron Tallow's crews hold rocks lifted on stolen sunstone around
// Brightvein: a prospect camp, the Redspire outpost and the Chandlery, his citadel; and his supply galleon, the
// Wickmoor, runs between them. Act two adds the Gilded Exchange's two: the Plumbline, a survey rig off Hollowcrest, and
// the Grindstone, a dredge that drills under the claim's south cliff. And two that aren't places to take: the Brass
// Road convoy (bring the ore barges home) and the storm front (fly the Thinwatch's beacons before it closes).
// Each place has its own objective and its own set piece or boss (raids.js runs them). Taken, a place is manned again
// after a few days on the claim (regrow), and pays less the next time (REPEAT). A wanted jumper captain turns up on the
// map now and then (makeBounty). The crates are opened at home with the Armory's raid tables (src/claim/loot.js RAIDS).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { HOME } from './world.js';

// a place raided again pays this much of the first time (crates, shards, chances), and the bosses don't come back
export const REPEAT = 0.5;
// x, z: where on the map (metres; HOME is Brightvein); y: the rock's top. size: its radius. guard: the jumper ships that
// come out, wave by wave (captain: which ship in the wave leads it, or -1). crates: as the loot table's (RAIDS).
// kind: how the raid runs (raids.js). stars: how hard, 1 to 5. ship: the smallest ship that should try it.
// pays: what's in it, for the Dock's raid map. ch: hidden in the Dock's list until that chapter.
export const SITES = [
  { id: 'camp', loot: 'camp', kind: 'rock', name: "Tallow's prospect camp", short: 'Prospect camp', x: HOME.x - 2100, z: HOME.z - 1500, y: 600, size: 34,
    line: 'Tents on a lifted rock, two skiffs on guard and one gun.', goal: 'Silence the gun and the camp strikes its colours',
    towers: 1, guard: [{ ids: ['skiff'], captain: -1 }, { ids: ['skiff', 'skiff'], captain: -1 }], crates: 2, regrow: 1, after: null, stars: 1, ship: 'skiff', pays: 'Gear and modules, Brass Scrap' },
  { id: 'outpost', loot: 'outpost', kind: 'rock', spire: true, name: 'The Redspire outpost', short: 'Redspire', x: HOME.x - 3700, z: HOME.z + 1700, y: 640, size: 52,
    line: 'A red crag with a palisade, three gun towers, a great gun on its spire and a cutter crew.', goal: 'Silence every gun, the great one on the spire too, and Redspire strikes',
    towers: 3, guard: [{ ids: ['cutter', 'skiff'], captain: -1 }, { ids: ['cutter', 'cutter'], captain: 0 }], crates: 3, regrow: 2, after: 'camp', stars: 2, ship: 'cutter', pays: 'Better gear, a chance of a Masterwork' },
  { id: 'galleon', loot: 'airship', kind: 'galleon', name: 'The supply galleon Wickmoor', short: 'The Wickmoor', x: HOME.x - 1300, z: HOME.z + 4200, y: 720, size: 0, moving: true,
    line: 'Tallow\'s treasure ship, under escort, with a brig coming to help.', goal: 'Shoot her sails until she strikes. Sink her and her crates go down with her',
    towers: 0, guard: [{ ids: ['galleon', 'cutter', 'skiff'], captain: -1 }, { ids: ['brig'], captain: -1 }], crates: 3, regrow: 2, after: 'outpost', stars: 2, ship: 'cutter', pays: 'A Lark part likely, Heartstone' },
  { id: 'citadel', loot: 'citadel', kind: 'citadel', name: 'The Chandlery, Baron Tallow\'s citadel', short: 'The Chandlery', x: HOME.x + 2200, z: HOME.z + 4300, y: 760, size: 86,
    line: 'A fortress of candle-works on a great lifted rock. Six gun towers, the Baron\'s frigate, and his own flagship somewhere under the rock.', goal: 'Silence the Chandlery’s guns and bring down Tallow’s flagship',
    towers: 6, guard: [{ ids: ['frigate', 'brig'], captain: -1 }, { ids: ['cutter', 'cutter'], captain: -1 }], crates: 5, regrow: 4, after: 'galleon', stars: 4, ship: 'brig', pays: 'Five crates, a Masterwork likely, Heartstone' },
  { id: 'survey', loot: 'survey', kind: 'rock', winches: true, name: 'The Plumbline, the Exchange\'s survey rig', short: 'The Plumbline', x: HOME.x + 3000, z: HOME.z - 1300, y: 660, size: 46, ch: 11, flag: 'silver', look: 'silver',
    line: 'A survey rig on a lifted rock off Hollowcrest: brass derricks, very long drills, two gun towers and an escort under silver sails.', goal: 'Cut its three drill strings: shoot the winches on top of the derricks',
    towers: 2, guard: [{ ids: ['cutter', 'cutter'], captain: -1 }, { ids: ['brig', 'cutter'], captain: 0 }], crates: 3, regrow: 3, after: 'citadel', stars: 3, ship: 'brig', pays: 'Lark parts, modules, Cut Glass' },
  { id: 'dredge', loot: 'dredge', kind: 'dredge', name: 'The Grindstone, the Exchange\'s dredge', short: 'The Grindstone', x: HOME.x + 500, z: HOME.z + 2700, y: 640, size: 0, moving: true, ch: 14, look: 'silver',
    line: 'A great dredge with a drill on her bow, cutting into the cliff under the claim, with a frigate and a brig to guard her.', goal: 'Knock out her two drill engines before she’s through, then sink her',
    towers: 0, guard: [{ ids: ['frigate', 'brig'], captain: -1 }, { ids: ['cutter', 'cutter', 'brig'], captain: -1 }], crates: 5, regrow: 6, after: 'survey', stars: 5, ship: 'frigate', pays: 'Five crates, a Lark part, a Masterwork likely',
    // sunk, her wreck draws the Exchange's salvagers: a galleon to make strike, and her guards
    repeatGuard: [{ ids: ['galleon', 'brig', 'cutter'], captain: -1 }, { ids: ['frigate'], captain: -1 }] },
  { id: 'convoy', loot: 'convoy', kind: 'convoy', name: 'The Brass Road convoy', short: 'The convoy', x: HOME.x - 3300, z: HOME.z + 2900, y: 700, size: 0, moving: true, ch: 3,
    line: 'Three of the claim\'s ore barges, coming home up the Brass Road with jumpers waiting in the cloud.', goal: 'Bring the ore barges home to Brightvein',
    towers: 0, guard: [{ ids: ['skiff', 'skiff'], captain: -1 }, { ids: ['cutter', 'skiff', 'skiff'], captain: -1 }, { ids: ['brig', 'cutter'], captain: 0 }], crates: 2, regrow: 2, after: 'camp', stars: 2, ship: 'cutter', pays: 'More for every barge home, Brass Scrap' },
  { id: 'storm', loot: 'storm', kind: 'storm', name: 'The storm front', short: 'The storm front', x: HOME.x + 3600, z: HOME.z + 900, y: 900, size: 0, moving: true, ch: 7,
    line: 'A wall of Aether storm over the gorge, and a Thinwatch strongbox in a wreck at its eye. Its beacons still burn.', goal: 'Fly through the Thinwatch beacons before the front closes',
    towers: 0, guard: [{ ids: ['skiff', 'skiff'], captain: -1 }], crates: 3, regrow: 2, after: 'outpost', stars: 3, ship: 'skiff', rings: 8, pays: 'Glass and Heartstone, a chance of a Masterwork' },
];

// ---------- wanted: a jumper captain on the map for a big reward ----------
const WANTED = [
  ['Ottoline Grieve', 'the Rook'], ['Hollis Vane', 'Tinder'], ['Mags Corrie', 'the Red Hand'], ['Ezra Blackwick', 'the Snuffer of Lamps'],
  ['Dellah Rusk', 'Six Sails'], ['Fenwick Marr', 'Old Iron'], ['Jessamy Coil', 'the Gull'], ['Barrow Twine', 'the Knot'],
  ['Silas Embry', 'Ember'], ['Wren Halloway', 'the Quiet Gun'], ['Gideon Stave', 'the Plank'], ['Ida Sallow', 'Wax-Eyes'],
];
// a fresh bounty for this claim day and chapter: a captain in a ship that grows with the story, a place on the map, a
// reward, and three days before she moves on
export function makeBounty(day, ch, n = 0) {
  const [name, nick] = WANTED[(day * 7 + n * 5) % WANTED.length];
  const ship = ch >= 12 ? 'manowar' : ch >= 9 ? 'frigate' : ch >= 5 ? 'brig' : 'cutter';
  const escorts = { cutter: ['skiff', 'skiff'], brig: ['cutter', 'skiff'], frigate: ['brig', 'cutter'], manowar: ['frigate', 'cutter', 'cutter'] }[ship];
  const a = ((day * 2.39 + n) % 6.283), d = 2600 + ((day * 977) % 1400);
  const reward = { cutter: 250, brig: 450, frigate: 800, manowar: 1400 }[ship];
  return { name, nick, ship, escorts, x: HOME.x + Math.sin(a) * d, z: HOME.z + Math.cos(a) * d, until: day + 3, reward, n };
}
// the bounty as a raid site
export function bountySite(B) {
  return { id: 'bounty', loot: 'bounty', kind: 'bounty', name: `Wanted: ${B.name}, “${B.nick}”`, short: B.name, x: B.x, z: B.z, y: 760, size: 0, moving: true,
    line: `${B.name}, called ${B.nick}, sails a jumper ${B.ship === 'manowar' ? 'Man-o\'-war' : B.ship} with ${B.escorts.length} escorts. The Thinwatch pays well for her.`,
    goal: `Bring down ${B.name}`, towers: 0, guard: [{ ids: [B.ship, ...B.escorts], captain: 0 }], crates: 2, regrow: 0, stars: { cutter: 2, brig: 3, frigate: 4, manowar: 5 }[B.ship], ship: B.ship === 'cutter' ? 'cutter' : B.ship === 'brig' ? 'brig' : 'frigate', bounty: B, pays: `◆ ${B.reward} on her head, and her strongbox` };
}

const rnd = (a) => { const x = Math.sin(a * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// ---------- the models: a rock lifted on sunstone, with the jumpers' camp on top ----------
export function materials() {
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.9, ...o });
  return {
    rock: std({ color: 0x8a7462, flatShading: true }),
    red: std({ color: 0xa4523a, flatShading: true }),
    cliff: std({ color: 0x7c6a60, flatShading: true }),
    earth: std({ color: 0x7a6748 }),
    plank: std({ color: 0x8a6446, roughness: 0.85 }),
    dark: std({ color: 0x4a3426 }),
    tent: std({ color: 0xc8735c, side: THREE.DoubleSide }),
    pale: std({ color: 0xd8c7a6, side: THREE.DoubleSide }),
    roof: std({ color: 0x4d4a52 }),
    stone: std({ color: 0xa69a8a, flatShading: true }),
    brass: std({ color: 0xd9a743, metalness: 0.85, roughness: 0.35 }),
    iron: std({ color: 0x3c3a3e, metalness: 0.6, roughness: 0.5 }),
    steel: std({ color: 0x8a8e96, metalness: 0.8, roughness: 0.35, flatShading: true }),
    crystal: std({ color: 0xffb04a, emissive: 0xff7a1a, emissiveIntensity: 1.6, roughness: 0.2, flatShading: true }),
    flag: std({ color: 0xffffff, vertexColors: true, side: THREE.DoubleSide, roughness: 0.9 }),
    candle: std({ color: 0xefe2c2, roughness: 0.7 }),
    flame: new THREE.MeshBasicMaterial({ color: 0xffc86a, toneMapped: false }),
    beacon: new THREE.MeshBasicMaterial({ color: 0x9fe7ff, toneMapped: false, transparent: true, opacity: 0.9 }),
    beaconOn: new THREE.MeshBasicMaterial({ color: 0xffd27a, toneMapped: false, transparent: true, opacity: 0.55 }),
  };
}

// pieces collected by material, then merged into one mesh each
function pieces() {
  const by = new Map();
  return {
    add(geo, mat, x, y, z, ry = 0, rx = 0, rz = 0) {
      const g = geo.index ? geo.toNonIndexed() : geo.clone();
      g.deleteAttribute('uv');
      g.applyMatrix4(new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), V(1, 1, 1)));
      if (!by.has(mat)) by.set(mat, []);
      by.get(mat).push(g);
    },
    build(group) {
      for (const [mat, list] of by) {
        const m = new THREE.Mesh(mergeGeometries(list), mat); m.castShadow = true; m.receiveShadow = true; group.add(m);
      }
    },
  };
}

// the jumpers' flag: rust red with a black hoist (Brightvein's, once taken: plum with a gold hoist)
// (the Exchange's: silver with a gold hoist)
const FLAGS = { jumpers: [[0.08, 0.06, 0.06], [0.7, 0.1, 0.07]], silver: [[0.85, 0.66, 0.22], [0.82, 0.85, 0.9]], ours: [[0.9, 0.7, 0.25], [0.3, 0.1, 0.25]] };
function flagGeo(w = 5, h = 3) {
  const g = new THREE.PlaneGeometry(w, h, 6, 1).translate(w / 2, 0, 0);
  const c = [], p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const hoist = p.getX(i) < w * 0.2; c.push(...(hoist ? FLAGS.jumpers[0] : FLAGS.jumpers[1])); p.setZ(i, Math.sin(p.getX(i) * 0.9) * 0.3); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  return g;
}
export function colourFlag(flag, ours) {
  const c = flag.geometry.attributes.color, p = flag.geometry.attributes.position, w = flag.userData.w, F = FLAGS[ours ? 'ours' : flag.userData.kind || 'jumpers'];
  for (let i = 0; i < c.count; i++) { const hoist = p.getX(i) < w * 0.2; c.setXYZ(i, ...(hoist ? F[0] : F[1])); }
  c.needsUpdate = true;
}

function buildRock(def, M, P) {
  const R = def.size, depth = R * 1.5, seed = def.id.length * 13.1;
  // the underside: a rough upside-down cone of rock
  const prof = [];
  for (let i = 0; i <= 8; i++) { const k = i / 8; prof.push(new THREE.Vector2(R * (1 - Math.pow(k, 1.6)) * (1 + (rnd(seed + i) - 0.5) * 0.18) + 0.01, -k * depth)); }
  const under = new THREE.LatheGeometry(prof, 22);
  const p = under.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x), k = 1 + (rnd(seed + Math.round(a * 7) * 3.1 + Math.round(y / 4)) - 0.5) * 0.28 * Math.min(1, -y / 4 + 0.2);
    p.setXYZ(i, x * k, y, z * k);
  }
  under.computeVertexNormals();
  P.add(under, def.id === 'outpost' ? M.red : M.rock, 0, 0, 0);
  // the top: packed earth
  P.add(new THREE.CylinderGeometry(R * 0.995, R * 0.98, 1.2, 22), M.earth, 0, -0.6, 0);
  // the sunstone that lifts it, glowing through the underside
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4 + seed, r = R * (0.3 + 0.45 * rnd(seed + i * 5)), y = -depth * (0.25 + 0.35 * rnd(seed + i * 7));
    const g = new THREE.OctahedronGeometry(1, 0).scale(R * 0.05, R * 0.16, R * 0.05);
    P.add(g, M.crystal, Math.cos(a) * r, y, Math.sin(a) * r, 0, Math.cos(a) * 0.5, Math.sin(a) * 0.5);
  }
  return depth;
}
function tent(P, M, x, z, r = 2.6, ry = 0) {
  P.add(new THREE.ConeGeometry(r, r * 1.4, 6), M.tent, x, r * 0.7, z, ry);
  P.add(new THREE.CylinderGeometry(0.08, 0.08, r * 1.7, 5), M.dark, x, r * 0.85, z);
}
function shed(P, M, x, z, w, d, h, ry = 0) {
  P.add(new THREE.BoxGeometry(w, h, d), M.plank, x, h / 2, z, ry);
  const roof = new THREE.ConeGeometry(Math.hypot(w, d) * 0.56, h * 0.6, 4).rotateY(Math.PI / 4).scale(w / Math.hypot(w, d) * 1.42, 1, d / Math.hypot(w, d) * 1.42);
  P.add(roof, M.roof, x, h + h * 0.3, z, ry);
}
// a gun tower: four legs, a platform, and a brass gun that turns to follow you (a separate piece, so it can turn).
// y0 lifts the whole tower (the great gun on Redspire's spire); big makes the gun heavier-looking
function tower(group, P, M, x, z, h = 7, { y0 = 0, big = 1, legs = true } = {}) {
  if (legs) for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) P.add(new THREE.BoxGeometry(0.4, h, 0.4), M.plank, x + dx * 1.3, y0 + h / 2, z + dz * 1.3);
  P.add(new THREE.BoxGeometry(3.6 * big, 0.4, 3.6 * big), M.dark, x, y0 + h, z);
  const head = new THREE.Group(); head.position.set(x, y0 + h + 0.2, z); group.add(head);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.1 * big, 1.3 * big, 0.9 * big, 10), M.iron); base.position.y = 0.45 * big; base.castShadow = true; head.add(base);
  const barrel = new THREE.Group(); barrel.position.y = 1.2 * big; head.add(barrel);
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.32 * big, 0.45 * big, 3.6 * big, 10).rotateX(Math.PI / 2).translate(0, 0, 1.4 * big), M.brass); tube.castShadow = true; barrel.add(tube);
  const lens = new THREE.Mesh(new THREE.SphereGeometry(0.36 * big, 8, 6).translate(0, 0, 3.2 * big), M.crystal); barrel.add(lens);
  return { head, barrel, local: V(x, y0 + h + 1.4 * big, z), big };
}
// a derrick's winch on the Plumbline: a drum of cable and a glowing governor; shoot it and the drill string falls
function winch(group, M, x, y, z) {
  const head = new THREE.Group(); head.position.set(x, y, z); group.add(head);
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 2.6, 12).rotateZ(Math.PI / 2), M.iron); drum.castShadow = true; head.add(drum);
  for (const sx of [-1, 1]) { const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 0.2, 12).rotateZ(Math.PI / 2), M.brass); cap.position.x = sx * 1.35; head.add(cap); }
  const gov = new THREE.Mesh(new THREE.OctahedronGeometry(0.7, 0), M.crystal); gov.position.y = 1.5; head.add(gov);
  return { head, barrel: gov, local: V(x, y + 0.4, z), big: 1, silent: true };
}

export function buildSite(def, M) {
  const group = new THREE.Group(), P = pieces(), R = def.size, towers = [], strings = [];
  const depth = buildRock(def, M, P);
  // a palisade round the edge, open towards the landing stage
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.25) continue;
    P.add(new THREE.CylinderGeometry(0.25, 0.3, 2.8, 5), M.dark, Math.cos(a) * R * 0.94, 1.4, Math.sin(a) * R * 0.94);
  }
  // a landing stage out over the edge
  P.add(new THREE.BoxGeometry(10, 0.4, 3), M.plank, R + 3, 0.2, 0);
  if (def.id === 'camp') {
    tent(P, M, -8, 6, 3); tent(P, M, -2, -10, 2.6, 0.5); tent(P, M, 7, 9, 2.8, 1); tent(P, M, -12, -4, 2.4);
    shed(P, M, 6, -6, 7, 5, 3.2, 0.3);
    for (let i = 0; i < 6; i++) P.add(new THREE.CylinderGeometry(0.45, 0.45, 1, 8), M.plank, 12 + (i % 3) * 1, 0.5, -2 + Math.floor(i / 3) * 1.1);
  } else if (def.id === 'outpost') {
    // the red spire the outpost is named for, with a lookout on top, and the great gun on the lookout
    P.add(new THREE.ConeGeometry(9, 34, 7), M.red, -14, 17, -10);
    P.add(new THREE.BoxGeometry(5, 3, 5), M.plank, -14, 28, -10);
    shed(P, M, 8, 10, 10, 7, 4, 0.2); shed(P, M, 14, -10, 8, 6, 3.6, -0.3); shed(P, M, -2, 18, 7, 6, 3.4, 0.9);
    tent(P, M, 20, 4, 3); tent(P, M, -20, 14, 2.8);
    const t = tower(group, P, M, -14, -10, 0.4, { y0: 29.5, big: 1.7, legs: false }); t.spire = true; towers.push(t);
  } else if (def.id === 'citadel') {
    // the Chandlery: a stone keep with tall chimneys, candle-vats and a great candle burning on its roof
    P.add(new THREE.BoxGeometry(34, 16, 26), M.stone, 0, 8, 0);
    P.add(new THREE.BoxGeometry(22, 8, 16), M.stone, 0, 20, 0);
    for (const [x, z] of [[-14, -10], [14, -10], [-14, 10], [14, 10]]) P.add(new THREE.CylinderGeometry(4, 4.4, 26, 10), M.stone, x, 13, z);
    for (const [x, z] of [[-14, -10], [14, -10], [-14, 10], [14, 10]]) P.add(new THREE.ConeGeometry(5, 7, 10), M.roof, x, 29.5, z);
    for (const [x, z] of [[-30, 22], [26, 30], [36, -18], [-40, -16]]) shed(P, M, x, z, 12, 8, 5, Math.atan2(z, x));
    for (let i = 0; i < 4; i++) P.add(new THREE.CylinderGeometry(1.4, 1.8, 18, 8), M.stone, -6 + i * 4, 32, 4);
    P.add(new THREE.CylinderGeometry(2.4, 2.4, 9, 12), M.candle, 0, 28.5, -3);
    P.add(new THREE.ConeGeometry(1.1, 3.4, 8), M.flame, 0, 34.6, -3);
    for (let i = 0; i < 6; i++) P.add(new THREE.CylinderGeometry(3, 3, 3, 12), M.dark, 20 + (i % 3) * 7, 1.5, -40 + Math.floor(i / 3) * 7);
    // the docks under the rock, where the Baron keeps his flagship: a great timber cradle hanging off the underside
    for (const sx of [-1, 1]) P.add(new THREE.BoxGeometry(3, 3, 70), M.dark, sx * 16, -depth * 0.35, R * 0.15);
    for (let i = 0; i < 5; i++) P.add(new THREE.BoxGeometry(36, 2, 2.4), M.plank, 0, -depth * 0.35 - 1, R * 0.15 - 28 + i * 14);
  } else if (def.id === 'survey') {
    // the Plumbline: three brass derricks with their drill strings hanging down past the rock, and a counting-house
    for (const [x, z, h] of [[-12, -8, 22], [10, -12, 26], [-2, 14, 20]]) {
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) P.add(new THREE.CylinderGeometry(0.22, 0.32, h, 5), M.brass, x + dx * 2.2 * 0.5, h / 2, z + dz * 2.2 * 0.5, 0, dz * 0.09, -dx * 0.09);
      for (let k = 1; k < 4; k++) P.add(new THREE.BoxGeometry(2.6 - k * 0.4, 0.18, 2.6 - k * 0.4), M.iron, x, h * k / 4, z);
      // the drill string, its own piece so it can fall when the winch is shot
      const str = new THREE.Group(); str.position.set(x, 0, z); group.add(str);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, h + 26, 6), M.iron); rod.position.y = h / 2 - 13; rod.castShadow = true; str.add(rod);
      const bit = new THREE.Mesh(new THREE.ConeGeometry(0.7, 2.4, 8).rotateX(Math.PI), M.iron); bit.position.y = -26.5; str.add(bit);
      strings.push(str);
      if (def.winches) { const w = winch(group, M, x, h + 1.4, z); w.string = str; towers.push(w); }
    }
    shed(P, M, 14, 10, 12, 8, 5, 0.2); shed(P, M, -18, 10, 7, 6, 3.6, -0.4);
    P.add(new THREE.BoxGeometry(12.2, 0.6, 8.2), M.stone, 14, 0.3, 10, 0.2);
    for (let i = 0; i < 5; i++) P.add(new THREE.CylinderGeometry(0.5, 0.5, 6, 8), M.iron, 22 - i * 1.2, 0.5, -20, 0, 0, Math.PI / 2);
  }
  // the gun towers, round the edge
  for (let i = 0; i < def.towers; i++) {
    const a = 0.9 + (i / def.towers) * Math.PI * 2, r = R * 0.78;
    towers.push(tower(group, P, M, Math.cos(a) * r, Math.sin(a) * r, def.id === 'citadel' ? 10 : 7));
  }
  P.build(group);
  // the flag, high on a pole
  const poleH = def.id === 'citadel' ? 46 : def.id === 'outpost' ? 36 : 14, px = def.id === 'outpost' ? -10 : 0, pz = def.id === 'outpost' ? -6 : 0;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, poleH, 6), M.dark); pole.position.set(px, poleH / 2, pz); group.add(pole);
  const flag = new THREE.Mesh(flagGeo(def.id === 'citadel' ? 9 : 5, def.id === 'citadel' ? 5 : 3), M.flag); flag.position.set(px, poleH - 2, pz); flag.userData.w = def.id === 'citadel' ? 9 : 5; flag.userData.kind = def.flag || 'jumpers'; group.add(flag);
  return { group, towers, flag, depth, strings };
}

// ---------- the Grindstone's set: the cliff she's cutting into, and her drill ----------
// a cliff face rising out of the cloud, ~420 m across and 600 m tall, its face towards +z: banded rock, red and ochre
// and grey, broken into buttresses, with sunstone glinting in its seams and a glowing wound where the drill bites
export function buildCliff(M) {
  const group = new THREE.Group(), W = 420, H = 600, D = 160;
  const g = new THREE.BoxGeometry(W, H, D, 30, 36, 3).toNonIndexed(), p = g.attributes.position, col = [];
  // the bands, as sRGB: rust, ochre, grey-violet, sand, slate, red
  const BANDS = [[0.5, 0.33, 0.27], [0.6, 0.45, 0.3], [0.42, 0.36, 0.38], [0.64, 0.52, 0.4], [0.36, 0.33, 0.34], [0.55, 0.3, 0.24]].map((c) => new THREE.Color().setRGB(...c, THREE.SRGBColorSpace));
  const bump = (x, y) => (rnd(Math.round(x / 19) * 3.7 + Math.round(y / 21) * 1.3) - 0.5) * 26 + Math.sin(y / 37 + x / 61) * 14 + Math.sin(x / 23) * 9 + (rnd(Math.round(x / 70) * 9.1) - 0.5) * 40;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (z > 0) z += bump(x, y);                                        // the face: buttresses and gullies
    if (y > H / 2 - 1) y += (rnd(Math.round(x / 30) * 2.3) - 0.5) * 70 - 20; // a broken skyline
    x += (rnd(y * 0.13 + z * 0.7) - 0.5) * 6;
    p.setXYZ(i, x, y, z);
    const band = BANDS[((Math.floor((y + H / 2 + Math.sin(x / 50) * 12) / 34) % BANDS.length) + BANDS.length) % BANDS.length], k = 0.5 + rnd(Math.round(x / 9) + Math.round(y / 9) * 7.7) * 0.3;
    col.push(band.r * k, band.g * k, band.b * k);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const rockM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true });
  const rock = new THREE.Mesh(g, rockM); rock.position.set(0, -H / 2 + 120, 0); rock.receiveShadow = true; rock.castShadow = true; group.add(rock);
  // sunstone in the seams
  for (let i = 0; i < 40; i++) {
    const c = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0).scale(2.5, 7, 2.5), M.crystal);
    const x = (rnd(i * 3.3) - 0.5) * W * 0.9, y = (rnd(i * 7.1) - 0.5) * H * 0.8 - H / 2 + 120;
    c.position.set(x, y, D / 2 + bump(x, y - 120 + H / 2) - 1); c.rotation.set(rnd(i) * 0.6, 0, (rnd(i * 2) - 0.5) * 0.8); group.add(c);
  }
  const wound = new THREE.Mesh(new THREE.SphereGeometry(13, 14, 10), M.crystal); wound.scale.z = 0.35; wound.position.set(0, 0, D / 2 - 2); group.add(wound);
  group.userData.wound = wound;
  return group;
}
// a dredge's drill: a fluted iron cone the length of a lens tower, with brass collars, turning on her bow
export function buildDrill(M, len = 24, r = 5.5) {
  const group = new THREE.Group();
  const cone = new THREE.ConeGeometry(r, len, 18, 12, true).rotateX(Math.PI / 2).translate(0, 0, len / 2);
  const p = cone.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(y, x) + z * 0.45, rr = Math.hypot(x, y) * (1 + 0.12 * Math.sin(a * 3));
    p.setXYZ(i, Math.cos(a) * rr, Math.sin(a) * rr, z);
  }
  cone.computeVertexNormals();
  const bit = new THREE.Mesh(cone, M.steel); bit.castShadow = true;
  const spin = new THREE.Group(); spin.add(bit); group.add(spin);
  for (const [z, rr] of [[0.3, r * 1.08], [len * 0.3, r * 0.8]]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.45, 6, 20), M.brass); ring.position.z = z; group.add(ring); }
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.1, r * 1.25, 3, 16).rotateX(Math.PI / 2), M.iron); collar.position.z = -1.2; group.add(collar);
  group.userData.spin = spin;
  return group;
}
// the drill engines on a dredge's flanks: brass housings on outriggers, a sunstone furnace glowing on top
export function buildEngine(M) {
  const g = new THREE.Group();
  const house = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.8, 5, 12), M.brass); house.castShadow = true; g.add(house);
  const top = new THREE.Mesh(new THREE.OctahedronGeometry(1.8, 0), M.crystal); top.position.y = 3.6; g.add(top);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(5, 0.8, 1.4), M.iron); arm.position.x = -3; g.add(arm);
  g.userData.top = top;
  return g;
}
// a Thinwatch beacon: a ring of brass with a light at its heart; it turns gold once flown through
export function buildBeacon(M, r = 30) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 1.3, 8, 40), M.brass); g.add(ring);
  const glow = new THREE.Mesh(new THREE.TorusGeometry(r, 1.9, 6, 40), M.beacon); g.add(glow);
  for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2, c = new THREE.Mesh(new THREE.OctahedronGeometry(2.6, 0), M.crystal); c.position.set(Math.cos(a) * r, Math.sin(a) * r, 0); g.add(c); }
  g.userData.glow = glow;
  return g;
}
