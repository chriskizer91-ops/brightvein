// ===================================================================== PEOPLE: navigation, villagers, jobs, economy
const STAT_NAMES = { G: 'Grit', E: 'Engineering', A: 'Agility', R: 'Rapport', S: 'Sowing' };
const TRAITS = {
  'Night owl': 'Works a third harder after dark, a little slower by day.',
  'Green thumb': '+2 Sowing.',
  'Tinkerer': '+2 Engineering.',
  'Steady': 'Ten percent better at any job.',
  'Skittish': 'Runs from Wildlight at the first glimmer.',
  'Bold': '+2 Grit. Never runs.',
  'Sharp-eyed': '+2 Agility.',
  'Warm': '+2 Rapport.',
};
const DAY_LEN = 240;
const GAME = { day: 1, t: 0.14, speed: 1, paused: false, ore: 24, shards: 150, food: 40, recruit: 0, villagers: [], nextId: 1, nights: 0, log: [],
  stash: [], mats: { brass: 0, glass: 0, heartstone: 0 }, cells: {}, blueprints: [], findAcc: 0,
  rooms: Array.from({ length: 5 }, () => ({ type: null, level: 0 })) };

// ----------------------------------------------------------------- navigation grid (1 m cells)
const NAV = { GX: WORLD.GX, GZ: WORLD.GZ, X0: WORLD.gridX0, Z0: WORLD.gridZ0 };
NAV.cost = new Float32Array(NAV.GX * NAV.GZ);
NAV.wall = new Int16Array(NAV.GX * NAV.GZ).fill(-1);
const cellIx = (x, z) => [Math.floor(x - NAV.X0), Math.floor(z - NAV.Z0)];
const cellC = (ix, iz) => [NAV.X0 + ix + 0.5, NAV.Z0 + iz + 0.5];
const inGrid = (ix, iz) => ix >= 0 && iz >= 0 && ix < NAV.GX && iz < NAV.GZ;
const BLOCKS = {
  keep: [[-5.9, 5.9, -6.5, 3.5], [-3.8, -2.4, 4.5, 5.3], [2.2, 4.0, 4.9, 5.3]],
  head: [[-3.9, -0.5, -3.4, -0.6], [1.0, 3.6, -3.0, -0.8], [-3.9, -2.1, 0.3, 3.3, 2], [-3.0, -2.0, -0.2, 0.6], [2.0, 3.0, -0.2, 0.6], [-3.0, -2.0, 3.4, 4.6], [2.0, 3.0, 3.4, 4.6]],
  shop: [[-4.3, 4.3, -3.3, 3.15], [-2.7, 0.3, 3.4, 4.6], [2.7, 4.4, 3.3, 5.0]],
  garden: [[-5.4, 5.4, -5.2, -0.1], [1.1, 5.7, 0.9, 1.9], [1.1, 5.3, 3.4, 4.4, 2], [5.3, 7.2, -0.8, 1.2, 2]],
  mast: [[-1.8, 1.8, -1.8, 1.8]],
  yard: [],
};
function toLocal(b, x, z) { const th = b.group.rotation.y, dx = x - b.group.position.x, dz = z - b.group.position.z; return [dx * Math.cos(th) - dz * Math.sin(th), dx * Math.sin(th) + dz * Math.cos(th)]; }
function buildNav() {
  const C = NAV.cost; C.fill(0); NAV.wall.fill(-1);
  for (let iz = 0; iz < NAV.GZ; iz++) for (let ix = 0; ix < NAV.GX; ix++) {
    const [x, z] = cellC(ix, iz);
    if (onPlateau(x, z) && distToOutline(x, z) > 0.9) C[iz * NAV.GX + ix] = 1.6;
  }
  for (const b of Object.values(TOWN.b)) if (!b.pending) markBuilding(b);
  // the wall
  WALL.segs.forEach((s, si) => {
    for (let d = 0; d <= s.len; d += 0.35) {
      const x = s.a[0] + (s.b[0] - s.a[0]) * d / s.len, z = s.a[1] + (s.b[1] - s.a[1]) * d / s.len;
      for (const o of [-0.45, 0, 0.45]) { const [ix, iz] = cellIx(x - Math.sin(s.ang) * o, z + Math.cos(s.ang) * o); if (inGrid(ix, iz)) { const k = iz * NAV.GX + ix; NAV.wall[k] = si; if (!s.broken) C[k] = 0; } }
    }
  });
  // trees
  for (const t of DECOR.trees || []) { const [ix, iz] = cellIx(t.x, t.z); if (inGrid(ix, iz)) C[iz * NAV.GX + ix] = 0; }
}
function markBuilding(b) {
  const C = NAV.cost, lv = b.level;
  if (b.type === 'lens' || b.type === 'ballista') { const r = b.type === 'lens' ? 2.5 : 1.9; for (let iz = 0; iz < NAV.GZ; iz++) for (let ix = 0; ix < NAV.GX; ix++) { const [x, z] = cellC(ix, iz); if (Math.hypot(x - b.L.x, z - b.L.z) < r) C[iz * NAV.GX + ix] = 0; } return; }
  if (b.type === 'yard') {
    const w = (b.L.w || 12) / 2, d = (b.L.d || 8) / 2;
    for (let iz = 0; iz < NAV.GZ; iz++) for (let ix = 0; ix < NAV.GX; ix++) {
      const [x, z] = cellC(ix, iz), [lx, lz] = toLocal(b, x, z);
      if (Math.abs(lx) > w + 0.3 || Math.abs(lz) > d + 0.3) continue;
      const k = iz * NAV.GX + ix, edge = Math.abs(lx) > w - 0.6 || Math.abs(lz) > d - 0.6;
      C[k] = edge && !(lz > 0 && Math.abs(lx) < 1.4) ? 0 : 6;
    }
    return;
  }
  const rects = BLOCKS[b.type] || [];
  for (let iz = 0; iz < NAV.GZ; iz++) for (let ix = 0; ix < NAV.GX; ix++) {
    const [x, z] = cellC(ix, iz);
    if (Math.abs(x - b.L.x) > 12 || Math.abs(z - b.L.z) > 12) continue;
    const [lx, lz] = toLocal(b, x, z);
    for (const r of rects) if ((r[4] || 1) <= lv && lx > r[0] && lx < r[1] && lz > r[2] && lz < r[3]) C[iz * NAV.GX + ix] = 0;
    if (b.type === 'garden' && lz > 0 && lz < 5 && lx < -0.2 && lx > -7 && C[iz * NAV.GX + ix] > 0) C[iz * NAV.GX + ix] = 3;
  }
}
function nearestOpen(ix, iz, R = 4) {
  if (inGrid(ix, iz) && NAV.cost[iz * NAV.GX + ix] > 0) return [ix, iz];
  for (let r = 1; r <= R; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
    const x = ix + dx, z = iz + dz; if (inGrid(x, z) && NAV.cost[z * NAV.GX + x] > 0) return [x, z];
  }
  return null;
}
// A* over the grid, 8-way, no corner cutting
const _g = new Float32Array(NAV.GX * NAV.GZ), _came = new Int32Array(NAV.GX * NAV.GZ), _seen = new Uint32Array(NAV.GX * NAV.GZ), _closed = new Uint32Array(NAV.GX * NAV.GZ);
let _stamp = 1;
function astar(sx, sz, tx, tz) {
  const S = nearestOpen(...cellIx(sx, sz)), T = nearestOpen(...cellIx(tx, tz));
  if (!S || !T) return null;
  const GX = NAV.GX, C = NAV.cost, s = S[1] * GX + S[0], t = T[1] * GX + T[0];
  _stamp++;
  const heap = [], push = (k, f) => { heap.push([f, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (; ;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  const h = k => { const dx = Math.abs((k % GX) - T[0]), dz = Math.abs(((k / GX) | 0) - T[1]); return (dx + dz + (Math.SQRT2 - 2) * Math.min(dx, dz)); };
  _g[s] = 0; _seen[s] = _stamp; _came[s] = -1; push(s, h(s));
  let iter = 0;
  while (heap.length && iter++ < 9000) {
    const [, k] = pop();
    if (_closed[k] === _stamp) continue; _closed[k] = _stamp;
    if (k === t) break;
    const kx = k % GX, kz = (k / GX) | 0;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const nx = kx + dx, nz = kz + dz; if (!inGrid(nx, nz)) continue;
      const n = nz * GX + nx, c = C[n]; if (c <= 0) continue;
      if (dx && dz && (C[kz * GX + nx] <= 0 || C[nz * GX + kx] <= 0)) continue;
      const ng = _g[k] + c * (dx && dz ? Math.SQRT2 : 1);
      if (_seen[n] !== _stamp || ng < _g[n]) { _seen[n] = _stamp; _g[n] = ng; _came[n] = k; push(n, ng + h(n)); }
    }
  }
  if (_closed[t] !== _stamp) return null;
  const cells = []; for (let k = t; k !== -1; k = _came[k]) cells.push(k);
  cells.reverse();
  // string-pull: keep only the turns we can't see past
  const pts = cells.map(k => cellC(k % GX, (k / GX) | 0));
  const out = [pts[0]]; let i = 0;
  while (i < pts.length - 1) { let j = pts.length - 1; while (j > i + 1 && !los(pts[i], pts[j])) j--; out.push(pts[j]); i = j; }
  return out;
}
function los(a, b) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(L / 0.4);
  const c0 = NAV.cost[cellIx(a[0], a[1])[1] * NAV.GX + cellIx(a[0], a[1])[0]];
  for (let i = 1; i < n; i++) { const x = a[0] + (b[0] - a[0]) * i / n, z = a[1] + (b[1] - a[1]) * i / n, [ix, iz] = cellIx(x, z); if (!inGrid(ix, iz)) return false; const c = NAV.cost[iz * NAV.GX + ix]; if (c <= 0 || (c > 2.5 && c0 <= 2.5)) return false; }
  return true;
}

// ----------------------------------------------------------------- names and people
const FIRST = ['Ottilie', 'Jory', 'Maren', 'Silas', 'Hettie', 'Rook', 'Linnea', 'Ezra', 'Calla', 'Tobin', 'Greer', 'Aldous', 'Peony', 'Ivo', 'Saffi', 'Bastian', 'Nell', 'Caspar', 'Wynn', 'Delphine', 'Fitz', 'Rosalind', 'Emrys', 'Juniper', 'Lorcan', 'Mabel', 'Osric', 'Primrose', 'Quentin', 'Ruth', 'Sorrel', 'Thaddeus', 'Una', 'Vesper', 'Willa', 'Zillah', 'Ambrose', 'Dulcie', 'Hamish', 'Agnes', 'Barnaby', 'Cora', 'Dex', 'Elodie', 'Gideon', 'Isolde', 'Kit', 'Lark', 'Mercy', 'Ned'];
const LAST = ['Ashdown', 'Bellweather', 'Dunmore', 'Everly', 'Farrow', 'Gilchrist', 'Hollins', 'Ingleby', 'Jessop', 'Larkspur', 'Merriwether', 'Nettleton', 'Oakes', 'Penhallow', 'Quarrie', 'Rushworth', 'Saltmarsh', 'Thistlewood', 'Upton', 'Vane', 'Whitlock', 'Yarrow', 'Coalbrook', 'Dimmock', 'Fairweather', 'Greaves', 'Hartwell', 'Lowry', 'Marlow', 'Pryce', 'Rowntree', 'Sedgwick', 'Tremayne', 'Winslow'];
const GNOME_FIRST = ['Absalom', 'Tibbet', 'Nackle', 'Fennimore', 'Bodkin', 'Orsolya', 'Wimble'];
const GNOME_LAST = ['Pockett', 'Brasswhistle', 'Tumbleby', 'Gearwhit', 'Nubbins'];
const CAST = [
  { name: 'Hesper Lark', title: 'Captain of the Lark', job: 'mast', stats: { G: 7, E: 5, A: 9, R: 6, S: 3 }, trait: 'Bold', look: { hairStyle: 'long', hair: '#9a4430', hat: 'cap', hatCol: '#5a3a26', shirt: '#e7dcc2', over: 'coat', overCol: '#2f5d62', scarf: '#b5832a', skin: '#e9b48c', fringe: 'swept', beard: false, glasses: false, satchel: false, eyes: '#3f5a2e' } },
  { name: 'Odile Fenn', title: 'Lens grinder', job: 'shop', stats: { G: 3, E: 9, A: 4, R: 5, S: 4 }, trait: 'Tinkerer', look: { hairStyle: 'bun', hair: '#cfc6b8', hat: null, glasses: true, shirt: '#6b3a5e', over: 'apron', overCol: '#7a5234', skin: '#d39a6c', beard: false, fringe: 'parted', scarf: null, satchel: false } },
  { name: 'Pip Kettleby', title: 'Night-shift lookout', job: 'lens', stats: { G: 5, E: 6, A: 7, R: 6, S: 3 }, trait: 'Night owl', look: { hairStyle: 'crop', hair: '#d98a3a', hat: 'flatcap', hatCol: '#4f5660', shirt: '#e7dcc2', over: 'overalls', overCol: '#2f3d5c', skin: '#f7d6b5', beard: false, glasses: false, scarf: '#9a4430', fringe: 'swept', satchel: false } },
  { name: 'Marigold Thresh', title: 'Gardener and beekeeper', job: 'garden', stats: { G: 4, E: 3, A: 4, R: 7, S: 9 }, trait: 'Green thumb', look: { hairStyle: 'braids', hair: '#e8c46a', hat: 'brim', hatCol: '#b5832a', scarf: '#a8577a', shirt: '#e7dcc2', over: 'vest', overCol: '#6f7f4c', skin: '#eebd93', beard: false, glasses: false, satchel: false, fringe: 'blunt' } },
  { name: 'Corwin Ashlar', title: 'Wallwright', job: 'wall', stats: { G: 8, E: 8, A: 4, R: 2, S: 3 }, trait: 'Steady', look: { hairStyle: 'bald', hair: '#2a1d1c', beard: true, hat: null, shirt: '#4f5660', over: 'vest', overCol: '#5a4632', skin: '#7a4a32', glasses: false, scarf: null, satchel: true } },
  { name: 'Absalom Pockett', title: 'Assayer of the claim', job: 'keep', stats: { G: 2, E: 7, A: 3, R: 8, S: 4 }, trait: 'Warm', look: { gnome: true, hair: '#efece4', hat: 'gnome', hatCol: '#9a4430', over: 'coat', overCol: '#6b3a5e', shirt: '#e7dcc2', glasses: true, beard: true, skin: '#eebd93', scarf: null, satchel: false } },
];
const JOB_TOOL = { keep: 'book', ballista: 'hammer', head: 'pick', yard: 'crystal', shop: 'hammer', garden: 'can', lens: 'glass', wall: 'lance', mast: 'rope' };
function makePerson(R, o = {}) {
  // settlers come off the roll in folk.js (a name, a portrait and a look that match); a random stranger only if it's spent
  const f = o.noFolk ? null : nextFolk(o.pref);
  if (f) {
    const keys = ['G', 'E', 'A', 'R', 'S'], stats = {};
    for (const k of keys) stats[k] = 2 + (R() * 5 | 0);
    stats[f.focus] = 6 + (R() * 4 | 0);
    if (f.look.gnome) { stats.E = Math.min(10, stats.E + 2); stats.G = Math.max(1, stats.G - 2); }
    const traits = Object.keys(TRAITS);
    return { id: GAME.nextId++, name: f.name, portrait: f.id, stats, trait: traits[R() * traits.length | 0], look: randomLook(R, { ...f.look }), seed: R() * 1e9 | 0, job: null, home: null, gear: {}, pref: o.pref || f.pref };
  }
  const gnome = o.gnome ?? R() < 0.1;
  const name = gnome ? GNOME_FIRST[R() * GNOME_FIRST.length | 0] + ' ' + GNOME_LAST[R() * GNOME_LAST.length | 0] : FIRST[R() * FIRST.length | 0] + ' ' + LAST[R() * LAST.length | 0];
  const keys = ['G', 'E', 'A', 'R', 'S'], focus = o.focus || keys[R() * 5 | 0], stats = {};
  for (const k of keys) stats[k] = 2 + (R() * 5 | 0);
  stats[focus] = 6 + (R() * 4 | 0);
  if (gnome) { stats.E = Math.min(10, stats.E + 2); stats.G = Math.max(1, stats.G - 2); }
  const traits = Object.keys(TRAITS);
  return { id: GAME.nextId++, name, stats, trait: traits[R() * traits.length | 0], look: randomLook(R, { gnome }), seed: R() * 1e9 | 0, job: null, home: null, gear: {}, pref: o.pref || null };
}
function statOf(v, k) {
  let s = v.d.stats[k];
  const t = v.d.trait;
  if ((t === 'Green thumb' && k === 'S') || (t === 'Tinkerer' && k === 'E') || (t === 'Bold' && k === 'G') || (t === 'Sharp-eyed' && k === 'A') || (t === 'Warm' && k === 'R')) s += 2;
  s += gearOf(v)[k] || 0;
  return Math.min(16, s);
}

// ----------------------------------------------------------------- the villager in the world
const shadowTex = radialTex('rgba(20,10,20,0.55)', 'rgba(20,10,20,0)', 64);
const shadowGeo = new THREE.PlaneGeometry(1.1, 0.7).rotateX(-Math.PI / 2);
const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false });
const _cf = new THREE.Vector3(), _tmp = new THREE.Vector3();
class Villager {
  constructor(d) {
    this.d = d;
    this.canvas = drawVillagerSheet(this.look());
    this.tex = new THREE.CanvasTexture(this.canvas); this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.magFilter = THREE.NearestFilter; this.tex.minFilter = THREE.LinearMipmapLinearFilter;
    this.mat = new THREE.SpriteMaterial({ map: this.tex, alphaTest: 0.5, fog: true, toneMapped: false });
    this.sprite = new THREE.Sprite(this.mat); this.sprite.center.set(0.5, 0.03); this.sprite.scale.set(1.5, 2.0, 1);
    this.sprite.userData.villager = this; scene.add(this.sprite);
    this.isprite = new THREE.Sprite(this.mat); this.isprite.center.set(0.5, 0.03); this.isprite.scale.set(1.5, 2.0, 1); this.isprite.visible = false; this.isprite.userData.villager = this; KSCENE.add(this.isprite);
    this.shadow = new THREE.Mesh(shadowGeo, shadowMat); this.shadow.renderOrder = 1; scene.add(this.shadow);
    this.pos = new THREE.Vector3(); this.face = new THREE.Vector2(0, 1); this.vel = new THREE.Vector2();
    this.plan = []; this.where = 'surface'; this.hidden = false; this.working = false; this.anim = Math.random() * 10; this.moving = false; this.replan = true;
    this.row = -1; this.col = 0; this.mirror = false; this.light = 1;
  }
  // what they work with: the job's tool, or the item in their hand when it is made for this job; the watch
  // fights with whatever weapon they carry
  tool() {
    const j = this.d.job; if (!j) return 'hammer';
    const b = TOWN.b[j.bid], type = b ? b.type : j.bid, it = this.d.gear && this.d.gear.hand;
    if (it) {
      const { base } = itemBase(it), jobs = (base && base.jobs) || [];
      if (type === 'wall' && itemWeapon(it)) return it.kind;
      if (jobs.includes(type) || (type === 'keep' && jobs.includes('hall'))) return it.kind;
    }
    return b ? JOB_TOOL[b.type] : (j.bid === 'wall' ? 'lance' : 'hammer');
  }
  // the look to draw: their own, with the tool they work with and the weapon they carry
  look() { const g = gearOf(this); return { ...this.d.look, tool: this.tool(), weapon: g.weapon ? g.weapon.kind : null }; }
  redraw() { drawVillagerSheet(this.look(), this.canvas); this.tex.needsUpdate = true; }
  place(x, y, z) { this.pos.set(x, y, z); }
  get jobB() { const j = this.d.job; return j ? (j.bid === 'wall' ? WALLB : TOWN.b[j.bid]) : null; }
  eff() {
    const b = this.jobB; if (!b || !this.working) return 0;
    const def = b.def.job, night = TOD.night > 0.5;
    let e = statOf(this, def.stat) / 10;
    if (this.d.trait === 'Steady') e *= 1.1;
    if (this.d.trait === 'Night owl') e *= night ? 1.35 : 0.85;
    const g = gearOf(this); e *= 1 + outFor(g, b.type) / 100; if (night) e *= 1 + g.night / 100;
    if (mastered(this, def.stat)) e *= 1.2;
    if (GAME.food <= 0) e *= 0.5;
    return e;
  }
  setHidden(h) { this.hidden = h; this.sprite.visible = !h; this.shadow.visible = !h; }
  // --- frame selection relative to the camera
  get inside() { return this.where === 'study' || (this.where === 'home' && this.hidden); }
  frame(dt) {
    (this.inside ? kcam : camera).getWorldDirection(_cf); _cf.y = 0; _cf.normalize();
    const fv = this.face, d = fv.x * _cf.x + fv.y * _cf.z, right = fv.x * -_cf.z + fv.y * _cf.x;
    let row = d > 0.45 ? 1 : d < -0.45 ? 0 : 2, mirror = row === 2 && right > 0;
    if (this.climbing) { row = 1; mirror = false; }
    this.anim += dt;
    // walking runs through the four steps, work through its three beats; standing breathes, and blinks now and then
    let col = PX.STAND;
    if (this.moving) col = PX.WALK + Math.floor(this.anim * (this.running ? 11 : 7.5)) % 4;
    else if (this.working || this.fighting) col = PX.WORK + Math.floor(this.anim * (this.fighting ? 6 : 3.2)) % 3;
    else if (this.anim % 4.3 < 0.14) col = PX.IDLE + 1;
    else if (Math.floor(this.anim / 1.4) & 1) col = PX.IDLE;
    if (row !== this.row || col !== this.col || mirror !== this.mirror) {
      this.row = row; this.col = col; this.mirror = mirror;
      this.tex.repeat.set(mirror ? -1 / PX.COLS : 1 / PX.COLS, 1 / PX.ROWS);
      this.tex.offset.set(mirror ? (col + 1) / PX.COLS : col / PX.COLS, 1 - (row + 1) / PX.ROWS);
    }
  }
  update(dt) {
    const E = this.d.exp;
    if (E && (E.state === 'out' || E.state === 'back')) { if (!this.hidden) this.setHidden(true); this.where = 'wilds'; this.moving = false; return; }
    if (E) this.replan = false;
    if (this.replan && this.canReplan()) { this.plan = []; this.replan = false; }
    if (!this.plan.length) { if (E) this.plan = E.state === 'leaving' ? leavePlan(this) : arrivePlan(this); else think(this); }
    this.moving = false; this.climbing = false;
    const st = this.plan[0];
    if (st) runStep(this, st, dt);
    // follow the ship when aboard
    if (this.where === 'ship' && this.deck) { const S = TOWN.ship.ship; _tmp.set(this.deck[0], 0.1, this.deck[1]); S.localToWorld(_tmp); this.pos.copy(_tmp); }
    this.sprite.position.copy(this.pos);
    this.shadow.position.set(this.pos.x, this.pos.y + 0.03, this.pos.z);
    this.frame(dt);
  }
  canReplan() { const s = this.plan[0]; return !s || s.type === 'work' || s.type === 'wait' || s.type === 'study' || (s.type === 'walk' && this.where === 'surface') || s.type === 'sleep'; }
}

// ----------------------------------------------------------------- plans
const HEAD_ENTRY = () => TOWN.b.head.worldPos(0, 0.3, 1.6);
const SHAFT_X = 28.0, SHAFT_Z = MINE.walkZ;
function homeEntry(v) { const b = TOWN.b.keep; return b ? b.worldPos(0, 0, 4.4) : new THREE.Vector3(0, 0, 9); }
function stationFor(v) {
  const j = v.d.job; if (!j) return null;
  if (j.bid === 'wall') {
    const mend = wallRepairSpot(v); if (mend) return mend;   // by day the watch mends the wall (nights.js)
    const segs = WALL.segs, n = segs.length, s = segs[Math.floor((j.slot * 2 + 1) / (2 * Math.max(1, WALLB.slots())) * n) % n];
    const ix = -Math.sin(s.ang), iz = Math.cos(s.ang); let x = s.mx + ix * 1.6, z = s.mz + iz * 1.6;
    if (!onPlateau(x, z) || distToOutline(x, z) < 3.3) { x = s.mx - ix * 1.6; z = s.mz - iz * 1.6; }
    return { kind: 'surface', pos: new THREE.Vector3(x, 0, z), face: Math.atan2(s.mx - x, s.mz - z) };
  }
  const b = TOWN.b[j.bid]; if (!b) return null;
  if (b.type === 'head') { const m = MINE_STATIONS[j.slot]; const G = m.g === 1 ? MINE.g1 : MINE.g2; return { kind: 'mine', gy: G.y0, pos: new THREE.Vector3(m.x, G.y0, SHAFT_Z), face: m.x < SHAFT_X ? -Math.PI / 2 : Math.PI / 2 }; }
  if (b.type === 'mast') { const d = STATIONS.mast[j.slot].deck; return { kind: 'ship', deck: d }; }
  const S = (STATIONS[b.type] || [])[j.slot] || { x: 0, z: (b.L.d || 6) / 2 + 1.5, f: Math.PI };
  const p = b.worldPos(S.x, 0, S.z);
  if (b.type === 'lens') return { kind: 'tower', b, pos: b.worldPos(S.x, S.y, S.z), door: b.worldPos(0, 0, 2.6), face: b.group.rotation.y + Math.PI };
  return { kind: 'surface', pos: new THREE.Vector3(p.x, 0, p.z), face: b.group.rotation.y + S.f };
}
const isNightJob = v => { const b = v.jobB; return !!(b && b.def.job && b.def.job.night); };
// steps out of wherever the villager is now, back to open ground
function exitSteps(v) {
  if (v.where === 'mine') return [{ type: 'line', to: new THREE.Vector3(SHAFT_X, v.pos.y, SHAFT_Z) }, { type: 'climb', to: new THREE.Vector3(SHAFT_X, 0.3, SHAFT_Z) }, { type: 'line', to: HEAD_ENTRY(), then: () => v.where = 'surface' }];
  if (v.where === 'tower') { const b = v.towerB; return [{ type: 'hide', t: 1.2 }, { type: 'warp', to: b.worldPos(0, 0, 2.7), then: () => { v.where = 'surface'; v.setHidden(false); } }]; }
  if (v.where === 'ship') { if (SHIP.state !== 'docked') return [{ type: 'wait', t: 2 }]; const M = TOWN.b.mast; return [{ type: 'line', to: M.worldPos(0.4, 14.25, 0), then: () => { v.where = 'mast'; v.deck = null; } }, { type: 'climb', to: M.worldPos(0, 0, 2.2), then: () => v.where = 'surface' }]; }
  if (v.where === 'home' || v.where === 'study') return [{ type: 'warp', to: homeEntry(v), then: () => { v.where = 'surface'; v.setHidden(false); } }];
  return [];
}
function walkTo(v, target, o = {}) { return { type: 'walk', to: target.clone(), run: o.run, then: o.then }; }
function think(v) {
  if (v.d.study) {   // off to study in the Keep
    v.plan = v.where === 'study' ? [{ type: 'study' }] : [...exitSteps(v), walkTo(v, homeEntry(v)), { type: 'enterStudy' }, { type: 'study' }];
    return;
  }
  const night = TOD.phase === 'night' || TOD.phase === 'dusk' && TOD.t > 0.66;
  const S = stationFor(v);
  const atWork = S && (!night || isNightJob(v));
  if (atWork) {
    const out = [];
    if (S.kind === 'mine') {
      if (v.where !== 'mine') out.push(...exitSteps(v), walkTo(v, HEAD_ENTRY()), { type: 'line', to: new THREE.Vector3(SHAFT_X, 0.3, SHAFT_Z) }, { type: 'climb', to: new THREE.Vector3(SHAFT_X, S.gy, SHAFT_Z), then: () => v.where = 'mine' });
      else if (Math.abs(v.pos.y - S.gy) > 0.5) out.push({ type: 'line', to: new THREE.Vector3(SHAFT_X, v.pos.y, SHAFT_Z) }, { type: 'climb', to: new THREE.Vector3(SHAFT_X, S.gy, SHAFT_Z) });
      out.push({ type: 'line', to: S.pos }, { type: 'work', face: S.face });
    } else if (S.kind === 'tower') {
      if (v.where !== 'tower' || v.towerB !== S.b) out.push(...exitSteps(v), walkTo(v, S.door), { type: 'hide', t: 1.6 }, { type: 'warp', to: S.pos, then: () => { v.where = 'tower'; v.towerB = S.b; v.setHidden(false); } });
      out.push({ type: 'work', face: S.face });
    } else if (S.kind === 'ship') {
      if (v.where !== 'ship') {
        if (SHIP.state !== 'docked' && v.where !== 'ship') { out.push(...exitSteps(v), walkTo(v, TOWN.b.mast.worldPos(0, 0, 3.2)), { type: 'wait', t: 3 }); v.plan = out; return; }
        const M = TOWN.b.mast;
        out.push(...exitSteps(v), walkTo(v, M.worldPos(0, 0, 2.2)), { type: 'climb', to: M.worldPos(0, 14.25, 1.0) }, { type: 'line', to: M.worldPos(0.6, 14.25, 0) }, { type: 'line', to: M.worldPos(4.2, 14.25, 0) }, { type: 'board', deck: S.deck });
      }
      out.push({ type: 'work', face: 0 });
    } else {
      out.push(...exitSteps(v), walkTo(v, S.pos), { type: 'work', face: S.face });
    }
    v.plan = out; return;
  }
  if (night) {
    v.plan = [...exitSteps(v), walkTo(v, homeEntry(v)), { type: 'enter' }, { type: 'sleep' }];
    if (v.where === 'home') v.plan = [{ type: 'sleep' }];
    return;
  }
  // idle by day: stroll somewhere pleasant and stand about
  const K = TOWN.b.keep, front = K ? K.worldPos(0, 0, 9) : new THREE.Vector3(0, 0, 9), any = Object.values(TOWN.b).filter(b => b.tile && !b.pending);
  const o = any[Math.random() * any.length | 0], of = o ? o.worldPos(0, 0, FOOT[o.type].d + 1.5) : front;
  const spots = [[front.x, front.z, 4], [front.x, front.z, 7], [of.x, of.z, 3]];
  const s = spots[Math.random() * spots.length | 0], a = Math.random() * TAU, r = 1.5 + Math.random() * s[2];
  v.plan = [...exitSteps(v), walkTo(v, new THREE.Vector3(s[0] + Math.cos(a) * r, 0, s[1] + Math.sin(a) * r)), { type: 'wait', t: 4 + Math.random() * 8 }];
}
const _d2 = new THREE.Vector2();
function moveToward(v, to, speed, dt, flat = true) {
  const dx = to.x - v.pos.x, dy = to.y - v.pos.y, dz = to.z - v.pos.z, L = Math.hypot(dx, flat ? 0 : dy, dz);
  if (L < 0.05) { v.pos.copy(to); return true; }
  const step = Math.min(L, speed * dt);
  v.pos.x += dx / L * step; v.pos.z += dz / L * step; if (!flat) v.pos.y += dy / L * step;
  if (Math.hypot(dx, dz) > 0.01) v.face.set(dx, dz).normalize();
  v.moving = true;
  return false;
}
function runStep(v, s, dt) {
  const sp = (s.limp ? 1.0 : s.run || v.running ? 3.8 : 2.1) * (1 + clamp(gearOf(v).speed, -30, 40) / 100) * wxWalk();   // the hurt limp; rain slows everyone (nights.js, weather.js)
  const done = () => { v.plan.shift(); s.then && s.then(); };
  v.working = false; v.fighting = false;
  switch (s.type) {
    case 'walk': {
      if (!s.path) {
        const p = astar(v.pos.x, v.pos.z, s.to.x, s.to.z);
        s.path = p ? p.slice(1).map(([x, z]) => new THREE.Vector3(x, 0, z)) : [];
        s.path.push(s.to.clone().setY(0));
        v.running = !!s.run;
      }
      const tgt = s.path[0];
      if (moveToward(v, tgt, sp, dt)) { s.path.shift(); if (!s.path.length) { v.running = false; done(); } }
      v.pos.y = 0;
      break;
    }
    case 'line': if (moveToward(v, s.to, sp, dt, false)) done(); break;
    case 'climb': { v.climbing = true; if (moveToward(v, s.to, 1.8, dt, false)) done(); v.moving = true; v.climbing = true; break; }
    case 'warp': v.pos.copy(s.to); done(); break;
    case 'hide': s.t0 = s.t0 ?? s.t; if (!v.hidden) v.setHidden(true); s.t -= dt; if (s.t <= 0) done(); break;
    case 'enter': v.setHidden(true); v.where = 'home'; done(); break;
    case 'sleep': v.setHidden(true); break;
    case 'board': v.where = 'ship'; v.deck = s.deck; done(); break;
    case 'away': v.setHidden(true); break;
    case 'enterStudy': v.setHidden(true); v.where = 'study'; done(); break;
    case 'study': v.setHidden(true); v.working = true; break;
    case 'wait': s.t -= dt; if (s.t <= 0) done(); break;
    case 'work': { v.working = true; if (s.face !== undefined) v.face.set(Math.sin(s.face), Math.cos(s.face)); break; }
    case 'chase': {
      const W = s.target;
      if (!W || W.dead) { done(); break; }
      const d = Math.hypot(W.pos.x - v.pos.x, W.pos.z - v.pos.z), F = fightOf(v);
      if (d > F.range) { moveToward(v, _tmp.set(W.pos.x, 0, W.pos.z), 3.4, dt); v.running = true; }
      else {
        v.fighting = true; v.face.set(W.pos.x - v.pos.x, W.pos.z - v.pos.z).normalize(); W.hurt(F.dps * dt, v);
        if (F.ranged) { s.cd = (s.cd || 0) - dt; if (s.cd <= 0) { s.cd = F.cd; fireBeam(v.pos.clone().setY(1.2), W.pos.clone().setY(W.pos.y + 0.6), D.ASPECTS[F.aspect] ? new THREE.Color(D.ASPECTS[F.aspect].color).getHex() : 0xffd08a, 0.45); AUDIO.play('flare'); } }
      }
      s.t -= dt; if (s.t <= 0) done();
      break;
    }
  }
}

// ----------------------------------------------------------------- the wall's watch, as a pseudo-building
const WALLB = { id: 'wall', type: 'wall', name: 'Rim Wall', def: DEFS.wall, get level() { return TOWN.wallLevel; }, slots() { return DEFS.wall.job.slots[TOWN.wallLevel]; } };

// ----------------------------------------------------------------- jobs and homes
function slotsOf(b) { if (!b) return 0; if (b === WALLB) return WALLB.slots(); return b.def.job ? b.def.job.slots[b.level] || 0 : 0; }
function workersOf(bid) { return GAME.villagers.filter(v => v.d.job && v.d.job.bid === bid); }
function freeSlot(bid) {
  const b = bid === 'wall' ? WALLB : TOWN.b[bid], n = slotsOf(b), used = new Set(workersOf(bid).map(v => v.d.job.slot));
  for (let i = 0; i < n; i++) if (!used.has(i)) return i;
  return -1;
}
function assignJob(v, bid) {
  if (bid === null) { v.d.job = null; v.replan = true; v.redraw(); return true; }
  const slot = freeSlot(bid); if (slot < 0) return false;
  v.d.job = { bid, slot }; v.replan = true; v.redraw();
  return true;
}
function bedsOf(b) { return b && b.type === 'keep' ? DEFS.keep.beds[b.level] || 0 : 0; }
function totalBeds() { return bedsOf(TOWN.b.keep); }
function findBed() { return 'keep'; }
function addVillager(d, at) {
  const v = new Villager(d);
  if (!d.home) d.home = findBed();
  GAME.villagers.push(v);
  if (at) v.place(at.x, at.y, at.z); else { const e = homeEntry(v); v.place(e.x + (Math.random() - 0.5) * 2, 0, e.z + 1 + Math.random()); }
  return v;
}
// Everyone has a trade they'd rather do (pref). They take it up as soon as there's a building of that kind with room.
function seedVillagers() {
  const R = mulberry(1873);
  for (const c of CAST) {
    const d = { id: GAME.nextId++, name: c.name, title: c.title, stats: c.stats, trait: c.trait, look: randomLook(R, c.look), named: true, job: null, home: null, gear: {}, pref: c.job };
    addVillager(d);
  }
  const plan = [['head', 'G'], ['head', 'G'], ['yard', 'S'], ['yard', 'S']];   // the six founders bring four hired hands
  for (const [pref, focus] of plan) addVillager(makePerson(R, { focus, pref }));
  autoAssign();
}
function autoAssign() {
  for (const v of GAME.villagers) {
    if (v.d.job || v.d.exp || v.d.study || !v.d.pref) continue;
    if (v.d.pref === 'wall') { assignJob(v, 'wall'); continue; }
    const b = Object.values(TOWN.b).find(b => b.type === v.d.pref && !b.pending && b.level > 0 && freeSlot(b.id) >= 0);
    if (b) assignJob(v, b.id);
  }
}
