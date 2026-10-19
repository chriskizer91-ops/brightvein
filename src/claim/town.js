// ===================================================================== TOWN: the grid, and the buildings on it
const TOWN = { b: {}, ship: null, towers: [], ballistas: [], seq: {} };
const BUILD = { on: false, drag: null, sel: null, pending: null, kit: { ...KIT }, setupDone: false };
const MODELS = { keep: modelKeep, head: modelHead, yard: modelYard, shop: modelShop, garden: modelGarden, lens: modelLens, ballista: modelBallista, mast: modelMast };
const ROMAN = ['', ' I', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII'];
const byType = t => Object.values(TOWN.b).filter(b => b.type === t && !b.pending);
const countType = t => Object.values(TOWN.b).filter(b => b.type === t).length;   // pending ones count against the limit
function placeBuilding(id, type, L, level) {   // a building that does not live on the grid (the headframe)
  const b = new Building(id, DEFS[type], L); b.type = type;
  MODELS[type](b);
  b.show(level);
  TOWN.b[id] = b;
  return b;
}
// ---- the occupancy of the grid
function occupied(ignore) {
  const occ = new Map();
  for (const b of Object.values(TOWN.b)) { if (!b.tile || b === ignore) continue; const F = FOOT[b.type]; for (let j = 0; j < F.d; j++) for (let i = 0; i < F.w; i++) occ.set((b.tile.tz + j) * GRID.NX + b.tile.tx + i, b); }
  return occ;
}
function canPlace(type, tx, tz, ignore = null, occ = occupied(ignore)) {
  const F = FOOT[type];
  if (tx < 0 || tz < 0 || tx + F.w > GRID.NX || tz + F.d > GRID.NZ) return false;
  for (let j = 0; j < F.d; j++) for (let i = 0; i < F.w; i++) { const k = (tz + j) * GRID.NX + tx + i; if (!GRID.ok[k] || occ.has(k)) return false; }
  return true;
}
function snapTile(type, x, z) { const F = FOOT[type]; return [Math.round((x - GRID.X0) / GRID.T - F.w / 2), Math.round((z - GRID.Z0) / GRID.T - F.d / 2)]; }
function findSpot(type, x, z, ignore = null) {
  const occ = occupied(ignore), [cx, cz] = snapTile(type, x, z);
  for (let r = 0; r < 48; r++) {
    let best = null, bd = 1e9;
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
      const tx = cx + dx, tz = cz + dz; if (!canPlace(type, tx, tz, ignore, occ)) continue;
      const d = dx * dx + dz * dz; if (d < bd) { bd = d; best = [tx, tz]; }
    }
    if (best) return best;
  }
  return null;
}
const footCenter = b => { const F = FOOT[b.type]; return tileCenter(b.tile.tx, b.tile.tz, F.w, F.d); };
// move a building to a tile: the model, its smoke, lamps, scaffolding and pad all follow
function setTile(b, tx, tz) {
  const F = FOOT[b.type], [cx, cz] = tileCenter(tx, tz, F.w, F.d), x = cx + F.ox, z = cz + F.oz;
  const dx = x - b.group.position.x, dz = z - b.group.position.z;
  b.tile = { tx, tz }; b.L.x = x; b.L.z = z; b.group.position.set(x, 0, z); b.group.updateMatrixWorld(true);
  for (const p of b.smoke) { p.x += dx; p.z += dz; }
  if (b.smoke2) { b.smoke2.x += dx; b.smoke2.z += dz; }
  if (b.scaffold) b.scaffold.position.set(x, 0, z);
  if (b.pad) placePad(b);
  if (b.type === 'mast' && TOWN.ship) { TOWN.ship.home.set(x + 5.1, 14.25, z); if (SHIP.state === 'docked') TOWN.ship.ship.position.copy(TOWN.ship.home); }
  layoutLamps(b);
}
function nextBid(type) {
  if (type === 'keep' || type === 'mast') return type;
  let n = TOWN.seq[type] || 0, id; do { n++; id = type + n; } while (TOWN.b[id]);
  TOWN.seq[type] = n; return id;
}
function nameBuildings() {
  for (const t of Object.keys(FOOT)) { const list = Object.values(TOWN.b).filter(b => b.type === t); list.forEach((b, i) => { b.name = DEFS[t].name + (list.length > 1 ? ROMAN[i + 1] || ' ' + (i + 1) : ''); }); }
}
function addBuilding(type, tx, tz, level = 1, o = {}) {
  if (tx == null || !canPlace(type, tx, tz)) { const h = o.hint || [0, 0], s = findSpot(type, h[0], h[1]); if (!s) return null; [tx, tz] = s; }
  const id = o.id || nextBid(type), [w, d] = MODEL_SIZE[type];
  const n = /\d+$/.exec(id); if (n) TOWN.seq[type] = Math.max(TOWN.seq[type] || 0, +n[0]);
  const b = new Building(id, DEFS[type], { x: 0, z: 0, w, d, rot: 0 }); b.type = type;
  MODELS[type](b);
  TOWN.b[id] = b;
  setTile(b, tx, tz);
  makePad(b);
  if (type === 'lens') TOWN.towers.push(b);
  if (type === 'ballista') TOWN.ballistas.push(b);
  if (o.animate) { b.show(0); b.build(level, o.onDone); } else b.show(level);
  nameBuildings();
  return b;
}
function removeBuilding(b) {
  if (b.ring) { scene.remove(b.ring); b.ring = null; }
  for (const v of workersOf(b.id)) { v.d.job = null; v.replan = true; v.redraw(); }
  freeLamps(b); scaffoldOff(b);
  scene.remove(b.group); if (b.pad) scene.remove(b.pad);
  BUILDINGS.splice(BUILDINGS.indexOf(b), 1); delete TOWN.b[b.id];
  TOWN.towers = TOWN.towers.filter(x => x !== b); TOWN.ballistas = TOWN.ballistas.filter(x => x !== b);
  nameBuildings();
}
// ---- footprint pads and the grid overlay, shown in build mode
const PAD_TEX = {};
function padTex(w, d) {
  const k = w + 'x' + d; if (PAD_TEX[k]) return PAD_TEX[k];
  const s = 32, c = document.createElement('canvas'); c.width = w * s; c.height = d * s; const g = c.getContext('2d');
  g.fillStyle = 'rgba(255,255,255,0.16)'; g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 4;
  g.beginPath(); g.roundRect(3, 3, c.width - 6, c.height - 6, 9); g.fill(); g.stroke();
  // corner brackets
  g.lineWidth = 7; const L = Math.min(c.width, c.height) * 0.22;
  for (const [x, y, dx, dy] of [[4, 4, 1, 1], [c.width - 4, 4, -1, 1], [4, c.height - 4, 1, -1], [c.width - 4, c.height - 4, -1, -1]]) { g.beginPath(); g.moveTo(x + dx * L, y); g.lineTo(x, y); g.lineTo(x, y + dy * L); g.stroke(); }
  const t = canvasTex(c); return PAD_TEX[k] = t;
}
const PAD_COL = { idle: 0xf1e4c6, sel: 0xffcf85, ok: 0x9fd38a, bad: 0xff6a52 };
function makePad(b) {
  const F = FOOT[b.type];
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: padTex(F.w, F.d), transparent: true, depthWrite: false, toneMapped: false, color: PAD_COL.idle }));
  m.renderOrder = 4; m.visible = BUILD.on; m.userData.building = b; scene.add(m); b.pad = m; placePad(b);
}
function placePad(b) { const F = FOOT[b.type], [cx, cz] = footCenter(b); b.pad.position.set(cx, 0.08, cz); b.pad.scale.set(F.w * GRID.T - 0.1, 1, F.d * GRID.T - 0.1); }
function padColor(b, k) { if (b.pad) b.pad.material.color.setHex(PAD_COL[k]); }
let gridOverlay = null;
function makeGridOverlay() {
  const s = 24, c = document.createElement('canvas'); c.width = GRID.NX * s; c.height = GRID.NZ * s; const g = c.getContext('2d');
  for (let j = 0; j < GRID.NZ; j++) for (let i = 0; i < GRID.NX; i++) {
    if (!GRID.ok[j * GRID.NX + i]) continue;
    g.fillStyle = (i + j) % 2 ? 'rgba(255,250,220,0.10)' : 'rgba(255,250,220,0.03)'; g.fillRect(i * s, j * s, s, s);
    g.strokeStyle = 'rgba(255,250,220,0.32)'; g.lineWidth = 1; g.strokeRect(i * s + 0.5, j * s + 0.5, s - 1, s - 1);
  }
  const t = canvasTex(c); t.magFilter = THREE.LinearFilter;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(GRID.NX * GRID.T, GRID.NZ * GRID.T).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false }));
  m.position.set(GRID.X0 + GRID.NX * GRID.T / 2, 0.05, GRID.Z0 + GRID.NZ * GRID.T / 2); m.renderOrder = 3; m.visible = false; scene.add(m);
  gridOverlay = m;
}
function setupTown(save) {
  makeMaterials();
  buildGrid();
  buildWall([]);
  TOWN.wallLevel = (save && save.wall) || 1;
  wallSetLevel(TOWN.wallLevel, false);
  buildDecor();
  TOWN.ship = buildAirship();
  TOWN.ship.home = new THREE.Vector3(LAYOUT.mast.x + 5.1, 14.25, LAYOUT.mast.z);
  TOWN.ship.ship.rotation.y = Math.PI / 2;
  const list = save && save.buildings;
  const headLv = (list && (list.find(s => s.type === 'head') || {}).level) || 1;
  placeBuilding('head', 'head', { ...LAYOUT.head, w: 7.4, d: 6.4 }, headLv);
  if (list) {
    // the Keep first, so everything else finds room around it
    const order = [...list].sort((a, b) => (b.type === 'keep') - (a.type === 'keep'));
    for (const s of order) if (s.type !== 'head' && FOOT[s.type]) addBuilding(s.type, s.tx, s.tz, s.level || 1, { id: s.id, hint: s.hint });
  }
  if (!TOWN.b.keep) addBuilding('keep', null, null, 1, { hint: [LAYOUT.keep.x, LAYOUT.keep.z] });
  if (!TOWN.b.mast) addBuilding('mast', null, null, 1, { hint: [LAYOUT.mast.x, LAYOUT.mast.z] });
  TOWN.ship.ship.position.copy(TOWN.ship.home);
  makeGridOverlay();
  repaintGround(); updateClumps();
}
