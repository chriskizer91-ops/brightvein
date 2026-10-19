// ===================================================================== BUILDINGS: models, stations, town dressing
// Economy and jobs for each kind of building. Stats: G grit, E engineering, A agility, R rapport, S sowing.
const DEFS = {
  keep: { name: 'The Keep', max: 3, cost: [0, 0, 160, 360], beds: [0, 16, 24, 32],
    job: { title: 'Clerk', stat: 'R', slots: [0, 2, 3, 4], tool: 'book', night: false },
    blurb: 'Home to everyone on the claim, and its heart. Clerks keep the books and spread word of the strike, which brings settlers in on passing couriers. Raising the Keep makes room to build more.',
    levels: ['A stone keep under a slate roof: beds for sixteen', 'Corner turrets with copper caps: beds for twenty-four', 'The sun beacon on the roof lights the whole plateau: beds for thirty-two'] },
  head: { name: 'Headframe & Mine', max: 3, cost: [0, 0, 180, 360],
    blurb: 'The lift down into the dig. Its level sets how deep you can dig and how fast the cage runs. The rooms below are dug and staffed from the Mine view.',
    levels: ['A hand winch: the lift reaches the upper rows', 'A steam winch, and the deep seam broken open: dig the lower rows', 'A double steam winch: dig the deepest rows'] },
  yard: { name: 'Sunning Yard', max: 3, cost: [70, 70, 110, 220],
    job: { title: 'Tender', stat: 'S', slots: [0, 2, 3, 4], tool: 'crystal', night: false },
    blurb: 'Raw ore laid out on brass trays charges in the sun into shards. Tenders turn the crystal so it fills evenly. Nothing charges at night.',
    levels: ['Three racks of brass trays', 'A fourth rack and sun mirrors', 'A burning-lens frame that charges even in thin light'] },
  shop: { name: 'Lens Workshop', max: 2, cost: [0, 0, 150],
    job: { title: 'Cutter', stat: 'E', slots: [0, 1, 2], tool: 'hammer', night: false },
    blurb: 'Cutters dress and grade the charged crystal, so every tray yields more shards. They also keep the wall and towers in repair.',
    levels: ['Grinding bench and a round window', 'Upper workroom and a rooftop lens rig'] },
  garden: { name: 'Greenhouse', max: 2, cost: [0, 0, 110],
    job: { title: 'Gardener', stat: 'S', slots: [0, 2, 3], tool: 'can', night: false },
    blurb: 'Food for the claim. Everyone eats; hungry people work at half pace.',
    levels: ['Glass greenhouse and four beds', 'Beehives and a rain tank'] },
  lens: { name: 'Lens Tower', max: 2, cost: [90, 90, 150],
    job: { title: 'Lens crew', stat: 'A', slots: [0, 1, 2], tool: 'glass', night: true },
    blurb: 'At night the crew focuses charged sunstone into a beam that unmakes Wildlight. Long reach, hits hard. Needs a crew, and each shot spends a shard.',
    levels: ['One great lens', 'A second lens and a copper hood: faster, longer reach'] },
  ballista: { name: 'Clockwork Ballista', max: 2, cost: [60, 60, 110],
    blurb: 'A wind-up bolt thrower. It needs no crew and spends no shards: the spring winds itself by day. Short reach, so put it where the Wildlight will be.',
    levels: ['Timber frame and a spring drum', 'Double-wound spring and an iron shield: harder and farther'] },
  wall: { name: 'Rim Wall', max: 2, cost: [0, 0, 240],
    job: { title: 'Watch', stat: 'G', slots: [0, 3, 4], tool: 'lance', night: true },
    blurb: 'Wildlight climbs the cliffs. The wall slows it; the watch meets it with crystal lances.',
    levels: ['Timber palisade', 'Dressed stone with a parapet'] },
  mast: { name: 'Airship Mast', max: 1, cost: [0, 0],
    job: { title: 'Crew', stat: 'A', slots: [0, 3], tool: 'rope', night: true },
    blurb: 'The Lark, a sunstone courier. With a crew aboard she patrols at night and fires crystal flares at anything that glows wrong.',
    levels: ['Mooring mast and the courier Lark'] },
};
// Footprints on the build grid, in 2 m tiles, and where the model's origin sits from the footprint's centre (metres).
const FOOT = {
  keep: { w: 7, d: 7, ox: 0, oz: 0 },
  yard: { w: 7, d: 5, ox: 0, oz: 0 },
  shop: { w: 5, d: 5, ox: 0, oz: -0.9 },
  garden: { w: 7, d: 5, ox: -0.2, oz: 0 },
  lens: { w: 3, d: 3, ox: 0, oz: 0 },
  ballista: { w: 2, d: 2, ox: 0, oz: 0 },
  mast: { w: 2, d: 2, ox: 0, oz: 0 },
};
// size of each model, for scaffolding and the yard's trays
const MODEL_SIZE = { keep: [12, 11], yard: [13, 8], shop: [8.4, 6.4], garden: [14, 10], lens: [4.4, 4.4], ballista: [3.6, 3.6], mast: [4, 4], head: [7.4, 6.4] };
// How many of each the Keep allows, by Keep level (like a Town Hall). Index 0 is unused.
const KEEP_LIMITS = { yard: [0, 2, 3, 4], garden: [0, 1, 2, 2], shop: [0, 1, 1, 2], lens: [0, 2, 3, 4], ballista: [0, 2, 4, 6] };
const BUY = { yard: 70, garden: 110, shop: 150, lens: 90, ballista: 60 };
const KIT = { yard: 2, garden: 1, shop: 1 };            // free on a new claim
const EXP_LIMIT = [0, 1, 2, 3];                         // expeditions out at once, by Keep level
const BUILD_ORDER = ['yard', 'garden', 'shop', 'lens', 'ballista'];

// stations: where workers stand (local to the building), per slot
const STATIONS = {
  keep: [{ x: -3.1, z: 5.7, f: Math.PI }, { x: 3.1, z: 5.9, f: Math.PI }, { x: -1.4, z: 6.4, f: Math.PI }, { x: 1.4, z: 6.4, f: Math.PI }],
  yard: [{ x: -3.5, z: -2, f: 0 }, { x: 3, z: 0, f: Math.PI }, { x: -1, z: 2, f: 0 }, { x: 4.5, z: 4.2, f: Math.PI }],
  shop: [{ x: -1.2, z: 4.9, f: Math.PI }, { x: 1.4, z: 4.8, f: Math.PI }],
  garden: [{ x: -5.2, z: 1.7, f: 0 }, { x: -2.2, z: 3.0, f: 0 }, { x: -4, z: 4.2, f: 0 }],
  lens: [{ x: 0.9, y: 7.0, z: 0.9, f: 0 }, { x: -0.9, y: 7.0, z: -0.6, f: 0 }],
  mast: [{ deck: [0, -4.5] }, { deck: [0.8, 2.5] }, { deck: [-0.8, 0.5] }],
};

// ----------------------------------------------------------------- shared helpers
function beam(b, a, c, t, mat, lvl = 1, o = {}) {
  const A = new THREE.Vector3(...a), C = new THREE.Vector3(...c), len = A.distanceTo(C);
  const g = G.box(t, len, t, 1.5);
  const m = b.add(g, mat, (A.x + C.x) / 2, (A.y + C.y) / 2, (A.z + C.z) / 2, { lvl, ...o });
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), C.clone().sub(A).normalize());
  return m;
}
function roofGable(b, w, d, h, y0, lvl = 1, o = {}) {
  const mat = o.mat || MAT.slate, end = o.end || MAT.plaster;
  for (const g of roofSlabs(w, d, h, o.over ?? 0.55)) b.add(g, mat, o.x || 0, y0, o.z || 0, { lvl, drop: o.drop });
  for (const s of [-1, 1]) b.add(G.gable(d, h, 0.2), end, (o.x || 0) + s * (w / 2 - 0.1), y0, o.z || 0, { lvl, ry: Math.PI / 2, drop: o.drop });
  b.add(G.box(w + 1.3, 0.22, 0.3, 1), MAT.oakDark, o.x || 0, y0 + h + 0.18, o.z || 0, { lvl, drop: o.drop });
}
function crystalCage(b, x, y, z, s, lvl, mat = MAT.crystal) {
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.add(G.box(0.05 * s * 4, 1.2 * s, 0.05 * s * 4, 1), MAT.brass, x + dx * 0.32 * s, y + 0.6 * s, z + dz * 0.32 * s, { lvl, cast: false });
  b.add(G.box(0.85 * s, 0.07 * s * 2, 0.85 * s, 1), MAT.brass, x, y, z, { lvl });
  b.add(G.box(0.85 * s, 0.07 * s * 2, 0.85 * s, 1), MAT.brass, x, y + 1.2 * s, z, { lvl });
  const c = b.add(new THREE.OctahedronGeometry(1, 0), mat, x, y + 0.6 * s, z, { lvl, sx: 0.26 * s, sy: 0.5 * s, sz: 0.26 * s });
  return c;
}

// ----------------------------------------------------------------- the Keep
// Origin is the centre of its 14 m footprint. Body 10 × 9 m, door on +z, clerks out front.
function modelKeep(b) {
  const Z = -1.4, W = 10, D = 9, FZ = Z + D / 2;           // FZ: the front wall
  b.add(G.box(W + 1.2, 0.6, D + 1.2), MAT.dressed, 0, 0.3, Z);
  for (let i = 0; i < 3; i++) b.add(G.box(4.4 - i * 0.4, 0.2, 0.9), MAT.dressed, 0, 0.1 + i * 0.2, FZ + 1.75 - i * 0.42);
  b.add(G.box(W, 7.6, D), MAT.stone, 0, 0.6 + 3.8, Z);
  b.add(G.box(W + 0.3, 0.28, D + 0.3), MAT.dressed, 0, 4.3, Z);
  b.add(G.box(W + 0.6, 0.45, D + 0.6), MAT.dressed, 0, 8.42, Z);
  // battlements
  for (let i = 0; i < 7; i++) { const x = -4.8 + i * 1.6; for (const s of [-1, 1]) b.add(G.box(0.85, 0.75, 0.45), MAT.stone, x, 9.02, Z + s * (D / 2 + 0.07)); }
  for (let i = 0; i < 5; i++) { const z = Z - 3.6 + i * 1.8; for (const s of [-1, 1]) b.add(G.box(0.45, 0.75, 0.85), MAT.stone, s * (W / 2 + 0.07), 9.02, z); }
  // a slate pyramid roof inside the parapet
  const roof = new THREE.ConeGeometry(6.0, 3.6, 4, 1); roof.rotateY(Math.PI / 4);
  b.add(roof, MAT.slate, 0, 8.65 + 1.8, Z, { sx: 1.06, sy: 1, sz: 0.94 });
  b.add(G.box(0.5, 0.5, 0.5), MAT.brass, 0, 12.4, Z);
  // corner buttresses (replaced by turrets at level 2)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(G.box(1.15, 7.4, 1.15), MAT.dressed, sx * (W / 2 - 0.1), 0.6 + 3.7, Z + sz * (D / 2 - 0.1), { drop: 2 });
  // the gate: a dressed arch, an oak door, a brass boss and banners
  b.add(G.box(3.1, 3.9, 0.32), MAT.dressed, 0, 0.6 + 1.95, FZ + 0.05);
  b.add(G.gable(3.5, 1.0, 0.4), MAT.dressed, 0, 4.45, FZ + 0.08);
  doorAt(b, 0, 0.6, FZ + 0.22, 1.9, 3.0);
  b.add(new THREE.CircleGeometry(0.4, 20), MAT.brass, 0, 5.0, FZ + 0.29, { cast: false });
  for (const x of [-2.7, 2.7]) { b.add(new THREE.PlaneGeometry(1.0, 2.6), MAT.wool, x, 2.9, FZ + 0.06, { cast: false }); b.add(G.box(1.25, 0.08, 0.08, 1), MAT.brass, x, 4.25, FZ + 0.1, { cast: false }); b.add(new THREE.CircleGeometry(0.28, 6), MAT.brass, x, 2.7, FZ + 0.08, { cast: false }); }
  // windows: glazed above, arrow slits below
  for (const x of [-3.2, 3.2]) windowAt(b, x, 6.3, FZ + 0.01, 0.7, 1.3);
  for (const x of [-2.4, 2.4]) windowAt(b, x, 6.3, Z - D / 2 - 0.01, 0.7, 1.3, Math.PI);
  for (const s of [-1, 1]) {
    for (const z of [-3.4, -1.0, 1.4]) windowAt(b, s * (W / 2 + 0.01), 6.3, Z + z + 1.4 - 1.4, 0.7, 1.3, s * Math.PI / 2);
    for (const z of [-2.2, 0.6]) windowAt(b, s * (W / 2 + 0.01), 2.6, Z + z, 0.32, 1.2, s * Math.PI / 2, 1, { noMullion: true });
  }
  // chimney at the back
  b.add(G.box(1.0, 3.2, 1.0), MAT.stone, 3.0, 10.4, Z - 2.9); b.add(G.box(1.3, 0.25, 1.3), MAT.dressed, 3.0, 12.1, Z - 2.9);
  b.smoke.push(b.worldPos(3.0, 12.4, Z - 2.9));
  crystalCage(b, -3.2, 8.9, Z - 3.0, 0.8, 1);
  // the clerks' desk and notice board out front
  b.add(G.box(1.2, 0.85, 0.65, 1), MAT.oak, -3.1, 0.43, 4.9); b.add(G.box(0.35, 0.05, 0.28, 1), MAT.cream, -3.0, 0.88, 4.9, { cast: false });
  b.add(G.box(0.14, 2.1, 0.14, 1), MAT.oakDark, 2.3, 1.05, 5.1); b.add(G.box(0.14, 2.1, 0.14, 1), MAT.oakDark, 3.9, 1.05, 5.1);
  b.add(G.box(1.9, 1.1, 0.1, 1), MAT.oak, 3.1, 1.6, 5.1); b.add(G.box(0.5, 0.65, 0.02, 1), MAT.cream, 2.7, 1.65, 5.16, { cast: false }); b.add(G.box(0.45, 0.5, 0.02, 1), MAT.cream, 3.4, 1.55, 5.16, { cast: false });
  // level 2: corner turrets with copper caps, and a clock over the gate
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * (W / 2 - 0.1), z = Z + sz * (D / 2 - 0.1);
    b.add(G.cyl(1.3, 1.4, 10.6, 14), MAT.stone, x, 0.6 + 5.3, z, { lvl: 2 });
    b.add(G.cyl(1.55, 1.55, 0.35, 14), MAT.dressed, x, 11.3, z, { lvl: 2 });
    b.add(new THREE.ConeGeometry(1.75, 2.6, 14), MAT.copper, x, 12.75, z, { lvl: 2 });
    b.add(G.cyl(0.05, 0.14, 0.9, 6), MAT.brass, x, 14.4, z, { lvl: 2 });
    windowAt(b, x + sx * 0.02, 9.2, z + sz * 1.31, 0.32, 0.9, sz > 0 ? 0 : Math.PI, 2, { noMullion: true });
  }
  { const g = new THREE.Group(); g.position.set(0, 6.6, FZ + 0.03); b.group.add(g);
    b.add(new THREE.CylinderGeometry(0.85, 0.85, 0.08, 28).rotateX(Math.PI / 2), MAT.cream, 0, 0, 0.02, { parent: g, lvl: 2, cast: false });
    b.add(new THREE.TorusGeometry(0.88, 0.08, 6, 28), MAT.brass, 0, 0, 0.06, { parent: g, lvl: 2, cast: false });
    b.add(G.box(0.08, 0.62, 0.04, 1), MAT.iron, 0, 0.26, 0.1, { parent: g, lvl: 2, cast: false });
    b.add(G.box(0.46, 0.07, 0.04, 1), MAT.iron, 0.18, 0, 0.1, { parent: g, lvl: 2, cast: false, rz: 0.4 }); }
  // level 3: the sun beacon on the roof
  const by = 12.6;
  b.add(G.box(1.8, 0.5, 1.8), MAT.dressed, 0, by - 0.25, Z, { lvl: 3 });
  for (const [dx, dz] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) b.add(G.box(0.12, 3.6, 0.12, 1), MAT.brass, dx, by + 1.8, Z + dz, { lvl: 3 });
  b.add(new THREE.TorusGeometry(1.3, 0.1, 6, 24).rotateX(Math.PI / 2), MAT.brass, 0, by + 0.2, Z, { lvl: 3 });
  b.add(new THREE.TorusGeometry(1.3, 0.1, 6, 24).rotateX(Math.PI / 2), MAT.brass, 0, by + 3.6, Z, { lvl: 3 });
  b.beaconMat = MAT.crystal.clone(); b.beaconMat.emissiveIntensity = 2.4; trackEnv(b.beaconMat, 0.8);
  b.beacon = b.add(new THREE.OctahedronGeometry(1, 0), b.beaconMat, 0, by + 1.9, Z, { lvl: 3, sx: 0.75, sy: 1.5, sz: 0.75 });
  const orr = new THREE.Group(); orr.userData.dynamic = true; orr.position.set(0, by + 1.9, Z); b.group.add(orr);
  b.add(new THREE.TorusGeometry(1.85, 0.05, 4, 40), MAT.brass, 0, 0, 0, { parent: orr, lvl: 3, rx: 1.2, cast: false });
  b.add(new THREE.TorusGeometry(2.2, 0.04, 4, 40), MAT.brass, 0, 0, 0, { parent: orr, lvl: 3, rx: 1.9, ry: 0.6, cast: false });
  b.add(new THREE.SphereGeometry(0.16, 10, 8), MAT.brass, 1.85, 0, 0, { parent: orr, lvl: 3, cast: false });
  b.spin.push({ obj: orr, axis: 'y', speed: 0.25 });
  const L = new THREE.PointLight(0xffb25a, 0, 70, 1.4); L.position.set(0, by + 1.9, Z); b.group.add(L); b.lights.push({ light: L, lvl: 3, power: 260 });
  const L1 = new THREE.PointLight(0xffb870, 0, 26, 1.6); L1.position.set(0, 3.6, FZ + 2.4); b.group.add(L1); b.lights.push({ light: L1, lvl: 1, power: 40 });
}

// ----------------------------------------------------------------- the headframe over the shaft
function modelHead(b) {
  // deck over the shaft (local z -0.2 … 4.4 is the shaft, z 4.4 is the cliff face)
  b.add(G.box(5.6, 0.3, 4.4), MAT.boards, 0, 0.15, 2.0);
  b.add(G.box(1.8, 0.05, 1.6, 1), MAT.dark, 0, 0.31, 2.4, { cast: false });
  for (const x of [-0.95, 0.95]) b.add(G.box(0.12, 0.2, 1.7, 1), MAT.oakDark, x, 0.4, 2.4);
  const top = 10.4;
  for (const [x0, z0, x1, z1] of [[-2.5, 0.2, -1.0, 1.2], [2.5, 0.2, 1.0, 1.2], [-2.5, 3.8, -1.0, 2.8], [2.5, 3.8, 1.0, 2.8]]) beam(b, [x0, 0.3, z0], [x1, top, z1], 0.36, MAT.oak, 1);
  for (let y = 2.6; y < top - 1; y += 2.6) {
    const k = y / top, wx = lerp(2.5, 1.0, k) , zf = lerp(0.2, 1.2, k), zb = lerp(3.8, 2.8, k);
    b.add(G.box(wx * 2, 0.22, 0.22, 1), MAT.oakDark, 0, y, zf); b.add(G.box(wx * 2, 0.22, 0.22, 1), MAT.oakDark, 0, y, zb);
    b.add(G.box(0.22, 0.22, zb - zf, 1), MAT.oakDark, -wx, y, (zf + zb) / 2); b.add(G.box(0.22, 0.22, zb - zf, 1), MAT.oakDark, wx, y, (zf + zb) / 2);
  }
  b.add(G.box(2.6, 0.3, 2.2), MAT.boards, 0, top, 2.0);
  // back struts to the ground
  beam(b, [-1.0, top - 0.5, 1.2], [-1.6, 0.2, -2.6], 0.3, MAT.oak, 1); beam(b, [1.0, top - 0.5, 1.2], [1.6, 0.2, -2.6], 0.3, MAT.oak, 1);
  // sheave wheel
  const wheel = new THREE.Group(); wheel.userData.dynamic = true; wheel.position.set(0, top + 1.4, 2.0); b.group.add(wheel);
  b.add(new THREE.TorusGeometry(1.25, 0.11, 8, 28), MAT.iron, 0, 0, 0, { parent: wheel, ry: Math.PI / 2 });
  for (let i = 0; i < 6; i++) b.add(G.box(0.08, 2.4, 0.08, 1), MAT.iron, 0, 0, 0, { parent: wheel, rx: i * Math.PI / 6, cast: false });
  b.add(G.cyl(0.2, 0.2, 0.3, 10).rotateZ(Math.PI / 2), MAT.brass, 0, 0, 0, { parent: wheel });
  for (const x of [-0.35, 0.35]) b.add(G.box(0.18, 1.6, 0.18, 1), MAT.oakDark, x, top + 0.75, 2.0);
  b.wheel = wheel; b.spin.push({ obj: wheel, axis: 'x', speed: 1.8, when: () => b.busy || 0 });
  // rope down the shaft and back to the winch
  beam(b, [0, top + 2.6, 2.0], [0, 0.4, 2.4], 0.05, MAT.rope, 1, { cast: false });
  beam(b, [0, top + 2.2, 0.9], [-2.2, 1.9, -2.2], 0.05, MAT.rope, 1, { cast: false });
  // winch house
  b.add(G.box(3.2, 2.5, 2.6), MAT.plaster, -2.2, 1.25, -2.0); timberFrame(b, -2.2, 0, -2.0, 3.2, 2.5, 2.6, 1, ['b', 'l']);
  roofGable(b, 3.2, 2.6, 1.4, 2.5, 1, { x: -2.2, z: -2.0, over: 0.35 });
  doorAt(b, -2.6, 0, -3.31, 0.9, 1.9, Math.PI);
  // ore bin and heap
  b.add(G.box(2.3, 1.1, 1.9), MAT.oak, 2.3, 0.55, -1.9);
  for (let i = 0; i < 4; i++) b.add(G.box(0.12, 1.2, 0.12, 1), MAT.oakDark, 2.3 + (i % 2 ? 1.1 : -1.1), 0.6, -1.9 + (i < 2 ? 0.9 : -0.9));
  const R = mulberry(31);
  b.heap = [];
  for (let i = 0; i < 9; i++) { const m = b.add(new THREE.DodecahedronGeometry(0.32 + R() * 0.2, 0), MAT.ore, 2.3 + (R() - 0.5) * 1.6, 1.15 + R() * 0.2, -1.9 + (R() - 0.5) * 1.2, { rx: R() * 3, ry: R() * 3 }); b.heap.push(m); }
  // lantern on the frame
  b.add(G.box(0.36, 0.44, 0.36, 1), worldMats.mineGlow, 2.0, 3.1, 0.4, { cast: false });
  // level 2: steam winch and a taller frame
  b.add(G.cyl(0.75, 0.75, 2.6, 16).rotateX(Math.PI / 2), MAT.iron, -3.0, 1.05, 1.7, { lvl: 2 });
  for (const z of [0.6, 2.8]) b.add(G.box(1.5, 0.35, 0.3, 1), MAT.oakDark, -3.0, 0.2, z, { lvl: 2 });
  b.add(G.cyl(0.32, 0.38, 4.6, 12), MAT.iron, -3.0, 3.6, 2.7, { lvl: 2 });
  b.add(G.cyl(0.45, 0.32, 0.4, 12), MAT.brass, -3.0, 6.0, 2.7, { lvl: 2 });
  b.add(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 16).rotateX(Math.PI / 2), MAT.brass, -3.0, 1.2, 3.05, { lvl: 2, cast: false });
  b.add(G.box(2.2, 0.26, 0.26, 1), MAT.brass, -1.9, 1.6, 1.7, { lvl: 2, rz: 0.2 });
  b.add(G.box(1.6, 3.0, 1.6), MAT.oak, 0, top + 3.0, 2.0, { lvl: 2, sy: 1 });
  b.add(G.box(2.2, 0.3, 2.2), MAT.slate, 0, top + 4.6, 2.0, { lvl: 2 });
  b.smoke2 = b.worldPos(-3.0, 6.3, 2.7);
  // level 3: a second steam winch on the east side, a taller stack, and brass on the sheave
  b.add(G.cyl(0.7, 0.7, 2.4, 16).rotateX(Math.PI / 2), MAT.iron, 3.3, 1.0, 1.7, { lvl: 3 });
  for (const z of [0.7, 2.7]) b.add(G.box(1.4, 0.35, 0.3, 1), MAT.oakDark, 3.3, 0.2, z, { lvl: 3 });
  b.add(G.cyl(0.3, 0.36, 6.4, 12), MAT.iron, 3.4, 4.2, 2.8, { lvl: 3 });
  b.add(G.cyl(0.44, 0.3, 0.4, 12), MAT.brass, 3.4, 7.5, 2.8, { lvl: 3 });
  b.add(G.box(2.0, 0.24, 0.24, 1), MAT.brass, 2.2, 1.5, 1.7, { lvl: 3, rz: -0.2 });
  b.add(new THREE.TorusGeometry(1.34, 0.06, 6, 28), MAT.brass, 0, 0, 0, { parent: wheel, ry: Math.PI / 2, lvl: 3 });
}

// ----------------------------------------------------------------- sunning yards
function modelYard(b) {
  const L = b.L, w = L.w || 12, d = L.d || 8;
  const curb = (x, z, cw, cd) => b.add(G.box(cw, 0.35, cd, 1), MAT.dressed, x, 0.17, z);
  curb(0, -d / 2, w, 0.4); curb(-w / 2, 0, 0.4, d); curb(w / 2, 0, 0.4, d); curb(-w / 4 - 0.7, d / 2, w / 2 - 1.4, 0.4); curb(w / 4 + 0.7, d / 2, w / 2 - 1.4, 0.4);
  const rows = [[-3, 1], [-1, 1], [1, 1], [3, 2]];
  const len = w - 2.6;
  b.trays = [];
  for (const [z, lvl] of rows) {
    for (const x of [-len / 2 + 0.3, 0, len / 2 - 0.3]) { b.add(G.box(0.14, 0.75, 0.14, 1), MAT.oakDark, x, 0.37, z - 0.45, { lvl }); b.add(G.box(0.14, 0.45, 0.14, 1), MAT.oakDark, x, 0.22, z + 0.45, { lvl }); }
    const tray = b.add(G.box(len, 0.08, 1.25, 1), MAT.brass, 0, 0.62, z, { lvl, rx: 0.32 });
    b.add(G.box(len, 0.14, 0.06, 1), MAT.oak, 0, 0.66, z + 0.62, { lvl, rx: 0.32, cast: false });
    b.trays.push({ z, lvl });
  }
  // crystals on the trays: one instanced mesh per yard so each yard glows on its own
  b.crystalMat = MAT.crystal.clone(); b.crystalMat.emissiveIntensity = 0.2; trackEnv(b.crystalMat, 0.8);
  const per = 22, inst = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0), b.crystalMat, rows.length * per);
  const R = mulberry(b.id.length * 97 + (L.x | 0)), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  b.crystalRow = [];
  rows.forEach(([z, lvl], r) => {
    for (let i = 0; i < per; i++) {
      const x = -len / 2 + 0.4 + (len - 0.8) * (i + R() * 0.6) / per, zz = z + (R() - 0.5) * 0.8;
      const yy = 0.72 - (zz - z) * Math.tan(0.32);
      const s = 0.12 + R() * 0.1;
      e.set(Math.PI / 2 - 0.32 + (R() - 0.5) * 0.6, R() * 3, (R() - 0.5) * 0.8); q.setFromEuler(e);
      m4.compose(new THREE.Vector3(x, yy, zz), q, new THREE.Vector3(s, s * 2.1, s)); inst.setMatrixAt(r * per + i, m4);
    }
    b.crystalRow.push(lvl);
  });
  inst.castShadow = true; b.group.add(inst); b.crystals = inst; b.crystalsPer = per;
  // level 2: sun mirrors along the back
  for (const x of [-4, -1.3, 1.3, 4]) {
    b.add(G.box(0.12, 2.4, 0.12, 1), MAT.oakDark, x, 1.2, -d / 2 - 0.7, { lvl: 2 });
    b.add(G.box(2.2, 1.3, 0.08, 1), MAT.brass, x, 2.3, -d / 2 - 0.62, { lvl: 2, rx: -0.5 });
  }
  // level 3: a burning lens on a tall frame
  b.add(G.box(0.22, 4.4, 0.22, 1), MAT.oak, w / 2 - 1, 2.2, -d / 2 + 0.6, { lvl: 3 });
  b.add(G.box(0.22, 4.4, 0.22, 1), MAT.oak, w / 2 - 1, 2.2, d / 2 - 0.6, { lvl: 3 });
  b.add(G.box(0.22, 0.22, d - 1.0, 1), MAT.oak, w / 2 - 1, 4.4, 0, { lvl: 3 });
  b.add(new THREE.TorusGeometry(1.15, 0.12, 8, 32), MAT.brass, w / 2 - 1, 3.4, 0, { lvl: 3, ry: Math.PI / 2 + 0.6 });
  b.add(new THREE.CircleGeometry(1.1, 28), MAT.lens, w / 2 - 1, 3.4, 0, { lvl: 3, ry: Math.PI / 2 + 0.6, cast: false });
  b.onLevel = (lv) => { b.crystals.count = rows.filter(r => r[1] <= lv).length * per; };
}

// ----------------------------------------------------------------- lens workshop
function modelShop(b) {
  b.add(G.box(8.4, 0.4, 6.4), MAT.dressed, 0, 0.2, 0);
  b.add(G.box(8, 1.5, 6), MAT.stone, 0, 0.4 + 0.75, 0);
  b.add(G.box(7.8, 2.3, 5.8), MAT.plaster, 0, 1.9 + 1.15, 0); timberFrame(b, 0, 1.9, 0, 7.8, 2.3, 5.8, 1);
  roofGable(b, 7.8, 5.8, 2.6, 4.2, 1, { drop: 2 });
  // the round window
  b.add(new THREE.TorusGeometry(0.85, 0.14, 8, 28), MAT.brass, -1.9, 2.7, 2.98);
  b.add(new THREE.CircleGeometry(0.82, 28), MAT.window, -1.9, 2.7, 2.94, { cast: false });
  for (let i = 0; i < 4; i++) b.add(G.box(0.05, 1.6, 0.05, 1), MAT.brass, -1.9, 2.7, 2.97, { rz: i * Math.PI / 4, cast: false });
  doorAt(b, 1.7, 0.4, 3.01, 1.1, 2.1);
  windowAt(b, 3.95, 2.9, 0, 0.8, 1.1, Math.PI / 2); windowAt(b, -3.95, 2.9, 0, 0.8, 1.1, -Math.PI / 2); windowAt(b, 1.5, 2.9, -2.95, 0.8, 1.1, Math.PI);
  b.add(G.box(0.9, 3.4, 0.9), MAT.stone, 2.8, 5.6, -1.4); b.add(G.box(1.1, 0.2, 1.1), MAT.dressed, 2.8, 7.35, -1.4);
  b.smoke.push(b.worldPos(2.8, 7.6, -1.4));
  // awning, bench, grinding wheel, lens stand
  b.add(G.box(4.4, 0.06, 2.0, 1), MAT.wool, -0.6, 3.15, 3.95, { rx: 0.42 });
  for (const x of [-2.6, 1.4]) b.add(G.box(0.12, 2.75, 0.12, 1), MAT.oakDark, x, 1.37, 4.85);
  b.add(G.box(2.6, 0.12, 0.95, 1), MAT.oak, -1.2, 0.9, 4.0); for (const x of [-2.3, -0.1]) b.add(G.box(0.12, 0.85, 0.8, 1), MAT.oakDark, x, 0.43, 4.0);
  const grind = new THREE.Group(); grind.userData.dynamic = true; grind.position.set(-1.9, 1.35, 4.0); b.group.add(grind);
  b.add(G.cyl(0.42, 0.42, 0.12, 20).rotateZ(Math.PI / 2), MAT.iron, 0, 0, 0, { parent: grind });
  b.spin.push({ obj: grind, axis: 'x', speed: 6, when: () => b.busy || 0 });
  b.add(new THREE.TorusGeometry(0.36, 0.05, 6, 24), MAT.brass, -0.6, 1.55, 4.0, { ry: 0.6 });
  b.add(new THREE.CircleGeometry(0.34, 24), MAT.lens, -0.6, 1.55, 4.0, { ry: 0.6, cast: false });
  b.add(G.box(0.06, 0.5, 0.06, 1), MAT.brass, -0.6, 1.15, 4.0);
  for (const [x, z] of [[3.3, 3.8], [3.0, 4.6]]) b.add(G.box(0.7, 0.6, 0.7, 1), MAT.oak, x, 0.3, z, { ry: x });
  b.add(G.cyl(0.32, 0.32, 0.8, 12), MAT.oakDark, 3.9, 0.4, 4.4);
  // level 2: an upper workroom and the lens rig
  b.add(G.box(7.8, 2.4, 5.8), MAT.plaster, 0, 4.2 + 1.2, 0, { lvl: 2 }); timberFrame(b, 0, 4.2, 0, 7.8, 2.4, 5.8, 2);
  for (const x of [-2.2, 0, 2.2]) windowAt(b, x, 5.4, 2.92, 0.8, 1.0, 0, 2);
  roofGable(b, 7.8, 5.8, 2.4, 6.6, 2);
  b.add(G.box(0.9, 1.6, 0.9), MAT.stone, 2.8, 7.9, -1.4, { lvl: 2 });
  b.add(G.cyl(0.35, 0.45, 3.2, 14).rotateZ(1.1), MAT.brass, -2.2, 9.6, 0, { lvl: 2 });
  b.add(new THREE.CircleGeometry(0.42, 20).rotateY(-Math.PI / 2).rotateZ(1.1), MAT.lens, -3.6, 10.3, 0, { lvl: 2, cast: false });
  b.add(G.box(0.2, 1.8, 0.2, 1), MAT.iron, -2.2, 8.9, 0, { lvl: 2 });
}

// ----------------------------------------------------------------- greenhouse and beds
function modelGarden(b) {
  b.add(G.box(10.4, 0.6, 4.8), MAT.stone, 0, 0.3, -2.6);
  const vault = new THREE.CylinderGeometry(2.3, 2.3, 10, 18, 1, true, 0, Math.PI);
  vault.rotateZ(Math.PI / 2);
  b.add(vault, MAT.glass, 0, 0.6, -2.6, { cast: false });
  for (let x = -5; x <= 5.01; x += 1.25) b.add(new THREE.TorusGeometry(2.32, 0.06, 5, 18, Math.PI), MAT.copper, x, 0.6, -2.6, { ry: Math.PI / 2 });
  b.add(G.box(10.1, 0.1, 0.1, 1), MAT.copper, 0, 2.92, -2.6);
  for (const x of [-5.02, 5.02]) b.add(new THREE.CircleGeometry(2.3, 18, 0, Math.PI), MAT.glass, x, 0.6, -2.6, { ry: Math.PI / 2, cast: false });
  doorAt(b, 5.04, 0.6, -2.6, 0.9, 1.6, Math.PI / 2, 1, MAT.copper);
  const R = mulberry(12);
  const plant = (x, y, z, s, lvl = 1) => b.add(new THREE.IcosahedronGeometry(s, 0), MAT.leaf, x, y + s * 0.6, z, { lvl, sy: 0.75, ry: R() * 3 });
  for (let i = 0; i < 18; i++) plant(-4.4 + (i % 9) * 1.1, 0.6, -3.6 + Math.floor(i / 9) * 1.6, 0.35 + R() * 0.2);
  // beds: rows of greens and a few pumpkins
  for (let r = 0; r < 4; r++) for (let i = 0; i < 7; i++) {
    const x = -6.7 + 0.5 + i * 0.9, z = 0.6 + r * 1.15;
    if (r === 3 && i % 2) b.add(new THREE.SphereGeometry(0.26, 10, 8), MAT.pumpkin, x, 0.2, z, { sy: 0.8 });
    else plant(x, 0, z, 0.22 + R() * 0.14);
  }
  for (const z of [0.2, 4.95]) b.add(G.box(6.6, 0.18, 0.12, 1), MAT.oak, -3.4, 0.09, z);
  // herb boxes and a barrow
  for (let i = 0; i < 3; i++) { b.add(G.box(1.4, 0.5, 0.8), MAT.oak, 2 + i * 1.7, 0.25, 1.4); plant(2 + i * 1.7, 0.5, 1.4, 0.3); }
  // level 2: beehives and a rain tank
  for (let i = 0; i < 3; i++) { const x = 1.8 + i * 1.6, z = 3.9; for (let k = 0; k < 3; k++) b.add(G.box(0.8, 0.32, 0.7, 1), k % 2 ? MAT.cream : MAT.oak, x, 0.3 + k * 0.32, z, { lvl: 2 }); b.add(G.box(1.0, 0.1, 0.9, 1), MAT.slate, x, 1.32, z, { lvl: 2 }); }
  for (const [x, z] of [[5.6, -0.4], [6.8, -0.4], [5.6, 0.8], [6.8, 0.8]]) b.add(G.box(0.18, 2.2, 0.18, 1), MAT.oakDark, x, 1.1, z, { lvl: 2 });
  b.add(G.cyl(1.0, 1.0, 1.6, 18), MAT.copper, 6.2, 3.0, 0.2, { lvl: 2 });
  b.add(new THREE.ConeGeometry(1.05, 0.5, 18), MAT.copper, 6.2, 4.05, 0.2, { lvl: 2 });
}

// ----------------------------------------------------------------- lens tower
function modelLens(b) {
  b.add(G.cyl(2.0, 2.3, 0.6, 16), MAT.dressed, 0, 0.3, 0);
  b.add(G.cyl(1.7, 2.0, 6.2, 16), MAT.stone, 0, 0.6 + 3.1, 0);
  b.add(G.cyl(2.15, 2.15, 0.3, 16), MAT.dressed, 0, 6.85, 0);
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; b.add(G.box(0.7, 0.7, 0.4), MAT.stone, Math.cos(a) * 1.95, 7.35, Math.sin(a) * 1.95, { ry: -a + Math.PI / 2 }); }
  doorAt(b, 0, 0.6, 1.93, 0.9, 1.8);
  windowAt(b, 0, 4.2, 1.82, 0.4, 0.9, 0, 1, { noMullion: true });
  // the head: brass yoke, lens, crystal core. it turns toward its target.
  const head = new THREE.Group(); head.userData.dynamic = head.userData.rigid = true; head.position.set(0, 7.0, 0); b.group.add(head); b.head = head;
  b.add(G.cyl(0.5, 0.6, 0.4, 12), MAT.brass, 0, 0.2, 0, { parent: head });
  for (const x of [-0.85, 0.85]) b.add(G.box(0.14, 1.6, 0.14, 1), MAT.brass, x, 1.0, 0, { parent: head });
  const tilt = new THREE.Group(); tilt.userData.rigid = true; tilt.position.set(0, 1.5, 0); head.add(tilt); b.tilt = tilt;
  b.add(new THREE.TorusGeometry(0.78, 0.11, 8, 28), MAT.brass, 0, 0, 0.35, { parent: tilt });
  b.add(new THREE.CircleGeometry(0.74, 28), MAT.lens, 0, 0, 0.36, { parent: tilt, cast: false });
  b.add(G.cyl(0.5, 0.75, 1.0, 14).rotateX(Math.PI / 2), MAT.copper, 0, 0, -0.2, { parent: tilt });
  b.coreMat = MAT.crystal.clone(); b.coreMat.emissiveIntensity = 0.6; trackEnv(b.coreMat, 0.8);
  b.add(new THREE.OctahedronGeometry(1, 0), b.coreMat, 0, 0, -0.8, { parent: tilt, sx: 0.28, sy: 0.28, sz: 0.55 });
  b.muzzle = new THREE.Object3D(); b.muzzle.position.set(0, 0, 0.6); tilt.add(b.muzzle);
  // level 2: second lens and a copper hood on posts
  b.add(new THREE.TorusGeometry(0.5, 0.08, 8, 24), MAT.brass, 0, 0.85, 0.35, { parent: tilt, lvl: 2 });
  b.add(new THREE.CircleGeometry(0.47, 24), MAT.lens, 0, 0.85, 0.36, { parent: tilt, lvl: 2, cast: false });
  for (const [x, z] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) b.add(G.box(0.16, 3.2, 0.16, 1), MAT.oakDark, x * 0.85, 8.6, z * 0.85, { lvl: 2 });
  b.add(new THREE.ConeGeometry(2.6, 1.6, 8), MAT.copper, 0, 10.9, 0, { lvl: 2, ry: Math.PI / 8 });
  b.add(G.cyl(0.08, 0.2, 0.9, 6), MAT.brass, 0, 12.1, 0, { lvl: 2 });
}

// ----------------------------------------------------------------- clockwork ballista
function modelBallista(b) {
  b.add(G.cyl(1.55, 1.75, 0.5, 8), MAT.dressed, 0, 0.25, 0, { ry: Math.PI / 8 });
  b.add(G.cyl(1.3, 1.4, 0.3, 8), MAT.stone, 0, 0.65, 0, { ry: Math.PI / 8 });
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; b.add(G.box(0.14, 0.14, 0.14, 1), MAT.brass, Math.cos(a) * 1.33, 0.82, Math.sin(a) * 1.33, { cast: false }); }
  // the head turns toward its target; the stock tilts
  const head = new THREE.Group(); head.userData.dynamic = head.userData.rigid = true; head.position.set(0, 0.8, 0); b.group.add(head); b.head = head;
  b.add(G.cyl(0.78, 0.88, 0.22, 16), MAT.brass, 0, 0.11, 0, { parent: head });
  b.add(G.box(0.38, 0.85, 0.38), MAT.oakDark, 0, 0.62, 0, { parent: head });
  for (const s of [-1, 1]) b.add(G.box(0.1, 0.5, 0.5, 1), MAT.iron, s * 0.25, 0.95, 0, { parent: head });
  const tilt = new THREE.Group(); tilt.userData.rigid = true; tilt.position.set(0, 1.12, 0); head.add(tilt); b.tilt = tilt;
  b.add(G.box(0.3, 0.24, 2.5, 1), MAT.oak, 0, 0, 0.15, { parent: tilt });
  b.add(G.box(0.36, 0.06, 2.3, 1), MAT.brass, 0, 0.14, 0.2, { parent: tilt, cast: false });
  for (const s of [-1, 1]) {
    beam(b, [0, 0.02, 1.2], [s * 1.3, 0.02, 0.72], 0.13, MAT.iron, 1, { parent: tilt });
    beam(b, [s * 1.3, 0.04, 0.72], [0, 0.06, -0.55], 0.035, MAT.rope, 1, { parent: tilt, cast: false });
  }
  b.add(G.box(0.07, 0.07, 1.5, 1), MAT.oakDark, 0, 0.22, 0.45, { parent: tilt, cast: false });
  b.add(new THREE.ConeGeometry(0.09, 0.3, 6).rotateX(Math.PI / 2), MAT.iron, 0, 0.22, 1.32, { parent: tilt, cast: false });
  b.add(G.cyl(0.3, 0.3, 0.56, 14).rotateZ(Math.PI / 2), MAT.brass, 0, -0.04, -0.95, { parent: tilt });
  b.add(G.box(0.08, 0.5, 0.08, 1), MAT.iron, 0.36, 0.1, -0.95, { parent: tilt, cast: false });
  b.add(G.box(0.3, 0.08, 0.08, 1), MAT.iron, 0.48, 0.34, -0.95, { parent: tilt, cast: false });
  b.muzzle = new THREE.Object3D(); b.muzzle.position.set(0, 0.22, 1.5); tilt.add(b.muzzle);
  // level 2: a second drum and an iron shield with a slot
  b.add(G.cyl(0.34, 0.34, 0.5, 14).rotateZ(Math.PI / 2), MAT.copper, 0, 0.3, -1.25, { parent: tilt, lvl: 2 });
  for (const s of [-1, 1]) b.add(G.box(0.72, 0.8, 0.08, 1), MAT.iron, s * 0.5, 0.1, 1.05, { parent: tilt, lvl: 2 });
  b.add(G.box(1.74, 0.12, 0.1, 1), MAT.brass, 0, 0.52, 1.05, { parent: tilt, lvl: 2, cast: false });
}

// ----------------------------------------------------------------- mooring mast
function modelMast(b) {
  const H = 14;
  for (const [x, z] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) beam(b, [x, 0, z], [x * 0.55, H, z * 0.55], 0.3, MAT.oak);
  for (let y = 3; y < H; y += 3.4) {
    const k = y / H, s = lerp(1.5, 0.82, k);
    for (const [ax, az, bx, bz] of [[-s, -s, s, -s], [s, -s, s, s], [s, s, -s, s], [-s, s, -s, -s]]) beam(b, [ax, y, az], [bx, y, bz], 0.16, MAT.oakDark, 1, { cast: false });
  }
  for (let y = 0; y < H - 1; y += 3.4) { const k0 = y / H, k1 = (y + 3.4) / H, s0 = lerp(1.5, 0.82, k0), s1 = lerp(1.5, 0.82, Math.min(1, k1)); beam(b, [-s0, y, s0], [s1, Math.min(H, y + 3.4), s1], 0.1, MAT.iron, 1, { cast: false }); beam(b, [s0, y, -s0], [-s1, Math.min(H, y + 3.4), -s1], 0.1, MAT.iron, 1, { cast: false }); }
  b.add(G.box(3.2, 0.3, 3.2), MAT.boards, 0, H, 0);
  for (const [x, z, w, d] of [[0, -1.6, 3.2, 0.08], [-1.6, 0, 0.08, 3.2], [0, 1.6, 3.2, 0.08]]) b.add(G.box(w, 0.9, d, 1), MAT.oakDark, x, H + 0.6, z, { cast: false });
  b.add(G.cyl(0.25, 0.3, 3.0, 10), MAT.brass, 0, H + 1.6, 0);
  b.add(new THREE.TorusGeometry(0.6, 0.08, 8, 20).rotateX(Math.PI / 2), MAT.brass, 0, H + 3.1, 0);
  b.add(new THREE.PlaneGeometry(1.3, 0.8), MAT.wool, 0.75, H + 2.7, 0, { cast: false });
  // gangway east to the ship
  b.add(G.box(2.6, 0.18, 1.0), MAT.boards, 2.9, H + 0.1, 0);
  for (const z of [-0.5, 0.5]) b.add(G.box(2.6, 0.06, 0.06, 1), MAT.rope, 2.9, H + 0.95, z, { cast: false });
  // ladder up one leg
  for (let y = 0.5; y < H; y += 0.5) { const s = lerp(1.62, 0.95, y / H); b.add(G.box(0.7, 0.05, 0.05, 1), MAT.oak, 0, y, s, { cast: false }); }
}

// ----------------------------------------------------------------- the courier "Lark"
function buildAirship() {
  const ship = new THREE.Group(), hullG = new THREE.Group(); ship.add(hullG);
  const Lx = 15, B = 2.3, Dp = 2.2, NU = 22, NV = 12;
  const halfW = u => B * Math.pow(Math.sin(Math.PI * clamp(u * 0.94 + 0.04, 0, 1)), 0.62) * (u < 0.15 ? 0.82 + u * 1.2 : 1);
  const depth = u => Dp * Math.pow(Math.sin(Math.PI * clamp(u * 0.9 + 0.08, 0, 1)), 0.5);
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= NU; i++) {
    const u = i / NU, x = -Lx / 2 + u * Lx, hw = halfW(u), dp = depth(u), sheer = 0.35 * Math.pow(Math.abs(u - 0.45) * 2, 2);
    for (let j = 0; j <= NV; j++) {
      const v = j / NV, a = -Math.PI / 2 + v * Math.PI;    // around the hull, port deck edge → keel → starboard deck edge
      const y = -Math.pow(Math.max(0, Math.cos(a)), 1.3) * dp, z = Math.sin(a) * hw;
      pos.push(x, y + sheer, z); uv.push(u * Lx / 2.5, v * 3.2);
    }
  }
  for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) { const a = i * (NV + 1) + j, b = a + NV + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const hg = new THREE.BufferGeometry(); hg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); hg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); hg.setIndex(idx); hg.computeVertexNormals();
  const hull = new THREE.Mesh(hg, MAT.oak.clone()); hull.material.side = THREE.DoubleSide; hull.castShadow = true; hullG.add(hull);
  // deck
  const deckShape = new THREE.Shape(); for (let i = 0; i <= NU; i++) { const u = i / NU; deckShape[i ? 'lineTo' : 'moveTo'](-Lx / 2 + u * Lx, halfW(u) * 0.97); } for (let i = NU; i >= 0; i--) { const u = i / NU; deckShape.lineTo(-Lx / 2 + u * Lx, -halfW(u) * 0.97); }
  const dg = new THREE.ShapeGeometry(deckShape); dg.rotateX(-Math.PI / 2); const dpos = dg.attributes.position, duv = dg.attributes.uv; for (let k = 0; k < dpos.count; k++) duv.setXY(k, dpos.getX(k) / 2, dpos.getZ(k) / 2);
  const deck = new THREE.Mesh(dg, MAT.boards); deck.position.y = 0.04; deck.receiveShadow = true; hullG.add(deck);
  const add = (g, m, x, y, z, o = {}) => { const k = new THREE.Mesh(g, m); k.position.set(x, y, z); if (o.rx) k.rotation.x = o.rx; if (o.ry) k.rotation.y = o.ry; if (o.rz) k.rotation.z = o.rz; k.castShadow = o.cast !== false; k.receiveShadow = true; hullG.add(k); return k; };
  // brass rails along the gunwale
  for (const s of [-1, 1]) for (let i = 0; i < NU; i++) { const u0 = i / NU, u1 = (i + 1) / NU, a = new THREE.Vector3(-Lx / 2 + u0 * Lx, 0.75, s * halfW(u0) * 0.97), c = new THREE.Vector3(-Lx / 2 + u1 * Lx, 0.75, s * halfW(u1) * 0.97); const m = add(G.box(0.07, a.distanceTo(c) + 0.02, 0.07, 1), MAT.brass, (a.x + c.x) / 2, 0.75, (a.z + c.z) / 2, { cast: false }); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), c.clone().sub(a).normalize()); if (i % 2 === 0) add(G.box(0.06, 0.72, 0.06, 1), MAT.brass, a.x, 0.38, a.z, { cast: false }); }
  // stern cabin
  add(G.box(3.2, 1.7, 2.8), MAT.oakDark, -4.6, 0.85, 0); add(G.box(3.6, 0.18, 3.2), MAT.copper, -4.6, 1.8, 0);
  for (const z of [-1.41, 1.41]) for (const x of [-5.4, -3.8]) { const w = add(G.box(0.6, 0.55, 0.05, 1), MAT.window, x, 1.0, z, { cast: false }); w.userData.win = true; }
  add(G.box(0.05, 0.55, 1.2, 1), MAT.window, -6.21, 1.0, 0, { cast: false });
  // masts and sails
  add(G.cyl(0.13, 0.17, 8.5, 10), MAT.oak, 0.6, 4.25, 0);
  add(G.cyl(0.08, 0.08, 4.4, 8).rotateX(Math.PI / 2), MAT.oak, 0.6, 7.6, 0);
  add(G.cyl(0.08, 0.08, 4.0, 8).rotateX(Math.PI / 2), MAT.oak, 0.6, 2.4, 0);
  const sailG = new THREE.PlaneGeometry(4.3, 5.0, 8, 8); const sp = sailG.attributes.position; for (let k = 0; k < sp.count; k++) { const x = sp.getX(k), y = sp.getY(k); sp.setZ(k, Math.cos(x / 4.3 * Math.PI) * 0.55 * (1 - Math.abs(y) / 5)); } sailG.computeVertexNormals();
  const sail = add(sailG, MAT.canvas, 0.85, 5.0, 0, { ry: -Math.PI / 2 });
  const jibG = new THREE.BufferGeometry(); jibG.setAttribute('position', new THREE.Float32BufferAttribute([0.6, 7.6, 0, 0.6, 1.2, 0, 6.6, 1.0, 0], 3)); jibG.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0], 2)); jibG.computeVertexNormals();
  add(jibG, MAT.canvas, 0, 0, 0);
  add(G.cyl(0.07, 0.1, 3.4, 8).rotateZ(-1.35), MAT.oak, 7.6, 1.0, 0);
  const flag = add(new THREE.PlaneGeometry(1.2, 0.5), MAT.wool, 1.2, 8.75, 0, { cast: false });
  // sunstone lift crystals on outriggers
  const liftMat = MAT.crystal.clone(); liftMat.emissiveIntensity = 1.4; trackEnv(liftMat, 0.8);
  const crystals = [];
  for (const s of [-1, 1]) for (const x of [-2.6, 3.0]) {
    const arm = add(G.box(0.14, 0.14, 2.4, 1), MAT.brass, x, 0.2, s * (halfW(0.5) + 1.0));
    const cx = x, cz = s * (halfW(0.5) + 2.2), cy = -0.2;
    for (const [dx, dz] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]]) add(G.box(0.05, 1.6, 0.05, 1), MAT.brass, cx + dx, cy, cz + dz, { cast: false });
    add(G.box(0.9, 0.08, 0.9, 1), MAT.brass, cx, cy - 0.8, cz); add(G.box(0.9, 0.08, 0.9, 1), MAT.brass, cx, cy + 0.8, cz);
    const c = add(new THREE.OctahedronGeometry(1, 0), liftMat, cx, cy, cz); c.scale.set(0.3, 0.62, 0.3); crystals.push(c);
    void arm;
  }
  // propeller
  const prop = new THREE.Group(); prop.position.set(-7.7, -0.2, 0); hullG.add(prop);
  const hub = new THREE.Mesh(G.cyl(0.18, 0.24, 0.5, 10).rotateZ(Math.PI / 2), MAT.brass); prop.add(hub);
  for (let i = 0; i < 3; i++) { const bl = new THREE.Mesh(G.box(0.06, 1.3, 0.32, 1), MAT.brass); bl.position.y = 0.65; const pg = new THREE.Group(); pg.rotation.x = i * TAU / 3; bl.rotation.y = 0.5; pg.add(bl); prop.add(pg); }
  // lanterns
  const lantMat = new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffb45a, emissiveIntensity: 2.2 });
  for (const [x, z] of [[6.2, 0], [-6.3, 0.9], [-6.3, -0.9]]) add(G.box(0.3, 0.38, 0.3, 1), lantMat, x, 1.35, z, { cast: false });
  const light = new THREE.PointLight(0xffb060, 0, 22, 1.5); light.position.set(0, 1.5, 0); hullG.add(light);
  prop.userData.dynamic = true; flag.userData.dynamic = true;
  mergeStatic(hullG);
  ship.traverse(o => { if (o.isMesh) o.userData.ship = true; });
  scene.add(ship);
  return { ship, hullG, prop, crystals, liftMat, light, sail, flag, lantMat, halfW };
}

// ----------------------------------------------------------------- the rim wall: palisade, then stone
const WALL = { segs: [], level: 1 };
function buildWall(towerSpots) {
  const loop = insetOutline(3.4);
  // resample at 3.4 m and drop the ends close to the face
  const pts = [loop[0]]; let acc = 0;
  for (let i = 1; i < loop.length; i++) { acc += Math.hypot(loop[i][0] - loop[i - 1][0], loop[i][1] - loop[i - 1][1]); if (acc >= 3.4) { pts.push(loop[i]); acc = 0; } }
  pts.push(loop[loop.length - 1]);
  const segs = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], mx = (ax + bx) / 2, mz = (az + bz) / 2;
    if (mz > WORLD.faceZ - 4.5) continue;
    if (towerSpots.some(t => Math.hypot(t.x - mx, t.z - mz) < 3.2)) continue;
    segs.push({ a: [ax, az], b: [bx, bz], mx, mz, len: Math.hypot(bx - ax, bz - az), ang: Math.atan2(bz - az, bx - ax), hp: 1, maxHp: 1, broken: false, k1: 1, k2: 0 });
  }
  // palisade logs and stone blocks, all instanced
  const R = mulberry(808);
  const logsPer = 8, nLogs = segs.length * logsPer;
  const logGeo = new THREE.CylinderGeometry(0.17, 0.2, 1, 7); logGeo.translate(0, 0.5, 0);
  const tipGeo = new THREE.ConeGeometry(0.19, 0.5, 7); tipGeo.translate(0, 0.25, 0);
  const logs = new THREE.InstancedMesh(logGeo, MAT.oak, nLogs), tips = new THREE.InstancedMesh(tipGeo, MAT.oakDark, nLogs);
  const stoneGeo = projUV(new THREE.BoxGeometry(1, 1, 1), 2); stoneGeo.translate(0, 0.5, 0);
  const blocks = new THREE.InstancedMesh(stoneGeo, MAT.stone, segs.length), merl = new THREE.InstancedMesh(stoneGeo, MAT.dressed, segs.length * 3), caps = new THREE.InstancedMesh(stoneGeo, MAT.dressed, segs.length);
  for (const m of [logs, tips, blocks, merl, caps]) { m.castShadow = true; m.receiveShadow = true; scene.add(m); }
  segs.forEach((s, i) => { s.logs = []; for (let k = 0; k < logsPer; k++) s.logs.push({ t: (k + 0.5) / logsPer, h: 2.5 + R() * 0.7, tilt: (R() - 0.5) * 0.06, tz: (R() - 0.5) * 0.12 }); });
  WALL.segs = segs; WALL.mesh = { logs, tips, blocks, merl, caps }; WALL.loop = pts;
  wallMatrices();
  return segs;
}
const _wm = new THREE.Matrix4(), _wq = new THREE.Quaternion(), _we = new THREE.Euler(), _wp = new THREE.Vector3(), _ws = new THREE.Vector3();
function wallMatrices() {
  const { logs, tips, blocks, merl, caps } = WALL.mesh;
  WALL.segs.forEach((s, i) => {
    const hpK = s.broken ? 0.18 : 1, dmg = s.broken ? 1 : 1 - s.hp;
    s.logs.forEach((l, k) => {
      // a battered palisade: the weakest logs lean out of line, then snap off to stumps
      const weak = hash2(i * 13 + k, 77), down = !s.broken && dmg > 0.3 && weak < (dmg - 0.3) * 1.3, lean = dmg > 0.12 && weak < dmg + 0.25 ? (hash2(i, k * 5 + 1) - 0.5) * dmg * 0.9 : 0;
      const x = lerp(s.a[0], s.b[0], l.t) - Math.sin(s.ang) * l.tz, z = lerp(s.a[1], s.b[1], l.t) + Math.cos(s.ang) * l.tz, h = l.h * s.k1 * hpK * (down ? 0.28 : 1);
      _we.set(l.tilt + lean, 0, l.tilt * 0.5 + lean * 0.6); _wq.setFromEuler(_we);
      _wm.compose(_wp.set(x, 0, z), _wq, _ws.set(1, Math.max(0.001, h), 1)); logs.setMatrixAt(i * 8 + k, _wm);
      _wm.compose(_wp.set(x, h, z), _wq, _ws.set(1, Math.max(0.001, s.k1 * hpK * (down ? 0 : 1)), 1)); tips.setMatrixAt(i * 8 + k, _wm);
    });
    _we.set(0, -s.ang, 0); _wq.setFromEuler(_we);
    const h = 2.8 * s.k2 * hpK * (1 - dmg * 0.1);
    _wm.compose(_wp.set(s.mx, 0, s.mz), _wq, _ws.set(s.len + 0.25, Math.max(0.001, h), 1.1)); blocks.setMatrixAt(i, _wm);
    _wm.compose(_wp.set(s.mx, h, s.mz), _wq, _ws.set(s.len + 0.35, Math.max(0.001, 0.25 * s.k2 * (dmg > 0.6 ? 0 : 1)), 1.3)); caps.setMatrixAt(i, _wm);
    for (let k = 0; k < 3; k++) {
      // merlons knocked off one by one as a stone section takes harm
      const t = (k + 0.5) / 3, x = lerp(s.a[0], s.b[0], t) + Math.sin(s.ang) * 0.35, z = lerp(s.a[1], s.b[1], t) - Math.cos(s.ang) * 0.35, gone = s.broken || dmg > 0.3 + hash2(i, k) * 0.5;
      _wm.compose(_wp.set(x, h + 0.2 * s.k2, z), _wq, _ws.set(0.7, Math.max(0.001, 0.6 * s.k2 * (gone ? 0 : 1)), 0.45)); merl.setMatrixAt(i * 3 + k, _wm);
    }
  });
  for (const m of Object.values(WALL.mesh)) m.instanceMatrix.needsUpdate = true;
  wallDamageDraw();   // cracks and rubble (nights.js)
}
function wallSetLevel(lv, animate) {
  WALL.level = lv;
  if (!animate) { for (const s of WALL.segs) { s.k1 = lv === 1 ? 1 : 0; s.k2 = lv >= 2 ? 1 : 0; } wallMatrices(); return; }
  WALL.anim = { t: 0, lv };
}
function wallUpdate(dt) {
  if (!WALL.anim) return;
  WALL.anim.t += dt; const T = WALL.anim.t, n = WALL.segs.length;
  WALL.segs.forEach((s, i) => { const k = clamp((T - i / n * 5) / 0.6, 0, 1); s.k1 = 1 - k; s.k2 = k; if (k > 0 && k < 1 && Math.random() < 0.08) FX.puff(new THREE.Vector3(s.mx, 1.4, s.mz), 2); });
  wallMatrices();
  if (T > 6) WALL.anim = null;
}

// ----------------------------------------------------------------- trees, rocks, plants, lamps
// Trees and rocks keep to the rim, outside the build grid, so the lawn inside reads clean.
// Lamps belong to buildings: each kind has a few posts at the corners of its footprint, and they move with it.
const DECOR = { lamps: [], lampMesh: null, pools: null, clumps: [], free: [] };
const LAMP_SPOTS = { keep: [[-1, 1], [1, 1], [-1, -1], [1, -1]], yard: [[-1, 1], [1, 1]], garden: [[-1, 1], [1, 1]], shop: [[-1, 1], [1, 1]], lens: [[1, 1]], mast: [[-1, 1]], ballista: [], head: [] };
const LAMP_MAX = 48;
function blocked(x, z, pad = 0) {
  if (tileOkAt(x, z) || tileOkAt(x + pad, z) || tileOkAt(x - pad, z) || tileOkAt(x, z + pad) || tileOkAt(x, z - pad)) return true;
  const H = LAYOUT.head; if (Math.abs(x - H.x) < H.w / 2 + 2.5 + pad && Math.abs(z - H.z) < H.d / 2 + 3 + pad) return true;
  if (Math.hypot(x - LAYOUT.trail.x, z - LAYOUT.trail.z) < 3.5 + pad) return true;
  if (dockClear(x, z, pad)) return true;
  return false;
}
// ----------------------------------------------------------------- trees, and the wind in them
// Pines: seven ragged tiers whose hems droop, darker inside and underneath, lighter at the tips. Broadleaf trees: a
// crown of lumpy clumps, shaded darker underneath (where the light doesn't reach) and warmer on top. Both sway: the
// wind moves everything above the trunk a little, each tree in its own time.
const WIND = { time: { value: 0 } };
function windSway(mat, amp, from = 1.0, key = 'sway') {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uWind = WIND.time;
    sh.vertexShader = 'uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 wp = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
      #else
        vec3 wp = vec3(0.0);
      #endif
      float sw = max(0.0, transformed.y - ${from.toFixed(2)}) * ${amp.toFixed(4)};
      float gust = 0.6 + 0.4 * sin(uWind * 0.31 + wp.x * 0.05);
      transformed.x += (sin(uWind * 1.3 + wp.x * 0.37 + wp.z * 0.21) + 0.35 * sin(uWind * 3.1 + wp.z * 1.7 + transformed.y)) * sw * gust;
      transformed.z += cos(uWind * 1.07 + wp.z * 0.33 + wp.x * 0.11) * sw * 0.55 * gust;`);
  };
  mat.customProgramCacheKey = () => key + amp + from;
  return mat;
}
function pineGeometry() {
  const parts = [], tiers = 7;
  for (let t = 0; t < tiers; t++) {
    const k = t / (tiers - 1), r = lerp(2.4, 0.42, k), h = lerp(2.3, 1.35, k), y0 = 1.25 + k * 4.7;
    const g = new THREE.ConeGeometry(r, h, 14, 3);
    const p = g.attributes.position, col = [];
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const f = (y + h / 2) / h, a = Math.atan2(z, x), j = hash2(t * 37 + Math.round((a + Math.PI) * 14 / TAU), 11 + t), j2 = hash2(t * 13, Math.round((a + Math.PI) * 7 / TAU));
      if (f < 0.01) { const rr = 1 + (j - 0.5) * 0.42; x *= rr; z *= rr; y -= 0.15 + j * 0.45; }   // a ragged, drooping hem
      else if (f < 0.6) { const rr = 1 + (j2 - 0.5) * 0.16 * (1 - f); x *= rr; z *= rr; }
      p.setXYZ(i, x, y + y0 + h / 2 - 0.35, z);
      const sh = f < 0.01 ? 0.58 + j * 0.25 : lerp(0.82, 1.22, f) * (0.95 + j2 * 0.1);
      col.push(sh * 0.92, sh, sh * 0.86);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    parts.push(g.toNonIndexed());
  }
  const out = mergeGeometries(parts); out.deleteAttribute('uv'); return out;
}
function crownGeometry() {
  const blobs = [[0, 3.5, 0, 1.55], [0.95, 3.0, 0.35, 1.15], [-0.85, 3.1, -0.45, 1.2], [0.25, 4.35, -0.2, 1.1], [-0.4, 3.7, 0.9, 1.0], [0.7, 3.9, -0.8, 0.95], [-1.0, 2.6, 0.5, 0.8], [0.4, 2.5, -0.9, 0.85]];
  const parts = blobs.map(([bx, by, bz, r], n) => {
    const g = new THREE.IcosahedronGeometry(r, 2), p = g.attributes.position, col = [];
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), d = 1 + (fbm(x * 1.7 + n * 3, z * 1.7 + y * 1.3, 3) - 0.5) * 0.55;
      p.setXYZ(i, x * d + bx, y * d * 0.9 + by, z * d + bz);
      const up = (y / r + 1) / 2, sh = lerp(0.5, 1.2, up) * (0.92 + hash2(i, n) * 0.16);
      col.push(sh * (0.95 + up * 0.08), sh, sh * (0.85 - up * 0.05));
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g.index ? g.toNonIndexed() : g;
  });
  const out = mergeGeometries(parts); out.deleteAttribute('uv'); return out;
}
function buildDecor() {
  const R = mulberry(2024);
  // --- trees: dark pines toward the rim, a few round broadleaf trees just inside the wall
  const trunkG = new THREE.CylinderGeometry(0.13, 0.28, 2.4, 7); trunkG.translate(0, 1.2, 0);
  const pineG = pineGeometry();
  const blobG = crownGeometry();
  const trunk2 = mergeGeometries([new THREE.CylinderGeometry(0.17, 0.32, 3.0, 7).translate(0, 1.5, 0),
    new THREE.CylinderGeometry(0.06, 0.11, 1.6, 5).rotateZ(0.75).translate(0.55, 2.6, 0), new THREE.CylinderGeometry(0.06, 0.11, 1.5, 5).rotateZ(-0.7).rotateY(2).translate(-0.3, 2.5, 0.45)].map(g => g.toNonIndexed()));
  const pts = [];
  for (let i = 0; i < 1400 && pts.length < 110; i++) {
    const x = (R() - 0.5) * 94, z = -40 + R() * 74;
    if (!onPlateau(x, z)) continue;
    const dr = distToOutline(x, z);
    if (dr < 1.2) continue;
    if (dr > 2.4 && dr < 4.6) continue;  // keep the wall line clear
    if (blocked(x, z, 1.6)) continue;
    if (z > WORLD.faceZ - 3) continue;
    if (R() > (dr < 2.4 ? 0.9 : 0.55)) continue;
    if (pts.some(p => Math.hypot(p.x - x, p.z - z) < 2.6)) continue;
    pts.push({ x, z, pine: dr < 2.4 ? R() < 0.85 : R() < 0.4, s: dr < 2.4 ? 0.75 + R() * 0.55 : 0.6 + R() * 0.3, r: R() * TAU });
  }
  DECOR.trees = pts;
  const pines = pts.filter(p => p.pine), broads = pts.filter(p => !p.pine);
  const mkI = (geo, mat, list, colFn) => { const m = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length)); list.forEach((p, i) => { _wm.compose(_wp.set(p.x, 0, p.z), _wq.setFromEuler(_we.set(0, p.r, 0)), _ws.set(p.s, p.s * (0.9 + (p.s % 0.2)), p.s)); m.setMatrixAt(i, _wm); if (colFn) m.setColorAt(i, colFn(p)); }); m.count = list.length; m.castShadow = true; m.receiveShadow = true; scene.add(m); return m; };
  const barkMat = trackEnv(new THREE.MeshStandardMaterial({ map: tex('oak'), color: 0x6a5040, roughness: 1 }), 0.1);
  const needleMat = windSway(trackEnv(new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.92 }), 0.1), 0.022, 1.2, 'pine');
  const leafMat = windSway(trackEnv(new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.88 }), 0.1), 0.03, 1.8, 'leaf');
  const pc = new THREE.Color();
  mkI(trunkG, barkMat, pines); mkI(pineG, needleMat, pines, p => pc.setHSL(0.37 + (p.r % 0.05), 0.42, 0.085 + (p.s % 0.05)).clone());
  mkI(trunk2, barkMat, broads); mkI(blobG, leafMat, broads, p => pc.setHSL(0.2 + (p.r % 0.08), 0.5, 0.13 + (p.s % 0.07)).clone());
  // --- rocks along the rim
  const rockG = projUV(new THREE.DodecahedronGeometry(1, 0), 1.5);
  const rocks = [];
  for (let i = 0; i < 400 && rocks.length < 60; i++) { const x = (R() - 0.5) * 94, z = -40 + R() * 74; if (!onPlateau(x, z) || z > WORLD.faceZ - 1.5) continue; const dr = distToOutline(x, z); if (dr > 2.2 || dr < 0.3 || dockClear(x, z, 1)) continue; rocks.push({ x, z, s: 0.4 + R() * 0.9, r: R() * TAU }); }
  const rm = new THREE.InstancedMesh(rockG, MAT.rock, rocks.length);
  rocks.forEach((p, i) => { _wm.compose(_wp.set(p.x, p.s * 0.2, p.z), _wq.setFromEuler(_we.set(p.r, p.r * 2, p.r * 0.5)), _ws.set(p.s * 1.3, p.s * 0.7, p.s)); rm.setMatrixAt(i, _wm); });
  rm.castShadow = true; rm.receiveShadow = true; scene.add(rm);
  // --- painted plant clumps from Briarwatch, as crossed cards. Thick at the rim, a light scatter on the lawn.
  const card = (() => {
    const a = new THREE.PlaneGeometry(1, 1); a.translate(0, 0.5, 0);
    const flip = g => { const f = g.clone(); const ix = f.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i]; ix[i] = ix[i + 2]; ix[i + 2] = t; } return f; };
    const b2 = a.clone().rotateY(Math.PI / 2);
    const g = mergeGeometries([a, flip(a), b2, flip(b2)]); const n = g.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0); return g;
  })();
  for (const [key, count, where] of [['meadow', 130, 'rim'], ['meadow', 70, 'lawn'], ['fern', 90, 'rim'], ['herb', 40, 'lawn'], ['reed', 70, 'rim']]) {
    const mat = windSway(trackEnv(new THREE.MeshStandardMaterial({ map: bleedTex(key), emissiveMap: bleedTex(key), emissive: 0xffffff, emissiveIntensity: 0.06, alphaTest: 0.45, side: THREE.FrontSide, roughness: 0.95 }), 0.05), 0.13, 0.05, 'clump-' + key + where);
    (worldMats.clumps || (worldMats.clumps = [])).push(mat);
    const list = [];
    for (let i = 0; i < count * 10 && list.length < count; i++) {
      const x = (R() - 0.5) * 94, z = -40 + R() * 75; if (!onPlateau(x, z) || z > WORLD.faceZ - 0.8) continue;
      const dr = distToOutline(x, z), lawn = tileOkAt(x, z);
      if (dr < 0.6 || (dr > 2.6 && dr < 4.2)) continue;
      if (where === 'rim' && (lawn || dr > 9)) continue;
      if (where === 'lawn' && !lawn) continue;
      list.push({ x, z, s: (key === 'meadow' ? 0.9 : 1.1) * (where === 'lawn' ? 0.7 : 1) + R() * 0.6, r: R() * TAU });
    }
    const m = new THREE.InstancedMesh(card, mat, Math.max(1, list.length));
    m.receiveShadow = true; scene.add(m);
    DECOR.clumps.push({ m, list, lawn: where === 'lawn' });
  }
  updateClumps();
  // --- lamp posts: a pool of instances that buildings borrow
  const postG = mergeGeometries([projUV(new THREE.BoxGeometry(0.14, 2.7, 0.14).translate(0, 1.35, 0), 1), projUV(new THREE.BoxGeometry(0.4, 0.16, 0.4).translate(0, 0.08, 0), 1), projUV(new THREE.BoxGeometry(0.46, 0.08, 0.46).translate(0, 3.25, 0), 1)]);
  const cageG = mergeGeometries([[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]].map(([x, z]) => projUV(new THREE.BoxGeometry(0.04, 0.56, 0.04).translate(x, 2.98, z), 1)).concat([projUV(new THREE.BoxGeometry(0.42, 0.06, 0.42).translate(0, 2.7, 0), 1)]));
  const lampCrystal = new THREE.OctahedronGeometry(1, 0); lampCrystal.scale(0.13, 0.24, 0.13); lampCrystal.translate(0, 2.98, 0);
  const posts = new THREE.InstancedMesh(postG, MAT.iron, LAMP_MAX), cages = new THREE.InstancedMesh(cageG, MAT.brass, LAMP_MAX);
  const crys = new THREE.InstancedMesh(lampCrystal, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), LAMP_MAX);
  const poolTex = radialTex('rgba(255,180,90,0.55)', 'rgba(255,150,60,0)');
  const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffffff }), LAMP_MAX);
  posts.castShadow = cages.castShadow = true; scene.add(posts, cages, crys, pools);
  pools.renderOrder = 2;
  for (const m of [posts, cages, crys, pools]) { m.frustumCulled = false; for (let i = 0; i < LAMP_MAX; i++) { _wm.makeScale(0, 0, 0); m.setMatrixAt(i, _wm); } }
  DECOR.lampParts = { posts, cages, crys, pools };
  DECOR.lampMesh = crys; DECOR.pools = pools;
  DECOR.free = Array.from({ length: LAMP_MAX }, (_, i) => LAMP_MAX - 1 - i);
  // the headframe's two lamps never move
  const H = LAYOUT.head;
  DECOR.headLamps = [[H.x - 4.6, H.z - 3.0], [H.x + 4.6, H.z - 3.0]].map(([x, z]) => lampAt(x, z, null));
  setLampColors(0);
}
function lampAt(x, z, b) {
  const i = DECOR.free.pop(); if (i === undefined) return null;
  const L = { x, z, lit: true, i, y: 2.98, b };
  DECOR.lamps.push(L); placeLamp(L);
  return L;
}
function placeLamp(L) {
  const { posts, cages, crys, pools } = DECOR.lampParts;
  _wm.compose(_wp.set(L.x, 0, L.z), _wq.identity(), _ws.set(1, 1, 1)); posts.setMatrixAt(L.i, _wm); cages.setMatrixAt(L.i, _wm); crys.setMatrixAt(L.i, _wm);
  _wm.compose(_wp.set(L.x, 0.04, L.z), _wq.identity(), _ws.set(7, 1, 7)); pools.setMatrixAt(L.i, _wm);
  for (const m of [posts, cages, crys, pools]) m.instanceMatrix.needsUpdate = true;
}
function freeLamps(b) {
  for (const L of b.lamps || []) {
    const { posts, cages, crys, pools } = DECOR.lampParts; _wm.makeScale(0, 0, 0);
    for (const m of [posts, cages, crys, pools]) { m.setMatrixAt(L.i, _wm); m.instanceMatrix.needsUpdate = true; }
    DECOR.lamps.splice(DECOR.lamps.indexOf(L), 1); DECOR.free.push(L.i);
  }
  b.lamps = [];
  lampNight = -1;
}
// put a building's lamps at the corners of its footprint
function layoutLamps(b) {
  if (!DECOR.lampParts || !b.tile) return;
  const spots = LAMP_SPOTS[b.type] || [], F = FOOT[b.type], [cx, cz] = tileCenter(b.tile.tx, b.tile.tz, F.w, F.d);
  const hw = F.w * GRID.T / 2 - 0.6, hd = F.d * GRID.T / 2 - 0.6;
  if (!b.lamps || b.lamps.length !== spots.length) { freeLamps(b); b.lamps = spots.map(() => lampAt(0, 0, b)).filter(Boolean); }
  b.lamps.forEach((L, k) => { L.x = cx + spots[k][0] * hw; L.z = cz + spots[k][1] * hd; placeLamp(L); });
  lampNight = -1;
}
// hide lawn clumps that a building now stands on
function updateClumps() {
  const rects = Object.values(TOWN.b).filter(b => b.tile).map(b => { const F = FOOT[b.type]; return [GRID.X0 + b.tile.tx * GRID.T - 0.4, GRID.Z0 + b.tile.tz * GRID.T - 0.4, GRID.X0 + (b.tile.tx + F.w) * GRID.T + 0.4, GRID.Z0 + (b.tile.tz + F.d) * GRID.T + 0.4]; });
  for (const { m, list, lawn } of DECOR.clumps) {
    list.forEach((p, i) => {
      const hide = lawn && rects.some(r => p.x > r[0] && p.x < r[2] && p.z > r[1] && p.z < r[3]);
      _wm.compose(_wp.set(p.x, -0.05, p.z), _wq.setFromEuler(_we.set(0, p.r, 0)), _ws.setScalar(hide ? 0 : p.s)); m.setMatrixAt(i, _wm);
    });
    m.count = list.length; m.instanceMatrix.needsUpdate = true;
  }
}
const _lc = new THREE.Color();
function setLampColors(nightK) {
  if (!DECOR.lampMesh) return;
  for (const L of DECOR.lamps) {
    const on = L.lit && POWER.on;
    DECOR.lampMesh.setColorAt(L.i, on ? _lc.setRGB(2.4, 1.45, 0.6).multiplyScalar(0.4 + nightK * 0.8) : _lc.setRGB(0.32, 0.22, 0.14));
    DECOR.pools.setColorAt(L.i, on ? _lc.setRGB(1, 1, 1).multiplyScalar(nightK) : _lc.setRGB(0, 0, 0));
  }
  DECOR.lampMesh.instanceColor.needsUpdate = true; DECOR.pools.instanceColor.needsUpdate = true;
}
const POWER = { on: true };
