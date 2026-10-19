// sites.js: the claim-jumpers' places in the sky, to raid. Baron Tallow's crews hold rocks lifted on stolen sunstone
// around Brightvein: a prospect camp, the Redspire outpost and the Chandlery, his citadel; and his supply galleon, the
// Wickmoor, runs between them. Each is guarded by jumper ships, and the rocks by gun towers. Bring down the guards and
// silence the guns and the place strikes its colours: its crates are yours to take home (the claim opens them, with
// the Armory's raid tables, src/claim/loot.js RAIDS). A taken place is manned again after a few days on the claim.
// Act two adds the Gilded Exchange's two: the Plumbline, a survey rig off Hollowcrest, and the Grindstone, a dredge
// that drills under the claim's south cliff. They turn up in their chapters (ch: hidden in the Dock's list until then).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { intercept } from './guns.js';
import { HOME } from './world.js';

// x, z: where on the map (metres; HOME is Brightvein); y: the rock's top. size: its radius. guard: the jumper ships that
// come out, wave by wave (captain: which ship in the wave leads it, or -1). crates: as the loot table's (RAIDS).
export const SITES = [
  { id: 'camp', loot: 'camp', name: "Tallow's prospect camp", short: 'Prospect camp', x: HOME.x - 2100, z: HOME.z - 1500, y: 600, size: 34,
    line: 'Tents on a lifted rock, two skiffs on guard and one gun.', towers: 1, guard: [{ ids: ['skiff'], captain: -1 }, { ids: ['skiff', 'skiff'], captain: -1 }], crates: 2, regrow: 1, after: null },
  { id: 'outpost', loot: 'outpost', name: 'The Redspire outpost', short: 'Redspire', x: HOME.x - 3700, z: HOME.z + 1700, y: 640, size: 52,
    line: 'A red crag with a palisade, three gun towers and a cutter crew.', towers: 3, guard: [{ ids: ['cutter', 'skiff'], captain: -1 }, { ids: ['cutter', 'cutter'], captain: 0 }], crates: 3, regrow: 2, after: 'camp' },
  { id: 'galleon', loot: 'airship', name: 'The supply galleon Wickmoor', short: 'The Wickmoor', x: HOME.x - 1300, z: HOME.z + 4200, y: 720, size: 0, moving: true,
    line: 'Tallow\'s treasure ship, under escort. Shoot her sails and she strikes; sink her and her crates go down with her.', towers: 0,
    guard: [{ ids: ['galleon', 'cutter', 'skiff'], captain: -1 }], crates: 3, regrow: 2, after: 'outpost' },
  { id: 'citadel', loot: 'citadel', name: 'The Chandlery, Baron Tallow\'s citadel', short: 'The Chandlery', x: HOME.x + 2200, z: HOME.z + 4300, y: 760, size: 86,
    line: 'A fortress of candle-works on a great lifted rock. Six gun towers, the Baron\'s frigate and his Man-o\'-war.', towers: 6,
    guard: [{ ids: ['frigate', 'brig'], captain: 0 }, { ids: ['manowar', 'cutter', 'cutter'], captain: -1 }], crates: 5, regrow: 4, after: 'galleon' },
  { id: 'survey', loot: 'outpost', name: 'The Plumbline, the Exchange\'s survey rig', short: 'The Plumbline', x: HOME.x + 3000, z: HOME.z - 1300, y: 660, size: 46, ch: 11, flag: 'silver',
    line: 'A survey rig on a lifted rock off Hollowcrest: brass derricks, very long drills, two gun towers and an escort under silver sails.', towers: 2,
    guard: [{ ids: ['cutter', 'cutter'], captain: -1 }, { ids: ['brig', 'cutter'], captain: 0 }], crates: 3, regrow: 3, after: 'citadel' },
  { id: 'dredge', loot: 'citadel', name: 'The Grindstone, the Exchange\'s dredge', short: 'The Grindstone', x: HOME.x + 500, z: HOME.z + 2700, y: 640, size: 0, moving: true, ch: 14,
    line: 'A great dredge with a drill on her bow, cutting into the rock under the claim\'s south cliff, with a frigate and a brig to guard her. Shoot her sails and she strikes.', towers: 0,
    guard: [{ ids: ['galleon', 'frigate', 'brig'], captain: -1 }], crates: 5, regrow: 6, after: 'survey' },
];

const rnd = (a) => { const x = Math.sin(a * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// ---------- the models: a rock lifted on sunstone, with the jumpers' camp on top ----------
function materials() {
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.9, ...o });
  return {
    rock: std({ color: 0x8a7462, flatShading: true }),
    red: std({ color: 0xa4523a, flatShading: true }),
    earth: std({ color: 0x7a6748 }),
    plank: std({ color: 0x8a6446, roughness: 0.85 }),
    dark: std({ color: 0x4a3426 }),
    tent: std({ color: 0xc8735c, side: THREE.DoubleSide }),
    pale: std({ color: 0xd8c7a6, side: THREE.DoubleSide }),
    roof: std({ color: 0x4d4a52 }),
    stone: std({ color: 0xa69a8a, flatShading: true }),
    brass: std({ color: 0xd9a743, metalness: 0.85, roughness: 0.35 }),
    iron: std({ color: 0x3c3a3e, metalness: 0.6, roughness: 0.5 }),
    crystal: std({ color: 0xffb04a, emissive: 0xff7a1a, emissiveIntensity: 1.6, roughness: 0.2, flatShading: true }),
    flag: std({ color: 0xffffff, vertexColors: true, side: THREE.DoubleSide, roughness: 0.9 }),
    candle: std({ color: 0xefe2c2, roughness: 0.7 }),
    flame: new THREE.MeshBasicMaterial({ color: 0xffc86a, toneMapped: false }),
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
function colourFlag(flag, ours) {
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
// a gun tower: four legs, a platform, and a brass gun that turns to follow you (a separate piece, so it can turn)
function tower(group, P, M, x, z, h = 7) {
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) P.add(new THREE.BoxGeometry(0.4, h, 0.4), M.plank, x + dx * 1.3, h / 2, z + dz * 1.3);
  P.add(new THREE.BoxGeometry(3.6, 0.4, 3.6), M.dark, x, h, z);
  const head = new THREE.Group(); head.position.set(x, h + 0.2, z); group.add(head);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 0.9, 10), M.iron); base.position.y = 0.45; base.castShadow = true; head.add(base);
  const barrel = new THREE.Group(); barrel.position.y = 1.2; head.add(barrel);
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.45, 3.6, 10).rotateX(Math.PI / 2).translate(0, 0, 1.4), M.brass); tube.castShadow = true; barrel.add(tube);
  const lens = new THREE.Mesh(new THREE.SphereGeometry(0.36, 8, 6).translate(0, 0, 3.2), M.crystal); barrel.add(lens);
  return { head, barrel, local: V(x, h + 1.4, z) };
}

export function buildSite(def, M) {
  const group = new THREE.Group(), P = pieces(), R = def.size, towers = [];
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
    // the red spire the outpost is named for, with a lookout on top
    P.add(new THREE.ConeGeometry(9, 34, 7), M.red, -14, 17, -10);
    P.add(new THREE.BoxGeometry(5, 3, 5), M.plank, -14, 28, -10);
    shed(P, M, 8, 10, 10, 7, 4, 0.2); shed(P, M, 14, -10, 8, 6, 3.6, -0.3); shed(P, M, -2, 18, 7, 6, 3.4, 0.9);
    tent(P, M, 20, 4, 3); tent(P, M, -20, 14, 2.8);
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
  } else if (def.id === 'survey') {
    // the Plumbline: three brass derricks with their drill strings hanging down past the rock, and a counting-house
    for (const [x, z, h] of [[-12, -8, 22], [10, -12, 26], [-2, 14, 20]]) {
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) P.add(new THREE.CylinderGeometry(0.22, 0.32, h, 5), M.brass, x + dx * 2.2 * 0.5, h / 2, z + dz * 2.2 * 0.5, 0, dz * 0.09, -dx * 0.09);
      for (let k = 1; k < 4; k++) P.add(new THREE.BoxGeometry(2.6 - k * 0.4, 0.18, 2.6 - k * 0.4), M.iron, x, h * k / 4, z);
      P.add(new THREE.CylinderGeometry(0.16, 0.16, h + 26, 6), M.iron, x, h / 2 - 13, z);
      P.add(new THREE.ConeGeometry(0.7, 2.4, 8), M.iron, x, -26.5, z, 0, Math.PI);
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
  const poleH = def.id === 'citadel' ? 46 : def.id === 'outpost' ? 36 : 14, px = def.id === 'outpost' ? -14 : 0, pz = def.id === 'outpost' ? -10 : 0;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, poleH, 6), M.dark); pole.position.set(px, poleH / 2, pz); group.add(pole);
  const flag = new THREE.Mesh(flagGeo(def.id === 'citadel' ? 9 : 5, def.id === 'citadel' ? 5 : 3), M.flag); flag.position.set(px, poleH - 2, pz); flag.userData.w = def.id === 'citadel' ? 9 : 5; flag.userData.kind = def.flag || 'jumpers'; group.add(flag);
  return { group, towers, flag, depth };
}

// ---------- a raid: the place, its guns and its guards ----------
// raiders: the raider fleet (raiders.js); skies(): the current skies' settings
export function makeSites(scene, bolts, smoke, raiders, skies) {
  const M = materials(), models = new Map();
  let cur = null;
  const ZERO = V();
  function modelFor(def) {
    if (!models.has(def.id)) models.set(def.id, buildSite(def, M));
    return models.get(def.id);
  }
  // start a raid on this place (def from SITES). Returns where the Captain sets out from, and heading.
  function start(def) {
    clear();
    cur = { def, state: 'approach', wave: 0, guards: [], towers: [], taken: false, lost: false, center: V(def.x, def.y, def.z), timer: 0, prize: null, smokeT: 0 };
    if (!def.moving) {
      const m = modelFor(def);
      m.group.position.copy(cur.center); m.group.rotation.y = rnd(def.size) * 6;
      scene.add(m.group); m.group.updateMatrixWorld(true);
      colourFlag(m.flag, false);
      const S = skies();
      cur.towers = m.towers.map((t) => ({ ...t, hp: (def.id === 'citadel' ? 420 : 260) * S.toughness, max: (def.id === 'citadel' ? 420 : 260) * S.toughness, ready: 2 + Math.random() * 2, alive: true,
        world: t.local.clone().applyMatrix4(m.group.matrixWorld) }));
      for (const t of cur.towers) { t.head.visible = true; t.head.rotation.set(0, 0, 0); }
      cur.model = m;
    } else {
      // the galleon and her escort are out on their run already
      spawnGuard(0);
    }
    const toward = Math.atan2(def.x - HOME.x, def.z - HOME.z);
    return { pos: V(HOME.x + Math.sin(toward) * 900, 680, HOME.z + Math.cos(toward) * 900), heading: toward };
  }
  // the guards come out: from round the rock towards the Captain (or, for the galleon, sailing her course)
  function spawnGuard(i, foe) {
    const w = cur.def.guard[i], c = cur.center;
    const toFoe = foe ? Math.atan2(foe.pos.x - c.x, foe.pos.z - c.z) : 0;
    w.ids.forEach((id, k) => {
      if (cur.def.moving && id === 'galleon') {
        const r = raiders.spawn('galleon', c.clone(), Math.atan2(HOME.x - c.x, HOME.z - c.z) + Math.PI / 2, false, false);
        r.name = cur.def.short; cur.prize = r; cur.guards.push(r); return;
      }
      const a = (cur.def.moving ? toFoe + Math.PI : toFoe) + (k - (w.ids.length - 1) / 2) * 0.5, d = (cur.def.size || 60) + 120 + k * 30;
      const pos = V(c.x + Math.sin(a) * d, c.y + 30 + k * 15, c.z + Math.cos(a) * d);
      const r = raiders.spawn(id, pos, foe ? Math.atan2(foe.pos.x - pos.x, foe.pos.z - pos.z) : a, false, k === w.captain);
      r.name = `Jumper ${k === w.captain ? 'captain\'s ' : ''}${r.R.cls}`;
      cur.guards.push(r);
    });
  }
  // where the place is now (the galleon moves)
  const where = () => (cur.prize && !cur.prize.gone ? cur.prize.f.pos : cur.center);

  // every frame. Returns what happened: 'guards' (the guards came out), 'wave' (more guards), 'tower' (a gun silenced),
  // 'taken', 'lost' (the galleon sank or got away), or null
  const aimP = V();
  function update(dt, foe) {
    if (!cur) return null;
    const def = cur.def, d = where().distanceTo(foe.pos);
    let ev = null;
    if (cur.state === 'approach' && (d < 1300 || def.moving)) { cur.state = 'fight'; if (!def.moving) spawnGuard(0, foe); ev = 'guards'; }
    // the gun towers turn and fire while you're in reach
    const S = skies();
    for (const t of cur.towers) {
      if (!t.alive) {
        if ((t.smokeT = (t.smokeT ?? 0) - dt) <= 0) { t.smokeT = 0.18; smoke.emit(t.world, V((Math.random() - 0.5) * 2, 3, (Math.random() - 0.5) * 2), 4, 2, 9, 0.15, 0.5); }
        continue;
      }
      const td = t.world.distanceTo(foe.pos);
      const yaw = Math.atan2(foe.pos.x - t.world.x, foe.pos.z - t.world.z) - cur.model.group.rotation.y;
      t.head.rotation.y = yaw;
      t.barrel.rotation.x = -Math.atan2(foe.pos.y - t.world.y, Math.hypot(foe.pos.x - t.world.x, foe.pos.z - t.world.z));
      t.ready -= dt;
      if (cur.state !== 'approach' && td < 1150 && t.ready <= 0 && !foe.down) {
        // a volley of two (three from the Chandlery's heavier towers), each a little off
        t.ready = 2.6 * S.reload * (0.85 + Math.random() * 0.3);
        const from = t.world.clone().add(V(0, 0.4, 0)), e = td * 0.012 * S.aim + 1, n = def.id === 'citadel' ? 3 : 2;
        for (let k = 0; k < n; k++) {
          aimP.copy(intercept(from, ZERO, foe.aimAt(), foe.velocity, 430));
          aimP.add(V(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(2 * e));
          bolts.fire(from, aimP.sub(from).normalize(), 'chaser', 'raider', ZERO, (def.id === 'citadel' ? 1.25 : 0.9) * S.damage);
        }
      }
    }
    if (cur.state === 'fight') {
      const live = cur.guards.filter((r) => !r.f.down && !r.gone);
      if (def.moving) {
        const P = cur.prize;
        if (P && P.f.down) { cur.state = P.f.down.why === 'struck' ? 'taken' : 'lost'; ev = cur.state; cur.taken = cur.state === 'taken'; }
        else if (P && (P.gone || P.escaped)) { cur.state = 'lost'; ev = 'lost'; }
      } else if (!live.length) {
        if (cur.wave + 1 < def.guard.length) { cur.wave++; cur.timer = 3; cur.state = 'between'; }
        else if (!cur.towers.some((t) => t.alive)) { cur.state = 'taken'; cur.taken = true; ev = 'taken'; colourFlag(cur.model.flag, true); }
      }
    } else if (cur.state === 'between') {
      if ((cur.timer -= dt) <= 0) { cur.state = 'fight'; spawnGuard(cur.wave, foe); ev = 'wave'; }
    }
    // the last gun silenced with the guards already down
    if (cur.state === 'fight' && !def.moving && cur.wave + 1 >= def.guard.length && !cur.guards.some((r) => !r.f.down && !r.gone) && !cur.towers.some((t) => t.alive)) {
      cur.state = 'taken'; cur.taken = true; ev = 'taken'; colourFlag(cur.model.flag, true);
    }
    // the chimneys of the Chandlery smoke
    if (def.id === 'citadel' && (cur.smokeT -= dt) <= 0) {
      cur.smokeT = 0.25;
      const m = cur.model.group, p = V(-6 + Math.floor(Math.random() * 4) * 4, 41, 4).applyEuler(m.rotation).add(m.position);
      smoke.emit(p, V(1.5, 4, 0.5), 9, 4, 22, 0.3, 0.45);
    }
    return ev;
  }
  // a shot from a to b: does it hit a gun tower (the Captain's shots), or the rock (anyone's)?
  const seg = new THREE.Line3(), near = V();
  function hitBy(a, b, owner) {
    if (!cur || cur.def.moving) return null;
    if (owner === 'player') for (const t of cur.towers) {
      if (!t.alive) continue;
      if (seg.set(a, b).closestPointToPoint(t.world, true, near).distanceTo(t.world) < 5) return { tower: t, at: near.clone() };
    }
    // the rock: inside its top's circle, between its top and its keel
    const c = cur.center, R = cur.def.size, dx = b.x - c.x, dz = b.z - c.z, y = b.y - c.y;
    if (y < 0.5 && y > -cur.model.depth && Math.hypot(dx, dz) < R * (1 + y / cur.model.depth * 0.9)) return { rock: true, at: b.clone() };
    return null;
  }
  function damageTower(t, dmg) {
    t.hp -= dmg;
    if (t.hp <= 0 && t.alive) { t.alive = false; t.barrel.visible = false; bolts.burst(t.world, 0xff8a3a, 50, 2); return true; }
    return false;
  }
  // keep the Captain's ship out of the rock
  function keepOut(foe) {
    if (!cur || cur.def.moving) return;
    const c = cur.center, R = cur.def.size + 6, dx = foe.pos.x - c.x, dz = foe.pos.z - c.z, h = Math.hypot(dx, dz), y = foe.pos.y - c.y;
    if (h < R && y < 10 && y > -cur.model.depth * 0.8) { foe.pos.y = c.y + 10; foe.vy = Math.max(0, foe.vy); }
  }
  function clear() {
    if (cur?.model) scene.remove(cur.model.group);
    cur = null;
  }
  return {
    start, update, hitBy, damageTower, keepOut, clear, where,
    get cur() { return cur; },
    get towersLeft() { return cur ? cur.towers.filter((t) => t.alive).length : 0; },
    get guardsLeft() { return cur ? cur.guards.filter((r) => !r.f.down && !r.gone).length + (cur.state === 'approach' || cur.state === 'between' ? 1 : 0) : 0; },
  };
}
