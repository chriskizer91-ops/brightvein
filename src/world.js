// ===================================================================== WORLD: plateau, face, mine, sky
// Town layout (metres; +x east, +z south toward the cut face)
// Only the headframe is fixed (it sits over the shaft in the cut face). Everything else lives on the build grid.
const LAYOUT = {
  head: { x: 28.5, z: 31.6, w: 7.4, d: 6.4 },
  mast: { x: -31, z: -26.5 },          // where the mast starts on a new claim
  keep: { x: 0, z: -3 },               // and the Keep
  trail: { x: -20, z: 34.4 },          // the rope stair down the cut face, for expeditions
};
// where things stood before the grid: used to bring an old save across
const OLD_LAYOUT = { hall: [0, -3], yardA: [-15, 19], yardB: [9.5, 22.5], shop: [19.5, 5], garden: [-21, -15], lens1: [-36, 5], lens2: [31, -18], mast: [-31, -26.5], plotN: [-3, -25], plotE: [33, 15.5] };
const PATHS = [];

// ----------------------------------------------------------------- the build grid: 2 m tiles, Clash-style
// A tile is buildable when it sits well inside the rim wall and clear of the headframe.
const GRID = { T: 2, X0: -48, Z0: -42, NX: 48, NZ: 39 };
GRID.ok = new Uint8Array(GRID.NX * GRID.NZ);
function buildGrid() {
  const { T, X0, Z0, NX, NZ } = GRID, H = LAYOUT.head;
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const x0 = X0 + i * T, z0 = Z0 + j * T; let ok = 1;
    for (const [x, z] of [[x0, z0], [x0 + T, z0], [x0, z0 + T], [x0 + T, z0 + T], [x0 + 1, z0 + 1]]) if (!onPlateau(x, z) || distToOutline(x, z) < 6.2) { ok = 0; break; }
    if (ok && x0 + T > H.x - H.w / 2 - 3 && x0 < H.x + H.w / 2 + 3 && z0 + T > H.z - H.d / 2 - 3.5) ok = 0;
    GRID.ok[j * NX + i] = ok;
  }
}
const tileCenter = (tx, tz, fw, fd) => [GRID.X0 + (tx + fw / 2) * GRID.T, GRID.Z0 + (tz + fd / 2) * GRID.T];
function tileOkAt(x, z) { const i = Math.floor((x - GRID.X0) / GRID.T), j = Math.floor((z - GRID.Z0) / GRID.T); return i >= 0 && j >= 0 && i < GRID.NX && j < GRID.NZ && !!GRID.ok[j * GRID.NX + i]; }

// ----------------------------------------------------------------- ground texture, painted once
let groundCanvas;
function paintGround() {
  const PPM = 2048 / WORLD.WX, W = 2048, H = Math.round(WORLD.WZ * PPM);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const toPx = (x, z) => [(x - WORLD.X0) * PPM, (z - WORLD.Z0) * PPM];
  const pat = (key, metres) => { const p = g.createPattern(IMG[key], 'repeat'); const s = metres * PPM / IMG[key].width; p.setTransform(new DOMMatrix().scale(s, s)); return p; };
  const R = mulberry(77);
  // base turf, with a second, larger scale to break up tiling
  g.fillStyle = pat('turf', 3.2); g.fillRect(0, 0, W, H);
  g.globalAlpha = 0.35; g.fillStyle = pat('turf', 7.5); g.fillRect(0, 0, W, H); g.globalAlpha = 1;
  // tonal patches: sun-dried gold and deep green
  for (let i = 0; i < 220; i++) {
    const x = R() * W, y = R() * H, r = (2 + R() * 7) * PPM;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    const col = R() < 0.5 ? 'rgba(196,170,92,' : R() < 0.5 ? 'rgba(40,64,30,' : 'rgba(120,140,70,';
    gr.addColorStop(0, col + (0.12 + R() * 0.14) + ')'); gr.addColorStop(1, col + '0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // stony rim near the cliff edge
  g.save();
  const rim = g.createPattern(IMG.rock, 'repeat'); rim.setTransform(new DOMMatrix().scale(3 * PPM / IMG.rock.width, 3 * PPM / IMG.rock.width));
  for (const [w, a] of [[5.5, 0.12], [3.6, 0.3], [2.2, 0.55], [1.1, 0.85]]) {
    g.globalAlpha = a; g.strokeStyle = rim; g.lineWidth = w * PPM; g.lineJoin = 'round';
    g.beginPath(); OUTLINE.forEach(([x, z], i) => { const [px, py] = toPx(x, z); i ? g.lineTo(px, py) : g.moveTo(px, py); }); g.stroke();
  }
  g.restore();
  // the headframe's worn yard never moves
  const earth = pat('earth', 3), HD = LAYOUT.head;
  softRect(g, toPx, PPM, HD.x - HD.w / 2 - 1.2, HD.z - HD.d / 2 - 1.2, HD.w + 2.4, HD.d + 2.4, earth, 1.5);
  // the foot of the rope stair down the face
  softRect(g, toPx, PPM, LAYOUT.trail.x - 1.5, LAYOUT.trail.z - 1.2, 3, 2.6, earth, 1);
  // scuffs and pebbles
  for (let i = 0; i < 1600; i++) {
    const x = R() * W, y = R() * H; g.fillStyle = R() < 0.5 ? 'rgba(60,48,34,0.35)' : 'rgba(230,220,190,0.25)'; g.fillRect(x, y, 2 + R() * 2, 2 + R() * 2);
  }
  groundBase = cv;
  groundCanvas = document.createElement('canvas'); groundCanvas.width = W; groundCanvas.height = H;
  groundCanvas.getContext('2d').drawImage(cv, 0, 0);
  GROUND = { PPM, toPx, earth, cobble: pat('cobbles', 4.5), loam: pat('loam', 2.6), ctx: groundCanvas.getContext('2d') };
  return groundCanvas;
}
let groundBase, GROUND;
// a rounded rect with a soft edge
function softRect(g, toPx, PPM, x, z, w, d, fill, r = 1.2, widths = [[1.2, 0.18], [0.5, 0.42], [0, 1]]) {
  g.fillStyle = fill;
  for (const [e, a] of widths) { g.globalAlpha = a; const [px, py] = toPx(x - e, z - e); g.beginPath(); g.roundRect(px, py, (w + 2 * e) * PPM, (d + 2 * e) * PPM, (r + e) * PPM); g.fill(); }
  g.globalAlpha = 1;
}
// Redraw the lawn and the pads under every building. Called whenever the layout changes.
// The lawn inside the wall is mown in alternating 2 m squares, so the build grid reads at a glance.
function repaintGround() {
  if (!GROUND) return;
  const { PPM, toPx, earth, cobble, loam, ctx: g } = GROUND, T = GRID.T;
  g.globalAlpha = 1; g.drawImage(groundBase, 0, 0);
  for (let j = 0; j < GRID.NZ; j++) for (let i = 0; i < GRID.NX; i++) {
    if (!GRID.ok[j * GRID.NX + i]) continue;
    const [px, py] = toPx(GRID.X0 + i * T, GRID.Z0 + j * T);
    g.fillStyle = (i + j) % 2 ? 'rgba(255,248,200,0.07)' : 'rgba(18,40,8,0.06)';
    g.fillRect(px, py, T * PPM + 0.5, T * PPM + 0.5);
  }
  for (const b of Object.values(TOWN.b)) {
    if (!b.tile || b.pending) continue;
    const F = FOOT[b.type], x0 = GRID.X0 + b.tile.tx * T, z0 = GRID.Z0 + b.tile.tz * T, w = F.w * T, d = F.d * T;
    const inset = b.type === 'lens' || b.type === 'ballista' || b.type === 'mast' ? 0.5 : 0.35;
    softRect(g, toPx, PPM, x0 + inset, z0 + inset, w - inset * 2, d - inset * 2, b.type === 'keep' ? cobble : earth, b.type === 'lens' || b.type === 'ballista' ? 1.6 : 1.0, [[0.6, 0.25], [0.25, 0.55], [0, 1]]);
    // a crisp dark edge, the way a Clash base sits on the lawn
    g.strokeStyle = 'rgba(46,30,24,0.32)'; g.lineWidth = 0.14 * PPM;
    const [px, py] = toPx(x0 + inset, z0 + inset); g.beginPath(); g.roundRect(px, py, (w - inset * 2) * PPM, (d - inset * 2) * PPM, (b.type === 'lens' || b.type === 'ballista' ? 1.6 : 1.0) * PPM); g.stroke();
    if (b.type === 'keep') { g.fillStyle = earth; g.globalAlpha = 0.85; const [ax, ay] = toPx(b.L.x - 2.4, b.L.z + 3.7); g.fillRect(ax, ay, 4.8 * PPM, 2.6 * PPM); g.globalAlpha = 1; }
    if (b.type === 'garden') for (let r = 0; r < 4; r++) { g.fillStyle = loam; const [bx, by] = toPx(b.L.x - 6.75, b.L.z + 0.25 + r * 1.15); g.fillRect(bx, by, 6.4 * PPM, 0.8 * PPM); }
  }
  if (worldMats.ground) worldMats.ground.map.needsUpdate = true;
}

// ----------------------------------------------------------------- top, cliffs, face
const FACE_RINGS = [0, -0.45, -1.4, -2.9, -5, -7.8, -11.2, -15.2, -19.8, -25, -31, -38, -46, -56, -70];
let faceEdges = null;   // per ring: [westX, eastX]
const worldMats = {};
function buildPlateau() {
  const groundTex = canvasTex(paintGround());
  // --- top surface
  const shape = new THREE.Shape(OUTLINE.map(([x, z]) => new THREE.Vector2(x, -z)));
  const top = new THREE.ShapeGeometry(shape, 1);
  top.rotateX(-Math.PI / 2);
  const p = top.attributes.position, uv = top.attributes.uv;
  for (let i = 0; i < p.count; i++) { uv.setXY(i, (p.getX(i) - WORLD.X0) / WORLD.WX, 1 - (p.getZ(i) - WORLD.Z0) / WORLD.WZ); }
  worldMats.ground = new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.96, metalness: 0, envMapIntensity: 0.25 });
  const topMesh = new THREE.Mesh(top, worldMats.ground); topMesh.receiveShadow = true; topMesh.name = 'ground';
  scene.add(topMesh);

  // --- cliffs: rings hanging from the outline, rough and widening a little before they vanish into cloud
  const P = OUTLINE, n = P.length, rings = FACE_RINGS;
  const arc = [0]; for (let i = 1; i < n; i++) arc.push(arc[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const total = arc[n - 1];
  const normals = P.map((pt, i) => {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)]; let tx = b[0] - a[0], tz = b[1] - a[1]; const l = Math.hypot(tx, tz) || 1;
    let nx = tz / l, nz = -tx / l; if (nx * pt[0] + nz * pt[1] < 0) { nx = -nx; nz = -nz; } return [nx, nz];
  });
  const pos = [], uvs = [], cols = [], idx = [];
  faceEdges = [];
  for (let j = 0; j < rings.length; j++) {
    const y = rings[j], sc = 1 + 0.075 * smooth(0, -26, y) - 0.2 * smooth(-42, -70, y), amp = 0.25 + 3.4 * smooth(0, -30, y);
    for (let i = 0; i < n; i++) {
      const w = smooth(0, 7, Math.min(arc[i], total - arc[i]));
      const d = (fbm(arc[i] / 6.5, y / 5.5 + 3.1, 4) - 0.5) * 2 * amp * w + (j === 1 ? 0.25 : 0) * w;
      let x = P[i][0] * sc + normals[i][0] * d, z = P[i][1] * sc + normals[i][1] * d;
      if (i === 0 || i === n - 1) z = WORLD.faceZ;
      z = Math.min(z, WORLD.faceZ);
      pos.push(x, y, z); uvs.push(arc[i] / 7, y / 7);
      const depthK = 1 - 0.5 * smooth(0, -40, y), band = 0.92 + 0.12 * Math.sin(y * 0.9 + fbm(arc[i] / 20, 0) * 4);
      const k = depthK * band;
      cols.push(k * 1.02, k * 0.96, k * 0.9);
    }
    faceEdges.push([pos[(j * n) * 3], pos[(j * n + n - 1) * 3]]);
  }
  for (let j = 0; j < rings.length - 1; j++) for (let i = 0; i < n - 1; i++) {
    const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const cg = new THREE.BufferGeometry();
  cg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  cg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  cg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  cg.setIndex(idx); cg.computeVertexNormals();
  worldMats.cliff = new THREE.MeshStandardMaterial({ map: tex('rock'), vertexColors: true, roughness: 0.97, envMapIntensity: 0.2, side: THREE.DoubleSide });
  const cliff = new THREE.Mesh(cg, worldMats.cliff); cliff.receiveShadow = true; cliff.castShadow = true;
  scene.add(cliff);

  buildFace();
  buildMineInterior();
  return { topMesh, cliff };
}

// the cut face: painted strata, glowing veins, holes for the mine
let faceMat, veinTex;
function strataCanvas() {
  const W = 1024, H = 1024, X0 = -46, WX = 92, Y0 = 0, HY = 72;     // metres covered
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
  const vc = document.createElement('canvas'); vc.width = W; vc.height = H; const v = vc.getContext('2d');
  const R = mulberry(4242), sx = W / WX, sy = H / HY;
  const bands = [[0, '#4a3524'], [1.1, '#8a6a48'], [2.6, '#b89263'], [5.2, '#a07a52'], [7, '#c4a274'], [9.6, '#8e7458'], [12.5, '#7a6a5e'], [16, '#6c5e58'], [20.5, '#5c5258'], [25, '#4c4652'], [31, '#3e3a46'], [40, '#34303c'], [72, '#2c2834']];
  for (let i = 0; i < bands.length - 1; i++) {
    const y0 = bands[i][0], y1 = bands[i + 1][0];
    g.fillStyle = bands[i][1]; g.beginPath();
    g.moveTo(0, y0 * sy);
    for (let x = 0; x <= W; x += 16) g.lineTo(x, (y0 + (fbm(x / 140, y0, 3) - 0.5) * 1.4 * (i ? 1 : 0.3)) * sy);
    for (let x = W; x >= 0; x -= 16) g.lineTo(x, (y1 + (fbm(x / 140, y1, 3) - 0.5) * 1.4) * sy);
    g.fill();
  }
  // rock grain over everything
  const rp = g.createPattern(IMG.rock, 'repeat'); rp.setTransform(new DOMMatrix().scale(4 * sx / IMG.rock.width * 1.0, 4 * sx / IMG.rock.width));
  g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.85; g.fillStyle = rp; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.45; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  // tool marks: the face was cut by hand
  g.strokeStyle = 'rgba(30,22,26,0.22)'; g.lineWidth = 1.2;
  for (let i = 0; i < 520; i++) { const x = R() * W, y = (1.5 + R() * 30) * sy; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 10, y + 6 + R() * 12); g.stroke(); }
  g.strokeStyle = 'rgba(255,240,210,0.08)';
  for (let i = 0; i < 300; i++) { const x = R() * W, y = (1.5 + R() * 40) * sy; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 8, y + 5 + R() * 9); g.stroke(); }
  // grass lip and roots at the top
  g.fillStyle = '#4f6a2c'; g.fillRect(0, 0, W, 0.35 * sy);
  g.strokeStyle = 'rgba(40,28,20,0.6)'; g.lineWidth = 1;
  for (let i = 0; i < 160; i++) { const x = R() * W; g.beginPath(); g.moveTo(x, 0.3 * sy); g.quadraticCurveTo(x + (R() - 0.5) * 20, (0.9 + R()) * sy, x + (R() - 0.5) * 30, (1 + R() * 2.2) * sy); g.stroke(); }
  // sunstone veins: wandering amber seams, densest around the galleries
  v.fillStyle = '#000'; v.fillRect(0, 0, W, H);
  const vein = (x, y, len, w0) => {
    let a = (R() - 0.5) * 0.8 + (R() < 0.5 ? 0 : Math.PI);
    v.lineCap = 'round'; g.lineCap = 'round';
    for (let k = 0; k < len; k++) {
      const nx = x + Math.cos(a) * 6, ny = y + Math.sin(a) * 4, w = w0 * (1 - k / len) + 0.6;
      v.strokeStyle = `rgba(255,${150 + R() * 60 | 0},60,${0.55 + R() * 0.45})`; v.lineWidth = w; v.beginPath(); v.moveTo(x, y); v.lineTo(nx, ny); v.stroke();
      g.strokeStyle = `rgba(255,${170 + R() * 50 | 0},90,0.75)`; g.lineWidth = w * 0.7; g.beginPath(); g.moveTo(x, y); g.lineTo(nx, ny); g.stroke();
      x = nx; y = ny; a += (R() - 0.5) * 0.7;
      if (R() < 0.03) vein(x, y, len * 0.35 | 0, w * 0.6);
    }
  };
  for (let i = 0; i < 11; i++) { const yy = (MINE.g1.y1 * -1 - 1 + R() * 20) * sy, xx = ((MINE.g2.x0 + R() * 48) - X0) * sx; vein(xx, yy, 10 + R() * 16 | 0, 1.6 + R() * 1.6); }
  for (let i = 0; i < 5; i++) vein(R() * W, (3 + R() * 36) * sy, 6 + R() * 10 | 0, 1 + R());
  // tiny glints
  for (let i = 0; i < 160; i++) { const x = R() * W, y = (2 + R() * 40) * sy; v.fillStyle = `rgba(255,190,90,${R() * 0.6})`; v.fillRect(x, y, 2, 2); g.fillStyle = 'rgba(255,214,140,0.7)'; g.fillRect(x, y, 2, 2); }
  veinTex = canvasTex(vc, { srgb: true });
  return { color: canvasTex(cv), X0, WX, HY };
}
let STRATA;
function faceUV(geo) {
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) - STRATA.X0) / STRATA.WX, 1 + p.getY(i) / STRATA.HY);
}
const minePlugs = [];
function buildFace() {
  STRATA = strataCanvas();
  const rings = FACE_RINGS, E = faceEdges;
  const outline = [];
  for (let j = 0; j < rings.length; j++) outline.push(new THREE.Vector2(E[j][0], rings[j]));
  for (let j = rings.length - 1; j >= 0; j--) outline.push(new THREE.Vector2(E[j][1], rings[j]));
  const shape = new THREE.Shape(outline);
  shape.holes.push(new THREE.Path(minePolygon().map(([x, y]) => new THREE.Vector2(x, y))));
  const geo = new THREE.ShapeGeometry(shape, 1);
  geo.translate(0, 0, WORLD.faceZ);
  faceUV(geo);
  faceMat = new THREE.MeshStandardMaterial({ map: STRATA.color, emissiveMap: veinTex, emissive: 0xffffff, emissiveIntensity: 0.3, roughness: 0.95, envMapIntensity: 0.2 });
  const face = new THREE.Mesh(geo, faceMat); face.receiveShadow = true; face.name = 'face';
  scene.add(face);
  // plugs of unbroken rock over the lower shaft and the deep gallery, until the deep seam is opened
  const plug = (x0, x1, y0, y1) => {
    const pieces = [];
    const cols = Math.max(2, Math.round((x1 - x0) / 3.2)), rows = 2;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const ax = x0 + (x1 - x0) * i / cols, bx = x0 + (x1 - x0) * (i + 1) / cols, ay = y0 + (y1 - y0) * j / rows, by = y0 + (y1 - y0) * (j + 1) / rows;
      const g = new THREE.PlaneGeometry(bx - ax, by - ay);
      g.translate((ax + bx) / 2, (ay + by) / 2, WORLD.faceZ);
      // map the front face to the strata so the plug is invisible against the face
      const pp = g.attributes.position, uu = g.attributes.uv;
      for (let k = 0; k < pp.count; k++) uu.setXY(k, (pp.getX(k) - STRATA.X0) / STRATA.WX, 1 + pp.getY(k) / STRATA.HY);
      const m = new THREE.Mesh(g, faceMat); m.receiveShadow = true; m.userData.cx = (ax + bx) / 2; m.userData.cy = (ay + by) / 2;
      m.userData.home = m.position.clone(); scene.add(m); pieces.push(m);
    }
    minePlugs.push(...pieces);
  };
  plug(MINE.shaft.x0, MINE.shaft.x1, MINE.g2.y1, MINE.g1.y0);
  plug(MINE.g2.x0, MINE.g2.x1, MINE.g2.y0, MINE.g2.y1);
}

// tunnels behind the face: walls extruded from the opening polygon, then timber, rails and crystal
const mineDecor = { lights: [], crystals: [], lanterns: [], seam: null, g1: new THREE.Group(), g2: new THREE.Group(), wheel: null };
function buildMineInterior() {
  const poly = minePolygon(), D = MINE.depth, z0 = WORLD.faceZ, z1 = z0 - D;
  const pos = [], nor = [], uv = [];
  // signed area to know which side is inside
  let area = 0; for (let i = 0; i < poly.length; i++) { const [ax, ay] = poly[i], [bx, by] = poly[(i + 1) % poly.length]; area += ax * by - bx * ay; }
  const ccw = area > 0;
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = poly[i], [bx, by] = poly[(i + 1) % poly.length];
    const ex = bx - ax, ey = by - ay, L = Math.hypot(ex, ey);
    let nx = -ey / L, ny = ex / L; if (!ccw) { nx = -nx; ny = -ny; }
    const quad = [[ax, ay, z0], [bx, by, z0], [bx, by, z1], [ax, ay, z1]];
    const tri = [0, 1, 2, 0, 2, 3];
    // wind so the face points inward
    const order = (ccw ? tri : [0, 2, 1, 0, 3, 2]);
    for (const k of order) { const q = quad[k]; pos.push(...q); nor.push(nx, ny, 0); uv.push((k === 1 || k === 2 ? L : 0) / 3, (k >= 2 ? D : 0) / 3); }
  }
  const walls = new THREE.BufferGeometry();
  walls.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  walls.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  walls.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  worldMats.tunnel = new THREE.MeshStandardMaterial({ map: tex('rock'), color: 0x9a8676, roughness: 1, envMapIntensity: 0.05, side: THREE.DoubleSide });
  const wm = new THREE.Mesh(walls, worldMats.tunnel); wm.receiveShadow = true; scene.add(wm);
  // back wall
  const back = new THREE.ShapeGeometry(new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x, y))));
  back.translate(0, 0, z1);
  const bp = back.attributes.position, bu = back.attributes.uv; for (let i = 0; i < bp.count; i++) bu.setXY(i, bp.getX(i) / 3, bp.getY(i) / 3);
  const backMat = new THREE.MeshStandardMaterial({ map: tex('rock'), color: 0x8a7868, roughness: 1, envMapIntensity: 0.05, emissiveMap: veinTex, emissive: 0x000000 });
  const bm = new THREE.Mesh(back, backMat); bm.receiveShadow = true; scene.add(bm);

  const oak = new THREE.MeshStandardMaterial({ map: tex('oak'), roughness: 0.85, envMapIntensity: 0.3 });
  const iron = new THREE.MeshStandardMaterial({ map: tex('iron'), roughness: 0.5, metalness: 0.7, envMapIntensity: 0.6 });
  const glow = new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffb45a, emissiveIntensity: 2.2 });
  const crystalMat = new THREE.MeshStandardMaterial({ color: 0xffb04a, emissive: 0xff8a24, emissiveIntensity: 1.6, roughness: 0.25, metalness: 0.1, flatShading: true });
  worldMats.mineGlow = glow; worldMats.mineCrystal = crystalMat;
  const add = (geo, mat, x, y, z, parent = scene, cast = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m; };
  const gallery = (G, parent, deep) => {
    // timber sets every 3.6 m: posts against the back wall, caps reaching toward the face
    for (let x = G.x0 + 1.4; x < G.x1 - 0.6; x += 3.6) {
      if (x > MINE.shaft.x0 - 0.8 && x < MINE.shaft.x1 + 0.4) continue;
      const h = G.y1 - G.y0;
      add(new THREE.BoxGeometry(0.32, h, 0.32), oak, x, G.y0 + h / 2, z1 + 0.35, parent);
      add(new THREE.BoxGeometry(0.34, 0.34, D - 0.2), oak, x, G.y1 - 0.2, z0 - D / 2 - 0.1, parent);
      add(new THREE.BoxGeometry(0.28, h, 0.28), oak, x, G.y0 + h / 2, z0 - 0.35, parent);
    }
    // rails and sleepers
    for (const dz of [-2.3, -3.1]) add(new THREE.BoxGeometry(G.x1 - G.x0 - 1, 0.08, 0.08), iron, (G.x0 + G.x1) / 2 - 0.3, G.y0 + 0.13, z0 + dz, parent, false);
    for (let x = G.x0 + 0.8; x < G.x1 - 0.5; x += 0.9) add(new THREE.BoxGeometry(0.22, 0.08, 1.3), oak, x, G.y0 + 0.05, z0 - 2.7, parent, false);
    // lanterns
    for (let x = G.x0 + 3; x < G.x1 - 1; x += 7.2) {
      add(new THREE.BoxGeometry(0.06, 0.5, 0.06), iron, x + 1.8, G.y1 - 0.62, z0 - 1.2, parent, false);
      const l = add(new THREE.BoxGeometry(0.34, 0.42, 0.34), glow, x + 1.8, G.y1 - 1.05, z0 - 1.2, parent, false);
      mineDecor.lanterns.push(l);
    }
    // crystal clusters growing from the back wall and ceiling
    const R = mulberry(deep ? 91 : 19);
    const n = deep ? 22 : 10;
    for (let i = 0; i < n; i++) {
      const x = G.x0 + 1 + R() * (G.x1 - G.x0 - 2); if (x > MINE.shaft.x0 - 0.5 && x < MINE.shaft.x1 + 0.5) continue;
      const onCeil = R() < 0.35, cl = new THREE.Group();
      for (let k = 0; k < 3 + R() * 4; k++) {
        const s = 0.18 + R() * (deep ? 0.42 : 0.26);
        const m = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), crystalMat);
        m.scale.set(s * 0.55, s * 1.8, s * 0.55); m.position.set((R() - 0.5) * 0.7, s * 0.9, (R() - 0.5) * 0.5);
        m.rotation.set((R() - 0.5) * 0.9, R() * 3, (R() - 0.5) * 0.9); cl.add(m);
      }
      if (onCeil) { cl.rotation.x = Math.PI; cl.position.set(x, G.y1, z1 + 0.8 + R() * 2); }
      else { cl.rotation.x = -Math.PI / 2 + 0.35; cl.position.set(x, G.y0 + 0.8 + R() * (G.y1 - G.y0 - 1.6), z1 + 0.05); }
      parent.add(cl); mineDecor.crystals.push(cl);
    }
    // a lamp that matters
    const L = new THREE.PointLight(0xffb066, 0, deep ? 34 : 24, 1.4); L.position.set((G.x0 + G.x1) / 2, G.y1 - 1.2, z0 - 1.6); parent.add(L); mineDecor.lights.push(L);
  };
  scene.add(mineDecor.g1);
  gallery(MINE.g1, mineDecor.g1, false);
  scene.add(mineDecor.g2);
  gallery(MINE.g2, mineDecor.g2, true);
  // the deep seam: a glowing crack at the far end of the deep gallery, where Wildlight wakes
  const seam = new THREE.Group();
  const seamMat = new THREE.MeshBasicMaterial({ color: 0xffd28a, transparent: true, opacity: 0.95 });
  for (let i = 0; i < 9; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.18 + Math.random() * 0.2, 0.9 + Math.random() * 1.2), seamMat);
    m.position.set((Math.random() - 0.5) * 0.4, 1 + i * 0.42, 0); m.rotation.z = (Math.random() - 0.5) * 0.9; seam.add(m);
  }
  seam.position.set(MINE.g2.x0 + 0.06, MINE.g2.y0, z0 - 2.3); seam.rotation.y = Math.PI / 2;
  mineDecor.g2.add(seam); mineDecor.seam = seam;
  // ladder up the shaft
  const S = MINE.shaft, sx = (S.x0 + S.x1) / 2 + 0.9;
  for (const dx of [-0.35, 0.35]) add(new THREE.BoxGeometry(0.09, -MINE.g2.y0, 0.09), oak, sx + dx, MINE.g2.y0 / 2, z1 + 0.35, mineDecor.g1, false);
  for (let y = MINE.g2.y0 + 0.4; y < -0.6; y += 0.45) add(new THREE.BoxGeometry(0.75, 0.06, 0.06), oak, sx, y, z1 + 0.35, mineDecor.g1, false);
  mergeStatic(mineDecor.g1);
  mergeStatic(mineDecor.g2, o => { for (let p = o; p; p = p.parent) if (p === mineDecor.seam) return true; return false; });
  // lift cage on a rope
  const cage = new THREE.Group();
  const cm = (w, h, d, x, y, z, m) => { const k = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); k.position.set(x, y, z); k.castShadow = true; cage.add(k); };
  cm(1.7, 0.12, 1.7, 0, 0, 0, oak); cm(1.7, 0.08, 1.7, 0, 2.1, 0, iron);
  for (const [x, z] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) cm(0.07, 2.1, 0.07, x, 1.05, z, iron);
  cage.position.set(S.x0 + 1.1, MINE.g1.y0 + 0.06, z0 - 2.2); scene.add(cage); mineDecor.cage = cage;
  const rope = add(new THREE.CylinderGeometry(0.035, 0.035, 1, 5), new THREE.MeshStandardMaterial({ color: 0xb59a70, roughness: 1 }), S.x0 + 1.1, 0, z0 - 2.2, scene, false);
  mineDecor.rope = rope;
}

// ----------------------------------------------------------------- sky, clouds, far peaks
const skyU = { uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSun: { value: new THREE.Vector3() }, uSunCol: { value: new THREE.Color() }, uNight: { value: 0 }, uMoon: { value: new THREE.Vector3() }, uTime: { value: 0 } };
function buildSky() {
  const geo = new THREE.SphereGeometry(1100, 48, 24);
  const mat = new THREE.ShaderMaterial({
    uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform vec3 uTop, uHor, uSun, uSunCol, uMoon; uniform float uNight, uTime; varying vec3 vDir;
      float h3(vec3 p){ p = fract(p*0.3183099+.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
      void main(){
        vec3 d = normalize(vDir);
        float y = max(d.y, -0.2);
        vec3 col = mix(uHor, uTop, pow(clamp(y,0.0,1.0), 0.55));
        // a warm band just above the cloud sea
        col += uSunCol * 0.18 * exp(-abs(d.y+0.02)*14.0) * (1.0-uNight*0.7);
        float sd = max(dot(d, normalize(uSun)), 0.0);
        col += uSunCol * (pow(sd, 900.0)*14.0 + pow(sd, 18.0)*0.45 + pow(sd,3.0)*0.12);
        // the Thinning: a faint iridescent veil very high up
        float veil = smoothstep(0.55,0.75,d.y)*(1.0-smoothstep(0.8,1.0,d.y));
        col += veil * 0.06 * vec3(0.6+0.4*sin(d.x*9.0+uTime*0.05), 0.7, 0.9+0.1*cos(d.z*7.0)) * (0.4+uNight);
        // stars and moon
        if(uNight > 0.01){
          vec3 g = floor(d*320.0); float s = h3(g); float tw = 0.6+0.4*sin(uTime*2.0+s*40.0);
          col += vec3(0.85,0.9,1.0) * step(0.9965, s) * tw * uNight * smoothstep(0.0,0.25,d.y) * 1.4;
          float md = max(dot(d, normalize(uMoon)), 0.0);
          col += vec3(0.85,0.9,1.0) * (smoothstep(0.99955,0.9997,md)*1.6 + pow(md,60.0)*0.25) * uNight;
        }
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(geo, mat); sky.renderOrder = -10; sky.frustumCulled = false; scene.add(sky);
  return sky;
}
const cloudU = { uTime: { value: 0 }, uLit: { value: new THREE.Color() }, uShade: { value: new THREE.Color() }, uFog: { value: new THREE.Color() }, uSun: { value: new THREE.Vector3() } };
function buildClouds() {
  const mk = (y, scale, alpha, seed) => {
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...cloudU, uScale: { value: scale }, uAlpha: { value: alpha }, uSeed: { value: seed } }, transparent: true, depthWrite: false, fog: false,
      vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `
        uniform float uTime, uScale, uAlpha, uSeed; uniform vec3 uLit, uShade, uFog, uSun; varying vec3 vW;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
        float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
        float fbm(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<5;i++){ s+=a*n(p); p=p*2.03+vec2(1.7,9.2); a*=0.5; } return s; }
        void main(){
          vec2 p = vW.xz/uScale + vec2(uTime*0.004, uTime*0.0015) + uSeed;
          float c = fbm(p) ; float c2 = fbm(p*2.3 + 4.0 - uTime*0.003);
          float dens = smoothstep(0.34, 0.74, c*0.78 + c2*0.36);
          vec2 e = vec2(0.02, 0.0);
          float shade = clamp(0.5 + (fbm(p - normalize(uSun.xz+0.0001)*0.06) - c)*6.0, 0.0, 1.0);
          vec3 col = mix(uShade, uLit, clamp(shade*0.75 + dens*0.45 - 0.12, 0.0, 1.0));
          float dist = length(vW.xz - cameraPosition.xz);
          float fade = 1.0 - smoothstep(380.0, 1000.0, dist);
          col = mix(col, uFog, smoothstep(150.0, 900.0, dist)*0.85);
          gl_FragColor = vec4(col, dens * uAlpha * fade);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), mat); m.rotation.x = -Math.PI / 2; m.position.y = y; m.renderOrder = -5; scene.add(m); return m;
  };
  // a solid floor of cloud, a broken layer above it, and drifting puffs that hug the cliffs
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: true }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -52; scene.add(floor); worldMats.cloudFloor = floor.material;
  const a = mk(-44, 140, 0.95, 0.0), b = mk(-36, 90, 0.75, 13.0);
  // soft billboards around the base of the plateau
  const pc = document.createElement('canvas'); pc.width = pc.height = 128; const g = pc.getContext('2d');
  for (let i = 0; i < 14; i++) { const x = 30 + Math.random() * 68, y = 40 + Math.random() * 48, r = 18 + Math.random() * 26, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }
  const puffTex = canvasTex(pc);
  const puffs = [];
  worldMats.puff = new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false, opacity: 0.85, fog: true });
  for (let i = 0; i < 26; i++) {
    const ang = i / 26 * TAU + Math.random() * 0.2, r = 46 + Math.random() * 20;
    const s = new THREE.Sprite(worldMats.puff);
    s.position.set(Math.cos(ang) * r, -34 - Math.random() * 10, Math.sin(ang) * r * 0.85 + 2); s.scale.set(48 + Math.random() * 30, 22 + Math.random() * 10, 1);
    s.userData.ang = ang; s.userData.r = r; scene.add(s); puffs.push(s);
  }
  return { a, b, puffs };
}
function buildPeaks() {
  const R = mulberry(5150), group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, envMapIntensity: 0.1 });
  worldMats.peaks = mat;
  for (let i = 0; i < 16; i++) {
    const ang = i / 16 * TAU + R() * 0.3, dist = 330 + R() * 260;
    if (Math.abs(((ang + Math.PI) % TAU) - Math.PI - Math.PI / 2) < 0.25 && dist < 400) continue;
    const h = 60 + R() * 150, r = h * (0.55 + R() * 0.35);
    const geo = new THREE.ConeGeometry(r, h, 9, 6, true);
    const p = geo.attributes.position, cols = [];
    for (let k = 0; k < p.count; k++) {
      const x = p.getX(k), y = p.getY(k), z = p.getZ(k), t = (y + h / 2) / h;
      const nn = (fbm(x / 22 + i * 3, z / 22 + y / 30, 3) - 0.5) * r * 0.45 * (1 - t * 0.6);
      p.setXYZ(k, x + nn, y + (fbm(x / 9, z / 9) - 0.5) * 8 * (1 - t), z + nn * 0.8);
      const snow = smooth(0.62, 0.72, t + (fbm(x / 6, z / 6) - 0.5) * 0.2);
      const rock = [0.36 + R() * 0.05, 0.37, 0.44];
      cols.push(lerp(rock[0], 0.95, snow), lerp(rock[1], 0.96, snow), lerp(rock[2], 1.0, snow));
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat); m.position.set(Math.cos(ang) * dist, h / 2 - 58, Math.sin(ang) * dist); m.rotation.y = R() * TAU;
    group.add(m);
  }
  scene.add(group);
  return group;
}

// ----------------------------------------------------------------- lights and the hours of the day
const sun = new THREE.DirectionalLight(0xffffff, 3);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -62, right: 62, top: 62, bottom: -62, near: 10, far: 320 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
scene.add(sun); scene.add(sun.target);
const hemi = new THREE.HemisphereLight(0xbfd6ff, 0x6a5a40, 0.6); scene.add(hemi);
scene.fog = new THREE.Fog(0xcfd8e0, 220, 1250);

// time of day t in [0,1): 0 = first light, ~0.05 sunrise, 0.64 sunset, 0.7 full night, 0.97 pre-dawn
const SKY_KEYS = [
  // t,    zenith,    horizon,   sun colour, sunI, hemiSky,  hemiGnd,  hemiI, fog,       exposure, cloudLit, cloudShade
  [0.00, '#2a3456', '#c48a7a', '#ff9a66', 0.0, '#4a5680', '#2a2430', 0.25, '#8a7a8a', 0.95, '#f2b7a0', '#5a5a7a'],
  [0.05, '#4d6fa0', '#ffbd8a', '#ffb070', 1.6, '#9ab0d8', '#5a4a3a', 0.45, '#e7b8a0', 1.0, '#ffd2b0', '#8a8aa8'],
  [0.15, '#4f86c6', '#cfe2f0', '#fff0d8', 3.0, '#bfd6ff', '#6a5a40', 0.6, '#c8d8e6', 1.0, '#ffffff', '#8e9ab4'],
  [0.35, '#3f7cc4', '#d8e8f4', '#fffaf0', 3.4, '#c6dcff', '#6e5e44', 0.65, '#d0dde8', 1.0, '#ffffff', '#93a0b8'],
  [0.55, '#4a80c0', '#f0dcc0', '#ffe2b8', 2.9, '#c0d0f0', '#6a5640', 0.6, '#e0d4c4', 1.0, '#fff4e4', '#9a98ac'],
  [0.63, '#3b4f86', '#ff9e6a', '#ff8a4a', 1.4, '#8a90c0', '#5a4038', 0.45, '#e09a7a', 1.02, '#ffb88a', '#7a6a8a'],
  [0.69, '#1c2244', '#6a4a6e', '#ff6a4a', 0.0, '#3a4270', '#2a2030', 0.3, '#3a3450', 1.05, '#8a6a8a', '#2a2a46'],
  [0.78, '#0b1028', '#26304e', '#9ab0ff', 0.55, '#2a3868', '#141420', 0.24, '#1c2238', 1.1, '#4a5a80', '#141a30'],
  [0.92, '#0c122c', '#2a3352', '#9ab0ff', 0.5, '#2a3868', '#141420', 0.24, '#1e2440', 1.1, '#4a5a80', '#141a30'],
  [1.00, '#2a3456', '#c48a7a', '#ff9a66', 0.0, '#4a5680', '#2a2430', 0.25, '#8a7a8a', 0.95, '#f2b7a0', '#5a5a7a'],
];
const _c1 = new THREE.Color(), _c2 = new THREE.Color();
function keyLerp(t, col) {
  let i = 0; while (i < SKY_KEYS.length - 2 && SKY_KEYS[i + 1][0] <= t) i++;
  const a = SKY_KEYS[i], b = SKY_KEYS[i + 1], k = smooth(0, 1, (t - a[0]) / (b[0] - a[0]));
  if (typeof a[col] === 'number') return lerp(a[col], b[col], k);
  return _c1.set(a[col]).lerp(_c2.set(b[col]), k).clone();
}
const TOD = { t: 0.12, night: 0, sunlight: 1, phase: 'day' };
function dayPhase(t) { return t < 0.05 ? 'dawn' : t < 0.6 ? 'day' : t < 0.69 ? 'dusk' : t < 0.96 ? 'night' : 'dawn'; }
function applyTimeOfDay(t, time) {
  TOD.t = t;
  // sun travels east → south → west across the day portion
  const dayK = clamp((t - 0.02) / (0.67 - 0.02), 0, 1), sunAng = dayK * Math.PI;
  const elev = Math.sin(sunAng) * 1.05 + (dayK <= 0 || dayK >= 1 ? -0.3 : 0);
  const sunDir = new THREE.Vector3(Math.cos(sunAng), Math.max(0.05, elev), 0.45 + Math.sin(sunAng) * 0.5).normalize();
  const nightK = t > 0.67 ? (t - 0.67) / 0.33 : 0;
  const moonDir = new THREE.Vector3(Math.cos(nightK * Math.PI), 0.25 + Math.sin(nightK * Math.PI) * 0.8, 0.6).normalize();
  const night = t < 0.03 ? 1 - t / 0.03 * 0.6 : t < 0.06 ? 0.4 - (t - 0.03) / 0.03 * 0.4 : smooth(0.6, 0.72, t) * (1 - smooth(0.95, 1.0, t)) + (t > 0.97 ? smooth(0.97, 1, t) : 0);
  TOD.night = clamp(night, 0, 1);
  TOD.sunlight = clamp(Math.sin(sunAng) * 1.6, 0, 1) * (t < 0.66 ? 1 : 0);
  TOD.phase = dayPhase(t);
  const useMoon = TOD.night > 0.5;
  const ld = useMoon ? moonDir : sunDir;
  sun.position.copy(ld).multiplyScalar(160); sun.target.position.set(0, 0, 0);
  sun.color.copy(keyLerp(t, 3)); sun.intensity = keyLerp(t, 4);
  hemi.color.copy(keyLerp(t, 5)); hemi.groundColor.copy(keyLerp(t, 6)); hemi.intensity = keyLerp(t, 7);
  scene.fog.color.copy(keyLerp(t, 8));
  renderer.toneMappingExposure = keyLerp(t, 9);
  skyU.uTop.value.copy(keyLerp(t, 1)); skyU.uHor.value.copy(keyLerp(t, 2));
  skyU.uSun.value.copy(sunDir); skyU.uSunCol.value.copy(keyLerp(t, 3)).multiplyScalar(TOD.night > 0.6 ? 0 : 1);
  skyU.uMoon.value.copy(moonDir); skyU.uNight.value = TOD.night; skyU.uTime.value = time;
  cloudU.uLit.value.copy(keyLerp(t, 10)); cloudU.uShade.value.copy(keyLerp(t, 11)); cloudU.uFog.value.copy(keyLerp(t, 8)); cloudU.uSun.value.copy(ld); cloudU.uTime.value = time;
  if (worldMats.cloudFloor) worldMats.cloudFloor.color.copy(keyLerp(t, 11)).multiplyScalar(0.82);
  if (worldMats.puff) worldMats.puff.color.copy(keyLerp(t, 11)).lerp(keyLerp(t, 10), 0.5);
  if (worldMats.clumps) for (const m of worldMats.clumps) m.emissiveIntensity = 0.06 + TOD.night * 0.3;
  const envK = lerp(1, 0.18, TOD.night);
  for (const m of ENV_MATS) m.envMapIntensity = m.userData.env * envK;
  if (bloom) { bloom.strength = lerp(0.42, 0.95, TOD.night); bloom.threshold = lerp(0.88, 0.62, TOD.night); }
}
const ENV_MATS = [];
function trackEnv(m, k) { m.envMapIntensity = k; m.userData.env = k; ENV_MATS.push(m); return m; }
